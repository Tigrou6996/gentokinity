/**
 * Viewer points ("User & Points", like TikFinity cookies).
 *
 * Viewers earn points for gifts, likes, follows, shares, subscriptions, chat messages and
 * time spent being active in the live. Points are buffered in memory and written to MongoDB
 * every few seconds in one bulk operation (a busy live sends hundreds of events per second).
 *
 * XP (stored as levelPoints) decides the level: level = floor(sqrt(XP / levelFactor)). XP never
 * decreases (spending points in the shop does not lower the level). By default the XP earned equals the
 * points earned; the streamer can give XP its own rates (xpMode "custom").
 */
const ViewerPoints = require('../models/ViewerPoints');
const PointTransaction = require('../models/PointTransaction');
const logger = require('../utils/logger');
const { getPlan } = require('./plans');

const DEFAULT_SETTINGS = {
    enabled: true,
    perCoin: 10,          // per coin of gifts
    perLike: 0.2,         // per like
    perFollow: 50,
    perShare: 20,
    perSub: 300,
    perChat: 2,           // per chat message...
    chatCooldown: 30,     // ...at most once every X seconds per viewer
    perActiveMinute: 1,   // per minute for viewers active in the last 5 minutes
    levelFactor: 50,
    // Currency of the points (shown in the chat replies, overlays and dashboard): "cookies", "pièces"...
    currencyName: 'points',
    currencyEmoji: '🪙',
    // XP (levels): "same" = the XP earned equals the points earned; "custom" = own XP rates below.
    // XP never decreases (spending points in the shop keeps the level).
    xpMode: 'same',
    xpPerCoin: 10, xpPerLike: 0.2, xpPerFollow: 50, xpPerShare: 20, xpPerSub: 300, xpPerChat: 2, xpPerActiveMinute: 1,
    // !daily: bonus once every 20 h (0 = off); !give @pseudo 100: a viewer gives some of their currency (off by default)
    dailyAmount: 0,
    dailyCommand: '!daily',
    giveEnabled: false,
    giveCommand: '!give',
    scoreCommand: '!score',
    topCommand: '!top',
    commandCooldown: 15
};

const FLUSH_MS = 3000;
const buffers = new Map();       // token -> Map(uniqueId -> pending)
const userCountCache = new Map(); // token -> { count, at }
let flushTimer = null;

// Viewers' points are kept per account, or per account + scene for an independent scene (see config.pointsScope).
// A scope key is "<token>" or "<token>#scene:<sceneId>"; settings, overlays and the live connector use the token.
const scopeOf = (token) => require('../config').pointsScope(token);
const tokenOf = (key) => String(key || '').split('#scene:')[0];

function getSettings(settings) {
    const s = { ...DEFAULT_SETTINGS, ...((settings && settings.points) || {}) };
    s.currencyName = String(s.currencyName || '').trim().slice(0, 24) || DEFAULT_SETTINGS.currencyName;
    s.currencyEmoji = String(s.currencyEmoji || '').trim().slice(0, 8);
    return s;
}

/** "120 🍪 cookies" with the streamer's currency */
function formatAmount(s, n) {
    const v = Math.floor(Number(n) || 0).toLocaleString('fr-FR');
    return `${v} ${s.currencyEmoji ? s.currencyEmoji + ' ' : ''}${s.currencyName}`;
}

/** XP earned for `units` of something (coins, likes, 1 follow...) worth `amount` points */
function xpOf(s, rateKey, units, amount) {
    if (!s || s.xpMode !== 'custom') return amount;
    const rate = Number(s['xp' + rateKey.charAt(0).toUpperCase() + rateKey.slice(1)]);
    return Number.isFinite(rate) && rate > 0 ? units * rate : 0;
}

function levelFromPoints(levelPoints, factor = DEFAULT_SETTINGS.levelFactor) {
    return Math.floor(Math.sqrt(Math.max(0, levelPoints) / Math.max(1, factor)));
}

function pointsForLevel(level, factor = DEFAULT_SETTINGS.levelFactor) {
    return level * level * Math.max(1, factor);
}

