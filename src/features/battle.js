/**
 * Team battles ("likes contre likes", gifts, or both) and polls (mode "votes": one vote per viewer).
 *
 * Viewers join a team by typing its command in the chat (e.g. !rouge). Depending on the mode,
 * their likes and/or the coins of their gifts are added to the team. A gift can also be
 * assigned to a team (every viewer sending that gift scores for it, even without joining).
 * The overlay /overlay/battle shows the scores live and the winner at the end.
 */
const logger = require('../utils/logger');

const battles = new Map(); // token -> battle state
const COLORS = ['#fe2c55', '#25f4ee', '#fbbf24', '#4ade80'];

function publicState(b) {
    if (!b) return { running: false };
    return {
        id: b.id,
        running: b.running,
        title: b.title,
        mode: b.mode,
        endsAt: b.endsAt,
        startedAt: b.startedAt,
        winnerId: b.winnerId || null,
        teams: b.teams.map(t => ({
            id: t.id, name: t.name, color: t.color, command: t.command, giftId: t.giftId, giftName: t.giftName,
            score: Math.round(t.score), members: t.members.size,
            topMembers: Array.from(t.contrib.entries()).sort((a, b) => b[1].score - a[1].score).slice(0, 3)
                .map(([uniqueId, c]) => ({ uniqueId, nickname: c.nickname, score: Math.round(c.score) }))
        }))
    };
}

function emit(token, event, data) {
    const { emitEvent } = require('../utils/socket');
    emitEvent(event, data, token);
}

function scheduleUpdate(token, b) {
    if (b.updateTimer) return;
    b.updateTimer = setTimeout(() => {
        b.updateTimer = null;
        emit(token, 'battle_update', publicState(b));
    }, 300);
}

/**
 * @param {object} cfg { title, mode: 'likes'|'gifts'|'both'|'votes', duration (seconds), likeValue, teams: [{ name, color, command, giftId, giftName, winActionId }] }
 */
function start(token, cfg, maxTeams = 2) {
    stop(token, { silent: true });
    const teamsCfg = (Array.isArray(cfg.teams) ? cfg.teams : []).slice(0, Math.max(2, maxTeams));
    if (teamsCfg.length < 2) throw new Error('Il faut au moins 2 équipes');

    const b = {
        id: `${Date.now()}`,
        running: true,
        title: String(cfg.title || 'Bataille').slice(0, 60),
        mode: ['likes', 'gifts', 'both', 'votes'].includes(cfg.mode) ? cfg.mode : 'likes',
        likeValue: Math.max(0, Number(cfg.likeValue) || 1),
        startedAt: Date.now(),
        endsAt: Date.now() + Math.min(Math.max(Number(cfg.duration) || 180, 10), 3 * 3600) * 1000,
        teams: teamsCfg.map((t, i) => ({
            id: `t${i + 1}`,
            name: String(t.name || `Équipe ${i + 1}`).slice(0, 30),
            color: /^#[0-9a-f]{3,8}$/i.test(t.color || '') ? t.color : COLORS[i % COLORS.length],
            command: String(t.command || '').trim().toLowerCase().replace(/^!?/, '!'),
            giftId: t.giftId ? String(t.giftId) : null,
            giftName: t.giftName || null,
            winActionId: t.winActionId || null,
            score: 0,
            members: new Set(),
            contrib: new Map()
        })),
        memberTeam: new Map(), // viewer -> team id
        updateTimer: null,
        endTimer: null
    };
    b.endTimer = setTimeout(() => finish(token), b.endsAt - Date.now());
    battles.set(token, b);
    logger.info(`⚔️ Bataille « ${b.title} » lancée (${b.teams.map(t => t.name).join(' vs ')})`);
    emit(token, 'battle_update', publicState(b));
    return publicState(b);
}

function addScore(token, b, team, user, amount) {
    if (!amount) return;
    team.score += amount;
    const key = user.uniqueId;
    const c = team.contrib.get(key) || { nickname: user.nickname || key, score: 0 };
    c.score += amount;
    team.contrib.set(key, c);
    scheduleUpdate(token, b);
}

/** Chat: join a team with its command. Returns true if the message was a battle command */
function onChat(token, user, comment) {
    const b = battles.get(token);
    if (!b || !b.running || !comment) return false;
    const first = String(comment).trim().toLowerCase().split(/\s+/)[0];
    const team = b.teams.find(t => t.command && t.command === first);
    if (!team) return false;
    const viewer = user.userId || user.uniqueId;
    const previous = b.memberTeam.get(viewer);
    if (previous === team.id) return true;
    if (previous) b.teams.find(t => t.id === previous)?.members.delete(viewer);
    b.memberTeam.set(viewer, team.id);
    team.members.add(viewer);
    // Poll: the score is the number of voters (a viewer can change their vote)
    if (b.mode === 'votes') b.teams.forEach(t => { t.score = t.members.size; });
    scheduleUpdate(token, b);
    return true;
}

function onLike(token, user, likeCount) {
    const b = battles.get(token);
    if (!b || !b.running || (b.mode !== 'likes' && b.mode !== 'both')) return;
    const teamId = b.memberTeam.get(user.userId || user.uniqueId);
    const team = teamId && b.teams.find(t => t.id === teamId);
    if (team) addScore(token, b, team, user, (Number(likeCount) || 1) * b.likeValue);
}

function onGift(token, user, giftId, coins) {
    const b = battles.get(token);
    if (!b || !b.running || (b.mode !== 'gifts' && b.mode !== 'both')) return;
    // A gift assigned to a team always scores for it, otherwise the sender's team scores
    let team = b.teams.find(t => t.giftId && String(t.giftId) === String(giftId));
    if (!team) {
        const teamId = b.memberTeam.get(user.userId || user.uniqueId);
        team = teamId && b.teams.find(t => t.id === teamId);
    }
    if (team) addScore(token, b, team, user, Number(coins) || 0);
}

function finish(token) {
    const b = battles.get(token);
    if (!b || !b.running) return;
    b.running = false;
    clearTimeout(b.endTimer);
    clearTimeout(b.updateTimer);
    b.updateTimer = null;

    const sorted = [...b.teams].sort((x, y) => y.score - x.score);
    const isDraw = sorted.length > 1 && sorted[0].score === sorted[1].score;
    b.winnerId = isDraw ? 'draw' : sorted[0].id;
    const state = publicState(b);
    emit(token, 'battle_end', state);
    logger.info(`🏆 Bataille « ${b.title} » terminée : ${isDraw ? 'égalité' : sorted[0].name}`);

    // Optional reward action for the winning team
    if (!isDraw && sorted[0].winActionId) {
        const server = require('../server');
        const actionManager = require('../actions/actionManager');
        const connector = server.getConnector && server.getConnector(token);
        actionManager.executeActionById(sorted[0].winActionId, connector || { token, stats: {} }, { nickname: sorted[0].name, uniqueId: sorted[0].name })
            .catch(e => logger.warn(`Action de victoire impossible : ${e.message}`));
    }
    return state;
}

function stop(token, { silent = false } = {}) {
    const b = battles.get(token);
    if (!b) return { running: false };
    if (b.running && !silent) return finish(token);
    clearTimeout(b.endTimer);
    clearTimeout(b.updateTimer);
    battles.delete(token);
    return { running: false };
}

function getState(token) {
    return publicState(battles.get(token));
}

module.exports = { start, stop, finish, onChat, onLike, onGift, getState };
