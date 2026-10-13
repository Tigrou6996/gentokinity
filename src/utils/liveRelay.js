/**
 * Live relay between the secure desktop app and the Gentok server.
 *
 * App side (config.relayMode): the app connects to the TikTok live from the streamer's PC (their IP) and
 * forwards the raw live events to the server; it never touches the database and holds no secret.
 * Server side: a RelayedConnector (connector.js) receives them and runs the normal processing (points,
 * rankings, actions, overlays, history). The PC actions come back to the app as before (remote_keyboard,
 * remote_rcon, remote_obs...).
 */
const logger = require('./logger');

// Live events processed by handlers/eventManager.js
const LIVE_EVENTS = ['chat', 'gift', 'follow', 'share', 'like', 'member', 'subscribe', 'roomUser', 'emote', 'questionNew'];

// Plain JSON for the socket (TikTok objects can carry BigInt / binary fields)
function toPlain(data) {
    try {
        return JSON.parse(JSON.stringify(data, (k, v) => {
            if (typeof v === 'bigint') return v.toString();
            if (v && (v.type === 'Buffer' || v instanceof Uint8Array)) return undefined;
            return v;
        }));
    } catch (e) {
        return null;
    }
}

// What the server needs to know about the room (the full room info is large)
function roomSummary(connection) {
    const r = connection && connection.roomInfo;
    if (!r || typeof r !== 'object') return null;
    const pick = {};
    for (const k of ['likeCount', 'totalLikeCount', 'like_count', 'total_like_count', 'title']) if (r[k] !== undefined) pick[k] = r[k];
    if (r.stats && r.stats.likeCount !== undefined) pick.stats = { likeCount: r.stats.likeCount };
    return toPlain(pick);
}

/** App side: called for every TikTok connection of a connector in relay mode (instead of registerEvents) */
function attachAppRelay(connection, connector) {
    const { emitRemote } = require('./remoteClient');
    const announce = () => emitRemote('live_relay_start', {
        username: connector.username,
        roomId: connection.roomId || null,
        roomInfo: roomSummary(connection),
        startedAt: connector.startTime || Date.now()
    });
    connector.announceRelay = announce;

    connection.on('connected', () => {
        connector.hasConnected = true;
        logger.info(`✅ Connecté au live (relais vers le serveur Gentok) : ${connection.roomId}`);
        announce();
    });
    for (const event of LIVE_EVENTS) {
        connection.on(event, (data) => {
            const plain = toPlain(data);
            if (plain) emitRemote('live_relay_event', { event, data: plain });
        });
    }
    connection.on('disconnected', (info) => {
        if (connector.connection !== connection) return; // replaced by a reconnection
        logger.warn('❌ Déconnecté de TikTok Live.');
        if (!connector.isStopping) connector.handleDisconnect(info && info.reason ? String(info.reason) : '');
    });
    connection.on('streamEnd', () => {
        logger.warn('⏹️ Le stream est terminé.');
        connector.streamEnded = true;
        connector.stop();
    });
    connection.on('error', (err) => logger.error(`🚨 Error: ${err && err.message ? err.message : JSON.stringify(err)}`));
}

module.exports = { LIVE_EVENTS, attachAppRelay, toPlain };
