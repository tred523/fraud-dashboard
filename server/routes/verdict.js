const express = require('express');
const { getDb } = require('../db');
const { calculateVerdict } = require('../verdict');

const router = express.Router();

async function getPaymentData(db, events) {
  const ips = [...new Set(events.map(e => e.ip_address).filter(Boolean))];
  if (ips.length === 0) return { is_shared: false, methods: [] };

  const ph = ips.map(() => '?').join(',');
  const linkedAccountIds = [...new Set(
    (await db.all(`SELECT DISTINCT account_id FROM account_events WHERE ip_address IN (${ph})`, ips))
      .map(r => r.account_id)
  )];
  if (linkedAccountIds.length === 0) return { is_shared: false, methods: [] };

  const phAcc = linkedAccountIds.map(() => '?').join(',');
  const signals = await db.all(
    `SELECT * FROM payment_signals WHERE account_id IN (${phAcc})`,
    linkedAccountIds
  );

  const seen = new Set();
  const methods = [];
  let is_shared = false;

  for (const sig of signals) {
    const key = sig.paypal_email ? `paypal:${sig.paypal_email}` : `card:${sig.card_bin}:${sig.card_last4}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let linked = [];
    if (sig.paypal_email) {
      linked = await db.all(
        'SELECT DISTINCT account_id FROM payment_signals WHERE paypal_email = ? AND account_id != ?',
        [sig.paypal_email, sig.account_id]
      );
    } else if (sig.card_last4 && sig.card_bin) {
      linked = await db.all(
        'SELECT DISTINCT account_id FROM payment_signals WHERE card_last4 = ? AND card_bin = ? AND account_id != ?',
        [sig.card_last4, sig.card_bin, sig.account_id]
      );
    }
    if (linked.length > 0) is_shared = true;
    methods.push({
      is_prepaid: !!sig.is_prepaid,
      is_virtual: !!sig.is_virtual,
      country: sig.country || null,
    });
  }

  return { is_shared, methods };
}

// Batch verdicts — must be registered before /:visitorId
router.get('/batch', async (req, res) => {
  const db = getDb();
  const ids = (req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 100);
  if (ids.length === 0) return res.json({});

  const ph = ids.map(() => '?').join(',');
  const allEvents = await db.all(
    `SELECT * FROM events WHERE visitor_id IN (${ph}) ORDER BY visitor_id, timestamp ASC`,
    ids
  );
  const allBehavior = await db.all(
    `SELECT * FROM behavior_events WHERE visitor_id IN (${ph})`,
    ids
  );

  const eventsByVisitor = {};
  const behaviorByVisitor = {};
  for (const ev of allEvents) {
    (eventsByVisitor[ev.visitor_id] = eventsByVisitor[ev.visitor_id] || []).push(ev);
  }
  for (const b of allBehavior) {
    (behaviorByVisitor[b.visitor_id] = behaviorByVisitor[b.visitor_id] || []).push(b);
  }

  const results = {};
  for (const id of ids) {
    const evs = eventsByVisitor[id];
    if (!evs || evs.length === 0) continue;
    results[id] = calculateVerdict(evs, behaviorByVisitor[id] || [], { is_shared: false });
  }

  res.json(results);
});

router.get('/:visitorId', async (req, res) => {
  const db = getDb();
  const { visitorId } = req.params;

  const events = await db.all(
    'SELECT * FROM events WHERE visitor_id = ? ORDER BY timestamp ASC',
    [visitorId]
  );
  if (events.length === 0) return res.status(404).json({ error: 'Visitor not found' });

  const behavior = await db.all(
    'SELECT * FROM behavior_events WHERE visitor_id = ? ORDER BY collected_at DESC',
    [visitorId]
  );

  const paymentData = await getPaymentData(db, events);
  const verdict = calculateVerdict(events, behavior, paymentData);

  res.json({ visitor_id: visitorId, ...verdict });
});

module.exports = router;
