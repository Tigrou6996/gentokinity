/**
 * Chat bot: a TikTok account of the streamer (preferably a second account) answers the !score / !top
 * commands in the live chat, e.g. "@lea tu as 1 250 🍪 cookies — niveau 7 (2 400 XP), #3".
 *
 * TikTok only accepts chat messages from a logged-in account: the bot uses that account's session
 * cookies (sessionid + tt-target-idc, copied from the browser) and the Euler Stream signing service
 * (its chat endpoint needs a key that allows it). Messages are rate-limited: TikTok mutes or restricts
 * accounts that post too fast.
 *
 * Settings (Settings.chatbot): { enabled, sessionId, ttTargetIdc, scoreTemplate, topTemplate, minInterval }
 */
const config = require('../config');
const logger = require('../utils/logger');

const DEFAULTS = {
    enabled: false,
    scoreTemplate: '@{nickname} tu as {points} {emoji} {currency} — niveau {level} ({xp} XP){rank}',
    topTemplate: '🏆 Top {currency} : {top}',
    minInterval: 4 // seconds between two bot messages
};
const MAX_QUEUE = 3;
const MAX_LENGTH = 150;

const bots = new Map(); // token -> { key, connection, queue: [], busy, lastAt }

function getSettings(settings) {
    const c = { ...DEFAULTS, ...((settings && settings.chatbot) || {}) };
    c.minInterval = Math.min(Math.max(Number(c.minInterval) || DEFAULTS.minInterval, 2), 60);
    return c;
}

function isReady(c) {
    return !!(c.enabled && c.sessionId && c.ttTargetIdc);
}

/** Public view of the settings (the session cookie never leaves the server) */
function publicSettings(settings) {
    const c = getSettings(settings);
    return {
        enabled: !!c.enabled,
        connected: !!(c.sessionId && c.ttTargetIdc),
        sessionHint: c.sessionId ? `••••${String(c.sessionId).slice(-4)}` : '',
        scoreTemplate: c.scoreTemplate,
        topTemplate: c.topTemplate,
        minInterval: c.minInterval,
        signKey: !!config.signApiKey
    };
}

const fmt = (n) => Math.floor(Number(n) || 0).toLocaleString('fr-FR');

function fill(template, values) {
    return String(template || '').replace(/\{(\w+)\}/g, (m, k) => (values[k] !== undefined ? String(values[k]) : m))
        .replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH);
}

async function botFor(token, c) {
    const key = `${c.sessionId}|${c.ttTargetIdc}`;
    let bot = bots.get(token);
    if (bot && bot.key === key) return bot;
    const mod = await import('tiktok-live-connector/legacy');
    const options = { session: { cookie: { type: 'cookie', value: { sessionId: c.sessionId, ttTargetIdc: c.ttTargetIdc } } } };
    if (config.signApiKey) options.signApiKey = config.signApiKey;
    const username = (config.peekSession(token).username || 'tiktok').replace(/^@/, '');
    bot = { key, connection: new mod.WebcastPushConnection(username, options), queue: [], busy: false, lastAt: 0 };
    bots.set(token, bot);
    return bot;
}

async function drain(token, bot, roomIdOf) {
    if (bot.busy) return;
    bot.busy = true;
    try {
        while (bot.queue.length) {
            const { text, minInterval } = bot.queue.shift();
            const wait = bot.lastAt + minInterval * 1000 - Date.now();
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            const roomId = roomIdOf();
            if (!roomId) break; // live stopped meanwhile
            try {
                await bot.connection.sendMessage(text, roomId);
                logger.info(`💬 [${token.substring(0, 8)}] Bot chat : ${text}`);
            } catch (err) {
                const msg = (err && (err.message || err.info)) || String(err);
                logger.warn(`⚠️ [${token.substring(0, 8)}] Bot chat : message non envoyé (${msg}). Vérifiez le compte bot (cookies expirés ?) et la clé Euler Stream.`);
                bot.queue.length = 0;
            }
            bot.lastAt = Date.now();
        }
    } finally {
        bot.busy = false;
    }
}

/** Queues a message in the live chat (dropped when the bot is off, not set up, or already has messages waiting) */
async function say(connector, settings, text) {
    try {
        if (!connector || connector.isSimulation || !text) return false;
        const c = getSettings(settings);
        if (!isReady(c)) return false;
        const roomIdOf = () => (connector.connection && !connector.isStopping ? connector.connection.roomId : null);
        if (!roomIdOf()) return false;
        const bot = await botFor(connector.token, c);
        if (bot.queue.length >= MAX_QUEUE) return false;
        bot.queue.push({ text, minInterval: c.minInterval });
        drain(connector.token, bot, roomIdOf);
        return true;
    } catch (err) {
        logger.warn(`[CHATBOT] ${err.message}`);
        return false;
    }
}

function replyScore(connector, settings, pointsSettings, viewer) {
    const c = getSettings(settings);
    if (!isReady(c)) return;
    const text = fill(c.scoreTemplate, {
        nickname: viewer.nickname || viewer.uniqueId,
        uniqueId: viewer.uniqueId,
        points: fmt(viewer.points),
        xp: fmt(viewer.levelPoints),
        level: viewer.level || 0,
        rank: viewer.rank ? `, #${viewer.rank}` : '',
        currency: pointsSettings.currencyName,
        emoji: pointsSettings.currencyEmoji || ''
    });
    say(connector, settings, text);
}

function replyTop(connector, settings, pointsSettings, top, requestedBy) {
    const c = getSettings(settings);
    if (!isReady(c) || !top || !top.length) return;
    const list = top.slice(0, 5).map((u, i) => `${i + 1}. ${u.nickname || u.uniqueId} (${fmt(u.points)})`).join(' · ');
    say(connector, settings, fill(c.topTemplate, {
        top: list, currency: pointsSettings.currencyName, emoji: pointsSettings.currencyEmoji || '',
        nickname: (requestedBy && (requestedBy.nickname || requestedBy.uniqueId)) || ''
    }));
}

function forget(token) {
    bots.delete(token);
}

module.exports = { DEFAULTS, getSettings, publicSettings, say, replyScore, replyTop, forget, fill };
