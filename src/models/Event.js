const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    token: { type: String, required: true, index: true },
    sceneId: { type: String, default: null, index: true },
    id: { type: String, required: true },
    name: String,
    active: { type: Boolean, default: true },
    who: { type: String, default: 'everyone' },
    specificUser: String,
    triggerType: { type: String, required: true },
    actions: [{ type: String }], // Array of Action IDs
    giftName: String,
    giftId: String,
    likeThreshold: Number,
    command: String,
    message: String, // chat trigger: text the message must contain
    pointsCost: Number, // Premium points shop: points paid by the viewer to trigger it
    minCoins: Number,
    minLevel: Number, // level_up trigger: only from this level
    minTeamLevel: Number // TikTok team (fan club) level needed, 0 = everyone
}, { timestamps: true });

// Ensure uniqueness of id per token
// ids are unique within a scene (a scene imported or copied into another one keeps its ids)
EventSchema.index({ token: 1, sceneId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Event', EventSchema);
