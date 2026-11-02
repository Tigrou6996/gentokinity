// transit: orari, coincidenze e fermate del trasporto pubblico tedesco (DB, bus e treni regionali/locali)
// Espone le stesse rotte di db-rest (https://v6.db.transport.rest) così l'app funziona con questo server
// oppure con un'istanza db-rest. Dati da bahn.de tramite db-vendo-client.
//
//   GET /transit/locations?query=Kassel&results=8
//   GET /transit/locations/nearby?latitude=..&longitude=..&results=8
//   GET /transit/journeys?from=<id>&to=<id>&departure=<ISO>&results=5
//       (oppure from.latitude, from.longitude, from.address per partire da un indirizzo)
//   GET /transit/journeys/<refreshToken>   (aggiorna ritardi e binari di una soluzione salvata)
//   GET /transit/trips/<tripId>
//   GET /transit/stops/<id>/departures?duration=60
import { createClient } from 'npm:db-vendo-client@6';
import { profile as dbnav } from 'npm:db-vendo-client@6/p/dbnav/index.js';

const client = createClient(dbnav, 'lbs-viaggio (info@lbswork.com)');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// a place given as "<prefix>=<stop id>" or "<prefix>.latitude/.longitude/.address"
function place(q: URLSearchParams, prefix: string): string | Record<string, unknown> | null {
  const id = q.get(prefix);
  if (id) return id;
  const lat = q.get(`${prefix}.latitude`), lon = q.get(`${prefix}.longitude`);
  if (lat && lon) return { type: 'location', latitude: +lat, longitude: +lon, address: q.get(`${prefix}.address`) ?? 'Posizione' };
  return null;
}
const num = (v: string | null, d: number) => (v && !isNaN(+v) ? Math.min(+v, 20) : d);

Deno.serve(async (req) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);
  const url = new URL(req.url), q = url.searchParams;
  const path = url.pathname.replace(/^.*?\/transit/, '') || '/';
  try {
    if (path === '/locations') {
      const query = (q.get('query') ?? '').trim();
      if (!query) return json({ error: 'query mancante' }, 400);
      return json(await client.locations(query, { results: num(q.get('results'), 8), stops: true, addresses: true, poi: false, language: 'de' }));
    }
    if (path === '/locations/nearby') {
      const lat = +(q.get('latitude') ?? NaN), lon = +(q.get('longitude') ?? NaN);
      if (isNaN(lat) || isNaN(lon)) return json({ error: 'latitude/longitude mancanti' }, 400);
      return json(await client.nearby({ type: 'location', latitude: lat, longitude: lon }, { results: num(q.get('results'), 8), distance: 1500, poi: false }));
    }
    if (path === '/journeys') {
      const from = place(q, 'from'), to = place(q, 'to');
      if (!from || !to) return json({ error: 'from/to mancanti' }, 400);
      const departure = q.get('departure'), arrival = q.get('arrival');
      return json(await client.journeys(from, to, {
        results: num(q.get('results'), 5), stopovers: true, polylines: true, remarks: true, language: 'de',
        ...(arrival ? { arrival: new Date(arrival) } : { departure: departure ? new Date(departure) : new Date() }),
      }));
    }
    let m = path.match(/^\/journeys\/(.+)$/);
    if (m) return json(await client.refreshJourney(decodeURIComponent(m[1]), { stopovers: true, polylines: true, remarks: true, language: 'de' }));
    m = path.match(/^\/trips\/(.+)$/);
    if (m) return json(await client.trip(decodeURIComponent(m[1]), { stopovers: true, polyline: true, remarks: true, language: 'de' }));
    m = path.match(/^\/stops\/([^/]+)\/departures$/);
    if (m) return json(await client.departures(decodeURIComponent(m[1]), { duration: Math.min(+(q.get('duration') ?? 60) || 60, 180), results: 30, remarks: false, language: 'de' }));
    return json({ error: 'not found' }, 404);
  } catch (e) {
    const err = e as { message?: string; isHafasError?: boolean; code?: string };
    console.error('transit error', path, err?.message);
    return json({ error: err?.message ?? String(e), code: err?.code ?? null }, err?.isHafasError ? 502 : 500);
  }
});
