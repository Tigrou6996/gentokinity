
// 6. rules for everyone: the 24-hour dial ---------------------------------------------------------
const arc = (a0, a1, r = 230) => { const p = a => [Math.sin(a / 24 * 2 * Math.PI) * r, -Math.cos(a / 24 * 2 * Math.PI) * r]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 12 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
HTML.reg1 = `
  <svg class="a" style="left:180px;top:160px" width="760" height="760" viewBox="-380 -380 760 760">
    <circle r="230" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="70"/>
    ${Array.from({ length: 24 }, (_, i) => `<line x1="0" y1="-300" x2="0" y2="${i % 6 ? -285 : -275}" stroke="rgba(255,255,255,.5)" stroke-width="${i % 6 ? 3 : 5}" transform="rotate(${i * 15})"/>`).join('')}
    <path id="r1_w" d="${arc(0, 8)}" fill="none" stroke="#dab6fc" stroke-width="70" pathLength="100"/>
    <path id="r1_x" d="${arc(8, 10)}" fill="none" stroke="#ffc542" stroke-width="70" pathLength="100"/>
    <path id="r1_r" d="${arc(10, 21)}" fill="none" stroke="#2fbf6b" stroke-width="70" pathLength="100"/>
  </svg>
  <div class="a ctr" id="r1_c" style="left:560px;top:540px;text-align:center"><div style="font:800 96px/1 PJS;color:#fff">24 h</div><div class="lbl li" style="font-size:22px;margin-top:8px">una giornata</div></div>
  ${[['#dab6fc', '8 ore', 'in media al giorno', 221.4], ['#ffc542', 'max 10 ore', 'al giorno', 223.46], ['#2fbf6b', '11 ore', 'di riposo tra un turno e l\'altro', 224.32]].map(([c, a, b], i) => `<div class="card" id="r1_${i}" style="left:1060px;top:${250 + i * 220}px;width:680px;height:180px;display:flex;align-items:center;gap:26px;padding:0 36px">
    <div style="width:30px;height:110px;border-radius:15px;background:${c};flex:none"></div><div><div style="font:800 60px/1 PJS">${a}</div><div style="font:600 28px INT;color:#7d6787;margin-top:8px">${b}</div></div></div>`).join('')}`;
U.reg1 = t => {
  rise($('r1_c'), t, S(220.42), { c: true });
  [['r1_w', 221.4], ['r1_x', 223.46], ['r1_r', 224.32]].forEach(([id, a], i) => { draw($(id), ease(seg(t, S(a) - .1, S(a) + .8))); whip($('r1_' + i), t, S(a) - .2, { dx: 400 }); });
};
// rules for everyone: four cards -----------------------------------------------------------------
HTML.reg2 = `
  <div class="card" id="r2_0" style="left:170px;top:200px;width:770px;height:360px">
    <div class="a" style="left:40px;top:40px;display:flex;align-items:center;gap:20px">${IB('doc', 96)}<div style="font:800 40px/1.15 PJS">Condizioni<br>per iscritto</div></div>
    <div class="a" style="left:40px;top:190px;width:690px;height:130px;border-radius:18px;background:#f6f1f9"><svg width="690" height="130"><path id="r2_sig" d="M40 85 C70 30 95 30 100 80 S140 110 160 60 S205 40 215 85 S260 95 280 60 Q300 40 330 78 L400 70" stroke="#5e2d61" stroke-width="6" fill="none" stroke-linecap="round" pathLength="100"/><line x1="40" y1="105" x2="650" y2="105" stroke="#d6c6e0" stroke-width="3"/></svg>
    <div id="r2_pen" style="position:absolute;left:0;top:0">${icon('pen', 54, '#30103d', 2.2)}</div></div></div>
  <div class="card" id="r2_1" style="left:980px;top:200px;width:770px;height:360px">
    <div class="a" style="left:40px;top:40px;display:flex;align-items:center;gap:20px">${IB('sun', 96, '#ffc542', '#30103d')}<div style="font:800 40px/1.15 PJS">Ferie pagate<br><span style="font:600 26px INT;color:#7d6787">almeno, per legge</span></div></div>
    <div class="a" id="r2_fv" style="left:40px;top:200px;font:800 110px/1 PJS;color:#5e2d61">0</div>
    <div class="a" style="left:220px;top:215px;font:800 34px/1.2 PJS">giorni all'anno</div>
    <div class="a" id="r2_wk" style="left:220px;top:268px;display:flex;gap:10px;align-items:center;font:700 22px INT;color:#7d6787">${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => `<span class="wd" style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#f0e8f5;color:#9a83a6">${d}</span>`).join('')}</div></div>
  <div class="card" id="r2_2" style="left:170px;top:600px;width:770px;height:360px">
    <div class="a" style="left:40px;top:40px;display:flex;align-items:center;gap:20px">${IB('thermo', 96, '#ff5a6e')}<div style="font:800 40px/1.15 PJS">Malattia<br><span style="font:600 26px INT;color:#7d6787">stipendio pieno</span></div></div>
    <div class="a" style="left:40px;top:200px;display:flex;gap:12px">${Array.from({ length: 6 }, (_, i) => `<div class="mw" style="width:100px;height:70px;border-radius:14px;background:#f0e8f5;display:flex;align-items:center;justify-content:center;font:800 26px PJS;color:#fff">${i + 1}</div>`).join('')}</div>
    <div class="a" id="r2_mv" style="left:40px;top:295px;font:800 36px PJS;color:#5e2d61">fino a 6 settimane</div></div>
  <div class="card" id="r2_3" style="left:980px;top:600px;width:770px;height:360px">
    <div class="a" style="left:40px;top:40px;display:flex;align-items:center;gap:20px">${IB('hourglass', 96)}<div style="font:800 40px/1.15 PJS">Periodo di prova</div></div>
    <div class="a" style="left:40px;top:200px;font:800 34px PJS;color:#9a83a6">al massimo</div>
    <div class="a" id="r2_pv" style="left:40px;top:245px;font:800 84px/1 PJS;color:#5e2d61">0 mesi</div></div>`;
U.reg2 = t => {
  whip($('r2_0'), t, S(227.18), { dx: -500 });
  const ks = ease(seg(t, S(228.2), S(229.9))); draw($('r2_sig'), ks); const sp = $('r2_sig').getPointAtLength ? $('r2_sig').getPointAtLength($('r2_sig').getTotalLength() * ks) : { x: 0, y: 0 };
  tf($('r2_pen'), { x: sp.x - 6, y: sp.y - 48, o: ks > 0 && ks < 1 ? 1 : 0 });
  whip($('r2_1'), t, S(230.32), { dx: 500 }); roll($('r2_fv'), 20, t, S(230.88), { d: .8 });
  $$('.wd', $('r2_1')).forEach((d, i) => { const on = i < 5 && t > S(233.4) + i * GRID / 2; d.style.background = on ? '#ffc542' : '#f0e8f5'; d.style.color = on ? '#30103d' : '#9a83a6'; });
  whip($('r2_2'), t, S(235.16), { dx: -500 });
  $$('.mw', $('r2_2')).forEach((d, i) => { const on = t > S(237.5) + i * GRID / 2; d.style.background = on ? '#2fbf6b' : '#f0e8f5'; d.style.transform = `scale(${on ? lerp(.7, 1, eOut(seg(t, S(237.5) + i * GRID / 2, S(237.5) + i * GRID / 2 + .2))) : 1})`; });
  rise($('r2_mv'), t, S(237.96));
  whip($('r2_3'), t, S(239.32), { dx: 500 }); roll($('r2_pv'), 6, t, S(241.08), { d: .6, suf: ' mesi' });
};
// 7. rent ------------------------------------------------------------------------------------------
const RENT = [['Media in Germania', 510, 249.52, '', 'rgba(255,255,255,.75)'], ['Düsseldorf', 630, 253.0, 'più di ', '#ffc542'], ['Monaco', 800, 254.5, '', '#ff8a98']];
const RW = v => v * 1.05;
HTML.rent1 = `
  <div class="a" id="re_mw" style="left:150px;top:230px">${MAP('re_m', 80, { cities: ['Düsseldorf', 'Monaco'] })}</div>
  <div class="card" id="re_c" style="left:800px;top:200px;width:960px;height:150px;display:flex;align-items:center;gap:24px;padding:0 36px">${IB('bed', 96)}<div><div style="font:800 40px PJS">Una stanza in una casa condivisa</div><div class="lbl" style="font-size:20px;color:#9a83a6;margin-top:6px">WG-Zimmer · affitto medio al mese</div></div></div>
  ${RENT.map(([n, v, , pre, c], i) => `<div class="a" id="re_r${i}" style="left:800px;top:${430 + i * 175}px;width:1000px;height:140px">
    <div class="a" style="left:0;top:0;font:800 34px PJS;color:#fff">${n}</div>
    <div class="a" id="re_b${i}" style="left:0;top:58px;width:${RW(v)}px;height:70px;border-radius:35px;background:${c};transform-origin:0 50%"></div>
    <div class="a" id="re_v${i}" style="left:${RW(v) + 24}px;top:60px;font:800 60px/1 PJS;color:#fff">0 €</div></div>`).join('')}`;
U.rent1 = t => {
  rise($('re_mw'), t, S(246.56)); draw($('re_m_o'), ease(seg(t, S(246.56), S(248.2))));
  whip($('re_c'), t, S(246.56), { dx: 500 });
  RENT.forEach(([, v, a, pre], i) => { rise($('re_r' + i), t, S(a) - .5); $('re_b' + i).style.transform = `scaleX(${expo(seg(t, S(a) - .2, S(a) + .6))})`; roll($('re_v' + i), pre ? 600 : v, t, S(a), { pre, suf: ' €' }); });
  [['Düsseldorf', 251.92], ['Monaco', 254.04]].forEach(([n, a]) => { const g = $('re_m_' + n.replace(/\W/g, '')), k = spring(t - S(a), 13, .55); g.style.opacity = t > S(a) ? 1 : 0; g.lastElementChild.setAttribute('r', (12 * Math.max(0, k)).toFixed(2)); g.firstElementChild.setAttribute('r', (28 + pulse(t, 7) * 12).toFixed(1)); g.firstElementChild.setAttribute('fill', n === 'Monaco' ? '#ff8a98' : '#ffc542'); });
};
// rent: what's left out of 1.750 ---------------------------------------------------------------------
const NW = v => v * .62;
HTML.rent2 = `
  ${KICK('rt_k', 'Netto 1.750 € · affitto a carico tuo', 200)}
  <div class="a" id="rt_bar" style="left:${960 - NW(1750) / 2}px;top:300px;width:${NW(1750)}px;height:170px;border-radius:26px;background:#2fbf6b;transform-origin:0 50%;overflow:hidden">
    <div id="rt_rent" style="position:absolute;right:0;top:0;height:170px;width:${NW(750)}px;background:#ff5a6e;display:flex;align-items:center;justify-content:center;font:800 54px PJS;color:#fff;transform-origin:100% 50%">− affitto</div></div>
  <div class="a ctr" id="rt_v" style="left:960px;top:560px;font:800 140px/1 PJS;color:#fff">1.750 €</div>
  <div class="a ctr lbl li" id="rt_vl" style="left:960px;top:650px;font-size:26px">ti restano</div>
  <div class="card" id="rt_inc" style="left:460px;top:740px;width:1000px;height:200px;display:flex;align-items:center;gap:30px;padding:0 44px">${IB('home', 120, '#2fbf6b')}
    <div><div style="font:800 52px PJS;color:#30103d">Alloggio incluso</div><div style="font:600 30px INT;color:#7d6787;margin-top:6px">può valere più di uno stipendio alto</div></div></div>`;
U.rent2 = t => {
  rise($('rt_k'), t, S(255.66), { c: true });
  $('rt_bar').style.transform = `scaleX(${expo(seg(t, S(256.72), S(256.72) + .7))})`; $('rt_bar').style.opacity = t > S(256.72) ? 1 : 0;
  const kr = eOut(seg(t, S(259.18), S(259.18) + .6)), km = eOut(seg(t, S(260.88), S(260.88) + .4)), kb = eOut(seg(t, S(263.62), S(263.62) + .7));
  $('rt_rent').style.transform = `scaleX(${kr * (1 + km * .07) * (1 - kb)})`;
  const v = t < S(259.18) ? 1750 : t < S(263.62) ? lerp(1750, 1000, kr) - km * 50 : lerp(950, 1750, kb);
  $('rt_v').textContent = (t > S(260.88) && t < S(263.62) ? '≤ ' : '') + fmt(Math.round(v / 10) * 10) + ' €';
  pop($('rt_v'), t, S(256.72), { c: true, from: .6 }); rise($('rt_vl'), t, S(259.18), { c: true });
  if (t > S(260.88) && t < S(262.2)) $('rt_v').style.transform += ` translateX(${Math.sin(t * 60) * 8 * Math.exp(-(t - S(260.88)) * 4)}px)`;
  $('rt_v').style.color = t > S(259.4) && t < S(263.62) ? '#ff8a98' : '#fff';
  whip($('rt_inc'), t, S(262.9), { dy: 300, dx: 0 });
};
// rent deducted from the payslip? check it, get it in writing ----------------------------------------
HTML.rent3 = `
  <div class="card" id="r3_p" style="left:200px;top:220px;width:740px;height:640px">
    <div class="a" style="left:44px;top:40px;display:flex;align-items:center;gap:16px">${IB('doc', 72)}<div style="font:800 36px PJS">Busta paga</div></div>
    ${[['Stipendio netto', '1.750 €'], ['Alloggio', '− ? €'], ['Accredito', '? €']].map(([a, b], i) => `<div class="a" id="r3_r${i}" style="left:44px;top:${170 + i * 120}px;width:652px;height:96px;border-radius:16px;background:${i === 1 ? '#fff4d6' : '#f6f1f9'};display:flex;align-items:center;padding:0 26px;font:700 34px INT">${a}<span style="margin-left:auto;font:800 38px PJS;color:${i === 1 ? '#c98a00' : '#5e2d61'}">${b}</span></div>`).join('')}
    <div class="a" id="r3_mg" style="left:0;top:0">${CIRC('', 0, 0, 170, icon('search', 110, '#5e2d61', 2.2), 'rgba(255,255,255,.35)', 'position:relative;transform:none;border:8px solid #5e2d61;backdrop-filter:blur(1px)')}</div>
    <div class="pill ctr" id="r3_ck" style="left:370px;top:560px;font-size:32px;background:#ffc542;color:#30103d">${icon('search', 30, '#30103d', 2.6)} controlla quanto</div></div>
  <div class="card" id="r3_c" style="left:1000px;top:220px;width:720px;height:640px">
    <div class="a" style="left:44px;top:40px;display:flex;align-items:center;gap:16px">${IB('edit', 72)}<div style="font:800 36px PJS">Contratto</div></div>
    ${[90, 76, 84, 60, 80].map((w, i) => `<div class="a" style="left:44px;top:${170 + i * 40}px;width:${w * 6.3}px;height:14px;border-radius:7px;background:#e3d7ea"></div>`).join('')}
    <div class="a" id="r3_hl" style="left:36px;top:${170 + 3 * 40 - 12}px;width:600px;height:38px;border-radius:10px;background:#ffc542;opacity:.6;transform-origin:0 50%"></div>
    <div class="a" style="left:60px;top:${170 + 3 * 40 - 8}px;font:800 24px INT;color:#30103d" id="r3_hlt">Alloggio: ... € al mese</div>
    <svg class="a" style="left:44px;top:420px" width="630" height="140"><path id="r3_sig" d="M30 95 C60 30 90 35 95 88 S135 110 160 60 S205 40 220 90 S270 100 290 60 Q310 40 340 85 L420 76" stroke="#5e2d61" stroke-width="6" fill="none" stroke-linecap="round" pathLength="100"/><line x1="20" y1="115" x2="600" y2="115" stroke="#d6c6e0" stroke-width="3"/></svg>
    ${OK('r3_ok', 620, 560, 90)}</div>`;
U.rent3 = t => {
  whip($('r3_p'), t, S(267.4), { dx: -500 }); for (let i = 0; i < 3; i++) rise($('r3_r' + i), t, S(267.66) + i * GRID);
  const km = ease(seg(t, S(269.6), S(270.6))); tf($('r3_mg'), { x: lerp(520, 440, km), y: lerp(420, 268, km), o: clamp((t - S(269.5)) * 4), s: lerp(.6, 1, km) });
  pop($('r3_ck'), t, S(270.5), { c: true, from: .4 });
  whip($('r3_c'), t, S(271.44), { dx: 500 }); $('r3_hl').style.transform = `scaleX(${eOut(seg(t, S(271.84), S(272.2)))})`; rise($('r3_hlt'), t, S(271.9));
  draw($('r3_sig'), ease(seg(t, S(272.0), S(273.1)))); popB($('r3_ok'), t, S(272.46) + .5, { c: true, from: .2 });
};
// disclaimer -----------------------------------------------------------------------------------------
HTML.disc = `
  <div class="pill ctr" id="ds_y" style="left:960px;top:260px;font-size:30px">${icon('info', 30, '#5e2d61', 2.6)} dati 2026</div>
  ${TITLE('ds_t', 'Le cifre sono indicative', 390, 96)}
  <div class="a ctr lbl li" id="ds_l" style="left:960px;top:500px;font-size:28px">Dipendono da</div>
  ${[['doc', 'Contratto', 276.08], ['pin', 'Città', 277.02], ['clock', 'Ore di lavoro', 278.02]].map(([ic, n], i) => `<div class="card" id="ds_${i}" style="left:${300 + i * 460}px;top:580px;width:400px;height:200px;display:flex;align-items:center;gap:24px;padding:0 34px">${IB(ic, 96)}<div style="font:800 40px PJS">${n}</div></div>`).join('')}`;
U.disc = t => {
  pop($('ds_y'), t, S(273.6), { c: true, from: .4 }); words($('ds_t'), t, [S(273.54), S(273.76), S(274.08), S(274.36)], .5); rise($('ds_l'), t, S(275.38), { c: true });
  [276.08, 277.02, 278.02].forEach((a, i) => whip($('ds_' + i), t, S(a) - .2, { dy: 260, dx: 0 }));
};
// recap: how to read an offer --------------------------------------------------------------------------
const RC = [['Lordo o netto?', 281.92, 'euro'], ['Quante ore?', 283.68, 'clock'], ['Alloggio?', 284.56, 'home'], ['Contratto?', 285.9, 'doc']];
HTML.recap = `
  ${TITLE('rc_t', "Ora sai come leggere un'offerta", 210, 80)}
  ${RC.map(([n, , ic], i) => `<div class="card" id="rc_${i}" style="left:${170 + i * 400}px;top:360px;width:360px;height:440px">
    <div class="a ctr" style="left:180px;top:150px">${IB(ic, 150)}</div>
    <div class="a ctr" style="left:180px;top:300px;font:800 40px PJS">${n}</div>
    ${OK('rc_k' + i, 180, 385, 84)}</div>`).join('')}`;
U.recap = t => {
  words($('rc_t'), t, [S(279.38), S(279.68), S(279.96), S(280.24), S(280.62)], .5);
  RC.forEach(([, a], i) => { whip($('rc_' + i), t, S(a) - .35, { dy: 300, dx: 0, d: .45 }); popB($('rc_k' + i), t, S(a) + .25, { c: true, from: .2 }); });
};
// outro --------------------------------------------------------------------------------------------------
HTML.outro = `
  <div class="a ctr h1" id="ou_a" style="left:960px;top:400px;font-size:120px">${MW('Il lavoro vero')}</div>
  <div class="a ctr h1" id="ou_b" style="left:960px;top:550px;font-size:96px">${MW('è quello che ti resta')} <span class="mask"><span class="mi"><span class="hl" id="ou_hl"><i></i><b style="color:#30103d">in tasca.</b></span></span></span></div>
  <div class="a ctr" id="ou_c" style="left:960px;top:820px;display:flex;gap:30px;align-items:center;font:700 30px INT;color:#fff"><img src="${LOGO}" style="width:74px;height:74px"> lbswork.com <span style="opacity:.4">|</span> ${FLAG('de', 38)} +49 1573 9037885 <span style="opacity:.4">|</span> ${FLAG('it', 38)} +39 351 881 8391</div>`;
U.outro = t => {
  words($('ou_a'), t, [S(286.76), S(287.0), S(287.22), S(287.44)]);
  words($('ou_b'), t, [S(288.24), S(288.5), S(288.7), S(288.84), S(289.04), S(289.34)]); hl($('ou_hl'), t, S(289.5));
  rise($('ou_c'), t, S(290.6), { c: true });
};
