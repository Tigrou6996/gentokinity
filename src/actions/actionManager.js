const crypto = require('crypto');
const logger = require('../utils/logger');
const { getPlan, canUseActionType, PREMIUM_ONLY_ACTION_TYPES } = require('../features/plans');
const config = require('../config');
const { pressKey } = require('./keyboardAction');
const { sendWebhook } = require('./webhookAction');
const { sendRconCommand } = require('./rconAction');
const { emitToApp, emitToDesktopApp, isAppConnected, emitEvent } = require('../utils/socket');
const { translateGift } = require('../utils/giftTranslator');

/**
 * Values available in action texts / commands, e.g. "Merci {nickname} pour {repeatcount} {giftname} !"
 * Line breaks are removed: values come from TikTok viewers and a line break could chain
 * extra Minecraft commands.
 */
function buildPlaceholders(context = {}, extra = {}) {
    const values = {
        '{user}': context.uniqueId || '',
        '{username}': context.uniqueId || '', // TikTok @username
        '{nickname}': context.nickname || context.uniqueId || '',
        '{comment}': context.comment || context.message || '',
        '{giftname}': context.giftName || '',
        '{coins}': context.diamondCount || context.coins || '',
        '{repeatcount}': context.repeatCount || '1',
        '{combo}': context.comboCount || context.repeatCount || '1',
        '{likecount}': context.likeCount || '',
        '{totallikecount}': context.totalLikeCount || '',
        '{submonth}': context.subMonth || '',
        '{level}': context.level || '',
        ...extra
    };
    for (const key of Object.keys(values)) {
        values[key] = String(values[key]).replace(/[\r\n]+/g, ' ');
    }
    return values;
}

const MAX_RUNS_PER_TRIGGER = 50; // safety cap for one trigger (e.g. a 1000-rose combo)

function safeJson(text) {
    try {
        const v = JSON.parse(text);
        return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) {
        return {};
    }
}

function fillPlaceholders(template, context, extra) {
    let out = String(template || '');
    const values = buildPlaceholders(context, extra);
    for (const [key, val] of Object.entries(values)) {
        out = out.split(key).join(val);
    }
    return out;
}

class ActionManager {
    constructor() {
        this.donors = new Map(); // token -> Map(uniqueId -> totalDiamonds)
        this.lastRunAt = new Map(); // `${token}:${actionId}` -> timestamp (cooldowns)
    }

    /**
     * Optional per-action cooldown (seconds): returns false if the action ran too recently.
     */
    passesCooldown(token, action, context = {}) {
        const now = Date.now();
        const globalS = Number(action.cooldown) || 0;
        const userS = Number(action.userCooldown) || 0;
        const viewer = context.userId || context.uniqueId;
        const globalKey = `${token}:${action.id}`;
        const userKey = `${token}:${action.id}:${viewer}`;

        if (globalS > 0 && now - (this.lastRunAt.get(globalKey) || 0) < globalS * 1000) return false;
        if (userS > 0 && viewer && now - (this.lastRunAt.get(userKey) || 0) < userS * 1000) return false;

        if (globalS > 0) this.lastRunAt.set(globalKey, now);
        if (userS > 0 && viewer) this.lastRunAt.set(userKey, now);

        // Keep the map small on long lives
        if (this.lastRunAt.size > 20000) {
            const limit = now - 3600 * 1000;
            for (const [k, t] of this.lastRunAt) if (t < limit) this.lastRunAt.delete(k);
        }
        return true;
    }

    /**
     * Calcule le rang d'un donateur dans la session actuelle pour un token spécifique
     */
    getGifterRank(token, uniqueId) {
        if (!this.donors.has(token)) return 999;
        const tokenDonors = this.donors.get(token);
        if (!tokenDonors.has(uniqueId)) return 999;

        const sortedDonors = Array.from(tokenDonors.entries())
            .sort((a, b) => b[1] - a[1]);

        return sortedDonors.findIndex(d => d[0] === uniqueId) + 1;
    }

