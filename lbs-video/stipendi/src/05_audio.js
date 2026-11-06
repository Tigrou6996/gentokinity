
// =========================================================================================
// AUDIO: voice + 120 BPM bed in A minor (Am–F–C–G): four-on-the-floor kick, claps, 16th hats, pumping sub bass,
// pluck arpeggio and pad; risers + impacts on every chapter; a darker drumless stretch in the rent section.
// Sound effects follow the animations automatically (every whip / pop / counter registers its own cue).
// Music and effects are synthesised in short windows (separate OfflineAudioContexts) and stitched into two stems:
// a single 5-minute graph with thousands of scheduled nodes is far too slow to render.
const VO_URL = 'data:audio/mpeg;base64,{{VO}}';
const CUES = { whip: [], pop: [], roll: [] }; let REC = false;
{ const w0 = whip, p0 = pop, r0 = roll;
  whip = function (el, t, t0, o) { if (REC) CUES.whip.push(t0); return w0(el, t, t0, o); };
  pop = function (el, t, t0, o) { if (REC) CUES.pop.push(t0); return p0(el, t, t0, o); };
  roll = function (el, n, t, t0, o = {}) { if (REC) CUES.roll.push([t0, o.d || .9]); return r0(el, n, t, t0, o); }; }
const dedupe = (a, gap) => { a = [...a].sort((x, y) => x - y); const o = []; for (const x of a) if (!o.length || x - o[o.length - 1] > gap) o.push(x); return o; };

// ---- synth helpers: they schedule into the current window only (CUR) ----
let CUR = null, NB = null;
const live = (t, dest) => CUR && dest === CUR.pass && t >= CUR.w0 && t < CUR.w1;
const at = t => t - CUR.w0;
function noise(t, dur, { type = 'highpass', f = 1000, q = .7, g = .2, dest = 'sfx', f2, a = .002, pan = 0 } = {}) {
  if (!live(t, dest)) return; const c = CUR.c, T = at(t);
  const s = c.createBufferSource(); s.buffer = NB; s.loop = true;
  const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, T); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, T + dur);
  const e = c.createGain(); e.gain.setValueAtTime(0, T); e.gain.linearRampToValueAtTime(g, T + a); e.gain.exponentialRampToValueAtTime(.0005, T + dur);
  const p = c.createStereoPanner(); p.pan.value = pan; s.connect(fl); fl.connect(e); e.connect(p); p.connect(c.destination); s.start(T, (t * 7.3) % 1.5); s.stop(T + dur + .05);
}
function tone(t, f, dur, { type = 'sine', g = .1, a = .005, dest = 'sfx', f2, lp, pan = 0, det = 0 } = {}) {
  if (!live(t, dest)) return; const c = CUR.c, T = at(t);
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, T); o.detune.value = det; if (f2) o.frequency.exponentialRampToValueAtTime(f2, T + dur * .8);
  const e = c.createGain(); e.gain.setValueAtTime(0, T); e.gain.linearRampToValueAtTime(g, T + a); e.gain.exponentialRampToValueAtTime(.0005, T + dur);
  let n = o; if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); n = fl; }
  const p = c.createStereoPanner(); p.pan.value = pan; n.connect(e); e.connect(p); p.connect(c.destination); o.start(T); o.stop(T + dur + .05);
}
function pluck(t, mm, g, pan = 0, bright = 1) {
  if (!live(t, 'music')) return; const c = CUR.c, T = at(t);
  const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 4; fl.frequency.setValueAtTime(700 + 2800 * bright, T); fl.frequency.exponentialRampToValueAtTime(340, T + .2);
  const e = c.createGain(); e.gain.setValueAtTime(0, T); e.gain.linearRampToValueAtTime(g, T + .004); e.gain.exponentialRampToValueAtTime(.0005, T + .3);
  const p = c.createStereoPanner(); p.pan.value = pan; fl.connect(e); e.connect(p); p.connect(c.destination);
  for (const dt of [-8, 8]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(mm); o.detune.value = dt; o.connect(fl); o.start(T); o.stop(T + .35); }
}
function pad(t, notes, dur, g, lpf = 1400) {
  if (!live(t, 'music')) return; const c = CUR.c, T = at(t);
  const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lpf; fl.Q.value = .3;
  const e = c.createGain(); e.gain.setValueAtTime(0, T); e.gain.linearRampToValueAtTime(g, T + .4); e.gain.setValueAtTime(g, T + dur - .3); e.gain.linearRampToValueAtTime(0, T + dur); fl.connect(e); e.connect(c.destination);
  for (const mm of notes) for (const dt of [-7, 7]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(mm); o.detune.value = dt; o.connect(fl); o.start(T); o.stop(T + dur + .05); }
}
function kick(t, g = .32) {
  if (!live(t, 'music')) return; const c = CUR.c, T = at(t);
  const o = c.createOscillator(), e = c.createGain(); o.frequency.setValueAtTime(140, T); o.frequency.exponentialRampToValueAtTime(45, T + .11); e.gain.setValueAtTime(g, T); e.gain.exponentialRampToValueAtTime(.001, T + .3); o.connect(e); e.connect(c.destination); o.start(T); o.stop(T + .32);
}
function bass(t, f, dur, g, lpf) {
  if (!live(t, 'music')) return; const c = CUR.c, T = at(t);
  const o = c.createOscillator(), o2 = c.createOscillator(), e = c.createGain(), fl = c.createBiquadFilter(); o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f;
  fl.type = 'lowpass'; fl.frequency.value = lpf; e.gain.setValueAtTime(0, T); e.gain.linearRampToValueAtTime(g, T + .06); e.gain.exponentialRampToValueAtTime(.001, T + dur);
  o.connect(fl); o2.connect(fl); fl.connect(e); e.connect(c.destination); o.start(T); o2.start(T); o.stop(T + dur + .02); o2.stop(T + dur + .02);
}
const chime = (t, mm, g = .06) => { tone(t, mtof(mm), 1.3, { g }); tone(t, mtof(mm) * 2.76, .4, { g: g * .25 }); };

