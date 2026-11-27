'use strict';
/* ✦ Stellar bio. Settings live in config.js ✦ */
const B = window.BIO || {};
const $ = (s) => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(hover: none)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = { get(k, d) { try { const v = localStorage.getItem('bio.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('bio.' + k, JSON.stringify(v)); } catch { } } };

/* ====================================================================================
   The sky: an ASCII universe. Every frame is a grid of characters; brightness picks the
   character and its opacity. Stars drift and twinkle, a ringed planet turns with a moon
   around it, a spiral galaxy wheels slowly, and now and then a shooting star crosses.
   ==================================================================================== */
const Space = (() => {
  const cv = $('#space'), ctx = cv.getContext('2d', { alpha: false });
  const RAMP = ' .,:-=+*#%';
  let gal = [];
  const LEVELS = 10;
  let W, H, cw, chh, cols, rows, chars, alphas, stars = [], shots = [], dpr = 1, font = 14;
  let mx = 0, my = 0, pmx = 0, pmy = 0, last = 0, t = 0, running = true, nextShot = 3;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    font = W < 600 ? 11 : W < 1100 ? 13 : 14;
    ctx.font = `${font}px "JetBrains Mono", Consolas, monospace`;
    ctx.textBaseline = 'top';
    cw = ctx.measureText('M').width; chh = Math.round(font * 1.18);
    cols = Math.ceil(W / cw) + 1; rows = Math.ceil(H / chh) + 1;
    chars = new Uint16Array(cols * rows); alphas = new Float32Array(cols * rows);
    // stars: depth decides size, speed and parallax
    const n = Math.round(cols * rows * (W < 600 ? 0.022 : 0.018));
    stars = Array.from({ length: n }, () => ({ x: Math.random() * cols, y: Math.random() * rows, d: 0.25 + Math.random() ** 2 * 0.75, f: 0.6 + Math.random() * 2.2, p: Math.random() * 7 }));
    // galaxy: two logarithmic arms of dust plus a dense core, made once
    const per = W < 600 ? 260 : 420;
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    gal = [];
    for (let arm = 0; arm < 2; arm++) for (let k = 0; k < per; k++) {
      const f = Math.pow(k / per, 0.85);
      gal.push({ f, a: arm * Math.PI + f * 3.4 * Math.PI + gauss() * 0.35 * (1 - f * 0.5), j: 1 + gauss() * 0.12 });
    }
    for (let k = 0; k < per * 0.35; k++) gal.push({ f: Math.abs(gauss()) * 0.16, a: Math.random() * Math.PI * 2, j: 1 });
  }

  // puts a character in a cell; brighter wins, so things layer naturally
  function put(c, r, ch, a, force) {
    c = Math.round(c); r = Math.round(r);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    const i = r * cols + c;
    if (force || a > alphas[i]) { chars[i] = ch.charCodeAt(0); alphas[i] = a; }
  }
  const toCell = (px, py) => [px / cw, py / chh];

  function sphere(cx, cy, R, rot, bands, glow, L = [-0.62, -0.48, 0.62]) {
    const c0 = Math.floor((cx - R) / cw), c1 = Math.ceil((cx + R) / cw), r0 = Math.floor((cy - R) / chh), r1 = Math.ceil((cy + R) / chh);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const nx = (c * cw + cw / 2 - cx) / R, ny = (r * chh + chh / 2 - cy) / R, d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      let lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const lon = Math.atan2(nx, nz) + rot, lat = ny;
      const band = bands ? 0.5 + 0.5 * Math.sin(lat * bands + Math.sin(lon * 3 + lat * 4) * 1.3) : 0.6 + 0.4 * Math.sin(lon * 5) * Math.cos(lat * 6);
      const rim = Math.pow(1 - nz, 3) * 0.25; // a thin atmosphere on the edge
      const v = Math.min(1, lam * (0.55 + 0.45 * band) * glow + rim + 0.03);
      const k = Math.max(1, Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1))));
      put(c, r, RAMP[k], 0.18 + v * 0.82, true);
    }
  }

  function ring(cx, cy, R, front) {
    const tilt = -0.32, ca = Math.cos(tilt), sa = Math.sin(tilt);
    for (const [rr, ch, a] of [[1.55, '-', 0.38], [1.75, '=', 0.5], [1.95, '-', 0.3], [2.12, '.', 0.22]]) {
      const steps = Math.round((2 * Math.PI * rr * R) / (cw * 0.7));
      for (let s = 0; s < steps; s++) {
        const th = (s / steps) * Math.PI * 2 + t * 0.05;
        const isFront = Math.sin(th) > 0;
        if (isFront !== front) continue;
        const ex = Math.cos(th) * rr * R, ey = Math.sin(th) * rr * R * 0.26;
        const px = cx + ex * ca - ey * sa, py = cy + ex * sa + ey * ca;
        if (!front) { const dx = px - cx, dy = py - cy; if (dx * dx + dy * dy < R * R) continue; }
        const [c, r] = toCell(px, py);
        put(c, r, ch, a * (0.7 + 0.3 * Math.sin(th * 3 + t)), front);
      }
    }
  }

  function galaxy(cx, cy, size) {
    const tilt = 0.5, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (const g of gal) {
      const ang = g.a + t * (0.05 - g.f * 0.03); // the inside turns a little faster, like a real one
      const rad = g.f * size * g.j;
      const ex = Math.cos(ang) * rad, ey = Math.sin(ang) * rad * 0.42;
      const [c, r] = toCell(cx + ex * ct - ey * st, cy + ex * st + ey * ct);
      const a = g.f < 0.05 ? 1 : (1 - g.f) * 0.6 + 0.06;
      put(c, r, g.f < 0.05 ? '@' : g.f < 0.12 ? '*' : g.f < 0.35 ? '+' : g.f < 0.6 ? ':' : '.', a);
    }
  }

  /* a milky way: a diagonal band of ASCII dust, recomputed a few times a second as it drifts */
  const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  let neb = null, nebAt = -1;
  function nebula() {
    if (!neb || neb.length !== cols * rows) neb = new Float32Array(cols * rows);
    if (t - nebAt > 0.25) {
      nebAt = t;
      const diag = Math.hypot(cols, rows * (chh / cw));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        // distance from the line bottom-left -> top-right, in roughly square units
        const u = c / cols, v = r / rows;
        const d = Math.abs(v - (0.95 - 0.85 * u)) * rows * (chh / cw) / diag;
        const band = Math.exp(-((d / 0.13) ** 2));
        if (band < 0.05) { neb[r * cols + c] = 0; continue; }
        const n = vnoise(c * 0.07 + t * 0.06, r * 0.14) * 0.65 + vnoise(c * 0.19 - t * 0.04, r * 0.36) * 0.35;
        neb[r * cols + c] = band * n;
      }
    }
    for (let i = 0; i < neb.length; i++) {
      const v = neb[i];
      if (v < 0.3) continue;
      const ch = v > 0.62 ? ':' : v > 0.48 ? ',' : v > 0.38 ? "'" : '.';
      put(i % cols, Math.floor(i / cols), ch, Math.min(0.26, (v - 0.28) * 0.55));
    }
  }

  /* constellations: dotted lines between named stars, like an old star chart */
  const CONS = [
    { at: [0.6, 0.08], small: [0.52, 0.035], nodes: [[0, 0], [1.1, 0.25], [2.2, 0.1], [3.3, 0.4], [3.6, 1.25], [4.9, 1.15], [4.8, 0.35]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
    { at: [0.06, 0.8], small: [0.06, 0.93], nodes: [[0, 0.7], [0.9, 0], [1.8, 0.55], [2.7, 0], [3.6, 0.7], [1.8, 1.5]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]] },
  ];
  function constellations(small) {
    const s = Math.min(W, H) * (small ? 0.05 : 0.045);
    CONS.forEach((k, idx) => {
      const [ax, ay] = small ? k.small : k.at;
      const ox = W * ax - pmx * 10, oy = H * ay - pmy * 8;
      const pts = k.nodes.map(([x, y]) => [(ox + x * s) / cw, (oy + y * s) / chh]);
      for (const [a, b] of k.edges) {
        const [x0, y0] = pts[a], [x1, y1] = pts[b];
        const dx = x1 - x0, dy = y1 - y0, steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
        const slope = Math.abs(dy * chh) / (Math.abs(dx * cw) + 0.001);
        const ch = slope < 0.4 ? '-' : slope > 2.5 ? '|' : (dx > 0) === (dy < 0) ? '/' : '\\';
        for (let i = 1; i < steps; i++) if (i % 2) put(x0 + (dx * i) / steps, y0 + (dy * i) / steps, ch, 0.17);
      }
      pts.forEach(([x, y], i) => {
        const tw = 0.6 + 0.4 * Math.sin(t * 1.3 + i * 1.7 + idx * 3);
        put(x, y, i % 3 === 0 ? '*' : '+', 0.55 + tw * 0.45);
      });
    });
  }

  /* a slow comet every half minute or so, with a long fading tail */
  let comet = null, nextComet = 9;
  function comets(dt) {
    nextComet -= dt;
    if (!comet && nextComet <= 0 && !reduced) comet = { x: cols * (0.75 + Math.random() * 0.25), y: -2, life: 0 };
    if (!comet) return;
    comet.life += dt; comet.x -= dt * 7; comet.y += dt * 3.2;
    const fade = Math.min(1, comet.life / 0.8, (9 - comet.life) / 1.5);
    put(comet.x, comet.y, '@', fade); put(comet.x - 1, comet.y, '*', fade * 0.5); put(comet.x, comet.y + 1, '.', fade * 0.4);
    for (let k = 1; k < 30; k++) {
      const wob = Math.sin(k * 0.5 - t * 3) * 0.35;
      put(comet.x + k * 1.15, comet.y - k * 0.5 + wob, k < 5 ? '=' : k < 12 ? '~' : k < 20 ? '-' : '.', fade * (1 - k / 30) * 0.75);
    }
    if (comet.life > 9) { comet = null; nextComet = 25 + Math.random() * 15; }
  }

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < 33) return; // ~30 fps is plenty for a drifting sky
    const dt = Math.min(0.1, (now - last) / 1000 || 0.033);
    last = now; t += dt;
    pmx += (mx - pmx) * 0.06; pmy += (my - pmy) * 0.06;
    chars.fill(0); alphas.fill(0);

    const small = W < 700;
    nebula();
    constellations(small);

    // a crescent moon high on the right: lit from behind and to the side
    const mR = Math.min(W, H) * (small ? 0.06 : 0.055);
    sphere(W * (small ? 0.86 : 0.9) - pmx * 9, H * (small ? 0.05 : 0.13) - pmy * 6, mR, t * 0.02, 0, 1.25, [-0.93, -0.2, -0.05]);

    // galaxy, far away (moves least with the mouse)
    const gs = Math.min(W, H) * (small ? 0.24 : 0.2);
    const left = (W - 440) / 2; // left edge of the card
    galaxy((small ? W * 0.26 : Math.min(left - gs * 0.55, W * 0.2)) - pmx * 6, H * (small ? 0.1 : 0.24) - pmy * 4, gs);

    // stars
    for (const s of stars) {
      s.x -= dt * 0.35 * s.d; if (s.x < -2) s.x += cols + 2;
      const c = s.x - pmx * 14 * s.d / cw, r = s.y - pmy * 10 * s.d / chh;
      const tw = 0.55 + 0.45 * Math.sin(t * s.f + s.p);
      const b = s.d * tw;
      if (b > 0.86 && s.d > 0.85) { // a bright star sparkles with a little cross
        put(c, r, '*', 1); put(c - 1, r, '-', 0.45); put(c + 1, r, '-', 0.45); put(c, r - 1, '|', 0.35); put(c, r + 1, '|', 0.35);
      } else put(c, r, b > 0.62 ? '+' : b > 0.4 ? '*' : b > 0.22 ? '.' : '.', 0.12 + b * 0.75);
    }

    // planet + ring + moon (closer: more parallax)
    // the planet sits in the space right of the card when there is room, low on the screen otherwise
    const R = Math.min(W, H) * (small ? 0.2 : 0.15);
    const side = (W + 440) / 2; // right edge of the card
    const px = (small ? W * 0.8 : Math.max(side + R * 1.3, W * 0.8)) - pmx * 22, py = H * (small ? 0.86 : 0.7) - pmy * 16;
    ring(px, py, R, false);
    sphere(px, py, R, t * 0.18, 10, 1.05);
    ring(px, py, R, true);
    const mo = t * 0.35, mr = R * 2.6;
    const mxp = px + Math.cos(mo) * mr, myp = py + Math.sin(mo) * mr * 0.32 - R * 0.15;
    const behind = Math.sin(mo) < 0, md2 = (mxp - px) ** 2 + (myp - py) ** 2;
    if (!(behind && md2 < R * R)) sphere(mxp, myp, R * 0.2, t * 0.5, 0, 0.95);

    comets(dt);

    // shooting stars
    nextShot -= dt;
    if (nextShot <= 0 && !reduced) { nextShot = 4 + Math.random() * 6; shots.push({ x: cols * (0.3 + Math.random() * 0.7), y: rows * Math.random() * 0.4, life: 0 }); }
    shots = shots.filter((s) => s.life < 1.6);
    for (const s of shots) {
      s.life += dt; s.x -= dt * 34; s.y += dt * 13;
      const fade = Math.min(1, (1.6 - s.life) / 0.5);
      put(s.x, s.y, '*', fade);
      for (let k = 1; k < 14; k++) put(s.x + k * 1.0, s.y - k * 0.38, k < 4 ? '=' : k < 8 ? '-' : '.', fade * (1 - k / 14) * 0.8);
    }

    // draw: group cells by brightness so the canvas changes colour only a few times
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, W, H);
    const buckets = Array.from({ length: LEVELS }, () => []);
    for (let i = 0; i < chars.length; i++) if (chars[i]) buckets[Math.min(LEVELS - 1, Math.floor(alphas[i] * LEVELS))].push(i);
    for (let l = 0; l < LEVELS; l++) {
      const list = buckets[l];
      if (!list.length) continue;
      ctx.fillStyle = `rgba(232,236,250,${((l + 0.5) / LEVELS).toFixed(2)})`;
      for (const i of list) ctx.fillText(String.fromCharCode(chars[i]), (i % cols) * cw, Math.floor(i / cols) * chh);
    }
  }

  addEventListener('resize', () => { resize(); if (reduced) frame(performance.now() + 100); });
  addEventListener('pointermove', (e) => { mx = (e.clientX / innerWidth - 0.5); my = (e.clientY / innerHeight - 0.5); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    const was = running;
    running = !document.hidden && !reduced;
    if (running && !was) { last = performance.now(); requestAnimationFrame(frame); }
  });
  return {
    start() {
      resize();
      document.fonts.ready.then(() => { resize(); });
      if (reduced) { running = true; last = -1000; frame(0); running = false; }
      else requestAnimationFrame(frame);
    },
  };
})();

