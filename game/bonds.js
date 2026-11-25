/* Follower and horse bonds (bonds.js). [OURS, after Skyrim's followers and horses]
   Builds on followerbonds.js (BONDS: loyalty 0-100, moods, talk, gifts, personal quests, signature moves) and
   horses.js / horseback.js / mountfight.js / hunting.js. Hooks only; nothing here can kill a follower or a horse.

   FOLLOWERS: loyalty ranks. Loyalty already moves with your deeds, talks, gifts and won fights; now it also grows from
   time on the road together and from hard fights (bosses, dragons, dangerous foes). Each rank unlocks something real:
     Hireling (0)   follows you for the pay
     Companion (40) carries 25 more for you (Meeko 15)
     Trusted (60)   fights smarter (Smart AI): steps in front of you when you're badly hurt, heals you and drinks
                    potions sooner, and goes for the kill on a wounded foe instead of standing guard
     Sworn (75)     a signature move once per fight, even before their personal quest (their quest's move replaces it)
   Personal quests (followerbonds.js: go to a town, clear a place, make a last choice) now show Skyrim's
   QUEST STARTED / OBJECTIVE banners.

   HORSES: a bond level 1-5 from riding on the road, fights won in the saddle, hunting on horseback and a daily grooming
   at a stables. At level 3 you pick ONE speciality; it gets stronger at 4 and 5:
     warhorse  harder mounted charge, the horse shrugs off more blows, a little more from the saddle
     mountain  faster off the road, and snow and storms slow you less
     courier   faster on roads and bridges
     packhorse carries more
     hunter    tracking game from the saddle: hardly slower, more animals, more hides
   Perks: Fellow Traveller (Etiquette) and Horse Whisperer (Athletics). */
