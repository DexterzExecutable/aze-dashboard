# Aze Dashboard

A sleek, customizable live dashboard designed for Raspberry Pi. Perfect for a bedside display, home command center, or just a cool tech project to show off. Control everything from your phone while the dashboard runs on your Pi.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red.svg)

---

## What is This?

Aze Dashboard turns your Raspberry Pi into a smart display that cycles through different screens — clock, weather, news, system stats, camera feed, and more. The best part? You control everything from your phone or laptop through a slick web interface. No need to touch the Pi after initial setup.

I built this because I wanted something that just works out of the box but is also completely customizable. Whether you want a minimal clock display or a full-featured command center with live camera feeds and news tickers, Aze Dashboard has you covered.

---

## Quick Look

**Dashboard running on a Pi:**
- Real-time clock with greeting
- Weather forecast 
- Todos and upcoming events
- News headlines from your RSS feeds
- System stats (CPU, RAM, temperature)
- Live camera with object detection
- Custom countdown timers
- Message board

**Control panel on your phone:**
- Toggle screens on/off
- Change cycle timing
- Add todos and events
- Manage news feeds
- Upload custom backgrounds
- Full camera controls
- Everything syncs in real-time

---

## Features

### Screen Cycling

The dashboard automatically rotates through your enabled screens. You pick which ones you want and how long each stays on screen.

| Screen | What It Shows |
|--------|---------------|
| **Home** | Clock, date, greeting, weather summary, todos, upcoming events |
| **Weather** | Full forecast — temperature, conditions, wind, humidity, feels like |
| **News** | Headlines from your RSS feeds (up to 6 at a time) |
| **Stats** | CPU usage, RAM usage, Pi temperature |
| **Messages** | Custom messages you send from your phone |
| **Countdown** | Days/hours/minutes until your event |
| **Timer** | Stopwatch or Pomodoro timer |
| **Todo** | Full todo list view |
| **Events** | Calendar events list |
| **Camera** | Live Pi camera feed with optional object detection |

### Camera & Object Detection

If you have a Pi Camera Module plugged in, you can stream live video to the dashboard. Enable object detection and it'll identify people, cars, pets, and more using MobileNet SSD — all running locally on your Pi.

The camera settings let you:
- Adjust resolution and FPS (lower = better performance on Pi 3B)
- Enable/disable object detection
- Set detection confidence threshold
- Flip or rotate the image
- Auto-start camera on boot

### Customization

Make it yours:
- **Backgrounds** — Upload your own images or search Pexels for wallpapers
- **Presets** — Space, Nature, Gradient themes or go with a solid color
- **Fonts** — Change the clock font family
- **Colors** — Set your accent color
- **Effects** — Add blur or dim to the background

### Real-Time Sync

Everything uses Socket.IO so changes appear instantly. Add a todo on your phone and watch it pop up on the dashboard in real-time. No refreshing needed.

### Persistent Settings

All your settings save to `settings.json` automatically. Restart the server, reboot the Pi — everything comes back exactly how you left it.

---

## What You'll Need

### Hardware

- Raspberry Pi (tested on 3B, 3B+, 4, and 5)
- A display (I use a 480x320 but any size works)
- Optional: Pi Camera Module (v1.3, v2, or v3) for the camera screen

### Software

- Node.js 18 or higher
- Python 3.7+ (only needed for camera features)
- Chromium browser (for kiosk mode)
- PM2 (keeps the server running)

---

## Installation

### Step 1: Clone the Repo

```bash
git clone https://github.com/DexterzExecutable/aze-dashboard.git
cd aze-dashboard
```

### Step 2: Install Node Dependencies

```bash
npm install
```

This installs Express, Socket.IO, and the other packages the server needs.

### Step 3: Install Pi-Specific Tools

```bash
sudo apt update
sudo apt install -y xdotool chromium-browser
sudo npm install -g pm2
```

- **xdotool** — Lets you remotely refresh the browser
- **chromium-browser** — Runs the dashboard in kiosk mode
- **pm2** — Keeps your server running and auto-restarts on crash

### Step 4: Set Up the Camera (Optional)

If you want the camera screen:

```bash
# For Pi OS Bookworm and newer (recommended):
sudo apt install -y python3-picamera2 python3-opencv python3-numpy

# Or use pip:
pip3 install -r requirements.txt
```

Then enable the camera:

```bash
sudo raspi-config
# Go to Interface Options → Camera → Enable
# Reboot when done
```

Test it works:

