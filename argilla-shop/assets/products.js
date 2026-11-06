/* Catalogo del negozio. In un tema Shopify questi dati arrivano da Liquid
   (collections / products); qui sono statici per poter provare il sito offline. */

window.GLAZES = {
  terracotta: { name: 'Terracotta naturale', color: '#B4532A' },
  mare:       { name: 'Blu Mediterraneo',    color: '#1F4E79' },
  salvia:     { name: 'Verde salvia',        color: '#7F9172' },
  latte:      { name: 'Bianco latte',        color: '#EDE6DA' },
  lava:       { name: 'Nero lava',           color: '#2B2725' },
  limone:     { name: 'Giallo limone',       color: '#DDA93A' },
  cipria:     { name: 'Rosa cipria',         color: '#D49C93' },
  ruggine:    { name: 'Ruggine',             color: '#8C3B1E' }
};

window.COLLECTIONS = [
  { handle: 'tavola', title: 'Tavola',       blurb: 'Piatti e ciotole per ogni giorno, robusti e lavabili in lavastoviglie.', art: { type: 'piatto', glaze: 'mare', deco: 'maiolica' } },
  { handle: 'caffe',  title: 'Caffè & tè',   blurb: 'Tazze e tazzine che tengono il calore e stanno bene in mano.',          art: { type: 'tazza', glaze: 'salvia', deco: 'colata' } },
  { handle: 'casa',   title: 'Casa',         blurb: 'Vasi, brocche e oggetti che danno carattere a una stanza.',             art: { type: 'vaso', glaze: 'terracotta', deco: 'righe' } },
  { handle: 'regali', title: 'Idee regalo',  blurb: 'Set pronti da regalare, con confezione in carta riciclata.',            art: { type: 'set', glaze: 'cipria', deco: 'puntini' } }
];

