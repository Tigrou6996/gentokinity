const winston = require('winston');
const path = require('path');
const fs = require('fs'); // [NEW] Ensure directory exists
const config = require('../config');

// console.log('--- LOGGER INIT ---');
// console.log('Step 5.0: Initializing logger...'); // Added log
const logDir = config.isAppMode ? path.join(process.cwd(), 'logs') : path.join(__dirname, '../../logs');
// console.log(`Step 5.1: Log directory is ${logDir}`);
if (!fs.existsSync(logDir)) {
    // console.log(`Creating log directory: ${logDir}`);
    fs.mkdirSync(logDir, { recursive: true });
}
// console.log('Step 5.2: Winston init starting...');
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => {
            const msg = `${info.timestamp} [${info.level}]: ${info.message}`;

            // [FIX] RE-ENABLED: Emit to dashboard as requested by user
            const socketUtils = require('./socket');
            if (socketUtils && socketUtils.emitLog) {
                socketUtils.emitLog(info.level, info.message);
            }

            return msg;
        })
    ),
    transports: [
        new winston.transports.Console(),
        // [FIX] Ensure logs are written to process.cwd() in App Mode (the snapshot is read-only)
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error'
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log')
        })
    ]
});

module.exports = logger;
