const express = require('express');
const { getDb, getLastWebhookTime } = require('../db');
const { detectAnomalies } = require('../anomalies');

const router = express.Router();

router.get('/', async (_req, res) => {
  const db = getDb();

  const total       = parseInt((await db.get('SELECT COUNT(*) as c FROM events')).c, 10);
  const highRisk    = parseInt((await db.get('SELECT COUNT(*) as c FROM events WHERE risk_score >= 41')).c, 10);
  const suspicious  = parseInt((await db.get("SELECT COUNT(DISTINCT visitor_id) as c FROM events WHERE risk_level IN ('HIGH RISK','SUSPICIOUS')")).c, 10);
  const anomalies   = await detectAnomalies(db);
  const accountEvents = parseInt((await db.get('SELECT COUNT(*) as c FROM account_events')).c, 10);
  const botSessions   = parseInt((await db.get('SELECT COUNT(*) as c FROM behavior_events WHERE bot_probability > 50')).c, 10);

  const high_risk_percent = total > 0 ? Math.round((highRisk / total) * 100) : 0;
  console.log('[overview] total=%d highRisk(score>=41)=%d high_risk_percent=%d%', total, highRisk, high_risk_percent);

  res.json({
    total_events:          total,
    high_risk_percent,
    suspicious_visitors:   suspicious,
    anomalies_found:       anomalies.length,
    last_webhook_at:       getLastWebhookTime(),
    total_account_events:  accountEvents,
    bot_sessions:          botSessions,
  });
});

module.exports = router;
