const { Server } = require("socket.io");

let io = null;
let onAppConnectedCallback = null;

// Track connected clients by token
// Structure: { [token]: { dashboard: [sockets], app: [sockets], status: 'offline' } }
const clientsByToken = {};
const appInfoByToken = {}; // token -> { version, since } of the connected desktop app
const socketCache = {}; // [NEW] Store last stats for remote apps (VPS side)

function initSocket(server) {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        let identifiedToken = null;
        let identifiedType = 'dashboard';

        socket.on('identify', async (data) => {
            const { token, type } = data; // type: 'dashboard' or 'app'
            if (!token || token.length < 8) {
                console.warn(`⚠️ [Socket] Tentative d'identification invalide (Token: ${token})`);
                return;
            }

            identifiedToken = token;
            identifiedType = type || 'dashboard';

            if (!clientsByToken[token]) {
                clientsByToken[token] = { dashboard: [], app: [], overlay: [], status: 'offline' };
            }

            // MUTUAL EXCLUSION LOGIC
            if (identifiedType === 'app') {
                // 1. Kick any existing Dashboards for this token
                if (clientsByToken[token].dashboard.length > 0) {
                    clientsByToken[token].dashboard.forEach(socketId => {
                        const s = io.sockets.sockets.get(socketId);
                        if (s) s.emit('session_duplicate', { message: 'L\'application (EXE) est connectée. Veuillez utiliser l\'application.' });
                    });
                }

                // 2. STOP any existing VPS Live Connector for this token
                if (onAppConnectedCallback) {
                    onAppConnectedCallback(token);
                }

                // Add App socket (and remember its version for the "application detected" badge)
                clientsByToken[token].app.push(socket.id);
                appInfoByToken[token] = {
                    version: String(data.version || '').replace(/[^0-9a-zA-Z.-]/g, '').slice(0, 20) || null,
                    since: Date.now()
                };

                socket.join(`room:${token}`);
                socket.join(`app:${token}`);

                // Notify that app is online
                io.to(`room:${token}`).emit('app_status', 'online');
                io.to(`room:${token}`).emit('app_info', { connected: true, ...appInfoByToken[token] });

            } else if (identifiedType === 'overlay') {
                socket.join(`room:${token}`);
                if (!clientsByToken[token].overlay) clientsByToken[token].overlay = [];
                clientsByToken[token].overlay.push(socket.id);
            } else {
                // If Dashboard connects, check if App is already active
                if (clientsByToken[token].app.length > 0) {
                    socket.emit('session_duplicate', { message: 'L\'application (EXE) est déjà ouverte. Veuillez l\'utiliser.' });
                }

                // Check for duplicate dashboards
                if (clientsByToken[token].dashboard.length > 0) {
                    socket.emit('session_duplicate', { message: 'Une session est déjà ouverte dans un autre onglet.' });
                }

                clientsByToken[token].dashboard.push(socket.id);
                socket.join(`room:${token}`);
                socket.emit('session_active');
            }

            // [NEW] Send current session stats (live or persistent) immediately on identification
            sendInitialStats(socket, token);

            // [NEW] Send current status for this token specifically
            socket.emit('status', clientsByToken[token].status || 'offline');
        });

        // [NEW] Take Over Session Handler
        socket.on('take_over', (data) => {
            const { token } = data;
            if (!token) return;

            identifiedToken = token;
            identifiedType = 'dashboard';

            if (!clientsByToken[token]) clientsByToken[token] = { dashboard: [], app: [], overlay: [] };

            // 1. Kick dashboards
            clientsByToken[token].dashboard.forEach(socketId => {
                const s = io.sockets.sockets.get(socketId);
                if (s && s.id !== socket.id) {
                    s.emit('force_disconnect', { reason: 'taken_over', message: 'Session reprise dans un autre onglet.' });
                    s.leave(`room:${token}`);
                }
            });
            clientsByToken[token].dashboard = [socket.id];

            // 2. [INVERSE] Kick App if it was master
            if (clientsByToken[token].app.length > 0) {
                clientsByToken[token].app.forEach(socketId => {
                    const s = io.sockets.sockets.get(socketId);
                    if (s) {
                        s.emit('force_disconnect', { reason: 'taken_over', message: 'Le tableau de bord Web a repris la main.' });
                        s.leave(`room:${token}`);
                        s.leave(`app:${token}`);
                    }
                });
                clientsByToken[token].app = [];
            }

            // 3. Confirm success and send data
            socket.emit('session_active');
            sendInitialStats(socket, token);

            // Log it
            const msg = `🔌 Session reprise par ${socket.id}`;
            socket.emit('log', { level: 'system', message: msg, timestamp: new Date().toLocaleTimeString() });
        });



        // [RELAY] Allow App/Bot to broadcast updates to its own room on VPS
        const relayEvents = [
            'overlayUpdate',
            'lastEvent',
            'initialLastEvents',
            'session_stats',
            'stats',
            'leaderboard_sync',
            'likes_goal_update',
            'trackSkipped',
            'skipVoteUpdate',
            'notification',
            'notify',         // [NEW] Fixed missing overlay notification
            'chat',
            'sync_config',    // [NEW] Added for scene/config sync
            'remote_reload',   // [NEW] Added for overlay refresh
            'streamEnd',      // [NEW] Notify VPS of live end
            'log',            // [NEW] Sync logs to VPS dashboard
            'updateLeaderboard', // [NEW] Sync Legend details
            'displayGift',    // [NEW] Sync Legend displays
            'hideGift',       // [NEW] Sync Legend hides
            'status',         // [NEW] Relay status (online/offline) to VPS
            'tiktok_alert',   // follow / gift / sub / share alerts for the Alerts overlay
            'overlay_alert',  // "Alerte" actions
            'tts_speak',      // "Synthèse vocale" actions
            'wheel_spin',     // "Roue de la fortune" actions
            'points_score',   // !score
            'points_top',     // !top
            'points_levelup', // a viewer reached a new level
            'points_insufficient',
            'battle_update',  // team battles
            'battle_end',
            'coinmatch_update', // Coin Match (gift auction)
            'coinmatch_end',
            'overlay_command',  // dashboard buttons for an overlay (e.g. empty the gift jar)
            'giveaway_update',  // giveaway (prize draw)
            'giveaway_draw',
            'pointsdrop_update', // points drop
            'pointsdrop_catch',
            'emote',            // subscriber emotes (Emojify overlay)
            'donors_update',    // viewers in the live and their budget (Donateurs présents)
            'donor_arrived'
        ];

        relayEvents.forEach(eventName => {
            socket.on(eventName, (data) => {
                if (identifiedToken) {
                    // [NEW] Cache stats/events on VPS to help new clients sync immediately
                    if (eventName === 'session_stats') {
                        if (!socketCache[identifiedToken]) socketCache[identifiedToken] = {};
                        socketCache[identifiedToken].stats = data;
                    } else if (eventName === 'initialLastEvents') {
                        if (!socketCache[identifiedToken]) socketCache[identifiedToken] = {};
                        socketCache[identifiedToken].lastEvents = data;
                    } else if (eventName === 'likes_goal_update') {
                        if (!socketCache[identifiedToken]) socketCache[identifiedToken] = {};
                        socketCache[identifiedToken].likesGoal = data;
                    } else if (eventName === 'lastEvent' && data && data.type) {
                        // Patch individual last event into the cached map
                        if (!socketCache[identifiedToken]) socketCache[identifiedToken] = {};
                        if (!socketCache[identifiedToken].lastEvents) socketCache[identifiedToken].lastEvents = {};
                        socketCache[identifiedToken].lastEvents[data.type] = data.data;
                    }

                    io.to(`room:${identifiedToken}`).emit(eventName, data);
                }
            });
        });

        // [LEGENDS] Show/Hide Gift Legends
        socket.on('show_gift_legend', async (data) => {
            const { token, giftId, period } = data; // [NEW] periode support
            if (!token || !giftId) return;

            try {
                const Leaderboard = require('../models/Leaderboard');
                const { getFullGiftList } = require('./giftPrices');

                const giftField = (period === 'weekly' || period === 'week') ? 'weeklyGifts' : 'gifts';

                // 1. Get all donors
                const allDonors = await Leaderboard.find({
                    token,
                    [giftField]: { $exists: true }
                }).lean();

                const gifts = getFullGiftList();
                const gift = gifts.find(g => g.id.toString() === giftId.toString());

                if (!gift) return;

                // 2. Format data
                const giftDataMap = {};
                gifts.forEach(g => {
                    giftDataMap[g.id] = {
                        id: g.id,
                        name: g.name,
                        image: g.icon,
                        diamonds: g.price
                    };
                });

                const leaderboardData = {};
                allDonors.forEach(u => {
                    leaderboardData[u.uniqueId] = {
                        pseudo: u.uniqueId,
                        profile: u.profilePictureUrl,
                        gifts: u[giftField] ? (u[giftField].toObject ? u[giftField].toObject() : u[giftField]) : {}
                    };
                });

                // 3. Relay to overlay room
                emitEvent('updateLeaderboard', {
                    leaderboard: leaderboardData,
                    giftData: giftDataMap,
                    period: (period === 'weekly' || period === 'week') ? 'weekly' : 'all'
                }, token);
                emitEvent('displayGift', giftId, token);

            } catch (err) {
                console.error('Error broadcasting legend:', err);
            }
        });

        socket.on('hide_gift_legend', (data) => {
            if (identifiedToken) {
                emitEvent('hideGift', null, identifiedToken);
            }
        });

        socket.on('simulate_event', (eventData) => {
            if (identifiedToken) {
                const { type, data } = eventData;

                // 1. Leaderboard Simulations (Arrays)
                if (type === 'leaderboard-coins' || type === 'leaderboard-likes' || type === 'leaderboard') {
                    const key = (type === 'leaderboard-likes') ? 'topLikes' : 'topCoins';
                    const fakeStats = {};
                    fakeStats[key] = Array.isArray(data) ? data : [data];
                    emitEvent('session_stats', fakeStats, identifiedToken);
                }
                // 2. Top Widget Simulations (Objects)
                else if (type === 'top-gift' || type === 'top-streak') {
                    const key = type === 'top-gift' ? 'topGift' : 'topStreak';
                    const fakeStats = {};
                    fakeStats[key] = data;
                    emitEvent('session_stats', fakeStats, identifiedToken);
                }
                // 3. Standard Event Simulations (Like, Gift...)
                else {
                    // Enrich lastEvent
                    if (type === 'gift' && data && !data.giftIcon) {
                        const { getGiftIcon } = require('./giftPrices');
                        data.giftIcon = getGiftIcon(data);
                    }
                    emitEvent('lastEvent', { type, data }, identifiedToken);

                    // Also push a session_stats update for likes/gifts to simulate leaderboard movement
                    if (type === 'like' || type === 'gift') {
                        const fakeStats = {};
                        if (type === 'like') {
                            fakeStats.likes = (data.totalLikeCount || 100);
                            fakeStats.topLikes = [{ uniqueId: data.uniqueId, nickname: data.nickname || data.uniqueId, count: data.likeCount || 1 }];
                        } else {
                            fakeStats.gifts = 1;
                            fakeStats.topCoins = [{ uniqueId: data.uniqueId, nickname: data.nickname || data.uniqueId, coins: data.coins || 10, giftIcon: data.giftIcon }];
                        }
                        emitEvent('session_stats', fakeStats, identifiedToken);
                    }
                }
            }
        });

        // NOTE: 'remote_keyboard' / 'remote_rcon' are sent BY this server TO the desktop app
        // (handled in remoteClient.js). They must never be accepted from incoming sockets,
        // otherwise any page or LAN device could press keys / run commands on the PC.

        // [NEW] Relay Connection Commands (Dashboard -> App)
        socket.on('setUniqueId', async (data, callback) => {
            if (identifiedToken && identifiedType === 'dashboard') {
                // "Cloud" chosen in Settings > Connexion au live: the live starts on the Gentok servers (HTTP /api/start)
                let runMode = 'auto';
                try { runMode = (await require('../config').getSettings(identifiedToken)).runMode || 'auto'; } catch (e) { }
                if (runMode === 'cloud') {
                    if (callback) callback({ success: false, error: 'CLOUD_MODE' });
                } else if (isAppConnected(identifiedToken)) {
                    console.log(`📡 Relaying 'setUniqueId' for ${data.uniqueId} to connected app...`);
                    emitToApp(identifiedToken, 'remote_start', data);
                    if (callback) callback({ success: true, relayed: true });
                } else {
                    // Start normally on VPS if no app connected
                    // (But usually we want app to be the priority)
                    if (callback) callback({ success: false, error: 'NO_APP', message: "Aucune application locale n'est connectée pour le relais." });
                }
            }
        });

        socket.on('stop_live', (data) => {
            if (identifiedToken && identifiedType === 'dashboard') {
                if (isAppConnected(identifiedToken)) {
                    console.log(`🛑 Relaying 'stop_live' command to connected app...`);
                    emitToApp(identifiedToken, 'remote_stop', data);
                }
            }
        });

        const msg = `🔌 Client Dashboard connecté : ${socket.id}`;

        // Initial status emission handled in 'identify'

        socket.emit('log', { level: 'system', message: msg, timestamp: new Date().toLocaleTimeString() });

        // Removed global status emission - now handled in 'identify'

        // Stop connector when client disconnects (page closed/refreshed)
        socket.on('disconnect', () => {
            console.log(`🔌 Client déconnecté : ${socket.id}`);

            if (identifiedToken && clientsByToken[identifiedToken]) {
                const prevAppCount = clientsByToken[identifiedToken].app ? clientsByToken[identifiedToken].app.length : 0;

                if (clientsByToken[identifiedToken][identifiedType]) {
                    clientsByToken[identifiedToken][identifiedType] = clientsByToken[identifiedToken][identifiedType].filter(id => id !== socket.id);
                }

                // If it was the last app client, notify dashboards
                if (identifiedType === 'app' && prevAppCount > 0 && clientsByToken[identifiedToken].app.length === 0) {
                    delete appInfoByToken[identifiedToken];
                    io.to(`room:${identifiedToken}`).emit('app_status', 'offline');
                    io.to(`room:${identifiedToken}`).emit('app_info', { connected: false });
                }
            }
        });
    });

    return io;
}


