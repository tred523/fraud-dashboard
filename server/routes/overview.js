const express = require('express');
const { getDb, getLastWebhookTime } = require('../db');
const { detectAnomalies } = require('../anomalies');

const router = express.Router();

router.get('/', (_req, res) => {
  const db = getDb();

  const total     = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
  const highRisk  = db.prepare("SELECT COUNT(*) as c FROM events WHERE risk_level = 'HIGH RISK'").get().c;
  const suspicious = db.prepare("SELECT COUNT(DISTINCT visitor_id) as c FROM events WHERE risk_level IN ('HIGH RISK','SUSPICIOUS')").get().c;
  const anomalies = detectAnomalies(db);

  res.json({
    total_events:        total,
    high_risk_percent:   total > 0 ? Math.round((highRisk / total) * 100) : 0,
    suspicious_visitors: suspicious,
    anomalies_found:     anomalies.length,
    last_webhook_at:     getLastWebhookTime(),
  });
});

module.exports = router;
