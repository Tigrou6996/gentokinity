const Action = require('./models/Action');
const Event = require('./models/Event');
const Settings = require('./models/Settings');

// Values baked into the desktop build (see scripts/write-build-env.js). Missing in dev.
let buildEnv = {};
try { buildEnv = require('./build-env.json'); } catch (e) { }

// Helper to get fresh default session state
const getSessionDefaults = () => ({
    token: null,
    username: null,
    ip: null,
    isPremium: false,
    activeSceneId: null,
    scenes: [],
    events: [],
    actions: [],
    minecraft: {
        host: 'localhost',
        port: 4567,
        password: '',
        playerName: ''
    },
    spotify: {
        clientId: '',
        clientSecret: '',
        refreshToken: '',
        maxTracksPerUser: 5,
        maxQueueSize: 50,
        enabled: false,
        playEnabled: true,
        skipEnabled: true,
        allowExplicit: true,
        alwaysShowOverlay: true,
        allowedUsers: {
            all: true,
            followers: false,
            subscribers: true,
            moderators: true
        },
        commands: {
            play: '!play',
            skip: '!skip',
            remove: '!remove'
        },
        skipVotes: 3,
        skipInstant: {
            moderators: true,
            subscribers: false,
            followers: false
        }
    },
    tts: {
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
        commentType: 'dot',
        commandTrigger: '!tts',
        cooldown: 10,
        maxQueue: 5,
        maxLength: 100,
        filterSpam: true,
        filterMentions: true,
        filterCommands: true
    },
    autoResetTopStats: false,
    autoResetLastX: false,
    topGift: {
        coins: 0,
        uniqueId: 'PSEUDO',
        nickname: 'PSEUDO',
        giftName: null,
        giftIcon: 'https://tiktok.gentok.fr/img/tiktok/5655.png'
    },
    topStreak: {
        count: 0,
        uniqueId: 'PSEUDO',
        nickname: 'PSEUDO',
        giftName: null,
        giftIcon: 'https://tiktok.gentok.fr/img/tiktok/5655.png'
    },
    lastEvents: {
        follower: null,
        gift: null,
        subscriber: null,
        share: null,
        like: null,
        chat: null
    },
    likesGoal: {
        enabled: false,
        count: 0,
        goal: 1000,
        goalStep: 1000,
        initialGoal: 1000,
        title: '',
        whenReached: 'increase',
        actionId: null,
        style: 1,
        showFooter: true
    },
    topCoins: { limit: 10, title: 'TOP COINS', style: 1, transparent: true, showTitle: true },
    topLikes: { limit: 10, title: 'TOP LIKES', style: 1, transparent: true, showTitle: true }
});

// In-memory cache for the active sessions data
// Scoped by token to fulfill "each user / token has their own data"
const _sessions = new Map();
let _lastActiveToken = null; // Track the last used token for legacy fallback getters
let _settingsCache = {}; // Cache for per-token settings (10s TTL)

// Internal helper to get session by token
function getSession(token) {
    const t = token || _lastActiveToken;
    if (!t) return getSessionDefaults();
    if (!_sessions.has(t)) {
        _sessions.set(t, getSessionDefaults());
    }
    return _sessions.get(t);
}

