
import * as React from 'react';
import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { TESTIMONIALS, PROCESS_STEPS, WHY_GERMANY, STATS } from '../constants';
import { getCareerAdvice } from '../geminiService';
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
  'Tempo Indeterminato': '#16A34A',
  'Tempo Determinato': '#EA580C',
  'Stagionale': '#0369A1',
  'Apprendistato': '#6E4274',
};

const QUICK_ROLES = ['Magazziniere', 'Cuoco', 'Edilizia', 'Autista', 'Saldatore'];

const VALUE_CARDS = [
  {
    icon: 'fa-shield-alt',
    title: 'Partenza sicura e diretta',
    text: 'Ti colleghiamo direttamente con aziende serie e verificate in Germania prima ancora di metterti in viaggio.',
    tags: ['Massima sicurezza', 'Affidabile al 100%'],
  },
  {
    icon: 'fa-house-user',
    title: 'Contratto e alloggio inclusi',
    text: "Contratto regolare a tempo indeterminato con camera o alloggio pronto all'arrivo.",
    tags: ['+200 imprese', 'Verificato'],
  },
  {
    icon: 'fa-headset',
    title: 'Assistenza 24/7 e traduzioni',
    text: 'Ti seguiamo lungo tutto il viaggio: medico, apertura conto e documenti sempre inclusi.',
    tags: ['Supporto continuo', 'H24'],
  },
];

const GALLERY = [
  { img: '/img/salvatore_lavoro.jpg', caption: 'Salvatore al lavoro', tag: 'Titolare' },
  { img: '/img/ufficio_social.jpg', caption: 'La nostra pagina ufficiale', tag: 'Social' },
  { img: '/img/ufficio_postazione.jpg', caption: 'Postazione operativa LBS', tag: 'Ufficio' },
  { img: '/img/ufficio_reception.jpg', caption: 'Sala consulenze LBS', tag: 'Consulenza' },
];

const formatStipendio = (o: Offerta) => {
  if (!(o.stipendio_min || o.stipendio_max) || o.stipendio_modalita === 'concordare') return null;
  if (o.stipendio_modalita === 'a_partire_da') return `Da €${(o.stipendio_min || 0).toLocaleString()}`;
  if (o.stipendio_modalita === 'fisso') return `€${(o.stipendio_min || 0).toLocaleString()}`;
  if (o.stipendio_min && o.stipendio_max) return `€${o.stipendio_min.toLocaleString()} – €${o.stipendio_max.toLocaleString()}`;
  if (o.stipendio_min) return `Da €${o.stipendio_min.toLocaleString()}`;
  return `Fino a €${o.stipendio_max!.toLocaleString()}`;
};

type VideoItem = { title: string; text: string; youtubeId?: string; status?: string };

const VIDEO_GROUPS: { key: 'lavoro' | 'aziende'; label: string; icon: string; subtitle: string; cta: { to: string; label: string }; videos: VideoItem[] }[] = [
  {
    key: 'lavoro',
    label: 'Cerchi lavoro?',
    icon: 'fa-user-tie',
    subtitle: 'Guide e spiegazioni per chi vuole lavorare in Germania',
    cta: { to: '/offerte', label: 'Vedi tutte le offerte' },
    videos: [
      {
        title: "Cos'è l'assistenza 24/7 di LBS in Germania",
        text: 'Alloggio garantito, contratto tedesco regolare, documenti, apertura conto e assistenza giorno e notte. Salvatore Cucuzza ti spiega punto per punto come funziona.',
        youtubeId: 'x3VZojZ8xk8',
      },
      {
        title: 'Dalla valigia al primo giorno di lavoro',
        text: "Guida passo dopo passo: come organizzare la partenza, cosa portare, l'accoglienza nell'alloggio e il primo incontro con il datore di lavoro.",
        status: 'In fase di montaggio',
      },
    ],
  },
  {
    key: 'aziende',
    label: 'Cerchi personale?',
    icon: 'fa-building',
    subtitle: 'Servizio dedicato a ristoranti, hotel, imprese edili e magazzini in Germania',
    cta: { to: '/datori-di-lavoro', label: 'Info per datori di lavoro' },
    videos: [
      {
        title: 'Come selezioniamo e verifichiamo i profili',
        text: "Screening rigoroso dei candidati, colloqui tecnici e verifica reale delle referenze prima dell'inserimento nella tua azienda in Germania.",
        status: 'In fase di ripresa',
      },
      {
        title: 'Perché il servizio è 100% gratuito per i datori',
        text: 'Zero commissioni e zero costi nascosti per le aziende partner: modello trasparente e assistenza burocratica continua per i dipendenti.',
        status: 'In fase di ripresa',
      },
    ],
  },
];

