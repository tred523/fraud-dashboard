const express = require('express');
const { getDb } = require('../db');
const { detectAnomalies } = require('../anomalies');

const router = express.Router();

router.get('/', (_req, res) => {
  const db = getDb();
  res.json(detectAnomalies(db));
});

module.exports = router;
