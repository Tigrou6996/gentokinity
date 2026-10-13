/**
 * Gentok Premium billing (Stripe Checkout, one-off payments per period).
 *
 * - OFFERS: the periods sold, used by the checkout route and shown by the dashboard (/api/billing/offers).
 * - applyPayment(): called by the webhook, extends the paid period from its current end.
 * - expireOverdue(): turns Premium off once the paid period is over (run regularly on the VPS).
 *   Premium granted by hand (no Stripe period) is never touched.
 */
const OFFERS = [
    { id: '1m', months: 1, amount: 899 },
    { id: '3m', months: 3, amount: 2499 },
    { id: '6m', months: 6, amount: 4499 },
    { id: '12m', months: 12, amount: 7999 }
];

function offerFor(plan) {
    return OFFERS.find(o => o.id === plan || o.months === Number(plan)) || OFFERS[0];
}

function publicOffers() {
    return OFFERS.map(o => ({ ...o, perMonth: Math.round(o.amount / o.months), currency: 'eur' }));
}

// New end of the paid period: renewing early never makes the customer lose paid days.
function extendPeriod(currentEnd, months, now = new Date()) {
    const base = currentEnd && new Date(currentEnd) > now ? new Date(currentEnd) : new Date(now);
    base.setMonth(base.getMonth() + months);
    return base;
}

async function applyPayment(Settings, session) {
    const token = session.client_reference_id || (session.metadata ? session.metadata.token : null);
    if (!token) return null;
    const offer = offerFor(session.metadata ? parseInt(session.metadata.months, 10) : 1);
    const existing = await Settings.findOne({ token }).select('billing').lean();
    // Stripe can deliver the same event twice: a session is only counted once
    if (existing?.billing?.history?.some(h => h.sessionId === session.id)) return { token, duplicate: true, currentPeriodEnd: existing.billing.currentPeriodEnd };
    const endDate = extendPeriod(existing?.billing?.currentPeriodEnd, offer.months);
    await Settings.updateOne(
        { token },
        {
            $set: {
                isPremium: true,
                'billing.status': 'active',
                'billing.plan': offer.id,
                'billing.currentPeriodEnd': endDate,
                'billing.stripeCustomerId': session.customer || existing?.billing?.stripeCustomerId || null,
                'billing.subscriptionId': session.subscription || null
            },
            $push: {
                'billing.history': {
                    sessionId: session.id,
                    amount: session.amount_total,
                    currency: session.currency,
                    status: session.payment_status,
                    date: new Date()
                }
            }
        },
        { upsert: true }
    );
    return { token, plan: offer.id, currentPeriodEnd: endDate };
}

async function expireOverdue(Settings, now = new Date()) {
    const overdue = await Settings.find({ isPremium: true, 'billing.status': 'active', 'billing.currentPeriodEnd': { $lt: now } }).select('token').lean();
    if (!overdue.length) return [];
    const tokens = overdue.map(s => s.token);
    await Settings.updateMany({ token: { $in: tokens } }, { $set: { isPremium: false, 'billing.status': 'expired' } });
    return tokens;
}

module.exports = { OFFERS, offerFor, publicOffers, extendPeriod, applyPayment, expireOverdue };
