/**
 * Streamer.bot control through its HTTP server
 * (Streamer.bot: Servers/Clients > HTTP Server > Auto Start, port 7474 by default).
 */
const axios = require('axios');
const logger = require('../utils/logger');

function baseUrl(settings = {}) {
    const host = settings.host || '127.0.0.1';
    const port = parseInt(settings.port, 10) || 7474;
    return `http://${host}:${port}`;
}

/**
 * @param {object} payload { action: { id?, name? }, args: {...} }
 */
async function runStreamerbotAction(payload, settings = {}) {
    if (!payload || !payload.action || (!payload.action.id && !payload.action.name)) {
        throw new Error('Action Streamer.bot non renseignée');
    }
    await axios.post(`${baseUrl(settings)}/DoAction`, payload, { timeout: 5000, proxy: false });
    logger.info(`🤖 Streamer.bot : action « ${payload.action.name || payload.action.id} » lancée`);
}

/** Connection test used by the dashboard: returns the list of Streamer.bot actions */
async function testStreamerbot(settings = {}) {
    const res = await axios.get(`${baseUrl(settings)}/GetActions`, { timeout: 5000, proxy: false });
    const actions = (res.data && res.data.actions) || [];
    return actions.map(a => ({ id: a.id, name: a.name, group: a.group || '', enabled: a.enabled !== false }));
}

module.exports = { runStreamerbotAction, testStreamerbot };
