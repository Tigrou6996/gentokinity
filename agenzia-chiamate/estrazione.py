"""Legge la trascrizione di una chiamata e ne estrae i dati del candidato con Claude."""

import json
from datetime import date

import anthropic

import config

ISTRUZIONI = """Sei l'assistente di un'agenzia per il lavoro italiana. Ricevi la trascrizione \
automatica di una telefonata tra un operatore dell'agenzia e una persona (candidato o cliente) \
e devi compilare la scheda di quella persona.

Regole:
- Scrivi in italiano.
- Riporta solo ciò che emerge davvero dalla chiamata. Se un dato non viene detto, lascia la \
stringa vuota "": non inventare e non dedurre oltre il ragionevole.
- La trascrizione è automatica e può contenere errori: correggi l'ortografia ovvia di nomi e \
cognomi italiani, ma non inventarli. Se viene detto solo il nome, lascia vuoto il cognome.
- telefono: solo se nella chiamata viene detto un numero; scrivilo con sole cifre (ed eventuale +).
- tipo_lavoro: il tipo di lavoro/mansione/settore che la persona cerca o richiede.
- disponibilita: orari, giorni, turni, da quando può iniziare, se ha la patente/auto, zona, ecc.
- competenze: esperienze, titoli di studio, lingue, patentini, conoscenze utili.
- riassunto: 2-4 frasi chiare sulla chiamata, utili all'operatore che la rileggerà.
- esito:
  * "interessato" se la persona è interessata alle proposte/al lavoro;
  * "non_interessato" solo se rifiuta chiaramente e non vuole essere ricontattata;
  * "non_chiaro" se dalla chiamata non si capisce.
- da_ricontattare: true se va richiamata (lo chiede lei, oppure l'operatore promette di \
richiamare, oppure "adesso no ma più avanti sì").
- data_ricontatto e disponibile_dal: in formato AAAA-MM-GG, calcolate rispetto alla data della \
chiamata (es. "lunedì prossimo"); "" se non indicate.
- chiamata_pertinente: false se la telefonata non riguarda il lavoro dell'agenzia \
(chiamata personale, pubblicità, numero sbagliato...)."""

SCHEMA = {
    "type": "object",
    "properties": {
        "chiamata_pertinente": {"type": "boolean"},
        "nome": {"type": "string"},
        "cognome": {"type": "string"},
        "telefono": {"type": "string"},
        "tipo_lavoro": {"type": "string"},
        "disponibilita": {"type": "string"},
        "competenze": {"type": "string"},
        "riassunto": {"type": "string"},
        "esito": {"type": "string", "enum": ["interessato", "non_interessato", "non_chiaro"]},
        "da_ricontattare": {"type": "boolean"},
        "data_ricontatto": {"type": "string"},
        "disponibile_dal": {"type": "string"},
    },
    "required": [
        "chiamata_pertinente", "nome", "cognome", "telefono", "tipo_lavoro", "disponibilita",
        "competenze", "riassunto", "esito", "da_ricontattare", "data_ricontatto", "disponibile_dal",
    ],
    "additionalProperties": False,
}

_client = None


class ErroreEstrazione(Exception):
    pass


def estrai(trascrizione: str, data_chiamata: date) -> dict:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()  # legge la chiave da ANTHROPIC_API_KEY

    risposta = _client.beta.messages.create(
        model=config.MODELLO_IA,
        max_tokens=16000,
        system=ISTRUZIONI,
        messages=[{
            "role": "user",
            "content": f"Data della chiamata: {data_chiamata.isoformat()}\n\n"
                       f"<trascrizione>\n{trascrizione}\n</trascrizione>",
        }],
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        # Se il modello principale rifiuta la richiesta, l'API la ripete su un modello di riserva.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )

    if risposta.stop_reason == "refusal":
        raise ErroreEstrazione("l'IA ha rifiutato di elaborare questa trascrizione")
    if risposta.stop_reason == "max_tokens":
        raise ErroreEstrazione("risposta dell'IA troncata")

    testo = next((b.text for b in risposta.content if b.type == "text"), None)
    if testo is None:
        raise ErroreEstrazione("risposta dell'IA vuota")
    return json.loads(testo)
