/**
 * API routes for: plans (free / Premium), viewer points, team battles, the event simulator
 * and Streamer.bot.
 */
const config = require('../config');
const { getPlan, serializePlan, PLANS } = require('../features/plans');
const points = require('../features/points');
const battle = require('../features/battle');
const simulator = require('../features/simulator');
const coinmatch = require('../features/coinmatch');
const giveaway = require('../features/giveaway');
const pointsdrop = require('../features/pointsdrop');
const ViewerPoints = require('../models/ViewerPoints');
const PointTransaction = require('../models/PointTransaction');

const SORT_FIELDS = {
    points: 'points', level: 'levelPoints', levelPoints: 'levelPoints', coins: 'stats.coins', likes: 'stats.likes',
    firstActivity: 'firstActivity', lastActivity: 'lastActivity', nickname: 'nickname'
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = function registerProRoutes(app, { getRequestToken, getConnectorFor = () => null }) {
    const requireToken = (req, res) => {
        const token = getRequestToken(req);
        if (!token) res.status(401).json({ error: 'Token manquant' });
        return token;
    };
    const wrap = (fn) => async (req, res) => {
        try {
            await fn(req, res);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    };

    // ---------------- Plan ----------------
    app.get('/api/plan', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        const settings = await config.getSettings(token);
        const plan = getPlan(settings);
        const session = await config.getSessionFor(token);
        res.json({
            premium: plan.id === 'premium',
            plan: serializePlan(plan),
            plans: { free: serializePlan(PLANS.free), premium: serializePlan(PLANS.premium) },
            usage: {
                scenes: (settings.scenes || []).length,
                actions: (session.actions || []).length,
                events: (session.events || []).length,
                pointsUsers: await points.countUsers(token)
            },
            billing: settings.billing ? { plan: settings.billing.plan, currentPeriodEnd: settings.billing.currentPeriodEnd, status: settings.billing.status } : null
        });
    }));

    // ---------------- Points ----------------
    app.get('/api/points/settings', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        await config.getSessionFor(token); // the active scene decides whose points are shown (independent scene)
        res.json(points.getSettings(await config.getSettings(token)));
    }));

    app.get('/api/points/users', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        await config.getSessionFor(token); // the active scene decides whose points are shown (independent scene)
        await points.flushToken(token);
        const s = points.getSettings(await config.getSettings(token));
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const sortField = SORT_FIELDS[req.query.sort] || 'points';
        const order = req.query.order === 'asc' ? 1 : -1;
        const filter = { token: points.scopeOf(token) };
        if (req.query.search) {
            const re = new RegExp(escapeRegex(String(req.query.search).replace(/^@/, '').slice(0, 50)), 'i');
            filter.$or = [{ uniqueId: re }, { nickname: re }];
        }
        const [total, docs] = await Promise.all([
            ViewerPoints.countDocuments(filter),
            ViewerPoints.find(filter).sort({ [sortField]: order, _id: 1 }).skip((page - 1) * limit).limit(limit).lean()
        ]);
        const plan = getPlan(await config.getSettings(token));
        res.json({
            total,
            page,
            pages: Math.max(1, Math.ceil(total / limit)),
            maxUsers: plan.maxPointsUsers,
            totalUsers: req.query.search ? await points.countUsers(token) : total,
            users: docs.map(d => points.decorate(d, s, null))
        });
    }));

    // Spreadsheet export (Excel / Google Sheets). Cells starting with = + - @ are prefixed so they are never run as formulas.
    app.get('/api/points/export.csv', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        await config.getSessionFor(token); // the active scene decides whose points are shown (independent scene)
        await points.flushToken(token);
        const s = points.getSettings(await config.getSettings(token));
        const cell = (v) => {
            let str = v === undefined || v === null ? '' : String(v);
            if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
            return /[";\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        };
        const iso = (d) => (d ? new Date(d).toISOString() : '');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="gentok-points.csv"');
        res.write('\uFEFF' + ['uniqueId', 'nickname', 'points', 'levelPoints', 'level', 'coins', 'gifts', 'likes', 'chats', 'shares', 'follows', 'subs', 'watchMinutes', 'firstActivity', 'lastActivity'].join(';') + '\n');
        const cursor = ViewerPoints.find({ token: points.scopeOf(token) }).sort({ levelPoints: -1 }).lean().cursor();
        for await (const d of cursor) {
            const st = d.stats || {};
            res.write([d.uniqueId, d.nickname, Math.floor(d.points || 0), Math.floor(d.levelPoints || 0), points.levelFromPoints(d.levelPoints || 0, s.levelFactor),
                st.coins || 0, st.gifts || 0, st.likes || 0, st.chats || 0, st.shares || 0, st.follows || 0, st.subs || 0, st.watchMinutes || 0,
                iso(d.firstActivity), iso(d.lastActivity)].map(cell).join(';') + '\n');
        }
        res.end();
    }));

    app.get('/api/points/transactions', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        await config.getSessionFor(token); // the active scene decides whose points are shown (independent scene)
        await points.flushToken(token);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const filter = { token: points.scopeOf(token) };
        if (req.query.search) filter.uniqueId = new RegExp(escapeRegex(String(req.query.search).replace(/^@/, '').slice(0, 50)), 'i');
        const [total, items] = await Promise.all([
            PointTransaction.countDocuments(filter),
            PointTransaction.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).lean()
        ]);
        res.json({ total, page, pages: Math.max(1, Math.ceil(total / limit)), items });
    }));

    // Public for overlays (token in the URL, like every overlay)
    app.get('/api/points/top', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        await config.getSessionFor(token); // the active scene decides whose points are shown (independent scene)
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
        const sort = req.query.sort === 'level' ? 'levelPoints' : 'points';
        res.json(await points.getTop(token, limit, await config.getSettings(token), sort));
    }));

    app.post('/api/points/adjust', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        await config.getSessionFor(token); // the active scene decides whose points are shown (independent scene)
        const uniqueId = String(req.body.uniqueId || '').replace(/^@/, '').trim();
        const delta = Number(req.body.delta);
        if (!uniqueId || !Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: 'Paramètres invalides' });
        const doc = await points.adjust(token, uniqueId, delta, req.body.nickname);
        res.json({ success: true, points: Math.max(0, doc.points) });
    }));

    app.post('/api/points/reset', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        await config.getSessionFor(token); // the active scene decides whose points are shown (independent scene)
        const deleted = await points.reset(token);
        res.json({ success: true, deleted });
    }));

    // ---------------- Battles ----------------
    app.get('/api/battle/state', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        res.json(battle.getState(token));
    }));

    app.post('/api/battle/start', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        const plan = getPlan(await config.getSettings(token));
        const teams = Array.isArray(req.body.teams) ? req.body.teams : [];
        if (teams.length > plan.maxBattleTeams) {
            return res.status(403).json({ error: 'PREMIUM_ONLY', message: `Votre offre permet ${plan.maxBattleTeams} équipes maximum.` });
        }
        res.json(battle.start(token, req.body, plan.maxBattleTeams));
    }));

    app.post('/api/battle/stop', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        res.json(battle.stop(token) || { running: false });
    }));

    // ---------------- Simulator ----------------
    app.post('/api/simulate', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        const { type, ...opts } = req.body || {};
        delete opts.token;
        res.json(simulator.simulate(token, String(type || ''), opts));
    }));

    // ---------------- Coin Match (gift auction) ----------------
    app.get('/api/coinmatch/state', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        res.json(coinmatch.getState(token));
    }));
    app.post('/api/coinmatch/:command', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        const body = req.body || {};
        switch (req.params.command) {
            case 'start':
                if (!getPlan(await config.getSettings(token)).proWidgets) {
                    return res.status(403).json({ error: 'PREMIUM_ONLY', message: 'Coin Match est réservé à Gentok Premium.' });
                }
                return res.json(coinmatch.start(token, { title: body.title, duration: body.duration, winners: body.winners }));
            case 'stop': return res.json(coinmatch.stop(token));
            case 'reset': return res.json(coinmatch.reset(token));
            case 'winners': return res.json(coinmatch.showWinners(token));
            default: return res.status(404).json({ error: 'Commande inconnue' });
        }
    }));

    // ---------------- Giveaway (prize draw) ----------------
    app.get('/api/giveaway/state', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        res.json(giveaway.getState(token));
    }));
    app.post('/api/giveaway/:command', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        const b = req.body || {};
        switch (req.params.command) {
            case 'start': return res.json(giveaway.start(token, {
                title: b.title, prize: b.prize, keyword: b.keyword, duration: b.duration,
                followersOnly: b.followersOnly, subscribersOnly: b.subscribersOnly, coinsPerTicket: b.coinsPerTicket
            }));
            case 'close': return res.json(giveaway.close(token));
            case 'draw': return res.json(giveaway.draw(token, parseInt(b.count, 10) || 1));
            case 'reset': return res.json(giveaway.reset(token));
            default: return res.status(404).json({ error: 'Commande inconnue' });
        }
    }));

    // ---------------- Points Drop ----------------
    app.get('/api/pointsdrop/state', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        res.json(pointsdrop.getState(token));
    }));
    app.post('/api/pointsdrop/:command', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        const b = req.body || {};
        if (req.params.command === 'start') return res.json(pointsdrop.start(token, { amount: b.amount, keyword: b.keyword, duration: b.duration, maxCatchers: b.maxCatchers }));
        if (req.params.command === 'stop') return res.json(pointsdrop.stop(token));
        res.status(404).json({ error: 'Commande inconnue' });
    }));

    // ---------------- Dashboard buttons for an overlay ----------------
    const OVERLAY_COMMANDS = ['jar_reset'];
    app.post('/api/overlay/command', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        const command = String((req.body || {}).command || '');
        if (!OVERLAY_COMMANDS.includes(command)) return res.status(400).json({ error: 'Commande inconnue' });
        const { emitEvent } = require('../utils/socket');
        emitEvent('overlay_command', { command }, token);
        res.json({ success: true });
    }));

    // "Test" of the Roue de la fortune overlay: spins the first wheel of the scene (or a demo wheel),
    // only on the overlay — the actions linked to the segments are not run
    app.post('/api/wheel/test', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        const settings = await config.getSettings(token);
        const wheel = (settings.actions || []).find(a => a.type === 'wheel' && a.segments);
        let segments = wheel ? String(wheel.segments).split(/\r?\n/).map(l => l.split('=>')[0].trim().slice(0, 40)).filter(Boolean).slice(0, 24) : [];
        if (segments.length < 2) segments = ['10 pompes', 'Danse', 'Rien 😅', 'Chanson', 'Gage', 'x2 points'];
        const crypto = require('crypto');
        const { emitEvent } = require('../utils/socket');
        emitEvent('wheel_spin', {
            id: `test_${Date.now()}`, title: (wheel && wheel.name) || 'Test', segments,
            winnerIndex: crypto.randomInt(segments.length), spinMs: 6000, nickname: 'Gentok Test', profilePictureUrl: ''
        }, token);
        res.json({ success: true });
    }));

    // ---------------- Chat bot (TikTok account answering !score / !top) ----------------
    const chatbot = require('../features/chatbot');
    const Settings = require('../models/Settings');
    app.get('/api/chatbot', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        res.json(chatbot.publicSettings(await config.getSettings(token)));
    }));

    app.post('/api/chatbot', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        const b = req.body || {};
        const current = chatbot.getSettings(await config.getSettings(token));
        const next = {
            enabled: !!b.enabled,
            sessionId: current.sessionId || '',
            ttTargetIdc: current.ttTargetIdc || '',
            scoreTemplate: String(b.scoreTemplate || chatbot.DEFAULTS.scoreTemplate).slice(0, 200),
            topTemplate: String(b.topTemplate || chatbot.DEFAULTS.topTemplate).slice(0, 200),
            minInterval: Math.min(Math.max(Number(b.minInterval) || chatbot.DEFAULTS.minInterval, 2), 60)
        };
        // Session cookies of the bot account: only replaced when given, removed with "disconnect"
        const clean = (v) => String(v || '').trim().replace(/^(sessionid|tt-target-idc)=/i, '').replace(/;.*$/, '');
        if (b.sessionId) next.sessionId = clean(b.sessionId).slice(0, 200);
        if (b.ttTargetIdc) next.ttTargetIdc = clean(b.ttTargetIdc).slice(0, 60);
        if (b.disconnect) { next.sessionId = ''; next.ttTargetIdc = ''; next.enabled = false; }
        if (next.sessionId && !/^[\w-]{8,}$/.test(next.sessionId)) return res.status(400).json({ error: 'Cookie sessionid invalide' });
        if (next.ttTargetIdc && !/^[\w-]{2,}$/.test(next.ttTargetIdc)) return res.status(400).json({ error: 'Cookie tt-target-idc invalide' });
        if (next.enabled && !(next.sessionId && next.ttTargetIdc)) return res.status(400).json({ error: 'Ajoutez d\'abord les cookies du compte bot' });
        await Settings.updateOne({ token }, { $set: { chatbot: next } }, { upsert: true });
        await config.invalidate(token);
        chatbot.forget(token);
        res.json(chatbot.publicSettings({ chatbot: next }));
    }));

    // Sends a test message in the running live
    app.post('/api/chatbot/test', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        const settings = await config.getSettings(token);
        const c = chatbot.getSettings(settings);
        if (!(c.sessionId && c.ttTargetIdc)) return res.status(400).json({ error: 'Compte bot non connecté' });
        const connector = getConnectorFor(token);
        if (!connector || !connector.connection) return res.status(409).json({ error: 'Lancez le live d\'abord : le message est envoyé dans votre live en cours.' });
        const ok = await chatbot.say(connector, { ...settings, chatbot: { ...c, enabled: true } }, String((req.body || {}).text || '👋 Gentok est connecté !').slice(0, 150));
        res.json({ success: ok });
    }));

    // ---------------- Streamer.bot ----------------
    app.post('/api/streamerbot/test', wrap(async (req, res) => {
        const { host, port } = req.body || {};
        try {
            const { testStreamerbot } = require('../actions/streamerbotAction');
            const actions = await testStreamerbot({ host, port });
            res.json({ success: true, actions });
        } catch (err) {
            res.status(500).json({ success: false, message: err.code === 'ECONNREFUSED' ? 'Streamer.bot ne répond pas (serveur HTTP activé ?)' : err.message });
        }
    }));
};
