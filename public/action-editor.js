/**
 * Actions page and action editor, TikFinity-like.
 *
 * - The list is a table: test / edit / duplicate / delete, name, overlay screen, duration, points +/-, what
 *   the action does, a description, and an on/off switch. A search box filters it.
 * - An action can do several things at once ("Que doit-il se passer ?", several boxes can be ticked):
 *   alert, sound, TTS, chatbot message, OBS, webhook, Minecraft, keys, Streamer.bot, wheel.
 *   Saved as `effects: [...]` with `type` = the first one (older code and old actions keep working).
 * - Optional: points given to / paid by the viewer, volume, overlay screen (with a warning when that screen
 *   is not open in OBS), cooldowns, delay, fade, gift combos, skip on next action.
 * Replaces the former single-type form (#modal-action), which stays in the page unused.
 */
(function () {
    const T = (s) => (window.GentokI18n ? window.GentokI18n.t(s) : s);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = (sel, root = document) => root.querySelector(sel);

    const EFFECTS = [
        { id: 'alert', icon: 'fa-image', label: 'Afficher une alerte (image, GIF ou vidéo + texte)' },
        { id: 'sound', icon: 'fa-music', label: 'Jouer un son' },
        { id: 'tts', icon: 'fa-volume-high', label: 'Lire un texte (TTS)' },
        { id: 'chatbot', icon: 'fa-comment-dots', label: 'Envoyer un message du chatbot' },
        { id: 'obs', icon: 'fa-video', label: 'OBS : changer de scène / afficher une source', premium: true },
        { id: 'webhook', icon: 'fa-globe', label: 'Appeler un WebHook' },
        { id: 'rcon', icon: 'fa-cube', label: 'Commande Minecraft' },
        { id: 'keyboard', icon: 'fa-keyboard', label: 'Simuler des touches' },
        { id: 'streamerbot', icon: 'fa-robot', label: 'Action Streamer.bot', premium: true },
        { id: 'wheel', icon: 'fa-dharmachakra', label: 'Roue de la fortune', premium: true }
    ];
    const EFFECT = Object.fromEntries(EFFECTS.map(e => [e.id, e]));
    const KEYS = ['{F1}', '{F2}', '{F3}', '{F4}', '{F5}', '{F6}', '{F7}', '{F8}', '{F9}', '{F10}', '{F11}', '{F12}', '{ENTER}', '{SPACE}', '{ESC}', '{TAB}',
        '{BACKSPACE}', '{DEL}', '{UP}', '{DOWN}', '{LEFT}', '{RIGHT}', '{HOME}', '{END}', ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')];
    const PLACEHOLDERS = '{nickname} {username} {giftname} {repeatcount} {coins} {comment}';

    const effectsOf = (a) => (Array.isArray(a.effects) && a.effects.length ? a.effects : [a.type]).filter(t => EFFECT[t]);
    const actionsList = () => (typeof currentActions !== 'undefined' ? currentActions : []);
    const premium = () => (typeof isPremiumUser !== 'undefined' ? isPremiumUser : false);
    const publicBase = () => (typeof PRODUCTION_URL !== 'undefined' ? PRODUCTION_URL : 'https://tiktok.gentok.fr');
    const tokenOf = () => { try { return localStorage.getItem('gentok_token') || ''; } catch (e) { return ''; } };
    const alertsUrl = (screen) => `${publicBase()}/overlay/alerts?token=${encodeURIComponent(tokenOf())}${screen > 1 ? `&screen=${screen}` : ''}`;

    // ------------------------------------------------------------------ list
    function describe(a) {
        const parts = [];
        for (const t of effectsOf(a)) {
            if (t === 'alert') parts.push(`${T('Alerte')}${a.text ? ` « ${a.text} »` : ''}${a.mediaUrl ? ' + média' : ''}`);
            else if (t === 'sound') parts.push(`${T('Son')} ${a.soundName || (a.soundUrl ? a.soundUrl.split('/').pop() : '')}`);
            else if (t === 'tts') parts.push(`TTS « ${a.ttsText !== undefined ? a.ttsText : a.text || ''} »`);
            else if (t === 'chatbot') parts.push(`Chatbot « ${a.chatText || ''} »`);
            else if (t === 'webhook') parts.push(`WebHook ${a.url || ''}`);
            else if (t === 'rcon') parts.push(`Minecraft ${a.command || ''}`);
            else if (t === 'keyboard') parts.push(`${T('Touche')} ${a.key || ''}`);
            else if (t === 'obs') parts.push(`OBS ${a.obsScene || a.obsSource || ''}`);
            else if (t === 'streamerbot') parts.push(`Streamer.bot ${a.sbActionName || a.sbActionId || ''}`);
            else if (t === 'wheel') parts.push(`${T('Roue')} (${String(a.segments || '').split('\n').filter(l => l.trim()).length} ${T('cases')})`);
        }
        return parts.join(' · ');
    }

    function renderActionsTable() {
        const table = document.getElementById('actions-table');
        const tbody = table && table.querySelector('tbody');
        if (!tbody) return;
        const list = actionsList().filter(a => a.type !== 'sound');
        if (!list.length) {
            // the original empty states (no scene yet / no action yet)
            originalRender && originalRender();
            tbody.querySelectorAll('td[colspan]').forEach(td => td.colSpan = 9);
            return;
        }
        const q = ($('#ae-search')?.value || '').trim().toLowerCase();
        const shown = q ? list.filter(a => `${a.name} ${describe(a)}`.toLowerCase().includes(q)) : list;
        tbody.innerHTML = shown.map(a => {
            const pts = Math.trunc(Number(a.points) || 0);
            const effects = effectsOf(a);
            const dur = effects.includes('alert') ? (a.alertDuration || 5) : (effects.includes('keyboard') ? `${((a.duration || 100) / 1000).toFixed(1)}` : '—');
            return `<tr class="ae-row${a.enabled === false ? ' off' : ''}" data-id="${esc(a.id)}">
                <td><input type="checkbox" class="chk-item-action" value="${esc(a.id)}" onchange="handleCheckboxChange('action')"></td>
                <td class="ae-btns">
                    <button type="button" class="ae-ib play" data-do="test" title="${esc(T('Tester'))}"><i class="fas fa-play"></i></button>
                    <button type="button" class="ae-ib" data-do="edit" title="${esc(T('Modifier'))}"><i class="fas fa-pen"></i></button>
                    <button type="button" class="ae-ib" data-do="copy" title="${esc(T('Dupliquer'))}"><i class="fas fa-clone"></i></button>
                    <button type="button" class="ae-ib del" data-do="delete" title="${esc(T('Supprimer'))}"><i class="fas fa-trash"></i></button>
                </td>
                <td class="ae-name">${esc(a.name)}</td>
                <td>${effects.includes('alert') ? `${esc(T('Écran'))} ${Number(a.screen) || 1}` : '—'}</td>
                <td>${esc(dur)}</td>
                <td class="${pts > 0 ? 'pos' : pts < 0 ? 'neg' : ''}">${pts > 0 ? '+' : ''}${pts}</td>
                <td class="ae-effs">${effects.map(t => `<i class="fas ${EFFECT[t].icon}" title="${esc(T(EFFECT[t].label))}"></i>`).join('')}</td>
                <td class="ae-desc" title="${esc(describe(a))}">${esc(describe(a))}</td>
                <td><label class="ae-switch" title="${esc(T('Activée'))}"><input type="checkbox" data-do="toggle"${a.enabled === false ? '' : ' checked'}><span></span></label></td>
            </tr>`;
        }).join('') || `<tr><td colspan="9" class="ae-none">${esc(T('Aucune action ne correspond à la recherche.'))}</td></tr>`;
    }

    function setupTable() {
        const table = document.getElementById('actions-table');
        if (!table || table.dataset.ae) return;
        table.dataset.ae = '1';
        table.classList.add('ae-table');
        table.querySelector('thead').innerHTML = `<tr>
            <th style="width:36px"><input type="checkbox" id="chk-all-actions" onclick="toggleSelectAll('action', this.checked)"></th>
            <th style="width:128px"><button class="btn-icon delete mini" id="btn-delete-all-actions" style="display:none" onclick="deleteSelectedItems('action')" title="${esc(T('Supprimer la sélection'))}"><i class="fas fa-trash"></i></button></th>
            <th>${esc(T('Nom'))}</th><th>${esc(T('Écran'))}</th><th>${esc(T('Durée (s)'))}</th><th>${esc(T('Points +/-'))}</th>
            <th>${esc(T('Effets'))}</th><th>${esc(T('Description'))}</th><th style="width:70px">${esc(T('Activée'))}</th></tr>`;

        // intro + search, like the other pages
        const header = document.querySelector('#actions-section .card-header');
        if (header && !$('#ae-search')) {
            header.insertAdjacentHTML('afterend', `<div class="ae-toolbar">
                <p>${esc(T('Que doit-il se passer ? Créez vos actions ici, puis reliez-les à des événements (un cadeau, un follow, une commande…).'))}</p>
                <label class="ae-search"><i class="fas fa-search"></i><input type="search" id="ae-search" placeholder="${esc(T('Rechercher une action…'))}"></label>
            </div>`);
            $('#ae-search').addEventListener('input', renderActionsTable);
        }

        table.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-do]');
            const row = e.target.closest('tr[data-id]');
            if (!btn || !row) return;
            const id = row.dataset.id;
            const act = btn.dataset.do;
            if (act === 'test') window.testActionWithDelay && window.testActionWithDelay(id);
            else if (act === 'edit') open(actionsList().find(a => a.id === id));
            else if (act === 'copy') duplicate(id);
            else if (act === 'delete') window.deleteItem && window.deleteItem('action', id);
        });
        table.addEventListener('change', (e) => {
            if (e.target.dataset.do !== 'toggle') return;
            const a = actionsList().find(x => x.id === e.target.closest('tr').dataset.id);
            if (!a) return;
            a.enabled = e.target.checked;
            e.target.closest('tr').classList.toggle('off', !a.enabled);
            persist();
        });
    }

    function duplicate(id) {
        const a = actionsList().find(x => x.id === id);
        if (!a) return;
        if (!premium() && actionsList().length >= 5) return limitReached();
        const copy = JSON.parse(JSON.stringify(a));
        copy.id = 'acc_' + Date.now();
        copy.name = `${a.name} (${T('copie')})`;
        actionsList().push(copy);
        persist();
        if (typeof showToast === 'function') showToast(T('Action dupliquée !'), 'success');
    }

    function limitReached() {
        if (typeof showNotify === 'function') showNotify(T('Limite atteinte'), T('Limite de 5 actions atteinte pour cette scène. Devenez Pro pour en ajouter plus !'), 'warning');
        if (typeof openProModal === 'function') openProModal();
    }

    function persist() {
        renderActionsTable();
        try { if (typeof renderSoundLinks === 'function') renderSoundLinks(); } catch (e) { }
        try { if (typeof updateActionSelect === 'function') updateActionSelect(); } catch (e) { }
        try { if (typeof updateLikesGoalActionSelect === 'function') updateLikesGoalActionSelect(); } catch (e) { }
        if (typeof syncDiff === 'function') syncDiff('actions', actionsList()).catch(console.error);
    }

    // ------------------------------------------------------------------ editor
    function effectFields(id) {
        switch (id) {
            case 'alert': return `
                <label class="ae-f"><span>${esc(T('Texte'))} <small>${esc(PLACEHOLDERS)}</small></span><input type="text" id="ae-alert-text" maxlength="300" placeholder="${esc(T('ex. Merci {nickname} pour {repeatcount} {giftname} !'))}"></label>
                <label class="ae-f"><span>${esc(T('Image, GIF ou vidéo (lien)'))}</span><input type="url" id="ae-alert-media" placeholder="https://…/animation.gif"></label>`;
            case 'sound': return `
                <label class="ae-f"><span>${esc(T('Son de la bibliothèque'))}</span><select id="ae-sound-pick"><option value="">${esc(T('Chargement…'))}</option></select></label>
                <label class="ae-f"><span>${esc(T('ou lien d\'un fichier audio'))}</span><input type="url" id="ae-sound-url" placeholder="https://…/son.mp3"></label>`;
            case 'tts': return `
                <label class="ae-f"><span>${esc(T('Texte lu à voix haute'))} <small>${esc(PLACEHOLDERS)}</small></span><input type="text" id="ae-tts-text" maxlength="300" placeholder="${esc(T('ex. {nickname} a lancé la TNT !'))}"></label>`;
            case 'chatbot': return `
                <label class="ae-f"><span>${esc(T('Message posté dans le chat du live'))} <small>${esc(PLACEHOLDERS)}</small></span><input type="text" id="ae-chat-text" maxlength="150" placeholder="${esc(T('ex. Merci @{username} !'))}"></label>
                <p class="ae-hint">${esc(T('Le compte du chatbot se règle dans Utilisateurs & Points.'))}</p>`;
            case 'webhook': return `
                <div class="ae-row2"><label class="ae-f grow"><span>URL</span><input type="url" id="ae-url" placeholder="https://…/?user={username}"></label>
                <label class="ae-f"><span>${esc(T('Méthode'))}</span><select id="ae-method"><option>GET</option><option>POST</option></select></label></div>`;
            case 'rcon': return `
                <label class="ae-f"><span>${esc(T('Commande'))} <small>{username} {playername} {giftname} {repeatcount}</small></span><input type="text" id="ae-cmd" placeholder="summon minecraft:tnt"></label>
                <p class="ae-hint">${esc(T('Serveur Minecraft : page Minecraft Box.'))}</p>`;
            case 'keyboard': return `
                <div class="ae-row2"><label class="ae-f grow"><span>${esc(T('Touche'))}</span><select id="ae-key">${KEYS.map(k => `<option value="${esc(k)}">${esc(k.replace(/[{}]/g, '').toUpperCase())}</option>`).join('')}</select></label>
                <label class="ae-f"><span>${esc(T('Maintien (ms)'))}</span><input type="number" id="ae-key-hold" min="50" max="2000" value="100"></label></div>
                <div class="ae-mods"><label><input type="checkbox" id="ae-ctrl"> CTRL</label><label><input type="checkbox" id="ae-alt"> ALT</label><label><input type="checkbox" id="ae-shift"> SHIFT</label></div>
                <p class="ae-hint">${esc(T('Les touches sont appuyées par l\'application Gentok sur votre PC.'))}</p>`;
            case 'obs': return `
                <div class="ae-row2"><label class="ae-f"><span>${esc(T('Que faire ?'))}</span><select id="ae-obs-action"><option value="scene">${esc(T('Changer de scène'))}</option><option value="source_show">${esc(T('Afficher une source'))}</option><option value="source_hide">${esc(T('Masquer une source'))}</option><option value="source_toggle">${esc(T('Basculer une source'))}</option></select></label>
                <label class="ae-f grow"><span>${esc(T('Scène'))}</span><input type="text" id="ae-obs-scene"></label></div>
                <div class="ae-row2"><label class="ae-f grow"><span>${esc(T('Source'))}</span><input type="text" id="ae-obs-source"></label>
                <label class="ae-f"><span>${esc(T('Revenir après (s)'))}</span><input type="number" id="ae-obs-duration" min="0" value="0"></label></div>
                <div class="ae-row2"><label class="ae-f grow"><span>${esc(T('OBS : adresse'))}</span><input type="text" id="f-obs-host" placeholder="127.0.0.1"></label>
                <label class="ae-f"><span>Port</span><input type="number" id="f-obs-port" placeholder="4455"></label>
                <label class="ae-f"><span>${esc(T('Mot de passe'))}</span><input type="password" id="f-obs-password" autocomplete="off"></label></div>`;
            case 'streamerbot': return `
                <div class="ae-row2"><label class="ae-f grow"><span>${esc(T('Nom de l\'action'))}</span><input type="text" id="ae-sb-name"></label>
                <label class="ae-f grow"><span>ID</span><input type="text" id="ae-sb-id"></label></div>
                <label class="ae-f"><span>${esc(T('Arguments (JSON, optionnel)'))}</span><input type="text" id="ae-sb-args" placeholder='{"level": 2}'></label>
                <div class="ae-row2"><label class="ae-f grow"><span>${esc(T('Streamer.bot : adresse'))}</span><input type="text" id="f-sb-host" placeholder="127.0.0.1"></label>
                <label class="ae-f"><span>Port</span><input type="number" id="f-sb-port" placeholder="7474"></label></div>`;
            case 'wheel': return `
                <label class="ae-f"><span>${esc(T('Cases (une par ligne, « Texte => Nom d\'une action » pour enchaîner)'))}</span><textarea id="ae-segments" rows="4" placeholder="${esc('TNT => TNT\nRien\nDanse => DANSE')}"></textarea></label>`;
        }
        return '';
    }

    function buildModal() {
        if (document.getElementById('modal-ae')) return;
        const screens = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option value="${n}">${esc(T('Écran'))} ${n}</option>`).join('');
        document.body.insertAdjacentHTML('beforeend', `
        <div id="modal-ae" class="modal hidden" style="display:none">
            <div class="modal-content card ae-modal" role="dialog" aria-modal="true" aria-labelledby="ae-title">
                <header class="ae-head"><h2 id="ae-title">${esc(T('Nouvelle action'))}</h2><button type="button" class="btn-close" data-close aria-label="${esc(T('Fermer'))}"><i class="fas fa-times"></i></button></header>
                <form id="ae-form" novalidate>
                    <div class="ae-body">
                        <section class="ae-sec">
                            <label class="ae-q" for="ae-name">${esc(T('Comment s\'appelle l\'action ?'))}</label>
                            <input type="text" id="ae-name" maxlength="80" placeholder="${esc(T('ex. Animation d\'abonnement'))}">
                        </section>
                        <section class="ae-sec">
                            <div class="ae-q">${esc(T('Que doit-il se passer ?'))} <small>${esc(T('(plusieurs choix possibles)'))}</small></div>
                            <div class="ae-effects">${EFFECTS.map(e => `
                                <div class="ae-eff" data-eff="${e.id}">
                                    <label class="ae-check"><input type="checkbox" value="${e.id}"><i class="fas ${e.icon}"></i><span>${esc(T(e.label))}</span>${e.premium ? '<em class="premium-lock">PREMIUM</em>' : ''}</label>
                                    <div class="ae-fields" hidden>${effectFields(e.id)}</div>
                                </div>`).join('')}</div>
                        </section>
                        <section class="ae-sec">
                            <div class="ae-q">${esc(T('Combien de temps l\'afficher ?'))}</div>
                            <label class="ae-line"><span>${esc(T('Durée d\'affichage (secondes)'))}</span><input type="number" id="ae-duration" min="1" max="60" value="5"></label>
                        </section>
                        <section class="ae-sec">
                            <div class="ae-q">${esc(T('Le spectateur doit-il recevoir des points ou payer pour cette action ?'))} <small>${esc(T('(optionnel)'))}</small></div>
                            <div class="ae-line"><label class="ae-check"><input type="checkbox" id="ae-add-pts"><span>${esc(T('Ajouter des points'))}</span></label><input type="number" id="ae-add-n" min="1" value="10"></div>
                            <div class="ae-line"><label class="ae-check"><input type="checkbox" id="ae-rem-pts"><span>${esc(T('Retirer des points'))}</span></label><input type="number" id="ae-rem-n" min="1" value="100"></div>
                            <p class="ae-hint">${esc(T('Retirer : si le spectateur n\'a pas assez de points, l\'action ne se lance pas.'))}</p>
                        </section>
                        <section class="ae-sec">
                            <div class="ae-q">${esc(T('Réglages supplémentaires'))} <small>${esc(T('(optionnel)'))}</small></div>
                            <label class="ae-line"><span>${esc(T('Volume du son'))}</span><input type="range" id="ae-volume" min="0" max="100" value="100"><b id="ae-volume-v">100</b></label>
                            <label class="ae-line"><span>${esc(T('Écran de l\'overlay'))}</span><select id="ae-screen">${screens}</select></label>
                            <label class="ae-line"><span>${esc(T('Cooldown global (secondes)'))}</span><input type="number" id="ae-cooldown" min="0" max="3600" value="0"></label>
                            <label class="ae-line"><span>${esc(T('Cooldown par spectateur (secondes)'))}</span><input type="number" id="ae-user-cooldown" min="0" max="86400" value="0"></label>
                            <label class="ae-line"><span>${esc(T('Délai avant exécution (secondes)'))}</span><input type="number" id="ae-delay" min="0" max="600" value="0"></label>
                            <label class="ae-line"><span>${esc(T('Fondu à l\'apparition / disparition'))}</span><input type="checkbox" id="ae-fade" checked></label>
                            <label class="ae-line"><span>${esc(T('Répéter avec les combos de cadeaux'))}</span><input type="checkbox" id="ae-combo" checked></label>
                            <label class="ae-line"><span>${esc(T('Passer dès que l\'action suivante arrive'))}</span><input type="checkbox" id="ae-skip"></label>
                            <div class="ae-screen-warn" id="ae-screen-warn" hidden></div>
                        </section>
                    </div>
                    <footer class="ae-foot">
                        <button type="button" class="btn-secondary" data-close><i class="fas fa-xmark"></i> ${esc(T('Annuler'))}</button>
                        <button type="submit" class="btn-primary"><i class="fas fa-check"></i> ${esc(T('Enregistrer'))}</button>
                    </footer>
                </form>
            </div>
        </div>`);

        const modal = document.getElementById('modal-ae');
        modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === modal) close(); });
        modal.addEventListener('change', (e) => {
            const box = e.target.closest('.ae-eff .ae-check input');
            if (box) toggleEffect(box.value, box.checked);
            if (e.target.id === 'ae-add-pts' && e.target.checked) $('#ae-rem-pts').checked = false;
            if (e.target.id === 'ae-rem-pts' && e.target.checked) $('#ae-add-pts').checked = false;
            if (e.target.id === 'ae-screen' || box) checkScreen();
            if (e.target.id === 'ae-sound-pick' && e.target.value) $('#ae-sound-url').value = e.target.value;
        });
        $('#ae-volume').addEventListener('input', (e) => { $('#ae-volume-v').textContent = e.target.value; });
        $('#ae-form').addEventListener('submit', save);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display !== 'none') close(); });
    }

    function toggleEffect(id, on) {
        const box = document.querySelector(`#modal-ae .ae-eff[data-eff="${id}"]`);
        if (!box) return;
        box.classList.toggle('on', on);
        box.querySelector('.ae-fields').hidden = !on;
        if (on && id === 'sound') loadSounds();
    }

    let soundsLoaded = false;
    async function loadSounds() {
        const sel = $('#ae-sound-pick');
        if (!sel || soundsLoaded) return;
        soundsLoaded = true;
        let sounds = [];
        try {
            const base = (typeof isLocalMode !== 'undefined' && isLocalMode) ? getLocalApiBase() : getApiBase();
            const res = await fetch(`${base}/api/sounds?token=${encodeURIComponent(tokenOf())}`);
            sounds = await res.json();
        } catch (e) { soundsLoaded = false; }
        const current = $('#ae-sound-url').value;
        const norm = (u) => (typeof normalizeUrl === 'function' ? normalizeUrl(u) : u);
        sel.innerHTML = `<option value="">${esc(T('— Choisir un son —'))}</option>` + (Array.isArray(sounds) ? sounds : []).slice(0, 400)
            .map(s => `<option value="${esc(norm(s.url))}"${norm(s.url) === current ? ' selected' : ''}>${esc(s.title)}</option>`).join('');
    }

    // warns when the chosen screen of the Alerts overlay is not open in OBS / Live Studio
    async function checkScreen() {
        const warn = $('#ae-screen-warn');
        if (!warn) return;
        const wantsScreen = $('#modal-ae .ae-eff[data-eff="alert"] input').checked;
        const screen = Number($('#ae-screen').value) || 1;
        if (!wantsScreen) { warn.hidden = true; return; }
        let screens = null;
        try {
            const res = await fetch(`${getApiBase()}/api/overlays/screens?token=${encodeURIComponent(tokenOf())}`);
            if (res.ok) screens = (await res.json()).screens;
        } catch (e) { }
        if (!Array.isArray(screens) || screens.includes(screen)) { warn.hidden = true; return; }
        const url = alertsUrl(screen);
        warn.hidden = false;
        warn.innerHTML = `<b>${esc(T('Cet écran de l\'overlay n\'est pas ouvert pour le moment !'))}</b>
            <p>${esc(T('Vous avez choisi l\'écran'))} ${screen}, ${esc(T('mais il n\'est ouvert dans aucun OBS ni Live Studio. Ajoutez-le en collant ce lien dans une source navigateur (OBS) ou une source lien (Live Studio) :'))}</p>
            <div class="ae-url"><code>${esc(url)}</code><button type="button" class="btn-secondary btn-sm" data-copy="${esc(url)}"><i class="fas fa-copy"></i> ${esc(T('Copier'))}</button></div>
            <p class="ae-hint">${esc(T('Vous avez 8 écrans : plusieurs actions peuvent partager un écran, elles passent alors chacune leur tour.'))}</p>`;
        warn.querySelector('[data-copy]').onclick = (e) => {
            navigator.clipboard.writeText(e.currentTarget.dataset.copy).then(() => typeof showToast === 'function' && showToast(T('URL copiée !'), 'success')).catch(() => { });
            try { localStorage.setItem('gentok_step_overlay', '1'); } catch (err) { }
        };
    }

    let editing = null;
    function open(action) {
        buildModal();
        if (!action && !premium() && actionsList().length >= 5) return limitReached();
        editing = action ? action.id : null;
        const a = action || {};
        const effects = action ? effectsOf(a) : [];
        $('#ae-title').textContent = T(action ? 'Modifier l\'action' : 'Nouvelle action');
        $('#ae-form').reset();
        document.querySelectorAll('#modal-ae .ae-eff').forEach(box => {
            const on = effects.includes(box.dataset.eff);
            box.querySelector('input').checked = on;
            toggleEffect(box.dataset.eff, on);
        });
        $('#ae-name').value = a.name || '';
        const set = (sel, v) => { const el = $(sel); if (el && v !== undefined && v !== null) el.value = v; };
        set('#ae-alert-text', a.text); set('#ae-alert-media', a.mediaUrl);
        set('#ae-sound-url', a.soundUrl);
        set('#ae-tts-text', a.ttsText !== undefined ? a.ttsText : (effects.includes('tts') && !effects.includes('alert') ? a.text : ''));
        set('#ae-chat-text', a.chatText);
        set('#ae-url', a.url); set('#ae-method', a.method || 'GET');
        set('#ae-cmd', a.command);
        if (a.key) {
            $('#ae-ctrl').checked = a.key.includes('^'); $('#ae-alt').checked = a.key.includes('!'); $('#ae-shift').checked = a.key.includes('+');
            const raw = a.key.replace(/^[\^!+]+/, '');
            const sel = $('#ae-key');
            if (![...sel.options].some(o => o.value === raw)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(raw)}">${esc(raw)}</option>`);
            sel.value = raw;
        }
        set('#ae-key-hold', a.duration || 100);
        set('#ae-obs-action', a.obsAction || 'scene'); set('#ae-obs-scene', a.obsScene); set('#ae-obs-source', a.obsSource); set('#ae-obs-duration', a.obsDuration || 0);
        const obs = typeof currentObsSettings !== 'undefined' ? currentObsSettings : {};
        set('#f-obs-host', obs.host || '127.0.0.1'); set('#f-obs-port', obs.port || 4455); set('#f-obs-password', obs.password || '');
        const sb = typeof currentStreamerbotSettings !== 'undefined' ? currentStreamerbotSettings : {};
        set('#f-sb-host', sb.host || '127.0.0.1'); set('#f-sb-port', sb.port || 7474);
        set('#ae-sb-name', a.sbActionName); set('#ae-sb-id', a.sbActionId); set('#ae-sb-args', a.sbArgs);
        set('#ae-segments', a.segments);
        set('#ae-duration', a.alertDuration || 5);
        const pts = Math.trunc(Number(a.points) || 0);
        $('#ae-add-pts').checked = pts > 0; $('#ae-rem-pts').checked = pts < 0;
        if (pts > 0) set('#ae-add-n', pts); if (pts < 0) set('#ae-rem-n', -pts);
        set('#ae-volume', a.volume !== undefined ? Math.round(Number(a.volume) <= 1 && Number(a.volume) > 0 && !Number.isInteger(Number(a.volume)) ? Number(a.volume) * 100 : Number(a.volume)) : 100);
        $('#ae-volume-v').textContent = $('#ae-volume').value;
        set('#ae-screen', Number(a.screen) || 1);
        set('#ae-cooldown', a.cooldown || 0); set('#ae-user-cooldown', a.userCooldown || 0); set('#ae-delay', a.delay || 0);
        $('#ae-fade').checked = a.fade !== false; $('#ae-combo').checked = a.comboRepeat !== false; $('#ae-skip').checked = !!a.skipOnNext;
        $('#ae-screen-warn').hidden = true;
        if (typeof openModal === 'function') openModal('modal-ae');
        const modal = document.getElementById('modal-ae');
        modal.classList.remove('hidden'); modal.style.display = 'flex';
        modal.querySelector('.ae-body').scrollTop = 0;
        checkScreen();
        setTimeout(() => $('#ae-name').focus(), 50);
    }

    function close() {
        if (typeof closeModal === 'function') closeModal('modal-ae');
        editing = null;
    }

    function fail(msg, sel) {
        if (typeof showToast === 'function') showToast(T(msg), 'error');
        const el = sel && $(sel);
        if (el) { el.focus(); el.classList.add('ae-bad'); setTimeout(() => el.classList.remove('ae-bad'), 1600); }
        return false;
    }

    function save(e) {
        e.preventDefault();
        const name = $('#ae-name').value.trim();
        const effects = [...document.querySelectorAll('#modal-ae .ae-eff input:checked')].map(i => i.value);
        if (!name) return fail('Donnez un nom à l\'action.', '#ae-name');
        if (!effects.length) return fail('Cochez au moins une chose qui doit se passer.');
        const previous = editing ? actionsList().find(a => a.id === editing) : null;
        const a = { id: editing || 'acc_' + Date.now(), name, type: effects[0], effects };
        if (previous && previous.enabled === false) a.enabled = false;
        const val = (sel) => ($(sel)?.value || '').trim();
        const num = (sel, min, max, def) => Math.min(Math.max(parseInt($(sel)?.value, 10) || def, min), max);

        if (effects.includes('alert')) {
            a.text = val('#ae-alert-text'); a.mediaUrl = val('#ae-alert-media');
            if (!a.text && !a.mediaUrl) return fail('Alerte : ajoutez un texte ou une image / vidéo.', '#ae-alert-text');
        }
        if (effects.includes('sound')) {
            a.soundUrl = val('#ae-sound-url');
            const pick = $('#ae-sound-pick');
            a.soundName = pick && pick.value === a.soundUrl && pick.selectedIndex > 0 ? pick.options[pick.selectedIndex].text : (previous && previous.soundUrl === a.soundUrl ? previous.soundName : a.soundUrl.split('/').pop());
            if (!a.soundUrl) return fail('Son : choisissez un son ou collez un lien.', '#ae-sound-pick');
        }
        if (effects.includes('tts')) {
            a.ttsText = val('#ae-tts-text');
            if (!effects.includes('alert')) a.text = a.ttsText; // older versions read "text"
            if (!a.ttsText) return fail('TTS : écrivez le texte à lire.', '#ae-tts-text');
        }
        if (effects.includes('chatbot')) {
            a.chatText = val('#ae-chat-text');
            if (!a.chatText) return fail('Chatbot : écrivez le message.', '#ae-chat-text');
        }
        if (effects.includes('webhook')) {
            a.url = val('#ae-url'); a.method = val('#ae-method') || 'GET';
            if (!/^https?:\/\//i.test(a.url)) return fail('WebHook : indiquez une URL http(s).', '#ae-url');
        }
        if (effects.includes('rcon')) {
            a.command = val('#ae-cmd').replace(/^\//, '');
            if (!a.command) return fail('Minecraft : écrivez la commande.', '#ae-cmd');
        }
        if (effects.includes('keyboard')) {
            a.key = ($('#ae-ctrl').checked ? '^' : '') + ($('#ae-alt').checked ? '!' : '') + ($('#ae-shift').checked ? '+' : '') + val('#ae-key');
            a.duration = num('#ae-key-hold', 50, 2000, 100);
        }
        if (effects.includes('obs')) {
            a.obsAction = val('#ae-obs-action'); a.obsScene = val('#ae-obs-scene'); a.obsSource = val('#ae-obs-source');
            a.obsDuration = num('#ae-obs-duration', 0, 3600, 0);
            if (a.obsAction === 'scene' ? !a.obsScene : !a.obsSource) return fail(a.obsAction === 'scene' ? 'OBS : indiquez le nom de la scène.' : 'OBS : indiquez le nom de la source.', a.obsAction === 'scene' ? '#ae-obs-scene' : '#ae-obs-source');
            try { if (typeof saveObsSettingsFromForm === 'function') saveObsSettingsFromForm(); } catch (err) { }
        }
        if (effects.includes('streamerbot')) {
            a.sbActionName = val('#ae-sb-name'); a.sbActionId = val('#ae-sb-id'); a.sbArgs = val('#ae-sb-args');
            if (!a.sbActionName && !a.sbActionId) return fail('Streamer.bot : indiquez le nom de l\'action.', '#ae-sb-name');
            if (a.sbArgs) { try { JSON.parse(a.sbArgs); } catch (err) { return fail('Streamer.bot : arguments JSON invalides.', '#ae-sb-args'); } }
            try { if (typeof saveStreamerbotSettingsFromForm === 'function') saveStreamerbotSettingsFromForm(); } catch (err) { }
        }
        if (effects.includes('wheel')) {
            a.segments = $('#ae-segments').value;
            if (a.segments.split('\n').filter(l => l.trim()).length < 2) return fail('Roue : il faut au moins 2 cases.', '#ae-segments');
        }
        a.alertDuration = num('#ae-duration', 1, 60, 5);
        a.points = $('#ae-add-pts').checked ? num('#ae-add-n', 1, 1e6, 10) : ($('#ae-rem-pts').checked ? -num('#ae-rem-n', 1, 1e6, 100) : 0);
        a.volume = num('#ae-volume', 0, 100, 100);
        a.screen = num('#ae-screen', 1, 8, 1);
        a.cooldown = num('#ae-cooldown', 0, 3600, 0);
        a.userCooldown = num('#ae-user-cooldown', 0, 86400, 0);
        a.delay = num('#ae-delay', 0, 600, 0);
        a.fade = $('#ae-fade').checked;
        a.comboRepeat = $('#ae-combo').checked;
        a.skipOnNext = $('#ae-skip').checked;

        const list = actionsList();
        if (previous) {
            list[list.indexOf(previous)] = a;
            if (typeof showToast === 'function') showToast(T('Action modifiée !'), 'success');
        } else {
            if (!premium() && list.length >= 5) return limitReached();
            list.push(a);
            if (typeof showToast === 'function') showToast(T('Action ajoutée !'), 'success');
        }
        close();
        persist();
        return true;
    }

    // ------------------------------------------------------------------ event form: radio lists
    // "Qui peut déclencher ?" and "Déclencheur" become two lists of choices side by side with their question,
    // instead of drop-downs. The hidden <select>s stay the source of truth for app.js.
    const RADIO_SELECTS = [['event-who', 'Qui peut déclencher l\'événement ?'], ['event-trigger-type', 'Par quoi est-il déclenché ?']];
    function syncRadios(id) {
        const sel = document.getElementById(id);
        const box = document.getElementById(`ev-radios-${id}`);
        if (!sel || !box) return;
        box.querySelectorAll('input').forEach(r => { r.checked = r.value === sel.value; r.closest('label').classList.toggle('on', r.checked); });
    }
    function setupEventRadios() {
        for (const [id, question] of RADIO_SELECTS) {
            const sel = document.getElementById(id);
            const wrapper = document.getElementById(`cs-${id}`);
            if (!sel || !wrapper || document.getElementById(`ev-radios-${id}`)) continue;
            const group = wrapper.closest('.form-group');
            const icons = {};
            wrapper.querySelectorAll('.custom-option').forEach(o => { const i = o.querySelector('i'); if (i) icons[o.dataset.value] = i.className; });
            const opts = [...sel.options].filter(o => !o.disabled);
            group.classList.add('ev-pick');
            const label = group.querySelector(':scope > label');
            if (label) label.textContent = T(question);
            wrapper.style.display = 'none';
            wrapper.insertAdjacentHTML('afterend', `<div class="ev-radios" id="ev-radios-${id}" role="radiogroup">${opts.map(o => `
                <label><input type="radio" name="ev-${id}" value="${esc(o.value)}"><i class="${esc(icons[o.value] || 'fas fa-circle')}"></i><span>${esc(o.textContent.trim())}</span></label>`).join('')}</div>`);
            document.getElementById(`ev-radios-${id}`).addEventListener('change', (e) => {
                sel.value = e.target.value;
                if (typeof sel.onchange === 'function') sel.onchange();
                if (typeof window.syncCustomSelect === 'function') window.syncCustomSelect(id);
                syncRadios(id);
            });
            syncRadios(id);
        }
        const originalSync = window.syncCustomSelect;
        if (typeof originalSync === 'function' && !originalSync.__radios) {
            const wrapped = function (id) { const r = originalSync.apply(this, arguments); syncRadios(id); return r; };
            wrapped.__radios = true;
            window.syncCustomSelect = wrapped;
        }
    }

    // ------------------------------------------------------------------ hooks into app.js
    let originalRender = null;
    function start() {
        if (typeof window.renderActions !== 'function') return;
        originalRender = window.renderActions;
        window.renderActions = function () {
            setupTable();
            renderActionsTable();
        };
        setupTable();
        if (actionsList().length) renderActionsTable();

        // "Créer Action" (and the empty-state button that clicks it) opens the new editor
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#btn-new-action')) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            open(null);
        }, true);

        // edit buttons elsewhere (soundboard links keep their own form)
        const originalEdit = window.editItem;
        window.editItem = function (type, id) {
            if (type === 'action') {
                const a = actionsList().find(x => x.id === id);
                if (a && a.type !== 'sound') return open(a);
            }
            return originalEdit.apply(this, arguments);
        };
        buildModal();
        setupEventRadios();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.GentokActionEditor = { open: (id) => open(id ? actionsList().find(a => a.id === id) : null), effectsOf, describe };
})();
