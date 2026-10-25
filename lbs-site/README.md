# LBS – Lavoro Business e Servizi in Germania

Sito React + Vite + Tailwind CSS v4, dati e login su Supabase.
Lo stile segue il design system in `design-system/lbs-work/MASTER.md`.

## Avvio in locale

1. Installa Node.js (versione 20 o successiva).
2. Apri il terminale **dentro questa cartella** (quella che contiene `package.json`).
3. Copia qui il file `.env.local` con le chiavi (vedi `.env.example` per l'elenco).
   Senza questo file il sito parte comunque con i valori pubblici di Supabase,
   ma hCaptcha e le notifiche email non funzionano.
4. Installa le dipendenze: `npm install`
5. Avvia: `npm run dev`
6. Apri l'indirizzo che compare nel terminale (di solito http://localhost:3000).
   Se la porta 3000 è occupata da un altro programma, Vite usa la 3001, 3002…:
   usa sempre l'indirizzo indicato nel terminale.

## Pubblicazione

- `npm run build` crea la cartella `dist/` pronta per Vercel o Netlify.
- Su Vercel imposta le stesse variabili di `.env.local` in Settings → Environment Variables.
