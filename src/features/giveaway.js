/**
 * Giveaway (tirage au sort): viewers join by typing a keyword in the chat (e.g. !join), optionally
 * only followers or subscribers. Gifts can add bonus tickets. The streamer draws one or more winners
 * from the dashboard; the overlay /overlay/giveaway shows the entries and the draw.
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

const giveaways = new Map(); // token -> state

function emit(token, event, data) {
    const { emitEvent } = require('../utils/socket');
    emitEvent(event, data, token);
}

function publicState(g) {
    if (!g) return { status: 'idle', count: 0, tickets: 0, participants: [], winners: [] };
    const list = Array.from(g.participants.values());
    return {
        id: g.id,
        status: g.status, // open | closed
        title: g.title,
        prize: g.prize,
        keyword: g.keyword,
        followersOnly: g.followersOnly,
        subscribersOnly: g.subscribersOnly,
        coinsPerTicket: g.coinsPerTicket,
        endsAt: g.endsAt,
        count: list.length,
        tickets: list.reduce((a, p) => a + p.tickets, 0),
        // the 30 latest entries are enough for the overlay bubbles and the dashboard list
        participants: list.sort((a, b) => b.at - a.at).slice(0, 30).map(p => ({ uniqueId: p.uniqueId, nickname: p.nickname, profilePictureUrl: p.profilePictureUrl, tickets: p.tickets })),
        winners: g.winners
    };
}

function scheduleUpdate(token, g) {
    if (g.updateTimer) return;
    g.updateTimer = setTimeout(() => {
        g.updateTimer = null;
        emit(token, 'giveaway_update', publicState(g));
    }, 300);
}

/**
 * @param {object} cfg { title, prize, keyword, duration (seconds, 0 = until closed), followersOnly, subscribersOnly, coinsPerTicket (0 = no bonus) }
 */
function start(token, cfg = {}) {
    reset(token, { silent: true });
    const duration = Math.min(Math.max(Number(cfg.duration) || 0, 0), 6 * 3600);
    const keyword = String(cfg.keyword || '!join').trim().toLowerCase().split(/\s+/)[0].slice(0, 30) || '!join';
    const g = {
        id: `${Date.now()}`,
        status: 'open',
        title: String(cfg.title || 'Giveaway').slice(0, 60),
        prize: String(cfg.prize || '').slice(0, 80),
        keyword,
        followersOnly: !!cfg.followersOnly,
        subscribersOnly: !!cfg.subscribersOnly,
        coinsPerTicket: Math.max(0, Math.floor(Number(cfg.coinsPerTicket) || 0)),
        endsAt: duration ? Date.now() + duration * 1000 : null,
        participants: new Map(),
        winners: [],
        updateTimer: null,
        endTimer: null
    };
    if (duration) g.endTimer = setTimeout(() => close(token), duration * 1000);
    giveaways.set(token, g);
    logger.info(`🎁 Giveaway « ${g.title} » ouvert (${keyword})`);
    emit(token, 'giveaway_update', publicState(g));
    return publicState(g);
}

function canEnter(g, user) {
    if (g.subscribersOnly && !user.isSubscriber) return false;
    if (g.followersOnly && !(Number(user.followRole) >= 1 || user.isSubscriber)) return false;
    return true;
}

/** Chat: join with the keyword. Returns true when the message was the keyword. */
function onChat(token, user, comment) {
    const g = giveaways.get(token);
    if (!g || g.status !== 'open' || !comment || !user || !user.uniqueId) return false;
    const first = String(comment).trim().toLowerCase().split(/\s+/)[0];
    if (first !== g.keyword) return false;
    if (g.participants.has(user.uniqueId) || !canEnter(g, user)) return true;
    g.participants.set(user.uniqueId, {
        uniqueId: user.uniqueId, nickname: user.nickname || user.uniqueId, profilePictureUrl: user.profilePictureUrl,
        tickets: 1, coins: 0, at: Date.now()
    });
    scheduleUpdate(token, g);
    return true;
}

/** Gifts give bonus tickets to viewers who already joined */
function onGift(token, user, coins) {
    const g = giveaways.get(token);
    if (!g || g.status !== 'open' || !g.coinsPerTicket || !user) return;
    const p = g.participants.get(user.uniqueId);
    if (!p) return;
    p.coins += Number(coins) || 0;
    const tickets = 1 + Math.floor(p.coins / g.coinsPerTicket);
    if (tickets !== p.tickets) { p.tickets = Math.min(tickets, 1000); scheduleUpdate(token, g); }
}

function close(token) {
    const g = giveaways.get(token);
    if (!g) return publicState(null);
    g.status = 'closed';
    clearTimeout(g.endTimer);
    emit(token, 'giveaway_update', publicState(g));
    return publicState(g);
}

/** Draws `count` winners (weighted by tickets, never the same viewer twice) */
function draw(token, count = 1) {
    const g = giveaways.get(token);
    if (!g) return { ...publicState(null), drawn: [] };
    if (g.status === 'open') close(token);
    const already = new Set(g.winners.map(w => w.uniqueId));
    const pool = Array.from(g.participants.values()).filter(p => !already.has(p.uniqueId));
    const drawn = [];
    for (let i = 0; i < Math.min(Math.max(1, count), 20) && pool.length; i++) {
        const total = pool.reduce((a, p) => a + p.tickets, 0);
        let r = crypto.randomInt(total);
        const idx = pool.findIndex(p => (r -= p.tickets) < 0);
        const [w] = pool.splice(idx, 1);
        const winner = { uniqueId: w.uniqueId, nickname: w.nickname, profilePictureUrl: w.profilePictureUrl, tickets: w.tickets };
        drawn.push(winner);
        g.winners.push(winner);
    }
    const state = publicState(g);
    // the overlay animates a roulette with some names, then shows the winners
    const names = Array.from(g.participants.values()).map(p => p.nickname).sort(() => Math.random() - 0.5).slice(0, 25);
    emit(token, 'giveaway_draw', { ...state, drawn, names });
    logger.info(`🎉 Giveaway « ${g.title} » : ${drawn.map(w => w.nickname).join(', ') || 'aucun participant'}`);
    return { ...state, drawn };
}

function reset(token, { silent = false } = {}) {
    const g = giveaways.get(token);
    if (g) { clearTimeout(g.endTimer); clearTimeout(g.updateTimer); }
    giveaways.delete(token);
    if (!silent) emit(token, 'giveaway_update', publicState(null));
    return publicState(null);
}

function getState(token) {
    return publicState(giveaways.get(token));
}

module.exports = { start, onChat, onGift, close, draw, reset, getState };
