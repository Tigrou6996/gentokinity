const mongoose = require('mongoose');

// History of point changes (kept 30 days)
const PointTransactionSchema = new mongoose.Schema({
    token: { type: String, required: true, index: true },
    uniqueId: String,
    nickname: String,
    delta: Number,
    reason: String, // gift | like | follow | share | chat | sub | watch | manual | spend | battle
    details: String,
    date: { type: Date, default: Date.now }
});

PointTransactionSchema.index({ date: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
PointTransactionSchema.index({ token: 1, date: -1 });

module.exports = mongoose.model('PointTransaction', PointTransactionSchema);
