const mongoose = require('mongoose');

const SoundSchema = new mongoose.Schema({
    token: { type: String, required: true, index: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('Sound', SoundSchema);
