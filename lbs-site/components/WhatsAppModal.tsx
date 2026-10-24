import React from 'react';
import { CloseButton } from './CloseButton';
import FluidOrb from './ui/fluid-orb';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="comic-card border-8 border-[#3D2045] bg-[var(--card-bg)] text-black dark:text-white max-w-2xl w-full p-6 sm:p-10 relative shadow-[12px_12px_0px_#3D2045] animate-in fade-in zoom-in duration-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* FluidOrb decorativa — tema verde WhatsApp */}
        <div className="pointer-events-none absolute -top-12 -right-12 opacity-15">
          <FluidOrb size={180} color="#25D366" />
        </div>

        {/* CloseButton animato */}
        <div className="absolute top-4 right-4 z-10">
          <CloseButton onConfirm={onClose} />
        </div>

        {/* Intestazione Modal */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-1 font-black text-xs uppercase tracking-widest border-2 border-[#3D2045] mb-3">
            <i className="fab fa-whatsapp text-base" /> Assistenza WhatsApp LBS
          </div>
          <h2 className="text-2xl sm:text-4xl font-heading font-black text-black dark:text-white uppercase tracking-tight">
            Scegli il tuo <span className="text-[#6E4274]">contatto</span>
          </h2>
          <p className="text-sm font-bold text-black/70 dark:text-white/70 mt-2">
            Seleziona la sede con cui desideri entrare in contatto su WhatsApp:
          </p>
        </div>

        {/* Due colonne: Germania e Italia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          {/* Card 1: GERMANIA 🇩🇪 */}
          <div className="comic-card border-4 border-[#3D2045] p-6 bg-white dark:bg-[#1a0d20] flex flex-col justify-between items-center text-center shadow-[4px_4px_0px_#3D2045] hover:border-[#25D366] transition-colors">
            <div className="w-16 h-16 rounded-full bg-green-500/10 text-3xl border-4 border-[#3D2045] flex items-center justify-center mb-4">
              🇩🇪
            </div>
            <h3 className="text-xl font-heading font-black uppercase text-black dark:text-white mb-1">
              Numero Tedesco
            </h3>
            <span className="text-xs font-black text-[#6E4274] dark:text-yellow-300 uppercase tracking-widest mb-3">
              Sede Germania (DE)
            </span>
            <p className="text-xs font-bold text-black/60 dark:text-white/60 mb-6 leading-relaxed">
              Per informazioni dirette su lavoro, alloggio e assistenza sul posto in Germania.
            </p>
            <a
              href="https://wa.me/4915739037885"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="comic-button bg-[#25D366] text-white border-[#3D2045] w-full py-3.5 text-xs sm:text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
            >
              <i className="fab fa-whatsapp text-lg" /> +49 1573 9037885
            </a>
          </div>

          {/* Card 2: ITALIA 🇮🇹 */}
          <div className="comic-card border-4 border-[#3D2045] p-6 bg-white dark:bg-[#1a0d20] flex flex-col justify-between items-center text-center shadow-[4px_4px_0px_#3D2045] hover:border-[#25D366] transition-colors">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 text-3xl border-4 border-[#3D2045] flex items-center justify-center mb-4">
              🇮🇹
            </div>
            <h3 className="text-xl font-heading font-black uppercase text-black dark:text-white mb-1">
              Numero Italiano
            </h3>
            <span className="text-xs font-black text-[#6E4274] dark:text-yellow-300 uppercase tracking-widest mb-3">
              Sede Italia (IT)
            </span>
            <p className="text-xs font-bold text-black/60 dark:text-white/60 mb-6 leading-relaxed">
              Per informazioni preliminari, requisiti, contratti e prima consulenza dall'Italia.
            </p>
            <a
              href="https://wa.me/393518818391"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="comic-button bg-[#25D366] text-white border-[#3D2045] w-full py-3.5 text-xs sm:text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-green-600 transition-colors"
            >
              <i className="fab fa-whatsapp text-lg" /> +39 351 881 8391
            </a>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="text-center pt-2">
          <button
            onClick={onClose}
            className="text-xs font-black uppercase tracking-widest text-black/50 dark:text-white/50 hover:text-[#6E4274] underline cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