window.PRODUCTS = [
  {
    handle: 'vaso-anfora', title: 'Vaso Anfora', type: 'vaso', collections: ['casa'],
    price: 8900, compareAt: null, badge: 'Più venduto', rating: 4.9, reviews: 214, stock: 7,
    glazes: ['terracotta', 'mare', 'latte', 'lava'], deco: 'righe',
    desc: 'Il nostro pezzo simbolo: un vaso dalla pancia generosa, tornito a mano e smaltato a immersione. Ogni esemplare ha piccole differenze di colore che lo rendono unico.',
    dims: 'Altezza 32 cm · Ø 22 cm · 1,8 kg'
  },
  {
    handle: 'tazza-mattino', title: 'Tazza Mattino', type: 'tazza', collections: ['caffe'],
    price: 2400, compareAt: null, badge: null, rating: 4.8, reviews: 389, stock: 42,
    glazes: ['salvia', 'latte', 'mare', 'cipria', 'lava'], deco: 'colata',
    desc: 'Una tazza da 350 ml con manico largo e bordo sottile. Lo smalto colato lascia scoperta la base in grès, piacevole al tatto.',
    dims: '350 ml · Altezza 10 cm · Ø 8,5 cm'
  },
  {
    handle: 'ciotola-grano', title: 'Ciotola Grano', type: 'ciotola', collections: ['tavola'],
    price: 3200, compareAt: 3800, badge: 'Saldi', rating: 4.7, reviews: 156, stock: 18,
    glazes: ['limone', 'latte', 'salvia', 'terracotta'], deco: 'puntini',
    desc: 'Profonda quanto basta per un piatto di pasta o una zuppa. La puntinatura è dipinta a pennello, uno per uno.',
    dims: 'Ø 18 cm · Altezza 8 cm · 800 ml'
  },
  {
    handle: 'piatto-maiolica', title: 'Piatto Maiolica', type: 'piatto', collections: ['tavola'],
    price: 3600, compareAt: null, badge: 'Nuovo', rating: 4.9, reviews: 98, stock: 25,
    glazes: ['mare', 'limone', 'ruggine'], deco: 'maiolica',
    desc: 'Il decoro a fiore riprende i motivi della maiolica del Sud, disegnati di nuovo con un tratto più semplice e moderno.',
    dims: 'Ø 27 cm · Piatto piano'
  },
  {
    handle: 'brocca-fonte', title: 'Brocca Fonte', type: 'brocca', collections: ['casa', 'tavola'],
    price: 6500, compareAt: null, badge: null, rating: 4.8, reviews: 73, stock: 4,
    glazes: ['latte', 'salvia', 'terracotta'], deco: 'nessuno',
    desc: 'Un litro d\'acqua fresca in tavola o un mazzo di fiori di campo sulla credenza. Il becco è modellato a mano per non gocciolare.',
    dims: '1 litro · Altezza 24 cm'
  },
  {
    handle: 'set-colazione', title: 'Set Colazione per due', type: 'set', collections: ['regali', 'caffe'],
    price: 9800, compareAt: 11200, badge: 'Saldi', rating: 5.0, reviews: 61, stock: 12,
    glazes: ['cipria', 'salvia', 'mare'], deco: 'puntini',
    desc: 'Due tazze, due ciotole e due piattini nello stesso smalto, in una scatola regalo con biglietto scritto a mano.',
    dims: '6 pezzi · Scatola 35 × 25 × 15 cm'
  },
  {
    handle: 'vaso-colonna', form: 'colonna', title: 'Vaso Colonna', type: 'vaso', collections: ['casa'],
    price: 7200, compareAt: null, badge: null, rating: 4.6, reviews: 44, stock: 9,
    glazes: ['lava', 'latte', 'ruggine'], deco: 'colata',
    desc: 'Linea slanciata e smalto che scende in gocce irregolari. Perfetto per rami secchi, eucalipto o un singolo stelo.',
    dims: 'Altezza 38 cm · Ø 16 cm'
  },
  {
    handle: 'tazzina-espresso', form: 'piccola', title: 'Tazzina Espresso', type: 'tazza', collections: ['caffe'],
    price: 1600, compareAt: null, badge: null, rating: 4.9, reviews: 512, stock: 60,
    glazes: ['lava', 'terracotta', 'latte', 'limone'], deco: 'nessuno',
    desc: 'Pareti spesse per tenere l\'espresso caldo fino all\'ultimo sorso. Si impila, per occupare poco spazio.',
    dims: '80 ml · Altezza 6 cm'
  },
  {
    handle: 'ciotola-insalata', form: 'larga', title: 'Insalatiera Campo', type: 'ciotola', collections: ['tavola'],
    price: 5800, compareAt: null, badge: null, rating: 4.8, reviews: 87, stock: 0,
    glazes: ['salvia', 'mare'], deco: 'righe',
    desc: 'Grande, larga e bassa: da mettere al centro della tavola la domenica. Le righe sono incise a crudo prima della cottura.',
    dims: 'Ø 30 cm · Altezza 11 cm'
  },
  {
    handle: 'piatto-fondo', title: 'Piatto Fondo Riva', type: 'piatto', collections: ['tavola'],
    price: 3000, compareAt: null, badge: null, rating: 4.7, reviews: 120, stock: 33,
    glazes: ['latte', 'salvia', 'lava', 'cipria'], deco: 'nessuno',
    desc: 'Bordo rialzato e smalto satinato. Il piatto fondo che usi tutti i giorni, solo più bello.',
    dims: 'Ø 22 cm · Profondità 4 cm'
  },
  {
    handle: 'brocca-piccola', form: 'piccola', title: 'Lattiera Goccia', type: 'brocca', collections: ['caffe', 'regali'],
    price: 2900, compareAt: null, badge: 'Nuovo', rating: 4.6, reviews: 22, stock: 15,
    glazes: ['cipria', 'limone', 'latte'], deco: 'puntini',
    desc: 'Piccola brocca per il latte, la panna o l\'olio buono. Sta in una mano sola.',
    dims: '250 ml · Altezza 12 cm'
  },
  {
    handle: 'set-aperitivo', title: 'Set Aperitivo', type: 'set', collections: ['regali', 'tavola'],
    price: 7400, compareAt: null, badge: null, rating: 4.9, reviews: 39, stock: 8,
    glazes: ['terracotta', 'limone', 'lava'], deco: 'maiolica',
    desc: 'Un piatto da portata e due ciotoline per olive e taralli. Il regalo per chi ama invitare gente a casa.',
    dims: '3 pezzi · Piatto Ø 27 cm, ciotole Ø 10 cm'
  }
];
