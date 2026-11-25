/* tourney.js: Nordic festivals, tournaments and the Grand Arena (rules only; the screens are in tourneyui.js). [OURS]
   - Seven festivals take turns in seven holds on a fixed real-time rotation (UTC, so every phone agrees): each runs for
     2 days, then a quiet day while the next one is announced. The whole round takes 3 weeks, so a missed festival
     comes back. Nothing here is a daily chore: three tries per contest per festival, best try counts.
   - Contests reuse what the game already has: duels run on the real fight engine (on a throwaway copy of you, so
     nothing you wear can break or be lost, no bounty, nobody dies), archery / ring-tilting / the hunt use the
     precision crafting game, the smithing contest the forge hammer game, the mining race the mining game, the derby
     the fishing bite, and the drinking contest is a small push-your-luck game. Every score is a number on a board.
   - Each contest's board mixes real players (shared "fest" records, one per player per festival, only ever written by
     their owner) with four seeded local champions, so a lone player still has someone to beat.
   - The Grand Arena (the Pit, in Windhelm) is always open: rounds of monsters, alone or with your party, with a weekly
     board. Festivals are peaceful ground: players of any side duel each other there as friends, never as enemies.
   - Prizes are small: titles, trophies, a ceremonial weapon or hat, a little gold. Perks: Arena Champion, Sportsman,
     Crowd Favourite (perkfx.js). */
