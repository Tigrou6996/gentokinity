import React, { useState, useEffect } from 'react';

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
    <>
      {/* Overlay leggero */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(61,32,69,0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 9998,
        }}
      />

      {/* Banner */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '680px',
          padding: '0 16px',
          zIndex: 9999,
          animation: 'cookieSlideUp 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both',
        }}
      >
        <style>{`
          @keyframes cookieSlideUp {
            from { opacity: 0; transform: translateX(-50%) translateY(40px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
        `}</style>

        <div
          style={{
            background: '#ffffff',
            border: '5px solid #3D2045',
            boxShadow: '8px 8px 0px #3D2045',
            padding: '28px 28px 24px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                background: '#6E4274',
                border: '4px solid #3D2045',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <i className="fas fa-cookie-bite" style={{ color: '#F59E0B', fontSize: '18px' }} />
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 900,
                  fontSize: '15px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#3D2045',
                }}
              >
                Utilizziamo i Cookie 🍪
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#6E4274',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Per migliorare la tua esperienza sul sito
              </div>
            </div>
          </div>

          {/* Testo */}
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#3D2045cc',
              lineHeight: 1.6,
              marginBottom: '10px',
            }}
          >
            Questo sito usa cookie tecnici necessari al funzionamento e, con il tuo consenso,
            cookie analitici (Google Analytics) per capire come viene utilizzato. I tuoi dati
            non vengono venduti a terzi.
          </p>

          {/* Dettagli espandibili */}
          <button
            onClick={() => setShowDetails(d => !d)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6E4274',
              fontSize: '12px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              cursor: 'pointer',
              padding: 0,
              marginBottom: showDetails ? '12px' : '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className={`fas fa-chevron-${showDetails ? 'up' : 'down'}`} style={{ fontSize: '10px' }} />
            {showDetails ? 'Nascondi dettagli' : 'Mostra dettagli'}
          </button>

          {showDetails && (
            <div
              style={{
                background: '#f9f6fa',
                border: '3px solid #6E427440',
                padding: '14px',
                marginBottom: '18px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#3D2045aa',
                lineHeight: 1.7,
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ color: '#3D2045', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🔒 Cookie Tecnici (sempre attivi)
                </strong>
                <br />
                Necessari per il corretto funzionamento del sito (sessione, sicurezza, preferenze).
              </div>
              <div>
                <strong style={{ color: '#3D2045', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📊 Google Analytics (con consenso) — {GA_ID}
                </strong>
                <br />
                Ci aiutano a capire come usi il sito (pagine visitate, provenienza, dispositivo).
                Gli IP sono anonimizzati. Nessun dato personale venduto.
              </div>
            </div>
          )}

          {/* Bottoni */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={accept}
              style={{
                flex: 1,
                minWidth: '140px',
                background: '#6E4274',
                color: '#fff',
                border: '4px solid #3D2045',
                boxShadow: '4px 4px 0px #3D2045',
                padding: '12px 20px',
                fontFamily: 'var(--font-inter)',
                fontWeight: 900,
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#3D2045')}
              onMouseLeave={e => (e.currentTarget.style.background = '#6E4274')}
            >
              <i className="fas fa-check" /> Accetta Tutti
            </button>

            <button
              onClick={decline}
              style={{
                flex: 1,
                minWidth: '140px',
                background: 'transparent',
                color: '#3D2045',
                border: '4px solid #3D2045',
                boxShadow: '4px 4px 0px #3D204560',
                padding: '12px 20px',
                fontFamily: 'var(--font-inter)',
                fontWeight: 900,
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9f6fa')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <i className="fas fa-times" /> Solo Necessari
            </button>
          </div>

          {/* Note GDPR */}
          <p
            style={{
              marginTop: '12px',
              fontSize: '10px',
              fontWeight: 700,
              color: '#3D204580',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              textAlign: 'center',
            }}
          >
            🔒 Ai sensi del GDPR (Reg. UE 2016/679) — puoi revocare il consenso in qualsiasi momento.
          </p>
        </div>
      </div>
    </>
  );
};

export default CookieBanner;
