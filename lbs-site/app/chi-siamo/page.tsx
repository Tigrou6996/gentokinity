
import React from 'react';
import { TEAM } from '../../constants';

export default function AboutPage() {
  return (
    <div className="pt-32 pb-24 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="text-5xl font-black mb-12 text-center tracking-tighter">Chi <span className="text-[#FF6B35]">Siamo</span></h1>
        <div className="prose prose-xl max-w-none text-slate-600 mb-20 leading-relaxed">
          <p>
            LBS Lavoro Business in Germania è un'agenzia leader specializzata nell'internazionalizzazione del talento. 
            Con oltre 15 anni di esperienza, abbiamo costruito una rete solida tra l'Italia e la Germania per offrire opportunità reali e supporto concreto.
          </p>
          <p>
            Il nostro approccio non è solo professionale ma profondamente umano: comprendiamo le sfide di un trasferimento internazionale e lavoriamo per renderlo fluido, sicuro e gratificante.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {TEAM.map(member => (
            <div key={member.id} className="text-center">
              <div className="w-40 h-40 bg-slate-50 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl text-[#0066CC] border border-slate-100">
                <i className={`fas ${member.icon}`}></i>
              </div>
              <h3 className="text-xl font-black">{member.name}</h3>
              <p className="text-[#FF6B35] text-xs font-bold uppercase tracking-widest mb-4">{member.role}</p>
              <p className="text-slate-500 text-sm italic">{member.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
