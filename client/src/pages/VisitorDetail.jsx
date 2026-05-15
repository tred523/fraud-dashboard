import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fetchVisitor } from '../api';
import RiskBadge, { riskColor } from '../components/RiskBadge';
import Flags, { FlagExplanations } from '../components/Flags';

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function FpItem({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="fp-item">
      <div className="fp-label">{label}</div>
      <div className="fp-value">{String(value)}</div>
    </div>
  );
}

export default function VisitorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchVisitor(id)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading visitor data…</div>;
  if (error)   return <div className="page"><div className="empty-state"><div className="empty-icon">⚠️</div><div className="empty-text">{error}</div></div></div>;
  if (!data)   return null;

  const { events, related } = data;
  const latest = events[events.length - 1];
  const maxRiskLevel = events.reduce((m, e) => {
    const order = { CLEAN: 0, LOW: 1, SUSPICIOUS: 2, 'HIGH RISK': 3 };
    return (order[e.risk_level] ?? 0) > (order[m] ?? 0) ? e.risk_level : m;
  }, 'CLEAN');

  const chartData = events.map(e => ({
    time: fmt(e.timestamp),
    score: e.risk_score,
    level: e.risk_level,
  }));

  const relatedAll = [
    ...related.by_ip.map(r => ({ ...r, via: 'IP' })),
    ...related.by_font.map(r => ({ ...r, via: 'Font' })),
    ...related.by_webgl.map(r => ({ ...r, via: 'GPU' })),
  ];
  const uniqueRelated = Object.values(
    relatedAll.reduce((acc, r) => {
      if (!acc[r.visitor_id]) acc[r.visitor_id] = r;
      else acc[r.visitor_id].via += ` + ${r.via}`;
      return acc;
    }, {})
  );

  return (
    <div className="page">
      <Link to="/" className="back-link">← Back to Overview</Link>

      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ fontSize: 16, color: 'var(--text2)' }}>{id}</span>
            <RiskBadge level={maxRiskLevel} />
          </h1>
          <p className="page-subtitle">
            {events.length} event{events.length !== 1 ? 's' : ''} · first seen {fmt(events[0]?.timestamp)} · last seen {fmt(events[events.length - 1]?.timestamp)}
          </p>
        </div>
      </div>

      <div className="detail-grid">
        {/* Left column */}
        <div>
          {/* Risk Timeline */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">Risk Score Timeline</span>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    formatter={(v, _, props) => [`${v} (${props.payload.level})`, 'Risk Score']}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#riskGrad)"
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Events Timeline */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">Event Log</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{events.length} events</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>IP Address</th>
                    <th>City</th>
                    <th>Risk</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id}>
                      <td style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmt(ev.timestamp)}</td>
                      <td className="mono" style={{ color: 'var(--text2)' }}>{ev.ip_address || '—'}</td>
                      <td>{ev.city_name || '—'} <span style={{ fontSize: 11, color: 'var(--text3)' }}>{ev.country_code}</span></td>
                      <td><RiskBadge level={ev.risk_level} score={ev.risk_score} /></td>
                      <td><Flags event={ev} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Flags & Explanations */}
          <div className="card">
            <div className="card-header"><span className="card-title">Fraud Signals</span></div>
            <div style={{ padding: 16 }}>
              <FlagExplanations event={latest} />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Fingerprint Summary */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">Device Fingerprint</span></div>
            <div style={{ padding: 12 }}>
              <div className="fp-grid">
                <FpItem label="OS"             value={latest?.os} />
                <FpItem label="Browser"        value={latest?.browser_name} />
                <FpItem label="Platform"       value={latest?.platform} />
                <FpItem label="Device"         value={latest?.device} />
                <FpItem label="Hardware Cores" value={latest?.hardware_concurrency} />
                <FpItem label="Device Memory"  value={latest?.device_memory != null ? `${latest.device_memory} GB` : null} />
                <FpItem label="Confidence"     value={latest?.confidence_score != null ? latest.confidence_score.toFixed(3) : null} />
                <FpItem label="Suspect Score"  value={latest?.suspect_score} />
              </div>
              <div style={{ marginTop: 10 }}>
                <FpItem label="Font Hash"   value={latest?.font_hash} />
                <div style={{ marginTop: 10 }}>
                  <FpItem label="GPU / WebGL Renderer" value={latest?.webgl_renderer_unmasked} />
                </div>
              </div>
            </div>
          </div>

          {/* Related Visitors */}
          {uniqueRelated.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Related Visitors</span></div>
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {uniqueRelated.map(r => (
                    <div key={r.visitor_id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 10px', background: 'var(--sidebar)', borderRadius: 6, border: '1px solid var(--border)',
                    }}>
                      <Link to={`/visitor/${r.visitor_id}`} className="visitor-chip" style={{ border: 'none', background: 'none', padding: 0 }}>
                        {r.visitor_id.substring(0, 16)}…
                      </Link>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                        background: 'var(--border2)', color: 'var(--text3)',
                      }}>
                        via {r.via}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
