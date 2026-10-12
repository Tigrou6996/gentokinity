/**
 * Gentok Premium: sidebar button, Stripe checkout and activation.
 *
 * - The sidebar button shows the offer to free accounts and the end of the paid period to Premium ones.
 * - Checkout: on the website the page goes to Stripe and comes back with ?payment=success;
 *   in the Windows app Stripe opens in the browser and the app waits for the payment.
 * - Activation is detected by polling /api/billing/status (and the premium_updated socket event on the website),
 *   then the dashboard reloads its config so everything unlocks without restarting.
 * Uses globals of app.js: getApiBase, fetchData, showToast, Swal.
 */
(function () {
    const t = (s) => (window.GentokI18n ? window.GentokI18n.t(s) : s);
    const api = window.electronAPI;
    const isApp = !!(api && api.openExternal);
    const POLL_MS = 4000;
    const POLL_MAX_MS = 15 * 60 * 1000;

    const state = { premium: false, status: 'inactive', currentPeriodEnd: null, plan: null, loaded: false };
    let pollTimer = null;

    const token = () => localStorage.getItem('gentok_token') || '';
    const fmtDate = (d) => new Date(d).toLocaleDateString(document.documentElement.lang || 'fr', { day: 'numeric', month: 'long', year: 'numeric' });
    const daysLeft = (d) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);

    async function fetchStatus() {
        if (!token()) return null;
        const r = await fetch(`${getApiBase()}/api/billing/status?token=${encodeURIComponent(token())}&t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    }

    function apply(s) {
        if (!s) return;
        state.premium = !!s.premium;
        state.status = s.status || state.status;
        state.currentPeriodEnd = s.currentPeriodEnd || null;
        state.plan = s.plan || null;
        state.loaded = true;
        render();
    }

    async function refresh() {
        try { apply(await fetchStatus()); } catch (e) { /* offline: keep the last known state */ }
    }

    // ------------------------------------------------------------ sidebar button
    function render(premiumFromConfig) {
        if (typeof premiumFromConfig === 'boolean' && !state.loaded) state.premium = premiumFromConfig;
        const el = document.getElementById('pro-banner');
        if (!el) return;
        const title = el.querySelector('.pro-title');
        const sub = el.querySelector('.pro-subtitle');
        const icon = el.querySelector('.pro-icon i');
        el.classList.toggle('is-premium', state.premium);
        el.classList.remove('is-ending');
        if (state.premium) {
            const left = state.currentPeriodEnd ? daysLeft(state.currentPeriodEnd) : null;
            title.textContent = t('Premium actif');
            if (left === null) sub.textContent = t('Sans date de fin');
            else if (left <= 7) { sub.textContent = left <= 1 ? t('Se termine demain') : `${t('Se termine dans')} ${left} ${t('jours')}`; el.classList.add('is-ending'); }
            else sub.textContent = `${t("Jusqu'au")} ${fmtDate(state.currentPeriodEnd)}`;
            icon.className = 'fas fa-crown';
            el.title = t('Voir mon offre');
        } else {
            title.textContent = t('Passer à Premium');
            sub.textContent = state.status === 'expired' ? t('Votre offre est terminée') : t('dès 6,66 €/mois');
            icon.className = 'fas fa-crown';
            el.title = t('Découvrir Gentok Premium');
        }
        renderModalStatus();
    }

    function onBannerClick() {
        if (state.premium && state.currentPeriodEnd && daysLeft(state.currentPeriodEnd) > 7) {
            if (typeof showSection === 'function') showSection('premium');
        } else {
            window.openProModal();
        }
    }

    // A line on top of the Premium window when the account is already Premium (renewal)
    function renderModalStatus() {
        const box = document.getElementById('pro-modal-status');
        if (!box) return;
        if (state.premium && state.currentPeriodEnd) {
            box.innerHTML = `<i class="fas fa-circle-check"></i> ${t('Premium actif jusqu\'au')} <b>${fmtDate(state.currentPeriodEnd)}</b>. ${t('Une nouvelle période s\'ajoute à la suite, sans perdre de jours.')}`;
            box.hidden = false;
        } else {
            box.hidden = true;
        }
    }

    // ------------------------------------------------------------ checkout
    async function subscribePlan(plan, btn) {
        const button = btn || (window.event && window.event.target && window.event.target.closest('button'));
        const original = button ? button.innerHTML : '';
        if (!token()) { showToast(t('Connectez-vous à votre compte pour passer à Premium.'), 'error'); return; }
        try {
            if (button) { button.disabled = true; button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('Chargement…')}`; }
            const res = await fetch(`${getApiBase()}/api/stripe/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token(), plan, source: isApp ? 'app' : 'web' })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.url) throw new Error(data.error || t('Le paiement est indisponible pour le moment.'));
            if (isApp) {
                await api.openExternal(data.url);
                waitForPayment(true);
            } else {
                window.location.href = data.url;
                return; // the page leaves
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: t('Paiement impossible'), text: err.message });
        }
        if (button) { button.disabled = false; button.innerHTML = original; }
    }

    // Waits for the webhook to record the payment, then unlocks everything
    function waitForPayment(fromApp) {
        const before = state.premium ? state.currentPeriodEnd : null;
        const startedAt = Date.now();
        window.closeProModal && window.closeProModal();
        Swal.fire({
            title: fromApp ? t('Finalisez le paiement dans votre navigateur') : t('Paiement reçu'),
            html: `<p>${fromApp ? t('La page de paiement sécurisée Stripe vient de s\'ouvrir. Revenez ici une fois le paiement validé.') : t('Activation de votre Premium en cours…')}</p>
                   <div class="spinner-border text-warning my-2" role="status"></div>
                   <p class="small text-secondary mb-0">${t('Premium s\'active automatiquement, sans redémarrer.')}</p>`,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: t('Fermer'),
            allowOutsideClick: false
        }).then((r) => { if (r.dismiss) stopPolling(); });

        stopPolling();
        pollTimer = setInterval(async () => {
            let s = null;
            try { s = await fetchStatus(); } catch (e) { return; }
            const activated = s && s.premium && (!before || s.currentPeriodEnd !== before);
            if (activated) {
                stopPolling();
                apply(s);
                if (typeof fetchData === 'function') fetchData();
                Swal.fire({
                    icon: 'success',
                    title: t('Gentok Premium est activé !'),
                    html: `${t('Merci pour votre soutien.')}<br>${t("Votre offre est active jusqu'au")} <b>${fmtDate(s.currentPeriodEnd)}</b>.`
                });
            } else if (Date.now() - startedAt > POLL_MAX_MS) {
                stopPolling();
                Swal.fire({ icon: 'info', title: t('Paiement pas encore reçu'), text: t('Si vous avez payé, Premium s\'activera dans quelques minutes. Sinon, vous pouvez réessayer depuis le bouton Premium.') });
            }
        }, POLL_MS);
    }

    function stopPolling() {
        clearInterval(pollTimer);
        pollTimer = null;
    }

    // ------------------------------------------------------------ return from Stripe (website)
    function handleReturn() {
        const p = new URLSearchParams(window.location.search).get('payment');
        if (!p) return;
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        if (p === 'success') waitForPayment(false);
        else if (p === 'cancel') showToast(t('Paiement annulé, rien n\'a été débité.'), 'info');
    }

    function hookSocket() {
        const sock = window.socket;
        if (!sock || sock.__premiumHooked) return;
        sock.__premiumHooked = true;
        sock.on('premium_updated', () => {
            refresh();
            if (typeof fetchData === 'function') fetchData();
        });
    }

    function start() {
        const el = document.getElementById('pro-banner');
        if (el) el.addEventListener('click', onBannerClick);
        handleReturn();
        refresh();
        setInterval(refresh, 10 * 60 * 1000);
        hookSocket();
        setInterval(hookSocket, 5000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.subscribePlan = subscribePlan;
    window.GentokPremium = { render, refresh, subscribePlan, waitForPayment, state };
})();
