const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { calculateRiskScore } = require('./scoring');
const { SAMPLE_DATA } = require('./sampleData');

const DB_PATH = path.join(__dirname, '..', 'fraud.db');
let db;

function getDb() {
  if (!db) db = new DatabaseSync(DB_PATH);
  return db;
}

function initDb() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE,
      timestamp INTEGER,
      visitor_id TEXT,
      visitor_found INTEGER DEFAULT 1,
      first_seen_at INTEGER,
      last_seen_at INTEGER,
      ip_address TEXT,
      browser_name TEXT,
      os TEXT,
      device TEXT,
      bot TEXT,
      suspect_score REAL DEFAULT 0,
      tampering INTEGER DEFAULT 0,
      tampering_ml_score REAL DEFAULT 0,
      anti_detect_browser INTEGER DEFAULT 0,
      anomaly_score REAL DEFAULT 0,
      vpn INTEGER DEFAULT 0,
      proxy INTEGER DEFAULT 0,
      incognito INTEGER DEFAULT 0,
      virtual_machine INTEGER DEFAULT 0,
      virtual_machine_ml_score REAL DEFAULT 0,
      city_name TEXT,
      country_code TEXT,
      asn_name TEXT,
      velocity_distinct_ip_24h INTEGER DEFAULT 0,
      velocity_events_24h INTEGER DEFAULT 0,
      font_hash TEXT,
      webgl_renderer_unmasked TEXT,
      hardware_concurrency INTEGER,
      device_memory INTEGER,
      platform TEXT,
      confidence_score REAL,
      risk_score INTEGER DEFAULT 0,
      risk_level TEXT DEFAULT 'CLEAN',
      bot_probability REAL DEFAULT NULL
    )
  `);

  try { database.exec('ALTER TABLE events ADD COLUMN bot_probability REAL DEFAULT NULL'); } catch (_) {}

  database.exec(`
    CREATE TABLE IF NOT EXISTS behavior_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT,
      account_id TEXT,
      api_key_id INTEGER,
      session_duration INTEGER,
      mouse_move_count INTEGER DEFAULT 0,
      click_count INTEGER DEFAULT 0,
      keyboard_event_count INTEGER DEFAULT 0,
      scroll_direction_changes INTEGER DEFAULT 0,
      backspace_count INTEGER DEFAULT 0,
      mouse_smoothness_score REAL DEFAULT 50,
      typing_rhythm_score REAL DEFAULT 50,
      bot_probability REAL DEFAULT 0,
      page_timeline TEXT,
      form_interactions TEXT,
      collected_at INTEGER NOT NULL
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      client_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS account_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT,
      api_key_id INTEGER NOT NULL
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS payment_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      card_last4 TEXT,
      card_bin TEXT,
      paypal_email TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  const demoKey = database.prepare("SELECT id FROM api_keys WHERE key = 'demo_key_12345'").get();
  if (!demoKey) {
    database.prepare("INSERT INTO api_keys (key, client_name, created_at) VALUES ('demo_key_12345', 'Demo Client', ?)").run(Date.now());
  }

  const count = database.prepare('SELECT COUNT(*) as c FROM events').get().c;
  if (count === 0) insertEvents(SAMPLE_DATA);
}

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
    event_id:               raw.event_id || raw.requestId || String(Date.now() + Math.random()),
    timestamp:              toInt(raw.timestamp),
    visitor_id:             ident.visitor_id || raw.visitor_id || raw.visitorId || null,
    visitor_found:          ident.visitor_found !== undefined ? (ident.visitor_found ? 1 : 0) : (raw.visitor_found !== undefined ? (raw.visitor_found ? 1 : 0) : 1),
    first_seen_at:          toInt(ident.first_seen_at ?? raw.first_seen_at),
    last_seen_at:           toInt(ident.last_seen_at ?? raw.last_seen_at),
    ip_address:             raw.ip_address || raw.ip || null,
    browser_name:           toStr(bd.browser_name || raw.browser_name || raw.browserName),
    os:                     toStr(bd.os || raw.os),
    device:                 toStr(bd.device || raw.device),
    bot:                    botVal,
    suspect_score:          toFloat(raw.suspect_score) ?? 0,
    tampering:              raw.tampering ? 1 : 0,
    tampering_ml_score:     toFloat(raw.tampering_ml_score ?? td.tampering_ml_score) ?? 0,
    anti_detect_browser:    (raw.anti_detect_browser || td.anti_detect_browser) ? 1 : 0,
    anomaly_score:          toFloat(raw.anomaly_score !== undefined ? raw.anomaly_score : td.anomaly_score) ?? 0,
    vpn:                    raw.vpn ? 1 : 0,
    proxy:                  raw.proxy ? 1 : 0,
    incognito:              raw.incognito ? 1 : 0,
    virtual_machine:        raw.virtual_machine ? 1 : 0,
    virtual_machine_ml_score: toFloat(raw.virtual_machine_ml_score) ?? 0,
    city_name:              geo.city_name || raw.city_name || null,
    country_code:           geo.country_code || raw.country_code || null,
    asn_name:               iiv4.asn_name || raw.asn_name || null,
    velocity_distinct_ip_24h: toInt(velIp['24_hours'] ?? raw.velocity_distinct_ip_24h) ?? 0,
    velocity_events_24h:    toInt(velEv['24_hours'] ?? raw.velocity_events_24h) ?? 0,
    font_hash:              raw.font_hash || ra.font_hash || null,
    webgl_renderer_unmasked: raw.webgl_renderer_unmasked || wb.renderer_unmasked || null,
    hardware_concurrency:   toInt(raw.hardware_concurrency ?? ra.hardware_concurrency),
    device_memory:          toInt(raw.device_memory ?? ra.device_memory),
    platform:               toStr(raw.platform || ra.platform),
    confidence_score:       toFloat(conf.score ?? raw.confidence_score),
  };

  const { score, level } = calculateRiskScore(event);
  event.risk_score = score;
  event.risk_level = level;

  return event;
}

