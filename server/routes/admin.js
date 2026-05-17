const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');

const router = express.Router();

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.post('/verify-key', (req, res) => {
  const { admin_key } = req.body;
  if (!process.env.ADMIN_KEY) return res.status(503).json({ error: 'Admin not configured' });
  if (admin_key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Invalid admin key' });
  res.json({ valid: true });
});

router.get('/clients', requireAdmin, (req, res) => {
  const db = getDb();
  const clients = db.all(
    'SELECT id, key, client_name, client_email, created_at, is_active FROM api_keys ORDER BY created_at DESC'
  );

  const result = clients.map(client => {
    const evRow = db.get('SELECT COUNT(*) as c FROM events WHERE tenant_id = ?', [client.id]);
    const aeRow = db.get(
      'SELECT COUNT(*) as c, MAX(timestamp) as last FROM account_events WHERE api_key_id = ?',
      [client.id]
    );
    return {
      ...client,
      total_events: (parseInt(evRow?.c, 10) || 0) + (parseInt(aeRow?.c, 10) || 0),
      last_active: aeRow?.last || null,
    };
  });

  res.json(result);
});

router.post('/create-client', requireAdmin, (req, res) => {
  const { client_name, client_email } = req.body;
  if (!client_name) return res.status(400).json({ error: 'client_name is required' });

  const apiKey = crypto.randomBytes(24).toString('hex');
  const db = getDb();

  db.run(
    'INSERT INTO api_keys (key, client_name, client_email, created_at, is_active) VALUES (?, ?, ?, ?, 1)',
    [apiKey, client_name, client_email || null, Date.now()]
  );

  const row = db.get('SELECT id FROM api_keys WHERE key = ?', [apiKey]);
  res.json({ success: true, api_key: apiKey, client_name, id: row.id });
});

module.exports = router;
