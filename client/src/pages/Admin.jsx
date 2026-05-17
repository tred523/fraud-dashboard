import { useState, useEffect } from 'react';
import { fetchAdminClients, createAdminClient, verifyAdminKey } from '../api';

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function AdminKeyGate({ onVerified }) {
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = adminKey.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      await verifyAdminKey(trimmed);
      localStorage.setItem('fraudshield_admin_key', trimmed);
      onVerified();
    } catch (err) {
      setError(err.message || 'Invalid admin key');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 480 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Admin Access</div>
          <div className="page-subtitle">Enter the admin key to manage clients</div>
        </div>
      </div>
      <div className="card" style={{ padding: 24 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Admin Key
            </label>
            <input
              type="password"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              placeholder="Enter ADMIN_KEY"
              autoFocus
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '10px 12px',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, marginBottom: 12,
              background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
              color: 'var(--red)', fontSize: 13,
            }}>{error}</div>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading || !adminKey.trim()}>
            {loading ? 'Verifying…' : 'Unlock Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

function CreateClientModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await createAdminClient(name.trim(), email.trim() || undefined);
      setResult(res);
      onCreated();
    } catch (err) {
      setError(err.message || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>Create New Client</h2>
          <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>

        {result ? (
          <div>
            <div style={{
              padding: '12px 16px', borderRadius: 8, marginBottom: 16,
              background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>Client created!</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>API Key (copy now — shown once):</div>
              <code style={{
                display: 'block', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--blue)',
                wordBreak: 'break-all',
              }}>{result.api_key}</code>
            </div>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Client Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Acme Corp"
                autoFocus
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 7, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Contact Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@acmecorp.com"
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 7, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none',
                }}
              />
            </div>
            {error && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, marginBottom: 12,
                background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
                color: 'var(--red)', fontSize: 13,
              }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
                {loading ? 'Creating…' : 'Create Client'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [isAuthed, setIsAuthed] = useState(!!localStorage.getItem('fraudshield_admin_key'));

  async function loadClients() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminClients();
      setClients(data);
    } catch (err) {
      if (err.message.includes('Forbidden') || err.message.includes('403')) {
        localStorage.removeItem('fraudshield_admin_key');
        setIsAuthed(false);
      }
      setError(err.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthed) loadClients();
  }, [isAuthed]);

  if (!isAuthed) {
    return <AdminKeyGate onVerified={() => setIsAuthed(true)} />;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Admin — Client Management</div>
          <div className="page-subtitle">Manage API keys and client access</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Client
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, marginBottom: 16,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
          color: 'var(--red)', fontSize: 13,
        }}>{error}</div>
      )}

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Client', 'Email', 'API Key', 'Total Events', 'Last Active', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No clients yet</td></tr>
            ) : clients.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 550, color: 'var(--text)' }}>{c.client_name}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)' }}>{c.client_email || '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <code style={{ fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--blue)' }}>
                    {c.key.substring(0, 16)}…
                  </code>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text2)' }}>{c.total_events.toLocaleString()}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text3)' }}>{fmt(c.last_active)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    background: c.is_active ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                    color: c.is_active ? 'var(--green)' : 'var(--red)',
                    border: `1px solid ${c.is_active ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
                  }}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadClients(); }}
        />
      )}
    </div>
  );
}
