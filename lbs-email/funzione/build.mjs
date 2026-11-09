// build.mjs: put the three email templates inside the Edge Function, so it is a single file to paste in Supabase.
//   node lbs-email/funzione/build.mjs   ->  lbs-email/supabase/functions/email-candidature/index.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const strip = html => html.replace(/<!--\s*\n[\s\S]*?-->\n/, '');   // drop the editor's notes comment, keep Outlook conditionals
const templates = Object.fromEntries(['ricevuta', 'accettata', 'rifiutata'].map(k => [k, strip(readFileSync(path.join(root, `candidatura-${k}.html`), 'utf8'))]));
const src = readFileSync(path.join(here, 'function.src.ts'), 'utf8').replace('/*TEMPLATES*/ {}', JSON.stringify(templates, null, 2));
const outDir = path.join(root, 'supabase', 'functions', 'email-candidature');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'index.ts'), src);
console.log('->', path.relative(process.cwd(), path.join(outDir, 'index.ts')), `(${Math.round(src.length / 1024)} KB)`);
