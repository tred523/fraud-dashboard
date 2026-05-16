import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAccounts } from '../api';
import VerdictBadge from '../components/VerdictBadge';

const EVENT_TYPE_COLORS = {
  login:           { bg: '#60a5fa22', color: '#60a5fa', border: '#60a5fa44' },
  signup:          { bg: '#34d39922', color: '#34d399', border: '#34d39944' },
  payment:         { bg: '#f472b622', color: '#f472b6', border: '#f472b644' },
  password_change: { bg: '#fb923c22', color: '#fb923c', border: '#fb923c44' },
  api_call:        { bg: '#a78bfa22', color: '#a78bfa', border: '#a78bfa44' },
  export:          { bg: '#fbbf2422', color: '#fbbf24', border: '#fbbf2444' },
  settings_change: { bg: '#94a3b822', color: '#94a3b8', border: '#94a3b844' },
};

function EventTypePill({ type }) {
  const s = EVENT_TYPE_COLORS[type] || { bg: 'var(--border2)', color: 'var(--text3)', border: 'var(--border2)' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: 10,
      fontSize: 11,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {type.replace('_', ' ')}
    </span>
  );
}

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAccounts()
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading accounts…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">{accounts.length} account{accounts.length !== 1 ? 's' : ''} with activity</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <div className="empty-text">No account events ingested yet.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account ID</th>
                <th>Last Seen</th>
                <th>Events</th>
                <th>Event Types</th>
                <th>Payment Methods</th>
                <th>Linked Visitors</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr
                  key={acc.account_id}
                  className="clickable"
                  onClick={() => navigate(`/accounts/${encodeURIComponent(acc.account_id)}`)}
                >
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text1)' }}>
                      {acc.account_id}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text3)', fontSize: 12 }}>{fmt(acc.last_seen)}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text1)' }}>{acc.total_events}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {acc.event_types.map(t => <EventTypePill key={t} type={t} />)}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text2)' }}>{acc.payment_methods_count}</td>
                  <td style={{ color: 'var(--text3)', fontSize: 12 }}>
                    {acc.linked_visitor_ids.length > 0
                      ? acc.linked_visitor_ids.length
                      : <span style={{ color: 'var(--text4)' }}>—</span>}
                  </td>
                  <td>
                    <VerdictBadge verdict={acc.verdict} score={acc.verdict_score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
