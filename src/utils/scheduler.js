const cron = require('node-cron');
const Leaderboard = require('../models/Leaderboard');
const History = require('../models/History');
const { getFullGiftList } = require('./giftPrices');
const logger = require('./logger');

/**
 * Weekly reset task: Every Sunday at 23:00 (11 PM)
 */
function initScheduler() {
    // Cron pattern for Sunday at 23:00
    // minute hour dayOfMonth month dayOfWeek
    cron.schedule('0 23 * * 0', async () => {
        logger.info('🕒 [SCHEDULER] Démarrage du reset hebdomadaire...');
        await performWeeklyReset();
    }, {
        scheduled: true,
        timezone: "Europe/Paris"
    });
}

// Same user counted in two archives of the same week (manual save, then Sunday): counts are added up
function mergeTop(oldList, newList, limit) {
    const map = new Map();
    for (const u of [...(oldList || []), ...(newList || [])]) {
        const key = u.uniqueId;
        const prev = map.get(key);
        map.set(key, prev ? { ...prev, ...u, count: (prev.count || 0) + (u.count || 0) } : { ...u });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, limit);
}

function mergeLegends(oldLegends, newLegends) {
    const map = new Map();
    for (const l of [...(oldLegends || []), ...(newLegends || [])]) {
        const key = String(l.giftId);
        const prev = map.get(key);
        map.set(key, prev ? { ...prev, giftName: prev.giftName || l.giftName, topUsers: mergeTop(prev.topUsers, l.topUsers, 5) } : { giftId: l.giftId, giftName: l.giftName, topUsers: mergeTop([], l.topUsers, 5) });
    }
    return Array.from(map.values());
}

const plainUser = (u) => ({ uniqueId: u.uniqueId, nickname: u.nickname, profilePictureUrl: u.profilePictureUrl });

/**
 * Archives the week (top coins, top likes, top 5 per gift = "Top Légende") then resets the weekly counters.
 * - Runs only on the VPS (see initScheduler): the desktop apps share the same database.
 * - A week without activity changes nothing; a second archive of the same week is merged, never replaced.
 * - Gifts that are not in the Gentok catalog are kept (named "Cadeau #id").
 */
async function performWeeklyReset(onlyToken = null) {
    try {
        const tokens = onlyToken ? [onlyToken] : await Leaderboard.distinct('token');
        const catalog = new Map(getFullGiftList().map(g => [String(g.id), g]));

        const now = new Date();
        const period = `${now.getFullYear()}-W${getWeekNumber(now)}`;

        for (const token of tokens) {
            try {
                const rows = await Leaderboard.find({ token }).lean();
                const weeklyGiftsOf = (u) => Object.entries(u.weeklyGifts || {}).filter(([, n]) => Number(n) > 0);
                const active = rows.filter(u => (u.weeklyCoins > 0) || (u.weeklyLikes > 0) || weeklyGiftsOf(u).length);
                if (!active.length) continue; // nothing this week: the archive (if any) stays as it is

                const topCoins = active.filter(u => u.weeklyCoins > 0).sort((a, b) => b.weeklyCoins - a.weeklyCoins).slice(0, 10)
                    .map(u => ({ ...plainUser(u), count: u.weeklyCoins }));
                const topLikes = active.filter(u => u.weeklyLikes > 0).sort((a, b) => b.weeklyLikes - a.weeklyLikes).slice(0, 10)
                    .map(u => ({ ...plainUser(u), count: u.weeklyLikes }));

                const byGift = new Map();
                for (const u of active) {
                    for (const [giftId, n] of weeklyGiftsOf(u)) {
                        if (!byGift.has(giftId)) byGift.set(giftId, []);
                        byGift.get(giftId).push({ ...plainUser(u), count: Number(n) });
                    }
                }
                const legends = Array.from(byGift.entries()).map(([giftId, users]) => ({
                    giftId: Number(giftId) || 0,
                    giftName: (catalog.get(giftId) && catalog.get(giftId).name) || `Cadeau #${giftId}`,
                    topUsers: users.sort((a, b) => b.count - a.count).slice(0, 5)
                }));

                const existing = await History.findOne({ token, period, type: 'weekly' }).lean();
                await History.findOneAndUpdate(
                    { token, period, type: 'weekly' },
                    {
                        topCoins: mergeTop(existing && existing.topCoins, topCoins, 10),
                        topLikes: mergeTop(existing && existing.topLikes, topLikes, 10),
                        legends: mergeLegends(existing && existing.legends, legends),
                        timestamp: new Date()
                    },
                    { upsert: true }
                );

                await Leaderboard.updateMany({ token }, { $set: { weeklyCoins: 0, weeklyLikes: 0, weeklyGifts: {} } });
                logger.info(`✅ [SCHEDULER] Semaine ${period} archivée pour ${token.substring(0, 8)}... (${legends.length} cadeaux)`);
            } catch (err) {
                logger.error(`❌ [SCHEDULER] Échec du reset pour le token ${token.substring(0, 8)}... : ${err.message}`);
            }
        }

        logger.info('🎉 [SCHEDULER] Reset hebdomadaire global terminé !');
    } catch (err) {
        logger.error(`🚨 [SCHEDULER] Erreur fatale dans le reset hebdomadaire : ${err.message}`);
    }
}

/**
 * Helper to get ISO week number
 */
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

module.exports = { initScheduler, performWeeklyReset, mergeTop, mergeLegends };