function round2(n) {
    return Math.round(n * 100) / 100;
}

/**
 * Adds points to a viewer (buffered).
 * @param {string} token streamer token
 * @param {object} user { uniqueId, userId, nickname, profilePictureUrl }
 * @param {number} amount points to add (can be decimal)
 * @param {string} reason gift | like | follow | share | chat | sub | watch
 * @param {object} stats counters to increment, e.g. { likes: 15 }
 * @param {number} [xp] XP earned (defaults to the points)
 */
function award(token, user, amount, reason, stats = {}, xp = amount) {
    if (!token || !user || !user.uniqueId) return;
    token = scopeOf(token);
    if (!buffers.has(token)) buffers.set(token, new Map());
    const tokenBuf = buffers.get(token);
    const key = String(user.uniqueId);
    let p = tokenBuf.get(key);
    if (!p) {
        p = { user: {}, points: 0, xp: 0, stats: {}, reasons: {} };
        tokenBuf.set(key, p);
    }
    p.user = {
        uniqueId: user.uniqueId,
        userId: user.userId || p.user.userId,
        nickname: user.nickname || p.user.nickname,
        profilePictureUrl: user.profilePictureUrl || p.user.profilePictureUrl
    };
    if (amount > 0) {
        p.points += amount;
        p.reasons[reason] = (p.reasons[reason] || 0) + amount;
    }
    if (xp > 0) p.xp += xp;
    for (const [k, v] of Object.entries(stats)) p.stats[k] = (p.stats[k] || 0) + v;

    if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; flushAll(); }, FLUSH_MS);
}

async function countUsers(token) {
    token = scopeOf(token);
    const cached = userCountCache.get(token);
    if (cached && Date.now() - cached.at < 60000) return cached.count;
    const count = await ViewerPoints.countDocuments({ token });
    userCountCache.set(token, { count, at: Date.now() });
    return count;
}

// Writes the pending points of an account (all its scopes) or of one scope key
async function flushToken(token) {
    const keys = String(token).includes('#scene:') ? [token]
        : Array.from(buffers.keys()).filter(k => k === token || k.startsWith(`${token}#scene:`));
    for (const key of keys) await flushKey(key);
}

async function flushKey(token) {
    const tokenBuf = buffers.get(token);
    if (!tokenBuf || tokenBuf.size === 0) return;
    buffers.delete(token);

    try {
        const config = require('../config');
        const settings = await config.getSettings(tokenOf(token));
        const plan = getPlan(settings);
        // Free accounts keep up to maxPointsUsers viewers: beyond that only existing viewers progress
        const allowNew = (await countUsers(token)) < plan.maxPointsUsers;

        const ops = [];
        const transactions = [];
        const xpGains = [];
        const now = new Date();
        for (const [uniqueId, p] of tokenBuf) {
            const inc = {};
            const points = round2(p.points);
            const xp = round2(p.xp);
            if (points > 0) inc.points = points;
            if (xp > 0) {
                inc.levelPoints = xp;
                xpGains.push({ uniqueId, delta: xp });
            }
            for (const [k, v] of Object.entries(p.stats)) inc[`stats.${k}`] = v;
            const set = { lastActivity: now };
            if (p.user.nickname) set.nickname = p.user.nickname;
            if (p.user.profilePictureUrl) set.profilePictureUrl = p.user.profilePictureUrl;
            if (p.user.userId) set.userId = p.user.userId;

            const update = { $set: set, $setOnInsert: { firstActivity: now } };
            if (Object.keys(inc).length) update.$inc = inc;
            ops.push({ updateOne: { filter: { token, uniqueId }, update, upsert: allowNew } });

            if (points > 0) {
                const details = Object.entries(p.reasons).map(([r, v]) => `${r}:${round2(v)}`).join(', ');
                const mainReason = Object.entries(p.reasons).sort((a, b) => b[1] - a[1])[0][0];
                transactions.push({ token, uniqueId, nickname: p.user.nickname, delta: points, reason: mainReason, details, date: now });
            }
        }
        if (ops.length) await ViewerPoints.bulkWrite(ops, { ordered: false });
        if (transactions.length) await PointTransaction.insertMany(transactions, { ordered: false });
        userCountCache.delete(token);
        if (xpGains.length) await announceLevelUps(token, xpGains, getSettings(settings).levelFactor);
    } catch (err) {
        logger.error(`[POINTS] Sauvegarde impossible : ${err.message}`);
    }
}

