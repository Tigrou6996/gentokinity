/**
 * Points Drop: the streamer drops points; the first viewers who type the keyword (e.g. !catch)
 * within the time limit each win a share. The overlay /overlay/pointsdrop shows coins falling and the catchers.
 * Points go to the viewers' balance (Utilisateurs & Points).
 */
const logger = require('../utils/logger');
const points = require('./points');

const drops = new Map(); // token -> drop

function emit(token, event, data) {
    const { emitEvent } = require('../utils/socket');
    emitEvent(event, data, token);
}

function publicState(d) {
    if (!d) return { running: false, catchers: [] };
    return {
        id: d.id, running: d.running, amount: d.amount, perViewer: d.perViewer, keyword: d.keyword, maxCatchers: d.maxCatchers,
        endsAt: d.endsAt, catchers: d.catchers
    };
}

/** @param {object} cfg { amount (points per catcher), keyword, duration (s), maxCatchers } */
function start(token, cfg = {}) {
    stop(token, { silent: true });
    const duration = Math.min(Math.max(Number(cfg.duration) || 30, 5), 600);
    const d = {
        id: `${Date.now()}`,
        running: true,
        amount: Math.min(Math.max(Math.floor(Number(cfg.amount) || 100), 1), 1000000),
        keyword: String(cfg.keyword || '!catch').trim().toLowerCase().split(/\s+/)[0].slice(0, 30) || '!catch',
        maxCatchers: Math.min(Math.max(Math.floor(Number(cfg.maxCatchers) || 10), 1), 500),
        endsAt: Date.now() + duration * 1000,
        catchers: [],
        endTimer: null
    };
    d.perViewer = d.amount;
    d.endTimer = setTimeout(() => stop(token), duration * 1000);
    drops.set(token, d);
    logger.info(`🪙 Points Drop : ${d.amount} points, tapez ${d.keyword}`);
    emit(token, 'pointsdrop_update', publicState(d));
    return publicState(d);
}

/** Chat: catch with the keyword (once per viewer). Simulated events never give real points. */
function onChat(connector, user, comment) {
    const token = connector.token;
    const d = drops.get(token);
    if (!d || !d.running || !comment || !user || !user.uniqueId) return false;
    if (String(comment).trim().toLowerCase().split(/\s+/)[0] !== d.keyword) return false;
    if (d.catchers.some(c => c.uniqueId === user.uniqueId)) return true;
    d.catchers.push({ uniqueId: user.uniqueId, nickname: user.nickname || user.uniqueId, profilePictureUrl: user.profilePictureUrl, points: d.perViewer });
    if (!connector.isSimulation) points.award(token, user, d.perViewer, 'drop', {});
    emit(token, 'pointsdrop_catch', { ...publicState(d), catcher: d.catchers[d.catchers.length - 1] });
    if (d.catchers.length >= d.maxCatchers) stop(token);
    return true;
}

function stop(token, { silent = false } = {}) {
    const d = drops.get(token);
    if (!d) return publicState(null);
    clearTimeout(d.endTimer);
    if (d.running) {
        d.running = false;
        if (!silent) {
            emit(token, 'pointsdrop_update', publicState(d));
            logger.info(`🪙 Points Drop terminé : ${d.catchers.length} spectateur(s) ont attrapé des points`);
        }
    }
    return publicState(d);
}

function getState(token) {
    return publicState(drops.get(token));
}

module.exports = { start, onChat, stop, getState };
