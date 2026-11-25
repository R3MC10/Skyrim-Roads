/* Great world events: big timed happenings that everyone sees at the same time, with a banner and a countdown on the
   map. [OURS]
   - A dragon attacks a town: a three-phase boss fight (it circles and burns, it lands in the streets, it fights on
     wounded and furious). Anyone can join; a party of up to 8 fights it together (the leader starts each charge,
     members close by fight beside them). If nobody brings it down in time the town burns and rebuilds over 3 days.
   - A Daedric rift tears open at a ruin or shrine: Daedra pour out, then a Dremora guard, then the Rift Lord.
     Left open, the Daedra scare the hold's traders for a day.
   - A bandit army besieges a hold's capital: raiders at the walls, the battering ram, then the warlord. Break the
     siege and the Jarl lowers prices for a day; fail and the hold is plundered (dearer for two days).
   - A town fair: games (archery butts, arm wrestling, a drinking contest, the lucky wheel), a prize stall and every
     shop in the town 25% off while it lasts.
   The timetable is worked out from the real clock (UTC), so every friend's phone shows the same event at the same
   moment with no server. Two great events a day, each kind every couple of days, with a 45-minute warning first.
   Shared progress: collection "gevents", each player writes only their own record (id eventId-playerId).
   Rewards are by share: how much of a fair share of the fight you (and your party) did. */
