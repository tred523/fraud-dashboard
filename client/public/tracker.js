(function () {
  var cfg = Object.assign({
    endpoint: '/api/behavior',
    sendInterval: 30000,
    visitor_id: null,
    account_id: null,
    api_key: null,
  }, window.FraudTrackerConfig || {});

  if (!cfg.api_key) return;

  var sessionStart = Date.now();
  var mouseMoves = [];
  var clicks = [];
  var keyEvents = [];
  var scrollEvents = [];
  var pages = [];
  var forms = {};

  var lastMouseX = 0, lastMouseY = 0, lastMouseT = 0;
  var lastScrollY = window.scrollY, lastScrollT = 0, lastScrollDir = null;
  var lastKeyT = 0;
  var currentPagePath = location.pathname;
  var currentPageStart = Date.now();

  document.addEventListener('mousemove', function (e) {
    var now = Date.now();
    var dx = e.clientX - lastMouseX;
    var dy = e.clientY - lastMouseY;
    var dt = now - lastMouseT;
    if (dt > 0 && lastMouseT > 0) {
      var speed = Math.sqrt(dx * dx + dy * dy) / dt;
      mouseMoves.push({ x: e.clientX, y: e.clientY, t: now, s: speed });
      if (mouseMoves.length > 500) mouseMoves.shift();
    }
    lastMouseX = e.clientX; lastMouseY = e.clientY; lastMouseT = now;
  }, { passive: true });

  document.addEventListener('click', function (e) {
    clicks.push({ x: e.clientX, y: e.clientY, t: Date.now() });
    if (clicks.length > 100) clicks.shift();
  });

  document.addEventListener('keydown', function (e) {
    var now = Date.now();
    var interval = lastKeyT > 0 ? now - lastKeyT : 0;
    var key = e.key === 'Backspace' ? 'bs' : (e.key.length === 1 ? 'c' : 'o');
    keyEvents.push({ k: key, t: now, i: interval });
    if (keyEvents.length > 500) keyEvents.shift();
    lastKeyT = now;
  });

  document.addEventListener('scroll', function () {
    var now = Date.now();
    var y = window.scrollY;
    var dy = y - lastScrollY;
    if (dy === 0) return;
    var dir = dy > 0 ? 'd' : 'u';
    var dt = now - lastScrollT;
    var speed = dt > 0 ? Math.abs(dy) / dt : 0;
    if (dir !== lastScrollDir) {
      scrollEvents.push({ dir: dir, t: now, speed: speed });
      lastScrollDir = dir;
    }
    lastScrollY = y; lastScrollT = now;
  }, { passive: true });

  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
    var name = el.name || el.id || 'f' + Object.keys(forms).length;
    if (!forms[name]) forms[name] = {};
    forms[name].start = Date.now();
  });

  document.addEventListener('focusout', function (e) {
    var el = e.target;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
    var name = el.name || el.id;
    if (name && forms[name] && forms[name].start) {
      forms[name].duration = Date.now() - forms[name].start;
    }
  });

  // SPA page tracking
  setInterval(function () {
    if (location.pathname !== currentPagePath) {
      pages.push({ path: currentPagePath, start: currentPageStart, end: Date.now() });
      currentPagePath = location.pathname;
      currentPageStart = Date.now();
    }
  }, 500);

  function calcMouseSmoothness() {
    var pts = mouseMoves.slice(-80);
    if (pts.length < 5) return 50;
    var angles = [];
    for (var i = 2; i < pts.length; i++) {
      var p1 = pts[i - 2], p2 = pts[i - 1], p3 = pts[i];
      var dx1 = p2.x - p1.x, dy1 = p2.y - p1.y;
      var dx2 = p3.x - p2.x, dy2 = p3.y - p2.y;
      var len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      if (len1 < 1) continue;
      var angle = Math.abs(Math.atan2(dy2, dx2) - Math.atan2(dy1, dx1));
      angles.push(angle > Math.PI ? 2 * Math.PI - angle : angle);
    }
    if (!angles.length) return 90;
    var avg = angles.reduce(function (a, b) { return a + b; }, 0) / angles.length;
    // Low avg angle change = straight lines = robotic. Map to 0-100 (100 = robotic).
    return Math.round(Math.min(100, Math.max(0, (1 - Math.min(1, avg / 0.5)) * 100)));
  }

  function calcTypingRhythm() {
    var intervals = keyEvents.filter(function (e) { return e.i > 0; }).map(function (e) { return e.i; });
    if (intervals.length < 4) return 50;
    var avg = intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length;
    var variance = intervals.reduce(function (acc, v) { return acc + (v - avg) * (v - avg); }, 0) / intervals.length;
    var stdDev = Math.sqrt(variance);
    // Low stdDev = uniform = robotic. Map to 0-100 (100 = robotic).
    return Math.round(Math.min(100, Math.max(0, (1 - Math.min(1, stdDev / 150)) * 100)));
  }

  function buildPayload(isBeacon) {
    var timeline = pages.slice();
    timeline.push({ path: currentPagePath, start: currentPageStart, end: Date.now() });
    return {
      visitor_id: cfg.visitor_id,
      account_id: cfg.account_id,
      api_key: cfg.api_key,
      session_duration: Date.now() - sessionStart,
      mouse_move_count: mouseMoves.length,
      click_count: clicks.length,
      keyboard_event_count: keyEvents.length,
      scroll_direction_changes: scrollEvents.length,
      backspace_count: keyEvents.filter(function (e) { return e.k === 'bs'; }).length,
      mouse_smoothness_score: calcMouseSmoothness(),
      typing_rhythm_score: calcTypingRhythm(),
      page_timeline: timeline,
      form_interactions: forms,
      clicks: clicks.slice(-20),
      collected_at: Date.now(),
    };
  }

  function send(beacon) {
    var payload = buildPayload(beacon);
    var body = JSON.stringify(payload);
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(cfg.endpoint, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
        .catch(function () {});
    }
  }

  setInterval(function () { send(false); }, cfg.sendInterval);
  window.addEventListener('beforeunload', function () { send(true); });
})();
