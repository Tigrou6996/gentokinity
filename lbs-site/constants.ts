
import { Service, TeamMember, Stat, Testimonial } from './types';

export const SERVICES: Service[] = [
  {
    id: 'docs',
    title: 'Gestione Documenti',
    description: 'Ti assistiamo in tutta la burocrazia: permessi, riconoscimento titoli, contratti. Nulla ti sfugge.',
    icon: 'fa-file-contract',
    features: ['Riconoscimento titoli di studio', 'Traduzioni incluse nell\'assistenza', 'Richiesta visti e permessi']
  },
  {
    id: 'housing',
    title: 'Ricerca Alloggio',
    description: 'Non arriverai in Germania senza sapere dove dormire. Troviamo casa per te prima della partenza.',
    icon: 'fa-home',
    features: ['Ricerca appartamenti certificati', 'Supporto contratti d\'affitto', 'Allaccio utenze']
  },
  {
    id: 'travel',
    title: 'Assistenza 24/7 Durante il Viaggio',
    description: 'Ti accompagniamo passo dopo passo durante il viaggio verso la Germania con assistenza continua, traduzioni incluse e supporto in qualsiasi situazione: medico, legale o pratica.',
    icon: 'fa-headset',
    features: ['Assistenza 24/7 durante il viaggio', 'Traduzioni incluse', 'Supporto medico, legale e pratico']
  },
  {
    id: 'integration',
    title: 'Inserimento Lavorativo',
    description: 'Ti seguiamo in ogni fase dell\'inserimento in azienda. Sei in Germania, ma non sei mai solo: zero anticipi e massimo supporto.',
    icon: 'fa-user-tie',
    features: ['Zero spese prima di partire', 'Nessun anticipo richiesto', 'Supporto HR on-site']
  },
  {
    id: 'family',
    title: 'Supporto Familiare',
    description: 'Se vuoi portare la famiglia, pensiamo anche a loro: scuole, sanità, integrazione. Tutto.',
    icon: 'fa-heart',
    features: ['Iscrizione scuole per i figli', 'Assistenza sanitaria', 'Integrazione sociale']
  }
];

export const PROCESS_STEPS = [
  {
    step: "01",
    title: "Contattaci",
    description: "Chiamaci o scrivi su WhatsApp. In 24h ti richiamiamo per una consulenza gratuita.",
    icon: "fa-phone"
  },
  {
    step: "02",
    title: "Analisi del Profilo",
    description: "Valutiamo il tuo CV e ti abbiniamo alle aziende tedesche più adatte a te.",
    icon: "fa-user-check"
  },
  {
    step: "03",
    title: "Colloquio & Offerta",
    description: "Ti presentiamo alle aziende partner e gestiamo il colloquio con te.",
    icon: "fa-handshake"
  },
  {
    step: "04",
    title: "Partenza per la Germania",
    description: "Sistemiamo casa, documenti e contratto. Tu pensi solo a partire.",
    icon: "fa-plane-departure"
  }
];

export const WHY_GERMANY = [
  {
    title: "Stipendi Alti",
    description: "Stipendi medi tra i più alti d\'Europa. Potere d\'acquisto reale, non solo numeri.",
    icon: "fa-euro-sign"
  },
  {
    title: "Nessun Anticipo Mai",
    description: "Non anticipi nulla per la nostra consulenza e ricerca lavoro. Parti sereno, senza spese impreviste prima della partenza.",
    icon: "fa-check-circle"
  },
  {
    title: "Assistenza 24/7 Durante il Viaggio",
    description: "Ti seguiamo 24 ore su 24, 7 giorni su 7, anche durante il viaggio. Traduzioni incluse e supporto per medici, avvocati e qualsiasi necessità.",
    icon: "fa-headset"
  },
  {
    title: "Trasparenza Totale",
    description: "Nessun costo nascosto, nessun anticipo prima di iniziare a lavorare e condizioni concordate in totale chiarezza.",
    icon: "fa-shield-alt"
  },
  {
    title: "Traduzioni Incluse",
    description: "Le traduzioni sono incluse nella nostra assistenza. CV, contratti, certificati — tutto tradotto senza costi aggiuntivi.",
    icon: "fa-language"
  }
];

export const TEAM: TeamMember[] = [
  {
    id: '1',
    name: 'Responsabile IT',
    role: 'Sede di Catania',
    description: 'Il nostro team italiano coordina le pratiche burocratiche e supporta i candidati prima della partenza.',
    icon: 'fa-user-tie'
  },
  {
    id: '2',
    name: 'Responsabile DE',
    role: 'Sede in Germania',
    description: 'Il nostro team in Germania gestisce i rapporti con le aziende e l\'inserimento lavorativo sul posto.',
    icon: 'fa-user-graduate'
  },
  {
    id: '3',
    name: 'Supporto h24',
    role: 'Assistenza Continua',
    description: 'Un team dedicato sempre disponibile, anche di notte e nei weekend, per ogni emergenza o necessità.',
    icon: 'fa-headset'
  }
];

export const STATS: Stat[] = [
  { label: 'Anni di Esperienza', value: '11+' },
  { label: 'Lavoratori Collocati', value: '350+' },
  { label: 'Aziende Partner', value: '200+' },
  { label: 'Assistenza Dedicata', value: '100%' }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Giuseppe M.',
    role: 'Operaio Metalmeccanico, Monaco',
    content: 'In 3 settimane avevo già il contratto firmato e la casa trovata. Servizio impeccabile, zero costi.',
    initial: 'G'
  },
  {
    id: '2',
    name: 'Maria C.',
    role: 'Infermiera, Berlino',
    content: 'Mi hanno seguito passo per passo: dal riconoscimento del titolo al primo giorno di lavoro. Professionisti veri.',
    initial: 'M'
  },
  {
    id: '3',
    name: 'Antonio R.',
    role: 'Cuoco, Amburgo',
    content: 'Ero scettico, ma hanno fatto tutto quello che promettevano. Ora vivo e lavoro in Germania felice.',
    initial: 'A'
  }
];
