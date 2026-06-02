require('dotenv').config();
const path = require('path'); 
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { exec, spawn } = require("child_process");
const chokidar = require("chokidar");
const Parser = require('rss-parser');
const rssParser = new Parser();
const multer = require('multer');
const fs = require('fs');

// Environment variables
const PORT = process.env.PORT || 4000;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const CAMERA_STREAM_PORT = process.env.CAMERA_STREAM_PORT || 8081;

// Settings file path for persistence
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// Default settings structure
const defaultSettings = {
    todos: [],
    events: [],
    newsFeeds: [],
    currentMessage: null,
    countdownData: null,
    currentBackground: 'gradient',
    screenConfig: {
        screens: { home: true, weather: false, news: false, stats: false, messages: false, countdown: false, timer: false, todo: false, events: false },
        cycleDuration: 5,
        clickToSwitch: true,
        screenOrder: ['home', 'weather', 'news', 'stats', 'messages', 'countdown', 'timer', 'todo', 'events']
    },
    timerState: { mode: 'stopwatch', time: 0, running: false, pomodoroMode: 'work', pomodoroWork: 1500, pomodoroBreak: 300 },
    displaySettings: { clockFormat: '12', dateFormat: 'DMY', tempUnit: 'C', showTodos: false, showEvents: false },
    extraSettings: { greetingName: '', weatherLocation: '', backgroundQuery: 'nature', backgroundRefreshInterval: 60, accentColor: '#4285f4', fontFamily: 'Orbitron', backgroundBlur: 0, backgroundDim: 0 },
    notificationSettings: { celebrationEnabled: true, celebrationDuration: 5, soundEnabled: false },
    newsSettings: { headlineCount: 6, scrollSpeed: 10, fontSize: 'large', textAlign: 'left', opacity: 90, showSource: true, showIndicator: true, showAnimation: false },
    customPresets: []
};

// Deep merge helper for nested objects
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

// Load settings from file
function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            const saved = JSON.parse(data);
            // Deep merge with defaults to ensure all fields exist (including nested like screenConfig.screens.camera)
            return deepMerge(defaultSettings, saved);
        }
    } catch (e) {
        console.error('Error loading settings:', e);
    }
    return { ...defaultSettings };
}

// Save settings to file
function saveSettings() {
    try {
        const data = {
            todos,
            events,
            newsFeeds,
            currentMessage,
            countdownData,
            currentBackground,
            screenConfig,
            timerState,
            displaySettings,
            extraSettings,
            notificationSettings,
            newsSettings,
            cameraSettings,
            customPresets
        };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
        console.log('Settings saved to', SETTINGS_FILE);
    } catch (e) {
        console.error('Error saving settings:', e);
    }
}

// Auto-save settings periodically
setInterval(saveSettings, 60000); // Save every minute

// Camera process management
let cameraProcess = null;

// Configure multer for background uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'background-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimeType);
        if (extname || mimetype) {
            return cb(null, true);
        } else {
            cb('Error: Images only!');
        }
    }
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

// Load persisted settings
const loadedSettings = loadSettings();
let todos = loadedSettings.todos || [];
let events = loadedSettings.events || [];
let newsFeeds = loadedSettings.newsFeeds || [];
let newsItems = [];
let currentMessage = loadedSettings.currentMessage || null;
let countdownData = loadedSettings.countdownData || null;
let currentBackground = loadedSettings.currentBackground || 'gradient';
let screenConfig = loadedSettings.screenConfig || defaultSettings.screenConfig;
let timerState = loadedSettings.timerState || defaultSettings.timerState;
let displaySettings = loadedSettings.displaySettings || defaultSettings.displaySettings;
let extraSettings = loadedSettings.extraSettings || defaultSettings.extraSettings;
let notificationSettings = loadedSettings.notificationSettings || defaultSettings.notificationSettings;
let newsSettings = loadedSettings.newsSettings || defaultSettings.newsSettings;
let customPresets = loadedSettings.customPresets || [];

