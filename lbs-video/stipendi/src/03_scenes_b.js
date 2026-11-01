
// three things that make a difference ----------------------------------------------------------
HTML.three = `
  ${TITLE('th_t', 'Tre cose che fanno la differenza', 175, 64)}
  ${[['coins', 'Le mance'], ['moon', 'I supplementi'], ['home', 'Vitto e alloggio']].map(([ic, n], i) => `<div class="card" id="th_${i}" style="left:${150 + i * 560}px;top:270px;width:500px;height:680px">
    <div class="a" style="left:40px;top:40px;display:flex;align-items:center;gap:20px">${NUMC(i + 1)}<div style="font:800 42px PJS">${n}</div></div>
    <div class="a" id="th_x${i}" style="left:40px;top:150px;width:420px;height:500px"></div></div>`).join('')}`;
U.three = t => {
  words($('th_t'), t, [S(77.22), S(77.68), S(78.12), S(78.52), S(78.78), S(79.04)], .5);
  [80.14, 83.86, 90.08].forEach((a, i) => whip($('th_' + i), t, S(a) - .25, { dy: 300, dx: 0, d: .5 }));
  // 1: tips into a jar, tax-free
  const x0 = $('th_x0'); if (!x0.dataset.on) { x0.dataset.on = 1; x0.innerHTML = `
    <svg style="position:absolute;left:90px;top:40px" width="240" height="280" viewBox="0 0 240 280"><path d="M40 60h160v170a30 30 0 0 1-30 30H70a30 30 0 0 1-30-30z" fill="#f6f1f9" stroke="#5e2d61" stroke-width="6"/><rect x="30" y="40" width="180" height="26" rx="10" fill="#5e2d61"/>
    ${[0, 1, 2, 3, 4, 5].map(i => `<g transform="translate(${80 + (i % 3) * 40},${215 - Math.floor(i / 3) * 26})"><g class="cn"><ellipse rx="26" ry="11" fill="#ffc542" stroke="#c98a00" stroke-width="3"/></g></g>`).join('')}</svg>
    <div id="th_s0" style="position:absolute;left:210px;top:380px;transform:translate(-50%,-50%);padding:16px 30px;border-radius:999px;background:#2fbf6b;color:#fff;font:800 36px INT;white-space:nowrap">0 % tasse</div>
    <div style="position:absolute;left:0;right:0;top:450px;text-align:center;font:600 26px INT;color:#7d6787">se il cliente le dà a te</div>`; }
  $$('.cn', x0).forEach((c, i) => { const t0 = S(81.66) + i * GRID / 2, k = eOut(seg(t, t0, t0 + .3)); c.style.opacity = t > t0 ? 1 : 0; c.style.transform = `translateY(${(1 - k) * -160}px)`; });
  popB($('th_s0'), t, S(82.56), { c: true, from: .3 });
  // 2: night, sunday, holidays
  const x1 = $('th_x1'); if (!x1.dataset.on) { x1.dataset.on = 1; x1.innerHTML = [['moon', 'Notte'], ['cal', 'Domenica'], ['star', 'Festivi']].map(([ic, n], i) => `<div class="sp" style="position:absolute;left:0;top:${20 + i * 110}px;width:420px;height:90px;border-radius:18px;background:#f6f1f9;display:flex;align-items:center;gap:18px;padding:0 22px;font:800 34px PJS">${IB(ic, 62)}${n}<span style="margin-left:auto;font:800 30px INT;color:#2fbf6b">+ %</span></div>`).join('') + `
    <div id="th_s1" style="position:absolute;left:210px;top:395px;transform:translate(-50%,-50%);padding:16px 30px;border-radius:999px;background:#2fbf6b;color:#fff;font:800 34px INT;white-space:nowrap">senza tasse*</div>
    <div id="th_n1" style="position:absolute;left:0;right:0;top:450px;text-align:center;font:600 24px INT;color:#7d6787">* entro certi limiti di legge</div>`; }
  $$('.sp', x1).forEach((r, i) => whip(r, t, S([84.72, 85.42, 86.24][i]), { dx: 240, d: .4 }));
  popB($('th_s1'), t, S(88.82), { c: true, from: .3 }); rise($('th_n1'), t, S(87.0));
  // 3: food & lodging
  const x2 = $('th_x2'); if (!x2.dataset.on) { x2.dataset.on = 1; x2.innerHTML = `<div class="vt" style="position:absolute;left:30px;top:60px">${IB('hat', 170, '#ffc542', '#30103d')}</div><div class="vt" style="position:absolute;left:220px;top:200px">${IB('bed', 170, '#dab6fc', '#30103d')}</div>`; }
  $$('.vt', x2).forEach((v, i) => pop(v, t, S([90.08, 90.7][i]), { from: .2 }));
};
// food & lodging: values fixed by law ------------------------------------------------------------
HTML.food = `
  ${TITLE('fd_t', 'Vitto e alloggio: un valore fissato per legge', 175, 60)}
  <div class="pill ctr" id="fd_y" style="left:960px;top:275px;font-size:28px">${icon('cal', 28, '#5e2d61', 2.6)} valori 2026 · Sachbezugswerte</div>
  ${[['hat', 'Pasti', 345, 96.6, '#ffc542'], ['bed', 'Alloggio', 285, 99.56, '#dab6fc']].map(([ic, n], i) => `<div class="card" id="fd_${i}" style="left:${300 + i * 680}px;top:380px;width:640px;height:460px">
    <div class="a" style="left:50px;top:50px;display:flex;align-items:center;gap:22px">${IB(ic, 110, i ? '#dab6fc' : '#ffc542', '#30103d')}<div style="font:800 48px PJS">${n}</div></div>
    <div class="a" id="fd_v${i}" style="left:50px;top:220px;font:800 150px/1 PJS;color:#5e2d61;letter-spacing:-.03em">0 €</div>
    <div class="a lbl" style="left:54px;top:390px;font-size:24px;color:#9a83a6">al mese</div></div>`).join('')}
  <div class="a ctr" id="fd_st" style="left:1610px;top:330px;width:150px;height:150px;border-radius:50%;border:7px solid #2fbf6b;color:#2fbf6b;background:#fff;display:flex;align-items:center;justify-content:center;font:800 92px PJS">§</div>`;
