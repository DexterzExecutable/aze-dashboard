
let displaySettings = { clockFormat: '12', dateFormat: 'MDY', tempUnit: 'C', showTodos: true, showEvents: true };

// ===== SPLASH SCREEN =====
(function initSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;

    const statusEl = splash.querySelector('.splash-status');
    const messages = [
        'Initializing...',
        'Booting resources...',
        'Loading modules...',
        'Setting up dashboard...',
        'Almost ready...'
    ];
    let msgIndex = 0;
    const randomDelay = Math.floor(Math.random() * 3000) + 500; // 500ms to 1500ms
    const statusInterval = setInterval(() => {
        msgIndex++;
        if (msgIndex < messages.length && statusEl) {
            statusEl.textContent = messages[msgIndex];
        }
    }, randomDelay);

    setTimeout(() => {
        clearInterval(statusInterval);
        splash.classList.add('fade-out');
        setTimeout(() => {
            splash.classList.add('hidden');
        }, 800);
    }, 5000);
})();
// ===== END SPLASH SCREEN =====

const upcomingEventBox = document.getElementById('upcoming-event-box');
const upcomingEventText = document.getElementById('upcoming-event-text');

async function fetchAndShowUpcomingEvent() {
    if (!upcomingEventBox || !upcomingEventText) return;
    // Check if showEvents is disabled in display settings
    if (displaySettings.showEvents === false) {
        upcomingEventBox.style.display = 'none';
        return;
    }
    try {
        const res = await fetch('/events');
        const events = await res.json();

        if (events.length) {
            events.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
            const now = new Date();
            const next = events.find(ev => new Date(ev.date + 'T' + ev.time) > now);

            if (next) {
                const dateObj = new Date(next.date);
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');

                upcomingEventText.textContent = `${next.title} — ${day}/${month}`;
                upcomingEventBox.style.display = 'block';
            } else {
                upcomingEventBox.style.display = 'none';
            }
        } else {
            upcomingEventBox.style.display = 'none';
        }
    } catch (e) {
        upcomingEventBox.style.display = 'none';
    }
}

// Don't call immediately - wait for loadDisplaySettings()
// fetchAndShowUpcomingEvent();
setInterval(fetchAndShowUpcomingEvent, 10000);


