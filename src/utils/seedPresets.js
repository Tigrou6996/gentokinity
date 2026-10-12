const Preset = require('../models/Preset');

const defaultPresets = [
    {
        id: 'p_chaos_gta',
        title: 'GTA Mont Chiliad - CHASSEUR CHAOS FREE',
        desc: 'Le pack ultime pour vos lives "Chaos" sur GTA. Configuration prête à l\'emploi pour Mont Chiliad.',
        img: 'https://images.unsplash.com/photo-1544654803-b69110bb8151?w=400&h=200&fit=cover',
        badge: 'partner',
        rules: 6,
        overlays: 2,
        type: 'webhook',
        creator: 'Gentok Partner',
        content: {
            actions: [
                { id: 'acc_tp', name: 'TP Aléatoire', type: 'webhook', url: 'http://localhost:3000/chaos/tp' },
                { id: 'acc_death', name: 'Mort instantanée', type: 'webhook', url: 'http://localhost:3000/chaos/death' },
                { id: 'acc_blackhole', name: 'Trou Noir', type: 'webhook', url: 'http://localhost:3000/chaos/blackhole' },
                { id: 'acc_destroy', name: 'Détruire Véhicule', type: 'webhook', url: 'http://localhost:3000/chaos/destroy' },
                { id: 'acc_change_veh', name: 'Change Véhicule', type: 'webhook', url: 'http://localhost:3000/chaos/change_veh' }
            ],
            events: [
                { id: 'evt_tp', active: true, triggerType: 'gift', giftName: 'Le petit Ourson', giftId: '5519', actions: ['acc_tp'] },
                { id: 'evt_death', active: true, triggerType: 'gift', giftName: 'Gants de boxe', giftId: '5530', actions: ['acc_death'] },
                { id: 'evt_blackhole', active: true, triggerType: 'gift', giftName: 'Cœur dans les mains', giftId: '6363', actions: ['acc_blackhole'] },
                { id: 'evt_destroy', active: true, triggerType: 'gift', giftName: 'Cœur avec les doigts', giftId: '6362', actions: ['acc_destroy'] },
                { id: 'evt_change_veh_gift', active: true, triggerType: 'gift', giftName: 'Rose', giftId: '5655', actions: ['acc_change_veh'] },
                { id: 'evt_change_veh_follow', active: true, triggerType: 'follow', actions: ['acc_change_veh'] }
            ]
        }
    }
];

async function seedPresets() {
    try {
        const count = await Preset.countDocuments();
        if (count === 0) {
            console.log('🌱 Seeding default presets into MongoDB...');
            await Preset.insertMany(defaultPresets);
            console.log('✅ Default presets seeded successfully.');
        }
    } catch (err) {
        console.error('❌ Error seeding presets:', err);
    }
}

module.exports = seedPresets;