console.log('Settings loaded from', SETTINGS_FILE);

function startCameraProcess() {
    if (cameraProcess) {
        console.log('Camera process already running');
        return;
    }
    
    const pythonScript = path.join(__dirname, 'camera_detection.py');
    if (!fs.existsSync(pythonScript)) {
        console.log('Camera detection script not found');
        return;
    }
    
    const res = cameraSettings.resolution.split('x');
    const args = [
        pythonScript,
        '--port', cameraSettings.streamPort.toString(),
        '--width', res[0],
        '--height', res[1],
        '--fps', cameraSettings.fps.toString(),
        '--settings-file', SETTINGS_FILE
    ];
    
    if (!cameraSettings.objectDetection) {
        args.push('--no-detection');
    }
    
    console.log('Starting camera process:', 'python3', args.join(' '));
    cameraProcess = spawn('python3', args, { cwd: __dirname });
    
    cameraProcess.stdout.on('data', (data) => {
        console.log(`Camera: ${data}`);
    });
    
    cameraProcess.stderr.on('data', (data) => {
        console.error(`Camera Error: ${data}`);
    });
    
    cameraProcess.on('close', (code) => {
        console.log(`Camera process exited with code ${code}`);
        cameraProcess = null;
    });
}

function stopCameraProcess() {
    return new Promise((resolve) => {
        if (cameraProcess) {
            console.log('Stopping camera process...');
            
            // Kill the process tree (SIGKILL for force)
            cameraProcess.kill('SIGKILL');
            cameraProcess = null;
            
            // Also kill any process on the camera port
            exec(`fuser -k ${cameraSettings.streamPort}/tcp`, (err) => {
                if (err) {
                    console.log('No process on port to kill');
                }
                console.log('Camera process stopped');
                // Wait for camera resource to be released
                setTimeout(resolve, 1000);
            });
        } else {
            // Still try to free the port even if we don't have a reference
            exec(`fuser -k ${cameraSettings.streamPort}/tcp`, () => {
                setTimeout(resolve, 500);
            });
        }
    });
}

// --- TODOS API & ADD-TODO PAGE ---
app.get('/add-todo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'todo.html'));
});
app.get('/todos', (req, res) => {
    res.json(todos);
});
app.post('/todos', (req, res) => {
    const { todo } = req.body;
    if (todo && typeof todo === 'string') {
        todos.push({ text: todo, done: false, createdAt: new Date().toISOString() });
        io.emit('todos', todos);
        saveSettings();
        res.status(201).json({ success: true, todos });
    } else {
        res.status(400).json({ success: false, error: 'Invalid todo' });
    }
});
app.patch('/todos/:index', (req, res) => {
    const idx = parseInt(req.params.index, 10);
    if (!isNaN(idx) && idx >= 0 && idx < todos.length) {
        if (req.body.done !== undefined) {
            todos[idx].done = req.body.done;
        }
        io.emit('todos', todos);
        saveSettings();
        res.json({ success: true, todos });
    } else {
        res.status(400).json({ success: false, error: 'Invalid index' });
    }
});
app.delete('/todos/:index', (req, res) => {
    const idx = parseInt(req.params.index, 10);
    if (!isNaN(idx) && idx >= 0 && idx < todos.length) {
        todos.splice(idx, 1);
        io.emit('todos', todos);
        saveSettings();
        res.json({ success: true, todos });
    } else {
        res.status(400).json({ success: false, error: 'Invalid index' });
    }
});

// --- EVENTS API ---
app.get('/events', (req, res) => {
    res.json(events);
});
app.post('/events', (req, res) => {
    const { title, date, time } = req.body;
    if (title && date && time) {
        events.push({ title, date, time });
        saveSettings();
        res.status(201).json({ success: true, events });
    } else {
        res.status(400).json({ success: false, error: 'Invalid event' });
    }
});
app.delete('/events/:index', (req, res) => {
    const idx = parseInt(req.params.index, 10);
    if (!isNaN(idx) && idx >= 0 && idx < events.length) {
        events.splice(idx, 1);
        saveSettings();
        res.json({ success: true, events });
    } else {
        res.status(400).json({ success: false, error: 'Invalid index' });
    }
});

