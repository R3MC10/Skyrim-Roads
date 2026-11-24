/* Crafting mini-games [OURS]: short touch games at the forge, smelter, tanning rack, alchemy lab and arcane enchanter.
   - Smithing (make):   hammer timing. Tap when the swinging marker is in the glowing zone, three strikes.
   - Smelting:          bellows. Hold to pump, keep the heat inside the band until the ingot is poured.
   - Tanning/jewellery: precision. Tap when the closing ring meets the mark, three times.
   - Alchemy:           mixing. Hold to stir; let go when the colour matches the swatch, twice.
   - Enchanting:        rune tracing. Watch the points light up, then tap them in the same order.
   Fairness: "Quick craft" (no game) always gives the plain, average result (grade Good = exactly what crafting gave before).
   Better play gives a small bonus on top (a point or two of temper, a few % strength). Skill still matters most: it sets the
   item itself, and it also makes the games easier (wider zones). Bonuses never add XP, and they fade after the first few
   bonus crafts of each kind in an in-game day. Only very bad play (Botched) can fail, and it gives part of the materials back. */
const CG = (() => {
  const LX = (x) => (typeof I18N_SWEEP !== "undefined" ? I18N_SWEEP.c(x) : x);   // words drawn on canvas, in the player's language
  const DOM = typeof document !== "undefined";
  const params = () => (DOM ? new URLSearchParams(location.search) : new URLSearchParams(""));
  const automated = () => DOM && (navigator.webdriver || params().has("notut"));
  const reduce = () => DOM && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PREFS = "rotn_prefs";
  const pref = (k, d) => { try { const v = JSON.parse(localStorage.getItem(PREFS) || "{}")[k]; return v === undefined ? d : v; } catch { return d; } };
  const setPref = (k, v) => { try { const p = JSON.parse(localStorage.getItem(PREFS) || "{}"); p[k] = v; localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* ignore */ } };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sfx = (n) => { try { if (typeof SOUND !== "undefined") SOUND.fx(n); } catch { /* no audio */ } };

  // ====================================================================== grades and bonuses (pure, tested in Node)
  const GRADES = [["botched", "Botched", 0], ["rough", "Rough", 0.12], ["good", "Good", 0.35], ["great", "Great", 0.62], ["masterful", "Masterful", 0.82], ["perfect", "Perfect", 0.95]];
  const QUICK = "good";
  const NAMES = Object.fromEntries(GRADES.map(([k, n]) => [k, n]));
  function grade(score) { let g = GRADES[0][0]; for (const [k, , min] of GRADES) if (score >= min) g = k; return g; }
  const label = (g) => NAMES[g] || "";
  // what each grade adds (Botched/Rough/Good add nothing)
  const TEMPER_W = { great: 1, masterful: 1, perfect: 2 };      // weapons: +damage (one temper step is +1)
  const TEMPER_A = { great: 1, masterful: 2, perfect: 3 };      // armor: +armor (one temper step is +2)
  const ALCH = { great: 1.04, masterful: 1.07, perfect: 1.10 };  // potion strength
  const ENCHM = { great: 1.03, masterful: 1.06, perfect: 1.10 }; // enchantment magnitude
  const REFINE_EXTRA = { masterful: 1, perfect: 1 };              // one extra ingot or leather per batch
  const FULL = 8, HALF = 16;                                      // bonus crafts per kind per in-game day at full / half strength; then a quarter
  const DAY = 24 * 3600;
  const dayOf = (t) => Math.floor(t * (typeof G !== "undefined" ? G.GAME_SPEED : 12) / DAY);
  const tnow = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  function used(s, kind, t = tnow()) { const c = s.cg; return c && c.d === dayOf(t) ? (c.n[kind] || 0) : 0; }
  function factor(s, kind, t = tnow()) { const n = used(s, kind, t); return n < FULL ? 1 : n < HALF ? 0.5 : 0.25; }
  function count(s, kind, t = tnow()) { const d = dayOf(t); if (!s.cg || s.cg.d !== d) s.cg = { d, n: {} }; s.cg.n[kind] = (s.cg.n[kind] || 0) + 1; }
  /* the bonus a grade gives right now: kind smith|alch|ench|refine, sub "weapon"|"armor" for smithing */
  function bonus(s, kind, g, sub, t = tnow()) {
    const f = factor(s, kind, t);
    if (kind === "smith") return Math.floor(((sub === "weapon" ? TEMPER_W : sub === "armor" ? TEMPER_A : {})[g] || 0) * f);
    if (kind === "alch") return 1 + ((ALCH[g] || 1) - 1) * f;
    if (kind === "ench") return 1 + ((ENCHM[g] || 1) - 1) * f;
    if (kind === "refine") return Math.floor((REFINE_EXTRA[g] || 0) * f);
    return 0;
  }
  const flavour = { rough: "Rough work, but it holds.", great: "Great work.", masterful: "Masterful work!", perfect: "Perfect work!" };
  const note = (g, extra) => (g && g !== QUICK && flavour[g] ? ` ${flavour[g]}${extra ? " " + extra : ""}` : "");

  // ====================================================================== crafting with a grade (wrap the real crafting code)
  const smithSub = (id) => { const it = D.ITEMS[id]; return it.slot === "weapon" ? "weapon" : G.ARMOR_SLOTS.includes(it.slot) ? "armor" : "other"; };
  function smithMake(s, id, g = QUICK) {
    if (g !== "botched") {
      const before = s.nextInv, m = SMITH.make(s, id);
      if (!/^You make/.test(m)) return m;
      const sub = smithSub(id), b = g === QUICK ? 0 : bonus(s, "smith", g, sub);
      const row = s.inv.find((r) => r.id >= before && r.item === id && !STACK(id));
      if (row && sub !== "other" && g !== QUICK && g !== "rough") { row.mw = g; if (b > 0) { row.temper = (row.temper || 0) + b; count(s, "smith"); } }
      return m + note(g, b > 0 ? `+${b} ${sub === "weapon" ? "damage" : "armor"}.` : "");
    }
    if (!SMITH.atForge(s)) return "You need a forge. Every blacksmith has one.";
    const i = SMITH.info(s, id); if (!i) return "You can't make that."; if (i.block) return i.block;
    SMITH.use(s, i.mats);
    const back = i.mats.map(([m, n]) => [m, Math.floor(n / 2)]).filter(([, n]) => n > 0);
    for (const [m, n] of back) G.give(s, m, n);
    const sk = G.useSkill(s, "Smithing", SMITH.xpFor(Math.min(400, D.ITEMS[id].value)) * 0.25);
    return `Botched! The ${D.ITEMS[id].name} cracks on the anvil.${back.length ? ` You save ${SMITH.matText(back)}.` : ""}` + (sk.length ? " " + sk.join(". ") : "");
  }
  const STACK = (id) => { const sl = D.ITEMS[id]?.slot; return !(sl === "weapon" || (typeof G !== "undefined" && G.ARMOR_SLOTS.includes(sl))); };
  function refine(s, k, all = false, g = QUICK) {
    const r = SMITH.REFINE[k]; if (!r) return "Nothing to do.";
    if (!SMITH.atForge(s)) return SMITH.refine(s, k, all);
    const inf = SMITH.refineInfo(s, k);
    if (!inf.times) return SMITH.refine(s, k, all);
    if (g === "botched") {
      const reps = all ? inf.times : 1, out = [];
      if (reps > 1) for (let i = 0; i < reps - 1; i++) out.push(SMITH.refine(s, k, false));
      SMITH.use(s, inf.mats);
      const back = inf.mats.map(([m, n]) => [m, Math.floor(n / 2)]).filter(([, n]) => n > 0);
      for (const [m, n] of back) G.give(s, m, n);
      const what = inf.kind === "smelt" ? "The heat runs wild and the ore turns to slag" : "Your knife slips and the hide tears";
      return (reps > 1 ? `You work ${reps - 1} batch${reps > 2 ? "es" : ""}, but on the last one: ` : "") + `${what}.${back.length ? ` You save ${SMITH.matText(back)}.` : ""}`;
    }
    const m = SMITH.refine(s, k, all);
    if (!/^You (smelt|tan)/.test(m) || g === QUICK) return m;
    const b = bonus(s, "refine", g);
    if (b > 0) { G.give(s, inf.out, b); count(s, "refine"); }
    return m + note(g, b > 0 ? `You get ${b} extra ${D.ITEMS[inf.out].name}.` : "");
  }
  function brew(s, rowIds, g = QUICK) {
    if (g === "botched") return TOWNS.brew(s, rowIds, { botch: true });
    const boost = g === QUICK ? 1 : bonus(s, "alch", g);
    const r = TOWNS.brew(s, rowIds, { boost });
    if (/^You brew/.test(r.text) && boost > 1) { count(s, "alch"); r.text += note(g, `+${Math.round((boost - 1) * 100)}% strength.`); }
    else if (/^You brew/.test(r.text)) r.text += note(g);
    return r;
  }
  function enchant(s, rowId, eff, gemRowId, g = QUICK) {
    if (g === "botched") return ENCH.enchant(s, rowId, eff, gemRowId, { botch: true });
    const boost = g === QUICK ? 1 : bonus(s, "ench", g);
    const m = ENCH.enchant(s, rowId, eff, gemRowId, { boost });
    if (/^The soul pours/.test(m) && boost > 1) { count(s, "ench"); return m + note(g, `+${Math.round((boost - 1) * 100)}% magnitude.`); }
    return /^The soul pours/.test(m) ? m + note(g) : m;
  }

  // ====================================================================== the games (DOM)
  const wantsGame = () => DOM && (params().has("craftgame") || (!automated() && pref("craftGame", true)));
  const pixel = () => typeof ART !== "undefined" && ART.style && ART.style() === "pixel";
  const TITLE = { hammer: "At the anvil", bellows: "At the smelter", precise: "At the workbench", mix: "At the alchemy lab", rune: "At the arcane enchanter" };
  const HINT = {
    hammer: "Tap <b>Strike</b> (or the anvil) when the marker is in the glow. Three strikes.",
    bellows: "Hold <b>Pump</b> to fan the fire. Keep the heat inside the gold band until the ingot pours.",
    precise: "Tap when the closing ring meets the gold mark. Three cuts.",
    mix: "Hold <b>Stir</b>. Let go when the mix matches the colour on the right. Twice.",
    rune: "Watch the points light up, then tap them in the same order.",
  };
  const ACT = { hammer: "Strike", bellows: "Hold to pump", precise: "Cut", mix: "Hold to stir", rune: "" };
  let st = null;
  /* run(game, {skill, what}, done(grade)). Games: hammer, bellows, precise, mix, rune. done gets QUICK when skipped. */
  function run(game, o, done) {
    if (!wantsGame()) return done(QUICK);
    close();
    const sk = clamp(o.skill || 15, 0, 100), ease = 0.7 + 0.6 * sk / 100;     // skill widens every target
    st = { game, o, done, ease, t: 0, scores: [], over: false, holding: false, fx: [], msg: "" };
    init(st);
    const el = document.createElement("div");
    el.id = "craftgame"; el.className = "craftgame";
    el.innerHTML = `<div class="cgcard" role="dialog" aria-label="Crafting mini-game">
      <h3>${esc(TITLE[game])}</h3><p class="cgsub">${esc(o.what || "")}${o.skillName ? ` · ${esc(o.skillName)} ${sk}` : ""}</p>
      <canvas id="cgc" width="300" height="220" aria-hidden="true"></canvas>
      <p class="cghint">${HINT[game]}</p>
      <div class="cgrow"><span id="cgprog"></span>${ACT[game] ? `<button class="btn pri" id="cgact">${ACT[game]}</button>` : ""}</div>
      <div class="cgrow"><button class="btn" id="cgquick">Quick craft</button></div>
      <label class="lppref cgpref"><input type="checkbox" id="cgpref" ${pref("craftGame", true) ? "checked" : ""}> Always play crafting mini-games</label></div>`;
    document.body.appendChild(el);
    const cv = el.querySelector("#cgc"), act = el.querySelector("#cgact");
    const down = (e) => { e.preventDefault(); press(true, e); }, up = (e) => { e.preventDefault(); press(false, e); };
    if (act) { act.addEventListener("pointerdown", down); act.addEventListener("pointerup", up); act.addEventListener("pointerleave", up); act.addEventListener("pointercancel", up); }
    cv.addEventListener("pointerdown", (e) => { e.preventDefault(); if (game === "rune") tapRune(e, cv); else press(true, e); });
    cv.addEventListener("pointerup", (e) => { e.preventDefault(); if (game !== "rune") press(false, e); });
    el.querySelector("#cgquick").onclick = () => finish(QUICK, true);
    el.querySelector("#cgpref").onchange = (e) => setPref("craftGame", e.target.checked);
    let last = performance.now();
    const loop = (now) => { if (!st || st.over) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; try { step(dt); if (st && !st.over) { draw(cv); prog(); } } catch (err) { console.error(err); } if (st && !st.over) st.raf = requestAnimationFrame(loop); };
    st.raf = requestAnimationFrame(loop);
    draw(cv); prog();
  }
  function init(S) {
    const r = Math.random;
    if (S.game === "hammer") Object.assign(S, { pos: 0, dir: 1, speed: 0.85, zone: 0.13 * S.ease, center: 0.35 + r() * 0.3, strikes: 3, hit: 0 });
    if (S.game === "bellows") Object.assign(S, { heat: 0.2, vel: 0, lo: 0.58 - 0.05 * S.ease, hi: 0.72 + 0.05 * S.ease, dur: 5, inBand: 0, warm: 1.2 });
    if (S.game === "precise") Object.assign(S, { R: 46, rr: 120, rspeed: 70, tol: 9 * S.ease, cuts: 3 });
    if (S.game === "mix") Object.assign(S, { mixv: 0, target: 0.4 + r() * 0.45, tol: 0.12 * S.ease, rounds: 2, wait: 0 });
    if (S.game === "rune") {
      const n = 5, pts = [], cx = 150, cy = 112, rad = 76, off = r() * Math.PI * 2;
      const order = [...Array(n).keys()].sort(() => r() - 0.5);
      for (let i = 0; i < n; i++) { const a = off + i * Math.PI * 2 / n; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.9]); }
      Object.assign(S, { pts, order, show: 0, showT: 0, phase: "watch", taps: [], tapT: 0, limit: 3.5 + 1.5 * S.ease, wrong: 0 });
    }
  }
  function press(v, e) {
    const S = st; if (!S || S.over) return;
    if (S.game === "hammer" && v) {
      const d = Math.abs(S.pos - S.center), q = d <= S.zone / 2 ? 1 - 0.15 * (d / (S.zone / 2)) : Math.max(0, 1 - (d - S.zone / 2) / (S.zone * 1.2)) * 0.8;
      S.scores.push(q); S.hit = 0.25; S.speed *= 1.18; sfx("clang");
      for (let i = 0; i < 10 + Math.round(q * 14); i++) S.fx.push(spark(150, 132, q));
      S.msg = q > 0.9 ? "Clean strike!" : q > 0.6 ? "Good strike" : q > 0.2 ? "Off the mark" : "Missed!";
      S.center = 0.25 + Math.random() * 0.5;
      if (S.scores.length >= S.strikes) setTimeout(() => finish(grade(avg(S.scores))), 350);
    }
    if (S.game === "bellows") S.holding = v;
    if (S.game === "precise" && v && S.rr > 0) {
      const d = Math.abs(S.rr - S.R), q = Math.max(0, 1 - Math.max(0, d - S.tol * 0.35) / (S.tol * 1.6));
      S.scores.push(q); S.msg = q > 0.9 ? "A clean cut!" : q > 0.55 ? "Good cut" : "Ragged cut"; sfx("click");
      S.rr = 120 + Math.random() * 20; S.rspeed *= 1.15; S.R = 38 + Math.random() * 22;
      if (S.scores.length >= S.cuts) setTimeout(() => finish(grade(avg(S.scores))), 300);
    }
    if (S.game === "mix") {
      if (v && S.wait <= 0) S.holding = true;
      else if (!v && S.holding) {
        S.holding = false;
        const d = Math.abs(S.mixv - S.target), q = Math.max(0, 1 - Math.max(0, d - S.tol * 0.25) / (S.tol * 1.5));
        S.scores.push(q); S.msg = q > 0.9 ? "Just right!" : q > 0.55 ? "Close" : "Off colour"; sfx("potion");
        if (S.scores.length >= S.rounds) setTimeout(() => finish(grade(avg(S.scores))), 400);
        else { S.mixv = 0; S.target = 0.4 + Math.random() * 0.45; S.wait = 0.4; }
      }
    }
  }
  function tapRune(e, cv) {
    const S = st; if (!S || S.over || S.phase !== "trace") return;
    const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) * 300 / b.width, y = (e.clientY - b.top) * 220 / b.height;
    let best = -1, bd = 1e9; S.pts.forEach(([px, py], i) => { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = i; } });
    if (bd > 34 || S.taps.includes(best)) return;
    const want = S.order[S.taps.length];
    if (best === want) { S.taps.push(best); sfx("spell"); for (let i = 0; i < 8; i++) S.fx.push(spark(S.pts[best][0], S.pts[best][1], 1, "#9fd3ff")); }
    else { S.wrong++; S.taps.push(want); sfx("click"); S.msg = "Wrong point"; }
    if (S.taps.length >= S.order.length) setTimeout(() => finish(grade(runeScore(S))), 350);
  }
  const runeScore = (S) => { const good = (S.order.length - S.wrong) / S.order.length, slow = S.tapT > S.limit ? Math.max(0.6, 1 - (S.tapT - S.limit) * 0.08) : 1; return good * slow; };
  const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const spark = (x, y, q, c) => ({ x, y, vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 140 * (0.4 + q), life: 0.5 + Math.random() * 0.4, c: c || (Math.random() < 0.5 ? "#ffd27a" : "#ff9a3c") });
  function step(dt) {
    const S = st; S.t += dt;
    S.fx = S.fx.filter((p) => (p.life -= dt) > 0); for (const p of S.fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; }
    if (S.game === "hammer") { S.pos += S.dir * S.speed * dt; if (S.pos > 1) { S.pos = 1; S.dir = -1; } if (S.pos < 0) { S.pos = 0; S.dir = 1; } S.hit = Math.max(0, S.hit - dt); }
    if (S.game === "bellows") {
      S.vel += ((S.holding ? 1.1 : 0) - 0.55) * dt * 1.6; S.vel = clamp(S.vel, -0.5, 0.6); S.vel *= 1 - 0.9 * dt;
      S.heat = clamp(S.heat + S.vel * dt * 1.4 + (Math.sin(S.t * 2.3) * 0.02 * dt), 0, 1);
      if (S.warm > 0) S.warm -= dt;
      else { S.dur -= dt; const inb = S.heat >= S.lo && S.heat <= S.hi, near = Math.min(Math.abs(S.heat - S.lo), Math.abs(S.heat - S.hi)); S.inBand += inb ? dt : near < 0.06 ? dt * 0.4 : 0; S.scores = [S.inBand / 5]; }
      if (S.holding && Math.random() < 0.5) S.fx.push(spark(150 + (Math.random() - 0.5) * 50, 150, 0.4));
      if (S.dur <= 0) finish(grade(S.inBand / 5));
    }
    if (S.game === "precise" && S.scores.length < S.cuts) { S.rr -= S.rspeed * dt; if (S.rr <= 4) { S.scores.push(0); S.msg = "Too late!"; S.rr = 120; S.R = 38 + Math.random() * 22; if (S.scores.length >= S.cuts) finish(grade(avg(S.scores))); } }
    if (S.game === "mix") { if (S.wait > 0) S.wait -= dt; if (S.holding) { S.mixv = Math.min(1.05, S.mixv + dt * 0.42); if (S.mixv >= 1.05) press(false); } if (S.holding && Math.random() < 0.3) S.fx.push(spark(150 + (Math.random() - 0.5) * 60, 140, 0.3, mixColour(S.mixv))); }
    if (S.game === "rune") {
      if (S.phase === "watch") { S.showT += dt; const per = 0.55; S.show = Math.floor(S.showT / per); if (S.show === Math.floor((S.showT - dt) / per) + 1 && S.show <= S.order.length) sfx("click"); if (S.showT > per * (S.order.length + 0.6)) { S.phase = "trace"; S.msg = "Now trace it!"; } }
      else S.tapT += dt;
    }
  }
  // blue → teal → green → gold → red: the mix colour as you stir
  const MIXC = [[70, 110, 200], [60, 170, 170], [90, 180, 80], [220, 180, 60], [200, 60, 50]];
  function mixColour(v) { const x = clamp(v, 0, 1) * (MIXC.length - 1), i = Math.min(MIXC.length - 2, Math.floor(x)), f = x - i; const c = MIXC[i].map((a, k) => Math.round(a + (MIXC[i + 1][k] - a) * f)); return `rgb(${c.join(",")})`; }
  function prog() {
    const S = st, el = DOM && document.querySelector("#cgprog"); if (!el || !S) return;
    const g = S.game, k = S.scores.length + 1;
    const n = g === "hammer" ? `Strike ${Math.min(k, 3)} of 3` : g === "precise" ? `Cut ${Math.min(k, 3)} of 3` : g === "mix" ? `Stir ${Math.min(k, 2)} of 2`
      : g === "bellows" ? (S.warm > 0 ? "Get the fire going…" : `Pouring… ${Math.max(0, Math.ceil(S.dur))} s`) : S.phase === "watch" ? "Watch…" : `Point ${Math.min(S.taps.length + 1, 5)} of 5`;
    el.textContent = S.msg ? `${n} · ${S.msg}` : n;
  }

  // ---- drawing: ink (soft light) or pixel (chunky, flat)
  function draw(cv) {
    const S = st; if (!S) return;
    const W = 300, H = 220, c = (typeof FITCANVAS !== "undefined" ? FITCANVAS.fixed(cv, W, H) : cv.getContext("2d")), px = pixel();   // sharp at any screen density (fitcanvas.js)
    c.imageSmoothingEnabled = !px;
    const q = (v) => (px ? Math.round(v / 4) * 4 : v);
    const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(q(x), q(y), Math.max(px ? 4 : 1, q(w)), Math.max(px ? 4 : 1, q(h))); };
    const disc = (x, y, r, col, glow) => { if (px) { c.fillStyle = col; for (let yy = -r; yy <= r; yy += 4) { const w = Math.sqrt(Math.max(0, r * r - yy * yy)); c.fillRect(q(x - w), q(y + yy), q(w * 2) || 4, 4); } return; } c.save(); if (glow) { c.shadowColor = col; c.shadowBlur = glow; } c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.restore(); };
    const ring = (x, y, r, col, w = 3) => { if (px) { c.fillStyle = col; for (let a = 0; a < Math.PI * 2; a += 4 / Math.max(8, r)) c.fillRect(q(x + Math.cos(a) * r - 2), q(y + Math.sin(a) * r - 2), 4, 4); return; } c.save(); c.strokeStyle = col; c.lineWidth = w; c.shadowColor = col; c.shadowBlur = 8; c.beginPath(); c.arc(x, y, Math.max(1, r), 0, Math.PI * 2); c.stroke(); c.restore(); };
    // backdrop: a dark workshop lit by the fire / lamp / arcane glow
    const tint = { hammer: "#ff8a3a", bellows: "#ff6a20", precise: "#d8b070", mix: "#7ac0a0", rune: "#7aa8ff" }[S.game];
    if (px) { rect(0, 0, W, H, "#120f0c"); for (let y = 0; y < H; y += 8) rect(0, y, W, 4, y % 16 ? "#16120e" : "#1a1510"); }
    else { const gr = c.createRadialGradient(150, 150, 10, 150, 120, 220); gr.addColorStop(0, tint + "55"); gr.addColorStop(0.5, "#1a1410"); gr.addColorStop(1, "#070605"); c.fillStyle = gr; c.fillRect(0, 0, W, H); }
    if (S.game === "hammer") {
      // anvil with the glowing work on it, a bar above with the swinging marker
      rect(90, 150, 120, 16, px ? "#4a4a50" : "#3c3d44"); rect(110, 166, 80, 24, px ? "#36363c" : "#2c2d33"); rect(70, 146, 40, 10, "#4a4a50");
      const heat = 0.5 + 0.5 * Math.sin(S.t * 3); rect(118, 140, 70, 8, `rgb(255,${Math.round(120 + 80 * heat)},60)`);
      if (!px) { c.save(); c.shadowColor = "#ff9a3c"; c.shadowBlur = 18; rect(118, 140, 70, 8, "rgba(255,180,90,.9)"); c.restore(); }
      const bx = 24, bw = 252, by = 34;
      rect(bx, by, bw, 18, "#2a2420"); rect(bx + (S.center - S.zone / 2) * bw, by, S.zone * bw, 18, px ? "#d6902a" : "rgba(255,170,60,.85)");
      rect(bx + (S.center - S.zone / 4) * bw, by + 4, S.zone / 2 * bw, 10, "#ffe2a0");
      rect(bx + S.pos * bw - 3, by - 8, 6, 34, "#f4ecd8");
      // the hammer: raised, then down when you strike
      const down = S.hit > 0, hx = 150, hy = down ? 112 : 70, ang = down ? 0.1 : -0.7;
      c.save(); c.translate(q(hx + 34), q(hy + 30)); c.rotate(px ? 0 : ang); rect(-4, -48, 8, 52, "#6b4a2a"); rect(-18, -60, 36, 18, "#8a8c94"); c.restore();
    }
    if (S.game === "bellows") {
      // furnace mouth, a heat gauge with the gold band
      rect(80, 100, 140, 90, px ? "#3a2c22" : "#2e231b"); const h = S.heat;
      disc(150, 150, 22 + 20 * h, `rgb(255,${Math.round(90 + 140 * h)},${Math.round(30 + 60 * h)})`, px ? 0 : 30);
      const gx = 246, gy = 30, gh = 160; rect(gx, gy, 22, gh, "#231d18");
      rect(gx, gy + (1 - S.hi) * gh, 22, (S.hi - S.lo) * gh, px ? "#c9a040" : "rgba(214,178,94,.8)");
      rect(gx - 6, gy + (1 - h) * gh - 3, 34, 6, h >= S.lo && h <= S.hi ? "#ffe9a8" : "#ff6a4a");
      // the bellows themselves squeeze while you pump
      const sq = S.holding ? 0.6 + 0.2 * Math.sin(S.t * 18) : 1;
      rect(24, 120, 44, 40 * sq, "#6b4a2a"); rect(60, 134, 26, 10, "#4a4a50");
      // pour progress
      rect(24, 30, 200, 10, "#231d18"); rect(24, 30, 200 * clamp(S.inBand / 5, 0, 1), 10, "#d6b25e");
    }
    if (S.game === "precise") {
      // a hide on the rack / a gem on the bench, the mark and the closing ring
      if (px) { rect(70, 50, 160, 130, "#6a4a30"); rect(78, 58, 144, 114, "#7a5838"); } else { c.save(); c.fillStyle = "#6e4c30"; c.beginPath(); c.ellipse(150, 115, 86, 66, 0.1, 0, Math.PI * 2); c.fill(); c.restore(); }
      ring(150, 115, S.R, "#ffd27a", 4); ring(150, 115, S.rr, "#f4ecd8", 2);
    }
    if (S.game === "mix") {
      // mortar/flask with the mix colour; the target swatch on the right
      const col = mixColour(S.mixv);
      rect(70, 70, 120, 110, "#2a2622"); rect(78, 90 + (1 - Math.min(1, S.mixv * 0.6 + 0.4)) * 60, 104, 86 - (1 - Math.min(1, S.mixv * 0.6 + 0.4)) * 60, col);
      if (!px) { c.save(); c.globalAlpha = 0.35; disc(130, 120, 50, col, 30); c.restore(); }
      rect(214, 70, 60, 60, "#231d18"); rect(220, 76, 48, 48, mixColour(S.target));
      c.fillStyle = "#cfc6b0"; c.font = "12px sans-serif"; c.textAlign = "center"; c.fillText(LX("Aim"), 244, 146);
      rect(24, 200, 252, 8, "#231d18"); for (let i = 0; i < 25; i++) rect(24 + i * 10.08, 200, 10.1, 8, mixColour(i / 24));
      rect(24 + clamp(S.mixv, 0, 1) * 252 - 2, 194, 4, 20, "#f4ecd8");
    }
    if (S.game === "rune") {
      ring(150, 112, 92, "rgba(122,168,255,.35)", 2);
      if (!px) { c.save(); c.strokeStyle = "rgba(160,200,255,.9)"; c.lineWidth = 3; c.shadowColor = "#9fd3ff"; c.shadowBlur = 12; c.beginPath(); S.taps.forEach((i, k) => { const [x, y] = S.pts[i]; k ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); c.restore(); }
      else for (let k = 1; k < S.taps.length; k++) { const [x1, y1] = S.pts[S.taps[k - 1]], [x2, y2] = S.pts[S.taps[k]]; for (let f = 0; f <= 1; f += 0.06) rect(x1 + (x2 - x1) * f - 2, y1 + (y2 - y1) * f - 2, 4, 4, "#a8c8ff"); }
      S.pts.forEach(([x, y], i) => {
        const lit = S.phase === "watch" && S.order[S.show] === i, done = S.taps.includes(i);
        disc(x, y, lit ? 15 : 11, lit ? "#e8f4ff" : done ? "#9fd3ff" : "#3a4a70", lit ? 26 : done ? 12 : 0);
      });
    }
    for (const p of S.fx) rect(p.x, p.y, px ? 4 : 3, px ? 4 : 3, p.c);
  }
  function finish(g, quick) {
    if (!st || st.over) return;
    const S = st; S.over = true; cancelAnimationFrame(S.raf);
    const el = DOM && document.querySelector("#craftgame");
    if (el && !quick) { const c = el.querySelector(".cgcard"); const b = document.createElement("div"); b.className = `cgresult g-${g}`; b.textContent = label(g); c.appendChild(b); if (g === "perfect" || g === "masterful") sfx("coin"); }
    setTimeout(() => { close(); S.done(g); }, quick || reduce() ? 0 : 700);
  }
  function close() { if (st?.raf) cancelAnimationFrame(st.raf); if (DOM) document.querySelector("#craftgame")?.remove(); st = null; }

  // which game goes with which job
  const gameFor = (kind, id) => kind === "smith" ? (SMITH.RECIPES[id]?.group === "jewel" ? "precise" : "hammer") : kind === "refine" ? (SMITH.REFINE[id]?.[3] === "smelt" ? "bellows" : "precise") : kind === "alch" ? "mix" : "rune";
  return { GRADES, QUICK, grade, label, bonus, factor, used, count, smithMake, refine, brew, enchant, run, close, gameFor, wantsGame, mixColour, state: () => st, _finish: finish, _press: press, runeScore };
})();
