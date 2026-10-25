import React, { useEffect } from 'react';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CONTACTS = [
  {
    flag: '🇩🇪',
    title: 'Numero tedesco',
    tag: 'Sede Germania',
    text: 'Informazioni dirette su lavoro, alloggio e assistenza sul posto in Germania.',
    href: 'https://wa.me/4915739037885',
    number: '+49 1573 9037885',
  },
  {
    flag: '🇮🇹',
    title: 'Numero italiano',
    tag: 'Sede Italia',
    text: 'Informazioni preliminari, requisiti, contratti e prima consulenza dall’Italia.',
    href: 'https://wa.me/393518818391',
    number: '+39 351 881 8391',
  },
];

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-plum-950/60 backdrop-blur-sm p-0 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-modal-title"
    >
      <div
        className="animate-pop-in relative w-full sm:max-w-2xl bg-white rounded-t-xl sm:rounded-xl shadow-[var(--shadow-lift)] p-6 sm:p-10 max-h-[92dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >

        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-4 right-4 h-11 w-11 rounded-md bg-plum-50 text-plum-800 hover:bg-plum-100 flex items-center justify-center transition-colors cursor-pointer"
        >
          <i className="fas fa-times" />
        </button>

        <div className="relative text-center mb-8">
          <span className="chip !bg-wa/10 !text-[#128C4B] !border-wa/20 mb-4">
            <i className="fab fa-whatsapp text-sm" /> Assistenza WhatsApp
          </span>
          <h2 id="wa-modal-title" className="h-display text-3xl sm:text-4xl text-plum-800">
            Con chi vuoi parlare?
          </h2>
          <p className="text-ink-soft mt-2">Scegli la sede: rispondiamo a entrambi i numeri.</p>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CONTACTS.map(c => (
            <div key={c.href} className="card card-hover p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl leading-none" aria-hidden="true">{c.flag}</span>
                <div>
                  <h3 className="font-semibold text-lg text-plum-800 leading-tight">{c.title}</h3>
                  <span className="text-xs font-semibold text-plum-600">{c.tag}</span>
                </div>
              </div>
              <p className="text-sm text-ink-soft leading-relaxed mb-5 flex-1">{c.text}</p>
              <a
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="btn btn-wa w-full"
              >
                <i className="fab fa-whatsapp text-lg" /> {c.number}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
