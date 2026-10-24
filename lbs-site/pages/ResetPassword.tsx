import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

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

  // ── Decorative background ────────────────────────────────────────────────────
  const bg = (
    <>
      <div style={{ position:'absolute', top:'-200px', left:'-200px', width:'600px', height:'600px', background:'var(--primary)', borderRadius:'50%', opacity:0.08, filter:'blur(80px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-200px', right:'-200px', width:'500px', height:'500px', background:'var(--secondary)', borderRadius:'50%', opacity:0.08, filter:'blur(80px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(var(--dark) 1px, transparent 1px)', backgroundSize:'28px 28px', opacity:0.15, pointerEvents:'none' }} />
    </>
  );

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-color)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
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
            <i className="fas fa-lock" style={{ fontSize:'28px', color:'#fff' }} />
          </div>
          <h1 style={{ fontFamily:'var(--font-heading)', fontWeight:900, fontSize:'2rem', letterSpacing:'-0.03em', color:'var(--text-color)', margin:'0 0 8px', textTransform:'uppercase' }}>
            Nuova Password
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:'14px', fontWeight:500, margin:0 }}>
            Imposta la tua nuova password di accesso
          </p>
        </div>

        <div className="comic-card" style={{ padding:'36px 40px' }}>
          {success ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'20px', textAlign:'center' }}>
              <div style={{
                background:'rgba(37,211,102,0.1)',
                border:'3px solid #25D366',
                boxShadow:'4px 4px 0px #25D366',
                padding:'20px',
                display:'flex',
                alignItems:'center',
                gap:'12px',
                textAlign:'left',
              }}>
                <i className="fas fa-check-circle" style={{ color:'#25D366', fontSize:'24px', flexShrink:0 }} />
                <div>
                  <div style={{ color:'#16a34a', fontWeight:900, fontSize:'15px', textTransform:'uppercase', marginBottom:'4px' }}>Password Aggiornata!</div>
                  <div style={{ color:'var(--text-color)', fontSize:'13px', lineHeight:1.5 }}>
                    La tua nuova password è stata salvata correttamente. Ora puoi continuare sul tuo account.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/dashboard', { replace: true })}
                className="comic-button"
                style={{ width:'100%', padding:'16px', background:'var(--primary)', color:'#fff', fontSize:'13px', letterSpacing:'0.15em', marginTop:'8px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px' }}
              >
                <i className="fas fa-arrow-right" /> VAI ALLA DASHBOARD
              </button>
            </div>
          ) : isRecoverySession === false ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
              <div style={{ background:'rgba(220,38,38,0.1)', border:'3px solid #dc2626', boxShadow:'4px 4px 0px #dc2626', padding:'18px', display:'flex', alignItems:'center', gap:'12px' }}>
                <i className="fas fa-exclamation-triangle" style={{ color:'#dc2626', fontSize:'20px', flexShrink:0 }} />
                <div>
                  <div style={{ color:'#dc2626', fontWeight:900, fontSize:'14px', textTransform:'uppercase', marginBottom:'4px' }}>Link non valido o scaduto</div>
                  <div style={{ color:'var(--text-color)', fontSize:'13px', lineHeight:1.4 }}>
                    {errorMessage || 'Il link per il recupero password è scaduto o è già stato utilizzato.'}
                  </div>
                </div>
              </div>

              <Link to="/login" style={{ textDecoration:'none' }}>
                <button
                  type="button"
                  className="comic-button"
                  style={{ width:'100%', padding:'14px', background:'var(--primary)', color:'#fff', fontSize:'12px', letterSpacing:'0.15em', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}
                >
                  <i className="fas fa-redo" /> Richiedi un nuovo link
                </button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
              {errorMessage && (
                <div style={{ background:'rgba(220,38,38,0.1)', border:'3px solid #dc2626', boxShadow:'4px 4px 0px #dc2626', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px' }}>
                  <i className="fas fa-exclamation-triangle" style={{ color:'#dc2626', fontSize:'16px', flexShrink:0 }} />
                  <span style={{ color:'#dc2626', fontWeight:700, fontSize:'14px' }}>{errorMessage}</span>
                </div>
              )}

              {/* Nuova Password */}
              <div>
                <label style={labelStyle}>Nuova Password</label>
                <div style={{ position:'relative' }}>
                  <i className="fas fa-key" style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', color:'var(--primary)', fontSize:'15px', opacity:0.7 }} />
                  <input
                    id="new-password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="Minimo 8 caratteri"
                    style={{ ...inputStyle, paddingRight:'46px' }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    style={{ position:'absolute', right:'16px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--primary)', fontSize:'15px', padding:0, opacity:0.7 }}
                  >
                    <i className={`fas ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                  </button>
                </div>
                {/* Strength bar */}
                {password.length > 0 && (
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

              {/* Conferma Password */}
              <div>
                <label style={labelStyle}>Conferma Nuova Password</label>
                <div style={{ position:'relative' }}>
                  <i className="fas fa-check-circle" style={{ position:'absolute', left:'16px', top:'50%', transform:'translateY(-50%)', color: confirmPassword && confirmPassword === password ? '#16a34a' : 'var(--primary)', fontSize:'15px', opacity:0.7 }} />
                  <input
                    id="confirm-password"
                    type={showConfirmPwd ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Ripeti la password"
                    style={{ ...inputStyle, paddingRight:'46px', borderColor: confirmPassword && confirmPassword !== password ? '#dc2626' : undefined }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd(v => !v)}
                    style={{ position:'absolute', right:'16px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--primary)', fontSize:'15px', padding:0, opacity:0.7 }}
                  >
                    <i className={`fas ${showConfirmPwd ? 'fa-eye-slash' : 'fa-eye'}`} />
                  </button>
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p style={{ margin:'6px 0 0', fontSize:'11px', color:'#dc2626', fontWeight:700 }}>
                    <i className="fas fa-times-circle" style={{ marginRight:'4px' }} /> Le password non coincidono
                  </p>
                )}
              </div>

              <button
                id="reset-submit"
                type="submit"
                disabled={loadingSubmit}
                className="comic-button"
                style={{ width:'100%', padding:'16px', background: loadingSubmit ? 'var(--secondary)' : 'var(--primary)', color:'#fff', fontSize:'13px', letterSpacing:'0.2em', marginTop:'8px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', opacity: loadingSubmit ? 0.7 : 1, cursor: loadingSubmit ? 'not-allowed' : 'pointer' }}
              >
                {loadingSubmit ? <><i className="fas fa-spinner fa-spin" /> Aggiornamento...</> : <><i className="fas fa-save" /> AGGIORNA PASSWORD</>}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign:'center', marginTop:'24px', color:'var(--text-muted)', fontSize:'13px', fontWeight:500 }}>
          <Link to="/login" style={{ color:'var(--primary)', fontWeight:700, textDecoration:'none' }}>← Torna al login</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
