# Email automatiche alle candidature (gratis)

Quando una persona si candida sul sito, riceve in automatico l'email **"Candidatura ricevuta"**.
Facoltativo: quando cambi lo stato dal pannello admin, può ricevere anche l'email di esito (**accettata** / **rifiutata**).

## Come funziona

```
Candidato invia il modulo ──► Supabase salva la riga nella tabella "candidature"
                               │
                               ▼  Database Webhook (gratis)
                         Edge Function "email-candidature" (gratis)
                               │
                               ▼  SMTP Aruba (la tua casella info@lbswork.com)
                         Email al candidato (+ copia nascosta a te, se vuoi)
```

- **Non serve modificare il codice del sito**: funziona con entrambi i moduli (homepage e pagina offerte), perché scatta quando la riga arriva nel database.
- **Costo zero**: il piano gratuito di Supabase include 500.000 chiamate al mese alle Edge Functions. Le email partono dalla casella Aruba che hai già.
- Le risposte del candidato arrivano a info@lbswork.com.

## File

| File | Cosa contiene |
|---|---|
| `candidatura-ricevuta.html` | email di conferma, inviata subito dopo la candidatura |
| `candidatura-accettata.html` | email di candidatura accettata |
| `candidatura-rifiutata.html` | email di candidatura non accettata |
| `richiesta-informazioni.html` | risposta a chi scrive per avere informazioni (da inviare a mano, vedi in fondo) |
| `supabase/functions/email-candidature/index.ts` | **la funzione da incollare su Supabase** (contiene già le tre email) |
| `funzione/function.src.ts`, `funzione/build.mjs` | sorgente della funzione: se modifichi un'email `.html`, rigenera `index.ts` con `node lbs-email/funzione/build.mjs` |

---

## Configurazione (circa 15 minuti, tutto dal browser)

Apri [supabase.com/dashboard](https://supabase.com/dashboard) ed entra nel progetto del sito (`iedgiiucirqqrldvqqro`).

### 1. Crea la funzione

1. Menu a sinistra **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nome della funzione: `email-candidature`.
3. Cancella il codice di esempio e incolla **tutto** il contenuto di `supabase/functions/email-candidature/index.ts`.
4. Clicca **Deploy function**.
5. Apri la funzione → **Details** (o Settings) → **disattiva "Enforce JWT Verification"** (Verify JWT) e salva.
   La funzione è comunque protetta: risponde solo a chi conosce la parola segreta (`WEBHOOK_SECRET`, punto 2).

### 2. Inserisci password e impostazioni (Secrets)

**Edge Functions** → **Secrets** → aggiungi:

| Nome | Valore |
|---|---|
| `SMTP_USER` | `info@lbswork.com` |
| `SMTP_PASS` | la password della casella info@lbswork.com (quella che usi per Webmail Aruba) |
| `WEBHOOK_SECRET` | una parola segreta lunga e casuale, per esempio `lbs-8f3k2m9q7x1z5w` (inventane una tua) |
| `COPIA_A` *(facoltativo)* | `info@lbswork.com` se vuoi ricevere una copia nascosta di ogni email inviata |

Il server SMTP è già impostato su `smtps.aruba.it`, porta `465` (SSL), quello delle caselle Aruba.

### 3. Collega la tabella alla funzione (Database Webhook)

1. Menu **Database** → **Webhooks** (oppure **Integrations → Database Webhooks**) → se richiesto, **Enable webhooks**.
2. **Create a new hook**:
   - **Name**: `email-candidature`
   - **Table**: `candidature`
   - **Events**: spunta **Insert** (spunta anche **Update** solo se vuoi le email di esito, vedi sotto)
   - **Type of webhook**: **Supabase Edge Functions** → scegli `email-candidature`, metodo **POST**
   - **HTTP Headers** → **Add a new header**: nome `x-webhook-secret`, valore = la **stessa** parola segreta del punto 2
3. **Create webhook**.

### 4. Prova

1. Vai sul sito e invia una candidatura con **la tua email**.
2. Entro pochi secondi ti arriva "Candidatura ricevuta" (controlla anche lo spam la prima volta).
3. Se non arriva: **Edge Functions → email-candidature → Logs**. Messaggi utili:
   - `email "ricevuta" inviata a …` → tutto ok, controlla lo spam;
   - `non autorizzato` → la parola segreta nell'header del webhook non coincide con `WEBHOOK_SECRET`;
   - `invio fallito: Invalid login` → `SMTP_USER` o `SMTP_PASS` sbagliati.

---

## Facoltativo: email di esito dal pannello admin

Quando nel pannello admin cambi lo stato di una candidatura, la funzione può inviare l'email di esito.
**È spenta di default**, perché l'email parte appena cambi lo stato: attivala solo quando hai deciso quale stato significa "accettata".

Nel pannello gli stati sono: `nuova` (Inviata), `in_lavorazione` (In Revisione), `completata` (Completata), `rifiutata` (Non Idonea).

1. Nel webhook del punto 3 spunta anche **Update**.
2. Aggiungi questi Secrets:

| Nome | Valore |
|---|---|
| `INVIA_ESITO` | `si` |
| `STATO_ACCETTATA` | lo stato che vale come "accettata", per esempio `completata` |
| `STATO_RIFIUTATA` | `rifiutata` (è già il valore predefinito) |

Da quel momento:
- stato → `rifiutata` = email "candidatura non accettata";
- stato → `completata` (o quello scelto) = email "candidatura accettata, ti chiameremo per il colloquio".

Gli altri cambi di stato (es. "In Revisione") non inviano niente.

---

## Note

- **Nome e posizione**: il nome viene dal campo `nome`; la posizione è il titolo dell'offerta (`offerta_titolo`) oppure, per il modulo in homepage, il settore scelto (`settore`).
- **Limiti di invio**: Aruba applica dei limiti orari di invio per casella, molto più alti del numero di candidature di un'agenzia. Se un giorno ti servissero grandi volumi, si può passare a un servizio come Brevo o Resend (anche loro con piano gratuito) cambiando solo i Secrets `SMTP_*`.
- **Porta 465**: Supabase blocca le porte 25 e 587, per questo la funzione usa la 465 (SSL), supportata da Aruba.
- **Alternativa da terminale** (per chi usa la Supabase CLI), dalla cartella `lbs-email`:
  ```
  supabase functions deploy email-candidature --no-verify-jwt --project-ref iedgiiucirqqrldvqqro
  supabase secrets set SMTP_USER=info@lbswork.com SMTP_PASS=... WEBHOOK_SECRET=... --project-ref iedgiiucirqqrldvqqro
  ```

## Inviare a mano un'email (es. "Richiesta informazioni")

1. Apri il file `.html` con Chrome o Edge (doppio clic).
2. Premi **Ctrl+A** (seleziona tutto) e **Ctrl+C** (copia).
3. Nella risposta (Webmail Aruba, Outlook o Gmail) clicca nel corpo del messaggio e premi **Ctrl+V**.
4. Sostituisci `{{NOME}}` con il nome della persona (oppure lascia solo "Ciao,") e invia.
