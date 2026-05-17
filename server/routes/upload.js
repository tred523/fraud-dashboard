const express = require('express');
const multer = require('multer');
const { insertEvents, getDb } = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const apiKey = req.headers['x-api-key'] || req.body.api_key;
  if (!apiKey) return res.status(400).json({ error: 'api_key is required' });

  const db = getDb();
  const keyResult = await db.get('SELECT id, is_active FROM api_keys WHERE key = ?', [apiKey]);
  const keyRow = keyResult && keyResult.rows ? keyResult.rows[0] : keyResult;
  if (!keyRow || keyRow.is_active === 0) return res.status(401).json({ error: 'Invalid API key' });

  try {
    const text = req.file.buffer.toString('utf-8').trim();
    let events;

    try {
      const parsed = JSON.parse(text);
      events = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      events = text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => JSON.parse(l));
    }

    insertEvents(events, keyRow.id);
    res.json({ success: true, imported: events.length });
  } catch (err) {
    res.status(400).json({ error: `Parse failed: ${err.message}` });
  }
});

module.exports = router;
