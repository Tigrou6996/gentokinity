/**
 * "Donateurs présents" (like Viraloria): who is in the live right now and how much each viewer
 * has already given to this streamer, so the big donors can be welcomed. Private to the streamer
 * (dashboard panel + /overlay/donors to use as an OBS dock / Live Studio window).
 *
 * - Presence: anyone who joins, chats, likes, shares, follows or sends a gift. TikTok sends no
 *   "leave" event, so a viewer silent for 10 minutes is considered gone.
 * - Budget: coins already given to this streamer (Gentok leaderboard, all past lives) + coins of this live.
 *   Gentok only knows the gifts sent to this account's lives, not to other streamers.
 */
const PRESENT_MS = 10 * 60 * 1000;
const EMIT_EVERY_MS = 1500;
const MAX_LIST = 50;

const TIERS = [
    { id: 'whale', min: 10000, label: 'Baleine' },
    { id: 'big', min: 1000, label: 'Gros donateur' },
    { id: 'supporter', min: 100, label: 'Soutien' },
    { id: 'small', min: 1, label: 'Donateur' },
    { id: 'new', min: 0, label: 'Nouveau' }
];

const rooms = new Map(); // token -> { viewers: Map(uniqueId -> entry), pending: Set, timer, emitTimer }

// Tests replace the database lookup
let lookupLifetime = async (token, ids) => {
    const Leaderboard = require('../models/Leaderboard');
    const rows = await Leaderboard.find({ token, uniqueId: { $in: ids } }).select('uniqueId totalCoins').lean();
    return new Map(rows.map(r => [r.uniqueId, Number(r.totalCoins) || 0]));
};
function setLookup(fn) { lookupLifetime = fn; }

let emitter = (token, event, payload) => require('../utils/socket').emitEvent(event, payload, token);
function setEmitter(fn) { emitter = fn; }

function tierOf(coins) {
    return TIERS.find(t => coins >= t.min) || TIERS[TIERS.length - 1];
}

function roomOf(token) {
    if (!rooms.has(token)) rooms.set(token, { viewers: new Map(), pending: new Set(), timer: null, emitTimer: null, alertMin: 1000 });
    return rooms.get(token);
}

function view(e) {
    const total = (e.before || 0) + e.liveCoins;
    const tier = tierOf(total);
    return {
        uniqueId: e.uniqueId, nickname: e.nickname, profilePictureUrl: e.profilePictureUrl,
        totalCoins: total, liveCoins: e.liveCoins, previousCoins: e.before || 0,
        tier: tier.id, tierLabel: tier.label, firstSeen: e.firstSeen, lastSeen: e.lastSeen, known: e.before !== null
    };
}

function list(token) {
    const room = rooms.get(token);
    if (!room) return { viewers: [], present: 0, donors: 0, totalCoins: 0 };
    const now = Date.now();
    const present = [];
    for (const [id, e] of room.viewers) {
        if (now - e.lastSeen > PRESENT_MS) { room.viewers.delete(id); continue; }
        present.push(view(e));
    }
    present.sort((a, b) => (b.totalCoins - a.totalCoins) || (b.lastSeen - a.lastSeen));
    const donors = present.filter(v => v.totalCoins > 0);
    return {
        viewers: present.slice(0, MAX_LIST),
        present: present.length,
        donors: donors.length,
        totalCoins: donors.reduce((s, v) => s + v.totalCoins, 0)
    };
}

function scheduleEmit(token) {
    const room = roomOf(token);
    if (room.emitTimer) return;
    room.emitTimer = setTimeout(() => {
        room.emitTimer = null;
        emitter(token, 'donors_update', list(token));
    }, EMIT_EVERY_MS);
}

// Past coins are read in small batches (one query for everybody who arrived in the last moment)
function scheduleLookup(token) {
    const room = roomOf(token);
    if (room.timer) return;
    room.timer = setTimeout(async () => {
        room.timer = null;
        const ids = Array.from(room.pending);
        room.pending.clear();
        if (!ids.length) return;
        let found = new Map();
        try { found = await lookupLifetime(token, ids); } catch (e) { /* database busy: shown as unknown */ }
        for (const id of ids) {
            const e = room.viewers.get(id);
            if (!e) continue;
            e.before = found.get(id) || 0;
            const total = e.before + e.liveCoins;
            if (!e.alerted && total >= room.alertMin) {
                e.alerted = true;
                emitter(token, 'donor_arrived', view(e));
            }
        }
        scheduleEmit(token);
    }, 400);
}

/** Any activity of a viewer; coins > 0 for gifts */
function seen(token, data, coins = 0) {
    if (!token || !data || !data.uniqueId) return;
    const room = roomOf(token);
    const id = String(data.uniqueId);
    const now = Date.now();
    let e = room.viewers.get(id);
    if (!e) {
        e = { uniqueId: id, nickname: data.nickname || id, profilePictureUrl: data.profilePictureUrl || '', before: null, liveCoins: 0, firstSeen: now, lastSeen: now, alerted: false };
        room.viewers.set(id, e);
        room.pending.add(id);
        scheduleLookup(token);
    }
    e.lastSeen = now;
    if (data.nickname) e.nickname = data.nickname;
    if (data.profilePictureUrl) e.profilePictureUrl = data.profilePictureUrl;
    if (coins > 0) {
        e.liveCoins += coins;
        if (!e.alerted && e.before !== null && e.before + e.liveCoins >= room.alertMin) {
            e.alerted = true;
            emitter(token, 'donor_arrived', view(e));
        }
    }
    scheduleEmit(token);
}

function setAlertMin(token, coins) {
    const n = Number(coins);
    if (Number.isFinite(n) && n >= 0) roomOf(token).alertMin = n;
}

function reset(token) {
    const room = rooms.get(token);
    if (!room) return;
    clearTimeout(room.timer);
    clearTimeout(room.emitTimer);
    rooms.delete(token);
}

module.exports = { TIERS, tierOf, seen, list, reset, setAlertMin, setLookup, setEmitter, PRESENT_MS };
