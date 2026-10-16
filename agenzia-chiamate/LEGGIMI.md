# Chiamate → Excel automatico

Ogni chiamata registrata viene **trascritta**, letta da un'**IA** e trasformata in una riga del file
**`candidati.xlsx`**, senza dover scrivere nulla a mano.

```
registrazione della chiamata ──► trascrizione (Whisper, sul tuo PC) ──► IA (Claude) ──► candidati.xlsx
```

## Cosa finisce nella tabella

| Colonna | Contenuto |
|---|---|
| Data chiamata | giorno della chiamata (dal nome del file o dalla data del file) |
| Nome, Cognome | come detti nella chiamata |
| Telefono | dal nome del file della registrazione o, se manca, dal numero detto in chiamata |
| Tipo di lavoro richiesto | mansione / settore che la persona cerca |
| Disponibilità | orari, turni, zona, auto, ecc. |
| Disponibile dal | data da cui può iniziare |
| Conoscenze / competenze | esperienze, patentini, lingue, studi |
| Riassunto chiamata | 2-4 frasi; se la persona richiama, i nuovi riassunti si aggiungono sotto con la data |
| Interessato | ☑ se è interessato |
| Da ricontattare | ☑ se va richiamato |
| Data ricontatto | quando richiamarlo, se è stato detto |

Regole:

- **Non interessato** → **non** viene messo in lista (in `config.py` puoi scegliere di salvarlo in un foglio a parte).
- **Informazione non detta** → nella cella c'è scritto **"Non comunicato ancora"**.
- **Persona già in lista** (stesso numero, o stesso nome e cognome) → la riga viene **aggiornata**, non duplicata;
  i dati già presenti non vengono cancellati.
- **Chiamate che non c'entrano** col lavoro (personali, pubblicità, numero sbagliato) → ignorate.
- Le spunte ☑/☐ si possono cambiare anche a mano dal menu a tendina della cella; con i filtri
  dell'intestazione vedi al volo, ad esempio, solo chi è da ricontattare.

Un esempio di risultato è in `esempi/esempio_candidati.xlsx`.

## 1. Registrare le chiamate

Il programma legge i file che trova nella cartella **`chiamate_in_arrivo`**: audio (`.mp3`, `.m4a`,
`.wav`, `.amr`, `.ogg`, ...) oppure trascrizioni già pronte (`.txt`).

- **Android**: attiva la registrazione automatica delle chiamate nell'app Telefono (Samsung, Xiaomi,
  Google Telefono...). Poi fai sincronizzare la cartella delle registrazioni con il PC (Google Drive,
  OneDrive o un'app come *Autosync*) e in `config.py` imposta `CARTELLA_IN_ARRIVO` su quella cartella.
  Se il nome del file contiene il numero (es. `Chiamata +39 333 1234567_20261016.m4a`), il numero
  viene preso da lì: è il più affidabile.
- **iPhone (iOS 18 o successivo)**: durante la chiamata tocca il pulsante di registrazione; la
  registrazione e la trascrizione finiscono nell'app Note. Esporta l'audio o il testo nella cartella.
- **Centralino VoIP / app di chiamata dal PC**: quasi tutti salvano le registrazioni in una cartella:
  basta indicarla in `config.py`.

> ⚠️ **Privacy (GDPR)**: avvisa sempre la persona all'inizio che la chiamata viene registrata e che i
> suoi dati verranno usati per la selezione. Il file Excel contiene dati personali: tienilo al sicuro.

## 2. Installazione (una volta sola, su Windows)

1. Installa **Python 3.10 o più recente** da <https://www.python.org/downloads/>.
   Durante l'installazione spunta **"Add python.exe to PATH"**.
2. Apri la cartella `agenzia-chiamate`, clicca sulla barra dell'indirizzo, scrivi `cmd` e premi Invio.
   Nella finestra nera scrivi:
   ```
   pip install -r requirements.txt
   ```
3. Crea una **chiave API** su <https://console.anthropic.com> (sezione *API Keys*) e aggiungi un
   metodo di pagamento. Poi, nella stessa finestra nera:
   ```
   setx ANTHROPIC_API_KEY "incolla-qui-la-tua-chiave"
   ```
   Chiudi e riapri la finestra perché la chiave venga vista.

Su Mac/Linux è uguale: `pip3 install -r requirements.txt` e `export ANTHROPIC_API_KEY=...` nel profilo.

## 3. Uso

- **Doppio clic su `avvia.bat`**: il programma resta acceso e ogni 30 secondi controlla se sono arrivate
  nuove chiamate. Lascialo aperto mentre lavori.
- Oppure, per elaborare una volta sola quello che c'è: `python chiamate.py`

Ogni file elaborato viene spostato in `chiamate_elaborate` (insieme alla sua trascrizione in `.txt`),
così puoi sempre ricontrollare cosa è stato detto. I file che danno problemi finiscono in
`chiamate_con_errori`. Tutto quello che succede è scritto in `registro.log`.

Puoi tenere `candidati.xlsx` aperto per leggerlo, ma **chiudilo ogni tanto**: finché è aperto in Excel
il programma non può salvarci dentro e riprova al controllo successivo (non si perde nulla).

La prima chiamata audio è più lenta perché viene scaricato il modello di trascrizione (~500 MB).

## Costi

- Trascrizione: **gratis**, gira sul tuo computer.
- IA: si paga a consumo su console.anthropic.com. Per una chiamata di 5 minuti sono indicativamente
  **pochi centesimi** di dollaro.

## Personalizzare

Tutto si cambia in **`config.py`**: cartelle, nome del file Excel, il testo "Non comunicato ancora",
se salvare i non interessati, precisione della trascrizione (`"small"`, `"medium"`, `"large-v3"`).
Le istruzioni date all'IA (cosa intendere per "interessato", "da ricontattare", ecc.) sono in cima a
`estrazione.py` e si possono modificare in italiano.

Per provare il programma senza chiave API né internet: `python test/test_offline.py`.
