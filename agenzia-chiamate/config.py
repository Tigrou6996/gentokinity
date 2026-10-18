"""Impostazioni del programma. Modifica solo questo file."""

from pathlib import Path

CARTELLA_BASE = Path(__file__).resolve().parent

# Cartella dove arrivano le registrazioni delle chiamate (audio o trascrizioni .txt).
# Con Google Drive per desktop su Windows, ad esempio:
#   CARTELLA_IN_ARRIVO = Path(r"G:\Il mio Drive\Registrazioni chiamate")
CARTELLA_IN_ARRIVO = CARTELLA_BASE / "chiamate_in_arrivo"

# Le registrazioni elaborate restano dove sono: qui il programma si segna quali ha già fatto.
FILE_REGISTRO_ELABORATI = CARTELLA_BASE / "gia_elaborati.txt"

# Qui viene salvata la trascrizione di ogni chiamata audio, per poterla rileggere.
CARTELLA_TRASCRIZIONI = CARTELLA_BASE / "trascrizioni"

# Le registrazioni fatte prima di questa data (AAAA-MM-GG) vengono ignorate, così le vecchie
# chiamate già presenti sul telefono non finiscono nell'Excel. Metti None per elaborarle tutte.
IGNORA_CHIAMATE_PRIMA_DEL = "2026-10-16"

# Il file Excel con la lista dei candidati.
FILE_EXCEL = CARTELLA_BASE / "candidati.xlsx"

# Testo usato quando un'informazione non è emersa nella chiamata.
NON_COMUNICATO = "Non comunicato ancora"

# Se True, chi non è interessato finisce in un foglio separato "Non interessati"
# (utile per non richiamarlo). Se False, non viene salvato da nessuna parte.
SALVA_NON_INTERESSATI = False

# Modello IA che legge la trascrizione e compila la tabella.
MODELLO_IA = "claude-opus-5-5"

# Modello di trascrizione (Whisper, gira sul tuo computer, gratis).
# "small" = veloce, "medium" = più preciso ma più lento, "large-v3" = il migliore.
MODELLO_WHISPER = "small"
LINGUA = "it"

# Ogni quanti secondi controllare se sono arrivate nuove chiamate (modalità --continuo).
INTERVALLO_SECONDI = 30

ESTENSIONI_AUDIO = {".mp3", ".m4a", ".wav", ".ogg", ".opus", ".amr", ".aac", ".flac", ".3gp", ".mp4", ".webm"}
ESTENSIONI_TESTO = {".txt"}
