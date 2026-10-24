
import * as React from 'react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from '../lib/supabaseClient';
import { WhatsAppModal } from '../components/WhatsAppModal';

const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY as string;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const SETTORI_RICERCA = [
  'Edilizia e Costruzioni',
  'Ristorazione e Cucina',
  'Sanitario e Assistenza',
  'Meccanica e Industria',
  'Logistica e Magazzino',
  'Agricoltura',
  'Pulizie e Facilities',
  'Trasporti e Autotrasporto',
  'IT e Tecnologia',
  'Altro',
];

const BENEFIT_DATORI = [
  {
    icon: 'fa-tags',
    title: 'Servizio 100% Gratuito',
    desc: 'Zero commissioni di agenzia e nessun costo per la tua azienda. Ricerca, selezione e presentazione dei profili sono totalmente a costo zero.',
  },
  {
    icon: 'fa-users',
    title: 'Lavoratori Qualificati',
    desc: 'Ti forniamo lavoratori selezionati, pronti a partire. Profili verificati e disponibili.',
  },
  {
    icon: 'fa-file-contract',
    title: 'Gestione Burocrazia',
    desc: 'Gestiamo noi visti, documenti e pratiche burocratiche. Zero stress per la tua azienda.',
  },
  {
    icon: 'fa-plane',
    title: 'Assistenza 24/7 in Viaggio',
    desc: 'Assistiamo i lavoratori 24/7 durante il viaggio con traduzioni incluse. Arrivano sereni e pronti al lavoro.',
  },
];

