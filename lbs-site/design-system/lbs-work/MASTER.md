# LBS Work — Design System (MASTER)

Generato con la skill **ui-ux-pro-max** (`--design-system "corporate recruitment agency minimal professional" --variance 2 --motion 3 --density 4`)
e adattato ai colori del marchio LBS. Le pagine sotto `pages/` (se presenti) sovrascrivono queste regole.

## Direzione
- **Stile:** Minimalism & Swiss Style — lineare, aziendale, moderno.
  Griglia rigorosa, linee da 1px al posto di ombre, molto spazio bianco, nessuna decorazione superflua.
- **Pattern landing:** Trust & Authority + Conversion — Hero (missione/credibilità) → Prove (numeri) → Soluzione → CTA chiara.
- **Da evitare (dalla skill):** stile giocoso, gradienti viola/rosa "AI", credenziali nascoste, emoji come icone, ombre e sfumature decorative.

## Colori (marchio)
| Ruolo | Valore |
|---|---|
| Primario / testo titoli | `#3D2045` (plum-800) |
| Azione primaria | `#6E4274` (plum-600) |
| Secondario | `#9B6FA3` (plum-400) |
| Accento unico (CTA principale, dettagli) | `#FFDF20` (sun-400) |
| Testo | `#1F1424` · testo secondario `#5B4F60` |
| Sfondo | `#FFFFFF` · superficie tenue `#F8F6F9` |
| Linee | `#E7E1EA` |

## Tipografia
- **Inter** per titoli e testo (abbinamento "Minimal Swiss" della skill).
- Titoli 600, tracking −0.025em; testo 16px, interlinea 1.6; etichette 12px maiuscole, tracking 0.12em.

## Forme ed effetti
- Raggio: 6px (bottoni, campi), 8px (card, immagini). Pillole solo per piccoli badge.
- Nessuna ombra sulle card: bordo 1px; al passaggio del mouse cambia solo il colore del bordo.
- Ombre solo per elementi sovrapposti (modali, menu).
- Griglie "a linee": celle separate da 1px (`.grid-lines`).
- Movimento sottile: 200–300ms, comparsa allo scroll 12px; rispetto di `prefers-reduced-motion`.

## Checklist prima della consegna (dalla skill)
- [ ] Nessuna emoji usata come icona
- [ ] `cursor-pointer` su tutti gli elementi cliccabili
- [ ] Hover con transizioni 150–300ms
- [ ] Contrasto testo ≥ 4.5:1
- [ ] Focus visibile da tastiera
- [ ] `prefers-reduced-motion` rispettato
- [ ] Responsive: 375, 768, 1024, 1440px
