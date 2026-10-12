/**
 * Coin Match: a live auction. While it runs, every coin a viewer sends in gifts is added to their total;
 * the overlay /overlay/coinmatch shows the timer and the ranking, then the winners at the end.
 */
const logger = require('../utils/logger');

const matches = new Map(); // token -> match state

function emit(token, event, data) {
    const { emitEvent } = require('../utils/socket');
    emitEvent(event, data, token);
}

function publicState(m, limit = 10) {
    if (!m) return { running: false, participants: [], total: 0 };
    const sorted = Array.from(m.participants.entries())
        .map(([uniqueId, p]) => ({ uniqueId, nickname: p.nickname, profilePictureUrl: p.profilePictureUrl, coins: p.coins, at: p.at }))
        .sort((a, b) => b.coins - a.coins || a.at - b.at);
    return {
        id: m.id,
        running: m.running,
        title: m.title,
        startedAt: m.startedAt,
        endsAt: m.endsAt,
        endedAt: m.endedAt || null,
        winners: m.winners,
        count: sorted.length,
        total: sorted.reduce((a, p) => a + p.coins, 0),
        participants: sorted.slice(0, limit).map(({ at, ...p }) => p)
    };
}

function scheduleUpdate(token, m) {
    if (m.updateTimer) return;
    m.updateTimer = setTimeout(() => {
        m.updateTimer = null;
        emit(token, 'coinmatch_update', publicState(m));
    }, 250);
}

/** @param {object} cfg { title, duration (seconds), winners (how many are shown as winners) } */
function start(token, cfg = {}) {
    stop(token, { silent: true });
    const duration = Math.min(Math.max(Number(cfg.duration) || 120, 10), 3 * 3600);
    const m = {
        id: `${Date.now()}`,
        running: true,
        title: String(cfg.title || 'Coin Match').slice(0, 60),
        winners: Math.min(Math.max(parseInt(cfg.winners, 10) || 3, 1), 10),
        startedAt: Date.now(),
        endsAt: Date.now() + duration * 1000,
        participants: new Map(),
        updateTimer: null,
        endTimer: null
    };
    m.endTimer = setTimeout(() => finish(token), duration * 1000);
    matches.set(token, m);
    logger.info(`🪙 Coin Match « ${m.title} » lancé (${duration}s)`);
    emit(token, 'coinmatch_update', publicState(m));
    return publicState(m);
}

function onGift(token, user, coins) {
    const m = matches.get(token);
    if (!m || !m.running || !coins || !user || !user.uniqueId) return;
    const p = m.participants.get(user.uniqueId) || { nickname: user.nickname || user.uniqueId, profilePictureUrl: user.profilePictureUrl, coins: 0, at: Date.now() };
    p.coins += Number(coins) || 0;
    p.at = Date.now(); // on equal totals, the first to reach it stays ahead
    if (user.profilePictureUrl) p.profilePictureUrl = user.profilePictureUrl;
    m.participants.set(user.uniqueId, p);
    scheduleUpdate(token, m);
}

function finish(token) {
    const m = matches.get(token);
    if (!m || !m.running) return publicState(m);
    m.running = false;
    m.endedAt = Date.now();
    clearTimeout(m.endTimer);
    clearTimeout(m.updateTimer);
    m.updateTimer = null;
    const state = publicState(m);
    emit(token, 'coinmatch_end', state);
    const top = state.participants[0];
    logger.info(`🏆 Coin Match terminé : ${top ? `${top.nickname} (${top.coins} pièces)` : 'aucun participant'}`);
    return state;
}

function stop(token, { silent = false } = {}) {
    const m = matches.get(token);
    if (!m) return { running: false, participants: [], total: 0 };
    if (m.running && !silent) return finish(token);
    clearTimeout(m.endTimer);
    clearTimeout(m.updateTimer);
    return publicState(m);
}

/** Empties the match (the overlay goes back to "no participants") */
function reset(token) {
    stop(token, { silent: true });
    matches.delete(token);
    const state = publicState(null);
    emit(token, 'coinmatch_update', state);
    return state;
}

/** Shows the winners again on the overlay */
function showWinners(token) {
    const m = matches.get(token);
    const state = publicState(m);
    emit(token, 'coinmatch_end', state);
    return state;
}

function getState(token) {
    return publicState(matches.get(token));
}

module.exports = { start, stop, reset, onGift, showWinners, getState };
