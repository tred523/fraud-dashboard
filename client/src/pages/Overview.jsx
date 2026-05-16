import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchOverview, fetchEvents, fetchCountries } from '../api';
import RiskBadge from '../components/RiskBadge';
import Flags from '../components/Flags';

function LiveDot({ lastWebhookAt }) {
  const isLive = lastWebhookAt && (Date.now() - lastWebhookAt < 5 * 60 * 1000);
  const color = isLive ? '#22c55e' : 'var(--text3)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, color, fontWeight: 500 }}>{isLive ? 'Live' : 'Idle'}</span>
    </div>
  );
}

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

export default function Overview() {
  const navigate = useNavigate();
  const [overview, setOverview]   = useState(null);
  const [events, setEvents]       = useState([]);
  const [total, setTotal]         = useState(0);
  const [countries, setCountries] = useState([]);
  const [filters, setFilters]     = useState({ risk_level: '', country: '', flag: '' });
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetchOverview().then(setOverview).catch(console.error);
    fetchCountries().then(setCountries).catch(console.error);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchEvents(filters)
      .then(d => { setEvents(d.events); setTotal(d.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="page-title">Overview</h1>
            <LiveDot lastWebhookAt={overview?.last_webhook_at} />
          </div>
          <p className="page-subtitle">Real-time fraud detection across all events</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Total Events</div>
          <div className="metric-value">{overview?.total_events ?? '—'}</div>
          <div className="metric-sub">all ingested events</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">At Risk</div>
          <div className={`metric-value ${overview?.high_risk_percent > 0 ? 'metric-accent-red' : ''}`}>{overview ? `${overview.high_risk_percent}%` : '—'}</div>
          <div className="metric-sub">of all events</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Suspicious Visitors</div>
          <div className="metric-value metric-accent-orange">{overview?.suspicious_visitors ?? '—'}</div>
          <div className="metric-sub">unique visitor IDs</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Anomalies Found</div>
          <div className="metric-value metric-accent-blue">{overview?.anomalies_found ?? '—'}</div>
          <div className="metric-sub">cross-visitor patterns</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Account Activity</div>
          <div className="metric-value metric-accent-orange">{overview?.total_account_events ?? '—'}</div>
          <div className="metric-sub">ingested via API</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="filter-select" value={filters.risk_level} onChange={e => setFilter('risk_level', e.target.value)}>
          <option value="">All Risk Levels</option>
          <option value="HIGH RISK">High Risk</option>
          <option value="SUSPICIOUS">Suspicious</option>
          <option value="LOW">Low</option>
          <option value="CLEAN">Clean</option>
        </select>
        <select className="filter-select" value={filters.country} onChange={e => setFilter('country', e.target.value)}>
          <option value="">All Countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="filter-select" value={filters.flag} onChange={e => setFilter('flag', e.target.value)}>
          <option value="">All Flags</option>
          <option value="vpn">VPN</option>
          <option value="proxy">Proxy</option>
          <option value="vm">Virtual Machine</option>
          <option value="anti_detect">Anti-Detect Browser</option>
          <option value="tampering">Tampering</option>
          <option value="bot">Bot</option>
        </select>
        {(filters.risk_level || filters.country || filters.flag) && (
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}
            onClick={() => setFilters({ risk_level: '', country: '', flag: '' })}>
            Clear filters
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>
          {total} event{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Events Table */}
      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div className="loading">Loading events…</div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-text">No events match the current filters.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Visitor ID</th>
                  <th>City</th>
                  <th>OS / Device</th>
                  <th>Risk Score</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id} className="clickable" onClick={() => navigate(`/visitor/${ev.visitor_id}`)}>
                    <td style={{ color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(ev.timestamp)}</td>
                    <td>
                      <span className="mono truncate" style={{ display: 'block', color: 'var(--blue)', maxWidth: 140 }} title={ev.visitor_id}>
                        {ev.visitor_id}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {ev.city_name || '—'}
                      {ev.country_code && <span style={{ marginLeft: 5, fontSize: 11, color: 'var(--text3)' }}>{ev.country_code}</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text)' }}>{ev.os || '—'}</span>
                      {ev.browser_name && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text3)' }}>{ev.browser_name}</span>}
                    </td>
                    <td>
                      <RiskBadge level={ev.risk_level} score={ev.risk_score} />
                    </td>
                    <td><Flags event={ev} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
