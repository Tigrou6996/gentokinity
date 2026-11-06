import React from 'react';

interface DecorProps {
  className?: string;
}

export const Cloud: React.FC<DecorProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M85 45H20C12 45 6 39 6 31C6 24 11 18 18 17C18 8 25 2 34 2C40 2 45 5 48 10C50 7 54 5 58 5C67 5 74 12 74 21H75C83 21 90 27 90 35C90 41 88 45 85 45Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const CurvedArrow: React.FC<DecorProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M20 80 Q50 10 80 40" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none"/>
    <path d="M70 30 L80 40 L68 48" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

export const Cursor: React.FC<DecorProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M8 8L8 60L22 46L32 72L40 69L30 43L50 43L8 8Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const CircledX: React.FC<DecorProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="4"/>
    <path d="M26 26L54 54M54 26L26 54" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
  </svg>
);

export const NeonDoodleArrow: React.FC<{ className?: string; color?: string }> = ({ 
  className = "w-24 h-24", 
  color = "#ffdf20" 
}) => (
  <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M15 95 C 25 35, 75 15, 95 38 C 105 48, 102 65, 88 78 C 75 90, 68 85, 74 72"
      stroke={color}
      strokeWidth="8"
      strokeLinecap="square"
      fill="none"
    />
    <path
      d="M58 82 L 80 86 L 85 64"
      stroke={color}
      strokeWidth="8"
      strokeLinecap="square"
      strokeLinejoin="miter"
      fill="none"
    />
  </svg>
);

export const NeonSquiggleArrow: React.FC<{ className?: string; color?: string }> = ({ 
  className = "w-20 h-20", 
  color = "#ffdf20" 
}) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M20 75 C 30 50, 45 90, 65 40 C 75 15, 85 25, 85 35"
      stroke={color}
      strokeWidth="7"
      strokeLinecap="square"
      fill="none"
    />
    <path
      d="M70 22 L 88 35 L 75 48"
      stroke={color}
      strokeWidth="7"
      strokeLinecap="square"
      strokeLinejoin="miter"
      fill="none"
    />
  </svg>
);

export const DoodleConnector: React.FC<{ className?: string }> = ({ className = "w-16 h-12" }) => (
  <svg className={className} viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M10 40 C 25 10, 50 10, 65 30"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="square"
      fill="none"
    />
    <path
      d="M55 24 L 66 32 L 67 18"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="square"
      strokeLinejoin="miter"
      fill="none"
    />
  </svg>
);

export const RotatingStickerBadge: React.FC<{ text?: string; className?: string }> = ({
  text = "• PARTI SUBITO • ZERO RISCHI • 11 ANNI LBS ",
  className = ""
}) => (
  <div className={`relative flex items-center justify-center select-none ${className}`}>
    <div className="bg-[#ffdf20] text-[#3D2045] p-4 border-4 border-[#3D2045] shadow-[6px_6px_0px_#3D2045] transform -rotate-3 hover:rotate-0 transition-transform">
      <div className="text-[11px] font-black uppercase tracking-widest text-[#3D2045] text-center border-b-2 border-[#3D2045] pb-1 mb-2">
        GARANZIA LBS
      </div>
      <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
        <i className="fas fa-bolt text-[#3D2045]"></i>
        <span>100% REGOLARE</span>
      </div>
      <div className="text-[10px] font-extrabold text-[#3D2045]/80 mt-1 uppercase text-center">
        Zero rischi
      </div>
    </div>
  </div>
);


