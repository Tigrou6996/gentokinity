// make.mjs: build the three Facebook cover proposals (1640x924) and a preview sheet with the desktop/mobile crops
//   node banner/make.mjs   (run from lbs-video)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const D = 'banner', b64 = p => readFileSync(path.join(D, 'assets', p)).toString('base64');
const flag = (c, w) => c === 'it'
  ? `<svg width="${w}" height="${w * 2 / 3}" viewBox="0 0 3 2"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/><rect width="3" height="2" fill="none" stroke="#0002" stroke-width=".06"/></svg>`
  : `<svg width="${w}" height="${w * 2 / 3}" viewBox="0 0 3 2"><rect width="3" height=".67" fill="#111"/><rect y=".67" width="3" height=".67" fill="#dd0000"/><rect y="1.33" width="3" height=".67" fill="#ffce00"/></svg>`;
const CK = '<span class="ck"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>';
const GLOBE = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#dab6fc" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
let s = readFileSync(path.join(D, 'banner.src.html'), 'utf8');
const rep = { PJS: b64('pjs.woff2'), INTER: b64('inter.woff2'), BC: b64('bc900i.woff2'), LOGO: b64('logo.png'), IT: flag('it', 40), DE: flag('de', 40), ITs: flag('it', 54), DEs: flag('de', 54), IT2: flag('it', 78), DE2: flag('de', 90), CK, GLOBE };
for (const [k, v] of Object.entries(rep)) s = s.replaceAll(`{{${k}}}`, v);
writeFileSync(path.join(D, 'banner.html'), s);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1640, height: 1000 }, deviceScaleFactor: 1 });
await pg.goto('file://' + path.resolve(D, 'banner.html'));
await pg.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
for (const v of ['A', 'B', 'C']) {
  await pg.locator('#' + v).screenshot({ path: `${D}/LBS-copertina-${v}.png` });
  await pg.locator('#' + v).screenshot({ path: `${D}/LBS-copertina-${v}.jpg`, type: 'jpeg', quality: 95 });
}
// preview: what desktop (centre band) and phone (whole image) show
const img = v => 'data:image/png;base64,' + readFileSync(`${D}/LBS-copertina-${v}.png`).toString('base64');
const card = (v, t) => `<div style="margin:0 0 34px"><div style="font:800 26px sans-serif;color:#fff;margin:0 0 12px">Proposta ${v} · ${t}</div>
  <div style="display:flex;gap:30px;align-items:flex-start">
  <div><div style="font:600 18px sans-serif;color:#aaa;margin-bottom:8px">Computer (si vede la fascia centrale)</div><div style="width:984px;height:374px;background:url(${img(v)}) 0 -90px/984px 554px;border-radius:10px"></div></div>
  <div><div style="font:600 18px sans-serif;color:#aaa;margin-bottom:8px">Telefono</div><div style="width:480px;height:270px;background:url(${img(v)}) 0 0/480px 270px;border-radius:10px"></div></div></div></div>`;
await pg.setContent(`<body style="margin:0;padding:40px;background:#1b1b1b;width:1574px">${card('A', 'informativa')}${card('B', 'emozionale')}${card('C', 'stile Nike')}</body>`);
await pg.setViewportSize({ width: 1574, height: 1500 });
await pg.screenshot({ path: `${D}/anteprima-copertine.png`, fullPage: true });
await b.close();
console.log('ok');
