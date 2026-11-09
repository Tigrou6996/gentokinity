
// ---------- more icons ----------
Object.assign(IC, {
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v2.5M12 20v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M1.5 12H4M20 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5M3.2 10.6l3.4-.9-.9-3.4M20.8 13.4l-3.4.9.9 3.4M5.7 17.7l.9-3.4-3.4-.9M18.3 6.3l-.9 3.4 3.4.9"/>',
  wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><path d="M16 14h.01"/>',
  pkg: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  thermo: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
  boot: '<path d="M7 3h6v8l6 3a2 2 0 0 1 1 1.7V19H4V3z"/><path d="M4 16h16"/>',
  vest: '<path d="M8 3l4 4 4-4 4 3v15H4V6z"/><path d="M12 7v14M4 13h16"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  coins: '<ellipse cx="9" cy="6" rx="6" ry="3"/><path d="M3 6v4c0 1.66 2.69 3 6 3s6-1.34 6-3V6"/><path d="M3 10v4c0 1.66 2.69 3 6 3 .7 0 1.37-.06 2-.17"/><ellipse cx="16" cy="15" rx="5" ry="2.5"/><path d="M11 15v3.5c0 1.38 2.24 2.5 5 2.5s5-1.12 5-2.5V15"/>',
  idcard: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h5M14 14h4"/>',
  pen: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  hourglass: '<path d="M6 2h12M6 22h12M7 2c0 5 10 5 10 10S7 17 7 22M17 2c0 5-10 5-10 10s10 5 10 10"/>',
  trend: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  scale: '<path d="M12 3v18M5 21h14M3 7h18"/><path d="M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  dolly: '<path d="M4 3h3l3 13h9"/><circle cx="11" cy="19.5" r="2"/><rect x="11" y="6" width="8" height="7" rx="1"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
});

// ---------- time: voice τ -> video t, with a pause on every chapter card ----------
const BRK = [[12.6, 1.6], [34.65, 1.6], [58.25, 1.6], [101.95, 1.6], [165.5, 1.6], [217.1, 1.6], [242.5, 1.6], [273.45, 1.0]].map(([c, h]) => ({ c, h }));
const m = tau => tau + BRK.reduce((a, b) => a + (b.c < tau ? b.h : 0), 0);
const S0 = tau => O + m(tau);                                           // exact
const BPM = 120, BEAT = 60 / BPM, BAR = 4 * BEAT, GRID = BEAT / 2;
const S = tau => Math.round(S0(tau) / GRID) * GRID;                     // snapped to the eighth-note grid → animations hit on the beat
const voT = tau => O + tau + BRK.reduce((a, b) => a + (b.c <= tau ? b.h : 0), 0);
const TAU_END = 293.2, DUR = O + m(TAU_END) + .01;
window.VIDEO = { w: W, h: H, duration: DUR };
const SPEECH = [[0, 6.22], [6.9, 12.42], [12.76, 14.82], [15.4, 21.56], [22.06, 34.6], [34.74, 44.94], [45.3, 58.14], [58.36, 60.36], [60.78, 77.22], [77.22, 101.78],
  [102.14, 133.02], [133.02, 144.4], [144.96, 165.42], [165.64, 189.72], [190.2, 216.66], [217.26, 241.6], [242.94, 261.66], [262.28, 273.4], [273.54, 278.72], [279.38, 289.82]];
const CHAP = [[12.6, 'Il salario minimo', 'scale', 'Uguale per tutti'], [34.65, 'Lordo e netto', 'percent', 'Cosa ti arriva davvero'], [58.25, 'Ristorazione', 'hat', 'Primo settore'],
  [101.95, 'Edilizia', 'helmet', 'Secondo settore'], [165.5, 'Logistica', 'truck', 'Terzo settore'], [217.1, 'Regole per tutti', 'shield', 'In tutti e tre i settori'], [242.5, "L'affitto", 'home', 'La spesa più grande']];
const TABS = ['Minimo', 'Netto', 'Ristorazione', 'Edilizia', 'Logistica', 'Regole', 'Affitto'];
const HUD_ON = 12.6, HUD_OFF = 273.45;

