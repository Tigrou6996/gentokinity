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

Il programma legge i file che trova nella cartella indicata in `config.py` (`CARTELLA_IN_ARRIVO`):
audio (`.mp3`, `.m4a`, `.wav`, `.amr`, `.ogg`, ...) oppure trascrizioni già pronte (`.txt`).

- **Xiaomi / Redmi / Poco + Google Drive**: tutto automatico, segui **[GUIDA_XIAOMI.md](GUIDA_XIAOMI.md)**.
- **Altri Android**: attiva la registrazione automatica nell'app Telefono e sincronizza la cartella
  delle registrazioni con Google Drive come spiegato nella guida Xiaomi (cambia solo la cartella).
- **iPhone (iOS 18 o successivo)**: tocca il pulsante di registrazione durante la chiamata ed esporta
  l'audio o la trascrizione nella cartella.

Se il nome del file contiene il numero (es. `Mario Rossi(+393331234567)_20261016101500.mp3`),
il numero viene preso da lì: è il più affidabile.

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

Le registrazioni **restano dove sono** (non vengono spostate né cancellate). Il programma si segna in
`gia_elaborati.txt` quelle già fatte, così non le rielabora; per rifarne una, cancella la sua riga.
La trascrizione di ogni chiamata viene salvata in `trascrizioni`, così puoi sempre ricontrollare cosa è
stato detto. Tutto quello che succede è scritto in `registro.log`.

Le registrazioni più vecchie della data `IGNORA_CHIAMATE_PRIMA_DEL` (in `config.py`) vengono ignorate,
così le vecchie chiamate già sul telefono non finiscono nell'Excel.

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
