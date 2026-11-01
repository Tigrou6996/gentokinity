
IC.pizza = '<path d="M3.5 4.5Q12 1.5 20.5 4.5L12 21.5z"/><path d="M4.6 6.8Q12 4.2 19.4 6.8"/><circle cx="10" cy="9.4" r="1.1"/><circle cx="14" cy="11.8" r="1.1"/><circle cx="11.4" cy="15.2" r="1"/>';
// ---------- scenes ----------
const P = '#5e2d61', D = '#30103d';
const HTML = {}, U = {};
const SC = [
  ['intro', 0, 6.8, P], ['ask', 6.8, 12.6, P], ['ch1', 12.6, 15.3, D], ['min', 15.3, 26.15, P], ['floor', 26.15, 34.65, P],
  ['ch2', 34.65, 35.9, D], ['gross', 35.9, 49.6, P], ['ex', 49.6, 58.25, P],
  ['ch3', 58.25, 60.7, D], ['rist', 60.7, 71.4, P], ['ctr', 71.4, 77.15, P], ['three', 77.15, 91.45, P], ['food', 91.45, 101.95, P],
  ['ch4', 101.95, 104.0, D], ['bau1', 104.0, 113.95, P], ['bau2', 113.95, 132.95, P], ['bau3', 132.95, 144.85, P], ['bau4', 144.85, 159.25, P], ['dpi', 159.25, 165.5, P],
  ['ch5', 165.5, 167.95, D], ['log1', 167.95, 178.6, P], ['log2', 178.6, 190.05, P], ['log3', 190.05, 197.7, P], ['log4', 197.7, 205.15, P], ['log5', 205.15, 217.1, P],
  ['ch6', 217.1, 220.3, D], ['reg1', 220.3, 226.9, P], ['reg2', 226.9, 242.5, P],
  ['ch7', 242.5, 246.45, D], ['rent1', 246.45, 255.55, D], ['rent2', 255.55, 267.1, D], ['rent3', 267.1, 273.45, P],
  ['disc', 273.45, 279.3, P], ['recap', 279.3, 286.65, P], ['outro', 286.65, TAU_END + 1, P],
].map(([id, a, b, bg]) => ({ id, a, b, bg }));

// intro ---------------------------------------------------------------------------------
const SECT3 = [['hat', 'Ristorazione', 3.06], ['helmet', 'Edilizia', 4.36], ['truck', 'Logistica', 5.5]];
HTML.intro = `
  <div class="a ctr" id="in_f" style="left:960px;top:190px">${FLAG('de', 130)}</div>
  <div class="a ctr h1" id="in_a" style="left:960px;top:360px;font-size:128px">${MW('Quanto si guadagna')}</div>
  <div class="a ctr h1" id="in_b" style="left:960px;top:500px;font-size:128px">${MW('davvero in')} <span class="mask"><span class="mi"><span class="hl" id="in_hl"><i></i><b style="color:#30103d">Germania?</b></span></span></span></div>
  ${SECT3.map(([ic, n], i) => `<div class="card" id="in_c${i}" style="left:${260 + i * 480}px;top:680px;width:440px;height:200px;display:flex;align-items:center;gap:22px;padding:0 30px">${IB(ic, 100)}<div style="font:800 38px PJS">${n}</div></div>`).join('')}`;
U.intro = t => {
  pop($('in_f'), t, S(1.62), { c: true, from: .2, r0: -25 });
  words($('in_a'), t, [S(0), S(.46), S(.68)]); words($('in_b'), t, [S(1.0), S(1.46), S(1.62)]); hl($('in_hl'), t, S(1.62) + .15);
  SECT3.forEach(([, , a], i) => whip($('in_c' + i), t, S(a), { dy: 260, dx: 0, d: .5 }));
};
// ask: what this video answers --------------------------------------------------------------
const ASK = [['euro', 'Lordo', 7.08], ['coins', 'Netto', 7.78], ['scale', 'La legge', 9.3], ['wallet', 'In tasca', 11.3]];
HTML.ask = `
  ${KICK('ak_k', 'In questo video', 230)}
  ${ASK.map(([ic, n], i) => `<div class="card" id="ak_${i}" style="left:${160 + i * 420}px;top:340px;width:340px;height:360px">
    <div class="a ctr" style="left:170px;top:140px">${IB(ic, 150, i === 3 ? '#2fbf6b' : '#5e2d61')}</div>
    <div class="a ctr" style="left:170px;top:285px;font:800 46px PJS">${n}</div></div>`).join('')}
  <svg class="a" style="left:0;top:0" width="1920" height="1080">${[0, 1, 2].map(i => `<path id="ak_ar${i}" d="M${510 + i * 420} 520 h60" stroke="#dab6fc" stroke-width="8" stroke-linecap="round" fill="none" pathLength="100"/>`).join('')}</svg>
  <div class="pill ctr" id="ak_p" style="left:1420px;top:790px;font-size:30px">${icon('cal', 28, '#5e2d61', 2.6)} a fine mese</div>`;
