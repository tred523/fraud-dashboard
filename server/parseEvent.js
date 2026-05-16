const { calculateRiskScore } = require('./scoring');

function toInt(val) {
  if (val === null || val === undefined) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function toFloat(val) {
  if (val === null || val === undefined) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function toStr(val) {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.flat(Infinity).join(',') || null;
  return String(val);
}

function parseEvent(raw) {
  const td = raw.tampering_details || {};
  const ra = raw.raw_device_attributes || {};
  const wb = ra.webgl_basics || {};
  const bd = raw.browser_details || {};
  const iiv4 = (raw.ip_info || {}).v4 || {};
  const geo = iiv4.geolocation || {};
  const ident = raw.identification || {};
  const conf = ident.confidence || {};
  const velIp = (raw.velocity || {}).distinct_ip || {};
  const velEv = (raw.velocity || {}).events || {};

  const botVal = typeof raw.bot === 'object'
    ? (raw.bot?.result || 'not_detected')
    : (raw.bot || 'not_detected');

  const event = {
    event_id:                 raw.event_id || raw.requestId || String(Date.now() + Math.random()),
    timestamp:                toInt(raw.timestamp),
    visitor_id:               ident.visitor_id || raw.visitor_id || raw.visitorId || null,
    visitor_found:            ident.visitor_found !== undefined ? (ident.visitor_found ? 1 : 0) : (raw.visitor_found !== undefined ? (raw.visitor_found ? 1 : 0) : 1),
    first_seen_at:            toInt(ident.first_seen_at ?? raw.first_seen_at),
    last_seen_at:             toInt(ident.last_seen_at ?? raw.last_seen_at),
    ip_address:               raw.ip_address || raw.ip || null,
    browser_name:             toStr(bd.browser_name || raw.browser_name || raw.browserName),
    os:                       toStr(bd.os || raw.os),
    device:                   toStr(bd.device || raw.device),
    bot:                      botVal,
    suspect_score:            toFloat(raw.suspect_score) ?? 0,
    tampering:                raw.tampering ? 1 : 0,
    tampering_ml_score:       toFloat(raw.tampering_ml_score ?? td.tampering_ml_score) ?? 0,
    anti_detect_browser:      (raw.anti_detect_browser || td.anti_detect_browser) ? 1 : 0,
    anomaly_score:            toFloat(raw.anomaly_score !== undefined ? raw.anomaly_score : td.anomaly_score) ?? 0,
    vpn:                      raw.vpn ? 1 : 0,
    proxy:                    raw.proxy ? 1 : 0,
    incognito:                raw.incognito ? 1 : 0,
    virtual_machine:          raw.virtual_machine ? 1 : 0,
    virtual_machine_ml_score: toFloat(raw.virtual_machine_ml_score) ?? 0,
    city_name:                geo.city_name || raw.city_name || null,
    country_code:             geo.country_code || raw.country_code || null,
    asn_name:                 iiv4.asn_name || raw.asn_name || null,
    velocity_distinct_ip_24h: toInt(velIp['24_hours'] ?? raw.velocity_distinct_ip_24h) ?? 0,
    velocity_events_24h:      toInt(velEv['24_hours'] ?? raw.velocity_events_24h) ?? 0,
    font_hash:                raw.font_hash || ra.font_hash || null,
    webgl_renderer_unmasked:  raw.webgl_renderer_unmasked || wb.renderer_unmasked || null,
    hardware_concurrency:     toInt(raw.hardware_concurrency ?? ra.hardware_concurrency),
    device_memory:            toInt(raw.device_memory ?? ra.device_memory),
    platform:                 toStr(raw.platform || ra.platform),
    confidence_score:         toFloat(conf.score ?? raw.confidence_score),
  };

  const { score, level } = calculateRiskScore(event);
  event.risk_score = score;
  event.risk_level = level;

  return event;
}

module.exports = { parseEvent, toInt, toFloat, toStr };
