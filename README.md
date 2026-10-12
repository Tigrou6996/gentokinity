# Gentok

Gentok relie un live TikTok à des actions automatiques : alertes, overlays OBS, sons, Spotify, synthèse vocale (TTS), commandes Minecraft, touches clavier et webhooks.

Le même code tourne de deux façons :

| Mode | Lancement | Rôle |
|---|---|---|
| **Serveur (VPS)** | `npm run server:prod` | Héberge le tableau de bord web, les overlays, l'API, les paiements Stripe et relaie les commandes vers l'application. |
| **Application Windows (Electron)** | `npm start` / installateur `.exe` | Se connecte au live depuis l'IP du streamer, exécute les actions locales (clavier, Minecraft) et se synchronise avec le VPS. |

`src/index.js` détecte automatiquement le mode : Electron → application, Node → serveur.

## Fonctionnalités

### Connexion au live TikTok
- **Reconnexion automatique** quand la connexion saute : jusqu'à 10 essais pendant environ 7 minutes, sans perdre les compteurs. Elle s'arrête si le live est terminé ou si tu cliques sur Arrêter.
- **Surveillance** : si TikTok n'envoie plus rien pendant 3 minutes alors que le live tourne, la connexion est relancée.
- **Nouvel essai au démarrage** en cas d'erreur passagère (limite de requêtes, délai dépassé).
- **Clé `SIGN_API_KEY`** (Euler Stream, optionnelle) : à ajouter dans `.env` pour éviter la plupart des refus de connexion de TikTok.

### Zéro double comptage
- **Combos de cadeaux** (« strike ») : chaque cadeau est compté **une seule fois**, même si TikTok renvoie des paquets en double, en retard, ou oublie le paquet de fin. Une action liée à un cadeau se déclenche une fois par cadeau reçu.
- **Messages TikTok reçus deux fois** (y compris après une reconnexion) : ignorés grâce à leur identifiant unique.
- **Follow / abonnement** : comptés une seule fois par spectateur et par live, même si quelqu'un se désabonne puis se réabonne.
- Les messages envoyés avant le démarrage du bot sont ignorés.

### Déclencheurs (événements)
Cadeau précis, cadeau à partir d'une valeur en pièces, likes, follow, partage, arrivée dans le live, abonnement, message du chat (contenant un texte), commande (`!mot` ou `mot`), **premier message d'un spectateur**, **emote d'abonné**, **question (Q&R)** et **passage de niveau** (un spectateur atteint un nouveau niveau de points, avec un niveau minimum au choix).

Filtres « Qui peut déclencher ? » : tout le monde, followers, abonnés, modérateurs, top donateur de la session, ou un spectateur précis.

- **Likes** : l'action se déclenche chaque fois qu'**un spectateur** atteint le nombre de likes choisi, en cumulant ses likes pendant le live. Avant, le total du live était comparé au seuil, et une fois dépassé, l'action se déclenchait à chaque like.
- **Followers uniquement** : inclut maintenant tous les followers. Avant, seuls les « amis » (abonnements mutuels) étaient acceptés.
- **Cadeau** : quand l'événement connaît l'identifiant du cadeau, seul cet identifiant compte. Il n'y a plus de correspondance approximative sur le nom (« Lion » ne déclenche plus « Lion King »).

