const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

const VALID_EVENT_TYPES = ['login', 'signup', 'payment', 'password_change', 'api_call', 'export', 'settings_change'];

router.post('/', async (req, res) => {
  const { account_id, event_type, timestamp, ip_address, user_agent, metadata, api_key } = req.body;

  if (!account_id || !event_type || !api_key) {
    return res.status(400).json({ error: 'account_id, event_type, and api_key are required' });
  }

  if (!VALID_EVENT_TYPES.includes(event_type)) {
    return res.status(400).json({ error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` });
  }

  const db = getDb();
  const keyRow = await db.get('SELECT id FROM api_keys WHERE key = ?', [api_key]);
  if (!keyRow) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const ts = timestamp || Date.now();
  const metadataStr = metadata ? JSON.stringify(metadata) : null;

  await db.run(
    `INSERT INTO account_events (account_id, event_type, timestamp, ip_address, user_agent, metadata, api_key_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [account_id, event_type, ts, ip_address || null, user_agent || null, metadataStr, keyRow.id]
  );

  if (event_type === 'payment' && metadata) {
    const { card_last4, card_bin, paypal_email } = metadata;
    if (card_last4 || paypal_email) {
      await db.run(
        `INSERT INTO payment_signals (account_id, card_last4, card_bin, paypal_email, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [account_id, card_last4 || null, card_bin || null, paypal_email || null, ts]
      );
    }
  }

  res.json({ success: true, message: 'Event ingested' });
});

module.exports = router;
