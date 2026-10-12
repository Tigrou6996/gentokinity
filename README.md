# Gentok

Gentok relie un live TikTok à des actions automatiques : alertes, overlays OBS, sons, Spotify, synthèse vocale (TTS), commandes Minecraft, touches clavier et webhooks.

Le même code tourne de deux façons :

| Mode | Lancement | Rôle |
|---|---|---|
| **Serveur (VPS)** | `npm run server:prod` | Héberge le tableau de bord web, les overlays, l'API, les paiements Stripe et relaie les commandes vers l'application. |
| **Application Windows (Electron)** | `npm start` / installateur `.exe` | Se connecte au live depuis l'IP du streamer, exécute les actions locales (clavier, Minecraft) et se synchronise avec le VPS. |

`src/index.js` détecte automatiquement le mode : Electron → application, Node → serveur.

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
  actions/            exécution des actions (webhook, clavier, Minecraft)
  models/             schémas MongoDB
  utils/              socket.io, Spotify, prix des cadeaux, planificateur…
public/               tableau de bord (index.html + app.js) et overlays OBS
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
