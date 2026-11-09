// make.mjs: crea i 3 modelli di annuncio (1080x1350, Instagram/Facebook) e un'anteprima affiancata
//   node annunci/make.mjs   (dalla cartella lbs-video)
// Per un nuovo annuncio cambia i DATI qui sotto e la foto in annunci/assets/foto-esempio.jpg
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DATI = {
  RUOLO: 'CARTONGESSISTA',
  SOTTO: 'per azienda tedesca',
  SOTTO_B: 'tedesca',
  CITTA: 'Kassel',
  STIP: '3.000 € netti',
  STIP_N: '3.000€', STIP_U1: 'netti', STIP_U2: 'al mese',
  ALLOG: 'Pagato dall’azienda',
  ALLOG_LUNGO: 'pagato dal datore di lavoro',
};

const D = 'annunci', B = '../banner/assets';
const b64 = p => readFileSync(path.resolve(D, p)).toString('base64');
const flag = (c, w) => c === 'it'
  ? `<svg width="${w}" height="${w * 2 / 3}" viewBox="0 0 3 2" style="border-radius:3px"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>`
  : `<svg width="${w}" height="${w * 2 / 3}" viewBox="0 0 3 2" style="border-radius:3px"><rect width="3" height=".67" fill="#111"/><rect y=".67" width="3" height=".67" fill="#dd0000"/><rect y="1.33" width="3" height=".67" fill="#ffce00"/></svg>`;
const ico = (d, c = '#30103D', s = 30, sw = 2.4) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const PIN = '<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/>';
const EURO = '<path d="M18 7.5A7 7 0 1 0 18 16.5"/><path d="M4 10.5h9M4 13.5h9"/>';
const CASA = '<path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>';
// fumetto con cornetta (icona "scrivici in chat")
const WA = c => `<path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.6z" stroke="${c}"/><path d="M9 8.6c.2-.5.6-.6 1-.6l.8 1.8-.7.9c.5 1.1 1.3 1.9 2.4 2.4l.9-.7 1.8.8c0 .4-.1.8-.6 1-1 .5-2.3.3-3.8-1s-2.6-2.7-1.8-4.6z" fill="${c}" stroke="none"/>`;
const CK = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

const rep = {
  ...DATI,
  PJS: b64(B + '/pjs.woff2'), INTER: b64(B + '/inter.woff2'), LOGO: b64(B + '/logo.png'),
  ICO_cappello: b64(B + '/icone/cappello.png'), ICO_aereo: b64(B + '/icone/aereo.png'),
  FOTO: b64('assets/foto-esempio.jpg'),
  IT: flag('it', 36), DE: flag('de', 36),
  I_PIN: ico(PIN), I_EURO: ico(EURO), I_CASA: ico(CASA),
  I_PIN_W: ico(PIN, '#fff', 32), I_CASA_W: ico(CASA, '#fff', 32),
  I_WA_BIG: `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linejoin="round">${WA('#DAB6FC')}</svg>`,
  I_WA_P: `<svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linejoin="round">${WA('#5E2D61')}</svg>`,
  CK,
};
let s = readFileSync(path.join(D, 'annunci.src.html'), 'utf8');
for (const [k, v] of Object.entries(rep)) s = s.replaceAll(`{{${k}}}`, v);
const left = s.match(/\{\{\w+\}\}/g); if (left) throw new Error('segnaposto mancanti: ' + [...new Set(left)]);
writeFileSync(path.join(D, 'annunci.html'), s);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 1 });
await pg.goto('file://' + path.resolve(D, 'annunci.html'));
await pg.evaluate(async () => { await window.FIT; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
const names = { A: 'poster', B: 'scheda', C: 'chiaro' };
for (const v of Object.keys(names)) await pg.locator('#' + v).screenshot({ path: `${D}/annuncio-${v}-${names[v]}.jpg`, type: 'jpeg', quality: 93 });
const img = v => 'data:image/jpeg;base64,' + readFileSync(`${D}/annuncio-${v}-${names[v]}.jpg`).toString('base64');
await pg.setContent(`<body style="margin:0;padding:40px;background:#1b1b1b;display:flex;gap:36px;width:max-content">${Object.keys(names).map(v =>
  `<div><div style="font:800 34px sans-serif;color:#fff;margin:0 0 16px">Modello ${v} · ${names[v]}</div><img src="${img(v)}" style="width:640px;border-radius:14px;display:block"></div>`).join('')}</body>`);
await pg.setViewportSize({ width: 2080, height: 900 });
await pg.screenshot({ path: `${D}/anteprima-modelli.jpg`, type: 'jpeg', quality: 88, fullPage: true });
await b.close();
console.log('ok');