const SectionHeader: React.FC<{ eyebrow: string; title: React.ReactNode; lead?: string; light?: boolean; children?: React.ReactNode }> = ({ eyebrow, title, lead, light, children }) => (
  <div className="reveal flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 md:mb-16">
    <div className="max-w-2xl">
      <span className={`eyebrow ${light ? 'eyebrow-light' : ''}`}>{eyebrow}</span>
      <h2 className={`h-section mt-4 ${light ? 'text-white' : 'text-plum-800'}`}>{title}</h2>
      {lead && <p className={`lead mt-4 ${light ? '!text-white/65' : ''}`}>{lead}</p>}
    </div>
    {children}
  </div>
);

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
  const [videoTab, setVideoTab] = useState<'lavoro' | 'aziende'>('lavoro');
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

  const scrollCarousel = (dir: 1 | -1) => {
    if (carouselRef.current) {
      const card = carouselRef.current.firstElementChild as HTMLElement;
      const cardWidth = card ? card.offsetWidth + 24 : 380;
      carouselRef.current.scrollBy({ left: dir * cardWidth, behavior: 'smooth' });
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

  // Link esterni a /#candidatura: porta al modulo dopo il render
  useEffect(() => {
    if (window.location.hash !== '#candidatura') return;
    const t = setTimeout(() => document.getElementById('candidatura')?.scrollIntoView({ behavior: 'smooth' }), 350);
    return () => clearTimeout(t);
  }, []);

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

  const activeVideos = VIDEO_GROUPS.find(g => g.key === videoTab)!;

  return (
    <div className="flex flex-col relative overflow-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="surface-plum pt-32 sm:pt-40 pb-16 sm:pb-20">
        <div className="container-x grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-end">

          <div className="lg:col-span-7">
            <span className="eyebrow eyebrow-light">Agenzia per italiani in Germania · 11 anni di esperienza</span>

            <h1 className="h-display text-white text-[2.5rem] sm:text-6xl lg:text-[4.25rem] mt-6">
              Lavoro in Germania, con casa e assistenza <span className="text-sun-400 whitespace-nowrap">24/7.</span>
            </h1>

            <p className="text-white/70 text-lg leading-relaxed max-w-xl mt-6">
              Trasformiamo la tua voglia di riscatto in un contratto di lavoro reale, alloggio sicuro e supporto continuo.
              Assistenza continua, traduzioni e alloggio garantito.
            </p>

            {/* RICERCA */}
            <form onSubmit={handleSearchSubmit} role="search" className="mt-9 max-w-2xl grid grid-cols-1 sm:grid-cols-[1fr_12rem_auto] gap-2">
              <label className="relative">
                <span className="sr-only">Ruolo</span>
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-plum-400 text-sm" />
                <input
                  type="text"
                  value={searchRuolo}
                  onChange={e => setSearchRuolo(e.target.value)}
                  placeholder="Ruolo (es. Cuoco, Operaio)"
                  className="field !border-transparent !pl-11 !min-h-[50px]"
                />
              </label>
              <label className="relative">
                <span className="sr-only">Città</span>
                <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-plum-400 text-sm" />
                <input
                  type="text"
                  value={searchCitta}
                  onChange={e => setSearchCitta(e.target.value)}
                  placeholder="Città"
                  className="field !border-transparent !pl-11 !min-h-[50px]"
                />
              </label>
              <button type="submit" className="btn btn-lg btn-accent">
                Cerca lavoro <i className="fas fa-arrow-right text-xs" />
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2 mt-5">
              <span className="text-white/50 text-sm mr-1">Ricerche rapide:</span>
              {QUICK_ROLES.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSearchRuolo(role)}
                  aria-pressed={searchRuolo === role}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors cursor-pointer ${
                    searchRuolo === role ? 'bg-sun-400 text-plum-800 border-sun-400' : 'text-white/75 border-white/20 hover:border-white/60 hover:text-white'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* FOTO */}
          <figure className="lg:col-span-5 max-w-md mx-auto lg:max-w-none w-full">
            <img
              src="/img/salvatore_hero.jpg"
              alt="Salvatore Cucuzza — Titolare LBS"
              className="w-full aspect-[4/5] object-cover rounded-lg"
              fetchPriority="high"
            />
            <figcaption className="mt-4 flex items-center justify-between gap-4 border-t border-white/15 pt-4">
              <span>
                <span className="block text-white font-medium">Salvatore Cucuzza</span>
                <span className="block text-white/55 text-sm">Titolare LBS · ti segue di persona</span>
              </span>
              <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-sm btn-ghost-light shrink-0">
                <i className="fab fa-whatsapp" /> WhatsApp h24
              </button>
            </figcaption>
          </figure>
        </div>

        {/* NUMERI */}
        <div className="container-x mt-16 sm:mt-20">
          <dl className="grid-lines-dark grid-cols-2 md:grid-cols-4">
            {STATS.map(s => (
              <div key={s.label} className="p-6 sm:p-7 flex flex-col-reverse">
                <dt className="text-sm text-white/55">{s.label}</dt>
                <dd className="font-semibold text-4xl sm:text-5xl text-white tracking-tight mt-1">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── 3 VANTAGGI ───────────────────────────────────────────────────── */}
      <section className="border-b border-line">
        <div className="container-x py-16 md:py-20">
          <div className="grid-lines grid-cols-1 md:grid-cols-3">
            {VALUE_CARDS.map((c, i) => (
              <div key={c.title} className="p-7 sm:p-9 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <span className="icon-tile"><i className={`fas ${c.icon}`} /></span>
                  <span className="text-sm font-medium text-plum-300 tabular-nums">0{i + 1}</span>
                </div>
                <h3 className="font-semibold text-xl text-plum-800 tracking-tight">{c.title}</h3>
                <p className="text-ink-soft leading-relaxed mt-3 flex-1">{c.text}</p>
                <div className="flex flex-wrap gap-2 mt-6">
                  <span className="chip"><i className="fas fa-check text-[10px]" /> {c.tags[0]}</span>
                  <span className="chip">{c.tags[1]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COME FUNZIONA ────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container-x">
          <SectionHeader
            eyebrow="Come funziona"
            title={<>4 passi verso <span className="mark">la Germania</span></>}
            lead="Un percorso chiaro e testato per trovare il tuo lavoro ideale, senza sorprese e con tutto il supporto necessario."
          >
            <Link to="/servizi" className="btn btn-outline self-start md:self-auto">
              Tutti i servizi <i className="fas fa-arrow-right text-xs" />
            </Link>
          </SectionHeader>

          <ol className="grid-lines grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((step, i) => (
              <li key={step.step} className="reveal p-7 sm:p-8" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-plum-600 tabular-nums">{step.step}</span>
                  <i className={`fas ${step.icon} text-plum-300`} />
                </div>
                <div className="h-px bg-line my-6" />
                <h3 className="font-semibold text-lg text-plum-800 tracking-tight">{step.title}</h3>
                <p className="text-ink-soft leading-relaxed mt-2 text-[15px]">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── OFFERTE IN PRIMO PIANO ───────────────────────────────────────── */}
      <section className="pb-20 md:pb-28">
        <div className="container-x">
          <SectionHeader eyebrow="Offerte in primo piano" title="Lavori disponibili ora">
            <div className="flex items-center gap-2 self-start md:self-auto">
              {offerte.length > 3 && (
                <>
                  <button type="button" onClick={() => scrollCarousel(-1)} aria-label="Precedente" className="h-11 w-11 rounded-md border border-line bg-white text-plum-800 hover:border-plum-800 flex items-center justify-center cursor-pointer transition-colors">
                    <i className="fas fa-arrow-left text-sm" />
                  </button>
                  <button type="button" onClick={() => scrollCarousel(1)} aria-label="Successivo" className="h-11 w-11 rounded-md border border-line bg-white text-plum-800 hover:border-plum-800 flex items-center justify-center cursor-pointer transition-colors">
                    <i className="fas fa-arrow-right text-sm" />
                  </button>
                </>
              )}
              <Link to="/offerte" className="btn btn-primary">
                Vedi tutte ({offerte.length}) <i className="fas fa-arrow-right text-xs" />
              </Link>
            </div>
          </SectionHeader>
        </div>

        {offerte.length > 0 ? (
          <div
            ref={carouselRef}
            className={`hide-scrollbar flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 pt-1 carousel-pad ${offerte.length <= 3 ? 'lg:justify-center' : ''}`}
          >
            {offerte.map(o => {
              const stipendio = formatStipendio(o);
              const color = CONTRATTO_COLORS[o.contratto] ?? '#6E4274';
              return (
                <Link
                  key={o.id}
                  to={`/offerte/${o.slug || o.id}`}
                  className="snap-start shrink-0 w-[300px] sm:w-[360px] lg:w-[370px] group card card-hover overflow-hidden flex flex-col"
                >
                  <div className="relative h-44 bg-plum-50 overflow-hidden border-b border-line">
                    {o.immagine_url ? (
                      <img src={o.immagine_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className={`fas ${SETTORE_ICONS[o.settore] ?? 'fa-briefcase'} text-4xl text-plum-200`} />
                      </div>
                    )}
                    {o.in_evidenza && (
                      <span className="absolute top-3 left-3 chip chip-sun"><i className="fas fa-star text-[10px]" /> In evidenza</span>
                    )}
                  </div>

                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-ink-soft truncate">{o.settore}</span>
                      <span className="font-medium shrink-0" style={{ color }}>{o.contratto}</span>
                    </div>
                    <h3 className="font-semibold text-lg text-plum-800 tracking-tight leading-snug mt-2 line-clamp-2">{o.titolo}</h3>
                    {o.azienda && <p className="text-sm text-plum-600 mt-1">{o.azienda}</p>}
                    <p className="flex items-center gap-2 text-sm text-ink-soft mt-3">
                      <i className="fas fa-map-marker-alt text-plum-300 text-xs" />
                      {o.citta}{o.stato_germania ? `, ${o.stato_germania}` : ''}
                    </p>
                    <p className="text-[15px] text-ink-soft leading-relaxed line-clamp-2 mt-3 flex-1">{o.descrizione}</p>

                    <div className="flex items-center justify-between pt-5 mt-5 border-t border-line">
                      {stipendio ? (
                        <div>
                          <div className="font-semibold text-plum-800">{stipendio}</div>
                          <div className="text-xs text-ink-soft">al mese, {o.stipendio_tipo === 'netto' ? 'netti' : 'lordi'}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-ink-soft">Stipendio da concordare</span>
                      )}
                      <span className="text-sm font-medium text-plum-600 flex items-center gap-1.5 group-hover:gap-2.5 transition-all" aria-hidden="true">
                        Dettagli <i className="fas fa-arrow-right text-xs" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="container-x">
            <div className="card p-10 text-center">
              <i className="fas fa-briefcase text-3xl text-plum-200" />
              <p className="text-ink-soft mt-3">Nessuna offerta disponibile al momento.</p>
            </div>
          </div>
        )}
      </section>

      {/* ── PERCHÉ LA GERMANIA ───────────────────────────────────────────── */}
      <section className="section surface-tint !border-y">
        <div className="container-x">
          <SectionHeader
            eyebrow="Perché scegliere la Germania"
            title={<>Non è solo un lavoro, è <span className="mark">un nuovo futuro.</span></>}
            lead="Scopri i vantaggi di costruire la tua carriera in uno dei paesi più forti d'Europa."
          />
          <div className="grid-lines grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_GERMANY.map((item, i) => (
              <div key={item.title} className="reveal p-7 sm:p-9" style={{ transitionDelay: `${i * 50}ms` }}>
                <span className="icon-tile"><i className={`fas ${item.icon}`} /></span>
                <h3 className="font-semibold text-lg text-plum-800 tracking-tight mt-7">{item.title}</h3>
                <p className="text-ink-soft leading-relaxed mt-2 text-[15px]">{item.description}</p>
              </div>
            ))}
            <Link to="/contatti" className="group p-7 sm:p-9 flex flex-col justify-between !bg-plum-800 text-white">
              <span className="text-sm text-white/60">Hai domande?</span>
              <span className="mt-10">
                <span className="block font-semibold text-lg tracking-tight">Parla con un consulente</span>
                <span className="mt-2 inline-flex items-center gap-2 text-sm text-sun-400">
                  Consulenza gratuita <i className="fas fa-arrow-right text-xs group-hover:translate-x-1 transition-transform" />
                </span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── VIDEO ────────────────────────────────────────────────────────── */}
      <section className="section surface-plum">
        <div className="container-x">
          <SectionHeader
            light
            eyebrow="Video ufficiali LBS"
            title="Guarda come lavoriamo."
            lead="Video e spiegazioni dirette: dall'assistenza sul campo per chi parte, alla selezione del personale per le aziende."
          />

          <div className="reveal flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div role="tablist" aria-label="Scegli i video" className="flex gap-6 border-b border-white/15 self-start">
              {VIDEO_GROUPS.map(g => (
                <button
                  key={g.key}
                  type="button"
                  role="tab"
                  aria-selected={videoTab === g.key}
                  onClick={() => setVideoTab(g.key)}
                  className={`relative -mb-px inline-flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${ videoTab === g.key ? 'text-white border-sun-400' : 'text-white/60 border-transparent hover:text-white' }`}
                >
                  <i className={`fas ${g.icon}`} /> {g.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <p className="hidden md:block text-sm text-white/55 max-w-xs text-right">{activeVideos.subtitle}</p>
              <Link to={activeVideos.cta.to} className="btn btn-sm btn-ghost-light self-start">
                {activeVideos.cta.label} <i className="fas fa-arrow-right text-[11px]" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" role="tabpanel">
            {activeVideos.videos.map(v => (
              <article key={v.title} className="card-dark p-4 sm:p-5 flex flex-col">
                {v.youtubeId ? (
                  <div className="aspect-video rounded-lg overflow-hidden bg-black">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}`}
                      title={v.title}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="aspect-video rounded-lg border border-dashed border-white/20  flex flex-col items-center justify-center text-center p-6">
                    <span className="h-14 w-14 rounded-md border border-white/20 flex items-center justify-center text-sun-400 text-lg">
                      <i className="fas fa-film" />
                    </span>
                    <span className="chip chip-sun mt-4">Prossimamente</span>
                    <span className="text-white/55 text-sm mt-2">{v.status}</span>
                  </div>
                )}
                <div className="px-1 sm:px-2 pt-5 pb-2 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {v.youtubeId ? (
                      <span className="chip !bg-emerald-400/15 !text-emerald-300 !border-emerald-400/20"><i className="fas fa-circle-play text-[10px]" /> Disponibile</span>
                    ) : (
                      <span className="chip chip-dark">In arrivo</span>
                    )}
                    {v.youtubeId && (
                      <a href={`https://www.youtube.com/watch?v=${v.youtubeId}`} target="_blank" rel="noopener noreferrer" className="text-sm text-white/55 hover:text-sun-400 flex items-center gap-1.5">
                        Apri su YouTube <i className="fas fa-external-link-alt text-[10px]" />
                      </a>
                    )}
                  </div>
                  <h3 className="font-semibold text-xl sm:text-2xl text-white tracking-tight leading-snug">{v.title}</h3>
                  <p className="text-white/60 leading-relaxed mt-2">{v.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERIA ─────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container-x">
          <SectionHeader eyebrow="Le nostre storie" title={<>Persone reali. <span className="mark">Risultati concreti.</span></>}>
            <Link to="/chi-siamo" className="btn btn-outline self-start md:self-auto">
              Chi siamo <i className="fas fa-arrow-right text-xs" />
            </Link>
          </SectionHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-4 md:h-[560px]">
            {GALLERY.map((item, i) => (
              <figure
                key={item.img}
                className={`reveal relative group overflow-hidden rounded-xl ${ i === 0 ? 'col-span-2 row-span-2 aspect-square md:aspect-auto' : i === 3 ? 'col-span-2 aspect-[2/1] md:aspect-auto' : 'aspect-square md:aspect-auto' }`}
              >
                <img src={item.img} alt={item.caption} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <figcaption className="absolute inset-x-0 bottom-0 p-4 sm:p-6 bg-gradient-to-t from-plum-950/80 via-plum-950/20 to-transparent">
                  <span className="chip chip-sun !text-[11px]">{item.tag}</span>
                  <span className="block text-white font-semibold text-base sm:text-lg mt-2">{item.caption}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIANZE ────────────────────────────────────────────────── */}
      <section className="section border-t border-line">
        <div className="container-x">
          <SectionHeader eyebrow="Testimonianze" title={<>Chi ce l'ha fatta. <span className="mark">Come te.</span></>} />
          <div className="grid-lines grid-cols-1 md:grid-cols-3">
            {TESTIMONIALS.map(t => (
              <figure key={t.id} className="reveal p-7 sm:p-9 flex flex-col">
                <div className="flex gap-1 text-sun-500 text-xs" aria-label="5 stelle su 5">
                  {[...Array(5)].map((_, i) => <i key={i} className="fas fa-star" />)}
                </div>
                <blockquote className="text-ink text-lg leading-relaxed mt-5 flex-1">“{t.content}”</blockquote>
                <figcaption className="flex items-center gap-3 mt-8 pt-6 border-t border-line">
                  <span className="h-10 w-10 rounded-md border border-line text-plum-700 font-semibold flex items-center justify-center">{t.initial}</span>
                  <span>
                    <span className="block font-medium text-plum-800">{t.name}</span>
                    <span className="block text-sm text-ink-soft">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM CANDIDATURA ─────────────────────────────────────────────── */}
      <section id="candidatura" className="pb-20 md:pb-28">
        <div className="container-x grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-5 reveal">
            <span className="eyebrow">Invia la tua candidatura</span>
            <h2 className="h-section text-plum-800 mt-4">Inizia il tuo percorso <span className="mark">oggi</span></h2>
            <p className="lead mt-4">
              Compila il modulo: ti ricontatteremo entro 24 ore. Inizia subito a costruire il tuo futuro in Germania con il nostro supporto completo.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                { icon: 'fa-clock', t: 'Risposta entro 24 ore', d: 'Un consulente ti richiama per una prima chiacchierata.' },
                { icon: 'fa-euro-sign', t: 'Nessun anticipo, mai', d: 'Consulenza e ricerca lavoro senza costi prima della partenza.' },
                { icon: 'fa-lock', t: 'I tuoi dati sono al sicuro', d: 'Nessuno spam, nessuna cessione a terzi.' },
              ].map(b => (
                <li key={b.t} className="flex gap-4">
                  <span className="icon-tile !w-11 !h-11"><i className={`fas ${b.icon}`} /></span>
                  <span>
                    <span className="block font-semibold text-plum-800">{b.t}</span>
                    <span className="block text-sm text-ink-soft mt-0.5">{b.d}</span>
                  </span>
                </li>
              ))}
            </ul>

            {/* Sei un datore di lavoro? */}
            <div className="mt-10 rounded-xl surface-plum p-6 flex flex-col sm:flex-row lg:flex-col sm:items-center lg:items-start gap-4 overflow-hidden">
              <span className="icon-tile !bg-sun-400 !text-plum-800"><i className="fas fa-building" /></span>
              <div className="flex-1">
                <div className="font-semibold text-lg">Sei un datore di lavoro?</div>
                <div className="text-white/65 text-sm">Stai cercando lavoratori qualificati? Abbiamo quello che ti serve.</div>
              </div>
              <Link to="/datori-di-lavoro" className="btn btn-sm btn-accent self-start sm:self-auto">
                Scopri come <i className="fas fa-arrow-right text-[11px]" />
              </Link>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="lg:col-span-7 reveal card p-6 sm:p-10 relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="c-nome" className="field-label">Nome *</label>
                <input id="c-nome" type="text" name="nome" required autoComplete="given-name" value={form.nome} onChange={handleFormChange} placeholder="Il tuo nome" className="field" />
              </div>
              <div>
                <label htmlFor="c-cognome" className="field-label">Cognome *</label>
                <input id="c-cognome" type="text" name="cognome" required autoComplete="family-name" value={form.cognome} onChange={handleFormChange} placeholder="Il tuo cognome" className="field" />
              </div>
              <div>
                <label htmlFor="c-email" className="field-label">Email *</label>
                <input id="c-email" type="email" name="email" required autoComplete="email" value={form.email} onChange={handleFormChange} placeholder="tua@email.it" className="field" />
              </div>
              <div>
                <label htmlFor="c-tel" className="field-label">Telefono *</label>
                <input id="c-tel" type="tel" name="telefono" required autoComplete="tel" value={form.telefono} onChange={handleFormChange} placeholder="+39 000 0000000" className="field" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="c-settore" className="field-label">Settore lavorativo *</label>
                <select id="c-settore" name="settore" required value={form.settore} onChange={handleFormChange} className="field">
                  <option value="">Seleziona il tuo settore</option>
                  {SETTORI.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="c-msg" className="field-label">Raccontaci di te</label>
                <textarea
                  id="c-msg"
                  name="messaggio"
                  value={form.messaggio}
                  onChange={handleFormChange}
                  rows={4}
                  placeholder="Descrivici la tua esperienza, le tue aspettative e qualsiasi cosa vuoi dirci..."
                  className="field"
                />
              </div>
            </div>

            {formError && (
              <div role="alert" className="mt-5 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-3">
                <i className="fas fa-exclamation-triangle" />
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
            <div className="flex justify-center mt-6">
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
              className="btn btn-lg btn-primary w-full mt-6"
            >
              {formLoading
                ? <><i className="fas fa-spinner fa-spin" /> Invio in corso...</>
                : <><i className="fas fa-paper-plane" /> Invia la tua candidatura</>}
            </button>
            <p className="text-center text-xs text-ink-soft mt-4">
              <i className="fas fa-lock mr-1 text-plum-300" /> I tuoi dati sono al sicuro. Nessuno spam.
            </p>
          </form>
        </div>

        {/* Popup di successo */}
        {formSent && (
          <div
            className="fixed inset-0 z-[999] bg-plum-950/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setFormSent(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="animate-pop-in w-full max-w-md bg-white rounded-xl p-8 sm:p-10 text-center shadow-[var(--shadow-lift)]" onClick={e => e.stopPropagation()}>
              <span className="mx-auto h-20 w-20 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl">
                <i className="fas fa-check" />
              </span>
              <h3 className="h-display text-3xl text-plum-800 mt-6">Candidatura ricevuta!</h3>
              <p className="text-ink-soft mt-3 leading-relaxed">
                Ti ricontatteremo entro <strong className="text-plum-600">24 ore</strong>.<br />Nel dubbio, scrivici direttamente su WhatsApp!
              </p>
              <div className="flex flex-col gap-3 mt-8">
                <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-lg btn-wa w-full">
                  <i className="fab fa-whatsapp text-xl" /> Scrivici su WhatsApp
                </button>
                <button type="button" onClick={() => setFormSent(false)} className="btn btn-outline w-full">
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── ASSISTENTE AI ────────────────────────────────────────────────── */}
      <section className="pb-24 md:pb-32">
        <div className="container-x">
          <div className="reveal card p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
            <div className="lg:col-span-5 flex items-start gap-4">
              <span className="icon-tile !w-14 !h-14 !rounded-lg !bg-plum-600 !text-white"><i className="fas fa-robot text-xl" /></span>
              <div>
                <span className="eyebrow">Supporto AI</span>
                <h2 className="font-semibold text-2xl sm:text-3xl text-plum-800 tracking-tight mt-2">
                  Hai dubbi? Chiedi alla nostra AI
                </h2>
              </div>
            </div>
            <form onSubmit={handleAiAsk} className="lg:col-span-7 flex flex-col sm:flex-row gap-3">
              <label className="flex-1">
                <span className="sr-only">La tua domanda</span>
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Es: Di quali documenti ho bisogno?"
                  className="field !rounded-md !px-6 !min-h-[52px]"
                />
              </label>
              <button type="submit" disabled={isAiLoading} className="btn btn-lg btn-primary">
                {isAiLoading ? <i className="fas fa-spinner fa-spin" /> : <>Chiedi <i className="fas fa-arrow-right text-xs" /></>}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* AI DRAWER */}
      <div className={`ai-overlay ${isDrawerOpen ? 'active' : ''}`} onClick={() => setIsDrawerOpen(false)} />
      <aside className={`ai-drawer ${isDrawerOpen ? 'open' : ''}`} aria-hidden={!isDrawerOpen} aria-label="Risposta dell'assistente">
        <div className="p-6 sm:p-8 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <span className="icon-tile !bg-plum-600 !text-white"><i className="fas fa-robot" /></span>
              <h3 className="font-semibold text-xl text-plum-800">LBS Assistant</h3>
            </div>
            <button type="button" onClick={() => setIsDrawerOpen(false)} aria-label="Chiudi" className="h-11 w-11 rounded-md bg-plum-50 text-plum-800 hover:bg-plum-100 flex items-center justify-center cursor-pointer">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="flex-grow overflow-y-auto space-y-6 pr-1">
            <div className="rounded-lg bg-plum-50 p-5">
              <p className="text-xs font-semibold text-plum-600 uppercase tracking-[0.14em] mb-2">La tua domanda</p>
              <p className="text-plum-800 font-semibold text-lg leading-snug">{aiInput}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-plum-600 uppercase tracking-[0.14em] mb-3">Risposta AI</p>
              <div className="text-ink leading-relaxed whitespace-pre-wrap">{aiOutput}</div>
            </div>
          </div>
          <div className="pt-6 border-t border-line mt-auto">
            <p className="text-sm text-ink-soft mb-4 flex gap-2">
              <i className="fas fa-info-circle text-plum-400 mt-0.5" />
              Per una consulenza completa, parla direttamente con noi.
            </p>
            <Link to="/contatti" className="btn btn-lg btn-primary w-full">
              Parla con noi ora
            </Link>
          </div>
        </div>
      </aside>

      {/* WhatsApp Modal Popup */}
      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />
    </div>
  );
};

export default Home;
