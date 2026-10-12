const { execSync } = require('child_process');
const pkg = require('./package.json');

const version = pkg.version;
const isProd = process.argv.includes('--prod');
const dashboardUrl = isProd ? 'https://tiktok.gentok.fr' : 'http://localhost:3000';

console.log(`\n🚀 Préparation du build pour la version : ${version}`);
console.log(`🌐 Dashboard URL : ${dashboardUrl}\n`);

// Commande electron-builder avec override du dossier de sortie
// On crée un dossier v[VERSION] dans APP (local au VPS)
const command = `npx cross-env DASHBOARD_URL=${dashboardUrl} electron-builder build --win -c.directories.output=APP/v${version}`;

try {
    // Bake the runtime secrets (from .env) into src/build-env.json before packaging
    execSync(`node scripts/write-build-env.js --dashboard-url=${dashboardUrl}`, { stdio: 'inherit' });
    execSync(command, { stdio: 'inherit' });
    console.log(`\n✅ Build terminé avec succès !`);
    console.log(`📂 Tes fichiers sont dans : APP/v${version}\n`);
} catch (error) {
    console.error(`\n❌ Erreur lors du build :`, error.message);
    process.exit(1);
}
