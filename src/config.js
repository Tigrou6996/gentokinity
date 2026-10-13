const Action = require('./models/Action');
const Event = require('./models/Event');
const Settings = require('./models/Settings');
const { isPremiumActive } = require('./features/plans');

// Values baked into the desktop build (see scripts/write-build-env.js). Missing in dev.
let buildEnv = {};
try { buildEnv = require('./build-env.json'); } catch (e) { }

// Settings that each scene keeps for itself (on top of its actions / events and its likes goal).
// A scene without its own copy yet inherits the settings in use when it is first opened.
const SCENE_OWN_SETTINGS = ['tts'];
// Points rules, viewers' points / levels and gift history (top gift, top streak, top coins / likes) are the same
// in every scene, stored at the root of the document. A scene marked "independent" keeps its own copy of these
// in its slot (and its own viewers' balances, see features/points.js).
const SHARED_FIELDS = ['topGift', 'topStreak', 'topCoins', 'topLikes', 'autoResetTopStats', 'autoResetLastX', 'points'];
// Per-scene values (stats / goals) and every field saveSettings may write
const SCENE_STATS_FIELDS = ['likesGoal', 'topGift', 'topStreak', 'topCoins', 'topLikes', 'autoResetTopStats', 'autoResetLastX'];
const sceneOf = (scenes, id) => (id && Array.isArray(scenes) ? scenes.find(sc => sc && sc.id === id) : null) || null;
const isIndependent = (scenes, id) => !!(sceneOf(scenes, id) || {}).independent;
const SAVED_FIELDS = ['username', 'ip', 'activeSceneId', 'scenes', 'minecraft', 'obs', 'language', 'runMode', 'streamerbot',
    'points', 'spotify', 'tts', 'lastEvents', ...SCENE_STATS_FIELDS];
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
function mergeTts(base, own) {
    return { ...base, ...own, allowedUsers: { ...(base.allowedUsers || {}), ...((own && own.allowedUsers) || {}) } };
}

// Actions / events as plain objects of this scene: Mongoose documents (spreading one copies its internals,
// not its fields), another account's _id / token (imported files) and duplicates are removed.
function cleanItems(list) {
    const byId = new Map();
    for (const item of Array.isArray(list) ? list : []) {
        if (!item || typeof item !== 'object') continue;
        const o = item.toObject ? item.toObject() : { ...item };
        delete o._id; delete o.__v; delete o.token; delete o.sceneId; delete o.createdAt; delete o.updatedAt;
        if (!o.id) o.id = `item_${Date.now()}_${Math.round(Math.random() * 1e9)}`;
        byId.set(String(o.id), o);
    }
    return Array.from(byId.values());
}

// Replaces the items of the active scene. The new list is validated BEFORE the old one is deleted, and the
// old one is put back if the insert fails: a bad item can no longer leave the scene empty.
async function replaceSceneItems(Model, s, items) {
    const docs = items.map(i => ({ ...i, token: s.token, sceneId: s.activeSceneId }));
    for (const d of docs) {
        const err = new Model(d).validateSync();
        if (err) throw new Error(`Élément invalide (${d.name || d.id}) : ${err.message}`);
    }
    const previous = await Model.find({ token: s.token, sceneId: s.activeSceneId }).lean();
    await Model.deleteMany({ token: s.token, sceneId: s.activeSceneId });
    try {
        if (docs.length) await Model.insertMany(docs, { ordered: true });
    } catch (e) {
        await Model.deleteMany({ token: s.token, sceneId: s.activeSceneId }).catch(() => { });
        if (previous.length) await Model.insertMany(previous).catch(() => { });
        throw e;
    }
}

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
    obs: {
        host: '127.0.0.1',
        port: 4455,
        password: ''
    },
    language: 'fr',
    runMode: 'auto', // where the live connection runs: auto | cloud (Gentok servers) | pc (Windows app)
    streamerbot: { host: '127.0.0.1', port: 7474 },
    points: null,
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
        filterCommands: true,
        readChat: true,
        events: {}
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

