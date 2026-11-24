/* potionfx.js: Restore Health / Magicka / Stamina potions work over time instead of all at once. [OURS]
   Remigiusz: "potion should be applying health and magicka and stamina overtime, to avoid spamming".
   - In a fight a potion gives 60% the moment you drink it (it still saves you in a pinch), the rest evenly at the end of
     the next rounds. Ordinary potions take 3 rounds in all, small ones (30 or less) and big brewed ones (over 75) 2.
     Another of the same kind (no bigger) is wasted until the last one has under a quarter left. The Alchemy perk Quick Draught takes off a
     round per rank (never under 2) and adds 5% per rank to the first share. (b175 rebalance: was half at round end over 5/4/3.)
   - On the road (map, towns, dungeons) the same potion takes that many seconds, and the health bar fills as it goes.
     A potion still working when a fight starts carries on in the fight; one still working when a fight ends carries on
     on the road.
   - No stacking: drinking another of the same kind while one is working replaces it, keeping whichever has more left.
     Different kinds (health and magicka) run side by side. Smart AI, custom tactics and followers don't drink the same
     kind again while one is still working.
   - Followers, party members and coop allies get the same treatment (their own potion on their record, potOT).
     Party fights: the leader's phone ticks everyone's potions at the end of each round (it runs the fight); potOT rides in
     the shared fight record as one of TB.BUFF_KEYS, a teammate's reply brings back a potion they drank on their own turn.
   - Shows as a small potion chip with the rounds (or seconds) left on whoever drinks it, and green/blue rising numbers per
     share (the fight screen's own pops; on the map, small floats over the health bar).
   Loaded after engine.js, magic.js, spellbook.js, tbfight.js, sharedfight.js and spellfx.js. Without it potions work at once. */
