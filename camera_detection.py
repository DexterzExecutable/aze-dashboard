#!/usr/bin/env python3
"""
RPi Camera Object Detection Server
Supports picamera2 (RPi OS Bookworm with rpicam stack) and legacy picamera
Uses OpenCV for real-time object detection
Streams MJPEG over HTTP for web display
"""

import io
import json
import time
import threading
import argparse
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
import numpy as np

# Camera and OpenCV imports
try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False
    print("WARNING: OpenCV not installed. Object detection disabled.")
    print("  Install with: sudo apt install python3-opencv")

# Try picamera2 first (RPi OS Bookworm with rpicam stack)
HAS_PICAMERA2 = False
HAS_PICAMERA_LEGACY = False

try:
    from picamera2 import Picamera2
    HAS_PICAMERA2 = True
    print("INFO: Using picamera2 (rpicam stack)")
except ImportError:
    print("INFO: picamera2 not found, trying legacy picamera...")

# Fall back to legacy picamera (older RPi OS)
if not HAS_PICAMERA2:
    try:
        import picamera
        import picamera.array
        HAS_PICAMERA_LEGACY = True
        print("INFO: Using legacy picamera")
    except ImportError:
        print("WARNING: Neither picamera2 nor picamera installed.")
        print("  For RPi OS Bookworm: sudo apt install python3-picamera2")
        print("  Test camera with: rpicam-hello")

HAS_PICAMERA = HAS_PICAMERA2 or HAS_PICAMERA_LEGACY

# Global variables
camera = None
output_frame = None
lock = threading.Lock()
detection_enabled = True
show_fps = True
show_labels = True
fps_counter = 0
fps_value = 0
last_fps_time = time.time()
frame_count = 0  # For skipping detection frames
last_detections = []  # Cache detections to draw on skipped frames

# Settings - optimized for RPi 3B
settings = {
    "resolution": (320, 240),  # Lower resolution for better FPS on RPi 3B
    "fps": 30,
    "rotation": 0,
    "objectDetection": False,  # Disabled by default for performance
    "confidenceThreshold": 0.5,
    "showLabels": True,
    "showFps": True,
    "flipHorizontal": False,
    "flipVertical": False,
    "brightness": 100,
    "contrast": 100
}

# MobileNet SSD class labels
CLASSES = ["background", "aeroplane", "bicycle", "bird", "boat",
           "bottle", "bus", "car", "cat", "chair", "cow", "diningtable",
           "dog", "horse", "motorbike", "person", "pottedplant", "sheep",
           "sofa", "train", "tvmonitor"]

# Random colors for each class
COLORS = np.random.uniform(0, 255, size=(len(CLASSES), 3))

# Neural network for object detection
net = None

def load_detection_model():
    """Load MobileNet SSD model for object detection"""
    global net
    if not HAS_OPENCV:
        return False
    
    try:
        # Download model files if not present
        prototxt = "MobileNetSSD_deploy.prototxt"
        model = "MobileNetSSD_deploy.caffemodel"
        
        # Check if model files exist
        import os
        if not os.path.exists(prototxt) or not os.path.exists(model):
            print("Downloading MobileNet SSD model files...")
            import urllib.request
            
            prototxt_url = "https://raw.githubusercontent.com/chuanqi305/MobileNet-SSD/master/deploy.prototxt"
            model_url = "https://github.com/chuanqi305/MobileNet-SSD/raw/master/mobilenet_iter_73000.caffemodel"
            
            try:
                urllib.request.urlretrieve(prototxt_url, prototxt)
                urllib.request.urlretrieve(model_url, model)
                print("Model files downloaded successfully!")
            except Exception as e:
                print(f"Could not download model files: {e}")
                print("Object detection will be disabled.")
                return False
        
        net = cv2.dnn.readNetFromCaffe(prototxt, model)
        print("MobileNet SSD model loaded successfully!")
        return True
    except Exception as e:
        print(f"Error loading detection model: {e}")
        return False

