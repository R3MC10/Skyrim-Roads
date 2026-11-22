/* World events that every player shares, on a timetable worked out from the real clock (so every phone agrees
   without a server). [OURS]
   - Daedric invasion: three Oblivion gates tear open in one hold for 2 real hours. Everyone fights Daedra at the
     gates; each gate closes when enough of them are beaten. Shared progress bar per gate. Reward: gold per gate
     you helped close, and a sigil stone + the title Gatecloser when all three close.
   - Dragon migration: for one real day, a flight of dragons circles one hold. Hunt them there: every dragon you
     bring down gives an extra soul and a dragon bone. When the whole world downs enough, everyone who hunted gets
     a reward and the title Dragonwatcher.
   - Festival week: one week in four, one of Tamriel's old holidays (Heart's Day, the Merchants' Festival,
     Harvest's End, Second Planting). Three small contests a day in any town; points add up to a reward and the
     title Festival Favourite, and the whole North's cheer adds a bonus.
   - The Khajiit's grand caravan: a travelling market that stops in one town for 4 hours, selling rare things.
     Buy 5 things over time and you're a Friend of the Caravan.
   Shared progress uses the world-sync collection "wevents": each player writes only their own record
   (id eventId-playerId), so totals are sums and nobody overwrites anybody (like dragon raids and the bounty board). */
