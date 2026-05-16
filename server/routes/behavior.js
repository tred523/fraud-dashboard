const express = require('express');
const { getDb } = require('../db');
const { calculateRiskScore } = require('../scoring');

const router = express.Router();

function calcBotProbability(body) {
  let score = 0;
  const moves = body.mouse_move_count || 0;
  const smoothness = body.mouse_smoothness_score ?? 50;
  const rhythm = body.typing_rhythm_score ?? 50;
  const keyEvents = body.keyboard_event_count || 0;
  const backspaces = body.backspace_count || 0;
  const clicks = body.click_count || 0;

  if (moves === 0 && clicks > 0) score += 25;
  else if (moves === 0) score += 15;

  if (smoothness > 85) score += 30;
  else if (smoothness > 70) score += 15;

  if (rhythm > 85) score += 25;
  else if (rhythm > 70) score += 12;

  if (keyEvents > 20 && backspaces === 0) score += 10;

  return Math.min(100, score);
}

router.post('/', async (req, res) => {
  const db = getDb();
  const { visitor_id, account_id, api_key, ...signals } = req.body;

  if (!api_key) return res.status(400).json({ error: 'api_key required' });

  const keyRow = await db.get('SELECT id FROM api_keys WHERE key = ?', [api_key]);
  if (!keyRow) return res.status(401).json({ error: 'Invalid API key' });

  const mouse_smoothness_score = signals.mouse_smoothness_score ?? 50;
  const typing_rhythm_score    = signals.typing_rhythm_score    ?? 50;
  const bot_probability        = calcBotProbability({ ...signals, mouse_smoothness_score, typing_rhythm_score });

  await db.run(
    `INSERT INTO behavior_events (
      visitor_id, account_id, api_key_id,
      session_duration, mouse_move_count, click_count,
      keyboard_event_count, scroll_direction_changes, backspace_count,
      mouse_smoothness_score, typing_rhythm_score, bot_probability,
      page_timeline, form_interactions, collected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      visitor_id || null,
      account_id || null,
      keyRow.id,
      signals.session_duration || 0,
      signals.mouse_move_count || 0,
      signals.click_count || 0,
      signals.keyboard_event_count || 0,
      signals.scroll_direction_changes || 0,
      signals.backspace_count || 0,
      mouse_smoothness_score,
      typing_rhythm_score,
      bot_probability,
      signals.page_timeline ? JSON.stringify(signals.page_timeline) : null,
      signals.form_interactions ? JSON.stringify(signals.form_interactions) : null,
      signals.collected_at || Date.now(),
    ]
  );

  if (visitor_id) {
    const events = await db.all('SELECT * FROM events WHERE visitor_id = ?', [visitor_id]);
    for (const ev of events) {
      const { score, level } = calculateRiskScore({ ...ev, bot_probability });
      await db.run(
        'UPDATE events SET bot_probability = ?, risk_score = ?, risk_level = ? WHERE id = ?',
        [bot_probability, score, level, ev.id]
      );
    }
  }

  res.json({ success: true, bot_probability });
});

module.exports = router;
