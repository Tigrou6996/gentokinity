/**
 * Event simulator: lets the streamer test triggers, actions and overlays without being live.
 *
 * Fake TikTok messages are emitted on a fake connection and go through exactly the same
 * code as real ones (handlers/eventManager.js): de-duplication, gift combos, actions,
 * overlays, battles. The simulation connector is flagged `isSimulation`, so nothing is
 * written to the leaderboards, the points database or the saved "top" stats.
 */
const EventEmitter = require('events');

const simConnectors = new Map(); // token -> fake connector
let msgCounter = 0;

function getSimConnector(token) {
    let c = simConnectors.get(token);
    if (c) return c;
    const { registerEvents } = require('../handlers/eventManager');
    const connection = new EventEmitter();
    c = {
        token,
        username: 'simulation',
        isSimulation: true,
        isStopping: false,
        isConnected: true,
        startTime: Date.now() - 5000,
        connection,
        stats: {
            diamonds: 0, gifts: 0, likes: 0, shares: 0, follows: 0, subscribers: 0, chats: 0,
            viewerCount: 0, viewerCountMax: 0, cumulativeViewers: 0,
            actionsBreakdown: {}, giftsBreakdown: {}, topCoins: [], topLikes: [],
            topGift: { coins: 0, uniqueId: 'PSEUDO', nickname: 'PSEUDO' },
            topStreak: { count: 0, uniqueId: 'PSEUDO', nickname: 'PSEUDO' }
        },
        lastEvents: {},
        uniqueViewers: new Set(),
        topCoinsMap: new Map(),
        topLikesMap: new Map(),
        handleDisconnect() { },
        stop() { }
    };
    registerEvents(connection, c);
    simConnectors.set(token, c);
    return c;
}

function fakeUser(opts = {}) {
    const uniqueId = String(opts.uniqueId || 'gentok_test').replace(/^@/, '').slice(0, 40) || 'gentok_test';
    return {
        userId: `sim_${uniqueId}`,
        uniqueId,
        nickname: String(opts.nickname || uniqueId).slice(0, 40),
        profilePictureUrl: opts.profilePictureUrl || 'https://tiktok.gentok.fr/logo.png',
        followRole: opts.followRole !== undefined ? Number(opts.followRole) : 1,
        isSubscriber: !!opts.isSubscriber,
        isModerator: !!opts.isModerator,
        userBadges: []
    };
}

function message(extra) {
    msgCounter++;
    return { msgId: `sim_${Date.now()}_${msgCounter}`, createTime: String(Date.now()), ...extra };
}

/**
 * @param {string} token
 * @param {string} type follow | share | subscribe | member | like | chat | gift | question
 * @param {object} opts user fields + type options (likeCount, comment, giftId, giftName, coins, count, combo...)
 */
function simulate(token, type, opts = {}) {
    const c = getSimConnector(token);
    c.isStopping = false;
    const user = fakeUser(opts);
    const conn = c.connection;

    switch (type) {
        case 'follow':
            conn.emit('follow', message({ ...user, displayType: 'pm_mt_msg_viewer_follow' }));
            break;
        case 'share':
            conn.emit('share', message({ ...user, displayType: 'pm_mt_msg_viewer_share' }));
            break;
        case 'subscribe':
            conn.emit('subscribe', message({ ...user, isSubscriber: true, subMonth: Math.max(1, parseInt(opts.subMonth, 10) || 1) }));
            break;
        case 'member':
            conn.emit('member', message({ ...user }));
            break;
        case 'like': {
            const likeCount = Math.min(Math.max(parseInt(opts.likeCount, 10) || 15, 1), 1000);
            c.stats.likes = (c.stats.likes || 0) + likeCount;
            conn.emit('like', message({ ...user, likeCount, totalLikeCount: c.stats.likes }));
            break;
        }
        case 'chat':
            conn.emit('chat', message({ ...user, comment: String(opts.comment || 'Bonjour !').slice(0, 300) }));
            break;
        case 'question':
            conn.emit('questionNew', message({ ...user, questionText: String(opts.comment || 'Une question ?').slice(0, 300) }));
            break;
        case 'gift': {
            const count = Math.min(Math.max(parseInt(opts.count, 10) || 1, 1), 200);
            const combo = opts.combo !== false;
            const gift = {
                giftId: String(opts.giftId || '5655'),
                giftName: opts.giftName || 'Rose',
                giftDiamondCount: Math.max(0, Number(opts.coins) || 1),
                url: opts.giftIcon || undefined
            };
            if (combo) {
                // Same packets as TikTok: 1, 2, 3 ... N then the "end of combo" packet
                const groupId = `simgrp_${Date.now()}`;
                for (let i = 1; i <= count; i++) {
                    setTimeout(() => conn.emit('gift', message({ ...user, ...gift, giftType: 1, groupId, repeatCount: i, repeatEnd: false })), i * 60);
                }
                setTimeout(() => conn.emit('gift', message({ ...user, ...gift, giftType: 1, groupId, repeatCount: count, repeatEnd: true })), count * 60 + 400);
            } else {
                for (let i = 0; i < count; i++) {
                    setTimeout(() => conn.emit('gift', message({ ...user, ...gift, giftType: 2, repeatCount: 1, repeatEnd: false })), i * 120);
                }
            }
            break;
        }
        default:
            throw new Error(`Type de simulation inconnu : ${type}`);
    }
    return { success: true, type, user: user.uniqueId };
}

function reset(token) {
    simConnectors.delete(token);
}

module.exports = { simulate, reset };
