
import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import React from 'react';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-heading' });

export const metadata: Metadata = {
  title: 'LBS Lavoro Business in Germania',
  description: 'Il tuo ponte professionale per la Germania. Supporto completo per lavoro e alloggio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={`${inter.variable} ${plusJakarta.variable} scroll-smooth`}>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body className="bg-slate-50 text-slate-900 font-sans selection:bg-[#FF6B35] selection:text-white">
        <Navbar />
        {children}
        <Footer />
        {/* WhatsApp Floating Button */}
        <a 
          href="https://wa.me/4915739037885" 
          target="_blank" 
          rel="noopener noreferrer"
          className="fixed bottom-10 right-10 z-50 bg-[#25D366] text-white w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-2xl hover:scale-110 active:scale-95 transition-all hover:rotate-12"
        >
          <i className="fab fa-whatsapp"></i>
        </a>
      </body>
    </html>
  );
}
