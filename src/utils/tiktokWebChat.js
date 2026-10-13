/**
 * Chat bot without Euler Stream: the Gentok desktop app posts the messages itself, through a hidden
 * window showing the streamer's live on tiktok.com, logged in with the bot account.
 *
 * The streamer logs the bot account in once (login()), in a window of its own; TikTok's cookies stay in a
 * separate, persistent browser profile of the app (partition PARTITION) and never leave the PC.
 * send() opens (or reuses) https://www.tiktok.com/@<streamer>/live in a hidden window, types the text in the
 * live chat box and sends it, like a person would. No signing service, no API key, no cookie to copy.
 *
 * Only usable in the Electron main process. TikTok can change its web page: the selectors below are tried
 * in order, and a failure is reported (logged on the server, shown by the dashboard's test button).
 */
const logger = require('./logger');

const PARTITION = 'persist:gentok-chatbot';
const IDLE_CLOSE_MS = 15 * 60 * 1000; // the hidden live page (video, socket) is closed after 15 min without messages
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

let chatWin = null;
let chatUrl = '';
let idleTimer = null;
let loginWin = null;
let chain = Promise.resolve(); // one message at a time

function electron() {
    try { return require('electron'); } catch (e) { return null; }
}
function available() {
    const e = electron();
    return !!(e && e.BrowserWindow && e.app && process.versions.electron);
}
function profile() {
    return electron().session.fromPartition(PARTITION);
}

async function isLoggedIn() {
    if (!available()) return false;
    try {
        const cookies = await profile().cookies.get({ name: 'sessionid' });
        return cookies.some(c => c.value && /tiktok\.com$/.test(String(c.domain).replace(/^\./, '')));
    } catch (e) { return false; }
}

/** Opens TikTok's login page in a window; resolves with the login state when the window is closed (or logged in) */
function login() {
    if (!available()) return Promise.resolve(false);
    const { BrowserWindow } = electron();
    if (loginWin && !loginWin.isDestroyed()) { loginWin.focus(); return Promise.resolve(false); }
    return new Promise((resolve) => {
        loginWin = new BrowserWindow({
            width: 480, height: 780, title: 'Gentok · Compte bot TikTok', autoHideMenuBar: true,
            webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true }
        });
        loginWin.webContents.setUserAgent(UA);
        loginWin.loadURL('https://www.tiktok.com/login');
        // logged in: TikTok sets "sessionid"; close the window by itself shortly after
        const check = setInterval(async () => {
            if (await isLoggedIn()) {
                clearInterval(check);
                setTimeout(() => { if (loginWin && !loginWin.isDestroyed()) loginWin.close(); }, 1500);
            }
        }, 1500);
        loginWin.on('closed', async () => {
            clearInterval(check);
            loginWin = null;
            resolve(await isLoggedIn());
        });
    });
}

async function logout() {
    if (!available()) return;
    closeChat();
    await profile().clearStorageData();
}

function closeChat() {
    clearTimeout(idleTimer);
    if (chatWin && !chatWin.isDestroyed()) chatWin.destroy();
    chatWin = null;
    chatUrl = '';
}

function chatWindow() {
    if (chatWin && !chatWin.isDestroyed()) return chatWin;
    const { BrowserWindow } = electron();
    chatWin = new BrowserWindow({
        show: false, width: 1280, height: 900,
        webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
    });
    chatWin.webContents.setUserAgent(UA);
    chatWin.webContents.setAudioMuted(true);
    chatWin.on('closed', () => { chatWin = null; chatUrl = ''; });
    return chatWin;
}

// Runs in the TikTok page: finds the chat box, replaces its content with the text. Returns a status string.
function pageType(text) {
    const SELECTORS = [
        '[data-e2e="comment-input"] [contenteditable]',
        'div[contenteditable="plaintext-only"]',
        '[data-e2e="comment-input"]',
        'div[contenteditable="true"][placeholder]',
        'div[contenteditable="true"]'
    ];
    let box = null;
    for (const s of SELECTORS) {
        box = Array.from(document.querySelectorAll(s)).find(el => el.offsetParent !== null && el.isContentEditable);
        if (box) break;
    }
    if (!box) {
        if (/login|signup/i.test(location.href) || document.querySelector('[data-e2e="top-login-button"]')) return 'login';
        return 'nobox';
    }
    box.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, text);
    return (box.innerText || box.textContent || '').trim() ? 'typed' : 'notyped';
}

// Runs in the page after Enter: the box is emptied once TikTok took the message. Else clicks the send button.
function pageConfirm() {
    const box = document.querySelector('[data-e2e="comment-input"] [contenteditable], div[contenteditable="plaintext-only"], div[contenteditable="true"]');
    if (!box || !(box.innerText || '').trim()) return 'sent';
    const btn = document.querySelector('[data-e2e="comment-post"], button[aria-label="Post"], button[aria-label="Publier"], [data-e2e="comment-send"]');
    if (btn) { btn.click(); return 'clicked'; }
    return 'pending';
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function sendNow(username, text) {
    if (!available()) throw new Error('application Gentok requise');
    if (!(await isLoggedIn())) throw new Error('compte bot non connecté dans l\'application (Utilisateurs & Points › Compte bot)');
    const user = String(username || '').replace(/^@/, '').trim();
    if (!/^[\w.]{2,40}$/.test(user)) throw new Error('pseudo TikTok du live invalide');
    const win = chatWindow();
    const url = `https://www.tiktok.com/@${user}/live`;
    if (chatUrl !== url) {
        await win.loadURL(url);
        chatUrl = url;
    }
    // the chat box appears once the live page is ready
    let status = 'nobox';
    for (let i = 0; i < 30; i++) {
        status = await win.webContents.executeJavaScript(`(${pageType.toString()})(${JSON.stringify(String(text))})`).catch(() => 'nobox');
        if (status === 'typed' || status === 'login') break;
        await wait(1000);
    }
    if (status === 'login') { closeChat(); throw new Error('TikTok demande de reconnecter le compte bot'); }
    if (status !== 'typed') { closeChat(); throw new Error('zone de chat introuvable (le live est-il en cours ?)'); }
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
    win.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
    for (let i = 0; i < 6; i++) {
        await wait(500);
        const r = await win.webContents.executeJavaScript(`(${pageConfirm.toString()})()`).catch(() => 'pending');
        if (r === 'sent') break;
        if (i === 5) throw new Error('TikTok n\'a pas accepté le message (compte restreint ou trop rapide ?)');
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(closeChat, IDLE_CLOSE_MS);
    return true;
}

/** Posts a message in the live chat of @username with the bot account. Messages are sent one at a time. */
function send(username, text) {
    const run = chain.then(() => sendNow(username, String(text || '').slice(0, 150)));
    chain = run.catch(() => { });
    return run.then(() => {
        logger.info(`💬 Bot chat (application) : ${text}`);
        return true;
    }, (err) => {
        logger.warn(`⚠️ Bot chat (application) : message non envoyé (${err.message}).`);
        throw err;
    });
}

module.exports = { available, isLoggedIn, login, logout, send, closeChat, PARTITION, _page: { pageType, pageConfirm } };
