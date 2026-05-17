import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyApiKey } from '../api';

function ShieldIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L4 5.5V11c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V5.5L12 2z"
        fill="url(#shieldGrad)" opacity="0.9" />
      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="shieldGrad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  );
}

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
    <div className="login-page">
      <div className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div className="sidebar-logo-icon" style={{ width: 40, height: 40 }}>
            <ShieldIcon size={22} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px' }}>FraudShield</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Detection Dashboard</div>
          </div>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 650, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.3px' }}>
          Sign in to your dashboard
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
          Enter your API key to access your data.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)',
              marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em',
            }}>
              API Key
            </label>
            <input
              type="text"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="Enter your API key"
              autoFocus
              className="login-input"
            />
          </div>

          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 6,
              background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)',
              color: 'var(--red)', fontSize: 13, marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginBottom: 10, padding: '10px 14px', fontSize: 14 }}
            disabled={loading || !key.trim()}
          >
            {loading ? 'Verifying…' : 'Sign In →'}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', fontSize: 12, color: 'var(--text3)' }}
            onClick={useDemoKey}
          >
            Use demo key
          </button>
        </form>
      </div>
    </div>
  );
}
