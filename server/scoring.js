function calculateRiskScore(event) {
  let score = 0;

  if (event.anti_detect_browser) score += 40;

  const ml = event.tampering_ml_score || 0;
  if (ml > 0.5) score += 25;
  else if (ml >= 0.2) score += 15;

  if (event.virtual_machine) score += 20;
  if ((event.anomaly_score || 0) > 0) score += 15;
  if (event.vpn) score += 10;
  if (event.proxy) score += 10;
  if ((event.suspect_score || 0) > 10) score += 10;
  if ((event.velocity_distinct_ip_24h || 0) > 3) score += 15;
  if (!event.visitor_found) score += 5;

  score = Math.min(100, score);

  let level;
  if (score <= 20) level = 'CLEAN';
  else if (score <= 40) level = 'LOW';
  else if (score <= 65) level = 'SUSPICIOUS';
  else level = 'HIGH RISK';

  return { score, level };
}

module.exports = { calculateRiskScore };