U.fd = 0;
U.food = t => {
  words($('fd_t'), t, S(91.58), .5); pop($('fd_y'), t, S(95.42), { c: true, from: .4 });
  const k = pop($('fd_st'), t, S(94.24), { c: true, from: 2.2, w: 16, z: .6, r0: -40 });
  [[96.6, 345], [99.56, 285]].forEach(([a, n], i) => { whip($('fd_' + i), t, S(a) - .4, { dx: i ? 500 : -500 }); roll($('fd_v' + i), n, t, S(a), { suf: ' €' }); if (t > S(a) + 1) $('fd_v' + i).style.transform = `scale(${1 + pulse(t, 11) * .03})`; });
};
// 4. construction: collective contract, east = west ---------------------------------------------
HTML.bau1 = `
  <div class="a h1" id="b1_t" style="left:170px;top:240px;font-size:84px;line-height:1.1">${MW('Qui si')}<br>${MW('guadagna di più')}</div>
  <div class="pill" id="b1_up" style="left:170px;top:470px;font-size:30px;background:#2fbf6b;color:#fff">${icon('trend', 30, '#fff', 2.8)} grazie al contratto collettivo edile</div>
  <div class="card" id="b1_d" style="left:170px;top:580px;width:700px;height:300px;display:flex;align-items:center;gap:30px;padding:0 44px">
    ${IB('cal', 120)}<div><div class="lbl" style="font-size:24px;color:#9a83a6">Da aprile 2026</div><div style="font:800 46px/1.15 PJS;margin-top:8px">paghe uguali<br>in tutta la Germania</div></div></div>
  <div class="a" id="b1_mw" style="left:1100px;top:190px">${MAP('b1_m', 98, { split: true })}</div>
  <div class="pill ctr" id="b1_w" style="left:1210px;top:560px;font-size:28px">Ovest</div>
  <div class="pill ctr" id="b1_e" style="left:1530px;top:480px;font-size:28px">Est</div>
  <div class="a ctr" id="b1_eq" style="left:1720px;top:820px;width:110px;height:110px;border-radius:50%;background:#2fbf6b;display:flex;align-items:center;justify-content:center;font:800 86px/1 PJS;color:#fff;box-shadow:0 14px 30px rgba(20,90,50,.35)">=</div>`;
