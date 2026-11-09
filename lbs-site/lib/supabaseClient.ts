import { createClient } from '@supabase/supabase-js';

// Valori pubblici del progetto (gli stessi usati da api/jooble-feed.ts): permettono
// al sito di avviarsi anche senza .env.local, invece di bloccarsi con
// "supabaseUrl is required" e lasciare a schermo la pagina statica di index.html.
const FALLBACK_URL = 'https://iedgiiucirqqrldvqqro.supabase.co';
const FALLBACK_ANON_KEY = 'sb_publishable_A-QQ2F_-qrzdMN34Q8liZQ_lNbJ671B';

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!envUrl || !envKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY non impostate: uso i valori pubblici predefiniti. Copia .env.local nella cartella del progetto.');
}

const supabaseUrl = envUrl || FALLBACK_URL;
const supabaseAnonKey = envKey || FALLBACK_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