U.ask = t => {
  rise($('ak_k'), t, S(6.9), { c: true });
  ASK.forEach(([, , a], i) => popB($('ak_' + i), t, S(a), { from: .5 }));
  [7.6, 9.1, 11.1].forEach((a, i) => draw($('ak_ar' + i), eOut(seg(t, S(a), S(a) + .35))));
  pop($('ak_p'), t, S(11.74), { c: true, from: .4 });
};
// chapter cards -----------------------------------------------------------------------------
CHAP.forEach(([c, title, ic, sub], i) => {
  const id = 'ch' + (i + 1);
  HTML[id] = `
  <div class="a ctr" id="${id}_n" style="left:400px;top:540px;font:800 420px/1 PJS;color:transparent;-webkit-text-stroke:5px #dab6fc;letter-spacing:-.04em">0${i + 1}</div>
  <div class="a lbl li" id="${id}_l" style="left:760px;top:385px;font-size:30px">Capitolo ${i + 1} di 7 · ${sub}</div>
  <div class="a h1" id="${id}_t" style="left:755px;top:440px;font-size:${title.length > 14 ? 104 : 120}px">${MW(title)}</div>
  ${CIRC(id + '_i', 820, 760, 124, icon(ic, 60, '#30103d', 2.2), '#dab6fc')}
  <div class="a" id="${id}_u" style="left:760px;top:600px;width:600px;height:8px;border-radius:4px;background:#dab6fc;transform-origin:0 50%"></div>`;
  U[id] = t => {
    const t0 = S(c);
    const k = expo(seg(t, t0 + .05, t0 + .8)), p = pulse(t, 10);
    tf($(id + '_n'), { x: (1 - k) * -260, o: k, c: true, s: 1 + .025 * (t - t0) + p * .03 });
    dblur($(id + '_n'), (1 - k) * 40);
    rise($(id + '_l'), t, t0 + .25); words($(id + '_t'), t, t0 + .5);
    $(id + '_u').style.transform = `scaleX(${eOut(seg(t, t0 + .75, t0 + 1.25))})`;
    popB($(id + '_i'), t, t0 + 1.0, { c: true, from: .2 });
  };
});
// 1. minimum wage --------------------------------------------------------------------------
HTML.min = `
  ${KICK('mn_k', 'Salario minimo per legge · Mindestlohn', 175)}
  <div class="pill ctr" id="mn_y0" style="left:500px;top:300px;font-size:30px">${icon('cal', 28, '#5e2d61', 2.6)} 2026</div>
  <div class="a ctr" id="mn_v0" style="left:500px;top:470px;font:800 170px/1 PJS;color:#fff;letter-spacing:-.03em">0,00 €</div>
  <div class="a ctr lbl li" id="mn_s0" style="left:500px;top:590px;font-size:30px">lordi all'ora</div>
  <svg class="a" style="left:0;top:0" width="1920" height="1080"><path id="mn_ar" d="M900 470 h140 m-34 -34 l34 34 l-34 34" stroke="#dab6fc" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none" pathLength="100"/></svg>
  <div class="card" id="mn_c" style="left:1090px;top:250px;width:620px;height:430px">
    <div class="a ctr" id="mn_y1" style="left:310px;top:70px;display:flex;gap:12px;align-items:center;font:800 30px INT;color:#5e2d61">${icon('cal', 32, '#5e2d61', 2.4)} dal 1° gennaio <span id="mn_yr" style="display:inline-block">2026</span></div>
    <div class="a ctr" id="mn_v1" style="left:310px;top:215px;font:800 170px/1 PJS;color:#30103d;letter-spacing:-.03em">13,90 €</div>
    <div class="a ctr lbl" id="mn_s1" style="left:310px;top:335px;font-size:28px;color:#9a83a6">lordi all'ora</div>
    <div class="pill ctr" id="mn_up" style="left:560px;top:-6px;background:#2fbf6b;color:#fff;font-size:28px">${icon('trend', 28, '#fff', 2.8)} +0,70 €</div></div>
  <div class="a ctr" id="mn_law" style="left:960px;top:840px;display:flex;gap:18px;align-items:center;padding:20px 36px;border-radius:999px;background:rgba(255,255,255,.12);font:700 32px INT;color:#fff">${icon('scale', 36, '#dab6fc', 2.4)} Vale per tutti i lavoratori, in ogni settore</div>`;
