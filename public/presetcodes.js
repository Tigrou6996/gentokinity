/**
 * Gestion des Scènes > "Partager ma scène" / "Charger avec un code": full presets shared with a code.
 * Server side: src/routes/presetCodes.js. Uses globals of app.js: getApiBase, showToast, escapeHtml, applyConfigUI.
 */
(function () {
    const t = (s) => (window.GentokI18n ? window.GentokI18n.t(s) : s);
    const token = () => { try { return localStorage.getItem('gentok_token') || ''; } catch (e) { return ''; } };
    const GALLERY = 'gentok_gallery_options';
    const esc = (v) => escapeHtml(String(v ?? ''));

    async function api(path, method = 'GET', body) {
        const url = `${getApiBase()}${path}${method === 'GET' ? `${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token())}` : ''}`;
        const res = await fetch(url, method === 'GET' ? { cache: 'no-store' } : {
            method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token(), ...(body || {}) })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    }

    const overlayOptions = () => { try { return JSON.parse(localStorage.getItem(GALLERY) || '{}') || {}; } catch (e) { return {}; } };
    const n = (count, one, many) => `${count} ${t(count > 1 ? many : one)}`;
    const summary = (c) => [
        c.sounds ? n(c.sounds, 'son', 'sons') : null,
        n(c.actions, 'action', 'actions'), n(c.events, 'événement', 'événements'),
        c.settings ? t('réglages') : null, c.points ? t('règles de points') : null,
        c.overlays ? n(c.overlays, 'overlay personnalisé', 'overlays personnalisés') : null
    ].filter(Boolean).join(' · ');

    // The parts of a scene, as checkboxes with their count (like TikFinity's export)
    const PARTS = [
        { key: 'username', label: 'Nom TikTok', icon: 'fa-user' },
        { key: 'settings', label: 'Réglages généraux (TTS, objectif de likes, tops)', icon: 'fa-sliders' },
        { key: 'points', label: 'Règles de points et monnaie', icon: 'fa-coins' },
        { key: 'sounds', label: 'Sons', icon: 'fa-volume-high' },
        { key: 'actions', label: 'Actions', icon: 'fa-bolt' },
        { key: 'events', label: 'Événements', icon: 'fa-calendar-check' },
        { key: 'overlays', label: 'Options des overlays', icon: 'fa-display' }
    ];
    function partsHtml(counts, checked) {
        return `<div class="pc-parts">${PARTS.filter(p => counts[p.key] !== undefined && counts[p.key] !== null && counts[p.key] !== false).map(p => {
            const c = counts[p.key];
            const extra = typeof c === 'number' ? ` <em>(${c})</em>` : (typeof c === 'string' && c ? ` <em>@${esc(c)}</em>` : '');
            return `<label class="pc-part"><input type="checkbox" data-part="${p.key}" ${checked[p.key] ? 'checked' : ''}><i class="fas ${p.icon}"></i><span>${esc(t(p.label))}${extra}</span></label>`;
        }).join('')}</div>`;
    }
    const readParts = () => {
        const inc = {};
        document.querySelectorAll('.pc-parts input[data-part]').forEach(i => { inc[i.dataset.part] = i.checked; });
        return inc;
    };
    // what the active scene holds right now (app.js globals)
    function sceneCounts() {
        const acts = (typeof currentActions !== 'undefined' && currentActions) || [];
        const evs = (typeof currentEvents !== 'undefined' && currentEvents) || [];
        const user = (document.getElementById('header-username')?.value || '').trim().replace(/^@/, '');
        return {
            username: user || false, settings: true, points: true,
            sounds: acts.filter(a => a.type === 'sound').length, actions: acts.filter(a => a.type !== 'sound').length,
            events: evs.length, overlays: Object.keys(overlayOptions()).length
        };
    }
    const CREATE_DEFAULT = { username: false, settings: true, points: true, sounds: true, actions: true, events: true, overlays: true };

    async function copy(code) {
        try { await navigator.clipboard.writeText(code); showToast(t('Code copié !'), 'success'); } catch (e) { showToast(code, 'info'); }
    }

    async function refresh() {
        const box = document.getElementById('pcode-list');
        if (!box || !token()) return;
        try {
            const list = await api('/api/preset-codes/mine');
            box.innerHTML = list.length ? list.map(p => `
                <div class="pcode-item">
                    <div class="pcode-meta"><b>${esc(p.title)}</b><small>${esc(summary(p.counts))} · ${esc(n(p.uses, 'chargement', 'chargements'))}</small></div>
                    <code class="pcode-code" title="${esc(t('Copier'))}" data-copy="${esc(p.code)}">${esc(p.code)}</code>
                    <button class="btn-secondary btn-sm" data-update="${esc(p.code)}" title="${esc(t('Remplacer par la scène active'))}"><i class="fas fa-rotate"></i></button>
                    <button class="btn-secondary btn-sm" data-delete="${esc(p.code)}" title="${esc(t('Supprimer'))}"><i class="fas fa-trash"></i></button>
                </div>`).join('') : `<span class="text-dim">${esc(t('Aucun code pour le moment.'))}</span>`;
        } catch (e) { /* not logged in yet */ }
    }

    const nothingChosen = (inc) => !Object.values(inc).some(Boolean);

    async function create() {
        const r = await Swal.fire({
            title: t('Partager ma scène'),
            html: `<input id="pc-title" class="swal2-input" maxlength="60" placeholder="${esc(t('Nom du preset (ex : Pack Rose & TNT)'))}">
                <textarea id="pc-desc" class="swal2-textarea" maxlength="300" placeholder="${esc(t('Description (facultatif)'))}"></textarea>
                <div class="pc-parts-title">${esc(t('Contenu du code'))}</div>
                ${partsHtml(sceneCounts(), CREATE_DEFAULT)}`,
            showCancelButton: true, confirmButtonText: t('Générer le code'), cancelButtonText: t('Annuler'),
            preConfirm: () => {
                const title = document.getElementById('pc-title').value.trim();
                if (!title) { Swal.showValidationMessage(t('Donnez un nom à votre preset')); return false; }
                const include = readParts();
                if (nothingChosen(include)) { Swal.showValidationMessage(t('Cochez au moins un élément')); return false; }
                return { title, desc: document.getElementById('pc-desc').value.trim(), include, overlayOptions: include.overlays ? overlayOptions() : {} };
            }
        });
        if (!r.isConfirmed) return;
        try {
            const { preset } = await api('/api/preset-codes', 'POST', r.value);
            refresh();
            await Swal.fire({
                title: t('Votre code est prêt'),
                html: `<div class="pcode-big">${esc(preset.code)}</div><p>${esc(summary(preset.counts))}</p><p class="text-dim">${esc(t("Partagez-le : n'importe quel compte Gentok peut charger cette scène avec ce code."))}</p>`,
                icon: 'success', confirmButtonText: t('Copier le code')
            }).then(x => { if (x.isConfirmed) copy(preset.code); });
        } catch (e) { showToast(e.message, 'error'); }
    }

    async function preview(codeArg) {
        const input = document.getElementById('pcode-input');
        const code = String(codeArg || (input && input.value) || '').trim();
        if (!code) { showToast(t('Entrez un code'), 'error'); return; }
        let p;
        try { p = await api(`/api/preset-codes/${encodeURIComponent(code)}`); } catch (e) { showToast(e.message, 'error'); return; }
        const c = p.counts || {};
        // only the parts this code contains; the TikTok name and the points rules (shared by your scenes) are opt-in
        const available = {
            username: p.username || false, settings: c.settings ? true : false, points: c.points ? true : false,
            sounds: c.sounds || false, actions: c.actions || false, events: c.events || false, overlays: c.overlays || false
        };
        const r = await Swal.fire({
            title: esc(p.title),
            html: `<p>${p.creator ? `${esc(t('par'))} <b>@${esc(p.creator)}</b> · ` : ''}${esc(summary(c))}</p>
                ${p.desc ? `<p class="text-dim">${esc(p.desc)}</p>` : ''}
                <div class="pc-modes">
                    <label><input type="radio" name="pc-mode" value="new" checked> ${esc(t('Dans une nouvelle scène'))}</label>
                    <label><input type="radio" name="pc-mode" value="replace"> ${esc(t('Remplacer dans la scène actuelle'))}</label>
                    <label><input type="radio" name="pc-mode" value="add"> ${esc(t('Ajouter à la scène actuelle'))}</label>
                </div>
                <div class="pc-parts-title">${esc(t('Éléments à charger'))}</div>
                ${partsHtml(available, { ...CREATE_DEFAULT, username: false, points: false })}
                <p class="pc-note">${esc(t('Les règles de points et la monnaie sont partagées entre toutes vos scènes.'))}</p>`,
            showCancelButton: true, confirmButtonText: t('Charger'), cancelButtonText: t('Annuler'),
            preConfirm: () => {
                const include = readParts();
                if (nothingChosen(include)) { Swal.showValidationMessage(t('Cochez au moins un élément')); return false; }
                return { mode: document.querySelector('input[name="pc-mode"]:checked').value, include };
            }
        });
        if (!r.isConfirmed) return;
        if (r.value.mode === 'replace') {
            const sure = await Swal.fire({ title: t('Remplacer dans la scène actuelle ?'), text: t('Les éléments cochés remplacent ceux de la scène actuelle.'), icon: 'warning', showCancelButton: true, confirmButtonText: t('Remplacer'), cancelButtonText: t('Annuler') });
            if (!sure.isConfirmed) return;
        }
        try {
            const res = await api(`/api/preset-codes/${encodeURIComponent(p.code)}/load`, 'POST', { mode: r.value.mode, include: r.value.include });
            if (res.overlayOptions && Object.keys(res.overlayOptions).length) {
                try { localStorage.setItem(GALLERY, JSON.stringify({ ...overlayOptions(), ...res.overlayOptions })); } catch (e) { }
            }
            const cfg = await fetch(`${getApiBase()}/api/config?token=${encodeURIComponent(token())}`, { cache: 'no-store' }).then(x => x.json()).catch(() => null);
            if (cfg && typeof applyConfigUI === 'function') applyConfigUI(cfg);
            if (input) input.value = '';
            showToast(`${t('Preset chargé')} : ${n(res.installed.actions, 'action', 'actions')}, ${n(res.installed.events, 'événement', 'événements')}`, 'success');
        } catch (e) { showToast(e.message, 'error'); }
    }

    async function update(code) {
        const r = await Swal.fire({
            title: t('Mettre à jour ce code ?'),
            html: `<p>${esc(t('Son contenu est remplacé par la scène active. Le code reste le même.'))}</p>
                <div class="pc-parts-title">${esc(t('Contenu du code'))}</div>${partsHtml(sceneCounts(), CREATE_DEFAULT)}`,
            icon: 'question', showCancelButton: true, confirmButtonText: t('Mettre à jour'), cancelButtonText: t('Annuler'),
            preConfirm: () => {
                const include = readParts();
                if (nothingChosen(include)) { Swal.showValidationMessage(t('Cochez au moins un élément')); return false; }
                return include;
            }
        });
        if (!r.isConfirmed) return;
        try {
            await api(`/api/preset-codes/${encodeURIComponent(code)}/update`, 'POST', { include: r.value, overlayOptions: r.value.overlays ? overlayOptions() : {} });
            showToast(t('Code mis à jour'), 'success'); refresh();
        } catch (e) { showToast(e.message, 'error'); }
    }

    async function remove(code) {
        const ok = await Swal.fire({ title: t('Supprimer ce code ?'), text: t("Il ne pourra plus être chargé. Les scènes déjà chargées ne changent pas."), icon: 'warning', showCancelButton: true, confirmButtonText: t('Supprimer'), cancelButtonText: t('Annuler') });
        if (!ok.isConfirmed) return;
        try { await api(`/api/preset-codes/${encodeURIComponent(code)}`, 'DELETE'); refresh(); } catch (e) { showToast(e.message, 'error'); }
    }

    function start() {
        const box = document.getElementById('pcode-list');
        if (!box) return;
        box.addEventListener('click', (e) => {
            const c = e.target.closest('[data-copy]'); if (c) return copy(c.dataset.copy);
            const u = e.target.closest('[data-update]'); if (u) return update(u.dataset.update);
            const d = e.target.closest('[data-delete]'); if (d) return remove(d.dataset.delete);
        });
        document.getElementById('pcode-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') preview(); });
        // refreshed each time the page is shown
        if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(x => x.isIntersecting && refresh())).observe(box);
        else refresh();
        // a link like …/#presets?code=GTK-XXXX-XXXX opens the code directly
        const m = location.hash.match(/code=([\w-]+)/i);
        if (m) setTimeout(() => preview(m[1]), 2500);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.GentokPresetCodes = { create, preview, refresh };
})();
