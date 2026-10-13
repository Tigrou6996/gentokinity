/**
 * Home page (dashboard), first-login tutorial and the short help shown at the top of each page.
 *
 * - Home: live status and the main button, the live counters, a "getting started" checklist that ticks
 *   itself, the live activity in real time and shortcuts to the main pages.
 * - Tutorial: shown once, the first time an account opens the dashboard (Next / Back / Skip, Esc to
 *   close, arrows to move). It can be replayed from the home page.
 * - Page help: one sentence explaining what the page is for, which can be hidden.
 * Texts are written in French and translated by i18n.js like the rest of the dashboard.
 */
(function () {
    const T = (s) => (window.GentokI18n ? window.GentokI18n.t(s) : s);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const store = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
    };
    const go = (id) => { if (typeof window.showSection === 'function') window.showSection(id); location.hash = id; };

    // ------------------------------------------------------------------ Home
    const STEPS = [
        { id: 'username', icon: 'fa-at', title: 'Indiquer votre pseudo TikTok', text: 'Le compte dont Gentok suit le live.', btn: 'Renseigner',
            done: () => !!(document.getElementById('header-username')?.value || '').trim(),
            run: () => { const i = document.getElementById('header-username'); if (i) { i.focus(); i.select(); } } },
        { id: 'action', icon: 'fa-bolt', title: 'Créer une action', text: 'Ce qui se passe : un son, une voix, une vidéo, une touche…', btn: 'Actions',
            done: () => (typeof currentActions !== 'undefined' && currentActions.length > 0), run: () => go('actions') },
        { id: 'event', icon: 'fa-link', title: 'La relier à un événement', text: 'Un cadeau, un follow ou une commande déclenche l\'action.', btn: 'Événements',
            done: () => (typeof currentEvents !== 'undefined' && currentEvents.length > 0), run: () => go('events') },
        { id: 'overlay', icon: 'fa-layer-group', title: 'Ajouter un overlay dans OBS', text: 'Copiez un lien et collez-le dans une « source navigateur ».', btn: 'Galerie',
            done: () => store.get('gentok_step_overlay') === '1', run: () => go('gallery') },
        { id: 'test', icon: 'fa-flask', title: 'Tester sans être en live', text: 'Le simulateur envoie de faux cadeaux et follows.', btn: 'Simulateur',
            done: () => store.get('gentok_step_test') === '1', run: () => go('simulator') }
    ];

    const SHORTCUTS = [
        ['actions', 'fa-bolt', 'Actions', 'Sons, voix, vidéos, touches'],
        ['events', 'fa-link', 'Événements', 'Quand déclencher les actions'],
        ['gallery', 'fa-layer-group', 'Overlays', 'Widgets pour OBS / Live Studio'],
        ['soundboard', 'fa-music', 'Soundboard', 'Vos sons en un clic'],
        ['points', 'fa-star', 'Points', 'Fidélité et niveaux des viewers'],
        ['settings', 'fa-gear', 'Paramètres', 'Compte, style et options']
    ];

    const FEED_MAX = 40;
    const feed = [];

    function homeHtml() {
        return `
        <section class="home-hero card" id="home-hero">
            <div class="hh-text">
                <span class="hh-status" id="hh-status"><i></i><b>Hors ligne</b></span>
                <h2 id="hh-title">Bienvenue sur Gentok 👋</h2>
                <p id="hh-sub">Connectez votre live TikTok : vos actions, sons et overlays réagiront aux cadeaux, follows et messages.</p>
            </div>
            <div class="hh-actions">
                <button type="button" class="btn-primary" id="hh-live"><i class="fas fa-play"></i><span>Connecter le live</span></button>
                <button type="button" class="btn-secondary" id="hh-tour"><i class="fas fa-circle-question"></i><span>Revoir le tutoriel</span></button>
            </div>
        </section>`;
    }

    function panelsHtml() {
        return `
        <div class="home-grid" id="home-grid">
            <section class="card home-card" id="home-start">
                <header class="hc-head">
                    <h3><i class="fas fa-flag-checkered"></i> Pour bien démarrer</h3>
                    <span class="hc-count" id="hs-count"></span>
                </header>
                <div class="hs-bar"><i id="hs-bar"></i></div>
                <ol class="hs-list" id="hs-list"></ol>
                <p class="hs-done" id="hs-done" hidden><i class="fas fa-circle-check"></i> Tout est prêt. Bon live !</p>
            </section>
            <section class="card home-card" id="home-feed">
                <header class="hc-head">
                    <h3><i class="fas fa-wave-square"></i> Activité du live</h3>
                    <button type="button" class="hc-link" id="hf-clear" hidden>Effacer</button>
                </header>
                <ul class="hf-list" id="hf-list"></ul>
                <div class="hf-empty" id="hf-empty">
                    <i class="fas fa-satellite-dish"></i>
                    <p>Rien pour l'instant. Pendant le live, les cadeaux, follows, partages et messages apparaîtront ici en direct.</p>
                    <button type="button" class="btn-secondary btn-sm" data-go="simulator"><i class="fas fa-flask"></i> Essayer le simulateur</button>
                </div>
            </section>
        </div>
        <section class="home-shortcuts" id="home-shortcuts">
            ${SHORTCUTS.map(([id, icon, title, text]) => `
                <button type="button" class="hk" data-go="${id}">
                    <span class="hk-icon"><i class="fas ${icon}"></i></span>
                    <span class="hk-text"><b>${esc(title)}</b><small>${esc(text)}</small></span>
                    <i class="fas fa-chevron-right hk-go"></i>
                </button>`).join('')}
        </section>`;
    }

    function renderSteps() {
        const list = document.getElementById('hs-list');
        if (!list) return;
        const states = STEPS.map(s => { try { return !!s.done(); } catch (e) { return false; } });
        const n = states.filter(Boolean).length;
        const firstTodo = states.indexOf(false);
        list.innerHTML = STEPS.map((s, i) => `
            <li class="hs-step${states[i] ? ' done' : ''}${i === firstTodo ? ' next' : ''}" data-step="${s.id}">
                <span class="hs-check">${states[i] ? '<i class="fas fa-check"></i>' : i + 1}</span>
                <span class="hs-text"><b>${esc(s.title)}</b><small>${esc(s.text)}</small></span>
                ${states[i] ? '' : `<button type="button" class="btn-secondary btn-sm" data-step-run="${s.id}">${esc(s.btn)}</button>`}
            </li>`).join('');
        document.getElementById('hs-count').textContent = `${n} / ${STEPS.length}`;
        document.getElementById('hs-bar').style.width = `${Math.round(n / STEPS.length * 100)}%`;
        const all = n === STEPS.length;
        document.getElementById('hs-done').hidden = !all;
        document.getElementById('home-start').classList.toggle('complete', all);
    }

    function isLive() {
        const btn = document.getElementById('btn-start');
        return !!(btn && btn.querySelector('.fa-stop'));
    }
    function isConnecting() {
        const btn = document.getElementById('btn-start');
        return !!(btn && btn.querySelector('.fa-spinner'));
    }

    function renderStatus() {
        const hero = document.getElementById('home-hero');
        if (!hero) return;
        const live = isLive(), connecting = !live && isConnecting();
        const name = (document.getElementById('header-username')?.value || '').trim().replace(/^@/, '');
        hero.classList.toggle('is-live', live);
        hero.classList.toggle('is-connecting', connecting);
        document.querySelector('#hh-status b').textContent = T(live ? 'En direct' : connecting ? 'Connexion…' : 'Hors ligne');
        document.getElementById('hh-title').textContent = live
            ? (name ? `@${name} ${T('est en live 🔴')}` : T('Vous êtes en live 🔴'))
            : (name ? `${T('Bonjour')} @${name} 👋` : T('Bienvenue sur Gentok 👋'));
        document.getElementById('hh-sub').textContent = T(live
            ? 'Gentok reçoit les événements de votre live en temps réel. Les compteurs et l\'activité ci-dessous se mettent à jour tout seuls.'
            : 'Connectez votre live TikTok : vos actions, sons et overlays réagiront aux cadeaux, follows et messages.');
        const btn = document.getElementById('hh-live');
        btn.innerHTML = live ? `<i class="fas fa-stop"></i><span>${esc(T('Arrêter'))}</span>` : `<i class="fas fa-play"></i><span>${esc(T('Connecter le live'))}</span>`;
        btn.disabled = connecting;
    }

    const FEED_LABEL = {
        gift: (d) => `${T('a envoyé')} ${d.repeatCount > 1 ? `${d.repeatCount}× ` : ''}${d.giftName || T('un cadeau')}`,
        follow: () => T('vous suit maintenant'),
        share: () => T('a partagé le live'),
        subscribe: () => T('s\'est abonné(e)'),
        question: (d) => `${T('a posé une question')} : ${d.question || ''}`,
        chat: (d) => d.comment || ''
    };
    const FEED_ICON = { gift: 'fa-gift', follow: 'fa-user-plus', share: 'fa-share', subscribe: 'fa-star', question: 'fa-circle-question', chat: 'fa-comment' };

    function addFeed(type, d) {
        if (!d || !FEED_LABEL[type]) return;
        feed.unshift({ type, d, at: new Date() });
        if (feed.length > FEED_MAX) feed.length = FEED_MAX;
        renderFeed();
    }

    function renderFeed() {
        const list = document.getElementById('hf-list');
        if (!list) return;
        document.getElementById('hf-empty').hidden = feed.length > 0;
        document.getElementById('hf-clear').hidden = feed.length === 0;
        list.innerHTML = feed.map(({ type, d, at }) => `
            <li class="hf-item hf-${type}">
                <span class="hf-icon"><i class="fas ${FEED_ICON[type]}"></i></span>
                <span class="hf-text"><b>${esc(d.nickname || d.uniqueId || T('Anonyme'))}</b> ${esc(FEED_LABEL[type](d))}</span>
                ${type === 'gift' && d.coins ? `<span class="hf-coins">${esc(d.coins)} <i class="fas fa-coins"></i></span>` : ''}
                <time>${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
            </li>`).join('');
    }

    // the dashboard socket is created (and sometimes re-created) by app.js
    let boundSocket = null;
    function bindSocket() {
        const s = typeof socket !== 'undefined' ? socket : null;
        if (!s || s === boundSocket) return;
        boundSocket = s;
        s.on('tiktok_alert', (p) => { if (p && p.type) addFeed(p.type, p.data); });
        s.on('chat', (d) => addFeed('chat', d));
        s.on('sync_config', () => setTimeout(renderSteps, 300));
    }

    function buildHome() {
        const section = document.getElementById('dashboard-section');
        if (!section || document.getElementById('home-hero')) return;
        const grid = section.querySelector('.stat-grid');
        if (!grid) return;
        grid.insertAdjacentHTML('beforebegin', homeHtml());
        grid.insertAdjacentHTML('afterend', panelsHtml());
        section.classList.add('home-ready');

        section.addEventListener('click', (e) => {
            const run = e.target.closest('[data-step-run]');
            if (run) { const s = STEPS.find(x => x.id === run.dataset.stepRun); if (s) s.run(); return; }
            const to = e.target.closest('[data-go]');
            if (to) go(to.dataset.go);
        });
        document.getElementById('hh-live').addEventListener('click', () => document.getElementById('btn-start')?.click());
        document.getElementById('hh-tour').addEventListener('click', () => Tour.start());
        document.getElementById('hf-clear').addEventListener('click', () => { feed.length = 0; renderFeed(); });

        const btn = document.getElementById('btn-start');
        if (btn) new MutationObserver(renderStatus).observe(btn, { childList: true, subtree: true });
        document.getElementById('header-username')?.addEventListener('change', () => { renderStatus(); renderSteps(); });
        renderStatus();
        renderSteps();
        renderFeed();
    }

    // ------------------------------------------------------------------ Page help
    const HELP = {
        actions: 'Une action, c\'est ce qui se passe : jouer un son, lire un texte (TTS), afficher une vidéo, appuyer sur une touche, envoyer une commande Minecraft… Créez-la ici, puis reliez-la à un événement.',
        events: 'Un événement relie un déclencheur (un cadeau précis, un follow, X likes, une commande !chat…) à une ou plusieurs actions.',
        presets: 'Les scènes regroupent actions, événements et réglages. Passez d\'une scène à l\'autre depuis le menu, ou partagez-les avec un code.',
        overlays: 'Copiez le lien d\'un overlay et ajoutez-le dans OBS ou TikTok Live Studio comme « source navigateur ». L\'aperçu montre un exemple hors live et vos vraies données en live.',
        gallery: 'Choisissez un overlay, personnalisez-le, puis copiez son lien dans OBS ou TikTok Live Studio (source navigateur).',
        soundboard: 'Vos sons rangés en boutons : cliquez pour les jouer pendant le live, ou utilisez-les dans vos actions.',
        'tts-chat': 'La synthèse vocale lit les messages du chat (et, si vous le voulez, les cadeaux et follows). Choisissez qui y a droit et la voix.',
        points: 'Les viewers gagnent des points en regardant, en écrivant et en envoyant des cadeaux. Ils montent de niveau et peuvent les utiliser avec des commandes.',
        simulator: 'Envoyez de faux cadeaux, follows et messages pour tester vos actions et overlays sans être en live.',
        stats: 'Le bilan de chacun de vos lives : durée, diamants, cadeaux, spectateurs.',
        ranking: 'Les meilleurs soutiens de vos lives, sur la semaine ou depuis le début.',
        settings: 'Votre compte, l\'apparence de Gentok et les options générales.'
    };

    function showHelp(id) {
        if (id === 'overlays') store.set('gentok_step_overlay', '1');
        if (id === 'simulator') store.set('gentok_step_test', '1');
        const text = HELP[id];
        const section = document.getElementById(`${id}-section`);
        if (!text || !section || store.get(`gentok_help_off_${id}`) === '1' || section.querySelector(':scope > .page-help')) return;
        const div = document.createElement('div');
        div.className = 'page-help';
        div.innerHTML = `<i class="fas fa-lightbulb"></i><p>${esc(text)}</p><button type="button" aria-label="${esc('Masquer')}" title="${esc('Masquer')}"><i class="fas fa-xmark"></i></button>`;
        div.querySelector('button').addEventListener('click', () => { store.set(`gentok_help_off_${id}`, '1'); div.remove(); });
        section.prepend(div);
    }

    // copying an overlay link counts as "added an overlay"
    document.addEventListener('click', (e) => {
        if (e.target.closest('#gallery-section [data-act="copy"], #gallery-section .gal-copy, #overlays-section .btn-secondary .fa-copy, #overlays-section button .fa-copy')) {
            store.set('gentok_step_overlay', '1');
        }
    }, true);

    // ------------------------------------------------------------------ Tutorial
    const TOUR = [
        { title: 'Bienvenue sur Gentok 👋', text: 'Gentok fait réagir votre live TikTok : sons, voix, overlays et jeux quand on vous envoie un cadeau, un follow ou un message. Petit tour en 1 minute ?' },
        { el: '#header-username', title: 'Votre pseudo TikTok', text: 'Indiquez ici le compte dont Gentok doit suivre le live (sans le @).' },
        { el: '#btn-start', title: 'Connexion Live', text: 'Quand vous êtes en live sur TikTok, cliquez ici. Gentok reçoit alors cadeaux, likes, follows et messages en temps réel.' },
        { el: '#cs-active-scene', title: 'Les scènes', text: 'Chaque scène a ses propres actions, événements et réglages : une pour vos lives jeux, une pour vos lives discussion…' },
        { el: '.nav-links a[href="#actions"]', title: 'Actions', text: 'Ce qui se passe : jouer un son, lire un texte, afficher une vidéo, appuyer sur une touche, Minecraft…' },
        { el: '.nav-links a[href="#events"]', title: 'Événements', text: 'Reliez un déclencheur (une Rose, un follow, 100 likes, la commande !danse…) à une ou plusieurs actions.' },
        { el: '.nav-links a[href="#gallery"]', title: 'Overlays', text: 'Des widgets pour votre live : alertes, objectifs, classements… Copiez un lien et ajoutez-le dans OBS ou TikTok Live Studio.' },
        { el: '.nav-links a[href="#simulator"]', title: 'Simulateur', text: 'Testez tout sans être en live, avec de faux cadeaux et follows.' },
        { el: '#home-start', title: 'Votre guide de démarrage', text: 'Suivez ces étapes depuis l\'accueil : elles se cochent toutes seules au fur et à mesure.' },
        { title: 'C\'est parti ! 🚀', text: 'Vous pouvez revoir ce tutoriel à tout moment avec le bouton « Revoir le tutoriel » de l\'accueil.' }
    ];
    const TOUR_KEY = 'gentok_tour_done';

    const Tour = {
        i: 0, root: null,
        start() {
            this.stop(false);
            go('dashboard');
            this.i = 0;
            this.root = document.createElement('div');
            this.root.className = 'tour';
            this.root.innerHTML = `
                <div class="tour-hole"></div>
                <div class="tour-pop" role="dialog" aria-modal="true" aria-labelledby="tour-title">
                    <div class="tour-dots"></div>
                    <h3 id="tour-title"></h3>
                    <p class="tour-text"></p>
                    <div class="tour-nav">
                        <button type="button" class="tour-skip">${esc('Passer')}</button>
                        <span></span>
                        <button type="button" class="btn-secondary btn-sm tour-prev">${esc('Précédent')}</button>
                        <button type="button" class="btn-primary btn-sm tour-next">${esc('Suivant')}</button>
                    </div>
                </div>`;
            document.body.appendChild(this.root);
            this.root.querySelector('.tour-skip').addEventListener('click', () => this.stop(true));
            this.root.querySelector('.tour-prev').addEventListener('click', () => this.show(this.i - 1));
            this.root.querySelector('.tour-next').addEventListener('click', () => this.i >= TOUR.length - 1 ? this.stop(true) : this.show(this.i + 1));
            this.onKey = (e) => {
                if (e.key === 'Escape') this.stop(true);
                else if (e.key === 'ArrowRight' || e.key === 'Enter') this.root.querySelector('.tour-next').click();
                else if (e.key === 'ArrowLeft' && this.i > 0) this.show(this.i - 1);
            };
            this.onResize = () => this.place();
            document.addEventListener('keydown', this.onKey);
            window.addEventListener('resize', this.onResize);
            // a dialog that opens meanwhile (session, announcement...) comes first: the tour comes back after it
            this.guard = setInterval(() => { if (dialogOpen()) { this.stop(false); maybeStartTour(); } }, 700);
            this.show(0);
        },
        target() {
            const s = TOUR[this.i];
            const el = s.el && document.querySelector(s.el);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 ? el : null;
        },
        show(i) {
            if (!this.root) return;
            this.i = Math.max(0, Math.min(TOUR.length - 1, i));
            const s = TOUR[this.i];
            const el = this.target();
            if (el) el.scrollIntoView({ block: 'nearest' });
            this.root.querySelector('#tour-title').textContent = T(s.title);
            this.root.querySelector('.tour-text').textContent = T(s.text);
            this.root.querySelector('.tour-dots').innerHTML = TOUR.map((_, k) => `<i class="${k === this.i ? 'on' : k < this.i ? 'past' : ''}"></i>`).join('');
            this.root.querySelector('.tour-prev').hidden = this.i === 0;
            this.root.querySelector('.tour-next').textContent = T(this.i === TOUR.length - 1 ? 'Terminer' : this.i === 0 ? 'Commencer' : 'Suivant');
            this.root.querySelector('.tour-skip').hidden = this.i === TOUR.length - 1;
            this.place();
            this.root.querySelector('.tour-next').focus({ preventScroll: true });
        },
        place() {
            if (!this.root) return;
            const hole = this.root.querySelector('.tour-hole');
            const pop = this.root.querySelector('.tour-pop');
            const el = this.target();
            this.root.classList.toggle('centered', !el);
            if (!el) { hole.removeAttribute('style'); pop.removeAttribute('style'); return; }
            const r = el.getBoundingClientRect(), pad = 6, gap = 14;
            Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
            const pw = pop.offsetWidth, ph = pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
            let left, top;
            if (r.right + gap + pw < vw - 12 && r.left < vw / 2) { left = r.right + gap; top = r.top + r.height / 2 - ph / 2; } // right of it (menu)
            else if (r.bottom + gap + ph < vh - 12) { top = r.bottom + gap; left = r.left + r.width / 2 - pw / 2; } // below (header)
            else { top = r.top - gap - ph; left = r.left + r.width / 2 - pw / 2; } // above
            pop.style.left = `${Math.max(12, Math.min(vw - pw - 12, left))}px`;
            pop.style.top = `${Math.max(12, Math.min(vh - ph - 12, top))}px`;
        },
        stop(done) {
            if (done) store.set(TOUR_KEY, '1');
            if (!this.root) return;
            clearInterval(this.guard);
            document.removeEventListener('keydown', this.onKey);
            window.removeEventListener('resize', this.onResize);
            this.root.remove();
            this.root = null;
        }
    };

    // a start-up dialog (announcement, "session already open", ...) is on screen
    function dialogOpen() {
        return Array.from(document.querySelectorAll('.swal2-container, .modal-overlay, .modal')).some(el => {
            const cs = getComputedStyle(el);
            return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
        });
    }

    // First visit: wait for the dashboard to be shown and calm (no start-up dialog for 3 s in a row)
    let waiting = false;
    function maybeStartTour() {
        if (store.get(TOUR_KEY) === '1' || waiting) return;
        waiting = true;
        let tries = 0, calm = 0;
        const timer = setInterval(() => {
            if (store.get(TOUR_KEY) === '1' || ++tries > 600) { waiting = false; return clearInterval(timer); }
            const dash = document.getElementById('dashboard-container');
            const ready = dash && getComputedStyle(dash).display !== 'none' && document.getElementById('home-start') && !dialogOpen();
            calm = ready ? calm + 1 : 0;
            if (calm >= 3) { clearInterval(timer); waiting = false; Tour.start(); }
        }, 1000);
    }

    // ------------------------------------------------------------------ Start
    function start() {
        buildHome();
        const orig = window.showSection;
        if (typeof orig === 'function' && !orig.__home) {
            const wrapped = function (id) {
                const r = orig.apply(this, arguments);
                if (id === 'dashboard') { renderSteps(); renderStatus(); } else showHelp(id);
                return r;
            };
            wrapped.__home = true;
            window.showSection = wrapped;
        }
        const current = (location.hash || '').replace('#', '');
        if (current && current !== 'dashboard') showHelp(current);
        setInterval(() => { bindSocket(); }, 1500);
        setInterval(() => { if (document.getElementById('dashboard-section')?.style.display !== 'none') renderSteps(); }, 5000);
        maybeStartTour();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.GentokTour = { start: () => Tour.start(), reset: () => store.set(TOUR_KEY, '') };
})();
