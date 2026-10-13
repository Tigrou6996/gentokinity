/**
 * Gentok · Panneau cadeaux (Overlay Custom)
 * Designs the grid "gift → action" shown to viewers. Saved on the Gentok server (shown live in OBS by
 * /overlay/giftpanel?token=...), exported as a PNG. Rendering: /gift-panel-render.js (shared with the overlay).
 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const token = (() => { try { return localStorage.getItem('gentok_token') || ''; } catch (e) { return ''; } })();
    const LOCAL_KEY = 'gentok_gift_panel_v2';
    const OLD_KEY = 'gentok_overlay_config_v12';
    let API = ''; // same origin, or the Gentok server when opened from the Windows app (which has no data)
    let panel = GiftPanel.normalize({});
    let gifts = []; // catalogue: { id, name, icon, price }
    let pickerTarget = null; // index of the item whose gift is being chosen, or -1 to add one
    let zoom = 'fit';

    // ---------- small helpers ----------
    function toast(msg, isErr) {
        const t = $('toast');
        t.textContent = msg;
        t.className = `toast show${isErr ? ' err' : ''}`;
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => { t.className = 'toast'; }, 2600);
    }
    function setSaveState(text, cls) { const s = $('save-state'); s.textContent = text; s.className = `save-state ${cls || ''}`; }
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    async function api(path, opts) {
        const r = await fetch(`${API}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`, { cache: 'no-store', ...(opts || {}) });
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error((data && (data.error || data.message)) || `Erreur ${r.status}`);
        return data;
    }

    // ---------- save (debounced): on the server for OBS, and in the browser as a backup ----------
    let saveTimer = null;
    function changed() {
        draw();
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(panel)); } catch (e) { /* image too big for the browser storage */ }
        if (!token) { setSaveState('Connectez-vous au tableau de bord pour enregistrer en ligne', 'err'); return; }
        setSaveState('Enregistrement…');
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            try {
                await api('/api/gift-panel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, panel }) });
                setSaveState('Enregistré ✓', 'ok');
            } catch (e) {
                setSaveState(`Non enregistré : ${e.message}`, 'err');
            }
        }, 700);
    }

    // ---------- render ----------
    function draw() {
        GiftPanel.render($('panel'), panel, { editable: true, onItem: (i, part) => (part === 'icon' ? openPicker(i) : focusItem(i)) });
        fitZoom();
    }
    function fitZoom() {
        const el = $('panel'), box = $('canvas');
        el.style.transform = '';
        if (zoom !== 'fit') return;
        const s = Math.min(1, (box.clientWidth - 64) / el.offsetWidth, (box.clientHeight - 64) / el.offsetHeight);
        if (s < 1) el.style.transform = `scale(${s})`;
    }
    window.addEventListener('resize', fitZoom);

    function renderItems() {
        const ol = $('items');
        $('count').textContent = `(${panel.items.length}/60)`;
        ol.innerHTML = panel.items.map((it, i) => `
            <li class="item" draggable="true" data-i="${i}">
                <span class="grip" title="Glisser pour déplacer"><i class="fas fa-grip-vertical"></i></span>
                <button class="thumb" data-act="pick" title="Changer de cadeau"><img src="${esc(it.icon || '/logo.png')}" alt="" referrerpolicy="no-referrer" onerror="this.src='/logo.png'"></button>
                <div class="texts">
                    <input type="text" class="t1" data-k="text1" maxlength="40" value="${esc(it.text1)}" placeholder="${esc(it.name || 'Cadeau')}" aria-label="Nom affiché">
                    <input type="text" class="t2" data-k="text2" maxlength="50" value="${esc(it.text2)}" placeholder="Action (ex : TNT)" aria-label="Action">
                    <input type="text" class="badge" data-k="badge" maxlength="16" value="${esc(it.badge)}" placeholder="x1" title="Pastille (facultatif, ex : x5)" aria-label="Pastille">
                </div>
                <button class="del" data-act="del" title="Retirer"><i class="fas fa-trash"></i></button>
            </li>`).join('');
    }
    function focusItem(i) {
        switchTab('items');
        const input = document.querySelector(`.item[data-i="${i}"] .t2`);
        if (input) { input.focus(); input.select(); }
    }

    // ---------- settings controls ----------
    const RANGES = { columns: 'layout', iconSize: 'layout', gap: 'layout', padding: 'layout', radius: 'layout', size1: 'style', size2: 'style', outline: 'style', darkness: 'background', blur: 'background' };
    const UNITS = { iconSize: 'px', gap: 'px', padding: 'px', radius: 'px', size1: 'px', size2: 'px', outline: 'px', blur: 'px' };
    function syncControls() {
        $('f-title').value = panel.title;
        $('f-showTitle').checked = panel.layout.showTitle;
        $('f-showCoins').checked = panel.layout.showCoins;
        $('f-uppercase').checked = panel.style.uppercase;
        for (const [k, group] of Object.entries(RANGES)) {
            $(`f-${k}`).value = panel[group][k];
            $(`v-${k}`).textContent = k === 'darkness' ? `${Math.round(panel[group][k] * 100)} %` : `${panel[group][k]}${UNITS[k] || ''}`;
        }
        for (const k of ['color1', 'color2', 'accent', 'outlineColor']) $(`f-${k}`).value = toHex(panel.style[k]);
        $('f-bgColor').value = toHex(panel.background.color);
        $('f-bgColor2').value = toHex(panel.background.color2);
        $('f-font').value = panel.style.font;
        setSeg('f-card', panel.layout.card);
        setSeg('f-bgmode', panel.background.mode);
        document.querySelectorAll('.theme').forEach(b => b.classList.toggle('on', b.dataset.theme === panel.style.theme));
        const m = panel.background.mode;
        $('bg-colors').style.display = m === 'color' || m === 'gradient' ? '' : 'none';
        $('f-bgColor2').parentElement.style.display = m === 'gradient' ? '' : 'none';
        for (const id of ['bg-image-field', 'bg-dark-field', 'bg-blur-field']) $(id).style.display = m === 'image' ? '' : 'none';
    }
    function toHex(c) {
        if (/^#[0-9a-f]{6}$/i.test(c)) return c;
        if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map(x => x + x).join('');
        const m = String(c).match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
        return m ? '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('') : '#000000';
    }
    function setSeg(id, v) { $(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); }
    function switchTab(name) {
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        document.querySelectorAll('.pane').forEach(p => p.classList.toggle('active', p.dataset.pane === name));
    }

    function bind() {
        document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
        $('f-title').addEventListener('input', (e) => { panel.title = e.target.value; changed(); });
        $('f-showTitle').addEventListener('change', (e) => { panel.layout.showTitle = e.target.checked; changed(); });
        $('f-showCoins').addEventListener('change', (e) => { panel.layout.showCoins = e.target.checked; changed(); });
        $('f-uppercase').addEventListener('change', (e) => { panel.style.uppercase = e.target.checked; changed(); });
        for (const [k, group] of Object.entries(RANGES)) {
            $(`f-${k}`).addEventListener('input', (e) => { panel[group][k] = Number(e.target.value); syncControls(); changed(); });
        }
        for (const k of ['color1', 'color2', 'accent', 'outlineColor']) $(`f-${k}`).addEventListener('input', (e) => { panel.style[k] = e.target.value; changed(); });
        $('f-bgColor').addEventListener('input', (e) => { panel.background.color = e.target.value; changed(); });
        $('f-bgColor2').addEventListener('input', (e) => { panel.background.color2 = e.target.value; changed(); });
        $('f-font').addEventListener('change', (e) => { panel.style.font = e.target.value; changed(); });
        $('f-card').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; panel.layout.card = b.dataset.v; syncControls(); changed(); });
        $('f-bgmode').addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b) return;
            panel.background.mode = b.dataset.v;
            if (b.dataset.v === 'image' && !panel.background.image) $('f-bgfile').click();
            syncControls(); changed();
        });
        $('zoom').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; zoom = b.dataset.v; setSeg('zoom', zoom); fitZoom(); });

        // themes
        $('themes').innerHTML = Object.entries(GiftPanel.THEMES).map(([k, t]) => {
            const bg = t.bg.mode === 'transparent' ? 'repeating-conic-gradient(#2a2f3a 0 25%, #1c2028 0 50%) 0 0 / 14px 14px'
                : t.bg.mode === 'gradient' ? `linear-gradient(135deg, ${t.bg.color}, ${t.bg.color2})` : `linear-gradient(135deg, ${t.bg.color}, ${t.bg.color2})`;
            return `<button class="theme" data-theme="${k}" style="background:${bg}"><span style="color:${t.color2}">${esc(t.label)}</span></button>`;
        }).join('');
        $('themes').addEventListener('click', (e) => {
            const b = e.target.closest('.theme'); if (!b) return;
            GiftPanel.applyTheme(panel, b.dataset.theme); syncControls(); changed();
        });
        $('f-font').innerHTML = GiftPanel.GOOGLE_FONTS.map(f => `<option value="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</option>`).join('');

        // gift list: edit texts, change / remove gifts, drag to reorder
        const ol = $('items');
        ol.addEventListener('input', (e) => {
            const li = e.target.closest('.item'); const k = e.target.dataset.k;
            if (!li || !k) return;
            panel.items[Number(li.dataset.i)][k] = e.target.value;
            changed();
        });
        ol.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]'); if (!btn) return;
            const i = Number(btn.closest('.item').dataset.i);
            if (btn.dataset.act === 'pick') openPicker(i);
            if (btn.dataset.act === 'del') { panel.items.splice(i, 1); renderItems(); changed(); }
        });
        let dragFrom = null;
        ol.addEventListener('dragstart', (e) => {
            const li = e.target.closest('.item'); if (!li) return;
            if (e.target.matches('input')) { e.preventDefault(); return; }
            dragFrom = Number(li.dataset.i); li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move';
        });
        ol.addEventListener('dragover', (e) => {
            const li = e.target.closest('.item'); if (dragFrom === null || !li) return;
            e.preventDefault();
            ol.querySelectorAll('.drop-above').forEach(x => x.classList.remove('drop-above'));
            li.classList.add('drop-above');
        });
        ol.addEventListener('drop', (e) => {
            const li = e.target.closest('.item'); if (dragFrom === null || !li) return;
            e.preventDefault();
            const to = Number(li.dataset.i);
            const [moved] = panel.items.splice(dragFrom, 1);
            panel.items.splice(to > dragFrom ? to - 1 : to, 0, moved);
            dragFrom = null; renderItems(); changed();
        });
        ol.addEventListener('dragend', () => { dragFrom = null; ol.querySelectorAll('.dragging, .drop-above').forEach(x => x.classList.remove('dragging', 'drop-above')); });
        $('btn-add').addEventListener('click', () => openPicker(-1));

        // background image: resized in the browser so the panel stays light (≈ 450 KB max)
        $('btn-bgimg').addEventListener('click', () => $('f-bgfile').click());
        $('btn-bgimg-del').addEventListener('click', () => { panel.background.image = ''; panel.background.mode = 'color'; syncControls(); changed(); });
        $('f-bgfile').addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0]; e.target.value = '';
            if (!file) return;
            try {
                panel.background.image = await shrinkImage(file);
                panel.background.mode = 'image'; syncControls(); changed();
            } catch (err) { toast(err.message, true); }
        });

        // top actions
        $('btn-png').addEventListener('click', downloadPng);
        $('btn-obs').addEventListener('click', copyObsUrl);
        $('btn-import').addEventListener('click', importEvents);
        $('btn-test').addEventListener('click', () => {
            if (!panel.items.length) return toast('Ajoutez d\'abord un cadeau');
            const it = panel.items[Math.floor(Math.random() * panel.items.length)];
            GiftPanel.highlight($('panel'), { giftId: it.giftId, giftName: it.name, nickname: 'Léa' });
        });
        $('btn-reset').addEventListener('click', () => {
            if (!confirm('Recommencer un panneau vide ? Le panneau actuel sera remplacé.')) return;
            panel = GiftPanel.normalize({}); syncControls(); renderItems(); changed();
        });

        // picker
        $('picker-close').addEventListener('click', closePicker);
        $('picker').addEventListener('click', (e) => { if (e.target.id === 'picker') closePicker(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('picker').hidden) closePicker(); });
        $('picker-search').addEventListener('input', renderPicker);
        $('picker-sort').addEventListener('change', renderPicker);
        $('picker-grid').addEventListener('click', (e) => {
            const b = e.target.closest('.gift'); if (!b) return;
            const g = gifts.find(x => String(x.id) === b.dataset.id); if (!g) return;
            const fromGift = { giftId: String(g.id), name: g.name, icon: g.icon, coins: g.price || 0 };
            if (pickerTarget === -1) {
                if (panel.items.length >= 60) { toast('60 cadeaux maximum', true); return; }
                panel.items.push({ ...fromGift, text1: g.name, text2: '', badge: '' });
            } else {
                const it = panel.items[pickerTarget];
                const keepName = it.text1 && it.text1 !== it.name;
                Object.assign(it, fromGift, keepName ? {} : { text1: g.name });
            }
            closePicker(); renderItems(); changed();
            if (pickerTarget === -1) focusItem(panel.items.length - 1);
        });
    }

    function shrinkImage(file) {
        return new Promise((resolve, reject) => {
            if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return reject(new Error('Image PNG, JPG ou WEBP uniquement'));
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                const max = 1600;
                if (Math.max(w, h) > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
                const c = document.createElement('canvas'); c.width = w; c.height = h;
                c.getContext('2d').drawImage(img, 0, 0, w, h);
                let q = 0.85, data = c.toDataURL('image/jpeg', q);
                while (data.length > 440000 && q > 0.4) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
                URL.revokeObjectURL(img.src);
                data.length > 440000 ? reject(new Error('Image trop lourde, choisissez-en une plus petite')) : resolve(data);
            };
            img.onerror = () => reject(new Error('Image illisible'));
            img.src = URL.createObjectURL(file);
        });
    }

    // ---------- gift picker ----------
    function openPicker(i) {
        pickerTarget = i;
        $('picker').hidden = false;
        $('picker-search').value = '';
        renderPicker();
        setTimeout(() => $('picker-search').focus(), 30);
    }
    function closePicker() { $('picker').hidden = true; }
    function renderPicker() {
        const q = $('picker-search').value.trim().toLowerCase();
        const sort = $('picker-sort').value;
        let list = gifts.filter(g => !q || g.name.toLowerCase().includes(q));
        list.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'desc' ? b.price - a.price : a.price - b.price);
        const shown = list.slice(0, 150);
        $('picker-grid').innerHTML = shown.map(g => `<button class="gift" data-id="${esc(g.id)}" title="${esc(g.name)}">
            <img src="${esc(g.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.src='/logo.png'"><b>${esc(g.name)}</b><small>${(g.price || 0).toLocaleString('fr-FR')}</small></button>`).join('')
            || '<p class="hint" style="grid-column:1/-1;text-align:center;padding:20px">Aucun cadeau ne correspond.</p>';
        $('picker-more').textContent = list.length > shown.length ? `${shown.length} sur ${list.length} : précisez la recherche pour voir les autres` : '';
    }

    // ---------- import from the scene's gift events ----------
    async function importEvents() {
        if (!token) return toast('Connectez-vous au tableau de bord d\'abord', true);
        try {
            const [events, actions] = await Promise.all([api('/api/events'), api('/api/actions')]);
            const names = new Map((actions || []).map(a => [String(a.id), a.name || '']));
            const rows = (events || []).filter(e => e.triggerType === 'gift' && e.active !== false).map(e => {
                const g = gifts.find(x => (e.giftId && String(x.id) === String(e.giftId))) || gifts.find(x => e.giftName && x.name.toLowerCase() === String(e.giftName).toLowerCase());
                const acts = (Array.isArray(e.actions) ? e.actions : [e.actions]).map(id => names.get(String(id))).filter(Boolean);
                return {
                    giftId: g ? String(g.id) : String(e.giftId || ''), name: g ? g.name : (e.giftName || 'Cadeau'),
                    icon: g ? g.icon : '', coins: g ? g.price : 0,
                    text1: g ? g.name : (e.giftName || 'Cadeau'), text2: acts.join(' + ') || 'Action', badge: ''
                };
            });
            if (!rows.length) return toast('Aucun événement « cadeau » dans la scène active', true);
            rows.sort((a, b) => a.coins - b.coins);
            const replace = !panel.items.length || confirm(`${rows.length} cadeau(x) trouvé(s).\nOK : remplacer le panneau actuel\nAnnuler : les ajouter à la suite`);
            panel.items = (replace ? rows : panel.items.concat(rows)).slice(0, 60);
            renderItems(); changed();
            toast(`${rows.length} cadeau(x) importé(s)`);
        } catch (e) { toast(`Import impossible : ${e.message}`, true); }
    }

    // ---------- export / OBS ----------
    async function downloadPng() {
        const btn = $('btn-png');
        btn.disabled = true;
        const el = $('panel');
        const prev = el.style.transform;
        el.style.transform = '';
        try {
            const canvas = await html2canvas(el, { backgroundColor: null, scale: 2, useCORS: true });
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = 'gentok-panneau-cadeaux.png';
            a.click();
        } catch (e) {
            toast('Export impossible (une image ne se laisse pas copier)', true);
        } finally {
            el.style.transform = prev; btn.disabled = false;
        }
    }
    async function copyObsUrl() {
        if (!token) return toast('Connectez-vous au tableau de bord d\'abord', true);
        const url = `${API || location.origin}/overlay/giftpanel?token=${encodeURIComponent(token)}`;
        try { await navigator.clipboard.writeText(url); toast('URL copiée : collez-la dans une source navigateur OBS'); }
        catch (e) { prompt('URL de l\'overlay', url); }
    }

    // ---------- start ----------
    function fromOldEditor() {
        // the previous Overlay Custom (v12) kept its grid in the browser: it is taken over once
        try {
            const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
            if (!old || !Array.isArray(old.items) || !old.items.length) return null;
            return GiftPanel.normalize({
                items: old.items.map(it => ({ icon: it.icon, text1: it.text1, text2: it.text2, badge: it.badge })),
                layout: { columns: old.grid && old.grid.cols, iconSize: old.grid && old.grid.iconSize, gap: old.grid && old.grid.gap, padding: old.grid && old.grid.padding },
                style: old.theme && old.theme.global ? { color1: old.theme.global.color1, color2: old.theme.global.color2, uppercase: old.theme.global.isUpper } : undefined
            });
        } catch (e) { return null; }
    }

    async function start() {
        bind();
        try {
            const ping = await fetch('/api/app/ping', { cache: 'no-store' }).then(r => r.json());
            if (ping && ping.relay) API = 'https://tiktok.gentok.fr';
        } catch (e) { /* website */ }
        try {
            const list = await fetch(`${API}/api/gifts`).then(r => r.json());
            gifts = (Array.isArray(list) ? list : []).map(g => ({ id: g.id, name: g.name || String(g.id), icon: g.icon || g.url || '', price: Number(g.price) || 0 }));
        } catch (e) { toast('Catalogue des cadeaux indisponible', true); }

        let saved = null;
        if (token) { try { saved = await api('/api/gift-panel'); } catch (e) { setSaveState(`Hors ligne : ${e.message}`, 'err'); } }
        if (!saved) { try { saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch (e) { } }
        if (!saved) saved = fromOldEditor();
        panel = GiftPanel.normalize(saved || {});
        if (!saved) {
            // a first panel to start from
            panel.items = ['5655', '5487', '5827', '6064'].map(id => gifts.find(g => String(g.id) === id)).filter(Boolean)
                .map(g => ({ giftId: String(g.id), name: g.name, icon: g.icon, coins: g.price, text1: g.name, text2: '', badge: '' }));
        }
        syncControls(); renderItems(); draw();
        setSaveState(token ? (saved ? 'Enregistré ✓' : '') : 'Non connecté : enregistré dans ce navigateur seulement', token ? 'ok' : 'err');
    }
    start();
})();
