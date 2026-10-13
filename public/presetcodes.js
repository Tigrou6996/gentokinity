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
        n(c.actions, 'action', 'actions'), n(c.events, 'événement', 'événements'),
        c.settings ? t('réglages') : null, c.overlays ? n(c.overlays, 'overlay personnalisé', 'overlays personnalisés') : null
    ].filter(Boolean).join(' · ');

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

    async function create() {
        const r = await Swal.fire({
            title: t('Partager ma scène'),
            html: `<input id="pc-title" class="swal2-input" maxlength="60" placeholder="${esc(t('Nom du preset (ex : Pack Rose & TNT)'))}">
                <textarea id="pc-desc" class="swal2-textarea" maxlength="300" placeholder="${esc(t('Description (facultatif)'))}"></textarea>
                <label class="pc-check"><input type="checkbox" id="pc-settings" checked> ${esc(t('Inclure les réglages (TTS, objectif de likes, points, tops)'))}</label>
                <label class="pc-check"><input type="checkbox" id="pc-overlays" checked> ${esc(t('Inclure mes options des overlays'))}</label>`,
            showCancelButton: true, confirmButtonText: t('Générer le code'), cancelButtonText: t('Annuler'),
            preConfirm: () => {
                const title = document.getElementById('pc-title').value.trim();
                if (!title) { Swal.showValidationMessage(t('Donnez un nom à votre preset')); return false; }
                return {
                    title, desc: document.getElementById('pc-desc').value.trim(),
                    includeSettings: document.getElementById('pc-settings').checked,
                    overlayOptions: document.getElementById('pc-overlays').checked ? overlayOptions() : {}
                };
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
        const r = await Swal.fire({
            title: esc(p.title),
            html: `<p>${p.creator ? `${esc(t('par'))} <b>@${esc(p.creator)}</b> · ` : ''}${esc(summary(p.counts))}</p>
                ${p.desc ? `<p class="text-dim">${esc(p.desc)}</p>` : ''}
                <div class="pc-modes">
                    <label><input type="radio" name="pc-mode" value="new" checked> ${esc(t('Dans une nouvelle scène'))}</label>
                    <label><input type="radio" name="pc-mode" value="replace"> ${esc(t('Remplacer la scène actuelle'))}</label>
                    <label><input type="radio" name="pc-mode" value="add"> ${esc(t('Ajouter à la scène actuelle'))}</label>
                </div>
                <label class="pc-check"><input type="checkbox" id="pc-points"> ${esc(t('Appliquer aussi ses règles de points et sa monnaie (partagées entre vos scènes)'))}</label>
                <label class="pc-check"><input type="checkbox" id="pc-ovl" checked> ${esc(t('Appliquer ses options des overlays'))}</label>`,
            showCancelButton: true, confirmButtonText: t('Charger'), cancelButtonText: t('Annuler'),
            preConfirm: () => ({
                mode: document.querySelector('input[name="pc-mode"]:checked').value,
                applyPoints: document.getElementById('pc-points').checked,
                overlays: document.getElementById('pc-ovl').checked
            })
        });
        if (!r.isConfirmed) return;
        if (r.value.mode === 'replace') {
            const sure = await Swal.fire({ title: t('Remplacer la scène actuelle ?'), text: t('Ses actions et événements actuels seront remplacés.'), icon: 'warning', showCancelButton: true, confirmButtonText: t('Remplacer'), cancelButtonText: t('Annuler') });
            if (!sure.isConfirmed) return;
        }
        try {
            const res = await api(`/api/preset-codes/${encodeURIComponent(p.code)}/load`, 'POST', { mode: r.value.mode, applyPoints: r.value.applyPoints });
            if (r.value.overlays && res.overlayOptions && Object.keys(res.overlayOptions).length) {
                try { localStorage.setItem(GALLERY, JSON.stringify({ ...overlayOptions(), ...res.overlayOptions })); } catch (e) { }
            }
            const cfg = await fetch(`${getApiBase()}/api/config?token=${encodeURIComponent(token())}`, { cache: 'no-store' }).then(x => x.json()).catch(() => null);
            if (cfg && typeof applyConfigUI === 'function') applyConfigUI(cfg);
            if (input) input.value = '';
            showToast(`${t('Preset chargé')} : ${n(res.installed.actions, 'action', 'actions')}, ${n(res.installed.events, 'événement', 'événements')}`, 'success');
        } catch (e) { showToast(e.message, 'error'); }
    }

    async function update(code) {
        const ok = await Swal.fire({ title: t('Mettre à jour ce code ?'), text: t('Son contenu est remplacé par la scène active. Le code reste le même.'), icon: 'question', showCancelButton: true, confirmButtonText: t('Mettre à jour'), cancelButtonText: t('Annuler') });
        if (!ok.isConfirmed) return;
        try { await api(`/api/preset-codes/${encodeURIComponent(code)}/update`, 'POST', { overlayOptions: overlayOptions() }); showToast(t('Code mis à jour'), 'success'); refresh(); } catch (e) { showToast(e.message, 'error'); }
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