### Actions
| Type | Effet |
|---|---|
| Webhook | Appel HTTP (GET/POST). |
| Clavier | Appui sur une touche (AutoIt, application Windows). |
| Minecraft | Commande ServerTap. |
| Son | Lecture d'un son. |
| **Alerte à l'écran** | Texte et image, GIF ou vidéo dans l'overlay *Alertes*. |
| **Synthèse vocale** | Texte lu à voix haute par le tableau de bord. |
| **OBS Studio** | Change de scène, affiche, masque ou bascule une source, avec retour automatique après X secondes (obs-websocket v5, OBS 28+). |
| **Roue de la fortune** | Fait tourner la roue de l'overlay `wheel`. Une case écrite `Texte => Nom d'une action` lance cette action quand la roue tombe dessus. |
| **Streamer.bot** | Lance une action Streamer.bot (serveur HTTP de Streamer.bot, port 7474) avec les infos de l'événement en arguments (`user`, `nickname`, `comment`, `giftName`, `coins`…). |

Les actions OBS, Roue de la fortune et Streamer.bot sont réservées à Gentok Premium.

Options communes à toutes les actions :
- **cooldown global** : délai minimum entre deux exécutions ;
- **cooldown par spectateur** : même chose, mais pour un même spectateur ;
- **délai avant exécution** (Premium).

Un événement peut aussi avoir un **coût en points** (Premium) : le spectateur paie avec ses points, et l'action ne se lance pas s'il n'en a pas assez (boutique de points, comme sur TikFinity).

Variables disponibles dans les textes : `{nickname}`, `{username}`, `{giftname}`, `{repeatcount}`, `{combo}`, `{coins}`, `{comment}`, `{likecount}`, `{totallikecount}`, `{submonth}`, `{level}` (passage de niveau), et `{playername}` pour Minecraft.

Pour Streamer.bot, active *Servers/Clients → HTTP Server* dans Streamer.bot, puis clique sur **Tester** dans le formulaire de l'action : la liste de tes actions Streamer.bot s'affiche.

Pour OBS, active le serveur WebSocket dans OBS (Outils → Paramètres du serveur WebSocket), puis renseigne l'adresse, le port et le mot de passe dans le formulaire de l'action OBS. Le bouton **Tester** affiche la liste de tes scènes. Sur le VPS, l'action est transmise à l'application Windows, qui tourne sur le même PC qu'OBS.

### Overlays OBS / TikTok Live Studio
URL de base : `https://tiktok.gentok.fr/overlay/<nom>?token=TON_TOKEN`. Ajoute `&demo=1` pour avoir un aperçu sans être en live.

| Overlay | Paramètres principaux |
|---|---|
| `alerts`: alertes animées | `events=follow,gift,subscribe,share`, `mingift`, `duration`, `actions`, `color` |
| `chat`: chat en direct | `max`, `fade`, `avatars`, `badges`, `bg`, `size` |
| `feed`: fil d'activité | `events`, `max`, `mingift`, `size` |
| `goal`: objectif | `stat` (likes, diamonds, gifts, follows, shares, subscribers, chats, viewers), `target`, `step`, `title` |
| `counter`: compteur | `stat`, `label`, `icon`, `short`, `size` |
| `timer`: timer subathon | `start` (minutes), `coin`, `follow`, `sub`, `share`, `like` (secondes ajoutées), `maxh`, `reset=1` |
| `rain`: pluie de cadeaux | `gifts`, `likes`, `follows`, `shares`, `size`, `max` |
| `wheel`: roue de la fortune | `size`, `hold`, `persist`, `color` |
| `likegoal`: objectif de likes à thèmes | `theme` (neon, glass, gradient, minimal, candy, retro), `target`, `title`, `emoji`, `footer`, `hearts`, `width`, `color`, `color2` |
| `ranking`: top pièces / top likes / top points | `type` (coins, likes, points), `period` (live, all, weekly), `theme` (glass, neon, podium, minimal, gradient, ticker), `limit`, `avatars`, `title`, `width`, `size` |
| `points`: carte `!score`, top `!top`, passages de niveau | `duration`, `toasts`, `levelup`, `minlevel`, `color`, `color2` |
| `battle`: bataille d'équipes ou sondage | `hold` (secondes d'affichage du gagnant) |
| `jar`: pot à cadeaux | `style` (glass, neon, wood, gold), `size`, `max`, `width`, `likes`, `counter`, `title`, `persist`, `reset=1` |
| `social`: réseaux sociaux | `items=instagram:moncompte,youtube:MaChaine,discord:discord.gg/xxx` (tiktok, instagram, youtube, twitch, discord, x, snapchat, facebook, kick, web), `layout` (rotate, row), `theme` (pill, glass, neon, brand, minimal), `interval`, `size` |
| Déjà existants | `goals` (objectif de likes), `gifts`, `last-*`, `top-*`, `leaderboard`, `gift_legend.html`, `gallery` |

Les liens prêts à copier, avec ton token déjà inclus, se trouvent dans le tableau de bord, menu **Overlays**, section **Overlays Pro**. **Styles partagés** : `alerts`, `chat`, `feed`, `goal`, `counter`, `timer`, `points` et `battle` acceptent `theme=` avec 10 styles : `glass`, `dark`, `light`, `neon`, `gradient`, `minimal`, `candy`, `retro`, `cyber`, `tiktok` (fichier `public/overlay-themes.css`). Sans `theme`, chaque overlay garde son apparence d'origine. Dans le tableau de bord, le menu **Style des overlays** l'applique à tous les liens, et le bouton 👁 **Aperçu** montre l'overlay en mode démo, sur fond damier, sombre, clair ou « jeu ».