    /**
     * Exécute une action ou un tableau d'actions selon le nom du déclencheur
     * @param {string} triggerCode Le code du déclencheur (ex: gift_rose, follow)
     * @param {object} context Données additionnelles de l'événement
     * @param {object} connector Instance du connecteur (contient le token)
     */
    async executeAction(triggerCode, context = {}, connector) {
        if (!connector || !connector.token) return;
        const token = connector.token;

        // Enregistrer la donation si c'est un cadeau
        const isGift = triggerCode === 'gift_min' || triggerCode.startsWith('gift:') || context.giftId;
        let repeatCount = context.repeatCount || 1;

        if (isGift) {
            const { getGiftPrice } = require('../utils/giftPrices');
            const unitPrice = getGiftPrice(context);
            const totalAmount = unitPrice * repeatCount;

            // Only the "gift:<name>" call records the donation (gift_min is called with the same gifts)
            if (unitPrice > 0 && context.repeatEnd && triggerCode.startsWith('gift:')) {
                if (!this.donors.has(token)) this.donors.set(token, new Map());
                const tokenDonors = this.donors.get(token);

                const currentTotal = tokenDonors.get(context.uniqueId) || 0;
                tokenDonors.set(context.uniqueId, currentTotal + totalAmount);

                // [IMPORTANT] Sync back to context for filters
                context.diamondCount = totalAmount;
            }
            context.unitPrice = unitPrice;
        }

        // Ajouter le rang au contexte pour filtre "Top Donateur"
        context.topGifterRank = this.getGifterRank(token, context.uniqueId);

        // [MULTI-TENANT] Fetch settings for THIS specific user
        const settings = await config.getSettings(token);
        const events = settings.events || [];
        const actionDefinitions = settings.actions || [];

        // Trouver les événements qui correspondent au triggerCode.
        // Chaque événement retenu indique combien de fois il se déclenche (`times`).
        const matched = [];
        const plan = getPlan(settings);
        for (const e of events) {
            if (!e || e.active === false) continue;
            if (!this.matchesAudience(e, context)) continue;
            const times = this.matchTrigger(e, triggerCode, context, connector);
            if (times <= 0) continue;

            // Points shop (Premium): the viewer pays the event with his points
            const cost = Number(e.pointsCost) || 0;
            if (cost > 0 && plan.pointsStore && context.uniqueId && !connector.isSimulation) {
                const points = require('../features/points');
                const paid = await points.spend(token, context, cost * times, 'spend', e.command || e.triggerType);
                if (!paid) {
                    emitEvent('points_insufficient', { uniqueId: context.uniqueId, nickname: context.nickname || context.uniqueId, cost: cost * times }, token);
                    logger.info(`💸 [${token.substring(0, 8)}] ${context.uniqueId} n'a pas assez de points (${cost * times}).`);
                    continue;
                }
            }
            matched.push({ event: e, times });
        }

        // Group actions by number of runs so that a gift combo of 5 runs its actions 5 times,
        // and an action linked to several matching events still runs only once per trigger.
        const runsByAction = new Map(); // actionId -> { def, times }
        for (const { event, times } of matched) {
            const actionIds = Array.isArray(event.actions) ? event.actions : [event.actions];
            for (const actionId of actionIds) {
                const def = actionDefinitions.find(a => a.id === actionId);
                if (!def) continue;
                const prev = runsByAction.get(actionId);
                if (!prev || prev.times < times) runsByAction.set(actionId, { def, times });
            }
        }
        if (runsByAction.size === 0) return;

        const batches = new Map(); // times -> [defs]
        for (const { def, times } of runsByAction.values()) {
            if (!batches.has(times)) batches.set(times, []);
            batches.get(times).push(def);
        }
        for (const [times, defs] of batches) {
            const count = Math.min(MAX_RUNS_PER_TRIGGER, times);
            for (let i = 0; i < count; i++) {
                this.enqueueActionBatch(token, defs, triggerCode, context, connector);
            }
        }
    }

    /** "Qui peut déclencher ?" filter */
    matchesAudience(e, context) {
        switch (e.who) {
            case 'follower':
                // followRole: 0 = not following, 1 = follower, 2 = friend (mutual follow)
                return Number(context.followRole) >= 1;
            case 'subscriber':
                return !!context.isSubscriber;
            case 'moderator':
                return !!context.isModerator;
            case 'specific_user':
                return !e.specificUser || String(context.uniqueId || '').toLowerCase() === String(e.specificUser).replace(/^@/, '').trim().toLowerCase();
            case 'top_gifter':
                return !!context.topGifterRank && context.topGifterRank <= 3;
            default:
                return true;
        }
    }

