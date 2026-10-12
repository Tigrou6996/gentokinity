const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: null },
    ip: { type: String, default: null },
    isPremium: { type: Boolean, default: false }, // [NEW] Premium status
    activeSceneId: { type: String, default: null }, // [NEW] Active profile/scene id
    scenes: [{
        id: String,
        title: String,
        isPreset: { type: Boolean, default: false },
        likesGoal: { type: Object, default: null }, // [NEW] Per-scene Likes Goal
        topGift: { type: Object, default: null }, // [NEW] Per-scene Top Gift
        topStreak: { type: Object, default: null }, // [NEW] Per-scene Top Streak
        topCoins: { type: Object, default: { limit: 10, title: 'TOP COINS', style: 1, transparent: true, showTitle: true } }, // [NEW] Per-scene Top Coins Leaderboard
        topLikes: { type: Object, default: { limit: 10, title: 'TOP LIKES', style: 1, transparent: true, showTitle: true } }, // [NEW] Per-scene Top Likes Leaderboard
        autoResetTopStats: { type: Boolean, default: false }, // [NEW] Per-scene Auto Reset
        autoResetLastX: { type: Boolean, default: false } // [NEW] Per-scene Auto Reset
    }], // [NEW] Persisted scenes list

    // [GLOBAL FALLBACKS] Root-level settings when no scene is active
    likesGoal: { type: Object, default: null },
    topGift: { type: Object, default: null },
    topStreak: { type: Object, default: null },
    topCoins: { type: Object, default: null },
    topLikes: { type: Object, default: null },
    autoResetTopStats: { type: Boolean, default: false },
    autoResetLastX: { type: Boolean, default: false },

    minecraft: {
        host: { type: String, default: 'localhost' },
        port: { type: Number, default: 4567 },
        password: { type: String, default: '' },
        playerName: { type: String, default: '' }
    },
    spotify: {
        clientId: { type: String, default: '' },
        clientSecret: { type: String, default: '' },
        refreshToken: { type: String, default: '' },
        maxTracksPerUser: { type: Number, default: 5 },
        maxQueueSize: { type: Number, default: 50 }, // [NEW] Overall queue limit
        enabled: { type: Boolean, default: false },
        playEnabled: { type: Boolean, default: true }, // [NEW] Toggle !play
        skipEnabled: { type: Boolean, default: true }, // [NEW] Toggle !skip
        allowExplicit: { type: Boolean, default: true }, // [NEW] Explicit content
        alwaysShowOverlay: { type: Boolean, default: true }, // [NEW] Permanent overlay
        allowedUsers: { // [NEW] Permissions
            all: { type: Boolean, default: true },
            followers: { type: Boolean, default: false },
            subscribers: { type: Boolean, default: true },
            moderators: { type: Boolean, default: true }
        },
        commands: {
            play: { type: String, default: '!play' },
            skip: { type: String, default: '!skip' },
            remove: { type: String, default: '!remove' }
        },
        skipVotes: { type: Number, default: 3 },
        skipInstant: {
            moderators: { type: Boolean, default: true },
            subscribers: { type: Boolean, default: false },
            followers: { type: Boolean, default: false }
        }
    },
    tts: {
        enabled: { type: Boolean, default: false },
        language: { type: String, default: 'fr-FR' },
        voice: { type: String, default: null },
        randomVoice: { type: Boolean, default: false },
        speed: { type: Number, default: 1.0 },
        pitch: { type: Number, default: 1.0 },
        volume: { type: Number, default: 1.0 },
        allowedUsers: {
            all: { type: Boolean, default: false },
            followers: { type: Boolean, default: false },
            subscribers: { type: Boolean, default: true },
            moderators: { type: Boolean, default: true },
            team: { type: Boolean, default: true },
            gifters: { type: Boolean, default: false }
        },
        teamMinLevel: { type: Number, default: 10 },
        giftersTop: { type: Number, default: 1 },
        commentType: { type: String, default: 'dot' },
        commandTrigger: { type: String, default: '!tts' },
        cooldown: { type: Number, default: 10 },
        maxQueue: { type: Number, default: 5 },
        maxLength: { type: Number, default: 100 },
        filterSpam: { type: Boolean, default: true },
        filterMentions: { type: Boolean, default: true },
        filterCommands: { type: Boolean, default: true }
    },
    lastEvents: {
        follower: { type: Object, default: null },
        gift: { type: Object, default: null },
        subscriber: { type: Object, default: null },
        share: { type: Object, default: null },
        like: { type: Object, default: null },
        chat: { type: Object, default: null }
    },
    billing: {
        stripeCustomerId: { type: String, default: null },
        subscriptionId: { type: String, default: null },
        status: { type: String, default: 'inactive' }, // active, past_due, canceled, inactive
        plan: { type: String, default: null }, // 1m, 3m, 6m, 12m
        currentPeriodEnd: { type: Date, default: null },
        history: [{
            sessionId: String,
            amount: Number,
            currency: String,
            status: String,
            date: { type: Date, default: Date.now }
        }]
    }
}, { timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);
