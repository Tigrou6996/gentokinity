
'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { STATS, WHY_GERMANY } from '../constants';
import { getCareerAdvice } from '../geminiService';

export default function Home() {
  const [aiInput, setAiInput] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleAiAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    const result = await getCareerAdvice(aiInput);
    setAiOutput(result || '');
    setIsAiLoading(false);
    setIsDrawerOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center pt-24 pb-16 bg-[#1A2B3D] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <div className="space-y-8">
            <h1 className="text-5xl md:text-7xl font-heading font-black leading-tight tracking-tighter">
              Costruisci la tua vita in <span className="text-[#FF6B35]">Germania.</span>
            </h1>
            <p className="text-xl text-slate-300 max-w-lg font-light leading-relaxed">
              Dalla ricerca del lavoro all'alloggio, LBS ti accompagna passo dopo passo verso il successo professionale tedesco.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/contatti" className="bg-[#FF6B35] px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-all shadow-xl shadow-[#FF6B35]/20">
                Inizia Ora
              </Link>
              <Link href="/servizi" className="bg-white/10 backdrop-blur-md border border-white/20 px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition-all">
                I nostri servizi
              </Link>
            </div>
          </div>
          <div className="hidden lg:block relative">
            <img 
              src="https://images.unsplash.com/photo-1467269204594-9661b134dd2b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
              alt="Berlin Skyline" 
              className="rounded-[40px] shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-700"
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-12 -mt-10 relative z-20 max-w-6xl mx-auto w-full px-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl font-black text-[#0066CC]">{stat.value}</div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Assistant Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-heading font-black text-slate-900 mb-4">Hai dubbi? Chiedi alla nostra AI</h2>
            <p className="text-slate-500">Ottieni risposte immediate su documenti, casa e lavoro.</p>
          </div>
          <form onSubmit={handleAiAsk} className="flex gap-4 p-2 bg-white rounded-2xl shadow-lg border border-slate-200">
            <input 
              type="text" 
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Esempio: Di quali documenti ho bisogno per il trasferimento?"
              className="flex-grow px-6 py-4 outline-none text-lg"
            />
            <button 
              disabled={isAiLoading}
              className="bg-[#0066CC] text-white px-8 py-4 rounded-xl font-bold hover:bg-[#FF6B35] transition-all disabled:opacity-50"
            >
              {isAiLoading ? 'Elaborazione...' : 'Chiedi'}
            </button>
          </form>
        </div>
      </section>

      {/* AI Response Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-10 flex flex-col animate-slide-in">
            <button onClick={() => setIsDrawerOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900">
              <i className="fas fa-times text-2xl"></i>
            </button>
            <h3 className="text-2xl font-black mb-8 text-[#0066CC]">Consulente LBS AI</h3>
            <div className="flex-grow overflow-y-auto prose prose-slate">
              <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                {aiOutput}
              </div>
            </div>
            <div className="mt-8 pt-8 border-t">
              <Link href="/contatti" className="block w-full bg-[#FF6B35] text-white text-center py-4 rounded-xl font-black">
                PARLA CON UN UMANO
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
