/**
 * Entry point called by handlers/eventManager.js for every (de-duplicated) live event.
 * Feeds the points system, team battles and the chat commands (!score, !top).
 */
const config = require('../config');
const logger = require('../utils/logger');
const points = require('./points');
const battle = require('./battle');

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

function userOf(data) {
    return {
        uniqueId: data.uniqueId,
        userId: data.userId,
        nickname: data.nickname || data.uniqueId,
        profilePictureUrl: data.profilePictureUrl
    };
}

function emit(connector, event, payload) {
    const { emitEvent } = require('../utils/socket');
    emitEvent(event, payload, connector.token);
}

// Simulated events (dashboard simulator) never change the real points database
function canPersist(connector) {
    return !connector.isSimulation;
}

/** Remembers who is active, and every minute gives "watch time" points to them */
function markActive(connector, data) {
    if (!data || !data.uniqueId) return;
    if (!connector.activeViewers) connector.activeViewers = new Map();
    connector.activeViewers.set(String(data.uniqueId), { at: Date.now(), user: userOf(data) });

    if (!connector.watchTimer && canPersist(connector)) {
        connector.watchTimer = setInterval(async () => {
            if (connector.isStopping || !connector.startTime) {
                clearInterval(connector.watchTimer);
                connector.watchTimer = null;
                return;
            }
            try {
                const s = points.getSettings(await config.getSettings(connector.token));
                const now = Date.now();
                for (const [key, v] of connector.activeViewers) {
                    if (now - v.at > ACTIVE_WINDOW_MS) { connector.activeViewers.delete(key); continue; }
                    if (s.enabled) points.award(connector.token, v.user, s.perActiveMinute, 'watch', { watchMinutes: 1 });
                }
            } catch (e) { /* ignore */ }
        }, 60 * 1000);
    }
}

async function handleCommands(connector, data, s) {
    const msg = String(data.comment || '').trim().toLowerCase();
    if (!msg.startsWith('!')) return;
    const cmd = msg.split(/\s+/)[0];
    const isScore = cmd === String(s.scoreCommand || '!score').toLowerCase();
    const isTop = cmd === String(s.topCommand || '!top').toLowerCase();
    if (!isScore && !isTop) return;

    // Per-viewer cooldown to avoid spam on the overlay
    if (!connector.commandCooldowns) connector.commandCooldowns = new Map();
    const key = `${cmd}:${data.uniqueId}`;
    const last = connector.commandCooldowns.get(key) || 0;
    if (Date.now() - last < (Number(s.commandCooldown) || 0) * 1000) return;
    connector.commandCooldowns.set(key, Date.now());

    const settings = await config.getSettings(connector.token);
    if (isScore) {
        const viewer = await points.getViewer(connector.token, data.uniqueId, settings);
        const payload = viewer || { ...userOf(data), points: 0, levelPoints: 0, level: 0, rank: null, progress: 0, nextLevelPoints: points.pointsForLevel(1, s.levelFactor) };
        if (!payload.profilePictureUrl) payload.profilePictureUrl = data.profilePictureUrl;
        emit(connector, 'points_score', payload);
        emit(connector, 'log', { level: 'info', message: `🏅 ${payload.nickname} : ${payload.points} points (niveau ${payload.level}${payload.rank ? `, #${payload.rank}` : ''})` });
    } else {
        const top = await points.getTop(connector.token, 5, settings);
        emit(connector, 'points_top', { requestedBy: userOf(data), top });
    }
}

async function onChat(connector, data) {
    try {
        const settings = await config.getSettings(connector.token);
        const s = points.getSettings(settings);
        markActive(connector, data);
        battle.onChat(connector.token, userOf(data), data.comment);

        if (s.enabled && canPersist(connector)) {
            if (!connector.chatPointsAt) connector.chatPointsAt = new Map();
            const last = connector.chatPointsAt.get(data.uniqueId) || 0;
            const earn = Date.now() - last >= (Number(s.chatCooldown) || 0) * 1000;
            if (earn) connector.chatPointsAt.set(data.uniqueId, Date.now());
            points.award(connector.token, userOf(data), earn ? s.perChat : 0, 'chat', { chats: 1 });
        }
        if (s.enabled) await handleCommands(connector, data, s);
    } catch (e) {
        logger.warn(`[LIVE] onChat: ${e.message}`);
    }
}

async function onGifts(connector, data, count, coins) {
    try {
        markActive(connector, data);
        battle.onGift(connector.token, userOf(data), data.giftId, coins);
        if (!canPersist(connector)) return;
        const s = points.getSettings(await config.getSettings(connector.token));
        if (s.enabled) points.award(connector.token, userOf(data), coins * s.perCoin, 'gift', { coins, gifts: count });
    } catch (e) {
        logger.warn(`[LIVE] onGifts: ${e.message}`);
    }
}

async function onLike(connector, data, likeCount) {
    try {
        markActive(connector, data);
        battle.onLike(connector.token, userOf(data), likeCount);
        if (!canPersist(connector)) return;
        const s = points.getSettings(await config.getSettings(connector.token));
        if (s.enabled) points.award(connector.token, userOf(data), likeCount * s.perLike, 'like', { likes: likeCount });
    } catch (e) {
        logger.warn(`[LIVE] onLike: ${e.message}`);
    }
}

/** follow | share | subscribe | member */
async function onSocial(connector, type, data) {
    try {
        markActive(connector, data);
        if (!canPersist(connector) || type === 'member') return;
        const s = points.getSettings(await config.getSettings(connector.token));
        if (!s.enabled) return;
        if (type === 'follow') points.award(connector.token, userOf(data), s.perFollow, 'follow', { follows: 1 });
        else if (type === 'share') points.award(connector.token, userOf(data), s.perShare, 'share', { shares: 1 });
        else if (type === 'subscribe') points.award(connector.token, userOf(data), s.perSub, 'sub', { subs: 1 });
    } catch (e) {
        logger.warn(`[LIVE] onSocial: ${e.message}`);
    }
}

function onStop(connector) {
    if (connector.watchTimer) clearInterval(connector.watchTimer);
    connector.watchTimer = null;
    points.flushToken(connector.token).catch(() => { });
}

module.exports = { onChat, onGifts, onLike, onSocial, onStop };
