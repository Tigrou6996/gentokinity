// tts: annunci della guida vocale con voce ElevenLabs.
// La chiave resta nei Secrets di Supabase (ELEVENLABS_API_KEY) e non finisce mai nell'app.
//
//   POST /tts   { "text": "Prossima fermata: Kassel Hauptbahnhof.", "voice_id": "opzionale" }
//   -> audio/mpeg
//
// Secrets: ELEVENLABS_API_KEY (obbligatorio), ELEVENLABS_VOICE_ID (voce predefinita), ELEVENLABS_MODEL (facoltativo)
const KEY = Deno.env.get('ELEVENLABS_API_KEY') ?? '';
const DEFAULT_VOICE = Deno.env.get('ELEVENLABS_VOICE_ID') ?? '';
const MODEL = Deno.env.get('ELEVENLABS_MODEL') ?? 'eleven_multilingual_v2';
const MAX_CHARS = 300; // gli annunci sono brevi: limite contro abusi e costi

const err = (msg: string, status: number) => new Response(JSON.stringify({ error: msg }), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return err('method not allowed', 405);
  if (!KEY) return err('ELEVENLABS_API_KEY non configurata', 500);
  let body: { text?: string; voice_id?: string };
  try { body = await req.json(); } catch { return err('JSON non valido', 400); }
  const text = (body.text ?? '').trim();
  const voice = (body.voice_id ?? '').trim() || DEFAULT_VOICE;
  if (!text) return err('testo mancante', 400);
  if (text.length > MAX_CHARS) return err(`testo troppo lungo (max ${MAX_CHARS})`, 400);
  if (!/^[A-Za-z0-9]{10,40}$/.test(voice)) return err('voice_id non valido', 400);

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
    }),
  });
  if (!r.ok) {
    console.error('elevenlabs', r.status, await r.text());
    return err('sintesi vocale non riuscita', 502);
  }
  return new Response(r.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
});
