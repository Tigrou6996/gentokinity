// Writes src/build-env.json (git-ignored), read by the packaged desktop app at runtime.
// Run automatically by `npm run build:*` and `npm run installer`.
//
// SECURITY: the desktop app is shipped to everyone and its files can be read (an .exe / asar is just an
// archive). It therefore contains NO secret: no database address or password, no Euler Stream key, no Stripe
// key. The app connects to the TikTok live on the streamer's PC and relays it to the Gentok server, which holds
// the secrets in its own .env (see src/utils/liveRelay.js and /api/sign-proxy).
const fs = require('fs');
const path = require('path');

const out = {};

// The dashboard URL is only baked in when build.js passes it explicitly
// (so a localhost value from a dev .env never ends up in a production installer).
const urlArg = process.argv.find(a => a.startsWith('--dashboard-url='));
if (urlArg) out.DASHBOARD_URL = urlArg.split('=').slice(1).join('=');

const target = path.resolve(__dirname, '../src/build-env.json');
fs.writeFileSync(target, JSON.stringify(out, null, 2));
console.log(`✅ ${path.relative(process.cwd(), target)} généré sans aucun secret (${Object.keys(out).join(', ') || 'vide'}).`);
