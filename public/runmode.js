/**
 * Settings > Connexion au live: where the TikTok live connection runs.
 * - auto  : on the PC when the Gentok app is open (it gets the order from the server), otherwise in the cloud
 * - cloud : always on the Gentok servers (the app, if open, still runs the PC actions it receives)
 * - pc    : always in the Windows app (the start is refused with a clear message when it is closed)
 * In the app, "cloud" also makes the dashboard listen to the Gentok servers (where the live events come from).
 * Uses globals of app.js: getApiBase, showToast, connectToRemote, connectToLocal.
 */
(function () {
    const t = (s) => (window.GentokI18n ? window.GentokI18n.t(s) : s);
    const isApp = !!window.electronAPI || navigator.userAgent.toLowerCase().includes('electron');
    const token = () => { try { return localStorage.getItem('gentok_token') || ''; } catch (e) { return ''; } };
    const mode = () => window.gentokRunMode || 'auto';

    async function appConnected() {
        if (isApp) return true;
        try {
            const r = await fetch(`${getApiBase()}/api/app/status?token=${encodeURIComponent(token())}`, { cache: 'no-store' });
            return !!(await r.json()).connected;
        } catch (e) { return false; }
    }

    // In the app, the dashboard socket follows the mode (local engine, or the Gentok servers for "cloud")
    function syncAppSocket() {
        if (!isApp || !window.socket) return;
        const uri = (window.socket.io && window.socket.io.uri) || '';
        const onLocal = uri.includes('localhost');
        if (mode() === 'cloud' && onLocal && typeof connectToRemote === 'function') connectToRemote();
        else if (mode() !== 'cloud' && !onLocal && typeof connectToLocal === 'function') connectToLocal();
    }

    async function render() {
        document.querySelectorAll('input[name="runmode"]').forEach(r => { r.checked = r.value === mode(); });
        const box = document.getElementById('runmode-status');
        if (box) {
            const app = await appConnected();
            let html;
            if (mode() === 'cloud') html = `<i class="fas fa-cloud text-info"></i> ${t('Votre prochain live se connectera depuis les serveurs Gentok.')}${app ? ' ' + t("L'application ouverte exécutera quand même les actions PC (clavier, OBS, Minecraft).") : ''}`;
            else if (mode() === 'pc') html = app ? `<i class="fas fa-desktop text-success"></i> ${t('Application détectée : le live se connectera depuis votre PC.')}`
                : `<i class="fas fa-triangle-exclamation text-warning"></i> ${t("Application non détectée : ouvrez Gentok sur votre PC avant de lancer le live (ou choisissez Cloud).")}`;
            else html = app ? `<i class="fas fa-desktop text-success"></i> ${t('Application détectée : le live se connectera depuis votre PC.')}`
                : `<i class="fas fa-cloud text-info"></i> ${t("Application non détectée : le live se connectera depuis les serveurs Gentok.")}`;
            box.innerHTML = html;
        }
        syncAppSocket();
    }

    async function save(value) {
        const previous = mode();
        window.gentokRunMode = value;
        try {
            const r = await fetch(`${getApiBase()}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token(), runMode: value })
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const running = typeof isBotRunningUI === 'function' && isBotRunningUI();
            showToast(running ? t('Enregistré : appliqué au prochain lancement du live.') : t('Mode de connexion enregistré.'), 'success');
        } catch (e) {
            window.gentokRunMode = previous;
            showToast(t('Enregistrement impossible, réessayez.'), 'error');
        }
        render();
    }

    function start() {
        document.querySelectorAll('input[name="runmode"]').forEach(r => r.addEventListener('change', () => { if (r.checked) save(r.value); }));
        render();
        setInterval(() => { if (document.getElementById('settings-section')?.style.display !== 'none') render(); }, 20000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.GentokRunMode = { render, save };
})();
