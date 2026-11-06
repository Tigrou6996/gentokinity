/* Argilla — logica del negozio.
   Router a hash (#home, #collezione-tavola, #prodotto-vaso-anfora, #carrello,
   #checkout, #ordine, #storia, #aiuto), carrello salvato nel browser,
   cassetto carrello, ricerca istantanea, filtri di collezione e checkout dimostrativo. */

(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const P = window.PRODUCTS, G = window.GLAZES, C = window.COLLECTIONS;
  const byHandle = Object.fromEntries(P.map(p => [p.handle, p]));
  const FREE_SHIP = 8000;
  const CODES = {
    BENVENUTO10: { label: 'BENVENUTO10 · −10%', apply: sub => Math.round(sub * 0.10) },
    CASA15: { label: 'CASA15 · −15% sopra 120 €', min: 12000, apply: sub => Math.round(sub * 0.15) }
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  const money = c => eur.format(c / 100);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const icon = (n, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const stars = r => `<span class="stars" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => icon('star').replace('<svg', `<svg style="opacity:${r >= i - 0.25 ? 1 : 0.25}"`)).join('')}</span>`;
  const art = (p, g, view, label) => window.Art.product(p, g, { view, label });

  /* --- Memoria locale (può mancare: in quel caso si lavora in memoria) --- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('argilla:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('argilla:' + k, JSON.stringify(v)); } catch (e) { /* niente */ } }
  };

  const state = {
    cart: store.get('cart', []).filter(l => byHandle[l.handle] && G[l.glaze]),
    discount: store.get('discount', null),
    note: store.get('note', ''),
    recent: store.get('recent', []),
    order: store.get('order', null),
    shipping: 'standard',
    filters: { types: new Set(), glazes: new Set(), max: 12000, inStock: false, sort: 'featured', q: '' }
  };

  /* ================= Carrello ================= */
  const saveCart = () => { store.set('cart', state.cart); store.set('discount', state.discount); };
  function addToCart(handle, glaze, qty = 1) {
    const p = byHandle[handle];
    if (!p || p.stock === 0) return;
    const line = state.cart.find(l => l.handle === handle && l.glaze === glaze);
    if (line) line.qty = Math.min(p.stock, line.qty + qty);
    else state.cart.push({ handle, glaze, qty: Math.min(p.stock, qty) });
    saveCart();
    renderCart(true);
  }
  function setQty(i, qty) {
    const line = state.cart[i];
    if (!line) return;
    if (qty <= 0) state.cart.splice(i, 1);
    else line.qty = Math.min(byHandle[line.handle].stock, qty);
    saveCart();
    renderCart();
  }
  const cartCount = () => state.cart.reduce((n, l) => n + l.qty, 0);
  function totals(shipping = state.shipping) {
    const sub = state.cart.reduce((s, l) => s + byHandle[l.handle].price * l.qty, 0);
    const code = state.discount && CODES[state.discount];
    const disc = code && sub >= (code.min || 0) ? code.apply(sub) : 0;
    const after = sub - disc;
    const ship = !state.cart.length ? 0 : shipping === 'express' ? 990 : after >= FREE_SHIP ? 0 : 590;
    const total = after + ship;
    return { sub, disc, ship, total, vat: Math.round(total - total / 1.22), codeOk: !!disc };
  }

  function shipMeter() {
    const t = totals();
    const left = FREE_SHIP - (t.sub - t.disc);
    const pct = Math.min(100, ((t.sub - t.disc) / FREE_SHIP) * 100);
    return `<div class="ship-meter ${left <= 0 ? 'done' : ''}">
      <span>${left <= 0 ? `${icon('check').replace('<svg', '<svg width="14" height="14" style="display:inline;vertical-align:-2px"')} La spedizione è gratuita` : `Ti mancano <strong>${money(left)}</strong> per la spedizione gratuita`}</span>
      <div class="bar" role="progressbar" aria-label="Avanzamento verso la spedizione gratuita" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><span style="width:${pct}%"></span></div>
    </div>`;
  }

  function lineHTML(l, i) {
    const p = byHandle[l.handle];
    return `<li class="line-item">
      <a class="media" href="#prodotto-${p.handle}.${l.glaze}" tabindex="-1" aria-hidden="true">${art(p, l.glaze, 0)}</a>
      <div>
        <h3><a href="#prodotto-${p.handle}.${l.glaze}">${esc(p.title)}</a></h3>
        <p class="meta">${G[l.glaze].name} · ${money(p.price)}</p>
        <div class="line-actions">
          <div class="qty" role="group" aria-label="Quantità di ${esc(p.title)}">
            <button type="button" data-qty="${i}" data-d="-1" aria-label="Diminuisci">${icon('minus')}</button>
            <input type="number" inputmode="numeric" min="0" max="${p.stock}" value="${l.qty}" data-qty-input="${i}" id="qty-${i}-${p.handle}" aria-label="Quantità">
            <button type="button" data-qty="${i}" data-d="1" aria-label="Aumenta" ${l.qty >= p.stock ? 'disabled' : ''}>${icon('plus')}</button>
          </div>
          <button class="remove" type="button" data-qty="${i}" data-d="-999">Rimuovi</button>
        </div>
      </div>
      <span class="price">${money(p.price * l.qty)}</span>
    </li>`;
  }

  function emptyCartHTML() {
    return `<div class="empty">${icon('bag')}<p style="font-family:var(--font-display);font-size:var(--step-2)">Il carrello è vuoto</p>
      <p class="fine">Le tazze Mattino sono il primo acquisto di quasi tutti i nostri clienti.</p>
      <a class="btn" href="#collezione-tutti">Inizia dal negozio</a></div>`;
  }

  function renderCart(bump) {
    const n = cartCount();
    const badge = $('#cart-count');
    badge.hidden = n === 0;
    badge.textContent = n;
    $('#cart-btn').setAttribute('aria-label', `Carrello, ${n} ${n === 1 ? 'articolo' : 'articoli'}`);
    if (bump && !reduceMotion) { badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }

    const body = $('#cart-body'), foot = $('#cart-foot');
    $('#cart-title').textContent = n ? `Carrello (${n})` : 'Carrello';
    if (!state.cart.length) {
      body.innerHTML = emptyCartHTML();
      foot.hidden = true;
    } else {
      const inCart = new Set(state.cart.map(l => l.handle));
      const ups = P.filter(p => !inCart.has(p.handle) && p.stock > 0 && p.price <= 3000).slice(0, 2);
      body.innerHTML = shipMeter() + `<ul class="line-items" style="margin-top:24px">${state.cart.map(lineHTML).join('')}</ul>` +
        (ups.length ? `<div class="upsell"><h3>Da abbinare</h3>${ups.map(p => `<div class="upsell-row">
          <a class="media" href="#prodotto-${p.handle}" aria-hidden="true" tabindex="-1">${art(p, p.glazes[0], 0)}</a>
          <div><a href="#prodotto-${p.handle}" style="text-decoration:none;font-weight:600">${esc(p.title)}</a><div class="fine">${money(p.price)}</div></div>
          <button class="btn btn-ghost" type="button" data-add="${p.handle}" data-glaze="${p.glazes[0]}" aria-label="Aggiungi ${esc(p.title)} al carrello">Aggiungi</button>
        </div>`).join('')}</div>` : '');
      const t = totals();
      foot.hidden = false;
      foot.innerHTML = `
        ${t.disc ? `<div class="totals" style="font-size:var(--step-0);font-weight:500"><span>Sconto ${esc(state.discount)}</span><span style="color:var(--ok)">−${money(t.disc)}</span></div>` : ''}
        <div class="totals"><span>Subtotale</span><span>${money(t.sub - t.disc)}</span></div>
        <p class="fine">IVA inclusa. Spedizione e codici sconto si calcolano al checkout.</p>
        <a class="btn btn-block" href="#checkout">Vai al checkout · ${money(t.sub - t.disc)}</a>
        <a class="btn btn-ghost btn-block" href="#carrello">Vedi il carrello</a>`;
    }
    const r = route();
    if (r.view === 'carrello') renderCartPage();
    if (r.view === 'checkout') renderCheckoutSide();
  }

  /* ================= Livelli (cassetti, ricerca) ================= */
  let openLayer = null, lastFocus = null;
  const overlay = $('#overlay');
  function showLayer(el) {
    if (openLayer) hideLayer(true);
    lastFocus = document.activeElement;
    openLayer = el;
    el.hidden = false; overlay.hidden = false;
    document.body.classList.add('locked');
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('open'); overlay.classList.add('open'); }));
    setTimeout(() => { const f = el.querySelector('input[type=search]') || el.querySelector('[data-close]'); f && f.focus(); }, 60);
  }
  function hideLayer(instant) {
    if (!openLayer) return;
    const el = openLayer;
    openLayer = null;
    el.classList.remove('open'); overlay.classList.remove('open');
    document.body.classList.remove('locked');
    const done = () => { if (!el.classList.contains('open')) el.hidden = true; if (!openLayer) overlay.hidden = true; };
    if (instant || reduceMotion) done(); else setTimeout(done, 320);
    if (!instant && lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  overlay.addEventListener('click', () => hideLayer());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (openLayer) hideLayer(); else closeMega(); }
    if (e.key === 'Tab' && openLayer) {
      const f = $$('a[href], button:not([disabled]), input, select, textarea', openLayer).filter(x => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  const layers = { cart: '#cart-drawer', menu: '#menu-drawer', search: '#search-panel', filters: '#filter-drawer' };
  function open(name) {
    if (name === 'search') renderSearch('');
    if (name === 'filters') renderFilters('#filter-body', 'm');
    showLayer($(layers[name]));
  }

  /* ================= Mega menu ================= */
  const megaBtn = $('#mega-btn'), mega = $('#mega');
  function buildMega() {
    const types = [['tazza', 'Tazze'], ['piatto', 'Piatti'], ['ciotola', 'Ciotole'], ['vaso', 'Vasi'], ['brocca', 'Brocche'], ['set', 'Set regalo']];
    const feat = byHandle['vaso-anfora'];
    $('#mega-inner').innerHTML = `
      <div class="mega-col"><h3>Collezioni</h3><ul>${C.map(c => `<li><a href="#collezione-${c.handle}">${c.title}</a></li>`).join('')}<li><a href="#collezione-tutti">Tutto il negozio</a></li></ul></div>
      <div class="mega-col"><h3>Per tipo</h3><ul>${types.map(([k, l]) => `<li><a href="#collezione-tutti" data-type-link="${k}">${l}</a></li>`).join('')}</ul></div>
      <div class="mega-col"><h3>Per smalto</h3><ul>${['mare', 'salvia', 'terracotta', 'latte', 'lava'].map(g => `<li><a href="#collezione-tutti" data-glaze-link="${g}">${G[g].name}</a></li>`).join('')}</ul></div>
      <div class="mega-col"><h3>Assistenza</h3><ul><li><a href="#aiuto">Spedizioni e resi</a></li><li><a href="#aiuto">Cura della ceramica</a></li><li><a href="#storia">La bottega</a></li></ul></div>
      <a class="mega-feature" href="#prodotto-${feat.handle}">
        <div class="media">${art(feat, 'mare', 2)}</div>
        <div><span class="eyebrow">Il più venduto</span><strong>${feat.title}</strong><span class="fine">Smalto Blu Mediterraneo · ${money(feat.price)}</span></div>
      </a>`;
  }
  function closeMega() { if (!mega.hidden) { mega.hidden = true; megaBtn.setAttribute('aria-expanded', 'false'); } }
  megaBtn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = !mega.hidden;
    if (!isOpen && !$('#mega-inner').innerHTML) buildMega();
    mega.hidden = isOpen;
    megaBtn.setAttribute('aria-expanded', String(!isOpen));
  });
  document.addEventListener('click', e => { if (!mega.hidden && !mega.contains(e.target)) closeMega(); });

  /* ================= Barra annunci ================= */
  const ANN = [
    'Spedizione gratuita in Italia sopra 80 €',
    'Reso gratuito entro 30 giorni dalla consegna',
    'Nuovo: Piatto Maiolica in tre smalti · <a href="#prodotto-piatto-maiolica">Scoprilo</a>'
  ];
  let annI = 0, annTimer;
  function setAnn(d) { annI = (annI + d + ANN.length) % ANN.length; $('#announce-text').innerHTML = ANN[annI]; }
  $$('[data-announce]').forEach(b => b.addEventListener('click', () => { setAnn(+b.dataset.announce); restartAnn(); }));
  function restartAnn() { clearInterval(annTimer); if (!reduceMotion) annTimer = setInterval(() => setAnn(1), 5500); }
  $('.announce').addEventListener('mouseenter', () => clearInterval(annTimer));
  $('.announce').addEventListener('mouseleave', restartAnn);
  restartAnn();

  /* ================= Toast ================= */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    $('span', t).textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ================= Componenti ================= */
  function badgeHTML(p) {
    if (p.stock === 0) return '<span class="badge soldout">Esaurito</span>';
    if (p.compareAt) return `<span class="badge sale">−${Math.round((1 - p.price / p.compareAt) * 100)}%</span>`;
    if (p.badge === 'Nuovo') return '<span class="badge new">Nuovo</span>';
    if (p.badge) return `<span class="badge">${p.badge}</span>`;
    return '';
  }
  function priceHTML(p) {
    return `<div class="price"><span class="now ${p.compareAt ? 'sale' : ''}">${p.compareAt ? '<span class="visually-hidden">Prezzo scontato </span>' : ''}${money(p.price)}</span>${p.compareAt ? `<s><span class="visually-hidden">Prezzo pieno </span>${money(p.compareAt)}</s>` : ''}</div>`;
  }
  function cardHTML(p, glaze) {
    glaze = glaze || p.glazes[0];
    const href = `#prodotto-${p.handle}.${glaze}`;
    return `<article class="card" data-card="${p.handle}" data-glaze="${glaze}">
      <div class="card-media">
        ${badgeHTML(p)}
        <a href="${href}" class="main" tabindex="-1" aria-hidden="true">${art(p, glaze, 0)}</a>
        <a href="${href}" class="alt" tabindex="-1" aria-hidden="true">${art(p, glaze, 2)}</a>
        ${p.stock > 0 ? `<button class="quick-add" type="button" data-add="${p.handle}" data-glaze="${glaze}" aria-label="Aggiungi ${esc(p.title)} (${G[glaze].name}) al carrello">${icon('plus')}<span>Aggiungi al carrello</span></button>` : ''}
      </div>
      <div class="card-info">
        <h3><a href="${href}">${esc(p.title)}</a></h3>
        <div class="rating-mini">${stars(p.rating)}<span>${p.rating.toFixed(1).replace('.', ',')} (${p.reviews})</span></div>
        ${priceHTML(p)}
        <div class="swatches" role="group" aria-label="Smalti disponibili">${p.glazes.map(g => `<button type="button" class="swatch-dot" style="background:${G[g].color}" data-card-swatch="${g}" aria-pressed="${g === glaze}" aria-label="${G[g].name}" title="${G[g].name}"></button>`).join('')}</div>
      </div>
    </article>`;
  }

  /* ================= Viste ================= */
  function route() {
    const h = decodeURIComponent(location.hash.slice(1)) || 'home';
    if (h.startsWith('collezione-')) return { view: 'collezione', arg: h.slice(11) };
    if (h.startsWith('prodotto-')) { const [handle, glaze] = h.slice(9).split('.'); return { view: 'prodotto', arg: handle, glaze }; }
    return { view: h };
  }

  const main = $('#main');
  let cleanup = [];
  function render() {
    cleanup.forEach(f => f()); cleanup = [];
    closeMega();
    if (openLayer) hideLayer(true);
    const r = route();
    const views = { home: viewHome, collezione: viewCollection, prodotto: viewProduct, carrello: viewCart, checkout: viewCheckout, ordine: viewOrder, storia: viewStory, aiuto: viewHelp };
    (views[r.view] || viewNotFound)(r);
    main.classList.remove('view-enter'); void main.offsetWidth; main.classList.add('view-enter');
    $$('.nav a').forEach(a => { if (a.getAttribute('href') === location.hash) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  window.addEventListener('hashchange', () => { render(); main.focus({ preventScroll: true }); });

  /* ---------- Home ---------- */
  function viewHome() {
    document.title = 'Argilla Ceramiche';
    const best = [...P].sort((a, b) => b.reviews - a.reviews);
    main.innerHTML = `
      <section class="hero">
        <div class="wrap">
          <div class="hero-copy reveal">
            <span class="eyebrow">Grès tornito a mano · cottura a 1.250 °C</span>
            <h1>Ceramica fatta per <em>essere usata</em> ogni giorno.</h1>
            <p class="lead">Tazze, piatti e vasi che escono uno alla volta dal nostro tornio. Vanno in lavastoviglie, reggono gli anni e non sono mai identici tra loro.</p>
            <div class="hero-ctas">
              <a class="btn" href="#collezione-tutti">Scopri il negozio ${icon('arrow').replace('<svg', '<svg width="18" height="18"')}</a>
              <a class="btn btn-ghost" href="#storia">Come lavoriamo</a>
            </div>
            <div class="trust">${stars(4.9)}<span><strong style="color:var(--ink)">4,9 su 5</strong> da 2.318 recensioni verificate</span></div>
          </div>
          <div class="hero-art">
            <div class="tile">${window.Art.hero()}</div>
            <div class="hero-stamp"><div><strong>38</strong>pezzi<br>al giorno</div></div>
          </div>
        </div>
      </section>

      <section class="usp" aria-label="I nostri impegni">
        <div class="wrap"><ul>
          <li>${icon('truck')}<div><strong>Spedizione gratuita</strong>sopra 80 € in tutta Italia</div></li>
          <li>${icon('return')}<div><strong>30 giorni per il reso</strong>ritiro a domicilio gratuito</div></li>
          <li>${icon('shield')}<div><strong>Arriva intatto</strong>o lo sostituiamo subito</div></li>
          <li>${icon('hand')}<div><strong>Fatto a mano</strong>firmato sotto la base</div></li>
        </ul></div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="section-head">
            <div><span class="eyebrow">I più amati</span><h2>Quello che finisce prima</h2></div>
            <div class="tabs" role="group" aria-label="Filtra i prodotti in evidenza">
              <button class="chip" type="button" data-tab="all" aria-pressed="true">Tutti</button>
              ${C.slice(0, 3).map(c => `<button class="chip" type="button" data-tab="${c.handle}" aria-pressed="false">${c.title}</button>`).join('')}
            </div>
          </div>
          <div class="grid" id="featured">${best.slice(0, 8).map(p => cardHTML(p)).join('')}</div>
          <p style="text-align:center;margin-top:40px"><a class="btn btn-ghost" href="#collezione-tutti">Vedi tutti i ${P.length} prodotti</a></p>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="section-head"><div><span class="eyebrow">Collezioni</span><h2>Una stanza alla volta</h2></div></div>
          <div class="collections">${C.map(c => `
            <a class="coll-card" href="#collezione-${c.handle}">
              <div class="media">${window.Art.product({ handle: c.handle, type: c.art.type, deco: c.art.deco, glazes: [c.art.glaze] }, c.art.glaze, { view: 0 })}</div>
              <div><h3>${c.title} ${icon('arrow')}</h3><p>${c.blurb}</p></div>
            </a>`).join('')}
          </div>
        </div>
      </section>

      <section class="section process">
        <div class="wrap process-grid">
          <div class="process-intro">
            <span class="eyebrow">Dal tornio alla tua tavola</span>
            <h2>Due settimane per ogni pezzo</h2>
            <p>Non abbiamo una linea di produzione. Ogni tazza passa per le mani di almeno due di noi e per due cotture nel forno della bottega. Per questo alcuni smalti vanno esauriti e tornano dopo qualche settimana.</p>
            <a class="btn btn-lemon" href="#storia" style="justify-self:start">Conosci la bottega</a>
          </div>
          <ol class="steps">
            <li><span class="n">Passo 1</span><h3>Impasto</h3><p>Grès porcellanato lavorato a mano per togliere l'aria, che in cottura farebbe crepare il pezzo.</p></li>
            <li><span class="n">Passo 2</span><h3>Tornio</h3><p>Ogni forma nasce al tornio. Una tazza richiede circa 6 minuti, un vaso Anfora quasi un'ora.</p></li>
            <li><span class="n">Passo 3</span><span class="temp">5 giorni</span><h3>Essiccazione</h3><p>Il pezzo asciuga lentamente su assi di legno, girato ogni mattina.</p></li>
            <li><span class="n">Passo 4</span><span class="temp">980 °C</span><h3>Prima cottura</h3><p>Il biscotto: l'argilla diventa ceramica e può assorbire lo smalto.</p></li>
            <li><span class="n">Passo 5</span><h3>Smaltatura</h3><p>Immersione, pennello o colatura. I decori si dipingono a mano, senza decalcomanie.</p></li>
            <li><span class="n">Passo 6</span><span class="temp">1.250 °C</span><h3>Seconda cottura</h3><p>Lo smalto vetrifica. Il pezzo diventa impermeabile, adatto ad alimenti e lavastoviglie.</p></li>
          </ol>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="section-head">
            <div><span class="eyebrow">Recensioni</span><h2>Cosa dicono a casa loro</h2></div>
            <div class="score"><strong>4,9</strong><div>${stars(4.9)}<div class="fine">2.318 recensioni verificate</div></div></div>
          </div>
          <div class="reviews">
            ${[
              ['Le tazze Mattino sono diventate quelle che tutti in famiglia si contendono a colazione. Il verde salvia dal vivo è ancora più bello.', 'Giulia · Bologna', 'tazza-mattino'],
              ['Il vaso è arrivato imballato in modo maniacale. Si vede la mano di chi l\'ha fatto: la base è firmata e datata.', 'Marco · Torino', 'vaso-anfora'],
              ['Ho regalato il set colazione a mia sorella. Il biglietto scritto a mano dentro la scatola ha fatto la differenza.', 'Chiara · Bari', 'set-colazione']
            ].map(([q, who, h]) => `<figure class="review">${stars(5)}<blockquote>“${q}”</blockquote>
              <footer><span>${who} <span class="verified">${icon('check')} Acquisto verificato</span></span><a href="#prodotto-${h}">${byHandle[h].title}</a></footer></figure>`).join('')}
          </div>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="promo">
            <div class="promo-copy">
              <span class="eyebrow">Per chi rifà la casa</span>
              <h2>15% di sconto sugli ordini sopra 120 €</h2>
              <p>Inserisci il codice nel checkout. Vale su tutto il negozio, set regalo compresi, fino al 30 novembre.</p>
              <div class="code"><span id="promo-code">CASA15</span><button type="button" data-copy="CASA15">Copia</button></div>
            </div>
            <div class="promo-media">${art(byHandle['set-aperitivo'], 'terracotta', 2)}</div>
          </div>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="wrap newsletter">
          <span class="eyebrow">Lettere dalla bottega</span>
          <h2>Il 10% sul primo ordine</h2>
          <p>Una mail al mese: nuovi smalti appena usciti dal forno, pezzi unici e il calendario dei mercatini dove ci trovi.</p>
          <form class="inline-form" id="news-form" novalidate>
            <div class="field"><label class="visually-hidden" for="news-email">Email</label><input id="news-email" type="email" placeholder="La tua email" autocomplete="email" required></div>
            <button class="btn" type="submit">Iscriviti</button>
          </form>
          <p class="form-msg" id="news-msg" role="status"></p>
        </div>
      </section>`;

    $$('[data-tab]').forEach(b => b.addEventListener('click', () => {
      $$('[data-tab]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const list = b.dataset.tab === 'all' ? best : best.filter(p => p.collections.includes(b.dataset.tab));
      $('#featured').innerHTML = list.slice(0, 8).map(p => cardHTML(p)).join('');
    }));
    $('#news-form').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#news-email').value.trim(), msg = $('#news-msg');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { msg.className = 'form-msg err'; msg.textContent = 'Controlla l\'indirizzo: sembra mancare una parte, ad esempio nome@dominio.it'; return; }
      msg.className = 'form-msg ok'; msg.textContent = 'Iscrizione fatta. Il tuo codice è BENVENUTO10: inseriscilo al checkout.';
      e.target.reset();
    });
  }

  /* ---------- Collezione ---------- */
  const SINGULAR = { tazza: 'Tazza', piatto: 'Piatto', ciotola: 'Ciotola', vaso: 'Vaso', brocca: 'Brocca', set: 'Set' };
  const TYPE_LABEL = { tazza: 'Tazze', piatto: 'Piatti', ciotola: 'Ciotole', vaso: 'Vasi', brocca: 'Brocche', set: 'Set' };
  function collectionProducts(handle) {
    return handle === 'tutti' ? P : P.filter(p => p.collections.includes(handle));
  }
  function applyFilters(list) {
    const f = state.filters;
    let out = list.filter(p =>
      (!f.types.size || f.types.has(p.type)) &&
      (!f.glazes.size || p.glazes.some(g => f.glazes.has(g))) &&
      p.price <= f.max && (!f.inStock || p.stock > 0) &&
      (!f.q || searchMatch(p, f.q)));
    const sorts = {
      featured: (a, b) => (b.stock > 0) - (a.stock > 0) || b.reviews * b.rating - a.reviews * a.rating,
      best: (a, b) => b.reviews - a.reviews,
      new: (a, b) => (b.badge === 'Nuovo') - (a.badge === 'Nuovo'),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      az: (a, b) => a.title.localeCompare(b.title, 'it')
    };
    return out.sort(sorts[f.sort]);
  }
  let currentColl = 'tutti';
  function renderFilters(target, prefix) {
    const list = collectionProducts(currentColl), f = state.filters;
    const types = [...new Set(list.map(p => p.type))];
    const glazes = Object.keys(G).filter(g => list.some(p => p.glazes.includes(g)));
    $(target).innerHTML = `
      <details class="filter-group" open><summary>Tipo ${icon('down')}</summary><div class="opts">
        ${types.map(t => `<label class="check"><input type="checkbox" data-f="types" value="${t}" ${f.types.has(t) ? 'checked' : ''} id="${prefix}-t-${t}"> ${TYPE_LABEL[t]}<span class="count">${list.filter(p => p.type === t).length}</span></label>`).join('')}
      </div></details>
      <details class="filter-group" open><summary>Smalto ${icon('down')}</summary><div class="opts">
        ${glazes.map(g => `<label class="check"><input type="checkbox" data-f="glazes" value="${g}" ${f.glazes.has(g) ? 'checked' : ''} id="${prefix}-g-${g}"><span class="sw" style="background:${G[g].color}"></span> ${G[g].name}<span class="count">${list.filter(p => p.glazes.includes(g)).length}</span></label>`).join('')}
      </div></details>
      <details class="filter-group" open><summary>Prezzo ${icon('down')}</summary>
        <div class="range"><label for="${prefix}-max">Fino a <strong data-max-label>${money(f.max)}</strong></label>
        <input type="range" id="${prefix}-max" min="1500" max="12000" step="500" value="${f.max}" data-f="max"></div>
      </details>
      <details class="filter-group" open><summary>Disponibilità ${icon('down')}</summary><div class="opts">
        <label class="check"><input type="checkbox" data-f="inStock" ${f.inStock ? 'checked' : ''} id="${prefix}-stock"> Solo disponibili subito</label>
      </div></details>`;
  }
  function onFilterInput(e) {
    const el = e.target, k = el.dataset.f, f = state.filters;
    if (!k) return;
    if (k === 'types' || k === 'glazes') el.checked ? f[k].add(el.value) : f[k].delete(el.value);
    if (k === 'max') { f.max = +el.value; $$('[data-max-label]').forEach(x => { x.textContent = money(f.max); }); $$('[data-f="max"]').forEach(x => { x.value = f.max; }); }
    if (k === 'inStock') f.inStock = el.checked;
    if (el.closest('#filter-body')) renderFilters('.coll-layout > .filters', 'd'); else if ($('#filter-body').innerHTML) renderFilters('#filter-body', 'm');
    renderGrid();
  }
  document.addEventListener('change', e => { if (e.target.dataset.f) onFilterInput(e); });
  document.addEventListener('input', e => { if (e.target.dataset.f === 'max') onFilterInput(e); });

  function renderGrid() {
    const list = applyFilters(collectionProducts(currentColl)), f = state.filters;
    $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'prodotto' : 'prodotti'}`;
    const chips = [];
    if (f.q) chips.push(['q', '', `“${f.q}”`]);
    f.types.forEach(t => chips.push(['types', t, TYPE_LABEL[t]]));
    f.glazes.forEach(g => chips.push(['glazes', g, G[g].name]));
    if (f.max < 12000) chips.push(['max', '', `Fino a ${money(f.max)}`]);
    if (f.inStock) chips.push(['inStock', '', 'Disponibili']);
    $('#active-filters').innerHTML = chips.map(([k, v, l]) => `<button class="chip" type="button" data-unfilter="${k}" data-v="${v}" aria-label="Rimuovi filtro ${esc(l)}">${esc(l)} ${icon('close')}</button>`).join('') +
      (chips.length > 1 ? '<button class="chip" type="button" data-unfilter="all" style="text-decoration:underline;border-color:transparent">Rimuovi tutti</button>' : '');
    $('#active-filters').hidden = !chips.length;
    const glazePick = f.glazes.size === 1 ? [...f.glazes][0] : null;
    $('#coll-grid').innerHTML = list.length ? list.map(p => cardHTML(p, glazePick && p.glazes.includes(glazePick) ? glazePick : null)).join('')
      : `<div class="empty" style="grid-column:1/-1"><p style="font-family:var(--font-display);font-size:var(--step-2)">Nessun prodotto con questi filtri</p><p class="fine">Prova ad alzare il prezzo massimo o a togliere uno smalto.</p><button class="btn btn-ghost" type="button" data-unfilter="all">Rimuovi i filtri</button></div>`;
  }
  function resetFilters(keepQ) {
    const q = keepQ ? state.filters.q : '';
    state.filters = { types: new Set(), glazes: new Set(), max: 12000, inStock: false, sort: state.filters.sort, q };
  }

  function viewCollection(r) {
    const coll = C.find(c => c.handle === r.arg);
    const isAll = r.arg === 'tutti';
    if (!coll && !isAll) return viewNotFound();
    if (currentColl !== r.arg) { currentColl = r.arg; if (!pendingFilter) resetFilters(); }
    if (pendingFilter) { pendingFilter(); pendingFilter = null; }
    const title = isAll ? (state.filters.q ? `Risultati per “${state.filters.q}”` : 'Tutti i prodotti') : coll.title;
    document.title = `${isAll ? 'Negozio' : coll.title} · Argilla`;
    main.innerHTML = `
      <section class="coll-hero"><div class="wrap">
        <nav class="crumbs" aria-label="Percorso"><a href="#home">Home</a><span aria-hidden="true">/</span><span>${isAll ? 'Negozio' : coll.title}</span></nav>
        <h1>${esc(title)}</h1>
        <p>${isAll ? 'Tutto quello che esce dalla bottega: per la tavola, per il caffè, per la casa.' : coll.blurb}</p>
      </div></section>
      <div class="wrap coll-layout">
        <aside class="filters" aria-label="Filtri"></aside>
        <div style="min-width:0">
          <div class="toolbar">
            <button class="chip filter-btn" type="button" data-open="filters">${icon('filter').replace('<svg', '<svg width="16" height="16"')} Filtra</button>
            <span class="count" id="result-count" aria-live="polite"></span>
            <div class="toolbar-right">
              <label for="sort" class="fine">Ordina per</label>
              <select id="sort">
                ${[['featured', 'In evidenza'], ['best', 'Più venduti'], ['new', 'Novità'], ['price-asc', 'Prezzo crescente'], ['price-desc', 'Prezzo decrescente'], ['az', 'Nome, A–Z']].map(([v, l]) => `<option value="${v}" ${state.filters.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="active-filters" id="active-filters"></div>
          <div class="grid cols-3" id="coll-grid"></div>
        </div>
      </div>`;
    renderFilters('.coll-layout > .filters', 'd');
    $('#filter-body').innerHTML = '';
    $('#sort').addEventListener('change', e => { state.filters.sort = e.target.value; renderGrid(); });
    renderGrid();
  }
  let pendingFilter = null;

  /* ---------- Prodotto ---------- */
  function viewProduct(r) {
    const p = byHandle[r.arg];
    if (!p) return viewNotFound();
    let glaze = p.glazes.includes(r.glaze) ? r.glaze : p.glazes[0];
    let view = 0, qty = 1;
    document.title = `${p.title} · Argilla`;
    state.recent = [p.handle, ...state.recent.filter(h => h !== p.handle)].slice(0, 6);
    store.set('recent', state.recent);
    const coll = C.find(c => c.handle === p.collections[0]);
    const VIEWS = ['Vista frontale', 'Dettaglio dello smalto', 'In ambiente'];
    const food = ['tazza', 'piatto', 'ciotola', 'set', 'brocca'].includes(p.type);
    const same = P.filter(x => x.handle !== p.handle && x.collections.some(c => p.collections.includes(c)));
    const related = [...same, ...P.filter(x => x.handle !== p.handle && !same.includes(x) && x.stock > 0)].slice(0, 4);
    const recent = state.recent.filter(h => h !== p.handle && byHandle[h]).slice(0, 4);
    const d5 = Math.min(98, Math.round((p.rating - 4) * 90 + 8)), d3 = p.rating < 4.8 ? 3 : 1, d2 = p.rating < 4.7 ? 1 : 0;
    const dist = [[5, d5], [4, 100 - d5 - d3 - d2], [3, d3], [2, d2], [1, 0]];

    main.innerHTML = `
      <div class="wrap">
        <nav class="crumbs" aria-label="Percorso" style="padding-top:20px"><a href="#home">Home</a><span aria-hidden="true">/</span><a href="#collezione-${coll.handle}">${coll.title}</a><span aria-hidden="true">/</span><span>${esc(p.title)}</span></nav>
        <div class="pdp">
          <div class="gallery">
            <div class="thumbs" role="group" aria-label="Immagini"></div>
            <div>
              <div class="stage" id="stage" tabindex="0" aria-label="Galleria immagini, scorri per vedere le altre"></div>
              <div class="dots" id="dots"></div>
            </div>
          </div>
          <div class="pdp-info">
            <div style="display:grid;gap:10px">
              <span class="eyebrow">Argilla · ${SINGULAR[p.type]}</span>
              <h1>${esc(p.title)}</h1>
              <a href="#recensioni" class="rating-mini" style="text-decoration:none">${stars(p.rating)}<span>${p.rating.toFixed(1).replace('.', ',')} · ${p.reviews} recensioni</span></a>
            </div>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">${priceHTML(p)}${p.compareAt ? `<span class="save">Risparmi ${money(p.compareAt - p.price)}</span>` : ''}</div>
            <p class="fine" style="margin-top:-12px">IVA inclusa. <a href="#aiuto">Spedizione</a> calcolata al checkout.</p>
            <div>
              <p class="opt-label" id="glaze-label">Smalto: <span id="glaze-name">${G[glaze].name}</span></p>
              <div class="swatch-row" role="radiogroup" aria-labelledby="glaze-label">
                ${p.glazes.map(g => `<button type="button" role="radio" class="swatch" style="background:${G[g].color}" data-glaze-pick="${g}" aria-checked="${g === glaze}" aria-label="${G[g].name}" title="${G[g].name}"></button>`).join('')}
              </div>
            </div>
            ${p.stock > 0 ? `
            <div>
              <p class="opt-label">Quantità</p>
              <div class="buy-row">
                <div class="qty lg" role="group" aria-label="Quantità">
                  <button type="button" data-pq="-1" aria-label="Diminuisci">${icon('minus')}</button>
                  <input type="number" id="pdp-qty" inputmode="numeric" min="1" max="${p.stock}" value="1" aria-label="Quantità">
                  <button type="button" data-pq="1" aria-label="Aumenta">${icon('plus')}</button>
                </div>
                <button class="btn" type="button" id="add-btn">${icon('bag').replace('<svg', '<svg width="18" height="18"')} Aggiungi al carrello</button>
              </div>
            </div>
            <button class="btn btn-ghost btn-block" type="button" id="buy-now">Acquista ora</button>
            <p class="stock ${p.stock <= 9 ? 'low' : ''}"><span class="dot"></span>${p.stock <= 9 ? `Ne restano solo ${p.stock} in questo lotto` : 'Disponibile, spedito entro 2 giorni lavorativi'}</p>`
            : `
            <p class="stock out"><span class="dot"></span>Esaurito: il prossimo lotto esce dal forno tra circa 3 settimane</p>
            <form class="inline-form" id="notify-form" novalidate style="max-width:none;margin:0">
              <div class="field"><label class="visually-hidden" for="notify-email">Email</label><input id="notify-email" type="email" placeholder="La tua email" autocomplete="email"></div>
              <button class="btn" type="submit">Avvisami</button>
            </form>
            <p class="form-msg" id="notify-msg" role="status"></p>`}
            <div class="perks">
              <div>${icon('truck')}<span>Consegna stimata in <strong>${deliveryWindow()}</strong></span></div>
              <div>${icon('return')}<span>Reso gratuito entro 30 giorni</span></div>
              <div>${icon('gift')}<span>Confezione regalo gratuita, da scegliere al checkout</span></div>
            </div>
            <div class="accordion">
              <details open><summary>Descrizione ${icon('plus')}</summary><div class="content"><p>${esc(p.desc)}</p></div></details>
              <details><summary>Dettagli e dimensioni ${icon('plus')}</summary><div class="content"><dl>
                <dt>Materiale</dt><dd>Grès porcellanato, cotto a 1.250 °C</dd>
                <dt>Misure</dt><dd>${esc(p.dims)}</dd>
                <dt>Smalto</dt><dd id="dl-glaze">${G[glaze].name}, senza piombo né cadmio</dd>
                <dt>Lavastoviglie</dt><dd>${food ? 'Sì, programma fino a 60 °C' : 'Non necessaria: si pulisce con un panno umido'}</dd>
                <dt>Microonde</dt><dd>${food ? 'Sì' : 'No'}</dd>
              </dl><p class="fine">Le misure possono variare di qualche millimetro: è il segno della lavorazione a mano.</p></div></details>
              <details><summary>Cura del pezzo ${icon('plus')}</summary><div class="content"><p>Evita gli sbalzi di temperatura forti, ad esempio dal frigorifero al forno caldo. Per le macchie di caffè o tè basta un po' di bicarbonato. Non usare spugne abrasive sulle parti in argilla cruda.</p></div></details>
              <details><summary>Spedizioni e resi ${icon('plus')}</summary><div class="content"><p>Spediamo con corriere in 24–48 ore lavorative, imballato in cartone ondulato e carta riciclata. Gratis sopra 80 €, altrimenti 5,90 €. Se cambi idea hai 30 giorni per il reso, con ritiro a domicilio gratuito.</p></div></details>
            </div>
          </div>
        </div>
      </div>

      <section class="section" id="recensioni" style="padding-top:24px">
        <div class="wrap">
          <div class="section-head"><div><span class="eyebrow">Recensioni</span><h2>${p.reviews} persone lo usano già</h2></div></div>
          <div class="reviews">
            <div class="review"><div class="score"><strong>${p.rating.toFixed(1).replace('.', ',')}</strong><div>${stars(p.rating)}<div class="fine">su ${p.reviews} recensioni</div></div></div>
              <div style="display:grid;gap:6px">${dist.map(([s, pc]) => `<div style="display:grid;grid-template-columns:28px 1fr 36px;gap:10px;align-items:center;font-size:var(--step--1)"><span>${s} ★</span><div class="ship-meter"><div class="bar"><span style="width:${Math.max(0, pc)}%"></span></div></div><span style="text-align:right;font-variant-numeric:tabular-nums">${Math.max(0, pc)}%</span></div>`).join('')}</div>
            </div>
            ${[[`Lo smalto ${G[p.glazes[0]].name.toLowerCase()} cambia con la luce: la mattina sembra un altro colore. Qualità altissima.`, 'Francesca · Milano'],
               ['Spedizione velocissima e imballo perfetto. Si sente il peso giusto in mano, non è la solita ceramica da supermercato.', 'Luca · Napoli']]
              .map(([q, who]) => `<figure class="review">${stars(5)}<blockquote>“${q}”</blockquote><footer><span>${who}</span><span class="verified">${icon('check')} Verificato</span></footer></figure>`).join('')}
          </div>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="wrap">
          <div class="section-head"><div><span class="eyebrow">Della stessa collezione</span><h2>Sta bene insieme a</h2></div><a class="link-arrow" href="#collezione-${coll.handle}">Tutta la collezione ${coll.title}</a></div>
          <div class="grid">${related.map(x => cardHTML(x)).join('')}</div>
        </div>
      </section>
      ${recent.length ? `<section class="section" style="padding-top:0"><div class="wrap">
        <div class="section-head"><div><span class="eyebrow">Visti di recente</span><h2>Ci stavi pensando</h2></div></div>
        <div class="grid">${recent.map(h => cardHTML(byHandle[h])).join('')}</div></div></section>` : ''}

      <div class="sticky-buy" id="sticky-buy" aria-hidden="true">
        <div class="media" id="sticky-media"></div>
        <div class="t"><strong>${esc(p.title)}</strong><span id="sticky-glaze">${G[glaze].name}</span> · ${money(p.price)}</div>
        ${p.stock > 0 ? `<button class="btn" type="button" id="sticky-add" tabindex="-1">Aggiungi</button>` : ''}
      </div>`;

    function paintGallery() {
      $('.thumbs').innerHTML = VIEWS.map((l, i) => `<button type="button" data-view="${i}" aria-current="${i === view}" aria-label="${l}">${art(p, glaze, i)}</button>`).join('');
      $('#stage').innerHTML = VIEWS.map((l, i) => `<div class="slide ${i === view ? 'active' : ''}">${art(p, glaze, i, `${p.title}, smalto ${G[glaze].name}: ${l.toLowerCase()}`)}</div>`).join('') +
        `<span class="zoom-hint">${icon('zoom')} ${VIEWS[view]}</span>`;
      $('#dots').innerHTML = VIEWS.map((l, i) => `<button type="button" data-dot="${i}" aria-current="${i === view}" aria-label="Immagine ${i + 1}: ${l}"></button>`).join('');
      $('#sticky-media').innerHTML = art(p, glaze, 0);
    }
    function setView(i, scroll) {
      view = i;
      $$('.thumbs button').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
      $$('#dots button').forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
      $$('#stage .slide').forEach((s, j) => s.classList.toggle('active', j === i));
      const hint = $('#stage .zoom-hint'); if (hint) hint.lastChild.textContent = ' ' + VIEWS[i];
      if (scroll) { const st = $('#stage'); st.scrollTo({ left: st.clientWidth * i, behavior: reduceMotion ? 'auto' : 'smooth' }); }
    }
    paintGallery();

    $('.thumbs').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(+b.dataset.view); });
    $('#dots').addEventListener('click', e => { const b = e.target.closest('[data-dot]'); if (b) setView(+b.dataset.dot, true); });
    $('#stage').addEventListener('scroll', e => { const st = e.target; if (st.scrollWidth > st.clientWidth) { const i = Math.round(st.scrollLeft / st.clientWidth); if (i !== view) setView(i); } }, { passive: true });
    $('#stage').addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') setView((view + 1) % 3, true);
      if (e.key === 'ArrowLeft') setView((view + 2) % 3, true);
    });

    $$('[data-glaze-pick]').forEach(b => b.addEventListener('click', () => {
      glaze = b.dataset.glazePick;
      $$('[data-glaze-pick]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      $('#glaze-name').textContent = G[glaze].name;
      $('#sticky-glaze').textContent = G[glaze].name;
      $('#dl-glaze').textContent = `${G[glaze].name}, senza piombo né cadmio`;
      try { history.replaceState(null, '', `#prodotto-${p.handle}.${glaze}`); } catch (err) { /* frame senza history */ }
      paintGallery(); setView(view, true);
    }));
    $('.swatch-row').addEventListener('keydown', e => {
      if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      const all = $$('[data-glaze-pick]'), i = all.indexOf(document.activeElement);
      const next = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
      next.focus(); next.click();
    });

    if (p.stock > 0) {
      const qi = $('#pdp-qty');
      const clamp = v => Math.max(1, Math.min(p.stock, v | 0 || 1));
      $$('[data-pq]').forEach(b => b.addEventListener('click', () => { qi.value = clamp(+qi.value + +b.dataset.pq); }));
      qi.addEventListener('change', () => { qi.value = clamp(+qi.value); });
      const add = (btn) => {
        addToCart(p.handle, glaze, clamp(+qi.value));
        const orig = btn.innerHTML;
        btn.innerHTML = `${icon('check').replace('<svg', '<svg width="18" height="18"')} Aggiunto`;
        setTimeout(() => { btn.innerHTML = orig; }, 1600);
        open('cart');
      };
      $('#add-btn').addEventListener('click', e => add(e.currentTarget));
      $('#sticky-add').addEventListener('click', e => add(e.currentTarget));
      $('#buy-now').addEventListener('click', () => { addToCart(p.handle, glaze, clamp(+qi.value)); location.hash = 'checkout'; });

      const sb = $('#sticky-buy');
      const io = new IntersectionObserver(([en]) => {
        const show = !en.isIntersecting && en.boundingClientRect.top < 0;
        sb.classList.toggle('show', show);
        sb.setAttribute('aria-hidden', String(!show));
        $('#sticky-add').tabIndex = show ? 0 : -1;
      });
      io.observe($('#add-btn'));
      cleanup.push(() => io.disconnect());
    } else {
      $('#notify-form').addEventListener('submit', e => {
        e.preventDefault();
        const v = $('#notify-email').value.trim(), m = $('#notify-msg');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { m.className = 'form-msg err'; m.textContent = 'Inserisci un indirizzo email valido, ad esempio nome@dominio.it'; return; }
        m.className = 'form-msg ok'; m.textContent = `Ti scriveremo a ${v} appena ${p.title} torna disponibile.`;
      });
    }
  }

  function deliveryWindow() {
    const add = n => { const d = new Date(); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) k++; } return d; };
    const f = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${f.format(add(2))} – ${f.format(add(4))}`;
  }

  /* ---------- Carrello (pagina) ---------- */
  function viewCart() {
    document.title = 'Carrello · Argilla';
    main.innerHTML = '<div class="wrap" id="cart-page"></div>';
    renderCartPage();
  }
  function renderCartPage() {
    const el = $('#cart-page');
    if (!el) return;
    if (!state.cart.length) { el.innerHTML = `<div style="padding-block:48px">${emptyCartHTML()}</div>`; return; }
    const t = totals();
    el.innerHTML = `<div class="cart-page">
      <div style="min-width:0">
        <h1>Il tuo carrello</h1>
        ${shipMeter()}
        <ul class="line-items" style="margin-top:28px">${state.cart.map(lineHTML).join('')}</ul>
        <div class="field" style="margin-top:24px;max-width:520px"><label for="cart-note">Note per la bottega</label><textarea id="cart-note" placeholder="Es. è un regalo, non inserire lo scontrino">${esc(state.note)}</textarea></div>
      </div>
      <aside class="summary" aria-label="Riepilogo">
        <h2>Riepilogo</h2>
        <div class="row"><span>Subtotale</span><span>${money(t.sub)}</span></div>
        ${t.disc ? `<div class="row"><span>Sconto ${esc(state.discount)}</span><span class="discount">−${money(t.disc)}</span></div>` : ''}
        <div class="row"><span>Spedizione</span><span>${t.ship ? money(t.ship) : 'Gratuita'}</span></div>
        <div class="row total"><span>Totale</span><span>${money(t.total)}</span></div>
        <p class="fine">Di cui IVA 22%: ${money(t.vat)}</p>
        <a class="btn btn-block" href="#checkout">Procedi al checkout</a>
        <a class="link-arrow" href="#collezione-tutti" style="text-align:center">Continua lo shopping</a>
      </aside></div>`;
    $('#cart-note').addEventListener('input', e => { state.note = e.target.value; store.set('note', state.note); });
  }

  /* ---------- Checkout ---------- */
  function viewCheckout() {
    document.title = 'Checkout · Argilla';
    if (!state.cart.length) { main.innerHTML = `<div class="wrap" style="padding-block:48px">${emptyCartHTML()}</div>`; return; }
    const saved = store.get('address', {});
    const v = k => esc(saved[k] || '');
    main.innerHTML = `
      <div class="checkout">
        <form class="checkout-main" id="co-form" novalidate>
          <div style="display:grid;gap:10px">
            <nav class="steps-nav" aria-label="Passaggi"><a href="#carrello">Carrello</a><span aria-hidden="true">›</span><strong style="color:var(--ink)">Dati e spedizione</strong><span aria-hidden="true">›</span><span>Conferma</span></nav>
            <h1>Checkout</h1>
          </div>
          <div class="demo-flag">${icon('info')}<span>Questo è un negozio dimostrativo: puoi completare l'ordine per vedere il flusso, ma non viene addebitato nulla e non ti chiediamo i dati della carta.</span></div>
          <fieldset style="border:0;padding:0;margin:0"><legend><h2>Contatto</h2></legend>
            <div class="form-grid">
              <div class="field" data-req="email"><label for="co-email">Email</label><input id="co-email" type="email" autocomplete="email" value="${v('email')}" placeholder="nome@dominio.it"><span class="hint">Qui ti mandiamo la conferma e il link di tracciamento.</span></div>
            </div>
          </fieldset>
          <fieldset style="border:0;padding:0;margin:0"><legend><h2>Consegna</h2></legend>
            <div class="form-grid">
              <div class="field half" data-req="nome"><label for="co-nome">Nome</label><input id="co-nome" autocomplete="given-name" value="${v('nome')}"></div>
              <div class="field half" data-req="cognome"><label for="co-cognome">Cognome</label><input id="co-cognome" autocomplete="family-name" value="${v('cognome')}"></div>
              <div class="field" data-req="via"><label for="co-via">Indirizzo</label><input id="co-via" autocomplete="address-line1" value="${v('via')}" placeholder="Via e numero civico"></div>
              <div class="field"><label for="co-extra">Interno, scala, citofono <span class="hint">(facoltativo)</span></label><input id="co-extra" autocomplete="address-line2" value="${v('extra')}"></div>
              <div class="field third" data-req="cap"><label for="co-cap">CAP</label><input id="co-cap" inputmode="numeric" maxlength="5" autocomplete="postal-code" value="${v('cap')}"></div>
              <div class="field third" data-req="citta"><label for="co-citta">Città</label><input id="co-citta" autocomplete="address-level2" value="${v('citta')}"></div>
              <div class="field third" data-req="prov"><label for="co-prov">Provincia</label><input id="co-prov" maxlength="2" autocomplete="address-level1" value="${v('prov')}" placeholder="Es. BO" style="text-transform:uppercase"></div>
              <div class="field"><label for="co-tel">Telefono <span class="hint">(facoltativo, per il corriere)</span></label><input id="co-tel" type="tel" autocomplete="tel" value="${v('tel')}"></div>
            </div>
          </fieldset>
          <fieldset style="border:0;padding:0;margin:0"><legend><h2>Metodo di spedizione</h2></legend>
            <div class="radio-cards" id="ship-opts"></div>
          </fieldset>
          <fieldset style="border:0;padding:0;margin:0"><legend><h2>Pagamento</h2></legend>
            <div class="radio-cards">
              ${[['card', 'Carta di credito o debito', 'Visa, Mastercard, American Express'], ['paypal', 'PayPal', 'Verrai reindirizzato a PayPal'], ['satispay', 'Satispay', 'Paghi dall\'app']].map(([k, l, s], i) => `
                <label class="radio-card"><input type="radio" name="pay" value="${k}" ${i === 0 ? 'checked' : ''} id="pay-${k}"><span class="grow">${l}<span class="sub">${s}</span></span></label>`).join('')}
              <div class="pay-note">Nel negozio vero qui comparirebbe il modulo sicuro di Shopify Payments. In questa demo il pagamento viene simulato.</div>
            </div>
          </fieldset>
          <label class="check"><input type="checkbox" id="co-gift"> Aggiungi la confezione regalo gratuita con biglietto scritto a mano</label>
          <div style="display:grid;gap:10px">
            <button class="btn btn-block" type="submit" id="co-submit" style="min-height:56px;font-size:var(--step-1)">Conferma l'ordine</button>
            <p class="form-msg err" id="co-err" role="alert"></p>
          </div>
        </form>
        <aside class="checkout-side" aria-label="Riepilogo dell'ordine"><div class="inner" id="co-side"></div></aside>
      </div>`;
    renderShipOpts();
    renderCheckoutSide();
    $('#ship-opts').addEventListener('change', e => { state.shipping = e.target.value; renderCheckoutSide(); });
    $('#co-prov').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    $('#co-cap').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
    $('#co-form').addEventListener('input', e => { const f = e.target.closest('.field'); if (f && f.classList.contains('invalid')) validateField(f); });
    $('#co-form').addEventListener('focusout', e => { const f = e.target.closest('.field[data-req]'); if (f && e.target.value) validateField(f); });
    $('#co-form').addEventListener('submit', submitOrder);
  }
  function renderShipOpts() {
    const t = totals('standard');
    $('#ship-opts').innerHTML = [
      ['standard', 'Corriere standard', '2–4 giorni lavorativi', t.ship ? money(t.ship) : 'Gratuita'],
      ['express', 'Corriere espresso', '1–2 giorni lavorativi, consegna entro le 13', money(990)]
    ].map(([k, l, s, pr]) => `<label class="radio-card"><input type="radio" name="ship" value="${k}" ${state.shipping === k ? 'checked' : ''} id="ship-${k}"><span class="grow">${l}<span class="sub">${s}</span></span><strong>${pr}</strong></label>`).join('');
  }
  function renderCheckoutSide() {
    const el = $('#co-side');
    if (!el) return;
    if (!state.cart.length) { render(); return; }
    const t = totals();
    el.innerHTML = `
      <div style="display:grid;gap:16px">${state.cart.map(l => { const p = byHandle[l.handle]; return `<div class="co-line"><div class="media"><span class="q">${l.qty}</span><div>${art(p, l.glaze, 0)}</div></div><div><strong style="font-weight:600">${esc(p.title)}</strong><div class="fine">${G[l.glaze].name}</div></div><span style="font-variant-numeric:tabular-nums">${money(p.price * l.qty)}</span></div>`; }).join('')}</div>
      <form class="discount-form" id="disc-form" novalidate>
        <div class="field"><label class="visually-hidden" for="disc-code">Codice sconto</label><input id="disc-code" placeholder="Codice sconto" value="${state.discount && !t.codeOk ? esc(state.discount) : ''}" autocomplete="off" style="text-transform:uppercase"></div>
        <button class="btn btn-ghost" type="submit">Applica</button>
      </form>
      ${state.discount ? `<div class="chip" style="justify-self:start;gap:10px">${esc(CODES[state.discount] ? CODES[state.discount].label : state.discount)} <button type="button" id="disc-remove" style="border:0;background:none;padding:0;display:grid" aria-label="Rimuovi il codice">${icon('close').replace('<svg', '<svg width="14" height="14"')}</button></div>` : ''}
      <p class="form-msg ${t.codeOk ? 'ok' : 'err'}" id="disc-msg" role="status">${state.discount && !t.codeOk ? `Il codice ${esc(state.discount)} vale sopra ${money(CODES[state.discount].min)} di subtotale.` : ''}</p>
      <div class="summary" style="position:static;background:transparent;border:0;padding:0">
        <div class="row"><span>Subtotale · ${cartCount()} ${cartCount() === 1 ? 'articolo' : 'articoli'}</span><span>${money(t.sub)}</span></div>
        ${t.disc ? `<div class="row"><span>Sconto</span><span class="discount">−${money(t.disc)}</span></div>` : ''}
        <div class="row"><span>Spedizione</span><span>${t.ship ? money(t.ship) : 'Gratuita'}</span></div>
        <div class="row total"><span>Totale</span><span><span class="fine" style="font-weight:400">EUR</span> ${money(t.total)}</span></div>
        <p class="fine">Comprende ${money(t.vat)} di IVA</p>
      </div>`;
    $('#disc-form').addEventListener('submit', e => {
      e.preventDefault();
      const code = $('#disc-code').value.trim().toUpperCase();
      if (!code) return;
      if (!CODES[code]) { $('#disc-msg').className = 'form-msg err'; $('#disc-msg').textContent = `Il codice ${code} non esiste o è scaduto. Prova BENVENUTO10.`; return; }
      state.discount = code; saveCart(); renderCart(); if ($('#ship-opts')) renderShipOpts();
      if (totals().codeOk) toast(`Codice ${code} applicato`);
    });
    const rm = $('#disc-remove');
    if (rm) rm.addEventListener('click', () => { state.discount = null; saveCart(); renderCart(); renderShipOpts(); });
  }
  const RULES = {
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || 'Inserisci un\'email valida, ad esempio nome@dominio.it',
    nome: v => v.length > 1 || 'Scrivi il nome di chi riceve il pacco',
    cognome: v => v.length > 1 || 'Scrivi il cognome',
    via: v => /\d/.test(v) && v.length > 4 || 'Aggiungi via e numero civico',
    cap: v => /^\d{5}$/.test(v) || 'Il CAP italiano ha 5 cifre',
    citta: v => v.length > 1 || 'Scrivi la città',
    prov: v => /^[A-Z]{2}$/.test(v) || 'Usa la sigla di 2 lettere, ad esempio MI'
  };
  function validateField(f) {
    const input = $('input', f), res = RULES[f.dataset.req](input.value.trim());
    let err = $('.err', f);
    if (res === true) { f.classList.remove('invalid'); input.removeAttribute('aria-invalid'); if (err) err.remove(); return true; }
    f.classList.add('invalid'); input.setAttribute('aria-invalid', 'true');
    if (!err) { err = document.createElement('span'); err.className = 'err'; err.id = input.id + '-err'; f.appendChild(err); input.setAttribute('aria-describedby', err.id); }
    err.textContent = res;
    return false;
  }
  function submitOrder(e) {
    e.preventDefault();
    const fields = $$('.field[data-req]', e.target);
    const bad = fields.filter(f => !validateField(f));
    if (bad.length) {
      $('#co-err').textContent = `Controlla ${bad.length === 1 ? 'il campo evidenziato' : `i ${bad.length} campi evidenziati`} prima di confermare.`;
      $('input', bad[0]).focus();
      return;
    }
    $('#co-err').textContent = '';
    const val = id => $('#co-' + id).value.trim();
    const addr = { email: val('email'), nome: val('nome'), cognome: val('cognome'), via: val('via'), extra: val('extra'), cap: val('cap'), citta: val('citta'), prov: val('prov'), tel: val('tel') };
    store.set('address', addr);
    const btn = $('#co-submit');
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Stiamo confermando…';
    setTimeout(() => {
      const t = totals();
      state.order = {
        number: 'AR-' + (1040 + Math.floor(Math.random() * 900)),
        addr, items: state.cart.map(l => ({ ...l })), totals: t, shipping: state.shipping, gift: $('#co-gift').checked,
        pay: $('input[name=pay]:checked').value, at: Date.now()
      };
      store.set('order', state.order);
      state.cart = []; state.discount = null; saveCart(); renderCart();
      location.hash = 'ordine';
    }, 900);
  }

  /* ---------- Conferma ordine ---------- */
  function viewOrder() {
    document.title = 'Ordine confermato · Argilla';
    const o = state.order;
    if (!o) { main.innerHTML = `<div class="wrap" style="padding-block:48px"><div class="empty"><p style="font-family:var(--font-display);font-size:var(--step-2)">Nessun ordine recente</p><a class="btn" href="#collezione-tutti">Vai al negozio</a></div></div>`; return; }
    const payLabel = { card: 'Carta (simulato)', paypal: 'PayPal (simulato)', satispay: 'Satispay (simulato)' }[o.pay];
    main.innerHTML = `<div class="wrap"><div class="thanks">
      <div class="thanks-head"><span class="ok-ring">${icon('check')}</span><div><span class="eyebrow">Ordine ${o.number}</span><h1>Grazie, ${esc(o.addr.nome)}!</h1></div></div>
      <div class="panel">
        <h2 style="font-size:var(--step-2)">L'ordine è confermato</h2>
        <p class="fine" style="font-size:var(--step-0)">Abbiamo mandato il riepilogo a <strong style="color:var(--ink)">${esc(o.addr.email)}</strong>. Prepariamo il pacco a mano: ti scriviamo di nuovo quando parte.</p>
        <ol class="timeline">
          <li class="done"><span><strong>Ordine ricevuto</strong>Adesso</span></li>
          <li><span><strong>Imballato in bottega</strong>Entro 1–2 giorni lavorativi${o.gift ? ', con confezione regalo' : ''}</span></li>
          <li><span><strong>In consegna</strong>${o.shipping === 'express' ? 'Corriere espresso, 1–2 giorni' : `Previsto ${deliveryWindow()}`}</span></li>
        </ol>
      </div>
      <div class="panel">
        <h2 style="font-size:var(--step-1)">Riepilogo</h2>
        ${o.items.map(l => { const p = byHandle[l.handle]; return `<div class="co-line"><div class="media"><span class="q">${l.qty}</span><div>${art(p, l.glaze, 0)}</div></div><div><strong style="font-weight:600">${esc(p.title)}</strong><div class="fine">${G[l.glaze].name}</div></div><span>${money(p.price * l.qty)}</span></div>`; }).join('')}
        <div class="summary" style="position:static;border:0;padding:0;background:transparent">
          ${o.totals.disc ? `<div class="row"><span>Sconto</span><span class="discount">−${money(o.totals.disc)}</span></div>` : ''}
          <div class="row"><span>Spedizione</span><span>${o.totals.ship ? money(o.totals.ship) : 'Gratuita'}</span></div>
          <div class="row total"><span>Totale</span><span>${money(o.totals.total)}</span></div>
        </div>
      </div>
      <div class="panel" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div><p class="eyebrow">Spedizione a</p><p>${esc(o.addr.nome)} ${esc(o.addr.cognome)}<br>${esc(o.addr.via)}${o.addr.extra ? ', ' + esc(o.addr.extra) : ''}<br>${esc(o.addr.cap)} ${esc(o.addr.citta)} (${esc(o.addr.prov)})</p></div>
        <div><p class="eyebrow">Pagamento</p><p>${payLabel}</p></div>
      </div>
      <a class="btn" href="#collezione-tutti" style="justify-self:start">Continua lo shopping</a>
    </div></div>`;
  }

  /* ---------- Storia / Aiuto ---------- */
  function viewStory() {
    document.title = 'La bottega · Argilla';
    main.innerHTML = `
      <section class="coll-hero"><div class="wrap"><nav class="crumbs" aria-label="Percorso"><a href="#home">Home</a><span aria-hidden="true">/</span><span>La bottega</span></nav></div></section>
      <div class="wrap section" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:48px;align-items:start">
        <div class="prose">
          <span class="eyebrow">Dal 2014</span>
          <h1>Quattro ceramisti, un forno, nessuna fretta.</h1>
          <p>Argilla è nata in un ex magazzino di biciclette, con un tornio usato e un forno elettrico da 120 litri. Oggi siamo in quattro, ma il metodo è lo stesso: ogni pezzo lo tocchiamo con le mani dall'inizio alla fine.</p>
          <div class="figures">
            <div><strong>38</strong><span>pezzi torniti al giorno, al massimo</span></div>
            <div><strong>1.250 °C</strong><span>la temperatura della seconda cottura</span></div>
            <div><strong>0</strong><span>decalcomanie: i decori sono tutti a pennello</span></div>
          </div>
          <h2>Perché il grès</h2>
          <p>È più resistente della terracotta e meno fragile della porcellana. Cotto ad alta temperatura diventa compatto e impermeabile: per questo le nostre tazze vanno in lavastoviglie e durano anni.</p>
          <h2>Perché ogni pezzo è diverso</h2>
          <p>Gli smalti reagiscono al calore in modo sempre un po' diverso. La stessa tazza può uscire più chiara in alto nel forno e più scura in basso. Non lo consideriamo un difetto, ma la firma del fuoco.</p>
          <a class="btn" href="#collezione-tutti" style="justify-self:start">Guarda cosa è appena uscito dal forno</a>
        </div>
        <div style="aspect-ratio:4/5;border-radius:240px 240px var(--radius) var(--radius);overflow:hidden;position:sticky;top:110px">${art(byHandle['brocca-fonte'], 'salvia', 2, 'Brocca Fonte in smalto verde salvia su un tavolo di legno')}</div>
      </div>`;
  }
  function viewHelp() {
    document.title = 'Assistenza · Argilla';
    const faq = [
      ['Quanto costa la spedizione?', 'In Italia è gratuita sopra 80 € di ordine. Sotto questa soglia costa 5,90 € con corriere standard (2–4 giorni lavorativi). Il corriere espresso costa 9,90 € e consegna in 1–2 giorni.'],
      ['Spedite all\'estero?', 'Sì, in tutta l\'Unione Europea con tariffe da 12 €. I costi esatti compaiono al checkout dopo aver inserito l\'indirizzo.'],
      ['Come faccio un reso?', 'Hai 30 giorni dalla consegna. Scrivici con il numero d\'ordine: ti mandiamo l\'etichetta e il corriere passa a ritirare il pacco a casa, gratis. Il rimborso arriva entro 5 giorni dalla ricezione.'],
      ['Il pezzo è arrivato rotto: cosa faccio?', 'Fai una foto al pacco e al pezzo e mandacela entro 48 ore. Lo rispediamo subito senza chiederti di restituire nulla.'],
      ['Posso mettere le tazze in lavastoviglie e nel microonde?', 'Sì, tutti i pezzi da tavola sono adatti a lavastoviglie (fino a 60 °C) e microonde. Evita solo gli sbalzi termici forti, ad esempio dal congelatore al forno caldo.'],
      ['Perché il mio pezzo non è identico alla foto?', 'Ogni pezzo è tornito e smaltato a mano, quindi tono del colore e puntinatura cambiano leggermente. Le misure possono variare di qualche millimetro.'],
      ['Fate ordini per ristoranti o liste nozze?', 'Sì. Per forniture sopra i 50 pezzi o liste nozze scrivici a ciao@argilla.example: rispondiamo entro un giorno lavorativo.']
    ];
    main.innerHTML = `
      <section class="coll-hero"><div class="wrap"><nav class="crumbs" aria-label="Percorso"><a href="#home">Home</a><span aria-hidden="true">/</span><span>Assistenza</span></nav><h1>Assistenza</h1><p>Spedizioni, resi e cura della ceramica. Se non trovi la risposta, scrivici a ciao@argilla.example (lun–ven, 9:00–18:00).</p></div></section>
      <div class="wrap section"><div class="accordion" style="max-width:820px">
        ${faq.map(([q, a], i) => `<details ${i === 0 ? 'open' : ''}><summary>${q} ${icon('plus')}</summary><div class="content"><p>${a}</p></div></details>`).join('')}
      </div></div>`;
  }
  function viewNotFound() {
    document.title = 'Pagina non trovata · Argilla';
    main.innerHTML = `<div class="wrap" style="padding-block:72px"><div class="empty"><p class="eyebrow">Errore 404</p><h1 style="font-size:var(--step-3)">Questa pagina si è rotta in cottura</h1><p class="fine">Il link potrebbe essere vecchio o il prodotto non più in catalogo.</p><a class="btn" href="#collezione-tutti">Vai al negozio</a></div></div>`;
  }

  /* ================= Ricerca ================= */
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function searchMatch(p, q) {
    const hay = norm([p.title, TYPE_LABEL[p.type], p.desc, ...p.glazes.map(g => G[g].name), ...p.collections.map(c => (C.find(x => x.handle === c) || {}).title)].join(' '));
    return norm(q).split(/\s+/).filter(Boolean).every(w => hay.includes(w.replace(/e$|i$|a$/, '')));
  }
  function renderSearch(q) {
    $('#search-suggest').innerHTML = q ? '' : ['tazze', 'blu', 'vaso', 'regalo', 'salvia'].map(s => `<button class="chip" type="button" data-suggest="${s}">${s}</button>`).join('');
    const res = q ? P.filter(p => searchMatch(p, q)) : [];
    const hl = t => { const words = norm(q).split(/\s+/).filter(w => w.length > 1); let out = esc(t); words.forEach(w => { out = out.replace(new RegExp(`(${w.replace(/e$|i$|a$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>'); }); return out; };
    $('#search-results').innerHTML = !q ? '' : res.length
      ? res.map(p => `<a class="search-hit" href="#prodotto-${p.handle}"><div class="media">${art(p, p.glazes[0], 0)}</div><div><strong style="font-weight:600">${hl(p.title)}</strong><div class="fine">${TYPE_LABEL[p.type]} · ${money(p.price)}</div></div></a>`).join('') +
        `<a class="search-hit" href="#collezione-tutti" data-search-all style="grid-template-columns:1fr;font-weight:600">Vedi tutti i risultati per “${esc(q)}” →</a>`
      : `<p class="fine">Nessun risultato per “${esc(q)}”. Prova con “tazza”, “piatto” o il nome di un colore.</p>`;
  }
  $('#search-input').addEventListener('input', e => renderSearch(e.target.value.trim()));
  $('#search-form').addEventListener('submit', e => { e.preventDefault(); searchAll($('#search-input').value.trim()); });
  function searchAll(q) {
    pendingFilter = () => { resetFilters(); state.filters.q = q; };
    hideLayer(true);
    if (location.hash === '#collezione-tutti') render(); else location.hash = 'collezione-tutti';
  }

  /* ================= Eventi delegati ================= */
  document.addEventListener('click', e => {
    const t = e.target;
    const opener = t.closest('[data-open]');
    if (opener) { e.preventDefault(); open(opener.dataset.open); return; }
    if (t.closest('[data-close]')) { hideLayer(); return; }

    const add = t.closest('[data-add]');
    if (add) { e.preventDefault(); addToCart(add.dataset.add, add.dataset.glaze); if (!openLayer) open('cart'); return; }

    const sw = t.closest('[data-card-swatch]');
    if (sw) {
      const card = sw.closest('[data-card]'), p = byHandle[card.dataset.card], g = sw.dataset.cardSwatch;
      card.outerHTML = cardHTML(p, g);
      const fresh = $(`[data-card="${p.handle}"][data-glaze="${g}"] [data-card-swatch="${g}"]`); fresh && fresh.focus();
      return;
    }
    const q = t.closest('[data-qty]');
    if (q) { const i = +q.dataset.qty; setQty(i, state.cart[i].qty + +q.dataset.d); return; }

    const unf = t.closest('[data-unfilter]');
    if (unf) {
      const k = unf.dataset.unfilter, f = state.filters;
      if (k === 'all') resetFilters(); else if (k === 'types' || k === 'glazes') f[k].delete(unf.dataset.v); else if (k === 'max') f.max = 12000; else if (k === 'inStock') f.inStock = false; else if (k === 'q') f.q = '';
      if (k === 'q' || k === 'all') { render(); return; }
      renderFilters('.coll-layout > .filters', 'd'); renderGrid(); return;
    }
    const tl = t.closest('[data-type-link], [data-glaze-link]');
    if (tl) {
      e.preventDefault();
      pendingFilter = () => { resetFilters(); if (tl.dataset.typeLink) state.filters.types.add(tl.dataset.typeLink); else state.filters.glazes.add(tl.dataset.glazeLink); };
      if (location.hash === '#collezione-tutti') render(); else location.hash = 'collezione-tutti';
      return;
    }
    const sug = t.closest('[data-suggest]');
    if (sug) { $('#search-input').value = sug.dataset.suggest; renderSearch(sug.dataset.suggest); $('#search-input').focus(); return; }
    if (t.closest('[data-search-all]')) { e.preventDefault(); searchAll($('#search-input').value.trim()); return; }

    const cp = t.closest('[data-copy]');
    if (cp) {
      const code = cp.dataset.copy;
      const done = () => { cp.textContent = 'Copiato'; toast(`Codice ${code} copiato`); setTimeout(() => { cp.textContent = 'Copia'; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => selectText($('#promo-code'))); else selectText($('#promo-code'));
      return;
    }
    // Un link interno dentro un livello aperto lo chiude.
    if (openLayer && t.closest('a[href^="#"]')) hideLayer(true);
  });
  function selectText(el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Codice selezionato: copialo con Ctrl+C'); }
  document.addEventListener('change', e => {
    const qi = e.target.closest('[data-qty-input]');
    if (qi) setQty(+qi.dataset.qtyInput, Math.max(0, parseInt(qi.value, 10) || 0));
  });

  window.addEventListener('scroll', () => { $('#header').classList.toggle('scrolled', scrollY > 8); }, { passive: true });

  renderCart();
  render();
})();
