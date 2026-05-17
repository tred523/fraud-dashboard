const BASE = '/api';

function getApiKey() {
  return localStorage.getItem('fraudshield_api_key') || '';
}

function getAdminKey() {
  return localStorage.getItem('fraudshield_admin_key') || '';
}

async function get(path) {
  const r = await fetch(BASE + path, {
    headers: { 'X-API-Key': getApiKey() },
  });
  if (r.status === 401) {
    localStorage.removeItem('fraudshield_api_key');
    localStorage.removeItem('fraudshield_client_name');
    localStorage.removeItem('fraudshield_is_admin');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
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

export const fetchVerdict      = (id)  => get(`/verdict/${encodeURIComponent(id)}`);
export const fetchVerdictBatch = (ids) => get(`/verdict/batch?ids=${ids.map(encodeURIComponent).join(',')}`);

export const fetchAccounts      = ()   => get('/accounts');
export const fetchAccountDetail = (id) => get(`/accounts/${encodeURIComponent(id)}`);

export async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', getApiKey());
  const r = await fetch(`${BASE}/upload`, {
    method: 'POST',
    body: fd,
    headers: { 'X-API-Key': getApiKey() },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function verifyApiKey(apiKey) {
  const r = await fetch(`${BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'Invalid key' }));
    throw new Error(err.error || 'Invalid API key');
  }
  return r.json();
}

export async function fetchAdminClients() {
  const r = await fetch(`${BASE}/admin/clients`, {
    headers: { 'X-Admin-Key': getAdminKey() },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createAdminClient(client_name, client_email) {
  const r = await fetch(`${BASE}/admin/create-client`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': getAdminKey(),
    },
    body: JSON.stringify({ client_name, client_email }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function verifyAdminKey(admin_key) {
  const r = await fetch(`${BASE}/admin/verify-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_key }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: 'Invalid key' }));
    throw new Error(err.error || 'Invalid admin key');
  }
  return r.json();
}
