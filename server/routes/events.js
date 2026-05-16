const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const db = getDb();
  const { risk_level, country, flag, limit = 200, offset = 0 } = req.query;

  const conditions = [];
  const params = [];

  if (risk_level) { conditions.push('risk_level = ?'); params.push(risk_level); }
  if (country)    { conditions.push('country_code = ?'); params.push(country); }

  if (flag === 'vpn')               conditions.push('vpn = 1');
  else if (flag === 'proxy')        conditions.push('proxy = 1');
  else if (flag === 'vm')           conditions.push('virtual_machine = 1');
  else if (flag === 'anti_detect')  conditions.push('anti_detect_browser = 1');
  else if (flag === 'tampering')    conditions.push('tampering = 1');
  else if (flag === 'bot')          conditions.push("bot != 'not_detected'");

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const events = await db.all(
    `SELECT * FROM events ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), parseInt(offset)]
  );

  const row = await db.get(
    `SELECT COUNT(*) as c FROM events ${where}`,
    params
  );
  const total = parseInt(row.c, 10);

  res.json({ events, total });
});

router.get('/countries', async (_req, res) => {
  const db = getDb();
  const rows = await db.all(
    'SELECT DISTINCT country_code FROM events WHERE country_code IS NOT NULL ORDER BY country_code'
  );
  res.json(rows.map(r => r.country_code));
});

module.exports = router;
