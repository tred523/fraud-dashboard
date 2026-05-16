const STYLES = {
  TRUSTED:    { bg: '#22c55e22', color: '#22c55e', border: '#22c55e44' },
  MONITOR:    { bg: '#eab30822', color: '#eab308', border: '#eab30844' },
  SUSPICIOUS: { bg: '#f9731622', color: '#f97316', border: '#f9731644' },
  BLOCK:      { bg: '#ef444422', color: '#ef4444', border: '#ef444444' },
};

export function verdictColor(verdict) {
  return STYLES[verdict]?.color ?? 'var(--text3)';
}

export default function VerdictBadge({ verdict, score, size = 'sm' }) {
  if (!verdict) return null;
  const s = STYLES[verdict] || STYLES.MONITOR;
  const lg = size === 'lg';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: lg ? 8 : 4,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: lg ? 8 : 4,
      padding: lg ? '6px 16px' : '2px 7px',
      fontSize: lg ? 18 : 11,
      fontWeight: 700, letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {verdict}
      {score != null && (
        <span style={{ opacity: 0.65, fontSize: lg ? 13 : 10, fontWeight: 500 }}>
          {score}
        </span>
      )}
    </span>
  );
}
