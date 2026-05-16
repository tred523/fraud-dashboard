const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/:visitorId', (req, res) => {
  const db = getDb();
  const { visitorId } = req.params;

  const events = db.prepare(
    'SELECT * FROM events WHERE visitor_id = ? ORDER BY timestamp ASC'
  ).all(visitorId);

  if (events.length === 0) return res.status(404).json({ error: 'Visitor not found' });

  const ips    = [...new Set(events.map(e => e.ip_address).filter(Boolean))];
  const fonts  = [...new Set(events.map(e => e.font_hash).filter(Boolean))];
  const webgls = [...new Set(events.map(e => e.webgl_renderer_unmasked).filter(Boolean))];

  const ph = (arr) => arr.map(() => '?').join(',');

  const byIp = ips.length
    ? db.prepare(`SELECT DISTINCT visitor_id, ip_address FROM events WHERE ip_address IN (${ph(ips)}) AND visitor_id != ?`).all(...ips, visitorId)
    : [];

  const byFont = fonts.length
    ? db.prepare(`SELECT DISTINCT visitor_id, font_hash FROM events WHERE font_hash IN (${ph(fonts)}) AND visitor_id != ?`).all(...fonts, visitorId)
    : [];

  const byWebgl = webgls.length
    ? db.prepare(`SELECT DISTINCT visitor_id, webgl_renderer_unmasked FROM events WHERE webgl_renderer_unmasked IN (${ph(webgls)}) AND visitor_id != ?`).all(...webgls, visitorId)
    : [];

  const accountTimeline = ips.length
    ? db.prepare(
        `SELECT ae.*, ak.client_name FROM account_events ae
         JOIN api_keys ak ON ae.api_key_id = ak.id
         WHERE ae.ip_address IN (${ph(ips)})
         ORDER BY ae.timestamp ASC`
      ).all(...ips)
    : [];

  res.json({ events, related: { by_ip: byIp, by_font: byFont, by_webgl: byWebgl }, account_timeline: accountTimeline });
});

module.exports = router;
