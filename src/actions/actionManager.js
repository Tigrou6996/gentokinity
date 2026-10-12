const logger = require('../utils/logger');
const config = require('../config');
const { pressKey } = require('./keyboardAction');
const { sendWebhook } = require('./webhookAction');
const { sendRconCommand } = require('./rconAction');
const { emitToApp, isAppConnected, emitEvent } = require('../utils/socket');
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
        ...extra
    };
    for (const key of Object.keys(values)) {
        values[key] = String(values[key]).replace(/[\r\n]+/g, ' ');
    }
    return values;
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
    passesCooldown(token, action) {
        const cooldownS = Number(action.cooldown) || 0;
        if (cooldownS <= 0) return true;
        const key = `${token}:${action.id}`;
        const now = Date.now();
        const last = this.lastRunAt.get(key) || 0;
        if (now - last < cooldownS * 1000) return false;
        this.lastRunAt.set(key, now);
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

            if (unitPrice > 0 && context.repeatEnd) {
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

        // Trouver les événements qui correspondent au triggerCode
        const matchedEvents = events.filter(e => {
            // 1. FILTER BY AUDIENCE (WHO)
            if (e.who === 'follower') {
                if (context.followRole !== 2) return false;
            } else if (e.who === 'subscriber') {
                if (!context.isSubscriber) return false;
            } else if (e.who === 'moderator') {
                if (!context.isModerator) return false;
            } else if (e.who === 'specific_user') {
                if (e.specificUser && context.uniqueId !== e.specificUser) return false;
            } else if (e.who === 'top_gifter') {
                if (!context.topGifterRank || context.topGifterRank > 3) return false;
            }

            // 2. FILTER BY TRIGGER
            let triggerMatched = false;

            if (e.triggerType === 'gift') {
                if (triggerCode.startsWith('gift:') || triggerCode === 'gift') {
                    if (!e.giftName || e.giftName.trim() === '' || e.giftName.toLowerCase() === 'any gift' || e.giftName.toLowerCase() === 'tous les cadeaux') {
                        triggerMatched = true;
                    } else if (e.giftId && context.giftId && String(e.giftId) === String(context.giftId)) {
                        triggerMatched = true;
                    } else {
                        const giftNameToCheck = context.giftName || (triggerCode.startsWith('gift:') ? triggerCode.substring(5) : '');
                        if (giftNameToCheck && giftNameToCheck !== 'undefined') {
                            const translatedName = translateGift(giftNameToCheck);
                            const eventGiftName = e.giftName.trim().toLowerCase().replace(/^gift\s+/i, '');
                            const targetRaw = giftNameToCheck.trim().toLowerCase().replace(/^gift\s+/i, '');
                            const targetTranslated = translatedName.trim().toLowerCase().replace(/^gift\s+/i, '');

                            if (eventGiftName === targetRaw || eventGiftName === targetTranslated) {
                                triggerMatched = true;
                            } else if (targetRaw.length > 2 && eventGiftName.length > 2) {
                                if (targetRaw.includes(eventGiftName) || eventGiftName.includes(targetRaw) || targetTranslated.includes(eventGiftName) || eventGiftName.includes(targetTranslated)) {
                                    triggerMatched = true;
                                }
                            }
                        }
                    }
                }
            } else if (e.triggerType === triggerCode) {
                triggerMatched = true;

                // Special check for Like Threshold (Check totalLikeCount or likeCount)
                if (triggerCode === 'like' && e.likeThreshold) {
                    const currentLikes = context.totalLikeCount || context.likeCount || 0;
                    if (currentLikes < e.likeThreshold) {
                        triggerMatched = false;
                    }
                }

                // Check for Command match
                if (triggerCode === 'command' && e.command) {
                    const msg = (context.message || '').trim().toLowerCase();
                    const cmd = e.command.trim().toLowerCase();
                    if (msg !== cmd && !msg.startsWith(cmd + ' ')) {
                        triggerMatched = false;
                    }
                }

                // Check for Min Coins Gift match
                if (triggerCode === 'gift_min' && e.minCoins) {
                    const unitPrice = context.unitPrice || 0;
                    if (unitPrice < e.minCoins) {
                        triggerMatched = false;
                    }
                }

                // Check for Chat Message match
                if (triggerCode === 'chat' && e.message) {
                    const msg = (context.message || '').toLowerCase();
                    const requiredMsg = e.message.toLowerCase();
                    if (!msg.includes(requiredMsg)) {
                        triggerMatched = false;
                    }
                }
            }

            return triggerMatched;
        });

        const executedActionIds = new Set();
        const allActionDefs = [];

        for (const event of matchedEvents) {
            if (!event.active) continue;

            const actionIds = Array.isArray(event.actions) ? event.actions : [event.actions];
            for (const actionId of actionIds) {
                if (executedActionIds.has(actionId)) continue;
                executedActionIds.add(actionId);

                const actionDef = actionDefinitions.find(a => a.id === actionId);
                if (actionDef) allActionDefs.push(actionDef);
            }
        }

        if (allActionDefs.length > 0) {
            const repeat = (context && typeof context.repeatCount === 'number' && context.repeatCount > 0) ? context.repeatCount : 1;
            const count = Math.min(20, repeat);
            for (let i = 0; i < count; i++) {
                this.enqueueActionBatch(token, allActionDefs, triggerCode, context, connector);
            }
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
            logger.info(`🔥 [${token.substring(0, 8)}] Déclenchement simultané (${q.items.length} cadeaux en attente) : ${actionNames}`);

            let maxDuration = 1.5;

            // Exécute TOUTES les actions associées au cadeau (Webhook + Son) EXACTEMENT EN MÊME TEMPS
            await Promise.all(actionDefs.map(async (actionDef) => {
                try {
                    if (actionDef.duration && typeof actionDef.duration === 'number' && actionDef.duration > maxDuration) {
                        maxDuration = actionDef.duration;
                    }
                    await this.runAction(actionDef, triggerCode, context, connector);
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

        if (!this.passesCooldown(token, action)) {
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
