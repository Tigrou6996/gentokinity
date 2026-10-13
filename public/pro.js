/**
 * Gentok dashboard - extra pages: viewer points, plan (free / Premium), team battles,
 * event simulator, overlay styling (fonts / colors) and interface font.
 * Loaded after app.js: uses its helpers (getApiBase, showToast, showNotify, showConfirm,
 * escapeHtml, currentActions, isPremiumUser, updateOverlayLinks, openProModal).
 */
(function () {
    const token = () => localStorage.getItem('gentok_token') || '';
    const t = (s) => (window.GentokI18n ? window.GentokI18n.t(s) : s);
    const esc = (v) => (typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? ''));
    const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

    async function api(path, { method = 'GET', body, query = {} } = {}) {
        const params = new URLSearchParams({ token: token(), ...query });
        const url = `${getApiBase()}${path}${method === 'GET' ? `?${params}` : ''}`;
        const res = await fetch(url, method === 'GET' ? {} : {
            method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token(), ...(body || {}) })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
        return data;
    }

    // ------------------------------------------------------------------ tabs
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.pro-tabs button[data-tab]');
        if (!btn) return;
        const bar = btn.parentElement;
        bar.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
        const section = bar.closest('section');
        section.querySelectorAll('.pro-tab').forEach(p => p.classList.toggle('active', p.id === btn.dataset.tab));
        if (btn.dataset.tab === 'points-transactions') Points.loadTransactions();
        if (btn.dataset.tab === 'points-settings') Points.loadSettings();
    });

    // ------------------------------------------------------------------ points
    const Points = {
        state: { page: 1, pages: 1, sort: 'points', order: 'desc', search: '' },

        async load() {
            const tbody = document.getElementById('points-tbody');
            if (!tbody) return;
            api('/api/points/settings').then(c => this.applyCurrency(c)).catch(() => { });
            try {
                const s = this.state;
                const data = await api('/api/points/users', { query: { page: s.page, sort: s.sort, order: s.order, search: s.search, limit: 25 } });
                s.pages = data.pages;
                document.getElementById('points-user-count').textContent = fmt(data.totalUsers);
                document.getElementById('points-user-max').textContent = fmt(data.maxUsers);
                document.getElementById('points-page').textContent = `${data.page} / ${data.pages}`;
                if (!data.users.length) {
                    tbody.innerHTML = `<tr><td colspan="9" class="pro-empty">${esc(t('Aucun spectateur pour le moment. Les points arrivent dès votre prochain live !'))}</td></tr>`;
                } else {
                    tbody.innerHTML = data.users.map(u => `
                        <tr>
                            <td><div class="pro-user"><img src="${esc(u.profilePictureUrl || gentokInitialAvatar(u.nickname || u.uniqueId))}" data-n="${esc(u.nickname || u.uniqueId)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=gentokInitialAvatar(this.dataset.n)">
                                <div><div class="n">${esc(u.nickname)}</div><div class="u">@${esc(u.uniqueId)}</div></div></div></td>
                            <td><span class="pro-level">${u.level}</span></td>
                            <td class="pro-num">${fmt(u.points)}</td>
                            <td class="pro-num">${fmt(u.levelPoints)}</td>
                            <td class="pro-num">${fmt(u.stats.coins)}</td>
                            <td class="pro-num">${fmt(u.stats.likes)}</td>
                            <td>${fmtDate(u.firstActivity)}</td>
                            <td>${fmtDate(u.lastActivity)}</td>
                            <td><div class="pro-actions-cell">
                                <button class="pro-mini-btn" title="+" data-adjust="${esc(u.uniqueId)}" data-sign="1"><i class="fas fa-plus"></i></button>
                                <button class="pro-mini-btn" title="-" data-adjust="${esc(u.uniqueId)}" data-sign="-1"><i class="fas fa-minus"></i></button>
                            </div></td>
                        </tr>`).join('');
                }
                document.querySelectorAll('#points-section th.sortable').forEach(th => {
                    th.querySelector('.sort-ind')?.remove();
                    if (th.dataset.sort === s.sort) th.insertAdjacentHTML('beforeend', `<span class="sort-ind">${s.order === 'desc' ? '↓' : '↑'}</span>`);
                });
            } catch (e) {
                tbody.innerHTML = `<tr><td colspan="9" class="pro-empty">❌ ${esc(e.message)}</td></tr>`;
            }
        },

        page(delta) {
            const s = this.state;
            s.page = Math.min(Math.max(1, s.page + delta), s.pages);
            this.load();
        },

        async loadTransactions() {
            const tbody = document.getElementById('points-tx-tbody');
            try {
                const search = document.getElementById('points-tx-search').value.trim();
                const data = await api('/api/points/transactions', { query: { search, limit: 100 } });
                const REASONS = { gift: '🎁 Cadeau', like: '❤️ Likes', follow: '➕ Follow', share: '🔁 Partage', chat: '💬 Chat', sub: '⭐ Abonnement', watch: '⏱️ Présence', manual: '✏️ Manuel', spend: '💸 Dépense', battle: '⚔️ Bataille' };
                tbody.innerHTML = data.items.length ? data.items.map(x => `
                    <tr><td>${fmtDate(x.date)}</td><td>@${esc(x.uniqueId)}</td>
                    <td class="pro-num" style="color:${x.delta < 0 ? '#ef4444' : '#10b981'}">${x.delta > 0 ? '+' : ''}${fmt(x.delta)}</td>
                    <td>${esc(t(REASONS[x.reason] || x.reason))}</td><td style="color: var(--text-dim);">${esc(x.details || '')}</td></tr>`).join('')
                    : `<tr><td colspan="5" class="pro-empty">${esc(t('Aucune transaction.'))}</td></tr>`;
            } catch (e) {
                tbody.innerHTML = `<tr><td colspan="5" class="pro-empty">❌ ${esc(e.message)}</td></tr>`;
            }
        },

        FIELDS: ['perCoin', 'perLike', 'perFollow', 'perShare', 'perSub', 'perChat', 'chatCooldown', 'perActiveMinute', 'levelFactor', 'commandCooldown',
            'xpPerCoin', 'xpPerLike', 'xpPerFollow', 'xpPerShare', 'xpPerSub', 'xpPerChat', 'xpPerActiveMinute'],

        toggleXp() {
            const custom = document.getElementById('pts-xpMode').value === 'custom';
            document.getElementById('pts-xp-custom').hidden = !custom;
            const f = Math.max(1, parseFloat(document.getElementById('pts-levelFactor').value) || 50);
            document.getElementById('pts-level-preview').textContent = [1, 5, 10, 20, 50].map(n => `Nv ${n} : ${fmt(n * n * f)} XP`).join(' · ');
        },

        // Column title and messages use the streamer's currency
        applyCurrency(s) {
            this.currency = s;
            const col = document.getElementById('pts-col-points');
            if (col) col.textContent = `${s.currencyEmoji ? s.currencyEmoji + ' ' : ''}${s.currencyName || 'points'}`;
        },

        async loadSettings() {
            try {
                const s = await api('/api/points/settings');
                document.getElementById('pts-enabled').value = s.enabled ? '1' : '0';
                this.FIELDS.forEach(f => { const el = document.getElementById(`pts-${f}`); if (el) el.value = s[f]; });
                document.getElementById('pts-scoreCommand').value = s.scoreCommand || '!score';
                document.getElementById('pts-topCommand').value = s.topCommand || '!top';
                document.getElementById('points-score-cmd').textContent = s.scoreCommand || '!score';
                document.getElementById('pts-currencyName').value = s.currencyName || 'points';
                document.getElementById('pts-currencyEmoji').value = s.currencyEmoji || '';
                document.getElementById('pts-xpMode').value = s.xpMode === 'custom' ? 'custom' : 'same';
                this.toggleXp();
                this.applyCurrency(s);
                Chatbot.load();
            } catch (e) { showToast(e.message, 'error'); }
        },

        async saveSettings() {
            const pts = { enabled: document.getElementById('pts-enabled').value === '1' };
            this.FIELDS.forEach(f => { const v = parseFloat(document.getElementById(`pts-${f}`).value); if (Number.isFinite(v) && v >= 0) pts[f] = v; });
            const cmd = (v, def) => { v = (v || '').trim().toLowerCase().split(/\s+/)[0] || def; return v.startsWith('!') ? v : '!' + v; };
            pts.scoreCommand = cmd(document.getElementById('pts-scoreCommand').value, '!score');
            pts.topCommand = cmd(document.getElementById('pts-topCommand').value, '!top');
            pts.currencyName = document.getElementById('pts-currencyName').value.trim().slice(0, 24) || 'points';
            pts.currencyEmoji = document.getElementById('pts-currencyEmoji').value.trim().slice(0, 8);
            pts.xpMode = document.getElementById('pts-xpMode').value === 'custom' ? 'custom' : 'same';
            try {
                await api('/api/settings', { method: 'POST', body: { points: pts } });
                showToast(t('Paramètres sauvegardés !'), 'success');
                this.loadSettings();
            } catch (e) { showToast(e.message, 'error'); }
        },

        async adjust(uniqueId, delta) {
            try {
                const r = await api('/api/points/adjust', { method: 'POST', body: { uniqueId, delta } });
                const c = this.currency || {};
                showToast(`@${uniqueId} : ${fmt(r.points)} ${c.currencyEmoji || ''} ${c.currencyName || 'points'}`, 'success');
                this.load();
            } catch (e) { showToast(e.message, 'error'); }
        },

        adjustFromForm() {
            const user = document.getElementById('pts-adjust-user').value.trim().replace(/^@/, '');
            const amount = parseFloat(document.getElementById('pts-adjust-amount').value);
            if (!user || !Number.isFinite(amount) || amount === 0) return showToast(t('Veuillez remplir tous les champs'), 'error');
            this.adjust(user, amount);
        },

        async exportCsv() {
            try {
                const res = await fetch(`${getApiBase()}/api/points/export.csv?token=${encodeURIComponent(token())}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const url = URL.createObjectURL(await res.blob());
                const a = document.createElement('a');
                a.href = url;
                a.download = `gentok-points-${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 5000);
            } catch (e) {
                showToast('❌ ' + e.message, 'error');
            }
        },

        async resetAll() {
            const ok = await showConfirm(t('Réinitialiser tous les points ?'), t('Tous les spectateurs, leurs points et l\'historique seront supprimés. Cette action est irréversible.'), t('Oui, supprimer'));
            if (!ok) return;
            try {
                const r = await api('/api/points/reset', { method: 'POST' });
                showToast(`${fmt(r.deleted)} ${t('spectateurs supprimés')}`, 'success');
                this.load();
            } catch (e) { showToast(e.message, 'error'); }
        }
    };

    document.addEventListener('click', (e) => {
        const th = e.target.closest('#points-section th.sortable');
        if (th) {
            const s = Points.state;
            if (s.sort === th.dataset.sort) s.order = s.order === 'desc' ? 'asc' : 'desc';
            else { s.sort = th.dataset.sort; s.order = ['nickname'].includes(s.sort) ? 'asc' : 'desc'; }
            s.page = 1;
            Points.load();
            return;
        }
        const adj = e.target.closest('[data-adjust]');
        if (adj) {
            const sign = Number(adj.dataset.sign);
            const raw = window.prompt(t(sign > 0 ? 'Combien de points ajouter ?' : 'Combien de points retirer ?'), '100');
            const n = parseFloat(raw);
            if (Number.isFinite(n) && n > 0) Points.adjust(adj.dataset.adjust, sign * n);
        }
    });

    let searchTimer = null;
    document.addEventListener('input', (e) => {
        if (e.target.id === 'points-search') {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { Points.state.search = e.target.value.trim(); Points.state.page = 1; Points.load(); }, 350);
        } else if (e.target.id === 'points-tx-search') {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => Points.loadTransactions(), 350);
        }
    });

    // ------------------------------------------------------------------ plan
    const Plan = {
        async load() {
            try {
                const data = await api('/api/plan');
                window.gentokPlan = data;
                const p = data.plan;
                const until = data.billing && data.billing.currentPeriodEnd ? ` — ${t('jusqu\'au')} ${new Date(data.billing.currentPeriodEnd).toLocaleDateString()}` : '';
                document.getElementById('premium-status-text').textContent = data.premium ? `⭐ Gentok Premium${until}` : t('Offre gratuite');
                const bar = (used, max) => {
                    const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
                    return `<div class="pro-bar"><div style="width:${max ? pct : 100}%"></div></div>`;
                };
                const lim = (v) => (v === null ? '∞' : fmt(v));
                const usage = [
                    ['Scènes', data.usage.scenes, p.maxScenes],
                    ['Actions (scène active)', data.usage.actions, p.maxActionsPerScene],
                    ['Événements (scène active)', data.usage.events, p.maxEventsPerScene],
                    ['Spectateurs dans les points', data.usage.pointsUsers, p.maxPointsUsers]
                ];
                document.getElementById('premium-usage').innerHTML = usage.map(([l, u, m]) => `
                    <div class="pro-usage-item"><div class="lbl">${esc(t(l))}</div><div class="val">${fmt(u)} / ${lim(m)}</div>${bar(u, m)}</div>`).join('');

                const F = data.plans.free, P = data.plans.premium;
                const row = (ok, text) => `<li><i class="fas ${ok ? 'fa-check' : 'fa-times'}"></i> ${esc(t(text))}</li>`;
                const card = (plan, premium) => `
                    <div class="plan-card ${premium ? 'premium' : ''}">
                        ${premium ? '<span class="plan-badge">PREMIUM</span>' : ''}
                        <h3>${premium ? '⭐ Gentok Premium' : esc(t('Gratuit'))}</h3>
                        <div class="price">${premium ? esc(t('à partir de 6,66 €/mois')) : esc(t('Pour toujours'))}</div>
                        <ul>
                            ${row(true, `${lim(plan.maxScenes)} scènes`)}
                            ${row(true, plan.maxActionsPerScene === null ? 'Actions et événements illimités' : `${plan.maxActionsPerScene} actions et ${plan.maxEventsPerScene} événements par scène`)}
                            ${row(true, `Système de points : ${lim(plan.maxPointsUsers)} spectateurs`)}
                            ${row(true, 'Commandes !score / !top et overlays')}
                            ${row(true, 'Alertes, chat, objectifs, timer, pluie de cadeaux')}
                            ${row(true, "Simulateur d'événements")}
                            ${row(true, `Batailles d'équipes : ${plan.maxBattleTeams} équipes`)}
                            ${row(plan.pointsStore, 'Boutique de points (événements payés en points)')}
                            ${row(plan.proWidgets, "Widgets PRO : Coin Match, pot à cadeaux, canon, fontaine de likes, feu d'artifice")}
                            ${row(!plan.premiumActionTypes.includes('obs'), 'Actions OBS Studio')}
                            ${row(!plan.premiumActionTypes.includes('wheel'), 'Roue de la fortune')}
                            ${row(!plan.premiumActionTypes.includes('streamerbot'), 'Actions Streamer.bot')}
                            ${row(plan.actionDelay, 'Délai avant exécution des actions')}
                            ${row(plan.sessionHistory, 'Historique détaillé des lives')}
                        </ul>
                        ${premium && !data.premium ? `<button class="btn-primary" style="width:100%" onclick="openProModal()"><i class="fas fa-crown"></i> ${esc(t('Passer à Premium'))}</button>` : ''}
                        ${premium && data.premium && data.billing && data.billing.currentPeriodEnd ? `<button class="btn-secondary" style="width:100%" onclick="openProModal()"><i class="fas fa-calendar-plus"></i> ${esc(t('Prolonger mon Premium'))}</button>` : ''}
                        ${premium === data.premium ? `<div style="text-align:center;color:var(--text-dim);font-size:0.85rem;">${esc(t('Votre offre actuelle'))}</div>` : ''}
                    </div>`;
                document.getElementById('plan-grid').innerHTML = card(F, false) + card(P, true);
            } catch (e) {
                document.getElementById('premium-status-text').textContent = `❌ ${e.message}`;
            }
        }
    };

    // ------------------------------------------------------------------ battles
    const TEAM_DEFAULTS = [
        { name: 'Rouge', color: '#fe2c55', command: '!rouge' },
        { name: 'Bleu', color: '#25f4ee', command: '!bleu' },
        { name: 'Jaune', color: '#fbbf24', command: '!jaune' },
        { name: 'Vert', color: '#4ade80', command: '!vert' }
    ];
    const Battle = {
        pollTimer: null,

        renderTeams() {
            const box = document.getElementById('battle-teams');
            if (!box) return;
            const count = parseInt(document.getElementById('battle-team-count').value) || 2;
            const actions = (typeof currentActions !== 'undefined' ? currentActions : []) || [];
            const prev = this.readTeams();
            box.innerHTML = TEAM_DEFAULTS.slice(0, count).map((d, i) => {
                const v = prev[i] || d;
                return `
                <div class="battle-team" style="--team-color:${esc(v.color)}" data-team="${i}">
                    <div class="pro-field"><label>${esc(t('Nom'))}</label><input type="text" class="bt-name form-control" value="${esc(v.name)}"></div>
                    <div class="inline" style="display:flex;gap:8px;margin-top:8px;">
                        <div class="pro-field" style="flex:1"><label>${esc(t('Commande'))}</label><input type="text" class="bt-command form-control" value="${esc(v.command)}"></div>
                        <div class="pro-field" style="width:70px"><label>${esc(t('Couleur'))}</label><input type="color" class="bt-color" value="${esc(v.color)}" style="padding:2px;height:40px;"></div>
                    </div>
                    <div class="pro-field" style="margin-top:8px"><label>${esc(t('Cadeau de l\'équipe (ID, optionnel)'))}</label><input type="text" class="bt-gift form-control" value="${esc(v.giftId || '')}" placeholder="ex: 5655"></div>
                    <div class="pro-field" style="margin-top:8px"><label>${esc(t('Action si victoire'))}</label>
                        <select class="bt-action form-select"><option value="">${esc(t('Aucune action'))}</option>
                        ${actions.map(a => `<option value="${esc(a.id)}" ${v.winActionId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
                </div>`;
            }).join('');
            box.querySelectorAll('.bt-color').forEach(inp => inp.addEventListener('input', () => {
                inp.closest('.battle-team').style.setProperty('--team-color', inp.value);
            }));
        },

        readTeams() {
            return Array.from(document.querySelectorAll('#battle-teams .battle-team')).map(el => ({
                name: el.querySelector('.bt-name').value.trim(),
                command: el.querySelector('.bt-command').value.trim(),
                color: el.querySelector('.bt-color').value,
                giftId: el.querySelector('.bt-gift').value.trim() || null,
                winActionId: el.querySelector('.bt-action').value || null
            }));
        },

        async start() {
            const teams = this.readTeams();
            if (teams.length > 2 && !isPremiumUser) {
                showNotify('🌟 Gentok Pro', t('Les batailles à plus de 2 équipes sont réservées à Gentok Premium.'), 'info');
                return;
            }
            try {
                await api('/api/battle/start', {
                    method: 'POST', body: {
                        title: document.getElementById('battle-title').value,
                        mode: document.getElementById('battle-mode').value,
                        duration: (parseFloat(document.getElementById('battle-duration').value) || 3) * 60,
                        likeValue: parseFloat(document.getElementById('battle-like-value').value) || 1,
                        teams
                    }
                });
                showToast(t('Bataille lancée !'), 'success');
                this.poll();
            } catch (e) { showToast(e.message, 'error'); }
        },

        async stop() {
            try { await api('/api/battle/stop', { method: 'POST' }); this.refresh(); } catch (e) { showToast(e.message, 'error'); }
        },

        async refresh() {
            const box = document.getElementById('battle-live');
            if (!box) return;
            try {
                const st = await api('/api/battle/state');
                if (!st.teams) { box.innerHTML = `<span class="text-dim">${esc(t('Aucune bataille en cours.'))}</span>`; return; }
                const max = Math.max(1, ...st.teams.map(x => x.score));
                const left = Math.max(0, Math.round((st.endsAt - Date.now()) / 1000));
                const winner = st.winnerId === 'draw' ? t('Égalité !') : (st.teams.find(x => x.id === st.winnerId)?.name);
                box.innerHTML = `
                    <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:6px;">
                        <span>${esc(st.title)}</span>
                        <span>${st.running ? `⏱️ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `🏆 ${esc(winner || '')}`}</span>
                    </div>
                    ${st.teams.map(x => `<div class="row"><span class="name" style="color:${esc(x.color)}">${esc(x.name)}</span>
                        <div class="track"><div style="width:${Math.round((x.score / max) * 100)}%;background:${esc(x.color)}"></div></div>
                        <span class="score">${fmt(x.score)}</span><span class="text-dim" style="width:70px;font-size:0.8rem;">👥 ${x.members}</span></div>`).join('')}`;
                if (!st.running) this.stopPolling();
            } catch (e) {
                box.innerHTML = `<span class="text-dim">❌ ${esc(e.message)}</span>`;
            }
        },

        poll() {
            this.stopPolling();
            this.refresh();
            this.pollTimer = setInterval(() => {
                if (document.getElementById('battle-section')?.style.display === 'none') return this.stopPolling();
                this.refresh();
            }, 1000);
        },

        stopPolling() {
            if (this.pollTimer) clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    };
    document.addEventListener('change', (e) => { if (e.target.id === 'battle-team-count') Battle.renderTeams(); });

    // ------------------------------------------------------------------ giveaway & points drop
    const val = (id) => (document.getElementById(id) || {}).value;
    const checked = (id) => !!(document.getElementById(id) || {}).checked;
    const avatarHtml = (p) => `<img src="${esc(p.profilePictureUrl || gentokInitialAvatar(p.nickname || p.uniqueId))}" data-n="${esc(p.nickname || p.uniqueId)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=gentokInitialAvatar(this.dataset.n)">`;

    const Giveaway = {
        timer: null,
        async start() {
            try {
                await api('/api/giveaway/start', { method: 'POST', body: {
                    title: val('gw-title'), prize: val('gw-prize'), keyword: val('gw-keyword'), duration: Number(val('gw-duration')),
                    coinsPerTicket: Number(val('gw-coins')) || 0, followersOnly: checked('gw-followers'), subscribersOnly: checked('gw-subs')
                } });
                showToast(t('Inscriptions ouvertes !'), 'success');
                this.poll();
            } catch (e) { showToast('❌ ' + e.message, 'error'); }
        },
        async cmd(c) {
            try { await api(`/api/giveaway/${c}`, { method: 'POST' }); this.refresh(); } catch (e) { showToast('❌ ' + e.message, 'error'); }
        },
        async draw() {
            try {
                const r = await api('/api/giveaway/draw', { method: 'POST', body: { count: Number(val('gw-count')) || 1 } });
                if (r.drawn && r.drawn.length) showToast(`🎉 ${r.drawn.map(w => w.nickname).join(', ')}`, 'success');
                else showToast(t('Aucun participant à tirer au sort.'), 'error');
                this.refresh();
            } catch (e) { showToast('❌ ' + e.message, 'error'); }
        },
        async refresh() {
            const box = document.getElementById('gw-live');
            if (!box) return;
            try {
                const st = await api('/api/giveaway/state');
                if (st.status === 'idle') { box.innerHTML = `<span class="text-dim">${esc(t('Aucun giveaway en cours.'))}</span>`; return; }
                box.innerHTML = `<div class="gw-head"><b>${esc(st.title)}</b>${st.prize ? ` — ${esc(st.prize)}` : ''}
                    <span class="gw-status ${st.status}">${esc(t(st.status === 'open' ? 'Inscriptions ouvertes' : 'Inscriptions fermées'))}</span></div>
                    <div class="gw-stats"><span>👥 ${fmt(st.count)} ${esc(t('participants'))}</span>${st.coinsPerTicket ? `<span>🎟️ ${fmt(st.tickets)} tickets</span>` : ''}
                    ${st.endsAt && st.status === 'open' ? `<span>⏱️ ${Math.max(0, Math.ceil((st.endsAt - Date.now()) / 1000))}s</span>` : ''}</div>
                    ${st.winners.length ? `<div class="gw-winners">🏆 ${st.winners.map(w => `<span class="gw-user">${avatarHtml(w)}${esc(w.nickname)}</span>`).join('')}</div>` : ''}
                    <div class="gw-people">${st.participants.map(p => `<span class="gw-user">${avatarHtml(p)}${esc(p.nickname)}${p.tickets > 1 ? ` <small>×${p.tickets}</small>` : ''}</span>`).join('') || `<span class="text-dim">${esc(t('En attente des participants…'))}</span>`}</div>`;
            } catch (e) { box.innerHTML = `<span class="text-dim">❌ ${esc(e.message)}</span>`; }
        },
        poll() {
            clearInterval(this.timer);
            this.refresh();
            Drop.refresh();
            this.timer = setInterval(() => {
                if (document.getElementById('giveaway-section')?.style.display === 'none') { clearInterval(this.timer); this.timer = null; return; }
                this.refresh(); Drop.refresh();
            }, 1500);
        }
    };

    const Drop = {
        async start() {
            try {
                await api('/api/pointsdrop/start', { method: 'POST', body: {
                    amount: Number(val('pd-amount')), keyword: val('pd-keyword'), duration: Number(val('pd-duration')), maxCatchers: Number(val('pd-max'))
                } });
                showToast(t('Points lâchés !'), 'success');
                Giveaway.poll();
            } catch (e) { showToast('❌ ' + e.message, 'error'); }
        },
        async stop() {
            try { await api('/api/pointsdrop/stop', { method: 'POST' }); this.refresh(); } catch (e) { showToast('❌ ' + e.message, 'error'); }
        },
        async refresh() {
            const box = document.getElementById('pd-live');
            if (!box) return;
            try {
                const st = await api('/api/pointsdrop/state');
                if (!st.id) { box.innerHTML = `<span class="text-dim">${esc(t('Aucun drop en cours.'))}</span>`; return; }
                box.innerHTML = `<div class="gw-head"><b>🪙 ${fmt(st.perViewer)} points</b> · ${esc(st.keyword)}
                    <span class="gw-status ${st.running ? 'open' : 'closed'}">${esc(t(st.running ? 'En cours' : 'Terminé'))}</span></div>
                    <div class="gw-stats"><span>🙋 ${st.catchers.length} / ${st.maxCatchers}</span>${st.running ? `<span>⏱️ ${Math.max(0, Math.ceil((st.endsAt - Date.now()) / 1000))}s</span>` : ''}</div>
                    <div class="gw-people">${st.catchers.map(c => `<span class="gw-user">${avatarHtml(c)}${esc(c.nickname)} <small>+${fmt(c.points)}</small></span>`).join('')}</div>`;
            } catch (e) { box.innerHTML = `<span class="text-dim">❌ ${esc(e.message)}</span>`; }
        }
    };

    // ------------------------------------------------------------------ simulator
    const Sim = {
        gifts: [],
        async loadGifts() {
            if (this.gifts.length) return;
            try {
                const res = await fetch(`${getApiBase()}/api/gifts`);
                this.gifts = await res.json();
                const list = document.getElementById('sim-gift-list');
                if (list) list.innerHTML = this.gifts.slice(0, 600).map(g => `<option value="${esc(g.name)}">${g.price} 🪙</option>`).join('');
            } catch (e) { /* offline: Rose by default */ }
        },
        log(text) {
            const box = document.getElementById('sim-log');
            if (!box) return;
            const line = document.createElement('div');
            line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
            box.prepend(line);
            while (box.children.length > 50) box.lastChild.remove();
        },
        async send(type) {
            const body = {
                type,
                uniqueId: document.getElementById('sim-user').value.trim() || 'gentok_test',
                followRole: document.getElementById('sim-follower').checked ? 1 : 0,
                isSubscriber: document.getElementById('sim-sub').checked,
                isModerator: document.getElementById('sim-mod').checked
            };
            if (type === 'like') body.likeCount = parseInt(document.getElementById('sim-likes').value) || 15;
            if (type === 'chat' || type === 'question') body.comment = document.getElementById('sim-comment').value;
            if (type === 'gift') {
                const name = document.getElementById('sim-gift').value.trim().toLowerCase();
                const g = this.gifts.find(x => (x.name || '').toLowerCase() === name) || { id: 5655, name: 'Rose', price: 1 };
                Object.assign(body, { giftId: g.id, giftName: g.name, coins: g.price || 1, giftIcon: g.icon || g.url, count: parseInt(document.getElementById('sim-gift-count').value) || 1, combo: document.getElementById('sim-gift-combo').checked });
            }
            try {
                await api('/api/simulate', { method: 'POST', body });
                this.log(`✅ ${type}${body.giftName ? ` ${body.count}× ${body.giftName}` : ''}${body.comment ? ` « ${body.comment} »` : ''} (@${body.uniqueId})`);
            } catch (e) {
                this.log(`❌ ${e.message}`);
            }
        }
    };

    // ------------------------------------------------------------------ overlay styling (fonts / colors)
    const FONTS = ['Outfit', 'Inter', 'Poppins', 'Montserrat', 'Roboto', 'Nunito', 'Rubik', 'Quicksand', 'Comfortaa', 'Oswald',
        'Bebas Neue', 'Anton', 'Luckiest Guy', 'Bangers', 'Bungee', 'Russo One', 'Righteous', 'Fredoka', 'Baloo 2',
        'Orbitron', 'Audiowide', 'Exo 2', 'Press Start 2P', 'Permanent Marker', 'Pacifico', 'Lobster', 'Fasthand'];
    window.GENTOK_FONTS = FONTS;

    function loadGoogleFont(font) {
        if (!font) return;
        const id = 'gf-' + font.replace(/\s+/g, '-');
        if (document.getElementById(id)) return;
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}&display=swap`;
        document.head.appendChild(link);
    }

    const OVERLAY_THEMES = [['glass', 'Verre'], ['dark', 'Sombre'], ['light', 'Clair'], ['neon', 'Néon'], ['gradient', 'Dégradé'],
        ['minimal', 'Minimal'], ['candy', 'Bonbon'], ['retro', 'Rétro'], ['cyber', 'Cyber'], ['tiktok', 'TikTok']];

    function setupOverlayStyleBar() {
        const body = document.querySelector('#overlay-item-pro .overlay-body');
        if (!body || body.querySelector('.overlay-style-bar')) return;
        const bar = document.createElement('div');
        bar.className = 'overlay-style-bar';
        bar.innerHTML = `
            <div class="pro-field"><label>${esc(t('Police des overlays'))}</label>
                <select id="ovl-font" class="form-select"><option value="">${esc(t('Par défaut'))}</option>${FONTS.map(f => `<option value="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</option>`).join('')}</select></div>
            <div class="pro-field"><label>${esc(t('Style des overlays'))}</label>
                <select id="ovl-theme" class="form-select"><option value="">${esc(t('Par défaut'))}</option>${OVERLAY_THEMES.map(([v, l]) => `<option value="${v}">${esc(t(l))}</option>`).join('')}</select></div>
            <div class="pro-field" style="min-width:110px;flex:0"><label>${esc(t('Couleur principale'))}</label><input type="color" id="ovl-color" value="#fe2c55"></div>
            <div class="pro-field" style="min-width:110px;flex:0"><label>${esc(t('Couleur 2'))}</label><input type="color" id="ovl-color2" value="#ff8a00"></div>
            <div class="pro-field" id="ovl-font-preview" style="font-size:1.4rem;font-weight:800;padding-bottom:6px;">Gentok 123 ❤️</div>`;
        body.insertBefore(bar, body.querySelector('.overlay-list'));
        FONTS.forEach(loadGoogleFont);

        let saved = {};
        try { saved = JSON.parse(localStorage.getItem('gentok_overlay_style') || '{}'); } catch (e) { }
        if (saved.font) bar.querySelector('#ovl-font').value = saved.font;
        if (saved.theme) bar.querySelector('#ovl-theme').value = saved.theme;
        if (saved.color) bar.querySelector('#ovl-color').value = saved.color;
        if (saved.color2) bar.querySelector('#ovl-color2').value = saved.color2;

        const apply = () => {
            const font = bar.querySelector('#ovl-font').value;
            const theme = bar.querySelector('#ovl-theme').value;
            const color = bar.querySelector('#ovl-color').value;
            const color2 = bar.querySelector('#ovl-color2').value;
            try { localStorage.setItem('gentok_overlay_style', JSON.stringify({ font, theme, color, color2 })); } catch (e) { }
            bar.querySelector('#ovl-font-preview').style.fontFamily = font ? `'${font}'` : '';
            bar.querySelector('#ovl-font-preview').style.color = color;
            document.querySelectorAll('#overlay-item-pro input[readonly]').forEach(inp => {
                if (!inp.dataset.base) inp.dataset.base = inp.value.split(/[?&]token=/)[0];
                const url = new URL(inp.dataset.base);
                url.searchParams.delete('font'); url.searchParams.delete('color'); url.searchParams.delete('color2');
                if (font) url.searchParams.set('font', font);
                if (theme) url.searchParams.set('theme', theme); // replaces the overlay's own default style
                if (color && color.toLowerCase() !== '#fe2c55') url.searchParams.set('color', color.replace('#', ''));
                if (color2 && color2.toLowerCase() !== '#ff8a00') url.searchParams.set('color2', color2.replace('#', ''));
                inp.value = url.toString();
            });
            if (typeof updateOverlayLinks === 'function') updateOverlayLinks();
        };
        bar.addEventListener('input', apply);
        apply();
        addPreviewButtons();
    }

    // "Aperçu": shows the overlay in demo mode (fake events) with the chosen style, without being live
    function addPreviewButtons() {
        document.querySelectorAll('#overlay-item-pro .overlay-sub-item .input-group').forEach(group => {
            if (group.querySelector('.ovl-preview-btn')) return;
            const btn = document.createElement('button');
            btn.className = 'btn-secondary ovl-preview-btn';
            btn.title = t('Aperçu');
            btn.innerHTML = '<i class="fas fa-eye"></i>';
            btn.addEventListener('click', () => {
                const input = group.querySelector('input[readonly]');
                if (input) openOverlayPreview(input.value, group.closest('.overlay-sub-item').querySelector('label').textContent.trim());
            });
            group.appendChild(btn);
        });
    }

    function openOverlayPreview(rawUrl, title) {
        let url;
        try { url = new URL(rawUrl, window.location.origin); } catch (e) { return; }
        url.searchParams.set('demo', '1');
        // The preview is served by the server the dashboard talks to
        const src = getApiBase() + url.pathname + url.search;
        let modal = document.getElementById('ovl-preview-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ovl-preview-modal';
            modal.className = 'ovl-preview-modal';
            modal.innerHTML = `<div class="ovl-preview-box"><div class="ovl-preview-head"><b></b>
                <div class="ovl-preview-bg"><button data-bg="checker" class="active">▦</button><button data-bg="dark">●</button><button data-bg="light">○</button><button data-bg="game">🎮</button></div>
                <button class="btn-secondary ovl-preview-close"><i class="fas fa-times"></i></button></div>
                <div class="ovl-preview-stage bg-checker"><iframe></iframe></div>
                <p class="ovl-preview-hint">${esc(t('Aperçu en mode démo : les événements sont simulés. Le fond n\'apparaît pas dans OBS.'))}</p></div>`;
            document.body.appendChild(modal);
            const close = () => { modal.classList.remove('open'); modal.querySelector('iframe').src = 'about:blank'; };
            modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
            modal.querySelector('.ovl-preview-close').addEventListener('click', close);
            modal.querySelectorAll('[data-bg]').forEach(b => b.addEventListener('click', () => {
                modal.querySelectorAll('[data-bg]').forEach(x => x.classList.toggle('active', x === b));
                modal.querySelector('.ovl-preview-stage').className = 'ovl-preview-stage bg-' + b.dataset.bg;
            }));
        }
        modal.querySelector('.ovl-preview-head b').textContent = title || '';
        modal.querySelector('iframe').src = src;
        modal.classList.add('open');
    }

    // Interface font (Settings > Appearance)
    function applyUiFont(font) {
        if (font) {
            loadGoogleFont(font);
            document.documentElement.style.setProperty('--ui-font', `'${font}'`);
            document.body.style.fontFamily = `'${font}', 'Outfit', sans-serif`;
        } else {
            document.body.style.fontFamily = '';
        }
    }

    function setupUiFontSetting() {
        const styleSelect = document.getElementById('setting-ui-style');
        if (!styleSelect || document.getElementById('setting-ui-font')) return;
        const group = document.createElement('div');
        group.className = 'form-group';
        group.innerHTML = `<label>${esc(t('Police de l\'interface'))}</label>
            <select id="setting-ui-font" class="form-select"><option value="">${esc(t('Police du style choisi'))} (${esc(t('Par défaut'))})</option>
            ${FONTS.filter(f => f !== 'Outfit').map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select>`;
        styleSelect.closest('.form-group').after(group);
        const sel = group.querySelector('select');
        sel.value = localStorage.getItem('gentok_ui_font') || '';
        sel.addEventListener('change', () => {
            try { localStorage.setItem('gentok_ui_font', sel.value); } catch (e) { }
            applyUiFont(sel.value);
        });
    }

    // ------------------------------------------------------------------ init
    function onSection(id) {
        if (id === 'gallery' && window.GentokGallery) window.GentokGallery.render();
        if (id === 'giveaway') Giveaway.poll();
        if (id === 'points') { Points.load(); Points.loadSettings(); }
        if (id === 'premium') Plan.load();
        if (id === 'battle') { if (!document.querySelector('#battle-teams .battle-team')) Battle.renderTeams(); Battle.poll(); }
        if (id === 'simulator') Sim.loadGifts();
        if (id === 'overlays') setupOverlayStyleBar();
    }

    document.addEventListener('DOMContentLoaded', () => {
        try { applyUiFont(localStorage.getItem('gentok_ui_font') || ''); } catch (e) { }
        setupUiFontSetting();
        setupOverlayStyleBar();
    });

    // ------------------------------------------------------------------ chat bot (TikTok account answering !score / !top)
    const Chatbot = {
        render(c) {
            const st = document.getElementById('chatbot-status');
            if (!st) return;
            const parts = [];
            parts.push(c.connected ? `<span class="ok"><i class="fas fa-circle-check"></i> ${esc(t('Compte bot connecté'))} (sessionid ${esc(c.sessionHint)})</span>`
                : `<span class="off"><i class="fas fa-circle-xmark"></i> ${esc(t('Aucun compte bot'))}</span>`);
            parts.push(c.enabled ? `<span class="ok">${esc(t('Réponses activées'))}</span>` : `<span class="off">${esc(t('Réponses désactivées'))}</span>`);
            if (!c.signKey) parts.push(`<span class="warn"><i class="fas fa-triangle-exclamation"></i> ${esc(t("Clé Euler Stream absente sur ce serveur : TikTok refusera les messages."))}</span>`);
            st.innerHTML = parts.join('');
            document.getElementById('chatbot-enabled').checked = !!c.enabled;
            document.getElementById('chatbot-scoreTemplate').value = c.scoreTemplate || '';
            document.getElementById('chatbot-topTemplate').value = c.topTemplate || '';
            document.getElementById('chatbot-minInterval').value = c.minInterval || 4;
            document.getElementById('chatbot-sessionId').value = '';
            document.getElementById('chatbot-ttTargetIdc').value = '';
        },
        async load() {
            try { this.render(await api('/api/chatbot')); } catch (e) { }
        },
        async save(extra = {}) {
            try {
                const body = {
                    enabled: document.getElementById('chatbot-enabled').checked,
                    sessionId: document.getElementById('chatbot-sessionId').value.trim(),
                    ttTargetIdc: document.getElementById('chatbot-ttTargetIdc').value.trim(),
                    scoreTemplate: document.getElementById('chatbot-scoreTemplate').value,
                    topTemplate: document.getElementById('chatbot-topTemplate').value,
                    minInterval: parseInt(document.getElementById('chatbot-minInterval').value, 10) || 4,
                    ...extra
                };
                this.render(await api('/api/chatbot', { method: 'POST', body }));
                showToast(t('Compte bot enregistré'), 'success');
            } catch (e) { showToast(e.message, 'error'); }
        },
        async test() {
            try {
                const r = await api('/api/chatbot/test', { method: 'POST', body: {} });
                showToast(r.success ? t('Message envoyé dans votre live') : t("Message non envoyé (voir Console / Logs)"), r.success ? 'success' : 'error');
            } catch (e) { showToast(e.message, 'error'); }
        },
        async disconnect() {
            const ok = await Swal.fire({ title: t('Déconnecter le compte bot ?'), text: t('Ses cookies sont supprimés de Gentok.'), icon: 'warning', showCancelButton: true, confirmButtonText: t('Déconnecter'), cancelButtonText: t('Annuler') });
            if (ok.isConfirmed) this.save({ disconnect: true });
        }
    };

    window.GentokPro = { onSection, chatbot: Chatbot, points: Points, plan: Plan, battle: Battle, sim: Sim, giveaway: Giveaway, drop: Drop, api };
})();
