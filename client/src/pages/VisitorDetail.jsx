import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fetchVisitor, fetchVerdict } from '../api';
import RiskBadge, { riskColor } from '../components/RiskBadge';
import Flags, { FlagExplanations } from '../components/Flags';
import VerdictBadge, { verdictColor } from '../components/VerdictBadge';

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

const CARD_BRAND_STYLES = {
  visa:       { bg: '#1A1F71', color: '#fff', label: 'VISA' },
  mastercard: { bg: '#EB001B', color: '#fff', label: 'MC' },
  amex:       { bg: '#2E77BC', color: '#fff', label: 'AMEX' },
  discover:   { bg: '#FF6600', color: '#fff', label: 'DISC' },
};

function CardBrandIcon({ brand }) {
  const key = (brand || '').toLowerCase();
  const s = CARD_BRAND_STYLES[key] || { bg: 'var(--border2)', color: 'var(--text3)', label: (brand || '?').toUpperCase().slice(0, 4) };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 36, height: 20, borderRadius: 3, background: s.bg, color: s.color,
      fontSize: 8, fontWeight: 800, letterSpacing: 0.5, flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1F1E6)).join('');
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

function normalizeTs(ts) {
  if (!ts) return null;
  const n = Number(ts);
  if (!isNaN(n)) return n > 9999999999 ? n : n * 1000;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function UnifiedTimeline({ events, account_timeline, behavior }) {
  const items = [];

  for (const e of (events || [])) {
    const ts = normalizeTs(e.timestamp);
    if (!ts) continue;
    items.push({
      id: `scan-${e.id || ts}`,
      timestamp: ts,
      type: 'scan',
      icon: '🔍',
      label: 'Device Fingerprint Scan',
      ip_address: e.ip_address || null,
      city: e.city_name || null,
      country_code: e.country_code || null,
      risk_level: e.risk_level || null,
      risk_score: e.risk_score,
      details: { os: e.os, browser: e.browser_name },
    });
  }

  for (const e of (account_timeline || [])) {
    const ts = normalizeTs(e.timestamp);
    if (!ts) continue;
    items.push({
      id: `acct-${e.id || ts}`,
      timestamp: ts,
      type: 'account',
      icon: EVENT_ICONS[e.event_type] || '◆',
      label: (e.event_type || 'event').replace(/_/g, ' ').toUpperCase(),
      ip_address: e.ip_address || null,
      city: null,
      country_code: null,
      risk_level: null,
      details: { account_id: e.account_id, metadata: e.metadata },
    });
  }

  for (const b of (behavior || [])) {
    const ts = normalizeTs(b.collected_at);
    if (!ts) continue;
    items.push({
      id: `beh-${b.id || ts}`,
      timestamp: ts,
      type: 'behavior',
      icon: '📡',
      label: 'Behavior Session',
      ip_address: null,
      city: null,
      country_code: null,
      risk_level: null,
      details: { bot_probability: b.bot_probability, session_duration: b.session_duration },
    });
  }

  items.sort((a, b) => a.timestamp - b.timestamp);

  const allTs = items.map(i => i.timestamp);
  const firstSeen = allTs.length ? Math.min(...allTs) : null;
  const lastSeen  = allTs.length ? Math.max(...allTs) : null;
  const totalSessions = (behavior || []).length;
  const allIps = new Set([
    ...(events || []).map(e => e.ip_address),
    ...(account_timeline || []).map(e => e.ip_address),
  ].filter(Boolean));
  const uniqueDevices = new Set((events || []).map(e => e.font_hash).filter(Boolean)).size;

  const scanEvts = (events || [])
    .map(e => ({ ts: normalizeTs(e.timestamp), ip: e.ip_address }))
    .filter(e => e.ts && e.ip)
    .sort((a, b) => a.ts - b.ts);

  let multiIpWarning = false;
  const ONE_HOUR = 3600000;
  outer: for (let i = 0; i < scanEvts.length - 1; i++) {
    for (let j = i + 1; j < scanEvts.length; j++) {
      if (scanEvts[j].ts - scanEvts[i].ts > ONE_HOUR) break;
      if (scanEvts[i].ip !== scanEvts[j].ip) { multiIpWarning = true; break outer; }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary bar */}
      <div className="card">
        <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap' }}>
          {[
            { label: 'First Seen',      value: fmt(firstSeen) },
            { label: 'Last Seen',       value: fmt(lastSeen) },
            { label: 'Total Sessions',  value: totalSessions || '—' },
            { label: 'Unique IPs',      value: allIps.size || '—' },
            { label: 'Unique Devices',  value: uniqueDevices || '—' },
          ].map(({ label, value }, idx, arr) => (
            <div key={label} style={{
              display: 'flex', flexDirection: 'column', gap: 3,
              padding: '0 24px',
              borderRight: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {multiIpWarning && (
        <div style={{
          padding: '10px 16px', borderRadius: 8,
          background: '#f9731611', border: '1px solid #f9731644',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f97316' }}>Suspicious: Multiple IPs detected</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            — This visitor was seen from different IP addresses within 1 hour
          </span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Activity Timeline</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{items.length} events</span>
        </div>
        <div style={{ padding: '14px 14px 14px 42px', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 25, top: 20, bottom: 20,
            width: 2, background: 'var(--border)', borderRadius: 1,
          }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((item, idx) => {
              const prev = idx > 0 ? items[idx - 1] : null;
              const gapMs = prev ? item.timestamp - prev.timestamp : 0;
              const showGap = prev && gapMs > 300000;
              const ipChanged = prev?.ip_address && item.ip_address && item.ip_address !== prev.ip_address;

              let dotColor = '#3b82f6';
              let cardBorder = 'var(--border)';
              if (item.type === 'scan') {
                if (item.risk_level === 'HIGH RISK') { dotColor = '#ef4444'; cardBorder = '#ef444433'; }
                else if (item.risk_level === 'SUSPICIOUS') { dotColor = '#f97316'; cardBorder = '#f9731633'; }
                else if (item.risk_level === 'LOW') dotColor = '#eab308';
                else dotColor = '#22c55e';
              } else if (item.type === 'behavior') {
                const bp = item.details.bot_probability ?? 0;
                if (bp > 80) { dotColor = '#ef4444'; cardBorder = '#ef444433'; }
                else if (bp > 50) { dotColor = '#f97316'; cardBorder = '#f9731633'; }
                else dotColor = '#22c55e';
              } else if (item.type === 'account') {
                dotColor = '#a78bfa';
              }

              let gapLabel = '';
              if (showGap) {
                const mins = Math.round(gapMs / 60000);
                if (mins < 60) gapLabel = `${mins} min later`;
                else if (mins < 1440) gapLabel = `${Math.round(mins / 60)} hr later`;
                else gapLabel = `${Math.round(mins / 1440)}d later`;
              }

              return (
                <div key={item.id}>
                  {showGap && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', marginLeft: -14 }}>
                      <span style={{ width: 28, textAlign: 'center', color: 'var(--text3)' }}>┄</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>{gapLabel}</span>
                    </div>
                  )}
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <div style={{
                      position: 'absolute', left: -21, top: 12,
                      width: 10, height: 10, borderRadius: '50%',
                      background: dotColor, border: '2px solid var(--sidebar)',
                      zIndex: 1, boxShadow: `0 0 0 3px ${dotColor}22`,
                    }} />
                    <div style={{
                      padding: '10px 12px', background: 'var(--sidebar)', borderRadius: 6,
                      border: `1px solid ${cardBorder}`,
                      display: 'flex', flexDirection: 'column', gap: 5,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', letterSpacing: '.03em' }}>
                          {item.label}
                        </span>
                        {item.type === 'scan' && item.risk_level && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                            background: dotColor + '22', color: dotColor, letterSpacing: '.04em',
                          }}>
                            {item.risk_level}
                          </span>
                        )}
                        {item.type === 'scan' && item.risk_score != null && (
                          <span style={{ fontSize: 10, color: dotColor }}>Score: {item.risk_score}</span>
                        )}
                        {item.type === 'behavior' && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                            background: dotColor + '22', color: dotColor,
                          }}>
                            BOT {Math.round(item.details.bot_probability ?? 0)}%
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                          {fmt(item.timestamp)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap', alignItems: 'center' }}>
                        {item.ip_address && (
                          <span style={{ fontFamily: 'monospace', color: ipChanged ? '#f97316' : 'var(--text2)' }}>
                            {ipChanged && '↕ '}{item.ip_address}
                          </span>
                        )}
                        {ipChanged && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: '#f97316',
                            padding: '1px 5px', borderRadius: 3, background: '#f9731622',
                          }}>IP CHANGED</span>
                        )}
                        {item.city && (
                          <span>{item.city}{item.country_code ? ` · ${item.country_code}` : ''}</span>
                        )}
                        {item.type === 'scan' && (item.details.browser || item.details.os) && (
                          <span>{[item.details.browser, item.details.os].filter(Boolean).join(' · ')}</span>
                        )}
                        {item.type === 'account' && item.details.account_id && (
                          <span style={{ color: 'var(--text2)' }}>{item.details.account_id}</span>
                        )}
                        {item.type === 'behavior' && item.details.session_duration != null && (
                          <span>Duration: {Math.round(item.details.session_duration / 1000)}s</span>
                        )}
                      </div>
                      {item.type === 'account' && item.details.metadata && (() => {
                        try {
                          const meta = typeof item.details.metadata === 'string'
                            ? JSON.parse(item.details.metadata)
                            : item.details.metadata;
                          const entries = Object.entries(meta || {});
                          if (!entries.length) return null;
                          return (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                              {entries.map(([k, v]) => (
                                <span key={k} style={{
                                  fontSize: 10, padding: '1px 6px', borderRadius: 8,
                                  background: 'var(--border2)', color: 'var(--text3)',
                                }}>{k}: {String(v)}</span>
                              ))}
                            </div>
                          );
                        } catch { return null; }
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VisitorDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setLoading(true);
    setError(null);
    setVerdict(null);
    fetchVisitor(id)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
    fetchVerdict(id).then(setVerdict).catch(() => {});
  }, [id]);

  if (loading) return <div className="loading">Loading visitor data…</div>;
  if (error)   return <div className="page"><div className="empty-state"><div className="empty-icon">⚠️</div><div className="empty-text">{error}</div></div></div>;
  if (!data)   return null;

  const { events, related, account_timeline, behavior, payment, linked_payments } = data;
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

  const sharedCardKeysSet = (() => {
    const cardAccounts = {};
    for (const p of (linked_payments || [])) {
      if (!p.card_last4 || !p.card_bin) continue;
      const key = `${p.card_bin}:${p.card_last4}`;
      if (!cardAccounts[key]) cardAccounts[key] = new Set();
      cardAccounts[key].add(p.account_id);
    }
    return new Set(Object.entries(cardAccounts).filter(([, s]) => s.size > 1).map(([k]) => k));
  })();

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
        {['overview', 'timeline', 'behavior'].map(tab => (
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

      {activeTab === 'behavior' && <BehaviorTab behavior={behavior} />}

      {activeTab === 'timeline' && (
        <UnifiedTimeline events={events} account_timeline={account_timeline} behavior={behavior} />
      )}

      {activeTab === 'overview' && verdict && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: verdict.reasons.length > 0 ? 16 : 0 }}>
              <VerdictBadge verdict={verdict.verdict} score={verdict.verdict_score} size="lg" />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>
                  AI Verdict
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  Confidence:{' '}
                  <span style={{ fontWeight: 700, color: verdict.confidence === 'HIGH' ? '#ef4444' : verdict.confidence === 'MEDIUM' ? '#f97316' : '#22c55e' }}>
                    {verdict.confidence}
                  </span>
                </div>
              </div>
            </div>

            {verdict.reasons.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                  Why?
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {verdict.reasons.map((r, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text2)' }}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ padding: '10px 14px', background: 'var(--sidebar)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                Recommended Action
              </div>
              <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 500 }}>
                {verdict.recommended_action}
              </div>
            </div>
          </div>
        </div>
      )}

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
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <span className="card-title">Account Activity</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{account_timeline.length} action{account_timeline.length !== 1 ? 's' : ''} via shared IP</span>
              </div>
              <div style={{ padding: '14px 14px 14px 38px', position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 25, top: 20, bottom: 20,
                  width: 2, background: 'var(--border)', borderRadius: 1,
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {account_timeline.map(ev => {
                  const meta = ev.metadata ? (() => { try { return JSON.parse(ev.metadata); } catch { return {}; } })() : {};
                  const metaSummary = Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join(' · ');
                  return (
                    <div key={ev.id} style={{ position: 'relative' }}>
                      <div style={{
                        position: 'absolute', left: -21, top: 13,
                        width: 10, height: 10, borderRadius: '50%',
                        background: 'var(--blue)', border: '2px solid var(--sidebar)',
                        zIndex: 1, boxShadow: '0 0 0 3px rgba(59,130,246,.15)',
                      }} />
                      <div style={{
                        padding: '10px 12px', background: 'var(--sidebar)', borderRadius: 6,
                        border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15 }}>{EVENT_ICONS[ev.event_type] || '◆'}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: 'var(--text)',
                            letterSpacing: '0.03em',
                          }}>
                            {ev.event_type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{fmt(ev.timestamp)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)' }}>
                          {ev.ip_address && <span className="mono">{ev.ip_address}</span>}
                          <span style={{ color: 'var(--text2)' }}>{ev.account_id}</span>
                          {metaSummary && <span>{metaSummary}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          )}

          {/* Linked Payments */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Linked Payments</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>via shared IP</span>
            </div>
            {(!linked_payments || linked_payments.length === 0) ? (
              <div style={{ padding: '20px 16px', fontSize: 13, color: 'var(--text3)' }}>No payment data available</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Account ID</th>
                      <th>Card</th>
                      <th>Bank</th>
                      <th>Type</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linked_payments.map((p, i) => {
                      const isRisky = p.is_prepaid || p.is_virtual;
                      const isShared = p.card_last4 && p.card_bin && sharedCardKeysSet.has(`${p.card_bin}:${p.card_last4}`);
                      const cardTypeLabel = p.is_virtual ? 'Virtual' : p.is_prepaid ? 'Prepaid' : p.card_type
                        ? p.card_type.charAt(0).toUpperCase() + p.card_type.slice(1)
                        : '—';
                      return (
                        <tr key={i}>
                          <td className="mono" style={{ fontSize: 12 }}>{p.account_id}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                            {p.card_last4 ? `•••• ${p.card_last4}` : '—'}
                            {isShared && (
                              <span style={{
                                marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '1px 4px',
                                borderRadius: 3, background: '#ef444422', color: '#ef4444', verticalAlign: 'middle',
                              }}>SHARED</span>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text2)' }}>{p.bank_name || '—'}</td>
                          <td>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                              background: isRisky ? '#f9731622' : 'var(--border2)',
                              color: isRisky ? '#f97316' : 'var(--text3)',
                            }}>
                              {cardTypeLabel}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmt(p.timestamp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
            <div className="card" style={{ marginBottom: 20 }}>
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

          {/* Payment Methods */}
          {payment && payment.methods.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Payment Methods</span>
                {payment.is_shared && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
                    background: '#ef444422', color: '#ef4444', letterSpacing: '.04em',
                  }}>
                    SHARED
                  </span>
                )}
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {payment.methods.map((method) => {
                  const isRisky = method.is_prepaid || method.is_virtual;
                  const isLinked = method.linked_accounts.length > 0;
                  const borderColor = isLinked ? '#ef444444' : isRisky ? '#f9731644' : 'var(--border)';
                  const cardTypeLabel = method.is_virtual ? 'Virtual'
                    : method.is_prepaid ? 'Prepaid'
                    : method.card_type ? (method.card_type.charAt(0).toUpperCase() + method.card_type.slice(1))
                    : null;

                  return (
                    <div key={method.id} style={{
                      padding: '10px 12px', background: 'var(--sidebar)', borderRadius: 6,
                      border: `1px solid ${borderColor}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (isLinked || method.bank_name) ? 6 : 0 }}>
                        {method.paypal_email ? (
                          <span style={{ fontSize: 16 }}>🅿️</span>
                        ) : (
                          <CardBrandIcon brand={method.card_brand} />
                        )}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', fontFamily: 'monospace' }}>
                          {method.paypal_email ? method.paypal_email : `•••• •••• •••• ${method.card_last4}`}
                        </span>
                        {method.country && (
                          <span title={method.country} style={{ fontSize: 16, lineHeight: 1 }}>
                            {countryFlag(method.country)}
                          </span>
                        )}
                        {cardTypeLabel && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                            background: isRisky ? '#f9731622' : 'var(--border2)',
                            color: isRisky ? '#f97316' : 'var(--text3)',
                          }}>
                            {cardTypeLabel}
                          </span>
                        )}
                        {isLinked && (
                          <span style={{
                            marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 6px',
                            borderRadius: 3, background: '#ef444422', color: '#ef4444', whiteSpace: 'nowrap',
                          }}>
                            {method.linked_accounts.length} other account{method.linked_accounts.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {(method.bank_name || isLinked) && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', paddingLeft: 44, display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {method.bank_name && (
                            <span>{method.bank_name}</span>
                          )}
                          {isLinked && (
                            <span>
                              Also used by: <span style={{ color: '#ef4444', fontFamily: 'monospace' }}>{method.linked_accounts.join(', ')}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
