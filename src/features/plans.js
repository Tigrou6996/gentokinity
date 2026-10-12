/**
 * Gentok plans: what free accounts can do and what Premium unlocks.
 * Used by the server (enforcement) and sent to the dashboard (/api/plan) to show
 * the comparison table and the lock badges.
 */
const PLANS = {
    free: {
        id: 'free',
        maxScenes: 2,
        maxActionsPerScene: 5,
        maxEventsPerScene: 5,
        maxPointsUsers: 1000,
        maxBattleTeams: 2,
        premiumActionTypes: ['obs', 'wheel', 'streamerbot'],
        pointsStore: false,     // events that cost points (viewer rewards shop)
        sessionHistory: false,  // detailed history of past lives
        actionDelay: false,     // "delay before running" option
        userCooldown: true
    },
    premium: {
        id: 'premium',
        maxScenes: 10,
        maxActionsPerScene: Infinity,
        maxEventsPerScene: Infinity,
        maxPointsUsers: 100000,
        maxBattleTeams: 4,
        premiumActionTypes: [],
        pointsStore: true,
        sessionHistory: true,
        actionDelay: true,
        userCooldown: true
    }
};

const PREMIUM_ONLY_ACTION_TYPES = ['obs', 'wheel', 'streamerbot'];

function getPlan(settingsOrPremium) {
    const isPremium = typeof settingsOrPremium === 'boolean' ? settingsOrPremium : !!(settingsOrPremium && settingsOrPremium.isPremium);
    return isPremium ? PLANS.premium : PLANS.free;
}

function canUseActionType(plan, type) {
    return !plan.premiumActionTypes.includes(type);
}

// JSON can't carry Infinity: the dashboard receives null for "unlimited"
function serializePlan(plan) {
    const out = {};
    for (const [k, v] of Object.entries(plan)) out[k] = v === Infinity ? null : v;
    return out;
}

module.exports = { PLANS, PREMIUM_ONLY_ACTION_TYPES, getPlan, canUseActionType, serializePlan };
