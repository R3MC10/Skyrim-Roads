/* Fishing mini-game. [OURS rules; fish names from Skyrim's fishing update]
   Remigiusz: "There should be mini games everywhere." Replaces the old one-tap needle (cooking.js keeps the fish, recipes
   and the old bite/reel helpers; this file owns the game you play).
   - Cast: a power meter swings; tap to cast. A long cast reaches deeper water where rare fish swim.
   - Wait: the float bobs, small nibbles make it twitch. When it goes right under, tap to set the hook. Too soon scares it.
   - Reel: hold to reel in. The line's tension climbs while you reel and drops when you let go. Keep the needle in the safe
     band: over the top the line snaps, too slack for too long and the fish throws the hook. Fish make runs (they pull
     hard for a moment); ease off and let them tire.
   - What bites depends on the water (river, lake, sea), the hold (Arctic Char in the cold north, Brook Bass in the green
     south), the time (Glass Catfish and Vampire Fish at night) and the weather (Goldfish only in the rain).
   - Rods come in three tiers (general store, then the forge's Tools tab): a wider safe band, a stronger line, more rare bites.
   - Cleaning a catch sometimes gives alchemy ingredients (Salmon Roe, pearls, Slaughterfish Eggs). Fish cook and sell.
   Perks: Angler, Line Sense, Deep Waters (Alchemy, the gathering side). */