U.min = t => {
  rise($('mn_k'), t, S(16.38), { c: true }); pop($('mn_y0'), t, S(17.42), { c: true, from: .4 });
  const k0 = pop($('mn_v0'), t, S(18.3), { c: true, from: .6 }); roll($('mn_v0'), 13.9, t, S(18.3), { d: 1.0, dec: 2, suf: ' €' });
  if (k0 > .98) $('mn_v0').style.transform += ` scale(${1 + pulse(t, 12) * .03})`;
  rise($('mn_s0'), t, S(19.48), { c: true });
  draw($('mn_ar'), eOut(seg(t, S(22.06), S(22.06) + .45)));
  whip($('mn_c'), t, S(22.06), { dx: 520 });
  const fl = seg(t, S(22.94), S(22.94) + .3); $('mn_yr').textContent = fl > .5 ? '2027' : '2026'; $('mn_yr').style.transform = `scaleY(${Math.abs(Math.cos(fl * Math.PI))})`;
  roll($('mn_v1'), 14.6, t, S(24.58), { d: 1.0, dec: 2, suf: ' €', from: 13.9 });
  rise($('mn_s1'), t, S(22.3), { c: true }); popB($('mn_up'), t, S(25.78), { c: true, from: .3 });
  rise($('mn_law'), t, S(20.6), { c: true });
};
// floor: nobody below the minimum, full-time monthly -----------------------------------------
const BARS = [[.55, 0], [.78, 0], [1.12, 1], [1.3, 1], [1.5, 1]];
HTML.floor = `
  ${TITLE('fl_t', 'Sotto questa cifra, nessuno può pagarti.', 170, 64)}
  <div class="a" id="fl_ln" style="left:420px;top:440px;width:1080px;height:6px;border-radius:3px;background:#fff;transform-origin:0 50%"></div>
  <div class="pill" id="fl_lb" style="left:1520px;top:412px;font-size:28px">13,90 €/h</div>
  ${BARS.map(([h, ok], i) => `<div class="a" id="fl_b${i}" style="left:${500 + i * 190}px;top:${600 - h * 140}px;width:120px;height:${h * 140}px;border-radius:14px 14px 0 0;background:${ok ? '#dab6fc' : '#ff8a98'};transform-origin:50% 100%"></div>
    ${ok ? OK('fl_m' + i, 560 + i * 190, 600 - h * 140 - 50, 60) : NO('fl_m' + i, 560 + i * 190, 600 - h * 140 - 50, 60)}`).join('')}
  <div class="a" style="left:470px;top:600px;width:980px;height:4px;background:rgba(255,255,255,.35)"></div>
  <div class="card" id="fl_c" style="left:360px;top:690px;width:1200px;height:220px;display:flex;align-items:center;gap:30px;padding:0 50px">
    ${IB('clock', 110)}
    <div style="flex:1;white-space:nowrap"><div class="lbl" style="font-size:24px;color:#9a83a6">A tempo pieno · circa 173 ore al mese</div>
    <div style="font:800 60px PJS;margin-top:10px;display:flex;align-items:center;gap:20px;white-space:nowrap">13,90 € <span style="color:#9a83a6">×</span> 173 h <span style="color:#9a83a6">≈</span> <span id="fl_v" style="color:#5e2d61">0 €</span></div></div>
    <div class="lbl" id="fl_s" style="margin-left:auto;font-size:26px;color:#5e2d61;text-align:right;line-height:1.3">lordi<br>al mese</div></div>`;