/* ==================================== sound ==================================== */
/* A soft space ambience made live with Web Audio: slow pad chords, a low hum and
   scattered bell notes through a long reverb. Or the file named in config.js. */
const Sound = (() => {
  let ctx, master, audio, on = store.get('sound', true), started = false, timer = 0;
  const vol = Math.max(0, Math.min(1, B.volume ?? 0.5));
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const CHORDS = [[53, 57, 60, 64], [57, 60, 64, 67], [48, 55, 59, 64], [52, 55, 59, 62]]; // Fmaj7 Am7 Cmaj7 Em7
  const BAR = 8;

  function impulse(sec) {
    const len = ctx.sampleRate * sec, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return buf;
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    const verb = ctx.createConvolver(); verb.buffer = impulse(4.5);
    const wet = ctx.createGain(); wet.gain.value = 0.7; verb.connect(wet).connect(master);
    const dry = ctx.createGain(); dry.gain.value = 0.5; dry.connect(master);
    const delay = ctx.createDelay(); delay.delayTime.value = 0.43;
    const fb = ctx.createGain(); fb.gain.value = 0.36; delay.connect(fb).connect(delay); delay.connect(verb);
    const bus = { verb, dry, delay };
    let bar = 0, at = ctx.currentTime + 0.2;
    const schedule = () => {
      while (at < ctx.currentTime + 6) {
        const chord = CHORDS[bar % CHORDS.length];
        chord.forEach((m) => pad(bus, hz(m), at, BAR + 2));
        hum(bus, hz(chord[0] - 24), at, BAR + 1);
        for (let k = 0; k < 6; k++) if (Math.random() < 0.55) bell(bus, hz(chord[Math.floor(Math.random() * 4)] + (Math.random() < 0.5 ? 12 : 24)), at + Math.random() * BAR);
        at += BAR; bar++;
      }
    };
    schedule(); timer = setInterval(schedule, 1000);
  }

  function pad(bus, f, t0, dur) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.045, t0 + 2.8); g.gain.setValueAtTime(0.045, t0 + dur - 3.2); g.gain.linearRampToValueAtTime(0, t0 + dur);
    for (const det of [-7, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t0); o.stop(t0 + dur + 0.1); }
    lp.connect(g); g.connect(bus.verb); g.connect(bus.dry);
  }
  function hum(bus, f, t0, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.07, t0 + 2); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g).connect(bus.dry); o.start(t0); o.stop(t0 + dur + 0.1);
  }
  function bell(bus, f, t0) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2.001;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.035, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
    o.connect(g); o2.connect(g); g.connect(bus.delay); g.connect(bus.verb);
    o.start(t0); o2.start(t0); o.stop(t0 + 2.3); o2.stop(t0 + 2.3);
  }

  function fadeTo(v, sec) {
    if (audio) { audio.volume = v; return; }
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(v, now + sec);
  }

  async function start() {
    if (started) return; started = true;
    if (B.music) { audio = new Audio(B.music); audio.loop = true; audio.volume = on ? vol : 0; if (on) audio.play().catch(() => {}); }
    else { build(); if (on) fadeTo(vol * 0.9, 4); else ctx.suspend(); }
    paint();
  }
  async function toggle() {
    on = !on; store.set('sound', on);
    if (!started) { paint(); return; }
    if (audio) { if (on) { audio.volume = vol; audio.play().catch(() => {}); } else audio.pause(); }
    else if (on) { await ctx.resume(); fadeTo(vol * 0.9, 1.2); }
    else { fadeTo(0, 0.4); setTimeout(() => { if (!on) ctx.suspend(); }, 450); }
    paint();
  }
  function paint() {
    const b = $('#sound');
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', on ? 'Turn music off' : 'Turn music on');
    $('#soundLabel').textContent = on ? 'sound on' : 'sound off';
  }
  document.addEventListener('visibilitychange', () => { if (!ctx || !on) return; document.hidden ? ctx.suspend() : ctx.resume(); });
  return { start, toggle, paint };
})();

