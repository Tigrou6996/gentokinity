// svg-F.mjs: converte il modello F (etichetta) in SVG a livelli e in PDF (per Canva: testi modificabili)
//   node annunci/svg-F.mjs   (dalla cartella lbs-video, dopo node annunci/make2.mjs)
// Uscita: annunci/canva/annuncio-F.svg, annuncio-F.pdf, sfondo-F.png, corriere-adesivo-F.png, anteprima-svg-F.png
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const D = 'annunci', OUT = path.join(D, 'canva');
mkdirSync(OUT, { recursive: true });
const b64 = p => readFileSync(p).toString('base64');
const FONTS = [['Plus Jakarta Sans', 700, 'PlusJakartaSans-700'], ['Plus Jakarta Sans', 800, 'PlusJakartaSans-800'], ['Inter', 600, 'Inter-600'], ['Inter', 700, 'Inter-700'], ['Inter', 800, 'Inter-800']];
const fontCss = FONTS.map(([f, w, file]) => `@font-face{font-family:'${f}';font-weight:${w};src:url(data:font/ttf;base64,${b64(`${D}/assets/font/${file}.ttf`)})}`).join('');

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
await pg.goto('file://' + path.resolve(D, 'annunci2.html'));
await pg.evaluate(async () => { await window.FIT; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
await pg.evaluate(() => { for (const id of ['D', 'E']) document.getElementById(id).remove(); });
const F = pg.locator('#F');

// 1) sfondo (gradiente + furgoncini) come immagine unica
await pg.evaluate(() => { for (const c of document.querySelectorAll('#F > *')) if (!c.classList.contains('pat')) c.style.visibility = 'hidden'; });
await F.screenshot({ path: `${OUT}/sfondo-F.png` });
// 2) corriere con bordo bianco "adesivo" e ombra, sfondo trasparente
await pg.evaluate(() => {
  for (const c of document.querySelectorAll('#F > *')) c.style.visibility = c.classList.contains('person') ? 'visible' : 'hidden';
  document.getElementById('F').style.background = 'transparent'; document.body.style.background = 'transparent';
});
const fb = await F.boundingBox();
const pb = await pg.locator('#F .person').boundingBox();
const pad = 60, clip = { x: Math.max(fb.x, pb.x - pad), y: Math.max(fb.y, pb.y - pad) };
clip.width = Math.min(fb.x + fb.width, pb.x + pb.width + pad) - clip.x;
clip.height = Math.min(fb.y + fb.height, pb.y + pb.height + pad) - clip.y;
await pg.screenshot({ path: `${OUT}/corriere-adesivo-F.png`, clip, omitBackground: true });
await pg.evaluate(() => { for (const c of document.querySelectorAll('#F > *')) c.style.visibility = ''; document.getElementById('F').style.background = ''; document.body.style.background = ''; });

// 3) misure di testi e forme (senza rotazioni, che rimettiamo come gruppi SVG)
const data = await pg.evaluate(() => {
  const F = document.getElementById('F'), O = F.getBoundingClientRect();
  const rot = {};
  for (const sel of ['.label', '.stamp', '.tape']) {
    const el = F.querySelector(sel), m = new DOMMatrix(getComputedStyle(el).transform);
    rot[sel] = Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI * 100) / 100;
    el.style.transform = 'none';
  }
  const R = el => { const r = el.getBoundingClientRect(); return { x: r.left - O.left, y: r.top - O.top, w: r.width, h: r.height }; };
  const center = sel => { const r = R(F.querySelector(sel)); return [r.x + r.w / 2, r.y + r.h / 2]; };
  const groupOf = el => el.closest('.label') ? 'label' : el.closest('.stamp') ? 'stamp' : el.closest('.foot') ? 'foot' : null;
  const texts = [];
  const walker = document.createTreeWalker(F, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const el = n.parentElement, cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    // il testo va in uno span (nei contenitori flex un testo libero è un elemento a sé): il segnaposto dentro lo span dà la linea di base
    const sp = document.createElement('span'); n.parentNode.insertBefore(sp, n); sp.appendChild(n);
    const mk = document.createElement('span'); mk.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    sp.insertBefore(mk, n);
    const base = mk.getBoundingClientRect().bottom - O.top; mk.remove();
    const rg = document.createRange(); rg.selectNodeContents(n); const rr = rg.getBoundingClientRect();
    let t = n.textContent.replace(/\s+/g, ' ').trim();
    if (cs.textTransform === 'uppercase') t = t.toUpperCase();
    // la prima riga parte dopo l'eventuale spazio iniziale: usiamo il primo rettangolo
    const first = rg.getClientRects()[0];
    texts.push({ t, x: (first ? first.left : rr.left) - O.left, y: base, fam: /PJS/.test(cs.fontFamily) ? 'Plus Jakarta Sans' : 'Inter', w: +cs.fontWeight, fs: parseFloat(cs.fontSize), ls: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing), color: cs.color, g: groupOf(el) });
  }
  const svgs = [...F.querySelectorAll('svg')].map(s => ({ ...R(s), vb: s.getAttribute('viewBox'), ww: +s.getAttribute('width'), inner: s.innerHTML, fill: s.getAttribute('fill'), stroke: s.getAttribute('stroke'), sw: s.getAttribute('stroke-width'), slj: s.getAttribute('stroke-linejoin'), g: groupOf(s) }));
  const rows = [...F.querySelectorAll('.label .r')].map(R);
  return { rot, c: { label: center('.label'), stamp: center('.stamp'), tape: center('.tape') }, texts, svgs, rows,
    logo: R(F.querySelector('.logo')), label: R(F.querySelector('.label')), hd: R(F.querySelector('.label .hd')), tape: R(F.querySelector('.tape')), stamp: R(F.querySelector('.stamp')), foot: R(F.querySelector('.foot')) };
});