const FISHGAME = (() => {
  const DOM = typeof document !== "undefined";
  const perk = (s, k) => (typeof PFX !== "undefined" ? +PFX.num(s, k) || 0 : 0);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const L = (x) => { try { if (typeof I18N !== "undefined" && I18N.lang() === "pl") return I18N.tr(x) ?? x; } catch { /* no translator */ } return x; };
  const sfx = (n) => { try { if (typeof SOUND !== "undefined") SOUND.fx(n); } catch { /* no audio */ } };
  const buzz = (p) => { try { if (DOM && navigator.vibrate) navigator.vibrate(p); } catch { /* not allowed */ } };

  // ====================================================================== rods
  // tier, wider safe band, line strength (tension climbs slower), more rare bites
  const RODS = {
    fishing_rod: { tier: 1, band: 0, line: 1, rare: 0 },
    rod_fine: { tier: 2, band: 0.15, line: 1.15, rare: 0.3 },
    rod_master: { tier: 3, band: 0.3, line: 1.3, rare: 0.6 },
  };
  Object.assign(D.ITEMS, {
    rod_fine: { name: "Fine Fishing Rod", slot: "misc", weight: 3, value: 120, desc: "Fishing: a wider safe band, a stronger line and more rare bites." },
    rod_master: { name: "Master Angler's Rod", slot: "misc", weight: 3, value: 400, desc: "Fishing: a much wider safe band, the strongest line, and rare fish bite far more often." },
  });
  if (D.ITEMS.fishing_rod && !D.ITEMS.fishing_rod.desc) D.ITEMS.fishing_rod.desc = "Fishing: cast near a river, lake or the sea.";
  if (!D.SHOP_STOCK.general.includes("rod_fine")) D.SHOP_STOCK.general.push("rod_fine");
  /* the best rod in the pack */
  function rodOf(s) {
    let best = null;
    for (const r of s.inv || []) { const R = RODS[r.item]; if (R && (!best || R.tier > best.tier)) best = { id: r.item, ...R, name: D.ITEMS[r.item].name }; }
    return best;
  }

  // ====================================================================== fish
  const COLD = ["Winterhold", "The Pale", "Solstheim"];
  const WARM = ["Falkreath", "The Rift", "Whiterun", "Eastmarch", "Hjaalmarch", "The Reach"];
  // id: [name, value, weight, {river, lake, sea: bite weight}, opts]
  //   opts: str 1-5 (how hard it fights), rare, time "day"|"night", holds (only there), cold (only cold holds),
  //         wx {weather id: weight ×}, wxOnly (only in that weather), holdX {hold: ×}, gut [[ingredient, chance]]
  const NEW = {
    fish_char: ["Arctic Char", 15, 0.3, { river: 14, lake: 14, sea: 10 }, { str: 3, cold: 1 }],
    fish_grayling: ["Arctic Grayling", 25, 0.3, { river: 8 }, { str: 3, cold: 1, rare: 1 }],
    fish_brookbass: ["Brook Bass", 12, 0.3, { river: 14, lake: 8 }, { str: 2, holds: WARM, time: "day" }],
    fish_carp: ["Carp", 8, 0.4, { lake: 20, river: 4 }, { str: 2 }],
    fish_sunfish: ["Pygmy Sunfish", 6, 0.1, { lake: 12, river: 6 }, { str: 1, holds: ["Eastmarch", "The Rift", "Hjaalmarch"], time: "day" }],
    fish_glasscat: ["Glass Catfish", 40, 0.3, { lake: 5, river: 3 }, { str: 3, rare: 1, time: "night" }],
    fish_vampire: ["Vampire Fish", 45, 0.3, { river: 3, lake: 4 }, { str: 4, rare: 1, time: "night", holdX: { Hjaalmarch: 2 }, wx: { fog: 2, storm: 2 } }],
    fish_pearlfish: ["Pearlfish", 25, 0.3, { sea: 8 }, { str: 2, gut: [["ing_small_pearl", 0.5], ["ing_pearl", 0.15]] }],
    fish_glassfish: ["Glassfish", 35, 0.3, { sea: 5 }, { str: 3, rare: 1, cold: 1 }],
    fish_lyretail: ["Lyretail Anthias", 35, 0.2, { sea: 4 }, { str: 2, rare: 1, time: "day" }],
    fish_pogfish: ["Pogfish", 30, 0.4, { lake: 4, river: 2 }, { str: 3, rare: 1, wx: { rain: 2.5, storm: 2 } }],
    fish_goldfish: ["Goldfish", 120, 0.2, { river: 0.8, lake: 0.8, sea: 0.8 }, { str: 5, rare: 1, wxOnly: ["rain", "storm"] }],
  };
  // the fish cooking.js already had: how they bite here
  const OLD = {
    fish_salmon: [{ river: 30, sea: 12 }, { str: 2, gut: [["ing_salmon_roe", 0.35]] }],
    fish_betty: [{ river: 16 }, { str: 1 }],
    fish_perch: [{ river: 16, lake: 18 }, { str: 2 }],
    fish_histcarp: [{ lake: 26 }, { str: 2 }],
    fish_spadetail: [{ lake: 10 }, { str: 3, rare: 1 }],
    fish_longfin: [{ sea: 26 }, { str: 3 }],
    fish_slaughterfish: [{ river: 7, lake: 9, sea: 12 }, { str: 4, gut: [["ing_slaughterfish_egg", 0.4]] }],
    fish_mudcrab: [{ river: 5, lake: 6, sea: 12 }, { str: 1, gut: [["ing_mudcrab", 0.5]] }],
  };
  const FISH = {};
  for (const [id, [w, o]] of Object.entries(OLD)) FISH[id] = { id, w, ...o };
  for (const [id, [name, value, weight, w, o]] of Object.entries(NEW)) {
    FISH[id] = { id, w, ...o };
    if (!D.ITEMS[id]) D.ITEMS[id] = { name, slot: "food", value, weight, raw: true };
    if (typeof COOK !== "undefined" && !COOK.FISH.includes(id)) COOK.FISH.push(id);   // counts as "any fish" in recipes
  }
  // [Skyrim] Slaughterfish Egg, an alchemy ingredient
  if (typeof TOWNS !== "undefined" && TOWNS.INGREDIENT_FX && !TOWNS.INGREDIENT_FX.ing_slaughterfish_egg) {
    TOWNS.INGREDIENT_FX.ing_slaughterfish_egg = ["Slaughterfish Egg", ["Resist Poison", "Fortify Sneak", "Lingering Damage Health", "Fortify Stamina"], 3, 0.2];
    D.ITEMS.ing_slaughterfish_egg = { name: "Slaughterfish Egg", slot: "ingredient", weight: 0.2, value: 3 };
  }

  // ====================================================================== the rules (pure, tested in Node)
  const nowS = () => Date.now() / 1000;
  /* seeded rolls: a cast is decided by shared things (the water, the hold, the weather, the in-game hour, which cast of the sitting
     it is), so friends fishing side by side get the same fish, bite and fight on every phone */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = typeof seed === "number" ? seed >>> 0 : hash(String(seed)); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const HOUR = () => 3600 / ((typeof G !== "undefined" && G.GAME_SPEED) || 12);
  function castSeed(ctx, n = 0, t = (typeof G !== "undefined" ? G.now() : nowS())) {
    return ["fish", ctx.water || "", ctx.hold || "", ctx.wx || "", ctx.night ? 1 : 0, Math.floor(t / HOUR()), Math.round((ctx.cast || 0.5) * 4), n].join("|");
  }
  /* where and when you're fishing */
  function context(s, pos, t = nowS()) {
    const water = typeof COOK !== "undefined" ? COOK.waterNear(pos) : null;
    let hold = "", wx = "clear", night = false;
    try { hold = G.holdAt(pos); } catch { /* no map */ }
    try { night = G.isNight(t); } catch { /* no clock */ }
    try { if (typeof WEVENTS !== "undefined") wx = WEVENTS.weather(pos, t).id; } catch { /* fine */ }
    return { water, hold, night, wx, cast: 0.5 };
  }
  /* can you fish here: {err} or {water} */
  function canFish(s, pos) {
    if (s.trip?.status === "travel" || s.trip?.status === "encounter") return { err: "Stop walking first." };
    if (s.dungeon) return { err: "No fishing in a dungeon." };
    const w = typeof COOK !== "undefined" ? COOK.waterNear(pos) : null;
    if (!w) return { err: "There's no water close enough. Try a town by a lake, river or the sea." };
    if (!rodOf(s)) return { err: "You need a fishing rod. General stores sell them." };
    return { water: w };
  }
  /* the weight of each fish biting here: [[id, weight]] */
  function table(s, ctx) {
    const rod = rodOf(s) || RODS.fishing_rod, out = [];
    const rareX = (1 + rod.rare + perk(s, "fishrare")) * (ctx.wx === "rain" || ctx.wx === "storm" ? 1.5 : 1) * (1 + Math.max(0, (ctx.cast ?? 0.5) - 0.6) * 1.5);
    for (const f of Object.values(FISH)) {
      let w = f.w[ctx.water] || 0;
      if (!w) continue;
      if (f.holds && !f.holds.includes(ctx.hold)) continue;
      if (f.cold && !COLD.includes(ctx.hold)) continue;
      if (f.wxOnly && !f.wxOnly.includes(ctx.wx)) continue;
      if (f.time === "day" && ctx.night) w *= 0.15;
      if (f.time === "night" && !ctx.night) w *= ctx.wx === "fog" || ctx.wx === "storm" ? 0.3 : 0;
      if (f.holdX?.[ctx.hold]) w *= f.holdX[ctx.hold];
      if (f.wx?.[ctx.wx]) w *= f.wx[ctx.wx];
      if (f.rare) w *= rareX;
      if (w > 0) out.push([f.id, w]);
    }
    return out;
  }
  function roll(s, ctx, rnd = Math.random) {
    const list = table(s, ctx), tot = list.reduce((a, [, w]) => a + w, 0);
    let r = rnd() * tot;
    for (const [id, w] of list) if ((r -= w) < 0) return id;
    return list.length ? list[list.length - 1][0] : "fish_salmon";
  }
  /* how long until the real bite, and how many nibbles before it (seconds) */
  function waitFor(ctx, rnd = Math.random) {
    const k = ctx.wx === "rain" || ctx.wx === "storm" ? 0.7 : ctx.wx === "snow" || ctx.wx === "blizzard" ? 1.3 : 1;
    const at = (2.2 + rnd() * 3.6) * k * (1 + Math.max(0, (ctx.cast ?? 0.5) - 0.6));
    const nib = [];
    for (let k2 = 0, n = Math.floor(rnd() * 3); k2 < n; k2++) nib.push(0.6 + rnd() * Math.max(0.2, at - 1.4));
    return { at, nib: nib.sort((a, b) => a - b) };
  }
  const BITE = 0.9;   // seconds the float stays under
  const biteWindow = (s) => BITE * (1 + perk(s, "fishbite"));
  /* a fresh fight on the line */
  function hook(s, id, rnd = Math.random) {
    const f = FISH[id] || { str: 2 }, rod = rodOf(s) || RODS.fishing_rod, str = f.str || 2;
    const hw = Math.max(0.08, (0.17 - str * 0.012) * (1 + rod.band + perk(s, "fishband")));
    const c = 0.56;
    return { id, str, line: rod.line, band: [Math.max(0.12, c - hw), Math.min(0.94, c + hw)], tension: 0.3, dist: 1, stam: 1, slack: 0,
      slackMax: 1.6 * (1 + perk(s, "fishslack")), tire: 1 + perk(s, "fishtire"), run: 0, runIn: 1 + rnd() * 1.5, t: 0, over: null, rnd };
  }
  /* one step of the fight: holding = reeling in. Sets g.over to "landed" | "snap" | "slip" */
  function step(g, holding, dt) {
    if (g.over) return g;
    g.t += dt;
    if (g.run > 0) g.run -= dt;
    else if ((g.runIn -= dt) <= 0) { g.run = (0.5 + g.rnd() * 0.9) * (0.6 + g.str / 5) * (0.5 + 0.5 * g.stam); g.runIn = 1.2 + g.rnd() * 2.4; }
    const running = g.run > 0, pull = (0.22 + 0.12 * g.str) * (running ? 2 : 0.55) * (0.35 + 0.65 * g.stam);
    if (holding) {
      g.tension += (0.3 + pull * 0.55) * dt / g.line;
      g.dist -= Math.max(0.02, 0.2 - pull * (running ? 0.2 : 0.1)) * dt;
    } else {
      g.tension -= (0.5 - pull * 0.3) * dt;
      g.dist = Math.min(1.25, g.dist + pull * 0.05 * dt);
    }
    g.tension = Math.max(0, g.tension);
    const [lo, hi] = g.band;
    if (g.tension >= 1) { g.over = "snap"; return g; }
    if (g.tension < lo) { g.slack += dt; if (g.slack > g.slackMax) { g.over = "slip"; return g; } }
    else { g.slack = Math.max(0, g.slack - dt * 2); g.stam = Math.max(0, g.stam - 0.05 * g.tire * dt * (holding ? 1.4 : 1) * (g.tension > hi ? 2 : 1)); }
    if (g.dist <= 0) g.over = "landed";
    else if (g.t > 60) g.over = "slip";
    return g;
  }
  /* what cleaning the catch gives */
  function gut(s, id, rnd = Math.random) {
    const got = [], k = 1 + perk(s, "fishgut");
    for (const [ing, ch] of FISH[id]?.gut || []) if (D.ITEMS[ing] && rnd() < Math.min(0.95, ch * k)) got.push(ing);
    const water = Object.keys(FISH[id]?.w || {});
    if (water.length === 1 && water[0] === "sea" && D.ITEMS.ing_small_pearl && rnd() < 0.04 * k) got.push("ing_small_pearl");
    return got;
  }
  /* land it: into the pack */
  function land(s, id, rnd = Math.random) {
    G.give(s, id);
    const extra = gut(s, id, rnd);
    for (const i of extra) G.give(s, i);
    s.stats = { ...(s.stats || {}), fish: ((s.stats || {}).fish || 0) + 1 };
    s.fishLog = { ...(s.fishLog || {}), [id]: ((s.fishLog || {})[id] || 0) + 1 };
    const nm = D.ITEMS[id].name, first = s.fishLog[id] === 1;
    return { item: id, extra, first, text: `You land it: ${nm}!` + (extra.length ? ` Cleaning it gives you ${extra.map((i) => D.ITEMS[i].name).join(" and ")}.` : "") + (first ? " First of its kind for you." : "") };
  }
  const isRare = (id) => !!FISH[id]?.rare;

  // ====================================================================== the screen
  const W = 560, H = 300, WL = 132;   // drawing units; the waterline
  let st = null;
  const WATER = { river: "A river", lake: "A lake", sea: "The Sea of Ghosts" };
  /* open the game. done() runs when the player closes it */
  function play(s, pos, opts = {}) {
    if (!DOM) return;
    const c = canFish(s, pos);
    if (c.err) return c.err;
    close();
    const ctx = context(s, pos), rod = rodOf(s);
    st = { s, pos, ctx, rod, phase: "aim", t0: performance.now(), last: performance.now(), held: false, raf: 0, opts, caught: 0, msg: "", g: null, ripple: [], drops: [], result: null };
    const el = document.createElement("div");
    el.id = "fishgame"; el.className = "craftgame fhgame";
    const wxName = typeof WEVENTS !== "undefined" ? (() => { try { return WEVENTS.weather(pos).name; } catch { return ""; } })() : "";
    el.innerHTML = `<div class="cgcard fhcard" role="dialog" aria-label="Fishing">
      <h3>🎣 Fishing</h3><p class="cgsub">${esc(WATER[ctx.water] || "Water")}${ctx.hold ? " · " + esc(ctx.hold) : ""}${wxName ? " · " + esc(wxName) : ""}${ctx.night ? " · night" : ""} · ${esc(rod.name)}</p>
      <canvas id="fhcv" width="${W}" height="${H}" aria-hidden="true"></canvas>
      <div class="fhmeter" id="fhmeter" aria-hidden="true"><i class="fhband"></i><i class="fhdanger"></i><b class="fhneedle"></b></div>
      <div class="fhdist" id="fhdist" aria-hidden="true"><i></i></div>
      <p class="fhmsg" id="fhmsg" aria-live="polite"></p>
      <div class="cgrow"><button class="btn pri fhbig" id="fhbtn">Cast</button><button class="btn" id="fhdone">Done</button></div>
      <p class="cghint" id="fhhint">Tap (or press Space) when the power bar is high for a long cast.</p></div>`;
    document.body.appendChild(el);
    const btn = el.querySelector("#fhbtn"), cv = el.querySelector("#fhcv");
    for (const t of [btn, cv]) {
      t.addEventListener("pointerdown", (e) => { e.preventDefault(); down(); });
      t.addEventListener("pointerup", up); t.addEventListener("pointercancel", up); t.addEventListener("pointerleave", up);
    }
    el.querySelector("#fhdone").onclick = () => finish();
    st.key = (e) => { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); if (e.type === "keydown") { if (!e.repeat) down(); } else up(); } else if (e.code === "Escape" && e.type === "keydown") finish(); };
    addEventListener("keydown", st.key); addEventListener("keyup", st.key);
    setPhase("aim");
    const loop = (ts) => { if (!st) return; tick(Math.min(0.05, (ts - st.last) / 1000)); st.last = ts; draw(ts); st.raf = requestAnimationFrame(loop); };
    st.raf = requestAnimationFrame(loop);
    return "";
  }
  function setPhase(p, msg) {
    st.phase = p; st.pt = 0;
    if (p === "aim") { st.bit = false; st.result = null; st.wait = null; st.g = null; st.ripple = []; }
    const el = document.querySelector("#fishgame"); if (!el) return;
    const btn = el.querySelector("#fhbtn"), hint = el.querySelector("#fhhint");
    const lab = { aim: "Cast", fly: "…", wait: "Hook!", reel: "Reel (hold)", done: "Cast again" }[p];
    btn.textContent = lab; btn.disabled = p === "fly";
    hint.textContent = { aim: "Tap (or press Space) when the power bar is high for a long cast.", fly: "", wait: "Wait for the float to go right under, then tap. Twitches are only nibbles.",
      reel: "Hold to reel, let go to ease off. Keep the needle in the pale band: too tight snaps the line, too slack lets it go.", done: "" }[p];
    el.querySelector("#fhmeter").classList.toggle("on", p === "reel" || p === "aim");
    el.querySelector("#fhdist").classList.toggle("on", p === "reel");
    if (msg != null) el.querySelector("#fhmsg").textContent = msg;
    if (p === "aim") placeBand([0.62, 0.94], true);
    if (p === "reel") placeBand(st.g.band, false);
  }
  function placeBand([a, b], aim) {
    const el = document.querySelector("#fishgame"); if (!el) return;
    Object.assign(el.querySelector(".fhband").style, { left: (a * 100).toFixed(1) + "%", width: ((b - a) * 100).toFixed(1) + "%" });
    el.querySelector(".fhdanger").style.display = aim ? "none" : "";
    el.querySelector("#fhmeter").classList.toggle("aim", !!aim);
  }
  const power = () => { const p = (st.pt * 0.85) % 2; return p < 1 ? p : 2 - p; };
  function down() {
    if (!st) return;
    st.held = true;
    const p = st.phase;
    if (p === "aim") {
      st.ctx.cast = 0.15 + power() * 0.85; st.held = false;
      st.seed = castSeed(st.ctx, st.casts = (st.casts || 0) + 1);
      st.wait = waitFor(st.ctx, rng(st.seed + "|wait")); st.fish = roll(st.s, st.ctx, rng(st.seed + "|fish"));
      sfx("click"); setPhase("fly", st.ctx.cast > 0.8 ? "A long cast, out over the deep water." : st.ctx.cast < 0.4 ? "A short cast, close to the bank." : "You cast your line.");
    } else if (p === "wait") {
      st.held = false;
      const tw = st.pt - st.wait.at;
      if (tw >= 0 && tw <= biteWindow(st.s)) {
        st.g = hook(st.s, st.fish, rng(st.seed + "|hook")); sfx("hit"); buzz([30, 40, 30]);
        setPhase("reel", isRare(st.fish) ? "It's heavy! Something rare is on the line." : "Hooked! Reel it in.");
      } else { sfx("miss"); end("Too soon. The splash scares it off."); }
    } else if (p === "done") { st.held = false; setPhase("aim", ""); }
  }
  function up() { if (st) st.held = false; }
  function end(text, ok) {
    st.result = ok || null; st.msg = text; setPhase("done", text);
  }
  function tick(dt) {
    st.pt += dt;
    const p = st.phase;
    if (p === "fly" && st.pt > 0.7) { setPhase("wait"); st.ripple.push({ x: bobX(), t: 0 }); }
    else if (p === "wait") {
      if (st.wait.nib.length && st.pt >= st.wait.nib[0]) { st.wait.nib.shift(); st.ripple.push({ x: bobX(), t: 0, small: 1 }); buzz(8); }
      if (!st.bit && st.pt >= st.wait.at) { st.bit = true; st.ripple.push({ x: bobX(), t: 0 }); sfx("click"); buzz(60); }
      if (st.pt > st.wait.at + biteWindow(st.s)) { st.bit = false; end("Too slow. It stole your bait."); }
    } else if (p === "reel") {
      const g = step(st.g, st.held, dt);
      const el = document.querySelector("#fishgame");
      if (el) {
        el.querySelector(".fhneedle").style.left = (Math.min(1, g.tension) * 100).toFixed(1) + "%";
        el.querySelector("#fhdist i").style.width = (Math.max(0, 1 - g.dist) * 100).toFixed(1) + "%";
        el.querySelector("#fhmeter").classList.toggle("hot", g.tension > g.band[1]);
        el.querySelector("#fhmeter").classList.toggle("slack", g.tension < g.band[0]);
      }
      if (g.run > 0 && !st.wasRun) buzz(20);
      st.wasRun = g.run > 0;
      if (g.over === "landed") {
        const r = land(st.s, st.fish, rng(st.seed + "|land")); st.caught++; st.landed = r.item;
        sfx("coin"); buzz([20, 30, 60]);
        if (typeof GUIDE !== "undefined") try { GUIDE.mark(st.s, "fish"); } catch { /* fine */ }
        st.opts.onCatch?.(r);
        end(r.text, r);
      } else if (g.over === "snap") { sfx("miss"); buzz(120); end(["Snap! The line breaks.", "Too tight: the line parts with a crack."][hash(st.seed) % 2]); }
      else if (g.over === "slip") { sfx("miss"); end(["The line goes slack. It threw the hook.", "A flick of the tail and it's gone."][hash(st.seed) % 2]); }
    } else if (p === "aim") {
      const el = document.querySelector("#fishgame"); if (el) el.querySelector(".fhneedle").style.left = (power() * 100).toFixed(1) + "%";
    }
    if (p !== "done") st.bit = p === "wait" ? st.bit : false;
    st.ripple = st.ripple.filter((r) => (r.t += dt) < 1.4);
  }
  const bobX = () => 210 + (st.ctx.cast || 0.5) * 290;

  // ---- ink drawing
  const INK = "#231d17";
  const FISHCOL = { fish_salmon: "#c9785a", fish_betty: "#8f9a6a", fish_perch: "#b9c1c4", fish_histcarp: "#8c7a4e", fish_spadetail: "#6a8fb0", fish_longfin: "#5d7fa3", fish_slaughterfish: "#6c6a5a",
    fish_mudcrab: "#8a5a3a", fish_char: "#c06a4e", fish_grayling: "#8a93a8", fish_brookbass: "#6f8a4f", fish_carp: "#a98a4a", fish_sunfish: "#d0a040", fish_glasscat: "#cfe3ea",
    fish_vampire: "#7a3a52", fish_pearlfish: "#e6e0d2", fish_glassfish: "#a8d8e8", fish_lyretail: "#e07a8a", fish_pogfish: "#9a8a6a", fish_goldfish: "#f0b030" };
  function draw(ts) {
    const cv = document.querySelector("#fhcv"); if (!cv) return;
    const g = typeof FITCANVAS !== "undefined" ? FITCANVAS.fixed(cv, W, H) : cv.getContext("2d");
    const night = st.ctx.night, wx = st.ctx.wx, T = ts / 1000;
    // sky and far hills: an ink wash
    const sky = g.createLinearGradient(0, 0, 0, WL);
    sky.addColorStop(0, night ? "#1d2430" : wx === "rain" || wx === "storm" ? "#8d9396" : wx === "snow" || wx === "blizzard" ? "#c9ccce" : "#d8cfb8");
    sky.addColorStop(1, night ? "#3a4250" : "#e9e1cc");
    g.fillStyle = sky; g.fillRect(0, 0, W, WL);
    if (night) { g.fillStyle = "#e9e3cf"; g.beginPath(); g.arc(470, 34, 13, 0, 7); g.fill(); g.fillStyle = "#1d2430"; g.beginPath(); g.arc(476, 30, 12, 0, 7); g.fill(); }
    g.fillStyle = night ? "#2b3340" : "#a7a58f"; g.strokeStyle = INK; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, WL); for (let x = 0; x <= W; x += 20) g.lineTo(x, WL - 22 - 16 * Math.sin(x / 70) - 10 * Math.sin(x / 23 + 1)); g.lineTo(W, WL); g.closePath(); g.fill(); g.stroke();
    if (st.ctx.water === "sea") { g.fillStyle = night ? "#39424e" : "#cfd3cc"; g.fillRect(0, WL - 6, W, 6); }
    // water
    const wa = g.createLinearGradient(0, WL, 0, H);
    wa.addColorStop(0, night ? "#2c3946" : "#9fb2ad"); wa.addColorStop(1, night ? "#151c24" : "#5d7470");
    g.fillStyle = wa; g.fillRect(0, WL, W, H - WL);
    g.strokeStyle = night ? "rgba(220,230,240,.25)" : "rgba(35,29,23,.35)"; g.lineWidth = 1;
    for (let k = 0; k < 14; k++) {
      const y = WL + 8 + k * 12 + (k % 2) * 3, off = (T * (12 + k * 2) + k * 53) % 80;
      g.beginPath();
      for (let x = -80 + off; x < W; x += 80) { g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 3, x + 28 + k, y); }
      g.stroke();
    }
    // weather strokes
    if (wx === "rain" || wx === "storm") { g.strokeStyle = "rgba(35,29,23,.35)"; g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 60; k++) { const x = (k * 97 + T * 260) % (W + 40) - 20, y = (k * 53 + T * 420) % H; g.moveTo(x, y); g.lineTo(x - 5, y + 12); } g.stroke(); }
    if (wx === "snow" || wx === "blizzard") { g.fillStyle = "rgba(250,250,250,.85)"; for (let k = 0; k < 50; k++) { const x = (k * 89 + T * 30 + 20 * Math.sin(T + k)) % W, y = (k * 41 + T * 40) % H; g.fillRect(x, y, 2, 2); } }
    if (wx === "fog") { g.fillStyle = "rgba(230,228,220,.35)"; g.fillRect(0, WL - 40, W, 80); }
    // bank and reeds
    g.fillStyle = night ? "#20262c" : "#6a6048"; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, H); g.lineTo(0, 210); g.quadraticCurveTo(60, 200, 110, 230); g.quadraticCurveTo(150, 262, 170, H); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 1.3;
    for (let k = 0; k < 9; k++) { const x = 8 + k * 15, sw = Math.sin(T * 1.3 + k) * 3; g.beginPath(); g.moveTo(x, 222 + (k % 3) * 6); g.quadraticCurveTo(x + sw, 190, x + 4 + sw * 1.6, 168 + (k % 4) * 7); g.stroke(); }
    // rod
    const p = st.phase, tipX = 170, tipY = 64 + (p === "reel" ? Math.min(30, st.g.tension * 30) : 0) + (p === "aim" ? -power() * 18 : 0);
    g.strokeStyle = "#3b2a1a"; g.lineWidth = 4; g.beginPath(); g.moveTo(30, 262); g.lineTo(tipX, tipY); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.moveTo(30, 262); g.lineTo(tipX, tipY); g.stroke();
    g.fillStyle = "#3b2a1a"; g.beginPath(); g.arc(52, 240, 5, 0, 7); g.fill();
    // line and float
    if (p === "fly") {
      const k = Math.min(1, st.pt / 0.7), bx = tipX + (bobX() - tipX) * k, by = tipY + (WL + 14 - tipY) * k - Math.sin(k * Math.PI) * 60;
      g.strokeStyle = "rgba(35,29,23,.8)"; g.lineWidth = 1; g.beginPath(); g.moveTo(tipX, tipY); g.quadraticCurveTo((tipX + bx) / 2, by - 30, bx, by); g.stroke(); floatAt(g, bx, by, 0);
    } else if (p === "wait" || (p === "done" && !st.result && st.wait)) {
      const bx = bobX(), under = p === "wait" && st.bit, nib = st.ripple.some((r) => r.small && r.t < 0.25);
      const by = WL + 14 + Math.sin(T * 2.2) * 2 + (under ? 9 : nib ? 4 : 0);
      g.strokeStyle = "rgba(35,29,23,.7)"; g.lineWidth = 1; g.beginPath(); g.moveTo(tipX, tipY); g.quadraticCurveTo((tipX + bx) / 2, WL + 30, bx, by); g.stroke();
      floatAt(g, bx, by, under ? 1 : 0);
    } else if (p === "reel") {
      const G2 = st.g, fx = tipX + 40 + Math.min(1.25, G2.dist) * 300 + Math.sin(T * 3) * 10 + (G2.run > 0 ? Math.sin(T * 14) * 8 : 0), fy = WL + 40 + Math.sin(T * 1.7) * 10 + (1 - Math.min(1, G2.dist)) * 20;
      const tens = Math.min(1, G2.tension);
      g.strokeStyle = tens > G2.band[1] ? "#8a1e12" : "rgba(35,29,23,.85)"; g.lineWidth = 1 + tens; g.beginPath(); g.moveTo(tipX, tipY);
      g.quadraticCurveTo((tipX + fx) / 2, (tipY + fy) / 2 + (1 - tens) * 50, fx, fy); g.stroke();
      // the fish: a dark shape under the water
      g.save(); g.globalAlpha = 0.55; g.fillStyle = "#11161a"; g.translate(fx + 16, fy + 6); g.rotate(Math.sin(T * 6) * 0.15);
      g.beginPath(); g.ellipse(0, 0, 14 + G2.str * 3, 5 + G2.str, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(12 + G2.str * 3, 0); g.lineTo(24 + G2.str * 3, -7); g.lineTo(24 + G2.str * 3, 7); g.fill(); g.restore();
      if (G2.run > 0) { g.strokeStyle = "rgba(240,240,240,.6)"; g.lineWidth = 1.2; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(fx + 10, fy - 30, 6 + k * 5 + (T * 20) % 5, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } }
    }
    // ripples
    for (const r of st.ripple) { g.strokeStyle = `rgba(${night ? "230,235,240" : "35,29,23"},${(1 - r.t / 1.4) * (r.small ? 0.4 : 0.7)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(r.x, WL + 16, 6 + r.t * (r.small ? 14 : 30), 2 + r.t * (r.small ? 4 : 8), 0, 0, 7); g.stroke(); }
    // the catch
    if (p === "done" && st.result) drawFish(g, st.result.item, W / 2 + 40, 92, 1.5, T);
  }
  function floatAt(g, x, y, under) {
    g.fillStyle = "#b6372a"; g.strokeStyle = INK; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(x, y - (under ? 0 : 3), 4, under ? 2 : 5, 0, 0, 7); g.fill(); g.stroke();
    if (!under) { g.fillStyle = "#efe6cf"; g.beginPath(); g.ellipse(x, y + 1, 4, 2, 0, 0, Math.PI); g.fill(); }
  }
  /* an ink fish for the catch card */
  function drawFish(g, id, x, y, k, T) {
    const col = FISHCOL[id] || "#8a8a7a", crab = id === "fish_mudcrab";
    g.save(); g.translate(x, y); g.scale(k, k); g.rotate(Math.sin(T * 2) * 0.05);
    g.fillStyle = "rgba(240,232,210,.85)"; g.strokeStyle = INK; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(0, 0, 70, 38, 0, 0, 7); g.fill();
    g.fillStyle = col; g.lineWidth = 1.6;
    if (crab) {
      g.beginPath(); g.ellipse(0, 4, 26, 16, 0, 0, 7); g.fill(); g.stroke();
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 22, -2); g.quadraticCurveTo(sx * 40, -22, sx * 34, -26); g.stroke(); g.beginPath(); g.ellipse(sx * 34, -26, 7, 5, sx * 0.6, 0, 7); g.fill(); g.stroke(); for (let l = 0; l < 3; l++) { g.beginPath(); g.moveTo(sx * 18, 10 + l * 3); g.lineTo(sx * (32 + l * 3), 18 + l * 5); g.stroke(); } }
    } else {
      g.beginPath(); g.moveTo(-44, 0); g.bezierCurveTo(-30, -22, 24, -24, 40, 0); g.bezierCurveTo(24, 22, -30, 22, -44, 0); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(38, 0); g.lineTo(58, -16); g.quadraticCurveTo(52, 0, 58, 16); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-6, -17); g.quadraticCurveTo(6, -30, 18, -16); g.stroke();
      g.lineWidth = 0.8; for (let k2 = -20; k2 < 30; k2 += 7) { g.beginPath(); g.moveTo(k2, -10); g.quadraticCurveTo(k2 + 4, 0, k2, 10); g.stroke(); }
      g.fillStyle = INK; g.beginPath(); g.arc(-32, -4, 2.4, 0, 7); g.fill();
      if (id === "fish_slaughterfish" || id === "fish_vampire") { g.strokeStyle = "#efe6cf"; g.lineWidth = 1; g.beginPath(); for (let t2 = 0; t2 < 4; t2++) { g.moveTo(-42 + t2 * 3, 2); g.lineTo(-41 + t2 * 3, 6); } g.stroke(); }
      if (id === "fish_glasscat" || id === "fish_glassfish") { g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-20, -6); g.lineTo(26, -4); g.stroke(); }
      if (isRare(id)) { g.strokeStyle = "rgba(226,187,100,.9)"; g.lineWidth = 1.4; for (let k2 = 0; k2 < 6; k2++) { const a = k2 + T; g.beginPath(); g.moveTo(Math.cos(a) * 62, Math.sin(a) * 32); g.lineTo(Math.cos(a) * 70, Math.sin(a) * 36); g.stroke(); } }
    }
    g.restore();
    g.fillStyle = INK; g.font = "600 15px 'Barlow Condensed', serif"; g.textAlign = "center";
    g.fillText(L(D.ITEMS[id]?.name || id), x, y + 38 * k + 14);
  }
  function finish() {
    if (!st) return;
    const S = st; close();
    S.opts.onClose?.({ caught: S.caught });
  }
  function close() {
    if (st?.raf) cancelAnimationFrame(st.raf);
    if (st?.key && DOM) { removeEventListener("keydown", st.key); removeEventListener("keyup", st.key); }
    if (DOM) document.querySelector("#fishgame")?.remove();
    st = null;
  }
  return { hash, rng, castSeed, RODS, FISH, COLD, WARM, BITE, rodOf, context, canFish, table, roll, waitFor, biteWindow, hook, step, gut, land, isRare, play, close, state: () => st, _down: down, _up: up };
})();
if (typeof module !== "undefined") module.exports = FISHGAME;