const GREATEV = (() => {
  const MIN = 60, HOUR = 3600, DAY = 86400;
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const hash = (str) => { let x = 2166136261; for (const c of String(str)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const seeded = (seed) => { let a = Math.floor(hash(seed) * 4294967296) | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (list, seed) => { const r = seeded(seed), a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pfx = (s, key) => (typeof PFX !== "undefined" && s ? PFX.num(s, key) : 0);
  /* player text goes through T (i18n.js turns it Polish for Polish players; English otherwise, and in node tests) */
  const T = (en, v) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : v ? en.replace(/\{(\w+)(:lc)?\}/g, (m, k, lc) => (k in v ? (lc ? String(v[k]).toLowerCase() : String(v[k] ?? "")) : m)) : en);
  const capN = (v, max) => (Number.isFinite(+v) ? Math.max(0, Math.min(max, +v)) : 0);

  const HOLDS = ["Haafingar", "Hjaalmarch", "The Pale", "Winterhold", "Eastmarch", "Whiterun", "The Reach", "Falkreath", "The Rift"];
  const CAPITAL = { Haafingar: "Solitude", Hjaalmarch: "Morthal", "The Pale": "Dawnstar", Winterhold: "Winterhold", Eastmarch: "Windhelm", Whiterun: "Whiterun", "The Reach": "Markarth", Falkreath: "Falkreath", "The Rift": "Riften" };
  const DRAGON_TOWNS = ["Whiterun", "Solitude", "Windhelm", "Markarth", "Riften", "Falkreath", "Dawnstar", "Morthal", "Winterhold", "Riverwood", "Rorikstead", "Ivarstead"];
  const FAIR_TOWNS = ["Whiterun", "Solitude", "Windhelm", "Markarth", "Riften", "Falkreath", "Riverwood", "Dawnstar"];
  const RIFT_KINDS = ["landmark", "stone", "shrine", "fort", "camp"];
  const WARLORDS = ["Krev the Skinner", "Red Ulfgar", "Mad Hroki", "Sorli the Black", "Grisvar One-Eye", "Vals Veran", "Hjorunn Iron-Tooth", "Kematu the Raider"];

  // ---------------------------------------------------------------- the timetable
  const BLOCK = 12 * HOUR, WARN = 45 * MIN;   // two great events a day, each announced 45 minutes ahead
  const KINDS = ["dragon", "rift", "siege", "fair"];
  const LEN = { dragon: 60 * MIN, rift: 90 * MIN, siege: 2 * HOUR, fair: 3 * HOUR };
  const ICON = { dragon: "", rift: "", siege: "", fair: "" };
  const KIND_NAME = { dragon: "Dragon assault", rift: "Daedric rift", siege: "Siege", fair: "Town fair" };
  /* every 4 blocks (2 days) each kind comes once, in one of 8 orders: a fight (dragon or rift) opens each cycle and
     a siege or fair closes it, so the same kind never comes twice in a row */
  function kindAt(b) {
    const cyc = Math.floor(b / 4), i = ((b % 4) + 4) % 4, x = Math.floor(hash("gev-cyc:" + cyc) * 8);
    const first = x & 1 ? "rift" : "dragon", last = x & 2 ? "fair" : "siege";
    const mid = [first === "rift" ? "dragon" : "rift", last === "fair" ? "siege" : "fair"];
    if (x & 4) mid.reverse();
    return [first, ...mid, last][i];
  }
  const siteCache = {};
  function riftSites(hold) {
    if (siteCache[hold]) return siteCache[hold];
    const out = Object.keys(WORLD.places).filter((n) => { const p = WORLD.places[n]; return RIFT_KINDS.includes(p[2]) && !(WORLD.isSol && WORLD.isSol(p)) && G.holdAt(p) === hold; }).sort();
    return (siteCache[hold] = out.length ? out : [CAPITAL[hold]]);
  }
  function eventIn(b) {
    const kind = kindAt(b), len = LEN[kind];
    const start = b * BLOCK + WARN + Math.floor(hash("gev-at:" + b) * (BLOCK - WARN - len));
    const ev = { id: "gev-" + b, b, kind, start, warn: start - WARN, end: start + len, icon: ICON[kind] };
    const r = (k) => hash("gev-" + k + ":" + b);
    if (kind === "dragon") {
      ev.place = DRAGON_TOWNS[Math.floor(r("town") * DRAGON_TOWNS.length)];
      const kinds = typeof DRAGONS !== "undefined" ? DRAGONS.KINDS.slice(0, 4) : [{ id: "dragon", name: "Dragon", hp: 1, dmg: 1 }];
      const k = kinds[Math.floor(r("kind") * kinds.length)];
      ev.dKind = k.id; ev.foe = k.name;
      ev.name = T("{foe} attacks {place}", { foe: k.name, place: ev.place });
    } else if (kind === "rift") {
      ev.hold = HOLDS[Math.floor(r("hold") * HOLDS.length)];
      const list = riftSites(ev.hold); ev.place = list[Math.floor(r("site") * list.length)];
      ev.name = T("Daedric rift at {place}", { place: ev.place });
    } else if (kind === "siege") {
      ev.hold = HOLDS[Math.floor(r("hold") * HOLDS.length)]; ev.place = CAPITAL[ev.hold];
      ev.foe = WARLORDS[Math.floor(r("lord") * WARLORDS.length)];
      ev.name = T("Siege of {place}", { place: ev.place });
    } else {
      ev.place = FAIR_TOWNS[Math.floor(r("town") * FAIR_TOWNS.length)];
      ev.name = T("The great fair in {place}", { place: ev.place });
    }
    if (!ev.hold && typeof WORLD !== "undefined" && WORLD.places[ev.place]) ev.hold = G.holdAt(WORLD.places[ev.place]);
    return ev;
  }
  const blockAt = (t) => Math.floor(t / BLOCK);
  /* the event shown at time t: announced (warn), running (on), or null */
  function current(t = nowS()) {
    const b = blockAt(t);
    for (const x of [b, b - 1]) { const ev = eventIn(x); if (t >= ev.warn && t < ev.end) return ev; }
    return null;
  }
  const stage = (ev, t = nowS()) => (!ev ? "none" : t < ev.warn ? "later" : t < ev.start ? "warn" : t < ev.end ? "on" : "over");
  function upcoming(t = nowS(), n = 3) {
    const out = [], b = blockAt(t);
    for (let x = b; x <= b + 8 && out.length < n; x++) { const ev = eventIn(x); if (ev.warn > t) out.push(ev); }
    return out;
  }
  /* events that ended in the last few days (for rewards and what they left behind) */
  function recent(t = nowS(), days = 3) {
    const out = [], b = blockAt(t);
    for (let x = b - days * 2 - 1; x <= b; x++) { const ev = eventIn(x); if (ev.end <= t && ev.end > t - days * DAY) out.push(ev); }
    return out;
  }
  function byId(id) { const m = /^gev-(-?\d+)$/.exec(String(id || "")); return m ? eventIn(+m[1]) : null; }

  // ---------------------------------------------------------------- the bosses: three phases each
  /* base numbers at your own level (scaled by G.scaleEnemy); balance sim in tests/test_greatevents.js */
  const PHASES = {
    dragon: [
      { id: "sky", title: "It circles and burns", name: (ev) => T("{foe} over {place}", { foe: ev.foe, place: ev.place }), health: 150, damage: 13, tags: ["big", "dragon", "elite"], text: (ev) => T(ev.dKind === "frost" || ev.dKind === "blood" ? "The {foe:lc} sweeps low over the roofs, breathing frost." : "The {foe:lc} sweeps low over the roofs, breathing fire.", { foe: ev.foe }) },
      { id: "ground", title: "It lands in the streets", name: (ev) => T("{foe} in the streets", { foe: ev.foe }), health: 160, damage: 15, tags: ["big", "dragon", "elite"], text: (ev) => T("It crashes down in the market of {place}, tail smashing stalls.", { place: ev.place }) },
      { id: "fury", title: "Wounded and furious", name: (ev) => T("Wounded {foe:lc}", { foe: ev.foe }), health: 140, damage: 17, tags: ["big", "dragon", "elite"], text: () => T("Bleeding and furious, it fights for its life.") },
    ],
    rift: [
      { id: "spill", title: "Daedra pour out", name: () => T("Scamps and atronachs"), health: 140, damage: 12, tags: ["daedra", "rift"], text: () => T("Scamps and flame atronachs spill from the crackling rift.") },
      { id: "guard", title: "The Dremora guard", name: () => "Dremora Kynreeve", health: 150, damage: 14, tags: ["daedra", "humanoid", "rift"], text: () => T("A Dremora officer steps through and raises a burning blade.") },
      { id: "lord", title: "The Rift Lord", name: () => T("Dremora Markynaz, Rift Lord"), health: 170, damage: 17, tags: ["daedra", "humanoid", "elite", "rift"], text: () => T("The Rift Lord himself comes to hold the tear open.") },
    ],
    siege: [
      { id: "walls", title: "Raiders at the walls", name: () => T("Bandit raiders"), health: 130, damage: 11, tags: ["humanoid", "bandit", "siege"], text: (ev) => T("Bandits with ladders swarm the walls of {place}.", { place: ev.place }) },
      { id: "ram", title: "The battering ram", name: () => T("Ram crew and their guards"), health: 150, damage: 14, tags: ["humanoid", "bandit", "siege"], text: () => T("A battering ram thunders against the gate. Its guards won't let you near.") },
      { id: "lord", title: "The warlord", name: (ev) => T("{foe}, bandit warlord", { foe: ev.foe }), health: 170, damage: 17, tags: ["humanoid", "bandit", "elite", "siege"], text: (ev) => T("{foe} rides in to finish the job.", { foe: ev.foe }) },
    ],
  };
  const SPLIT = [0, 0.35, 0.7, 1];                       // phase boundaries, as a share of the whole fight
  const ROUND_PTS = 100;                                  // a fully won round, alone
  const SOLO_ROUNDS = { dragon: 7, rift: 6, siege: 7 };   // rounds a lone hero needs
  const PER_ROUNDS = { dragon: 5, rift: 4, siege: 5 };    // more for each extra hero
  const ALLY_ADD = 0.6;                                   // each party member beside you: the foe is 60% tougher, and the round counts 60% more
  const ROUND_TURNS = 10, ROUND_CD = 60, REC_CAP = 6000;
  const needFor = (kind, people) => ROUND_PTS * (SOLO_ROUNDS[kind] + PER_ROUNDS[kind] * Math.max(0, people - 1));
  const kindMult = (ev) => { const k = typeof DRAGONS !== "undefined" && ev.dKind ? DRAGONS.BY[ev.dKind] : null; return k ? { hp: 1 + (k.hp - 1) * 0.5, dmg: 1 + (k.dmg - 1) * 0.5 } : { hp: 1, dmg: 1 }; };

  // ---------------------------------------------------------------- shared records
  let raw = [], docs = [], ver = 0;
  function setDocs(list) { if (list) raw = list; docs = raw.filter((d) => d && typeof d.ev === "string" && d.uid && typeof d.uid === "string"); ver++; }
  function mine(s, ev) { s.gev = s.gev || {}; if (!s.gev[ev.id]) s.gev[ev.id] = { end: ev.end }; return s.gev[ev.id]; }
  function record(s, ev) {
    const m = mine(s, ev), d = { ev: ev.id, uid: s.id, name: s.name, lv: s.level || 1, t: nowS() };
    if (ev.kind === "fair") d.f = m.f || 0;
    else { d.p = Math.round(m.p || 0); d.party = (m.party || []).slice(0, 7); }
    return d;
  }
  function rows(ev, s) {
    const out = docs.filter((d) => d.ev === ev.id && (!s || d.uid !== s.id));
    if (s && s.gev && s.gev[ev.id]) out.push({ ...record(s, ev), me: true });
    return out;
  }
  /* the shared fight: total points, what's needed (grows with the heroes), the phase, and everyone's share */
  function tally(ev, s) {
    const rs = rows(ev, s).filter((d) => Number.isFinite(+d.p));
    const people = new Set();
    for (const d of rs) { if (+d.p > 0) people.add(d.uid); for (const u of Array.isArray(d.party) ? d.party.slice(0, 7) : []) if (typeof u === "string") people.add(u); }
    const n = Math.max(1, people.size), need = needFor(ev.kind, n);
    const total = Math.min(need, Math.round(rs.reduce((a, d) => a + capN(d.p, REC_CAP), 0)));
    const frac = total / need, phase = frac >= 1 ? 3 : SPLIT.findIndex((x, i) => frac >= x && frac < SPLIT[i + 1]);
    return { total, need, frac, phase, done: total >= need, people: people.size, names: rs.filter((d) => !d.me && +d.p > 0).map((d) => d.name) };
  }
  /* your share of the fight: your own rounds, split with the party members who fought beside you, plus their rounds you fought in */
  function credit(ev, s, uid = s.id) {
    let c = 0;
    for (const d of rows(ev, s)) {
      const party = Array.isArray(d.party) ? d.party.slice(0, 7) : [], p = capN(d.p, REC_CAP) / (1 + party.length);
      if (d.uid === uid || party.includes(uid)) c += p;
    }
    return Math.round(c);
  }
  const share = (ev, s) => { const tl = tally(ev, s); const fair = tl.need / Math.max(1, tl.people); return Math.min(2, credit(ev, s) / Math.max(1, fair)); };
  /* has the boss been beaten? Remembered in the save once the event is over, so what it left behind stays put */
  function outcome(ev, s, t = nowS()) {
    if (ev.kind === "fair") return "fair";
    s.gevOut = s.gevOut || {};
    if (s.gevOut[ev.id]) return s.gevOut[ev.id];
    const won = tally(ev, s).done;
    if (t >= ev.end) { const o = won ? "won" : "lost"; if (ver > 0 || s.gev?.[ev.id]) s.gevOut[ev.id] = o; return o; }   // remember it once the shared records have arrived
    return won ? "won" : "on";
  }

  // ---------------------------------------------------------------- one round against the boss
  const hurt = (s, t) => G.curHealth(s, t) < G.maxHealth(s) * 0.3;
  const leaderOnly = (party, s) => !!(party && party.leader && party.leader !== s.id && Array.isArray(party.members) && party.members.length > 1);
  function phaseFoe(ev, s, phase) {
    const P = PHASES[ev.kind][Math.min(2, phase)], lv = G.fightLevel(s), km = kindMult(ev);
    const e = G.scaleEnemy({ name: P.name(ev), level: lv, health: Math.round(P.health * km.hp), damage: Math.round(P.damage * km.dmg * 10) / 10, tags: [...P.tags], danger: "high", gold: [0, 0], text: "" }, lv);
    e.hold = ev.hold; e.gev = ev.id;
    if (ev.dKind) { e.dKind = ev.dKind; e.dSeed = ev.id; }
    return e;
  }
  /* opts.party: your party (only its leader starts a charge). Returns {text, fight?, skills, pts, phase, slain, died?, bag?} */
  function round(s, t = nowS(), opts = {}) {
    const ev = current(t);
    if (!ev || ev.kind === "fair") return { text: T("There's nothing to fight right now.") };
    const st = stage(ev, t);
    if (st === "warn") return { text: T("{kind} at {place} starts in {time}. Get ready.", { kind: KIND_NAME[ev.kind], place: ev.place, time: clock(ev.start - t) }) };
    if (s.location !== ev.place || s.trip?.status) return { text: T("The fight is at {place}. Get there first.", { place: ev.place }) };
    const tl0 = tally(ev, s);
    if (tl0.done) return { text: ev.kind === "dragon" ? T("The {foe:lc} is already dead. Claim your share.", { foe: ev.foe }) : T(ev.kind === "rift" ? "The rift is already sealed. Claim your share." : "The siege is already broken. Claim your share.") };
    if (leaderOnly(opts.party, s)) return { text: T("In a party only your leader starts each charge. Stay close to them and you fight beside them.") };
    const m = mine(s, ev);
    if (m.last && t - m.last < ROUND_CD) return { text: T("Catch your breath: you can charge again in {n} s.", { n: Math.ceil(ROUND_CD - (t - m.last)) }) };
    if (hurt(s, t)) return { text: T("You're too badly hurt to charge in. Heal up first (rest, a potion or a spell).") };
    m.last = t;
    const phase = tl0.phase, P = PHASES[ev.kind][phase];
    const e = phaseFoe(ev, s, phase);
    const f = new G.Fight(s, e, null, t);
    const mates = [...new Set(f.allies.filter((a) => a && a.party && typeof a.uid === "string").map((a) => a.uid))].slice(0, 7);
    const grow = 1 + ALLY_ADD * mates.length;
    if (grow > 1) { f.ehp = f.ehp0 = Math.round(f.ehp * grow); e.health = e.hp = f.ehp; }
    e.pool = f.ehp; e.noGroup = true;   // on the turn-by-turn screen: a charge against shared health, ROUND_TURNS rounds, no extra health boost or foe split (noautoplay.js)
    f.run({ t, maxTurns: ROUND_TURNS, trySneak: false });
    const dealt = Math.max(0, Math.min(1, (f.ehp0 - Math.max(0, f.ehp)) / f.ehp0));
    const bonus = pfx(s, ev.kind === "dragon" ? "gevdragon" : ev.kind === "rift" ? "gevrift" : "gevsiege");
    let pts = Math.round(ROUND_PTS * grow * dealt * (1 + bonus));
    pts = Math.min(pts, Math.max(0, tl0.need - tl0.total));
    const slain = tl0.total + pts >= tl0.need && f.hp > 0;
    if (ev.kind === "dragon" && !slain) f.won = false;   // it only climbs away: its soul comes with the killing blow
    const skills = f.apply(t);
    m.p = (m.p || 0) + pts;
    m.party = [...new Set([...(m.party || []), ...mates])].slice(0, 7);
    const heal = pfx(s, "gevheal");
    if (heal && f.hp > 0) G.setHealth(s, Math.min(G.maxHealth(s), G.curHealth(s, t) + G.maxHealth(s) * heal), t);
    // a charge you walk away from: the boss pulls back (the fight picture shows it breaking off, not you falling),
    // and it isn't a foe killed for tallies and war points
    if (!slain && f.hp > 0) { f.won = true; f.endWon = true; f.nonlethal = true; }
    const out = { ev, fight: f, skills, pts, phase, slain, mates: mates.length, loot: [], gold: 0 };
    if (f.hp <= 0) { const d = G.die(s, ev.kind === "dragon" ? "dragon" : ev.kind === "rift" ? "daedra" : "bandits", t); out.died = d.msg; out.bag = d.bag; }
    const tl1 = tally(ev, s);
    out.newPhase = !slain && tl1.phase > phase ? PHASES[ev.kind][tl1.phase] : null;
    const who = mates.length ? " " + T("({n} of your party beside you)", { n: mates.length }) : "";
    out.text = `${P.text(ev)} `
      + (slain ? (ev.kind === "dragon" ? T("You land the killing blow! The {foe:lc} crashes down in {place}.", { foe: ev.foe, place: ev.place }) : ev.kind === "rift" ? T("The Rift Lord falls and the rift snaps shut with a thunderclap!") : T("{foe} falls and the bandit army breaks and runs!", { foe: ev.foe }))
        : out.died ? T("You're dragged down. Others will have to carry on.")
        : T("+{pts} to the fight{who}.", { pts, who }) + (out.newPhase ? ` ${T(out.newPhase.title)}!` : ""));
    out.title = slain ? T("Victory") : T("Charge landed");   // the result window's heading (ui.js showFightResult)
    return out;
  }

  // ---------------------------------------------------------------- the fair
  const GAMES = [
    { id: "archery", name: "Archery butts", skill: "Archery", text: "Three arrows at the straw target." },
    { id: "arm", name: "Arm wrestling", skill: "Two-Handed", text: "Best of three against the town's strongest." },
    { id: "drink", name: "Drinking contest", skill: null, text: "Mead, then more mead. Last one standing wins." },
    { id: "wheel", name: "The lucky wheel", skill: null, text: "10 gold a spin. Pure luck." },
  ];
  const TRIES = 3;
  const PRIZES = [
    { at: 4, gold: 60, item: "potion_health", q: 2, label: "Two healing potions and 60 gold" },
    { at: 9, gold: 120, item: "gem_sapphire", q: 1, label: "A sapphire and 120 gold" },
    { at: 15, gold: 250, item: "gem_flawless_ruby", q: 1, label: "A flawless ruby, 250 gold and the title Fair Champion", title: "Fair Champion" },
  ];
  const FAIR_OFF = 0.25;
  function play(s, game, t = nowS(), rnd = Math.random) {
    const ev = current(t);
    if (!ev || ev.kind !== "fair" || stage(ev, t) !== "on") return { text: ev && ev.kind === "fair" ? T("The fair opens in {time}.", { time: clock(ev.start - t) }) : T("There's no fair on right now.") };
    const g = GAMES.find((x) => x.id === game); if (!g) return { text: T("No such game.") };
    if (s.location !== ev.place || s.trip?.status) return { text: T("The fair is in {place}.", { place: ev.place }) };
    const m = mine(s, ev); m.n = m.n || {};
    if ((m.n[game] || 0) >= TRIES) return { text: T("You've had your {n} goes at the {game:lc}. Try another game.", { n: TRIES, game: g.name }) };
    let pts = 0, gold = 0, text = "";
    if (game === "archery") {
      const p = Math.max(0.25, Math.min(0.85, 0.3 + G.skill(s, "Archery") / 180)); let hits = 0;
      for (let i = 0; i < 3; i++) if (rnd() < p) hits++;
      pts = hits; text = hits === 3 ? T("Three in the gold! The crowd roars.") : hits ? T("{hits} of 3 on the target.", { hits }) : T("All three wide. The children laugh.");
    } else if (game === "arm") {
      const p = Math.max(0.25, Math.min(0.85, 0.25 + G.skill(s, "Two-Handed") / 200 + Math.min(0.2, G.maxStamina(s) / 1500)));
      const win = rnd() < p; pts = win ? 3 : 1; text = T(win ? "You slam their arm to the table!" : "They pin you, but buy you a drink for trying.");
    } else if (game === "drink") {
      const p = Math.max(0.25, Math.min(0.85, 0.3 + Math.min(0.45, G.maxHealth(s) / 900) + (s.race === "nord" ? 0.1 : 0)));
      const win = rnd() < p; pts = win ? 2 : 1; text = T(win ? "Your rival slides under the table. You're still standing!" : "The room spins. You wake up under a bench.");
    } else {
      if (s.gold < 10) return { text: T("A spin costs 10 gold.") };
      s.gold -= 10; const r = rnd();
      if (r < 0.1) { gold = 60; pts = 2; text = T("Jackpot! 60 gold!"); } else if (r < 0.45) { gold = 15; pts = 1; text = T("A small win: 15 gold."); } else { pts = 1; text = T("Nothing this time. Still, the wheel is fun."); }
    }
    pts += Math.round(pfx(s, "gevgame"));
    m.n[game] = (m.n[game] || 0) + 1; m.f = (m.f || 0) + pts; s.gold += gold;
    const skills = g.skill ? G.useSkill(s, g.skill, 1 + pts) : [];
    const ready = PRIZES.filter((p) => m.f >= p.at && !(m.got || []).includes(p.at)).length;
    return { text: T("{game}: {text} (+{pts} {pt}, {all} in all)", { game: g.name, text, pts, pt: T(pts === 1 ? "point" : "points"), all: m.f }) + (ready ? " " + T("A prize is waiting at the prize stall.") : ""), pts, gold, skills, ev };
  }
  function prize(s, at, t = nowS()) {
    const ev = [current(t), ...recent(t, 1)].find((e) => e && e.kind === "fair");
    if (!ev || t > ev.end + DAY) return { text: T("The prize stall has packed up.") };
    const p = PRIZES.find((x) => x.at === +at), m = s.gev?.[ev.id];
    if (!p || !m) return { text: T("Nothing to collect.") };
    if ((m.f || 0) < p.at) return { text: T("You need {n} points for that prize.", { n: p.at }) };
    m.got = m.got || []; if (m.got.includes(p.at)) return { text: T("You've already collected that prize.") };
    m.got.push(p.at);
    const gold = Math.round(p.gold * (1 + pfx(s, "gevgold"))); s.gold += gold;
    if (D.ITEMS[p.item]) G.give(s, p.item, p.q);
    const ti = p.title && addTitle(s, p.title);
    stat(s, "fair");
    const list = [T("{n} gold", { n: gold }), ...(D.ITEMS[p.item] ? [`${D.ITEMS[p.item].name}${p.q > 1 ? ` ×${p.q}` : ""}`] : []), ...(ti ? [T("the title {title}", { title: p.title })] : [])];
    return { text: " " + T("Prize: {list}.", { list: list.join(", ") }), got: true };
  }

  // ---------------------------------------------------------------- rewards
  const REWARD = {
    dragon: { gold: 600, items: [["dragon_bone", 2], ["dragon_scales", 2]], title: "Firebreaker" },
    rift: { gold: 500, items: [["sigil_stone", 1], ["ing_daedra_heart", 1]], title: "Riftsealer" },
    siege: { gold: 500, items: [["gem_flawless_ruby", 1], ["gem_emerald", 1]], title: "Siegebreaker" },
  };
  function addTitle(s, t) { s.titles = s.titles || []; if (s.titles.includes(t)) return false; s.titles.push(t); return true; }
  function stat(s, k) { s.gevStats = s.gevStats || {}; s.gevStats[k] = (s.gevStats[k] || 0) + 1; }
  function claimable(s, ev, t = nowS()) {
    if (!ev || ev.kind === "fair") return false;
    const m = s.gev && s.gev[ev.id]; if (!m || m.claimed || t > ev.end + DAY) return false;
    if (!(credit(ev, s) > 0)) return false;
    return tally(ev, s).done || t >= ev.end;
  }
  /* your reward, by your share: a fair share pays everything; half a share still gets the trophies */
  function claim(s, id, t = nowS()) {
    const ev = byId(id); if (!claimable(s, ev, t)) return null;
    const m = mine(s, ev), won = tally(ev, s).done, sh = share(ev, s), R = REWARD[ev.kind];
    m.claimed = true;
    const parts = [];
    let gold = R.gold * (0.35 + 0.65 * Math.min(1, sh)) + (sh >= 1.5 ? 100 : 0);
    if (!won) gold *= 0.25;
    gold = Math.round(gold * (1 + pfx(s, "gevgold")));
    s.gold += gold; parts.push(T("{n} gold", { n: gold }));
    if (won) {
      for (const [it, q] of R.items) { const n = sh >= 0.5 ? q : 1; if (D.ITEMS[it]) { G.give(s, it, n); parts.push(`${D.ITEMS[it].name}${n > 1 ? ` ×${n}` : ""}`); } }
      if (ev.kind === "dragon" && typeof POWERS !== "undefined" && !s._test && !m.soul) { m.soul = true; parts.push(POWERS.absorb(s)); }
      if (sh >= 0.5 && addTitle(s, R.title)) parts.push(T("the title {title}", { title: R.title }));
      stat(s, ev.kind);
    }
    const pct = Math.round(Math.min(2, sh) * 100);
    const v = { place: ev.place, foe: ev.foe };
    const head = ev.icon + " " + (won ? T(ev.kind === "dragon" ? "{place} is saved." : ev.kind === "rift" ? "The rift at {place} is sealed." : "The siege of {place} is broken.", v)
      : T(ev.kind === "dragon" ? "The {foe:lc} burned {place} and flew off." : ev.kind === "rift" ? "The rift at {place} stayed open." : "The bandits plundered {place}.", v));
    return T("{head} You did {pct}% of a fair share. Your reward: {list}.", { head, pct, list: parts.join(", ") });
  }

  // ---------------------------------------------------------------- what events leave behind
  const AFTER = { dragon: { won: 1 * DAY, lost: 3 * DAY }, rift: { won: 1 * DAY, lost: 1 * DAY }, siege: { won: 1 * DAY, lost: 2 * DAY } };
  /* every lasting mark on the world right now: [{ev, kind, out, place, hold, left (0..1 of the time remaining), rebuilt}] */
  function aftermath(s, t = nowS()) {
    const out = [];
    for (const ev of recent(t, 3)) {
      if (ev.kind === "fair") continue;
      const o = outcome(ev, s, t), dur = AFTER[ev.kind][o === "won" ? "won" : "lost"], age = t - ev.end;
      if (age < 0 || age >= dur) continue;
      out.push({ ev, kind: ev.kind, out: o, place: ev.place, hold: ev.hold, left: 1 - age / dur, rebuilt: age / dur });
    }
    return out;
  }
  function aftermathLine(a) {
    const pct = Math.round(a.rebuilt * 100);
    const v = { place: a.place, hold: a.hold, pct };
    if (a.kind === "dragon") return T(a.out === "won" ? "{place} is clearing the rubble after the dragon ({pct}% rebuilt). Timber is dear: shops 5% dearer." : "{place} was burned by a dragon and is rebuilding ({pct}%). Shops there are up to 20% dearer until it's done.", v);
    if (a.kind === "rift") return T(a.out === "won" ? "The rift scar at {place} is fading." : "Daedra still lurk around {place}. Traders in {hold} charge 10% more.", v);
    return T(a.out === "won" ? "The Jarl of {hold} thanks the siege breakers: shops in the hold are 5% cheaper (10% if you fought)." : "{place} was plundered by bandits. Shops in {hold} are 15% dearer.", v);
  }
  /* shop prices in a town (engine.js buyPrice): the fair, a burned town, a plundered or grateful hold */
  function priceMult(s, town, t = nowS()) {
    if (!town || typeof WORLD === "undefined" || !WORLD.places[town]) return 1;
    let m = 1;
    try {
      const ev = current(t);
      if (ev && ev.kind === "fair" && stage(ev, t) === "on" && ev.place === town) m *= 1 - FAIR_OFF - Math.min(0.15, pfx(s, "gevshop"));
      const hold = G.holdAt(WORLD.places[town]);
      for (const a of aftermath(s, t)) {
        if (a.kind === "dragon" && a.place === town) m *= a.out === "won" ? 1.05 : 1 + 0.2 * a.left;
        else if (a.kind === "rift" && a.out === "lost" && a.hold === hold) m *= 1.1;
        else if (a.kind === "siege" && a.hold === hold) m *= a.out === "lost" ? 1.15 : (s && s.gev?.[a.ev.id]?.p > 0 ? 0.9 : 0.95);
      }
    } catch (e) { return 1; }
    return m;
  }

  // ---------------------------------------------------------------- times
  const clock = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / HOUR), mm = Math.floor((sec % HOUR) / 60), ss = sec % 60; return h ? `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`; };
  const until = (sec) => { const h = Math.floor(sec / HOUR); return h >= 24 ? T("{d}d {h}h", { d: Math.floor(h / 24), h: h % 24 }) : h ? T("{h}h {m}m", { h, m: Math.floor((sec % HOUR) / 60) }) : T("{n} min", { n: Math.max(1, Math.ceil(sec / 60)) }); };
  function countdown(ev, t = nowS()) {
    const st = stage(ev, t);
    if (st === "warn") return { label: T(ev.kind === "fair" ? "Opens in" : "Starts in"), sec: ev.start - t, txt: clock(ev.start - t) };
    if (st === "on") return { label: T(ev.kind === "fair" ? "Closes in" : "Time left"), sec: ev.end - t, txt: clock(ev.end - t) };
    return { label: "", sec: 0, txt: "" };
  }

  Object.assign(D.ITEMS, {
    ...(D.ITEMS.sigil_stone ? {} : { sigil_stone: { name: "Sigil Stone", slot: "soulgem", charge: 3000, weight: 1, value: 1000, desc: "Pulled from the heart of a closed Oblivion gate. Works like a filled grand soul gem at an enchanter." } }),
  });

  // ================================================================ screens (browser only)
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let api = null, loopT = null, lastSig = "";
  const me = () => (api ? api.S() : null);
  const partyOf = () => (api && api.party ? api.party() : null);
  const fightCall = (fn, done) => (typeof NOAUTO !== "undefined" ? NOAUTO.call(fn, done) : done(fn()));   // the fight opens on the turn-by-turn screen

  // ---- pictures (through ART)
  function drawPic(kind, g, w, h, seed = "", ph = 0) {
    const r = seeded("gpic:" + kind + seed);
    const town = (base, col, lit) => { g.fillStyle = col; for (let i = 0; i < 7; i++) { const x = (i / 7) * w, bw = w / 7 - 3, bh = h * (0.18 + r() * 0.16); g.fillRect(x + 1, base - bh, bw, bh); g.beginPath(); g.moveTo(x, base - bh); g.lineTo(x + bw / 2 + 1, base - bh - h * 0.1); g.lineTo(x + bw + 2, base - bh); g.fill(); if (lit) { g.fillStyle = "#e8b04a"; g.fillRect(x + bw / 2 - 2, base - bh * 0.6, 4, 5); g.fillStyle = col; } } };
    if (kind === "dragon") {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#2b1a1a"); sky.addColorStop(0.6, "#8a3a1c"); sky.addColorStop(1, "#e2833a"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) { const x = r() * w; g.fillStyle = "rgba(40,30,28,.5)"; g.beginPath(); g.ellipse(x, h * 0.35, w * 0.12, h * 0.25, 0, 0, 7); g.fill(); }
      town(h * 0.95, "#1d1410", true);
      for (let i = 0; i < 6; i++) { const x = w * (0.08 + r() * 0.84), fh = h * (0.12 + r() * 0.16); g.fillStyle = ["#ffd27a", "#e8642a", "#c4372a"][i % 3]; g.beginPath(); g.moveTo(x - 6, h * 0.82); g.quadraticCurveTo(x, h * 0.82 - fh * 2, x + 6, h * 0.82); g.fill(); }
      const sz = h * 0.62; g.save(); g.translate(w * 0.55 - sz / 2, h * (ph >= 1 ? 0.32 : 0.04));
      if (typeof RAIDART !== "undefined") RAIDART.drawDragon(g, sz, sz, 0); else { g.fillStyle = "#2a1c14"; g.beginPath(); g.moveTo(0, sz / 2); g.lineTo(sz / 2, sz / 3); g.lineTo(sz, sz / 2); g.lineTo(sz / 2, sz * 0.62); g.fill(); }
      g.restore();
      if (ph === 0) { g.fillStyle = "rgba(255,150,60,.55)"; g.beginPath(); g.moveTo(w * 0.5, h * 0.36); g.lineTo(w * 0.3, h * 0.86); g.lineTo(w * 0.52, h * 0.86); g.fill(); }
    } else if (kind === "rift") {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#160d1e"); sky.addColorStop(1, "#4a1830"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#1a1016"; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += w / 9) g.lineTo(x, h * (0.76 + r() * 0.1)); g.lineTo(w, h); g.fill();
      const cx = w / 2, cy = h * 0.48, rw = Math.min(w * 0.22, h * 0.5);
      for (let k = 5; k > 0; k--) { const gr = g.createRadialGradient(cx, cy, 1, cx, cy, rw * k / 3); gr.addColorStop(0, `rgba(255,${120 + k * 20},90,${0.12 * k})`); gr.addColorStop(1, "rgba(120,20,60,0)"); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rw * k / 3, rw * k / 2.2, 0, 0, 7); g.fill(); }
      g.strokeStyle = "#ffcf8a"; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy - rw); for (let i = 1; i <= 8; i++) g.lineTo(cx + (r() - 0.5) * rw * 0.5, cy - rw + (i * rw * 2) / 8); g.stroke();
      g.fillStyle = "#0d0a0c"; for (let i = 0; i < (ph + 2) * 2; i++) { const x = w * (0.12 + r() * 0.76), y = h * 0.8, s2 = 6 + r() * 5 + (ph === 2 && i === 0 ? 8 : 0); g.fillRect(x - s2 / 4, y - s2 * 1.6, s2 / 2, s2 * 1.6); g.beginPath(); g.arc(x, y - s2 * 1.75, s2 / 3.2, 0, 7); g.fill(); }
      for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(255,${100 + Math.floor(r() * 120)},60,${0.4 + r() * 0.5})`; g.beginPath(); g.arc(r() * w, h * (0.1 + r() * 0.7), 1 + r() * 1.5, 0, 7); g.fill(); }
    } else if (kind === "siege") {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#38404e"); sky.addColorStop(1, "#a0745a"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#4a4238"; g.fillRect(w * 0.45, h * 0.3, w * 0.55, h * 0.6); for (let x = w * 0.45; x < w; x += 12) g.fillRect(x, h * 0.25, 7, h * 0.06);
      g.fillStyle = "#2c241c"; g.fillRect(w * 0.6, h * 0.55, w * 0.1, h * 0.35);
      g.fillStyle = "#5b4128"; g.fillRect(w * 0.3, h * 0.66, w * 0.22, h * 0.08); g.fillStyle = "#2a1d12"; for (const x of [0.33, 0.48]) { g.beginPath(); g.arc(w * x, h * 0.78, h * 0.05, 0, 7); g.fill(); }
      for (let i = 0; i < 3; i++) { const x = w * (0.05 + i * 0.12); g.fillStyle = ["#8e2b25", "#6b5640", "#8e2b25"][i]; g.beginPath(); g.moveTo(x, h * 0.9); g.lineTo(x + w * 0.05, h * 0.62); g.lineTo(x + w * 0.1, h * 0.9); g.fill(); }
      g.fillStyle = "#1a1410"; for (let i = 0; i < 9; i++) { const x = w * (0.02 + r() * 0.5), y = h * 0.94; g.fillRect(x, y - 12, 3, 12); g.beginPath(); g.arc(x + 1.5, y - 14, 2.6, 0, 7); g.fill(); }
      for (let i = 0; i < 3; i++) { const x = w * (0.5 + r() * 0.45); g.fillStyle = "rgba(60,55,50,.55)"; g.beginPath(); g.ellipse(x, h * 0.18, 10, 18, 0, 0, 7); g.fill(); }
      g.strokeStyle = "#cdb98f"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(w * 0.56, h * 0.3); g.lineTo(w * 0.42, h * 0.9); g.stroke();
    } else {
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#5f8797"); sky.addColorStop(1, "#e9dcc0"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#8c9a5a"; g.fillRect(0, h * 0.8, w, h * 0.2);
      const tent = (x, tw, th, c1, c2) => { g.fillStyle = c1; g.beginPath(); g.moveTo(x - tw / 2, h * 0.82); g.lineTo(x, h * 0.82 - th); g.lineTo(x + tw / 2, h * 0.82); g.fill(); g.fillStyle = c2; for (let k = -2; k <= 2; k += 2) { g.beginPath(); g.moveTo(x + (k * tw) / 10, h * 0.82); g.lineTo(x, h * 0.82 - th); g.lineTo(x + ((k + 1) * tw) / 10, h * 0.82); g.fill(); } g.strokeStyle = "#3b2c1e"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - tw / 2, h * 0.82); g.lineTo(x, h * 0.82 - th); g.lineTo(x + tw / 2, h * 0.82); g.stroke(); };
      tent(w * 0.22, w * 0.3, h * 0.5, "#8e2b25", "#e9dcc0"); tent(w * 0.55, w * 0.34, h * 0.6, "#30505e", "#d6b25e"); tent(w * 0.85, w * 0.24, h * 0.42, "#557a47", "#e9dcc0");
      g.strokeStyle = "#3b2c1e"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, h * 0.12); g.quadraticCurveTo(w / 2, h * 0.36, w, h * 0.12); g.stroke();
      const cols = ["#c4572e", "#d6b25e", "#557a47", "#5a4a7a", "#9fd0f0"];
      for (let i = 1; i < 14; i++) { const x = (i / 14) * w, y = h * 0.12 + Math.sin((i / 14) * Math.PI) * h * 0.2; g.fillStyle = cols[i % cols.length]; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.lineTo(x, y + 8); g.fill(); }
      g.fillStyle = "#e9dcc0"; g.beginPath(); g.arc(w * 0.08, h * 0.6, h * 0.12, 0, 7); g.fill(); g.strokeStyle = "#8e2b25"; g.lineWidth = 2; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.moveTo(w * 0.08, h * 0.6); g.lineTo(w * 0.08 + Math.cos(a) * h * 0.12, h * 0.6 + Math.sin(a) * h * 0.12); g.stroke(); }
    }
  }
  function pic(kind, w, h, seed = "", ph = 0) {
    if (typeof ART === "undefined") return "";
    const asset = `gev-${kind}`;
    const image = typeof ASSETS === "undefined" ? null : ASSETS.img(w < 100 ? asset + "-thumb" : asset);
    const draw = image ? (g) => ASSETS.cover(g, image, w, h) : (g) => drawPic(kind, g, w, h, seed, ph);
    return ART.html(w, h, draw, { key: image ? asset + "-painted" : `gev-${kind}-${seed}-${ph}`, cls: "gev-pic", alt: "", painted: !!image });
  }

  // ---- map markers (map.js calls drawMap every frame)
  const spriteCache = {};
  function sprite(key, w, h, draw) {
    const k = key;
    if (!(k in spriteCache)) { try { spriteCache[k] = (typeof ART !== "undefined") ? ART.canvas(w, h, draw) : null; } catch (e) { spriteCache[k] = null; } }
    return spriteCache[k];
  }
  const riftSprite = () => sprite("rift", 40, 48, (g) => { const gr = g.createRadialGradient(20, 24, 2, 20, 24, 20); gr.addColorStop(0, "rgba(255,230,160,1)"); gr.addColorStop(0.45, "rgba(230,70,110,.9)"); gr.addColorStop(1, "rgba(90,10,60,0)"); g.fillStyle = gr; g.beginPath(); g.ellipse(20, 24, 13, 21, 0, 0, 7); g.fill(); g.strokeStyle = "#2a0d18"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(20, 4); g.lineTo(17, 16); g.lineTo(23, 26); g.lineTo(18, 36); g.lineTo(21, 44); g.stroke(); });
  const camp = () => sprite("siegecamp", 36, 26, (g) => { g.fillStyle = "#8e2b25"; g.strokeStyle = "#1a120c"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(2, 24); g.lineTo(12, 6); g.lineTo(22, 24); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#6b5640"; g.beginPath(); g.moveTo(16, 24); g.lineTo(25, 10); g.lineTo(34, 24); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#e8923a"; g.beginPath(); g.arc(18, 22, 2.5, 0, 7); g.fill(); });
  const fairTent = () => sprite("fairtent", 34, 30, (g) => { g.fillStyle = "#e9dcc0"; g.strokeStyle = "#3b2c1e"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(3, 28); g.lineTo(17, 4); g.lineTo(31, 28); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#c4572e"; for (const x of [10, 17, 24]) { g.beginPath(); g.moveTo(x - 2, 28); g.lineTo(17, 4); g.lineTo(x + 2, 28); g.fill(); } g.fillStyle = "#d6b25e"; g.beginPath(); g.moveTo(17, 4); g.lineTo(17, 0); g.lineTo(24, 2); g.fill(); });
  const scaffold = () => sprite("scaffold", 30, 24, (g) => { g.strokeStyle = "#8f6a42"; g.lineWidth = 2; for (const x of [5, 15, 25]) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 4); g.stroke(); } for (const y of [8, 16]) { g.beginPath(); g.moveTo(3, y); g.lineTo(27, y); g.stroke(); } g.beginPath(); g.moveTo(5, 22); g.lineTo(25, 6); g.stroke(); });
  const dragonSprite = (f) => sprite("gdrg" + f, 40, 40, (g) => { if (typeof RAIDART !== "undefined") RAIDART.drawDragon(g, 40, 40, f); });
  function label(g, text, x, y, s, col = "#ffe6a0") { g.font = `700 ${Math.round(9 * s)}px GameIcons, sans-serif`; g.textAlign = "center"; g.lineWidth = 3 * s; g.strokeStyle = "rgba(20,14,8,.88)"; g.strokeText(text, x, y); g.fillStyle = col; g.fillText(text, x, y); }
  let tallyCache = { k: "", v: null };
  function tallyCached(ev, s) { const k = ev.id + ":" + ver + ":" + (s?.gev?.[ev.id]?.p || 0); if (tallyCache.k !== k) tallyCache = { k, v: tally(ev, s) }; return tallyCache.v; }
  function drawMap(g, P, s, t, rm) {
    const S = me(); if (!S || typeof WORLD === "undefined") return;
    const now = nowS(), tt = rm ? 0 : t || 0;
    let ev = null, after = [];
    try { ev = current(now); after = aftermath(S, now); } catch (e) { return; }
    for (const a of after) {
      const p = WORLD.places[a.place]; if (!p) continue;
      const [x, y] = P(p);
      if (a.kind === "dragon") {
        g.fillStyle = `rgba(30,22,18,${0.25 + 0.35 * a.left})`; g.beginPath(); g.arc(x, y, 18 * s, 0, 7); g.fill();
        if (!rm) for (let i = 0; i < 4; i++) { const k = (tt * 0.6 + i * 0.25) % 1; g.fillStyle = `rgba(90,85,80,${0.45 * (1 - k)})`; g.beginPath(); g.arc(x + (i - 1.5) * 6 * s, y - 10 * s - k * 22 * s, (3 + k * 5) * s, 0, 7); g.fill(); }
        const sp = scaffold(); if (sp) g.drawImage(sp, x - 26 * s, y - 14 * s, 20 * s, 16 * s);
        label(g, T("Rebuilding {pct}%", { pct: Math.round(a.rebuilt * 100) }), x, y + 26 * s, s, "#e8c48a");
      } else if (a.kind === "rift") {
        g.strokeStyle = `rgba(150,40,90,${0.3 + 0.5 * a.left})`; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(x - 10 * s, y + 6 * s); g.lineTo(x - 2 * s, y - 2 * s); g.lineTo(x + 3 * s, y + 4 * s); g.lineTo(x + 11 * s, y - 6 * s); g.stroke();
      } else if (a.kind === "siege" && a.out === "lost") {
        if (!rm) for (let i = 0; i < 3; i++) { const k = (tt * 0.5 + i / 3) % 1; g.fillStyle = `rgba(70,64,58,${0.5 * (1 - k)})`; g.beginPath(); g.arc(x + (i - 1) * 8 * s, y - 12 * s - k * 26 * s, (3 + k * 6) * s, 0, 7); g.fill(); }
      }
    }
    if (!ev) return;
    const p = WORLD.places[ev.place]; if (!p) return;
    const [x, y] = P(p), st = stage(ev, now), pu = rm ? 0.5 : (Math.sin(tt * 2.4) + 1) / 2;
    const cd = countdown(ev, now), tl = ev.kind === "fair" ? null : tallyCached(ev, S);
    if (ev.kind === "dragon") {
      g.fillStyle = `rgba(232,90,30,${0.12 + 0.14 * pu})`; g.beginPath(); g.arc(x, y, (34 + 6 * pu) * s, 0, 7); g.fill();
      if (!tl.done) { const R = 30 * s, a = tt * 0.9, dx = x + Math.cos(a) * R, dy = y - 8 * s + Math.sin(a) * R * 0.5; const sp = dragonSprite(rm ? 0 : Math.floor(tt * 5) % 2); if (sp) { g.save(); g.translate(dx, dy); g.rotate(a + Math.PI / 2); g.drawImage(sp, -16 * s, -16 * s, 32 * s, 32 * s); g.restore(); } }
      if (st === "on" && !tl.done && !rm) for (let i = 0; i < 3; i++) { g.fillStyle = ["#ffd27a", "#e8642a", "#c4372a"][i]; const fx = x + (i - 1) * 7 * s; g.beginPath(); g.moveTo(fx - 3 * s, y); g.quadraticCurveTo(fx, y - (8 + 5 * Math.sin(tt * 6 + i)) * s, fx + 3 * s, y); g.fill(); }
    } else if (ev.kind === "rift") {
      const sp = riftSprite(); if (sp) { const k = 1 + 0.08 * pu; g.drawImage(sp, x - 14 * s * k, y - 38 * s * k, 28 * s * k, 34 * s * k); }
    } else if (ev.kind === "siege") {
      const sp = camp(); if (sp) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; g.drawImage(sp, x + Math.cos(a) * 30 * s - 11 * s, y + Math.sin(a) * 20 * s - 9 * s, 22 * s, 16 * s); }
    } else {
      const sp = fairTent(); if (sp) g.drawImage(sp, x + 10 * s, y - 22 * s, 22 * s, 20 * s);
    }
    if (tl && st === "on") { const bw = 34 * s, by = y - 44 * s; g.fillStyle = "rgba(20,14,8,.85)"; g.fillRect(x - bw / 2 - s, by - s, bw + 2 * s, 6 * s); g.fillStyle = tl.done ? "#8fbf6a" : "#e8642a"; g.fillRect(x - bw / 2, by, bw * tl.frac, 4 * s); for (const q of [0.35, 0.7]) { g.fillStyle = "#140b07"; g.fillRect(x - bw / 2 + bw * q, by, s, 4 * s); } }
    label(g, tl && tl.done ? `${ICON[ev.kind]} ${T("Victory!")}` : `${ICON[ev.kind]} ${cd.label} ${cd.txt}`, x, y - 50 * s, s, st === "warn" ? "#ffe6a0" : "#ffb38a");
  }

  // ---- the banner on the map screen, the detail sheet
  function bar(pct, color) { return `<div class="bar gev-bar"><i style="width:${Math.round(100 * Math.max(0, Math.min(1, pct)))}%;background:${color}"></i></div>`; }
  function phaseBar(ev, tl) {
    return `<div class="gev-phases">${PHASES[ev.kind].map((P, i) => { const a = SPLIT[i], b = SPLIT[i + 1], fill = Math.max(0, Math.min(1, (tl.frac - a) / (b - a))); return `<div class="gev-ph${tl.phase === i ? " on" : fill >= 1 ? " done" : ""}" style="flex:${b - a}"><i style="width:${Math.round(fill * 100)}%"></i><span>${esc(T(P.title))}</span></div>`; }).join("")}</div>`;
  }
  function mainButton(ev, S, t) {
    const st = stage(ev, t);
    if (claimable(S, ev, t)) return `<button class="btn sm pri" data-gev="claim" data-id="${ev.id}">${T("Claim")}</button>`;
    if (S.location !== ev.place) return `<button class="btn sm" data-act="go" data-place="${esc(ev.place)}">${T("Go")}</button>`;
    if (st === "warn") return `<button class="btn sm" data-gev="open" data-id="${ev.id}">${T("Ready")}</button>`;
    if (ev.kind === "fair") return `<button class="btn sm pri" data-gev="open" data-id="${ev.id}">${T("Play")}</button>`;
    if (tallyCached(ev, S).done) return `<button class="btn sm" data-gev="open" data-id="${ev.id}">${T("Open")}</button>`;
    return leaderOnly(partyOf(), S) ? `<button class="btn sm" data-gev="open" data-id="${ev.id}">${T("With leader")}</button>` : `<button class="btn sm danger" data-gev="fight">${T(" Fight")}</button>`;
  }
  function statusLine(ev, S, t) {
    if (ev.kind === "fair") { const m = S.gev?.[ev.id]; return T("Games, prizes, shops 25% off") + (m?.f ? " · " + T("your points {n}", { n: m.f }) : ""); }
    const tl = tallyCached(ev, S);
    if (tl.done) return T("Beaten!") + (tl.people ? " · " + T("{n} fought", { n: tl.people }) : "");
    if (stage(ev, t) === "warn") return T("At {where} · gather there", { where: ev.place + (ev.hold && ev.hold !== ev.place ? `, ${ev.hold}` : "") });
    return T("{phase} · {n} fighting", { phase: PHASES[ev.kind][tl.phase].title, n: tl.people || 0 });
  }
  function bannerHTML(S, t = nowS()) {
    const ev = current(t), rc = recent(t, 1).filter((e) => claimable(S, e, t)), af = aftermath(S, t);
    const cx = typeof CRISES !== "undefined" ? CRISES.strips(S, t) : [];   // holds in crisis (crises.js)
    if (!ev && !rc.length && !af.length && !cx.length) return "";
    let h = "", cd = null, st = "";
    if (ev) {
      cd = countdown(ev, t); st = stage(ev, t); const tl = ev.kind === "fair" ? null : tallyCached(ev, S);
      h += `<div class="gev-banner gev-${ev.kind} gev-${st}" data-gev="open" data-id="${ev.id}">
        <div class="gev-head">${pic(ev.kind, 64, 46, ev.dKind || "", tl ? Math.min(2, tl.phase) : 0)}<div class="gev-t"><span class="gev-kind">${ICON[ev.kind]} ${T(st === "warn" ? "Coming soon" : "Great world event")}</span><b>${esc(ev.name)}</b><span class="sub">${esc(statusLine(ev, S, t))}</span></div>
        <div class="gev-clock"><span>${cd.label}</span><b data-gev-end="${st === "warn" ? ev.start : ev.end}">${cd.txt}</b></div></div>
        ${tl && st === "on" ? phaseBar(ev, tl) : ""}<div class="gev-row">${mainButton(ev, S, t)}</div></div>`;
    }
    /* each strip carries a key naming its news, so the × on it (gevstack.js) hides it until the news changes */
    const strips = [];
    for (const e of rc) strips.push({ key: "claim:" + e.id, html: `<div class="gev-strip" data-gev="open" data-id="${e.id}"><span>${e.icon} ${esc(T("{name}: over, your reward is waiting", { name: e.name }))}</span><button class="btn sm pri" data-gev="claim" data-id="${e.id}">${T("Claim")}</button></div>` });
    strips.push(...cx);
    for (const a of af) strips.push({ key: "after:" + a.ev.id + ":" + a.out, html: `<div class="gev-strip gev-after"><span>${a.kind === "dragon" ? "" : a.kind === "rift" ? "" : a.out === "won" ? "" : ""} ${esc(aftermathLine(a))}</span></div>` });
    if (typeof GEVSTACK !== "undefined") return GEVSTACK.compose({ id: S.id, ev, evKey: ev ? ev.id + ":" + st : "", end: ev ? (st === "warn" ? ev.start : ev.end) : 0, cdTxt: cd ? cd.txt : "", banner: h, strips }, t);
    return `<div class="gev-card">${h}${strips.map((x) => x.html).join("")}</div>`;
  }
  const RULES = {
    dragon: "The dragon attacks in three phases: it circles and burns, lands in the streets, then fights on wounded. Go to the town and charge in: each charge is a short fight, and everything you do wears it down for everyone. The more heroes join, the tougher it gets. In a party, the leader starts each charge and members close by fight beside them. Kill it before time runs out or the town burns and has to rebuild for 3 days. Your reward depends on your share: gold, dragon bones and scales, its soul, and the title Firebreaker if you did at least half a fair share.",
    rift: "A rift to Oblivion has torn open. First Daedra spill out, then a Dremora guard holds the tear, then the Rift Lord himself. Each charge is a short fight that counts for everyone. Seal it in time and those who fought share sigil stones, daedra hearts and gold (title Riftsealer). Left open, Daedra scare off traders in the hold for a day.",
    siege: "A bandit army is besieging the town: raiders at the walls, then the battering ram, then the warlord. Each charge is a short fight that counts for everyone. Break the siege and the Jarl lowers prices in the hold for a day (more for those who fought) and pays out gems and gold (title Siegebreaker). Fail and the hold is plundered: shops are dearer for two days.",
    fair: "A great fair: four games (each {tries} goes), points add up to prizes at the prize stall, and every shop in town is 25% off while the fair lasts.",
  };
  function detailHTML(ev, S, t = nowS()) {
    const st = stage(ev, t), cd = countdown(ev, t), here = S.location === ev.place && !S.trip?.status;
    let body = "";
    if (ev.kind === "fair") {
      const m = S.gev?.[ev.id] || {}, n = m.n || {}, on = st === "on";
      body = `<p class="sub">${T("Your points: <b>{n}</b>. Shops in {place} are {pct}% off while the fair lasts.", { n: m.f || 0, place: esc(ev.place), pct: Math.round((FAIR_OFF + Math.min(0.15, pfx(S, "gevshop"))) * 100) })}</p>
        <div class="list">${GAMES.map((g) => { const used = n[g.id] || 0, left = TRIES - used; return `<div class="item"><div class="t">${esc(T(g.name))}<span>${esc(T(g.text))} · ${esc(T("{left} of {tries} left", { left, tries: TRIES }))}</span></div><button class="btn sm ${left > 0 ? "pri" : ""}" data-gev="play" data-game="${g.id}" ${left > 0 && here && on ? "" : "disabled"}>${T(left > 0 ? "Play" : "Done")}</button></div>`; }).join("")}</div>
        <h3 class="gev-h3">${T("Prize stall")}</h3><div class="list">${PRIZES.map((p) => { const got = (m.got || []).includes(p.at), can = (m.f || 0) >= p.at && !got; return `<div class="item${got ? " on" : ""}"><div class="t">${T("{n} points", { n: p.at })}<span>${esc(T(p.label))}</span></div><button class="btn sm ${can ? "pri" : ""}" data-gev="prize" data-at="${p.at}" ${can ? "" : "disabled"}>${T(got ? "Taken" : "Collect")}</button></div>`; }).join("")}</div>
        ${here ? "" : `<button class="btn wev-wide" data-act="go" data-place="${esc(ev.place)}">${esc(T("Travel to {place}", { place: ev.place }))}</button>`}`;
    } else {
      const tl = tally(ev, S), m = S.gev?.[ev.id] || {}, cdn = m.last ? Math.max(0, ROUND_CD - (t - m.last)) : 0, lead = leaderOnly(partyOf(), S);
      const myC = credit(ev, S), fair = tl.need / Math.max(1, tl.people);
      body = `${phaseBar(ev, tl)}<p class="sub">${tl.total}/${tl.need} · ${T(tl.people === 1 ? "{n} hero" : "{n} heroes", { n: tl.people || 0 })}${myC ? " · " + T("your share {pct}% of a fair share", { pct: Math.round((myC / fair) * 100) }) : ""}</p>
        ${tl.done ? `<p class="gev-win">${T("Victory! Everyone who fought can claim a share.")}</p>` : st === "warn" ? `<p class="sub">${esc(T("It begins in {time}. Gather at {place}.", { time: cd.txt, place: ev.place }))}</p>` : ""}
        ${!tl.done && st === "on" && here ? (lead ? `<p class="sub">${T("In a party, your leader starts each charge. Stay close to them and you fight beside them.")}</p>` : `<button class="btn danger wev-wide" data-gev="fight" ${cdn > 0 ? "disabled" : ""}>${cdn > 0 ? T("Catch your breath ({n} s)", { n: Math.ceil(cdn) }) : esc(T(" Charge: {phase}", { phase: T(PHASES[ev.kind][tl.phase].title).toLowerCase() }))}</button>`) : ""}
        ${here ? "" : `<button class="btn wev-wide" data-act="go" data-place="${esc(ev.place)}">${esc(T("Travel to {place}", { place: ev.place }))}</button>`}
        ${tl.names.length ? `<p class="sub">${T("Fighting with you: {names}", { names: tl.names.slice(0, 8).map(esc).join(", ") + (tl.names.length > 8 ? "…" : "") })}</p>` : ""}`;
    }
    const cl = claimable(S, ev, t) ? `<button class="btn pri wev-wide" data-gev="claim" data-id="${ev.id}">${T("Claim your reward")}</button>` : "";
    const ph = ev.kind === "fair" ? 0 : Math.min(2, tally(ev, S).phase);
    /* a painted card for the dragon and the siege (eventcards.js): the title sits under the painting */
    const won = ev.kind !== "fair" && tally(ev, S).done;
    const card = typeof EVCARDS !== "undefined" ? EVCARDS.html("gev:" + ev.kind, { title: `${ev.icon} ${esc(ev.name)}`, tag: "h2", sev: won || (st !== "warn" && st !== "on") ? "calm" : st === "warn" ? "mid" : ph >= 2 ? "dire" : "high" }) : "";
    return `<div class="gev-sheet">${card || `${pic(ev.kind, 320, 120, ev.dKind || "", ph)}<h2>${ev.icon} ${esc(ev.name)}</h2>`}
      <p class="sub">${st === "warn" || st === "on" ? `${cd.label} <b class="gev-cd" data-gev-end="${st === "warn" ? ev.start : ev.end}">${cd.txt}</b> · ` : T("Over") + " · "}${T("everyone in the North sees this")}</p>
      ${body}${cl}<details class="wev-rules"><summary class="sub">${T("How it works")}</summary><p class="sub">${T(RULES[ev.kind], { tries: TRIES })}</p></details>
      <button class="btn wev-wide" data-act="close">${T("Close")}</button></div>`;
  }

  // ---- actions
  function publish(S, ev) { if (typeof Store !== "undefined") Store.put("gevents", `${ev.id}-${S.id}`, record(S, ev)); }
  function reopen(ev, S) { if (document.querySelector(".gevsheet")) { api.closeModal(); api.openModal(detailHTML(ev, S, nowS()), "gevsheet"); } }
  function onClick(e) {
    if (api && e.target.closest('.gevsheet [data-act="go"]')) { if (document.querySelector(".gevsheet")) api.closeModal(); return; }
    const b = e.target.closest("[data-gev]"); if (!b || b.disabled || !api) return;
    const S = me(); if (!S) return;
    if (e.target.closest("button[data-act]") && !e.target.closest("button[data-gev]")) return;
    const act = b.dataset.gev, t = nowS();
    if (typeof SOUND !== "undefined") try { SOUND.fx("click"); } catch (er) { /* ignore */ }
    if (act === "open") { const ev = byId(b.dataset.id); if (!ev) return; api.closeModal(); return void api.openModal(detailHTML(ev, S, t), "gevsheet"); }
    if (act === "claim") { const msg = claim(S, b.dataset.id, t); if (!msg) return api.toast(T("Nothing to claim yet.")); api.closeModal(); api.persist(true); render(true); if (typeof SOUND !== "undefined") try { SOUND.fx("levelup"); } catch (er) { /* ignore */ } return api.showMessage(T("Great world event"), msg); }
    if (act === "fight") return void fightCall(() => round(S, t, { party: partyOf() }), (out) => {   // you play the charge turn by turn (noautoplay.js)
      if (!out.fight) return api.toast(out.text);
      publish(S, out.ev);
      if (out.bag && typeof Store !== "undefined") Store.addBag(out.bag);
      if (out.slain && api.postNews) api.postNews(T("{icon} {name} struck the final blow: {what}!", { icon: out.ev.icon, name: S.name, what: T(out.ev.kind === "dragon" ? "the {foe:lc} over {place} is dead" : out.ev.kind === "rift" ? "the rift at {place} is sealed" : "the siege of {place} is broken", { foe: out.ev.foe, place: out.ev.place }) }));
      if (out.newPhase && typeof POLISH !== "undefined") POLISH.banner("quest", out.ev.name, T(out.newPhase.title), `<span class="wev-bic">${out.ev.icon}</span>`);
      api.closeModal(); api.persist(true); render(true);
      return api.showFightResult({ ...out, text: out.text, title: out.died ? null : out.title });
    });
    if (act === "play") { const r = play(S, b.dataset.game, t); api.toast(r.text); if (r.pts) { if (r.ev) publish(S, r.ev); api.persist(true); if (r.ev) reopen(r.ev, S); render(true); } return; }
    if (act === "prize") { const r = prize(S, b.dataset.at, t); api.toast(r.text); if (r.got) { api.persist(true); const ev = [current(t), ...recent(t, 1)].find((x) => x && x.kind === "fair"); if (ev) reopen(ev, S); render(true); } }
  }
  /* a new event: a banner, a toast and a journal line when it's announced, and again when it starts */
  function announce(S, t) {
    const ev = current(t); if (!ev) return;
    S.gevSeen = S.gevSeen || {};
    const st = stage(ev, t), key = ev.id + ":" + st, quiet = (S.level || 1) < 3;
    if (S.gevSeen[key]) return;
    S.gevSeen[key] = ev.end;
    for (const [k, end] of Object.entries(S.gevSeen)) if (!(end > t - 2 * DAY)) delete S.gevSeen[k];
    if (S.gev) for (const [k, v] of Object.entries(S.gev)) if (!v || !(v.end > t - 5 * DAY)) delete S.gev[k];
    if (S.gevOut) for (const k of Object.keys(S.gevOut)) { const e = byId(k); if (!e || e.end < t - 5 * DAY) delete S.gevOut[k]; }
    const line = st === "warn" ? T("{name}: it starts in {time}.", { name: ev.name, time: until(ev.start - t) }) : ev.kind === "fair" ? T("{name} has opened: games, prizes and cheap shops!", { name: ev.name }) : T("{name}! Everyone to {place}!", { name: ev.name, place: ev.place });
    G.note(S, `${ev.icon} ${line}`);
    api.persist();
    if (quiet) return;
    /* one pop-up only: the banner goes through POLISH's queue, so it waits its turn and never sits on top of an
       Objective or quest banner; the corner toast is only the fallback when there's no banner system */
    if (typeof POLISH !== "undefined") POLISH.banner("quest", T(st === "warn" ? "Coming soon" : "Great world event"), ev.name, `<span class="wev-bic">${ev.icon}</span>`);
    else api.toast(`${ev.icon} ${line}`);
  }
  function tick() {
    const t = nowS();
    for (const el of document.querySelectorAll("[data-gev-end]")) { const end = +el.dataset.gevEnd; const txt = clock(end - t); if (el.textContent !== txt) el.textContent = txt; }
  }
  function render(force) {
    const S = me(), el = document.getElementById("gev"); if (!S || !el) return;
    const t = nowS(), ev = current(t);
    const sig = (ev ? `${ev.id}|${stage(ev, t)}|${statusLine(ev, S, t)}|${ev.kind === "fair" ? "" : tallyCached(ev, S).total}|${claimable(S, ev, t)}` : "") + `|${S.location}|${S.trip?.status || ""}|${recent(t, 1).filter((e) => claimable(S, e, t)).length}|${aftermath(S, t).map((a) => a.ev.id + Math.round(a.rebuilt * 100)).join()}|${partyOf()?.leader || ""}|${typeof GEVSTACK !== "undefined" ? GEVSTACK.sig() : ""}|${typeof CRISES !== "undefined" ? CRISES.sig(S, t) : ""}`;
    if (!force && sig === lastSig) return;
    lastSig = sig; el.innerHTML = bannerHTML(S, t);
  }
  function loop() {
    const S = me(); if (!S) return;
    if (!document.getElementById("gev")) { const raid = document.getElementById("raid"); if (!raid) return; const el = document.createElement("div"); el.id = "gev";
      /* the event card and the dragon raid card share one column (#topcards): on a PC they float together at the top of the map instead of on top of each other */
      if (raid.parentElement?.id === "topcards") raid.before(el); else { const top = document.createElement("div"); top.id = "topcards"; raid.before(top); top.append(el, raid); }
      el.addEventListener("click", (e) => { if (e.target.closest("[data-act]") && api.click) api.click(e); }); lastSig = ""; }
    try { announce(S, nowS()); render(false); tick(); } catch (e) { console.warn("great events", e); }
  }
  /* ui.js calls this once the main screen is up */
  function mount(a) {
    api = a;
    if (typeof Store !== "undefined") Store.watch("gevents", (list) => { setDocs(list); if (document.getElementById("gev")) render(true); });
    if (!mount.bound) { document.addEventListener("click", onClick); mount.bound = true; }
    if (typeof GEVSTACK !== "undefined") GEVSTACK.mount(() => render(true));
    clearInterval(loopT); loopT = setInterval(loop, 1000); loop();
  }

  return { BLOCK, WARN, LEN, KINDS, PHASES, SPLIT, GAMES, PRIZES, TRIES, REWARD, ROUND_PTS, ROUND_CD, ROUND_TURNS, SOLO_ROUNDS, PER_ROUNDS, ALLY_ADD, FAIR_OFF, AFTER,
    kindAt, eventIn, current, stage, upcoming, recent, byId, needFor, setDocs, record, rows, tally, credit, share, outcome, phaseFoe, round, play, prize,
    claimable, claim, aftermath, aftermathLine, priceMult, countdown, clock, bannerHTML, detailHTML, drawMap, mount };
})();
