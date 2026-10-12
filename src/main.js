const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer, stopAllConnectors } = require('./server');
const logger = require('./utils/logger');
const axios = require('axios');
const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');
const DiscordRPC = require('discord-rpc');

let mainWindow = null;
let ipcHandlersRegistered = false; // ipcMain.handle() throws if a channel is registered twice
const PORT = process.env.PORT || 3000;

// Only web pages (https) can be opened in the browser from the dashboard
function isExternalAllowed(url) {
    try {
        return new URL(url).protocol === 'https:';
    } catch (e) {
        return false;
    }
}

// Sends a message to the dashboard window only if it still exists
function sendToWindow(channel, payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, payload);
    }
}

// Configure autoUpdater
autoUpdater.autoDownload = true; // [AUTO] Download immediately
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

// Last known state of the updater: the launcher and the dashboard ask for it when they load,
// so an update found before they were displayed is never missed.
// status: idle | checking | downloading | downloaded | up-to-date | error | dev
let updateState = { status: 'idle', version: null, percent: 0, current: app.getVersion(), checkedAt: null };
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

function setUpdateState(patch) {
    updateState = { ...updateState, ...patch };
    sendToWindow('update-state', updateState);
}

async function checkForUpdates() {
    if (!app.isPackaged) {
        // electron-updater only works in the installed app
        setUpdateState({ status: 'dev', checkedAt: Date.now() });
        return updateState;
    }
    if (['downloading', 'downloaded'].includes(updateState.status)) return updateState;
    try {
        await autoUpdater.checkForUpdates();
    } catch (err) {
        logger.error(`❌ Vérification des mises à jour impossible : ${err.message}`);
        setUpdateState({ status: 'error', error: err.message, checkedAt: Date.now() });
    }
    return updateState;
}