const multiTodoBox = document.getElementById('multi-todo-box');
const multiTodoList = document.getElementById('multi-todo-list');
async function fetchAndShowMultiTodos() {
    if (!multiTodoBox || !multiTodoList) return;
    // Check if showTodos is disabled in display settings
    if (displaySettings.showTodos === false) {
        multiTodoBox.style.display = 'none';
        return;
    }
    try {
        const res = await fetch('/todos');
        const todos = await res.json();
        if (todos.length) {
            multiTodoList.innerHTML = '';
            todos.slice(0, 5).forEach((todo, idx) => {
                const li = document.createElement('li');
                const span = document.createElement('span');
                span.textContent = todo.text || todo; 
                if (todo.done) li.classList.add('completed');

                // Toggle strike-through on click
                span.addEventListener('click', async () => {
                    await fetch(`/todos/${idx}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ done: !li.classList.contains('completed') })
                    });
                    fetchAndShowMultiTodos();
                });
                li.appendChild(span);
                multiTodoList.appendChild(li);
            });
            multiTodoBox.style.display = 'block';
        } else {
            multiTodoBox.style.display = 'none';
        }
    } catch (e) {
        multiTodoBox.style.display = 'none';
        console.error(e);
    }
}
// Don't call immediately - wait for loadDisplaySettings()
// fetchAndShowMultiTodos();
setInterval(fetchAndShowMultiTodos, 10000);




let backgroundQuery = 'nature';
let backgroundRefreshInterval = 60; // minutes
let bgRefreshTimer = null;

async function updateBackground() {
    try {
        const response = await fetch(`/search-background?keyword=${encodeURIComponent(backgroundQuery)}&page=1`);
        if (!response.ok) throw new Error('Background search error');
        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            const randomPhoto = data.photos[Math.floor(Math.random() * data.photos.length)];
            const url = randomPhoto.url;
            const img = new window.Image();
            img.onload = function() {
                document.body.style.backgroundImage = `url('${url}')`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';
                applyBgOverlay();
            };
            img.onerror = function(e) {
                console.error('Background image load error:', e);
            };
            img.src = url;
        }
    } catch (error) {
        console.error('Background image fetch error:', error);
    }
}

function applyBgOverlay() {
    let overlay = document.getElementById('bg-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'bg-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;transition:all 0.5s;';
        document.body.insertBefore(overlay, document.body.firstChild);
    }
    const dim = parseInt(window._bgDim || 0);
    const blur = parseInt(window._bgBlur || 0);
    overlay.style.background = dim > 0 ? `rgba(0,0,0,${dim/100})` : 'none';
    if (blur > 0) {
        document.body.style.backdropFilter = `blur(${blur}px)`;
    } else {
        document.body.style.backdropFilter = 'none';
    }
}

function scheduleBackgroundRefresh(intervalMinutes) {
    if (bgRefreshTimer) clearInterval(bgRefreshTimer);
    if (intervalMinutes > 0) {
        bgRefreshTimer = setInterval(updateBackground, intervalMinutes * 60 * 1000);
    }
}

// Load extra settings from server and apply them
async function loadAndApplyExtraSettings() {
    try {
        const res = await fetch('/extra-settings');
        const data = await res.json();
        if (data.backgroundQuery) backgroundQuery = data.backgroundQuery;
        if (data.backgroundRefreshInterval !== undefined) backgroundRefreshInterval = data.backgroundRefreshInterval;
        window._bgDim = data.backgroundDim || 0;
        window._bgBlur = data.backgroundBlur || 0;
        if (data.accentColor) {
            document.documentElement.style.setProperty('--accent', data.accentColor);
        }
        if (data.fontFamily) {
            document.documentElement.style.setProperty('--clock-font', data.fontFamily);
        }
        // Greeting name — stored globally so updateClock() picks it up
        window._greetingName = data.greetingName || '';
        // Weather location — geocode if set
        if (data.weatherLocation && data.weatherLocation.trim()) {
            await geocodeLocation(data.weatherLocation.trim());
            await fetchWeather(); // refresh immediately with new location
        }
    } catch (e) {
        console.error('Failed to load extra settings:', e);
    }
}

const socket = io();
socket.on("backgroundQuery", (data) => {
    if (data.query) {
        backgroundQuery = data.query;
        updateBackground();
    }
});

socket.on("extraSettings", async (data) => {
    if (data.backgroundQuery) backgroundQuery = data.backgroundQuery;
    if (data.backgroundRefreshInterval !== undefined) scheduleBackgroundRefresh(data.backgroundRefreshInterval);
    if (data.backgroundDim !== undefined) { window._bgDim = data.backgroundDim; applyBgOverlay(); }
    if (data.backgroundBlur !== undefined) { window._bgBlur = data.backgroundBlur; applyBgOverlay(); }
    if (data.accentColor) document.documentElement.style.setProperty('--accent', data.accentColor);
    if (data.fontFamily) document.documentElement.style.setProperty('--clock-font', data.fontFamily);
    if (data.greetingName !== undefined) window._greetingName = data.greetingName;
    if (data.weatherLocation && data.weatherLocation.trim()) {
        await geocodeLocation(data.weatherLocation.trim());
        await fetchWeather();
    }
});

socket.on("temp", (temp) => {
    const tempElem = document.getElementById("temp");
    if (tempElem) tempElem.textContent = temp;
});

socket.on("ram", (data) => {
    const ramElem = document.getElementById("ram");
    if (ramElem) ramElem.textContent = `${data.used}MB / ${data.total}MB`;
});


socket.on("reload", () => {
    location.reload();
});

const dimOverlay = document.getElementById("dimOverlay");

socket.on("screen", (data) => {
    if (data.action === "dim") {
        dimOverlay.style.opacity = 0.9;
    } else if (data.action === "wake") {
        dimOverlay.style.opacity = 0;
    }
});

socket.on("brightness", (data) => {
    dimOverlay.style.opacity = data.value;
});

async function setWeather() {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${weatherLat}&longitude=${weatherLon}&current_weather=true`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather API error');
        const data = await res.json();
        const weather = data.current_weather;
        let iconClass = 'fa-sun';
        if (weather.weathercode >= 80) iconClass = 'fa-cloud-showers-heavy'; // Rain
        else if (weather.weathercode >= 60) iconClass = 'fa-cloud-sun-rain'; // Showers
        else if (weather.weathercode >= 50) iconClass = 'fa-smog'; // Fog
        else if (weather.weathercode >= 40) iconClass = 'fa-cloud'; // Cloudy
        else if (weather.weathercode >= 30) iconClass = 'fa-cloud-sun'; // Partly cloudy
        else if (weather.weathercode >= 20) iconClass = 'fa-bolt'; // Thunder
        else if (weather.weathercode >= 10) iconClass = 'fa-sun'; // Clear

        document.getElementById('weather').innerHTML = `<i class="fa-solid ${iconClass}"></i> ${weather.temperature}&deg;C`;
    } catch (error) {
        document.getElementById('weather').textContent = 'Weather unavailable';
        console.error('Weather fetch error:', error);
    }
}

let latestWeather = null;
let latestRam = null;
let latestTemp = null;
let latestCpu = null;

// Weather coordinates — updated by loadAndApplyExtraSettings if location is set
let weatherLat = 12.8692;
let weatherLon = 77.8113;

async function geocodeLocation(locationName) {
    try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            weatherLat = data.results[0].latitude;
            weatherLon = data.results[0].longitude;
            console.log(`Weather location set to ${data.results[0].name} (${weatherLat}, ${weatherLon})`);
        }
    } catch (e) {
        console.error('Geocoding failed:', e);
    }
}

async function fetchWeather() {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${weatherLat}&longitude=${weatherLon}&current_weather=true`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather API error');
        const data = await res.json();
        const weather = data.current_weather;
        let iconClass = 'fa-sun';
        if (weather.weathercode >= 80) iconClass = 'fa-cloud-showers-heavy';
        else if (weather.weathercode >= 60) iconClass = 'fa-cloud-sun-rain';
        else if (weather.weathercode >= 50) iconClass = 'fa-smog';
        else if (weather.weathercode >= 40) iconClass = 'fa-cloud';
        else if (weather.weathercode >= 30) iconClass = 'fa-cloud-sun';
        else if (weather.weathercode >= 20) iconClass = 'fa-bolt';
        else if (weather.weathercode >= 10) iconClass = 'fa-sun';
        latestWeather = `<i class="fa-solid ${iconClass}"></i> ${weather.temperature}&deg;C`;
    } catch (error) {
        latestWeather = 'Weather unavailable';
        console.error('Weather fetch error:', error);
    }
}

// fetchWeather() is called after loadAndApplyExtraSettings() so location is correct
setInterval(fetchWeather, 10 * 60 * 1000);

// RAM, CPU, Temp handlers
socket.on("ram", (data) => {
    latestRam = `<i class='fa-solid fa-memory'></i> ${data.used}MB / ${data.total}MB`;
});

socket.on("temp", (temp) => {
    latestTemp = `<i class='fa-solid fa-temperature-three-quarters'></i> ${temp}`;
});

socket.on("cpu", (cpu) => {
    latestCpu = `<i class='fa-solid fa-microchip'></i> ${cpu}`;
});

// Cycle display
const weatherModes = [
    { key: 'weather', get: () => latestWeather },
    { key: 'ram', get: () => latestRam },
    { key: 'cpu', get: () => latestCpu },
    { key: 'temp', get: () => latestTemp },
];
let weatherIndex = 0;


function updateWeatherDisplay() {
    try {
        let html = weatherModes[weatherIndex].get();
        if (!html) {
            // fallback to weather if not available
            html = latestWeather || '';
        }
        document.getElementById('weather').innerHTML = html;
        weatherIndex = (weatherIndex + 1) % weatherModes.length;
    } catch (error) {
        document.getElementById('weather').textContent = 'Display error';
        console.error('Weather display error:', error);
    }
}



setInterval(updateWeatherDisplay, 5000);
updateWeatherDisplay();

function updateClock() {
    try {
        const now = new Date();
        const hourNum = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        let timeString, ampm = '';
        
        if (displaySettings.clockFormat === '24') {
            // 24-hour format
            const hours24 = String(hourNum).padStart(2, '0');
            timeString = `${hours24}:${minutes}`;
            ampm = '';
        } else {
            // 12-hour format
            let displayHour = hourNum % 12;
            if (displayHour === 0) displayHour = 12;
            ampm = hourNum >= 12 ? 'PM' : 'AM';
            const hours = String(displayHour).padStart(2, '0');
            timeString = `${hours}:${minutes}`;
        }
        
        document.getElementById('clock').textContent = timeString;
        const ampmElem = document.getElementById('ampm');
        if (ampmElem) {
            ampmElem.textContent = ampm;
            ampmElem.style.display = displaySettings.clockFormat === '24' ? 'none' : 'block';
        }

        let greeting;
        if (hourNum >= 5 && hourNum < 12) {
            greeting = "Good Morning";
        } else if (hourNum >= 12 && hourNum < 17) {
            greeting = "Good Afternoon";
        } else if (hourNum >= 17 && hourNum < 21) {
            greeting = "Good Evening";
        } else {
            greeting = "Good Night";
        }

        const name = window._greetingName || '';
        document.getElementById('greeting').textContent = name ? `${greeting}, ${name}` : greeting;
    } catch (error) {
        console.error('Error updating clock or greeting:', error);
    }
}

socket.on('displaySettings', (data) => {
    displaySettings = data;
    updateClock();
    // Update visibility of todo and event boxes based on settings
    fetchAndShowMultiTodos();
    fetchAndShowUpcomingEvent();
});

async function loadDisplaySettings() {
    try {
        const res = await fetch('/display-settings');
        displaySettings = await res.json();
        updateClock();
        // Update visibility of todo and event boxes based on settings
        fetchAndShowMultiTodos();
        fetchAndShowUpcomingEvent();
    } catch (e) {
        console.error('Failed to load display settings', e);
    }
}

setInterval(updateClock, 1000);
updateClock();

let screensaverActive = false;

socket.on("screensaver", (data) => {
    screensaverActive = data.active;
    updateScreensaverMode();
});

function updateScreensaverMode() {
    const body = document.body;
    const screenContainer = document.getElementById("screenContainer");
    const clockContainer = document.getElementById("clock-container");

    if (screensaverActive) {
        body.style.backgroundColor = "#000";
        body.style.backgroundImage = "none";

        // Hide screen container completely
        if (screenContainer) {
            screenContainer.style.display = "none";
        }

        const dimOverlay = document.getElementById("dimOverlay");
        if (dimOverlay) {
            dimOverlay.style.opacity = 0;
        }

        // Create or show screensaver clock
        let screensaverClock = document.getElementById("screensaver-clock");
        if (!screensaverClock) {
            screensaverClock = document.createElement("div");
            screensaverClock.id = "screensaver-clock";
            screensaverClock.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-family: 'LCD', 'Orbitron', sans-serif;
                font-size: 8vw;
                color: #fff;
                z-index: 2000;
                text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0px 0px 15px rgba(0,0,0,1);
            `;
            body.appendChild(screensaverClock);
        } else {
            screensaverClock.style.display = "block";
        }

        // Update screensaver clock
        function updateScreensaverClock() {
            if (!screensaverActive) return;
            const now = new Date();
            let hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            screensaverClock.textContent = `${hours}:${minutes} ${ampm}`;
        }
        updateScreensaverClock();
        if (!window.screensaverClockInterval) {
            window.screensaverClockInterval = setInterval(updateScreensaverClock, 1000);
        }
    } else {
        // Restore everything
        body.style.backgroundColor = "";
        body.style.backgroundImage = "";
        
        // Show screen container
        if (screenContainer) {
            screenContainer.style.display = "";
        }

        // Hide screensaver clock
        const screensaverClock = document.getElementById("screensaver-clock");
        if (screensaverClock) {
            screensaverClock.style.display = "none";
        }

        if (window.screensaverClockInterval) {
            clearInterval(window.screensaverClockInterval);
            window.screensaverClockInterval = null;
        }
        
        updateBackground();
    }
}

// ===== SCREEN CYCLING SYSTEM =====
let screenConfig = {
    screens: {
        home: true,
        weather: false,
        news: false,
        stats: false,
        messages: false
    },
    cycleDuration: 10,
    clickToSwitch: false
};
let currentScreenIndex = 0;
let activeScreens = ['home'];
let cycleInterval = null;

// Load screen config from server
async function loadScreenConfig() {
    try {
        const res = await fetch('/screen-config');
        const data = await res.json();
        screenConfig = data;
        updateActiveScreens();
        startScreenCycle();
        setupClickToSwitch();
    } catch (e) {
        console.error('Failed to load screen config', e);
        startScreenCycle();
        setupClickToSwitch();
    }
}

function updateActiveScreens() {
    const order = screenConfig.screenOrder || Object.keys(screenConfig.screens);
    activeScreens = order.filter(s => screenConfig.screens[s]);
    if (activeScreens.length === 0) {
        activeScreens = ['home'];
    }
}

function showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.style.display = 'none';
    });
    
    // Show selected screen
    const screen = document.getElementById(`screen-${screenName}`);
    if (screen) {
        screen.style.display = 'flex';
    }
    
    // Load data for screens that need it
    if (screenName === 'todo') loadTodoScreen();
    if (screenName === 'events') loadEventsScreen();
    
    console.log(`Showing screen: ${screenName}`);
}

