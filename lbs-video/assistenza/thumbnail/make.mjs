// make.mjs: inline fonts/logo into thumb.src.html and screenshot it as the YouTube thumbnail (1280x720)
//   node thumbnail/make.mjs   (run from lbs-video/assistenza)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const b64 = p => readFileSync(path.join('assets', p)).toString('base64');
let s = readFileSync('thumbnail/thumb.src.html', 'utf8');
for (const [k, p] of [['PJS', 'pjs.woff2'], ['INTER', 'inter.woff2'], ['LOGO', 'logo.png']]) s = s.replaceAll(`{{${k}}}`, b64(p));
writeFileSync('thumbnail/thumb.html', s);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await pg.goto('file://' + path.resolve('thumbnail/thumb.html'));
await pg.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
await pg.locator('#t').screenshot({ path: 'thumbnail/LBS-assistenza-miniatura.png' });
await pg.locator('#t').screenshot({ path: 'thumbnail/LBS-assistenza-miniatura.jpg', type: 'jpeg', quality: 92 });
await b.close();
console.log('ok');