U.bau1 = t => {
  words($('b1_t'), t, [S(104.06), S(104.66), S(104.94), S(105.26), S(105.52)], .5); pop($('b1_up'), t, S(105.92), { from: .5 });
  whip($('b1_d'), t, S(108.12), { dy: 260, dx: 0 });
  rise($('b1_mw'), t, S(109.5)); draw($('b1_m_o'), ease(seg(t, S(109.5), S(111.3))));
  const kw = seg(t, S(110.4), S(110.4) + .4), ke = seg(t, S(112.4), S(112.4) + .4), km = eOut(seg(t, S(113.2), S(113.2) + .6));
  $('b1_m_w').style.opacity = kw * (1 - km * .0); $('b1_m_e').style.opacity = ke;
  $('b1_m_e').firstElementChild.setAttribute('fill', km > 0 ? `rgb(${[255, 197, 66].map((c, i) => Math.round(lerp(c, [218, 182, 252][i], km))).join(',')})` : '#ffc542');
  $('b1_m_in').style.opacity = 1 - km; draw($('b1_m_in'), eOut(seg(t, S(111.6), S(112.3))));
  pop($('b1_w'), t, S(113.2), { c: true, from: .3 }); pop($('b1_e'), t, S(112.4), { c: true, from: .3 });
  popB($('b1_eq'), t, S(113.2) + .25, { c: true, from: .2 });
};
// construction: hourly pay by category -----------------------------------------------------------
const BAU = [['Senza qualifica', 'Werker', 15.86, 116.4], ['Muratore qualificato', 'Facharbeiter', 23.97, 120.68], ['Specializzato', 'Spezialfacharbeiter', 26.05, 124.5]];
const BH = v => v * 17;
HTML.bau2 = `
  ${TITLE('b2_t', 'Paga oraria del contratto edile (lordo)', 165, 56)}
  <div class="card" id="b2_m" style="left:560px;top:225px;width:800px;height:96px;display:flex;align-items:center;gap:22px;padding:0 34px">
    ${icon('cal', 40, '#5e2d61', 2.4)}<div style="font:800 36px PJS">Al mese: <span id="b2_ma">2.700 €</span> <span style="color:#9a83a6">→</span> <span id="b2_mb" style="color:#2fbf6b">oltre 4.000 €</span></div></div>
  <div class="a" style="left:330px;top:930px;width:1260px;height:5px;background:rgba(255,255,255,.5)"></div>
  <div class="a" id="b2_min" style="left:330px;top:${930 - BH(13.9)}px;width:1260px;height:0;border-top:4px dashed rgba(255,255,255,.55)"></div>
  <div class="a lbl" id="b2_minl" style="left:1600px;top:${930 - BH(13.9) - 16}px;font-size:20px;color:rgba(255,255,255,.75)">minimo<br>13,90 €</div>
  ${BAU.map(([n, de, v], i) => `<div class="a" id="b2_b${i}" style="left:${420 + i * 400}px;top:${930 - BH(v)}px;width:280px;height:${BH(v)}px;border-radius:22px 22px 0 0;background:linear-gradient(180deg,${['#fff', '#dab6fc', '#ffc542'][i]},rgba(255,255,255,.25));transform-origin:50% 100%"></div>
    <div class="a ctr" id="b2_v${i}" style="left:${560 + i * 400}px;top:${930 - BH(v) - 54}px;font:800 66px/1 PJS;color:#fff">0 €</div>
    <div class="a ctr" id="b2_n${i}" style="left:${560 + i * 400}px;top:${930 - BH(v) / 2 + 20}px;text-align:center;white-space:normal;width:260px"><div style="font:800 32px/1.15 PJS;color:#30103d">${n}</div><div class="lbl" style="font-size:16px;color:#5e2d61;margin-top:8px;letter-spacing:.1em">${de}</div></div>`).join('')}`;
