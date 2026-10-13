let GentokPushConnection = null;
async function getWebcastPushConnection() {
    if (!GentokPushConnection) {
        // Secure desktop app: TikTok signatures go through the Gentok server, which adds its Euler Stream key
        // (the key is no longer packaged in the app). Read by the library when it loads.
        const cfg = require('./config');
        if (cfg.relayMode && !process.env.SIGN_API_URL) {
            const remote = cfg.remoteServerUrl.replace(/\/+$/, '');
            try {
                const info = await require('axios').get(`${remote}/api/app/sign-info`, { timeout: 5000 });
                if (info.data && info.data.proxy) process.env.SIGN_API_URL = `${remote}/api/sign-proxy`;
            } catch (e) { /* server unreachable: direct signing (free tier) */ }
        }
        const mod = await import('tiktok-live-connector/legacy');

        // The legacy "simplified" format overwrites the gift struct sent by TikTok, losing the
        // gift type (combo or not), its real price and its picture. We copy them first so the
        // gift engine can count combos exactly once.
        GentokPushConnection = class extends mod.WebcastPushConnection {
            async processProtoMessageFetchResult(fetchResult) {
                for (const message of fetchResult?.messages || []) {
                    const data = message?.decodedData?.data;
                    if (message.method === 'WebcastGiftMessage' && data && data.gift) {
                        const gift = data.gift;
                        data.giftType = gift.type;
                        data.giftCombo = gift.combo;
                        data.giftDiamondCount = gift.diamondCount;
                        data.giftPictureUrl = gift.image?.urlList?.[0] || gift.icon?.urlList?.[0] || undefined;
                    }
                }
                return super.processProtoMessageFetchResult(fetchResult);
            }
        };
    }
    return GentokPushConnection;
}

// Errors for which retrying is pointless (user offline, wrong @, private account...)
function isFatalConnectError(message) {
    const m = String(message || '').toLowerCase();
    return m.includes("isn't online") || m.includes('not online') || m.includes('offline') ||
        m.includes('not live') || m.includes('live has ended') || m.includes('ended') ||
        m.includes('not found') || m.includes('cannot find') || m.includes('invalid') ||
        m.includes('private') || m.includes('already connected');
}

const RECONNECT_DELAYS_S = [2, 5, 10, 15, 30, 30, 60, 60, 120, 120]; // ~7.5 minutes in total
const WATCHDOG_INTERVAL_MS = 30000;
const SILENCE_LIMIT_MS = 3 * 60 * 1000; // no message at all for 3 min while live = frozen socket
const logger = require('./utils/logger');
const config = require('./config');
const spotifyModule = require('./utils/spotifyModule');
const { registerEvents } = require('./handlers/eventManager');
const { emitStatus, emitEvent } = require('./utils/socket');
const actionManager = require('./actions/actionManager');

// Display settings of the Top Gift / Top Streak overlays stored with the record (title, font)
function pickDisplay(prev) {
    const o = {};
    if (prev) ['customTitle', 'font', 'title', 'style'].forEach(k => { if (prev[k] !== undefined) o[k] = prev[k]; });
    return o;
}


/**
 * tiktok-live-connector (legacy mode) loses the profile picture: it reads `avatarLarge` as a list of
 * addresses while it is an object holding that list, so `profilePictureUrl` is always null and every
 * viewer showed the Gentok logo. The address it keeps in `userDetails.profilePictureUrls` is put back
 * before any of our handlers sees the event.
 */
function pictureOf(u) {
    const d = u && u.userDetails;
    const v = d && d.profilePictureUrls;
    return Array.isArray(v) ? v[0] : (typeof v === 'string' ? v : null);
}
function fixUser(u) {
    if (u && typeof u === 'object' && !u.profilePictureUrl) {
        const url = pictureOf(u);
        if (url) u.profilePictureUrl = url;
    }
}
function fixProfilePictures(connection) {
    const emit = connection.emit.bind(connection);
    connection.emit = (name, data, ...rest) => {
        if (data && typeof data === 'object') {
            try {
                fixUser(data);
                if (data.user) fixUser(data.user);
                if (Array.isArray(data.topViewers)) data.topViewers.forEach(v => v && fixUser(v.user));
            } catch (e) { }
        }
        return emit(name, data, ...rest);
    };
}