function cycleScreens() {
    if (activeScreens.length <= 1) {
        showScreen(activeScreens[0]);
        return;
    }
    
    currentScreenIndex = (currentScreenIndex + 1) % activeScreens.length;
    showScreen(activeScreens[currentScreenIndex]);
}

function startScreenCycle() {
    if (cycleInterval) {
        clearInterval(cycleInterval);
    }
    
    // Show initial screen
    showScreen(activeScreens[currentScreenIndex]);
    
    // Only cycle if more than one screen is active
    if (activeScreens.length > 1) {
        cycleInterval = setInterval(cycleScreens, screenConfig.cycleDuration * 1000);
    }
}

// Listen for config updates
socket.on('screenConfig', (data) => {
    screenConfig = data;
    updateActiveScreens();
    currentScreenIndex = 0;
    startScreenCycle();
    setupClickToSwitch();
});

// Click / tap anywhere to advance to next screen
function setupClickToSwitch() {
    // Remove any existing listener to avoid duplicates
    document.body.removeEventListener('click', onScreenClick);
    document.body.removeEventListener('touchend', onScreenClick);

    if (screenConfig.clickToSwitch === true) {
        document.body.addEventListener('click', onScreenClick);
        document.body.addEventListener('touchend', onScreenClick);
    }
}

