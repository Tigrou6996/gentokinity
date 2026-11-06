# Stinger OBS "Boccaccia"

Transizione stinger per OBS Studio, 2 secondi, 1920×1080 a 60 fps, sfondo trasparente e audio incluso.
Tre personaggi originali disegnati in stile cartoon per adulti: un mostro lilla con criniera arancione e corna da ariete, un ragazzino nerd con occhiali rossi e apparecchio, e un tizio baffuto vestito da banana.
Il mostro sbuca dal basso e ruggisce, la camera si tuffa nella sua bocca, "GULP!", i due vengono inghiottiti e la gola si apre sulla scena nuova.

| File | A cosa serve |
|---|---|
| `out/stinger.webm` | **Da usare in OBS** (VP9 con alpha + audio Opus, 4,9 MB) |
| `out/stinger-preview.mp4` | Anteprima su due scene demo, da guardare ovunque |
| `stinger.html` | Animazione navigabile nel browser (play, timeline, audio) |
| `out/stinger.mov` | ProRes 4444 con alpha (per montaggio). Non è nel repo perché supera i 100 MB: rigeneralo con `render.mjs` |

## Impostazione in OBS Studio

1. Nel riquadro **Transizioni scena** clicca **+** e scegli **Stinger**.
2. **File video**: `out/stinger.webm`.
3. **Tipo punto di transizione**: *Tempo (millisecondi)*. **Punto di transizione**: `1100` ms.
   Lo schermo è coperto al 100% da 0,91 s a 1,38 s: il cambio scena avviene lì sotto e non si vede.
4. **Monitoraggio audio**: *Monitora e invia* (oppure *Solo output* se non vuoi sentirlo in cuffia).
5. Durata: lascia quella del video (2,0 s).

## Tempi (beat sheet)

| t (s) | Cosa succede | Suono |
|---|---|---|
| 0,00 | il ragazzino entra di corsa da sinistra | whoosh |
| 0,05 | il tizio-banana entra da destra | quick woosh |
| 0,16 | il mostro sbuca dal basso con overshoot e squash & stretch | swoosh |
| 0,30 | il mostro atterra | impatto morbido |
| 0,40 | ROAR: bocca spalancata, occhi sgranati | pluck |
| 0,46 | "!" sopra i due, che saltano | pop ×2 |
| 0,55 | la camera si tuffa nella bocca (zoom esponenziale, linee di velocità, parallasse su lingua e gola) | riser che finisce sul GULP |
| 0,93 | schermo coperto: GULP! + scossa della camera | mouth pop + impatto |
| 0,97 | i due precipitano a spirale nella gola | woosh lungo |
| **1,10** | **punto di transizione OBS** | |
| 1,30 | la gola si apre a iride sulla scena nuova | chop whoosh |
| 1,40 | gocce di saliva volano verso la camera | plop ×2 |
| 2,00 | fine, completamente trasparente | |

Audio misurato sul `.webm` esportato: **−16,0 LUFS** integrati, true peak **−4,5 dBFS** (stereo e mono).

## Modificare e rigenerare

```
python3 build.py                                   # incorpora font ed effetti sonori -> stinger.html
node render.mjs stinger.html check/sheet.png --stills 0.3,0.6,0.95,1.2,1.5   # provini su scacchiera
node render.mjs stinger.html out/stinger 60 4 4    # render finale (circa 3 minuti)
```

La pagina segue le regole delle skill `explainer-high-energy` e `sound-effects`: `seek(t)` è una funzione pura del tempo, il motion blur usa 4 sottofotogrammi (otturatore a 180°) mediati in alpha premoltiplicato, e i suoni sono registrazioni reali della libreria inclusa, senza sintesi.
Colori, tempi e personaggi stanno in `stinger.src.html` (dopo ogni modifica lancia `build.py`).

## Crediti audio (tutti CC0)

- "Whoosh" di qubodup: https://freesound.org/people/qubodup/sounds/60013/
- Quick woosh di florianreichelt: https://freesound.org/people/florianreichelt/sounds/683101/
- Swoosh v2 di migoreng1: https://freesound.org/people/migoreng1/sounds/786514/
- Impact Sounds e Interface Sounds di Kenney: https://kenney.nl/assets/impact-sounds, https://kenney.nl/assets/interface-sounds
- "POP SFX Neutral" di ethernel0: https://freesound.org/people/ethernel0/sounds/776016/
- Riser short di syntheffects: https://freesound.org/people/syntheffects/sounds/685256/
- Mouth pop di jcallison: https://freesound.org/people/jcallison/sounds/258269/
- "soft_impact3" di peoplearehappy: https://freesound.org/people/peoplearehappy/sounds/841274/
- Woosh di florianreichelt: https://freesound.org/people/florianreichelt/sounds/683096/
- Fast simple chop di dave.des: https://freesound.org/people/dave.des/sounds/127197/
- Plop di Breviceps: https://freesound.org/people/Breviceps/sounds/447910/

Font: Bangers (SIL Open Font License).
