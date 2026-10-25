import React from 'react';
import { Link } from 'react-router-dom';

const CookiePolicy: React.FC = () => {
  const lastUpdate = '03 Luglio 2025';

  const cookies = [
    {
      category: 'Tecnici / Necessari',
      required: true,
      color: '#25D366',
      icon: 'fa-lock',
      items: [
        { name: 'lbs_cookie_consent', provider: 'LBS (questo sito)', purpose: 'Memorizza la scelta dell\'utente riguardo ai cookie (accettati/rifiutati)', duration: '12 mesi', type: 'localStorage' },
        { name: 'sb-* (Supabase)', provider: 'Supabase Inc.', purpose: 'Gestione sessione utente autenticato (accesso area riservata)', duration: 'Sessione / 1 settimana', type: 'Cookie HTTP' },
      ],
    },
    {
      category: 'Analitici (con consenso)',
      required: false,
      color: '#6E4274',
      icon: 'fa-chart-bar',
      items: [
        { name: '_ga', provider: 'Google Analytics', purpose: 'Identifica gli utenti univoci per statistiche aggregate di navigazione', duration: '2 anni', type: 'Cookie HTTP' },
        { name: '_ga_434XX8P8NY', provider: 'Google Analytics', purpose: 'Mantiene lo stato della sessione per Google Analytics 4', duration: '2 anni', type: 'Cookie HTTP' },
        { name: '_gid', provider: 'Google Analytics', purpose: 'Distingue gli utenti nelle statistiche giornaliere', duration: '24 ore', type: 'Cookie HTTP' },
      ],
    },
  ];

  return (
    <div className="pt-32 sm:pt-36 pb-24">
      <div className="max-w-4xl mx-auto px-6">

        {/* Header */}
        <div className="mb-12 rounded-xl surface-plum p-8 sm:p-12 md:p-16 overflow-hidden">
          <div className="chip chip-sun mb-6">
            Informativa Legale
          </div>
          <h1 className="h-display text-4xl md:text-6xl text-white mb-4">
            Cookie<br /><span className="text-sun-400">Policy</span>
          </h1>
          <p className="text-white/65 text-sm">
            Ultimo aggiornamento: {lastUpdate} — Ai sensi del D.Lgs. 196/2003 e GDPR (Reg. UE 2016/679)
          </p>
        </div>

        <div className="space-y-10">

          {/* Cosa sono i cookie */}
          <section className="card p-6 sm:p-8">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-plum-800 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-md bg-plum-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">1</span>
              Cosa Sono i Cookie
            </h2>
            <p className="text-ink-soft leading-relaxed text-sm">
              I cookie sono piccoli file di testo che i siti web salvano sul tuo dispositivo (computer, smartphone, tablet) durante la navigazione. Permettono al sito di ricordare le tue azioni e preferenze per un certo periodo di tempo, così non devi reinserirle ogni volta che torni sul sito o navighi tra le pagine.
            </p>
          </section>

          {/* Tabella cookie */}
          <section className="card p-6 sm:p-8">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-plum-800 mb-6 flex items-center gap-3">
              <span className="w-8 h-8 rounded-md bg-plum-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">2</span>
              Cookie Utilizzati da Questo Sito
            </h2>
            <div className="space-y-8">
              {cookies.map((cat, ci) => (
                <div key={ci}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm" style={{ background: cat.color }}>
                      <i className={`fas ${cat.icon}`} />
                    </div>
                    <div>
                      <span className="font-semibold text-plum-800 uppercase tracking-tight text-sm">{cat.category}</span>
                      {cat.required
                        ? <span className="ml-2 text-[10px] font-semibold text-white bg-[#25D366] px-2 py-0.5 uppercase tracking-widest rounded-md">Sempre Attivi</span>
                        : <span className="ml-2 text-[10px] font-semibold text-white bg-plum-600 px-2 py-0.5 uppercase tracking-widest rounded-md">Solo con Consenso</span>
                      }
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-line">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-plum-800 text-white">
                          <th className="text-left p-3 uppercase tracking-widest font-semibold">Nome</th>
                          <th className="text-left p-3 uppercase tracking-widest font-semibold">Fornitore</th>
                          <th className="text-left p-3 uppercase tracking-widest font-semibold hidden md:table-cell">Finalità</th>
                          <th className="text-left p-3 uppercase tracking-widest font-semibold">Durata</th>
                          <th className="text-left p-3 uppercase tracking-widest font-semibold hidden sm:table-cell">Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.items.map((item, ii) => (
                          <tr key={ii} className={ii % 2 === 0 ? 'bg-[#f9f6fa]' : 'bg-white'}>
                            <td className="p-3 text-plum-800 font-semibold">{item.name}</td>
                            <td className="p-3 text-ink-soft">{item.provider}</td>
                            <td className="p-3 text-ink-soft hidden md:table-cell">{item.purpose}</td>
                            <td className="p-3 text-ink-soft whitespace-nowrap">{item.duration}</td>
                            <td className="p-3 text-ink-soft hidden sm:table-cell">{item.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Google Analytics */}
          <section className="card p-6 sm:p-8">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-plum-800 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-md bg-plum-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">3</span>
              Google Analytics
            </h2>
            <p className="text-ink-soft leading-relaxed text-sm mb-4">
              Questo sito utilizza <strong className="text-plum-800">Google Analytics 4</strong> (Measurement ID: <code className="bg-plum-50 px-2 py-0.5 rounded-md border border-line text-plum-600">G-434XX8P8NY</code>), un servizio di analisi web fornito da Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA.
            </p>
            <ul className="space-y-2 text-sm text-ink-soft">
              {[
                'Gli indirizzi IP sono anonimizzati prima dell\'invio a Google (anonymize_ip: true)',
                'Google Analytics è attivato SOLO con il consenso esplicito dell\'utente',
                'I dati sono conservati da Google per 14 mesi (impostazione predefinita)',
                'Google può usare questi dati secondo la propria Privacy Policy',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-plum-600 flex items-center justify-center text-white text-[9px] flex-shrink-0 mt-0.5">
                    <i className="fas fa-check" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-ink-soft text-xs mt-4">
              Privacy Policy Google: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-plum-600 underline">policies.google.com/privacy</a> &nbsp;|&nbsp;
              Opt-out GA: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-plum-600 underline">tools.google.com/dlpage/gaoptout</a>
            </p>
          </section>

          {/* Come gestire i cookie */}
          <section className="card p-6 sm:p-8">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-plum-800 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-md bg-plum-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">4</span>
              Come Gestire o Revocare il Consenso
            </h2>
            <p className="text-ink-soft text-sm mb-4 leading-relaxed">
              Puoi revocare il consenso ai cookie analitici in qualsiasi momento cancellando i dati memorizzati nel tuo browser:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { browser: 'Chrome', url: 'support.google.com/chrome/answer/95647' },
                { browser: 'Firefox', url: 'support.mozilla.org/it/kb/Eliminare%20i%20cookie' },
                { browser: 'Safari', url: 'support.apple.com/it-it/guide/safari/sfri11471' },
                { browser: 'Edge', url: 'support.microsoft.com/it-it/windows/eliminare-i-cookie' },
              ].map((b, i) => (
                <a key={i} href={`https://${b.url}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-plum-50 rounded-xl border border-line p-3 hover:border-plum-300 transition-colors group">
                  <i className="fas fa-external-link-alt text-plum-600 text-xs" />
                  <span className="text-plum-800 group-hover:text-plum-600 transition-colors">{b.browser} — Gestisci Cookie</span>
                </a>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-sun-100 border border-sun-300 p-4">
              <p className="text-sm font-semibold text-plum-800 flex items-start gap-3">
                <i className="fas fa-info-circle text-yellow-500 mt-0.5" />
                <span>Per revocare il consenso sul nostro sito: cancella <strong>lbs_cookie_consent</strong> dal localStorage del browser (Strumenti Sviluppatore → Application → Local Storage). Il banner riapparirà alla visita successiva.</span>
              </p>
            </div>
          </section>

          {/* Links */}
          <div className="flex flex-wrap gap-4">
            <Link to="/privacy-policy" className="btn btn-primary">
              <i className="fas fa-shield-alt" /> Privacy Policy
            </Link>
            <Link to="/termini-e-condizioni" className="btn btn-dark">
              <i className="fas fa-file-contract" /> Termini e Condizioni
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;
