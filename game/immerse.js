/* Immersion: the little Skyrim touches between the systems.
   - Lockpicking mini-game (Skyrim style): set the pick's angle, hold to turn the lock; force it too long and the pick snaps.
     The sweet spot is sized so an "average player" opens a lock about as often as the old instant roll did
     (G.lockChance per pick, same number of picks): balance stays the same, and good hands do a bit better. [OURS]
   - Quest banners: QUEST STARTED / OBJECTIVE, like Skyrim's corner notices (via POLISH.banner).
   - Guard barks when you walk into a town ([Skyrim] lines, varied by hold, hour, your deeds, race and bounty).
   - Loading cards with a slowly turning object and a tip, when going into and out of dungeons, riding a carriage,
     or coming back after a while. Tap to skip; never shown to automated tests unless the URL asks (?loading).
   - Journal → Stats: Skyrim's General Stats, from the save plus a few lifetime counters (s.lt).
   Everything here is optional sugar: with this file missing the game plays exactly as before. */
const IMM = (() => {
  const DOM = typeof document !== "undefined";
  const params = () => (DOM ? new URLSearchParams(location.search) : new URLSearchParams(""));
  const automated = () => DOM && (navigator.webdriver || params().has("notut"));
  const reduce = () => DOM && (matchMedia("(prefers-reduced-motion: reduce)").matches);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const has = (n) => typeof globalThis[n] !== "undefined" || (DOM && typeof window[n] !== "undefined");
  const PREFS = "rotn_prefs";
  const pref = (k, d) => { try { const v = JSON.parse(localStorage.getItem(PREFS) || "{}")[k]; return v === undefined ? d : v; } catch { return d; } };
  const setPref = (k, v) => { try { const p = JSON.parse(localStorage.getItem(PREFS) || "{}"); p[k] = v; localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* ignore */ } };

  // ====================================================================== lockpicking: the maths
  const STRAIN = 0.5;   // seconds of forcing a pick can take before it snaps
  const REACT = 0.15;   // how long an average player forces before letting go (the sim's "feel" probe)
  const fall = (w) => 4 + 2.5 * w; // degrees outside the sweet spot over which the lock still turns a little (harder locks give less feel)
  const SPEED = 2;      // lock turns fully in half a second
  function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const allowed = (d, w) => (d <= w ? 1 : Math.max(0, 1 - (d - w) / fall(w)));
  /* one lock, an average player: guesses, feels how far it turns, estimates the distance (±25%) and tries either side */
  function simLock(w, picks, unbreakable, rnd) {
    const spot = 10 + rnd() * 160;
    let a = 15 + rnd() * 150, best = null, pend = [], probes = 0;
    for (let p = 0; p < picks; p++) {
      let strain = 0;
      for (;;) {
        const r = allowed(Math.abs(a - spot), w);
        if (r >= 1) return true;
        strain += REACT; probes++;
        if (!best || r > best.r) {
          best = { a, r };
          if (r > 0) { const est = (w + fall(w) * (1 - r)) * (1 + (rnd() - 0.5) * 0.5); pend = [a + est, a - est].filter((x) => x >= 0 && x <= 180); if (rnd() < 0.5) pend.reverse(); }
          else pend = [];
        }
        a = pend.length ? pend.shift() : 5 + rnd() * 170;
        if (unbreakable ? probes > 40 : strain >= STRAIN) break;
      }
      if (unbreakable) return false;
    }
    return false;
  }
  const oldOdds = (c, picks) => 1 - Math.pow(1 - c, picks);
  function simRate(w, picks, unbreakable, n = 400, seed = 7) { const r = rng(seed); let ok = 0; for (let i = 0; i < n; i++) if (simLock(w, picks, unbreakable, r)) ok++; return ok / n; }
  const calCache = new Map();
  /* sweet-spot half width (degrees) so the average player opens it as often as the old roll did */
  function sweetWidth(chance, picks, unbreakable) {
    const target = unbreakable ? 1 : oldOdds(chance, picks), key = `${Math.round(chance * 100)}|${picks}|${unbreakable ? 1 : 0}`;
    if (calCache.has(key)) return calCache.get(key);
    let lo = 0.3, hi = 90;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (simRate(mid, picks, unbreakable, 300, 11) < target) lo = mid; else hi = mid; }
    const w = Math.max(0.3, Math.min(90, (lo + hi) / 2));
    calCache.set(key, w);
    return w;
  }

  // ====================================================================== lockpicking: the game
  const TIERS = ["Novice", "Apprentice", "Adept", "Expert", "Master"];
  const wantsGame = () => DOM && (params().has("lockgame") || !automated());   // always on for players (only automated tests skip it)
  /* run(choice) is dungeonAct or eventAction. kind: "dungeon" | "event" */
  function pick(kind, run, save) {
    const room = kind === "dungeon" ? save?.dungeon?.room : save?.trip?.event;
    if (!save || !room || room.tries == null) return run("pick");
    const chance = G.lockChance(save, room.tier), unb = G.P(save, "unbreakable");
    open({ tier: room.tier, picks: room.tries, chance, unbreakable: unb, skill: G.skill(save, "Lockpicking"), title: kind === "dungeon" ? "A locked chest" : "The chest by the road" }, (res) => {
      for (let i = 0; i < res.broken; i++) { save._lockForce = false; run("pick"); }
      if (res.auto) { const r = kind === "dungeon" ? save.dungeon?.room : save.trip?.event; if (!res.broken || (r && r.tries > 0)) run("pick"); return; }
      if (res.opened) { save._lockForce = true; run("pick"); }
    });
  }
  let lp = null;
  function open(o, done) {
    close();
    const w = sweetWidth(o.chance, o.picks, o.unbreakable) * (typeof A11Y !== "undefined" && A11Y.zoneEase ? A11Y.zoneEase() : 1);   // Easy timing: a wider sweet spot
    lp = { ...o, w, spot: 10 + Math.random() * 160, angle: 90, rot: 0, strain: 0, holding: false, broken: 0, done, t: 0, shake: 0, over: false };
    const el = document.createElement("div");
    el.id = "lockpick"; el.className = "lockpick";
    el.innerHTML = `<div class="lpcard" role="dialog" aria-label="Lockpicking">
      <h3>${esc(o.title)}</h3><p class="lpsub">${TIERS[o.tier] || "Novice"} lock · Lockpicking ${o.skill}</p>
      <canvas id="lpc" width="300" height="220" aria-hidden="true"></canvas>
      <input id="lpang" type="range" min="0" max="180" step="1" value="90" aria-label="Pick angle">
      <p class="lphint">Move the pick, then hold <b>Turn</b>. If the lock stops turning, let go before the pick snaps.</p>
      <div class="lprow"><span id="lppicks"></span><button class="btn pri" id="lpturn">Hold to turn</button></div>
      <div class="lprow"><button class="btn" id="lpleave">Leave it</button></div></div>`;
    document.body.appendChild(el);
    const cv = el.querySelector("#lpc"), turn = el.querySelector("#lpturn"), ang = el.querySelector("#lpang");
    const hold = (v) => (e) => { e.preventDefault(); if (lp) lp.holding = v; };
    turn.addEventListener("pointerdown", hold(true)); turn.addEventListener("pointerup", hold(false)); turn.addEventListener("pointerleave", hold(false)); turn.addEventListener("pointercancel", hold(false));
    ang.addEventListener("input", () => { if (lp) lp.angle = +ang.value; });
    let drag = null;
    cv.addEventListener("pointerdown", (e) => { drag = e.clientX; cv.setPointerCapture?.(e.pointerId); });
    cv.addEventListener("pointermove", (e) => { if (drag == null || !lp) return; lp.angle = Math.max(0, Math.min(180, lp.angle + (e.clientX - drag) * 0.6)); drag = e.clientX; ang.value = Math.round(lp.angle); });
    cv.addEventListener("pointerup", () => { drag = null; });
    el.querySelector("#lpleave").onclick = () => finish({ opened: false });
    let last = performance.now();
    const loop = (now) => { if (!lp || lp.over) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); draw(cv); lp.raf = requestAnimationFrame(loop); };
    lp.raf = requestAnimationFrame(loop);
    draw(cv);
  }
  function step(dt) {
    const L = lp, target = allowed(Math.abs(L.angle - L.spot), L.w);
    L.t += dt;
    if (L.holding) {
      L.rot = Math.min(target, L.rot + SPEED * dt);
      if (L.rot >= 1) { sfx("coin"); L.rot = 1; return finish({ opened: true }); }
      if (L.rot >= target - 1e-3) {              // forcing it
        L.strain += dt; L.shake = 1;
        if (L.strain >= STRAIN && !L.unbreakable) {
          L.broken++; L.picks--; L.strain = 0; L.rot = 0; L.holding = false; sfx("clang");
          if (DOM) { const t = document.querySelector("#lpturn"); if (t) { t.classList.add("snap"); setTimeout(() => t.classList.remove("snap"), 300); } }
          if (L.picks <= 0) return finish({ opened: false });
        } else if (L.unbreakable && L.strain >= STRAIN) L.strain = STRAIN;
      } else L.shake = 0;
    } else { L.rot = Math.max(0, L.rot - SPEED * 2 * dt); L.shake = 0; }
    const pk = document.querySelector("#lppicks"); if (pk) pk.textContent = L.unbreakable ? "Unbreakable pick" : `Picks left: ${L.picks}`;
  }
  function finish(res) {
    if (!lp || lp.over) return;
    const L = lp; L.over = true; cancelAnimationFrame(L.raf);
    const out = { opened: !!res.opened, broken: L.broken, auto: !!res.auto };
    document.querySelector("#lockpick")?.classList.add(res.opened ? "won" : "out");
    setTimeout(() => { close(); L.done(out); }, res.opened && !reduce() ? 450 : 0);
  }
  function close() { if (lp?.raf) cancelAnimationFrame(lp.raf); document.querySelector("#lockpick")?.remove(); lp = null; }
  const sfx = (n) => { try { if (typeof SOUND !== "undefined") SOUND.fx(n); } catch { /* sound is optional */ } };
  function draw(cv) {
    const L = lp; if (!L) return;
    const W = 300, H = 220, g = (typeof FITCANVAS !== "undefined" ? FITCANVAS.fixed(cv, W, H) : cv.getContext("2d")), cx = W / 2, cy = 122;   // sharp at any screen density (fitcanvas.js)
    g.clearRect(0, 0, W, H);
    const bg = g.createRadialGradient(cx, cy, 10, cx, cy, 160); bg.addColorStop(0, "#2b2722"); bg.addColorStop(1, "#0b0b0c"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const sx = L.shake && !reduce() ? (Math.random() - 0.5) * 3 : 0;
    // brass ring
    g.save(); g.translate(cx + sx, cy);
    g.fillStyle = "#6b5530"; g.beginPath(); g.arc(0, 0, 86, 0, 7); g.fill();
    g.strokeStyle = "#c9a560"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 86, 0, 7); g.stroke();
    g.fillStyle = "#3d3220"; g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fill();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillStyle = "#a88a4c"; g.beginPath(); g.arc(Math.cos(a) * 78, Math.sin(a) * 78, 2.4, 0, 7); g.fill(); }
    // the turning plate with the keyhole
    g.rotate(L.rot * Math.PI / 2);
    g.fillStyle = "#8a7448"; g.beginPath(); g.arc(0, 0, 50, 0, 7); g.fill();
    g.strokeStyle = "#2a2116"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "#120e09"; g.beginPath(); g.arc(0, -8, 9, 0, 7); g.fill(); g.fillRect(-4, -8, 8, 26);
    // the screwdriver, turning with the plate
    g.strokeStyle = "#9aa1a6"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 14); g.lineTo(34, 70); g.stroke();
    g.strokeStyle = "#5a3a22"; g.lineWidth = 9; g.beginPath(); g.moveTo(34, 70); g.lineTo(46, 92); g.stroke();
    g.restore();
    // the pick: from the keyhole out, at the chosen angle (0 = left, 180 = right)
    const phi = Math.PI + (L.angle / 180) * Math.PI;
    const ex = cx + sx + Math.cos(phi) * 120, ey = cy + Math.sin(phi) * 120;
    g.strokeStyle = L.strain > STRAIN * 0.6 && !L.unbreakable ? "#e0a090" : "#d9dde0"; g.lineWidth = 3; g.lineCap = "round";
    g.beginPath(); g.moveTo(cx + sx, cy - 8); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = "#7a7f84"; g.lineWidth = 6; g.beginPath(); g.moveTo(ex - Math.cos(phi) * 24, ey - Math.sin(phi) * 24); g.lineTo(ex, ey); g.stroke();
    // strain meter
    if (!L.unbreakable) { g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(20, H - 14, W - 40, 4); g.fillStyle = "#c4572e"; g.fillRect(20, H - 14, (W - 40) * Math.min(1, L.strain / STRAIN), 4); }
  }

  // ====================================================================== quest banners (QUEST STARTED / OBJECTIVE)
  let knownQuests = null;
  function questWatch(s) {
    if (!s || !s.quests || typeof QUESTS === "undefined") return;
    const ids = Object.keys(s.quests);
    if (!knownQuests) { knownQuests = new Set(ids); return; }
    for (const id of ids) if (!knownQuests.has(id)) {
      knownQuests.add(id);
      const v = s.quests[id], L = QUESTS.L[id];
      if (L && !v.done) { const st = L.stages[v.stage] || L.stages[0]; questBanner("started", L.name, st?.title, st?.text); }
    }
  }
  function questBanner(what, line, title, text) {
    if (typeof POLISH === "undefined") return;
    const icon = has("UIART") ? UIART.quest(lineKey(line), 36) : "";
    if (what === "started") POLISH.banner("quest", "Quest started", title ? `${title}` : line, icon);
    if (text) POLISH.banner("objective", "Objective", shortObj(text), "");
  }
  const lineKey = (name) => { if (typeof QUESTS === "undefined") return "jobs"; const id = Object.keys(QUESTS.L).find((k) => QUESTS.L[k].name === name); return id || "jobs"; };
  const shortObj = (t) => { const first = String(t).split(/(?<=[.!?])\s/)[0]; return first.length > 80 ? first.slice(0, 77) + "…" : first; };

  // ====================================================================== guard barks
  const BARKS = {
    any: ["No lollygaggin'.", "Let me guess... someone stole your sweetroll.", "I used to be an adventurer like you. Then I took an arrow in the knee.", "Keep your nose clean, and you'll be fine.",
      "Citizen.", "Disrespect the law, and you disrespect me.", "Everything's in order.", "Trouble? Better make it quick.", "Watch the skies, traveller.", "I'd be a lot warmer and a lot happier with a bellyful of mead…",
      "What is it? Dragons?", "My cousin's out fighting dragons, and what do I get? Guard duty."],
    night: ["Gods, I hate the night watch.", "Bit late to be wandering about, isn't it?", "Keep your torch lit. Things hunt in the dark."],
    dragon: ["Wait... I know you. You're the Dragonborn!", "By the gods, is it true? You can absorb a dragon's soul?", "Dragonborn. It's an honour."],
    thane: ["My Thane. Is there anything you need?", "Our Thane walks among us. Make way."],
    bounty: ["You've committed crimes against this hold. Pay up, or go to jail.", "Stop right there, criminal scum!", "I've got my eye on you."],
    vampire: ["Your eyes... are you feeling alright?", "Stay out of the sun much? You look pale."],
    khajiit: ["Keep your paws where I can see them.", "Watch yourself, cat."],
    argonian: ["Thought we'd seen the last of the lizard folk around here.", "Don't go fishing in the moat."],
    elf: ["The Thalmor aren't welcome here. Neither are their friends.", "Keep your elven magic to yourself."],
    nord: ["Skyrim belongs to the Nords!", "Shor's bones, it's cold."],
    mage: ["Magic is a dangerous thing. Mind yourself.", "Got any spare magicka? Ha!"],
    Whiterun: ["Whiterun's under the protection of Jarl Balgruuf.", "Go to the Bannered Mare. Best mead in Whiterun."],
    Windhelm: ["Windhelm is the oldest city in Skyrim.", "The Grey Quarter? Wouldn't go there if I were you."],
    Riften: ["Riften's no place for heroes.", "Keep your coin purse close. Riften's full of thieves."],
    Solitude: ["Solitude stands with the Empire.", "There's an execution today. Don't miss it."],
    Markarth: ["Markarth was built by the dwarves. Strange folk.", "Mind the Forsworn when you leave the city."],
    Winterhold: ["Winterhold's not what it used to be.", "The College? Bunch of mages. Bad news."],
    Falkreath: ["Falkreath has the biggest graveyard in Skyrim.", "Don't wander into the woods at night."],
    Morthal: ["Morthal's a quiet town. We like it that way.", "Stay out of the swamps."],
    Dawnstar: ["Nightmares... everyone in Dawnstar has them.", "The mines keep this town alive."],
  };
  let lastBark = 0;
  function bark(s, place, t = Date.now()) {
    if (!DOM || !s || !place || typeof WORLD === "undefined") return null;
    const kind = WORLD.places[place]?.[2]; if (!["city", "town"].includes(kind)) return null;
    if (t - lastBark < 90000) return null;
    lastBark = t;
    const hold = typeof G !== "undefined" ? G.holdAt(WORLD.places[place]) : "";
    const owed = (s.bounty || {})[hold] || 0;
    const night = typeof G !== "undefined" && G.isNight(G.now());
    const pool = [...BARKS.any];
    if (owed > 0) pool.push(...BARKS.bounty, ...BARKS.bounty);
    if ((s.dragons || 0) > 0) pool.push(...BARKS.dragon, ...BARKS.dragon);
    if (s.thaneWhiterun && place === "Whiterun") pool.push(...BARKS.thane);
    if (night) pool.push(...BARKS.night);
    if (s.vampire) pool.push(...BARKS.vampire);
    if (s.race === "khajiit") pool.push(...BARKS.khajiit); if (s.race === "argonian") pool.push(...BARKS.argonian);
    if (["altmer", "bosmer", "dunmer", "highelf", "woodelf", "darkelf"].includes(s.race)) pool.push(...BARKS.elf);
    if (s.race === "nord") pool.push(...BARKS.nord);
    if ((s.skills?.Destruction?.lvl || 0) > 40) pool.push(...BARKS.mage);
    const cw = typeof CIVILWAR !== "undefined" ? CIVILWAR.barks(s, place) : null;   // the war changes who guards the gate
    if (BARKS[place] && !cw?.replace) pool.push(...BARKS[place]);
    if (cw) pool.push(...cw.lines, ...cw.lines);
    if (typeof RUMOURS !== "undefined") { const d = RUMOURS.barks(s, place); pool.push(...d, ...d, ...d); }   // what you did around here (rumours.js)
    const line = pool[Math.floor(Math.random() * pool.length)];
    const who = typeof NPCART !== "undefined" ? NPCART.who(place, "streets") : null;
    show(line, who);
    return line;
  }
  function show(line, who) {
    document.querySelector("#bark")?.remove();
    const el = document.createElement("div"); el.id = "bark"; el.className = "bark"; el.setAttribute("aria-live", "polite");
    el.innerHTML = `${who && typeof NPCART !== "undefined" ? `<span class="bkp">${NPCART.portrait(who, 34)}</span>` : ""}<span class="bkt"><b>${esc(who?.title || "Guard")}</b><q>${esc(line)}</q></span>`;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add("gone"); setTimeout(() => el.remove(), 700); }, 4800);
  }

  // ====================================================================== loading cards
  const TIPS = [
    "You play fights turn by turn. Bring healing potions and use them early.",
    "Hard fight ahead? Bring friends: a party of up to eight fights side by side.",
    "Cleared dungeons fill up again after three in-game days.",
    "One in-game day passes every two real hours.",
    "Shops close at night. Come back after 8 in the morning.",
    "Your own bed makes you Well Rested: skills improve 10% faster for a while.",
    "Carry too much and you'll walk slower. A horse and a cart help.",
    "Ore can be smelted into ingots at any forge.",
    "Gems and jewellery are light and sell well.",
    "Treasure chests can hold gems, ore and rare tomes.",
    "Each dragon you kill gives a soul. Souls unlock Words of Power.",
    "Standing stones give a blessing. You can only carry one at a time.",
    "The Thieves Guild pays better as your rank grows.",
    "Contracts done quietly pay half as much again.",
    "Mark a place, then Recall to it from anywhere.",
    "Candlelight helps you dodge dungeon traps.",
    "Detect Life and Muffle help you stay hidden.",
    "Transmute turns iron ore into silver, and silver into gold.",
    "Spells above your skill cost more and can fizzle.",
    "Craft your own spells at the College of Winterhold.",
    "Cooking at an inn's pot makes food that heals and buffs.",
    "Fishing spots are marked by water near towns.",
    "Friends can send you trades by courier from anywhere.",
    "Guard a caravan between the capitals for good pay.",
    "Write a verse at an inn. The best become the Song of the North.",
    "Your market stall sells while you're away.",
    "A house keeps your things safe even if you die.",
    "Show off trophies in your house's display case.",
    "Donate to the Hall of the North to help it grow.",
    "Clans can capture whole holds in the war.",
    "Arena bouts in Windhelm can win you a stake.",
    "When you die, your bag stays where you fell for a while.",
    "Bounties are per hold. Pay them at a guard or lie low elsewhere.",
    "A fence buys stolen goods. Ask in the Ragged Flagon.",
    "Arrows are used up in fights. Some can be picked up again.",
    "Bound Bow needs no arrows.",
    "Tap any empty spot on the map to roam there.",
    "Undiscovered places appear on the compass as a faint question mark.",
    "Iron-bound wheels halve cart raids.",
    "Enchanted gear can be broken down at an arcane enchanter to learn its effect.",
    "Improved weapons hit harder. Use the forge's Improve tab.",
    "Turn Undead sends the dead running, but they leave no loot.",
    "Frost barely hurts draugr. Fire works better on undead and trolls.",
    "The Guide (Hero → Settings, or Journal → Misc) walks you through your first hour.",
  ];
  const SPIN = ["dragon_bone", "gem_flawless_diamond", "steel_sword", "elven_bow", "soul_gem_greater", "tome_firebolt", "potion_health", "gold_ruby_necklace", "iron_helmet", "dwarven_armor", "mat_steel", "pelt_wolf"];
  let lastLoad = 0;
  function loading(why) {
    if (!DOM) return;
    if (navigator.webdriver && !params().has("loading")) return;
    if (Date.now() - lastLoad < 4000) return;
    lastLoad = Date.now();
    document.querySelector("#loadcard")?.remove();
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    const ids = SPIN.filter((i) => typeof D !== "undefined" && D.ITEMS[i]);
    const id = ids[Math.floor(Math.random() * ids.length)];
    const pic = id && typeof ICONART !== "undefined" ? ICONART.item(id, 150) : "";
    const el = document.createElement("div"); el.id = "loadcard"; el.className = "loadcard" + (reduce() ? " still" : "");
    el.innerHTML = `<div class="ldspin">${pic}</div><div class="ldtxt"><p class="ldwhy">${esc(why || "")}</p><p class="ldtip">${esc(tip)}</p></div>`;
    const bg = typeof ASSETS !== "undefined" ? ASSETS.loading(Math.floor(Math.random() * 4)) : null;
    if (bg) { el.classList.add("haspic"); el.style.setProperty("--ldbg", `url("${bg.src.split("/").pop()}")`); }   // a painted loading card
    el.addEventListener("click", () => fade(el));
    document.body.appendChild(el);
    setTimeout(() => fade(el), reduce() ? 900 : 1200);
    return tip;
  }
  function fade(el) { if (!el.isConnected) return; el.classList.add("gone"); setTimeout(() => el.remove(), 350); }

  // ====================================================================== lifetime counters + Stats page
  function count(s, key, n = 1) { if (!s) return; s.lt = s.lt || {}; s.lt[key] = (s.lt[key] || 0) + n; }
  /* once a second: quest starts, skill rises and gold flow (cheap diffs) */
  function tick(s) {
    if (!s) return;
    questWatch(s);
    s.lt = s.lt || {};
    const sum = Object.values(s.skills || {}).reduce((a, k) => a + (k.lvl || 0), 0);
    if (s.lt._skillSum == null) s.lt._skillSum = sum;
    if (sum > s.lt._skillSum) { s.lt.skillUps = (s.lt.skillUps || 0) + (sum - s.lt._skillSum); }
    s.lt._skillSum = sum;
    if (s.lt._gold == null) s.lt._gold = s.gold;
    const dg = s.gold - s.lt._gold;
    if (dg > 0) s.lt.goldIn = (s.lt.goldIn || 0) + dg; else if (dg < 0) s.lt.goldOut = (s.lt.goldOut || 0) - dg;
    s.lt._gold = s.gold;
    if (s.lt.bestLevel == null || s.level > s.lt.bestLevel) s.lt.bestLevel = s.level;
  }
  function stats(s) {
    const lt = s.lt || {}, st = s.stats || {}, n = (v) => (v || 0).toLocaleString();
    const now = typeof G !== "undefined" ? G.now() : Date.now() / 1000;
    const days = typeof G !== "undefined" ? Math.max(0, G.clock(now).day - G.clock(s.created || now).day) : 0;
    const placesAll = typeof WORLD !== "undefined" ? Object.keys(WORLD.places).length : 0;
    const quests = Object.values(s.quests || {}), qDone = quests.filter((q) => q.done).length;
    const stagesDone = quests.reduce((a, q) => a + (q.stage || 0), 0);
    const ach = typeof ACH !== "undefined" ? `${ACH.count(s)} of ${ACH.total}` : "";
    const sections = [
      ["General", [["Days passed", n(days)], ["Highest level", n(Math.max(lt.bestLevel || 0, s.level || 1))], ["Places discovered", `${n(new Set(s.discovered || []).size)} of ${placesAll}`], ["Dungeons cleared", n(Object.keys(s.cleared || {}).length)], ["Achievements", ach || "—"]]],
      ["Quests", [["Questlines completed", n(qDone)], ["Quests completed", n(stagesDone)], ["Jobs done", n(lt.jobs)]]],
      ["Combat", [["Foes defeated", n(lt.foes)], ["Dragons slain", n(s.dragons)], ["Dragon souls held", n(s.souls)], ["Players defeated", n(s.pvpKills)], ["Arena wins", n(st.duels)]]],
      ["Skills", [["Skill increases", n(lt.skillUps)], ["Locks picked", n(lt.locks)], ["Pockets picked", n(st.pp)], ["Items crafted", n(lt.crafted)], ["Potions brewed", n(lt.potions)], ["Fish caught", n(st.fish)]]],
      ["Gold", [["Gold now", n(s.gold)], ["Gold earned", n(lt.goldIn)], ["Gold spent", n(lt.goldOut)]]],
    ];
    return `<div class="panel ltstats"><h2>General stats</h2>${sections.map(([h, rows]) => `<h3>${esc(h)}</h3><div class="strows">${rows.map(([k, v]) => `<div class="strow"><span>${esc(k)}</span><b class="num">${esc(v)}</b></div>`).join("")}</div>`).join("")}</div>`;
  }

  return { sweetWidth, simLock, simRate, oldOdds, allowed, STRAIN, wantsGame, pick, open, close, questWatch, questBanner, bark, loading, TIPS, BARKS, count, tick, stats, get lock() { return lp; } };
})();
