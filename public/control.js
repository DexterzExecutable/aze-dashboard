const socket = io();

// Tab switching
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.target.closest('.tab').classList.add('active');
    
    // Load data for the tab
    if (tabName === 'todo') loadTodos();
    if (tabName === 'calendar') loadEvents();
    if (tabName === 'news') loadFeeds();
    if (tabName === 'messages') loadCurrentMessage();
    if (tabName === 'countdown') loadCountdownData();
    if (tabName === 'screens') loadScreenConfig();
    if (tabName === 'screensaver') loadScreensaverSettings();
}

// Screen Config
let screenConfig = {
    screens: { home: true, weather: false, news: false, stats: false, messages: false, countdown: false, timer: false, todo: false, events: false },
    cycleDuration: 10,
    screenOrder: ['home', 'weather', 'news', 'stats', 'messages', 'countdown', 'timer', 'todo', 'events']
};

const screenLabels = {
    home: { name: 'Home', icon: 'fa-home' },
    weather: { name: 'Weather', icon: 'fa-cloud-sun' },
    news: { name: 'News', icon: 'fa-newspaper' },
    stats: { name: 'Stats', icon: 'fa-chart-line' },
    messages: { name: 'Messages', icon: 'fa-envelope' },
    countdown: { name: 'Countdown', icon: 'fa-hourglass-half' },
    timer: { name: 'Timer', icon: 'fa-stopwatch' },
    todo: { name: 'To-Dos', icon: 'fa-tasks' },
    events: { name: 'Events', icon: 'fa-calendar-alt' }
};

async function loadScreenConfig() {
    try {
        const res = await fetch('/screen-config');
        screenConfig = await res.json();
        
        // Ensure screenOrder exists
        if (!screenConfig.screenOrder) {
            screenConfig.screenOrder = Object.keys(screenConfig.screens);
        }
        
        // Update toggles
        Object.keys(screenConfig.screens).forEach(screen => {
            const toggle = document.querySelector(`.toggle-switch[data-screen="${screen}"]`);
            if (toggle) {
                toggle.classList.toggle('active', screenConfig.screens[screen]);
            }
        });
        
        document.getElementById('cycleDuration').value = screenConfig.cycleDuration;
        
        // Update click-to-switch toggle
        const clickToggle = document.getElementById('clickToSwitchToggle');
        if (clickToggle) {
            clickToggle.classList.toggle('active', screenConfig.clickToSwitch === true);
        }
        
        // Render screen order list
        renderScreenOrderList();
        
        updateSystemInfo();
    } catch (e) {
        console.error('Failed to load config', e);
    }
}

function renderScreenOrderList() {
    const container = document.getElementById('screenOrderList');
    if (!container) return;
    
    container.innerHTML = screenConfig.screenOrder.map((screen, idx) => {
        const label = screenLabels[screen] || { name: screen, icon: 'fa-square' };
        return `
            <div class="screen-order-item" draggable="true" data-screen="${screen}">
                <i class="fas fa-grip-vertical drag-handle"></i>
                <span class="order-number">${idx + 1}</span>
                <span class="screen-name"><i class="fas ${label.icon}"></i>${label.name}</span>
            </div>
        `;
    }).join('');
    
    // Add drag-and-drop event listeners
    setupDragAndDrop();
}

function setupDragAndDrop() {
    const container = document.getElementById('screenOrderList');
    const items = container.querySelectorAll('.screen-order-item');
    
    let draggedItem = null;
    
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedItem = null;
            
            // Update screenOrder based on current DOM order
            const newOrder = [];
            container.querySelectorAll('.screen-order-item').forEach((el, idx) => {
                newOrder.push(el.dataset.screen);
                el.querySelector('.order-number').textContent = idx + 1;
            });
            screenConfig.screenOrder = newOrder;
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (item !== draggedItem) {
                item.classList.add('drag-over');
            }
        });
        
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });
        
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            
            if (item !== draggedItem && draggedItem) {
                const allItems = [...container.querySelectorAll('.screen-order-item')];
                const draggedIdx = allItems.indexOf(draggedItem);
                const targetIdx = allItems.indexOf(item);
                
                if (draggedIdx < targetIdx) {
                    item.after(draggedItem);
                } else {
                    item.before(draggedItem);
                }
            }
        });
    });
}

document.querySelectorAll('.toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', function() {
        // Click-to-switch toggle has no data-screen
        if (this.id === 'clickToSwitchToggle') {
            this.classList.toggle('active');
            return;
        }

        const screen = this.dataset.screen;
        const activeCount = Object.values(screenConfig.screens).filter(v => v).length;
        
        if (screenConfig.screens[screen] && activeCount === 1) {
            alert('At least one screen must be enabled!');
            return;
        }
        
        screenConfig.screens[screen] = !screenConfig.screens[screen];
        this.classList.toggle('active');
    });
});

async function saveScreenConfig() {
    const duration = parseInt(document.getElementById('cycleDuration').value);
    screenConfig.cycleDuration = duration;
    const clickToggle = document.getElementById('clickToSwitchToggle');
    screenConfig.clickToSwitch = clickToggle ? clickToggle.classList.contains('active') : true;
    
    try {
        await fetch('/screen-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(screenConfig)
        });
        alert('✓ Configuration saved!');
        updateSystemInfo();
    } catch (e) {
        alert('Failed to save configuration');
    }
}