// [NEW] Helper to send initial stats
async function sendInitialStats(socket, token) {
    try {
        const config = require('../config');
        const server = require('../server');

        // Get settings for likesGoal
        const settings = await config.getSettings(token);

        const stats = {
            topGift: settings.topGift || { coins: 0, uniqueId: 'PSEUDO', nickname: 'PSEUDO' },
            topStreak: settings.topStreak || { count: 0, uniqueId: 'PSEUDO', nickname: 'PSEUDO' },
            viewerCount: 0,
            viewerCountMax: 0,
            cumulativeViewers: 0,
            diamonds: 0,
            gifts: 0,
            likes: 0,
            shares: 0,
            follows: 0,
            chats: 0,
            // [FIX] Add Leaderboard Config to initial stats to avoid UI reset
            topCoinsTitle: settings.topCoins?.title || 'TOP COINS',
            topCoinsLimit: settings.topCoins?.limit || 10,
            topCoinsStyle: settings.topCoins?.style || 1,
            topCoinsTransparent: settings.topCoins?.transparent !== false,
            topCoinsShowTitle: settings.topCoins?.showTitle !== false,
            topCoinsRtl: settings.topCoins?.rtl === true,
            topLikesTitle: settings.topLikes?.title || 'TOP LIKES',
            topLikesLimit: settings.topLikes?.limit || 10,
            topLikesStyle: settings.topLikes?.style || 1,
            topLikesTransparent: settings.topLikes?.transparent !== false,
            topLikesShowTitle: settings.topLikes?.showTitle !== false,
            topLikesRtl: settings.topLikes?.rtl === true
        };

        // If there is an active connector for THIS token, use its live stats
        let lastEvents = settings.lastEvents || { follower: null, gift: null, subscriber: null, share: null, like: null, chat: null };

        if (server && server.getConnector) {
            const connector = server.getConnector(token);
            if (connector) {
                if (connector.stats) Object.assign(stats, connector.stats);
                if (connector.lastEvents) lastEvents = connector.lastEvents;
            } else if (socketCache[token]) {
                // [NEW] If no local connector but we have cached remote stats, use them
                if (socketCache[token].stats) Object.assign(stats, socketCache[token].stats);
                if (socketCache[token].lastEvents) lastEvents = socketCache[token].lastEvents;
            }
        }

        socket.emit('session_stats', stats);
        socket.emit('initialLastEvents', lastEvents);

        // [NEW] Use cache for likes goal too if available
        let finalLikesGoal = settings.likesGoal;
        if (socketCache[token] && socketCache[token].likesGoal) {
            finalLikesGoal = socketCache[token].likesGoal;
        }

        if (finalLikesGoal && finalLikesGoal.enabled) {
            socket.emit('likes_goal_update', finalLikesGoal);
        }
    } catch (e) {
        console.error('Error sending initial stats:', e);
    }
}


