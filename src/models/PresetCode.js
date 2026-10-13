const mongoose = require('mongoose');

// A full scene shared with a code (GTK-XXXX-XXXX): its actions, events, settings and overlay options.
// Anyone with the code can load it; only its owner can update or delete it.
const PresetCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, index: true },
    ownerToken: { type: String, required: true, index: true }, // never sent to the browser
    title: { type: String, required: true },
    desc: { type: String, default: '' },
    creator: { type: String, default: '' },
    uses: { type: Number, default: 0 },
    content: {
        username: { type: String, default: '' }, // only when the creator chose to share it
        actions: [Object],
        events: [Object],
        settings: { type: Object, default: {} },       // tts, points rules, likes goal, top coins / likes display
        overlayOptions: { type: Object, default: {} }  // options chosen in the overlay gallery
    }
}, { timestamps: true });

module.exports = mongoose.model('PresetCode', PresetCodeSchema);