Tous les overlays acceptent `lang=fr|en|es|de|pt|it` et `font=` avec le nom d'une police Google Fonts (Bangers, Poppins, Press Start 2P, Luckiest Guy, Orbitron…). Dans le tableau de bord, la barre « Police des overlays / Couleurs » au-dessus des Overlays Pro ajoute ces paramètres aux liens. La police de l'interface elle-même se change dans **Paramètres**.

### Galerie d'overlays
Menu **WIDGETS LIVE → Galerie d'overlays**, comme la page des widgets de TikFinity : une carte par overlay avec un **aperçu en direct** (mode démo, fond sombre, damier, « jeu » ou clair), l'URL prête à copier, **Test** (envoie un vrai événement simulé à l'overlay dans OBS), **Personnaliser** (les options mettent l'URL et l'aperçu à jour, et sont mémorisées) et Ouvrir. Filtres par catégorie et recherche. Le catalogue est dans `public/gallery.js`.

Widgets ajoutés :

| Overlay | Effet |
|---|---|
| `coinmatch` (PRO) | Enchère : chaque pièce offerte pendant la manche compte, classement en direct puis gagnants. Lancer / Terminer / Réinitialiser / Gagnants depuis la galerie. |
| `jar` (PRO) | Bocal qui se remplit de cadeaux, bulle « X a offert… », meilleur donateur, bouton « Vider le pot ». |
| `cannon` (PRO) | La photo du spectateur est tirée par un canon avec son cadeau. |
| `fountain` (PRO) | Cœurs et photos qui jaillissent à chaque like. |
| `firework` (PRO) | Feu d'artifice par cadeau, taille selon la valeur, pseudo et son (désactivable). |
| `emojify` | Les emojis du chat et les emotes d'abonnés traversent l'écran. |
| `snow` | Ambiance continue : neige, cœurs, étoiles, sakura, confettis, feuilles ou billets. |

Les overlays PRO affichent « réservé à Gentok Premium » sans abonnement (l'aperçu de la galerie reste visible pour tous). `ranking` a un style `classic` (médailles, couronne, valeur sous le pseudo), `goal` une forme `layout=slant`, et la roue est maintenant sur pied avec la photo du spectateur au centre (`stand=0` pour l'ancienne roue).

### Utilisateurs & Points
Chaque spectateur gagne des points pendant le live : pièces offertes, likes, follow, partage, abonnement, messages (avec un délai anti-spam) et minutes de présence. Les montants se règlent dans **Utilisateurs & Points → Réglages des points**.

- **Points disponibles** : peuvent être dépensés dans la boutique de points (Premium).
- **Points comptés pour le niveau** : ne baissent jamais. Niveau N = N² × difficulté (50 par défaut).
- `!score` affiche la carte du spectateur (points, niveau, rang) dans l'overlay `points`, `!top` affiche le top 5. Les commandes sont modifiables.
- Le tableau liste chaque spectateur (niveau, pièces, likes, première et dernière activité), avec recherche, tri, ajout ou retrait manuel de points, historique des transactions et **export CSV** (Excel / Google Sheets).
- Les points sont regroupés et enregistrés toutes les 3 secondes en une seule écriture, pour ne pas surcharger la base pendant les gros lives.

### Offres Gratuit / Premium
| | Gratuit | Premium |
|---|---|---|
| Scènes | 2 | 10 |
| Actions / événements par scène | 5 / 5 | illimités |
| Spectateurs dans les points | 1 000 | 100 000 |
| Équipes par bataille | 2 | 4 |
| Boutique de points, délai avant action, historique détaillé | – | ✓ |
| Actions OBS, Roue de la fortune, Streamer.bot | – | ✓ |

Les limites sont définies dans `src/features/plans.js` et vérifiées côté serveur. La page **Mon offre** affiche l'utilisation actuelle.

### Batailles d'équipes
Menu **Outils live → Batailles d'équipes**. Choisis le mode (likes, cadeaux, les deux, ou **sondage** : un vote par spectateur, qui peut changer d'avis), la durée et 2 à 4 équipes. Chaque équipe a une commande (`!rouge`, `!bleu`…) que les spectateurs tapent pour la rejoindre, un cadeau optionnel qui fait gagner directement l'équipe, et une action lancée en cas de victoire. L'overlay `battle` affiche un tir à la corde (2 équipes) ou des barres (3-4 équipes), le chrono et le gagnant.

