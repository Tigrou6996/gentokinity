// Vercel Serverless Function: api/send-login-alert.ts
// Invia un'email di avviso di accesso all'utente usando Resend (compatibile con piano gratuito Vercel Hobby)

interface LoginAlertPayload {
  email: string;
  fullName?: string | null;
  userAgent?: string;
  timestamp?: string;
}

export default async function handler(req: any, res: any) {
  // Gestione CORS per chiamate dal frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[send-login-alert] RESEND_API_KEY non trovata nelle variabili di ambiente.');
    return res.status(200).json({
      success: false,
      warning: 'RESEND_API_KEY_MISSING',
      message: 'Chiave API Resend non configurata nelle variabili di ambiente di Vercel.',
    });
  }

  try {
    const data: LoginAlertPayload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { email, fullName, userAgent, timestamp } = data;

    if (!email) {
      return res.status(400).json({ error: 'Email mancante' });
    }

    // IP del client da Vercel headers
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      'Non rilevato';

    // Formattazione data italiana
    const dateObj = timestamp ? new Date(timestamp) : new Date();
    const formattedDate = dateObj.toLocaleString('it-IT', {
      timeZone: 'Europe/Rome',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const userDisplayName = fullName ? fullName : email.split('@')[0];
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'LBS Business <onboarding@resend.dev>';
    const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : (process.env.URL || 'https://lbswork.com');

    // Rilevamento dispositivo
    let deviceDesc = 'Dispositivo sconosciuto';
    const ua = userAgent || (req.headers['user-agent'] as string) || '';
    if (ua) {
      if (ua.includes('Windows')) deviceDesc = 'Windows PC';
      else if (ua.includes('Macintosh')) deviceDesc = 'Mac / Apple';
      else if (ua.includes('Android')) deviceDesc = 'Smartphone Android';
      else if (ua.includes('iPhone') || ua.includes('iPad')) deviceDesc = 'iPhone / iPad';
      else if (ua.includes('Linux')) deviceDesc = 'Linux';

      if (ua.includes('Chrome') && !ua.includes('Edg')) deviceDesc += ' (Chrome)';
      else if (ua.includes('Edg')) deviceDesc += ' (Edge)';
      else if (ua.includes('Firefox')) deviceDesc += ' (Firefox)';
      else if (ua.includes('Safari') && !ua.includes('Chrome')) deviceDesc += ' (Safari)';
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <title>Nuovo accesso al tuo account LBS</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #1f2937; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 4px solid #3D2045; box-shadow: 6px 6px 0px #3D2045; padding: 36px 32px; }
    .header { text-align: center; border-bottom: 3px solid #6E4274; padding-bottom: 20px; margin-bottom: 24px; }
    .logo-badge { display: inline-block; background: #6E4274; color: #ffffff; font-weight: 900; font-size: 16px; padding: 8px 18px; border: 2px solid #3D2045; text-transform: uppercase; letter-spacing: 0.1em; }
    h1 { color: #3D2045; font-size: 22px; font-weight: 900; margin: 16px 0 8px; text-transform: uppercase; }
    p { font-size: 15px; line-height: 1.6; color: #4b5563; margin: 12px 0; }
    .details-box { background: #faf5ff; border: 2px solid #6E4274; padding: 18px 22px; margin: 24px 0; border-radius: 4px; }
    .details-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .details-table td { padding: 8px 4px; vertical-align: top; }
    .details-table td.label { font-weight: 700; color: #6E4274; width: 130px; text-transform: uppercase; font-size: 12px; letter-spacing: 0.05em; }
    .btn { display: inline-block; background: #6E4274; color: #ffffff !important; text-decoration: none; padding: 12px 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; border: 3px solid #3D2045; box-shadow: 4px 4px 0px #3D2045; font-size: 13px; margin: 16px 0; }
    .alert-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; font-size: 13px; color: #92400e; margin-top: 20px; }
    .footer { text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">LBS • Lavoro Business</div>
      <h1>Nuovo Accesso Rilevato</h1>
    </div>

    <p>Ciao <strong>${userDisplayName}</strong>,</p>
    <p>Ti informiamo che è stato effettuato un nuovo accesso al tuo account sulla piattaforma <strong>LBS - Lavoro Business in Germania</strong>.</p>

    <div class="details-box">
      <table class="details-table">
        <tr>
          <td class="label">Account:</td>
          <td><strong>${email}</strong></td>
        </tr>
        <tr>
          <td class="label">Data e Ora:</td>
          <td>${formattedDate} (Ora italiana)</td>
        </tr>
        <tr>
          <td class="label">Dispositivo:</td>
          <td>${deviceDesc}</td>
        </tr>
        <tr>
          <td class="label">Indirizzo IP:</td>
          <td>${clientIp}</td>
        </tr>
      </table>
    </div>

    <p>Se sei stato tu ad effettuare l'accesso, non è richiesta alcuna azione da parte tua.</p>

    <div class="alert-box">
      <strong>Non riconosci questo accesso?</strong><br>
      Se non hai effettuato tu questo accesso, qualcun altro potrebbe avere le tue credenziali. Ti raccomandiamo di reimpostare immediatamente la tua password.
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="${siteUrl}/login" class="btn">Gestisci il tuo Account</a>
    </div>

    <div class="footer">
      <p>LBS - Lavoro Business e Servizi in Germania<br>Viale Vittorio Veneto, 335 — 95126 Catania (CT), Italia<br>Email: info@lbswork.com</p>
      <p>Questa è una notifica automatica di sicurezza del sistema.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: '🔐 Nuovo accesso al tuo account LBS Business',
        html: htmlContent,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('[send-login-alert] Errore da Resend API:', resendData);
      return res.status(200).json({
        success: false,
        error: resendData.message || "Errore durante l'invio dell'email",
      });
    }

    return res.status(200).json({
      success: true,
      id: resendData.id,
      message: 'Email di notifica accesso inviata con successo',
    });
  } catch (err: any) {
    console.error('[send-login-alert] Eccezione:', err);
    return res.status(500).json({ error: err.message || 'Errore interno' });
  }
}
