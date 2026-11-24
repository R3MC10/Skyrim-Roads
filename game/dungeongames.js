/* Dungeon mini-games: the dice rolls in dungeon rooms become short touch games (5-15 seconds). [OURS]
   - Trap: Dash through (hold to run, let go before a blade swings across), Find the trigger (spot the pressure plate and tap it).
   - Chest: Smash it open (tap when the swing meter is in the bright zone).
   - Foe: Sneak past (hold to creep, stop when it turns, rest in the shadows), Run for it (tap left, right, left... to get away).
   - Rest room: Search (rub the dust away to find what's hidden; leave the rustling nest alone).
   Each game is sized from the old dice odds (DUNGEONS.odds): your skills and perks make it easier. The result is a quality
   0..1 that rides on the choice ("dash@0.82"); 0.5 or more is a pass. DUNGEONS.act reads it instead of rolling.
   Every game is deterministic: a seed plus a list of small input events [tick, key, a, b] replays it exactly (30 ticks a second).
   Party play: while the leader plays (these games, the lock and the pillar/claw rings), the seed, the taps and the result go
   to the shared "dgame" collection, and party members in the same dungeon watch the same game live, then read the result.
   Automated tests and simulations keep the old roll unless the URL has ?dgame. */
const DGAMES = (() => {
  const LX = (x) => (typeof I18N_SWEEP !== "undefined" ? I18N_SWEEP.c(x) : x);   // words drawn on canvas, in the player's language
  const DOM = typeof document !== "undefined";
  const params = () => (DOM ? new URLSearchParams(location.search) : new URLSearchParams(""));
  const automated = () => DOM && (navigator.webdriver || params().has("notut"));
  const reduce = () => DOM && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sfx = (n) => { try { if (typeof SOUND !== "undefined") SOUND.fx(n); } catch { /* sound is optional */ } };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const HZ = 30, TICK = 1 / HZ;
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const wants = () => DOM && (params().has("dgame") || !automated());   // always on for players

  const KINDS = ["dash", "trigger", "smash", "sneak", "flee", "search"];
  const PERK = { dash: "dgdash", trigger: "dgspot", smash: "dgsmash", sneak: "dgsneak", flee: "dgflee", search: "dgsearch" };   // perkfx.js keys
  const LIMIT = { dash: 12, trigger: 9, smash: 10, sneak: 14, flee: 6, search: 8 };   // seconds
  const INFO = {
    dash: { title: "Dash through", hint: "Hold <b>Run</b> to move. Let go before a blade swings across your path." },
    trigger: { title: "Find the trigger", hint: "Watch the floor. One stone sits a little low and glints in a steady beat. Tap it." },
    smash: { title: "Smash it open", hint: "Tap <b>Swing</b> when the needle is in the bright zone. Five swings." },
    sneak: { title: "Sneak past", hint: "Hold <b>Creep</b> to move. When the <b>!</b> shows, stop. Wait in the shadows if you can." },
    flee: { title: "Run for it", hint: "Tap <b>Left</b> and <b>Right</b> in turn, fast. The same foot twice trips you up." },
    search: { title: "Search the place", hint: "Rub the dust away with your finger. If something rustles, leave that spot alone." },
  };

  // ====================================================================== the rules (pure: no DOM, no Math.random)
  /* o: { d: 0..1 difficulty (1 - the old odds), ease: 0..0.6 from perks, hl: 1 = a perk shows the answer (Light Foot),
         tm: 1..2 Easy timing (Settings → Accessibility): longer time limits, wider sweet spots, longer warnings } */
  const lim = (st) => LIMIT[st.kind] * (st.tm || 1);   // this game's time limit in seconds
  const R = {
    dash: {
      make(st, r) {
        st.x = 0; st.hold = false; st.hits = 0; st.stun = 0; st.inv = 0; st.hitAt = -99;
        const dz = clamp(0.22 + 0.33 * st.d - 0.15 * st.ease, 0.12, 0.6);   // how much of each swing blocks the path
        st.blades = [0.27, 0.5, 0.73].map((x) => { const P = (1.25 + 0.5 * (1 - st.d) + r() * 0.35) * (1 + 0.5 * st.ease); return { x, P, ph: r() * P, dz }; });
      },
      input(st, ev) { if (ev[1] === "d") st.hold = true; else if (ev[1] === "u") st.hold = false; },
      swing: (b, t) => Math.sin((2 * Math.PI * (t + b.ph)) / b.P),
      step(st) {
        const t = st.tick * TICK;
        if (st.stun > 0) st.stun -= TICK; else if (st.hold) st.x += 0.2 * TICK;
        if (st.inv > 0) st.inv -= TICK;
        for (const b of st.blades) {
          if (st.inv <= 0 && Math.abs(st.x - b.x) < 0.045 && Math.abs(R.dash.swing(b, t)) < b.dz) {
            st.hits++; st.stun = 0.5; st.inv = 1; st.x = Math.max(0, b.x - 0.1); st.hitAt = st.tick;
          }
        }
        if (st.x >= 1) { st.x = 1; end(st, clamp(1 - 0.45 * st.hits, 0, 1)); }
      },
      timeout(st) { end(st, Math.min(0.45, 0.3 * st.x)); },
      say: (st) => (st.q >= 0.5 ? (st.hits ? "Through, with a scratch." : "Clean through!") : st.x >= 1 ? "Through, but cut up." : "Out of time."),
    },
    trigger: {
      make(st, r) {
        st.cols = 5; st.rows = 4; st.plate = Math.floor(r() * 20); st.wrong = 0; st.marks = []; st.maxWrong = 2 + (st.ease >= 0.3 ? 1 : 0);
        st.gp = (1 + 1.4 * st.d) / (1 + st.ease); st.gph = r() * st.gp;
        st.sunk = st.hl ? 0.7 : 0.06 + 0.12 * (1 - st.d) + 0.2 * st.ease;
        const n = Math.round(2 + 7 * st.d), dec = [];
        for (let i = 0; i < n; i++) { let k = Math.floor(r() * 19); if (k >= st.plate) k++; dec.push([k, r() * (lim(st) - 0.4)]); }
        st.decoys = dec; st.foundAt = -1;
      },
      glint(st, i, t) {   // 0..1: how bright a tile glints at time t
        let g = 0;
        if (i === st.plate) { const u = ((t - st.gph) % st.gp + st.gp) % st.gp; if (t >= st.gph && u < 0.3) g = 1 - u / 0.3; }
        for (const [k, at] of st.decoys) if (k === i && t >= at && t < at + 0.3) g = Math.max(g, 0.9 * (1 - (t - at) / 0.3));
        return g;
      },
      input(st, ev) {
        if (ev[1] !== "tap") return;
        const i = ev[2] | 0;
        if (i < 0 || i >= 20 || st.marks.includes(i)) return;
        if (i === st.plate) { st.foundAt = st.tick; const tf = st.tick / (lim(st) * HZ); return end(st, clamp(0.5 + 0.5 * (1 - 0.6 * tf - 0.3 * st.wrong), 0.5, 1)); }
        st.marks.push(i); st.wrong++;
        if (st.wrong > st.maxWrong) end(st, 0.15);
      },
      step() {},
      timeout(st) { end(st, 0.2); },
      say: (st) => (st.q >= 0.5 ? "There it is!" : st.wrong > st.maxWrong ? "Wrong stones. Click." : "Out of time."),
    },
    smash: {
      make(st, r) { st.c = 0.25 + r() * 0.5; st.w = (0.12 - 0.05 * st.d) * (1 + st.ease) * (1 + (st.tm - 1) * 0.8); st.P = 1.6 - 0.5 * st.d; st.ph = r() * 6.283; st.swings = 5; st.pts = 0; st.cd = 0; st.last = null; },
      needle: (st, t) => 0.5 + 0.48 * Math.sin((2 * Math.PI * t) / st.P + st.ph),
      input(st, ev, r) {
        if (ev[1] !== "tap" || st.cd > 0) return;
        const n = R.smash.needle(st, st.tick * TICK), dd = Math.abs(n - st.c), k = dd <= st.w ? 2 : dd <= 1.8 * st.w ? 1 : 0;
        st.pts += k; st.swings--; st.cd = 0.35; st.last = { k, tick: st.tick, n };
        if (k === 2) st.c = 0.2 + r() * 0.6;   // the weak spot moves
        if (st.swings <= 0) end(st, R.smash.q(st));
      },
      q: (st) => (st.pts < 6 ? st.pts / 12 : Math.min(1, 0.5 + (st.pts - 6) / 7.5)),
      step(st) { if (st.cd > 0) st.cd -= TICK; },
      timeout(st) { end(st, R.smash.q(st)); },
      say: (st) => (st.q >= 0.9 ? "Clean blows!" : st.q >= 0.5 ? "It gives way." : "Not enough cracks."),
    },
    sneak: {
      make(st, r) {
        st.x = 0; st.hold = false; st.det = 0;
        const sw = 0.1 - 0.03 * st.d + 0.03 * st.ease;
        st.shade = [0.22, 0.5, 0.78].map((c) => { const m = c + (r() - 0.5) * 0.08; return [m - sw / 2, m + sw / 2]; });
        const ph = []; let t = 0.4 + r() * 0.6;
        while (t < lim(st) + 2) {
          const away = (1.6 + r() * 1.6) * (1.2 - 0.4 * st.d), warn = (0.55 - 0.25 * st.d) * (1 + st.ease) * st.tm, look = 1 + r() * 0.8;
          ph.push(["away", t, t + away]); t += away; ph.push(["warn", t, t + warn]); t += warn; ph.push(["look", t, t + look]); t += look;
        }
        st.phases = ph;
      },
      phase(st, t) { for (const p of st.phases) if (t >= p[1] && t < p[2]) return p[0]; return "away"; },
      input(st, ev) { if (ev[1] === "d") st.hold = true; else if (ev[1] === "u") st.hold = false; },
      step(st) {
        const t = st.tick * TICK, ph = R.sneak.phase(st, t), shade = st.shade.some(([a, b]) => st.x >= a && st.x <= b), k = 1 - st.ease;
        if (ph === "look" && st.hold) st.det += (1.4 + 1.0 * st.d) * k * TICK;
        else if (ph === "look" && !shade) st.det += 0.25 * (0.5 + st.d) * k * TICK;
        else st.det = Math.max(0, st.det - 0.12 * TICK);
        if (st.hold) st.x += 0.17 * TICK;
        if (st.det >= 1) { st.det = 1; return end(st, Math.min(0.45, 0.25 + 0.2 * st.x)); }
        if (st.x >= 1) { st.x = 1; end(st, Math.max(0.5, 1 - 0.5 * st.det)); }
      },
      timeout(st) { end(st, 0.3 * st.x); },
      say: (st) => (st.q >= 0.5 ? "Past it, unseen." : st.det >= 1 ? "Spotted!" : "Too slow: it notices you."),
    },
    flee: {
      make(st) { st.need = Math.max(10, Math.round((22 + 16 * st.d) * (1 - st.ease))); st.prog = 0; st.side = ""; st.stun = 0; st.trip = -99; },
      input(st, ev) {
        const s = ev[1]; if ((s !== "L" && s !== "R") || st.stun > 0) return;
        if (s === st.side) { st.stun = 0.3; st.prog = Math.max(0, st.prog - 1); st.trip = st.tick; }
        else st.prog++;
        st.side = s;
        if (st.prog >= st.need) end(st, Math.max(0.5, 1 - (0.5 * st.tick) / (lim(st) * HZ)));
      },
      step(st) { if (st.stun > 0) st.stun -= TICK; },
      timeout(st) { end(st, 0.45 * st.prog / st.need); },
      say: (st) => (st.q >= 0.5 ? "You got away!" : "It caught up."),
    },
    search: {
      make(st, r) {
        st.W = 16; st.H = 10; st.dust = new Array(160).fill(1); st.rad = st.ease >= 0.3 ? 2 : 1;
        const used = new Set(), spot = () => { for (;;) { const x = 1 + Math.floor(r() * (st.W - 3)), y = 1 + Math.floor(r() * (st.H - 3)); const cells = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]; if (cells.every(([a, b]) => ![-1, 0, 1, 2].some((dx) => [-1, 0, 1, 2].some((dy) => used.has(`${a + dx},${b + dy}`))))) { cells.forEach(([a, b]) => used.add(`${a},${b}`)); return { x, y }; } } };
        st.items = [0, 1, 2].map((i) => ({ ...spot(), kind: ["coin", "coin", "flask"][i], found: false }));
        st.nest = r() < 0.3 + 0.15 * st.d ? spot() : null; st.woke = false;
      },
      cells: (o) => [[o.x, o.y], [o.x + 1, o.y], [o.x, o.y + 1], [o.x + 1, o.y + 1]],
      input(st, ev) {
        if (ev[1] !== "m") return;
        const cx = ev[2] | 0, cy = ev[3] | 0, rad = st.rad;
        for (let dx = -rad; dx <= rad; dx++) for (let dy = -rad; dy <= rad; dy++) {
          const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= st.W || y >= st.H || Math.abs(dx) + Math.abs(dy) > rad + (rad > 1 ? 0 : 1)) continue;
          const i = y * st.W + x; st.dust[i] = Math.max(0, st.dust[i] - 0.34);
        }
        const avg = (o) => R.search.cells(o).reduce((a, [x, y]) => a + st.dust[y * st.W + x], 0) / 4;
        for (const it of st.items) if (!it.found && avg(it) <= 0.35) it.found = true;
        if (st.nest && avg(st.nest) <= 0.5) { st.woke = true; return end(st, R.search.q(st) * 0.6, "n"); }
        if (st.items.every((it) => it.found)) end(st, 1);
      },
      q: (st) => st.items.filter((it) => it.found).length / st.items.length,
      step() {},
      timeout(st) { end(st, R.search.q(st)); },
      say: (st) => (st.woke ? "Something in the nest bites!" : `Found ${st.items.filter((i) => i.found).length} of ${st.items.length}.`),
    },
  };
  function end(st, q, fl = "") { if (st.over) return; st.over = true; st.q = Math.round(clamp(q, 0, 1) * 1000) / 1000; st.fl = fl; st.endTick = st.tick; }
  function make(kind, seed, o = {}) {
    const r = rng(seed);
    const st = { kind, seed, d: clamp(+o.d || 0, 0, 1), ease: clamp(+o.ease || 0, 0, 0.6), hl: o.hl ? 1 : 0, tm: clamp(+o.tm || 1, 1, 2), tick: 0, over: false, q: 0, fl: "", ev: [] };
    Object.defineProperty(st, "r", { value: r, enumerable: false });
    R[kind].make(st, r);
    return st;
  }
  /* ev: [tick, key, a, b]. Applied at the start of its tick (before that tick's step). */
  function input(st, ev) { if (st.over) return; st.ev.push(ev); R[st.kind].input(st, ev, st.r); }
  function step(st) {
    if (st.over) return;
    R[st.kind].step(st);
    if (st.over) return;
    st.tick++;
    if (st.tick >= lim(st) * HZ) { R[st.kind].timeout(st); if (!st.over) end(st, 0); }
  }
  /* advance st to tick `to`, feeding events (sorted by tick) from list starting at index st._ei */
  function advance(st, events, to) {
    st._ei = st._ei || 0;
    while (!st.over && st.tick < to) {
      while (st._ei < events.length && events[st._ei][0] <= st.tick) { input(st, events[st._ei++]); if (st.over) return st; }
      step(st);
    }
    return st;
  }
  function replay(kind, seed, o, events, maxTicks = 1e6) { return advance(make(kind, seed, o), events || [], maxTicks); }
  const choiceOf = (st) => `${st.kind}@${st.q.toFixed(3)}${st.fl || ""}`;
  const say = (st) => R[st.kind].say(st);

  /* how hard a game is for this hero: from the old dice odds, eased by the game's perk */
  function optsFor(s, kind) {
    const ch = typeof DUNGEONS !== "undefined" && DUNGEONS.odds ? DUNGEONS.odds(s, kind) : 0.5;
    const ease = typeof PFX !== "undefined" ? Math.min(0.6, PFX.num(s, PERK[kind]) || 0) : 0;
    const tm = typeof A11Y !== "undefined" && A11Y.timingEase ? Math.round(A11Y.timingEase() * 100) / 100 : 1;   // Easy timing
    return { d: Math.round(clamp(1 - ch, 0.05, 0.95) * 100) / 100, ease: Math.round(ease * 100) / 100, hl: kind === "trigger" && typeof G !== "undefined" && G.P(s, "light_foot") ? 1 : 0, ...(tm > 1 ? { tm } : {}) };
  }
  function handles(s, c) {
    const r = s?.dungeon?.room;
    if (!wants() || !r || !KINDS.includes(c)) return false;
    if (c === "search") return r.type === "rest";
    if (c === "dash" || c === "trigger") return r.type === "trap";
    if (c === "smash") return r.type === "treasure";
    return !!r.enemy && r.type !== "boss";
  }

  // ====================================================================== drawing
  const PAL = {
    ink: { bg: "#1d1a16", floor: "#3b3329", stone: "#4d4335", line: "#100c08", ink: "#e9dcc0", gold: "#d6b25e", red: "#c4572e", shade: "rgba(0,0,0,.55)", hero: "#d9c9a3", foe: "#8a3a2a" },
  };
  /* canvas: 300×200 logical */
  function prep(cv) {
    const w = 300, h = 200;
    if (cv.width !== w) { cv.width = w; cv.height = h; }
    const g = cv.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true;
    return { g, C: PAL.ink };
  }
  function figure(g, C, x, y, s, col) {   // a little hooded figure (hero or foe)
    g.fillStyle = col; g.strokeStyle = C.line; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x - 7 * s, y); g.quadraticCurveTo(x - 6 * s, y - 20 * s, x, y - 24 * s); g.quadraticCurveTo(x + 6 * s, y - 20 * s, x + 7 * s, y); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(x, y - 27 * s, 5 * s, 0, 7); g.fill(); g.stroke();
  }
  function frame(g, C) {
    g.fillStyle = C.bg; g.fillRect(0, 0, 300, 200);
    { const v = g.createRadialGradient(150, 100, 40, 150, 100, 190); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.55)"); g.fillStyle = v; g.fillRect(0, 0, 300, 200); }
  }
  function timebar(g, C, st) {
    const left = 1 - st.tick / (lim(st) * HZ);
    g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(10, 192, 280, 4); g.fillStyle = left < 0.25 ? C.red : C.gold; g.fillRect(10, 192, 280 * clamp(left, 0, 1), 4);
  }
  const D = {
    dash(g, st, C) {
      const t = st.tick * TICK;
      g.fillStyle = C.floor; g.fillRect(0, 110, 300, 60);
      g.strokeStyle = C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 110); g.lineTo(300, 110); g.moveTo(0, 170); g.lineTo(300, 170); g.stroke();
      for (let i = 0; i < 12; i++) { g.fillStyle = C.stone; g.fillRect(i * 26 + 2, 172, 22, 10); }
      g.fillStyle = C.gold; g.fillRect(284, 112, 12, 56);   // the far side
      for (const b of st.blades) {
        const a = R.dash.swing(b, t), bx = 14 + b.x * 272, ang = a * 1.25, L = 92;
        const danger = Math.abs(a) < b.dz;
        g.strokeStyle = C.line; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, 6); g.lineTo(bx + Math.sin(ang) * L, 6 + Math.cos(ang) * L); g.stroke();
        g.save(); g.translate(bx + Math.sin(ang) * L, 6 + Math.cos(ang) * L); g.rotate(-ang);
        g.fillStyle = danger ? C.red : "#b9c0c6"; g.strokeStyle = C.line; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-22, 0); g.quadraticCurveTo(0, 30, 22, 0); g.closePath(); g.fill(); g.stroke(); g.restore();
        g.fillStyle = C.line; g.fillRect(bx - 4, 2, 8, 6);
      }
      const hx = 14 + st.x * 272, hit = st.tick - st.hitAt < 12;
      figure(g, C, hx, 160, 1, hit && st.tick % 4 < 2 ? C.red : C.hero);
      timebar(g, C, st);
      g.fillStyle = C.ink; g.font = "12px sans-serif"; g.fillText(LX(`Hits ${st.hits}`), 10, 18);
    },
    trigger(g, st, C) {
      const t = st.tick * TICK, tw = 52, th = 40, ox = 20, oy = 22;
      for (let i = 0; i < 20; i++) {
        const cx = i % 5, cy = Math.floor(i / 5), x = ox + cx * (tw + 2), y = oy + cy * (th + 2);
        g.fillStyle = C.stone; g.fillRect(x, y, tw, th);
        g.strokeStyle = C.line; g.lineWidth = 1.2; g.strokeRect(x, y, tw, th);
        { g.strokeStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.moveTo(x + 8 + (i * 7) % 20, y + 4); g.lineTo(x + 14 + (i * 11) % 24, y + th - 6); g.stroke(); }
        if (i === st.plate) { g.fillStyle = `rgba(0,0,0,${st.sunk})`; g.fillRect(x + 2, y + 2, tw - 4, 4); g.fillRect(x + 2, y + 2, 4, th - 4); if (st.hl) { g.strokeStyle = C.gold; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, tw - 6, th - 6); } }
        const gl = R.trigger.glint(st, i, t);
        if (gl > 0) { g.fillStyle = `rgba(255,236,170,${0.55 * gl})`; g.beginPath(); g.arc(x + tw / 2, y + th / 2, 6 + 8 * gl, 0, 7); g.fill(); }
        if (st.marks.includes(i)) { g.strokeStyle = C.red; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 12, y + 8); g.lineTo(x + tw - 12, y + th - 8); g.moveTo(x + tw - 12, y + 8); g.lineTo(x + 12, y + th - 8); g.stroke(); }
        if (st.foundAt >= 0 && i === st.plate) { g.strokeStyle = C.gold; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, tw - 4, th - 4); }
      }
      timebar(g, C, st);
      g.fillStyle = C.ink; g.font = "12px sans-serif"; g.fillText(LX(`Wrong guesses left: ${Math.max(0, st.maxWrong - st.wrong)}`), 20, 14);
    },
    smash(g, st, C) {
      const t = st.tick * TICK;
      // the chest
      g.fillStyle = "#5a3a22"; g.strokeStyle = C.line; g.lineWidth = 2; g.fillRect(100, 40, 100, 60); g.strokeRect(100, 40, 100, 60);
      g.fillStyle = "#6b4a2c"; g.fillRect(96, 28, 108, 18); g.strokeRect(96, 28, 108, 18);
      g.fillStyle = C.gold; g.fillRect(144, 52, 12, 14);
      g.strokeStyle = "#140c06"; g.lineWidth = 2;
      for (let i = 0; i < Math.min(10, st.pts); i++) { const a = 104 + ((i * 37) % 90), b = 44 + ((i * 23) % 50); g.beginPath(); g.moveTo(a, b); g.lineTo(a + 10, b + 8); g.lineTo(a + 4, b + 16); g.stroke(); }
      // the meter
      const mx = 20, my = 128, mw = 260;
      g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(mx, my, mw, 22);
      g.fillStyle = "rgba(214,178,94,.35)"; g.fillRect(mx + (st.c - 1.8 * st.w) * mw, my, 3.6 * st.w * mw, 22);
      g.fillStyle = C.gold; g.fillRect(mx + (st.c - st.w) * mw, my, 2 * st.w * mw, 22);
      g.strokeStyle = C.line; g.lineWidth = 2; g.strokeRect(mx, my, mw, 22);
      const n = R.smash.needle(st, t);
      g.fillStyle = C.ink; g.fillRect(mx + n * mw - 2, my - 6, 4, 34);
      if (st.last && st.tick - st.last.tick < 15) { g.fillStyle = st.last.k === 2 ? C.gold : st.last.k ? C.ink : C.red; g.font = "bold 16px sans-serif"; g.textAlign = "center"; g.fillText(LX(st.last.k === 2 ? "CRACK!" : st.last.k ? "thud" : "clang"), 150, 120); g.textAlign = "left"; }
      g.fillStyle = C.ink; g.font = "12px sans-serif"; g.fillText(LX(`Swings left ${st.swings}`), 10, 18);
      timebar(g, C, st);
    },
    sneak(g, st, C) {
      const t = st.tick * TICK, ph = R.sneak.phase(st, t);
      g.fillStyle = C.floor; g.fillRect(0, 120, 300, 50);
      g.fillStyle = "rgba(255,210,140,.10)"; g.fillRect(0, 120, 300, 50);
      for (const [a, b] of st.shade) { g.fillStyle = C.shade; g.fillRect(14 + a * 272, 112, (b - a) * 272, 62); }
      // the foe on a ledge, facing away or at you
      g.fillStyle = C.stone; g.fillRect(200, 60, 90, 10);
      figure(g, C, 245, 60, 1.1, C.foe);
      if (ph === "look") { g.fillStyle = "rgba(255,230,160,.16)"; g.beginPath(); g.moveTo(240, 40); g.lineTo(0, 120); g.lineTo(0, 175); g.lineTo(240, 52); g.fill(); g.fillStyle = C.gold; g.fillRect(240, 30, 3, 3); g.fillRect(248, 30, 3, 3); }
      if (ph === "warn") { g.fillStyle = C.red; g.font = "bold 26px sans-serif"; g.fillText("!", 240, 22); }
      const hx = 14 + st.x * 272; figure(g, C, hx, 162, st.hold ? 0.8 : 0.7, C.hero);
      // detection meter
      g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(10, 8, 120, 8); g.fillStyle = st.det > 0.6 ? C.red : C.gold; g.fillRect(10, 8, 120 * st.det, 8);
      g.fillStyle = C.ink; g.font = "11px sans-serif"; g.fillText(LX("Noticed"), 136, 16);
      timebar(g, C, st);
    },
    flee(g, st, C) {
      const t = st.tick * TICK, p = st.prog / st.need;
      g.fillStyle = C.floor; g.fillRect(0, 120, 300, 50);
      const off = (p * 600) % 40;
      for (let i = -1; i < 9; i++) { g.fillStyle = C.stone; g.fillRect(i * 40 - off, 172, 30, 8); }
      g.fillStyle = C.gold; g.fillRect(280, 100, 14, 70);
      const hx = 40 + p * 230, fx = Math.min(hx - 18, 10 + (t / lim(st)) * 260 * 0.95);
      figure(g, C, fx, 165, 1.15, C.foe);
      figure(g, C, hx, 162, 1, st.tick - st.trip < 9 ? C.red : C.hero);
      g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(10, 8, 280, 8); g.fillStyle = C.gold; g.fillRect(10, 8, 280 * p, 8);
      g.fillStyle = C.ink; g.font = "bold 14px sans-serif"; g.textAlign = "center"; g.fillText(LX(st.side ? (st.side === "L" ? "Now: Right" : "Now: Left") : "Left or Right"), 150, 60); g.textAlign = "left";
      timebar(g, C, st);
    },
    search(g, st, C) {
      const t = st.tick * TICK, cw = 280 / st.W, ch = 170 / st.H, ox = 10, oy = 14;
      g.fillStyle = C.floor; g.fillRect(ox, oy, 280, 170);
      for (const it of st.items) {
        const x = ox + (it.x + 1) * cw, y = oy + (it.y + 1) * ch;
        if (it.kind === "coin") { g.fillStyle = C.gold; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.strokeStyle = C.line; g.lineWidth = 1.5; g.stroke(); }
        else { g.fillStyle = "#b03030"; g.fillRect(x - 5, y - 8, 10, 14); g.fillStyle = "#ddd"; g.fillRect(x - 2, y - 12, 4, 4); }
        if (it.found) { g.strokeStyle = C.gold; g.lineWidth = 2; g.strokeRect(x - 13, y - 13, 26, 26); }
      }
      if (st.nest) { const x = ox + (st.nest.x + 1) * cw, y = oy + (st.nest.y + 1) * ch; g.fillStyle = "#3a2a1c"; g.beginPath(); g.ellipse(x, y, 16, 10, 0, 0, 7); g.fill(); if (st.woke) { g.fillStyle = C.red; g.fillRect(x - 3, y - 3, 6, 6); } }
      const rustle = st.nest && !st.woke && (t % 1.3) < 0.25;
      for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) {
        const v = st.dust[y * st.W + x]; if (v <= 0) continue;
        let jx = 0, jy = 0;
        if (rustle && Math.abs(x - st.nest.x - 0.5) <= 1.5 && Math.abs(y - st.nest.y - 0.5) <= 1.5) { jx = ((st.tick * 7 + x * 13) % 5) - 2; jy = ((st.tick * 5 + y * 11) % 3) - 1; }
        g.fillStyle = `rgba(128,116,98,${0.3 + 0.68 * v})`;
        g.fillRect(ox + x * cw + jx, oy + y * ch + jy, cw + 0.5, ch + 0.5);
      }
      g.fillStyle = C.ink; g.font = "12px sans-serif"; g.fillText(LX(`Found ${st.items.filter((i) => i.found).length}/${st.items.length}`), 10, 11);
      timebar(g, C, st);
    },
    // ---- mirrors of the other mini-games (watch-only)
    lock(g, m, C) {
      const cx = 150, cy = 100;
      g.fillStyle = "#6b5530"; g.beginPath(); g.arc(cx, cy, 70, 0, 7); g.fill(); g.strokeStyle = C.gold; g.lineWidth = 3; g.stroke();
      g.save(); g.translate(cx, cy); g.rotate((m.rot || 0) * Math.PI / 2); g.fillStyle = "#8a7448"; g.beginPath(); g.arc(0, 0, 42, 0, 7); g.fill(); g.fillStyle = "#120e09"; g.fillRect(-4, -12, 8, 24); g.restore();
      const phi = Math.PI + ((m.angle || 90) / 180) * Math.PI;
      g.strokeStyle = "#d9dde0"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy - 6); g.lineTo(cx + Math.cos(phi) * 100, cy + Math.sin(phi) * 100); g.stroke();
      g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(20, 186, 260, 5); g.fillStyle = C.red; g.fillRect(20, 186, 260 * clamp((m.strain || 0) / 0.5, 0, 1), 5);
      g.fillStyle = C.ink; g.font = "12px sans-serif"; g.fillText(LX(m.unb ? "Unbreakable pick" : `Picks left: ${m.picks ?? "?"}`), 10, 18);
    },
    ring(g, m, C) {
      const rings = m.rings || [], n = rings.length || 3;
      rings.forEach((ring, i) => {
        const x = 300 / (n + 1) * (i + 1), y = 100, tok = ring[(m.idx || [])[i] || 0] || "?";
        g.fillStyle = C.stone; g.strokeStyle = C.gold; g.lineWidth = 3;
        g.beginPath(); g.arc(x, y, 38, 0, 7); g.fill(); g.stroke();
        g.fillStyle = C.ink; g.font = "28px sans-serif"; g.textAlign = "center"; g.fillText((typeof EXPLORE !== "undefined" && EXPLORE.SYM?.[tok]) || "◆", x, y + 6); g.font = "12px sans-serif"; g.fillText(tok, x, y + 54); g.textAlign = "left";
      });
    },
  };
  function draw(cv, st) { const { g, C } = prep(cv); frame(g, C); D[st.kind](g, st, C); }
  function drawMirror(cv, kind, m) { const { g, C } = prep(cv); frame(g, C); D[kind](g, m || {}, C); }

  // ====================================================================== streaming to the party ("dgame" collection)
  let ctx = null, out = null, mirrorT = null;
  const me = () => ctx?.S?.();
  function streaming() {
    const s = me(), p = ctx?.party?.();
    return !!(ctx && ctx.Store?.online && s?.dungeon && p && p.leader === s.id && (p.members || []).length > 1);
  }
  function streamStart(base) {
    out = null;
    if (!streaming()) return;
    const s = me();
    out = { id: "dg-" + s.id, last: 0, doc: { ...base, gid: `${s.id.slice(-6)}-${Date.now().toString(36)}`, by: s.id, byName: s.name, place: s.dungeon.place, run: s.dungeon.run || null, at: Date.now(), tick: 0, ev: [], done: false, text: "" } };
    push(true);
  }
  function push(force) {
    if (!out || !ctx) return;
    const now = Date.now();
    if (!force && now - out.last < 300) return;
    out.last = now; out.doc.at = now;
    try { ctx.Store.put("dgame", out.id, { ...out.doc, ev: out.doc.ev.slice() }); } catch (e) { console.warn(e); }
  }
  /* the leader's room result: shown to the watchers under the game */
  function result(r) {
    if (!out || !r) return;
    if (!out.doc.done && !out.doc.mirror) return;
    out.doc.text = String(r.text || "").slice(0, 400); out.doc.died = !!r.died;
    push(true);
    if (!out.doc.mirror) out = null;
  }
  /* lockpicking (IMM.lock) and the pillar/claw rings (EXPLORE.game): send what's on screen a few times a second */
  function mirror(kind) {
    clearInterval(mirrorT);
    streamStart({ kind, mirror: true, m: null, title: kind === "lock" ? "Picking the lock" : "The rings" });
    if (!out) return;
    let gone = 0;
    mirrorT = setInterval(() => {
      if (!out) return clearInterval(mirrorT);
      let m = null;
      if (kind === "lock" && typeof IMM !== "undefined" && IMM.lock) { const L = IMM.lock; m = { angle: Math.round(L.angle), rot: Math.round(L.rot * 100) / 100, strain: Math.round(L.strain * 100) / 100, picks: L.picks, unb: !!L.unbreakable }; }
      if (kind === "ring" && typeof EXPLORE !== "undefined" && EXPLORE.game) { const x = EXPLORE.game; m = { rings: x.rings, idx: x.idx.slice(), claw: !!x.claw }; }
      if (m) { gone = 0; out.doc.m = m; push(); return; }
      if (++gone >= 2) { out.doc.done = true; push(true); clearInterval(mirrorT); setTimeout(() => { if (out?.doc.mirror) out = null; }, 4000); }
    }, 200);
  }

  // ====================================================================== the leader's game screen
  let live = null;
  function play(s, c, run) {
    close();
    const o = optsFor(s, c), seed = (Math.random() * 2147483647) | 0, st = make(c, seed, o);
    streamStart({ kind: c, seed, o, title: INFO[c].title });
    const el = document.createElement("div");
    el.id = "dgame"; el.className = "lockpick dgame";
    const ctrls = c === "flee" ? `<button class="btn pri dgk" data-k="L">Left</button><button class="btn pri dgk" data-k="R">Right</button>`
      : c === "dash" || c === "sneak" ? `<button class="btn pri dgk" data-k="hold">${c === "dash" ? "Hold to run" : "Hold to creep"}</button>`
      : c === "smash" ? `<button class="btn pri dgk" data-k="tap">Swing!</button>` : "";
    el.innerHTML = `<div class="lpcard" role="dialog" aria-label="${esc(INFO[c].title)}">
      <h3>${esc(INFO[c].title)}</h3><p class="lpsub">${esc(sub(s, c, o))}</p>
      <canvas id="dgc" width="300" height="200" aria-hidden="true"></canvas>
      <p class="lphint" id="dghint">${INFO[c].hint}</p>
      ${ctrls ? `<div class="lprow dgrow">${ctrls}</div>` : ""}${out ? '<p class="dglive">👁 Your party is watching</p>' : ""}</div>`;
    document.body.appendChild(el);
    const cv = el.querySelector("#dgc");
    live = { st, run, c, el, cv, over: false, acc: 0, last: performance.now(), lastCell: null, down: false };
    const send = (k, a, b) => { if (!live || live.st.over) return; const ev = [live.st.tick, k]; if (a !== undefined) ev.push(a); if (b !== undefined) ev.push(b); input(live.st, ev); if (out) { out.doc.ev = live.st.ev; } };
    const cell = (e) => { const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 300, y = ((e.clientY - r.top) / r.height) * 200; return [x, y]; };
    const holdKey = c === "dash" || c === "sneak";
    // buttons
    el.querySelectorAll(".dgk").forEach((b) => {
      const k = b.dataset.k;
      if (k === "hold") {
        b.addEventListener("pointerdown", (e) => { e.preventDefault(); send("d"); });
        ["pointerup", "pointerleave", "pointercancel"].forEach((n) => b.addEventListener(n, (e) => { e.preventDefault(); if (live?.st.hold) send("u"); }));
      } else b.addEventListener("pointerdown", (e) => { e.preventDefault(); sfx("click"); send(k); });
    });
    // the canvas: holding works there too; taps pick stones; dragging brushes dust
    cv.addEventListener("pointerdown", (e) => {
      e.preventDefault(); cv.setPointerCapture?.(e.pointerId); live && (live.down = true);
      const [x, y] = cell(e);
      if (holdKey) send("d");
      else if (c === "smash") send("tap");
      else if (c === "trigger") { const cx = Math.floor((x - 20) / 54), cy = Math.floor((y - 22) / 42); if (cx >= 0 && cx < 5 && cy >= 0 && cy < 4) send("tap", cy * 5 + cx); }
      else if (c === "search") brush(x, y);
      else if (c === "flee") send(x < 150 ? "L" : "R");
    });
    const brush = (x, y) => { const cx = clamp(Math.floor((x - 10) / (280 / 16)), 0, 15), cy = clamp(Math.floor((y - 14) / 17), 0, 9), key = cx + "," + cy; if (key !== live.lastCell) { live.lastCell = key; send("m", cx, cy); } };
    cv.addEventListener("pointermove", (e) => { if (!live?.down || c !== "search") return; const [x, y] = cell(e); brush(x, y); });
    ["pointerup", "pointercancel"].forEach((n) => cv.addEventListener(n, () => { if (!live) return; live.down = false; live.lastCell = null; if (holdKey && live.st.hold) send("u"); }));
    live.key = (e) => {
      if (!live) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (e.repeat) return; if (holdKey) send("d"); else if (c === "smash") send("tap"); }
      if (c === "flee" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); if (!e.repeat) send(e.key === "ArrowLeft" ? "L" : "R"); }
    };
    live.keyup = (e) => { if (live && holdKey && (e.key === " " || e.key === "Enter") && live.st.hold) send("u"); };
    addEventListener("keydown", live.key, true); addEventListener("keyup", live.keyup, true);
    const loop = (now) => {
      if (!live || live.over) return;
      live.acc += Math.min(0.1, (now - live.last) / 1000); live.last = now;
      while (live.acc >= TICK && !live.st.over) { step(live.st); live.acc -= TICK; }
      draw(cv, live.st);
      if (out) { out.doc.tick = live.st.tick; push(); }
      if (live.st.over) return finish();
      live.raf = requestAnimationFrame(loop);
    };
    draw(cv, st);
    live.raf = requestAnimationFrame(loop);
  }
  function sub(s, c, o) {
    const sk = { dash: "Acrobatics", trigger: "Sneak", smash: "Two-Handed", sneak: "Sneak", flee: "Athletics", search: "" }[c];
    const lvl = sk && typeof G !== "undefined" ? ` ${sk} ${Math.round(G.skill(s, sk))}` : "";
    const how = o.d < 0.3 ? "easy" : o.d < 0.55 ? "tricky" : o.d < 0.75 ? "hard" : "very hard";
    return `${lvl ? lvl.trim() + " · " : ""}${how}${o.ease ? " · perks help" : ""}`;
  }
  function finish() {
    const L = live; if (!L || L.over) return;
    L.over = true; cancelAnimationFrame(L.raf);
    const st = L.st, pass = st.q >= 0.5;
    sfx(pass ? "coin" : "clang");
    if (out) { out.doc.tick = st.tick; out.doc.ev = st.ev; out.doc.done = true; out.doc.q = st.q; out.doc.fl = st.fl; out.doc.endTick = st.tick; push(true); }
    const h = L.el.querySelector("#dghint"); if (h) h.innerHTML = `<b class="${pass ? "dgok" : "dgbad"}">${esc(say(st))}</b>`;
    L.el.querySelector(".lpcard")?.classList.add(pass ? "dgwin" : "dglose");
    setTimeout(() => { close(); L.run(choiceOf(st)); }, reduce() ? 300 : 900);
  }
  function close() {
    if (live) { cancelAnimationFrame(live.raf); removeEventListener("keydown", live.key, true); removeEventListener("keyup", live.keyup, true); }
    document.querySelector("#dgame")?.remove(); live = null;
  }

  // ====================================================================== the members' watch view
  let watch = null; const hidden = new Set();
  function onDocs(docs) {
    const s = me(), p = ctx?.party?.();
    if (!s?.dungeon || !p || p.leader === s.id) { if (watch && !s?.dungeon) closeWatch(); return; }
    const doc = (docs || []).filter((d) => d && d.by === p.leader && d.place === s.dungeon.place && (!d.run || !s.dungeon.run || d.run === s.dungeon.run) && Date.now() - (d.at || 0) < 90e3).sort((a, b) => b.at - a.at)[0];
    if (!doc || hidden.has(doc.gid)) return;
    if (watch && watch.gid === doc.gid) { watch.doc = doc; return; }
    if (doc.done && (doc.text || Date.now() - doc.at > 15e3)) return;   // came in late: nothing to watch
    openWatch(doc);
  }
  function openWatch(doc) {
    closeWatch();
    if (!DOM) return;
    const el = document.createElement("div");
    el.id = "dgwatch"; el.className = "lockpick dgame dgwatch";
    el.innerHTML = `<div class="lpcard" role="dialog" aria-label="Watching the leader">
      <h3>👁 ${esc(doc.byName || "The leader")}</h3><p class="lpsub">${esc(doc.title || INFO[doc.kind]?.title || "")} · watching</p>
      <canvas id="dgwc" width="300" height="200" aria-hidden="true"></canvas>
      <p class="lphint" id="dgwtxt">${esc(doc.byName || "The leader")} is playing. What happens, happens to you too.</p>
      <div class="lprow"><button class="btn" id="dgwhide">Hide</button></div></div>`;
    document.body.appendChild(el);
    el.querySelector("#dgwhide").onclick = () => { hidden.add(watch?.gid); closeWatch(); };
    watch = { gid: doc.gid, doc, el, cv: el.querySelector("#dgwc"), st: doc.mirror ? null : make(doc.kind, doc.seed, doc.o || {}), last: performance.now(), acc: 0, shown: false, closeAt: 0 };
    const loop = (now) => {
      const W = watch; if (!W || W.el !== el) return;
      const dt = Math.min(0.25, (now - W.last) / 1000); W.last = now;
      const d = W.doc;
      if (W.st) {
        const known = d.done ? d.endTick + 1 : d.tick || 0, behind = known - W.st.tick;
        W.acc += dt * (behind > 45 ? 2.5 : behind > 15 ? 1.4 : 1);
        let n = Math.floor(W.acc / TICK); W.acc -= n * TICK;
        if (behind > HZ * 4) n = behind - HZ;   // far behind (joined late): jump ahead
        advance(W.st, d.ev || [], Math.min(known, W.st.tick + n));
        if (!W.st.over && d.done && W.st.tick > d.endTick) { W.st.over = true; W.st.q = d.q; W.st.fl = d.fl || ""; }
        draw(W.cv, W.st);
      } else drawMirror(W.cv, d.kind, d.m);
      const over = W.st ? W.st.over : d.done;
      if (over) {
        const t = el.querySelector("#dgwtxt");
        const head = W.st ? `<b class="${(d.q ?? W.st.q) >= 0.5 ? "dgok" : "dgbad"}">${esc(say(W.st))}</b> ` : "";
        const html = head + (d.text ? esc(d.text) : `<span class="dgwait">Waiting for what happens…</span>`);
        if (t && t.innerHTML !== html) t.innerHTML = html;
        if (!W.shown) { W.shown = true; const b = el.querySelector("#dgwhide"); if (b) { b.textContent = "Continue"; b.classList.add("pri"); } }
        if (d.text && !W.closeAt) W.closeAt = now + 9000;
        if (W.closeAt && now > W.closeAt) return closeWatch();
      }
      W.raf = requestAnimationFrame(loop);
    };
    watch.raf = requestAnimationFrame(loop);
  }
  function closeWatch() { if (watch) cancelAnimationFrame(watch.raf); document.querySelector("#dgwatch")?.remove(); watch = null; }

  /* ctx: { S(), party(), Store } */
  function mount(c) { ctx = c; if (c?.Store?.watch) c.Store.watch("dgame", onDocs); }

  return { HZ, TICK, KINDS, PERK, LIMIT, INFO, rng, make, input, step, advance, replay, choiceOf, say, optsFor, handles, wants, play, close, mirror, result, mount, onDocs, closeWatch, draw, drawMirror,
    get live() { return live; }, get watching() { return watch; } };
})();
if (typeof module !== "undefined") module.exports = DGAMES;
