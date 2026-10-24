
import React from 'react';
import { Link } from 'react-router-dom';
import { SERVICES } from '../constants';
import { Cloud, CircledX, CurvedArrow, Cursor } from '../components/Decorations';

const Services: React.FC = () => {
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
        <div className="text-left pb-8 reveal">
          <div className="text-[#6E4274] font-black text-xs tracking-[0.2em] uppercase mb-3">Cosa Facciamo</div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-heading font-black text-black dark:text-white tracking-tighter">
            I Nostri Servizi
          </h1>
          <p className="text-black/60 dark:text-white/60 mt-4 text-base sm:text-xl font-medium max-w-3xl">
            <strong className="text-[#6E4274]">Ti guidiamo con professionalità e trasparenza.</strong> Dalla selezione del lavoro ideale al contratto ufficiale, dall'alloggio all'assistenza continua in ogni momento.
          </p>
        </div>
        <hr className="border-t border-black/10 dark:border-white/10 mb-16" style={{marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)'}} />

        {/* SERVIZI GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-4 border-[#3D2045] mb-20" style={{boxShadow: '8px 8px 0px #3D2045'}}>
          {SERVICES.map((s, idx) => (
            <div key={s.id} className={`reveal p-7 sm:p-10 border-r-4 border-b-4 border-[#3D2045] group hover:bg-[#6E4274] transition-colors duration-300 bg-[var(--card-bg)] ${idx % 3 === 2 ? 'border-r-0' : ''} ${idx >= 3 ? 'border-b-0' : ''}`}>
              <div className="w-16 h-16 bg-[#6E4274] group-hover:bg-yellow-300 border-4 border-[#3D2045] flex items-center justify-center text-white group-hover:text-[#3D2045] text-2xl mb-8 transition-colors">
                <i className={`fas ${s.icon}`}></i>
              </div>
              <h3 className="text-xl font-heading font-black text-black dark:text-white group-hover:text-white uppercase tracking-tight mb-4 transition-colors">{s.title}</h3>
              <p className="text-black/70 dark:text-white/70 group-hover:text-white/90 leading-relaxed mb-6 font-bold transition-colors">{s.description}</p>
              <ul className="space-y-2">
                {s.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 font-black uppercase text-xs tracking-tight text-black dark:text-white group-hover:text-white transition-colors">
                    <span className="w-5 h-5 bg-yellow-300 group-hover:bg-white border-2 border-[#3D2045] flex items-center justify-center text-[#3D2045] text-[10px] flex-shrink-0">
                      <i className="fas fa-check"></i>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* BANNER INFORMATIVO */}
        <div className="reveal bg-[#6E4274] border-8 border-[#3D2045] p-8 sm:p-12 md:p-16 mb-20" style={{boxShadow: '8px 8px 0px #3D2045'}}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { icon: 'fa-building', title: 'Supporto per le Imprese', desc: 'Selezioniamo personale motivato e pronto all\'inserimento per la tua azienda in Germania.' },
              { icon: 'fa-handshake', title: 'Collocamento Diretto', desc: 'Contratto di lavoro ufficiale e alloggio sicuro prima ancora di partire. Ti seguiamo passo dopo passo.' },
              { icon: 'fa-language', title: 'Traduzioni Incluse', desc: 'Le traduzioni sono incluse nella nostra assistenza. CV, contratti, certificati — tutto tradotto senza costi aggiuntivi.' },
              { icon: 'fa-headset', title: 'Assistenza 24/7 in Viaggio', desc: 'Siamo con te 24/7 durante il viaggio e in qualsiasi situazione: medico, avvocato, pratiche. Non sei mai solo.' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-yellow-300 border-4 border-[#3D2045] flex items-center justify-center text-[#3D2045] text-2xl">
                  <i className={`fas ${item.icon}`}></i>
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{item.title}</h3>
                <p className="text-white/80 font-bold leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="reveal bg-[#3D2045] border-8 border-[#3D2045] p-8 sm:p-12 md:p-20 flex flex-col md:flex-row items-center justify-between gap-8 text-left" style={{boxShadow: '8px 8px 0px #3D2045'}}>
          <div className="flex-1">
            <h2 className="text-3xl md:text-5xl font-heading font-black text-white tracking-tighter mb-4">
              Vuoi sapere qual è il servizio giusto per te?
            </h2>
            <p className="text-white/60 text-lg font-medium max-w-2xl">
              Chiamaci o scrivi su WhatsApp. In meno di 24 ore ti diciamo cosa possiamo fare per te.
            </p>
          </div>
          <Link to="/contatti" className="comic-button bg-yellow-300 text-[#3D2045] border-[#1a0d1e] px-10 py-5 text-lg font-black hover:bg-yellow-200 flex-shrink-0">
            Contattaci Gratis
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Services;