    /**
     * Returns how many times the event fires for this trigger (0 = no match).
     */
    matchTrigger(e, triggerCode, context, connector) {
        const repeat = (typeof context.repeatCount === 'number' && context.repeatCount > 0) ? context.repeatCount : 1;

        if (e.triggerType === 'gift') {
            if (!(triggerCode.startsWith('gift:') || triggerCode === 'gift')) return 0;
            const anyGift = !e.giftName || e.giftName.trim() === '' || ['any gift', 'tous les cadeaux'].includes(e.giftName.toLowerCase());
            if (anyGift) return repeat;

            // The gift id is exact: when both sides have one, it is the only criterion
            if (e.giftId && context.giftId) return String(e.giftId) === String(context.giftId) ? repeat : 0;

            const giftNameToCheck = context.giftName || (triggerCode.startsWith('gift:') ? triggerCode.substring(5) : '');
            if (!giftNameToCheck || giftNameToCheck === 'undefined') return 0;
            const clean = (v) => String(v).trim().toLowerCase().replace(/^gift\s+/i, '');
            const wanted = clean(e.giftName);
            return (wanted === clean(giftNameToCheck) || wanted === clean(translateGift(giftNameToCheck))) ? repeat : 0;
        }

        if (e.triggerType !== triggerCode) return 0;

        switch (triggerCode) {
            case 'like': {
                // Fires every time a viewer reaches `likeThreshold` likes (accumulated per viewer)
                const threshold = Math.max(1, parseInt(e.likeThreshold, 10) || 1);
                const sent = Math.max(1, parseInt(context.likeCount, 10) || 1);
                if (threshold <= 1) return Math.min(sent, MAX_RUNS_PER_TRIGGER);
                if (!connector.likeAccumulators) connector.likeAccumulators = new Map();
                const key = `${e.id}:${context.userId || context.uniqueId}`;
                const total = (connector.likeAccumulators.get(key) || 0) + sent;
                const times = Math.floor(total / threshold);
                connector.likeAccumulators.set(key, total - times * threshold);
                return times;
            }
            case 'command': {
                if (!e.command) return 0;
                const msg = String(context.message || context.comment || '').trim().toLowerCase();
                const cmd = e.command.trim().toLowerCase().replace(/^!/, '');
                const first = msg.split(/\s+/)[0] || '';
                return (first === cmd || first === '!' + cmd) ? 1 : 0;
            }
            case 'chat': {
                if (!e.message) return 1;
                const msg = String(context.message || context.comment || '').toLowerCase();
                return msg.includes(e.message.toLowerCase()) ? 1 : 0;
            }
            case 'gift_min': {
                const unitPrice = context.unitPrice || 0;
                return (!e.minCoins || unitPrice >= e.minCoins) ? repeat : 0;
            }
            case 'level_up':
                return (!e.minLevel || Number(context.level) >= e.minLevel) ? 1 : 0;
            default:
                return 1;
        }
    }

    /**
     * Vide la file d'attente d'actions lors d'un arrêt
     */
    clearQueue(token) {
        if (this.actionQueues && this.actionQueues.has(token)) {
            const q = this.actionQueues.get(token);
            q.items = [];
            q.isProcessing = false;
            logger.info(`🛑 [${token.substring(0, 8)}] File d'attente d'actions vidée.`);
        }
    }

    /**
     * Ajoute un groupe d'actions (Webhook + Son simultanés) dans la file d'attente
     */
    enqueueActionBatch(token, actionDefs, triggerCode, context, connector) {
        if (!this.actionQueues) this.actionQueues = new Map();
        if (!this.actionQueues.has(token)) {
            this.actionQueues.set(token, { items: [], isProcessing: false });
        }
        const q = this.actionQueues.get(token);
        q.items.push({ actionDefs, triggerCode, context, connector });
        this.processActionQueue(token);
    }

