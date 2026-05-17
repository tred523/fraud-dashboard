const express = require('express');
const { getDb } = require('../db');
const { resolveTenant } = require('../tenant');

const router = express.Router();

router.get('/', async (req, res) => {
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  const { eventsWhere, eventsParams, eventsCondA, eventsCondB, acctWhere, acctParams, pmtWhere, pmtParams } = tenant;
  const evId = tenant.tenantId;

  const nodesResult = await db.all(`
    SELECT visitor_id, risk_level, COUNT(*) as event_count
    FROM events
    WHERE ${eventsWhere}
    GROUP BY visitor_id, risk_level
  `, eventsParams);
  const nodes = Array.isArray(nodesResult) ? nodesResult : (nodesResult.rows || []);

  const ipLinksResult = await db.all(`
    SELECT DISTINCT a.visitor_id as source, b.visitor_id as target
    FROM events a
    JOIN events b ON a.ip_address = b.ip_address AND a.visitor_id < b.visitor_id
    WHERE a.ip_address IS NOT NULL AND a.ip_address != ''
    AND ${eventsCondA} AND ${eventsCondB}
  `, []);
  const ipLinks = (Array.isArray(ipLinksResult) ? ipLinksResult : (ipLinksResult.rows || [])).map(l => ({ ...l, type: 'IP' }));

  const fontLinksResult = await db.all(`
    SELECT DISTINCT a.visitor_id as source, b.visitor_id as target
    FROM events a
    JOIN events b ON a.font_hash = b.font_hash AND a.visitor_id < b.visitor_id
    WHERE a.font_hash IS NOT NULL AND a.font_hash != ''
    AND ${eventsCondA} AND ${eventsCondB}
  `, []);
  const fontLinks = (Array.isArray(fontLinksResult) ? fontLinksResult : (fontLinksResult.rows || [])).map(l => ({ ...l, type: 'Font' }));

  const gpuLinksResult = await db.all(`
    SELECT DISTINCT a.visitor_id as source, b.visitor_id as target
    FROM events a
    JOIN events b ON a.webgl_renderer_unmasked = b.webgl_renderer_unmasked AND a.visitor_id < b.visitor_id
    WHERE a.webgl_renderer_unmasked IS NOT NULL AND a.webgl_renderer_unmasked != ''
    AND ${eventsCondA} AND ${eventsCondB}
  `, []);
  const gpuLinks = (Array.isArray(gpuLinksResult) ? gpuLinksResult : (gpuLinksResult.rows || [])).map(l => ({ ...l, type: 'GPU' }));

  const pmtCondPs1 = tenant.isDemo ? '(ps1.api_key_id IS NULL OR ps1.api_key_id = ?)' : 'ps1.api_key_id = ?';
  const paymentLinksRaw = await db.all(`
    SELECT DISTINCT
      CASE WHEN a.visitor_id < b.visitor_id THEN a.visitor_id ELSE b.visitor_id END as source,
      CASE WHEN a.visitor_id < b.visitor_id THEN b.visitor_id ELSE a.visitor_id END as target
    FROM payment_signals ps1
    JOIN payment_signals ps2 ON ps1.account_id != ps2.account_id
      AND (
        (ps1.card_last4 IS NOT NULL AND ps1.card_last4 = ps2.card_last4 AND ps1.card_bin = ps2.card_bin)
        OR (ps1.paypal_email IS NOT NULL AND ps1.paypal_email = ps2.paypal_email)
      )
    JOIN account_events ae1 ON ae1.account_id = ps1.account_id AND ae1.ip_address IS NOT NULL AND ae1.api_key_id = ?
    JOIN account_events ae2 ON ae2.account_id = ps2.account_id AND ae2.ip_address IS NOT NULL AND ae2.api_key_id = ?
    JOIN events a ON a.ip_address = ae1.ip_address AND ${eventsCondA}
    JOIN events b ON b.ip_address = ae2.ip_address AND ${eventsCondB}
    WHERE a.visitor_id != b.visitor_id AND ${pmtCondPs1}
  `, [evId, evId, evId]);
  const paymentLinks = (Array.isArray(paymentLinksRaw) ? paymentLinksRaw : (paymentLinksRaw.rows || [])).map(l => ({ ...l, type: 'Payment' }));

  res.json({
    nodes: nodes.map(n => ({
      id: n.visitor_id,
      riskLevel: n.risk_level,
      eventCount: parseInt(n.event_count, 10),
    })),
    links: [...ipLinks, ...fontLinks, ...gpuLinks, ...paymentLinks],
  });
});

module.exports = router;
