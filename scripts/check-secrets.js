// Refuses to package the desktop app if a secret would end up in it (the files of an .exe can be read by anyone).
// Scans what electron-builder packs from this project (src/, public/, package.json). Run by build.js.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PATTERNS = [
    { name: 'adresse MongoDB avec mot de passe', re: /mongodb(\+srv)?:\/\/[^\s'"`/:@]+:[^\s'"`@]+@/ },
    { name: 'clé Stripe secrète', re: /\b(sk|rk)_live_[0-9a-zA-Z]{10,}/ },
    { name: 'secret de webhook Stripe', re: /\bwhsec_[0-9a-zA-Z]{16,}/ },
    { name: 'clé privée', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ }
];
const SKIP_DIRS = new Set(['node_modules', '.git', 'img', 'vendor']);
const EXTS = new Set(['.js', '.json', '.html', '.css', '.env', '.txt', '.md', '.mjs', '.cjs']);

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else if (EXTS.has(path.extname(entry.name)) || entry.name.startsWith('.env')) yield full;
    }
}

const found = [];
for (const base of ['src', 'public']) {
    const dir = path.join(ROOT, base);
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
        const text = fs.readFileSync(file, 'utf8');
        for (const p of PATTERNS) if (p.re.test(text)) found.push(`${path.relative(ROOT, file)} : ${p.name}`);
    }
}
// build-env.json must not carry any secret key at all
const envFile = path.join(ROOT, 'src', 'build-env.json');
if (fs.existsSync(envFile)) {
    const keys = Object.keys(JSON.parse(fs.readFileSync(envFile, 'utf8')));
    const bad = keys.filter(k => !['DASHBOARD_URL'].includes(k));
    if (bad.length) found.push(`src/build-env.json : ${bad.join(', ')} (ne doit contenir que DASHBOARD_URL)`);
}

if (found.length) {
    console.error('\n❌ Build refusé : des informations privées seraient incluses dans l\'application :');
    found.forEach(f => console.error(`   - ${f}`));
    console.error('   Retirez-les (elles vont dans le fichier .env du serveur, jamais dans l\'application).\n');
    process.exit(1);
}
console.log('🔒 Aucune information privée dans les fichiers de l\'application.');
