import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAccountDetail } from '../api';
import VerdictBadge from '../components/VerdictBadge';

const EVENT_ICONS = {
  login:           '🔑',
  signup:          '✨',
  payment:         '💳',
  password_change: '🔒',
  api_call:        '⚡',
  export:          '📤',
  settings_change: '⚙️',
};

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

const fmt = (ts) => {
  if (!ts) return '—';
  const n = Number(ts);
  if (isNaN(n)) return ts;
  const d = new Date(n > 9999999999 ? n : n * 1000);
  return isNaN(d.getTime()) ? String(ts) : d.toLocaleString('en-GB');
};

function MetaTag({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--border1)', color: 'var(--text3)' }}>
      <span style={{ color: 'var(--text4)' }}>{label}:</span>
      <span style={{ color: 'var(--text2)' }}>{value}</span>
    </span>
  );
}

function normalizeTs(ts) {
  if (!ts) return null;
  const n = Number(ts);
  if (!isNaN(n)) return n > 9999999999 ? n : n * 1000;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d.getTime();
}

export default function AccountDetail() {
  const { account_id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAccountDetail(account_id)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [account_id]);

  if (loading) return <div className="loading">Loading account…</div>;
  if (error) return <div className="loading" style={{ color: '#ef4444' }}>Error: {error}</div>;
  if (!data) return null;

  const { events, payment_methods, linked_visitors, verdict } = data;

  const sortedEvents = [...events].map(e => ({ ...e, _ts: normalizeTs(e.timestamp) }))
    .filter(e => e._ts).sort((a, b) => a._ts - b._ts);

  const allTs = sortedEvents.map(e => e._ts);
  const firstSeen = allTs.length ? Math.min(...allTs) : null;
  const lastSeen  = allTs.length ? Math.max(...allTs) : null;
  const uniqueIps = new Set(sortedEvents.map(e => e.ip_address).filter(Boolean)).size;

  const withIp = sortedEvents.filter(e => e.ip_address);
  let multiIpWarning = false;
  const ONE_HOUR = 3600000;
  outer: for (let i = 0; i < withIp.length - 1; i++) {
    for (let j = i + 1; j < withIp.length; j++) {
      if (withIp[j]._ts - withIp[i]._ts > ONE_HOUR) break;
      if (withIp[i].ip_address !== withIp[j].ip_address) { multiIpWarning = true; break outer; }
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/accounts" style={{ color: 'var(--text4)', textDecoration: 'none', fontSize: 13 }}>← Accounts</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>{account_id}</h1>
            {verdict && <VerdictBadge verdict={verdict.verdict} score={verdict.verdict_score} size="lg" />}
          </div>
          <p className="page-subtitle">{events.length} event{events.length !== 1 ? 's' : ''} recorded</p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap' }}>
          {[
            { label: 'First Seen',   value: fmt(firstSeen) },
            { label: 'Last Seen',    value: fmt(lastSeen) },
            { label: 'Total Events', value: sortedEvents.length },
            { label: 'Unique IPs',   value: uniqueIps || '—' },
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
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: '#f9731611', border: '1px solid #f9731644',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f97316' }}>Suspicious: Multiple IPs detected</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            — This account was active from different IP addresses within 1 hour
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Left column: timeline + payment methods */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Timeline */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Account Timeline</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{sortedEvents.length} events</span>
            </div>
            <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {sortedEvents.map((ev, i) => {
                const meta = ev.metadata ? (typeof ev.metadata === 'string' ? (() => { try { return JSON.parse(ev.metadata); } catch { return {}; } })() : ev.metadata) : {};
                const prev = i > 0 ? sortedEvents[i - 1] : null;
                const gapMs = prev ? ev._ts - prev._ts : 0;
                const showGap = prev && gapMs > 300000;
                const ipChanged = prev?.ip_address && ev.ip_address && ev.ip_address !== prev.ip_address;

                let dotColor = '#3b82f6';
                if (ev.event_type === 'password_change' || ev.event_type === 'settings_change') dotColor = '#f97316';
                else if (ev.event_type === 'export') dotColor = '#a78bfa';
                else if (ev.event_type === 'payment') dotColor = '#22c55e';
                else if (ev.event_type === 'signup') dotColor = '#22c55e';

                let gapLabel = '';
                if (showGap) {
                  const mins = Math.round(gapMs / 60000);
                  if (mins < 60) gapLabel = `${mins} min later`;
                  else if (mins < 1440) gapLabel = `${Math.round(mins / 60)} hr later`;
                  else gapLabel = `${Math.round(mins / 1440)}d later`;
                }

                return (
                  <div key={i}>
                    {showGap && (
                      <div style={{ padding: '5px 44px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>┄ {gapLabel}</span>
                      </div>
                    )}
                    <div style={{
                      display: 'flex', gap: 14, padding: '12px 0',
                      borderBottom: i < sortedEvents.length - 1 ? '1px solid var(--border1)' : 'none',
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: dotColor + '22', border: `1px solid ${dotColor}44`,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2,
                      }}>
                        {EVENT_ICONS[ev.event_type] || '•'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text1)', textTransform: 'capitalize' }}>
                            {ev.event_type.replace(/_/g, ' ')}
                          </span>
                          {ev.ip_address && (
                            <span style={{
                              fontSize: 11, fontFamily: 'monospace',
                              color: ipChanged ? '#f97316' : 'var(--text4)',
                            }}>
                              {ipChanged && '↕ '}{ev.ip_address}
                            </span>
                          )}
                          {ipChanged && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, color: '#f97316',
                              padding: '1px 5px', borderRadius: 3, background: '#f9731622',
                            }}>IP CHANGED</span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--text4)', marginLeft: 'auto' }}>
                            {fmt(ev._ts)}
                          </span>
                        </div>
                        {Object.keys(meta).length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                            {Object.entries(meta).map(([k, v]) => (
                              <MetaTag key={k} label={k} value={String(v)} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Methods */}
          {payment_methods.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Payment Methods</span></div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {payment_methods.map((pm, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 8,
                    background: 'var(--bg3)', border: '1px solid var(--border1)',
                  }}>
                    {pm.paypal_email ? (
                      <>
                        <span style={{ fontSize: 20 }}>🅿️</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text1)', fontSize: 13 }}>{pm.paypal_email}</div>
                          <div style={{ fontSize: 11, color: 'var(--text4)' }}>PayPal</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <CardBrandIcon brand={pm.card_brand} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text1)', fontFamily: 'monospace', fontSize: 13 }}>
                              •••• {pm.card_last4}
                            </span>
                            {pm.bank_name && (
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{pm.bank_name}</span>
                            )}
                            {pm.country && (
                              <span style={{ fontSize: 12 }}>{countryFlag(pm.country)} {pm.country}</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            {pm.card_type && (
                              <span style={{ fontSize: 11, color: 'var(--text4)' }}>{pm.card_type}</span>
                            )}
                            {pm.is_prepaid ? (
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#f9731622', color: '#f97316', border: '1px solid #f9731644', fontWeight: 700 }}>
                                PREPAID
                              </span>
                            ) : null}
                            {pm.is_virtual ? (
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#a78bfa22', color: '#a78bfa', border: '1px solid #a78bfa44', fontWeight: 700 }}>
                                VIRTUAL
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {pm.card_bin && (
                          <span style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'monospace', flexShrink: 0 }}>
                            BIN {pm.card_bin}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: verdict + linked visitors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Verdict details */}
          {verdict && (
            <div className="card">
              <div className="card-header"><span className="card-title">Risk Assessment</span></div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text4)' }}>Score</span>
                  <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--text1)' }}>{verdict.verdict_score}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text4)' }}>Confidence</span>
                  <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{verdict.confidence}</span>
                </div>
                {verdict.reasons?.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 6 }}>Signals</div>
                    {verdict.reasons.map((r, i) => (
                      <div key={i} style={{
                        fontSize: 12, color: 'var(--text2)', padding: '4px 0',
                        borderBottom: i < verdict.reasons.length - 1 ? '1px solid var(--border1)' : 'none',
                        display: 'flex', alignItems: 'flex-start', gap: 6,
                      }}>
                        <span style={{ color: '#f97316', flexShrink: 0 }}>▸</span>
                        {r}
                      </div>
                    ))}
                  </div>
                )}
                {verdict.recommended_action && (
                  <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6, background: 'var(--bg3)', fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                    {verdict.recommended_action}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Linked Visitors */}
          {linked_visitors.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Linked Visitors</span></div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {linked_visitors.map((v, i) => (
                  <Link
                    key={i}
                    to={`/visitor/${encodeURIComponent(v.visitor_id)}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', borderRadius: 6,
                      background: 'var(--bg3)', border: '1px solid var(--border1)',
                      textDecoration: 'none', transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border1)'}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text2)' }}>
                      {v.visitor_id.length > 20 ? v.visitor_id.substring(0, 20) + '…' : v.visitor_id}
                    </span>
                    {v.ip_address && (
                      <span style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'monospace' }}>
                        {v.ip_address}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
