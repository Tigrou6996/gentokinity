const logger = require('../utils/logger');
const { GiftStreakTracker } = require('./giftStreaks');
const actionManager = require('../actions/actionManager');
const { emitStats, emitEvent } = require('../utils/socket');
const config = require('../config');
const { translateGift } = require('../utils/giftTranslator');
const { getUserInfo } = require('../utils/tiktokApi');
const Leaderboard = require('../models/Leaderboard');
const Session = require('../models/Session');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { normalizeLike, normalizeRoomUser, normalizeMember, normalizeGift, normalizeChat, normalizeSocial, normalizeSubscribe } = require('../utils/tiktokNormalizer');

// ---------------------------------------------------------------------------
// De-duplication: TikTok sometimes delivers the same message twice (and again after
// a reconnection). Every message carries a unique msgId, we remember the last ones.
// ---------------------------------------------------------------------------
const MAX_SEEN_MESSAGES = 5000;
function isDuplicateMessage(connector, data) {
    const id = data && data.msgId !== undefined && data.msgId !== null ? String(data.msgId) : null;
    if (!id || id === '0') return false;
    if (!connector.seenMsgIds) {
        connector.seenMsgIds = new Set();
        connector.seenMsgOrder = [];
    }
    if (connector.seenMsgIds.has(id)) return true;
    connector.seenMsgIds.add(id);
    connector.seenMsgOrder.push(id);
    if (connector.seenMsgOrder.length > MAX_SEEN_MESSAGES) {
        connector.seenMsgIds.delete(connector.seenMsgOrder.shift());
    }
    return false;
}

// Messages created before the bot started (TikTok can replay a few on connect)
function isOldMessage(connector, data) {
    const created = data && data.createTime ? Number(data.createTime) : 0;
    return !!(connector.startTime && created && created < connector.startTime - 2000);
}

// Returns true only the first time this user does `kind` (follow / subscribe) during the live
function isFirstTimeThisLive(connector, kind, data) {
    const field = kind === 'follow' ? 'followedUsers' : 'subscribedUsers';
    if (!connector[field]) connector[field] = new Set();
    const key = String(data.userId || data.uniqueId || '');
    if (!key) return true;
    if (connector[field].has(key)) return false;
    connector[field].add(key);
    return true;
}

// Public fields sent to overlays for alerts
function alertPayload(data, extra = {}) {
    return {
        userId: data.userId,
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        profilePictureUrl: data.profilePictureUrl,
        ...extra
    };
}

// [NEW] Persistant Leaderboard Debouncer
const leaderboardBuffer = new Map(); // token -> { uniqueId -> { coins, likes, user } }
let leaderboardSaveTimeout = null;

// [NEW] Stats Emission Debouncer to prevent socket spam
const statsEmitTimeouts = new Map();
function broadcastStats(connector) {
    if (!connector || !connector.token) return;
    if (statsEmitTimeouts.has(connector.token)) return;

    // Emit every 200ms max to avoid saturating the connection
    const timeout = setTimeout(() => {
        // console.log(`[Stats] Broadcasting stats for ${connector.token.substring(0,8)}...`);
        emitEvent('session_stats', connector.stats, connector.token);
        statsEmitTimeouts.delete(connector.token);
    }, 200);

    statsEmitTimeouts.set(connector.token, timeout);
}

function updateViewerCountIfPresent(connector, data) {
    // data must already be normalized before calling this
    const count = (data && typeof data.viewerCount === 'number' && !isNaN(data.viewerCount) && data.viewerCount >= 0)
        ? data.viewerCount : null;
    if (count !== null && count > 0) {
        updateStats(connector, 'viewerCount', count, true);
        if (connector.stats && count > (connector.stats.viewerCountMax || 0)) {
            connector.stats.viewerCountMax = count;
        }
        emitStats('viewers', count, connector.token);
    }
}

function broadcastStatsImmediate(connector) {
    if (!connector || !connector.token) return;

    // Clear any pending throttle to ensure we send fresh data immediately
    if (statsEmitTimeouts.has(connector.token)) {
        clearTimeout(statsEmitTimeouts.get(connector.token));
        statsEmitTimeouts.delete(connector.token);
    }

    emitEvent('session_stats', connector.stats, connector.token);
}

function getLocalDataDir() {
    const docPath = path.join(os.homedir(), 'Documents', 'Gentok', 'classement', 'data');
    if (!fs.existsSync(docPath)) fs.mkdirSync(docPath, { recursive: true });
    return docPath;
}

function safeReadJson(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) { }
    return {};
}

