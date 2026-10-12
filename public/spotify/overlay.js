// Escapes text coming from Spotify / TikTok viewers before it is put into innerHTML
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 1. Parse Params & Setup Debug
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const debugMode = params.get('debug') === 'true';
const serverUrl = params.get('server'); // Allow forcing socket URL

// 2. Visual Debug & Logger (Immediate)
let debugEl = null;

if (debugMode) {
    debugEl = document.createElement('div');
    debugEl.style.position = 'fixed';
    debugEl.style.top = '0';
    debugEl.style.left = '0';
    debugEl.style.color = 'lime';
    debugEl.style.background = 'rgba(0,0,0,0.85)';
    debugEl.style.padding = '10px';
    debugEl.style.zIndex = '99999';
    debugEl.style.fontSize = '12px';
    debugEl.style.fontFamily = 'monospace';
    debugEl.style.pointerEvents = 'none';
    debugEl.style.maxWidth = '350px';
    debugEl.innerHTML = `
        <div style="border-bottom: 1px solid #444; margin-bottom: 5px; padding-bottom: 5px;">
            <b>Status:</b> <span id="debug-socket-status">DISCONNECTED</span><br>
            <b>Last Update:</b> <span id="debug-last-update">Never</span><br>
            <b>Token:</b> ${token ? token.substring(0, 8) : 'MISSING'}
        </div>
        <div id="debug-logs" style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column;"></div>
    `;
    document.body.appendChild(debugEl);
}

function log(msg) {
    console.log(msg);
    if (debugMode && debugEl) {
        const logsContainer = document.getElementById('debug-logs');
        if (logsContainer) {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.style.marginBottom = '2px';
            logEntry.innerText = `[${timestamp}] ${msg}`;
            logsContainer.prepend(logEntry);
            if (logsContainer.childNodes.length > 50) logsContainer.removeChild(logsContainer.lastChild);
        }
    }
}

function updateDebugStatus(status) {
    const el = document.getElementById('debug-socket-status');
    if (el) {
        el.innerText = status;
        el.style.color = status === 'CONNECTED' ? 'lime' : 'orange';
    }
}

function updateDebugLastTime() {
    const el = document.getElementById('debug-last-update');
    if (el) {
        el.innerText = new Date().toLocaleTimeString();
        el.style.color = 'lime';
    }
}

// 3. Global Error Handler (Top Priority)
window.onerror = function (msg, url, lineNo, columnNo, error) {
    const errorMsg = `🚨 Global Error: ${msg} at line ${lineNo}:${columnNo}`;
    log(errorMsg);
    return false;
};

// 4. Socket Initialization
let socket;
try {
    if (typeof io === 'undefined') {
        throw new Error("Socket.IO client library not loaded! Check network or server.");
    }

    log(`🔌 Connecting to ${serverUrl || 'Origin'}...`);
    // Connect to specific server if provided, else origin
    socket = serverUrl ? io(serverUrl) : io();

    socket.on('connect', () => {
        log('✅ Connected to Socket.io');
        updateDebugStatus('CONNECTED');
        if (token) {
            log(`🔑 Identifying with token: ${token.substring(0, 8)}...`);
            socket.emit('identify', { token, type: 'overlay' });
        } else {
            log('❌ No token found in URL');
        }
    });

    socket.on('disconnect', () => {
        log('❌ Disconnected');
        updateDebugStatus('DISCONNECTED');
    });
    socket.on('connect_error', (err) => {
        log(`🚨 Connection Error: ${err.message}`);
        updateDebugStatus('CONN_ERROR');
    });

} catch (e) {
    log(`💥 CRITICAL INIT ERROR: ${e.message}`);
}

const playerEl = document.getElementById('player');
const queueWrapper = document.getElementById('queue-wrapper');
const queueList = document.getElementById('queue-list');
const albumArt = document.getElementById('albumArt');
const titleEl = document.getElementById('title');
const artistEl = document.getElementById('artist');
const requesterEl = document.getElementById('requester');
const currTimeEl = document.getElementById('curr-time');
const totalTimeEl = document.getElementById('total-time');
const progressFill = document.getElementById('progress-fill');

