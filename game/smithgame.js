/* smithgame.js: the forging mini-game for weapons and armor at the forge. [OURS]
   Remigiusz: "Use gpt to create art for minigames, they also should get a graphical and animation overhaul."
   It replaces the old three-strike hammer bar (craftgames.js "hammer") with a small scene at a painted forge:
     1. Heat:    hold to pump the bellows. Keep the bar's glow inside the gold band of the heat strip.
     2. Hammer:  glowing spots light up along the blade. Tap each one as its shrinking ring meets it. Sparks fly, the
                 blade rings, and it changes shape: bar → rough blade → shaped blade. The metal cools while you work:
                 hot metal takes the blow best, so Reheat when the glow fades (two things to balance: aim and heat).
     3. Quench:  the blade cools over the water barrel. Dip it when its glow reaches the cherry-red band: steam bursts up.
   The result (quality 0..1) becomes the usual crafting grade (craftgames.js), so the bonus is the same small, capped,
   fading temper bonus as before. Great forging also has a small chance to save one piece of the main material
   (never more than one, never above 20%); the forge still uses up everything else.
   "Quick craft" (and the Settings switch shared with the other crafting games) skips it for the plain, average result.
   Perk: Forge Sense (Smithing, perkfx.js) widens the gold bands, slows the cooling and the rings, and saves material
   a little more often. Timing uses elapsed time, never frame counts, so slow phones are fair.
   Art (GPT, painted): mg-smithing-bg, mg-smith-blade1..4, mg-smith-hammer, mg-smith-tongs. Every picture has a drawn
   fallback. Screen tests skip the game unless the page has ?craftgame (like the other crafting games). */
