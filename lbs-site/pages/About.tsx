
import React, { useState } from 'react';
import { TEAM } from '../constants';
import { WhatsAppModal } from '../components/WhatsAppModal';
import PageHero from '../components/PageHero';

const ABOUT_STATS = [
  { val: '11+', label: 'Anni di esperienza' },
  { val: '1000+', label: 'Lavoratori collocati' },
  { val: '500+', label: 'Aziende partner' },
  { val: '100%', label: 'Supporto e assistenza' },
];

const MISSION_POINTS = [
  'Selezione trasparente e contatto diretto con le aziende in Germania',
  'Contratto di lavoro tedesco regolare garantito prima della partenza',
  'Traduzioni incluse nell\'assistenza per documenti, contratti e certificati',
  'Assistenza 24/7 durante il viaggio: medico, avvocato, pratiche',
  'Contratto di lavoro regolare garantito',
  'Supporto nella ricerca dell\'alloggio in Germania',
];

const OFFICE = [
  { img: '/img/salvatore_hero.jpg', caption: 'Salvatore Cucuzza', tag: 'Titolare' },
  { img: '/img/ufficio_social.jpg', caption: 'La pagina ufficiale LBS', tag: 'Social' },
  { img: '/img/ufficio_postazione.jpg', caption: 'Postazione operativa', tag: 'Ufficio' },
];

const About: React.FC = () => {
  const [showWaModal, setShowWaModal] = useState(false);
  return (
    <div className="overflow-x-hidden">
      <PageHero
        eyebrow="La nostra storia"
        title={<>LBS: nati per <span className="mark">portarti lì.</span></>}
        lead={<>LBS — <strong className="text-plum-800 font-semibold">Lavoro Business e Servizi in Germania</strong> — nasce con una missione chiara: portare lavoratori italiani in Germania con professionalità, serietà e assistenza 24/7 durante il viaggio, traduzioni incluse.</>}
        actions={
          <>
            <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-lg btn-wa">
              <i className="fab fa-whatsapp text-lg" /> WhatsApp
            </button>
            <a href="tel:+393518818391" className="btn btn-lg btn-outline">
              <i className="fas fa-phone text-plum-400" /> Chiama IT
            </a>
          </>
        }
        aside={
          <div className="grid-lines grid-cols-2">
            {ABOUT_STATS.map((s, i) => (
              <div key={s.label} className="p-6 sm:p-8">
                <div className={`font-semibold text-4xl sm:text-5xl tracking-tight ${i === 0 ? 'text-plum-600' : 'text-plum-800'}`}>{s.val}</div>
                <div className="text-sm mt-2 text-ink-soft">{s.label}</div>
              </div>
            ))}
          </div>
        }
      />

      {/* MISSIONE */}
      <section className="section">
        <div className="container-x grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div className="reveal">
            <span className="eyebrow">La nostra missione</span>
            <h2 className="h-section text-plum-800 mt-4">Non siamo solo un'agenzia. Siamo LBS.</h2>
            <p className="lead mt-5">
              Da 11 anni siamo il punto di riferimento per chi vuole lavorare in Germania. Abbiamo costruito una rete di oltre 200 aziende partner tedesche e un metodo collaudato che garantisce non solo il lavoro, ma una transizione di vita serena. Contratto regolare, alloggio trovato, burocrazia gestita.{' '}
              <strong className="text-plum-800 font-semibold">Tu pensi solo a fare le valigie.</strong>
            </p>
            <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MISSION_POINTS.map(item => (
                <li key={item} className="flex items-start gap-3 rounded-lg bg-white border border-line p-4 text-[15px] text-ink">
                  <span className="mt-0.5 h-5 w-5 rounded-full bg-plum-600 text-white flex items-center justify-center text-[9px] shrink-0">
                    <i className="fas fa-check" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative reveal">
            <img src="/img/ufficio_reception.jpg" alt="Sala consulenze LBS" loading="lazy" className="w-full aspect-square object-cover rounded-lg" />
            <div className="absolute -bottom-6 left-6 sm:-left-6 bg-plum-800 text-white rounded-lg p-6">
              <div className="font-semibold text-4xl tracking-tight text-sun-400">1000+</div>
              <div className="text-sm text-white/70">Storie di successo</div>
            </div>
          </div>
        </div>
      </section>

      {/* IL TITOLARE */}
      <section className="pb-20 md:pb-28">
        <div className="container-x grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
          <div className="relative reveal lg:col-span-5 order-2 lg:order-1">
            <img
              src="/img/salvatore_presentazione.jpg"
              alt="Salvatore Cucuzza — Titolare LBS con un lavoratore"
              loading="lazy"
              className="w-full object-cover rounded-lg aspect-[3/4]"
              style={{ objectPosition: 'center 15%' }}
            />
            <span className="absolute top-6 -right-3 sm:-right-6 chip chip-sun !text-base !px-5 !py-2.5 shadow-[var(--shadow-soft)]">Dal 2013</span>
          </div>
          <div className="reveal lg:col-span-7 order-1 lg:order-2">
            <span className="eyebrow">Il titolare</span>
            <h2 className="h-section text-plum-800 mt-4">Salvatore Cucuzza</h2>
            <blockquote className="mt-6 border-l-4 border-sun-400 pl-5 font-heading text-xl sm:text-2xl text-plum-700 leading-snug">
              Un ponte sicuro e affidabile tra i lavoratori italiani e le aziende tedesche.
            </blockquote>
            <p className="lead mt-6">
              Titolare dell'agenzia da oltre 11 anni. Prima di fondare LBS, Salvatore lavorava nel settore della moda. Ha portato la stessa attenzione per i dettagli e la dedizione al cliente nel mondo del lavoro in Germania.
            </p>
            <p className="lead mt-4">
              Nel 2013 ha deciso di cambiare rotta e aprire l'agenzia, con l'obiettivo di creare un ponte sicuro e affidabile tra i lavoratori italiani e le aziende tedesche. Da allora, segue personalmente l'agenzia per garantire il miglior servizio possibile.
            </p>
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="section surface-tint">
        <div className="container-x">
          <div className="max-w-2xl mb-12 reveal">
            <span className="eyebrow">Il nostro team</span>
            <h2 className="h-section text-plum-800 mt-4">Persone reali, <span className="mark">non algoritmi</span></h2>
          </div>
          <div className="grid-lines grid-cols-1 md:grid-cols-3">
            {TEAM.map(member => (
              <div key={member.id} className="reveal p-7 sm:p-9">
                <span className="icon-tile"><i className={`fas ${member.icon}`} /></span>
                <h3 className="font-semibold text-2xl text-plum-800 mt-7">{member.name}</h3>
                <p className="chip mt-3">{member.role}</p>
                <p className="text-ink-soft leading-relaxed mt-4">{member.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UFFICIO */}
      <section className="section">
        <div className="container-x">
          <div className="max-w-2xl mb-12 reveal">
            <span className="eyebrow">Il nostro ufficio</span>
            <h2 className="h-section text-plum-800 mt-4">Dove nasce il tuo futuro</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {OFFICE.map(item => (
              <figure key={item.img} className="reveal group relative overflow-hidden rounded-xl aspect-[4/3]">
                <img src={item.img} alt={item.caption} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <figcaption className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-plum-950/80 to-transparent flex items-end justify-between gap-3">
                  <span className="font-semibold text-white text-lg">{item.caption}</span>
                  <span className="chip chip-sun">{item.tag}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />
    </div>
  );
};

export default About;
