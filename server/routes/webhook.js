const express = require('express');
const crypto = require('crypto');
const { insertEvents, setLastWebhookTime } = require('../db');

const router = express.Router();

router.use(express.raw({ type: '*/*' }));

function verifySignature(rawBody, signature, secret) {
  const parts = (signature || '').split('=');
  if (parts.length !== 2 || parts[0] !== 'v1' || !parts[1]) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(parts[1], 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function parseFpWebhook(payload) {
  const ident     = payload.products?.identification?.data || {};
  const botd      = payload.products?.botd?.data || {};
  const tampering = payload.products?.tampering?.data || {};
  const vpn       = payload.products?.vpn?.data || {};
  const proxy     = payload.products?.proxy?.data || {};
  const incognito = payload.products?.incognito?.data || {};
  const vm        = payload.products?.virtualMachine?.data || {};
  const ipInfo    = (payload.products?.ipInfo?.data?.v4) || {};
  const suspect   = payload.products?.suspectScore?.data || {};

  return {
    event_id:               payload.requestId || ident.requestId,
    timestamp:              payload.timestamp  || ident.timestamp,
    visitor_id:             payload.visitorId  || ident.visitorId,
    visitor_found:          ident.visitorFound,
    first_seen_at:          ident.firstSeenAt?.global ? new Date(ident.firstSeenAt.global).getTime() : null,
    last_seen_at:           ident.lastSeenAt?.global  ? new Date(ident.lastSeenAt.global).getTime()  : null,
    ip_address:             ident.ip || null,
    browser_name:           ident.browserDetails?.browserName || null,
    os:                     ident.browserDetails?.os || null,
    device:                 ident.browserDetails?.device || null,
    bot:                    botd.bot?.result || 'not_detected',
    suspect_score:          suspect.result || 0,
    tampering:              tampering.result || false,
    tampering_ml_score:     tampering.anomalyScore || 0,
    anti_detect_browser:    tampering.antiDetectBrowser || false,
    anomaly_score:          tampering.anomalyScore || 0,
    vpn:                    vpn.result || false,
    proxy:                  proxy.result || false,
    incognito:              incognito.result !== undefined ? incognito.result : (ident.incognito || false),
    virtual_machine:        vm.result || false,
    virtual_machine_ml_score: vm.probability || 0,
    city_name:              ident.ipLocation?.city?.name || null,
    country_code:           ident.ipLocation?.country?.code || null,
    asn_name:               ipInfo.asn?.name || null,
    velocity_distinct_ip_24h: 0,
    velocity_events_24h:    0,
    font_hash:              null,
    webgl_renderer_unmasked: null,
    hardware_concurrency:   null,
    device_memory:          null,
    platform:               null,
    confidence_score:       ident.confidence?.score || null,
  };
}

router.post('/fingerprint', async (req, res) => {
  const rawBody  = req.body;
  const secret   = process.env.FPJS_SECRET_KEY;
  const signature = req.headers['fpjs-event-signature'];

  if (secret) {
    if (!verifySignature(rawBody, signature, secret)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  try {
    const normalized = parseFpWebhook(payload);
    await insertEvents([normalized]);
    setLastWebhookTime();
    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook insert error:', err);
    res.status(500).json({ error: 'Failed to store event' });
  }
});

module.exports = router;
