/* wagons.js: the caravans' wagons on the map are something you can tap. [OURS] numbers.
   Tap (or click) a wagon anywhere on the map and a SkyUI-style card opens: whose wagons they are, where they're going,
   what they carry, and how they're doing (resting in town, rolling, broken down, under attack, guarded, robbed).
   What you can do from the card:
   - Catch up: travel to where you'll meet them on their road (worked out from their timetable and your pace).
     When you reach them you stop and meet them (caravanroad.js), and the thing you picked on the card happens.
   - Trade: their packs follow their cargo, plus relief goods when the hold they're heading for is in crisis.
     Prices follow that hold's crisis (crises.js priceMult). Buy from the card when you're beside them.
   - Escort them to their stop: pay on arrival, the caravan's own ambushes on the way, word gets around the hold
     (livingworld.js). If that hold's Jarl has posted an escort contract (crises.js), it counts as one: relief for
     everyone working on the crisis.
   - Ask for news: a lead on your map, a place you didn't know, and how things stand in the hold they're heading for.
   - Help: a wagon that broke down (fix the wheel: Smithing, an iron ingot helps) or one under attack (fight beside
     their guards) pays a reward and raises your name in the hold. Each wagon breakdown or attack can be helped once.
   - Rob them: a crime (bounty in the hold, worse name, a fight with their guards). Never wagons another hero guards.
   Wagons are on a timetable every phone shares (caravans.js), so their state is shared too: who fixed a wheel, who
   drove off an attack, who robbed them, who guards them (the "wagons" collection, one record per caravan run).
   In a party only the leader stops for wagons or sets off after them (partyplay.js); fights and loot follow the road's
   rules (eventDone in ui.js: road finds voted, gold split evenly).
   Perk: Caravan Friend (Speechcraft) also makes caravans on the road sell to you 10% cheaper (perkfx.js "cvprice").
   Pure parts are tested in node: tests/test_wagons.js (and a balance sim). */
