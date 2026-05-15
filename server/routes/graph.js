const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/', (_req, res) => {
  const db = getDb();

  const nodes = db.prepare(`
    SELECT visitor_id, risk_level, COUNT(*) as event_count
    FROM events
    GROUP BY visitor_id
  `).all();

  const ipLinks = db.prepare(`
    SELECT DISTINCT a.visitor_id as source, b.visitor_id as target
    FROM events a
    JOIN events b ON a.ip_address = b.ip_address AND a.visitor_id < b.visitor_id
    WHERE a.ip_address IS NOT NULL AND a.ip_address != ''
  `).all().map(l => ({ ...l, type: 'IP' }));

  const fontLinks = db.prepare(`
    SELECT DISTINCT a.visitor_id as source, b.visitor_id as target
    FROM events a
    JOIN events b ON a.font_hash = b.font_hash AND a.visitor_id < b.visitor_id
    WHERE a.font_hash IS NOT NULL AND a.font_hash != ''
  `).all().map(l => ({ ...l, type: 'Font' }));

  const gpuLinks = db.prepare(`
    SELECT DISTINCT a.visitor_id as source, b.visitor_id as target
    FROM events a
    JOIN events b ON a.webgl_renderer_unmasked = b.webgl_renderer_unmasked AND a.visitor_id < b.visitor_id
    WHERE a.webgl_renderer_unmasked IS NOT NULL AND a.webgl_renderer_unmasked != ''
  `).all().map(l => ({ ...l, type: 'GPU' }));

  res.json({
    nodes: nodes.map(n => ({
      id: n.visitor_id,
      riskLevel: n.risk_level,
      eventCount: n.event_count,
    })),
    links: [...ipLinks, ...fontLinks, ...gpuLinks],
  });
});

module.exports = router;
