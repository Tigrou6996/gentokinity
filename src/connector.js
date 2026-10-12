let WebcastPushConnection = null;
async function getWebcastPushConnection() {
    if (!WebcastPushConnection) {
        const mod = await import('tiktok-live-connector/legacy');
        WebcastPushConnection = mod.WebcastPushConnection;
    }
    return WebcastPushConnection;
}
const logger = require('./utils/logger');
const config = require('./config');
const spotifyModule = require('./utils/spotifyModule');
const { registerEvents } = require('./handlers/eventManager');
const { emitStatus, emitEvent } = require('./utils/socket');
const actionManager = require('./actions/actionManager');

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
            topGift: config.settings.topGift || {
                coins: 0,
                uniqueId: 'PSEUDO',
                nickname: 'PSEUDO'
            },
            topStreak: config.settings.topStreak || {
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
        this.lastEvents = config.settings.lastEvents || {
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
        this.isStopping = false;
        if (this.connection) {
            await this.stop();
        }

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
            actionsBreakdown: {},
            giftsBreakdown: {},
            topGift: previousTopGift || { ...defaultTopStat },
            topStreak: previousTopStreak || { ...defaultTopStat },
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
        emitEvent('session_stats', this.stats, this.token);
        if (settings.likesGoal && settings.likesGoal.enabled) {
            // Re-fetch to ensure we have the version with count=0 if it was reset
            const currentSettings = await config.getSettings(this.token);
            if (currentSettings.likesGoal) {
                emitEvent('likes_goal_update', currentSettings.likesGoal, this.token);
            }
        }
        emitEvent('initialLastEvents', this.lastEvents, this.token);

        const options = {
            processInitialData: false,
            enableExtendedGiftInfo: false,
            clientParams: {
                app_language: 'fr-FR',
                browser_language: 'fr-FR',
                browser_version: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            },
            requestHeaders: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            },
            requestOptions: {
                timeout: 15000
            }
        };

        if (config.sessionId) {
            options.sessionId = config.sessionId;
        }

        if (config.proxyUrl) {
            logger.info(`🛡️ Utilisation du proxy : ${config.proxyUrl.replace(/:[^:]*@/, ':****@')}`);
            options.requestOptions.proxy = config.proxyUrl;
        }

        // Create a FRESH instance
        const WebcastPushClass = await getWebcastPushConnection();
        this.connection = new WebcastPushClass(this.username, options);

        registerEvents(this.connection, this);

        try {
            await this.connect();
            emitStatus('online', this.token);
        } catch (err) {
            let errorMsg = 'Erreur de connexion';
            if (err && err.message) errorMsg = err.message;
            else if (err && err.info) errorMsg = err.info;

            // Map common TikTok errors to user-friendly messages
            const lowerError = errorMsg.toLowerCase();
            if (lowerError.includes('captcha')) {
                errorMsg = "TikTok demande un Captcha. La connexion sur VPS est bloquée. Utilisez l'Application Gentok sur votre PC.";
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
    async stop() {
        console.log(`[CONNECTOR:${this.token.substring(0, 8)}] 🛑 Stop requested...`);
        this.isStopping = true;

        if (this.connection) {
            // [CRITICAL] Stop processing new events IMMEDIATELY
            try {
                this.connection.removeAllListeners();
            } catch (e) { }
        }

        // Save stats before clearing
        if (this.connection && this.startTime) {
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

        // Clear action queue and stop audio playback immediately on stop
        actionManager.clearQueue(this.token);
        emitEvent('stop_audio', {}, this.token);

        // [FIX] Clear spotify queue when live ends
        spotifyModule.clearQueue(this.token);

        this.isConnected = false;
        this.startTime = null;
        // [NEW] Reset likes count on stop
        const settings = await config.getSettings(this.token);
        if (settings.likesGoal) {
            await config.saveSettings({
                token: this.token,
                likesGoal: { ...settings.likesGoal, count: 0 }
            });
        }

        emitStatus('offline', this.token);
        console.log('[CONNECTOR] 🛑 Stop completed');
    }

    async saveSessionStats() {
        try {
            const SessionStat = require('./models/SessionStat');
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
                actionsBreakdown: this.stats.actionsBreakdown || {},
                giftsBreakdown: this.stats.giftsBreakdown || {}
            });
            await stat.save();
            logger.info(`📊 Session stats saved for ${this.username} (Duration: ${duration}s)`);
        } catch (err) {
            logger.error(`🚨 Failed to save session stats: ${err.message}`);
        }
    }

    /**
     * Handles reconnection with exponential backoff
     */
    handleReconnection(isStreamEnd = false) {
        // [DISABLED] Manual connection only as requested
        return;
    }
}

module.exports = TikTokConnector;