U.bau2 = t => {
  words($('b2_t'), t, S(114.06), .5);
  rise($('b2_min'), t, S(114.6)); rise($('b2_minl'), t, S(114.6));
  BAU.forEach(([, , v, a], i) => {
    const t0 = S(a) - .5, k = spring(t - t0, 11, .62); $('b2_b' + i).style.transform = `scaleY(${Math.max(0, k)})`; $('b2_b' + i).style.opacity = t > t0 ? 1 : 0;
    rise($('b2_n' + i), t, t0 + .3, { c: true }); const kv = pop($('b2_v' + i), t, S(a), { c: true, from: .5 }); roll($('b2_v' + i), v, t, S(a), { dec: 2, suf: ' €' });
    if (kv > .98) $('b2_v' + i).style.transform += ` scale(${1 + pulse(t, 11) * .03})`;
  });
  whip($('b2_m'), t, S(126.42), { dy: -200, dx: 0 }); roll($('b2_ma'), 2700, t, S(129.38), { suf: ' €' }); roll($('b2_mb'), 4000, t, S(131.24), { pre: 'oltre ', suf: ' €', from: 2700 });
};
// construction: sector minimum wages ----------------------------------------------------------
const BL = v => (v - 12) * 300;
const SMIN = [['scale', 'Salario minimo di legge', 13.9, 133.6, 'rgba(255,255,255,.35)'], ['ruler', 'Ponteggiatori', 14.35, 139.04, '#dab6fc'], ['zap', 'Elettricisti', 14.93, 142.92, '#ffc542']];
HTML.bau3 = `
  ${TITLE('b3_t', 'Alcuni mestieri hanno un minimo di settore', 175, 60)}
  <div class="pill ctr" id="b3_o" style="left:960px;top:270px;font-size:30px;background:#2fbf6b;color:#fff">${icon('shield', 30, '#fff', 2.6)} obbligatorio per tutte le aziende</div>
  ${SMIN.map(([ic, n, v, , c], i) => `<div class="a" id="b3_r${i}" style="left:140px;top:${400 + i * 190}px;width:1640px;height:150px">
    <div class="a" style="left:0;top:14px;display:flex;align-items:center;gap:18px">${IB(ic, 96, i ? '#fff' : 'rgba(255,255,255,.2)', i ? '#5e2d61' : '#fff')}<div style="font:800 ${i ? 38 : 30}px PJS;color:#fff;width:300px;white-space:normal;line-height:1.1">${n}</div></div>
    <div class="a" id="b3_b${i}" style="left:440px;top:40px;width:${BL(v)}px;height:70px;border-radius:35px;background:${c};transform-origin:0 50%"></div>
    <div class="a" id="b3_v${i}" style="left:${440 + BL(v) + 26}px;top:42px;font:800 60px/1 PJS;color:#fff">0 €</div></div>`).join('')}`;
U.bau3 = t => {
  words($('b3_t'), t, [S(133.02), S(133.66), S(134.12), S(134.34), S(134.92), S(135.22), S(135.42)], .5);
  popB($('b3_o'), t, S(136.16), { c: true, from: .3 });
  SMIN.forEach(([, , v, a], i) => { whip($('b3_r' + i), t, S(a) - .6, { dx: -300 }); $('b3_b' + i).style.transform = `scaleX(${expo(seg(t, S(a) - .2, S(a) + .6))})`; roll($('b3_v' + i), v, t, S(a), { dec: 2, suf: ' €/h', from: 12 }); });
};
// construction site rules: holidays + winter ---------------------------------------------------------
HTML.bau4 = `
  ${TITLE('b4_t', 'Le regole del cantiere', 170, 70)}
  <div class="card" id="b4_a" style="left:170px;top:260px;width:760px;height:700px">
    <div class="a" style="left:46px;top:40px;display:flex;align-items:center;gap:20px">${IB('cal', 92)}<div style="font:800 40px PJS">Ferie</div></div>
    <div class="a" id="b4_n" style="left:46px;top:170px;font:800 150px/1 PJS;color:#5e2d61">0</div>
    <div class="a" style="left:290px;top:200px;font:800 38px/1.2 PJS;color:#30103d">giorni lavorativi<br><span style="color:#9a83a6;font:700 28px INT">all'anno · contratto edile</span></div>
    <div class="a" style="left:46px;top:370px;display:grid;grid-template-columns:repeat(10,58px);gap:10px">${Array.from({ length: 30 }, (_, i) => `<div class="dy" style="width:58px;height:58px;border-radius:12px;background:#f0e8f5"></div>`).join('')}</div></div>
  <div class="card" id="b4_b" style="left:990px;top:260px;width:760px;height:700px;overflow:hidden">
    <div class="a" id="b4_snow" style="left:0;top:0;width:760px;height:700px"></div>
    <div class="a" style="left:46px;top:40px;display:flex;align-items:center;gap:20px">${IB('snow', 92, '#8ec5ff', '#fff')}<div style="font:800 40px PJS">Inverno</div></div>
    <div class="a" id="b4_d" style="left:46px;top:170px;display:flex;align-items:center;gap:18px;font:800 48px PJS"><span id="b4_d1" class="pill" style="position:relative;font-size:34px;background:#5e2d61;color:#fff">1 dic</span>${icon('arrow', 40, '#5e2d61', 2.8)}<span id="b4_d2" class="pill" style="position:relative;font-size:34px;background:#5e2d61;color:#fff">31 mar</span></div>
    <div class="a" id="b4_s" style="left:46px;top:300px;width:668px;height:150px;border-radius:20px;background:#eafaf1;display:flex;align-items:center;gap:20px;padding:0 26px">${IB('shield', 90, '#2fbf6b')}<div style="font:800 34px/1.2 PJS">Niente licenziamento<br>per il brutto tempo</div></div>
    <div class="a" id="b4_i" style="left:46px;top:480px;width:668px;height:170px;border-radius:20px;background:#f6f1f9;display:flex;align-items:center;gap:20px;padding:0 26px">${IB('euro', 90, '#ffc542', '#30103d')}<div><div style="font:800 34px/1.2 PJS">Cantiere fermo per il freddo?<br>C'è un'indennità apposta</div><div class="lbl" style="font-size:18px;color:#9a83a6;margin-top:8px">Saison-Kurzarbeitergeld</div></div></div></div>`;
