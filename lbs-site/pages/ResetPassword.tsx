import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import logoLBS from '../img/logo_LBS-192.png';

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

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState<boolean | null>(null);

  const { updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const pwdStrength = getPasswordStrength(password);

  useEffect(() => {
    // Controlla se siamo in un flusso di recupero o se l'utente ha una sessione attiva
    const checkRecovery = async () => {
      // Controlla l'hash per parametri di recovery o errori
      const hash = window.location.hash;
      if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.substring(1));
        const desc = params.get('error_description') || 'Il link di recupero è scaduto o non valido.';
        setErrorMessage(decodeURIComponent(desc));
        setIsRecoverySession(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setIsRecoverySession(true);
      } else {
        // Ascolta l'evento PASSWORD_RECOVERY
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
          if (event === 'PASSWORD_RECOVERY' || s) {
            setIsRecoverySession(true);
          }
        });
        // Timeout di sicurezza nel caso non arrivi sessione
        setTimeout(() => {
          setIsRecoverySession(prev => (prev === null ? false : prev));
        }, 3000);
        return () => subscription.unsubscribe();
      }
    };

    checkRecovery();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage('La password deve contenere almeno 8 caratteri.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Le password non coincidono.');
      return;
    }

    setLoadingSubmit(true);
    const { error } = await updatePassword(password);
    setLoadingSubmit(false);

    if (error) {
      setErrorMessage(error);
    } else {
      setSuccess(true);
    }
  };

  const mismatch = Boolean(confirmPassword && confirmPassword !== password);

  return (
    <div className="min-h-screen surface-tint flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-[440px]">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <img src={logoLBS} alt="" className="h-11 w-11" width={44} height={44} />
          <span className="font-semibold text-lg text-plum-800">LBS Work</span>
        </Link>

        <div className="text-center mb-8">
          <span className="mx-auto icon-tile !w-14 !h-14 !rounded-lg !bg-plum-600 !text-white"><i className="fas fa-lock text-xl" /></span>
          <h1 className="h-display text-plum-800 text-3xl sm:text-4xl mt-5">Nuova password</h1>
          <p className="text-ink-soft mt-2">Imposta la tua nuova password di accesso</p>
        </div>

        <div className="card p-6 sm:p-8">
          {success ? (
            <div className="flex flex-col gap-5">
              <div role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-5 flex items-start gap-3">
                <i className="fas fa-check-circle text-emerald-600 text-xl shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-emerald-800">Password aggiornata!</div>
                  <div className="text-sm text-ink leading-relaxed mt-1">La tua nuova password è stata salvata correttamente. Ora puoi continuare sul tuo account.</div>
                </div>
              </div>
              <button type="button" onClick={() => navigate('/dashboard', { replace: true })} className="btn btn-lg btn-primary w-full">
                Vai alla dashboard <i className="fas fa-arrow-right text-xs" />
              </button>
            </div>
          ) : isRecoverySession === false ? (
            <div className="flex flex-col gap-5">
              <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-5 flex items-start gap-3">
                <i className="fas fa-exclamation-triangle text-red-600 text-lg shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-700">Link non valido o scaduto</div>
                  <div className="text-sm text-ink leading-relaxed mt-1">{errorMessage || 'Il link per il recupero password è scaduto o è già stato utilizzato.'}</div>
                </div>
              </div>
              <Link to="/login" className="btn btn-lg btn-primary w-full">
                <i className="fas fa-redo text-xs" /> Richiedi un nuovo link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {errorMessage && (
                <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center gap-3">
                  <i className="fas fa-exclamation-triangle text-red-600 shrink-0" />
                  <span className="text-red-700 font-medium text-sm">{errorMessage}</span>
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="field-label">Nuova password</label>
                <div className="relative">
                  <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-plum-400 text-sm pointer-events-none" />
                  <input id="new-password" type={showPwd ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Minimo 8 caratteri" className="field !pl-11 !pr-12" />
                  <button type="button" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? 'Nascondi password' : 'Mostra password'} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10 rounded-md text-plum-400 hover:text-plum-700 hover:bg-plum-50 flex items-center justify-center cursor-pointer">
                    <i className={`fas ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                  </button>
                </div>
                {password.length > 0 && (
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
                <label htmlFor="confirm-password" className="field-label">Conferma nuova password</label>
                <div className="relative">
                  <i className={`fas fa-check-circle absolute left-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none ${confirmPassword && confirmPassword === password ? 'text-emerald-600' : 'text-plum-400'}`} />
                  <input id="confirm-password" type={showConfirmPwd ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Ripeti la password" aria-invalid={mismatch} className={`field !pl-11 !pr-12 ${mismatch ? '!border-red-400' : ''}`} />
                  <button type="button" onClick={() => setShowConfirmPwd(v => !v)} aria-label={showConfirmPwd ? 'Nascondi password' : 'Mostra password'} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 w-10 rounded-md text-plum-400 hover:text-plum-700 hover:bg-plum-50 flex items-center justify-center cursor-pointer">
                    <i className={`fas ${showConfirmPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                  </button>
                </div>
                {mismatch && (
                  <p className="mt-1.5 mb-0 text-xs font-medium text-red-600"><i className="fas fa-times-circle mr-1" /> Le password non coincidono</p>
                )}
              </div>

              <button id="reset-submit" type="submit" disabled={loadingSubmit} className="btn btn-lg btn-primary w-full">
                {loadingSubmit ? <><i className="fas fa-spinner fa-spin" /> Aggiornamento...</> : <><i className="fas fa-save" /> Aggiorna password</>}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6">
          <Link to="/login" className="text-sm font-semibold text-plum-600 hover:text-plum-800"><i className="fas fa-arrow-left text-xs mr-1.5" /> Torna al login</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