function updateSystemInfo() {
    const activeCount = Object.values(screenConfig.screens).filter(v => v).length;
    document.getElementById('activeScreenCount').textContent = activeCount;
    document.getElementById('cycleStatus').textContent = activeCount > 1 ? 'Enabled' : 'Disabled';
}

// Todos
let todos = [];

async function loadTodos() {
    try {
        const res = await fetch('/todos');
        todos = await res.json();
        renderTodos();
    } catch (e) {
        console.error('Failed to load todos', e);
    }
}

function renderTodos() {
    const list = document.getElementById('todoList');
    const count = document.getElementById('todoCount');
    count.textContent = todos.length;
    
    if (todos.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888;">No todos yet</p>';
        return;
    }
    
    list.innerHTML = todos.map((todo, idx) => `
        <div class="item">
            <span>${todo.text || todo}</span>
            <button class="btn btn-danger" style="padding: 8px 15px;" onclick="deleteTodo(${idx})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

async function addTodo() {
    const input = document.getElementById('todoInput');
    const todo = input.value.trim();
    
    if (!todo) return;
    
    try {
        await fetch('/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ todo })
        });
        input.value = '';
        loadTodos();
    } catch (e) {
        alert('Failed to add todo');
    }
}

async function deleteTodo(index) {
    try {
        await fetch(`/todos/${index}`, { method: 'DELETE' });
        loadTodos();
    } catch (e) {
        alert('Failed to delete todo');
    }
}

socket.on('todos', (data) => {
    todos = data;
    renderTodos();
});

socket.on('screensaverSettings', async (data) => {
    // Update form when settings change from another device
    if (document.getElementById('tab-screensaver').style.display !== 'none') {
        await loadScreensaverSettings();
    }
});

// Events
let events = [];

async function loadEvents() {
    try {
        const res = await fetch('/events');
        events = await res.json();
        renderEvents();
    } catch (e) {
        console.error('Failed to load events', e);
    }
}

function renderEvents() {
    const list = document.getElementById('eventList');
    const count = document.getElementById('eventCount');
    count.textContent = events.length;
    
    if (events.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888;">No events yet</p>';
        return;
    }
    
    list.innerHTML = events.map((event, idx) => `
        <div class="item">
            <div>
                <strong>${event.title}</strong><br>
                <small style="color: #aaa;">${event.date} at ${event.time}</small>
            </div>
            <button class="btn btn-danger" style="padding: 8px 15px;" onclick="deleteEvent(${idx})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

async function addEvent() {
    const title = document.getElementById('eventTitle').value.trim();
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    
    if (!title || !date || !time) {
        alert('Please fill all fields');
        return;
    }
    
    try {
        await fetch('/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, date, time })
        });
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventDate').value = '';
        document.getElementById('eventTime').value = '';
        loadEvents();
    } catch (e) {
        alert('Failed to add event');
    }
}

async function deleteEvent(index) {
    try {
        await fetch(`/events/${index}`, { method: 'DELETE' });
        loadEvents();
    } catch (e) {
        alert('Failed to delete event');
    }
}

// News Feeds
let feeds = [];

async function loadFeeds() {
    try {
        const res = await fetch('/news-feeds');
        feeds = await res.json();
        renderFeeds();
    } catch (e) {
        console.error('Failed to load feeds', e);
    }
}

function renderFeeds() {
    const list = document.getElementById('feedList');
    const count = document.getElementById('feedCount');
    count.textContent = feeds.length;
    
    if (feeds.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888;">No feeds yet</p>';
        return;
    }
    
    list.innerHTML = feeds.map((feed, idx) => `
        <div class="item">
            <div>
                <strong>${feed.name}</strong><br>
                <small style="color: #aaa; word-break: break-all;">${feed.url}</small>
            </div>
            <button class="btn btn-danger" style="padding: 8px 15px;" onclick="deleteFeed(${idx})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

async function addNewsFeed(presetName, presetUrl) {
    let name, url;
    
    if (presetName && presetUrl) {
        name = presetName;
        url = presetUrl;
    } else {
        name = document.getElementById('feedName').value.trim();
        url = document.getElementById('feedUrl').value.trim();
        
        if (!name || !url) {
            alert('Please fill all fields');
            return;
        }
    }
    
    try {
        await fetch('/news-feeds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, url })
        });
        
        if (!presetName) {
            document.getElementById('feedName').value = '';
            document.getElementById('feedUrl').value = '';
        }
        
        loadFeeds();
    } catch (e) {
        alert('Failed to add feed');
    }
}

async function deleteFeed(index) {
    try {
        await fetch(`/news-feeds/${index}`, { method: 'DELETE' });
        loadFeeds();
    } catch (e) {
        alert('Failed to delete feed');
    }
}

// Messages
async function loadCurrentMessage() {
    try {
        const res = await fetch('/current-message');
        const data = await res.json();
        const messageDiv = document.getElementById('currentMessage');
        messageDiv.textContent = data.message || 'No messages';
    } catch (e) {
        console.error('Failed to load message', e);
    }
}

async function sendMessage() {
    const message = document.getElementById('messageText').value.trim();
    
    if (!message) return;
    
    try {
        await fetch('/current-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        document.getElementById('messageText').value = '';
        loadCurrentMessage();
        alert('✓ Message sent!');
    } catch (e) {
        alert('Failed to send message');
    }
}

async function clearMessage() {
    try {
        await fetch('/current-message', { method: 'DELETE' });
        loadCurrentMessage();
    } catch (e) {
        alert('Failed to clear message');
    }
}

// Countdown
async function loadCountdownData() {
    try {
        const res = await fetch('/countdown');
        const data = await res.json();
        if (data.name) {
            document.getElementById('countdownName').value = data.name;
            document.getElementById('countdownDate').value = data.date;
            document.getElementById('countdownTime').value = data.time || '00:00';
        }
    } catch (e) {
        console.error('Failed to load countdown', e);
    }
}

async function setCountdown() {
    const name = document.getElementById('countdownName').value.trim();
    const date = document.getElementById('countdownDate').value;
    const time = document.getElementById('countdownTime').value;
    
    if (!name || !date) {
        alert('Please fill name and date');
        return;
    }
    
    try {
        await fetch('/countdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, date, time })
        });
        alert('✓ Countdown set!');
    } catch (e) {
        alert('Failed to set countdown');
    }
}

async function clearCountdown() {
    try {
        await fetch('/countdown', { method: 'DELETE' });
        document.getElementById('countdownName').value = '';
        document.getElementById('countdownDate').value = '';
        document.getElementById('countdownTime').value = '00:00';
        alert('✓ Countdown cleared!');
    } catch (e) {
        alert('Failed to clear countdown');
    }
}

// Background Upload
async function uploadBackground(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show inline status without blocking alert
    const label = event.target.closest('.form-group') || event.target.parentElement;
    let statusEl = document.getElementById('uploadBgStatus');
    if (!statusEl) {
        statusEl = document.createElement('p');
        statusEl.id = 'uploadBgStatus';
        statusEl.style.cssText = 'margin-top:8px;font-size:0.85em;';
        label.appendChild(statusEl);
    }
    statusEl.style.color = 'rgba(227,227,227,0.7)';
    statusEl.textContent = '⏳ Uploading...';

    const formData = new FormData();
    formData.append('background', file);

    try {
        const res = await fetch('/upload-background', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            statusEl.style.color = '#34a853';
            statusEl.textContent = '✓ Background uploaded and applied!';
            setTimeout(() => { statusEl.textContent = ''; }, 4000);
        } else {
            statusEl.style.color = '#ea4335';
            statusEl.textContent = '✗ Upload failed. Try again.';
        }
    } catch (e) {
        statusEl.style.color = '#ea4335';
        statusEl.textContent = '✗ Upload failed. Try again.';
    }
}

async function setPresetBackground(preset) {
    try {
        await fetch('/set-background', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preset })
        });
        alert('✓ Background updated!');
    } catch (e) {
        alert('Failed to set background');
    }
}

// Brightness
function updateBrightness(value) {
    document.getElementById('brightnessValue').textContent = value;
    socket.emit('brightness', { value: value / 100 });
}

// Screensaver
let screensaverActive = false;

function toggleScreensaver() {
    screensaverActive = !screensaverActive;
    const btn = document.getElementById('screensaverBtn');
    
    if (screensaverActive) {
        btn.innerHTML = '<i class="fas fa-power-off"></i> Disable Screensaver';
        btn.classList.add('btn-danger');
    } else {
        btn.innerHTML = '<i class="fas fa-power-off"></i> Enable Screensaver';
        btn.classList.remove('btn-danger');
    }
    
    socket.emit('screensaver', { active: screensaverActive });
}

// Timer functionality
let stopwatchInterval = null;
let stopwatchTime = 0;
let stopwatchRunning = false;

let pomodoroInterval = null;
let pomodoroTime = 25 * 60;
let pomodoroRunning = false;
let pomodoroMode = 'work'; // 'work' or 'break'
let pomodoroSessionCount = 1;
let pomodoroMaxSessions = 4;

let customTimerInterval = null;
let customTimerTime = 5 * 60;
let customTimerRunning = false;

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTimeShort(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Stopwatch
function startStopwatch() {
    if (!stopwatchRunning) {
        stopwatchRunning = true;
        stopwatchInterval = setInterval(() => {
            stopwatchTime++;
            document.getElementById('stopwatchDisplay').textContent = formatTime(stopwatchTime);
            updateTimerState('stopwatch', stopwatchTime, true);
        }, 1000);
        document.getElementById('stopwatchStartBtn').innerHTML = '<i class="fas fa-play"></i> Running...';
        updateTimerState('stopwatch', stopwatchTime, true);
    }
}

function stopStopwatch() {
    stopwatchRunning = false;
    if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
    }
    document.getElementById('stopwatchStartBtn').innerHTML = '<i class="fas fa-play"></i> Start';
    updateTimerState('stopwatch', stopwatchTime, false);
}

function resetStopwatch() {
    stopStopwatch();
    stopwatchTime = 0;
    document.getElementById('stopwatchDisplay').textContent = formatTime(0);
    updateTimerState('stopwatch', 0, false);
}

// Pomodoro
function startPomodoro() {
    if (!pomodoroRunning) {
        pomodoroRunning = true;
        const workDuration = parseInt(document.getElementById('pomodoroWork').value) * 60;
        const breakDuration = parseInt(document.getElementById('pomodoroBreak').value) * 60;
        const longBreakDuration = parseInt(document.getElementById('pomodoroLongBreak').value) * 60;
        pomodoroMaxSessions = parseInt(document.getElementById('pomodoroSessions').value);
        const autoStart = document.getElementById('pomodoroAutoStart').checked;
        const playSound = document.getElementById('pomodoroSound').checked;
        
        pomodoroInterval = setInterval(() => {
            pomodoroTime--;
            document.getElementById('pomodoroDisplay').textContent = formatTimeShort(pomodoroTime);
            updateTimerState('pomodoro', pomodoroTime, true, pomodoroMode, workDuration, breakDuration);
            
            if (pomodoroTime <= 0) {
                // Timer completed - trigger celebration
                triggerCelebration('Pomodoro Complete!', pomodoroMode === 'work' ? '🎉 Great work session!' : '☕ Break time over!');
                
                // Play sound if enabled
                if (playSound && window.Audio) {
                    const beep = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZLQ0RVqvn77BdGAk+ltv1xnInBSl+zPLaizsIGGS57OihUBALTKXh8bllHAU2jdXzzn8pBSh6yO/glEILElyx6PKsWhcJPJPY88p2KAUme8rx3I4+CRdks+vuolQRC0yn4/K4Zh0GM43S88yAKwUndcfu4JdDCxJasefyr1sYCT6U2vXJdikFKn/M8tyOPwgYZLXt7qVVEgxNp+Txu2geAk==');
                    beep.play();
                }
                
                // Get custom labels
                const workLabel = document.getElementById('pomodoroWorkLabel').value || 'Work Session';
                const breakLabel = document.getElementById('pomodoroBreakLabel').value || 'Break Time';
                const longBreakLabel = document.getElementById('pomodoroLongBreakLabel').value || 'Long Break';
                
                // Switch mode
                if (pomodoroMode === 'work') {
                    pomodoroSessionCount++;
                    
                    // Check if it's time for long break
                    if (pomodoroSessionCount > pomodoroMaxSessions) {
                        pomodoroMode = 'longbreak';
                        pomodoroTime = longBreakDuration;
                        document.getElementById('pomodoroStatus').textContent = '🌟 ' + longBreakLabel;
                        pomodoroSessionCount = 1;
                    } else {
                        pomodoroMode = 'break';
                        pomodoroTime = breakDuration;
                        document.getElementById('pomodoroStatus').textContent = '☕ ' + breakLabel;
                    }
                } else {
                    pomodoroMode = 'work';
                    pomodoroTime = workDuration;
                    document.getElementById('pomodoroStatus').textContent = '🔥 ' + workLabel;
                }
                
                document.getElementById('pomodoroSessionCount').textContent = `Session ${pomodoroSessionCount} of ${pomodoroMaxSessions}`;
                updateTimerState('pomodoro', pomodoroTime, true, pomodoroMode, workDuration, breakDuration);
                
                // Auto-start if enabled, otherwise pause
                if (!autoStart) {
                    stopPomodoro();
                }
            }
        }, 1000);
        document.getElementById('pomodoroStartBtn').innerHTML = '<i class="fas fa-play"></i> Running...';
        document.getElementById('pomodoroSessionCount').textContent = `Session ${pomodoroSessionCount} of ${pomodoroMaxSessions}`;
        updateTimerState('pomodoro', pomodoroTime, true, pomodoroMode, workDuration, breakDuration);
    }
}

function stopPomodoro() {
    pomodoroRunning = false;
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
    document.getElementById('pomodoroStartBtn').innerHTML = '<i class="fas fa-play"></i> Start';
    const workDuration = parseInt(document.getElementById('pomodoroWork').value) * 60;
    const breakDuration = parseInt(document.getElementById('pomodoroBreak').value) * 60;
    updateTimerState('pomodoro', pomodoroTime, false, pomodoroMode, workDuration, breakDuration);
}

function resetPomodoro() {
    stopPomodoro();
    pomodoroMode = 'work';
    pomodoroSessionCount = 1;
    pomodoroTime = parseInt(document.getElementById('pomodoroWork').value) * 60;
    document.getElementById('pomodoroDisplay').textContent = formatTimeShort(pomodoroTime);
    document.getElementById('pomodoroStatus').textContent = '🔥 Work Session';
    document.getElementById('pomodoroSessionCount').textContent = `Session 1 of ${pomodoroMaxSessions}`;
    const workDuration = parseInt(document.getElementById('pomodoroWork').value) * 60;
    const breakDuration = parseInt(document.getElementById('pomodoroBreak').value) * 60;
    updateTimerState('pomodoro', pomodoroTime, false, pomodoroMode, workDuration, breakDuration);
}

// Custom Timer
function startCustomTimer() {
    if (!customTimerRunning) {
        customTimerRunning = true;
        const playSound = document.getElementById('customTimerSound').checked;
        const repeat = document.getElementById('customTimerRepeat').checked;
        const timerName = document.getElementById('customTimerName').value || 'Custom Timer';
        
        customTimerInterval = setInterval(() => {
            customTimerTime--;
            document.getElementById('customTimerDisplay').textContent = formatTime(customTimerTime);
            updateTimerState('custom', customTimerTime, true);
            
            if (customTimerTime <= 0) {
                // Timer completed - trigger celebration
                triggerCelebration(`${timerName} Complete!`, '🎉 Time\'s up!');
                
                // Play sound if enabled
                if (playSound && window.Audio) {
                    const beep = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZLQ0RVqvn77BdGAk+ltv1xnInBSl+zPLaizsIGGS57OihUBALTKXh8bllHAU2jdXzzn8pBSh6yO/glEILElyx6PKsWhcJPJPY88p2KAUme8rx3I4+CRdks+vuolQRC0yn4/K4Zh0GM43S88yAKwUndcfu4JdDCxJasefyr1sYCT6U2vXJdikFKn/M8tyOPwgYZLXt7qVVEgxNp+Txu2geAk==');
                    beep.play();
                }
                
                // Repeat if enabled
                if (repeat) {
                    const h = parseInt(document.getElementById('customHours').value) || 0;
                    const m = parseInt(document.getElementById('customMinutes').value) || 0;
                    const s = parseInt(document.getElementById('customSeconds').value) || 0;
                    customTimerTime = (h * 3600) + (m * 60) + s;
                } else {
                    stopCustomTimer();
                }
            }
        }, 1000);
        document.getElementById('customTimerStartBtn').innerHTML = '<i class="fas fa-play"></i> Running...';
        updateTimerState('custom', customTimerTime, true);
    }
}

function stopCustomTimer() {
    customTimerRunning = false;
    if (customTimerInterval) {
        clearInterval(customTimerInterval);
        customTimerInterval = null;
    }
    document.getElementById('customTimerStartBtn').innerHTML = '<i class="fas fa-play"></i> Start';
    updateTimerState('custom', customTimerTime, false);
}

function resetCustomTimer() {
    stopCustomTimer();
    const h = parseInt(document.getElementById('customHours').value) || 0;
    const m = parseInt(document.getElementById('customMinutes').value) || 0;
    const s = parseInt(document.getElementById('customSeconds').value) || 0;
    customTimerTime = (h * 3600) + (m * 60) + s;
    document.getElementById('customTimerDisplay').textContent = formatTime(customTimerTime);
    updateTimerState('custom', customTimerTime, false);
}

// Send timer state to server
async function updateTimerState(mode, time, running, pomodoroMode, pomodoroWork, pomodoroBreak) {
    try {
        await fetch('/timer-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode,
                time,
                running,
                pomodoroMode: pomodoroMode || null,
                pomodoroWork: pomodoroWork || null,
                pomodoroBreak: pomodoroBreak || null
            })
        });
    } catch (e) {
        console.error('Failed to update timer state', e);
    }
}

// Update custom timer display when inputs change
document.addEventListener('DOMContentLoaded', () => {
    ['customHours', 'customMinutes', 'customSeconds'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('input', resetCustomTimer);
        }
    });
    
    ['pomodoroWork', 'pomodoroBreak'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('input', () => {
                if (pomodoroMode === 'work') {
                    pomodoroTime = parseInt(document.getElementById('pomodoroWork').value) * 60;
                } else {
                    pomodoroTime = parseInt(document.getElementById('pomodoroBreak').value) * 60;
                }
                document.getElementById('pomodoroDisplay').textContent = formatTimeShort(pomodoroTime);
            });
        }
    });
});

// Trigger celebration on control panel
function triggerCelebration(title, message) {
    // Send celebration to Pi display
    socket.emit('celebration', { title, message });
}

// Save display settings
async function saveDisplaySettings() {
    const clockFormat = document.getElementById('clockFormat').value;
    const dateFormat = document.getElementById('dateFormat').value;
    const tempUnit = document.getElementById('tempUnit').value;
    const showTodos = document.getElementById('showTodos').checked;
    const showEvents = document.getElementById('showEvents').checked;
    
    try {
        await fetch('/display-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clockFormat, dateFormat, tempUnit, showTodos, showEvents })
        });
        alert('✓ Display settings saved!');
    } catch (e) {
        alert('Failed to save display settings');
    }
}

// Save notification settings
async function saveNotificationSettings() {
    const celebrationEnabled = document.getElementById('celebrationEnabled').checked;
    const celebrationDuration = parseInt(document.getElementById('celebrationDuration').value);
    const soundEnabled = document.getElementById('soundEnabled').checked;
    
    try {
        await fetch('/notification-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ celebrationEnabled, celebrationDuration, soundEnabled })
        });
        alert('✓ Notification settings saved!');
    } catch (e) {
        alert('Failed to save notification settings');
    }
}

// Refresh dashboard
function refreshDashboard() {
    if (confirm('Refresh the dashboard display on your Pi?')) {
        socket.emit('refresh');
    }
}

// Save news settings
async function saveNewsSettings() {
    const settings = {
        headlineCount: parseInt(document.getElementById('newsHeadlineCount').value),
        scrollSpeed: parseInt(document.getElementById('newsScrollSpeed').value),
        fontSize: document.getElementById('newsFontSize').value,
        textAlign: document.getElementById('newsTextAlign').value,
        opacity: parseInt(document.getElementById('newsOpacity').value),
        showSource: document.getElementById('newsShowSource').checked,
        showIndicator: document.getElementById('newsShowIndicator').checked,
        showAnimation: document.getElementById('newsShowAnimation').checked
    };
    
    try {
        await fetch('/news-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        alert('✓ News settings saved!');
    } catch (e) {
        alert('Failed to save news settings');
    }
}

// Apply preset
async function applyPreset(presetName) {
    if (!confirm(`Apply ${presetName} preset? This will change your current settings.`)) {
        return;
    }
    
    try {
        const res = await fetch('/apply-preset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preset: presetName })
        });
        
        if (res.ok) {
            alert(`✓ ${presetName} preset applied! Your dashboard is now configured.`);
            // Reload config
            loadScreenConfig();
        } else {
            alert('Failed to apply preset');
        }
    } catch (e) {
        alert('Failed to apply preset');
    }
}

// Save custom preset
async function saveCustomPreset() {
    const name = document.getElementById('customPresetName').value.trim();
    if (!name) {
        alert('Please enter a preset name');
        return;
    }
    
    try {
        const res = await fetch('/save-custom-preset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        if (res.ok) {
            alert(`✓ Preset "${name}" saved!`);
            document.getElementById('customPresetName').value = '';
            loadCustomPresets();
        } else {
            alert('Failed to save preset');
        }
    } catch (e) {
        alert('Failed to save preset');
    }
}

// Load custom presets
async function loadCustomPresets() {
    try {
        const res = await fetch('/custom-presets');
        const presets = await res.json();
        
        const list = document.getElementById('customPresetList');
        const count = document.getElementById('customPresetCount');
        
        count.textContent = presets.length;
        
        if (presets.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: rgba(227, 227, 227, 0.5); grid-column: 1/-1;">No custom presets saved</p>';
            return;
        }
        
        list.innerHTML = presets.map((preset, index) => `
            <div class="preset-card">
                <div class="preset-icon">💾</div>
                <h3>${preset.name}</h3>
                <p>Custom configuration</p>
                <div style="display: flex; gap: 8px; justify-content: center; margin-top: 12px;">
                    <button class="btn" style="padding: 6px 12px; font-size: 0.75em;" onclick="applyPreset('custom_${index}')">
                        <i class="fas fa-play"></i> Apply
                    </button>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.75em;" onclick="deleteCustomPreset(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load custom presets', e);
    }
}

// Delete custom preset
async function deleteCustomPreset(index) {
    if (!confirm('Delete this preset?')) {
        return;
    }
    
    try {
        await fetch(`/custom-presets/${index}`, { method: 'DELETE' });
        loadCustomPresets();
    } catch (e) {
        alert('Failed to delete preset');
    }
}

// Search background from entire Pexels catalog
let currentSearchKeyword = '';
let currentPage = 1;
let totalResults = 0;

async function searchBackground(page = 1) {
    // Use stored keyword if navigating pages, otherwise get from input
    let keyword;
    if (page > 1 && currentSearchKeyword) {
        keyword = currentSearchKeyword;
    } else {
        keyword = document.getElementById('bgSearchKeyword').value.trim();
        if (!keyword) {
            alert('Please enter a search keyword');
            return;
        }
        currentSearchKeyword = keyword;
    }
    
    currentPage = page;
    
    const resultsDiv = document.getElementById('bgSearchResults');
    const infoDiv = document.getElementById('bgSearchInfo');
    const paginationDiv = document.getElementById('bgPagination');
    
    resultsDiv.innerHTML = '<p style="text-align: center; color: rgba(227, 227, 227, 0.6); grid-column: 1/-1;">Searching Pexels...</p>';
    infoDiv.innerHTML = '';
    paginationDiv.innerHTML = '';
    
    try {
        const res = await fetch(`/search-background?keyword=${encodeURIComponent(keyword)}&page=${page}`);
        const data = await res.json();
        
        console.log('Search response:', data);
        
        if (data.error) {
            resultsDiv.innerHTML = `<p style="text-align: center; color: #ea4335; grid-column: 1/-1;">Error: ${data.error}</p>`;
            infoDiv.innerHTML = `<span style="color: #ea4335;">API Error - Try again or use a different search term</span>`;
            return;
        }
        
        if (!data.photos || data.photos.length === 0) {
            resultsDiv.innerHTML = `<p style="text-align: center; color: rgba(227, 227, 227, 0.5); grid-column: 1/-1;">
                No results found for "${keyword}".<br>
                <small>Try: different spelling, broader terms, or check if it's a common subject</small>
            </p>`;
            infoDiv.innerHTML = `<span style="color: rgba(227, 227, 227, 0.5);">0 results found</span>`;
            return;
        }
        
        totalResults = data.total_results;
        const totalPages = Math.ceil(totalResults / data.per_page);
        
        // Show search info
        infoDiv.innerHTML = `Found ${totalResults.toLocaleString()} images for "${keyword}" - Page ${page} of ${totalPages}`;
        
        // Show results
        resultsDiv.innerHTML = data.photos.map((photo, index) => `
            <div style="cursor: pointer; border-radius: 8px; overflow: hidden; border: 2px solid rgba(227, 227, 227, 0.1); transition: all 0.2s; position: relative;" 
                 onclick="setSearchedBackground('${photo.url}')"
                 onmouseover="this.style.borderColor='#e3e3e3'; this.style.transform='scale(1.05)'"
                 onmouseout="this.style.borderColor='rgba(227, 227, 227, 0.1)'; this.style.transform='scale(1)'">
                <img src="${photo.thumb}" style="width: 100%; height: 120px; object-fit: cover;" alt="Background ${index + 1}">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); padding: 4px; font-size: 0.7em; text-align: center;">
                    📷 ${photo.photographer}
                </div>
            </div>
        `).join('');
        
        // Show pagination
        if (totalPages > 1) {
            let paginationHTML = '';
            
            // Previous button
            if (page > 1) {
                paginationHTML += `<button class="btn" style="padding: 8px 16px; font-size: 0.8em;" onclick="searchBackground(${page - 1})">
                    <i class="fas fa-chevron-left"></i> Previous
                </button>`;
            }
            
            // Page numbers (show 5 at a time)
            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(totalPages, page + 2);
            
            if (startPage > 1) {
                paginationHTML += `<button class="btn-preset" style="padding: 8px 12px; font-size: 0.8em;" onclick="searchBackground(1)">1</button>`;
                if (startPage > 2) {
                    paginationHTML += `<span style="padding: 8px;">...</span>`;
                }
            }
            
            for (let i = startPage; i <= endPage; i++) {
                if (i === page) {
                    paginationHTML += `<button class="btn" style="padding: 8px 12px; font-size: 0.8em; background: #4285f4; color: white;">${i}</button>`;
                } else {
                    paginationHTML += `<button class="btn-preset" style="padding: 8px 12px; font-size: 0.8em;" onclick="searchBackground(${i})">${i}</button>`;
                }
            }
            
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    paginationHTML += `<span style="padding: 8px;">...</span>`;
                }
                paginationHTML += `<button class="btn-preset" style="padding: 8px 12px; font-size: 0.8em;" onclick="searchBackground(${totalPages})">${totalPages}</button>`;
            }
            
            // Next button
            if (page < totalPages) {
                paginationHTML += `<button class="btn" style="padding: 8px 16px; font-size: 0.8em;" onclick="searchBackground(${page + 1})">
                    Next <i class="fas fa-chevron-right"></i>
                </button>`;
            }
            
            paginationDiv.innerHTML = paginationHTML;
        }
        
    } catch (e) {
        console.error('Search error:', e);
        resultsDiv.innerHTML = '<p style="text-align: center; color: #ea4335; grid-column: 1/-1;">Search failed. Please try again.</p>';
    }
}

