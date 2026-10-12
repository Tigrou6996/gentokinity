/**
 * "Donateurs présents" panel: viewers in the live sorted by what they already gave to the streamer.
 * Live data comes from the socket (donors_update / donor_arrived, see src/features/donors.js).
 * Uses globals of app.js: getApiBase, getLocalApiBase, escapeHtml, showToast, playAlert.
 */
(function () {
    const t = (s) => (window.GentokI18n ? window.GentokI18n.t(s) : s);
    const isApp = !!window.electronAPI || navigator.userAgent.toLowerCase().includes('electron');
    const KEY_MIN = 'gentok_donors_alert_min';
    const KEY_ONLY = 'gentok_donors_only';
    const TIER_ICON = { whale: '🐋', big: '💎', supporter: '⭐', small: '🎁', new: '👋' };

    let data = { viewers: [], present: 0, donors: 0, totalCoins: 0 };
    const store = {
        get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
    };
    const token = () => store.get('gentok_token', '');
    const alertMin = () => Math.max(0, parseInt(document.getElementById('donors-alert-min')?.value, 10) || 0);
    const fmt = (n) => Number(n || 0).toLocaleString();
    const ago = (ts) => {
        const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
        return s < 60 ? `${s}s` : `${Math.floor(s / 60)} min`;
    };

    function render() {
        const stats = document.getElementById('donors-stats');
        const list = document.getElementById('donors-list');
        if (!stats || !list) return;
        stats.innerHTML = `
            <div><span>${fmt(data.present)}</span>${escapeHtml(t('spectateurs actifs'))}</div>
            <div><span>${fmt(data.donors)}</span>${escapeHtml(t('donateurs présents'))}</div>
            <div><span>${fmt(data.totalCoins)}</span>${escapeHtml(t('pièces déjà offertes par eux'))}</div>`;
        const only = document.getElementById('donors-only')?.checked;
        const rows = (data.viewers || []).filter(v => !only || v.totalCoins > 0);
        if (!rows.length) {
            list.innerHTML = `<div class="donors-empty text-dim">${escapeHtml(t(data.present ? 'Aucun donateur parmi les spectateurs actifs pour le moment.' : 'Les spectateurs apparaissent ici dès qu\'ils arrivent, écrivent, likent ou offrent un cadeau pendant le live.'))}</div>`;
            return;
        }
        list.innerHTML = rows.map(v => `
            <div class="donor-row tier-${escapeHtml(v.tier)}">
                <img src="${escapeHtml(v.profilePictureUrl || '/logo.png')}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.src='/logo.png'">
                <div class="donor-name">
                    <b>${escapeHtml(v.nickname)}</b>
                    <small>@${escapeHtml(v.uniqueId)} · ${escapeHtml(t('vu il y a'))} ${ago(v.lastSeen)}</small>
                </div>
                <span class="donor-tier">${TIER_ICON[v.tier] || ''} ${escapeHtml(t(v.tierLabel))}</span>
                <div class="donor-coins">
                    <b>${v.known ? fmt(v.totalCoins) : '…'}</b>
                    <small>${v.liveCoins ? `+${fmt(v.liveCoins)} ${escapeHtml(t('ce live'))}` : escapeHtml(t('pièces offertes'))}</small>
                </div>
            </div>`).join('');
    }

    async function load() {
        if (!token()) return;
        const bases = isApp ? [getLocalApiBase(), getApiBase()] : [getApiBase()];
        for (const base of bases) {
            try {
                const r = await fetch(`${base}/api/donors?token=${encodeURIComponent(token())}&alertMin=${alertMin()}`, { cache: 'no-store' });
                if (!r.ok) continue;
                const d = await r.json();
                if (d && Array.isArray(d.viewers) && (d.present || base === bases[bases.length - 1])) { data = d; break; }
            } catch (e) { /* next base */ }
        }
        render();
    }

    function onArrived(v) {
        if (!v || v.totalCoins < alertMin()) return;
        showToast(`${TIER_ICON[v.tier] || '💎'} ${v.nickname} ${t('est dans le live')} · ${fmt(v.totalCoins)} ${t('pièces déjà offertes')}`, 'success');
        if (typeof playAlert === 'function') { try { playAlert('gift'); } catch (e) { } }
    }

    function hookSocket() {
        const sock = window.socket;
        if (!sock || sock.__donorsHooked) return;
        sock.__donorsHooked = true;
        sock.on('donors_update', (d) => { if (d && Array.isArray(d.viewers)) { data = d; render(); } });
        sock.on('donor_arrived', onArrived);
    }

    function start() {
        const min = document.getElementById('donors-alert-min');
        const only = document.getElementById('donors-only');
        if (!min || !only) return;
        min.value = store.get(KEY_MIN, '1000');
        only.checked = store.get(KEY_ONLY, 'false') === 'true';
        min.addEventListener('change', () => { store.set(KEY_MIN, String(alertMin())); load(); });
        only.addEventListener('change', () => { store.set(KEY_ONLY, String(only.checked)); render(); });

        const url = `https://tiktok.gentok.fr/overlay/donors?token=${encodeURIComponent(token())}&lang=${(window.GentokI18n && window.GentokI18n.lang) || 'fr'}`;
        const urlEl = document.getElementById('donors-overlay-url');
        if (urlEl) urlEl.textContent = url;
        document.getElementById('donors-copy')?.addEventListener('click', () => {
            navigator.clipboard.writeText(url).then(() => showToast(t('Lien copié !'), 'success')).catch(() => { });
        });

        load();
        render();
        hookSocket();
        setInterval(hookSocket, 5000);
        // "seen x s ago" stays current, and a quiet viewer leaves the list after 10 minutes
        setInterval(() => { if (document.getElementById('donors-section')?.style.display !== 'none') load(); }, 30000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.GentokDonors = { load, render };
})();