class TikTokConnector {
    constructor(username, token) {
        this.username = username;
        this.token = token; // [NEW] Pin session to token
        this.connection = null;
        this.retryCount = 0;
        this.maxRetries = config.maxRetries;
        this.reconnectInterval = config.reconnectInterval;
        this.isStopping = false;
        this.isConnected = false;
        this.isReconnecting = false;
        this.streamEnded = false;
        this.reconnectAttempt = 0;
        this.reconnectTimer = null;
        this.watchdogTimer = null;
        this.lastMessageAt = 0;

        this.startTime = null;

        // [NEW] Session Stats
        this.stats = {
            diamonds: 0,
            gifts: 0,
            likes: 0,
            shares: 0,
            follows: 0,
            viewerCount: 0,
            viewerCountMax: 0,
            cumulativeViewers: 0,
            chats: 0, // [NEW] Track chat activity for history
            actionsBreakdown: {},
            giftsBreakdown: {},
            giftsCoinsBreakdown: {},
            giftsIcons: {},
            topGift: config.peekSession(token).topGift || {
                coins: 0,
                uniqueId: 'PSEUDO',
                nickname: 'PSEUDO'
            },
            topStreak: config.peekSession(token).topStreak || {
                count: 0,
                uniqueId: 'PSEUDO',
                nickname: 'PSEUDO'
            },
            topCoins: [], // [NEW] Top Coins Leaderboard
            topLikes: []  // [NEW] Top Likes Leaderboard
        };
        this.topCoinsMap = new Map(); // Internal map for efficient updates
        this.topLikesMap = new Map(); // Internal map for efficient updates
        this.uniqueViewers = new Set(); // [NEW] Track unique users in session
        this.hasConnected = false;

        // [NEW] Last Events Storage (Load from persisted settings if available)
        this.lastEvents = config.peekSession(token).lastEvents || {
            follower: null,
            gift: null,
            subscriber: null,
            share: null,
            like: null,
            chat: null
        };
    }

