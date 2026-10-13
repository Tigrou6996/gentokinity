/**
 * OBS Studio control through obs-websocket v5 (built into OBS 28+).
 * OBS: Outils > Paramètres du serveur WebSocket > Activer (port 4455 par défaut).
 */
const crypto = require('crypto');
const WebSocket = require('ws');
const logger = require('../utils/logger');

const connections = new Map(); // "host:port:password" -> { ws, ready, pending }
const REQUEST_TIMEOUT_MS = 5000;

function authString(password, salt, challenge) {
    const secret = crypto.createHash('sha256').update(password + salt).digest('base64');
    return crypto.createHash('sha256').update(secret + challenge).digest('base64');
}

function getConnection(settings) {
    const host = settings.host || '127.0.0.1';
    const port = parseInt(settings.port, 10) || 4455;
    const password = settings.password || '';
    const key = `${host}:${port}:${password}`;

    const existing = connections.get(key);
    if (existing && existing.ws.readyState === WebSocket.OPEN && existing.identified) return existing.ready;
    if (existing && existing.ws.readyState === WebSocket.CONNECTING) return existing.ready;

    const conn = { ws: null, identified: false, pending: new Map(), ready: null };
    conn.ready = new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://${host}:${port}`, { handshakeTimeout: REQUEST_TIMEOUT_MS });
        conn.ws = ws;
        const fail = (err) => {
            connections.delete(key);
            reject(err instanceof Error ? err : new Error(String(err)));
        };
        const timer = setTimeout(() => { fail(new Error('OBS ne répond pas (WebSocket activé ?)')); try { ws.terminate(); } catch (e) { } }, REQUEST_TIMEOUT_MS);

        ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
            if (msg.op === 0) { // Hello
                const identify = { rpcVersion: 1 };
                const auth = msg.d && msg.d.authentication;
                if (auth) {
                    if (!password) { clearTimeout(timer); fail(new Error('OBS demande un mot de passe')); ws.close(); return; }
                    identify.authentication = authString(password, auth.salt, auth.challenge);
                }
                ws.send(JSON.stringify({ op: 1, d: identify }));
            } else if (msg.op === 2) { // Identified
                clearTimeout(timer);
                conn.identified = true;
                resolve(conn);
            } else if (msg.op === 7) { // RequestResponse
                const p = conn.pending.get(msg.d.requestId);
                if (!p) return;
                conn.pending.delete(msg.d.requestId);
                const status = msg.d.requestStatus || {};
                if (status.result) p.resolve(msg.d.responseData || {});
                else p.reject(new Error(status.comment || `Erreur OBS (code ${status.code})`));
            }
        });
        ws.on('error', (err) => { clearTimeout(timer); fail(err); });
        ws.on('close', (code) => {
            clearTimeout(timer);
            connections.delete(key);
            for (const p of conn.pending.values()) p.reject(new Error('Connexion OBS fermée'));
            conn.pending.clear();
            if (!conn.identified) fail(new Error(code === 4009 ? 'Mot de passe OBS incorrect' : 'Connexion OBS refusée'));
        });
    });
    connections.set(key, conn);
    return conn.ready;
}

async function request(settings, requestType, requestData = {}) {
    const conn = await getConnection(settings);
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { conn.pending.delete(requestId); reject(new Error(`OBS: délai dépassé (${requestType})`)); }, REQUEST_TIMEOUT_MS);
        conn.pending.set(requestId, {
            resolve: (d) => { clearTimeout(timer); resolve(d); },
            reject: (e) => { clearTimeout(timer); reject(e); }
        });
        conn.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    });
}

async function setSourceVisible(settings, sceneName, sourceName, visible) {
    if (!sceneName) {
        const current = await request(settings, 'GetCurrentProgramScene');
        sceneName = current.currentProgramSceneName || current.sceneName;
    }
    const { sceneItemId } = await request(settings, 'GetSceneItemId', { sceneName, sourceName });
    if (visible === 'toggle') {
        const { sceneItemEnabled } = await request(settings, 'GetSceneItemEnabled', { sceneName, sceneItemId });
        visible = !sceneItemEnabled;
    }
    await request(settings, 'SetSceneItemEnabled', { sceneName, sceneItemId, sceneItemEnabled: !!visible });
    return { sceneName, sceneItemId, visible: !!visible };
}

/**
 * Runs an "OBS" action.
 * @param {object} action { obsAction, obsScene, obsSource, obsDuration }
 * @param {object} settings OBS connection settings { host, port, password }
 */
async function runObsAction(action, settings = {}) {
    const type = action.obsAction || 'scene';
    const duration = Math.min(Math.max(Number(action.obsDuration) || 0, 0), 3600);

    if (type === 'scene') {
        if (!action.obsScene) throw new Error('Nom de scène OBS manquant');
        let previous = null;
        if (duration > 0) {
            const current = await request(settings, 'GetCurrentProgramScene');
            previous = current.currentProgramSceneName || current.sceneName;
        }
        await request(settings, 'SetCurrentProgramScene', { sceneName: action.obsScene });
        logger.info(`🎬 OBS : scène « ${action.obsScene} »`);
        if (previous && previous !== action.obsScene) {
            setTimeout(() => {
                request(settings, 'SetCurrentProgramScene', { sceneName: previous })
                    .catch(e => logger.warn(`OBS : retour à la scène précédente impossible (${e.message})`));
            }, duration * 1000);
        }
        return;
    }

    if (!action.obsSource) throw new Error('Nom de source OBS manquant');
    const visible = type === 'source_hide' ? false : (type === 'source_toggle' ? 'toggle' : true);
    const result = await setSourceVisible(settings, action.obsScene, action.obsSource, visible);
    logger.info(`🎬 OBS : source « ${action.obsSource} » ${result.visible ? 'affichée' : 'masquée'}`);
    if (duration > 0) {
        setTimeout(() => {
            request(settings, 'SetSceneItemEnabled', { sceneName: result.sceneName, sceneItemId: result.sceneItemId, sceneItemEnabled: !result.visible })
                .catch(e => logger.warn(`OBS : remise en état impossible (${e.message})`));
        }, duration * 1000);
    }
}

/** Connection test used by the dashboard: returns the list of scenes */
async function testObs(settings = {}) {
    const { version } = await request(settings, 'GetVersion').then(v => ({ version: v.obsVersion })).catch(() => ({ version: null }));
    const scenes = await request(settings, 'GetSceneList');
    return { version, scenes: (scenes.scenes || []).map(s => s.sceneName).reverse() };
}

module.exports = { runObsAction, testObs };
