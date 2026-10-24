
import React from 'react';
import { Link } from 'react-router-dom';
import { SERVICES } from '../constants';
import PageHero from '../components/PageHero';

const EXTRA = [
  { icon: 'fa-building', title: 'Supporto per le imprese', desc: 'Selezioniamo personale motivato e pronto all\'inserimento per la tua azienda in Germania.' },
  { icon: 'fa-handshake', title: 'Collocamento diretto', desc: 'Contratto di lavoro ufficiale e alloggio sicuro prima ancora di partire. Ti seguiamo passo dopo passo.' },
  { icon: 'fa-language', title: 'Traduzioni incluse', desc: 'Le traduzioni sono incluse nella nostra assistenza. CV, contratti, certificati — tutto tradotto senza costi aggiuntivi.' },
  { icon: 'fa-headset', title: 'Assistenza 24/7 in viaggio', desc: 'Siamo con te 24/7 durante il viaggio e in qualsiasi situazione: medico, avvocato, pratiche. Non sei mai solo.' },
];

const Services: React.FC = () => {
  return (
    <div className="overflow-x-hidden">
      <PageHero
        eyebrow="Cosa facciamo"
        title={<>I nostri <span className="mark">servizi</span></>}
        lead={<><strong className="text-plum-800 font-semibold">Ti guidiamo con professionalità e trasparenza.</strong> Dalla selezione del lavoro ideale al contratto ufficiale, dall'alloggio all'assistenza continua in ogni momento.</>}
        actions={
          <>
            <Link to="/contatti" className="btn btn-lg btn-primary">Contattaci gratis <i className="fas fa-arrow-right text-xs" /></Link>
            <Link to="/offerte" className="btn btn-lg btn-outline">Vedi le offerte</Link>
          </>
        }
      />

      {/* SERVIZI */}
      <section className="section !pt-16">
        <div className="container-x grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SERVICES.map((s, idx) => (
            <article
              key={s.id}
              className={`reveal card card-hover p-7 sm:p-9 flex flex-col ${idx === 0 ? 'lg:col-span-2 lg:flex-row lg:items-center lg:gap-10' : ''}`}
              style={{ transitionDelay: `${idx * 60}ms` }}
            >
              <div className={idx === 0 ? 'lg:flex-1' : ''}>
                <span className="icon-tile !w-14 !h-14 !rounded-2xl"><i className={`fas ${s.icon} text-xl`} /></span>
                <h2 className="font-heading font-bold text-2xl text-plum-800 tracking-tight mt-7">{s.title}</h2>
                <p className="text-ink-soft leading-relaxed mt-3">{s.description}</p>
              </div>
              <ul className={`space-y-2.5 ${idx === 0 ? 'mt-7 lg:mt-0 lg:w-80 lg:rounded-2xl lg:bg-plum-50 lg:p-6' : 'mt-7 pt-6 border-t border-line'}`}>
                {s.features.map(f => (
                  <li key={f} className="flex items-start gap-3 text-[15px] text-ink">
                    <span className="mt-0.5 h-5 w-5 rounded-full bg-sun-400 text-plum-800 flex items-center justify-center text-[9px] shrink-0">
                      <i className="fas fa-check" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* IN PIÙ */}
      <section className="pb-24 md:pb-32">
        <div className="container-x">
          <div className="rounded-[2.5rem] surface-plum px-6 py-14 sm:px-12 sm:py-16 overflow-hidden">
            <div className="max-w-2xl mb-12 reveal">
              <span className="eyebrow eyebrow-light">Sempre inclusi</span>
              <h2 className="h-section text-white mt-4">Un unico punto di riferimento, dall'Italia alla Germania.</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {EXTRA.map(item => (
                <div key={item.title} className="reveal card-dark p-6">
                  <span className="icon-tile !bg-sun-400 !text-plum-800"><i className={`fas ${item.icon}`} /></span>
                  <h3 className="font-heading font-bold text-xl text-white mt-6">{item.title}</h3>
                  <p className="text-white/65 leading-relaxed mt-2 text-[15px]">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 pt-10 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="font-heading font-bold text-2xl text-white">Vuoi sapere qual è il servizio giusto per te?</h3>
                <p className="text-white/60 mt-1">Chiamaci o scrivi su WhatsApp. In meno di 24 ore ti diciamo cosa possiamo fare per te.</p>
              </div>
              <Link to="/contatti" className="btn btn-lg btn-accent shrink-0">Contattaci gratis <i className="fas fa-arrow-right text-xs" /></Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Services;