    /**
     * Start the connection
     */
    async start() {
        if (this.connection) {
            await this.stop();
        }
        this.isStopping = false;

        // Fetch settings for THIS specific token
        const settings = await config.getSettings(this.token);

        // Reset stats on new start
        // Preserve topGift and topStreak if autoResetTopStats is disabled
        const preserveTopStats = !settings.autoResetTopStats;
        const preserveLastX = !settings.autoResetLastX;

        const previousTopGift = preserveTopStats ? settings.topGift : null;
        const previousTopStreak = preserveTopStats ? settings.topStreak : null;
        const previousTopCoins = []; // [FORCED RESET] Always reset on new start
        const previousTopLikes = []; // [FORCED RESET] Always reset on new start
        const previousLastEvents = preserveLastX ? settings.lastEvents : null;

        const defaultTopStat = { coins: 0, count: 0, uniqueId: 'PSEUDO', nickname: 'PSEUDO', giftName: null, giftIcon: 'https://tiktok.gentok.fr/img/tiktok/5655.png' };

        // Rebuild Maps
        this.topCoinsMap = new Map();
        previousTopCoins.forEach(user => this.topCoinsMap.set(user.uniqueId, user));

        this.topLikesMap = new Map();
        previousTopLikes.forEach(user => this.topLikesMap.set(user.uniqueId, user));

        this.stats = {
            diamonds: 0,
            gifts: 0,
            likes: 0,
            shares: 0,
            follows: 0,
            viewerCount: 0,
            viewerCountMax: 0,
            cumulativeViewers: 0,
            chats: 0,
            subscribers: 0,
            actionsBreakdown: {},
            giftsBreakdown: {},
            giftsCoinsBreakdown: {},
            giftsIcons: {},
            // reset at live start, but the overlay's title / font stay
            topGift: previousTopGift || { ...defaultTopStat, ...pickDisplay(settings.topGift) },
            topStreak: previousTopStreak || { ...defaultTopStat, ...pickDisplay(settings.topStreak) },
            topCoins: previousTopCoins,
            topLikes: previousTopLikes,
            // [NEW] Config for frontend
            topCoinsTitle: settings.topCoins?.title || 'TOP COINS',
            topCoinsLimit: settings.topCoins?.limit || 10,
            topCoinsStyle: settings.topCoins?.style || 1,
            topCoinsTransparent: settings.topCoins?.transparent !== false,
            topCoinsShowTitle: settings.topCoins?.showTitle !== false,
            topLikesTitle: settings.topLikes?.title || 'TOP LIKES',
            topLikesLimit: settings.topLikes?.limit || 10,
            topLikesStyle: settings.topLikes?.style || 1,
            topLikesTransparent: settings.topLikes?.transparent !== false,
            topLikesShowTitle: settings.topLikes?.showTitle !== false
        };

        this.lastEvents = previousLastEvents || {
            follower: null,
            gift: null,
            subscriber: null,
            share: null,
            like: null,
            chat: null
        };

        // If we are NOT preserving, we should also reset them in the persistent settings
        const updates = {
            token: this.token,
            topGift: this.stats.topGift,
            topStreak: this.stats.topStreak,
            lastEvents: this.lastEvents
        };

        // [NEW] Always reset likes count on NEW start
        if (settings.likesGoal) {
            updates.likesGoal = { ...settings.likesGoal, count: 0 };
        }

        if (!preserveTopStats || !preserveLastX || settings.likesGoal) {
            config.saveSettings(updates);
        }
        this.uniqueViewers = new Set(); // Reset unique viewers on new start
        this.startTime = Date.now();
        this.hasConnected = false;

        // [FIX] Emit initial stats and goal immediately so overlays update (e.g. reset to 0)
        // even before the actual TikTok connection is established.
        const { emitEvent } = require('./utils/socket');
        // (the secure app does not process the live: the server sends these for its relayed live)
        if (!config.relayMode) emitEvent('session_stats', this.stats, this.token);
        if (!config.relayMode && settings.likesGoal && settings.likesGoal.enabled) {
            // Re-fetch to ensure we have the version with count=0 if it was reset
            const currentSettings = await config.getSettings(this.token);
            if (currentSettings.likesGoal) {
                emitEvent('likes_goal_update', currentSettings.likesGoal, this.token);
            }
        }
        if (!config.relayMode) emitEvent('initialLastEvents', this.lastEvents, this.token);

        // Per-session de-duplication state (see handlers/eventManager.js)
        this.giftTracker = null;
        this.seenMsgIds = new Set();
        this.seenMsgOrder = [];
        this.followedUsers = new Set();
        this.subscribedUsers = new Set();
        this.chattedUsers = new Set();
        this.likeAccumulators = new Map();
        this.streamEnded = false;
        this.reconnectAttempt = 0;

        try {
            await this.openConnection({ retries: 2 });
            // stopped while connecting (Stop clicked): don't come back online behind the user's back
            if (this.isStopping) {
                try { if (this.connection) await this.connection.disconnect(); } catch (e) { }
                this.connection = null;
                throw new Error('Connexion annulée');
            }
            emitStatus('online', this.token);
            this.startWatchdog();
        } catch (err) {
            let errorMsg = 'Erreur de connexion';
            if (err && err.message) errorMsg = err.message;
            else if (err && err.info) errorMsg = err.info;

            // Map common TikTok errors to user-friendly messages
            const lowerError = errorMsg.toLowerCase();
            if (lowerError.includes('captcha')) {
                errorMsg = "TikTok demande un Captcha. La connexion sur VPS est bloquée. Utilisez l'Application Gentok sur votre PC.";
            } else if (lowerError.includes('rate limit') || lowerError.includes('ratelimit') || lowerError.includes('429')) {
                errorMsg = "Trop de connexions vers TikTok en peu de temps. Patientez une minute puis réessayez (ou ajoutez une clé SIGN_API_KEY).";
            } else if (lowerError.includes('blocked') || lowerError.includes('ip address') || lowerError.includes('room id') || lowerError.includes('all sources') || lowerError.includes('error while connecting')) {
                errorMsg = "Connexion bloquée par TikTok (IP du Serveur bannie). Lancez l'Application sur votre PC pour relayer la connexion.";
            } else if (lowerError.includes('not found') || lowerError.includes('invalid') || lowerError.includes('cannot find')) {
                errorMsg = "Pseudo TikTok introuvable, invalide ou mauvaise configuration.";
            } else if (lowerError.includes('private')) {
                errorMsg = "Le compte est en mode privé ou restreint.";
            } else if (lowerError.includes("isn't online") || lowerError.includes("not online") || lowerError.includes("offline") || lowerError.includes("live has ended") || lowerError.includes("not live") || lowerError.includes("ended")) {
                errorMsg = "Le live TikTok est terminé ou l'utilisateur n'est pas en live.";
            } else if (lowerError.includes("already connected")) {
                errorMsg = "Déjà connecté à ce live.";
            }

            logger.error(`[CONNECTOR] Échec démarrage pour ${this.username}: ${errorMsg}`);

            // [NEW] Notify UI with a proper error notification
            const { emitEvent } = require('./utils/socket');
            emitEvent('notification', {
                type: 'error',
                title: 'Échec de connexion',
                message: errorMsg,
                duration: 10000
            }, this.token);

            throw new Error(errorMsg); // Throw the mapped message
        }
    }

