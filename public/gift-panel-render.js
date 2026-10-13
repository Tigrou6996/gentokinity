/**
 * "Panneau cadeaux" (Overlay Custom): a grid telling viewers which gift triggers which action, e.g. Rose → TNT.
 * One renderer for the editor (public/overlay-maker/) and the OBS overlay (/overlay/giftpanel), so what the
 * streamer designs is exactly what goes on the live.
 *
 *   GiftPanel.normalize(raw)          -> a complete, safe panel object
 *   GiftPanel.render(el, panel, opts) -> draws it in el (opts.editable: clicks call opts.onItem(i, part))
 *   GiftPanel.highlight(el, gift)     -> the matching cell lights up (a gift was just sent in the live)
 */
(function () {
    const THEMES = {
        neon:     { label: 'Néon',       bg: { mode: 'color', color: '#0b0d14', color2: '#1a0f2e' }, card: 'rgba(255,255,255,.06)', border: 'rgba(255,255,255,.10)', color1: '#ffffff', color2: '#25f4ee', accent: '#fe2c55' },
        tiktok:   { label: 'TikTok',     bg: { mode: 'gradient', color: '#120a14', color2: '#071a1c' }, card: 'rgba(0,0,0,.35)', border: 'rgba(37,244,238,.35)', color1: '#ffffff', color2: '#fe2c55', accent: '#25f4ee' },
        candy:    { label: 'Bonbon',     bg: { mode: 'gradient', color: '#ff7ab6', color2: '#7c5cff' }, card: 'rgba(255,255,255,.18)', border: 'rgba(255,255,255,.35)', color1: '#ffffff', color2: '#fff3a8', accent: '#ffffff' },
        gold:     { label: 'Or',         bg: { mode: 'color', color: '#100d06', color2: '#2a1f08' }, card: 'rgba(251,191,36,.08)', border: 'rgba(251,191,36,.35)', color1: '#fff7e0', color2: '#fbbf24', accent: '#fbbf24' },
        light:    { label: 'Clair',      bg: { mode: 'color', color: '#f4f5f8', color2: '#e6e8ef' }, card: '#ffffff', border: 'rgba(0,0,0,.08)', color1: '#14161c', color2: '#fe2c55', accent: '#fe2c55' },
        clear:    { label: 'Transparent', bg: { mode: 'transparent', color: '#000000', color2: '#000000' }, card: 'rgba(0,0,0,.45)', border: 'rgba(255,255,255,.12)', color1: '#ffffff', color2: '#25f4ee', accent: '#fe2c55' }
    };

    const DEFAULT = {
        version: 2,
        title: 'Envoie un cadeau pour…',
        items: [],
        layout: { columns: 4, iconSize: 72, gap: 14, padding: 24, card: 'tile', showCoins: true, radius: 16, showTitle: true },
        style: { theme: 'neon', font: 'Outfit', color1: '#ffffff', color2: '#25f4ee', accent: '#fe2c55', cardColor: 'rgba(255,255,255,.06)', borderColor: 'rgba(255,255,255,.10)',
            size1: 15, size2: 18, uppercase: true, outline: 0, outlineColor: '#000000' },
        background: { mode: 'color', color: '#0b0d14', color2: '#1a0f2e', image: '', darkness: 0.35, blur: 0 }
    };

    const clamp = (v, min, max, def) => { v = Number(v); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };
    const str = (v, max, def = '') => (typeof v === 'string' ? v.slice(0, max) : def);
    const color = (v, def) => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v.trim()) ? v.trim() : def);
    const safeUrl = (v) => {
        if (typeof v !== 'string' || !v) return '';
        if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(v)) return v.length <= 450000 ? v : '';
        try { const u = new URL(v, location.origin); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch (e) { return ''; }
    };
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function normalize(raw) {
        const p = raw && typeof raw === 'object' ? raw : {};
        const L = p.layout || {}, S = p.style || {}, B = p.background || {};
        const d = DEFAULT;
        return {
            version: 2,
            title: str(p.title, 80, d.title),
            items: (Array.isArray(p.items) ? p.items : []).slice(0, 60).map(it => ({
                giftId: it && it.giftId != null ? String(it.giftId).slice(0, 20) : '',
                name: str(it && it.name, 40),
                icon: safeUrl(it && it.icon),
                coins: clamp(it && it.coins, 0, 1e6, 0),
                text1: str(it && it.text1, 40),
                text2: str(it && it.text2, 50),
                badge: str(it && it.badge, 16)
            })),
            layout: {
                columns: clamp(L.columns, 1, 10, d.layout.columns), iconSize: clamp(L.iconSize, 32, 160, d.layout.iconSize),
                gap: clamp(L.gap, 0, 60, d.layout.gap), padding: clamp(L.padding, 0, 120, d.layout.padding),
                card: ['tile', 'row', 'minimal'].includes(L.card) ? L.card : d.layout.card,
                showCoins: L.showCoins !== undefined ? !!L.showCoins : d.layout.showCoins,
                showTitle: L.showTitle !== undefined ? !!L.showTitle : d.layout.showTitle,
                radius: clamp(L.radius, 0, 40, d.layout.radius)
            },
            style: {
                theme: THEMES[S.theme] ? S.theme : d.style.theme,
                font: str(S.font, 40, d.style.font).replace(/[^\w\s-]/g, '') || d.style.font,
                color1: color(S.color1, d.style.color1), color2: color(S.color2, d.style.color2), accent: color(S.accent, d.style.accent),
                cardColor: color(S.cardColor, d.style.cardColor), borderColor: color(S.borderColor, d.style.borderColor),
                size1: clamp(S.size1, 9, 40, d.style.size1), size2: clamp(S.size2, 9, 48, d.style.size2),
                uppercase: S.uppercase !== undefined ? !!S.uppercase : d.style.uppercase,
                outline: clamp(S.outline, 0, 6, d.style.outline), outlineColor: color(S.outlineColor, d.style.outlineColor)
            },
            background: {
                mode: ['transparent', 'color', 'gradient', 'image'].includes(B.mode) ? B.mode : d.background.mode,
                color: color(B.color, d.background.color), color2: color(B.color2, d.background.color2),
                image: safeUrl(B.image), darkness: clamp(B.darkness, 0, 0.9, d.background.darkness), blur: clamp(B.blur, 0, 20, d.background.blur)
            }
        };
    }

    // A theme sets colours and background; the layout and the items stay
    function applyTheme(panel, key) {
        const t = THEMES[key];
        if (!t) return panel;
        panel.style = { ...panel.style, theme: key, color1: t.color1, color2: t.color2, accent: t.accent, cardColor: t.card, borderColor: t.border };
        panel.background = { ...panel.background, mode: panel.background.mode === 'image' ? 'image' : t.bg.mode, color: t.bg.color, color2: t.bg.color2 };
        return panel;
    }

    const GOOGLE = ['Outfit', 'Inter', 'Poppins', 'Montserrat', 'Rubik', 'Oswald', 'Bebas Neue', 'Anton', 'Luckiest Guy', 'Bangers', 'Bungee',
        'Russo One', 'Righteous', 'Fredoka', 'Baloo 2', 'Orbitron', 'Audiowide', 'Exo 2', 'Press Start 2P', 'Permanent Marker', 'Silkscreen', 'Space Grotesk'];
    const loadedFonts = new Set();
    function loadFont(font) {
        if (!font || loadedFonts.has(font) || !GOOGLE.includes(font)) return;
        loadedFonts.add(font);
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;600;700;800;900&display=swap`;
        document.head.appendChild(link);
    }

    // readable text on top of a colour (badge, "who sent it" bubble)
    function onColor(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
        if (!m) return '#ffffff';
        const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
        return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#14161c' : '#ffffff';
    }

    function render(el, raw, opts = {}) {
        const p = normalize(raw);
        const L = p.layout, S = p.style, B = p.background;
        loadFont(S.font);
        el.classList.add('gp');
        el.dataset.card = L.card;
        const vars = {
            '--gp-cols': Math.max(1, Math.min(L.columns, p.items.length || L.columns)), '--gp-icon': `${L.iconSize}px`, '--gp-gap': `${L.gap}px`, '--gp-pad': `${L.padding}px`, '--gp-radius': `${L.radius}px`,
            '--gp-c1': S.color1, '--gp-c2': S.color2, '--gp-accent': S.accent, '--gp-on-accent': onColor(S.accent), '--gp-card': S.cardColor, '--gp-border': S.borderColor,
            '--gp-s1': `${S.size1}px`, '--gp-s2': `${S.size2}px`, '--gp-font': `'${S.font}', 'Outfit', system-ui, sans-serif`,
            '--gp-case': S.uppercase ? 'uppercase' : 'none',
            '--gp-stroke': S.outline > 0 ? `${S.outline}px ${S.outlineColor}` : '0 transparent',
            '--gp-shadow': S.outline > 0 ? `0 0 ${S.outline + 1}px ${S.outlineColor}` : 'none',
            '--gp-dark': B.darkness, '--gp-blur': `${B.blur}px`
        };
        for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, String(v));
        const bg = B.mode === 'transparent' ? 'transparent'
            : B.mode === 'gradient' ? `linear-gradient(135deg, ${B.color}, ${B.color2})`
            : B.mode === 'image' && B.image ? `${B.color}` : B.color;
        el.style.setProperty('--gp-bg', bg);
        el.dataset.bg = B.mode;

        const cells = p.items.map((it, i) => {
            const icon = it.icon || '/logo.png';
            const coins = L.showCoins && it.coins ? `<span class="gp-coins">${it.coins.toLocaleString('fr-FR')}</span>` : '';
            const badge = it.badge ? `<span class="gp-badge">${esc(it.badge)}</span>` : '';
            return `<div class="gp-cell" data-i="${i}" data-gift="${esc(it.giftId)}" data-name="${esc((it.name || it.text1).toLowerCase())}">
                <div class="gp-icon"${opts.editable ? ' data-part="icon"' : ''}><img src="${esc(icon)}" alt="" referrerpolicy="no-referrer" onerror="this.src='/logo.png'">${badge}</div>
                <div class="gp-texts"${opts.editable ? ' data-part="text"' : ''}>
                    <div class="gp-t1">${esc(it.text1 || it.name || '')}${coins}</div>
                    <div class="gp-t2">${esc(it.text2 || '')}</div>
                </div>
            </div>`;
        }).join('');
        const empty = opts.editable && !p.items.length ? `<div class="gp-empty">Ajoutez des cadeaux, ou importez vos événements « cadeau »</div>` : '';
        el.innerHTML = `${B.mode === 'image' && B.image ? `<div class="gp-bgimg" style="background-image:url('${esc(B.image)}')"></div>` : ''}
            ${L.showTitle && p.title ? `<div class="gp-title">${esc(p.title)}</div>` : ''}
            <div class="gp-grid">${cells}${empty}</div>`;

        if (opts.editable && typeof opts.onItem === 'function' && !el._gpBound) {
            el._gpBound = true;
            el.addEventListener('click', (e) => {
                const cell = e.target.closest('.gp-cell');
                if (!cell) return;
                const part = e.target.closest('[data-part]');
                el._gpOpts.onItem(Number(cell.dataset.i), part ? part.dataset.part : 'text');
            });
        }
        el._gpOpts = opts;
        return p;
    }

    // A gift arrived in the live: the cell of that gift lights up for a moment
    function highlight(el, gift = {}) {
        const id = gift.giftId != null ? String(gift.giftId) : '';
        const name = String(gift.giftName || '').toLowerCase();
        const cells = Array.from(el.querySelectorAll('.gp-cell')).filter(c => (id && c.dataset.gift === id) || (name && c.dataset.name === name));
        for (const c of cells) {
            c.classList.remove('gp-hit');
            void c.offsetWidth; // restart the animation
            c.classList.add('gp-hit');
            clearTimeout(c._gpTimer);
            c._gpTimer = setTimeout(() => c.classList.remove('gp-hit'), 2600);
            if (gift.nickname) {
                const who = document.createElement('div');
                who.className = 'gp-who';
                who.textContent = gift.nickname;
                c.appendChild(who);
                setTimeout(() => who.remove(), 2600);
            }
        }
        return cells.length;
    }

    window.GiftPanel = { THEMES, DEFAULT, normalize, applyTheme, render, highlight, GOOGLE_FONTS: GOOGLE };
})();
