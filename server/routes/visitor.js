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

  try {
    const eventsResult = await db.all(
      `SELECT * FROM events WHERE visitor_id = ? AND ${eventsWhere} ORDER BY timestamp ASC`,
      [visitorId, ...eventsParams]
    );
    const events = Array.isArray(eventsResult) ? eventsResult : (eventsResult.rows || []);

    if (events.length === 0) return res.status(404).json({ error: 'Visitor not found' });

    const ips    = [...new Set(events.map(e => e.ip_address).filter(Boolean))];
    const fonts  = [...new Set(events.map(e => e.font_hash).filter(Boolean))];
    const webgls = [...new Set(events.map(e => e.webgl_renderer_unmasked).filter(Boolean))];

    // ip_history: unique IPs with first/last seen and event count
    const ipMap = {};
    for (const e of events) {
      if (!e.ip_address) continue;
      const ts = Number(e.timestamp);
      if (!ipMap[e.ip_address]) {
        ipMap[e.ip_address] = { ip: e.ip_address, city: e.city_name || null, country: e.country_code || null, first_seen: ts, last_seen: ts, count: 1 };
      } else {
        if (ts < ipMap[e.ip_address].first_seen) ipMap[e.ip_address].first_seen = ts;
        if (ts > ipMap[e.ip_address].last_seen) ipMap[e.ip_address].last_seen = ts;
        if (!ipMap[e.ip_address].city && e.city_name) ipMap[e.ip_address].city = e.city_name;
        if (!ipMap[e.ip_address].country && e.country_code) ipMap[e.ip_address].country = e.country_code;
        ipMap[e.ip_address].count++;
      }
    }
    const ip_history = Object.values(ipMap).sort((a, b) => a.first_seen - b.first_seen);

    // device_changes and session_timeline
    const HARDWARE_FIELDS = [
      { key: 'webgl_renderer_unmasked', label: 'GPU' },
      { key: 'os', label: 'OS' },
      { key: 'platform', label: 'Platform' },
      { key: 'hardware_concurrency', label: 'CPU Cores' },
      { key: 'device_memory', label: 'Device Memory' },
      { key: 'font_hash', label: 'Font Hash' },
    ];
    const device_changes = [];
    const session_timeline = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const ts = Number(e.timestamp);
      const changes = [];
      let newIp = false;
      let gapMs = null;
      if (i > 0) {
        const prev = events[i - 1];
        gapMs = ts - Number(prev.timestamp);
        if (prev.ip_address && e.ip_address && e.ip_address !== prev.ip_address) newIp = true;
        for (const { key, label } of HARDWARE_FIELDS) {
          if (prev[key] != null && e[key] != null && String(prev[key]) !== String(e[key])) {
            changes.push({ field: label, old_value: String(prev[key]), new_value: String(e[key]) });
            device_changes.push({
              timestamp: ts,
              field: label,
              old_value: String(prev[key]),
              new_value: String(e[key]),
              suspicious: key === 'webgl_renderer_unmasked' || key === 'os',
            });
          }
        }
      }
      session_timeline.push({
        timestamp: ts,
        ip_address: e.ip_address || null,
        city: e.city_name || null,
        country: e.country_code || null,
        risk_level: e.risk_level || null,
        risk_score: e.risk_score,
        os: e.os || null,
        browser: e.browser_name || null,
        gpu: e.webgl_renderer_unmasked || null,
        platform: e.platform || null,
        new_ip: newIp,
        gap_ms: gapMs,
        changes,
      });
    }

    const ph = (arr) => arr.map(() => '?').join(',');

    const byIpResult = ips.length
      ? await db.all(`SELECT DISTINCT visitor_id, ip_address FROM events WHERE ip_address IN (${ph(ips)}) AND visitor_id != ? AND ${eventsWhere}`, [...ips, visitorId, ...eventsParams])
      : [];
    const byIp = Array.isArray(byIpResult) ? byIpResult : (byIpResult.rows || []);

    const byFontResult = fonts.length
      ? await db.all(`SELECT DISTINCT visitor_id, font_hash FROM events WHERE font_hash IN (${ph(fonts)}) AND visitor_id != ? AND ${eventsWhere}`, [...fonts, visitorId, ...eventsParams])
      : [];
    const byFont = Array.isArray(byFontResult) ? byFontResult : (byFontResult.rows || []);

    const byWebglResult = webgls.length
      ? await db.all(`SELECT DISTINCT visitor_id, webgl_renderer_unmasked FROM events WHERE webgl_renderer_unmasked IN (${ph(webgls)}) AND visitor_id != ? AND ${eventsWhere}`, [...webgls, visitorId, ...eventsParams])
      : [];
    const byWebgl = Array.isArray(byWebglResult) ? byWebglResult : (byWebglResult.rows || []);

    const accountTimelineResult = ips.length
      ? await db.all(
          `SELECT ae.*, ak.client_name FROM account_events ae
           JOIN api_keys ak ON ae.api_key_id = ak.id
           WHERE ae.ip_address IN (${ph(ips)}) AND ${acctWhere}
           ORDER BY ae.timestamp ASC`,
          [...ips, ...acctParams]
        )
      : [];
    const accountTimeline = Array.isArray(accountTimelineResult) ? accountTimelineResult : (accountTimelineResult.rows || []);

    const behaviorResult = await db.all(
      `SELECT * FROM behavior_events WHERE visitor_id = ? AND ${acctWhere} ORDER BY collected_at DESC LIMIT 20`,
      [visitorId, ...acctParams]
    );
    const behavior = Array.isArray(behaviorResult) ? behaviorResult : (behaviorResult.rows || []);

    const linkedAccountIdsResult = ips.length
      ? await db.all(`SELECT DISTINCT account_id FROM account_events WHERE ip_address IN (${ph(ips)}) AND ${acctWhere}`, [...ips, ...acctParams])
      : [];
    const linkedAccountIdsRows = Array.isArray(linkedAccountIdsResult) ? linkedAccountIdsResult : (linkedAccountIdsResult.rows || []);
    const linkedAccountIds = [...new Set(linkedAccountIdsRows.map(r => r.account_id))];

    const linkedPaymentsResult = linkedAccountIds.length
      ? await db.all(
          `SELECT account_id, card_last4, card_bin, bank_name, card_type, is_prepaid, is_virtual, created_at as timestamp
           FROM payment_signals WHERE account_id IN (${ph(linkedAccountIds)}) AND ${pmtWhere} ORDER BY created_at DESC`,
          [...linkedAccountIds, ...pmtParams]
        )
      : [];
    const linkedPayments = Array.isArray(linkedPaymentsResult) ? linkedPaymentsResult : (linkedPaymentsResult.rows || []);

    let paymentData = { methods: [], is_shared: false };
    if (linkedAccountIds.length > 0) {
      const phAcc = linkedAccountIds.map(() => '?').join(',');
      const signalsResult = await db.all(
        `SELECT * FROM payment_signals WHERE account_id IN (${phAcc}) AND ${pmtWhere} ORDER BY created_at DESC`,
        [...linkedAccountIds, ...pmtParams]
      );
      const signals = Array.isArray(signalsResult) ? signalsResult : (signalsResult.rows || []);

      const seen = new Set();
      const methods = [];
      for (const sig of signals) {
        const key = sig.paypal_email ? `paypal:${sig.paypal_email}` : `card:${sig.card_bin}:${sig.card_last4}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let linked = [];
        if (sig.paypal_email) {
          const lr = await db.all(
            `SELECT DISTINCT account_id FROM payment_signals WHERE paypal_email = ? AND account_id != ? AND ${pmtWhere}`,
            [sig.paypal_email, sig.account_id, ...pmtParams]
          );
          linked = (Array.isArray(lr) ? lr : (lr.rows || [])).map(r => r.account_id);
        } else if (sig.card_last4 && sig.card_bin) {
          const lr = await db.all(
            `SELECT DISTINCT account_id FROM payment_signals WHERE card_last4 = ? AND card_bin = ? AND account_id != ? AND ${pmtWhere}`,
            [sig.card_last4, sig.card_bin, sig.account_id, ...pmtParams]
          );
          linked = (Array.isArray(lr) ? lr : (lr.rows || [])).map(r => r.account_id);
        }

        methods.push({ ...sig, linked_accounts: linked });
      }

      paymentData = { methods, is_shared: methods.some(m => m.linked_accounts.length > 0) };
    }

    res.json({ events, related: { by_ip: byIp, by_font: byFont, by_webgl: byWebgl }, account_timeline: accountTimeline, behavior, payment: paymentData, linked_payments: linkedPayments, ip_history, device_changes, session_timeline });
  } catch (err) {
    console.error('Error in GET /visitor/:visitorId:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
