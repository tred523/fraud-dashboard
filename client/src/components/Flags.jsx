export default function Flags({ event }) {
  const flags = [];
  if (event.vpn)              flags.push({ cls: 'flag-vpn',       label: 'VPN' });
  if (event.proxy)            flags.push({ cls: 'flag-proxy',     label: 'PRX' });
  if (event.virtual_machine)  flags.push({ cls: 'flag-vm',        label: 'VM' });
  if (event.anti_detect_browser) flags.push({ cls: 'flag-anti',   label: 'ADB' });
  if (event.tampering)        flags.push({ cls: 'flag-tampering', label: 'TAM' });
  if (event.bot && event.bot !== 'not_detected') flags.push({ cls: 'flag-bot', label: 'BOT' });
  if (event.incognito)        flags.push({ cls: 'flag-incognito', label: 'INC' });

  if (flags.length === 0) return <span style={{ color: 'var(--text4)', fontSize: 12 }}>—</span>;

  return (
    <span>
      {flags.map(({ cls, label }) => (
        <span key={label} className={`flag ${cls}`}>{label}</span>
      ))}
    </span>
  );
}

export function FlagExplanations({ event }) {
  const items = [];
  if (event.vpn)             items.push({ label: 'VPN',            color: '#60a5fa', text: 'Traffic is routed through a VPN provider. May be used to mask true IP or location.' });
  if (event.proxy)           items.push({ label: 'Proxy',          color: '#c084fc', text: 'Connection originates from a known proxy server, obscuring the real user IP.' });
  if (event.virtual_machine) items.push({ label: 'Virtual Machine',color: '#fb923c', text: 'Browser is running inside a VM — common in fraud automation and testing environments.' });
  if (event.anti_detect_browser) items.push({ label: 'Anti-Detect Browser', color: '#f87171', text: 'A browser specifically designed to evade fingerprinting was detected (e.g. Multilogin, GoLogin).' });
  if (event.tampering)       items.push({ label: 'Tampering',      color: '#fbbf24', text: `JavaScript or browser APIs appear to have been tampered with. ML score: ${event.tampering_ml_score?.toFixed(3) ?? '—'}.` });
  if (event.bot && event.bot !== 'not_detected') items.push({ label: 'Bot', color: '#9ca3af', text: `Automated bot behaviour was detected: ${event.bot}.` });
  if (event.incognito)       items.push({ label: 'Incognito',      color: '#93c5fd', text: 'Browser is in private/incognito mode — limits persistent tracking but not inherently fraudulent.' });
  if ((event.anomaly_score || 0) > 0) items.push({ label: 'Anomaly Score', color: '#fb923c', text: `Behavioural anomaly score of ${event.anomaly_score} detected — unusual interaction pattern.` });

  if (items.length === 0) return <p style={{ color: 'var(--text3)', fontSize: 13 }}>No active fraud flags on this event.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(({ label, color, text }) => (
        <div key={label} style={{
          padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)',
          borderLeft: `3px solid ${color}`, background: 'var(--sidebar)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 650, color, marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>{text}</div>
        </div>
      ))}
    </div>
  );
}
