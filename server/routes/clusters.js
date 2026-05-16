const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

async function clusterQuery(db, groupCol, type) {
  const rows = await db.all(`
    SELECT ${groupCol} as value,
           '${type}' as type,
           COUNT(DISTINCT visitor_id) as visitor_count,
           COUNT(*) as event_count,
           ${db.groupConcat('visitor_id')} as visitor_ids,
           MAX(risk_score) as max_risk_score,
           ${db.groupConcat('risk_level')} as risk_levels
    FROM events
    WHERE ${groupCol} IS NOT NULL AND ${groupCol} != ''
    GROUP BY ${groupCol}
    ORDER BY visitor_count DESC, event_count DESC
  `);
  return rows.map(r => ({
    ...r,
    visitor_count: parseInt(r.visitor_count, 10),
    event_count: parseInt(r.event_count, 10),
    visitor_ids: r.visitor_ids ? r.visitor_ids.split(',') : [],
  }));
}

router.get('/', async (_req, res) => {
  const db = getDb();
  res.json({
    font_hash: await clusterQuery(db, 'font_hash', 'font_hash'),
    webgl:     await clusterQuery(db, 'webgl_renderer_unmasked', 'webgl'),
    ip:        await clusterQuery(db, 'ip_address', 'ip'),
  });
});

module.exports = router;
