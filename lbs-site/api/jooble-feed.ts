// Vercel Serverless Function: api/jooble-feed.ts
// Genera dinamicamente il feed XML per Jooble (https://de.jooble.org / https://it.jooble.org)
// Conforme al 100% alle specifiche ufficiali "Jooble XML Feed Specifications"

interface OffertaRow {
  id: string;
  titolo: string;
  azienda: string | null;
  citta: string;
  stato_germania: string | null;
  settore: string;
  contratto: string;
  stipendio_min: number | null;
  stipendio_max: number | null;
  stipendio_tipo: string;
  stipendio_modalita: string;
  descrizione: string;
  requisiti: string | null;
  attiva: boolean;
  created_at: string;
  updated_at: string;
  slug: string | null;
  immagine_url: string | null;
}

// Formatta data nel formato richiesto da Jooble: DD.MM.YYYY
function formatDateJooble(dateStr?: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return formatDateJooble(new Date().toISOString());
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// Calcola la data di scadenza (es. 45 o 60 giorni dopo la data di pubblicazione/aggiornamento)
function formatExpireDateJooble(dateStr?: string | null, daysAhead = 60): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return formatExpireDateJooble(new Date().toISOString(), daysAhead);
  d.setDate(d.getDate() + daysAhead);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// Mappa tipo contratto nei valori ammessi da Jooble:
// full-time, part-time, contract, internship, temporary
function mapJobType(contratto?: string | null): string {
  const c = (contratto || '').toLowerCase();
  if (c.includes('determinato') && !c.includes('indeterminato')) return 'contract';
  if (c.includes('stagionale')) return 'temporary';
  if (c.includes('part-time') || c.includes('part time')) return 'part-time';
  if (c.includes('stage') || c.includes('tirocinio') || c.includes('apprendistato')) return 'internship';
  return 'full-time';
}

// Formatta lo stipendio nel formato richiesto da Jooble (es. "2000€ - 2200€/Monat" o "2000€")
function formatSalary(min: number | null, max: number | null, tipo?: string, modalita?: string): string {
  const tipoLabel = tipo === 'netto' ? 'netto' : 'brutto';
  if (modalita === 'a_partire_da' && min) return `ab ${min}€/Monat ${tipoLabel}`;
  if (modalita === 'fisso' && min) return `${min}€/Monat ${tipoLabel}`;
  if (min && max) {
    if (min === max) return `${min}€/Monat ${tipoLabel}`;
    return `${min}€ - ${max}€/Monat ${tipoLabel}`;
  }
  if (min) return `ab ${min}€/Monat ${tipoLabel}`;
  if (max) return `bis ${max}€/Monat ${tipoLabel}`;
  return '';
}

// Converte testo semplice in HTML pulito per la descrizione
function formatDescriptionToHtml(desc: string, req: string | null): string {
  // Suddivide in paragrafi
  const cleanDesc = desc
    .split(/\n\s*\n/)
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      // Sostituisci singoli a capo con <br/>
      const withBr = trimmed.replace(/\n/g, '<br/>');
      return `<p>${withBr}</p>`;
    })
    .filter(Boolean)
    .join('');

  let reqHtml = '';
  if (req && req.trim()) {
    const lines = req.split('\n').map(l => l.trim()).filter(Boolean);
    const listItems = lines.map(l => `<li>${l}</li>`).join('');
    reqHtml = `<h3>Requisiti:</h3><ul>${listItems}</ul>`;
  }

  return cleanDesc + reqHtml;
}

export default async function handler(req: any, res: any) {
  // CORS & Header XML
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://iedgiiucirqqrldvqqro.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_A-QQ2F_-qrzdMN34Q8liZQ_lNbJ671B';

  const baseUrl = 'https://www.lbswork.com';
  const defaultCompany = 'LBS Business & Servizi';

  const contactEmail = 'info@lbswork.com';

  try {
    const fetchUrl = `${supabaseUrl}/rest/v1/offerte_lavoro?select=*&attiva=eq.true&order=created_at.desc`;
    const response = await fetch(fetchUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) {
      console.error('[jooble-feed] Errore Supabase:', response.status, await response.text());
      return res.status(500).send('<?xml version="1.0" encoding="utf-8"?><jobs></jobs>');
    }

    const offerte: OffertaRow[] = await response.json();

    const jobsXml = offerte
      .map(o => {
        const jobUrl = o.slug ? `${baseUrl}/offerte/${encodeURIComponent(o.slug)}` : `${baseUrl}/offerte/${o.id}`;
        const region = [o.citta, o.stato_germania, 'Deutschland'].filter(Boolean).join(', ');
        const salaryText = formatSalary(o.stipendio_min, o.stipendio_max, o.stipendio_tipo, o.stipendio_modalita);
        const htmlDesc = formatDescriptionToHtml(o.descrizione, o.requisiti);
        const pubDate = formatDateJooble(o.created_at);
        const updatedDate = formatDateJooble(o.updated_at || o.created_at);
        const expireDate = formatExpireDateJooble(o.updated_at || o.created_at, 60);
        const jobType = mapJobType(o.contratto);
        const companyName = o.azienda && o.azienda.trim() ? o.azienda.trim() : defaultCompany;


        return `  <job id="${o.id}">
    <link><![CDATA[${jobUrl}]]></link>
    <name><![CDATA[${o.titolo}]]></name>
    <region><![CDATA[${region}]]></region>
    ${salaryText ? `<salary><![CDATA[${salaryText}]]></salary>` : ''}
    <description><![CDATA[${htmlDesc}]]></description>
    <company><![CDATA[${companyName}]]></company>

    <pubdate>${pubDate}</pubdate>
    <updated>${updatedDate}</updated>
    <expire>${expireDate}</expire>
    <jobtype>${jobType}</jobtype>
    <email><![CDATA[${contactEmail}]]></email>
  </job>`;
      })
      .join('\n');

    const xmlOutput = `<?xml version="1.0" encoding="utf-8"?>
<jobs>
${jobsXml}
</jobs>`;

    return res.status(200).send(xmlOutput);
  } catch (err: any) {
    console.error('[jooble-feed] Eccezione:', err);
    return res.status(500).send('<?xml version="1.0" encoding="utf-8"?><jobs></jobs>');
  }
}
