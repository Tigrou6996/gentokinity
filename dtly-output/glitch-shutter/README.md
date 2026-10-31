# Glitch Shutter — stinger OBS (DT.ly)

`glitch-shutter.webm` — 1920×1080, 60 fps, 1,2 s (72 frame), VP9 con canale alfa (`yuva420p`).

## OBS Studio
Scene Transitions → **+** → *Stinger*
- Video File: `glitch-shutter.webm`
- Transition Point Type: **Time (milliseconds)** → **600** (frame 36, schermo completamente coperto)
- Audio: nessuna traccia

## Struttura
| Tempo | Cosa succede |
|---|---|
| 0–0,6 s | 24 bande si espandono dal proprio centro in alto e in basso; le bande centrali partono per prime (offset 15 ms per anello → fisarmonica). Easing cubic ease-in-out `[0.645, 0.045, 0.355, 1]` |
| ~0,25–0,35 s | 4 glitch di riga (spostamento ±3 px, 2 frame ciascuno) attorno al 50% di copertura (frame 18) |
| 0,6 s | frame 36: copertura 100% (punto di transizione) |
| 0,6–1,2 s | le bande si ritirano in ordine inverso (prima i bordi, ultime le centrali); 3 glitch di riga attorno al 50% (frame 53) |

Bagliore RGB (split verticale 7 px + glow grigio scuro `#3a3a40`) massimo all'inizio/fine, zero al punto di taglio.

## Modificare e rigenerare
```bash
npm install            # @dnyantra/dtly 0.3.0
python3 build.py       # scrive project.json (colori, tempi, glitch in cima al file)
node render.mjs --preview   # PNG su scacchiera in work/
node render.mjs        # glitch-shutter.webm
```
`project.json` si apre anche in DT.ly Studio: `npx @dnyantra/dtly studio project.json`.
`render.mjs` usa il renderer di DT.ly ma codifica con FFmpeg in VP9+alfa, perché `dtly render` esporta solo H.264 opaco.