function getIO() {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
}

// Helper to emit logs to frontend
function emitLog(level, message, token = null) {
    if (io) {
        const payload = {
            level,
            message,
            timestamp: new Date().toLocaleTimeString()
        };
        const config = require('../config');
        if (token) {
            io.to(`room:${token}`).emit('log', payload);
        } else if (config.isAppMode) {
            // Desktop app: a single local user, broadcasting is fine
            io.emit('log', payload);
        }
        // On the shared VPS, token-less logs stay server-side: broadcasting them would
        // leak every streamer's activity to every connected dashboard.

        // [RELAY]
        try {
            if (config.isAppMode) {
                const { emitRemote } = require('./remoteClient');
                emitRemote('log', payload);
            }
        } catch (e) {
            console.error('Relay Error:', e.message);
        }
    }
}

// Helper to emit stats
function emitStats(type, data, token = null) {
    if (io) {
        const payload = { type, data };
        if (token) {
            io.to(`room:${token}`).emit('stats', payload);
        } else {
            io.emit('stats', payload);
        }

        // [RELAY]
        try {
            const config = require('../config');
            if (config.isAppMode) {
                const { emitRemote } = require('./remoteClient');
                emitRemote('stats', payload);
            }
        } catch (e) { }
    }
}

// Helper to emit status
function emitStatus(status, token = null) {
    if (io) {
        if (token) {
            if (!clientsByToken[token]) {
                clientsByToken[token] = { dashboard: [], app: [], overlay: [], status: 'offline' };
            }
            clientsByToken[token].status = status;
            io.to(`room:${token}`).emit('status', status);
        } else {
            // If no token, we can't update a specific status, but we avoid updating a global one
            io.emit('status', status);
        }

        // [RELAY]
        try {
            const config = require('../config');
            if (config.isAppMode) {
                const { emitRemote } = require('./remoteClient');
                emitRemote('status', status);
            }
        } catch (e) { }
    }
}