const colorThief = new ColorThief();
if (albumArt) {
    albumArt.crossOrigin = "anonymous";
    albumArt.onload = () => {
        try {
            const color = colorThief.getColor(albumArt);
            const r = color[0], g = color[1], b = color[2];

            // Update CSS variables
            const root = document.documentElement;
            root.style.setProperty('--primary-red', `rgb(${r}, ${g}, ${b})`);
            root.style.setProperty('--bg-dark', `rgba(${Math.max(0, r - 50)}, ${Math.max(0, g - 50)}, ${Math.max(0, b - 50)}, 0.85)`);

            // Also update shadows and glows
            if (playerEl) playerEl.style.setProperty('--glow-color', `rgba(${r}, ${g}, ${b}, 0.5)`);
        } catch (e) {
            console.error("ColorThief Error:", e);
        }
    };
}


let lastData = {
    trackId: null,
    queueJson: null,
    isPlaying: false
};

// [FIX] Ensure overlay is hidden on initial load
if (playerEl) playerEl.classList.add('hidden');
if (queueWrapper) queueWrapper.classList.add('hidden');
log('🎬 Overlay initialized - hidden by default');

socket.on('overlayUpdate', data => {
    log(`🎵 Received Update: ${data.isPlaying ? 'Playing' : 'Stopped'}`);
    updateDebugLastTime();

    // [FIX] Handle Player Visibility
    if (playerEl) {
        if (data.isPlaying && playerEl.classList.contains('hidden')) {
            playerEl.classList.remove('hidden');
            log('✅ Player shown - music is playing');
        } else if (!data.isPlaying && !playerEl.classList.contains('hidden')) {
            playerEl.classList.add('hidden');
            log('❌ Player hidden - no music');
        }
    }

    // [FIX] Update local state for isPlaying
    lastData.isPlaying = data.isPlaying;

    if (!data.isPlaying && !data.queue) {
        // [FIX] If stopped and no queue provided, we can stop here
        // But we should still allow the queue to stay if it was already there?
        // Actually, server now sends queue even if stopped.
        if (queueWrapper && !queueWrapper.classList.contains('hidden')) {
            queueWrapper.classList.add('hidden');
        }
        return;
    }

    // [FIX] Reset auto-hide timeout - if we don't receive updates for 10s, hide the overlay
    if (window.autoHideTimeout) clearTimeout(window.autoHideTimeout);
    window.autoHideTimeout = setTimeout(() => {
        if (playerEl && !playerEl.classList.contains('hidden')) {
            playerEl.classList.add('hidden');
            log('⏱️ Auto-hide: No updates received for 10s');
        }
        if (queueWrapper && !queueWrapper.classList.contains('hidden')) {
            queueWrapper.classList.add('hidden');
        }
    }, 10000); // 10 seconds

    if (data.isPlaying && data.current) {
        if (data.current.id !== lastData.trackId) {
            lastData.trackId = data.current.id;

            if (titleEl) titleEl.innerText = data.current.title;
            if (artistEl) artistEl.innerText = data.current.artist;

            if (requesterEl) {
                if (data.current.requestedBy) {
                    requesterEl.innerText = (window.Gentok ? window.Gentok.t('spotify.requestedBy', { name: data.current.requestedBy }) : `Demandé par ${data.current.requestedBy}`);
                    requesterEl.classList.remove('hidden');
                } else {
                    requesterEl.classList.add('hidden');
                }
            }

            if (albumArt && data.current.albumArt && albumArt.src !== data.current.albumArt) {
                albumArt.src = data.current.albumArt;
            }

            if (totalTimeEl) totalTimeEl.innerText = format(data.current.duration);
        }

        // Always update progress (smooth)
        const percent = (data.current.progress / data.current.duration) * 100;
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (currTimeEl) currTimeEl.innerText = format(data.current.progress);
    }

    // Only update queue if content changed
    const queueJson = JSON.stringify(data.queue);
    const hasQueue = data.queue && data.queue.length > 0;

    if (queueWrapper && queueList) {
        // [FIX] Ensure queue is shown if items exist, even if content hasn't changed
        if (hasQueue) {
            if (queueWrapper.classList.contains('hidden')) {
                queueWrapper.classList.remove('hidden');
                log('✅ Queue shown (items detected)');
            }
        } else {
            if (!queueWrapper.classList.contains('hidden')) {
                queueWrapper.classList.add('hidden');
                log('❌ Queue hidden (empty)');
            }
        }

        // Only redraw list if content changed
        if (queueJson !== lastData.queueJson) {
            lastData.queueJson = queueJson;
            queueList.innerHTML = '';
            data.queue.forEach(track => {
                const div = document.createElement('div');
                div.className = 'queue-track';
                div.innerHTML = `
                    <div class="queue-track-info">
                        <span class="queue-title">${escapeHtml(track.title)}</span>
                        <span class="queue-artist">${escapeHtml(track.artist)}</span>
                    </div>
                    <div class="queue-requested">${escapeHtml(track.requestedBy || 'Bot')}</div>
                `;
                queueList.appendChild(div);
            });
        }
    }
});

