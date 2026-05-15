const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

function clusterQuery(db, groupCol, type) {
  return db.prepare(`
    SELECT ${groupCol} as value,
           '${type}' as type,
           COUNT(DISTINCT visitor_id) as visitor_count,
           COUNT(*) as event_count,
           GROUP_CONCAT(DISTINCT visitor_id) as visitor_ids,
           MAX(risk_score) as max_risk_score,
           GROUP_CONCAT(DISTINCT risk_level) as risk_levels
    FROM events
    WHERE ${groupCol} IS NOT NULL AND ${groupCol} != ''
    GROUP BY ${groupCol}
    ORDER BY visitor_count DESC, event_count DESC
  `).all().map(r => ({ ...r, visitor_ids: r.visitor_ids ? r.visitor_ids.split(',') : [] }));
}

router.get('/', (_req, res) => {
  const db = getDb();
  res.json({
    font_hash: clusterQuery(db, 'font_hash', 'font_hash'),
    webgl:     clusterQuery(db, 'webgl_renderer_unmasked', 'webgl'),
    ip:        clusterQuery(db, 'ip_address', 'ip'),
  });
});

module.exports = router;
