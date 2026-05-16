const express = require('express');
const { getDb } = require('../db');
const { calculateVerdict } = require('../verdict');

const router = express.Router();

async function buildAccountVerdict(db, accountId) {
  const ipRows = await db.all(
    'SELECT DISTINCT ip_address FROM account_events WHERE account_id = ? AND ip_address IS NOT NULL',
    [accountId]
  );
  const ips = ipRows.map(r => r.ip_address);
  if (ips.length === 0) return null;

  const ph = ips.map(() => '?').join(',');
  const visitorEvents = await db.all(
    `SELECT * FROM events WHERE ip_address IN (${ph})`,
    ips
  );
  if (visitorEvents.length === 0) return null;

  const visitorIds = [...new Set(visitorEvents.map(e => e.visitor_id))];
  const bPh = visitorIds.map(() => '?').join(',');
  const behavior = await db.all(
    `SELECT * FROM behavior_events WHERE visitor_id IN (${bPh})`,
    visitorIds
  );

  const paymentRows = await db.all(
    'SELECT * FROM payment_signals WHERE account_id = ?',
    [accountId]
  );

  let isShared = false;
  const methods = [];
  for (const sig of paymentRows) {
    let linked = [];
    if (sig.paypal_email) {
      linked = await db.all(
        'SELECT DISTINCT account_id FROM payment_signals WHERE paypal_email = ? AND account_id != ?',
        [sig.paypal_email, accountId]
      );
    } else if (sig.card_last4 && sig.card_bin) {
      linked = await db.all(
        'SELECT DISTINCT account_id FROM payment_signals WHERE card_last4 = ? AND card_bin = ? AND account_id != ?',
        [sig.card_last4, sig.card_bin, accountId]
      );
    }
    if (linked.length > 0) isShared = true;
    methods.push({ is_prepaid: !!sig.is_prepaid, is_virtual: !!sig.is_virtual, country: sig.country || null });
  }

  return calculateVerdict(visitorEvents, behavior, { is_shared: isShared, methods });
}

// GET /api/accounts
router.get('/', async (req, res) => {
  const db = getDb();

  const rows = await db.all(
    `SELECT account_id, COUNT(*) AS total_events, MAX(timestamp) AS last_seen
     FROM account_events
     GROUP BY account_id
     ORDER BY last_seen DESC`
  );

  const result = [];
  for (const row of rows) {
    const evTypeRows = await db.all(
      'SELECT DISTINCT event_type FROM account_events WHERE account_id = ?',
      [row.account_id]
    );
    const eventTypes = evTypeRows.map(r => r.event_type);

    const ipRows = await db.all(
      'SELECT DISTINCT ip_address FROM account_events WHERE account_id = ? AND ip_address IS NOT NULL',
      [row.account_id]
    );
    const ips = ipRows.map(r => r.ip_address);

    let linkedVisitors = [];
    if (ips.length > 0) {
      const ph = ips.map(() => '?').join(',');
      const vRows = await db.all(
        `SELECT DISTINCT visitor_id FROM events WHERE ip_address IN (${ph})`,
        ips
      );
      linkedVisitors = vRows.map(r => r.visitor_id);
    }

    const pmRows = await db.all(
      'SELECT COUNT(*) AS cnt FROM payment_signals WHERE account_id = ?',
      [row.account_id]
    );

    const verdict = await buildAccountVerdict(db, row.account_id);

    result.push({
      account_id: row.account_id,
      total_events: row.total_events,
      last_seen: row.last_seen,
      event_types: eventTypes,
      linked_visitor_ids: linkedVisitors,
      payment_methods_count: Number(pmRows[0]?.cnt || 0),
      verdict: verdict?.verdict || null,
      verdict_score: verdict?.verdict_score || 0,
    });
  }

  res.json(result);
});

// GET /api/accounts/:account_id
router.get('/:account_id', async (req, res) => {
  const db = getDb();
  const { account_id } = req.params;

  const events = await db.all(
    'SELECT * FROM account_events WHERE account_id = ? ORDER BY timestamp ASC',
    [account_id]
  );
  if (events.length === 0) return res.status(404).json({ error: 'Account not found' });

  const ips = [...new Set(events.map(e => e.ip_address).filter(Boolean))];

  let linkedVisitors = [];
  if (ips.length > 0) {
    const ph = ips.map(() => '?').join(',');
    linkedVisitors = await db.all(
      `SELECT DISTINCT visitor_id, ip_address FROM events WHERE ip_address IN (${ph})`,
      ips
    );
  }

  const paymentMethods = await db.all(
    'SELECT * FROM payment_signals WHERE account_id = ? ORDER BY created_at DESC',
    [account_id]
  );

  const verdictResult = await buildAccountVerdict(db, account_id);

  res.json({
    account_id,
    events,
    payment_methods: paymentMethods,
    linked_visitors: linkedVisitors,
    verdict: verdictResult,
  });
});

module.exports = router;
