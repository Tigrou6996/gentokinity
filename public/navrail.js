/**
 * Optional TikFinity-like navigation (Settings > Apparence > Menu; the full menu stays the default): a narrow rail of categories on the left and, next to it, only the pages of the
 * chosen category. Built from the existing menu (<ul class="nav-links"> with its "nav-category" headers), so
 * links, onclick handlers, "locked" / "scene-required" rules and active states keep working unchanged.
 * The scene picker moves to the header, like TikFinity's profile switcher.
 */
(function () {
    const t = (s) => (window.GentokI18n ? window.GentokI18n.t(s) : s);
    // category header text (as written in index.html) -> rail button
    const GROUPS = [
        { key: 'home', match: null, label: 'Accueil', icon: 'fa-house' },
        { key: 'manage', match: 'GESTION', label: 'Configuration', icon: 'fa-sliders' },
        { key: 'content', match: 'CONTENU', label: 'Actions', icon: 'fa-bolt' },
        { key: 'widgets', match: 'WIDGETS LIVE', label: 'Overlays', icon: 'fa-display' },
        { key: 'tools', match: 'OUTILS LIVE', label: 'Outils', icon: 'fa-gamepad' },
        { key: 'system', match: 'SYSTÈME', label: 'Système', icon: 'fa-gear' }
    ];
    // Pages grouped by what the streamer does with them (overrides the category they are listed under)
    const PAGE_GROUP = {
        dashboard: 'home', stats: 'home', ranking: 'home', donors: 'home',
        presets: 'manage', points: 'manage', settings: 'manage', premium: 'manage'
    };
    const pageOf = (li) => {
        const a = li.querySelector('a');
        const m = a && ((a.getAttribute('onclick') || '').match(/showSection\('([\w-]+)'\)/) || (a.getAttribute('href') || '').match(/^#([\w-]+)/));
        return m ? m[1] : null;
    };
    const KEY = 'gentok_nav_group';
    let current = null;

    function build() {
        const sidebar = document.querySelector('#dashboard-container .sidebar');
        const list = sidebar && sidebar.querySelector('.nav-links');
        if (!sidebar || !list || sidebar.classList.contains('has-rail')) return;

        // 1. Tag every menu item with its group
        let group = 'home';
        const sceneLi = [];
        Array.from(list.children).forEach(li => {
            if (li.classList.contains('nav-category')) {
                const text = li.textContent.trim().toUpperCase();
                const g = GROUPS.find(x => x.match && text.startsWith(x.match));
                group = g ? g.key : group;
                li.dataset.navGroup = group;
                if (text.startsWith('SCÈNES')) { li.dataset.navGroup = 'scenes'; sceneLi.push(li); group = 'home-after-scenes'; }
                return;
            }
            if (li.querySelector('#cs-active-scene')) { sceneLi.push(li); li.dataset.navGroup = 'scenes'; return; }
            li.dataset.navGroup = PAGE_GROUP[pageOf(li)] || (group === 'home-after-scenes' ? 'home' : group);
        });
        // keep the menu order of each group: pages moved to another group go to its end, in their page order
        const order = ['dashboard', 'stats', 'ranking', 'donors'];
        order.forEach(id => {
            const li = Array.from(list.children).find(x => pageOf(x) === id);
            if (li) list.appendChild(li);
        });

        // 2. Scene picker -> header (left of the TikTok username)
        const control = document.querySelector('#dashboard-container header .user-control');
        const sceneBlock = sceneLi.find(li => li.querySelector('#cs-active-scene'));
        if (control && sceneBlock) {
            const holder = document.createElement('div');
            holder.className = 'header-scene';
            holder.title = t('Scène active');
            while (sceneBlock.firstChild) holder.appendChild(sceneBlock.firstChild);
            control.prepend(holder);
        }
        sceneLi.forEach(li => li.remove());

        // 3. Rail + panel
        const rail = document.createElement('div');
        rail.className = 'nav-rail';
        const logo = sidebar.querySelector('.logo img');
        rail.innerHTML = `<div class="rail-logo">${logo ? `<img src="${logo.getAttribute('src')}" alt="Gentok">` : 'G'}</div>` +
            GROUPS.map(g => `<button type="button" class="rail-btn" data-group="${g.key}" title="${t(g.label)}"><i class="fas ${g.icon}"></i><span>${t(g.label)}</span></button>`).join('');
        const panel = document.createElement('div');
        panel.className = 'nav-panel';
        const title = document.createElement('div');
        title.className = 'nav-panel-title';
        while (sidebar.firstChild) panel.appendChild(sidebar.firstChild);
        panel.insertBefore(title, panel.querySelector('.nav-links'));
        sidebar.appendChild(rail);
        sidebar.appendChild(panel);
        sidebar.classList.add('has-rail');
        document.body.classList.add('nav-railed');

        rail.addEventListener('click', (e) => {
            const btn = e.target.closest('.rail-btn');
            if (!btn) return;
            select(btn.dataset.group, true);
        });

        // follow the page shown (links, router, code calling showSection)
        const original = window.showSection;
        if (typeof original === 'function' && !original.__railed) {
            window.showSection = function (id, ...rest) {
                const r = original.apply(this, [id, ...rest]);
                syncToSection(id);
                return r;
            };
            window.showSection.__railed = true;
        }
        let saved = null;
        try { saved = localStorage.getItem(KEY); } catch (e) { }
        const active = list.querySelector('li.active a');
        select(groupOfLink(active) || saved || 'home', false);
    }

    function groupOfLink(a) {
        const li = a && a.closest('li');
        return li ? li.dataset.navGroup : null;
    }

    function itemsOf(key) {
        return Array.from(document.querySelectorAll('#dashboard-container .nav-links > li')).filter(li => li.dataset.navGroup === key && !li.classList.contains('nav-category'));
    }

    function select(key, navigate) {
        if (!GROUPS.some(g => g.key === key)) key = 'home';
        current = key;
        try { localStorage.setItem(KEY, key); } catch (e) { }
        document.querySelectorAll('#dashboard-container .nav-links > li').forEach(li => {
            li.classList.toggle('nav-out', li.dataset.navGroup !== key);
        });
        document.querySelectorAll('.nav-rail .rail-btn').forEach(b => b.classList.toggle('active', b.dataset.group === key));
        const g = GROUPS.find(x => x.key === key);
        const title = document.querySelector('.nav-panel-title');
        if (title && g) title.textContent = t(g.label);
        if (navigate) {
            // open the first available page of the category (like TikFinity), unless one is already open there
            const items = itemsOf(key).filter(li => li.style.display !== 'none' && !li.classList.contains('locked'));
            if (!items.some(li => li.classList.contains('active'))) {
                const a = (items[0] || itemsOf(key)[0])?.querySelector('a');
                if (a) a.click();
            }
        }
    }

    function syncToSection(id) {
        const a = document.querySelector(`#dashboard-container .nav-links a[onclick*="'${id}'"]`) || document.querySelector(`#dashboard-container .nav-links a[href="#${id}"]`);
        const key = groupOfLink(a);
        if (key && key !== current) select(key, false);
    }

    const NAV_KEY = 'gentok_nav_style';
    const navStyle = () => { try { return localStorage.getItem(NAV_KEY) === 'rail' ? 'rail' : 'classic'; } catch (e) { return 'classic'; } };
    // Settings > Apparence > Menu: the full menu of the app (default) or the icon bar by category
    window.setNavStyle = (value) => {
        try { localStorage.setItem(NAV_KEY, value === 'rail' ? 'rail' : 'classic'); } catch (e) { }
        location.reload();
    };

    function start() {
        if (navStyle() !== 'rail') return;
        build();
        if (!document.querySelector('.sidebar.has-rail')) {
            // menu not in the page yet (login screen): try again shortly
            setTimeout(start, 500);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    // Settings > Apparence > Taille de l'interface (the size is also applied in <head> before the page draws)
    window.setUiDensity = (value) => {
        const v = ['compact', 'normal', 'large'].includes(value) ? value : 'normal';
        document.documentElement.setAttribute('data-density', v);
        try { localStorage.setItem('gentok_ui_density', v); } catch (e) { }
    };
    document.addEventListener('DOMContentLoaded', () => {
        const sel = document.getElementById('setting-ui-density');
        if (sel) sel.value = document.documentElement.getAttribute('data-density') || 'normal';
        const nav = document.getElementById('setting-nav-style');
        if (nav) nav.value = navStyle();
    });

    window.GentokNavRail = { select, sync: syncToSection };
})();
