import React from 'react';
import { Link } from 'react-router-dom';

const NoteLegali: React.FC = () => {
  const lastUpdate = '03 Luglio 2025';
  return (
    <div className="pt-32 sm:pt-36 pb-24">
      <div className="max-w-4xl mx-auto px-6">

        {/* Header */}
        <div className="mb-12 rounded-[2rem] surface-plum p-8 sm:p-12 md:p-16 overflow-hidden">
          <div className="chip chip-sun mb-6">
            Informativa Legale
          </div>
          <h1 className="h-display text-4xl md:text-6xl text-white mb-4">
            Note<br /><span className="text-sun-400">Legali</span>
          </h1>
          <p className="text-white/65 text-sm">
            Ultimo aggiornamento: {lastUpdate} — Ai sensi dell'Art. 10 D.Lgs. 70/2003
          </p>
        </div>

        <div className="space-y-10">

          <section className="card p-6 sm:p-8">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-plum-800 mb-6 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-plum-600 text-white flex items-center justify-center font-heading font-bold text-sm flex-shrink-0">1</span>
              Ragione Sociale e Sede Legale
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Denominazione', value: 'LBS – Lavoro Business e Servizi in Germania' },
                { label: 'Tipo di Attività', value: 'Agenzia di Intermediazione Lavorativa' },
                { label: 'Sede Legale Germania (Non aperta al pubblico)', value: 'Henkelstraße 7 — 34127 Kassel — Germania' },
                { label: 'Sede Operativa Italia', value: 'Viale Vittorio Veneto, 335 — Catania, 95126 (CT) — Italia' },
                { label: 'Email', value: 'info@lbswork.com', href: 'mailto:info@lbswork.com' },
                { label: 'Telefono Italia', value: '+39 351 881 8391', href: 'tel:+393518818391' },
                { label: 'WhatsApp Germania', value: '+49 1573 9037885', href: 'https://wa.me/4915739037885' },
              ].map((item, i) => (
                <div key={i} className="bg-plum-50 rounded-xl border border-line p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-plum-600 mb-1">{item.label}</div>
                  {item.href
                    ? <a href={item.href} className="text-sm font-semibold text-plum-800 hover:text-plum-600 transition-colors">{item.value}</a>
                    : <div className="text-sm font-semibold text-plum-800">{item.value}</div>
                  }
                </div>
              ))}
            </div>
          </section>

          <section className="card p-6 sm:p-8">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-plum-800 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-plum-600 text-white flex items-center justify-center font-heading font-bold text-sm flex-shrink-0">2</span>
              Responsabile del Sito
            </h2>
            <p className="text-ink-soft leading-relaxed text-sm">
              Il responsabile della gestione e dei contenuti del sito web <strong className="text-plum-800">lbswork.com</strong> è la direzione di LBS – Lavoro Business e Servizi in Germania. Per segnalazioni relative ai contenuti del sito o per richiedere la rimozione di informazioni, contattare: <a href="mailto:info@lbswork.com" className="text-plum-600 underline">info@lbswork.com</a>.
            </p>
          </section>


          <section className="card p-6 sm:p-8">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-plum-800 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-plum-600 text-white flex items-center justify-center font-heading font-bold text-sm flex-shrink-0">3</span>
              Proprietà Intellettuale e Copyright
            </h2>
            <p className="text-ink-soft leading-relaxed text-sm">
              © {new Date().getFullYear()} LBS – Lavoro Business e Servizi in Germania. Tutti i diritti riservati.<br /><br />
              Tutti i contenuti del presente sito — inclusi testi, grafica, loghi, icone, immagini, clip audio, download digitali e compilazioni di dati — sono di proprietà di LBS o dei suoi fornitori di contenuti e sono protetti dalle leggi italiane e internazionali sul diritto d'autore. La riproduzione, distribuzione, trasmissione, riutilizzo o comunicazione al pubblico dei contenuti di questo sito è vietata senza previa autorizzazione scritta di LBS.
            </p>
          </section>

          <section className="card p-6 sm:p-8">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-plum-800 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-plum-600 text-white flex items-center justify-center font-heading font-bold text-sm flex-shrink-0">4</span>
              Disclaimer e Limitazioni
            </h2>
            <p className="text-ink-soft leading-relaxed text-sm">
              Le informazioni contenute in questo sito hanno carattere puramente informativo. LBS si impegna a mantenere le informazioni aggiornate e accurate, ma non rilascia dichiarazioni o garanzie di alcun tipo, esplicite o implicite, circa la completezza, accuratezza, affidabilità o disponibilità del sito. LBS non è responsabile per danni derivanti dall'utilizzo o dall'impossibilità di utilizzo del sito.
            </p>
          </section>

          <section className="card p-6 sm:p-8">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-plum-800 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-plum-600 text-white flex items-center justify-center font-heading font-bold text-sm flex-shrink-0">5</span>
              Legge Applicabile
            </h2>
            <p className="text-ink-soft leading-relaxed text-sm">
              Le presenti Note Legali sono regolate dalla legge della Repubblica Italiana. Per qualsiasi controversia inerente al sito web, il foro competente è quello di <strong className="text-plum-800">Catania (CT) — Italia</strong>, salvo diverse disposizioni inderogabili di legge a tutela del consumatore.
            </p>
          </section>

          {/* Links */}
          <div className="flex flex-wrap gap-4">
            <Link to="/privacy-policy" className="btn btn-primary">
              <i className="fas fa-shield-alt" /> Privacy Policy
            </Link>
            <Link to="/cookie-policy" className="btn btn-dark">
              <i className="fas fa-cookie-bite" /> Cookie Policy
            </Link>
            <Link to="/termini-e-condizioni" className="btn btn-outline">
              <i className="fas fa-file-contract" /> Termini e Condizioni
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteLegali;
