# LBS Viaggio

App Flutter (Android e iPhone) per chi viaggia in Germania con i mezzi pubblici. Funziona così:

1. **Aggiungi il biglietto.** Puoi fotografarlo, caricare il PDF, scegliere uno screenshot o scansionare il QR.
   - Il telefono legge il testo con ML Kit, sul dispositivo e senza inviarlo a nessuno.
   - L'app propone partenza, arrivo, data e ora. L'utente conferma o corregge.
2. **Scegli la corsa del biglietto.** L'app mostra:
   - **Mappa** (Google Maps): il percorso completo, con i tratti a piedi tratteggiati, le fermate e la tua posizione.
   - **Coincidenze**: ogni mezzo con linea, direzione, orari, binario o fermata e ritardi in tempo reale. Indica anche il tempo per cambiare, con un avviso se è stretto o se la coincidenza è persa.
   - **Fermate**: tutte le fermate di ogni mezzo, con la prossima evidenziata.
   - **Biglietto**: il biglietto salvato (foto o PDF), da mostrare al controllore.
3. **Attiva la guida vocale.** Una voce molto naturale (ElevenLabs) dice:
   - quale mezzo prendere;
   - "Prossima fermata: …";
   - "Stai arrivando a …, preparati a scendere";
   - i cambi.

   Funziona anche a schermo spento: su Android compare una notifica fissa. Usa il GPS e, quando il segnale manca (gallerie, metro), gli orari in tempo reale. Se manca internet usa la voce del telefono.

In più c'è **Fermate vicine**: le fermate intorno a te, con i prossimi bus e treni in partenza.

## Com'è fatta

```
app-viaggio/
├── app/                       app Flutter
│   ├── lib/
│   │   ├── models/            viaggio, tratti, fermate (formato FPTF), biglietto
│   │   ├── services/
│   │   │   ├── ticket_parser.dart   legge partenza/arrivo/data/ora dal testo del biglietto
│   │   │   ├── ticket_reader.dart   foto, PDF, QR + OCR sul telefono
│   │   │   ├── transit_api.dart     orari, coincidenze, fermate, ritardi
│   │   │   ├── guide_engine.dart    logica "prossima fermata" (GPS + orari)
│   │   │   ├── guide_service.dart   GPS in background + annunci
│   │   │   ├── voice.dart           ElevenLabs con cache + voce del telefono di riserva
│   │   │   └── trip_store.dart      viaggi e biglietti salvati sul telefono
│   │   └── screens/           home, aggiungi biglietto, scelta corsa, viaggio (4 schede), fermate vicine, impostazioni
│   └── test/                  test del lettore biglietti e della guida vocale
└── supabase/functions/
    ├── transit/               orari DB (bus, tram, metro, treni) tramite db-vendo-client
    └── tts/                   voce ElevenLabs (la chiave resta nei Secrets di Supabase)
```

**Da dove vengono gli orari.** I dati sono quelli di bahn.de: tutti i bus, tram, metro e treni della Germania, con ritardi e binari. Arrivano tramite la funzione Supabase `transit`, che usa la stessa interfaccia di [db-rest](https://v6.db.transport.rest). Se serve, l'app può puntare anche a un server db-rest (vedi `TRANSIT_BASE_URL`).

## Cosa serve per farla partire

### 1. Chiavi Google Maps (Google Cloud Console)
- Attiva **Maps SDK for Android** e **Maps SDK for iOS**.
- Crea due chiavi, limitate all'app: package `com.lbswork.lbs_viaggio` e bundle iOS dell'app.
- **Android:** in `app/android/local.properties` aggiungi `MAPS_API_KEY=la_tua_chiave_android`.
- **iPhone:** copia `app/ios/Flutter/Secrets.xcconfig.example` in `Secrets.xcconfig` e metti la chiave iOS.

Questi file non vanno su git.

### 2. Supabase (lo stesso progetto delle email, o uno nuovo)
```bash
cd app-viaggio
supabase link --project-ref <ref-del-progetto>
supabase secrets set ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=<id della voce scelta>
supabase functions deploy transit
supabase functions deploy tts
```
- Per la voce conviene sceglierne una italiana e naturale dalla libreria ElevenLabs, per esempio quella usata nei video.
- Il modello predefinito è `eleven_multilingual_v2`, che pronuncia bene anche i nomi tedeschi delle fermate.
- Gli annunci sono brevi, vengono preparati all'inizio del viaggio e salvati sul telefono: la stessa frase non viene mai pagata due volte.

### 3. Configurazione dell'app
Copia `app/config.example.json` in `app/config.json` e inserisci URL e chiave anon (pubblica) di Supabase, poi:
```bash
cd app
flutter pub get
flutter run --dart-define-from-file=config.json          # su un telefono collegato
flutter build apk --release --dart-define-from-file=config.json
flutter build ipa --release --dart-define-from-file=config.json   # su Mac con Xcode
```
**Su iPhone:** la prima build crea `ios/Podfile`. Lì imposta `platform :ios, '15.5'`, perché ML Kit lo richiede.

## Test
```bash
cd app && flutter test && flutter analyze
```
I test coprono:
- la lettura di biglietti DB, FlixBus, "von … nach …" e italiani;
- la guida vocale: ordine degli annunci, nessuna ripetizione, cambi, arrivo, uso del GPS.

## Limiti da sapere
- La lettura del biglietto è un aiuto: i biglietti sono tutti diversi, quindi l'utente conferma sempre partenza e arrivo.
  - I QR della DB contengono dati cifrati: vengono salvati con il biglietto, ma partenza e arrivo si leggono dal testo stampato.
- Gli orari di bahn.de non hanno un contratto ufficiale per uso pubblico. Per molti utenti conviene un proprio server db-rest, oppure un accordo con un fornitore di dati come HAFAS o i GTFS delle aziende locali.
- Su Android, alcuni produttori (Xiaomi, Huawei, Samsung) chiudono le app in background per risparmiare batteria. Agli utenti va detto di togliere l'ottimizzazione della batteria per l'app.
