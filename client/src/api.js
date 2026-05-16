const BASE = '/api';

async function get(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export const fetchOverview  = ()           => get('/overview');
export const fetchAnomalies = ()           => get('/anomalies');
export const fetchClusters  = ()           => get('/clusters');
export const fetchGraph     = ()           => get('/graph');
export const fetchCountries = ()           => get('/events/countries');
export const fetchVisitor   = (id)         => get(`/visitor/${encodeURIComponent(id)}`);
export const fetchBehavior  = (visitorId)  => get(`/visitor/${encodeURIComponent(visitorId)}`).then(d => d.behavior || []);

export function fetchEvents(filters = {}) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
  return get(`/events?${p}`);
}

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch(`${BASE}/upload`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
