/* Lockpicking mini-game, painted and animated. [OURS] Replaces the plain one in immerse.js (IMM.open / IMM.pick / IMM.lock
   point here once this file loads; with it missing the old game still runs).
   Remigiusz: "Use gpt to create art for minigames, they also should get a graphical and animation overhaul."
   How it plays (Skyrim style):
   - Drag on the lock (or the slider, or ←/→) to angle the pick; the pick points at your finger.
   - Hold Turn (or Space). Near the sweet spot the lock turns far; off it the lock stops and shakes, harder the further
     off you are. Keep forcing and the pick snaps. Turn it all the way and the shackle pops open.
   - The sweet spot is sized from the old roll odds (IMM.sweetWidth: an "average player" opens a lock as often as
     G.lockChance did, same number of picks), so Lockpicking skill, the "<tier> Locks" perks and Quick Hands make it
     easier. Steady Pick (perkfx "lockfeel") widens it again and makes picks last longer. Easy timing widens it too.
   - Painted faces (lock-<face>.webp, tool-lockpick.webp, tool-tension-wrench.webp; GPT art): Nordic for barrows and
     temples, Dwemer for ruins, noble for rich places and master locks, steel for adept/expert, iron otherwise.
     Any missing picture is drawn in code instead.
   - Deterministic: a seed plus a list of small input events [tick, key, a] replays a lock exactly (30 ticks a second),
     like dungeongames.js. Party members watch the leader's lock through DGAMES.mirror (it reads IMM.lock).
   - Settings → Crafting → "When you pick a lock": Mini-game / Quick pick (the old roll). Automated tests keep the
     old roll unless the URL has ?lockgame. */
