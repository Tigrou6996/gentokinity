const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

process.on('unhandledRejection', (reason, promise) => {
    console.warn('[PROCESS] Unhandled Rejection (intercepted):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
    console.error('[PROCESS] Uncaught Exception (intercepted):', err?.message || err);
});

const express = require('express');
const http = require('http'); // [NEW]
const axios = require('axios'); // [NEW] For gift fetching
const fs = require('fs');
const os = require('os'); // [NEW] For machine-specific tokens

const multer = require('multer');
const logger = require('./utils/logger');
const config = require('./config');
const TikTokConnector = require('./connector');
const { initSocket, setOnAppConnected, isAppConnected, emitToApp, emitToDesktopApp, emitEvent } = require('./utils/socket'); // [RESTORED]

// The Windows app runs the live with its own copy of the scene (events / actions): it must reload it
// when the dashboard changes them on the server, otherwise the live keeps the old scene.
// Settings sent by the dashboard: never the fields owned by the server (Premium comes from Stripe / admin)
function userSettings(body) {
    const { isPremium, billing, ip, ...rest } = body || {};
    return rest;
}

function notifyAppSessionChanged(token) {
    if (!config.isAppMode && token) emitToDesktopApp(token, 'app_reload_session', { at: Date.now() });
}
const connectDB = require('./utils/db'); // [RESTORED]
const Global = require('./models/Global');
const Sound = require('./models/Sound');
const { initRemoteClient, reauthRemoteClient } = require('./utils/remoteClient');
const { exec } = require('child_process'); // [NEW] Use native exec instead of 'open'
const billing = require('./features/billing');
const tts = require('./features/tts');
const { isPremiumActive } = require('./features/plans');
let stripe;
// [STRIPE] Initialize ONLY in Web/VPS Mode
if (!config.isAppMode) {
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        console.log('💳 [STRIPE] Mode Paiement activé (Serveur VPS)');
    } else {
        console.warn('⚠️  [STRIPE] STRIPE_SECRET_KEY manquant. Les fonctions de paiement sont désactivées sur ce serveur.');
    }
}

const app = express();
const activeConnectors = new Map(); // token -> TikTokConnector instance (Global Map)
require('./features/points').setConnectorLookup((token) => activeConnectors.get(token));

const server = http.createServer(app); // [NEW] Create HTTP server
initSocket(server); // [NEW] Init Socket.io

// [MUTUAL EXCLUSION] Stop VPS connector if an App connects
setOnAppConnected(async (token) => {
    const connector = activeConnectors.get(token);
    if (connector) {
        // "Cloud" chosen: the live stays on the servers, the app only runs the PC actions it receives
        let runMode = 'auto';
        try { runMode = (await config.getSettings(token)).runMode || 'auto'; } catch (e) { }
        if (runMode === 'cloud') return;
        if (connector.connection && !connector.isStopping) {
            console.log(`🛑 App connectée pour ${token.substring(0, 8)}, arrêt du connecteur VPS...`);
            await connector.stop();
            activeConnectors.delete(token);
        }
    }
});

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../public/sounds');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        cb(null, fileName);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Limit to 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.mp3', '.wav', '.ogg', '.m4a'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Format de fichier non autorisé. Utilisez MP3, WAV ou OGG.'));
        }
    }
});

// Security & CORS Middleware
app.disable('x-powered-by'); // Hide Express version

app.use((req, res, next) => {
    // [CORS] Public API used by OBS / Electron / the web dashboard. No cookies are used,
    // so '*' without credentials is enough (and safer than mirroring the Origin).
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Security Headers
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-XSS-Protection', '1; mode=block');

    // [OVERLAY SUPPORT] Do NOT restrict framing for overlays (needed for OBS / TikTok relay)
    if (!req.url.includes('/overlay/')) {
        res.header('X-Frame-Options', 'SAMEORIGIN');
    }

    // [CRITICAL] Private Network Access (PNA) Header
    res.header('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// [DEBUG] Request Logger
// app.use((req, res, next) => {
//     console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
//     next();
// });

// [STRIPE] Webhook Endpoint (MUST be before express.json() for signature verification)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) return res.status(500).json({ error: 'Stripe is not configured' });
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`❌ Stripe Webhook Signature Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        const session = event.data.object;
        // Delayed methods (bank transfer...) complete unpaid first and send async_payment_succeeded later
        if (session.payment_status === 'paid' || event.type === 'checkout.session.async_payment_succeeded') {
            try {
                const result = await billing.applyPayment(require('./models/Settings'), session);
                if (!result) {
                    console.warn('⚠️ [STRIPE] Checkout completed but no token (client_reference_id) found.');
                } else if (!result.duplicate) {
                    console.log(`💎 [STRIPE] Premium ${result.plan} actif jusqu'au ${result.currentPeriodEnd.toISOString().slice(0, 10)} pour ${result.token.substring(0, 8)}.`);
                    await config.invalidate(result.token);
                    // The open dashboards unlock Premium right away
                    emitEvent('premium_updated', { premium: true, plan: result.plan, currentPeriodEnd: result.currentPeriodEnd }, result.token);
                }
            } catch (dbErr) {
                console.error(`🚨 [STRIPE] DB Update Error:`, dbErr.message);
                // Stripe retries the event when it gets an error
                return res.status(500).json({ error: 'db' });
            }
        }
    }

    res.json({ received: true });
});

// [CRITICAL] Body parsing middleware MUST be before all routes (except Stripe Webhook)
app.use(express.json());

// A token is always text: an object such as {"$ne": null} would match ANY account in a MongoDB query
app.use((req, res, next) => {
    const bad = (v) => v !== undefined && typeof v !== 'string';
    if (bad(req.query && req.query.token) || bad(req.body && req.body.token)) {
        return res.status(400).json({ error: 'Token invalide' });
    }
    next();
});

// [SECURITY] Browser Blocker: In App Mode, only allow Electron to access the dashboard
app.use((req, res, next) => {
    // Only apply this restriction in Local App Mode (EXE)
    if (config.isAppMode) {
        const userAgent = req.headers['user-agent'] || '';
        const isElectron = userAgent.includes('Electron');
        const pathName = req.path.toLowerCase();
        const isApi = pathName.startsWith('/api');
        const isAsset = pathName.match(/\.(css|js|png|jpg|svg|woff2|gif|ico|webp|mp3|wav|ogg|m4a)$/);
        const isOverlay = pathName.startsWith('/overlay');
        const isStatic = pathName.startsWith('/pages');
        const isSocket = pathName.startsWith('/socket.io');

        // [DEBUG]
        // console.log(`[BLOCKER] ${pathName} - isApi:${isApi} isOverlay:${isOverlay}`);

        // Allow API calls, Overlays, Assets, and Electron requests
        if (isElectron || isApi || isAsset || isOverlay || isStatic || isSocket || req.method === 'OPTIONS') {
            return next();
        }

        // Block everything else (like index.html opened in Chrome)
        console.log(`[SECURITY] 🚫 Accès bloqué : ${req.method} ${req.url} (Navigateur : ${userAgent})`);
        return res.send(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Gentok - Accès Restreint</title>
                <style>
                    body { background: #0f0f0f; color: white; font-family: 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                    .card { background: #1a1a1a; padding: 40px; border-radius: 20px; border: 1px solid #333; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                    h1 { color: #ff0050; margin-bottom: 20px; }
                    p { font-size: 1.1em; line-height: 1.6; color: #ccc; }
                    .logo { width: 80px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <img src="/logo.png" alt="Gentok" class="logo">
                    <h1>Application Gentok</h1>
                    <p>Pour une expérience optimale et sécurisée, le tableau de bord est exclusivement accessible via l'application <strong>Gentok.exe</strong>.</p>
                    <p>Veuillez utiliser la fenêtre de l'application qui s'est ouverte au démarrage.</p>
                </div>
            </body>
            </html>
        `);
    }
    next();
});

// [STRIPE] Create Checkout Session (Dynamic Price Creation)
app.post('/api/stripe/create-checkout-session', async (req, res) => {
    if (!stripe) return res.status(500).json({ error: 'Stripe is not configured' });
    try {
        const { token, plan } = req.body; // plan is '1m', '3m', etc.
        if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Token manquant' });

        const offer = billing.offerFor(plan);
        const months = offer.months;
        const totalAmount = offer.amount;
        // The desktop app opens checkout in the browser: it comes back to a simple "thank you" page
        const base = process.env.DASHBOARD_URL || 'https://tiktok.gentok.fr';
        const back = req.body.source === 'app' ? `${base}/payment.html` : `${base}/`;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'revolut_pay'],
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: `Abonnement Gentok App (${months} mois)`,
                        description: "Accès complet aux fonctionnalités Premium de l'application Gentok"
                    },
                    unit_amount: totalAmount,
                },
                quantity: 1,
            }],
            customer_creation: 'always',
            invoice_creation: {
                enabled: true,
                invoice_data: {
                    description: `Abonnement Gentok App ${months} mois`,
                    footer: 'Merci pour votre soutien sur Gentok !'
                }
            },
            client_reference_id: token,
            metadata: {
                token,
                months
            },
            success_url: `${back}?payment=success`,
            cancel_url: `${back}?payment=cancel`,
        });

        res.json({ id: session.id, url: session.url });
    } catch (err) {
        console.error('❌ Stripe Checkout Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// [BILLING] Offers shown by the Premium window, and the live state of the account (polled after a checkout)
app.get('/api/billing/offers', (req, res) => {
    res.json({ offers: billing.publicOffers(), checkout: !!stripe });
});
app.get('/api/billing/status', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) return res.status(400).json({ error: 'Token manquant' });
    try {
        // read the database directly: the payment may have been recorded by the webhook a second ago
        const doc = await require('./models/Settings').findOne({ token }).select('isPremium billing.plan billing.status billing.currentPeriodEnd').lean();
        const premium = isPremiumActive(doc);
        // the cached session follows when it is out of date
        if (premium !== !!(await config.getSettings(token)).isPremium) await config.invalidate(token);
        const b = (doc && doc.billing) || {};
        res.set('Cache-Control', 'no-store');
        res.json({ premium, plan: b.plan || null, status: b.status || 'inactive', currentPeriodEnd: b.currentPeriodEnd || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [FIX] Helper to send overlay files with no-cache headers so OBS/Electron always load fresh code
const publicPath = path.resolve(__dirname, '../public');
function sendOverlay(res, filename) {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.sendFile(path.join(publicPath, filename));
}

app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// [NEW] Download Page Route
app.get('/download', (req, res) => {
    res.sendFile(path.join(publicPath, 'download.html'));
});

app.get('/overlay/gallery', (req, res) => sendOverlay(res, 'overlay_gallery.html'));

app.get('/overlay/goals', (req, res) => sendOverlay(res, 'overlay_goals.html'));

app.get('/overlay/gifts', (req, res) => sendOverlay(res, 'overlay_gifts.html'));

app.get(/^\/overlay\/last-.*$/, (req, res) => sendOverlay(res, 'overlay_last.html'));

app.get(/^\/overlay\/top-.*$/, (req, res) => sendOverlay(res, 'overlay_top.html'));

app.get('/overlay/leaderboard', (req, res) => sendOverlay(res, 'overlay_leaderboard.html'));

// [NEW] Ranking System Overlay
app.get('/overlay/gift_legend.html', (req, res) => sendOverlay(res, 'overlay_gift_legend.html'));

// Pro overlays (configured through URL parameters, see the dashboard "Overlays Pro" panel)
app.get('/overlay/alerts', (req, res) => sendOverlay(res, 'overlay_alerts.html'));
app.get('/overlay/chat', (req, res) => sendOverlay(res, 'overlay_chat.html'));
app.get('/overlay/counter', (req, res) => sendOverlay(res, 'overlay_counter.html'));
app.get('/overlay/goal', (req, res) => sendOverlay(res, 'overlay_goal.html'));
app.get('/overlay/rain', (req, res) => sendOverlay(res, 'overlay_rain.html'));
app.get('/overlay/timer', (req, res) => sendOverlay(res, 'overlay_timer.html'));
app.get('/overlay/feed', (req, res) => sendOverlay(res, 'overlay_feed.html'));
app.get('/overlay/wheel', (req, res) => sendOverlay(res, 'overlay_wheel.html'));
app.get('/overlay/points', (req, res) => sendOverlay(res, 'overlay_points.html'));
app.get('/overlay/battle', (req, res) => sendOverlay(res, 'overlay_battle.html'));
app.get('/overlay/likegoal', (req, res) => sendOverlay(res, 'overlay_likegoal.html'));
app.get('/overlay/ranking', (req, res) => sendOverlay(res, 'overlay_ranking.html'));
app.get('/overlay/social', (req, res) => sendOverlay(res, 'overlay_social.html'));
app.get('/overlay/jar', (req, res) => sendPremiumOverlay(req, res, 'overlay_jar.html'));
// PRO widgets: real use needs Gentok Premium (the demo preview of the gallery stays open to everyone)
async function sendPremiumOverlay(req, res, filename) {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const isDemo = req.query.demo === '1' || req.query.demo === 'true';
    if (!isDemo) {
        const settings = token ? await config.getSettings(token).catch(() => null) : null;
        if (!settings || !require('./features/plans').getPlan(settings).proWidgets) {
            res.set('Cache-Control', 'no-store');
            return res.type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent;font:700 18px 'Segoe UI',sans-serif}
                div{position:fixed;left:12px;top:12px;padding:10px 16px;border-radius:12px;background:rgba(15,15,22,.9);color:#fff;border:2px solid #fbbf24}</style></head>
                <body><div>⭐ Overlay réservé à Gentok Premium</div></body></html>`);
        }
    }
    sendOverlay(res, filename);
}
app.get('/overlay/coinmatch', (req, res) => sendPremiumOverlay(req, res, 'overlay_coinmatch.html'));
app.get('/overlay/cannon', (req, res) => sendPremiumOverlay(req, res, 'overlay_cannon.html'));
app.get('/overlay/fountain', (req, res) => sendPremiumOverlay(req, res, 'overlay_fountain.html'));
app.get('/overlay/firework', (req, res) => sendPremiumOverlay(req, res, 'overlay_firework.html'));
app.get('/overlay/snow', (req, res) => sendOverlay(res, 'overlay_snow.html'));
app.get('/overlay/songs', (req, res) => sendOverlay(res, 'overlay_songs.html'));
app.get('/overlay/giveaway', (req, res) => sendOverlay(res, 'overlay_giveaway.html'));
app.get('/overlay/pointsdrop', (req, res) => sendOverlay(res, 'overlay_pointsdrop.html'));
app.get('/overlay/emojify', (req, res) => sendOverlay(res, 'overlay_emojify.html'));
app.get('/overlay/donors', (req, res) => sendOverlay(res, 'overlay_donors.html'));

// [DONORS] Viewers in the live and what they already gave (private panel, like Viraloria)
app.get('/api/donors', (req, res) => {
    const token = getRequestToken(req);
    if (!token) return res.status(400).json({ error: 'Token manquant' });
    const donors = require('./features/donors');
    if (req.query.alertMin !== undefined) donors.setAlertMin(token, req.query.alertMin);
    res.set('Cache-Control', 'no-store');
    res.json(donors.list(token));
});

// Expose ranking pages assets (tiktok-coin.png, etc) if still needed for other pages
app.use('/pages', express.static(path.resolve(__dirname, '../classement/pages')));

app.use(express.static(publicPath));
app.use('/img/tiktok', express.static(path.resolve(__dirname, '../public/img/tiktok')));
app.use('/app', express.static(path.resolve(__dirname, '../APP')));

// API: Verify License
app.get('/api/verify-license', async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).json({ error: 'Token manquant' });

        const response = await axios.get(`https://gentok.fr/api/clientData?token=${encodeURIComponent(token)}`, { timeout: 10000 });

        // Sync config with MongoDB for this token
        await config.loadSession(token);

        // Capture and persist client IP (handle proxy lists and prioritize IPv4)
        let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        if (clientIp.includes(',')) {
            const ips = clientIp.split(',').map(s => s.trim());
            // Prioritize the first IPv4 found in the list
            clientIp = ips.find(ip => ip.includes('.') && !ip.includes(':')) || ips[0];
        }
        // Remove IPv6 prefix if present in IPv4-mapped IPv6 addresses (e.g., ::ffff:1.2.3.4)
        if (clientIp.startsWith('::ffff:')) {
            clientIp = clientIp.replace('::ffff:', '');
        }

        // Sync premium only if remote says TRUE (Allows local manual override for dev)
        if (response.data.isPremium === true) {
            await config.saveSettings({ token, ip: clientIp, isPremium: true });
        } else {
            await config.saveSettings({ token, ip: clientIp });
        }

        // PERSIST: Save as last active token (Scoped by machine in App Mode)
        const lastTokenKey = config.isAppMode ? `lastActiveToken_${os.hostname()}` : 'lastActiveToken';
        await Global.updateOne({ key: lastTokenKey }, { value: token }, { upsert: true });

        // Save token if valid
        config.licenseToken = token;
        reauthRemoteClient();

        res.json(response.data);
    } catch (err) {
        if (err.response && err.response.status === 404) {
            return res.json({ error: 'Token invalide ou introuvable.' });
        }
        console.error('License check error:', err.message);
        res.status(500).json({ error: 'Erreur vérification licence' });
    }
});

