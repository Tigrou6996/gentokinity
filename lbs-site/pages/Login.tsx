import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoLBS from '../img/logo_LBS-192.png';

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


  const title = mode === 'login' ? 'Bentornato' : mode === 'register' ? 'Crea il tuo account' : 'Password dimenticata';
  const subtitle = mode === 'login'
    ? 'Accedi al portale LBS Business'
    : mode === 'register'
      ? 'Registrati al portale LBS Business'
      : 'Inserisci la tua email per ricevere il link di recupero';

  const modalTone = authModal.type === 'not_found'
    ? { tile: 'bg-orange-50 text-orange-600', chip: '!bg-orange-50 !text-orange-700 !border-orange-200', icon: 'fa-user-slash' }
    : authModal.type === 'already_exists'
      ? { tile: 'bg-plum-50 text-plum-600', chip: '', icon: 'fa-user-check' }
      : { tile: 'bg-red-50 text-red-600', chip: '!bg-red-50 !text-red-700 !border-red-200', icon: 'fa-exclamation-triangle' };

  return (
    <div className="min-h-screen bg-paper grid grid-cols-1 lg:grid-cols-2">
      {/* PANNELLO MARCHIO (desktop) */}
      <aside className="hidden lg:flex surface-brand flex-col justify-between p-12 xl:p-16">
        <Link to="/" className="flex items-center gap-3 self-start">
          <img src={logoLBS} alt="" className="h-11 w-11" width={44} height={44} />
          <span>
            <span className="block font-semibold text-lg leading-tight text-white">LBS Work</span>
            <span className="block text-xs text-white/55">Lavoro &amp; servizi in Germania</span>
          </span>
        </Link>
        <div className="max-w-md">
          <h2 className="h-display text-white text-5xl">La tua nuova vita in Germania, <span className="sticker">a portata di clic.</span></h2>
          <ul className="mt-10 space-y-4 text-white/80">
            {[
              { icon: 'fa-paper-plane', t: 'Candidati alle offerte con un clic' },
              { icon: 'fa-chart-line', t: 'Segui lo stato delle tue candidature' },
              { icon: 'fa-headset', t: 'Assistenza 24/7, sempre in italiano' },
            ].map(i => (
              <li key={i.t} className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-white/15 text-white flex items-center justify-center"><i className={`fas ${i.icon}`} /></span>
                {i.t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/45">© {new Date().getFullYear()} LBS Lavoro Business e Servizi in Germania</p>
      </aside>

      {/* MODULO */}
      <main className="flex flex-col items-center justify-center px-5 py-10 sm:py-16 surface-tint lg:bg-none lg:bg-paper">
        <div className="w-full max-w-[440px]">
          <Link to="/" className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
            <img src={logoLBS} alt="" className="h-11 w-11" width={44} height={44} />
            <span className="font-semibold text-lg text-plum-800">LBS Work</span>
          </Link>

          <div className="text-center mb-8">
            <span className="mx-auto icon-tile !w-14 !h-14 !rounded-lg !bg-plum-600 !text-white">
              <i className={`fas ${mode === 'forgot' ? 'fa-key' : 'fa-shield-alt'} text-xl`} />
            </span>
            <h1 className="h-display text-plum-800 text-3xl sm:text-4xl mt-5">{title}</h1>
            <p className="text-ink-soft mt-2">{subtitle}</p>
          </div>

          {mode !== 'forgot' && (
            <div role="tablist" aria-label="Accedi o registrati" className="grid grid-cols-2 gap-1 p-1 rounded-md bg-plum-100/60 mb-5">
              {(['login', 'register'] as ('login' | 'register')[]).map(m => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={`min-h-[44px] rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${ mode === m ? 'bg-white text-plum-800 shadow-sm' : 'text-ink-soft hover:text-plum-800' }`}
                >
                  <i className={`fas ${m === 'login' ? 'fa-sign-in-alt' : 'fa-user-plus'} text-xs`} />
                  {m === 'login' ? 'Accedi' : 'Registrati'}
                </button>
              ))}
            </div>
          )}

          <div className="card p-6 sm:p-8">
            {/* ── GOOGLE ── */}
            {mode !== 'forgot' && (
              <div className="mb-6">
                <button
                  type="button"
                  id="google-login-btn"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="btn btn-outline w-full !text-ink"
                >
                  {googleLoading ? (
                    <><i className="fas fa-spinner fa-spin text-plum-600" /> Connessione a Google...</>
                  ) : (
                    <><GoogleIcon /> {mode === 'login' ? 'Accedi con Google' : 'Registrati con Google'}</>
                  )}
                </button>
                <div className="flex items-center gap-3 mt-6">
                  <span className="flex-1 h-px bg-line" />
                  <span className="text-xs font-medium text-ink-soft">oppure con email</span>
                  <span className="flex-1 h-px bg-line" />
                </div>
              </div>
            )}

            {/* ── PASSWORD DIMENTICATA ── */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgot} className="flex flex-col gap-5">
                {forgotError && <ErrorBox message={forgotError} />}
                {forgotSuccess ? (
                  <div className="flex flex-col gap-5">
                    <SuccessBox message="Link di recupero inviato! Controlla la tua casella di posta (e anche la cartella Spam)." />
                    <p className="text-sm text-ink leading-relaxed m-0">
                      Abbiamo inviato un'email a <strong>{forgotEmail}</strong> con le istruzioni e il link per impostare la tua nuova password.
                    </p>
                    <button type="button" onClick={() => switchMode('login')} className="btn btn-lg btn-primary w-full">
                      <i className="fas fa-arrow-left text-xs" /> Torna all'accesso
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-ink-soft leading-relaxed m-0">
                      Inserisci l'indirizzo email del tuo account. Ti invieremo un link sicuro per reimpostare la tua password.
                    </p>
                    <IconField icon="fa-envelope" label="Email dell'account" id="forgot-email">
                      <input id="forgot-email" type="email" autoComplete="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required placeholder="la-tua@email.com" className="field !pl-11" />
                    </IconField>
                    <button id="forgot-submit" type="submit" disabled={forgotLoading} className="btn btn-lg btn-primary w-full">
                      {forgotLoading ? <><i className="fas fa-spinner fa-spin" /> Invio in corso...</> : <><i className="fas fa-paper-plane" /> Invia link di recupero</>}
                    </button>
                    <p className="text-center text-sm text-ink-soft m-0">
                      Ti ricordi la password?{' '}
                      <button type="button" onClick={() => switchMode('login')} className="font-semibold text-plum-600 hover:text-plum-800 underline cursor-pointer">Accedi</button>
                    </p>
                  </>
                )}
              </form>
            )}

            {/* ── LOGIN ── */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                {loginError && <ErrorBox message={loginError} />}
                <IconField icon="fa-envelope" label="Email" id="login-email">
                  <input id="login-email" type="email" autoComplete="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required placeholder="la-tua@email.com" className="field !pl-11" />
                </IconField>
                <div>
                  <IconField icon="fa-key" label="Password" id="login-password">
                    <input id="login-password" type={showLoginPwd ? 'text' : 'password'} autoComplete="current-password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required placeholder="••••••••" className="field !pl-11 !pr-12" />
                    <EyeToggle show={showLoginPwd} onToggle={() => setShowLoginPwd(v => !v)} />
                  </IconField>
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => { setForgotEmail(loginEmail); switchMode('forgot'); }}
                      className="text-sm font-medium text-plum-600 hover:text-plum-800 cursor-pointer"
                    >
                      Password dimenticata?
                    </button>
                  </div>
                </div>
                <button id="login-submit" type="submit" disabled={loginLoading} className="btn btn-lg btn-primary w-full">
                  {loginLoading ? <><i className="fas fa-spinner fa-spin" /> Accesso in corso...</> : <><i className="fas fa-sign-in-alt" /> Accedi</>}
                </button>
                <p className="text-center text-sm text-ink-soft m-0">
                  Non hai un account?{' '}
                  <button type="button" onClick={() => switchMode('register')} className="font-semibold text-plum-600 hover:text-plum-800 underline cursor-pointer">Registrati gratis</button>
                </p>
              </form>
            )}

            {/* ── REGISTRAZIONE ── */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="flex flex-col gap-5">
                {regError && <ErrorBox message={regError} />}
                <IconField icon="fa-user" label="Nome completo" id="reg-name">
                  <input id="reg-name" type="text" autoComplete="name" value={regName} onChange={e => setRegName(e.target.value)} required placeholder="Mario Rossi" className="field !pl-11" />
                </IconField>
                <IconField icon="fa-envelope" label="Email" id="reg-email">
                  <input id="reg-email" type="email" autoComplete="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required placeholder="la-tua@email.com" className="field !pl-11" />
                </IconField>
                <div>
                  <IconField icon="fa-lock" label="Password" id="reg-password">
                    <input id="reg-password" type={showRegPwd ? 'text' : 'password'} autoComplete="new-password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required placeholder="Min. 8 caratteri" className="field !pl-11 !pr-12" />
                    <EyeToggle show={showRegPwd} onToggle={() => setShowRegPwd(v => !v)} />
                  </IconField>
                  {regPassword.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="flex-1 h-1.5 rounded-full transition-colors" style={{ background: i <= pwdStrength.score ? pwdStrength.color : 'var(--line)' }} />
                        ))}
                      </div>
                      <p className="m-0 text-xs font-semibold" style={{ color: pwdStrength.color }}>{pwdStrength.label}</p>
                    </div>
                  )}
                </div>
                <div>
                  <IconField icon="fa-check-circle" iconClass={regConfirm && regConfirm === regPassword ? '!text-emerald-600' : ''} label="Conferma password" id="reg-confirm">
                    <input
                      id="reg-confirm"
                      type={showConfirmPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={regConfirm}
                      onChange={e => setRegConfirm(e.target.value)}
                      required
                      placeholder="Ripeti la password"
                      aria-invalid={Boolean(regConfirm && regConfirm !== regPassword)}
                      className={`field !pl-11 !pr-12 ${regConfirm && regConfirm !== regPassword ? '!border-red-400' : ''}`}
                    />
                    <EyeToggle show={showConfirmPwd} onToggle={() => setShowConfirmPwd(v => !v)} />
                  </IconField>
                  {regConfirm && regConfirm !== regPassword && (
                    <p className="mt-1.5 mb-0 text-xs font-medium text-red-600">
                      <i className="fas fa-times-circle mr-1" /> Le password non coincidono
                    </p>
                  )}
                </div>
                <p className="m-0 text-xs text-ink-soft leading-relaxed">
                  <i className="fas fa-shield-alt text-plum-400 mr-1.5" />
                  Registrandoti accetti le nostre condizioni d'uso e l'informativa sulla privacy.
                </p>
                <button id="reg-submit" type="submit" disabled={regLoading} className="btn btn-lg btn-primary w-full">
                  {regLoading ? <><i className="fas fa-spinner fa-spin" /> Registrazione...</> : <><i className="fas fa-user-plus" /> Crea account</>}
                </button>
                <p className="text-center text-sm text-ink-soft m-0">
                  Hai già un account?{' '}
                  <button type="button" onClick={() => switchMode('login')} className="font-semibold text-plum-600 hover:text-plum-800 underline cursor-pointer">Accedi</button>
                </p>
              </form>
            )}
          </div>

          <p className="text-center mt-6">
            <Link to="/" className="text-sm font-semibold text-plum-600 hover:text-plum-800">
              <i className="fas fa-arrow-left text-xs mr-1.5" /> Torna al sito
            </Link>
          </p>
        </div>
      </main>

      {/* ── POPUP ACCOUNT ── */}
      {authModal.isOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-plum-950/60 backdrop-blur-sm flex items-center justify-center p-5"
          onClick={(e) => { if (e.target === e.currentTarget) authModal.onSecondaryClick(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
        >
          <div className="animate-pop-in relative w-full max-w-[460px] bg-white rounded-xl p-7 sm:p-8 shadow-[var(--shadow-lift)]">
            <button type="button" onClick={authModal.onSecondaryClick} aria-label="Chiudi" className="absolute top-4 right-4 h-10 w-10 rounded-md bg-plum-50 text-plum-800 hover:bg-plum-100 flex items-center justify-center cursor-pointer">
              <i className="fas fa-times" />
            </button>
            <span className={`chip ${modalTone.chip}`}>{authModal.badge}</span>
            <div className="flex items-center gap-4 mt-4 mb-4">
              <span className={`h-14 w-14 rounded-lg flex items-center justify-center text-2xl shrink-0 ${modalTone.tile}`}>
                <i className={`fas ${modalTone.icon}`} />
              </span>
              <div className="min-w-0">
                <h3 id="auth-modal-title" className="font-semibold text-xl text-plum-800 m-0">{authModal.title}</h3>
                {authModal.email && <span className="text-sm text-ink-soft break-all">{authModal.email}</span>}
              </div>
            </div>
            <p className="rounded-lg bg-plum-50 p-4 text-sm text-ink leading-relaxed mb-6">{authModal.message}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={authModal.onSecondaryClick} className="btn btn-outline flex-1 min-w-[130px]">
                {authModal.secondaryButtonText}
              </button>
              <button
                type="button"
                onClick={authModal.onPrimaryClick}
                className={`btn flex-[1.4] min-w-[160px] ${authModal.type === 'not_found' ? 'btn-wa' : 'btn-primary'}`}
              >
                <i className={`fas ${authModal.type === 'not_found' ? 'fa-user-plus' : authModal.type === 'already_exists' ? 'fa-sign-in-alt' : 'fa-arrow-right'}`} />
                {authModal.primaryButtonText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const IconField: React.FC<{ icon: string; label: string; id: string; iconClass?: string; children: React.ReactNode }> = ({ icon, label, id, iconClass = '', children }) => (
  <div>
    <label htmlFor={id} className="field-label">{label}</label>
    <div className="relative">
      <i className={`fas ${icon} absolute left-4 top-1/2 -translate-y-1/2 text-plum-400 text-sm pointer-events-none ${iconClass}`} />
      {children}
    </div>
  </div>
);

const SuccessBox: React.FC<{ message: string }> = ({ message }) => (
  <div role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
    <i className="fas fa-check-circle text-emerald-600 shrink-0" />
    <span className="text-emerald-800 font-medium text-sm">{message}</span>
  </div>
);

const ErrorBox: React.FC<{ message: string }> = ({ message }) => (
  <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-3">
    <i className="fas fa-exclamation-triangle text-red-600 shrink-0" />
    <span className="text-red-700 font-medium text-sm">{message}</span>
  </div>
);

const EyeToggle: React.FC<{ show: boolean; onToggle: () => void }> = ({ show, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={show ? 'Nascondi password' : 'Mostra password'}
    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10 rounded-md text-plum-400 hover:text-plum-700 hover:bg-plum-50 flex items-center justify-center cursor-pointer"
  >
    <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'}`} />
  </button>
);

const GoogleIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden="true">
    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z" />
    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15Z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
  </svg>
);

export default Login;
