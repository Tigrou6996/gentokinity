
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
        <div className="container-x"><div className="grid-lines grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, idx) => (
            <article
              key={s.id}
              className="reveal p-7 sm:p-9 flex flex-col"
              style={{ transitionDelay: `${idx * 60}ms` }}
            >
              <div>
                <span className="icon-tile"><i className={`fas ${s.icon}`} /></span>
                <h2 className="font-semibold text-xl text-plum-800 tracking-tight mt-7">{s.title}</h2>
                <p className="text-ink-soft leading-relaxed mt-3">{s.description}</p>
              </div>
              <ul className="space-y-2.5 mt-auto pt-6 border-t border-line">
                {s.features.map(f => (
                  <li key={f} className="flex items-start gap-3 text-[15px] text-ink">
                    <span className="mt-1 text-plum-600 text-xs shrink-0">
                      <i className="fas fa-check" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </article>
          ))}
            <div className="p-7 sm:p-9 flex flex-col justify-between bg-plum-50!">
              <span className="text-sm text-ink-soft">Non sai da dove iniziare?</span>
              <Link to="/contatti" className="group mt-10 font-semibold text-lg text-plum-800 flex items-center gap-2">
                Parla con un consulente <i className="fas fa-arrow-right text-sm text-plum-600 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* IN PIÙ */}
      <section className="pb-24 md:pb-32">
        <div className="container-x">
          <div className="rounded-lg surface-plum px-6 py-14 sm:px-12 sm:py-16 overflow-hidden">
            <div className="max-w-2xl mb-12 reveal">
              <span className="eyebrow eyebrow-light">Sempre inclusi</span>
              <h2 className="h-section text-white mt-4">Un unico punto di riferimento, dall'Italia alla Germania.</h2>
            </div>
            <div className="grid-lines-dark grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {EXTRA.map(item => (
                <div key={item.title} className="reveal p-6 sm:p-7">
                  <span className="icon-tile !bg-transparent !border-white/20 !text-sun-400"><i className={`fas ${item.icon}`} /></span>
                  <h3 className="font-semibold text-lg text-white mt-6">{item.title}</h3>
                  <p className="text-white/65 leading-relaxed mt-2 text-[15px]">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 pt-10 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="font-semibold text-2xl text-white">Vuoi sapere qual è il servizio giusto per te?</h3>
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
