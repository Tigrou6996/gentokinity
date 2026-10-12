const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
    token: { type: String, required: true, index: true }, // Streamer token
    type: { type: String, required: true, index: true }, // 'gift', 'follow', 'share', 'like', 'subscribe', 'chat'

    // User info
    userId: String,
    uniqueId: String,
    nickname: String,
    profilePictureUrl: String,

    // Gift specific
    giftId: Number,
    giftName: String,
    giftIcon: String,
    diamondCount: Number,
    repeatCount: Number,

    // Like specific
    likeCount: Number,

    // Global
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Auto-expire after 30 days to keep DB lean, streamer only needs recent activity
ActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Activity', ActivitySchema);
