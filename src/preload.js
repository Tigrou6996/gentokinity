const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Info version
    getVersion: () => process.versions.electron,
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Auto-updater events
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, info) => callback(info)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_event, progressObj) => callback(progressObj)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, info) => callback(info)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, message) => callback(message)),
    onUpdateState: (callback) => ipcRenderer.on('update-state', (_event, state) => callback(state)),
    getUpdateState: () => ipcRenderer.invoke('get-update-state'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

    // Opens an https page (Stripe checkout, help...) in the default browser
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Auto-updater commands
    startDownload: () => ipcRenderer.invoke('start-download'),
    restartApp: () => ipcRenderer.invoke('restart-app'),
    clearAppSession: () => ipcRenderer.invoke('clear-app-session'),

    // [NEW] Minecraft Box
    installJDK21: () => ipcRenderer.invoke('install-jdk21'),
    setupMinecraftServer: () => ipcRenderer.invoke('setup-minecraft-server'),
    startMinecraftServer: (token) => ipcRenderer.invoke('start-minecraft-server', token),
    restartMinecraftServer: (token) => ipcRenderer.invoke('restart-minecraft-server', token),
    stopMinecraftServer: () => ipcRenderer.invoke('stop-minecraft-server'),
    isMinecraftInstalled: () => ipcRenderer.invoke('is-minecraft-installed'),
    getMinecraftPath: () => ipcRenderer.invoke('get-minecraft-path'),
    sendMinecraftCommand: (command) => ipcRenderer.invoke('send-minecraft-command', command),
    openMinecraftFolder: () => ipcRenderer.invoke('open-minecraft-folder'),
    uninstallMinecraftServer: () => ipcRenderer.invoke('uninstall-minecraft-server'),
    onMinecraftLog: (callback) => ipcRenderer.on('mc-log', (_event, log) => callback(log)),
    onMinecraftStatus: (callback) => ipcRenderer.on('mc-status', (_event, status) => callback(status)),

    // [NEW] Discord RPC
    updateRPC: (data) => ipcRenderer.invoke('update-rpc', data)
});
