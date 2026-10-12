const cron = require('node-cron');
const Leaderboard = require('../models/Leaderboard');
const History = require('../models/History');
const Settings = require('../models/Settings');
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

async function performWeeklyReset(onlyToken = null) {
    try {
        // 1. Get tokens that have leaderboard activity
        const tokens = onlyToken ? [onlyToken] : await Leaderboard.distinct('token');
        const gifts = getFullGiftList();

        const now = new Date();
        const year = now.getFullYear();
        const weekNumber = getWeekNumber(now);
        const period = `${year}-W${weekNumber}`;

        for (const token of tokens) {
            try {
                // 2. Fetch all users for this token with weekly stats
                const allDonors = await Leaderboard.find({
                    token,
                    $or: [
                        { weeklyCoins: { $gt: 0 } },
                        { weeklyLikes: { $gt: 0 } },
                        { weeklyGifts: { $exists: true } }
                    ]
                }).lean();

                if (allDonors.length === 0) continue;

                // 3. Extract Top Users for History
                const topCoins = allDonors
                    .filter(u => u.weeklyCoins > 0)
                    .sort((a, b) => b.weeklyCoins - a.weeklyCoins)
                    .slice(0, 10)
                    .map(u => ({
                        uniqueId: u.uniqueId,
                        nickname: u.nickname,
                        profilePictureUrl: u.profilePictureUrl,
                        count: u.weeklyCoins
                    }));

                const topLikes = allDonors
                    .filter(u => u.weeklyLikes > 0)
                    .sort((a, b) => b.weeklyLikes - a.weeklyLikes)
                    .slice(0, 10)
                    .map(u => ({
                        uniqueId: u.uniqueId,
                        nickname: u.nickname,
                        profilePictureUrl: u.profilePictureUrl,
                        count: u.weeklyLikes
                    }));

                const legends = gifts.map(gift => {
                    const giftIdStr = gift.id.toString();
                    const topUsers = allDonors
                        .filter(u => u.weeklyGifts && u.weeklyGifts[giftIdStr] > 0)
                        .map(u => ({
                            uniqueId: u.uniqueId,
                            nickname: u.nickname,
                            profilePictureUrl: u.profilePictureUrl,
                            count: u.weeklyGifts[giftIdStr]
                        }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5);

                    return topUsers.length > 0 ? {
                        giftId: gift.id,
                        giftName: gift.name,
                        topUsers
                    } : null;
                }).filter(l => l !== null);

                // 4. Save to History
                await History.findOneAndUpdate(
                    { token, period, type: 'weekly' },
                    {
                        topCoins,
                        topLikes,
                        legends,
                        timestamp: new Date()
                    },
                    { upsert: true }
                );

                // 5. Reset Weekly values in Leaderboard
                await Leaderboard.updateMany(
                    { token },
                    {
                        $set: {
                            weeklyCoins: 0,
                            weeklyLikes: 0,
                            weeklyGifts: {}
                        }
                    }
                );

                logger.info(`✅ [SCHEDULER] Reset hebdomadaire terminé pour le token : ${token.substring(0, 8)}...`);
            } catch (err) {
                logger.error(`❌ [SCHEDULER] Échec du reset pour le token ${token}:`, err.message);
            }
        }

        logger.info('🎉 [SCHEDULER] Reset hebdomadaire global terminé !');
    } catch (err) {
        logger.error('🚨 [SCHEDULER] Erreur fatale dans le reset hebdomadaire:', err.message);
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

module.exports = { initScheduler, performWeeklyReset };
