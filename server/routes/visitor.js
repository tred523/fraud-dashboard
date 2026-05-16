const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/:visitorId', async (req, res) => {
  const db = getDb();
  const { visitorId } = req.params;

  const events = await db.all(
    'SELECT * FROM events WHERE visitor_id = ? ORDER BY timestamp ASC',
    [visitorId]
  );

  if (events.length === 0) return res.status(404).json({ error: 'Visitor not found' });

  const ips    = [...new Set(events.map(e => e.ip_address).filter(Boolean))];
  const fonts  = [...new Set(events.map(e => e.font_hash).filter(Boolean))];
  const webgls = [...new Set(events.map(e => e.webgl_renderer_unmasked).filter(Boolean))];

  const ph = (arr) => arr.map(() => '?').join(',');

  const byIp = ips.length
    ? await db.all(`SELECT DISTINCT visitor_id, ip_address FROM events WHERE ip_address IN (${ph(ips)}) AND visitor_id != ?`, [...ips, visitorId])
    : [];

  const byFont = fonts.length
    ? await db.all(`SELECT DISTINCT visitor_id, font_hash FROM events WHERE font_hash IN (${ph(fonts)}) AND visitor_id != ?`, [...fonts, visitorId])
    : [];

  const byWebgl = webgls.length
    ? await db.all(`SELECT DISTINCT visitor_id, webgl_renderer_unmasked FROM events WHERE webgl_renderer_unmasked IN (${ph(webgls)}) AND visitor_id != ?`, [...webgls, visitorId])
    : [];

  const accountTimeline = ips.length
    ? await db.all(
        `SELECT ae.*, ak.client_name FROM account_events ae
         JOIN api_keys ak ON ae.api_key_id = ak.id
         WHERE ae.ip_address IN (${ph(ips)})
         ORDER BY ae.timestamp ASC`,
        ips
      )
    : [];

  const behavior = await db.all(
    'SELECT * FROM behavior_events WHERE visitor_id = ? ORDER BY collected_at DESC LIMIT 20',
    [visitorId]
  );

  const linkedAccountIds = ips.length
    ? [...new Set(
        (await db.all(`SELECT DISTINCT account_id FROM account_events WHERE ip_address IN (${ph(ips)})`, ips)).map(r => r.account_id)
      )]
    : [];

  let paymentData = { methods: [], is_shared: false };
  if (linkedAccountIds.length > 0) {
    const phAcc = linkedAccountIds.map(() => '?').join(',');
    const signals = await db.all(
      `SELECT * FROM payment_signals WHERE account_id IN (${phAcc}) ORDER BY created_at DESC`,
      linkedAccountIds
    );

    const seen = new Set();
    const methods = [];
    for (const sig of signals) {
      const key = sig.paypal_email ? `paypal:${sig.paypal_email}` : `card:${sig.card_bin}:${sig.card_last4}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let linked = [];
      if (sig.paypal_email) {
        linked = (await db.all(
          'SELECT DISTINCT account_id FROM payment_signals WHERE paypal_email = ? AND account_id != ?',
          [sig.paypal_email, sig.account_id]
        )).map(r => r.account_id);
      } else if (sig.card_last4 && sig.card_bin) {
        linked = (await db.all(
          'SELECT DISTINCT account_id FROM payment_signals WHERE card_last4 = ? AND card_bin = ? AND account_id != ?',
          [sig.card_last4, sig.card_bin, sig.account_id]
        )).map(r => r.account_id);
      }

      methods.push({ ...sig, linked_accounts: linked });
    }

    paymentData = { methods, is_shared: methods.some(m => m.linked_accounts.length > 0) };
  }

  res.json({ events, related: { by_ip: byIp, by_font: byFont, by_webgl: byWebgl }, account_timeline: accountTimeline, behavior, payment: paymentData });
});

module.exports = router;
