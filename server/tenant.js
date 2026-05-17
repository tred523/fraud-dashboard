const { getDb } = require('./db');

async function resolveTenant(req) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey) return null;

  const db = getDb();
  const keyResult = await db.get('SELECT id, key, is_active FROM api_keys WHERE key = ?', [apiKey]);
  const keyRow = keyResult && keyResult.rows ? keyResult.rows[0] : keyResult;
  if (!keyRow || keyRow.is_active === 0) return null;

  const isDemo = keyRow.key === 'demo_key_12345';
  const id = keyRow.id;

  return {
    tenantId: id,
    isDemo,
    eventsWhere: '1=1',
    eventsParams: [],
    eventsCondA: '1=1',
    eventsCondB: '1=1',
    acctWhere: 'api_key_id = ?',
    acctParams: [id],
    pmtWhere: isDemo ? '(api_key_id IS NULL OR api_key_id = ?)' : 'api_key_id = ?',
    pmtParams: [id],
  };
}

module.exports = { resolveTenant };
