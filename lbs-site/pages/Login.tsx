import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'register' | 'forgot';

export interface AuthModalConfig {
  isOpen: boolean;
  type: 'not_found' | 'already_exists' | 'oauth_error';
  title: string;
  badge: string;
  message: string;
  email?: string;
  primaryButtonText: string;
  onPrimaryClick: () => void;
  secondaryButtonText: string;
  onSecondaryClick: () => void;
}

// ─── Password strength helper ─────────────────────────────────────────────────
const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
  if (pwd.length === 0) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { score, label: 'Debole', color: '#dc2626' };
  if (score <= 2) return { score, label: 'Accettabile', color: '#d97706' };
  if (score <= 3) return { score, label: 'Buona', color: '#16a34a' };
  return { score, label: 'Ottima', color: '#059669' };
};

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px 14px 46px',
  background: 'var(--bg-color)',
  border: '3px solid var(--comic-border-color)',
  boxShadow: '3px 3px 0px var(--comic-shadow-color)',
  color: 'var(--text-color)',
  fontSize: '15px',
  fontWeight: 600,
  outline: 'none',
  boxSizing: 'border-box' as const,
  transition: 'box-shadow 0.15s ease, transform 0.15s ease',
  fontFamily: 'var(--font-inter)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 900,
  fontSize: '11px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase' as const,
  color: 'var(--primary)',
  marginBottom: '8px',
};

const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.boxShadow = '5px 5px 0px var(--primary)';
  e.currentTarget.style.transform = 'translate(-2px, -2px)';
};
const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.boxShadow = '3px 3px 0px var(--comic-shadow-color)';
  e.currentTarget.style.transform = 'translate(0, 0)';
};

