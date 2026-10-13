const mongoose = require('mongoose');

// One document per viewer and per streamer (token): the "User & Points" database
const ViewerPointsSchema = new mongoose.Schema({
    token: { type: String, required: true },
    uniqueId: { type: String, required: true },
    userId: String,
    nickname: String,
    profilePictureUrl: String,
    points: { type: Number, default: 0 },       // spendable balance
    levelPoints: { type: Number, default: 0 },  // total earned (never decreases) -> level
    stats: {
        coins: { type: Number, default: 0 },
        gifts: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        follows: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },
        chats: { type: Number, default: 0 },
        subs: { type: Number, default: 0 },
        watchMinutes: { type: Number, default: 0 }
    },
    lastDaily: Date,                             // last !daily bonus
    firstActivity: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now }
});

ViewerPointsSchema.index({ token: 1, uniqueId: 1 }, { unique: true });
ViewerPointsSchema.index({ token: 1, points: -1 });
ViewerPointsSchema.index({ token: 1, levelPoints: -1 });

module.exports = mongoose.model('ViewerPoints', ViewerPointsSchema);