// Secure desktop app ("relay mode"): the packaged app has no database address (nor any other secret). It only
// connects to the TikTok live and runs the PC actions; the Gentok server processes the live (points, rankings,
// actions...) with the events the app relays to it (see utils/liveRelay.js). Its session lives in memory and
// the account it is logged into is kept in a local file.
const fs = require('fs');
const path = require('path');
function appDataFile() {
    const base = process.env.APPDATA || (process.platform === 'darwin'
        ? path.join(require('os').homedir(), 'Library', 'Application Support')
        : path.join(require('os').homedir(), '.config'));
    return path.join(base, 'Gentok', 'app-session.json');
}
function readLocalToken() {
    try { return JSON.parse(fs.readFileSync(appDataFile(), 'utf8')).token || null; } catch (e) { return null; }
}
function writeLocalToken(token) {
    try {
        fs.mkdirSync(path.dirname(appDataFile()), { recursive: true });
        fs.writeFileSync(appDataFile(), JSON.stringify({ token }), { mode: 0o600 });
    } catch (e) { /* read-only profile: the account is asked again next time */ }
}

// "Last active token" fallback: only in the desktop app (one streamer). On the VPS many streamers share the
// server, so a request without a token must never fall back on whoever was loaded last (it exposed their
// config, OBS password and token, and let anonymous requests change their data).
function fallbackToken() {
    return module.exports.isAppMode ? _lastActiveToken : null;
}

