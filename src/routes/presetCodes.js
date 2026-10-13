/**
 * Full presets shared with a code.
 * - POST /api/preset-codes             : snapshot of the active scene -> new code (GTK-XXXX-XXXX)
 * - GET  /api/preset-codes/mine        : the codes of this account
 * - GET  /api/preset-codes/:code       : what a code contains (title, counts), to preview it before loading
 * - POST /api/preset-codes/:code/load  : loads it in a new scene, or replaces / completes the active scene
 * - POST /api/preset-codes/:code/update: (owner) replaces its content by the active scene
 * - DELETE /api/preset-codes/:code     : (owner) deletes it
 */
const crypto = require('crypto');
const config = require('../config');
const PresetCode = require('../models/PresetCode');
const { getPlan } = require('../features/plans');

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O, 1/I/L
const MAX_CODES = { free: 3, premium: 50 };
const clone = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));

function newCode() {
    let s = '';
    for (let i = 0; i < 8; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
    return `GTK-${s.slice(0, 4)}-${s.slice(4)}`;
}

// "gtk 7f3k92qd", "GTK-7F3K-92QD", "7F3K92QD" -> "GTK-7F3K-92QD"
function normalizeCode(raw) {
    const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^GTK/, '');
    return /^[A-Z0-9]{8}$/.test(s) ? `GTK-${s.slice(0, 4)}-${s.slice(4)}` : null;
}

// Actions / events without the owner's account data
function cleanItems(list) {
    return (Array.isArray(list) ? list : []).map(item => {
        const o = item && item.toObject ? item.toObject() : { ...(item || {}) };
        delete o.token; delete o._id; delete o.__v; delete o.sceneId; delete o.createdAt; delete o.updatedAt;
        return o;
    });
}

// What a preset keeps of the scene settings (never: chat bot cookies, Spotify / OBS / Minecraft logins, viewers' records)
function snapshotSettings(session) {
    const likesGoal = { ...(session.likesGoal || {}) };
    delete likesGoal.count;
    return clone({
        tts: session.tts || null,
        points: session.points || null,
        likesGoal,
        topCoins: session.topCoins || null,
        topLikes: session.topLikes || null
    });
}

function cleanOverlayOptions(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const json = JSON.stringify(raw);
    return json.length <= 50000 ? JSON.parse(json) : {};
}

function publicView(doc, withOwner = false) {
    const c = doc.content || {};
    const v = {
        code: doc.code, title: doc.title, desc: doc.desc || '', creator: doc.creator || '', uses: doc.uses || 0,
        updatedAt: doc.updatedAt,
        counts: {
            actions: (c.actions || []).length,
            events: (c.events || []).length,
            settings: Object.keys(c.settings || {}).filter(k => c.settings[k]).length,
            overlays: Object.keys(c.overlayOptions || {}).length
        }
    };
    if (withOwner) v.mine = true;
    return v;
}