const WORLDEV = (() => {
  const HOUR = 3600, DAY = 86400, WEEK = 7 * DAY, MONDAY0 = Date.UTC(2026, 0, 5) / 1000;   // weeks start Monday 00:00 UTC, like the bounty board
  const nowS = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const hash = (str) => { let x = 2166136261; for (const c of String(str)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const seeded = (seed) => { let a = Math.floor(hash(seed) * 4294967296) | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (list, seed) => { const r = seeded(seed), a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pfx = (s, key) => (typeof PFX !== "undefined" && s ? PFX.num(s, key) : 0);

  const HOLDS = ["Haafingar", "Hjaalmarch", "The Pale", "Winterhold", "Eastmarch", "Whiterun", "The Reach", "Falkreath", "The Rift"];
  const CAPITAL = { Haafingar: "Solitude", Hjaalmarch: "Morthal", "The Pale": "Dawnstar", Winterhold: "Winterhold", Eastmarch: "Windhelm", Whiterun: "Whiterun", "The Reach": "Markarth", Falkreath: "Falkreath", "The Rift": "Riften" };
  const MARKET_TOWNS = ["Whiterun", "Solitude", "Windhelm", "Markarth", "Riften", "Falkreath", "Dawnstar", "Morthal", "Riverwood", "Rorikstead"];

  // ---------------------------------------------------------------- the timetable
  const INV_BLOCK = 8 * HOUR, INV_LEN = 2 * HOUR;      // one invasion in every 8 hours, 2 hours long
  const MIG_BLOCK = 4;                                 // one migration day in every 4 days
  const FEST_BLOCK = 4;                                // one festival week in every 4 weeks
  const KC_BLOCK = 6 * HOUR, KC_LEN = 4 * HOUR;        // the grand caravan: 4 hours in a town, every 6 hours
  const SITE_KINDS = ["town", "farm", "fort", "stone", "shrine", "landmark", "camp"];
  const siteCache = {};
  function sitesIn(hold) {
    if (siteCache[hold]) return siteCache[hold];
    const out = Object.keys(WORLD.places).filter((n) => { const p = WORLD.places[n]; return SITE_KINDS.includes(p[2]) && !(WORLD.isSol && WORLD.isSol(p)) && G.holdAt(p) === hold; }).sort();
    return (siteCache[hold] = out);
  }
  /* three gate sites in a hold, spread apart when the hold allows it */
  function gateSites(hold, seed) {
    const list = shuffle(sitesIn(hold), seed), pick = [];
    for (const minD of [0.08, 0.05, 0]) for (const n of list) { if (pick.length >= 3) break; if (pick.includes(n)) continue; if (pick.every((m) => Math.hypot(WORLD.places[m][0] - WORLD.places[n][0], WORLD.places[m][1] - WORLD.places[n][1]) >= minD)) pick.push(n); }
    while (pick.length < 3) pick.push(CAPITAL[hold]);
    return pick;
  }
  function invasionIn(b) {
    const start = b * INV_BLOCK + Math.floor(hash("wev-inv:" + b) * (INV_BLOCK - INV_LEN));
    const hold = HOLDS[Math.floor(hash("wev-invh:" + b) * HOLDS.length)];
    return { kind: "inv", id: "inv-" + b, hold, sites: gateSites(hold, "gates:" + b), start, end: start + INV_LEN, name: `Daedric invasion in ${hold}`, icon: "🔥" };
  }
  function migrationIn(b) {
    const day = b * MIG_BLOCK + Math.floor(hash("wev-mig:" + b) * MIG_BLOCK);
    const hold = HOLDS[Math.floor(hash("wev-migh:" + b) * HOLDS.length)];
    return { kind: "mig", id: "mig-" + b, hold, count: 3 + Math.floor(hash("wev-migc:" + b) * 2), start: day * DAY, end: (day + 1) * DAY, name: `Dragon migration over ${hold}`, icon: "🐉" };
  }
  const FESTS = [
    { id: "hearts", name: "Heart's Day", icon: "💌", text: "Lovers' songs, pressed flowers and free mead. Towns are full of music all week.",
      games: [["poem", "Recite a poem at the inn", "Speechcraft"], ["dance", "Dance in the square", "Acrobatics"], ["gift", "Haggle for the perfect gift", "Mercantile"]], gift: ["gem_amethyst", 1] },
    { id: "merchants", name: "The Merchants' Festival", icon: "⚖️", text: "Every trader in the North sets out a stall. Contests of wit and muscle in every market.",
      games: [["haggle", "Haggling contest", "Mercantile"], ["arm", "Arm wrestling", "Two-Handed"], ["cups", "Find the coin under the cups", "Pickpocket"]], gift: ["gem_sapphire", 1] },
    { id: "harvest", name: "Harvest's End", icon: "🌾", text: "The fields are in. Feasts, archery at straw targets and fist fights behind the inn.",
      games: [["archery", "Archery contest", "Archery"], ["brawl", "Fist fight behind the inn", "Hand-to-Hand"], ["feast", "Help cook the feast", "Alchemy"]], gift: ["mat_moonstone", 2] },
    { id: "planting", name: "Second Planting", icon: "🌱", text: "Spring sowing and making up old quarrels. Foot races, songs and planting the new fields.",
      games: [["plant", "Plant the new fields", "Alchemy"], ["race", "Foot race round the walls", "Athletics"], ["songs", "Lead the songs", "Speechcraft"]], gift: ["ing_nirnroot", 3] },
  ];
  const weekOf = (t) => Math.floor((t - MONDAY0) / WEEK);
  function festivalIn(b) {
    const w = b * FEST_BLOCK + Math.floor(hash("wev-fw:" + b) * FEST_BLOCK);
    const v = FESTS[(((b % FESTS.length) + FESTS.length) + Math.floor(hash("wev-fwv:" + b) * 2)) % FESTS.length];   // the holidays take turns
    const start = MONDAY0 + w * WEEK;
    return { kind: "fest", id: "fest-" + b, variant: v.id, v, start, end: start + WEEK, name: `${v.name} festival week`, icon: v.icon };
  }
  function caravanIn(b) {
    const start = b * KC_BLOCK + Math.floor(hash("wev-kc:" + b) * (KC_BLOCK - KC_LEN));
    const town = MARKET_TOWNS[Math.floor(hash("wev-kct:" + b) * MARKET_TOWNS.length)];
    return { kind: "kc", id: "kc-" + b, town, start, end: start + KC_LEN, name: `The Khajiit's grand caravan in ${town}`, icon: "🐪" };
  }
  const KINDS = {
    inv: { at: (t) => Math.floor(t / INV_BLOCK), make: invasionIn },
    mig: { at: (t) => Math.floor(Math.floor(t / DAY) / MIG_BLOCK), make: migrationIn },
    fest: { at: (t) => Math.floor(weekOf(t) / FEST_BLOCK), make: festivalIn },
    kc: { at: (t) => Math.floor(t / KC_BLOCK), make: caravanIn },
  };
  const ORDER = ["inv", "mig", "kc", "fest"];
  /* every event running at time t (seconds), in a fixed order */
  function active(t = nowS()) {
    const out = [];
    for (const k of ORDER) { const K = KINDS[k], b = K.at(t); for (const x of [b, b - 1]) { const ev = K.make(x); if (t >= ev.start && t < ev.end) { out.push(ev); break; } } }
    return out;
  }
  /* the next start of each kind after t */
  function upcoming(t = nowS()) {
    const out = [];
    for (const k of ORDER) { const K = KINDS[k], b = K.at(t); for (let x = b; x <= b + 3; x++) { const ev = K.make(x); if (ev.start > t) { out.push(ev); break; } } }
    return out.sort((a, b) => a.start - b.start);
  }
  /* events that ended in the last day (rewards can still be claimed) */
  function recent(t = nowS()) {
    const out = [];
    for (const k of ORDER) { const K = KINDS[k], b = K.at(t); for (let x = b - 3; x <= b; x++) { const ev = K.make(x); if (ev.end <= t && ev.end > t - DAY) out.push(ev); } }
    return out;
  }
  function byId(id) {
    const m = /^(inv|mig|fest|kc)-(-?\d+)$/.exec(String(id || "")); if (!m) return null;
    return KINDS[m[1]].make(+m[2]);
  }

  // ---------------------------------------------------------------- shared records
  let raw = [], docs = [], ver = 0;
  function setDocs(list) {
    if (list) raw = list;
    docs = raw.filter((d) => d && typeof d.ev === "string" && d.uid && typeof d.uid === "string");
    ver++;
  }
  function mine(s, ev) {
    s.wev = s.wev || {};
    if (!s.wev[ev.id]) s.wev[ev.id] = { end: ev.end };
    return s.wev[ev.id];
  }
  const capN = (v, max) => (Number.isFinite(+v) ? Math.max(0, Math.min(max, +v)) : 0);
  /* this player's public record for an event */
  function record(s, ev) {
    const m = mine(s, ev), d = { ev: ev.id, uid: s.id, name: s.name, t: nowS() };
    if (ev.kind === "inv") { d.g = (m.g || [0, 0, 0]).map(Math.round); d.c = m.c || [0, 0, 0]; }
    if (ev.kind === "mig") d.n = m.n || 0;
    if (ev.kind === "fest") d.f = m.f || 0;
    if (ev.kind === "kc") d.b = m.b || 0;
    return d;
  }
  /* everyone's records for an event, with this player's own numbers (newer than the feed) */
  function rows(ev, s) {
    const out = docs.filter((d) => d.ev === ev.id && (!s || d.uid !== s.id));
    if (s && s.wev && s.wev[ev.id]) out.push({ ...record(s, ev), me: true });
    return out;
  }

  // ---------------------------------------------------------------- Daedric invasion
  const GATE_NEED = 30, GATE_PER = 20, WIN_PTS = 10, LOSS_PTS = 3;   // points to close one gate (solo: 3 wins a gate)
  const DAEDRA = [   // about as tough as the road's vampires and trolls at their level ([OURS], see tests/test_worldevents.js)
    { name: "Scamp", level: 4, health: 50, damage: 9, tags: ["daedra"], danger: "low", gold: [5, 20] },
    { name: "Flame atronach", level: 10, health: 80, damage: 13, tags: ["daedra"], danger: "medium", gold: [10, 30] },
    { name: "Dremora", level: 14, health: 105, damage: 15, tags: ["daedra", "humanoid"], danger: "medium", gold: [20, 50] },
    { name: "Frost atronach", level: 20, health: 115, damage: 15, tags: ["daedra", "big"], danger: "high", gold: [20, 60] },
    { name: "Storm atronach", level: 24, health: 120, damage: 17, tags: ["daedra"], danger: "high", gold: [30, 70] },
    { name: "Dremora Valkynaz", level: 30, health: 150, damage: 20, tags: ["daedra", "humanoid", "elite"], danger: "high", gold: [50, 120] },
  ];
  function gates(ev, s) {
    const rs = rows(ev, s).filter((d) => Array.isArray(d.g));
    const people = rs.filter((d) => d.g.some((x) => +x > 0)).length;
    const need = GATE_NEED + GATE_PER * Math.max(0, people - 1);
    const list = ev.sites.map((site, i) => {
      const total = Math.round(rs.reduce((a, d) => a + capN(d.g[i], 400), 0));
      return { site, i, total, need, closed: total >= need || rs.some((d) => Array.isArray(d.c) && d.c[i]) };
    });
    return { list, people, need, closed: list.filter((g) => g.closed).length, names: rs.filter((d) => !d.me).map((d) => d.name) };
  }
  /* the Daedra waiting at a gate: something near your level */
  function daedraFor(s, i, t) {
    const lv = G.fightLevel(s);
    const pool = DAEDRA.filter((d) => d.level <= lv + 4);
    const list = pool.length ? pool.slice(-3) : [DAEDRA[0]];
    const base = list[Math.floor(Math.random() * list.length)];
    const e = G.scaleEnemy({ ...base, tags: [...base.tags], text: "" }, lv);
    e.hold = G.holdAt(WORLD.places[s.location] || [s.x, s.y]);
    return e;
  }
  const hurt = (s, t) => G.curHealth(s, t) < G.maxHealth(s) * 0.3;
  /* one fight at the gate where you stand. Returns {text, fight?, skills, died?, bag?, loot, gold, closedNow} */
  function fightGate(s, t = nowS()) {
    const ev = active(t).find((e) => e.kind === "inv");
    if (!ev) return { text: "The gates have closed. The invasion is over." };
    const i = ev.sites.indexOf(s.location);
    if (i < 0) return { text: `There's no gate here. They're at ${ev.sites.join(", ")}.` };
    if (s.trip?.status) return { text: "Finish your trip first." };
    const before = gates(ev, s).list[i];
    if (before.closed) return { text: `The gate at ${ev.sites[i]} is already closed. Help at another one.` };
    if (hurt(s, t)) return { text: "You're too badly hurt to face the Daedra. Heal up first (rest, a potion or a spell)." };
    const e = daedraFor(s, i, t);
    const f = new G.Fight(s, e, null, t);
    f.run({ t, maxTurns: 30 });
    const skills = f.apply(t);
    const m = mine(s, ev); m.g = m.g || [0, 0, 0]; m.c = m.c || [0, 0, 0];
    const pts = f.won ? Math.round(WIN_PTS * (1 + pfx(s, "wevgate"))) : LOSS_PTS;
    m.g[i] += pts;
    const out = { fight: f, skills, loot: [], gold: 0, pts, ev, i };
    if (f.won) { out.gold = rint(...e.gold); s.gold += out.gold; out.loot = G.rollLoot(s, e); }
    const after = gates(ev, s).list[i];
    if (!before.closed && after.closed) { m.c[i] = 1; out.closedNow = true; }
    if (f.hp <= 0) { const d = G.die(s, "daedra", t); out.died = d.msg; out.bag = d.bag; }
    out.text = f.won
      ? `The ${e.name} falls back into the fire. The gate at ${ev.sites[i]} weakens (+${pts}).` + (out.closedNow ? ` With a roar of flame the gate collapses: ${ev.sites[i]} is safe!` : "")
      : out.died ? `The ${e.name} drags you down. The gate still burns.` : `You hold the ${e.name} off but it slips back through the gate (+${pts}).`;
    return out;
  }
  function claimInv(s, ev, t) {
    const m = mine(s, ev), st = gates(ev, s);
    if (m.claimed) return null;
    const myPts = (m.g || []).reduce((a, x) => a + x, 0);
    if (!myPts) return null;
    if (st.closed < 3 && t < ev.end) return null;   // still going: wait until all three are shut or time runs out
    m.claimed = true;
    const helped = st.list.filter((g) => g.closed && (m.g[g.i] || 0) > 0).length;
    const gold = 150 * helped; s.gold += gold;
    const parts = [];
    if (gold) parts.push(`${gold} gold`);
    if (st.closed === 3 && myPts >= WIN_PTS) { G.give(s, "sigil_stone"); parts.push("a sigil stone"); if (addTitle(s, "Gatecloser")) parts.push("the title Gatecloser"); }
    stat(s, "inv");
    return parts.length ? `🔥 ${ev.hold} is free of the Daedra. Your share: ${parts.join(", ")}.` : `🔥 The gates you fought at weren't closed in time. Better luck next invasion.`;
  }

  // ---------------------------------------------------------------- dragon migration
  const MIG_COOLDOWN = 15 * 60, MIG_MAX = 5;
  const migGoal = (people) => Math.min(25, 3 + 2 * Math.max(0, people - 1));
  function flight(ev, s) {
    const rs = rows(ev, s).filter((d) => Number.isFinite(+d.n));
    const total = rs.reduce((a, d) => a + capN(d.n, MIG_MAX), 0), people = rs.filter((d) => +d.n > 0).length;
    return { total, goal: migGoal(Math.max(1, people)), people, names: rs.filter((d) => !d.me).map((d) => d.name) };
  }
  const holdOf = (s) => (WORLD.places[s.location] ? G.holdAt(WORLD.places[s.location]) : G.holdAt([s.x, s.y]));
  /* migrating dragons are tired from the long flight: tough, but softer than a dragon that hunts you on the road ([OURS], sim in tests) */
  const dragonBase = (lv) => (lv < 22 ? { danger: "high", level: 16, health: 180, damage: 20 } : { danger: "high", level: 30, health: 200, damage: 25 });
  const DRAGON_NAMES = ["Migrating dragon", "Frost dragon", "Blood dragon", "Elder dragon"];
  function hunt(s, t = nowS()) {
    const ev = active(t).find((e) => e.kind === "mig");
    if (!ev) return { text: "The dragons have flown on." };
    if (s.trip?.status) return { text: "Finish your trip first." };
    if (holdOf(s) !== ev.hold) return { text: `The dragons are circling over ${ev.hold}. Get there first.` };
    const m = mine(s, ev);
    if ((m.n || 0) >= MIG_MAX) return { text: "You've brought down all the dragons you can find. Leave some for the others!" };
    if (m.last && t - m.last < MIG_COOLDOWN) return { text: `No dragon is low enough to reach. Try again in ${Math.ceil((MIG_COOLDOWN - (t - m.last)) / 60)} min.` };
    if (hurt(s, t)) return { text: "You're too badly hurt to take on a dragon. Heal up first." };
    m.last = t;
    const lv = G.fightLevel(s), young = lv < 22;
    const name = young ? "Young dragon" : DRAGON_NAMES[Math.floor(Math.random() * (lv >= 36 ? 4 : lv >= 28 ? 3 : 2))];
    const e = G.scaleEnemy({ name, ...dragonBase(lv), tags: ["big", "dragon", "elite"], gold: [100, 300], text: "" }, lv);
    e.hold = ev.hold;
    const f = new G.Fight(s, e, null, t);
    f.run({ t, maxTurns: 40 });
    const skills = f.apply(t);   // the killing blow takes the dragon's soul (Fight.apply)
    const out = { fight: f, skills, loot: [], gold: 0, ev };
    if (f.won) {
      m.n = (m.n || 0) + 1;
      s.souls = (s.souls || 0) + 1;   // the migration's gift: a second soul from every dragon
      out.gold = rint(...e.gold); s.gold += out.gold;
      const bones = 1 + Math.round(pfx(s, "wevbone"));
      G.give(s, "dragon_bone", bones); out.loot = [`Dragon Bone${bones > 1 ? ` ×${bones}` : ""}`, "an extra dragon soul"];
    }
    if (f.hp <= 0) { const d = G.die(s, "dragon", t); out.died = d.msg; out.bag = d.bag; }
    out.text = f.won ? `The ${e.name.toLowerCase()} crashes into the hills of ${ev.hold}. Its soul rushes into you, and with the flight so close, a second one follows.`
      : out.died ? `The ${e.name.toLowerCase()}'s breath takes you.` : `The ${e.name.toLowerCase()} climbs out of reach and rejoins the flight.`;
    return out;
  }
  function claimMig(s, ev, t) {
    const m = mine(s, ev);
    if (m.claimed || !(m.n > 0)) return null;
    const fl = flight(ev, s);
    if (fl.total < fl.goal) return null;
    m.claimed = true; s.gold += 400; G.give(s, "dragon_scales");
    const ti = addTitle(s, "Dragonwatcher");
    stat(s, "mig");
    return `🐉 The hunters of the North brought down ${fl.total} dragons over ${ev.hold}. Your share: 400 gold, dragon scales${ti ? " and the title Dragonwatcher" : ""}.`;
  }

  // ---------------------------------------------------------------- festival week
  const FEST_GOAL = 8, CHEER_GOAL = 40;
  const dayOf = (t) => Math.floor(t / DAY);
  const inTown = (s) => ["city", "town"].includes(WORLD.places[s.location]?.[2]);
  function cheer(ev, s) {
    const rs = rows(ev, s).filter((d) => Number.isFinite(+d.f));
    return { total: rs.reduce((a, d) => a + capN(d.f, 60), 0), people: rs.filter((d) => +d.f > 0).length, goal: CHEER_GOAL };
  }
  const played = (s, ev, game, t) => (mine(s, ev).p || {})[game] === dayOf(t);
  function play(s, game, t = nowS()) {
    const ev = active(t).find((e) => e.kind === "fest");
    if (!ev) return { text: "The festival is over." };
    const g = ev.v.games.find((x) => x[0] === game);
    if (!g) return { text: "No such contest." };
    if (!inTown(s) || s.trip?.status) return { text: "The contests are in the towns. Go to any town or city." };
    if (played(s, ev, game, t)) return { text: "You've had your go at that one today. Come back tomorrow." };
    const m = mine(s, ev); m.p = m.p || {}; m.p[game] = dayOf(t);
    const lvl = G.skill(s, g[2]), chance = Math.max(0.3, Math.min(0.9, 0.3 + lvl / 160));
    const win = Math.random() < chance, pts = win ? 2 : 1;
    m.f = (m.f || 0) + pts;
    const prize = win ? rint(20, 45) : 0; s.gold += prize;
    const skills = G.useSkill(s, g[2], win ? 3 : 1.5);
    const done = m.f >= FEST_GOAL && !m.claimed;
    const text = (win ? `${g[1]}: you win! The crowd cheers and slips you ${prize} gold.` : `${g[1]}: not your day, but the crowd loves a good try.`)
      + ` (+${pts} festival point${pts > 1 ? "s" : ""}, ${Math.min(m.f, FEST_GOAL)}/${FEST_GOAL})` + (done ? " Your festival reward is ready in the Journal." : "");
    return { text, win, pts, skills };
  }
  function claimFest(s, ev, t) {
    const m = mine(s, ev);
    if (m.claimed || (m.f || 0) < FEST_GOAL) return null;
    m.claimed = true;
    const ch = cheer(ev, s), bonus = ch.total >= CHEER_GOAL ? 150 : 0;
    s.gold += 300 + bonus;
    const [item, q] = ev.v.gift; if (D.ITEMS[item]) G.give(s, item, q);
    const ti = addTitle(s, "Festival Favourite");
    stat(s, "fest");
    return `${ev.icon} ${ev.v.name}: ${300 + bonus} gold${bonus ? " (the whole North cheered!)" : ""}, ${D.ITEMS[item]?.name || item} ×${q}${ti ? " and the title Festival Favourite" : ""}.`;
  }

  // ---------------------------------------------------------------- the Khajiit's grand caravan
  const KC_POOL = ["soul_gem_greater", "soul_gem_common", "ing_void_salts", "ing_frost_salts", "ing_fire_salts", "ing_crimson_nirnroot", "ing_nirnroot", "gem_flawless_sapphire",
    "gem_flawless_ruby", "gem_emerald", "gem_diamond", "gold_emerald_ring", "gold_sapphire_necklace", "mat_moonstone", "mat_dwarven", "mat_gold", "scroll_fireball", "scroll_healing",
    "potion_health", "ing_ectoplasm", "ing_hagraven_feathers", "dragon_scales", "elven_bow", "elven_sword", "dwarven_bow"];
  const KC_TITLE_AT = 5;
  function stock(ev, s) {
    const n = 5 + Math.round(pfx(s, "wevstock"));
    return shuffle(KC_POOL.filter((i) => D.ITEMS[i]), "stock:" + ev.id).slice(0, n);
  }
  const price = (s, item) => Math.max(1, Math.round((D.ITEMS[item]?.value || 1) * 1.2 * (1 - Math.min(0.3, pfx(s, "wevmarket")))));
  function buy(s, item, t = nowS()) {
    const ev = active(t).find((e) => e.kind === "kc");
    if (!ev) return { text: "The caravan has packed up and moved on." };
    if (s.location !== ev.town || s.trip?.status) return { text: `The caravan is camped outside ${ev.town}.` };
    if (!stock(ev, s).includes(item)) return { text: "Khajiit does not have that, friend." };
    const m = mine(s, ev); m.got = m.got || [];
    if (m.got.includes(item)) return { text: "Khajiit has only one of each. Come back next time." };
    const p = price(s, item);
    if (s.gold < p) return { text: "Khajiit has wares, if you have coin. You don't have enough." };
    s.gold -= p; G.give(s, item); m.got.push(item); m.b = (m.b || 0) + 1;
    s.wevStats = s.wevStats || {}; s.wevStats.kc = (s.wevStats.kc || 0) + 1;
    const ti = s.wevStats.kc >= KC_TITLE_AT && addTitle(s, "Friend of the Caravan");
    return { text: `You buy the ${D.ITEMS[item].name} for ${p} gold. "Walk in the shadows of Masser and Secunda, friend."` + (ti ? " The Khajiit now call you Friend of the Caravan!" : ""), bought: true };
  }

  // ---------------------------------------------------------------- rewards, titles, status
  function addTitle(s, t) { s.titles = s.titles || []; if (s.titles.includes(t)) return false; s.titles.push(t); return true; }
  function stat(s, k) { s.wevStats = s.wevStats || {}; s.wevStats[k] = (s.wevStats[k] || 0) + 1; }
  function claim(s, id, t = nowS()) {
    const ev = byId(id); if (!ev || t < ev.start || t > ev.end + DAY) return null;
    if (!s.wev || !s.wev[ev.id]) return null;
    return ev.kind === "inv" ? claimInv(s, ev, t) : ev.kind === "mig" ? claimMig(s, ev, t) : ev.kind === "fest" ? claimFest(s, ev, t) : null;
  }
  /* can a reward be claimed for this event right now? */
  function claimable(s, ev, t = nowS()) {
    const m = s.wev && s.wev[ev.id]; if (!m || m.claimed || t > ev.end + DAY) return false;
    if (ev.kind === "inv") { const st = gates(ev, s); return (m.g || []).some((x) => x > 0) && (st.closed === 3 || t >= ev.end); }
    if (ev.kind === "mig") { const fl = flight(ev, s); return m.n > 0 && fl.total >= fl.goal; }
    if (ev.kind === "fest") return (m.f || 0) >= FEST_GOAL;
    return false;
  }
  /* forget old events in the save */
  function prune(s, t = nowS()) { if (s.wev) for (const [k, v] of Object.entries(s.wev)) if (!v || !(v.end > t - 10 * DAY)) delete s.wev[k]; }
  /* one-line progress for an event */
  function progress(ev, s, t = nowS()) {
    if (ev.kind === "inv") { const st = gates(ev, s); return { pct: st.list.reduce((a, g) => a + Math.min(1, g.total / g.need), 0) / 3, line: `${st.closed}/3 gates closed${st.people ? ` · ${st.people} fighting` : ""}`, done: st.closed === 3 }; }
    if (ev.kind === "mig") { const fl = flight(ev, s); return { pct: Math.min(1, fl.total / fl.goal), line: `${fl.total}/${fl.goal} dragons down${fl.people ? ` · ${fl.people} hunting` : ""}`, done: fl.total >= fl.goal }; }
    if (ev.kind === "fest") { const m = mine(s, ev), ch = cheer(ev, s); return { pct: Math.min(1, (m.f || 0) / FEST_GOAL), line: `Your points ${Math.min(m.f || 0, FEST_GOAL)}/${FEST_GOAL} · the North's cheer ${ch.total}/${CHEER_GOAL}`, done: (m.f || 0) >= FEST_GOAL }; }
    const rs = rows(ev, s).filter((d) => +d.b > 0);
    return { pct: Math.min(1, (t - ev.start) / (ev.end - ev.start)), line: `${rs.length ? `${rs.length} ${rs.length === 1 ? "traveller has" : "travellers have"} traded here` : "Rare wares, one of each"}`, done: false, time: true };
  }
  const left = (ev, t = nowS()) => { const sec = Math.max(0, ev.end - t), h = Math.floor(sec / HOUR), mm = Math.ceil((sec % HOUR) / 60); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${mm}m` : `${mm} min`; };
  const until = (ev, t = nowS()) => { const sec = Math.max(0, ev.start - t), h = Math.floor(sec / HOUR); return h >= 24 ? `${Math.floor(h / 24)} day${h >= 48 ? "s" : ""}` : h ? `${h}h ${Math.floor((sec % HOUR) / 60)}m` : `${Math.ceil(sec / 60)} min`; };

  Object.assign(D.ITEMS, {
    sigil_stone: { name: "Sigil Stone", slot: "soulgem", charge: 3000, weight: 1, value: 1000, desc: "Pulled from the heart of a closed Oblivion gate. Works like a filled grand soul gem at an enchanter." },
  });

  // ================================================================ screens (browser only)
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let api = null, loopT = null, lastSig = "";
  const me = () => (api ? api.S() : null);

  // ---- pictures (drawn through ART, so they follow the ink / pixel art style)
  function drawPic(kind, g, w, h, seed = "") {
    const r = seeded("pic:" + kind + seed);
    if (kind === "inv") {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#2a0d08"); sky.addColorStop(1, "#7a2a14"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#1c120c"; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += w / 8) g.lineTo(x, h * (0.78 + r() * 0.1)); g.lineTo(w, h); g.fill();
      const cx = w / 2, gy = h * 0.86, gw = Math.min(w * 0.34, h * 0.9), gh = h * 0.72;
      const glow = g.createRadialGradient(cx, gy - gh * 0.45, 2, cx, gy - gh * 0.45, gw * 0.9); glow.addColorStop(0, "rgba(255,200,90,.9)"); glow.addColorStop(0.5, "rgba(230,90,30,.55)"); glow.addColorStop(1, "rgba(120,20,10,0)");
      g.fillStyle = glow; g.fillRect(cx - gw, gy - gh * 1.1, gw * 2, gh * 1.1);
      g.fillStyle = "#e8642a"; g.beginPath(); g.ellipse(cx, gy - gh * 0.42, gw * 0.3, gh * 0.4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffd27a"; g.beginPath(); g.ellipse(cx, gy - gh * 0.42, gw * 0.14, gh * 0.24, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3b2c1e"; g.strokeStyle = "#140b07"; g.lineWidth = 1.5;
      for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(cx + sg * gw * 0.28, gy); g.quadraticCurveTo(cx + sg * gw * 0.62, gy - gh * 0.55, cx + sg * gw * 0.18, gy - gh); g.lineTo(cx + sg * gw * 0.08, gy - gh * 0.9); g.quadraticCurveTo(cx + sg * gw * 0.44, gy - gh * 0.5, cx + sg * gw * 0.12, gy); g.closePath(); g.fill(); g.stroke(); }
      for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,${120 + Math.floor(r() * 100)},40,${0.4 + r() * 0.5})`; g.beginPath(); g.arc(r() * w, h * (0.2 + r() * 0.6), 1 + r() * 1.6, 0, 7); g.fill(); }
    } else if (kind === "mig") {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#41506a"); sky.addColorStop(0.7, "#c98a5a"); sky.addColorStop(1, "#e3b47c"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#5d6878"; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += w / 6) g.lineTo(x, h * (0.55 + r() * 0.2)); g.lineTo(w, h); g.fill();
      g.fillStyle = "#f4f6f8"; for (let x = w / 12; x < w; x += w / 6) { g.beginPath(); g.moveTo(x - 6, h * 0.66); g.lineTo(x, h * 0.58); g.lineTo(x + 6, h * 0.66); g.fill(); }
      g.fillStyle = "#3d4a3a"; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += w / 10) g.lineTo(x, h * (0.8 + r() * 0.1)); g.lineTo(w, h); g.fill();
      for (let i = 0; i < 4; i++) {
        const sz = (i === 0 ? 0.5 : 0.3 - i * 0.04) * h, x = w * (0.2 + 0.2 * i + r() * 0.08), y = h * (0.12 + r() * 0.3);
        g.save(); g.translate(x - sz / 2, y - sz / 2);
        if ((typeof RAIDART !== "undefined")) RAIDART.drawDragon(g, sz, sz, i % 2); else { g.fillStyle = "#3b2c1e"; g.beginPath(); g.moveTo(0, sz / 2); g.lineTo(sz / 2, sz / 3); g.lineTo(sz, sz / 2); g.lineTo(sz / 2, sz * 0.6); g.fill(); }
        g.restore();
      }
    } else if (kind === "fest") {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#1c2238"); sky.addColorStop(1, "#4a3a5a"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#2a2018"; for (let i = 0; i < 6; i++) { const x = (i / 6) * w, bw = w / 6 - 4, bh = h * (0.3 + r() * 0.2); g.fillRect(x + 2, h - bh, bw, bh); g.beginPath(); g.moveTo(x, h - bh); g.lineTo(x + bw / 2 + 2, h - bh - h * 0.12); g.lineTo(x + bw + 4, h - bh); g.fill(); g.fillStyle = "#e8b04a"; g.fillRect(x + bw / 2 - 2, h - bh * 0.6, 5, 6); g.fillStyle = "#2a2018"; }
      g.strokeStyle = "#cdb98f"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, h * 0.18); g.quadraticCurveTo(w / 2, h * 0.42, w, h * 0.18); g.stroke();
      const cols = ["#c4572e", "#d6b25e", "#557a47", "#5a4a7a", "#9fd0f0"];
      for (let i = 1; i < 12; i++) { const x = (i / 12) * w, y = h * 0.18 + Math.sin((i / 12) * Math.PI) * h * 0.18; g.fillStyle = cols[i % cols.length]; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.lineTo(x, y + 9); g.fill(); }
      for (let i = 0; i < 7; i++) { const x = w * (0.08 + i * 0.14), y = h * (0.5 + r() * 0.1); const gl = g.createRadialGradient(x, y, 1, x, y, 9); gl.addColorStop(0, "rgba(255,220,120,.95)"); gl.addColorStop(1, "rgba(255,180,60,0)"); g.fillStyle = gl; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
      const fx = w / 2, fy = h * 0.92; for (let i = 0; i < 3; i++) { g.fillStyle = ["#e8923a", "#c4572e", "#ffd27a"][i]; g.beginPath(); g.moveTo(fx - 12 + i * 4, fy); g.quadraticCurveTo(fx, fy - h * (0.35 - i * 0.08), fx + 12 - i * 4, fy); g.fill(); }
    } else {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#e9c98a"); sky.addColorStop(1, "#d8a35e"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#b9874f"; g.fillRect(0, h * 0.78, w, h * 0.22);
      const tent = (x, tw, th, c1, c2) => { g.fillStyle = c1; g.beginPath(); g.moveTo(x - tw / 2, h * 0.8); g.lineTo(x, h * 0.8 - th); g.lineTo(x + tw / 2, h * 0.8); g.fill(); g.fillStyle = c2; for (let k = -2; k <= 2; k += 2) { g.beginPath(); g.moveTo(x + (k * tw) / 10, h * 0.8); g.lineTo(x, h * 0.8 - th); g.lineTo(x + ((k + 1) * tw) / 10, h * 0.8); g.fill(); } g.strokeStyle = "#3b2c1e"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - tw / 2, h * 0.8); g.lineTo(x, h * 0.8 - th); g.lineTo(x + tw / 2, h * 0.8); g.stroke(); };
      tent(w * 0.3, w * 0.36, h * 0.55, "#8e2b25", "#d6b25e"); tent(w * 0.68, w * 0.3, h * 0.45, "#5a4a7a", "#e9dcc0");
      g.fillStyle = "#7a5232"; for (let i = 0; i < 4; i++) { const x = w * (0.08 + i * 0.25), s2 = 8 + r() * 6; g.fillRect(x, h * 0.8 - s2, s2 * 1.3, s2); g.strokeStyle = "#3b2c1e"; g.strokeRect(x, h * 0.8 - s2, s2 * 1.3, s2); }
      g.strokeStyle = "#3b2c1e"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(w * 0.3, h * 0.25); g.lineTo(w * 0.3, h * 0.08); g.stroke(); g.fillStyle = "#c4572e"; g.beginPath(); g.moveTo(w * 0.3, h * 0.08); g.lineTo(w * 0.3 + 14, h * 0.12); g.lineTo(w * 0.3, h * 0.16); g.fill();
    }
  }
  const pic = (kind, w, h, seed = "") => ((typeof ART !== "undefined") ? ART.html(w, h, (g) => drawPic(kind, g, w, h, seed), { key: `wev-${kind}-${seed}`, cls: "wev-pic", alt: "" }) : "");

  // ---- map markers
  const spriteCache = {};
  function sprite(key, w, h, draw) {
    const st = (typeof ART !== "undefined") ? ART.style() : "ink", k = `${key}|${st}`;
    if (!spriteCache[k]) spriteCache[k] = (typeof ART !== "undefined") ? ART.canvas(w, h, draw, { style: st }) : null;
    return spriteCache[k];
  }
  const gateSprite = (closed) => sprite(closed ? "gate0" : "gate1", 40, 40, (g) => {
    if (!closed) { const gl = g.createRadialGradient(20, 22, 2, 20, 22, 18); gl.addColorStop(0, "rgba(255,210,110,1)"); gl.addColorStop(0.6, "rgba(232,100,42,.9)"); gl.addColorStop(1, "rgba(140,30,10,0)"); g.fillStyle = gl; g.beginPath(); g.ellipse(20, 22, 10, 14, 0, 0, 7); g.fill(); }
    g.fillStyle = closed ? "#6f6a64" : "#3b2c1e"; g.strokeStyle = "#140b07"; g.lineWidth = 1.2;
    for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(20 + sg * 11, 38); g.quadraticCurveTo(20 + sg * 19, 20, 20 + sg * 5, 3); g.lineTo(20 + sg * 2, 6); g.quadraticCurveTo(20 + sg * 13, 20, 20 + sg * 5, 38); g.closePath(); g.fill(); g.stroke(); }
    if (closed) { g.fillStyle = "#8f7a66"; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(12 + i * 5, 36, 3, 0, 7); g.fill(); } }
  });
  const dragonSprite = (f) => sprite("drg" + f, 36, 36, (g) => { if ((typeof RAIDART !== "undefined")) RAIDART.drawDragon(g, 36, 36, f); });
  const lanternSprite = () => sprite("lantern", 14, 18, (g) => { const gl = g.createRadialGradient(7, 10, 1, 7, 10, 7); gl.addColorStop(0, "#fff2c0"); gl.addColorStop(0.6, "#e8923a"); gl.addColorStop(1, "rgba(196,87,46,0)"); g.fillStyle = gl; g.beginPath(); g.arc(7, 10, 7, 0, 7); g.fill(); g.strokeStyle = "#3b2c1e"; g.lineWidth = 1; g.beginPath(); g.moveTo(7, 0); g.lineTo(7, 4); g.stroke(); });
  let gateCache = { k: "", v: null };
  function gatesCached(ev, s) { const k = ev.id + ":" + ver + ":" + JSON.stringify(s?.wev?.[ev.id]?.g || []); if (gateCache.k !== k) gateCache = { k, v: gates(ev, s) }; return gateCache.v; }
  /* called by map.js every frame: g = context, P = map position → canvas pixels, s = scale */
  function drawMap(g, P, s, t, rm) {
    const S = me(); if (!S || !(typeof WORLD !== "undefined")) return;
    let evs; try { evs = active(nowS()); } catch (e) { return; }
    const tt = rm ? 0 : t || 0;
    for (const ev of evs) {
      if (ev.kind === "inv") {
        const st = gatesCached(ev, S);
        for (const gt of st.list) {
          const p = WORLD.places[gt.site]; if (!p) continue;
          const [x, y] = P(p), pu = rm ? 0.5 : (Math.sin(tt * 2.6 + gt.i) + 1) / 2;
          if (!gt.closed) { g.fillStyle = `rgba(232,90,30,${0.18 + 0.2 * pu})`; g.beginPath(); g.arc(x, y - 6 * s, (20 + 5 * pu) * s, 0, 7); g.fill(); }
          const sp = gateSprite(gt.closed); if (sp) g.drawImage(sp, x - 13 * s, y - 30 * s, 26 * s, 26 * s);
          if (!gt.closed) { const bw = 28 * s, by = y - 34 * s; g.fillStyle = "rgba(20,14,8,.8)"; g.fillRect(x - bw / 2 - s, by - s, bw + 2 * s, 4 * s + 2 * s); g.fillStyle = "#e8642a"; g.fillRect(x - bw / 2, by, bw * Math.min(1, gt.total / gt.need), 4 * s); }
        }
      } else if (ev.kind === "mig") {
        const c = WORLD.holds[ev.hold]?.[0]; if (!c) continue;
        const [x, y] = P(c);
        g.fillStyle = "rgba(196,55,42,.10)"; g.beginPath(); g.arc(x, y, 70 * s, 0, 7); g.fill();
        for (let i = 0; i < ev.count; i++) {
          const R = (36 + i * 13) * s, a = tt * (0.35 + i * 0.07) * (i % 2 ? -1 : 1) + i * 2.1, dx = x + Math.cos(a) * R, dy = y + Math.sin(a) * R * 0.6;
          const sp = dragonSprite(rm ? 0 : Math.floor(tt * 5 + i) % 2); if (!sp) continue;
          const sz = (30 - i * 3) * s;
          g.save(); g.translate(dx, dy); g.rotate(a + (i % 2 ? 0 : Math.PI)); g.drawImage(sp, -sz / 2, -sz / 2, sz, sz); g.restore();
        }
      } else if (ev.kind === "kc") {
        const p = WORLD.places[ev.town]; if (!p) continue;
        const [x, y] = P(p);
        const sp = (typeof CARAVANS !== "undefined") && CARAVANS.sprite ? CARAVANS.sprite(true, false) : null;
        if (sp) g.drawImage(sp, x + 8 * s, y - 4 * s, 34 * s, 24 * s);
        g.font = `700 ${Math.round(9 * s)}px sans-serif`; g.textAlign = "center"; g.lineWidth = 3 * s; g.strokeStyle = "rgba(20,14,8,.85)"; g.strokeText("Khajiit market", x + 25 * s, y + 28 * s); g.fillStyle = "#ffe6a0"; g.fillText("Khajiit market", x + 25 * s, y + 28 * s);
      } else if (ev.kind === "fest") {
        const sp = lanternSprite(); if (!sp) continue;
        for (const town of Object.values(CAPITAL)) { const p = WORLD.places[town]; if (!p) continue; const [x, y] = P(p), bob = rm ? 0 : Math.sin(tt * 2 + x) * 1.5 * s; g.drawImage(sp, x - 18 * s, y - 22 * s + bob, 9 * s, 12 * s); g.drawImage(sp, x + 9 * s, y - 24 * s - bob, 9 * s, 12 * s); }
      }
    }
  }

  // ---- the card under the map, the detail sheet and the Journal panel
  function bar(pct, color) { return `<div class="bar wev-bar"><i style="width:${Math.round(100 * Math.max(0, Math.min(1, pct)))}%;background:${color}"></i></div>`; }
  const COLOR = { inv: "var(--ember)", mig: "#c4372a", fest: "var(--gold)", kc: "#d6b25e" };
  function mainButton(ev, S, t) {
    if (claimable(S, ev, t)) return `<button class="btn sm pri" data-wev="claim" data-id="${ev.id}">Claim</button>`;
    if (ev.kind === "inv") { const i = ev.sites.indexOf(S.location), st = gatesCached(ev, S); if (i >= 0 && !st.list[i].closed) return `<button class="btn sm danger" data-wev="gate">⚔️ Fight</button>`; const open = st.list.find((g) => !g.closed); return open ? `<button class="btn sm" data-act="go" data-place="${esc(open.site)}">Go</button>` : ""; }
    if (ev.kind === "mig") return holdOf(S) === ev.hold ? `<button class="btn sm danger" data-wev="hunt">⚔️ Hunt</button>` : `<button class="btn sm" data-act="go" data-place="${esc(CAPITAL[ev.hold])}">Go</button>`;
    if (ev.kind === "kc") return S.location === ev.town ? `<button class="btn sm pri" data-wev="open" data-id="${ev.id}">Browse</button>` : `<button class="btn sm" data-act="go" data-place="${esc(ev.town)}">Go</button>`;
    return `<button class="btn sm pri" data-wev="open" data-id="${ev.id}">Join in</button>`;
  }
  function cardHTML(S, t = nowS()) {
    const evs = active(t); if (!evs.length) return "";
    return `<div class="wev-card">${evs.map((ev) => { const p = progress(ev, S, t); return `<div class="wev-strip wev-${ev.kind}" data-wev="open" data-id="${ev.id}">
      ${pic(ev.kind, 56, 40, ev.kind === "fest" ? ev.variant : "")}<div class="wev-t"><b>${ev.icon} ${esc(ev.name)}</b><span class="sub">${esc(p.line)} · ${left(ev, t)} left</span>${bar(p.pct, COLOR[ev.kind])}</div>${mainButton(ev, S, t)}</div>`; }).join("")}</div>`;
  }
  const RULES = {
    inv: "Three Oblivion gates are open. Travel to one, fight the Daedra that pour out, and the gate weakens. Every player's wins count. Each gate you helped close pays 150 gold; close all three and everyone who fought gets a sigil stone (a reusable-grade soul for enchanting) and the title Gatecloser.",
    mig: "A flight of dragons circles the hold all day. Hunt them anywhere in the hold (one try every 15 minutes, up to 5 dragons each). Every dragon you bring down gives an extra soul and a dragon bone. When the North downs enough of them together, every hunter gets 400 gold, dragon scales and the title Dragonwatcher.",
    fest: `Three contests a day in any town or city. A win earns 2 points and a little gold, a loss still earns 1. Reach ${FEST_GOAL} points for 300 gold, a festival gift and the title Festival Favourite. If the whole North cheers ${CHEER_GOAL} points together, everyone gets 150 gold more.`,
    kc: `A Khajiit grand caravan, with rare things you won't find in shops. One of each per visit. Buy ${KC_TITLE_AT} things over time and they'll call you Friend of the Caravan.`,
  };
  function detailHTML(ev, S, t = nowS()) {
    const p = progress(ev, S, t);
    let body = "";
    if (ev.kind === "inv") {
      const st = gatesCached(ev, S), myG = S.wev?.[ev.id]?.g || [0, 0, 0];
      body = `<div class="list">${st.list.map((gt) => `<div class="item wev-gate${gt.closed ? " on" : ""}"><div class="t">${gt.closed ? "🪨" : "🔥"} Gate at ${esc(gt.site)}<span>${gt.closed ? "Closed" : `${gt.total}/${gt.need} to close`}${myG[gt.i] ? ` · you: ${myG[gt.i]}` : ""}</span>${bar(gt.total / gt.need, gt.closed ? "#8f7a66" : "var(--ember)")}</div>
        ${gt.closed ? "" : S.location === gt.site ? `<button class="btn sm danger" data-wev="gate">⚔️ Fight</button>` : `<button class="btn sm" data-act="go" data-place="${esc(gt.site)}">Travel</button>`}</div>`).join("")}</div>
        ${st.names.length ? `<p class="sub">Fighting with you: ${st.names.slice(0, 8).map(esc).join(", ")}${st.names.length > 8 ? "…" : ""}</p>` : ""}`;
    } else if (ev.kind === "mig") {
      const fl = flight(ev, S), m = S.wev?.[ev.id] || {}, cd = m.last ? Math.max(0, MIG_COOLDOWN - (t - m.last)) : 0;
      body = `<p class="sub">${fl.total}/${fl.goal} dragons down · you: ${m.n || 0}/${MIG_MAX}${G.fightLevel(S) < 22 ? " · the young ones come for heroes under level 22" : ""}</p>${bar(fl.total / fl.goal, "#c4372a")}
        ${holdOf(S) === ev.hold ? `<button class="btn danger wev-wide" data-wev="hunt" ${cd > 0 || (m.n || 0) >= MIG_MAX ? "disabled" : ""}>${cd > 0 ? `Next dragon in ${Math.ceil(cd / 60)} min` : "⚔️ Hunt a dragon"}</button>` : `<button class="btn wev-wide" data-act="go" data-place="${esc(CAPITAL[ev.hold])}">Travel to ${esc(CAPITAL[ev.hold])}</button>`}
        ${fl.names.length ? `<p class="sub">Hunting with you: ${fl.names.slice(0, 8).map(esc).join(", ")}</p>` : ""}`;
    } else if (ev.kind === "fest") {
      const town = inTown(S) && !S.trip?.status;
      body = `<p class="sub">${esc(ev.v.text)}</p><p class="sub">${esc(p.line)}</p>${bar(p.pct, "var(--gold)")}<div class="list">${ev.v.games.map(([id, label, sk]) => { const done = played(S, ev, id, t); return `<div class="item"><div class="t">${esc(label)}<span>${esc(sk)} · ${done ? "done today" : "once a day"}</span></div><button class="btn sm ${done ? "" : "pri"}" data-wev="play" data-game="${id}" ${done || !town ? "disabled" : ""}>${done ? "Tomorrow" : "Play"}</button></div>`; }).join("")}</div>
        ${town ? "" : `<p class="sub">Go to any town or city to join in.</p>`}`;
    } else {
      const here = S.location === ev.town && !S.trip?.status, got = S.wev?.[ev.id]?.got || [];
      body = here ? `<div class="list">${stock(ev, S).map((i) => { const it = D.ITEMS[i], pr = price(S, i), sold = got.includes(i); return `<div class="item">${(typeof ICONART !== "undefined") ? ICONART.item(i, 32) : ""}<div class="t">${esc(it.name)}<span>${esc(G.itemStats ? G.itemStats(i) : "")}</span></div><span class="num gold">${pr}</span><button class="btn sm" data-wev="buy" data-item="${esc(i)}" ${sold || S.gold < pr ? "disabled" : ""}>${sold ? "Sold" : "Buy"}</button></div>`; }).join("")}</div><p class="sub">You have ${S.gold} gold.</p>`
        : `<p class="sub">The caravan is camped outside ${esc(ev.town)} for ${left(ev, t)} more.</p><button class="btn wev-wide" data-act="go" data-place="${esc(ev.town)}">Travel to ${esc(ev.town)}</button>`;
    }
    const cl = claimable(S, ev, t) ? `<button class="btn pri wev-wide" data-wev="claim" data-id="${ev.id}">Claim your reward</button>` : "";
    return `<div class="wev-sheet">${pic(ev.kind, 320, 110, ev.kind === "fest" ? ev.variant : "")}<h2>${ev.icon} ${esc(ev.name)}</h2><p class="sub">${left(ev, t)} left · everyone in the North shares this</p>
      ${body}${cl}<details class="wev-rules"><summary class="sub">How it works</summary><p class="sub">${RULES[ev.kind]}</p></details>
      <button class="btn wev-wide" data-act="close">Close</button></div>`;
  }
  /* the Journal → Misc panel */
  function journal() {
    const S = me(); if (!S) return "";
    const t = nowS(), evs = active(t), rc = recent(t).filter((ev) => claimable(S, ev, t)), nx = upcoming(t).slice(0, 3);
    if (!evs.length && !rc.length && !nx.length) return "";
    const row = (ev) => { const p = progress(ev, S, t); return `<div class="item wev-jrow"><div class="t">${ev.icon} ${esc(ev.name)}<span>${esc(p.line)} · ${left(ev, t)} left</span>${bar(p.pct, COLOR[ev.kind])}</div><button class="btn sm ${claimable(S, ev, t) ? "pri" : ""}" data-wev="open" data-id="${ev.id}">${claimable(S, ev, t) ? "Claim" : "Open"}</button></div>`; };
    return `<div class="panel wev-j"><h2>World events</h2>${evs.length ? `<div class="list">${evs.map(row).join("")}</div>` : `<p class="sub">Nothing is happening right now.</p>`}
      ${rc.map((ev) => `<div class="item on"><div class="t">${ev.icon} ${esc(ev.name)}<span>Over, but your reward is waiting</span></div><button class="btn sm pri" data-wev="claim" data-id="${ev.id}">Claim</button></div>`).join("")}
      ${nx.length ? `<p class="sub" style="margin:8px 0 2px">Coming up:</p><div class="wev-next">${nx.map((ev) => `<span>${ev.icon} ${esc(ev.kind === "fest" ? ev.v.name : ev.kind === "kc" ? `Khajiit caravan, ${ev.town}` : ev.kind === "mig" ? `Dragons over ${ev.hold}` : `Daedra in ${ev.hold}`)} · in ${until(ev, t)}</span>`).join("")}</div>` : ""}</div>`;
  }

  // ---- actions
  function publish(S, ev) { if ((typeof Store !== "undefined")) Store.put("wevents", `${ev.id}-${S.id}`, record(S, ev)); }
  function onClick(e) {
    if (api && e.target.closest('.wevsheet [data-act="go"]')) { if (document.querySelector(".wevsheet")) api.closeModal(); return; }   // set off from the sheet: close it (unless the trip already opened something else)
    const b = e.target.closest("[data-wev]"); if (!b || b.disabled || !api) return;
    const S = me(); if (!S) return;
    if (e.target.closest("button[data-act]") && !e.target.closest("button[data-wev]")) return;   // the strip's own Go button
    const act = b.dataset.wev, t = nowS();
    if ((typeof SOUND !== "undefined")) try { SOUND.fx("click"); } catch (er) { /* ignore */ }
    if (act === "open") { const ev = byId(b.dataset.id); if (!ev) return; api.closeModal(); return void api.openModal(detailHTML(ev, S, t), "wevsheet"); }
    if (act === "claim") { const msg = claim(S, b.dataset.id, t); if (!msg) return api.toast("Nothing to claim yet."); api.closeModal(); api.persist(true); if ((typeof SOUND !== "undefined")) try { SOUND.fx("levelup"); } catch (er) { /* ignore */ } return api.showMessage("World event", msg); }
    if (act === "gate" || act === "hunt") {
      const out = act === "gate" ? fightGate(S, t) : hunt(S, t);
      if (!out.fight) return api.toast(out.text);
      publish(S, out.ev);
      if (out.bag && (typeof Store !== "undefined")) Store.addBag(out.bag);
      if (out.closedNow && api.postNews) api.postNews(`🔥 ${S.name} helped close the Oblivion gate at ${out.ev.sites[out.i]}!`);
      api.closeModal(); api.persist(true); render(true);
      return api.showFightResult({ ...out, text: out.text });
    }
    if (act === "play") { const r = play(S, b.dataset.game, t); if (r.pts) { const ev = active(t).find((x) => x.kind === "fest"); if (ev) publish(S, ev); api.persist(true); } api.toast(r.text); const ev = active(t).find((x) => x.kind === "fest"); if (ev && document.querySelector(".wevsheet")) { api.closeModal(); api.openModal(detailHTML(ev, S, t), "wevsheet"); } return; }
    if (act === "buy") { const r = buy(S, b.dataset.item, t); api.toast(r.text); if (r.bought) { const ev = active(t).find((x) => x.kind === "kc"); if (ev) publish(S, ev); api.persist(true); if (ev) { api.closeModal(); api.openModal(detailHTML(ev, S, t), "wevsheet"); } } }
  }
  /* new events: a banner, a toast and a line in the Journal */
  function announce(S, t) {
    S.wevSeen = S.wevSeen || {};
    let changed = false, shown = 0;
    const quiet = (S.level || 1) < 3;   // brand-new characters: just a Journal line, no pop-ups over the first steps
    for (const ev of active(t)) {
      if (S.wevSeen[ev.id]) continue;
      S.wevSeen[ev.id] = ev.end; changed = true;
      const line = ev.kind === "inv" ? `Oblivion gates have opened in ${ev.hold}! Close them together.` : ev.kind === "mig" ? `A flight of dragons circles over ${ev.hold} today.` : ev.kind === "fest" ? `${ev.v.name} festival week has begun in every town.` : `The Khajiit's grand caravan has camped outside ${ev.town}.`;
      G.note(S, `${ev.icon} ${line}`);
      if (quiet || shown++) continue;   // one banner + toast at a time, so two new events don't pile on each other
      if ((typeof POLISH !== "undefined")) POLISH.banner("quest", "World event", ev.kind === "fest" ? ev.v.name : ev.kind === "kc" ? "Khajiit caravan" : ev.kind === "mig" ? "Dragon migration" : "Daedric invasion", `<span class="wev-bic">${ev.icon}</span>`);
      api.toast(`${ev.icon} ${line}`);
    }
    for (const [k, end] of Object.entries(S.wevSeen)) if (!(end > t - 2 * DAY)) { delete S.wevSeen[k]; changed = true; }
    if (changed) { prune(S, t); api.persist(); }
  }
  function render(force) {
    const S = me(), el = document.getElementById("wev"); if (!S || !el) return;
    const t = nowS(), evs = active(t);
    const sig = evs.map((ev) => `${ev.id}|${progress(ev, S, t).line}|${left(ev, t)}|${claimable(S, ev, t)}|${S.location}|${S.trip?.status || ""}`).join(";") + ((typeof ART !== "undefined") ? ART.style() : "");
    if (!force && sig === lastSig) return;
    lastSig = sig; el.innerHTML = cardHTML(S, t);
  }
  function loop() {
    const S = me(); if (!S) return;
    if (!document.getElementById("wev")) { const raid = document.getElementById("raid"); if (!raid) return; const el = document.createElement("div"); el.id = "wev"; raid.after(el); el.addEventListener("click", (e) => { if (e.target.closest("[data-act]") && api.click) api.click(e); }); lastSig = ""; }
    try { announce(S, nowS()); render(false); } catch (e) { console.warn("world events", e); }
  }
  /* ui.js calls this once the main screen is up */
  function mount(a) {
    api = a;
    if ((typeof Store !== "undefined")) Store.watch("wevents", (list) => { setDocs(list); if (document.getElementById("wev")) render(true); });
    if (!mount.bound) { document.addEventListener("click", onClick); mount.bound = true; }
    clearInterval(loopT); loopT = setInterval(loop, 1000); loop();
  }

  return { dragonBase, active, upcoming, recent, byId, invasionIn, migrationIn, festivalIn, caravanIn, FESTS, DAEDRA, KC_POOL, setDocs, record, rows, gates, flight, cheer, fightGate, daedraFor, hunt, play, buy, stock, price, claim, claimable, progress, prune,
    GATE_NEED, GATE_PER, WIN_PTS, LOSS_PTS, FEST_GOAL, CHEER_GOAL, MIG_MAX, MIG_COOLDOWN, KC_TITLE_AT, migGoal, gateSites, journal, cardHTML, detailHTML, drawMap, mount };
})();
