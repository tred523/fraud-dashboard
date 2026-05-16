function detectAnomalies(db) {
  const anomalies = [];

  // a) IP Sharing
  const ipSharing = db.prepare(`
    SELECT ip_address,
           GROUP_CONCAT(DISTINCT visitor_id) as visitor_ids,
           COUNT(DISTINCT visitor_id) as cnt
    FROM events
    WHERE ip_address IS NOT NULL
    GROUP BY ip_address
    HAVING cnt > 1
    ORDER BY cnt DESC
  `).all();

  for (const row of ipSharing) {
    anomalies.push({
      type: 'IP_SHARING',
      severity: row.cnt >= 5 ? 'HIGH' : 'MEDIUM',
      description: `${row.cnt} distinct visitors from IP ${row.ip_address}`,
      detail: 'Multiple unique visitor IDs detected from the same IP address. This may indicate shared infrastructure, proxy usage, or coordinated fraud from a single network origin.',
      shared_value: row.ip_address,
      visitor_ids: row.visitor_ids.split(','),
      count: row.cnt,
    });
  }

  // b) Font Hash Clustering
  const fontClusters = db.prepare(`
    SELECT font_hash,
           GROUP_CONCAT(DISTINCT visitor_id) as visitor_ids,
           COUNT(DISTINCT visitor_id) as cnt
    FROM events
    WHERE font_hash IS NOT NULL AND font_hash != ''
    GROUP BY font_hash
    HAVING cnt > 1
    ORDER BY cnt DESC
  `).all();

  for (const row of fontClusters) {
    anomalies.push({
      type: 'FONT_HASH_CLUSTER',
      severity: row.cnt >= 5 ? 'HIGH' : 'MEDIUM',
      description: `${row.cnt} visitors share font fingerprint ${row.font_hash.substring(0, 8)}…`,
      detail: 'Identical font enumeration hash found across multiple unique visitors. This hash reflects installed system fonts; exact matches at scale strongly suggest shared device config, emulation, or fingerprint spoofing.',
      shared_value: row.font_hash,
      visitor_ids: row.visitor_ids.split(','),
      count: row.cnt,
    });
  }

  // c) WebGL Clustering
  const webglClusters = db.prepare(`
    SELECT webgl_renderer_unmasked,
           GROUP_CONCAT(DISTINCT visitor_id) as visitor_ids,
           COUNT(DISTINCT visitor_id) as cnt
    FROM events
    WHERE webgl_renderer_unmasked IS NOT NULL AND webgl_renderer_unmasked != ''
    GROUP BY webgl_renderer_unmasked
    HAVING cnt > 1
    ORDER BY cnt DESC
  `).all();

  for (const row of webglClusters) {
    const short = row.webgl_renderer_unmasked.length > 60
      ? row.webgl_renderer_unmasked.substring(0, 60) + '…'
      : row.webgl_renderer_unmasked;
    anomalies.push({
      type: 'WEBGL_CLUSTER',
      severity: row.cnt >= 5 ? 'HIGH' : 'MEDIUM',
      description: `${row.cnt} visitors share WebGL renderer: ${short}`,
      detail: 'The same GPU/WebGL renderer string appears across multiple unique visitors. Organic traffic rarely produces identical unmasked renderer strings; this pattern is a strong indicator of shared hardware, VMs, or renderer spoofing.',
      shared_value: row.webgl_renderer_unmasked,
      visitor_ids: row.visitor_ids.split(','),
      count: row.cnt,
    });
  }

  // d) Rapid IP Change
  const visitors = db.prepare('SELECT DISTINCT visitor_id FROM events').all();
  const seenRapid = new Set();

  for (const { visitor_id } of visitors) {
    if (seenRapid.has(visitor_id)) continue;
    const evts = db.prepare(`
      SELECT ip_address, timestamp FROM events
      WHERE visitor_id = ? AND ip_address IS NOT NULL
      ORDER BY timestamp ASC
    `).all(visitor_id);

    const TEN_MIN = 10 * 60 * 1000;
    let found = false;
    let foundIps = [];
    let timeDiff = 0;

    outer:
    for (let i = 0; i < evts.length - 1; i++) {
      for (let j = i + 1; j < evts.length; j++) {
        const diff = evts[j].timestamp - evts[i].timestamp;
        if (diff <= TEN_MIN && evts[i].ip_address !== evts[j].ip_address) {
          found = true;
          foundIps = [evts[i].ip_address, evts[j].ip_address];
          timeDiff = diff;
          break outer;
        }
      }
    }

    if (found) {
      seenRapid.add(visitor_id);
      const mins = Math.round(timeDiff / 60000);
      anomalies.push({
        type: 'RAPID_IP_CHANGE',
        severity: 'HIGH',
        description: `Visitor changed IPs within ${mins < 1 ? '<1' : mins} min (${foundIps[0]} → ${foundIps[1]})`,
        detail: 'The same visitor ID was observed from two different IP addresses within a 10-minute window. This may indicate VPN switching, proxy rotation, or active session hijacking.',
        shared_value: visitor_id,
        visitor_ids: [visitor_id],
        count: 1,
        extra: { ips: foundIps, elapsed_ms: timeDiff },
      });
    }
  }

  // e) VM + MacIntel contradiction
  const vmMac = db.prepare(`
    SELECT DISTINCT visitor_id, webgl_renderer_unmasked, platform
    FROM events
    WHERE virtual_machine = 1 AND platform = 'MacIntel'
      AND webgl_renderer_unmasked LIKE '%Apple M%'
  `).all();

  for (const row of vmMac) {
    anomalies.push({
      type: 'VM_MACINTEL_CONTRADICTION',
      severity: 'HIGH',
      description: `VM flag + MacIntel platform + Apple Silicon GPU — fingerprint contradiction`,
      detail: 'Device reports as MacIntel (Intel-based Mac) but the WebGL renderer exposes an Apple M-series GPU. Combined with a virtual machine detection signal, this is a strong indicator of browser fingerprint spoofing using an anti-detect tool.',
      shared_value: row.webgl_renderer_unmasked,
      visitor_ids: [row.visitor_id],
      count: 1,
    });
  }

  // f) Anti-detect cluster (by font_hash)
  const antiDetectFont = db.prepare(`
    SELECT font_hash,
           GROUP_CONCAT(DISTINCT visitor_id) as visitor_ids,
           COUNT(DISTINCT visitor_id) as cnt
    FROM events
    WHERE anti_detect_browser = 1 AND font_hash IS NOT NULL AND font_hash != ''
    GROUP BY font_hash
    HAVING cnt > 1
    ORDER BY cnt DESC
  `).all();

  for (const row of antiDetectFont) {
    anomalies.push({
      type: 'ANTI_DETECT_CLUSTER',
      severity: 'HIGH',
      description: `${row.cnt} anti-detect browser users share font hash ${row.font_hash.substring(0, 8)}…`,
      detail: 'Multiple visitors using anti-detect browsers (e.g. Multilogin, GoLogin, Linken Sphere) were found with identical font fingerprints. This suggests a coordinated campaign using the same browser profile template.',
      shared_value: row.font_hash,
      visitor_ids: row.visitor_ids.split(','),
      count: row.cnt,
    });
  }

  // Anti-detect cluster by webgl
  const antiDetectWebgl = db.prepare(`
    SELECT webgl_renderer_unmasked,
           GROUP_CONCAT(DISTINCT visitor_id) as visitor_ids,
           COUNT(DISTINCT visitor_id) as cnt
    FROM events
    WHERE anti_detect_browser = 1
      AND webgl_renderer_unmasked IS NOT NULL AND webgl_renderer_unmasked != ''
    GROUP BY webgl_renderer_unmasked
    HAVING cnt > 1
    ORDER BY cnt DESC
  `).all();

  for (const row of antiDetectWebgl) {
    const short = row.webgl_renderer_unmasked.length > 50
      ? row.webgl_renderer_unmasked.substring(0, 50) + '…'
      : row.webgl_renderer_unmasked;
    anomalies.push({
      type: 'ANTI_DETECT_CLUSTER',
      severity: 'HIGH',
      description: `${row.cnt} anti-detect browser users share WebGL renderer: ${short}`,
      detail: 'Multiple anti-detect browser sessions share the same GPU renderer string, indicating coordinated use of the same spoofed hardware profile.',
      shared_value: row.webgl_renderer_unmasked,
      visitor_ids: row.visitor_ids.split(','),
      count: row.cnt,
    });
  }

  // g) Payment Sharing (card)
  const cardSharing = db.prepare(`
    SELECT card_last4, card_bin,
           GROUP_CONCAT(DISTINCT account_id) as account_ids,
           COUNT(DISTINCT account_id) as cnt
    FROM payment_signals
    WHERE card_last4 IS NOT NULL AND card_bin IS NOT NULL
    GROUP BY card_last4, card_bin
    HAVING cnt > 1
    ORDER BY cnt DESC
  `).all();

  for (const row of cardSharing) {
    anomalies.push({
      type: 'PAYMENT_SHARING',
      severity: 'HIGH',
      description: `${row.cnt} accounts share card •••• ${row.card_last4} (BIN ${row.card_bin})`,
      detail: 'Multiple distinct accounts have conducted payments with the same card (matching BIN + last 4 digits). This is a strong signal of synthetic identity fraud, card sharing, or account takeover.',
      shared_value: `${row.card_bin}/${row.card_last4}`,
      visitor_ids: row.account_ids.split(','),
      count: row.cnt,
    });
  }

  // h) Payment Sharing (PayPal)
  const paypalSharing = db.prepare(`
    SELECT paypal_email,
           GROUP_CONCAT(DISTINCT account_id) as account_ids,
           COUNT(DISTINCT account_id) as cnt
    FROM payment_signals
    WHERE paypal_email IS NOT NULL AND paypal_email != ''
    GROUP BY paypal_email
    HAVING cnt > 1
    ORDER BY cnt DESC
  `).all();

  for (const row of paypalSharing) {
    anomalies.push({
      type: 'PAYMENT_SHARING',
      severity: 'HIGH',
      description: `${row.cnt} accounts share PayPal ${row.paypal_email}`,
      detail: 'Multiple accounts have conducted payments using the same PayPal email address. This indicates shared payment credentials, which may signal account linking or coordinated fraud.',
      shared_value: row.paypal_email,
      visitor_ids: row.account_ids.split(','),
      count: row.cnt,
    });
  }

  return anomalies;
}

module.exports = { detectAnomalies };