function safeWriteJson(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error writing ${filePath}:`, e.message);
    }
}

async function flushLeaderboardBuffer() {
    if (leaderboardBuffer.size === 0) return;

    // Snapshot buffer to process
    const bufferSnapshot = new Map(leaderboardBuffer);
    leaderboardBuffer.clear();
    const isApp = config.isAppMode;

    for (const [token, users] of bufferSnapshot.entries()) {
        if (isApp) {
            // [APP MODE] Save to Split Local JSON Files (Legacy Format)
            const dir = getLocalDataDir();

            const files = {
                all: { path: path.join(dir, 'leaderboard.json'), data: {} },
                week: { path: path.join(dir, 'leaderboard_week.json'), data: {} },
                like: { path: path.join(dir, 'leaderboard_like.json'), data: {} },
                likeWeek: { path: path.join(dir, 'leaderboard_like_week.json'), data: {} },
            };

            // Load all files
            files.all.data = safeReadJson(files.all.path);
            files.week.data = safeReadJson(files.week.path);
            files.like.data = safeReadJson(files.like.path);
            files.likeWeek.data = safeReadJson(files.likeWeek.path);

            for (const [uniqueId, data] of Object.entries(users)) {

                // Helper to update a user entry in a specific file dataset
                const updates = [
                    { dataset: files.all.data, coins: data.coins, likes: 0, gifts: data.gifts },
                    { dataset: files.week.data, coins: data.coins, likes: 0, gifts: data.gifts },
                    { dataset: files.like.data, coins: 0, likes: data.likes, gifts: null },
                    { dataset: files.likeWeek.data, coins: 0, likes: data.likes, gifts: null }
                ];

                updates.forEach(({ dataset, coins, likes, gifts }) => {
                    if (!dataset[uniqueId]) {
                        dataset[uniqueId] = {
                            pseudo: data.user.nickname || uniqueId,
                            profile: data.user.profilePictureUrl || '',
                            count: 0,
                            gifts: {}
                        };
                    }
                    const u = dataset[uniqueId];
                    // Always update profile info
                    u.pseudo = data.user.nickname || u.pseudo;
                    u.profile = data.user.profilePictureUrl || u.profile;

                    // Update Counts
                    if (coins) u.count = (u.count || 0) + coins;
                    if (likes) u.count = (u.count || 0) + likes;

                    // Update Gifts
                    if (gifts) {
                        if (!u.gifts) u.gifts = {};
                        for (const [giftId, count] of Object.entries(gifts)) {
                            u.gifts[giftId] = (u.gifts[giftId] || 0) + count;
                        }
                    }
                });
            }

            // Save all files
            safeWriteJson(files.all.path, files.all.data);
            safeWriteJson(files.week.path, files.week.data);
            safeWriteJson(files.like.path, files.like.data);
            safeWriteJson(files.likeWeek.path, files.likeWeek.data);
        }

        // [ALWAYS] Save to MongoDB (Leaderboard + Session) to stay in sync with VPS
        const operations = [];
        const sessionUpdateInc = {};
        const sessionUpdateSet = {};

        for (const [uniqueId, data] of Object.entries(users)) {
            const sKey = safeKey(uniqueId);
            // 1. Prepare Leaderboard Bulk Ops
            const updateObj = {
                $inc: {
                    totalCoins: data.coins || 0,
                    totalLikes: data.likes || 0,
                    weeklyCoins: data.coins || 0,
                    weeklyLikes: data.likes || 0
                },
                $set: {
                    userId: data.user.userId,
                    nickname: data.user.nickname,
                    profilePictureUrl: data.user.profilePictureUrl,
                    lastUpdated: new Date()
                }
            };

            // [NEW] Update individual gift counts
            if (data.gifts) {
                for (const [giftId, count] of Object.entries(data.gifts)) {
                    updateObj.$inc[`gifts.${giftId}`] = count;
                    updateObj.$inc[`weeklyGifts.${giftId}`] = count;

                    // Session Update (Gifts)
                    sessionUpdateInc[`users.${sKey}.gifts.${giftId}`] = count;
                    sessionUpdateInc[`users.${sKey}.weeklyGifts.${giftId}`] = count;
                }
            }

            operations.push({
                updateOne: {
                    filter: { token, uniqueId },
                    update: updateObj,
                    upsert: true
                }
            });

            // 2. Prepare Session Update (Aggregated)
            if (data.coins) {
                sessionUpdateInc[`users.${sKey}.totalCoins`] = data.coins;
                sessionUpdateInc[`users.${sKey}.weeklyCoins`] = data.coins;
            }
            if (data.likes) {
                sessionUpdateInc[`users.${sKey}.totalLikes`] = data.likes;
                sessionUpdateInc[`users.${sKey}.weeklyLikes`] = data.likes;
            }

            sessionUpdateSet[`users.${sKey}.userId`] = data.user.userId;
            sessionUpdateSet[`users.${sKey}.uniqueId`] = uniqueId;
            sessionUpdateSet[`users.${sKey}.nickname`] = data.user.nickname;
            sessionUpdateSet[`users.${sKey}.profilePictureUrl`] = data.user.profilePictureUrl;
            sessionUpdateSet[`users.${sKey}.lastUpdated`] = new Date();
        }

        sessionUpdateSet[`lastUpdated`] = new Date();

        if (operations.length > 0) {
            try {
                // Parallel update for speed
                const p1 = Leaderboard.bulkWrite(operations);

                const sessionUpdate = {};
                if (Object.keys(sessionUpdateInc).length > 0) sessionUpdate.$inc = sessionUpdateInc;
                if (Object.keys(sessionUpdateSet).length > 0) sessionUpdate.$set = sessionUpdateSet;

                // Session.updateOne for this token
                const p2 = Session.updateOne({ token }, sessionUpdate, { upsert: true });

                await Promise.all([p1, p2]);
            } catch (err) {
                console.error(`[LEADERBOARD] Bulk update failed for ${token}:`, err.message);
            }
        }

        // [ALWAYS] Emit sync event
        emitEvent('leaderboard_sync', { timestamp: Date.now() }, token);
    }
}

function queueLeaderboardUpdate(token, user, coins = 0, likes = 0, giftId = null, giftCount = 0) {
    if (!token || !user || !user.uniqueId) return;

    if (!leaderboardBuffer.has(token)) leaderboardBuffer.set(token, {});
    const tokenBuffer = leaderboardBuffer.get(token);

    if (!tokenBuffer[user.uniqueId]) {
        tokenBuffer[user.uniqueId] = { coins: 0, likes: 0, user, gifts: {} };
    }

    tokenBuffer[user.uniqueId].coins += coins;
    tokenBuffer[user.uniqueId].likes += likes;

    if (giftId && giftCount > 0) {
        tokenBuffer[user.uniqueId].gifts[giftId] = (tokenBuffer[user.uniqueId].gifts[giftId] || 0) + giftCount;
    }

    // Always update user info to latest
    tokenBuffer[user.uniqueId].user = user;

    if (!leaderboardSaveTimeout) {
        leaderboardSaveTimeout = setTimeout(() => {
            flushLeaderboardBuffer();
            leaderboardSaveTimeout = null;
        }, 2000); // Flush every 2 seconds for near real-time updates
    }
}

// [DEBOUNCE] One timer per token AND per kind of save. Single module-level timers made one
// streamer's events cancel another streamer's pending save when several lives run on the VPS.
const saveTimers = new Map();
function debounceSave(token, kind, delayMs, fn) {
    const key = `${token}:${kind}`;
    if (saveTimers.has(key)) clearTimeout(saveTimers.get(key));
    saveTimers.set(key, setTimeout(() => {
        saveTimers.delete(key);
        fn();
    }, delayMs));
}

// MongoDB treats '.' as a path separator and '$' as an operator: TikTok @ids such as
// "jean.pierre" would otherwise be split into nested objects in the Session document.
function safeKey(key) {
    return String(key).replace(/\./g, '\uFF0E').replace(/^\$/, '\uFF04');
}

function updateStats(connector, key, value = 1, isAbsolute = false) {
    if (!connector || !connector.stats) return;

    if (isAbsolute) {
        connector.stats[key] = value;
    } else {
        connector.stats[key] = (connector.stats[key] || 0) + value;
    }

    // Debounce/Emit stats update to avoid socket spam
    broadcastStats(connector);
}

// Helper to track unique viewers
function checkUniqueViewer(connector, uniqueId) {
    if (connector.uniqueViewers && !connector.uniqueViewers.has(uniqueId)) {
        connector.uniqueViewers.add(uniqueId);
        updateStats(connector, 'cumulativeViewers', 1);
        return true;
    }
    return false;
}


// Helper to update last event and persist it
function updateLastEvent(connector, type, data) {
    if (!connector || !connector.lastEvents) return;
    connector.lastEvents[type] = data;
    emitEvent('lastEvent', { type, data }, connector.token);

    // [DISABLED] User requested to stop spamming Activity collection.
    // Data is already aggregated in Leaderboard.
    /*
    const activity = new Activity({
        token: connector.token,
        type: type,
        userId: data.userId,
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        giftId: data.giftId,
        giftName: data.giftName,
        giftIcon: data.url || data.giftIcon,
        diamondCount: data.diamondCount || 0,
        repeatCount: data.repeatCount || 1,
        likeCount: data.likeCount || 0
    });
    activity.save().catch(e => console.error('[ACTIVITY] Save failed:', e.message));
    */

    // [DEBOUNCE] Only save to DB settings every 5 seconds to avoid spam
    debounceSave(connector.token, 'lastEvents', 5000, () => {
        if (connector.lastEvents) {
            config.saveSettings({ token: connector.token, lastEvents: connector.lastEvents });
        }
    });
}

// ---------------------------------------------------------------------------
// Gifts
// ---------------------------------------------------------------------------
function getGiftTracker(connector) {
    if (!connector.giftTracker) {
        connector.giftTracker = new GiftStreakTracker(
            (data, count) => handleNewGifts(connector, data, count),
            (data, total) => handleStreakEnd(connector, data, total)
        );
    }
    return connector.giftTracker;
}

/**
 * Called with `count` NEW gifts (never the same gift twice). Updates every counter and runs
 * the configured actions once per gift.
 */
function handleNewGifts(connector, data, count) {
    if (!connector || !connector.stats || connector.isStopping) return;
    const { getGiftPrice } = require('../utils/giftPrices');
    const unitPrice = getGiftPrice(data);
    const coinsAdded = unitPrice * count;
    const giftIcon = data.url;
    const giftName = translateGift(data.giftName);

    updateStats(connector, 'gifts', count);
    if (coinsAdded > 0) updateStats(connector, 'diamonds', coinsAdded);

    // Persistent leaderboard (coins + per-gift count, free gifts included)
    queueLeaderboardUpdate(connector.token, data, coinsAdded, 0, data.giftId, count);

    if (!connector.stats.giftsBreakdown) connector.stats.giftsBreakdown = {};
    connector.stats.giftsBreakdown[giftName] = (connector.stats.giftsBreakdown[giftName] || 0) + count;

    // Session "top coins" leaderboard
    if (!connector.topCoinsMap) connector.topCoinsMap = new Map();
    const currentCoinUser = connector.topCoinsMap.get(data.uniqueId) || {
        userId: data.userId,
        uniqueId: data.uniqueId,
        nickname: data.nickname,
        profilePictureUrl: data.profilePictureUrl,
        coins: 0
    };
    if (data.profilePictureUrl) currentCoinUser.profilePictureUrl = data.profilePictureUrl;
    if (data.nickname) currentCoinUser.nickname = data.nickname;
    currentCoinUser.coins += coinsAdded;
    connector.topCoinsMap.set(data.uniqueId, currentCoinUser);

    const limitCoins = connector.stats.topCoinsLimit || 10;
    connector.stats.topCoins = Array.from(connector.topCoinsMap.values())
        .sort((a, b) => b.coins - a.coins)
        .slice(0, limitCoins);

    debounceSave(connector.token, 'topCoins', 3000, () => {
        config.saveSettings({ token: connector.token, topCoins: connector.stats.topCoins });
    });

    if (unitPrice > (connector.stats.topGift?.coins || 0)) {
        connector.stats.topGift = {
            userId: data.userId,
            uniqueId: data.uniqueId,
            nickname: data.nickname,
            coins: unitPrice,
            giftName: giftName,
            giftIcon: giftIcon
        };
        debounceSave(connector.token, 'topGift', 3000, () => {
            config.saveSettings({ token: connector.token, topGift: connector.stats.topGift });
        });
    }

    const comboCount = parseInt(data.repeatCount, 10) || count;
    if (comboCount > (connector.stats.topStreak?.count || 0)) {
        connector.stats.topStreak = {
            userId: data.userId,
            uniqueId: data.uniqueId,
            nickname: data.nickname,
            count: comboCount,
            giftName: giftName,
            giftIcon: giftIcon
        };
        debounceSave(connector.token, 'topStreak', 3000, () => {
            config.saveSettings({ token: connector.token, topStreak: connector.stats.topStreak });
        });
    }

    broadcastStatsImmediate(connector);

    // `repeatCount` = gifts in THIS batch, `comboCount` = position in the combo
    const giftEvent = { ...data, repeatCount: count, comboCount, coins: coinsAdded, unitPrice };
    emitStats('gift', giftEvent, connector.token);

    // Actions: each call gets its own copy (executeAction mutates the context)
    const actionContext = { ...data, repeatCount: count, comboCount, repeatEnd: true };
    actionManager.executeAction(`gift:${data.giftName}`, { ...actionContext }, connector);
    actionManager.executeAction('gift_min', { ...actionContext }, connector);

    getUserInfo(data.uniqueId, data).then(info => {
        if (info) {
            data.nickname = info.nickname || data.nickname;
            data.profilePictureUrl = info.profilePictureUrl || data.profilePictureUrl;
            queueLeaderboardUpdate(connector.token, data, 0, 0);
        }
        updateLastEvent(connector, 'gift', { ...data, repeatCount: comboCount });
    });
}

/** Called once when a combo is finished (or immediately for single gifts): used by alerts */
function handleStreakEnd(connector, data, total) {
    if (!connector || connector.isStopping) return;
    const { getGiftPrice } = require('../utils/giftPrices');
    const unitPrice = getGiftPrice(data);
    emitEvent('tiktok_alert', {
        type: 'gift',
        data: alertPayload(data, {
            giftId: data.giftId,
            giftName: translateGift(data.giftName),
            giftIcon: data.url,
            repeatCount: total,
            unitPrice,
            coins: unitPrice * total
        })
    }, connector.token);
}

function registerEvents(tiktokConnection, connector) {
    tiktokConnection.on('connected', async () => {
        logger.info(`✅ Connecté au live ! ID de la session : ${tiktokConnection.roomId}`);
        connector.hasConnected = true;

        const settings = await config.getSettings(connector.token);

        // Extract total likes of the live from roomInfo if available
        let initialLikes = 0;
        if (tiktokConnection.roomInfo) {
            initialLikes = tiktokConnection.roomInfo.likeCount || tiktokConnection.roomInfo.totalLikeCount || tiktokConnection.roomInfo.like_count || tiktokConnection.roomInfo.total_like_count || (tiktokConnection.roomInfo.stats && tiktokConnection.roomInfo.stats.likeCount) || 0;
        }

        if (initialLikes > 0) {
            updateStats(connector, 'likes', initialLikes, true);
        }

        if (settings.likesGoal && settings.likesGoal.enabled) {
            const goal = settings.likesGoal;
            if (initialLikes > 0) {
                goal.count = initialLikes;
            } else if (connector.stats && connector.stats.likes > 0) {
                goal.count = connector.stats.likes;
            }

            // Find action name for the overlay
            if (goal.actionId && goal.actionId !== 'none') {
                const Action = require('../models/Action');
                const action = await Action.findOne({ id: goal.actionId });
                if (action) goal.actionName = action.name;
            }

            emitEvent('likes_goal_update', goal, connector.token);
        }

        // Store limits on connector
        connector.topCoinsLimit = settings.topCoins?.limit || 10;
        connector.topLikesLimit = settings.topLikes?.limit || 10;

        // Broadcast full session stats on successful connection
        emitEvent('session_stats', connector.stats, connector.token);
    });

    tiktokConnection.on('disconnected', (info) => {
        // Ignore events from a connection we already replaced (reconnection)
        if (connector.connection !== tiktokConnection) return;
        logger.warn('❌ Déconnecté de TikTok Live.');

        // Save what we have, then reconnect automatically (unless the live ended / user stopped)
        flushLeaderboardBuffer();
        if (!connector.isStopping) {
            connector.handleDisconnect(info && info.reason ? String(info.reason) : '');
        }
    });

    tiktokConnection.on('error', (err) => {
        const errorMsg = err && err.message ? err.message : JSON.stringify(err);
        logger.error(`🚨 Error: ${errorMsg}`);

        // If it's a fatal error (live ended), stop the connector
        if (errorMsg.includes('LIVE has ended') || errorMsg.includes('not live')) {
            logger.warn('⚠️ Live terminé détecté, arrêt du connecteur...');
            connector.streamEnded = true;
            emitEvent('notification', {
                type: 'error',
                title: 'Live terminé',
                message: 'Le live TikTok est terminé ou l\'utilisateur n\'est pas en live.'
            }, connector.token);
            connector.stop();
        }
    });


    tiktokConnection.on('chat', async (data) => {
        data = normalizeChat(data);
        // [ANTI-SPAM] Ignore duplicates and messages from before the bot started
        if (isDuplicateMessage(connector, data) || isOldMessage(connector, data)) return;

        const token = connector.token;

        updateStats(connector, 'chats', 1);
        checkUniqueViewer(connector, data.uniqueId);

        const settings = await config.getSettings(token);

        // Spotify Commands
        const spotify = settings.spotify;
        if (spotify && spotify.enabled) {
            const perms = spotify.allowedUsers || { all: true };
            const isMod = data.isModerator === true || (data.userBadges && Array.isArray(data.userBadges) && data.userBadges.some(b => b.type && b.type.toLowerCase().includes('moderator')));
            const isSub = data.isSubscriber === true || (data.userBadges && Array.isArray(data.userBadges) && data.userBadges.some(b => b.type && b.type.toLowerCase().includes('subscriber')));

            let hasAccess = false;
            if (perms.all) {
                hasAccess = true;
            } else {
                if (perms.moderators && isMod) hasAccess = true;
                if (perms.subscribers && isSub) hasAccess = true;
                if (perms.followers && (data.followRole == 1 || data.followRole == 2)) hasAccess = true;
            }

            if (hasAccess && data.comment && typeof data.comment === 'string') {
                const comment = data.comment.trim();
                const lowerComment = comment.toLowerCase();
                const spotifyModule = require('../utils/spotifyModule');

                const playCmd = (spotify.commands.play || '!play').toLowerCase();
                if (lowerComment.startsWith(playCmd) && spotify.playEnabled !== false) {
                    const query = comment.substring(playCmd.length).trim();
                    const result = await spotifyModule.playTrack(token, query, data.userId, data.uniqueId, isMod, isSub);
                    if (result && result.success) {
                        emitEvent('log', { level: 'info', message: `🎵 [Spotify] ${data.uniqueId} a ajouté : ${result.track.name}` }, token);
                    } else if (result) {
                        const reasonMap = {
                            'disabled': 'Le système Spotify est désactivé.',
                            'limit_reached': `Vous avez atteint votre limite (${spotify.maxTracksPerUser} musiques).`,
                            'query_too_short': 'La recherche est trop courte.',
                            'not_found': `Musique introuvable pour "${query}".`,
                            'duplicate': 'Cette musique est déjà dans la file d\'attente.',
                            'api_error': 'Erreur API Spotify. Réessayez plus tard.'
                        };
                        emitEvent('log', { level: 'info', message: `⚠️ [Spotify] ${data.uniqueId}, ${reasonMap[result.reason] || 'Erreur inconnue.'}` }, token);
                    }
                }
                else if (lowerComment.trim() === (spotify.commands.skip || '!skip').toLowerCase() && spotify.skipEnabled !== false) {
                    const result = await spotifyModule.skipTrack(token, data.userId, data.uniqueId, isMod, isSub, data.followRole);
                    if (result && result.success) {
                        const msg = result.skipType === 'moderator' ? `⏭️ [Spotify] Passé par le modérateur ${data.uniqueId}` :
                            result.skipType === 'requester' ? `⏭️ [Spotify] Passé par ${data.uniqueId} (auteur)` :
                                result.skipType === 'subscriber' ? `⏭️ [Spotify] Passé par l'abonné ${data.uniqueId}` :
                                    `⏭️ [Spotify] Musique passée par vote.`;
                        emitEvent('log', { level: 'info', message: msg }, token);
                        emitEvent('trackSkipped', { userName: data.uniqueId, type: result.skipType }, token);
                    } else if (result) {
                        const reasonMap = {
                            'vote_added': `Vote ajouté (${result.current}/${result.required}).`,
                            'no_active_device': 'Aucun appareil Spotify actif trouvé. Lancez Spotify !',
                            'premium_required': 'Compte Spotify Premium requis.',
                            'streamer_music': 'Impossible de skip la musique du streamer sans voter.',
                            'api_unavailable': 'API Spotify indisponible.',
                            'api_error': `Erreur : ${result.message || 'Erreur inconnue'}`
                        };
                        if (result.reason === 'vote_added') {
                            emitEvent('skipVoteUpdate', { current: result.current, required: result.required }, token);
                        }
                        emitEvent('log', { level: 'info', message: `⚠️ [Spotify] ${data.uniqueId}, ${reasonMap[result.reason] || result.reason}` }, token);
                    }
                }
                else if (lowerComment.trim() === (spotify.commands.remove || '!remove').toLowerCase()) {
                    const result = spotifyModule.removeLastTrack(token, data.userId, data.uniqueId);
                    if (result && result.success) {
                        emitEvent('log', { level: 'info', message: `🗑️ [Spotify] ${data.uniqueId} a retiré sa dernière musique.` }, token);
                    } else if (result && result.reason === 'not_found') {
                        emitEvent('log', { level: 'info', message: `⚠️ [Spotify] ${data.uniqueId}, vous n'avez pas de musique dans la file.` }, token);
                    }
                }
            }
        }

        const tts = settings.tts || {};
        if (tts.enabled) {
            const perms = tts.allowedUsers || { subscribers: true, moderators: true };
            let hasTTSAccess = false;
            if (perms.all) {
                hasTTSAccess = true;
            } else {
                if (perms.moderators && data.isModerator) hasTTSAccess = true;
                if (perms.subscribers && data.isSubscriber) hasTTSAccess = true;
                if (perms.followers && (data.followRole == 1 || data.followRole == 2)) hasTTSAccess = true;
            }
            data.eligibleForTTS = hasTTSAccess;
        }

        emitEvent('chat', data, token);

        getUserInfo(data.uniqueId, data).then(info => {
            if (info) {
                data.nickname = info.nickname || data.nickname;
                data.profilePictureUrl = info.profilePictureUrl || data.profilePictureUrl;
            }
            updateLastEvent(connector, 'chat', data);
        });

        actionManager.executeAction('chat', { ...data, message: data.comment }, connector);
        actionManager.executeAction('command', { ...data, message: data.comment }, connector);

        // "Premier message" trigger: first chat message of this viewer during the live
        if (!connector.chattedUsers) connector.chattedUsers = new Set();
        const chatKey = String(data.userId || data.uniqueId || '');
        if (chatKey && !connector.chattedUsers.has(chatKey)) {
            connector.chattedUsers.add(chatKey);
            actionManager.executeAction('first_message', { ...data, message: data.comment }, connector);
        }
    });

    tiktokConnection.on('gift', (data) => {
        data = normalizeGift(data);
        if (isDuplicateMessage(connector, data) || isOldMessage(connector, data)) return;

        const { getGiftIcon, resolveGiftName } = require('../utils/giftPrices');
        data.giftName = resolveGiftName(data);
        const giftIcon = getGiftIcon(data);
        if (giftIcon) data.url = giftIcon;

        // The streak engine calls handleNewGifts() with the exact number of NEW gifts
        getGiftTracker(connector).push(data);
    });

    tiktokConnection.on('follow', (data) => {
        data = normalizeSocial(data);
        if (isDuplicateMessage(connector, data)) return;
        // Unfollow + follow again must not trigger actions twice in the same live
        if (!isFirstTimeThisLive(connector, 'follow', data)) return;

        updateStats(connector, 'follows', 1);
        actionManager.executeAction('follow', data, connector);
        emitStats('follow', data, connector.token);
        emitEvent('notify', { type: 'follow', user: data.uniqueId }, connector.token);
        emitEvent('tiktok_alert', { type: 'follow', data: alertPayload(data) }, connector.token);

        getUserInfo(data.uniqueId, data).then(info => {
            if (info) {
                data.nickname = info.nickname || data.nickname;
                data.profilePictureUrl = info.profilePictureUrl || data.profilePictureUrl;
            }
            updateLastEvent(connector, 'follower', data);
        });
    });

    tiktokConnection.on('share', (data) => {
        data = normalizeSocial(data);
        if (isDuplicateMessage(connector, data)) return;

        updateStats(connector, 'shares', 1);
        emitStats('share', data, connector.token);
        emitEvent('tiktok_alert', { type: 'share', data: alertPayload(data) }, connector.token);
        actionManager.executeAction('share', data, connector);

        getUserInfo(data.uniqueId, data).then(info => {
            if (info) {
                data.nickname = info.nickname || data.nickname;
                data.profilePictureUrl = info.profilePictureUrl || data.profilePictureUrl;
            }
            updateLastEvent(connector, 'share', data);
        });
    });

    tiktokConnection.on('like', async (data) => {
        data = normalizeLike(data);
        if (isDuplicateMessage(connector, data)) return;
        const likeCountNow = data.likeCount || 1;
        const totalLikeCount = data.totalLikeCount;

        checkUniqueViewer(connector, data.uniqueId);

        const settings = await config.getSettings(connector.token);

        // Update total likes (absolute) if we have totalLikeCount, otherwise increment
        if (totalLikeCount !== null && totalLikeCount > 0) {
            updateStats(connector, 'likes', totalLikeCount, true);
        } else if (likeCountNow > 0) {
            updateStats(connector, 'likes', likeCountNow, false);
        }

        // [NEW] UPDATE PERSISTENT LEADERBOARD (Likes)
        queueLeaderboardUpdate(connector.token, data, 0, likeCountNow);

        if (!connector.topLikesMap) connector.topLikesMap = new Map();
        const currentLikeUser = connector.topLikesMap.get(data.uniqueId) || {
            userId: data.userId,
            uniqueId: data.uniqueId,
            nickname: data.nickname,
            profilePictureUrl: data.profilePictureUrl,
            count: 0
        };
        if (data.profilePictureUrl) currentLikeUser.profilePictureUrl = data.profilePictureUrl;
        if (data.nickname) currentLikeUser.nickname = data.nickname;
        currentLikeUser.count += likeCountNow;
        connector.topLikesMap.set(data.uniqueId, currentLikeUser);

        const limitLikes = connector.stats.topLikesLimit || 10;
        connector.stats.topLikes = Array.from(connector.topLikesMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limitLikes);

        debounceSave(connector.token, 'topLikes', 5000, () => {
            config.saveSettings({
                token: connector.token,
                topLikes: connector.stats.topLikes
            });
        });

        broadcastStats(connector);

        if (settings.likesGoal && settings.likesGoal.enabled) {
            const goal = settings.likesGoal;
            const previousCount = goal.count || 0;
            const currentTotalLikes = (totalLikeCount !== null && totalLikeCount > 0)
                ? totalLikeCount
                : ((connector.stats && connector.stats.likes > 0) ? connector.stats.likes : (previousCount + (likeCountNow || 1)));

            goal.count = currentTotalLikes;

            const step = goal.goalStep || goal.initialGoal || 1000;

            // Ensure goal.goal is aligned to the next step milestone if current likes exceed goal.goal
            if (!goal.goal || goal.goal <= currentTotalLikes) {
                if (goal.whenReached === 'increase') {
                    goal.goal = Math.ceil((currentTotalLikes + 1) / step) * step;
                }
            }

            let triggerCount = 0;
            while (goal.enabled && goal.count >= goal.goal) {
                const currentStepGoal = goal.goal;
                if (previousCount < currentStepGoal) {
                    logger.info(`🎯 [GOAL] Objectif de likes ATTEINT (${currentStepGoal}) !`);
                    triggerCount++;
                }
                if (goal.whenReached === 'increase') {
                    goal.goal += step;
                } else if (goal.whenReached === 'double') {
                    goal.goal *= 2;
                } else if (goal.whenReached === 'hide') {
                    goal.enabled = false;
                } else {
                    break;
                }
                if (goal.goal <= currentStepGoal) break;
            }

            if (triggerCount > 0 && goal.actionId && goal.actionId !== 'none') {
                for (let i = 0; i < triggerCount; i++) {
                    actionManager.executeActionById(goal.actionId, connector);
                }
            }

            config.saveSettings({ token: connector.token, likesGoal: goal });
            emitEvent('likes_goal_update', goal, connector.token);
        }

        actionManager.executeAction('like', data, connector);
        emitStats('like', data, connector.token);

        getUserInfo(data.uniqueId, data).then(info => {
            if (info) {
                data.nickname = info.nickname || data.nickname;
                data.profilePictureUrl = info.profilePictureUrl || data.profilePictureUrl;

                if (connector.topLikesMap && connector.topLikesMap.has(data.uniqueId)) {
                    const user = connector.topLikesMap.get(data.uniqueId);
                    if (data.profilePictureUrl) user.profilePictureUrl = data.profilePictureUrl;
                    if (data.nickname) user.nickname = data.nickname;

                    const limitLikes = connector.stats.topLikesLimit || 10;
                    connector.stats.topLikes = Array.from(connector.topLikesMap.values())
                        .sort((a, b) => b.count - a.count)
                        .slice(0, limitLikes);

                    broadcastStats(connector);
                }

                queueLeaderboardUpdate(connector.token, data, 0, 0);
            }
            updateLastEvent(connector, 'like', data);
        });
    });

    tiktokConnection.on('member', (data) => {
        data = normalizeMember(data);
        if (isDuplicateMessage(connector, data)) return;
        checkUniqueViewer(connector, data.uniqueId);
        updateViewerCountIfPresent(connector, data);
        actionManager.executeAction('member', data, connector);
    });

    tiktokConnection.on('subscribe', (data) => {
        data = normalizeSubscribe(data);
        if (isDuplicateMessage(connector, data)) return;
        if (!isFirstTimeThisLive(connector, 'subscribe', data)) return;

        logger.info(`🌟 [SUB] ${data.uniqueId} s'est abonné !`);
        updateStats(connector, 'subscribers', 1);
        emitStats('subscribe', data, connector.token);
        emitEvent('tiktok_alert', { type: 'subscribe', data: alertPayload(data, { subMonth: data.subMonth }) }, connector.token);
        actionManager.executeAction('subscribe', data, connector);
        getUserInfo(data.uniqueId, data).then(info => {
            if (info) {
                data.nickname = info.nickname || data.nickname;
                data.profilePictureUrl = info.profilePictureUrl || data.profilePictureUrl;
            }
            updateLastEvent(connector, 'subscriber', data);
        });
    });

    tiktokConnection.on('roomUser', async (data) => {
        data = normalizeRoomUser(data);
        updateViewerCountIfPresent(connector, data);
        if (data.likeCount !== null && data.likeCount > 0) {
            updateStats(connector, 'likes', data.likeCount, true);
            const settings = await config.getSettings(connector.token);
            if (settings.likesGoal && settings.likesGoal.enabled) {
                settings.likesGoal.count = data.likeCount;
                emitEvent('likes_goal_update', settings.likesGoal, connector.token);
            }
        }
    });

    // Subscriber emotes sent in the chat
    tiktokConnection.on('emote', (data) => {
        data = normalizeSocial(data);
        if (isDuplicateMessage(connector, data) || isOldMessage(connector, data)) return;
        const emote = Array.isArray(data.emotes) && data.emotes[0] ? data.emotes[0] : {};
        actionManager.executeAction('emote', { ...data, emoteId: emote.emoteId, emoteImageUrl: emote.emoteImageUrl }, connector);
    });

    // Questions asked with the TikTok "Q&A" feature
    tiktokConnection.on('questionNew', (data) => {
        data = normalizeSocial(data);
        if (isDuplicateMessage(connector, data)) return;
        const question = data.questionText || data.content || '';
        actionManager.executeAction('question', { ...data, comment: question, message: question }, connector);
        emitEvent('tiktok_alert', { type: 'question', data: alertPayload(data, { question }) }, connector.token);
    });

    tiktokConnection.on('streamEnd', () => {
        logger.warn('⏹️ Le stream est terminé.');
        connector.streamEnded = true;
        emitEvent('notification', {
            type: 'info',
            title: 'Stream terminé',
            message: 'Le live TikTok est terminé.'
        }, connector.token);
        connector.stop();
    });
}

module.exports = { registerEvents };
