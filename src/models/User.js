const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // ObjectId from MongoDB
    token: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true }, // Hashed with bcrypt
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, {
    collection: 'users',
    _id: false // Use the _id from MongoDB directly
});

module.exports = mongoose.model('User', UserSchema);