// Helper to emit generic events
function emitEvent(eventName, data, token = null) {
    if (io) {
        if (token) {
            io.to(`room:${token}`).emit(eventName, data);
        } else {
            io.emit(eventName, data);
        }

        // [RELAY]
        try {
            const config = require('../config');
            if (config.isAppMode) {
                // [APP -> VPS]
                // logger.debug(`[Socket] App Mode detected, relaying ${eventName} to VPS`); // DEBUG
                const { emitRemote } = require('./remoteClient');
                emitRemote(eventName, data);
            } else if (token) {
                // [VPS -> APP] Relay to connected desktop app if on VPS
                io.to(`app:${token}`).emit(eventName, data);
            }
        } catch (e) { }
    }
}

/**
 * Emit to a specific user's App (EXE)
 * @param {string} token 
 * @param {string} event 
 * @param {object} data 
 */
function emitToApp(token, event, data) {
    if (io && token) {
        io.to(`room:${token}`).emit(event, data);
    }
}

/**
 * Emit only to the desktop app sockets of a token (not to dashboards / overlays).
 * Used for commands carrying private settings (e.g. the OBS password).
 */
function emitToDesktopApp(token, event, data) {
    if (io && token) io.to(`app:${token}`).emit(event, data);
}

/**
 * Check if at least one App (EXE) is connected for this token
 */
function isAppConnected(token) {
    if (!token || !clientsByToken[token]) return false;
    return clientsByToken[token].app.length > 0;
}

/** Version and connection time of the desktop app connected for this token (null when none) */
function getAppInfo(token) {
    if (!isAppConnected(token)) return null;
    return appInfoByToken[token] || { version: null, since: null };
}

function setOnAppConnected(cb) {
    onAppConnectedCallback = cb;
}

function getActiveTokens() {
    return Object.keys(clientsByToken);
}

function getSocketCache(token) {
    return socketCache[token] || null;
}

module.exports = {
    getAppInfo,
    initSocket,
    getIO,
    emitLog,
    emitStats,
    emitStatus,
    emitEvent,
    emitToApp,
    emitToDesktopApp,
    isAppConnected,
    setOnAppConnected,
    getActiveTokens,
    getSocketCache
};
