"""Trasforma la registrazione audio di una chiamata in testo (Whisper, in locale)."""

from pathlib import Path

import config

_modello = None


def _carica_modello():
    global _modello
    if _modello is None:
        # Import qui: chi usa solo trascrizioni .txt non ha bisogno di faster-whisper.
        from faster_whisper import WhisperModel

        print(f"  Carico il modello di trascrizione '{config.MODELLO_WHISPER}' (la prima volta lo scarica)...")
        _modello = WhisperModel(config.MODELLO_WHISPER, device="cpu", compute_type="int8")
    return _modello


def trascrivi(percorso: Path) -> str:
    if percorso.suffix.lower() in config.ESTENSIONI_TESTO:
        return percorso.read_text(encoding="utf-8", errors="replace").strip()

    segmenti, _ = _carica_modello().transcribe(str(percorso), language=config.LINGUA, vad_filter=True)
    return " ".join(s.text.strip() for s in segmenti).strip()
