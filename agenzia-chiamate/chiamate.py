"""Elabora le registrazioni delle chiamate e aggiorna il file Excel dei candidati.

Uso:
    python chiamate.py              elabora le chiamate presenti e termina
    python chiamate.py --continuo   resta acceso e controlla di continuo se ne arrivano di nuove
"""

import re
import shutil
import sys
import time
from datetime import date, datetime
from pathlib import Path

import anthropic

import config
import estrazione
import excel
import trascrizione

# Un file modificato da meno di così tanti secondi potrebbe essere ancora in copia/sincronizzazione.
ATTESA_FILE_STABILE = 10


def log(messaggio: str):
    riga = f"[{datetime.now():%d/%m/%Y %H:%M:%S}] {messaggio}"
    print(riga)
    with open(config.CARTELLA_BASE / "registro.log", "a", encoding="utf-8") as f:
        f.write(riga + "\n")


def telefono_dal_nome_file(nome: str) -> str:
    """Molte app di registrazione mettono il numero nel nome del file, es. 'Chiamata +39 333 1234567_20261016.m4a'."""
    for candidato in re.findall(r"\+?\d[\d \-]{7,}\d", nome):
        cifre = re.sub(r"\D", "", candidato)
        # Scarta le date/orari tipo 20261016 o 20261016143005.
        if re.fullmatch(r"20\d{6}(\d{4,6})?", cifre):
            continue
        if 9 <= len(cifre) <= 13:
            return ("+" if candidato.startswith("+") else "") + cifre
    return ""


def data_chiamata(percorso: Path) -> date:
    # (?<!\d) evita di scambiare per data un pezzo del numero di telefono.
    for m in re.finditer(r"(?<!\d)(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})", percorso.stem):
        try:
            return date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError:
            continue
    return date.fromtimestamp(percorso.stat().st_mtime)


def sposta(percorso: Path, cartella: Path) -> Path:
    destinazione = cartella / percorso.name
    n = 1
    while destinazione.exists():
        destinazione = cartella / f"{percorso.stem} ({n}){percorso.suffix}"
        n += 1
    shutil.move(str(percorso), destinazione)
    return destinazione


def sposta_in_elaborate(percorso: Path, trascritto: str):
    destinazione = sposta(percorso, config.CARTELLA_ELABORATE)
    if trascritto and percorso.suffix.lower() not in config.ESTENSIONI_TESTO:
        destinazione.with_name(destinazione.stem + " - trascrizione.txt").write_text(trascritto, encoding="utf-8")


def file_da_elaborare():
    estensioni = config.ESTENSIONI_AUDIO | config.ESTENSIONI_TESTO
    adesso = time.time()
    return sorted(
        (p for p in config.CARTELLA_IN_ARRIVO.iterdir()
         if p.is_file() and p.suffix.lower() in estensioni and not p.name.startswith(".")
         and adesso - p.stat().st_mtime > ATTESA_FILE_STABILE),
        key=lambda p: p.stat().st_mtime,
    )


def elabora(percorso: Path):
    log(f"Elaboro: {percorso.name}")
    testo = trascrizione.trascrivi(percorso)
    if not testo:
        log("  Trascrizione vuota (nessuna voce riconosciuta): file spostato senza modifiche all'Excel.")
        sposta_in_elaborate(percorso, testo)
        return

    giorno = data_chiamata(percorso)
    dati = estrazione.estrai(testo, giorno)
    if not dati["chiamata_pertinente"]:
        log("  Chiamata non di lavoro: ignorata.")
        sposta_in_elaborate(percorso, testo)
        return

    # Il numero nel nome del file è quello reale di chi ha chiamato: ha la precedenza.
    dati["telefono"] = telefono_dal_nome_file(percorso.stem) or dati["telefono"]
    dati["data_chiamata"] = giorno.isoformat()
    dati["file"] = percorso.name

    esito = excel.registra(dati)
    nome = f"{dati['nome']} {dati['cognome']}".strip() or "(nome non detto)"
    log(f"  {nome}: {esito}")
    sposta_in_elaborate(percorso, testo)


def giro():
    for percorso in file_da_elaborare():
        try:
            elabora(percorso)
        except PermissionError:
            log(f"  Non riesco a salvare {config.FILE_EXCEL.name}: è aperto in Excel? "
                "Chiudilo, riproverò al prossimo controllo.")
            return
        except anthropic.AuthenticationError:
            log("  Chiave API non valida o mancante: controlla ANTHROPIC_API_KEY (vedi LEGGIMI.md).")
            sys.exit(1)
        except (anthropic.APIConnectionError, anthropic.RateLimitError, anthropic.InternalServerError) as e:
            log(f"  Servizio IA momentaneamente non raggiungibile ({e.__class__.__name__}): riproverò più tardi.")
            return
        except Exception as e:  # un file difettoso non deve bloccare gli altri
            sposta(percorso, config.CARTELLA_ERRORI)
            log(f"  ERRORE su {percorso.name}: {e}. File spostato in '{config.CARTELLA_ERRORI.name}'.")


def main():
    config.CARTELLA_IN_ARRIVO.mkdir(exist_ok=True)
    config.CARTELLA_ELABORATE.mkdir(exist_ok=True)
    config.CARTELLA_ERRORI.mkdir(exist_ok=True)

    if "--continuo" not in sys.argv:
        giro()
        return

    log(f"In ascolto su '{config.CARTELLA_IN_ARRIVO}'. Premi Ctrl+C per fermare.")
    try:
        while True:
            giro()
            time.sleep(config.INTERVALLO_SECONDI)
    except KeyboardInterrupt:
        log("Fermato.")


if __name__ == "__main__":
    main()
