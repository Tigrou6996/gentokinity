
import React, { useState } from 'react';
import { WhatsAppModal } from '../components/WhatsAppModal';
import PageHero from '../components/PageHero';

const SOCIAL = [
  { href: 'https://www.facebook.com/lbs.business.e.servizi', icon: 'fa-facebook-f', label: 'Facebook' },
  { href: 'https://www.instagram.com/lbs_business_servizi/', icon: 'fa-instagram', label: 'Instagram' },
  { href: 'https://www.youtube.com/@LBS.Work.Germany', icon: 'fa-youtube', label: 'YouTube' },
];

const HOURS = [
  { g: 'Lun – Ven', o: '09:00 – 18:00' },
  { g: 'Sabato', o: '09:00 – 13:00' },
  { g: 'WhatsApp DE / IT', o: 'H24 — Sempre' },
];

const Contact: React.FC = () => {
  const [showWaModal, setShowWaModal] = useState(false);
  return (
    <div className="overflow-x-hidden">
      <PageHero
        eyebrow="Contattaci ora"
        title={<>Siamo qui <span className="mark">per te.</span></>}
        lead="“Niente moduli noiosi — preferiamo il contatto diretto, umano, vero.”"
      />

      {/* CANALI */}
      <section className="pt-12 pb-20 md:pb-24">
        <div className="container-x"><div className="grid-lines grid-cols-1 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setShowWaModal(true)}
            className="reveal group text-left p-8 sm:p-9 flex flex-col cursor-pointer hover:bg-plum-50! transition-colors"
          >
            <span className="icon-tile !text-[#128C4B]"><i className="fab fa-whatsapp text-lg" /></span>
            <span className="chip mt-8 self-start">WhatsApp · h24</span>
            <h2 className="font-semibold text-xl text-plum-800 mt-4">Contattaci su WhatsApp</h2>
            <p className="text-ink-soft leading-relaxed mt-2 flex-1">Risposta rapida dai nostri consulenti (numero italiano e tedesco). Disponibili h24.</p>
            <span className="mt-6 font-medium text-[#128C4B] flex items-center gap-2">Scegli il numero <i className="fas fa-arrow-right text-sm group-hover:translate-x-1 transition-transform" /></span>
          </button>

          <a
            href="tel:+393518818391"
            className="reveal group p-8 sm:p-9 flex flex-col hover:bg-plum-50! transition-colors"
          >
            <span className="icon-tile"><i className="fas fa-phone" /></span>
            <span className="chip mt-8 self-start">Italia</span>
            <h2 className="font-semibold text-xl text-plum-800 mt-4">Telefono IT</h2>
            <p className="text-ink-soft leading-relaxed mt-2 flex-1">Chiamaci per una consulenza immediata con il nostro team a Catania. Siamo a tua disposizione.</p>
            <span className="mt-6 font-medium text-plum-600 flex items-center gap-2">+39 351 881 8391 <i className="fas fa-arrow-right text-sm group-hover:translate-x-1 transition-transform" /></span>
          </a>

          <div className="reveal p-8 sm:p-9 flex flex-col">
            <span className="icon-tile"><i className="fas fa-at" /></span>
            <span className="chip mt-8 self-start">Online</span>
            <h2 className="font-semibold text-xl text-plum-800 mt-4">Email e social</h2>
            <p className="text-ink-soft leading-relaxed mt-2">Scrivici via email o seguici sui social per aggiornamenti e nuove offerte di lavoro.</p>
            <a href="mailto:info@lbswork.com" className="mt-5 font-semibold text-plum-600 hover:text-plum-800">info@lbswork.com</a>
            <div className="flex gap-2 mt-auto pt-6">
              {SOCIAL.map(s => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="h-11 w-11 rounded-md border border-line flex items-center justify-center text-plum-800 hover:bg-plum-800 hover:text-white hover:border-plum-800 transition-colors"
                >
                  <i className={`fab ${s.icon}`} />
                </a>
              ))}
            </div>
          </div>
        </div></div>
      </section>

      {/* SEDI + ORARI */}
      <section className="pb-20 md:pb-28">
        <div className="container-x grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 grid grid-cols-2 gap-5">
            <figure className="reveal relative overflow-hidden rounded-xl aspect-[3/4] sm:aspect-[4/5]">
              <img src="/img/salvatore_hero.jpg" alt="Salvatore Cucuzza — Titolare LBS" loading="lazy" className="w-full h-full object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-plum-950/80 to-transparent">
                <span className="chip chip-sun">Titolare</span>
                <span className="block text-white font-semibold mt-2">Salvatore Cucuzza</span>
              </figcaption>
            </figure>
            <figure className="reveal relative overflow-hidden rounded-xl aspect-[3/4] sm:aspect-[4/5] mt-10">
              <img src="/img/ufficio_reception.jpg" alt="Sala consulenze LBS" loading="lazy" className="w-full h-full object-cover" />
              <figcaption className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-plum-950/80 to-transparent">
                <span className="chip chip-sun">Sede</span>
                <span className="block text-white font-semibold mt-2">Il nostro ufficio a Catania</span>
              </figcaption>
            </figure>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="reveal card p-7 sm:p-8">
              <h2 className="font-semibold text-2xl text-plum-800 flex items-center gap-3">
                <i className="fas fa-map-marker-alt text-plum-400 text-xl" /> Le nostre sedi
              </h2>
              <div className="mt-6 space-y-4">
                <div className="rounded-lg bg-plum-50 p-5">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-plum-600">🇮🇹 Sede operativa (Italia)</span>
                  <p className="font-semibold text-plum-800 text-lg mt-1">Viale Vittorio Veneto, 335</p>
                  <p className="text-ink-soft text-sm">Catania, 95126 (CT) — Italia</p>
                </div>
                <div className="rounded-lg bg-plum-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-plum-600">🇩🇪 Sede legale (Germania)</span>
                    <span className="chip !bg-white !text-[11px]">Non aperta al pubblico</span>
                  </div>
                  <p className="font-semibold text-plum-800 text-lg mt-1">Henkelstraße 7</p>
                  <p className="text-ink-soft text-sm">34127 Kassel — Germania</p>
                </div>
              </div>
              <p className="mt-5 flex items-center gap-3 rounded-lg bg-sun-100 px-4 py-3 text-sm font-medium text-plum-800">
                <i className="fas fa-check-circle" /> Presidio costante sia sul territorio italiano che tedesco
              </p>
            </div>

            <div className="reveal card p-7 sm:p-8">
              <h2 className="font-semibold text-2xl text-plum-800 flex items-center gap-3">
                <i className="fas fa-clock text-plum-400 text-xl" /> Orari
              </h2>
              <dl className="mt-5 divide-y divide-line">
                {HOURS.map((item, i) => (
                  <div key={item.g} className="flex justify-between items-center py-3.5">
                    <dt className="text-ink">{item.g}</dt>
                    <dd className={`font-semibold ${i === 2 ? 'text-[#128C4B] flex items-center gap-2' : 'text-plum-700'}`}>
                      {i === 2 && <span className="h-2 w-2 rounded-full bg-wa" />}
                      {item.o}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />
    </div>
  );
};

export default Contact;
