const express = require('express');
const multer = require('multer');
const { insertEvents } = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

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

    await insertEvents(events);
    res.json({ success: true, imported: events.length });
  } catch (err) {
    res.status(400).json({ error: `Parse failed: ${err.message}` });
  }
});

module.exports = router;
