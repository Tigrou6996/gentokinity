/**
 * Overlay gallery (menu WIDGETS LIVE > Galerie d'overlays), like the TikFinity widget page:
 * one card per overlay with a live preview (demo mode), its URL, Copy / Test / Customize / Open,
 * and for some of them extra buttons (Coin Match, gift jar...).
 * The options chosen in "Personnaliser" are kept in the browser and added to the URL.
 * Uses globals of app.js: getApiBase, showToast.
 */
(function () {
    const t = (s) => (window.GentokI18n ? window.GentokI18n.t(s) : s);
    const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const PUBLIC_BASE = 'https://tiktok.gentok.fr/overlay/';
    const STORE = 'gentok_gallery_options';
    const THEMES = ['', 'glass', 'dark', 'light', 'neon', 'gradient', 'minimal', 'candy', 'retro', 'cyber', 'tiktok'];
    const FONTS = window.GENTOK_FONTS || [];

    // Reusable options
    const theme = { key: 'theme', label: 'Style', type: 'select', options: THEMES };
    const color = { key: 'color', label: 'Couleur', type: 'color', def: '#fe2c55' };
    const color2 = { key: 'color2', label: 'Couleur 2', type: 'color', def: '#ff8a00' };
    const size = (def, label = 'Taille') => ({ key: 'size', label, type: 'number', def });
    const STATS = ['likes', 'diamonds', 'gifts', 'follows', 'shares', 'subscribers', 'chats', 'viewers'];

    // test: what the "Test" button sends through the simulator (same engine as a real live)
    const GIFT = { type: 'gift', giftId: '5655', giftName: 'Rose', coins: 1, count: 5, combo: true };
    const BIG_GIFT = { type: 'gift', giftId: '5487', giftName: 'Finger Heart', coins: 5, count: 3, combo: true };
    const CATALOG = [
        // ---- Alerts & chat
        { id: 'alerts', cat: 'alerts', icon: 'fa-bell', name: 'Alertes animées', desc: 'Follows, cadeaux (combo compté une fois), abonnements, partages et vos actions « Alerte ».', h: 300, scale: true, test: { type: 'follow' },
            params: [{ key: 'events', label: 'Événements', type: 'text', def: 'follow,gift,subscribe,share' }, { key: 'mingift', label: 'Cadeau min. (pièces)', type: 'number', def: 0 }, { key: 'duration', label: 'Durée (s)', type: 'number', def: 5 }, theme, color] },
        { id: 'chat', cat: 'alerts', icon: 'fa-comments', name: 'Chat', desc: 'Le chat du live avec avatars et badges MOD / SUB. Conseil : largeur de la source ~400 px.', h: 300, test: { type: 'chat', comment: 'Salut tout le monde 👋' },
            params: [{ key: 'max', label: 'Messages max', type: 'number', def: 10 }, { key: 'fade', label: 'Disparition (s, 0 = jamais)', type: 'number', def: 30 }, { key: 'avatars', label: 'Avatars', type: 'bool', def: true }, { key: 'badges', label: 'Badges', type: 'bool', def: true }, { key: 'bg', label: 'Fond', type: 'bool', def: true }, size(18), theme, color] },
        { id: 'feed', cat: 'alerts', icon: 'fa-stream', name: "Fil d'activité", desc: 'Les derniers follows, cadeaux, abonnements et partages.', h: 260, test: GIFT,
            params: [{ key: 'events', label: 'Événements', type: 'text', def: 'follow,gift,subscribe,share' }, { key: 'max', label: 'Lignes max', type: 'number', def: 6 }, size(18), theme, color] },
        { id: 'emojify', cat: 'effects', icon: 'fa-face-laugh-beam', name: 'Emojify', desc: 'Les emojis écrits dans le chat et les emotes d\'abonnés traversent l\'écran.', h: 300, scale: true, test: { type: 'chat', comment: '🎉🥳🔥 GG' },
            params: [{ key: 'motion', label: 'Mouvement', type: 'select', options: ['random', 'float', 'right', 'left', 'bounce'] }, size(56), { key: 'max', label: 'Emojis par message', type: 'number', def: 6 }, { key: 'avatars', label: 'Avatar', type: 'bool', def: true }] },

        // ---- Rankings
        { id: 'topgifter', path: 'ranking', fixed: { type: 'coins' }, cat: 'rankings', icon: 'fa-crown', name: 'Top donateurs', desc: 'Les spectateurs qui ont offert le plus de pièces pendant le live.', h: 340, test: GIFT,
            params: [{ key: 'theme', label: 'Style', type: 'select', options: ['classic', 'glass', 'neon', 'podium', 'minimal', 'gradient', 'ticker'], def: 'classic' }, { key: 'period', label: 'Période', type: 'select', options: ['live', 'weekly', 'all'] }, { key: 'limit', label: 'Nombre', type: 'number', def: 5 }, { key: 'avatars', label: 'Avatars', type: 'bool', def: true }, { key: 'title', label: 'Titre', type: 'text' }, size(16), color] },
        { id: 'topliker', path: 'ranking', fixed: { type: 'likes' }, cat: 'rankings', icon: 'fa-heart', name: 'Top likeurs', desc: 'Les spectateurs qui ont envoyé le plus de likes.', h: 340, test: { type: 'like', likeCount: 30 },
            params: [{ key: 'theme', label: 'Style', type: 'select', options: ['classic', 'glass', 'neon', 'podium', 'minimal', 'gradient', 'ticker'], def: 'classic' }, { key: 'period', label: 'Période', type: 'select', options: ['live', 'weekly', 'all'] }, { key: 'limit', label: 'Nombre', type: 'number', def: 5 }, { key: 'avatars', label: 'Avatars', type: 'bool', def: true }, { key: 'title', label: 'Titre', type: 'text' }, size(16), color] },
        { id: 'toppoints', path: 'ranking', fixed: { type: 'points' }, cat: 'rankings', icon: 'fa-ranking-star', name: 'Classement des points', desc: 'Les spectateurs avec le plus de points (Utilisateurs & Points).', h: 340,
            params: [{ key: 'theme', label: 'Style', type: 'select', options: ['classic', 'glass', 'neon', 'podium', 'minimal', 'gradient', 'ticker'], def: 'classic' }, { key: 'limit', label: 'Nombre', type: 'number', def: 10 }, { key: 'avatars', label: 'Avatars', type: 'bool', def: true }, { key: 'title', label: 'Titre', type: 'text' }, size(16), color] },
        { id: 'points', cat: 'rankings', icon: 'fa-star', name: 'Points & !score', desc: 'Carte du spectateur quand il tape !score, top 5 avec !top et passages de niveau.', h: 320, scale: true, test: { type: 'chat', comment: '!score' },
            params: [{ key: 'duration', label: 'Durée (s)', type: 'number', def: 7 }, { key: 'levelup', label: 'Passages de niveau', type: 'bool', def: true }, { key: 'minlevel', label: 'Niveau min. fêté', type: 'number', def: 2 }, theme, color, color2] },

        // ---- Goals & counters
        { id: 'goal', cat: 'goals', icon: 'fa-bullseye', name: 'Objectif', desc: 'Barre de progression pour les likes, pièces, follows, partages, abonnés ou spectateurs.', h: 170, test: { type: 'like', likeCount: 50 },
            params: [{ key: 'stat', label: 'Statistique', type: 'select', options: ['follows', ...STATS.filter(x => x !== 'follows')] }, { key: 'target', label: 'Objectif', type: 'number', def: 100 }, { key: 'step', label: 'Palier suivant (+)', type: 'number', def: 0 }, { key: 'title', label: 'Titre', type: 'text' }, { key: 'layout', label: 'Forme', type: 'select', options: ['bar', 'slant'] }, theme, color, color2] },
        { id: 'likegoal', cat: 'goals', icon: 'fa-heart-circle-check', name: 'Objectif de likes', desc: 'Barre animée avec cœurs qui s\'envolent. Suit l\'objectif du tableau de bord quand il est activé.', h: 160, test: { type: 'like', likeCount: 100 },
            params: [{ key: 'theme', label: 'Style', type: 'select', options: ['neon', 'glass', 'gradient', 'minimal', 'candy', 'retro'] }, { key: 'target', label: 'Objectif', type: 'number', def: 10000 }, { key: 'title', label: 'Titre', type: 'text' }, { key: 'hearts', label: 'Cœurs', type: 'bool', def: true }, color, color2] },
        { id: 'songs', cat: 'goals', icon: 'fa-music', name: 'Song Requests (Spotify)', desc: "La musique en cours et la file d'attente des !play, avec pochettes et « démarre dans ». Nécessite le module Spotify.", h: 300,
            params: [{ key: 'max', label: 'Musiques affichées', type: 'number', def: 3 }, { key: 'requester', label: 'Demandé par', type: 'bool', def: true }, { key: 'progress', label: 'Barre de progression', type: 'bool', def: true }, size(18), theme, { key: 'color', label: 'Couleur', type: 'color', def: '#1DB954' }] },
        { id: 'counter', cat: 'goals', icon: 'fa-eye', name: 'Compteur', desc: 'Un nombre en direct : spectateurs, likes, pièces, follows… Idéal pour le multistream.', h: 120, test: { type: 'like', likeCount: 20 },
            params: [{ key: 'stat', label: 'Statistique', type: 'select', options: ['viewers', ...STATS.filter(x => x !== 'viewers')] }, { key: 'label', label: 'Texte', type: 'text' }, { key: 'icon', label: 'Icône', type: 'text', def: '👁️' }, size(48), theme, color] },
        { id: 'timer', cat: 'goals', icon: 'fa-hourglass-half', name: 'Timer subathon', desc: 'Compte à rebours qui s\'allonge avec les pièces, follows, abonnements et partages.', h: 160, test: BIG_GIFT,
            params: [{ key: 'start', label: 'Départ (min)', type: 'number', def: 60 }, { key: 'coin', label: 'Secondes par pièce', type: 'number', def: 5 }, { key: 'follow', label: 'Secondes par follow', type: 'number', def: 30 }, { key: 'sub', label: 'Secondes par abonnement', type: 'number', def: 300 }, size(72), theme, color] },

        // ---- Games & interaction
        { id: 'wheel', cat: 'games', icon: 'fa-dharmachakra', name: 'Roue de la fortune', desc: 'Affiche les tirages des actions « Roue de la fortune » (chaque case peut lancer une action).', h: 380, scale: true,
            params: [size(520), { key: 'hold', label: 'Affichage du résultat (s)', type: 'number', def: 5 }, { key: 'stand', label: 'Pied', type: 'bool', def: true }, color] },
        { id: 'coinmatch', cat: 'games', icon: 'fa-gavel', name: 'Coin Match', desc: 'Enchère en direct : les spectateurs misent avec leurs cadeaux pour être en tête.', h: 420, test: BIG_GIFT, controls: 'coinmatch', premium: true,
            params: [{ key: 'limit', label: 'Lignes', type: 'number', def: 5 }, { key: 'hold', label: 'Affichage des gagnants (s)', type: 'number', def: 12 }, { key: 'title', label: 'Titre', type: 'text' }, theme, color, color2] },
        { id: 'giveaway', cat: 'games', icon: 'fa-gift', name: 'Giveaway', desc: 'Tirage au sort : les spectateurs tapent !join, puis roulette des pseudos et gagnant avec confettis. Se pilote dans Outils live › Giveaway.', h: 380, controls: 'giveaway',
            params: [{ key: 'hold', label: 'Affichage du gagnant (s)', type: 'number', def: 15 }, { key: 'faces', label: 'Avatars des participants', type: 'bool', def: true }, theme, color, color2] },
        { id: 'pointsdrop', cat: 'games', icon: 'fa-parachute-box', name: 'Points Drop', desc: 'Des pièces tombent : les premiers qui tapent !catch gagnent des points. Se lance dans Outils live › Giveaway & Points Drop.', h: 300, scale: true, controls: 'giveaway',
            params: [{ key: 'coins', label: 'Pièces par seconde', type: 'number', def: 40 }] },
        { id: 'jar', cat: 'games', icon: 'fa-jar', name: 'Pot à cadeaux', desc: 'Le bocal se remplit avec les cadeaux de vos spectateurs.', h: 420, test: GIFT, controls: 'jar', premium: true,
            params: [{ key: 'style', label: 'Bocal', type: 'select', options: ['glass', 'neon', 'wood', 'gold'] }, size(34, 'Taille des cadeaux'), { key: 'width', label: 'Largeur', type: 'number', def: 420 }, { key: 'bubble', label: 'Bulle « a offert »', type: 'bool', def: true }, { key: 'top', label: 'Meilleur donateur', type: 'bool', def: true }, { key: 'likes', label: 'Cœurs avec les likes', type: 'bool', def: false }, color] },
        { id: 'battle', cat: 'games', icon: 'fa-people-pulling', name: "Bataille d'équipes", desc: "La bataille ou le sondage lancé dans Outils live › Batailles d'équipes.", h: 200, controls: 'battle',
            params: [{ key: 'hold', label: 'Affichage du gagnant (s)', type: 'number', def: 10 }, theme] },
        { id: 'social', cat: 'games', icon: 'fa-share-nodes', name: 'Réseaux sociaux', desc: 'Vos réseaux qui défilent (Instagram, YouTube, Discord…).', h: 130,
            params: [{ key: 'items', label: 'Réseaux (réseau:pseudo, …)', type: 'text', def: 'instagram:moncompte,youtube:MaChaine,discord:discord.gg/xxx' }, { key: 'layout', label: 'Disposition', type: 'select', options: ['rotate', 'row'] }, { key: 'theme', label: 'Style', type: 'select', options: ['pill', 'glass', 'neon', 'brand', 'minimal'] }, { key: 'interval', label: 'Intervalle (s)', type: 'number', def: 6 }, size(26)] },

        // ---- Effects
        { id: 'cannon', cat: 'effects', icon: 'fa-bomb', name: 'Canon à cadeaux', desc: 'La photo du spectateur est tirée par un canon avec son cadeau. Source conseillée : 1920x1080.', h: 300, scale: true, test: GIFT, premium: true,
            params: [{ key: 'side', label: 'Côté', type: 'select', options: ['right', 'left'] }, size(64), { key: 'max', label: 'Tirs par cadeau', type: 'number', def: 8 }, { key: 'mingift', label: 'Cadeau min. (pièces)', type: 'number', def: 0 }, color] },
        { id: 'fountain', cat: 'effects', icon: 'fa-heart', name: 'Fontaine de likes', desc: 'À chaque like, des cœurs et la photo du spectateur jaillissent.', h: 300, scale: true, test: { type: 'like', likeCount: 15 }, premium: true,
            params: [{ key: 'from', label: 'Départ', type: 'select', options: ['bottom', 'left', 'right', 'random'] }, { key: 'colors', label: 'Couleurs', type: 'select', options: ['rainbow', 'tiktok', 'pink', 'green', 'gold'] }, size(34), { key: 'hearts', label: 'Cœurs par like', type: 'number', def: 3 }, { key: 'avatars', label: 'Avatars', type: 'bool', def: true }] },
        { id: 'firework', cat: 'effects', icon: 'fa-wand-magic-sparkles', name: "Feu d'artifice", desc: "Les cadeaux lancent un feu d'artifice avec le pseudo du spectateur. Le son peut être coupé.", h: 300, scale: true, test: BIG_GIFT, premium: true,
            params: [{ key: 'sound', label: 'Son', type: 'bool', def: true }, { key: 'volume', label: 'Volume (0-1)', type: 'number', def: 0.5 }, { key: 'mingift', label: 'Cadeau min. (pièces)', type: 'number', def: 0 }, { key: 'names', label: 'Pseudo', type: 'bool', def: true }] },
        { id: 'rain', cat: 'effects', icon: 'fa-cloud-showers-heavy', name: 'Pluie de cadeaux', desc: 'Les cadeaux reçus tombent à l\'écran, des cœurs pour les likes.', h: 300, scale: true, test: GIFT,
            params: [{ key: 'gifts', label: 'Cadeaux', type: 'bool', def: true }, { key: 'likes', label: 'Likes', type: 'bool', def: true }, { key: 'follows', label: 'Follows', type: 'bool', def: true }, size(64), { key: 'max', label: 'Max à l\'écran', type: 'number', def: 80 }] },
        { id: 'snow', cat: 'effects', icon: 'fa-snowflake', name: 'Ambiance (neige…)', desc: 'Neige, cœurs, étoiles, sakura, confettis, feuilles ou billets qui tombent en continu. Source conseillée : 1920x1080.', h: 300, scale: true,
            params: [{ key: 'type', label: 'Type', type: 'select', options: ['snow', 'hearts', 'stars', 'sakura', 'confetti', 'leaves', 'money'] }, { key: 'count', label: 'Quantité', type: 'number', def: 140 }, { key: 'speed', label: 'Vitesse', type: 'number', def: 1 }, { key: 'wind', label: 'Vent', type: 'number', def: 0.3 }, { key: 'size', label: 'Taille', type: 'number', def: 1 }] }
    ];
    const CATEGORIES = [['all', 'Tous'], ['alerts', 'Alertes & chat'], ['rankings', 'Classements'], ['goals', 'Objectifs & compteurs'], ['games', 'Jeux & interaction'], ['effects', 'Effets']];

    let options = {};
    try { options = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { options = {}; }
    const saveOptions = () => { try { localStorage.setItem(STORE, JSON.stringify(options)); } catch (e) { } };
    const token = () => localStorage.getItem('gentok_token') || '';
    const lang = () => (window.GentokI18n ? window.GentokI18n.lang : 'fr');

    function query(o, extra = {}) {
        const q = new URLSearchParams();
        Object.entries(o.fixed || {}).forEach(([k, v]) => q.set(k, v));
        const chosen = options[o.id] || {};
        for (const p of o.params || []) {
            let v = chosen[p.key];
            if ((v === undefined || v === null) && p.type === 'select' && p.def) v = p.def; // explicit default style in the URL
            if (v === undefined || v === '' || v === null) continue;
            if (p.type === 'color') q.set(p.key, String(v).replace('#', ''));
            else if (p.type === 'bool') q.set(p.key, v ? '1' : '0');
            else q.set(p.key, v);
        }
        if (chosen.font) q.set('font', chosen.font);
        Object.entries(extra).forEach(([k, v]) => q.set(k, v));
        return q;
    }
    function publicUrl(o) {
        const q = query(o, { token: token(), lang: lang() });
        return `${PUBLIC_BASE}${o.path || o.id}?${q}`;
    }
    function previewUrl(o) {
        const q = query(o, { token: token(), lang: lang(), demo: '1' });
        return `${getApiBase()}/overlay/${o.path || o.id}?${q}`;
    }

    function api(path, body) {
        return fetch(`${getApiBase()}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token(), ...body }) })
            .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || d.error || `HTTP ${r.status}`); return d; });
    }

    function controlsHtml(o) {
        if (o.controls === 'coinmatch') {
            return `<div class="gal-controls">
                <select data-cm="duration" title="${esc(t('Durée'))}">${[[60, '1 min'], [120, '2 min'], [180, '3 min'], [300, '5 min'], [600, '10 min']].map(([v, l]) => `<option value="${v}"${v === 120 ? ' selected' : ''}>${l}</option>`).join('')}</select>
                <button class="btn-secondary" data-cm="start"><i class="fas fa-play"></i> ${esc(t('Lancer'))}</button>
                <button class="btn-secondary" data-cm="stop"><i class="fas fa-stop"></i> ${esc(t('Terminer'))}</button>
                <button class="btn-secondary" data-cm="reset"><i class="fas fa-rotate-left"></i> ${esc(t('Réinitialiser'))}</button>
                <button class="btn-secondary" data-cm="winners"><i class="fas fa-trophy"></i> ${esc(t('Gagnants'))}</button></div>`;
        }
        if (o.controls === 'jar') {
            return `<div class="gal-controls"><button class="btn-secondary" data-jar="reset"><i class="fas fa-rotate-left"></i> ${esc(t('Vider le pot'))}</button></div>`;
        }
        if (o.controls === 'giveaway') {
            return `<div class="gal-controls"><button class="btn-secondary" onclick="showSection('giveaway')"><i class="fas fa-gift"></i> ${esc(t('Ouvrir Giveaway & Points Drop'))}</button></div>`;
        }
        if (o.controls === 'battle') {
            return `<div class="gal-controls"><button class="btn-secondary" onclick="showSection('battle')"><i class="fas fa-fist-raised"></i> ${esc(t("Ouvrir les batailles"))}</button></div>`;
        }
        return '';
    }

    function fieldHtml(o, p) {
        const v = (options[o.id] || {})[p.key];
        const val = v === undefined ? (p.def === undefined ? '' : p.def) : v;
        const id = `gal-${o.id}-${p.key}`;
        let input;
        if (p.type === 'select') input = `<select id="${id}" data-k="${p.key}">${p.options.map(x => `<option value="${esc(x)}"${String(val) === x ? ' selected' : ''}>${esc(x === '' ? t('Par défaut') : x)}</option>`).join('')}</select>`;
        else if (p.type === 'bool') input = `<label class="gal-switch"><input type="checkbox" id="${id}" data-k="${p.key}"${val ? ' checked' : ''}><span></span></label>`;
        else if (p.type === 'color') input = `<input type="color" id="${id}" data-k="${p.key}" value="${esc(val || p.def || '#fe2c55')}">`;
        else input = `<input type="${p.type === 'number' ? 'number' : 'text'}" id="${id}" data-k="${p.key}" value="${esc(val)}"${p.type === 'number' ? ' step="any"' : ''}>`;
        return `<div class="gal-field${p.type === 'bool' ? ' bool' : ''}"><label for="${id}">${esc(t(p.label))}</label>${input}</div>`;
    }

    function cardHtml(o) {
        return `<div class="gal-card" data-id="${o.id}" data-cat="${o.cat}">
            <div class="gal-head"><h3><i class="fas ${o.icon}"></i> ${esc(t(o.name))}${o.premium ? ' <sup class="gal-pro">PRO</sup>' : ''}</h3></div>
            <p class="gal-desc">${esc(t(o.desc))}</p>
            ${controlsHtml(o)}
            <div class="gal-url">
                <input type="text" readonly class="gal-link">
                <button class="btn-secondary" data-act="copy"><i class="fas fa-copy"></i> ${esc(t("Copier l'URL"))}</button>
                <button class="btn-secondary" data-act="test"${o.test ? '' : ' disabled title="' + esc(t('Pas de test pour cet overlay')) + '"'}><i class="fas fa-chevron-right"></i> Test</button>
                <button class="btn-secondary" data-act="custom"><i class="fas fa-gear"></i> ${esc(t('Personnaliser'))}</button>
                <button class="btn-secondary" data-act="open" title="${esc(t('Ouvrir'))}"><i class="fas fa-external-link-alt"></i></button>
            </div>
            <div class="gal-custom" hidden>
                <div class="gal-fields">${(o.params || []).map(p => fieldHtml(o, p)).join('')}
                    <div class="gal-field"><label>${esc(t('Police'))}</label><select data-k="font"><option value="">${esc(t('Par défaut'))}</option>${FONTS.map(f => `<option${(options[o.id] || {}).font === f ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select></div>
                </div>
                <button class="btn-ghost gal-reset" data-act="defaults"><i class="fas fa-eraser"></i> ${esc(t('Valeurs par défaut'))}</button>
            </div>
            <div class="gal-preview${o.scale ? ' scaled' : ''}" style="height:${o.h}px"><iframe loading="lazy" title="${esc(o.name)}"></iframe></div>
        </div>`;
    }

    function refreshCard(card, reloadPreview) {
        const o = CATALOG.find(x => x.id === card.dataset.id);
        card.querySelector('.gal-link').value = publicUrl(o);
        if (reloadPreview && card.dataset.visible === '1') loadPreview(card, o);
    }

    function loadPreview(card, o) {
        const frame = card.querySelector('iframe');
        const box = card.querySelector('.gal-preview');
        const src = previewUrl(o);
        if (frame.dataset.src === src) return;
        frame.dataset.src = src;
        frame.src = src;
        if (o.scale) {
            // full-screen overlays (1920x1080 sources) are drawn at 1280x720 and scaled down into the card
            const fit = () => {
                const s = Math.min(box.clientWidth / 1280, box.clientHeight / 720);
                frame.style.width = '1280px'; frame.style.height = '720px'; frame.style.transform = `scale(${s})`;
            };
            fit();
            if (!box._ro && window.ResizeObserver) { box._ro = new ResizeObserver(fit); box._ro.observe(box); }
        }
    }

    let observer = null;
    function render() {
        const root = document.getElementById('gallery-grid');
        if (!root || root.dataset.ready) return;
        root.dataset.ready = '1';
        root.innerHTML = CATALOG.map(cardHtml).join('');
        document.getElementById('gallery-filters').innerHTML = CATEGORIES.map(([k, l], i) =>
            `<button class="gal-chip${i === 0 ? ' active' : ''}" data-cat="${k}">${esc(t(l))} <span>${k === 'all' ? CATALOG.length : CATALOG.filter(o => o.cat === k).length}</span></button>`).join('');

        // Previews only run while visible (each one is a live page)
        observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
            for (const e of entries) {
                const card = e.target;
                const o = CATALOG.find(x => x.id === card.dataset.id);
                if (e.isIntersecting) { card.dataset.visible = '1'; loadPreview(card, o); } else {
                    card.dataset.visible = '0';
                    const f = card.querySelector('iframe'); f.removeAttribute('src'); f.dataset.src = '';
                }
            }
        }, { rootMargin: '150px' }) : null;
        root.querySelectorAll('.gal-card').forEach(card => {
            refreshCard(card, false);
            if (observer) observer.observe(card); else { card.dataset.visible = '1'; loadPreview(card, CATALOG.find(x => x.id === card.dataset.id)); }
        });

        root.addEventListener('click', onClick);
        root.addEventListener('input', onInput);
        root.addEventListener('change', onInput);
        document.getElementById('gallery-filters').addEventListener('click', (e) => {
            const chip = e.target.closest('.gal-chip'); if (!chip) return;
            document.querySelectorAll('.gal-chip').forEach(c => c.classList.toggle('active', c === chip));
            filter();
        });
        document.getElementById('gallery-search').addEventListener('input', filter);
        document.getElementById('gallery-bg').addEventListener('change', (e) => {
            root.dataset.bg = e.target.value;
            try { localStorage.setItem('gentok_gallery_bg', e.target.value); } catch (err) { }
        });
        try { const bg = localStorage.getItem('gentok_gallery_bg'); if (bg) { root.dataset.bg = bg; document.getElementById('gallery-bg').value = bg; } } catch (e) { }
    }

    function filter() {
        const cat = (document.querySelector('.gal-chip.active') || {}).dataset?.cat || 'all';
        const q = (document.getElementById('gallery-search').value || '').trim().toLowerCase();
        document.querySelectorAll('#gallery-grid .gal-card').forEach(card => {
            const o = CATALOG.find(x => x.id === card.dataset.id);
            const okCat = cat === 'all' || o.cat === cat;
            const okQ = !q || (t(o.name) + ' ' + t(o.desc) + ' ' + o.id).toLowerCase().includes(q);
            card.style.display = okCat && okQ ? '' : 'none';
        });
    }

    let inputTimer = null;
    function onInput(e) {
        const el = e.target.closest('[data-k]'); if (!el) return;
        const card = el.closest('.gal-card'); const id = card.dataset.id;
        options[id] = options[id] || {};
        options[id][el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
        saveOptions();
        clearTimeout(inputTimer);
        inputTimer = setTimeout(() => refreshCard(card, true), e.type === 'input' && el.type !== 'checkbox' && el.tagName !== 'SELECT' ? 500 : 0);
    }

    async function onClick(e) {
        const btn = e.target.closest('button'); if (!btn) return;
        const card = btn.closest('.gal-card'); if (!card) return;
        const o = CATALOG.find(x => x.id === card.dataset.id);
        const act = btn.dataset.act;
        try {
            if (act === 'copy') {
                await navigator.clipboard.writeText(publicUrl(o));
                showToast(t('URL copiée !'), 'success');
            } else if (act === 'open') {
                window.open(publicUrl(o), '_blank');
            } else if (act === 'custom') {
                const panel = card.querySelector('.gal-custom'); panel.hidden = !panel.hidden; btn.classList.toggle('active', !panel.hidden);
            } else if (act === 'defaults') {
                delete options[o.id]; saveOptions();
                card.querySelector('.gal-fields').outerHTML = `<div class="gal-fields">${(o.params || []).map(p => fieldHtml(o, p)).join('')}<div class="gal-field"><label>${esc(t('Police'))}</label><select data-k="font"><option value="">${esc(t('Par défaut'))}</option>${FONTS.map(f => `<option>${esc(f)}</option>`).join('')}</select></div></div>`;
                refreshCard(card, true);
            } else if (act === 'test' && o.test) {
                await api('/api/simulate', { uniqueId: 'gentok_test', nickname: 'Gentok Test', followRole: 1, ...o.test });
                showToast(t('Test envoyé : regardez votre overlay dans OBS'), 'success');
            } else if (btn.dataset.cm) {
                if (btn.dataset.cm === 'duration') return;
                const duration = card.querySelector('[data-cm="duration"]').value;
                await api(`/api/coinmatch/${btn.dataset.cm}`, { duration, title: (options[o.id] || {}).title || 'Coin Match' });
                showToast(t('Coin Match mis à jour'), 'success');
            } else if (btn.dataset.jar === 'reset') {
                await api('/api/overlay/command', { command: 'jar_reset' });
                showToast(t('Pot à cadeaux vidé'), 'success');
            }
        } catch (err) {
            showToast('❌ ' + err.message, 'error');
        }
    }

    window.GentokGallery = { render, CATALOG };
})();