socket.on('skipVoteUpdate', data => {
    const skipNotif = document.getElementById('skip-notification');
    if (!skipNotif) return;

    const skipUser = document.getElementById('skip-user');
    const skipLabel = skipNotif.querySelector('.skip-label');
    const skipContent = skipNotif.querySelector('.skip-content');

    if (skipUser) skipUser.innerText = `${data.current} / ${data.required}`;
    if (skipLabel) skipLabel.innerText = "VOTES POUR SKIP";

    skipNotif.classList.remove('hidden');
    if (skipContent) skipContent.classList.remove('skip-exit');

    // Auto-hide after 2 seconds if no more votes
    if (window.voteTimeout) clearTimeout(window.voteTimeout);
    window.voteTimeout = setTimeout(() => {
        if (skipContent) skipContent.classList.add('skip-exit');
        setTimeout(() => {
            skipNotif.classList.add('hidden');
            // Reset label for next real skip
            if (skipLabel) skipLabel.innerText = "MUSIQUE SKIPPÉE PAR";
        }, 500);
    }, 2000);
});

socket.on('trackSkipped', data => {
    const skipNotif = document.getElementById('skip-notification');
    const skipUser = document.getElementById('skip-user');
    const skipContent = skipNotif ? skipNotif.querySelector('.skip-content') : null;
    const flashOverlay = document.getElementById('flash-overlay');

    // Trigger Flash
    if (flashOverlay) {
        flashOverlay.classList.remove('flash-active');
        void flashOverlay.offsetWidth; // Trigger reflow
        flashOverlay.classList.add('flash-active');
    }

    // Trigger Shake on Player
    if (playerEl) {
        playerEl.classList.remove('shake-skip');
        void playerEl.offsetWidth; // Trigger reflow
        playerEl.classList.add('shake-skip');
    }

    // Show Notification Card
    if (skipNotif && skipUser && skipContent) {
        skipUser.innerText = data.userName;
        skipNotif.classList.remove('hidden');
        skipContent.classList.remove('skip-exit');
    }

    // Remove shake classes after animation ends
    setTimeout(() => {
        if (playerEl) playerEl.classList.remove('shake-skip');
    }, 600);

    // Auto-hide card after 3 seconds
    if (skipNotif && skipContent) {
        setTimeout(() => {
            skipContent.classList.add('skip-exit');
            setTimeout(() => {
                skipNotif.classList.add('hidden');
                if (flashOverlay) flashOverlay.classList.remove('flash-active');
            }, 500);
        }, 3000);
    }
});

function format(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}