// --- CALENDAR PAGE ROUTE ---
app.get('/calendar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'calendar.html'));
});

// --- MASTER CONTROL ROUTE ---
app.get('/master', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'master.html'));
});

// --- NEWS FEED ROUTES ---
app.get('/news', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'news.html'));
});

app.get('/news-feeds', (req, res) => {
    res.json(newsFeeds);
});

app.post('/news-feeds', async (req, res) => {
    const { name, url } = req.body;
    if (name && url) {
        newsFeeds.push({ name, url });
        await updateNewsItems();
        io.emit('newsFeeds', newsFeeds);
        saveSettings();
        res.status(201).json({ success: true, newsFeeds });
    } else {
        res.status(400).json({ success: false, error: 'Invalid feed' });
    }
});

app.delete('/news-feeds/:index', async (req, res) => {
    const idx = parseInt(req.params.index, 10);
    if (!isNaN(idx) && idx >= 0 && idx < newsFeeds.length) {
        newsFeeds.splice(idx, 1);
        await updateNewsItems();
        io.emit('newsFeeds', newsFeeds);
        saveSettings();
        res.json({ success: true, newsFeeds });
    } else {
        res.status(400).json({ success: false, error: 'Invalid index' });
    }
});

app.get('/news-items', (req, res) => {
    res.json(newsItems);
});

// --- MESSAGE ROUTES ---
app.get('/messages', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'messages.html'));
});

app.get('/current-message', (req, res) => {
    res.json({ message: currentMessage });
});

app.post('/current-message', (req, res) => {
    const { message } = req.body;
    if (message && typeof message === 'string') {
        currentMessage = message;
        io.emit('currentMessage', { message: currentMessage });
        saveSettings();
        res.status(201).json({ success: true, message: currentMessage });
    } else {
        res.status(400).json({ success: false, error: 'Invalid message' });
    }
});

app.delete('/current-message', (req, res) => {
    currentMessage = null;
    io.emit('currentMessage', { message: null });
    saveSettings();
    res.json({ success: true });
});

// --- SCREEN CONFIG ROUTES ---
app.get('/screen-config', (req, res) => {
    res.json(screenConfig);
});

app.post('/screen-config', (req, res) => {
    const { screens, cycleDuration, clickToSwitch, screenOrder } = req.body;
    if (screens) {
        screenConfig.screens = screens;
    }
    if (cycleDuration !== undefined) {
        screenConfig.cycleDuration = cycleDuration;
    }
    if (clickToSwitch !== undefined) {
        screenConfig.clickToSwitch = clickToSwitch;
    }
    if (screenOrder) {
        screenConfig.screenOrder = screenOrder;
    }
    io.emit('screenConfig', screenConfig);
    saveSettings();
    res.json({ success: true, screenConfig });
});

// --- COUNTDOWN ROUTES ---
app.get('/countdown', (req, res) => {
    res.json(countdownData || {});
});

app.post('/countdown', (req, res) => {
    const { name, date, time } = req.body;
    if (name && date) {
        countdownData = { name, date, time: time || '00:00' };
        io.emit('countdown', countdownData);
        saveSettings();
        res.status(201).json({ success: true, countdownData });
    } else {
        res.status(400).json({ success: false, error: 'Invalid countdown data' });
    }
});

app.delete('/countdown', (req, res) => {
    countdownData = null;
    io.emit('countdown', null);
    saveSettings();
    res.json({ success: true });
});

// --- BACKGROUND ROUTES ---
app.get('/current-background', (req, res) => {
    res.json({ background: currentBackground });
});