const BONDS2 = (() => {
  const B = () => (typeof BONDS !== "undefined" ? BONDS : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const pnum = (s, k) => (typeof PFX !== "undefined" ? +PFX.num(s, k) || 0 : 0);
  const T = (x) => (B() ? B().T(x) : x);
  const F = (tpl, ...a) => (B() ? B().F(tpl, ...a) : String(tpl).replace(/\{(\d)\}/g, (m, i) => (a[+i] ?? "")));
  const nameOf = (id) => (typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS[id]?.[0]) || id;
  const first = (id) => nameOf(id).split(" ")[0];
  const isDog = (id) => typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS[id]?.[6] === "dog";
  const DAY = 2 * 3600;   // one in-game day = 2 real hours

  // ================================================================ follower ranks
  // [at loyalty, name, what it unlocks]
  const RANKS = [
    [0, "Hireling", "Follows you for the pay."],
    [40, "Companion", "Carries 25 more for you."],
    [60, "Trusted", "Fights smarter: steps in front of you when you're badly hurt, heals you and drinks potions sooner, and goes for the kill on a wounded foe."],
    [75, "Sworn", "A signature move once per fight, even before their personal quest."],
  ];
  const CARRY = 25, DOG_CARRY = 15;
  const ROAD_STEP = 600, ROAD_CAP = 3;     // +1 loyalty per 10 real minutes on the road together, at most 3 a day
  function rankOf(v) { let r = 0; for (let i = 0; i < RANKS.length; i++) if (v >= RANKS[i][0]) r = i; return r; }
  const loyal = (s, id = s?.follower?.id) => (id && B() ? B().loyalty(s, id) : 0);
  const rank = (s, id = s?.follower?.id) => (id ? rankOf(loyal(s, id)) : -1);

  /* how much more you can carry thanks to your follower's rank (and Fellow Traveller) */
  function carry(s) {
    const id = s?.follower?.id; if (!id || rank(s, id) < 1) return 0;
    return (isDog(id) ? DOG_CARRY : CARRY) + Math.round(pnum(s, "folcarry"));
  }

  // ---- the Sworn rank move: one per fighting style, a bit weaker than a personal-quest move
  const ARCH_SIG = {
    warrior: { name: "Shield Rush", type: "strike", val: 1.4, desc: "a shield rush at 1.4 times their hit" },
    twohand: { name: "Heavy Swing", type: "strike", val: 1.5, desc: "a heavy swing at 1.5 times their hit" },
    archer: { name: "Double Shot", type: "volley", val: 2, desc: "two quick arrows" },
    spellsword: { name: "Spark Blade", type: "strike", val: 1.4, desc: "a sparking cut at 1.4 times their hit" },
    thief: { name: "Dirty Cut", type: "bleed", val: 0.5, desc: "a low cut that bleeds for three turns" },
    mage: { name: "Firebolt", type: "strike", val: 1.5, desc: "a firebolt at 1.5 times their hit" },
    conjurer: { name: "Warding Light", type: "heal", val: 0.15, desc: "heals you for a sixth of your health" },
    healer: { name: "Healing Hands", type: "heal", val: 0.18, desc: "heals you for a fifth of your health" },
    dog: { name: "Snap", type: "bleed", val: 0.5, desc: "a bite that bleeds for three turns" },
  };
  function rankSig(s, id = s?.follower?.id) {
    if (!id || rank(s, id) < 3) return null;
    if (isDog(id)) return ARCH_SIG.dog;
    const a = typeof FOL2 !== "undefined" && FOL2.st(s, id) ? FOL2.st(s, id).arch || FOL2.archOf(id) : "warrior";
    return ARCH_SIG[a] || ARCH_SIG.warrior;
  }

  /* Trusted and up: better choices for the Smart AI (followerai.js decide). Same moves, picked more wisely. */
  function aiOpts(fight, al, opts) {
    try {
      const s = fight?.s; if (!s || !al || al.fid !== s.follower?.id || !opts?.length || rank(s, al.fid) < 2) return opts;
      const mh = typeof G !== "undefined" ? G.maxHealth(s) : 100, pp = fight.hp / Math.max(1, mh);
      const me = al.hp / Math.max(1, al.maxHp || al.hp || 1), foeLow = fight.ehp > 0 && fight.ehp < 0.25 * (fight.e?.health || fight.ehp0 || fight.ehp);
      const atk = opts.find((o) => o.k === "attack"), per = atk ? atk.v / Math.max(1, atk.c) : 5;
      for (const o of opts) {
        if (o.k === "cast" && ["heal", "regen", "healally", "allyward", "ward"].includes(o.sp?.kind) && pp < 0.6) o.v *= 1.25;   // you first
        if (o.k === "potion" && o.res === "health") o.v *= 1.2;
        if (foeLow && (o.k === "attack" || o.k === "power" || (o.k === "cast" && o.sp?.kind === "damage"))) o.v *= 1.15;   // finish it
        if (foeLow && o.k === "guard") o.v *= 0.6;
      }
      const melee = !al.bow && al.tactic !== "ranged" && al.tactic !== "healer";
      if (melee && pp < 0.35 && me > 0.4 && fight.coverAl !== al && !opts.some((o) => o.k === "cover")) opts.push({ k: "cover", c: 2, v: per * 2 * 4, bond: true });   // steps in front of you
    } catch (e) { /* never break a turn */ }
    return opts;
  }

  // ---- rank changes: a line and a note when they rise
  function rankCheck(s) {
    const id = s?.follower?.id; if (!id || !B()) return "";
    const f = B().bond(s, id), r = rank(s, id), was = f.bond.rank;
    f.bond.rank = r;
    if (was == null || r <= was) return "";
    const [, nm, what] = RANKS[r];
    const line = F("{0} reaches the rank of {1}: {2}", first(id), T(nm), T(what));
    f.bond.log.unshift({ t: now(), text: line, k: "up" }); f.bond.log = f.bond.log.slice(0, 12);
    if (typeof G !== "undefined") G.note(s, " " + line);
    return line;
  }
  function addLoyal(s, d, why) {
    const id = s?.follower?.id; if (!id || !B() || !d) return 0;
    const f = B().bond(s, id), before = f.loyal;
    if (before <= 0) return 0;
    f.loyal = clamp(f.loyal + d, 0, 100);
    const ch = Math.round(f.loyal) - Math.round(before);
    if (ch) { f.bond.log.unshift({ t: now(), text: why, k: "up", d: ch }); f.bond.log = f.bond.log.slice(0, 12); }
    rankCheck(s);
    return ch;
  }
  /* time on the road together (called as you travel): +1 per 10 real minutes, at most 3 a day (Fellow Traveller: double) */
  function roadTime(s, dt, t = now()) {
    const id = s?.follower?.id; if (!id || !B() || !(dt > 0)) return 0;
    const f = B().bond(s, id), b = f.bond;
    if (!b.road || t - (b.road.day || 0) >= DAY) b.road = { day: t, got: 0, acc: b.road?.acc || 0 };
    b.road.acc += Math.min(dt, 900);
    let got = 0;
    while (b.road.acc >= ROAD_STEP) {
      b.road.acc -= ROAD_STEP;
      if (b.road.got >= ROAD_CAP) continue;
      b.road.got++;
      got += addLoyal(s, 1 + (pnum(s, "foltravel") > 0 ? 1 : 0), "Time on the road together");
    }
    return got;
  }
  /* a hard fight won together counts a little more */
  const hardFight = (fight) => { const e = fight?.e || {}, tags = fight?.tags instanceof Set ? fight.tags : new Set(fight?.tags || e.tags || []); return !!(e.boss || e.danger === "high" || tags.has("dragon") || tags.has("boss") || tags.has("elite")); };

  // ---- the rank ladder on the Bond tab
  function rankHTML(s, esc = (x) => x) {
    const id = s?.follower?.id; if (!id) return "";
    const v = loyal(s, id), r = rank(s, id), dog = isDog(id);
    const steps = RANKS.map(([at, nm, what], i) => {
      const txt = i === 1 && dog ? F("Carries {0} more for you.", DOG_CARRY) : i === 3 && B()?.sigOf(s, id) && B()?.questState(s, id)?.k === "done" ? T("Their personal-quest move is already theirs.") : T(what);
      return `<div class="bondrk ${i < r ? "past" : i === r ? "on" : "lock"}"><b>${i < r ? "✓" : i === r ? "◆" : "·"} ${esc(T(nm))} <span class="num">${at}</span></b><span>${esc(txt)}</span></div>`;
    }).join("");
    const next = RANKS[r + 1];
    const sig = rankSig(s, id), qDone = B()?.questState(s, id)?.k === "done";
    return `<div class="bondranks"><div class="bondrkh"><span>${esc(T("Rank"))}: <b>${esc(T(RANKS[r][1]))}</b></span>${next ? `<span class="sub">${esc(F("Next: {0} at loyalty {1}", T(next[1]), next[0]))}</span>` : ""}</div>
      <div class="bondrks">${steps}</div>
      ${sig && !qDone ? `<p class="sub">${esc(T("Rank move:"))} <b>${esc(T(sig.name))}</b>: ${esc(T(sig.desc))}</p>` : ""}
      <p class="sub">${esc(T("Loyalty grows from fights won together (hard ones count double), gifts, talks and time on the road together."))}</p></div>`;
  }

  // ================================================================ horse bonds
  const HLV = [0, 40, 100, 200, 350];          // bond points for levels 1..5
  const HNAMES = ["Wary", "Used to you", "Bonded", "Close friends", "Heart-bound"];
  const SPEC_AT = 3, GROOM_COST = 20, GROOM_XP = 6, RETRAIN_COST = 500;
  const XP = { ride: 1, fight: 4, hunt: 3 };   // per real minute ridden on the road / fight won in the saddle / animal taken from the saddle
  const SPECS = {
    warhorse: { name: "Warhorse", icon: "⚔", text: "Trained for battle." },
    mountain: { name: "Mountain horse", icon: "▲", text: "Sure-footed off the road." },
    courier: { name: "Courier", icon: "➤", text: "Built for long roads." },
    packhorse: { name: "Packhorse", icon: "▣", text: "Strong back, steady pace." },
    hunter: { name: "Hunter's horse", icon: "✵", text: "Quiet, and doesn't spook." },
  };
  const hb = (s) => { const h = s?.horse; if (!h) return null; if (!h.bond || typeof h.bond !== "object") h.bond = { xp: 0, spec: null }; return h.bond; };
  const hlevel = (s) => { const b = hb(s); if (!b) return 0; let l = 1; for (let i = 0; i < HLV.length; i++) if (b.xp >= HLV[i]) l = i + 1; return l; };
  /* how strong the speciality is: 1 at level 3, 1.5 at 4, 2 at 5 (Horse Whisperer: +20%) */
  const tier = (s) => { const l = hlevel(s); return l < SPEC_AT ? 0 : (1 + 0.5 * (l - SPEC_AT)) * (1 + Math.min(0.5, pnum(s, "horsespec"))); };
  const spec = (s) => (hb(s)?.spec && SPECS[hb(s).spec] && hlevel(s) >= SPEC_AT ? hb(s).spec : null);
  const is = (s, k) => spec(s) === k;
  /* the numbers, for the effects and the screen */
  const num = {
    charge: (m) => 0.12 * m, guard: (m) => 0.08 * m, saddle: (m) => 0.02 * m,
    offroad: (m) => 0.08 * m, weather: (m) => Math.min(0.5, 0.25 * m),
    road: (m) => 0.06 * m,
    pack: (m) => Math.round(30 * m),
    huntslow: (m) => Math.min(0.1, 0.05 * m), huntrate: (m) => 0.15 * m, hide: (m) => Math.min(0.6, 0.2 * m),
  };
  const pc = (x) => Math.round(x * 100);
  function specText(k, m) {
    if (!m) m = 1;
    if (k === "warhorse") return F("Mounted charge +{0}%, horse takes {1}% less damage, +{2}% from the saddle.", pc(num.charge(m)), pc(num.guard(m)), pc(num.saddle(m)));
    if (k === "mountain") return F("{0}% faster off the road; snow and storms slow you {1}% less.", pc(num.offroad(m)), pc(num.weather(m)));
    if (k === "courier") return F("{0}% faster on roads and bridges.", pc(num.road(m)));
    if (k === "packhorse") return F("Carries {0} more.", num.pack(m));
    if (k === "hunter") return F("Hunting from the saddle: almost no slowdown, {0}% more animals, {1}% chance of an extra hide.", pc(num.huntrate(m)), pc(num.hide(m)));
    return "";
  }
  function hgain(s, x, why) {
    const b = hb(s); if (!b || !(x > 0)) return "";
    const l0 = hlevel(s);
    b.xp = Math.round((b.xp + x * (1 + Math.min(1, pnum(s, "horsebond"))) * (typeof LONGHOUSE !== "undefined" ? LONGHOUSE.horseMult(s) : 1)) * 10) / 10;   // the company stables (longhouse.js)
    const l1 = hlevel(s);
    if (l1 <= l0) return "";
    const n = s.horse.name;
    const msg = l1 === SPEC_AT && !b.spec ? F("{0} trusts you now (bond level {1}). Pick a speciality for {0} at any stables.", n, l1)
      : F("{0}'s bond grows: level {1}, {2}.", n, l1, T(HNAMES[l1 - 1])) + (spec(s) ? " " + F("{0} gets stronger.", T(SPECS[spec(s)].name)) : "");
    if (typeof G !== "undefined") G.note(s, " " + msg);
    return msg;
  }
  const atStables = (s) => !!s?.location && typeof G !== "undefined" && G.shopTypes(s.location).includes("stables");
  function groom(s, t = now()) {
    const b = hb(s); if (!b) return T("You don't have a horse.");
    if (!atStables(s)) return T("You can groom your horse at any stables.");
    if (t - (b.groomAt || 0) < DAY) return F("{0} was groomed today already.", s.horse.name);
    if (s.gold < GROOM_COST) return F("Oats, a brush and a stall cost {0} gold.", GROOM_COST);
    s.gold -= GROOM_COST; b.groomAt = t;
    const up = hgain(s, GROOM_XP, "groom");
    return F("You brush {0} down and give them a bucket of oats. {0} nuzzles your shoulder.", s.horse.name) + (up ? " " + up : "");
  }
  function pickSpec(s, k) {
    const b = hb(s); if (!b) return T("You don't have a horse.");
    if (!SPECS[k]) return "";
    if (hlevel(s) < SPEC_AT) return F("{0} needs bond level {1} first.", s.horse.name, SPEC_AT);
    if (!atStables(s)) return T("Choose a speciality at a stables.");
    if (b.spec === k) return F("{0} is already a {1}.", s.horse.name, T(SPECS[k].name));
    if (b.spec) {
      if (s.gold < RETRAIN_COST) return F("Retraining costs {0} gold.", RETRAIN_COST);
      s.gold -= RETRAIN_COST;
    }
    b.spec = k;
    return F("{0} is now a {1}. {2}", s.horse.name, T(SPECS[k].name), specText(k, tier(s)));
  }
  function horseHTML(s, esc = (x) => x) {
    const b = hb(s); if (!b) return "";
    const l = hlevel(s), m = tier(s), sp = spec(s), n = s.horse.name, at = atStables(s);
    const lo = HLV[l - 1], hi = HLV[l] ?? HLV[HLV.length - 1], pct = l >= HLV.length ? 100 : Math.round(((b.xp - lo) / Math.max(1, hi - lo)) * 100);
    const groomLeft = Math.max(0, DAY - (now() - (b.groomAt || 0)));
    // the bar is progress toward the next level, so say so ("4/100 toward level 4"), or that the top level is reached
    const nextLabel = l >= HLV.length ? T("Highest level") : F("{0}/{1} toward level {2}", Math.max(0, Math.floor(b.xp - lo)), hi - lo, l + 1);
    const cards = Object.entries(SPECS).map(([k, v]) => {
      const on = sp === k, can = l >= SPEC_AT && at && !on && (!b.spec || s.gold >= RETRAIN_COST);
      const btn = on ? `<span class="hsp-tag">${esc(T("Chosen"))}</span>` : l < SPEC_AT ? "" : `<button class="btn sm${b.spec ? "" : " pri"}" data-act="fol2" data-op="hbond" data-b="spec" data-id="${k}" ${can ? "" : "disabled"}>${esc(b.spec ? F("Retrain ({0})", RETRAIN_COST) : T("Choose"))}</button>`;
      return `<div class="hsp${on ? " on" : ""}${l < SPEC_AT ? " lock" : ""}"><i class="hsp-ic" aria-hidden="true">${v.icon}</i><div class="t"><b>${esc(T(v.name))}</b><span>${esc(specText(k, on ? m : Math.max(1, m)))}</span></div>${btn}</div>`;
    }).join("");
    return `<div class="hbond"><h3 style="margin-top:12px">${esc(F("Bond with {0}", n))}</h3>
      <div class="hbondm"><span class="bondl"><span>${esc(T("Level"))} <b>${l}</b>/5 · ${esc(T(HNAMES[l - 1]))}</span><span class="bondnx num">${esc(nextLabel)}</span></span><div class="bondbar hbbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div></div>
      <p class="sub">${esc(T("Grows as you ride on the road, win fights in the saddle, hunt on horseback and groom them."))}${l < SPEC_AT ? " " + esc(F("At level {0} you pick one speciality.", SPEC_AT)) : ""}</p>
      <div class="chips"><button class="btn sm" data-act="fol2" data-op="hbond" data-b="groom" ${at && !groomLeft && s.gold >= GROOM_COST ? "" : "disabled"}>${esc(F("Groom ({0} gold)", GROOM_COST))}${groomLeft ? ` · ${Math.ceil(groomLeft / 60)} min` : ""}</button></div>
      <div class="hsps">${cards}</div></div>`;
  }
  /* a one-line summary for other screens */
  const horseLine = (s) => { if (!hb(s)) return ""; const sp = spec(s); return F("Bond level {0}", hlevel(s)) + (sp ? ` · ${T(SPECS[sp].name)}` : ""); };

  // ================================================================ hooks
  function act(s, d) {
    if (d.b === "groom") return groom(s);
    if (d.b === "spec") return pickSpec(s, d.id);
    return "";
  }
  const banner = (what, title, text) => { try { if (typeof IMM !== "undefined" && IMM.questBanner) IMM.questBanner(what, title, title, text); } catch (e) { /* no banner */ } };
  /* personal quests: show QUEST STARTED / OBJECTIVE like the other quest lines */
  function questWatch(s, before) {
    const id = s?.follower?.id; if (!id || !B()) return;
    const st = B().questState(s, id), q = st.q; if (!q) return;
    const k = st.k; if (k === before) return;
    if (before === "open" && k === "go") banner("started", T(q[0]), F("Go to {0}: {1}.", q[2], T(q[3])));
    else if (k === "clear") banner("objective", T(q[0]), F("Clear {0}: {1}.", q[4], T(q[5])));
    else if (k === "choose") banner("objective", T(q[0]), F("Talk to {0} to finish it.", first(id)));
  }
  const qk = (s) => (s?.follower && B() ? B().questState(s).k : null);

  let installed = false;
  function install() {
    if (installed) return; installed = true;
    if (typeof G !== "undefined" && G.advance) {
      const adv0 = G.advance;
      G.advance = function (s, t, ...rest) {
        const t0 = s?.trip?.lastTick, q0 = qk(s);
        const out = adv0.call(this, s, t, ...rest);
        try {
          const tt = t ?? now(), dt = t0 != null ? Math.max(0, tt - t0) : 0;
          if (dt > 0 && s?.trip?.status === "travel" || (dt > 0 && out?.arrived)) {
            if (s.follower) roadTime(s, dt, tt);
            if (s.horse && typeof HORSES !== "undefined" && HORSES.riding(s) && !s.trip?.carriage && !s.trip?.boat) hgain(s, XP.ride * Math.min(dt, 300) / 60, "ride");
          }
          if (s?.follower) questWatch(s, q0);
        } catch (e) { /* never break travel */ }
        return out;
      };
    }
    if (typeof FOL2 !== "undefined") {
      const gain0 = FOL2.gain;
      FOL2.gain = function (s, fight) {
        const msgs = gain0.call(this, s, fight) || [];
        try { if (s?.follower && fight?.won && hardFight(fight)) addLoyal(s, 1, "A hard fight won together"); else rankCheck(s); } catch (e) { /* keep the result */ }
        return msgs;
      };
      const act0 = FOL2.act;
      FOL2.act = function (s, d) {
        if (d?.op === "hbond") return act(s, d);
        const q0 = qk(s), r = act0.call(this, s, d);
        try { if (s?.follower) { rankCheck(s); questWatch(s, q0); } } catch (e) { /* keep it */ }
        return r;
      };
    }
    if (B()) {
      const tab0 = B().tab;
      B().tab = function (s, esc = (x) => x) {
        const h = tab0.call(this, s, esc);
        try { rankCheck(s); const add = rankHTML(s, esc), at = h.indexOf('<div class="chips bondbtns">'); if (add && at > 0) return h.slice(0, at) + add + h.slice(at); } catch (e) { /* plain tab */ }
        return h;
      };
    }
    if (typeof HORSES !== "undefined") {
      const sp0 = HORSES.speed;
      HORSES.speed = function (s, ...rest) {
        let v = sp0.call(this, s, ...rest);
        try {
          const m = tier(s), k = spec(s);
          if (m && (k === "courier" || k === "mountain") && s.trip && s.trip.status === "travel" && typeof Terrain !== "undefined") {
            const ground = Terrain.NAMES[Terrain.typeAtPos([s.x, s.y])], road = ground === "Road" || ground === "Bridge";
            if (k === "courier" && road) v *= 1 + num.road(m);
            if (k === "mountain") {
              if (!road) v *= 1 + num.offroad(m);
              const wf = typeof WEVENTS !== "undefined" ? WEVENTS.weather([s.x, s.y]).speed : 1;
              if (wf < 1 && wf > 0) v *= (wf + (1 - wf) * num.weather(m)) / wf;   // gives back part of the weather slowdown
            }
          }
        } catch (e) { /* plain speed */ }
        return +v.toFixed(3);
      };
      const ca0 = HORSES.carry;
      HORSES.carry = function (s, ...rest) { const v = ca0.call(this, s, ...rest); return s?.horse && is(s, "packhorse") ? v + num.pack(tier(s)) : v; };
    }
    if (typeof HORSEBACK !== "undefined") {
      const en0 = HORSEBACK.engage;
      HORSEBACK.engage = function (f, t) {
        const up = en0.call(this, f, t);
        try { if (f?.mount && is(f.s, "warhorse")) { f.mount.guard = Math.min(0.6, (f.mount.guard || 0) + num.guard(tier(f.s))); f.mount.war = true; } } catch (e) { /* plain mount */ }
        return up;
      };
      const st0 = HORSEBACK.strike;
      HORSEBACK.strike = function (f, power, sneak) {
        const r = st0.call(this, f, power, sneak);
        try {
          if (r && !r.miss && f?.mount?.up && is(f.s, "warhorse")) {
            const m = tier(f.s);
            if (r.sure && /charge/i.test(r.label || "")) { r.mult *= 1 + num.charge(m); r.label = (r.label || "").replace(/×[\d.]+/, "×" + (Math.round(r.mult * 10) / 10)) + ` (${T("warhorse")})`; }
            else r.mult *= 1 + num.saddle(m);
          }
        } catch (e) { /* plain strike */ }
        return r;
      };
      const af0 = HORSEBACK.after;
      HORSEBACK.after = function (f, t) {
        const msgs = af0.call(this, f, t) || [];
        try { if (f?.s?.horse && f.mount?.rode && f.won && !(f.mount.downTurn > 0)) { const up = hgain(f.s, XP.fight, "fight"); if (up) msgs.push(" " + up); } } catch (e) { /* keep */ }
        return msgs;
      };
    }
    if (typeof HUNT !== "undefined") {
      const ride = (s) => typeof HORSES !== "undefined" && HORSES.riding(s) && is(s, "hunter");
      const sm0 = HUNT.speedMult;
      HUNT.speedMult = function (s) { const v = sm0.call(this, s); return v < 1 && ride(s) ? Math.min(1, v + num.huntslow(tier(s))) : v; };
      const rt0 = HUNT.rate;
      HUNT.rate = function (s, ...rest) { const v = rt0.call(this, s, ...rest); return v > 0 && ride(s) ? v * (1 + num.huntrate(tier(s))) : v; };
      const lo0 = HUNT.loot;
      HUNT.loot = function (s, e, rnd = Math.random) {
        const got = lo0.call(this, s, e, rnd);
        try {
          if (s?.horse && typeof HORSES !== "undefined" && HORSES.riding(s)) {
            hgain(s, XP.hunt, "hunt");
            if (ride(s) && e?.game && typeof D !== "undefined" && D.ITEMS.mat_leather && rnd() < num.hide(tier(s))) { G.give(s, "mat_leather", 1); got.push(D.ITEMS.mat_leather.name + " (" + T("hunter's horse") + ")"); }
          }
        } catch (err) { /* keep the loot */ }
        return got;
      };
    }
  }
  install();
  return { RANKS, CARRY, DOG_CARRY, ROAD_STEP, ROAD_CAP, ARCH_SIG, rankOf, rank, loyal, carry, rankSig, aiOpts, rankCheck, addLoyal, roadTime, hardFight, rankHTML,
    HLV, HNAMES, SPECS, SPEC_AT, GROOM_COST, GROOM_XP, RETRAIN_COST, XP, num, hb, hlevel, tier, spec, specText, hgain, groom, pickSpec, horseHTML, horseLine, act, questWatch, install };
})();
if (typeof module !== "undefined") module.exports = BONDS2;
