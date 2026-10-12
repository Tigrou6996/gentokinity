const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Sends a command to a Minecraft server via ServerTap API
 * (Previously RCON, now updated to use ServerTap for better compatibility)
 * @param {string} command The command to execute
 * @param {object} settings Optional settings (host, port, password)
 */
async function sendRconCommand(command, settings = null) {
    // If settings are not provided, try to get them from config
    // (fallback to config.minecraft which returns settings for the last active token)
    const mcSettings = settings || config.minecraft;

    if (!mcSettings || !mcSettings.host) {
        logger.error('🚨 Minecraft Error: Settings missing (host)');
        return;
    }

    if (!mcSettings.password) {
        logger.warn('⚠️ Minecraft Warning: No password/key provided.');
    }

    try {
        // ServerTap Port (default 4567)
        const port = mcSettings.port || 4567;
        const url = `http://${mcSettings.host}:${port}/v1/server/exec`;

        // ServerTap expects form-urlencoded body with 'command'
        const body = `command=${encodeURIComponent(command)}`;


        const response = await axios.post(url, body, {
            headers: {
                'key': mcSettings.password,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 5000
        });



        if (response.status === 200) {
            logger.info(`🎮 ServerTap: Command sent '${command}' to ${mcSettings.host}:${port}`);
            return response.data;
        } else {
            console.error(`[RCON ERROR] Unexpected Status: ${response.status}`);
            throw new Error(`ServerTap Status: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error(`[RCON EXCEPTION]`, error.message);
        if (error.response) {
            console.error(`[RCON EXCEPTION] Response Status:`, error.response.status);
            console.error(`[RCON EXCEPTION] Response Data:`, error.response.data);
        }
        logger.error(`🚨 Minecraft Action Error: ${error.message}`);
        // throw error; // Optional: suppress throw to prevent crashing the loop
    }
}

module.exports = { sendRconCommand };