// Set by server.js (it owns the live connectors): avoids a circular require
let getConnector = () => null;
function setConnectorLookup(fn) {
    if (typeof fn === 'function') getConnector = fn;
}

/** Tells the overlays which viewers just reached a new level (the "Points & !score" overlay celebrates it) */
async function announceLevelUps(token, transactions, factor) {
    const gained = new Map(transactions.map(t => [t.uniqueId, t.delta]));
    const docs = await ViewerPoints.find({ token, uniqueId: { $in: [...gained.keys()] } },
        { uniqueId: 1, nickname: 1, profilePictureUrl: 1, points: 1, levelPoints: 1 }).lean();
    const { emitEvent } = require('../utils/socket');
    // "Passage de niveau" events of the dashboard run on the live connector, when one is active
    const connector = getConnector(tokenOf(token));
    let sent = 0;
    for (const d of docs) {
        const level = levelFromPoints(d.levelPoints, factor);
        if (level < 1 || level <= levelFromPoints(d.levelPoints - gained.get(d.uniqueId), factor)) continue;
        emitEvent('points_levelup', {
            uniqueId: d.uniqueId, nickname: d.nickname || d.uniqueId, profilePictureUrl: d.profilePictureUrl,
            level, points: Math.floor(d.points)
        }, tokenOf(token));
        if (connector && !connector.isStopping) {
            const actionManager = require('../actions/actionManager');
            actionManager.executeAction('level_up', {
                uniqueId: d.uniqueId, nickname: d.nickname || d.uniqueId, profilePictureUrl: d.profilePictureUrl, level
            }, connector).catch(err => logger.warn(`[POINTS] Événement « passage de niveau » : ${err.message}`));
        }
        if (++sent >= 10) break; // a burst (e.g. after a long disconnection) must not flood the overlay
    }
}

async function flushAll() {
    for (const key of Array.from(buffers.keys())) await flushKey(key);
}

/** Balance + level of one viewer (pending points included) */
async function getViewer(token, uniqueId, settings) {
    token = scopeOf(token);
    await flushToken(token);
    const s = getSettings(settings);
    const doc = await ViewerPoints.findOne({ token, uniqueId }).lean();
    if (!doc) return null;
    const rank = (await ViewerPoints.countDocuments({ token, points: { $gt: doc.points } })) + 1;
    return decorate(doc, s, rank);
}

function decorate(doc, s, rank) {
    const level = levelFromPoints(doc.levelPoints || 0, s.levelFactor);
    const current = pointsForLevel(level, s.levelFactor);
    const next = pointsForLevel(level + 1, s.levelFactor);
    return {
        uniqueId: doc.uniqueId,
        nickname: doc.nickname || doc.uniqueId,
        profilePictureUrl: doc.profilePictureUrl || '',
        points: round2(doc.points || 0),
        levelPoints: round2(doc.levelPoints || 0),
        xp: round2(doc.levelPoints || 0),
        level,
        nextLevelPoints: next,
        progress: next > current ? Math.min(1, ((doc.levelPoints || 0) - current) / (next - current)) : 0,
        rank,
        stats: doc.stats || {},
        firstActivity: doc.firstActivity,
        lastActivity: doc.lastActivity
    };
}

async function getTop(token, limit = 10, settings, sortField = 'points') {
    token = scopeOf(token);
    await flushToken(token);
    const s = getSettings(settings);
    const field = sortField === 'levelPoints' ? 'levelPoints' : 'points';
    const docs = await ViewerPoints.find({ token }).sort({ [field]: -1 }).limit(Math.min(Math.max(limit, 1), 100)).lean();
    return docs.map((d, i) => decorate(d, s, i + 1));
}