### Simulateur d'événements
Menu **Outils live → Simulateur**. Envoie un follow, un partage, un abonnement, des likes, un message (ou une `!commande`) ou un cadeau (avec ou sans combo) au nom d'un faux spectateur. Les événements simulés passent par le même moteur que les vrais (déclencheurs, actions, overlays, batailles), mais ne sont jamais enregistrés dans les classements ni dans les points.

### Langues
Le tableau de bord et les overlays existent en **français, anglais, espagnol, allemand, portugais et italien**. On choisit la langue en bas de la barre latérale ou sur l'écran de connexion. Elle est mémorisée sur le compte, et les liens d'overlay la suivent automatiquement.

L'interface est écrite en français ; `public/i18n.js` la traduit à l'affichage, y compris les listes, les notifications et les messages du serveur. Pour ajouter ou corriger des textes :
1. `python3 scripts/i18n-extract.py` met à jour `public/i18n/source.json` avec tous les textes de l'interface.
2. Ajoute ou modifie les traductions dans `public/i18n/<langue>.json`. Les variables s'écrivent `{0}`, `{1}`…
3. `python3 scripts/i18n-build.py` génère `public/i18n/<langue>.js` et liste les textes encore manquants.

Pour ajouter une langue, crée `public/i18n/<code>.json`, puis ajoute le code dans `LANGUAGES` (`public/i18n.js`) et dans `I18N` (`public/overlay-common.js`).

## Installation

Prérequis : **Node.js 20+** et un accès à une base **MongoDB** (MongoDB Atlas).

```bash
npm install
cp .env.example .env   # sous Windows : copy .env.example .env
```

Remplis ensuite `.env` (au minimum `MONGODB_URI`). Ce fichier contient des secrets : il est exclu de Git, garde-en une copie de sauvegarde ailleurs.

## Commandes

| Commande | Effet |
|---|---|
| `npm start` | Lance l'application Electron (dev). |
| `npm run local` | Application Electron pointant vers `http://localhost:3000`. |
| `npm run server` | Serveur seul (mode VPS), avec les valeurs de `.env`. |
| `npm run server:prod` | Serveur seul, tableau de bord `https://tiktok.gentok.fr`. |
| `npm run build:prod` | Construit l'application Windows dans `APP/v<version>/`. |
| `npm run build:local` | Idem, mais l'application vise `http://localhost:3000`. |
| `npm run installer` | Construit uniquement l'installateur NSIS. |
| `npm run check` | Vérifie la syntaxe de tous les fichiers JavaScript. |

Avant chaque build, `scripts/write-build-env.js` copie `MONGODB_URI` (et l'URL du tableau de bord) depuis `.env` vers `src/build-env.json`. Ce fichier est exclu de Git et embarqué dans l'application.

## Structure

```
src/
  index.js            point d'entrée (choisit Electron ou serveur)
  main.js, preload.js processus principal Electron (fenêtre, mises à jour, Minecraft)
  server.js           API Express + pages + overlays
  connector.js        connexion au live TikTok
  config.js           paramètres par utilisateur (token) avec cache
  handlers/           traitement des événements TikTok (cadeaux, likes, chat…)
  actions/            exécution des actions (webhook, clavier, Minecraft, OBS, Streamer.bot)
  features/           points, offres, batailles d'équipes, simulateur
  routes/             API des points, offres, batailles, simulateur
  models/             schémas MongoDB
  utils/              socket.io, Spotify, prix des cadeaux, planificateur…
public/               tableau de bord (index.html + app.js + pro.js) et overlays OBS
scripts/              outils de build et de vérification
data/gift_cache.json  cache de la liste des cadeaux TikTok
```

## Publier une nouvelle version

1. Mets à jour `version` dans `package.json` et `version.json`.
2. Lance `npm run build:prod`.
3. Mets en ligne le contenu de `APP/v<version>/` sur le serveur (`/app`), là où `electron-updater` vient chercher `latest.yml`. Tu peux aussi le joindre à une **Release GitHub**.

Les fichiers compilés (`APP/`, `.exe`, `.rar`) ne vont **pas** dans le dépôt Git : ils dépassent les limites de GitHub.

## Sécurité

- Aucun mot de passe ni clé ne doit être écrit dans le code : tout passe par `.env`.
- Le token de licence sert d'identifiant pour toute l'API : ne le partage jamais publiquement (URL d'overlay comprise).
- L'URL MongoDB est embarquée dans l'application compilée. Toute personne qui extrait l'`.exe` peut la lire. Utilise donc un utilisateur MongoDB aux droits limités à la base `gentok`, et change son mot de passe s'il a fuité.