const POTFX = (() => {
  const KINDS = ["health", "magicka", "stamina"];
  const ITEM = { health: "potion_health", magicka: "potion_magicka", stamina: "potion_stamina" };
  const KEY = { health: "hp", magicka: "mp", stamina: "sp" };
  const r0 = (x) => Math.round(+x || 0);
  const pnum = (s, k) => { try { return s && typeof PFX !== "undefined" ? PFX.num(s, k) : 0; } catch (e) { return 0; } };
  const tr = (t) => { try { return typeof I18N !== "undefined" && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t; } catch (e) { return t; } };
  const rounds = (n) => `${n} ${n === 1 ? "round" : "rounds"}`;
  const FIRST = 0.6;   // share of a potion that lands the moment you drink it in a fight (balance sim, b175)
  /* the share that lands at once: Quick Draught adds 5% per rank */
  const firstOf = (s) => Math.min(0.7, FIRST + 0.05 * Math.round(pnum(s, "potfast")));

  /* how many rounds (seconds on the road) a potion of this size takes; s = the drinker's save (perks), or null */
  function ticks(s, amt) {
    const base = amt <= 30 || amt > 75 ? 2 : 3;
    return Math.max(2, base - Math.round(pnum(s, "potfast")));   // Quick Draught
  }
  /* one line for item tooltips */
  function note(s, amt) { const n = ticks(s, amt); return `In a fight ${r0(100 * firstOf(s))}% works at once, the rest over the next ${rounds(n - 1)} (${n} seconds on the road). Another of the same kind doesn't stack.`; }

  // ------------------------------------------------------------------ in a fight: rounds
  /* put a potion on someone (a Fight, a follower or party member record). Keeps the bigger of what's left and the new one. */
  function put(h, res, amt, n, name, first) {
    const box = h.potOT || (h.potOT = {}), cur = box[res];
    if (cur && (cur.left >= amt || (cur.total >= amt && cur.left > 0.25 * cur.total))) return { kept: true, cur };   // one no bigger than the one still working is wasted
    box[res] = { left: amt, n: Math.max(1, n), total: amt, name: name || "" };
    if (first) box[res].first = first;
    return { kept: false, cur: box[res], replaced: !!cur };
  }
  /* is one of this kind still working (a good part still to come)? AI, tactics and followers leave it alone then */
  function busy(h, res) { const c = h?.potOT?.[res]; return !!c && c.left > Math.max(0.5, 0.25 * (c.total || 0)); }
  /* you drink in a fight (engine.js Fight.act) */
  function drink(f, res, amt, name) {
    const n = ticks(f.s, amt), fs = firstOf(f.s), r = put(f, res, amt, n, name, fs);
    hookFx();
    if (r.kept) return `Drinks ${name}, but the last one is still working`;
    giveOne(f, res, f.s);   // the first share lands at once: a potion still saves you in a pinch
    return `Drinks ${name}: +${r0(amt * fs)} ${res} now, the rest over the next ${rounds(n - 1)}`;
  }
  /* a follower, a party member or a coop ally drinks (or is given) a potion */
  function ally(al, res, amt, name, s = null) {
    const n = ticks(s, amt), fs = firstOf(s), r = put(al, res, amt, n, name, fs);
    hookFx();
    if (r.kept) return "the last one is still working";
    giveOne(al, res, s);   // the first share at once, like yours
    return `+${r0(amt * fs)} now, the rest over the next ${rounds(n - 1)}`;
  }
  const maxOf = (h, res, s) => {
    if (s) return res === "health" ? G.maxHealth(s) : res === "magicka" ? G.maxMagicka(s) : G.maxStamina(s);
    return res === "health" ? (h.maxHp || h.hpMax || h._max || Infinity) : res === "magicka" ? (h.mpMax || Infinity) : (h.spMax || Infinity);
  };
  /* the next share: the first is 60% (given the moment you drink), the rest evenly over the other rounds */
  const share = (c) => (c.n <= 1 ? c.left : c.left >= (c.total || c.left) - 0.01 ? c.left * (c.first || FIRST) : c.left / c.n);
  /* one share of one kind off h's potion; returns what h actually gained */
  function giveOne(h, res, s) {
    const box = h.potOT, c = box?.[res]; if (!c) return 0;
    const give = share(c);
    c.left -= give; c.n--;
    const k = KEY[res]; let got = 0;
    if (typeof h[k] === "number" && (res !== "health" || h[k] > 0)) {
      const b = h[k]; h[k] = Math.min(maxOf(h, res, s), h[k] + give);
      got = h[k] - b;
    }
    if (c.n <= 0 || c.left < 0.01) delete box[res];
    if (!Object.keys(box).length) delete h.potOT;
    return got;
  }
  /* one share off everything that's working on h; returns { res: gained } */
  function tickOne(h, s) {
    const got = {};
    if (!h.potOT) return got;
    for (const res of KINDS) { const g = giveOne(h, res, s); if (g >= 0.5) got[res] = g; }
    return got;
  }
  /* end of every round (MAGIC.tick): you, then your allies */
  function tick(f, line) {
    if (f.potOT) {
      const got = tickOne(f, f.s);
      for (const [res, n] of Object.entries(got)) {
        line.me += ` ·  +${r0(n)} ${res}`;
        const g = f._potGain || (f._potGain = {}); g[res] = (g[res] || 0) + n;
      }
    }
    for (const al of f.allies || []) {
      if (!al || !al.potOT) continue;
      if (al.down || (al.hp != null && al.hp <= 0)) { delete al.potOT; continue; }
      const got = tickOne(al, null);
      if (got.health) line.me += ` · ${al.name}  +${r0(got.health)}`;
    }
  }

  // ------------------------------------------------------------------ on the road: seconds (s.potRT, read by engine.js curHealth)
  let liveS = null;
  /* health from a road potion that has come in since it was last counted */
  function due(s, t) {
    const p = s?.potRT?.health; if (!p) return 0;
    if (t >= p.until) return p.amt;
    if (t <= p.from) return 0;
    return p.amt * (t - p.from) / (p.until - p.from);
  }
  /* engine.js setHealth: what came in so far is now part of your health */
  function settle(s, t) {
    const p = s?.potRT?.health; if (!p) return;
    p.amt -= due(s, t); p.from = Math.max(p.from, t);
    if (t >= p.until || p.amt < 0.01) { delete s.potRT.health; if (!Object.keys(s.potRT).length) delete s.potRT; }
  }
  function roadLeft(s, t = G.now()) { const p = s?.potRT?.health; return p ? Math.max(0, p.amt - due(s, t)) : 0; }
  /* start a health potion on the road (amt over secs seconds) */
  function roadStart(s, amt, secs, name, t = G.now()) {
    if (s.potRT?.health) { if (roadLeft(s, t) >= amt) return { kept: true }; G.setHealth(s, G.curHealth(s, t), t); }   // bank what came in, then replace
    (s.potRT || (s.potRT = {})).health = { amt, from: t, until: t + Math.max(1, secs), total: amt, name: name || "" };
    if (!s._test) liveS = s;
    return { kept: false };
  }
  /* drink a Restore potion on the road (encounters, the pack, towns). Returns the line to show. */
  function roadDrink(s, res, amt, name, t = G.now()) {
    if (res !== "health") return `You drink the ${name}: ${res} +${r0(amt)}.`;   // magicka and stamina are always full outside fights
    const n = ticks(s, amt), r = roadStart(s, amt, n, name, t);
    if (r.kept) return `You drink the ${name}, but the last one is still working.`;
    return `You drink the ${name}: +${r0(amt)} health over ${n} seconds.`;
  }
  /* a fight starts (Fight.run): a road potion still working carries on in the fight, one share a round */
  function intoFight(f) {
    const s = f.s, t = f.t || G.now();
    if (!s?.potRT?.health) return;
    const left = roadLeft(s, t), p = s.potRT.health, secs = Math.max(1, Math.ceil(p.until - t));
    G.setHealth(s, G.curHealth(s, t), t);   // what came in before the fight is already in f.hp
    if (s.potRT) delete s.potRT.health;
    if (s.potRT && !Object.keys(s.potRT).length) delete s.potRT;
    if (left >= 1) put(f, "health", left, Math.min(secs, ticks(s, left)), p.name);
  }
  /* a fight ends (Fight.apply): health still to come carries on on the road */
  function outOfFight(f, t) {
    const c = f.potOT?.health;
    if (!c || !(f.hp > 0) || c.left < 1) return;
    roadStart(f.s, c.left, Math.max(1, c.n), c.name, t);
  }

  // ------------------------------------------------------------------ what it looks like
  /* everything working on h: [{ res, n, left, total, name, road }] */
  function list(h, t) {
    const out = [];
    for (const res of KINDS) { const c = h?.potOT?.[res]; if (c) out.push({ res, n: c.n, left: c.left, total: c.total, name: c.name }); }
    if (h?.potRT?.health && t != null) { const p = h.potRT.health; out.push({ res: "health", n: Math.max(1, Math.ceil(p.until - t)), left: roadLeft(h, t), total: p.total, name: p.name, road: true }); }
    return out;
  }
  const tipOf = (x) => x.road
    ? `${x.name || "Potion"}: +${r0(x.left)} more health over the next ${x.n} ${x.n === 1 ? "second" : "seconds"}. Another one of the same kind doesn't stack.`
    : `${x.name || "Potion"}: +${r0(share(x))} ${x.res} at the end of this round, ${x.n} more (${r0(x.left)} left). Another one of the same kind doesn't stack.`;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function icon(res, px = 16) {
    try { if (typeof ICONART !== "undefined") { const h = ICONART.item(ITEM[res], px); if (h) return h; } } catch (e) { /* plain glyph */ }
    return "";
  }
  /* small chips (fight screen, under your bars) */
  function chipsHTML(h, t) {
    const xs = list(h, t);
    if (!xs.length) return "";
    return `<div class="tbst mine spl potfx">${xs.map((x) => `<i class="st spl me potot pk-${x.res}" data-tip="${esc(tr(tipOf(x)))}">${icon(x.res)}<small>${x.road ? `${x.n}s` : `×${x.n}`}</small></i>`).join("")}</div>`;
  }
  /* a teammate's frame (tbfight.js partyHTML): just the glyph */
  function allyIcons(a) { return a?.potOT && Object.keys(a.potOT).length ? "" : ""; }

  // ------------------------------------------------------------------ hooks into the fight code
  if (typeof G !== "undefined" && G.Fight) {
    const FP = G.Fight.prototype;
    const run0 = FP.run;
    FP.run = function (opts) { try { intoFight(this); } catch (e) { /* never block a fight */ } return run0.apply(this, arguments); };
    const apply0 = FP.apply;
    FP.apply = function (t) { const out = apply0.apply(this, arguments); try { outOfFight(this, t ?? G.now()); } catch (e) { /* ignore */ } return out; };
    /* custom tactics and Smart AI: don't drink the same kind again while one is working */
    const aff0 = FP.affordable;
    FP.affordable = function (a) {
      if (this._potAuto && typeof a === "string" && a.startsWith("potion:") && busy(this, a.slice(7))) return false;
      return aff0.call(this, a);
    };
    const choose0 = FP.choose;
    FP.choose = function () { this._potAuto = true; try { return choose0.apply(this, arguments); } finally { this._potAuto = false; } };
  }
  if (typeof MAGIC !== "undefined") { const tick0 = MAGIC.tick; MAGIC.tick = (f, line) => { tick0(f, line); tick(f, line); }; }
  if (typeof TB !== "undefined") {
    if (Array.isArray(TB.BUFF_KEYS) && !TB.BUFF_KEYS.includes("potOT")) TB.BUFF_KEYS.push("potOT");   // party fights: every phone sees who has a potion working
    const S = TB.Session.prototype;
    /* the round's potion shares become the fight screen's rising numbers */
    const er0 = S.endRound;
    S.endRound = function () {
      const f = this.f; f._potGain = null;
      const n0 = this.ev.length;
      er0.apply(this, arguments);
      const g = f._potGain; f._potGain = null;
      if (g) {
        let e = null; for (let i = this.ev.length - 1; i >= n0; i--) if (this.ev[i].kind === "tick") { e = this.ev[i]; break; }
        if (e) { if (g.health) e.healed = (e.healed || 0) + r0(g.health); if (g.magicka) e.mpUp = r0(g.magicka); if (g.stamina) e.spUp = r0(g.stamina); }
      }
    };
    /* a teammate's turn came back: a potion they drank on their own phone now works here, where the rounds are run */
    const ar0 = S.applyRemote;
    S.applyRemote = function (al, r) {
      ar0.apply(this, arguments);
      if (al && r && r.potOT && !al.down) for (const [res, c] of Object.entries(r.potOT)) if (c && KINDS.includes(res) && c.left > 0) { const r = put(al, res, +c.left, +c.n || 1, c.name); if (!r.kept && +c.total > +c.left) r.cur.total = +c.total; }   // already started: even shares from here
    };
  }
  if (typeof SHAREDFIGHT !== "undefined" && SHAREDFIGHT.Mirror) {
    const M = SHAREDFIGHT.Mirror.prototype;
    const reply0 = M.reply;
    M.reply = function () { const r = reply0.apply(this, arguments); if (r && this.f.potOT) r.potOT = JSON.parse(JSON.stringify(this.f.potOT)); return r; };
    const roster0 = M.roster;
    M.roster = function (list) {
      roster0.apply(this, arguments);
      const me = (list || []).find((r) => r.k === "p:" + this.me || (r.pid && r.pid === this.me));
      if (me) { if (me.potOT) this.f.potOT = JSON.parse(JSON.stringify(me.potOT)); else delete this.f.potOT; }   // the leader's phone runs the rounds
    };
  }
  if (typeof SPELLFX !== "undefined" && SPELLFX.meHTML) {
    const me0 = SPELLFX.meHTML;
    SPELLFX.meHTML = (f) => me0(f) + chipsHTML(f);
  }
  /* combat2.js's buff icons, when they're in the game: potions show there too */
  let fxHooked = false;
  function hookFx() {
    if (fxHooked || typeof FXICONS === "undefined" || typeof FXICONS.me !== "function") return;
    fxHooked = true;
    const items = (h) => list(h).map((x) => ({ k: "potion", ic: "", nm: x.name || "Potion", lbl: tr(x.name || "Potion"), buff: true, n: x.n, left: null, tip: tr(tipOf(x)), id: "pot:" + x.res }));
    const me1 = FXICONS.me; FXICONS.me = function (f) { return [...(me1.apply(this, arguments) || []), ...items(f)]; };
    if (typeof FXICONS.ally === "function") { const a1 = FXICONS.ally; FXICONS.ally = function (f, a) { return [...(a1.apply(this, arguments) || []), ...items(a)]; }; }
  }

  // ------------------------------------------------------------------ the map: a chip by the health bar, floats as it fills
  let shownAt = 0, shownKey = null;
  function mapTick() {
    if (typeof document === "undefined") return;
    hookFx();
    const s = liveS, t = G.now();
    let chip = document.getElementById("potfx-map");
    const p = s?.potRT?.health;
    const fighting = typeof TB !== "undefined" && TB.open;
    if (!p || fighting || roadLeft(s, t) < 0.5) { if (chip) chip.remove(); if (!p) { shownKey = null; liveS = s && s.potRT ? s : null; } return; }
    const bar = document.querySelector("#vitals .hb.hp") || document.getElementById("vitals");
    if (!bar) return;
    const rc = bar.getBoundingClientRect();
    if (!rc.width) { if (chip) chip.remove(); return; }
    if (!chip) { chip = document.createElement("div"); chip.id = "potfx-map"; chip.className = "potfx-map"; document.body.appendChild(chip); }
    const x = list(s, t).find((v) => v.road);
    chip.innerHTML = `${icon("health", 14)}<small>${x.n}s</small>`;
    chip.title = tr(tipOf(x)); chip.setAttribute("aria-label", chip.title);
    chip.style.left = `${Math.round(rc.right + 4)}px`; chip.style.top = `${Math.round(rc.top + rc.height / 2)}px`;
    // the rising numbers: what came in since the last float
    const key = `${p.total}|${p.name}`;
    const inSoFar = p.total - roadLeft(s, t);
    if (shownKey !== key) { shownKey = key; shownAt = inSoFar; }
    const add = inSoFar - shownAt;
    if (add >= 1) {
      shownAt += Math.floor(add);
      const fl = document.createElement("div");
      fl.className = "potfx-float"; fl.textContent = `+${Math.floor(add)}`;
      fl.style.left = `${Math.round(rc.left + rc.width * 0.5)}px`; fl.style.top = `${Math.round(rc.top)}px`;
      document.body.appendChild(fl);
      setTimeout(() => fl.remove(), 1300);
    }
  }
  if (typeof document !== "undefined" && typeof setInterval !== "undefined") setInterval(() => { try { mapTick(); } catch (e) { /* never break the game */ } }, 500);
  /* the app loaded a save with a potion still working: let the map show it */
  function watch(s) { if (s && !s._test) liveS = s; }

  return { KINDS, ticks, note, put, busy, drink, ally, tick, tickOne, due, settle, roadLeft, roadStart, roadDrink, intoFight, outOfFight,
    list, chipsHTML, allyIcons, watch, hookFx };
})();