U.bau4 = t => {
  words($('b4_t'), t, [S(144.96), S(145.24), S(145.4), S(145.68), S(145.86)], .5);
  whip($('b4_a'), t, S(146.9), { dx: -500 }); roll($('b4_n'), 30, t, S(148.72), { d: .9 });
  $$('.dy', $('b4_a')).forEach((d, i) => { const on = t > S(148.72) + i * .03; d.style.background = on ? (i % 10 > 7 ? '#ffc542' : '#dab6fc') : '#f0e8f5'; d.style.transform = `scale(${on ? lerp(.6, 1, eOut(seg(t, S(148.72) + i * .03, S(148.72) + i * .03 + .2))) : .9})`; });
  whip($('b4_b'), t, S(151.0), { dx: 500 }); pop($('b4_d1'), t, S(151.14), { from: .4 }); pop($('b4_d2'), t, S(152.08), { from: .4 });
  whip($('b4_s'), t, S(153.2), { dx: 300, d: .45 }); whip($('b4_i'), t, S(156.02), { dx: 300, d: .45 });
  const sn = $('b4_snow'); if (!sn.dataset.on) { sn.dataset.on = 1; const r = rng(7); sn.innerHTML = Array.from({ length: 26 }, () => `<div class="fk" data-x="${(r() * 760).toFixed(0)}" data-v="${(40 + r() * 60).toFixed(0)}" data-p="${(r() * 700).toFixed(0)}" style="position:absolute;left:0;top:0;width:12px;height:12px;border-radius:50%;background:#cfe6ff"></div>`).join(''); }
  $$('.fk', sn).forEach(f => { const y = (+f.dataset.p + t * +f.dataset.v) % 720 - 20; f.style.transform = `translate(${+f.dataset.x + Math.sin(t + +f.dataset.p) * 14}px,${y}px)`; f.style.opacity = t > S(151.0) ? .8 : 0; });
};
// safety gear is on the employer ----------------------------------------------------------------
const DPI = [['boot', 'Scarpe antinfortunistiche', 160.16], ['helmet', 'Casco', 161.52], ['vest', 'Protezioni', 162.08]];
HTML.dpi = `
  ${DPI.map(([ic, n], i) => `<div class="card" id="dp_${i}" style="left:${210 + i * 520}px;top:240px;width:460px;height:400px">
    <div class="a ctr" style="left:230px;top:160px">${IB(ic, 190, '#ffc542', '#30103d', 2)}</div>
    <div class="a ctr" style="left:230px;top:325px;font:800 34px PJS;text-align:center;white-space:normal;width:400px;line-height:1.15">${n}</div></div>`).join('')}
  <div class="a ctr" id="dp_a" style="left:960px;top:760px;display:flex;align-items:center;gap:22px;font:800 66px PJS;color:#fff">${OK('', 0, 0, 84).replace('class="chk"', 'class="chk" style="position:relative;transform:none;width:84px;height:84px"')} Li paga il datore di lavoro</div>
  <div class="pill ctr" id="dp_b" style="left:960px;top:900px;font-size:40px;background:#ff5a6e;color:#fff">${icon('wallet', 38, '#fff', 2.6)} non tu</div>`;
