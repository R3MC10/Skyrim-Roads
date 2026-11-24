/* Meeting caravans on the road. [OURS] numbers.
   The four caravans (caravans.js) roll between the hold capitals on a shared timetable. While you travel you can
   tap one on the map (when you're close enough), or your road simply brings you up beside one and you get asked
   whether to stop. Meeting pauses your trip, like any road event; when you're done, your trip carries on.
   What you can do with them:
   - Trade: the caravan's merchant opens their packs (Khajiit gems and trinkets, Nord iron and pelts), with the
     road event's buy list. Every caravan run carries a different mix.
   - News: travellers hear things. A free rumour about a place near where they're headed goes on your map
     (rumours.js leads), or at least the name of somewhere you didn't know.
   - Guard the wagons: walk the rest of the way to their stop beside them, at their pace, for pay on arrival.
     Ambushes on the way come from the caravan's own schedule (fought like any other caravan ambush).
   - Walk with them: stay near the wagons for a while and bandits leave you alone far more often.
   - Rob them: a fight with the caravan guards and a bounty in the hold, but gold and goods if you win.
   In a party only the leader stops and chooses; the others see what happens (partyplay.js).
   Perk: Caravan Friend (Speechcraft) also pays 25% more for guarding a caravan you meet on the road. */
const CVROAD = (() => {
  const TAP_RANGE = 45, MEET_RANGE = 28, NEAR = 60;    // map px: tap to hail, the road brings you alongside, "near the wagons"
  const MET_GAP = 1800, SAFE_SECS = 600, SAFE_MULT = 0.35, ESCORT_RATE = 0.7, ESCORT_MIN = 30, MIN_LEFT = 0.12;
  const now = () => G.now();
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const st = (s) => { s.cvRoad = s.cvRoad || {}; s.cvRoad.met = s.cvRoad.met || {}; return s.cvRoad; };
  const pfx = (s, k) => ((typeof PFX !== "undefined") ? PFX.num(s, k) : 0);

  /* caravans on the road (not standing in a town) with their map position and distance from `pos`, nearest first */
  function near(pos, t = now(), range = TAP_RANGE) {
    return CARAVANS.all(t).filter((c) => c.phase === "road").map((c) => { const p = CARAVANS.pos(c, t); return { c, pos: p, d: G.pxDist(p, pos) }; })
      .filter((x) => x.d <= range).sort((a, b) => a.d - b.d);
  }
  const find = (cid, t = now()) => CARAVANS.all(t).find((c) => c.id === cid) || null;
  /* you can stop for a caravan: walking or riding on your own trip (not a carriage, boat, or already guarding one) */
  const canMeet = (s) => !!s.trip && s.trip.status === "travel" && !s.trip.carriage && !s.trip.boat && !s.trip.caravan && !s.dungeon;
  /* how far along its road a caravan is (0..1) */
  const frac = (c, t = now()) => Math.min(1, Math.max(0, (t - c.depart) / c.leg.secs));
  /* the pay for guarding a caravan from here to its stop */
  function escortPay(s, c, t = now()) {
    const left = 1 - frac(c, t);
    return Math.max(ESCORT_MIN, Math.round(CARAVANS.plan(c).pool * left * ESCORT_RATE * (1 + Math.min(0.5, pfx(s, "cvpay")))));
  }

  /* the road brings you up beside a caravan you haven't met in a while: that caravan, or null */
  function autoMeet(s, pos, t = now()) {
    if (!canMeet(s)) return null;
    const m = st(s).met;
    for (const k of Object.keys(m)) if (t - m[k] > MET_GAP * 4) delete m[k];
    const x = near(pos, t, MEET_RANGE).find((n) => !(m[n.c.id] && t - m[n.c.id] < MET_GAP));
    return x ? x.c : null;
  }
  /* stop the trip and meet a caravan: the event, or { err } */
  function meet(s, cid, pos, t = now(), range = TAP_RANGE) {
    const c = find(cid, t);
    if (!c) return { err: "That caravan has moved on." };
    if (c.phase !== "road") return { err: `${c.line.name} is resting in ${c.from}. Find them there (Area tab).` };
    if (!canMeet(s)) return { err: s.trip?.caravan ? "You're already guarding a caravan." : `${c.line.name}, rolling toward ${c.to}. Meet them while you travel.` };
    const d = G.pxDist(CARAVANS.pos(c, t), pos);
    if (d > range) return { err: `${c.line.name} is too far off to hail. Get a little closer.` };
    const robbed = st(s).robbed?.[c.id];
    st(s).met[c.id] = t;
    [s.x, s.y] = pos;
    const tr = s.trip; tr.status = "event"; tr.event = make(s, c, t, robbed); tr.lastTick = t;
    return tr.event;
  }
  function make(s, c, t, robbed) {
    const k = !!c.line.khajiit, stock = [...new Set([...CARAVANS.stock(c), "potion_health_minor"])].filter((i) => D.ITEMS[i]);
    const text = robbed ? `${c.line.name} again. The guards recognise you and draw steel before you get close. "Not one step nearer, thief."`
      : k ? `${c.line.name} creaks along the road toward ${c.to}, striped canvas and bells on the harness. A Khajiit guard with a curved sword watches you come. "Walk in the warm sands, friend. You are buying, yes?"`
        : `${c.line.name} rumble along the road toward ${c.to}, a couple of sellswords up front. The wagon master raises a hand. "Well met, traveller. Need anything before we push on?"`;
    return { id: k ? "cvmeet_k" : "cvmeet_n", title: k ? "A Khajiit caravan" : "Merchant wagons", cid: c.id, name: c.line.name, khajiit: k, from: c.from, to: c.to, stock, text, robbed: !!robbed, heard: false, joined: false };
  }
  const isMeet = (e) => !!e && /^cvmeet_/.test(e.id || "");

  function choices(e, s) {
    if (e.robbed) return [["rob", " Fight the guards"], ["leave", "Back off"]];
    const c = find(e.cid), out = [["trade", "Trade with the merchant"]];
    if (!e.heard) out.push(["news", "Ask for news from the road"]);
    if (c && c.phase === "road" && !s.caravanJob && 1 - frac(c) > MIN_LEFT) out.push(["escort", `Guard the wagons to ${e.to} (${escortPay(s, c)} gold)`]);
    if (!e.joined && c && c.phase === "road") out.push(["join", "Walk with them a while (safer road)"]);
    out.push(["rob", " Rob the wagons"], ["leave", "Wave and move on"]);
    return out;
  }
  function choose(s, e, choice, t = now()) {
    if (choice === "leave") return { text: e.robbed ? "You back away from the wagons." : `You wave ${e.name} on and carry on your way.` };
    const c = find(e.cid, t);
    if (choice === "trade") {
      const sk = G.useSkill(s, "Speechcraft", 2);
      return { text: e.khajiit ? "The caravan's trader throws back a flap of canvas. \"Khajiit has wares, if you have coin.\"" : "The wagon master drops the tailboard and shows you what they're hauling.", shop: e.stock, keep: true, skills: sk };
    }
    if (choice === "news") {
      e.heard = true;
      const town = e.to;
      const r = (typeof RUMOURS !== "undefined") && RUMOURS.roadLead ? RUMOURS.roadLead(s, town, t) : { err: true };
      if (!r.err) return { text: `"Heard this in the last town: ${r.say}" ${r.lead.place} is marked on your map.`, keep: true, skills: G.useSkill(s, "Speechcraft", 6) };
      const spot = unknownNear(s, WORLD.places[town] || [s.x, s.y]);
      if (spot) { s.discovered.push(spot); return { text: `"Road's quiet. Though there's a place off the road near ${town} you might not know: ${spot}." It's marked on your map now.`, keep: true }; }
      return { text: `"Quiet roads, thank the Eight. Nothing worth telling."`, keep: true };
    }
    if (choice === "escort") {
      if (!c || c.phase !== "road") return { text: "The wagons have already rolled on." };
      if (s.caravanJob) return { text: "You're already guarding another caravan.", keep: true };
      return escort(s, c, t);
    }
    if (choice === "join") {
      if (!c || c.phase !== "road") return { text: "The wagons have already rolled on." };
      e.joined = true;
      st(s).safe = { cid: c.id, until: Math.min(c.arrive, t + SAFE_SECS) };
      return { text: `You fall in beside ${e.name} for a while. Bandits think twice about a road this busy, as long as you stay close to the wagons.` };
    }
    if (choice === "rob") return rob(s, e, c, t);
    return { text: "" };
  }
  /* somewhere you haven't found yet, not far from a point */
  function unknownNear(s, p) {
    const known = new Set(s.discovered);
    const list = Object.entries(WORLD.places).filter(([n, q]) => !known.has(n) && !["city", "town"].includes(q[2]) && WORLD.same(p, q) && !(WORLD.hidden?.has(n)))
      .map(([n, q]) => ({ n, d: G.pxDist(p, q) })).filter((x) => x.d < 200).sort((a, b) => a.d - b.d);
    return list.length ? list[Math.floor(Math.random() * Math.min(4, list.length))].n : null;
  }
  /* take the rest of the road with the caravan: your trip follows its path at its pace, to its stop */
  function escort(s, c, t = now()) {
    const L = c.leg, done = Math.min(L.secs, Math.max(0, t - c.depart));
    const mv = Terrain.moveAlong(L.path, 0, L.A, done, CARAVANS.SPEED / 60);
    const p = CARAVANS.plan(c), f = frac(c, t), pay = escortPay(s, c, t);
    s.caravanJob = { id: c.id, line: c.line.id, name: c.line.name, from: c.from, to: c.to, depart: c.depart, arrive: c.arrive, ambush: p.at.filter((a) => a <= f).length, status: "road", escort: true, pay };
    const tr = s.trip;
    [s.x, s.y] = mv.pos;
    tr.path = L.path; tr.idx = mv.idx; tr.dest = L.B; tr.destName = c.to; tr.roam = false;
    tr.speed = CARAVANS.SPEED; tr.caravan = c.id; tr.total = (L.secs - done) / 60;
    st(s).safe = null;
    return { text: `The wagon master looks you over and nods. "${pay} gold when we roll into ${c.to}. Keep your eyes on the trees."` };
  }
  /* rob the caravan: a fight with its guards, a bounty in this hold whatever happens */
  function rob(s, e, c, t = now()) {
    const hold = G.holdAt([s.x, s.y]);
    st(s).robbed = st(s).robbed || {}; st(s).robbed[e.cid] = t;
    for (const k of Object.keys(st(s).robbed)) if (t - st(s).robbed[k] > 86400) delete st(s).robbed[k];
    if ((typeof TOWNS !== "undefined") && TOWNS.addBounty && hold && hold !== "Solstheim") TOWNS.addBounty(s, hold, "assault", 160);
    const foe = { name: e.khajiit ? "Khajiit caravan guards" : "Caravan sellswords", danger: "high", tags: ["humanoid", "elite"], health: 130, damage: 17, gold: [20, 60],
      caravan: true, khajiit: e.khajiit, level: Math.max(6, s.level), text: e.khajiit ? "The Khajiit guards draw their blades as one." : "The sellswords pull steel and spread out around the wagons." };
    const stock = e.stock.slice();
    const afterFn = (ss) => {
      const g = rint(80, 160) + 5 * (ss.level || 1); ss.gold += g;
      const got = [];
      for (let i = 0; i < 2 && stock.length; i++) { const it = stock.splice(Math.floor(Math.random() * stock.length), 1)[0]; G.give(ss, it); got.push(D.ITEMS[it].name); }
      return `You help yourself from the wagons: ${g} gold${got.length ? ", " + got.join(", ") : ""}. Word of this will reach the guards in ${hold}.`;
    };
    return { text: e.robbed ? "" : `You draw your weapon. ${hold ? `This will cost you a bounty in ${hold}.` : ""}`.trim(), foe, afterFn };
  }

  /* engine hook: road ambushes are rarer while you keep near the wagons you joined */
  function ambushMult(s, t = now()) {
    const sf = s.cvRoad?.safe; if (!sf) return 1;
    if (t > sf.until) { s.cvRoad.safe = null; return 1; }
    const c = find(sf.cid, t); if (!c || c.phase !== "road") return 1;
    return G.pxDist(CARAVANS.pos(c, t), [s.x, s.y]) <= NEAR ? SAFE_MULT : 1;
  }
  /* on arrival: pay for an escort you picked up on the road. A message, or null */
  function arrived(s) {
    const j = s.caravanJob; if (!j || !j.escort || s.location !== j.to) return null;
    s.caravanJob = null; s.gold += j.pay;
    s.caravanDone = true;   // the bards sing about it (bards.js)
    return `${j.name} rolls safely into ${j.to}. The wagon master counts ${j.pay} gold into your hand.${j.ambush ? " \"Glad you were with us out there.\"" : ""}`;
  }
  /* a map tap: which caravan icon is under the finger (view caravans carry id + pos) */
  function hit(list, w, W, H, r) {
    let best = null, bd = r;
    for (const c of list || []) { if (!c.visible || !c.moving || !c.id) continue; const d = Math.hypot((c.pos[0] - w[0]) * W, (c.pos[1] - w[1]) * H); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  // picture for the meeting (both art styles: drawn with the shared toolkit)
  function art() {
    if (!(typeof EVENTART !== "undefined") || !EVENTART.ROAD || EVENTART.ROAD.cvmeet_k) return;
    const draw = (khajiit) => (g, H, w, h) => {
      g.save(); g.translate(w * 0.04, h * 0.56); CARAVANS.drawWagon(g, H, w * 0.3, h * 0.3, { khajiit, cover: true, animal: true }); g.restore();   // the second wagon, further back
      g.save(); g.translate(w * 0.3, h * 0.46); CARAVANS.drawWagon(g, H, w * 0.52, h * 0.52, { khajiit, cover: true, animal: true }); g.restore();
    };
    EVENTART.ROAD.cvmeet_k = draw(true); EVENTART.ROAD.cvmeet_n = draw(false);
  }
  // road events: the meeting rides on the event screen (events.js / encounters.js), so the trip pauses and resumes the same way
  function wrap() {
    if (!(typeof ROAD_EVENTS !== "undefined") || ROAD_EVENTS.__cv) return;
    const base = { choices: ROAD_EVENTS.choices, choose: ROAD_EVENTS.choose };
    ROAD_EVENTS.choices = (e, s) => (isMeet(e) ? choices(e, s) : base.choices(e, s));
    ROAD_EVENTS.choose = (s, e, c) => (isMeet(e) ? choose(s, e, c) : base.choose(s, e, c));
    ROAD_EVENTS.__cv = true;
  }
  wrap(); art();

  return { TAP_RANGE, MEET_RANGE, NEAR, MET_GAP, SAFE_MULT, ESCORT_RATE, near, canMeet, frac, escortPay, autoMeet, meet, make, isMeet, choices, choose, escort, ambushMult, arrived, hit, art };
})();