// every musical / sound-effect event of the film (each helper keeps only what falls in the current window)
function score() {
  const PROG = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]], ROOT = [33, 29, 36, 31];
  const LEAD = [[76, 0], [74, .5], [72, 1], [74, 1.5], [76, 2.5], [79, 3], [76, 3.5]];
  const moody = t => t > S0(246.5) && t < S0(262.2), intro = t => t < S0(12.6) - .05;
  const nBars = Math.ceil(DUR / BAR);
  for (let n = 0; n < nBars; n++) {
    const t = n * BAR, ci = n % 4, ch = PROG[ci];
    if (t > DUR - 1.2) break;
    if (t + BAR < CUR.w0 - 4 || t > CUR.w1) continue;
    const md = moody(t + .01), it = intro(t + .01), endZone = t > DUR - 4;
    const lpf = it ? 500 + 2500 * clamp(t / (S0(12.6) - 1)) : md ? 650 : 1600;
    pad(t, [ch[0] - 12, ...ch], BAR + .15, md ? .03 : .022, lpf);
    const arp = [ch[0] + 12, ch[2], ch[1] + 12, ch[0] + 12, ch[2] + 12, ch[1] + 12, ch[2], ch[1] + 12];
    for (let k = 0; k < 16; k++) { if (md && k % 2) continue; if (endZone && k % 4) continue; pluck(t + k * BEAT / 4, arp[k % 8], md ? .02 : .024, k % 2 ? .35 : -.35, it ? .1 + .6 * clamp(t / S0(12.6)) : md ? .05 : .55 + .25 * (k % 2)); }
    if (!it || t > S0(12.6) - 2 * BAR) for (let e = 0; e < 8; e++) bass(t + e * BEAT / 2, mtof(ROOT[ci] + (e === 7 ? 12 : 0)), BEAT / 2 - .02, e % 2 ? .16 : .06, md ? 260 : 420);
    if (DRUMS(t + .01) && !endZone) for (let b = 0; b < 4; b++) {
      const tb = t + b * BEAT; kick(tb);
      if (b % 2) { for (const d of [0, .012, .026]) noise(tb + d, .14, { type: 'bandpass', f: 1400, q: .9, g: .09, dest: 'music' }); noise(tb, .2, { type: 'highpass', f: 5000, g: .03, dest: 'music' }); }
      for (let s = 0; s < 4; s++) noise(tb + s * BEAT / 4, s === 2 ? .12 : .03, { f: s === 2 ? 7000 : 9500, g: s === 2 ? .04 : .016, dest: 'music', pan: s % 2 ? .3 : -.3 });
    }
    if ((t >= S0(279.3) && !endZone) || (t >= S0(12.6) && t < S0(15.3))) LEAD.forEach(([mm, b]) => tone(t + b * BEAT, mtof(mm), .35, { type: 'square', g: .018, dest: 'music', lp: 2600, pan: .15 }));
  }
  [33, 45, 57, 60, 64, 69].forEach((mm, j) => tone(DUR - 3.4 + j * .05, mtof(mm), 3.2, { type: 'triangle', g: .05, dest: 'music', lp: 2400 }));

  // ---- sound effects ----
  const whoosh = (t, g = .1, pan = 0) => noise(t - .18, .45, { type: 'bandpass', f: 500, f2: 4200, q: 1.1, g, a: .16, pan });
  const popS = (t, i = 0) => { tone(t, 380 + (i % 6) * 55, .09, { f2: 760 + (i % 6) * 70, g: .085 }); noise(t, .025, { type: 'bandpass', f: 3200, q: 2, g: .04 }); };
  const ding = (t, i = 0) => { tone(t, mtof(88 + [0, 3, 7][i % 3]), .25, { g: .06 }); tone(t + .05, mtof(95 + [0, 3, 7][i % 3]), .3, { g: .035 }); };
  const tick = (t, i) => tone(t, 1400 + i * 60, .025, { g: .03 });
  const stamp = t => { tone(t, 150, .3, { f2: 55, g: .4 }); noise(t, .12, { type: 'lowpass', f: 2200, g: .2 }); };
  const cash = t => { noise(t, .06, { type: 'bandpass', f: 2500, q: 3, g: .12 }); [0, .07].forEach(d => { tone(t + .1 + d, 2093, .5, { g: .05 }); tone(t + .1 + d, 2637, .4, { g: .035 }); }); noise(t + .1, .35, { type: 'highpass', f: 6000, g: .04 }); };
  const womp = (t, d = .6) => tone(t, 220, d, { type: 'sawtooth', f2: 90, g: .05, lp: 900 });
  const thud = t => { tone(t, 90, .3, { f2: 40, g: .3 }); noise(t, .08, { type: 'lowpass', f: 900, g: .14 }); };
  const scribble = (t, d) => { for (let i = 0; i < d / .09; i++) noise(t + i * .09, .07, { type: 'bandpass', f: 2600 + (i % 3) * 600, q: 2, g: .03 }); };
  const shimmer = (t, d) => { for (let i = 0; i < 10; i++) tone(t + i * d / 10, mtof(96 + [0, 3, 7, 10, 12][i % 5]), .5, { g: .015, pan: (i % 3 - 1) * .4 }); };
  CHAP.forEach(([c]) => { const t = S(c); noise(t - 1.0, 1.05, { type: 'bandpass', f: 300, f2: 6000, q: 1.2, g: .22, a: .95 }); for (let i = 0; i < 8; i++) noise(t - 1 + i * BEAT / 4, .05, { type: 'bandpass', f: 1500, q: 1, g: .02 + i * .008 }); tone(t, 70, .9, { f2: 32, g: .4 }); noise(t, .5, { type: 'highpass', f: 3000, g: .08 }); [69, 72, 76, 81].forEach((mm, j) => chime(t + .2 + j * BEAT / 4, mm, .05)); });
  SC.forEach((s, i) => { if (i && !s.ch && !SC[i - 1].ch) whoosh(s.A + .12, .09, i % 2 ? .3 : -.3); });
  dedupe(CUES.whip, .2).forEach((t, i) => whoosh(t + .1, .075, (i % 3 - 1) * .4));
  dedupe(CUES.pop, .12).forEach((t, i) => popS(t, i));
  CUES.roll.forEach(([t0, d], j) => { const n = Math.round(d / .07); for (let k = 0; k < n; k++) tick(t0 + k * .07, k); ding(t0 + d, j); });
  stamp(S(94.24)); cash(S(32.0) + 1.0); cash(S(55.54) + 1.0); cash(S(131.24) + .9);
  for (let i = 0; i < 6; i++) { const t0 = S(81.66) + i * GRID / 2 + .28; tone(t0, 2400 + i * 130, .18, { g: .04 }); tone(t0, 3600 + i * 90, .1, { g: .02 }); }
  stamp(S(82.56)); womp(S(55.54) + .1, .5); thud(S(193.32) + .32); stamp(S(199.96));
  shimmer(S(151.0), 2.2); scribble(S(228.2), 1.6); scribble(S(272.0), 1.0);
  womp(S(259.18), .7); womp(S(260.88), .6); [72, 76, 79, 84].forEach((mm, j) => chime(S(263.62) + j * BEAT / 4, mm, .06));
  [69, 72, 76, 81, 84].forEach((mm, j) => chime(S(289.5) + j * .08, mm, .05));
}

