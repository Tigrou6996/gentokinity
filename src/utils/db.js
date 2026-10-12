const mongoose = require('mongoose');
const logger = require('./logger');
const config = require('../config');

const connectDB = async () => {
    try {
        const uri = config.mongodbUri;
        if (!uri) {
            throw new Error('MONGODB_URI non définie (fichier .env ou src/build-env.json)');
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

        // [MIGRATION] Action / event ids used to be unique per account: importing or copying a scene into
        // another one failed (duplicate key) and lost the imported items. They are now unique per scene.
        for (const name of ['Action', 'Event']) {
            try {
                const Model = require(`../models/${name}`);
                const indexes = await Model.collection.indexes();
                if (indexes.some(i => i.name === 'token_1_id_1')) {
                    await Model.collection.dropIndex('token_1_id_1');
                    logger.info(`✨ Migration : index ${name} par scène.`);
                }
                await Model.syncIndexes();
            } catch (e) {
                logger.warn(`⚠️ Migration des index ${name} : ${e.message}`);
            }
        }
    } catch (err) {
        logger.error(`❌ Erreur de connexion MongoDB : ${err.message}`);
        if (config.isAppMode) {
            logger.warn('⚠️ Mode Application local : continuation en mode hors-ligne sans MongoDB cloud.');
        } else {
            process.exit(1);
        }
    }
};

module.exports = connectDB;