    /**
     * Creates a fresh TikTok connection and connects it.
     * Stats, leaderboards and de-duplication state are kept, so it is safe for reconnections.
     */
    async openConnection({ retries = 0 } = {}) {
        // Drop the previous socket (if any) without triggering our own reconnection logic
        if (this.connection) {
            const old = this.connection;
            this.connection = null;
            try { old.removeAllListeners(); } catch (e) { }
            try { await Promise.race([old.disconnect(), new Promise(r => setTimeout(r, 3000))]); } catch (e) { }
        }

        const options = {
            processInitialData: false, // never replay messages sent before we connected
            enableExtendedGiftInfo: false
        };
        if (config.signApiKey) options.signApiKey = config.signApiKey;
        // the sign proxy of the Gentok server knows the account by its token (it never leaves the app otherwise)
        else if (config.relayMode && this.token && process.env.SIGN_API_URL) options.signApiKey = this.token;

        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            if (this.isStopping) throw new Error('Arrêt demandé');

            const WebcastPushClass = await getWebcastPushConnection();
            const connection = new WebcastPushClass(this.username, options);
            this.connection = connection;
            fixProfilePictures(connection);
            // secure app: the live is processed by the Gentok server (no database here)
            if (config.relayMode) require('./utils/liveRelay').attachAppRelay(connection, this);
            else registerEvents(connection, this);

            // Any decoded message proves the socket is alive (used by the watchdog)
            connection.on('decodedData', () => { this.lastMessageAt = Date.now(); });

            try {
                await this.connect();
                this.lastMessageAt = Date.now();
                return;
            } catch (err) {
                lastError = err;
                try { connection.removeAllListeners(); } catch (e) { }
                if (this.connection === connection) this.connection = null;

                const msg = (err && (err.message || err.info)) || String(err);
                if (isFatalConnectError(msg) || attempt === retries) break;

                const waitS = attempt === 0 ? 2 : 5;
                logger.warn(`[CONNECTOR] Tentative ${attempt + 1} échouée (${msg}). Nouvel essai dans ${waitS}s...`);
                await new Promise(r => setTimeout(r, waitS * 1000));
            }
        }
        throw lastError || new Error('Erreur de connexion');
    }

    /**
     * Called when the TikTok socket closes. Reconnects automatically unless the live really ended
     * or the streamer pressed stop.
     */
    handleDisconnect(reason = '') {
        if (this.isStopping || this.streamEnded) return;
        this.isConnected = false;
        this.scheduleReconnect(reason);
    }

    scheduleReconnect(reason = '') {
        if (this.isStopping || this.streamEnded || this.reconnectTimer || this.isReconnecting) return;

        if (this.reconnectAttempt >= RECONNECT_DELAYS_S.length) {
            logger.error(`[CONNECTOR] Reconnexion abandonnée après ${this.reconnectAttempt} essais.`);
            emitEvent('notification', {
                type: 'error',
                title: 'Connexion perdue',
                message: 'Impossible de se reconnecter au live TikTok. Relancez la connexion.'
            }, this.token);
            this.stop();
            return;
        }

        const delayS = RECONNECT_DELAYS_S[this.reconnectAttempt];
        this.reconnectAttempt++;
        logger.warn(`🔄 Connexion TikTok perdue${reason ? ` (${reason})` : ''}. Reconnexion dans ${delayS}s (essai ${this.reconnectAttempt}/${RECONNECT_DELAYS_S.length})...`);
        emitEvent('notification', {
            type: 'info',
            title: 'Reconnexion au live...',
            message: `Connexion TikTok perdue, nouvel essai dans ${delayS}s (essai ${this.reconnectAttempt}).`
        }, this.token);

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            if (this.isStopping || this.streamEnded) return;
            this.isReconnecting = true;
            try {
                await this.openConnection();
                this.reconnectAttempt = 0;
                logger.info(`✅ Reconnecté au live de ${this.username}.`);
                emitStatus('online', this.token);
                emitEvent('notification', { type: 'success', message: 'Reconnecté au live TikTok ✅' }, this.token);
            } catch (err) {
                const msg = (err && (err.message || err.info)) || String(err);
                if (isFatalConnectError(msg)) {
                    logger.warn(`[CONNECTOR] Le live n'est plus disponible (${msg}). Arrêt.`);
                    this.streamEnded = true;
                    this.stop();
                } else {
                    this.isReconnecting = false;
                    this.scheduleReconnect(msg);
                    return;
                }
            }
            this.isReconnecting = false;
        }, delayS * 1000);
    }

    /**
     * Detects "zombie" connections: the socket looks open but TikTok stopped sending anything.
     */
    startWatchdog() {
        this.stopWatchdog();
        this.watchdogTimer = setInterval(() => {
            if (!this.isConnected || this.isStopping || this.isReconnecting || this.reconnectTimer) return;
            if (this.lastMessageAt && Date.now() - this.lastMessageAt > SILENCE_LIMIT_MS) {
                logger.warn('[CONNECTOR] Aucun message de TikTok depuis 3 minutes, reconnexion préventive...');
                this.isConnected = false;
                this.scheduleReconnect('connexion figée');
            }
        }, WATCHDOG_INTERVAL_MS);
    }

    stopWatchdog() {
        if (this.watchdogTimer) clearInterval(this.watchdogTimer);
        this.watchdogTimer = null;
    }

    async connect() {
        try {
            await this.connection.connect();
            this.isConnected = true;
            this.retryCount = 0;
        } catch (err) {
            this.isConnected = false;
            throw err;
        }
    }

    /**
     * Stop the connection cleanly
     */
    // stop() can be called by the user, the end of the live and an error at the same time: one run only
    // (two runs saved the live twice in the history)
    stop() {
        if (!this._stopPromise) {
            this._stopPromise = this._stop().finally(() => {
                this._stopPromise = null;
                // lets the server forget this connection (an ended live used to stay "running")
                try { if (typeof this.onStopped === 'function') this.onStopped(this); } catch (e) { }
            });
        }
        return this._stopPromise;
    }

    async _stop() {
        console.log(`[CONNECTOR:${this.token.substring(0, 8)}] 🛑 Stop requested...`);

        // Count the gifts of combos still in progress before closing the session
        if (this.giftTracker) {
            try { this.giftTracker.closeAll(); } catch (e) { }
            this.giftTracker = null;
        }
        this.isStopping = true;
        this.stopWatchdog();
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;

        if (this.connection) {
            // [CRITICAL] Stop processing new events IMMEDIATELY
            try {
                this.connection.removeAllListeners();
            } catch (e) { }
        }

        // Gifts / likes still waiting for the 2 s leaderboard save (the app can quit right after)
        try { await require('./handlers/eventManager').flushLeaderboardBuffer(); } catch (e) { }

        // Secure app: the server saves the history of the live it processed
        if (config.relayMode) {
            try { require('./utils/remoteClient').emitRemote('live_relay_stop', {}); } catch (e) { }
        }

        // Save stats before clearing (even if we were between two reconnection attempts)
        if (this.startTime && !config.relayMode) {
            try {
                await this.saveSessionStats();
            } catch (e) {
                console.error('[CONNECTOR] Error saving session stats:', e.message);
            }
        }

        if (this.connection) {
            try {
                console.log('[CONNECTOR] Disconnecting from TikTok Live...');
                // Set a timeout for the disconnection to avoid hanging
                const disconnectPromise = this.connection.disconnect();
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 5000));

                await Promise.race([disconnectPromise, timeoutPromise]);
                console.log('[CONNECTOR] ✅ Disconnected successfully');
            } catch (e) {
                console.error('[CONNECTOR] Disconnect issue:', e.message);
            }
            this.connection = null;
        }

        // Save the viewers' points and stop the watch-time timer
        if (!config.relayMode) { try { require('./features/liveFeatures').onStop(this); } catch (e) { } }

        // Clear action queue and stop audio playback immediately on stop
        actionManager.clearQueue(this.token);
        emitEvent('stop_audio', {}, this.token);

        // [FIX] Clear spotify queue when live ends
        spotifyModule.clearQueue(this.token);

        this.isConnected = false;
        this.startTime = null;
        // Likes goal ready for the next live: count back to 0, target back to the configured step (it used to keep
        // the target reached during this live, e.g. 0 / 15000), and a goal hidden when reached shows again
        const settings = await config.getSettings(this.token);
        if (settings.likesGoal) {
            const g = { ...settings.likesGoal, count: 0 };
            const step = Number(g.goalStep || g.initialGoal) || 0;
            if (step > 0) g.goal = step;
            if (g.hiddenByReach) { g.enabled = true; delete g.hiddenByReach; }
            await config.saveSettings({ token: this.token, likesGoal: g });
        }

        emitStatus('offline', this.token);
        console.log('[CONNECTOR] 🛑 Stop completed');
    }

    async saveSessionStats() {
        try {
            const SessionStat = require('./models/SessionStat');
            const { encodeKeys } = require('./utils/mapKeys');
            const duration = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;

            // [CRITICAL] Skip saving if session was too short or had NO activity
            // This prevents "failed connection" attempts from appearing in history
            const hasActivity = (this.stats.diamonds > 0 || this.stats.gifts > 0 || this.stats.likes > 0 || this.stats.follows > 0 || this.stats.cumulativeViewers > 0 || this.stats.chats > 0);

            // [PREMIUM ONLY] Only save history for premium users
            const settings = await config.getSettings(this.token);
            const isPremium = settings.isPremium;

            if (!this.hasConnected || !hasActivity || duration < 10) {
                logger.info(`ℹ️ Session skipped (No activity or connection failed).`);
                return;
            }

            if (!isPremium) {
                logger.info(`ℹ️ Session stats NOT saved (Premium feature only).`);
                return;
            }

            const stat = new SessionStat({
                token: this.token, // [FIX] Use pinned token, not global config
                username: this.username,

                diamonds: this.stats.diamonds || 0,
                gifts: this.stats.gifts || 0,
                likes: this.stats.likes || 0,
                shares: this.stats.shares || 0,
                follows: this.stats.follows || 0,
                chats: this.stats.chats || 0,
                viewerCountMax: this.stats.viewerCountMax || 0,
                cumulativeViewers: this.stats.cumulativeViewers || 0,
                duration: duration,
                // names may contain "." or "$" (refused by MongoDB maps): stored with safe look-alikes
                actionsBreakdown: encodeKeys(this.stats.actionsBreakdown),
                giftsBreakdown: encodeKeys(this.stats.giftsBreakdown),
                giftsCoinsBreakdown: encodeKeys(this.stats.giftsCoinsBreakdown),
                giftsIcons: encodeKeys(this.stats.giftsIcons, true)
            });
            await stat.save();
            logger.info(`📊 Session stats saved for ${this.username} (Duration: ${duration}s)`);
        } catch (err) {
            logger.error(`🚨 Failed to save session stats: ${err.message}`);
        }
    }

}

