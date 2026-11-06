# Argilla — negozio online in stile Shopify

Sito e-commerce dimostrativo per una bottega (fittizia) di ceramiche in grès tornite a mano.
È costruito come un tema Shopify (struttura alla Dawn) ma in HTML, CSS e JavaScript puri:
nessuna dipendenza, nessun build, si apre direttamente nel browser.

## Come provarlo

Apri `index.html` nel browser (doppio clic va bene) oppure servilo con un server statico:

```bash
npx serve argilla-shop
```

## Cosa c'è

| Pagina | Indirizzo | Contenuto |
|---|---|---|
| Home | `#home` | barra annunci a rotazione, hero, vantaggi, prodotti in evidenza con tab, collezioni, processo di lavorazione, recensioni, banner con codice sconto, newsletter |
| Collezione | `#collezione-tavola`, `#collezione-tutti`… | filtri per tipo, smalto, prezzo e disponibilità; ordinamento; chip dei filtri attivi; cassetto filtri su mobile |
| Prodotto | `#prodotto-vaso-anfora` (anche `#prodotto-vaso-anfora.mare` per una variante) | galleria con miniature (swipe su mobile), varianti di smalto, quantità, scorte, consegna stimata, accordion, recensioni, prodotti correlati, visti di recente, barra d'acquisto fissa |
| Carrello | `#carrello` + cassetto laterale | quantità, barra della spedizione gratuita (80 €), prodotti da abbinare, note |
| Checkout | `#checkout` | dati e indirizzo con validazione (CAP, provincia), spedizione standard/espressa, codici sconto, IVA 22% scorporata |
| Conferma | `#ordine` | numero d'ordine, stato, riepilogo |
| Bottega / Assistenza | `#storia`, `#aiuto` | chi siamo, FAQ su spedizioni, resi e cura |

Altro: ricerca istantanea, mega menu, menu mobile, tema chiaro/scuro automatico,
navigazione da tastiera e focus visibile, rispetto di `prefers-reduced-motion`.

Codici sconto di prova: **BENVENUTO10** (−10%) e **CASA15** (−15% sopra 120 €).

Il carrello resta salvato nel browser (`localStorage`). Il pagamento è simulato: il
checkout non chiede dati della carta.

## File

- `index.html` — struttura comune (header, footer, cassetti, icone)
- `assets/style.css` — tema: colori, tipografia, componenti
- `assets/products.js` — catalogo (prodotti, smalti, collezioni)
- `assets/art.js` — illustrazioni SVG dei prodotti generate dal codice: forma, smalto e decoro cambiano con la variante
- `assets/app.js` — router, carrello, filtri, ricerca, checkout

## Portarlo su Shopify

I dati di `products.js` corrispondono a prodotti e varianti Shopify (lo smalto è l'opzione
"Colore"). Per passare a un negozio vero:

1. crea i prodotti in Shopify con le foto reali;
2. sostituisci `Art.product(...)` con l'immagine della variante (`variant.image`);
3. converti le sezioni della home in sezioni Liquid (`sections/*.liquid`) mantenendo `style.css`;
4. sostituisci il carrello locale con la Cart API (`/cart/add.js`, `/cart/change.js`) e il checkout con quello di Shopify.