/**
 * Removes points if the viewer has enough (used by events with a points cost).
 * @returns {Promise<boolean>} true if paid
 */
async function spend(token, user, cost, reason = 'spend', details = '') {
    if (!cost || cost <= 0) return true;
    token = scopeOf(token);
    await flushToken(token);
    const res = await ViewerPoints.findOneAndUpdate(
        { token, uniqueId: user.uniqueId, points: { $gte: cost } },
        { $inc: { points: -cost }, $set: { lastActivity: new Date() } },
        { new: true }
    );
    if (!res) return false;
    await PointTransaction.create({ token, uniqueId: user.uniqueId, nickname: user.nickname, delta: -cost, reason, details });
    return true;
}

/** Manual change from the dashboard (positive or negative) */
async function adjust(token, uniqueId, delta, nickname) {
    token = scopeOf(token);
    await flushToken(token);
    const update = { $inc: { points: delta }, $set: { lastActivity: new Date() }, $setOnInsert: { firstActivity: new Date(), nickname: nickname || uniqueId } };
    if (delta > 0) update.$inc.levelPoints = delta;
    const doc = await ViewerPoints.findOneAndUpdate({ token, uniqueId }, update, { upsert: true, new: true });
    if (doc.points < 0) await ViewerPoints.updateOne({ _id: doc._id }, { $set: { points: 0 } });
    userCountCache.delete(token);
    await PointTransaction.create({ token, uniqueId, nickname: doc.nickname, delta, reason: 'manual' });
    return doc;
}

const DAILY_EVERY_MS = 20 * 3600 * 1000;

/**
 * !daily: adds the bonus if the viewer did not get it in the last 20 hours.
 * @returns {Promise<{ ok: boolean, points?: number, nextInMs?: number }>}
 */
async function claimDaily(token, user, amount, xp = amount) {
    token = scopeOf(token);
    if (!(amount > 0) || !user || !user.uniqueId) return { ok: false };
    await flushToken(token);
    const now = new Date();
    const inc = { points: amount };
    if (xp > 0) inc.levelPoints = xp;
    const doc = await ViewerPoints.findOneAndUpdate(
        { token, uniqueId: user.uniqueId, $or: [{ lastDaily: { $exists: false } }, { lastDaily: null }, { lastDaily: { $lt: new Date(now - DAILY_EVERY_MS) } }] },
        { $inc: inc, $set: { lastDaily: now, lastActivity: now } },
        { new: true }
    ).catch(() => null);
    if (!doc) {
        const existing = await ViewerPoints.findOne({ token, uniqueId: user.uniqueId }).select('lastDaily').lean();
        if (!existing) {
            // first time we see this viewer: create them with the bonus
            try {
                const created = await ViewerPoints.create({ token, uniqueId: user.uniqueId, userId: user.userId, nickname: user.nickname || user.uniqueId, profilePictureUrl: user.profilePictureUrl, points: amount, levelPoints: xp > 0 ? xp : 0, lastDaily: now });
                await PointTransaction.create({ token, uniqueId: user.uniqueId, nickname: user.nickname, delta: amount, reason: 'daily' });
                userCountCache.delete(token);
                return { ok: true, points: created.points };
            } catch (e) { return { ok: false }; }
        }
        return { ok: false, nextInMs: Math.max(0, new Date(existing.lastDaily).getTime() + DAILY_EVERY_MS - now.getTime()) };
    }
    await PointTransaction.create({ token, uniqueId: user.uniqueId, nickname: user.nickname, delta: amount, reason: 'daily' });
    return { ok: true, points: doc.points };
}

/**
 * !give: moves points from one viewer to another (the level / XP of neither changes).
 * @returns {Promise<{ ok: boolean, reason?: 'self'|'amount'|'unknown'|'funds', from?: number, to?: number, nickname?: string }>}
 */