def detect_objects(frame, run_detection=True):
    """Run object detection on frame, or draw cached detections"""
    global net, settings, last_detections
    
    if net is None or not settings["objectDetection"]:
        return frame
    
    (h, w) = frame.shape[:2]
    
    if run_detection:
        # Create blob from frame
        blob = cv2.dnn.blobFromImage(cv2.resize(frame, (300, 300)), 0.007843, (300, 300), 127.5)
        
        # Pass blob through network
        net.setInput(blob)
        detections = net.forward()
        
        # Cache detections for subsequent frames
        last_detections = []
        for i in range(detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            if confidence > settings["confidenceThreshold"]:
                idx = int(detections[0, 0, i, 1])
                if idx < len(CLASSES):
                    box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                    (startX, startY, endX, endY) = box.astype("int")
                    last_detections.append({
                        "idx": idx,
                        "confidence": confidence,
                        "box": (startX, startY, endX, endY)
                    })
    
    # Draw cached detections
    for det in last_detections:
        idx = det["idx"]
        startX, startY, endX, endY = det["box"]
        color = COLORS[idx]
        cv2.rectangle(frame, (startX, startY), (endX, endY), color, 2)
        
        if settings["showLabels"]:
            label = f"{CLASSES[idx]}: {det['confidence']:.2f}"
            y = startY - 15 if startY - 15 > 15 else startY + 15
            cv2.putText(frame, label, (startX, y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    
    return frame

def camera_thread():
    """Main camera capture thread"""
    global camera, output_frame, lock, fps_counter, fps_value, last_fps_time, settings, frame_count
    
    try:
        if HAS_PICAMERA2:
            # Initialize Pi Camera using picamera2
            camera = Picamera2()
            # Use lower resolution for better performance on RPi 3B
            config = camera.create_preview_configuration(
                main={"size": settings["resolution"], "format": "RGB888"},
                buffer_count=2  # Reduce buffer count for less memory usage
            )
            camera.configure(config)
            camera.start()
            # Let camera warm up
            time.sleep(1)
            print(f"Pi Camera (picamera2) started at {settings['resolution']}")
        elif HAS_PICAMERA_LEGACY:
            # Initialize Pi Camera using legacy picamera (RPi 3B)
            camera = picamera.PiCamera()
            camera.resolution = settings["resolution"]
            camera.framerate = settings["fps"]
            # Apply rotation if set
            if settings["rotation"] != 0:
                camera.rotation = settings["rotation"]
            # Apply flip
            camera.hflip = settings["flipHorizontal"]
            camera.vflip = settings["flipVertical"]
            # Allow camera to warm up
            time.sleep(2)
            print(f"Pi Camera (legacy) started at {settings['resolution']}")
        elif HAS_OPENCV:
            # Fallback to USB camera or webcam
            camera = cv2.VideoCapture(0)
            camera.set(cv2.CAP_PROP_FRAME_WIDTH, settings["resolution"][0])
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, settings["resolution"][1])
            camera.set(cv2.CAP_PROP_FPS, settings["fps"])
            print(f"OpenCV camera started at {settings['resolution']}")
        else:
            print("ERROR: No camera interface available!")
            return
    except Exception as e:
        print(f"ERROR: Failed to initialize camera: {e}")
        return
    
    # Create raw capture for legacy picamera
    if HAS_PICAMERA_LEGACY:
        raw_capture = picamera.array.PiRGBArray(camera, size=settings["resolution"])
    
    print("Camera thread running...")
    
    while True:
        try:
            # Capture frame based on camera type
            if HAS_PICAMERA2:
                try:
                    frame = camera.capture_array("main")
                except Exception as cap_err:
                    print(f"Capture error: {cap_err}")
                    time.sleep(0.1)
                    continue
                    
                # picamera2 gives us RGB, OpenCV needs BGR
                if frame is not None and len(frame.shape) == 3 and frame.shape[2] == 3:
                    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                else:
                    time.sleep(0.1)
                    continue
            elif HAS_PICAMERA_LEGACY:
                # Capture using legacy picamera - must seek(0) and truncate(0) to reuse buffer
                raw_capture.seek(0)
                raw_capture.truncate()
                camera.capture(raw_capture, format="bgr", use_video_port=True)
                frame = raw_capture.array
            else:
                ret, frame = camera.read()
                if not ret:
                    continue
            
            # Apply transformations (only for non-legacy picamera since it handles it internally)
            if not HAS_PICAMERA_LEGACY:
                if settings["flipHorizontal"]:
                    frame = cv2.flip(frame, 1)
                if settings["flipVertical"]:
                    frame = cv2.flip(frame, 0)
                if settings["rotation"] != 0:
                    if settings["rotation"] == 90:
                        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
                    elif settings["rotation"] == 180:
                        frame = cv2.rotate(frame, cv2.ROTATE_180)
                    elif settings["rotation"] == 270:
                        frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
            
            # Run object detection only every 10 frames to improve performance on RPi 3B
            frame_count += 1
            if settings["objectDetection"] and HAS_OPENCV:
                run_detection = (frame_count % 10 == 0)  # Detect every 10th frame
                frame = detect_objects(frame, run_detection)
            
            # Calculate FPS
            fps_counter += 1
            current_time = time.time()
            if current_time - last_fps_time >= 1.0:
                fps_value = fps_counter
                fps_counter = 0
                last_fps_time = current_time
            
            # Draw FPS
            if settings["showFps"]:
                cv2.putText(frame, f"FPS: {fps_value}", (10, 30),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # Encode frame to JPEG (lower quality for faster encoding)
            ret, encoded = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            
            if ret:
                with lock:
                    output_frame = encoded.tobytes()
            
            # No sleep - let picamera2 handle timing
            
        except Exception as e:
            print(f"Camera loop error: {e}")
            traceback.print_exc()
            time.sleep(1)

class StreamHandler(BaseHTTPRequestHandler):
    """HTTP request handler for camera stream"""
    
    def log_message(self, format, *args):
        pass  # Suppress logging
    
    def do_GET(self):
        global output_frame, lock, settings
        
        # Parse path without query string
        from urllib.parse import urlparse
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path == '/':
            # Serve status page
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(b'''
                <html>
                <head><title>Pi Camera Stream</title></head>
                <body style="background:#000;color:#fff;font-family:sans-serif;text-align:center;">
                    <h1>Pi Camera Object Detection</h1>
                    <img src="/stream.mjpg" style="max-width:100%;border:2px solid #333;">
                    <p>Settings: <a href="/settings" style="color:#4285f4;">/settings</a></p>
                </body>
                </html>
            ''')
            
        elif path == '/stream.mjpg':
            # Stream MJPEG
            self.send_response(200)
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=frame')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            last_frame = None
            try:
                while True:
                    with lock:
                        if output_frame is None:
                            time.sleep(0.01)
                            continue
                        # Only send if frame changed
                        if output_frame == last_frame:
                            time.sleep(0.01)
                            continue
                        frame = output_frame
                        last_frame = frame
                    
                    self.wfile.write(b'--frame\r\n')
                    self.wfile.write(b'Content-Type: image/jpeg\r\n\r\n')
                    self.wfile.write(frame)
                    self.wfile.write(b'\r\n')
            except Exception as e:
                pass
                
        elif path == '/snapshot.jpg':
            # Single frame snapshot
            self.send_response(200)
            self.send_header('Content-Type', 'image/jpeg')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            with lock:
                if output_frame:
                    self.wfile.write(output_frame)
                    
        elif path == '/settings':
            # Return current settings
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(settings).encode())
            
        elif path == '/status':
            # Return status
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            status = {
                "running": camera is not None,
                "fps": fps_value,
                "detection": settings["objectDetection"],
                "resolution": settings["resolution"]
            }
            self.wfile.write(json.dumps(status).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        global settings
        
        from urllib.parse import urlparse
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path == '/settings':
            # Update settings
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                new_settings = json.loads(post_data.decode())
                settings.update(new_settings)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "settings": settings}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def main():
    global settings
    
    parser = argparse.ArgumentParser(description='Pi Camera Object Detection Server')
    parser.add_argument('--port', type=int, default=8081, help='HTTP server port')
    parser.add_argument('--width', type=int, default=640, help='Frame width')
    parser.add_argument('--height', type=int, default=480, help='Frame height')
    parser.add_argument('--fps', type=int, default=15, help='Target FPS')
    parser.add_argument('--no-detection', action='store_true', help='Disable object detection')
    parser.add_argument('--settings-file', type=str, default=None, help='Load settings from JSON file')
    args = parser.parse_args()
    
    # Load settings from file if provided
    if args.settings_file:
        try:
            with open(args.settings_file, 'r') as f:
                data = json.load(f)
                if 'cameraSettings' in data:
                    cam_settings = data['cameraSettings']
                    if 'resolution' in cam_settings:
                        res = cam_settings['resolution'].split('x')
                        settings['resolution'] = (int(res[0]), int(res[1]))
                    if 'fps' in cam_settings:
                        settings['fps'] = cam_settings['fps']
                    if 'rotation' in cam_settings:
                        settings['rotation'] = cam_settings['rotation']
                    if 'objectDetection' in cam_settings:
                        settings['objectDetection'] = cam_settings['objectDetection']
                    if 'confidenceThreshold' in cam_settings:
                        settings['confidenceThreshold'] = cam_settings['confidenceThreshold']
                    if 'showLabels' in cam_settings:
                        settings['showLabels'] = cam_settings['showLabels']
                    if 'showFps' in cam_settings:
                        settings['showFps'] = cam_settings['showFps']
                    if 'flipHorizontal' in cam_settings:
                        settings['flipHorizontal'] = cam_settings['flipHorizontal']
                    if 'flipVertical' in cam_settings:
                        settings['flipVertical'] = cam_settings['flipVertical']
                print(f"Loaded settings from {args.settings_file}")
        except Exception as e:
            print(f"Could not load settings file: {e}")
    
    # Override with command line args
    settings["resolution"] = (args.width, args.height)
    settings["fps"] = args.fps
    if args.no_detection:
        settings["objectDetection"] = False
    
    print("=" * 50)
    print("Pi Camera Object Detection Server")
    print("=" * 50)
    print(f"Resolution: {settings['resolution']}")
    print(f"FPS: {settings['fps']}")
    print(f"Object Detection: {settings['objectDetection']}")
    print(f"Server Port: {args.port}")
    print("=" * 50)
    
    # Load detection model
    if settings["objectDetection"]:
        load_detection_model()
    
    # Start camera thread
    cam_thread = threading.Thread(target=camera_thread, daemon=True)
    cam_thread.start()
    
    # Wait for camera to initialize
    time.sleep(2)
    
    # Start HTTP server
    server = HTTPServer(('0.0.0.0', args.port), StreamHandler)
    print(f"Stream URL: http://localhost:{args.port}/stream.mjpg")
    print(f"Snapshot URL: http://localhost:{args.port}/snapshot.jpg")
    print("Press Ctrl+C to stop")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
        if HAS_PICAMERA2 and camera:
            camera.stop()
        elif HAS_PICAMERA_LEGACY and camera:
            camera.close()
        elif HAS_OPENCV and camera:
            camera.release()

if __name__ == '__main__':
    main()
