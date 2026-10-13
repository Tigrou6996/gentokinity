// Quick sanity check: verifies that every JavaScript file of the project parses.
// Usage: npm run check
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['src', 'scripts', 'public'];
const SKIP = new Set(['node_modules', 'img', 'sounds']);

function collect(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collect(full, out);
        else if (entry.name.endsWith('.js') && !entry.name.endsWith('.min.js')) out.push(full);
    }
    return out;
}

const files = DIRS.flatMap(d => collect(path.join(ROOT, d), []));
files.push(path.join(ROOT, 'build.js'));

let failed = 0;
for (const file of files) {
    try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (e) {
        failed++;
        console.error(`❌ ${path.relative(ROOT, file)}\n${e.stderr.toString()}`);
    }
}

if (failed) {
    console.error(`\n${failed} fichier(s) en erreur.`);
    process.exit(1);
}
console.log(`✅ ${files.length} fichiers JavaScript vérifiés, aucune erreur de syntaxe.`);
