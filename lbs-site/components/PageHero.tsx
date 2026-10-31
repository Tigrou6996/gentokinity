import React from 'react';

interface PageHeroProps {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}

/** Intestazione delle pagine interne: pannello viola arrotondato con cielo stellato (stile Payop + logo LBS). */
const PageHero: React.FC<PageHeroProps> = ({ eyebrow, title, lead, actions, aside, children }) => (
  <section className="pt-[6.25rem] px-2 sm:px-4">
    <div className="surface-brand rounded-[2rem] sm:rounded-[2.5rem] max-w-[80rem] mx-auto px-5 sm:px-12 lg:px-16 py-14 sm:py-20">
      <div className={aside ? 'grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center' : 'max-w-3xl mx-auto text-center'}>
        <div className={aside ? 'lg:col-span-7' : ''}>
          <span className="eyebrow eyebrow-light">{eyebrow}</span>
          <h1 className="h-display text-white text-[2.5rem] sm:text-6xl lg:text-[4.25rem] mt-6">{title}</h1>
          {lead && <p className={`text-white/80 text-lg leading-relaxed mt-6 ${aside ? 'max-w-2xl' : 'max-w-2xl mx-auto'}`}>{lead}</p>}
          {actions && <div className={`flex flex-wrap gap-3 mt-8 ${aside ? '' : 'justify-center'}`}>{actions}</div>}
          {children}
        </div>
        {aside && <div className="lg:col-span-5">{aside}</div>}
      </div>
    </div>
  </section>
);

export default PageHero;
