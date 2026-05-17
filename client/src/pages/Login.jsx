import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyApiKey } from '../api';

export default function Login() {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const result = await verifyApiKey(trimmed);
      localStorage.setItem('fraudshield_api_key', trimmed);
      localStorage.setItem('fraudshield_client_name', result.client_name);
      localStorage.setItem('fraudshield_is_admin', result.is_admin ? 'true' : 'false');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid API key');
    } finally {
      setLoading(false);
    }
  }

  function useDemoKey() {
    setKey('demo_key_12345');
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 400,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div className="sidebar-logo-icon" style={{ width: 38, height: 38, fontSize: 18 }}>FS</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px' }}>FraudShield</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Detection Dashboard</div>
          </div>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 650, color: 'var(--text)', marginBottom: 6 }}>Sign in to your dashboard</h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>Enter your API key to access your data.</p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              API Key
            </label>
            <input
              type="text"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="Enter your API key"
              autoFocus
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                padding: '10px 12px',
                color: 'var(--text)',
                fontSize: 13,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(239,68,68,.1)',
              border: '1px solid rgba(239,68,68,.2)',
              color: 'var(--red)',
              fontSize: 13,
              marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }}
            disabled={loading || !key.trim()}
          >
            {loading ? 'Verifying…' : 'Sign In'}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', fontSize: 12, color: 'var(--text3)' }}
            onClick={useDemoKey}
          >
            Use demo key (demo_key_12345)
          </button>
        </form>
      </div>
    </div>
  );
}