function setupAutoUpdater() {
    autoUpdater.on('checking-for-update', () => {
        logger.info('🔍 Vérification des mises à jour...');
        setUpdateState({ status: 'checking', error: null });
    });

    autoUpdater.on('update-available', (info) => {
        logger.info(`📦 Mise à jour disponible : ${info.version}. Téléchargement automatique...`);
        setUpdateState({ status: 'downloading', version: info.version, percent: 0, checkedAt: Date.now() });
        sendToWindow('update-available', info);
        // Window is hidden by default, we'll show it only to show progress if needed
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
    });

    autoUpdater.on('update-not-available', () => {
        logger.info('✅ Application à jour.');
        setUpdateState({ status: 'up-to-date', checkedAt: Date.now() });
        // If no update, we can safely show the dashboard
        if (mainWindow && !mainWindow.isVisible()) {
            mainWindow.show();
        }
    });

    autoUpdater.on('error', (err) => {
        const is404 = err.message && (err.message.includes('404') || err.message.includes('latest.yml'));
        if (is404) {
            logger.info('ℹ️ Aucun fichier de mise à jour trouvé (Normal).');
            setUpdateState({ status: 'up-to-date', checkedAt: Date.now() });
        } else {
            logger.error(`❌ Erreur Auto-Updater : ${err.message}`);
            setUpdateState({ status: 'error', error: err.message, checkedAt: Date.now() });
            sendToWindow('update-error', err.message);
        }
        // Even on error, we show the app so the user isn't stuck
        if (mainWindow && !mainWindow.isVisible()) {
            mainWindow.show();
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        setUpdateState({ status: 'downloading', percent: Math.floor(progressObj.percent || 0) });
        sendToWindow('update-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
        logger.info('✅ Mise à jour prête. Notification et installation...');
        setUpdateState({ status: 'downloaded', version: info.version, percent: 100 });

        // Native Notification BEFORE quit
        const { Notification } = require('electron');
        if (Notification.isSupported()) {
            new Notification({
                title: 'Gentok',
                body: 'Votre app va être mise à jour...',
                icon: path.join(__dirname, '../public/logo.png')
            }).show();
        }

        sendToWindow('update-downloaded', info);

        // Auto-install after 4 seconds to let the user see the notification/UI message
        setTimeout(() => {
            autoUpdater.quitAndInstall(false, true);
        }, 4000);
    });

    // Listen for UI commands (Fallback)
    ipcMain.handle('start-download', () => {
        autoUpdater.downloadUpdate();
    });

    ipcMain.handle('restart-app', () => {
        autoUpdater.quitAndInstall();
    });

    ipcMain.handle('clear-app-session', async () => {
        const { session } = require('electron');
        await session.defaultSession.clearStorageData({
            storages: ['cookies', 'localstorage', 'indexdb']
        });
        return true;
    });

    ipcMain.handle('get-app-version', () => {
        return app.getVersion();
    });

    ipcMain.handle('open-external', (event, url) => {
        if (!isExternalAllowed(url)) return false;
        shell.openExternal(url);
        return true;
    });

    ipcMain.handle('get-update-state', () => updateState);
    ipcMain.handle('check-for-updates', () => checkForUpdates());

    ipcMain.handle('update-rpc', (event, data) => {
        updateRPC(data);
    });
}

// ==========================================
// [NEW] DISCORD RICH PRESENCE
// ==========================================
const clientId = '1481929370355630120'; // Discord application ID (public, not a secret)
DiscordRPC.register(clientId);

const rpc = new DiscordRPC.Client({ transport: 'ipc' });
let rpcReady = false;

async function updateRPC(data) {
    if (!rpcReady) return;

    try {
        await rpc.setActivity({
            details: data.details || 'Navigation...',
            state: data.state || 'Dans les menus',
            startTimestamp: data.startTimestamp || undefined,
            largeImageKey: 'gentok',
            largeImageText: 'Gentok - TikTok',
            smallImageKey: data.smallImageKey || undefined,
            smallImageText: data.smallImageText || undefined,
            instance: false,
        });
    } catch (err) {
        logger.error(`🚨 Discord RPC Error: ${err.message}`);
    }
}

rpc.on('ready', () => {
    rpcReady = true;
    logger.info('🎮 Discord Rich Presence: Prêt.');
    updateRPC({ details: 'Au menu principal', state: 'Prêt à configurer' });
});

rpc.login({ clientId }).catch(err => {
    logger.warn(`⚠️ Discord RPC Login Failed: ${err.message}`);
});

/**
 * Creates the main application window.
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Gentok',
        show: false, // Don't show immediately
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../public/logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
            allowRunningInsecureContent: true
        }
    });

    // Payment pages and external links open in the user's browser, never inside the app window
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isExternalAllowed(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (e, url) => {
        if (/^https:\/\/checkout\.stripe\.com\//.test(url)) {
            e.preventDefault();
            shell.openExternal(url);
        }
    });

    const registerHandlers = !ipcHandlersRegistered;
    ipcHandlersRegistered = true;
    if (registerHandlers) setupAutoUpdater();

    // [CACHE CLEAR] Clear cache AND cookies on startup to ensure fresh TikTok connection
    const { session } = require('electron');
    session.defaultSession.clearCache();
    session.defaultSession.clearStorageData({
        storages: ['cookies', 'indexdb']  // Exclude 'localstorage' to preserve Spotify token
    });

    // Start the Express server and WAIT for it to be ready
    logger.info('🚀 Démarrage du serveur interne...');
    startServer().then(() => {
        // Load the Launcher (Splash Screen) from LOCAL server when ready
        const launcherUrl = `http://localhost:${PORT}/launcher.html?mode=app`;
        logger.info(`🌐 Chargement du launcher local : ${launcherUrl}`);
        mainWindow.loadURL(launcherUrl);
        mainWindow.show(); // [NEW] Show window immediately to see the launcher progress
    }).catch(err => {
        logger.error(`🚨 Fatal: Le serveur interne n'a pas pu démarrer: ${err.message}`);
        const { dialog } = require('electron');
        dialog.showErrorBox('Gentok', `Le serveur interne n'a pas pu démarrer :\n${err.message}`);
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    // ==========================================
    // [AUTOMATED] MINECRAFT GENTOK BOX
    // ==========================================
    const GENTOK_DIR = path.join(app.getPath('appData'), 'Gentok');
    const MC_DIR = path.join(GENTOK_DIR, 'minecraft', 'GentokBoxTNT');
    const { exec, spawn } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Helper: Download a file
    async function downloadFile(url, dest, event, label) {
        event.sender.send('mc-log', `Téléchargement de ${label}...`);
        const writer = fs.createWriteStream(dest);
        const response = await axios({ url, method: 'GET', responseType: 'stream' });

        let lastLogged = 0;
        let downloaded = 0;
        const total = parseInt(response.headers['content-length'] || 0);

        return new Promise((resolve, reject) => {
            response.data.on('data', (chunk) => {
                downloaded += chunk.length;
                const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
                if (percent % 10 === 0 && percent !== lastLogged) {
                    event.sender.send('mc-log', `${label}: ${percent}%`);
                    lastLogged = percent;
                }
            });
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }

    // Everything below registers IPC handlers: only do it for the first window
    if (!registerHandlers) return;

    ipcMain.handle('install-jdk21', async (event) => {
        logger.info('🛠️ Starting real JDK 21 Installation...');
        if (!fs.existsSync(MC_DIR)) fs.mkdirSync(MC_DIR, { recursive: true });

        const jdkZip = path.join(MC_DIR, 'jdk.zip');
        const jdkExtractDir = path.join(MC_DIR, 'jdk21');

        // Temurin JDK 21 - Windows x64 Zip
        const jdkUrl = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_x64_windows_hotspot_21.0.1_12.zip';

        try {
            await downloadFile(jdkUrl, jdkZip, event, 'JDK 21');

            event.sender.send('mc-log', 'Extraction du JDK (Ceci peut prendre une minute)...');
            if (!fs.existsSync(jdkExtractDir)) fs.mkdirSync(jdkExtractDir, { recursive: true });

            // Use native tar available on Windows 10+
            await execAsync(`tar -xf "${jdkZip}" -C "${jdkExtractDir}"`);

            fs.unlinkSync(jdkZip); // Cleanup
            event.sender.send('mc-log', '✅ JDK 21 Installé avec succès.');
            return { success: true };
        } catch (e) {
            logger.error(`🚨 JDK Install Error: ${e.message}`);
            event.sender.send('mc-log', `❌ Erreur JDK: ${e.message}`);
            throw e;
        }
    });

    async function runMinecraftSetup(event) {
        logger.info('🛠️ Preparing GentokBoxTNT Server...');
        if (!fs.existsSync(MC_DIR)) fs.mkdirSync(MC_DIR, { recursive: true });

        try {
            // 1. Download Gentok Pack RAR
            const rarUrl = 'https://tiktok.gentok.fr/GentokBoxTNT.rar';
            const rarDest = path.join(MC_DIR, 'GentokBoxTNT.rar');
            await downloadFile(rarUrl, rarDest, event, 'GentokBoxTNT (Base Pack)');

            // 2. Extract Pack
            event.sender.send('mc-log', 'Extraction du pack GentokBoxTNT...');
            try {
                await execAsync(`tar -xf "${rarDest}" -C "${MC_DIR}"`);
                event.sender.send('mc-log', '✅ Extraction terminée.');

                // Check subfolder
                const subfolder = path.join(MC_DIR, 'GentokBoxTNT');
                if (fs.existsSync(subfolder) && fs.lstatSync(subfolder).isDirectory()) {
                    const files = fs.readdirSync(subfolder);
                    for (const file of files) {
                        try { fs.renameSync(path.join(subfolder, file), path.join(MC_DIR, file)); } catch (e) { }
                    }
                    try { fs.rmdirSync(subfolder); } catch (e) { }
                }
            } catch (tarError) {
                logger.warn(`Tar extraction failed: ${tarError.message}`);
                event.sender.send('mc-log', '⚠️ Tentative via PowerShell...');
                await execAsync(`powershell -Command "Expand-Archive -Path '${rarDest}' -DestinationPath '${MC_DIR}' -Force"`).catch(() => { });
            }
            if (fs.existsSync(rarDest)) fs.unlinkSync(rarDest);

            // 3. Download LATEST Paper Spigot
            event.sender.send('mc-log', 'Mise à jour vers la dernière version de Paper...');
            const projectsApi = await axios.get('https://api.papermc.io/v2/projects/paper');
            const latestVersion = projectsApi.data.versions[projectsApi.data.versions.length - 1];

            const versionApi = await axios.get(`https://api.papermc.io/v2/projects/paper/versions/${latestVersion}`);
            const latestBuild = versionApi.data.builds[versionApi.data.builds.length - 1];

            const paperUrl = `https://api.papermc.io/v2/projects/paper/versions/${latestVersion}/builds/${latestBuild}/downloads/paper-${latestVersion}-${latestBuild}.jar`;
            await downloadFile(paperUrl, path.join(MC_DIR, 'server.jar'), event, `Paper ${latestVersion}`);

            // 4. Finalize
            fs.writeFileSync(path.join(MC_DIR, 'eula.txt'), 'eula=true');
            event.sender.send('mc-log', `✅ Serveur GentokBoxTNT prêt.`);
            return { success: true };
        } catch (e) {
            logger.error(`🚨 Setup Error: ${e.message}`);
            event.sender.send('mc-log', `❌ Erreur Préparation: ${e.message}`);
            throw e;
        }
    }

    ipcMain.handle('setup-minecraft-server', async (event) => {
        return await runMinecraftSetup(event);
    });

    let mcProcess = null;

    async function launchMinecraftServer(event, token) {
        if (mcProcess) return { success: false, message: 'Déjà en cours' };

        // [AUTO-PREPARE] Ensure server.jar exists before launching
        if (!fs.existsSync(path.join(MC_DIR, 'server.jar'))) {
            event.sender.send('mc-log', '⏳ Serveur non trouvé, téléchargement automatique...');
            await runMinecraftSetup(event);
        }

        // [TOKEN-INJECTION] 
        if (token) {
            try {
                const tokenDir = path.join(MC_DIR, 'plugins', 'GentokToken');
                const tokenFile = path.join(tokenDir, 'token.txt');
                if (!fs.existsSync(tokenDir)) fs.mkdirSync(tokenDir, { recursive: true });
                fs.writeFileSync(tokenFile, token.trim());
                event.sender.send('mc-log', '🔑 Token de session injecté dans le plugin.');
            } catch (err) {
                logger.error(`🚨 Token Injection Error: ${err.message}`);
            }
        }

        logger.info('🚀 Launching Minecraft Server...');
        event.sender.send('mc-log', 'Démarrage du processus Java local...');

        // Structure check: Temurin zip extracts to a subfolder like jdk-21.0.1+12
        const jdkBase = path.join(MC_DIR, 'jdk21');
        const subdirs = fs.existsSync(jdkBase) ? fs.readdirSync(jdkBase) : [];
        const jdkRoot = subdirs.find(d => d.includes('jdk'));
        const javaPath = jdkRoot ? path.join(jdkBase, jdkRoot, 'bin', 'java.exe') : 'java';

        event.sender.send('mc-log', `Utilisation de: ${javaPath}`);

        mcProcess = spawn(javaPath, ['-Xmx2G', '-jar', 'server.jar', '--nogui'], { cwd: MC_DIR });

        mcProcess.on('error', (err) => {
            // e.g. Java not installed: without this handler the whole app crashes
            logger.error(`🚨 Minecraft process error: ${err.message}`);
            event.sender.send('mc-log', `❌ Impossible de lancer Java : ${err.message}`);
            mcProcess = null;
        });

        mcProcess.stdout.on('data', (data) => {
            const line = data.toString().trim();
            if (line) event.sender.send('mc-log', line);
            if (line.includes('Done')) {
                event.sender.send('mc-status', { paper: 'online', servertap: 'connected' });
            }
        });

        mcProcess.stderr.on('data', (data) => {
            event.sender.send('mc-log', `[ERR] ${data.toString()}`);
        });

        mcProcess.on('close', (code) => {
            mcProcess = null;
            event.sender.send('mc-log', `Le serveur s'est arrêté (Code: ${code})`);
            event.sender.send('mc-status', { paper: 'offline', servertap: 'disconnected' });
        });

        return { success: true };
    }

    ipcMain.handle('start-minecraft-server', async (event, token) => {
        return await launchMinecraftServer(event, token);
    });

    ipcMain.handle('get-minecraft-path', async () => {
        return MC_DIR;
    });

    ipcMain.handle('is-minecraft-installed', async () => {
        return fs.existsSync(path.join(MC_DIR, 'server.jar'));
    });

    ipcMain.handle('send-minecraft-command', async (event, command) => {
        if (!mcProcess) return { success: false, message: 'Le serveur n\'est pas lancé' };
        // One command per call: a line break would let a single call run several commands
        mcProcess.stdin.write(String(command).replace(/[\r\n]+/g, ' ') + '\n');
        return { success: true };
    });

    ipcMain.handle('stop-minecraft-server', async () => {
        if (!mcProcess) return { success: true };

        logger.info('🛑 Stopping Minecraft Server...');
        mcProcess.stdin.write('stop\n');

        // Timeout to force kill if it doesn't stop
        const killTimeout = setTimeout(() => {
            if (mcProcess) {
                logger.warn('⚠️ Server shutdown taking too long, killing process...');
                mcProcess.kill();
                mcProcess = null;
            }
        }, 15000);

        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!mcProcess) {
                    clearTimeout(killTimeout);
                    clearInterval(checkInterval);
                    resolve({ success: true });
                }
            }, 500);
        });
    });

    ipcMain.handle('restart-minecraft-server', async (event, token) => {
        if (mcProcess) {
            event.sender.send('mc-log', '🔄 Redémarrage demandé...');
            // Use the same stop logic
            mcProcess.stdin.write('stop\n');
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    if (mcProcess) {
                        mcProcess.kill();
                        mcProcess = null;
                        resolve();
                    }
                }, 10000);
                const check = setInterval(() => {
                    if (!mcProcess) {
                        clearTimeout(timeout);
                        clearInterval(check);
                        resolve();
                    }
                }, 500);
            });
        }
        // Now it's stopped (or wasn't running), let's start it
        return await launchMinecraftServer(event, token);
    });

    ipcMain.handle('open-minecraft-folder', async () => {
        const { shell } = require('electron');
        if (fs.existsSync(MC_DIR)) {
            shell.openPath(MC_DIR);
            return { success: true };
        }
        return { success: false, message: 'Dossier non trouvé' };
    });

    ipcMain.handle('uninstall-minecraft-server', async () => {
        if (mcProcess) {
            return { success: false, message: 'Veuillez d\'abord arrêter le serveur' };
        }
        try {
            if (fs.existsSync(MC_DIR)) {
                fs.rmSync(MC_DIR, { recursive: true, force: true });
                return { success: true };
            }
            return { success: false, message: 'Déjà désinstallé' };
        } catch (e) {
            logger.error(`🚨 Uninstall Error: ${e.message}`);
            return { success: false, message: e.message };
        }
    });
}

/**
 * Initialization and Lifecycle
 */
app.on('ready', async () => {
    // [CRITICAL] Set Name and App ID for Windows notifications to work
    app.name = 'Gentok';
    if (process.platform === 'win32') {
        app.setAppUserModelId('electron.gentok');
    }

    createWindow();

    // Check for updates now, then every 30 minutes (a stream can last hours)
    logger.info(`🚀 Gentok v${app.getVersion()} - Vérification initiale des mises à jour...`);
    checkForUpdates();
    setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);
});

// Closing the app during a live: stop the connection first so the live is saved in the history
let quitting = false;
app.on('before-quit', (e) => {
    if (quitting) return;
    quitting = true;
    e.preventDefault();
    const timeout = new Promise(r => setTimeout(r, 5000));
    Promise.race([stopAllConnectors(), timeout]).catch(() => { }).finally(() => app.quit());
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

process.on('uncaughtException', (err) => {
    logger.error(`💥 Exception Electron Non Gérée : ${err.message}`);
});
