const mongoose = require('mongoose');

const ActionSchema = new mongoose.Schema({
    token: { type: String, required: true, index: true },
    sceneId: { type: String, default: null, index: true },
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    // Since actions have varying fields (url, key, command, etc.), we use a flexible object or specific fields
    url: String,
    key: String,
    command: String,
    soundName: String,
    soundUrl: String,
    volume: Number
}, { timestamps: true });

// Ensure uniqueness of id per token
ActionSchema.index({ token: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Action', ActionSchema);
