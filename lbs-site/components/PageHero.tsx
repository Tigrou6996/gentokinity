import React from 'react';

interface PageHeroProps {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}

/** Intestazione delle pagine interne: sfondo chiaro sfumato, titolo grande, azioni opzionali. */
const PageHero: React.FC<PageHeroProps> = ({ eyebrow, title, lead, actions, aside, children }) => (
  <section className="surface-tint pt-32 sm:pt-40 pb-16 sm:pb-20 overflow-hidden">
    <div className={`container-x ${aside ? 'grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center' : ''}`}>
      <div className={aside ? 'lg:col-span-7' : 'max-w-3xl'}>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="h-display text-plum-800 text-[2.6rem] sm:text-6xl lg:text-[4.25rem] mt-5">{title}</h1>
        {lead && <p className="lead mt-6 max-w-2xl">{lead}</p>}
        {actions && <div className="flex flex-wrap gap-3 mt-8">{actions}</div>}
        {children}
      </div>
      {aside && <div className="lg:col-span-5">{aside}</div>}
    </div>
  </section>
);

export default PageHero;
