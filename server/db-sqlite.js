const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { parseEvent } = require('./parseEvent');
const { SAMPLE_DATA } = require('./sampleData');

const DB_PATH = path.join(__dirname, '..', 'fraud.db');
let _raw;

function getRaw() {
  if (!_raw) _raw = new DatabaseSync(DB_PATH);
  return _raw;
}

function getDb() {
  const raw = getRaw();
  return {
    all(sql, params = []) { return raw.prepare(sql).all(...params); },
    get(sql, params = []) { return raw.prepare(sql).get(...params) ?? null; },
    run(sql, params = []) { raw.prepare(sql).run(...params); },
    exec(sql) { raw.exec(sql); },
    groupConcat(col) { return `GROUP_CONCAT(DISTINCT ${col})`; },
    isPostgres: false,
  };
}

function initDb() {
  const raw = getRaw();

  raw.exec(`
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
      bot_probability REAL DEFAULT NULL,
      tenant_id INTEGER
    )
  `);

  try { raw.exec('ALTER TABLE events ADD COLUMN bot_probability REAL DEFAULT NULL'); } catch (_) {}
  try { raw.exec('ALTER TABLE events ADD COLUMN tenant_id INTEGER'); } catch (_) {}

  raw.exec(`
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

  raw.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT,
      created_at INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1
    )
  `);
  try { raw.exec('ALTER TABLE api_keys ADD COLUMN client_email TEXT'); } catch (_) {}
  try { raw.exec('ALTER TABLE api_keys ADD COLUMN is_active INTEGER DEFAULT 1'); } catch (_) {}
  // Ensure existing rows have is_active = 1
  raw.exec('UPDATE api_keys SET is_active = 1 WHERE is_active IS NULL');

  raw.exec(`
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

  raw.exec(`
    CREATE TABLE IF NOT EXISTS payment_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      card_last4 TEXT,
      card_bin TEXT,
      paypal_email TEXT,
      bank_name TEXT,
      card_type TEXT,
      card_brand TEXT,
      country TEXT,
      is_prepaid INTEGER DEFAULT 0,
      is_virtual INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      api_key_id INTEGER
    )
  `);

  try { raw.exec('ALTER TABLE payment_signals ADD COLUMN bank_name TEXT'); } catch (_) {}
  try { raw.exec('ALTER TABLE payment_signals ADD COLUMN card_type TEXT'); } catch (_) {}
  try { raw.exec('ALTER TABLE payment_signals ADD COLUMN card_brand TEXT'); } catch (_) {}
  try { raw.exec('ALTER TABLE payment_signals ADD COLUMN country TEXT'); } catch (_) {}
  try { raw.exec('ALTER TABLE payment_signals ADD COLUMN is_prepaid INTEGER DEFAULT 0'); } catch (_) {}
  try { raw.exec('ALTER TABLE payment_signals ADD COLUMN is_virtual INTEGER DEFAULT 0'); } catch (_) {}
  try { raw.exec('ALTER TABLE payment_signals ADD COLUMN api_key_id INTEGER'); } catch (_) {}

  raw.exec(`
    CREATE TABLE IF NOT EXISTS bin_cache (
      bin TEXT PRIMARY KEY,
      bank_name TEXT,
      card_type TEXT,
      card_brand TEXT,
      country TEXT,
      is_prepaid INTEGER DEFAULT 0,
      is_virtual INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  let demoKeyRow = raw.prepare("SELECT id FROM api_keys WHERE key = 'demo_key_12345'").get();
  if (!demoKeyRow) {
    raw.prepare("INSERT INTO api_keys (key, client_name, client_email, created_at, is_active) VALUES ('demo_key_12345', 'Demo Client', null, ?, 1)").run(Date.now());
    demoKeyRow = raw.prepare("SELECT id FROM api_keys WHERE key = 'demo_key_12345'").get();
  }

  const count = raw.prepare('SELECT COUNT(*) as c FROM events').get().c;
  if (count === 0) insertEvents(SAMPLE_DATA, demoKeyRow.id);
}

function insertEvents(events, tenantId = null) {
  const raw = getRaw();
  const stmt = raw.prepare(`
    INSERT OR IGNORE INTO events (
      event_id, timestamp, visitor_id, visitor_found, first_seen_at, last_seen_at,
      ip_address, browser_name, os, device, bot, suspect_score, tampering,
      tampering_ml_score, anti_detect_browser, anomaly_score, vpn, proxy, incognito,
      virtual_machine, virtual_machine_ml_score, city_name, country_code, asn_name,
      velocity_distinct_ip_24h, velocity_events_24h, font_hash, webgl_renderer_unmasked,
      hardware_concurrency, device_memory, platform, confidence_score, risk_score, risk_level,
      tenant_id
    ) VALUES (
      @event_id, @timestamp, @visitor_id, @visitor_found, @first_seen_at, @last_seen_at,
      @ip_address, @browser_name, @os, @device, @bot, @suspect_score, @tampering,
      @tampering_ml_score, @anti_detect_browser, @anomaly_score, @vpn, @proxy, @incognito,
      @virtual_machine, @virtual_machine_ml_score, @city_name, @country_code, @asn_name,
      @velocity_distinct_ip_24h, @velocity_events_24h, @font_hash, @webgl_renderer_unmasked,
      @hardware_concurrency, @device_memory, @platform, @confidence_score, @risk_score, @risk_level,
      @tenant_id
    )
  `);

  raw.exec('BEGIN');
  try {
    for (const ev of events) {
      stmt.run({ ...parseEvent(ev), tenant_id: tenantId });
    }
    raw.exec('COMMIT');
  } catch (e) {
    raw.exec('ROLLBACK');
    throw e;
  }
}

let lastWebhookReceivedAt = null;
function setLastWebhookTime() { lastWebhookReceivedAt = Date.now(); }
function getLastWebhookTime() { return lastWebhookReceivedAt; }

module.exports = { getDb, initDb, insertEvents, setLastWebhookTime, getLastWebhookTime };
