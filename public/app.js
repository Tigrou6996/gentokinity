let currentActions = [];
let currentEvents = [];
const CURRENT_VERSION = '1.0.5'; // [VERSION] Update this for each release
const version = Date.now(); // Cache busting version
let socket = null; // Will be initialized in init()
let isLocalMode = false;
let lastSessionStats = null;
let isAdmin = false;
let isPremiumUser = false; // Added global premium state
let activeSceneId = null; // Added active scene tracking
let userScenes = []; // Added global scenes tracking
let userToken = ''; // [NEW] Global token storage
let currentTopCoinsStyle = 1;
let currentTopLikesStyle = 1;
const LEADERBOARD_STYLES_COUNT = 8;
const PRODUCTION_URL = 'https://tiktok.gentok.fr';

// [NEW] Token management helpers
function getToken() {
    if (!userToken) {
        userToken = localStorage.getItem('gentok_token') || '';
    }
    return userToken;
}

function setToken(token) {
    userToken = token;
    if (token) {
        localStorage.setItem('gentok_token', token);
    } else {
        localStorage.removeItem('gentok_token');
    }
}

// Preset Content Editor State
let isPresetEditMode = false;
let editingPresetId = null;
let backupConfig = null;

// [PREMIUM UI] Toast & Notification System
const pfpCache = JSON.parse(localStorage.getItem('gentok_pfp_cache') || '{}');
function savePfp(uniqueId, url) {
    if (!uniqueId || !url || url.includes('tiktokcdn.com') || url.includes('default-avatar')) return;
    pfpCache[uniqueId.toLowerCase()] = url;
    // Limit cache size to 500 users
    const keys = Object.keys(pfpCache);
    if (keys.length > 500) delete pfpCache[keys[0]];
    localStorage.setItem('gentok_pfp_cache', JSON.stringify(pfpCache));
}
function getPfp(uniqueId, fallback) {
    return pfpCache[uniqueId?.toLowerCase()] || fallback;
}

const showToast = (message, type = 'success') => {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: 'rgba(15, 16, 18, 0.95)',
        color: '#fff',
        customClass: {
            popup: 'gentok-toast-popup',
            title: 'gentok-toast-title'
        },
        didOpen: (toast) => {
            toast.onmouseenter = Swal.stopTimer;
            toast.onmouseleave = Swal.resumeTimer;
        }
    });
    // plain text: toasts show server messages and viewers' nicknames, which must never be read as HTML
    Toast.fire({ icon: type, titleText: String(message ?? '') });
};

// [NEW] DISCORD RICH PRESENCE HELPER
function updateDiscordPresence() {
    if (!window.electronAPI || !window.electronAPI.updateRPC) return;

    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const isLive = isBotRunningUI();
    const username = document.getElementById('header-username')?.value || 'Utilisateur';

    const pageNames = {
        'dashboard': 'Tableau de bord',
        'presets': 'Scènes & Presets',
        'actions': 'Actions & Keyboard',
        'events': 'Événements & Filtres',
        'sounds': 'Sonothèque',
        'overlays': 'Overlays & Widgets',
        'history': 'Historique des lives',
        'stats': 'Statistiques',
        'settings': 'Paramètres',
        'admin': 'Administration',
        'minecraft': 'Gentok Box Minecraft'
    };

    const details = pageNames[hash] || 'Navigation...';
    let state = 'Prêt à lancer le live';

    if (isLive) {
        state = `🔴 EN DIRECT : ${username}`;
    }

    window.electronAPI.updateRPC({
        details: details,
        state: state,
        smallImageKey: isLive ? 'live' : undefined,
        smallImageText: isLive ? 'En direct' : undefined
    });
}

const showNotify = (title, message, type = 'info') => {
    Swal.fire({
        titleText: String(title ?? '').toUpperCase(),
        text: message,
        icon: type,
        background: '#0a0b0d',
        color: '#fff',
        confirmButtonColor: 'var(--primary)',
        customClass: {
            popup: 'gentok-premium-popup',
            confirmButton: 'gentok-btn-confirm'
        }
    });
};

const showConfirm = async (title, text, confirmText = 'OUI, CONTINUER') => {
    const result = await Swal.fire({
        title: title.toUpperCase(),
        text,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: 'var(--primary)',
        cancelButtonColor: 'rgba(255,255,255,0.05)',
        confirmButtonText: confirmText,
        cancelButtonText: 'ANNULER',
        background: '#0a0b0d',
        color: '#fff',
        customClass: {
            popup: 'gentok-premium-popup',
            confirmButton: 'gentok-btn-confirm',
            cancelButton: 'gentok-btn-cancel'
        }
    });
    return result.isConfirmed;
};

// [PREMIUM UI] Toast & Notification System
// Removed local handleSoundUpload to avoid duplication

// UI Elements
const actionsTable = document.querySelector('#actions-table tbody');
const eventsTable = document.querySelector('#events-table tbody');
const logConsole = document.querySelector('#log-console');
const btnStart = document.querySelector('#btn-start');
// const usernameInput = document.querySelector('#username-input'); // REMOVED

// Status Elements
const statGifts = document.querySelector('#stat-gifts');
const statLikes = document.querySelector('#stat-likes');
const statViews = document.querySelector('#stat-views');
const statCumulativeViews = document.querySelector('#stat-cumulative-views');
const statDiamonds = document.querySelector('#stat-diamonds');
const statusIndicator = document.querySelector('#status-indicator'); // Assuming you have one
const statusText = document.querySelector('#status-text');

// Escapes text coming from TikTok viewers / external APIs before it is put into innerHTML
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Bot state read from the Start button icon (its text is translated, so never compare the text)
function isBotRunningUI(includeConnecting = false) {
    const btn = document.querySelector('#btn-start');
    if (!btn) return false;
    return !!btn.querySelector(includeConnecting ? '.fa-stop, .fa-spinner' : '.fa-stop');
}

// [CONSOLE] Add log entry function
let logsCount = 0;
function addLog(msg, type = '') {
    if (!logConsole) return;
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    // text only: messages can contain viewers' nicknames (a nickname with "<" must not become HTML)
    div.innerHTML = `<span class="time">[${new Date().toLocaleTimeString()}]</span> ${escapeHtml(String(msg))}`;
    logConsole.prepend(div);

    // Limit console to 100 entries
    logsCount++;
    while (logConsole.children.length > 100) {
        logConsole.removeChild(logConsole.lastChild);
    }
}


async function init() {
    // Safety net: the dashboard never runs inside one of its own preview frames
    // (it would connect a second time and repeat sounds, alerts, TTS and history).
    try {
        if (window.top !== window && window.top.location.origin === window.location.origin && window.top.document.getElementById('tts-chat-section')) {
            document.documentElement.innerHTML = '';
            return;
        }
    } catch (e) { /* different origin: not our own frame */ }

    // The return from Stripe (?payment=success / cancel) is handled by premium.js

    // [DETECTION] Are we running in the Electron App?
    const urlParams = new URLSearchParams(window.location.search);
    const isAppUA = navigator.userAgent.toLowerCase().includes('electron');
    const isAppMode = urlParams.get('mode') === 'app' || isAppUA;

    if (isAppMode) {
        console.log(isAppUA ? '📱 App Mode (Electron) detected.' : '📱 App Mode (Web Forced) detected.');
        // [FIX] Default to local mode in App Mode for Smart Relay compatibility
        isLocalMode = true;
    } else {
        showDownloadButton();
    }

    try {
        const data = await fetchData();

        if (data && data.username) {
            // addLog(`👤 Profil détecté : ${data.username}`, 'info');
        }
    } catch (e) {
        console.error("❌ Pre-init FetchData failed:", e.message);
    }

    setupEventListeners();

    // Initial Socket Connection
    if (isLocalMode) {
        connectToLocal();
    } else {
        connectToRemote();
    }

    handleRouting();

    // [NEW] Font Customization System
    await fetchFonts();

    // [NEW] Pre-fetch presets to sync scene selector titles
    loadPresets();

    // Dynamic features
    fetchAnnouncements();
    initTTS(); // [TTS] Init TTS System
    checkUpdate();

    // Display actual version in footer - ONLY in Electron App
    const footer = document.getElementById('app-footer');
    if (window.electronAPI) {
        if (footer) footer.style.display = 'block';

        // Show App specific settings
        const appSettings = document.getElementById('general-app-settings');
        if (appSettings) appSettings.style.display = 'block';

        const btnRefresh = document.getElementById('btn-refresh-cookies');
        if (btnRefresh) {
            btnRefresh.onclick = async () => {
                const confirmed = await showConfirm(
                    'Réinitialiser la session ?',
                    'Cela va vider vos cookies et recharger l\'application. Vous devrez peut-être vous reconnecter.',
                    'Oui, rafraîchir'
                );

                if (confirmed) {
                    // [CLEANUP] Inform server of session end
                    const token = localStorage.getItem('gentok_token');
                    const base = getApiBase();
                    if (token) await fetch(`${base}/api/reset?token=${token}`, { method: 'POST' });

                    await window.electronAPI.clearAppSession();
                    window.location.reload();
                }
            };
        }

        window.electronAPI.getAppVersion().then(v => {
            const display = document.getElementById('app-version-display');
            if (display) display.textContent = `Gentok v${v}`;
        });
    } else {
        if (footer) footer.style.display = 'none';
    }

    // Sound Upload Handler
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
        fileInput.addEventListener('change', handleSoundUpload);
    }

    const uploadBtn = document.getElementById('btn-sb-upload');
    if (uploadBtn) {
        uploadBtn.onclick = () => fileInput.click();

        // Drag & Drop on the Upload button
        uploadBtn.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadBtn.style.background = 'rgba(254, 44, 85, 0.4)';
            uploadBtn.style.transform = 'scale(1.08)';
            uploadBtn.innerHTML = '<i class="fas fa-file-audio"></i> Déposer ici';
        });
        uploadBtn.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadBtn.style.background = '';
            uploadBtn.style.transform = '';
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload';
        });
        uploadBtn.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadBtn.style.background = '';
            uploadBtn.style.transform = '';
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) {
                await handleSoundUpload({ target: { files: [file] } });
            } else {
                showToast('⚠️ Veuillez déposer un fichier audio.', 'error');
            }
        });
    }

    // Login Form Handler
    const loginForm = document.getElementById('login-form');
    const loginOverlay = document.getElementById('login-overlay');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorDiv = document.getElementById('login-error');

            errorDiv.style.display = 'none';

            try {
                const base = getApiBase();
                const url = `${base}/api/login`;
                console.log('Fetching login URL:', url); // Debug log

                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const text = await res.text();
                console.log('Raw login response:', text); // Debug log

                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    console.error('JSON Parse Error. Raw response:', text);
                    throw new Error('Réponse serveur invalide (non-JSON)');
                }

                if (res.ok && data.success) {
                    // Store token, username and session auth flag
                    localStorage.setItem('gentok_token', data.token);
                    localStorage.setItem('gentok_username', data.username);
                    sessionStorage.setItem('gentok_authenticated', 'true');
                    isAdmin = data.isAdmin || false;

                    // Verify token with API
                    const verifyRes = await fetch(`${base}/api/verify-license?token=${data.token}`);
                    const verifyData = await verifyRes.json();

                    if (verifyData.error) {
                        errorDiv.textContent = verifyData.error;
                        errorDiv.style.display = 'block';
                        return;
                    }

                    // Hide login overlay and show dashboard
                    loginOverlay.style.display = 'none';
                    document.getElementById('dashboard-container').style.display = 'flex';

                    // Set username in header
                    const headerUsername = document.getElementById('header-username');
                    if (headerUsername) headerUsername.value = data.username;

                    // Initialize socket connection
                    initConnection();

                    // [FIX] Force reload to clean up state and ensure Premium UI is perfect
                    // The token is now in localStorage, so init() will catch it
                    showToast('Connexion réussie', 'Initialisation de l\'espace Gentok Pro...');
                    setTimeout(() => window.location.reload(), 800);
                } else {
                    errorDiv.textContent = data.error || 'Erreur de connexion';
                    errorDiv.style.display = 'block';
                }
            } catch (err) {
                console.error('Login error:', err);
                errorDiv.textContent = 'Impossible de se connecter au serveur';
                errorDiv.style.display = 'block';
            }
        });
    }

    // [NEW] Respect session authentication to avoid redirection loop while maintaining "fresh login per session"
    const isAuthenticated = sessionStorage.getItem('gentok_authenticated') === 'true';
    const hasToken = !!localStorage.getItem('gentok_token');

    if (!isAuthenticated || !hasToken) {
        // Show login if NOT authenticated in this session OR if token is missing
        const loginBox = document.getElementById('login-box');
        const splashLoader = document.getElementById('splash-loader');
        if (splashLoader) splashLoader.style.display = 'none';
        if (loginBox) loginBox.style.display = 'block';
        if (loginOverlay) loginOverlay.style.display = 'flex';
    } else {
        // Already authenticated in this tab session
        if (loginOverlay) loginOverlay.style.display = 'none';
        const dashContainer = document.getElementById('dashboard-container');
        if (dashContainer) dashContainer.style.display = 'flex';
    }

    // [PREMIUM] Load & Apply saved settings
    loadPremiumSettings();

    // [PREMIUM] Automation: Auto-Connect & Periodic Live Detection
    const triggerAutoConnect = async () => {
        const pSettings = JSON.parse(localStorage.getItem('gentok_premium_settings') || '{}');
        const isAuthenticated = sessionStorage.getItem('gentok_authenticated') === 'true';
        const hasToken = !!localStorage.getItem('gentok_token');
        const headerUsername = document.querySelector('#header-username');
        const username = headerUsername ? headerUsername.value.trim() : '';

        if (pSettings.autoConnect && isAuthenticated && hasToken && username && username !== '@pseudo' && username !== '0') {
            const isRunning = isBotRunningUI(true);
            if (!isRunning) {
                console.log('🤖 [AUTO-LIVE] Automated connection attempt...');
                await startBot(username, true);
            }
        }
    };

    // Initial check after 3s
    setTimeout(triggerAutoConnect, 3000);
    // Periodic check every 30s
    setInterval(triggerAutoConnect, 30000);
}

function initConnection() {
    // Initialize socket and fetch data using the global isLocalMode state
    if (isLocalMode) {
        connectToLocal();
    } else {
        connectToRemote();
    }
    // fetchData is already called in init(), no need to repeat here
    updateDiscordPresence();
}


// Custom Select Logic
window.toggleCustomSelect = (id) => {
    const wrapper = document.getElementById(id);
    if (!wrapper) return;

    // Close others
    document.querySelectorAll('.custom-select-wrapper').forEach(w => {
        if (w.id !== id) w.classList.remove('open');
    });

    wrapper.classList.toggle('open');
};

// Close custom selects when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
    }
});

// Initialize custom select interactions
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-option');
        if (option) {
            const wrapper = option.closest('.custom-select-wrapper');
            const selectId = wrapper.id.replace('cs-', '');
            const nativeSelect = document.getElementById(selectId);
            const value = option.getAttribute('data-value');
            const trigger = wrapper.querySelector('.custom-select-trigger span');

            // Update custom UI
            wrapper.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            trigger.innerHTML = option.innerHTML;
            wrapper.classList.remove('open');

            // Update native select
            if (nativeSelect) {
                nativeSelect.value = value;
                // Dispatch change event to trigger existing app logic
                nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });
});

window.selectCustomOption = (wrapperId, value, html) => {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;
    const selectId = wrapperId.replace('cs-', '');
    const nativeSelect = document.getElementById(selectId);
    const trigger = wrapper.querySelector('.custom-select-trigger span');

    // Update custom UI
    wrapper.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
    const option = wrapper.querySelector(`.custom-option[data-value="${value}"]`);
    if (option) option.classList.add('selected');
    if (html) trigger.innerHTML = html;
    wrapper.classList.remove('open');

    // Update native select
    if (nativeSelect) {
        nativeSelect.value = value;
        nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
};

window.syncCustomSelect = (selectId) => {
    const nativeSelect = document.getElementById(selectId);
    if (!nativeSelect) return;
    const wrapper = document.getElementById('cs-' + selectId);
    if (!wrapper) return;

    const value = nativeSelect.value;
    const option = wrapper.querySelector(`.custom-option[data-value="${value}"]`);
    const trigger = wrapper.querySelector('.custom-select-trigger span');

    if (option) {
        wrapper.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        trigger.innerHTML = option.innerHTML;
        trigger.style.opacity = '1';
    } else {
        // Reset to placeholder
        wrapper.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
        if (selectId === 'action-type') trigger.innerHTML = 'Choisir un type...';
        else if (selectId === 'event-trigger-type') trigger.innerHTML = 'Choisir un déclencheur...';
        trigger.style.opacity = '0.6';
    }
};

// Settings Tab Switching
window.switchSettingsTab = (tabId, btn) => {
    // Hide all tabs
    document.querySelectorAll('.settings-tab').forEach(t => t.style.display = 'none');
    // Deactivate all nav items
    document.querySelectorAll('.settings-nav .nav-item').forEach(n => n.classList.remove('active'));

    // Show target tab
    const target = document.getElementById(`settings-tab-${tabId}`);
    if (target) target.style.display = 'block';

    // Activate clicked button
    if (btn) btn.classList.add('active');
};

// Sound Library Logic
let currentSoundAudio = null; // For preview

window.openSoundLibrary = async () => {
    openModal('modal-sound');
    await fetchSounds();
};

async function fetchSounds(query = '') {
    const container = document.querySelector('#sound-list');
    if (!container) return; // Guard for different pages
    container.innerHTML = '<div class="loading-spinner">Chargement...</div>';

    try {
        // [LOCAL UPLOAD] Use local for sounds if available
        const base = isLocalMode ? getLocalApiBase() : getApiBase();
        const token = getToken();
        const url = new URL(`${base}/api/sounds`);
        if (query) url.searchParams.set('q', query);
        url.searchParams.set('token', token || '');

        const res = await fetch(url);
        const sounds = await res.json();
        renderSounds(sounds);
    } catch (e) {
        container.innerHTML = '<div class="error">Erreur de chargement des sons.</div>';
    }
}

function renderSounds(sounds) {
    const container = document.querySelector('#sound-list');
    if (!container) return;
    container.innerHTML = '';

    if (!sounds || sounds.length === 0) {
        container.innerHTML = '<div class="text-dim">Aucun son trouvé.</div>';
        return;
    }

    sounds.forEach(sound => {
        const el = document.createElement('div');
        el.className = 'sound-item';

        // Check if already used in an action
        const isUsed = currentActions.some(a => a.type === 'sound' && (a.soundUrl === sound.url || a.url === sound.url));

        const title = sound.title;
        const url = sound.url;
        const id = sound.id;

        // Escape content safely
        const safeTitle = title.replace(/'/g, "\\'");
        const safeUrl = normalizeUrl(url);

        el.innerHTML = `
            <div class="sound-icon-wrapper">
                ${sound.isLocal ? '<i class="fas fa-upload" style="color: var(--secondary); font-size: 0.7rem;"></i>' : '<i class="fas fa-music"></i>'}
            </div>
            <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
                <span class="sound-name" title="${title}">${title}</span>
                ${isUsed ? '<span class="badge" style="font-size:0.6rem; padding:2px 5px; width:fit-content; background:rgba(37, 244, 238, 0.1); color:var(--secondary); border:1px solid rgba(37, 244, 238, 0.2);">Déjà utilisé</span>' : ''}
            </div>
            <div class="sound-actions">
                <button class="btn-mini btn-mini-play" onclick="previewSound('${safeUrl}', this)">
                    <i class="fas fa-play"></i>
                </button>
                <button class="btn-mini btn-mini-select" onclick="selectSound('${safeTitle}', '${safeUrl}')">
                    Choisir
                </button>
            </div>
        `;
        container.appendChild(el);
    });
}

let currentPlayingBtn = null;

window.previewSound = (url, btn, volume) => {
    const resetAllPlayButtons = () => {
        document.querySelectorAll('.sound-item.playing').forEach(el => el.classList.remove('playing'));
        document.querySelectorAll('.btn-mini-play i, .btn-icon.preview i').forEach(icon => {
            icon.className = 'fas fa-play';
        });
        if (currentPlayingBtn) {
            delete currentPlayingBtn.dataset.playing;
            currentPlayingBtn = null;
        }
    };

    // If currently playing the same button, stop and return
    if (btn && btn.dataset.playing === 'true') {
        if (currentSoundAudio) {
            try { currentSoundAudio.pause(); } catch (e) { }
            currentSoundAudio = null;
        }
        resetAllPlayButtons();
        return;
    }

    // Stop previous sound if any
    if (currentSoundAudio) {
        try { currentSoundAudio.pause(); } catch (e) { }
        currentSoundAudio = null;
    }

    resetAllPlayButtons();

    if (!url || typeof url !== 'string' || !url.trim()) {
        showToast('Aucune URL audio disponible pour ce son', 'warning');
        return;
    }

    if (btn) {
        btn.dataset.playing = 'true';
        currentPlayingBtn = btn;
        const item = btn.closest('.sound-item');
        if (item) item.classList.add('playing');
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'fas fa-stop';
    }

    try {
        currentSoundAudio = new Audio(url);
        let vol = 0.8;
        if (volume !== undefined && volume !== null) {
            const parsedVol = parseFloat(volume);
            if (!isNaN(parsedVol)) {
                vol = parsedVol > 1 ? parsedVol / 100 : parsedVol;
            }
        }
        currentSoundAudio.volume = Math.max(0, Math.min(1, vol));

        currentSoundAudio.onended = () => {
            resetAllPlayButtons();
            currentSoundAudio = null;
        };

        currentSoundAudio.onerror = (err) => {
            console.error('[AUDIO] Erreur de lecture pour URL:', url, err);
            showToast('Impossible de lire ce fichier audio', 'error');
            resetAllPlayButtons();
            currentSoundAudio = null;
        };

        const playPromise = currentSoundAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                console.error('[AUDIO] Exception play():', err.message);
                showToast('Lecture audio bloquée ou lien invalide', 'error');
                resetAllPlayButtons();
                currentSoundAudio = null;
            });
        }
    } catch (err) {
        console.error('[AUDIO] Exception init:', err.message);
        showToast("Erreur d'initialisation du son", "error");
        resetAllPlayButtons();
        currentSoundAudio = null;
    }
};

window.previewSoundAction = (actionId, btn) => {
    const action = (currentActions || []).find(a => a.id === actionId);
    if (!action) {
        showToast("Action introuvable", "error");
        return;
    }
    const url = action.soundUrl || action.url || '';
    previewSound(url, btn, action.volume);
};

window.selectSound = async (title, url) => {
    // Populate quick sound form
    document.querySelector('#qs-sound-name').value = title;
    document.querySelector('#qs-sound-url').value = url;
    document.querySelector('#qs-display-name').value = title;

    // Reset trigger type to gift (default)
    document.querySelector('#qs-trigger-type').value = 'gift';
    syncCustomSelect('qs-trigger-type');

    // Show gift container by default
    updateQuickSoundTriggerFields();

    // Load gifts for selection
    await loadQuickSoundGifts();

    // Close sound library modal and open quick sound modal
    closeModal('modal-sound');
    openModal('modal-quick-sound');

    if (currentSoundAudio) currentSoundAudio.pause();
};

// Search Listener
// Search Listener
// Removed btn-search-sound click listener as the button was removed from HTML
const searchInput = document.querySelector('#sound-search');
if (searchInput) {
    // Add debounce for smoother search
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            fetchSounds(e.target.value);
        }, 300);
    });
}


function connectToRemote() {
    if (socket) socket.disconnect();
    console.log('🌐 Connecting to Remote VPS...');
    socket = io('https://tiktok.gentok.fr', {
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000
    });
    window.socket = socket; // [FIX] Expose to window for UI functions

    // [PROTECTION] Only set false if we are NOT in App Mode
    const urlParams = new URLSearchParams(window.location.search);
    const isAppUA = navigator.userAgent.toLowerCase().includes('electron');
    const isAppMode = (urlParams.get('mode') === 'app') || isAppUA;
    if (!isAppMode) {
        isLocalMode = false;
    }

    setupSocketListeners();
}

function connectToLocal() {
    if (socket) socket.disconnect();
    console.log('📡 Connecting to Local App Server...');

    // [SOCKET.IO PNA FIX]
    // Socket MUST be local in Local Mode, regardless of getApiBase()
    socket = io('http://localhost:3000', {
        reconnection: true,
        reconnectionDelay: 2000,
        timeout: 5000
    });
    window.socket = socket; // [FIX] Expose to window for UI functions

    // Mirror to global for legacy checks
    window.localAppSocket = socket;
    isLocalMode = true;

    setupSocketListeners();

    socket.on('connect_error', (err) => {
        console.warn('❌ Socket Connection Error (App Local):', err.message);

        // If we are strictly in App Mode, just keep retrying local
        const urlParams = new URLSearchParams(window.location.search);
        const isAppUA = navigator.userAgent.toLowerCase().includes('electron');
        const isAppMode = urlParams.get('mode') === 'app' || isAppUA;

        if (isAppMode) {
            console.log('🔌 Retrying Local in 3s...');
            return;
        }

        // If local fails on web, we fallback to remote to keep UI alive
        setTimeout(connectToRemote, 3000);
    });
}

// [NEW] Take Over Session Logic
window.takeOverSession = function () {
    const btn = document.getElementById('btn-take-over');
    if (socket) {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reprise...';
        }
        const token = localStorage.getItem('gentok_token');
        socket.emit('take_over', { token });
    }
};

// Socket Audio Playback Listener
function setupSocketListeners() {
    // Determine context for logging
    const contextName = isLocalMode ? 'App Local' : 'VPS Remote';

    socket.on('connect', () => {
        // console.log(`Socket Connected (${contextName}):`, socket.id);
        // addLog(`🔌 Connecté au serveur (${contextName})`, 'system');
        statusIndicator.classList.remove('offline');
        statusIndicator.classList.add('online');

        // [RELAY] Identify ourselves
        const token = localStorage.getItem('gentok_token');
        if (token) {
            socket.emit('identify', { token, type: 'dashboard' });
        }

        // Refresh data on connection
        onConnectionChange();
    });



    // [NEW] Duplicate Session Handlers
    socket.on('session_duplicate', () => {
        const modal = document.getElementById('modal-duplicate-session');
        const btn = document.getElementById('btn-take-over');
        if (modal) modal.style.display = 'flex';
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Prendre la main sur cette session';
        }
    });

    socket.on('force_disconnect', (data) => {
        const modal = document.getElementById('modal-duplicate-session');
        if (modal) {
            modal.style.display = 'flex';
            const title = modal.querySelector('h2');
            const p = modal.querySelector('p');
            const btn = modal.querySelector('#btn-take-over'); // Use specific ID or querySelector

            if (title) title.textContent = 'Session terminée';
            if (p) p.innerHTML = data.message || 'Session active ailleurs.';
            // Change button behavior since we are kicked out
            if (btn) {
                btn.textContent = 'Recharger la page';
                btn.onclick = () => window.location.reload();
                btn.disabled = false;
            }
        }
    });

    socket.on('session_active', () => {
        const modal = document.getElementById('modal-duplicate-session');
        if (modal) modal.style.display = 'none';
        console.log('✅ Session active confirmée !');
        // Re-enable interactions if needed
    });

    const soundQueue = [];
    let isPlayingSound = false;

    function processSoundQueue() {
        if (isPlayingSound || soundQueue.length === 0) return;
        isPlayingSound = true;
        const data = soundQueue.shift();

        const targetUrl = data.url || data.soundUrl;
        if (!targetUrl) {
            isPlayingSound = false;
            processSoundQueue();
            return;
        }

        const url = normalizeUrl(targetUrl);
        let vol = 0.8;
        if (typeof data.volume === 'number') {
            vol = data.volume > 1 ? data.volume / 100 : data.volume;
        }
        vol = Math.max(0, Math.min(1, vol));

        console.log(`🔊 [SOUNDBOARD QUEUE] Lecture audio (${soundQueue.length} en attente) : ${data.title || 'Son'} -> ${url}`);
        const audio = new Audio(url);
        audio.volume = vol;

        const onSoundFinish = () => {
            isPlayingSound = false;
            setTimeout(processSoundQueue, 100); // Fast 100ms pause between combo sounds
        };

        audio.onended = onSoundFinish;
        audio.onerror = (e) => {
            console.error('Audio play error:', e);
            onSoundFinish();
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.error('Audio play error:', e.message);
                onSoundFinish();
            });
        }
        if (typeof addLog === 'function') addLog(`🔊 Son joué : ${data.title || 'Soundboard'}`, 'info');
    }

    socket.on('play_audio', (data) => {
        if (!data) return;
        soundQueue.push(data);
        processSoundQueue();
    });

    // [ACTION] "Synthèse vocale" actions: read the text with the TTS voice settings
    socket.on('tts_speak', (data) => {
        if (!data || !data.text) return;
        if (typeof ttsQueue === 'undefined' || typeof processTTSQueue !== 'function') return;
        if (ttsQueue.length >= 20) return;
        ttsQueue.push({ text: String(data.text).slice(0, 300), user: data.user || 'action' });
        processTTSQueue();
    });

    // [TTS] Listen for chat
    socket.on('chat', (data) => {
        if (typeof handleChatForTTS === 'function') {
            handleChatForTTS(data);
        }
    });

    socket.on('connect_error', (err) => {
        console.error(`Socket Connection Error (${contextName}):`, err);
        // Don't log every error to avoid spam, or log only if not local detection
        if (!isLocalMode) {
            addLog(`❌ Erreur connexion socket : ${err.message}`, 'error');
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`Socket Disconnected (${contextName}): ${reason}`);
        addLog(`❌ Déconnecté du serveur (${contextName})`, 'error');
        updateStatus('offline');

        // Only fallback to remote if NOT in App Mode
        const urlParams = new URLSearchParams(window.location.search);
        const isAppUA = navigator.userAgent.toLowerCase().includes('electron');
        const isAppMode = urlParams.get('mode') === 'app' || isAppUA;

        if (isLocalMode && !isAppMode) {
            console.log('🔄 Lost Local connection, reverting to Remote...');
            setTimeout(connectToRemote, 2000);
        } else if (!isAppMode) { // Added this condition for remote fallback if not in app mode
            setTimeout(connectToRemote, 5000);
        }
    });

    // [NEW] Global Notification Listener
    socket.on('notification', (data) => {
        console.log('🔔 Notification received:', data);
        if (data.type === 'error') {
            showNotify(data.title || 'Erreur', data.message, 'error');
        } else if (data.type === 'success') {
            showToast(data.message, 'success');
        } else {
            showNotify(data.title || 'Info', data.message, 'info');
        }
    });

    // [NEW] Log Relay Listener
    // Server messages (Spotify requests, points, actions...) in the Console page, at most 20 per second
    let logBudget = 20;
    setInterval(() => { logBudget = 20; }, 1000);
    socket.on('log', (data) => {
        if (!data || !data.message || logBudget <= 0) return;
        logBudget--;
        addLog(String(data.message), ['error', 'warn', 'warning', 'success', 'system'].includes(data.level) ? data.level : 'info');
    });

    socket.on('status', (status) => {
        const oldStatus = document.getElementById('status-indicator')?.classList.contains('online') ? 'online' : 'offline';
        updateStatus(status);
        if (status === 'online') {
            btnStart.innerHTML = '<i class="fas fa-stop"></i><span>Arrêter</span>';
        } else {
            btnStart.innerHTML = '<i class="fas fa-play"></i><span>Connexion Live</span>';
            // Auto-refresh history if we just stopped
            if (oldStatus === 'online') {
                const statsSection = document.getElementById('stats-section');
                if (statsSection && statsSection.style.display !== 'none') {
                    renderStatsHistory();
                }
            }
        }
        updateDiscordPresence();
    });

    socket.on('stats', ({ type, data }) => {
        if (typeof handleEventForTTS === 'function') handleEventForTTS(type, data);
        // [MODIFIED] Using session_stats for counters, this event is now for per-event animations if needed
        if (type === 'gift') {
            playAlert('gift');
            showDesktopNotification('Nouveau Cadeau !', `${data.nickname} a envoyé ${data.giftName}`);
        } else if (type === 'follow') {
            playAlert('follow');
            showDesktopNotification('Nouvel Abonné !', `${data.nickname} vient de s'abonner`);
        } else if (type === 'viewers') {
            if (statViews) statViews.innerText = data;
        }
    });

    socket.on('session_stats', (stats) => {
        const currentViewers = (stats && stats.viewerCount !== undefined && stats.viewerCount !== null && !isNaN(stats.viewerCount)) ? stats.viewerCount : 0;
        if (statViews) statViews.innerText = currentViewers;
        if (statCumulativeViews) statCumulativeViews.innerText = stats.cumulativeViewers || 0;
        if (statDiamonds) statDiamonds.innerText = stats.diamonds;
        if (statGifts) statGifts.innerText = stats.gifts;
        if (statLikes) statLikes.innerText = stats.likes;

        const statFollows = document.querySelector('#stat-follows');
        if (statFollows) statFollows.innerText = stats.follows;

        const statShares = document.querySelector('#stat-shares');
        if (statShares) statShares.innerText = stats.shares;

        // Update Comparisons
        updateComparison('views', stats.viewerCount, 'viewerCountMax');
        updateComparison('cumulativeViews', stats.cumulativeViewers || 0, 'cumulativeViewers');
        updateComparison('diamonds', stats.diamonds);
        updateComparison('gifts', stats.gifts);
        updateComparison('likes', stats.likes);
        updateComparison('follows', stats.follows);
        updateComparison('shares', stats.shares);

        // Update Top Titles Inputs
        const topGiftInput = document.getElementById('topGiftTitleInput');
        if (topGiftInput && document.activeElement !== topGiftInput) {
            topGiftInput.value = (stats.topGift && stats.topGift.customTitle) ? stats.topGift.customTitle : '';
        }

        const topStreakInput = document.getElementById('topStreakTitleInput');
        if (topStreakInput && document.activeElement !== topStreakInput) {
            topStreakInput.value = (stats.topStreak && stats.topStreak.customTitle) ? stats.topStreak.customTitle : '';
        }

        // [FIX] Top Coins & Likes Inputs – only update if server sent these fields
        if (stats.topCoinsTitle !== undefined) {
            const topCoinsInput = document.getElementById('topCoinsTitleInput');
            if (topCoinsInput && document.activeElement !== topCoinsInput) {
                topCoinsInput.value = stats.topCoinsTitle || '';
            }
        }
        if (stats.topCoins !== undefined) {
            const topCoinsInput = document.getElementById('topCoinsTitleInput');
            if (topCoinsInput && document.activeElement !== topCoinsInput) {
                topCoinsInput.value = stats.topCoinsTitle || '';
            }
            // [NEW] Update PFP cache for all top coin users
            const users = Array.isArray(stats.topCoins) ? stats.topCoins : (stats.topCoins?.data || []);
            users.forEach(u => savePfp(u.uniqueId, u.profilePictureUrl));
        }
        if (stats.topLikesTitle !== undefined) {
            const topLikesInput = document.getElementById('topLikesTitleInput');
            if (topLikesInput && document.activeElement !== topLikesInput) {
                topLikesInput.value = stats.topLikesTitle || '';
            }
        }
        if (stats.topLikesLimit !== undefined) {
            const topLikesLimit = document.getElementById('topLikesLimitInput');
            if (topLikesLimit && document.activeElement !== topLikesLimit) {
                topLikesLimit.value = stats.topLikesLimit || 10;
            }
        }

        // [FONTS SYNC] Sync Font Selectors from Server State
        const syncFont = (id, font) => {
            const el = document.getElementById(id);
            if (el && font && el.value !== font && document.activeElement !== el) {
                el.value = font;
                el.setAttribute('data-font', font);
            }
        };
        if (stats.topGift?.font) syncFont('topGiftFont', stats.topGift.font);
        if (stats.topStreak?.font) syncFont('topStreakFont', stats.topStreak.font);
        if (stats.topCoinsFont) syncFont('topCoinsFont', stats.topCoinsFont);
        if (stats.topLikesFont) syncFont('topLikesFont', stats.topLikesFont);
    });

    // [NEW] Real-time leaderboard sync
    socket.on('leaderboard_sync', () => {
        // Debounce if needed, but table render is async
        if (document.getElementById('ranking-body')) {
            renderRankingTable();
        }
        if (document.getElementById('ranking-legends-container')) {
            renderRankingLegends();
        }
    });

    socket.on('lastEvent', (event) => {
        if (event && event.data && event.data.uniqueId && event.data.profilePictureUrl) {
            savePfp(event.data.uniqueId, event.data.profilePictureUrl);
        }
    });

    socket.on('notify', (data) => {
        if (data.type === 'follow') {
            // Optional: Add visual flare for follow
        }
    });

    socket.on('notification', (data) => {
        showNotify(data.title, data.message, data.type);
    });

    socket.on('overlayUpdate', (data) => {
        const art = document.getElementById('dash-spotify-art');
        const title = document.getElementById('dash-spotify-title');
        const artist = document.getElementById('dash-spotify-artist');
        const progress = document.getElementById('dash-spotify-progress');
        const reqBox = document.getElementById('dash-spotify-requester');
        const reqUser = document.getElementById('dash-spotify-user');
        const queueContainer = document.getElementById('dash-spotify-queue');

        if (data.isPlaying && data.current) {
            if (art) art.src = data.current.albumArt || 'https://gentok.fr/img/logo.png';
            if (title) title.innerText = data.current.title;
            if (artist) artist.innerText = data.current.artist;

            if (reqBox && reqUser) {
                if (data.current.requestedBy) {
                    reqUser.innerText = data.current.requestedBy;
                    reqBox.style.display = 'block';
                } else {
                    reqBox.style.display = 'none';
                }
            }

            if (progress) {
                const percent = (data.current.progress / data.current.duration) * 100;
                progress.style.width = `${percent}%`;
            }
        } else {
            if (title) title.innerText = 'Lecture en pause / Arrêté';
            if (artist) artist.innerText = 'Spotify Inactif';
            if (progress) progress.style.width = '0%';
        }

        if (queueContainer && data.queue) {
            if (data.queue.length === 0) {
                queueContainer.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-dim); font-style: italic; text-align: center; padding-top: 10px;">Vide</div>';
            } else {
                queueContainer.innerHTML = data.queue.map((t, i) => `
                    <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; display: flex; align-items: center; gap: 10px;">
                        <div style="width: 20px; height: 20px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: var(--text-dim); font-weight: 700;">${i + 1}</div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.75rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.title)}</div>
                            <div style="font-size: 0.65rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.artist)}</div>
                        </div>
                        ${t.requestedBy ? `<div style="font-size: 0.6rem; background: rgba(29, 185, 84, 0.1); color: #1DB954; padding: 2px 6px; border-radius: 4px;">${escapeHtml(t.requestedBy)}</div>` : ''}
                    </div>
                `).join('');
            }
        }
    });

    // [MUTUAL EXCLUSION] Hande Lock Event
    socket.on('force_lock', (data) => {
        // [FIX] Ignore lock command if we are running in the App (Local Mode)
        // because the App IS the source of truth and shouldn't lock itself.
        if (isLocalMode || window.electronAPI) {
            console.log('🛡️ Ignoring force_lock command (App Mode active)');
            return;
        }

        // [FIX] Ignore lock command if we are on the login screen
        const token = localStorage.getItem('gentok_token');
        if (!token) {
            console.log('🛡️ Ignoring force_lock command (Not logged in)');
            return;
        }

        console.warn('🔒 Application Locked:', data.message);
        showLockScreen(data.message);
        socket.disconnect(); // Disconnect to stop fighting
    });

    socket.on('sync_config', (config) => {
        console.log('🔄 Live config sync...');
        applyConfigUI(config);
    });

    // [REMOTE RCON] VPS relays Minecraft commands → App executes them locally
    socket.on('remote_rcon', async (data) => {
        const { command } = data;
        console.log(`[REMOTE_RCON] Event reçu via socket! Command: ${command}`);
        if (!command) { console.warn('[REMOTE_RCON] Commande vide!'); return; }
        if (window.electronAPI) {
            console.log(`[REMOTE_RCON] Envoi via electronAPI.sendMinecraftCommand...`);
            const result = await window.electronAPI.sendMinecraftCommand(command);
            console.log(`[REMOTE_RCON] Résultat:`, result);
        } else {
            console.log(`[REMOTE_RCON] Pas d'electronAPI, fallback HTTP ServerTap...`);
            try {
                const base = getLocalApiBase();
                const token = localStorage.getItem('gentok_token');
                const settingsRes = await fetch(`${base}/api/config?token=${token}`);
                const settings = await settingsRes.json();
                const mc = settings.minecraft;
                console.log(`[REMOTE_RCON] Settings MC:`, mc);
                if (mc && mc.host) {
                    await fetch(`http://${mc.host}:${mc.port || 4567}/v1/server/exec`, {
                        method: 'POST',
                        headers: { 'key': mc.password, 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: `command=${encodeURIComponent(command)}`
                    });
                    console.log(`[REMOTE_RCON] Commande envoyée via ServerTap HTTP`);
                }
            } catch (e) {
                console.error('[RCON Relay] Erreur:', e.message);
            }
        }
    });
}

// ===== LOCAL APP DETECTION =====
function initLocalAppDetection() {
    if (isLocalMode) return; // Already local

    const appGroup = document.querySelector('#app-status-group');
    const appStatusIndicator = document.querySelector('#app-status-indicator');
    const appStatusText = document.querySelector('#app-status-text');

    if (appGroup) appGroup.style.display = 'flex';

    // Try to connect to local WebSocket server
    console.log('🔍 Checking for Local App...');
    // [RE-ENABLED]
    const tempSocket = io('http://localhost:3000', {
        reconnection: false, // Don't retry indefinitely if not there
        timeout: 2000,
        autoConnect: true
    });

    tempSocket.on('connect', () => {
        console.log('✅ App Local DETECTED! Switching to Local Mode.');

        // Disconnect Remote
        if (socket) socket.disconnect();

        // [STRICT] Show Duplicate/Lock Modal because App is open (User requested strict message)
        const dupModal = document.getElementById('modal-duplicate-session');
        const dupTitle = dupModal ? dupModal.querySelector('h2') : null;
        const dupText = dupModal ? dupModal.querySelector('p') : null;
        const dupBtn = dupModal ? dupModal.querySelector('#btn-take-over') : null;

        if (dupModal) {
            dupModal.style.display = 'flex';
            if (dupTitle) dupTitle.innerText = "Application Détectée";
            if (dupText) dupText.innerHTML = "L'application Windows est ouverte.<br>Veuillez l'utiliser pour de meilleures performances.";
            // Hide 'Take Over' button since we are local and should use the app
            if (dupBtn) dupBtn.style.display = 'none';
        }

        // Promote Temp to Main (so we are technically connected, but UI is blocked by modal)
        socket = tempSocket;
        isLocalMode = true;

        // Re-bind listeners to new socket
        setupSocketListeners();

        // Update UI
        if (appStatusIndicator) appStatusIndicator.className = 'status online';
        if (appStatusText) appStatusText.innerText = 'Connectée (Mode Local)';

        onConnectionChange();
    });

    // Retry periodically if not found yet
    tempSocket.on('connect_error', () => {
        // If not connected locally, we just keep trying silently
        setTimeout(initLocalAppDetection, 5000);
    });
}

function showDownloadButton() {
    // The application badge (appstatus.js) already offers the download when the app is not detected
    if (window.GentokAppStatus) return;
    const downloadBtn = document.querySelector('#btn-download-app');
    if (!downloadBtn) {
        const header = document.querySelector('header .user-control');
        if (header) {
            const btn = document.createElement('a');
            btn.id = 'btn-download-app';
            btn.href = 'https://tiktok.gentok.fr/download';
            btn.className = 'btn-ghost';
            btn.style.color = 'var(--secondary)';
            btn.innerHTML = '<i class="fas fa-download"></i> <span>Télécharger App</span>';
            btn.title = "Nécessaire pour les actions Clavier (AutoIt)";
            header.prepend(btn);
        }
    } else {
        downloadBtn.style.display = 'flex';
    }
}

function updateStatus(status) {
    // If you have these elements in your HTML
    if (statusIndicator) {
        statusIndicator.className = `status ${status}`;
        statusText.innerText = status === 'online' ? 'Connecté' : 'Hors ligne';
    }
}

async function fetchData() {
    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const response = await fetch(`${base}/api/config?token=${token || ''}&t=${Date.now()}`);
        const config = await response.json();
        applyConfigUI(config);
    } catch (err) {
        addLog(`Erreur de chargement : ${err.message}`, 'error');
    }
}

// OBS connection settings (saved per account, used by "OBS Studio" actions)
let currentObsSettings = { host: '127.0.0.1', port: 4455, password: '' };
// Streamer.bot HTTP server settings (used by "Streamer.bot" actions)
let currentStreamerbotSettings = { host: '127.0.0.1', port: 7474 };

function readStreamerbotForm() {
    return {
        host: (document.querySelector('#f-sb-host')?.value || '127.0.0.1').trim(),
        port: parseInt(document.querySelector('#f-sb-port')?.value) || 7474
    };
}

async function saveStreamerbotSettingsFromForm() {
    const streamerbot = readStreamerbotForm();
    if (JSON.stringify(streamerbot) === JSON.stringify(currentStreamerbotSettings)) return;
    currentStreamerbotSettings = streamerbot;
    try {
        await fetch(`${getApiBase()}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: localStorage.getItem('gentok_token'), streamerbot })
        });
    } catch (e) { console.warn('Streamer.bot settings save failed', e); }
}

window.testStreamerbotConnection = async () => {
    const status = document.querySelector('#f-sb-status');
    if (status) { status.style.color = 'var(--text-dim)'; status.textContent = '⏳ Connexion à Streamer.bot...'; }
    try {
        const res = await fetch(`${getApiBase()}/api/streamerbot/test`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(readStreamerbotForm())
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Erreur');
        window.streamerbotActions = data.actions || [];
        const list = document.querySelector('#sb-action-list');
        if (list) list.innerHTML = window.streamerbotActions.map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.group)}</option>`).join('');
        if (status) { status.style.color = '#10b981'; status.textContent = `✅ Streamer.bot connecté — ${window.streamerbotActions.length} action(s)`; }
        saveStreamerbotSettingsFromForm();
    } catch (e) {
        if (status) { status.style.color = '#ef4444'; status.textContent = `❌ ${e.message}`; }
    }
};

function readObsSettingsForm() {
    return {
        host: (document.querySelector('#f-obs-host')?.value || '127.0.0.1').trim(),
        port: parseInt(document.querySelector('#f-obs-port')?.value) || 4455,
        password: document.querySelector('#f-obs-password')?.value || ''
    };
}

async function saveObsSettingsFromForm() {
    const obs = readObsSettingsForm();
    if (JSON.stringify(obs) === JSON.stringify(currentObsSettings)) return;
    currentObsSettings = obs;
    try {
        await fetch(`${getApiBase()}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: localStorage.getItem('gentok_token'), obs })
        });
    } catch (e) {
        console.warn('OBS settings save failed', e);
    }
}

window.testObsConnection = async () => {
    const status = document.querySelector('#f-obs-status');
    if (status) { status.style.color = 'var(--text-dim)'; status.textContent = '⏳ Connexion à OBS...'; }
    try {
        const res = await fetch(`${getApiBase()}/api/obs/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(readObsSettingsForm())
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Erreur');
        const list = document.querySelector('#obs-scene-list');
        if (list) list.innerHTML = (data.scenes || []).map(n => `<option value="${escapeHtml(n)}"></option>`).join('');
        if (status) { status.style.color = '#10b981'; status.textContent = `✅ OBS ${data.version || ''} connecté — ${data.scenes.length} scène(s) : ${data.scenes.join(', ')}`; }
        saveObsSettingsFromForm();
    } catch (e) {
        if (status) { status.style.color = '#ef4444'; status.textContent = `❌ ${e.message}`; }
    }
};

function applyConfigUI(config) {
    if (!config) return;
    console.log('[DEBUG] applyConfigUI received config:', { isAdmin: config.isAdmin, isPremium: config.isPremium });

    // Update local state
    isAdmin = config.isAdmin || false;
    isPremiumUser = config.isPremium || false;
    window.gentokRunMode = config.runMode || 'auto';
    if (window.GentokRunMode) window.GentokRunMode.render();
    activeSceneId = config.activeSceneId || null;
    userScenes = config.scenes || [];

    // [MIGRATION] Persist local scenes to DB if empty on server
    const localScenes = JSON.parse(localStorage.getItem('gentok_user_scenes') || '[]');
    if (userScenes.length === 0 && localScenes.length > 0) {
        console.log('↻ Migration des scènes locales vers le serveur...');
        userScenes = localScenes;
        saveUserScenes(userScenes);
        localStorage.removeItem('gentok_user_scenes');
    }

    // [STATUS SYNC]
    if (config.isRunning) {
        if (btnStart) btnStart.innerHTML = '<i class="fas fa-stop"></i><span>Arrêter</span>';
        if (btnStart) btnStart.classList.add('active-bot');
    } else {
        if (btnStart) btnStart.innerHTML = '<i class="fas fa-play"></i><span>Connexion Live</span>';
        if (btnStart) btnStart.classList.remove('active-bot');
    }

    // Update UI (No zeroing out to avoid flickering)
    updateSceneUI();

    const premiumBadge = document.getElementById('premium-badge');
    if (window.GentokPremium) window.GentokPremium.render(isPremiumUser);

    if (isPremiumUser) {
        if (!window._premiumLogged) {
            console.log('🌟 Compte Premium détecté, déblocage des fonctionnalités.');
            window._premiumLogged = true;
        }
        if (premiumBadge) premiumBadge.classList.remove('hidden');
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('locked'));
        document.querySelectorAll('.crown-tag').forEach(tag => tag.style.display = 'none');
        if (window.location.hash === '#stats') renderStatsHistory();
    } else {
        if (premiumBadge) premiumBadge.classList.add('hidden');
        document.querySelector('#nav-stats')?.classList.add('locked');
        document.querySelectorAll('.crown-tag').forEach(tag => tag.style.display = 'block');
    }

    if (window.renderInstalledPresets) renderInstalledPresets();

    // [ADMIN] Show admin nav only for admin users
    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) {
        console.log('[DEBUG] Setting nav-admin display to:', config.isAdmin ? 'block' : 'none');
        navAdmin.style.display = config.isAdmin ? 'block' : 'none';
        // Force visibility if admin
        if (config.isAdmin) navAdmin.style.setProperty('display', 'block', 'important');
    }

    // [CRITICAL: LEADERBOARDS & GOALS INIT] Moved to top for robustness
    try {
        if (config.topCoins) {
            if (document.getElementById('topCoinsTitleInput')) document.getElementById('topCoinsTitleInput').value = config.topCoins.title || 'TOP COINS';
            if (document.getElementById('topCoinsLimitInput')) document.getElementById('topCoinsLimitInput').value = config.topCoins.limit || 10;
            currentTopCoinsStyle = config.topCoins.style || 1;
            const styleText = document.getElementById('topCoins-style-text');
            if (styleText) styleText.textContent = `STYLE ${currentTopCoinsStyle}`;
            if (document.getElementById('topCoinsTransparent')) document.getElementById('topCoinsTransparent').checked = config.topCoins.transparent !== false;
            if (document.getElementById('topCoinsShowTitle')) document.getElementById('topCoinsShowTitle').checked = config.topCoins.showTitle !== false;
            if (document.getElementById('topCoinsRtl')) document.getElementById('topCoinsRtl').checked = config.topCoins.rtl === true;

            const urlInput = document.getElementById('topCoinsUrl');
            const iframe = document.getElementById('topCoinsFrame');
            if (urlInput || iframe) {
                const url = `/overlay/leaderboard?type=coins&limit=${config.topCoins.limit || 10}&style=${currentTopCoinsStyle}&transparent=${config.topCoins.transparent !== false}&showTitle=${config.topCoins.showTitle !== false}&rtl=${config.topCoins.rtl === true}`;
                if (urlInput) urlInput.value = `https://tiktok.gentok.fr${url}`;
                if (iframe) {
                    iframe.src = url;
                    const limit = config.topCoins.limit || 10;
                    const height = (parseInt(limit) || 10) * 42 + 60;
                    iframe.style.height = height + 'px';
                    if (iframe.parentElement) iframe.parentElement.style.height = height + 'px';
                }
            }
        }
        if (config.topLikes) {
            if (document.getElementById('topLikesTitleInput')) document.getElementById('topLikesTitleInput').value = config.topLikes.title || 'TOP LIKES';
            if (document.getElementById('topLikesLimitInput')) document.getElementById('topLikesLimitInput').value = config.topLikes.limit || 10;
            currentTopLikesStyle = config.topLikes.style || 1;
            const styleText = document.getElementById('topLikes-style-text');
            if (styleText) styleText.textContent = `STYLE ${currentTopLikesStyle}`;
            if (document.getElementById('topLikesTransparent')) document.getElementById('topLikesTransparent').checked = config.topLikes.transparent !== false;
            if (document.getElementById('topLikesShowTitle')) document.getElementById('topLikesShowTitle').checked = config.topLikes.showTitle !== false;
            if (document.getElementById('topLikesRtl')) document.getElementById('topLikesRtl').checked = config.topLikes.rtl === true;

            const urlInput = document.getElementById('topLikesUrl');
            const iframe = document.getElementById('topLikesFrame');
            if (urlInput || iframe) {
                const url = `/overlay/leaderboard?type=likes&limit=${config.topLikes.limit || 10}&style=${currentTopLikesStyle}&transparent=${config.topLikes.transparent !== false}&showTitle=${config.topLikes.showTitle !== false}&rtl=${config.topLikes.rtl === true}`;
                if (urlInput) urlInput.value = `https://tiktok.gentok.fr${url}`;
                if (iframe) {
                    iframe.src = url;
                    const limit = config.topLikes.limit || 10;
                    const height = (parseInt(limit) || 10) * 42 + 60;
                    iframe.style.height = height + 'px';
                    if (iframe.parentElement) iframe.parentElement.style.height = height + 'px';
                }
            }
        }
        const lge = document.getElementById('likes-goal-enabled');
        if (lge && config.likesGoal) {
            lge.checked = config.likesGoal.enabled || false;
            document.getElementById('likes-goal-amount').value = config.likesGoal.goal || 10000;
            document.getElementById('likes-goal-title').value = config.likesGoal.title || '';

            // Restore Font
            const lgf = document.getElementById('likes-goal-font');
            if (lgf && config.likesGoal.font) {
                lgf.setAttribute('data-font', config.likesGoal.font);
                lgf.value = config.likesGoal.font;
            }

            const lgb = document.getElementById('likes-goal-behavior');
            if (lgb) {
                lgb.value = config.likesGoal.whenReached || 'increase';
                syncCustomSelect('likes-goal-behavior');
            }
            const lga_act = document.getElementById('likes-goal-action');
            if (lga_act) lga_act.setAttribute('data-saved-val', config.likesGoal.actionId || 'none');

            // Restore Footer visibility
            const lgsh = document.getElementById('likes-goal-show-footer');
            if (lgsh) lgsh.checked = config.likesGoal.showFooter !== false;

            currentLikesStyle = config.likesGoal.style || 1;
            updateLikesPreview();
        }

        // Restore Top Widgets Fonts
        if (config.topGift && config.topGift.font) {
            const f = document.getElementById('topGiftFont');
            if (f) { f.setAttribute('data-font', config.topGift.font); f.value = config.topGift.font; }
        }
        if (config.topStreak && config.topStreak.font) {
            const f = document.getElementById('topStreakFont');
            if (f) { f.setAttribute('data-font', config.topStreak.font); f.value = config.topStreak.font; }
        }
        if (config.topCoins && config.topCoins.font) {
            const f = document.getElementById('topCoinsFont');
            if (f) { f.setAttribute('data-font', config.topCoins.font); f.value = config.topCoins.font; }
        }
        if (config.topLikes && config.topLikes.font) {
            const f = document.getElementById('topLikesFont');
            if (f) { f.setAttribute('data-font', config.topLikes.font); f.value = config.topLikes.font; }
        }
        updateLikesGoalActionSelect();
    } catch (err) {
        console.error("❌ Error initializing Leaderboards/Goals UI:", err);
    }

    if (config.token) {
        const licenseInput = document.querySelector('#license-token');
        if (licenseInput) licenseInput.value = config.token;
        if (socket && socket.connected) {
            socket.emit('identify', { token: config.token, type: 'dashboard' });
        }
    }

    const effectiveUsername = (config.username && config.username !== '0') ? config.username : config.accountUsername;
    if (effectiveUsername) {
        const usernameInput = document.querySelector('#login-username');
        if (usernameInput) usernameInput.value = effectiveUsername;
        const headerUsername = document.getElementById('header-username');
        if (headerUsername) headerUsername.value = effectiveUsername;
        const loginOverlay = document.getElementById('login-overlay');
        const dashboardContainer = document.getElementById('dashboard-container');
        const token = localStorage.getItem('gentok_token');
        if (token && effectiveUsername) {
            if (loginOverlay) loginOverlay.style.display = 'none';
            if (dashboardContainer) dashboardContainer.style.display = 'flex';
        }
    }

    if (config.obs) currentObsSettings = { ...currentObsSettings, ...config.obs };
    if (config.streamerbot) currentStreamerbotSettings = { ...currentStreamerbotSettings, ...config.streamerbot };
    window.gentokConfig = config;
    // Language chosen on another device (only when this browser has no choice yet)
    if (config.language && config.language !== 'fr' && window.GentokI18n && !localStorage.getItem('gentok_lang')) {
        window.GentokI18n.setLanguage(config.language, { save: false });
    }

    if (config.minecraft) {
        const mcHost = document.querySelector('#mc-host');
        if (mcHost) mcHost.value = config.minecraft.host || '';
        const mcPort = document.querySelector('#mc-port');
        if (mcPort) mcPort.value = config.minecraft.port || '';
        const mcPass = document.querySelector('#mc-password');
        if (mcPass) mcPass.value = config.minecraft.password || '';
        const mcUser = document.querySelector('#mc-playername');
        if (mcUser) mcUser.value = config.minecraft.playerName || '';
    }

    if (config.spotify) {
        const spEnabled = document.querySelector('#spotify-enabled');
        if (spEnabled) spEnabled.checked = config.spotify.enabled || false;
        const spClient = document.querySelector('#spotify-clientid');
        if (spClient) spClient.value = config.spotify.clientId || '';
        const spSecret = document.querySelector('#spotify-clientsecret');
        if (spSecret) spSecret.value = config.spotify.clientSecret || '';

        const spPlayCmd = document.querySelector('#spotify-cmd-play');
        if (spPlayCmd) spPlayCmd.value = config.spotify.commands?.play || '!play';
        const spSkipCmd = document.querySelector('#spotify-cmd-skip');
        if (spSkipCmd) spSkipCmd.value = config.spotify.commands?.skip || '!skip';
        const spRemoveCmd = document.querySelector('#spotify-cmd-remove');
        if (spRemoveCmd) spRemoveCmd.value = config.spotify.commands?.remove || '!remove';

        const spPlayEnabled = document.querySelector('#spotify-play-enabled');
        if (spPlayEnabled) spPlayEnabled.checked = config.spotify.playEnabled !== false;
        const spSkipEnabled = document.querySelector('#spotify-skip-enabled');
        if (spSkipEnabled) spSkipEnabled.checked = config.spotify.skipEnabled !== false;
        const spSkipInstantMods = document.querySelector('#spotify-skip-instant-mods');
        if (spSkipInstantMods) spSkipInstantMods.checked = config.spotify.skipInstant?.moderators !== false;
        const spSkipInstantSubs = document.querySelector('#spotify-skip-instant-subs');
        if (spSkipInstantSubs) spSkipInstantSubs.checked = config.spotify.skipInstant?.subscribers || false;
        const spSkipInstantFollowers = document.querySelector('#spotify-skip-instant-followers');
        if (spSkipInstantFollowers) spSkipInstantFollowers.checked = config.spotify.skipInstant?.followers || false;
        const spOverlay = document.querySelector('#spotify-always-overlay');
        if (spOverlay) spOverlay.checked = config.spotify.alwaysShowOverlay !== false;
        const spMaxQueue = document.querySelector('#spotify-max-queue');
        if (spMaxQueue) spMaxQueue.value = config.spotify.maxQueueSize || 50;
        const spMaxUser = document.querySelector('#spotify-max-tracks');
        if (spMaxUser) spMaxUser.value = config.spotify.maxTracksPerUser || 5;
        const spSkipVotes = document.querySelector('#spotify-skip-votes');
        if (spSkipVotes) spSkipVotes.value = config.spotify.skipVotes || 3;

        const spAllowAll = document.querySelector('#spotify-allow-all');
        if (spAllowAll) spAllowAll.checked = config.spotify.allowedUsers?.all !== false;
        const spAllowSubs = document.querySelector('#spotify-allow-subs');
        if (spAllowSubs) spAllowSubs.checked = config.spotify.allowedUsers?.subscribers !== false;
        const spAllowMods = document.querySelector('#spotify-allow-mods');
        if (spAllowMods) spAllowMods.checked = config.spotify.allowedUsers?.moderators !== false;
        const spAllowFollowers = document.querySelector('#spotify-allow-followers');
        if (spAllowFollowers) spAllowFollowers.checked = config.spotify.allowedUsers?.followers || false;

        const statusMsg = document.querySelector('#spotify-status-msg');
        if (statusMsg) {
            statusMsg.innerHTML = config.spotify.refreshToken
                ? '<span style="color: #1DB954;"><i class="fas fa-check-circle"></i> Spotify Connecté</span>'
                : '<span style="color: var(--text-dim);"><i class="fas fa-info-circle"></i> Non connecté</span>';
        }
        const redirectUri = document.querySelector('#spotify-redirect-uri');
        if (redirectUri) redirectUri.textContent = config.spotify.redirectUri || 'https://tiktok.gentok.fr/api/spotify/callback';
    }

    currentActions = config.actions || [];
    currentEvents = config.events || [];
    renderActions();
    renderEvents();
    renderSoundLinks();
    updateActionSelect();

    // [AUTO-RESET SYNC]
    const resetTop = document.getElementById('autoResetTopStats');
    if (resetTop) resetTop.checked = config.autoResetTopStats || false;
    const resetLast = document.getElementById('autoResetLastX');
    if (resetLast) resetLast.checked = config.autoResetLastX || false;

    const showOnDashboard = localStorage.getItem('gentok_show_history_dashboard') === 'true';
    const container = document.getElementById('dashboard-history-container');
    if (container) container.style.display = showOnDashboard ? 'block' : 'none';

    // Last sync for all URLs with token
    updateOverlayLinks();
}

async function renderStatsHistory() {
    const tableBody = document.querySelector('#stats-history-table tbody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Chargement de l\'historique...</td></tr>';

    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const response = await fetch(`${base}/api/session-stats?token=${token || ''}`);
        const history = await response.json();

        // [FIX] Validations de la réponse (Gestion erreur Premium ou autre)
        if (!Array.isArray(history)) {
            if (history.error) {
                const msg = history.message || history.error;
                // Si c'est une erreur PREMIUM, on l'affiche proprement
                const color = history.error === 'PREMIUM_ONLY' ? '#ffcc00' : 'var(--error)';
                const icon = history.error === 'PREMIUM_ONLY' ? 'fa-crown' : 'fa-exclamation-circle';

                tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: ${color};"><i class="fas ${icon}"></i> ${msg}</td></tr>`;
            } else {
                tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--error);">Erreur: Format de données invalide reçue du serveur.</td></tr>';
            }
            return;
        }

        tableBody.innerHTML = '';

        if (history.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Aucun live enregistré pour le moment.</td></tr>';
            return;
        }

        history.forEach((session, index) => {
            const tr = document.createElement('tr');
            const date = new Date(session.date);
            const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const prevSession = history[index + 1];

            const getDiffHtml = (current, prev) => {
                if (prev === undefined || prev === null) return '';
                const diff = current - prev;
                if (diff > 0) return `<span style="color: #00ffaa; font-size: 0.7rem; margin-left: 4px;"><i class="fas fa-arrow-up"></i></span>`;
                if (diff < 0) return `<span style="color: #ff2c55; font-size: 0.7rem; margin-left: 4px;"><i class="fas fa-arrow-down"></i></span>`;
                return '';
            };

            tr.innerHTML = `
                <td style="padding: 12px 15px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-size: 0.9rem; font-weight: 700; color: #fff;">${dateStr}</span>
                        <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: 600;">${timeStr}</span>
                    </div>
                </td>
                <td style="padding: 12px 15px;"><span class="badge keyboard" style="font-family: monospace;">${formatDuration(session.duration || 0)}</span></td>
                <td style="padding: 12px 15px;">
                    <div style="display: flex; align-items: center; gap: 6px; color: #00f2ff; font-weight: 800;">
                        <i class="fas fa-gem" style="font-size: 0.8rem;"></i>
                        <span>${session.diamonds.toLocaleString()}</span>
                        ${getDiffHtml(session.diamonds, prevSession?.diamonds)}
                    </div>
                </td>
                <td style="padding: 12px 15px;">
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <span>${session.gifts.toLocaleString()}</span>
                        ${getDiffHtml(session.gifts, prevSession?.gifts)}
                    </div>
                </td>
                <td style="padding: 12px 15px;">
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <span>${(session.viewerCountMax || 0).toLocaleString()}</span>
                        ${getDiffHtml(session.viewerCountMax, prevSession?.viewerCountMax)}
                    </div>
                </td>
                <td style="padding: 12px 15px;">
                    <div style="display: flex; align-items: center; gap: 2px; color: #FFA500; font-weight: 700;">
                         <span>${(session.cumulativeViewers || 0).toLocaleString()}</span>
                         ${getDiffHtml(session.cumulativeViewers, prevSession?.cumulativeViewers)}
                    </div>
                </td>
                <td style="padding: 12px 15px;">
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <span>${session.likes.toLocaleString()}</span>
                        ${getDiffHtml(session.likes, prevSession?.likes)}
                    </div>
                </td>
                <td style="padding: 12px 15px;">
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <span>${(session.follows || 0).toLocaleString()}</span>
                        ${getDiffHtml(session.follows, prevSession?.follows)}
                    </div>
                </td>
                <td style="padding: 12px 15px;">
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <span>${(session.shares || 0).toLocaleString()}</span>
                        ${getDiffHtml(session.shares, prevSession?.shares)}
                    </div>
                </td>
                <td style="padding: 12px 15px;">
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-icon mini" style="background: rgba(45, 255, 196, 0.1); color: #2dffc4;" onclick="viewSessionDetails('${session._id}')" title="Détails">
                            <i class="fas fa-chart-pie"></i>
                        </button>
                         <button class="btn-icon mini" style="background: rgba(255, 44, 85, 0.1); color: #ff2c55;" onclick="deleteSession('${session._id}')" title="Supprimer">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // [DASHBOARD SYNC] Optional mini history on Dashboard
        const showOnDash = localStorage.getItem('gentok_show_history_dashboard') === 'true';
        const dashContainer = document.getElementById('dashboard-history-container');
        const dashBody = document.querySelector('#dashboard-stats-history-table tbody');

        if (showOnDash && dashBody) {
            dashBody.innerHTML = '';
            history.slice(0, 5).forEach(session => {
                const tr = document.createElement('tr');
                const dateParts = new Date(session.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                const timeParts = new Date(session.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                tr.innerHTML = `
                    <td style="text-align: left;"><span style="font-weight:700;">${dateParts}</span> <small>${timeParts}</small></td>
                    <td>${formatDuration(session.duration || 0)}</td>
                    <td style="color:#00f2ff;">${session.diamonds}</td>
                    <td>${session.gifts}</td>
                    <td>${session.viewerCountMax || 0}</td>
                    <td style="color:#ffaa00;">${(session.cumulativeViewers || 0).toLocaleString()}</td>
                    <td>${session.likes.toLocaleString()}</td>
                    <td>
                        <button class="btn-icon mini" onclick="viewSessionDetails('${session._id}')"><i class="fas fa-chart-pie"></i></button>
                    </td>
                `;
                dashBody.appendChild(tr);
            });
            if (dashContainer) dashContainer.style.display = 'block';
        } else if (dashContainer) {
            dashContainer.style.display = 'none';
        }
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--error);">Erreur : ${err.message}</td></tr>`;
    }
}

window.toggleHistoryOnDashboard = (enabled) => {
    localStorage.setItem('gentok_show_history_dashboard', enabled);
    const container = document.getElementById('dashboard-history-container');
    if (container) container.style.display = enabled ? 'block' : 'none';
    if (enabled) renderStatsHistory();
};

let actionsChart = null;
let giftsChart = null;

window.viewSessionDetails = async (id) => {
    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const response = await fetch(`${base}/api/session-stats?token=${token || ''}`);
        const history = await response.json();

        // [FIX] Check validity
        if (!Array.isArray(history)) {
            if (history.error) showNotify('Erreur', history.message || history.error, 'error');
            return;
        }

        const session = history.find(s => s._id === id);

        if (!session) return;

        // Open Modal
        openModal('modal-session-details');

        // Populate Summary
        const dateEl = document.getElementById('sd-date');
        const diamEl = document.getElementById('sd-diamonds');
        const giftEl = document.getElementById('sd-gifts');
        const viewEl = document.getElementById('sd-viewers');
        const cumViewEl = document.getElementById('sd-cumulative-viewers');
        const likeEl = document.getElementById('sd-likes');
        const shareEl = document.getElementById('sd-shares');

        if (dateEl) dateEl.innerText = new Date(session.date).toLocaleString('fr-FR');
        if (diamEl) diamEl.innerText = session.diamonds.toLocaleString();
        if (giftEl) giftEl.innerText = session.gifts.toLocaleString();
        if (viewEl) viewEl.innerText = (session.viewerCountMax || 0).toLocaleString();
        if (cumViewEl) cumViewEl.innerText = (session.cumulativeViewers || 0).toLocaleString();
        if (likeEl) likeEl.innerText = session.likes.toLocaleString();
        if (shareEl) shareEl.innerText = (session.shares || 0).toLocaleString();

        // CHARTS
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#fff', font: { size: 10 } } }
            }
        };

        // Actions Chart
        const actionsData = session.actionsBreakdown || {};
        const actionLabels = Object.keys(actionsData);
        let actionValues = Object.values(actionsData);

        if (actionLabels.length === 0) {
            actionLabels.push('Aucune donnée');
            actionValues = [1];
        }

        const canvasA = document.getElementById('actionsChart');
        if (canvasA) {
            if (actionsChart) actionsChart.destroy();
            actionsChart = new Chart(canvasA.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: actionLabels,
                    datasets: [{
                        data: actionValues,
                        backgroundColor: ['#fe2c55', '#25f4ee', '#ff00ff', '#ffcc00', '#4CAF50', '#9c27b0'],
                        borderWidth: 0
                    }]
                },
                options: chartOptions
            });
        }

        // Gift history of the live: every gift with its picture, count and coins (most valuable first)
        const giftsTable = document.getElementById('sd-gifts-table');
        if (giftsTable) {
            const counts = session.giftsBreakdown || {};
            const coins = session.giftsCoinsBreakdown || {};
            const icons = session.giftsIcons || {};
            const rows = Object.keys(counts).map(name => ({ name, count: Number(counts[name]) || 0, coins: Number(coins[name]) || 0, icon: icons[name] || '' }))
                .sort((a, b) => (b.coins - a.coins) || (b.count - a.count));
            const hasCoins = rows.some(r => r.coins > 0);
            giftsTable.innerHTML = rows.length ? `
                <table class="stats-history-table">
                    <thead><tr><th style="text-align:left">Cadeau</th><th>Nombre</th>${hasCoins ? '<th>Pièces</th>' : ''}</tr></thead>
                    <tbody>${rows.map(r => `
                        <tr>
                            <td style="text-align:left"><span class="sd-gift-name">${r.icon ? `<img src="${escapeHtml(r.icon)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">` : '<i class="fas fa-gift"></i>'} ${escapeHtml(r.name)}</span></td>
                            <td>×${r.count.toLocaleString()}</td>
                            ${hasCoins ? `<td>${r.coins.toLocaleString()}</td>` : ''}
                        </tr>`).join('')}
                    </tbody>
                </table>
                ${hasCoins ? '' : '<p class="text-dim small mt-2 mb-0">Le détail des pièces par cadeau est enregistré à partir des prochains lives.</p>'}`
                : '<p class="text-dim mb-0">Aucun cadeau reçu pendant ce live.</p>';
        }

        // Gifts Chart
        const giftsData = session.giftsBreakdown || {};
        const giftLabels = Object.keys(giftsData);
        let giftValues = Object.values(giftsData);

        if (giftLabels.length === 0) {
            giftLabels.push('Aucune donnée');
            giftValues = [1];
        }

        const canvasG = document.getElementById('giftsChart');
        if (canvasG) {
            if (giftsChart) giftsChart.destroy();
            giftsChart = new Chart(canvasG.getContext('2d'), {
                type: 'pie',
                data: {
                    labels: giftLabels,
                    datasets: [{
                        data: giftValues,
                        backgroundColor: ['#2196F3', '#E91E63', '#9C27B0', '#FF9800', '#00BCD4', '#8BC34A'],
                        borderWidth: 0
                    }]
                },
                options: chartOptions
            });
        }

    } catch (err) {
        console.error("Analysis loading error:", err);
        showNotify('Erreur', 'Impossible de charger l\'analyse : ' + err.message, 'error');
    }
};

window.deleteSession = async (id) => {
    const confirmed = await showConfirm(
        'Supprimer la session ?',
        'Voulez-vous vraiment supprimer cette session de l\'historique ?',
        'Oui, supprimer'
    );
    if (!confirmed) return;

    const attemptDelete = async (base) => {
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/session-stats/${id}?token=${token || ''}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return await res.json();
    };

    try {
        const primaryBase = getApiBase();
        try {
            // Test 1 : Attempt on current primary base (VPS or Local)
            const result = await attemptDelete(primaryBase);
            if (result.success) {
                showToast('Session supprimée avec succès.', 'success');
                renderStatsHistory();
                return;
            }
        } catch (err) {
            // Test 2 : If failed and on VPS, try direct Local PC
            if (primaryBase !== 'http://localhost:3000') {
                console.log("Échec sur VPS, tentative en local...");
                // Note: Always use localhost:3000 for local-app-specific attempts
                const localResult = await attemptDelete('http://localhost:3000');
                if (localResult.success) {
                    showToast('Session supprimée via serveur local.', 'success');
                    renderStatsHistory();
                    return;
                }
            }
            throw err;
        }
    } catch (err) {
        showNotify('Erreur', "Impossible de supprimer. Assurez-vous que votre serveur local est lancé.", 'error');
    }
};

function formatDuration(seconds) {
    if (!seconds) return '--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    let res = '';
    if (h > 0) res += `${h}h `;
    if (m > 0 || h > 0) res += `${m}m `;
    res += `${s}s`;
    return res;
}

function updateComparison(key, current, dbKey = null) {
    const compareEl = document.querySelector(`#compare-${key}`);
    if (!compareEl || !lastSessionStats || Object.keys(lastSessionStats).length === 0) return;

    const targetKey = dbKey || key;
    const previous = lastSessionStats[targetKey] || 0;

    if (previous === 0) {
        compareEl.innerHTML = `<i class="fas fa-minus"></i> -- vs dernier live`;
        compareEl.className = 'stat-compare';
        return;
    }

    const diff = current - previous;
    // Calculate percentage increase/decrease
    const percent = Math.abs(Math.round((diff / previous) * 100));

    if (diff > 0) {
        compareEl.innerHTML = `<i class="fas fa-arrow-up"></i> +${percent}% vs dernier live`;
        compareEl.className = 'stat-compare up';
    } else if (diff < 0) {
        compareEl.innerHTML = `<i class="fas fa-arrow-down"></i> -${percent}% vs dernier live`;
        compareEl.className = 'stat-compare down';
    } else {
        compareEl.innerHTML = `<i class="fas fa-equals"></i> Stable vs dernier live`;
        compareEl.className = 'stat-compare';
    }
}

function renderActions() {
    actionsTable.innerHTML = '';
    // Filter out sound actions as they are now in the soundboard
    const otherActions = currentActions.filter(a => a.type !== 'sound');

    if (otherActions.length === 0) {
        // [CHECK] If no scenes exist, ask to create one first
        const scenes = getUserScenes();
        if (scenes.length === 0) {
            actionsTable.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; color: var(--text-dim);">
                            <i class="fas fa-layer-group" style="font-size: 3rem; opacity: 0.3; color: var(--warning);"></i>
                            <div>
                                <h3 style="margin-bottom: 5px; color: var(--text);">Aucune Scène détectée</h3>
                                <p style="font-size: 0.9rem;">Vous devez créer une <strong>Scène</strong> avant de pouvoir ajouter des Actions.</p>
                            </div>
                            <button class="btn-primary" onclick="createCustomScene()">
                                <i class="fas fa-plus"></i> Créer ma première Scène
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        actionsTable.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; color: var(--text-dim);">
                        <i class="fas fa-bolt" style="font-size: 3rem; opacity: 0.3;"></i>
                        <div>
                            <h3 style="margin-bottom: 5px; color: var(--text);">Aucune action configurée</h3>
                            <p style="font-size: 0.9rem;">Créez votre première action (Touche Clavier, Commande...) pour commencer !</p>
                        </div>
                        <button class="btn-primary" onclick="document.querySelector('#btn-new-action').click()">
                            <i class="fas fa-plus"></i> Créer une Action
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const icons = {
        keyboard: 'fa-keyboard',
        obs: 'fa-video',
        discord: 'fa-brands fa-discord',
        command: 'fa-terminal',
        sound: 'fa-music',
        web: 'fa-globe',
        default: 'fa-bolt',
        rcon: 'fa-cube', // Cube icon for Minecraft
        webhook: 'fa-globe',
        alert: 'fa-bell',
        tts: 'fa-volume-up',
        wheel: 'fa-dharmachakra',
        streamerbot: 'fa-robot'
    };

    const labels = {
        keyboard: 'Clavier',
        obs: 'OBS Studio',
        discord: 'Discord',
        command: 'Commande',
        sound: 'Son',
        web: 'Webhook',
        webhook: 'Webhook',
        rcon: 'Minecraft Serveur',
        alert: 'Alerte écran',
        tts: 'Synthèse vocale',
        wheel: 'Roue de la fortune',
        streamerbot: 'Streamer.bot'
    };

    otherActions.forEach(action => {
        const iconClass = icons[action.type] || icons.default;
        const displayLabel = labels[action.type] || action.type;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="chk-item-action" value="${action.id}" onchange="handleCheckboxChange('action')"></td>
            <td>
                <div style="display:flex; justify-content:center;">
                    <div class="trigger-box" style="justify-content: flex-start; padding-left: 12px; gap: 8px;">
                        <i class="fas fa-tag" style="color: var(--secondary); font-size: 1rem; flex-shrink: 0;"></i>
                        <strong style="color:white; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;" title="${action.name}">${action.name}</strong>
                    </div>
                </div>
            </td>
            <td>
                <div style="display:flex; justify-content:center;">
                    <div class="trigger-box" style="justify-content: center; border-color: rgba(255,255,255,0.1); gap: 8px;">
                        <i class="fas ${iconClass}" style="opacity: 0.7; font-size: 0.9rem; flex-shrink: 0;"></i>
                        <span class="badge ${action.type}" style="background:transparent; padding:0; font-size: 0.85rem;">${displayLabel}</span>
                    </div>
                </div>
            </td>
            <td>
                <div style="display:flex; justify-content:center;">
                    <div class="trigger-box" style="justify-content: center; background: rgba(0,0,0,0.2); max-width: 250px;">
                        <code style="background:transparent; padding:0; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; max-width:230px;" title="${formatDetails(action)}">${formatDetails(action)}</code>
                    </div>
                </div>
            </td>
            <td style="text-align: right; width: 1%;">
                <div style="display:flex; gap:5px; justify-content:flex-end; white-space:nowrap;">
                    <button class="btn-icon" style="color: var(--warning); background: rgba(255, 193, 7, 0.1);" onclick="testActionWithDelay('${action.id}')" title="${action.type === 'keyboard' ? 'Test (5s délai pour se placer sur le jeu)' : 'Tester l\'action instantanément'}">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="btn-icon edit" onclick="editItem('action', '${action.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete" onclick="deleteItem('action', '${action.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        actionsTable.appendChild(tr);
    });
}

window.testActionWithDelay = (id) => {
    console.log(`[TEST-ACTION] Bouton cliqué pour action ID: ${id}`);
    const action = (currentActions || []).find(a => a.id === id);
    const isKeyboard = action && action.type === 'keyboard';

    const executeTest = async () => {
        try {
            const base = window.electronAPI ? getLocalApiBase() : getApiBase();
            const token = localStorage.getItem('gentok_token');
            console.log(`[TEST-ACTION] Appel API: ${base}/api/test-action/${id}`);
            const res = await fetch(`${base}/api/test-action/${id}?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await res.json();
            console.log(`[TEST-ACTION] Réponse API:`, data);
            if (data.success) showToast('Action exécutée !', 'success');
            else showNotify('Erreur', data.error || 'Erreur lors du test', 'error');
        } catch (e) {
            console.error('[TEST-ACTION] Erreur fetch:', e.message);
            showNotify('Erreur', e.message, 'error');
        }
    };

    if (isKeyboard) {
        showToast('Touches clavier : Exécution dans 5 secondes...', 'info');
        setTimeout(executeTest, 5000);
    } else {
        showToast('Exécution de l\'action...', 'info');
        executeTest();
    }
};

function renderSoundLinks() {
    const soundTableBody = document.querySelector('#sound-actions-table tbody');
    if (!soundTableBody) return;

    soundTableBody.innerHTML = '';
    const soundActions = currentActions.filter(a => a.type === 'sound');

    if (soundActions.length === 0) {
        soundTableBody.innerHTML = '<tr><td colspan="4" class="text-dim" style="text-align:center; padding: 20px;">Aucun lien audio actif</td></tr>';
        return;
    }

    // Sort by price descending (most expensive first)
    soundActions.sort((a, b) => {
        const evA = currentEvents.find(e => e.actions.includes(a.id));
        const evB = currentEvents.find(e => e.actions.includes(b.id));

        const getPrice = (ev) => {
            if (!ev || ev.triggerType !== 'gift') return 0;
            const gift = cachedGifts.find(g => g.id === ev.giftId || g.name === ev.giftName);
            return gift ? (gift.diamond_count || gift.price || 0) : 0;
        };

        return getPrice(evB) - getPrice(evA);
    });

    const claimedTriggers = new Set();

    soundActions.forEach(action => {
        // Find associated event to get the trigger (Gift), enforcing unique trigger per sound
        let event = currentEvents.find(e => e.actions.includes(action.id));
        if (event) {
            const triggerKey = event.triggerType === 'gift' ? `gift:${(event.giftName || '').toLowerCase().trim()}` : event.triggerType;
            if (triggerKey && claimedTriggers.has(triggerKey)) {
                event = null; // Unlink duplicate sound trigger
            } else if (triggerKey) {
                claimedTriggers.add(triggerKey);
            }
        }

        // Sound Info Box
        const soundHtml = `
            <div class="trigger-box" style="background: rgba(37, 244, 238, 0.05); border-color: rgba(37, 244, 238, 0.1);">
                <div class="trigger-icon-wrapper" style="background: var(--secondary); color: #000;"><i class="fas fa-music"></i></div>
                <div>
                    <span class="trigger-label">Son</span>
                    <span class="trigger-value" title="${action.name}">${(action.soundName || action.name).replace('Sound: ', '')}</span>
                </div>
            </div>
        `;

        // Trigger Info Box (Gift or other)
        let triggerHtml = '';
        if (event) {
            if (event.triggerType === 'gift') {
                const gift = cachedGifts.find(g => g.id === event.giftId || g.name === event.giftName) || { icon: '', url: '', name: (event.giftName || 'Inconnu') };
                const imgUrl = gift.icon || gift.url;

                let iconHtml;
                if (imgUrl) {
                    iconHtml = `<img src="${imgUrl}" class="trigger-icon-img" style="width:32px; height:32px;" onerror="this.onerror=null; this.src=''; this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                <div class="trigger-icon-wrapper" style="display:none"><i class="fas fa-gift"></i></div>`;
                } else {
                    iconHtml = `<div class="trigger-icon-wrapper"><i class="fas fa-gift"></i></div>`;
                }

                triggerHtml = `
                    <div class="trigger-box" onclick="editItem('event', '${event.id}')" style="cursor:pointer; border-color: var(--primary); background: rgba(254, 44, 85, 0.05);">
                        ${iconHtml}
                        <div>
                            <span class="trigger-label">Déclencheur</span>
                            <span class="trigger-value">${event.giftName}</span>
                        </div>
                    </div>
                `;
            } else {
                const icons = {
                    like: 'fa-heart', follow: 'fa-user-plus', share: 'fa-share',
                    member: 'fa-door-open', subscribe: 'fa-star', chat: 'fa-comment',
                    command: 'fa-terminal', gift_min: 'fa-coins', specific_user: 'fa-user-tag', level_up: 'fa-arrow-up-wide-short'
                };
                const labels = {
                    like: 'Like', follow: 'Follow', share: 'Partage',
                    member: 'Rejoint', subscribe: 'Abonnement', chat: 'Chat',
                    command: 'Commande', gift_min: 'Cadeau Min.', specific_user: 'Utilisateur', level_up: 'Niveau'
                };
                triggerHtml = `
                    <div class="trigger-box" onclick="editItem('event', '${event.id}')" style="cursor:pointer;">
                        <div class="trigger-icon-wrapper"><i class="fas ${icons[event.triggerType] || 'fa-bolt'}"></i></div>
                        <div>
                            <span class="trigger-label">${labels[event.triggerType] || 'Événement'}</span>
                            <span class="trigger-value">${event.triggerType}</span>
                        </div>
                    </div>
                `;
            }
        } else {
            triggerHtml = `
                <div class="trigger-box" style="border: 1px dashed #555; background: transparent; cursor: pointer;" onclick="openLinkEventModal('${action.id}')">
                    <div class="trigger-icon-wrapper" style="background: rgba(255,255,255,0.05); color: #777;"><i class="fas fa-link-slash"></i></div>
                    <div>
                        <span class="trigger-label" style="color:#777;">Non lié</span>
                        <span class="trigger-value" style="color:var(--primary); font-size: 0.75rem; text-decoration: underline;">Lier un cadeau</span>
                    </div>
                </div>
            `;
        }

        const tr = document.createElement('tr');
        const soundUrlSafe = (action.soundUrl || action.url || '').replace(/'/g, "\\'");
        tr.innerHTML = `
            <td><input type="checkbox" class="chk-item-sound" value="${action.id}" onchange="handleCheckboxChange('sound')"></td>
            <td><div style="display:flex; justify-content:center;">${triggerHtml}</div></td>
            <td>
                <div style="display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap;">
                    ${soundHtml}
                    <span class="badge" onclick="changeSingleSoundVolume('${action.id}')" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color: var(--text-dim); cursor: pointer;" title="Cliquer pour modifier le volume de ce son"><i class="fas fa-volume-down" style="margin-right: 4px; color: var(--secondary);"></i>Vol: ${action.volume ? Math.round(action.volume <= 1 ? action.volume * 100 : action.volume) : 100}%</span>
                </div>
            </td>
            <td style="text-align: right;">
                <div style="display:flex; gap:5px; justify-content:flex-end;">
                    <button class="btn-icon preview mini" onclick="previewSoundAction('${action.id}', this)" title="Écouter le son"><i class="fas fa-play"></i></button>
                    ${event ? `<button class="btn-icon mini" onclick="editItem('event', '${event.id}')" title="Modifier le déclencheur"><i class="fas fa-cog"></i></button>` : ''}
                    <button class="btn-icon delete mini" onclick="deleteItem('action', '${action.id}')" title="Supprimer"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        soundTableBody.appendChild(tr);
    });
}

window.openLinkEventModal = (actionId) => {
    resetEventForm();
    updateActionSelect(); // Ensure action checkboxes list is updated in modal

    // Auto-select Gift as trigger type
    const triggerSelect = document.querySelector('#event-trigger-type');
    if (triggerSelect) {
        triggerSelect.value = 'gift';
        syncCustomSelect('event-trigger-type');
        updateEventFields();
    }

    // Auto-check this specific action
    const chk = document.querySelector(`#chk-action-${actionId}`);
    if (chk) chk.checked = true;

    openModal('modal-event');
};

// Global Cache for Gifts
let cachedGifts = [];

async function loadGiftsCache() {
    try {
        const base = getApiBase();
        const res = await fetch(`${base}/api/gifts`);
        cachedGifts = await res.json();
        // Re-render events after loading if needed
        renderEvents();
        renderSoundLinks();
    } catch (e) {
        console.error("Failed to load gifts cache", e);
    }
}

// Call this on init
setTimeout(loadGiftsCache, 1000);

function renderEvents() {
    const eventsTable = document.querySelector('#events-table tbody'); // Ensure we select tbody if id is on table
    if (!eventsTable) return;

    eventsTable.innerHTML = '';

    if (currentEvents.length === 0) {
        // [CHECK] If no scenes exist, ask to create one first
        const scenes = getUserScenes();
        if (scenes.length === 0) {
            eventsTable.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; color: var(--text-dim);">
                            <i class="fas fa-layer-group" style="font-size: 3rem; opacity: 0.3; color: var(--warning);"></i>
                            <div>
                                <h3 style="margin-bottom: 5px; color: var(--text);">Aucune Scène détectée</h3>
                                <p style="font-size: 0.9rem;">Vous devez créer une <strong>Scène</strong> avant de pouvoir configurer des Événements.</p>
                            </div>
                            <button class="btn-primary" onclick="createCustomScene()">
                                <i class="fas fa-plus"></i> Créer ma première Scène
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        eventsTable.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; color: var(--text-dim);">
                        <i class="fas fa-calendar-check" style="font-size: 3rem; opacity: 0.3;"></i>
                        <div>
                            <h3 style="margin-bottom: 5px; color: var(--text);">Aucun événement configuré</h3>
                            <p style="font-size: 0.9rem;">Liez vos Cadeaux et Likes à vos Actions ici.</p>
                        </div>
                        <button class="btn-primary" onclick="document.querySelector('#btn-new-event').click()">
                            <i class="fas fa-plus"></i> Créer un Événement
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const icons = {
        keyboard: 'fa-keyboard',
        obs: 'fa-video',
        discord: 'fa-brands fa-discord',
        command: 'fa-terminal',
        sound: 'fa-music',
        web: 'fa-globe',
        default: 'fa-bolt',
        rcon: 'fa-cube',
        webhook: 'fa-globe',
        alert: 'fa-bell',
        tts: 'fa-volume-up',
        wheel: 'fa-dharmachakra',
        streamerbot: 'fa-robot'
    };

    const labels = {
        keyboard: 'Clavier',
        obs: 'OBS Studio',
        discord: 'Discord',
        command: 'Commande',
        sound: 'Son',
        web: 'Webhook',
        webhook: 'Webhook',
        rcon: 'Minecraft Serveur',
        alert: 'Alerte écran',
        tts: 'Synthèse vocale',
        wheel: 'Roue de la fortune',
        streamerbot: 'Streamer.bot'
    };

    currentEvents.forEach(event => {
        const tr = document.createElement('tr');

        // Actions Formatting
        const actionsHtml = event.actions.map(id => {
            const a = currentActions.find(acc => acc.id === id);
            if (!a) return '';

            const iconClass = icons[a.type] || icons.default;
            const displayLabel = labels[a.type] || a.type;

            return `
            <div class="trigger-box" style="padding: 6px 12px; gap: 8px; display: inline-flex; width: auto; min-width: 0; background: rgba(255,255,255,0.03);">
                 <div style="display:flex; align-items:center; gap:6px; min-width: 110px;">
                    <i class="fas ${iconClass}" style="color: var(--secondary); opacity:0.8;"></i>
                    <span style="font-weight: 700; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px;">${displayLabel}</span>
                 </div>
                 <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.1);"></div>
                 <span style="color: white; font-weight: 600; font-size: 0.9rem;">${a.name}</span>
            </div>`;
        }).join('<div style="height:6px"></div>');

        // Trigger Formatting
        let triggerHtml = '';
        let largePreviewHtml = '';

        if (event.triggerType === 'gift') {
            const gift = cachedGifts.find(g => g.id === event.giftId || g.name === event.giftName) || { icon: '', url: '', name: event.giftName };
            const imgUrl = gift.icon || gift.url || 'https://p16-webcast.tiktokcdn.com/webcast-resource/temai/20230626/1687762696668-305908.png~tplv-obj/24x24.png';

            triggerHtml = `
                <div class="trigger-box" style="border-color: var(--primary); background: rgba(254, 44, 85, 0.05);">
                    <img src="${imgUrl}" class="trigger-icon-img" style="width:36px; height:36px; max-width:36px; max-height:36px; object-fit:contain; border-radius:6px; flex-shrink:0;" onerror="this.style.display='none'">
                    <div style="display: flex; flex-direction: column; justify-content: center;">
                        <span class="trigger-label">Cadeau</span>
                        <span class="trigger-value">${event.giftName}</span>
                    </div>
                </div>
            `;
        } else {
            const icons = {
                like: 'fa-heart', follow: 'fa-user-plus', share: 'fa-share',
                member: 'fa-door-open', subscribe: 'fa-star', chat: 'fa-comment',
                command: 'fa-terminal', gift_min: 'fa-coins', specific_user: 'fa-user-tag', level_up: 'fa-arrow-up-wide-short'
            };
            const labels = {
                like: 'Like', follow: 'Follow', share: 'Partage',
                member: 'Rejoint', subscribe: 'Abonnement', chat: 'Chat',
                command: 'Commande', gift_min: 'Cadeau Min.', specific_user: 'Utilisateur', level_up: 'Niveau'
            };

            triggerHtml = `
                <div class="trigger-box">
                    <div class="trigger-icon-wrapper"><i class="fas ${icons[event.triggerType] || 'fa-bolt'}"></i></div>
                    <div style="display: flex; flex-direction: column; justify-content: center;">
                        <span class="trigger-label">${labels[event.triggerType] || 'Événement'}</span>
                        <span class="trigger-value">${event.triggerType}</span>
                    </div>
                </div>
            `;
        }

        tr.innerHTML = `
            <td><input type="checkbox" class="chk-item-event" value="${event.id}" onchange="handleCheckboxChange('event')"></td>
            <td style="width: 60px;">
                <div style="display:flex; justify-content:center;">
                    <label class="switch-container" title="Activer/Désactiver">
                        <input type="checkbox" ${event.active ? 'checked' : ''} onchange="toggleEvent('${event.id}')">
                        <span></span>
                    </label>
                </div>
            </td>
            <td>
                <div style="display:flex; align-items:center; justify-content: center; min-height: 45px;">
                    ${triggerHtml}
                </div>
            </td>
            <td><div class="actions-container" style="justify-content: center;">${actionsHtml || '<span class="text-dim">Aucune action</span>'}</div></td>
            <td style="width: 100px; text-align: right;">
                <button class="btn-icon edit" onclick="editItem('event', '${event.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon delete" onclick="deleteItem('event', '${event.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        eventsTable.appendChild(tr);
    });
}

// Global Edit Function
window.editItem = async (type, id) => {
    if (type === 'action') {
        const action = currentActions.find(a => a.id === id);
        if (!action) return;

        // Set hidden ID for update
        let idField = document.querySelector('#action-edit-id');
        if (!idField) {
            idField = document.createElement('input');
            idField.type = 'hidden';
            idField.id = 'action-edit-id';
            document.querySelector('#form-action').appendChild(idField);
        }
        idField.value = id;

        // Populate Fields
        document.querySelector('#action-name').value = action.name;
        const typeSelect = document.querySelector('#action-type');
        typeSelect.value = action.type;
        typeSelect.onchange(); // Trigger change to show correct fields immediately

        // Wait a tick for fields to appear then populate
        setTimeout(() => {
            if (action.type === 'webhook') document.querySelector('#f-url').value = action.url;
            if (action.type === 'keyboard') {
                const rawKey = action.key.replace(/[\^\!\+]/g, '');
                document.querySelector('#f-key').value = rawKey;
                document.querySelector('#f-ctrl').checked = action.key.includes('^');
                document.querySelector('#f-alt').checked = action.key.includes('!');
                document.querySelector('#f-shift').checked = action.key.includes('+');
                document.querySelector('#f-duration').value = action.duration || 100;

                // Select the button in grid
                const btn = document.querySelector(`.key-btn[data-value="${rawKey}"]`);
                if (btn) btn.classList.add('selected');

                // Trigger preview update (logic is now inside updateActionFields, but we can call it if exposed)
                if (window.updateKeyPreview) window.updateKeyPreview();
            }
            if (action.type === 'rcon') document.querySelector('#f-cmd').value = action.command;
            if (action.type === 'alert') {
                document.querySelector('#f-text').value = action.text || '';
                document.querySelector('#f-media-url').value = action.mediaUrl || '';
                document.querySelector('#f-alert-duration').value = action.alertDuration || 5;
            }
            if (action.type === 'tts') document.querySelector('#f-text').value = action.text || '';
            if (action.type === 'obs') {
                document.querySelector('#f-obs-action').value = action.obsAction || 'scene';
                document.querySelector('#f-obs-action').dispatchEvent(new Event('change'));
                document.querySelector('#f-obs-scene').value = action.obsScene || '';
                document.querySelector('#f-obs-source').value = action.obsSource || '';
                document.querySelector('#f-obs-duration').value = action.obsDuration || 0;
            }
            if (action.type === 'wheel') document.querySelector('#f-segments').value = action.segments || '';
            if (action.type === 'streamerbot') {
                document.querySelector('#f-sb-name').value = action.sbActionName || '';
                document.querySelector('#f-sb-id').value = action.sbActionId || '';
                document.querySelector('#f-sb-args').value = action.sbArgs || '';
            }
            const cooldownInput = document.querySelector('#action-cooldown');
            if (cooldownInput) cooldownInput.value = action.cooldown || 0;
            const userCooldownInput = document.querySelector('#action-user-cooldown');
            if (userCooldownInput) userCooldownInput.value = action.userCooldown || 0;
            const delayInput = document.querySelector('#action-delay');
            if (delayInput) delayInput.value = action.delay || 0;
            if (action.type === 'sound') {
                document.querySelector('#f-sound-name').value = action.soundName;
                document.querySelector('#f-sound-url').value = action.soundUrl;
                document.querySelector('#f-sound-volume').value = action.volume || 50;
            }
        }, 50);

        // Sync custom selects
        syncCustomSelect('action-type');

        openModal('modal-action');
    } else {
        const event = currentEvents.find(e => e.id === id);
        if (!event) return;

        // Set hidden ID for update
        let idField = document.querySelector('#event-edit-id');
        if (!idField) {
            idField = document.createElement('input');
            idField.type = 'hidden';
            idField.id = 'event-edit-id';
            document.querySelector('#form-event').appendChild(idField);
        }
        idField.value = id;

        // Populate Fields (Who)
        document.querySelector('#event-who').value = event.who || 'everyone';
        updateEventWhoFields();
        if (event.who === 'specific_user') {
            const specificUserField = document.querySelector('#f-specific-user');
            if (specificUserField) specificUserField.value = event.specificUser || '';
        }

        // Populate Fields (Trigger)
        const triggerSelect = document.querySelector('#event-trigger-type');
        triggerSelect.value = event.triggerType;

        // Sync custom selects
        syncCustomSelect('event-who');
        syncCustomSelect('event-trigger-type');

        // Pass event to handle async pre-selection (like gifts)
        await updateEventFields(event);

        const costInput = document.querySelector('#event-points-cost');
        if (costInput) costInput.value = event.pointsCost || 0;

        // Select actions
        const actionCheckboxes = document.querySelectorAll('#event-action-list input[type="checkbox"]');
        actionCheckboxes.forEach(chk => {
            chk.checked = event.actions.includes(chk.value);
        });

        openModal('modal-event');
    }
};

function formatDetails(a) {
    if (a.type === 'webhook') return a.url.substring(0, 20) + '...';
    if (a.type === 'keyboard') {
        let display = '';
        if (a.key.includes('^')) display += 'CTRL+';
        if (a.key.includes('!')) display += 'ALT+';
        if (a.key.includes('+')) display += 'SHIFT+';
        display += a.key.replace(/[\^\!\+]/g, '').replace(/[\{\}]/g, '');
        return display;
    }
    if (a.type === 'rcon') return a.command;
    if (a.type === 'alert') return a.text || a.mediaUrl || 'Alerte';
    if (a.type === 'tts') return `🔊 ${a.text || ''}`;
    if (a.type === 'obs') return `🎬 ${a.obsAction === 'scene' ? a.obsScene : a.obsSource}`;
    if (a.type === 'wheel') return `🎡 ${(a.segments || '').split('\n').filter(l => l.trim()).length} cases`;
    if (a.type === 'streamerbot') return `🤖 ${a.sbActionName || a.sbActionId}`;
    return '';
}

const TRIGGER_LABELS = {
    like: '❤️ Likes', follow: '➕ Follow', share: '🔁 Partage', member: '🚪 Rejoint le live', subscribe: '⭐ Abonnement',
    chat: '💬 Chat', command: '⌨️ Commande', gift_min: '💰 Cadeau (valeur min.)', first_message: '👋 Premier message',
    emote: '😀 Emote', question: '❓ Question', level_up: '🆙 Passage de niveau'
};

function formatTrigger(e) {
    if (e.triggerType === 'gift') return `🎁 ${e.giftName || 'Cadeau'}`;
    let label = TRIGGER_LABELS[e.triggerType] || `⚡ ${e.triggerType}`;
    if (e.triggerType === 'like' && e.likeThreshold > 1) label += ` ×${e.likeThreshold}`;
    if (e.triggerType === 'command' && e.command) label += ` !${e.command.replace(/^!/, '')}`;
    if (e.triggerType === 'gift_min' && e.minCoins) label += ` ≥ ${e.minCoins}`;
    if (e.triggerType === 'level_up' && e.minLevel) label += ` ≥ ${e.minLevel}`;
    return label;
}

function updateActionSelect() {
    const list = document.querySelector('#event-action-list');
    if (!list) return;

    list.innerHTML = '';
    currentActions.forEach(a => {
        const item = document.createElement('div');
        item.className = 'action-checkbox-item';
        item.innerHTML = `
            <input type="checkbox" id="chk-action-${a.id}" value="${a.id}">
            <label for="chk-action-${a.id}">
                <span class="badge ${a.type}">${a.type}</span>
                <span class="action-name">${a.name}</span>
            </label>
        `;
        list.appendChild(item);
    });
}

function setupEventListeners() {
    btnStart.addEventListener('click', toggleBot);

    // Action and Event form listeners

    document.querySelector('#action-type').onchange = updateActionFields;
    document.querySelector('#event-trigger-type').onchange = updateEventFields;
    document.querySelector('#event-who').onchange = updateEventWhoFields;

    document.querySelector('#btn-new-action').onclick = () => {
        resetActionForm();
        syncCustomSelect('action-type');
        openModal('modal-action');
    };
    document.querySelector('#btn-new-event').onclick = () => {
        resetEventForm();
        syncCustomSelect('event-who');
        syncCustomSelect('event-trigger-type');
        openModal('modal-event');
    };

    document.querySelector('#form-action').onsubmit = saveNewAction;
    document.querySelector('#form-event').onsubmit = saveNewEvent;

    // Minecraft Settings Listeners
    document.querySelector('#btn-save-mc').onclick = handleSaveMinecraft;
    document.querySelector('#btn-test-mc').onclick = handleTestMinecraft;

    // Auto-OP when pseudo changes
    const mcPlayerInput = document.querySelector('#mc-playername');
    if (mcPlayerInput) {
        mcPlayerInput.onchange = () => {
            const pseudo = mcPlayerInput.value.trim();
            if (pseudo && lastMcStatus && lastMcStatus.paper === 'online') {
                console.log(`[MC] Pseudo changed, auto-opping: ${pseudo}`);
                window.electronAPI.sendMinecraftCommand(`op ${pseudo}`);
                showToast(`Auto-OP envoyé pour ${pseudo}`, 'info');
            }
        };
    }

    // Spotify Settings Listeners
    const btnSaveSpotify = document.querySelector('#btn-save-spotify');
    if (btnSaveSpotify) btnSaveSpotify.onclick = handleSaveSpotify;

    const btnConnectSpotify = document.querySelector('#btn-connect-spotify');
    if (btnConnectSpotify) btnConnectSpotify.onclick = handleConnectSpotify;

    // Spotify Auth Callback Listener
    window.addEventListener('message', async (event) => {
        if (event.data.type === 'spotify_auth_success') {
            const { code } = event.data;
            try {
                const base = getApiBase();
                const token = localStorage.getItem('gentok_token');
                const res = await fetch(`${base}/api/spotify/callback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, token })
                });
                const result = await res.json();
                if (result.success) {
                    showToast('Spotify connecté avec succès !', 'success');
                    fetchData(); // Refresh to show "Connecté" status
                } else {
                    throw new Error(result.error);
                }
            } catch (err) {
                showNotify('Erreur', 'Échec de la liaison Spotify : ' + err.message, 'error');
            }
        }
    });

    // Reset/Logout Button
    const btnReset = document.querySelector('#btn-reset');
    if (btnReset) {
        btnReset.onclick = async () => {
            // Inform server of logout to stop bot if running
            const token = localStorage.getItem('gentok_token');
            const base = getApiBase();
            if (token) {
                try {
                    await fetch(`${base}/api/logout?token=${token}`, { method: 'POST' });
                } catch (e) { }
            }

            // Clear all local storage to prevent data leakage between accounts
            localStorage.clear();

            // Reload page to show login screen
            window.location.reload();
        };
    }

    // Mobile Menu Toggle
    const btnMobileMenu = document.querySelector('#btn-mobile-menu');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('#sidebar-overlay');

    if (btnMobileMenu && sidebar && sidebarOverlay) {
        btnMobileMenu.onclick = () => {
            sidebar.classList.add('active');
            sidebarOverlay.classList.add('active');
        };

        sidebarOverlay.onclick = () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        };

        // Close sidebar when clicking a link on mobile
        const navLinks = document.querySelectorAll('.nav-links a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 992) {
                    sidebar.classList.remove('active');
                    sidebarOverlay.classList.remove('active');
                }
            });
        });
    }

    // Likes Goal Real-time Preview Listeners
    const lgInputs = ['likes-goal-amount', 'likes-goal-title', 'likes-goal-action', 'likes-goal-behavior'];
    lgInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateLikesPreview);
            el.addEventListener('change', updateLikesPreview);
        }
    });

    // Likes Goal Toggle Listener
    const lgEnabled = document.getElementById('likes-goal-enabled');
    if (lgEnabled) lgEnabled.addEventListener('change', updateLikesPreview);

    const lgShowFooter = document.getElementById('likes-goal-show-footer');
    if (lgShowFooter) lgShowFooter.addEventListener('change', updateLikesPreview);

    // Likes Goal Buttons
    const btnSaveLG = document.getElementById('btn-save-likes-goal');
    if (btnSaveLG) btnSaveLG.onclick = handleSaveLikesGoal;

    const btnCopyLG = document.getElementById('btn-copy-likes-url');
    if (btnCopyLG) btnCopyLG.onclick = copyLikesUrl;

    const btnResetLG = document.getElementById('btn-reset-likes-counter');
    if (btnResetLG) btnResetLG.onclick = handleResetLikesCounter;

    const btnTestLG = document.getElementById('btn-test-likes-goal');
    if (btnTestLG) btnTestLG.onclick = handleTestLikesGoal;

    // Auto-Updater UI Logic
    if (window.electronAPI) {
        const updateModal = document.querySelector('#update-modal');
        const newVersionNumber = document.querySelector('#new-version-number');
        const btnDownload = document.getElementById('btn-download-update');
        const btnLater = document.getElementById('btn-later-update');
        const btnDownloading = document.getElementById('btn-downloading-update');
        const btnRestart = document.getElementById('btn-restart-app');
        const progressContainer = document.querySelector('#download-progress-container');
        const progressBarFill = document.querySelector('#download-progress-fill');
        const progressPercent = document.querySelector('#download-percent');
        const progressStatusText = document.getElementById('progress-status-text');
        const updateSubtitle = document.getElementById('update-subtitle');

        // Update Available
        window.electronAPI.onUpdateAvailable((info) => {
            newVersionNumber.textContent = `v${info.version}`;
            updateModal.classList.add('active');

            // Automatic flow: show progress immediately
            btnDownload.style.display = 'none';
            btnLater.style.display = 'none';
            btnRestart.style.display = 'none';
            btnDownloading.style.display = 'block';
            progressContainer.style.display = 'block';
        });

        // Download Progress
        window.electronAPI.onUpdateProgress((progressObj) => {
            btnDownloading.style.display = 'block';

            const percent = Math.floor(progressObj.percent);
            progressBarFill.style.width = `${percent}%`;
            progressPercent.textContent = `${percent}%`;
        });

        // Downloaded
        window.electronAPI.onUpdateDownloaded(() => {
            btnDownloading.style.display = 'none';
            btnRestart.style.display = 'block';
            progressStatusText.textContent = 'Votre app va être mise à jour...';
        });

        // Error
        window.electronAPI.onUpdateError((message) => {
            console.error('Update Error:', message);
            // Only alert if we were actually trying to update (modal active)
            if (updateModal.classList.contains('active')) {
                showNotify('Erreur Mise à jour', 'Échec du téléchargement.', 'error');
            }
            updateModal.classList.remove('active');
        });

        // The update may have started before this page was shown (e.g. during the launcher):
        // ask the current state and follow it, so the progress window is never missed
        const followUpdateState = (st) => {
            if (!st) return;
            if (st.status === 'downloading' || st.status === 'downloaded') {
                if (st.version) newVersionNumber.textContent = `v${st.version}`;
                updateModal.classList.add('active');
                btnDownload.style.display = 'none';
                btnLater.style.display = 'none';
                progressContainer.style.display = 'block';
                const percent = st.status === 'downloaded' ? 100 : (st.percent || 0);
                progressBarFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                btnDownloading.style.display = st.status === 'downloaded' ? 'none' : 'block';
                btnRestart.style.display = st.status === 'downloaded' ? 'block' : 'none';
                if (st.status === 'downloaded') progressStatusText.textContent = 'Votre app va être mise à jour...';
            }
        };
        if (window.electronAPI.getUpdateState) {
            window.electronAPI.getUpdateState().then(followUpdateState).catch(() => { });
            window.electronAPI.onUpdateState(followUpdateState);
        }

        // Buttons
        btnDownload.onclick = () => {
            window.electronAPI.startDownload();
        };

        btnLater.onclick = () => {
            updateModal.classList.remove('active');
        };

        btnRestart.onclick = () => {
            window.electronAPI.restartApp();
        };
    }

    // Likes Goal PRO Listeners
    const btnSaveLikesGoal = document.getElementById('btn-save-likes-goal');
    if (btnSaveLikesGoal) btnSaveLikesGoal.onclick = handleSaveLikesGoal;

    const btnTestLikesGoal = document.getElementById('btn-test-likes-goal');
    if (btnTestLikesGoal) btnTestLikesGoal.onclick = handleTestLikesGoal;

    const btnCopyLikesUrl = document.getElementById('btn-copy-likes-url');
    if (btnCopyLikesUrl) btnCopyLikesUrl.onclick = copyLikesUrl;

    // Inputs for live preview
    ['likes-goal-amount', 'likes-goal-title', 'likes-goal-font', 'likes-goal-show-footer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') el.onchange = updateLikesPreview;
            else if (el.tagName === 'SELECT') el.onchange = updateLikesPreview;
            else el.oninput = updateLikesPreview;
        }
    });

    // [NEW] Persist TikTok Username Change
    const headerUsernameDom = document.getElementById('header-username');
    if (headerUsernameDom) {
        headerUsernameDom.addEventListener('input', async () => {
            const newName = headerUsernameDom.value.trim();
            if (newName && newName !== '@pseudo' && newName !== '0') {
                console.log('[USER] Saving new TikTok username:', newName);
                try {
                    const base = getApiBase();
                    const token = localStorage.getItem('gentok_token');
                    await fetch(`${base}/api/settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, username: newName })
                    });
                    showToast('Pseudo mis à jour', 'Votre pseudo par défaut a été enregistré.');
                } catch (e) {
                    console.error('Failed to save username:', e);
                }
            }
        });
    }
}

// [AUTO START] Added as per request
// If we have a token and a username, try to auto-start properly
setTimeout(async () => {
    const autoToken = localStorage.getItem('gentok_token');
    const headerUsernameDom = document.querySelector('#header-username');
    const autoUser = headerUsernameDom ? headerUsernameDom.value : null;

    if (autoToken && autoUser && autoUser !== '@pseudo' && autoUser.length > 2) {
        console.log('[AUTO START] Attempting to auto-connect bot for:', autoUser);
        // Simulate a "Start" click or call startBot directly
        // We verify if we are already connected first ideally, but startBot handles idempotency mostly.
        // However, to avoid double-toast or weird UI states on load, let's check status.

        // We just call startBot, it returns success/fail.
        const res = await startBot(autoUser);
        if (res.success) {
            console.log('[AUTO START] Success!');
            showToast('Connexion Auto', 'Le bot a été lancé automatiquement.');
        }
    }
}, 2000); // Wait a bit for sockets and configs to load

// Initialisation
window.addEventListener('DOMContentLoaded', () => {
    init();
});

function updateActionFields() {
    const type = document.querySelector('#action-type').value;
    const container = document.querySelector('#action-details-container');
    container.innerHTML = '';

    if (type === 'webhook') {
        container.innerHTML = `
            <div class="form-group"><label>URL</label><input type="text" id="f-url" placeholder="https://..." required></div>
        `;
    } else if (type === 'keyboard') {
        const keys = [
            { label: 'F1', value: '{F1}' }, { label: 'F2', value: '{F2}' }, { label: 'F3', value: '{F3}' },
            { label: 'F4', value: '{F4}' }, { label: 'F5', value: '{F5}' }, { label: 'F6', value: '{F6}' },
            { label: 'F7', value: '{F7}' }, { label: 'F8', value: '{F8}' }, { label: 'F9', value: '{F9}' },
            { label: 'F10', value: '{F10}' }, { label: 'F11', value: '{F11}' }, { label: 'F12', value: '{F12}' },
            { label: 'Entrée', value: '{ENTER}' }, { label: 'Espace', value: '{SPACE}' },
            { label: 'Echap', value: '{ESC}' }, { label: 'Tab', value: '{TAB}' },
            { label: 'Retour', value: '{BACKSPACE}' }, { label: 'Suppr', value: '{DEL}' },
            { label: 'Haut', value: '{UP}' }, { label: 'Bas', value: '{DOWN}' },
            { label: 'Gauche', value: '{LEFT}' }, { label: 'Droite', value: '{RIGHT}' },
            { label: 'Home', value: '{HOME}' }, { label: 'End', value: '{END}' },
            { label: 'A', value: 'a' }, { label: 'B', value: 'b' }, { label: 'C', value: 'c' },
            { label: 'D', value: 'd' }, { label: 'E', value: 'e' }, { label: 'F', value: 'f' },
            { label: 'G', value: 'g' }, { label: 'H', value: 'h' }, { label: 'I', value: 'i' },
            { label: 'J', value: 'j' }, { label: 'K', value: 'k' }, { label: 'L', value: 'l' },
            { label: 'M', value: 'm' }, { label: 'N', value: 'n' }, { label: 'O', value: 'o' },
            { label: 'P', value: 'p' }, { label: 'Q', value: 'q' }, { label: 'R', value: 'r' },
            { label: 'S', value: 's' }, { label: 'T', value: 't' }, { label: 'U', value: 'u' },
            { label: 'V', value: 'v' }, { label: 'W', value: 'w' }, { label: 'X', value: 'x' },
            { label: 'Y', value: 'y' }, { label: 'Z', value: 'z' },
            { label: '0', value: '0' }, { label: '1', value: '1' }, { label: '2', value: '2' },
            { label: '3', value: '3' }, { label: '4', value: '4' }, { label: '5', value: '5' },
            { label: '6', value: '6' }, { label: '7', value: '7' }, { label: '8', value: '8' },
            { label: '9', value: '9' }
        ];

        container.innerHTML = `
            <div class="key-preview-box" id="key-preview">SÉLECTIONNEZ UNE TOUCHE</div>
            
            <div class="modifier-group">
                <label class="modifier-label"><input type="checkbox" id="f-ctrl"> CTRL</label>
                <label class="modifier-label"><input type="checkbox" id="f-alt"> ALT</label>
                <label class="modifier-label"><input type="checkbox" id="f-shift"> SHIFT</label>
            </div>

            <input type="hidden" id="f-key" required>

            <div class="key-grid">
                ${keys.map(k => `<button type="button" class="key-btn" data-value="${k.value}" onclick="selectVisualKey(this)">${k.label}</button>`).join('')}
            </div>

            <div class="form-group" style="margin-top: 20px;">
                <label>Durée d'appui (ms) - <span style="color: var(--primary);">Mode Jeu / GTA</span></label>
                <input type="number" id="f-duration" value="100" min="50" max="2000" style="width: 100px;">
            </div>
        `;

        window.selectVisualKey = (btn) => {
            document.querySelectorAll('.key-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            document.querySelector('#f-key').value = btn.getAttribute('data-value');
            window.updateKeyPreview();
        };

        window.updateKeyPreview = () => {
            const keyPreview = document.querySelector('#key-preview');
            const keyInput = document.querySelector('#f-key');
            if (!keyPreview || !keyInput) return;

            const key = keyInput.value;
            const ctrl = document.querySelector('#f-ctrl').checked;
            const alt = document.querySelector('#f-alt').checked;
            const shift = document.querySelector('#f-shift').checked;

            let display = '';
            if (ctrl) display += 'CTRL + ';
            if (alt) display += 'ALT + ';
            if (shift) display += 'SHIFT + ';

            const rawKey = key.replace(/[\{\}]/g, '').toUpperCase();
            display += rawKey || '...';

            keyPreview.innerText = display;
        };

        ['#f-ctrl', '#f-alt', '#f-shift'].forEach(id => {
            document.querySelector(id).addEventListener('change', window.updateKeyPreview);
        });

        window.updateKeyPreview();

    } else if (type === 'rcon') {
        container.innerHTML = `
            <div class="form-group"><label>Commande Minecraft</label><input type="text" id="f-cmd" placeholder="say Bonjour {username} !" required></div>
            
            <div class="placeholder-hint-panel">
                <div class="placeholder-hint-title"><i class="fas fa-tags"></i> Paramètres Dynamiques</div>
                <div class="placeholder-groups">
                    <div class="placeholder-group">
                        <span class="placeholder-group-label" style="color:#4caf50;"><i class="fas fa-cube"></i> Minecraft</span>
                        <div class="ph-tags">
                            <span class="ph-tag" onclick="insertPlaceholder('f-cmd','{playername}')" title="Votre pseudo Minecraft configuré">{playername}</span>
                        </div>
                    </div>
                    <div class="placeholder-group">
                        <span class="placeholder-group-label" style="color:#fe2c55;"><i class="fab fa-tiktok"></i> TikTok</span>
                        <div class="ph-tags">
                            <span class="ph-tag" onclick="insertPlaceholder('f-cmd','{username}')" title="Pseudo unique (@user)">{username}</span>
                            <span class="ph-tag" onclick="insertPlaceholder('f-cmd','{nickname}')" title="Nom d'affichage">{nickname}</span>
                            <span class="ph-tag" onclick="insertPlaceholder('f-cmd','{comment}')" title="Contenu du commentaire">{comment}</span>
                        </div>
                    </div>
                    <div class="placeholder-group">
                        <span class="placeholder-group-label" style="color:#ffc107;"><i class="fas fa-gift"></i> Cadeaux / Likes</span>
                        <div class="ph-tags">
                            <span class="ph-tag" onclick="insertPlaceholder('f-cmd','{giftname}')">{giftname}</span>
                            <span class="ph-tag" onclick="insertPlaceholder('f-cmd','{coins}')">{coins}</span>
                            <span class="ph-tag" onclick="insertPlaceholder('f-cmd','{repeatcount}')" title="Nombre de répétitions (Combo)">{repeatcount}</span>
                            <span class="ph-tag" onclick="insertPlaceholder('f-cmd','{likecount}')">{likecount}</span>
                            <span class="ph-tag" onclick="insertPlaceholder('f-cmd','{totallikecount}')">{totallikecount}</span>
                        </div>
                    </div>
                    <div class="placeholder-group">
                        <span class="placeholder-group-label" style="color:#2196f3;"><i class="fas fa-star"></i> Abonnement</span>
                        <div class="ph-tags">
                            <span class="ph-tag" onclick="insertPlaceholder('f-cmd','{submonth}')" title="Nombre de mois d'abonnement">{submonth}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'alert') {
        container.innerHTML = `
            <div class="form-group"><label>Texte affiché</label><input type="text" id="f-text" placeholder="Merci {nickname} pour {repeatcount} {giftname} !"></div>
            <div class="form-group"><label>Image, GIF ou vidéo (URL, optionnel)</label><input type="text" id="f-media-url" placeholder="https://.../animation.gif ou .mp4"></div>
            <div class="form-group"><label>Durée d'affichage (secondes)</label><input type="number" id="f-alert-duration" min="1" max="60" value="5" style="width: 100px;"></div>
            <p style="font-size: 0.8rem; color: var(--text-dim); margin: 0 0 10px 0;"><i class="fas fa-info-circle"></i> S'affiche dans l'overlay <b>Alertes animées</b> (menu Overlays → Overlays Pro).</p>
            <div class="placeholder-hint-panel">
                <div class="placeholder-hint-title"><i class="fas fa-tags"></i> Paramètres Dynamiques</div>
                <div class="ph-tags">
                    ${['{nickname}', '{username}', '{giftname}', '{repeatcount}', '{coins}', '{comment}', '{likecount}', '{submonth}', '{level}']
                        .map(p => `<span class="ph-tag" onclick="insertPlaceholder('f-text','${p}')">${p}</span>`).join('')}
                </div>
            </div>
        `;
    } else if (type === 'tts') {
        container.innerHTML = `
            <div class="form-group"><label>Texte à lire</label><input type="text" id="f-text" placeholder="Merci {nickname} pour le follow !" required></div>
            <p style="font-size: 0.8rem; color: var(--text-dim); margin: 0 0 10px 0;"><i class="fas fa-info-circle"></i> Lu par le tableau de bord avec la voix choisie dans le module TTS.</p>
            <div class="placeholder-hint-panel">
                <div class="placeholder-hint-title"><i class="fas fa-tags"></i> Paramètres Dynamiques</div>
                <div class="ph-tags">
                    ${['{nickname}', '{username}', '{giftname}', '{repeatcount}', '{coins}', '{comment}', '{likecount}', '{submonth}', '{level}']
                        .map(p => `<span class="ph-tag" onclick="insertPlaceholder('f-text','${p}')">${p}</span>`).join('')}
                </div>
            </div>
        `;
    } else if (type === 'obs') {
        container.innerHTML = `
            <div class="form-group">
                <label>Que faire dans OBS ?</label>
                <select id="f-obs-action">
                    <option value="scene">Changer de scène</option>
                    <option value="source_show">Afficher une source</option>
                    <option value="source_hide">Masquer une source</option>
                    <option value="source_toggle">Basculer une source (afficher / masquer)</option>
                </select>
            </div>
            <div class="form-group"><label>Scène <span style="opacity: 0.6; font-weight: 400;">(pour une source : vide = scène en cours)</span></label>
                <input type="text" id="f-obs-scene" list="obs-scene-list" placeholder="ex: Caméra plein écran">
                <datalist id="obs-scene-list"></datalist>
            </div>
            <div class="form-group" id="f-obs-source-group"><label>Source</label><input type="text" id="f-obs-source" placeholder="ex: Webcam, GIF Danse..."></div>
            <div class="form-group"><label>Revenir en arrière après (secondes, 0 = rester)</label><input type="number" id="f-obs-duration" min="0" max="3600" value="0" style="width: 100px;"></div>
            <div class="placeholder-hint-panel">
                <div class="placeholder-hint-title"><i class="fas fa-plug"></i> Connexion OBS (Outils → Paramètres du serveur WebSocket)</div>
                <div style="display: grid; grid-template-columns: 1fr 90px 1fr auto; gap: 8px; align-items: center;">
                    <input type="text" id="f-obs-host" placeholder="127.0.0.1" value="${escapeHtml(currentObsSettings.host || '127.0.0.1')}">
                    <input type="number" id="f-obs-port" placeholder="4455" value="${escapeHtml(currentObsSettings.port || 4455)}">
                    <input type="password" id="f-obs-password" placeholder="Mot de passe" value="${escapeHtml(currentObsSettings.password || '')}">
                    <button type="button" class="btn-secondary" onclick="testObsConnection()"><i class="fas fa-plug"></i> Tester</button>
                </div>
                <small id="f-obs-status" style="display: block; margin-top: 6px; color: var(--text-dim);"></small>
            </div>
        `;
        const obsActionSelect = document.querySelector('#f-obs-action');
        const toggleSource = () => {
            document.querySelector('#f-obs-source-group').style.display = obsActionSelect.value === 'scene' ? 'none' : 'block';
        };
        obsActionSelect.addEventListener('change', toggleSource);
        toggleSource();
    } else if (type === 'streamerbot') {
        container.innerHTML = `
            <div class="form-group"><label>Action Streamer.bot (nom exact)</label>
                <input type="text" id="f-sb-name" list="sb-action-list" placeholder="ex: Jouer un son">
                <datalist id="sb-action-list"></datalist>
                <input type="hidden" id="f-sb-id">
            </div>
            <div class="form-group"><label>Arguments supplémentaires (JSON, optionnel)</label>
                <input type="text" id="f-sb-args" placeholder='{"message": "Merci {nickname} !"}'>
                <small style="color: var(--text-dim); font-size: 0.8rem;">Toujours envoyés : user, nickname, comment, giftName, giftId, coins, repeatCount, likeCount, trigger.</small>
            </div>
            <div class="placeholder-hint-panel">
                <div class="placeholder-hint-title"><i class="fas fa-plug"></i> Connexion Streamer.bot (Servers/Clients → HTTP Server, port 7474)</div>
                <div style="display: grid; grid-template-columns: 1fr 90px auto; gap: 8px; align-items: center;">
                    <input type="text" id="f-sb-host" placeholder="127.0.0.1" value="${escapeHtml(currentStreamerbotSettings.host || '127.0.0.1')}">
                    <input type="number" id="f-sb-port" placeholder="7474" value="${escapeHtml(currentStreamerbotSettings.port || 7474)}">
                    <button type="button" class="btn-secondary" onclick="testStreamerbotConnection()"><i class="fas fa-plug"></i> Tester</button>
                </div>
                <small id="f-sb-status" style="display: block; margin-top: 6px; color: var(--text-dim);"></small>
            </div>
        `;
        document.querySelector('#f-sb-name').addEventListener('input', (e) => {
            const opt = (window.streamerbotActions || []).find(a => a.name === e.target.value);
            document.querySelector('#f-sb-id').value = opt ? opt.id : '';
        });
    } else if (type === 'wheel') {
        container.innerHTML = `
            <div class="form-group">
                <label>Cases de la roue <span style="opacity: 0.6; font-weight: 400;">(une par ligne, 2 à 24)</span></label>
                <textarea id="f-segments" rows="7" style="width: 100%; resize: vertical;" placeholder="10 pompes&#10;Danse => Action Danse&#10;Rien 😅&#10;Chanson"></textarea>
                <small style="color: var(--text-dim); font-size: 0.8rem;">Ajoutez <b>=&gt; Nom d'une action</b> après une case pour lancer cette action quand la roue tombe dessus.</small>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-dim); margin: 0 0 10px 0;"><i class="fas fa-info-circle"></i> S'affiche dans l'overlay <b>Roue de la fortune</b> (menu Overlays → Overlays Pro).</p>
        `;
    } else if (type === 'sound') {
        container.innerHTML = `
            <div class="form-group">
                <label>Son</label>
                <div style="display: flex; gap: 5px;">
                    <input type="text" id="f-sound-name" placeholder="Choisir un son..." readonly required onclick="openSoundLibrary()" style="cursor: pointer;">
                    <button type="button" class="btn-secondary" onclick="openSoundLibrary()"><i class="fas fa-music"></i></button>
                    <input type="hidden" id="f-sound-url">
                </div>
            </div>
            <div class="form-group">
                <label>Volume (%)</label>
                <input type="number" id="f-sound-volume" min="1" max="100" value="50">
            </div>
        `;
    }
}

// [NEW] Helper to insert placeholder at cursor position
window.insertPlaceholder = (inputId, placeholder) => {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.selectionStart || input.selectionStart == '0') {
        const startPos = input.selectionStart;
        const endPos = input.selectionEnd;
        input.value = input.value.substring(0, startPos) + placeholder + input.value.substring(endPos, input.value.length);
        input.selectionStart = startPos + placeholder.length;
        input.selectionEnd = startPos + placeholder.length;
    } else {
        input.value += placeholder;
    }
    input.focus();
};

async function updateEventFields(eventToEdit = null) {
    const type = document.querySelector('#event-trigger-type').value;
    const container = document.querySelector('#event-trigger-details');
    container.innerHTML = '';

    if (type === 'none' || !type) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    if (type === 'gift') {
        container.innerHTML = '<div class="loader-wrapper"><div class="loading-spinner"></div><span>Chargement des cadeaux...</span></div>';
        try {
            const base = getApiBase();
            const res = await fetch(`${base}/api/gifts`);
            if (!res.ok) throw new Error("Erreur serveur");
            const gifts = await res.json();

            // Cache for filtering
            window.eventGiftsCache = gifts;

            // Container setup with search
            container.innerHTML = `
                <div class="form-group">
                    <label>Sélectionnez un cadeau</label>
                    <div class="input-icon-wrapper" style="margin-bottom: 10px; position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 10px; top: 12px; color: rgba(255,255,255,0.4);"></i>
                        <input type="text" id="event-gift-search" placeholder="Rechercher un cadeau..." 
                               style="width: 100%; padding: 10px 10px 10px 35px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white;"
                               oninput="filterEventGifts(this.value)">
                    </div>
                    <input type="hidden" id="f-gift-id" value="${(eventToEdit && eventToEdit.giftId) || ''}">
                    <input type="hidden" id="f-gift-name" value="${(eventToEdit && eventToEdit.giftName) || ''}">
                    <div class="gift-grid" id="gift-selector" style="max-height: 250px; overflow-y: auto;">
                        <!-- Rendered by JS -->
                    </div>
                </div>
            `;

            // Initial Render
            renderEventGifts(gifts, (eventToEdit && eventToEdit.giftName));

        } catch (e) {
            container.innerHTML = '<div style="color:red">Erreur chargement cadeaux</div>';
        }
    } else if (type === 'like') {
        container.innerHTML = `
            <div class="form-group">
                <label>Nombre de Likes (Taps) requis</label>
                <input type="number" id="f-like-threshold" min="1" value="${(eventToEdit && eventToEdit.likeThreshold) || 1}" placeholder="ex: 10">
                <small style="color: var(--text-dim); font-size: 0.8rem;">L'action se déclenche chaque fois qu'un spectateur atteint ce nombre de likes (cumulés pendant le live). 1 = à chaque like.</small>
            </div>
        `;
    } else if (type === 'command') {
        container.innerHTML = `
            <div class="form-group">
                <label>Commande à taper (sans !)</label>
                <input type="text" id="f-command" value="${(eventToEdit && eventToEdit.command) || ''}" placeholder="ex: jouer, sauter..." required>
                <small style="color: var(--text-dim); font-size: 0.8rem;">Le viewer devra écrire cette commande dans le chat.</small>
            </div>
        `;
    } else if (type === 'chat') {
        container.innerHTML = `
            <div class="form-group">
                <label>Message Chat (Contient)</label>
                <input type="text" id="f-chat-message" value="${(eventToEdit && eventToEdit.message) || ''}" placeholder="ex: bonjour" required>
                <small style="color: var(--text-dim); font-size: 0.8rem;">Le son se lancera si le message contient ce texte.</small>
            </div>
        `;
    } else if (type === 'gift_min') {
        container.innerHTML = `
            <div class="form-group">
                <label>Valeur minimum (pièces)</label>
                <input type="number" id="f-min-coins" min="1" value="${(eventToEdit && eventToEdit.minCoins) || ''}" placeholder="ex: 100" required>
            </div>
        `;
    } else if (type === 'level_up') {
        container.innerHTML = `
            <div class="form-group">
                <label>À partir du niveau</label>
                <input type="number" id="f-min-level" min="1" value="${(eventToEdit && eventToEdit.minLevel) || 1}" placeholder="ex: 5">
                <small style="color: var(--text-dim); font-size: 0.8rem;">Se déclenche quand un spectateur atteint un nouveau niveau grâce à ses points. Variable : {level}.</small>
            </div>
        `;
    }
}


// Listener for audience change
function updateEventWhoFields() {
    const who = document.querySelector('#event-who').value;
    const container = document.querySelector('#event-who-details');
    container.innerHTML = '';

    if (who === 'specific_user') {
        container.innerHTML = `
            <input type="text" id="f-specific-user" placeholder="Pseudo TikTok (sans @)" required>
        `;
    }
}

// Helper to select gift in Quick Sound Modal
window.selectQuickSoundGift = (el, id, name, price) => {
    // Deselect others in qs-gift-grid
    const container = document.getElementById('qs-gift-grid');
    if (container) {
        container.querySelectorAll('.gift-item.selected').forEach(e => e.classList.remove('selected'));
    }
    el.classList.add('selected');
    document.getElementById('qs-gift-name').value = name;
    document.getElementById('qs-gift-id').value = id;
};

window.filterQuickSoundGifts = (query) => {
    if (!window.eventGiftsCache) return;
    const term = query.toLowerCase();
    const filtered = window.eventGiftsCache.filter(g =>
        (g.name && g.name.toLowerCase().includes(term)) ||
        (g.id && g.id.toString().includes(term))
    );
    const selected = document.getElementById('qs-gift-name')?.value;
    window.renderEventGifts(filtered, selected, 'qs-gift-grid', 'window.selectQuickSoundGift');
};

window.updateQuickSoundTriggerFields = () => {
    const typeFn = document.getElementById('qs-trigger-type');
    const type = typeFn ? typeFn.value : 'gift';
    const giftContainer = document.getElementById('qs-gift-container');

    // Create/Toggle Like Threshold
    let likeContainer = document.getElementById('qs-like-container');
    if (!likeContainer) {
        likeContainer = document.createElement('div');
        likeContainer.id = 'qs-like-container';
        likeContainer.className = 'form-group';
        likeContainer.style.marginTop = '15px';
        likeContainer.innerHTML = `
            <label>Nombre de Likes (Seuil) <span style="font-size:0.8em; opacity:0.7;">(Tap Tap)</span></label>
            <input type="number" id="qs-like-threshold" min="1" value="100" placeholder="Ex: 500">
        `;
        giftContainer.parentNode.insertBefore(likeContainer, giftContainer);
    }

    if (type === 'gift') {
        giftContainer.style.display = 'block';
        likeContainer.style.display = 'none';
        if (giftContainer.querySelector('#qs-gift-grid').children.length === 0) {
            window.filterQuickSoundGifts('');
        }
    } else if (type === 'like') {
        giftContainer.style.display = 'none';
        likeContainer.style.display = 'block';
    } else {
        giftContainer.style.display = 'none';
        likeContainer.style.display = 'none';
    }
};

// Helper to render gifts in Event Modal
// Helper to handle gift image errors (Local -> VPS -> Remote -> Fallback)
window.onGiftImgError = (img, id, remoteUrl) => {
    const vpsUrl = `https://tiktok.gentok.fr/img/tiktok/${id}.png`;
    const fallback = 'https://placehold.co/60x60/333/fff?text=Gift';

    // Track attempts to avoid loops and manage sequence
    const attempts = parseInt(img.getAttribute('data-err-count') || '0');
    img.setAttribute('data-err-count', attempts + 1);

    if (attempts === 0) {
        // 1. Try VPS
        img.src = vpsUrl;
    } else if (attempts === 1) {
        // 2. Try Remote API URL
        if (remoteUrl && remoteUrl.startsWith('http')) {
            img.src = remoteUrl;
        } else {
            img.src = fallback;
        }
    } else {
        // 3. Give up
        img.src = fallback;
        img.onerror = null;
    }
};

// Helper to render gifts in Event Modal
// Helper to render gifts in Event Modal
window.renderEventGifts = (gifts, selectedName = null, targetId = 'gift-selector', selectFn = 'selectGift') => {
    const selector = document.getElementById(targetId);
    if (!selector) return;

    if (!gifts || gifts.length === 0) {
        selector.innerHTML = '<div class="text-dim" style="text-align:center; padding:20px; grid-column: 1 / -1;">Aucun cadeau trouvé</div>';
        return;
    }

    // Sort: Selected first, then Price Ascending
    gifts.sort((a, b) => {
        if (selectedName) {
            if (a.name === selectedName) return -1;
            if (b.name === selectedName) return 1;
        }
        const priceA = (a.diamond_count !== undefined ? a.diamond_count : (a.price || 0));
        const priceB = (b.diamond_count !== undefined ? b.diamond_count : (b.price || 0));
        return priceA - priceB;
    });

    selector.innerHTML = gifts.map(g => {
        const isSelected = selectedName === g.name;
        const price = g.diamond_count !== undefined ? g.diamond_count : (g.price || 0);
        const safeName = g.name.replace(/'/g, "\\'");

        // Priority for images:
        // 1. Local path if provided by server (g.icon)
        // 2. Relative local path as fallback
        // 3. Remote URL from API (g.url)
        const vpsIconUrl = g.icon || `img/tiktok/${g.id}.png`;
        const remoteIconUrl = g.url || '';

        return `
            <div class="gift-item ${isSelected ? 'selected' : ''}" 
                 onclick="${selectFn}(this, '${g.id}', '${safeName}', ${price})"
                 title="${g.name} - ${price} pièces">
                
                <div class="gift-icon-container" style="width:64px; height:64px; display:flex; align-items:center; justify-content:center; margin-bottom: 8px; position:relative;">
                   <img src="${vpsIconUrl}" alt="${g.name}" loading="lazy" 
                        class="gift-icon-img"
                        style="max-width:100%; max-height:100%; object-fit:contain;" 
                        onerror="window.onGiftImgError(this, '${g.id}', '${remoteIconUrl}')">
                </div>
                
                <div class="gift-item-info" style="display:flex; flex-direction:column; align-items:center; gap:4px; width:100%;">
                    <span class="gift-name" style="font-size:0.75rem; text-align:center; color:var(--text); font-weight:700; line-height:1.2; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:1.8em;" title="${g.name}">
                        ${g.name}
                    </span>
                    
                    <span class="gift-price" style="font-size:0.8rem; color:#facc15; font-weight:800; background:rgba(250, 204, 21, 0.1); padding:2px 8px; border-radius:10px; display:flex; align-items:center; gap:4px;">
                        <i class="fas fa-gem" style="font-size:0.6rem;"></i>${price}
                    </span>
                </div>
            </div>
        `;
    }).join('');
};

window.filterEventGifts = (query) => {
    if (!window.eventGiftsCache) return;
    const term = query.toLowerCase();
    const filtered = window.eventGiftsCache.filter(g =>
        (g.name && g.name.toLowerCase().includes(term)) ||
        (g.id && g.id.toString().includes(term))
    );
    // Maintain selection state if possible, though re-render might clear "selected" class visual if user hasn't clicked yet.
    // The hidden input holds the true value.
    const currentSelected = document.getElementById('f-gift-name')?.value;
    renderEventGifts(filtered, currentSelected);
};


window.selectGift = (el, id, name, price) => {
    // Remove selected from others
    document.querySelectorAll('.gift-item.selected').forEach(e => e.classList.remove('selected'));
    // Add to clicked
    el.classList.add('selected');
    // Set hidden inputs
    // We usually track gift by ID or Name. The current event system uses Name. Events.json uses 'giftName'.
    // Let's store the name as the primary identifier if that's what the current system expects, or ID if better.
    // The current system checks `data.giftName` in `eventManager`.
    document.querySelector('#f-gift-name').value = name;
    document.querySelector('#f-gift-id').value = id;
};

// ...

async function saveNewAction(e) {
    e.preventDefault();

    // Check for edit ID
    const editIdInput = document.querySelector('#action-edit-id');
    const editId = editIdInput ? editIdInput.value : null;

    const action = {
        id: editId || 'acc_' + Date.now(),
        name: document.querySelector('#action-name').value,
        type: document.querySelector('#action-type').value
    };

    const actionType = document.querySelector('#action-type').value;
    if (!actionType || actionType === 'none') {
        showToast("Veuillez choisir un type d'action !", 'error');
        return;
    }

    if (action.type === 'webhook') action.url = document.querySelector('#f-url').value;
    if (action.type === 'keyboard') {
        let key = document.querySelector('#f-key').value;
        const ctrl = document.querySelector('#f-ctrl').checked;
        const alt = document.querySelector('#f-alt').checked;
        const shift = document.querySelector('#f-shift').checked;

        let prefix = '';
        if (ctrl) prefix += '^';
        if (alt) prefix += '!';
        if (shift) prefix += '+';

        action.key = prefix + key;
        action.duration = parseInt(document.querySelector('#f-duration').value) || 100;
    }
    if (action.type === 'rcon') action.command = document.querySelector('#f-cmd').value;
    if (action.type === 'alert') {
        action.text = document.querySelector('#f-text').value;
        action.mediaUrl = document.querySelector('#f-media-url').value.trim();
        action.alertDuration = parseInt(document.querySelector('#f-alert-duration').value) || 5;
        if (!action.text && !action.mediaUrl) {
            showToast("Ajoutez un texte ou une image/vidéo pour l'alerte !", 'error');
            return;
        }
    }
    if (action.type === 'tts') action.text = document.querySelector('#f-text').value;
    if (action.type === 'obs') {
        action.obsAction = document.querySelector('#f-obs-action').value;
        action.obsScene = document.querySelector('#f-obs-scene').value.trim();
        action.obsSource = document.querySelector('#f-obs-source').value.trim();
        action.obsDuration = Math.max(0, parseInt(document.querySelector('#f-obs-duration').value) || 0);
        if (action.obsAction === 'scene' ? !action.obsScene : !action.obsSource) {
            showToast(action.obsAction === 'scene' ? 'Indiquez le nom de la scène OBS !' : 'Indiquez le nom de la source OBS !', 'error');
            return;
        }
        saveObsSettingsFromForm();
    }
    if (action.type === 'streamerbot') {
        action.sbActionName = document.querySelector('#f-sb-name').value.trim();
        action.sbActionId = document.querySelector('#f-sb-id').value.trim();
        action.sbArgs = document.querySelector('#f-sb-args').value.trim();
        if (!action.sbActionName && !action.sbActionId) {
            showToast('Indiquez le nom de l\'action Streamer.bot !', 'error');
            return;
        }
        if (action.sbArgs) {
            try { JSON.parse(action.sbArgs); } catch (e) { showToast('Arguments : JSON invalide', 'error'); return; }
        }
        saveStreamerbotSettingsFromForm();
    }
    if (action.type === 'wheel') {
        action.segments = document.querySelector('#f-segments').value;
        const count = action.segments.split('\n').map(l => l.trim()).filter(Boolean).length;
        if (count < 2) {
            showToast('La roue doit avoir au moins 2 cases !', 'error');
            return;
        }
    }
    action.cooldown = Math.max(0, parseInt(document.querySelector('#action-cooldown')?.value) || 0);
    action.userCooldown = Math.max(0, parseInt(document.querySelector('#action-user-cooldown')?.value) || 0);
    action.delay = Math.max(0, parseInt(document.querySelector('#action-delay')?.value) || 0);
    if (action.type === 'sound') {
        action.soundName = document.querySelector('#f-sound-name').value;
        action.soundUrl = document.querySelector('#f-sound-url').value;
        action.volume = document.querySelector('#f-sound-volume').value;
    }

    if (editId) {
        // Update existing
        const index = currentActions.findIndex(a => a.id === editId);
        if (index !== -1) currentActions[index] = action;
        showToast('Action modifiée !', 'success');
        // clear ID
        editIdInput.value = '';
    } else {
        // [LIMIT] Non-premium limit: 5 actions per scene
        if (!isPremiumUser && currentActions.length >= 5) {
            showNotify('Limite atteinte', 'Limite de 5 actions atteinte pour cette scène. Devenez Pro pour en ajouter plus !', 'warning');
            openProModal();
            return;
        }
        currentActions.push(action);
        showToast('Action ajoutée !', 'success');
    }

    // [OPTIM] Close modal immediately
    closeModal('modal-action');
    renderActions();
    renderSoundLinks();
    updateActionSelect();
    updateLikesGoalActionSelect();

    // Sync in background
    sync('actions', currentActions).catch(console.error);
}

async function saveNewEvent(e) {
    e.preventDefault();

    // Check for edit ID
    const editIdInput = document.querySelector('#event-edit-id');
    const editId = editIdInput ? editIdInput.value : null;

    const event = {
        id: editId || 'evt_' + Date.now(),
        active: true,
        who: document.querySelector('#event-who').value,
        triggerType: document.querySelector('#event-trigger-type').value,
        actions: Array.from(document.querySelectorAll('#event-action-list input[type="checkbox"]:checked')).map(chk => chk.value)
    };

    const triggerType = document.querySelector('#event-trigger-type').value;
    if (!triggerType || triggerType === 'none') {
        showToast("Veuillez choisir un déclencheur !", 'error');
        return;
    }

    if (event.who === 'specific_user') {
        event.specificUser = document.querySelector('#f-specific-user').value;
    }

    if (event.triggerType === 'gift') {
        const giftNameInput = document.querySelector('#f-gift-name');
        if (!giftNameInput || !giftNameInput.value) {
            showToast("Veuillez sélectionner un cadeau dans la liste !", 'error');
            return;
        }
        event.giftName = giftNameInput.value;
        event.giftId = document.querySelector('#f-gift-id').value;
    }

    if (event.triggerType === 'like') {
        const threshold = document.querySelector('#f-like-threshold');
        event.likeThreshold = threshold ? parseInt(threshold.value) : 1;
    }

    if (event.triggerType === 'command') {
        event.command = document.querySelector('#f-command').value;
    }

    if (event.triggerType === 'chat') {
        event.message = document.querySelector('#f-chat-message').value;
    }

    if (event.triggerType === 'gift_min') {
        event.minCoins = parseInt(document.querySelector('#f-min-coins').value);
    }

    if (event.triggerType === 'level_up') {
        event.minLevel = Math.max(1, parseInt(document.querySelector('#f-min-level').value) || 1);
    }

    // Points shop (Premium): cost paid by the viewer
    event.pointsCost = Math.max(0, parseInt(document.querySelector('#event-points-cost')?.value) || 0);
    if (event.pointsCost > 0 && !isPremiumUser) {
        showNotify('🌟 Gentok Pro', 'La boutique de points est réservée à Gentok Premium.', 'info');
        event.pointsCost = 0;
    }

    // [DUPLICATE TRIGGER GUARD] Block duplicate triggers for the same gift/action
    const existingDuplicate = currentEvents.find(evt => {
        if (editId && evt.id === editId) return false;
        if (evt.triggerType !== event.triggerType) return false;

        if (event.triggerType === 'gift') {
            const name1 = (evt.giftName || '').trim().toLowerCase();
            const name2 = (event.giftName || '').trim().toLowerCase();
            return name1 === name2;
        }

        if (event.triggerType === 'command') {
            const cmd1 = (evt.command || '').trim().toLowerCase();
            const cmd2 = (event.command || '').trim().toLowerCase();
            return cmd1 === cmd2;
        }

        if (event.triggerType === 'like') {
            return evt.likeThreshold === event.likeThreshold;
        }

        if (event.triggerType === 'gift_min') {
            return evt.minCoins === event.minCoins;
        }

        if (event.triggerType === 'level_up') {
            return evt.minLevel === event.minLevel;
        }

        if (event.triggerType === 'follow' || event.triggerType === 'share' || event.triggerType === 'join' || event.triggerType === 'subscribe') {
            return true;
        }

        return false;
    });

    if (existingDuplicate) {
        showToast("Vous avez déjà un déclencheur avec ce cadeau/action !", 'error');
        if (typeof showNotify === 'function') {
            showNotify("Déclencheur en double", "Vous avez déjà un déclencheur configuré avec ce cadeau/action !", 'warning');
        }
        return;
    }

    if (editId) {
        // Update existing
        const index = currentEvents.findIndex(evt => evt.id === editId);
        if (index !== -1) currentEvents[index] = event;
        showToast('Événement modifié !', 'success');
        // Clear ID
        editIdInput.value = '';
    } else {
        // [LIMIT] Non-premium limit: 5 events per scene
        if (!isPremiumUser && currentEvents.length >= 5) {
            showNotify('Limite atteinte', 'Limite de 5 triggers atteinte pour cette scène. Devenez Pro pour en ajouter plus !', 'warning');
            openProModal();
            return;
        }
        currentEvents.push(event);
        showToast('Événement ajouté !', 'success');
    }

    // [UNIQUE SOUND TRIGGER] Ensure a gift trigger is only linked to 1 soundboard sound
    if (event.triggerType === 'gift' && event.giftName) {
        const giftKey = event.giftName.toLowerCase().trim();
        const soundActionIds = event.actions.filter(id => {
            const act = currentActions.find(a => a.id === id);
            return act && act.type === 'sound';
        });

        if (soundActionIds.length > 0) {
            currentEvents.forEach(otherEvt => {
                if (otherEvt.id !== event.id && otherEvt.triggerType === 'gift' && (otherEvt.giftName || '').toLowerCase().trim() === giftKey) {
                    otherEvt.actions = otherEvt.actions.filter(actId => !soundActionIds.includes(actId));
                }
            });
        }
    }

    // [OPTIM] Close modal immediately
    closeModal('modal-event');
    renderEvents();
    renderSoundLinks(); // Immediately refresh soundboard trigger badges

    // Sync in background
    sync('events', currentEvents).catch(console.error);
}

async function sync(type, data) {
    if (isPresetEditMode) return; // Prevent saving to user config during preset edition

    const token = localStorage.getItem('gentok_token');

    // [FIX] Handle array data (actions/events) correctly
    let payload;
    if (Array.isArray(data)) {
        payload = { [type]: data, token: token };
    } else {
        payload = { ...data };
        if (token && !payload.token) payload.token = token;
    }

    const base = getApiBase();
    try {
        await fetch(`${base}/api/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error(`Sync failed for ${type}: `, e);
    }

    // [FIX] In App/Electron mode, ALSO sync to local server so that test-action reads updated config
    // (test-action goes to localhost, which reads its own in-memory config)
    if (window.electronAPI) {
        try {
            const localBase = getLocalApiBase();
            await fetch(`${localBase}/api/${type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error(`Local sync failed for ${type}: `, e);
        }
    }
}

// Bulk Selection Logic
// Bulk Selection Logic
window.toggleSelectAll = (type, checked) => {
    let selector;
    if (type === 'sound') selector = '.chk-item-sound';
    else if (type === 'event') selector = '.chk-item-event';
    else if (type === 'action') selector = '.chk-item-action';

    if (selector) {
        document.querySelectorAll(selector).forEach(chk => {
            chk.checked = checked;
        });
        handleCheckboxChange(type);
    }
};

window.handleCheckboxChange = (type) => {
    let selector;
    let btnId;

    if (type === 'sound') {
        selector = '.chk-item-sound:checked';
        btnId = '#btn-delete-all-sounds';
    } else if (type === 'event') {
        selector = '.chk-item-event:checked';
        btnId = '#btn-delete-all-events';
    } else if (type === 'action') {
        selector = '.chk-item-action:checked';
        btnId = '#btn-delete-all-actions';
    }

    if (!selector || !btnId) return;

    const count = document.querySelectorAll(selector).length;
    const btn = document.querySelector(btnId);
    if (btn) btn.style.display = count > 0 ? 'inline-flex' : 'none';
};

window.deleteSelectedItems = async (type) => {
    let selector;
    if (type === 'sound') selector = '.chk-item-sound:checked';
    else if (type === 'event') selector = '.chk-item-event:checked';
    else if (type === 'action') selector = '.chk-item-action:checked';

    if (!selector) return;

    const selected = Array.from(document.querySelectorAll(selector)).map(chk => chk.value);

    if (selected.length === 0) return;

    let noun = 'élément(s)';
    if (type === 'sound') noun = 'lien(s) audio';
    else if (type === 'event') noun = 'événement(s)';
    else if (type === 'action') noun = 'action(s)';

    const confirmed = await showConfirm(
        'Supprimer la sélection ?',
        `Voulez-vous vraiment supprimer ${selected.length} ${noun} ?`,
        'Supprimer Tout'
    );

    if (!confirmed) return;

    if (type === 'sound') {
        // Delete Actions (Sounds)
        currentActions = currentActions.filter(a => !selected.includes(a.id));
        await sync('actions', currentActions);

        // Cleanup orphaned events
        currentEvents.forEach(evt => {
            evt.actions = evt.actions.filter(id => !selected.includes(id));
        });
        // Remove empty events if they were only for sound
        // Actually keep them but inactive? No, let's keep logic simple
        await sync('events', currentEvents);

        showToast(`${selected.length} sons supprimés.`);
        renderSoundLinks();
        // Uncheck header
        const headerChk = document.querySelector('#chk-all-sounds');
        if (headerChk) headerChk.checked = false;
        const btnDelete = document.querySelector('#btn-delete-all-sounds');
        if (btnDelete) btnDelete.style.display = 'none';

    } else if (type === 'event') {
        // Delete Events
        currentEvents = currentEvents.filter(e => !selected.includes(e.id));
        await sync('events', currentEvents);

        showToast(`${selected.length} événements supprimés.`);
        renderEvents();
        renderSoundLinks(); // Refresh sound links too as they depend on events
        // Uncheck header
        const headerChk = document.querySelector('#chk-all-events');
        if (headerChk) headerChk.checked = false;
        const btnDelete = document.querySelector('#btn-delete-all-events');
        if (btnDelete) btnDelete.style.display = 'none';

    } else if (type === 'action') {
        // Delete Actions (General)
        currentActions = currentActions.filter(a => !selected.includes(a.id));
        await sync('actions', currentActions);

        // Cleanup orphaned events
        currentEvents.forEach(evt => {
            evt.actions = evt.actions.filter(id => !selected.includes(id));
        });
        await sync('events', currentEvents);

        showToast(`${selected.length} actions supprimées.`);
        renderActions();
        renderEvents(); // Refresh events to show removed actions
        // Uncheck header
        const headerChk = document.querySelector('#chk-all-actions');
        if (headerChk) headerChk.checked = false;
        const btnDelete = document.querySelector('#btn-delete-all-actions');
        if (btnDelete) btnDelete.style.display = 'none';
    }
};

window.deleteItem = async (type, id) => {
    const confirmed = await showConfirm(
        'Confirmation',
        `Voulez - vous vraiment supprimer cet ${type === 'action' ? 'action' : 'événement'} ?`,
        'Oui, supprimer'
    );
    if (!confirmed) return;

    if (type === 'action') {
        // 1. Remove the action itself
        currentActions = currentActions.filter(a => a.id !== id);

        // 2. Remove references to this action in all events
        let eventsChanged = false;
        currentEvents.forEach(e => {
            if (e.actions.includes(id)) {
                e.actions = e.actions.filter(aId => aId !== id);
                eventsChanged = true;
            }
        });

        await sync('actions', currentActions);
        if (eventsChanged) {
            await sync('events', currentEvents);
            renderEvents(); // Re-render events to show updated badges
        }
        showToast('Action supprimée !', 'success');
        renderActions();
        renderSoundLinks();
        updateActionSelect();
        updateLikesGoalActionSelect();
    } else {
        currentEvents = currentEvents.filter(e => e.id !== id);
        await sync('events', currentEvents);
        renderEvents();
        showToast('Événement supprimé !', 'success');
    }
};

window.toggleEvent = async (id) => {
    const e = currentEvents.find(evt => evt.id === id);
    if (e) {
        e.active = !e.active;
        await sync('events', currentEvents);
    }
};


// Simplified User Logic
function saveUser(username) {
    const headerUsername = document.querySelector('#header-username');
    if (headerUsername) headerUsername.value = username;
}

async function toggleBot() {
    const isRunning = isBotRunningUI();
    const base = isLocalMode ? getLocalApiBase() : getApiBase();
    const token = localStorage.getItem('gentok_token');

    if (isRunning) {
        // [STOP BOT]
        try {
            // Try socket emission first if we are connected to the target server
            if (socket && socket.connected) {
                console.log('📡 Stopping via Socket...');
                socket.emit('stop_live');
                // UI cleanup will be handled by 'streamEnd' event or call success
            }

            // Fallback/Parallel HTTP call
            await fetch(`${base}/api/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            // [NEW] If Local Mode, ALSO stop Remote (VPS) to ensure sync
            if (isLocalMode) {
                try {
                    const remoteBase = getApiBase(); // Returns PRODUCTION_URL
                    await fetch(`${remoteBase}/api/stop`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token })
                    });
                    console.log('📡 Also stopped Remote VPS.');
                } catch (remErr) {
                    console.warn('⚠️ Could not stop Remote VPS:', remErr);
                }
            }

            // Force UI update
            btnStart.innerHTML = '<i class="fas fa-play"></i><span>Connexion Live</span>';
            btnStart.classList.remove('btn-danger');
            btnStart.classList.add('btn-primary');
            if (statusIndicator) statusIndicator.className = 'status offline';
            if (statusText) statusText.innerText = 'Hors ligne';
            addLog('🛑 Bot arrêté.', 'system');
            showToast('Bot arrêté', 'success');
            updateDiscordPresence();
        } catch (e) {
            console.error('Stop error:', e);
            addLog('❌ Erreur arrêt: ' + e.message, 'error');
        }
    } else {
        // [START BOT]
        const headerUsername = document.querySelector('#header-username');
        const username = headerUsername ? headerUsername.value.trim() : '';

        if (!username || username === '@pseudo' || username === '0') {
            showNotify('Pseudo manquant', 'Veuillez configurer votre pseudo TikTok avant de lancer la connexion.', 'warning');
            return;
        }

        // [PREMIUM] Auto-reset stats if enabled
        const pSettings = JSON.parse(localStorage.getItem('gentok_premium_settings') || '{}');
        if (pSettings.autoReset) {
            console.log('🔄 [PREMIUM] Auto-resetting stats...');
            try {
                const b = isLocalMode ? getLocalApiBase() : getApiBase();
                const t = localStorage.getItem('gentok_token');
                if (t) await fetch(`${b}/api/stats/reset?token=${t}`, { method: 'POST' });
            } catch (resetErr) {
                console.warn('⚠️ Auto-reset failed:', resetErr);
            }
        }

        const res = await startBot(username);
        if (res.success) {
            showToast(`Connexion lancée pour ${username} `, 'success');
        } else {
            addLog('❌ Échec : ' + (res.message || 'Erreur inconnue'), 'error');
            showNotify('Erreur de connexion', res.message || 'Impossible de se connecter.', 'error');
        }
    }
}

async function handleSaveMinecraft() {
    const portVal = parseInt(document.querySelector('#mc-port').value);
    const settings = {
        minecraft: {
            host: document.querySelector('#mc-host').value,
            port: isNaN(portVal) ? 4567 : portVal,
            password: document.querySelector('#mc-password').value,
            playerName: document.querySelector('#mc-playername').value
        }
    };

    try {
        await sync('settings', settings);
        addLog('✅ Paramètres Minecraft sauvegardés', 'success');
        showToast('Paramètres Minecraft enregistrés !', 'success');

        // [AUTO-OP] If server is running, op the player immediately
        const pseudo = settings.minecraft.playerName;
        if (pseudo && lastMcStatus && lastMcStatus.paper === 'online') {
            window.electronAPI.sendMinecraftCommand(`op ${pseudo}`);
        }
    } catch (e) {
        addLog('❌ Erreur sauvegarde Minecraft: ' + e.message, 'error');
        showNotify('Erreur', 'Échec de la sauvegarde', 'error');
    }
}

async function handleTestMinecraft() {
    const host = document.querySelector('#mc-host').value;
    const port = document.querySelector('#mc-port').value;
    const password = document.querySelector('#mc-password').value;
    const resultEl = document.querySelector('#mc-test-result');

    resultEl.innerText = "Test en cours...";
    resultEl.style.color = "var(--text-muted)";

    try {
        const base = window.electronAPI ? getLocalApiBase() : getApiBase();
        const res = await fetch(`${base}/api/minecraft/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, port, password })
        });
        const data = await res.json();

        if (data.success) {
            resultEl.innerText = data.message;
            resultEl.style.color = "#4CAF50";
            showToast(data.message, 'success');
        } else {
            resultEl.innerText = data.message;
            resultEl.style.color = "#FF5252";
            showNotify('Erreur', data.message, 'error');
        }
    } catch (e) {
        resultEl.innerText = "Erreur: " + e.message;
        resultEl.style.color = "#FF5252";
        showNotify('Erreur', e.message, 'error');
    }
}

// License Logic
async function handleVerifyLicense() {
    const tokenInput = document.querySelector('#license-token');
    const token = tokenInput.value.trim();
    const errorMsg = document.querySelector('#login-error');

    if (!token) {
        errorMsg.innerText = "Veuillez entrer un token.";
        errorMsg.style.display = 'block';
        return;
    }

    try {
        let base = getApiBase();

        // [RESILIENCE] If we are on HTTPS (Production Dashboard) and trying to reach Local (HTTP),
        // we might be blocked. Or the local server is just not up.
        // We TRY the current base (which could be localhost or VPS).
        let res;
        try {
            res = await fetch(`${base}/api/verify-license?token=${encodeURIComponent(token)}`);
        } catch (e) {
            console.warn("⚠️ Fetch failed on base:", base, "Trying VPS fallback...");
            // Force VPS fallback if localhost failed
            res = await fetch(`https://tiktok.gentok.fr/api/verify-license?token=${encodeURIComponent(token)}`);
        }

        const data = await res.json();

        if (data.error) {
            errorMsg.innerText = data.error;
            errorMsg.style.display = 'block';
        } else if (data.expired) {
            errorMsg.innerText = "Licence expirée le " + data.expiration;
            errorMsg.style.display = 'block';
        } else {
            // Valid License
            showUsernameStep();

            // [SYNC] If we verified on VPS but we are in App Mode (Local), 
            // we MUST tell the local server our token so it can load data.
            if (isLocalMode) {
                try {
                    // Sync only if we are actually in app mode
                    await fetch('http://localhost:3000/api/verify-license?token=' + encodeURIComponent(token));
                    console.log('✅ Token synchronized to local app server');
                } catch (e) {
                    console.error('❌ Failed to sync token to local server:', e.message);
                }
            }
        }
    } catch (e) {
        console.error('Verification error:', e);
        errorMsg.innerText = "Erreur de vérification. (Vérifiez votre connexion)";
        errorMsg.style.display = 'block';
    }
}

function showUsernameStep() {
    const stepLicense = document.querySelector('#step-license');
    if (stepLicense) stepLicense.style.display = 'none';

    const stepUsername = document.querySelector('#step-username');
    if (stepUsername) stepUsername.style.display = 'block';

    const loginError = document.querySelector('#login-error');
    if (loginError) loginError.style.display = 'none';

    // Auto-focus username input
    const usernameInput = document.querySelector('#login-username');
    if (usernameInput) usernameInput.focus();
}

async function checkSavedLicense() {
    const tokenInput = document.querySelector('#license-token');
    const token = tokenInput ? tokenInput.value : '';

    if (token) {
        if (tokenInput) tokenInput.value = token;
        // Auto-verify
        try {
            const res = await fetch(`/api/verify-license?token=${encodeURIComponent(token)}`);
            const data = await res.json();
            if (data && !data.expired && !data.error) {
                showUsernameStep();
                // We no longer auto-login here to respect "connection after dashboard load"
            }
        } catch (e) {
            console.error('Auto-verify failed:', e);
        }
    }
}

async function handleLogin() {
    const username = document.querySelector('#login-username').value;
    const errorMsg = document.querySelector('#login-error');

    if (!username) {
        errorMsg.innerText = "Veuillez entrer un pseudo.";
        errorMsg.style.display = 'block';
        return;
    }

    errorMsg.style.display = 'none';
    const result = await startBot(username);

    if (result.success) {
        saveUser(username); // Save on success
        document.querySelector('#login-overlay').classList.add('hidden');
    } else {
        if (result.error === 'OFFLINE') {
            errorMsg.innerText = "Pas en live ! Réappuyez sur votre pseudo quand vous serez en live.";
        } else {
            errorMsg.innerText = result.message || "Erreur lors de la connexion.";
        }
        errorMsg.style.display = 'block';
    }
}

async function startBot(username, silent = false) {
    // Use Local Engine if in App Mode, otherwise VPS (which might relay).
    // "Cloud" (Settings > Connexion au live): even in the app, the live runs on the Gentok servers.
    const cloud = window.gentokRunMode === 'cloud';
    const base = (isLocalMode && !cloud) ? getLocalApiBase() : getApiBase();
    const token = localStorage.getItem('gentok_token');
    if (cloud) return await startBotHttp(username, base, token, silent);

    if (!silent) {
        addLog(`🛰️ Lancement de la connexion pour ${username}...`, 'info');
        btnStart.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Connexion...</span>';
    }

    // [NEW] If Local Mode, KILL any active Remote VPS session first to avoid duplicates
    if (isLocalMode) {
        try {
            console.log('📡 [LOCAL] Killing any active Remote VPS session...');
            const remoteBase = getApiBase(); // Returns PRODUCTION_URL
            await fetch(`${remoteBase}/api/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
        } catch (remErr) {
            console.warn('⚠️ Could not kill Remote VPS:', remErr);
        }
    }

    console.log(`📡 Starting Bot for ${username} at ${base}...`);

    // 1. Try Socket Emission first (Best for Local Engine)
    if (socket && socket.connected) {
        // If we choose Socket, we wrap in promise to handle response or timeout
        return new Promise((resolve) => {
            socket.emit('setUniqueId', { uniqueId: username, token: token }, (response) => {
                if (response && response.success) {
                    if (!silent) {
                        btnStart.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Connexion...</span>';
                        addLog('📡 Commande de connexion envoyée...', 'info');
                    }
                    resolve({ success: true });
                } else {
                    resolve({ success: false, fallback: true });
                }
            });
            setTimeout(() => resolve({ success: false, fallback: true }), 2500);
        }).then(async (res) => {
            if (res.success) return res;
            // If socket failed or timed out, try HTTP fallback
            return await startBotHttp(username, base, token, silent);
        });
    }

    // 2. Direct HTTP Start
    return await startBotHttp(username, base, token, silent);
}

// Internal helper for HTTP start logic
async function startBotHttp(username, base, token, silent = false) {
    try {
        const res = await fetch(`${base}/api/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, token })
        });

        const data = await res.json().catch(() => ({}));

        if (res.status === 202) {
            // RELAYED TO APP (via VPS)
            btnStart.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Connexion...</span>';
            addLog('📡 Commande relayée à l\'application locale.', 'info');
            showToast('Relais actif : démarrage lancé sur votre PC', 'success');
            return { success: true };
        }

        if (res.status === 409) {
            return { success: false, error: 'ALREADY_CONNECTED', message: 'Le bot est déjà lancé.' };
        }

        if (res.ok) {
            // For Direct HTTP, res.ok is only sent AFTER connector.start() which now waits for connection
            btnStart.innerHTML = '<i class="fas fa-stop"></i><span>Arrêter</span>';
            btnStart.classList.remove('btn-primary');
            btnStart.classList.add('btn-danger');

            addLog(`✅ Connexion Live établie (${base.includes('localhost') ? 'Local' : 'VPS'}).`, 'success');
            updateDiscordPresence();
            return { success: true };
        } else {
            if (!silent) {
                btnStart.innerHTML = '<i class="fas fa-play"></i><span>Connexion Live</span>';
            }
            return { success: false, message: data.message || 'Erreur de connexion' };
        }
    } catch (err) {
        console.error("startBotHttp Error:", err);
        if (!silent) {
            btnStart.innerHTML = '<i class="fas fa-play"></i><span>Connexion Live</span>';
        }
        return { success: false, message: 'Le serveur cible est injoignable.' };
    }
}

// [CLEANUP] Removed duplicate addLog function from here




// function openModal(id) { 
//     document.getElementById(id).style.display = 'flex'; 
//     // If opening for 'new', clear edit-ids if they exist to prevent update mode
//     if (id === 'modal-action') {
//         const f = document.querySelector('#action-edit-id');
//         if(f) f.value = '';
//         document.querySelector('#form-action').reset();
//     }
//     if (id === 'modal-event') {
//         const f = document.querySelector('#event-edit-id');
//         if(f) f.value = '';
//         document.querySelector('#form-event').reset();
//         // Reset dynamic containers
//         document.querySelector('#event-trigger-details').innerHTML = '';
//         document.querySelector('#event-who-details').innerHTML = '';
//     }
// }
const btnNewAction = document.getElementById('btn-new-action');
if (btnNewAction) {
    btnNewAction.addEventListener('click', () => {
        document.getElementById('form-action').reset();
        const editId = document.querySelector('#action-edit-id');
        if (editId) editId.value = '';
        document.querySelector('#action-details-container').innerHTML = '';

        // Sync custom dropdowns
        syncCustomSelect('action-type');

        openModal('modal-action');
    });
}

const btnNewEvent = document.getElementById('btn-new-event');
if (btnNewEvent) {
    btnNewEvent.addEventListener('click', () => {
        document.getElementById('form-event').reset();
        const editId = document.querySelector('#event-edit-id');
        if (editId) editId.value = '';
        document.querySelector('#event-trigger-details').innerHTML = '';
        document.querySelector('#event-trigger-details').style.display = 'none';

        // Sync custom dropdowns
        syncCustomSelect('event-who');
        syncCustomSelect('event-trigger-type');

        openModal('modal-event');
    });
}
window.openModal = (id) => {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        el.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

function resetActionForm() {
    const f = document.querySelector('#action-edit-id');
    if (f) f.value = '';
    const form = document.querySelector('#form-action');
    if (form) form.reset();
    document.querySelector('#action-details-container').innerHTML = '';
}

function resetEventForm() {
    const f = document.querySelector('#event-edit-id');
    if (f) f.value = '';
    const form = document.querySelector('#form-event');
    if (form) form.reset();
    document.querySelector('#event-trigger-details').innerHTML = '';
    document.querySelector('#event-who-details').innerHTML = '';

    // Safety: ensure any gift hidden fields are also cleared if they weren't in the container
    const gName = document.querySelector('#f-gift-name');
    if (gName) gName.value = '';
    const gId = document.querySelector('#f-gift-id');
    if (gId) gId.value = '';
}
window.closeModal = (id) => {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
        document.body.style.overflow = '';
    }
};



// Navigation Logic
window.showSection = (sectionId) => {
    // Check if section is locked (Premium only)
    const navItem = document.querySelector(`.nav-links a[href="#${sectionId}"]`)?.parentElement;
    if (navItem && navItem.classList.contains('locked')) {
        showNotify("🌟 Gentok Pro", "Cette fonctionnalité nécessite un compte Gentok Pro !", 'info');
        return;
    }

    // Hide all sections
    const sections = ['dashboard', 'actions', 'events', 'logs', 'soundboard', 'settings', 'stats', 'presets', 'tts-chat', 'overlays', 'admin', 'ranking', 'minecraft', 'games', 'points', 'premium', 'battle', 'simulator', 'gallery', 'giveaway'];
    sections.forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if (el) el.style.display = 'none';
    });

    // Show target
    const target = document.getElementById(`${sectionId}-section`);
    if (target) {
        target.style.display = (sectionId === 'dashboard') ? 'flex' : 'block';
    }

    // [NEW] Update Header Title
    const headerTitle = document.querySelector('header h1');
    if (headerTitle) {
        const titles = {
            'dashboard': 'Tableau de bord',
            'actions': 'Mes Actions',
            'events': 'Événements',
            'presets': 'Bibliothèque de Presets',
            'minecraft': 'Minecraft Box TNT',
            'games': 'Bibliothèque',
            'overlays': 'Overlays & Widgets',
            'soundboard': 'Soundboard',
            'tts-chat': 'TTS & Chat Vocal',
            'stats': 'Historique des Lives',
            'settings': 'Paramètres',
            'logs': 'Console / Logs',
            'admin': 'Administration Système',
            'ranking': 'Classement',
            'points': 'Utilisateurs & Points',
            'premium': 'Mon offre',
            'battle': "Batailles d'équipes",
            'simulator': "Simulateur d'événements",
            'gallery': "Galerie d'overlays",
            'giveaway': 'Giveaway & Points Drop',
            'donors': 'Donateurs présents'
        };
        headerTitle.textContent = titles[sectionId] || 'Gentok';
    }

    // Update active nav
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    // If it's an overlay sub-hash but showSection was called with 'overlays'
    const activeLink = document.querySelector(`.nav-links a[onclick*="'${sectionId}'"]`) || document.querySelector(`.nav-links a[href="#${sectionId}"]`);
    if (activeLink) activeLink.parentElement.classList.add('active');

    // Load specific data if needed
    if (sectionId === 'soundboard') {
        renderSoundLinks();
        loadSoundboard();
    }

    if (sectionId === 'stats') {
        renderStatsHistory();
    }

    // New pages (public/pro.js)
    if (window.GentokPro && typeof window.GentokPro.onSection === 'function') window.GentokPro.onSection(sectionId);

    if (sectionId === 'ranking') {
        // Default to legends tab
        if (typeof switchRankingTab === 'function') {
            const firstTab = document.querySelector('#ranking-section .btn-tab:first-child');
            switchRankingTab('legends', firstTab);
        }
    }

    if (sectionId === 'presets') {
        loadPresets();
    }

    if (sectionId === 'overlays') {
        updateOverlayLinks();
    }

    if (sectionId === 'admin') {
        console.log('[DEBUG] Opening admin section');
        const adminSection = document.getElementById('admin-section');
        if (adminSection) {
            // Remove the card background as requested
            adminSection.style.cssText = 'display: block !important; padding: 0 0 30px 0; height: auto !important; min-height: 80vh; background: transparent; backdrop-filter: none; border: none; visibility: visible !important; opacity: 1 !important;';

            // Show Users tab (it's the only one)
            const firstTab = document.getElementById('admin-tab-users');
            if (firstTab) firstTab.style.display = 'block';

            // Update title
            const adminTitle = document.querySelector('#admin-section h2');
            if (adminTitle) adminTitle.innerHTML = '<i class="fas fa-shield-alt" style="color: #ff4444; margin-right: 10px;"></i> Administration';

            loadAdminUsers();
        } else {
            console.error('[ADMIN] Section #admin-section NOT FOUND in DOM');
        }
    }

    if (sectionId === 'minecraft') {
        loadMinecraftPresets('tnt');

        // [AUTO-DETECT] Check if MC is already installed to update buttons
        if (window.electronAPI && window.electronAPI.isMinecraftInstalled) {
            window.electronAPI.isMinecraftInstalled().then(installed => {
                const btnInstall = document.getElementById('btn-mc-install');
                const btnStart = document.getElementById('btn-mc-start');
                if (installed) {
                    if (btnInstall) btnInstall.style.display = 'none';
                    if (btnStart) btnStart.style.display = 'block';
                } else {
                    // [FIX] Fully reset install button in case it was stuck in "Installation..." state
                    if (btnInstall) {
                        btnInstall.style.display = 'block';
                        btnInstall.disabled = false;
                        btnInstall.innerHTML = '<i class="fas fa-download"></i> Installation';
                    }
                    if (btnStart) btnStart.style.display = 'none';
                }
            });
        }
    }

    // [NEW] Always refresh sidebar limits/UI whenever switching sections
    if (window.renderInstalledPresets) renderInstalledPresets();

    // [NEW] Update Discord RPC
    updateDiscordPresence();
};

// Handle initial hash or default
function handleRouting() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    showSection(hash);
}

// PRESETS SYSTEM LOGIC
// OVERLAY ACCORDION LOGIC
window.toggleOverlayAccordion = (header) => {
    const item = header.parentElement;
    const body = item.querySelector('.overlay-body');
    const icon = header.querySelector('.transition-icon');
    const isActive = item.classList.contains('active');

    // Close all others
    document.querySelectorAll('.overlay-item').forEach(el => {
        el.classList.remove('active');
        const b = el.querySelector('.overlay-body');
        if (b) b.style.display = 'none';

        const i = el.querySelector('.transition-icon');
        if (i) {
            i.classList.remove('fa-chevron-down');
            i.classList.add('fa-chevron-right');
        }

        // Reset styles for inactive headers
        const h = el.querySelector('.overlay-header');
        if (h) {
            h.style.background = 'rgba(255,255,255,0.03)';
            h.style.color = 'white';
        }
        el.style.borderColor = 'var(--border)';
    });

    if (!isActive) {
        item.classList.add('active');
        body.style.display = 'block';
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');

        // Highlight active header
        header.style.background = 'var(--primary)';
        header.style.color = 'white';
        item.style.borderColor = 'var(--primary)';
        body.style.borderColor = 'var(--primary)'; // Border top
    }
};

// Open specific overlay from sidebar
// Open specific overlay from sidebar
window.activateOverlay = (targetId) => {
    updateOverlayLinks(); // Ensure links have tokens
    // Wait for view transition
    setTimeout(() => {
        const item = document.getElementById(`overlay-item-${targetId}`);
        if (item) {
            const header = item.querySelector('.overlay-header');
            if (header) {
                // Only toggle if not already active to avoid closing it
                if (!item.classList.contains('active')) {
                    toggleOverlayAccordion(header);
                }

                // Scroll to it
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Update sidebar active state manually for sub-categories
                document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
                const sidebarLink = document.querySelector(`.nav-links a[onclick*="'${targetId}'"]`);
                if (sidebarLink) sidebarLink.parentElement.classList.add('active');
            }
        }
    }, 100);
};

function updateOverlayLinks() {
    const token = localStorage.getItem('gentok_token');
    if (!token) return;

    // Target readonly inputs which contain the URLs
    const inputs = document.querySelectorAll('#overlays-section input[readonly]');
    inputs.forEach(input => {
        let url = input.value;
        // Field not filled yet (its config hasn't loaded): an empty URL would make the preview
        // iframe load "?token=..." i.e. the dashboard itself, which then plays every alert and TTS again
        if (!/\/overlay[/_]/.test(url)) return;
        // Strip existing token if present (matches both ?token= and &token=)
        if (url.includes('token=')) {
            const separator = url.includes('?token=') ? '?token=' : '&token=';
            url = url.split(separator)[0];
        }

        // Determine if we need ? or & to append token (+ the dashboard language for the overlay texts)
        const hasQuery = url.includes('?');
        const uiLang = window.GentokI18n ? window.GentokI18n.lang : 'fr';
        // Always pinned: OBS / TikTok Live Studio browsers are often in English whatever the streamer's language
        const langParam = !url.includes('lang=') ? `&lang=${uiLang}` : '';
        const fullUrl = `${url}${hasQuery ? '&' : '?'}token=${token}${langParam}`;
        input.value = fullUrl;

        // Also update any preview iframes within the same container
        const card = input.closest('.overlay-item, .overlay-sub-item, .leaderboard-config-card');
        if (card) {
            const iframe = card.querySelector('iframe');
            if (iframe) {
                // Only update if src is different to avoid unnecessary reloads
                const currentSrc = iframe.src;
                const isSameUrl = currentSrc === fullUrl || currentSrc.endsWith(fullUrl);

                if (!isSameUrl) {
                    iframe.src = fullUrl;
                }

                // [NEW] Dynamic height for leaderboards
                if (fullUrl.includes('/overlay/leaderboard')) {
                    const params = new URLSearchParams(url.split('?')[1]);
                    const limit = params.get('limit') || 10;
                    const height = (parseInt(limit) || 10) * 42 + 60;
                    iframe.style.height = height + 'px';
                    if (iframe.parentElement) iframe.parentElement.style.height = height + 'px';
                } else if (fullUrl.includes('/overlay/top-gift') || fullUrl.includes('/overlay/top-streak')) {
                    // Force 350px for gift and streak
                    iframe.style.height = '350px';
                    if (iframe.parentElement) iframe.parentElement.style.height = '350px';
                }
            }
        }

        // Update sibling buttons if present
        const copyBtn = input.nextElementSibling;
        if (copyBtn && copyBtn.tagName === 'BUTTON') {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(fullUrl);
                showToast('Copié !', 'success');
            };

            const openBtn = copyBtn.nextElementSibling;
            if (openBtn && openBtn.tagName === 'BUTTON') {
                openBtn.onclick = () => {
                    window.open(fullUrl, '_blank');
                };

                const testBtn = openBtn.nextElementSibling;
                if (testBtn && testBtn.tagName === 'BUTTON') {
                    // The type is derived from the URL like /overlay/last-follower
                    const match = url.match(/\/overlay\/last-(.*)$/);
                    if (match) {
                        let type = match[1];
                        if (type === 'chatter' || type === 'chat') type = 'chat';
                        if (type === 'gifter') type = 'gift';
                        testBtn.onclick = (e) => testOverlay(type, e.currentTarget, fullUrl);
                    }
                }
            }
        }
    });
}

window.switchPresetTab = (tabId, btn) => {
    // Hide all
    document.getElementById('presets-discover').style.display = 'none';
    document.getElementById('presets-installed').style.display = 'none';
    // Remove active class
    document.querySelectorAll('#presets-section .btn-tab').forEach(b => b.classList.remove('active'));

    // Show target
    document.getElementById(`presets-${tabId}`).style.display = 'block';
    if (btn) btn.classList.add('active');

    if (tabId === 'installed') renderInstalledPresets();
    else loadPresets();
};

const searchInputPresets = document.getElementById('presets-search');
if (searchInputPresets) {
    searchInputPresets.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('#presets-grid .preset-card');
        cards.forEach(card => {
            const title = card.querySelector('.preset-title').textContent.toLowerCase();
            const desc = card.querySelector('.preset-desc').textContent.toLowerCase();
            if (title.includes(q) || desc.includes(q)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// Global state for Admin
// (Defined at top of file)

window.loadPresets = async () => {
    const grid = document.getElementById('presets-grid');
    // We fetch even if grid is missing to populate window._allPresets for the sidebar

    if (grid) grid.innerHTML = '<div class="loading-spinner">Chargement des scènes...</div>';

    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/presets?token=${token || ''}`);
        const presets = await res.json();

        // Store presets globally
        window._allPresets = presets;

        // Show publish button if admin
        const btnPublish = document.getElementById('btn-publish-preset');
        if (btnPublish) btnPublish.style.display = isAdmin ? 'block' : 'none';

        // Update Sidebar/Limits since we now have titles
        updateSceneUI();
        renderInstalledPresets();

        if (!grid) return;
        grid.innerHTML = '';
        if (presets.length === 0) {
            grid.innerHTML = '<div class="text-dim" style="grid-column: 1/-1; text-align: center; padding: 40px;">Aucun preset disponible pour le moment.</div>';
            return;
        }

        presets.forEach(p => {
            const card = document.createElement('div');
            card.className = 'preset-card';
            card.innerHTML = `
                <div class="preset-img-wrapper">
                    ${p.img ? `<img src="${p.img}" class="preset-img" alt="${p.title}">` : '<div class="preset-img-placeholder"><i class="fas fa-cubes"></i></div>'}
                    ${isAdmin ? `
                        <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 5px;">
                            <button class="btn-icon" style="background: rgba(0,0,0,0.6);" onclick="event.stopPropagation(); editGlobalPreset('${p.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon delete" style="background: rgba(0,0,0,0.6);" onclick="event.stopPropagation(); deleteGlobalPreset('${p.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
                <div class="preset-content">
                    <div class="preset-badge-group">
                        <span class="preset-badge ${p.badge}">${p.badge}</span>
                        <span class="preset-badge" style="background: rgba(255,255,255,0.05); color: #fff;">${p.type}</span>
                    </div>
                    <h3 class="preset-title">${p.title}</h3>
                    <p class="preset-desc">${p.desc}</p>
                    <div class="preset-footer">
                        <div class="preset-stats">
                            <span><i class="fas fa-list"></i> ${p.rules} Règles</span>
                            <span><i class="fas fa-user-edit"></i> ${p.creator}</span>
                        </div>
                        <button class="btn-primary btn-mini" onclick="event.stopPropagation(); installPreset('${p.id}', '${p.title.replace(/'/g, "\\'")}')">
                            <i class="fas fa-download"></i> Installer
                        </button>
                    </div>
                </div>
            `;

            // Add click handler to show preset details
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => viewPresetDetails(p.id));

            grid.appendChild(card);
        });

        // Always update installed list / limits UI even in discover tab
        renderInstalledPresets();
    } catch (err) {
        grid.innerHTML = '<div class="error">Erreur de chargement des presets.</div>';
    }
};

// ==========================================
// [NEW] MINECRAFT GENTOK BOX LOGIC
// ==========================================
window.loadMinecraftPresets = async (filterType = 'tnt', btn = null) => {
    const list = document.getElementById('mc-presets-list');
    if (!list) return;

    // Handle Active Tab UI
    if (btn) {
        document.querySelectorAll('.mc-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; opacity:0.5;">Chargement des presets Minecraft...</td></tr>';

    if (!window._allPresets) await loadPresets();

    let mcPresets = (window._allPresets || []).filter(p =>
        p.title?.toLowerCase().includes('minecraft') ||
        p.desc?.toLowerCase().includes('minecraft') ||
        p.type?.toLowerCase() === 'minecraft'
    );

    if (filterType === 'tnt') {
        mcPresets = mcPresets.filter(p =>
            p.title?.toLowerCase().includes('tnt') ||
            p.desc?.toLowerCase().includes('tnt')
        );
    }

    list.innerHTML = '';
    if (mcPresets.length === 0) {
        list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:40px; opacity:0.5;">
            <i class="fas fa-folder-open" style="font-size: 2rem; display: block; margin-bottom: 15px;"></i>
            Aucun preset ${filterType === 'tnt' ? 'TNT' : 'Minecraft'} disponible.
        </td></tr>`;
        return;
    }

    if (filterType === 'tnt') {
        mcPresets = mcPresets.filter(p =>
            p.title?.toLowerCase().includes('tnt') ||
            p.desc?.toLowerCase().includes('tnt')
        );

        // Mock some TNT presets if none found for demo
        if (mcPresets.length === 0) {
            mcPresets.push({
                id: 'mock-tnt-1',
                title: 'Gentok TNT Run - Full Setup',
                creator: 'Gentok Team',
                rules: 18,
                overlays: 6,
                img: 'https://i.ytimg.com/vi/R7_fN8B_3h0/maxresdefault.jpg' // Example TNT image
            });
        }
    }

    list.innerHTML = '';
    if (mcPresets.length === 0) {
        list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:40px; opacity:0.5;">
            <i class="fas fa-folder-open" style="font-size: 2rem; display: block; margin-bottom: 15px;"></i>
            Aucun preset ${filterType === 'tnt' ? 'TNT' : 'Minecraft'} disponible.
        </td></tr>`;
        return;
    }

    mcPresets.forEach(p => {
        const row = document.createElement('tr');
        row.style.background = 'transparent';
        row.innerHTML = `
            <td style="padding: 0; border: none;">
                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 18px; padding: 15px 25px; display: flex; align-items: center; justify-content: space-between; transition: all 0.3s ease; cursor: pointer; margin-bottom: 10px;" 
                     class="preset-item-hover" onclick="installPreset('${p.id}', '${p.title.replace(/'/g, "\\'")}')">
                    
                    <div style="display: flex; align-items: center; gap: 18px; flex: 1;">
                        <div style="width: 54px; height: 54px; border-radius: 14px; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); position: relative;">
                            ${filterType === 'tnt' ? '<div style="position:absolute; top:4px; right:4px; width:10px; height:10px; background:#ff4444; border-radius:50%; box-shadow:0 0 10px #ff4444; z-index:5;"></div>' : ''}
                            <img src="${p.img || 'https://gentok.fr/img/logo.png'}" style="width: 100%; height: 100%; object-fit: cover;" alt="">
                        </div>
                        <div>
                            <div style="font-weight: 800; font-size: 1.05rem; color: #fff; margin-bottom: 3px; display: flex; align-items: center; gap: 8px;">
                                ${p.title}
                                ${filterType === 'tnt' ? '<span style="font-size: 0.6rem; background: #ff4444; color: white; padding: 2px 6px; border-radius: 4px;">EXPLOSIF</span>' : ''}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-dim); font-weight: 600;">Configuration par ${p.creator}</div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 40px; margin: 0 40px;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <span style="font-size: 0.95rem; font-weight: 800; color: var(--secondary);">${p.rules}</span>
                            <span style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); font-weight: 700;">Règles</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <span style="font-size: 0.95rem; font-weight: 800; color: var(--primary);">${p.overlays || p.overlayCount || 0}</span>
                            <span style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); font-weight: 700;">Overlays</span>
                        </div>
                    </div>

                    <button class="btn-primary" style="height: 44px; padding: 0 25px; border-radius: 12px; font-weight: 800; font-size: 0.8rem; background: #fff; color: #000; border: none; display: flex; align-items: center; gap: 10px; box-shadow: 0 4px 15px rgba(255,255,255,0.1);">
                        <i class="fas fa-plus"></i> INSTALLER
                    </button>
                </div>
            </td>
        `;
        list.appendChild(row);
    });
};

function updateMCStatusUI(status) {
    const pap = document.getElementById('st-paper');
    const st = document.getElementById('st-servertap');
    const btnStart = document.getElementById('btn-mc-start');

    // Helper to style status boxes
    const setStatus = (el, isActive, textActive, textInactive) => {
        if (!el) return;
        if (isActive) {
            el.innerHTML = `<i class="fas fa-circle" style="color: #10b981; font-size: 0.5rem; filter: drop-shadow(0 0 5px #10b981);"></i> ${textActive}`;
            el.style.color = '#10b981';
        } else {
            el.innerHTML = `<i class="fas fa-circle" style="color: #555; font-size: 0.5rem;"></i> ${textInactive}`;
            el.style.color = '#555';
        }
    };

    const isOnline = status.paper === 'online';
    const mcAddress = document.getElementById('mc-host')?.value || 'localhost';
    const mcPort = document.getElementById('mc-port')?.value || '25565';

    setStatus(pap, isOnline, `En ligne (${mcAddress}:${mcPort})`, 'Arrêté');
    setStatus(st, status.servertap === 'connected', 'Connecté', 'Déconnecté');

    // Update Start/Stop button
    if (btnStart) {
        btnStart.disabled = false;
        if (isOnline) {
            btnStart.innerHTML = '<i class="fas fa-stop"></i> Arrêter';
            btnStart.style.background = '#fe2c55'; // Use Gentok red
        } else {
            btnStart.innerHTML = '<i class="fas fa-play"></i> Lancer';
            btnStart.style.background = ''; // Default style
        }
    }

    const btnRestart = document.getElementById('btn-mc-restart');
    if (btnRestart) {
        btnRestart.style.display = isOnline ? 'block' : 'none';
        btnRestart.disabled = false;
        btnRestart.innerHTML = '<i class="fas fa-undo"></i> Redémarrer';
    }
}

let lastMcStatus = null;

// IPC Listeners for MC
if (window.electronAPI) {
    window.electronAPI.onMinecraftLog((log) => {
        // Dashboard Log
        addLog(`[GentokBox] ${log}`, 'info');

        // Modal Console Log
        const consoleEl = document.getElementById('mc-console');
        if (consoleEl) {
            const div = document.createElement('div');
            div.style.marginBottom = '5px';
            div.innerHTML = `<span style="color: #666;">[${new Date().toLocaleTimeString()}]</span> ${log}`;
            consoleEl.appendChild(div);
            // Auto scroll
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }

        if (log.includes('✅')) showToast(log, 'success');

        // [AUTO-OP] Detect when server is ready and op the player
        if (log.toLowerCase().includes('done') && log.includes('!')) {
            const pseudo = document.getElementById('mc-playername')?.value;
            if (pseudo) {
                console.log(`[MC] Server ready, auto-opping: ${pseudo}`);
                window.electronAPI.sendMinecraftCommand(`op ${pseudo}`);
            }
        }

        // [AUTO-JOIN-ACTIONS] Detect player join and apply creative, give items, and TP
        // Typical log: [12:34:56 INFO]: PlayerName joined the game
        if (log.includes('joined the game')) {
            try {
                // Extract playerName (assuming format "[... INFO]: PlayerName joined the game")
                const parts = log.split(']: ');
                const content = parts.length > 1 ? parts[1] : log;
                const playerName = content.split(' joined the game')[0].trim();

                if (playerName) {
                    console.log(`[MC] Player joined: ${playerName}, applying auto-actions...`);
                    // 1. Gamemode Creative
                    window.electronAPI.sendMinecraftCommand(`gamemode creative ${playerName}`);
                    // 2. Give 64 Emerald Blocks
                    window.electronAPI.sendMinecraftCommand(`give ${playerName} emerald_block 64`);
                    // 3. Teleport to XYZ: 17.227 / 68.5 / -19.632
                    window.electronAPI.sendMinecraftCommand(`tp ${playerName} 17.227 68.5 -19.632`);

                    showToast(`Bienvenue ${playerName} ! Auto-actions appliquées.`, 'info');
                }
            } catch (e) {
                console.error("Error processing player join actions:", e);
            }
        }
    });

    window.electronAPI.onMinecraftStatus((status) => {
        const wasOffline = !lastMcStatus || lastMcStatus.paper !== 'online';
        const isOnline = status.paper === 'online';

        updateMCStatusUI(status);

        if (wasOffline && isOnline) {
            // Actions when server starts
            const port = document.getElementById('input-mc-port')?.value || '25565';
            const ip = 'localhost:' + port;

            // 1. Close Modal
            closeModal('modal-mc-options');

            // 2. Copy IP & Notify
            if (navigator.clipboard) {
                navigator.clipboard.writeText(ip).then(() => {
                    showNotify("Serveur Prêt !", `L'IP (${ip}) a été copiée. Dans Minecraft: Multijoueur > Connexion Directe > Coller.`, "success");
                }).catch(() => {
                    showNotify("Serveur Prêt !", `Connectez-vous via ${ip}`, "success");
                });
            } else {
                showNotify("Serveur Prêt !", `Connectez-vous via ${ip}`, "success");
            }
        }

        lastMcStatus = status;
    });
}

// Initializing Minecraft Section Handlers
document.addEventListener('DOMContentLoaded', () => {
    const btnInstall = document.getElementById('btn-mc-install');
    const btnStart = document.getElementById('btn-mc-start');

    if (btnInstall) {
        btnInstall.onclick = async () => {
            if (!window.electronAPI) {
                showNotify("Version Desktop Requise", "L'installation du serveur nécessite l'application Windows Gentok.", 'warning');
                return;
            }

            const confirmed = await showConfirm("Installer Minecraft ?", "Cela va télécharger JDK 21 et configurer le serveur GentokBoxTNT dans votre dossier Gentok.");
            if (!confirmed) return;

            // [NEW] Open console automatically to see progress
            openModal('modal-mc-options');
            switchMcTab('console', document.querySelector('.btn-mc-tab[onclick*="console"]'));

            btnInstall.disabled = true;
            btnInstall.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Installation...';

            try {
                await window.electronAPI.installJDK21();
                await window.electronAPI.setupMinecraftServer();

                // [AUTO-FILL] Configuration auto pour le serveur local
                if (document.getElementById('mc-host')) document.getElementById('mc-host').value = 'localhost';
                if (document.getElementById('mc-port')) document.getElementById('mc-port').value = 4567;
                if (document.getElementById('mc-password')) document.getElementById('mc-password').value = 'gentok';

                // Récupération automatique du pseudo TikTok si le champ est vide
                const pseudoIn = document.getElementById('mc-playername');
                if (pseudoIn && !pseudoIn.value) {
                    const tiktokUser = document.getElementById('header-username')?.value;
                    if (tiktokUser && tiktokUser !== '@pseudo') {
                        pseudoIn.value = tiktokUser.replace('@', '');
                    }
                }

                await handleSaveMinecraft();

                btnInstall.style.display = 'none';
                if (btnStart) {
                    btnStart.style.display = 'block';
                    btnStart.disabled = true;
                    btnStart.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Premier démarrage...';
                }

                showToast("Installation terminée ! Démarrage du serveur...", "success");

                // [AUTO-START] Launch server immediately after install
                await window.electronAPI.startMinecraftServer(getToken());

                // Status will be updated via IPC mc-status event

            } catch (e) {
                showNotify("Erreur", "L'installation a échoué : " + e.message, 'error');
                btnInstall.disabled = false;
                btnInstall.innerHTML = '<i class="fas fa-download"></i> Réessayer l\'installation';
            }
        };
    }

    if (btnStart) {
        btnStart.onclick = async () => {
            if (!window.electronAPI) return;
            const isOnline = !!btnStart.querySelector('.fa-stop'); // Minecraft server button (text is translated)
            if (isOnline) {
                btnStart.disabled = true;
                btnStart.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Arrêt...';
                await window.electronAPI.stopMinecraftServer();
            } else {
                btnStart.disabled = true;
                btnStart.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Démarrage...';
                openModal('modal-mc-options');
                switchMcTab('console', document.querySelector('.btn-mc-tab[onclick*="console"]'));
                await window.electronAPI.startMinecraftServer(getToken());
                // Status will be updated via IPC mc-status event
            }
        };
    }

    const btnRestart = document.getElementById('btn-mc-restart');
    if (btnRestart) {
        btnRestart.onclick = async () => {
            if (!window.electronAPI) return;
            btnRestart.disabled = true;
            btnRestart.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redémarrage...';

            // Show console
            openModal('modal-mc-options');
            switchMcTab('console', document.querySelector('.btn-mc-tab[onclick*="console"]'));

            await window.electronAPI.restartMinecraftServer(getToken());

            setTimeout(() => {
                btnRestart.disabled = false;
                btnRestart.innerHTML = '<i class="fas fa-undo"></i> Redémarrer';
            }, 2000);
        };
    }

    const btnOptions = document.getElementById('btn-mc-options');
    if (btnOptions) {
        btnOptions.onclick = async () => {
            openModal('modal-mc-options');
            if (window.electronAPI) {
                const path = await window.electronAPI.getMinecraftPath();
                const pathEl = document.getElementById('mc-install-path');
                if (pathEl) pathEl.innerText = path;
            }
        };
    }

    const btnOpenFolder = document.getElementById('btn-mc-open-folder');
    if (btnOpenFolder) {
        btnOpenFolder.onclick = async () => {
            if (window.electronAPI) {
                await window.electronAPI.openMinecraftFolder();
            }
        };
    }

    const btnUninstall = document.getElementById('btn-mc-uninstall');
    if (btnUninstall) {
        btnUninstall.onclick = async () => {
            if (!window.electronAPI) return;

            // [FIX] Close modal first so the confirm message is visible
            closeModal('modal-mc-options');

            const confirmed = await showConfirm("Désinstaller le serveur ?", "Attention : Cette action est irréversible. Vos mondes et plugins seront définitivement supprimés.");

            if (!confirmed) {
                openModal('modal-mc-options');
                return;
            }

            const res = await window.electronAPI.uninstallMinecraftServer();
            if (res.success) {
                showToast("Serveur désinstallé.", "success");
                // [FIX] Reset install button fully (may be stuck in "Installation..." state)
                const installBtn = document.getElementById('btn-mc-install');
                const startBtn = document.getElementById('btn-mc-start');
                const restartBtn = document.getElementById('btn-mc-restart');

                if (installBtn) {
                    installBtn.style.display = 'block';
                    installBtn.disabled = false;
                    installBtn.innerHTML = '<i class="fas fa-download"></i> Installation';
                }
                if (startBtn) startBtn.style.display = 'none';
                if (restartBtn) restartBtn.style.display = 'none';
            } else {
                showNotify("Erreur", res.message, 'error');
                openModal('modal-mc-options');
            }
        };
    }

    // Console Command Send
    const btnSendCommand = document.getElementById('btn-mc-send-command');
    const inputCommand = document.getElementById('mc-console-input');

    const doSendCommand = async () => {
        if (!inputCommand || !window.electronAPI) return;
        let cmd = inputCommand.value.trim();
        if (!cmd) return;

        // [FIX] Standard Minecraft Console behavior: no leading slash
        if (cmd.startsWith('/')) {
            cmd = cmd.substring(1);
        }

        const res = await window.electronAPI.sendMinecraftCommand(cmd);
        if (res.success) {
            inputCommand.value = '';
        } else {
            showToast(res.message, "error");
        }
    };

    if (btnSendCommand) btnSendCommand.onclick = doSendCommand;
    if (inputCommand) {
        inputCommand.onkeydown = (e) => {
            if (e.key === 'Enter') doSendCommand();
        };
    }

    // Save Settings
    const btnSaveSettings = document.getElementById('btn-mc-save-settings');
    if (btnSaveSettings) {
        btnSaveSettings.onclick = async () => {
            // Memory is handled by paper server launch - in a real app we'd save it to a config file
            showToast("Paramètres sauvegardés !", "success");
        };
    }
});

window.switchMcTab = (tabId, btn) => {
    // Hide all
    document.querySelectorAll('.mc-tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.btn-mc-tab').forEach(b => b.classList.remove('active'));

    // Show target
    const target = document.getElementById(`mc-tab-${tabId}`);
    if (target) target.style.display = 'block';
    if (btn) btn.classList.add('active');
};

window.openPublishModal = () => {
    document.getElementById('p-id-hidden').value = '';
    document.getElementById('p-title').value = '';
    document.getElementById('p-desc').value = '';
    document.getElementById('p-img').value = '';
    document.getElementById('p-badge').value = 'gratuit';

    const modalTitle = document.querySelector('#modal-publish-preset h2');
    if (modalTitle) modalTitle.innerText = "🚀 Publier un Preset";

    const btnEditContent = document.getElementById('btn-edit-preset-content');
    if (btnEditContent) btnEditContent.style.display = 'none';

    populatePresetItems();
    openModal('modal-publish-preset');
};

window.editGlobalPreset = (id) => {
    const preset = window._allPresets.find(p => p.id === id);
    if (!preset) return;

    document.getElementById('p-id-hidden').value = preset.id;
    document.getElementById('p-title').value = preset.title;
    document.getElementById('p-desc').value = preset.desc;
    document.getElementById('p-img').value = preset.img || '';
    document.getElementById('p-badge').value = preset.badge || 'gratuit';

    const modalTitle = document.querySelector('#modal-publish-preset h2');
    if (modalTitle) modalTitle.innerText = "✏️ Modifier le Preset";

    const btnEditContent = document.getElementById('btn-edit-preset-content');
    if (btnEditContent) btnEditContent.style.display = 'block';

    // For editing, we could mark which items were previously in the preset, 
    // but usually admins want to update to their NEW current session.
    populatePresetItems();
    openModal('modal-publish-preset');
};

window.enterPresetEditorModeFromModal = () => {
    const id = document.getElementById('p-id-hidden').value;
    const title = document.getElementById('p-title').value;
    if (!id) return;

    closeModal('modal-publish-preset');
    startPresetEditContent(id, title);
};

window.startPresetEditContent = async (presetId, title) => {
    isPresetEditMode = true;
    editingPresetId = presetId;

    // Backup real config
    backupConfig = {
        actions: [...currentActions],
        events: [...currentEvents]
    };

    // Load preset content
    const preset = window._allPresets.find(p => p.id === presetId);
    if (preset) {
        try {
            const base = getApiBase();
            const token = localStorage.getItem('gentok_token');
            const res = await fetch(`${base}/api/presets/${presetId}?token=${token || ''}`);
            const fullPreset = await res.json();

            if (fullPreset.content) {
                currentActions = fullPreset.content.actions || [];
                currentEvents = fullPreset.content.events || [];
            }
        } catch (err) {
            console.error("Failed to load preset content:", err);
            currentActions = [];
            currentEvents = [];
        }
    }

    // Update UI
    document.getElementById('preset-editor-banner').style.display = 'flex';
    document.getElementById('editing-preset-name').innerText = `Contenu du pack : ${title}`;

    showNotify('Mode Édition', 'Vous modifiez maintenant le contenu du pack. Vos actions réelles sont mises de côté.', 'info');

    // Redirect to Actions
    showSection('actions');
    renderActions();
    renderEvents();
    renderSoundLinks();
};

window.savePresetContentChanges = async () => {
    if (!editingPresetId) return;

    showToast('Sauvegarde du pack...', 'info');

    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/presets?token=${token || ''}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: editingPresetId,
                actions: currentActions,
                events: currentEvents,
                sounds: currentActions.filter(a => a.type === 'sound')
            })
        });

        const data = await res.json();
        if (data.success) {
            showNotify('Succès', 'Le contenu du pack a été mis à jour !', 'success');
            quitPresetEditorMode();
            loadPresets();
        } else throw new Error(data.error);
    } catch (err) {
        showNotify('Erreur', err.message, 'error');
    }
};

window.quitPresetEditorMode = () => {
    isPresetEditMode = false;
    editingPresetId = null;

    // Restore real config
    if (backupConfig) {
        currentActions = backupConfig.actions;
        currentEvents = backupConfig.events;
        backupConfig = null;
    }

    // UI Update
    document.getElementById('preset-editor-banner').style.display = 'none';
    renderActions();
    renderEvents();
    renderSoundLinks();

    showSection('presets');
    showToast('Mode édition quitté');
};

window.populatePresetItems = () => {
    const container = document.getElementById('p-items-selector');
    if (!container) return;

    container.innerHTML = '';

    // Events
    if (currentEvents.length > 0) {
        const h = document.createElement('div');
        h.innerHTML = `<strong style="font-size: 0.75rem; color: var(--secondary); display: block; margin-bottom: 5px;">Règles / Événements</strong>`;
        container.appendChild(h);

        currentEvents.forEach(ev => {
            const item = document.createElement('label');
            item.style = "display: flex; align-items: center; gap: 8px; font-size: 0.8rem; margin-bottom: 5px; cursor: pointer;";
            item.innerHTML = `
                <input type="checkbox" name="p-included-event" value="${ev.id}" checked>
                <span>${ev.name || 'Sans nom'}</span>
            `;
            container.appendChild(item);
        });
    }

    // Actions (that are not just placeholders)
    if (currentActions.length > 0) {
        const h = document.createElement('div');
        h.innerHTML = `<strong style="font-size: 0.75rem; color: var(--primary); display: block; margin: 10px 0 5px;">Actions de commande</strong>`;
        container.appendChild(h);

        currentActions.forEach(act => {
            const item = document.createElement('label');
            item.style = "display: flex; align-items: center; gap: 8px; font-size: 0.8rem; margin-bottom: 5px; cursor: pointer;";
            item.innerHTML = `
                <input type="checkbox" name="p-included-action" value="${act.id}" checked>
                <span>${act.name || act.id}</span>
            `;
            container.appendChild(item);
        });
    }

    // Sound Links
    const soundActions = currentActions.filter(a => a.type === 'sound');
    if (soundActions.length > 0) {
        const h = document.createElement('div');
        h.innerHTML = `<strong style="font-size: 0.75rem; color: #f1c40f; display: block; margin: 10px 0 5px;">Liens Audio (Soundboard)</strong>`;
        container.appendChild(h);

        soundActions.forEach(act => {
            const item = document.createElement('label');
            item.style = "display: flex; align-items: center; gap: 8px; font-size: 0.8rem; margin-bottom: 5px; cursor: pointer;";
            item.innerHTML = `
                <input type="checkbox" name="p-included-action" value="${act.id}" checked>
                <span>${act.name || act.id}</span>
            `;
            container.appendChild(item);
        });
    }

    if (currentEvents.length === 0 && currentActions.length === 0) {
        container.innerHTML = '<p class="text-dim" style="font-size: 0.8rem; text-align: center;">Aucune donnée à inclure.</p>';
    }
};

window.deleteGlobalPreset = async (presetId) => {
    const confirmed = await showConfirm('Supprimer pour TOUT LE MONDE ?', 'Cette action retirera le preset du catalogue public définitivement.', 'Oui, supprimer');
    if (!confirmed) return;

    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/presets/${presetId}?token=${token || ''}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Preset supprimé');
            loadPresets();
        } else throw new Error(data.error);
    } catch (err) {
        showNotify('Erreur', err.message, 'error');
    }
};

window.installPreset = async (presetId, title) => {
    const confirmed = await showConfirm(
        'Installer le preset ?',
        `Voulez-vous installer "${title}" ? Cela ajoutera automatiquement les actions et événements configurés par l'auteur.`,
        'Installer maintenant'
    );

    if (!confirmed) return;

    // Quota Check
    const scenes = getUserScenes();
    const limit = isPremiumUser ? 10 : 3;
    if (scenes.length >= limit) {
        showNotify('Limite atteinte', `Vous avez atteint votre limite de ${limit} scènes (Presets + Perso). Passez à Premium pour en avoir jusqu'à 10 !`, 'warning');
        openProModal();
        return;
    }

    showToast('Installation en cours...', 'info');

    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/presets/install?token=${token || ''}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presetId, asNewScene: true })
        });

        const result = await res.json();
        if (result.success) {
            // Save to new scene config
            const scenes = getUserScenes();
            if (!scenes.find(s => s.id === presetId)) {
                scenes.push({ id: presetId, title: title, isPreset: true });
                saveUserScenes(scenes);
            }

            addLog(`📦 Preset "${title}" installé avec succès !`, 'success');
            showNotify('Succès', `Le preset a été installé. ${result.actionsInstalled} actions et ${result.eventsInstalled} événements ajoutés.`, 'success');

            // Refresh data from server
            fetchData();

            // Force update sidebar scene selector
            updateSceneUI();

            // Refresh UI
            if (document.getElementById('presets-installed').style.display !== 'none') {
                renderInstalledPresets();
            }
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showNotify('Erreur', 'Impossible d\'installer le preset: ' + err.message, 'error');
    }
};

// View Preset Details Modal
window.viewPresetDetails = async (presetId) => {
    try {
        const base = getApiBase();
        const res = await fetch(`${base}/api/presets/${presetId}`);
        const preset = await res.json();

        if (!preset || !preset.content) {
            showNotify('Erreur', 'Impossible de charger les détails du preset', 'error');
            return;
        }

        const { actions = [], events = [] } = preset.content;

        // Build modal content
        let modalContent = `
            <div style="max-height: 70vh; overflow-y: auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="font-size: 1.5rem; margin-bottom: 10px;">${preset.title}</h2>
                    <p style="color: var(--text-dim); font-size: 0.9rem;">${preset.desc}</p>
                    <div style="display: flex; gap: 10px; justify-content: center; margin-top: 15px;">
                        <span class="preset-badge ${preset.badge}">${preset.badge}</span>
                        <span class="preset-badge" style="background: rgba(255,255,255,0.05);">${preset.type}</span>
                    </div>
                </div>

                <!-- Events Section -->
                <div style="margin-bottom: 30px;">
                    <h3 style="font-size: 1.1rem; margin-bottom: 15px; color: var(--secondary); display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-calendar-check"></i> Événements / Règles (${events.length})
                    </h3>
                    ${events.length > 0 ? `
                        <div style="display: grid; gap: 10px;">
                            ${events.map(e => {
            // Generate descriptive name based on event properties
            let eventName = '';
            if (e.triggerType === 'gift' && e.giftName) {
                eventName = `Cadeau: ${e.giftName}`;
            } else if (e.triggerType === 'gift_min' && e.minCoins) {
                eventName = `Cadeau min: ${e.minCoins} coins`;
            } else if (e.triggerType === 'like') {
                eventName = 'Like reçu';
            } else if (e.triggerType === 'follow') {
                eventName = 'Nouvel abonné';
            } else if (e.triggerType === 'share') {
                eventName = 'Partage';
            } else if (e.triggerType === 'member') {
                eventName = 'Nouveau membre';
            } else if (e.triggerType === 'subscription') {
                eventName = 'Abonnement';
            } else if (e.triggerType === 'command' && e.command) {
                eventName = `Commande: ${e.command}`;
            } else {
                eventName = e.triggerType || 'Événement';
            }

            return `
                                <div class="card" style="padding: 12px; background: rgba(255,255,255,0.03);">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                        <span style="font-weight: 700; font-size: 0.9rem;">${eventName}</span>
                                        <span class="badge ${e.triggerType}" style="font-size: 0.7rem;">${e.triggerType}</span>
                                    </div>
                                    ${e.actions && e.actions.length > 0 ? `
                                        <div style="font-size: 0.75rem; color: var(--text-dim);">
                                            <i class="fas fa-bolt"></i> ${e.actions.length} action(s) associée(s)
                                        </div>
                                    ` : ''}
                                </div>
                            `}).join('')}
                        </div>
                    ` : '<p style="color: var(--text-dim); font-style: italic;">Aucun événement configuré</p>'}
                </div>

                <!-- Actions Section -->
                <div style="margin-bottom: 30px;">
                    <h3 style="font-size: 1.1rem; margin-bottom: 15px; color: var(--secondary); display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-bolt"></i> Actions (${actions.length})
                    </h3>
                    ${actions.length > 0 ? `
                        <div style="display: grid; gap: 10px;">
                            ${actions.map(a => `
                                <div class="card" style="padding: 12px; background: rgba(255,255,255,0.03);">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <span style="font-weight: 700; font-size: 0.9rem;">${a.name || 'Sans nom'}</span>
                                            <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;">
                                                ${a.type === 'keyboard' ? `<i class="fas fa-keyboard"></i> Touche: ${a.key}` : ''}
                                                ${a.type === 'webhook' ? `<i class="fas fa-globe"></i> Webhook` : ''}
                                                ${a.type === 'rcon' ? `<i class="fas fa-server"></i> RCON: ${a.command}` : ''}
                                                ${a.type === 'sound' ? `<i class="fas fa-music"></i> Son: ${a.soundName}` : ''}
                                            </div>
                                        </div>
                                        <span class="badge ${a.type}">${a.type}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p style="color: var(--text-dim); font-style: italic;">Aucune action configurée</p>'}
                </div>

                <!-- Sounds Section -->
                ${actions.filter(a => a.type === 'sound').length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h3 style="font-size: 1.1rem; margin-bottom: 15px; color: var(--secondary); display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-music"></i> Sons inclus (${actions.filter(a => a.type === 'sound').length})
                        </h3>
                        <div style="display: grid; gap: 8px;">
                            ${actions.filter(a => a.type === 'sound').map(s => `
                                <div style="padding: 10px; background: rgba(255,255,255,0.02); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.85rem;"><i class="fas fa-volume-up"></i> ${s.soundName}</span>
                                    <span style="font-size: 0.75rem; color: var(--text-dim);">Volume: ${s.volume || 50}%</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Install Button -->
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border);">
                    <button class="btn-primary" onclick="closeModal('modal-preset-details'); installPreset('${presetId}', '${preset.title.replace(/'/g, "\\'")}')">
                        <i class="fas fa-download"></i> Installer ce preset
                    </button>
                </div>
            </div>
        `;

        // Show in a modal
        const modal = document.getElementById('modal-preset-details');
        if (!modal) {
            // Create modal if it doesn't exist
            const newModal = document.createElement('div');
            newModal.id = 'modal-preset-details';
            newModal.className = 'modal';
            newModal.innerHTML = `
                <div class="modal-content card" style="max-width: 800px; width: 90%;">
                    <button class="btn-close" onclick="closeModal('modal-preset-details')"><i class="fas fa-times"></i></button>
                    <div id="preset-details-content"></div>
                </div>
            `;
            document.body.appendChild(newModal);
        }

        document.getElementById('preset-details-content').innerHTML = modalContent;
        openModal('modal-preset-details');

    } catch (err) {
        console.error('Failed to load preset details:', err);
        showNotify('Erreur', 'Impossible de charger les détails du preset', 'error');
    }
};



// Admin: Publish Preset Logic
const formPublishPreset = document.getElementById('form-publish-preset');
if (formPublishPreset) {
    formPublishPreset.onsubmit = async (e) => {
        e.preventDefault();

        // Get selected items
        const selectedEventIds = Array.from(document.querySelectorAll('input[name="p-included-event"]:checked')).map(el => el.value);
        const selectedActionIds = Array.from(document.querySelectorAll('input[name="p-included-action"]:checked')).map(el => el.value);

        const selectedEvents = currentEvents.filter(ev => selectedEventIds.includes(ev.id));
        const selectedActions = currentActions.filter(act => selectedActionIds.includes(act.id));

        const presetData = {
            id: document.getElementById('p-id-hidden').value || null,
            title: document.getElementById('p-title').value,
            desc: document.getElementById('p-desc').value,
            img: document.getElementById('p-img').value,
            badge: document.getElementById('p-badge').value,
            events: selectedEvents,
            actions: selectedActions,
            token: localStorage.getItem('gentok_token')
        };

        showToast('Sauvegarde...', 'info');

        try {
            const base = getApiBase();
            const res = await fetch(`${base}/api/presets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(presetData)
            });

            const data = await res.json();
            if (data.success) {
                showNotify('Succès', 'Preset sauvegardé avec succès !', 'success');
                closeModal('modal-publish-preset');
                loadPresets();
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            showNotify('Erreur', err.message, 'error');
        }
    };
}


window.renderInstalledPresets = () => {
    const grid = document.getElementById('installed-presets-list');
    const scenes = getUserScenes();
    const installedPresets = scenes.filter(s => s.isPreset);
    const presets = window._allPresets || [];

    // Update Limit UI (Sidebar)
    const limit = isPremiumUser ? 10 : 2;
    const count = scenes.length;
    const percentage = Math.min(100, (count / limit) * 100);

    const countLabel = document.getElementById('presets-count-label');
    const BarFill = document.getElementById('presets-limit-bar-fill');
    const upgradeBtn = document.getElementById('btn-presets-upgrade');

    if (countLabel) countLabel.innerText = `${count} / ${limit} Scènes`;
    if (BarFill) {
        BarFill.style.width = percentage + '%';
        BarFill.style.background = count >= limit ? 'var(--error)' : 'linear-gradient(90deg, #FFA500, #FFD700)';
    }

    if (upgradeBtn) {
        upgradeBtn.style.display = isPremiumUser ? 'none' : 'block';
    }

    if (grid) {
        grid.innerHTML = '';
        if (installedPresets.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed var(--border);">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; color: var(--text-dim);">
                        <i class="fas fa-cubes" style="font-size: 3rem; opacity: 0.3; color: var(--secondary);"></i>
                        <div>
                            <h3 style="margin-bottom: 5px; color: var(--text);">Aucun Preset installé</h3>
                            <p style="font-size: 0.9rem;">Parcourez l'onglet "Découvrir" pour installer vos premiers packs.</p>
                        </div>
                        <button class="btn-secondary" onclick="switchPresetTab('discover')">
                            <i class="fas fa-search"></i> Découvrir les Presets
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        installedPresets.forEach(s => {
            const p = presets.find(pr => pr.id === s.id);
            const card = document.createElement('div');
            card.className = `preset-card ${activeSceneId === s.id ? 'active-card' : ''}`;

            const badge = '<span class="preset-badge primary" style="font-size: 0.55rem;">PRESET</span>';

            card.innerHTML = `
            <div class="preset-img-wrapper" style="height: 100px;">
                ${(p && p.img) ? `<img src="${p.img}" class="preset-img" alt="${s.title}">` : '<div class="preset-img-placeholder"><i class="fas fa-cubes"></i></div>'}
                <div style="position: absolute; top: 10px; left: 10px; display: flex; gap: 5px;">
                    ${badge}
                    ${activeSceneId === s.id ? '<span class="preset-badge secondary" style="font-size: 0.55rem;"><i class="fas fa-check"></i> ACTIF</span>' : ''}
                </div>
            </div>
            <div class="preset-content" style="padding: 1rem;">
                <h3 class="preset-title" style="font-size: 0.85rem; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s.title}">${s.title}</h3>
                <div class="preset-footer" style="padding-top: 5px; flex-direction: column; align-items: flex-start; gap: 10px;">
                    <div style="display: flex; gap: 5px; width: 100%;">
                        <button class="btn-ghost btn-mini" style="flex: 1;" onclick="switchScene('${s.id}')">
                            <i class="fas fa-play"></i> Charger
                        </button>
                        <button class="btn-icon delete" title="Supprimer" onclick="deleteScene('${s.id}', event)">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
            grid.appendChild(card);
        });
    }

    // Sync sidebar
    updateSceneUI();
};

// --- Scene Management Helpers ---
window.getUserScenes = () => {
    // old scenes saved without a name are shown as "Scène sans nom" instead of an empty label
    return (userScenes || []).map(sc => (sc && !sc.title ? { ...sc, title: 'Scène sans nom' } : sc));
};

window.saveUserScenes = async (scenes) => {
    userScenes = scenes;
    // Persist to Server Settings
    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        await fetch(`${base}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, scenes })
        });
    } catch (e) {
        console.error('Failed to save scenes to server:', e);
    }
};

window.createCustomScene = async () => {
    // Quota Check
    const scenes = getUserScenes();
    const limit = isPremiumUser ? 10 : 2;

    if (scenes.length >= limit) {
        showNotify('Limite atteinte', `Vous avez atteint votre limite de ${limit} scènes (Presets + Perso). Passez à Premium pour en avoir jusqu'à 10 !`, 'warning');
        openProModal();
        return;
    }

    // Each scene has its own actions, events, goals, TTS and points settings: start empty or from a copy
    const hasCurrent = !!activeSceneId;
    const { value: form } = await Swal.fire({
        title: 'Nouvelle scène',
        html: `
            <p class="small text-secondary mb-2">Chaque scène garde ses propres actions, événements, objectifs, réglages TTS et règles de points.</p>
            <input id="new-scene-name" class="swal2-input" placeholder="Ex : Live jeux, Live discussion" maxlength="40">
            ${hasCurrent ? `<div class="text-start mx-4 mt-2 small">
                <label class="d-block mb-1"><input type="radio" name="new-scene-from" value="empty" checked> Scène vide</label>
                <label class="d-block"><input type="radio" name="new-scene-from" value="copy"> Copier la scène actuelle (actions, événements, réglages)</label>
            </div>` : ''}`,
        showCancelButton: true,
        confirmButtonColor: 'var(--secondary)',
        cancelButtonText: 'Annuler',
        confirmButtonText: 'Créer',
        focusConfirm: false,
        preConfirm: () => {
            const name = (document.getElementById('new-scene-name').value || '').trim();
            if (!name) { Swal.showValidationMessage('Veuillez mettre un nom de scène'); return false; }
            return { name, copy: document.querySelector('input[name="new-scene-from"]:checked')?.value === 'copy' };
        }
    });

    if (form && form.name) {
        const id = `custom_${Date.now()}`;
        scenes.push({ id, title: form.name, isPreset: false });
        await saveUserScenes(scenes); // [FIX] Wait for the new list to be saved
        if (form.copy) {
            try {
                const r = await fetch(`${getApiBase()}/api/scenes/duplicate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: localStorage.getItem('gentok_token'), toSceneId: id })
                });
                if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            } catch (e) {
                showNotify('Copie impossible', `La scène a été créée vide (${e.message}).`, 'warning');
            }
        }
        renderInstalledPresets(); // Refresh any list if visible
        showToast(form.copy ? 'Scène créée à partir de la scène actuelle !' : 'Scène créée !');
        await switchScene(id); // [FIX] Wait for the switch to complete
    }
};

window.deleteScene = async (sceneId, e) => {
    if (e) e.stopPropagation();

    const confirmed = await showConfirm(
        'Supprimer la scène ?',
        'Ceci effacera vos actions et événements pour ce profil sur le serveur.',
        'Supprimer'
    );

    if (confirmed) {
        try {
            const base = getApiBase();
            const token = localStorage.getItem('gentok_token');
            await fetch(`${base}/api/scenes/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sceneId, token }) // Pass token in body too for safety
            });

            // Update local state first
            let scenes = getUserScenes();
            scenes = scenes.filter(s => s.id !== sceneId);
            await saveUserScenes(scenes); // [FIX] Wait for the list update before proceeding
            updateSceneUI();
            renderInstalledPresets();

            showToast('Scène supprimée');

            // If we deleted the active scene
            if (activeSceneId === sceneId) {
                if (scenes.length > 0) {
                    // Switch to first available
                    await switchScene(scenes[0].id);
                } else {
                    // No scenes left
                    activeSceneId = null;
                    await fetch(`${base}/api/scenes/switch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sceneId: null, token })
                    });
                }
            }
            fetchData(); // Sync active scene and refresh list
        } catch (err) {
            showNotify('Erreur', 'Impossible de supprimer', 'error');
        }
    }
};

// Rename specific scene from list
window.renameScene = async (sceneId, currentName, event) => {
    if (event) event.stopPropagation();

    if (!sceneId || sceneId === 'default') return;


    const { value: newName, isConfirmed } = await Swal.fire({
        title: 'Renommer la scène',
        input: 'text',
        inputValue: currentName,
        inputLabel: 'Nouveau nom',
        inputPlaceholder: 'Entrez le nouveau nom...',
        showCancelButton: true,
        confirmButtonText: 'Sauvegarder',
        cancelButtonText: 'Annuler',
        background: '#1e1e1e',
        color: '#ffffff',
        inputValidator: (value) => {
            if (!value) {
                return 'Le nom ne peut pas être vide !';
            }
        }
    });

    if (isConfirmed && newName) {
        try {
            const token = getToken();
            const res = await fetch(`${getApiBase()}/api/scenes/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, sceneId, newName })
            });

            if (res.ok) {
                showToast('✅ Scène renommée !');

                // Update local state immediately
                if (window.userScenes) {
                    const scene = window.userScenes.find(s => s.id === sceneId);
                    if (scene) scene.title = newName;
                }
                updateSceneUI();
                renderInstalledPresets(); // Refresh grid if visible

                await fetchData();

                // ensuring active display update
                const activeId = document.getElementById('active-scene-select').value;
                if (activeId === sceneId) {
                    const triggerSpan = document.querySelector('#cs-active-scene .custom-select-trigger span');
                    if (triggerSpan) {
                        triggerSpan.innerHTML = `<i class="fas fa-layer-group"></i> ${newName}`;
                        triggerSpan.title = newName;
                    }
                }
            } else {
                throw new Error('Erreur API');
            }
        } catch (e) {
            console.error(e);
            showNotify('Erreur', 'Impossible de renommer la scène.', 'error');
        }
    }
};

// Scene Switching Logic
window.switchScene = async (sceneId) => {
    // If sceneId is undefined or null, it might mean "switch to nothing" or "default" depending on context.
    // But here, 'default' string means "Profil par défaut" which we removed.
    // If sceneId is null, it means "Default Scene" (backend).
    // If we want to switch to "User First Scene", sceneId must be provided.

    if (sceneId === 'default' || !sceneId) sceneId = null;
    // Two quick clicks: only the last choice may update the screen (answers can come back in any order)
    const seq = (window.__sceneSwitchSeq = (window.__sceneSwitchSeq || 0) + 1);
    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/scenes/switch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sceneId, token })
        });
        const result = await res.json();
        if (seq !== window.__sceneSwitchSeq) return;
        if (result.success) {
            // [FIX] Update data dynamically instead of reloading the whole page
            activeSceneId = result.activeSceneId;
            showToast('Scène activée !');
            await fetchData();
            // the TTS settings belong to the scene too
            if (typeof reloadTTSConfig === 'function') reloadTTSConfig();
        }
    } catch (e) {
        showNotify('Erreur', 'Impossible de changer de scène', 'error');
    }
};

window.updateSceneUI = () => {
    const selector = document.getElementById('active-scene-select');
    const optionsGrid = document.getElementById('scene-selector-options');
    const triggerSpan = document.querySelector('#cs-active-scene .custom-select-trigger span');
    if (!selector || !optionsGrid) return;

    const scenes = getUserScenes();

    // Template for options
    selector.innerHTML = '';
    optionsGrid.innerHTML = '';

    if (scenes.length === 0) {
        optionsGrid.innerHTML = `
            <div class="custom-option disabled" style="cursor: default; opacity: 0.7;">
                <span style="font-size: 0.8rem;">Aucune scène. Créez-en une !</span>
            </div>
        `;
        if (triggerSpan) triggerSpan.innerHTML = `<i class="fas fa-layer-group"></i> Créer une scène`;
    }

    scenes.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.innerText = s.title;
        if (activeSceneId === s.id) opt.selected = true;
        selector.appendChild(opt);

        const badge = s.isPreset ?
            `<span style="font-size: 0.6rem; background: #8a2be2; color: white; padding: 2px 4px; border-radius: 4px; margin-left: 5px; font-weight: bold;">PRESET</span>` :
            ``;

        const div = document.createElement('div');
        div.className = `custom-option ${activeSceneId === s.id ? 'selected' : ''}`;
        div.innerHTML = `
            <span style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; padding-right: 10px;">
                <i class="fas fa-layer-group" style="flex-shrink: 0;"></i> 
                <span class="scene-title-text" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">${escapeHtml(s.title)}</span>
                ${badge}
            </span>
            <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                <div class="scene-action-btn edit" onclick="renameScene(this.closest('.custom-option').dataset.sceneId, this.closest('.custom-option').dataset.title, event)" title="Renommer">
                    <i class="fas fa-pen"></i>
                </div>
                <div class="scene-delete-btn" onclick="deleteScene(this.closest('.custom-option').dataset.sceneId, event)" title="Supprimer">
                    <i class="fas fa-trash-alt"></i>
                </div>
            </div>
        `;
        div.dataset.sceneId = s.id;
        div.dataset.title = s.title;
        div.onclick = (e) => {
            if (e.target.closest('.scene-delete-btn') || e.target.closest('.scene-action-btn')) return;
            selectCustomOption('cs-active-scene', s.id, `<i class="fas fa-layer-group"></i> ${escapeHtml(s.title)}${badge}`);
            switchScene(s.id);
        };
        optionsGrid.appendChild(div);
    });

    // Footer with "Create" button
    const footer = document.createElement('div');
    footer.className = 'custom-options-footer';
    footer.innerHTML = `
        <button class="btn-add-scene" onclick="createCustomScene()">
            <i class="fas fa-plus"></i> Créer une scène personnalisée
        </button>
    `;
    optionsGrid.appendChild(footer);

    // Update active trigger text
    if (activeSceneId) {
        const active = scenes.find(s => s.id === activeSceneId);
        if (active && triggerSpan) {
            const badge = active.isPreset ?
                `<span style="font-size: 0.6rem; background: #8a2be2; color: white; padding: 2px 4px; border-radius: 4px; margin-left: 5px; font-weight: bold;">PRESET</span>` :
                ``;

            triggerSpan.innerHTML = `<i class="fas fa-layer-group"></i> ${escapeHtml(active.title)}${badge}`;
            triggerSpan.title = active.title;
        } else if (triggerSpan) {
            // Fallback if deleted or not found
            triggerSpan.innerHTML = `<i class="fas fa-layer-group"></i> Sélectionnez une scène`;
            triggerSpan.title = "";
        }
    } else if (scenes.length > 0 && triggerSpan) {
        triggerSpan.innerHTML = `<i class="fas fa-layer-group"></i> Sélectionnez une scène`;
        triggerSpan.title = "";
    }

    // TTS and points sections say which scene their settings belong to
    const activeScene = scenes.find(sc => sc.id === activeSceneId);
    document.querySelectorAll('.scene-scope-hint').forEach(el => {
        const what = el.dataset.what || 'Réglages';
        el.innerHTML = activeScene
            ? `<i class="fas fa-layer-group"></i> ${escapeHtml(what)} de la scène « ${escapeHtml(activeScene.title)} »`
            : `<i class="fas fa-layer-group"></i> ${escapeHtml(what)} par défaut (aucune scène active)`;
    });

    // [NEW] Dynamically hide/show sidebar items based on active scene
    const sceneRequiredItems = document.querySelectorAll('.scene-required');
    sceneRequiredItems.forEach(item => {
        item.style.display = activeSceneId ? 'block' : 'none';
    });

    // If no scene is selected and we are NOT on presets tab, force presets tab
    if (!activeSceneId && window.location.hash !== '#presets') {
        const presetsTab = document.querySelector('a[href="#presets"]');
        if (presetsTab) presetsTab.click();
    }
};

// Soundboard Logic
// Soundboard Logic
// [NEW] Helper to add local sound to UI instantly
window.addLocalSoundToUI = (sound) => {
    // 1. Add to Soundboard Grid (Grid)
    const grid = document.getElementById('soundboard-grid');
    if (grid) {
        // Remove "Aucun son" if present
        if (grid.querySelector('.text-dim')) grid.innerHTML = '';

        const safeUrl = normalizeUrl(sound.url);
        // data-id is important for delete
        const encodedData = encodeURIComponent(JSON.stringify({ title: sound.title, url: safeUrl, id: sound.id }));

        const el = document.createElement('div');
        el.id = `sound-item-${sound.id}`; // Add ID for easy removal
        el.className = 'sound-item user-uploaded';
        el.style.animation = 'fadeIn 0.5s ease-out';
        el.innerHTML = `
            <div class="sound-badge">${sound.isUploading ? '<i class="fas fa-spinner fa-spin"></i>' : 'UPLOAD'}</div>
            <span class="sound-info">${escapeHtml(sound.title)}</span>
            <div class="sound-actions">
                <button class="btn-icon preview" onclick="previewSound('${safeUrl}')" title="Écouter"><i class="fas fa-play"></i></button>
                ${sound.isUploading ? '' : `<button class="btn-icon quick" onclick="openQuickSound('${encodedData}')" title="Lien Rapide"><i class="fas fa-bolt"></i></button>`}
                ${sound.isUploading ? '' : `<button class="btn-icon delete" onclick="deleteSound('${sound.id}', event)" title="Supprimer"><i class="fas fa-trash-alt"></i></button>`}
            </div>
        `;
        grid.prepend(el);
    }

    // 2. Add to Sound List (Sidebar library)
    const list = document.querySelector('#sound-list');
    if (list) {
        if (list.querySelector('.text-dim')) list.innerHTML = '';

        const safeUrl = normalizeUrl(sound.url);
        const safeTitle = sound.title.replace(/'/g, "\\'");

        const el = document.createElement('div');
        if (sound.isUploading) el.setAttribute('data-temp', sound.id);
        el.className = 'sound-item';
        el.style.animation = 'fadeIn 0.5s ease-out';
        el.innerHTML = `
            <div class="sound-icon-wrapper">
                ${sound.isUploading ? '<i class="fas fa-spinner fa-spin" style="color: var(--secondary); font-size: 0.7rem;"></i>' : '<i class="fas fa-upload" style="color: var(--secondary); font-size: 0.7rem;"></i>'}
            </div>
             <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
                <span class="sound-name" title="${escapeHtml(sound.title)}">${escapeHtml(sound.title)}</span>
            </div>
            <div class="sound-actions">
                <button class="btn-mini btn-mini-play" onclick="previewSound('${safeUrl}', this)">
                    <i class="fas fa-play"></i>
                </button>
                ${sound.isUploading ? '' : `<button class="btn-mini btn-mini-select" onclick="selectSound('${safeTitle}', '${safeUrl}')">
                    Choisir
                </button>`}
            </div>
        `;
        list.prepend(el);
    }
};

async function loadSoundboard(query = '') {
    const container = document.getElementById('soundboard-grid');
    container.innerHTML = '<div class="loading-spinner">Chargement...</div>';

    try {
        // [LOCAL UPLOAD] Use local for sounds if available
        const base = isLocalMode ? getLocalApiBase() : getApiBase();
        const token = getToken();
        const url = new URL(`${base}/api/sounds`, window.location.origin);
        if (query) url.searchParams.set('q', query);
        url.searchParams.set('token', token || '');

        const res = await fetch(url);
        const data = await res.json();
        const sounds = data.sounds || data; // Handle both {sounds: []} and []
        renderSoundboard(sounds);
    } catch (e) {
        container.innerHTML = '<div class="error">Erreur chargement sons: ' + e.message + '</div>';
    }
}

function renderSoundboard(sounds) {
    const container = document.getElementById('soundboard-grid');
    if (!container) return;
    container.innerHTML = '';

    if (!sounds || sounds.length === 0) {
        container.innerHTML = '<div class="text-dim">Aucun son trouvé.</div>';
        return;
    }

    sounds.forEach(sound => {
        const title = sound.title;
        const url = sound.url;
        const id = sound.id;

        const el = document.createElement('div');
        const safeUrl = normalizeUrl(url);
        el.className = 'sound-item' + (sound.isLocal ? ' user-uploaded' : '');
        el.innerHTML = `
            ${sound.isLocal ? '<div class="sound-badge">UPLOAD</div>' : ''}
            <span class="sound-info">${title}</span>
            <div class="sound-actions">
                <button class="btn-icon preview" onclick="previewSound('${safeUrl}')" title="Écouter"><i class="fas fa-play"></i></button>
                <button class="btn-icon quick" onclick="openQuickSound('${encodeURIComponent(JSON.stringify({ title, url: safeUrl, id }))}')" title="Lien Rapide"><i class="fas fa-bolt"></i></button>
                ${sound.isLocal ? `<button class="btn-icon delete" onclick="deleteSound('${id}', event)" title="Supprimer"><i class="fas fa-trash-alt"></i></button>` : ''}
            </div>
        `;
        container.appendChild(el);
    });

    // [NEW] Setup Drag & Drop Upload if not already done
    if (!container.dataset.dragEnabled) {
        container.dataset.dragEnabled = "true";
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('drag-over');
        });
        container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) {
                await handleSoundUpload({ target: { files: [file] } });
            } else {
                showToast('Veuillez glisser un fichier audio.', 'error');
            }
        });
    }
}

// [NEW] Delete Sound Function
window.deleteSound = async (id, e) => {
    if (e) e.stopPropagation();
    const confirmed = await showConfirm('Supprimer ce son ?', 'Il sera définitivement retiré de votre bibliothèque.', 'Supprimer');
    if (!confirmed) return;

    try {
        // [LOCAL DELETE] Use local server if available
        const base = isLocalMode ? getLocalApiBase() : getApiBase();
        const token = getToken();
        const res = await fetch(`${base}/api/sounds/${id}?token=${token || ''}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            showToast('Son supprimé');
            loadSoundboard();
            fetchSounds();
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showNotify('Erreur', 'Impossible de supprimer le son: ' + err.message, 'error');
    }
};

// Quick Sound Link Logic
// Quick Sound Link Logic
window.openQuickSound = async (encodedData) => {
    const data = JSON.parse(decodeURIComponent(encodedData));

    document.querySelector('#qs-sound-name').value = data.title;
    document.querySelector('#qs-sound-url').value = data.url;
    document.querySelector('#qs-display-name').value = data.title;
    document.querySelector('#qs-volume').value = 50;

    openModal('modal-quick-sound');

    // Load Gifts
    await loadQuickSoundGifts();
};

// Global Cache for Quick Sound Gifts
window.quickSoundGiftsCache = [];

window.loadQuickSoundGifts = async () => {
    const container = document.querySelector('#qs-gift-grid');
    if (!container) return;

    container.innerHTML = '<div class="loader">Chargement des cadeaux...</div>';

    // Reset search
    const searchInput = document.querySelector('#qs-gift-search');
    if (searchInput) searchInput.value = '';

    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/gifts?token=${token || ''}`);
        const gifts = await res.json();

        window.quickSoundGiftsCache = gifts;
        renderQuickSoundGifts(gifts);
    } catch (e) {
        container.innerHTML = '<div class="error">Erreur décadeaux</div>';
    }
};

window.renderQuickSoundGifts = (gifts) => {
    const container = document.querySelector('#qs-gift-grid');
    if (!container) return;

    if (!gifts || gifts.length === 0) {
        container.innerHTML = '<div class="text-dim" style="text-align:center; width:100%; padding:20px;">Aucun cadeau trouvé</div>';
        return;
    }

    container.innerHTML = gifts.map(g => {
        // Fix potential undefined price
        const price = g.diamond_count !== undefined ? g.diamond_count : (g.price || 0);
        // Fix duplicated name if present (simple check or just render name as is)
        // Sanitization for onclick
        const safeName = (g.name || "").replace(/'/g, "\\'");

        return `
            <div class="gift-item" onclick="selectQuickGift(this, '${g.id}', '${safeName}')">
                <img src="${normalizeUrl(g.url)}" alt="${g.name}" loading="lazy" class="gift-icon">
                <span class="gift-name" style="white-space: normal; line-height: 1.2;">${g.name}</span>
                <span class="gift-price">
                    <img src="${PRODUCTION_URL}/img/diamond.png" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 2px;"> 
                    ${price}
                </span>
            </div>
        `;
    }).join('');
};

window.filterQuickSoundGifts = (query) => {
    const term = query.toLowerCase();

    // If empty query, show all
    if (!term) {
        renderQuickSoundGifts(window.quickSoundGiftsCache);
        return;
    }

    const filtered = window.quickSoundGiftsCache.filter(g =>
        (g.name && g.name.toLowerCase().includes(term)) ||
        (g.id && g.id.toString().includes(term))
    );
    renderQuickSoundGifts(filtered);
};

window.selectQuickGift = (el, id, name) => {
    document.querySelectorAll('#qs-gift-grid .gift-item.selected').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    document.querySelector('#qs-gift-id').value = id;
    document.querySelector('#qs-gift-name').value = name;
};

// Function to update quick sound trigger fields based on selected type
// Function to update quick sound trigger fields based on selected type
window.updateQuickSoundTriggerFields = () => {
    const triggerType = document.querySelector('#qs-trigger-type').value;

    // Hide all first
    document.querySelector('#qs-gift-container').style.display = 'none';
    document.querySelector('#qs-like-container').style.display = 'none';
    document.querySelector('#qs-chat-container').style.display = 'none';
    document.querySelector('#qs-command-container').style.display = 'none';
    document.querySelector('#qs-gift-min-container').style.display = 'none';

    // Show selected
    if (triggerType === 'gift') {
        document.querySelector('#qs-gift-container').style.display = 'block';
    } else if (triggerType === 'like') {
        document.querySelector('#qs-like-container').style.display = 'block';
    } else if (triggerType === 'chat') {
        document.querySelector('#qs-chat-container').style.display = 'block';
    } else if (triggerType === 'command') {
        document.querySelector('#qs-command-container').style.display = 'block';
    } else if (triggerType === 'gift_min') {
        document.querySelector('#qs-gift-min-container').style.display = 'block';
    }
};

document.querySelector('#form-quick-sound').onsubmit = async (e) => {
    e.preventDefault();

    const btnSubmit = document.querySelector('#form-quick-sound button[type="submit"]');
    const originalText = btnSubmit ? btnSubmit.innerHTML : 'Ajouter';

    const triggerType = document.querySelector('#qs-trigger-type').value;
    const soundName = document.querySelector('#qs-sound-name').value;
    const soundUrl = document.querySelector('#qs-sound-url').value;
    const volume = document.querySelector('#qs-volume').value;

    // Validate gift selection if trigger is gift
    if (triggerType === 'gift') {
        const selectedGift = document.querySelector('#qs-gift-name').value;
        if (!selectedGift) {
            showToast("Veuillez choisir un cadeau !", 'error');
            return;
        }
    }

    // [NEW] Get Like Threshold
    // [NEW] Get Like Threshold
    let likeThreshold = 0;
    if (triggerType === 'like') {
        const thresholdInput = document.querySelector('#qs-like-threshold');
        if (thresholdInput) likeThreshold = parseInt(thresholdInput.value) || 100;
        if (likeThreshold < 1) likeThreshold = 1;
    }

    // [NEW] Other Trigger Values
    let chatMessage = '';
    if (triggerType === 'chat') {
        chatMessage = document.querySelector('#qs-chat-message').value;
        if (!chatMessage) { showToast("Veuillez entrer un message !", 'error'); return; }
    }

    let commandWord = '';
    if (triggerType === 'command') {
        commandWord = document.querySelector('#qs-command-word').value;
        if (!commandWord) { showToast("Veuillez entrer une commande !", 'error'); return; }
        if (!commandWord.startsWith('!')) commandWord = '!' + commandWord;
    }

    let minCoins = 1;
    if (triggerType === 'gift_min') {
        minCoins = parseInt(document.querySelector('#qs-min-coins').value) || 1;
        if (minCoins < 1) minCoins = 1;
    }

    // [ANTI-DUPLICATE] Check if this sound is already linked to the same trigger
    const isDuplicate = currentEvents.some(evt => {
        // 1. Check Trigger Match
        if (evt.triggerType !== triggerType) return false;

        let triggerMatch = true;
        if (triggerType === 'gift') {
            const giftName = document.querySelector('#qs-gift-name').value;
            triggerMatch = (evt.giftName === giftName);
        } else if (triggerType === 'like') {
            triggerMatch = (evt.likeCount === likeThreshold);
        } else if (triggerType === 'chat') {
            triggerMatch = (evt.message === chatMessage);
        } else if (triggerType === 'command') {
            triggerMatch = (evt.command === commandWord);
        } else if (triggerType === 'gift_min') {
            triggerMatch = (evt.minCoins === minCoins);
        }

        if (!triggerMatch) return false;

        // 2. Check Action Match (Same Sound)
        return evt.actions.some(aId => {
            const act = currentActions.find(a => a.id === aId);
            return act && (act.soundUrl === soundUrl || act.url === soundUrl);
        });
    });

    if (isDuplicate) {
        showNotify('Doublon', 'Ce son est déjà lié à ce déclencheur !', 'warning');
        return;
    }

    // Loading State
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ajout...';
    }

    try {
        // 1. Create Action
        const actionId = 'acc_' + Date.now();
        const action = {
            id: actionId,
            name: `Sound: ${soundName}`,
            type: 'sound',
            soundName: soundName,
            soundUrl: soundUrl,
            volume: volume
        };
        currentActions.push(action);
        await sync('actions', currentActions);

        // 2. Create Event
        const eventId = 'evt_' + Date.now();
        const event = {
            id: eventId,
            active: true,
            who: 'everyone',
            triggerType: triggerType,
            actions: [actionId]
        };

        // Add gift-specific fields if needed
        if (triggerType === 'gift') {
            event.giftName = document.querySelector('#qs-gift-name').value;
            event.giftId = document.querySelector('#qs-gift-id').value;
        } else if (triggerType === 'like') {
            event.likeCount = likeThreshold;
        } else if (triggerType === 'chat') {
            event.message = chatMessage;
        } else if (triggerType === 'command') {
            event.command = commandWord;
        } else if (triggerType === 'gift_min') {
            event.minCoins = minCoins;
        }

        currentEvents.push(event);
        await sync('events', currentEvents);

        // Refresh & Close
        let label = '';
        if (triggerType === 'gift') label = `🎁 ${document.querySelector('#qs-gift-name').value}`;
        else if (triggerType === 'like') label = `❤️ Likes (Obj: ${likeThreshold})`;
        else if (triggerType === 'chat') label = `💬 "${chatMessage}"`;
        else if (triggerType === 'command') label = `⌨️ ${commandWord}`;
        else if (triggerType === 'gift_min') label = `💰 Min: ${minCoins} pièces`;
        else label = triggerType;

        addLog(`✨ Lien créé : ${label} → ${soundName}`, 'success');
        closeModal('modal-quick-sound');
        renderActions();
        renderEvents();
        renderSoundLinks();
    } catch (err) {
        console.error("Error creating quick sound:", err);
        showNotify('Erreur', "Echec de l'ajout du son", 'error');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
        }
    }
};

// Upload Logic
// [REMOVED] Duplicate upload logic

document.getElementById('btn-sb-search').onclick = () => {
    const q = document.getElementById('sb-search').value;
    loadSoundboard(q);
};

let searchTimeout;
document.getElementById('sb-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadSoundboard(e.target.value);
    }, 500);
});

async function handleReset() {
    const confirmed = await showConfirm(
        'Réinitialiser le compte ?',
        'Voulez-vous vraiment réinitialiser le token et le pseudo ? (Déconnexion)',
        'Oui, réinitialiser'
    );
    if (!confirmed) return;
    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        await fetch(`${base}/api/reset?token=${token || ''}`, { method: 'POST' });
        window.location.reload();
    } catch (e) {
        showNotify("Erreur", "Erreur lors de la réinitialisation: " + e.message, 'error');
    }
}

// Helper to determine which API to talk to (Local if available, otherwise current origin)
async function handleSoundUpload(e) {
    const token = getToken();
    const file = e.target.files ? e.target.files[0] : null; // Support both event types
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file); // API expects 'file'

    const btn = document.getElementById('btn-sb-upload');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        btn.disabled = true;
    }
    showToast('Upload en cours...', 'info');

    // OPTIMISTIC UI: Show sound immediately with Blob URL
    const tempId = 'temp_' + Date.now();
    const blobUrl = URL.createObjectURL(file);
    const tempSound = {
        id: tempId,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        url: blobUrl,
        isLocal: true,
        isUploading: true
    };
    if (window.addLocalSoundToUI) window.addLocalSoundToUI(tempSound);

    try {
        // [LOCAL UPLOAD] Use Local API if in local mode for speed
        const base = isLocalMode ? getLocalApiBase() : getApiBase();
        const token = getToken();
        // Send token as query param to be safe against multipart field ordering
        const res = await fetch(`${base}/api/upload?token=${encodeURIComponent(token || '')}`, {
            method: 'POST',
            body: formData
        });

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (jsonErr) {
            console.error('Server returned non-JSON:', text);
            throw new Error('Le serveur a retourné une réponse invalide (HTML).');
        }

        if (data.success) {
            // Remove temp optimistic item
            const tempItem = document.getElementById(`sound-item-${tempId}`);
            if (tempItem) tempItem.remove(); // Remove from Grid
            const tempList = document.querySelector(`#sound-list .sound-item[data-temp="${tempId}"]`);
            if (tempList) tempList.remove(); // Remove from List

            showToast('✅ Son ajouté avec succès !');

            // Add real item
            const newSound = {
                id: data.id,
                title: data.name,
                url: data.url,
                isLocal: true
            };
            if (window.addLocalSoundToUI) window.addLocalSoundToUI(newSound);
            else Promise.all([fetchSounds(), loadSoundboard()]);

            closeModal('modal-sound-upload');
        } else {
            // Remove temp item on error
            const tempItem = document.getElementById(`sound-item-${tempId}`);
            if (tempItem) tempItem.remove();

            showNotify('Erreur', '❌ Erreur: ' + (data.error || 'Upload échoué'), 'error');
        }
    } catch (err) {
        console.error('Upload error:', err);
        // Remove temp item on error
        const tempItem = document.getElementById(`sound-item-${tempId}`);
        if (tempItem) tempItem.remove();

        showNotify('Erreur', '❌ Erreur lors de l\'upload.', 'error');
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
        if (e.target && e.target.value) e.target.value = ''; // Reset input
    }
}



function normalizeUrl(url) {
    if (!url) return '';
    if (url.startsWith('http')) {
        // If we are on production but the URL is local, fix it
        if (window.location.hostname.includes('gentok.fr') && url.includes('localhost:3000')) {
            return url.replace('http://localhost:3000', PRODUCTION_URL);
        }
        return url;
    }
    // Relative URL: Prepend current base
    return getApiBase() + (url.startsWith('/') ? '' : '/') + url;
}

function getApiBase() {
    // [NEW] Everything (Settings, Leaderboards, etc.) now uses the VPS
    // even in App Mode, to ensure data synchronization.
    return PRODUCTION_URL;
}

// [NEW] Local Engine Base (Only for Start/Stop commands)
function getLocalApiBase() {
    return 'http://localhost:3000';
}

// [NEW] Helper to build API URLs with token
function buildApiUrl(endpoint) {
    const base = getApiBase();
    const token = getToken();
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${base}${endpoint}${separator}token=${encodeURIComponent(token)}`;
}

// Status update logic to trigger data refresh
let lastConnectionMode = null;
function onConnectionChange() {
    const isLocal = isLocalMode;
    const currentMode = isLocal ? 'local' : 'vps';

    // Only log and fetch if mode actually changed
    if (lastConnectionMode !== currentMode) {
        addLog(isLocal ? '📡 Mode Local activé (Direct)' : '🌐 Mode VPS activé (Relais)', 'system');
        fetchData();
        lastConnectionMode = currentMode;
    }
}

// Lock Screen Logic
function showLockScreen(message) {
    // Create overlay if not exists
    let overlay = document.querySelector('#lock-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lock-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            text-align: center;
        `;
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <i class="fas fa-lock" style="font-size: 4rem; color: var(--error); margin-bottom: 20px;"></i>
        <h2 style="font-size: 2rem; margin-bottom: 10px;">Accès Verrouillé</h2>
        <p style="font-size: 1.2rem; margin-bottom: 30px; color: #aaa; max-width: 500px;">${message}</p>
        <button class="btn-primary" onclick="window.location.reload()">Réessayer</button>
    `;
}

// Start the app removed from here (it's in DOMContentLoaded)
// init(); 
async function handleSaveSpotify() {
    const isEnabled = document.querySelector('#spotify-enabled').checked;
    const clientId = document.querySelector('#spotify-clientid').value.trim();
    const clientSecret = document.querySelector('#spotify-clientsecret').value.trim();

    // Only validate if trying to enable the module
    if (isEnabled && (!clientId || !clientSecret)) {
        const statusMsg = document.querySelector('#spotify-status-msg');
        if (statusMsg && !statusMsg.querySelector('.fa-check-circle')) {
            showNotify('Spotify', 'Veuillez remplir le Client ID et Client Secret pour activer Spotify.', 'warning');
            return;
        }
    }

    const settings = {
        enabled: isEnabled,
        clientId: clientId,
        clientSecret: clientSecret,

        // New Settings
        playEnabled: document.querySelector('#spotify-play-enabled').checked,
        skipEnabled: document.querySelector('#spotify-skip-enabled').checked,
        // Removed allowExplicit
        alwaysShowOverlay: document.querySelector('#spotify-always-overlay').checked,

        skipInstant: {
            moderators: document.querySelector('#spotify-skip-instant-mods').checked,
            subscribers: document.querySelector('#spotify-skip-instant-subs').checked,
            followers: document.querySelector('#spotify-skip-instant-followers').checked
        },

        maxQueueSize: parseInt(document.querySelector('#spotify-max-queue').value) || 50,
        maxTracksPerUser: parseInt(document.querySelector('#spotify-max-tracks').value) || 5,
        skipVotes: parseInt(document.querySelector('#spotify-skip-votes').value) || 3,

        allowedUsers: {
            all: document.querySelector('#spotify-allow-all').checked,
            subscribers: document.querySelector('#spotify-allow-subs').checked,
            followers: document.querySelector('#spotify-allow-followers').checked,
            moderators: document.querySelector('#spotify-allow-mods').checked
        },

        commands: {
            play: document.querySelector('#spotify-cmd-play').value || '!play',
            skip: document.querySelector('#spotify-cmd-skip').value || '!skip',
            remove: document.querySelector('#spotify-cmd-remove').value || '!remove'
        }
    };

    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/spotify/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spotify: settings, token })
        });
        const result = await res.json();
        if (result.success) {
            showToast('Paramètres Spotify enregistrés !');
            fetchData(); // Refresh to show new state
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showNotify('Erreur', err.message, 'error');
    }
}

async function handleConnectSpotify() {
    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/spotify/auth-url?token=${token || ''}`);
        const result = await res.json();
        if (result.url) {
            window.open(result.url, 'Spotify Auth', 'width=600,height=800');
        } else {
            throw new Error(result.error || 'Impossible de générer l\'URL d\'auth.');
        }
    } catch (err) {
        showNotify('Erreur', err.message, 'error');
    }
}

// =======================
// ANNOUNCEMENTS & UPDATES
// =======================
async function fetchAnnouncements() {
    try {
        // Check against remote source of truth for global announcements
        const res = await fetch(`https://tiktok.gentok.fr/api/announcements`);
        const data = await res.json();

        if (data.active) {
            const lastSeen = localStorage.getItem('last_announcement');
            // If message changed or never seen
            if (lastSeen !== data.message) {
                Swal.fire({
                    title: data.title || 'Annonce',
                    html: data.message, // Use HTML for rich text
                    icon: data.type || 'info',
                    confirmButtonText: 'Compris',
                    confirmButtonColor: '#fe2c55',
                    background: '#1a1a1a',
                    color: '#fff',
                    backdrop: `rgba(0,0,0,0.8)`
                }).then(() => {
                    localStorage.setItem('last_announcement', data.message);
                });
            }
        }
    } catch (e) {
        console.warn('Failed to fetch announcements:', e);
    }
}

async function checkUpdate() {
    if (!window.electronAPI) return;

    try {
        const currentVersion = await window.electronAPI.getAppVersion();
        const lastVersion = localStorage.getItem('gentok_last_version');

        console.log(`[Version Tracker] Current: ${currentVersion} | Last Saved: ${lastVersion}`);

        if (lastVersion && lastVersion !== currentVersion) {
            console.log('✨ New version detected! Showing success notification.');

            // Notification Premium
            Swal.fire({
                title: 'Application à jour !',
                html: `Votre application a été mise à jour.<br><br>Version actuelle : <b style="color: #fe2c55;">v${currentVersion}</b>`,
                icon: 'success',
                confirmButtonText: 'C\'est parti',
                confirmButtonColor: '#fe2c55',
                background: '#1a1a1a',
                color: '#fff',
                timer: 5000,
                timerProgressBar: true
            });

            // Status bar notification
            showToast(`Mis à jour en v${currentVersion}`);
        }

        // Session Reset Check
        if (localStorage.getItem('gentok_session_cleared')) {
            localStorage.removeItem('gentok_session_cleared');
            showToast('Session réinitialisée !');
        }

        // Always update the stored version
        localStorage.setItem('gentok_last_version', currentVersion);
    } catch (e) {
        console.warn('[Version Tracker] Error:', e);
    }
}

// Pro Modal Functions
window.openProModal = () => {
    console.log("[Gentok] Opening Pro Modal...");
    const modal = document.getElementById('pro-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // Force display flex
        document.body.style.overflow = 'hidden';
    } else {
        console.error("[Gentok] Modal 'pro-modal' not found in DOM");
    }
};

window.closeProModal = () => {
    const modal = document.getElementById('pro-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

window.addEventListener('click', (e) => {
    const modal = document.getElementById('pro-modal');
    if (e.target === modal) {
        window.closeProModal();
    }
});

// subscribePlan(plan, button) is defined in premium.js (Stripe checkout + activation)

// ========================================
// TTS CHAT SYSTEM
// ========================================

let ttsConfig = {
    enabled: false,
    language: 'fr-FR',
    voice: null,
    randomVoice: false,
    speed: 1.0,
    pitch: 1.0,
    volume: 1.0,
    allowedUsers: {
        all: false,
        followers: false,
        subscribers: true,
        moderators: true,
        team: true,
        gifters: false
    },
    teamMinLevel: 10,
    giftersTop: 1,
    commentType: 'dot', // 'any', 'dot', 'slash', 'command'
    commandTrigger: '!tts',
    cooldown: 10,
    maxQueue: 5,
    maxLength: 100,
    filterSpam: true,
    filterMentions: true,
    filterCommands: true,
    readChat: true,
    events: {}
};

let ttsQueue = [];
let ttsUserCooldowns = new Map();
let ttsCurrentUtterance = null;
let ttsVoices = [];
let ttsSynth = window.speechSynthesis;

// Initialize TTS System
async function initTTS() {
    console.log('[TTS] Initializing TTS System...');

    // Load voices (natural voices from the server, then the ones of this computer)
    loadVoices();
    fetchNeuralVoices();
    if (ttsSynth && ttsSynth.onvoiceschanged !== undefined) {
        ttsSynth.onvoiceschanged = loadVoices;
    }

    // Bind UI elements FIRST
    bindTTSUI();

    // Load saved config from MongoDB
    try {
        const base = getApiBase(); // [FIX] Define base URL
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/tts/settings?token=${token || ''}`);
        if (res.ok) {
            const saved = await res.json();
            console.log('[TTS] Received from MongoDB:', saved);

            if (saved && Object.keys(saved).length > 0) {
                // Merge with default config
                ttsConfig = {
                    ...ttsConfig,
                    ...saved,
                    allowedUsers: { ...ttsConfig.allowedUsers, ...(saved.allowedUsers || {}) },
                    events: (saved.events && typeof saved.events === 'object') ? saved.events : {}
                };
                console.log('[TTS] Config loaded from MongoDB:', ttsConfig);

                // Update UI with loaded values
                updateTTSUI();
            }
        }
    } catch (e) {
        console.warn('[TTS] Failed to load config from server:', e);
    }

    console.log('[TTS] TTS System Ready');
}

// Reload the TTS settings of the active scene (after a scene switch)
async function reloadTTSConfig() {
    try {
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${getApiBase()}/api/tts/settings?token=${encodeURIComponent(token || '')}&t=${Date.now()}`);
        if (!res.ok) return;
        const saved = await res.json();
        ttsConfig = {
            ...ttsConfig,
            ...saved,
            allowedUsers: { ...ttsConfig.allowedUsers, ...(saved.allowedUsers || {}) },
            events: (saved.events && typeof saved.events === 'object') ? saved.events : {}
        };
        ttsQueue = [];
        loadVoices();
        updateTTSUI();
    } catch (e) {
        console.warn('[TTS] Reload after scene switch failed', e);
    }
}

// Natural voices (free Edge neural voices, synthesized by the server: /api/tts/voices and /api/tts/generate).
// The browser / Windows voices stay available below them and are used as a fallback if the server can't answer.
let NEURAL_VOICES = [
    { id: 'fr-FR-DeniseNeural', name: 'Denise', lang: 'fr-FR', gender: 'F', style: 'Claire et posée' },
    { id: 'fr-FR-VivienneMultilingualNeural', name: 'Vivienne', lang: 'fr-FR', gender: 'F', style: 'Chaleureuse, très naturelle' },
    { id: 'fr-FR-EloiseNeural', name: 'Eloise', lang: 'fr-FR', gender: 'F', style: 'Jeune, enjouée' },
    { id: 'fr-FR-HenriNeural', name: 'Henri', lang: 'fr-FR', gender: 'M', style: 'Grave, radio' },
    { id: 'fr-FR-RemyMultilingualNeural', name: 'Rémy', lang: 'fr-FR', gender: 'M', style: 'Dynamique, très naturel' }
];
// Old TikTok voices saved in settings now map to a natural voice on the server
const LEGACY_TTS_VOICES = ['fr_001', 'fr_002'];
const isNeuralVoice = (id) => !!id && (NEURAL_VOICES.some(v => v.id === id) || LEGACY_TTS_VOICES.includes(id));

async function fetchNeuralVoices() {
    try {
        const r = await fetch(`${getApiBase()}/api/tts/voices`);
        const d = await r.json();
        if (Array.isArray(d.voices) && d.voices.length) NEURAL_VOICES = d.voices;
    } catch (e) {
        console.warn('[TTS] Natural voices list unavailable, using the built-in one', e);
    }
    loadVoices();
}

// Natural voices of the chosen language (same country first, then the other countries of the language)
function neuralVoicesFor(lang) {
    const base = (lang || 'fr-FR').slice(0, 2);
    const same = NEURAL_VOICES.filter(v => v.lang === lang);
    const others = NEURAL_VOICES.filter(v => v.lang !== lang && v.lang.startsWith(base));
    return same.concat(others);
}

// The voice really used for a message ("" = automatic: first natural voice of the language)
function resolveTTSVoice() {
    if (ttsConfig.randomVoice) {
        const pool = neuralVoicesFor(ttsConfig.language);
        if (pool.length) return pool[Math.floor(Math.random() * pool.length)].id;
    }
    if (ttsConfig.voice) return ttsConfig.voice;
    const auto = neuralVoicesFor(ttsConfig.language)[0];
    return auto ? auto.id : '';
}

function loadVoices() {
    ttsVoices = ttsSynth ? ttsSynth.getVoices() : [];

    const voiceSelect = document.getElementById('tts-voice');
    if (!voiceSelect) return;
    voiceSelect.innerHTML = '';

    const auto = document.createElement('option');
    auto.value = '';
    auto.textContent = 'Automatique (voix naturelle)';
    voiceSelect.appendChild(auto);

    const base = (ttsConfig.language || 'fr-FR').slice(0, 2);
    const group = (label, voices, toOption) => {
        if (!voices.length) return;
        const g = document.createElement('optgroup');
        g.label = label;
        voices.forEach(v => g.appendChild(toOption(v)));
        voiceSelect.appendChild(g);
    };
    const neuralOption = (v) => {
        const o = document.createElement('option');
        o.value = v.id;
        o.textContent = `${v.gender === 'M' ? '♂' : '♀'} ${v.name} · ${v.style} (${v.lang})`;
        return o;
    };

    // 1. Natural voices (free, best quality)
    group('Voix naturelles (gratuites)', neuralVoicesFor(ttsConfig.language), neuralOption);
    // 2. Natural voices of the other languages (a French streamer can read English messages...)
    group('Autres langues (voix naturelles)', NEURAL_VOICES.filter(v => !v.lang.startsWith(base)), neuralOption);
    // 3. Voices installed on this computer / browser
    group('Voix de cet ordinateur', ttsVoices.filter(v => v.lang.startsWith(base)), (voice) => {
        const o = document.createElement('option');
        o.value = voice.name; // name used by SpeechSynthesis
        o.textContent = `${voice.name} (${voice.lang})`;
        return o;
    });

    const saved = LEGACY_TTS_VOICES.includes(ttsConfig.voice) ? '' : (ttsConfig.voice || '');
    voiceSelect.value = saved;
    if (voiceSelect.value !== saved) voiceSelect.value = ''; // voice not available here: automatic
}

// Bind UI controls
function bindTTSUI() {
    const elements = {
        enabled: document.getElementById('tts-enabled'),
        language: document.getElementById('tts-language'),
        voice: document.getElementById('tts-voice'),
        randomVoice: document.getElementById('tts-random-voice'),
        speed: document.getElementById('tts-speed'),
        pitch: document.getElementById('tts-pitch'),
        volume: document.getElementById('tts-volume'),
        allowAll: document.getElementById('tts-allow-all'),
        allowFollowers: document.getElementById('tts-allow-followers'),
        allowSubscribers: document.getElementById('tts-allow-subscribers'),
        allowModerators: document.getElementById('tts-allow-moderators'),
        allowTeam: document.getElementById('tts-allow-team'),
        allowGifters: document.getElementById('tts-allow-gifters'),
        teamLevel: document.getElementById('tts-team-level'),
        giftersTop: document.getElementById('tts-gifters-top'),
        commandTrigger: document.getElementById('tts-command-trigger'),
        cooldown: document.getElementById('tts-cooldown'),
        maxQueue: document.getElementById('tts-queue-max'),
        maxLength: document.getElementById('tts-max-length'),
        filterSpam: document.getElementById('tts-filter-spam'),
        filterMentions: document.getElementById('tts-filter-mentions'),
        filterCommands: document.getElementById('tts-filter-commands'),
        testInput: document.getElementById('tts-test-input'),
        testBtn: document.getElementById('btn-tts-test')
    };

    // Load saved values
    if (elements.enabled) elements.enabled.checked = ttsConfig.enabled;
    if (elements.language) elements.language.value = ttsConfig.language;
    if (elements.voice) elements.voice.value = ttsConfig.voice || '';
    if (elements.randomVoice) elements.randomVoice.checked = ttsConfig.randomVoice;
    if (elements.speed) elements.speed.value = ttsConfig.speed;
    if (elements.pitch) elements.pitch.value = ttsConfig.pitch;
    if (elements.volume) elements.volume.value = ttsConfig.volume;
    if (elements.allowAll) elements.allowAll.checked = ttsConfig.allowedUsers.all;
    if (elements.allowFollowers) elements.allowFollowers.checked = ttsConfig.allowedUsers.followers;
    if (elements.allowSubscribers) elements.allowSubscribers.checked = ttsConfig.allowedUsers.subscribers;
    if (elements.allowModerators) elements.allowModerators.checked = ttsConfig.allowedUsers.moderators;
    if (elements.allowTeam) elements.allowTeam.checked = ttsConfig.allowedUsers.team;
    if (elements.allowGifters) elements.allowGifters.checked = ttsConfig.allowedUsers.gifters;
    if (elements.teamLevel) elements.teamLevel.value = ttsConfig.teamMinLevel;
    if (elements.giftersTop) elements.giftersTop.value = ttsConfig.giftersTop;
    if (elements.commandTrigger) elements.commandTrigger.value = ttsConfig.commandTrigger;
    if (elements.cooldown) elements.cooldown.value = ttsConfig.cooldown;
    if (elements.maxQueue) elements.maxQueue.value = ttsConfig.maxQueue;
    if (elements.maxLength) elements.maxLength.value = ttsConfig.maxLength;
    if (elements.filterSpam) elements.filterSpam.checked = ttsConfig.filterSpam;
    if (elements.filterMentions) elements.filterMentions.checked = ttsConfig.filterMentions;
    if (elements.filterCommands) elements.filterCommands.checked = ttsConfig.filterCommands;

    // Set comment type radio
    const typeRadios = document.querySelectorAll('input[name="tts-type"]');
    typeRadios.forEach(radio => {
        if (radio.value === ttsConfig.commentType) {
            radio.checked = true;
        }
    });

    // Add change listeners
    if (elements.enabled) elements.enabled.addEventListener('change', saveTTSConfig);
    if (elements.language) elements.language.addEventListener('change', (e) => {
        ttsConfig.language = e.target.value;
        loadVoices();
        renderTTSEvents(); // default announcement texts follow the language
        saveTTSConfig();
    });
    const readChatEl = document.getElementById('tts-read-chat');
    if (readChatEl) {
        readChatEl.checked = ttsConfig.readChat !== false;
        readChatEl.addEventListener('change', saveTTSConfig);
    }
    renderTTSEvents();
    if (elements.voice) elements.voice.addEventListener('change', saveTTSConfig);
    if (elements.randomVoice) elements.randomVoice.addEventListener('change', saveTTSConfig);
    if (elements.speed) elements.speed.addEventListener('change', saveTTSConfig);
    if (elements.pitch) elements.pitch.addEventListener('change', saveTTSConfig);
    if (elements.volume) elements.volume.addEventListener('change', saveTTSConfig);
    if (elements.allowAll) elements.allowAll.addEventListener('change', saveTTSConfig);
    if (elements.allowFollowers) elements.allowFollowers.addEventListener('change', saveTTSConfig);
    if (elements.allowSubscribers) elements.allowSubscribers.addEventListener('change', saveTTSConfig);
    if (elements.allowModerators) elements.allowModerators.addEventListener('change', saveTTSConfig);
    if (elements.allowTeam) elements.allowTeam.addEventListener('change', saveTTSConfig);
    if (elements.allowGifters) elements.allowGifters.addEventListener('change', saveTTSConfig);
    if (elements.teamLevel) elements.teamLevel.addEventListener('change', saveTTSConfig);
    if (elements.giftersTop) elements.giftersTop.addEventListener('change', saveTTSConfig);
    if (elements.commandTrigger) elements.commandTrigger.addEventListener('change', saveTTSConfig);
    if (elements.cooldown) elements.cooldown.addEventListener('change', saveTTSConfig);
    if (elements.maxQueue) elements.maxQueue.addEventListener('change', saveTTSConfig);
    if (elements.maxLength) elements.maxLength.addEventListener('change', saveTTSConfig);
    if (elements.filterSpam) elements.filterSpam.addEventListener('change', saveTTSConfig);
    if (elements.filterMentions) elements.filterMentions.addEventListener('change', saveTTSConfig);
    if (elements.filterCommands) elements.filterCommands.addEventListener('change', saveTTSConfig);

    typeRadios.forEach(radio => {
        radio.addEventListener('change', saveTTSConfig);
    });

    // Test button
    if (elements.testBtn) {
        elements.testBtn.addEventListener('click', () => {
            const text = elements.testInput.value || 'Coucou c\'est moi';
            speakText(text, 'Test');
        });
    }
}

// Update TTS UI with current config values
function updateTTSUI() {
    const enabled = document.getElementById('tts-enabled');
    const language = document.getElementById('tts-language');
    const voice = document.getElementById('tts-voice');
    const randomVoice = document.getElementById('tts-random-voice');
    const speed = document.getElementById('tts-speed');
    const pitch = document.getElementById('tts-pitch');
    const volume = document.getElementById('tts-volume');
    const allowAll = document.getElementById('tts-allow-all');
    const allowFollowers = document.getElementById('tts-allow-followers');
    const allowSubscribers = document.getElementById('tts-allow-subscribers');
    const allowModerators = document.getElementById('tts-allow-moderators');
    const allowTeam = document.getElementById('tts-allow-team');
    const allowGifters = document.getElementById('tts-allow-gifters');
    const teamLevel = document.getElementById('tts-team-level');
    const giftersTop = document.getElementById('tts-gifters-top');
    const commandTrigger = document.getElementById('tts-command-trigger');
    const cooldown = document.getElementById('tts-cooldown');
    const maxQueue = document.getElementById('tts-queue-max');
    const maxLength = document.getElementById('tts-max-length');
    const filterSpam = document.getElementById('tts-filter-spam');
    const filterMentions = document.getElementById('tts-filter-mentions');
    const filterCommands = document.getElementById('tts-filter-commands');

    if (enabled) enabled.checked = ttsConfig.enabled;
    if (language) language.value = ttsConfig.language;
    if (voice) voice.value = ttsConfig.voice || '';
    if (randomVoice) randomVoice.checked = ttsConfig.randomVoice;
    if (speed) speed.value = ttsConfig.speed;
    if (pitch) pitch.value = ttsConfig.pitch;
    if (volume) volume.value = ttsConfig.volume;
    if (allowAll) allowAll.checked = ttsConfig.allowedUsers.all;
    if (allowFollowers) allowFollowers.checked = ttsConfig.allowedUsers.followers;
    if (allowSubscribers) allowSubscribers.checked = ttsConfig.allowedUsers.subscribers;
    if (allowModerators) allowModerators.checked = ttsConfig.allowedUsers.moderators;
    if (allowTeam) allowTeam.checked = ttsConfig.allowedUsers.team;
    if (allowGifters) allowGifters.checked = ttsConfig.allowedUsers.gifters;
    if (teamLevel) teamLevel.value = ttsConfig.teamMinLevel;
    if (giftersTop) giftersTop.value = ttsConfig.giftersTop;
    if (commandTrigger) commandTrigger.value = ttsConfig.commandTrigger;
    if (cooldown) cooldown.value = ttsConfig.cooldown;
    if (maxQueue) maxQueue.value = ttsConfig.maxQueue;
    if (maxLength) maxLength.value = ttsConfig.maxLength;
    if (filterSpam) filterSpam.checked = ttsConfig.filterSpam;
    if (filterMentions) filterMentions.checked = ttsConfig.filterMentions;
    if (filterCommands) filterCommands.checked = ttsConfig.filterCommands;

    // Update comment type radio
    const typeRadio = document.querySelector(`input[name="tts-type"][value="${ttsConfig.commentType}"]`);
    if (typeRadio) typeRadio.checked = true;

    const readChat = document.getElementById('tts-read-chat');
    if (readChat) readChat.checked = ttsConfig.readChat !== false;
    renderTTSEvents();

    console.log('[TTS] UI updated with config');
}

// Save TTS config
async function saveTTSConfig() {
    ttsConfig.enabled = document.getElementById('tts-enabled')?.checked || false;
    ttsConfig.language = document.getElementById('tts-language')?.value || 'fr-FR';
    ttsConfig.voice = document.getElementById('tts-voice')?.value || null;
    ttsConfig.randomVoice = document.getElementById('tts-random-voice')?.checked || false;
    ttsConfig.speed = parseFloat(document.getElementById('tts-speed')?.value) || 1.0;
    const pitchValue = parseFloat(document.getElementById('tts-pitch')?.value);
    ttsConfig.pitch = Number.isFinite(pitchValue) ? pitchValue : 1.0; // 0 = lowest voice, not "normal"
    ttsConfig.volume = parseFloat(document.getElementById('tts-volume')?.value) || 1.0;
    ttsConfig.allowedUsers.all = document.getElementById('tts-allow-all')?.checked || false;
    ttsConfig.allowedUsers.followers = document.getElementById('tts-allow-followers')?.checked || false;
    ttsConfig.allowedUsers.subscribers = document.getElementById('tts-allow-subscribers')?.checked || false;
    ttsConfig.allowedUsers.moderators = document.getElementById('tts-allow-moderators')?.checked || false;
    ttsConfig.allowedUsers.team = document.getElementById('tts-allow-team')?.checked || false;
    ttsConfig.allowedUsers.gifters = document.getElementById('tts-allow-gifters')?.checked || false;
    ttsConfig.teamMinLevel = parseInt(document.getElementById('tts-team-level')?.value) || 10;
    ttsConfig.giftersTop = parseInt(document.getElementById('tts-gifters-top')?.value) || 1;
    ttsConfig.commandTrigger = document.getElementById('tts-command-trigger')?.value || '!tts';
    ttsConfig.cooldown = parseInt(document.getElementById('tts-cooldown')?.value) || 10;
    ttsConfig.maxQueue = parseInt(document.getElementById('tts-queue-max')?.value) || 5;
    ttsConfig.maxLength = parseInt(document.getElementById('tts-max-length')?.value) || 100;
    ttsConfig.filterSpam = document.getElementById('tts-filter-spam')?.checked || false;
    ttsConfig.filterMentions = document.getElementById('tts-filter-mentions')?.checked || false;
    ttsConfig.filterCommands = document.getElementById('tts-filter-commands')?.checked || false;

    const selectedType = document.querySelector('input[name="tts-type"]:checked');
    if (selectedType) {
        ttsConfig.commentType = selectedType.value;
    }

    const readChat = document.getElementById('tts-read-chat');
    if (readChat) ttsConfig.readChat = readChat.checked;
    if (document.getElementById('tts-events-list')?.children.length) ttsConfig.events = readTTSEventsForm();

    // Save to MongoDB via API
    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/tts/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...ttsConfig, token })
        });

        if (res.ok) {
            console.log('[TTS] Config saved to MongoDB');
        } else {
            console.error('[TTS] Failed to save config:', await res.text());
        }
    } catch (e) {
        console.error('[TTS] Error saving config:', e);
    }
}

// ---------------------------------------------------------------- spoken event announcements
// "Que lire à voix haute ?": gifts, follows, shares, subscriptions and arrivals, with the TTS voice.
const TTS_EVENT_TYPES = [
    { type: 'gift', label: 'Cadeaux', icon: 'fa-gift', minCoins: true },
    { type: 'follow', label: 'Follows', icon: 'fa-user-plus' },
    { type: 'share', label: 'Partages', icon: 'fa-share-nodes' },
    { type: 'subscribe', label: 'Abonnements (Super Fan)', icon: 'fa-star' },
    { type: 'member', label: 'Arrivées dans le live', icon: 'fa-door-open', note: '1 annonce toutes les 15 s maximum' }
];
const TTS_EVENT_TEXTS = {
    fr: { gift: '{pseudo} a envoyé {nombre} {cadeau}, merci !', follow: 'Merci {pseudo} pour le follow !', share: 'Merci {pseudo} pour le partage !', subscribe: "Merci {pseudo} pour l'abonnement !", member: 'Bienvenue {pseudo} !' },
    en: { gift: '{pseudo} sent {nombre} {cadeau}, thank you!', follow: 'Thanks {pseudo} for the follow!', share: 'Thanks {pseudo} for sharing!', subscribe: 'Thanks {pseudo} for subscribing!', member: 'Welcome {pseudo}!' },
    es: { gift: '{pseudo} envió {nombre} {cadeau}, ¡gracias!', follow: '¡Gracias {pseudo} por seguirme!', share: '¡Gracias {pseudo} por compartir!', subscribe: '¡Gracias {pseudo} por la suscripción!', member: '¡Bienvenido {pseudo}!' },
    de: { gift: '{pseudo} hat {nombre} {cadeau} geschickt, danke!', follow: 'Danke {pseudo} fürs Folgen!', share: 'Danke {pseudo} fürs Teilen!', subscribe: 'Danke {pseudo} fürs Abonnieren!', member: 'Willkommen {pseudo}!' },
    it: { gift: '{pseudo} ha inviato {nombre} {cadeau}, grazie!', follow: 'Grazie {pseudo} per il follow!', share: 'Grazie {pseudo} per la condivisione!', subscribe: "Grazie {pseudo} per l'abbonamento!", member: 'Benvenuto {pseudo}!' },
    pt: { gift: '{pseudo} enviou {nombre} {cadeau}, obrigado!', follow: 'Valeu {pseudo} pelo follow!', share: 'Valeu {pseudo} por compartilhar!', subscribe: 'Valeu {pseudo} pela inscrição!', member: 'Bem-vindo {pseudo}!' }
};
const TTS_MEMBER_INTERVAL_MS = 15000;
const ttsGiftCombos = new Map(); // user|gift -> { count, coins, data, timer }
let ttsLastMemberAt = 0;

function ttsEventDefaultText(type) {
    const lang = (ttsConfig.language || 'fr-FR').slice(0, 2);
    return (TTS_EVENT_TEXTS[lang] || TTS_EVENT_TEXTS.fr)[type] || '';
}

function ttsEventSettings(type) {
    const e = (ttsConfig.events && ttsConfig.events[type]) || {};
    const min = Number(e.minCoins);
    return { enabled: !!e.enabled, minCoins: Number.isFinite(min) && min >= 0 ? min : 1, text: typeof e.text === 'string' ? e.text : '' };
}

function renderTTSEvents() {
    const list = document.getElementById('tts-events-list');
    if (!list) return;
    list.innerHTML = TTS_EVENT_TYPES.map(def => {
        const e = ttsEventSettings(def.type);
        return `
            <div class="tts-event-row" data-type="${def.type}">
                <label class="tts-event-toggle">
                    <input type="checkbox" data-field="enabled" ${e.enabled ? 'checked' : ''}>
                    <i class="fas ${def.icon}"></i> <span>${escapeHtml(def.label)}</span>
                </label>
                <input type="text" class="form-control form-control-sm" data-field="text" maxlength="200" value="${escapeHtml(e.text)}" placeholder="${escapeHtml(ttsEventDefaultText(def.type))}">
                <div class="tts-event-extra">
                    ${def.minCoins ? `<label class="small text-dim mb-0">Dès <input type="number" class="form-control form-control-sm d-inline-block" data-field="minCoins" min="0" step="1" value="${e.minCoins}" style="width:80px"> pièces</label>` : `<span class="small text-dim">${def.note ? escapeHtml(def.note) : ''}</span>`}
                </div>
            </div>`;
    }).join('');
    list.querySelectorAll('input').forEach(el => el.addEventListener('change', saveTTSConfig));
}

function readTTSEventsForm() {
    const events = {};
    document.querySelectorAll('#tts-events-list .tts-event-row').forEach(row => {
        const get = (f) => row.querySelector(`[data-field="${f}"]`);
        const minEl = get('minCoins');
        events[row.dataset.type] = {
            enabled: !!get('enabled')?.checked,
            text: (get('text')?.value || '').trim().slice(0, 200),
            ...(minEl ? { minCoins: Math.max(0, parseInt(minEl.value, 10) || 0) } : {})
        };
    });
    return events;
}

function fillTTSEventText(template, v) {
    const map = { pseudo: v.name, user: v.name, cadeau: v.gift, gift: v.gift, nombre: v.count, count: v.count, pieces: v.coins, coins: v.coins };
    return template.replace(/\{(\w+)\}/g, (m, k) => (map[k] !== undefined && map[k] !== null ? String(map[k]) : m));
}

function queueTTSAnnouncement(type, values) {
    const e = ttsEventSettings(type);
    const text = fillTTSEventText(e.text || ttsEventDefaultText(type), values).trim();
    if (!text) return;
    // announcements may go a little over the chat queue limit, never far over it
    if (ttsQueue.length >= (ttsConfig.maxQueue || 5) + 3) {
        ttsLog(`📦 Queue pleine, annonce ignorée`, 'warning');
        return;
    }
    // gifts are read before waiting chat messages
    if (type === 'gift') ttsQueue.unshift({ text, user: values.name });
    else ttsQueue.push({ text, user: values.name });
    processTTSQueue();
}

// Called for every "stats" socket event (gift, follow, share, subscribe, member...)
function handleEventForTTS(type, data) {
    if (!ttsConfig.enabled || !data || !TTS_EVENT_TYPES.some(d => d.type === type)) return;
    const e = ttsEventSettings(type);
    if (!e.enabled) return;
    const name = data.nickname || data.uniqueId || '';

    if (type === 'gift') {
        // a combo arrives in several parts: one announcement once it is over
        const key = `${data.userId || data.uniqueId}|${data.giftName}`;
        const combo = ttsGiftCombos.get(key) || { count: 0, coins: 0 };
        combo.count += parseInt(data.repeatCount, 10) || 1;
        combo.coins += parseInt(data.coins, 10) || 0;
        combo.data = data;
        clearTimeout(combo.timer);
        combo.timer = setTimeout(() => {
            ttsGiftCombos.delete(key);
            if (combo.coins < e.minCoins) return;
            queueTTSAnnouncement('gift', { name, gift: data.giftName || '', count: combo.count, coins: combo.coins });
        }, 3000);
        ttsGiftCombos.set(key, combo);
        return;
    }
    if (type === 'member') {
        const now = Date.now();
        if (now - ttsLastMemberAt < TTS_MEMBER_INTERVAL_MS) return;
        ttsLastMemberAt = now;
    }
    queueTTSAnnouncement(type, { name });
}

// Handle incoming chat for TTS
function handleChatForTTS(data) {
    if (!ttsConfig.enabled || ttsConfig.readChat === false) return;

    const { uniqueId, comment, userId, isModerator, isSubscriber, isFollower } = data;

    // Check if user is allowed
    if (!isUserAllowedForTTS(data)) {
        ttsLog(`❌ ${uniqueId}: Non autorisé`, 'dim');
        return;
    }

    // Check comment type filter
    if (!matchesCommentType(comment)) {
        return;
    }

    // Check cooldown
    const now = Date.now();
    const lastTime = ttsUserCooldowns.get(userId) || 0;
    if (now - lastTime < ttsConfig.cooldown * 1000) {
        ttsLog(`⏱️ ${uniqueId}: Cooldown actif`, 'dim');
        return;
    }

    // Filter text
    let text = filterText(comment);

    // Remove trigger if command mode
    if (ttsConfig.commentType === 'command') {
        text = text.substring(ttsConfig.commandTrigger.length).trim();
    } else if (ttsConfig.commentType === 'dot') {
        text = text.substring(1).trim();
    } else if (ttsConfig.commentType === 'slash') {
        text = text.substring(1).trim();
    }

    // Check length
    if (text.length > ttsConfig.maxLength) {
        text = text.substring(0, ttsConfig.maxLength);
    }

    if (!text || text.length === 0) {
        return;
    }

    // Add to queue
    if (ttsQueue.length >= ttsConfig.maxQueue) {
        ttsLog(`📦 Queue pleine (${ttsQueue.length}/${ttsConfig.maxQueue})`, 'warning');
        return;
    }

    ttsQueue.push({ text, user: uniqueId, userId });
    ttsUserCooldowns.set(userId, now);
    ttsLog(`✅ ${uniqueId}: "${text}" ajouté à la queue`, 'success');

    // Process queue
    processTTSQueue();
}

// Check if user is allowed
function isUserAllowedForTTS(data) {
    // [PRIORITY] Si le serveur a déjà validé l'éligibilité, on fait confiance
    if (data.eligibleForTTS === true) return true;

    // [FALLBACK] Toujours autoriser le Streamer (Broadcaster)
    const streamer = localStorage.getItem('gentok_username');
    if (streamer && data.uniqueId && data.uniqueId.toLowerCase() === streamer.toLowerCase()) {
        return true;
    }

    if (ttsConfig.allowedUsers.all) return true;

    // Moderators check (Robust)
    if (ttsConfig.allowedUsers.moderators) {
        if (data.isModerator === true) return true;
        if (data.isMod === true) return true;
        if (data.userRole === 1) return true; // Sometimes mapped
    }

    // Subscribers check
    if (ttsConfig.allowedUsers.subscribers) {
        if (data.isSubscriber === true) return true;
        if (data.isSub === true) return true; // Common alias
    }

    // Followers check (Fix for followRole)
    if (ttsConfig.allowedUsers.followers) {
        if (data.isFollower === true) return true;
        // followRole: 1 = Follower, 2 = Friend (Follower + Followed Back)
        if (data.followRole != null && data.followRole >= 1) return true;
    }

    // Team check
    if (ttsConfig.allowedUsers.team) {
        // Ensure property exists
        const level = data.teamMemberLevel || 0;
        if (level >= ttsConfig.teamMinLevel) return true;
    }

    return false;
}

// Check if comment matches type filter
function matchesCommentType(comment) {
    const trimmed = comment.trim();

    if (ttsConfig.commentType === 'any') return true;
    if (ttsConfig.commentType === 'dot') return trimmed.startsWith('.');
    if (ttsConfig.commentType === 'slash') return trimmed.startsWith('/');
    if (ttsConfig.commentType === 'command') {
        return trimmed.toLowerCase().startsWith(ttsConfig.commandTrigger.toLowerCase());
    }

    return false;
}

// Filter text
function filterText(text) {
    let filtered = text;

    // Filter spam (repeated characters)
    if (ttsConfig.filterSpam) {
        filtered = filtered.replace(/(.)\1{3,}/g, '$1$1$1');
    }

    // Filter @mentions
    if (ttsConfig.filterMentions) {
        filtered = filtered.replace(/@\w+/g, '');
    }

    // Filter !commands
    if (ttsConfig.filterCommands) {
        filtered = filtered.replace(/!\w+/g, '');
    }
    return filtered.trim();
}

// Process TTS queue
let isTTSPlaying = false; // Flag for custom audio playback

function processTTSQueue() {
    if (ttsQueue.length === 0) return;
    if ((ttsSynth && ttsSynth.speaking) || isTTSPlaying) return; // Already speaking (System or Custom)

    const item = ttsQueue.shift();
    speakText(item.text, item.user);
}

// Speak text
async function speakText(text, user) {
    if (ttsSynth && ttsSynth.speaking) {
        ttsSynth.cancel();
    }

    const voiceId = resolveTTSVoice();

    if (isNeuralVoice(voiceId)) {
        // [NATURAL VOICE] MP3 generated by the server
        isTTSPlaying = true;
        ttsLog(`🔊 Lecture : "${text}" (${user})`, 'info');

        try {
            const response = await fetch(`${getApiBase()}/api/tts/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice: voiceId, rate: ttsConfig.speed, pitch: ttsConfig.pitch, token: localStorage.getItem('gentok_token') || '' })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audio.volume = Math.min(Math.max(Number(ttsConfig.volume) || 1, 0), 1);

            const done = (ok) => {
                isTTSPlaying = false;
                URL.revokeObjectURL(audioUrl);
                ttsLog(ok ? `✅ Terminé : "${text}"` : '❌ Lecture audio impossible', ok ? 'success' : 'error');
                setTimeout(processTTSQueue, 400); // small pause between messages
            };
            audio.onended = () => done(true);
            audio.onerror = () => done(false);

            await audio.play();
        } catch (err) {
            console.error('[TTS] Natural voice failed:', err);
            isTTSPlaying = false;
            if (ttsSynth) {
                // the message is still read, with the voice of this computer
                ttsLog(`⚠️ Voix naturelle indisponible (${err.message}), voix de l'ordinateur utilisée.`, 'warning');
                speakWithSystemVoice(text, user, null);
            } else {
                ttsLog(`❌ Erreur TTS : ${err.message}`, 'error');
                processTTSQueue();
            }
        }
    } else {
        speakWithSystemVoice(text, user, voiceId);
    }
}

// [SYSTEM TTS] Voices installed on this computer / browser (voiceName null = any voice of the language)
function speakWithSystemVoice(text, user, voiceName) {
    const utterance = new SpeechSynthesisUtterance(text);
    const langVoices = ttsVoices.filter(v => v.lang.startsWith(ttsConfig.language.substring(0, 2)));
    const selectedVoice = (voiceName && ttsVoices.find(v => v.name === voiceName)) || (ttsConfig.randomVoice && langVoices.length ? langVoices[Math.floor(Math.random() * langVoices.length)] : null);
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.lang = ttsConfig.language;
    utterance.rate = ttsConfig.speed;
    utterance.pitch = ttsConfig.pitch;
    utterance.volume = ttsConfig.volume;

    utterance.onstart = () => {
        ttsLog(`🔊 Lecture : "${text}" (${user})`, 'info');
    };
    utterance.onend = () => {
        ttsLog(`✅ Terminé : "${text}"`, 'success');
        ttsCurrentUtterance = null;
        setTimeout(() => processTTSQueue(), 100);
    };
    utterance.onerror = (e) => {
        ttsLog(`❌ Erreur TTS : ${e.error}`, 'error');
        ttsCurrentUtterance = null;
        setTimeout(() => processTTSQueue(), 100);
    };

    ttsCurrentUtterance = utterance;
    ttsSynth.speak(utterance);
}

// TTS Log
function ttsLog(message, type = 'info') {
    const console = document.getElementById('tts-logs-console');
    if (!console) return;

    const timestamp = new Date().toLocaleTimeString('fr-FR');
    const div = document.createElement('div');
    div.textContent = `[${timestamp}] ${message}`;

    if (type === 'dim') div.style.opacity = '0.5';
    if (type === 'success') div.style.color = '#10b981';
    if (type === 'warning') div.style.color = '#f59e0b';
    if (type === 'error') div.style.color = '#ef4444';

    console.appendChild(div);
    console.scrollTop = console.scrollHeight;

    // Keep only last 50 messages
    while (console.children.length > 50) {
        console.removeChild(console.firstChild);
    }
}

function testOverlay(type, btn, url) {
    // [NEW] Enhanced Simulation Data
    let mockData = {
        uniqueId: 'Gentok',
        nickname: 'Gentok',
        profilePictureUrl: 'https://gentok.fr/img/logo.png'
    };

    if (type === 'gift') {
        mockData.giftName = 'Rose';
        mockData.repeatCount = Math.floor(Math.random() * 99) + 1;
        // Rose icon URL (TikTok CDN) - Updated to version requested by user
        mockData.url = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp';
        mockData.giftIcon = { url_list: [mockData.url] };
    } else if (type === 'chat') {
        mockData.comment = 'Gentok est incroyable ! 🔥🚀';
    } else if (type === 'like') {
        mockData.likeCount = 100;
    }

    // [NEW] Show live preview
    if (btn && url) {
        showOverlayPreview(btn, url, type, mockData);
    }

    // Still emit via socket for real overlays connected elsewhere
    if (window.socket) {
        window.socket.emit('simulate_event', { type, data: mockData });
        showToast(`Simulation ${type} lancée !`, 'success');
    }
}

/**
 * Creates a temporary preview of the overlay right below the trigger button
 */
function showOverlayPreview(btn, url, type, mockData) {
    // Cleanup previous preview
    const existing = document.querySelector('.overlay-live-preview');
    if (existing) existing.remove();

    const preview = document.createElement('div');
    preview.className = 'overlay-live-preview';

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.style.pointerEvents = 'none';

    // [NEW] Inter-window communication for instant simulation
    iframe.onload = () => {
        // Send simulation data directly to iframe to bypass socket delay
        setTimeout(() => {
            iframe.contentWindow.postMessage({ type: 'simulation', data: mockData }, '*');
        }, 500); // 500ms safety for overlay setup
    };

    preview.appendChild(iframe);
    document.body.appendChild(preview);

    // Lifecycle: 5 seconds visible
    setTimeout(() => {
        preview.classList.add('outro');
        setTimeout(() => preview.remove(), 500);
    }, 5000);
}

function previewOverlay(urlPath, customData = null) {
    // Construire l'URL correcte (Local ou VPS)
    const base = getApiBase();
    const url = urlPath.startsWith('http') ? urlPath : `${base}${urlPath}`;

    const token = localStorage.getItem('gentok_token');
    const fullUrl = token ? `${url}?token=${token}` : url;

    const existing = document.querySelector('.overlay-live-preview');
    if (existing) existing.remove();

    const preview = document.createElement('div');
    preview.className = 'overlay-live-preview';
    preview.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 380px;
        height: 160px;
        background: #090909;
        border: 2px solid var(--primary);
        border-radius: 20px;
        z-index: 9999;
        box-shadow: 0 10px 40px rgba(0,0,0,0.8);
        overflow: hidden;
        animation: slideUp 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        display: flex;
        flex-direction: column;
    `;

    // Label
    const label = document.createElement('div');
    label.innerText = 'APERÇU DIRECT (5S)';
    label.style.cssText = `
        position: absolute;
        top: 12px;
        right: 18px;
        color: var(--primary);
        font-family: 'Segoe UI', sans-serif;
        font-weight: 800;
        font-size: 0.70rem;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        z-index: 10;
        text-shadow: 0 0 10px rgba(254, 44, 85, 0.3);
        pointer-events: none;
    `;
    preview.appendChild(label);

    const iframe = document.createElement('iframe');
    iframe.src = fullUrl;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';

    // Injection de données simulées pour l'aperçu
    iframe.onload = () => {
        let mockData = customData;

        // Si aucune donnée custom n'est fournie, utiliser les défauts
        if (!mockData) {
            if (url.includes('top-gift')) {
                mockData = {
                    nickname: 'GENTOK',
                    coins: 5000,
                    giftName: 'Rose',
                    giftIcon: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp'
                };
            } else if (url.includes('top-streak')) {
                mockData = {
                    nickname: 'GENTOK',
                    count: 100,
                    giftName: 'Rose',
                    giftIcon: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp'
                };
            } else if (url.includes('last-follower')) {
                mockData = {
                    nickname: 'GENTOK_FAN',
                    uniqueId: 'gentok_fan',
                    profilePictureUrl: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp'
                };
            } else if (url.includes('last-gifter')) {
                mockData = {
                    nickname: 'GENTOK_GIFTER',
                    giftName: 'Rose',
                    giftId: 5655,
                    repeatCount: 5,
                    diamondCount: 1,
                    giftIcon: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp'
                };
            } else if (url.includes('last-subscriber')) {
                mockData = {
                    nickname: 'GENTOK_SUB',
                    subMonth: 1
                };
            } else if (url.includes('last-share')) {
                mockData = {
                    nickname: 'GENTOK_SHARER'
                };
            } else if (url.includes('last-like')) {
                mockData = {
                    nickname: 'GENTOK_LIKER',
                    likeCount: 50
                };
            } else if (url.includes('last-chatter')) {
                mockData = {
                    nickname: 'GENTOK_CHAT',
                    comment: 'Ceci est un message de test !'
                };
            }
        }

        // Si on a des données (custom ou par défaut), on les envoie
        if (mockData) {
            setTimeout(() => {
                iframe.contentWindow.postMessage({ type: 'simulation', data: mockData }, '*');
            }, 500);
        }
    };

    preview.appendChild(iframe);
    document.body.appendChild(preview);

    // Remove after 2s
    setTimeout(() => {
        preview.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => preview.remove(), 300);
    }, 2000);
}

function copyOverlayUrl(url) {
    const token = localStorage.getItem('gentok_token');
    if (!token) { navigator.clipboard.writeText(url); showToast('URL Copiée !', 'success'); return; }
    // Strip existing token if present
    let cleanUrl = url.replace(/[?&]token=[^&]*/g, '').replace(/\?$/, '');
    const separator = cleanUrl.includes('?') ? '&' : '?';
    const fullUrl = `${cleanUrl}${separator}token=${token}`;
    navigator.clipboard.writeText(fullUrl);
    showToast('URL Copiée !', 'success');
}

function simulateEvent(type, data) {
    if (window.socket) {
        window.socket.emit('simulate_event', { type, data });
        showToast('Simulation envoyée !', 'success');

        // [NEW] Open preview for these types to show immediate result
        if (type === 'top-gift') {
            previewOverlay('/overlay/top-gift', data);
        } else if (type === 'top-streak') {
            previewOverlay('/overlay/top-streak', data);
        } else if (type === 'new-follower') {
            previewOverlay('/overlay/last-follower', data);
        } else if (type === 'gift') {
            // Only if it's not a top-gift simulation? 
            // Actually 'gift' event updates last-gifter overlay too
            previewOverlay('/overlay/last-gifter', data);
        } else if (type === 'subscribe') {
            previewOverlay('/overlay/last-subscriber', data);
        } else if (type === 'share') {
            previewOverlay('/overlay/last-share', data);
        } else if (type === 'like') {
            previewOverlay('/overlay/last-like', data);
        } else if (type === 'chat') {
            previewOverlay('/overlay/last-chatter', data);
        }
    }
}

async function resetTopStat(type) {
    const isAll = type === 'all';
    const confirmed = await showConfirm(
        isAll ? 'Réinitialiser toutes les stats ?' : 'Réinitialiser la stat ?',
        isAll ? 'Voulez-vous vraiment remettre à zéro TOUTES les statistiques de la session ?' : `Voulez-vous vraiment remettre à zéro le ${type === 'topGift' ? 'Top Cadeau' : 'Top Streak'} ?`,
        isAll ? 'Oui, tout reset' : 'Oui, reset'
    );
    if (!confirmed) return;

    try {
        const token = localStorage.getItem('gentok_token');
        const response = await fetch(`${getApiBase()}/api/stats/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, token })
        });

        if (response.ok) {
            showToast('Statistique réinitialisée !');
            // stats will be broadcasted via socket automatically
        } else {
            const err = await response.json();
            showToast(err.error || 'Erreur lors du reset', 'error');
        }
    } catch (err) {
        showToast('Erreur connexion au serveur', 'error');
    }
}

window.updateTopTitle = async (type, title) => {
    const token = getToken();
    const font = document.getElementById(`${type}Font`)?.value || '';

    try {
        await fetch(`${getApiBase()}/api/stats/update-title`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, title, font, token })
        });
        showToast('✅ Configuration mise à jour !');

        // Reactive UI update
        if (type === 'topCoins' || type === 'topLikes') {
            const shortType = type === 'topCoins' ? 'coins' : 'likes';
            updateLeaderboardConfig(shortType);
        } else if (type === 'topGift' || type === 'topStreak') {
            // Refresh iframe
            const iframe = document.querySelector(`#overlay-item-top iframe[src*="${type === 'topGift' ? 'top-gift' : 'top-streak'}"]`);
            if (iframe) {
                const url = new URL(iframe.src, window.location.origin);
                url.searchParams.set('font', font);
                url.searchParams.set('t', Date.now()); // Cache buster
                iframe.src = url.toString();
            }
        }
    } catch (e) {
        console.error(e);
        showToast('Erreur mise à jour.', 'error');
    }
};


window.updateLeaderboardConfig = async (type) => {
    const token = getToken();
    const prefix = type === 'coins' ? 'topCoins' : 'topLikes';

    const limit = document.getElementById(`${prefix}LimitInput`)?.value || 10;
    const style = type === 'coins' ? currentTopCoinsStyle : currentTopLikesStyle;
    const transparent = document.getElementById(`${prefix}Transparent`)?.checked !== false;
    const showTitle = document.getElementById(`${prefix}ShowTitle`)?.checked !== false;
    const rtl = document.getElementById(`${prefix}Rtl`)?.checked === true;

    // Update Backend
    try {
        await fetch(`${getApiBase()}/api/stats/update-title`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: prefix,
                limit,
                style,
                transparent,
                showTitle,
                rtl,
                font: document.getElementById(`${prefix}Font`)?.value || '',
                token
            })
        });
        showToast('✅ Configuration mise à jour !');
    } catch (e) {
        console.error(e);
        showToast('Erreur sauvegarde.', 'error');
    }

    // Update UI (URL and Iframe)
    const urlInput = document.getElementById(`${prefix}Url`);
    const iframe = document.getElementById(`${prefix}Frame`);
    const font = document.getElementById(`${prefix}Font`)?.value || '';
    const overlayUrl = `/overlay/leaderboard?type=${type}&limit=${limit}&style=${style}&transparent=${transparent}&showTitle=${showTitle}&rtl=${rtl}${font ? `&font=${font}` : ''}`;

    if (urlInput) urlInput.value = `${PRODUCTION_URL}${overlayUrl}`;
    if (iframe) {
        iframe.src = overlayUrl + '&preview=true&t=' + Date.now();
        // Dynamic height adjustment
        const height = (parseInt(limit) || 10) * 42 + 60;
        iframe.style.height = height + 'px';
        if (iframe.parentElement) iframe.parentElement.style.height = height + 'px';
    }

    // Standardize with token
    updateOverlayLinks();

    // Update Style Text
    const styleText = document.getElementById(`${prefix}-style-text`);
    if (styleText) styleText.textContent = `STYLE ${style}`;
};

window.cycleLeaderboardStyle = (type, dir) => {
    if (type === 'coins') {
        currentTopCoinsStyle += dir;
        if (currentTopCoinsStyle > LEADERBOARD_STYLES_COUNT) currentTopCoinsStyle = 1;
        if (currentTopCoinsStyle < 1) currentTopCoinsStyle = LEADERBOARD_STYLES_COUNT;
        updateLeaderboardConfig('coins');
    } else {
        currentTopLikesStyle += dir;
        if (currentTopLikesStyle > LEADERBOARD_STYLES_COUNT) currentTopLikesStyle = 1;
        if (currentTopLikesStyle < 1) currentTopLikesStyle = LEADERBOARD_STYLES_COUNT;
        updateLeaderboardConfig('likes');
    }
};

window.testLeaderboard = async (type) => {
    const token = getToken();
    try {
        await fetch(`${getApiBase()}/api/stats/test-leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, token })
        });
        showToast('🧪 Test envoyé !');
    } catch (e) {
        console.error(e);
        showToast('Erreur lors de l\'envoi du test.', 'error');
    }
};

// Toggle auto-reset Top Stats option
async function toggleAutoResetTopStats(enabled) {
    try {
        const token = localStorage.getItem('gentok_token');
        const response = await fetch(`${getApiBase()}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                autoResetTopStats: enabled
            })
        });

        if (response.ok) {
            showToast(enabled ? 'Auto-reset activé' : 'Auto-reset désactivé');
            // [FIX] Refresh data to ensure all scene-specific variables are synced
            await fetchData();
        } else {
            showToast('Erreur lors de la sauvegarde', 'error');
        }
    } catch (err) {
        showToast('Erreur connexion au serveur', 'error');
    }
}
// Toggle auto-reset Last X option
async function toggleAutoResetLastX(enabled) {
    try {
        const token = localStorage.getItem('gentok_token');
        const response = await fetch(`${getApiBase()}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                autoResetLastX: enabled
            })
        });

        if (response.ok) {
            showToast(enabled ? 'Auto-reset historique activé' : 'Auto-reset historique désactivé');
            // [FIX] Refresh data to ensure all scene-specific variables are synced
            await fetchData();
        } else {
            showToast('Erreur lors de la sauvegarde', 'error');
        }
    } catch (err) {
        showToast('Erreur connexion au serveur', 'error');
    }
}

// ==========================================
// LIKES GOAL PRO FEATURES
// ==========================================

let currentLikesStyle = 1;
const LIKES_STYLES_COUNT = 13;

function updateLikesPreview() {
    const amountVal = document.getElementById('likes-goal-amount')?.value || '10000';
    const amount = parseInt(amountVal) || 10000;
    const title = document.getElementById('likes-goal-title')?.value;
    const displayTitle = (title || title === '') ? title : 'OBJECTIF LIKES';
    const font = document.getElementById('likes-goal-font')?.value || '';

    const actionSelect = document.getElementById('likes-goal-action');
    let actionName = '';
    if (actionSelect && actionSelect.value !== 'none') {
        actionName = actionSelect.options[actionSelect.selectedIndex]?.text || '';
    }

    const previewBar = document.getElementById('likes-bar-preview');
    const previewFill = document.getElementById('likes-bar-fill-preview');
    const previewContent = document.getElementById('likes-preview-content');
    const previewTitle = document.getElementById('likes-preview-title');
    const previewCount = document.getElementById('likes-preview-count');
    const previewAction = document.getElementById('likes-preview-action');
    const previewFooter = document.getElementById('likes-preview-footer');
    const styleText = document.getElementById('likes-style-text');

    if (!previewBar || !previewContent) return;

    previewBar.className = `style-${currentLikesStyle}`;
    if (styleText) styleText.textContent = `STYLE ${currentLikesStyle}`;

    const currentSim = Math.floor(amount * 0.65);
    const countStr = `${currentSim.toLocaleString()} / ${amount.toLocaleString()}`;

    // Layout Logic (Match overlay_goals.html)
    let titleText = (displayTitle || '').trim();
    if (titleText === '-' || titleText === '') {
        previewTitle.textContent = '';
        previewTitle.style.display = 'none';
    } else {
        previewTitle.style.display = 'inline';
        if (currentLikesStyle === 7 || currentLikesStyle === 10) {
            previewTitle.textContent = titleText + ' - ';
        } else {
            previewTitle.textContent = titleText;
        }
    }
    previewCount.textContent = countStr;

    if (font) {
        injectFontInPreview('likes-preview-wrapper', font);
    } else {
        document.getElementById('likes-preview-wrapper').style.fontFamily = '';
    }

    if (previewAction) {
        previewAction.textContent = actionName ? `ACTION: ${actionName}` : '';
    }

    if (previewFooter) {
        const showFooter = document.getElementById('likes-goal-show-footer')?.checked !== false;
        previewFooter.style.display = showFooter ? 'block' : 'none';

        const remaining = Math.max(amount - currentSim, 0);
        previewFooter.textContent = remaining > 0 ? `Plus que ${remaining.toLocaleString()} likes !` : 'Objectif Atteint !';
        if (font) injectFontInPreview('likes-preview-footer', font);
        else previewFooter.style.fontFamily = '';
    }

    if (previewFill) previewFill.style.width = '65%';
}

window.cycleLikesStyle = (dir) => {
    currentLikesStyle += dir;
    if (currentLikesStyle > LIKES_STYLES_COUNT) currentLikesStyle = 1;
    if (currentLikesStyle < 1) currentLikesStyle = LIKES_STYLES_COUNT;
    updateLikesPreview();
};

function updateLikesGoalActionSelect() {
    const select = document.getElementById('likes-goal-action');
    const optionsCont = document.getElementById('likes-goal-action-options');
    if (!select || !optionsCont) return;

    const savedVal = select.getAttribute('data-saved-val') || select.value || 'none';

    select.innerHTML = '<option value="none">Aucune action</option>';
    optionsCont.innerHTML = '<div class="custom-option selected" data-value="none">Aucune action</div>';

    // Filter ONLY real actions (exclude sounds / alerts)
    const realActionsOnly = (currentActions || []).filter(action => {
        if (!action) return false;
        if (action.type === 'sound' || action.type === 'audio' || action.type === 'sound_alert') return false;
        if (action.id && String(action.id).startsWith('sound_')) return false;
        const name = String(action.name || '');
        if (name.startsWith('Son:') || name.startsWith('Sound:')) return false;
        return true;
    });

    realActionsOnly.forEach(action => {
        const opt = document.createElement('option');
        opt.value = action.id;
        opt.textContent = action.name || action.id;
        select.appendChild(opt);

        const div = document.createElement('div');
        div.className = 'custom-option';
        div.setAttribute('data-value', action.id);
        div.textContent = action.name || action.id;
        optionsCont.appendChild(div);
    });

    select.value = savedVal;
    syncCustomSelect('likes-goal-action');
}

async function handleSaveLikesGoal() {
    const goalValue = parseInt(document.getElementById('likes-goal-amount').value) || 1000;
    const currentCount = window.realtimeLikesCount || 0;
    const behavior = document.getElementById('likes-goal-behavior').value;

    // Target next milestone above current likes if live is active (e.g. 97139 -> 98000 for step 1000)
    const targetGoal = (currentCount > 0 && behavior === 'increase')
        ? Math.max(goalValue, Math.ceil((currentCount + 1) / goalValue) * goalValue)
        : goalValue;

    const settings = {
        likesGoal: {
            enabled: document.getElementById('likes-goal-enabled').checked,
            goal: targetGoal,
            goalStep: goalValue,
            initialGoal: goalValue,
            title: document.getElementById('likes-goal-title').value,
            whenReached: behavior,
            actionId: document.getElementById('likes-goal-action').value,
            style: currentLikesStyle,
            font: document.getElementById('likes-goal-font')?.value || '',
            showFooter: document.getElementById('likes-goal-show-footer').checked
        }
    };

    try {
        const token = localStorage.getItem('gentok_token');
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                likesGoal: settings.likesGoal
            })
        });

        if (response.ok) {
            showToast('Objectif enregistré avec succès !', 'success');
        } else {
            showToast('Erreur lors de la sauvegarde', 'error');
        }
    } catch (err) {
        showToast('Erreur connexion au serveur', 'error');
    }
}

async function handleResetLikesCounter() {
    if (!confirm('Voulez-vous vraiment réinitialiser le compteur de likes à 0 ?')) return;

    try {
        const token = localStorage.getItem('gentok_token');
        window.realtimeLikesCount = 0;
        const initialGoalVal = parseInt(document.getElementById('likes-goal-amount')?.value) || 1000;

        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                likesGoal: { count: 0, goal: initialGoalVal }
            })
        });

        if (response.ok) {
            showToast('Compteur réinitialisé à 0 !', 'success');
        } else {
            showToast('Erreur lors de la réinitialisation', 'error');
        }
    } catch (err) {
        showToast('Erreur connexion au serveur', 'error');
    }
}

async function handleTestLikesGoal() {
    const goal = parseInt(document.getElementById('likes-goal-amount').value) || 10000;
    const title = document.getElementById('likes-goal-title').value;

    showToast(`Test: Objectif "${title}" atteint !`, 'info');

    if (socket && socket.connected) {
        socket.emit('test_event', {
            type: 'likes_goal_reached',
            goal: goal,
            title: title
        });
    }
}

function copyLikesUrl() {
    const token = localStorage.getItem('gentok_token');
    const baseUrl = `${PRODUCTION_URL}/overlay/goals`;
    const fullUrl = token ? `${baseUrl}?token=${token}` : baseUrl;

    navigator.clipboard.writeText(fullUrl).then(() => {
        showToast('URL Copiée avec token !', 'success');
    });
}

// =======================
// ADMINISTRATION PANEL
// =======================

window.switchAdminTab = (tabId, btn) => {
    document.querySelectorAll('#admin-section .settings-tab').forEach(t => t.style.display = 'none');
    const target = document.getElementById(`admin-tab-${tabId}`);
    if (target) target.style.display = 'block';

    document.querySelectorAll('#admin-section .settings-nav .nav-item').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    if (tabId === 'system') loadAdminSystem();
    if (tabId === 'presets-admin') loadAdminPresets();
    if (tabId === 'database') loadAdminDB();
};

let _adminUsersCache = [];
let _adminCurrentPage = 1;
const _adminItemsPerPage = 8;

async function loadAdminUsers() {
    const base = getApiBase();
    const token = localStorage.getItem('gentok_token');
    console.log('[DEBUG] loadAdminUsers token:', token ? 'exists' : 'MISSING');

    try {
        console.log('[ADMIN] Fetching users from:', `${base}/api/admin/users`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch(`${base}/api/admin/users?token=${token}`, { signal: controller.signal });
        clearTimeout(timeoutId);

        console.log('[ADMIN] Fetch response status:', res.status);

        if (!res.ok) {
            console.error('[ADMIN] Access denied:', res.status);
            const errorText = await res.text();
            console.error('[ADMIN] Error body:', errorText);
            showNotify("Administration", `Accès refusé (${res.status}) !`, 'error');
            return;
        }

        const data = await res.json();
        console.log('[ADMIN] Received users data:', data);

        if (!data || !data.users) {
            console.warn('[ADMIN] No users array in response');
        }

        _adminUsersCache = data.users || [];
        _adminCurrentPage = 1; // Reset on load
        console.log('[ADMIN] Cache updated, user count:', _adminUsersCache.length);

        const elTotal = document.getElementById('admin-total-users');
        if (elTotal) elTotal.textContent = data.total || 0;

        const elPremium = document.getElementById('admin-premium-users');
        if (elPremium) elPremium.textContent = data.premium || 0;

        const elOnline = document.getElementById('admin-online-users');
        if (elOnline) elOnline.textContent = data.online || 0;

        _adminUsersFilteredList = _adminUsersCache;
        renderAdminUsersTable(_adminUsersFilteredList);
    } catch (err) {
        console.error('[ADMIN] Critical load error:', err);
        showNotify("Erreur", "Impossible de charger les utilisateurs.", "error");
    }
}

function renderAdminUsersTable(users) {
    const table = document.getElementById('admin-users-table');
    const tbody = document.querySelector('#admin-users-table tbody');

    console.log('[ADMIN] Rendering table...', { tableFound: !!table, tbodyFound: !!tbody, userCount: users.length });

    if (!tbody) {
        console.error('[ADMIN] TBODY NOT FOUND ! Check HTML injection.');
        return;
    }

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-dim);">Aucun utilisateur trouvé</td></tr>';
        renderAdminPagination(0);
        return;
    }

    // Pagination slice
    const start = (_adminCurrentPage - 1) * _adminItemsPerPage;
    const end = start + _adminItemsPerPage;
    const paginatedUsers = users.slice(start, end);

    const htmlOutput = paginatedUsers.map(u => {
        const date = u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : 'N/A';
        const tokenShort = u.token ? u.token.substring(0, 12) + '...' : 'N/A';
        const premiumBadge = u.isPremium
            ? '<span style="background: rgba(250,204,21,0.2); color: #facc15; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">PREMIUM</span>'
            : '<span style="color: var(--text-dim); font-size: 0.75rem;">Gratuit</span>';
        const adminBadge = u.isAdmin
            ? '<span style="background: rgba(255,0,0,0.2); color: #ff4444; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">ADMIN</span>'
            : '<span style="color: var(--text-dim); font-size: 0.75rem;">—</span>';

        return `<tr style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
            <td style="padding: 8px 10px; font-weight: 600; color: #ffffff !important;">${u.username || 'N/A'}</td>
            <td style="padding: 8px 10px; font-size: 0.8rem; color: #cccccc !important;">${u.email || 'N/A'}</td>
            <td style="padding: 8px 10px;"><code style="font-size: 0.75rem; background: rgba(255,255,255,0.1); color: #ffffff; padding: 2px 6px; border-radius: 4px;">${tokenShort}</code></td>
            <td style="padding: 8px 10px; text-align: center;">${premiumBadge}</td>
            <td style="padding: 8px 10px; text-align: center;">${adminBadge}</td>
            <td style="padding: 8px 10px; font-size: 0.8rem; color: #999;">${date}</td>
            <td style="padding: 8px 10px; text-align: right;">
                <div style="display: flex; gap: 4px; justify-content: flex-end;">
                    <button class="btn-icon mini" title="Toggle Premium" onclick="adminTogglePremium('${u.token}', ${!u.isPremium})" style="background: rgba(250,204,21,0.1); color: #facc15;"><i class="fas fa-star"></i></button>
                    <button class="btn-icon mini" title="Toggle Admin" onclick="adminToggleAdmin('${u._id}', ${!u.isAdmin})" style="background: rgba(255,165,0,0.1); color: #ffa500;"><i class="fas fa-shield-alt"></i></button>
                    <button class="btn-icon mini" title="Supprimer" onclick="adminDeleteUser('${u._id}', '${u.username}')" style="background: rgba(255,44,44,0.1); color: #ff2c2c;"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    console.log('[ADMIN] Rendered HTML length:', htmlOutput.length);
    console.log('[ADMIN] First Row Preview:', htmlOutput.substring(0, 200));

    tbody.style.display = 'table-row-group'; // Force display
    tbody.innerHTML = htmlOutput;

    renderAdminPagination(users.length);
}

function renderAdminPagination(totalItems) {
    const el = document.getElementById('admin-pagination');
    if (!el) return;

    const totalPages = Math.ceil(totalItems / _adminItemsPerPage);
    if (totalPages <= 1) {
        el.innerHTML = '';
        return;
    }

    let html = `
        <button class="btn-secondary mini" onclick="adminChangePage(${_adminCurrentPage - 1})" ${_adminCurrentPage === 1 ? 'disabled style="opacity: 0.3; cursor: default;"' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
        <span style="font-weight: 700; color: white; min-width: 80px; text-align: center;">Page ${_adminCurrentPage} / ${totalPages}</span>
        <button class="btn-secondary mini" onclick="adminChangePage(${_adminCurrentPage + 1})" ${_adminCurrentPage === totalPages ? 'disabled style="opacity: 0.3; cursor: default;"' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    el.innerHTML = html;
}

window.adminChangePage = (page) => {
    const totalPages = Math.ceil(_adminUsersFilteredList.length / _adminItemsPerPage);
    if (page < 1 || page > totalPages) return;
    _adminCurrentPage = page;
    renderAdminUsersTable(_adminUsersFilteredList);
};

let _adminUsersFilteredList = []; // Track current filter state for pagination


// Search filter
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('admin-user-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            _adminUsersFilteredList = _adminUsersCache.filter(u =>
                (u.username || '').toLowerCase().includes(query) ||
                (u.email || '').toLowerCase().includes(query) ||
                (u.token || '').toLowerCase().includes(query)
            );
            _adminCurrentPage = 1; // Reset to page 1 on search
            renderAdminUsersTable(_adminUsersFilteredList);
        });
    }
});

window.adminTogglePremium = async (userToken, isPremium) => {
    const base = getApiBase();
    const token = localStorage.getItem('gentok_token');
    try {
        const res = await fetch(`${base}/api/admin/users/toggle-premium`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, userToken, isPremium })
        });
        if (res.ok) {
            showNotify('Administration', isPremium ? 'Premium activé !' : 'Premium désactivé', 'success');
            loadAdminUsers();
        }
    } catch (err) { showNotify('Erreur', 'Erreur de connexion', 'error'); }
};

window.adminToggleAdmin = async (userId, isAdmin) => {
    const base = getApiBase();
    const token = localStorage.getItem('gentok_token');
    try {
        const res = await fetch(`${base}/api/admin/users/toggle-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, userId, isAdmin })
        });
        if (res.ok) {
            showNotify('Administration', isAdmin ? 'Admin activé !' : 'Admin désactivé', 'success');
            loadAdminUsers();
        }
    } catch (err) { showNotify('Erreur', 'Erreur de connexion', 'error'); }
};

window.adminDeleteUser = async (userId, username) => {
    const result = await Swal.fire({
        title: 'Supprimer un utilisateur',
        text: `Supprimer ${username} et TOUTES ses données ? Cette action est irréversible.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#fe2c55',
        cancelButtonText: 'Annuler',
        confirmButtonText: 'Supprimer',
        background: '#1a1a2e',
        color: '#fff'
    });
    if (!result.isConfirmed) return;

    const base = getApiBase();
    const token = localStorage.getItem('gentok_token');
    try {
        const res = await fetch(`${base}/api/admin/users/${userId}?token=${token}`, { method: 'DELETE' });
        if (res.ok) {
            showNotify('Administration', 'Utilisateur supprimé', 'success');
            loadAdminUsers();
        }
    } catch (err) { showNotify('Erreur', 'Erreur de suppression', 'error'); }
};

async function loadAdminSystem() {
    const base = getApiBase();
    const token = localStorage.getItem('gentok_token');
    try {
        const res = await fetch(`${base}/api/admin/system?token=${token}`);
        if (!res.ok) return;
        const data = await res.json();

        const elConnectors = document.getElementById('admin-active-connectors');
        if (elConnectors) elConnectors.textContent = data.activeConnectors || 0;

        const elSockets = document.getElementById('admin-active-sockets');
        if (elSockets) elSockets.textContent = data.activeSockets || 0;

        const memEl = document.getElementById('admin-memory-info');
        if (memEl && data.memory) {
            memEl.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div>RSS: <strong>${data.memory.rss}</strong></div>
                    <div>Heap Used: <strong>${data.memory.heapUsed}</strong></div>
                    <div>Heap Total: <strong>${data.memory.heapTotal}</strong></div>
                    <div>External: <strong>${data.memory.external}</strong></div>
                    <div>Uptime: <strong>${data.uptime}</strong></div>
                    <div>Node: <strong>${data.nodeVersion}</strong></div>
                </div>`;
        }

        const connList = document.getElementById('admin-connectors-list');
        if (connList) {
            if (data.connectors && data.connectors.length > 0) {
                connList.innerHTML = data.connectors.map(c => `
                    <div style="padding: 8px 12px; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="color: ${c.isConnected ? '#00ff88' : '#ff4444'};">●</span>
                            <strong>${c.username}</strong> <code style="font-size: 0.7rem; opacity: 0.5;">${c.token}</code>
                        </div>
                        ${c.stats ? `<span style="font-size: 0.75rem;">👁 ${c.stats.viewers} | ❤️ ${c.stats.likes} | 💎 ${c.stats.diamonds}</span>` : ''}
                    </div>
                `).join('');
            } else {
                connList.textContent = 'Aucun connecteur actif';
            }
        }
    } catch (err) { console.error('Admin system load error:', err); }
}

async function loadAdminPresets() {
    const base = getApiBase();
    const token = localStorage.getItem('gentok_token');
    try {
        const res = await fetch(`${base}/api/presets`);
        if (!res.ok) return;
        const presets = await res.json();

        const tbody = document.querySelector('#admin-presets-table tbody');
        if (!tbody) return;

        if (!presets || presets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim);">Aucun preset</td></tr>';
            return;
        }

        tbody.innerHTML = presets.map(p => `<tr>
            <td style="padding: 10px 12px; font-weight: 600;">${p.title || p.id}</td>
            <td style="padding: 10px 12px; font-size: 0.85rem;">${p.creator || 'N/A'}</td>
            <td style="padding: 10px 12px;"><span style="background: rgba(37,244,238,0.1); color: #25f4ee; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;">${p.type || 'N/A'}</span></td>
            <td style="padding: 10px 12px;"><span style="padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; background: ${p.badge === 'premium' ? 'rgba(254,44,85,0.2)' : 'rgba(255,255,255,0.1)'}; color: ${p.badge === 'premium' ? 'var(--primary)' : 'var(--text-dim)'};">${(p.badge || 'free').toUpperCase()}</span></td>
            <td style="padding: 10px 12px;">${p.rules || 0}</td>
            <td style="padding: 10px 12px;">
                <button class="btn-icon mini" title="Supprimer" onclick="adminDeletePreset('${p.id}')" style="background: rgba(255,44,44,0.1); color: #ff2c2c;"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
    } catch (err) { console.error('Admin presets load error:', err); }
}

window.adminDeletePreset = async (presetId) => {
    const result = await Swal.fire({
        title: 'Supprimer le preset',
        text: `Supprimer le preset "${presetId}" ?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#fe2c55',
        cancelButtonText: 'Annuler',
        confirmButtonText: 'Supprimer',
        background: '#1a1a2e',
        color: '#fff'
    });
    if (!result.isConfirmed) return;
    const base = getApiBase();
    const token = localStorage.getItem('gentok_token');
    try {
        await fetch(`${base}/api/presets/${presetId}?token=${token}`, { method: 'DELETE' });
        showNotify('Administration', 'Preset supprimé', 'success');
        loadAdminPresets();
    } catch (err) { showNotify('Erreur', 'Erreur de suppression', 'error'); }
};

window.openAdminPresetCreator = () => {
    showNotify('Info', 'Utilisez l\'éditeur de presets depuis la section Presets', 'info');
};

async function loadAdminDB() {
    const base = getApiBase();
    const token = localStorage.getItem('gentok_token');
    try {
        const res = await fetch(`${base}/api/admin/db?token=${token}`);
        if (!res.ok) return;
        const data = await res.json();

        const el = document.getElementById('admin-db-collections');
        if (el && data.collections) {
            el.innerHTML = data.collections.map(c =>
                `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <span>${c.name}</span>
                    <strong style="color: #25f4ee;">${c.count}</strong>
                </div>`
            ).join('');
        }
    } catch (err) { console.error('Admin DB load error:', err); }
}

window.adminClearCache = async () => {
    const base = getApiBase();
    const token = localStorage.getItem('gentok_token');
    try {
        const res = await fetch(`${base}/api/admin/clear-cache`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await res.json();
        showNotify('Cache', data.message || 'Cache vidé', 'success');
    } catch (err) { showNotify('Erreur', 'Erreur cache', 'error'); }
};

window.adminExportDB = async () => {
    const base = getApiBase();
    const token = localStorage.getItem('gentok_token');
    try {
        const res = await fetch(`${base}/api/admin/export?token=${token}`);
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gentok_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showNotify('Export', 'Export téléchargé !', 'success');
    } catch (err) { showNotify('Erreur', 'Erreur export', 'error'); }
};

window.adminInspectUser = async () => {
    const userToken = document.getElementById('admin-inspect-token')?.value;
    if (!userToken) { showNotify('Erreur', 'Entrez un token', 'error'); return; }

    const base = getApiBase();
    const token = localStorage.getItem('gentok_token');
    try {
        const res = await fetch(`${base}/api/admin/inspect/${userToken}?token=${token}`);
        const data = await res.json();
        const el = document.getElementById('admin-inspect-result');
        if (el) {
            el.style.display = 'block';
            el.textContent = JSON.stringify(data, null, 2);
        }
    } catch (err) { showNotify('Erreur', 'Erreur inspection', 'error'); }
};



// --- RANKING SYSTEM ---
let currentRankingType = 'legends';
let rankingPeriod = 'all'; // 'all' or 'weekly'
let rankingSort = 'price-asc'; // [NEW] Default to Smallest -> Largest
let rankingFilters = {
    minPrice: 0,
    maxPrice: 99999,
    search: '',
    onlyWithScore: false
};
let rankingMainColor = '#fe2c55';
let allLegendsData = JSON.parse(localStorage.getItem('gentok_cache_legends') || '[]');
let giftCatalogCache = JSON.parse(localStorage.getItem('gentok_cache_gifts') || '[]');

// Background sync on load
setTimeout(() => syncRankingCache(), 2000);

async function syncRankingCache() {
    try {
        const base = getApiBase();
        const res = await fetch(`${base}/api/gifts`);
        const gifts = await res.json();
        if (Array.isArray(gifts)) {
            giftCatalogCache = gifts;
            localStorage.setItem('gentok_cache_gifts', JSON.stringify(gifts));
            // the 3 000+ gift list is only built when the Classement page is open (it is heavy)
            const select = document.getElementById('manual-gift-id');
            const rankingOpen = document.getElementById('ranking-section')?.style.display !== 'none';
            if (select && (rankingOpen || select.options.length > 2)) populateManualGiftSelect(true);
        }
    } catch (e) { console.warn("Sync cache failed", e); }
}

window.switchRankingTab = (type, btn) => {
    currentRankingType = type;
    document.querySelectorAll('#ranking-section .btn-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const dashboard = document.getElementById('ranking-legends-dashboard');
    const tableContainer = document.getElementById('ranking-table-container');

    if (type === 'legends') {
        if (dashboard) dashboard.style.display = 'block';
        if (tableContainer) tableContainer.style.display = 'none';
        renderRankingLegends();
        populateManualGiftSelect();
    } else {
        if (dashboard) dashboard.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';
        const colHeader = document.getElementById('ranking-col-value');
        if (colHeader) colHeader.textContent = type === 'likes' ? 'TOP LIKES' : 'TOP PIÈCES';
        renderRankingTable();
    }
};

window.setRankingColor = (color, btn) => {
    rankingMainColor = color;
    if (btn) {
        document.querySelectorAll('.btn-color').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    document.documentElement.style.setProperty('--ranking-primary', color);
    showNotify('Succès', `Couleur mise à jour : ${color}`, 'success');
};

window.setRankingPeriod = (period, btn) => {
    rankingPeriod = period;
    if (btn) {
        const parent = btn.parentElement;
        parent.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    renderRankingLegends();
};

window.setRankingSort = (sort, btn) => {
    rankingSort = sort;
    if (btn) {
        const parent = btn.parentElement;
        parent.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    applyRankingFilters();
};

window.applyRankingFilters = () => {
    rankingFilters.minPrice = parseInt(document.getElementById('filter-price-min').value) || 0;
    rankingFilters.maxPrice = parseInt(document.getElementById('filter-price-max').value) || 99999;
    rankingFilters.search = document.getElementById('filter-search').value.toLowerCase();
    rankingFilters.onlyWithScore = document.getElementById('filter-has-score').checked;
    displayLegendsGrid();
};

window.resetRankingFilters = () => {
    document.getElementById('filter-price-min').value = '';
    document.getElementById('filter-price-max').value = '';
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-has-score').checked = false;
    rankingSort = 'score';
    document.querySelectorAll('.ranking-filter-row .btn-tab').forEach(b => {
        b.classList.remove('active');
        if ((b.getAttribute('onclick') || '').includes("'score'")) b.classList.add('active');
    });
    applyRankingFilters();
};

async function populateManualGiftSelect(force = false) {
    const select = document.getElementById('manual-gift-id');
    if (!select) return;
    if (!force && select.children.length > 2) return;

    const render = (list) => {
        const currentVal = select.value;
        // built in one go (thousands of options): one layout instead of one per gift
        const frag = document.createDocumentFragment();
        frag.appendChild(new Option('-- Choisir un cadeau --', ''));
        list.forEach(gift => frag.appendChild(new Option(`${gift.name} (${gift.price} coins)`, gift.id)));
        select.replaceChildren(frag);
        if (currentVal) select.value = currentVal;
    };

    if (giftCatalogCache.length > 0) {
        render(giftCatalogCache);
    }

    if (force || giftCatalogCache.length === 0) {
        try {
            const base = getApiBase();
            const res = await fetch(`${base}/api/gifts`);
            const gifts = await res.json();
            if (Array.isArray(gifts)) {
                giftCatalogCache = gifts;
                localStorage.setItem('gentok_cache_gifts', JSON.stringify(gifts));
                render(gifts);
            }
        } catch (e) { console.error("Failed to populate gifts", e); }
    }
}

window.processManualDonation = async (action) => {
    const uniqueId = document.getElementById('manual-user').value.trim().replace('@', '');
    const giftId = document.getElementById('manual-gift-id').value;
    const amount = parseInt(document.getElementById('manual-amount').value);

    if (!uniqueId || !giftId || isNaN(amount)) {
        showNotify('Erreur', 'Veuillez remplir tous les champs', 'error');
        return;
    }

    try {
        const base = getApiBase();
        const token = getToken();
        const res = await fetch(`${base}/api/leaderboard/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, uniqueId, giftId, count: action === 'add' ? amount : -amount })
        });

        const data = await res.json();
        if (data.success) {
            showNotify('Succès', `Donation ${action === 'add' ? 'ajoutée' : 'retirée'} avec succès`, 'success');
            renderRankingLegends();
        } else {
            showNotify('Erreur', data.error || 'Erreur lors de l\'opération', 'error');
        }
    } catch (err) { showNotify('Erreur', 'Erreur serveur', 'error'); }
};

window.saveCurrentWeek = async () => {
    if (!confirm("Voulez-vous vraiment sauvegarder et réinitialiser les scores de la semaine ?")) return;
    try {
        const base = getApiBase();
        const token = getToken();
        const res = await fetch(`${base}/api/leaderboard/history/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (data.success) {
            showNotify('Succès', 'Semaine sauvegardée !', 'success');
            loadHistoryList();
            renderRankingLegends();
        }
    } catch (err) { showNotify('Erreur', 'Erreur lors de la sauvegarde', 'error'); }
};

// Archived week (Top Légende, top coins, top likes): podium + one card per gift with its winners
async function viewHistoryDetail(id) {
    try {
        const base = getApiBase();
        const token = localStorage.getItem('gentok_token');
        const res = await fetch(`${base}/api/leaderboard/history/detail?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token || '')}`);
        const history = await res.json();
        if (history.error) throw new Error(history.error);

        const avatar = (u, size = 34) => `<img class="hz-avatar" style="width:${size}px;height:${size}px" src="${escapeHtml(u.profilePictureUrl || '/logo.png')}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.src='/logo.png'">`;
        const name = (u) => escapeHtml(u.nickname || u.uniqueId || '?');
        const podium = (list, unit) => {
            if (!list || !list.length) return '<div class="hz-empty">Aucune donnée cette semaine</div>';
            const top = list.slice(0, 3);
            const order = [top[1], top[0], top[2]].filter(Boolean);
            return `
                <div class="hz-podium">${order.map(u => {
                    const rank = list.indexOf(u) + 1;
                    return `<div class="hz-step rank-${rank}">${avatar(u, rank === 1 ? 64 : 50)}<b>${name(u)}</b><span>${u.count.toLocaleString()} ${unit}</span><em>${rank}</em></div>`;
                }).join('')}</div>
                ${list.length > 3 ? `<ol class="hz-rest" start="4">${list.slice(3).map(u => `<li>${avatar(u, 24)}<span>${name(u)}</span><b>${u.count.toLocaleString()}</b></li>`).join('')}</ol>` : ''}`;
        };
        const legends = (history.legends || []).slice().sort((a, b) => ((b.topUsers[0] && b.topUsers[0].count) || 0) - ((a.topUsers[0] && a.topUsers[0].count) || 0));
        const legendCards = legends.length ? legends.map(l => `
            <div class="hz-legend">
                <div class="hz-gift"><img src="${base}/img/tiktok/${encodeURIComponent(l.giftId)}.png" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('i'), { className: 'fas fa-gift' }))"><span>${escapeHtml(l.giftName)}</span></div>
                ${(l.topUsers || []).map((u, i) => `<div class="hz-winner ${i === 0 ? 'first' : ''}">${i === 0 ? '<i class="fas fa-crown"></i>' : `<small>${i + 1}</small>`}${avatar(u, 22)}<span>${name(u)}</span><b>×${u.count.toLocaleString()}</b></div>`).join('')}
            </div>`).join('') : '<div class="hz-empty">Aucun cadeau archivé</div>';

        const period = String(history.period || '').replace(/^(\d{4})-W(\d+)$/, 'Semaine $2 · $1');
        Swal.fire({
            title: `<i class="fas fa-crown" style="color:#ffd700"></i> ${escapeHtml(period)}`,
            html: `
                <div class="hz-detail">
                    <div class="hz-tabs" role="tablist">
                        <button type="button" class="active" data-hz="legends"><i class="fas fa-crown"></i> Top Légende <span>${legends.length}</span></button>
                        <button type="button" data-hz="coins"><i class="fas fa-coins"></i> Pièces</button>
                        <button type="button" data-hz="likes"><i class="fas fa-heart"></i> Likes</button>
                    </div>
                    <div class="hz-pane" data-pane="legends"><div class="hz-legends">${legendCards}</div></div>
                    <div class="hz-pane" data-pane="coins" hidden>${podium(history.topCoins, 'pièces')}</div>
                    <div class="hz-pane" data-pane="likes" hidden>${podium(history.topLikes, 'likes')}</div>
                </div>`,
            width: 'min(860px, 96vw)',
            showConfirmButton: false,
            showCloseButton: true,
            customClass: { popup: 'hz-popup' },
            didOpen: (el) => {
                el.querySelectorAll('.hz-tabs button').forEach(btn => btn.addEventListener('click', () => {
                    el.querySelectorAll('.hz-tabs button').forEach(x => x.classList.toggle('active', x === btn));
                    el.querySelectorAll('.hz-pane').forEach(p => { p.hidden = p.dataset.pane !== btn.dataset.hz; });
                }));
            }
        });
    } catch (err) {
        showNotify('Erreur', 'Impossible de charger le détail', 'error');
    }
}

async function loadHistoryList() {
    const list = document.getElementById('ranking-history-list');
    if (!list) return;
    try {
        const base = getApiBase();
        const token = getToken();
        const res = await fetch(`${base}/api/leaderboard/history?token=${encodeURIComponent(token || '')}`);
        const data = await res.json();
        if (!Array.isArray(data) || !data.length) {
            list.innerHTML = '<div class="hz-empty">Aucune semaine archivée pour le moment. L\'archive se fait chaque dimanche à 23 h (ou avec « Sauvegarder la semaine »).</div>';
            return;
        }
        list.innerHTML = data.map(h => {
            const m = String(h.period || '').match(/^(\d{4})-W(\d+)$/);
            return `
                <button type="button" class="history-item hz-item" onclick="viewHistoryDetail('${escapeHtml(h._id)}')">
                    <span class="hz-week">${m ? `S${m[2]}` : '<i class="fas fa-calendar"></i>'}</span>
                    <span class="hz-meta">
                        <b>${m ? `Semaine ${m[2]} · ${m[1]}` : 'Semaine'}</b>
                        <small>Archivée le ${new Date(h.date).toLocaleDateString()} · ${h.totalGifts} gagnant${h.totalGifts > 1 ? 's' : ''}</small>
                    </span>
                    <i class="fas fa-chevron-right"></i>
                </button>`;
        }).join('');
    } catch (e) {
        list.innerHTML = '<div class="hz-empty">Historique indisponible pour le moment.</div>';
    }
}

window.showRankingOverlayUrls = () => {
    const token = getToken();
    const urls = [
        { name: 'Légendes (Grille)', url: `https://tiktok.gentok.fr/overlay/legends?token=${token}&period=${rankingPeriod}` },
        { name: 'Top Pièces (Liste)', url: `https://tiktok.gentok.fr/overlay/top-coins?token=${token}&period=${rankingPeriod}` },
        { name: 'Top Likes (Liste)', url: `https://tiktok.gentok.fr/overlay/top-likes?token=${token}&period=${rankingPeriod}` }
    ];

    let html = '<div style="display: flex; flex-direction: column; gap: 15px; margin-top: 10px;">';
    urls.forEach(u => {
        html += `
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; border: 1px solid var(--border);">
                <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 8px; color: #ffd700;">${u.name}</div>
                <div style="display: flex; gap: 10px;">
                    <input type="text" value="${u.url}" readonly style="flex: 1; background: #000; border: 1px solid var(--border); padding: 8px; border-radius: 6px; font-size: 0.8rem; color: var(--text-dim);">
                    <button class="btn-tab" onclick="copyToClipboard('${u.url}')" style="padding: 0 15px;"><i class="fas fa-copy"></i></button>
                </div>
            </div>
        `;
    });
    html += '</div>';

    Swal.fire({
        title: 'URLs des Overlays',
        html: html,
        showConfirmButton: false,
        background: 'var(--bg-dark)',
        color: '#fff',
        width: '600px'
    });
};

async function renderRankingLegends() {
    const container = document.getElementById('ranking-legends-container');
    if (!container) return;

    // 1. Show cached data immediately if available
    if (allLegendsData.length > 0) {
        displayLegendsGrid();
    } else {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; opacity: 0.5;">Chargement des légendes...</div>';
    }

    // 2. Refresh in background
    try {
        const base = getApiBase();
        const token = getToken();
        // Background sync
        const res = await fetch(`${base}/api/leaderboard/legends?token=${token}&period=${rankingPeriod}`);
        const data = await res.json();

        if (Array.isArray(data)) {
            allLegendsData = data;
            localStorage.setItem('gentok_cache_legends', JSON.stringify(data));
            displayLegendsGrid();
        }
    } catch (err) {
        console.error('Legends refresh error:', err);
        if (allLegendsData.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--error);">Désolé, impossible de charger les données.</div>';
        }
    }
}

const LEGENDS_PAGE = 48;
let legendsGridShown = LEGENDS_PAGE;
let legendsGridSignature = '';

function displayLegendsGrid() {
    const container = document.getElementById('ranking-legends-container');
    if (!container) return;

    let filtered = allLegendsData.filter(gift => {
        const matchesPrice = gift.price >= rankingFilters.minPrice && gift.price <= rankingFilters.maxPrice;
        const matchesSearch = !rankingFilters.search || gift.giftName.toLowerCase().includes(rankingFilters.search);
        const hasScore = !rankingFilters.onlyWithScore || (gift.topUsers && gift.topUsers.length > 0);
        return matchesPrice && matchesSearch && hasScore;
    });

    // "Score": gifts that have winners first (most sent first), then by price
    const best = (g) => (g.topUsers && g.topUsers[0] ? g.topUsers[0].count : 0);
    if (rankingSort === 'score') filtered.sort((a, b) => (best(b) > 0) - (best(a) > 0) || best(b) - best(a) || b.price - a.price);
    else if (rankingSort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    else if (rankingSort === 'price-desc') filtered.sort((a, b) => b.price - a.price);

    if (filtered.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; opacity: 0.5;">Aucun cadeau ne correspond à vos filtres.</div>';
        return;
    }

    // The catalog has 3 000+ gifts: cards are shown 48 at a time (rendering them all froze the page)
    const signature = JSON.stringify([rankingFilters, rankingSort, filtered.length]);
    if (signature !== legendsGridSignature) { legendsGridSignature = signature; legendsGridShown = LEGENDS_PAGE; }
    const total = filtered.length;
    filtered = filtered.slice(0, legendsGridShown);

    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    filtered.forEach(gift => {
        const card = document.createElement('div');
        card.className = 'gift-legend-card-compact';
        card.style.cssText = `background: rgba(18, 19, 22, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; display: flex; flex-direction: column; position: relative; overflow: hidden;`;

        const topUsersHtml = gift.topUsers && gift.topUsers.length > 0 ? gift.topUsers.map((user, idx) => {
            savePfp(user.uniqueId, user.profilePictureUrl);
            const pfp = getPfp(user.uniqueId, user.profilePictureUrl || '/logo.png');
            let rankColor = idx === 0 ? '#ffd700' : (idx === 1 ? '#c0c0c0' : (idx === 2 ? '#cd7f32' : 'var(--text-dim)'));

            return `
            <div style="display: flex; align-items: center; gap: 12px; width: 100%; padding: 6px 12px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                <div style="font-weight: 800; color: ${rankColor}; font-size: 0.8rem; width: 25px;">#${idx + 1}</div>
                <div style="position: relative; flex-shrink: 0;">
                    <img src="${escapeHtml(pfp)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='/logo.png'" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1.5px solid ${idx < 3 ? rankColor : 'rgba(255,255,255,0.1)'};">
                </div>
                <div style="flex-grow: 1; min-width: 0;">
                    <div style="font-size: 0.75rem; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.9;">${escapeHtml(user.uniqueId)}</div>
                </div>
                <div style="font-weight: 800; color: #ffd700; font-size: 0.85rem; flex-shrink: 0;">x${user.count}</div>
            </div>
        `;
        }).join('') : '<div style="padding: 20px; text-align: center; opacity: 0.3; font-style: italic; font-size: 0.8rem;">Aucune légende</div>';

        card.innerHTML = `
            <div style="background: rgba(255,255,255,0.02); padding: 15px; display: flex; align-items: center; gap: 15px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="position: relative; flex-shrink: 0;"><img src="${escapeHtml(gift.giftIcon || '')}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/logo.png';this.style.opacity='.35'" style="width: 45px; height: 45px; object-fit: contain; filter: drop-shadow(0 0 8px rgba(255,215,0,0.2));"></div>
                <div style="flex-grow: 1; min-width: 0;">
                    <div style="font-weight: 800; font-size: 1rem; color: #fff; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(gift.giftName)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 2px; display: flex; align-items: center; gap: 5px; font-weight: 600;">
                        ${gift.price} <img src="https://tiktok.gentok.fr/img/tiktok/5655.png" loading="lazy" alt="" style="width: 12px; height: 12px; opacity: 0.7;">
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <button class="btn-tab" style="padding: 6px; font-size: 0.7rem; border-radius: 6px;" onclick="copyGiftLegendLink('${gift.giftId}')" title="Copier lien"><i class="fas fa-link"></i></button>
                    <button class="btn-tab" style="padding: 6px; font-size: 0.7rem; border-radius: 6px; color: #fe2c55;" onclick="showGiftOverlay('${gift.giftId}')" title="Afficher"><i class="fas fa-play"></i></button>
                </div>
            </div>
            <div class="legend-scroll-list" style="flex-grow: 1; display: flex; flex-direction: column; gap: 6px; padding: 12px; overflow-y: auto; max-height: 250px;">${topUsersHtml}</div>
        `;
        frag.appendChild(card);
    });
    container.appendChild(frag);
    if (total > filtered.length) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'btn-secondary legends-more';
        more.style.cssText = 'grid-column: 1 / -1; justify-self: center; margin: 6px 0 12px;';
        more.innerHTML = `<i class="fas fa-chevron-down"></i> Afficher plus (${(total - filtered.length).toLocaleString()} restants)`;
        more.onclick = () => { legendsGridShown += LEGENDS_PAGE * 2; displayLegendsGrid(); };
        container.appendChild(more);
    }
}

async function renderRankingTable() {
    const body = document.getElementById('ranking-body');
    const tokenDisplay = document.getElementById('ranking-token-display');
    if (!body) return;

    const token = getToken();
    if (tokenDisplay) tokenDisplay.textContent = token;

    body.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; opacity: 0.5;">Chargement du classement détaillé...</td></tr>';

    try {
        const base = getApiBase();
        const token = getToken();
        // Sort by the currently selected type and period
        const res = await fetch(`${base}/api/leaderboard?token=${token}&type=${currentRankingType}&period=${rankingPeriod}`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            body.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; opacity: 0.5;">Aucune donnée disponible.</td></tr>';
            return;
        }

        body.innerHTML = '';
        data.forEach((entry, index) => {
            const row = document.createElement('tr');

            const fmt = (v) => new Intl.NumberFormat('fr-FR').format(v || 0);

            const date = entry.lastUpdated ? new Date(entry.lastUpdated).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
            let rankColor = index === 0 ? '#ffd700' : (index === 1 ? '#c0c0c0' : (index === 2 ? '#cd7f32' : 'var(--text-dim)'));

            row.innerHTML = `
                <td style="text-align: center; font-weight: 800; color: ${rankColor}; font-size: 1.1rem;">#${index + 1}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px; padding: 5px 0;">
                        <img src="${getPfp(entry.uniqueId, entry.profilePictureUrl)}" onerror="this.src='/logo.png'" style="width: 42px; height: 42px; border-radius: 50%; border: 2px solid ${index < 3 ? rankColor : 'var(--border)'}; object-fit: cover;">
                        <div style="text-align: left;">
                            <div style="font-weight: 700; color: #fff; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(entry.nickname || entry.uniqueId)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-dim);">@${escapeHtml(entry.uniqueId)}</div>
                        </div>
                    </div>
                </td>
                <td style="text-align: center;">
                    <div style="font-weight: 800; color: #fff; font-size: 1rem;">${fmt(entry.totalCoins)}</div>
                    <div style="font-size: 0.75rem; color: #ffd700; font-weight: 700;">${fmt(entry.weeklyCoins)} <small>cette sem.</small></div>
                </td>
                <td style="text-align: center;">
                    <div style="font-weight: 800; color: #fff; font-size: 1rem;">${fmt(entry.totalLikes)}</div>
                    <div style="font-size: 0.75rem; color: #fe2c55; font-weight: 700;">${fmt(entry.weeklyLikes)} <small>cette sem.</small></div>
                </td>
                <td style="text-align: center;">
                    <div style="font-weight: 800; color: #fff; font-size: 1rem;">${fmt(entry.totalGifts)}</div>
                    <div style="font-size: 0.75rem; color: #00f2ea; font-weight: 700;">${fmt(entry.weeklyGiftsCount)} <small>cette sem.</small></div>
                </td>
                <td style="text-align: right; color: var(--text-dim); font-size: 0.8rem;">${date}</td>
            `;
            body.appendChild(row);
        });
    } catch (err) {
        console.error('Table load error:', err);
        body.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--error);">Erreur lors du chargement.</td></tr>';
    }
}

window.copyGiftLegendLink = (giftId) => {
    const token = getToken();
    const url = `https://tiktok.gentok.fr/overlay/gift_legend.html?token=${token}&giftId=${giftId}&period=${rankingPeriod}`;
    const gift = giftCatalogCache.find(g => g.id.toString() === giftId.toString());
    const giftName = gift ? gift.name : giftId;

    navigator.clipboard.writeText(url).then(() => {
        showToast(`Lien copié : ${giftName} (${rankingPeriod === 'weekly' ? 'Semaine' : 'Général'})`, 'success');
    });
};

window.showGiftOverlay = (giftId) => {
    const token = getToken();
    const gift = giftCatalogCache.find(g => g.id.toString() === giftId.toString());
    const giftName = gift ? gift.name : giftId;

    if (window.socket && window.socket.connected) {
        window.socket.emit('show_gift_legend', { token, giftId, period: rankingPeriod });
        showToast(`Affichage : ${giftName} (${rankingPeriod === 'weekly' ? 'Semaine' : 'Général'})`, 'success');
    } else {
        showToast('Erreur : Non connecté', 'error');
    }
};

window.hideGiftOverlay = (giftId) => {
    const token = getToken();
    const gift = giftCatalogCache.find(g => g.id.toString() === giftId.toString());
    const giftName = gift ? gift.name : giftId;

    if (window.socket && window.socket.connected) {
        window.socket.emit('hide_gift_legend', { token, giftId, period: rankingPeriod });
        showToast(`Retrait : ${giftName}`, 'info');
    } else {
        showToast('Erreur : Non connecté', 'error');
    }
};

// =======================
// FONT CUSTOMIZATION SYSTEM
// =======================
let availableFonts = [];

async function fetchFonts() {
    try {
        const res = await fetch('https://gentok.fr/api/polices/');
        const data = await res.json();
        availableFonts = data.fonts || [];
        console.log(`[FONTS] ${availableFonts.length} polices chargées.`);
        populateFontSelectors();
    } catch (e) {
        console.warn('Impossible de charger les polices custom:', e);
    }
}

function populateFontSelectors() {
    const selectors = document.querySelectorAll('.font-selector');
    selectors.forEach(select => {
        const savedVal = select.getAttribute('data-font');

        // Clear except first if it's "Default"
        const existingDefault = select.querySelector('option[value=""]');
        select.innerHTML = '';
        if (existingDefault) {
            select.appendChild(existingDefault);
        } else {
            const defOpt = document.createElement('option');
            defOpt.value = "";
            defOpt.textContent = "Police par défaut";
            select.appendChild(defOpt);
        }

        availableFonts.forEach(font => {
            const opt = document.createElement('option');
            opt.value = font.name;
            opt.textContent = font.name;
            if (savedVal === font.name) opt.selected = true;
            select.appendChild(opt);
        });

        // Add Google Fonts
        const googleFonts = ['Luckiest Guy', 'Outfit', 'Bebas Neue', 'Orbitron', 'Press Start 2P', 'Inter', 'Roboto', 'Fasthand'];
        googleFonts.forEach(font => {
            if (!availableFonts.some(f => f.name === font)) {
                const opt = document.createElement('option');
                opt.value = font;
                opt.textContent = font;
                if (savedVal === font) opt.selected = true;
                select.appendChild(opt);
            }
        });
    });
}

window.applyFontToOverlay = (type, font) => {
    console.log(`[FONT] Applying ${font} to ${type}`);
    if (type === 'likesGoal') {
        updateLikesPreview();
    } else if (type === 'topGift' || type === 'topStreak') {
        const iframe = document.querySelector(`#overlay-item-top iframe[src*="${type === 'topGift' ? 'top-gift' : 'top-streak'}"]`);
        if (iframe) {
            const url = new URL(iframe.src, window.location.origin);
            url.searchParams.set('font', font);
            iframe.src = url.toString();
        }
    } else if (type === 'coins' || type === 'likes') {
        updateLeaderboardConfig(type);
    }
};

window.injectFontInPreview = (elementId, font) => {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (!font) {
        el.style.setProperty('font-family', '', 'important');
        return;
    }

    const applyToAll = (element, fontName) => {
        element.style.setProperty('font-family', `'${fontName}', sans-serif`, 'important');
        // Also target common children if it's a wrapper
        const children = element.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6');
        children.forEach(child => {
            child.style.setProperty('font-family', `'${fontName}', sans-serif`, 'important');
        });
    };

    const isCustom = availableFonts.some(f => (f.name === font || f === font));
    const googleFonts = ['Luckiest Guy', 'Outfit', 'Bebas Neue', 'Orbitron', 'Press Start 2P', 'Inter', 'Roboto', 'Fasthand'];
    const isGoogle = googleFonts.includes(font);

    if (isCustom) {
        const fontUrl = `https://gentok.fr/polices/${font}.ttf`;
        const fontFace = new FontFace(font, `url(${fontUrl})`);
        fontFace.load().then(loadedFace => {
            document.fonts.add(loadedFace);
            applyToAll(el, font);
        }).catch(err => {
            console.warn('Font load error:', err);
            applyToAll(el, font); // Fallback to name anyway
        });
    } else if (isGoogle) {
        // Ensure Google Font link exists
        const fontId = 'google-font-' + font.replace(/ /g, '-').toLowerCase();
        if (!document.getElementById(fontId)) {
            const link = document.createElement('link');
            link.id = fontId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}&display=swap`;
            document.head.appendChild(link);
        }
        applyToAll(el, font);
    } else {
        applyToAll(el, font);
    }
};

// =======================
// PREMIUM SETTINGS SYSTEM
// =======================

function setAccentColor(color, el) {
    document.documentElement.style.setProperty('--primary', color);
    // Convert hex to RGB for overlays/glows
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
    document.documentElement.style.setProperty('--primary-glow', `rgba(${r}, ${g}, ${b}, 0.4)`);

    // Update UI selection
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.remove('active');
        dot.style.border = 'none';
    });
    if (el) {
        el.classList.add('active');
        el.style.border = '2px solid #fff';
    }

    savePremiumSettings();
}

function updateUIStyle(style) {
    document.body.classList.remove('ui-compact', 'ui-glass', 'ui-studio', 'ui-classic');
    document.documentElement.classList.remove('ui-studio', 'ui-classic');
    if (style === 'compact') document.body.classList.add('ui-compact');
    if (style === 'glass') document.body.classList.add('ui-glass');
    if (style === 'studio' || style === 'classic') { document.body.classList.add('ui-' + style); document.documentElement.classList.add('ui-' + style); }
    try { localStorage.setItem('gentok_ui_style', style); } catch (e) { }
    savePremiumSettings();
}

function savePremiumSettings() {
    const settings = {
        accentColor: document.documentElement.style.getPropertyValue('--primary'),
        uiStyle: document.getElementById('setting-ui-style')?.value || 'classic',
        autoConnect: document.getElementById('setting-auto-connect')?.checked,
        autoReset: document.getElementById('setting-auto-reset')?.checked,
        soundAlerts: document.getElementById('setting-sound-alerts')?.checked,
        desktopNotifs: document.getElementById('setting-desktop-notifs')?.checked
    };
    localStorage.setItem('gentok_premium_settings', JSON.stringify(settings));
}

function loadPremiumSettings() {
    // Interface style: its own key, Classique by default (older saves of "modern" were only the old default)
    let uiStyle = 'classic';
    try { uiStyle = localStorage.getItem('gentok_ui_style') || 'classic'; } catch (e) { }
    const styleSelect = document.getElementById('setting-ui-style');
    if (styleSelect) styleSelect.value = uiStyle;
    document.body.classList.remove('ui-compact', 'ui-glass', 'ui-studio', 'ui-classic');
    if (['compact', 'glass', 'studio', 'classic'].includes(uiStyle)) document.body.classList.add('ui-' + uiStyle);

    const saved = localStorage.getItem('gentok_premium_settings');
    if (!saved) return;

    try {
        const settings = JSON.parse(saved);
        if (settings.accentColor) {
            const dot = document.querySelector(`.color-dot[data-color="${settings.accentColor}"]`);
            setAccentColor(settings.accentColor, dot);
        }
        if (settings.autoConnect !== undefined && document.getElementById('setting-auto-connect')) document.getElementById('setting-auto-connect').checked = settings.autoConnect;
        if (settings.autoReset !== undefined && document.getElementById('setting-auto-reset')) document.getElementById('setting-auto-reset').checked = settings.autoReset;
        if (settings.soundAlerts !== undefined && document.getElementById('setting-sound-alerts')) document.getElementById('setting-sound-alerts').checked = settings.soundAlerts;
        if (settings.desktopNotifs !== undefined && document.getElementById('setting-desktop-notifs')) document.getElementById('setting-desktop-notifs').checked = settings.desktopNotifs;
    } catch (e) {
        console.warn("Erreur chargement premium settings:", e);
    }
}

// Global change listener for auto-saving
document.addEventListener('change', (e) => {
    if (e.target.id && e.target.id.startsWith('setting-')) {
        savePremiumSettings();
    }
});

async function exportConfiguration() {
    openExportModal();
}

async function importConfiguration() {
    openImportModal();
}

// Window globally accessible functions
window.setAccentColor = setAccentColor;
window.updateUIStyle = updateUIStyle;
window.exportConfiguration = exportConfiguration;
window.importConfiguration = importConfiguration;

function playAlert(type) {
    const settings = JSON.parse(localStorage.getItem('gentok_premium_settings') || '{}');
    if (!settings.soundAlerts) return;
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(type === 'gift' ? 880 : 660, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) { }
}

function showDesktopNotification(title, body) {
    const settings = JSON.parse(localStorage.getItem('gentok_premium_settings') || '{}');
    if (!settings.desktopNotifs || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
        new Notification(title, { body, icon: '/logo.png' });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

// ==========================================
// [IMPORT / EXPORT SYSTEM - GENTOK & TIKFINITY]
// ==========================================

// openModal / closeModal are defined once, above (they also handle the "hidden" class: a second,
// simpler copy here used to replace them and some windows, like the live analysis, never opened).

window.openImportModal = () => {
    openModal('modal-import-settings');
    setupDragAndDropImport();
};

window.openExportModal = () => {
    // Calculate counts dynamically as in TikFinity
    const soundCount = (currentActions || []).filter(a => a.type === 'sound').length;
    const actionCount = (currentActions || []).filter(a => a.type !== 'sound').length;
    const eventCount = (currentEvents || []).length;

    const cntSounds = document.getElementById('cnt-export-sounds');
    const cntActions = document.getElementById('cnt-export-actions');
    const cntEvents = document.getElementById('cnt-export-events');

    if (cntSounds) cntSounds.textContent = `(${soundCount})`;
    if (cntActions) cntActions.textContent = `(${actionCount})`;
    if (cntEvents) cntEvents.textContent = `(${eventCount})`;

    if (typeof openModal === 'function') openModal('modal-export-settings');
};

window.setupDragAndDropImport = () => {
    const dropZone = document.getElementById('drop-zone-import');
    if (!dropZone || dropZone.dataset.setup) return;
    dropZone.dataset.setup = 'true';

    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = '#00f0ff';
            dropZone.style.background = 'rgba(0, 240, 255, 0.1)';
        }, false);
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            dropZone.style.background = 'rgba(0, 0, 0, 0.2)';
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            readAndProcessImportFile(files[0]);
        }
    });
};

window.handleImportFileModal = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
        readAndProcessImportFile(files[0]);
    }
    e.target.value = '';
};

function readAndProcessImportFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const jsonStr = e.target.result;
            const rawData = JSON.parse(jsonStr);

            if (rawData.app === 'Gentok' || rawData.type === 'gentok_actions') {
                if (rawData.actions && Array.isArray(rawData.actions)) {
                    currentActions = mergeUniqueItems(currentActions, rawData.actions);
                }
                if (rawData.events && Array.isArray(rawData.events)) {
                    currentEvents = mergeUniqueItems(currentEvents, rawData.events);
                }
                await saveCurrentConfig();
                renderActions();
                renderEvents();
                if (typeof closeModal === 'function') closeModal('modal-import-settings');
                showToast('Profil Gentok importé avec succès !', 'success');
            } else {
                await processTikFinityImport(jsonStr);
                if (typeof closeModal === 'function') closeModal('modal-import-settings');
            }
        } catch (err) {
            Swal.fire('Erreur d\'importation', err.message, 'error');
        }
    };
    reader.readAsText(file);
}

window.executeTailoredExport = () => {
    try {
        const incUsername = document.getElementById('chk-export-username')?.checked;
        const incGeneral = document.getElementById('chk-export-general')?.checked;
        const incSounds = document.getElementById('chk-export-sounds')?.checked;
        const incActions = document.getElementById('chk-export-actions')?.checked;
        const incEvents = document.getElementById('chk-export-events')?.checked;

        const payload = {
            version: '1.0.5',
            app: 'Gentok',
            exportDate: new Date().toISOString()
        };

        if (incUsername) {
            payload.username = localStorage.getItem('gentok_username') || document.getElementById('username')?.value || '';
        }
        if (incGeneral) {
            payload.settings = JSON.parse(localStorage.getItem('gentok_premium_settings') || '{}');
        }

        let filteredActions = currentActions || [];
        if (!incSounds) filteredActions = filteredActions.filter(a => a.type !== 'sound');
        if (!incActions) filteredActions = filteredActions.filter(a => a.type === 'sound');
        if (!incSounds && !incActions) filteredActions = [];

        payload.actions = filteredActions;
        if (incEvents) payload.events = currentEvents || [];

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gentok_profil_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof closeModal === 'function') closeModal('modal-export-settings');
        showToast('Exportation réussie !', 'success');
    } catch (e) {
        showToast(`Erreur export: ${e.message}`, 'error');
    }
};

window.deleteEventsWithoutActions = async () => {
    if (!currentEvents || currentEvents.length === 0) {
        showToast('Aucun événement à vérifier', 'info');
        return;
    }

    const countBefore = currentEvents.length;
    currentEvents = currentEvents.filter(event => {
        if (!event.actions || !Array.isArray(event.actions) || event.actions.length === 0) return false;
        return event.actions.some(actionId => (currentActions || []).some(a => a.id === actionId));
    });

    const deletedCount = countBefore - currentEvents.length;
    if (deletedCount > 0) {
        await saveCurrentConfig();
        if (typeof renderEvents === 'function') renderEvents();
        showToast(`${deletedCount} événement(s) sans action supprimé(s) !`, 'success');
    } else {
        showToast('Aucun événement sans action trouvé', 'info');
    }
};

window.deleteUnusedActions = async () => {
    if (!currentActions || currentActions.length === 0) {
        showToast('Aucune action à vérifier', 'info');
        return;
    }

    const countBefore = currentActions.length;
    currentActions = currentActions.filter(action => {
        return (currentEvents || []).some(e => e.actions && Array.isArray(e.actions) && e.actions.includes(action.id));
    });

    const deletedCount = countBefore - currentActions.length;
    if (deletedCount > 0) {
        await saveCurrentConfig();
        if (typeof renderActions === 'function') renderActions();
        if (typeof renderSoundboard === 'function') renderSoundboard();
        showToast(`${deletedCount} action(s) non liée(s) supprimée(s) !`, 'success');
    } else {
        showToast('Aucune action orpheline trouvée', 'info');
    }
};

window.deleteUnusedSounds = async () => {
    if (!currentActions || currentActions.length === 0) {
        showToast('Aucun son à vérifier', 'info');
        return;
    }

    const soundActions = currentActions.filter(a => a.type === 'sound');
    if (soundActions.length === 0) {
        showToast('Aucun son trouvé dans le Soundboard', 'info');
        return;
    }

    const countBefore = currentActions.length;
    currentActions = currentActions.filter(action => {
        if (action.type !== 'sound') return true;
        return (currentEvents || []).some(e => e.actions && Array.isArray(e.actions) && e.actions.includes(action.id));
    });

    const deletedCount = countBefore - currentActions.length;
    if (deletedCount > 0) {
        await saveCurrentConfig();
        if (typeof renderSoundboard === 'function') renderSoundboard();
        if (typeof renderActions === 'function') renderActions();
        showToast(`${deletedCount} son(s) non lié(s) supprimé(s) !`, 'success');
    } else {
        showToast('Aucun son orphelin trouvé', 'info');
    }
};

window.batchAdjustSoundboardVolumes = async () => {
    const soundActions = (currentActions || []).filter(a => a.type === 'sound');
    if (soundActions.length === 0) {
        showToast('Aucun son dans le Soundboard', 'info');
        return;
    }

    const { value: volumeVal } = await Swal.fire({
        title: 'Ajuster le volume de TOUS les sons',
        text: 'Définissez le nouveau volume (%) pour l\'ensemble des sons du Soundboard :',
        input: 'range',
        inputAttributes: {
            min: 0,
            max: 100,
            step: 5,
            style: 'width: 80%; margin: 15px auto;'
        },
        inputValue: 50,
        showCancelButton: true,
        confirmButtonText: 'Appliquer à tous',
        cancelButtonText: 'Annuler',
        background: '#121316',
        color: '#fff',
        confirmButtonColor: 'var(--primary)',
        didOpen: () => {
            const container = Swal.getHtmlContainer();
            const input = Swal.getInput();
            const valSpan = document.createElement('div');
            valSpan.id = 'swal-vol-val';
            valSpan.style = 'font-size: 1.6rem; font-weight: 800; color: var(--secondary); margin-top: 10px; text-align: center;';
            valSpan.innerText = `${input.value}%`;
            input.oninput = () => { valSpan.innerText = `${input.value}%`; };
            container.appendChild(valSpan);
        }
    });

    if (volumeVal !== undefined && volumeVal !== null) {
        const targetVol = parseInt(volumeVal);
        soundActions.forEach(action => {
            action.volume = targetVol;
        });

        await saveCurrentConfig();
        if (typeof renderSoundLinks === 'function') renderSoundLinks();
        if (typeof renderActions === 'function') renderActions();
        showToast(`Volume de ${soundActions.length} son(s) réglé à ${targetVol}% !`, 'success');
    }
};

window.changeSingleSoundVolume = async (actionId) => {
    const action = (currentActions || []).find(a => a.id === actionId);
    if (!action) return;

    const currentVol = action.volume ? Math.round(action.volume <= 1 ? action.volume * 100 : action.volume) : 100;

    const { value: volumeVal } = await Swal.fire({
        title: `Volume : ${action.soundName || action.name}`,
        input: 'range',
        inputAttributes: {
            min: 0,
            max: 100,
            step: 5,
            style: 'width: 80%; margin: 15px auto;'
        },
        inputValue: currentVol,
        showCancelButton: true,
        confirmButtonText: 'Enregistrer',
        cancelButtonText: 'Annuler',
        background: '#121316',
        color: '#fff',
        confirmButtonColor: 'var(--primary)',
        didOpen: () => {
            const container = Swal.getHtmlContainer();
            const input = Swal.getInput();
            const valSpan = document.createElement('div');
            valSpan.style = 'font-size: 1.6rem; font-weight: 800; color: var(--secondary); margin-top: 10px; text-align: center;';
            valSpan.innerText = `${input.value}%`;
            input.oninput = () => { valSpan.innerText = `${input.value}%`; };
            container.appendChild(valSpan);
        }
    });

    if (volumeVal !== undefined && volumeVal !== null) {
        action.volume = parseInt(volumeVal);
        await saveCurrentConfig();
        if (typeof renderSoundLinks === 'function') renderSoundLinks();
        if (typeof renderActions === 'function') renderActions();
        showToast(`Volume réglé à ${action.volume}%`, 'success');
    }
};

window.cleanAllUnlinkedItems = async () => {
    let deletedEvents = 0;
    let deletedActions = 0;

    if (currentEvents && currentEvents.length > 0) {
        const eventsBefore = currentEvents.length;
        currentEvents = currentEvents.filter(event => {
            if (!event.actions || !Array.isArray(event.actions) || event.actions.length === 0) return false;
            return event.actions.some(actionId => (currentActions || []).some(a => a.id === actionId));
        });
        deletedEvents = eventsBefore - currentEvents.length;
    }

    if (currentActions && currentActions.length > 0) {
        const actionsBefore = currentActions.length;
        currentActions = currentActions.filter(action => {
            return (currentEvents || []).some(e => e.actions && Array.isArray(e.actions) && e.actions.includes(action.id));
        });
        deletedActions = actionsBefore - currentActions.length;
    }

    if (deletedEvents > 0 || deletedActions > 0) {
        await saveCurrentConfig();
        if (typeof renderEvents === 'function') renderEvents();
        if (typeof renderActions === 'function') renderActions();
        if (typeof renderSoundboard === 'function') renderSoundboard();
        showToast(`Nettoyage : ${deletedEvents} événement(s) et ${deletedActions} action(s)/son(s) supprimé(s) !`, 'success');
    } else {
        showToast('Aucun élément orphelin ou sans action trouvé.', 'info');
    }
};

async function saveCurrentConfig() {
    try {
        await sync('actions', currentActions);
        await sync('events', currentEvents);

        const base = window.electronAPI ? getLocalApiBase() : getApiBase();
        const token = localStorage.getItem('gentok_token');
        await fetch(`${base}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                actions: currentActions,
                events: currentEvents
            })
        });

        if (typeof fetchData === 'function') {
            await fetchData();
        }
        renderActions();
        renderEvents();
        if (typeof renderSoundboard === 'function') renderSoundboard();
    } catch (e) {
        console.error("[IO] Error saving config:", e.message);
        throw e;
    }
}

window.exportGentokConfig = () => {
    try {
        const payload = {
            version: '1.0.5',
            app: 'Gentok',
            exportDate: new Date().toISOString(),
            scenes: typeof getUserScenes === 'function' ? getUserScenes() : [],
            actions: currentActions || [],
            events: currentEvents || [],
            settings: JSON.parse(localStorage.getItem('gentok_premium_settings') || '{}')
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gentok_profil_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Sauvegarde Gentok exportée avec succès !', 'success');
    } catch (e) {
        showToast(`Erreur d'exportation: ${e.message}`, 'error');
    }
};

window.triggerImportGentokConfig = () => {
    const input = document.getElementById('input-import-gentok');
    if (input) input.click();
};

window.importGentokConfigFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.actions && !data.events && !data.scenes) {
                throw new Error("Format de fichier Gentok non reconnu.");
            }
            if (data.actions && Array.isArray(data.actions)) {
                currentActions = mergeUniqueItems(currentActions, data.actions);
            }
            if (data.events && Array.isArray(data.events)) {
                currentEvents = mergeUniqueItems(currentEvents, data.events);
            }
            await saveCurrentConfig();
            renderActions();
            renderEvents();
            showToast('Configuration Gentok importée et fusionnée avec succès !', 'success');
        } catch (err) {
            Swal.fire('Erreur d\'importation', err.message, 'error');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
};

window.exportActionsOnly = () => {
    try {
        const payload = {
            type: 'gentok_actions',
            exportDate: new Date().toISOString(),
            actions: currentActions || []
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gentok_actions_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Actions exportées avec succès !', 'success');
    } catch (e) {
        showToast(`Erreur export actions: ${e.message}`, 'error');
    }
};

window.triggerImportActionsOnly = () => {
    const input = document.getElementById('input-import-actions');
    if (input) input.click();
};

window.importActionsOnlyFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const actionsToImport = Array.isArray(data) ? data : (data.actions || []);
            if (!Array.isArray(actionsToImport) || actionsToImport.length === 0) {
                throw new Error("Aucune action trouvée dans ce fichier.");
            }
            currentActions = mergeUniqueItems(currentActions, actionsToImport);
            await saveCurrentConfig();
            renderActions();
            showToast(`${actionsToImport.length} Action(s) importée(s) avec succès !`, 'success');
        } catch (err) {
            Swal.fire('Erreur', err.message, 'error');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
};

window.exportSoundboardOnly = () => {
    try {
        const soundActions = (currentActions || []).filter(a => a.type === 'sound');
        const payload = {
            type: 'gentok_soundboard',
            exportDate: new Date().toISOString(),
            sounds: soundActions
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gentok_soundboard_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Soundboard exporté avec succès !', 'success');
    } catch (e) {
        showToast(`Erreur export soundboard: ${e.message}`, 'error');
    }
};

window.triggerImportSoundboardOnly = () => {
    const input = document.getElementById('input-import-soundboard');
    if (input) input.click();
};

window.importSoundboardOnlyFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const soundsToImport = Array.isArray(data) ? data : (data.sounds || data.actions || []);
            if (!Array.isArray(soundsToImport) || soundsToImport.length === 0) {
                throw new Error("Aucun son trouvé dans ce fichier.");
            }
            const formattedSounds = soundsToImport.map((s, idx) => ({
                id: s.id || `snd_${Date.now()}_${idx}`,
                name: s.name || s.title || 'Son Importé',
                type: 'sound',
                soundUrl: s.soundUrl || s.url || s.path || '',
                soundName: s.soundName || s.name || 'Son',
                volume: s.volume !== undefined ? s.volume : 1.0
            }));
            currentActions = mergeUniqueItems(currentActions, formattedSounds);
            await saveCurrentConfig();
            if (typeof renderSoundboard === 'function') renderSoundboard();
            renderActions();
            showToast(`${formattedSounds.length} Son(s) importé(s) dans le Soundboard !`, 'success');
        } catch (err) {
            Swal.fire('Erreur Soundboard', err.message, 'error');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
};

window.triggerImportTikFinity = () => {
    const input = document.getElementById('input-import-tikfinity');
    if (input) input.click();
};

window.importTikFinityConfigFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonStr = e.target.result;
            processTikFinityImport(jsonStr);
        } catch (err) {
            Swal.fire('Erreur Fichier TikFinity', err.message, 'error');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
};

window.importTikFinityPastedJSON = () => {
    const textarea = document.getElementById('tikfinity-json-paste');
    if (!textarea || !textarea.value.trim()) {
        showToast('Veuillez coller le contenu JSON TikFinity.', 'warning');
        return;
    }
    processTikFinityImport(textarea.value.trim());
};

async function processTikFinityImport(jsonStr) {
    try {
        const rawData = JSON.parse(jsonStr);
        const converted = parseTikFinityData(rawData);

        if (converted.actions.length === 0 && converted.events.length === 0) {
            throw new Error("Aucune action ni événement TikFinity valide n'a pu être extrait de ce JSON.");
        }

        currentActions = mergeUniqueItems(currentActions, converted.actions);
        currentEvents = mergeUniqueItems(currentEvents, converted.events);

        await saveCurrentConfig();
        renderActions();
        renderEvents();
        if (typeof renderSoundboard === 'function') renderSoundboard();

        Swal.fire({
            title: 'Import TikFinity Réussi !',
            text: `${converted.actions.length} Action(s) et ${converted.events.length} Événement(s) ont été importés et convertis pour Gentok.`,
            icon: 'success',
            confirmButtonColor: '#fe2c55',
            background: '#1a1a1a',
            color: '#fff'
        });
    } catch (err) {
        Swal.fire('Erreur Importation TikFinity', err.message, 'error');
    }
}

window.importFromUrl = async (inputUrl) => {
    let url = inputUrl || '';
    if (!url) {
        const { value: pastedUrl } = await Swal.fire({
            title: 'Importer via URL TikFinity / Gentok',
            input: 'url',
            inputLabel: 'Collez le lien du profil TikFinity ou l\'URL du fichier JSON :',
            inputPlaceholder: 'ex: https://tikfinity.zerody.one/...',
            showCancelButton: true,
            confirmButtonText: 'Télécharger & Importer',
            cancelButtonText: 'Annuler',
            background: '#121316',
            color: '#fff',
            confirmButtonColor: 'var(--primary)'
        });
        url = pastedUrl;
    }

    if (!url || !url.trim()) return;
    url = url.trim();

    try {
        showToast('Téléchargement du profil...', 'info');

        const base = typeof isLocalMode !== 'undefined' && isLocalMode ? getLocalApiBase() : getApiBase();
        const res = await fetch(`${base}/api/proxy-import?url=${encodeURIComponent(url)}`);

        if (!res.ok) {
            throw new Error(`Impossible de télécharger le profil (Erreur ${res.status}).`);
        }

        const jsonText = await res.text();
        let data;
        try {
            data = JSON.parse(jsonText);
        } catch (e) {
            throw new Error("Le contenu téléchargé n'est pas un fichier JSON valide.");
        }

        if (data.app === 'Gentok' || data.type === 'gentok_actions' || data.type === 'gentok_events') {
            if (data.actions && Array.isArray(data.actions)) {
                currentActions = mergeUniqueItems(currentActions, data.actions);
            }
            if (data.events && Array.isArray(data.events)) {
                currentEvents = mergeUniqueItems(currentEvents, data.events);
            }
            await saveCurrentConfig();
            renderActions();
            renderEvents();
            if (typeof renderSoundboard === 'function') renderSoundboard();
            showToast('Profil Gentok importé avec succès via URL !', 'success');
        } else {
            await processTikFinityImport(jsonText);
        }
    } catch (err) {
        console.error("Import URL error:", err);
        Swal.fire('Erreur Importation URL', err.message || 'Lien invalide ou inaccessible.', 'error');
    }
};

function parseTikFinityData(data) {
    const importedActions = [];
    const importedEvents = [];
    const actionIdMap = new Map();

    let rawActions = [];
    if (Array.isArray(data)) {
        rawActions = data;
    } else if (Array.isArray(data.actions)) {
        rawActions = data.actions;
    } else if (Array.isArray(data.actionList)) {
        rawActions = data.actionList;
    } else if (Array.isArray(data.soundboard)) {
        rawActions = data.soundboard;
    }

    let rawEvents = [];
    if (Array.isArray(data.events)) {
        rawEvents = data.events;
    } else if (Array.isArray(data.triggerList)) {
        rawEvents = data.triggerList;
    } else if (Array.isArray(data.triggers)) {
        rawEvents = data.triggers;
    }

    rawActions.forEach((item, idx) => {
        if (!item || item.isDeleted) return;

        const gentokId = `act_tf_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`;
        if (item.id) actionIdMap.set(String(item.id), gentokId);

        let gentokType = 'keyboard';
        const typeStr = String(item.type || item.action_type || '').toLowerCase();

        if (item.webhookUrl || typeStr.includes('web') || typeStr.includes('http')) {
            gentokType = 'webhook';
        } else if (item.mcCmd || typeStr.includes('rcon') || typeStr.includes('minecraft')) {
            gentokType = 'rcon';
        } else if (item.audioUrl || typeStr.includes('sound') || typeStr.includes('audio')) {
            gentokType = 'sound';
        } else if (item.keystrokes || typeStr.includes('key') || typeStr.includes('keyboard')) {
            gentokType = 'keyboard';
        }

        const vol = (item.dynamicConfig && item.dynamicConfig.mediaSoundVolume !== undefined)
            ? (item.dynamicConfig.mediaSoundVolume / 100)
            : (item.volume !== undefined ? item.volume : 1.0);

        const newAction = {
            id: gentokId,
            name: item.name || item.title || `Action TikFinity ${idx + 1}`,
            type: gentokType,
            key: item.keystrokes || item.key || item.shortcut || item.value || '{SPACE}',
            command: item.mcCmd || item.command || item.cmd || '',
            url: item.webhookUrl || item.url || item.endpoint || '',
            soundUrl: item.audioUrl || item.soundUrl || item.path || '',
            soundName: item.name || item.soundName || 'Son TikFinity',
            duration: item.duration || 100,
            volume: vol
        };

        importedActions.push(newAction);

        // If action has audioUrl AND another primary action type (like webhook or mcCmd), also preserve audio in Soundboard
        if (item.audioUrl && gentokType !== 'sound') {
            const soundId = `snd_tf_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`;
            importedActions.push({
                id: soundId,
                name: `${item.name || 'Son'} (Audio)`,
                type: 'sound',
                soundUrl: item.audioUrl,
                soundName: item.name || 'Audio TikFinity',
                volume: vol
            });
        }
    });

    rawEvents.forEach((item, idx) => {
        if (!item) return;

        const gentokEvtId = `evt_tf_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`;
        let triggerType = item.triggerType || item.trigger_type || item.event_type || 'gift';
        triggerType = String(triggerType).toLowerCase();

        if (triggerType.includes('gift')) triggerType = 'gift';
        else if (triggerType.includes('like')) triggerType = 'like';
        else if (triggerType.includes('follow')) triggerType = 'follow';
        else if (triggerType.includes('sub')) triggerType = 'subscribe';
        else if (triggerType.includes('chat') || triggerType.includes('command')) triggerType = 'command';

        const linkedActionIds = [];
        if (item.action_id || item.actionId) {
            const mapped = actionIdMap.get(String(item.action_id || item.actionId));
            if (mapped) linkedActionIds.push(mapped);
        }
        if (Array.isArray(item.actions)) {
            item.actions.forEach(aId => {
                const mapped = actionIdMap.get(String(aId));
                if (mapped) linkedActionIds.push(mapped);
                else if (typeof aId === 'string' && aId.startsWith('act_')) linkedActionIds.push(aId);
            });
        }

        const newEvent = {
            id: gentokEvtId,
            name: item.name || `Événement TikFinity ${idx + 1}`,
            active: item.active !== false,
            triggerType: triggerType,
            giftId: item.gift_id || item.giftId || '',
            giftName: item.gift_name || item.giftName || '',
            command: item.command || item.keyword || '',
            actions: linkedActionIds
        };

        importedEvents.push(newEvent);
    });

    return { actions: importedActions, events: importedEvents };
}

function mergeUniqueItems(existingArray = [], newItems = []) {
    const map = new Map();
    existingArray.forEach(item => map.set(item.id || item.name, item));
    newItems.forEach(item => {
        const key = item.id || item.name;
        if (!map.has(key)) {
            map.set(key, item);
        }
    });
    return Array.from(map.values());
}

window.exportEventsOnly = () => {
    try {
        const payload = {
            type: 'gentok_events',
            exportDate: new Date().toISOString(),
            events: currentEvents || []
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gentok_evenements_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Événements exportés avec succès !', 'success');
    } catch (e) {
        showToast(`Erreur export événements: ${e.message}`, 'error');
    }
};

window.triggerImportEventsOnly = () => {
    const input = document.getElementById('input-import-events');
    if (input) input.click();
};

window.importEventsOnlyFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const eventsToImport = Array.isArray(data) ? data : (data.events || []);
            if (!Array.isArray(eventsToImport) || eventsToImport.length === 0) {
                throw new Error("Aucun événement trouvé dans ce fichier.");
            }
            currentEvents = mergeUniqueItems(currentEvents, eventsToImport);
            await saveCurrentConfig();
            renderEvents();
            showToast(`${eventsToImport.length} Événement(s) importé(s) avec succès !`, 'success');
        } catch (err) {
            Swal.fire('Erreur Événements', err.message, 'error');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
};

// [REAL-TIME DASHBOARD SOCKET]
function initDashboardRealtimeSocket() {
    const token = localStorage.getItem('gentok_token');
    if (!token || typeof io === 'undefined') return;

    try {
        const socket = io();
        window.dashboardSocket = socket;

        socket.on('connect', () => {
            socket.emit('identify', { token: token, type: 'dashboard' });
        });

        // Real-Time Likes Goal Update on Dashboard
        socket.on('likes_goal_update', (goal) => {
            if (!goal) return;
            const previewCount = document.getElementById('likes-preview-count');
            const previewFill = document.getElementById('likes-bar-fill-preview');
            const previewFooter = document.getElementById('likes-preview-footer');

            if (goal.count !== undefined && goal.goal !== undefined) {
                const countStr = `${goal.count.toLocaleString()} / ${goal.goal.toLocaleString()}`;
                if (previewCount) previewCount.textContent = countStr;
                if (previewFill) {
                    const percent = Math.min((goal.count / goal.goal) * 100, 100);
                    previewFill.style.width = `${percent}%`;
                }
                if (previewFooter) {
                    const remaining = Math.max(goal.goal - goal.count, 0);
                    previewFooter.textContent = remaining > 0 ? `Plus que ${remaining.toLocaleString()} likes !` : 'Objectif Atteint !';
                }
            }
        });

        // Real-Time Session Stats (Likes, Coins, Viewers, Diamonds) on Dashboard
        socket.on('session_stats', (stats) => {
            if (!stats) return;

            if (typeof stats.likes === 'number') {
                const likesElements = document.querySelectorAll('.dash-live-likes, #stat-likes-val, #dash-likes-count');
                likesElements.forEach(el => { el.textContent = stats.likes.toLocaleString(); });
            }
            if (typeof stats.diamonds === 'number') {
                const diamondsElements = document.querySelectorAll('.dash-live-diamonds, #stat-diamonds-val, #dash-diamonds-count');
                diamondsElements.forEach(el => { el.textContent = stats.diamonds.toLocaleString(); });
            }
            if (typeof stats.viewerCount === 'number') {
                const viewersElements = document.querySelectorAll('.dash-live-viewers, #stat-viewers-val, #dash-viewers-count');
                viewersElements.forEach(el => { el.textContent = stats.viewerCount.toLocaleString(); });
            }
        });
    } catch (e) {
        console.error('Error initializing dashboard realtime socket:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initDashboardRealtimeSocket();
});