/**
 * Server side of the secure desktop app: a live connected on the streamer's PC, whose events the app relays
 * (utils/liveRelay.js). Same processing as a live connected here (points, rankings, actions, history), but
 * there is no TikTok socket on this side: the app reconnects to TikTok itself.
 */
class RelayedConnector extends TikTokConnector {
    constructor(username, token, info = {}) {
        super(username, token);
        this.isRelayed = true;
        this.relayInfo = info;
        this.pendingEvents = [];
    }

    async openConnection() {
        const { EventEmitter } = require('events');
        const conn = new EventEmitter();
        conn.roomId = this.relayInfo.roomId || null;
        conn.roomInfo = this.relayInfo.roomInfo || null;
        conn.connect = async () => { };
        conn.disconnect = async () => { };
        this.connection = conn;
        registerEvents(conn, this);
        this.isConnected = true;
        this.lastMessageAt = Date.now();
        conn.emit('connected', { roomId: conn.roomId });
        // events relayed while the live was being set up
        const queued = this.pendingEvents;
        this.pendingEvents = [];
        for (const [event, data] of queued) conn.emit(event, data);
    }

    updateRelay(info = {}) {
        this.relayInfo = { ...this.relayInfo, ...info };
        if (this.connection && info.roomId) this.connection.roomId = info.roomId;
    }

    feed(event, data) {
        const { LIVE_EVENTS } = require('./utils/liveRelay');
        if (this.isStopping || !LIVE_EVENTS.includes(event) || !data || typeof data !== 'object' || Array.isArray(data)) return;
        if (!this.connection) {
            if (this.pendingEvents.length < 500) this.pendingEvents.push([event, data]);
            return;
        }
        this.lastMessageAt = Date.now();
        this.connection.emit(event, data);
    }

    // the TikTok connection (and its reconnections) belongs to the app
    startWatchdog() { }
    scheduleReconnect() { }
    handleDisconnect() { }
}

module.exports = TikTokConnector;
module.exports.RelayedConnector = RelayedConnector;
