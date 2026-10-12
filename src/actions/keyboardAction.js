const { exec } = require('child_process');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Simulates a key press using AutoIt (requires AutoIt3.exe in PATH)
 * This feature only works in "App Mode" (Standalone EXE).
 * @param {string} key The key to press (e.g., "{SPACE}", "W", "{F5}", "a")
 * @param {boolean} force If true, bypasses the isAppMode check (used for remote commands)
 */
function pressKey(key, force = false, duration = 100) {
    if (!config.isAppMode && !force) {
        logger.warn(`⚠️ Keystroke blocked: Keyboard simulation is only available in the STANDALONE APP version.`);
        return;
    }

    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempScriptPath = path.join(os.tmpdir(), `gentok_press_${uniqueId}.au3`);

    // Decompose key if it has modifiers
    let script = "";
    if (key.includes('^')) script += 'Send("{CTRLDOWN}") \r\n';
    if (key.includes('!')) script += 'Send("{ALTDOWN}") \r\n';
    if (key.includes('+')) script += 'Send("{SHIFTDOWN}") \r\n';

    const baseKey = key.replace(/[\^\!\+]/g, '');
    // Ensure baseKey is bracketed for special keys, or just use it if already bracketed
    const finalBaseKey = baseKey.startsWith('{') ? baseKey : `{${baseKey}}`;

    script += `Send("${finalBaseKey.replace('}', ' DOWN}')}") \r\n`;
    script += `Sleep(${duration}) \r\n`;
    script += `Send("${finalBaseKey.replace('}', ' UP}')}") \r\n`;

    if (key.includes('+')) script += 'Send("{SHIFTUP}") \r\n';
    if (key.includes('!')) script += 'Send("{ALTUP}") \r\n';
    if (key.includes('^')) script += 'Send("{CTRLUP}") \r\n';

    try {
        fs.writeFileSync(tempScriptPath, script);

        const autoItPath = 'C:\\Program Files (x86)\\AutoIt3\\AutoIt3.exe';
        const command = `"${autoItPath}" /ErrorStdOut "${tempScriptPath}"`;

        logger.info(`🚀 Running AutoIt script (${duration}ms): ${key}`);

        exec(command, (error, stdout, stderr) => {
            // Cleanup temp file
            try { if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath); } catch (e) { }

            if (error) {
                logger.error(`🚨 AutoIt Keyboard Error: ${error.message}`);
                return;
            }
            logger.info(`⌨️ AutoIt Keyboard: Executed '${key}' for ${duration}ms`);
        });
    } catch (e) {
        logger.error(`🚨 Failed to execute AutoIt: ${e.message}`);
    }
}

module.exports = { pressKey };
