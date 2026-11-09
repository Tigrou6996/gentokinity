
// ---------- build DOM ----------
const scenes = $('scenes');
SC.forEach((s, i) => { const d = document.createElement('div'); d.className = 'layer'; d.id = 'L' + i; d.innerHTML = HTML[s.id]; scenes.appendChild(d); s.el = d; s.ch = s.id.startsWith('ch'); s.A = S(s.a) - (s.ch ? 0 : .05); s.B = S(s.b); });
SC[0].A = -1;
$('hud').innerHTML = `
  <div class="a" id="hd_l" style="left:56px;top:40px;display:flex;align-items:center;gap:16px"><img src="${LOGO}" style="width:58px;height:58px"><div><div class="lbl" style="font-size:19px;color:#fff">Quanto si guadagna in Germania</div><div style="font:600 18px INT;color:#dab6fc;margin-top:4px">Lordo, netto e leggi · dati 2026</div></div></div>
  <div class="a" id="hd_t" style="right:56px;top:46px;display:flex;gap:10px">${TABS.map((n, i) => `<div class="tab" id="tab${i}"><b>${i + 1}</b>${n}</div>`).join('')}</div>
  <div class="a" style="left:0;bottom:0;width:1920px;height:8px;background:rgba(255,255,255,.12)"><div id="hd_p" style="width:100%;height:8px;background:#dab6fc;transform-origin:0 50%"></div></div>`;

// ---------- background: drifting icon pattern that breathes on the beat ----------
const PAT = {
  truck: 'M2 6.5h11.5v9.5H2z M13.5 9.5h4.2l3.8 3.6v2.9h-8z M4 18.2a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0 M15.2 18.2a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0',
  pizza: 'M3.5 4.5Q12 1.5 20.5 4.5L12 21.5z M4.6 6.8Q12 4.2 19.4 6.8 M8.9 9.4a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0 M12.9 11.8a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0',
  helmet: 'M2 18h20 M4 18v-2a8 8 0 0 1 16 0v2 M10 8.5V5h4v3.5',
  euro: 'M18 6.5A7 7 0 1 0 18 17.5 M4 10h10 M4 14h10',
};
const TILE = (() => { const c = document.createElement('canvas'); c.width = 1040; c.height = 840; const x = c.getContext('2d'), r = rng(31), names = Object.keys(PAT);
  x.strokeStyle = '#fff'; x.lineWidth = 1.25; x.lineJoin = x.lineCap = 'round';
  for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) {
    const cx = k * 260 + (row % 2 ? 130 : 0) + 65, cy = row * 210 + 70, n = names[(row * 3 + k) % 4], rot = (r() - .5) * .45;
    for (const dx of [0, 1040]) { if (dx && cx > 130) continue; x.save(); x.translate(cx + dx, cy); x.rotate(rot); x.scale(2.9, 2.9); x.translate(-12, -12); x.stroke(new Path2D(PAT[n])); x.restore(); }
  } return c; })();
const bgc = $('bg').getContext('2d'), PW = bgc.createPattern(TILE, 'repeat');
{ const g = $('glow').getContext('2d'), gw = 2320, gh = 1380;
  const blob = (x, y, r, c) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, gw, gh); };
  blob(620, 420, 820, 'rgba(218,182,252,.16)'); blob(1800, 1050, 820, 'rgba(48,16,61,.55)'); blob(1700, 260, 560, 'rgba(218,182,252,.1)'); }