const LOCKGAME = (() => {
  const DOM = typeof document !== "undefined";
  const params = () => (DOM ? new URLSearchParams(location.search) : new URLSearchParams(""));
  const automated = () => DOM && (navigator.webdriver || params().has("notut"));
  const reduce = () => DOM && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LX = (x) => (typeof I18N_SWEEP !== "undefined" ? I18N_SWEEP.c(x) : x);
  const sfx = (n) => { try { if (typeof SOUND !== "undefined") SOUND.fx(n); } catch { /* sound is optional */ } };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const PREFS = "rotn_prefs";
  const pref = (k, d) => { try { const v = JSON.parse(localStorage.getItem(PREFS) || "{}")[k]; return v === undefined ? d : v; } catch { return d; } };
  const HZ = 30, TICK = 1 / HZ;
  const STRAIN = 0.5;   // seconds of forcing a pick takes before it snaps (same as immerse.js, so its calibration holds)
  const SPEED = 2;      // the lock turns fully in half a second
  const COOL = 15;      // ticks after a snap before a fresh pick is in
  const fall = (w) => 4 + 2.5 * w;   // degrees outside the sweet spot over which the lock still turns a little
  const allowed = (d, w) => (d <= w ? 1 : Math.max(0, 1 - (d - w) / fall(w)));
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const TIERS = ["Novice", "Apprentice", "Adept", "Expert", "Master"];
  const FACES = ["iron", "steel", "nordic", "dwemer", "noble"];
  const wants = () => DOM && (params().has("lockgame") || (!automated() && pref("lockGame", true) !== false));

  // ====================================================================== which lock face
  /* o: { theme (dungeon theme), tier 0..4, rich (a wealthy place) } */
  function faceFor(o = {}) {
    const th = String(o.theme || "").toLowerCase(), tier = o.tier | 0;
    if (/barrow|temple|nord/.test(th)) return "nordic";
    if (/dwemer|dwarven|blackreach/.test(th)) return "dwemer";
    if (o.rich || /thalmor|vampire|noble|manor|palace/.test(th) || tier >= 4) return "noble";
    if (tier >= 2 || /fort/.test(th)) return "steel";
    return "iron";
  }

  // ====================================================================== the rules (pure: no DOM, no Math.random)
  /* perk and setting help, as numbers: lockfeel 0..0.3 (Steady Pick), zone 1..1.4 (Easy timing) */
  const widthMul = (o) => (1 + (o.feel || 0)) * (o.zone || 1);
  const strainMax = (o) => STRAIN * (1 + (5 / 3) * (o.feel || 0));
  /* o: { w (sweet half-width in degrees, before help), picks, unbreakable, feel, zone } */
  function make(seed, o) {
    const r = rng(seed);
    return { seed: seed >>> 0, o: { ...o }, w: o.w * widthMul(o), smax: strainMax(o), spot: 10 + r() * 160, angle: 90, rot: 0, target: 1, strain: 0,
      holding: false, forcing: false, picks: o.picks, broken: 0, unbreakable: !!o.unbreakable, cool: 0, tick: 0, ev: [], over: false, opened: false, snapTick: -99, endTick: -1 };
  }
  /* ev: [tick, "a", angle] move the pick · [tick, "d"] hold Turn · [tick, "u"] let go · [tick, "q"] walk away */
  function input(st, ev) {
    if (st.over) return;
    st.ev.push(ev);
    const k = ev[1];
    if (k === "a") st.angle = clamp(+ev[2] || 0, 0, 180);
    else if (k === "d") { if (st.cool <= 0) st.holding = true; }
    else if (k === "u") st.holding = false;
    else if (k === "q") { st.over = true; st.opened = false; st.endTick = st.tick; st.left = true; }
  }
  function step(st) {
    if (st.over) return;
    st.tick++;
    if (st.cool > 0) st.cool--;
    const target = allowed(Math.abs(st.angle - st.spot), st.w);
    st.target = target;
    if (st.holding) {
      st.rot = Math.min(target, st.rot + SPEED * TICK);
      if (st.rot >= 1) { st.rot = 1; st.over = true; st.opened = true; st.endTick = st.tick; return; }
      st.forcing = st.rot >= target - 1e-3;
      if (st.forcing) {
        st.strain += TICK;
        if (st.strain >= st.smax) {
          if (st.unbreakable) st.strain = st.smax;
          else {
            st.broken++; st.picks--; st.strain = 0; st.rot = 0; st.holding = false; st.forcing = false; st.cool = COOL; st.snapTick = st.tick;
            if (st.picks <= 0) { st.over = true; st.opened = false; st.endTick = st.tick; }
          }
        }
      }
    } else {
      st.forcing = false;
      st.rot = Math.max(0, st.rot - SPEED * 2 * TICK);
    }
  }
  /* run the events up to a tick (the events must be in tick order) */
  function advance(st, evs, toTick) {
    let i = st.ev.length;
    while (st.tick < toTick && !st.over) {
      while (i < evs.length && evs[i][0] <= st.tick) input(st, evs[i++]);
      if (st.over) break;
      step(st);
    }
    while (i < evs.length && evs[i][0] <= st.tick && !st.over) input(st, evs[i++]);
    return st;
  }
  function replay(seed, o, evs, maxTicks = HZ * 600) {
    const st = make(seed, o);
    advance(st, evs, maxTicks);
    return st;
  }
  /* sweet half-width (degrees) for this lock, before the in-game helps: the old roll's odds (immerse.js calibration) */
  function baseWidth(chance, picks, unbreakable) {
    if (typeof IMM !== "undefined" && IMM.sweetWidth) return IMM.sweetWidth(chance, picks, unbreakable);
    return clamp(2 + 40 * chance * chance, 0.3, 90);
  }
  const feelOf = (s) => (s && typeof PFX !== "undefined" ? clamp(+PFX.num(s, "lockfeel") || 0, 0, 0.6) : 0);
  /* everything a lock needs from the save and the old odds */
  function optsFor(s, o) {
    return { w: baseWidth(o.chance, o.picks, o.unbreakable), picks: o.picks, unbreakable: !!o.unbreakable, feel: feelOf(s || o.s),
      zone: typeof A11Y !== "undefined" && A11Y.zoneEase ? A11Y.zoneEase() : 1 };
  }

  // ====================================================================== the screen
  let lp = null;
  /* kind "dungeon" | "event"; run(choice) is dungeonAct or eventAction (same contract as IMM.pick) */
  function pick(kind, run, save) {
    const room = kind === "dungeon" ? save?.dungeon?.room : save?.trip?.event;
    if (!save || !room || room.tries == null) return run("pick");
    const chance = G.lockChance(save, room.tier), unb = G.P(save, "unbreakable");
    const theme = kind === "dungeon" ? save.dungeon?.theme : "";
    const face = faceFor({ theme, tier: room.tier, rich: kind === "dungeon" && /thalmor|vampire/.test(save.dungeon?.theme || "") });
    const title = kind === "dungeon" ? "A locked chest" : room.id === "wreck" ? "The captain's strongbox" : "The chest by the road";
    open({ tier: room.tier, picks: room.tries, chance, unbreakable: unb, skill: G.skill(save, "Lockpicking"), title, face, s: save }, (res) => {
      for (let i = 0; i < res.broken; i++) { save._lockForce = false; run("pick"); }
      if (res.auto) { const r = kind === "dungeon" ? save.dungeon?.room : save.trip?.event; if (!res.broken || (r && r.tries > 0)) run("pick"); return; }
      if (res.opened) { save._lockForce = true; run("pick"); }
    });
  }
  /* o: { tier, picks, chance, unbreakable, skill, title, face?, theme?, s?, seed? }; done({ opened, broken, auto }) */
  function open(o, done) {
    close();
    const seed = o.seed != null ? o.seed >>> 0 : (Math.random() * 2147483647) | 0;
    const st = make(seed, optsFor(o.s, o));
    const face = FACES.includes(o.face) ? o.face : faceFor({ theme: o.theme, tier: o.tier });
    ["lock-" + face, "tool-lockpick", "tool-tension-wrench"].forEach(img);   // ask for the paintings now (drawn in code until they arrive)
    const el = document.createElement("div");
    el.id = "lockpick"; el.className = `lockpick lgame lg-${face}`;
    const help = st.o.feel ? ` · ${LX("Steady Pick")}` : "";
    el.innerHTML = `<div class="lgwrap" role="dialog" aria-label="Lockpicking">
      <div class="lghead"><h3>${esc(o.title || "A locked chest")}</h3><p class="lpsub">${TIERS[o.tier] || "Novice"} lock · Lockpicking ${o.skill ?? ""}${help}</p></div>
      <div class="lgstage"><canvas id="lpc" aria-hidden="true"></canvas><span class="lgpicks" id="lppicks"></span></div>
      <div class="lgfoot">
        <input id="lpang" type="range" min="0" max="180" step="0.5" value="90" aria-label="Pick angle">
        <p class="lphint" id="lphint">Drag on the lock to aim the pick, then hold <b>Turn</b>. If it shakes, let go before the pick snaps.</p>
        <div class="lprow"><button class="btn" id="lpleave">Leave it</button><button class="btn pri" id="lpturn">Hold to turn</button></div>
      </div></div>`;
    document.body.appendChild(el);
    const cv = el.querySelector("#lpc"), turn = el.querySelector("#lpturn"), ang = el.querySelector("#lpang");
    lp = { st, o, face, done, el, cv, ang, acc: 0, last: performance.now(), t0: performance.now(), now: 0, fx: [], disp: 90, seenBroken: 0, insertAt: performance.now(), openAt: 0, finishAt: 0, jolt: 0, creak: 0, bg: null, lastHint: "" };
    const send = (k, a) => { if (!lp || lp.st.over) return; const ev = [lp.st.tick, k]; if (a !== undefined) ev.push(Math.round(a * 2) / 2); input(lp.st, ev); };
    const hold = (v) => (e) => { e.preventDefault(); if (!lp) return; if (v && !lp.st.holding) { send("d"); if (lp.st.holding) sfx("click"); } else if (!v && lp.st.holding) send("u"); };
    turn.addEventListener("pointerdown", hold(true));
    ["pointerup", "pointerleave", "pointercancel"].forEach((n) => turn.addEventListener(n, hold(false)));
    turn.addEventListener("contextmenu", (e) => e.preventDefault());
    ang.addEventListener("input", () => send("a", +ang.value));
    // the canvas: the pick points from the keyhole at your finger
    const aim = (e) => {
      const r = cv.getBoundingClientRect(), L = lp?.lay; if (!L) return;
      const x = e.clientX - r.left - L.kx, y = e.clientY - r.top - L.ky;
      let a = (Math.atan2(y, x) / Math.PI) * 180;   // -180..180, -90 = straight up
      if (a > 0) a = x < 0 ? -180 : 0;              // below the keyhole: lie flat on that side
      const deg = clamp(a + 180, 0, 180);
      send("a", deg); ang.value = String(Math.round(deg * 2) / 2);
    };
    let dragging = false;
    cv.addEventListener("pointerdown", (e) => { e.preventDefault(); dragging = true; cv.setPointerCapture?.(e.pointerId); aim(e); });
    cv.addEventListener("pointermove", (e) => { if (dragging) aim(e); });
    ["pointerup", "pointercancel"].forEach((n) => cv.addEventListener(n, () => { dragging = false; }));
    el.querySelector("#lpleave").onclick = () => { send("q"); };
    lp.key = (e) => {
      if (!lp) return;
      const k = e.key;
      if (k === "Escape") { e.preventDefault(); send("q"); }
      else if (k === "ArrowLeft" || k === "a" || k === "A" || k === "ArrowRight" || k === "d" || k === "D") {
        e.preventDefault(); const dir = k === "ArrowLeft" || k === "a" || k === "A" ? -1 : 1;
        const v = clamp(lp.st.angle + dir * (e.shiftKey ? 5 : 1), 0, 180); send("a", v); ang.value = String(v);
      } else if ((k === " " || k === "ArrowUp" || k === "w" || k === "W" || k === "Enter") && !e.repeat) { e.preventDefault(); if (e.target !== ang || k !== "Enter") hold(true)(e); }
    };
    lp.keyup = (e) => { if (!lp) return; if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === "Enter") { e.preventDefault(); hold(false)(e); } };
    addEventListener("keydown", lp.key, true); addEventListener("keyup", lp.keyup, true);
    const loop = (now) => {
      if (!lp || lp.el !== el) return;
      const dt = Math.min(0.25, (now - lp.last) / 1000); lp.last = now; lp.now = now;
      if (!lp.st.over) {
        lp.acc += dt;
        while (lp.acc >= TICK && !lp.st.over) { lp.acc -= TICK; step(lp.st); }
      }
      react(now, dt);
      draw(cv, now, dt);
      if (lp.finishAt && now >= lp.finishAt) return finish();
      lp.raf = requestAnimationFrame(loop);
    };
    lp.raf = requestAnimationFrame(loop);
    draw(cv, performance.now(), 0);
    return lp;
  }
  /* sound, hints and the animations that follow the rules */
  function react(now, dt) {
    const L = lp, st = L.st, rm = reduce();
    if (st.broken > L.seenBroken) {
      L.seenBroken = st.broken; sfx("clang"); breakFx(now, rm);
      L.insertAt = now + (rm ? 150 : 520); L.jolt = 1;
      const b = DOM && document.querySelector("#lpturn"); if (b) { b.classList.remove("snap"); void b.offsetWidth; b.classList.add("snap"); }
      try { navigator.vibrate?.(60); } catch { /* no vibration */ }
    }
    if (st.forcing && !st.over) { L.creak -= dt; if (L.creak <= 0) { L.creak = 0.26; sfx("click"); } } else L.creak = 0;
    L.jolt = Math.max(0, L.jolt - dt * 4);
    if (st.over && !L.finishAt) {
      if (st.opened) { L.openAt = now; sfx("coin"); openFx(now, rm); L.finishAt = now + (rm ? 350 : 1250); L.el.classList.add("won"); }
      else if (st.left) L.finishAt = now;
      else { L.finishAt = now + (rm ? 300 : 900); L.el.classList.add("out"); }
    }
    // the words under the lock
    let h;
    if (st.over) h = st.opened ? LX("Click. It's open.") : st.left ? "" : LX("Your last pick snaps. The lock wins.");
    else if (now < L.insertAt) h = LX("Snap! The pick breaks.");
    else if (st.forcing) h = st.target > 0.55 ? LX("Close… it gives a little. Ease off and nudge the pick.") : LX("It won't budge. Let go and move the pick.");
    else if (st.holding) h = LX("Turning…");
    else h = "";
    if (h !== L.lastHint) { L.lastHint = h; const e = DOM && document.querySelector("#lphint"); if (e && h) e.textContent = h; }
    const pk = DOM && document.querySelector("#lppicks");
    if (pk) { const txt = st.unbreakable ? LX("Unbreakable pick") : `${LX("Picks")}: ${Math.max(0, st.picks)}`; if (pk.textContent !== txt) pk.textContent = txt; }
    const tb = DOM && document.querySelector("#lpturn"); if (tb) tb.classList.toggle("on", !!st.holding);
  }
  function finish() {
    if (!lp) return;
    const L = lp, st = L.st;
    const out = { opened: !!st.opened, broken: st.broken, auto: false, seed: st.seed, ev: st.ev.slice() };
    close(); L.done(out);
  }
  function close() {
    if (lp) { cancelAnimationFrame(lp.raf); removeEventListener("keydown", lp.key, true); removeEventListener("keyup", lp.keyup, true); }
    if (DOM) document.querySelector("#lockpick")?.remove();
    lp = null;
  }

  // ====================================================================== particles
  function breakFx(now, rm) {
    const L = lp, ly = L.lay; if (!ly) return;
    const phi = Math.PI + (L.disp / 180) * Math.PI, len = ly.pickLen;
    // the handle half flies off, spinning
    const hx = ly.kx + Math.cos(phi) * len * 0.62, hy = ly.ky + Math.sin(phi) * len * 0.62;
    L.fx.push({ kind: "half", x: hx, y: hy, vx: Math.cos(phi) * 90 + (Math.random() - 0.5) * 120, vy: Math.sin(phi) * 60 - 160, rot: phi - Math.PI, vr: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 4), t0: now, life: rm ? 300 : 1100 });
    // the tip stays a moment, then drops out
    L.fx.push({ kind: "tip", x: ly.kx, y: ly.ky, vx: (Math.random() - 0.5) * 40, vy: -30, rot: phi - Math.PI, vr: (Math.random() - 0.5) * 6, t0: now + 180, life: rm ? 200 : 800 });
    if (rm) return;
    const bx = ly.kx + Math.cos(phi) * len * 0.3, by = ly.ky + Math.sin(phi) * len * 0.3;
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 320;
      L.fx.push({ kind: "shard", x: bx, y: by, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, rot: a, vr: (Math.random() - 0.5) * 20, len: 3 + Math.random() * 7, t0: now, life: 450 + Math.random() * 450 });
    }
    for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, v = 200 + Math.random() * 260; L.fx.push({ kind: "spark", x: bx, y: by, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: now, life: 220 + Math.random() * 200 }); }
    L.fx.push({ kind: "flash", x: bx, y: by, t0: now, life: 220 });
  }
  function openFx(now, rm) {
    const L = lp, ly = L.lay; if (!ly) return;
    L.fx.push({ kind: "pop", x: ly.kx, y: ly.ky, t0: now + 120, life: rm ? 300 : 900 });
    if (rm) return;
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6, v = 90 + Math.random() * 260;
      L.fx.push({ kind: "mote", x: ly.kx + (Math.random() - 0.5) * ly.D * 0.15, y: ly.ky, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: now + 120 + Math.random() * 160, life: 700 + Math.random() * 600, r: 1 + Math.random() * 2.2 });
    }
  }

  // ====================================================================== drawing
  const PAL = {   // [dark, mid, light] for the shackle and the drawn fallback face
    iron: ["#3b2c22", "#7a5f49", "#a88b6e"], steel: ["#3a3f45", "#868d94", "#d5dadf"], nordic: ["#2e281f", "#7b6a4f", "#b8a07a"],
    dwemer: ["#4a3517", "#a77d36", "#e5c27a"], noble: ["#26262a", "#5c5b60", "#c9a75c"],
  };
  const img = (k) => (typeof ASSETS !== "undefined" ? ASSETS.img(k) : null);
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  /* top: where the title and the line under it end (CSS px from the canvas top), so the shackle starts below them.
     The shackle reaches ~0.72 D above the centre; the pick stays short enough to end inside the wood. */
  function layout(w, h, top = 0) {
    const avail = Math.max(h * 0.5, h - top);
    const D = Math.min(w * 0.74, avail * 0.62, h * 0.66, 760), cx = w / 2;
    const cy = (h - avail) + D * 0.74 + Math.max(0, avail - D * 1.56) * 0.45;
    const pickLen = Math.min(D * 0.92, Math.max(D * 0.6, (h - 8 - (cy - D * 0.1)) / 0.88));
    return { w, h, D, cx, cy, kx: cx, ky: cy - D * 0.1, pickLen, top };
  }
  /* the bottom of the subtitle over the canvas, in CSS px (0 when the header isn't over it) */
  function headTop(cv) {
    try {
      const wrap = cv.closest(".lgwrap"), sub = wrap && (wrap.querySelector(".lghead .lpsub") || wrap.querySelector(".lghead h3"));
      if (!sub) return 0;
      const zz = (cv.getBoundingClientRect().width / (cv.offsetWidth || 1)) || 1;
      return Math.max(0, (sub.getBoundingClientRect().bottom - cv.getBoundingClientRect().top) / zz + 4);
    } catch { return 0; }
  }
  /* the chest front behind the lock: planks, an iron band, candlelight; drawn once per size */
  function backdrop(w, h, k, face) {
    const top = lp.top || 0, key = `${Math.round(w)}x${Math.round(h)}@${k}|${face}|${Math.round(top)}`;
    if (lp.bg && lp.bg.key === key) return lp.bg.cv;
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext("2d"); g.scale(k, k);
    const r = rng(77), L = layout(w, h, top), D = L.D;
    const dwem = face === "dwemer";
    const wood = dwem ? ["#3a2a17", "#4a3820", "#2c1f10"] : face === "noble" ? ["#3b2114", "#4e2c1a", "#2a170d"] : ["#3c2716", "#4b321c", "#2b1b0e"];
    g.fillStyle = wood[0]; g.fillRect(0, 0, w, h);
    const pw = Math.max(70, D * 0.36), n = Math.ceil(w / pw) + 1, off = (w / 2) % pw - pw / 2;
    for (let i = -1; i < n; i++) {
      const x = off + i * pw, tone = wood[(i + 9) % 3];
      const gr = g.createLinearGradient(x, 0, x + pw, 0); gr.addColorStop(0, wood[2]); gr.addColorStop(0.12, tone); gr.addColorStop(0.85, tone); gr.addColorStop(1, wood[2]);
      g.fillStyle = gr; g.fillRect(x, 0, pw, h);
      g.globalAlpha = 0.18;
      for (let j = 0; j < 16; j++) {   // grain
        const gx = x + 6 + r() * (pw - 12), wob = 4 + r() * 10;
        g.strokeStyle = r() < 0.5 ? "#1a0f07" : "#6b4a2b"; g.lineWidth = 0.6 + r() * 1.4;
        g.beginPath(); g.moveTo(gx, 0);
        for (let y = 0; y <= h; y += 24) g.lineTo(gx + Math.sin(y / (60 + j * 7) + j) * wob * 0.3, y);
        g.stroke();
      }
      if (r() < 0.6) { const ky = r() * h; g.globalAlpha = 0.35; g.fillStyle = "#1c1008"; g.beginPath(); g.ellipse(x + pw * (0.3 + r() * 0.4), ky, 4 + r() * 6, 10 + r() * 16, 0, 0, 7); g.fill(); }
      g.globalAlpha = 1; g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(x - 1.5, 0, 3, h);
    }
    // iron bands across the chest, the lock plate on the middle one
    const band = (y, bh) => {
      const gr = g.createLinearGradient(0, y, 0, y + bh); gr.addColorStop(0, dwem ? "#8a6a33" : "#4d4a47"); gr.addColorStop(0.5, dwem ? "#5d4520" : "#2f2d2b"); gr.addColorStop(1, dwem ? "#3a2a12" : "#1c1b1a");
      g.fillStyle = gr; g.fillRect(0, y, w, bh);
      g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(0, y, w, 1.5);
      for (let x = (w / 2) % (D * 0.42); x < w; x += D * 0.42) { if (Math.abs(x - w / 2) < D * 0.6) continue; rivet(g, x, y + bh / 2, Math.max(3, bh * 0.16)); }
    };
    band(L.cy - D * 0.3, D * 0.6);
    band(Math.max(6, L.cy - D * 1.05), D * 0.12);
    // the hasp plate behind the round lock
    const ph = D * 1.08, pwid = D * 1.04;
    g.save(); g.translate(L.cx, L.cy);
    g.shadowColor = "rgba(0,0,0,.7)"; g.shadowBlur = D * 0.06; g.shadowOffsetY = D * 0.02;
    const pg = g.createLinearGradient(0, -ph / 2, 0, ph / 2); pg.addColorStop(0, dwem ? "#7f612c" : "#45403b"); pg.addColorStop(1, dwem ? "#3e2c12" : "#1f1d1b");
    g.fillStyle = pg; rrect(g, -pwid / 2, -ph / 2, pwid, ph, D * 0.08); g.fill();
    g.shadowColor = "transparent";
    g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 1.5; rrect(g, -pwid / 2 + 3, -ph / 2 + 3, pwid - 6, ph - 6, D * 0.07); g.stroke();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rivet(g, sx * (pwid / 2 - D * 0.07), sy * (ph / 2 - D * 0.07), D * 0.022);
    g.restore();
    // candlelight from the upper left, dark corners
    const lg = g.createRadialGradient(w * 0.25, h * 0.1, 10, w * 0.35, h * 0.3, Math.max(w, h) * 0.9);
    lg.addColorStop(0, "rgba(255,190,110,.22)"); lg.addColorStop(0.5, "rgba(255,160,80,.06)"); lg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    const vg = g.createRadialGradient(L.cx, L.cy, D * 0.4, L.cx, L.cy, Math.max(w, h) * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.78)");
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    lp.bg = { key, cv: c };
    return c;
  }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function rivet(g, x, y, r) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, "#b8b2a8"); gr.addColorStop(0.5, "#5f5a54"); gr.addColorStop(1, "#1d1b19");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  /* the shackle sits behind the lock; on opening it springs up and swings free */
  function shackle(g, L, face, lift, swing) {
    const D = L.D, p = PAL[face] || PAL.iron, lw = D * 0.085, hx = D * 0.27, top = L.cy - D * 0.74 - lift, base = L.cy - D * 0.2;
    g.save();
    if (swing) { g.translate(L.cx + hx, base); g.rotate(-swing); g.translate(-(L.cx + hx), -base); }
    const gr = g.createLinearGradient(L.cx - hx - lw, 0, L.cx + hx + lw, 0);
    gr.addColorStop(0, p[0]); gr.addColorStop(0.18, p[2]); gr.addColorStop(0.35, p[1]); gr.addColorStop(0.65, p[0]); gr.addColorStop(0.82, p[2]); gr.addColorStop(1, p[0]);
    g.lineCap = "butt"; g.lineJoin = "round";
    const path = () => { g.beginPath(); g.moveTo(L.cx - hx, base - (swing ? 0 : lift * 0)); g.lineTo(L.cx - hx, top + hx); g.arc(L.cx, top + hx, hx, Math.PI, 0); g.lineTo(L.cx + hx, base); };
    g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = lw + 4; path(); g.stroke();
    g.strokeStyle = gr; g.lineWidth = lw; path(); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = lw * 0.18; g.beginPath(); g.arc(L.cx, top + hx, hx - lw * 0.22, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
    g.restore();
  }
  /* a lock face drawn in code, for when the painting is missing */
  function drawnFace(g, R, face) {
    const p = PAL[face] || PAL.iron;
    const gr = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
    gr.addColorStop(0, p[2]); gr.addColorStop(0.55, p[1]); gr.addColorStop(1, p[0]);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
    g.strokeStyle = p[0]; g.lineWidth = R * 0.05; g.beginPath(); g.arc(0, 0, R * 0.97, 0, 7); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = R * 0.02; g.beginPath(); g.arc(0, 0, R * 0.8, 0, 7); g.stroke();
    const n = face === "dwemer" ? 8 : face === "steel" ? 8 : 4;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.PI / n; rivet(g, Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88, R * 0.065); }
  }
  function keyhole(g, R) {
    g.fillStyle = "#050404"; g.beginPath(); g.arc(0, -R * 0.2, R * 0.2, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-R * 0.1, -R * 0.1); g.lineTo(R * 0.1, -R * 0.1); g.lineTo(R * 0.17, R * 0.44); g.lineTo(-R * 0.17, R * 0.44); g.closePath(); g.fill();
  }
  function drawPick(g, x, y, phi, len, strain, alpha) {
    const im = img("tool-lockpick");
    g.save(); g.globalAlpha = alpha; g.translate(x, y); g.rotate(phi - Math.PI);
    if (im) {
      const h = len * (im.height / im.width);
      g.drawImage(im, -len, -h * 0.5, len, h);
    } else {
      g.lineCap = "round";
      g.strokeStyle = "#cfd3d6"; g.lineWidth = Math.max(2, len * 0.012); g.beginPath(); g.moveTo(0, -len * 0.012); g.quadraticCurveTo(-len * 0.03, 0, -len * 0.6, 0); g.stroke();
      g.strokeStyle = "#6f7378"; g.lineWidth = Math.max(5, len * 0.05); g.beginPath(); g.moveTo(-len * 0.62, 0); g.lineTo(-len, 0); g.stroke();
    }
    g.restore();
    if (strain > 0.35) {   // the thin end glows hot as it bends
      g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = alpha * clamp((strain - 0.35) / 0.65, 0, 1) * 0.6;
      const gx = x + Math.cos(phi) * len * 0.22, gy = y + Math.sin(phi) * len * 0.22, gr = g.createRadialGradient(gx, gy, 0, gx, gy, len * 0.16);
      gr.addColorStop(0, "rgba(255,120,60,.9)"); gr.addColorStop(1, "rgba(255,80,30,0)"); g.fillStyle = gr; g.beginPath(); g.arc(gx, gy, len * 0.16, 0, 7); g.fill();
      g.restore();
    }
  }
  function drawWrench(g, x, y, ang, len) {
    const im = img("tool-tension-wrench");
    g.save(); g.translate(x, y); g.rotate(ang);
    if (im) { const h = len * (im.height / im.width); g.drawImage(im, -len, -h * 0.22, len, h); }
    else { g.strokeStyle = "#8d9196"; g.lineCap = "round"; g.lineWidth = Math.max(3, len * 0.04); g.beginPath(); g.moveTo(0, len * 0.12); g.lineTo(0, 0); g.lineTo(-len, 0); g.stroke(); }
    g.restore();
  }
  function draw(cv, now, dt) {
    const L = lp; if (!L) return;
    const fit = typeof FITCANVAS !== "undefined" ? FITCANVAS.fill(cv) : (() => { const r = cv.getBoundingClientRect(); cv.width = r.width; cv.height = r.height; return { g: cv.getContext("2d"), w: r.width, h: r.height, k: 1 }; })();
    const { g, w, h, k } = fit, st = L.st, rm = reduce(), t = (now - L.t0) / 1000;
    if (L.topFor !== `${w}x${h}`) { L.topFor = `${w}x${h}`; L.top = headTop(cv); }   // measured once per size
    const ly = layout(w, h, L.top); L.lay = ly;
    const D = ly.D, R = D / 2;
    // the shown pick angle eases after the real one (it never lags more than a frame or two)
    L.disp += (st.angle - L.disp) * clamp(dt * 24, 0, 1);
    if (Math.abs(st.angle - L.disp) < 0.05) L.disp = st.angle;
    // shake: harder the further off the sweet spot, only while forcing
    const off = st.forcing ? 0.3 + 0.7 * (1 - st.target) : 0, sa = rm ? 0 : off * (0.6 + 0.4 * clamp(st.strain / st.smax, 0, 1));
    const n1 = Math.sin(t * 83) + 0.5 * Math.sin(t * 131 + 1.3), n2 = Math.sin(t * 97 + 0.7) + 0.5 * Math.sin(t * 151);
    const jolt = rm ? 0 : L.jolt;
    const sx = (sa * D * 0.012 + jolt * D * 0.02) * n1, sy = (sa * D * 0.008 + jolt * D * 0.012) * n2;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, w, h);
    g.drawImage(backdrop(w, h, k, L.face), 0, 0, w, h);
    g.save(); g.translate(sx, sy);
    // shackle (behind the lock)
    const ot = L.openAt ? (now - L.openAt) / 1000 : 0;
    let lift = 0, swing = 0;
    if (L.openAt) {
      const u = Math.max(0, ot - 0.08);
      lift = rm ? D * 0.12 : D * 0.12 * (1 - Math.exp(-u * 9) * Math.cos(u * 20));
      swing = rm ? 0.2 : clamp((ot - 0.35) / 0.4, 0, 1) * 0.35;
    }
    shackle(g, ly, L.face, lift, easeOut(swing / 0.35) * 0.35);
    // the face turns as one with the wrench, in a dark socket on the hasp plate; the light stays put
    const rotA = st.rot * Math.PI / 2 + (rm ? 0 : sa * 0.03 * n2), face = img("lock-" + L.face);
    g.save(); g.translate(ly.cx, ly.cy);
    g.shadowColor = "rgba(0,0,0,.8)"; g.shadowBlur = D * 0.05; g.shadowOffsetY = D * 0.025;
    g.fillStyle = "#0a0807"; g.beginPath(); g.arc(0, 0, R * 0.985, 0, 7); g.fill();
    g.shadowColor = "transparent";
    g.save(); g.rotate(rotA);
    if (face) g.drawImage(face, -R, -R, D, D); else { drawnFace(g, R, L.face); keyhole(g, R); }
    g.restore();
    const lit = g.createLinearGradient(-R, -R, R, R);
    lit.addColorStop(0, "rgba(255,225,170,.10)"); lit.addColorStop(0.5, "rgba(0,0,0,0)"); lit.addColorStop(1, "rgba(0,0,0,.28)");
    g.fillStyle = lit; g.beginPath(); g.arc(0, 0, R * 0.97, 0, 7); g.fill();
    g.restore();
    // the wrench turns with the cylinder
    const wr = rotA + (st.holding && !rm ? 0.05 : 0);
    const wx = ly.cx - Math.sin(wr) * R * 0.36, wy = ly.cy + Math.cos(wr) * R * 0.36;
    drawWrench(g, wx, wy, Math.PI + 0.95 + wr, D * 0.62);
    // the pick: from the keyhole (which moves with the cylinder) toward the chosen angle
    const kx = ly.cx + Math.sin(rotA) * R * 0.2, ky = ly.cy - Math.cos(rotA) * R * 0.2;
    ly.kx = kx; ly.ky = ky;
    let phi = Math.PI + (L.disp / 180) * Math.PI;
    if (!rm) phi += (st.forcing ? sa * 0.045 * n1 : 0) + (st.holding ? 0 : Math.sin(t * 2.1) * 0.004);   // wiggle under strain, a faint breath at rest
    const ins = now < L.insertAt ? -1 : clamp((now - L.insertAt) / 300, 0, 1);
    const st01 = st.unbreakable ? 0 : clamp(st.strain / st.smax, 0, 1);
    if (ins >= 0 && !(st.over && !st.opened && !st.left)) {
      const pull = (1 - easeOut(ins)) * D * 0.5;
      const bend = st.forcing && !rm ? st01 * 0.03 : 0;
      drawPick(g, kx + Math.cos(phi) * pull, ky + Math.sin(phi) * pull, phi + bend, ly.pickLen, st01, easeOut(ins));
    }
    g.restore();
    // strain ring: a thin arc that fills as the pick bends
    if (!st.unbreakable && st01 > 0.02 && !st.over) {
      g.save(); g.lineCap = "round"; g.lineWidth = Math.max(3, D * 0.012);
      g.strokeStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.arc(ly.cx, ly.cy, R * 1.08, Math.PI * 0.62, Math.PI * 0.62 + Math.PI * 1.76); g.stroke();
      g.strokeStyle = st01 > 0.7 ? "#e0623a" : "#d6a24e"; g.globalAlpha = 0.85;
      g.beginPath(); g.arc(ly.cx, ly.cy, R * 1.08, Math.PI * 0.62, Math.PI * 0.62 + Math.PI * 1.76 * st01); g.stroke();
      g.restore();
    }
    particles(g, now, dt, ly);
  }
  function particles(g, now, dt, ly) {
    const L = lp, keep = [];
    for (const p of L.fx) {
      const age = now - p.t0; if (age > p.life) continue; keep.push(p); if (age < 0) continue;
      const u = age / p.life, s = Math.min(dt, 0.05);
      if (p.kind !== "flash" && p.kind !== "pop") { p.vy += (p.kind === "mote" ? -40 : 900) * s; p.x += p.vx * s; p.y += p.vy * s; p.rot = (p.rot || 0) + (p.vr || 0) * s; if (p.kind === "mote") { p.vx *= 0.97; p.vy *= 0.97; } }
      // broken bits come to rest on the bottom edge of the chest instead of dropping out of the picture
      if ((p.kind === "half" || p.kind === "tip" || p.kind === "shard") && p.y > ly.h - 12) { p.y = ly.h - 12; p.vy = -Math.abs(p.vy) * 0.25; p.vx *= 0.5; p.vr = (p.vr || 0) * 0.4; }
      g.save();
      if (p.kind === "half") {
        const im = img("tool-lockpick"), len = ly.pickLen * 0.62;
        g.globalAlpha = 1 - u * u; g.translate(p.x, p.y); g.rotate(p.rot);
        if (im) { const sw = im.width * 0.62, h = len * im.height / sw; g.drawImage(im, 0, 0, sw, im.height, -len / 2, -h / 2, len, h); }
        else { g.strokeStyle = "#7a7f84"; g.lineWidth = 6; g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, 0); g.stroke(); }
      } else if (p.kind === "tip") {
        const im = img("tool-lockpick"), len = ly.pickLen * 0.3;
        g.globalAlpha = 1 - u; g.translate(p.x, p.y); g.rotate(p.rot);
        if (im) { const sx = im.width * 0.7, sw = im.width * 0.3, h = len * im.height / sw; g.drawImage(im, sx, 0, sw, im.height, -len, -h / 2, len, h); }
        else { g.strokeStyle = "#cfd3d6"; g.lineWidth = 2; g.beginPath(); g.moveTo(-len, 0); g.lineTo(0, 0); g.stroke(); }
      } else if (p.kind === "shard") {
        g.globalAlpha = 1 - u; g.translate(p.x, p.y); g.rotate(p.rot); g.strokeStyle = u < 0.3 ? "#fff2d8" : "#b9bec4"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-p.len / 2, 0); g.lineTo(p.len / 2, 0); g.stroke();
      } else if (p.kind === "spark") {
        g.globalCompositeOperation = "lighter"; g.globalAlpha = 1 - u; g.strokeStyle = "#ffcf7a"; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); g.stroke();
      } else if (p.kind === "flash") {
        g.globalCompositeOperation = "lighter"; const r = ly.D * (0.05 + 0.12 * u), gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gr.addColorStop(0, `rgba(255,245,220,${0.9 * (1 - u)})`); gr.addColorStop(1, "rgba(255,200,120,0)"); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
      } else if (p.kind === "pop") {
        g.globalCompositeOperation = "lighter";
        const r = ly.D * (0.1 + 0.8 * easeOut(u)), a = (1 - u) * (u < 0.15 ? u / 0.15 : 1);
        const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, `rgba(255,236,190,${0.75 * a})`); gr.addColorStop(0.35, `rgba(255,200,110,${0.32 * a})`); gr.addColorStop(1, "rgba(255,170,80,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
        g.translate(p.x, p.y); g.rotate(u * 0.6); g.strokeStyle = `rgba(255,226,160,${0.5 * a})`; g.lineWidth = 2;
        for (let i = 0; i < 12; i++) { const an = (i / 12) * Math.PI * 2, r0 = ly.D * 0.12, r1 = r0 + ly.D * (0.25 + 0.2 * (i % 2)) * easeOut(u); g.beginPath(); g.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); g.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); g.stroke(); }
      } else if (p.kind === "mote") {
        g.globalCompositeOperation = "lighter"; g.globalAlpha = (1 - u) * (u < 0.1 ? u / 0.1 : 1); g.fillStyle = "#ffd98a";
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
      }
      g.restore();
    }
    L.fx = keep;
  }

  // ====================================================================== watchers (party): the leader's lock, small
  /* m: { angle, rot, strain, picks, unb, face } drawn into a W×H box (dungeongames.js watch screen) */
  function drawWatch(g, m, W = 300, H = 200) {
    const face = FACES.includes(m.face) ? m.face : "iron", D = Math.min(W * 0.7, H * 0.8), cx = W / 2, cy = H * 0.55, R = D / 2, im = img("lock-" + face);
    g.fillStyle = "#24170d"; g.fillRect(0, 0, W, H);
    g.save(); g.translate(cx, cy);
    const paint = () => { if (im) g.drawImage(im, -R, -R, D, D); else { drawnFace(g, R, face); keyhole(g, R); } };
    g.rotate((m.rot || 0) * Math.PI / 2); paint();
    g.restore();
    const a = (m.rot || 0) * Math.PI / 2, kx = cx + Math.sin(a) * R * 0.2, ky = cy - Math.cos(a) * R * 0.2;
    drawPick(g, kx, ky, Math.PI + ((m.angle ?? 90) / 180) * Math.PI, D * 0.9, m.unb ? 0 : clamp((m.strain || 0) / STRAIN, 0, 1), 1);
    g.fillStyle = "#e9dcc0"; g.font = "12px sans-serif"; g.textAlign = "left"; g.fillText(LX(m.unb ? "Unbreakable pick" : `Picks left: ${m.picks ?? "?"}`), 10, 18);
  }

  // ====================================================================== plug into immerse.js
  if (typeof IMM !== "undefined") {
    IMM.open = open; IMM.pick = pick; IMM.wantsGame = wants; IMM.close = close;
    try { Object.defineProperty(IMM, "lock", { configurable: true, enumerable: true, get: () => (lp ? Object.assign(lp.st, { face: lp.face }) : null) }); } catch { /* old IMM */ }
  }

  return { HZ, TICK, STRAIN, FACES, TIERS, rng, allowed, make, input, step, advance, replay, faceFor, optsFor, baseWidth, widthMul, strainMax, wants, pick, open, close, drawWatch,
    get live() { return lp; } };
})();
if (typeof module !== "undefined") module.exports = LOCKGAME;
