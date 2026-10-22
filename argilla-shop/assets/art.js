/* Illustrazioni SVG dei prodotti, generate dal codice.
   Al posto delle foto: ogni pezzo è disegnato con la sua forma, il suo smalto
   e il suo decoro, così cambiando variante cambia anche l'immagine.
   Con prodotti veri basta sostituire Art.product() con un <img>. */

(function () {
  let uidCounter = 0;
  const CLAY = '#CDB497';

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  function shade(c, t) { return t < 0 ? mix(c, '#000000', -t) : mix(c, '#ffffff', t); }
  function lum(c) {
    const [r, g, b] = hexToRgb(c);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function rng(seed) {
    let s = 0;
    for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* --- Forme. Ogni forma restituisce il profilo (path del corpo),
     gli elementi dietro / davanti e il riquadro per i decori. --- */
  const SHAPES = {
    vaso(c) {
      return {
        body: 'M165 110 L235 110 C235 125 228 140 228 155 C228 190 300 230 300 300 C300 360 262 408 240 420 L160 420 C138 408 100 360 100 300 C100 230 172 190 172 155 C172 140 165 125 165 110 Z',
        box: { x: 100, y: 110, w: 200, h: 310 },
        front: `<ellipse cx="200" cy="110" rx="35" ry="7" fill="${shade(c, 0.12)}"/><ellipse cx="200" cy="111" rx="27" ry="4.5" fill="${shade(c, -0.55)}"/>`
      };
    },
    colonna(c) {
      return {
        body: 'M170 70 L230 70 C230 85 236 95 240 112 L252 398 C252 414 242 420 230 420 L170 420 C158 420 148 414 148 398 L160 112 C164 95 170 85 170 70 Z',
        box: { x: 148, y: 70, w: 104, h: 350 },
        front: `<ellipse cx="200" cy="70" rx="30" ry="6" fill="${shade(c, 0.12)}"/><ellipse cx="200" cy="71" rx="23" ry="4" fill="${shade(c, -0.55)}"/>`
      };
    },
    tazza(c) {
      return {
        body: 'M128 200 L272 200 L264 398 Q262 420 240 420 L160 420 Q138 420 136 398 Z',
        box: { x: 128, y: 200, w: 144, h: 220 },
        back: '',
        afterBody: `<path d="M266 236 C338 236 338 366 261 366" fill="none" stroke="${shade(c, -0.12)}" stroke-width="24" stroke-linecap="round"/>`,
        front: `<ellipse cx="200" cy="200" rx="72" ry="13" fill="${shade(c, 0.1)}"/><ellipse cx="200" cy="201.5" rx="63" ry="9.5" fill="${shade(c, -0.45)}"/>`
      };
    },
    ciotola(c) {
      return {
        body: 'M88 255 L312 255 C312 345 262 405 200 405 C138 405 88 345 88 255 Z',
        box: { x: 88, y: 255, w: 224, h: 150 },
        back: `<rect x="162" y="396" width="76" height="22" rx="5" fill="${shade(CLAY, -0.12)}"/>`,
        front: `<ellipse cx="200" cy="255" rx="112" ry="24" fill="${shade(c, 0.14)}"/><ellipse cx="200" cy="258" rx="100" ry="19" fill="${shade(c, -0.22)}"/>`
      };
    },
    piatto(c) {
      return {
        body: 'M40 305 A160 58 0 1 0 360 305 A160 58 0 1 0 40 305 Z',
        box: { x: 40, y: 247, w: 320, h: 116 },
        flat: true,
        back: `<ellipse cx="200" cy="320" rx="160" ry="58" fill="${shade(c, -0.3)}"/><ellipse cx="200" cy="330" rx="90" ry="22" fill="${shade(CLAY, -0.2)}"/>`,
        front: `<ellipse cx="200" cy="309" rx="104" ry="35" fill="${shade(c, -0.08)}"/><path d="M96 309 A104 35 0 0 1 304 309" fill="none" stroke="${shade(c, -0.25)}" stroke-width="3" opacity=".6"/>`
      };
    },
    brocca(c) {
      return {
        body: 'M160 140 L245 140 C245 170 235 185 235 200 C235 240 290 270 290 340 C290 390 262 420 240 420 L160 420 C138 420 110 390 110 340 C110 270 165 240 165 200 C165 185 160 170 160 140 Z',
        box: { x: 110, y: 140, w: 180, h: 280 },
        back: `<path d="M163 141 L128 126 L170 168 Z" fill="${shade(c, -0.05)}"/>`,
        afterBody: `<path d="M240 172 C306 168 314 258 280 296" fill="none" stroke="${shade(c, -0.12)}" stroke-width="20" stroke-linecap="round"/>`,
        front: `<ellipse cx="202" cy="140" rx="43" ry="8" fill="${shade(c, 0.12)}"/><ellipse cx="203" cy="141" rx="35" ry="5.5" fill="${shade(c, -0.5)}"/>`
      };
    }
  };

  function decoColor(c) { return lum(c) > 0.62 ? '#1F4E79' : '#F2ECE2'; }

  function flower(cx, cy, r, color, center) {
    let s = '';
    for (let i = 0; i < 6; i++) {
      s += `<ellipse cx="${cx}" cy="${cy - r * 0.55}" rx="${r * 0.28}" ry="${r * 0.5}" fill="${color}" transform="rotate(${i * 60} ${cx} ${cy})"/>`;
    }
    return s + `<circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="${center}"/>`;
  }

  function decoration(deco, shp, c, rand) {
    const d = decoColor(c), b = shp.box;
    let s = '';
    if (deco === 'righe') {
      if (shp.flat) {
        [150, 128, 70].forEach(rx => { s += `<ellipse cx="200" cy="306" rx="${rx}" ry="${rx * 0.36}" fill="none" stroke="${d}" stroke-width="4" opacity=".8"/>`; });
      } else {
        for (let y = b.y + 40; y < b.y + b.h - 20; y += 30) s += `<rect x="${b.x - 5}" y="${y}" width="${b.w + 10}" height="5" fill="${d}" opacity=".75"/>`;
      }
    } else if (deco === 'puntini') {
      let row = 0;
      for (let y = b.y + 18; y < b.y + b.h; y += 22, row++) {
        for (let x = b.x + (row % 2 ? 11 : 0); x < b.x + b.w + 10; x += 22) s += `<circle cx="${x}" cy="${y}" r="3.6" fill="${d}" opacity=".85"/>`;
      }
    } else if (deco === 'maiolica') {
      const leaf = lum(c) > 0.62 ? '#C9962E' : '#E7C66B';
      if (shp.flat) {
        s += `<g transform="translate(200 309) scale(1 .34)">${flower(0, 0, 70, d, leaf)}`;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          s += `<circle cx="${Math.cos(a) * 132}" cy="${Math.sin(a) * 132}" r="9" fill="${i % 2 ? leaf : d}"/>`;
        }
        s += '</g>';
      } else {
        const y = b.y + b.h * 0.52;
        for (let x = b.x + 20; x < b.x + b.w; x += 56) s += flower(x, y, 26, d, leaf);
        s += `<rect x="${b.x - 5}" y="${y - 40}" width="${b.w + 10}" height="4" fill="${leaf}"/><rect x="${b.x - 5}" y="${y + 36}" width="${b.w + 10}" height="4" fill="${leaf}"/>`;
      }
    }
    // Puntinatura del grès, sempre presente: è quello che rende "vera" la ceramica.
    for (let i = 0; i < 46; i++) {
      const x = b.x + rand() * b.w, y = b.y + rand() * b.h;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.6 + rand() * 1.3).toFixed(1)}" fill="${rand() > 0.5 ? '#1a1410' : '#ffffff'}" opacity="${(0.12 + rand() * 0.18).toFixed(2)}"/>`;
    }
    return s;
  }

  /* Smalto colato: il colore copre la parte alta e scende in gocce,
     lasciando l'argilla cruda alla base. */
  function dripMask(shp, rand) {
    const b = shp.box, base = b.y + b.h * (shp.flat ? 1 : 0.62);
    let d = `M${b.x - 10} ${b.y - 10} L${b.x + b.w + 10} ${b.y - 10} L${b.x + b.w + 10} ${base}`;
    const n = 7;
    for (let i = n; i > 0; i--) {
      const x1 = b.x + b.w * (i / n), x0 = b.x + b.w * ((i - 1) / n), mid = (x0 + x1) / 2;
      const len = 10 + rand() * 46;
      d += ` C${x1 - 4} ${base} ${mid + 7} ${base} ${mid + 6} ${base + len * 0.6} Q${mid} ${base + len + 6} ${mid - 6} ${base + len * 0.6} C${mid - 7} ${base} ${x0 + 4} ${base} ${x0} ${base}`;
    }
    return d + ` L${b.x - 10} ${base} Z`;
  }

  function object(item, rand) {
    const g = window.GLAZES[item.glaze] || { color: item.glaze };
    const c = g.color;
    const shp = SHAPES[item.form && SHAPES[item.form] ? item.form : item.type](c);
    const id = 'a' + (++uidCounter);
    const deco = item.deco || 'nessuno';
    let s = `<defs><clipPath id="${id}c"><path d="${shp.body}"/></clipPath>
      <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset=".33" stop-color="#fff" stop-opacity="0"/><stop offset=".68" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient></defs>`;
    s += shp.back || '';
    if (deco === 'colata' && !shp.flat) {
      s += `<path d="${shp.body}" fill="${CLAY}"/><g clip-path="url(#${id}c)"><path d="${dripMask(shp, rand)}" fill="${c}"/>`;
    } else {
      s += `<path d="${shp.body}" fill="${c}"/><g clip-path="url(#${id}c)">`;
    }
    s += decoration(deco, shp, c, rand) + `<rect x="0" y="0" width="400" height="500" fill="url(#${id}s)"/></g>`;
    s += shp.afterBody || '';
    s += shp.front || '';
    return { svg: s, box: shp.box };
  }

  function expand(p) {
    if (p.type !== 'set') return [{ ...p, tf: '' }];
    const alt = p.glaze;
    return [
      { type: 'piatto', glaze: alt, deco: p.deco, tf: 'translate(70 40) scale(.66)' },
      { type: 'ciotola', glaze: alt, deco: 'nessuno', tf: 'translate(10 170) scale(.58)' },
      { type: 'tazza', glaze: alt, deco: p.deco, tf: 'translate(190 160) scale(.6)' }
    ];
  }

  function sprig(x, y, flip) {
    const leaf = '#6F7F5E';
    let s = `<g transform="translate(${x} ${y}) scale(${flip ? -1 : 1} 1)"><path d="M0 0 C 10 -60 30 -120 70 -170" fill="none" stroke="#5C4A3A" stroke-width="2.5"/>`;
    for (let i = 0; i < 7; i++) {
      const t = i / 7, px = 10 + t * 55, py = -20 - t * 145;
      s += `<ellipse cx="${px + 12}" cy="${py}" rx="13" ry="4.5" fill="${leaf}" transform="rotate(${-30 - t * 20} ${px} ${py})"/>`;
      s += `<ellipse cx="${px - 10}" cy="${py - 8}" rx="12" ry="4" fill="${shade(leaf, 0.15)}" transform="rotate(${-130 + t * 10} ${px} ${py - 8})"/>`;
    }
    return s + '</g>';
  }

  /* opts.view: 0 = studio, 1 = dettaglio, 2 = ambientata */
  function product(p, glazeKey, opts = {}) {
    const view = opts.view || 0;
    const glaze = window.GLAZES[glazeKey] || window.GLAZES[p.glazes[0]];
    const bg = opts.bg || mix(glaze.color, '#F3ECE2', 0.86);
    const rand = rng(p.handle + glazeKey);
    const base = { type: p.type, form: p.form, glaze: glazeKey, deco: p.deco };
    const items = expand(base);
    let body = '';
    let minX = 400, maxX = 0;
    items.forEach(it => {
      const o = object(it, rand);
      body += it.tf ? `<g transform="${it.tf}">${o.svg}</g>` : o.svg;
      if (!it.tf) { minX = o.box.x; maxX = o.box.x + o.box.w; } else { minX = 40; maxX = 360; }
    });
    let scaleTf = '';
    if (p.form === 'piccola') scaleTf = 'translate(200 425) scale(.72) translate(-200 -425)';
    if (p.form === 'larga') scaleTf = 'translate(200 425) scale(1.12 .86) translate(-200 -425)';
    const shadowW = (maxX - minX) * 0.56 * (p.form === 'piccola' ? 0.72 : 1);
    const id = 'v' + (++uidCounter);
    let scene = `<rect width="400" height="500" fill="${bg}"/>`;
    if (view === 2) {
      scene += `<rect y="0" width="400" height="330" fill="${shade(bg, -0.05)}"/><rect y="330" width="400" height="170" fill="${mix(bg, '#9C7B5B', 0.35)}"/><rect y="330" width="400" height="3" fill="${mix(bg, '#5C4A3A', 0.35)}"/>`;
    }
    scene += `<defs><radialGradient id="${id}g"><stop offset="0" stop-color="#2a1d14" stop-opacity=".28"/><stop offset="1" stop-color="#2a1d14" stop-opacity="0"/></radialGradient></defs>`;
    scene += `<ellipse cx="200" cy="424" rx="${shadowW.toFixed(0)}" ry="16" fill="url(#${id}g)"/>`;
    let content = scaleTf ? `<g transform="${scaleTf}">${body}</g>` : body;
    if (view === 2) content = sprig(p.type === 'piatto' ? 48 : 62, 440, false) + content;
    if (view === 1) content = `<g transform="translate(200 280) scale(1.75) translate(-200 -280)">${content}</g>`;
    if (view === 2) content = `<g transform="translate(200 440) scale(.82) translate(-200 -440)">${content}</g>`;
    const label = opts.label ? ` role="img" aria-label="${opts.label}"` : ' aria-hidden="true"';
    return `<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"${label}>${scene}${content}</svg>`;
  }

  /* Composizione per l'hero della home: tre pezzi insieme. */
  function hero() {
    const rand = rng('hero');
    const parts = [
      { type: 'colonna', glaze: 'salvia', deco: 'colata', tf: 'translate(-30 10) scale(.95)' },
      { type: 'vaso', glaze: 'terracotta', deco: 'righe', tf: 'translate(95 70) scale(.92)' },
      { type: 'ciotola', glaze: 'mare', deco: 'maiolica', tf: 'translate(15 185) scale(.62)' }
    ];
    let s = `<defs><radialGradient id="hg"><stop offset="0" stop-color="#2a1d14" stop-opacity=".25"/><stop offset="1" stop-color="#2a1d14" stop-opacity="0"/></radialGradient></defs>`;
    s += `<ellipse cx="210" cy="460" rx="190" ry="20" fill="url(#hg)"/>`;
    parts.forEach(p => { s += `<g transform="${p.tf}">${object(p, rand).svg}</g>`; });
    return `<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${s}</svg>`;
  }

  window.Art = { product, hero, mix, shade };
})();
