import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import logoLBS from '../img/logo_LBS.png';
import { WhatsAppModal } from './WhatsAppModal';

const Footer: React.FC = () => {
  const [showWaModal, setShowWaModal] = useState(false);

  return (
    <footer className="bg-[#3D2045] text-white pt-20 pb-10 border-t-8 border-[#6E4274]">
      {showWaModal && <WhatsAppModal onClose={() => setShowWaModal(false)} />}
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12">

        {/* BRAND */}
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-3 mb-6">
            <img
              src={logoLBS}
              alt="LBS Lavoro Business e Servizi in Germania"
              className="h-14 w-auto flex-shrink-0"
            />
            <div>
              <div className="text-xs font-black uppercase tracking-widest leading-tight">Lavoro Business</div>
              <div className="text-[10px] text-[#9B6FA3] font-bold uppercase tracking-widest">e Servizi in Germania</div>
            </div>
          </div>
          <p className="text-white/60 text-sm leading-relaxed mb-6">
            La tua agenzia di riferimento per lavorare in Germania. 11 anni di esperienza, 350+ lavoratori collocati. <strong className="text-yellow-300">Contratti regolari, alloggio e assistenza 24/7.</strong>
          </p>
          <div className="flex gap-3">
            <a href="https://www.facebook.com/lbs.business.e.servizi" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 flex items-center justify-center hover:bg-[#3b5998] transition-colors border border-white/10 hover:border-[#3b5998]">
              <i className="fab fa-facebook-f text-sm"></i>
            </a>
            <a href="https://www.instagram.com/lbs_business_servizi/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 flex items-center justify-center hover:bg-[#e1306c] transition-colors border border-white/10 hover:border-[#e1306c]">
              <i className="fab fa-instagram text-sm"></i>
            </a>
            <a href="https://www.youtube.com/@LBS.Work.Germany" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 flex items-center justify-center hover:bg-[#FF0000] transition-colors border border-white/10 hover:border-[#FF0000]">
              <i className="fab fa-youtube text-sm"></i>
            </a>
          </div>
        </div>

        {/* NAVIGA */}
        <div>
          <h4 className="text-[#9B6FA3] font-black mb-6 uppercase tracking-widest text-xs border-b-2 border-[#6E4274] pb-3">Naviga</h4>
          <ul className="space-y-3 text-white/60 text-sm font-bold">
            <li><Link to="/" className="hover:text-white transition-colors hover:text-[#9B6FA3]">Home</Link></li>
            <li><Link to="/servizi" className="hover:text-white transition-colors hover:text-[#9B6FA3]">Servizi</Link></li>
            <li><Link to="/offerte" className="hover:text-white transition-colors hover:text-[#9B6FA3]">Offerte 🇩🇪</Link></li>
            <li><Link to="/datori-di-lavoro" className="hover:text-yellow-300 transition-colors text-yellow-300/90 font-black">Per le Aziende (Datori)</Link></li>
            <li><Link to="/chi-siamo" className="hover:text-white transition-colors hover:text-[#9B6FA3]">Chi Siamo</Link></li>
            <li><Link to="/contatti" className="hover:text-white transition-colors hover:text-[#9B6FA3]">Contatti</Link></li>
            <li><a href="/#candidatura" className="hover:text-yellow-300 transition-colors font-black text-yellow-300/80">→ Candidati Gratis</a></li>
            <li className="pt-2 border-t border-white/10">
              <Link to="/privacy-policy" className="hover:text-white transition-colors text-white/40 text-xs">Privacy Policy</Link>
            </li>
            <li>
              <Link to="/cookie-policy" className="hover:text-white transition-colors text-white/40 text-xs">Cookie Policy</Link>
            </li>
            <li>
              <Link to="/termini-e-condizioni" className="hover:text-white transition-colors text-white/40 text-xs">Termini e Condizioni</Link>
            </li>
            <li>
              <Link to="/note-legali" className="hover:text-white transition-colors text-white/40 text-xs">Note Legali</Link>
            </li>
          </ul>
        </div>

        {/* CONTATTI */}
        <div>
          <h4 className="text-[#9B6FA3] font-black mb-6 uppercase tracking-widest text-xs border-b-2 border-[#6E4274] pb-3">Contatti</h4>
          <ul className="space-y-4 text-white/60 text-sm font-bold">
            <li className="flex items-center gap-3">
              <i className="fas fa-phone text-[#9B6FA3] w-4"></i>
              <a href="tel:+393518818391" className="hover:text-white transition-colors">+39 351 881 8391 (IT)</a>
            </li>
            <li className="flex items-center gap-3">
              <i className="fab fa-whatsapp text-[#25D366] w-4"></i>
              <button onClick={() => setShowWaModal(true)} className="hover:text-white transition-colors cursor-pointer text-left">+49 1573 9037885 (DE) / +39 (IT)</button>
            </li>
            <li className="flex items-center gap-3">
              <i className="fas fa-envelope text-[#9B6FA3] w-4"></i>
              <a href="mailto:info@lbswork.com" className="hover:text-white transition-colors">info@lbswork.com</a>
            </li>
          </ul>
          <div className="mt-6 bg-[#6E4274]/30 border-2 border-[#6E4274] p-4 cursor-pointer" onClick={() => setShowWaModal(true)}>
            <div className="text-xs font-black text-yellow-300 uppercase tracking-widest mb-1">WhatsApp h24</div>
            <div className="text-white/70 text-xs font-bold">Disponibili sia al numero Tedesco che Italiano</div>
          </div>
        </div>

        {/* SEDI */}
        <div>
          <h4 className="text-[#9B6FA3] font-black mb-4 uppercase tracking-widest text-xs border-b-2 border-[#6E4274] pb-2">Le Nostre Sedi</h4>
          
          <div className="mb-3">
            <div className="text-[11px] font-black uppercase text-yellow-300 tracking-wider flex items-center gap-1.5 mb-1">
              <i className="fas fa-map-marker-alt"></i> Sede Operativa (Italia)
            </div>
            <p className="text-white/70 text-xs font-bold leading-relaxed">
              Viale Vittorio Veneto, 335<br/>
              95126 Catania (CT) — Italia
            </p>
          </div>

          <div className="pt-3 border-t border-white/10 mb-3">
            <div className="text-[11px] font-black uppercase text-yellow-300 tracking-wider flex items-center gap-1.5 mb-1">
              <i className="fas fa-building"></i> Sede Legale (Germania)
            </div>
            <p className="text-white/70 text-xs font-bold leading-relaxed">
              Henkelstraße 7<br/>
              34127 Kassel — Germania
            </p>
            <span className="inline-block mt-1 bg-white/10 text-white/80 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border border-white/20">
              Non aperta al pubblico
            </span>
          </div>

          <div className="space-y-1 text-[11px] text-white/50 font-bold uppercase tracking-widest pt-2 border-t border-white/10">
            <div>Lun–Ven: 09:00–18:00</div>
            <div>Sabato: 09:00–13:00</div>
          </div>
          <button
            type="button"
            onClick={() => setShowWaModal(true)}
            className="mt-4 block w-full comic-button bg-[#25D366] text-white text-center py-2.5 text-xs border-white hover:bg-green-400 cursor-pointer"
          >
            <i className="fab fa-whatsapp mr-2"></i>SCRIVICI ORA
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-white/10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
            © {new Date().getFullYear()} LBS LAVORO BUSINESS E SERVIZI IN GERMANIA — TUTTI I DIRITTI RISERVATI.
          </p>
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
            P.IVA — Agenzia per l'Impiego — Catania, Italia
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link to="/privacy-policy" className="text-white/30 hover:text-white/60 transition-colors text-[10px] font-bold uppercase tracking-widest">Privacy Policy</Link>
          <Link to="/cookie-policy" className="text-white/30 hover:text-white/60 transition-colors text-[10px] font-bold uppercase tracking-widest">Cookie Policy</Link>
          <Link to="/termini-e-condizioni" className="text-white/30 hover:text-white/60 transition-colors text-[10px] font-bold uppercase tracking-widest">Termini e Condizioni</Link>
          <Link to="/note-legali" className="text-white/30 hover:text-white/60 transition-colors text-[10px] font-bold uppercase tracking-widest">Note Legali</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
