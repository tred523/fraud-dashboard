export function riskClass(level) {
  switch (level) {
    case 'CLEAN':      return 'badge badge-clean';
    case 'LOW':        return 'badge badge-low';
    case 'SUSPICIOUS': return 'badge badge-suspicious';
    case 'HIGH RISK':  return 'badge badge-high';
    default:           return 'badge badge-clean';
  }
}

export function riskColor(level) {
  switch (level) {
    case 'CLEAN':      return 'var(--green)';
    case 'LOW':        return 'var(--yellow)';
    case 'SUSPICIOUS': return 'var(--orange)';
    case 'HIGH RISK':  return 'var(--red)';
    default:           return 'var(--green)';
  }
}

export default function RiskBadge({ level, score }) {
  return (
    <span className={riskClass(level)} style={{ gap: 5 }}>
      {score !== undefined && <span style={{ opacity: .75, fontSize: 10 }}>{score}</span>}
      {level}
    </span>
  );
}
