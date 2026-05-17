const { getDb } = require('./db');

async function resolveTenant(req) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey) return null;

  const db = getDb();
  const keyRow = db.get('SELECT id, key, is_active FROM api_keys WHERE key = ?', [apiKey]);
  if (!keyRow || keyRow.is_active === 0) return null;

  const isDemo = keyRow.key === 'demo_key_12345';
  const id = keyRow.id;

  return {
    tenantId: id,
    isDemo,
    eventsWhere: isDemo ? '(tenant_id IS NULL OR tenant_id = ?)' : 'tenant_id = ?',
    eventsParams: [id],
    eventsCondA: isDemo ? '(a.tenant_id IS NULL OR a.tenant_id = ?)' : 'a.tenant_id = ?',
    eventsCondB: isDemo ? '(b.tenant_id IS NULL OR b.tenant_id = ?)' : 'b.tenant_id = ?',
    acctWhere: 'api_key_id = ?',
    acctParams: [id],
    pmtWhere: isDemo ? '(api_key_id IS NULL OR api_key_id = ?)' : 'api_key_id = ?',
    pmtParams: [id],
  };
}

module.exports = { resolveTenant };
