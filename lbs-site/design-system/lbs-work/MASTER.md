# LBS Work — Design System (MASTER)

Stile ispirato al progetto Behance **"Fintech web design for a B2B payment service | Payop"**
(https://www.behance.net/gallery/249755747/Fintech-web-design-for-a-B2B-payment-service-Payop),
adattato all'agenzia e allo **stile del logo LBS** (cerchio viola, anello e lettere bianche).
Le pagine sotto `pages/` (se presenti) sovrascrivono queste regole.

## Elementi presi da Payop
- Barra di navigazione bianca **flottante** con angoli arrotondati; azione principale scura.
- **Hero in un grande pannello arrotondato** (32–40px) con sfumatura e **cielo stellato** leggero.
- Una parola chiave del titolo come **"adesivo"**: corsivo, contorno bianco spesso, ombra, leggera rotazione.
- **Etichette a pillola** maiuscole sopra i titoli.
- **Card bento** con tinte tenui per tema, etichetta colorata e illustrazione a **cerchi concentrici**.
- Icone in **riquadri tinti**; **adesivi flottanti** bianchi con icona colorata sull'immagine dell'hero.
- Ricerca in evidenza: campo bianco con anello luminoso dentro il pannello.
- Sezioni scure "notte" con stelle; card bianche con ombra morbida.

## Elementi presi dal logo LBS
- **Viola del logo `#5E2D64`** al posto del blu di Payop (sfumatura `#7A4381 → #5E2D64 → #45204B`).
- **Anello bianco** del logo → contorno bianco delle parole "adesivo" e cornice bianca della foto.
- **Cerchio** del logo → illustrazioni a cerchi concentrici.
- Palette viola + bianco; il giallo resta solo per stelle e piccoli badge.

## Colori
| Ruolo | Valore |
|---|---|
| Viola del logo (primario) | `#5E2D64` (plum-700) |
| Scuro (testi, azione principale) | `#24112A` (plum-900) |
| Notte (sezioni scure) | `#1E0D23` |
| Tinte bento | viola `#F5EEF7` · giallo `#FFF8DE` · verde `#EAF8F0` · lilla `#F2EDFC` |
| Testo secondario | `#5F5466` · linee `#ECE6EE` |

## Tipografia
- **Geist** (Payop la usa per il testo) per titoli e testo; titoli 600 con tracking −0.04em.

## Forme
- Pannelli 32–40px · card 20–24px · bottoni 12px · campi 13px · etichette e chip a pillola.
- Ombre morbide sulle card; ombra marcata solo per elementi flottanti e modali.

## Classi principali (`index.css`)
`surface-brand`, `surface-plum`, `sticker` / `mark`, `eyebrow`, `bento` + `bento-plum|sun|mint|lilac`,
`rings`, `float-sticker`, `icon-tile`, `btn-*`, `card`, `grid-lines` (griglia di card).

## Checklist (ui-ux-pro-max)
- [ ] Contrasto testo ≥ 4.5:1 (testo bianco solo su viola/scuro)
- [ ] Focus visibile, `cursor-pointer` sugli elementi cliccabili
- [ ] `prefers-reduced-motion` rispettato (adesivi fermi)
- [ ] Responsive 375 / 768 / 1024 / 1440px, nessuno scroll orizzontale
