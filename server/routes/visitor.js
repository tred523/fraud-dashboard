const express = require('express');
const { getDb } = require('../db');
const { resolveTenant } = require('../tenant');

const router = express.Router();

router.get('/:visitorId', async (req, res) => {
  const tenant = await resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'API key required' });

  const db = getDb();
  const { visitorId } = req.params;
  const { eventsWhere, eventsParams, acctWhere, acctParams, pmtWhere, pmtParams } = tenant;

  const events = db.all(
    `SELECT * FROM events WHERE visitor_id = ? AND ${eventsWhere} ORDER BY timestamp ASC`,
    [visitorId, ...eventsParams]
  );

  if (events.length === 0) return res.status(404).json({ error: 'Visitor not found' });

  const ips    = [...new Set(events.map(e => e.ip_address).filter(Boolean))];
  const fonts  = [...new Set(events.map(e => e.font_hash).filter(Boolean))];
  const webgls = [...new Set(events.map(e => e.webgl_renderer_unmasked).filter(Boolean))];

  const ph = (arr) => arr.map(() => '?').join(',');

  const byIp = ips.length
    ? db.all(`SELECT DISTINCT visitor_id, ip_address FROM events WHERE ip_address IN (${ph(ips)}) AND visitor_id != ? AND ${eventsWhere}`, [...ips, visitorId, ...eventsParams])
    : [];

  const byFont = fonts.length
    ? db.all(`SELECT DISTINCT visitor_id, font_hash FROM events WHERE font_hash IN (${ph(fonts)}) AND visitor_id != ? AND ${eventsWhere}`, [...fonts, visitorId, ...eventsParams])
    : [];

  const byWebgl = webgls.length
    ? db.all(`SELECT DISTINCT visitor_id, webgl_renderer_unmasked FROM events WHERE webgl_renderer_unmasked IN (${ph(webgls)}) AND visitor_id != ? AND ${eventsWhere}`, [...webgls, visitorId, ...eventsParams])
    : [];

  const accountTimeline = ips.length
    ? db.all(
        `SELECT ae.*, ak.client_name FROM account_events ae
         JOIN api_keys ak ON ae.api_key_id = ak.id
         WHERE ae.ip_address IN (${ph(ips)}) AND ae.${acctWhere}
         ORDER BY ae.timestamp ASC`,
        [...ips, ...acctParams]
      )
    : [];

  const behavior = db.all(
    `SELECT * FROM behavior_events WHERE visitor_id = ? AND ${acctWhere} ORDER BY collected_at DESC LIMIT 20`,
    [visitorId, ...acctParams]
  );

  const linkedAccountIds = ips.length
    ? [...new Set(
        db.all(`SELECT DISTINCT account_id FROM account_events WHERE ip_address IN (${ph(ips)}) AND ${acctWhere}`, [...ips, ...acctParams]).map(r => r.account_id)
      )]
    : [];

  const linkedPayments = linkedAccountIds.length
    ? db.all(
        `SELECT account_id, card_last4, card_bin, bank_name, card_type, is_prepaid, is_virtual, created_at as timestamp
         FROM payment_signals WHERE account_id IN (${ph(linkedAccountIds)}) AND ${pmtWhere} ORDER BY created_at DESC`,
        [...linkedAccountIds, ...pmtParams]
      )
    : [];

  let paymentData = { methods: [], is_shared: false };
  if (linkedAccountIds.length > 0) {
    const phAcc = linkedAccountIds.map(() => '?').join(',');
    const signals = db.all(
      `SELECT * FROM payment_signals WHERE account_id IN (${phAcc}) AND ${pmtWhere} ORDER BY created_at DESC`,
      [...linkedAccountIds, ...pmtParams]
    );

    const seen = new Set();
    const methods = [];
    for (const sig of signals) {
      const key = sig.paypal_email ? `paypal:${sig.paypal_email}` : `card:${sig.card_bin}:${sig.card_last4}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let linked = [];
      if (sig.paypal_email) {
        linked = db.all(
          `SELECT DISTINCT account_id FROM payment_signals WHERE paypal_email = ? AND account_id != ? AND ${pmtWhere}`,
          [sig.paypal_email, sig.account_id, ...pmtParams]
        ).map(r => r.account_id);
      } else if (sig.card_last4 && sig.card_bin) {
        linked = db.all(
          `SELECT DISTINCT account_id FROM payment_signals WHERE card_last4 = ? AND card_bin = ? AND account_id != ? AND ${pmtWhere}`,
          [sig.card_last4, sig.card_bin, sig.account_id, ...pmtParams]
        ).map(r => r.account_id);
      }

      methods.push({ ...sig, linked_accounts: linked });
    }

    paymentData = { methods, is_shared: methods.some(m => m.linked_accounts.length > 0) };
  }

  res.json({ events, related: { by_ip: byIp, by_font: byFont, by_webgl: byWebgl }, account_timeline: accountTimeline, behavior, payment: paymentData, linked_payments: linkedPayments });
});

module.exports = router;