U.floor = t => {
  words($('fl_t'), t, S(26.24), .5);
  $('fl_ln').style.transform = `scaleX(${expo(seg(t, S(27.1), S(27.1) + .6))})`; pop($('fl_lb'), t, S(27.44), { from: .4 });
  BARS.forEach(([, ok], i) => { const t0 = S(27.6) + i * GRID; const k = spring(t - t0, 12, .6); $('fl_b' + i).style.transform = `scaleY(${Math.max(0, k)})`; $('fl_b' + i).style.opacity = t > t0 ? 1 : 0; popB($('fl_m' + i), t, S(27.96) + (ok ? 1.25 : .25) + i * .1, { c: true, from: .2 }); });
  whip($('fl_c'), t, S(30.52), { dy: 260, dx: 0 }); roll($('fl_v'), 2400, t, S(32.0), { d: 1.0, suf: ' €' });
};
// 2. gross vs net: the payslip -------------------------------------------------------------
const DED = [['Pensione', 9.3, 41.64, '#dab6fc', '9,3'], ['Sanità', 8.75, 42.4, '#ffc542', '≈ 8,8'], ['Disoccupazione', 1.3, 43.14, '#7fe0a8', '1,3'], ['Assistenza*', 2.4, 44.2, '#8ec5ff', '2,4'], ['Imposta sul reddito', 8.25, 45.94, '#ff8a98', '≈ 8']];
HTML.gross = `
  ${TITLE('gr_t', 'Il lordo non è quello che ti arriva sul conto.', 165, 60)}
  <div class="card" id="gr_p" style="left:200px;top:245px;width:780px;height:770px">
    <div class="a" style="left:44px;top:36px;display:flex;align-items:center;gap:16px">${IB('doc', 72)}<div><div style="font:800 36px PJS">Busta paga</div><div class="lbl" style="font-size:20px;color:#9a83a6;margin-top:4px">Lohnabrechnung</div></div></div>
    <div class="a lbl" id="gr_h" style="left:44px;top:150px;font-size:22px;color:#9a83a6">Contributi</div>
    ${DED.map(([n, p, , c, lab], i) => `<div class="a" id="gr_r${i}" style="left:44px;top:${195 + i * 86 + (i === 4 ? 60 : 0)}px;width:692px;height:70px;border-radius:16px;background:#f6f1f9;display:flex;align-items:center;gap:18px;padding:0 24px;font:700 32px INT">
      <span style="width:22px;height:22px;border-radius:50%;background:${c};flex:none"></span>${n}<span style="margin-left:auto;font:800 34px PJS;color:#5e2d61">${lab} %</span></div>`).join('')}
    <div class="a lbl" id="gr_h2" style="left:44px;top:${195 + 4 * 86 + 18}px;font-size:22px;color:#9a83a6">Tasse</div>
    <div class="a" id="gr_n" style="left:44px;top:700px;font:600 20px INT;color:#9a83a6">* senza figli · imposta calcolata su 2.500 € lordi</div></div>
  <svg class="a" style="left:1150px;top:300px" width="560" height="560" viewBox="-280 -280 560 560">
    <circle r="200" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="80"/>
    ${DED.map(([, , , c], i) => `<circle id="gr_d${i}" r="200" fill="none" stroke="${c}" stroke-width="80" pathLength="100" transform="rotate(-90)"/>`).join('')}
  </svg>
  <div class="a ctr" id="gr_v" style="left:1430px;top:560px;font:800 120px/1 PJS;color:#fff">0 %</div>
  <div class="a ctr lbl li" id="gr_vl" style="left:1430px;top:650px;font-size:24px">dal lordo</div>
  <div class="pill ctr" id="gr_tot" style="left:1430px;top:920px;font-size:32px;background:#ff5a6e;color:#fff">In tutto circa il 30 %</div>`;
