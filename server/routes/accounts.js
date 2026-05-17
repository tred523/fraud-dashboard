const express = require('express');
const { getDb } = require('../db');
const { calculateVerdict } = require('../verdict');
const { resolveTenant } = require('../tenant');

const router = express.Router();

async function buildAccountVerdict(db, accountId, tenant) {
  const ipResult = await db.all(
    `SELECT DISTINCT ip_address FROM account_events WHERE account_id = ? AND ip_address IS NOT NULL AND ${tenant.acctWhere}`,
    [accountId, ...tenant.acctParams]
  );
  const ipRows = Array.isArray(ipResult) ? ipResult : (ipResult.rows || []);
  const ips = ipRows.map(r => r.ip_address);
  if (ips.length === 0) return null;

  const ph = ips.map(() => '?').join(',');
  const veResult = await db.all(
    `SELECT * FROM events WHERE ip_address IN (${ph}) AND ${tenant.eventsWhere}`,
    [...ips, ...tenant.eventsParams]
  );
  const visitorEvents = Array.isArray(veResult) ? veResult : (veResult.rows || []);
  if (visitorEvents.length === 0) return null;

  const visitorIds = [...new Set(visitorEvents.map(e => e.visitor_id))];
  const bPh = visitorIds.map(() => '?').join(',');
  const behResult = await db.all(
    `SELECT * FROM behavior_events WHERE visitor_id IN (${bPh}) AND ${tenant.acctWhere}`,
    [...visitorIds, ...tenant.acctParams]
  );
  const behavior = Array.isArray(behResult) ? behResult : (behResult.rows || []);

  const pmtResult = await db.all(
    `SELECT * FROM payment_signals WHERE account_id = ? AND ${tenant.pmtWhere}`,
    [accountId, ...tenant.pmtParams]
  );
  const paymentRows = Array.isArray(pmtResult) ? pmtResult : (pmtResult.rows || []);

  let isShared = false;
  const methods = [];
  for (const sig of paymentRows) {
    let linked = [];
    if (sig.paypal_email) {
      const lr = await db.all(
        `SELECT DISTINCT account_id FROM payment_signals WHERE paypal_email = ? AND account_id != ? AND ${tenant.pmtWhere}`,
        [sig.paypal_email, accountId, ...tenant.pmtParams]
      );
      linked = Array.isArray(lr) ? lr : (lr.rows || []);
    } else if (sig.card_last4 && sig.card_bin) {
      const lr = await db.all(
        `SELECT DISTINCT account_id FROM payment_signals WHERE card_last4 = ? AND card_bin = ? AND account_id != ? AND ${tenant.pmtWhere}`,
        [sig.card_last4, sig.card_bin, accountId, ...tenant.pmtParams]
      );
      linked = Array.isArray(lr) ? lr : (lr.rows || []);
    }
    if (linked.length > 0) isShared = true;
    methods.push({ is_prepaid: !!sig.is_prepaid, is_virtual: !!sig.is_virtual, country: sig.country || null });
  }

  return calculateVerdict(visitorEvents, behavior, { is_shared: isShared, methods });
}

// GET /api/accounts
router.get('/', async (req, res) => {
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();

  const acctResult = await db.all(
    `SELECT account_id, COUNT(*) AS total_events, MAX(timestamp) AS last_seen
     FROM account_events
     WHERE ${tenant.acctWhere}
     GROUP BY account_id
     ORDER BY last_seen DESC`,
    tenant.acctParams
  );
  const rows = Array.isArray(acctResult) ? acctResult : (acctResult.rows || []);

  const result = [];
  for (const row of rows) {
    const etResult = await db.all(
      `SELECT DISTINCT event_type FROM account_events WHERE account_id = ? AND ${tenant.acctWhere}`,
      [row.account_id, ...tenant.acctParams]
    );
    const eventTypes = (Array.isArray(etResult) ? etResult : (etResult.rows || [])).map(r => r.event_type);

    const ipResult = await db.all(
      `SELECT DISTINCT ip_address FROM account_events WHERE account_id = ? AND ip_address IS NOT NULL AND ${tenant.acctWhere}`,
      [row.account_id, ...tenant.acctParams]
    );
    const ips = (Array.isArray(ipResult) ? ipResult : (ipResult.rows || [])).map(r => r.ip_address);

    let linkedVisitors = [];
    if (ips.length > 0) {
      const ph = ips.map(() => '?').join(',');
      const vResult = await db.all(
        `SELECT DISTINCT visitor_id FROM events WHERE ip_address IN (${ph}) AND ${tenant.eventsWhere}`,
        [...ips, ...tenant.eventsParams]
      );
      linkedVisitors = (Array.isArray(vResult) ? vResult : (vResult.rows || [])).map(r => r.visitor_id);
    }

    const pmResult = await db.all(
      `SELECT COUNT(*) AS cnt FROM payment_signals WHERE account_id = ? AND ${tenant.pmtWhere}`,
      [row.account_id, ...tenant.pmtParams]
    );
    const pmRows = Array.isArray(pmResult) ? pmResult : (pmResult.rows || []);

    const verdict = await buildAccountVerdict(db, row.account_id, tenant);

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
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  const { account_id } = req.params;

  const evtResult = await db.all(
    `SELECT * FROM account_events WHERE account_id = ? AND ${tenant.acctWhere} ORDER BY timestamp ASC`,
    [account_id, ...tenant.acctParams]
  );
  const events = Array.isArray(evtResult) ? evtResult : (evtResult.rows || []);
  if (events.length === 0) return res.status(404).json({ error: 'Account not found' });

  const ips = [...new Set(events.map(e => e.ip_address).filter(Boolean))];

  let linkedVisitors = [];
  if (ips.length > 0) {
    const ph = ips.map(() => '?').join(',');
    const lvResult = await db.all(
      `SELECT DISTINCT visitor_id, ip_address FROM events WHERE ip_address IN (${ph}) AND ${tenant.eventsWhere}`,
      [...ips, ...tenant.eventsParams]
    );
    linkedVisitors = Array.isArray(lvResult) ? lvResult : (lvResult.rows || []);
  }

  const pmResult = await db.all(
    `SELECT * FROM payment_signals WHERE account_id = ? AND ${tenant.pmtWhere} ORDER BY created_at DESC`,
    [account_id, ...tenant.pmtParams]
  );
  const paymentMethods = Array.isArray(pmResult) ? pmResult : (pmResult.rows || []);

  const verdictResult = await buildAccountVerdict(db, account_id, tenant);

  res.json({
    account_id,
    events,
    payment_methods: paymentMethods,
    linked_visitors: linkedVisitors,
    verdict: verdictResult,
  });
});

module.exports = router;