    async processActionQueue(token) {
        if (!this.actionQueues) return;
        const q = this.actionQueues.get(token);
        if (!q || q.isProcessing || q.items.length === 0) return;

        q.isProcessing = true;

        while (q.items.length > 0) {
            const task = q.items.shift();
            const { actionDefs, triggerCode, context, connector } = task;

            const actionNames = actionDefs.map(a => a.name || a.type).join(' + ');
            let plan = getPlan(false);
            try { plan = getPlan(await config.getSettings(token)); } catch (e) { }
            logger.info(`🔥 [${token.substring(0, 8)}] Déclenchement simultané (${q.items.length} cadeaux en attente) : ${actionNames}`);

            let maxDuration = 1.5;

            // Exécute TOUTES les actions associées au cadeau (Webhook + Son) EXACTEMENT EN MÊME TEMPS
            await Promise.all(actionDefs.map(async (actionDef) => {
                try {
                    if (actionDef.duration && typeof actionDef.duration === 'number' && actionDef.duration > maxDuration) {
                        maxDuration = actionDef.duration;
                    }
                    // Optional delay (Premium): runs later without blocking the other actions of the queue
                    const delayS = plan.actionDelay ? Math.min(Math.max(Number(actionDef.delay) || 0, 0), 600) : 0;
                    if (delayS > 0) {
                        setTimeout(() => {
                            if (connector && connector.isStopping) return;
                            this.runAction(actionDef, triggerCode, context, connector).catch(() => { });
                        }, delayS * 1000);
                    } else {
                        await this.runAction(actionDef, triggerCode, context, connector);
                    }
                } catch (err) {
                    logger.error(`🚨 Erreur action ${actionDef.id}: ${err.message}`);
                }
            }));

            // Pause d'attente rapide (450ms) pour enchaîner fluidement les combos de cadeaux
            let delayMs = 450;
            if (maxDuration > 1.5 && q.items.length === 0) {
                delayMs = Math.round(maxDuration * 1000);
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        q.isProcessing = false;
    }

    /**
     * Exécute une seule action
     */
    async runAction(action, triggerCode, context, connector) {
        if (!connector || !connector.token) return;
        const token = connector.token;

        // Premium-only action types
        if (PREMIUM_ONLY_ACTION_TYPES.includes(action.type)) {
            const plan = getPlan(await config.getSettings(token));
            if (!canUseActionType(plan, action.type)) {
                logger.warn(`🔒 [${token.substring(0, 8)}] Action "${action.name || action.type}" réservée à Gentok Premium.`);
                return;
            }
        }

        // Manual tests (dashboard "Tester") and goal rewards ignore cooldowns
        if (triggerCode !== 'manual' && !this.passesCooldown(token, action, context)) {
            logger.info(`⏳ [${token.substring(0, 8)}] Action "${action.name || action.id}" ignorée (cooldown).`);
            return;
        }

        // [NEW] Actions Breakdown tracking
        if (connector.stats) {
            if (!connector.stats.actionsBreakdown) connector.stats.actionsBreakdown = {};
            const actionName = action.name || action.type;
            connector.stats.actionsBreakdown[actionName] = (connector.stats.actionsBreakdown[actionName] || 0) + 1;
        }

        try {
            if (action.type === 'webhook') {
                let url = action.url;
                if (!url) {
                    logger.warn(`⚠️ [${token.substring(0, 8)}] Webhook ignoré : URL manquante (${action.name || action.id}).`);
                    return;
                }
                if (context.uniqueId) {
                    url = url.replace(/{user}/g, context.uniqueId);
                    url = url.replace(/{username}/g, context.uniqueId);
                }

                await sendWebhook({
                    url: url,
                    method: action.method || 'GET',
                    data: action.data || {}
                });
            } else if (action.type === 'keyboard') {
                const isApp = config.isAppMode;
                // If we are in APP MODE, execute locally
                if (isApp) {
                    pressKey(action.key, false, action.duration || 100);
                } else {
                    // If we are the VPS, relay to the connected EXE
                    emitToApp(token, 'remote_keyboard', {
                        key: action.key,
                        duration: action.duration || 100
                    });
                }
            } else if (action.type === 'rcon') {
                let command = action.command || '';
                if (!command.trim()) {
                    logger.warn(`⚠️ [${token.substring(0, 8)}] Commande Minecraft vide (${action.name || action.id}).`);
                    return;
                }

                // Get Minecraft settings for THIS token first (needed for {playername})
                const settings = await config.getSettings(token);
                const mcSettings = settings.minecraft || {};
                const mcPlayerName = mcSettings.playerName || mcSettings.currentPlayerName || '';

                // Placeholders ({username}, {giftname}, {playername}...)
                command = fillPlaceholders(command, context, { '{playername}': mcPlayerName });

                if (!mcSettings || !mcSettings.host) {
                    logger.warn(`⚠️ [${token.substring(0, 8)}] Minecraft action skipped: No settings configured.`);
                    return;
                }

                // Auto-execute AT the player's position if a player name is configured
                // AND the command doesn't already allow specific targeting (like 'execute')
                if (mcPlayerName && mcPlayerName.trim() !== '' && !command.startsWith('execute')) {
                    // Check if command is safe to wrap? Usually yes.
                    // If user manually typed "execute at ...", we don't wrap.
                    command = `execute at ${mcPlayerName} run ${command}`;
                }

                const appConnected = isAppConnected(token);
                const isLocal = config.isAppMode;

                // [FIX] In App/Local mode, the server IS on the same machine as Minecraft.
                // Just call ServerTap HTTP directly — no relay needed!
                if (isLocal) {
                    logger.info(`🎮 [Local] Direct RCON: ${command} to ${mcSettings.host}:${mcSettings.port}`);
                    await sendRconCommand(command, mcSettings);
                } else if (appConnected) {
                    // VPS mode: relay to Electron app via socket
                    logger.info(`📡 Relaying RCON to App (EXE) for token ${token.substring(0, 8)}...`);
                    emitToApp(token, 'remote_rcon', { command, settings: mcSettings });
                } else {
                    // VPS mode, no app connected: only possible if host is not localhost
                    if (mcSettings.host && mcSettings.host !== 'localhost' && mcSettings.host !== '127.0.0.1') {
                        logger.info(`🎮 Executing direct RCON: ${command} to ${mcSettings.host}:${mcSettings.port}`);
                        await sendRconCommand(command, mcSettings);
                    } else {
                        logger.warn(`⚠️ [${token.substring(0, 8)}] RCON skipped: Host is ${mcSettings.host} but no App is connected.`);
                    }
                }


            } else if (action.type === 'sound') {
                // Handled below by audioUrl check
            } else if (action.type === 'alert') {
                // On-screen alert shown by the "Alertes" overlay (image / GIF / video + text)
                emitEvent('overlay_alert', {
                    text: fillPlaceholders(action.text || '', context),
                    mediaUrl: action.mediaUrl || '',
                    duration: Math.min(Math.max(Number(action.alertDuration) || 5, 1), 60),
                    nickname: context.nickname || context.uniqueId || '',
                    uniqueId: context.uniqueId || '',
                    profilePictureUrl: context.profilePictureUrl || '',
                    giftIcon: context.url || context.giftIcon || ''
                }, token);
            } else if (action.type === 'obs') {
                const settings = await config.getSettings(token);
                const obsSettings = settings.obs || {};
                const obsAction = { obsAction: action.obsAction, obsScene: action.obsScene, obsSource: action.obsSource, obsDuration: action.obsDuration };
                const isLocalHost = !obsSettings.host || ['localhost', '127.0.0.1'].includes(obsSettings.host);

                if (config.isAppMode) {
                    const { runObsAction } = require('./obsAction');
                    await runObsAction(obsAction, obsSettings);
                } else if (isAppConnected(token)) {
                    // OBS runs on the streamer's PC: the desktop app executes it
                    emitToDesktopApp(token, 'remote_obs', { action: obsAction, settings: obsSettings });
                } else if (!isLocalHost) {
                    const { runObsAction } = require('./obsAction');
                    await runObsAction(obsAction, obsSettings);
                } else {
                    logger.warn(`⚠️ [${token.substring(0, 8)}] Action OBS ignorée : lancez l'application Gentok sur le PC où tourne OBS.`);
                }
            } else if (action.type === 'streamerbot') {
                const settings = await config.getSettings(token);
                const sb = settings.streamerbot || {};
                const args = {
                    user: context.uniqueId || '', nickname: context.nickname || '', comment: context.comment || context.message || '',
                    giftName: context.giftName || '', giftId: context.giftId || '', coins: context.diamondCount || context.coins || 0,
                    repeatCount: context.repeatCount || 1, likeCount: context.likeCount || 0, trigger: triggerCode,
                    ...(action.sbArgs ? safeJson(fillPlaceholders(action.sbArgs, context)) : {})
                };
                const payload = { action: { id: action.sbActionId || undefined, name: action.sbActionName || undefined }, args };
                const isLocalHost = !sb.host || ['localhost', '127.0.0.1'].includes(sb.host);
                if (config.isAppMode || !isLocalHost) {
                    const { runStreamerbotAction } = require('./streamerbotAction');
                    await runStreamerbotAction(payload, sb);
                } else if (isAppConnected(token)) {
                    emitToDesktopApp(token, 'remote_streamerbot', { payload, settings: sb });
                } else {
                    logger.warn(`⚠️ [${token.substring(0, 8)}] Action Streamer.bot ignorée : lancez l'application Gentok sur le PC de Streamer.bot.`);
                }
            } else if (action.type === 'wheel') {
                await this.spinWheel(action, context, connector);
            } else if (action.type === 'tts') {
                // Text read aloud by the dashboard (same voice settings as the chat TTS)
                const text = fillPlaceholders(action.text || '', context).trim();
                if (text) emitEvent('tts_speak', { text: text.slice(0, 300), user: context.uniqueId || 'action' }, token);
            } else {
                logger.warn(`⚠️ Type d'action inconnu : ${action.type}`);
            }

            // Play audio if action is of type 'sound' OR has an attached soundUrl (e.g. Soundboard audio alerts)
            const audioUrl = action.soundUrl || action.sound_url || (action.type === 'sound' ? action.url : null);
            if (audioUrl && typeof audioUrl === 'string' && audioUrl.trim() !== '') {
                emitEvent('play_audio', {
                    title: action.soundName || action.name || 'Son',
                    url: audioUrl,
                    volume: action.volume !== undefined ? action.volume : 1
                }, token);
            }
        } catch (err) {
            logger.error(`🚨 Erreur lors de l'exécution de l'action ${action.type}: ${err.message}`);
        }
    }
    /**
     * "Roue de la fortune": picks a segment, animates it on the Wheel overlay, then runs the
     * action linked to the winning segment ("Texte => Nom de l'action").
     */
    async spinWheel(action, context, connector) {
        const token = connector.token;
        const segments = String(action.segments || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .slice(0, 24)
            .map(line => {
                const [label, linked] = line.split('=>').map(p => (p || '').trim());
                return { label: label.slice(0, 40), linked: linked || null };
            })
            .filter(s => s.label);
        if (segments.length < 2) {
            logger.warn(`⚠️ [${token.substring(0, 8)}] Roue "${action.name}" : il faut au moins 2 cases.`);
            return;
        }

        const winnerIndex = crypto.randomInt(segments.length);
        const winner = segments[winnerIndex];
        const spinMs = 6000;
        emitEvent('wheel_spin', {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            title: action.name || '',
            segments: segments.map(s => s.label),
            winnerIndex,
            spinMs,
            nickname: context.nickname || context.uniqueId || '',
            profilePictureUrl: context.profilePictureUrl || ''
        }, token);
        logger.info(`🎡 [${token.substring(0, 8)}] Roue "${action.name}" : ${winner.label} (${context.uniqueId || 'test'})`);

        if (winner.linked) {
            const settings = await config.getSettings(token);
            const target = (settings.actions || []).find(a =>
                a.id !== action.id && (a.name || '').trim().toLowerCase() === winner.linked.toLowerCase());
            if (!target) {
                logger.warn(`⚠️ Roue : action « ${winner.linked} » introuvable.`);
                return;
            }
            // Run the reward once the wheel has stopped on the overlay
            setTimeout(() => {
                if (connector.isStopping) return;
                this.runAction(target, 'wheel', { ...context, wheelResult: winner.label }, connector).catch(() => { });
            }, spinMs + 500);
        }
    }

    async executeActionById(actionId, connector, context = {}) {
        if (!connector || !connector.token) return;
        const token = connector.token;

        const settings = await config.getSettings(token);
        const actionDef = (settings.actions || []).find(a => a.id === actionId);

        if (actionDef) {
            logger.info(`🔥 [${token.substring(0, 8)}] Déclenchement manuel : ${actionDef.name || actionId}`);
            await this.runAction(actionDef, 'manual', context, connector);
        } else {
            logger.warn(`⚠️ Action ${actionId} introuvable pour ${token.substring(0, 8)}`);
        }
    }
}

module.exports = new ActionManager();
module.exports.fillPlaceholders = fillPlaceholders;