// All known screens in order — used for tap-cycling even when only 1 is "enabled"
const allScreenOrder = ['home', 'weather', 'news', 'stats', 'messages', 'countdown', 'timer', 'todo', 'events'];

function onScreenClick(e) {
    // Ignore clicks on interactive elements (buttons, inputs, links, todo items)
    if (e.target.closest('button, input, a, select, textarea, label, li')) return;

    if (activeScreens.length > 1) {
        // Normal multi-screen cycle
        cycleScreens();
        // Reset the auto-cycle timer so it doesn't double-skip
        if (cycleInterval) {
            clearInterval(cycleInterval);
            cycleInterval = setInterval(cycleScreens, screenConfig.cycleDuration * 1000);
        }
    } else {
        // Only 1 screen enabled — cycle through ALL screens on tap
        if (!window._tapScreenIndex) window._tapScreenIndex = 0;
        window._tapScreenIndex = (window._tapScreenIndex + 1) % allScreenOrder.length;
        showScreen(allScreenOrder[window._tapScreenIndex]);
    }
}

// Load news items
let newsItems = [];

async function loadNewsItems() {
    try {
        const res = await fetch('/news-items');
        newsItems = await res.json();
        updateNewsDisplay();
    } catch (e) {
        console.error('Failed to load news', e);
    }
}