U.dpi = t => {
  DPI.forEach(([, , a], i) => whip($('dp_' + i), t, S(a) - .5, { dy: 260, dx: 0 }));
  rise($('dp_a'), t, S(162.72), { c: true }); popB($('dp_b'), t, S(164.5), { c: true, from: .3, r0: -8 });
};
// 5. logistics: no sector minimum, courier range ---------------------------------------------------
const RANGES_L = [['truck', 'Corriere di pacchi', 'in genere', 2200, 2800, 174.9, 176.24, 640]];
HTML.log1 = `
  <div class="card" id="l1_a" style="left:330px;top:200px;width:560px;height:260px;display:flex;align-items:center;gap:24px;padding:0 36px">${IB('ban', 100, '#ff5a6e')}<div style="font:800 40px/1.15 PJS">Nessun minimo<br>di settore</div></div>
  <div class="card" id="l1_b" style="left:1030px;top:200px;width:560px;height:260px;display:flex;align-items:center;gap:24px;padding:0 36px">${IB('scale', 100, '#2fbf6b')}<div><div class="lbl" style="font-size:22px;color:#9a83a6">vale il minimo di legge</div><div style="font:800 76px/1 PJS;color:#5e2d61;margin-top:10px">13,90 €</div></div></div>
  <svg class="a" style="left:0;top:0" width="1920" height="1080"><path id="l1_ar" d="M905 330 h110 m-30 -30 l30 30 l-30 30" stroke="#dab6fc" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none" pathLength="100"/></svg>
  ${RANGE_HTML('l1', RANGES_L)}`;
U.log1 = t => {
  whip($('l1_a'), t, S(168.04), { dx: -500 }); draw($('l1_ar'), eOut(seg(t, S(170.1), S(170.1) + .4))); whip($('l1_b'), t, S(170.3), { dx: 500 });
  $('l1_ax').style.transform = `scaleX(${expo(seg(t, S(172.3), S(173)))})`; $('l1_ax').style.transformOrigin = '0 50%';
  for (let i = 0; i < 7; i++) rise($('l1_tk' + i), t, S(172.3) + i * .06, { c: true });
  RANGE_U('l1', RANGES_L, t);
};
// hourly pay: € per hour × hours per month; every hour counts --------------------------------------
const DAY = [['Carico del furgone', 187.48, 3], ['Consegne', 186.18, 4], ["Attesa al deposito", 188.74, 3]];
HTML.log2 = `
  <div class="pill ctr" id="l2_p" style="left:960px;top:180px;font-size:30px">${icon('clock', 30, '#5e2d61', 2.6)} spesso la paga è oraria</div>
  <div class="a ctr" id="l2_f" style="left:960px;top:390px;display:flex;align-items:center;gap:36px">
    <div class="card" id="l2_a" style="position:relative;width:420px;height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">${IB('clock', 92)}<div style="font:800 36px PJS">Quanto all'ora?</div></div>
    <div id="l2_x" style="font:800 90px PJS;color:#dab6fc">×</div>
    <div class="card" id="l2_b" style="position:relative;width:420px;height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">${IB('cal', 92)}<div style="font:800 36px PJS">Quante ore al mese?</div></div>
    <div id="l2_e" style="font:800 90px PJS;color:#dab6fc">=</div>
    <div class="card" id="l2_c" style="position:relative;width:300px;height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">${IB('wallet', 92, '#2fbf6b')}<div style="font:800 36px PJS">Stipendio</div></div></div>
  <div class="a ctr h1" id="l2_t" style="left:960px;top:640px;font-size:58px">${MW('Ogni ora lavorata va pagata')}</div>
  <div class="a" id="l2_tl" style="left:260px;top:740px;width:1400px;height:130px;display:flex;gap:10px">
    ${DAY.map(([n, , w], i) => `<div id="l2_s${i}" style="position:relative;flex:${w};height:130px;border-radius:20px;background:${['#ffc542', '#dab6fc', '#8ec5ff'][i]};display:flex;align-items:center;justify-content:center;font:800 30px PJS;color:#30103d">${n}
      <div class="chk" id="l2_k${i}" style="left:calc(100% - 20px);top:0;width:58px;height:58px">${icon('check', 30, '#fff', 3.4)}</div></div>`).join('')}</div>`;
