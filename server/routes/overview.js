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

  const getCount = async (sql, params) => {
    const result = await db.get(sql, params);
    const row = result && result.rows ? result.rows[0] : result;
    return parseInt(row.c, 10);
  };

  const total      = await getCount(`SELECT COUNT(*) as c FROM events WHERE ${eventsWhere}`, eventsParams);
  const highRisk   = await getCount(`SELECT COUNT(*) as c FROM events WHERE risk_score >= 41 AND ${eventsWhere}`, eventsParams);
  const suspicious = await getCount(`SELECT COUNT(DISTINCT visitor_id) as c FROM events WHERE risk_level IN ('HIGH RISK','SUSPICIOUS') AND ${eventsWhere}`, eventsParams);
  const anomalies  = await detectAnomalies(db, tenant);
  const accountEvents = await getCount(`SELECT COUNT(*) as c FROM account_events WHERE ${tenant.acctWhere}`, acctParams);
  const botSessions   = await getCount(`SELECT COUNT(DISTINCT visitor_id) as c FROM events WHERE bot_probability > 50 AND ${tenant.acctWhere}`, acctParams);

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