let newsScrollSpeed = 10; // Default 10 seconds per headline
let currentNewsIndex = 0;
let newsRotationInterval = null;

function updateNewsDisplay() {
    const newsList = document.getElementById('news-list');
    const indicator = document.getElementById('newsIndicator');
    if (!newsList) return;
    
    if (newsItems.length === 0) {
        newsList.innerHTML = '<div class="news-headline active"><span class="title">No news available</span></div>';
        if (indicator) indicator.innerHTML = '';
        return;
    }
    
    // Show headlines based on settings
    const maxHeadlines = newsSettings.headlineCount || 6;
    const displayItems = newsItems.slice(0, maxHeadlines);
    
    newsList.innerHTML = displayItems.map((item, index) => `
        <div class="news-headline ${index === 0 ? 'active' : ''}">
            <span class="source" style="display: ${newsSettings.showSource ? 'block' : 'none'}">${item.source}</span>
            <span class="title">${item.title}</span>
        </div>
    `).join('');
    
    // Create indicator dots
    if (indicator) {
        indicator.style.display = newsSettings.showIndicator ? 'flex' : 'none';
        indicator.innerHTML = displayItems.map((_, index) => 
            `<div class="news-dot ${index === 0 ? 'active' : ''}"></div>`
        ).join('');
    }
    
    // Apply settings
    applyNewsSettings();
    
    // Start rotation
    startNewsRotation();
}

function startNewsRotation() {
    if (newsRotationInterval) {
        clearInterval(newsRotationInterval);
    }
    
    currentNewsIndex = 0;
    
    newsRotationInterval = setInterval(() => {
        const headlines = document.querySelectorAll('.news-headline');
        const dots = document.querySelectorAll('.news-dot');
        
        if (headlines.length === 0) return;
        
        // Hide current
        headlines[currentNewsIndex].classList.remove('active');
        if (dots[currentNewsIndex]) dots[currentNewsIndex].classList.remove('active');
        
        // Move to next
        currentNewsIndex = (currentNewsIndex + 1) % headlines.length;
        
        // Show next
        headlines[currentNewsIndex].classList.add('active');
        if (dots[currentNewsIndex]) dots[currentNewsIndex].classList.add('active');
    }, newsScrollSpeed * 1000);
}

let newsSettings = {
    fontSize: 'medium',
    textAlign: 'left',
    opacity: 92,
    showSource: true,
    showIndicator: true,
    showAnimation: true
};

socket.on('newsSettings', (data) => {
    newsSettings = data;
    newsScrollSpeed = data.scrollSpeed || 10;
    applyNewsSettings();
    updateNewsDisplay();
});

async function loadNewsSettings() {
    try {
        const res = await fetch('/news-settings');
        const data = await res.json();
        newsSettings = data;
        newsScrollSpeed = data.scrollSpeed || 10;
        applyNewsSettings();
    } catch (e) {
        console.error('Failed to load news settings', e);
    }
}

