import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fetchVisitor } from '../api';
import RiskBadge, { riskColor } from '../components/RiskBadge';
import Flags, { FlagExplanations } from '../components/Flags';

const EVENT_ICONS = {
  login: '🔑',
  signup: '✨',
  payment: '💳',
  password_change: '🔒',
  api_call: '⚡',
  export: '📤',
  settings_change: '⚙️',
};

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

function BotGauge({ value }) {
  const r = 60;
  const circ = Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, value)) / 100);
  const color = value > 80 ? '#ef4444' : value > 50 ? '#f97316' : value > 30 ? '#eab308' : '#22c55e';
  return (
    <svg width="160" height="95" viewBox="0 0 160 95">
      <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="#1e2130" strokeWidth="12" strokeLinecap="round" />
      <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.5s' }} />
      <text x="80" y="72" textAnchor="middle" fill={color} fontSize="26" fontWeight="bold" fontFamily="monospace">{value}</text>
      <text x="80" y="88" textAnchor="middle" fill="#64748b" fontSize="9" letterSpacing="1">BOT PROBABILITY</text>
    </svg>
  );
}

function mouseLabel(score) {
  if (score > 80) return { label: 'Robotic', color: '#ef4444' };
  if (score > 55) return { label: 'Suspicious', color: '#f97316' };
  return { label: 'Human-like', color: '#22c55e' };
}

function typingLabel(score) {
  if (score > 80) return { label: 'Automated', color: '#ef4444' };
  if (score > 55) return { label: 'Suspicious', color: '#f97316' };
  return { label: 'Natural', color: '#22c55e' };
}

function BehaviorTab({ behavior }) {
  if (!behavior || behavior.length === 0) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div className="empty-state">
          <div className="empty-icon" style={{ fontSize: 32 }}>📡</div>
          <div className="empty-text">No behavioral data collected yet.</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, maxWidth: 340, textAlign: 'center' }}>
            Embed <code style={{ background: 'var(--sidebar)', padding: '1px 5px', borderRadius: 3 }}>/tracker.js</code> on
            your site and configure <code style={{ background: 'var(--sidebar)', padding: '1px 5px', borderRadius: 3 }}>window.FraudTrackerConfig</code> with
            the visitor_id and api_key to start collecting signals.
          </div>
        </div>
      </div>
    );
  }

  const latest = behavior[0];
  const bp = Math.round(latest.bot_probability ?? 0);
  const mouse = mouseLabel(latest.mouse_smoothness_score ?? 50);
  const typing = typingLabel(latest.typing_rhythm_score ?? 50);

  let timeline = [];
  try { timeline = latest.page_timeline ? JSON.parse(latest.page_timeline) : []; } catch (_) {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="card-header"><span className="card-title">Bot Analysis</span></div>
        <div style={{ padding: 20, display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <BotGauge value={bp} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>MOUSE MOVEMENT PATTERN</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: mouse.color }}>{mouse.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>smoothness: {Math.round(latest.mouse_smoothness_score ?? 50)}/100</span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>TYPING RHYTHM</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: typing.color }}>{typing.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>rhythm score: {Math.round(latest.typing_rhythm_score ?? 50)}/100</span>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text2)' }}>
              <span>Mouse moves: <b>{latest.mouse_move_count}</b></span>
              <span>Clicks: <b>{latest.click_count}</b></span>
              <span>Keystrokes: <b>{latest.keyboard_event_count}</b></span>
              <span>Backspaces: <b>{latest.backspace_count}</b></span>
            </div>
          </div>
        </div>
      </div>

      {timeline.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Session Timeline</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{timeline.length} page{timeline.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {timeline.map((p, i) => {
              const duration = p.end && p.start ? Math.round((p.end - p.start) / 1000) : null;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px',
                  background: 'var(--sidebar)', borderRadius: 6, border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', width: 20, textAlign: 'right' }}>{i + 1}</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text2)', flex: 1 }}>{p.path}</span>
                  {duration != null && (
                    <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{duration}s</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {behavior.length > 1 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Behavior History</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{behavior.length} sessions</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Collected</th>
                  <th>Bot Prob.</th>
                  <th>Mouse</th>
                  <th>Typing</th>
                  <th>Session</th>
                </tr>
              </thead>
              <tbody>
                {behavior.map(b => {
                  const bpVal = Math.round(b.bot_probability ?? 0);
                  const bpColor = bpVal > 80 ? '#ef4444' : bpVal > 50 ? '#f97316' : bpVal > 30 ? '#eab308' : '#22c55e';
                  return (
                    <tr key={b.id}>
                      <td style={{ fontSize: 12, color: 'var(--text3)' }}>{fmt(b.collected_at)}</td>
                      <td><span style={{ color: bpColor, fontWeight: 600 }}>{bpVal}</span></td>
                      <td style={{ fontSize: 12 }}>{mouseLabel(b.mouse_smoothness_score ?? 50).label}</td>
                      <td style={{ fontSize: 12 }}>{typingLabel(b.typing_rhythm_score ?? 50).label}</td>
                      <td style={{ fontSize: 12, color: 'var(--text3)' }}>{b.session_duration ? `${Math.round(b.session_duration / 1000)}s` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VisitorDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

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

  const { events, related, account_timeline, behavior } = data;
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {['overview', 'behavior'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, color: activeTab === tab ? 'var(--blue)' : 'var(--text3)',
            borderBottom: activeTab === tab ? '2px solid var(--blue)' : '2px solid transparent',
            marginBottom: -1, textTransform: 'capitalize',
          }}>
            {tab}{tab === 'behavior' && behavior?.length > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 10, background: 'var(--blue)', color: '#fff',
                borderRadius: 8, padding: '1px 5px', fontWeight: 700,
              }}>{behavior.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'behavior' ? (
        <BehaviorTab behavior={behavior} />
      ) : null}

      {activeTab === 'overview' && <div className="detail-grid">
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
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">Fraud Signals</span></div>
            <div style={{ padding: 16 }}>
              <FlagExplanations event={latest} />
            </div>
          </div>

          {/* Account Activity Timeline */}
          {account_timeline && account_timeline.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Account Activity</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{account_timeline.length} action{account_timeline.length !== 1 ? 's' : ''} via shared IP</span>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {account_timeline.map(ev => {
                  const meta = ev.metadata ? (() => { try { return JSON.parse(ev.metadata); } catch { return {}; } })() : {};
                  const metaSummary = Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(' · ');
                  return (
                    <div key={ev.id} style={{
                      padding: '10px 12px', background: 'var(--sidebar)', borderRadius: 6,
                      border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                          background: 'var(--blue)', color: '#fff', letterSpacing: '0.05em',
                        }}>
                          {EVENT_ICONS[ev.event_type] || '◆'} {ev.event_type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{fmt(ev.timestamp)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)' }}>
                        {ev.ip_address && <span className="mono">{ev.ip_address}</span>}
                        <span style={{ color: 'var(--text2)' }}>{ev.account_id}</span>
                        {metaSummary && <span>{metaSummary}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
      </div>}
    </div>
  );
}
