
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Cloud, CircledX, CurvedArrow, Cursor } from '../components/Decorations';
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
  'Tempo Indeterminato': '#25D366',
  'Tempo Determinato': '#FF6B35',
  'Stagionale': '#0066CC',
  'Apprendistato': '#6E4274',
};

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

  return (
    <div className="pt-32 pb-24 bg-transparent relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <Cloud className="absolute top-40 right-10 w-24 h-24 text-[#6E4274] opacity-15 animate-pulse" />
        <Cloud className="absolute top-[55%] left-10 w-20 h-20 text-[#6E4274] opacity-10" />
        <CircledX className="absolute top-80 left-20 w-14 h-14 text-[#6E4274] opacity-20" />
        <CircledX className="absolute bottom-40 right-20 w-10 h-10 text-[#6E4274] opacity-15 rotate-45" />
        <CurvedArrow className="absolute top-[35%] left-[5%] w-16 h-16 text-[#6E4274] opacity-15" />
        <Cursor className="absolute bottom-[20%] right-[8%] w-12 h-12 text-[#6E4274] opacity-10" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">

        {/* HEADER */}
        <div className="text-center mb-12 reveal">
          <div className="inline-block bg-[#6E4274] text-white px-6 py-2 font-black text-xs tracking-[0.3em] uppercase mb-6 border-4 border-[#3D2045]">
            🇩🇪 Posizioni Aperte
          </div>
          <h1 className="text-5xl md:text-7xl font-heading font-black text-black dark:text-white tracking-tighter uppercase mb-6">
            Offerte di<br /><span className="text-[#6E4274]">Lavoro</span>
          </h1>
          <p className="text-xl text-black/80 dark:text-white/80 max-w-3xl mx-auto font-bold uppercase tracking-tight">
            Tutte le posizioni disponibili nelle nostre aziende partner in Germania. <strong className="text-[#6E4274]">Candidati subito online.</strong>
          </p>
        </div>

        {/* BARRA DI RICERCA NELLA PAGINA OFFETTI */}
        <div className="reveal max-w-4xl mx-auto mb-12">
          <form onSubmit={handlePageSearchSubmit} className="comic-card border-4 border-[#3D2045] bg-[#3D2045] p-5 md:p-6 shadow-[6px_6px_0px_#3D2045]">
            <div className="text-black font-black text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
              <i className="fas fa-filter" /> Filtra o cerca per Ruolo e Città:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="relative md:col-span-2">
                <i className="fas fa-user-tie absolute left-4 top-1/2 -translate-y-1/2 text-[#6E4274] text-sm" />
                <input
                  type="text"
                  value={inputRuolo}
                  onChange={e => setInputRuolo(e.target.value)}
                  placeholder="Ruolo (es. Cuoco, Operaio)"
                  className="w-full bg-white border-2 border-[#3D2045] pl-10 pr-3 py-3 text-xs sm:text-sm font-extrabold text-black dark:text-black outline-none focus:border-yellow-300 placeholder:text-gray-500 dark:placeholder:text-gray-500"
                />
              </div>
              <div className="relative md:col-span-2">
                <i className="fas fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-[#6E4274] text-sm" />
                <input
                  type="text"
                  value={inputCitta}
                  onChange={e => setInputCitta(e.target.value)}
                  placeholder="Città (es. Berlino, Monaco)"
                  className="w-full bg-white border-2 border-[#3D2045] pl-10 pr-3 py-3 text-xs sm:text-sm font-extrabold text-black dark:text-black outline-none focus:border-yellow-300 placeholder:text-gray-500 dark:placeholder:text-gray-500"
                />
              </div>
              <button
                type="submit"
                className="comic-button bg-yellow-300 text-[#3D2045] border-[#3D2045] py-3 text-xs sm:text-sm font-black uppercase tracking-widest hover:bg-yellow-200 flex items-center justify-center gap-2"
              >
                <i className="fas fa-search" /> Cerca
              </button>
            </div>

            {hasActiveSearch && (
              <div className="mt-4 pt-3 border-t border-white/20 flex flex-wrap items-center justify-between gap-3 text-black text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span>Ricerca attiva:</span>
                  {queryRuolo && <span className="bg-yellow-300 text-[#3D2045] px-2 py-1 font-black uppercase">Ruolo: {queryRuolo}</span>}
                  {queryCitta && <span className="bg-yellow-300 text-[#3D2045] px-2 py-1 font-black uppercase">Città: {queryCitta}</span>}
                </div>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-black hover:underline uppercase tracking-widest font-black flex items-center gap-1"
                >
                  <i className="fas fa-times-circle" /> Cancella Filtri
                </button>
              </div>
            )}
          </form>
        </div>

        {/* SEZIONE FALLBACK QUANDO NON CI SONO RISULTATI ESATTI */}
        {isFallback && (
          <div className="reveal comic-card border-8 border-[#3D2045] bg-yellow-300 text-black p-8 md:p-12 mb-14 shadow-[8px_8px_0px_#3D2045]">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="space-y-4 max-w-3xl">
                <div className="inline-block bg-[#6E4274] text-white px-4 py-1 font-black text-xs uppercase tracking-widest border-2 border-[#3D2045]">
                  🔍 Nessun Risultato Diretto
                </div>
                <h2 className="text-2xl sm:text-4xl font-heading font-black uppercase tracking-tight text-black dark:text-black leading-tight">
                  Per ora non abbiamo la tua ricerca per{' '}
                  <span className="bg-[#6E4274] text-white px-3 py-1 inline-block">
                    "{queryRuolo || 'tutti i ruoli'}"
                  </span>{' '}
                  {queryCitta ? (
                    <span>
                      a <span className="bg-[#6E4274] text-white px-3 py-1 inline-block">"{queryCitta}"</span>
                    </span>
                  ) : ''}
                </h2>
                <p className="text-base sm:text-lg text-black dark:text-black font-extrabold leading-relaxed">
                  Ma puoi guardare questi lavori simili qui sotto! Se hai bisogno di informazioni o cerchi qualcosa di specifico, chiedi pure senza impegno.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWaModal(true)}
                  className="comic-button bg-[#25D366] text-white border-[#3D2045] px-6 py-4 text-xs sm:text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:brightness-110 cursor-pointer"
                >
                  <i className="fab fa-whatsapp text-xl" /> Scrivici su WhatsApp
                </button>
                <a
                  href="/#candidatura"
                  className="comic-button bg-[#6E4274] text-white border-[#3D2045] px-6 py-4 text-xs sm:text-sm font-black uppercase tracking-widest text-center hover:bg-[#3D2045]"
                >
                  Candidatura Spontanea
                </a>
              </div>
            </div>
          </div>
        )}

        {/* FILTRI SETTORE */}
        <div className="reveal flex flex-wrap gap-3 justify-center mb-12">
          {SETTORI_FILTRO.map(s => (
            <button
              key={s}
              onClick={() => setFiltroSettore(s)}
              className={`px-5 py-2 text-xs font-black uppercase tracking-widest border-4 transition-all ${filtroSettore === s
                ? 'bg-[#6E4274] text-white border-[#3D2045]'
                : 'bg-transparent text-[#3D2045] dark:text-white border-[#3D2045]/40 dark:border-white/30 hover:border-[#6E4274] hover:text-[#6E4274] dark:hover:text-[#9B6FA3]'
                }`}
              style={filtroSettore === s ? { boxShadow: '3px 3px 0px #3D2045' } : {}}
            >
              {s}
            </button>
          ))}
        </div>

        {/* TITOLO SEZIONE ANUNCI / RISULTATI */}
        <div className="reveal mb-8 flex items-center justify-between">
          <span className="text-base font-black text-[#6E4274] uppercase tracking-widest">
            {isFallback ? (
              <span className="text-[#6E4274] font-black">⭐ Offerte di Lavoro Simili in Germania ({displayedOfferte.length}):</span>
            ) : (
              <span>{displayedOfferte.length} {displayedOfferte.length === 1 ? 'offerta trovata' : 'offerte trovate'}</span>
            )}
          </span>
        </div>

        {/* OFFERTE GRID */}
        {loading ? (
          <div className="text-center py-24 text-[#6E4274]">
            <i className="fas fa-spinner fa-spin text-4xl mb-4 block" />
            <p className="font-black uppercase tracking-widest">Caricamento offerte...</p>
          </div>
        ) : displayedOfferte.length === 0 ? (
          <div className="comic-card border-8 border-[#3D2045] p-20 text-center reveal" style={{ boxShadow: '8px 8px 0px #3D2045' }}>
            <i className="fas fa-briefcase text-5xl text-[#6E4274] mb-6 block" />
            <h3 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight mb-4">
              Nessuna offerta per questo settore
            </h3>
            <p className="text-black/60 dark:text-white/60 font-bold mb-8">
              Inviaci comunque la tua candidatura — ti teniamo in considerazione per le prossime aperture.
            </p>
            <a href="/#candidatura" className="comic-button inline-block bg-[#6E4274] text-white px-10 py-4 text-lg border-[#3D2045] hover:bg-[#3D2045]">
              Candidati Ora
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedOfferte.map(offerta => (
              <div
                key={offerta.id}
                className="comic-card border-4 border-[#3D2045] p-6 sm:p-8 flex flex-col group transition-all duration-200 bg-[var(--card-bg)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_#3D2045]"
                style={{ boxShadow: '5px 5px 0px #3D2045' }}
              >
                {/* Immagine Annuncio se presente */}
                {offerta.immagine_url && (
                  <div className="w-full h-44 overflow-hidden border-3 border-[#3D2045] -mt-2 mb-4 relative flex-shrink-0">
                    <img src={offerta.immagine_url} alt={offerta.titolo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                {/* Contratto badge + Evidenza */}
                <div className="flex items-start justify-between mb-6">
                  <span
                    className="text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 border-2 border-[#3D2045]"
                    style={{ background: CONTRATTO_COLORS[offerta.contratto] || '#6E4274' }}
                  >
                    {offerta.contratto}
                  </span>
                  <div className="flex items-center gap-2">
                    {offerta.in_evidenza && (
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-yellow-300 text-[#3D2045] border-2 border-[#3D2045]">⭐</span>
                    )}
                    <span className="text-[10px] font-black text-black/50 dark:text-white/50 uppercase tracking-widest">
                      {offerta.settore}
                    </span>
                  </div>
                </div>

                {/* Titolo */}
                <h3 className="text-xl font-heading font-black text-black dark:text-white uppercase tracking-tight mb-2">
                  {offerta.titolo}
                </h3>

                {/* Luogo */}
                <div className="flex items-center gap-2 mb-4">
                  <i className="fas fa-map-marker-alt text-[#6E4274] text-sm" />
                  <span className="text-sm font-bold text-black/70 dark:text-white/70">
                    {offerta.citta}{offerta.stato_germania ? `, ${offerta.stato_germania}` : ''} 🇩🇪
                  </span>
                </div>

                {/* Stipendio */}
                {formatStipendio(offerta) && (
                  <div className="flex items-center gap-2 mb-4">
                    <i className="fas fa-euro-sign text-[#6E4274] text-sm" />
                    <span className="text-sm font-black text-[#6E4274]">
                      {formatStipendio(offerta)}
                    </span>
                  </div>
                )}

                {/* Descrizione preview */}
                <p className="text-sm text-black/60 dark:text-white/60 font-bold leading-relaxed mt-auto mb-6 line-clamp-3">
                  {offerta.descrizione}
                </p>

                {/* Bottoni azione */}
                <div className="flex items-center gap-3 mt-auto">
                  <Link
                    to={`/offerte/${offerta.slug || offerta.id}`}
                    className="comic-button flex-1 text-center bg-yellow-300 text-[#3D2045] border-[#3D2045] py-2 text-xs font-black uppercase tracking-widest hover:bg-yellow-200"
                    onClick={e => e.stopPropagation()}
                  >
                    Dettaglio →
                  </Link>
                  <button
                    onClick={() => setSelected(offerta)}
                    className="comic-button bg-[#6E4274] text-white border-[#3D2045] px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-[#3D2045]"
                  >
                    <i className="fas fa-paper-plane" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="reveal mt-20 bg-[#3D2045] border-8 border-[#3D2045] p-12 md:p-16 text-center" style={{ boxShadow: '8px 8px 0px #3D2045' }}>
          <h2 className="text-3xl md:text-5xl font-heading font-black text-white uppercase tracking-tighter mb-6">
            Non trovi quello che cerchi?<br /><span className="text-yellow-300">Candidati comunque.</span>
          </h2>
          <p className="text-white/80 text-lg font-bold mb-10 uppercase tracking-tight">
            Riceviamo nuove offerte ogni settimana. Inviaci il tuo profilo e ti contatteremo appena arriva qualcosa di adatto.
          </p>
          <Link to="/#candidatura" className="comic-button inline-block bg-yellow-300 text-[#3D2045] border-[#3D2045] px-12 py-6 text-xl hover:bg-yellow-200">
            Invia la Tua Candidatura
          </Link>
        </div>
      </div>

      {/* MODAL DETTAGLIO OFFERTA */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="comic-card border-8 border-[#3D2045] w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--card-bg)]"
            style={{ boxShadow: '8px 8px 0px #3D2045' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-10">
              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div className="flex-1">
                  <span
                    className="text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 border-2 border-[#3D2045] inline-block mb-3"
                    style={{ background: CONTRATTO_COLORS[selected.contratto] || '#6E4274' }}
                  >
                    {selected.contratto}
                  </span>
                  <h2 className="text-3xl font-heading font-black text-black dark:text-white uppercase tracking-tighter mb-1">
                    {selected.titolo}
                  </h2>
                  {selected.azienda && (
                    <p className="text-[#6E4274] font-black text-sm uppercase tracking-widest">{selected.azienda}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="ml-4 w-10 h-10 border-4 border-[#3D2045] flex items-center justify-center text-black dark:text-white hover:bg-[#3D2045] hover:text-white transition-colors flex-shrink-0"
                >
                  <i className="fas fa-times" />
                </button>
              </div>

              {/* Dettagli */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="border-4 border-[#3D2045] p-4 bg-[var(--bg-color)]">
                  <div className="text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">📍 Città</div>
                  <div className="font-black text-black dark:text-white">{selected.citta}{selected.stato_germania ? `, ${selected.stato_germania}` : ''} 🇩🇪</div>
                </div>
                <div className="border-4 border-[#3D2045] p-4 bg-[var(--bg-color)]">
                  <div className="text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">🏭 Settore</div>
                  <div className="font-black text-black dark:text-white">{selected.settore}</div>
                </div>
                {formatStipendio(selected) && (
                  <div className="border-4 border-[#3D2045] p-4 bg-[var(--bg-color)] col-span-2">
                    <div className="text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">💶 Stipendio</div>
                    <div className="font-black text-black dark:text-white">{formatStipendio(selected)}</div>
                  </div>
                )}
              </div>

              {/* Descrizione */}
              <div className="mb-6">
                <div className="text-[10px] font-black text-[#6E4274] uppercase tracking-[0.2em] mb-3">📋 Descrizione</div>
                <p className="text-black/80 dark:text-white/80 font-bold leading-relaxed whitespace-pre-line">{selected.descrizione}</p>
              </div>

              {/* Requisiti */}
              {selected.requisiti && (
                <div className="mb-8">
                  <div className="text-[10px] font-black text-[#6E4274] uppercase tracking-[0.2em] mb-3">✅ Requisiti</div>
                  <p className="text-black/80 dark:text-white/80 font-bold leading-relaxed whitespace-pre-line">{selected.requisiti}</p>
                </div>
              )}

              {/* CTA */}
              {showApply ? (
                <div className="border-4 border-[#3D2045] p-6 bg-[var(--bg-color)]">
                  {applyDone ? (
                    <div className="text-center py-6">
                      <i className="fas fa-check-circle text-5xl text-green-500 mb-4 block" />
                      <h3 className="text-xl font-black text-black dark:text-white uppercase mb-2">Candidatura Inviata!</h3>
                      <p className="text-black/60 dark:text-white/60 font-bold mb-4">Ti contatteremo presto. Puoi seguire lo stato nella tua dashboard.</p>
                      <button onClick={() => { setSelected(null); setShowApply(false); }} className="comic-button bg-[#6E4274] text-white px-8 py-3 border-[#3D2045]">
                        Chiudi
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="text-[10px] font-black text-[#6E4274] uppercase tracking-[0.2em] mb-4">📋 Candidatura — {selected?.titolo}</div>

                      {/* Nome + Email (read-only) */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Nome Account</label>
                          <div className="border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--card-bg)] opacity-60 text-black dark:text-white">
                            {profile?.full_name || user?.email?.split('@')[0]}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Email</label>
                          <div className="border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--card-bg)] opacity-60 text-black dark:text-white">
                            {user?.email}
                          </div>
                        </div>
                      </div>

                      {/* Data nascita + Cittadinanza */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Data di Nascita *</label>
                          <input type="date" value={applyDataNascita} onChange={e => setApplyDataNascita(e.target.value)}
                            className="w-full border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--bg-color)] text-black dark:text-white outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Cittadinanza *</label>
                          <input type="text" value={applyCittadinanza} onChange={e => setApplyCittadinanza(e.target.value)}
                            placeholder="Es. Italiana"
                            className="w-full border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--bg-color)] text-black dark:text-white outline-none" />
                        </div>
                      </div>

                      {/* Telefono + Paese residenza */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Telefono *</label>
                          <input type="tel" value={applyPhone} onChange={e => setApplyPhone(e.target.value)}
                            placeholder="+39 333 000 0000"
                            className="w-full border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--bg-color)] text-black dark:text-white outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Paese di Residenza</label>
                          <input type="text" value={applyPaese} onChange={e => setApplyPaese(e.target.value)}
                            placeholder="Italia"
                            className="w-full border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--bg-color)] text-black dark:text-white outline-none" />
                        </div>
                      </div>

                      {/* Tedesco + Inglese */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Tedesco</label>
                          <select value={applyTedesco} onChange={e => setApplyTedesco(e.target.value)}
                            className="w-full border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--bg-color)] text-black dark:text-white outline-none">
                            {['Nessuno', 'Base (A1-A2)', 'Intermedio (B1-B2)', 'Avanzato (C1-C2)'].map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Inglese</label>
                          <select value={applyInglese} onChange={e => setApplyInglese(e.target.value)}
                            className="w-full border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--bg-color)] text-black dark:text-white outline-none">
                            {['Nessuno', 'Base (A1-A2)', 'Intermedio (B1-B2)', 'Avanzato (C1-C2)'].map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Esperienza + Patente + Disponibilità */}
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Esperienza</label>
                          <select value={applyEsperienza} onChange={e => setApplyEsperienza(e.target.value)}
                            className="w-full border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--bg-color)] text-black dark:text-white outline-none">
                            {['0-1 anni', '1-3 anni', '3-5 anni', '5-10 anni', '10+ anni'].map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Patente</label>
                          <select value={applyPatente} onChange={e => setApplyPatente(e.target.value)}
                            className="w-full border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--bg-color)] text-black dark:text-white outline-none">
                            {['Nessuna', 'B', 'B + C', 'B + C + E'].map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Disponibilità</label>
                          <select value={applyDisponibilita} onChange={e => setApplyDisponibilita(e.target.value)}
                            className="w-full border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--bg-color)] text-black dark:text-white outline-none">
                            {['Immediata', 'In 2 settimane', 'In 1 mese', 'In 3 mesi', 'Da concordare'].map(l => <option key={l}>{l}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Messaggio (obbligatorio) */}
                      <div className="mb-4">
                        <label className="block text-[10px] font-black text-[#6E4274] uppercase tracking-widest mb-1">Lettera di Presentazione *</label>
                        <textarea value={applyNote} onChange={e => setApplyNote(e.target.value)} rows={3}
                          placeholder="Presentati brevemente: chi sei, perché sei interessato/a e cosa ti rende il candidato ideale..."
                          className="w-full border-4 border-[#3D2045] px-3 py-2 font-bold text-sm bg-[var(--bg-color)] text-black dark:text-white outline-none resize-none" />
                      </div>
                      {applyError && <p className="text-red-600 font-black text-sm mb-3">{applyError}</p>}
                      <div className="flex gap-3">
                        <button
                          onClick={submitApply}
                          disabled={applyLoading || !applyPhone}
                          className="comic-button flex-1 bg-[#6E4274] text-white py-4 text-sm border-[#3D2045] hover:bg-[#3D2045] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {applyLoading ? <><i className="fas fa-spinner fa-spin" /> Invio...</> : <><i className="fas fa-paper-plane" /> INVIA CANDIDATURA</>}
                        </button>
                        <button onClick={() => setShowApply(false)} className="px-4 border-4 border-[#3D2045] font-black text-sm text-black dark:text-white">
                          ←
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={openApply}
                    className="comic-button flex-1 text-center bg-[#6E4274] text-white py-5 text-lg border-[#3D2045] hover:bg-[#3D2045]"
                  >
                    <i className="fas fa-paper-plane mr-3" />
                    {user ? 'Candidati ora' : 'Accedi per candidarti'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWaModal(true)}
                    className="comic-button text-center bg-[#25D366] text-white py-5 px-6 text-lg border-white hover:bg-green-400 cursor-pointer"
                  >
                    <i className="fab fa-whatsapp mr-2" />
                    WhatsApp
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