/* ==================================== icons ==================================== */
const ICONS = {
  discord: ['wobble', 'M19.3 5.3A16.6 16.6 0 0 0 15.2 4l-.5 1a15.4 15.4 0 0 0-5.4 0l-.5-1a16.6 16.6 0 0 0-4.1 1.3C2.1 9.2 1.4 13 1.7 16.8a16.7 16.7 0 0 0 5 2.5l1.1-1.7a10.8 10.8 0 0 1-1.7-.8l.4-.3a11.9 11.9 0 0 0 11 0l.4.3-1.7.8 1.1 1.7a16.6 16.6 0 0 0 5-2.5c.4-4.4-.7-8.2-3-11.5zM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z'],
  tiktok: ['glitch', 'M12.5 0h3.9a5.6 5.6 0 0 0 5.6 5.6v3.9a9.4 9.4 0 0 1-5.5-1.8v8.4a8 8 0 1 1-8-8c.3 0 .7 0 1 .1v4.1a4 4 0 1 0 3 3.8z'],
  youtube: ['pulse', 'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6z'],
  instagram: ['pulse', 'M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z'],
  facebook: ['hop', 'M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z'],
  x: ['glitch', 'M18.9 1.2h3.7l-8 9.2L24 22.8h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9zm-1.3 19.4h2L6.5 3.3H4.3z'],
  roblox: ['turn', 'M5.2 0 0 18.8 18.8 24 24 5.2zm8.6 15.3-5-1.3 1.3-5 5 1.3z'],
  github: ['hop', 'M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3'],
  twitch: ['wobble', 'M2.1 0 .5 4.2v17h5.8v3.1h3.2l3.1-3.1h4.7l6.3-6.3V0zm19.3 13.8-3.7 3.7h-5.8l-3.1 3.1v-3.1H4.2V2.1h17.2zM17.7 6.4v6.3h-2.1V6.4zm-5.8 0v6.3H9.8V6.4z'],
  spotify: ['turn', 'M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.7.7 0 0 1-1 .3c-2.8-1.7-6.4-2.1-10.6-1.2a.7.7 0 1 1-.3-1.5c4.6-1 8.5-.6 11.7 1.4.3.2.4.7.2 1zm1.5-3.3a.9.9 0 0 1-1.3.3c-3.2-2-8.1-2.6-11.9-1.4a.9.9 0 1 1-.5-1.8c4.3-1.3 9.7-.7 13.4 1.6.4.3.5.8.3 1.3zm.1-3.4C15.3 8.4 9 8.2 5.4 9.3a1.1 1.1 0 1 1-.7-2.1c4.2-1.3 11.1-1 15.5 1.6a1.1 1.1 0 0 1-1.1 1.8z'],
  star: ['turn', 'M12 1.2 C12.6 7.6 16.4 11.4 22.8 12 C16.4 12.6 12.6 16.4 12 22.8 C11.4 16.4 7.6 12.6 1.2 12 C7.6 11.4 11.4 7.6 12 1.2 Z'],
  link: ['hop', 'M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zM6.3 20.5a4.5 4.5 0 0 1-3.2-7.7l2.8-2.8a1 1 0 1 1 1.4 1.4l-2.8 2.8a2.5 2.5 0 0 0 3.5 3.5l2.8-2.8a1 1 0 1 1 1.4 1.4l-2.8 2.8a4.5 4.5 0 0 1-3.1 1.4zm10.4-6.1a1 1 0 0 1-.7-1.7l2.8-2.8a2.5 2.5 0 0 0-3.5-3.5l-2.8 2.8a1 1 0 1 1-1.4-1.4l2.8-2.8a4.5 4.5 0 0 1 6.3 6.3l-2.8 2.8a1 1 0 0 1-.7.3z'],
};
const svgIcon = (type) => { const [, d] = ICONS[type] || ICONS.link; return `<svg viewBox="0 0 24 24" aria-hidden="true"${type === 'roblox' ? ' fill-rule="evenodd"' : ''}><path d="${d}"/></svg>`; };