function applyNewsSettings() {
    const headlines = document.querySelectorAll('.news-headline');
    const indicator = document.getElementById('newsIndicator');
    
    headlines.forEach(headline => {
        // Font size
        const fontSizes = { small: '1em', medium: '1.2em', large: '1.5em' };
        headline.style.fontSize = fontSizes[newsSettings.fontSize] || '1.2em';
        
        // Text alignment
        headline.style.textAlign = newsSettings.textAlign || 'left';
        
        // Background opacity
        const opacity = (newsSettings.opacity || 92) / 100;
        headline.style.background = `rgba(15, 23, 42, ${opacity})`;
        
        // Show/hide source
        const source = headline.querySelector('.source');
        if (source) {
            source.style.display = newsSettings.showSource ? 'block' : 'none';
        }
        
        // Animation
        if (newsSettings.showAnimation === false) {
            headline.style.animation = 'none';
        }
    });
    
    // Show/hide indicator
    if (indicator) {
        indicator.style.display = newsSettings.showIndicator ? 'flex' : 'none';
    }
}

socket.on('newsItems', (items) => {
    newsItems = items;
    updateNewsDisplay();
});

// Load and update weather data
async function loadFullWeather() {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${weatherLat}&longitude=${weatherLon}&current_weather=true&hourly=relative_humidity_2m,visibility&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather API error');
        const data = await res.json();
        const weather = data.current_weather;
        
        // Update full weather display
        const tempElem = document.getElementById('weather-temp-large');
        const condElem = document.getElementById('weather-condition');
        const windElem = document.getElementById('weather-wind');
        const humidityElem = document.getElementById('weather-humidity');
        const visibilityElem = document.getElementById('weather-visibility');
        
        if (tempElem) tempElem.textContent = `${weather.temperature}°C`;
        if (windElem) windElem.textContent = `${weather.windspeed} km/h`;
        
        // Get current hour data
        const currentHour = new Date().getHours();
        if (humidityElem && data.hourly && data.hourly.relative_humidity_2m) {
            humidityElem.textContent = `${data.hourly.relative_humidity_2m[currentHour]}%`;
        }
        if (visibilityElem && data.hourly && data.hourly.visibility) {
            const visKm = (data.hourly.visibility[currentHour] / 1000).toFixed(1);
            visibilityElem.textContent = `${visKm} km`;
        }
        
        // Weather condition text
        let condition = 'Clear';
        if (weather.weathercode >= 80) condition = 'Heavy Rain';
        else if (weather.weathercode >= 60) condition = 'Rainy';
        else if (weather.weathercode >= 50) condition = 'Foggy';
        else if (weather.weathercode >= 40) condition = 'Cloudy';
        else if (weather.weathercode >= 30) condition = 'Partly Cloudy';
        else if (weather.weathercode >= 20) condition = 'Thunderstorm';
        
        if (condElem) condElem.textContent = condition;
    } catch (error) {
        console.error('Full weather fetch error:', error);
    }
}

// Update stats display
socket.on('temp', (temp) => {
    const statTemp = document.getElementById('stat-temp');
    if (statTemp) statTemp.textContent = `${temp}°C`;
});

socket.on('ram', (data) => {
    const statRam = document.getElementById('stat-ram');
    if (statRam) statRam.textContent = `${data.used} / ${data.total} MB`;
});

socket.on('cpu', (cpu) => {
    const statCpu = document.getElementById('stat-cpu');
    if (statCpu) statCpu.textContent = `${cpu}%`;
});

// Update message display
let currentMessage = null;

async function loadCurrentMessage() {
    try {
        const res = await fetch('/current-message');
        const data = await res.json();
        currentMessage = data.message;
        updateMessageDisplay();
    } catch (e) {
        console.error('Failed to load message', e);
    }
}

function updateMessageDisplay() {
    const messageText = document.getElementById('message-text');
    if (!messageText) return;
    
    if (currentMessage) {
        messageText.textContent = currentMessage;
    } else {
        messageText.textContent = 'No messages';
    }
}

socket.on('currentMessage', (data) => {
    currentMessage = data.message;
    updateMessageDisplay();
});

// Countdown functionality
let countdownData = null;
let countdownInterval = null;

async function loadCountdown() {
    try {
        const res = await fetch('/countdown');
        const data = await res.json();
        countdownData = data;
        updateCountdownDisplay();
    } catch (e) {
        console.error('Failed to load countdown', e);
    }
}

