const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
    token: { type: String, required: true, index: true }, // Streamer token
    period: { type: String, required: true, index: true }, // Format: "YYYY-WW" or "YYYY-MM-DD"
    type: { type: String, default: 'weekly' }, // 'weekly', 'monthly'

    // Top users for this period
    topCoins: [{
        uniqueId: String,
        nickname: String,
        profilePictureUrl: String,
        count: Number
    }],
    topLikes: [{
        uniqueId: String,
        nickname: String,
        profilePictureUrl: String,
        count: Number
    }],

    // Legends (per gift)
    legends: [{
        giftId: Number,
        giftName: String,
        topUsers: [{
            uniqueId: String,
            nickname: String,
            profilePictureUrl: String,
            count: Number
        }]
    }],

    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Prevent duplicate history for same token/period
HistorySchema.index({ token: 1, period: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('History', HistorySchema);
