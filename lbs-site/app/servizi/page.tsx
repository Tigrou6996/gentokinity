
import React from 'react';
import { SERVICES } from '../../constants';

export default function ServicesPage() {
  return (
    <div className="pt-32 pb-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <h1 className="text-4xl md:text-6xl font-heading font-black text-slate-900 mb-12 text-center">
          I Nostri <span className="text-[#0066CC]">Servizi</span>
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICES.map((service) => (
            <div key={service.id} className="p-10 border border-slate-100 rounded-3xl hover:shadow-2xl transition-all group">
              <div className="w-16 h-16 bg-[#0066CC]/10 text-[#0066CC] rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:bg-[#0066CC] group-hover:text-white transition-colors">
                <i className={`fas ${service.icon}`}></i>
              </div>
              <h3 className="text-2xl font-bold mb-4">{service.title}</h3>
              <p className="text-slate-500 mb-6">{service.description}</p>
              <ul className="space-y-2">
                {service.features.map((f, i) => (
                  <li key={i} className="text-sm font-bold flex items-center gap-2">
                    <i className="fas fa-check text-green-500"></i> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
