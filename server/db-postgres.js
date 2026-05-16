const { Pool } = require('pg');
const { parseEvent } = require('./parseEvent');
const { SAMPLE_DATA } = require('./sampleData');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function getDb() {
  return {
    async all(sql, params = []) {
      const { rows } = await pool.query(toPositional(sql), params);
      return rows;
    },
    async get(sql, params = []) {
      const { rows } = await pool.query(toPositional(sql), params);
      return rows[0] || null;
    },
    async run(sql, params = []) {
      await pool.query(toPositional(sql), params);
    },
    async exec(sql) {
      await pool.query(sql);
    },
    groupConcat(col) {
      return `STRING_AGG(DISTINCT ${col}, ',')`;
    },
    isPostgres: true,
  };
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      event_id TEXT UNIQUE,
      timestamp BIGINT,
      visitor_id TEXT,
      visitor_found INTEGER DEFAULT 1,
      first_seen_at BIGINT,
      last_seen_at BIGINT,
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

  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS bot_probability REAL DEFAULT NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS behavior_events (
      id SERIAL PRIMARY KEY,
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
      collected_at BIGINT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      client_name TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_events (
      id SERIAL PRIMARY KEY,
      account_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      timestamp BIGINT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT,
      api_key_id INTEGER NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_signals (
      id SERIAL PRIMARY KEY,
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
      created_at BIGINT NOT NULL
    )
  `);

  await pool.query(`ALTER TABLE payment_signals ADD COLUMN IF NOT EXISTS bank_name TEXT`);
  await pool.query(`ALTER TABLE payment_signals ADD COLUMN IF NOT EXISTS card_type TEXT`);
  await pool.query(`ALTER TABLE payment_signals ADD COLUMN IF NOT EXISTS card_brand TEXT`);
  await pool.query(`ALTER TABLE payment_signals ADD COLUMN IF NOT EXISTS country TEXT`);
  await pool.query(`ALTER TABLE payment_signals ADD COLUMN IF NOT EXISTS is_prepaid INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE payment_signals ADD COLUMN IF NOT EXISTS is_virtual INTEGER DEFAULT 0`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bin_cache (
      bin TEXT PRIMARY KEY,
      bank_name TEXT,
      card_type TEXT,
      card_brand TEXT,
      country TEXT,
      is_prepaid INTEGER DEFAULT 0,
      is_virtual INTEGER DEFAULT 0,
      created_at BIGINT NOT NULL
    )
  `);

  await pool.query(
    `INSERT INTO api_keys (key, client_name, created_at) VALUES ('demo_key_12345', 'Demo Client', $1) ON CONFLICT (key) DO NOTHING`,
    [Date.now()]
  );

  const { rows: keyRows } = await pool.query(`SELECT id FROM api_keys WHERE key = 'demo_key_12345'`);
  const demoKeyId = keyRows[0].id;

  const { rows } = await pool.query('SELECT COUNT(*) as c FROM events');
  if (parseInt(rows[0].c, 10) === 0) await insertEvents(SAMPLE_DATA);

  const { rows: aeRows } = await pool.query('SELECT COUNT(*) as c FROM account_events');
  if (parseInt(aeRows[0].c, 10) === 0) await seedAccountEvents(demoKeyId);

  const { rows: beRows } = await pool.query('SELECT COUNT(*) as c FROM behavior_events');
  if (parseInt(beRows[0].c, 10) === 0) await seedBehaviorEvents();

  await pool.query(`UPDATE events SET bot_probability = 90 WHERE visitor_id = '3NcqkuFKy9k7spPP0EW9'`);
  await pool.query(`UPDATE events SET bot_probability = 75 WHERE visitor_id = 'LWrtj8049U0NHAfoVnuv'`);

  await pool.query(`
    UPDATE events SET risk_score = LEAST(100, (
      CASE WHEN anti_detect_browser = 1 THEN 40 ELSE 0 END +
      CASE WHEN tampering_ml_score > 0.5 THEN 25 WHEN tampering_ml_score >= 0.2 THEN 15 ELSE 0 END +
      CASE WHEN virtual_machine = 1 THEN 20 ELSE 0 END +
      CASE WHEN anomaly_score > 0 THEN 15 ELSE 0 END +
      CASE WHEN bot_probability > 80 THEN 35 WHEN bot_probability >= 50 THEN 20 ELSE 0 END +
      CASE WHEN suspect_score > 10 THEN 10 ELSE 0 END +
      CASE WHEN visitor_found = 0 THEN 5 ELSE 0 END
    ))
  `);

  await pool.query(`
    UPDATE events SET risk_level = CASE
      WHEN risk_score >= 66 THEN 'HIGH RISK'
      WHEN risk_score >= 41 THEN 'SUSPICIOUS'
      WHEN risk_score >= 21 THEN 'LOW'
      ELSE 'CLEAN'
    END
  `);
}

const EVENT_COLS = [
  'event_id', 'timestamp', 'visitor_id', 'visitor_found', 'first_seen_at', 'last_seen_at',
  'ip_address', 'browser_name', 'os', 'device', 'bot', 'suspect_score', 'tampering',
  'tampering_ml_score', 'anti_detect_browser', 'anomaly_score', 'vpn', 'proxy', 'incognito',
  'virtual_machine', 'virtual_machine_ml_score', 'city_name', 'country_code', 'asn_name',
  'velocity_distinct_ip_24h', 'velocity_events_24h', 'font_hash', 'webgl_renderer_unmasked',
  'hardware_concurrency', 'device_memory', 'platform', 'confidence_score', 'risk_score', 'risk_level',
];

async function insertEvents(events) {
  const client = await pool.connect();
  const placeholders = EVENT_COLS.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `
    INSERT INTO events (${EVENT_COLS.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (event_id) DO NOTHING
  `;
  try {
    await client.query('BEGIN');
    for (const ev of events) {
      const parsed = parseEvent(ev);
      await client.query(sql, EVENT_COLS.map(c => parsed[c] ?? null));
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function seedAccountEvents(apiKeyId) {
  const now = Date.now();
  const rows = [
    { account_id: 'hC3zBmBTw08JSdez0Xto', event_type: 'login',           timestamp: now - 3600000 * 5, ip_address: '176.0.82.172' },
    { account_id: 'P0olT9ooM2qltqlotSEV', event_type: 'login',           timestamp: now - 3600000 * 4, ip_address: null },
    { account_id: 'P0olT9ooM2qltqlotSEV', event_type: 'settings_change', timestamp: now - 3600000 * 3, ip_address: null },
    { account_id: '3NcqkuFKy9k7spPP0EW9', event_type: 'login',           timestamp: now - 3600000 * 6, ip_address: null },
    { account_id: '3NcqkuFKy9k7spPP0EW9', event_type: 'payment',         timestamp: now - 3600000 * 2, ip_address: null },
    { account_id: '3NcqkuFKy9k7spPP0EW9', event_type: 'export',          timestamp: now - 3600000 * 1, ip_address: null },
  ];
  for (const r of rows) {
    await pool.query(
      `INSERT INTO account_events (account_id, event_type, timestamp, ip_address, api_key_id) VALUES ($1, $2, $3, $4, $5)`,
      [r.account_id, r.event_type, r.timestamp, r.ip_address, apiKeyId]
    );
  }
}

async function seedBehaviorEvents() {
  const now = Date.now();
  const rows = [
    { visitor_id: '3NcqkuFKy9k7spPP0EW9', bot_probability: 90, mouse_smoothness_score: 92, typing_rhythm_score: 95 },
    { visitor_id: 'LWrtj8049U0NHAfoVnuv', bot_probability: 75, mouse_smoothness_score: 80, typing_rhythm_score: 70 },
  ];
  for (const r of rows) {
    await pool.query(
      `INSERT INTO behavior_events (visitor_id, bot_probability, mouse_smoothness_score, typing_rhythm_score, collected_at) VALUES ($1, $2, $3, $4, $5)`,
      [r.visitor_id, r.bot_probability, r.mouse_smoothness_score, r.typing_rhythm_score, now]
    );
  }
}

let lastWebhookReceivedAt = null;
function setLastWebhookTime() { lastWebhookReceivedAt = Date.now(); }
function getLastWebhookTime() { return lastWebhookReceivedAt; }

module.exports = { getDb, initDb, insertEvents, setLastWebhookTime, getLastWebhookTime };
