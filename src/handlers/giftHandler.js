const logger = require('../utils/logger');
const actionManager = require('../actions/actionManager');
const { translateGift } = require('../utils/giftTranslator');
const { resolveGiftName } = require('../utils/giftPrices');

/**
 * Handle gift events from TikTok
 * @param {object} data Gift data from tiktok-live-connector
 */
const giftBuffer = new Map(); // token_uniqueId_giftId -> { timeout, data }
const executedStreaks = new Map(); // token_uniqueId_giftId -> timestamp of execution

/**
 * Handle gift events from TikTok
 * @param {object} data Gift data from tiktok-live-connector
 * @param {object} connector Instance of the connector
 */
function handleGift(data, connector) {
    if (!connector || !connector.token) return;
    const token = connector.token;
    data.giftName = resolveGiftName(data);
    const { uniqueId, giftName, giftId, repeatEnd } = data;

    const bufferKey = `${token}_${uniqueId}_${giftId}`;
    const now = Date.now();

    // 1. If this gift streak was already executed within the last 4 seconds, ignore duplicate repeatEnd packet!
    if (repeatEnd && executedStreaks.has(bufferKey)) {
        const lastExec = executedStreaks.get(bufferKey);
        if (now - lastExec < 4000) {
            executedStreaks.delete(bufferKey);
            return;
        }
    }

    const executeNow = (finalData) => {
        executedStreaks.set(bufferKey, Date.now());
        setTimeout(() => executedStreaks.delete(bufferKey), 5000);

        actionManager.executeAction(`gift:${giftName}`, finalData, connector);
        actionManager.executeAction('gift_min', finalData, connector);
    };

    // 2. If native end of streak from TikTok
    if (repeatEnd) {
        if (giftBuffer.has(bufferKey)) {
            clearTimeout(giftBuffer.get(bufferKey).timeout);
            giftBuffer.delete(bufferKey);
        }
        executeNow(data);
        return;
    }

    // 3. Buffer active streak with a 1200ms combo window (standard TikTok combo timeout)
    if (giftBuffer.has(bufferKey)) {
        clearTimeout(giftBuffer.get(bufferKey).timeout);
    }

    const timeout = setTimeout(() => {
        const buffered = giftBuffer.get(bufferKey);
        const finalData = buffered ? { ...buffered.data, repeatEnd: true } : { ...data, repeatEnd: true };
        giftBuffer.delete(bufferKey);
        executeNow(finalData);
    }, 1200);

    giftBuffer.set(bufferKey, { timeout, data });
}

module.exports = { handleGift };
