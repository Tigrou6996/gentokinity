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
            if (token) socket.emit('identify', { token, type: 'overlay', page: location.pathname, screen: numParam('screen', 1) });
        });
        socket.on('remote_reload', () => window.location.reload());
        return socket;
    }

    // Google fonts offered in the dashboard (other names are loaded from gentok.fr/polices)
    const GOOGLE_FONTS = ['Outfit', 'Inter', 'Poppins', 'Montserrat', 'Roboto', 'Nunito', 'Rubik', 'Quicksand', 'Comfortaa', 'Oswald',
        'Bebas Neue', 'Anton', 'Luckiest Guy', 'Bangers', 'Bungee', 'Russo One', 'Righteous', 'Fredoka', 'Baloo 2',
        'Orbitron', 'Audiowide', 'Exo 2', 'Press Start 2P', 'Permanent Marker', 'Pacifico', 'Lobster', 'Fasthand'];

    function applyFont(font) {
        if (!font) return;
        const setFamily = () => document.body.style.setProperty('font-family', `'${font}', sans-serif`, 'important');
        if (GOOGLE_FONTS.includes(font)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;600;700;800;900&display=swap`;
            document.head.appendChild(link);
            setFamily();
        } else {
            const face = new FontFace(font, `url(https://gentok.fr/polices/${encodeURIComponent(font)}.ttf)`);
            face.load().then(f => { document.fonts.add(f); setFamily(); }).catch(() => setFamily());
        }
    }

    // Small warning when the URL was copied without its token
    function warnIfNoToken() {
        if (token || boolParam('demo', false)) return;
        const div = document.createElement('div');
        div.textContent = t('token.missing');
        div.style.cssText = 'position:fixed;top:8px;left:8px;padding:8px 12px;background:#b00020;color:#fff;font:600 14px sans-serif;border-radius:8px;z-index:9999';
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(div));
    }

    // ---------------------------------------------------------------------
    // Translations (?lang=fr|en|es|de|pt|it, default: browser language, else fr)
    // ---------------------------------------------------------------------
    const I18N = {
        fr: {
            'alert.follow': 'Nouveau follow', 'alert.gift': 'Merci pour le cadeau', 'alert.subscribe': 'Nouvel abonné',
            'alert.share': 'Merci pour le partage', 'alert.question': 'Nouvelle question',
            'did.follow': 'suit maintenant la chaîne ❤️', 'did.followShort': 'suit la chaîne', 'did.gift': 'a envoyé',
            'did.subscribe': 's\'est abonné ⭐', 'did.subMonths': 'abonné depuis {n} mois ⭐', 'did.share': 'a partagé le live 🔁',
            'did.question': 'a posé une question', 'anonymous': 'Anonyme', 'gift': 'cadeau',
            'stat.viewers': 'Spectateurs', 'stat.likes': 'Likes', 'stat.diamonds': 'Pièces', 'stat.gifts': 'Cadeaux',
            'stat.follows': 'Nouveaux follows', 'stat.shares': 'Partages', 'stat.subscribers': 'Abonnés', 'stat.chats': 'Messages',
            'stat.cumulativeViewers': 'Viewers uniques', 'goal.prefix': 'Objectif', 'goal.default': 'Objectif',
            'timer.title': 'Subathon', 'wheel.spunBy': 'Lancée par', 'token.missing': '⚠️ Token manquant dans l\'URL de l\'overlay',
            'goal.remaining': 'Plus que {n} likes !', 'goal.reached': 'Objectif atteint !', 'legend.week': 'Légendes de la semaine', 'legend.all': 'Légendes All-Time', 'legend.none': 'Aucune légende pour le moment', 'spotify.requestedBy': 'Demandé par {name}',
            'rank.coins': "Top pièces", 'rank.likes': "Top likes", 'rank.points': "Top points", 'rank.empty': "En attente des premiers soutiens…", 'points.points': "points", 'points.level': "Niveau", 'points.rank': "Rang", 'points.next': "Niveau suivant", 'points.notEnough': "{name} n'a pas assez de points ({n})", 'points.levelup': "Niveau supérieur !", 'points.top': "Classement des points", 'battle.join': "Tape {cmd}", 'battle.winner': "{team} gagne !", 'battle.draw': "Égalité !", 'battle.members': "{n} joueurs", 'jar.title': "Pot à cadeaux", 'gw.followers': "Followers uniquement", 'gw.subs': "Abonnés uniquement", 'gw.bonus': "+1 ticket tous les {n} pièces", 'gw.type': "Tape {cmd} pour participer", 'gw.closed': "Inscriptions fermées", 'gw.entries': "participants", 'gw.tickets': "tickets", 'gw.winner': "Gagnant", 'gw.winners': "Gagnants", 'drop.type': "Tape {cmd} pour gagner {n} points !", 'songs.empty': "Aucune musique en cours", 'songs.by': "demandé par {name}", 'songs.startIn': "Démarre dans {t}", 'cm.participants': "{n} participants", 'cm.empty': "Aucun participant pour l'instant", 'cm.winners': "Gagnants", 'cm.ended': "Enchère terminée !", 'cm.hint': "Envoie des cadeaux pour participer", 'jar.donated': "{name} a offert {gift}x{n} ({c} pièces)", 'jar.top': "Meilleur donateur", 'battle.votes': "{n} votes", 'goal.likes': "Objectif likes", 'goal.done': "Objectif atteint !"
        },
        en: {
            'alert.follow': 'New follower', 'alert.gift': 'Thanks for the gift', 'alert.subscribe': 'New subscriber',
            'alert.share': 'Thanks for sharing', 'alert.question': 'New question',
            'did.follow': 'is now following ❤️', 'did.followShort': 'followed', 'did.gift': 'sent',
            'did.subscribe': 'subscribed ⭐', 'did.subMonths': 'subscribed for {n} months ⭐', 'did.share': 'shared the live 🔁',
            'did.question': 'asked a question', 'anonymous': 'Anonymous', 'gift': 'gift',
            'stat.viewers': 'Viewers', 'stat.likes': 'Likes', 'stat.diamonds': 'Coins', 'stat.gifts': 'Gifts',
            'stat.follows': 'New followers', 'stat.shares': 'Shares', 'stat.subscribers': 'Subscribers', 'stat.chats': 'Messages',
            'stat.cumulativeViewers': 'Unique viewers', 'goal.prefix': 'Goal', 'goal.default': 'Goal',
            'timer.title': 'Subathon', 'wheel.spunBy': 'Spun by', 'token.missing': '⚠️ Token missing in the overlay URL',
            'goal.remaining': 'Only {n} likes to go!', 'goal.reached': 'Goal reached!', 'legend.week': 'Legends of the week', 'legend.all': 'All-time legends', 'legend.none': 'No legend yet', 'spotify.requestedBy': 'Requested by {name}',
            'rank.coins': "Top coins", 'rank.likes': "Top likes", 'rank.points': "Top points", 'rank.empty': "Waiting for the first supporters…", 'points.points': "points", 'points.level': "Level", 'points.rank': "Rank", 'points.next': "Next level", 'points.notEnough': "{name} doesn't have enough points ({n})", 'points.levelup': "Level up!", 'points.top': "Points leaderboard", 'battle.join': "Type {cmd}", 'battle.winner': "{team} wins!", 'battle.draw': "It's a draw!", 'battle.members': "{n} players", 'jar.title': "Gift jar", 'gw.followers': "Followers only", 'gw.subs': "Subscribers only", 'gw.bonus': "+1 ticket every {n} coins", 'gw.type': "Type {cmd} to enter", 'gw.closed': "Entries closed", 'gw.entries': "entries", 'gw.tickets': "tickets", 'gw.winner': "Winner", 'gw.winners': "Winners", 'drop.type': "Type {cmd} to win {n} points!", 'songs.empty': "No song playing", 'songs.by': "requested by {name}", 'songs.startIn': "Starts in {t}", 'cm.participants': "{n} participants", 'cm.empty': "No participants yet", 'cm.winners': "Winners", 'cm.ended': "Auction over!", 'cm.hint': "Send gifts to join", 'jar.donated': "{name} donated {gift}x{n} ({c} coins)", 'jar.top': "Top donor", 'battle.votes': "{n} votes", 'goal.likes': "Likes goal", 'goal.done': "Goal reached!"
        },
        es: {
            'alert.follow': 'Nuevo seguidor', 'alert.gift': 'Gracias por el regalo', 'alert.subscribe': 'Nuevo suscriptor',
            'alert.share': 'Gracias por compartir', 'alert.question': 'Nueva pregunta',
            'did.follow': 'ahora te sigue ❤️', 'did.followShort': 'te sigue', 'did.gift': 'envió',
            'did.subscribe': 'se suscribió ⭐', 'did.subMonths': 'suscrito desde hace {n} meses ⭐', 'did.share': 'compartió el directo 🔁',
            'did.question': 'hizo una pregunta', 'anonymous': 'Anónimo', 'gift': 'regalo',
            'stat.viewers': 'Espectadores', 'stat.likes': 'Me gusta', 'stat.diamonds': 'Monedas', 'stat.gifts': 'Regalos',
            'stat.follows': 'Nuevos seguidores', 'stat.shares': 'Compartidos', 'stat.subscribers': 'Suscriptores', 'stat.chats': 'Mensajes',
            'stat.cumulativeViewers': 'Espectadores únicos', 'goal.prefix': 'Meta', 'goal.default': 'Meta',
            'timer.title': 'Subathon', 'wheel.spunBy': 'Girada por', 'token.missing': '⚠️ Falta el token en la URL del overlay',
            'goal.remaining': '¡Solo faltan {n} me gusta!', 'goal.reached': '¡Meta alcanzada!', 'legend.week': 'Leyendas de la semana', 'legend.all': 'Leyendas de siempre', 'legend.none': 'Aún no hay leyendas', 'spotify.requestedBy': 'Pedida por {name}',
            'rank.coins': "Top monedas", 'rank.likes': "Top me gusta", 'rank.points': "Top puntos", 'rank.empty': "Esperando a los primeros apoyos…", 'points.points': "puntos", 'points.level': "Nivel", 'points.rank': "Puesto", 'points.next': "Siguiente nivel", 'points.notEnough': "{name} no tiene suficientes puntos ({n})", 'points.levelup': "¡Subió de nivel!", 'points.top': "Clasificación de puntos", 'battle.join': "Escribe {cmd}", 'battle.winner': "¡Gana {team}!", 'battle.draw': "¡Empate!", 'battle.members': "{n} jugadores", 'jar.title': "Bote de regalos", 'gw.followers': "Solo seguidores", 'gw.subs': "Solo suscriptores", 'gw.bonus': "+1 ticket cada {n} monedas", 'gw.type': "Escribe {cmd} para participar", 'gw.closed': "Inscripciones cerradas", 'gw.entries': "participantes", 'gw.tickets': "tickets", 'gw.winner': "Ganador", 'gw.winners': "Ganadores", 'drop.type': "¡Escribe {cmd} para ganar {n} puntos!", 'songs.empty': "Ninguna canción sonando", 'songs.by': "pedida por {name}", 'songs.startIn': "Empieza en {t}", 'cm.participants': "{n} participantes", 'cm.empty': "Aún no hay participantes", 'cm.winners': "Ganadores", 'cm.ended': "¡Subasta terminada!", 'cm.hint': "Envía regalos para participar", 'jar.donated': "{name} regaló {gift}x{n} ({c} monedas)", 'jar.top': "Mejor donante", 'battle.votes': "{n} votos", 'goal.likes': "Meta de me gusta", 'goal.done': "¡Meta alcanzada!"
        },
        de: {
            'alert.follow': 'Neuer Follower', 'alert.gift': 'Danke für das Geschenk', 'alert.subscribe': 'Neuer Abonnent',
            'alert.share': 'Danke fürs Teilen', 'alert.question': 'Neue Frage',
            'did.follow': 'folgt jetzt ❤️', 'did.followShort': 'folgt jetzt', 'did.gift': 'hat gesendet',
            'did.subscribe': 'hat abonniert ⭐', 'did.subMonths': 'seit {n} Monaten Abonnent ⭐', 'did.share': 'hat den Live geteilt 🔁',
            'did.question': 'hat eine Frage gestellt', 'anonymous': 'Anonym', 'gift': 'Geschenk',
            'stat.viewers': 'Zuschauer', 'stat.likes': 'Likes', 'stat.diamonds': 'Münzen', 'stat.gifts': 'Geschenke',
            'stat.follows': 'Neue Follower', 'stat.shares': 'Geteilt', 'stat.subscribers': 'Abonnenten', 'stat.chats': 'Nachrichten',
            'stat.cumulativeViewers': 'Einzelne Zuschauer', 'goal.prefix': 'Ziel', 'goal.default': 'Ziel',
            'timer.title': 'Subathon', 'wheel.spunBy': 'Gedreht von', 'token.missing': '⚠️ Token fehlt in der Overlay-URL',
            'goal.remaining': 'Nur noch {n} Likes!', 'goal.reached': 'Ziel erreicht!', 'legend.week': 'Legenden der Woche', 'legend.all': 'Legenden aller Zeiten', 'legend.none': 'Noch keine Legende', 'spotify.requestedBy': 'Gewünscht von {name}',
            'rank.coins': "Top-Münzen", 'rank.likes': "Top-Likes", 'rank.points': "Top-Punkte", 'rank.empty': "Warten auf die ersten Unterstützer…", 'points.points': "Punkte", 'points.level': "Level", 'points.rank': "Platz", 'points.next': "Nächstes Level", 'points.notEnough': "{name} hat nicht genug Punkte ({n})", 'points.levelup': "Level-Up!", 'points.top': "Punkte-Rangliste", 'battle.join': "Schreib {cmd}", 'battle.winner': "{team} gewinnt!", 'battle.draw': "Unentschieden!", 'battle.members': "{n} Spieler", 'jar.title': "Geschenkglas", 'gw.followers': "Nur Follower", 'gw.subs': "Nur Abonnenten", 'gw.bonus': "+1 Ticket alle {n} Münzen", 'gw.type': "Schreib {cmd}, um mitzumachen", 'gw.closed': "Teilnahme geschlossen", 'gw.entries': "Teilnehmer", 'gw.tickets': "Tickets", 'gw.winner': "Gewinner", 'gw.winners': "Gewinner", 'drop.type': "Schreib {cmd} und gewinne {n} Punkte!", 'songs.empty': "Kein Song läuft", 'songs.by': "gewünscht von {name}", 'songs.startIn': "Startet in {t}", 'cm.participants': "{n} Teilnehmer", 'cm.empty': "Noch keine Teilnehmer", 'cm.winners': "Gewinner", 'cm.ended': "Auktion beendet!", 'cm.hint': "Sende Geschenke, um mitzumachen", 'jar.donated': "{name} hat {gift}x{n} geschenkt ({c} Münzen)", 'jar.top': "Top-Spender", 'battle.votes': "{n} Stimmen", 'goal.likes': "Like-Ziel", 'goal.done': "Ziel erreicht!"
        },
        pt: {
            'alert.follow': 'Novo seguidor', 'alert.gift': 'Obrigado pelo presente', 'alert.subscribe': 'Novo assinante',
            'alert.share': 'Obrigado por compartilhar', 'alert.question': 'Nova pergunta',
            'did.follow': 'agora está seguindo ❤️', 'did.followShort': 'seguiu', 'did.gift': 'enviou',
            'did.subscribe': 'assinou ⭐', 'did.subMonths': 'assinante há {n} meses ⭐', 'did.share': 'compartilhou a live 🔁',
            'did.question': 'fez uma pergunta', 'anonymous': 'Anônimo', 'gift': 'presente',
            'stat.viewers': 'Espectadores', 'stat.likes': 'Curtidas', 'stat.diamonds': 'Moedas', 'stat.gifts': 'Presentes',
            'stat.follows': 'Novos seguidores', 'stat.shares': 'Compartilhamentos', 'stat.subscribers': 'Assinantes', 'stat.chats': 'Mensagens',
            'stat.cumulativeViewers': 'Espectadores únicos', 'goal.prefix': 'Meta', 'goal.default': 'Meta',
            'timer.title': 'Subathon', 'wheel.spunBy': 'Girada por', 'token.missing': '⚠️ Token ausente na URL do overlay',
            'goal.remaining': 'Faltam só {n} curtidas!', 'goal.reached': 'Meta alcançada!', 'legend.week': 'Lendas da semana', 'legend.all': 'Lendas de todos os tempos', 'legend.none': 'Nenhuma lenda ainda', 'spotify.requestedBy': 'Pedida por {name}',
            'rank.coins': "Top moedas", 'rank.likes': "Top curtidas", 'rank.points': "Top pontos", 'rank.empty': "Esperando os primeiros apoios…", 'points.points': "pontos", 'points.level': "Nível", 'points.rank': "Posição", 'points.next': "Próximo nível", 'points.notEnough': "{name} não tem pontos suficientes ({n})", 'points.levelup': "Subiu de nível!", 'points.top': "Ranking de pontos", 'battle.join': "Digite {cmd}", 'battle.winner': "{team} venceu!", 'battle.draw': "Empate!", 'battle.members': "{n} jogadores", 'jar.title': "Pote de presentes", 'gw.followers': "Apenas seguidores", 'gw.subs': "Apenas assinantes", 'gw.bonus': "+1 ticket a cada {n} moedas", 'gw.type': "Digite {cmd} para participar", 'gw.closed': "Inscrições encerradas", 'gw.entries': "participantes", 'gw.tickets': "tickets", 'gw.winner': "Vencedor", 'gw.winners': "Vencedores", 'drop.type': "Digite {cmd} para ganhar {n} pontos!", 'songs.empty': "Nenhuma música tocando", 'songs.by': "pedida por {name}", 'songs.startIn': "Começa em {t}", 'cm.participants': "{n} participantes", 'cm.empty': "Nenhum participante ainda", 'cm.winners': "Vencedores", 'cm.ended': "Leilão encerrado!", 'cm.hint': "Envie presentes para participar", 'jar.donated': "{name} enviou {gift}x{n} ({c} moedas)", 'jar.top': "Maior doador", 'battle.votes': "{n} votos", 'goal.likes': "Meta de curtidas", 'goal.done': "Meta alcançada!"
        },
        it: {
            'alert.follow': 'Nuovo follower', 'alert.gift': 'Grazie per il regalo', 'alert.subscribe': 'Nuovo abbonato',
            'alert.share': 'Grazie per la condivisione', 'alert.question': 'Nuova domanda',
            'did.follow': 'ora ti segue ❤️', 'did.followShort': 'ti segue', 'did.gift': 'ha inviato',
            'did.subscribe': 'si è abbonato ⭐', 'did.subMonths': 'abbonato da {n} mesi ⭐', 'did.share': 'ha condiviso la live 🔁',
            'did.question': 'ha fatto una domanda', 'anonymous': 'Anonimo', 'gift': 'regalo',
            'stat.viewers': 'Spettatori', 'stat.likes': 'Mi piace', 'stat.diamonds': 'Monete', 'stat.gifts': 'Regali',
            'stat.follows': 'Nuovi follower', 'stat.shares': 'Condivisioni', 'stat.subscribers': 'Abbonati', 'stat.chats': 'Messaggi',
            'stat.cumulativeViewers': 'Spettatori unici', 'goal.prefix': 'Obiettivo', 'goal.default': 'Obiettivo',
            'timer.title': 'Subathon', 'wheel.spunBy': 'Girata da', 'token.missing': '⚠️ Token mancante nell\'URL dell\'overlay',
            'goal.remaining': 'Mancano solo {n} mi piace!', 'goal.reached': 'Obiettivo raggiunto!', 'legend.week': 'Leggende della settimana', 'legend.all': 'Leggende di sempre', 'legend.none': 'Ancora nessuna leggenda', 'spotify.requestedBy': 'Richiesta da {name}',
            'rank.coins': "Top monete", 'rank.likes': "Top Mi piace", 'rank.points': "Top punti", 'rank.empty': "In attesa dei primi sostenitori…", 'points.points': "punti", 'points.level': "Livello", 'points.rank': "Posizione", 'points.next': "Livello successivo", 'points.notEnough': "{name} non ha abbastanza punti ({n})", 'points.levelup': "Livello superiore!", 'points.top': "Classifica punti", 'battle.join': "Scrivi {cmd}", 'battle.winner': "Vince {team}!", 'battle.draw': "Pareggio!", 'battle.members': "{n} giocatori", 'jar.title': "Barattolo dei regali", 'gw.followers': "Solo follower", 'gw.subs': "Solo abbonati", 'gw.bonus': "+1 biglietto ogni {n} monete", 'gw.type': "Scrivi {cmd} per partecipare", 'gw.closed': "Iscrizioni chiuse", 'gw.entries': "partecipanti", 'gw.tickets': "biglietti", 'gw.winner': "Vincitore", 'gw.winners': "Vincitori", 'drop.type': "Scrivi {cmd} per vincere {n} punti!", 'songs.empty': "Nessun brano in riproduzione", 'songs.by': "richiesto da {name}", 'songs.startIn': "Inizia tra {t}", 'cm.participants': "{n} partecipanti", 'cm.empty': "Ancora nessun partecipante", 'cm.winners': "Vincitori", 'cm.ended': "Asta terminata!", 'cm.hint': "Invia regali per partecipare", 'jar.donated': "{name} ha donato {gift}x{n} ({c} monete)", 'jar.top': "Miglior donatore", 'battle.votes': "{n} voti", 'goal.likes': "Obiettivo Mi piace", 'goal.done': "Obiettivo raggiunto!"
        }
    };
    const browserLang = (navigator.language || 'fr').slice(0, 2).toLowerCase();
    const lang = I18N[(params.get('lang') || '').toLowerCase()] ? params.get('lang').toLowerCase() : (I18N[browserLang] ? browserLang : 'fr');
    document.documentElement.lang = lang;
    function t(key, vars = {}) {
        let text = (I18N[lang] && I18N[lang][key]) || I18N.fr[key] || key;
        for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
        return text;
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

    // Gift picture of an event (TikTok URL, or the local copy /img/tiktok/<giftId>.png)
    function giftImage(d) {
        if (!d) return null;
        const id = String(d.giftId || '').replace(/[^0-9]/g, '');
        return safeUrl(d.url || d.giftIcon || d.giftPictureUrl) || (id ? `/img/tiktok/${id}.png` : null);
    }
    function avatarOf(d) {
        return (d && safeUrl(d.profilePictureUrl)) || '/logo.png';
    }
    const DEMO_GIFTS = ['5655', '5269', '5487', '6064', '5827', '7934', '6427', '8913'];
    function demoGift() {
        const id = DEMO_GIFTS[Math.floor(Math.random() * DEMO_GIFTS.length)];
        return { giftId: id, giftName: 'Gift', url: `/img/tiktok/${id}.png`, repeatCount: 1 + Math.floor(Math.random() * 4), coins: 1 + Math.floor(Math.random() * 50) };
    }

    window.Gentok = {
        params, token, lang, t, escapeHtml, safeUrl, param, numParam, boolParam, listParam, colorParam,
        formatNumber, connect, applyFont, demoUser, giftImage, avatarOf, demoGift, isDemo: boolParam('demo', false)
    };

    // Shared styles (overlay-themes.css): only on the overlays that load that stylesheet
    const THEMES = ['glass', 'dark', 'light', 'neon', 'gradient', 'minimal', 'candy', 'retro', 'cyber', 'tiktok'];
    const theme = (params.get('theme') || '').toLowerCase();
    const usesThemes = !!document.querySelector('link[href*="overlay-themes.css"]');
    window.Gentok.theme = usesThemes && THEMES.includes(theme) ? theme : '';
    if (window.Gentok.theme) document.documentElement.classList.add('ovt-' + theme);

    const font = params.get('font') || (window.Gentok.theme === 'retro' ? 'Press Start 2P' : '');
    if (font) document.addEventListener('DOMContentLoaded', () => applyFont(font));

    // Overall size of the overlay (scale=50..300 %, set in the gallery), on top of its own size options
    const scale = numParam('scale', 100);
    if (scale !== 100 && scale >= 20 && scale <= 400) document.documentElement.style.zoom = String(scale / 100);
})();
