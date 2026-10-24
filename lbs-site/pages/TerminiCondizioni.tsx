import React from 'react';
import { Link } from 'react-router-dom';

const TerminiCondizioni: React.FC = () => {
  const lastUpdate = '03 Luglio 2025';
  return (
    <div className="pt-32 pb-24 bg-transparent">
      <div className="max-w-4xl mx-auto px-6">

        {/* Header */}
        <div className="mb-12 border-8 border-[#3D2045] bg-[#6E4274] p-10 md:p-16" style={{ boxShadow: '8px 8px 0px #3D2045' }}>
          <div className="inline-block bg-yellow-300 text-[#3D2045] px-4 py-2 font-black text-xs tracking-[0.3em] uppercase border-4 border-[#3D2045] mb-6">
            Informativa Legale
          </div>
          <h1 className="text-4xl md:text-6xl font-heading font-black text-white tracking-tighter uppercase mb-4">
            Termini e<br /><span className="text-yellow-300">Condizioni</span>
          </h1>
          <p className="text-white/70 font-bold text-sm uppercase tracking-widest">
            Ultimo aggiornamento: {lastUpdate}
          </p>
        </div>

        <div className="space-y-10">

          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">1</span>
              Informazioni sul Servizio
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm">
              <strong className="text-[#3D2045]">LBS – Lavoro Business e Servizi in Germania</strong> (di seguito "LBS") è un'agenzia di intermediazione lavorativa con sede in Viale Vittorio Veneto, 335 — Catania, 95126 (CT) — Italia. LBS opera come intermediario tra lavoratori italiani e aziende tedesche, fornendo servizi di collocamento, consulenza, supporto burocratico e assistenza pre e post-partenza.
            </p>
          </section>

          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">2</span>
              Accettazione dei Termini
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm">
              L'utilizzo del sito web <strong className="text-[#3D2045]">lbswork.com</strong> e l'invio di qualsiasi modulo di contatto o candidatura implica l'accettazione integrale dei presenti Termini e Condizioni. Se non accetti i presenti termini, ti invitiamo a non utilizzare il sito.
            </p>
          </section>

          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">3</span>
              Servizio per i Lavoratori — Modalità e Condizioni
            </h2>
            <div className="space-y-3 text-sm font-bold text-black/70 leading-relaxed">
              <div className="bg-yellow-50 border-4 border-yellow-300 p-4">
                <p className="text-[#3D2045] font-black flex items-start gap-3">
                  <i className="fas fa-handshake text-[#6E4274] mt-0.5" />
                  <span>Il servizio offerto da LBS ai lavoratori comprende <strong>orientamento professionale, supporto all'inserimento e assistenza continua</strong> durante tutte le fasi del percorso verso l'impiego in Germania.</span>
                </p>
              </div>
              <ul className="space-y-2">
                {[
                  'Il servizio include: assistenza burocratica, supporto nella ricerca dell\'alloggio, assistenza durante il trasferimento, traduzioni e supporto d\'emergenza.',
                  'Tutti i dettagli relativi al rapporto di lavoro vengono concordati direttamente tramite contratto ufficiale con l\'azienda datrice di lavoro.',
                  'LBS garantisce la massima trasparenza operativa e il supporto costante per agevolare l\'inserimento nel contesto lavorativo tedesco.',
                  'Il servizio è svolto nel pieno rispetto della normativa vigente e della tutela del lavoratore.',
                  'LBS si impegna attivamente a proporre le migliori opportunità occupazionali compatibili con il profilo del candidato.',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 bg-[#6E4274] border-2 border-[#3D2045] flex items-center justify-center text-white text-[10px] flex-shrink-0 mt-0.5">
                      <i className="fas fa-check" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">4</span>
              Obblighi del Candidato
            </h2>
            <ul className="space-y-2 text-sm font-bold text-black/70">
              {[
                'Fornire informazioni veritiere, complete e aggiornate nel modulo di candidatura.',
                'Comunicare tempestivamente qualsiasi variazione dei propri dati o della propria disponibilità.',
                'Non utilizzare il sito per scopi illeciti o contrari ai presenti termini.',
                'Mantenere riservate le credenziali di accesso all\'area personale (se applicabile).',
                'Rispettare le condizioni contrattuali con il datore di lavoro tedesco.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 bg-[#6E4274] border-2 border-[#3D2045] flex items-center justify-center text-white text-[10px] flex-shrink-0 mt-0.5">
                    <i className="fas fa-check" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">5</span>
              Limitazione di Responsabilità
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm">
              LBS agisce come intermediario e non è parte del contratto di lavoro tra il lavoratore e il datore di lavoro tedesco. LBS non è responsabile per: il contenuto delle offerte di lavoro dei datori di lavoro partner, l'esito del rapporto di lavoro, eventuali inadempimenti contrattuali del datore di lavoro, costi aggiuntivi non preventivati (es. spese di soggiorno straordinarie). LBS si riserva il diritto di sospendere il servizio a candidati che forniscano informazioni false.
            </p>
          </section>

          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">6</span>
              Proprietà Intellettuale
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm">
              Tutti i contenuti del sito (testi, immagini, logo, design, codice) sono di proprietà di LBS o concessi in licenza. È vietata la riproduzione, distribuzione o utilizzo commerciale di qualsiasi contenuto senza autorizzazione scritta.
            </p>
          </section>

          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">7</span>
              Legge Applicabile e Foro Competente
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm">
              I presenti Termini e Condizioni sono regolati dalla legge italiana. Per qualsiasi controversia relativa all'utilizzo del sito o ai servizi offerti da LBS, il foro competente è quello di <strong className="text-[#3D2045]">Catania (CT)</strong>, salvo diversi obblighi di legge applicabili al consumatore.
            </p>
          </section>

          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">8</span>
              Modifiche ai Termini
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm">
              LBS si riserva il diritto di modificare i presenti Termini e Condizioni in qualsiasi momento. Le modifiche saranno pubblicate su questa pagina e avranno effetto immediato dalla data di pubblicazione. L'utilizzo continuato del sito dopo la pubblicazione delle modifiche costituisce accettazione delle stesse.
            </p>
          </section>

          {/* Links */}
          <div className="flex flex-wrap gap-4">
            <Link to="/privacy-policy" className="comic-button bg-[#6E4274] text-white border-[#3D2045] px-6 py-3 text-sm flex items-center gap-2">
              <i className="fas fa-shield-alt" /> Privacy Policy
            </Link>
            <Link to="/cookie-policy" className="comic-button bg-[#3D2045] text-white border-[#3D2045] px-6 py-3 text-sm flex items-center gap-2">
              <i className="fas fa-cookie-bite" /> Cookie Policy
            </Link>
            <Link to="/note-legali" className="comic-button-secondary border-[#3D2045] text-[#3D2045] px-6 py-3 text-sm flex items-center gap-2">
              <i className="fas fa-balance-scale" /> Note Legali
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminiCondizioni;