app.post('/upload-background', upload.single('background'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    currentBackground = `/uploads/${req.file.filename}`;
    io.emit('background', { background: currentBackground });
    saveSettings();
    res.json({ success: true, background: currentBackground });
});

app.post('/set-background', (req, res) => {
    const { preset } = req.body;
    if (preset) {
        currentBackground = preset;
        io.emit('background', { background: currentBackground });
        saveSettings();
        res.json({ success: true, background: currentBackground });
    } else {
        res.status(400).json({ success: false, error: 'Invalid preset' });
    }
});

// --- TIMER STATE ROUTES ---
app.get('/timer-state', (req, res) => {
    res.json(timerState);
});

app.post('/timer-state', (req, res) => {
    const { mode, time, running, pomodoroMode, pomodoroWork, pomodoroBreak } = req.body;
    if (mode) timerState.mode = mode;
    if (time !== undefined) timerState.time = time;
    if (running !== undefined) timerState.running = running;
    if (pomodoroMode) timerState.pomodoroMode = pomodoroMode;
    if (pomodoroWork) timerState.pomodoroWork = pomodoroWork;
    if (pomodoroBreak) timerState.pomodoroBreak = pomodoroBreak;
    io.emit('timerState', timerState);
    res.json({ success: true, timerState });
});

// --- DISPLAY SETTINGS ROUTES ---
app.get('/display-settings', (req, res) => {
    res.json(displaySettings);
});

app.post('/display-settings', (req, res) => {
    const { clockFormat, dateFormat, tempUnit, showTodos, showEvents } = req.body;
    if (clockFormat) displaySettings.clockFormat = clockFormat;
    if (dateFormat) displaySettings.dateFormat = dateFormat;
    if (tempUnit) displaySettings.tempUnit = tempUnit;
    if (showTodos !== undefined) displaySettings.showTodos = showTodos;
    if (showEvents !== undefined) displaySettings.showEvents = showEvents;
    io.emit('displaySettings', displaySettings);
    saveSettings();
    res.json({ success: true, displaySettings });
});

// --- EXTRA SETTINGS ROUTES ---
app.get('/extra-settings', (req, res) => {
    res.json(extraSettings);
});

app.post('/extra-settings', (req, res) => {
    const { greetingName, weatherLocation, backgroundQuery, backgroundRefreshInterval, accentColor, fontFamily, backgroundBlur, backgroundDim } = req.body;
    if (greetingName !== undefined) extraSettings.greetingName = greetingName;
    if (weatherLocation !== undefined) extraSettings.weatherLocation = weatherLocation;
    if (backgroundQuery !== undefined) extraSettings.backgroundQuery = backgroundQuery;
    if (backgroundRefreshInterval !== undefined) extraSettings.backgroundRefreshInterval = backgroundRefreshInterval;
    if (accentColor !== undefined) extraSettings.accentColor = accentColor;
    if (fontFamily !== undefined) extraSettings.fontFamily = fontFamily;
    if (backgroundBlur !== undefined) extraSettings.backgroundBlur = backgroundBlur;
    if (backgroundDim !== undefined) extraSettings.backgroundDim = backgroundDim;
    io.emit('extraSettings', extraSettings);
    saveSettings();
    res.json({ success: true, extraSettings });
});

// --- NOTIFICATION SETTINGS ROUTES ---
app.get('/notification-settings', (req, res) => {
    res.json(notificationSettings);
});

app.post('/notification-settings', (req, res) => {
    const { celebrationEnabled, celebrationDuration, soundEnabled } = req.body;
    if (celebrationEnabled !== undefined) notificationSettings.celebrationEnabled = celebrationEnabled;
    if (celebrationDuration !== undefined) notificationSettings.celebrationDuration = celebrationDuration;
    if (soundEnabled !== undefined) notificationSettings.soundEnabled = soundEnabled;
    io.emit('notificationSettings', notificationSettings);
    saveSettings();
    res.json({ success: true, notificationSettings });
});

