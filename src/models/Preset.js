const mongoose = require('mongoose');

const PresetSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    desc: { type: String, required: true },
    img: { type: String },
    badge: { type: String, default: 'free' },
    rules: { type: Number, default: 0 },
    overlays: { type: Number, default: 0 },
    type: { type: String, default: 'webhook' },
    creator: { type: String, default: 'Gentok' },
    // The actual payload to be installed
    content: {
        actions: [Object],
        events: [Object],
        sounds: [Object]
    }
}, { timestamps: true });

module.exports = mongoose.model('Preset', PresetSchema);
