import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import logoLBS from '../img/logo_LBS-192.png';
import { WhatsAppModal } from './WhatsAppModal';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/servizi', label: 'Servizi' },
  { to: '/offerte', label: 'Offerte di lavoro' },
  { to: '/chi-siamo', label: 'Chi siamo' },
  { to: '/contatti', label: 'Contatti' },
];

const LEGAL = [
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/cookie-policy', label: 'Cookie Policy' },
  { to: '/termini-e-condizioni', label: 'Termini e Condizioni' },
  { to: '/note-legali', label: 'Note Legali' },
];

const SOCIAL = [
  { href: 'https://www.facebook.com/lbs.business.e.servizi', icon: 'fa-facebook-f', label: 'Facebook' },
  { href: 'https://www.instagram.com/lbs_business_servizi/', icon: 'fa-instagram', label: 'Instagram' },
  { href: 'https://www.youtube.com/@LBS.Work.Germany', icon: 'fa-youtube', label: 'YouTube' },
];

const Footer: React.FC = () => {
  const [showWaModal, setShowWaModal] = useState(false);

  return (
    <footer className="surface-plum text-white overflow-hidden">
      <WhatsAppModal isOpen={showWaModal} onClose={() => setShowWaModal(false)} />

      {/* CTA */}
      <div className="container-x">
        <div className="py-16 sm:py-20 border-b border-white/15 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <span className="eyebrow eyebrow-light">Consulenza gratuita</span>
            <h2 className="h-section text-white mt-4">Il tuo nuovo lavoro in Germania inizia con un messaggio.</h2>
            <p className="mt-3 text-white/60 text-lg">Nessun anticipo. Ti richiamiamo entro 24 ore.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <a href="/#candidatura" className="btn btn-lg btn-accent">
              Candidati gratis <i className="fas fa-arrow-right text-xs" />
            </a>
            <button type="button" onClick={() => setShowWaModal(true)} className="btn btn-lg btn-ghost-light">
              <i className="fab fa-whatsapp text-lg" /> Scrivici su WhatsApp
            </button>
          </div>
        </div>
      </div>

      <div className="container-x pt-16 pb-10 grid grid-cols-2 lg:grid-cols-12 gap-x-8 gap-y-12">
        {/* BRAND */}
        <div className="col-span-2 lg:col-span-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <img src={logoLBS} alt="LBS Lavoro Business e Servizi in Germania" className="h-12 w-12" width={48} height={48} />
            <span>
              <span className="block font-semibold text-lg leading-tight">LBS Work</span>
              <span className="block text-xs text-white/55">Lavoro Business e Servizi in Germania</span>
            </span>
          </Link>
          <p className="text-white/65 text-sm leading-relaxed mt-5 max-w-sm">
            La tua agenzia di riferimento per lavorare in Germania. 11 anni di esperienza, 350+ lavoratori collocati.{' '}
            <span className="text-sun-400 font-medium">Contratti regolari, alloggio e assistenza 24/7.</span>
          </p>
          <div className="flex gap-2 mt-6">
            {SOCIAL.map(s => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="h-10 w-10 rounded-md border border-white/20 flex items-center justify-center hover:border-white transition-colors"
              >
                <i className={`fab ${s.icon} text-sm`} />
              </a>
            ))}
          </div>
        </div>

        {/* NAVIGA */}
        <div className="lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45 mb-5 font-sans">Naviga</h3>
          <ul className="space-y-3 text-sm">
            {NAV.map(l => (
              <li key={l.to}><Link to={l.to} className="text-white/75 hover:text-white transition-colors">{l.label}</Link></li>
            ))}
            <li><Link to="/datori-di-lavoro" className="text-sun-400 hover:text-sun-300 font-medium">Per le aziende</Link></li>
            <li><a href="/#candidatura" className="text-sun-400 hover:text-sun-300 font-medium">Candidati gratis →</a></li>
          </ul>
        </div>

        {/* CONTATTI */}
        <div className="lg:col-span-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45 mb-5 font-sans">Contatti</h3>
          <ul className="space-y-3.5 text-sm">
            <li>
              <a href="tel:+393518818391" className="flex items-center gap-3 text-white/75 hover:text-white">
                <i className="fas fa-phone text-plum-300 w-4" /> +39 351 881 8391 (IT)
              </a>
            </li>
            <li>
              <button type="button" onClick={() => setShowWaModal(true)} className="flex items-center gap-3 text-white/75 hover:text-white text-left cursor-pointer">
                <i className="fab fa-whatsapp text-wa w-4" /> +49 1573 9037885 (DE) / +39 (IT)
              </button>
            </li>
            <li>
              <a href="mailto:info@lbswork.com" className="flex items-center gap-3 text-white/75 hover:text-white">
                <i className="fas fa-envelope text-plum-300 w-4" /> info@lbswork.com
              </a>
            </li>
          </ul>
          <button
            type="button"
            onClick={() => setShowWaModal(true)}
            className="mt-6 w-full text-left rounded-md border border-white/15 p-4 hover:border-white/40 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full bg-wa" /> WhatsApp h24
            </span>
            <span className="block text-xs text-white/55 mt-1">Disponibili sia al numero tedesco che italiano</span>
          </button>
        </div>

        {/* SEDI */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45 mb-5 font-sans">Le nostre sedi</h3>
          <div className="space-y-5 text-sm">
            <div>
              <div className="flex items-center gap-2 font-medium text-white">
                <i className="fas fa-map-marker-alt text-sun-400 text-xs" /> Sede operativa (Italia)
              </div>
              <p className="text-white/60 mt-1 leading-relaxed">Viale Vittorio Veneto, 335<br />95126 Catania (CT) — Italia</p>
            </div>
            <div>
              <div className="flex items-center gap-2 font-medium text-white">
                <i className="fas fa-building text-sun-400 text-xs" /> Sede legale (Germania)
              </div>
              <p className="text-white/60 mt-1 leading-relaxed">Henkelstraße 7<br />34127 Kassel — Germania</p>
              <span className="chip chip-dark mt-2 !text-[11px]">Non aperta al pubblico</span>
            </div>
            <div className="text-white/55 text-xs leading-relaxed">
              Lun–Ven: 09:00–18:00 · Sabato: 09:00–13:00
            </div>
          </div>
        </div>
      </div>

      <div className="container-x pb-10">
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/45">
          <p>© {new Date().getFullYear()} LBS Lavoro Business e Servizi in Germania — Tutti i diritti riservati. · Agenzia per l'impiego — Catania, Italia</p>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {LEGAL.map(l => (
              <li key={l.to}><Link to={l.to} className="hover:text-white/80 transition-colors">{l.label}</Link></li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