// beat pulse: 1 on every kick, decays fast (drives background, glow and accents)
const DRUMS = t => t > S0(12.6) - .05 && !(t > S0(246.5) && t < S0(262.2)) && t < DUR - 3;
const pulse = (t, k = 9) => DRUMS(t) ? Math.exp(-((t % BEAT + BEAT) % BEAT) * k) : 0;
const barPulse = t => DRUMS(t) ? Math.exp(-((t % BAR + BAR) % BAR) * 5) : 0;

// ---------- numbers ----------
const fmt = (n, dec = 0) => { const s = Math.abs(n).toFixed(dec), [i, d] = s.split('.'); return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : ''); };
// rolling counter: counts from `from` to `n` with an ease-out; a little vertical blur while it spins
function roll(el, n, t, t0, { d = .9, dec = 0, pre = '', suf = '', from = 0 } = {}) {
  const k = eOut(seg(t, t0, t0 + d)), v = lerp(from, n, k);
  el.innerHTML = pre + fmt(dec ? v : Math.round(v), dec) + suf;
  const sp = k > 0 && k < 1 ? (1 - k) * 3 : 0; el.style.filter = sp > .2 ? `blur(${(sp * .4).toFixed(2)}px)` : 'none';
}

// ---------- directional (motion) blur via per-element SVG filters ----------
const SVGNS = 'http://www.w3.org/2000/svg';
const DEFS = (() => { const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('width', 0); s.setAttribute('height', 0); s.style.position = 'absolute'; const d = document.createElementNS(SVGNS, 'defs'); s.appendChild(d); document.body.appendChild(s); return d; })();
const FB = {};
function dblur(el, bx, by = 0) {
  bx = Math.min(60, Math.abs(bx)); by = Math.min(60, Math.abs(by));
  if (bx < .4 && by < .4) { el.style.filter = 'none'; return; }
  const id = 'mb_' + (el.id || (el.id = 'e' + Math.random().toString(36).slice(2)));
  if (!FB[id]) { const f = document.createElementNS(SVGNS, 'filter'); f.id = id; f.setAttribute('x', '-30%'); f.setAttribute('y', '-30%'); f.setAttribute('width', '160%'); f.setAttribute('height', '160%'); f.setAttribute('color-interpolation-filters', 'sRGB'); const g = document.createElementNS(SVGNS, 'feGaussianBlur'); f.appendChild(g); DEFS.appendChild(f); FB[id] = g; }
  FB[id].setAttribute('stdDeviation', `${bx.toFixed(2)} ${by.toFixed(2)}`);
  el.style.filter = `url(#${id})`;
}
// fast slide with real directional blur proportional to speed
function whip(el, t, t0, { dx = 520, dy = 0, d = .55, c = false, s0 = 1 } = {}) {
  const f = x => expo(seg(x, t0, t0 + d)), k = f(t), v = (f(t + 1 / 120) - k) * 120;
  const x = (1 - k) * dx, y = (1 - k) * dy;
  tf(el, { x, y, s: lerp(s0, 1, k), o: clamp((t - t0) / .12), c });
  dblur(el, v * dx / 60 * .45, v * dy / 60 * .45);
  return k;
}
// a spring "pop" that also lands on a slight beat bump afterwards
const popB = (el, t, t0, o = {}) => { const k = pop(el, t, t0, o); if (k > .98) { const p = pulse(t, 12) * .025; el.style.transform += ` scale(${(1 + p).toFixed(4)})`; } return k; };

// ---------- Germany map (simplified outline, lon/lat) ----------
const DE_PTS = [[8.6, 53.9], [8.6, 54.9], [9.4, 54.83], [9.9, 54.8], [10.9, 54.4], [11.0, 54.0], [11.6, 54.15], [12.1, 54.2], [13.0, 54.45], [13.4, 54.6], [13.75, 54.15], [14.2, 53.9], [14.4, 53.3], [14.1, 52.8], [14.6, 52.5], [14.7, 52.0], [15.0, 51.2],
  [14.3, 50.9], [13.5, 50.6], [12.5, 50.3], [12.1, 50.3], [12.4, 49.8], [12.9, 49.3], [13.8, 48.8], [13.5, 48.6], [13.0, 48.3], [12.9, 47.7], [13.0, 47.5], [12.2, 47.7], [11.2, 47.4], [10.5, 47.5], [10.0, 47.6], [9.6, 47.55], [8.6, 47.7], [7.6, 47.6],
  [7.6, 48.1], [8.2, 48.97], [7.5, 49.1], [6.4, 49.5], [6.1, 50.1], [6.4, 50.3], [6.0, 50.7], [6.2, 51.2], [5.9, 51.8], [6.7, 51.9], [7.0, 52.2], [7.0, 52.6], [7.2, 53.3], [8.0, 53.6]];
