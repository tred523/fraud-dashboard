const express = require('express');
const { getDb } = require('../db');
const { resolveTenant } = require('../tenant');

const router = express.Router();

// Batch GET: GET /api/labels?ids=id1,id2,...
router.get('/', async (req, res) => {
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  const ids = (req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 200);
  if (ids.length === 0) return res.json({});

  const ph = ids.map(() => '?').join(',');
  const rows = await db.all(`SELECT * FROM visitor_labels WHERE visitor_id IN (${ph})`, ids);
  const result = {};
  for (const row of (Array.isArray(rows) ? rows : [])) {
    result[row.visitor_id] = row;
  }
  res.json(result);
});

// GET /api/labels/:visitorId
router.get('/:visitorId', async (req, res) => {
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  const row = await db.get('SELECT * FROM visitor_labels WHERE visitor_id = ?', [req.params.visitorId]);
  res.json(row);
});

// POST /api/labels/:visitorId - create or update
router.post('/:visitorId', async (req, res) => {
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  const { visitorId } = req.params;
  const { label, category, notes } = req.body;
  const now = Date.now();

  if (db.isPostgres) {
    await db.run(
      `INSERT INTO visitor_labels (visitor_id, label, category, notes)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (visitor_id) DO UPDATE SET label = EXCLUDED.label, category = EXCLUDED.category, notes = EXCLUDED.notes, updated_at = NOW()`,
      [visitorId, label || null, category || null, notes || null]
    );
  } else {
    await db.run(
      `INSERT INTO visitor_labels (visitor_id, label, category, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(visitor_id) DO UPDATE SET label = excluded.label, category = excluded.category, notes = excluded.notes, updated_at = excluded.updated_at`,
      [visitorId, label || null, category || null, notes || null, now, now]
    );
  }

  const row = await db.get('SELECT * FROM visitor_labels WHERE visitor_id = ?', [visitorId]);
  res.json(row);
});

// DELETE /api/labels/:visitorId
router.delete('/:visitorId', async (req, res) => {
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  await db.run('DELETE FROM visitor_labels WHERE visitor_id = ?', [req.params.visitorId]);
  res.json({ ok: true });
});

module.exports = router;