// Internal helper to get session by token
function getSession(token) {
    const t = token || fallbackToken();
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
        if (this.relayMode) {
            // no database in the secure app: a session in memory (the server holds the real settings)
            const s = _sessions.get(token) || Object.assign(getSessionDefaults(), { token });
            _sessions.set(token, s);
            if (readLocalToken() !== token) writeLocalToken(token);
            return;
        }

        // [ATOMIC] Build new session state locally to avoid race conditions
        const newSession = getSessionDefaults();
        newSession.token = token;

        const settings = await Settings.findOne({ token });
        const activeSceneId = settings ? settings.activeSceneId : null;

        const [events, actions] = await Promise.all([
            Event.find({ token, sceneId: activeSceneId }).lean(),
            Action.find({ token, sceneId: activeSceneId }).lean()
        ]);

        newSession.events = events || [];
        newSession.actions = actions || [];

        if (settings) {
            newSession.username = settings.username || null;
            newSession.ip = settings.ip || null;
            newSession.isPremium = isPremiumActive(settings);
            newSession.activeSceneId = settings.activeSceneId || null;
            newSession.scenes = settings.scenes || [];

            if (settings.minecraft) {
                newSession.minecraft = { ...newSession.minecraft, ...settings.minecraft };
            }
            if (settings.obs) {
                const obs = settings.obs.toObject ? settings.obs.toObject() : settings.obs;
                newSession.obs = { ...newSession.obs, ...obs };
            }
            if (settings.language) newSession.language = settings.language;
            if (settings.runMode) newSession.runMode = settings.runMode;
            if (settings.streamerbot) {
                const sb = settings.streamerbot.toObject ? settings.streamerbot.toObject() : settings.streamerbot;
                newSession.streamerbot = { ...newSession.streamerbot, ...sb };
            }
            if (settings.points) newSession.points = settings.points;
            // TikTok account answering in the chat (its cookies stay on the server: see features/chatbot.js)
            if (settings.chatbot) newSession.chatbot = settings.chatbot.toObject ? settings.chatbot.toObject() : settings.chatbot;
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
            if (settings.autoResetTopStats !== undefined) newSession.autoResetTopStats = !!settings.autoResetTopStats;
            if (settings.autoResetLastX !== undefined) newSession.autoResetLastX = !!settings.autoResetLastX;

            // The active scene's own values: its likes goal and TTS always, the shared values (points rules,
            // gift history) only when the scene is independent
            if (activeSceneId) {
                const activeScene = (settings.scenes || []).find(sc => sc.id === activeSceneId);
                if (activeScene) {
                    if (activeScene.likesGoal) newSession.likesGoal = { ...newSession.likesGoal, ...activeScene.likesGoal };
                    if (activeScene.tts) newSession.tts = mergeTts(newSession.tts, activeScene.tts);
                    if (activeScene.independent) {
                        if (activeScene.topGift) newSession.topGift = { ...newSession.topGift, ...activeScene.topGift };
                        if (activeScene.topStreak) newSession.topStreak = { ...newSession.topStreak, ...activeScene.topStreak };
                        if (activeScene.topCoins) newSession.topCoins = { ...newSession.topCoins, ...activeScene.topCoins };
                        if (activeScene.topLikes) newSession.topLikes = { ...newSession.topLikes, ...activeScene.topLikes };
                        if (activeScene.autoResetTopStats !== undefined) newSession.autoResetTopStats = activeScene.autoResetTopStats;
                        if (activeScene.autoResetLastX !== undefined) newSession.autoResetLastX = activeScene.autoResetLastX;
                        if (activeScene.points) newSession.points = { ...(newSession.points || {}), ...activeScene.points };
                    }
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
        if (s.token && !this.relayMode) Settings.updateOne({ token: s.token }, { username: val }, { upsert: true }).exec();
    },

    get licenseToken() { return fallbackToken(); },
    set licenseToken(val) { _lastActiveToken = val; },

    // Never hardcode credentials here: they come from .env (dev / VPS) or from
    // src/build-env.json, generated at build time by scripts/write-build-env.js.
    mongodbUri: process.env.MONGODB_URI || buildEnv.MONGODB_URI || null,
    /** Desktop app without database access (the packaged app): the server processes the live */
    get relayMode() { return this.isAppMode && !this.mongodbUri; },
    readLocalToken,
    writeLocalToken,
    // Optional Euler Stream key: raises TikTok signature rate limits (fewer connection failures)
    signApiKey: process.env.SIGN_API_KEY || buildEnv.SIGN_API_KEY || null,
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
        const t = token || fallbackToken();
        if (!t) return getSessionDefaults();
        if (this.relayMode) return _sessions.get(t) || Object.assign(getSessionDefaults(), { token: t });
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
            result.isPremium = isPremiumActive(s);

            // [FIX] Scene Isolation in getSettings (Consistency with loadSession)
            if (result.activeSceneId && result.scenes) {
                const activeScene = result.scenes.find(sc => sc.id === result.activeSceneId);
                if (activeScene) {
                    // result already contains root-level (shared) settings from the spread above.
                    // The scene's own values are laid over them (shared ones only for an independent scene).
                    if (activeScene.likesGoal) result.likesGoal = { ...result.likesGoal, ...activeScene.likesGoal };
                    if (activeScene.tts) result.tts = mergeTts(result.tts, activeScene.tts);
                    if (activeScene.independent) {
                        if (activeScene.topGift) result.topGift = { ...result.topGift, ...activeScene.topGift };
                        if (activeScene.topStreak) result.topStreak = { ...result.topStreak, ...activeScene.topStreak };
                        if (activeScene.topCoins) result.topCoins = { ...result.topCoins, ...activeScene.topCoins };
                        if (activeScene.topLikes) result.topLikes = { ...result.topLikes, ...activeScene.topLikes };
                        if (activeScene.autoResetTopStats !== undefined) result.autoResetTopStats = activeScene.autoResetTopStats;
                        if (activeScene.autoResetLastX !== undefined) result.autoResetLastX = activeScene.autoResetLastX;
                        if (activeScene.points) result.points = { ...(result.points || {}), ...activeScene.points };
                    }
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
    // Session already in memory for this token (no loading), or the defaults
    peekSession(token) {
        return (token && _sessions.get(token)) || getSessionDefaults();
    },

    SHARED_FIELDS,
    isSceneIndependent(token, sceneId) {
        const s = token && _sessions.get(token);
        return !!s && isIndependent(s.scenes, sceneId === undefined ? s.activeSceneId : sceneId);
    },

    // Key of the viewers' points: the account, or the account + scene when the active scene is independent
    pointsScope(token) {
        if (!token || String(token).includes('#scene:')) return token;
        const s = _sessions.get(token);
        return s && s.activeSceneId && isIndependent(s.scenes, s.activeSceneId) ? `${token}#scene:${s.activeSceneId}` : token;
    },

    /**
     * Makes a scene keep its own points rules, viewers' points / levels and gift history (independent = true),
     * or use the ones shared by all the scenes again (false). A scene that becomes independent starts from a
     * copy of the shared gift history and points rules; its viewers' balances start at zero.
     */
    async setSceneIndependent(token, sceneId, independent) {
        if (!token || !sceneId) throw new Error('Scène manquante');
        if (this.relayMode) throw new Error('Indisponible dans l\'application : utilisez le serveur Gentok');
        const doc = await Settings.findOne({ token }).select(['scenes', ...SHARED_FIELDS].join(' ')).lean();
        const idx = doc && Array.isArray(doc.scenes) ? doc.scenes.findIndex(sc => sc.id === sceneId) : -1;
        if (idx === -1) throw new Error('Scène introuvable');
        const set = { [`scenes.${idx}.independent`]: !!independent };
        if (independent && !doc.scenes[idx].independent) {
            const defaults = getSessionDefaults();
            for (const k of SHARED_FIELDS) {
                const v = doc[k] !== undefined && doc[k] !== null ? doc[k] : (k === 'points' ? {} : defaults[k]);
                set[`scenes.${idx}.${k}`] = clone(v);
            }
        }
        await Settings.updateOne({ token, [`scenes.${idx}.id`]: sceneId }, { $set: set });
        delete _settingsCache[token];
        await this.loadSession(token);
        return !!independent;
    },

    async getSessionFor(token) {
        if (!token) return getSession();
        if (!_sessions.has(token)) await this.loadSession(token);
        return _sessions.get(token);
    },

    async saveEvents(events, token) {
        if (this.relayMode) return; // the server keeps the events
        const s = await this.getSessionFor(token); if (!s.token) return;
        const list = cleanItems(events);
        s.events = (!s.isPremium && list.length > 5) ? list.slice(0, 5) : list;
        await replaceSceneItems(require('./models/Event'), s, s.events);
    },

    async saveActions(actions, token) {
        if (this.relayMode) return; // the server keeps the actions
        const s = await this.getSessionFor(token); if (!s.token) return;
        const list = cleanItems(actions);
        s.actions = (!s.isPremium && list.length > 5) ? list.slice(0, 5) : list;
        await replaceSceneItems(require('./models/Action'), s, s.actions);
    },

    /**
     * Adds / updates / removes some actions or events of the active scene without resending the whole list
     * (two tabs, or the website and the app, no longer undo each other's changes).
     * Removing actions also removes them from the events that used them.
     * @param {'actions'|'events'} kind
     * @returns {Promise<{ items: object[], removed: string[], total: number }>}
     */
    async applyItemChanges(kind, token, { upsert = [], remove = [] } = {}) {
        if (this.relayMode) throw Object.assign(new Error('Indisponible dans l\'application : utilisez le serveur Gentok'), { status: 409 });
        const Model = kind === 'actions' ? Action : Event;
        const s = await this.getSessionFor(token);
        if (!s.token) throw Object.assign(new Error('Session introuvable'), { status: 401 });
        const scope = { token: s.token, sceneId: s.activeSceneId };
        const items = cleanItems(upsert);
        const removeIds = Array.from(new Set((Array.isArray(remove) ? remove : []).map(String))).filter(id => !items.some(i => String(i.id) === id));

        const existing = new Set((await Model.find(scope).select('id').lean()).map(d => String(d.id)));
        const finalCount = new Set([...existing, ...items.map(i => String(i.id))].filter(id => !removeIds.includes(id))).size;
        if (!s.isPremium && finalCount > 5 && items.some(i => !existing.has(String(i.id)))) {
            throw Object.assign(new Error(`Limite de 5 ${kind === 'actions' ? 'actions' : 'événements'} par scène en gratuit : passez Premium pour en ajouter plus.`), { status: 403 });
        }
        const docs = items.map(i => ({ ...i, ...scope }));
        for (const d of docs) {
            const err = new Model(d).validateSync();
            if (err) throw Object.assign(new Error(`Élément invalide (${d.name || d.id}) : ${err.message}`), { status: 400 });
        }
        const ops = docs.map(d => ({ replaceOne: { filter: { ...scope, id: d.id }, replacement: d, upsert: true } }));
        if (removeIds.length) ops.push({ deleteMany: { filter: { ...scope, id: { $in: removeIds } } } });
        if (ops.length) await Model.bulkWrite(ops, { ordered: true });
        if (kind === 'actions' && removeIds.length) {
            const using = await Event.find({ ...scope, actions: { $in: removeIds } }).select('id actions').lean();
            if (using.length) {
                await Event.bulkWrite(using.map(e => ({
                    updateOne: { filter: { ...scope, id: e.id }, update: { $set: { actions: (e.actions || []).filter(a => !removeIds.includes(String(a))) } } }
                })));
            }
        }

        // The session follows the database (the live connector reads its actions / events from it)
        const [actions, events] = await Promise.all([Action.find(scope).lean(), Event.find(scope).lean()]);
        s.actions = actions;
        s.events = events;
        return { items: docs.map(d => { const o = { ...d }; delete o.token; delete o.sceneId; return o; }), removed: removeIds, total: kind === 'actions' ? actions.length : events.length };
    },

    async saveSettings(data) {
        const t = data.token || fallbackToken(); if (!t) return;
        if (this.relayMode) {
            // memory only (e.g. the username of the live started on this PC); the server stores the settings
            const s = _sessions.get(t) || Object.assign(getSessionDefaults(), { token: t });
            for (const k of ['username', 'likesGoal', 'topGift', 'topStreak', 'lastEvents', 'runMode']) if (data[k] !== undefined) s[k] = data[k];
            _sessions.set(t, s);
            return;
        }
        if (!_sessions.has(t)) await this.loadSession(t);
        const s = _sessions.get(t);
        const previousSceneId = s.activeSceneId;
        const isSwitching = data.activeSceneId !== undefined && data.activeSceneId !== previousSceneId;
        const wasIndependent = isIndependent(s.scenes, previousSceneId);

        // [FIX] If switching scenes, save current state to the OLD scene before clearing session stats
        if (isSwitching && previousSceneId) {
            const prevIndex = s.scenes.findIndex(sc => sc.id === previousSceneId);
            if (prevIndex !== -1) {
                s.scenes[prevIndex].likesGoal = clone(s.likesGoal);
                for (const k of SCENE_OWN_SETTINGS) s.scenes[prevIndex][k] = clone(s[k]);
                // an independent scene keeps its gift history / points rules; the shared ones are already at the root
                if (wasIndependent) for (const k of SHARED_FIELDS) s.scenes[prevIndex][k] = clone(s[k]);
            }

            // The likes goal is the scene's own: back to the defaults (loadSession then reads the new scene's)
            const defaults = getSessionDefaults();
            s.likesGoal = clone(defaults.likesGoal);
            // Leaving an independent scene: the shared values come back
            if (wasIndependent) {
                const root = await Settings.findOne({ token: t }).select(SHARED_FIELDS.join(' ')).lean() || {};
                for (const k of SHARED_FIELDS) {
                    if (k === 'points') s.points = root.points || {};
                    else if (typeof defaults[k] === 'object' && defaults[k] !== null) s[k] = { ...clone(defaults[k]), ...(root[k] || {}) };
                    else s[k] = root[k] !== undefined ? root[k] : defaults[k];
                }
            }
        }

        if (data.username) s.username = data.username;
        if (data.ip) s.ip = data.ip;
        if (data.isPremium !== undefined) s.isPremium = data.isPremium;
        if (data.activeSceneId !== undefined) s.activeSceneId = data.activeSceneId;
        if (data.scenes !== undefined) {
            // The dashboard sends the list (id, title...): what each scene already keeps (goals, top stats,
            // TTS, points rules) must not be lost when a scene is added or renamed
            const plain = (sc) => (sc && sc.toObject ? sc.toObject() : sc);
            const merged = (Array.isArray(data.scenes) ? data.scenes : []).map(sc => ({ ...(plain(s.scenes.find(e => e.id === sc.id)) || {}), ...sc }));
            s.scenes = (!s.isPremium && merged.length > 2) ? merged.slice(0, 2) : merged;
        }
        if (data.minecraft) s.minecraft = { ...s.minecraft, ...data.minecraft };
        if (data.obs) s.obs = { ...s.obs, ...data.obs };
        if (data.streamerbot) s.streamerbot = { ...s.streamerbot, ...data.streamerbot };
        if (data.points && typeof data.points === 'object') s.points = { ...(s.points || {}), ...data.points };
        if (typeof data.language === 'string' && /^[a-z]{2}$/.test(data.language)) s.language = data.language;
        if (['auto', 'cloud', 'pc'].includes(data.runMode)) s.runMode = data.runMode;
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

        // The fields kept by the active scene itself: its likes goal and TTS, plus the shared ones if it is independent
        const activeIndependent = isIndependent(s.scenes, s.activeSceneId);
        const ownKeys = new Set(['likesGoal', ...SCENE_OWN_SETTINGS, ...(activeIndependent ? SHARED_FIELDS : [])]);

        // [PERSISTENCE] If we are NOT switching and have an active scene, update its specific slot too
        if (!isSwitching && s.activeSceneId) {
            const activeIndex = s.scenes.findIndex(sc => sc.id === s.activeSceneId);
            if (activeIndex !== -1) {
                for (const k of ownKeys) if (data[k] !== undefined && data[k] !== null) s.scenes[activeIndex][k] = clone(s[k]);
            }
        }

        // Opening a scene: it uses its own TTS, or keeps a copy of the current one. An independent scene also uses
        // its own points rules / gift history (a copy of the shared ones the first time).
        if (isSwitching && s.activeSceneId) {
            const idx = s.scenes.findIndex(sc => sc.id === s.activeSceneId);
            if (idx !== -1) {
                const scene = s.scenes[idx];
                if (scene.tts) s.tts = mergeTts(s.tts, clone(scene.tts)); else scene.tts = clone(s.tts);
                if (scene.independent) {
                    for (const k of SHARED_FIELDS) {
                        if (scene[k] === undefined || scene[k] === null) scene[k] = clone(k === 'points' ? (s.points || {}) : s[k]);
                    }
                }
            }
        }

        // Only the fields this call changed are written. Writing the whole session made a stale copy (e.g. the
        // desktop app saving its live stats every few seconds) undo what was changed meanwhile on the website.
        const touched = new Set(Object.keys(data).filter(k => data[k] !== undefined && SAVED_FIELDS.includes(k)));
        if (isSwitching) {
            ['activeSceneId', 'scenes', 'tts', 'likesGoal'].forEach(k => touched.add(k));
            // the shared values are written back only when they are the ones in memory
            if (!activeIndependent) SHARED_FIELDS.forEach(k => touched.add(k));
        }
        const $set = {};
        touched.forEach(k => {
            // in an independent scene, its gift history / points rules never overwrite the shared ones
            if (activeIndependent && SHARED_FIELDS.includes(k)) return;
            $set[k] = k === 'runMode' ? (s.runMode || 'auto') : s[k];
        });

        // Premium is only written when explicitly given: the Stripe webhook / expiry job (other process)
        // own it, and a stale in-memory value must never overwrite a payment made meanwhile.
        if (data.isPremium !== undefined) $set.isPremium = !!data.isPremium;

        if (Object.keys($set).length) await Settings.updateOne({ token: t }, { $set }, { upsert: true });

        // The active scene's own copy of the values changed here, written in its slot only (not the whole list)
        if (!touched.has('scenes') && !isSwitching && s.activeSceneId) {
            const slotKeys = Array.from(ownKeys).filter(k => touched.has(k));
            if (slotKeys.length) {
                const doc = await Settings.findOne({ token: t }).select('scenes.id').lean();
                const idx = doc && Array.isArray(doc.scenes) ? doc.scenes.findIndex(sc => sc.id === s.activeSceneId) : -1;
                if (idx !== -1) {
                    const slot = s.scenes.find(sc => sc.id === s.activeSceneId) || {};
                    const set = {};
                    slotKeys.forEach(k => { set[`scenes.${idx}.${k}`] = slot[k] !== undefined ? slot[k] : s[k]; });
                    await Settings.updateOne({ token: t, [`scenes.${idx}.id`]: s.activeSceneId }, { $set: set });
                }
            }
        }
        delete _settingsCache[t];
    }
};