// --- NEWS SETTINGS ROUTES ---
app.get('/news-settings', (req, res) => {
    res.json(newsSettings);
});

app.post('/news-settings', (req, res) => {
    const { headlineCount, scrollSpeed, fontSize, textAlign, opacity, showSource, showIndicator, showAnimation } = req.body;
    if (headlineCount !== undefined) newsSettings.headlineCount = headlineCount;
    if (scrollSpeed !== undefined) newsSettings.scrollSpeed = scrollSpeed;
    if (fontSize) newsSettings.fontSize = fontSize;
    if (textAlign) newsSettings.textAlign = textAlign;
    if (opacity !== undefined) newsSettings.opacity = opacity;
    if (showSource !== undefined) newsSettings.showSource = showSource;
    if (showIndicator !== undefined) newsSettings.showIndicator = showIndicator;
    if (showAnimation !== undefined) newsSettings.showAnimation = showAnimation;
    io.emit('newsSettings', newsSettings);
    saveSettings();
    res.json({ success: true, newsSettings });
});

// --- CAMERA SETTINGS ROUTES ---
app.get('/camera-settings', (req, res) => {
    res.json(cameraSettings);
});

app.post('/camera-settings', (req, res) => {
    const { enabled, resolution, fps, rotation, objectDetection, detectionModel, 
            confidenceThreshold, showLabels, showFps, flipHorizontal, flipVertical,
            brightness, contrast, autoStart, streamPort } = req.body;
    
    if (enabled !== undefined) cameraSettings.enabled = enabled;
    if (resolution) cameraSettings.resolution = resolution;
    if (fps !== undefined) cameraSettings.fps = fps;
    if (rotation !== undefined) cameraSettings.rotation = rotation;
    if (objectDetection !== undefined) cameraSettings.objectDetection = objectDetection;
    if (detectionModel) cameraSettings.detectionModel = detectionModel;
    if (confidenceThreshold !== undefined) cameraSettings.confidenceThreshold = confidenceThreshold;
    if (showLabels !== undefined) cameraSettings.showLabels = showLabels;
    if (showFps !== undefined) cameraSettings.showFps = showFps;
    if (flipHorizontal !== undefined) cameraSettings.flipHorizontal = flipHorizontal;
    if (flipVertical !== undefined) cameraSettings.flipVertical = flipVertical;
    if (brightness !== undefined) cameraSettings.brightness = brightness;
    if (contrast !== undefined) cameraSettings.contrast = contrast;
    if (autoStart !== undefined) cameraSettings.autoStart = autoStart;
    if (streamPort !== undefined) cameraSettings.streamPort = streamPort;
    
    // Save settings to file
    saveSettings();
    
    io.emit('cameraSettings', cameraSettings);
    res.json({ success: true, cameraSettings });
});

// Camera control endpoints
app.post('/camera/start', async (req, res) => {
    // First stop any existing process
    await stopCameraProcess();
    // Then start fresh
    startCameraProcess();
    res.json({ success: true, message: 'Camera started' });
});

app.post('/camera/stop', async (req, res) => {
    await stopCameraProcess();
    res.json({ success: true, message: 'Camera stopped' });
});

app.get('/camera/status', (req, res) => {
    res.json({
        running: cameraProcess !== null,
        settings: cameraSettings,
        streamUrl: `http://localhost:${cameraSettings.streamPort}/stream.mjpg`
    });
});

// Proxy camera stream for CORS
app.get('/camera/stream', (req, res) => {
    if (!cameraProcess) {
        return res.status(503).json({ error: 'Camera not running' });
    }
    
    res.redirect(`http://localhost:${cameraSettings.streamPort}/stream.mjpg`);
});

app.get('/camera/snapshot', (req, res) => {
    if (!cameraProcess) {
        return res.status(503).json({ error: 'Camera not running' });
    }
    
    res.redirect(`http://localhost:${cameraSettings.streamPort}/snapshot.jpg`);
});

