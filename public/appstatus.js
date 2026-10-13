/**
 * Desktop application detection and updates.
 *
 * - In the Windows app: shows the installed version and the auto-updater state (checking,
 *   downloading x %, ready, up to date) and lets the streamer check for updates by hand.
 * - On the website: detects the app connected to the account (through the server) or open on this PC
 *   (http://localhost:3000/api/app/ping), and says when the installed version is out of date.
 * The badge sits in the header; Settings > Application & mises à jour shows the details.
 * Uses globals of app.js: getApiBase, showToast.
 */
(function () {
    const t = (s) => (window.GentokI18n ? window.GentokI18n.t(s) : s);
    const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const api = window.electronAPI;
    const isApp = !!(api && api.getUpdateState);
    const LOCAL_PING = 'http://localhost:3000/api/app/ping';
    const DOWNLOAD_URL = 'https://tiktok.gentok.fr/download';

    const state = {
        // app mode
        update: null,
        current: null,
        // web mode
        server: null,   // /api/app/status
        local: null     // { version } when the app answers on localhost
    };

    function badge() {
        let el = document.getElementById('app-status-badge');
        if (!el) {
            const header = document.querySelector('header .user-control');
            if (!header) return null;
            el = document.createElement('button');
            el.id = 'app-status-badge';
            el.type = 'button';
            el.className = 'app-badge';
            el.addEventListener('click', () => { if (typeof showSection === 'function') showSection('settings'); setTimeout(() => document.getElementById('app-update-card')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300); });
            header.prepend(el);
            // the old "Télécharger App" link is replaced by this badge
            document.getElementById('btn-download-app')?.remove();
        }
        return el;
    }

    function view() {
        if (isApp) {
            const u = state.update || {};
            const v = state.current ? `v${state.current}` : '';
            switch (u.status) {
                case 'checking': return { tone: 'info', icon: 'fa-rotate fa-spin', text: t('Recherche de mises à jour…'), detail: v };
                case 'downloading': return { tone: 'warn', icon: 'fa-download', text: `${t('Mise à jour')} v${u.version || ''} · ${u.percent || 0}%`, detail: t('Téléchargement en cours, Gentok redémarrera tout seul.') };
                case 'downloaded': return { tone: 'warn', icon: 'fa-rotate', text: `${t('Installation de la')} v${u.version || ''}`, detail: t('Gentok va redémarrer pour installer la mise à jour.') };
                case 'error': return { tone: 'muted', icon: 'fa-triangle-exclamation', text: `${t('Application')} ${v}`, detail: t('Impossible de vérifier les mises à jour pour le moment.') };
                case 'dev': return { tone: 'muted', icon: 'fa-code', text: `${t('Application')} ${v}`, detail: t('Version de développement : les mises à jour automatiques sont désactivées.') };
                default: return { tone: 'ok', icon: 'fa-circle-check', text: `${t('Application')} ${v}`, detail: t('Application à jour.') };
            }
        }
        const s = state.server || {};
        if (s.connected) {
            if (s.updateAvailable) return { tone: 'warn', icon: 'fa-circle-up', text: `${t('Application')} v${s.version} · ${t('mise à jour')} v${s.latestVersion}`, detail: t("L'application se met à jour toute seule au prochain démarrage. Vous pouvez aussi la retélécharger.") };
            return { tone: 'ok', icon: 'fa-desktop', text: `${t('Application connectée')}${s.version ? ` · v${s.version}` : ''}`, detail: t("L'application Windows est connectée à votre compte : les actions clavier, OBS et Minecraft passent par elle.") };
        }
        if (state.local) return { tone: 'info', icon: 'fa-desktop', text: `${t('Application ouverte sur ce PC')}${state.local.version ? ` · v${state.local.version}` : ''}`, detail: t("Gentok est ouvert sur cet ordinateur mais pas connecté à ce compte. Connectez-vous dans l'application avec le même compte.") };
        return { tone: 'muted', icon: 'fa-download', text: t('Application non détectée'), detail: t("L'application Windows est nécessaire pour les actions clavier, OBS et Minecraft."), download: true };
    }

    function render() {
        const v = view();
        const el = badge();
        if (el) {
            el.className = `app-badge tone-${v.tone}`;
            el.innerHTML = `<i class="fas ${v.icon}"></i><span>${esc(v.text)}</span>`;
            el.title = v.detail;
        }
        const card = document.getElementById('app-update-body');
        if (card) {
            const latest = isApp ? (state.update && state.update.version) : (state.server && state.server.latestVersion);
            card.innerHTML = `
                <div class="app-update-row"><span class="app-dot tone-${v.tone}"></span><div><b>${esc(v.text)}</b><div class="text-dim small">${esc(v.detail)}</div></div></div>
                <dl class="app-update-facts">
                    <dt>${esc(t('Version installée'))}</dt><dd>${esc(isApp ? (state.current || '—') : ((state.server && state.server.version) || (state.local && state.local.version) || '—'))}</dd>
                    <dt>${esc(t('Dernière version'))}</dt><dd>${esc(latest || (state.server && state.server.latestVersion) || '—')}</dd>
                    ${isApp && state.update && state.update.checkedAt ? `<dt>${esc(t('Dernière vérification'))}</dt><dd>${new Date(state.update.checkedAt).toLocaleTimeString()}</dd>` : ''}
                </dl>
                ${isApp && state.update && state.update.status === 'downloading' ? `<div class="progress app-progress"><div class="progress-bar" style="width:${state.update.percent || 0}%"></div></div>` : ''}
                <div class="app-update-actions">
                    ${isApp ? `<button type="button" class="btn btn-sm btn-outline-light" id="btn-check-updates"><i class="fas fa-rotate"></i> ${esc(t('Rechercher des mises à jour'))}</button>`
                        : `<a class="btn btn-sm btn-outline-light" href="${DOWNLOAD_URL}" target="_blank" rel="noopener"><i class="fas fa-download"></i> ${esc(t("Télécharger l'application"))}</a>
                           <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-detect-app"><i class="fas fa-magnifying-glass"></i> ${esc(t('Détecter à nouveau'))}</button>`}
                </div>`;
            document.getElementById('btn-check-updates')?.addEventListener('click', checkNow);
            document.getElementById('btn-detect-app')?.addEventListener('click', () => { detectWeb(true); });
        }
    }

    async function checkNow() {
        const btn = document.getElementById('btn-check-updates');
        if (btn) btn.disabled = true;
        try {
            state.update = await api.checkForUpdates();
            render();
            const st = state.update && state.update.status;
            if (st === 'up-to-date') showToast(t('Gentok est à jour.'), 'success');
            else if (st === 'downloading') showToast(t('Une mise à jour est en cours de téléchargement.'), 'success');
            else if (st === 'dev') showToast(t('Version de développement : pas de mise à jour automatique.'), 'info');
            else if (st === 'error') showToast(t('Impossible de vérifier les mises à jour pour le moment.'), 'error');
        } catch (e) {
            showToast('❌ ' + e.message, 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function pingLocal() {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 1500);
            const r = await fetch(LOCAL_PING, { signal: ctrl.signal, cache: 'no-store' });
            clearTimeout(timer);
            const d = await r.json();
            return d && d.app ? { version: d.version } : null;
        } catch (e) {
            return null;
        }
    }

    async function detectWeb(manual) {
        const token = localStorage.getItem('gentok_token') || '';
        try {
            const r = await fetch(`${getApiBase()}/api/app/status?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
            state.server = await r.json();
        } catch (e) { /* keep the last known state */ }
        // localhost is only asked when the account has no app connected (no need otherwise)
        state.local = state.server && state.server.connected ? null : await pingLocal();
        render();
        if (manual) showToast(view().text, 'success');
    }

    function initApp() {
        api.getAppVersion().then(v => { state.current = v; render(); }).catch(() => { });
        api.getUpdateState().then(s => { state.update = s; render(); }).catch(() => { });
        api.onUpdateState(s => { state.update = s; render(); });
    }

    function initWeb() {
        detectWeb(false);
        setInterval(() => detectWeb(false), 30000);
        // live changes pushed by the server when the app connects / disconnects
        const hook = () => {
            if (!window.socket || window.socket.__appInfoHooked) return;
            window.socket.__appInfoHooked = true;
            window.socket.on('app_info', () => detectWeb(false));
        };
        hook();
        setInterval(hook, 5000);
    }

    // Every "version" label of the page shows the real number (app version, or the published one on the website)
    async function fillVersionLabels() {
        let v = null;
        try { v = isApp ? await api.getAppVersion() : (await (await fetch(`${getApiBase()}/api/version`, { cache: 'no-store' })).json()).version; } catch (e) { }
        if (!v) return;
        document.querySelectorAll('.gentok-version').forEach(el => { el.textContent = v; });
        const d = document.getElementById('app-version-display');
        if (d && !isApp) d.textContent = `Gentok v${v}`;
    }

    function start() {
        fillVersionLabels();
        if (isApp) initApp(); else initWeb();
        render();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.GentokAppStatus = { render, checkNow, detect: () => detectWeb(true) };
})();
