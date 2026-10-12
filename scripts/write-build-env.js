// Copies the values the packaged desktop app needs at runtime from .env into
// src/build-env.json (git-ignored), so they never have to be written in the source code.
// Run automatically by `npm run build:*` and `npm run installer`.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const KEYS = ['MONGODB_URI', 'SIGN_API_KEY'];
const out = {};
for (const key of KEYS) {
    if (process.env[key]) out[key] = process.env[key];
}

// The dashboard URL is only baked in when build.js passes it explicitly
// (so a localhost value from a dev .env never ends up in a production installer).
const urlArg = process.argv.find(a => a.startsWith('--dashboard-url='));
if (urlArg) out.DASHBOARD_URL = urlArg.split('=').slice(1).join('=');

if (!out.MONGODB_URI) {
    console.error('❌ MONGODB_URI est absent de .env : l\'application compilée ne pourra pas se connecter à la base.');
    process.exit(1);
}

const target = path.resolve(__dirname, '../src/build-env.json');
fs.writeFileSync(target, JSON.stringify(out, null, 2));
console.log(`✅ ${path.relative(process.cwd(), target)} généré (${Object.keys(out).join(', ')}).`);
