import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import logoLBS from '../img/logo_LBS.png';
import { supabase } from '../lib/supabaseClient';
import { WhatsAppModal } from '../components/WhatsAppModal';
import { useTheme } from '../context/ThemeContext';

const SETTORI_LIST = [
  'Edilizia e Costruzioni',
  'Ristorazione, Cucina e Pizzeria',
  'Logistica, Magazzino e Carrellisti',
  'Fabbrica, Produzione e Assemblaggio',
  'Pulizie civili e industriali',
  'Sanitario e Assistenza (OSS/Infermieri)',
  'Autisti, Trasporti e Consegne',
  'Altro settore',
];

const LIVELLI_TEDESCO = [
  'Nessuna conoscenza (0%)',
  'Base / Saluti (A1 - A2)',
  'Intermedio / Conversazione (B1 - B2)',
  'Fluente o Madrelingua (C1 - C2)',
];

const DISPONIBILITA_LIST = [
  'Immediata (entro pochi giorni)',
  'Entro 2 - 3 settimane',
  'Entro 1 mese',
  'Sto valutando / Solo informazioni',
];

export const Candidati: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  const [showWaModal, setShowWaModal] = useState(false);

  // Form State
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [settore, setSettore] = useState('');
  const [tedesco, setTedesco] = useState(LIVELLI_TEDESCO[0]);
  const [disponibilita, setDisponibilita] = useState(DISPONIBILITA_LIST[0]);
  const [patente, setPatente] = useState('Sì (Patente B)');
  const [messaggio, setMessaggio] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Tracciamento parametri Google Ads
  const utmSource = searchParams.get('utm_source') || 'google';
  const utmCampaign = searchParams.get('utm_campaign') || searchParams.get('campaign') || '';
  const utmTerm = searchParams.get('utm_term') || searchParams.get('keyword') || '';
  const gclid = searchParams.get('gclid') || '';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = 'Lavoro in Germania con Alloggio | Candidatura Rapida LBS';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Anti-bot honeypot check
    if (honeypot) return;

    if (!privacyAccepted) {
      setErrorMessage('È necessario accettare il trattamento dei dati personali per candidarsi.');
      return;
    }

    if (!nome.trim() || !cognome.trim() || !telefono.trim() || !email.trim() || !settore) {
      setErrorMessage('Compila tutti i campi obbligatori contrassegnati da (*).');
      return;
    }

    setLoading(true);

    try {
      // Formatta note arricchite per l'amministrazione LBS
      const noteDettaglio = [
        '🎯 LEAD DA GOOGLE ADS',
        `• Livello Tedesco: ${tedesco}`,
        `• Disponibilità Partenza: ${disponibilita}`,
        `• Patente/Automunito: ${patente}`,
        messaggio.trim() ? `• Messaggio/Esperienza: ${messaggio.trim()}` : null,
        utmCampaign || utmTerm || gclid
          ? `• Tracciamento Ads: Campagna="${utmCampaign || 'N/D'}", Keyword="${utmTerm || 'N/D'}", GCLID="${gclid ? gclid.substring(0, 15) + '...' : 'N/D'}"`
          : null,
      ]
        .filter(Boolean)
        .join('\n');

      const { error } = await supabase.from('candidature').insert([
        {
          nome: nome.trim(),
          cognome: cognome.trim(),
          email: email.trim(),
          telefono: telefono.trim(),
          settore: settore,
          messaggio: noteDettaglio,
          stato: 'nuova',
        },
      ]);

      if (error) {
        console.error('Errore invio candidatura:', error);
        setErrorMessage('Si è verificato un errore durante l\'invio. Riprova oppure contattaci direttamente su WhatsApp.');
      } else {
        setSuccess(true);

        // Se presente Google Tag, invia l'evento di conversione standard
        if (typeof window !== 'undefined' && (window as any).gtag) {
          try {
            (window as any).gtag('event', 'generate_lead', {
              event_category: 'Google_Ads',
              event_label: settore,
              value: 1.0,
            });
          } catch (evErr) {
            console.warn('Google Tag event non inviato:', evErr);
          }
        }
      }
    } catch (err: any) {
      console.error('Eccezione invio:', err);
      setErrorMessage('Errore di connessione. Riprova tra poco.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] font-sans antialiased selection:bg-[#ffdf20] selection:text-[#3D2045]">
      {/* ─── TOP BAR DEDICATA SENZA DISTRAZIONI ─── */}
      <header className="sticky top-0 z-40 bg-[var(--card-bg)]/95 backdrop-blur-md border-b-4 border-[#3D2045] px-4 sm:px-8 py-3.5 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img src={logoLBS} alt="LBS Lavoro in Germania" className="h-10 sm:h-12 w-auto object-contain" />
            <div className="hidden sm:block">
              <span className="font-heading font-black tracking-wider text-sm sm:text-base text-black dark:text-white uppercase block leading-none">
                LBS Business
              </span>
              <span className="text-[10px] font-black tracking-widest text-[#6E4274] uppercase block mt-0.5">
                Lavoro in Germania
              </span>
            </div>
          </Link>

          {/* Social Proof + CTAs veloci */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden lg:flex items-center gap-2 bg-[#ffdf20]/30 border-2 border-[#3D2045] px-3 py-1 font-black text-xs text-[#3D2045] dark:text-yellow-300">
              <span>⭐⭐⭐⭐⭐</span>
              <span>Oltre 850+ Inserimenti riusciti</span>
            </div>

            <button
              onClick={toggleTheme}
              className="w-10 h-10 border-2 border-[#3D2045] flex items-center justify-center font-black hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Cambia tema"
            >
              <i className={theme === 'dark' ? 'fas fa-sun text-yellow-400' : 'fas fa-moon text-[#3D2045]'} />
            </button>

            <button
              onClick={() => setShowWaModal(true)}
              className="comic-button bg-[#25D366] text-white py-2 px-3 sm:px-4 text-xs sm:text-sm font-black flex items-center gap-2 hover:bg-green-600 border-[#3D2045]"
            >
              <i className="fab fa-whatsapp text-base" />
              <span className="hidden xs:inline">WhatsApp</span>
            </button>

            <a
              href="tel:+393518818391"
              className="comic-button bg-[#6E4274] text-white py-2 px-3 sm:px-4 text-xs sm:text-sm font-black hidden md:flex items-center gap-2 hover:bg-[#3D2045] border-[#3D2045]"
            >
              <i className="fas fa-phone-alt text-xs" />
              <span>+39 351 881 8391</span>
            </a>
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION AD ALTA CONVERSIONE ─── */}
      <section className="relative overflow-hidden pt-8 sm:pt-14 pb-16 sm:pb-24 border-b-8 border-[#3D2045] bg-gradient-to-b from-[#6E4274]/10 via-transparent to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Badge Annuncio Google */}
          <div className="inline-flex items-center gap-2 bg-[#ffdf20] text-[#3D2045] px-4 py-1.5 font-heading font-black text-xs sm:text-sm uppercase tracking-widest border-3 border-[#3D2045] shadow-[3px_3px_0px_#3D2045] mb-6">
            <i className="fas fa-bullhorn" /> Selezioni Aperte per Cittadini Italiani ed Europei
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* COLONNA SINISTRA: Titoli, Vantaggi e Credibilità (7 Colonne) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-heading font-black uppercase tracking-tight text-black dark:text-white leading-[1.08]">
                Lavora in Germania <br />
                <span className="bg-[#6E4274] text-white px-3 py-1 inline-block border-4 border-[#3D2045] shadow-[4px_4px_0px_#3D2045] mt-1">
                  Alloggio Garantito
                </span>{' '}
                <br />
                e Contratto Diretto.
              </h1>

              <p className="text-base sm:text-xl font-bold text-black/80 dark:text-white/80 leading-relaxed max-w-2xl">
                Trova lavoro sicuro con regolare contratto di lavoro a norma di legge tedesca. Alloggio vicino alla sede di lavoro, supporto burocratico completo e assistenza in italiano h24.
              </p>

              {/* I 5 Vantaggi Chiave per l'utente Ads */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-2">
                {[
                  { icon: 'fa-home', text: 'Alloggio già pronto all\'arrivo', desc: 'Camere o appartamenti arredati' },
                  { icon: 'fa-file-signature', text: 'Contratto a tempo indeterminato', desc: 'Sanità, contributi e ferie pagate' },
                  { icon: 'fa-euro-sign', text: 'Stipendi netti da 1.800€ a 3.500€+', desc: 'Puntuali ogni mese sul tuo conto' },
                  { icon: 'fa-language', text: 'Tedesco NON sempre richiesto', desc: 'Team italiani nei settori più richiesti' },
                  { icon: 'fa-user-shield', text: 'Assistenza in loco in italiano', desc: 'Registrazione anagrafe, c/c e codice fiscale' },
                  { icon: 'fa-check-circle', text: 'Nessuna spesa di candidatura', desc: 'Selezione trasparente e affidabile' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="comic-card border-3 border-[#3D2045] p-3.5 bg-[var(--card-bg)] shadow-[3px_3px_0px_#3D2045] flex items-start gap-3"
                  >
                    <div className="w-9 h-9 bg-[#25D366] text-white border-2 border-[#3D2045] flex items-center justify-center font-black text-sm flex-shrink-0 shadow-[2px_2px_0px_#3D2045]">
                      <i className={`fas ${item.icon}`} />
                    </div>
                    <div>
                      <h4 className="font-heading font-black text-xs sm:text-sm uppercase text-black dark:text-white leading-tight">
                        {item.text}
                      </h4>
                      <p className="text-[11px] font-bold text-black/60 dark:text-white/60 leading-tight mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Box Fondatore & Garanzia Umana */}
              <div className="comic-card border-4 border-[#3D2045] p-5 sm:p-6 bg-[var(--card-bg)] shadow-[5px_5px_0px_#3D2045] flex flex-col sm:flex-row items-center gap-5 mt-2">
                <img
                  src="/img/salvatore_hero.jpg"
                  alt="Salvatore Cucuzza - LBS Business"
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-none border-4 border-[#3D2045] flex-shrink-0 shadow-[3px_3px_0px_#3D2045]"
                />
                <div className="text-center sm:text-left">
                  <span className="bg-[#6E4274] text-white text-[10px] font-black px-2.5 py-0.5 uppercase tracking-widest border-2 border-[#3D2045]">
                    Salvatore Cucuzza &bull; Fondatore LBS
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-black/80 dark:text-white/80 mt-2 italic leading-snug">
                    "Sappiamo quanto sia delicato trasferirsi all'estero. Noi di LBS ti accompagniamo personalmente dal primo colloquio fino alla firma del contratto in Germania. Non sarai mai solo."
                  </p>
                </div>
              </div>
            </div>

            {/* COLONNA DESTRA: IL MODULO GOOGLE ADS (5 Colonne) */}
            <div id="modulo-candidatura" className="lg:col-span-5 w-full">
              <div className="comic-card border-6 sm:border-8 border-[#3D2045] p-5 sm:p-8 bg-[var(--card-bg)] shadow-[8px_8px_0px_#3D2045] relative">
                {/* Badge intestazione */}
                <div className="text-center mb-6">
                  <div className="inline-block bg-[#25D366] text-white px-3.5 py-1 text-xs font-heading font-black uppercase tracking-widest border-3 border-[#3D2045] shadow-[2px_2px_0px_#3D2045] mb-2">
                    ⚡ RISPOSTA ENTRO 24 ORE
                  </div>
                  <h3 className="text-xl sm:text-2xl font-heading font-black uppercase text-black dark:text-white tracking-tight">
                    Candidatura Rapida
                  </h3>
                  <p className="text-xs font-bold text-black/70 dark:text-white/70 mt-1">
                    Compila in 60 secondi: verrai ricontattato via WhatsApp o telefono
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-5 p-3.5 bg-red-100 border-3 border-red-500 text-red-900 font-bold text-xs flex items-center gap-2">
                    <i className="fas fa-exclamation-circle text-base flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Honeypot anti-spam */}
                  <div aria-hidden="true" className="absolute opacity-0 pointer-events-none h-0 overflow-hidden">
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={e => setHoneypot(e.target.value)}
                      placeholder="Lascia vuoto"
                    />
                  </div>

                  {/* Nome e Cognome */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-black dark:text-white mb-1">
                        Nome *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Es. Mario"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        className="w-full border-3 border-[#3D2045] bg-[var(--bg-color)] px-3.5 py-2.5 font-bold text-sm text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-black dark:text-white mb-1">
                        Cognome *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Es. Rossi"
                        value={cognome}
                        onChange={e => setCognome(e.target.value)}
                        className="w-full border-3 border-[#3D2045] bg-[var(--bg-color)] px-3.5 py-2.5 font-bold text-sm text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Telefono / WhatsApp (Cruciale per Google Ads) */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-black dark:text-white mb-1">
                      Numero Telefono / WhatsApp *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black/40 dark:text-white/40">
                        <i className="fab fa-whatsapp text-green-600 font-bold" />
                      </div>
                      <input
                        type="tel"
                        required
                        placeholder="+39 340 1234567"
                        value={telefono}
                        onChange={e => setTelefono(e.target.value)}
                        className="w-full pl-9 border-3 border-[#3D2045] bg-[var(--bg-color)] px-3.5 py-2.5 font-bold text-sm text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors"
                      />
                    </div>
                    <span className="text-[10px] text-black/50 dark:text-white/50 font-bold mt-1 block">
                      Ti scriveremo o chiameremo a questo numero per concordare il colloquio.
                    </span>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-black dark:text-white mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="es. mario.rossi@email.it"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full border-3 border-[#3D2045] bg-[var(--bg-color)] px-3.5 py-2.5 font-bold text-sm text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors"
                    />
                  </div>

                  {/* Settore di interesse */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-black dark:text-white mb-1">
                      Settore in cui vuoi lavorare *
                    </label>
                    <select
                      required
                      value={settore}
                      onChange={e => setSettore(e.target.value)}
                      className="w-full border-3 border-[#3D2045] bg-[var(--bg-color)] px-3.5 py-2.5 font-bold text-xs sm:text-sm text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors"
                    >
                      <option value="">-- Seleziona il settore --</option>
                      {SETTORI_LIST.map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tedesco & Disponibilità (Grid 2 colonne) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-black dark:text-white mb-1">
                        Livello di Tedesco
                      </label>
                      <select
                        value={tedesco}
                        onChange={e => setTedesco(e.target.value)}
                        className="w-full border-3 border-[#3D2045] bg-[var(--bg-color)] px-2.5 py-2 font-bold text-xs text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors"
                      >
                        {LIVELLI_TEDESCO.map(l => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-black dark:text-white mb-1">
                        Disponibilità
                      </label>
                      <select
                        value={disponibilita}
                        onChange={e => setDisponibilita(e.target.value)}
                        className="w-full border-3 border-[#3D2045] bg-[var(--bg-color)] px-2.5 py-2 font-bold text-xs text-black dark:text-white outline-none focus:border-[#6E4274] transition-colors"
                      >
                        {DISPONIBILITA_LIST.map(d => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Patente B */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-black dark:text-white mb-1">
                      Hai la Patente di Guida?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Sì (Patente B)', 'No (Senza Patente)'].map(opt => (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => setPatente(opt)}
                          className={`py-2 px-3 text-xs font-black border-2 border-[#3D2045] transition-all text-center ${
                            patente === opt
                              ? 'bg-[#6E4274] text-white shadow-[2px_2px_0px_#3D2045]'
                              : 'bg-[var(--bg-color)] text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Messaggio o note */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-black dark:text-white mb-1">
                      Note o Esperienze precedenti (Opzionale)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Es. Esperienza come muratore / pizzaiolo da 4 anni..."
                      value={messaggio}
                      onChange={e => setMessaggio(e.target.value)}
                      className="w-full border-3 border-[#3D2045] bg-[var(--bg-color)] px-3.5 py-2 font-bold text-xs text-black dark:text-white outline-none focus:border-[#6E4274] resize-none"
                    />
                  </div>

                  {/* Privacy Checkbox */}
                  <div className="flex items-start gap-2.5 mt-1">
                    <input
                      type="checkbox"
                      id="privacy"
                      required
                      checked={privacyAccepted}
                      onChange={e => setPrivacyAccepted(e.target.checked)}
                      className="mt-1 w-4 h-4 cursor-pointer accent-[#6E4274]"
                    />
                    <label htmlFor="privacy" className="text-[11px] font-bold text-black/70 dark:text-white/70 leading-snug cursor-pointer">
                      Dichiaro di aver letto e accetto l'informativa sulla{' '}
                      <Link to="/privacy-policy" target="_blank" className="text-[#6E4274] underline font-black">
                        Privacy Policy
                      </Link>{' '}
                      per essere ricontattato in merito alle offerte di lavoro.
                    </label>
                  </div>

                  {/* Pulsante Invia CTA Google Ads */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="comic-button w-full bg-[#25D366] text-white py-4 sm:py-4.5 text-sm sm:text-base font-black uppercase tracking-wider border-4 border-[#3D2045] shadow-[4px_4px_0px_#3D2045] hover:bg-green-600 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin" /> INVIO IN CORSO...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane" /> INVIA CANDIDATURA GRATUITA
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-3 text-[11px] font-black text-black/60 dark:text-white/60 text-center uppercase tracking-wider mt-1">
                    <span>🔒 Nessun costo</span> &bull; <span>🛡️ Dati protetti</span> &bull; <span>⚡ Risposta veloce</span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── COME FUNZIONA IN 3 SEMPLICI PASSI ─── */}
      <section className="py-16 sm:py-20 bg-[var(--card-bg)] border-b-8 border-[#3D2045]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="bg-[#6E4274] text-white px-3 py-1 font-black text-xs uppercase tracking-widest border-2 border-[#3D2045]">
              Semplice e Veloce
            </span>
            <h2 className="text-2xl sm:text-4xl font-heading font-black uppercase text-black dark:text-white mt-3 tracking-tight">
              Come Funziona il Nostro Metodo
            </h2>
            <p className="text-sm sm:text-base font-bold text-black/70 dark:text-white/70 mt-2">
              Dalla tua candidatura all'arrivo in Germania in totale sicurezza.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Compila il Modulo',
                desc: 'Inserisci i tuoi dati e il settore in cui cerchi lavoro. Il nostro team analizza il tuo profilo entro 24 ore.',
                icon: 'fa-wpforms',
                color: '#6E4274',
              },
              {
                step: '02',
                title: 'Colloquio Conoscitivo',
                desc: 'Ti chiamiamo al telefono o su WhatsApp per spiegarti le posizioni disponibili, lo stipendio esatto e le foto dell\'alloggio.',
                icon: 'fa-phone-volume',
                color: '#FF6B35',
              },
              {
                step: '03',
                title: 'Partenza e Inizio Lavoro',
                desc: 'Arrivi in Germania, prendi possesso dell\'alloggio e inizi il tuo nuovo percorso con contratto tedesco e stipendio a norma.',
                icon: 'fa-plane-arrival',
                color: '#25D366',
              },
            ].map((s, idx) => (
              <div
                key={idx}
                className="comic-card border-4 border-[#3D2045] p-6 sm:p-8 bg-[var(--bg-color)] shadow-[6px_6px_0px_#3D2045] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="text-white text-xs font-black px-3 py-1 border-2 border-[#3D2045] shadow-[2px_2px_0px_#3D2045]"
                      style={{ background: s.color }}
                    >
                      PASSO {s.step}
                    </span>
                    <i className={`fas ${s.icon} text-2xl text-black/30 dark:text-white/30`} />
                  </div>
                  <h3 className="text-xl font-heading font-black uppercase text-black dark:text-white mb-2">
                    {s.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-black/70 dark:text-white/70 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOTO SEDE E CHI SIAMO ─── */}
      <section className="py-16 sm:py-20 border-b-8 border-[#3D2045] bg-[var(--bg-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="bg-[#ffdf20] text-[#3D2045] px-3 py-1 font-black text-xs uppercase tracking-widest border-2 border-[#3D2045]">
                Trasparenza Totale
              </span>
              <h2 className="text-2xl sm:text-4xl font-heading font-black uppercase text-black dark:text-white mt-3 tracking-tight">
                Una Sede Reale, Persone Vere.
              </h2>
              <p className="text-sm sm:text-base font-bold text-black/70 dark:text-white/70 mt-3 leading-relaxed">
                A differenza di annunci anonimi su Facebook o portali poco chiari, LBS è un'azienda con uffici fisici a Catania e una presenza operativa costante in Germania.
              </p>

              <div className="flex flex-col gap-3 mt-6">
                {[
                  'Sede legale e uffici operativi aperti al pubblico',
                  'Contratti di lavoro firmati direttamente con le aziende tedesche',
                  'Accompagnamento burocratico: registrazione anagrafica (Anmeldung) e codice fiscale tedesco',
                  'Supporto continuativo per tutta la durata del tuo rapporto di lavoro',
                ].map((point, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-[#25D366] text-white border-2 border-[#3D2045] flex items-center justify-center font-black text-xs flex-shrink-0">
                      ✓
                    </div>
                    <span className="text-xs sm:text-sm font-black text-black dark:text-white">{point}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={() => setShowWaModal(true)}
                  className="comic-button bg-[#25D366] text-white py-3 px-6 text-xs sm:text-sm font-black flex items-center gap-2 border-[#3D2045] shadow-[4px_4px_0px_#3D2045]"
                >
                  <i className="fab fa-whatsapp text-lg" /> Parla con un Consulente LBS
                </button>
                <a
                  href="#modulo-candidatura"
                  className="comic-button bg-[#6E4274] text-white py-3 px-6 text-xs sm:text-sm font-black flex items-center gap-2 border-[#3D2045] shadow-[4px_4px_0px_#3D2045]"
                >
                  <i className="fas fa-arrow-up" /> Torna al Modulo
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="comic-card border-4 border-[#3D2045] shadow-[4px_4px_0px_#3D2045] overflow-hidden">
                <img
                  src="/img/ufficio_reception.jpg"
                  alt="Ufficio LBS Reception"
                  className="w-full h-44 sm:h-56 object-cover hover:scale-105 transition-transform duration-300"
                />
                <div className="p-3 bg-[var(--card-bg)] text-[11px] font-black uppercase text-center border-t-2 border-[#3D2045]">
                  I Nostri Uffici
                </div>
              </div>

              <div className="comic-card border-4 border-[#3D2045] shadow-[4px_4px_0px_#3D2045] overflow-hidden">
                <img
                  src="/img/salvatore_desk.jpg"
                  alt="Salvatore Cucuzza al lavoro"
                  className="w-full h-44 sm:h-56 object-cover hover:scale-105 transition-transform duration-300"
                />
                <div className="p-3 bg-[var(--card-bg)] text-[11px] font-black uppercase text-center border-t-2 border-[#3D2045]">
                  Consulenza Diretta
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DOMANDE FREQUENTI (FAQ PER ADS) ─── */}
      <section className="py-16 sm:py-20 bg-[var(--card-bg)] border-b-8 border-[#3D2045]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="bg-[#6E4274] text-white px-3 py-1 font-black text-xs uppercase tracking-widest border-2 border-[#3D2045]">
              FAQ
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase text-black dark:text-white mt-3 tracking-tight">
              Domande Frequenti dei Candidati
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {[
              {
                q: 'È obbligatorio sapere la lingua tedesca?',
                a: 'No! In molti settori (ad esempio edilizia, cucine, pizzerie, magazzino e logistica) si lavora all\'interno di squadre italiane o con responsabili bilingue. Se invece parli già un po\' di tedesco avrai accesso a posizioni ancora più remunerative.',
              },
              {
                q: 'Come funziona l\'alloggio garantito?',
                a: 'Tutte le offerte che proponiamo includono la disponibilità di alloggi selezionati, arredati e vicini al posto di lavoro, spesso con trattenuta agevolata direttamente dalla busta paga.',
              },
              {
                q: 'Ci sono costi per candidarsi o inviare il modulo?',
                a: 'Assolutamente NO. La registrazione, l\'invio del modulo e i colloqui conoscitivi con il nostro team sono gratuiti al 100%.',
              },
              {
                q: 'Quando vengo ricontattato dopo aver compilato il modulo?',
                a: 'Un nostro consulente della sede di Catania o Germania ti contatterà al numero di telefono/WhatsApp indicato entro 24 ore lavorative per verificare insieme il tuo profilo.',
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="comic-card border-3 border-[#3D2045] p-5 bg-[var(--bg-color)] shadow-[4px_4px_0px_#3D2045]"
              >
                <h4 className="font-heading font-black text-sm sm:text-base uppercase text-black dark:text-white mb-2 flex items-center gap-2">
                  <span className="text-[#6E4274] font-black text-lg">Q.</span> {faq.q}
                </h4>
                <p className="text-xs sm:text-sm font-bold text-black/70 dark:text-white/70 leading-relaxed pl-6">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>

          {/* Box Call to Action finale */}
          <div className="text-center mt-12">
            <a
              href="#modulo-candidatura"
              className="comic-button inline-flex items-center gap-3 bg-[#25D366] text-white py-4 px-8 text-sm sm:text-base font-black uppercase tracking-wider border-4 border-[#3D2045] shadow-[6px_6px_0px_#3D2045] hover:bg-green-600 transition-all cursor-pointer"
            >
              <i className="fas fa-arrow-up" /> VOGLIO CANDIDARMI ORA &bull; POSTI LIMITATI
            </a>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ESSENZIALE PER ADS ─── */}
      <footer className="py-8 bg-[var(--card-bg)] text-center text-xs font-bold text-black/60 dark:text-white/60">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            &copy; {new Date().getFullYear()} LBS Business &amp; Servizi di Salvatore Cucuzza &bull; P.IVA / Cod. Fiscale
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="hover:underline font-black">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link to="/cookie-policy" className="hover:underline font-black">
              Cookie Policy
            </Link>
            <span>&bull;</span>
            <Link to="/termini-e-condizioni" className="hover:underline font-black">
              Termini
            </Link>
          </div>
        </div>
      </footer>

      {/* ─── MODALE DI SUCCESSO (THANK YOU) ─── */}
      {success && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="comic-card border-8 border-[#3D2045] bg-[var(--card-bg)] max-w-lg w-full p-6 sm:p-10 text-center shadow-[12px_12px_0px_#3D2045] animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-[#25D366] text-white border-4 border-[#3D2045] flex items-center justify-center text-4xl mx-auto mb-6 shadow-[4px_4px_0px_#3D2045]">
              <i className="fas fa-check" />
            </div>

            <span className="bg-[#25D366] text-white text-[11px] font-black px-3 py-1 uppercase tracking-widest border-2 border-[#3D2045]">
              Candidatura Inviata
            </span>

            <h3 className="text-2xl sm:text-3xl font-heading font-black uppercase text-black dark:text-white mt-4 tracking-tight">
              Grazie, {nome}!
            </h3>

            <p className="text-sm font-bold text-black/70 dark:text-white/70 mt-3 leading-relaxed">
              Abbiamo ricevuto la tua candidatura per il settore <strong>{settore}</strong>. Il nostro team la prenderà in carico e ti contatterà al numero <strong>{telefono}</strong> entro 24 ore lavorative.
            </p>

            <div className="p-4 bg-[var(--bg-color)] border-3 border-[#3D2045] mt-6 text-left">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#6E4274] block mb-1">
                ⚡ Vuoi velocizzare la tua pratica?
              </span>
              <p className="text-xs font-bold text-black/80 dark:text-white/80 leading-relaxed m-0">
                Puoi scriverci direttamente su WhatsApp per avvisarci del tuo invio o allegare il tuo CV aggiornato.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <a
                href={`https://wa.me/393518818391?text=${encodeURIComponent(
                  `Salve, sono ${nome} ${cognome}. Ho appena inviato la mia candidatura dal sito per il settore ${settore}. Vorrei maggiori informazioni.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="comic-button bg-[#25D366] text-white py-3 px-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 border-3 border-[#3D2045] flex-1 hover:bg-green-600"
              >
                <i className="fab fa-whatsapp text-lg" /> SCRIVICI SU WHATSAPP
              </a>

              <button
                onClick={() => {
                  setSuccess(false);
                  setNome('');
                  setCognome('');
                  setEmail('');
                  setTelefono('');
                  setMessaggio('');
                  setSettore('');
                }}
                className="py-3 px-4 border-3 border-[#3D2045] text-xs font-black uppercase hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />
    </div>
  );
};

export default Candidati;
