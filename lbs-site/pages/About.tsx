
import React, { useState } from 'react';
import { TEAM } from '../constants';
import { Cloud, CircledX, CurvedArrow, Cursor } from '../components/Decorations';
import { WhatsAppModal } from '../components/WhatsAppModal';

const About: React.FC = () => {
  const [showWaModal, setShowWaModal] = useState(false);
  return (
    <div className="pt-32 pb-24 bg-transparent overflow-x-hidden relative">
      <div className="absolute inset-0 pointer-events-none z-0">
        <Cloud className="absolute top-40 left-10 w-24 h-24 text-[#6E4274] opacity-15 animate-pulse" />
        <Cloud className="absolute bottom-60 right-10 w-20 h-20 text-[#6E4274] opacity-10" />
        <CircledX className="absolute top-80 right-20 w-14 h-14 text-[#6E4274] opacity-20" />
        <CurvedArrow className="absolute top-[40%] right-[8%] w-16 h-16 text-[#6E4274] opacity-15" />
        <Cursor className="absolute bottom-[30%] left-[5%] w-12 h-12 text-[#6E4274] opacity-10" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">

        {/* HERO CHI SIAMO */}
        <div className="border-8 border-[#3D2045] bg-[#6E4274] mb-20 p-8 sm:p-16 md:p-24 relative overflow-hidden" style={{ boxShadow: '8px 8px 0px #3D2045' }}>
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <Cloud className="absolute top-5 right-10 w-20 h-20 text-white" />
            <CircledX className="absolute bottom-5 left-10 w-16 h-16 text-white" />
          </div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="reveal space-y-8">
              <div className="inline-block bg-yellow-300 text-[#3D2045] px-6 py-2 font-black text-xs tracking-[0.3em] uppercase border-4 border-[#3D2045]">La Nostra Storia</div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-heading font-black text-white leading-tight tracking-tighter uppercase">
                LBS:<br />Nati per<br /><span className="text-yellow-300">Portarti<br />lì.</span>
              </h1>
              <p className="text-xl text-white/90 font-black uppercase tracking-tight leading-relaxed">
                LBS — <strong>Lavoro Business e Servizi in Germania</strong> — nasce con una missione chiara: portare lavoratori italiani in Germania con professionalità, serietà e <strong className="text-yellow-300">assistenza 24/7 durante il viaggio, traduzioni incluse.</strong>
              </p>
            </div>
            <div className="reveal grid grid-cols-2 gap-4">
              {[
                { val: '11+', label: 'Anni di Esperienza' },
                { val: '1000+', label: 'Lavoratori Collocati' },
                { val: '500+', label: 'Aziende Partner' },
                { val: '100%', label: 'Supporto e Assistenza' },
              ].map((s, i) => (
                <div key={i} className="bg-white/10 border-4 border-white/30 p-8 text-center" style={{ boxShadow: '4px 4px 0px rgba(0,0,0,0.3)' }}>
                  <div className="text-4xl font-black text-yellow-300 mb-2 tracking-tighter">{s.val}</div>
                  <div className="text-white font-black uppercase text-[10px] tracking-widest leading-tight">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MISSIONE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-32">
          <div className="space-y-8 reveal">
            <div>
              <div className="text-[#6E4274] font-black text-xs tracking-[0.2em] uppercase mb-3">La Nostra Missione</div>
              <h2 className="text-4xl md:text-5xl font-heading font-black text-black dark:text-white leading-tight tracking-tighter">
                Non siamo solo un'agenzia. Siamo LBS.
              </h2>
            </div>
            <hr className="border-t border-black/10 dark:border-white/10" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }} />
            <p className="text-lg text-black/80 dark:text-white/80 leading-relaxed font-bold">
              Da 11 anni siamo il punto di riferimento per chi vuole lavorare in Germania. Abbiamo costruito una rete di oltre 200 aziende partner tedesche e un metodo collaudato che garantisce non solo il lavoro, ma una transizione di vita serena. Contratto regolare, alloggio trovato, burocrazia gestita. <strong>Tu pensi solo a fare le valigie.</strong>
            </p>
            <ul className="space-y-4">
              {[
                'Selezione trasparente e contatto diretto con le aziende in Germania',
                'Contratto di lavoro tedesco regolare garantito prima della partenza',
                'Traduzioni incluse nell\'assistenza per documenti, contratti e certificati',
                'Assistenza 24/7 durante il viaggio: medico, avvocato, pratiche',
                'Contratto di lavoro regolare garantito',
                'Supporto nella ricerca dell\'alloggio in Germania',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-4 font-bold text-black dark:text-white">
                  <span className="w-6 h-6 bg-[#6E4274] border-2 border-[#3D2045] flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5">
                    <i className="fas fa-check"></i>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative reveal">
            <div className="comic-card border-8 border-[#3D2045] overflow-hidden transform rotate-2" style={{ boxShadow: '8px 8px 0px #3D2045' }}>
              <img
                src="/img/ufficio_reception.jpg"
                className="aspect-square object-cover w-full"
                alt="Sala consulenze LBS"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-[#6E4274] border-4 border-[#3D2045] p-6 text-white" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
              <div className="text-3xl font-black tracking-tighter">1000+</div>
              <div className="text-xs font-black uppercase tracking-widest">Storie di Successo</div>
            </div>
          </div>
        </div>

        {/* IL FONDATORE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-32">
          <div className="relative reveal order-2 lg:order-1">
            <div className="comic-card border-8 border-[#3D2045] overflow-hidden transform -rotate-2" style={{ boxShadow: '8px 8px 0px #3D2045' }}>
              <img
                src="/img/salvatore_presentazione.jpg"
                className="w-full object-cover"
                style={{ aspectRatio: '3/4', objectPosition: 'center 15%' }}
                alt="Salvatore Cucuzza — Titolare LBS con un lavoratore"
              />
            </div>
            <div className="absolute -top-6 -right-6 bg-yellow-300 border-4 border-[#3D2045] p-4 text-[#3D2045] z-10" style={{ boxShadow: '4px 4px 0px #3D2045' }}>
              <div className="text-xl font-black tracking-tighter">Dal 2013</div>
            </div>
          </div>
          <div className="space-y-8 reveal order-1 lg:order-2">
            <div>
              <div className="text-[#6E4274] font-black text-xs tracking-[0.2em] uppercase mb-3">Il Titolare</div>
              <h2 className="text-4xl md:text-5xl font-heading font-black text-black dark:text-white leading-tight tracking-tighter">
                Salvatore Cucuzza
              </h2>
            </div>
            <hr className="border-t border-black/10 dark:border-white/10" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }} />
            <p className="text-lg text-black/80 dark:text-white/80 leading-relaxed font-bold">
              Titolare dell'agenzia da oltre 11 anni. Prima di fondare LBS, Salvatore lavorava nel settore della moda. Ha portato la stessa attenzione per i dettagli e la dedizione al cliente nel mondo del lavoro in Germania.
            </p>
            <p className="text-lg text-black/80 dark:text-white/80 leading-relaxed font-bold">
              Nel 2013 ha deciso di cambiare rotta e aprire l'agenzia, con l'obiettivo di creare un ponte sicuro e affidabile tra i lavoratori italiani e le aziende tedesche. Da allora, segue personalmente l'agenzia per garantire il miglior servizio possibile.
            </p>
          </div>
        </div>

        {/* TEAM */}
        <div className="text-left mb-8 reveal">
          <div className="text-[#6E4274] font-black text-xs tracking-[0.2em] uppercase mb-3">Il Nostro Team</div>
          <h2 className="text-4xl md:text-5xl font-heading font-black text-black dark:text-white tracking-tighter">
            Persone Reali, Non Algoritmi
          </h2>
        </div>
        <hr className="border-t border-black/10 dark:border-white/10 mb-16" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-4 border-[#3D2045]" style={{ boxShadow: '8px 8px 0px #3D2045' }}>
          {TEAM.map((member) => (
            <div key={member.id} className="reveal p-8 sm:p-12 border-r-4 border-[#3D2045] last:border-r-0 text-center group hover:bg-[#6E4274] transition-colors duration-300 bg-[var(--card-bg)]">
              <div className="w-24 h-24 bg-[#6E4274] group-hover:bg-yellow-300 border-4 border-[#3D2045] mx-auto mb-8 flex items-center justify-center text-white group-hover:text-[#3D2045] text-4xl transition-colors">
                <i className={`fas ${member.icon}`}></i>
              </div>
              <h3 className="text-2xl font-black text-black dark:text-white group-hover:text-white uppercase tracking-tight mb-2 transition-colors">{member.name}</h3>
              <p className="text-[#6E4274] group-hover:text-yellow-300 font-black mb-4 uppercase text-xs tracking-[0.2em] transition-colors">{member.role}</p>
              <p className="text-black/70 dark:text-white/70 group-hover:text-white/80 leading-relaxed font-bold transition-colors">{member.description}</p>
            </div>
          ))}
        </div>

        {/* GALLERIA UFFICIO */}
        <div className="mt-20 mb-20">
          <div className="text-left mb-8 reveal">
            <div className="text-[#6E4274] font-black text-xs tracking-[0.2em] uppercase mb-3">Il Nostro Ufficio</div>
            <h2 className="text-4xl md:text-5xl font-heading font-black text-black dark:text-white tracking-tighter">
              Dove nasce il tuo futuro
            </h2>
          </div>
          <hr className="border-t border-black/10 dark:border-white/10 mb-10" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { img: '/img/salvatore_hero.jpg', caption: 'Salvatore Cucuzza', tag: 'Titolare' },
              { img: '/img/ufficio_social.jpg', caption: 'La pagina ufficiale LBS', tag: 'Social' },
              { img: '/img/ufficio_postazione.jpg', caption: 'Postazione operativa', tag: 'Ufficio' },
            ].map((item, i) => (
              <div key={i} className="reveal border-4 border-[#3D2045] overflow-hidden group" style={{ boxShadow: '6px 6px 0px #3D2045' }}>
                <div className="relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  <img
                    src={item.img}
                    alt={item.caption}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#3D2045]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-4 bg-[var(--card-bg)] border-t-4 border-[#3D2045] flex items-center justify-between">
                  <span className="font-black text-sm text-black dark:text-white uppercase tracking-tight">{item.caption}</span>
                  <span className="bg-[#ffdf20] text-[#3D2045] font-black text-[10px] px-3 py-1 uppercase tracking-widest border-2 border-[#3D2045]">{item.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 bg-[#3D2045] border-8 border-[#3D2045] p-8 sm:p-16 reveal" style={{ boxShadow: '8px 8px 0px #3D2045' }}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1">
              <h2 className="text-3xl md:text-5xl font-heading font-black text-white tracking-tighter mb-4">
                Pronto a Partire?
              </h2>
              <p className="text-white/60 text-lg font-medium">Contattaci adesso — è gratis e senza impegno.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => setShowWaModal(true)} className="comic-button bg-[#25D366] text-white px-10 py-5 text-lg border-white hover:bg-green-400 cursor-pointer">
                <i className="fab fa-whatsapp mr-3"></i>WhatsApp
              </button>
              <a href="tel:+393518818391" className="comic-button bg-[#6E4274] text-white px-10 py-5 text-lg border-white hover:bg-[#9B6FA3]">
                <i className="fas fa-phone mr-3"></i>Chiama IT
              </a>
            </div>
          </div>
        </div>

      </div>

      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />
    </div>
  );
};

export default About;