const GRAIN = []; { const r = rng(99); for (let k = 0; k < 4; k++) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), im = x.createImageData(256, 256); for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); GRAIN.push(`url(${c.toDataURL()})`); } }
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const TR = .42;
function vis(s, t) { if (t < s.A - .05 || t > s.B + TR) return 0; return seg(t, s.A, s.A + TR) * (1 - seg(t, s.B, s.B + TR)); }
function drawBg(t, V) {
  let sw = 0, rgb = [0, 0, 0], dark = 0;
  SC.forEach((s, i) => { const v = V[i]; if (!v) return; const c = hex(s.bg); sw += v; rgb = rgb.map((x, k) => x + c[k] * v); if (s.bg === D) dark += v; });
  if (sw < 1e-4) { rgb = hex(P); sw = 1; }
  rgb = rgb.map(x => Math.round(x / sw)); dark /= sw;
  bgc.fillStyle = `rgb(${rgb})`; bgc.fillRect(0, 0, W, H);
  const p = pulse(t, 8), bp = barPulse(t);
  const ox = -(t * 14) % 1040, oy = -(t * 8) % 840;
  bgc.save(); bgc.translate(W / 2, H / 2); bgc.scale(1 + p * .012, 1 + p * .012); bgc.translate(-W / 2, -H / 2);
  bgc.translate(ox, oy); bgc.globalAlpha = (.12 + p * .05) * (1 - .45 * dark); bgc.fillStyle = PW; bgc.fillRect(-ox - 40, -oy - 40, W + 80, H + 80); bgc.restore(); bgc.globalAlpha = 1;
  // a ring that expands from the centre on every bar downbeat
  if (bp > .01) { const ph = 1 - bp; bgc.strokeStyle = `rgba(218,182,252,${(.16 * bp).toFixed(3)})`; bgc.lineWidth = 3 + 10 * bp; bgc.beginPath(); bgc.arc(W / 2, H * .55, 160 + ph * 1100, 0, Math.PI * 2); bgc.stroke(); }
  const g = $('glow'); g.style.opacity = .85 + p * .15; g.style.transform = `translate(${Math.sin(t * .23) * 120}px,${Math.cos(t * .17) * 70}px) scale(${1 + p * .03})`;
}
// chapter wipes: three skewed bars sweep across as the chapter card arrives
const WIPES = CHAP.map(c => S(c[0]));
function wipes(t) {
  const bars = [$('wb0'), $('wb1'), $('wb2')], off = [-.07, 0, .06];
  let T = null; for (const w of WIPES) if (Math.abs(t - w) < .62) T = w;
  bars.forEach((b, i) => {
    if (T === null) { b.style.visibility = 'hidden'; return; }
    const f = x => ease(seg(x, T - .45 + off[i] * 2, T + .45 + off[i] * 2)), k = f(t), v = (f(t + 1 / 120) - k) * 120;
    b.style.visibility = k > 0 && k < 1 ? 'visible' : 'hidden';
    b.style.transform = `translate(${lerp(-4600, 2400, k)}px,0) skewX(-18deg)`;
    dblur(b, v * 7000 / 60 * .25);
  });
}
// whip-pan between scenes of the same chapter (with directional blur)
const WX = 460;
const lx = (s, t) => s.ch ? 0 : (1 - expo(seg(t, s.A, s.A + TR))) * WX - eIn(seg(t, s.B, s.B + TR)) * WX;
function seekImpl(t) {
  const V = SC.map(s => vis(s, t));
  drawBg(t, V);
  const bump = 1 + .006 * barPulse(t) + .003 * pulse(t, 10);
  SC.forEach((s, i) => {
    const v = V[i]; s.el.style.display = v > 0 ? 'block' : 'none'; if (!v) return;
    const kin = seg(t, s.A, s.A + TR), kout = seg(t, s.B, s.B + TR), life = seg(t, s.A, s.B + TR);
    s.el.style.opacity = s.ch ? (t < s.A + .02 ? 0 : 1 - kout) : Math.min(clamp(kin * 2.2), 1 - eIn(kout));
    const x = lx(s, t), vx = (lx(s, t + 1 / 120) - x) * 120;
    s.el.style.transform = `translateX(${x.toFixed(1)}px) scale(${((1 + .02 * life) * bump).toFixed(4)})`;
    dblur(s.el, s.ch ? (1 - eOut(kin)) * 0 : vx / 60 * .5);
    U[s.id](t);
  });
  wipes(t);
  // HUD
  const hudOn = seg(t, S(HUD_ON) + .6, S(HUD_ON) + 1.3) * (1 - seg(t, S(HUD_OFF), S(HUD_OFF) + .6));
  $('hud').style.opacity = hudOn; $('hud').style.transform = `translateY(${(1 - hudOn) * -20}px)`;
  const cur = CHAP.reduce((a, c, i) => t >= S(c[0]) ? i : a, -1);
  TABS.forEach((_, i) => { const el = $('tab' + i), on = i === cur, done = i < cur; el.style.background = on ? '#fff' : done ? 'rgba(218,182,252,.28)' : 'rgba(255,255,255,.1)'; el.style.color = on ? '#5e2d61' : '#fff'; el.firstElementChild.style.background = on ? '#5e2d61' : done ? '#2fbf6b' : 'rgba(255,255,255,.18)'; el.firstElementChild.innerHTML = done ? icon('check', 16, '#fff', 3.4) : String(i + 1); el.firstElementChild.style.color = '#fff'; const pk = on ? spring(t - S(CHAP[i][0]), 14, .55) : 1; el.style.transform = `scale(${on ? lerp(.85, 1, pk) * (1 + pulse(t, 12) * .04) : 1})`; });
  $('hd_p').style.transform = `scaleX(${clamp(t / DUR)})`;
  $('grain').style.backgroundImage = GRAIN[Math.floor(t * 24) % 4];
  $('fade').style.opacity = Math.max(1 - seg(t, 0, .35), seg(t, DUR - 1.0, DUR - .05));
}
