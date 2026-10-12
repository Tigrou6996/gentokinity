const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

let giftList = new Map();

const extractUrl = (val) => {
    if (!val) return null;
    if (typeof val === 'string' && val.startsWith('http')) return val;
    if (val.url_list && val.url_list.length > 0) return val.url_list[0];
    if (val.image && typeof val.image === 'string') return val.image;
    if (val.url && typeof val.url === 'string') return val.url;
    return null;
};

const GIFT_SOURCES = [
    {
        name: 'Gentok',
        url: 'https://api.gentok.fr/tiktok/gift/fr-FR',
        map: (g) => ({
            id: g.id,
            name: g.name,
            diamond_count: g.diamond_count,
            url: extractUrl(g.url) || extractUrl(g.image) || extractUrl(g.gift_icon)
        })
    },
    {
        name: 'Tikfinity',
        url: 'https://tikfinity.zerody.one/api/getAllGifts?app_language=fr-FR&browser_language=fr-FR&priority_region=fr-FR&region=fr-FR&webcast_language=fr-FR&room_id=7479935945899576086',
        map: (g) => ({
            id: g.id,
            name: g.name,
            diamond_count: g.diamond_count,
            url: extractUrl(g.image) || extractUrl(g.url)
        })
    },
];

const DATA_DIR = path.join(__dirname, '../../data');
const CACHE_FILE = path.join(DATA_DIR, 'gift_cache.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { }
}

