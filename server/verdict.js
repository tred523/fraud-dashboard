function calculateVerdict(events, behavior, payment) {
  const reasons = [];
  let score = 0;
  const signals = {};

  // Base: max risk score across all events
  const maxRiskScore = events.reduce((m, e) => Math.max(m, e.risk_score || 0), 0);
  signals.max_risk_score = maxRiskScore;
  score = maxRiskScore;

  // Per-event signal flags
  const hasADB = events.some(e => e.anti_detect_browser);
  const hasVM = events.some(e => e.virtual_machine);
  const hasBot = events.some(e => e.bot && e.bot !== 'not_detected');
  const hasVPN = events.some(e => e.vpn);
  const hasProxy = events.some(e => e.proxy);
  const hasHighVelocity = events.some(e => (e.velocity_distinct_ip_24h || 0) > 3);
  const anomalyCount = events.filter(e => (e.anomaly_score || 0) > 0).length;

  signals.anti_detect_browser = hasADB;
  signals.virtual_machine = hasVM;
  signals.bot_detected = hasBot;
  signals.vpn = hasVPN;
  signals.proxy = hasProxy;
  signals.high_velocity = hasHighVelocity;
  signals.anomaly_count = anomalyCount;

  if (hasADB) reasons.push('Anti-detect browser detected');
  if (hasVM) reasons.push('Virtual machine detected');
  if (hasBot) reasons.push('Bot detection triggered');
  if (hasVPN) reasons.push('VPN usage detected');
  if (hasProxy) reasons.push('Proxy usage detected');
  if (hasHighVelocity) reasons.push('High IP velocity (>3 distinct IPs in 24h)');
  if (anomalyCount > 0) reasons.push(`${anomalyCount} anomal${anomalyCount !== 1 ? 'ies' : 'y'} detected`);

  // Bot probability from behavior events
  const maxBotProb = behavior.length > 0
    ? behavior.reduce((m, b) => Math.max(m, b.bot_probability || 0), 0)
    : null;
  signals.max_bot_probability = maxBotProb;
  if (maxBotProb != null) {
    if (maxBotProb > 80) reasons.push(`High bot probability (${Math.round(maxBotProb)}%)`);
    else if (maxBotProb >= 50) reasons.push(`Elevated bot probability (${Math.round(maxBotProb)}%)`);
  }

  // Cross-visit signals (additive on top of per-event risk)
  const hasSharedPayment = payment?.is_shared === true;
  signals.shared_payment = hasSharedPayment;
  if (hasSharedPayment) { score += 15; reasons.push('Payment method shared with other accounts'); }

  // Rapid IP changes (< 2 minutes between events with different IPs)
  const sorted = [...events].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  let rapidIpChange = false;
  for (let i = 1; i < sorted.length; i++) {
    const dt = (sorted[i].timestamp || 0) - (sorted[i - 1].timestamp || 0);
    if (dt < 120000 &&
        sorted[i].ip_address && sorted[i - 1].ip_address &&
        sorted[i].ip_address !== sorted[i - 1].ip_address) {
      rapidIpChange = true;
      break;
    }
  }
  signals.rapid_ip_change = rapidIpChange;
  if (rapidIpChange) { score += 15; reasons.push('Rapid IP change within 2 minutes'); }

  // VM/MacIntel contradiction
  const vmMacContradiction = events.some(e => e.virtual_machine && e.platform === 'MacIntel');
  signals.vm_mac_contradiction = vmMacContradiction;
  if (vmMacContradiction) { score += 10; reasons.push('Virtual machine contradicts MacIntel platform'); }

  score = Math.min(100, score);

  let verdict, recommendedAction;
  if (score <= 25) {
    verdict = 'TRUSTED';
    recommendedAction = 'No action required. Continue monitoring normally.';
  } else if (score <= 50) {
    verdict = 'MONITOR';
    recommendedAction = 'Keep this visitor under observation. Review activity periodically.';
  } else if (score <= 75) {
    verdict = 'SUSPICIOUS';
    recommendedAction = 'Investigate this visitor. Consider requesting additional verification.';
  } else {
    verdict = 'BLOCK';
    recommendedAction = 'Block this account immediately. Multiple clear fraud indicators detected.';
  }

  const confidence = reasons.length >= 3 || score >= 70 ? 'HIGH'
    : reasons.length >= 2 || score >= 40 ? 'MEDIUM'
    : 'LOW';

  return {
    verdict,
    verdict_score: score,
    confidence,
    reasons,
    recommended_action: recommendedAction,
    signals_summary: signals,
  };
}

module.exports = { calculateVerdict };
