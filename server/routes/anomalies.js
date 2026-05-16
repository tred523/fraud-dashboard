const express = require('express');
const { getDb } = require('../db');
const { detectAnomalies } = require('../anomalies');

const router = express.Router();

router.get('/', async (_req, res) => {
  const db = getDb();
  res.json(await detectAnomalies(db));
});

module.exports = router;