window.buildAudio = async function (ctx) {
  if (!CUES.done) { REC = true; SC.forEach(s => { try { U[s.id](s.A + .01); } catch (e) { } }); REC = false; CUES.done = 1; seekImpl(0); }
  const sr = ctx.sampleRate, LEN = Math.ceil(DUR * sr);
  NB = new AudioBuffer({ numberOfChannels: 1, length: sr * 2, sampleRate: sr }); { const d = NB.getChannelData(0), r = rng(1234); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
  // render the two stems window by window
  const STEM = {}, WIN = 12, TAIL = 3.6;
  for (const pass of ['music', 'sfx']) {
    const st = new AudioBuffer({ numberOfChannels: 2, length: LEN, sampleRate: sr }), L = st.getChannelData(0), R = st.getChannelData(1);
    for (let w0 = 0; w0 < DUR; w0 += WIN) {
      const c = new OfflineAudioContext(2, Math.ceil((WIN + TAIL) * sr), sr);
      CUR = { c, w0, w1: w0 + WIN, pass }; score(); CUR = null;
      const b = await c.startRendering(), bl = b.getChannelData(0), br = b.getChannelData(1), o = Math.round(w0 * sr);
      for (let i = 0; i < bl.length && o + i < LEN; i++) { L[o + i] += bl[i]; R[o + i] += br[i]; }
    }
    STEM[pass] = st;
  }
  // final mix
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .1;
  const out = ctx.createGain(); out.gain.value = .6; lim.connect(out); out.connect(ctx.destination);
  const master = ctx.createGain(); master.gain.value = .7; master.connect(lim);
  const ir = ctx.createBuffer(2, Math.floor(sr * 2.2), sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c), r = rng(5 + c); for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
  const verb = ctx.createConvolver(); verb.buffer = ir; const vr = ctx.createGain(); vr.gain.value = .33; verb.connect(vr); vr.connect(master);
  const music = ctx.createGain(); music.connect(master); const ms = ctx.createGain(); ms.gain.value = .22; music.connect(ms); ms.connect(verb);
  const sfx = ctx.createGain(); sfx.gain.value = .5; sfx.connect(master); const ss = ctx.createGain(); ss.gain.value = .2; sfx.connect(ss); ss.connect(verb);
  const lo = .28, hi = .6; music.gain.setValueAtTime(.6, 0);
  for (const [a, b] of SPEECH) { music.gain.setTargetAtTime(lo, voT(a) - .3, .1); music.gain.setTargetAtTime(BRK.some(k => Math.abs(k.c - b) < .9) ? .92 : hi, voT(b) + .1, .25); }
  music.gain.setTargetAtTime(.75, voT(289.9), .3); music.gain.setTargetAtTime(0, DUR - 1.2, .3);
  for (const [pass, g] of [['music', music], ['sfx', sfx]]) { const s = ctx.createBufferSource(); s.buffer = STEM[pass]; s.connect(g); s.start(0); }
  try {
    const vb = await ctx.decodeAudioData(await (await fetch(VO_URL)).arrayBuffer());
    const vg = ctx.createGain(); vg.gain.value = 1.05; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70; hp.connect(vg); vg.connect(master);
    const cuts = [0, ...BRK.map(b => b.c), vb.duration];
    for (let i = 0; i + 1 < cuts.length; i++) { const src = ctx.createBufferSource(); src.buffer = vb; src.connect(hp); src.start(voT(cuts[i]), cuts[i], cuts[i + 1] - cuts[i]); }
  } catch (e) { console.warn('voice not decoded', e); }
};
