const APP_VERSION = (() => { try { return require('../../package.json').version; } catch (e) { return null; } })();
const io = require('socket.io-client');
const config = require('../config');
const logger = require('./logger');
const { pressKey } = require('../actions/keyboardAction');
const { sendRconCommand } = require('../actions/rconAction');

let socket = null;
const LOCAL_API = `http://localhost:${process.env.PORT || 3000}`;

/**
 * Initializes a connection to the remote server to listen for remote commands.
 * This should only be called when running in EXE (App) mode.
 */
function initRemoteClient() {
    if (!config.isAppMode) return;
    if (!config.licenseToken) {
        logger.warn('⚠️ RemoteClient: No license token found, waiting for auth...');
        return;
    }

    const serverUrl = config.remoteServerUrl;
    logger.info(`🌐 Application connecting to remote server: ${serverUrl} with token: ${config.licenseToken.substring(0, 8)}...`);

    socket = io(serverUrl, {
        reconnection: true,
        reconnectionDelay: 5000,
        auth: {
            token: config.licenseToken
        }
    });

    socket.on('connect', () => {
        logger.info('✅ Application connected to remote server.');

        // Identify as an "app" for this token (with the version, shown on the website)
        socket.emit('identify', {
            token: config.licenseToken,
            type: 'app',
            version: APP_VERSION
        });
    });

    // The scene, its events or its actions were changed from the dashboard: reload them for the live
    let reloadTimer = null;
    socket.on('app_reload_session', () => {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(async () => {
            try {
                if (!config.licenseToken) return;
                await config.loadSession(config.licenseToken);
                logger.info('🔄 Scène / actions / événements rechargés depuis le tableau de bord.');
            } catch (e) {
                logger.warn(`⚠️ Rechargement de la scène impossible : ${e.message}`);
            }
        }, 400);
    });

    socket.on('remote_keyboard', (data) => {
        logger.info(`📥 Remote Key received from VPS: ${data.key} (dur: ${data.duration || 100}ms)`);
        // FORCE EXECUTION: Even if local detection (isAppMode) is shaky,
        // we execute because the order came reliably from the VPS.
        pressKey(data.key, true, data.duration || 100);
    });

    socket.on('play_audio', (data) => {
        logger.info(`📥 Remote Audio received: ${data.title}`);
        // The dashboard window already plays audio via its own socket connection.
    });

    socket.on('remote_start', async (data) => {
        logger.info(`🛰️ Remote Start Command for ${data.username}`);
        try {
            const axios = require('axios');
            // Call local API to start the connector
            await axios.post(`${LOCAL_API}/api/start`, { username: data.username });
        } catch (e) {
            logger.error(`🚨 Error executing remote start: ${e.message}`);
        }
    });

    socket.on('remote_stop', async () => {
        logger.info('🛰️ Remote Stop Command received');
        try {
            const axios = require('axios');
            await axios.post(`${LOCAL_API}/api/stop`);
        } catch (e) {
            logger.error(`🚨 Error executing remote stop: ${e.message}`);
        }
    });

    socket.on('remote_stats_reset', async (data) => {
        logger.info(`🛰️ Remote Stats Reset Command received: ${data.type}`);
        try {
            const axios = require('axios');
            await axios.post(`${LOCAL_API}/api/stats/reset`, { type: data.type });
        } catch (e) {
            logger.error(`🚨 Error executing remote stats reset: ${e.message}`);
        }
    });

    socket.on('remote_rcon', async (data) => {
        logger.info(`📥 Remote RCON Command received: ${data.command}`);
        try {
            await sendRconCommand(data.command, data.settings);
        } catch (e) {
            logger.error(`🚨 Error executing remote RCON: ${e.message}`);
        }
    });

    socket.on('remote_obs', async (data) => {
        try {
            const { runObsAction } = require('../actions/obsAction');
            await runObsAction(data.action || {}, data.settings || {});
        } catch (e) {
            logger.error(`🚨 Error executing remote OBS action: ${e.message}`);
        }
    });

    socket.on('remote_streamerbot', async (data) => {
        try {
            const { runStreamerbotAction } = require('../actions/streamerbotAction');
            await runStreamerbotAction(data.payload, data.settings || {});
        } catch (e) {
            logger.error(`🚨 Error executing remote Streamer.bot action: ${e.message}`);
        }
    });

    socket.on('disconnect', () => {
        logger.warn('❌ Application disconnected from remote server.');
    });

    socket.on('error', (err) => {
        logger.error(`🚨 RemoteClient Socket Error: ${err.message}`);
    });
}

/**
 * Re-authenticates the client if the token changes
 */
function reauthRemoteClient() {
    // If socket is not initialized (e.g. started without token), init it now
    if (!socket) {
        logger.info('🔄 RemoteClient: Initializing socket after login...');
        initRemoteClient();
        return;
    }

    if (socket && socket.connected && config.licenseToken) {
        socket.emit('identify', {
            token: config.licenseToken,
            type: 'app',
            version: APP_VERSION
        });
    }
}

function emitRemote(event, data) {
    // Auto-init if missing but we have a token (Robustness)
    if (!socket && config.licenseToken) {
        // console.log('[RemoteClient] Socket missing but token found. Auto-initializing...');
        initRemoteClient();
    }

    if (socket && socket.connected) {
        // console.log(`[RemoteClient] Relaying ${event}...`);
        socket.emit(event, data);
    } else {
        if (!socket) {
            // Only log non-spammy events or once per type to avoid flood
            if (event !== 'session_stats' && event !== 'stats' && event !== 'log') {
                console.warn(`⚠️ [RemoteClient] Cannot emit '${event}': Socket null`);
            }
        }
        else if (event !== 'log' && event !== 'session_stats') {
            console.warn(`⚠️ [RemoteClient] Cannot emit '${event}': Socket disconnected`);
        }
    }
}

module.exports = { initRemoteClient, reauthRemoteClient, emitRemote };