async function transfer(token, from, toUniqueId, amount) {
    token = scopeOf(token);
    amount = Math.floor(Number(amount));
    toUniqueId = String(toUniqueId || '').replace(/^@/, '').trim();
    if (!toUniqueId || toUniqueId.toLowerCase() === String(from.uniqueId).toLowerCase()) return { ok: false, reason: 'self' };
    if (!Number.isFinite(amount) || amount < 1 || amount > 1e9) return { ok: false, reason: 'amount' };
    await flushToken(token);
    const target = await ViewerPoints.findOne({ token, uniqueId: new RegExp(`^${toUniqueId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).select('uniqueId nickname').lean();
    if (!target) return { ok: false, reason: 'unknown' };
    const paid = await ViewerPoints.findOneAndUpdate(
        { token, uniqueId: from.uniqueId, points: { $gte: amount } },
        { $inc: { points: -amount }, $set: { lastActivity: new Date() } }, { new: true });
    if (!paid) return { ok: false, reason: 'funds' };
    const got = await ViewerPoints.findOneAndUpdate({ token, uniqueId: target.uniqueId }, { $inc: { points: amount } }, { new: true });
    await PointTransaction.insertMany([
        { token, uniqueId: from.uniqueId, nickname: from.nickname, delta: -amount, reason: 'give', details: `→ ${target.uniqueId}` },
        { token, uniqueId: target.uniqueId, nickname: target.nickname, delta: amount, reason: 'give', details: `← ${from.uniqueId}` }
    ], { ordered: false });
    return { ok: true, from: paid.points, to: got ? got.points : amount, nickname: target.nickname || target.uniqueId, uniqueId: target.uniqueId };
}

async function reset(token) {
    token = scopeOf(token);
    buffers.delete(token);
    userCountCache.delete(token);
    const r = await ViewerPoints.deleteMany({ token });
    await PointTransaction.deleteMany({ token });
    return r.deletedCount;
}

/**
 * Imports viewers from a file the streamer downloaded himself (another tool's export, a Gentok CSV...).
 * rows: [{ uniqueId, nickname, userId, profilePictureUrl, points, levelPoints }], at most 500 per call.
 * mode 'set': the balance becomes the imported value (XP never goes down); 'add': added to the balance.
 */
async function importRows(token, rows, mode = 'set') {
    token = scopeOf(token);
    await flushToken(token);
    const ops = [];
    const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
    for (const r of (Array.isArray(rows) ? rows : []).slice(0, 500)) {
        const uniqueId = clean(r && r.uniqueId, 64).replace(/^@/, '');
        const pts = Math.max(0, Math.round(Number(r && r.points) || 0));
        const xp = Math.max(pts, Math.round(Number(r && r.levelPoints) || 0));
        if (!uniqueId || !/^[\w.\-]+$/.test(uniqueId)) continue;
        const pic = clean(r.profilePictureUrl, 600);
        const set = { nickname: clean(r.nickname, 80) || uniqueId };
        if (r.userId) set.userId = clean(r.userId, 40);
        if (/^https:\/\//i.test(pic)) set.profilePictureUrl = pic;
        const update = mode === 'add'
            ? { $inc: { points: pts, levelPoints: xp }, $set: set, $setOnInsert: { firstActivity: new Date(), lastActivity: new Date() } }
            : { $set: { ...set, points: pts }, $max: { levelPoints: xp }, $setOnInsert: { firstActivity: new Date(), lastActivity: new Date() } };
        ops.push({ updateOne: { filter: { token, uniqueId }, update, upsert: true } });
    }
    if (!ops.length) return { imported: 0 };
    await ViewerPoints.bulkWrite(ops, { ordered: false });
    userCountCache.delete(token);
    return { imported: ops.length };
}

module.exports = {
    importRows,
    scopeOf, tokenOf, xpOf, formatAmount, claimDaily, transfer,
    DEFAULT_SETTINGS, getSettings, award, flushToken, flushAll, getViewer, getTop, spend, adjust, reset,
    levelFromPoints, pointsForLevel, decorate, countUsers, setConnectorLookup
};
