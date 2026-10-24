
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
    title: 'Servizio 100% gratuito',
    desc: 'Zero commissioni di agenzia e nessun costo per la tua azienda. Ricerca, selezione e presentazione dei profili sono totalmente a costo zero.',
  },
  {
    icon: 'fa-users',
    title: 'Lavoratori qualificati',
    desc: 'Ti forniamo lavoratori selezionati, pronti a partire. Profili verificati e disponibili.',
  },
  {
    icon: 'fa-file-contract',
    title: 'Gestione burocrazia',
    desc: 'Gestiamo noi visti, documenti e pratiche burocratiche. Zero stress per la tua azienda.',
  },
  {
    icon: 'fa-plane',
    title: 'Assistenza 24/7 in viaggio',
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
      <section className="surface-plum pt-32 sm:pt-40 pb-20 sm:pb-28">
        <div className="container-x grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip chip-dark"><i className="fas fa-building text-sun-400" /> Per aziende e imprese</span>
              <span className="chip !bg-wa/15 !text-[#7CF0A9] !border-wa/25"><i className="fas fa-check-circle" /> Servizio 100% gratis</span>
            </div>
            <h1 className="h-display text-white text-[2.6rem] sm:text-6xl lg:text-7xl mt-6">
              Trovare lavoratori <span className="text-sun-400">qualificati</span>, 100% gratis.
            </h1>
            <p className="text-white/75 text-lg leading-relaxed max-w-2xl mt-6">
              LBS ti mette in contatto con lavoratori italiani selezionati, pronti a operare in Germania.{' '}
              <span className="text-white font-medium">Il nostro servizio di ricerca e selezione è 100% gratuito per i datori di lavoro</span>: zero commissioni di agenzia, nessun costo anticipato o nascosto. Gestiamo burocrazia, visti e supporto con precisione e professionalità. Tu ti concentri sul lavoro.
            </p>

            <div className="mt-8 max-w-xl rounded-3xl bg-white/[0.06] border border-sun-400/40 p-4 flex items-center gap-4">
              <span className="h-14 w-14 rounded-2xl bg-sun-400 text-plum-800 font-heading font-bold text-2xl flex items-center justify-center shrink-0">0€</span>
              <span className="text-sm text-white/75">
                <span className="block font-semibold text-sun-400">Nessuna commissione per la tua impresa</span>
                La ricerca, preselezione e presentazione dei candidati è al 100% gratuita per i datori di lavoro.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <a href="#form-datori" className="btn btn-lg btn-accent group">
                Richiedi lavoratori <i className="fas fa-arrow-right text-xs group-hover:translate-x-1 transition-transform" />
              </a>
              <Link to="/contatti" className="btn btn-lg btn-ghost-light">Parla con noi</Link>
            </div>
          </div>
          <div className="lg:col-span-5 hidden lg:block">
            <div className="relative">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-sun-400/20 to-plum-400/20 blur-2xl" />
              <img src="/img/ufficio_social.jpg" alt="Ufficio LBS — pagina social aziendale" className="relative w-full aspect-[4/5] object-cover rounded-[2rem] ring-1 ring-white/15" />
              <div className="absolute -left-8 bottom-10 bg-white rounded-2xl shadow-[var(--shadow-lift)] p-4 pr-6 flex items-center gap-3">
                <span className="icon-tile !w-11 !h-11 !rounded-xl"><i className="fas fa-user-check" /></span>
                <span>
                  <span className="block text-sm font-semibold text-plum-800">Profili verificati</span>
                  <span className="block text-xs text-ink-soft">pronti a partire</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VANTAGGI ──────────────────────────────────────────────── */}
      <section className="section">
        <div className="container-x">
          <div className="max-w-2xl mb-12 reveal">
            <span className="eyebrow">Perché scegliere LBS</span>
            <h2 className="h-section text-plum-800 mt-4">Il partner che <span className="mark">fa la differenza</span></h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {BENEFIT_DATORI.map((b, i) => (
              <div key={b.title} className={`reveal p-7 rounded-3xl ${i === 0 ? 'bg-sun-400 text-plum-800' : 'card card-hover'}`} style={{ transitionDelay: `${i * 60}ms` }}>
                <span className={`icon-tile ${i === 0 ? '!bg-plum-800 !text-sun-400' : ''}`}><i className={`fas ${b.icon} text-lg`} /></span>
                <h3 className="font-heading font-bold text-xl mt-6 text-plum-800">{b.title}</h3>
                <p className={`leading-relaxed mt-2 text-[15px] ${i === 0 ? 'text-plum-800/75' : 'text-ink-soft'}`}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM ──────────────────────────────────────────────────── */}
      <section id="form-datori" className="pb-20 md:pb-28">
        <div className="container-x">
          <div className="rounded-[2.5rem] surface-plum p-6 sm:p-12 lg:p-14 grid grid-cols-1 lg:grid-cols-12 gap-10 overflow-hidden">
            <div className="lg:col-span-5 reveal">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow eyebrow-light">Richiesta personale</span>
                <span className="chip !bg-wa/15 !text-[#7CF0A9] !border-wa/25">100% gratis per le aziende</span>
              </div>
              <h2 className="h-section text-white mt-4">Richiedi i tuoi lavoratori a costo zero</h2>
              <p className="text-white/70 text-lg leading-relaxed mt-4">
                Compila il modulo — nessun costo, nessuna commissione. Ti ricontatteremo entro 24 ore per discutere le tue esigenze.
              </p>
              <ul className="mt-8 space-y-3 text-white/80">
                {['Nessun costo per la tua azienda', 'Risposta entro 24 ore', 'Nessuno spam'].map(t => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="h-6 w-6 rounded-full bg-sun-400 text-plum-800 flex items-center justify-center text-[10px]"><i className="fas fa-check" /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="lg:col-span-7 reveal bg-white rounded-3xl p-6 sm:p-9 relative">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label htmlFor="d-azienda" className="field-label">Nome azienda / impresa *</label>
                  <input id="d-azienda" type="text" name="nome_azienda" required autoComplete="organization" value={form.nome_azienda} onChange={handleChange} placeholder="Es: Müller GmbH" className="field" />
                </div>
                <div>
                  <label htmlFor="d-ref" className="field-label">Nome referente</label>
                  <input id="d-ref" type="text" name="nome_referente" autoComplete="name" value={form.nome_referente} onChange={handleChange} placeholder="Il tuo nome e cognome" className="field" />
                </div>
                <div>
                  <label htmlFor="d-email" className="field-label">Email aziendale *</label>
                  <input id="d-email" type="email" name="email" required autoComplete="email" value={form.email} onChange={handleChange} placeholder="azienda@email.de" className="field" />
                </div>
                <div>
                  <label htmlFor="d-tel" className="field-label">Telefono</label>
                  <input id="d-tel" type="tel" name="telefono" autoComplete="tel" value={form.telefono} onChange={handleChange} placeholder="+49 000 0000000" className="field" />
                </div>
                <div>
                  <label htmlFor="d-settore" className="field-label">Settore di ricerca *</label>
                  <select id="d-settore" name="settore_ricerca" required value={form.settore_ricerca} onChange={handleChange} className="field">
                    <option value="">Seleziona settore</option>
                    {SETTORI_RICERCA.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="d-num" className="field-label">Lavoratori necessari *</label>
                  <select id="d-num" name="num_lavoratori" required value={form.num_lavoratori} onChange={handleChange} className="field">
                    <option value="">Quanti lavoratori?</option>
                    <option value="1-2">1 - 2 lavoratori</option>
                    <option value="3-5">3 - 5 lavoratori</option>
                    <option value="6-10">6 - 10 lavoratori</option>
                    <option value="10-20">10 - 20 lavoratori</option>
                    <option value="20+">Più di 20 lavoratori</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="d-msg" className="field-label">Descrivi le tue esigenze</label>
                  <textarea id="d-msg" name="messaggio" value={form.messaggio} onChange={handleChange} rows={4}
                    placeholder="Descrivici il tipo di lavoratori che cerchi, le competenze richieste, la zona di lavoro, i turni..."
                    className="field" />
                </div>
              </div>

              {formError && (
                <div role="alert" className="mt-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-3">
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
              <div className="flex justify-center mt-6">
                <HCaptcha
                  ref={captchaRef}
                  sitekey={HCAPTCHA_SITE_KEY}
                  onVerify={(token) => { setCaptchaToken(token); setFormError(null); }}
                  onExpire={() => setCaptchaToken(null)}
                  theme="light"
                />
              </div>

              <button type="submit" disabled={formLoading || !captchaToken} className="btn btn-lg btn-primary w-full mt-6">
                {formLoading
                  ? <><i className="fas fa-spinner fa-spin" /> Invio in corso...</>
                  : <><i className="fas fa-paper-plane" /> Invia richiesta gratuita</>}
              </button>
              <p className="text-center text-xs text-ink-soft mt-4">
                <i className="fas fa-lock mr-1 text-plum-300" /> Nessun costo per la tua azienda · Servizio 100% gratuito · Nessuno spam
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* ── ASSISTENZA ────────────────────────────────────────────── */}
      <section className="pb-20 md:pb-24">
        <div className="container-x">
          <div className="reveal card p-7 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="font-heading font-bold text-2xl sm:text-3xl text-plum-800 tracking-tight">Hai già lavorato con noi? Siamo qui per te.</h2>
              <p className="text-ink-soft mt-2">Per assistenza diretta contattaci su WhatsApp o via email.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-lg btn-wa">
                <i className="fab fa-whatsapp text-lg" /> WhatsApp
              </button>
              <Link to="/contatti" className="btn btn-lg btn-outline">
                <i className="fas fa-envelope text-plum-400" /> Contattaci
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Popup successo */}
      {formSent && (
        <div
          className="fixed inset-0 z-[999] bg-plum-950/60 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setFormSent(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="animate-pop-in w-full max-w-md bg-white rounded-[2rem] p-8 sm:p-10 text-center shadow-[var(--shadow-lift)]" onClick={e => e.stopPropagation()}>
            <span className="mx-auto h-20 w-20 rounded-full bg-sun-100 text-plum-800 flex items-center justify-center text-3xl">
              <i className="fas fa-building" />
            </span>
            <h3 className="h-display text-3xl text-plum-800 mt-6">Richiesta ricevuta!</h3>
            <p className="text-ink-soft mt-3 leading-relaxed">
              Il nostro team ti contatterà entro <strong className="text-plum-600">24 ore</strong> per discutere le tue esigenze di personale.
            </p>
            <div className="flex flex-col gap-3 mt-8">
              <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-lg btn-wa w-full">
                <i className="fab fa-whatsapp text-xl" /> Scrivici su WhatsApp
              </button>
              <button type="button" onClick={() => setFormSent(false)} className="btn btn-outline w-full">Chiudi</button>
            </div>
          </div>
        </div>
      )}

      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />
    </div>
  );
};

export default DatoriDiLavoro;