const TOURNEY = (() => {
  const DAY = 864e5, WEEK = 7 * DAY, SLOT = 3 * DAY, RUN = 2 * DAY, ANNOUNCE = DAY;
  const EPOCH = Date.UTC(2026, 0, 5);            // a Monday, 00:00 UTC: slot 0 starts here
  const TRIES = 3, PIT_TOWN = "Windhelm", PIT_ROUNDS = 8, KEEP = 12, PAIR_MAX = 3, PIT_HEAL = 0.25;
  const pf = (s, k) => (typeof PFX !== "undefined" && s ? PFX.num(s, k) || 0 : 0);
  const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hash(str) { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const nowMs = () => Date.now();
  const gnow = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);

  // ---------------------------------------------------------------- the festivals
  const FESTS = [
    { id: "tourney", name: "The Jarl's Tourney", place: "Windhelm", icon: "\uE101", colors: ["#2f4a6d", "#d9c7a0"], contests: ["duel", "archery", "joust"], title: "Tourney Champion", prize: "fest_tourney_sword",
      text: "The Jarl of Eastmarch opens the lists below the Palace of the Kings. Knights, sellswords and farmhands all try their luck." },
    { id: "harvest", name: "The Harvest Fair", place: "Whiterun", icon: "\uE12C", colors: ["#8a5a1c", "#e8d27a"], contests: ["smith", "drink", "archery"], title: "Harvest Champion", prize: "fest_harvest_crown",
      text: "Carts of cabbages fill the Plains District. Battle-Born mead flows, and the smiths of the Skyforge judge the anvils." },
    { id: "derby", name: "The Lake Honrich Fishing Derby", place: "Riften", icon: "\uE146", colors: ["#2f6b62", "#cfe0c8"], water: "lake", contests: ["fish", "drink", "duel"], title: "Derby Champion", prize: "fest_derby_cap",
      text: "Boats crowd the lake below Riften's docks. The biggest catch takes the purse, and the Bee and Barb runs out of mead by noon." },
    { id: "hunt", name: "The Great Hunt of Falkreath", place: "Falkreath", icon: "\uE115", colors: ["#3d5a2a", "#d8c79a"], contests: ["hunt", "archery", "joust"], title: "Hunt-Master", prize: "fest_hunt_bow",
      text: "Horns at dawn in the pine forest. Hunters bring their best kill to the Jarl's longhouse." },
    { id: "forgefire", name: "Forgefire Days", place: "Markarth", icon: "\uE104", colors: ["#7a2e1c", "#e0b070"], contests: ["smith", "mine", "duel"], title: "Master of the Forge", prize: "fest_forge_hammer",
      text: "Hammers ring from the Warrens to Understone Keep. The Silver-Bloods pay for the best blade and the fastest pick in Cidhna Mine." },
    { id: "olaf", name: "The Burning of King Olaf", place: "Solitude", icon: "\uE14D", colors: ["#5a2a5e", "#e6c26a"], contests: ["drink", "duel", "archery"], title: "Hero of Olaf's Night", prize: "fest_olaf_mask",
      text: "The Bards College burns a straw King Olaf on the bridge, and all of Solitude drinks to the dragon he never really caught." },
    { id: "midwinter", name: "The Midwinter Feast", place: "Dawnstar", icon: "\uE125", colors: ["#3a5a7a", "#e8eef2"], water: "sea", contests: ["drink", "fish", "mine"], title: "Midwinter Champion", prize: "fest_midwinter_circlet",
      text: "In the long night Dawnstar lights fires along the shore: ice fishing on the Sea of Ghosts, a race in Iron-Breaker Mine, and mead until dawn." },
  ];
  const BY_ID = Object.fromEntries(FESTS.map((f) => [f.id, f]));

  // ---------------------------------------------------------------- the contests
  const CONTESTS = {
    duel: { name: "Duelling ring", icon: "\uE101", fight: true, skills: ["One-Handed", "Two-Handed", "Archery", "Destruction"], max: 100,
      what: "A friendly bout with one of the festival's champions. Win with health to spare for more points. Nobody gets hurt for real." },
    archery: { name: "Archery butts", icon: "\uE10C", game: "precise", skills: ["Archery"], max: 125, what: "Three arrows at the straw target. Loose when the ring meets the mark." },
    joust: { name: "Ring-tilting", icon: "\uE12D", game: "precise", skills: ["One-Handed"], horse: true, max: 125, what: "Ride at the hanging rings with a lance. Bring your own horse." },
    smith: { name: "Smithing contest", icon: "\uE14E", game: "hammer", skills: ["Smithing"], max: 125, what: "Forge a blade from the fair's own iron: heat it, hammer it, quench it. The judges keep it." },
    fish: { name: "Fishing derby", icon: "\uE146", game: "fish", skills: [], max: 120, what: "Three casts with a borrowed rod. Rare fish score most. You keep what you catch." },
    hunt: { name: "The hunt", icon: "\uE115", game: "precise", skills: ["Archery", "Sneak"], max: 140, what: "The huntsmen drive a beast past your hide. Take one clean shot. Bigger game, more points." },
    mine: { name: "Mining race", icon: "\uE12A", game: "mine", skills: ["Smithing"], max: 110, what: "One rock face and a borrowed pick. Ore and gems score points. You keep what you dig." },
    drink: { name: "Drinking contest", icon: "\uE15A", game: "drink", skills: [], max: 120, what: "Mug after mug of mead. Stop while you can still stand, or end up under the table." },
    pit: { name: "Grand Arena", icon: "\uE11F", fight: true, skills: [], max: 850, what: "Rounds of monsters in the Pit, alone or with your party. Each round is harder. The healers patch you up a little between rounds." },
  };
  const GRADE = { botched: 10, rough: 30, good: 55, great: 75, masterful: 90, perfect: 100 };
  const FISH_RARE = new Set(["fish_spadetail", "fish_longfin", "fish_betty", "fish_perch"]), FISH_JUNK = new Set(["fish_slaughterfish", "fish_mudcrab"]);
  const ORE = { ore_iron: 8, ore_corundum: 10, ore_silver: 14, ore_moonstone: 16, ore_gold: 20, ore_quicksilver: 18, ore_orichalcum: 18, ore_malachite: 22, ore_ebony: 30 };
  const NPC = ["Hrolfdir", "Torvar", "Ysolda", "Brina", "Eorlund", "Mjoll", "Uthgerd", "Njada", "Athis", "Faendal", "Aela", "Vilkas", "Hulda", "Sven", "Camilla", "Gerdur", "Bolli", "Lami", "Hroki", "Dravynea", "Erik", "Adrianne"];

  // ---------------------------------------------------------------- prizes (small: looks and bragging rights)
  const TROPHY = { duel: "Duelling Cup", archery: "Silver Arrow", joust: "Gilded Tilting Ring", smith: "Golden Anvil", fish: "Golden Hook", hunt: "Mounted Antlers", mine: "Gilded Pick", drink: "Bottomless Tankard", pit: "Pit Champion's Skull" };
  function addItems() {
    if (typeof D === "undefined" || !D.ITEMS) return;
    const add = (id, o) => { if (!D.ITEMS[id]) D.ITEMS[id] = o; };
    for (const [k, n] of Object.entries(TROPHY)) add("trophy_" + k, { name: n, slot: "trophy", weight: 1, value: 60, desc: "A festival prize. Worth more on your shelf than at the trader's." });
    add("fest_ribbon", { name: "Festival Ribbon", slot: "trophy", weight: 0.1, value: 10, desc: "Second or third place. Someone has to be." });
    add("fest_tourney_sword", { name: "Ceremonial Tourney Sword", slot: "weapon", hands: 1, skill: "One-Handed", damage: 7, weight: 9, value: 120, desc: "A gilded hilt and a blunt parade edge. For processions, not battles." });
    add("fest_harvest_crown", { name: "Harvest Crown", slot: "head", type: "cloth", armor: 1, weight: 0.5, value: 80, desc: "A wreath of wheat and snowberries, woven by the fair's judges." });
    add("fest_derby_cap", { name: "Angler's Cap", slot: "head", type: "cloth", armor: 1, weight: 0.5, value: 80, desc: "Waxed against the spray of Lake Honrich. The hook on the brim is real." });
    add("fest_hunt_bow", { name: "Hunt-Master's Bow", slot: "weapon", hands: 2, skill: "Archery", damage: 7, weight: 7, value: 120, desc: "Carved with stags and pine. Shoots no better than a hunting bow, but looks far better doing it." });
    add("fest_forge_hammer", { name: "Forgefire Hammer", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 13, weight: 20, value: 140, desc: "Silver-banded and too pretty to hit anything with." });
    add("fest_olaf_mask", { name: "King Olaf Effigy Mask", slot: "head", type: "cloth", armor: 1, weight: 1, value: 80, desc: "Straw and painted leather. Everyone in Solitude knows the face." });
    add("fest_midwinter_circlet", { name: "Midwinter Circlet", slot: "head", type: "cloth", armor: 1, weight: 0.5, value: 90, desc: "Pale silver set with a chip of ice-blue glass." });
    add("fest_pit_axe", { name: "Pit Champion's Axe", slot: "weapon", hands: 1, skill: "One-Handed", damage: 9, weight: 12, value: 150, desc: "Notched by a hundred Pit fights. The crowd chants your name when you carry it." });
  }
  addItems();

  // ---------------------------------------------------------------- the calendar
  const slotAt = (t = nowMs()) => Math.floor((t - EPOCH) / SLOT);
  const festOfSlot = (n) => FESTS[((n % FESTS.length) + FESTS.length) % FESTS.length];
  function occ(n) {
    const f = festOfSlot(n), start = EPOCH + n * SLOT;
    return { ...f, fid: f.id, key: `${f.id}-${n}`, slot: n, start, end: start + RUN, hold: typeof G !== "undefined" && typeof WORLD !== "undefined" && WORLD.places[f.place] ? G.holdAt(WORLD.places[f.place]) : null };
  }
  /* the festival on right now, or null (the quiet day between two) */
  function current(t = nowMs()) { const o = occ(slotAt(t)); return t < o.end ? o : null; }
  /* the next festival to start */
  function next(t = nowMs()) { return occ(slotAt(t) + 1); }
  function upcoming(t = nowMs(), n = 3) { const s0 = slotAt(t) + 1; return Array.from({ length: n }, (_, i) => occ(s0 + i)); }
  /* announced: on now, or starting within a day (shown on the map and notice boards) */
  function announced(t = nowMs()) { const c = current(t); if (c) return { ...c, on: true }; const nx = next(t); return nx.start - t <= ANNOUNCE ? { ...nx, on: false } : null; }
  const byKey = (fk) => { const m = /^(\w+)-(-?\d+)$/.exec(fk || ""); if (!m || !BY_ID[m[1]]) return null; const o = occ(+m[2]); return o.fid === m[1] ? o : null; };
  const pitWeek = (t = nowMs()) => Math.floor((t - EPOCH) / WEEK);
  const pitKey = (t = nowMs()) => `pit-${pitWeek(t)}`;
  const pitEnds = (wk) => EPOCH + (wk + 1) * WEEK;
  const isPit = (fk) => /^pit-/.test(fk || "");
  const endsOf = (fk) => (isPit(fk) ? pitEnds(+fk.slice(4)) : byKey(fk)?.end ?? 0);
  const contestsOf = (fk) => (isPit(fk) ? ["pit"] : byKey(fk)?.contests || []);
  const peaceAt = (place, t = nowMs()) => { const c = current(t); return !!(c && place && c.place === place); };
  const here = (s, place) => !!s && s.location === place && !s.trip && !s.dungeon;

  // ---------------------------------------------------------------- your entries (save) and the shared records
  function st(s) {
    if (!s.tourney || typeof s.tourney !== "object") s.tourney = {};
    const T = s.tourney;
    T.e = T.e || {}; T.claimed = T.claimed || {}; T.got = T.got || {};
    if (!T.rep) T.rep = { k: "self" };
    return T;
  }
  function entry(s, fk, make = true) {
    const T = st(s);
    if (!T.e[fk] && make) {
      T.e[fk] = { sc: {}, tt: {}, tries: {}, duels: [], rep: { ...T.rep } };
      const keys = Object.keys(T.e);
      if (keys.length > KEEP) for (const k of keys.sort((a, b) => endsOf(a) - endsOf(b)).slice(0, keys.length - KEEP)) { delete T.e[k]; delete T.claimed[k]; }
    }
    return T.e[fk] || null;
  }
  const triesLeft = (s, fk, kind) => TRIES - ((entry(s, fk, false)?.tries || {})[kind] || 0);
  /* who you stand for: yourself, your clan, or a hold */
  function setRep(s, k, hold) {
    const T = st(s);
    if (k === "clan") {
      const c = typeof CLANS !== "undefined" ? CLANS.of(s.id, s) : null;
      if (!c) return { err: "You're not in a clan." };
      T.rep = { k: "clan", id: c.id, name: c.name, tag: c.tag, color: (c.colors || [])[0] || null };
    } else if (k === "hold") {
      const h = hold && typeof WORLD !== "undefined" && WORLD.holds[hold] ? hold : null;
      if (!h) return { err: "Pick a hold." };
      T.rep = { k: "hold", name: h };
    } else T.rep = { k: "self" };
    const c = current(); if (c && T.e[c.key]) T.e[c.key].rep = { ...T.rep };   // switching mid-festival moves your glory with you
    const p = pitKey(); if (T.e[p]) T.e[p].rep = { ...T.rep };
    return { text: T.rep.k === "self" ? "You compete for yourself." : T.rep.k === "clan" ? `You compete for ${T.rep.name} [${T.rep.tag}].` : `You compete for ${T.rep.name}.` };
  }
  const repName = (r) => (!r || r.k === "self" ? "" : r.k === "clan" ? `[${r.tag}]` : r.name);
  const titleOf = (s) => st(s).title || null;
  /* the record everyone else sees for one festival (or Pit week) */
  function record(s, fk, t = nowMs()) {
    const e = entry(s, fk, false); if (!e) return null;
    const o = { uid: s.id, name: s.name, fk, rep: e.rep || { k: "self" }, sc: { ...e.sc }, tt: { ...e.tt }, duels: e.duels.slice(-12), t };
    if (titleOf(s)) o.title = titleOf(s);
    if (typeof CIVILWAR !== "undefined") { try { const sd = CIVILWAR.side(s); if (sd) o.side = sd; } catch { /* fine */ } }
    if (e.team && e.team.length) o.team = e.team.slice(0, 8);
    const c = current(t);
    if (!isPit(fk) && c && c.key === fk && st(s).open !== false && typeof ARENA !== "undefined") { try { o.snap = ARENA.snapshot(s); } catch { /* fine */ } }   // so other players can duel your festival entry
    return o;
  }
  let docs = [];
  function setDocs(list) { docs = (list || []).filter((d) => d && d.uid && d.fk); return docs; }
  const docsFor = (fk, list = docs) => list.filter((d) => d && d.fk === fk);

  // ---------------------------------------------------------------- scores
  const skillOf = (s, list) => (list && list.length ? list.reduce((a, k) => a + (G.skill(s, k) || 0), 0) / list.length : 50);
  const bestSkill = (s, list) => Math.max(15, ...list.map((k) => G.skill(s, k) || 0));
  const skillMult = (sk) => 0.75 + 0.5 * clamp(sk, 0, 100) / 100;
  const sportMult = (s) => 1 + Math.min(0.3, pf(s, "sport"));
  const arenaPerk = (s) => Math.min(0.2, pf(s, "arenafight"));
  const fishPts = (id) => (FISH_JUNK.has(id) ? 8 : FISH_RARE.has(id) ? 40 : 25);
  /* a contest result -> points. res: { grade } | { fish: [ids] } | { got: {ore: n} } | { mugs, fell } | { won, hp, dealt } | { rounds, hp } */
  function score(kind, s, res = {}) {
    const C = CONTESTS[kind]; if (!C) return 0;
    let v = 0;
    switch (kind) {
      case "archery": case "smith": v = (GRADE[res.grade] ?? GRADE.good) * skillMult(skillOf(s, C.skills)); break;
      case "joust": v = (GRADE[res.grade] ?? GRADE.good) * skillMult(skillOf(s, C.skills)) * (s.horse ? 1.05 : 1); break;
      case "hunt": v = (GRADE[res.grade] ?? GRADE.good) * skillMult(skillOf(s, C.skills)) * (1 + 0.04 * clamp(res.level || 2, 1, 6)); break;
      case "fish": v = (res.fish || []).slice(0, 3).reduce((a, id) => a + (id ? fishPts(id) : 0), 0); break;
      case "mine": v = res.got ? Object.entries(res.got).reduce((a, [it, n]) => a + (ORE[it] || (/^gem_|_gem$|^mat_(ruby|sapphire|emerald|diamond|amethyst|garnet)/.test(it) ? 25 : 10)) * (+n || 0), 0) : 45 * skillMult(skillOf(s, C.skills)); v = Math.min(150, v); break;
      case "drink": v = (res.mugs || 0) * 12 + (res.fell ? 0 : 15); break;
      case "duel": return Math.round((res.won ? 60 + 40 * clamp(res.hp ?? 0, 0, 1) : 40 * clamp(res.dealt ?? 0, 0, 1)) * (1 + arenaPerk(s) * 0.5));
      case "pit": return Math.round(((res.rounds || 0) * 100 + 50 * clamp(res.hp ?? 0, 0, 1)) * (1 + arenaPerk(s)));
    }
    return Math.round(v * sportMult(s));
  }
  /* four local champions per contest, the same on every phone */
  function rivals(fk, kind) {
    const r = rng(hash(fk + "|" + kind)), names = [...NPC], out = [], max = CONTESTS[kind]?.max || 100;
    for (let i = 0; i < 4; i++) {
      const name = names.splice(Math.floor(r() * names.length), 1)[0];
      out.push({ id: "npc:" + name, name, score: Math.round(max * (0.35 + 0.4 * r())), npc: true });
    }
    return out;
  }
  /* one contest's board: real players (shared records + you) and the local champions, best first */
  function board(fk, kind, list = docs, s = null) {
    const mine = s ? record(s, fk) : null;
    const all = [...docsFor(fk, list).filter((d) => !s || d.uid !== s.id), ...(mine ? [mine] : [])];
    const rows = [];
    const seen = new Set();
    for (const d of all.sort((a, b) => (b.t || 0) - (a.t || 0))) {   // a player's newest record wins if two copies are around
      if (seen.has(d.uid)) continue; seen.add(d.uid);
      const v = d.sc?.[kind];
      if (typeof v === "number" && isFinite(v)) rows.push({ id: d.uid, name: d.name, rep: d.rep || null, title: d.title || null, side: d.side || null, team: d.team || null, score: Math.round(v), t: d.tt?.[kind] || d.t || 0 });
    }
    rows.push(...rivals(fk, kind));
    return rows.sort((a, b) => b.score - a.score || (a.npc ? 1 : 0) - (b.npc ? 1 : 0) || (a.t || 0) - (b.t || 0) || String(a.id).localeCompare(String(b.id)));
  }
  const rankOf = (rows, uid) => rows.findIndex((r) => r.id === uid);
  /* hold and clan glory for one festival: places on the boards and friendly duels won */
  const GLORY = [5, 3, 2];
  function glory(fk, list = docs, s = null) {
    const holds = {}, clans = {};
    const bump = (rep, n) => {
      if (!rep || !n) return;
      if (rep.k === "hold" && rep.name) holds[rep.name] = (holds[rep.name] || 0) + n;
      if (rep.k === "clan" && rep.id) { const c = clans[rep.id] || (clans[rep.id] = { name: rep.name, tag: rep.tag, color: rep.color, pts: 0 }); c.pts += n; }
    };
    const reps = {};
    for (const kind of contestsOf(fk)) board(fk, kind, list, s).forEach((r, i) => { if (!r.npc) { reps[r.id] = r.rep; bump(r.rep, GLORY[i] ?? 1); } });
    const all = [...docsFor(fk, list).filter((d) => !s || d.uid !== s.id), ...(s && entry(s, fk, false) ? [record(s, fk)] : [])];
    for (const d of all) { reps[d.uid] = reps[d.uid] || d.rep; bump(d.rep, Math.min(PAIR_MAX * 4, (d.duels || []).filter((x) => x.won).length)); }
    return { holds: Object.entries(holds).map(([name, pts]) => ({ name, pts })).sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name)),
      clans: Object.entries(clans).map(([id, c]) => ({ id, ...c })).sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name)) };
  }

  // ---------------------------------------------------------------- taking part
  /* can you try this contest now? -> null or why not */
  function why(s, kind, t = nowMs()) {
    const c = current(t);
    if (!c) return "No festival is on right now.";
    if (!c.contests.includes(kind)) return "That isn't part of this festival.";
    if (!here(s, c.place)) return `Go to ${c.place} for ${c.name}.`;
    if (triesLeft(s, c.key, kind) <= 0) return "You've had your three tries.";
    if (CONTESTS[kind].horse && (!s.horse || (typeof HORSES !== "undefined" && HORSES.downed && HORSES.downed(s)))) return "You need your own horse, on its feet.";
    return null;
  }
  /* write down a try: best one counts */
  function submit(s, kind, res, t = nowMs()) {
    const c = current(t);
    const no = why(s, kind, t); if (no) return { err: no };
    const e = entry(s, c.key);
    e.tries[kind] = (e.tries[kind] || 0) + 1;
    const v = score(kind, s, res), best = e.sc[kind];
    const better = best == null || v > best;
    if (better) { e.sc[kind] = v; e.tt[kind] = t; }
    s.stats = { ...(s.stats || {}), festTries: ((s.stats || {}).festTries || 0) + 1 };
    const left = TRIES - e.tries[kind];
    return { score: v, best: e.sc[kind], better, left, fk: c.key, text: `${CONTESTS[kind].name}: ${v} points.${better && best != null ? " A new best!" : best != null && !better ? ` Your best is still ${best}.` : ""} ${left > 0 ? `${left} ${left === 1 ? "try" : "tries"} left.` : "That was your last try."}` };
  }

  // ---- drinking contest (push your luck)
  function tolerance(s) {
    return clamp((G.maxStamina(s) - 100) / 600, 0, 0.2) + (["nord", "orc"].includes(s.race) ? 0.06 : 0) + Math.min(0.1, pf(s, "sport") * 0.5);
  }
  const steady = (s, mugs) => clamp(0.97 - 0.085 * mugs + tolerance(s), 0.1, 0.97);
  /* one more mug: { mugs, fell } */
  function drinkStep(s, d, rnd = Math.random) {
    if (d.fell || d.done) return d;
    if (rnd() < steady(s, d.mugs)) d.mugs++; else { d.fell = true; d.done = true; }
    return d;
  }

  // ---- the hunt: what the huntsmen drive past
  function prey(seed) {
    const list = typeof HUNT !== "undefined" ? HUNT.PREY : [["Deer", 5, 2], ["Elk", 4, 4]];
    const r = rng(hash(seed))(), total = list.reduce((a, p) => a + p[1], 0);
    let x = r * total; for (const p of list) { if ((x -= p[1]) <= 0) return { name: p[0], level: p[2] }; }
    return { name: list[0][0], level: list[0][2] };
  }

  // ---- friendly fights: always on a throwaway copy of you, so nothing you wear breaks or goes missing, no bounty, nobody dies
  function friendly(s, hpFrac = 1, keepFollower = false) {
    const c = JSON.parse(JSON.stringify(s));
    Object.assign(c, { _test: true, trip: null, dungeon: null, poison: null, thrall: null, bounty: c.bounty });
    if (!keepFollower) c.follower = null;
    const ts = gnow();
    c.health = Math.max(1, G.maxHealth(c) * clamp(hpFrac, 0.05, 1)); c.healthTs = ts;
    return c;
  }
  function learn(s, f) {   // practice fights teach half as much
    const msgs = [];
    for (const [k, v] of Object.entries(f.xp || {})) if (s.skills[k] && v > 0) msgs.push(...G.useSkill(s, k, v * 0.5));
    return msgs;
  }
  const CHAMPS = [["Tourney knight", 95, 11], ["Sellsword champion", 110, 12], ["Jarl's housecarl", 125, 13]];
  function duelFoe(s, fk, n) {
    const lv = typeof G.fightLevel === "function" ? G.fightLevel(s) : s.level || 1;
    const [name, hp, dmg] = CHAMPS[Math.min(n, CHAMPS.length - 1)];
    const e = G.scaleEnemy({ name, level: Math.max(1, lv - 2), health: hp, damage: dmg, tags: ["humanoid"], danger: "medium", gold: [0, 0], holds: null, text: "" }, lv);
    const w = arenaPerk(s); if (w) { e.health = Math.round(e.health * (1 - w)); e.damage = Math.max(1, Math.round(e.damage * (1 - w) * 10) / 10); }
    e.hp = e.health; e.hitCap = 0.5; e.friendly = true;   // a festival bout: no one-shots
    return e;
  }
  /* a festival bout against a champion. Returns what the fight screen shows. */
  function playDuel(s, t = nowMs()) {
    const no = why(s, "duel", t); if (no) return { err: no };
    const c = current(t), n = (entry(s, c.key).tries.duel || 0);
    const e = duelFoe(s, c.key, n), me = friendly(s, 1), ts = gnow();
    const f = new G.Fight(me, e, null, ts);
    f.allies = []; f.nonlethal = true; f.friendly = true;
    const max = G.maxHealth(me), ehp0 = e.health;
    f.run({ t: ts, trySneak: false });
    const res = { won: !!f.won, hp: Math.max(0, f.hp) / max, dealt: clamp(1 - Math.max(0, f.ehp) / ehp0, 0, 1) };
    const skills = learn(s, f), r = submit(s, "duel", res, t);
    return { fight: f, skills, loot: [], gold: 0, title: f.won ? "The crowd cheers" : "Yielded", score: r.score,
      text: `${f.won ? `${e.name} yields.` : `You yield to ${e.name}.`} Nobody gets hurt for real at a festival: the healers patch you both up. ${r.text || ""}`.trim() };
  }
  /* a friendly duel with another player's festival entry (their gear, perks and tactics), on the Arena's duel engine */
  function pvp(s, doc, t = nowMs()) {
    const c = current(t);
    if (!c || !doc || doc.fk !== c.key) return { err: "They aren't at this festival." };
    if (!here(s, c.place)) return { err: `Go to ${c.place} for ${c.name}.` };
    if (doc.uid === s.id) return { err: "You can't duel yourself." };
    if (!doc.snap) return { err: `${doc.name} isn't taking duels.` };
    const e = entry(s, c.key), n = e.duels.filter((d) => d.vs === doc.uid).length;
    if (n >= PAIR_MAX) return { err: `You've had your ${PAIR_MAX} bouts with ${doc.name} at this festival.` };
    const f = ARENA.duel(doc.snap, ARENA.snapshot(s), `${c.key}|${s.id}|${doc.uid}|${n}`, Math.floor(t / 1000));
    f.e = { name: doc.name, tags: ["humanoid"], player: true }; f.nonlethal = true; f.friendly = true;
    e.duels.push({ vs: doc.uid, vn: doc.name, won: !!f.won, t });
    const sides = doc.side && typeof CIVILWAR !== "undefined" && CIVILWAR.side(s) && doc.side !== CIVILWAR.side(s);
    return { fight: f, loot: [], gold: 0, skills: [], won: !!f.won, title: f.won ? "A friendly win" : "A friendly loss",
      text: `${f.won ? `${doc.name} goes down on one knee and laughs.` : `You end up on one knee. ${doc.name} offers you a hand up.`}${sides ? " Enemies in the war, friends at the festival: no bounty, no grudges." : " No bounty, no grudges."}` };
  }
  /* other players' duels against you (from their records): [{ by, name, won (they won), t }] */
  function duelsOn(s, fk, list = docs) {
    const out = [];
    for (const d of docsFor(fk, list)) if (d.uid !== s.id) for (const x of d.duels || []) if (x.vs === s.id) out.push({ by: d.uid, name: d.name, won: !!x.won, t: x.t });
    return out.sort((a, b) => a.t - b.t);
  }
  /* your friendly-duel record at a festival: wins and losses either way round */
  function duelRecord(s, fk, list = docs) {
    const e = entry(s, fk, false), mine = e ? e.duels : [], theirs = duelsOn(s, fk, list);
    return { w: mine.filter((d) => d.won).length + theirs.filter((d) => !d.won).length, l: mine.filter((d) => !d.won).length + theirs.filter((d) => d.won).length };
  }

  // ---------------------------------------------------------------- the Grand Arena (the Pit)
  const PIT = [
    ["Arena wolves", 70, 9, ["beast", "animal"]], ["Sabre cat", 85, 12, ["beast"]], ["Cave bear", 110, 14, ["beast"]], ["Draugr wight", 120, 15, ["undead", "humanoid"]],
    ["Frost troll", 150, 16, ["beast", "troll"]], ["Hagraven", 130, 17, ["humanoid"]], ["Giant", 210, 21, ["giant", "big"]], ["The Pit's champion", 230, 21, ["humanoid", "elite"]],
  ];
  function pitSt(s, t = nowMs()) { const T = st(s); if (!T.pit || T.pit.fk !== pitKey(t)) T.pit = { fk: pitKey(t), run: null }; return T.pit; }
  function pitFoe(s, r, n = 1) {
    const lv = typeof G.fightLevel === "function" ? G.fightLevel(s) : s.level || 1;
    const [name, hp, dmg, tags] = PIT[Math.min(r, PIT_ROUNDS) - 1];
    const e = G.scaleEnemy({ name, level: Math.max(1, lv - 4 + r), health: hp, damage: dmg, tags: [...tags], danger: r > 5 ? "high" : "medium", gold: [0, 0], holds: null, text: "" }, lv);
    const party = 1 + 0.6 * (n - 1), w = arenaPerk(s);
    e.health = Math.round(e.health * (0.8 + 0.08 * r) * party * (1 - w));
    e.damage = Math.max(1, Math.round(e.damage * (0.85 + 0.04 * r) * (1 + 0.15 * (n - 1)) * (1 - w) * 10) / 10);
    e.hp = e.health; e.hitCap = 0.5; e.friendly = true; e.round = r;
    return e;
  }
  /* can you fight the next round? role: "solo" | "leader" | "member" */
  function pitWhy(s, role = "solo") {
    if (!here(s, PIT_TOWN)) return `The Grand Arena is in ${PIT_TOWN}.`;
    if (role === "member") return "Your party leader starts the Grand Arena rounds for everyone.";
    return null;
  }
  /* fight the next round. allies: fighters beside you (party members close by, as the fight code builds them). */
  function pitRound(s, ctx = {}, t = nowMs()) {
    const no = pitWhy(s, ctx.role); if (no) return { err: no };
    const P = pitSt(s, t), allies = (ctx.allies || []).slice(0, 10), mates = allies.filter((a) => a && (a.party || a.player)).slice(0, 7);
    if (!P.run) P.run = { r: 1, hp: 1, team: mates.map((c) => c.name), at: t };
    const run = P.run, n = 1 + mates.length, e = pitFoe(s, run.r, n), me = friendly(s, run.hp, true), ts = gnow();
    const f = new G.Fight(me, e, null, ts);
    f.nonlethal = true; f.friendly = true;
    for (const a of allies) if (a) f.allies.push({ ...a });
    const max = G.maxHealth(me);
    f.run({ t: ts, trySneak: false });
    const skills = learn(s, f), round = run.r;
    let text, done = false;
    if (f.won) {
      run.hp = clamp(Math.max(0, f.hp) / max + PIT_HEAL, 0.05, 1);
      run.r++;
      if (run.r > PIT_ROUNDS) { done = true; text = `${e.name} falls and the Pit roars. You've beaten every round!`; }
      else text = `Round ${round} won: ${e.name} is dragged out. The healers patch you up a little. Round ${run.r} is next.`;
    } else { done = true; run.hp = 0; text = `${e.name} beats you down in round ${round}. The arena master calls it, and the healers carry you out. Nobody dies in the Pit.`; }
    let r = null;
    if (done) r = pitFinish(s, t);
    return { fight: f, skills, loot: [], gold: 0, round, won: !!f.won, done, score: r?.score, title: f.won ? (done ? "Champion of the rounds" : `Round ${round} won`) : "Carried out of the Pit", text: r ? `${text} ${r.text}` : text };
  }
  /* end your run (beaten, finished, or walking out on your feet) and write down the score */
  function pitFinish(s, t = nowMs()) {
    const P = pitSt(s, t); if (!P.run) return { err: "You're not in a run." };
    const rounds = P.run.r - 1, res = { rounds, hp: P.run.hp }, v = score("pit", s, res);
    const e = entry(s, P.fk), best = e.sc.pit, better = best == null || v > best;
    e.tries.pit = (e.tries.pit || 0) + 1;
    if (better) { e.sc.pit = v; e.tt.pit = t; e.team = P.run.team || []; }
    P.run = null;
    s.stats = { ...(s.stats || {}), pitRounds: Math.max((s.stats || {}).pitRounds || 0, rounds) };
    return { score: v, better, rounds, text: `${rounds} ${rounds === 1 ? "round" : "rounds"}: ${v} points${better && best != null ? ", a new best this week" : best != null && !better ? ` (your best this week is ${best})` : ""}.` };
  }

  // ---------------------------------------------------------------- prizes
  /* finished festivals (and Pit weeks) you took part in and haven't claimed */
  function claimable(s, t = nowMs()) {
    const T = st(s);
    return Object.keys(T.e).filter((fk) => !T.claimed[fk] && endsOf(fk) <= t && Object.keys(T.e[fk].sc || {}).length + (T.e[fk].duels || []).length > 0)
      .sort((a, b) => endsOf(a) - endsOf(b));
  }
  /* -> { text, lines, gold, items, titles } */
  function claim(s, fk, list = docs, t = nowMs()) {
    const T = st(s), e = T.e[fk];
    if (!e || T.claimed[fk]) return { err: "Nothing to collect." };
    if (endsOf(fk) > t) return { err: "Prizes are handed out when it's over." };
    const fest = isPit(fk) ? null : byKey(fk), crowd = Math.min(1, pf(s, "crowdfav")), podium = crowd ? 5 : 3;
    let gold = 0; const items = [], titles = [], lines = [];
    let firsts = 0;
    for (const kind of contestsOf(fk)) {
      if (e.sc[kind] == null) continue;
      const rows = board(fk, kind, list, s), i = rankOf(rows, s.id), C = CONTESTS[kind];
      if (i === 0) {
        firsts++; gold += kind === "pit" ? 150 : 100; items.push(["trophy_" + kind, 1]);
        const title = fest ? fest.title : "Champion of the Pit"; if (!titles.includes(title)) titles.push(title);
        lines.push(`${C.icon} ${C.name}: 1st place!`);
      } else if (i > 0 && i < podium) {
        gold += i < 3 ? 50 : 30; items.push(["fest_ribbon", 1]);
        lines.push(`${C.icon} ${C.name}: ${ord(i + 1)} place.`);
      } else { gold += 15; lines.push(`${C.icon} ${C.name}: ${ord(i + 1)} place. Thanks for taking part.`); }
    }
    const dw = Math.min(PAIR_MAX, (e.duels || []).filter((d) => d.won).length);
    if (dw) { gold += 10 * dw; lines.push(`\uE101 ${dw} friendly duel${dw > 1 ? "s" : ""} won.`); }
    if (firsts) {
      const prize = fest ? fest.prize : "fest_pit_axe";
      if (!T.got[prize] && D.ITEMS[prize]) { items.push([prize, 1]); T.got[prize] = t; lines.push(`A ceremonial prize: ${D.ITEMS[prize].name}.`); }
      else gold += 50;
    }
    gold = Math.round(gold * (1 + crowd));
    s.gold += gold;
    for (const [it, q] of items) if (D.ITEMS[it]) G.give(s, it, q);
    for (const ti of titles) { if (!(s.titles || []).includes(ti)) s.titles = [...(s.titles || []), ti]; T.title = ti; }
    T.claimed[fk] = t;
    s.stats = { ...(s.stats || {}), festWins: ((s.stats || {}).festWins || 0) + firsts };
    const what = fest ? fest.name : "The Grand Arena week";
    return { gold, items, titles, lines, text: `${what}: ${gold} gold${items.length ? `, ${items.map(([it]) => D.ITEMS[it]?.name || it).join(", ")}` : ""}${titles.length ? `, and the title ${titles.join(" and ")}` : ""}.` };
  }

  // ---------------------------------------------------------------- festival peace: no player attacks in a festival town
  if (typeof MP !== "undefined" && typeof MP.canTarget === "function" && !MP.canTarget.tourney) {
    const orig = MP.canTarget;
    MP.canTarget = function (s, card, ...rest) {
      const c = current();
      if (c && (s?.location === c.place || card?.loc === c.place)) return `Festival peace in ${c.place} while ${c.name} is on. Challenge them to a friendly duel at the festival instead.`;
      return orig.call(this, s, card, ...rest);
    };
    MP.canTarget.tourney = true;
  }

  return { DAY, SLOT, RUN, ANNOUNCE, EPOCH, TRIES, PIT_TOWN, PIT_ROUNDS, PAIR_MAX, FESTS, CONTESTS, GRADE, TROPHY,
    slotAt, occ, current, next, upcoming, announced, byKey, pitKey, pitWeek, pitEnds, isPit, endsOf, contestsOf, peaceAt, here,
    st, entry, triesLeft, setRep, repName, titleOf, record, setDocs, docsFor, get docs() { return docs; },
    score, rivals, board, rankOf, glory, why, submit, steady, tolerance, drinkStep, prey, friendly, duelFoe, playDuel, pvp, duelsOn, duelRecord,
    pitSt, pitFoe, pitWhy, pitRound, pitFinish, claimable, claim, ord, hash, rng };
})();