const DatoriDiLavoro: React.FC = () => {
  const [form, setForm] = useState({
    nome_azienda: '',
    nome_referente: '',
    email: '',
    telefono: '',
    settore_ricerca: '',
    num_lavoratori: '',
    messaggio: '',
  });
  const [formSent, setFormSent] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showWaModal, setShowWaModal] = useState(false);
  // Anti-spam
  const [honeypot, setHoneypot] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Honeypot
    if (honeypot) return;

    // 2. hCaptcha
    if (!captchaToken) {
      setFormError('Completa la verifica anti-spam per continuare.');
      return;
    }

    // 3. Rate limit
    const now = Date.now();
    const raw = localStorage.getItem('lbs_datori_log');
    const log: number[] = raw ? JSON.parse(raw) : [];
    const recent = log.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      setFormError('Hai inviato troppe richieste di recente. Riprova tra qualche minuto.');
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
      return;
    }

    setFormLoading(true);
    const { error } = await supabase.from('datori_richieste').insert([{
      nome_azienda: form.nome_azienda,
      nome_referente: form.nome_referente || null,
      email: form.email,
      telefono: form.telefono || null,
      settore_ricerca: form.settore_ricerca || null,
      num_lavoratori: form.num_lavoratori || null,
      messaggio: form.messaggio || null,
    }]);
    setFormLoading(false);
    if (error) {
      setFormError("Errore durante l'invio. Riprova o contattaci via WhatsApp.");
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } else {
      localStorage.setItem('lbs_datori_log', JSON.stringify([...recent, now]));
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
      setFormSent(true);
      setForm({ nome_azienda:'', nome_referente:'', email:'', telefono:'', settore_ricerca:'', num_lavoratori:'', messaggio:'' });
    }
  };

  return (
    <div className="flex flex-col relative overflow-hidden">

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section className="relative min-h-[60vh] flex items-center pt-32 pb-20 overflow-hidden bg-[#3D2045]">
        <div className="absolute inset-0 pointer-events-none opacity-10">
          <i className="fas fa-building absolute top-10 left-[5%] text-white" style={{ fontSize: 80 }} />
          <i className="fas fa-handshake absolute top-20 right-[10%] text-white" style={{ fontSize: 60 }} />
          <i className="fas fa-users absolute bottom-10 left-[20%] text-white" style={{ fontSize: 70 }} />
          <i className="fas fa-briefcase absolute bottom-20 right-[20%] text-white" style={{ fontSize: 50 }} />
        </div>
        <div className="max-w-7xl mx-auto px-6 z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="reveal">
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="inline-block bg-yellow-300 text-[#3D2045] px-4 py-2 font-black text-xs tracking-[0.3em] uppercase border-4 border-[#3D2045]">
                  🏢 Per Aziende e Imprese
                </div>
                <div className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 font-black text-xs tracking-[0.2em] uppercase border-4 border-[#3D2045] shadow-[4px_4px_0px_#3D2045]">
                  <i className="fas fa-check-circle text-white"></i>
                  <span>SERVIZIO 100% GRATIS</span>
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-heading font-black text-white leading-[1.0] tracking-tighter uppercase mb-6">
                Trovare<br />
                Lavoratori<br />
                <span className="text-yellow-300">Qualificati,</span><br />
                100% Gratis.
              </h1>
              <p className="text-lg sm:text-xl text-white/80 font-bold max-w-2xl mb-6">
                LBS ti mette in contatto con lavoratori italiani selezionati, pronti a operare in Germania.
                <strong className="text-yellow-300"> Il nostro servizio di ricerca e selezione è 100% gratuito per i datori di lavoro</strong>: zero commissioni di agenzia, nessun costo anticipato o nascosto. Gestiamo burocrazia, visti e supporto con precisione e professionalità. Tu ti concentri sul lavoro.
              </p>

              {/* Callout box zero spese */}
              <div className="bg-white/10 backdrop-blur-md border-2 border-yellow-300 p-4 mb-8 flex items-center gap-4 shadow-[4px_4px_0px_#1a0d1e]">
                <div className="w-12 h-12 bg-yellow-300 text-[#3D2045] flex items-center justify-center font-black text-2xl border-2 border-[#3D2045] flex-shrink-0">
                  0€
                </div>
                <div className="text-sm font-bold text-white">
                  <span className="text-yellow-300 font-black uppercase tracking-wider block text-xs sm:text-sm">Nessuna Commissione per la Tua Impresa</span>
                  La ricerca, preselezione e presentazione dei candidati è al 100% gratuita per i datori di lavoro.
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#form-datori" className="comic-button bg-yellow-300 text-[#3D2045] border-[#3D2045] px-8 py-4 text-lg flex items-center justify-center gap-3 group w-full sm:w-auto">
                  Richiedi Lavoratori <i className="fas fa-arrow-right text-sm group-hover:translate-x-2 transition-transform" />
                </a>
                <Link to="/contatti" className="comic-button-secondary border-white text-white px-8 py-4 text-lg hover:bg-white/10 flex items-center justify-center w-full sm:w-auto">
                  Parla con Noi
                </Link>
              </div>
            </div>
            <div className="reveal hidden lg:block">
              <div className="border-4 border-[#ffdf20] shadow-[8px_8px_0px_#1a0d1e] overflow-hidden">
                <img
                  src="/img/ufficio_social.jpg"
                  alt="Ufficio LBS — pagina social aziendale"
                  className="w-full h-full object-cover"
                  style={{ aspectRatio: '4/3' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VANTAGGI ──────────────────────────────────────────────── */}
      <section className="py-24 bg-transparent">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-left pb-8 reveal">
            <div className="text-[#6E4274] font-black text-xs tracking-[0.2em] uppercase mb-3">Perché Scegliere LBS</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-black text-black dark:text-white tracking-tighter">
              Il Partner che fa la differenza
            </h2>
          </div>
          <hr className="border-t border-black/10 dark:border-white/10 mb-16" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-0 border-4 border-[#3D2045]" style={{ boxShadow: '8px 8px 0px #3D2045' }}>
            {BENEFIT_DATORI.map((b, i) => (
              <div key={i} className="reveal p-8 border-r-4 border-[#3D2045] last:border-r-0 bg-[var(--card-bg)] group hover:bg-[#6E4274] transition-colors duration-300">
                <div className="w-14 h-14 bg-[#6E4274] group-hover:bg-yellow-300 border-4 border-[#3D2045] flex items-center justify-center text-white group-hover:text-[#3D2045] text-xl mb-6 transition-colors">
                  <i className={`fas ${b.icon}`} />
                </div>
                <h3 className="text-lg font-black text-black dark:text-white group-hover:text-white uppercase tracking-tight mb-3 transition-colors">{b.title}</h3>
                <p className="text-sm text-black/70 dark:text-white/70 group-hover:text-white/90 font-bold leading-relaxed transition-colors">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM ──────────────────────────────────────────────────── */}
      <section id="form-datori" className="py-24 bg-[#3D2045] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-5">
          <i className="fas fa-building absolute top-10 right-10 text-white" style={{ fontSize: 120 }} />
        </div>
        <div className="max-w-3xl mx-auto px-6 relative z-10">
          <div className="text-left pb-8 reveal">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="text-yellow-300 font-black text-xs tracking-[0.2em] uppercase">
                Richiesta Personale
              </div>
              <span className="bg-[#25D366] text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 border border-[#3D2045]">
                100% Gratis per le Aziende
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-black text-white tracking-tighter">
              Richiedi i tuoi Lavoratori a Costo Zero
            </h2>
            <p className="text-white/80 font-medium text-base sm:text-lg mt-4">
              Compila il modulo — nessun costo, nessuna commissione. Ti ricontatteremo entro 24 ore per discutere le tue esigenze.
            </p>
          </div>
          <hr className="border-t border-white/20 mb-16" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }} />

          {/* Popup successo */}
          {formSent && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
              onClick={() => setFormSent(false)}>
              <div
                className="comic-card border-8 border-yellow-300"
                style={{ width: '100%', maxWidth: '520px', padding: '48px 40px', textAlign: 'center', background: 'var(--card-bg)', boxShadow: '8px 8px 0px #F59E0B', animation: 'successPop 0.45s cubic-bezier(0.175,0.885,0.32,1.275) both' }}
                onClick={e => e.stopPropagation()}>
                <style>{`@keyframes successPop { from { opacity:0; transform:scale(0.75) translateY(32px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
                <div style={{ fontSize: '80px', marginBottom: '16px', lineHeight: 1 }}>🏢</div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.5rem,4vw,2rem)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em', color: 'var(--text-color)', margin: '0 0 12px' }}>
                  Richiesta Ricevuta!
                </h3>
                <p style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '1rem', marginBottom: '32px', lineHeight: 1.6 }}>
                  Il nostro team ti contatterà entro <strong style={{ color: '#6E4274' }}>24 ore</strong> per discutere le tue esigenze di personale.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={() => setShowWaModal(true)}
                    className="comic-button"
                    style={{ background: '#25D366', color: '#fff', padding: '16px 24px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', textDecoration: 'none', borderColor: '#3D2045', cursor: 'pointer' }}>
                    <i className="fab fa-whatsapp" style={{ fontSize: '22px' }} /> Scrivici su WhatsApp
                  </button>
                  <button onClick={() => setFormSent(false)}
                    style={{ background: 'transparent', border: '3px solid var(--comic-border-color)', color: 'var(--text-muted)', padding: '12px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Chiudi
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="reveal comic-card border-8 border-yellow-300 p-6 sm:p-10 md:p-14" style={{ boxShadow: '8px 8px 0px #F59E0B' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Nome Azienda / Impresa *</label>
                <input type="text" name="nome_azienda" required value={form.nome_azienda} onChange={handleChange}
                  placeholder="Es: Müller GmbH"
                  className="w-full border-4 border-[#3D2045] bg-transparent px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-yellow-400 transition-colors placeholder:text-black/30 dark:placeholder:text-white/30" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Nome Referente</label>
                <input type="text" name="nome_referente" value={form.nome_referente} onChange={handleChange}
                  placeholder="Il tuo nome e cognome"
                  className="w-full border-4 border-[#3D2045] bg-transparent px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-yellow-400 transition-colors placeholder:text-black/30 dark:placeholder:text-white/30" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Email Aziendale *</label>
                <input type="email" name="email" required value={form.email} onChange={handleChange}
                  placeholder="azienda@email.de"
                  className="w-full border-4 border-[#3D2045] bg-transparent px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-yellow-400 transition-colors placeholder:text-black/30 dark:placeholder:text-white/30" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Telefono</label>
                <input type="tel" name="telefono" value={form.telefono} onChange={handleChange}
                  placeholder="+49 000 0000000"
                  className="w-full border-4 border-[#3D2045] bg-transparent px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-yellow-400 transition-colors placeholder:text-black/30 dark:placeholder:text-white/30" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Settore di Ricerca *</label>
                <select name="settore_ricerca" required value={form.settore_ricerca} onChange={handleChange}
                  className="w-full border-4 border-[#3D2045] bg-[var(--card-bg)] px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-yellow-400 transition-colors">
                  <option value="">— Seleziona settore —</option>
                  {SETTORI_RICERCA.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Lavoratori Necessari *</label>
                <select name="num_lavoratori" required value={form.num_lavoratori} onChange={handleChange}
                  className="w-full border-4 border-[#3D2045] bg-[var(--card-bg)] px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-yellow-400 transition-colors">
                  <option value="">— Quanti lavoratori? —</option>
                  <option value="1-2">1 - 2 lavoratori</option>
                  <option value="3-5">3 - 5 lavoratori</option>
                  <option value="6-10">6 - 10 lavoratori</option>
                  <option value="10-20">10 - 20 lavoratori</option>
                  <option value="20+">Più di 20 lavoratori</option>
                </select>
              </div>
            </div>
            <div className="mb-8">
              <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Descrivi le tue esigenze</label>
              <textarea name="messaggio" value={form.messaggio} onChange={handleChange} rows={4}
                placeholder="Descrivici il tipo di lavoratori che cerchi, le competenze richieste, la zona di lavoro, i turni..."
                className="w-full border-4 border-[#3D2045] bg-transparent px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-yellow-400 transition-colors placeholder:text-black/30 dark:placeholder:text-white/30 resize-none" />
            </div>
            {formError && (
              <div className="mb-4 p-4 bg-red-50 border-4 border-red-400 text-red-700 font-bold text-sm flex items-center gap-3">
                <i className="fas fa-exclamation-triangle" />{formError}
              </div>
            )}

            {/* Honeypot — invisibile agli umani */}
            <div aria-hidden="true" className="absolute opacity-0 pointer-events-none h-0 overflow-hidden">
              <input
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                placeholder="Non compilare questo campo"
              />
            </div>

            {/* hCaptcha */}
            <div className="flex justify-center mb-6">
              <HCaptcha
                ref={captchaRef}
                sitekey={HCAPTCHA_SITE_KEY}
                onVerify={(token) => { setCaptchaToken(token); setFormError(null); }}
                onExpire={() => setCaptchaToken(null)}
                theme="light"
              />
            </div>

            <button type="submit" disabled={formLoading || !captchaToken}
              className="comic-button w-full bg-yellow-300 text-[#3D2045] py-4 sm:py-6 text-base sm:text-xl hover:bg-yellow-200 border-[#3D2045] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed font-black">
              {formLoading
                ? <><i className="fas fa-spinner fa-spin" /> INVIO IN CORSO...</>
                : <><i className="fas fa-paper-plane" /> INVIA RICHIESTA GRATUITA</>}
            </button>
            <p className="text-center text-xs text-black/50 dark:text-white/50 mt-4 font-bold uppercase tracking-widest">
              🔒 Nessun costo per la tua azienda • Servizio 100% Gratuito • Nessuno spam
            </p>
          </form>
        </div>
      </section>

      {/* ── CTA finale ────────────────────────────────────────────── */}
      <section className="py-20 bg-transparent">
        <div className="max-w-4xl mx-auto px-6 text-left reveal">
          <div className="pb-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-black text-black dark:text-white tracking-tighter">
              Hai già lavorato con noi? Siamo qui per te.
            </h2>
            <p className="text-base sm:text-lg text-black/60 dark:text-white/60 font-medium mt-4">
              Per assistenza diretta contattaci su WhatsApp o via email.
            </p>
          </div>
          <hr className="border-t border-black/10 dark:border-white/10 mb-10" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }} />
          <div className="flex flex-col sm:flex-row gap-4 justify-start">
            <button onClick={() => setShowWaModal(true)}
              className="comic-button bg-[#25D366] text-white border-[#3D2045] px-8 py-4 text-lg flex items-center justify-center gap-3 cursor-pointer">
              <i className="fab fa-whatsapp" /> WhatsApp
            </button>
            <Link to="/contatti" className="comic-button bg-[#6E4274] text-white border-[#3D2045] px-8 py-4 text-lg flex items-center justify-center gap-3">
              <i className="fas fa-envelope" /> Contattaci
            </Link>
          </div>
        </div>
      </section>

      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />
    </div>
  );
};

export default DatoriDiLavoro;
