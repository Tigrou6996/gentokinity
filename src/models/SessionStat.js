const mongoose = require('mongoose');

const SessionStatSchema = new mongoose.Schema({
    token: { type: String, required: true, index: true },
    username: { type: String, required: true },
    date: {
        type: Date,
        default: Date.now,
        index: { expires: '90d' } // Auto-delete after 90 days to save space
    },
    diamonds: { type: Number, default: 0 },
    gifts: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    follows: { type: Number, default: 0 },
    chats: { type: Number, default: 0 },
    viewerCountMax: { type: Number, default: 0 },
    cumulativeViewers: { type: Number, default: 0 },
    duration: { type: Number, default: 0 }, // duration in seconds
    actionsBreakdown: { type: Map, of: Number, default: {} },
    giftsBreakdown: { type: Map, of: Number, default: {} }
});

module.exports = mongoose.model('SessionStat', SessionStatSchema);
