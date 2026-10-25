
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { WhatsAppModal } from '../components/WhatsAppModal';

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

const SETTORI_FILTRO = ['Tutti', 'Edilizia e Costruzioni', 'Ristorazione e Cucina', 'Sanitario e Assistenza', 'Meccanica e Industria', 'Logistica e Magazzino', 'Agricoltura', 'Pulizie e Facilities', 'Trasporti e Autotrasporto', 'IT e Tecnologia', 'Altro'];

const CONTRATTO_COLORS: Record<string, string> = {
  'Tempo Indeterminato': '#16A34A',
  'Tempo Determinato': '#EA580C',
  'Stagionale': '#0369A1',
  'Apprendistato': '#6E4274',
};

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

const LIVELLI_LINGUA = ['Nessuno', 'Base (A1-A2)', 'Intermedio (B1-B2)', 'Avanzato (C1-C2)'];

const JobOffers: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryRuolo = searchParams.get('ruolo') || '';
  const queryCitta = searchParams.get('citta') || '';

  const [inputRuolo, setInputRuolo] = useState(queryRuolo);
  const [inputCitta, setInputCitta] = useState(queryCitta);

  const [offerte, setOfferte] = useState<Offerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroSettore, setFiltroSettore] = useState('Tutti');
  const [selected, setSelected] = useState<Offerta | null>(null);

  // Sync inputs with URL params
  useEffect(() => {
    setInputRuolo(queryRuolo);
    setInputCitta(queryCitta);
  }, [queryRuolo, queryCitta]);

  const handlePageSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (inputRuolo.trim()) params.set('ruolo', inputRuolo.trim());
    if (inputCitta.trim()) params.set('citta', inputCitta.trim());
    setSearchParams(params);
  };

  const clearSearch = () => {
    setInputRuolo('');
    setInputCitta('');
    setSearchParams(new URLSearchParams());
  };

  const [showWaModal, setShowWaModal] = useState(false);

  // Apply modal state
  const [showApply, setShowApply] = useState(false);
  const [applyPhone, setApplyPhone] = useState('');
  const [applyNote, setApplyNote] = useState('');
  const [applyDataNascita, setApplyDataNascita] = useState('');
  const [applyCittadinanza, setApplyCittadinanza] = useState('');
  const [applyPaese, setApplyPaese] = useState('Italia');
  const [applyTedesco, setApplyTedesco] = useState('Nessuno');
  const [applyInglese, setApplyInglese] = useState('Nessuno');
  const [applyEsperienza, setApplyEsperienza] = useState('0-1 anni');
  const [applyPatente, setApplyPatente] = useState('Nessuna');
  const [applyDisponibilita, setApplyDisponibilita] = useState('Da concordare');
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const openApply = () => {
    if (!user) { navigate('/login'); return; }
    setApplyPhone(''); setApplyNote(''); setApplyDataNascita('');
    setApplyCittadinanza(''); setApplyPaese('Italia');
    setApplyTedesco('Nessuno'); setApplyInglese('Nessuno');
    setApplyEsperienza('0-1 anni'); setApplyPatente('Nessuna');
    setApplyDisponibilita('Da concordare');
    setApplyDone(false); setApplyError(null);
    setShowApply(true);
  };

  const submitApply = async () => {
    if (!user || !selected) return;
    if (!applyPhone || !applyCittadinanza || !applyDataNascita || !applyNote) {
      setApplyError('Compila tutti i campi obbligatori (*).');
      return;
    }
    setApplyLoading(true);
    setApplyError(null);
    const nome = (profile?.full_name || user.email || '').split(' ')[0] || '';
    const cognome = (profile?.full_name || '').split(' ').slice(1).join(' ') || '';
    const { error } = await supabase.from('candidature').insert([{
      nome, cognome,
      email: user.email,
      telefono: applyPhone,
      settore: selected.settore,
      messaggio: applyNote,
      user_id: user.id,
      offerta_id: selected.id,
      offerta_titolo: selected.titolo,
      data_nascita: applyDataNascita || null,
      cittadinanza: applyCittadinanza,
      paese_residenza: applyPaese,
      livello_tedesco: applyTedesco,
      livello_inglese: applyInglese,
      anni_esperienza: applyEsperienza,
      patente: applyPatente,
      disponibilita: applyDisponibilita,
    }]);
    setApplyLoading(false);
    if (error) setApplyError('Errore durante l\'invio. Riprova.');
    else setApplyDone(true);
  };

  useEffect(() => {
    fetchOfferte();
  }, []);

  // Chiudi la scheda con Esc
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const fetchOfferte = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('offerte_lavoro')
      .select('id, titolo, azienda, citta, stato_germania, settore, contratto, stipendio_min, stipendio_max, stipendio_tipo, stipendio_modalita, descrizione, requisiti, attiva, in_evidenza, slug, immagine_url, created_at')
      .eq('attiva', true)
      .order('in_evidenza', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback se le colonne in_evidenza o slug non esistono ancora su Supabase
      const { data: fallbackData } = await supabase
        .from('offerte_lavoro')
        .select('*')
        .eq('attiva', true)
        .order('created_at', { ascending: false });
      if (fallbackData) setOfferte(fallbackData as Offerta[]);
    } else if (data) {
      setOfferte(data as Offerta[]);
    }
    setLoading(false);
  };

  const hasActiveSearch = Boolean(queryRuolo.trim() || queryCitta.trim());

  // Filter logic
  const offerteEsatte = offerte.filter(o => {
    // Sector filter
    if (filtroSettore !== 'Tutti' && o.settore !== filtroSettore) return false;
    // Ruolo filter
    if (queryRuolo.trim()) {
      const term = queryRuolo.trim().toLowerCase();
      const matchTitolo = o.titolo?.toLowerCase().includes(term);
      const matchSettore = o.settore?.toLowerCase().includes(term);
      const matchDesc = o.descrizione?.toLowerCase().includes(term);
      if (!matchTitolo && !matchSettore && !matchDesc) return false;
    }
    // Citta filter
    if (queryCitta.trim()) {
      const term = queryCitta.trim().toLowerCase();
      const matchCitta = o.citta?.toLowerCase().includes(term);
      const matchStato = o.stato_germania?.toLowerCase().includes(term);
      if (!matchCitta && !matchStato) return false;
    }
    return true;
  });

  // Determine if we are showing fallback similar offers
  const isFallback = hasActiveSearch && offerteEsatte.length === 0;

  // Final list of displayed offers
  const displayedOfferte = isFallback
    ? (filtroSettore === 'Tutti' ? offerte : offerte.filter(o => o.settore === filtroSettore))
    : offerteEsatte;

  const formatStipendio = (offerta: Offerta) => {
    const { stipendio_min: min, stipendio_max: max, stipendio_tipo: tipo, stipendio_modalita: modalita } = offerta;
    if (modalita === 'concordare') return 'Stipendio da concordare';
    if (!min && !max) return null;
    const tipoLabel = tipo === 'netto' ? 'netti' : 'lordi';
    if (modalita === 'a_partire_da') return `Da €${(min || 0).toLocaleString('it-IT')}/mese ${tipoLabel}`;
    if (modalita === 'fisso') return `€${(min || 0).toLocaleString('it-IT')}/mese ${tipoLabel}`;
    if (min && max) return `€${min.toLocaleString('it-IT')} – €${max.toLocaleString('it-IT')}/mese ${tipoLabel}`;
    if (min) return `Da €${min.toLocaleString('it-IT')}/mese ${tipoLabel}`;
    return `Fino a €${max!.toLocaleString('it-IT')}/mese ${tipoLabel}`;
  };

  const fieldSm = 'field !min-h-[44px] !py-2.5 !text-[15px]';

  return (
    <div className="overflow-x-hidden">

      {/* HEADER + RICERCA */}
      <section className="surface-tint pt-32 sm:pt-40 pb-14">
        <div className="container-x">
          <div className="max-w-3xl">
            <span className="eyebrow">Posizioni aperte in Germania</span>
            <h1 className="h-display text-plum-800 text-[2.6rem] sm:text-6xl lg:text-[4.25rem] mt-5">
              Offerte di <span className="mark">lavoro</span>
            </h1>
            <p className="lead mt-5">
              Tutte le posizioni disponibili nelle nostre aziende partner in Germania.{' '}
              <strong className="text-plum-800 font-semibold">Candidati subito online.</strong>
            </p>
          </div>

          <form
            onSubmit={handlePageSearchSubmit}
            role="search"
            className="mt-9 bg-white rounded-xl sm:rounded-lg border border-line p-2 shadow-[var(--shadow-soft)] flex flex-col sm:flex-row gap-2 max-w-4xl"
          >
            <label className="relative flex-1">
              <span className="sr-only">Ruolo</span>
              <i className="fas fa-user-tie absolute left-5 top-1/2 -translate-y-1/2 text-plum-400 text-sm" />
              <input
                type="text"
                value={inputRuolo}
                onChange={e => setInputRuolo(e.target.value)}
                placeholder="Ruolo (es. Cuoco, Operaio)"
                className="w-full h-12 rounded-md pl-12 pr-4 text-ink font-medium placeholder:text-ink-soft/60 outline-none focus:bg-plum-50"
              />
            </label>
            <span className="hidden sm:block w-px my-2 bg-line" />
            <label className="relative flex-1">
              <span className="sr-only">Città</span>
              <i className="fas fa-map-marker-alt absolute left-5 top-1/2 -translate-y-1/2 text-plum-400 text-sm" />
              <input
                type="text"
                value={inputCitta}
                onChange={e => setInputCitta(e.target.value)}
                placeholder="Città (es. Berlino, Monaco)"
                className="w-full h-12 rounded-md pl-12 pr-4 text-ink font-medium placeholder:text-ink-soft/60 outline-none focus:bg-plum-50"
              />
            </label>
            <button type="submit" className="btn btn-primary h-12 !px-7">
              <i className="fas fa-search text-sm" /> Cerca
            </button>
          </form>

          {hasActiveSearch && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-soft">Ricerca attiva:</span>
              {queryRuolo && <span className="chip chip-sun">Ruolo: {queryRuolo}</span>}
              {queryCitta && <span className="chip chip-sun">Città: {queryCitta}</span>}
              <button type="button" onClick={clearSearch} className="ml-1 font-semibold text-plum-600 hover:text-plum-800 flex items-center gap-1.5 cursor-pointer">
                <i className="fas fa-times-circle" /> Cancella filtri
              </button>
            </div>
          )}

          {/* FILTRI SETTORE */}
          <div className="mt-8 -mx-5 px-5 sm:mx-0 sm:px-0 overflow-x-auto hide-scrollbar">
            <div className="flex sm:flex-wrap gap-2 w-max sm:w-auto">
              {SETTORI_FILTRO.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFiltroSettore(s)}
                  aria-pressed={filtroSettore === s}
                  className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors cursor-pointer ${ filtroSettore === s ? 'bg-plum-800 text-white border-plum-800' : 'bg-white text-ink-soft border-line hover:border-plum-300 hover:text-plum-800' }`}
                >
                  {s !== 'Tutti' && <i className={`fas ${SETTORE_ICONS[s] ?? 'fa-briefcase'} text-xs opacity-70`} />}
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="pt-12 pb-20 md:pb-28">
        <div className="container-x">

          {/* FALLBACK QUANDO NON CI SONO RISULTATI ESATTI */}
          {isFallback && (
            <div className="reveal rounded-lg border border-line border-l-4 border-l-sun-400 bg-white text-plum-800 p-7 sm:p-10 mb-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="max-w-3xl">
                <span className="chip !bg-plum-800 !text-white !border-plum-800"><i className="fas fa-search text-[10px]" /> Nessun risultato diretto</span>
                <h2 className="font-semibold text-2xl sm:text-3xl tracking-tight mt-4 leading-snug">
                  Per ora non abbiamo la tua ricerca per “{queryRuolo || 'tutti i ruoli'}”{queryCitta ? <> a “{queryCitta}”</> : ''}
                </h2>
                <p className="text-plum-800/75 mt-3 leading-relaxed">
                  Ma puoi guardare questi lavori simili qui sotto! Se hai bisogno di informazioni o cerchi qualcosa di specifico, chiedi pure senza impegno.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-lg btn-dark">
                  <i className="fab fa-whatsapp text-lg" /> Scrivici su WhatsApp
                </button>
                <a href="/#candidatura" className="btn btn-lg btn-outline">
                  Candidatura spontanea
                </a>
              </div>
            </div>
          )}

          <div className="mb-6 text-sm font-semibold text-plum-600">
            {isFallback
              ? <><i className="fas fa-star text-sun-500 mr-1.5" /> Offerte di lavoro simili in Germania ({displayedOfferte.length})</>
              : <>{displayedOfferte.length} {displayedOfferte.length === 1 ? 'offerta trovata' : 'offerte trovate'}</>}
          </div>

          {/* OFFERTE GRID */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true" aria-label="Caricamento offerte">
              {[0, 1, 2].map(i => (
                <div key={i} className="card overflow-hidden animate-pulse">
                  <div className="h-44 bg-plum-50" />
                  <div className="p-6 space-y-3">
                    <div className="h-4 w-1/3 rounded bg-plum-50" />
                    <div className="h-6 w-4/5 rounded bg-plum-100" />
                    <div className="h-4 w-1/2 rounded bg-plum-50" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedOfferte.length === 0 ? (
            <div className="card p-10 sm:p-16 text-center reveal">
              <span className="mx-auto icon-tile !w-16 !h-16 !rounded-lg"><i className="fas fa-briefcase text-2xl" /></span>
              <h3 className="font-semibold text-2xl text-plum-800 mt-6">Nessuna offerta per questo settore</h3>
              <p className="text-ink-soft mt-2 mb-8 max-w-md mx-auto">
                Inviaci comunque la tua candidatura — ti teniamo in considerazione per le prossime aperture.
              </p>
              <a href="/#candidatura" className="btn btn-lg btn-primary">Candidati ora</a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedOfferte.map(offerta => {
                const color = CONTRATTO_COLORS[offerta.contratto] || '#6E4274';
                const stipendio = formatStipendio(offerta);
                return (
                  <article key={offerta.id} className="group card card-hover overflow-hidden flex flex-col">
                    <Link to={`/offerte/${offerta.slug || offerta.id}`} className="relative h-44 bg-plum-50 overflow-hidden block" tabIndex={-1} aria-hidden="true">
                      {offerta.immagine_url ? (
                        <img src={offerta.immagine_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full surface-tint flex items-center justify-center">
                          <i className={`fas ${SETTORE_ICONS[offerta.settore] ?? 'fa-briefcase'} text-5xl text-plum-200`} />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 right-3 flex justify-between gap-2">
                        {offerta.in_evidenza ? <span className="chip chip-sun"><i className="fas fa-star text-[10px]" /> In evidenza</span> : <span />}
                        <span className="chip !bg-white" style={{ color, borderColor: color + '33' }}>{offerta.contratto}</span>
                      </div>
                    </Link>

                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex items-center gap-2 text-sm text-ink-soft">
                        <i className={`fas ${SETTORE_ICONS[offerta.settore] ?? 'fa-briefcase'} text-plum-400`} />
                        <span className="truncate">{offerta.settore}</span>
                      </div>
                      <h3 className="font-semibold text-xl text-plum-800 tracking-tight leading-snug mt-2">
                        <Link to={`/offerte/${offerta.slug || offerta.id}`} className="hover:text-plum-600">{offerta.titolo}</Link>
                      </h3>
                      <p className="flex items-center gap-2 text-sm text-ink-soft mt-3">
                        <i className="fas fa-map-marker-alt text-plum-400" />
                        {offerta.citta}{offerta.stato_germania ? `, ${offerta.stato_germania}` : ''} 🇩🇪
                      </p>
                      {stipendio && (
                        <p className="flex items-center gap-2 text-sm font-semibold text-plum-700 mt-2">
                          <i className="fas fa-euro-sign text-plum-400" /> {stipendio}
                        </p>
                      )}
                      <p className="text-[15px] text-ink-soft leading-relaxed line-clamp-3 mt-3 mb-6">{offerta.descrizione}</p>

                      <div className="flex items-center gap-2 mt-auto">
                        <Link to={`/offerte/${offerta.slug || offerta.id}`} className="btn btn-accent flex-1">
                          Dettaglio <i className="fas fa-arrow-right text-xs" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setSelected(offerta)}
                          aria-label={`Anteprima e candidatura: ${offerta.titolo}`}
                          title="Anteprima e candidatura"
                          className="btn btn-outline !px-4"
                        >
                          <i className="fas fa-paper-plane text-plum-600" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* CTA */}
          <div className="reveal mt-16 rounded-xl surface-plum px-6 py-12 sm:px-12 sm:py-16 text-center overflow-hidden">
            <h2 className="h-section text-white">Non trovi quello che cerchi? <span className="text-sun-400">Candidati comunque.</span></h2>
            <p className="text-white/70 text-lg mt-4 max-w-2xl mx-auto">
              Riceviamo nuove offerte ogni settimana. Inviaci il tuo profilo e ti contatteremo appena arriva qualcosa di adatto.
            </p>
            <a href="/#candidatura" className="btn btn-lg btn-accent mt-8">
              Invia la tua candidatura <i className="fas fa-arrow-right text-xs" />
            </a>
          </div>
        </div>
      </section>

      {/* MODAL DETTAGLIO OFFERTA */}
      {selected && (
        <div
          className="fixed inset-0 bg-plum-950/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center sm:p-6"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="offer-modal-title"
        >
          <div
            className="animate-pop-in w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto bg-white rounded-t-xl sm:rounded-xl shadow-[var(--shadow-lift)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 sm:p-10">
              <div className="flex justify-between items-start gap-4 mb-7">
                <div className="flex-1">
                  <span className="chip" style={{ color: CONTRATTO_COLORS[selected.contratto] || '#6E4274', borderColor: (CONTRATTO_COLORS[selected.contratto] || '#6E4274') + '33', background: (CONTRATTO_COLORS[selected.contratto] || '#6E4274') + '10' }}>
                    {selected.contratto}
                  </span>
                  <h2 id="offer-modal-title" className="font-semibold text-2xl sm:text-3xl text-plum-800 tracking-tight mt-3">{selected.titolo}</h2>
                  {selected.azienda && <p className="text-plum-600 font-medium mt-1">{selected.azienda}</p>}
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Chiudi" className="h-11 w-11 rounded-md bg-plum-50 text-plum-800 hover:bg-plum-100 flex items-center justify-center shrink-0 cursor-pointer">
                  <i className="fas fa-times" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-7">
                <div className="rounded-lg bg-plum-50 p-4">
                  <div className="text-xs font-semibold text-plum-600 mb-1"><i className="fas fa-map-marker-alt mr-1" /> Città</div>
                  <div className="font-semibold text-plum-800">{selected.citta}{selected.stato_germania ? `, ${selected.stato_germania}` : ''} 🇩🇪</div>
                </div>
                <div className="rounded-lg bg-plum-50 p-4">
                  <div className="text-xs font-semibold text-plum-600 mb-1"><i className="fas fa-industry mr-1" /> Settore</div>
                  <div className="font-semibold text-plum-800">{selected.settore}</div>
                </div>
                {formatStipendio(selected) && (
                  <div className="rounded-lg bg-sun-100 p-4 col-span-2">
                    <div className="text-xs font-semibold text-plum-600 mb-1"><i className="fas fa-euro-sign mr-1" /> Stipendio</div>
                    <div className="font-semibold text-plum-800">{formatStipendio(selected)}</div>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-plum-600 mb-2 font-sans">Descrizione</h3>
                <p className="text-ink leading-relaxed whitespace-pre-line">{selected.descrizione}</p>
              </div>

              {selected.requisiti && (
                <div className="mb-8">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-plum-600 mb-2 font-sans">Requisiti</h3>
                  <p className="text-ink leading-relaxed whitespace-pre-line">{selected.requisiti}</p>
                </div>
              )}

              {showApply ? (
                <div className="rounded-xl border border-line bg-paper p-5 sm:p-6">
                  {applyDone ? (
                    <div className="text-center py-6">
                      <span className="mx-auto h-16 w-16 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl"><i className="fas fa-check" /></span>
                      <h3 className="font-semibold text-2xl text-plum-800 mt-4">Candidatura inviata!</h3>
                      <p className="text-ink-soft mt-2 mb-6">Ti contatteremo presto. Puoi seguire lo stato nella tua dashboard.</p>
                      <button type="button" onClick={() => { setSelected(null); setShowApply(false); }} className="btn btn-primary">
                        Chiudi
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-semibold text-lg text-plum-800 mb-4">Candidatura — {selected?.titolo}</h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="field-label">Nome account</span>
                          <div className={`${fieldSm} !bg-plum-50 flex items-center text-ink-soft`}>{profile?.full_name || user?.email?.split('@')[0]}</div>
                        </div>
                        <div>
                          <span className="field-label">Email</span>
                          <div className={`${fieldSm} !bg-plum-50 flex items-center text-ink-soft truncate`}>{user?.email}</div>
                        </div>
                        <div>
                          <label htmlFor="a-nascita" className="field-label">Data di nascita *</label>
                          <input id="a-nascita" type="date" value={applyDataNascita} onChange={e => setApplyDataNascita(e.target.value)} className={fieldSm} />
                        </div>
                        <div>
                          <label htmlFor="a-citt" className="field-label">Cittadinanza *</label>
                          <input id="a-citt" type="text" value={applyCittadinanza} onChange={e => setApplyCittadinanza(e.target.value)} placeholder="Es. Italiana" className={fieldSm} />
                        </div>
                        <div>
                          <label htmlFor="a-tel" className="field-label">Telefono *</label>
                          <input id="a-tel" type="tel" value={applyPhone} onChange={e => setApplyPhone(e.target.value)} placeholder="+39 333 000 0000" className={fieldSm} />
                        </div>
                        <div>
                          <label htmlFor="a-paese" className="field-label">Paese di residenza</label>
                          <input id="a-paese" type="text" value={applyPaese} onChange={e => setApplyPaese(e.target.value)} placeholder="Italia" className={fieldSm} />
                        </div>
                        <div>
                          <label htmlFor="a-de" className="field-label">Tedesco</label>
                          <select id="a-de" value={applyTedesco} onChange={e => setApplyTedesco(e.target.value)} className={fieldSm}>
                            {LIVELLI_LINGUA.map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="a-en" className="field-label">Inglese</label>
                          <select id="a-en" value={applyInglese} onChange={e => setApplyInglese(e.target.value)} className={fieldSm}>
                            {LIVELLI_LINGUA.map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                        <div>
                          <label htmlFor="a-esp" className="field-label">Esperienza</label>
                          <select id="a-esp" value={applyEsperienza} onChange={e => setApplyEsperienza(e.target.value)} className={fieldSm}>
                            {['0-1 anni', '1-3 anni', '3-5 anni', '5-10 anni', '10+ anni'].map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="a-pat" className="field-label">Patente</label>
                          <select id="a-pat" value={applyPatente} onChange={e => setApplyPatente(e.target.value)} className={fieldSm}>
                            {['Nessuna', 'B', 'B + C', 'B + C + E'].map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="a-disp" className="field-label">Disponibilità</label>
                          <select id="a-disp" value={applyDisponibilita} onChange={e => setApplyDisponibilita(e.target.value)} className={fieldSm}>
                            {['Immediata', 'In 2 settimane', 'In 1 mese', 'In 3 mesi', 'Da concordare'].map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label htmlFor="a-note" className="field-label">Lettera di presentazione *</label>
                        <textarea id="a-note" value={applyNote} onChange={e => setApplyNote(e.target.value)} rows={3}
                          placeholder="Presentati brevemente: chi sei, perché sei interessato/a e cosa ti rende il candidato ideale..."
                          className="field !min-h-[96px]" />
                      </div>
                      {applyError && <p role="alert" className="text-red-600 font-medium text-sm mt-3">{applyError}</p>}
                      <div className="flex gap-3 mt-5">
                        <button type="button" onClick={() => setShowApply(false)} aria-label="Indietro" className="btn btn-outline !px-4">
                          <i className="fas fa-arrow-left" />
                        </button>
                        <button type="button" onClick={submitApply} disabled={applyLoading || !applyPhone} className="btn btn-primary flex-1">
                          {applyLoading ? <><i className="fas fa-spinner fa-spin" /> Invio...</> : <><i className="fas fa-paper-plane" /> Invia candidatura</>}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={openApply} className="btn btn-lg btn-primary flex-1">
                    <i className="fas fa-paper-plane" />
                    {user ? 'Candidati ora' : 'Accedi per candidarti'}
                  </button>
                  <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-lg btn-wa">
                    <i className="fab fa-whatsapp text-lg" /> WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal Popup */}
      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />
    </div>
  );
};

export default JobOffers;
