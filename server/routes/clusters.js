const express = require('express');
const { getDb } = require('../db');
const { resolveTenant } = require('../tenant');

const router = express.Router();

async function clusterQuery(db, groupCol, type, eventsWhere, eventsParams) {
  const rows = db.all(`
    SELECT ${groupCol} as value,
           '${type}' as type,
           COUNT(DISTINCT visitor_id) as visitor_count,
           COUNT(*) as event_count,
           ${db.groupConcat('visitor_id')} as visitor_ids,
           MAX(risk_score) as max_risk_score,
           ${db.groupConcat('risk_level')} as risk_levels
    FROM events
    WHERE ${groupCol} IS NOT NULL AND ${groupCol} != '' AND ${eventsWhere}
    GROUP BY ${groupCol}
    ORDER BY visitor_count DESC, event_count DESC
  `, eventsParams);
  return rows.map(r => ({
    ...r,
    visitor_count: parseInt(r.visitor_count, 10),
    event_count: parseInt(r.event_count, 10),
    visitor_ids: r.visitor_ids ? r.visitor_ids.split(',') : [],
  }));
}

router.get('/', async (req, res) => {
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  const { eventsWhere, eventsParams } = tenant;

  res.json({
    font_hash: await clusterQuery(db, 'font_hash', 'font_hash', eventsWhere, eventsParams),
    webgl:     await clusterQuery(db, 'webgl_renderer_unmasked', 'webgl', eventsWhere, eventsParams),
    ip:        await clusterQuery(db, 'ip_address', 'ip', eventsWhere, eventsParams),
  });
});

module.exports = router;