function buildLinks() {
  const nav = $('#links');
  for (const l of B.links || []) {
    const [fx] = ICONS[l.type] || ICONS.link;
    const a = document.createElement(l.copy ? 'button' : 'a');
    a.className = 'tile'; a.dataset.fx = fx;
    if (l.copy) { a.type = 'button'; a.addEventListener('click', () => copy(l.copy, `${l.label || 'Copied'} · ${l.copy}`)); }
    else { a.href = l.url; a.target = '_blank'; a.rel = 'noopener'; }
    a.setAttribute('aria-label', l.label || l.type);
    a.innerHTML = svgIcon(l.type) + `<span class="tip"></span>`;
    a.querySelector('.tip').textContent = l.label || l.type;
    a.addEventListener('click', (e) => sparks(e.clientX, e.clientY));
    nav.appendChild(a);
  }
  const box = $('#buttons');
  for (const b of B.buttons || []) {
    const a = document.createElement('a');
    a.className = 'btn'; a.href = b.url; a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = `<span class="ico">${svgIcon(b.icon || 'link')}</span><span class="txt"><b></b><small></small></span><svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;
    a.querySelector('b').textContent = b.label;
    a.querySelector('small').textContent = b.sub || '';
    if (!b.sub) a.querySelector('small').remove();
    a.addEventListener('click', (e) => sparks(e.clientX, e.clientY));
    box.appendChild(a);
  }
}

/* a little burst of ASCII stars where you click */
function sparks(x, y) {
  if (reduced) return;
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('span');
    s.className = 'spark'; s.textContent = '*+.✦'[i % 4];
    const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 30;
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px'); s.style.setProperty('--r', (Math.random() * 180 - 90) + 'deg');
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 750);
  }
}

let toastTimer = 0;
function toast(text) { const t = $('#toast'); t.textContent = text; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1800); }
async function copy(text, msg) { try { await navigator.clipboard.writeText(text); toast('copied ✦ ' + msg); } catch { toast(text); } }

/* ==================================== typing ==================================== */
async function type(el, text, speed = 70, caret) {
  caret?.classList.add('typing');
  for (const ch of text) { el.textContent += ch; await sleep(reduced ? 0 : speed + Math.random() * speed * 0.6); }
  caret?.classList.remove('typing');
}
async function erase(el, speed = 28) { while (el.textContent.length) { el.textContent = el.textContent.slice(0, -1); await sleep(speed); } }
async function rolesLoop() {
  const el = $('#role'), roles = B.roles?.length ? B.roles : [''];
  for (let i = 0; ; i = (i + 1) % roles.length) {
    await type(el, roles[i], 55);
    if (roles.length === 1) return;
    await sleep(2200); await erase(el);
    await sleep(300);
  }
}

/* ==================================== tilt ==================================== */
function tilt() {
  const card = $('#card');
  if (reduced || touch) return;
  let tx = 0, ty = 0, cx = 0, cy = 0, gx = 50, gy = 50, glare = 0, tg = 0, raf = 0;
  const loop = () => {
    cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
    glare += (tg - glare) * 0.12;
    card.style.setProperty('--rx', cy.toFixed(2) + 'deg');
    card.style.setProperty('--ry', cx.toFixed(2) + 'deg');
    card.style.setProperty('--gx', gx + '%'); card.style.setProperty('--gy', gy + '%');
    card.style.setProperty('--glare', glare.toFixed(3));
    raf = Math.abs(tx - cx) + Math.abs(ty - cy) + Math.abs(tg - glare) > 0.01 ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    tx = (x - 0.5) * 14; ty = (0.5 - y) * 12;
    gx = Math.round(x * 100); gy = Math.round(y * 100); tg = 1;
    kick();
  });
  card.addEventListener('pointerleave', () => { tx = ty = 0; tg = 0; kick(); });
}

/* ====================================================================================
   The hands: two ASCII hands, shaded like the planet, glide in holding a thin seam of
   light, grip it and pull the card open from the middle, then let go and drift away.
   Each hand is a signed-distance shape (wrist, palm, four fingers, thumb); every
   character cell inside it gets a shade from its depth and the light, and the outline
   gets a character that follows its slope.
   ==================================================================================== */
const Hands = (() => {
  const cv = $('#hands'), ctx = cv.getContext('2d');
  const RAMP = ' .:-=+*#%';
  let W, H, cw, chh, font;

  function setup() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    font = W < 600 ? 7 : 8;
    ctx.font = `${font}px "JetBrains Mono", Consolas, monospace`;
    ctx.textBaseline = 'top';
    cw = ctx.measureText('M').width; chh = Math.round(font * 1.15);
  }

  // signed distances (negative inside)
  const len = (x, y) => Math.hypot(x, y);
  function capsule(px, py, ax, ay, bx, by, r) {
    const bax = bx - ax, bay = by - ay, pax = px - ax, pay = py - ay;
    const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
    return len(pax - bax * h, pay - bay * h) - r;
  }
  function roundBox(px, py, cx, cy, hx, hy, r) {
    const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r;
    return len(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }
  const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k)); return b + (a - b) * h - k * h * (1 - h); };

  // one hand in its own units (1 = hand size); x points toward the card, y down. g = grip 0..1
  function hand(x, y, g) {
    const curl = 0.07 * g;
    const palm = roundBox(x, y, -0.52, 0.02, 0.3, 0.36, 0.16);
    const arm = capsule(x, y, -0.75, 0.08, -2.6, 0.2, 0.2); // comes in level from the side of the screen
    const fingers = [
      [-0.28, 0.08, 0.13], // y, reach, curl
      [-0.095, 0.15, 0.16],
      [0.09, 0.12, 0.15],
      [0.27, 0.02, 0.11],
    ].map(([fy, reach, c]) => Math.min(
      capsule(x, y, -0.3, fy, 0.0 + reach * 0.5, fy - 0.015, 0.072),
      capsule(x, y, 0.0 + reach * 0.5, fy - 0.015, 0.06 + reach, fy + c + curl, 0.066),
    ));
    const thumb = Math.min(capsule(x, y, -0.5, -0.3, -0.2, -0.52, 0.085), capsule(x, y, -0.2, -0.52, -0.02, -0.5 + curl, 0.075));
    let f = Math.min(...fingers);
    const sorted = [...fingers].sort((a, b) => a - b);
    const crease = sorted[1] - sorted[0] < 0.02 && sorted[0] < 0;
    const body = smin(smin(palm, arm, 0.12), thumb, 0.06);
    return { d: smin(body, f, 0.05), crease };
  }

  // draws one hand gripping at (gx, gy); side = -1 left (hand on the left, reaching right), +1 right
  function drawHand(cells, gx, gy, S, side, g, alpha) {
    const L = [-0.55, -0.6, 0.58];
    const x0 = gx + (side < 0 ? -2.5 * S : -0.35 * S), x1 = gx + (side < 0 ? 0.35 * S : 2.5 * S);
    const y0 = gy - 0.75 * S, y1 = gy + 1.1 * S;
    const c0 = Math.max(0, Math.floor(x0 / cw)), c1 = Math.min(Math.ceil(W / cw), Math.ceil(x1 / cw));
    const r0 = Math.max(0, Math.floor(y0 / chh)), r1 = Math.min(Math.ceil(H / chh), Math.ceil(y1 / chh));
    const e = 0.012;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const px = c * cw + cw / 2, py = r * chh + chh / 2;
      const lx = ((px - gx) / S) * -side, ly = (py - gy) / S; // mirror so fingers always point at the card
      const { d, crease } = hand(lx, ly, g);
      if (d > 0.004) continue;
      const nxL = hand(lx + e, ly, g).d - hand(lx - e, ly, g).d, ny = hand(lx, ly + e, g).d - hand(lx, ly - e, g).d;
      const nx = nxL * -side; // back to screen direction
      const gl = Math.hypot(nx, ny) || 1;
      let ch, v;
      if (d > -0.03) { // outline: a character that follows the edge
        const ax = Math.abs(nx / gl), ay = Math.abs(ny / gl);
        ch = ay > 0.85 ? '-' : ax > 0.85 ? '|' : (nx > 0) === (ny > 0) ? '\\' : '/';
        if (ay > 0.85 && ny < 0) ch = '_';
        v = 0.95;
      } else {
        const depth = Math.min(1, -d / 0.16);
        const k = (1 - depth) * 0.9;
        const n3 = [(nx / gl) * k, (ny / gl) * k, depth + 0.25];
        const nl = Math.hypot(...n3);
        const lam = Math.max(0, (n3[0] * L[0] + n3[1] * L[1] + n3[2] * L[2]) / nl);
        v = 0.12 + lam * 0.85;
        if (crease) v *= 0.35;
        ch = RAMP[Math.max(1, Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1))))];
      }
      const fadeArm = Math.max(0, Math.min(1, (lx + 2.2) / 1.1)); // the forearm dissolves into the dark
      cells.push([c, r, ch, v * alpha * fadeArm]);
    }
  }

  function draw(cells) {
    ctx.clearRect(0, 0, W, H);
    const buckets = Array.from({ length: 10 }, () => []);
    for (const cell of cells) buckets[Math.min(9, Math.floor(cell[3] * 10))].push(cell);
    buckets.forEach((list, l) => {
      if (!list.length) return;
      ctx.fillStyle = `rgba(236,239,250,${((l + 0.5) / 10).toFixed(2)})`;
      for (const [c, r, ch] of list) ctx.fillText(ch, c * cw, r * chh);
    });
  }

  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const out = (x) => 1 - Math.pow(1 - x, 3);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  /** Plays the opening. The card is clipped from the middle and revealed as the hands pull. */
  function open(card) {
    setup();
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, half = rect.width / 2;
    const S = Math.min(rect.height * 0.3, W < 600 ? 96 : 150);
    const slit = Math.min(half * 0.32, S * 0.55); // the card arrives as a narrow slit the hands can grip
    const gyL = rect.top + rect.height * 0.42, gyR = rect.top + rect.height * 0.58;
    card.style.clipPath = 'inset(0 50% 0 50% round 18px)';
    card.classList.add('opening');
    const T = { enter: 900, grip: 350, pull: 1100, leave: 800 };
    const total = T.enter + T.grip + T.pull + T.leave;
    const render = (ms) => {
        const pEnter = out(clamp01(ms / T.enter));
        const pGrip = clamp01((ms - T.enter) / T.grip);
        const pPull = ease(clamp01((ms - T.enter - T.grip) / T.pull));
        const pLeave = clamp01((ms - T.enter - T.grip - T.pull) / T.leave);
        // where the card's edges are right now
        const open = (slit + pPull * (half - slit)) * pEnter;
        card.style.clipPath = `inset(0 ${(50 - (open / rect.width) * 100).toFixed(2)}% 0 ${(50 - (open / rect.width) * 100).toFixed(2)}% round 18px)`;
        const cells = [];
        // the two edges of the slit glow while the hands hold it
        const seamA = clamp01((ms - 250) / 500) * (1 - pPull * 0.9);
        if (seamA > 0.01) {
          const grow = out(clamp01((ms - 250) / 600));
          const mid = rect.top + rect.height / 2, h2 = (rect.height / 2) * grow;
          for (let y = mid - h2; y <= mid + h2; y += chh) for (const ex of [cx - open, cx + open]) {
            cells.push([Math.round(ex / cw - 0.5), Math.round(y / chh), '|', seamA]);
            cells.push([Math.round(ex / cw - 0.5) + (ex < cx ? -1 : 1), Math.round(y / chh), ':', seamA * 0.3]);
          }
        }
        // hands: in from the sides, grip, pull with the edges, then let go and drift out
        const away = out(pLeave) * S * 1.6;
        const startOff = (W / 2) + S * 2.5;
        const lx = (cx - open) - (1 - pEnter) * startOff - away;
        const rx = (cx + open) + (1 - pEnter) * startOff + away;
        const shake = pPull > 0 && pPull < 1 ? Math.sin(ms * 0.06) * 1.2 : 0;
        const g = pGrip * (1 - pLeave);
        const alpha = 1 - pLeave;
        if (alpha > 0.01) {
          drawHand(cells, lx - 3, gyL + shake, S, -1, g, alpha);
          drawHand(cells, rx + 3, gyR - shake, S, 1, g, alpha);
        }
        // a few sparks fly off the edges while it opens
        if (pPull > 0 && pPull < 1) for (let k = 0; k < 4; k++) {
          const sy = rect.top + Math.random() * rect.height;
          cells.push([Math.round((cx - open) / cw) - 1 - Math.round(Math.random() * 2), Math.round(sy / chh), '*+.'[k % 3], 0.6]);
          cells.push([Math.round((cx + open) / cw) + 1 + Math.round(Math.random() * 2), Math.round(sy / chh), '*+.'[k % 3], 0.6]);
        }
        draw(cells);
    };
    // ?pose=1600 freezes the opening at that moment (for checking the drawing)
    const pose = Number(new URLSearchParams(location.search).get('pose'));
    if (pose) { render(pose); return new Promise(() => {}); }
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const ms = now - t0;
        render(ms);
        if (ms < total) requestAnimationFrame(step);
        else { ctx.clearRect(0, 0, W, H); card.style.clipPath = ''; cv.remove(); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }
  return { open };
})();

/* ==================================== intro ==================================== */
async function gate() {
  const g = $('#gate'), el = $('#gateType'), caret = g.querySelector('.caret');
  await sleep(350);
  await type(el, 'STELLAR', 95, caret);
  g.classList.add('ready');
  return new Promise((resolve) => {
    const go = () => { removeEventListener('keydown', key); g.removeEventListener('click', go); resolve(); };
    const key = (e) => { if (e.key === 'Enter' || e.key === ' ') go(); };
    g.addEventListener('click', go); addEventListener('keydown', key);
  });
}

async function enter() {
  $('#gate').classList.add('out');
  Sound.start();
  const card = $('#card');
  if (reduced) { card.classList.add('in', 'live'); $('#hands').remove(); }
  else {
    await sleep(250);
    await Hands.open(card); // two ASCII hands pull the card open from the middle
    card.classList.remove('opening');
    card.classList.add('in', 'live');
  }
  await sleep(150);
  await type($('#name'), B.name || '', 80, $('#nameCaret'));
  setTimeout(() => $('#nameCaret').remove(), 900);
  $('#handle')?.classList.add('show');
  await sleep(200);
  $('.role').classList.add('show');
  rolesLoop();
  await sleep(450);
  $('#bio')?.classList.add('show');
  const tiles = [...document.querySelectorAll('.tile')], btns = [...document.querySelectorAll('.btn')];
  for (const t of tiles) { t.classList.add('show'); await sleep(70); }
  for (const b of btns) { b.classList.add('show'); await sleep(90); }
  $('.foot').style.opacity = 1;
}

/* ==================================== start ==================================== */
(async function main() {
  document.title = `${B.name || 'Stellar'} ✦ Stellar`;
  $('#avatar').src = B.avatar || 'icon.png';
  $('#avatar').alt = B.name || '';
  if (B.handle) $('#handle').textContent = B.handle; else $('#handle').remove();
  if (B.bio) $('#bio').textContent = B.bio; else $('#bio').remove();
  buildLinks();
  Sound.paint();
  $('#sound').addEventListener('click', () => Sound.toggle());
  tilt();
  const clock = () => { $('#clock').textContent = new Date().toLocaleTimeString('en-GB'); };
  clock(); setInterval(clock, 1000);
  Space.start();
  await gate();
  enter();
})();