module.exports = {
    // Session Management
    async loadSession(token) {
        if (!token) return;
        _lastActiveToken = token;

        // [ATOMIC] Build new session state locally to avoid race conditions
        const newSession = getSessionDefaults();
        newSession.token = token;

        const settings = await Settings.findOne({ token });
        const activeSceneId = settings ? settings.activeSceneId : null;

        const [events, actions] = await Promise.all([
            Event.find({ token, sceneId: activeSceneId }),
            Action.find({ token, sceneId: activeSceneId })
        ]);

        newSession.events = events || [];
        newSession.actions = actions || [];

        if (settings) {
            newSession.username = settings.username || null;
            newSession.ip = settings.ip || null;
            newSession.isPremium = settings.isPremium || false;
            newSession.activeSceneId = settings.activeSceneId || null;
            newSession.scenes = settings.scenes || [];

            if (settings.minecraft) {
                newSession.minecraft = { ...newSession.minecraft, ...settings.minecraft };
            }
            if (settings.spotify) {
                const spotifySettings = settings.spotify.toObject ? settings.spotify.toObject() : settings.spotify;
                const defaults = getSessionDefaults().spotify;
                newSession.spotify = {
                    ...newSession.spotify,
                    ...spotifySettings,
                    allowedUsers: { ...defaults.allowedUsers, ...(spotifySettings.allowedUsers || {}) },
                    commands: { ...defaults.commands, ...(spotifySettings.commands || {}) },
                    skipInstant: { ...defaults.skipInstant, ...(spotifySettings.skipInstant || {}) }
                };
            }
            if (settings.tts) {
                newSession.tts = {
                    ...newSession.tts,
                    ...settings.tts,
                    allowedUsers: { ...newSession.tts.allowedUsers, ...(settings.tts.allowedUsers || {}) }
                };
            }
            // [NEW] Load root-level stats before scene overrides
            if (settings.likesGoal) newSession.likesGoal = { ...newSession.likesGoal, ...settings.likesGoal };
            if (settings.topGift) newSession.topGift = { ...newSession.topGift, ...settings.topGift };
            if (settings.topStreak) newSession.topStreak = { ...newSession.topStreak, ...settings.topStreak };
            if (settings.topCoins) newSession.topCoins = { ...newSession.topCoins, ...settings.topCoins };
            if (settings.topLikes) newSession.topLikes = { ...newSession.topLikes, ...settings.topLikes };

            // [FIX] Scene Isolation: If a scene is active, it owns its stats (likesGoal, top stats).
            // We ignore root settings for these fields to avoid data "leaking" between scenes.
            if (activeSceneId) {
                const activeScene = (settings.scenes || []).find(sc => sc.id === activeSceneId);
                if (activeScene) {
                    const defaults = getSessionDefaults();
                    // Merge scene-specific overrides onto the already loaded root settings
                    if (activeScene.likesGoal) newSession.likesGoal = { ...newSession.likesGoal, ...activeScene.likesGoal };
                    if (activeScene.topGift) newSession.topGift = { ...newSession.topGift, ...activeScene.topGift };
                    if (activeScene.topStreak) newSession.topStreak = { ...newSession.topStreak, ...activeScene.topStreak };
                    if (activeScene.topCoins) newSession.topCoins = { ...newSession.topCoins, ...activeScene.topCoins };
                    if (activeScene.topLikes) newSession.topLikes = { ...newSession.topLikes, ...activeScene.topLikes };

                    if (activeScene.autoResetTopStats !== undefined) newSession.autoResetTopStats = activeScene.autoResetTopStats;
                    if (activeScene.autoResetLastX !== undefined) newSession.autoResetLastX = activeScene.autoResetLastX;
                }
            }
            // Global events remain global
            if (settings.lastEvents) newSession.lastEvents = settings.lastEvents;
        } else {
            await Settings.create({ token, username: null, minecraft: newSession.minecraft, isPremium: false });
        }

        _sessions.set(token, newSession);
    },

    get tiktokUsername() { return getSession().username; },
    set tiktokUsername(val) {
        const s = getSession();
        s.username = val;
        if (s.token) Settings.updateOne({ token: s.token }, { username: val }, { upsert: true }).exec();
    },

    get licenseToken() { return _lastActiveToken; },
    set licenseToken(val) { _lastActiveToken = val; },

    // Never hardcode credentials here: they come from .env (dev / VPS) or from
    // src/build-env.json, generated at build time by scripts/write-build-env.js.
    mongodbUri: process.env.MONGODB_URI || buildEnv.MONGODB_URI || null,
    sessionId: null, proxyUrl: null,
    remoteServerUrl: process.env.REMOTE_SERVER || 'https://tiktok.gentok.fr',
    remoteDashboardUrl: process.env.DASHBOARD_URL || buildEnv.DASHBOARD_URL || 'https://tiktok.gentok.fr',
    reconnectInterval: 5000, maxRetries: 10, enableLogging: true,

    get isAppMode() {
        if (process.env.WEB_MODE === 'true' || process.env.VITE_WEB_MODE === 'true') return false;
        if (process.env.APP_MODE === 'true') return true;

        // If explicitly forced via VPS marker, it's not app mode
        if (process.env.GENTOK_VPS === 'true') return false;

        // Detect Electron or Package
        if (!!process.pkg || !!process.versions.electron || (typeof window !== 'undefined' && window.electronAPI)) return true;

        // On Windows, if we are NOT explicitly in WEB_MODE and not on a known VPS env,
        // we assume it's the development app or the local engine.
        if (process.platform === 'win32' && process.env.NODE_ENV !== 'production') return true;

        return false;
    },

    get minecraft() { return getSession().minecraft; },

    async getSettings(token) {
        const t = token || _lastActiveToken;
        if (!t) return getSessionDefaults();
        if (_sessions.has(t)) return _sessions.get(t);
        const CACHE_TTL = 10000;
        if (_settingsCache[t] && (Date.now() - _settingsCache[t].timestamp < CACHE_TTL)) return _settingsCache[t].data;

        const sDoc = await Settings.findOne({ token: t });
        let result;
        if (!sDoc) {
            result = getSessionDefaults();
        } else {
            const defaults = getSessionDefaults();
            const s = sDoc.toObject();
            result = {
                ...defaults, ...s,
                spotify: { ...defaults.spotify, ...(s.spotify || {}), commands: { ...defaults.spotify.commands, ...(s.spotify?.commands || {}) }, allowedUsers: { ...defaults.spotify.allowedUsers, ...(s.spotify?.allowedUsers || {}) }, skipInstant: { ...defaults.spotify.skipInstant, ...(s.spotify?.skipInstant || {}) } },
                tts: { ...defaults.tts, ...(s.tts || {}), allowedUsers: { ...defaults.tts.allowedUsers, ...(s.tts?.allowedUsers || {}) } },
                likesGoal: { ...defaults.likesGoal, ...(s.likesGoal || {}) },
                topGift: { ...defaults.topGift, ...(s.topGift || {}) },
                topStreak: { ...defaults.topStreak, ...(s.topStreak || {}) },
                topCoins: { ...defaults.topCoins, ...(s.topCoins || {}) },
                topLikes: { ...defaults.topLikes, ...(s.topLikes || {}) }
            };

            // [FIX] Scene Isolation in getSettings (Consistency with loadSession)
            if (result.activeSceneId && result.scenes) {
                const activeScene = result.scenes.find(sc => sc.id === result.activeSceneId);
                if (activeScene) {
                    // result already contains root-level settings from the spread above.
                    // We only overlay scene-specific overrides if they exist.
                    if (activeScene.likesGoal) result.likesGoal = { ...result.likesGoal, ...activeScene.likesGoal };
                    if (activeScene.topGift) result.topGift = { ...result.topGift, ...activeScene.topGift };
                    if (activeScene.topStreak) result.topStreak = { ...result.topStreak, ...activeScene.topStreak };
                    if (activeScene.topCoins) result.topCoins = { ...result.topCoins, ...activeScene.topCoins };
                    if (activeScene.topLikes) result.topLikes = { ...result.topLikes, ...activeScene.topLikes };

                    if (activeScene.autoResetTopStats !== undefined) result.autoResetTopStats = activeScene.autoResetTopStats;
                    if (activeScene.autoResetLastX !== undefined) result.autoResetLastX = activeScene.autoResetLastX;
                }
            }
        }
        _settingsCache[t] = { data: result, timestamp: Date.now() };
        return result;
    },

    // Re-read a user's data from MongoDB (used after admin / billing changes).
    // Loaded sessions are reloaded rather than dropped: live connectors read their
    // events and actions from them.
    async invalidate(token) {
        if (!token) return;
        delete _settingsCache[token];
        if (_sessions.has(token)) await this.loadSession(token);
    },

    async clearCache() {
        _settingsCache = {};
        for (const token of Array.from(_sessions.keys())) {
            await this.loadSession(token);
        }
    },

    get spotify() { return getSession().spotify; },
    get settings() {
        const s = getSession();
        return {
            token: s.token, username: s.username, ip: s.ip, isPremium: s.isPremium,
            activeSceneId: s.activeSceneId, scenes: s.scenes, minecraft: s.minecraft,
            spotify: s.spotify, tts: s.tts, autoResetTopStats: s.autoResetTopStats,
            autoResetLastX: s.autoResetLastX, topGift: s.topGift, topStreak: s.topStreak,
            topCoins: s.topCoins, topLikes: s.topLikes,
            lastEvents: s.lastEvents, likesGoal: s.likesGoal
        };
    },
    get activeSceneId() { return getSession().activeSceneId; },
    set activeSceneId(val) { getSession().activeSceneId = val; },

    // Returns the session of an explicit token (loading it if needed). Use this instead of the
    // "last active token" fallback whenever a request carries its own token, otherwise two users
    // hitting the server at the same time can overwrite each other's data.
    async getSessionFor(token) {
        if (!token) return getSession();
        if (!_sessions.has(token)) await this.loadSession(token);
        return _sessions.get(token);
    },

    async saveEvents(events, token) {
        const s = await this.getSessionFor(token); if (!s.token) return;
        s.events = (!s.isPremium && events.length > 5) ? events.slice(0, 5) : events;
        const Event = require('./models/Event');
        await Event.deleteMany({ token: s.token, sceneId: s.activeSceneId });
        if (s.events.length > 0) await Event.insertMany(s.events.map(e => ({ ...e, token: s.token, sceneId: s.activeSceneId })));
    },

    async saveActions(actions, token) {
        const s = await this.getSessionFor(token); if (!s.token) return;
        s.actions = (!s.isPremium && actions.length > 5) ? actions.slice(0, 5) : actions;
        const Action = require('./models/Action');
        await Action.deleteMany({ token: s.token, sceneId: s.activeSceneId });
        if (s.actions.length > 0) await Action.insertMany(s.actions.map(a => ({ ...a, token: s.token, sceneId: s.activeSceneId })));
    },

    async saveSettings(data) {
        const t = data.token || _lastActiveToken; if (!t) return;
        if (!_sessions.has(t)) await this.loadSession(t);
        const s = _sessions.get(t);
        const previousSceneId = s.activeSceneId;
        const isSwitching = data.activeSceneId !== undefined && data.activeSceneId !== previousSceneId;

        // [FIX] If switching scenes, save current state to the OLD scene before clearing session stats
        if (isSwitching && previousSceneId) {
            const prevIndex = s.scenes.findIndex(sc => sc.id === previousSceneId);
            if (prevIndex !== -1) {
                s.scenes[prevIndex].likesGoal = JSON.parse(JSON.stringify(s.likesGoal));
                s.scenes[prevIndex].topGift = JSON.parse(JSON.stringify(s.topGift));
                s.scenes[prevIndex].topStreak = JSON.parse(JSON.stringify(s.topStreak));
                s.scenes[prevIndex].topCoins = JSON.parse(JSON.stringify(s.topCoins));
                s.scenes[prevIndex].topLikes = JSON.parse(JSON.stringify(s.topLikes));
                s.scenes[prevIndex].autoResetTopStats = s.autoResetTopStats;
                s.scenes[prevIndex].autoResetLastX = s.autoResetLastX;
            }

            // Reset current session stats to defaults (they will be overwritten by loadSession if the new scene has its own)
            const defaults = getSessionDefaults();
            s.likesGoal = JSON.parse(JSON.stringify(defaults.likesGoal));
            s.topGift = JSON.parse(JSON.stringify(defaults.topGift));
            s.topStreak = JSON.parse(JSON.stringify(defaults.topStreak));
            s.topCoins = JSON.parse(JSON.stringify(defaults.topCoins));
            s.topLikes = JSON.parse(JSON.stringify(defaults.topLikes));
            s.autoResetTopStats = defaults.autoResetTopStats;
            s.autoResetLastX = defaults.autoResetLastX;
        }

        if (data.username) s.username = data.username;
        if (data.ip) s.ip = data.ip;
        if (data.isPremium !== undefined) s.isPremium = data.isPremium;
        if (data.activeSceneId !== undefined) s.activeSceneId = data.activeSceneId;
        if (data.scenes !== undefined) s.scenes = (!s.isPremium && data.scenes.length > 2) ? data.scenes.slice(0, 2) : data.scenes;
        if (data.minecraft) s.minecraft = { ...s.minecraft, ...data.minecraft };
        if (data.spotify) {
            s.spotify = {
                ...s.spotify, ...data.spotify,
                refreshToken: data.spotify.refreshToken || s.spotify.refreshToken,
                commands: { ...s.spotify.commands, ...(data.spotify.commands || {}) },
                allowedUsers: { ...s.spotify.allowedUsers, ...(data.spotify.allowedUsers || {}) },
                skipInstant: { ...s.spotify.skipInstant, ...(data.spotify.skipInstant || {}) }
            };
        }
        if (data.tts) s.tts = { ...s.tts, ...data.tts, allowedUsers: { ...s.tts.allowedUsers, ...(data.tts.allowedUsers || {}) } };

        // Apply stats updates
        if (data.autoResetTopStats !== undefined) s.autoResetTopStats = data.autoResetTopStats;
        if (data.autoResetLastX !== undefined) s.autoResetLastX = data.autoResetLastX;
        if (data.topGift !== undefined) s.topGift = { ...s.topGift, ...data.topGift };
        if (data.topStreak !== undefined) s.topStreak = { ...s.topStreak, ...data.topStreak };
        if (data.topCoins !== undefined) s.topCoins = { ...s.topCoins, ...data.topCoins };
        if (data.topLikes !== undefined) s.topLikes = { ...s.topLikes, ...data.topLikes };
        if (data.lastEvents !== undefined) s.lastEvents = data.lastEvents;
        if (data.likesGoal) s.likesGoal = { ...s.likesGoal, ...data.likesGoal };

        // [PERSISTENCE] If we are NOT switching and have an active scene, update its specific slot too
        if (!isSwitching && s.activeSceneId) {
            const activeIndex = s.scenes.findIndex(sc => sc.id === s.activeSceneId);
            if (activeIndex !== -1) {
                if (data.likesGoal) s.scenes[activeIndex].likesGoal = s.likesGoal;
                if (data.topGift !== undefined) s.scenes[activeIndex].topGift = s.topGift;
                if (data.topStreak !== undefined) s.scenes[activeIndex].topStreak = s.topStreak;
                if (data.topCoins !== undefined) s.scenes[activeIndex].topCoins = s.topCoins;
                if (data.topLikes !== undefined) s.scenes[activeIndex].topLikes = s.topLikes;
                if (data.autoResetTopStats !== undefined) s.scenes[activeIndex].autoResetTopStats = s.autoResetTopStats;
                if (data.autoResetLastX !== undefined) s.scenes[activeIndex].autoResetLastX = s.autoResetLastX;
            }
        }

        const updatePayload = {
            $set: {
                username: s.username, ip: s.ip, isPremium: s.isPremium, activeSceneId: s.activeSceneId,
                scenes: s.scenes, minecraft: s.minecraft, spotify: s.spotify, tts: s.tts,
                lastEvents: s.lastEvents,
                autoResetTopStats: s.autoResetTopStats,
                autoResetLastX: s.autoResetLastX,
                likesGoal: s.likesGoal,
                topGift: s.topGift,
                topStreak: s.topStreak,
                topCoins: s.topCoins,
                topLikes: s.topLikes
            }
        };

        await Settings.updateOne({ token: t }, updatePayload, { upsert: true });
        delete _settingsCache[t];
    }
};