```bash
rpicam-hello  # New Pi OS
# or
raspistill -o test.jpg  # Older Pi OS
```

---

## Running the Dashboard

### Quick Start

```bash
npm start
```

The server starts on **http://localhost:4000**

### Production Mode with PM2

For a real setup, use PM2 so the server survives reboots and crashes:

```bash
# Start it
npm run pm2:start

# Make it start on boot
pm2 startup
pm2 save
```

### Kiosk Mode

Run Chromium in fullscreen pointing at the dashboard:

```bash
npm run kiosk
```

Or manually:

```bash
chromium-browser --kiosk http://localhost:4000
```

For auto-start on boot, add to your Pi's autostart file:

```bash
nano ~/.config/lxsession/LXDE-pi/autostart
```

Add this line:

```
@chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:4000
```

---

## Using Aze Dashboard

### Access Points

Once running, open these URLs:

| URL | What It Is |
|-----|------------|
| `http://YOUR_PI_IP:4000/` | The dashboard display |
| `http://YOUR_PI_IP:4000/control` | Control panel (works great on mobile) |

Find your Pi's IP with `hostname -I`

### The Control Panel

The control panel at `/control` is where you manage everything. It's organized in tabs:

**Screens Tab**
- Toggle each screen on/off with the switches
- Drag to reorder screens
- Set how long each screen displays (5-60 seconds)

**Todo Tab**
- Add new todos
- Check off completed ones
- Delete old ones

**Calendar Tab**
- Add events with date and time
- View upcoming events
- Delete past events

**News Tab**
- Add RSS feed URLs
- Remove feeds you don't want
- Quick-add presets for BBC, Reuters, etc.

**Messages Tab**
- Type a message to display on the dashboard
- Clear the current message

**Countdown Tab**
- Set a countdown name, date, and time
- Clear the countdown

**Camera Tab**
- Start/stop the camera
- Adjust resolution and FPS
- Toggle object detection
- Flip and rotate the image
- Set confidence threshold for detection

**Settings Tab**
- Clock format (12/24 hour)
- Date format
- Temperature unit (C/F)
- Greeting name
- Weather location
- Background settings (search, upload, presets)
- Accent color and font

---

## NPM Scripts Reference

| Script | What It Does |
|--------|--------------|
| `npm start` | Starts the server |
| `npm run camera` | Starts the camera server |
| `npm run camera:bg` | Starts camera in background |
| `npm run pm2:start` | Start with PM2 |
| `npm run pm2:stop` | Stop PM2 process |
| `npm run pm2:restart` | Restart PM2 process |
| `npm run pm2:logs` | View server logs |
| `npm run pm2:save` | Save PM2 process list |
| `npm run kiosk` | Launch fullscreen browser |

---

## Configuration Deep Dive

### Camera Settings

The camera runs as a separate Python process that serves an MJPEG stream. Here's what each setting does:

| Setting | Default | Notes |
|---------|---------|-------|
| Resolution | 320x240 | Lower = faster. Pi 3B struggles above 640x480 |
| FPS | 30 | Target framerate |
| Object Detection | Off | Uses CPU, slows things down on older Pis |
| Confidence | 0.5 | 0-1, higher = fewer false positives |
| Stream Port | 8081 | Where the MJPEG stream lives |
| Auto-start | Off | Start camera automatically with server |

### Display Settings

| Setting | Options |
|---------|---------|
| Clock Format | 12-hour or 24-hour |
| Date Format | DMY, MDY, or YMD |
| Temperature | Celsius or Fahrenheit |
| Show Todos | Display on home screen |
| Show Events | Display on home screen |

### Background Options

- **Search** — Search Pexels for wallpapers by keyword
- **Upload** — Upload your own image (max 10MB)
- **Presets** — Space, Nature, Gradient, or None
- **Refresh** — How often to change the background (in minutes)
- **Effects** — Blur and dim sliders

---

## Project Structure

```
aze-dashboard/
├── server.js                     # Main Node.js server
├── camera_detection.py           # Python camera + object detection
├── MobileNetSSD_deploy.caffemodel  # Neural network weights
├── MobileNetSSD_deploy.prototxt    # Neural network config
├── settings.json                 # Your saved settings (auto-created)
├── package.json                  # Node dependencies
├── requirements.txt              # Python dependencies  
├── LICENSE                       # MIT license
├── README.md                     # You're reading it
└── public/
    ├── index.html                # Dashboard page
    ├── script.js                 # Dashboard logic
    ├── control.html              # Control panel page
    ├── control.js                # Control panel logic
    ├── styles/
    │   ├── style.css             # Dashboard styles
    │   └── control.css           # Control panel styles
    ├── css/                      # Font Awesome
    ├── fonts/                    # Custom fonts
    ├── webfonts/                 # Web fonts
    └── uploads/                  # Your uploaded backgrounds
```