const SMITHGAME = (() => {
  const DOM = typeof document !== "undefined";
  const LX = (x) => (typeof I18N_SWEEP !== "undefined" ? I18N_SWEEP.c(x) : x);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIn = (t) => t * t, easeOut = (t) => 1 - (1 - t) * (1 - t);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const sfx = (n) => { try { if (typeof SOUND !== "undefined") SOUND.fx(n); } catch { /* no audio */ } };
  const perk = (s, k) => { try { return s && typeof PFX !== "undefined" ? +PFX.num(s, k) || 0 : 0; } catch { return 0; } };
  const reduce = () => DOM && typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ====================================================================== the rules (pure, tested in Node)
  const STRIKES = 6, SHAPE_AT = 3;                 // six blows; the bar turns into a rough blade after three
  const W_HEAT = 0.25, W_HAMMER = 0.55, W_QUENCH = 0.2;
  const TOO_COLD = 0.32;                           // below this the metal won't take shape: reheat
  const QUENCH_AT = 0.45;                          // cherry red
  // the colour of hot iron: cold grey → dark red → cherry → orange → yellow → white
  const STOPS = [[0, [74, 74, 80]], [0.25, [116, 40, 26]], [0.45, [200, 46, 22]], [0.6, [242, 98, 24]], [0.75, [255, 170, 46]], [0.88, [255, 228, 142]], [1, [255, 252, 236]]];
  function heatRGB(t) {
    t = clamp(t, 0, 1);
    for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], f = (t - a) / (b - a || 1);
      return ca.map((v, k) => Math.round(v + (cb[k] - v) * f));
    }
    return STOPS[STOPS.length - 1][1].slice();
  }
  const heatCSS = (t, a = 1) => `rgba(${heatRGB(t).join(",")},${a})`;
  /* how forgiving the game is: skill 0..100 and the Forge Sense perk (fs: wider bands, fc: slower cooling) */
  function tune(skill = 15, fs = 0, fc = 0) {
    const sk = clamp(skill, 0, 100) / 100, ease = 0.85 + 0.4 * sk;
    const half = (0.075 + 0.035 * sk) * (1 + fs), qhalf = (0.06 + 0.03 * sk) * (1 + fs);
    return {
      ease, lo: 0.69 - half, hi: 0.69 + half, qlo: QUENCH_AT - qhalf, qhi: QUENCH_AT + qhalf, qhalf,
      cool: 0.035 * (1 - 0.8 * clamp(fc, 0, 0.9)),              // heat lost per second at the anvil
      ring: 1.15 * ease * (1 + 0.6 * clamp(fc, 0, 0.9)),        // seconds for a ring to close on its spot
      qcool: 0.12 * (1 - 0.5 * clamp(fc, 0, 0.9)),              // heat lost per second over the water
    };
  }
  /* how well a blow lands on the metal at this heat (1 = in or above the band) */
  function heatFactor(temp, T) {
    if (temp >= T.lo && temp <= T.hi + 0.12) return 1;
    if (temp > T.hi) return 0.85;                                  // white-hot: it smears
    return clamp(1 - (T.lo - temp) * 2.2, 0.3, 1);                 // too cold: it barely moves
  }
  /* a strike: R = the closing ring's radius, r = the spot's; accuracy 1 within 10% of r */
  function strikeScore(R, r, temp, T) {
    const d = Math.abs(R - r) / r, acc = clamp(1 - Math.max(0, d - 0.1) / (0.75 * T.ease), 0, 1);
    return { acc, heat: heatFactor(temp, T), q: acc * heatFactor(temp, T) };
  }
  function quenchScore(temp, T) { return clamp(1 - Math.max(0, Math.abs(temp - QUENCH_AT) - T.qhalf * 0.35) / (T.qhalf * 1.4), 0, 1); }
  /* the final quality 0..1 from the three steps (missing strikes count 0) */
  function total(heatQs, strikes, quenchQ) {
    const st = strikes.slice(0, STRIKES); while (st.length < STRIKES) st.push(0);
    return clamp(W_HEAT * (heatQs.length ? avg(heatQs) : 0) + W_HAMMER * avg(st) + W_QUENCH * (quenchQ || 0), 0, 1);
  }
  /* the chance to save one piece of the main material: only for great forging (q ≥ 0.7), fades with the day's bonus
     crafts like the temper bonus (factor), Forge Sense adds a little; never above 20% */
  function saveChance(q, factor = 1, perkSave = 0) { return q < 0.7 ? 0 : clamp(((q - 0.7) * 0.4 + perkSave) * factor, 0, 0.2); }

  // ---- the game state machine (no DOM: Node tests drive it with step/press)
  function create(o = {}, rnd = Math.random) {
    const s = o.s || null;
    const T = tune(o.skill ?? 15, o.fs ?? perk(s, "forgeheat"), o.fc ?? perk(s, "forgecool"));
    return {
      T, rnd, t: 0, phase: "heat", pt: 0, reheat: false, temp: 0.3, vel: 0, holding: false, fire: 0.3,
      win: 4, warm: 1.4, hin: 0, burn: 0, heatQ: [], strikes: [], spot: null, gap: 0.6, quenchQ: 0, qdone: false,
      stage: 1, morph: 0, msg: "", msgT: 0, q: 0, over: false, events: [], plunge: 0, freeze: 0, perfect: 0,
    };
  }
  const say = (S, m) => { S.msg = m; S.msgT = 1.4; };
  const emit = (S, e) => { S.events.push(e); };
  function setPhase(S, p) { S.phase = p; S.pt = 0; emit(S, { k: "phase", p }); }
  function startHeat(S, again) {
    setPhase(S, "heat"); S.reheat = !!again; S.win = again ? 2.6 : 4; S.warm = again ? 0.5 : 1.4; S.hin = 0; S.burn = 0; S.spot = null;
  }
  function endHeat(S) {
    S.heatQ.push(clamp(S.hin / S.win - S.burn * 0.25, 0, 1));
    S.holding = false; S.vel = Math.min(S.vel, 0);
    setPhase(S, "hammer"); S.gap = S.reheat ? 0.45 : 0.7;
  }
  function spawnSpot(S) {
    const done = S.strikes.length, f = 0.3 + ((done * 0.37 + S.rnd() * 0.25) % 1) * 0.62;   // spread along the blade, tang left alone
    S.spot = { f, dy: (S.rnd() - 0.5) * 0.35, t: 0, T: S.T.ring * (done >= SHAPE_AT ? 0.9 : 1) };
  }
  const ringR = (sp, r) => r * Math.max(0.35, 3 - 2 * sp.t / sp.T);
  function strike(S, at) {
    const sp = S.spot; if (!sp || S.freeze > 0) return null;
    const r = 1, sc = strikeScore(ringR(sp, r), r, S.temp, S.T);
    let q = sc.q, glance = false;
    if (at && at.far) { q *= 0.6; glance = true; }
    S.strikes.push(q); S.spot = null; S.gap = 0.35; S.temp = clamp(S.temp - 0.012, 0, 1);
    say(S, glance ? "Glancing blow" : sc.heat < 0.7 ? "Too cold!" : sc.acc > 0.9 ? "Clean strike!" : sc.acc > 0.55 ? "Good strike" : sc.acc > 0.15 ? "Off the mark" : "Missed!");
    if (sc.acc > 0.9 && !glance) S.perfect++;
    emit(S, { k: "strike", q, acc: sc.acc, f: sp.f, dy: sp.dy, heat: sc.heat });
    afterStrike(S);
    return q;
  }
  function afterStrike(S) {
    const n = S.strikes.length;
    if (n === SHAPE_AT) { S.stage = 2; S.morph = 0.45; emit(S, { k: "shape", stage: 2 }); }
    if (n >= STRIKES) { S.stage = 3; S.morph = 0.45; emit(S, { k: "shape", stage: 3 }); setPhase(S, "carry"); }
  }
  function plunge(S) {
    if (S.phase !== "quench" || S.qdone) return;
    S.qdone = true; S.quenchQ = quenchScore(S.temp, S.T);
    say(S, S.quenchQ > 0.85 ? "A perfect quench!" : S.quenchQ > 0.5 ? "Good quench" : S.temp > QUENCH_AT ? "Too hot: it warps a little" : "Too cool: it's brittle");
    emit(S, { k: "quench", q: S.quenchQ }); setPhase(S, "steam");
  }
  /* input: v = pressed/released, at = {far} when a tap missed the spot (null for the button / keys) */
  function press(S, v, at = null) {
    if (S.over) return;
    if (S.phase === "heat") S.holding = !!v;
    else if (S.phase === "hammer" && v) strike(S, at);
    else if (S.phase === "quench" && v) plunge(S);
    else if (S.phase === "reveal" && v && S.pt > 0.7) S.over = true;
  }
  function reheat(S) { if (S.phase === "hammer" && S.temp < S.T.hi) { startHeat(S, true); say(S, "Back into the fire"); } }
  const canReheat = (S) => S.phase === "hammer" && S.temp < S.T.lo;
  function step(S, dt) {
    dt = clamp(dt, 0, 0.05); S.t += dt; S.pt += dt; S.msgT = Math.max(0, S.msgT - dt); S.morph = Math.max(0, S.morph - dt);
    if (S.freeze > 0) { S.freeze -= dt; return; }
    S.fire = lerp(S.fire, S.phase === "heat" && S.holding ? 1 : 0.3, clamp(dt * 3, 0, 1));
    if (S.phase === "heat") {
      S.vel += ((S.holding ? 1.1 : 0) - 0.55) * dt * 1.6; S.vel = clamp(S.vel, -0.5, 0.6); S.vel *= 1 - 0.9 * dt;
      S.temp = clamp(S.temp + S.vel * dt * 1.4 + Math.sin(S.t * 2.3) * 0.015 * dt, 0, 1);
      if (S.pt > S.warm) {
        const T = S.T, inb = S.temp >= T.lo && S.temp <= T.hi, near = Math.min(Math.abs(S.temp - T.lo), Math.abs(S.temp - T.hi));
        S.hin += inb ? dt : near < 0.05 ? dt * 0.4 : 0;
        if (S.temp > 0.93) S.burn += dt;
        if (S.pt >= S.warm + S.win) endHeat(S);
      }
    } else if (S.phase === "hammer") {
      S.temp = clamp(S.temp - S.T.cool * dt, 0, 1);
      if (S.spot) {
        S.spot.t += dt;
        if (S.spot.t > S.spot.T * 1.32) { S.strikes.push(0); S.spot = null; S.gap = 0.35; say(S, "Too slow!"); emit(S, { k: "miss" }); afterStrike(S); }
      } else if ((S.gap -= dt) <= 0) spawnSpot(S);
      if (S.temp < TOO_COLD && S.msgT <= 0) say(S, "Too cold to shape. Reheat it!");
    } else if (S.phase === "carry") {
      S.temp = clamp(S.temp + (0.74 - S.temp) * dt * 4, 0, 1);       // a last pass through the coals on the way to the water
      if (S.pt > 0.9) { S.temp = Math.max(S.temp, 0.72); setPhase(S, "quench"); }
    } else if (S.phase === "quench") {
      if (S.pt > 0.5) S.temp = clamp(S.temp - S.T.qcool * dt, 0, 1);
      if (S.temp < 0.2) plunge(S);
    } else if (S.phase === "steam") {
      S.temp = clamp(S.temp - dt * 1.2, 0, 1);
      if (S.pt > 1.15) { S.stage = 4; S.morph = 0.5; S.q = total(S.heatQ, S.strikes, S.quenchQ); setPhase(S, "reveal"); emit(S, { k: "reveal", q: S.q }); }
    } else if (S.phase === "reveal") {
      if (S.pt > 2.8) S.over = true;
    }
  }
  /* a bot that plays well (or badly): used by the Node test and the balance numbers in the patch note */
  function simulate(o = {}, skillful = 1, rnd = Math.random) {
    const S = create(o, rnd), dt = 1 / 60;
    for (let i = 0; i < 60 * 90 && !S.over; i++) {
      if (S.phase === "heat") press(S, rnd() < skillful ? S.temp < (S.T.lo + S.T.hi) / 2 - 0.03 : rnd() < 0.5);
      if (S.phase === "hammer") {
        if (skillful > 0.5 && canReheat(S) && S.temp < S.T.lo - 0.08 && !S.spot) reheat(S);
        else if (S.spot && S.spot.t >= S.spot.T * (skillful >= 1 ? 1 : 1 + (rnd() - 0.5) * (1 - skillful) * 1.2)) press(S, true);
        else if (S.temp < TOO_COLD) reheat(S);
      }
      if (S.phase === "quench" && S.pt > 0.5 && Math.abs(S.temp - QUENCH_AT) < 0.01 + (1 - skillful) * 0.15 * rnd()) press(S, true);
      if (S.phase === "reveal") S.over = true;
      step(S, dt);
    }
    return S;
  }

  // ====================================================================== art: painted pictures, drawn fallbacks
  const BW = 2048, BH = 1152;                       // the background's own size: everything in the scene is placed on it
  const DIMS = { "mg-smith-blade1": [1171, 129], "mg-smith-blade2": [1314, 119], "mg-smith-blade3": [1335, 124], "mg-smith-blade4": [1353, 128], "mg-smith-hammer": [785, 278], "mg-smith-tongs": [892, 169] };
  const BLADE = (n) => "mg-smith-blade" + n;
  const ANVIL = { x: 600, y: 700, s: 0.62 };        // the blade's tang end and centre line on the anvil face, its scale
  const FORGE = { x: 205, y: 520, fx: 200, fy: 430 };
  const WATER = { x: 1850, y: 622 };
  const CAMS = {   // [focus x, focus y, zoom on wide screens, zoom on tall screens]
    heat: [430, 520, 1.5, 1], hammer: [1020, 680, 1.12, 1], carry: [1300, 640, 1.1, 1], quench: [1720, 470, 1.25, 1], steam: [1720, 470, 1.25, 1], reveal: [1020, 600, 1, 1],
  };
  const fb = {};
  const asset = (k) => (typeof ASSETS !== "undefined" ? ASSETS.img(k) : null);
  function pic(k) { return asset(k) || fallback(k); }
  /* drawn stand-ins, the same size as the paintings, so the scene lays out the same without them */
  function fallback(k) {
    if (fb[k]) return fb[k];
    const big = k === "mg-smithing-bg", [w, h] = big ? [BW / 2, BH / 2] : DIMS[k] || [64, 64];
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const g = cv.getContext("2d");
    if (big) {
      g.scale(0.5, 0.5);
      const bg = g.createLinearGradient(0, 0, 0, BH); bg.addColorStop(0, "#1d1712"); bg.addColorStop(0.6, "#2a2018"); bg.addColorStop(1, "#14100c"); g.fillStyle = bg; g.fillRect(0, 0, BW, BH);
      g.fillStyle = "#3a3028"; for (let x = 0; x < BW; x += 170) g.fillRect(x, 0, 22, 700);                          // wall planks
      g.fillStyle = "#4a4038"; g.fillRect(0, 560, 640, 360); g.fillStyle = "#2e2620"; g.fillRect(40, 300, 480, 270);   // forge
      const fire = g.createRadialGradient(FORGE.fx, FORGE.fy + 80, 10, FORGE.fx, FORGE.fy + 80, 260); fire.addColorStop(0, "#ffd27a"); fire.addColorStop(0.35, "#ff7a20"); fire.addColorStop(1, "rgba(80,20,0,0)");
      g.fillStyle = fire; g.fillRect(0, 200, 600, 420);
      g.fillStyle = "#4c4c54"; g.beginPath(); g.moveTo(400, 690); g.lineTo(1650, 700); g.lineTo(1420, 770); g.lineTo(1400, 830); g.lineTo(1250, 870); g.lineTo(1300, 1050); g.lineTo(760, 1050); g.lineTo(820, 870); g.lineTo(660, 830); g.lineTo(640, 760); g.closePath(); g.fill();
      g.fillStyle = "#5c5c66"; g.fillRect(645, 668, 765, 40);                                                         // anvil face
      g.fillStyle = "#5a3e26"; g.fillRect(1600, 600, 448, 520); g.fillStyle = "#2b4250"; g.beginPath(); g.ellipse(1850, 625, 210, 34, 0, 0, Math.PI * 2); g.fill();   // barrel
      g.fillStyle = "#3b2a1a"; for (const y of [700, 860, 1010]) g.fillRect(1600, y, 448, 16);
    } else if (/blade/.test(k)) {
      const n = +k.slice(-1), hot = n <= 2, tang = w * 0.12, y = h / 2;
      g.fillStyle = "#55555c"; g.fillRect(0, y - h * 0.18, tang, h * 0.36);
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, hot ? "#ffb060" : n === 3 ? "#a86040" : "#c8ccd4"); gr.addColorStop(1, hot ? "#c04018" : n === 3 ? "#5a4a46" : "#70747c");
      g.fillStyle = gr; g.beginPath();
      if (n === 1) g.rect(tang, y - h * 0.4, w - tang, h * 0.8);
      else { g.moveTo(tang, y - h * 0.3); g.lineTo(tang + w * 0.06, y - h * 0.4); g.lineTo(w * 0.86, y - h * 0.34); g.lineTo(w, y); g.lineTo(w * 0.86, y + h * 0.34); g.lineTo(tang + w * 0.06, y + h * 0.4); g.lineTo(tang, y + h * 0.3); }
      g.fill(); if (n >= 3) { g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 3; g.beginPath(); g.moveTo(tang + w * 0.08, y); g.lineTo(w * 0.88, y); g.stroke(); }
    } else if (k === "mg-smith-hammer") {
      g.fillStyle = "#6b4a2a"; g.fillRect(20, 128, 680, 46); g.fillStyle = "#3e2a18"; for (let x = 40; x < 260; x += 18) g.fillRect(x, 128, 6, 46);
      g.fillStyle = "#77787f"; g.fillRect(690, 30, 90, 240); g.fillStyle = "#9a9ba2"; g.fillRect(690, 30, 90, 20);
    } else if (k === "mg-smith-tongs") {
      g.strokeStyle = "#3c3d42"; g.lineWidth = 18; g.lineCap = "round";
      g.beginPath(); g.moveTo(30, 40); g.lineTo(640, 80); g.lineTo(860, 50); g.moveTo(30, 140); g.lineTo(640, 92); g.lineTo(860, 130); g.stroke();
    }
    fb[k] = cv; return cv;
  }
  /* a sprite's silhouette filled with one colour (for heat glow and the shine on the finished blade) */
  let silCv = null;
  function silhouette(img, w, h, paint) {
    if (!silCv) silCv = document.createElement("canvas");
    const cw = Math.max(2, Math.min(900, Math.round(w))), ch = Math.max(2, Math.round(h * cw / w));
    if (silCv.width !== cw || silCv.height !== ch) { silCv.width = cw; silCv.height = ch; }
    const g = silCv.getContext("2d"); g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, cw, ch);
    g.drawImage(img, 0, 0, cw, ch); g.globalCompositeOperation = "source-atop"; paint(g, cw, ch); g.globalCompositeOperation = "source-over";
    return silCv;
  }

  // ====================================================================== the screen (DOM)
  let st = null;    // { S, o, done, el, cv, cam, fx, ... }
  let pending = null;   // the last game's result, for the material-saving roll in smithMake
  const TITLE = "At the forge";
  const HINT = {
    heat: "Hold Pump (or the fire) to work the bellows. Keep the glow inside the gold band.",
    reheat: "Back in the fire. Pump until the glow sits in the gold band again.",
    hammer: "Tap each glowing spot as the shrinking ring meets it. Hot metal takes the blow best.",
    cold: "The metal is cooling. Tap Reheat before it goes dark.",
    carry: "The blade takes its shape. To the water!",
    quench: "Watch the glow cool. Tap Quench when it reaches the cherry-red band.",
    steam: "Hsss…", reveal: "",
  };
  const ACT = { heat: "Hold to pump", hammer: "Strike", carry: "Strike", quench: "Quench", steam: "Quench", reveal: "Take it" };
  function play(o, done) {
    close();
    const s = o.s || (typeof window !== "undefined" && window.__dbg?.save?.()) || null;
    const S = create({ skill: o.skill, s, fs: o.fs, fc: o.fc });
    const el = document.createElement("div");
    el.id = "smithgame"; el.className = "smithgame";
    el.innerHTML = `<div class="sgwrap" role="dialog" aria-label="${esc(TITLE)}">
      <div class="sgtop"><h3>${esc(TITLE)}</h3><span class="sgsub">${esc(o.what || "")}${o.skillName ? ` · ${esc(o.skillName)} ${Math.round(o.skill || 0)}` : ""}</span>
        <ol class="sgsteps"><li data-p="heat">Heat</li><li data-p="hammer">Hammer</li><li data-p="quench">Quench</li></ol></div>
      <div class="sgstage"><canvas id="sgc" aria-hidden="true"></canvas><div class="sgpop" aria-live="polite"></div></div>
      <div class="sgbar"><p class="sghint" id="sghint"></p>
        <div class="sgrow"><span id="sgprog"></span><button class="btn" id="sgreheat" hidden>Reheat</button><button class="btn pri" id="sgact">Hold to pump</button></div>
        <div class="sgrow sglow"><button class="btn" id="sgquick">Quick craft</button>
          <label class="lppref"><input type="checkbox" id="sgpref" ${pref("craftGame", true) ? "checked" : ""}> Always play crafting mini-games</label></div></div></div>`;
    document.body.appendChild(el);
    const cv = el.querySelector("#sgc"), act = el.querySelector("#sgact");
    st = { S, o, done, el, cv, cam: null, sparks: [], embers: [], steam: [], drops: [], flash: [], shake: 0, hm: { a: 0.85, t: 9, x: null }, last: "", popT: 0 };
    const toBg = (e) => { const b = cv.getBoundingClientRect(), c = st.cam; if (!c) return null; return { x: (e.clientX - b.left - c.w / 2) / c.sc + c.cx, y: (e.clientY - b.top - c.h / 2) / c.sc + c.cy }; };
    const stageDown = (e) => {
      e.preventDefault(); if (!st) return;
      let at = null;
      if (S.phase === "hammer" && S.spot) {   // a tap far from the glowing spot is a glancing blow
        const p = toBg(e), sp = spotXY(S), c = st.cam;
        if (p && c) at = { far: Math.hypot(p.x - sp.x, p.y - sp.y) * c.sc > Math.max(56, 150 * c.sc) };
      }
      press(S, true, at);
    };
    const up = (e) => { e.preventDefault(); if (st) press(S, false); };
    cv.addEventListener("pointerdown", stageDown); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("pointerleave", up);
    act.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); press(S, true); });
    for (const k of ["pointerup", "pointerleave", "pointercancel"]) act.addEventListener(k, (e) => { e.preventDefault(); press(S, false); });
    el.querySelector("#sgreheat").onclick = () => reheat(S);
    el.querySelector("#sgquick").onclick = () => finish(true);
    el.querySelector("#sgpref").onchange = (e) => setPref("craftGame", e.target.checked);
    st.key = (e) => {
      if (!st || e.repeat && e.type === "keydown") return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); press(S, e.type === "keydown"); }
      else if (e.type === "keydown" && (e.key === "r" || e.key === "R")) reheat(S);
      else if (e.type === "keydown" && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(true); }
    };
    addEventListener("keydown", st.key, true); addEventListener("keyup", st.key, true);
    let last = performance.now();
    const loop = (now) => {
      if (!st || st.S !== S) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      try { tick(dt); draw(); } catch (err) { console.error(err); }
      if (S.over) return finish(false);
      st.raf = requestAnimationFrame(loop);
    };
    st.raf = requestAnimationFrame(loop);
    tick(0); draw();
  }
  const PREFS = "rotn_prefs";
  const pref = (k, d) => { try { const v = JSON.parse(localStorage.getItem(PREFS) || "{}")[k]; return v === undefined ? d : v; } catch { return d; } };
  const setPref = (k, v) => { try { const p = JSON.parse(localStorage.getItem(PREFS) || "{}"); p[k] = v; localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* ignore */ } };

  // where things are in the scene (background coordinates)
  const bladeLen = (n) => DIMS[BLADE(n)][0] * ANVIL.s;
  function spotXY(S, sp = S.spot, stage = S.stage) {
    const L = bladeLen(Math.min(stage, 2)), h = DIMS[BLADE(Math.min(stage, 2))][1] * ANVIL.s;
    return { x: ANVIL.x + L * (sp ? sp.f : 0.5), y: ANVIL.y + (sp ? sp.dy : 0) * h * 0.5 };
  }

  // ---- per-frame: the rules, then the effects the rules asked for
  function tick(dt) {
    const S = st.S, slow = reduce();
    step(S, dt);
    for (const e of S.events.splice(0)) {
      if (e.k === "strike") {
        const p = spotXY(S, { f: e.f, dy: e.dy }, S.strikes.length > SHAPE_AT ? 2 : 1);
        st.hm.t = 0; st.hm.x = p.x; st.hit = { p, q: e.q, acc: e.acc, at: 0.09 };
      } else if (e.k === "miss") { st.hm.t = 0.3; }
      else if (e.k === "shape") st.flash.push({ x: ANVIL.x + bladeLen(2) / 2, y: ANVIL.y, r: 520, life: 0.45, max: 0.45, c: "255,230,170" });
      else if (e.k === "quench") { sfx("potion"); st.plungeT = 0; }
      else if (e.k === "reveal") { const g = CG.grade(e.q); if (g === "perfect" || g === "masterful") sfx("coin"); }
      else if (e.k === "phase" && e.p === "heat") st.hm.t = 9;
    }
    // the hammer: wait raised, swing down (90 ms), ring, rebound (200 ms), raise again (250 ms)
    const hm = st.hm; hm.t += dt;
    if (st.hit && hm.t >= st.hit.at) {
      const { p, q, acc } = st.hit; st.hit = null;
      sfx("clang"); if (acc > 0.9) setTimeout(() => sfx("clang"), 70);
      const n = slow ? 6 : Math.round(16 + 34 * q);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 300 + Math.random() * 900 * (0.5 + q);
        st.sparks.push({ x: p.x, y: p.y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.35, max: 0.7, w: 2 + Math.random() * 3 });
      }
      st.flash.push({ x: p.x, y: p.y, r: 120 + 160 * q, life: 0.25, max: 0.25, c: acc > 0.9 ? "255,250,230" : "255,190,110", ring: true });
      st.shake = slow ? 0 : 2 + 3 * q; st.S.freeze = slow ? 0 : 0.04;
    }
    let target = 0.85 + Math.sin(st.S.t * 2) * 0.03;
    if (hm.t < 0.09) target = lerp(0.85, -0.02, easeIn(hm.t / 0.09));
    else if (hm.t < 0.29) target = lerp(-0.02, 0.45, easeOut((hm.t - 0.09) / 0.2));
    else if (hm.t < 0.54) target = lerp(0.45, 0.85, easeOut((hm.t - 0.29) / 0.25));
    hm.a = hm.t < 0.54 ? target : lerp(hm.a, target, clamp(dt * 10, 0, 1));
    if (S.spot && hm.t > 0.3) { const p = spotXY(S); hm.x = hm.x == null ? p.x : lerp(hm.x, p.x, clamp(dt * 8, 0, 1)); }
    // particles
    const g0 = 2200;
    st.sparks = st.sparks.filter((p) => (p.life -= dt) > 0); for (const p of st.sparks) { p.px = p.x; p.py = p.y; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += g0 * dt; p.vx *= 1 - 1.5 * dt; }
    st.embers = st.embers.filter((p) => (p.life -= dt) > 0); for (const p of st.embers) { p.x += p.vx * dt + Math.sin(S.t * 3 + p.ph) * 20 * dt; p.y += p.vy * dt; }
    if (!slow && (S.phase === "heat" ? Math.random() < S.fire * 0.9 : Math.random() < 0.12)) st.embers.push({ x: FORGE.fx + (Math.random() - 0.5) * 200, y: FORGE.y, vx: (Math.random() - 0.3) * 40, vy: -120 - Math.random() * 220 * S.fire, life: 1 + Math.random(), ph: Math.random() * 6, r: 2 + Math.random() * 3 });
    st.steam = st.steam.filter((p) => (p.life -= dt) > 0); for (const p of st.steam) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 1 - 0.6 * dt; p.r += p.vr * dt; }
    st.drops = st.drops.filter((p) => (p.life -= dt) > 0); for (const p of st.drops) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += g0 * dt; }
    st.flash = st.flash.filter((f) => (f.life -= dt) > 0);
    st.shake = Math.max(0, st.shake - dt * 30);
    if (st.plungeT != null) {
      const before = st.plungeT; st.plungeT += dt;
      if (before < 0.28 && st.plungeT >= 0.28) {   // the tip hits the water: a burst of steam and a splash
        const n = slow ? 8 : 26;
        for (let i = 0; i < n; i++) st.steam.push({ x: WATER.x - 60 + (Math.random() - 0.5) * 220, y: WATER.y - 10, vx: (Math.random() - 0.5) * 120, vy: -160 - Math.random() * 260, r: 30 + Math.random() * 50, vr: 90 + Math.random() * 120, life: 0.9 + Math.random() * 0.9, max: 1.8, rot: Math.random() * 6 });
        for (let i = 0; i < (slow ? 4 : 18); i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2; st.drops.push({ x: WATER.x - 60, y: WATER.y, vx: Math.cos(a) * 500, vy: Math.sin(a) * (500 + Math.random() * 500), life: 0.5 + Math.random() * 0.3 }); }
        st.flash.push({ x: WATER.x - 60, y: WATER.y, r: 260, life: 0.3, max: 0.3, c: "255,180,90" });
      }
      if (S.phase === "steam" && !slow && Math.random() < 0.5) st.steam.push({ x: WATER.x - 60 + (Math.random() - 0.5) * 120, y: WATER.y - 10, vx: (Math.random() - 0.5) * 60, vy: -120 - Math.random() * 120, r: 24 + Math.random() * 30, vr: 70, life: 1.2, max: 1.2, rot: Math.random() * 6 });
    }
    ui();
  }
  // ---- the words and buttons under the picture
  function ui() {
    const S = st.S, el = st.el, ph = S.phase;
    const cold = ph === "hammer" && S.temp < S.T.lo;
    const hint = ph === "heat" && S.reheat ? HINT.reheat : cold ? HINT.cold : HINT[ph] || "";
    const prog = ph === "heat" ? (S.pt < S.warm ? "Get the fire going…" : `Heating… ${Math.max(0, Math.ceil(S.warm + S.win - S.pt))} s`)
      : ph === "hammer" || ph === "carry" ? `Strike ${Math.min(S.strikes.length + 1, STRIKES)} of ${STRIKES}` : ph === "quench" || ph === "steam" ? "Quench" : "";
    const key = [hint, prog, ph, cold, S.msgT > 0 ? S.msg : ""].join("|");
    if (key === st.last) return; st.last = key;
    el.querySelector("#sghint").textContent = hint;
    el.querySelector("#sgprog").textContent = prog;
    el.querySelector("#sgact").textContent = ACT[ph] || "";
    el.querySelector("#sgact").disabled = ph === "carry" || ph === "steam";
    el.querySelector("#sgreheat").hidden = ph !== "hammer";
    el.querySelector("#sgreheat").classList.toggle("sgwarn", cold);
    const stepOf = ph === "heat" ? "heat" : ph === "hammer" || ph === "carry" ? "hammer" : "quench";
    el.querySelectorAll(".sgsteps li").forEach((li) => { li.classList.toggle("on", li.dataset.p === stepOf && ph !== "reveal"); li.classList.toggle("done", ["heat", "hammer", "quench"].indexOf(li.dataset.p) < ["heat", "hammer", "quench"].indexOf(stepOf) || ph === "reveal"); });
    const pop = el.querySelector(".sgpop");
    if (S.msgT > 0 && S.msg) { if (pop.textContent !== S.msg) { pop.textContent = S.msg; pop.classList.remove("go"); void pop.offsetWidth; pop.classList.add("go"); } }
    if (ph === "reveal" && !el.querySelector(".sgresult")) {
      const g = CG.grade(S.q), b = document.createElement("div");
      b.className = `sgresult g-${g}`; b.innerHTML = `<b>${esc(CG.label(g))}</b><small>Quality ${Math.round(S.q * 100)}%</small>`;
      el.querySelector(".sgstage").appendChild(b);
    }
  }

  // ---- drawing
  function camera(w, h, ph, dt) {
    const tall = h > w * 0.9, [fx, fy, zw, zt] = CAMS[ph] || CAMS.hammer, z = tall ? zt : zw;
    const want = { fx, fy, z };
    if (!st.cam0) st.cam0 = { ...want };
    const c0 = st.cam0, k = reduce() ? 1 : clamp(dt * 3.2, 0, 1);
    c0.fx = lerp(c0.fx, want.fx, k); c0.fy = lerp(c0.fy, want.fy, k); c0.z = lerp(c0.z, want.z, k);
    const sc = Math.max(w / BW, h / BH) * c0.z, hw = w / 2 / sc, hh = h / 2 / sc;
    const cx = hw * 2 >= BW ? BW / 2 : clamp(c0.fx, hw, BW - hw), cy = hh * 2 >= BH ? BH / 2 : clamp(c0.fy, hh, BH - hh);
    return { w, h, sc, cx, cy };
  }
  let lastDraw = 0;
  function draw() {
    const S = st.S, cv = st.cv;
    const fit = typeof FITCANVAS !== "undefined" ? FITCANVAS.fill(cv) : (() => { const r = cv.getBoundingClientRect(), k = devicePixelRatio || 1; cv.width = r.width * k; cv.height = r.height * k; const g = cv.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0); return { g, w: r.width, h: r.height, k }; })();
    const { g, w, h, k } = fit;
    const now = performance.now(), dt = lastDraw ? Math.min(0.05, (now - lastDraw) / 1000) : 0; lastDraw = now;
    const c = st.cam = camera(w, h, S.phase, dt);
    const sx = (Math.random() - 0.5) * st.shake * 2, sy = (Math.random() - 0.5) * st.shake * 2;
    const world = () => g.setTransform(k * c.sc, 0, 0, k * c.sc, k * (w / 2 - c.cx * c.sc + sx), k * (h / 2 - c.cy * c.sc + sy));
    const screen = () => g.setTransform(k, 0, 0, k, 0, 0);
    const px = (n) => n / c.sc;                    // n screen pixels in scene units
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    screen(); g.fillStyle = "#0b0907"; g.fillRect(0, 0, w, h);
    world();
    // the forge, the anvil and the barrel
    g.imageSmoothingQuality = "high";
    g.drawImage(pic("mg-smithing-bg"), 0, 0, BW, BH);
    // firelight: brighter while you pump
    g.globalCompositeOperation = "lighter";
    const fl = 0.18 + 0.32 * S.fire + Math.sin(S.t * 13) * 0.03 + Math.sin(S.t * 7.3) * 0.03;
    radial(g, FORGE.fx, FORGE.fy + 60, 420, `rgba(255,140,50,${fl})`);
    radial(g, FORGE.fx, FORGE.fy + 90, 160, `rgba(255,210,120,${fl * 0.8})`);
    for (const p of st.embers) { g.fillStyle = `rgba(255,${150 + Math.round(80 * Math.random())},60,${clamp(p.life, 0, 1)})`; g.fillRect(p.x, p.y, p.r, p.r); }
    g.globalCompositeOperation = "source-over";
    // the work: in the coals, on the anvil, or over the water
    const ph = S.phase, stage = S.stage;
    if (ph === "heat") {
      const len = bladeLen(stage === 1 ? 1 : Math.min(stage, 2)), ang = -0.08;
      const tipX = FORGE.x, tipY = FORGE.y, tx = tipX + Math.cos(ang) * len, ty = tipY + Math.sin(ang) * len;
      drawBlade(g, Math.min(stage, 2), tx, ty, ANVIL.s, Math.PI + ang, S.temp, c);
      drawTongs(g, tx - 20, ty, true, ang);
    } else if (ph === "hammer") {
      const len = bladeLen(Math.min(stage, 2));
      if (S.temp > 0.3) { g.globalCompositeOperation = "lighter"; radial(g, ANVIL.x + len * 0.55, ANVIL.y, 520, heatCSS(S.temp, 0.32 * clamp((S.temp - 0.3) / 0.5, 0, 1))); g.globalCompositeOperation = "source-over"; }
      drawBlade(g, Math.min(stage, 2), ANVIL.x, ANVIL.y, ANVIL.s, 0, S.temp, c);
      drawTongs(g, ANVIL.x + 30, ANVIL.y, false, 0);
      if (S.spot) drawSpot(g, S, c, px);
      drawHammer(g, st.hm.x ?? ANVIL.x + len * 0.6, ANVIL.y, st.hm.a);
    } else if (ph === "carry") {
      const f = easeOut(clamp(S.pt / 0.9, 0, 1)), x = lerp(ANVIL.x, 1380, f), y = lerp(ANVIL.y, 520, f) - Math.sin(f * Math.PI) * 80;
      drawBlade(g, 3, x, y, ANVIL.s * lerp(1, 0.8, f), lerp(0, 0.5, f), S.temp, c);
      drawTongs(g, x + 30, y, false, lerp(0, 0.5, f));
    } else if (ph === "quench" || ph === "steam") {
      const bob = ph === "quench" ? Math.sin(S.t * 2.2) * 6 : 0, dip = st.plungeT != null ? easeIn(clamp(st.plungeT / 0.28, 0, 1)) * 230 : 0;
      const ang = 0.92, s = ANVIL.s * 0.8, len = DIMS[BLADE(3)][0] * s;
      const tipX = WATER.x - 60, tipY = WATER.y - 30 + bob + dip, tx = tipX - Math.cos(ang) * len, ty = tipY - Math.sin(ang) * len;
      g.save(); g.beginPath(); g.rect(0, 0, BW, WATER.y + 4); g.rect(0, WATER.y + 4, 1600, BH); g.clip();   // under the water line you can't see it
      drawBlade(g, 3, tx, ty, s, ang, S.temp, c);
      g.restore();
      drawTongs(g, tx + 26 * Math.cos(ang), ty + 26 * Math.sin(ang), false, ang);
      if (dip > 0) { g.strokeStyle = "rgba(220,235,240,.5)"; g.lineWidth = px(2); for (let i = 0; i < 3; i++) { const r = ((st.plungeT * 140 + i * 50) % 160) + 20; g.globalAlpha = clamp(1 - r / 180, 0, 1); g.beginPath(); g.ellipse(tipX, WATER.y + 4, r * 1.6, r * 0.25, 0, 0, Math.PI * 2); g.stroke(); } g.globalAlpha = 1; }
    } else if (ph === "reveal") {
      drawBlade(g, 4, ANVIL.x, ANVIL.y, ANVIL.s, 0, 0, c);
    }
    // sparks, flashes, steam
    g.globalCompositeOperation = "lighter";
    for (const p of st.sparks) {
      const a = clamp(p.life / 0.4, 0, 1), col = p.life > 0.45 ? "255,250,220" : p.life > 0.25 ? "255,200,110" : "255,130,50";
      g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = Math.max(px(1.5), p.w); g.beginPath(); g.moveTo(p.px ?? p.x, p.py ?? p.y); g.lineTo(p.x, p.y); g.stroke();
    }
    for (const f of st.flash) {
      const t = 1 - f.life / f.max;
      if (f.ring) { g.strokeStyle = `rgba(${f.c},${(1 - t) * 0.9})`; g.lineWidth = px(3) + 10 * (1 - t); g.beginPath(); g.arc(f.x, f.y, f.r * (0.3 + t), 0, Math.PI * 2); g.stroke(); }
      radial(g, f.x, f.y, f.r * (0.6 + 0.6 * t), `rgba(${f.c},${(1 - t) * 0.85})`);
    }
    g.globalCompositeOperation = "source-over";
    for (const p of st.drops) { g.fillStyle = `rgba(200,225,235,${clamp(p.life * 2, 0, 1)})`; g.beginPath(); g.arc(p.x, p.y, 5, 0, Math.PI * 2); g.fill(); }
    const puff = asset("bsp-steam-puff");
    for (const p of st.steam) {
      const a = clamp(p.life / p.max, 0, 1) * 0.7;
      if (puff) { g.globalAlpha = a; g.save(); g.translate(p.x, p.y); g.rotate(p.rot + p.life * 0.3); g.drawImage(puff, -p.r, -p.r, p.r * 2, p.r * 2); g.restore(); g.globalAlpha = 1; }
      else radial(g, p.x, p.y, p.r, `rgba(235,240,242,${a})`);
    }
    // the finished blade, close up
    screen();
    if (ph === "reveal") {
      const t = clamp(S.pt / 0.7, 0, 1);
      g.fillStyle = `rgba(6,5,4,${0.62 * t})`; g.fillRect(0, 0, w, h);
      const img = pic(BLADE(4)), [iw, ih] = DIMS[BLADE(4)], bw = Math.min(w * 0.86, 980) * lerp(0.85, 1, easeOut(t)), bh = bw * ih / iw;
      const bx = (w - bw) / 2, by = h * 0.42 - bh / 2;
      g.globalAlpha = t; g.drawImage(img, bx, by, bw, bh);
      const sweep = (S.pt - 0.35) / 0.9;
      if (sweep > 0 && sweep < 1.2) {
        const sil = silhouette(img, bw * k, bh * k, (sg, cw, ch) => { const x = sweep * cw * 1.3 - cw * 0.15, gr = sg.createLinearGradient(x - cw * 0.12, 0, x + cw * 0.12, ch); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,.85)"); gr.addColorStop(1, "rgba(255,255,255,0)"); sg.fillStyle = gr; sg.fillRect(0, 0, cw, ch); });
        g.globalCompositeOperation = "lighter"; g.drawImage(sil, bx, by, bw, bh); g.globalCompositeOperation = "source-over";
      }
      g.globalAlpha = 1;
    }
    // the heat strip (screen space): colour of the metal, the gold band, where it is now
    if (ph === "heat" || ph === "hammer" || ph === "quench" || ph === "carry") {
      const quench = ph === "quench" || ph === "carry";
      gauge(g, w, h, S.temp, quench ? S.T.qlo : S.T.lo, quench ? S.T.qhi : S.T.hi, quench ? LX("Quench at cherry red") : LX("Forging heat"));
    }
    if (ph === "hammer" || ph === "carry") pips(g, w, h, S);
  }
  function radial(g, x, y, r, col) {
    const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(1, r)); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, "0)"));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  /* a blade stage at (x, y) = tang end, centre line; angle in radians; glows with temp */
  function drawBlade(g, n, x, y, s, ang, temp, c) {
    const key = BLADE(n), img = pic(key), [iw, ih] = DIMS[key], w = iw * s, h = ih * s;
    g.save(); g.translate(x, y); g.rotate(ang);
    g.drawImage(img, 0, -h / 2, w, h);
    const dk = c.sc * (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1);
    // painted bars 1-2 already glow orange: cool them down to the real heat; 3-4 are cool steel: heat them up
    const native = n <= 2 ? 0.66 : n === 3 ? 0.4 : 0;
    if (temp < native - 0.05) {
      const a = clamp((native - temp) * 1.5, 0, 0.82);
      g.drawImage(silhouette(img, w * dk, h * dk, (sg, cw, ch) => { sg.fillStyle = `rgba(44,40,40,${a})`; sg.fillRect(0, 0, cw, ch); }), 0, -h / 2, w, h);
    }
    const hot = clamp((temp - Math.max(0.3, native - 0.1)) / 0.55, 0, 1);
    if (hot > 0.01) {
      const sil = silhouette(img, w * dk, h * dk, (sg, cw, ch) => {
        const gr = sg.createLinearGradient(0, 0, cw, 0); gr.addColorStop(0, heatCSS(temp * 0.7, 0.1)); gr.addColorStop(0.2, heatCSS(temp, 0.9)); gr.addColorStop(1, heatCSS(temp, 0.9));
        sg.fillStyle = gr; sg.fillRect(0, 0, cw, ch);
      });
      g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.85 * hot; g.drawImage(sil, 0, -h / 2, w, h); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    g.restore();
  }
  /* tongs holding the tang: jaws at (x, y), handles running away from the blade */
  function drawTongs(g, x, y, flip, ang) {
    const key = "mg-smith-tongs", img = pic(key), [iw, ih] = DIMS[key], s = 0.6, w = iw * s, h = ih * s;
    g.save(); g.translate(x, y); g.rotate(ang); if (flip) g.scale(-1, 1);
    g.drawImage(img, -w + 40 * s, -h * 0.5, w, h); g.restore();
  }
  /* the hammer from the right: grip on the right, head on the left, face down; a = 0 lies flat on the metal */
  function drawHammer(g, x, y, a) {
    const key = "mg-smith-hammer", img = pic(key), [iw, ih] = DIMS[key], s = 0.55;
    const grip = { x: 60 * s, y: 152 * s }, face = { x: 740 * s, y: 269 * s };   // in the painting (head on the right)
    const gx = x + (face.x - grip.x), gy = y - 22 - (face.y - grip.y);            // mirrored, the face lands on (x, y - 22)
    g.save(); g.translate(gx, gy); g.rotate(a); g.scale(-1, 1);
    g.drawImage(img, -grip.x, -grip.y, iw * s, ih * s);
    g.restore();
  }
  function drawSpot(g, S, c, px) {
    const sp = S.spot, p = spotXY(S), r = Math.max(px(15), 34), R = ringR(sp, r), near = clamp(1 - Math.abs(R - r) / (r * 1.2), 0, 1);
    g.globalCompositeOperation = "lighter";
    radial(g, p.x, p.y, r * (1.8 + 0.25 * Math.sin(S.t * 10)), `rgba(255,${190 + Math.round(50 * near)},110,${0.55 + 0.35 * near})`);
    radial(g, p.x, p.y, r * 0.7, "rgba(255,250,225,.9)");
    g.globalCompositeOperation = "source-over";
    g.lineWidth = Math.max(px(2.5), 5); g.strokeStyle = "rgba(255,214,122,.95)"; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.stroke();
    g.lineWidth = Math.max(px(3), 6); g.strokeStyle = `rgba(255,248,230,${0.45 + 0.55 * near})`; g.shadowColor = "#ffd27a"; g.shadowBlur = 12;
    g.beginPath(); g.arc(p.x, p.y, R, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
  }
  function gauge(g, w, h, temp, lo, hi, label) {
    const gw = Math.min(560, w - 32), gh = w < 500 ? 12 : 14, x = (w - gw) / 2, y = w < 500 ? 30 : 36;
    g.fillStyle = "rgba(8,6,5,.66)"; roundRect(g, x - 10, y - 24, gw + 20, gh + 44, 10); g.fill();
    const gr = g.createLinearGradient(x, 0, x + gw, 0); for (let i = 0; i <= 10; i++) gr.addColorStop(i / 10, heatCSS(i / 10));
    g.fillStyle = gr; roundRect(g, x, y, gw, gh, gh / 2); g.fill();
    g.strokeStyle = "#e8c66a"; g.lineWidth = 2.5; g.strokeRect(x + lo * gw, y - 4, (hi - lo) * gw, gh + 8);
    g.fillStyle = "rgba(232,198,106,.22)"; g.fillRect(x + lo * gw, y - 4, (hi - lo) * gw, gh + 8);
    const nx = x + clamp(temp, 0, 1) * gw, inb = temp >= lo && temp <= hi;
    g.fillStyle = inb ? "#fff6d8" : "#ff7a5a"; g.beginPath(); g.moveTo(nx, y - 2); g.lineTo(nx - 7, y - 11); g.lineTo(nx + 7, y - 11); g.closePath(); g.fill();
    g.fillRect(nx - 1.5, y - 2, 3, gh + 4);
    g.font = `600 ${w < 500 ? 11 : 13}px system-ui, sans-serif`; g.textBaseline = "alphabetic"; g.fillStyle = "#e9dcc0";
    g.textAlign = "left"; g.fillText(LX("Cold"), x, y - 9); g.textAlign = "right"; g.fillText(LX("White hot"), x + gw, y - 9);
    g.textAlign = "center"; g.fillStyle = "#f3d58a"; g.fillText(label, clamp(x + (lo + hi) / 2 * gw, x + 60, x + gw - 60), y + gh + 14);
  }
  function pips(g, w, h, S) {
    const n = STRIKES, r = w < 500 ? 6 : 7, gap = r * 3, x0 = w / 2 - (n - 1) * gap / 2, y = h - (w < 500 ? 18 : 24);
    for (let i = 0; i < n; i++) {
      const q = S.strikes[i];
      g.beginPath(); g.arc(x0 + i * gap, y, r, 0, Math.PI * 2);
      g.fillStyle = q == null ? "rgba(20,16,12,.7)" : q > 0.85 ? "#ffe9a8" : q > 0.5 ? "#e8a24a" : q > 0.15 ? "#a0583a" : "#4a3a34";
      g.fill(); g.strokeStyle = "rgba(232,198,106,.8)"; g.lineWidth = 1.5; g.stroke();
    }
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function finish(quick) {
    if (!st) return;
    const { S, o, done } = st;
    const g = quick ? CG.QUICK : CG.grade(S.q || total(S.heatQ, S.strikes, S.quenchQ));
    pending = quick ? null : { id: o.id || null, grade: g, q: S.q };
    close();
    done(g);
  }
  function close() {
    if (!st) return;
    cancelAnimationFrame(st.raf);
    if (st.key) { removeEventListener("keydown", st.key, true); removeEventListener("keyup", st.key, true); }
    st.el?.remove(); st = null; lastDraw = 0;
  }

  // ====================================================================== hooks into crafting (craftgames.js)
  /* one more roll on top of CG.smithMake: great forging may save one piece of the main material */
  function saveRoll(s, id, q, rnd = Math.random) {
    const rc = SMITH.RECIPES[id]; if (!rc) return "";
    const ch = saveChance(q, CG.factor(s, "smith"), perk(s, "forgesave"));
    if (!(ch > 0) || rnd() >= ch) return "";
    const [mat] = rc.mats[0]; G.give(s, mat, 1);
    return ` Not a scrap wasted: you save 1 ${D.ITEMS[mat].name}.`;
  }
  if (typeof CG !== "undefined") {
    const rawRun = CG.run, rawMake = CG.smithMake;
    CG.run = (game, o, done) => (game === "hammer" && DOM && CG.wantsGame() ? play(o || {}, done) : rawRun(game, o, done));
    CG.smithMake = (s, id, g = CG.QUICK, rnd = Math.random) => {
      const p = pending; pending = null;
      const m = rawMake(s, id, g);
      if (!p || p.grade !== g || (p.id && p.id !== id) || !/^You make/.test(m)) return m;
      return m + saveRoll(s, id, p.q, rnd);
    };
  }
  /* tests: hand a result in as if the game had just been played */
  const _pend = (p) => { pending = p; };
  return { STRIKES, SHAPE_AT, TOO_COLD, QUENCH_AT, heatRGB, heatCSS, tune, heatFactor, strikeScore, quenchScore, total, saveChance, saveRoll, create, step, press, reheat, canReheat, simulate, play, close, state: () => st && st.S, _pend, DIMS };
})();