function updateCountdownDisplay() {
    const nameElem = document.getElementById('countdown-name');
    const daysElem = document.getElementById('countdown-days');
    const hoursElem = document.getElementById('countdown-hours');
    const minutesElem = document.getElementById('countdown-minutes');
    const secondsElem = document.getElementById('countdown-seconds');
    
    // Clear existing interval
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    if (!nameElem) return;
    
    if (!countdownData || !countdownData.name) {
        nameElem.textContent = 'No countdown set';
        if (daysElem) daysElem.textContent = '0';
        if (hoursElem) hoursElem.textContent = '00';
        if (minutesElem) minutesElem.textContent = '00';
        if (secondsElem) secondsElem.textContent = '00';
        return;
    }
    
    nameElem.textContent = countdownData.name;
    
    const targetDate = new Date(countdownData.date + 'T' + (countdownData.time || '00:00'));
    
    function updateTimer() {
        const now = new Date();
        const diff = targetDate - now;
        
        if (diff <= 0) {
            if (daysElem) daysElem.textContent = '0';
            if (hoursElem) hoursElem.textContent = '00';
            if (minutesElem) minutesElem.textContent = '00';
            if (secondsElem) secondsElem.textContent = '00';
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (daysElem) daysElem.textContent = days;
        if (hoursElem) hoursElem.textContent = String(hours).padStart(2, '0');
        if (minutesElem) minutesElem.textContent = String(minutes).padStart(2, '0');
        if (secondsElem) secondsElem.textContent = String(seconds).padStart(2, '0');
    }
    
    // Initial update
    updateTimer();
    
    // Start interval
    countdownInterval = setInterval(updateTimer, 1000);
}

socket.on('countdown', (data) => {
    countdownData = data;
    updateCountdownDisplay();
});

// Background management
// Preset keyword backgrounds (used when a named preset is set instead of a URL)
const presetBackgrounds = {
    gradient: () => {
        document.body.style.backgroundImage = '';
        document.body.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)';
    },
    none: () => {
        document.body.style.backgroundImage = '';
        document.body.style.background = '#000';
    },
    space: () => applyUrlBackground('https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920'),
    nature: () => applyUrlBackground('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920'),
    ocean: () => applyUrlBackground('https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1920'),
    mountains: () => applyUrlBackground('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920'),
};

function applyUrlBackground(url) {
    const body = document.body;
    const img = new window.Image();
    img.onload = () => {
        body.style.background = '#000';
        body.style.backgroundImage = `url("${url}")`;
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundRepeat = 'no-repeat';
        applyBgOverlay();
    };
    img.src = url;
}

socket.on('background', (data) => {
    const bg = data.background;
    if (!bg) return;

    if (presetBackgrounds[bg]) {
        // It's a named preset keyword
        presetBackgrounds[bg]();
    } else if (bg.startsWith('/uploads/') || bg.startsWith('http')) {
        // It's a direct URL (uploaded file or Pexels URL)
        applyUrlBackground(bg);
    }
});

async function loadCurrentBackground() {
    try {
        const res = await fetch('/current-background');
        const data = await res.json();
        const bg = data.background;
        if (!bg || bg === 'gradient') {
            // Let Pexels handle it via updateBackground()
            return;
        }
        // Apply stored background directly
        if (presetBackgrounds[bg]) {
            presetBackgrounds[bg]();
        } else if (bg.startsWith('/uploads/') || bg.startsWith('http')) {
            applyUrlBackground(bg);
        }
    } catch (e) {
        console.error('Failed to load background', e);
    }
}

// Timer display functionality
let timerDisplayInterval = null;

socket.on('timerState', (data) => {
    updateTimerDisplay(data);
});

async function loadTimerState() {
    try {
        const res = await fetch('/timer-state');
        const data = await res.json();
        updateTimerDisplay(data);
    } catch (e) {
        console.error('Failed to load timer state', e);
    }
}

function updateTimerDisplay(data) {
    const modeElem = document.getElementById('timer-mode');
    const timeElem = document.getElementById('timer-time');
    const statusElem = document.getElementById('timer-status');
    
    if (!modeElem || !timeElem || !statusElem) return;
    
    // Update mode label
    if (data.mode === 'stopwatch') {
        modeElem.textContent = 'STOPWATCH';
    } else if (data.mode === 'pomodoro') {
        modeElem.textContent = 'POMODORO';
    } else if (data.mode === 'custom') {
        modeElem.textContent = 'TIMER';
    }
    
    // Format time display
    const formatTimerDisplay = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    
    timeElem.textContent = formatTimerDisplay(data.time);
    
    // Update status
    if (data.running) {
        statusElem.textContent = 'Running...';
        statusElem.style.color = '#34a853';
    } else {
        statusElem.textContent = data.mode === 'stopwatch' ? 'Paused' : 'Stopped';
        statusElem.style.color = '#ea4335';
    }
    
    // Show pomodoro mode if applicable
    if (data.mode === 'pomodoro' && data.pomodoroMode) {
        statusElem.textContent = data.pomodoroMode === 'work' ? '🔥 Work Session' : '☕ Break Time';
        statusElem.style.color = data.pomodoroMode === 'work' ? '#ea4335' : '#34a853';
    }
}

// Celebration functionality
let notificationSettings = { celebrationEnabled: true, celebrationDuration: 5, soundEnabled: true };

