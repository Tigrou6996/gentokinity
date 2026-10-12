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
    cooldown: Number,      // any action: minimum seconds between two executions
    userCooldown: Number,  // any action: minimum seconds between two executions for the same viewer
    delay: Number,         // any action: seconds to wait before running
    obsAction: String,     // obs: 'scene' | 'source_show' | 'source_hide' | 'source_toggle'
    obsScene: String,      // obs: scene name
    obsSource: String,     // obs: source name
    obsDuration: Number,   // obs: seconds before going back (0 = stay)
    segments: String,      // wheel: one segment per line, "Texte => Nom d'une action" to chain an action
    sbActionId: String,    // streamerbot: action id
    sbActionName: String,  // streamerbot: action name
    sbArgs: String         // streamerbot: extra arguments (JSON, placeholders allowed)
}, { timestamps: true });

// Ensure uniqueness of id per token
// ids are unique within a scene (a scene imported or copied into another one keeps its ids)
ActionSchema.index({ token: 1, sceneId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Action', ActionSchema);