// --- PRESET ROUTES ---
app.post('/apply-preset', (req, res) => {
    const { preset } = req.body;
    
    // Check if it's a custom preset
    if (preset.startsWith('custom_')) {
        const index = parseInt(preset.replace('custom_', ''));
        if (!isNaN(index) && index >= 0 && index < customPresets.length) {
            const customConfig = customPresets[index].config;
            
            // Apply custom configuration
            if (customConfig.screens) {
                screenConfig.screens = customConfig.screens;
                screenConfig.cycleDuration = customConfig.cycleDuration;
            }
            if (customConfig.notificationSettings) {
                Object.assign(notificationSettings, customConfig.notificationSettings);
            }
            if (customConfig.newsSettings) {
                Object.assign(newsSettings, customConfig.newsSettings);
            }
            
            // Broadcast updates
            io.emit('screenConfig', screenConfig);
            io.emit('notificationSettings', notificationSettings);
            io.emit('newsSettings', newsSettings);
            
            return res.json({ success: true, preset: 'custom_' + index });
        } else {
            return res.status(400).json({ success: false, error: 'Custom preset not found' });
        }
    }
    
    // Built-in presets
    const presets = {
        productivity: {
            screens: { home: true, timer: true, weather: false, news: false, stats: false, messages: false, countdown: false },
            cycleDuration: 15,
            pomodoroWork: 25,
            pomodoroBreak: 5,
            celebrationEnabled: true
        },
        news: {
            screens: { home: false, timer: false, weather: true, news: true, stats: false, messages: false, countdown: false },
            cycleDuration: 15,
            newsHeadlineCount: 20
        },
        fitness: {
            screens: { home: true, timer: true, weather: false, news: false, stats: false, messages: false, countdown: false },
            cycleDuration: 10,
            celebrationEnabled: true,
            soundEnabled: true
        },
        minimal: {
            screens: { home: true, timer: false, weather: false, news: false, stats: false, messages: false, countdown: false },
            cycleDuration: 10,
            celebrationEnabled: false
        },
        showcase: {
            screens: { home: true, timer: true, weather: true, news: true, stats: true, messages: true, countdown: true },
            cycleDuration: 10,
            celebrationEnabled: true
        },
        night: {
            screens: { home: true, timer: false, weather: false, news: false, stats: false, messages: false, countdown: false },
            cycleDuration: 10,
            celebrationEnabled: false,
            soundEnabled: false,
            brightness: 50
        }
    };
    
    if (presets[preset]) {
        const config = presets[preset];
        
        // Apply screen config
        if (config.screens) {
            screenConfig.screens = config.screens;
            screenConfig.cycleDuration = config.cycleDuration;
        }
        
        // Apply notification settings
        if (config.celebrationEnabled !== undefined) {
            notificationSettings.celebrationEnabled = config.celebrationEnabled;
        }
        if (config.soundEnabled !== undefined) {
            notificationSettings.soundEnabled = config.soundEnabled;
        }
        
        // Apply news settings
        if (config.newsHeadlineCount !== undefined) {
            newsSettings.headlineCount = config.newsHeadlineCount;
        }
        if (config.newsDisplayMode) {
            newsSettings.displayMode = config.newsDisplayMode;
        }
        
        // Apply brightness for night mode
        if (config.brightness !== undefined) {
            io.emit('brightness', { value: config.brightness / 100 });
        }
        
        // Broadcast updates
        io.emit('screenConfig', screenConfig);
        io.emit('notificationSettings', notificationSettings);
        io.emit('newsSettings', newsSettings);
        
        res.json({ success: true, preset });
    } else {
        res.status(400).json({ success: false, error: 'Invalid preset' });
    }
});

// --- CUSTOM PRESETS ROUTES ---
app.get('/custom-presets', (req, res) => {
    res.json(customPresets);
});

