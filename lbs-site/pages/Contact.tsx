
import React, { useState } from 'react';
import { Cloud, CircledX, CurvedArrow, Cursor } from '../components/Decorations';
import { WhatsAppModal } from '../components/WhatsAppModal';

const Contact: React.FC = () => {
  const [showWaModal, setShowWaModal] = useState(false);
  return (
    <div className="pt-32 pb-24 min-h-screen bg-transparent relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <Cloud className="absolute top-40 left-10 w-24 h-24 text-[#6E4274] opacity-15 animate-pulse" />
        <Cloud className="absolute top-[60%] right-10 w-20 h-20 text-[#6E4274] opacity-10" />
        <CircledX className="absolute top-80 right-20 w-14 h-14 text-[#6E4274] opacity-20" />
        <CurvedArrow className="absolute top-[45%] left-[5%] w-16 h-16 text-[#6E4274] opacity-15" />
        <Cursor className="absolute bottom-[25%] right-[5%] w-12 h-12 text-[#6E4274] opacity-10" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">

        {/* HEADER */}
        <div className="text-center mb-20 reveal">
          <div className="inline-block bg-[#6E4274] text-white px-6 py-2 font-black text-xs tracking-[0.3em] uppercase mb-6 border-4 border-[#3D2045]">Contattaci Ora</div>
          <h1 className="text-5xl md:text-8xl font-heading font-black text-black dark:text-white tracking-tighter uppercase mb-6">
            Siamo<br/><span className="text-[#6E4274]">Qui</span><br/>per Te.
          </h1>
          <p className="text-2xl text-black/70 dark:text-white/70 max-w-3xl mx-auto font-black uppercase tracking-tight leading-snug">
            "Niente moduli noiosi — preferiamo il contatto diretto, umano, vero."
          </p>
        </div>

        {/* CANALI DI CONTATTO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-4 border-[#3D2045] mb-20" style={{boxShadow: '8px 8px 0px #3D2045'}}>

          {/* WhatsApp */}
          <button onClick={() => setShowWaModal(true)}
             className="group reveal p-8 sm:p-12 border-r-4 border-[#3D2045] bg-[var(--card-bg)] hover:bg-[#25D366] transition-colors duration-300 flex flex-col text-left cursor-pointer">
            <div className="w-20 h-20 bg-[#25D366] group-hover:bg-white border-4 border-[#3D2045] flex items-center justify-center text-white group-hover:text-[#25D366] text-4xl mb-8 transition-colors">
              <i className="fab fa-whatsapp"></i>
            </div>
            <div className="inline-block bg-[#25D366] group-hover:bg-white text-white group-hover:text-[#25D366] px-4 py-1 font-black text-xs tracking-widest uppercase mb-4 border-2 border-[#3D2045] transition-colors w-fit">WhatsApp</div>
            <h3 className="text-2xl font-black text-black dark:text-white group-hover:text-white uppercase tracking-tight mb-4 transition-colors">Contattaci su WhatsApp</h3>
            <p className="text-black/70 dark:text-white/70 group-hover:text-white/90 text-base mb-6 font-bold leading-relaxed transition-colors">Risposta rapida dai nostri consulenti (Numero Italiano e Tedesco). Disponibili h24.</p>
            <span className="text-[#25D366] group-hover:text-white font-black text-xl flex items-center gap-3 uppercase mt-auto transition-colors">
              Scegli Numero <i className="fas fa-arrow-right text-sm group-hover:translate-x-2 transition-transform"></i>
            </span>
          </button>

          {/* Telefono IT */}
          <a href="tel:+393518818391"
             className="group reveal p-8 sm:p-12 border-r-4 border-[#3D2045] bg-[var(--card-bg)] hover:bg-[#6E4274] transition-colors duration-300 flex flex-col">
            <div className="w-20 h-20 bg-[#6E4274] group-hover:bg-yellow-300 border-4 border-[#3D2045] flex items-center justify-center text-white group-hover:text-[#3D2045] text-4xl mb-8 transition-colors">
              <i className="fas fa-phone"></i>
            </div>
            <div className="inline-block bg-[#6E4274] group-hover:bg-yellow-300 text-white group-hover:text-[#3D2045] px-4 py-1 font-black text-xs tracking-widest uppercase mb-4 border-2 border-[#3D2045] transition-colors w-fit">Italia</div>
            <h3 className="text-2xl font-black text-black dark:text-white group-hover:text-white uppercase tracking-tight mb-4 transition-colors">Telefono IT</h3>
            <p className="text-black/70 dark:text-white/70 group-hover:text-white/90 text-base mb-6 font-bold leading-relaxed transition-colors">Chiamaci per una consulenza immediata con il nostro team a Catania. Siamo a tua disposizione.</p>
            <span className="text-[#6E4274] group-hover:text-yellow-300 font-black text-xl flex items-center gap-3 uppercase mt-auto transition-colors">
              +39 351 881 8391 <i className="fas fa-arrow-right text-sm group-hover:translate-x-2 transition-transform"></i>
            </span>
          </a>

          {/* Social & Email */}
          <div className="group reveal p-8 sm:p-12 bg-[var(--card-bg)] hover:bg-[#3D2045] transition-colors duration-300 flex flex-col">
            <div className="w-20 h-20 bg-[#3D2045] group-hover:bg-yellow-300 border-4 border-[#3D2045] flex items-center justify-center text-white group-hover:text-[#3D2045] text-4xl mb-8 transition-colors">
              <i className="fas fa-at"></i>
            </div>
            <div className="inline-block bg-[#9B6FA3] group-hover:bg-yellow-300 text-white group-hover:text-[#3D2045] px-4 py-1 font-black text-xs tracking-widest uppercase mb-4 border-2 border-[#3D2045] transition-colors w-fit">Online</div>
            <h3 className="text-2xl font-black text-black dark:text-white group-hover:text-white uppercase tracking-tight mb-4 transition-colors">Email & Social</h3>
            <p className="text-black/70 dark:text-white/70 group-hover:text-white/90 text-base mb-6 font-bold leading-relaxed transition-colors">Scrivici via email o seguici sui social per aggiornamenti e nuove offerte di lavoro.</p>
            <a href="mailto:info@lbswork.com" className="text-[#6E4274] group-hover:text-yellow-300 font-black text-lg mb-6 block transition-colors">
              info@lbswork.com
            </a>
            <div className="flex gap-3 mt-auto">
              <a href="https://www.facebook.com/lbs.business.e.servizi" target="_blank" rel="noopener noreferrer" className="w-12 h-12 border-2 border-[#3D2045] group-hover:border-white flex items-center justify-center hover:bg-[#3b5998] hover:text-white transition-colors text-xl text-black dark:text-white group-hover:text-white">
                <i className="fab fa-facebook-f"></i>
              </a>
              <a href="https://www.instagram.com/lbs_business_servizi/" target="_blank" rel="noopener noreferrer" className="w-12 h-12 border-2 border-[#3D2045] group-hover:border-white flex items-center justify-center hover:bg-[#e1306c] hover:text-white transition-colors text-xl text-black dark:text-white group-hover:text-white">
                <i className="fab fa-instagram"></i>
              </a>
              <a href="https://www.youtube.com/@LBS.Work.Germany" target="_blank" rel="noopener noreferrer" className="w-12 h-12 border-2 border-[#3D2045] group-hover:border-white flex items-center justify-center hover:bg-[#FF0000] hover:text-white transition-colors text-xl text-black dark:text-white group-hover:text-white">
                <i className="fab fa-youtube"></i>
              </a>
            </div>
          </div>
        </div>

        {/* FOTO UFFICIO */}
        <div className="grid grid-cols-2 gap-0 border-4 border-[#3D2045] mb-20" style={{boxShadow: '6px 6px 0px #3D2045'}}>
          <div className="relative overflow-hidden group">
            <img
              src="/img/salvatore_hero.jpg"
              alt="Salvatore Cucuzza — Titolare LBS"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ aspectRatio: '4/3' }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#3D2045] to-transparent">
              <span className="bg-[#ffdf20] text-[#3D2045] font-black text-[10px] px-3 py-1 uppercase tracking-widest border-2 border-[#3D2045]">Titolare</span>
              <div className="text-white font-black text-sm uppercase tracking-tight mt-2">Salvatore Cucuzza</div>
            </div>
          </div>
          <div className="relative overflow-hidden group">
            <img
              src="/img/ufficio_reception.jpg"
              alt="Sala consulenze LBS"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ aspectRatio: '4/3' }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#3D2045] to-transparent">
              <span className="bg-[#ffdf20] text-[#3D2045] font-black text-[10px] px-3 py-1 uppercase tracking-widest border-2 border-[#3D2045]">Sede</span>
              <div className="text-white font-black text-sm uppercase tracking-tight mt-2">Il nostro ufficio a Catania</div>
            </div>
          </div>
        </div>

        {/* SEDE + ORARI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-4 border-[#3D2045] mb-20" style={{boxShadow: '8px 8px 0px #3D2045'}}>
          <div className="reveal p-8 sm:p-12 border-b-4 lg:border-b-0 lg:border-r-4 border-[#3D2045] bg-[#6E4274] flex flex-col justify-between">
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-8">
                <i className="fas fa-map-marker-alt text-yellow-300 mr-4"></i>Le Nostre Sedi
              </h2>
              <div className="space-y-4">
                {/* Catania */}
                <div className="bg-white/10 border-4 border-white/30 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300">🇮🇹 Sede Operativa (Italia)</span>
                  </div>
                  <p className="text-white font-black text-lg uppercase">Viale Vittorio Veneto, 335</p>
                  <p className="text-white/70 font-bold uppercase tracking-widest text-xs">Catania, 95126 (CT) — Italia</p>
                </div>

                {/* Kassel Germania */}
                <div className="bg-white/10 border-4 border-white/30 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300">🇩🇪 Sede Legale (Germania)</span>
                    <span className="bg-white/20 text-white text-[9px] font-black uppercase px-2 py-0.5 border border-white/30">
                      Non aperta al pubblico
                    </span>
                  </div>
                  <p className="text-white font-black text-lg uppercase">Henkelstraße 7</p>
                  <p className="text-white/70 font-bold uppercase tracking-widest text-xs">34127 Kassel — Germania</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-300 border-4 border-[#3D2045] p-3.5 flex items-center gap-3 mt-4">
              <i className="fas fa-check-circle text-[#3D2045] text-lg"></i>
              <p className="text-[#3D2045] font-black uppercase text-xs tracking-tight">Presidio costante sia sul territorio italiano che tedesco</p>
            </div>
          </div>
          <div className="reveal p-8 sm:p-12 bg-[var(--card-bg)]">
            <h2 className="text-3xl font-black text-black dark:text-white uppercase tracking-tighter mb-8">
              <i className="fas fa-clock text-[#6E4274] mr-4"></i>Orari
            </h2>
            <div className="space-y-3">
              {[
                { g: 'Lun – Ven', o: '09:00 – 18:00' },
                { g: 'Sabato', o: '09:00 – 13:00' },
                { g: 'WhatsApp DE / IT', o: 'H24 — Sempre' },
              ].map((item, i) => (
                <div key={i} className={`flex justify-between items-center border-4 border-[#3D2045] px-6 py-4 ${i === 2 ? 'bg-[#25D366]' : 'bg-transparent'}`}>
                  <span className={`font-black uppercase text-sm tracking-tight ${i === 2 ? 'text-white' : 'text-black dark:text-white'}`}>{item.g}</span>
                  <span className={`font-black uppercase text-sm ${i === 2 ? 'text-white' : 'text-[#6E4274]'}`}>{item.o}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA FINALE */}
        <div className="reveal bg-[#3D2045] border-8 border-[#3D2045] p-8 sm:p-16 text-center relative" style={{boxShadow: '8px 8px 0px #3D2045'}}>
          <Cursor className="absolute top-6 right-6 w-12 h-12 text-[#9B6FA3] opacity-30 pointer-events-none" />
          <h2 className="text-4xl md:text-6xl font-heading font-black text-white uppercase tracking-tighter mb-6">
            Non aspettare.<br/><span className="text-yellow-300">Chiama adesso.</span>
          </h2>
          <p className="text-white/80 text-xl font-bold mb-10 uppercase tracking-tight">La Germania ti sta aspettando. Il primo passo lo facciamo insieme, gratis.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button onClick={() => setShowWaModal(true)} className="comic-button bg-[#25D366] text-white px-10 py-5 text-xl border-white hover:bg-green-400 cursor-pointer">
              <i className="fab fa-whatsapp mr-3"></i>WhatsApp Ora
            </button>
            <a href="tel:+393518818391" className="comic-button bg-[#6E4274] text-white px-10 py-5 text-xl border-white hover:bg-[#9B6FA3]">
              <i className="fas fa-phone mr-3"></i>+39 351 881 8391
            </a>
          </div>
        </div>

      </div>

      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />
    </div>
  );
};

export default Contact;
