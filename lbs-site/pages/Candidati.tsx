import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import logoLBS from '../img/logo_LBS-192.png';
import { supabase } from '../lib/supabaseClient';
import { WhatsAppModal } from '../components/WhatsAppModal';

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

  const VANTAGGI = [
    { icon: 'fa-home', text: 'Alloggio già pronto all\'arrivo', desc: 'Camere o appartamenti arredati' },
    { icon: 'fa-file-signature', text: 'Contratto a tempo indeterminato', desc: 'Sanità, contributi e ferie pagate' },
    { icon: 'fa-euro-sign', text: 'Stipendi netti da 1.800€ a 3.500€+', desc: 'Puntuali ogni mese sul tuo conto' },
    { icon: 'fa-language', text: 'Tedesco NON sempre richiesto', desc: 'Team italiani nei settori più richiesti' },
    { icon: 'fa-user-shield', text: 'Assistenza in loco in italiano', desc: 'Registrazione anagrafe, c/c e codice fiscale' },
    { icon: 'fa-check-circle', text: 'Nessuna spesa di candidatura', desc: 'Selezione trasparente e affidabile' },
  ];

  const PASSI = [
    { step: '01', title: 'Compila il modulo', desc: 'Inserisci i tuoi dati e il settore in cui cerchi lavoro. Il nostro team analizza il tuo profilo entro 24 ore.', icon: 'fa-pen-to-square' },
    { step: '02', title: 'Colloquio conoscitivo', desc: 'Ti chiamiamo al telefono o su WhatsApp per spiegarti le posizioni disponibili, lo stipendio esatto e le foto dell\'alloggio.', icon: 'fa-phone-volume' },
    { step: '03', title: 'Partenza e inizio lavoro', desc: 'Arrivi in Germania, prendi possesso dell\'alloggio e inizi il tuo nuovo percorso con contratto tedesco e stipendio a norma.', icon: 'fa-plane-arrival' },
  ];

  const FAQ = [
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
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* ─── BARRA SUPERIORE SENZA DISTRAZIONI ─── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-line">
        <div className="container-x flex items-center justify-between gap-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoLBS} alt="LBS Lavoro in Germania" className="h-10 w-10" width={40} height={40} />
            <span className="hidden sm:block leading-none">
              <span className="block font-semibold text-plum-800">LBS Work</span>
              <span className="block text-[11px] text-ink-soft mt-0.5">Lavoro in Germania</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden lg:inline-flex chip chip-sun">
              <span className="text-sun-500 tracking-tight" aria-hidden="true">★★★★★</span> Oltre 850+ inserimenti riusciti
            </span>
            <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-sm btn-wa">
              <i className="fab fa-whatsapp text-base" /> <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <a href="tel:+393518818391" className="btn btn-sm btn-outline hidden md:inline-flex">
              <i className="fas fa-phone-alt text-xs text-plum-400" /> +39 351 881 8391
            </a>
          </div>
        </div>
      </header>

      {/* ─── HERO + MODULO ─── */}
      <section className="surface-tint pt-8 sm:pt-14 pb-16 sm:pb-24">
        <div className="container-x">
          <span className="chip chip-sun mb-6"><i className="fas fa-bullhorn" /> Selezioni aperte per cittadini italiani ed europei</span>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-7 flex flex-col gap-6">
              <h1 className="h-display text-plum-800 text-[2.4rem] sm:text-6xl">
                Lavora in Germania: <span className="mark">alloggio garantito</span> e contratto diretto.
              </h1>
              <p className="lead max-w-2xl">
                Trova lavoro sicuro con regolare contratto di lavoro a norma di legge tedesca. Alloggio vicino alla sede di lavoro, supporto burocratico completo e assistenza in italiano h24.
              </p>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {VANTAGGI.map(item => (
                  <li key={item.text} className="flex items-start gap-3 rounded-lg bg-white border border-line p-4">
                    <span className="icon-tile !w-10 !h-10 !rounded-md !bg-wa/15 !text-[#128C4B]"><i className={`fas ${item.icon}`} /></span>
                    <span>
                      <span className="block font-semibold text-plum-800 leading-snug">{item.text}</span>
                      <span className="block text-sm text-ink-soft mt-0.5">{item.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <figure className="card p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <img src="/img/salvatore_hero.jpg" alt="Salvatore Cucuzza - LBS Business" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-full ring-4 ring-sun-400 shrink-0" />
                <div className="text-center sm:text-left">
                  <blockquote className="font-heading text-lg text-plum-800 leading-snug">
                    “Sappiamo quanto sia delicato trasferirsi all'estero. Noi di LBS ti accompagniamo personalmente dal primo colloquio fino alla firma del contratto in Germania. Non sarai mai solo.”
                  </blockquote>
                  <figcaption className="text-sm text-ink-soft mt-3">Salvatore Cucuzza · Fondatore LBS</figcaption>
                </div>
              </figure>
            </div>

            {/* MODULO */}
            <div id="modulo-candidatura" className="lg:col-span-5 w-full lg:sticky lg:top-24 scroll-mt-24">
              <div className="bg-white rounded-lg border border-line p-5 sm:p-8 relative">
                <div className="text-center mb-6">
                  <span className="chip !bg-wa/10 !text-[#128C4B] !border-wa/20"><i className="fas fa-bolt text-[10px]" /> Risposta entro 24 ore</span>
                  <h2 className="font-semibold text-2xl sm:text-3xl text-plum-800 tracking-tight mt-3">Candidatura rapida</h2>
                  <p className="text-sm text-ink-soft mt-1">Compila in 60 secondi: verrai ricontattato via WhatsApp o telefono</p>
                </div>

                {errorMessage && (
                  <div role="alert" className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-medium flex items-center gap-2">
                    <i className="fas fa-exclamation-circle shrink-0" />
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="g-nome" className="field-label">Nome *</label>
                      <input id="g-nome" type="text" required autoComplete="given-name" placeholder="Es. Mario" value={nome} onChange={e => setNome(e.target.value)} className="field" />
                    </div>
                    <div>
                      <label htmlFor="g-cognome" className="field-label">Cognome *</label>
                      <input id="g-cognome" type="text" required autoComplete="family-name" placeholder="Es. Rossi" value={cognome} onChange={e => setCognome(e.target.value)} className="field" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="g-tel" className="field-label">Numero telefono / WhatsApp *</label>
                    <div className="relative">
                      <i className="fab fa-whatsapp absolute left-4 top-1/2 -translate-y-1/2 text-[#128C4B]" />
                      <input id="g-tel" type="tel" required autoComplete="tel" placeholder="+39 340 1234567" value={telefono} onChange={e => setTelefono(e.target.value)} className="field !pl-10" />
                    </div>
                    <span className="text-xs text-ink-soft mt-1.5 block">Ti scriveremo o chiameremo a questo numero per concordare il colloquio.</span>
                  </div>

                  <div>
                    <label htmlFor="g-email" className="field-label">Email *</label>
                    <input id="g-email" type="email" required autoComplete="email" placeholder="es. mario.rossi@email.it" value={email} onChange={e => setEmail(e.target.value)} className="field" />
                  </div>

                  <div>
                    <label htmlFor="g-settore" className="field-label">Settore in cui vuoi lavorare *</label>
                    <select id="g-settore" required value={settore} onChange={e => setSettore(e.target.value)} className="field">
                      <option value="">Seleziona il settore</option>
                      {SETTORI_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="g-de" className="field-label">Livello di tedesco</label>
                      <select id="g-de" value={tedesco} onChange={e => setTedesco(e.target.value)} className="field !text-sm">
                        {LIVELLI_TEDESCO.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="g-disp" className="field-label">Disponibilità</label>
                      <select id="g-disp" value={disponibilita} onChange={e => setDisponibilita(e.target.value)} className="field !text-sm">
                        {DISPONIBILITA_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  <fieldset>
                    <legend className="field-label">Hai la patente di guida?</legend>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-plum-50">
                      {['Sì (Patente B)', 'No (Senza Patente)'].map(opt => (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => setPatente(opt)}
                          aria-pressed={patente === opt}
                          className={`min-h-[44px] rounded-xl text-sm font-semibold transition-colors cursor-pointer ${ patente === opt ? 'bg-white text-plum-800 shadow-sm' : 'text-ink-soft hover:text-plum-800' }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label htmlFor="g-note" className="field-label">Note o esperienze precedenti (opzionale)</label>
                    <textarea id="g-note" rows={2} placeholder="Es. Esperienza come muratore / pizzaiolo da 4 anni..." value={messaggio} onChange={e => setMessaggio(e.target.value)} className="field !min-h-[80px]" />
                  </div>

                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="privacy"
                      required
                      checked={privacyAccepted}
                      onChange={e => setPrivacyAccepted(e.target.checked)}
                      className="mt-0.5 w-5 h-5 cursor-pointer accent-[#6E4274] shrink-0"
                    />
                    <label htmlFor="privacy" className="text-sm text-ink-soft leading-snug cursor-pointer">
                      Dichiaro di aver letto e accetto l'informativa sulla{' '}
                      <Link to="/privacy-policy" target="_blank" className="text-plum-600 underline font-semibold">Privacy Policy</Link>{' '}
                      per essere ricontattato in merito alle offerte di lavoro.
                    </label>
                  </div>

                  <button type="submit" disabled={loading} className="btn btn-lg btn-wa w-full mt-1">
                    {loading
                      ? <><i className="fas fa-spinner fa-spin" /> Invio in corso...</>
                      : <><i className="fas fa-paper-plane" /> Invia candidatura gratuita</>}
                  </button>

                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                    <span><i className="fas fa-lock text-plum-300 mr-1" /> Nessun costo</span>
                    <span><i className="fas fa-shield-alt text-plum-300 mr-1" /> Dati protetti</span>
                    <span><i className="fas fa-bolt text-plum-300 mr-1" /> Risposta veloce</span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── COME FUNZIONA ─── */}
      <section className="section">
        <div className="container-x">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="eyebrow">Semplice e veloce</span>
            <h2 className="h-section text-plum-800 mt-4">Come funziona il nostro metodo</h2>
            <p className="lead mt-3">Dalla tua candidatura all'arrivo in Germania in totale sicurezza.</p>
          </div>
          <ol className="grid-lines grid-cols-1 md:grid-cols-3">
            {PASSI.map(s => (
              <li key={s.step} className="p-7 sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-plum-600 tabular-nums">{s.step}</span>
                  <i className={`fas ${s.icon} text-plum-300`} />
                </div>
                <h3 className="font-semibold text-xl text-plum-800 mt-6">{s.title}</h3>
                <p className="text-ink-soft leading-relaxed mt-2">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── SEDE REALE ─── */}
      <section className="pb-20 md:pb-28">
        <div className="container-x grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="eyebrow">Trasparenza totale</span>
            <h2 className="h-section text-plum-800 mt-4">Una sede reale, persone vere.</h2>
            <p className="lead mt-4">
              A differenza di annunci anonimi su Facebook o portali poco chiari, LBS è un'azienda con uffici fisici a Catania e una presenza operativa costante in Germania.
            </p>
            <ul className="flex flex-col gap-3 mt-6">
              {[
                'Sede legale e uffici operativi aperti al pubblico',
                'Contratti di lavoro firmati direttamente con le aziende tedesche',
                'Accompagnamento burocratico: registrazione anagrafica (Anmeldung) e codice fiscale tedesco',
                'Supporto continuativo per tutta la durata del tuo rapporto di lavoro',
              ].map(point => (
                <li key={point} className="flex items-start gap-3 text-ink">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-wa text-white flex items-center justify-center text-[9px] shrink-0"><i className="fas fa-check" /></span>
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-lg btn-wa">
                <i className="fab fa-whatsapp text-lg" /> Parla con un consulente LBS
              </button>
              <a href="#modulo-candidatura" className="btn btn-lg btn-outline">
                <i className="fas fa-arrow-up text-xs text-plum-400" /> Torna al modulo
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <figure className="relative overflow-hidden rounded-xl aspect-[3/4]">
              <img src="/img/ufficio_reception.jpg" alt="Ufficio LBS Reception" loading="lazy" className="w-full h-full object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-plum-950/80 to-transparent text-white font-semibold text-sm">I nostri uffici</figcaption>
            </figure>
            <figure className="relative overflow-hidden rounded-xl aspect-[3/4] mt-10">
              <img src="/img/salvatore_desk.jpg" alt="Salvatore Cucuzza al lavoro" loading="lazy" className="w-full h-full object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-plum-950/80 to-transparent text-white font-semibold text-sm">Consulenza diretta</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="section surface-tint">
        <div className="container-x max-w-3xl">
          <div className="text-center mb-10">
            <span className="eyebrow">FAQ</span>
            <h2 className="h-section text-plum-800 mt-4">Domande frequenti dei candidati</h2>
          </div>
          <div className="flex flex-col gap-3">
            {FAQ.map((faq, idx) => (
              <details key={faq.q} className="group card !rounded-lg p-5 sm:p-6 open:border-plum-300" open={idx === 0}>
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-semibold text-lg text-plum-800 [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="h-9 w-9 rounded-md bg-plum-50 text-plum-600 flex items-center justify-center shrink-0 transition-transform group-open:rotate-45">
                    <i className="fas fa-plus text-sm" />
                  </span>
                </summary>
                <p className="text-ink-soft leading-relaxed mt-3">{faq.a}</p>
              </details>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="#modulo-candidatura" className="btn btn-lg btn-wa">
              <i className="fas fa-arrow-up text-xs" /> Voglio candidarmi ora · posti limitati
            </a>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ESSENZIALE ─── */}
      <footer className="py-8 border-t border-line text-sm text-ink-soft">
        <div className="container-x flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>&copy; {new Date().getFullYear()} LBS Business &amp; Servizi di Salvatore Cucuzza</div>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="hover:text-plum-800">Privacy Policy</Link>
            <Link to="/cookie-policy" className="hover:text-plum-800">Cookie Policy</Link>
            <Link to="/termini-e-condizioni" className="hover:text-plum-800">Termini</Link>
          </div>
        </div>
      </footer>

      {/* ─── MODALE DI SUCCESSO ─── */}
      {success && (
        <div className="fixed inset-0 bg-plum-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="animate-pop-in bg-white rounded-xl max-w-lg w-full p-7 sm:p-10 text-center shadow-[var(--shadow-lift)]">
            <span className="mx-auto h-20 w-20 rounded-md bg-wa/15 text-[#128C4B] flex items-center justify-center text-3xl">
              <i className="fas fa-check" />
            </span>
            <span className="chip !bg-wa/10 !text-[#128C4B] !border-wa/20 mt-5">Candidatura inviata</span>
            <h3 className="h-display text-3xl text-plum-800 mt-4">Grazie, {nome}!</h3>
            <p className="text-ink-soft mt-3 leading-relaxed">
              Abbiamo ricevuto la tua candidatura per il settore <strong className="text-plum-800">{settore}</strong>. Il nostro team la prenderà in carico e ti contatterà al numero <strong className="text-plum-800">{telefono}</strong> entro 24 ore lavorative.
            </p>
            <div className="rounded-lg bg-sun-100 p-4 mt-6 text-left">
              <span className="text-sm font-semibold text-plum-800 block mb-1"><i className="fas fa-bolt mr-1" /> Vuoi velocizzare la tua pratica?</span>
              <p className="text-sm text-plum-800/75 leading-relaxed m-0">
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
                className="btn btn-lg btn-wa flex-1"
              >
                <i className="fab fa-whatsapp text-lg" /> Scrivici su WhatsApp
              </a>
              <button
                type="button"
                onClick={() => {
                  setSuccess(false);
                  setNome('');
                  setCognome('');
                  setEmail('');
                  setTelefono('');
                  setMessaggio('');
                  setSettore('');
                }}
                className="btn btn-lg btn-outline"
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
