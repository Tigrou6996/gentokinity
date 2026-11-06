// Netlify Serverless Function: send-login-alert
// Invia un'email di avviso di accesso all'utente usando Resend

interface LoginAlertPayload {
  email: string;
  fullName?: string | null;
  userAgent?: string;
  timestamp?: string;
}

export const handler = async (event: { httpMethod: string; body: string | null; headers: Record<string, string | undefined> }) => {
  // Gestione preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[send-login-alert] RESEND_API_KEY non trovata nelle variabili di ambiente.');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        warning: 'RESEND_API_KEY_MISSING',
        message: 'Chiave API Resend non configurata. Aggiungi RESEND_API_KEY nelle impostazioni del sito o in .env.local.',
      }),
    };
  }

  try {
    const data: LoginAlertPayload = JSON.parse(event.body || '{}');
    const { email, fullName, userAgent, timestamp } = data;

    if (!email) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email mancante' }),
      };
    }

    // IP da Netlify headers
    const clientIp =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['client-ip'] ||
      event.headers['x-forwarded-for']?.split(',')[0].trim() ||
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
    const siteUrl = process.env.URL || 'https://lbswork.com';

    // Rilevamento browser / sistema operativo semplificato
    let deviceDesc = 'Dispositivo sconosciuto';
    if (userAgent) {
      if (userAgent.includes('Windows')) deviceDesc = 'Windows PC';
      else if (userAgent.includes('Macintosh')) deviceDesc = 'Mac / Apple';
      else if (userAgent.includes('Android')) deviceDesc = 'Smartphone Android';
      else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) deviceDesc = 'iPhone / iPad';
      else if (userAgent.includes('Linux')) deviceDesc = 'Linux';

      if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) deviceDesc += ' (Chrome)';
      else if (userAgent.includes('Edg')) deviceDesc += ' (Edge)';
      else if (userAgent.includes('Firefox')) deviceDesc += ' (Firefox)';
      else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) deviceDesc += ' (Safari)';
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

    // Invio tramite Resend API
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
      return {
        statusCode: 200, // Non bloccare il flusso client
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: resendData.message || 'Errore durante l\'invio dell\'email',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        id: resendData.id,
        message: 'Email di notifica accesso inviata con successo',
      }),
    };
  } catch (err: any) {
    console.error('[send-login-alert] Eccezione:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Errore interno' }),
    };
  }
};
