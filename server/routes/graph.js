const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/', async (_req, res) => {
  const db = getDb();

  const nodes = await db.all(`
    SELECT visitor_id, risk_level, COUNT(*) as event_count
    FROM events
    GROUP BY visitor_id, risk_level
  `);

  const ipLinks = (await db.all(`
    SELECT DISTINCT a.visitor_id as source, b.visitor_id as target
    FROM events a
    JOIN events b ON a.ip_address = b.ip_address AND a.visitor_id < b.visitor_id
    WHERE a.ip_address IS NOT NULL AND a.ip_address != ''
  `)).map(l => ({ ...l, type: 'IP' }));

  const fontLinks = (await db.all(`
    SELECT DISTINCT a.visitor_id as source, b.visitor_id as target
    FROM events a
    JOIN events b ON a.font_hash = b.font_hash AND a.visitor_id < b.visitor_id
    WHERE a.font_hash IS NOT NULL AND a.font_hash != ''
  `)).map(l => ({ ...l, type: 'Font' }));

  const gpuLinks = (await db.all(`
    SELECT DISTINCT a.visitor_id as source, b.visitor_id as target
    FROM events a
    JOIN events b ON a.webgl_renderer_unmasked = b.webgl_renderer_unmasked AND a.visitor_id < b.visitor_id
    WHERE a.webgl_renderer_unmasked IS NOT NULL AND a.webgl_renderer_unmasked != ''
  `)).map(l => ({ ...l, type: 'GPU' }));

  const paymentLinks = (await db.all(`
    SELECT DISTINCT
      CASE WHEN a.visitor_id < b.visitor_id THEN a.visitor_id ELSE b.visitor_id END as source,
      CASE WHEN a.visitor_id < b.visitor_id THEN b.visitor_id ELSE a.visitor_id END as target
    FROM payment_signals ps1
    JOIN payment_signals ps2 ON ps1.account_id != ps2.account_id
      AND (
        (ps1.card_last4 IS NOT NULL AND ps1.card_last4 = ps2.card_last4 AND ps1.card_bin = ps2.card_bin)
        OR (ps1.paypal_email IS NOT NULL AND ps1.paypal_email = ps2.paypal_email)
      )
    JOIN account_events ae1 ON ae1.account_id = ps1.account_id AND ae1.ip_address IS NOT NULL
    JOIN account_events ae2 ON ae2.account_id = ps2.account_id AND ae2.ip_address IS NOT NULL
    JOIN events a ON a.ip_address = ae1.ip_address
    JOIN events b ON b.ip_address = ae2.ip_address
    WHERE a.visitor_id != b.visitor_id
  `)).map(l => ({ ...l, type: 'Payment' }));

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
