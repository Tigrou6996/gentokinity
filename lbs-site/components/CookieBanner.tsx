import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const COOKIE_KEY = 'lbs_cookie_consent';
const GA_ID = 'G-434XX8P8NY';

// ─── Carica Google Analytics dinamicamente ────────────────────────────────────
const loadGA = () => {
  if ((window as any).gaLoaded) return; // evita doppio caricamento
  (window as any).gaLoaded = true;

  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  script.async = true;
  document.head.appendChild(script);

  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) { (window as any).dataLayer.push(args); }
  (window as any).gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { anonymize_ip: true });
};

const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (consent === 'accepted') {
      // Ha già accettato in precedenza → carica subito GA
      loadGA();
    } else if (!consent) {
      // Nessuna scelta ancora → mostra il banner dopo 800ms
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    loadGA();
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Consenso cookie"
      className="fixed z-[9998] bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-md animate-pop-in"
    >
      <div className="bg-white rounded-xl border border-line shadow-[var(--shadow-lift)] p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="icon-tile !w-10 !h-10 !rounded-md !bg-sun-100 !text-plum-800">
            <i className="fas fa-cookie-bite" />
          </div>
          <div>
            <div className="font-semibold text-plum-800 text-lg leading-tight">Usiamo i cookie</div>
            <p className="text-sm text-ink-soft leading-relaxed mt-1">
              Cookie tecnici necessari e, con il tuo consenso, Google Analytics per capire come
              viene usato il sito. I tuoi dati non vengono venduti a terzi.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails(d => !d)}
          aria-expanded={showDetails}
          className="text-sm font-semibold text-plum-600 hover:text-plum-800 flex items-center gap-1.5 mb-3 cursor-pointer"
        >
          {showDetails ? 'Nascondi dettagli' : 'Mostra dettagli'}
          <i className={`fas fa-chevron-${showDetails ? 'up' : 'down'} text-[10px]`} />
        </button>

        {showDetails && (
          <div className="rounded-lg bg-plum-50 p-4 mb-4 text-xs text-ink-soft leading-relaxed space-y-2">
            <div>
              <strong className="text-plum-800">Cookie tecnici (sempre attivi)</strong><br />
              Necessari per il corretto funzionamento del sito (sessione, sicurezza, preferenze).
            </div>
            <div>
              <strong className="text-plum-800">Google Analytics (con consenso) — {GA_ID}</strong><br />
              Ci aiutano a capire come usi il sito (pagine visitate, provenienza, dispositivo).
              Gli IP sono anonimizzati. Nessun dato personale venduto.
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={decline} className="btn btn-outline btn-sm flex-1">
            Solo necessari
          </button>
          <button type="button" onClick={accept} className="btn btn-primary btn-sm flex-1">
            Accetta tutti
          </button>
        </div>

        <p className="mt-3 text-[11px] text-ink-soft/80 text-center">
          Ai sensi del GDPR (Reg. UE 2016/679) puoi revocare il consenso in qualsiasi momento.{' '}
          <Link to="/cookie-policy" className="underline hover:text-plum-600">Cookie policy</Link>
        </p>
      </div>
    </div>
  );
};

export default CookieBanner;