async function refreshGiftPrices() {
    let allGifts = [];
    logger.info(`🔍 Chargement des sources de cadeaux (${GIFT_SOURCES.length})...`);

    // Load local cache first
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const cachedParams = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
            if (Array.isArray(cachedParams)) {
                allGifts = cachedParams;
                logger.info(`📦 Cache local chargé: ${allGifts.length} cadeaux.`);
            }
        }
    } catch (e) {
        logger.warn(`⚠️ Erreur lecture cache cadeaux: ${e.message}`);
    }

    // Initialize map with cached data
    const uniqueGifts = new Map();
    allGifts.forEach(g => {
        if (g.id) uniqueGifts.set(g.id.toString(), g);
    });

    for (const source of GIFT_SOURCES) {
        let retries = 2;
        let success = false;
        while (retries > 0 && !success) {
            try {
                const response = await axios.get(source.url, { 
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
                    }
                });
                if (Array.isArray(response.data) || (response.data && Array.isArray(response.data.gifts))) {
                    const rawList = Array.isArray(response.data) ? response.data : response.data.gifts;
                    const normalized = rawList.map(source.map);

                    // Merge and update
                    normalized.forEach(newItem => {
                        // [FILTER] Skip invalid items (no name AND no URL)
                        if ((!newItem.name || newItem.name.trim() === '' || newItem.name.startsWith('Cadeau')) && !newItem.url) {
                            return;
                        }

                        const idStr = newItem.id.toString();
                        if (uniqueGifts.has(idStr)) {
                            const existing = uniqueGifts.get(idStr);
                            // Merge logic: keep existing if better, override if new has info
                            uniqueGifts.set(idStr, {
                                ...existing,
                                ...newItem,
                                name: (newItem.name && newItem.name !== 'Cadeau') ? newItem.name : existing.name,
                                diamond_count: (newItem.diamond_count > 0) ? newItem.diamond_count : existing.diamond_count,
                                url: newItem.url || existing.url
                            });
                        } else {
                            uniqueGifts.set(idStr, newItem);
                        }
                    });

                    logger.info(`✅ Source [${source.name}]: ${normalized.length} items (filtrés).`);
                    success = true;
                }
            } catch (err) {
                logger.error(`🚨 Erreur Source [${source.name}]: ${err.message}`);
                retries--;
                if (retries > 0) await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    if (uniqueGifts.size > 0) {
        giftList.clear();
        const finalArray = [];
        uniqueGifts.forEach((gift, idStr) => {
            giftList.set(idStr, gift);
            if (gift.name) giftList.set(gift.name.toLowerCase(), gift);
            finalArray.push(gift);
        });

        // Save to cache
        try {
            fs.writeFileSync(CACHE_FILE, JSON.stringify(finalArray, null, 2));
            logger.info(`💾 Cache cadeaux sauvegardé (${finalArray.length} items).`);
        } catch (e) {
            logger.error(`🚨 Erreur sauvegarde cache: ${e.message}`);
        }

        logger.info(`✅ Total combiné: ${uniqueGifts.size} cadeaux uniques chargés.`);

        // Sync images in background
        try {
            const { syncGiftImages } = require('./giftDownloader');
            syncGiftImages(Array.from(uniqueGifts.values())).catch(e => logger.error(`🚨 Erreur Sync Images: ${e.message}`));
        } catch (err) {
            logger.error(`🚨 Erreur chargement giftDownloader: ${err.message}`);
        }
    } else {
        logger.warn(`⚠️ Aucune source de cadeaux n'a pu être chargée.`);
    }
}

function getGiftPrice(data) {
    const gift = getGiftMetadata(data);
    return gift ? gift.diamond_count : (data.diamondCount || 0);
}

function getGiftMetadata(data) {
    if (!data) return null;

    // Try various ID fields
    const id = data.giftId || data.id || data.gift_id;
    if (id && giftList.has(id.toString())) {
        return giftList.get(id.toString());
    }

    // Try various Name fields
    const name = data.giftName || data.name || data.gift_name;
    if (name && giftList.has(name.toLowerCase())) {
        return giftList.get(name.toLowerCase());
    }

    return null;
}

function getGiftIcon(data) {
    if (!data) return 'https://tiktok.gentok.fr/img/tiktok/5655.png'; // Default Rose

    // [0] PRE-CHECK: If data already has a resolved string URL
    if (typeof data.giftIcon === 'string' && data.giftIcon.startsWith('http')) {
        return data.giftIcon;
    }

    // [PRIORITY] Check if local image exists in public/img/tiktok
    const giftId = data.giftId || data.id || data.gift_id;
    if (giftId) {
        const localPath = path.join(__dirname, '../../public/img/tiktok', `${giftId}.png`);
        if (fs.existsSync(localPath)) {
            return `https://tiktok.gentok.fr/img/tiktok/${giftId}.png`;
        }
    }

    const metadata = getGiftMetadata(data);

    // 1. [SECONDARY] API Metadata URL
    if (metadata) {
        if (metadata.url) return metadata.url;
    }

    // 2. [THIRD] Native URL
    const nativeUrl = (data.giftIcon && data.giftIcon.url_list && data.giftIcon.url_list[0])
        || (data.giftImage && data.giftImage.url_list && data.giftImage.url_list[0])
        || data.url
        || (data.image && data.image.url_list && data.image.url_list[0]);

    if (nativeUrl && nativeUrl.startsWith('http')) {
        return nativeUrl;
    }

    // 3. [FALLBACK] Return Default Rose Icon
    return 'https://tiktok.gentok.fr/img/tiktok/5655.png';
}

function getFullGiftList() {
    const unique = [];
    const seenIds = new Set();

    // 1. Add gifts from API
    for (const [key, val] of giftList.entries()) {
        if (/^\d+$/.test(key) && !seenIds.has(key)) {
            seenIds.add(key);
            unique.push({
                id: val.id,
                name: val.name,
                icon: `https://tiktok.gentok.fr/img/tiktok/${val.id}.png`, // Local VPS path
                url: val.url, // Original remote URL for fallback
                price: val.diamond_count
            });
        }
    }


    // Sort by price ascending as default (cheapest first)
    return unique.sort((a, b) => (a.price || 0) - (b.price || 0));
}

function resolveGiftName(data) {
    if (!data) return 'Cadeau';
    if (typeof data.giftName === 'string' && data.giftName.trim() !== '' && data.giftName !== 'undefined') {
        return data.giftName.trim();
    }
    if (typeof data.name === 'string' && data.name.trim() !== '' && data.name !== 'undefined') {
        return data.name.trim();
    }
    if (typeof data.gift_name === 'string' && data.gift_name.trim() !== '' && data.gift_name !== 'undefined') {
        return data.gift_name.trim();
    }
    if (data.giftDetails && typeof data.giftDetails.giftName === 'string' && data.giftDetails.giftName.trim() !== '' && data.giftDetails.giftName !== 'undefined') {
        return data.giftDetails.giftName.trim();
    }
    if (data.gift && typeof data.gift.name === 'string' && data.gift.name.trim() !== '' && data.gift.name !== 'undefined') {
        return data.gift.name.trim();
    }
    const id = data.giftId || data.id || data.gift_id;
    if (id && giftList.has(id.toString())) {
        const cached = giftList.get(id.toString());
        if (cached && cached.name) return cached.name;
    }
    return id ? `Cadeau #${id}` : 'Cadeau';
}

// Initial load
refreshGiftPrices();
// Refresh prices every hour
setInterval(refreshGiftPrices, 3600000);

module.exports = { getGiftPrice, getGiftMetadata, getGiftIcon, refreshGiftPrices, getFullGiftList, resolveGiftName };