U.log2 = t => {
  pop($('l2_p'), t, S(178.76), { c: true, from: .4 });
  pop($('l2_a'), t, S(181.64), { from: .5 }); pop($('l2_x'), t, S(182.88), { from: .2 }); pop($('l2_b'), t, S(183.48), { from: .5 }); pop($('l2_e'), t, S(184.08), { from: .2 }); popB($('l2_c'), t, S(184.26), { from: .5 });
  words($('l2_t'), t, [S(185.1), S(185.32), S(185.52), S(186.0), S(186.18)], .5);
  DAY.forEach(([, a], i) => { whip($('l2_s' + i), t, S(a) - .2, { dx: 200, d: .4 }); popB($('l2_k' + i), t, S(a) + .3, { c: true, from: .2 }); });
};
// laws: heavy parcels -----------------------------------------------------------------------------
HTML.log3 = `
  <div class="a ctr" id="l3_t" style="left:960px;top:180px;display:flex;align-items:center;gap:24px"><div style="width:100px;height:100px;border-radius:50%;background:#fff;color:#5e2d61;display:flex;align-items:center;justify-content:center;font:800 64px PJS">§</div><div class="h1" style="font-size:74px">${MW('Le leggi da conoscere')}</div></div>
  <div class="card" id="l3_c" style="left:260px;top:310px;width:1400px;height:600px">
    <div class="pill" id="l3_y" style="left:46px;top:40px;font-size:26px;background:#5e2d61;color:#fff">${icon('cal', 26, '#fff', 2.6)} dal 2025 · legge postale</div>
    <div class="a" id="l3_box" style="left:120px;top:170px;width:330px;height:330px">
      <svg width="330" height="330" viewBox="0 0 330 330"><path d="M30 110 165 40 300 110v130L165 310 30 240z" fill="#e8c9a0" stroke="#8a5a2b" stroke-width="7" stroke-linejoin="round"/><path d="M30 110l135 70 135-70M165 180v130" stroke="#8a5a2b" stroke-width="7" fill="none"/><path d="M95 75l135 70" stroke="#c99a66" stroke-width="16"/></svg>
      <div class="pill ctr" id="l3_kg" style="left:250px;top:40px;font-size:40px;background:#ff5a6e;color:#fff">20+ kg</div></div>
    <div class="a" id="l3_o1" style="left:620px;top:190px;width:700px;height:150px;border-radius:22px;background:#f6f1f9;display:flex;align-items:center;gap:22px;padding:0 30px">${IB('users', 96)}<div style="font:800 40px PJS">Si consegna in due</div></div>
    <div class="a lbl" id="l3_or" style="left:940px;top:362px;font-size:26px;color:#9a83a6">oppure</div>
    <div class="a" id="l3_o2" style="left:620px;top:410px;width:700px;height:150px;border-radius:22px;background:#f6f1f9;display:flex;align-items:center;gap:22px;padding:0 30px">${IB('dolly', 96)}<div style="font:800 40px PJS">Con un mezzo adatto</div></div></div>`;
U.log3 = t => {
  rise($('l3_t'), t, S(190.2), { c: true }); words($('l3_t'), t, [S(190.2), S(190.36), S(190.66), S(190.9)], .5);
  whip($('l3_c'), t, S(191.82), { dy: 300, dx: 0 }); pop($('l3_y'), t, S(191.92), { from: .4 });
  const kb = spring(t - S(193.32), 9, .45); tf($('l3_box'), { y: (1 - kb) * -300, o: t > S(193.32) ? 1 : 0, r: (1 - kb) * -10 });
  popB($('l3_kg'), t, S(194.02), { c: true, from: .2 });
  whip($('l3_o1'), t, S(194.9), { dx: 300, d: .45 }); rise($('l3_or'), t, S(196.16)); whip($('l3_o2'), t, S(196.48), { dx: 300, d: .45 });
};
// laws: subcontractor chain ------------------------------------------------------------------------
HTML.log4 = `
  <div class="card" id="l4_u" style="left:160px;top:330px;width:380px;height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">${IB('user', 120)}<div style="font:800 40px PJS">Tu</div></div>
  <div class="card" id="l4_s" style="left:770px;top:330px;width:380px;height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">${IB('brief', 120, '#ffc542', '#30103d')}<div style="font:800 36px PJS">Subappaltatore</div></div>
  <div class="card" id="l4_g" style="left:1380px;top:280px;width:400px;height:400px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">${IB('building', 150)}<div style="font:800 36px/1.15 PJS;text-align:center">Grande azienda<br>di spedizioni</div></div>
  <svg class="a" style="left:0;top:0" width="1920" height="1080">
    <path id="l4_a1" d="M760 480 H560" stroke="#fff" stroke-width="8" stroke-linecap="round" fill="none" pathLength="100"/>
    <path id="l4_a2" d="M1370 480 H1170" stroke="#fff" stroke-width="8" stroke-linecap="round" fill="none" pathLength="100"/>
    <path id="l4_r" d="M1580 690 C1580 900 1000 940 960 820" stroke="#2fbf6b" stroke-width="10" stroke-linecap="round" fill="none" pathLength="100" stroke-dasharray="100 100"/></svg>
  <div class="a" id="l4_c" style="left:740px;top:700px;width:440px;height:130px;border-radius:24px;background:#fff;display:flex;align-items:center;gap:20px;padding:0 28px;box-shadow:0 24px 50px rgba(25,4,35,.38)">${IB('coins', 84, '#ffc542', '#30103d')}<div style="font:800 34px PJS;color:#30103d">I tuoi contributi</div></div>
  ${NO('l4_x', 1170, 700, 84)}
  <div class="pill ctr" id="l4_p" style="left:960px;top:950px;font-size:32px;background:#2fbf6b;color:#fff">${icon('shield', 30, '#fff', 2.6)} per legge ne risponde anche la grande azienda</div>`;
