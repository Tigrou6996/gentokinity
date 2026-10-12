const mongoose = require('mongoose');

const LeaderboardSchema = new mongoose.Schema({
    token: { type: String, required: true, index: true }, // Streamer token
    userId: { type: String, required: true }, // TikTok User ID
    uniqueId: { type: String, required: true, index: true }, // TikTok @uniqueId
    nickname: { type: String, default: 'Un utilisateur' },
    profilePictureUrl: { type: String, default: '' },

    totalCoins: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },

    // [NEW] Per-gift statistics: { giftId: count }
    gifts: { type: Map, of: Number, default: {} },

    // Weekly stats
    weeklyCoins: { type: Number, default: 0 },
    weeklyLikes: { type: Number, default: 0 },
    weeklyGifts: { type: Map, of: Number, default: {} },

    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index to quickly find a user's score for a specific streamer
LeaderboardSchema.index({ token: 1, uniqueId: 1 }, { unique: true });

module.exports = mongoose.model('Leaderboard', LeaderboardSchema);
