import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
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
            Privacy<br /><span className="text-yellow-300">Policy</span>
          </h1>
          <p className="text-white/70 font-bold text-sm uppercase tracking-widest">
            Ultimo aggiornamento: {lastUpdate} — Ai sensi del GDPR (Reg. UE 2016/679)
          </p>
        </div>

        {/* Corpo */}
        <div className="prose-lbs space-y-10">

          {/* 1 */}
          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">1</span>
              Titolare del Trattamento
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm">
              <strong className="text-[#3D2045]">LBS – Lavoro Business e Servizi in Germania</strong><br />
              Viale Vittorio Veneto, 335 — Catania, 95126 (CT) — Italia<br />
              E-mail: <a href="mailto:info@lbswork.com" className="text-[#6E4274] underline">info@lbswork.com</a><br />
              Telefono: <a href="tel:+393518818391" className="text-[#6E4274] underline">+39 351 881 8391</a>
            </p>
          </section>

          {/* 2 */}
          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">2</span>
              Dati Raccolti e Finalità
            </h2>
            <div className="space-y-4 text-black/70 font-bold text-sm leading-relaxed">
              <div className="bg-[#f9f6fa] border-l-4 border-[#6E4274] p-4">
                <strong className="text-[#3D2045] uppercase text-xs tracking-widest">A) Modulo di Candidatura (Lavoratori)</strong><br />
                <span>Dati raccolti: nome, cognome, email, telefono, settore lavorativo, messaggio.</span><br />
                <span>Finalità: valutare la candidatura e contattare il candidato per opportunità lavorative in Germania.</span><br />
                <span>Base giuridica: esecuzione di misure precontrattuali (Art. 6 par. 1 lett. b GDPR).</span>
              </div>
              <div className="bg-[#f9f6fa] border-l-4 border-[#6E4274] p-4">
                <strong className="text-[#3D2045] uppercase text-xs tracking-widest">B) Modulo Richiesta Datori di Lavoro</strong><br />
                <span>Dati raccolti: nome azienda, referente, email, telefono, settore, numero lavoratori richiesti, messaggio.</span><br />
                <span>Finalità: fornire lavoratori qualificati e gestire la relazione commerciale.</span><br />
                <span>Base giuridica: esecuzione di misure precontrattuali (Art. 6 par. 1 lett. b GDPR).</span>
              </div>
              <div className="bg-[#f9f6fa] border-l-4 border-[#6E4274] p-4">
                <strong className="text-[#3D2045] uppercase text-xs tracking-widest">C) Dati di Navigazione (Cookie Analitici)</strong><br />
                <span>Con il tuo consenso, raccogliamo dati anonimi di navigazione tramite Google Analytics (G-434XX8P8NY): pagine visitate, durata della sessione, provenienza geografica, dispositivo utilizzato. Gli IP sono anonimizzati.</span><br />
                <span>Base giuridica: consenso dell'interessato (Art. 6 par. 1 lett. a GDPR).</span>
              </div>
            </div>
          </section>

          {/* 3 */}
          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">3</span>
              Conservazione dei Dati
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm">
              I dati forniti tramite i moduli di contatto vengono conservati per un periodo massimo di <strong className="text-[#3D2045]">24 mesi</strong> dalla raccolta, salvo necessità legate ad obblighi legali o contrattuali. I dati analitici raccolti tramite Google Analytics vengono conservati per <strong className="text-[#3D2045]">14 mesi</strong> secondo le impostazioni predefinite di Google.
            </p>
          </section>

          {/* 4 */}
          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">4</span>
              Destinatari dei Dati
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm mb-3">
              I tuoi dati personali non vengono venduti a terzi. Possono essere condivisi esclusivamente con:
            </p>
            <ul className="space-y-2 text-sm font-bold text-black/70">
              {[
                'Supabase Inc. (USA) — fornitore del database, adeguatamente protetto tramite clausole contrattuali standard EU)',
                'Google LLC (USA) — Google Analytics, solo con consenso, con anonimizzazione IP attiva',
                'Aziende tedesche partner — esclusivamente per finalità di collocamento lavorativo e solo con esplicito consenso del candidato',
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

          {/* 5 */}
          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">5</span>
              I Tuoi Diritti (GDPR Art. 15–22)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: 'fa-eye', title: 'Accesso', desc: 'Richiedere copia dei dati che trattiamo su di te.' },
                { icon: 'fa-pen', title: 'Rettifica', desc: 'Correggere dati inesatti o incompleti.' },
                { icon: 'fa-trash', title: 'Cancellazione', desc: 'Chiedere la cancellazione dei tuoi dati ("diritto all\'oblio").' },
                { icon: 'fa-pause', title: 'Limitazione', desc: 'Limitare il trattamento in determinati casi.' },
                { icon: 'fa-download', title: 'Portabilità', desc: 'Ricevere i tuoi dati in formato leggibile da macchina.' },
                { icon: 'fa-ban', title: 'Opposizione', desc: 'Opporsi al trattamento basato su interesse legittimo.' },
                { icon: 'fa-undo', title: 'Revoca Consenso', desc: 'Revocare in qualsiasi momento il consenso ai cookie analitici.' },
                { icon: 'fa-gavel', title: 'Reclamo', desc: 'Presentare reclamo al Garante per la Privacy (www.garanteprivacy.it).' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-[#f9f6fa] border-2 border-[#6E4274]/30 p-3">
                  <i className={`fas ${item.icon} text-[#6E4274] mt-0.5 w-4 flex-shrink-0`} />
                  <div>
                    <div className="font-black text-[#3D2045] text-xs uppercase tracking-tight">{item.title}</div>
                    <div className="text-black/60 text-xs font-bold leading-snug">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-black/60 text-xs font-bold mt-4">
              Per esercitare i tuoi diritti scrivi a: <a href="mailto:info@lbswork.com" className="text-[#6E4274] underline">info@lbswork.com</a>
            </p>
          </section>

          {/* 6 */}
          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">6</span>
              Trasferimento Dati Extra-UE
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm">
              Alcuni fornitori (Supabase, Google) hanno sede negli USA. Il trasferimento è garantito da adeguate misure di salvaguardia ai sensi dell'Art. 46 GDPR (Standard Contractual Clauses — SCC). Per Google LLC è inoltre applicabile il Data Privacy Framework EU-USA.
            </p>
          </section>

          {/* 7 */}
          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">7</span>
              Sicurezza dei Dati
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm">
              Adottiamo misure tecniche e organizzative appropriate per proteggere i tuoi dati personali da accessi non autorizzati, perdita o distruzione accidentale, in conformità all'Art. 32 GDPR. Il database è gestito tramite Supabase con crittografia in transito (TLS) e a riposo.
            </p>
          </section>

          {/* 8 */}
          <section className="border-4 border-[#3D2045] p-8" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#3D2045] mb-4 flex items-center gap-3">
              <span className="w-8 h-8 bg-[#6E4274] text-white flex items-center justify-center font-black text-sm border-2 border-[#3D2045] flex-shrink-0">8</span>
              Modifiche alla Privacy Policy
            </h2>
            <p className="text-black/70 font-bold leading-relaxed text-sm">
              La presente informativa può essere aggiornata periodicamente. Le modifiche saranno pubblicate su questa pagina con indicazione della data di aggiornamento. Ti invitiamo a consultarla regolarmente.
            </p>
          </section>

          {/* Links */}
          <div className="flex flex-wrap gap-4 mt-4">
            <Link to="/cookie-policy" className="comic-button bg-[#6E4274] text-white border-[#3D2045] px-6 py-3 text-sm flex items-center gap-2">
              <i className="fas fa-cookie-bite" /> Cookie Policy
            </Link>
            <Link to="/termini-e-condizioni" className="comic-button bg-[#3D2045] text-white border-[#3D2045] px-6 py-3 text-sm flex items-center gap-2">
              <i className="fas fa-file-contract" /> Termini e Condizioni
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

export default PrivacyPolicy;
