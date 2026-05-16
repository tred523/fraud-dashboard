const HARDCODED_BINS = {
  '424242': { card_brand: 'Visa',       card_type: 'Credit',  bank_name: 'Test Bank',              country: 'US', is_prepaid: false, is_virtual: false },
  '411111': { card_brand: 'Visa',       card_type: 'Credit',  bank_name: 'JPMorgan Chase',          country: 'US', is_prepaid: false, is_virtual: false },
  '510510': { card_brand: 'Mastercard', card_type: 'Credit',  bank_name: 'Citibank',                country: 'US', is_prepaid: false, is_virtual: false },
  '400000': { card_brand: 'Visa',       card_type: 'Prepaid', bank_name: 'Prepaid Services',        country: 'US', is_prepaid: true,  is_virtual: false },
  '520000': { card_brand: 'Mastercard', card_type: 'Virtual', bank_name: 'Virtual Card Services',   country: 'US', is_prepaid: false, is_virtual: true  },
};

const UNKNOWN_BIN = { card_brand: 'Unknown', card_type: 'Unknown', bank_name: 'Unknown Bank', country: 'Unknown', is_prepaid: false, is_virtual: false };

async function lookupBin(bin) {
  if (!bin || String(bin).length < 6) return null;
  const b = String(bin).substring(0, 6).replace(/\D/g, '');
  if (b.length < 6) return null;

  return HARDCODED_BINS[b] || UNKNOWN_BIN;
}

module.exports = { lookupBin };
