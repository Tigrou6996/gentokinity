/**
 * Natural text-to-speech for the chat (free Microsoft Edge "Read aloud" neural voices, no key needed).
 *
 * - VOICES: the curated list shown in the dashboard (name, language, gender, style).
 * - synthesize(): text -> MP3 buffer, with a small memory cache (same message, same voice = no new request).
 * The synthesis runs on the server: browsers can't open the Edge speech service themselves.
 */
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const VOICES = [
    // Français
    { id: 'fr-FR-DeniseNeural', name: 'Denise', lang: 'fr-FR', gender: 'F', style: 'Claire et posée' },
    { id: 'fr-FR-VivienneMultilingualNeural', name: 'Vivienne', lang: 'fr-FR', gender: 'F', style: 'Chaleureuse, très naturelle' },
    { id: 'fr-FR-EloiseNeural', name: 'Eloise', lang: 'fr-FR', gender: 'F', style: 'Jeune, enjouée' },
    { id: 'fr-FR-HenriNeural', name: 'Henri', lang: 'fr-FR', gender: 'M', style: 'Grave, radio' },
    { id: 'fr-FR-RemyMultilingualNeural', name: 'Rémy', lang: 'fr-FR', gender: 'M', style: 'Dynamique, très naturel' },
    { id: 'fr-CA-SylvieNeural', name: 'Sylvie', lang: 'fr-CA', gender: 'F', style: 'Québécoise' },
    { id: 'fr-CA-AntoineNeural', name: 'Antoine', lang: 'fr-CA', gender: 'M', style: 'Québécois' },
    { id: 'fr-CA-JeanNeural', name: 'Jean', lang: 'fr-CA', gender: 'M', style: 'Québécois, posé' },
    { id: 'fr-BE-CharlineNeural', name: 'Charline', lang: 'fr-BE', gender: 'F', style: 'Belge' },
    { id: 'fr-BE-GerardNeural', name: 'Gérard', lang: 'fr-BE', gender: 'M', style: 'Belge' },
    { id: 'fr-CH-ArianeNeural', name: 'Ariane', lang: 'fr-CH', gender: 'F', style: 'Suisse' },
    { id: 'fr-CH-FabriceNeural', name: 'Fabrice', lang: 'fr-CH', gender: 'M', style: 'Suisse' },
    // English
    { id: 'en-US-AvaMultilingualNeural', name: 'Ava', lang: 'en-US', gender: 'F', style: 'Natural, expressive' },
    { id: 'en-US-EmmaMultilingualNeural', name: 'Emma', lang: 'en-US', gender: 'F', style: 'Friendly' },
    { id: 'en-US-JennyNeural', name: 'Jenny', lang: 'en-US', gender: 'F', style: 'Assistant' },
    { id: 'en-US-AndrewMultilingualNeural', name: 'Andrew', lang: 'en-US', gender: 'M', style: 'Warm, natural' },
    { id: 'en-US-BrianMultilingualNeural', name: 'Brian', lang: 'en-US', gender: 'M', style: 'Casual' },
    { id: 'en-US-GuyNeural', name: 'Guy', lang: 'en-US', gender: 'M', style: 'Newscaster' },
    { id: 'en-GB-SoniaNeural', name: 'Sonia', lang: 'en-GB', gender: 'F', style: 'British' },
    { id: 'en-GB-RyanNeural', name: 'Ryan', lang: 'en-GB', gender: 'M', style: 'British' },
    // Español
    { id: 'es-ES-ElviraNeural', name: 'Elvira', lang: 'es-ES', gender: 'F', style: 'España' },
    { id: 'es-ES-AlvaroNeural', name: 'Álvaro', lang: 'es-ES', gender: 'M', style: 'España' },
    { id: 'es-MX-DaliaNeural', name: 'Dalia', lang: 'es-MX', gender: 'F', style: 'México' },
    { id: 'es-MX-JorgeNeural', name: 'Jorge', lang: 'es-MX', gender: 'M', style: 'México' },
    // Deutsch
    { id: 'de-DE-SeraphinaMultilingualNeural', name: 'Seraphina', lang: 'de-DE', gender: 'F', style: 'Natürlich' },
    { id: 'de-DE-KatjaNeural', name: 'Katja', lang: 'de-DE', gender: 'F', style: 'Klar' },
    { id: 'de-DE-FlorianMultilingualNeural', name: 'Florian', lang: 'de-DE', gender: 'M', style: 'Natürlich' },
    { id: 'de-DE-ConradNeural', name: 'Conrad', lang: 'de-DE', gender: 'M', style: 'Tief' },
    // Italiano
    { id: 'it-IT-IsabellaNeural', name: 'Isabella', lang: 'it-IT', gender: 'F', style: 'Naturale' },
    { id: 'it-IT-ElsaNeural', name: 'Elsa', lang: 'it-IT', gender: 'F', style: 'Chiara' },
    { id: 'it-IT-DiegoNeural', name: 'Diego', lang: 'it-IT', gender: 'M', style: 'Caldo' },
    // Português
    { id: 'pt-BR-ThalitaMultilingualNeural', name: 'Thalita', lang: 'pt-BR', gender: 'F', style: 'Brasil' },
    { id: 'pt-BR-FranciscaNeural', name: 'Francisca', lang: 'pt-BR', gender: 'F', style: 'Brasil' },
    { id: 'pt-BR-AntonioNeural', name: 'Antônio', lang: 'pt-BR', gender: 'M', style: 'Brasil' },
    { id: 'pt-PT-RaquelNeural', name: 'Raquel', lang: 'pt-PT', gender: 'F', style: 'Portugal' },
    { id: 'pt-PT-DuarteNeural', name: 'Duarte', lang: 'pt-PT', gender: 'M', style: 'Portugal' }
];
const VOICE_IDS = new Set(VOICES.map(v => v.id));
const DEFAULT_VOICE = 'fr-FR-DeniseNeural';
// Old TikTok voice ids saved in user settings keep working
const LEGACY = { fr_001: 'fr-FR-DeniseNeural', fr_002: 'fr-FR-HenriNeural' };

