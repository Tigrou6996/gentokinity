/**
 * Servizio per l'invio delle notifiche email (es. avviso di nuovo accesso).
 * Utilizza la Netlify Serverless Function / API endpoint basata su Resend.
 */

interface SendLoginAlertParams {
  email: string;
  fullName?: string | null;
  userAgent?: string;
}

export const sendLoginAlertEmail = async (params: SendLoginAlertParams): Promise<{ success: boolean; error?: string }> => {
  try {
    const payload = {
      email: params.email,
      fullName: params.fullName || null,
      userAgent: params.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Sconosciuto'),
      timestamp: new Date().toISOString(),
    };

    // Supporto nativo per Vercel (/api/send-login-alert) con fallback per Netlify
    let response = await fetch('/api/send-login-alert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 404) {
      response = await fetch('/.netlify/functions/send-login-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.warn('[LBS Email Alert] Avviso invio email:', data.message || response.statusText);
      return { success: false, error: data.message || response.statusText };
    }

    const resData = await response.json().catch(() => ({ success: true }));
    return { success: true, ...resData };
  } catch (err: any) {
    console.warn('[LBS Email Alert] Errore connessione servizio email:', err?.message || err);
    return { success: false, error: err?.message || 'Errore di rete' };
  }
};
