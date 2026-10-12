/**
 * Universal Entry Point for Gentok
 * Detects if running in Electron (App Mode) or Node (VPS Server Mode)
 */

require('dotenv').config();

const isElectron = !!(process.versions && process.versions.electron);

if (isElectron) {
    // If running in Electron, load the GUI main process
    console.log('📱 [GENTOK] Mode Application détecté (Electron)');
    require('./main.js');
} else {
    // If running in Node (VPS), just start the Express server
    console.log('🌐 [GENTOK] Mode Serveur détecté (Headless)');
    const { startServer } = require('./server');

    startServer().then(() => {
        console.log('✅ Serveur démarré avec succès.');
    }).catch(err => {
        console.error('❌ Échec du démarrage du serveur :', err);
        process.exit(1);
    });
}
