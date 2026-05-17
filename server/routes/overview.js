const express = require('express');
const { getDb, getLastWebhookTime } = require('../db');
const { detectAnomalies } = require('../anomalies');
const { resolveTenant } = require('../tenant');

const router = express.Router();

router.get('/', async (req, res) => {
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  const { eventsWhere, eventsParams, acctParams } = tenant;

  const total      = parseInt(db.get(`SELECT COUNT(*) as c FROM events WHERE ${eventsWhere}`, eventsParams).c, 10);
  const highRisk   = parseInt(db.get(`SELECT COUNT(*) as c FROM events WHERE risk_score >= 41 AND ${eventsWhere}`, eventsParams).c, 10);
  const suspicious = parseInt(db.get(`SELECT COUNT(DISTINCT visitor_id) as c FROM events WHERE risk_level IN ('HIGH RISK','SUSPICIOUS') AND ${eventsWhere}`, eventsParams).c, 10);
  const anomalies  = await detectAnomalies(db, tenant);
  const accountEvents = parseInt(db.get(`SELECT COUNT(*) as c FROM account_events WHERE ${tenant.acctWhere}`, acctParams).c, 10);
  const botSessions   = parseInt(db.get(`SELECT COUNT(*) as c FROM behavior_events WHERE bot_probability > 50 AND ${tenant.acctWhere}`, acctParams).c, 10);

  const high_risk_percent = total > 0 ? Math.round((highRisk / total) * 100) : 0;

  res.json({
    total_events:         total,
    high_risk_percent,
    suspicious_visitors:  suspicious,
    anomalies_found:      anomalies.length,
    last_webhook_at:      getLastWebhookTime(),
    total_account_events: accountEvents,
    bot_sessions:         botSessions,
  });
});

module.exports = router;