---

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/todos` | Get all todos |
| POST | `/todos` | Add a todo |
| PATCH | `/todos/:index` | Update todo (done status) |
| DELETE | `/todos/:index` | Delete a todo |
| GET | `/events` | Get all events |
| POST | `/events` | Add an event |
| DELETE | `/events/:index` | Delete an event |
| GET | `/news-feeds` | Get RSS feeds |
| POST | `/news-feeds` | Add a feed |
| DELETE | `/news-feeds/:index` | Remove a feed |
| GET | `/news-items` | Get parsed news items |
| GET | `/current-message` | Get displayed message |
| POST | `/current-message` | Set message |
| DELETE | `/current-message` | Clear message |
| GET | `/countdown` | Get countdown data |
| POST | `/countdown` | Set countdown |
| DELETE | `/countdown` | Clear countdown |
| GET | `/screen-config` | Get screen settings |
| POST | `/screen-config` | Update screen settings |
| GET | `/camera-settings` | Get camera config |
| POST | `/camera-settings` | Update camera config |
| POST | `/camera/start` | Start camera |
| POST | `/camera/stop` | Stop camera |
| GET | `/camera/status` | Camera status |
| POST | `/upload-background` | Upload image |
| POST | `/set-background` | Set preset background |
| GET | `/search-background` | Search Pexels |

### Socket.IO Events

| Event | Direction | Data |
|-------|-----------|------|
| `todos` | Server → Client | Array of todos |
| `screenConfig` | Both | Screen settings object |
| `background` | Server → Client | Background URL/preset |
| `countdown` | Both | Countdown data |
| `currentMessage` | Both | Message string |
| `cameraSettings` | Both | Camera config |
| `refresh` | Client → Server | Trigger reload |
| `reload` | Server → Client | Reload the page |
| `brightness` | Both | Display brightness |
| `celebration` | Both | Show celebration animation |

---

## Troubleshooting

### Dashboard won't load

1. Check the server is running: `pm2 status`
2. Check port 4000 isn't in use: `sudo lsof -i :4000`
3. Check the logs: `pm2 logs aze-dashboard`

### Camera not working

1. Is the camera enabled? `vcgencmd get_camera`
2. Test it directly: `rpicam-hello` or `raspistill -o test.jpg`
3. Is picamera2 installed? `pip3 show picamera2`
4. Check camera port: `sudo lsof -i :8081`

### Object detection is slow

This is expected on older Pis. Try:
- Lower the resolution to 320x240
- Detection only runs every 10th frame by default
- Use a Pi 4 or 5 for better performance

### Weather not showing

The weather uses Open-Meteo's geocoding API. Make sure:
- You've set a location in Settings
- The location name is spelled correctly
- Your Pi has internet access

### Changes not saving

Settings auto-save every 60 seconds and on changes. Check:
- The `settings.json` file exists and is writable
- No disk space issues
- Check logs for write errors

---

## Remote Browser Refresh

Need to refresh the browser from SSH?

```bash
export DISPLAY=:0
xdotool search --onlyvisible --class chromium windowactivate key F5
```

Or send a refresh command through the control panel — it emits a Socket.IO event that reloads all connected displays.

---

## PM2 Commands

```bash
pm2 status                  # See running processes
pm2 logs aze-dashboard      # View logs
pm2 restart aze-dashboard   # Restart
pm2 stop aze-dashboard      # Stop
pm2 delete aze-dashboard    # Remove from PM2
pm2 startup                 # Enable start on boot
pm2 save                    # Save current processes
```

---

## Contributing

Found a bug? Want to add a feature? PRs welcome.

1. Fork the repo
2. Create a branch: `git checkout -b feature/cool-thing`
3. Make your changes
4. Test them
5. Commit: `git commit -m "Add cool thing"`
6. Push: `git push origin feature/cool-thing`
7. Open a PR

---

## License

MIT — do whatever you want with it. See [LICENSE](LICENSE) for the legal stuff.

---

## Author

Built by **Prahaas**

GitHub: [@DexterzExecutable](https://github.com/DexterzExecutable)

---

*Made for Raspberry Pi enthusiasts who want their dashboards to actually look good.*
