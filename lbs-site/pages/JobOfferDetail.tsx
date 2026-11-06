import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { supabase } from '../lib/supabaseClient';
import { WhatsAppModal } from '../components/WhatsAppModal';

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
    <div className="min-h-[70vh] flex items-center justify-center pt-24">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-plum-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-plum-600">Caricamento offerta...</p>
      </div>
    </div>
  );

  if (notFound || !offerta) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-5 pt-24 text-center">
      <span className="icon-tile !w-16 !h-16 !rounded-lg"><i className="fas fa-search text-2xl" /></span>
      <h1 className="h-display text-3xl sm:text-4xl text-plum-800">Offerta non trovata</h1>
      <p className="text-ink-soft">Questa offerta potrebbe essere scaduta o non esistere.</p>
      <Link to="/offerte" className="btn btn-lg btn-primary mt-2">
        <i className="fas fa-arrow-left text-xs" /> Vedi tutte le offerte
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

  const facts = [
    { icon: 'fa-map-marker-alt', label: 'Luogo', value: offerta.citta, sub: offerta.stato_germania },
    { icon: 'fa-file-contract', label: 'Contratto', value: offerta.contratto },
    { icon: 'fa-briefcase', label: 'Settore', value: offerta.settore },
  ];

  return (
    <div className="pb-28 lg:pb-20">
      {/* INTESTAZIONE */}
      <section className="surface-tint pt-28 sm:pt-36 pb-10 sm:pb-14">
        <div className="container-x">
          <nav aria-label="Percorso" className="flex items-center gap-2 text-sm text-ink-soft mb-6">
            <Link to="/" className="hover:text-plum-800">Home</Link>
            <i className="fas fa-chevron-right text-[9px] text-plum-300" />
            <Link to="/offerte" className="hover:text-plum-800">Offerte</Link>
            <i className="fas fa-chevron-right text-[9px] text-plum-300" />
            <span className="text-plum-800 font-medium truncate max-w-[220px]">{offerta.titolo}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8">
              <div className="flex flex-wrap gap-2">
                {offerta.in_evidenza && <span className="chip chip-sun"><i className="fas fa-star text-[10px]" /> In evidenza</span>}
                <span className="chip">{offerta.settore}</span>
              </div>
              <h1 className="h-display text-plum-800 text-3xl sm:text-5xl mt-4">{offerta.titolo}</h1>
              {offerta.azienda && <p className="text-plum-600 font-medium text-lg mt-2">{offerta.azienda}</p>}
            </div>
            <div className="lg:col-span-4 flex lg:justify-end">
              <button type="button" onClick={handleShare} className="btn btn-outline">
                <i className={`fas ${copied ? 'fa-check text-emerald-600' : 'fa-share-alt text-plum-400'}`} />
                {copied ? 'Copiato!' : 'Condividi'}
              </button>
            </div>
          </div>

          {offerta.immagine_url && (
            <div className="mt-8 rounded-lg overflow-hidden h-56 sm:h-80 md:h-[26rem] border border-line">
              <img src={offerta.immagine_url} alt={offerta.titolo} className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </section>

      <div className="container-x mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CONTENUTO */}
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {facts.map(f => (
              <div key={f.label} className="card !rounded-lg p-4">
                <i className={`fas ${f.icon} text-plum-400`} />
                <div className="text-xs text-ink-soft mt-2">{f.label}</div>
                <div className="font-semibold text-plum-800 leading-snug">{f.value}</div>
                {f.sub && <div className="text-xs text-plum-600">{f.sub}</div>}
              </div>
            ))}
            {salaryText && (
              <div className="rounded-lg bg-sun-100 border border-sun-300 p-4">
                <i className="fas fa-euro-sign text-plum-800" />
                <div className="text-xs text-plum-800/70 mt-2">Stipendio</div>
                <div className="font-semibold text-plum-800 leading-snug">{salaryText}</div>
              </div>
            )}
          </div>

          <div className="card p-6 sm:p-9">
            <h2 className="font-semibold text-2xl text-plum-800 flex items-center gap-3">
              <span className="icon-tile !w-10 !h-10 !rounded-md"><i className="fas fa-align-left" /></span>
              Descrizione del lavoro
            </h2>
            <div className="mt-6 text-ink leading-relaxed text-[16px]">
              {offerta.descrizione.split('\n').map((line, i) => (
                line.trim() ? <p key={i} className="mb-3">{line}</p> : <div key={i} className="h-2" aria-hidden="true" />
              ))}
            </div>
          </div>

          {requisiti.length > 0 && (
            <div className="card p-6 sm:p-9">
              <h2 className="font-semibold text-2xl text-plum-800 flex items-center gap-3">
                <span className="icon-tile !w-10 !h-10 !rounded-md"><i className="fas fa-list-check" /></span>
                Requisiti
              </h2>
              <ul className="mt-6 space-y-3">
                {requisiti.map((req, i) => (
                  <li key={i} className="flex items-start gap-3 text-ink">
                    <span className="mt-0.5 h-5 w-5 rounded-full bg-plum-600 text-white flex items-center justify-center text-[9px] shrink-0">
                      <i className="fas fa-check" />
                    </span>
                    {req.replace(/^[-•*]\s*/, '')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-28 space-y-4">
            <div className="card p-6 sm:p-7">
              <h3 className="font-semibold text-xl text-plum-800">Ti interessa?</h3>
              <p className="text-sm text-ink-soft mt-1">Candidati in 1 minuto: ti contattiamo entro 24 ore.</p>
              <button type="button" onClick={() => setShowApply(true)} className="btn btn-lg btn-primary w-full mt-5">
                <i className="fas fa-paper-plane" /> Candidati ora
              </button>
              <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-lg btn-wa w-full mt-3">
                <i className="fab fa-whatsapp text-lg" /> WhatsApp
              </button>
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-lg text-plum-800 flex items-center gap-2">
                <i className="fas fa-link text-plum-400 text-base" /> Condividi questo annuncio
              </h3>
              <p className="text-sm text-ink-soft mt-1 mb-4">Invia il link a chi potrebbe essere interessato.</p>
              <button type="button" onClick={handleShare} className="btn btn-outline w-full">
                <i className={`fas ${copied ? 'fa-check text-emerald-600' : 'fa-copy text-plum-400'}`} />
                {copied ? 'Link copiato!' : 'Copia link'}
              </button>
            </div>

            <div className="rounded-xl bg-wa/10 border border-wa/20 p-6">
              <h3 className="font-semibold text-lg text-plum-800 flex items-center gap-2">
                <i className="fab fa-whatsapp text-[#128C4B]" /> Hai domande?
              </h3>
              <p className="text-sm text-ink-soft mt-1 mb-4">Scrivici su WhatsApp — risposta entro 24h.</p>
              <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-wa w-full">
                <i className="fab fa-whatsapp" /> Scrivici
              </button>
            </div>

            <Link to="/offerte" className="btn btn-outline w-full">
              <i className="fas fa-arrow-left text-xs" /> Tutte le offerte
            </Link>
          </div>
        </aside>
      </div>

      {/* BARRA MOBILE */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line px-4 py-3 flex gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={() => setShowApply(true)} className="btn btn-primary flex-1">
          <i className="fas fa-paper-plane" /> Candidati ora
        </button>
        <button type="button" onClick={() => setShowWaModal(true)} aria-label="Scrivici su WhatsApp" className="btn btn-wa !px-4">
          <i className="fab fa-whatsapp text-lg" />
        </button>
      </div>

      {/* Apply Modal */}
      {showApply && (
        <div
          className="fixed inset-0 bg-plum-950/60 backdrop-blur-sm z-[9998] flex items-end sm:items-center justify-center sm:p-6"
          onClick={() => setShowApply(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="apply-title"
        >
          <div
            className="animate-pop-in bg-white w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-xl sm:rounded-xl p-6 sm:p-8 relative shadow-[var(--shadow-lift)]"
            onClick={e => e.stopPropagation()}
          >
            <button type="button" onClick={() => setShowApply(false)} aria-label="Chiudi" className="absolute top-4 right-4 h-11 w-11 rounded-md bg-plum-50 text-plum-800 hover:bg-plum-100 flex items-center justify-center cursor-pointer">
              <i className="fas fa-times" />
            </button>
            {applySent ? (
              <div className="text-center py-8">
                <span className="mx-auto h-16 w-16 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl"><i className="fas fa-check" /></span>
                <h3 className="font-semibold text-2xl text-plum-800 mt-4">Candidatura inviata!</h3>
                <p className="text-ink-soft mt-2 mb-6">Ti contatteremo entro 24 ore.</p>
                <button type="button" onClick={() => { setShowApply(false); setApplySent(false); }} className="btn btn-primary">Chiudi</button>
              </div>
            ) : (
              <>
                <div className="mb-6 pr-12">
                  <span className="chip">Candidatura</span>
                  <h2 id="apply-title" className="font-semibold text-2xl text-plum-800 tracking-tight mt-3">{offerta.titolo}</h2>
                </div>
                <form onSubmit={handleApply} className="space-y-4">
                  <div>
                    <label htmlFor="ap-name" className="field-label">Nome e cognome *</label>
                    <input id="ap-name" value={applyName} onChange={e => setApplyName(e.target.value)} required autoComplete="name" placeholder="Mario Rossi" className="field" />
                  </div>
                  <div>
                    <label htmlFor="ap-email" className="field-label">Email *</label>
                    <input id="ap-email" type="email" value={applyEmail} onChange={e => setApplyEmail(e.target.value)} required autoComplete="email" placeholder="mario@email.com" className="field" />
                  </div>
                  <div>
                    <label htmlFor="ap-tel" className="field-label">Telefono</label>
                    <input id="ap-tel" type="tel" value={applyPhone} onChange={e => setApplyPhone(e.target.value)} autoComplete="tel" placeholder="+39 333 000 0000" className="field" />
                  </div>
                  <div>
                    <label htmlFor="ap-msg" className="field-label">Messaggio</label>
                    <textarea id="ap-msg" value={applyMsg} onChange={e => setApplyMsg(e.target.value)} placeholder="Raccontaci qualcosa di te..." rows={3} className="field !min-h-[96px]" />
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
                      <p role="alert" className="text-red-600 font-medium text-sm text-center">
                        <i className="fas fa-exclamation-triangle mr-1" /> {captchaError}
                      </p>
                    )}
                  </div>

                  <button type="submit" disabled={applyLoading || !captchaToken} className="btn btn-lg btn-primary w-full">
                    {applyLoading ? <><i className="fas fa-spinner fa-spin" /> Invio...</> : <><i className="fas fa-paper-plane" /> Invia candidatura</>}
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