U.log4 = t => {
  whip($('l4_u'), t, S(197.96), { dx: -400 }); whip($('l4_s'), t, S(198.64), { dy: -300, dx: 0 }); draw($('l4_a1'), eOut(seg(t, S(198.9), S(199.3))));
  whip($('l4_c'), t, S(200.66), { dy: 240, dx: 0 }); popB($('l4_x'), t, S(199.96), { c: true, from: .2, r0: -30 });
  if (t > S(199.96) && t < S(202.5)) { const sh = Math.sin(t * 70) * 6 * Math.exp(-(t - S(199.96)) * 3); $('l4_s').style.transform += ` translateX(${sh}px)`; }
  whip($('l4_g'), t, S(203.48), { dx: 500 }); draw($('l4_a2'), eOut(seg(t, S(203.7), S(204.1))));
  const kr = ease(seg(t, S(202.56), S(204.2))); const r = $('l4_r'); r.style.strokeDashoffset = (100 - 100 * kr).toFixed(2); r.style.opacity = kr > 0 ? 1 : 0;
  pop($('l4_p'), t, S(203.0), { c: true, from: .4 });
};
// laws: trucks over 3.5 t ----------------------------------------------------------------------------
const DRV = [['Guida', 4.5, '#7fe0a8', 211.46], ['Pausa', .75, '#ffc542', 213.5], ['Guida', 4.5, '#7fe0a8', 215.52]];
HTML.log5 = `
  <div class="card" id="l5_k" style="left:160px;top:190px;width:520px;height:330px">
    <div class="a ctr" style="left:260px;top:140px">${IB('truck', 170)}</div>
    <div class="pill ctr" id="l5_w" style="left:400px;top:250px;font-size:38px;background:#ff5a6e;color:#fff">oltre 3,5 t</div></div>
  <div class="card" id="l5_c" style="left:740px;top:190px;width:500px;height:330px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:20px">${IB('idcard', 130)}<div style="font:800 42px PJS">Patente C</div></div>
  <div class="card" id="l5_g" style="left:1300px;top:190px;width:460px;height:330px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:20px">${IB('gauge', 130)}<div style="font:800 42px PJS">Tachigrafo</div></div>
  <div class="a lbl li" id="l5_l" style="left:160px;top:590px;font-size:26px">Al massimo 9 ore di guida al giorno</div>
  <div class="a" id="l5_tl" style="left:160px;top:640px;width:1600px;height:150px;display:flex;gap:12px">
    ${DRV.map(([n, h, c], i) => `<div id="l5_s${i}" style="flex:${h};height:150px;border-radius:22px;background:${c};display:flex;flex-direction:column;align-items:center;justify-content:center;color:#30103d;transform-origin:0 50%"><div style="font:800 ${i === 1 ? 32 : 44}px PJS">${i === 1 ? '45 min' : '4 h 30'}</div><div class="lbl" style="font-size:${i === 1 ? 16 : 20}px;margin-top:6px">${n}</div></div>`).join('')}</div>
  <div class="a ctr" id="l5_tot" style="left:960px;top:880px;display:flex;align-items:center;gap:20px;font:800 50px PJS;color:#fff">${icon('clock', 48, '#dab6fc', 2.4)} 9 ore di guida · pausa di 45 minuti ogni 4 ore e mezza</div>`;
U.log5 = t => {
  whip($('l5_k'), t, S(205.5), { dx: -500 }); popB($('l5_w'), t, S(206.56), { c: true, from: .3 });
  whip($('l5_c'), t, S(208.84), { dy: 260, dx: 0 }); whip($('l5_g'), t, S(209.7), { dy: 260, dx: 0 });
  rise($('l5_l'), t, S(210.74));
  DRV.forEach(([, , , a], i) => { const el = $('l5_s' + i), k = expo(seg(t, S(a) - .1, S(a) + .5)); el.style.transform = `scaleX(${k})`; el.style.opacity = k > 0 ? 1 : 0; });
  rise($('l5_tot'), t, S(215.2), { c: true });
};
