const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

const VALID_EVENT_TYPES = ['login', 'signup', 'payment', 'password_change', 'api_call', 'export', 'settings_change'];

router.post('/', (req, res) => {
  const { account_id, event_type, timestamp, ip_address, user_agent, metadata, api_key } = req.body;

  if (!account_id || !event_type || !api_key) {
    return res.status(400).json({ error: 'account_id, event_type, and api_key are required' });
  }

  if (!VALID_EVENT_TYPES.includes(event_type)) {
    return res.status(400).json({ error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` });
  }

  const db = getDb();
  const keyRow = db.prepare('SELECT id FROM api_keys WHERE key = ?').get(api_key);
  if (!keyRow) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const ts = timestamp || Date.now();
  const metadataStr = metadata ? JSON.stringify(metadata) : null;

  db.prepare(`
    INSERT INTO account_events (account_id, event_type, timestamp, ip_address, user_agent, metadata, api_key_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(account_id, event_type, ts, ip_address || null, user_agent || null, metadataStr, keyRow.id);

  res.json({ success: true, message: 'Event ingested' });
});

module.exports = router;
