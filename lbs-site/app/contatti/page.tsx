
import React from 'react';

export default function ContactPage() {
  return (
    <div className="pt-32 pb-24 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-heading font-black mb-6">Contatti</h1>
          <p className="text-xl text-slate-500">Siamo pronti ad aiutarti. Scegli il canale che preferisci.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <a href="https://wa.me/4915739037885" className="bg-white p-10 rounded-3xl shadow-xl flex items-center gap-8 hover:scale-105 transition-transform border-b-8 border-[#25D366]">
            <i className="fab fa-whatsapp text-5xl text-[#25D366]"></i>
            <div>
              <div className="text-sm font-black text-slate-400 uppercase tracking-widest">WhatsApp</div>
              <div className="text-2xl font-black">+49 15739037885</div>
            </div>
          </a>
          <a href="tel:+393518818391" className="bg-white p-10 rounded-3xl shadow-xl flex items-center gap-8 hover:scale-105 transition-transform border-b-8 border-[#0066CC]">
            <i className="fas fa-phone text-5xl text-[#0066CC]"></i>
            <div>
              <div className="text-sm font-black text-slate-400 uppercase tracking-widest">Telefono</div>
              <div className="text-2xl font-black">+39 3518818391</div>
            </div>
          </a>
        </div>
        
        <div className="mt-16 text-center text-slate-400 font-bold">
          Email: info@lbs-work.it | Sede: Viale Vittorio Veneto 335, Catania
        </div>
      </div>
    </div>
  );
}
