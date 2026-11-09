
import React from 'react';
import { Link } from 'react-router-dom';

const Maintenance: React.FC = () => (
  <div style={{
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #3D2045 0%, #6E4274 50%, #3D2045 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    position: 'relative',
    overflow: 'hidden',
  }}>
    {/* Comic background decorations */}
    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', top: '-150px', right: '-150px', width: '500px', height: '500px', background: 'rgba(253,224,71,0.08)', borderRadius: '50%', filter: 'blur(60px)' }} />
    <div style={{ position: 'absolute', bottom: '-150px', left: '-150px', width: '500px', height: '500px', background: 'rgba(253,224,71,0.06)', borderRadius: '50%', filter: 'blur(60px)' }} />

    <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: '700px' }}>

      {/* Icon */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '120px', height: '120px',
        background: '#FDE047',
        border: '6px solid rgba(255,255,255,0.3)',
        boxShadow: '8px 8px 0px rgba(0,0,0,0.3)',
        marginBottom: '40px',
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        <i className="fas fa-tools" style={{ fontSize: '52px', color: '#3D2045' }} />
      </div>

      {/* Badge */}
      <div style={{
        display: 'inline-block',
        background: '#FDE047',
        color: '#3D2045',
        fontWeight: 900,
        fontSize: '11px',
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        padding: '6px 20px',
        border: '3px solid rgba(0,0,0,0.2)',
        boxShadow: '4px 4px 0px rgba(0,0,0,0.2)',
        marginBottom: '28px',
      }}>
        🔧 Manutenzione in Corso
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'var(--font-heading, "Bangers", cursive)',
        fontWeight: 900,
        fontSize: 'clamp(2.5rem, 6vw, 5rem)',
        color: '#fff',
        letterSpacing: '-0.03em',
        textTransform: 'uppercase',
        lineHeight: 1.1,
        margin: '0 0 32px',
        textShadow: '4px 4px 0px rgba(0,0,0,0.3)',
      }}>
        Il sito è in<br /><span style={{ color: '#FDE047' }}>Manutenzione</span>
      </h1>

      {/* Message */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        border: '4px solid rgba(255,255,255,0.25)',
        padding: '32px 40px',
        marginBottom: '40px',
        backdropFilter: 'blur(10px)',
      }}>
        <p style={{
          color: 'rgba(255,255,255,0.95)',
          fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
          fontWeight: 700,
          lineHeight: 1.7,
          margin: 0,
          fontStyle: 'italic',
        }}>
          "Il sito è in manutenzione, abbi solo un pò di pazienza
          stiamo lavorando per migliorare la tua esperienza sul sito"
        </p>
      </div>

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
        marginBottom: '40px',
      }}>
        <div style={{
          fontFamily: 'var(--font-heading, "Bangers", cursive)',
          fontWeight: 900, fontSize: '20px', color: '#FDE047',
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>LBS — Lavoro Business e Servizi in Germania</div>
      </div>

      {/* Admin login link */}
      <Link to="/login" style={{ textDecoration: 'none' }}>
        <button style={{
          background: 'transparent',
          border: '3px solid rgba(255,255,255,0.3)',
          color: 'rgba(255,255,255,0.5)',
          padding: '10px 24px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.6)';
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
          }}
        >
          <i className="fas fa-lock" style={{ marginRight: '8px' }} />
          Accesso Staff
        </button>
      </Link>
    </div>

    <style>{`
      @keyframes pulse {
        0%, 100% { transform: scale(1); box-shadow: 8px 8px 0px rgba(0,0,0,0.3); }
        50% { transform: scale(1.05); box-shadow: 10px 10px 0px rgba(0,0,0,0.4); }
      }
    `}</style>
  </div>
);

export default Maintenance;