app.post('/save-custom-preset', (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, error: 'Name required' });
    }
    
    customPresets.push({
        name,
        config: {
            screens: screenConfig.screens,
            cycleDuration: screenConfig.cycleDuration,
            notificationSettings,
            newsSettings
        }
    });
    
    saveSettings();
    res.json({ success: true });
});

app.delete('/custom-presets/:index', (req, res) => {
    const idx = parseInt(req.params.index, 10);
    if (!isNaN(idx) && idx >= 0 && idx < customPresets.length) {
        customPresets.splice(idx, 1);
        saveSettings();
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, error: 'Invalid index' });
    }
});

// --- BACKGROUND SEARCH ROUTE (Pexels API) ---
app.get('/search-background', async (req, res) => {
    const { keyword, page = 1 } = req.query;
    if (!keyword) {
        return res.status(400).json({ photos: [], total_results: 0, error: 'No keyword provided' });
    }
    
    const https = require('https');
    const perPage = 20; // Show 20 images per page
    
    // Check if Pexels API key is configured
    if (!PEXELS_API_KEY) {
        return res.status(500).json({ 
            photos: [], 
            total_results: 0, 
            error: 'Pexels API key not configured. Add PEXELS_API_KEY to your .env file.' 
        });
    }
    
    console.log(`Searching Pexels for: "${keyword}" (page ${page})`);
    
    const options = {
        hostname: 'api.pexels.com',
        path: `/v1/search?query=${encodeURIComponent(keyword)}&per_page=${perPage}&page=${page}&orientation=landscape`,
        method: 'GET',
        headers: {
            'Authorization': PEXELS_API_KEY,
            'User-Agent': 'AzeDashboard/1.0'
        }
    };
    
    const apiRequest = https.get(options, (apiRes) => {
        let data = '';
        
        console.log(`Pexels API Status: ${apiRes.statusCode}`);
        
        apiRes.on('data', (chunk) => {
            data += chunk;
        });
        
        apiRes.on('end', () => {
            try {
                const result = JSON.parse(data);
                
                console.log(`Pexels returned ${result.photos ? result.photos.length : 0} photos`);
                
                if (result.error) {
                    console.error('Pexels API Error:', result.error);
                    return res.json({ 
                        photos: [], 
                        total_results: 0, 
                        error: result.error 
                    });
                }
                
                if (result.photos && result.photos.length > 0) {
                    // Extract large landscape images with all necessary data
                    const images = result.photos.map(photo => ({
                        url: photo.src.large2x || photo.src.large || photo.src.original,
                        thumb: photo.src.medium || photo.src.small,
                        photographer: photo.photographer || 'Unknown',
                        id: photo.id
                    }));
                    
                    res.json({
                        photos: images,
                        total_results: result.total_results || result.photos.length,
                        page: parseInt(page),
                        per_page: perPage,
                        keyword: keyword
                    });
                } else {
                    // No results found
                    res.json({
                        photos: [],
                        total_results: 0,
                        page: 1,
                        per_page: perPage,
                        message: `No images found for "${keyword}". Try different keywords.`
                    });
                }
            } catch (e) {
                console.error('Pexels API parse error:', e);
                console.error('Raw data:', data);
                res.json({ 
                    photos: [], 
                    total_results: 0, 
                    error: 'Failed to parse API response',
                    raw_error: e.message 
                });
            }
        });
    });
    
    apiRequest.on('error', (error) => {
        console.error('Pexels API request error:', error);
        res.json({ 
            photos: [], 
            total_results: 0, 
            error: 'Network error: ' + error.message 
        });
    });
    
    apiRequest.end();
});

// --- MASTER CONTROL ROUTE ---
app.get('/control', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'control.html'));
});

// --- Screen control via HTTP routes ---
app.post('/dim', (req, res) => {
    io.emit("screen", { action: "dim" });
    res.json({ success: true });
});
app.post('/wake', (req, res) => {
    io.emit("screen", { action: "wake" });
    res.json({ success: true });
});

