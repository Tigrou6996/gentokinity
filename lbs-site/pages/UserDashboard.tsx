import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import logoLBS from '../img/logo_LBS-192.png';

const STATO_COLORS: Record<string, { bg: string; label: string }> = {
  nuova: { bg: '#6E4274', label: 'Inviata' },
  in_lavorazione: { bg: '#FF6B35', label: 'In Revisione' },
  completata: { bg: '#25D366', label: 'Completata' },
  rifiutata: { bg: '#dc2626', label: 'Non Idonea' },
};

interface MiaCandidatura {
  id: string;
  offerta_titolo: string | null;
  settore: string | null;
  stato: string;
  created_at: string;
}

const UserDashboard: React.FC = () => {
  const { user, profile, signOut, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [candidature, setCandidature] = useState<MiaCandidatura[]>([]);
  const [loadingCand, setLoadingCand] = useState(true);

  // Stato per cambio password
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmNewPwd, setShowConfirmNewPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  // 🛡️ Guard: se l'utente è admin non deve vedere la dashboard utente
  useEffect(() => {
    if (profile?.role === 'admin' || (user as any)?.user_metadata?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [profile, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('candidature')
      .select('id, offerta_titolo, settore, stato, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setCandidature(data as MiaCandidatura[]);
        setLoadingCand(false);
      });
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(false);

    if (!currentPassword) {
      setPwdError('Inserisci la password attuale.');
      return;
    }
    if (newPassword.length < 8) {
      setPwdError('La nuova password deve avere almeno 8 caratteri.');
      return;
    }
    if (newPassword === currentPassword) {
      setPwdError('La nuova password deve essere diversa da quella attuale.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Le password non coincidono.');
      return;
    }

    setPwdLoading(true);
    const { error } = await updatePassword(newPassword, currentPassword);
    setPwdLoading(false);

    if (error) {
      setPwdError(error);
    } else {
      setPwdSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Utente';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const quickLinks = [
    { icon: 'fa-briefcase', label: 'Offerte Lavoro', desc: 'Esplora le posizioni disponibili', to: '/servizi', color: 'var(--primary)' },
    { icon: 'fa-key', label: 'Cambia Password', desc: 'Aggiorna le credenziali di accesso', onClick: () => { setShowPasswordModal(true); setPwdError(null); setPwdSuccess(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }, color: '#6E4274' },
    { icon: 'fa-comments', label: 'Contatta un Esperto', desc: 'Parla con il nostro team', to: '/contatti', color: '#25D366' },
    { icon: 'fa-map-marker-alt', label: 'Alloggi in Germania', desc: 'Cerca casa nelle città partner', to: '#', color: '#FF6B35' },
  ];

  return (
    <div className="dash" style={{
      minHeight: '100vh',
      background: 'var(--bg-color)',
      paddingBottom: '60px',
    }}>
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-line">
        <div className="max-w-6xl mx-auto h-[72px] px-4 sm:px-8 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src={logoLBS} alt="" className="h-10 w-10" width={40} height={40} />
            <span className="font-heading font-bold text-lg text-plum-800 hidden sm:inline">LBS Work</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="h-10 w-10 rounded-full bg-plum-600 text-white font-heading font-bold text-sm flex items-center justify-center shrink-0">
              {initials}
            </span>
            <span className="hidden md:inline font-semibold text-ink text-sm truncate max-w-[180px]">{displayName}</span>
            <button
              id="user-pwd-btn"
              type="button"
              onClick={() => { setShowPasswordModal(true); setPwdError(null); setPwdSuccess(false); }}
              aria-label="Cambia password"
              className="btn btn-sm btn-primary !shadow-none"
            >
              <i className="fas fa-key" />
              <span className="hidden sm:inline">Password</span>
            </button>
            <button
              id="user-logout-btn"
              type="button"
              onClick={handleLogout}
              aria-label="Esci"
              className="btn btn-sm btn-outline"
            >
              <i className="fas fa-sign-out-alt" />
              <span className="hidden sm:inline">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px 0' }}>

        {/* Welcome Hero */}
        <div className="comic-card" style={{
          padding: '48px',
          marginBottom: '40px',
          background: 'var(--primary)',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-soft)',
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
          flexWrap: 'wrap',
        }}>
          <div style={{
            width: '80px', height: '80px', flexShrink: 0,
            background: 'rgba(255,255,255,0.2)',
            border: '4px solid rgba(255,255,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px',
            color: '#fff',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <p style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              margin: '0 0 8px',
            }}>
              Benvenuto nella tua area personale
            </p>
            <h1 style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
              color: '#fff',
              margin: '0 0 8px',
              letterSpacing: '-0.03em',
              textTransform: 'uppercase',
            }}>
              Ciao, {displayName}! 👋
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '15px', fontWeight: 500 }}>
              Il tuo percorso verso la Germania inizia qui.
            </p>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            border: '3px solid rgba(255,255,255,0.4)',
            padding: '20px 28px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-heading)' }}>{candidature.length}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Candidature Inviate</div>
          </div>
        </div>

        {/* Quick Links */}
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '1.3rem',
          letterSpacing: '-0.02em',
          textTransform: 'uppercase',
          color: 'var(--text-color)',
          marginBottom: '24px',
        }}>
          Accesso Rapido
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '48px',
        }}>
          {quickLinks.map((link, i) => {
            const cardContent = (
              <div className="comic-card" style={{
                padding: '28px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                height: '100%',
                boxSizing: 'border-box',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lift)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translate(0, 0)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--comic-shadow)';
                }}
              >
                <div style={{
                  width: '52px', height: '52px',
                  background: link.color,
                  border: '1px solid var(--line)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className={`fas ${link.icon}`} style={{ color: '#fff', fontSize: '20px' }} />
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 700,
                    fontSize: '15px',
                    color: 'var(--text-color)',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.01em',
                  }}>
                    {link.label}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {link.desc}
                  </div>
                </div>
                <i className="fas fa-arrow-right" style={{ color: link.color, fontSize: '14px', alignSelf: 'flex-end', marginTop: 'auto' }} />
              </div>
            );

            if (link.onClick) {
              return (
                <div key={i} onClick={link.onClick} style={{ textDecoration: 'none' }}>
                  {cardContent}
                </div>
              );
            }

            return (
              <Link
                key={i}
                to={link.to || '#'}
                style={{ textDecoration: 'none' }}
              >
                {cardContent}
              </Link>
            );
          })}
        </div>

        {/* Le Mie Candidature */}
        <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.3rem', letterSpacing: '-0.02em', textTransform: 'uppercase', color: 'var(--text-color)', marginBottom: '20px', marginTop: '48px' }}>
          Le Mie Candidature
        </h2>

        {loadingCand ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px' }} />
          </div>
        ) : candidature.length === 0 ? (
          <div style={{ border: '1px solid var(--line)', boxShadow: 'var(--shadow-soft)', padding: '40px 32px', background: 'var(--card-bg)', textAlign: 'center', marginBottom: '48px' }}>
            <i className="fas fa-file-alt" style={{ fontSize: '40px', color: 'var(--text-muted)', marginBottom: '16px', display: 'block' }} />
            <div style={{ fontWeight: 700, color: 'var(--text-color)', fontSize: '15px', textTransform: 'uppercase', marginBottom: '8px' }}>Nessuna candidatura ancora</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500, marginBottom: '20px' }}>Esplora le offerte e candidati in un click!</div>
            <Link to="/offerte">
              <button className="comic-button" style={{ background: 'var(--primary)', color: '#fff', padding: '12px 24px', fontSize: '12px', letterSpacing: '0.15em', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-briefcase" /> Vedi Offerte di Lavoro
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px', marginBottom: '48px' }}>
            {candidature.map(c => {
              const stato = STATO_COLORS[c.stato] || STATO_COLORS.nuova;
              return (
                <div key={c.id} style={{ border: '1px solid var(--line)', boxShadow: 'var(--shadow-soft)', padding: '20px 28px', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ width: '44px', height: '44px', flexShrink: 0, background: stato.bg, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px' }}>
                    <i className="fas fa-briefcase" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-color)', marginBottom: '2px' }}>
                      {c.offerta_titolo || 'Candidatura generica'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {c.settore && `${c.settore} • `}{new Date(c.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ padding: '5px 14px', background: stato.bg, border: '1px solid var(--line)', color: '#fff', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {stato.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info banner */}
        <div style={{
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-soft)',
          padding: '28px 32px',
          background: 'var(--card-bg)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}>
          <div style={{
            width: '52px', height: '52px', flexShrink: 0,
            background: '#FF6B35',
            border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="fas fa-headset" style={{ color: '#fff', fontSize: '20px' }} />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-color)', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Hai bisogno di supporto?
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>
              Il nostro team è disponibile dal Lunedì al Venerdì, 9:00 – 18:00
            </div>
          </div>
          <Link to="/contatti">
            <button className="comic-button" style={{
              background: '#FF6B35',
              color: '#fff',
              padding: '12px 24px',
              fontSize: '12px',
              letterSpacing: '0.15em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <i className="fas fa-phone" /> CONTATTACI
            </button>
          </Link>
        </div>
      </main>

      {/* Modal Cambio Password */}
      {showPasswordModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPasswordModal(false);
          }}
        >
          <div className="comic-card" style={{
            background: 'var(--card-bg)',
            maxWidth: '460px',
            width: '100%',
            padding: '36px 32px',
            position: 'relative',
          }}>
            {/* Close button */}
            <button
              onClick={() => setShowPasswordModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-color)',
                fontSize: '20px',
                cursor: 'pointer',
              }}
              aria-label="Chiudi"
            >
              <i className="fas fa-times" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                background: 'var(--primary)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '18px',
              }}>
                <i className="fas fa-key" />
              </div>
              <div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                  textTransform: 'uppercase',
                  color: 'var(--text-color)',
                  margin: 0,
                }}>
                  Cambia Password
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  {user?.email}
                </p>
              </div>
            </div>

            {pwdSuccess ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  background: 'rgba(37,211,102,0.1)',
                  border: '1px solid #25D366',
                  boxShadow: 'none',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <i className="fas fa-check-circle" style={{ color: '#25D366', fontSize: '20px' }} />
                  <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '14px' }}>
                    Password aggiornata con successo!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="comic-button"
                  style={{
                    background: 'var(--primary)',
                    color: '#fff',
                    padding: '12px',
                    fontSize: '12px',
                    letterSpacing: '0.15em',
                  }}
                >
                  CHIUDI
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {pwdError && (
                  <div style={{
                    background: 'rgba(220,38,38,0.1)',
                    border: '1px solid #dc2626',
                    boxShadow: 'none',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <i className="fas fa-exclamation-triangle" style={{ color: '#dc2626', fontSize: '16px' }} />
                    <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '13px' }}>{pwdError}</span>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '6px' }}>
                    Password Attuale
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-shield-alt" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', fontSize: '14px', opacity: 0.7 }} />
                    <input
                      type={showCurrentPwd ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                      placeholder="Inserisci la password attuale"
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 40px',
                        background: 'var(--bg-color)',
                        border: '1px solid var(--line)',
                        boxShadow: 'var(--shadow-soft)',
                        color: 'var(--text-color)',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPwd(v => !v)}
                      style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '14px', opacity: 0.7 }}
                    >
                      <i className={`fas ${showCurrentPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '6px' }}>
                    Nuova Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-lock" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', fontSize: '14px', opacity: 0.7 }} />
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      placeholder="Almeno 8 caratteri"
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 40px',
                        background: 'var(--bg-color)',
                        border: '1px solid var(--line)',
                        boxShadow: 'var(--shadow-soft)',
                        color: 'var(--text-color)',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(v => !v)}
                      style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '14px', opacity: 0.7 }}
                    >
                      <i className={`fas ${showNewPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '6px' }}>
                    Conferma Nuova Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="fas fa-check-circle" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: confirmPassword && confirmPassword === newPassword ? '#16a34a' : 'var(--primary)', fontSize: '14px', opacity: 0.7 }} />
                    <input
                      type={showConfirmNewPwd ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Ripeti la nuova password"
                      style={{
                        width: '100%',
                        padding: '12px 42px 12px 40px',
                        background: 'var(--bg-color)',
                        border: '1px solid var(--line)',
                        boxShadow: 'var(--shadow-soft)',
                        color: 'var(--text-color)',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPwd(v => !v)}
                      style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '14px', opacity: 0.7 }}
                    >
                      <i className={`fas ${showConfirmNewPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700, marginTop: '4px', display: 'block' }}>
                      Le password non coincidono
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="comic-button"
                    style={{ flex: 1, background: 'transparent', color: 'var(--text-color)', padding: '12px', fontSize: '12px', letterSpacing: '0.1em' }}
                  >
                    ANNULLA
                  </button>
                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="comic-button"
                    style={{
                      flex: 1,
                      background: pwdLoading ? 'var(--secondary)' : 'var(--primary)',
                      color: '#fff',
                      padding: '12px',
                      fontSize: '12px',
                      letterSpacing: '0.1em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: pwdLoading ? 0.7 : 1,
                      cursor: pwdLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {pwdLoading ? <><i className="fas fa-spinner fa-spin" /> Salvo...</> : <><i className="fas fa-save" /> AGGIORNA</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;

