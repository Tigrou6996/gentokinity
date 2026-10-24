
import * as React from 'react';
import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { TESTIMONIALS, PROCESS_STEPS, WHY_GERMANY } from '../constants';
import { getCareerAdvice } from '../geminiService';
import { Cloud, CurvedArrow, Cursor, CircledX, NeonDoodleArrow, NeonSquiggleArrow, DoodleConnector } from '../components/Decorations';
import { WhatsAppModal } from '../components/WhatsAppModal';
import { supabase } from '../lib/supabaseClient';

const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY as string;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

interface Offerta {
  id: string;
  titolo: string;
  azienda: string | null;
  citta: string;
  stato_germania: string;
  settore: string;
  contratto: string;
  stipendio_min: number | null;
  stipendio_max: number | null;
  stipendio_tipo: string;
  stipendio_modalita: string;
  descrizione: string;
  attiva: boolean;
  in_evidenza: boolean;
  slug: string | null;
  immagine_url: string | null;
}

const SETTORI = [
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

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', cognome: '', email: '', telefono: '', settore: '', messaggio: '' });
  const [formSent, setFormSent] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [offerte, setOfferte] = useState<Offerta[]>(() => {
    try {
      const cached = localStorage.getItem('lbs_cached_offerte_home');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [showWaModal, setShowWaModal] = useState(false);
  // Anti-spam
  const [honeypot, setHoneypot] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  // Search state
  const [searchRuolo, setSearchRuolo] = useState('');
  const [searchCitta, setSearchCitta] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchRuolo.trim()) params.set('ruolo', searchRuolo.trim());
    if (searchCitta.trim()) params.set('citta', searchCitta.trim());
    navigate(`/offerte?${params.toString()}`);
  };

  const carouselRef = React.useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (carouselRef.current) {
      const card = carouselRef.current.firstElementChild as HTMLElement;
      const cardWidth = card ? card.offsetWidth + 24 : 380;
      carouselRef.current.scrollBy({ left: -cardWidth, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      const card = carouselRef.current.firstElementChild as HTMLElement;
      const cardWidth = card ? card.offsetWidth + 24 : 380;
      carouselRef.current.scrollBy({ left: cardWidth, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    supabase
      .from('offerte_lavoro')
      .select('id, titolo, azienda, citta, stato_germania, settore, contratto, stipendio_min, stipendio_max, stipendio_tipo, stipendio_modalita, descrizione, attiva, in_evidenza, slug, immagine_url')
      .eq('attiva', true)
      .order('in_evidenza', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          const evidenziate = data.filter(d => d.in_evidenza);
          const finalOfferte = evidenziate.length > 0 ? (evidenziate as Offerta[]) : (data as Offerta[]);
          setOfferte(finalOfferte);
          try {
            localStorage.setItem('lbs_cached_offerte_home', JSON.stringify(finalOfferte));
          } catch { }
        } else {
          supabase
            .from('offerte_lavoro')
            .select('*')
            .eq('attiva', true)
            .order('created_at', { ascending: false })
            .then(({ data: fallbackData }) => {
              if (fallbackData) {
                setOfferte(fallbackData as Offerta[]);
                try {
                  localStorage.setItem('lbs_cached_offerte_home', JSON.stringify(fallbackData));
                } catch { }
              }
            });
        }
      });
  }, []);

  const SETTORE_ICONS: Record<string, string> = {
    'Edilizia e Costruzioni': 'fa-hard-hat',
    'Ristorazione e Cucina': 'fa-utensils',
    'Sanitario e Assistenza': 'fa-heartbeat',
    'Meccanica e Industria': 'fa-cogs',
    'Logistica e Magazzino': 'fa-boxes',
    'Agricoltura': 'fa-seedling',
    'Pulizie e Facilities': 'fa-broom',
    'Trasporti e Autotrasporto': 'fa-truck',
    'IT e Tecnologia': 'fa-laptop-code',
    'Altro': 'fa-briefcase',
  };

  const CONTRATTO_COLORS: Record<string, string> = {
    'Tempo Indeterminato': '#25D366',
    'Tempo Determinato': '#FF6B35',
    'Stagionale': '#0066CC',
    'Apprendistato': '#6E4274',
  };


  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
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
    const raw = localStorage.getItem('lbs_home_log');
    const log: number[] = raw ? JSON.parse(raw) : [];
    const recent = log.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      setFormError('Hai inviato troppe candidature di recente. Riprova tra qualche minuto.');
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
      return;
    }

    setFormLoading(true);
    const { error } = await supabase.from('candidature').insert([{
      nome: form.nome,
      cognome: form.cognome,
      email: form.email,
      telefono: form.telefono || null,
      settore: form.settore || null,
      messaggio: form.messaggio || null,
    }]);
    setFormLoading(false);
    if (error) {
      setFormError('Errore durante l\'invio. Riprova o contattaci via WhatsApp.');
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } else {
      localStorage.setItem('lbs_home_log', JSON.stringify([...recent, now]));
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
      setFormSent(true);
    }
  };

  const handleAiAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    const result = await getCareerAdvice(aiInput);
    setAiOutput(result || '');
    setIsAiLoading(false);
    setIsDrawerOpen(true);
  };

  return (
    <div className="flex flex-col relative overflow-hidden">

      {/* HERO SECTION - SPIGOLOSO & MODERNO CON CASELLA IMMAGINI */}
      <section className="relative w-full bg-[#3D2045] bg-grid-pattern overflow-hidden pt-28 sm:pt-36 pb-20 sm:pb-28 border-b-8 border-[#3D2045]">

        {/* Glow di sfondo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#6E4274]/30 blur-[130px] pointer-events-none"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">



          {/* GRIGLIA PRINCIPALE: TITOLI GIGANTI + CASELLA IMMAGINI */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-4">

            {/* COLONNA SINISTRA: TITOLI GIGANTI & RICERCA */}
            <div className="lg:col-span-7 flex flex-col items-start text-left select-none relative">

              {/* Neon Doodle Arrow decorativo */}
              <div className="absolute -top-12 -left-8 z-20 pointer-events-none hidden md:block">
                <NeonDoodleArrow className="w-20 h-20 text-[#ffdf20]" color="#ffdf20" />
              </div>

              {/* Scritta Gigante Ultra-Bold Spigolosa */}
              <h1 className="font-heading font-black tracking-tighter leading-[0.9] uppercase text-white">
                <div className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl flex items-center gap-2 text-white">
                  <span className="text-[#ffdf20]">#</span>
                  <span>LBS</span>
                </div>
                <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white tracking-tight mt-1">
                  LAVORO BUSINESS
                </div>
                <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-[#ffdf20] tracking-tight mt-1">
                  E SERVIZI
                </div>
                <div className="text-2xl sm:text-3xl md:text-4xl text-white/80 tracking-widest font-extrabold mt-3 border-l-4 border-[#ffdf20] pl-4">
                  IN GERMANIA
                </div>
              </h1>

              {/* Sottotitolo descrittivo pulito */}
              <p className="text-white/85 font-medium text-base sm:text-lg max-w-xl mt-6 leading-relaxed">
                Trasformiamo la tua voglia di riscatto in un contratto di lavoro reale, alloggio sicuro e supporto continuo.
                <strong className="text-[#ffdf20] block sm:inline"> Assistenza continua, traduzioni e alloggio garantito.</strong>
              </p>

              {/* BARRA RICERCA SPIGOLOSA */}
              <div className="w-full max-w-xl mt-8">
                <form onSubmit={handleSearchSubmit} className="bg-white/10 backdrop-blur-xl border-2 border-white/30 p-3 shadow-[6px_6px_0px_#1a0d1e] flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-xs"></i>
                    <input
                      type="text"
                      value={searchRuolo}
                      onChange={e => setSearchRuolo(e.target.value)}
                      placeholder="Ruolo (es. Cuoco, Operaio)"
                      className="w-full bg-white/10 pl-10 pr-4 py-3 text-xs sm:text-sm font-bold text-white placeholder-white/50 outline-none border border-white/20 focus:border-[#ffdf20]"
                    />
                  </div>
                  <div className="relative sm:w-40">
                    <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-xs"></i>
                    <input
                      type="text"
                      value={searchCitta}
                      onChange={e => setSearchCitta(e.target.value)}
                      placeholder="Città"
                      className="w-full bg-white/10 pl-10 pr-4 py-3 text-xs sm:text-sm font-bold text-white placeholder-white/50 outline-none border border-white/20 focus:border-[#ffdf20]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-[#ffdf20] text-[#3D2045] font-black text-xs sm:text-sm uppercase tracking-wider px-6 py-3 hover:bg-yellow-300 transition-all flex items-center justify-center gap-2 border-2 border-[#3D2045] shadow-[3px_3px_0px_#3D2045] cursor-pointer"
                  >
                    <span>Cerca</span>
                    <i className="fas fa-arrow-right text-xs"></i>
                  </button>
                </form>

                {/* Tag rapidi popolari spigolosi */}
                <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
                  <span className="text-white/60 font-bold uppercase text-[11px] tracking-wider">Ricerche rapide:</span>
                  {['Magazziniere', 'Cuoco', 'Edilizia', 'Autista', 'Saldatore'].map((role, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setSearchRuolo(role); }}
                      className="bg-white/10 hover:bg-[#ffdf20] hover:text-[#3D2045] text-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-wider border border-white/20 transition-all cursor-pointer"
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* COLONNA DESTRA: CASELLA IMMAGINI */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center relative mt-6 lg:mt-0">



              {/* Immagine Hero — Salvatore Cucuzza */}
              <div className="w-full relative overflow-hidden group border-4 border-[#ffdf20] shadow-[10px_10px_0px_#1a0d1e]">
                <img
                  src="/img/salvatore_hero.jpg"
                  alt="Salvatore Cucuzza — Titolare LBS"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  style={{ minHeight: '420px', maxHeight: '560px' }}
                />
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* SEZIONE 3 CARD - BIANCA E SPIGOLOSA */}
      <section className="relative z-20 bg-white dark:bg-[#150a19] pt-14 pb-20 px-6 sm:px-12 border-b-8 border-[#3D2045] shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch relative">

            {/* Card 1 */}
            <div className="bg-white dark:bg-[#201127] p-7 sm:p-8 border-4 border-[#3D2045] shadow-[6px_6px_0px_#3D2045] flex flex-col justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-[#3D2045] dark:text-white uppercase tracking-tight mb-2">
                  PARTENZA SICURA & DIRETTA
                </h3>
                <p className="text-black/70 dark:text-white/70 text-sm font-bold mb-6 leading-relaxed">
                  Ti colleghiamo direttamente con aziende serie e verificate in Germania prima ancora di metterti in viaggio.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t-2 border-[#3D2045]/15">
                <div className="bg-[#3D2045] text-white text-xs font-black px-3.5 py-1.5 border-2 border-[#3D2045] uppercase tracking-wider flex items-center gap-2">
                  <i className="fas fa-shield-alt text-[#ffdf20]"></i> Massima Sicurezza
                </div>
                <div className="bg-[#ffdf20] text-[#3D2045] text-xs font-black px-3.5 py-1.5 border-2 border-[#3D2045] uppercase tracking-wider">
                  Affidabile al 100%
                </div>
              </div>
            </div>

            {/* Doodle Connector 1 -> 2 */}
            <div className="hidden md:flex absolute top-1/2 left-[31%] -translate-y-1/2 z-10 pointer-events-none">
              <DoodleConnector className="w-14 h-10 text-[#3D2045] dark:text-white/40 transform -rotate-12" />
            </div>

            {/* Card 2 */}
            <div className="bg-white dark:bg-[#201127] p-7 sm:p-8 border-4 border-[#3D2045] shadow-[6px_6px_0px_#3D2045] flex flex-col justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-[#3D2045] dark:text-white uppercase tracking-tight mb-2">
                  CONTRATTO & ALLOGGIO INCLUSO
                </h3>
                <p className="text-black/70 dark:text-white/70 text-sm font-bold mb-6 leading-relaxed">
                  Contratto regolare a tempo indeterminato con camera o alloggio pronto all'arrivo.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t-2 border-[#3D2045]/15">
                <div className="bg-[#3D2045] text-white text-xs font-black px-3.5 py-1.5 border-2 border-[#3D2045] uppercase tracking-wider">
                  +200 Imprese
                </div>
                <div className="bg-[#ffdf20] text-[#3D2045] text-xs font-black px-3 py-1.5 border-2 border-[#3D2045] uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fas fa-check"></i>
                  <span>Verificato</span>
                </div>
              </div>
            </div>

            {/* Doodle Connector 2 -> 3 */}
            <div className="hidden md:flex absolute top-1/2 left-[64%] -translate-y-1/2 z-10 pointer-events-none">
              <DoodleConnector className="w-14 h-10 text-[#3D2045] dark:text-white/40 transform scale-y-[-1] rotate-12" />
            </div>

            {/* Card 3 */}
            <div className="bg-white dark:bg-[#201127] p-7 sm:p-8 border-4 border-[#3D2045] shadow-[6px_6px_0px_#3D2045] flex flex-col justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-[#3D2045] dark:text-white uppercase tracking-tight mb-2">
                  ASSISTENZA 24/7 & TRADUZIONI
                </h3>
                <p className="text-black/70 dark:text-white/70 text-sm font-bold mb-6 leading-relaxed">
                  Ti seguiamo lungo tutto il viaggio: medico, apertura conto e documenti sempre inclusi.
                </p>
              </div>
              <div className="bg-[#ffdf20] text-[#3D2045] px-4 py-2 border-2 border-[#3D2045] flex items-center justify-between font-black text-xs sm:text-sm">
                <span className="uppercase tracking-wider">SUPPORTO CONTINUO</span>
                <span className="text-[10px] font-black bg-[#3D2045] text-[#ffdf20] px-2 py-0.5 border border-[#3D2045]">H24</span>
              </div>
            </div>

          </div>
        </div>
      </section>



      {/* COME FUNZIONA */}
      <section className="py-32 bg-transparent relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-0">
          <Cloud className="absolute top-10 right-10 w-24 h-24 text-[#6E4274] opacity-10" />
          <CurvedArrow className="absolute bottom-20 left-10 w-20 h-20 text-[#6E4274] opacity-10" />
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-left mb-16 pb-8 reveal">
            <div className="text-[#6E4274] font-black text-xs tracking-[0.2em] uppercase mb-3">Come Funziona</div>
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-heading font-black text-black dark:text-white tracking-tighter">
              4 Passi verso la Germania
            </h2>
            <p className="text-black/60 dark:text-white/60 mt-4 text-base sm:text-lg font-medium max-w-2xl">
              Un percorso chiaro e testato per trovare il tuo lavoro ideale, senza sorprese e con tutto il supporto necessario.
            </p>
          </div>
          <hr className="border-t border-black/10 dark:border-white/10 -mx-6 mb-16" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-4 border-[#3D2045]" style={{ boxShadow: '8px 8px 0px #3D2045' }}>
            {PROCESS_STEPS.map((step, i) => (
              <div key={i} className="reveal p-6 sm:p-10 border-r-4 border-b-4 md:border-b-0 border-[#3D2045] last:border-r-0 relative bg-[var(--card-bg)] group hover:bg-[#6E4274] transition-colors duration-300">
                <div className="text-5xl sm:text-7xl font-heading font-black text-[#6E4274] group-hover:text-yellow-300 mb-4 tracking-tighter transition-colors">{step.step}</div>
                <div className="w-12 h-12 bg-[#6E4274] group-hover:bg-yellow-300 flex items-center justify-center text-white group-hover:text-[#3D2045] text-xl mb-6 border-4 border-[#3D2045] transition-colors">
                  <i className={`fas ${step.icon}`}></i>
                </div>
                <h3 className="text-lg font-black text-black dark:text-white group-hover:text-white uppercase tracking-tight mb-3 transition-colors">{step.title}</h3>
                <p className="text-sm text-black/70 dark:text-white/70 group-hover:text-white/90 font-bold leading-relaxed transition-colors">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OFFERTE IN PRIMO PIANO - CAROSELLO CON FRECCE AI LATI */}
      <section className="py-24 bg-transparent relative overflow-hidden w-full">
        <div className="absolute inset-0 pointer-events-none z-0">
          <Cloud className="absolute top-10 right-10 w-24 h-24 text-[#6E4274] opacity-10" />
          <CurvedArrow className="absolute bottom-10 left-10 w-20 h-20 text-[#6E4274] opacity-10" />
        </div>

        <div className="w-full px-4 sm:px-12 max-w-[1600px] mx-auto relative z-10">
          {/* Header */}
          <div className="text-left pb-8 reveal flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="text-[#6E4274] font-black text-xs tracking-[0.2em] uppercase mb-3">Offerte in Primo Piano</div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-black text-black dark:text-white tracking-tighter">
                Lavori disponibili ora
              </h2>
            </div>

            <Link
              to="/offerte"
              className="comic-button bg-yellow-300 text-[#3D2045] border-[#3D2045] px-6 py-3 text-xs font-black uppercase tracking-widest hover:bg-yellow-200 flex items-center gap-2 self-start md:self-auto"
            >
              Vedi tutte ({offerte.length}) <i className="fas fa-arrow-right text-[10px]" />
            </Link>
          </div>
          <hr className="border-t border-black/10 dark:border-white/10 mb-12" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }} />

          {/* Carosello con Frecce a Sinistra e Destra ai Limiti */}
          {offerte.length > 0 ? (
            <div className="relative w-full">
              {/* Frecce visibili solo se ci sono più di 4 offerte */}
              {offerte.length > 4 && (
                <>
                  {/* Freccia Sinistra (al limite sinistro) */}
                  <button
                    onClick={scrollLeft}
                    aria-label="Precedente"
                    className="comic-button absolute -left-3 sm:-left-6 top-1/2 -translate-y-1/2 z-30 bg-[#6E4274] text-white border-[#3D2045] w-11 h-11 sm:w-14 sm:h-14 text-xl sm:text-2xl font-black flex items-center justify-center hover:bg-[#3D2045] shadow-[4px_4px_0px_#3D2045] cursor-pointer transition-all hover:scale-110 active:scale-95"
                  >
                    ←
                  </button>

                  {/* Freccia Destra (al limite destro) */}
                  <button
                    onClick={scrollRight}
                    aria-label="Successivo"
                    className="comic-button absolute -right-3 sm:-right-6 top-1/2 -translate-y-1/2 z-30 bg-[#6E4274] text-white border-[#3D2045] w-11 h-11 sm:w-14 sm:h-14 text-xl sm:text-2xl font-black flex items-center justify-center hover:bg-[#3D2045] shadow-[4px_4px_0px_#3D2045] cursor-pointer transition-all hover:scale-110 active:scale-95"
                  >
                    →
                  </button>
                </>
              )}

              {/* Traccia Carosello con Snap-Start */}
              <div
                ref={carouselRef}
                className={`flex gap-6 overflow-x-auto scroll-smooth pb-8 pt-2 px-2 sm:px-6 snap-x snap-mandatory ${offerte.length <= 4 ? 'lg:justify-center' : ''}`}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {offerte.map((o) => (
                  <div
                    key={o.id}
                    className="snap-start flex-shrink-0 w-[290px] sm:w-[350px] md:w-[380px] lg:w-[400px] group comic-card border-4 border-[#3D2045] p-6 sm:p-8 flex flex-col gap-4 hover:border-[#6E4274] transition-all bg-[var(--card-bg)]"
                    style={{ boxShadow: '6px 6px 0px #3D2045' }}
                  >
                    {/* Immagine se presente */}
                    {o.immagine_url && (
                      <div className="w-full h-40 overflow-hidden border-2 border-[#3D2045] -mt-2 -mx-2 mb-2 relative">
                        <img src={o.immagine_url} alt={o.titolo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        {o.in_evidenza && (
                          <span className="absolute top-2 left-2 bg-yellow-300 text-[#3D2045] px-2 py-0.5 font-black text-[10px] uppercase tracking-widest border border-[#3D2045]">
                            ⭐ Evidenza
                          </span>
                        )}
                      </div>
                    )}

                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-12 h-12 bg-[#6E4274] border-4 border-[#3D2045] flex items-center justify-center text-white text-lg flex-shrink-0">
                        <i className={`fas ${SETTORE_ICONS[o.settore] ?? 'fa-briefcase'}`} />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {o.in_evidenza && !o.immagine_url && (
                          <span className="bg-yellow-300 text-[#3D2045] px-2 py-0.5 font-black text-[10px] uppercase tracking-widest border border-[#3D2045]">
                            ⭐ Evidenza
                          </span>
                        )}
                        <span
                          className="text-[10px] font-black uppercase tracking-widest px-3 py-1 border-2"
                          style={{
                            color: CONTRATTO_COLORS[o.contratto] ?? '#6E4274',
                            borderColor: CONTRATTO_COLORS[o.contratto] ?? '#6E4274',
                            background: (CONTRATTO_COLORS[o.contratto] ?? '#6E4274') + '18',
                          }}
                        >
                          {o.contratto}
                        </span>
                      </div>
                    </div>

                    {/* Title & company */}
                    <div>
                      <h3 className="text-lg font-black text-black dark:text-white uppercase tracking-tight leading-tight mb-1 line-clamp-2">
                        {o.titolo}
                      </h3>
                      {o.azienda && <p className="text-[#6E4274] font-black text-xs uppercase tracking-widest">{o.azienda}</p>}
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 text-black/60 dark:text-white/60">
                      <i className="fas fa-map-marker-alt text-[#6E4274] text-sm" />
                      <span className="text-xs font-black uppercase tracking-widest">{o.citta}{o.stato_germania ? `, ${o.stato_germania}` : ''}</span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-black/70 dark:text-white/70 font-bold leading-relaxed line-clamp-2 flex-1">{o.descrizione}</p>

                    {/* Salary + CTA */}
                    <div className="flex items-center justify-between pt-4 border-t-4 border-[#3D2045] mt-auto">
                      <div>
                        {(o.stipendio_min || o.stipendio_max) && o.stipendio_modalita !== 'concordare' ? (
                          <div className="text-[#6E4274] font-black text-sm sm:text-base">
                            {o.stipendio_modalita === 'a_partire_da'
                              ? `Da €${(o.stipendio_min || 0).toLocaleString()}`
                              : o.stipendio_modalita === 'fisso'
                                ? `€${(o.stipendio_min || 0).toLocaleString()}`
                                : o.stipendio_min && o.stipendio_max
                                  ? `€${o.stipendio_min.toLocaleString()} – €${o.stipendio_max.toLocaleString()}`
                                  : o.stipendio_min
                                    ? `Da €${o.stipendio_min.toLocaleString()}`
                                    : `Fino a €${o.stipendio_max!.toLocaleString()}`}
                            <span className="text-xs text-black/40 dark:text-white/40 font-bold ml-1">/m {o.stipendio_tipo === 'netto' ? 'netti' : 'lordi'}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-black/40 dark:text-white/40 font-bold uppercase tracking-widest">Da concordare</span>
                        )}
                      </div>
                      <Link
                        to={`/offerte/${o.slug || o.id}`}
                        className="comic-button bg-yellow-300 text-[#3D2045] border-[#3D2045] px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-yellow-200 flex items-center gap-2"
                      >
                        Scopri <i className="fas fa-arrow-right text-[10px]" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 font-bold text-black/50">Nessuna offerta disponibile al momento.</div>
          )}
        </div>
      </section>

      {/* PERCHÉ LA GERMANIA */}
      <section className="py-32 bg-[#6E4274] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-10">
          <CircledX className="absolute top-10 left-10 w-20 h-20 text-white" />
          <Cursor className="absolute bottom-10 right-10 w-16 h-16 text-white" />
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-left pb-8 reveal">
            <div className="text-yellow-300 font-black text-xs tracking-[0.2em] uppercase mb-3">Perché Scegliere La Germania</div>
            <h2 className="text-4xl md:text-6xl font-heading font-black text-white tracking-tighter">
              Non è solo un lavoro, è un nuovo futuro.
            </h2>
            <p className="text-white/60 mt-4 text-base sm:text-lg font-medium max-w-2xl">
              Scopri i vantaggi di costruire la tua carriera in uno dei paesi più forti d'Europa.
            </p>
          </div>
          <hr className="border-t border-white/20 mb-16" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {WHY_GERMANY.map((item, i) => (
              <div key={i} className="reveal bg-white/10 border-4 border-white/40 p-6 sm:p-10 group hover:bg-white transition-colors duration-300" style={{ boxShadow: '6px 6px 0px rgba(0,0,0,0.3)' }}>
                <div className="w-16 h-16 bg-yellow-300 border-4 border-[#3D2045] flex items-center justify-center text-[#3D2045] text-2xl mb-8 group-hover:bg-[#6E4274] group-hover:text-white transition-colors">
                  <i className={`fas ${item.icon}`}></i>
                </div>
                <h3 className="text-2xl font-black text-white group-hover:text-[#3D2045] uppercase tracking-tight mb-4 transition-colors">{item.title}</h3>
                <p className="text-white/80 group-hover:text-black/70 leading-relaxed font-bold transition-colors">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEZIONE VIDEO (GRANDI E D'IMPATTO: CERCHI LAVORO? / CERCHI PERSONALE?) */}
      <section className="py-24 bg-[#1E0E22] relative overflow-hidden border-t-4 border-b-4 border-black/40">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          
          {/* Header Principale */}
          <div className="text-left pb-12 reveal">
            <div className="inline-flex items-center gap-2 bg-yellow-300 text-[#3D2045] px-3 py-1 font-black text-xs tracking-[0.2em] uppercase mb-4 border-2 border-black">
              <i className="fas fa-play-circle text-base"></i>
              <span>Video Ufficiali LBS</span>
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-heading font-black text-white tracking-tighter">
              Guarda come lavoriamo.
            </h2>
            <p className="text-white/70 mt-3 text-base sm:text-xl font-medium max-w-3xl leading-relaxed">
              Video e spiegazioni dirette: dall'assistenza sul campo per chi parte, alla selezione del personale per le aziende. Guarda i video direttamente qui in grande formato.
            </p>
          </div>

          {/* =========================================
              SEZIONE 1: CERCHI LAVORO? (PER I CANDIDATI)
             ========================================= */}
          <div className="mb-20 reveal bg-white/5 border-4 border-white/20 p-6 sm:p-10" style={{ boxShadow: '8px 8px 0px rgba(0,0,0,0.4)' }}>
            {/* Intestazione Sezione Candidati */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8 border-b-2 border-white/10 pb-6">
              <div className="flex items-center gap-4">
                <span className="w-12 h-12 bg-yellow-300 text-[#3D2045] font-black flex items-center justify-center text-2xl border-2 border-[#3D2045]">
                  <i className="fas fa-user-tie"></i>
                </span>
                <div>
                  <h3 className="text-2xl sm:text-4xl font-heading font-black text-white uppercase tracking-tight">
                    Cerchi lavoro?
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-yellow-300 uppercase tracking-widest mt-1">
                    Guide e spiegazioni per chi vuole lavorare in Germania
                  </p>
                </div>
              </div>
              <Link
                to="/offerte"
                className="inline-flex items-center gap-2 bg-yellow-300 hover:bg-yellow-400 text-[#3D2045] font-black px-5 py-2.5 text-xs uppercase tracking-wider border-2 border-[#3D2045] transition-transform hover:-translate-y-0.5"
              >
                <span>Vedi tutte le offerte</span>
                <i className="fas fa-arrow-right text-[10px]"></i>
              </Link>
            </div>

            {/* 2 Video Grandi per Candidati */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* VIDEO 1: ATTIVO (YOUTUBE) */}
              <div className="flex flex-col bg-black/40 border-2 border-white/10 p-5 group hover:border-yellow-300/60 transition-colors">
                <div className="w-full aspect-video bg-black border-4 border-black relative overflow-hidden shadow-[6px_6px_0px_rgba(0,0,0,0.6)] mb-5">
                  <iframe
                    className="w-full h-full"
                    src="https://www.youtube-nocookie.com/embed/x3VZojZ8xk8"
                    title="Lavoro in Germania con assistenza 24/7 | Cos'è l'assistenza LBS"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-block bg-emerald-500 text-white text-[11px] font-black uppercase px-2.5 py-0.5 tracking-wider border border-emerald-400">
                    <i className="fas fa-check-circle mr-1"></i> Video Disponibile
                  </span>
                  <a
                    href="https://www.youtube.com/watch?v=x3VZojZ8xk8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-white/60 hover:text-yellow-300 transition-colors flex items-center gap-1"
                  >
                    <span>Apri su YouTube</span>
                    <i className="fas fa-external-link-alt text-[10px]"></i>
                  </a>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-white mb-2 leading-snug">
                  Cos'è l'assistenza 24/7 di LBS in Germania
                </h4>
                <p className="text-sm sm:text-base text-white/70 font-medium leading-relaxed">
                  Alloggio garantito, contratto tedesco regolare, documenti, apertura conto e assistenza giorno e notte. Salvatore Cucuzza ti spiega punto per punto come funziona.
                </p>
              </div>

              {/* VIDEO 2: COMING SOON */}
              <div className="flex flex-col bg-black/40 border-2 border-white/10 p-5 group hover:border-yellow-300/60 transition-colors">
                <div className="w-full aspect-video bg-gradient-to-br from-black/80 via-purple-950/40 to-black/80 border-4 border-dashed border-white/20 relative flex flex-col items-center justify-center p-6 text-center shadow-[6px_6px_0px_rgba(0,0,0,0.6)] mb-5">
                  <div className="w-16 h-16 rounded-full bg-yellow-300/10 border-2 border-yellow-300/40 flex items-center justify-center text-yellow-300 text-2xl mb-3 group-hover:scale-110 transition-transform">
                    <i className="fas fa-film opacity-80"></i>
                  </div>
                  <span className="inline-block px-3 py-1 bg-yellow-300 text-[#3D2045] font-black text-[11px] tracking-widest uppercase mb-2 border border-black">
                    Coming Soon
                  </span>
                  <p className="text-white/80 text-xs sm:text-sm font-bold uppercase tracking-wider">
                    In fase di montaggio
                  </p>
                </div>
                <div className="mb-2">
                  <span className="inline-block bg-white/10 text-white/70 text-[11px] font-black uppercase px-2.5 py-0.5 tracking-wider border border-white/20">
                    Prossimamente
                  </span>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-white/90 mb-2 leading-snug">
                  Dalla valigia al primo giorno di lavoro
                </h4>
                <p className="text-sm sm:text-base text-white/60 font-medium leading-relaxed">
                  Guida passo dopo passo: come organizzare la partenza, cosa portare, l'accoglienza nell'alloggio e il primo incontro con il datore di lavoro.
                </p>
              </div>

            </div>
          </div>

          {/* =========================================
              SEZIONE 2: CERCHI PERSONALE? (PER LE AZIENDE)
             ========================================= */}
          <div className="reveal bg-white/5 border-4 border-white/20 p-6 sm:p-10" style={{ boxShadow: '8px 8px 0px rgba(0,0,0,0.4)' }}>
            {/* Intestazione Sezione Aziende */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8 border-b-2 border-white/10 pb-6">
              <div className="flex items-center gap-4">
                <span className="w-12 h-12 bg-yellow-300 text-[#3D2045] font-black flex items-center justify-center text-2xl border-2 border-[#3D2045]">
                  <i className="fas fa-building"></i>
                </span>
                <div>
                  <h3 className="text-2xl sm:text-4xl font-heading font-black text-white uppercase tracking-tight">
                    Cerchi personale?
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-yellow-300 uppercase tracking-widest mt-1">
                    Servizio dedicato a ristoranti, hotel, imprese edili e magazzini in Germania
                  </p>
                </div>
              </div>
              <Link
                to="/datori-di-lavoro"
                className="inline-flex items-center gap-2 bg-yellow-300 hover:bg-yellow-400 text-[#3D2045] font-black px-5 py-2.5 text-xs uppercase tracking-wider border-2 border-[#3D2045] transition-transform hover:-translate-y-0.5"
              >
                <span>Info per Datori di Lavoro</span>
                <i className="fas fa-arrow-right text-[10px]"></i>
              </Link>
            </div>

            {/* 2 Video Grandi per Aziende */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* VIDEO 1 AZIENDE: COMING SOON */}
              <div className="flex flex-col bg-black/40 border-2 border-white/10 p-5 group hover:border-yellow-300/60 transition-colors">
                <div className="w-full aspect-video bg-gradient-to-br from-black/80 via-purple-950/40 to-black/80 border-4 border-dashed border-white/20 relative flex flex-col items-center justify-center p-6 text-center shadow-[6px_6px_0px_rgba(0,0,0,0.6)] mb-5">
                  <div className="w-16 h-16 rounded-full bg-yellow-300/10 border-2 border-yellow-300/40 flex items-center justify-center text-yellow-300 text-2xl mb-3 group-hover:scale-110 transition-transform">
                    <i className="fas fa-film opacity-80"></i>
                  </div>
                  <span className="inline-block px-3 py-1 bg-yellow-300 text-[#3D2045] font-black text-[11px] tracking-widest uppercase mb-2 border border-black">
                    Coming Soon
                  </span>
                  <p className="text-white/80 text-xs sm:text-sm font-bold uppercase tracking-wider">
                    In fase di ripresa
                  </p>
                </div>
                <div className="mb-2">
                  <span className="inline-block bg-white/10 text-white/70 text-[11px] font-black uppercase px-2.5 py-0.5 tracking-wider border border-white/20">
                    Prossimamente
                  </span>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-white/90 mb-2 leading-snug">
                  Come selezioniamo e verifichiamo i profili
                </h4>
                <p className="text-sm sm:text-base text-white/60 font-medium leading-relaxed">
                  Screening rigoroso dei candidati, colloqui tecnici e verifica reale delle referenze prima dell'inserimento nella tua azienda in Germania.
                </p>
              </div>

              {/* VIDEO 2 AZIENDE: COMING SOON */}
              <div className="flex flex-col bg-black/40 border-2 border-white/10 p-5 group hover:border-yellow-300/60 transition-colors">
                <div className="w-full aspect-video bg-gradient-to-br from-black/80 via-purple-950/40 to-black/80 border-4 border-dashed border-white/20 relative flex flex-col items-center justify-center p-6 text-center shadow-[6px_6px_0px_rgba(0,0,0,0.6)] mb-5">
                  <div className="w-16 h-16 rounded-full bg-yellow-300/10 border-2 border-yellow-300/40 flex items-center justify-center text-yellow-300 text-2xl mb-3 group-hover:scale-110 transition-transform">
                    <i className="fas fa-film opacity-80"></i>
                  </div>
                  <span className="inline-block px-3 py-1 bg-yellow-300 text-[#3D2045] font-black text-[11px] tracking-widest uppercase mb-2 border border-black">
                    Coming Soon
                  </span>
                  <p className="text-white/80 text-xs sm:text-sm font-bold uppercase tracking-wider">
                    In fase di ripresa
                  </p>
                </div>
                <div className="mb-2">
                  <span className="inline-block bg-white/10 text-white/70 text-[11px] font-black uppercase px-2.5 py-0.5 tracking-wider border border-white/20">
                    Prossimamente
                  </span>
                </div>
                <h4 className="text-xl sm:text-2xl font-black text-white/90 mb-2 leading-snug">
                  Perché il servizio è 100% gratuito per i datori
                </h4>
                <p className="text-sm sm:text-base text-white/60 font-medium leading-relaxed">
                  Zero commissioni e zero costi nascosti per le aziende partner: modello trasparente e assistenza burocratica continua per i dipendenti.
                </p>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* GALLERIA FOTO */}
      <section className="w-full bg-[#1a0d1e] relative overflow-hidden">
        <div className="w-full">
          {/* Titolo */}
          <div className="text-left pb-8 px-6 sm:px-12 pt-16 reveal">
            <div className="text-yellow-300 font-black text-xs tracking-[0.2em] uppercase mb-3">Le Nostre Storie</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-black text-white tracking-tighter">
              Persone reali. Risultati concreti.
            </h2>
          </div>
          <hr className="border-t border-white/10 mb-10" />
          {/* Grid foto full-width */}
          <div className="grid grid-cols-2 md:grid-cols-4 w-full">
            {[
              { img: '/img/salvatore_lavoro.jpg', caption: 'Salvatore al lavoro', tag: '👨‍💼 Titolare' },
              { img: '/img/ufficio_social.jpg', caption: 'La nostra pagina ufficiale', tag: '📱 Social' },
              { img: '/img/ufficio_postazione.jpg', caption: 'Postazione operativa LBS', tag: '🖥️ Ufficio' },
              { img: '/img/ufficio_reception.jpg', caption: 'Sala consulenze LBS', tag: '🤝 Consulenza' },
            ].map((item, i) => (
              <div key={i} className="relative group overflow-hidden" style={{ aspectRatio: '1/1' }}>
                <img
                  src={item.img}
                  alt={item.caption}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  <div className="inline-block bg-yellow-300 text-[#3D2045] px-2 py-1 text-[10px] font-black uppercase tracking-widest mb-2 border-2 border-[#3D2045]">{item.tag}</div>
                  <div className="text-white font-black text-sm sm:text-base uppercase tracking-tight">{item.caption}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORM CANDIDATURA */}
      <section id="candidatura" className="py-32 bg-transparent relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-0">
          <Cloud className="absolute top-10 left-10 w-20 h-20 text-[#6E4274] opacity-10" />
          <CurvedArrow className="absolute bottom-20 right-10 w-16 h-16 text-[#6E4274] opacity-10 -rotate-12" />
        </div>
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="text-left pb-8 reveal">
            <div className="text-[#6E4274] font-black text-xs tracking-[0.2em] uppercase mb-3">Invia la tua candidatura</div>
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-heading font-black text-black dark:text-white tracking-tighter">
              Inizia il tuo percorso oggi
            </h2>
            <p className="text-black/60 dark:text-white/60 mt-4 text-base sm:text-xl font-medium">
              Compila il modulo — ti ricontatteremo entro 24 ore. Inizia subito a costruire il tuo futuro in Germania con il nostro supporto completo.
            </p>
          </div>
          <hr className="border-t border-black/10 dark:border-white/10 mb-16" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }} />

          {/* ── Banner: Sei un datore di lavoro? ── */}
          <div className="reveal mb-10 border-4 border-[#3D2045] p-5 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: 'linear-gradient(135deg, #3D2045 0%, #6E4274 100%)', boxShadow: '4px 4px 0px #3D2045' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-300 border-4 border-[#3D2045] flex items-center justify-center text-[#3D2045] text-xl flex-shrink-0">
                <i className="fas fa-building" />
              </div>
              <div>
                <div className="text-white font-black text-base sm:text-lg uppercase tracking-tight">Sei un datore di lavoro?</div>
                <div className="text-white/70 text-xs font-bold uppercase tracking-widest">Stai cercando lavoratori qualificati? Abbiamo quello che ti serve.</div>
              </div>
            </div>
            <Link
              to="/datori-di-lavoro"
              className="comic-button bg-yellow-300 text-[#3D2045] border-[#3D2045] px-6 py-3 text-sm font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap hover:bg-yellow-200 flex-shrink-0">
              Scopri come <i className="fas fa-arrow-right" />
            </Link>
          </div>

          {/* ── Popup di successo ─────────────────────────────────── */}
          {formSent && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
              onClick={() => setFormSent(false)}>
              <div
                className="comic-card border-8 border-[#6E4274]"
                style={{ width: '100%', maxWidth: '520px', padding: '48px 40px', textAlign: 'center', background: 'var(--card-bg)', boxShadow: '8px 8px 0px #6E4274', animation: 'successPop 0.45s cubic-bezier(0.175,0.885,0.32,1.275) both' }}
                onClick={e => e.stopPropagation()}>
                <style>{`@keyframes successPop { from { opacity:0; transform:scale(0.75) translateY(32px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
                <div style={{ fontSize: '80px', marginBottom: '16px', lineHeight: 1 }}>✅</div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.6rem,4vw,2.2rem)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.03em', color: 'var(--text-color)', margin: '0 0 12px' }}>
                  Candidatura Ricevuta!
                </h3>
                <p style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '1rem', marginBottom: '32px', lineHeight: 1.6 }}>
                  Ti ricontatteremo entro <strong style={{ color: '#6E4274' }}>24 ore</strong>.<br />Nel dubbio, scrivici direttamente su WhatsApp!
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowWaModal(true)}
                    className="comic-button"
                    style={{ background: '#25D366', color: '#fff', padding: '16px 24px', fontSize: '1rem', display: 'flex', itemsAlign: 'center', justifyContent: 'center', gap: '12px', textDecoration: 'none', borderColor: '#3D2045', cursor: 'pointer' }}>
                    <i className="fab fa-whatsapp" style={{ fontSize: '22px' }} /> Scrivici su WhatsApp
                  </button>
                  <button
                    onClick={() => setFormSent(false)}
                    style={{ background: 'transparent', border: '3px solid var(--comic-border-color)', color: 'var(--text-muted)', padding: '12px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-inter)' }}>
                    Chiudi
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="reveal comic-card border-8 border-[#3D2045] p-6 sm:p-10 md:p-14" style={{ boxShadow: '8px 8px 0px #3D2045' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Nome *</label>
                <input
                  type="text"
                  name="nome"
                  required
                  value={form.nome}
                  onChange={handleFormChange}
                  placeholder="Il tuo nome"
                  className="w-full border-4 border-[#3D2045] bg-transparent px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors placeholder:text-black/30 dark:placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Cognome *</label>
                <input
                  type="text"
                  name="cognome"
                  required
                  value={form.cognome}
                  onChange={handleFormChange}
                  placeholder="Il tuo cognome"
                  className="w-full border-4 border-[#3D2045] bg-transparent px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors placeholder:text-black/30 dark:placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleFormChange}
                  placeholder="tua@email.it"
                  className="w-full border-4 border-[#3D2045] bg-transparent px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors placeholder:text-black/30 dark:placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Telefono *</label>
                <input
                  type="tel"
                  name="telefono"
                  required
                  value={form.telefono}
                  onChange={handleFormChange}
                  placeholder="+39 000 0000000"
                  className="w-full border-4 border-[#3D2045] bg-transparent px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors placeholder:text-black/30 dark:placeholder:text-white/30"
                />
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Settore Lavorativo *</label>
              <select
                name="settore"
                required
                value={form.settore}
                onChange={handleFormChange}
                className="w-full border-4 border-[#3D2045] bg-[var(--card-bg)] px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors"
              >
                <option value="">— Seleziona il tuo settore —</option>
                {SETTORI.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="mb-8">
              <label className="block text-xs font-black uppercase tracking-[0.2em] text-black dark:text-white mb-2">Raccontaci di te</label>
              <textarea
                name="messaggio"
                value={form.messaggio}
                onChange={handleFormChange}
                rows={4}
                placeholder="Descrivici la tua esperienza, le tue aspettative e qualsiasi cosa vuoi dirci..."
                className="w-full border-4 border-[#3D2045] bg-transparent px-5 py-4 font-bold text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors placeholder:text-black/30 dark:placeholder:text-white/30 resize-none"
              />
            </div>
            {formError && (
              <div className="mb-4 p-4 bg-red-50 border-4 border-red-400 text-red-700 font-bold text-sm flex items-center gap-3">
                <i className="fas fa-exclamation-triangle"></i>
                {formError}
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

            <button
              type="submit"
              disabled={formLoading || !captchaToken}
              className="comic-button w-full bg-[#6E4274] text-white py-4 sm:py-6 text-base sm:text-xl hover:bg-[#3D2045] border-[#3D2045] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formLoading
                ? <><i className="fas fa-spinner fa-spin"></i> INVIO IN CORSO...</>
                : <><i className="fas fa-paper-plane"></i> INVIA LA TUA CANDIDATURA</>}
            </button>
            <p className="text-center text-xs text-black/50 dark:text-white/50 mt-4 font-bold uppercase tracking-widest">
              🔒 I tuoi dati sono al sicuro. Nessuno spam.
            </p>
          </form>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-32 bg-[#3D2045] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 reveal">
            <div className="inline-block bg-yellow-300 text-[#3D2045] px-6 py-2 font-black text-xs tracking-[0.3em] uppercase mb-6 border-4 border-[#3D2045]">Testimonianze</div>
            <h2 className="text-4xl md:text-5xl font-heading font-black text-white tracking-tighter uppercase">
              Chi ce l'ha fatta.<br /><span className="text-yellow-300">Come te.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.id} className="reveal bg-white/5 border-4 border-white/20 p-6 sm:p-10 group hover:border-yellow-300 transition-colors" style={{ boxShadow: '4px 4px 0px rgba(0,0,0,0.3)' }}>
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, i) => <i key={i} className="fas fa-star text-yellow-300 text-sm"></i>)}
                </div>
                <p className="text-white/90 font-bold leading-relaxed mb-8 text-lg italic">"{t.content}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#6E4274] border-4 border-white/30 flex items-center justify-center text-white font-black text-lg">{t.initial}</div>
                  <div>
                    <div className="text-white font-black uppercase tracking-tight">{t.name}</div>
                    <div className="text-white/50 text-xs font-bold uppercase tracking-widest">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI ASSISTANT */}
      <section className="py-32 bg-transparent relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="reveal inline-block bg-[#6E4274] text-white px-6 py-2 font-black text-sm tracking-widest uppercase mb-6 border-4 border-[#3D2045]">Supporto AI</div>
          <h2 className="text-4xl md:text-5xl font-heading font-black text-black dark:text-white mb-12 reveal tracking-tighter uppercase">
            Hai dubbi?<br /><span className="text-[#6E4274]">Chiedi alla nostra AI</span>
          </h2>
          <div className="reveal">
            <form onSubmit={handleAiAsk} className="flex flex-col sm:flex-row gap-3 max-w-3xl mx-auto">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Es: Di quali documenti ho bisogno?"
                className="flex-1 comic-card px-6 py-5 text-base outline-none focus:border-[#6E4274] transition-all font-bold text-black dark:text-white border-4"
              />
              <button
                disabled={isAiLoading}
                className="comic-button bg-[#6E4274] text-white px-8 py-5 hover:bg-[#3D2045] disabled:opacity-50 whitespace-nowrap"
              >
                {isAiLoading ? <i className="fas fa-spinner fa-spin"></i> : 'CHIEDI'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* AI DRAWER */}
      <div className={`ai-overlay ${isDrawerOpen ? 'active' : ''}`} onClick={() => setIsDrawerOpen(false)}></div>
      <div className={`ai-drawer comic-card !rounded-none border-l-8 ${isDrawerOpen ? 'open' : ''}`}>
        <div className="p-6 sm:p-10 h-full flex flex-col">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#6E4274] border-4 border-[#3D2045] flex items-center justify-center text-white">
                <i className="fas fa-robot text-xl"></i>
              </div>
              <h3 className="text-2xl font-black text-black dark:text-white tracking-tight uppercase">LBS Assistant</h3>
            </div>
            <button onClick={() => setIsDrawerOpen(false)} className="w-10 h-10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors flex items-center justify-center text-slate-400 hover:text-black dark:hover:text-white text-xl border-2 border-transparent hover:border-[#3D2045]">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="flex-grow overflow-y-auto space-y-8 pr-2">
            <div className="comic-card p-8 border-4">
              <p className="text-xs font-black text-[#6E4274] uppercase mb-3 tracking-[0.2em]">La Tua Domanda</p>
              <p className="text-black dark:text-white font-black text-lg leading-snug uppercase">{aiInput}</p>
            </div>
            <div className="px-2">
              <p className="text-xs font-black text-[#6E4274] uppercase mb-5 tracking-[0.2em]">Risposta AI</p>
              <div className="text-black dark:text-white leading-relaxed text-lg font-bold whitespace-pre-wrap">{aiOutput}</div>
            </div>
          </div>
          <div className="pt-10 border-t-4 border-[#3D2045] dark:border-white mt-auto">
            <div className="mb-6 p-4 bg-purple-50 dark:bg-white/5 flex gap-4 items-center border-4 border-[#6E4274]">
              <i className="fas fa-info-circle text-[#6E4274] text-xl"></i>
              <p className="text-xs font-black text-purple-800 dark:text-purple-200 uppercase">Per una consulenza completa, parla direttamente con noi.</p>
            </div>
            <Link to="/contatti" className="comic-button block w-full bg-[#6E4274] text-white text-center py-6 text-lg hover:bg-[#3D2045]">
              PARLA CON NOI ORA
            </Link>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal Popup */}
      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />
    </div>
  );
};

export default Home;