U.gross = t => {
  words($('gr_t'), t, [S(36.06), S(36.24), S(36.7), S(37.04), S(37.24), S(37.46), S(37.58), S(37.78), S(37.98), S(38.16)], .5);
  whip($('gr_p'), t, S(39.06), { dx: -520 }); rise($('gr_h'), t, S(40.66)); rise($('gr_h2'), t, S(45.58)); rise($('gr_n'), t, S(46.3));
  let acc = 0;
  DED.forEach(([, p, a], i) => {
    whip($('gr_r' + i), t, S(a), { dx: 260, d: .45 });
    const k = eOut(seg(t, S(a), S(a) + .6)), el = $('gr_d' + i);
    el.style.strokeDasharray = `${(p * k).toFixed(3)} ${100 - p * k}`; el.style.strokeDashoffset = (-acc).toFixed(3); el.style.opacity = k > 0 ? 1 : 0;
    acc += p * k;
  });
  $('gr_v').textContent = Math.round(acc) + ' %'; pop($('gr_v'), t, S(41.64), { c: true, from: .6 }); rise($('gr_vl'), t, S(41.8), { c: true });
  if (t > S(48.68)) $('gr_v').style.transform += ` scale(${1 + pulse(t, 10) * .04})`;
  popB($('gr_tot'), t, S(48.42), { c: true, from: .3 });
};
// example: 2.500 gross -> 1.750 net ----------------------------------------------------------
HTML.ex = `
  ${KICK('ex_k', 'Esempio', 190)}
  <div class="a ctr h1" id="ex_t" style="left:960px;top:270px;font-size:66px">${MW('Con 2.500 € lordi al mese')}</div>
  <div class="pill ctr" id="ex_p" style="left:960px;top:375px;font-size:28px">${icon('user', 28, '#5e2d61', 2.6)} single · senza figli · classe I</div>
  <div class="a" id="ex_bar" style="left:360px;top:470px;width:1200px;height:150px;border-radius:24px;background:#dab6fc;transform-origin:0 50%;overflow:hidden">
    <div id="ex_net" style="position:absolute;left:0;top:0;height:150px;width:840px;background:#2fbf6b;transform-origin:0 50%"></div>
    <div id="ex_bl" style="position:absolute;left:40px;top:0;height:150px;display:flex;align-items:center;font:800 76px PJS;color:#30103d">2.500 €</div></div>
  <div class="a" id="ex_cut" style="left:1200px;top:470px;width:360px;height:150px;border-radius:0 24px 24px 0;background:#ff5a6e;display:flex;align-items:center;justify-content:center;font:800 54px PJS;color:#fff">−750 €</div>
  <div class="a ctr lbl li" id="ex_l0" style="left:960px;top:670px;font-size:28px">lordo</div>
  <div class="card" id="ex_c" style="left:560px;top:740px;width:800px;height:200px;display:flex;align-items:center;gap:30px;padding:0 46px">
    ${IB('wallet', 110, '#2fbf6b')}<div><div class="lbl" style="font-size:24px;color:#9a83a6">Ti restano circa</div><div id="ex_v" style="font:800 92px/1 PJS;color:#2fbf6b;margin-top:6px">2.500 €</div></div>
    <div class="lbl" style="margin-left:auto;font-size:28px;color:#5e2d61">netti</div></div>`;
U.ex = t => {
  rise($('ex_k'), t, S(49.76), { c: true }); words($('ex_t'), t, [S(50.78), S(50.98), S(51.72), S(52.34), S(52.6), S(52.8)], .5);
  pop($('ex_p'), t, S(53.16), { c: true, from: .4 });
  $('ex_bar').style.transform = `scaleX(${expo(seg(t, S(50.98), S(50.98) + .7))})`; $('ex_bar').style.opacity = t > S(50.98) ? 1 : 0;
  rise($('ex_l0'), t, S(51.72), { c: true });
  const kc = seg(t, S(54.8), S(54.8) + .35), kf = eIn(seg(t, S(55.54), S(55.54) + .7));
  $('ex_cut').style.opacity = kc * (1 - kf); tf($('ex_cut'), { x: kf * 120, y: kf * 260, r: kf * 22, o: kc * (1 - kf) });
  $('ex_net').style.transform = `scaleX(${eOut(seg(t, S(55.54), S(55.54) + .5))})`;
  $('ex_bl').textContent = t > S(55.54) + .3 ? '1.750 €' : '2.500 €'; $('ex_bl').style.color = t > S(55.54) + .3 ? '#fff' : '#30103d';
  whip($('ex_c'), t, S(54.64), { dy: 240, dx: 0 }); roll($('ex_v'), 1750, t, S(55.54), { d: 1.0, from: 2500, suf: ' €' });
};
// 3. restaurants: monthly ranges ---------------------------------------------------------------
const AX = v => 520 + (v - 2000) * 1.0;    // € -> x
const RANGES_R = [['hat', 'Cuoco', 'con esperienza', 2400, 3000, 63.54, 65.02, 380], ['pizza', 'Pizzaiolo', 'a tempo pieno', 2500, 2900, 68.88, 70.36, 610]];
const RANGE_HTML = (pre, R) => `
  <div class="a" style="left:${AX(2000)}px;top:840px;width:1200px;height:4px;background:rgba(255,255,255,.5)" id="${pre}_ax"></div>
  ${[2000, 2200, 2400, 2600, 2800, 3000, 3200].map((v, i) => `<div class="a ctr" id="${pre}_tk${i}" style="left:${AX(v)}px;top:880px;font:700 26px INT;color:rgba(255,255,255,.75)">${fmt(v)}</div><div class="a" style="left:${AX(v) - 2}px;top:800px;width:4px;height:44px;background:rgba(255,255,255,.18)"></div>`).join('')}
  ${R.map(([ic, n, sub, a, b, , , y], i) => `
  <div class="a" id="${pre}_n${i}" style="left:120px;top:${y - 56}px;display:flex;align-items:center;gap:20px">${IB(ic, 96, '#fff', '#5e2d61')}<div><div style="font:800 40px PJS;color:#fff">${n}</div><div class="lbl li" style="font-size:20px;margin-top:4px">${sub}</div></div></div>
  <div class="a" style="left:${AX(2000)}px;top:${y - 6}px;width:1200px;height:12px;border-radius:6px;background:rgba(255,255,255,.12)"></div>
  <div class="a" id="${pre}_b${i}" style="left:${AX(a)}px;top:${y - 30}px;width:${b - a}px;height:60px;border-radius:30px;background:linear-gradient(90deg,#dab6fc,#fff);transform-origin:0 50%"></div>
  <div class="pill ctr" id="${pre}_a${i}" style="left:${AX(a)}px;top:${y - 82}px;font-size:30px">${fmt(a)} €</div>
  <div class="pill ctr" id="${pre}_z${i}" style="left:${AX(b)}px;top:${y - 82}px;font-size:30px;background:#2fbf6b;color:#fff">${fmt(b)} €</div>`).join('')}`;
