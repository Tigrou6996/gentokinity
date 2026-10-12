const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const TIKTOK_IMG_DIR = path.join(__dirname, '../../public/img/tiktok');

// Ensure directory exists
if (!fs.existsSync(TIKTOK_IMG_DIR)) {
    fs.mkdirSync(TIKTOK_IMG_DIR, { recursive: true });
}

async function downloadGiftImage(url, giftId) {
    try {
        const filePath = path.join(TIKTOK_IMG_DIR, `${giftId}.png`);

        // Skip if already exists
        if (fs.existsSync(filePath)) return;

        logger.info(`💾 Téléchargement de l'image pour le cadeau ${giftId}...`);

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            }
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (err) {
        logger.error(`🚨 Erreur téléchargement image cadeau ${giftId}: ${err.message}`);
    }
}

async function syncGiftImages(gifts) {
    if (!Array.isArray(gifts)) return;

    logger.info(`🔄 Synchronisation des images de cadeaux (${gifts.length})...`);

    let downloaded = 0;
    for (const gift of gifts) {
        if (gift.id && gift.url) {
            const filePath = path.join(TIKTOK_IMG_DIR, `${gift.id}.png`);
            if (!fs.existsSync(filePath)) {
                await downloadGiftImage(gift.url, gift.id);
                downloaded++;
                // Slight delay to avoid hammering the server
                await new Promise(r => setTimeout(r, 100));
            }
        }
    }

    if (downloaded > 0) {
        logger.info(`✅ ${downloaded} nouvelles images de cadeaux téléchargées.`);
    } else {
        logger.info(`✅ Toutes les images de cadeaux sont déjà à jour.`);
    }
}

module.exports = { syncGiftImages, downloadGiftImage };
