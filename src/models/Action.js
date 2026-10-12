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
    volume: Number,
    duration: Number, // keyboard: how long the key is held (ms)
    method: String,   // webhook: GET / POST
    data: mongoose.Schema.Types.Mixed, // webhook: payload
    text: String,          // alert / tts: text with {placeholders}
    mediaUrl: String,      // alert: image, GIF or video shown on the Alerts overlay
    alertDuration: Number, // alert: seconds on screen
    cooldown: Number       // any action: minimum seconds between two executions
}, { timestamps: true });

// Ensure uniqueness of id per token
ActionSchema.index({ token: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Action', ActionSchema);