const WAGONS = (() => {
  const BREAK_P = 0.3, BREAK_LEN = 0.12, ATK_PRE = 0.08, ATK_POST = 0.02;
  const FIX_BASE = 18, FIX_LV = 2, FIX_MAX = 80, SAVE_BASE = 30, SAVE_LV = 3, SAVE_MAX = 130;
  const ROAD_CUT = 0.95, PRICE_PERK_MAX = 0.15, BUY_MAX = 3, HIT_PX = 26;
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const pfx = (s, k) => (typeof PFX !== "undefined" && s ? PFX.num(s, k) : 0);
  const fill = (en, v) => (v ? en.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k] ?? "") : m)) : en);
  const T = (en, v) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : fill(en, v));
  const NEAR = () => (typeof CVROAD !== "undefined" ? CVROAD.TAP_RANGE : 45);

  function seeded(id) { let a = 7; for (const ch of String(id)) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; }
  const frac = (c, t = nowS()) => (c.phase !== "road" ? 0 : Math.min(1, Math.max(0, (t - c.depart) / c.leg.secs)));
  const find = (cid, t = nowS()) => CARAVANS.all(t).find((c) => c.id === cid) || null;
  function st(s) {
    s.wagons = s.wagons || {};
    const w = s.wagons; w.tried = w.tried || {}; w.news = w.news || {}; w.bought = w.bought || {};
    return w;
  }
  /* keep only the last few caravan runs in a per-run record */
  function trim(o, n = 10) { const k = Object.keys(o); if (k.length > n) for (const x of k.slice(0, k.length - n)) delete o[x]; }

  // ---------------------------------------------------------------- shared state (co-op): one record per caravan run
  let shared = {}, sink = null;
  function setShared(docs) { shared = {}; for (const d of docs || []) if (d && d.id) shared[d.id] = d; }
  const sh = (cid) => shared[cid] || {};
  /* merge a change into this run's record and send it (Store.put in the game) */
  function share(cid, patch) {
    const d = { ...sh(cid) };
    for (const [k, v] of Object.entries(patch)) d[k] = v && typeof v === "object" && !Array.isArray(v) && d[k] && typeof d[k] === "object" ? { ...d[k], ...v } : v;
    d.t = Math.round(nowS()); d.id = cid; shared[cid] = d;
    if (sink) try { const { id, ...doc } = d; sink(cid, doc); } catch (e) { /* offline: it stays local */ }
    return d;
  }

  // ---------------------------------------------------------------- state of a caravan run
  /* a breakdown on this run (the same on every phone), or null; never on top of an ambush */
  function trouble(c) {
    const r = seeded(c.id + "|wg"), p = CARAVANS.plan(c);
    if (r() >= BREAK_P) return null;
    for (let k = 0; k < 4; k++) {   // a few tries to find a stretch of road clear of its ambushes
      const at = 0.12 + r() * 0.6;
      if (!p.at.some((a) => at < a + ATK_POST + 0.03 && at + BREAK_LEN > a - ATK_PRE - 0.03)) return { at, len: BREAK_LEN };
    }
    return null;
  }
  /* {k: resting|rolling|broken|attacked|escorted|robbed, ...} */
  function state(s, c, t = nowS()) {
    if (!c) return { k: "gone" };
    if (c.phase !== "road") return { k: "resting", leaves: Math.max(0, c.depart - t) };
    const f = frac(c, t), d = sh(c.id), p = CARAVANS.plan(c);
    if (s && s.caravanJob && s.caravanJob.id === c.id) return { k: "escorted", you: true };
    for (let i = 0; i < p.at.length; i++) {
      const a = p.at[i];
      if (f >= a - ATK_PRE && f <= a + ATK_POST && !(d.saved && d.saved[i])) return { k: "attacked", i, foe: p.foes[i], name: CARAVANS.FOES[p.foes[i]].name };
    }
    const b = trouble(c);
    if (b && f >= b.at && f <= b.at + b.len && !d.fixed) return { k: "broken" };
    const others = Object.entries(d.escorts || {}).filter(([uid]) => !s || uid !== s.id).map(([, n]) => n);
    if (others.length) return { k: "escorted", by: others[0] };
    if (d.robbed) return { k: "robbed", by: d.robbed.by };
    return { k: "rolling", fixedBy: d.fixed?.by || null };
  }
  function stateText(x, c) {
    switch (x.k) {
      case "resting": return T("Resting in {town}. They roll out in {n} min.", { town: c.from, n: Math.max(1, Math.ceil(x.leaves / 60)) });
      case "attacked": return T("Under attack: {foe} on the road!", { foe: x.name });
      case "broken": return T("Broken down: a wheel came off and they're stuck.");
      case "escorted": return x.you ? T("You're guarding them.") : T("Guarded by {name}.", { name: x.by });
      case "robbed": return T("Robbed on this road by {name}. The guards are jumpy.", { name: x.by || T("someone") });
      case "rolling": return x.fixedBy ? T("Rolling again. {name} fixed their wheel.", { name: x.fixedBy }) : T("On the road, all well.");
      default: return T("They've moved on.");
    }
  }

  // ---------------------------------------------------------------- cargo and trade
  const RELIEF = { snow: ["mat_firewood", "food_bread", "potion_stamina"], famine: ["food_bread", "food_cabbage", "food_potato"], bandit: ["potion_health_minor", "mat_iron", "mat_leather"],
    beasts: ["pelt_wolf", "potion_health_minor"], corruption: [] };
  /* the hold a caravan is heading for, and its crisis if one is open there */
  function destHold(c) { try { return G.holdAt(WORLD.places[c.to]); } catch (e) { return null; } }
  function crisisAt(s, c, t = nowS()) {
    if (typeof CRISES === "undefined") return null;
    const hold = destHold(c); if (!hold) return null;
    try {
      const cr = CRISES.crisisIn(hold, t); if (!cr) return null;
      const x = CRISES.status(cr, s, t); if (x.state !== "active" && x.state !== "boss") return null;
      return { cr, hold, st: x, name: T(CRISES.CHAINS[cr.chain].name), escort: x.open && CRISES.CHAINS[cr.chain].contracts.includes("escort") };
    } catch (e) { return null; }
  }
  function cargo(s, c, t = nowS()) {
    const cx = crisisAt(s, c, t), ok = (i) => typeof D !== "undefined" && D.ITEMS[i] && (typeof SHOPCAP === "undefined" || SHOPCAP.ok(i));
    const relief = cx ? (RELIEF[cx.cr.chain] || []).filter(ok).slice(0, 2) : [];
    const label = c.line.khajiit ? T("Gems, jewellery and Khajiit trinkets") : T("Iron, steel, pelts and food");
    return { label: relief.length ? `${label} · ${T("relief for {hold}", { hold: cx.hold })}` : label, relief, crisis: cx };
  }
  function stock(s, c, t = nowS()) {
    const ok = (i) => typeof D !== "undefined" && D.ITEMS[i] && (typeof SHOPCAP === "undefined" || SHOPCAP.ok(i));
    return [...new Set([...CARAVANS.stock(c), ...cargo(s, c, t).relief, "potion_health_minor"])].filter(ok).slice(0, 7);
  }
  /* a road trader's price: a little under a town's, moved by the crisis in the hold they're heading for, never below what any shop pays you */
  function price(s, c, item, t = nowS()) {
    const base = G.buyPrice(s, item, null);
    const cm = typeof CRISES !== "undefined" && c.to ? CRISES.priceMult(s, c.to, item, t) : 1;
    const perk = 1 - Math.min(PRICE_PERK_MAX, pfx(s, "cvprice"));
    const floor = (G.sellPrice ? G.sellPrice(s, { item }, null) : 0) + 1;
    return Math.max(1, floor, Math.round(base * ROAD_CUT * cm * perk));
  }
  const boughtOf = (s, cid, item) => (st(s).bought[cid] || {})[item] || 0;
  /* buy one thing from a caravan you're beside. c = the caravan (or the meeting event: {cid, to}) */
  function buy(s, c, item, t = nowS()) {
    const cid = c.cid || c.id, cv = find(cid, t) || c;
    if (!cv.line && !c.stock) return T("They've moved on.");
    const list = cv.line ? stock(s, cv, t) : c.stock;
    if (!list.includes(item)) return T("They don't sell that.");
    if (boughtOf(s, cid, item) >= BUY_MAX) return T("That's all they have of it.");
    const p = price(s, { to: c.to || cv.to }, item, t);
    if (s.gold < p) return T("That costs {p} gold. You have {g}.", { p, g: s.gold });
    s.gold -= p; G.give(s, item, 1); G.useSkill(s, "Mercantile", p);
    const w = st(s); (w.bought[cid] = w.bought[cid] || {})[item] = boughtOf(s, cid, item) + 1; trim(w.bought);
    return T("Bought {item} for {p} gold.", { item: D.ITEMS[item].name, p });
  }

  // ---------------------------------------------------------------- catching up
  /* where you'll meet a caravan on its road: {pos, secs} (secs from now), or {town, pos} to meet them at a stop.
     secsTo(pos) = your travel time in seconds. */
  function intercept(c, t, from, secsTo) {
    if (c.phase !== "road") return { town: c.from, pos: c.leg.A, secs: secsTo(c.leg.A), resting: true };
    const here = CARAVANS.pos(c, t);
    if (G.pxDist(here, from) <= NEAR() * 0.6) return { pos: here, secs: 0, near: true };
    const span = c.arrive - t, N = 24;
    let lo = 0, hi = null;
    for (let i = 1; i <= N; i++) {
      const dt = (span * i) / N;
      if (secsTo(CARAVANS.pos(c, t + dt)) <= dt) { hi = dt; lo = (span * (i - 1)) / N; break; }
    }
    if (hi == null) return { town: c.to, pos: c.leg.B, secs: secsTo(c.leg.B), late: true };
    for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (secsTo(CARAVANS.pos(c, t + m)) <= m) hi = m; else lo = m; }
    return { pos: CARAVANS.pos(c, t + hi), secs: hi };
  }

  // ---------------------------------------------------------------- news
  function unknownNear(s, p) {
    const known = new Set(s.discovered);
    const list = Object.entries(WORLD.places).filter(([n, q]) => !known.has(n) && !["city", "town"].includes(q[2]) && (!WORLD.same || WORLD.same(p, q)) && !(WORLD.hidden && WORLD.hidden.has(n)))
      .map(([n, q]) => ({ n, d: G.pxDist(p, q) })).filter((x) => x.d < 200).sort((a, b) => a.d - b.d);
    return list.length ? list[Math.floor(Math.random() * Math.min(4, list.length))].n : null;
  }
  /* what the wagon master tells you: crisis news for where they're going, plus a lead or a place on your map */
  function news(s, c, t = nowS()) {
    const w = st(s);
    if (w.news[c.id]) return { text: T("\"That's all we've heard, friend.\""), again: true };
    w.news[c.id] = t; trim(w.news);
    const out = [];
    const cx = crisisAt(s, c, t);
    if (cx) {
      const stage = CRISES.CHAINS[cx.cr.chain].stages[Math.max(0, Math.min(4, cx.st.stage - 1))];
      out.push(T("\"{hold}'s in a bad way: {crisis}. {what}\"", { hold: cx.hold, crisis: cx.name, what: T(stage[1], { hold: cx.hold }) }));
      if (cx.st.open) out.push(T("The Jarl is paying for help in {place}.", { place: cx.cr.place }));
    }
    let lead = false;
    const r = typeof RUMOURS !== "undefined" && RUMOURS.roadLead ? RUMOURS.roadLead(s, c.to, t) : { err: true };
    if (!r.err) { out.push(T("\"And I heard this in the last town: {say}\" {place} is marked on your map.", { say: r.say, place: r.lead.place })); lead = true; }
    else {
      const spot = unknownNear(s, WORLD.places[c.to] || [s.x, s.y]);
      if (spot) { s.discovered.push(spot); out.push(T("\"There's a place off the road near {town} you might not know: {spot}.\" It's marked on your map now.", { town: c.to, spot })); lead = true; }
    }
    if (!out.length) out.push(T("\"Quiet roads, thank the Eight. Nothing worth telling.\""));
    return { text: out.join(" "), lead, crisis: !!cx };
  }

  // ---------------------------------------------------------------- helping a wagon in trouble
  const fixPay = (s) => Math.min(FIX_MAX, FIX_BASE + FIX_LV * (s.level || 1));
  const savePay = (s) => Math.min(SAVE_MAX, SAVE_BASE + SAVE_LV * (s.level || 1));
  function canHelp(s, c, t = nowS()) {
    const x = state(s, c, t), tr = st(s).tried[c.id] || {};
    if (x.k === "broken" && !tr.fix) return { kind: "fix", x };
    if (x.k === "attacked" && !tr["save" + x.i]) return { kind: "save", x };
    return null;
  }
  function helpLabel(s, c, t = nowS()) {
    const h = canHelp(s, c, t); if (!h) return null;
    return h.kind === "fix" ? T("Help fix the wheel ({g} gold)", { g: fixPay(s) }) : T("Fight off the {foe:lc} ({g} gold)", { foe: h.x.name, g: savePay(s) });
  }
  const repDeed = (s, hold, pts, line, t) => { try { if (typeof LIVING !== "undefined" && hold) LIVING.deed(s, "guard", hold, pts, line, t); } catch (e) { /* ignore */ } };
  /* returns a road-event result: {text} for a repair, {text, foe, afterFn} for a fight beside the guards */
  function help(s, c, t = nowS(), rnd = Math.random) {
    const h = canHelp(s, c, t); if (!h) return { text: T("They don't need a hand right now."), keep: true };
    const w = st(s); w.tried[c.id] = w.tried[c.id] || {}; trim(w.tried);
    const hold = G.holdAt(CARAVANS.pos(c, t));
    if (h.kind === "fix") {
      w.tried[c.id].fix = 1;
      const iron = (s.inv || []).find((r) => r.item === "mat_iron" && r.qty > 0 && !r.stolen);
      const chance = Math.min(0.95, 0.5 + G.skill(s, "Smithing") / 200 + (iron ? 0.3 : 0));
      const skills = G.useSkill(s, "Smithing", 15);
      if (rnd() >= chance) return { text: T("You heave and hammer, but the axle's cracked through. The wagon master thanks you anyway and sends a rider for a new one."), skills };
      if (iron) G.take(s, iron.id, 1);
      const g = fixPay(s); s.gold += g;
      share(c.id, { fixed: { by: s.name, uid: s.id, t: Math.round(t) } });
      repDeed(s, hold, 2, `${s.name} fixed a broken wagon on the road in ${hold}.`, t);
      return { text: (iron ? T("You fit a new iron pin from your pack and the wheel goes back on. ") : T("You jack the wagon up and get the wheel back on. ")) + T("\"We owe you, friend.\" The wagon master pays you {g} gold.", { g }), skills, fixed: true, gold: g };
    }
    const i = h.x.i; w.tried[c.id]["save" + i] = 1;
    const base = CARAVANS.FOES[h.x.foe];
    const foe = { ...base, tags: [...base.tags], gold: [...base.gold], caravan: true, khajiit: !!c.line.khajiit, level: Math.max(4, s.level || 1), hold };
    const afterFn = (ss) => {
      const g = savePay(ss); ss.gold += g;
      share(c.id, { saved: { [i]: ss.name } });
      if (typeof CRISES !== "undefined") try { CRISES.deed(ss, hold, "escort"); } catch (e) { /* ignore */ }
      repDeed(ss, hold, 3, `${ss.name} saved ${c.line.name} from ${base.name.toLowerCase()} in ${hold}.`, t);
      return T("The wagon master presses {g} gold into your hand. \"Without you, we'd be dead in the road.\"", { g });
    };
    return { text: T("You run to the wagons and draw your weapon beside their guards."), foe, afterFn };
  }

  // ---------------------------------------------------------------- escorts and the Jarl's escort contracts
  /* on arrival with an escort picked up on the road: counts as the Jarl's supply escort if that hold has one posted */
  function crisisEscort(s, town, t = nowS()) {
    if (typeof CRISES === "undefined" || !WORLD.places[town]) return "";
    const hold = G.holdAt(WORLD.places[town]);
    try {
      CRISES.deed(s, hold, "escort");   // Security and trade in the hold go up a little either way
      const cr = CRISES.crisisIn(hold, t); if (!cr) return "";
      const x = CRISES.status(cr, s, t);
      if (!x.open || !(x.state === "active" || x.state === "boss") || !CRISES.CHAINS[cr.chain].contracts.includes("escort")) return "";
      const m = CRISES.mine(s, t), key = cr.id + ":escort";
      if (t - (m.cd[key] || 0) < CRISES.CONTRACT_CD) return "";
      m.cd[key] = t;
      const rl = Math.round(CRISES.CONTRACTS.escort.relief * (1 + Math.min(0.5, pfx(s, "crisisrelief"))) * 10) / 10;
      m.rel[cr.id] = (m.rel[cr.id] || 0) + rl;
      return T("The Jarl's steward counts it as a supply escort for {hold}. (+{r} relief)", { hold, r: rl });
    } catch (e) { return ""; }
  }
  /* other heroes guarding this run (robbing them would mean robbing a player) */
  const guardedByOthers = (s, cid) => Object.keys(sh(cid).escorts || {}).some((uid) => uid !== s.id);

  // ---------------------------------------------------------------- the meeting (road event) gets help, better news, crisis prices
  function wrap() {
    if (typeof ROAD_EVENTS === "undefined" || ROAD_EVENTS.__wg || typeof CVROAD === "undefined") return;
    const base = { choices: ROAD_EVENTS.choices, choose: ROAD_EVENTS.choose };
    ROAD_EVENTS.choices = (e, s) => {
      const out = base.choices(e, s);
      if (!CVROAD.isMeet(e) || e.robbed) return out;
      const c = find(e.cid), lbl = c && helpLabel(s, c);
      if (lbl) out.splice(Math.max(0, out.findIndex((x) => x[0] === "rob")), 0, ["help", lbl]);
      if (guardedByOthers(s, e.cid)) return out.filter((x) => x[0] !== "rob");
      return out;
    };
    ROAD_EVENTS.choose = (s, e, ch) => {
      if (!CVROAD.isMeet(e)) return base.choose(s, e, ch);
      const t = nowS(), c = find(e.cid, t);
      if (ch === "help") { if (!c || c.phase !== "road") return { text: T("The wagons have already rolled on.") }; const r = help(s, c, t); if (!r.foe) r.keep = true; return r; }
      if (ch === "news" && c) { e.heard = true; const r = news(s, c, t); return { text: r.text, keep: true, skills: G.useSkill(s, "Speechcraft", 6) }; }
      if (ch === "trade" && c) e.stock = stock(s, c, t);
      if (ch === "rob" && guardedByOthers(s, e.cid)) return { text: T("Another hero is guarding these wagons. You leave them be."), keep: true };
      const r = base.choose(s, e, ch);
      if (ch === "rob" && c) { share(c.id, { robbed: { by: s.name, uid: s.id, t: Math.round(t) } }); try { if (typeof CRISES !== "undefined") CRISES.deed(s, G.holdAt([s.x, s.y]), "theft"); } catch (er) { /* ignore */ } }
      if (ch === "escort" && s.caravanJob?.escort && s.caravanJob.id === e.cid) {
        share(e.cid, { escorts: { [s.id]: s.name } });
        const cx = c && crisisAt(s, c, t);
        if (cx && cx.escort) r.text = `${r.text} ${T("{hold}'s Jarl is paying for supply escorts: this one counts.", { hold: cx.hold })}`;
      }
      return r;
    };
    ROAD_EVENTS.__wg = true;
    // arrival: the escort may count for the Jarl's contract
    const arr = CVROAD.arrived;
    CVROAD.arrived = (s) => { const j = s.caravanJob, m = arr(s); if (!m || !j) return m; const x = crisisEscort(s, j.to); return x ? `${m} ${x}` : m; };
    // catching up: the caravan you're after stops for you even if you met them a little while ago
    const am = CVROAD.autoMeet;
    CVROAD.autoMeet = (s, pos, t = nowS()) => {
      const ch = s.wagons?.chase;
      if (ch && CVROAD.canMeet(s)) {
        if (t > ch.until) s.wagons.chase = null;
        else { const c = find(ch.cid, t); if (c && c.phase === "road" && G.pxDist(CARAVANS.pos(c, t), pos) <= CVROAD.TAP_RANGE) return c; }
      }
      return am(s, pos, t);
    };
  }
  /* catch up with a caravan: remember which one, and what you meant to do when you reach it */
  function chase(s, cid, intent, secs, t = nowS()) { st(s).chase = { cid, intent: intent || null, until: t + Math.max(300, (secs || 0) * 1.6 + 120) }; return st(s).chase; }
  /* the meeting with the caravan you were after: the action to take now (and forget the chase) */
  function takeIntent(s, cid) { const ch = s.wagons?.chase; if (!ch || ch.cid !== cid) return null; s.wagons.chase = null; return ch.intent; }

  // ---------------------------------------------------------------- the card data
  function info(s, c, pos, t = nowS(), secsTo = null) {
    const x = state(s, c, t), cg = cargo(s, c, t), p = CARAVANS.pos(c, t), d = G.pxDist(p, pos);
    const near = c.phase === "road" && d <= NEAR() && !s.location && !s.dungeon;
    return { id: c.id, name: c.line.name, khajiit: !!c.line.khajiit, from: c.from, to: c.to, phase: c.phase, frac: frac(c, t), state: x, stateText: stateText(x, c),
      cargo: cg.label, crisis: cg.crisis, stock: stock(s, c, t), arrive: c.arrive, depart: c.depart, pos: p, dist: d, near,
      escortPay: typeof CVROAD !== "undefined" && c.phase === "road" ? CVROAD.escortPay(s, c, t) : 0, escortOk: c.phase === "road" && !s.caravanJob && 1 - frac(c, t) > 0.12,
      help: helpLabel(s, c, t), robOk: !guardedByOthers(s, c.id) && !(s.cvRoad?.robbed?.[c.id]), heard: !!st(s).news[c.id],
      catchUp: secsTo ? intercept(c, t, pos, secsTo) : null };
  }

  // ================================================================ in the game (browser only)
  const live = typeof document !== "undefined" && typeof document.createElement === "function";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  let api = null, openId = null, showTrade = false, hoverId = null, lastXY = [0, 0];
  /* api = { S, Store, toast, persist, livePos, canDecide, travelSpot(pos), meet(cid), hail(cid), secsTo(pos), kick, zoomAt(z, sx, sy), zoom() } */
  function mount(a) {
    api = a;
    sink = (id, doc) => { try { a.Store?.put("wagons", id, doc); } catch (e) { /* offline */ } };
    if (a.Store?.watch && !mount.w) { mount.w = true; a.Store.watch("wagons", (docs) => { setShared(docs); if (openId) render(); }); }
    if (live && !mount.k) { mount.k = true; document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openId && !e.defaultPrevented) { e.preventDefault(); close(); } });   // Esc closes the panel and nothing else (desktop.js skips a handled Esc)
      addEventListener("resize", () => { const el = openId && document.getElementById("wgcard"); if (el) place(el); }); }
  }
  const MW = () => (typeof WorldMap !== "undefined" ? WorldMap.W : 1000), MH = () => (typeof WorldMap !== "undefined" ? WorldMap.H : 700);
  function screen(v, pos) { const { k, ox, oy } = v.transform; return [pos[0] * MW() * k + ox, pos[1] * MH() * k + oy]; }
  /* a cluster pin under the point (zoomed out): {x, y, n, wagons} or null */
  function clusterAt(v, sx, sy, canvas) {
    if (typeof WorldMap === "undefined" || !WorldMap.clusterMovers || !v?.transform) return null;
    const UI = canvas ? Math.max(1, Math.min(1.3, Math.min(canvas.clientWidth, canvas.clientHeight) / 860)) : 1;
    const CL = WorldMap.clusterMovers(v, (p) => screen(v, p), UI);
    let best = null, bd = 30 * UI;
    for (const pin of CL.pins) { const d = Math.hypot(pin.x - sx, pin.y - 8 * UI - sy); if (d < bd) { bd = d; best = pin; } }
    return best ? { x: best.x, y: best.y, n: best.n, wagons: best.items.filter((i) => i.kind === "wagon").map((i) => i.o.id) } : null;
  }
  /* the wagon under the point (not one inside a cluster pin), or null */
  function wagonAt(v, sx, sy, canvas) {
    if (!v?.transform || !v.caravans) return null;
    let skip = new Set();
    if (typeof WorldMap !== "undefined" && WorldMap.clusterMovers) { const UI = canvas ? Math.max(1, Math.min(1.3, Math.min(canvas.clientWidth, canvas.clientHeight) / 860)) : 1; skip = WorldMap.clusterMovers(v, (p) => screen(v, p), UI).skip; }
    let best = null, bd = HIT_PX;
    for (const c of v.caravans) {
      if (!c.visible || !c.id || skip.has(c) || c.mine) continue;
      const [x, y] = screen(v, c.pos), d = Math.hypot(x - sx, y - 10 - sy);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  /* the map's view: mark the hovered wagon and wagons in trouble (map.js draws a ring and a badge) */
  function decorate(v, S) {
    if (!v?.caravans) return;
    const t = nowS();
    for (const c of v.caravans) {
      c.hover = !!hoverId && c.id === hoverId;
      c.open = !!openId && c.id === openId;
      const cv = c.moving ? find(c.id, t) : null, x = cv ? state(S, cv, t) : null;
      c.trouble = x && (x.k === "broken" || x.k === "attacked") ? x.k : null;
    }
  }
  /* PC: the pointer over the map (no button down). Returns true when it's over a wagon or a cluster */
  function hover(v, sx, sy, canvas) {
    const c = wagonAt(v, sx, sy, canvas), cl = c ? null : clusterAt(v, sx, sy, canvas);
    const id = c ? c.id : null, was = hoverId;
    hoverId = id;
    if (canvas) canvas.style.cursor = c || cl ? "pointer" : "";
    if (was !== id) api?.kick?.();
    return !!(c || cl);
  }
  /* a tap on the map: a cluster zooms in; a wagon opens its card. Returns true if handled */
  function tap(v, sx, sy, canvas) {
    if (!api || !v?.transform) return false;
    const cl = clusterAt(v, sx, sy, canvas);
    if (cl && cl.wagons.length) {
      const z = api.zoom ? api.zoom() : v.zoom;
      api.zoomAt?.(Math.max(z * 1.8, (WorldMap.CLUSTER_ZOOM || 3) + 0.3), cl.x, cl.y);
      api.toast?.(cl.wagons.length > 1 ? T("{n} caravans close together. Zoomed in.", { n: cl.wagons.length }) : T("Zoomed in on the caravan."));
      return true;
    }
    if (cl) { const z = api.zoom ? api.zoom() : v.zoom; api.zoomAt?.(Math.max(z * 1.8, (WorldMap.CLUSTER_ZOOM || 3) + 0.3), cl.x, cl.y); return true; }
    const c = wagonAt(v, sx, sy, canvas);
    if (!c) return false;
    if (typeof OVERLAYS !== "undefined" && OVERLAYS.level() >= OVERLAYS.LEVEL.decision && !document.getElementById("wgcard")) return false;   // a window or result is up: it comes first
    open(c.id, sx, sy);
    return true;
  }
  function open(cid, sx, sy) { openId = cid; showTrade = false; if (sx != null) lastXY = [sx, sy]; render(); api?.kick?.(); }
  function close() { document.getElementById("wgcard")?.remove(); if (live) document.documentElement.classList.remove("wg-open"); openId = null; showTrade = false; api?.kick?.(); }
  const mins = (sec) => { const m = Math.max(1, Math.round(sec / 60)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  function render() {
    if (!live || !api || !openId) return;
    const S = api.S(), t = nowS(), c = find(openId, t);
    if (!S || !c) return close();
    const pos = api.livePos(), I = info(S, c, pos, t, api.secsTo);
    const lead = api.canDecide ? api.canDecide() : true;
    const stCls = { attacked: "bad", broken: "warn", robbed: "warn", escorted: "good" }[I.state.k] || "";
    const cu = I.catchUp, cuTxt = !cu ? "" : cu.near ? T("Right beside you") : cu.resting ? T("{n} to {town}", { n: mins(cu.secs), town: cu.town }) : cu.late ? T("Too far: meet them in {town} ({n})", { town: cu.town, n: mins(cu.secs) }) : T("About {n} to catch them", { n: mins(cu.secs) });
    const row = (k, v, cls = "") => `<div class="wg-row"><span>${esc(k)}</span><b class="${cls}">${esc(v)}</b></div>`;
    const btn = (act, label, sub, o = {}) => `<button class="wg-act${o.pri ? " pri" : ""}${o.danger ? " danger" : ""}" data-wg="${act}"${o.off ? " disabled" : ""}><span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
    const far = !I.near, gate = !lead ? T("Your party's leader decides on the road") : far ? T("Catch up first · {n}", { n: cu && !cu.near ? mins(cu.secs) : "" }) : "";
    const acts = [];
    if (far) acts.push(btn("catch", T("Catch up"), lead ? cuTxt : T("Your party's leader decides on the road"), { pri: true, off: !lead || (I.phase === "road" && cu?.late && false) }));
    else acts.push(btn("meet", S.trip?.status === "travel" ? T("Stop and meet them") : T("Hail them"), T("Trade, talk or travel with them"), { pri: true, off: !lead }));
    acts.push(btn("trade", showTrade ? T("Hide their packs") : T("Trade"), I.near ? T("{n} things for sale", { n: I.stock.length }) : T("See what they carry")));
    if (I.phase === "road" && I.escortOk) acts.push(btn("escort", T("Escort them to {town}", { town: I.to }), `${I.escortPay} ${T("gold")}${I.crisis?.escort ? " · " + T("counts for the Jarl's contract") : ""}${gate ? " · " + gate : ""}`, { off: !lead }));
    acts.push(btn("news", T("Ask for news"), I.heard ? T("They've told you all they know") : I.near ? T("A lead, a place, or word of a crisis") : gate, { off: I.heard || (!I.near && !lead) }));
    if (I.help) acts.push(btn("help", I.help, gate, { pri: true, off: !lead }));
    if (I.phase === "road") acts.push(btn("rob", T("Rob them"), I.robOk ? T("A crime: bounty and a worse name in {hold}", { hold: G.holdAt(I.pos) }) : T("Not these wagons"), { danger: true, off: !lead || !I.robOk }));
    const trade = showTrade ? `<div class="wg-trade" role="list">${I.stock.map((i) => { const p = price(S, c, i, t), left = BUY_MAX - boughtOf(S, c.id, i); return `<div class="wg-item" role="listitem"><span class="nm">${esc(D.ITEMS[i].name)}<small>${esc(D.ITEMS[i].weight)} wt${left < BUY_MAX ? ` · ${left} ${esc(T("left"))}` : ""}</small></span><b class="gold">${p}</b><button class="btn sm" data-wg="buy" data-item="${esc(i)}"${I.near && S.gold >= p && left > 0 ? "" : " disabled"}>${esc(T("Buy"))}</button></div>`; }).join("")}
      <p class="wg-note">${esc(I.near ? T("You have {g} gold.", { g: S.gold }) : T("Catch up with them to buy."))}${I.crisis ? " " + esc(T("Prices follow the crisis in {hold}.", { hold: I.crisis.hold })) : ""}</p></div>` : "";
    let el = document.getElementById("wgcard");
    if (!el) { el = document.createElement("div"); el.id = "wgcard"; el.className = "wgcard"; el.setAttribute("role", "dialog"); el.onclick = onClick; document.body.appendChild(el); }
    const keep = el.querySelector(".wg-body")?.scrollTop || 0;   // a refresh (shared state, a purchase) keeps your place in the list
    el.setAttribute("aria-label", I.name);
    el.innerHTML = `<div class="wg-top"><button class="iconbtn wg-x" data-wg="x" aria-label="${esc(T("Close"))}">✕</button>
      <div class="wg-h"><span class="wg-pic">${CARAVANS.wagonHTML ? CARAVANS.wagonHTML(58, 40, { khajiit: I.khajiit, cover: true }) : ""}</span><div><b>${esc(I.name)}</b><span>${esc(I.khajiit ? T("Khajiit caravan") : T("Nord merchant wagons"))}</span></div></div>
      <div class="wg-route"><span>${esc(I.from)}</span><i><em style="width:${Math.round(I.frac * 100)}%"></em></i><span>${esc(I.to)}</span></div></div>
      <div class="wg-body">${row(T("Cargo"), I.cargo)}${row(T("State"), I.stateText, stCls)}
      ${I.phase === "road" ? row(T("Arrives"), T("in {n}", { n: mins(I.arrive - t) })) : ""}
      ${I.crisis ? row(T("Heading into"), `${I.crisis.hold}: ${I.crisis.name}`, "warn") : ""}
      <div class="wg-acts">${acts.join("")}</div>${trade}</div>`;
    const body = el.querySelector(".wg-body"); if (body && keep) body.scrollTop = keep;
    place(el);
    document.documentElement.classList.add("wg-open");
  }
  /* PC map: a panel docked on the right (CSS). Anywhere else: a sheet sitting on top of the bottom nav bar, never under it */
  function place(el) {
    const pc = document.documentElement.classList.contains("pcmap");
    el.classList.toggle("sheet", !pc);
    el.classList.toggle("wide", !pc && innerWidth >= 760);
    if (pc) { el.style.bottom = ""; el.style.maxHeight = ""; return; }
    let navTop = innerHeight;
    for (const n of document.querySelectorAll("#tabs, .tabs, .mn-bar")) {
      const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
      if (r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" && (cs.position === "fixed" || cs.position === "sticky") && r.top > innerHeight / 2) navTop = Math.min(navTop, r.top);
    }
    const bottom = Math.max(0, Math.round(innerHeight - navTop));
    el.style.bottom = bottom + "px";
    el.style.maxHeight = Math.max(240, Math.min(Math.round(innerHeight * 0.72), navTop - 56)) + "px";
  }
  function onClick(e) {
    const b = e.target.closest("[data-wg]"); if (!b || b.disabled || !api) return;
    e.stopPropagation();
    const S = api.S(), t = nowS(), c = find(openId, t), act = b.dataset.wg;
    if (typeof SOUND !== "undefined") try { SOUND.fx("click"); } catch (er) { /* ignore */ }
    if (act === "x" || !c) return close();
    if (act === "trade") { showTrade = !showTrade; return render(); }
    if (act === "buy") { const pos = api.livePos(); if (G.pxDist(CARAVANS.pos(c, t), pos) > NEAR() || S.location || S.dungeon) { api.toast(T("Catch up with them to buy.")); return render(); } const m = buy(S, c, b.dataset.item, t); api.persist(); api.toast(m); if (/^Bought|^Kupiono/.test(m) && typeof SOUND !== "undefined") try { SOUND.fx("coin"); } catch (er) { /* ignore */ } return render(); }
    if (act === "news" && G.pxDist(CARAVANS.pos(c, t), api.livePos()) <= NEAR() && !S.location && !S.dungeon) { const r = news(S, c, t); api.persist(); api.message ? api.message(c.line.name, r.text) : api.toast(r.text); return render(); }
    if (api.canDecide && !api.canDecide()) return api.toast(T("Only your party's leader can stop for a caravan."));
    const intent = { meet: null, catch: null, escort: "escort", news: "news", help: "help", rob: "rob" }[act] ?? null;
    const id = c.id; close();
    api.go(id, intent);
  }

  // ---------------------------------------------------------------- Polish
  const PL = {
    "Resting in {town}. They roll out in {n} min.": "Odpoczywają w {town}. Ruszają za {n} min.",
    "Under attack: {foe} on the road!": "Napad: {foe} na drodze!",
    "Broken down: a wheel came off and they're stuck.": "Awaria: odpadło koło i utknęli.",
    "You're guarding them.": "Ty ich eskortujesz.",
    "Guarded by {name}.": "Eskortuje ich {name}.",
    "Robbed on this road by {name}. The guards are jumpy.": "Obrabowani na tej drodze przez: {name}. Strażnicy są nerwowi.",
    "someone": "ktoś",
    "Rolling again. {name} fixed their wheel.": "Znów w drodze. {name} naprawił(a) im koło.",
    "On the road, all well.": "W drodze, wszystko w porządku.",
    "They've moved on.": "Już odjechali.",
    "Gems, jewellery and Khajiit trinkets": "Klejnoty, biżuteria i drobiazgi Khajiitów",
    "Iron, steel, pelts and food": "Żelazo, stal, skóry i jedzenie",
    "relief for {hold}": "pomoc dla krainy {hold}",
    "They don't sell that.": "Tego nie sprzedają.",
    "That's all they have of it.": "Więcej tego nie mają.",
    "That costs {p} gold. You have {g}.": "To kosztuje {p} złota. Masz {g}.",
    "Bought {item} for {p} gold.": "Kupiono: {item} za {p} złota.",
    "\"That's all we've heard, friend.\"": "„To wszystko, co słyszeliśmy, przyjacielu.”",
    "\"{hold}'s in a bad way: {crisis}. {what}\"": "„W krainie {hold} źle się dzieje: {crisis}. {what}”",
    "The Jarl is paying for help in {place}.": "Jarl płaci za pomoc w {place}.",
    "\"And I heard this in the last town: {say}\" {place} is marked on your map.": "„A w ostatnim mieście słyszałem to: {say}” {place} jest zaznaczone na twojej mapie.",
    "\"There's a place off the road near {town} you might not know: {spot}.\" It's marked on your map now.": "„Niedaleko {town}, z dala od drogi, jest miejsce, którego możesz nie znać: {spot}.” Masz je teraz na mapie.",
    "\"Quiet roads, thank the Eight. Nothing worth telling.\"": "„Spokojne drogi, dzięki Ośmiorgu. Nic wartego opowiadania.”",
    "Help fix the wheel ({g} gold)": "Pomóż naprawić koło ({g} złota)",
    "Fight off the {foe:lc} ({g} gold)": "Odeprzyj napastników: {foe:lc} ({g} złota)",
    "They don't need a hand right now.": "Teraz nie potrzebują pomocy.",
    "You heave and hammer, but the axle's cracked through. The wagon master thanks you anyway and sends a rider for a new one.": "Dźwigasz i stukasz, ale oś pękła na wylot. Woźnica i tak dziękuje i posyła jeźdźca po nową.",
    "You fit a new iron pin from your pack and the wheel goes back on. ": "Wbijasz nowy żelazny sworzeń z plecaka i koło wraca na miejsce. ",
    "You jack the wagon up and get the wheel back on. ": "Podważasz wóz i zakładasz koło z powrotem. ",
    "\"We owe you, friend.\" The wagon master pays you {g} gold.": "„Mamy u ciebie dług, przyjacielu.” Woźnica płaci ci {g} złota.",
    "The wagon master presses {g} gold into your hand. \"Without you, we'd be dead in the road.\"": "Woźnica wciska ci {g} złota do ręki. „Bez ciebie leżelibyśmy martwi na drodze.”",
    "You run to the wagons and draw your weapon beside their guards.": "Biegniesz do wozów i dobywasz broni obok ich strażników.",
    "The Jarl's steward counts it as a supply escort for {hold}. (+{r} relief)": "Zarządca jarla liczy to jako eskortę zapasów dla krainy {hold}. (+{r} pomocy)",
    "The wagons have already rolled on.": "Wozy już odjechały.",
    "Another hero is guarding these wagons. You leave them be.": "Te wozy eskortuje inny bohater. Zostawiasz je w spokoju.",
    "{hold}'s Jarl is paying for supply escorts: this one counts.": "Jarl krainy {hold} płaci za eskortę zapasów: ta się liczy.",
    "{n} caravans close together. Zoomed in.": "{n} karawany blisko siebie. Przybliżono.",
    "Zoomed in on the caravan.": "Przybliżono na karawanę.",
    "Right beside you": "Tuż obok ciebie",
    "{n} to {town}": "{n} do {town}",
    "Too far: meet them in {town} ({n})": "Za daleko: spotkaj ich w {town} ({n})",
    "About {n} to catch them": "Około {n}, by ich dogonić",
    "Your party's leader decides on the road": "W drodze decyduje przywódca drużyny",
    "Catch up first · {n}": "Najpierw ich dogoń · {n}",
    "Catch up": "Dogoń ich",
    "Stop and meet them": "Zatrzymaj się i spotkaj ich",
    "Hail them": "Zawołaj ich",
    "Trade, talk or travel with them": "Handluj, porozmawiaj albo jedź z nimi",
    "Hide their packs": "Schowaj ich towary",
    "Trade": "Handel",
    "{n} things for sale": "{n} rzeczy na sprzedaż",
    "See what they carry": "Zobacz, co wiozą",
    "Escort them to {town}": "Eskortuj ich do {town}",
    "gold": "złota",
    "counts for the Jarl's contract": "liczy się do zlecenia jarla",
    "Ask for news": "Zapytaj o wieści",
    "They've told you all they know": "Powiedzieli ci wszystko, co wiedzą",
    "A lead, a place, or word of a crisis": "Trop, miejsce albo wieści o kryzysie",
    "Rob them": "Obrabuj ich",
    "A crime: bounty and a worse name in {hold}": "Przestępstwo: nagroda za głowę i gorsza opinia w krainie {hold}",
    "Not these wagons": "Nie te wozy",
    "left": "zostało",
    "Buy": "Kup",
    "You have {g} gold.": "Masz {g} złota.",
    "Catch up with them to buy.": "Dogoń ich, żeby coś kupić.",
    "Prices follow the crisis in {hold}.": "Ceny idą za kryzysem w krainie {hold}.",
    "Close": "Zamknij",
    "Khajiit caravan": "Karawana Khajiitów",
    "Nord merchant wagons": "Nordyckie wozy kupieckie",
    "Cargo": "Ładunek",
    "State": "Stan",
    "Arrives": "Przyjazd",
    "in {n}": "za {n}",
    "Heading into": "Jadą do",
    "Only your party's leader can stop for a caravan.": "Tylko przywódca drużyny może zatrzymać się przy karawanie.",
    "You set off after the wagons.": "Ruszasz za wozami.",
    // the patch note
    "Caravans you can talk to": "Karawany, z którymi można pogadać",
    "Tap or click any caravan's wagons on the map to see who they are, where they're going, what they carry and how they're doing: rolling, resting in town, broken down, under attack, guarded or robbed.":
      "Dotknij lub kliknij wozy dowolnej karawany na mapie, by zobaczyć, kto to jest, dokąd jadą, co wiozą i jak im idzie: w drodze, odpoczywają w mieście, zepsuty wóz, napad, eskorta albo obrabowani.",
    "Catch up sends you to where you'll meet them on their road. When you reach them, whatever you picked on the card happens.":
      "Dogoń ich wyśle cię tam, gdzie spotkasz ich na drodze. Gdy ich dogonisz, stanie się to, co wybrałeś na karcie.",
    "Trade right from the card when you're beside them. Their packs follow their cargo, and when the hold they're heading for is in crisis they carry relief goods and their prices follow that crisis.":
      "Handluj prosto z karty, gdy jesteś obok nich. Towary zależą od ładunku, a gdy kraina, do której jadą, ma kryzys, wiozą pomoc, a ich ceny idą za tym kryzysem.",
    "Escorting them pays when they arrive. If that hold's Jarl is paying for supply escorts, it counts as one and helps end the crisis.":
      "Eskorta płaci, gdy dojadą. Jeśli jarl tej krainy płaci za eskortę zapasów, liczy się to jako jedna i pomaga zakończyć kryzys.",
    "Ask for news: a lead or a new place on your map, and how things stand where they're going.":
      "Zapytaj o wieści: trop albo nowe miejsce na mapie i to, jak wygląda sytuacja tam, dokąd jadą.",
    "Now and then a wagon breaks down or gets attacked on the road. Fix the wheel or fight beside their guards for a reward and a better name in the hold. Everyone sees who helped.":
      "Czasem wóz się psuje albo ktoś go napada. Napraw koło albo walcz obok strażników, a dostaniesz nagrodę i lepszą opinię w krainie. Wszyscy widzą, kto pomógł.",
    "Robbing wagons is a crime: a bounty, a fight with their guards and a worse name. You can't rob wagons another hero is guarding.":
      "Rabowanie wozów to przestępstwo: nagroda za głowę, walka ze strażnikami i gorsza opinia. Nie da się obrabować wozów, które eskortuje inny bohater.",
    "On a PC the wagons light up under the mouse. Zoomed out, tapping a group pin zooms in on it. In a party the leader decides.":
      "Na PC wozy podświetlają się pod myszką. Po oddaleniu dotknięcie pinezki z grupą przybliża mapę. W drużynie decyduje przywódca.",
    "Caravan Friend (Speech) now also makes caravans on the road sell to you 10% cheaper.":
      "Przyjaciel karawan (Mowa) daje teraz też 10% taniej u karawan spotkanych w drodze.",
    "In Polish, everything about caravans is now in Polish too: their names on the map, meetings on the road, the caravan board in town, your caravan job, your cart and the wares they sell.":
      "Po polsku wszystko, co dotyczy karawan, jest teraz też po polsku: ich nazwy na mapie, spotkania w drodze, tablica karawan w mieście, twoja praca przy karawanie, twój wóz i towary, które sprzedają.",
  };
  if (typeof I18N !== "undefined" && I18N.add) I18N.add(PL, PL);

  wrap();
  return { BREAK_P, BREAK_LEN, ATK_PRE, ATK_POST, FIX_MAX, SAVE_MAX, ROAD_CUT, BUY_MAX, HIT_PX, PL,
    seeded, frac, trouble, state, stateText, cargo, stock, price, buy, intercept, news, fixPay, savePay, canHelp, helpLabel, help, crisisEscort, guardedByOthers,
    chase, takeIntent, info, setShared, share, shared: () => shared, setSink: (f) => { sink = f; }, wrap,
    mount, tap, hover, decorate, clusterAt, wagonAt, open, close, render, isOpen: () => !!openId, hovered: () => hoverId };
})();
if (typeof module !== "undefined") module.exports = WAGONS;