// 4) costruzione SVG
const r2 = v => Math.round(v * 100) / 100;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const txt = (g, id) => data.texts.filter(t => t.g === g).map((t, i) => `<text id="${id}-testo-${i + 1}" x="${r2(t.x)}" y="${r2(t.y)}" font-family="${t.fam}" font-weight="${t.w}" font-size="${r2(t.fs)}"${t.ls ? ` letter-spacing="${r2(t.ls)}"` : ''} fill="${t.color}">${esc(t.t)}</text>`).join('\n    ');
const icons = g => data.svgs.filter(s => s.g === g).map(s => {
  const [, , vw] = (s.vb || `0 0 ${s.ww}`).split(' ').map(Number); const k = s.w / vw;
  const attrs = [s.fill && `fill="${s.fill}"`, s.stroke && `stroke="${s.stroke}"`, s.sw && `stroke-width="${s.sw}"`, s.slj && `stroke-linejoin="${s.slj}"`].filter(Boolean).join(' ');
  return `<g transform="translate(${r2(s.x)} ${r2(s.y)}) scale(${r2(k * 1000) / 1000})" ${attrs}>${s.inner}</g>`;
}).join('\n    ');
const rot = (sel, c) => `rotate(${data.rot[sel]} ${r2(c[0])} ${r2(c[1])})`;
const { label: L, hd: H, stamp: S, tape: T, foot: Ft, logo: Lg } = data;
const dashes = data.rows.map(r => `<line x1="${r2(r.x)}" y1="${r2(r.y + r.h - 1)}" x2="${r2(r.x + r.w)}" y2="${r2(r.y + r.h - 1)}" stroke="#cdbfd6" stroke-width="2" stroke-dasharray="6 4"/>`).join('\n    ');
const cut = { x: clip.x - fb.x, y: clip.y - fb.y, w: clip.width, h: clip.height };

const svg = (withFonts) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350">
  ${withFonts ? `<style>${fontCss}</style>` : ''}
  <defs>
    <filter id="ombra" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="30" stdDeviation="28" flood-color="#000" flood-opacity=".45"/></filter>
    <clipPath id="etichetta-forma"><rect x="${r2(L.x)}" y="${r2(L.y)}" width="${r2(L.w)}" height="${r2(L.h)}" rx="14"/></clipPath>
  </defs>
  <image id="sfondo" x="0" y="0" width="1080" height="1350" href="data:image/png;base64,${b64(`${OUT}/sfondo-F.png`)}"/>
  <g id="intestazione">
    <image id="logo" x="${r2(Lg.x)}" y="${r2(Lg.y)}" width="${r2(Lg.w)}" height="${r2(Lg.h)}" href="data:image/png;base64,${b64('banner/assets/logo.png')}"/>
    ${txt(null, 'titolo')}
  </g>
  <image id="corriere" x="${r2(cut.x)}" y="${r2(cut.y)}" width="${r2(cut.w)}" height="${r2(cut.h)}" href="data:image/png;base64,${b64(`${OUT}/corriere-adesivo-F.png`)}"/>
  <g id="etichetta" transform="${rot('.label', data.c.label)}">
    <rect x="${r2(L.x)}" y="${r2(L.y)}" width="${r2(L.w)}" height="${r2(L.h)}" rx="14" fill="#fffdf8" filter="url(#ombra)"/>
    <rect x="${r2(H.x)}" y="${r2(H.y)}" width="${r2(H.w)}" height="${r2(H.h)}" fill="#30103D" clip-path="url(#etichetta-forma)"/>
    ${dashes}
    ${icons('label')}
    ${txt('label', 'etichetta')}
  </g>
  <rect id="nastro" x="${r2(T.x)}" y="${r2(T.y)}" width="${r2(T.w)}" height="${r2(T.h)}" fill="#DAB6FC" fill-opacity=".75" transform="${rot('.tape', data.c.tape)}"/>
  <g id="timbro" transform="${rot('.stamp', data.c.stamp)}">
    <circle cx="${r2(S.x + S.w / 2)}" cy="${r2(S.y + S.h / 2)}" r="${r2(S.w / 2 - 2.5)}" fill="#30103D" fill-opacity=".85" stroke="#DAB6FC" stroke-width="5"/>
    ${txt('stamp', 'timbro')}
  </g>
  <g id="contatti">
    <rect x="${r2(Ft.x)}" y="${r2(Ft.y)}" width="${r2(Ft.w)}" height="${r2(Ft.h)}" fill="#ffffff"/>
    ${icons('foot')}
    ${txt('foot', 'contatti')}
  </g>
</svg>`;
writeFileSync(`${OUT}/annuncio-F.svg`, svg(false));

// 5) PDF per Canva (testi veri, font incorporati) + anteprima PNG dello SVG per controllo
await pg.setViewportSize({ width: 1080, height: 1350 });
await pg.setContent(`<html><head><style>${fontCss}@page{size:1080px 1350px;margin:0}html,body{margin:0}svg{display:block}</style></head><body>${svg(false)}</body></html>`);
await pg.evaluate(async () => { await document.fonts.ready; });
await pg.screenshot({ path: `${OUT}/anteprima-svg-F.png` });
await pg.pdf({ path: `${OUT}/annuncio-F.pdf`, width: '1080px', height: '1350px', printBackground: true, pageRanges: '1' });
await b.close();
console.log('ok', data.texts.length, 'testi,', data.svgs.length, 'icone');
