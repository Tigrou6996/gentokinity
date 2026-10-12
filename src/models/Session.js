const mongoose = require('mongoose');

// Schéma pour regrouper tous les utilisateurs d'un token dans un seul document
// Idéal pour la visualisation dans la DB, mais attention à la limite de 16MB si très gros live
const SessionSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true, index: true },
    users: {
        type: Map,
        of: new mongoose.Schema({
            userId: String,
            uniqueId: String,
            nickname: String,
            profilePictureUrl: String,
            totalCoins: { type: Number, default: 0 },
            totalLikes: { type: Number, default: 0 },
            weeklyCoins: { type: Number, default: 0 },
            weeklyLikes: { type: Number, default: 0 },
            gifts: { type: Map, of: Number, default: {} },
            weeklyGifts: { type: Map, of: Number, default: {} },
            lastUpdated: { type: Date, default: Date.now }
        }, { _id: false })
    },
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Session', SessionSchema);
