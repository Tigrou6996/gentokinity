# Tutto automatico con Xiaomi / Redmi / Poco + Google Drive

Alla fine di questa guida funzionerà così, senza che tu debba toccare niente:

```
chiami ──► il telefono registra ──► l'audio va su Google Drive ──► il PC lo trova ──► riga in candidati.xlsx
```

Si fa **una volta sola**, in circa 20 minuti.

---

## A. Sul telefono: registrazione automatica delle chiamate

1. Apri l'app **Telefono** → in alto a destra **⋮** (o ⚙️) → **Impostazioni**.
2. Cerca **Registrazione chiamate**.
3. Attiva **Registra chiamate automaticamente** e scegli quali:
   - **Tutti i numeri**: registra tutto. Le chiamate personali vengono comunque scartate dal programma,
     ma passano dalla trascrizione;
   - **Numeri non in rubrica** (o **Numeri selezionati**): utile se i candidati di solito non sono in
     rubrica e vuoi evitare di registrare le chiamate private.
4. **Fai una chiamata di prova** di qualche secondo.
5. Apri l'app **Gestione file** (File Manager) → **Memoria interna** → **MIUI** → **sound_recorder** →
   **call_rec**. Qui deve esserci la registrazione appena fatta.

> Se nel tuo modello l'app Telefono è quella di Google, le opzioni si chiamano **Registra sempre** →
> **Numeri non salvati** / **Numeri selezionati**. Se dopo la prova la cartella `call_rec` è vuota,
> scrivimi: c'è una soluzione alternativa con un'app di registrazione.

## B. Sul telefono: invio automatico delle registrazioni a Google Drive

1. Dal Play Store installa **Autosync for Google Drive** (sviluppatore: *MetaCtrl*) e accedi con il
   tuo account Google.
2. Tocca **Crea coppia di cartelle** (o *Choose what to sync*):
   - **Cartella locale**: `MIUI/sound_recorder/call_rec`
   - **Cartella remota**: crea una nuova cartella di Drive chiamata **`Registrazioni chiamate`**
   - **Metodo di sincronizzazione**: **Solo caricamento** (*Upload only*). Così le registrazioni
     sul telefono non vengono mai cancellate.
3. **Importante sugli Xiaomi**, che tendono a chiudere le app in background:
   - Impostazioni → **App** → **Gestisci app** → **Autosync** → **Risparmio batteria** →
     **Nessuna restrizione**;
   - nella stessa pagina attiva **Avvio automatico**.
4. Fai un'altra chiamata di prova e controlla su drive.google.com che compaia nella cartella
   `Registrazioni chiamate` (può volerci qualche minuto).

## C. Sul PC: ricevere le registrazioni e avviare il programma

1. Installa **Google Drive per desktop** da <https://www.google.com/drive/download/> e accedi con
   **lo stesso account Google** del telefono. In *Esplora file* comparirà un'unità **Google Drive**
   (di solito **G:**) con dentro **Il mio Drive** → **Registrazioni chiamate**.
2. Nella cartella `agenzia-chiamate` fai clic destro su **`config.py`** → **Apri con** →
   **Blocco note**, e cambia queste due righe:
   ```python
   CARTELLA_IN_ARRIVO = Path(r"G:\Il mio Drive\Registrazioni chiamate")
   IGNORA_CHIAMATE_PRIMA_DEL = "2026-10-16"
   ```
   - Se la lettera dell'unità non è **G:**, metti quella che vedi in *Esplora file*. Puoi anche
     aprire la cartella, cliccare sulla barra dell'indirizzo e copiare il percorso esatto.
   - Al posto di `2026-10-16` metti **la data di oggi**: le registrazioni più vecchie già presenti
     sul telefono verranno ignorate.

   Salva e chiudi.
3. **Fallo partire da solo all'accensione del PC**: premi **Win + R**, scrivi `shell:startup` e premi
   Invio. Nella cartella che si apre fai clic destro → **Nuovo** → **Collegamento**, scegli il file
   **`avvia.bat`** della cartella `agenzia-chiamate` → **Avanti** → **Fine**.
4. Fai doppio clic su **`avvia.bat`** per avviarlo subito (le prossime volte partirà da solo).

## D. Prova finale

Fai una chiamata vera o di prova in cui dici nome, cognome, che lavoro cerchi e la disponibilità.
Dopo qualche minuto:

- nella finestra nera di `avvia.bat` compare `Elaboro: ...` e poi il nome della persona;
- in `candidati.xlsx` c'è la nuova riga;
- in `trascrizioni` c'è il testo della chiamata.

Se qualcosa non va, guarda `registro.log` nella cartella `agenzia-chiamate` e mandami cosa c'è scritto.

---

**Promemoria**
- Il PC deve essere acceso con `avvia.bat` aperto. Le chiamate fatte a PC spento vengono elaborate
  alla riaccensione, quindi non si perde niente.
- Ricordati di avvisare le persone che la chiamata è registrata (GDPR).
