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

  // No mouse movement when clicks happened
  if (moves === 0 && clicks > 0) score += 25;
  else if (moves === 0) score += 15;

  // Robotic mouse path (smoothness 0-100, higher = more robotic)
  if (smoothness > 85) score += 30;
  else if (smoothness > 70) score += 15;

  // Robotic typing rhythm (higher = more uniform = more bot-like)
  if (rhythm > 85) score += 25;
  else if (rhythm > 70) score += 12;

  // No backspaces during significant typing
  if (keyEvents > 20 && backspaces === 0) score += 10;

  return Math.min(100, score);
}

router.post('/', (req, res) => {
  const db = getDb();
  const { visitor_id, account_id, api_key, ...signals } = req.body;

  if (!api_key) return res.status(400).json({ error: 'api_key required' });

  const keyRow = db.prepare('SELECT id FROM api_keys WHERE key = ?').get(api_key);
  if (!keyRow) return res.status(401).json({ error: 'Invalid API key' });

  const mouse_smoothness_score = signals.mouse_smoothness_score ?? 50;
  const typing_rhythm_score    = signals.typing_rhythm_score    ?? 50;
  const bot_probability        = calcBotProbability({ ...signals, mouse_smoothness_score, typing_rhythm_score });

  db.prepare(`
    INSERT INTO behavior_events (
      visitor_id, account_id, api_key_id,
      session_duration, mouse_move_count, click_count,
      keyboard_event_count, scroll_direction_changes, backspace_count,
      mouse_smoothness_score, typing_rhythm_score, bot_probability,
      page_timeline, form_interactions, collected_at
    ) VALUES (
      @visitor_id, @account_id, @api_key_id,
      @session_duration, @mouse_move_count, @click_count,
      @keyboard_event_count, @scroll_direction_changes, @backspace_count,
      @mouse_smoothness_score, @typing_rhythm_score, @bot_probability,
      @page_timeline, @form_interactions, @collected_at
    )
  `).run({
    visitor_id:              visitor_id || null,
    account_id:              account_id || null,
    api_key_id:              keyRow.id,
    session_duration:        signals.session_duration || 0,
    mouse_move_count:        signals.mouse_move_count || 0,
    click_count:             signals.click_count || 0,
    keyboard_event_count:    signals.keyboard_event_count || 0,
    scroll_direction_changes: signals.scroll_direction_changes || 0,
    backspace_count:         signals.backspace_count || 0,
    mouse_smoothness_score,
    typing_rhythm_score,
    bot_probability,
    page_timeline:           signals.page_timeline ? JSON.stringify(signals.page_timeline) : null,
    form_interactions:       signals.form_interactions ? JSON.stringify(signals.form_interactions) : null,
    collected_at:            signals.collected_at || Date.now(),
  });

  // Propagate bot_probability to matching events and recalculate risk scores
  if (visitor_id) {
    const events = db.prepare('SELECT * FROM events WHERE visitor_id = ?').all(visitor_id);
    const update = db.prepare('UPDATE events SET bot_probability = ?, risk_score = ?, risk_level = ? WHERE id = ?');
    for (const ev of events) {
      const { score, level } = calculateRiskScore({ ...ev, bot_probability });
      update.run(bot_probability, score, level, ev.id);
    }
  }

  res.json({ success: true, bot_probability });
});

module.exports = router;