socket.on('celebration', (data) => {
    if (notificationSettings.celebrationEnabled) {
        showCelebration(data.title, data.message);
    }
});

socket.on('notificationSettings', (data) => {
    notificationSettings = data;
});

async function loadNotificationSettings() {
    try {
        const res = await fetch('/notification-settings');
        notificationSettings = await res.json();
    } catch (e) {
        console.error('Failed to load notification settings', e);
    }
}

function showCelebration(title, message) {
    const overlay = document.getElementById('celebration-overlay');
    const titleElem = overlay.querySelector('.celebration-title');
    const messageElem = overlay.querySelector('.celebration-message');
    
    titleElem.textContent = title;
    messageElem.textContent = message;
    
    overlay.style.display = 'flex';
    
    // Create confetti
    createConfetti();
    
    // Auto-hide based on settings
    const duration = (notificationSettings.celebrationDuration || 5) * 1000;
    setTimeout(() => {
        overlay.style.display = 'none';
        document.getElementById('confettiContainer').innerHTML = '';
    }, duration);
}

function createConfetti() {
    const container = document.getElementById('confettiContainer');
    container.innerHTML = '';
    
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.animationDelay = Math.random() * 3 + 's';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        container.appendChild(confetti);
    }
}

// Load and render the todo screen
async function loadTodoScreen() {
    try {
        const res = await fetch('/todos');
        const todos = await res.json();

        const todoList = document.getElementById('todo-screen-list');
        const todoEmpty = document.getElementById('todo-screen-empty');
        if (todoList) {
            todoList.innerHTML = '';
            const pending = todos.filter(t => !t.done && !t.completed);
            if (pending.length === 0) {
                todoEmpty && (todoEmpty.style.display = 'block');
            } else {
                todoEmpty && (todoEmpty.style.display = 'none');
                pending.slice(0, 10).forEach(todo => {
                    const li = document.createElement('li');
                    li.innerHTML = `<i class="fas fa-circle" style="font-size:0.5em;color:var(--accent,#4285f4);flex-shrink:0;"></i><span>${todo.text || todo}</span>`;
                    todoList.appendChild(li);
                });
            }
        }
    } catch (e) {
        console.error('Failed to load todo screen:', e);
    }
}

// Load and render the events screen
async function loadEventsScreen() {
    try {
        const res = await fetch('/events');
        const events = await res.json();

        const eventList = document.getElementById('events-screen-list');
        const eventEmpty = document.getElementById('events-screen-empty');
        if (eventList) {
            eventList.innerHTML = '';
            const now = new Date();
            const upcoming = events
                .filter(ev => new Date(ev.date + 'T' + ev.time) >= now)
                .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time))
                .slice(0, 10);
            if (upcoming.length === 0) {
                eventEmpty && (eventEmpty.style.display = 'block');
            } else {
                eventEmpty && (eventEmpty.style.display = 'none');
                upcoming.forEach(ev => {
                    const dt = new Date(ev.date + 'T' + ev.time);
                    const day = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                    const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="event-title">${ev.title}</span>
                        <span class="event-time"><i class="fas fa-clock"></i>${day} · ${time}</span>
                    `;
                    eventList.appendChild(li);
                });
            }
        }
    } catch (e) {
        console.error('Failed to load events screen:', e);
    }
}



// Initialize everything — extra settings first so location/greeting/bg are ready
loadAndApplyExtraSettings().then(async () => {
    // Fetch weather after geocoding is done
    await fetchWeather();
    
    // Determine background: if a specific bg is stored, use it; otherwise use Pexels
    try {
        const res = await fetch('/current-background');
        const data = await res.json();
        const bg = data.background;
        if (bg && bg !== 'gradient' && bg !== 'none') {
            if (presetBackgrounds[bg]) {
                presetBackgrounds[bg]();
            } else if (bg.startsWith('/uploads/') || bg.startsWith('http')) {
                applyUrlBackground(bg);
            } else {
                updateBackground();
            }
        } else {
            updateBackground();
        }
        scheduleBackgroundRefresh(backgroundRefreshInterval);
    } catch (e) {
        updateBackground();
        scheduleBackgroundRefresh(backgroundRefreshInterval);
    }
});

loadScreenConfig();
loadNewsItems();
loadFullWeather();
loadCurrentMessage();
loadCountdown();
loadTimerState();
loadNotificationSettings();
loadDisplaySettings();
loadNewsSettings();

// Periodic updates
setInterval(loadNewsItems, 5 * 60 * 1000); // Every 5 minutes
setInterval(loadFullWeather, 10 * 60 * 1000); // Every 10 minutes
setInterval(loadCurrentMessage, 30 * 1000); // Every 30 seconds
setInterval(loadCountdown, 60 * 1000); // Every minute
setInterval(loadTimerState, 2 * 1000); // Every 2 seconds