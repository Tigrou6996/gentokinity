const mongoose = require('mongoose');
const logger = require('./logger');
const config = require('../config');

const connectDB = async () => {
    try {
        const uri = config.mongodbUri;
        if (!uri) {
            throw new Error('MONGODB_URI non définie dans config.js');
        }

        await mongoose.connect(uri, {
            dbName: 'gentok',
            serverSelectionTimeoutMS: 5000 // 5 seconds timeout
        });
        logger.info('🚀 Connecté à MongoDB');

        // [MIGRATION] Ensure all users have isPremium field
        const Settings = require('../models/Settings');
        const result = await Settings.updateMany(
            { isPremium: { $exists: false } },
            { $set: { isPremium: false } }
        );
        if (result.modifiedCount > 0) {
            logger.info(`✨ Migration Premium : ${result.modifiedCount} profils mis à jour.`);
        }
    } catch (err) {
        logger.error('❌ Erreur de connexion MongoDB:', err.message);
        if (config.isAppMode) {
            logger.warn('⚠️ Mode Application local : continuation en mode hors-ligne sans MongoDB cloud.');
        } else {
            process.exit(1);
        }
    }
};

module.exports = connectDB;