function insertEvents(events) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO events (
      event_id, timestamp, visitor_id, visitor_found, first_seen_at, last_seen_at,
      ip_address, browser_name, os, device, bot, suspect_score, tampering,
      tampering_ml_score, anti_detect_browser, anomaly_score, vpn, proxy, incognito,
      virtual_machine, virtual_machine_ml_score, city_name, country_code, asn_name,
      velocity_distinct_ip_24h, velocity_events_24h, font_hash, webgl_renderer_unmasked,
      hardware_concurrency, device_memory, platform, confidence_score, risk_score, risk_level
    ) VALUES (
      @event_id, @timestamp, @visitor_id, @visitor_found, @first_seen_at, @last_seen_at,
      @ip_address, @browser_name, @os, @device, @bot, @suspect_score, @tampering,
      @tampering_ml_score, @anti_detect_browser, @anomaly_score, @vpn, @proxy, @incognito,
      @virtual_machine, @virtual_machine_ml_score, @city_name, @country_code, @asn_name,
      @velocity_distinct_ip_24h, @velocity_events_24h, @font_hash, @webgl_renderer_unmasked,
      @hardware_concurrency, @device_memory, @platform, @confidence_score, @risk_score, @risk_level
    )
  `);

  database.exec('BEGIN');
  try {
    for (const raw of events) {
      stmt.run(parseEvent(raw));
    }
    database.exec('COMMIT');
  } catch (e) {
    database.exec('ROLLBACK');
    throw e;
  }
}

let lastWebhookReceivedAt = null;

function setLastWebhookTime() {
  lastWebhookReceivedAt = Date.now();
}

function getLastWebhookTime() {
  return lastWebhookReceivedAt;
}

module.exports = { getDb, initDb, insertEvents, setLastWebhookTime, getLastWebhookTime };
