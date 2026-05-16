const axios = require('axios');
const { getDb } = require('./db');

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function lookupBin(bin) {
  if (!bin || String(bin).length < 6) return null;
  const b = String(bin).substring(0, 6).replace(/\D/g, '');
  if (b.length < 6) return null;

  const db = getDb();

  const cached = await db.get('SELECT * FROM bin_cache WHERE bin = ?', [b]);
  if (cached && Date.now() - Number(cached.created_at) < CACHE_TTL_MS) {
    return {
      bank_name: cached.bank_name,
      card_type: cached.card_type,
      card_brand: cached.card_brand,
      country: cached.country,
      is_prepaid: !!cached.is_prepaid,
      is_virtual: !!cached.is_virtual,
    };
  }

  try {
    let data;
    try {
      const res = await axios.get(`https://lookup.binlist.net/${b}`, {
        headers: { 'Accept-Version': '3' },
        timeout: 4000,
      });
      console.log(`[BIN] binlist.net response for ${b}:`, JSON.stringify(res.data));
      data = res.data;
    } catch (primaryErr) {
      console.warn(`[BIN] binlist.net failed for ${b}: ${primaryErr.message} — trying fallback`);
      const res = await axios.get(`https://api.bincodes.com/bin/?format=json&api_key=free&bin=${b}`, {
        timeout: 4000,
      });
      console.log(`[BIN] bincodes fallback response for ${b}:`, JSON.stringify(res.data));
      const d = res.data;
      data = {
        bank: { name: d.bank || null },
        type: d.type || null,
        scheme: d.brand ? d.brand.toLowerCase() : null,
        country: { alpha2: d.country_code || null },
        prepaid: d.prepaid === 'true' || d.prepaid === true,
      };
    }

    const result = {
      bank_name: data.bank?.name || null,
      card_type: data.type || null,
      card_brand: data.scheme || null,
      country: data.country?.alpha2 || null,
      is_prepaid: data.prepaid === true,
      is_virtual: data.type === 'virtual',
    };

    const params = [
      b, result.bank_name, result.card_type, result.card_brand, result.country,
      result.is_prepaid ? 1 : 0, result.is_virtual ? 1 : 0, Date.now(),
    ];

    if (db.isPostgres) {
      await db.run(
        `INSERT INTO bin_cache (bin, bank_name, card_type, card_brand, country, is_prepaid, is_virtual, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (bin) DO UPDATE SET
           bank_name=EXCLUDED.bank_name, card_type=EXCLUDED.card_type,
           card_brand=EXCLUDED.card_brand, country=EXCLUDED.country,
           is_prepaid=EXCLUDED.is_prepaid, is_virtual=EXCLUDED.is_virtual,
           created_at=EXCLUDED.created_at`,
        params
      );
    } else {
      await db.run(
        `INSERT OR REPLACE INTO bin_cache (bin, bank_name, card_type, card_brand, country, is_prepaid, is_virtual, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params
      );
    }

    return result;
  } catch (err) {
    console.error(`[BIN] lookup failed for ${b}:`, err.message);
    return null;
  }
}

module.exports = { lookupBin };
