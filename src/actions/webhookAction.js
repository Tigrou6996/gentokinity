const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Sends a webhook request
 * @param {object} options Webhook options (url, method, data)
 */
async function sendWebhook(options) {
    const { url, method = 'POST', data = {} } = options;

    try {
        const response = await axios({
            method: method.toUpperCase(),
            url,
            data: method.toUpperCase() === 'POST' ? data : null,
            params: method.toUpperCase() === 'GET' ? data : null,
            timeout: 5000
        });

        logger.info(`🌐 Webhook Action: Sent ${method} to ${url} (Status: ${response.status})`);
    } catch (error) {
        logger.error(`🚨 Webhook Action Error: ${error.message}`);
    }
}

module.exports = { sendWebhook };
