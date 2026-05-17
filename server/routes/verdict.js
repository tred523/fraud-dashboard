const express = require('express');
const { getDb } = require('../db');
const { calculateVerdict } = require('../verdict');
const { resolveTenant } = require('../tenant');

const router = express.Router();

async function getPaymentData(db, events, tenant) {
  const ips = [...new Set(events.map(e => e.ip_address).filter(Boolean))];
  if (ips.length === 0) return { is_shared: false, methods: [] };

  const ph = ips.map(() => '?').join(',');
  const acctResult = await db.all(`SELECT DISTINCT account_id FROM account_events WHERE ip_address IN (${ph}) AND ${tenant.acctWhere}`, [...ips, ...tenant.acctParams]);
  const linkedAccountIds = [...new Set((Array.isArray(acctResult) ? acctResult : (acctResult.rows || [])).map(r => r.account_id))];
  if (linkedAccountIds.length === 0) return { is_shared: false, methods: [] };

  const phAcc = linkedAccountIds.map(() => '?').join(',');
  const sigResult = await db.all(
    `SELECT * FROM payment_signals WHERE account_id IN (${phAcc}) AND ${tenant.pmtWhere}`,
    [...linkedAccountIds, ...tenant.pmtParams]
  );
  const signals = Array.isArray(sigResult) ? sigResult : (sigResult.rows || []);

  const seen = new Set();
  const methods = [];
  let is_shared = false;

  for (const sig of signals) {
    const key = sig.paypal_email ? `paypal:${sig.paypal_email}` : `card:${sig.card_bin}:${sig.card_last4}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let linked = [];
    if (sig.paypal_email) {
      const lr = await db.all(
        `SELECT DISTINCT account_id FROM payment_signals WHERE paypal_email = ? AND account_id != ? AND ${tenant.pmtWhere}`,
        [sig.paypal_email, sig.account_id, ...tenant.pmtParams]
      );
      linked = Array.isArray(lr) ? lr : (lr.rows || []);
    } else if (sig.card_last4 && sig.card_bin) {
      const lr = await db.all(
        `SELECT DISTINCT account_id FROM payment_signals WHERE card_last4 = ? AND card_bin = ? AND account_id != ? AND ${tenant.pmtWhere}`,
        [sig.card_last4, sig.card_bin, sig.account_id, ...tenant.pmtParams]
      );
      linked = Array.isArray(lr) ? lr : (lr.rows || []);
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
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  const ids = (req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 100);
  if (ids.length === 0) return res.json({});

  const ph = ids.map(() => '?').join(',');
  const allEventsResult = await db.all(
    `SELECT * FROM events WHERE visitor_id IN (${ph}) AND ${tenant.eventsWhere} ORDER BY visitor_id, timestamp ASC`,
    [...ids, ...tenant.eventsParams]
  );
  const allEvents = Array.isArray(allEventsResult) ? allEventsResult : (allEventsResult.rows || []);

  const allBehaviorResult = await db.all(
    `SELECT * FROM behavior_events WHERE visitor_id IN (${ph}) AND ${tenant.acctWhere}`,
    [...ids, ...tenant.acctParams]
  );
  const allBehavior = Array.isArray(allBehaviorResult) ? allBehaviorResult : (allBehaviorResult.rows || []);

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
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  const { visitorId } = req.params;

  const eventsResult = await db.all(
    `SELECT * FROM events WHERE visitor_id = ? AND ${tenant.eventsWhere} ORDER BY timestamp ASC`,
    [visitorId, ...tenant.eventsParams]
  );
  const events = Array.isArray(eventsResult) ? eventsResult : (eventsResult.rows || []);
  if (events.length === 0) return res.status(404).json({ error: 'Visitor not found' });

  const behaviorResult = await db.all(
    `SELECT * FROM behavior_events WHERE visitor_id = ? AND ${tenant.acctWhere} ORDER BY collected_at DESC`,
    [visitorId, ...tenant.acctParams]
  );
  const behavior = Array.isArray(behaviorResult) ? behaviorResult : (behaviorResult.rows || []);

  const paymentData = await getPaymentData(db, events, tenant);
  const verdict = calculateVerdict(events, behavior, paymentData);

  res.json({ visitor_id: visitorId, ...verdict });
});

module.exports = router;
