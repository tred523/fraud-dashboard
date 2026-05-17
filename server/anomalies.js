async function detectAnomalies(db, tenant) {
  const evW = tenant ? tenant.eventsWhere : '1=1';
  const evP = tenant ? tenant.eventsParams : [];
  // Skip tenant filter for payment_signals — api_key_id may not exist on older schemas
  const pmW = '1=1';
  const pmP = [];

  const anomalies = [];

  // a) IP Sharing
  try {
    const ipSharingResult = await db.all(`
      SELECT ip_address,
             ${db.groupConcat('visitor_id')} as visitor_ids,
             COUNT(DISTINCT visitor_id) as cnt
      FROM events
      WHERE ip_address IS NOT NULL AND ${evW}
      GROUP BY ip_address
      HAVING COUNT(DISTINCT visitor_id) > 1
      ORDER BY cnt DESC
    `, evP);
    const ipSharing = ipSharingResult.rows || ipSharingResult;

    for (const row of ipSharing) {
      const cnt = parseInt(row.cnt, 10);
      anomalies.push({
        type: 'IP_SHARING',
        severity: cnt >= 5 ? 'HIGH' : 'MEDIUM',
        description: `${cnt} distinct visitors from IP ${row.ip_address}`,
        detail: 'Multiple unique visitor IDs detected from the same IP address. This may indicate shared infrastructure, proxy usage, or coordinated fraud from a single network origin.',
        shared_value: row.ip_address,
        visitor_ids: row.visitor_ids.split(','),
        count: cnt,
      });
    }
  } catch (err) {
    console.error('Anomaly detection error (IP_SHARING):', err.message);
  }

  // b) Font Hash Clustering
  try {
    const fontClustersResult = await db.all(`
      SELECT font_hash,
             ${db.groupConcat('visitor_id')} as visitor_ids,
             COUNT(DISTINCT visitor_id) as cnt
      FROM events
      WHERE font_hash IS NOT NULL AND font_hash != '' AND ${evW}
      GROUP BY font_hash
      HAVING COUNT(DISTINCT visitor_id) > 1
      ORDER BY cnt DESC
    `, evP);
    const fontClusters = fontClustersResult.rows || fontClustersResult;

    for (const row of fontClusters) {
      const cnt = parseInt(row.cnt, 10);
      anomalies.push({
        type: 'FONT_HASH_CLUSTER',
        severity: cnt >= 5 ? 'HIGH' : 'MEDIUM',
        description: `${cnt} visitors share font fingerprint ${row.font_hash.substring(0, 8)}…`,
        detail: 'Identical font enumeration hash found across multiple unique visitors. This hash reflects installed system fonts; exact matches at scale strongly suggest shared device config, emulation, or fingerprint spoofing.',
        shared_value: row.font_hash,
        visitor_ids: row.visitor_ids.split(','),
        count: cnt,
      });
    }
  } catch (err) {
    console.error('Anomaly detection error (FONT_HASH_CLUSTER):', err.message);
  }

  // c) WebGL Clustering
  try {
    const webglClustersResult = await db.all(`
      SELECT webgl_renderer_unmasked,
             ${db.groupConcat('visitor_id')} as visitor_ids,
             COUNT(DISTINCT visitor_id) as cnt
      FROM events
      WHERE webgl_renderer_unmasked IS NOT NULL AND webgl_renderer_unmasked != '' AND ${evW}
      GROUP BY webgl_renderer_unmasked
      HAVING COUNT(DISTINCT visitor_id) > 1
      ORDER BY cnt DESC
    `, evP);
    const webglClusters = webglClustersResult.rows || webglClustersResult;

    for (const row of webglClusters) {
      const cnt = parseInt(row.cnt, 10);
      const short = row.webgl_renderer_unmasked.length > 60
        ? row.webgl_renderer_unmasked.substring(0, 60) + '…'
        : row.webgl_renderer_unmasked;
      anomalies.push({
        type: 'WEBGL_CLUSTER',
        severity: cnt >= 5 ? 'HIGH' : 'MEDIUM',
        description: `${cnt} visitors share WebGL renderer: ${short}`,
        detail: 'The same GPU/WebGL renderer string appears across multiple unique visitors. Organic traffic rarely produces identical unmasked renderer strings; this pattern is a strong indicator of shared hardware, VMs, or renderer spoofing.',
        shared_value: row.webgl_renderer_unmasked,
        visitor_ids: row.visitor_ids.split(','),
        count: cnt,
      });
    }
  } catch (err) {
    console.error('Anomaly detection error (WEBGL_CLUSTER):', err.message);
  }

  // d) Rapid IP Change
  try {
    const visitorsResult = await db.all(`SELECT DISTINCT visitor_id FROM events WHERE ${evW}`, evP);
    const visitors = visitorsResult.rows || visitorsResult;
    const seenRapid = new Set();

    for (const { visitor_id } of visitors) {
      if (seenRapid.has(visitor_id)) continue;
      const evtsResult = await db.all(`
        SELECT ip_address, timestamp FROM events
        WHERE visitor_id = ? AND ip_address IS NOT NULL AND ${evW}
        ORDER BY timestamp ASC
      `, [visitor_id, ...evP]);
      const evts = evtsResult.rows || evtsResult;

      const TEN_MIN = 10 * 60 * 1000;
      let found = false;
      let foundIps = [];
      let timeDiff = 0;

      outer:
      for (let i = 0; i < evts.length - 1; i++) {
        for (let j = i + 1; j < evts.length; j++) {
          const diff = parseInt(evts[j].timestamp, 10) - parseInt(evts[i].timestamp, 10);
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
  } catch (err) {
    console.error('Anomaly detection error (RAPID_IP_CHANGE):', err.message);
  }

  // e) VM + MacIntel contradiction
  try {
    const vmMacResult = await db.all(`
      SELECT DISTINCT visitor_id, webgl_renderer_unmasked, platform
      FROM events
      WHERE virtual_machine = 1 AND platform = 'MacIntel'
        AND webgl_renderer_unmasked LIKE '%Apple M%'
        AND ${evW}
    `, evP);
    const vmMac = vmMacResult.rows || vmMacResult;

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
  } catch (err) {
    console.error('Anomaly detection error (VM_MACINTEL_CONTRADICTION):', err.message);
  }

  // f) Anti-detect cluster (by font_hash)
  try {
    const antiDetectFontResult = await db.all(`
      SELECT font_hash,
             ${db.groupConcat('visitor_id')} as visitor_ids,
             COUNT(DISTINCT visitor_id) as cnt
      FROM events
      WHERE anti_detect_browser = 1 AND font_hash IS NOT NULL AND font_hash != '' AND ${evW}
      GROUP BY font_hash
      HAVING COUNT(DISTINCT visitor_id) > 1
      ORDER BY cnt DESC
    `, evP);
    const antiDetectFont = antiDetectFontResult.rows || antiDetectFontResult;

    for (const row of antiDetectFont) {
      const cnt = parseInt(row.cnt, 10);
      anomalies.push({
        type: 'ANTI_DETECT_CLUSTER',
        severity: 'HIGH',
        description: `${cnt} anti-detect browser users share font hash ${row.font_hash.substring(0, 8)}…`,
        detail: 'Multiple visitors using anti-detect browsers (e.g. Multilogin, GoLogin, Linken Sphere) were found with identical font fingerprints. This suggests a coordinated campaign using the same browser profile template.',
        shared_value: row.font_hash,
        visitor_ids: row.visitor_ids.split(','),
        count: cnt,
      });
    }
  } catch (err) {
    console.error('Anomaly detection error (ANTI_DETECT_CLUSTER font):', err.message);
  }

  // Anti-detect cluster by webgl
  try {
    const antiDetectWebglResult = await db.all(`
      SELECT webgl_renderer_unmasked,
             ${db.groupConcat('visitor_id')} as visitor_ids,
             COUNT(DISTINCT visitor_id) as cnt
      FROM events
      WHERE anti_detect_browser = 1
        AND webgl_renderer_unmasked IS NOT NULL AND webgl_renderer_unmasked != ''
        AND ${evW}
      GROUP BY webgl_renderer_unmasked
      HAVING COUNT(DISTINCT visitor_id) > 1
      ORDER BY cnt DESC
    `, evP);
    const antiDetectWebgl = antiDetectWebglResult.rows || antiDetectWebglResult;

    for (const row of antiDetectWebgl) {
      const cnt = parseInt(row.cnt, 10);
      const short = row.webgl_renderer_unmasked.length > 50
        ? row.webgl_renderer_unmasked.substring(0, 50) + '…'
        : row.webgl_renderer_unmasked;
      anomalies.push({
        type: 'ANTI_DETECT_CLUSTER',
        severity: 'HIGH',
        description: `${cnt} anti-detect browser users share WebGL renderer: ${short}`,
        detail: 'Multiple anti-detect browser sessions share the same GPU renderer string, indicating coordinated use of the same spoofed hardware profile.',
        shared_value: row.webgl_renderer_unmasked,
        visitor_ids: row.visitor_ids.split(','),
        count: cnt,
      });
    }
  } catch (err) {
    console.error('Anomaly detection error (ANTI_DETECT_CLUSTER webgl):', err.message);
  }

  // g) Payment Sharing (card)
  try {
    const cardSharingResult = await db.all(`
      SELECT card_last4, card_bin,
             ${db.groupConcat('account_id')} as account_ids,
             COUNT(DISTINCT account_id) as cnt
      FROM payment_signals
      WHERE card_last4 IS NOT NULL AND card_bin IS NOT NULL AND ${pmW}
      GROUP BY card_last4, card_bin
      HAVING COUNT(DISTINCT account_id) > 1
      ORDER BY cnt DESC
    `, pmP);
    const cardSharing = cardSharingResult.rows || cardSharingResult;

    for (const row of cardSharing) {
      const cnt = parseInt(row.cnt, 10);
      anomalies.push({
        type: 'PAYMENT_SHARING',
        severity: 'HIGH',
        description: `${cnt} accounts share card •••• ${row.card_last4} (BIN ${row.card_bin})`,
        detail: 'Multiple distinct accounts have conducted payments with the same card (matching BIN + last 4 digits). This is a strong signal of synthetic identity fraud, card sharing, or account takeover.',
        shared_value: `${row.card_bin}/${row.card_last4}`,
        visitor_ids: row.account_ids.split(','),
        count: cnt,
      });
    }
  } catch (err) {
    console.error('Anomaly detection error (PAYMENT_SHARING card):', err.message);
  }

  // h) Payment Sharing (PayPal)
  try {
    const paypalSharingResult = await db.all(`
      SELECT paypal_email,
             ${db.groupConcat('account_id')} as account_ids,
             COUNT(DISTINCT account_id) as cnt
      FROM payment_signals
      WHERE paypal_email IS NOT NULL AND paypal_email != '' AND ${pmW}
      GROUP BY paypal_email
      HAVING COUNT(DISTINCT account_id) > 1
      ORDER BY cnt DESC
    `, pmP);
    const paypalSharing = paypalSharingResult.rows || paypalSharingResult;

    for (const row of paypalSharing) {
      const cnt = parseInt(row.cnt, 10);
      anomalies.push({
        type: 'PAYMENT_SHARING',
        severity: 'HIGH',
        description: `${cnt} accounts share PayPal ${row.paypal_email}`,
        detail: 'Multiple accounts have conducted payments using the same PayPal email address. This indicates shared payment credentials, which may signal account linking or coordinated fraud.',
        shared_value: row.paypal_email,
        visitor_ids: row.account_ids.split(','),
        count: cnt,
      });
    }
  } catch (err) {
    console.error('Anomaly detection error (PAYMENT_SHARING paypal):', err.message);
  }

  return anomalies;
}

module.exports = { detectAnomalies };
