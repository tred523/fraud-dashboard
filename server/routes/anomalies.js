const express = require('express');
const { getDb } = require('../db');
const { detectAnomalies } = require('../anomalies');
const { resolveTenant } = require('../tenant');

const router = express.Router();

router.get('/', async (req, res) => {
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  res.json(await detectAnomalies(db, tenant));
});

module.exports = router;
