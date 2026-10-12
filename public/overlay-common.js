// Shared helpers for the Gentok OBS overlays (/overlay/alerts, /overlay/chat, ...).
// Every overlay is configured with URL parameters, e.g. /overlay/goal?token=XXX&stat=follows&target=50
(function () {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Only http(s) and site-relative URLs may be used as image / video sources
    function safeUrl(value) {
        const url = String(value || '').trim();
        if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url;
        return '';
    }

    function param(name, def) {
        const v = params.get(name);
        return v === null || v === '' ? def : v;
    }

    function numParam(name, def) {
        const n = parseFloat(params.get(name));
        return Number.isFinite(n) ? n : def;
    }

    function boolParam(name, def) {
        const v = params.get(name);
        if (v === null || v === '') return def;
        return ['1', 'true', 'oui', 'yes', 'on'].includes(v.toLowerCase());
    }

    function listParam(name, def) {
        const v = params.get(name);
        if (v === null || v === '') return def;
        return v.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    }

    function colorParam(name, def) {
        const v = (params.get(name) || '').replace('#', '');
        return /^[0-9a-f]{3,8}$/i.test(v) ? `#${v}` : def;
    }

    function formatNumber(n) {
        n = Number(n) || 0;
        if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
        if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace('.0', '') + 'k';
        return n.toLocaleString('fr-FR');
    }

    function connect() {
        const socket = io({ transports: ['websocket', 'polling'] });
        socket.on('connect', () => {
            if (token) socket.emit('identify', { token, type: 'overlay' });
        });
        socket.on('remote_reload', () => window.location.reload());
        return socket;
    }

    function applyFont(font) {
        if (!font) return;
        const googleFonts = ['Luckiest Guy', 'Outfit', 'Bebas Neue', 'Orbitron', 'Press Start 2P', 'Inter', 'Roboto', 'Fasthand', 'Poppins', 'Montserrat'];
        if (googleFonts.includes(font)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}&display=swap`;
            document.head.appendChild(link);
            document.body.style.setProperty('font-family', `'${font}', sans-serif`, 'important');
        } else {
            const face = new FontFace(font, `url(https://gentok.fr/polices/${encodeURIComponent(font)}.ttf)`);
            face.load().then(f => {
                document.fonts.add(f);
                document.body.style.setProperty('font-family', `'${font}', sans-serif`, 'important');
            }).catch(() => { });
        }
    }

    // Small warning when the URL was copied without its token
    function warnIfNoToken() {
        if (token || boolParam('demo', false)) return;
        const div = document.createElement('div');
        div.textContent = '⚠️ Token manquant dans l\'URL de l\'overlay';
        div.style.cssText = 'position:fixed;top:8px;left:8px;padding:8px 12px;background:#b00020;color:#fff;font:600 14px sans-serif;border-radius:8px;z-index:9999';
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(div));
    }
    warnIfNoToken();

    const DEMO_USERS = [
        { uniqueId: 'lea.games', nickname: 'Léa 🎮' },
        { uniqueId: 'max_officiel', nickname: 'Max' },
        { uniqueId: 'sarah.tv', nickname: 'Sarah' },
        { uniqueId: 'tom_du_92', nickname: 'Tom' },
        { uniqueId: 'ines', nickname: 'Inès ✨' }
    ];
    function demoUser() {
        const u = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
        return { ...u, profilePictureUrl: '/logo.png' };
    }

    window.Gentok = {
        params, token, escapeHtml, safeUrl, param, numParam, boolParam, listParam, colorParam,
        formatNumber, connect, applyFont, demoUser, isDemo: boolParam('demo', false)
    };

    const font = params.get('font');
    if (font) document.addEventListener('DOMContentLoaded', () => applyFont(font));
})();