// ─── Main component ───────────────────────────────────────────────────────────
const Login: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Google OAuth state
  const [googleLoading, setGoogleLoading] = useState(false);

  // Styled Comic Modal State (Account non trovato / Già esistente / Errore OAuth)
  const [authModal, setAuthModal] = useState<AuthModalConfig>({
    isOpen: false,
    type: 'not_found',
    title: '',
    badge: '',
    message: '',
    primaryButtonText: '',
    onPrimaryClick: () => {},
    secondaryButtonText: '',
    onSecondaryClick: () => {},
  });

  const { signIn, signInWithGoogle, signUp, resetPassword, session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const pwdStrength = getPasswordStrength(regPassword);

  // Redirect when already logged in
  useEffect(() => {
    if (!loading && session) {
      navigate(profile?.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    }
  }, [loading, session, profile, navigate]);

  // Controlla se sono presenti errori restituiti dal redirect OAuth di Google o Supabase
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashString = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hashString);

    const err = searchParams.get('error') || hashParams.get('error');
    const errDesc = searchParams.get('error_description') || hashParams.get('error_description');

    if (err || errDesc) {
      // Pulisce la barra dell'URL rimuovendo i parametri di errore
      window.history.replaceState({}, document.title, window.location.pathname);

      const decodedDesc = errDesc ? decodeURIComponent(errDesc.replace(/\+/g, ' ')) : '';
      const isDenied = err === 'access_denied' || decodedDesc.toLowerCase().includes('denied');
      const isUserNotFound =
        decodedDesc.toLowerCase().includes('user_not_found') ||
        decodedDesc.toLowerCase().includes('not found') ||
        decodedDesc.toLowerCase().includes('signup');

      if (isUserNotFound) {
        setAuthModal({
          isOpen: true,
          type: 'not_found',
          title: 'Account Non Trovato',
          badge: 'NESSUN ACCOUNT ESISTENTE',
          message: 'Nessun account LBS Business risulta associato a questo profilo Google. Vuoi registrarti adesso per creare il tuo account?',
          primaryButtonText: 'REGISTRATI SUBITO',
          onPrimaryClick: () => {
            setAuthModal(prev => ({ ...prev, isOpen: false }));
            switchMode('register');
          },
          secondaryButtonText: 'TORNA AL LOGIN',
          onSecondaryClick: () => {
            setAuthModal(prev => ({ ...prev, isOpen: false }));
            switchMode('login');
          },
        });
      } else {
        setAuthModal({
          isOpen: true,
          type: 'oauth_error',
          title: 'Accesso Google Non Riuscito',
          badge: isDenied ? 'ACCESSO ANNULLATO' : 'ERRORE AUTENTICAZIONE',
          message: isDenied
            ? "L'accesso con Google è stato annullato. Puoi riprovare quando vuoi oppure accedere/registrarti direttamente con email e password."
            : (decodedDesc || "Non è stato possibile completare l'accesso con Google. Riprova oppure usa la registrazione con email."),
          primaryButtonText: 'REGISTRATI',
          onPrimaryClick: () => {
            setAuthModal(prev => ({ ...prev, isOpen: false }));
            switchMode('register');
          },
          secondaryButtonText: 'CHIUDI',
          onSecondaryClick: () => {
            setAuthModal(prev => ({ ...prev, isOpen: false }));
            switchMode('login');
          },
        });
      }
    }
  }, []);

  // Switch mode → reset errors
  const switchMode = (m: Mode) => {
    setMode(m);
    setLoginError(null);
    setRegError(null);
    setForgotError(null);
    setForgotSuccess(false);
  };

  // ── Google OAuth submit ──────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setLoginError(null);
    setRegError(null);
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleLoading(false);
      setAuthModal({
        isOpen: true,
        type: 'oauth_error',
        title: 'Accesso Google Non Riuscito',
        badge: 'ERRORE CONNESSIONE',
        message: error,
        primaryButtonText: 'CREA ACCOUNT',
        onPrimaryClick: () => {
          setAuthModal(prev => ({ ...prev, isOpen: false }));
          switchMode('register');
        },
        secondaryButtonText: 'CHIUDI',
        onSecondaryClick: () => {
          setAuthModal(prev => ({ ...prev, isOpen: false }));
        },
      });
    }
  };

  // ── Forgot submit ────────────────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(false);

    if (!forgotEmail.trim()) {
      setForgotError('Inserisci un indirizzo email valido.');
      return;
    }

    setForgotLoading(true);
    const { error } = await resetPassword(forgotEmail.trim());
    setForgotLoading(false);
    if (error) {
      setForgotError(error);
    } else {
      setForgotSuccess(true);
    }
  };

  // ── Login submit ─────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoginLoading(false);

    if (error) {
      const isCredsError =
        error.includes('non corretti') ||
        error.toLowerCase().includes('invalid login credentials') ||
        error.toLowerCase().includes('not found');

      if (isCredsError) {
        // Mostra popup in style "Account non trovato" con opzione di registrazione immediata
        setAuthModal({
          isOpen: true,
          type: 'not_found',
          title: 'Account Non Trovato',
          badge: 'NESSUN ACCOUNT ASSOCIATO',
          message: `Non abbiamo trovato nessun account registrato con l'indirizzo email "${loginEmail}" (oppure la password inserita non è corretta). Se non sei ancora registrato, puoi creare subito il tuo account in pochi secondi!`,
          email: loginEmail,
          primaryButtonText: 'REGISTRATI SUBITO',
          onPrimaryClick: () => {
            setRegEmail(loginEmail);
            setAuthModal(prev => ({ ...prev, isOpen: false }));
            switchMode('register');
          },
          secondaryButtonText: 'TORNA AL LOGIN',
          onSecondaryClick: () => {
            setAuthModal(prev => ({ ...prev, isOpen: false }));
          },
        });
      } else {
        setLoginError(error);
      }
    }
  };

  // ── Register submit (Accesso immediato senza conferma email) ──────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (regName.trim().length < 2) {
      setRegError('Inserisci il tuo nome completo.');
      return;
    }
    if (regPassword.length < 8) {
      setRegError('La password deve avere almeno 8 caratteri.');
      return;
    }
    if (regPassword !== regConfirm) {
      setRegError('Le password non coincidono.');
      return;
    }

    setRegLoading(true);
    const { error } = await signUp(regEmail, regPassword, regName.trim());
    if (error) {
      setRegLoading(false);
      const isAlreadyExists =
        error.includes('già registrata') ||
        error.toLowerCase().includes('already registered');

      if (isAlreadyExists) {
        // Mostra popup in style "Account già esistente" con opzione di login immediato ("e viceversa")
        setAuthModal({
          isOpen: true,
          type: 'already_exists',
          title: 'Account Già Esistente',
          badge: 'EMAIL GIÀ REGISTRATA',
          message: `L'indirizzo email "${regEmail}" risulta già registrato su LBS Business. Puoi accedere subito inserendo la tua password!`,
          email: regEmail,
          primaryButtonText: 'ACCEDI SUBITO',
          onPrimaryClick: () => {
            setLoginEmail(regEmail);
            setAuthModal(prev => ({ ...prev, isOpen: false }));
            switchMode('login');
          },
          secondaryButtonText: 'CHIUDI',
          onSecondaryClick: () => {
            setAuthModal(prev => ({ ...prev, isOpen: false }));
          },
        });
      } else {
        setRegError(error);
      }
    } else {
      // Accesso immediato senza attendere email di conferma
      const { error: signInErr } = await signIn(regEmail, regPassword);
      if (signInErr) {
        setRegError(signInErr);
        setRegLoading(false);
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  };

  // ── Decorative background ────────────────────────────────────────────────────
  const bg = (
    <>
      <div style={{ position:'absolute', top:'-200px', left:'-200px', width:'600px', height:'600px', background:'var(--primary)', borderRadius:'50%', opacity:0.08, filter:'blur(80px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-200px', right:'-200px', width:'500px', height:'500px', background:'var(--secondary)', borderRadius:'50%', opacity:0.08, filter:'blur(80px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(var(--dark) 1px, transparent 1px)', backgroundSize:'28px 28px', opacity:0.15, pointerEvents:'none' }} />
    </>
  );

  const wrapStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-color)',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
  };

  // ── Main card (login + register tabs) ────────────────────────────────────────
  return (
    <div style={wrapStyle}>
      {bg}

      <div style={{ width:'100%', maxWidth:'460px', position:'relative', zIndex:10 }}>

        {/* Brand header */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            width:'72px', height:'72px', background:'var(--primary)',
            border:'4px solid var(--comic-border-color)',
            boxShadow:'6px 6px 0px var(--comic-shadow-color)', marginBottom:'20px',
          }}>
            <i className={`fas ${mode === 'forgot' ? 'fa-key' : 'fa-shield-alt'}`} style={{ fontSize:'28px', color:'#fff' }} />
          </div>
          <h1 style={{ fontFamily:'var(--font-heading)', fontWeight:900, fontSize:'2rem', letterSpacing:'-0.03em', color:'var(--text-color)', margin:'0 0 8px', textTransform:'uppercase' }}>
            {mode === 'login' ? 'Area Riservata' : mode === 'register' ? 'Crea Account' : 'Password Dimenticata'}
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:'14px', fontWeight:500, margin:0 }}>
            {mode === 'login' ? 'Accedi al portale LBS Business' : mode === 'register' ? 'Registrati al portale LBS Business' : 'Inserisci la tua email per ricevere il link di recupero'}
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display:'flex', border:'4px solid var(--comic-border-color)', boxShadow:'4px 4px 0px var(--comic-shadow-color)', marginBottom:'0', overflow:'hidden' }}>
          {(['login', 'register'] as ('login' | 'register')[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1,
                padding: '14px',
                background: mode === m ? 'var(--primary)' : 'var(--bg-color)',
                color: mode === m ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRight: m === 'login' ? '3px solid var(--comic-border-color)' : 'none',
                fontWeight: 900,
                fontSize: '11px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'var(--font-inter)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <i className={`fas ${m === 'login' ? 'fa-sign-in-alt' : 'fa-user-plus'}`} />
              {m === 'login' ? 'Accedi' : 'Registrati'}
            </button>
          ))}
        </div>

        {/* Card body */}
        <div className="comic-card" style={{ padding:'36px 40px', borderTop:'none' }}>

          {/* ── GOOGLE AUTH BUTTON ── */}
          {mode !== 'forgot' && (
            <div style={{ marginBottom:'22px' }}>
              <button
                type="button"
                id="google-login-btn"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="comic-button"
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  background: '#ffffff',
                  color: '#1f2937',
                  border: '3px solid var(--comic-border-color)',
                  boxShadow: '4px 4px 0px var(--comic-shadow-color)',
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  cursor: googleLoading ? 'not-allowed' : 'pointer',
                  opacity: googleLoading ? 0.7 : 1,
                  transition: 'all 0.15s ease',
                  fontFamily: 'var(--font-inter)',
                }}
              >
                {googleLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin" style={{ color: 'var(--primary)' }} />
                    <span>Connessione a Google...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span>{mode === 'login' ? 'Accedi con Google' : 'Registrati con Google'}</span>
                  </>
                )}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0 4px', gap: '14px' }}>
                <div style={{ flex: 1, height: '2px', background: 'var(--comic-border-color)', opacity: 0.2 }} />
                <span style={{
                  fontSize: '11px',
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}>
                  oppure con email
                </span>
                <div style={{ flex: 1, height: '2px', background: 'var(--comic-border-color)', opacity: 0.2 }} />
              </div>
            </div>
          )}

          {/* ── FORGOT PASSWORD FORM ── */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgot} style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
              {forgotError && <ErrorBox message={forgotError} />}
              {forgotSuccess ? (
                <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
                  <SuccessBox message="Link di recupero inviato! Controlla la tua casella di posta (e anche la cartella Spam)." />
                  <p style={{ margin:0, fontSize:'14px', color:'var(--text-color)', lineHeight:1.6 }}>
                    Abbiamo inviato un'email a <strong>{forgotEmail}</strong> con le istruzioni e il link per impostare la tua nuova password.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="comic-button"
                    style={{ width:'100%', padding:'14px', background:'var(--primary)', color:'#fff', fontSize:'12px', letterSpacing:'0.15em', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}
                  >
                    <i className="fas fa-arrow-left" /> Torna all'accesso
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ margin:0, fontSize:'13px', color:'var(--text-muted)', lineHeight:1.5 }}>
                    Inserisci l'indirizzo email del tuo account. Ti invieremo un link sicuro per reimpostare la tua password.
                  </p>

                  {/* Email */}
                  <div>
                    <label style={labelStyle}>Email dell'account</label>
                    <div style={{ position:'relative' }}>
                      <i className="fas fa-envelope" style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', color:'var(--primary)', fontSize:'15px', opacity:0.7 }} />
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        required
                        placeholder="la-tua@email.com"
                        style={inputStyle}
                        onFocus={onFocus}
                        onBlur={onBlur}
                      />
                    </div>
                  </div>

                  <button
                    id="forgot-submit"
                    type="submit"
                    disabled={forgotLoading}
                    className="comic-button"
                    style={{ width:'100%', padding:'16px', background: forgotLoading ? 'var(--secondary)' : 'var(--primary)', color:'#fff', fontSize:'13px', letterSpacing:'0.2em', marginTop:'4px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', opacity: forgotLoading ? 0.7 : 1, cursor: forgotLoading ? 'not-allowed' : 'pointer', transition:'all 0.15s ease' }}
                  >
                    {forgotLoading ? <><i className="fas fa-spinner fa-spin" /> Invio in corso...</> : <><i className="fas fa-paper-plane" /> INVIA LINK DI RECUPERO</>}
                  </button>

                  <p style={{ textAlign:'center', margin:0, fontSize:'13px', color:'var(--text-muted)' }}>
                    Ti ricordi la password?{' '}
                    <button type="button" onClick={() => switchMode('login')} style={{ background:'none', border:'none', color:'var(--primary)', fontWeight:900, cursor:'pointer', fontSize:'13px', padding:0, textDecoration:'underline' }}>
                      Accedi
                    </button>
                  </p>
                </>
              )}
            </form>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
              {loginError && <ErrorBox message={loginError} />}

              {/* Email */}
              <div>
                <label style={labelStyle}>Email</label>
                <div style={{ position:'relative' }}>
                  <i className="fas fa-envelope" style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', color:'var(--primary)', fontSize:'15px', opacity:0.7 }} />
                  <input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    required
                    placeholder="la-tua@email.com"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={labelStyle}>Password</label>
                <div style={{ position:'relative' }}>
                  <i className="fas fa-key" style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', color:'var(--primary)', fontSize:'15px', opacity:0.7 }} />
                  <input
                    id="login-password"
                    type={showLoginPwd ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{ ...inputStyle, paddingRight:'46px' }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  <EyeToggle show={showLoginPwd} onToggle={() => setShowLoginPwd(v => !v)} />
                </div>
              </div>

              {/* Password dimenticata */}
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'-10px' }}>
                <button
                  type="button"
                  onClick={() => { setForgotEmail(loginEmail); switchMode('forgot'); }}
                  style={{ background:'none', border:'none', color:'var(--primary)', fontSize:'12px', fontWeight:700, cursor:'pointer', padding:0, textDecoration:'underline' }}
                >
                  Password dimenticata?
                </button>
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={loginLoading}
                className="comic-button"
                style={{ width:'100%', padding:'16px', background: loginLoading ? 'var(--secondary)' : 'var(--primary)', color:'#fff', fontSize:'13px', letterSpacing:'0.2em', marginTop:'4px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', opacity: loginLoading ? 0.7 : 1, cursor: loginLoading ? 'not-allowed' : 'pointer', transition:'all 0.15s ease' }}
              >
                {loginLoading ? <><i className="fas fa-spinner fa-spin" /> Accesso in corso...</> : <><i className="fas fa-sign-in-alt" /> ACCEDI</>}
              </button>

              <p style={{ textAlign:'center', margin:0, fontSize:'13px', color:'var(--text-muted)' }}>
                Non hai un account?{' '}
                <button type="button" onClick={() => switchMode('register')} style={{ background:'none', border:'none', color:'var(--primary)', fontWeight:900, cursor:'pointer', fontSize:'13px', padding:0, textDecoration:'underline' }}>
                  Registrati gratis
                </button>
              </p>
            </form>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
              {regError && <ErrorBox message={regError} />}

              {/* Nome */}
              <div>
                <label style={labelStyle}>Nome completo</label>
                <div style={{ position:'relative' }}>
                  <i className="fas fa-user" style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', color:'var(--primary)', fontSize:'15px', opacity:0.7 }} />
                  <input
                    id="reg-name"
                    type="text"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    required
                    placeholder="Mario Rossi"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={labelStyle}>Email</label>
                <div style={{ position:'relative' }}>
                  <i className="fas fa-envelope" style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', color:'var(--primary)', fontSize:'15px', opacity:0.7 }} />
                  <input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    required
                    placeholder="la-tua@email.com"
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={labelStyle}>Password</label>
                <div style={{ position:'relative' }}>
                  <i className="fas fa-lock" style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', color:'var(--primary)', fontSize:'15px', opacity:0.7 }} />
                  <input
                    id="reg-password"
                    type={showRegPwd ? 'text' : 'password'}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    required
                    placeholder="Min. 8 caratteri"
                    style={{ ...inputStyle, paddingRight:'46px' }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  <EyeToggle show={showRegPwd} onToggle={() => setShowRegPwd(v => !v)} />
                </div>
                {/* Strength bar */}
                {regPassword.length > 0 && (
                  <div style={{ marginTop:'8px' }}>
                    <div style={{ display:'flex', gap:'4px', marginBottom:'4px' }}>
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ flex:1, height:'4px', background: i <= pwdStrength.score ? pwdStrength.color : 'var(--comic-border-color)', transition:'background 0.2s ease', border:'1px solid var(--comic-border-color)' }} />
                      ))}
                    </div>
                    <p style={{ margin:0, fontSize:'11px', fontWeight:700, color: pwdStrength.color, letterSpacing:'0.1em' }}>
                      {pwdStrength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Conferma password */}
              <div>
                <label style={labelStyle}>Conferma password</label>
                <div style={{ position:'relative' }}>
                  <i className="fas fa-check-circle" style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', color: regConfirm && regConfirm === regPassword ? '#16a34a' : 'var(--primary)', fontSize:'15px', opacity:0.7 }} />
                  <input
                    id="reg-confirm"
                    type={showConfirmPwd ? 'text' : 'password'}
                    value={regConfirm}
                    onChange={e => setRegConfirm(e.target.value)}
                    required
                    placeholder="Ripeti la password"
                    style={{ ...inputStyle, paddingRight:'46px', borderColor: regConfirm && regConfirm !== regPassword ? '#dc2626' : undefined }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  <EyeToggle show={showConfirmPwd} onToggle={() => setShowConfirmPwd(v => !v)} />
                </div>
                {regConfirm && regConfirm !== regPassword && (
                  <p style={{ margin:'6px 0 0', fontSize:'11px', color:'#dc2626', fontWeight:700 }}>
                    <i className="fas fa-times-circle" style={{ marginRight:'4px' }} /> Le password non coincidono
                  </p>
                )}
              </div>

              {/* Terms note */}
              <p style={{ margin:0, fontSize:'12px', color:'var(--text-muted)', lineHeight:1.5 }}>
                <i className="fas fa-shield-alt" style={{ color:'var(--primary)', marginRight:'6px' }} />
                Registrandoti accetti le nostre condizioni d'uso e l'informativa sulla privacy.
              </p>

              <button
                id="reg-submit"
                type="submit"
                disabled={regLoading}
                className="comic-button"
                style={{ width:'100%', padding:'16px', background: regLoading ? 'var(--secondary)' : 'var(--primary)', color:'#fff', fontSize:'13px', letterSpacing:'0.2em', marginTop:'4px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', opacity: regLoading ? 0.7 : 1, cursor: regLoading ? 'not-allowed' : 'pointer', transition:'all 0.15s ease' }}
              >
                {regLoading ? <><i className="fas fa-spinner fa-spin" /> Registrazione...</> : <><i className="fas fa-user-plus" /> CREA ACCOUNT</>}
              </button>

              <p style={{ textAlign:'center', margin:0, fontSize:'13px', color:'var(--text-muted)' }}>
                Hai già un account?{' '}
                <button type="button" onClick={() => switchMode('login')} style={{ background:'none', border:'none', color:'var(--primary)', fontWeight:900, cursor:'pointer', fontSize:'13px', padding:0, textDecoration:'underline' }}>
                  Accedi
                </button>
              </p>
            </form>
          )}
        </div>

        <p style={{ textAlign:'center', marginTop:'24px', color:'var(--text-muted)', fontSize:'13px', fontWeight:500 }}>
          <Link to="/" style={{ color:'var(--primary)', fontWeight:700, textDecoration:'none' }}>← Torna al sito</Link>
        </p>
      </div>

      {/* ── STYLED COMIC POPUP MODAL ── */}
      {authModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) authModal.onSecondaryClick();
          }}
        >
          <div
            className="comic-card"
            style={{
              background: 'var(--card-bg)',
              maxWidth: '460px',
              width: '100%',
              padding: '36px 32px',
              position: 'relative',
              boxShadow: '10px 10px 0px var(--comic-shadow-color)',
              border: '4px solid var(--comic-border-color)',
              animation: 'comicPop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
          >
            {/* Close button */}
            <button
              onClick={authModal.onSecondaryClick}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'var(--bg-color)',
                border: '2px solid var(--comic-border-color)',
                boxShadow: '2px 2px 0px var(--comic-shadow-color)',
                color: 'var(--text-color)',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                cursor: 'pointer',
                fontWeight: 900,
              }}
              aria-label="Chiudi"
            >
              <i className="fas fa-times" />
            </button>

            {/* Badge */}
            <div style={{ marginBottom: '16px' }}>
              <span
                style={{
                  display: 'inline-block',
                  background: authModal.type === 'not_found'
                    ? '#FF6B35'
                    : authModal.type === 'already_exists'
                    ? 'var(--primary)'
                    : '#dc2626',
                  color: '#ffffff',
                  padding: '4px 12px',
                  fontWeight: 900,
                  fontSize: '10px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  border: '2px solid var(--comic-border-color)',
                  boxShadow: '3px 3px 0px var(--comic-shadow-color)',
                }}
              >
                {authModal.badge}
              </span>
            </div>

            {/* Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  background: authModal.type === 'not_found'
                    ? 'rgba(255, 107, 53, 0.15)'
                    : authModal.type === 'already_exists'
                    ? 'rgba(110, 66, 116, 0.15)'
                    : 'rgba(220, 38, 38, 0.15)',
                  border: '3px solid var(--comic-border-color)',
                  boxShadow: '4px 4px 0px var(--comic-shadow-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  color: authModal.type === 'not_found'
                    ? '#FF6B35'
                    : authModal.type === 'already_exists'
                    ? 'var(--primary)'
                    : '#dc2626',
                  flexShrink: 0,
                }}
              >
                <i
                  className={`fas ${
                    authModal.type === 'not_found'
                      ? 'fa-user-slash'
                      : authModal.type === 'already_exists'
                      ? 'fa-user-check'
                      : 'fa-exclamation-triangle'
                  }`}
                />
              </div>

              <div>
                <h3
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 900,
                    fontSize: '1.3rem',
                    textTransform: 'uppercase',
                    color: 'var(--text-color)',
                    margin: '0 0 4px',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {authModal.title}
                </h3>
                {authModal.email && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      wordBreak: 'break-all',
                    }}
                  >
                    {authModal.email}
                  </span>
                )}
              </div>
            </div>

            {/* Message box */}
            <div
              style={{
                background: 'var(--bg-color)',
                border: '3px solid var(--comic-border-color)',
                boxShadow: '3px 3px 0px var(--comic-shadow-color)',
                padding: '16px 18px',
                marginBottom: '24px',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'var(--text-color)',
                fontWeight: 600,
              }}
            >
              {authModal.message}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={authModal.onSecondaryClick}
                className="comic-button"
                style={{
                  flex: 1,
                  minWidth: '130px',
                  background: 'transparent',
                  color: 'var(--text-color)',
                  border: '3px solid var(--comic-border-color)',
                  boxShadow: '3px 3px 0px var(--comic-shadow-color)',
                  padding: '14px 16px',
                  fontSize: '11px',
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-inter)',
                }}
              >
                {authModal.secondaryButtonText}
              </button>

              <button
                type="button"
                onClick={authModal.onPrimaryClick}
                className="comic-button"
                style={{
                  flex: 1.4,
                  minWidth: '160px',
                  background: authModal.type === 'not_found'
                    ? '#25D366'
                    : 'var(--primary)',
                  color: '#ffffff',
                  border: '3px solid var(--comic-border-color)',
                  boxShadow: '4px 4px 0px var(--comic-shadow-color)',
                  padding: '14px 18px',
                  fontSize: '12px',
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-inter)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <i
                  className={`fas ${
                    authModal.type === 'not_found'
                      ? 'fa-user-plus'
                      : authModal.type === 'already_exists'
                      ? 'fa-sign-in-alt'
                      : 'fa-arrow-right'
                  }`}
                />
                {authModal.primaryButtonText}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes comicPop {
          0% { transform: scale(0.9) translateY(16px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const SuccessBox: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ background:'rgba(37,211,102,0.1)', border:'3px solid #25D366', boxShadow:'4px 4px 0px #25D366', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px' }}>
    <i className="fas fa-check-circle" style={{ color:'#25D366', fontSize:'16px', flexShrink:0 }} />
    <span style={{ color:'#16a34a', fontWeight:700, fontSize:'14px' }}>{message}</span>
  </div>
);

const ErrorBox: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ background:'rgba(220,38,38,0.1)', border:'3px solid #dc2626', boxShadow:'4px 4px 0px #dc2626', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px' }}>
    <i className="fas fa-exclamation-triangle" style={{ color:'#dc2626', fontSize:'16px', flexShrink:0 }} />
    <span style={{ color:'#dc2626', fontWeight:700, fontSize:'14px' }}>{message}</span>
  </div>
);

const EyeToggle: React.FC<{ show: boolean; onToggle: () => void }> = ({ show, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    style={{ position:'absolute', right:'16px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--primary)', fontSize:'15px', padding:0, opacity:0.7 }}
  >
    <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'}`} />
  </button>
);

const GoogleIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z" />
    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15Z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
  </svg>
);

export default Login;