// --- Socket.IO ---
io.on("connection", (socket) => {
    console.log("Client connected");

    socket.emit("todos", todos);
    socket.emit("background", { background: currentBackground });

    // Listen for screen events from any client
 socket.on("brightness", (data) => {
    // data.value should be between 0 (bright) and 1 (fully dimmed)
    socket.broadcast.emit("brightness", data);
});
// Inside io.on("connection", socket)
socket.on("screensaver", (data) => {
    // data.active = true/false
    socket.broadcast.emit("screensaver", { active: data.active });
});

socket.on("backgroundQuery", (data) => {
    // data.query = search query string
    socket.broadcast.emit("backgroundQuery", { query: data.query });
});

socket.on("celebration", (data) => {
    // Broadcast celebration to all displays
    io.emit("celebration", { title: data.title, message: data.message });
});

socket.on("refresh", () => {
    // Broadcast refresh to all displays
    io.emit("reload");
});

// CPU monitoring (basic)
let lastCPUInfo = null;
setInterval(() => {
    exec("top -bn1 | grep 'Cpu(s)'", (err, stdout) => {
        if (!err && stdout) {
            const match = stdout.match(/(\d+\.\d+)\s*id/);
            if (match) {
                const idle = parseFloat(match[1]);
                const usage = (100 - idle).toFixed(1);
                io.emit("cpu", usage);
            }
        }
    });
}, 5000);


    setInterval(() => {
        exec("vcgencmd measure_temp", (err, stdout) => {
            if (!err) {
                const temp = stdout.match(/[\d\.]+/)[0];
                socket.emit("temp", temp);
            }
        });

        exec("free -m", (err, stdout) => {
            if (!err) {
                const lines = stdout.split("\n");
                const mem = lines[1].split(/\s+/);
                socket.emit("ram", {
                    used: mem[2],
                    total: mem[1]
                });
            }
        });
        exec("top -bn1 | grep 'Cpu(s)'", (err, stdout) => {
            if (!err) {
                const cpuLine = stdout;
                const usage = cpuLine.match(/(\d+\.\d+)\s*id/);
                if (usage) {
                    const cpuUsage = (100 - parseFloat(usage[1])).toFixed(1);
                    socket.emit("cpu", cpuUsage);
                }
            }
        });

    }, 2000);
});

// RSS Feed updater
async function updateNewsItems() {
    newsItems = [];
    const seenLinks = new Set(); // Track seen article links to avoid duplicates
    
    for (const feed of newsFeeds) {
        try {
            const parsed = await rssParser.parseURL(feed.url);
            const items = parsed.items.slice(0, 10).map(item => ({
                title: item.title,
                source: feed.name,
                link: item.link,
                pubDate: item.pubDate
            }));
            
            // Only add items we haven't seen before (by link)
            for (const item of items) {
                if (item.link && !seenLinks.has(item.link)) {
                    newsItems.push(item);
                    seenLinks.add(item.link);
                } else if (!item.link && !newsItems.some(ni => ni.title === item.title)) {
                    // Fallback to title deduplication if link is missing
                    newsItems.push(item);
                }
            }
        } catch (e) {
            console.error(`Failed to fetch RSS feed: ${feed.name}`, e.message);
        }
    }
    
    // Sort by date and limit to reasonable number
    newsItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    newsItems = newsItems.slice(0, 50); // Limit to 50 unique articles
    io.emit('newsItems', newsItems);
}

// Update news every 10 minutes
setInterval(updateNewsItems, 10 * 60 * 1000);

// Hot reload watcher
chokidar.watch("public").on("change", () => {
    console.log("Files changed → Reloading");
    io.emit("reload");
});

server.listen(PORT, () => {
    console.log(`Aze Dashboard running on http://localhost:${PORT}`);
    if (!PEXELS_API_KEY) {
        console.log('Warning: PEXELS_API_KEY not set. Background search will not work.');
        console.log('Get a free API key at: https://www.pexels.com/api/');
    }
});