async function setSearchedBackground(url) {
    try {
        await fetch('/set-background', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preset: url })
        });
        alert('✓ Background updated!');
    } catch (e) {
        alert('Failed to set background');
    }
}

// Save personalisation settings
async function savePersonalisationSettings() {
    const greetingName = document.getElementById('greetingName').value.trim();
    const weatherLocation = document.getElementById('weatherLocation').value.trim();
    try {
        await fetch('/extra-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ greetingName, weatherLocation })
        });
        alert('✓ Personalisation saved!');
    } catch (e) {
        alert('Failed to save personalisation settings');
    }
}

// Save background settings
async function saveBackgroundSettings() {
    const backgroundQuery = document.getElementById('bgDefaultQuery').value.trim() || 'nature';
    const opacity = document.getElementById('bgOpacity').value;
    try {
        await fetch('/bg-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: backgroundQuery, opacity: parseFloat(opacity) })
        });
        alert('✓ Background settings saved!');
    } catch (e) {
        alert('Failed to save background settings');
    }
}

// === SCREENSAVER FUNCTIONS ===

async function loadScreensaverSettings() {
    try {
        const res = await fetch('/screensaver-settings');
        const settings = await res.json();
        
        document.getElementById('screensaverEnabled').checked = settings.enabled;
        document.getElementById('screensaverSpeed').value = settings.speed;
        document.getElementById('speedLabel').textContent = settings.speed;
        document.getElementById('screensaverAnimation').value = settings.animation;
        document.getElementById('screensaverShowTime').checked = settings.showTime;
        document.getElementById('screensaverTimeFormat').value = settings.timeFormat;
        document.getElementById('screensaverAutoStart').value = settings.autoStartAfter;
        
        await renderScreensaverGallery();
    } catch (e) {
        console.error('Failed to load screensaver settings', e);
    }
}

