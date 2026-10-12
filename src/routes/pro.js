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
const ViewerPoints = require('../models/ViewerPoints');
const PointTransaction = require('../models/PointTransaction');

const SORT_FIELDS = {
    points: 'points', level: 'levelPoints', levelPoints: 'levelPoints', coins: 'stats.coins', likes: 'stats.likes',
    firstActivity: 'firstActivity', lastActivity: 'lastActivity', nickname: 'nickname'
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = function registerProRoutes(app, { getRequestToken }) {
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
        res.json(points.getSettings(await config.getSettings(token)));
    }));

    app.get('/api/points/users', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        await points.flushToken(token);
        const s = points.getSettings(await config.getSettings(token));
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const sortField = SORT_FIELDS[req.query.sort] || 'points';
        const order = req.query.order === 'asc' ? 1 : -1;
        const filter = { token };
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
        const cursor = ViewerPoints.find({ token }).sort({ levelPoints: -1 }).lean().cursor();
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
        await points.flushToken(token);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const filter = { token };
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
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
        const sort = req.query.sort === 'level' ? 'levelPoints' : 'points';
        res.json(await points.getTop(token, limit, await config.getSettings(token), sort));
    }));

    app.post('/api/points/adjust', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
        const uniqueId = String(req.body.uniqueId || '').replace(/^@/, '').trim();
        const delta = Number(req.body.delta);
        if (!uniqueId || !Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: 'Paramètres invalides' });
        const doc = await points.adjust(token, uniqueId, delta, req.body.nickname);
        res.json({ success: true, points: Math.max(0, doc.points) });
    }));

    app.post('/api/points/reset', wrap(async (req, res) => {
        const token = requireToken(req, res); if (!token) return;
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
