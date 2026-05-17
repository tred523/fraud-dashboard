const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.post('/verify', (req, res) => {
  const { api_key } = req.body;
  if (!api_key) return res.status(400).json({ error: 'api_key required' });

  const db = getDb();
  const keyRow = db.get('SELECT id, client_name, is_active FROM api_keys WHERE key = ?', [api_key]);

  if (!keyRow) return res.status(401).json({ error: 'Invalid API key' });
  if (keyRow.is_active === 0) return res.status(403).json({ error: 'API key is inactive' });

  const is_admin = !!(process.env.ADMIN_KEY && api_key === process.env.ADMIN_KEY);

  res.json({ valid: true, client_name: keyRow.client_name, is_admin });
});

module.exports = router;