async function saveScreensaverSettings() {
    try {
        const settings = {
            enabled: document.getElementById('screensaverEnabled').checked,
            speed: parseInt(document.getElementById('screensaverSpeed').value),
            animation: document.getElementById('screensaverAnimation').value,
            showTime: document.getElementById('screensaverShowTime').checked,
            timeFormat: document.getElementById('screensaverTimeFormat').value,
            autoStartAfter: parseInt(document.getElementById('screensaverAutoStart').value)
        };
        
        await fetch('/screensaver-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        
        console.log('✓ Screensaver settings saved');
    } catch (e) {
        console.error('Failed to save screensaver settings', e);
    }
}

async function uploadScreensaverPhotos() {
    const input = document.getElementById('screensaverPhotoInput');
    if (!input.files || input.files.length === 0) {
        alert('Please select photos first');
        return;
    }
    
    const formData = new FormData();
    for (let i = 0; i < input.files.length; i++) {
        formData.append('photos', input.files[i]);
    }
    
    try {
        const res = await fetch('/screensaver-upload', {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            alert(`✓ ${input.files.length} photo(s) uploaded!`);
            input.value = '';
            await renderScreensaverGallery();
            await loadGalleryImages();
        } else {
            alert('Failed to upload photos');
        }
    } catch (e) {
        console.error('Upload failed', e);
        alert('Upload error');
    }
}

async function renderScreensaverGallery() {
    try {
        const res = await fetch('/screensaver-images');
        const data = await res.json();
        const list = document.getElementById('screensaverGalleryList');
        
        if (!data.images || data.images.length === 0) {
            list.innerHTML = '<div style=\"grid-column: 1/-1; text-align: center; color: rgba(227, 227, 227, 0.6); padding: 30px;\">No photos uploaded yet</div>';
            return;
        }
        
        list.innerHTML = data.images.map(img => `
            <div style=\"position: relative; background: #222; border-radius: 4px; overflow: hidden; aspect-ratio: 1;\">
                <img src=\"${img.url}\" alt=\"\" style=\"width: 100%; height: 100%; object-fit: cover;\">
                <button class=\"btn btn-danger\" onclick=\"deleteScreensaverImage('${img.name}')\" style=\"position: absolute; top: 5px; right: 5px; padding: 4px 8px; font-size: 0.8em;\">
                    <i class=\"fas fa-trash\"></i>
                </button>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to render gallery', e);
    }
}

async function deleteScreensaverImage(filename) {
    if (!confirm(`Delete ${filename}?`)) return;
    
    try {
        const res = await fetch(`/screensaver-images/${filename}`, {
            method: 'DELETE'
        });
        
        if (res.ok) {
            await renderScreensaverGallery();
            await loadGalleryImages();
        } else {
            alert('Failed to delete image');
        }
    } catch (e) {
        console.error('Delete failed', e);
    }
}

async function deleteAllScreensaverImages() {
    if (!confirm('Delete ALL photos? This cannot be undone!')) return;
    
    try {
        const res = await fetch('/screensaver-images-all', {
            method: 'DELETE'
        });
        
        if (res.ok) {
            await renderScreensaverGallery();
            await loadGalleryImages();
            alert('✓ All photos deleted!');
        } else {
            alert('Failed to delete photos');
        }
    } catch (e) {
        console.error('Delete all failed', e);
    }
}

// Update speed label when slider changes
document.addEventListener('DOMContentLoaded', () => {
    const speedSlider = document.getElementById('screensaverSpeed');
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            document.getElementById('speedLabel').textContent = e.target.value;
        });
    }
});
    const backgroundRefreshInterval = parseInt(document.getElementById('bgRefreshInterval').value);
    const backgroundDim = parseInt(document.getElementById('bgDimSlider').value);
    const backgroundBlur = parseInt(document.getElementById('bgBlurSlider').value);
    try {
        await fetch('/extra-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backgroundQuery, backgroundRefreshInterval, backgroundDim, backgroundBlur })
        });
        alert('✓ Background settings saved!');
    } catch (e) {
        alert('Failed to save background settings');
    }
}

// Save theme settings
async function saveThemeSettings() {
    const accentColor = document.getElementById('accentColor').value;
    const fontFamily = document.getElementById('fontFamily').value;
    try {
        await fetch('/extra-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accentColor, fontFamily })
        });
        alert('✓ Theme saved!');
    } catch (e) {
        alert('Failed to save theme settings');
    }
}

// Load extra settings and populate fields
async function loadExtraSettings() {
    try {
        const res = await fetch('/extra-settings');
        const data = await res.json();
        if (data.greetingName !== undefined) document.getElementById('greetingName').value = data.greetingName;
        if (data.weatherLocation !== undefined) document.getElementById('weatherLocation').value = data.weatherLocation;
        if (data.backgroundQuery) document.getElementById('bgDefaultQuery').value = data.backgroundQuery;
        if (data.backgroundRefreshInterval !== undefined) document.getElementById('bgRefreshInterval').value = data.backgroundRefreshInterval;
        if (data.backgroundDim !== undefined) {
            document.getElementById('bgDimSlider').value = data.backgroundDim;
            document.getElementById('bgDimValue').textContent = data.backgroundDim;
        }
        if (data.backgroundBlur !== undefined) {
            document.getElementById('bgBlurSlider').value = data.backgroundBlur;
            document.getElementById('bgBlurValue').textContent = data.backgroundBlur;
        }
        if (data.accentColor) document.getElementById('accentColor').value = data.accentColor;
        if (data.fontFamily) document.getElementById('fontFamily').value = data.fontFamily;
    } catch (e) {
        console.error('Failed to load extra settings', e);
    }
}

// Load display settings and populate fields
async function loadDisplaySettings() {
    try {
        const res = await fetch('/display-settings');
        const data = await res.json();
        if (data.clockFormat) document.getElementById('clockFormat').value = data.clockFormat;
        if (data.dateFormat) document.getElementById('dateFormat').value = data.dateFormat;
        if (data.tempUnit) document.getElementById('tempUnit').value = data.tempUnit;
        if (data.showTodos !== undefined) document.getElementById('showTodos').checked = data.showTodos;
        if (data.showEvents !== undefined) document.getElementById('showEvents').checked = data.showEvents;
    } catch (e) {
        console.error('Failed to load display settings', e);
    }
}



// Initialize
loadScreenConfig();
loadCustomPresets();
loadExtraSettings();
loadDisplaySettings();