module.exports = function registerPresetCodeRoutes(app, { getRequestToken, withSceneLock, afterSessionChange }) {
    const wrap = (fn) => (req, res) => fn(req, res).catch(err => {
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Erreur serveur : ' + err.message });
    });
    const fail = (status, message) => Object.assign(new Error(message), { status });
    const tokenOf = (req) => {
        const token = getRequestToken(req);
        if (!token) throw fail(401, 'Token manquant');
        return token;
    };

    app.post('/api/preset-codes', wrap(async (req, res) => {
        const token = tokenOf(req);
        const b = req.body || {};
        const title = String(b.title || '').trim().slice(0, 60);
        if (!title) throw fail(400, 'Donnez un nom à votre preset');
        await config.loadSession(token);
        const session = await config.getSessionFor(token);
        if (!session.activeSceneId) throw fail(400, 'Ouvrez d\'abord la scène à partager');
        const plan = getPlan(await config.getSettings(token));
        const max = plan.id === 'premium' ? MAX_CODES.premium : MAX_CODES.free;
        if (await PresetCode.countDocuments({ ownerToken: token }) >= max) {
            throw fail(403, `Limite atteinte : ${max} codes${plan.id === 'premium' ? '' : ' en gratuit (50 avec Premium)'}. Supprimez-en un ou mettez-en un à jour.`);
        }
        let code = newCode();
        for (let i = 0; i < 5 && await PresetCode.exists({ code }); i++) code = newCode();
        const doc = await PresetCode.create({
            code, ownerToken: token, title,
            desc: String(b.desc || '').slice(0, 300),
            creator: String(session.username || '').replace(/^@/, '').slice(0, 40),
            content: {
                actions: cleanItems(session.actions),
                events: cleanItems(session.events),
                settings: b.includeSettings === false ? {} : snapshotSettings(session),
                overlayOptions: cleanOverlayOptions(b.overlayOptions)
            }
        });
        res.json({ success: true, preset: publicView(doc, true) });
    }));

    app.get('/api/preset-codes/mine', wrap(async (req, res) => {
        const token = tokenOf(req);
        const docs = await PresetCode.find({ ownerToken: token }).sort({ updatedAt: -1 }).lean();
        res.json(docs.map(d => publicView(d, true)));
    }));

    app.get('/api/preset-codes/:code', wrap(async (req, res) => {
        const code = normalizeCode(req.params.code);
        if (!code) throw fail(400, 'Code invalide (format GTK-XXXX-XXXX)');
        const doc = await PresetCode.findOne({ code }).lean();
        if (!doc) throw fail(404, 'Aucun preset avec ce code');
        const token = getRequestToken(req);
        res.json(publicView(doc, !!token && doc.ownerToken === token));
    }));

    app.post('/api/preset-codes/:code/update', wrap(async (req, res) => {
        const token = tokenOf(req);
        const code = normalizeCode(req.params.code);
        const doc = code && await PresetCode.findOne({ code });
        if (!doc || doc.ownerToken !== token) throw fail(404, 'Code introuvable dans vos presets');
        await config.loadSession(token);
        const session = await config.getSessionFor(token);
        const b = req.body || {};
        doc.content = {
            actions: cleanItems(session.actions),
            events: cleanItems(session.events),
            settings: b.includeSettings === false ? {} : snapshotSettings(session),
            overlayOptions: cleanOverlayOptions(b.overlayOptions)
        };
        if (b.title) doc.title = String(b.title).trim().slice(0, 60) || doc.title;
        if (b.desc !== undefined) doc.desc = String(b.desc || '').slice(0, 300);
        await doc.save();
        res.json({ success: true, preset: publicView(doc, true) });
    }));

    app.delete('/api/preset-codes/:code', wrap(async (req, res) => {
        const token = tokenOf(req);
        const code = normalizeCode(req.params.code);
        const r = code ? await PresetCode.deleteOne({ code, ownerToken: token }) : { deletedCount: 0 };
        if (!r.deletedCount) throw fail(404, 'Code introuvable dans vos presets');
        res.json({ success: true });
    }));

    /**
     * mode: "new" (default) = new scene named after the preset; "replace" = the active scene's actions and events
     * are replaced; "add" = added to them. applyPoints: also apply the points rules / currency (shared by the scenes).
     */
    app.post('/api/preset-codes/:code/load', wrap(async (req, res) => {
        const token = tokenOf(req);
        const code = normalizeCode(req.params.code);
        if (!code) throw fail(400, 'Code invalide (format GTK-XXXX-XXXX)');
        const doc = await PresetCode.findOne({ code }).lean();
        if (!doc) throw fail(404, 'Aucun preset avec ce code');
        const b = req.body || {};
        const mode = ['replace', 'add'].includes(b.mode) ? b.mode : 'new';

        const result = await withSceneLock(token, async () => {
            await config.loadSession(token);
            let session = await config.getSessionFor(token);
            if (mode === 'new') {
                const plan = getPlan(await config.getSettings(token));
                if ((session.scenes || []).length >= plan.maxScenes) {
                    throw fail(403, `Limite de ${plan.maxScenes} scènes atteinte : supprimez une scène, ou chargez le preset dans la scène actuelle.`);
                }
                const id = `scene_${Date.now()}_${crypto.randomInt(1e6)}`;
                const scenes = (session.scenes || []).map(sc => ({ id: sc.id, title: sc.title }));
                await config.saveSettings({ token, scenes: [...scenes, { id, title: String(b.title || doc.title).slice(0, 60) }] });
                await config.saveSettings({ token, activeSceneId: id });
                await config.loadSession(token);
                session = await config.getSessionFor(token);
            } else if (!session.activeSceneId) {
                throw fail(400, 'Aucune scène active');
            }

            // New ids for the actions, and the events pointing to them
            const stamp = Date.now();
            const idMap = {};
            const actions = cleanItems(doc.content.actions).map((a, i) => {
                const id = `acc_${stamp}_${i}_${crypto.randomInt(1e6)}`;
                if (a.id) idMap[a.id] = id;
                return { ...a, id };
            });
            const events = cleanItems(doc.content.events).map((e, i) => ({
                ...e,
                id: `evt_${stamp}_${i}_${crypto.randomInt(1e6)}`,
                actions: (Array.isArray(e.actions) ? e.actions : (e.actions ? [e.actions] : [])).map(old => idMap[old]).filter(Boolean)
            }));
            const keep = mode === 'add';
            await config.saveActions([...(keep ? session.actions || [] : []), ...actions], token);
            await config.saveEvents([...(keep ? session.events || [] : []), ...events], token);

            // Scene settings (TTS, likes goal, top display); points rules only when asked (they are shared by the scenes)
            const st = doc.content.settings || {};
            const patch = { token };
            if (st.tts) patch.tts = st.tts;
            if (st.likesGoal) patch.likesGoal = { ...st.likesGoal, count: (session.likesGoal || {}).count || 0 };
            if (st.topCoins) patch.topCoins = st.topCoins;
            if (st.topLikes) patch.topLikes = st.topLikes;
            if (st.points && b.applyPoints) patch.points = st.points;
            if (Object.keys(patch).length > 1) await config.saveSettings(patch);
            await config.loadSession(token);
            session = await config.getSessionFor(token);
            return { actions: actions.length, events: events.length, activeSceneId: session.activeSceneId };
        });

        await PresetCode.updateOne({ code }, { $inc: { uses: 1 } });
        await afterSessionChange(token);
        res.json({
            success: true, mode, ...result,
            overlayOptions: doc.content.overlayOptions || {},
            installed: { actions: result.actions, events: result.events }
        });
    }));
};

module.exports.normalizeCode = normalizeCode;