const MAX_CHARS = 300;
const CACHE_MAX = 300;
const TIMEOUT_MS = 15000;
const cache = new Map(); // key -> Buffer (insertion order = age)

// Tests replace the Edge client (the speech service is not reachable everywhere)
let createClient = () => new MsEdgeTTS();
function setClientFactory(fn) { createClient = fn; cache.clear(); }

function resolveVoice(voice) {
    if (VOICE_IDS.has(voice)) return voice;
    return LEGACY[voice] || DEFAULT_VOICE;
}

// The text goes inside SSML: <, & and quotes must not break it (or inject SSML tags)
function escapeXml(text) {
    return String(text).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

// Dashboard speed (0.5 - 2) and pitch (0 - 2, 1 = normal) to SSML prosody
function prosody(rate, pitch) {
    const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? 1 : Number(v));
    const r = Math.min(Math.max(num(rate), 0.5), 2);
    const p = Math.min(Math.max(num(pitch), 0), 2);
    const pct = Math.round((p - 1) * 50);
    return { rate: r, pitch: `${pct >= 0 ? '+' : ''}${pct}%` };
}

function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
}

async function synthesize(text, voice, rate, pitch) {
    const input = cleanText(text);
    if (!input) throw new Error('Texte vide');
    const v = resolveVoice(voice);
    const opts = prosody(rate, pitch);
    const key = `${v}|${opts.rate}|${opts.pitch}|${input}`;
    if (cache.has(key)) {
        const hit = cache.get(key);
        cache.delete(key); cache.set(key, hit); // most recently used
        return hit;
    }

    const tts = createClient();
    try {
        await tts.setMetadata(v, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(escapeXml(input), opts);
        const audio = await new Promise((resolve, reject) => {
            const chunks = [];
            const timer = setTimeout(() => reject(new Error('Délai dépassé')), TIMEOUT_MS);
            audioStream.on('data', c => chunks.push(c));
            audioStream.on('error', e => { clearTimeout(timer); reject(e); });
            audioStream.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
            audioStream.on('close', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
        });
        if (!audio.length) throw new Error('Aucun audio reçu');
        cache.set(key, audio);
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
        return audio;
    } finally {
        try { tts.close(); } catch (e) { }
    }
}

module.exports = { VOICES, DEFAULT_VOICE, MAX_CHARS, resolveVoice, escapeXml, prosody, cleanText, synthesize, setClientFactory };
