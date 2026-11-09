"""Elabora le registrazioni delle chiamate e aggiorna il file Excel dei candidati.

Uso:
    python chiamate.py              elabora le chiamate presenti e termina
    python chiamate.py --continuo   resta acceso e controlla di continuo se ne arrivano di nuove
"""

import re
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


def gia_elaborati() -> set:
    if not config.FILE_REGISTRO_ELABORATI.exists():
        return set()
    righe = config.FILE_REGISTRO_ELABORATI.read_text(encoding="utf-8").splitlines()
    return {r.split("\t")[0] for r in righe if r.strip()}


def segna_elaborato(percorso: Path, esito: str):
    # I file originali restano dove sono (serve con Google Drive e simili):
    # questo registro evita di rielaborarli. Cancella una riga per far rielaborare quel file.
    with open(config.FILE_REGISTRO_ELABORATI, "a", encoding="utf-8") as f:
        f.write(f"{percorso.name}\t{datetime.now():%d/%m/%Y %H:%M}\t{esito}\n")


def salva_trascrizione(percorso: Path, testo: str):
    if testo and percorso.suffix.lower() not in config.ESTENSIONI_TESTO:
        destinazione = config.CARTELLA_TRASCRIZIONI / f"{percorso.stem} - trascrizione.txt"
        destinazione.write_text(testo, encoding="utf-8")


def file_da_elaborare():
    estensioni = config.ESTENSIONI_AUDIO | config.ESTENSIONI_TESTO
    fatti = gia_elaborati()
    dal = date.fromisoformat(config.IGNORA_CHIAMATE_PRIMA_DEL) if config.IGNORA_CHIAMATE_PRIMA_DEL else None
    adesso = time.time()
    return sorted(
        (p for p in config.CARTELLA_IN_ARRIVO.iterdir()
         if p.is_file() and p.suffix.lower() in estensioni and not p.name.startswith(".")
         and p.name not in fatti
         and adesso - p.stat().st_mtime > ATTESA_FILE_STABILE
         and (dal is None or data_chiamata(p) >= dal)),
        key=lambda p: p.stat().st_mtime,
    )


def elabora(percorso: Path) -> str:
    log(f"Elaboro: {percorso.name}")
    testo = trascrizione.trascrivi(percorso)
    if not testo:
        log("  Trascrizione vuota (nessuna voce riconosciuta): nessuna modifica all'Excel.")
        return "trascrizione vuota"
    salva_trascrizione(percorso, testo)

    giorno = data_chiamata(percorso)
    dati = estrazione.estrai(testo, giorno)
    if not dati["chiamata_pertinente"]:
        log("  Chiamata non di lavoro: ignorata.")
        return "non di lavoro"

    # Il numero nel nome del file è quello reale di chi ha chiamato: ha la precedenza.
    dati["telefono"] = telefono_dal_nome_file(percorso.stem) or dati["telefono"]
    dati["data_chiamata"] = giorno.isoformat()
    dati["file"] = percorso.name

    esito = excel.registra(dati)
    nome = f"{dati['nome']} {dati['cognome']}".strip() or "(nome non detto)"
    log(f"  {nome}: {esito}")
    return f"{nome}: {esito}"


def giro():
    for percorso in file_da_elaborare():
        try:
            segna_elaborato(percorso, elabora(percorso))
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
            segna_elaborato(percorso, f"ERRORE: {e}")
            log(f"  ERRORE su {percorso.name}: {e}. Segnato in '{config.FILE_REGISTRO_ELABORATI.name}': "
                "cancella quella riga per riprovare.")


def main():
    try:
        config.CARTELLA_IN_ARRIVO.mkdir(parents=True, exist_ok=True)
    except OSError:
        log(f"La cartella '{config.CARTELLA_IN_ARRIVO}' non è raggiungibile: Google Drive per desktop è acceso? "
            "Controlla anche il percorso in config.py.")
        sys.exit(1)
    config.CARTELLA_TRASCRIZIONI.mkdir(exist_ok=True)

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
