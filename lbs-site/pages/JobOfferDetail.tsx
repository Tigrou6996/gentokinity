import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from '../lib/supabaseClient';
import { WhatsAppModal } from '../components/WhatsAppModal';
import { CloseButton } from '../components/CloseButton';
import FluidOrb from '../components/ui/fluid-orb';

const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY as string;
// Rate-limit: max 3 candidature per 10 minuti (localStorage)
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
  requisiti: string | null;
  attiva: boolean;
  in_evidenza: boolean;
  slug: string | null;
  immagine_url: string | null;
  created_at: string;
}

const JobOfferDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [offerta, setOfferta] = useState<Offerta | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [applyName, setApplyName] = useState('');
  const [applyEmail, setApplyEmail] = useState('');
  const [applyPhone, setApplyPhone] = useState('');
  const [applyMsg, setApplyMsg] = useState('');
  const [applySent, setApplySent] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  // Anti-spam
  const [honeypot, setHoneypot] = useState('');       // campo trappola per bot
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState('');
  const captchaRef = useRef<HCaptcha>(null);

  useEffect(() => {
    const fetchOfferta = async () => {
      if (!slug) { setNotFound(true); setLoading(false); return; }
      setLoading(true);

      // Prova prima per slug, poi per ID
      let { data, error } = await supabase
        .from('offerte_lavoro')
        .select('*')
        .eq('slug', slug)
        .eq('attiva', true)
        .single();

      if (error || !data) {
        // Fallback: cerca per ID
        const { data: byId } = await supabase
          .from('offerte_lavoro')
          .select('*')
          .eq('id', slug)
          .eq('attiva', true)
          .single();
        data = byId;
      }

      if (!data) {
        setNotFound(true);
      } else {
        setOfferta(data as Offerta);
        // Aggiorna titolo pagina per SEO
        document.title = `${data.titolo} | LBS Lavoro in Germania`;

        // ─── Google for Jobs (Schema.org JobPosting) ──────────────────────────
        try {
          const datePosted = data.created_at ? new Date(data.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          // validThrough è obbligatorio per Google Jobs (calcolato a 90 giorni dalla creazione)
          const validThrough = new Date(new Date(data.created_at || Date.now()).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

          let employmentType = 'FULL_TIME';
          if (data.contratto === 'Tempo Determinato') employmentType = 'TEMPORARY';
          else if (data.contratto === 'Stagionale') employmentType = 'SEASONAL';
          else if (data.contratto === 'Apprendistato') employmentType = 'INTERN';

          const formattedDescription = `
            <p>${(data.descrizione || '').replace(/\n/g, '<br/>')}</p>
            ${data.requisiti ? `<h3>Requisiti:</h3><p>${data.requisiti.replace(/\n/g, '<br/>')}</p>` : ''}
          `.trim();

          const jobPostingSchema: any = {
            '@context': 'https://schema.org',
            '@type': 'JobPosting',
            title: data.titolo,
            description: formattedDescription,
            datePosted,
            validThrough,
            employmentType,
            hiringOrganization: {
              '@type': 'Organization',
              name: data.azienda || 'LBS Lavoro Business e Servizi in Germania',
              sameAs: 'https://www.lbswork.com',
              logo: 'https://www.lbswork.com/img/logo_LBS.png',
            },
            jobLocation: {
              '@type': 'Place',
              address: {
                '@type': 'PostalAddress',
                addressLocality: data.citta || 'Germania',
                addressRegion: data.stato_germania || data.citta || 'Germania',
                addressCountry: 'DE',
              },
            },
            jobBenefits: 'Vitto e alloggio inclusi, contratto regolare a norma di legge tedesca, traduzioni incluse e assistenza continua 24/7',
            directApply: true,
          };

          if (data.stipendio_min || data.stipendio_max) {
            jobPostingSchema.baseSalary = {
              '@type': 'MonetaryAmount',
              currency: 'EUR',
              value: {
                '@type': 'QuantitativeValue',
                unitText: 'MONTH',
                ...(data.stipendio_min && data.stipendio_max
                  ? { minValue: data.stipendio_min, maxValue: data.stipendio_max }
                  : data.stipendio_min
                  ? { value: data.stipendio_min }
                  : { value: data.stipendio_max }),
              },
            };
          }

          let scriptEl = document.getElementById('google-jobposting-schema') as HTMLScriptElement;
          if (!scriptEl) {
            scriptEl = document.createElement('script');
            scriptEl.id = 'google-jobposting-schema';
            scriptEl.type = 'application/ld+json';
            document.head.appendChild(scriptEl);
          }
          scriptEl.text = JSON.stringify(jobPostingSchema);
        } catch (e) {
          console.warn('[Google Jobs] Errore creazione schema:', e);
        }
      }
      setLoading(false);
    };

    fetchOfferta();

    return () => {
      document.title = 'LBS – Lavoro Business in Germania';
      const scriptEl = document.getElementById('google-jobposting-schema');
      if (scriptEl) scriptEl.remove();
    };
  }, [slug]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      window.prompt('Copia questo link:', url);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerta) return;
    setCaptchaError('');

    // 1. Honeypot: se compilato è un bot
    if (honeypot) return;

    // 2. hCaptcha: token obbligatorio
    if (!captchaToken) {
      setCaptchaError('Completa la verifica anti-spam per continuare.');
      return;
    }

    // 3. Rate limiting client-side
    const now = Date.now();
    const raw = localStorage.getItem('lbs_apply_log');
    const log: number[] = raw ? JSON.parse(raw) : [];
    const recent = log.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      setCaptchaError('Hai inviato troppe candidature di recente. Riprova tra qualche minuto.');
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
      return;
    }

    setApplyLoading(true);
    await supabase.from('candidature').insert([{
      nome: applyName.split(' ')[0] || applyName,
      cognome: applyName.split(' ').slice(1).join(' ') || '-',
      email: applyEmail,
      telefono: applyPhone || null,
      settore: offerta.settore,
      messaggio: applyMsg || null,
      offerta_id: offerta.id,
      offerta_titolo: offerta.titolo,
    }]);

    // Registra timestamp nel log locale
    localStorage.setItem('lbs_apply_log', JSON.stringify([...recent, now]));
    captchaRef.current?.resetCaptcha();
    setCaptchaToken(null);
    setApplySent(true);
    setApplyLoading(false);
  };

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="text-center">
        <div className="w-14 h-14 border-4 border-[#6E4274] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-black text-xs tracking-widest uppercase text-[#6E4274]">Caricamento offerta...</p>
      </div>
    </div>
  );

  if (notFound || !offerta) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-6xl">🔍</div>
      <h1 className="text-3xl font-heading font-black uppercase tracking-tight text-black dark:text-white">Offerta non trovata</h1>
      <p className="text-[#6E4274] font-bold">Questa offerta potrebbe essere scaduta o non esistere.</p>
      <Link to="/offerte" className="comic-button bg-[#6E4274] text-white px-8 py-4 border-[#3D2045] text-sm font-black uppercase tracking-widest">
        ← Vedi tutte le offerte
      </Link>
    </div>
  );

  const tipoLabel = offerta.stipendio_tipo === 'netto' ? 'netti' : 'lordi';
  const salaryText = offerta.stipendio_modalita === 'concordare'
    ? 'Stipendio da concordare'
    : offerta.stipendio_modalita === 'a_partire_da' && offerta.stipendio_min
    ? `Da €${offerta.stipendio_min.toLocaleString('it-IT')}/mese ${tipoLabel}`
    : offerta.stipendio_modalita === 'fisso' && offerta.stipendio_min
    ? `€${offerta.stipendio_min.toLocaleString('it-IT')}/mese ${tipoLabel}`
    : offerta.stipendio_min && offerta.stipendio_max
    ? `€${offerta.stipendio_min.toLocaleString('it-IT')} – €${offerta.stipendio_max.toLocaleString('it-IT')}/mese ${tipoLabel}`
    : offerta.stipendio_min
    ? `Da €${offerta.stipendio_min.toLocaleString('it-IT')}/mese ${tipoLabel}`
    : offerta.stipendio_max
    ? `Fino a €${offerta.stipendio_max.toLocaleString('it-IT')}/mese ${tipoLabel}`
    : null;

  const requisiti = offerta.requisiti
    ? offerta.requisiti.split('\n').filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-[var(--bg-color)] pt-20 pb-20">
      {/* Hero immagine */}
      {offerta.immagine_url && (
        <div className="w-full h-64 sm:h-80 md:h-96 overflow-hidden relative">
          <img
            src={offerta.immagine_url}
            alt={offerta.titolo}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#3D2045]/80 via-[#3D2045]/20 to-transparent" />
          {offerta.in_evidenza && (
            <div className="absolute top-6 left-6 bg-yellow-300 text-[#3D2045] px-4 py-2 font-black text-xs uppercase tracking-widest border-4 border-[#3D2045] flex items-center gap-2">
              ⭐ In Evidenza
            </div>
          )}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mt-8 mb-6 text-xs font-black uppercase tracking-widest text-[#6E4274]">
          <Link to="/" className="hover:text-[#3D2045] transition-colors">Home</Link>
          <span className="text-black/30 dark:text-white/30">›</span>
          <Link to="/offerte" className="hover:text-[#3D2045] transition-colors">Offerte</Link>
          <span className="text-black/30 dark:text-white/30">›</span>
          <span className="text-black dark:text-white truncate max-w-[200px]">{offerta.titolo}</span>
        </div>

        {/* Header offerta */}
        <div className="comic-card border-8 border-[#3D2045] p-6 sm:p-10 shadow-[8px_8px_0px_#3D2045] mb-8">
          {!offerta.immagine_url && offerta.in_evidenza && (
            <div className="inline-flex items-center gap-2 bg-yellow-300 text-[#3D2045] px-3 py-1 font-black text-xs uppercase tracking-widest border-2 border-[#3D2045] mb-4">
              ⭐ In Evidenza
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div className="flex-1">
              <span className="inline-block bg-[#6E4274] text-white text-xs font-black uppercase tracking-widest px-3 py-1 border-2 border-[#3D2045] mb-3">
                {offerta.settore}
              </span>
              <h1 className="text-2xl sm:text-4xl font-heading font-black uppercase tracking-tight text-black dark:text-white leading-tight">
                {offerta.titolo}
              </h1>
              {offerta.azienda && (
                <p className="text-[#6E4274] dark:text-[#9B6FA3] font-black text-lg mt-1">{offerta.azienda}</p>
              )}
            </div>

            {/* Azioni */}
            <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
              <button
                onClick={handleShare}
                className="comic-button bg-white dark:bg-[#1a0d20] text-[#3D2045] dark:text-white border-[#3D2045] px-4 py-2.5 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors min-w-[120px] justify-center"
              >
                <i className={`fas ${copied ? 'fa-check text-green-500' : 'fa-share-alt'}`} />
                {copied ? 'Copiato!' : 'Condividi'}
              </button>
            </div>
          </div>

          {/* Info rapide */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-[#6E4274]/10 border-2 border-[#6E4274]/30 p-3 text-center">
              <i className="fas fa-map-marker-alt text-[#6E4274] text-lg mb-1 block" />
              <div className="text-xs font-black uppercase tracking-widest text-black dark:text-white">{offerta.citta}</div>
              {offerta.stato_germania && <div className="text-[10px] text-[#6E4274] font-bold">{offerta.stato_germania}</div>}
            </div>
            <div className="bg-[#6E4274]/10 border-2 border-[#6E4274]/30 p-3 text-center">
              <i className="fas fa-file-contract text-[#6E4274] text-lg mb-1 block" />
              <div className="text-xs font-black uppercase tracking-widest text-black dark:text-white">{offerta.contratto}</div>
              <div className="text-[10px] text-[#6E4274] font-bold">Contratto</div>
            </div>
            <div className="bg-[#6E4274]/10 border-2 border-[#6E4274]/30 p-3 text-center">
              <i className="fas fa-briefcase text-[#6E4274] text-lg mb-1 block" />
              <div className="text-xs font-black uppercase tracking-widest text-black dark:text-white">{offerta.settore}</div>
              <div className="text-[10px] text-[#6E4274] font-bold">Settore</div>
            </div>
            {salaryText && (
              <div className="bg-green-500/10 border-2 border-green-500/30 p-3 text-center">
                <i className="fas fa-euro-sign text-green-600 text-lg mb-1 block" />
                <div className="text-xs font-black uppercase tracking-widest text-black dark:text-white">{salaryText}</div>
                <div className="text-[10px] text-green-600 font-bold">Stipendio</div>
              </div>
            )}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowApply(true)}
              className="comic-button flex-1 bg-[#6E4274] text-white border-[#3D2045] py-4 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#3D2045] transition-colors"
            >
              <i className="fas fa-paper-plane text-lg" /> Candidati Ora
            </button>
            <button
              onClick={() => setShowWaModal(true)}
              className="comic-button bg-[#25D366] text-white border-[#3D2045] px-8 py-4 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:brightness-110 transition-all"
            >
              <i className="fab fa-whatsapp text-lg" /> WhatsApp
            </button>
          </div>
        </div>

        {/* Descrizione */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="comic-card border-4 border-[#3D2045] p-6 sm:p-8 shadow-[4px_4px_0px_#3D2045]">
              <h2 className="text-xl font-heading font-black uppercase tracking-tight text-black dark:text-white mb-4 border-b-4 border-[#6E4274] pb-3">
                <i className="fas fa-align-left text-[#6E4274] mr-2" /> Descrizione del Lavoro
              </h2>
              <div className="prose prose-sm max-w-none">
                {offerta.descrizione.split('\n').map((line, i) => (
                  line ? (
                    <p key={i} className="text-black dark:text-white font-bold text-sm leading-relaxed mb-3">{line}</p>
                  ) : <br key={i} />
                ))}
              </div>
            </div>

            {requisiti.length > 0 && (
              <div className="comic-card border-4 border-[#3D2045] p-6 sm:p-8 shadow-[4px_4px_0px_#3D2045]">
                <h2 className="text-xl font-heading font-black uppercase tracking-tight text-black dark:text-white mb-4 border-b-4 border-[#6E4274] pb-3">
                  <i className="fas fa-list-check text-[#6E4274] mr-2" /> Requisiti
                </h2>
                <ul className="space-y-3">
                  {requisiti.map((req, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-bold text-black dark:text-white">
                      <span className="w-5 h-5 bg-[#6E4274] text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5 border-2 border-[#3D2045]">✓</span>
                      {req.replace(/^[-•*]\s*/, '')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Condividi */}
            <div className="comic-card border-4 border-[#3D2045] p-5 shadow-[4px_4px_0px_#3D2045] text-center">
              <div className="text-2xl mb-2">🔗</div>
              <h3 className="font-heading font-black uppercase text-sm text-black dark:text-white mb-2">Condividi questo annuncio</h3>
              <p className="text-xs font-bold text-black/60 dark:text-white/60 mb-4">Invia il link a chi potrebbe essere interessato</p>
              <button
                onClick={handleShare}
                className="comic-button w-full bg-[#6E4274] text-white border-[#3D2045] py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#3D2045]"
              >
                <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
                {copied ? 'Link copiato!' : 'Copia link'}
              </button>
            </div>

            {/* WhatsApp box */}
            <div className="comic-card border-4 border-[#25D366] p-5 shadow-[4px_4px_0px_#3D2045] text-center bg-green-50 dark:bg-green-950/30">
              <i className="fab fa-whatsapp text-[#25D366] text-3xl mb-2 block" />
              <h3 className="font-heading font-black uppercase text-sm text-black dark:text-white mb-1">Hai domande?</h3>
              <p className="text-xs font-bold text-black/60 dark:text-white/60 mb-4">Scrivici su WhatsApp — risposta entro 24h</p>
              <button
                onClick={() => setShowWaModal(true)}
                className="comic-button w-full bg-[#25D366] text-white border-[#3D2045] py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110"
              >
                <i className="fab fa-whatsapp" /> Scrivici
              </button>
            </div>

            {/* Tutte le offerte */}
            <Link
              to="/offerte"
              className="comic-button block w-full text-center bg-white dark:bg-[#1a0d20] text-[#3D2045] dark:text-white border-[#3D2045] py-3 text-xs font-black uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-white/10"
            >
              ← Tutte le Offerte
            </Link>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      {showApply && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] flex items-center justify-center p-4"
          onClick={() => setShowApply(false)}
        >
          <div
            className="comic-card border-8 border-[#3D2045] bg-[var(--card-bg)] max-w-lg w-full p-6 sm:p-8 relative shadow-[12px_12px_0px_#3D2045] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* FluidOrb decorativa in alto a destra */}
            <div className="pointer-events-none absolute -top-10 -right-10 opacity-20">
              <FluidOrb size={160} color="#6E4274" />
            </div>

            {/* CloseButton animato */}
            <div className="absolute top-4 right-4 z-10">
              <CloseButton onConfirm={() => setShowApply(false)} />
            </div>
            {applySent ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">✅</div>
                <h3 className="font-heading font-black text-2xl uppercase text-black dark:text-white mb-2">Candidatura Inviata!</h3>
                <p className="text-[#6E4274] font-bold text-sm mb-6">Ti contatteremo entro 24 ore.</p>
                <button onClick={() => { setShowApply(false); setApplySent(false); }} className="comic-button bg-[#6E4274] text-white border-[#3D2045] px-8 py-3 text-xs font-black uppercase tracking-widest">Chiudi</button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <span className="inline-block bg-[#6E4274] text-white text-xs font-black uppercase tracking-widest px-3 py-1 border-2 border-[#3D2045] mb-2">Candidatura</span>
                  <h2 className="text-xl font-heading font-black uppercase text-black dark:text-white">{offerta.titolo}</h2>
                </div>
                <form onSubmit={handleApply} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-black dark:text-white mb-1">Nome e Cognome *</label>
                    <input value={applyName} onChange={e => setApplyName(e.target.value)} required placeholder="Mario Rossi"
                      className="w-full border-3 border-[#3D2045] bg-white dark:bg-[#1a0d20] text-black dark:text-white px-4 py-3 font-bold text-sm focus:outline-none focus:border-[#6E4274]" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-black dark:text-white mb-1">Email *</label>
                    <input type="email" value={applyEmail} onChange={e => setApplyEmail(e.target.value)} required placeholder="mario@email.com"
                      className="w-full border-3 border-[#3D2045] bg-white dark:bg-[#1a0d20] text-black dark:text-white px-4 py-3 font-bold text-sm focus:outline-none focus:border-[#6E4274]" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-black dark:text-white mb-1">Telefono</label>
                    <input value={applyPhone} onChange={e => setApplyPhone(e.target.value)} placeholder="+39 333 000 0000"
                      className="w-full border-3 border-[#3D2045] bg-white dark:bg-[#1a0d20] text-black dark:text-white px-4 py-3 font-bold text-sm focus:outline-none focus:border-[#6E4274]" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-black dark:text-white mb-1">Messaggio</label>
                    <textarea value={applyMsg} onChange={e => setApplyMsg(e.target.value)} placeholder="Raccontaci qualcosa di te..." rows={3}
                      className="w-full border-3 border-[#3D2045] bg-white dark:bg-[#1a0d20] text-black dark:text-white px-4 py-3 font-bold text-sm focus:outline-none focus:border-[#6E4274] resize-none" />
                  </div>

                  {/* Honeypot — invisibile agli umani, i bot lo compilano */}
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
                  <div className="flex flex-col items-center gap-2">
                    <HCaptcha
                      ref={captchaRef}
                      sitekey={HCAPTCHA_SITE_KEY}
                      onVerify={(token) => { setCaptchaToken(token); setCaptchaError(''); }}
                      onExpire={() => setCaptchaToken(null)}
                      theme="light"
                    />
                    {captchaError && (
                      <p className="text-red-600 font-bold text-xs text-center">
                        ⚠️ {captchaError}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={applyLoading || !captchaToken}
                    className="comic-button w-full bg-[#6E4274] text-white border-[#3D2045] py-4 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {applyLoading ? <><i className="fas fa-spinner fa-spin" /> Invio...</> : <><i className="fas fa-paper-plane" /> Invia Candidatura</>}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />
    </div>
  );
};

export default JobOfferDetail;