const RANGE_U = (pre, R, t) => {
  R.forEach(([, , , , , a, b], i) => {
    whip($(pre + '_n' + i), t, S(a) - 1.2, { dx: -300 });
    popB($(pre + '_a' + i), t, S(a), { c: true, from: .3 });
    $(pre + '_b' + i).style.transform = `scaleX(${expo(seg(t, S(a) + .1, S(b)))})`; $(pre + '_b' + i).style.opacity = t > S(a) + .1 ? 1 : 0;
    popB($(pre + '_z' + i), t, S(b), { c: true, from: .3 });
  });
};
HTML.rist = `${TITLE('rs_t', 'Quanto si prende al mese (lordo)', 190, 62)}${RANGE_HTML('rs', RANGES_R)}`;
U.rist = t => {
  words($('rs_t'), t, S(60.78), .5); $('rs_ax').style.transform = `scaleX(${expo(seg(t, S(60.9), S(61.6)))})`; $('rs_ax').style.transformOrigin = '0 50%';
  RANGE_U('rs', RANGES_R, t);
};
// collective contract, region by region -----------------------------------------------------------
const CTR_C = ['Amburgo', 'Berlino', 'Düsseldorf', 'Francoforte', 'Lipsia', 'Monaco'];
HTML.ctr = `
  <div class="card" id="ct_d" style="left:200px;top:300px;width:700px;height:500px">
    <div class="a" style="left:50px;top:50px">${IB('doc', 120)}</div>
    <div class="a" style="left:50px;top:210px;font:800 52px/1.1 PJS">Contratto<br>collettivo</div>
    <div class="a lbl" style="left:52px;top:350px;font-size:22px;color:#9a83a6">Tarifvertrag · ristorazione</div>
    <div class="a" style="left:52px;top:400px;display:flex;gap:10px">${[90, 70, 80].map(w => `<div style="height:12px;width:${w * 1.5}px;border-radius:6px;background:#e3d7ea"></div>`).join('')}</div></div>
  <div class="a" id="ct_mw" style="left:1130px;top:200px">${MAP('ct_m', 82, { cities: CTR_C })}</div>
  <div class="pill ctr" id="ct_p" style="left:1360px;top:900px;font-size:30px">${icon('pin', 28, '#5e2d61', 2.6)} cambia da regione a regione</div>`;
U.ctr = t => {
  whip($('ct_d'), t, S(73.54), { dx: -480 });
  rise($('ct_mw'), t, S(71.8)); draw($('ct_m_o'), ease(seg(t, S(71.8), S(73.2))));
  CTR_C.forEach((n, i) => { const g = $('ct_m_' + n.replace(/\W/g, '')), t0 = S(75.44) + i * GRID, k = spring(t - t0, 13, .55); g.style.opacity = t > t0 ? 1 : 0; g.firstElementChild.setAttribute('r', (26 + pulse(t, 7) * 12).toFixed(1)); g.firstElementChild.setAttribute('fill', ['#dab6fc', '#ffc542', '#7fe0a8', '#8ec5ff', '#ff8a98', '#fff'][i]); g.lastElementChild.setAttribute('r', (10 * Math.max(0, k)).toFixed(2)); });
  pop($('ct_p'), t, S(75.94), { c: true, from: .4 });
};
