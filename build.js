const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');

const version = pkg.version;
const isProd = process.argv.includes('--prod');
const dashboardUrl = isProd ? 'https://tiktok.gentok.fr' : 'http://localhost:3000';
const outDir = path.join(__dirname, 'APP', `v${version}`);

console.log(`\n🚀 Préparation du build pour la version : ${version}`);
console.log(`🌐 Dashboard URL : ${dashboardUrl}\n`);

// Commande electron-builder avec override du dossier de sortie
// On crée un dossier v[VERSION] dans APP (local au VPS)
const command = `npx cross-env DASHBOARD_URL=${dashboardUrl} electron-builder build --win -c.directories.output=APP/v${version}`;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// A previous build of the same version is removed first. On Windows a file of it can stay locked for a moment
// (antivirus scan, Gentok still open from that folder): a few retries, then a clear message.
function cleanOutput() {
    if (!fs.existsSync(outDir)) return true;
    try {
        fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 1000 });
        return true;
    } catch (e) {
        console.warn(`⚠️ Impossible de vider ${path.relative(__dirname, outDir)} (${e.code || e.message}).`);
        return false;
    }
}

try {
    // build-env.json without any secret, then a check of everything that gets packaged
    execSync(`node scripts/write-build-env.js --dashboard-url=${dashboardUrl}`, { stdio: 'inherit' });
    execSync('node scripts/check-secrets.js', { stdio: 'inherit' });
} catch (error) {
    process.exit(1);
}

// "EPERM: operation not permitted, unlink ...__uninstaller-nsis-gentok.exe": Windows Defender (or another
// antivirus) is scanning the file electron-builder wants to delete. Waiting a few seconds and building again
// is enough in practice.
const ATTEMPTS = 3;
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (!cleanOutput() && attempt === ATTEMPTS) break;
    try {
        execSync(command, { stdio: 'inherit' });
        console.log(`\n✅ Build terminé avec succès !`);
        console.log(`📂 Tes fichiers sont dans : APP/v${version}\n`);
        process.exit(0);
    } catch (error) {
        if (attempt < ATTEMPTS) {
            console.warn(`\n⚠️ Échec du build (essai ${attempt}/${ATTEMPTS}) : nouvel essai dans 8 s (un antivirus bloque souvent un fichier quelques secondes)...\n`);
            sleep(8000);
        }
    }
}
console.error(`\n❌ Erreur lors du build après ${ATTEMPTS} essais.`);
console.error('   Si le message parle de EPERM / operation not permitted :');
console.error('   - fermez Gentok s\'il est ouvert depuis le dossier APP ;');
console.error(`   - ajoutez le dossier du projet aux exclusions de l'antivirus (Windows Defender : Protection contre les virus > Exclusions) ;`);
console.error('   - ou relancez simplement la commande.\n');
process.exit(1);
