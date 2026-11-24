/* Carts and caravans. [OURS] numbers; Skyrim flavour (Ri'saad's Khajiit caravans, Nord merchant wagons).
   - A cart: buy one at a stables when you own a horse. While your horse is with you it carries +300, but you move 10%
     slower, can't leave the roads (no free roam) and bandits sometimes come for the cargo.
   - Caravans: wagons roll between the hold capitals on a fixed timetable worked out from real time, so every phone sees
     the same caravans. While a caravan waits in a city you can sign on as a guard (a per-player record in "guards").
     When it leaves, your trip follows the caravan's road at its pace; one or two ambushes come on the way, fought
     beside the other guards (and a couple of hired swords). Arrive with it and you claim your share of the pay, once.
     Die or run from an ambush and you've lost the job. */
const CARAVANS = (() => {
  // ---- the cart
  const CART_PRICE = 1500, CART_CARRY = 300, CART_SLOW = 0.9, WHEELS_PRICE = 500, CART_AMBUSH = 0.1;
  const hasCart = (s) => !!s.cart && !s.cart.parked && typeof HORSES !== "undefined" && HORSES.present(s);
  const cartCarry = (s) => (hasCart(s) ? CART_CARRY : 0);
  const cartSpeed = (s) => (hasCart(s) ? CART_SLOW : 1);
  function buyCart(s) {
    if (!s.location || !G.shopTypes(s.location).includes("stables")) return "Carts are sold at a stables.";
    if (!s.horse) return "You need a horse to pull a cart. Buy one first.";
    if (s.cart) return "You already own a cart.";
    if (s.gold < CART_PRICE) return `A cart costs ${CART_PRICE} gold. You have ${s.gold}.`;
    s.gold -= CART_PRICE; s.cart = { wheels: false, parked: null, t: G.now() };
    G.useSkill(s, "Mercantile", CART_PRICE / 2);
    return `The cart is yours. Hitched to ${s.horse.name}, it carries ${CART_CARRY} more, but you go a little slower and must keep to the roads.`;
  }
  function buyWheels(s) {
    if (!s.cart) return "You don't have a cart.";
    if (s.cart.wheels) return "Your cart already has iron-bound wheels.";
    if (!s.location || !G.shopTypes(s.location).includes("stables")) return "The stablehand can fit them at a stables.";
    if (s.gold < WHEELS_PRICE) return `Iron-bound wheels cost ${WHEELS_PRICE} gold.`;
    s.gold -= WHEELS_PRICE; s.cart.wheels = true;
    return "Iron-bound wheels: the cart runs smoother and bandits find it a harder target (half as many raids).";
  }
  function toggleCart(s) {   // leave it at these stables, or hitch it up again
    if (!s.cart) return "You don't have a cart.";
    if (s.cart.parked) {
      if (s.cart.parked !== s.location) return `Your cart is waiting at the stables in ${s.cart.parked}.`;
      if (!s.horse || (typeof HORSES !== "undefined" && HORSES.away(s))) return "You need your horse here to pull it.";
      s.cart.parked = null; return "You hitch the cart up again.";
    }
    if (!s.location || !G.shopTypes(s.location).includes("stables")) return "You can leave the cart at any stables.";
    s.cart.parked = s.location; return `You leave the cart at the stables in ${s.location}. It'll be safe here.`;
  }
  const roamBlocked = (s) => (hasCart(s) ? "Your cart can't leave the roads. Leave it at a stables to roam, or pick a named place." : null);
  /* bandits after the cargo (called from G.rollEncounter): a raw enemy, or null */
  function cartAmbush(s) {
    if (!hasCart(s) || Math.random() > CART_AMBUSH * (s.cart.wheels ? 0.5 : 1)) return null;
    return { name: "Cart raiders", danger: "medium", level: Math.max(4, s.level), tags: ["humanoid"], health: 70, damage: 12, gold: [30, 90], cart: true,
      text: "Three bandits step out of the trees and grab your horse's bridle. \"Nice cart. We'll take what's in it.\"" };
  }

  // ---- caravans: four lines looping between capitals, on a timetable everyone shares
  const EPOCH = 1795132800, STOP = 600, SPEED = 22;   // stop 10 real minutes in each city; px per real minute on open ground
  const LINES = [
    { id: "risaad", name: "Ri'saad's caravan", khajiit: true, stops: ["Whiterun", "Markarth", "Solitude"] },
    { id: "madran", name: "Ma'dran's caravan", khajiit: true, stops: ["Riften", "Windhelm", "Dawnstar"] },
    { id: "ahkari", name: "Ahkari's caravan", khajiit: true, stops: ["Dawnstar", "Winterhold", "Windhelm", "Whiterun"] },
    { id: "nord", name: "The Gray-Mane wagons", khajiit: false, stops: ["Solitude", "Morthal", "Whiterun", "Falkreath", "Riften"] },
  ];
  const routeCache = new Map();
  function leg(a, b) {
    const k = a + ">" + b; if (routeCache.has(k)) return routeCache.get(k);
    const A = WORLD.places[a].slice(0, 2), B = WORLD.places[b].slice(0, 2), path = Terrain.route(A, B);
    const secs = Terrain.secondsLeft(path, 0, A, SPEED / 60);
    const r = { a, b, A, B, path, secs: Math.max(120, Math.round(secs)) }; routeCache.set(k, r); return r;
  }
  function legsOf(line) { const st = line.stops.filter((n) => WORLD.places[n]); return st.map((a, i) => leg(a, st[(i + 1) % st.length])); }
  const cycleOf = (line) => legsOf(line).reduce((s, l) => s + STOP + l.secs, 0);
  /* where a line is at time t: {line, leg, idx, cycle, phase: "stop"|"road", depart, arrive, id} */
  function state(line, t = G.now()) {
    const legs = legsOf(line), cyc = cycleOf(line), n = Math.floor((t - EPOCH) / cyc), off = (t - EPOCH) - n * cyc;
    let acc = 0;
    for (let i = 0; i < legs.length; i++) {
      const L = legs[i], start = EPOCH + n * cyc + acc, depart = start + STOP, arrive = depart + L.secs;
      if (off < acc + STOP + L.secs) {
        const id = `${line.id}-${n}-${i}`;
        return { line, leg: L, idx: i, cycle: n, id, from: L.a, to: L.b, depart, arrive, phase: t < depart ? "stop" : "road" };
      }
      acc += STOP + L.secs;
    }
    return null;
  }
  function all(t = G.now()) { return LINES.map((l) => state(l, t)).filter(Boolean); }
  /* caravans standing in (or soon arriving at) a town */
  function at(town, t = G.now()) {
    const out = [];
    for (const c of all(t)) {
      if (c.phase === "stop" && c.from === town) out.push({ ...c, here: true });
      else if (c.phase === "road" && c.to === town && c.arrive - t < 1800) out.push({ ...c, here: false });
    }
    return out;
  }
  const stopsAt = (town) => LINES.some((l) => l.stops.includes(town));
  /* position on the map (for the map's wagon icons) */
  function pos(c, t = G.now()) {
    if (c.phase === "stop") return c.leg.A;
    const done = Math.min(c.leg.secs, Math.max(0, t - c.depart));
    return Terrain.moveAlong(c.leg.path, 0, c.leg.A, done, SPEED / 60).pos;
  }

  // ---- ambushes and pay, worked out from the caravan id so every guard sees the same road
  function seeded(id) { let a = 0; for (const ch of id) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; }
  function plan(c) {
    const r = seeded(c.id), n = r() < 0.45 ? 2 : 1;
    const at = n === 2 ? [0.3 + r() * 0.1, 0.65 + r() * 0.1] : [0.45 + r() * 0.15];
    const hold = G.holdAt(c.leg.B), reach = ["The Reach"].includes(hold) || ["The Reach"].includes(G.holdAt(c.leg.A));
    const foes = at.map(() => { const x = r(); return reach && x < 0.45 ? "forsworn" : x < 0.55 ? "bandits" : x < 0.8 ? "wolves" : "highwaymen"; });
    return { at, foes, pool: Math.round(180 + c.leg.secs / 4 + 110 * n) };
  }
  const FOES = {
    bandits: { name: "Caravan raiders", danger: "medium", tags: ["humanoid"], health: 85, damage: 13, gold: [20, 60], text: "Arrows thud into the lead wagon. Bandits pour down the slope, after the caravan's goods." },
    forsworn: { name: "Forsworn war party", danger: "medium", tags: ["humanoid", "forsworn"], health: 95, damage: 15, gold: [10, 40], text: "Painted Forsworn burst from the rocks with briarheart howls. The caravan master yells for the guards." },
    wolves: { name: "Wolf pack", danger: "medium", tags: ["beast"], health: 80, damage: 12, gold: [0, 0], text: "A pack of wolves circles the oxen, snarling. The animals panic." },
    highwaymen: { name: "Highwaymen", danger: "high", tags: ["humanoid", "elite"], health: 120, damage: 17, gold: [40, 110], text: "A gang of armoured highwaymen blocks the road. \"Hand over the wagons and nobody bleeds.\"" },
  };
  function job(s) { return s.caravanJob || null; }
  /* sign on: returns { id, doc, text } or { err } */
  function signOn(s, cid, t = G.now()) {
    const c = all(t).find((x) => x.id === cid);
    if (!c || c.phase !== "stop") return { err: "That caravan isn't taking guards right now." };
    if (s.location !== c.from) return { err: `Go to ${c.from} to sign on.` };
    if (s.caravanJob && s.caravanJob.id !== cid) return { err: "You're already guarding another caravan." };
    if (s.dungeon || s.trip) return { err: "Finish what you're doing first." };
    s.caravanJob = { id: cid, line: c.line.id, name: c.line.name, from: c.from, to: c.to, depart: c.depart, arrive: c.arrive, ambush: 0, status: "signed" };
    return { id: `${cid}-${s.id}`, doc: { caravanId: cid, uid: s.id, name: s.name, race: s.race, level: s.level, t, status: "signed" },
      text: `You sign on with ${c.line.name} to ${c.to}. Be at the wagons when they leave.` };
  }
  function leave(s) {
    const j = job(s); if (!j) return null;
    const started = s.trip?.caravan === j.id;
    s.caravanJob = null;
    if (started) { s.trip.caravan = null; s.trip.speed = null; }
    return started ? "You leave the caravan and go your own way. No pay." : `You tell the caravan master you won't be coming after all.`;
  }
  /* call every tick: starts your trip when the wagons roll; returns a message or null */
  function tick(s, t = G.now()) {
    const j = job(s); if (!j) return null;
    if (j.status === "signed" && t >= j.depart) {
      if (s.location !== j.from || s.trip || s.dungeon) { s.caravanJob = null; return `${j.name} left ${j.from} without you.`; }
      const L = leg(j.from, j.to);
      const err = G.startTrip(s, j.to, L.B, j.depart); if (err) { s.caravanJob = null; return err; }
      s.trip.path = L.path; s.trip.speed = SPEED; s.trip.caravan = j.id; s.trip.lastTick = j.depart; s.trip.total = L.secs / 60;
      j.status = "road";
      return `🐫 ${j.name} rolls out of ${j.from} with you guarding the wagons.`;
    }
    if (j.status === "road" && s.trip?.caravan !== j.id && s.location !== j.to) { s.caravanJob = null; return "You lost the caravan. No pay this time."; }
    return null;
  }
  /* engine hook: an ambush due on this caravan trip at time t (raw enemy), or null */
  function ambushDue(s, tr, t) {
    const j = job(s); if (!j || tr.caravan !== j.id) return null;
    const c = { id: j.id, leg: leg(j.from, j.to) }, p = plan(c);
    const frac = Math.min(1, Math.max(0, (t - j.depart) / c.leg.secs));
    if (j.ambush >= p.at.length || frac < p.at[j.ambush]) return null;
    const f = FOES[p.foes[j.ambush]]; j.ambush++;
    return { ...f, caravan: true, khajiit: !!LINES.find((l) => l.id === j.line)?.khajiit, level: Math.max(4, s.level), hold: G.holdAt([s.x, s.y]) };
  }
  function deserted(s) { const j = job(s); if (j && s.trip?.caravan === j.id) { s.caravanJob = null; s.trip.caravan = null; s.trip.speed = null; return "You ran. The caravan master won't pay deserters."; } return null; }
  /* your pay when you arrive, from how many guards signed on before the wagons left */
  function share(cid, guards, from, to) {
    const c = { id: cid, leg: leg(from, to) }, p = plan(c);
    const n = Math.max(1, guards.filter((g) => g.caravanId === cid && g.status !== "left").length);
    const pool = Math.round(p.pool * (1 + 0.5 * (n - 1)));   // more guards, bigger contract, smaller cut each
    return { pool, n, each: Math.floor(pool / n) };
  }
  /* after arriving: the pay to claim (the claim itself flips your guard record to "paid" once, via Store.change) */
  function arrived(s, guards) {
    const j = job(s); if (!j || j.escort || s.location !== j.to) return null;   // an escort picked up on the road is paid by caravanroad.js
    const sh = share(j.id, guards, j.from, j.to);
    return { recId: `${j.id}-${s.id}`, pay: sh.each, n: sh.n, name: j.name, to: j.to };
  }
  /* inside Store.change on your own record: returns the paid doc, or null if already claimed */
  function claim(doc, pay) { if (!doc || doc.status === "paid") return null; return { ...doc, status: "paid", pay }; }

  // ---- goods: a small rotating stock while the wagons stand in town (nothing illegal)
  const KHAJIIT_GOODS = ["gem_amethyst", "gem_garnet", "gem_ruby", "gem_flawless_amethyst", "silver_ring", "gold_ring", "silver_necklace", "soul_gem_common", "potion_health", "potion_magicka", "mat_moonstone", "ore_moonstone", "pelt_sabre"];
  const NORD_GOODS = ["mat_iron", "mat_steel", "mat_leather", "mat_strips", "ore_iron", "ore_corundum", "pelt_bear", "pelt_wolf", "potion_health_minor", "potion_stamina", "food_cabbage", "mat_firewood"];
  function stock(c) {
    const pool = (c.line.khajiit ? KHAJIIT_GOODS : NORD_GOODS).filter((i) => D.ITEMS[i] && (typeof SHOPCAP === "undefined" || SHOPCAP.ok(i))), r = seeded(c.id + "goods"), out = new Set();
    for (let i = 0; i < 12 && out.size < 5; i++) out.add(pool[Math.floor(r() * pool.length)]);
    return [...out];
  }
  const price = (s, item) => Math.max(1, Math.round(G.buyPrice(s, item) * 0.9));   // traders on the road sell a little cheaper
  function buy(s, cid, item, t = G.now()) {
    const c = all(t).find((x) => x.id === cid);
    if (!c || c.phase !== "stop" || s.location !== c.from) return "That caravan isn't here.";
    if (!stock(c).includes(item)) return "They don't sell that.";
    const p = price(s, item); if (s.gold < p) return `It costs ${p} gold.`;
    s.gold -= p; G.give(s, item, 1); G.useSkill(s, "Mercantile", p);
    return `You buy ${D.ITEMS[item].name} from ${c.line.name} for ${p} gold.`;
  }

  // ---- art: a wagon (cart or caravan), in the shared toolkit's two styles
  function drawWagon(g, H, w, h, o = {}) {
    const k = !!o.khajiit, ground = h * 0.82, cx = w / 2;
    g.fillStyle = "rgba(59,44,30,.25)"; g.beginPath(); g.ellipse(cx, ground + 3, w * 0.42, h * 0.06, 0, 0, 7); g.fill();
    // ox/horse in front
    if (o.animal !== false) {
      const ax = w * 0.78, ay = ground - h * 0.22;
      H.poly(g, [[ax - w * 0.1, ay], [ax + w * 0.06, ay - h * 0.04], [ax + w * 0.14, ay - h * 0.14], [ax + w * 0.19, ay - h * 0.1], [ax + w * 0.12, ay + h * 0.02], [ax + w * 0.1, ay + h * 0.12], [ax - w * 0.1, ay + h * 0.12]], o.coat || H.leather);
      g.strokeStyle = H.ink; g.lineWidth = 1.6; for (const lx of [ax - w * 0.08, ax - w * 0.02, ax + w * 0.04, ax + w * 0.09]) { g.beginPath(); g.moveTo(lx, ay + h * 0.1); g.lineTo(lx, ground); g.stroke(); }
      g.beginPath(); g.moveTo(ax - w * 0.1, ay + h * 0.04); g.lineTo(cx + w * 0.16, ground - h * 0.18); g.stroke();
    }
    // bed and cover
    const bx = cx - w * 0.36, bw = w * 0.5, by = ground - h * 0.34;
    H.poly(g, [[bx, by], [bx + bw, by], [bx + bw - w * 0.02, by + h * 0.16], [bx + w * 0.02, by + h * 0.16]], H.wood);
    g.strokeStyle = H.inkSoft; g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(bx + (bw * i) / 4, by + 2); g.lineTo(bx + (bw * i) / 4, by + h * 0.15); g.stroke(); }
    if (o.cover !== false) {
      const col = k ? ["#b5452c", "#d6b25e"] : ["#d8cbb0", "#a68c62"];
      g.beginPath(); g.moveTo(bx + 2, by); g.quadraticCurveTo(bx + bw / 2, by - h * 0.42, bx + bw - 2, by); g.closePath(); g.fillStyle = col[0]; g.fill(); g.strokeStyle = H.ink; g.lineWidth = 1.4; g.stroke();
      g.strokeStyle = col[1]; g.lineWidth = 2; for (const f of [0.3, 0.5, 0.7]) { g.beginPath(); g.moveTo(bx + bw * f, by - 1); g.lineTo(bx + bw * f, by - h * 0.3 * (1 - Math.abs(f - 0.5))); g.stroke(); }
    } else {   // an open cart: sacks and a barrel
      H.circle(g, bx + bw * 0.3, by - h * 0.04, h * 0.08, "#c9b07a"); H.circle(g, bx + bw * 0.55, by - h * 0.05, h * 0.09, "#b89a63");
      H.poly(g, [[bx + bw * 0.72, by], [bx + bw * 0.72, by - h * 0.14], [bx + bw * 0.9, by - h * 0.14], [bx + bw * 0.9, by]], H.wood);
    }
    for (const wx of [bx + w * 0.1, bx + bw - w * 0.1]) {
      H.circle(g, wx, ground - h * 0.12, h * 0.12, H.wood, H.ink, 1.6);
      g.strokeStyle = o.wheels ? H.iron : H.inkSoft; g.lineWidth = o.wheels ? 2.4 : 1;
      g.beginPath(); g.arc(wx, ground - h * 0.12, h * 0.12, 0, 7); g.stroke(); g.strokeStyle = H.inkSoft; g.lineWidth = 1;
      for (let a = 0; a < 6; a++) { g.beginPath(); g.moveTo(wx, ground - h * 0.12); g.lineTo(wx + Math.cos(a) * h * 0.11, ground - h * 0.12 + Math.sin(a) * h * 0.11); g.stroke(); }
    }
    if (k) { g.fillStyle = "#d6b25e"; g.beginPath(); g.moveTo(bx + bw - 4, by - h * 0.05); g.lineTo(bx + bw - 4, by - h * 0.32); g.lineTo(bx + bw + 8, by - h * 0.27); g.lineTo(bx + bw - 4, by - h * 0.22); g.fill(); g.strokeStyle = H.ink; g.stroke(); }
  }
  const wagonHTML = (w, h, o = {}) => (typeof ART !== "undefined" ? ART.html(w, h, (g, H) => drawWagon(g, H, w, h, o), { key: `wagon|${o.khajiit ? 1 : 0}|${o.cover === false ? 0 : 1}|${o.wheels ? 1 : 0}|${o.coat || ""}`, cls: "wagon", alt: "Wagon" }) : "");
  const sprites = new Map();
  /* a small canvas for the map (cached per style) */
  function sprite(khajiit, cover = true) {
    const st = typeof ART !== "undefined" ? ART.style() : "ink", k = `${khajiit}|${cover}|${st}`;
    if (!sprites.has(k) && typeof ART !== "undefined") sprites.set(k, ART.canvas(34, 24, (g, H) => drawWagon(g, H, 34, 24, { khajiit, cover, animal: cover }), { block: 2 }));
    return sprites.get(k) || null;
  }

  return { CART_PRICE, CART_CARRY, CART_SLOW, WHEELS_PRICE, LINES, STOP, SPEED, hasCart, cartCarry, cartSpeed, buyCart, buyWheels, toggleCart, roamBlocked, cartAmbush,
    all, at, state, stopsAt, pos, plan, job, signOn, leave, tick, ambushDue, deserted, share, arrived, claim, stock, price, buy, leg, drawWagon, wagonHTML, sprite, FOES };
})();