/**
 * Token sent by the client (query string or JSON body).
 * The "last active token" fallback is only safe in the single-user desktop app:
 * on the shared VPS it would make a request act on someone else's account.
 */
function getRequestToken(req) {
    return req.query?.token || req.body?.token || (config.isAppMode ? config.licenseToken : null);
}

// Plans, viewer points, team battles, simulator, Streamer.bot
require('./routes/pro')(app, { getRequestToken });

// =======================
// LOGIN API (Email/Password)
// =======================
const User = require('./models/User');
const bcrypt = require('bcrypt');

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        // Find user by email
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        // Verify password (support both bcrypt hash and plain-text)
        let isValidPassword = false;

        if (user.passwordHash && user.passwordHash.startsWith('$2')) {
            // Password is bcrypt hash
            isValidPassword = await bcrypt.compare(password, user.passwordHash);
        } else if (user.passwordHash) {
            // Legacy plain-text password: accept it once, then store a bcrypt hash instead
            isValidPassword = (password === user.passwordHash);
            if (isValidPassword) {
                try {
                    const hash = await bcrypt.hash(password, 10);
                    await User.updateOne({ _id: user._id }, { $set: { passwordHash: hash } });
                    console.log(`[LOGIN] Mot de passe migré vers bcrypt pour ${user.email}`);
                } catch (e) {
                    console.error('[LOGIN] Password migration failed:', e.message);
                }
            }
        } else {
            return res.status(401).json({ error: 'Mot de passe non configuré' });
        }

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        // Return user data with token
        res.json({
            success: true,
            token: user.token,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin || false
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

// =======================
// SPOTIFY API
// =======================
const spotifyModule = require('./utils/spotifyModule');

// API: Get Spotify Auth URL
app.get('/api/spotify/auth-url', async (req, res) => {
    try {
        const token = req.query.token;
        if (token) await config.loadSession(token);

        const settings = token ? (await config.getSessionFor(token)).spotify : config.spotify;
        if (!settings.clientId || !settings.clientSecret) {
            return res.status(400).json({ error: 'Client ID ou Secret manquant.' });
        }

        const scopes = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing'];
        const state = token || config.licenseToken || '';
        const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${encodeURIComponent(settings.clientId)}&scope=${encodeURIComponent(scopes.join(' '))}&redirect_uri=${encodeURIComponent(`${config.remoteDashboardUrl}/api/spotify/callback`)}&state=${encodeURIComponent(state)}`;

        res.json({ url: authUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Spotify Callback (GET - Redirected from Spotify)
// Serialises a value for safe embedding inside an inline <script>
const toInlineJson = (value) => JSON.stringify(String(value ?? '')).replace(/</g, '\\u003c');

app.get('/api/spotify/callback', (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.send(`
            <script>
                window.opener.postMessage({ type: 'spotify_auth_error', error: ${toInlineJson(error)} }, '*');
                window.close();
            </script>
        `);
    }

    res.send(`
        <html>
            <body style="background: #121212; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                <div style="text-align: center;">
                    <h2 style="color: #1DB954;">Connexion en cours...</h2>
                    <p>Vous pouvez fermer cette fenêtre si elle ne se ferme pas automatiquement.</p>
                </div>
                <script>
                    window.opener.postMessage({ type: 'spotify_auth_success', code: ${toInlineJson(code)} }, '*');
                    setTimeout(() => window.close(), 1000);
                </script>
            </body>
        </html>
    `);
});

// API: Spotify Callback (POST - Called by Dashboard after receiving code)
app.post('/api/spotify/callback', async (req, res) => {
    const { code, token } = req.body;

    try {
        if (!code) return res.status(400).json({ error: 'Code Spotify manquant.' });
        const settings = token ? (await config.getSessionFor(token)).spotify : config.spotify;
        const SpotifyWebApi = require('spotify-web-api-node');
        const spotifyApi = new SpotifyWebApi({
            clientId: settings.clientId,
            clientSecret: settings.clientSecret,
            redirectUri: `${config.remoteDashboardUrl}/api/spotify/callback`
        });

        const data = await spotifyApi.authorizationCodeGrant(code);
        const refreshToken = data.body['refresh_token'];

        await config.saveSettings({
            token,
            spotify: { ...settings, refreshToken, enabled: true }
        });

        await spotifyModule.initSpotify(token);
        res.json({ success: true });
    } catch (err) {
        console.error('Spotify Callback Error:', err);
        res.status(500).json({ error: 'Échec de l\'authentification Spotify.' });
    }
});

// API: Update Spotify Settings
app.post('/api/spotify/settings', async (req, res) => {
    try {
        const token = req.body.token || req.query.token;
        if (token) await config.loadSession(token);
        await config.saveSettings(userSettings(req.body));
        notifyAppSessionChanged(token);
        await spotifyModule.initSpotify(token);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Gift / action names are stored with safe keys (see utils/mapKeys): give them back as typed
function decodeSessionStat(stat) {
    const { decodeKeys } = require('./utils/mapKeys');
    return {
        ...stat,
        giftsBreakdown: decodeKeys(stat.giftsBreakdown),
        giftsCoinsBreakdown: decodeKeys(stat.giftsCoinsBreakdown),
        giftsIcons: decodeKeys(stat.giftsIcons),
        actionsBreakdown: decodeKeys(stat.actionsBreakdown)
    };
}

// API: Get Last Session Stats (for comparison)
app.get('/api/last-session-stats', async (req, res) => {
    try {
        const SessionStat = require('./models/SessionStat');
        const token = getRequestToken(req);
        if (!token) return res.status(400).json({ error: 'Token manquant' });

        if (token !== config.licenseToken) {
            await config.loadSession(token);
        }

        const lastSession = await SessionStat.findOne({ token }).sort({ date: -1 }).lean();
        res.json(lastSession ? decodeSessionStat(lastSession) : {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Get Full Session History
app.get('/api/session-stats', async (req, res) => {
    try {
        const SessionStat = require('./models/SessionStat');
        const token = getRequestToken(req);
        if (!token) return res.status(400).json({ error: 'Token manquant' });

        if (token !== config.licenseToken) {
            await config.loadSession(token);
        }

        // [PREMIUM CHECK] Only allow if user is premium (this account, not the last one loaded)
        if (!isPremiumActive(await config.getSettings(token))) {
            return res.status(403).json({ error: 'PREMIUM_ONLY', message: 'Cette fonctionnalité est réservée aux membres Gentok Pro.' });
        }

        const history = await SessionStat.find({ token }).sort({ date: -1 }).limit(50).lean();
        res.json(history.map(decodeSessionStat));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/session-stats/:id', async (req, res) => {
    try {
        const SessionStat = require('./models/SessionStat');
        const token = getRequestToken(req);
        if (!token) return res.status(400).json({ error: 'Token manquant' });

        if (token !== config.licenseToken) {
            await config.loadSession(token);
        }

        const id = req.params.id;
        if (!id || id.length !== 24) {
            return res.status(400).json({ error: 'ID invalide' });
        }

        const result = await SessionStat.deleteOne({ _id: id, token });
        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (err) {
        console.error("Delete Session Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});


// Helper to get full configuration object
async function getFullConfig(token) {
    let isAdmin = false;
    let accountUsername = null;
    if (token) {
        if (!config.licenseToken) config.licenseToken = token;
        await config.loadSession(token);
        const User = require('./models/User');
        try {
            const user = await User.findOne({ token }).maxTimeMS(3000);
            if (user) {
                isAdmin = user.isAdmin || false;
                accountUsername = user.username;
            } else {
                console.warn('[DEBUG] getFullConfig: No user found for token');
            }
        } catch (e) {
            console.error('[DEBUG] getFullConfig: DB Error', e);
        }
    }

    const settings = await config.getSettings(token);
    const tiktokUsername = (settings.username && settings.username !== '0') ? settings.username : (accountUsername || config.tiktokUsername);

    return {
        username: tiktokUsername,
        accountUsername: accountUsername,
        token: settings.token || null,
        isAppMode: config.isAppMode,
        isPremium: settings.isPremium || false,
        runMode: settings.runMode || 'auto',
        activeSceneId: settings.activeSceneId || null,
        scenes: settings.scenes || [],
        isAdmin: isAdmin,
        events: settings.events || [],
        actions: settings.actions || [],
        minecraft: settings.minecraft,
        obs: settings.obs || { host: '127.0.0.1', port: 4455, password: '' },
        language: settings.language || 'fr',
        streamerbot: settings.streamerbot || { host: '127.0.0.1', port: 7474 },
        points: require('./features/points').getSettings(settings),
        spotify: {
            ...settings.spotify,
            redirectUri: `${config.remoteDashboardUrl}/api/spotify/callback`
        },
        likesGoal: settings.likesGoal ? {
            ...settings.likesGoal,
            count: !!activeConnectors.get(token) ? settings.likesGoal.count : 0
        } : null,
        autoResetTopStats: settings.autoResetTopStats || false,
        autoResetLastX: settings.autoResetLastX || false,
        topCoins: settings.topCoins || { limit: 10, title: 'TOP COINS' },
        topLikes: settings.topLikes || { limit: 10, title: 'TOP LIKES' },
        isRunning: !!activeConnectors.get(token)
    };
}

// API: Get current config
app.get('/api/config', async (req, res) => {
    const token = getRequestToken(req);
    const fullConfig = await getFullConfig(token);
    res.json(fullConfig);
});

// API: Update Settings (Generic)
// API: Get Ranking Data
app.get('/api/leaderboard/legends', async (req, res) => {
    try {
        const Leaderboard = require('./models/Leaderboard');
        const { getFullGiftList } = require('./utils/giftPrices');
        const token = getRequestToken(req);
        if (!token) return res.status(400).json({ error: 'Token manquant' });

        const gifts = getFullGiftList().slice();
        const period = req.query.period || 'all'; // 'all' or 'weekly'
        const giftField = period === 'weekly' ? 'weeklyGifts' : 'gifts';

        // [OPTIMIZATION] Get all users who have sent ANY gift at once (1 DB query instead of 500+)
        const allDonors = await Leaderboard.find({
            token,
            [giftField]: { $exists: true }
        }).lean();

        // gifts received but missing from the catalog (new TikTok gifts) are shown too
        const known = new Set(gifts.map(g => String(g.id)));
        const extra = new Set();
        for (const u of allDonors) for (const [id, n] of Object.entries(u[giftField] || {})) if (Number(n) > 0 && !known.has(id)) extra.add(id);
        extra.forEach(id => gifts.push({ id, name: `Cadeau #${id}`, icon: `https://tiktok.gentok.fr/img/tiktok/${id}.png`, price: 0 }));

        const results = gifts.map(gift => {
            const giftIdStr = gift.id.toString();

            // Extract and sort top 5 users for this specific gift from the pre-fetched list
            const topUsers = allDonors
                .filter(u => u[giftField] && u[giftField][giftIdStr] > 0)
                .map(u => ({
                    uniqueId: u.uniqueId,
                    nickname: u.nickname,
                    profilePictureUrl: u.profilePictureUrl,
                    count: u[giftField][giftIdStr]
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            return {
                giftId: gift.id,
                giftName: gift.name,
                giftIcon: gift.icon,
                price: gift.price,
                topUsers: topUsers
            };
        });

        // Sort results by price (default)
        results.sort((a, b) => b.price - a.price || a.giftName.localeCompare(b.giftName));

        res.json(results);
    } catch (err) {
        console.error('[LEGENDS_API] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const Leaderboard = require('./models/Leaderboard');
        const token = getRequestToken(req);
        if (!token) return res.status(400).json({ error: 'Token manquant' });

        const type = req.query.type || 'coins'; // 'coins' or 'likes'
        const period = req.query.period || 'all'; // 'all' or 'weekly'

        let sortField = type === 'likes' ? 'totalLikes' : 'totalCoins';
        if (period === 'weekly') {
            sortField = type === 'likes' ? 'weeklyLikes' : 'weeklyCoins';
        }

        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);

        const results = await Leaderboard.find({ token, [sortField]: { $gt: 0 } })
            .sort({ [sortField]: -1 })
            .limit(limit)
            .lean();

        res.json(results.map(u => {
            const sumGifts = u.gifts ? Object.values(u.gifts).reduce((a, b) => a + b, 0) : 0;
            const sumWeeklyGifts = u.weeklyGifts ? Object.values(u.weeklyGifts).reduce((a, b) => a + b, 0) : 0;

            return {
                userId: u.userId,
                uniqueId: u.uniqueId,
                nickname: u.nickname,
                profilePictureUrl: u.profilePictureUrl,
                totalCoins: u.totalCoins || 0,
                totalLikes: u.totalLikes || 0,
                totalGifts: sumGifts,
                weeklyCoins: u.weeklyCoins || 0,
                weeklyLikes: u.weeklyLikes || 0,
                weeklyGiftsCount: sumWeeklyGifts,
                lastUpdated: u.updatedAt
            };
        }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/leaderboard/history', async (req, res) => {
    try {
        const History = require('./models/History');
        const token = getRequestToken(req);
        if (!token) return res.status(400).json({ error: 'Token manquant' });

        const history = await History.find({ token, type: 'weekly' })
            .sort({ createdAt: -1 })
            .limit(12); // Last 3 months

        res.json(history.map(h => ({
            _id: h._id,
            date: h.timestamp || h.createdAt,
            period: h.period,
            totalGifts: h.legends.reduce((acc, l) => acc + l.topUsers.length, 0)
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/leaderboard/history/detail', async (req, res) => {
    try {
        const History = require('./models/History');
        const { id } = req.query;
        const token = getRequestToken(req);
        if (!id) return res.status(400).json({ error: 'ID manquant' });
        if (!token) return res.status(401).json({ error: 'Token manquant' });
        if (!/^[a-f0-9]{24}$/i.test(String(id))) return res.status(400).json({ error: 'ID invalide' });

        // Only the owner of the history can read it
        const history = await History.findOne({ _id: id, token });
        if (!history) return res.status(404).json({ error: 'Historique introuvable' });

        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/leaderboard/history/save', async (req, res) => {
    try {
        const token = getRequestToken(req);
        if (!token) return res.status(400).json({ error: 'Token manquant' });

        const { performWeeklyReset } = require('./utils/scheduler');
        // Warning: This will reset for EVERYONE if we don't modify performWeeklyReset to accept a token.
        // Actually, it's safer to have it per token if triggered manually.
        await performWeeklyReset(token);

        res.json({ success: true, message: 'Semaine sauvegardée et scores réinitialisés.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Manual Donation Update
app.post('/api/leaderboard/manual', async (req, res) => {
    try {
        const Leaderboard = require('./models/Leaderboard');
        const { token, giftId, count } = req.body;
        const uniqueId = String(req.body.uniqueId || '').replace(/^@/, '').trim();
        if (!token || !uniqueId || !giftId) return res.status(400).json({ error: 'Paramètres manquants' });

        const giftIdStr = String(giftId).replace(/[^0-9a-zA-Z_-]/g, '');
        const delta = Math.trunc(Number(count));
        if (!giftIdStr || !Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: 'Quantité invalide' });

        // A viewer not in the leaderboard yet is created (userId is required: it used to fail with a 500)
        let user = await Leaderboard.findOne({ token, uniqueId });
        if (!user) {
            user = new Leaderboard({ token, uniqueId, userId: uniqueId, nickname: uniqueId, totalCoins: 0, totalLikes: 0, gifts: new Map(), weeklyGifts: new Map() });
        }
        // all time AND this week (the weekly Top Légende ignored manual donations)
        const newCount = Math.max(0, (user.gifts.get(giftIdStr) || 0) + delta);
        user.gifts.set(giftIdStr, newCount);
        if (!user.weeklyGifts) user.weeklyGifts = new Map();
        user.weeklyGifts.set(giftIdStr, Math.max(0, (user.weeklyGifts.get(giftIdStr) || 0) + delta));
        user.lastUpdated = new Date();
        await user.save();

        res.json({ success: true, newCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Get Gift List
app.get('/api/gifts', async (req, res) => {
    try {
        const { getFullGiftList } = require('./utils/giftPrices');
        const gifts = getFullGiftList();
        res.json(gifts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { token, activeSceneId } = req.body;
        if (token) {
            await config.loadSession(token);
        }

        const settingsBefore = token ? await config.getSettings(token) : null;
        const oldSceneId = settingsBefore ? settingsBefore.activeSceneId : null;

        await config.saveSettings(userSettings(req.body));
        notifyAppSessionChanged(token); // the app running the live reloads the new settings

        // [CRITICAL] If we switched scenes, we MUST reload the session to pull the new scene's stats
        // into the active memory session (s), otherwise overlays will see defaults (0).
        if (token && activeSceneId !== undefined && activeSceneId !== oldSceneId) {
            console.log(`[SETTINGS] 🔄 Scene switched to ${activeSceneId}, reloading session stats...`);
            await config.loadSession(token);
        }

        // [ALWAYS] Update stats and goals for all connected clients (Overlays + Dashboards)
        // This ensures that even if only activeSceneId changed, everybody knows the new context.
        if (token) {
            const socketModule = require('./utils/socket');
            const cache = socketModule.getSocketCache(token);
            const freshSettings = await config.getSettings(token);
            const { emitEvent } = require('./utils/socket');

            // 1. Goal Update
            if (freshSettings.likesGoal) {
                const goalData = { ...freshSettings.likesGoal };

                // If we have a live count in cache, preserve it
                if (cache && cache.likesGoal && cache.likesGoal.count !== undefined) {
                    goalData.count = cache.likesGoal.count;
                }

                if (goalData.actionId && goalData.actionId !== 'none') {
                    const Action = require('./models/Action');
                    const action = await Action.findOne({ id: goalData.actionId });
                    if (action) goalData.actionName = action.name;
                }
                emitEvent('likes_goal_update', goalData, token);
            }

            // 2. Session Stats Update
            const connector = activeConnectors.get(token);
            // cache already defined above

            let finalStats;
            if (connector && connector.stats) {
                // If live, we might want to merge live connector stats with new scene config visuals
                // But the counts (diamonds, likes) come from the connector.
                finalStats = {
                    ...connector.stats,
                    // Refresh visual configs from fresh settings
                    topCoinsTitle: freshSettings.topCoins?.title || 'TOP COINS',
                    topCoinsLimit: freshSettings.topCoins?.limit || 10,
                    topCoinsStyle: freshSettings.topCoins?.style || 1,
                    topCoinsTransparent: freshSettings.topCoins?.transparent !== false,
                    topCoinsShowTitle: freshSettings.topCoins?.showTitle !== false,
                    topCoinsRtl: freshSettings.topCoins?.rtl === true,

                    topLikesTitle: freshSettings.topLikes?.title || 'TOP LIKES',
                    topLikesLimit: freshSettings.topLikes?.limit || 10,
                    topLikesStyle: freshSettings.topLikes?.style || 1,
                    topLikesTransparent: freshSettings.topLikes?.transparent !== false,
                    topLikesShowTitle: freshSettings.topLikes?.showTitle !== false,
                    topLikesRtl: freshSettings.topLikes?.rtl === true
                };
            } else {
                // [NEW] Use cache if available to prevent "reversion to zero" on VPS
                const cachedStats = (cache && cache.stats) ? cache.stats : null;

                finalStats = {
                    // Start with scene configuration
                    topGift: (cachedStats && cachedStats.topGift && cachedStats.topGift.coins > 0) ? cachedStats.topGift : freshSettings.topGift,
                    topStreak: (cachedStats && cachedStats.topStreak && cachedStats.topStreak.count > 0) ? cachedStats.topStreak : freshSettings.topStreak,

                    // Live counters from cache or 0
                    viewerCount: cachedStats ? cachedStats.viewerCount : 0,
                    cumulativeViewers: cachedStats ? cachedStats.cumulativeViewers : 0,
                    diamonds: cachedStats ? cachedStats.diamonds : 0,
                    likes: cachedStats ? cachedStats.likes : 0,
                    gifts: cachedStats ? cachedStats.gifts : 0,
                    follows: cachedStats ? cachedStats.follows : 0,
                    shares: cachedStats ? cachedStats.shares : 0,
                    chats: cachedStats ? cachedStats.chats : 0,

                    // Styling and titles from freshSettings
                    topCoinsTitle: freshSettings.topCoins?.title || 'TOP COINS',
                    topCoinsLimit: freshSettings.topCoins?.limit || 10,
                    topCoinsStyle: freshSettings.topCoins?.style || 1,
                    topCoinsTransparent: freshSettings.topCoins?.transparent !== false,
                    topCoinsShowTitle: freshSettings.topCoins?.showTitle !== false,
                    topCoinsRtl: freshSettings.topCoins?.rtl === true,
                    topLikesTitle: freshSettings.topLikes?.title || 'TOP LIKES',
                    topLikesLimit: freshSettings.topLikes?.limit || 10,
                    topLikesStyle: freshSettings.topLikes?.style || 1,
                    topLikesTransparent: freshSettings.topLikes?.transparent !== false,
                    topLikesShowTitle: freshSettings.topLikes?.showTitle !== false,
                    topLikesRtl: freshSettings.topLikes?.rtl === true
                };

                // If the cache has topCoins/topLikes arrays, use them too
                if (cachedStats && cachedStats.topCoins) finalStats.topCoins = cachedStats.topCoins;
                if (cachedStats && cachedStats.topLikes) finalStats.topLikes = cachedStats.topLikes;
            }
            emitEvent('session_stats', finalStats, token);

            // 3. Last Events refresh
            let finalLastEvents = freshSettings.lastEvents;
            if (cache && cache.lastEvents) {
                finalLastEvents = cache.lastEvents;
            }

            if (finalLastEvents) {
                emitEvent('initialLastEvents', finalLastEvents, token);
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Settings save error:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: Rename Scene
app.post('/api/scenes/rename', async (req, res) => {
    try {
        const { token, sceneId, newName } = req.body;
        if (!token || !sceneId || !newName) return res.status(400).json({ error: 'Missing parameters' });

        // Ensure session is loaded
        await config.loadSession(token);
        const settings = await config.getSettings(token);

        if (!settings.scenes) return res.status(404).json({ error: 'No scenes found' });

        const sceneIndex = settings.scenes.findIndex(s => s.id === sceneId);
        if (sceneIndex === -1) return res.status(404).json({ error: 'Scene not found' });

        settings.scenes[sceneIndex].title = newName;

        await config.saveSettings({ token, scenes: settings.scenes });

        res.json({ success: true, name: newName });
    } catch (e) {
        console.error('Rename Scene Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// API: Update TTS Settings
app.post('/api/tts/settings', async (req, res) => {
    try {
        const token = getRequestToken(req);
        if (!token) return res.status(400).json({ error: 'Token manquant' });
        const { token: _token, ...ttsData } = req.body || {};
        await config.loadSession(token);
        await config.saveSettings({ tts: ttsData, token });
        notifyAppSessionChanged(token);
        res.json({ success: true });
    } catch (err) {
        console.error('TTS settings save error:', err);
        res.status(500).json({ error: err.message });
    }
});

// [TTS] Natural voices (free Edge neural voices, see src/features/tts.js)
const ttsHits = new Map(); // account (or ip) -> { n, since }: a chat can't flood the speech service through Gentok
function ttsAllowed(key) {
    const now = Date.now();
    const h = ttsHits.get(key);
    if (!h || now - h.since > 60000) { ttsHits.set(key, { n: 1, since: now }); return true; }
    h.n++;
    return h.n <= 90;
}
setInterval(() => { const now = Date.now(); for (const [key, h] of ttsHits) if (now - h.since > 60000) ttsHits.delete(key); }, 5 * 60000).unref();

app.get('/api/tts/voices', (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ voices: tts.VOICES, default: tts.DEFAULT_VOICE, maxChars: tts.MAX_CHARS });
});

app.post('/api/tts/generate', async (req, res) => {
    const { text, voice, rate, pitch } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Texte manquant' });
    // behind the VPS proxy every request comes from the same address: count per account when known
    const who = (typeof req.body.token === 'string' && req.body.token) || String(req.headers['x-forwarded-for'] || req.ip).split(',')[0].trim();
    if (!ttsAllowed(who)) return res.status(429).json({ error: 'Trop de messages lus, réessayez dans une minute.' });
    try {
        const audio = await tts.synthesize(text, voice, rate, pitch);
        res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
        res.send(audio);
    } catch (e) {
        console.error('[TTS] Synthèse impossible:', e.message);
        res.status(502).json({ error: 'Synthèse vocale indisponible', details: e.message });
    }
});

// API: Get TTS Settings
app.get('/api/tts/settings', async (req, res) => {
    try {
        // The account asking (the VPS serves many streamers); the local app falls back to its own session
        const token = getRequestToken(req);
        if (token) {
            const s = await config.getSettings(token);
            return res.json((s && s.tts) || {});
        }

        const settings = config.settings.tts || {};
        res.json(settings);
    } catch (err) {
        console.error('TTS settings load error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ... (existing routes) ...
// API: Manage Events
app.get('/api/events', async (req, res) => {
    const token = getRequestToken(req);
    if (!token) return res.json([]);
    const session = await config.getSessionFor(token);
    res.json(session.events || []);
});
app.post('/api/events', async (req, res) => {
    let events = req.body;
    let token = req.query.token || req.body.token;

    if (req.body.events && Array.isArray(req.body.events)) {
        events = req.body.events;
    }

    if (token) {
        await config.loadSession(token);
    }

    // Fix for accidental object spread if persistent
    if (!Array.isArray(events) && typeof events === 'object') {
        const arr = [];
        Object.keys(events).forEach(k => {
            if (!isNaN(k)) arr.push(events[k]);
        });
        if (arr.length > 0) events = arr;
    }

    if (Array.isArray(events)) {
        try {
            await config.saveEvents(events, token);
        } catch (e) {
            console.error('[EVENTS] Enregistrement impossible:', e.message);
            return res.status(500).json({ error: e.message });
        }
        notifyAppSessionChanged(token);
        res.send('OK');
    } else {
        res.status(400).json({ error: 'Invalid events format' });
    }
});

// API: Manage Actions
app.get('/api/actions', async (req, res) => {
    const token = getRequestToken(req);
    if (!token) return res.json([]);
    const session = await config.getSessionFor(token);
    res.json(session.actions || []);
});
app.post('/api/actions', async (req, res) => {
    let actions = req.body;
    let token = req.query.token || req.body.token;

    if (req.body.actions && Array.isArray(req.body.actions)) {
        actions = req.body.actions;
    }

    if (token) {
        await config.loadSession(token);
    }

    // Fix for accidental object spread
    if (!Array.isArray(actions) && typeof actions === 'object') {
        const arr = [];
        Object.keys(actions).forEach(k => {
            if (!isNaN(k)) arr.push(actions[k]);
        });
        if (arr.length > 0) actions = arr;
    }

    if (Array.isArray(actions)) {
        try {
            await config.saveActions(actions, token);
        } catch (e) {
            console.error('[ACTIONS] Enregistrement impossible:', e.message);
            return res.status(500).json({ error: e.message });
        }
        notifyAppSessionChanged(token);
        res.send('OK');
    } else {
        res.status(400).json({ error: 'Invalid actions format' });
    }
});

// Redundant route removed

// [NEW] API: Manual Sync Gift Images
app.get('/api/gifts/sync', async (req, res) => {
    try {
        const { refreshGiftPrices } = require('./utils/giftPrices');
        await refreshGiftPrices();
        res.json({
            success: true,
            message: 'Synchronisation multi-sources (Gentok + Tikfinity) lancée (Check logs VPS pour les détails)'
        });
    } catch (err) {
        console.error('Error in manual gift sync:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Proxy for Sounds (MyInstants + Uploads)
app.get('/api/sounds', async (req, res) => {
    try {
        const query = req.query.q;
        const token = getRequestToken(req);
        const source = req.query.source; // 'myinstants', 'uploads', or undefined (both)

        let externalSounds = [];
        if (!source || source === 'myinstants') {
            try {
                const url = query
                    ? `https://api.gentok.fr/myinstants?q=${encodeURIComponent(query)}`
                    : 'https://api.gentok.fr/myinstants';

                const response = await axios.get(url, { timeout: 3000 });
                // Handle both array and object responses (e.g. { sounds: [...] })
                const rawData = response.data.sounds || response.data;
                if (Array.isArray(rawData)) {
                    externalSounds = rawData.map(s => ({
                        id: s.id || s.soundId,
                        title: s.title || s.name,
                        url: s.sound || s.url,
                        isLocal: false
                    }));
                }
            } catch (err) {
                console.warn('MyInstants API unreachable or invalid format, showing local sounds only.', err.message);
            }
        }

        // Fetch user uploads
        let localSounds = [];
        if ((!source || source === 'uploads') && token) {
            const sounds = await Sound.find({ token }).sort({ createdAt: -1 });
            localSounds = sounds.map(s => ({
                id: s._id,
                title: s.name,
                url: s.url,
                isLocal: true
            }));
        }

        // Filter local sounds by query if provided
        if (query) {
            const lowQuery = query.toLowerCase();
            localSounds = localSounds.filter(s => s.title.toLowerCase().includes(lowQuery));
        }

        // Merge: User sounds first, then external
        res.json([...localSounds, ...externalSounds]);
    } catch (err) {
        console.error('Error fetching sounds:', err.message);
        res.status(500).json({ error: 'Failed to fetch sounds' });
    }
});


// API: Remote Announcements
app.get('/api/announcements', (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const filePath = path.join(__dirname, '../announcements.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return res.json(JSON.parse(data));
        }
        res.json({ active: false });
    } catch (e) {
        res.json({ active: false });
    }
});

// API: Upload Sound - Shared handler
const uploadMulter = (req, res, next) => {
    // Accept both field names: 'file' (new) and 'sound' (legacy)
    upload.single('file')(req, res, (err) => {
        if (err) {
            // Try 'sound' field name as fallback
            upload.single('sound')(req, res, (err2) => {
                if (err2) {
                    console.error('Multer error:', err2);
                    return res.status(400).json({ success: false, error: err2.message });
                }
                next();
            });
            return;
        }
        next();
    });
};

const uploadHandler = async (req, res) => {
    try {
        const token = getRequestToken(req);
        if (!token) return res.status(401).json({ error: 'Token manquant' });

        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const fileUrl = `/sounds/${req.file.filename}`;

        // Save to DB
        const newSound = new Sound({
            token,
            name: req.file.originalname,
            url: fileUrl,
            filename: req.file.filename,
            size: req.file.size
        });
        await newSound.save();

        res.json({
            success: true,
            url: fileUrl,
            name: req.file.originalname,
            id: newSound._id
        });
    } catch (e) {
        console.error('Upload error:', e);
        res.status(500).json({ error: 'Upload failed: ' + e.message });
    }
};

// Register both routes (new + legacy) so cached clients still work
app.post('/api/upload', uploadMulter, uploadHandler);
app.post('/api/sounds/upload', uploadMulter, uploadHandler);

// API: Delete Sound
app.delete('/api/sounds/:id', async (req, res) => {
    try {
        const token = getRequestToken(req);
        if (!token) return res.status(401).json({ error: 'Token manquant' });

        const sound = await Sound.findOne({ _id: req.params.id, token });
        if (!sound) return res.status(404).json({ error: 'Son introuvable' });

        // Delete file
        const filePath = path.join(__dirname, '../public/sounds', sound.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete from DB
        await Sound.deleteOne({ _id: sound._id });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- Desktop app detection ----
function readLatestVersion() {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../version.json'), 'utf8'));
        return data.version || null;
    } catch (e) {
        return null;
    }
}
function isNewerVersion(latest, current) {
    if (!latest || !current) return false;
    const a = String(latest).split('.').map(n => parseInt(n, 10) || 0);
    const b = String(current).split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
    }
    return false;
}

// Is the Windows app connected for this account, and is it up to date?
app.get('/api/app/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const token = getRequestToken(req);
    const { getAppInfo } = require('./utils/socket');
    const info = token ? getAppInfo(token) : null;
    const latest = readLatestVersion();
    res.json({
        connected: !!info,
        version: info ? info.version : null,
        since: info ? info.since : null,
        latestVersion: latest,
        updateAvailable: !!(info && isNewerVersion(latest, info.version)),
        downloadUrl: '/download'
    });
});

// Answered only by the app running on the streamer's PC: the website calls http://localhost:<port>/api/app/ping
// to know whether Gentok is open on this computer (CORS + Private Network Access headers for Chrome).
app.options('/api/app/ping', (req, res) => {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Private-Network': 'true' });
    res.sendStatus(204);
});
app.get('/api/app/ping', (req, res) => {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Cache-Control': 'no-store' });
    if (!config.isAppMode) return res.status(404).json({ app: false });
    let version = null;
    try { version = require('../package.json').version; } catch (e) { /* ignore */ }
    res.json({ app: true, version, account: !!config.licenseToken });
});

// API: Version Check
app.get('/api/version', (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const filePath = path.join(__dirname, '../version.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return res.json(JSON.parse(data));
        }
        res.json({ version: '1.0.0' });
    } catch (e) {
        res.json({ version: '1.0.0' });
    }
});

// API: Get Presets from DB
// Actions / events shared in a preset or an export never carry the owner's account data
// (they used to include the streamer's token, i.e. their login)
function cleanShared(list) {
    return (Array.isArray(list) ? list : []).map(item => {
        const o = item && item.toObject ? item.toObject() : { ...(item || {}) };
        delete o.token; delete o._id; delete o.__v; delete o.sceneId; delete o.createdAt; delete o.updatedAt;
        return o;
    });
}

app.get('/api/presets', async (req, res) => {
    try {
        const Preset = require('./models/Preset');
        const presets = await Preset.find({}, { content: 0 }); // Fetch metadata only for listing
        res.json(presets);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch presets' });
    }
});

app.get('/api/presets/:id', async (req, res) => {
    try {
        const Preset = require('./models/Preset');
        const preset = await Preset.findOne({ id: req.params.id }).lean();
        if (!preset) return res.status(404).json({ error: 'Preset introuvable' });
        if (preset.content) {
            preset.content.actions = cleanShared(preset.content.actions);
            preset.content.events = cleanShared(preset.content.events);
        }
        res.json(preset);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Refuses URLs pointing to the server itself or to a private network (SSRF protection)
async function assertPublicHttpUrl(rawUrl) {
    let parsed;
    try { parsed = new URL(rawUrl); } catch (e) { throw new Error('URL invalide'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Seules les URL http(s) sont acceptées');

    const dns = require('dns').promises;
    const net = require('net');
    const host = parsed.hostname.replace(/^\[|\]$/g, '');
    const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });

    const isPrivate = (ip) => {
        if (ip.startsWith('::ffff:')) ip = ip.slice(7);
        if (net.isIPv4(ip)) {
            const [a, b] = ip.split('.').map(Number);
            return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
                (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
        }
        const low = ip.toLowerCase();
        return low === '::1' || low === '::' || low.startsWith('fc') || low.startsWith('fd') || low.startsWith('fe80');
    };

    if (addresses.length === 0 || addresses.some(a => isPrivate(a.address))) {
        throw new Error('Adresse non autorisée');
    }
    return parsed.toString();
}

// API: Proxy Import via URL (TikFinity or Gentok JSON)
app.get('/api/proxy-import', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL manquante' });

        let targetUrl = url;
        if (targetUrl.includes('tikfinity.zerody.one') && !targetUrl.includes('/api/')) {
            const match = targetUrl.match(/([a-f0-9-]{36})/i) || targetUrl.match(/\/([^\/]+)$/);
            if (match && match[1]) {
                targetUrl = `https://tikfinity.zerody.one/api/export/${encodeURIComponent(match[1])}`;
            }
        }

        // Follow up to 3 redirects manually so that every hop is checked
        let response;
        for (let hop = 0; hop < 4; hop++) {
            try {
                targetUrl = await assertPublicHttpUrl(targetUrl);
            } catch (e) {
                return res.status(400).json({ error: e.message });
            }

            response = await axios.get(targetUrl, {
                timeout: 10000,
                maxRedirects: 0,
                maxContentLength: 5 * 1024 * 1024,
                responseType: 'text',
                transformResponse: [d => d],
                validateStatus: () => true
            });

            const location = response.headers.location;
            if (response.status >= 300 && response.status < 400 && location) {
                targetUrl = new URL(location, targetUrl).toString();
                continue;
            }
            break;
        }
        if (response.status < 200 || response.status >= 300) {
            return res.status(502).json({ error: `Erreur HTTP ${response.status}` });
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(response.data);
    } catch (err) {
        res.status(500).json({ error: 'Échec proxy import: ' + err.message });
    }
});

// API: Save Preset (Admin Only)
app.post('/api/presets', async (req, res) => {
    const token = getRequestToken(req);
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    try {
        const User = require('./models/User');
        const user = await User.findOne({ token });
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Accès refusé. Administrateurs uniquement.' });
        }

        const { id, title, desc, img, badge, type, creator, actions, events, sounds } = req.body;

        const Preset = require('./models/Preset');
        const adminSession = await config.getSessionFor(token);
        let presetData = {};

        const existing = id ? await Preset.findOne({ id }).select('_id').lean() : null;
        const noItems = !Array.isArray(actions) || (actions.length === 0 && (!Array.isArray(events) || events.length === 0));
        if (title && existing && (req.body.keepContent || noItems)) {
            // Editing the title / description / image: the content stays as it is
            // (it used to be replaced by the admin's current scene)
            presetData = { $set: { title, desc, img, badge: badge || 'free' } };
        } else if (title) {
            // Metadata update or Full creation
            presetData = {
                id: id || `p_${Date.now()}`,
                title,
                desc,
                img,
                badge: badge || 'free',
                type: type || 'webhook',
                creator: creator || user.username,
                rules: events ? events.length : 0,
                overlays: 0,
                content: {
                    actions: cleanShared(actions || adminSession.actions),
                    events: cleanShared(events || adminSession.events),
                    sounds: sounds || []
                }
            };
        } else if (id) {
            // Content only update (Preset Editor Mode)
            presetData = {
                $set: {
                    'content.actions': cleanShared(actions),
                    'content.events': cleanShared(events),
                    'content.sounds': sounds || [],
                    'rules': events ? events.length : 0
                }
            };
        }

        const isSetOperation = !!presetData.$set;
        const queryId = id || presetData.id;

        const result = await Preset.findOneAndUpdate(
            { id: queryId },
            presetData,
            { upsert: !isSetOperation, new: true }
        );

        res.json({ success: true, preset: result });
    } catch (err) {
        console.error('Save preset error:', err);
        res.status(500).json({ error: 'Erreur lors de la sauvegarde du preset' });
    }
});

// API: Delete Preset (Admin Only)
app.delete('/api/presets/:id', async (req, res) => {
    const token = getRequestToken(req);
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    try {
        const User = require('./models/User');
        const user = await User.findOne({ token });
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Accès refusé. Administrateurs uniquement.' });
        }

        const Preset = require('./models/Preset');
        const result = await Preset.deleteOne({ id: req.params.id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Preset introuvable' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Delete preset error:', err);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// API: Install a Preset
app.post('/api/presets/install', async (req, res) => {
    const { presetId, asNewScene } = req.body;
    const token = getRequestToken(req);

    if (!token) return res.status(401).json({ error: 'Token manquant' });

    try {
        const Preset = require('./models/Preset');
        const preset = await Preset.findOne({ id: presetId });
        if (!preset) return res.status(404).json({ error: 'Preset introuvable' });

        // Validate preset content
        if (!preset.content || !preset.content.actions || !preset.content.events) {
            return res.status(400).json({ error: 'Le preset ne contient pas de configuration valide' });
        }

        let session = await config.getSessionFor(token);

        if (asNewScene) {
            // Install into a new scene named after the preset
            await config.saveSettings({ activeSceneId: presetId, token });
            await config.loadSession(token);
            session = await config.getSessionFor(token);
        }

        // Clone actions
        const currentActions = asNewScene ? [] : (session.actions || []);
        const baseTimestamp = Date.now();
        const newActions = preset.content.actions.map((a, index) => {
            const { _id, ...actionData } = a;
            return {
                ...actionData,
                id: `acc_${baseTimestamp}_${index}_${Math.round(Math.random() * 999999)}`
            };
        });

        // Map old action IDs to new ones for events
        const idMap = {};
        preset.content.actions.forEach((a, i) => {
            idMap[a.id] = newActions[i].id;
        });

        await config.saveActions([...currentActions, ...newActions], token);

        // Clone events
        const currentEvents = asNewScene ? [] : (session.events || []);
        const newEvents = preset.content.events.map((e, index) => {
            const { _id, ...eventData } = e;
            return {
                ...eventData,
                id: `evt_${baseTimestamp}_${index}_${Math.round(Math.random() * 999999)}`,
                actions: e.actions ? e.actions.map(oldId => idMap[oldId]).filter(Boolean) : []
            };
        });

        await config.saveEvents([...currentEvents, ...newEvents], token);
        notifyAppSessionChanged(token);

        res.json({ success: true, actionsInstalled: newActions.length, eventsInstalled: newEvents.length, activeSceneId: session.activeSceneId });
    } catch (err) {
        console.error('Install preset error:', err);
        res.status(500).json({ error: 'Installation échouée: ' + err.message });
    }
});

// API: Switch Active Scene
const sceneSwitchQueue = new Map(); // token -> promise: switches of one account run one after the other
app.post('/api/scenes/switch', async (req, res) => {
    const { sceneId, token: reqToken } = req.body;
    const token = reqToken || getRequestToken(req);
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    const previous = sceneSwitchQueue.get(token) || Promise.resolve();
    let release;
    const current = new Promise(r => { release = r; });
    sceneSwitchQueue.set(token, previous.then(() => current));
    await previous;
    try {
        if (token !== config.licenseToken) {
            await config.loadSession(token);
        }
        await config.saveSettings({ activeSceneId: sceneId || null, token });
        await config.loadSession(token);

        // [NEW] Dynamically sync new state to all connected clients instead of forcing reloads
        const { emitEvent } = require('./utils/socket');
        const freshConfig = await getFullConfig(token);
        emitEvent('sync_config', freshConfig, token);
        emitEvent('remote_reload', { sceneId }, token); // Keep for overlays to reload if they want
        notifyAppSessionChanged(token);

        res.json({ success: true, activeSceneId: (await config.getSessionFor(token)).activeSceneId });
    } catch (err) {
        console.error('Switch scene error:', err);
        res.status(500).json({ error: 'Erreur lors du changement de scène' });
    } finally {
        release();
    }
});

// API: a scene keeps its own points / levels / gift history (independent) or uses the ones shared by all the scenes
app.post('/api/scenes/independent', async (req, res) => {
    const token = getRequestToken(req);
    const { sceneId, independent } = req.body || {};
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    if (!sceneId || typeof sceneId !== 'string') return res.status(400).json({ error: 'sceneId manquant' });
    const previous = sceneSwitchQueue.get(token) || Promise.resolve();
    let release;
    const current = new Promise(r => { release = r; });
    sceneSwitchQueue.set(token, previous.then(() => current));
    await previous;
    try {
        // the points earned so far are written in the scope they were earned in
        await require('./features/points').flushToken(token);
        const value = await config.setSceneIndependent(token, sceneId, !!independent);
        const { emitEvent } = require('./utils/socket');
        emitEvent('sync_config', await getFullConfig(token), token);
        emitEvent('remote_reload', { sceneId }, token);
        notifyAppSessionChanged(token);
        res.json({ success: true, sceneId, independent: value });
    } catch (err) {
        res.status(err.message === 'Scène introuvable' ? 404 : 500).json({ error: err.message });
    } finally {
        release();
    }
});

// API: Copy the active scene into another one (actions, events with their links, TTS and points settings)
app.post('/api/scenes/duplicate', async (req, res) => {
    const token = getRequestToken(req);
    const { toSceneId } = req.body || {};
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    if (!toSceneId || typeof toSceneId !== 'string') return res.status(400).json({ error: 'toSceneId manquant' });
    try {
        await config.loadSession(token);
        const session = await config.getSessionFor(token);
        const target = (session.scenes || []).find(sc => sc.id === toSceneId);
        if (!target) return res.status(404).json({ error: 'Scène introuvable' });
        if (toSceneId === session.activeSceneId) return res.status(400).json({ error: 'Choisissez une autre scène' });

        const Action = require('./models/Action');
        const Event = require('./models/Event');
        const plain = (d) => { const { _id, __v, token: _t, sceneId: _s, createdAt, updatedAt, ...rest } = d.toObject ? d.toObject() : d; return rest; };
        const limit = session.isPremium ? Infinity : 5;
        const stamp = Date.now();
        const idMap = {};
        const actions = (session.actions || []).slice(0, limit).map((a, i) => {
            const id = `acc_${stamp}_${i}_${Math.round(Math.random() * 999999)}`;
            idMap[a.id] = id;
            return { ...plain(a), id, token, sceneId: toSceneId };
        });
        const events = (session.events || []).slice(0, limit).map((e, i) => ({
            ...plain(e),
            id: `evt_${stamp}_${i}_${Math.round(Math.random() * 999999)}`,
            actions: (e.actions || []).map(old => idMap[old]).filter(Boolean),
            token, sceneId: toSceneId
        }));
        await Promise.all([Action.deleteMany({ token, sceneId: toSceneId }), Event.deleteMany({ token, sceneId: toSceneId })]);
        if (actions.length) await Action.insertMany(actions);
        if (events.length) await Event.insertMany(events);

        // the copy also keeps the TTS and points settings of the current scene
        const copy = (v) => JSON.parse(JSON.stringify(v || {}));
        const scenes = session.scenes.map(sc => {
            const o = sc.toObject ? sc.toObject() : { ...sc };
            return o.id === toSceneId ? { ...o, tts: copy(session.tts), points: copy(session.points) } : o;
        });
        await config.saveSettings({ token, scenes });
        notifyAppSessionChanged(token);
        res.json({ success: true, actions: actions.length, events: events.length });
    } catch (err) {
        console.error('Duplicate scene error:', err);
        res.status(500).json({ error: 'Copie de la scène impossible' });
    }
});

// API: Delete a Scene
app.post('/api/scenes/delete', async (req, res) => {
    const { sceneId, token: reqToken } = req.body;
    const token = reqToken || getRequestToken(req);
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    if (!sceneId) return res.status(400).json({ error: 'sceneId manquant' });

    try {
        if (token !== config.licenseToken) {
            await config.loadSession(token);
        }
        const Action = require('./models/Action');
        const Event = require('./models/Event');

        await Promise.all([
            Action.deleteMany({ token, sceneId }),
            Event.deleteMany({ token, sceneId })
        ]);

        // If the deleted scene was active, reset to default
        const session = await config.getSessionFor(token);
        if (session.activeSceneId === sceneId) {
            await config.saveSettings({ activeSceneId: null, token });
            await config.loadSession(token);
        }
        notifyAppSessionChanged(token);

        res.json({ success: true, activeSceneId: (await config.getSessionFor(token)).activeSceneId });
    } catch (err) {
        console.error('Delete scene error:', err);
        res.status(500).json({ error: 'Erreur lors de la suppression de la scène' });
    }
});

// API: Start Connector
// Allow GET to show a clear error message instead of 404
// One start at a time per account: two quick starts (socket then HTTP fallback, double click) created two
// TikTok connections, so every action and point was counted twice
const startLocks = new Set();
app.post('/api/start', (req, res, next) => {
    const token = getRequestToken(req);
    if (!token) return next();
    if (startLocks.has(token)) return res.status(409).json({ error: 'ALREADY_STARTING', message: 'Connexion déjà en cours...' });
    startLocks.add(token);
    const release = () => startLocks.delete(token);
    res.on('finish', release);
    res.on('close', release);
    next();
});
app.get('/api/start', (req, res) => res.status(405).json({ error: 'Method Not Allowed', message: 'Utilisez une requête POST pour démarrer le bot.' }));
app.post('/api/start', async (req, res) => {
    const { username } = req.body;
    const token = getRequestToken(req);

    if (!token) {
        return res.status(401).json({ error: 'Token manquant', message: 'Veuillez vous reconnecter.' });
    }

    // Load session to ensure config.tiktokUsername and other settings are fresh for this token
    await config.loadSession(token);

    // the username of THIS account (the global getter could be another streamer's on the VPS)
    const tiktokUsername = username || (await config.getSessionFor(token)).username;
    const appConnected = isAppConnected(token);

    logger.info(`[API:Start] Request for ${tiktokUsername} | App Mode: ${config.isAppMode} | App Connected (Socket): ${appConnected} | Token: ${token.substring(0, 8)}...`);

    if (!tiktokUsername) return res.status(400).json({ error: 'Username manquant' });

    // 1. SMART CHECK: Stop any existing VPS connector if it exists for THIS token
    let connector = activeConnectors.get(token);
    if (connector) {
        if (connector.username === tiktokUsername && connector.isConnected) {
            console.log(`[API:Start] Already active for ${tiktokUsername}`);
            return res.status(409).json({ error: 'ALREADY_CONNECTED', message: 'Le bot est déjà lancé.' });
        }
        console.log(`[API:Start] Swapping connector for ${tiktokUsername}...`);
        await connector.stop();
        activeConnectors.delete(token);
    }

    // Where the live runs (Settings > Connexion au live): auto = the PC app when it is open, otherwise the cloud
    const runMode = (await config.getSettings(token)).runMode || 'auto';
    if (!config.isAppMode && runMode === 'pc' && !appConnected) {
        return res.status(412).json({
            error: 'APP_REQUIRED',
            message: "Vous avez choisi « Sur mon PC » : ouvrez l'application Gentok sur votre ordinateur (connectée au même compte), ou passez en mode Cloud dans Paramètres › Connexion au live."
        });
    }

    // 2. SMART RELAY: Check if we are on VPS and an App is connected
    if (!config.isAppMode && appConnected && runMode !== 'cloud') {
        console.log(`📡 [API:Relay] App connected via Socket for ${token.substring(0, 8)}. Sending remote_start...`);
        emitToApp(token, 'remote_start', { username: tiktokUsername });
        return res.status(202).json({
            success: true,
            relayed: true,
            message: 'Commande relayée à l\'application locale (Utilise votre IP).'
        });
    } else if (!config.isAppMode) {
        console.log(`☁️ [API:Direct] ${runMode === 'cloud' ? 'Cloud mode chosen' : 'No app connected'} for token ${token.substring(0, 8)}. Starting direct connection on VPS...`);
    }

    // 3. Normal Start (VPS or App Local)
    connector = new TikTokConnector(tiktokUsername, token);
    connector.onStopped = (c) => { if (activeConnectors.get(token) === c) activeConnectors.delete(token); };
    activeConnectors.set(token, connector);

    try {
        await connector.start();
        res.json({
            success: true,
            message: `Connexion établie pour ${tiktokUsername} sur le serveur.`
        });
    } catch (e) {
        if (connector) await connector.stop();
        activeConnectors.delete(token);

        // Extract error message properly (TikTok connector can return strings or objects)
        let errorMsg = 'Erreur de connexion';
        if (typeof e === 'string') errorMsg = e;
        else if (e && e.message) errorMsg = e.message;
        else if (e && e.info) errorMsg = e.info;
        else if (e && e.exception) errorMsg = typeof e.exception === 'string' ? e.exception : JSON.stringify(e.exception);

        const lowerMsg = errorMsg.toLowerCase();
        const isOffline = lowerMsg.includes('not live') ||
            lowerMsg.includes('offline') ||
            lowerMsg.includes("isn't online") ||
            lowerMsg.includes("not online");

        if (isOffline) {
            return res.status(400).json({ error: 'OFFLINE', message: 'L\'utilisateur n\'est pas en live.' });
        }

        logger.error(`[API:Start] Error for ${tiktokUsername}: ${errorMsg}`);
        res.status(500).json({ error: 'ERROR', message: errorMsg });
    }
});

// API: Stop Connector
// Allow GET to show a clear error message instead of 404
app.get('/api/stop', (req, res) => res.status(405).json({ error: 'Method Not Allowed', message: 'Utilisez une requête POST pour arrêter le bot.' }));
app.post('/api/stop', async (req, res) => {
    const token = getRequestToken(req);
    if (!token) return res.status(401).json({ error: 'Token manquant', message: 'Token requis.' });

    try {
        const connector = activeConnectors.get(token);
        const appConnected = isAppConnected(token);

        if (connector) {
            console.log(`[API:Stop] Stopping direct connector for token ${token.substring(0, 8)}...`);
            await connector.stop();
            activeConnectors.delete(token);

            // Stop Spotify too if it was playing
            try {
                await spotifyModule.pausePlayback(token);
            } catch (e) { }
        }

        if (!config.isAppMode && appConnected) {
            console.log(`🛑 [API:Relay] Relaying STOP command to app for token ${token.substring(0, 8)}...`);
            emitToApp(token, 'remote_stop', {});
        }

        // Notify UI via socket if available
        emitEvent('streamEnd', {}, token);

        res.json({ success: true, message: 'Bot arrêté (commande envoyée).' });
    } catch (e) {
        console.error('[API:Stop] Error:', e);
        res.status(500).json({ error: 'ERROR', message: e.message });
    }
});

// API: Reset Specific Stats (Top Gift / Top Streak)
app.post('/api/stats/reset', async (req, res) => {
    const { type, token: reqToken } = req.body;
    const token = reqToken || getRequestToken(req);
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    try {
        if (token !== config.licenseToken) {
            await config.loadSession(token);
        }

        const resetValues = {
            topGift: { coins: 0, uniqueId: 'PSEUDO', nickname: 'PSEUDO', giftName: null, giftIcon: 'https://tiktok.gentok.fr/img/tiktok/5655.png' },
            topStreak: { count: 0, uniqueId: 'PSEUDO', nickname: 'PSEUDO', giftName: null, giftIcon: 'https://tiktok.gentok.fr/img/tiktok/5655.png' }
        };

        const connector = activeConnectors.get(token);

        if (type === 'topGift') {
            if (connector && connector.stats) connector.stats.topGift = resetValues.topGift;
            await config.saveSettings({ topGift: resetValues.topGift, token });
        } else if (type === 'topStreak') {
            if (connector && connector.stats) connector.stats.topStreak = resetValues.topStreak;
            await config.saveSettings({ topStreak: resetValues.topStreak, token });
        } else if (type === 'all') {
            // Reset everything
            const currentViewerCount = (connector && connector.stats) ? (connector.stats.viewerCount || 0) : 0;
            const stats = {
                diamonds: 0,
                gifts: 0,
                likes: 0,
                shares: 0,
                follows: 0,
                viewerCount: currentViewerCount,
                viewerCountMax: 0,
                cumulativeViewers: 0,
                chats: 0,
                actionsBreakdown: {},
                giftsBreakdown: {},
                giftsCoinsBreakdown: {},
                giftsIcons: {},
                topGift: resetValues.topGift,
                topStreak: resetValues.topStreak
            };

            if (connector && connector.stats) {
                connector.stats = stats;
                connector.uniqueViewers.clear();
                connector.lastEvents = {
                    follower: null,
                    gift: null,
                    subscriber: null,
                    share: null,
                    like: null,
                    chat: null
                };
                emitEvent('initialLastEvents', connector.lastEvents, token);
            }
            await config.saveSettings({ topGift: resetValues.topGift, topStreak: resetValues.topStreak, token });
        } else {
            return res.status(400).json({ error: 'Type invalide' });
        }

        // If an App is connected, relay the reset command too
        if (isAppConnected(token)) {
            emitToApp(token, 'remote_stats_reset', { type });
        }

        // Always emit session_stats to update UI/Overlays immediately
        let finalStats;
        const currentSettings = await config.getSettings(token);

        if (connector && connector.stats) {
            finalStats = connector.stats;
        } else {
            // If bot not running, emit current settings + reset values
            finalStats = {
                viewerCount: 0,
                diamonds: 0,
                gifts: 0,
                likes: 0,
                shares: 0,
                follows: 0,
                cumulativeViewers: 0,
                chats: 0,
                topGift: currentSettings.topGift || resetValues.topGift,
                topStreak: currentSettings.topStreak || resetValues.topStreak,
                topCoinsTitle: currentSettings.topCoins?.title || 'TOP COINS',
                topCoinsLimit: currentSettings.topCoins?.limit || 10,
                topCoinsStyle: currentSettings.topCoins?.style || 1,
                topCoinsTransparent: currentSettings.topCoins?.transparent !== false,
                topCoinsShowTitle: currentSettings.topCoins?.showTitle !== false,
                topCoinsRtl: currentSettings.topCoins?.rtl === true,
                topLikesTitle: currentSettings.topLikes?.title || 'TOP LIKES',
                topLikesLimit: currentSettings.topLikes?.limit || 10,
                topLikesStyle: currentSettings.topLikes?.style || 1,
                topLikesTransparent: currentSettings.topLikes?.transparent !== false,
                topLikesShowTitle: currentSettings.topLikes?.showTitle !== false,
                topLikesRtl: currentSettings.topLikes?.rtl === true
            };
        }
        emitEvent('session_stats', finalStats, token);

        res.json({ success: true });
    } catch (err) {
        console.error('Reset stats error:', err);
        res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
    }
});

// API: Update Top Widget Title
app.post('/api/stats/update-title', async (req, res) => {
    const { type, title, token: reqToken } = req.body;
    const token = reqToken || getRequestToken(req);
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    try {
        if (token !== config.licenseToken) await config.loadSession(token);

        const connector = activeConnectors.get(token);
        const settings = await config.getSettings(token);

        let targetStat = null;
        if (type === 'topGift') {
            targetStat = settings.topGift || {};
            if (title !== undefined) targetStat.customTitle = title;
            if (req.body.font !== undefined) targetStat.font = req.body.font;
            await config.saveSettings({ topGift: targetStat, token });
            if (connector && connector.stats) {
                if (!connector.stats.topGift) connector.stats.topGift = {};
                if (title !== undefined) connector.stats.topGift.customTitle = title;
                if (req.body.font !== undefined) connector.stats.topGift.font = req.body.font;
            }
        } else if (type === 'topStreak') {
            targetStat = settings.topStreak || {};
            if (title !== undefined) targetStat.customTitle = title;
            if (req.body.font !== undefined) targetStat.font = req.body.font;
            await config.saveSettings({ topStreak: targetStat, token });
            if (connector && connector.stats) {
                if (!connector.stats.topStreak) connector.stats.topStreak = {};
                if (title !== undefined) connector.stats.topStreak.customTitle = title;
                if (req.body.font !== undefined) connector.stats.topStreak.font = req.body.font;
            }
        } else if (type === 'topCoins') {
            targetStat = settings.topCoins || {};
            if (title !== undefined) targetStat.title = title;
            if (req.body.limit !== undefined) targetStat.limit = parseInt(req.body.limit);
            if (req.body.style !== undefined) targetStat.style = parseInt(req.body.style);
            if (req.body.transparent !== undefined) targetStat.transparent = !!req.body.transparent;
            if (req.body.showTitle !== undefined) targetStat.showTitle = !!req.body.showTitle;
            if (req.body.rtl !== undefined) targetStat.rtl = !!req.body.rtl;
            if (req.body.font !== undefined) targetStat.font = req.body.font;

            // Persist
            await config.saveSettings({ topCoins: targetStat, token });

            // Update Connector Live State
            if (connector) {
                if (req.body.limit !== undefined) connector.topCoinsLimit = parseInt(req.body.limit);
                if (connector.stats) {
                    connector.stats.topCoinsTitle = targetStat.title;
                    connector.stats.topCoinsLimit = targetStat.limit;
                    connector.stats.topCoinsStyle = targetStat.style;
                    connector.stats.topCoinsTransparent = targetStat.transparent;
                    connector.stats.topCoinsShowTitle = targetStat.showTitle;
                    if (req.body.rtl !== undefined) {
                        connector.stats.topCoinsRtl = targetStat.rtl;
                    }
                    // Re-slice if limit changed
                    if (req.body.limit !== undefined && connector.topCoinsMap) {
                        connector.stats.topCoins = Array.from(connector.topCoinsMap.values())
                            .sort((a, b) => b.coins - a.coins)
                            .slice(0, connector.topCoinsLimit);
                    }
                }
            }
        } else if (type === 'topLikes') {
            targetStat = settings.topLikes || {};
            if (title !== undefined) targetStat.title = title;
            if (req.body.limit !== undefined) targetStat.limit = parseInt(req.body.limit);
            if (req.body.style !== undefined) targetStat.style = parseInt(req.body.style);
            if (req.body.transparent !== undefined) targetStat.transparent = !!req.body.transparent;
            if (req.body.showTitle !== undefined) targetStat.showTitle = !!req.body.showTitle;
            if (req.body.rtl !== undefined) targetStat.rtl = !!req.body.rtl;
            if (req.body.font !== undefined) targetStat.font = req.body.font;

            // Persist
            await config.saveSettings({ topLikes: targetStat, token });

            // Update Connector Live State
            if (connector) {
                if (req.body.limit !== undefined) connector.topLikesLimit = parseInt(req.body.limit);
                if (connector.stats) {
                    connector.stats.topLikesTitle = targetStat.title;
                    connector.stats.topLikesLimit = targetStat.limit;
                    connector.stats.topLikesStyle = targetStat.style;
                    connector.stats.topLikesTransparent = targetStat.transparent;
                    connector.stats.topLikesShowTitle = targetStat.showTitle;
                    if (req.body.rtl !== undefined) {
                        connector.stats.topLikesRtl = targetStat.rtl;
                    }
                    // Re-slice if limit changed
                    if (req.body.limit !== undefined && connector.topLikesMap) {
                        connector.stats.topLikes = Array.from(connector.topLikesMap.values())
                            .sort((a, b) => b.count - a.count)
                            .slice(0, connector.topLikesLimit);
                    }
                }
            }
        } else {
            return res.status(400).json({ error: 'Type invalide' });
        }

        // Emit update
        // Emit update
        let statsToSend = (connector && connector.stats) ? connector.stats : {
            topGift: settings.topGift,
            topStreak: settings.topStreak,

            // Coins flatten
            topCoinsTitle: settings.topCoins?.title,
            topCoinsStyle: settings.topCoins?.style,
            topCoinsLimit: settings.topCoins?.limit,
            topCoinsTransparent: settings.topCoins?.transparent,
            topCoinsShowTitle: settings.topCoins?.showTitle,
            topCoinsRtl: settings.topCoins?.rtl,

            // Likes flatten
            topLikesTitle: settings.topLikes?.title,
            topLikesStyle: settings.topLikes?.style,
            topLikesLimit: settings.topLikes?.limit,
            topLikesTransparent: settings.topLikes?.transparent,
            topLikesShowTitle: settings.topLikes?.showTitle,
            topLikesRtl: settings.topLikes?.rtl
        };
        emitEvent('session_stats', statsToSend, token);

        res.json({ success: true });
    } catch (e) {
        console.error('Update Title Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// API: Test Leaderboard (Simulate info)
app.post('/api/stats/test-leaderboard', async (req, res) => {
    const { type, token: reqToken } = req.body;
    const token = reqToken || getRequestToken(req);
    if (!token) return res.status(401).json({ error: 'Token manquant' });

    try {
        const dummyData = [
            { uniqueId: 'TikTokUser1', nickname: 'Généreux 1', coins: 500, count: 1200, profilePictureUrl: 'https://tiktok.gentok.fr/img/tiktok/5655.png' },
            { uniqueId: 'FanTiktok2', nickname: 'Abonné Fidèle', coins: 450, count: 1100, profilePictureUrl: 'https://tiktok.gentok.fr/img/tiktok/5655.png' },
            { uniqueId: 'ViewerActive3', nickname: 'Chatter Pro', coins: 300, count: 900, profilePictureUrl: 'https://tiktok.gentok.fr/img/tiktok/5655.png' },
            { uniqueId: 'Liker4', nickname: 'Cœur sur vous', coins: 150, count: 500, profilePictureUrl: 'https://tiktok.gentok.fr/img/tiktok/5655.png' },
            { uniqueId: 'Donor5', nickname: 'Soutien Live', coins: 50, count: 100, profilePictureUrl: 'https://tiktok.gentok.fr/img/tiktok/5655.png' },
        ];

        const settings = await config.getSettings(token);
        const connector = activeConnectors.get(token);

        let statsToSend = {};
        if (connector && connector.stats) {
            statsToSend = { ...connector.stats };
        } else {
            statsToSend = {
                topCoins: [],
                topLikes: [],
                topCoinsTitle: settings.topCoins?.title || 'TOP COINS',
                topLikesTitle: settings.topLikes?.title || 'TOP LIKES',
                topCoinsLimit: settings.topCoins?.limit || 10,
                topLikesLimit: settings.topLikes?.limit || 10,
            };
        }

        if (type === 'coins') statsToSend.topCoins = dummyData;
        if (type === 'likes') statsToSend.topLikes = dummyData;

        const { emitEvent } = require('./utils/socket');
        emitEvent('session_stats', statsToSend, token);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Logout (Explicit)
app.post('/api/logout', async (req, res) => {
    const token = getRequestToken(req);
    try {
        const connector = activeConnectors.get(token);
        if (connector) {
            await connector.stop();
            activeConnectors.delete(token);
            // [NEW] Stop Spotify if active
            try {
                await spotifyModule.pausePlayback(token);
            } catch (e) { }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Reset / Logout
app.post('/api/reset', async (req, res) => {
    try {
        const token = getRequestToken(req);
        if (!token) return res.status(400).send('Token manquant');

        if (token !== config.licenseToken) {
            await config.loadSession(token);
        }

        // Stop if running
        const connector = activeConnectors.get(token);
        if (connector) {
            await connector.stop();
            activeConnectors.delete(token);

            // [NEW] Stop Spotify if active
            try {
                await spotifyModule.pausePlayback(token);
            } catch (e) { }
        }
        // PERSIST: Remove last active token (Scoped by machine in App Mode)
        const lastTokenKey = config.isAppMode ? `lastActiveToken_${os.hostname()}` : 'lastActiveToken';
        await Global.deleteOne({ key: lastTokenKey });

        // Re-read this user's data from the database
        await config.invalidate(token);
        logger.info('🔄 Application réinitialisée (Logout)');
        res.send('Reset OK');
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// API: Test a single action manually
app.post('/api/test-action/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.query.token || req.body.token;

        if (!token) return res.status(400).json({ error: 'Token manquant' });

        // Use ActionManager to execute it by ID (handles loading correct settings)
        const actionManager = require('./actions/actionManager');

        // We simulate a connector context
        const connector = { token, stats: {} };

        await actionManager.executeActionById(id, connector, { uniqueId: 'test_user' });

        res.json({ success: true });
    } catch (e) {
        logger.error(`Erreur test action : ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// API: Test OBS connection (obs-websocket v5) and list its scenes
app.post('/api/obs/test', async (req, res) => {
    const { host, port, password } = req.body || {};
    try {
        const { testObs } = require('./actions/obsAction');
        const result = await testObs({ host, port, password });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Test Minecraft Connection (ServerTap)
app.post('/api/minecraft/test', async (req, res) => {
    const { host, port, password } = req.body;
    try {
        const url = `http://${host}:${port}/v1/server`;
        const response = await axios.get(url, {
            headers: { 'key': password },
            timeout: 5000
        });
        if (response.status === 200) {
            const serverData = response.data;
            const info = `${serverData.name} ${serverData.version} (MOTD: ${serverData.motd})`;
            res.json({ success: true, message: 'Connexion réussie !', details: info });
        } else {
            res.status(response.status).json({ success: false, message: `Erreur: ${response.statusText}` });
        }
    } catch (err) {
        console.error('Minecraft test error:', err.message);
        res.status(500).json({ success: false, message: `Erreur: ${err.message}` });
    }
});

const { getIO } = require('./utils/socket');

const trackStopGraceCounts = new Map(); // token -> count

/**
 * Polls Spotify for all active tokens (users with connected overlays) 
 * and broadcasts the current state.
 */
async function updateSpotifyOverlay() {
    const { getActiveTokens } = require('./utils/socket');
    const activeTokens = getActiveTokens();

    for (const token of activeTokens) {
        try {
            const settings = await config.getSettings(token);
            const spotifySettings = settings.spotify;

            if (!spotifySettings.enabled || !spotifySettings.refreshToken) {
                continue;
            }

            // [FIX] safeRefresh will call initSpotify if needed
            await spotifyModule.safeRefresh(token);
            const api = spotifyModule.getApi(token);
            if (!api) continue;

            let stateResponse;
            try {
                stateResponse = await api.getMyCurrentPlaybackState();
            } catch (err) {
                if (err.statusCode === 401) {
                    const refreshed = await spotifyModule.safeRefresh(token, true);
                    if (refreshed) stateResponse = await api.getMyCurrentPlaybackState();
                    else throw err;
                } else throw err;
            }

            const state = stateResponse.body;
            let currentGrace = trackStopGraceCounts.get(token) || 0;

            if (!state || !state.is_playing || !state.item) {
                if (state && state.is_playing && !state.item) {
                    // Possible video/podcast
                }
                currentGrace++;
                trackStopGraceCounts.set(token, currentGrace);

                // Nothing playing: start the first request once. Never again after that, or a pause
                // of the streamer would be undone every 2 seconds.
                const localQueue = spotifyModule.getQueue(token);
                if (localQueue.length > 0 && !localQueue[0].isQueuedInSpotify && (!state || !state.is_playing)) {
                    try {
                        const devices = await api.getMyDevices();
                        if (devices.body.devices.some(d => d.is_active)) {
                            await api.play({ uris: [localQueue[0].uri] });
                            localQueue[0].isQueuedInSpotify = true;
                        }
                    } catch (playErr) { }
                }

                if (currentGrace >= 2) {
                    const localQueue = spotifyModule.getQueue(token);
                    getIO().to(`room:${token}`).emit('overlayUpdate', {
                        isPlaying: false,
                        queue: localQueue.map(t => ({
                            id: t.id,
                            title: t.title,
                            artist: t.artist,
                            albumArt: t.albumArt,
                            duration: t.duration,
                            requestedBy: t.requestedBy
                        }))
                    });
                }
                continue;
            }

            trackStopGraceCounts.set(token, 0); // Reset grace
            const track = state.item;
            const remaining = track.duration_ms - state.progress_ms;

            const localQueue = spotifyModule.getQueue(token);
            if (localQueue.length > 0 && !localQueue[0].isQueuedInSpotify && remaining < 15000) {
                try {
                    await api.addToQueue(localQueue[0].uri);
                    localQueue[0].isQueuedInSpotify = true;
                } catch (err) { }
            }

            const currentInfo = spotifyModule.getCurrentTrackInfo(token);
            if (currentInfo.id !== track.id) {
                spotifyModule.clearVotes(token);

                const trackName = track.name.toLowerCase().trim();
                const trackArtist = track.artists[0]?.name.toLowerCase().trim();

                const matchIndex = localQueue.findIndex(t => {
                    const titleMatch = t.title.toLowerCase().trim() === trackName;
                    const artistMatch = t.artist.toLowerCase().includes(trackArtist) || trackArtist.includes(t.artist.toLowerCase());
                    return t.id === track.id || (titleMatch && artistMatch);
                });

                if (matchIndex !== -1) {
                    const playedTracks = localQueue.splice(0, matchIndex + 1);
                    const played = playedTracks[playedTracks.length - 1];
                    logger.info(`[Spotify:${String(token).substring(0, 8)}] Now Playing (Match): ${track.name} [by ${played.requestedBy}]`);
                    spotifyModule.setCurrentTrack(token, track.id, track.name, played.requestedBy, played.userId);

                    const userTracksCount = spotifyModule.getUserTracksCount(token);
                    playedTracks.forEach(p => {
                        if (userTracksCount.has(p.userId)) {
                            userTracksCount.set(p.userId, Math.max(0, userTracksCount.get(p.userId) - 1));
                        }
                    });
                } else {
                    spotifyModule.setCurrentTrack(token, track.id, track.name, null, null);
                }
            }

            const payload = {
                isPlaying: true,
                current: {
                    id: track.id,
                    title: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    albumArt: track.album.images[0]?.url,
                    duration: track.duration_ms,
                    progress: state.progress_ms,
                    requestedBy: spotifyModule.getCurrentTrackInfo(token).requester
                },
                queue: localQueue.map(t => ({
                    id: t.id,
                    title: t.title,
                    artist: t.artist,
                    albumArt: t.albumArt,
                    duration: t.duration,
                    requestedBy: t.requestedBy
                }))
            };

            getIO().to(`room:${token}`).emit('overlayUpdate', payload);

        } catch (err) {
            // Silently skip this token's update on error
        }
    }
}

setInterval(updateSpotifyOverlay, 2000);



async function requireAdmin(req, res) {
    const token = req.query?.token || req.body?.token;
    if (!token) {
        if (res) res.status(401).json({ error: 'Token manquant' });
        return null;
    }

    try {
        const User = require('./models/User');
        const user = await User.findOne({ token }).maxTimeMS(3000).exec();

        if (!user || (!user.isAdmin && user.email !== 'untigrounightcore@gmail.com')) {
            console.warn('[AUTH] Unauthorized/NotFound');
            if (res) res.status(403).json({ error: 'Accès refusé' });
            return null;
        }

        return user;
    } catch (err) {
        console.error('[AUTH] DB Timeout or Error:', err.message);
        if (res) res.status(500).json({ error: 'Serveur occupé, réessayez.' });
        return null;
    }
}



// Admin: List all users
app.get('/api/admin/users', async (req, res) => {
    console.log('[ADMIN_API] GET /api/admin/users called');
    try {
        const admin = await requireAdmin(req, res);
        if (!admin) {
            console.warn('[ADMIN_API] Access denied: User is not admin or missing token');
            return;
        }

        console.log('[ADMIN_API] Admin identified:', admin.username);

        const User = require('./models/User');
        const Settings = require('./models/Settings');
        const users = await User.find({}).select('-passwordHash').lean().maxTimeMS(5000);

        console.log('[ADMIN_API] Found users:', users.length);

        // Bulk fetch settings to avoid N+1 queries (massive speed up)
        const tokens = users.map(u => u.token).filter(t => !!t);
        const allSettings = await Settings.find({ token: { $in: tokens } }).select('token isPremium').lean();
        const settingsMap = new Map(allSettings.map(s => [s.token, s.isPremium]));

        for (const u of users) {
            u.isPremium = settingsMap.get(u.token) || false;
        }

        const premiumCount = users.filter(u => u.isPremium).length;
        const onlineCount = activeConnectors.size;

        console.log('[ADMIN_API] Returning data for', users.length, 'users');
        res.json({ users, total: users.length, premium: premiumCount, online: onlineCount });
    } catch (err) {
        console.error('[ADMIN_API] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Toggle Premium for a user
app.post('/api/admin/users/toggle-premium', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const { userToken, isPremium } = req.body || {};
        const Settings = require('./models/Settings');
        if (!userToken) return res.status(400).json({ error: 'userToken manquant' });
        await Settings.updateOne({ token: userToken }, { $set: { isPremium: !!isPremium } }, { upsert: true });
        // Make the change visible immediately (otherwise the cached session keeps the old value)
        await config.invalidate(userToken);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Toggle Admin for a user
app.post('/api/admin/users/toggle-admin', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const { userId, isAdmin } = req.body || {};
        const User = require('./models/User');
        await User.updateOne({ _id: userId }, { $set: { isAdmin: !!isAdmin } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Delete a user
app.delete('/api/admin/users/:userId', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const User = require('./models/User');
        const Settings = require('./models/Settings');
        const Action = require('./models/Action');
        const Event = require('./models/Event');

        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

        // Clean up all user data
        await Settings.deleteMany({ token: user.token });
        await Action.deleteMany({ token: user.token });
        await Event.deleteMany({ token: user.token });
        await User.deleteOne({ _id: req.params.userId });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: System Info
app.get('/api/admin/system', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const mem = process.memoryUsage();
        const io = getIO();

        const connectors = [];
        for (const [token, connector] of activeConnectors) {
            connectors.push({
                token: token.substring(0, 8) + '...',
                username: connector.username || 'N/A',
                isConnected: connector.isConnected || false,
                stats: connector.stats ? {
                    likes: connector.stats.likes || 0,
                    diamonds: connector.stats.diamonds || 0,
                    viewers: connector.stats.viewerCount || 0
                } : null
            });
        }

        res.json({
            memory: {
                rss: (mem.rss / 1024 / 1024).toFixed(1) + ' MB',
                heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1) + ' MB',
                heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1) + ' MB',
                external: (mem.external / 1024 / 1024).toFixed(1) + ' MB'
            },
            connectors: connectors,
            activeConnectors: activeConnectors.size,
            activeSockets: io ? io.engine.clientsCount : 0,
            uptime: Math.floor(process.uptime()) + 's',
            nodeVersion: process.version,
            platform: process.platform
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: DB Collections info
app.get('/api/admin/db', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const mongoose = require('mongoose');
        const collections = await mongoose.connection.db.listCollections().toArray();
        const result = [];
        for (const col of collections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            result.push({ name: col.name, count });
        }
        res.json({ collections: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Clear settings cache
app.post('/api/admin/clear-cache', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        // Clear internal caches
        await config.clearCache();
        res.json({ success: true, message: 'Cache vidé avec succès' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Inspect user settings
app.get('/api/admin/inspect/:userToken', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const Settings = require('./models/Settings');
        const User = require('./models/User');
        const Action = require('./models/Action');
        const Event = require('./models/Event');

        const userToken = req.params.userToken;
        const user = await User.findOne({ token: userToken }).select('-passwordHash').lean();
        const settings = await Settings.findOne({ token: userToken }).lean();
        const actions = await Action.find({ token: userToken }).lean();
        const events = await Event.find({ token: userToken }).lean();

        res.json({ user, settings, actions: actions.length, events: events.length, raw: settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: Export all data
app.get('/api/admin/export', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const User = require('./models/User');
        const Settings = require('./models/Settings');
        const users = await User.find({}).select('-passwordHash').lean();
        const settings = await Settings.find({}).lean();

        res.json({ exportDate: new Date().toISOString(), users, settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function startServer() {
    return new Promise(async (resolve, reject) => {
        try {
            logger.info('🔌 Initialisation de la base de données...');
            await connectDB();
            logger.info('✅ Base de données prête.');

            const PORT = process.env.PORT || 3000;

            // PERSIST: Load last active token on start (Scoped by machine in App Mode)
            // A failure here (e.g. database offline) must not prevent the server from starting
            try {
                const lastTokenKey = config.isAppMode ? `lastActiveToken_${os.hostname()}` : 'lastActiveToken';
                const lastToken = await Global.findOne({ key: lastTokenKey }).maxTimeMS(5000);
                if (lastToken && lastToken.value) {
                    logger.info(`✨ Restauration de la session (${config.isAppMode ? 'Locale' : 'VPS'}) pour : ${String(lastToken.value).substring(0, 8)}...`);
                    await config.loadSession(lastToken.value);

                    // [RELAY] Connect to remote server as soon as token is restored
                    initRemoteClient();
                }
            } catch (restoreErr) {
                logger.warn(`⚠️ Session précédente non restaurée : ${restoreErr.message}`);
            }

            server.listen(PORT, async () => {
                logger.info(`🌐 Dashboard disponible sur : http://localhost:${PORT}`);

                // [BILLING] Premium ends with the paid period (checked on the VPS, which receives the payments)
                if (!config.isAppMode) {
                    const runExpiry = async () => {
                        try {
                            const expired = await billing.expireOverdue(require('./models/Settings'));
                            for (const token of expired) {
                                await config.invalidate(token);
                                emitEvent('premium_updated', { premium: false, status: 'expired' }, token);
                            }
                            if (expired.length) logger.info(`⌛ [BILLING] ${expired.length} abonnement(s) Premium expiré(s).`);
                        } catch (e) {
                            logger.warn(`⚠️ [BILLING] Vérification des expirations impossible : ${e.message}`);
                        }
                    };
                    runExpiry();
                    setInterval(runExpiry, 15 * 60 * 1000).unref();
                }

                // [GUI] Auto-launch browser in App Mode
                if (config.isAppMode) {
                    if (process.versions.electron) {
                        logger.info('📱 Application lancée dans une fenêtre dédiée.');
                        resolve(); // Ready for Electron
                        return;
                    }

                    try {
                        logger.info('🚀 Lancement automatique du tableau de bord (Launcher)...');
                        const url = `http://localhost:${PORT}/launcher.html`; // [NEW] Start with launcher
                        const command = process.platform === 'win32' ? `start ${url}` : `open ${url}`;
                        exec(command);
                    } catch (err) {
                        logger.error(`🚨 Impossible d'ouvrir le navigateur : ${err.message}`);
                    }
                }

                // Weekly archive of the Top Légende / top coins / top likes (Sunday 23:00).
                // Only on the VPS: every desktop app shares the same database, if they also ran it each
                // one would reset everybody's week and overwrite the archive with an empty one.
                if (!config.isAppMode) {
                    const { initScheduler } = require('./utils/scheduler');
                    initScheduler();
                }

                resolve();
            });
        } catch (err) {
            logger.error(`🚨 Échec du démarrage du serveur : ${err.message}`);
            reject(err);
        }
    });
}

// Stops every live connection (each one saves its history). Used when the app closes.
async function stopAllConnectors() {
    const all = Array.from(activeConnectors.values());
    await Promise.all(all.map(c => c.stop().catch(e => logger.warn(`⚠️ Arrêt de la connexion impossible : ${e.message}`))));
    activeConnectors.clear();
}

module.exports = { startServer, stopAllConnectors, getConnector: (token) => token ? activeConnectors.get(token) : null };
