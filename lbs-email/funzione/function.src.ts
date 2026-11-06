// Supabase Edge Function "email-candidature" - LBS Lavoro Business e Servizi
//
// Chiamata da un Database Webhook di Supabase sulla tabella "candidature":
//   - INSERT  -> email "Candidatura ricevuta" al candidato
//   - UPDATE  -> (solo se INVIA_ESITO = "si") email "accettata" o "rifiutata" quando cambia lo stato
// Le email partono dalla casella Aruba (SMTP) indicata nei Secrets.
//
// Secrets da impostare (Supabase > Edge Functions > Secrets):
//   SMTP_USER       info@lbswork.com
//   SMTP_PASS       password della casella
//   WEBHOOK_SECRET  una parola segreta lunga, la stessa messa nell'header x-webhook-secret del webhook
// Facoltativi:
//   SMTP_HOST (smtps.aruba.it)  SMTP_PORT (465)  SMTP_SECURE (true)
//   COPIA_A          indirizzo che riceve una copia nascosta di ogni email (es. info@lbswork.com)
//   INVIA_ESITO      "si" per inviare anche le email di esito quando cambi lo stato dal pannello admin
//   STATO_ACCETTATA  valore di "stato" che vale come accettata (vuoto = mai)
//   STATO_RIFIUTATA  valore di "stato" che vale come rifiutata (predefinito: rifiutata)
//
// FILE GENERATO: i modelli HTML qui sotto vengono da lbs-email/*.html (node lbs-email/funzione/build.mjs).
import nodemailer from "npm:nodemailer@6.9.16";

const TEMPLATES: Record<string, string> = /*TEMPLATES*/ {};

const SUBJECTS: Record<string, string> = {
  ricevuta: "{{NOME}}, abbiamo ricevuto la tua candidatura",
  accettata: "{{NOME}}, la tua candidatura è stata accettata ✅",
  rifiutata: "{{NOME}}, l'esito della tua candidatura",
};

const TEXTS: Record<string, string> = {
  ricevuta: "Ciao {{NOME}},\n\nabbiamo ricevuto la tua candidatura per {{POSIZIONE}}. Il nostro team esaminerà il tuo profilo e ti ricontatteremo entro 24 ore dal numero +39 351 881 8391.\n\nPer qualsiasi domanda: +39 351 881 8391 (anche WhatsApp) - info@lbswork.com\n\nIl team LBS - Lavoro Business e Servizi\nwww.lbswork.com",
  accettata: "Ciao {{NOME}},\n\nla tua candidatura per {{POSIZIONE}} è stata accettata! Un nostro consulente ti contatterà a breve per fissare un colloquio dal numero +39 351 881 8391.\nSe non ti abbiamo ricontattato entro 24 ore, chiamaci tu al +39 351 881 8391.\n\nIl team LBS - Lavoro Business e Servizi\nwww.lbswork.com",
  rifiutata: "Ciao {{NOME}},\n\ngrazie per esserti candidato con noi. Abbiamo esaminato con attenzione la tua candidatura per {{POSIZIONE}}: purtroppo, in questo momento, non possiamo procedere.\nSul nostro sito trovi altre offerte di lavoro in Germania: www.lbswork.com\nPer domande: +39 351 881 8391 (anche WhatsApp).\n\nIl team LBS - Lavoro Business e Servizi",
};

const env = (k: string, d = "") => (Deno.env.get(k) ?? d).trim();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
const reply = (status: number, msg: string) => new Response(JSON.stringify({ ok: status < 300, msg }), { status, headers: { "Content-Type": "application/json" } });

function pickTemplate(p: { type: string; record: Record<string, unknown>; old_record?: Record<string, unknown> | null }): string | null {
  if (p.type === "INSERT") return "ricevuta";
  if (p.type !== "UPDATE" || env("INVIA_ESITO").toLowerCase() !== "si") return null;
  const now = String(p.record?.stato ?? ""), before = String(p.old_record?.stato ?? "");
  if (!now || now === before) return null;
  if (env("STATO_ACCETTATA") && now === env("STATO_ACCETTATA")) return "accettata";
  if (now === env("STATO_RIFIUTATA", "rifiutata")) return "rifiutata";
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, "solo POST");
  const secret = env("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return reply(401, "non autorizzato");

  const p = await req.json().catch(() => null);
  if (!p || p.table !== "candidature" || !p.record) return reply(200, "ignorato");
  const tpl = pickTemplate(p);
  if (!tpl) return reply(200, "nessuna email da inviare");

  const r = p.record as Record<string, string | null>;
  const to = oneLine(r.email ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return reply(200, "email del candidato mancante o non valida");

  const nome = oneLine(r.nome ?? "") || "candidato";
  const posizione = oneLine(r.offerta_titolo || r.settore || "") || "una posizione in Germania";
  const fill = (s: string, html: boolean) => s.replaceAll("{{NOME}}", html ? esc(nome) : nome).replaceAll("{{POSIZIONE}}", html ? esc(posizione) : posizione);

  const user = env("SMTP_USER");
  const transporter = nodemailer.createTransport({
    host: env("SMTP_HOST", "smtps.aruba.it"),
    port: Number(env("SMTP_PORT", "465")),
    secure: env("SMTP_SECURE", "true") !== "false",
    auth: { user, pass: env("SMTP_PASS") },
  });
  try {
    await transporter.sendMail({
      from: `"LBS - Lavoro Business e Servizi" <${user}>`,
      to,
      bcc: env("COPIA_A") || undefined,
      replyTo: user,
      subject: fill(SUBJECTS[tpl], false),
      text: fill(TEXTS[tpl], false),
      html: fill(TEMPLATES[tpl], true),
    });
  } catch (e) {
    console.error("invio email fallito:", e);
    return reply(500, "invio fallito: " + (e instanceof Error ? e.message : String(e)));
  }
  console.log(`email "${tpl}" inviata a ${to}`);
  return reply(200, `email "${tpl}" inviata`);
});