const INNER = [[10.9, 54.1], [10.6, 53.4], [10.9, 52.6], [10.5, 52.0], [10.0, 51.5], [10.2, 50.8], [10.6, 50.3], [11.5, 50.4], [12.1, 50.3]];
const CITY = { Amburgo: [10.0, 53.55], Berlino: [13.4, 52.52], Monaco: [11.58, 48.14], 'Düsseldorf': [6.78, 51.23], Francoforte: [8.68, 50.11], Lipsia: [12.37, 51.34], Stoccarda: [9.18, 48.78], Hannover: [9.73, 52.37] };
const proj = (s = 64) => ([lo, la]) => [(lo - 5.85) * .63 * s, (55.05 - la) * s];
const pts = (P, s) => P.map(proj(s)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
function MAP(id, s, { split = false, cities = [], fill = 'rgba(255,255,255,.1)' } = {}) {
  const w = 9.15 * .63 * s, h = 7.8 * s, p = proj(s);
  const west = [...INNER, [12.1, 50.0], [16, 50.0], [16, 45], [4, 45], [4, 56], [10.9, 56]], east = [...INNER, [12.1, 50.0], [16, 50.0], [16, 56], [10.9, 56]];
  return `<svg class="a" id="${id}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}">
    <defs><clipPath id="${id}_cw"><polygon points="${pts(west, s)}"/></clipPath><clipPath id="${id}_ce"><polygon points="${pts(east, s)}"/></clipPath></defs>
    <polygon id="${id}_f" points="${pts(DE_PTS, s)}" fill="${fill}"/>
    ${split ? `<g id="${id}_w" clip-path="url(#${id}_cw)"><polygon points="${pts(DE_PTS, s)}" fill="#dab6fc"/></g><g id="${id}_e" clip-path="url(#${id}_ce)"><polygon points="${pts(DE_PTS, s)}" fill="#ffc542"/></g>
    <polyline id="${id}_in" points="${pts(INNER, s)}" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="3 10" stroke-linecap="round"/>` : ''}
    <polygon id="${id}_o" points="${pts(DE_PTS, s)}" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round" pathLength="100"/>
    ${cities.map(n => { const [x, y] = p(CITY[n]); return `<g id="${id}_${n.replace(/\W/g, '')}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><circle r="26" fill="#dab6fc" opacity=".35" class="ring"/><circle r="10" fill="#fff" stroke="#30103d" stroke-width="3"/></g>`; }).join('')}
  </svg>`;
}
const cityXY = (n, s) => proj(s)(CITY[n]);

// ---------- small building blocks ----------
const NUMC = (i, bg = '#5e2d61', col = '#fff', sz = 54) => `<span style="display:flex;flex:none;width:${sz}px;height:${sz}px;border-radius:50%;background:${bg};color:${col};align-items:center;justify-content:center;font:800 ${sz * .5}px PJS">${i}</span>`;
const IB = (ic, sz = 96, bg = '#5e2d61', col = '#fff', sw = 2.2) => CIRC('', 0, 0, sz, icon(ic, sz * .48, col, sw), bg, 'position:relative;transform:none;flex:none');
const TITLE = (id, txt, y = 170, size = 72, x = 960) => `<div class="a ctr h1" id="${id}" style="left:${x}px;top:${y}px;font-size:${size}px">${MW(txt)}</div>`;
const KICK = (id, txt, y = 108) => `<div class="a ctr lbl li" id="${id}" style="left:960px;top:${y}px;font-size:24px">${txt}</div>`;
