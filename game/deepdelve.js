/* Deep expeditions and dungeon difficulty tiers [OURS] (Roads of the North).
   A) Deep expeditions. Deadly dungeons (tier 3, not giant camps or dragon lairs) go deeper. When their master falls you
      make camp at the top of the stairs and choose: Extract (climb out with everything), Rest (costs a ration) or
      Descend. Five levels: I Entrance guardians, II Traps and elites, III The ancient vault, IV The cursed sanctuary,
      V The legendary lair. Each level is a short map of rooms that ends in a major fight; after it, the camp again.
      - Health, potions, injuries and curses carry from level to level (there is no natural healing down there).
        A major fight that leaves you under half health gives you an injury (max 3); level III may and level IV always
        lays a curse on you. They last until you climb out.
      - What you find below the first level is "unsecured" until you extract. Knocked down there costs nothing (the
        fight is rolled back, defeat.js); walking out without extracting leaves the finds behind. In a party the
        shared loot pile goes back to how it was at the top of the stairs if the run leaves without extracting.
        Followers and horses are knocked down, never killed (the fight engine already does that).
      - Rewards climb steeply: gold from chests and the camp chest after each major fight scale with depth.
   B) Difficulty tiers for level 30+: Veteran / Legendary / Mythic for any dungeon, with 1 / 2 / 3 modifiers that you
      see before you go in (picked per dungeon per week, the same for everyone): Frozen Depths, Restless Dead, Dwemer
      Overcharge, Blood Moon, Arcane Instability, Ancient Darkness, Cursed Sanctuary, Relentless Hunt.
   Fights: DEEPDELVE.fight(f) wraps one Fight (engine.js) with the modifiers, injuries and curses; DEEPDELVE.tick(f, line)
   runs once a turn. Perks (real effects): Dungeon Veteran (Athletics), Deep Delver (Lockpicking), and the old Pathfinder (Athletics) now also
   finds the way out of the depths.
   Party: the leader's tier goes on the run record (coop.js); the camp choice is a normal party vote (partyvote.js);
   every phone builds the same deeper level from a seeded roll. Pure logic up top (node-testable), screens at the end. */
const DEEPDELVE = (() => {
  const MAX_DEPTH = 5, TIER_LEVEL = 30, MAX_INJ = 3;
  const DEPTH_NAME = ["", "Entrance guardians", "Traps and elites", "The ancient vault", "The cursed sanctuary", "The legendary lair"];
  const ROMAN = ["", "I", "II", "III", "IV", "V"];
  // [OURS] balanced with tests/test_deepdelve_bal_sim.js: foes grow +15% health / +6% damage per depth level
  const DEPTH_HP = 0.15, DEPTH_DMG = 0.06;
  const DEPTH_GOLD = [1, 1.6, 2.6, 4, 6, 10];          // gold you find, by depth (rewards rise steeply)
  const MAJOR_HP = [1, 2.2, 1.35, 1.2, 1.15, 1.15];     // the major fight that ends each level (the first two were over in under 10 turns)
  const HIT_CAP = 0.4;                                   // no deep or tiered foe takes more than 40% of your health in one blow
  /* re-balanced for 4-moves-per-turn fights (depth V major fight, level 30): solo + follower about 90 / 65 / 30 / 10% wins,
     a 4-player party about 100 / 100 / 80 / 55%. Modifiers (1 / 2 / 3) do much of the work, so the numbers stay modest.
     party: [health, damage] the foe gains per extra party member on top of coop.js FOE_BONUS (see partyFoe) */
  const TIERS = {
    normal: { name: "Normal", n: 0, hp: 1, dmg: 1, gold: 1, party: null },
    veteran: { name: "Veteran", n: 1, hp: 1.12, dmg: 1.04, gold: 1.5, party: [0.08, 0.03] },
    legendary: { name: "Legendary", n: 2, hp: 1.33, dmg: 1.1, gold: 2.25, party: [0.22, 0.06] },
    mythic: { name: "Mythic", n: 3, hp: 1.43, dmg: 1.13, gold: 3.5, party: [0.12, 0.09] },
  };
  /* [OURS] engine.js grows foe health faster than your damage past level 30 (x1.6 at 30, x2.2 at 40), so deep and tiered
     foes stacked on top took ever longer to kill: a level-40 hero won fewer deep fights than a level-30 one (63% vs 93%).
     Past level 30 they give some of that back: -5.5% health and -1% damage per level over 30 (divided, never below zero). */
  const LV_BASE = 30, LV_EASE = 0.055, LV_EASE_DMG = 0.01;
  const lvOver = (s) => Math.max(0, (typeof G !== "undefined" && G.fightLevel ? G.fightLevel(s) : s?.level || 1) - LV_BASE);
  const lvEase = (s, k = LV_EASE) => 1 / (1 + k * lvOver(s));
  const TIER_KEYS = ["normal", "veteran", "legendary", "mythic"];
  const MODS = {
    frost: { icon: "", name: "Frozen Depths", desc: "Frost builds up on you every turn and drains stamina; at 5 stacks it bites for 5% of your health. Fire spells thaw you." },
    restless: { icon: "", name: "Restless Dead", desc: "Undead get up once more at a third of their health, unless you finish them with fire or Restoration magic.", themes: ["barrow", "temple", "vampire"] },
    overcharge: { icon: "", name: "Dwemer Overcharge", desc: "Dwarven machines discharge every third turn: a shock that ignores armor and drains magicka.", themes: ["dwemer"] },
    bloodmoon: { icon: "", name: "Blood Moon", desc: "Bleeding is stronger for both sides: your bleeds hit 50% harder, and blows that land make you bleed too." },
    arcane: { icon: "", name: "Arcane Instability", desc: "One spell in four has a side effect: a surge, a backlash, a magicka drain or a little healing." },
    darkness: { icon: "", name: "Ancient Darkness", desc: "Foes are hidden until revealed: they strike first and your first two turns hit 30% softer. Candlelight, Detect Life or Pathfinder reveal them." },
    cursed: { icon: "", name: "Cursed Sanctuary", desc: "All healing is 40% weaker: potions, spells, rest spots and shrines." },
    hunt: { icon: "", name: "Relentless Hunt", desc: "Resting can bring an ambush (1 in 3): you fight first, then rest." },
  };
  const MOD_KEYS = Object.keys(MODS);
  const CURSES = {
    wither: { icon: "", name: "Withering curse", desc: "You take 10% more damage." },
    mark: { icon: "", name: "Sanctuary's mark", desc: "Healing is 30% weaker." },
  };
  const GEMS = ["gem_garnet", "gem_amethyst", "gem_ruby", "gem_sapphire", "gem_emerald", "gem_diamond", "gem_flawless_ruby", "gem_flawless_sapphire"];

  // ---------------------------------------------------------------- small helpers
  function hash(str) { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const rank = (s, id) => (typeof PERKS !== "undefined" && s?.perks ? PERKS.rank(s, id) : 0);
  const pfx = (s, k) => (typeof PFX !== "undefined" && s?.perks ? PFX.num(s, k) : 0);
  const week = (t = now()) => Math.floor(t / (7 * 86400));
  const dun = (s) => s?.dungeon || null;
  const depth = (s) => dun(s)?.deep?.level || 0;

  // ---------------------------------------------------------------- perks (appended to existing trees; ids never change)
  const PERK_ADD = [
    ["Athletics", "dungeon_veteran", "Dungeon Veteran", 2, [40, 70], ["long_strider"], "On a deep expedition, injuries and curses hurt 30/60% less, and you bring one more ration per rank. [OURS]", [["deepvet", 0.3, {}], ["deepration", 1, {}]]],
    ["Lockpicking", "deep_delver", "Deep Delver", 2, [50, 80], ["apprentice_locks"], "Better finds deeper down: +10/20% gold per depth level, and better odds for gear and gems in the camp chest. [OURS]", [["deepfind", 0.1, {}]]],
  ];
  if (typeof PERKS !== "undefined" && typeof PFX !== "undefined") for (const [sk, id, name, ranks, req, needs, desc, fx] of PERK_ADD) {
    const tree = PERKS.TREES[sk]; if (!tree || PERKS.BY_ID[id] || !needs.every((n) => PERKS.BY_ID[n])) continue;
    tree.push([id, name, ranks, req, needs, desc]); PERKS.BY_ID[id] = { id, name, ranks, req, needs, desc, skill: sk }; PFX.FX[id] = fx;
  }
  /* perks that already exist and grow with this system (same id, an extra real effect) */
  const PERK_ADJ = [["pathfinder", " Deep down you always know the way out: leave a deep expedition from any level and keep what you found, and Ancient Darkness can't hide foes from you.", [["deeppath", 1, {}]]]];
  if (typeof PERKS !== "undefined" && typeof PFX !== "undefined") for (const [id, more, fx] of PERK_ADJ) {
    const p = PERKS.BY_ID[id]; if (!p || (PFX.FX[id] || []).some(([k]) => k === fx[0][0])) continue;
    const desc = p.desc.includes(" [OURS]") ? p.desc.replace(" [OURS]", more + " [OURS]") : p.desc + more;
    const row = PERKS.TREES[p.skill]?.find((x) => x[0] === id); if (row) row[5] = desc;
    p.desc = desc; PFX.FX[id] = [...(PFX.FX[id] || []), ...fx];
  }
  const vetFactor = (s) => Math.max(0.3, 1 - Math.min(0.6, pfx(s, "deepvet")));   // how much injuries and curses still bite
  const hasPath = (s) => pfx(s, "deeppath") > 0;

  // ---------------------------------------------------------------- which dungeons, which tier, which modifiers
  function deepable(place) {
    if (typeof DUNGEONS === "undefined") return false;
    const i = DUNGEONS.info(place);
    return !!i && i.tier >= 3 && !!DUNGEONS.THEMES[i.theme] && i.theme !== "giantcamp" && i.theme !== "lair";
  }
  const tiersOpen = (s) => (s?.level || 0) >= TIER_LEVEL;
  /* this week's modifiers for a place, in the order they stack (Veteran takes the first, Mythic all three) */
  function modsFor(place, t = now()) {
    const i = typeof DUNGEONS !== "undefined" ? DUNGEONS.info(place) : null, th = i?.theme || "";
    const pool = MOD_KEYS.filter((k) => !MODS[k].themes || MODS[k].themes.includes(th));
    const r = rng(hash(`${place}|${week(t)}|mods`)), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  }
  const modsAt = (place, tier, t = now()) => modsFor(place, t).slice(0, TIERS[tier]?.n || 0);
  /* the tier you picked for this place (only counts from level 30) */
  function picked(s, place) { const p = s?.ddPick; return tiersOpen(s) && p && p.place === place && TIERS[p.tier] ? p.tier : "normal"; }
  function pick(s, place, tier) {
    if (!TIERS[tier]) return "That isn't a difficulty.";
    if (tier !== "normal" && !tiersOpen(s)) return `Veteran, Legendary and Mythic open at level ${TIER_LEVEL}.`;
    s.ddPick = tier === "normal" ? null : { place, tier };
    return null;
  }
  /* fields a co-op run carries so everyone plays the same tier (coop.js newRun) */
  function runFields(s, place, t = now()) { const tier = picked(s, place); return tier === "normal" ? {} : { dtier: tier, mods: modsAt(place, tier, t) }; }
  /* called when you step inside (DUNGEONS.enter, COOP.join) */
  function onEnter(s, run = null, t = now()) {
    const d = dun(s); if (!d) return;
    const tier = run ? (run.dtier && TIERS[run.dtier] ? run.dtier : "normal") : picked(s, d.place);
    if (tier === "normal") { delete d.dtier; delete d.mods; return; }
    d.dtier = tier; d.mods = run?.mods ? [...run.mods].filter((k) => MODS[k]).slice(0, 3) : modsAt(d.place, tier, t);
    G.note(s, ` ${TIERS[tier].name}: ${d.mods.map((k) => MODS[k].name).join(", ")}`);
  }
  const mods = (s) => new Set(dun(s)?.mods || []);
  const tierOf = (d) => TIERS[d?.dtier] || TIERS.normal;

  // ---------------------------------------------------------------- scaling (DUNGEONS foe(), COOP.foe, traps, gold)
  function scaleFoe(s, e, major = false) {
    const d = dun(s); if (!d || !e) return e;
    const T = tierOf(d), L = depth(s);
    if (T === TIERS.normal && !L) return e;
    const hp = T.hp * (1 + DEPTH_HP * L) * (major ? MAJOR_HP[L] : 1) * lvEase(s), dm = T.dmg * (1 + DEPTH_DMG * L) * lvEase(s, LV_EASE_DMG);
    e.health = Math.round(e.health * hp); e.hp = e.health; e.damage = Math.round(e.damage * dm * 10) / 10;
    e.hitCap = Math.min(e.hitCap || HIT_CAP, HIT_CAP);   // engine.js: never more than this share of your health in one blow
    e.deep = L; e.dtier = d.dtier || "normal";
    return e;
  }
  /* a party in a Veteran / Legendary / Mythic run: per extra member the foe gets this much more health and damage on top of
     coop.js FOE_BONUS (four heroes shrug off what kills a lone one). Called by coop.js once the party size is known. */
  function partyFoe(s, e, n) {
    const d = dun(s), P = d && e ? tierOf(d).party : null, k = Math.max(0, Math.min(7, (n || 1) - 1));
    if (!P || !k) return e;
    e.health = Math.round(e.health * (1 + P[0] * k)); e.hp = e.health; e.damage = Math.round(e.damage * (1 + P[1] * k) * 10) / 10;
    return e;
  }
  const trapMult = (s) => { const d = dun(s); return d ? (1 + 0.08 * depth(s)) * (1 + 0.1 * (tierOf(d).n || 0)) : 1; };
  function goldMult(s) { const d = dun(s); if (!d) return 1; const L = depth(s); return tierOf(d).gold * DEPTH_GOLD[L] * (1 + (L ? pfx(s, "deepfind") * L : 0)); }
  /* healing you get (potions, spells, rest, shrines) */
  function healMult(s) {
    const d = dun(s); if (!d) return 1;
    let m = mods(s).has("cursed") ? 0.6 : 1;
    if ((d.deep?.curses || []).includes("mark")) m *= 1 - 0.3 * vetFactor(s);
    return m;
  }

  // ---------------------------------------------------------------- the deeper levels
  /* the map of a deeper level, the same on every phone of a party (seeded by the run, or your own save) */
  function layout(seedKey, L) {
    const r = rng(hash(seedKey)), ri = (a, b) => a + Math.floor(r() * (b - a + 1));
    const W = { 1: [["fight", 5], ["elite", 2], ["trap", 2], ["treasure", 1]], 2: [["trap", 4], ["elite", 4], ["fight", 1], ["treasure", 1]],
      3: [["treasure", 4], ["puzzle", 2], ["trap", 2], ["elite", 2]], 4: [["fight", 3], ["elite", 3], ["mystery", 2], ["trap", 1]] }[L];
    const pickW = (w) => { let x = r() * w.reduce((a, [, n]) => a + n, 0); return w.find(([, n]) => (x -= n) < 0)[0]; };
    const n = L === 5 ? 1 : L === 2 ? 4 : 3, rows = [];
    for (let i = 0; i < n; i++) {
      const w = L === 5 ? 2 : i === 0 ? 2 : ri(2, 3), row = [];
      for (let c = 0; c < w; c++) {
        let type = L === 5 ? (c === 0 ? "rest" : "treasure") : pickW(W);
        if (i === n - 1 && L !== 4 && L !== 5 && c === 0) type = "rest";   // a breather before the major fight (none in the cursed sanctuary)
        row.push({ type, links: [] });
      }
      rows.push(row);
    }
    rows.push([{ type: "boss", links: [] }]);
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i], b = rows[i + 1];
      a.forEach((node, k) => { const pos = a.length === 1 ? 0 : k / (a.length - 1) * (b.length - 1); node.links = [...new Set([Math.floor(pos), Math.ceil(pos)])].sort(); });
      b.forEach((_, j) => { if (!a.some((x) => x.links.includes(j))) a[Math.min(a.length - 1, Math.round(j / Math.max(1, b.length - 1) * (a.length - 1)))].links.push(j); });
      a.forEach((x) => { x.links = [...new Set(x.links)].sort(); });
    }
    return rows;
  }
  const seedKey = (s, L) => { const d = dun(s); return `${d.run || `${s.id}|${d.place}|${Math.floor(d.t || 0)}`}|deep|${L}`; };
  /* the major fight at the end of a level */
  function bossRoom(s, mkFoe) {
    const d = dun(s), L = depth(s), T = DUNGEONS.THEMES[d.theme];
    const key = L === 1 ? (T.elite[T.elite.length - 1] || T.boss[1]) : L === 2 ? T.boss[1] : T.boss[2];
    const e = mkFoe(key, true);
    e.boss = true; e.major = true;
    const base = e.name;
    if (L === 1) e.name = `${base} guardian`;
    else if (L === 3) e.name = `${base}, warden of the vault`;
    else if (L === 4) e.name = `Cursed ${base.toLowerCase()}`;
    else if (L === 5) e.name = `Legendary ${base.toLowerCase()}`;
    const text = ["", `Two braziers flare. The ${base.toLowerCase()} that guards the stairs steps out to meet you.`,
      `Past the last trap, the ${base.toLowerCase()} waits with its back to a sealed door.`,
      `The vault door stands open. Its warden, an ancient ${base.toLowerCase()}, rises from the gold.`,
      `Black candles gutter. Something that was once a ${base.toLowerCase()} turns its hollow face to you.`,
      `The deepest hall. The legendary ${base.toLowerCase()} has waited a thousand years for someone foolish enough to come this far.`][L];
    return { type: "boss", enemy: e, text };
  }
  /* the camp at the top of each stairway */
  function campRoom(s) { return { type: "camp", text: campText(s) }; }
  function campText(s) {
    const L = depth(s);
    return L ? `You make camp in a quiet corner of level ${ROMAN[L]}. Stairs lead down into the dark.` : "Behind the master's throne, worn stairs lead further down. Cold air rises from below.";
  }
  /* boss of the normal dungeon just fell: offer the depths? */
  function offer(s) { const d = dun(s); return !!d && !d.deep && deepable(d.place) && !d.boss; }
  function newDeep(s) {
    const d = dun(s), snap = { q: {}, next: s.nextInv, gold: s.gold };
    for (const r of s.inv) snap.q[r.id] = r.qty;
    return { level: 0, max: 0, inj: 0, curses: [], rations: 2 + Math.round(pfx(s, "deepration")), snap, found: [], gold: 0, t: now() };
  }
  const nextLevel = (s) => Math.min(MAX_DEPTH, depth(s) + 1);
  function campChoices(s) {
    const d = dun(s), L = depth(s), dd = d.deep || { rations: 2 + Math.round(pfx(s, "deepration")) };
    const out = [["extract", L ? "Extract: climb out with everything" : "Head back up with your loot"]];
    if (L > 0) out.push(["camprest", dd.rations > 0 ? `Rest (1 ration, ${dd.rations} left)` : foodRow(s) ? "Rest (eat something from your pack)" : "Rest (no rations left)"]);
    if (L < MAX_DEPTH) out.push(["descend", `Descend to level ${ROMAN[L + 1]}: ${DEPTH_NAME[L + 1]}`]);
    const pot = G.countRestore(s, "health"); if (pot) out.push(["potion", `Drink a healing potion (${pot})`]);
    return out;
  }
  const foodRow = (s) => s.inv.find((r) => D.ITEMS[r.item]?.slot === "food" && r.qty > 0) || null;

  /* unsecured finds: what came into the pack since the top of the stairs */
  function gains(s, snap) {
    const items = [];
    for (const r of s.inv) {
      const it = D.ITEMS[r.item]; if (!it || it.quest || it.noTrade) continue;
      if (r.id >= snap.next) items.push({ id: r.id, qty: r.qty });
      else if (snap.q[r.id] != null && r.qty > snap.q[r.id]) items.push({ id: r.id, qty: r.qty - snap.q[r.id] });
    }
    return { items, gold: Math.max(0, s.gold - snap.gold) };
  }
  function strip(s) {
    const dd = dun(s)?.deep; if (!dd?.snap) return { n: 0, gold: 0 };
    const g = gains(s, dd.snap), keep = new Set(Object.values(s.loadouts || {}).flatMap((lo) => Object.values(lo?.equipment || {})));   // something you found and put on stays on you
    let n = 0;
    for (const x of g.items) { if (keep.has(x.id)) continue; if (G.take(s, x.id, x.qty)) n += x.qty; }
    s.gold -= g.gold;
    return { n, gold: g.gold };
  }
  function unsecured(s) {
    const d = dun(s); if (!d?.deep?.snap) return { items: 0, gold: 0 };
    const g = gains(s, d.deep.snap);
    return { items: g.items.reduce((a, x) => a + x.qty, 0), gold: g.gold };
  }

  /* resolve a camp choice. h: { fight(e, opts), foe(key), lose(res, cause), done(o) } from dungeons.js */
  function campAct(s, choice, t, h) {
    const d = dun(s);
    if (choice === "extract") {
      const L = depth(s), u = unsecured(s);
      d.room = null; d.done = true;
      if (d.deep) { d.deep.extracted = true; d.deep.snap = null; }
      if (d.run) markRun(d.run, (x) => ({ ...x, deepMark: null }));
      G.note(s, L ? ` Extracted from level ${ROMAN[L]} of ${d.place}` : ` Cleared ${d.place}`);
      return { text: L ? `You climb all the way back up and out. Everything you found down there is yours now${u.gold || u.items ? ` (${[u.gold ? u.gold + " gold" : "", u.items ? u.items + " things" : ""].filter(Boolean).join(", ")})` : ""}.` : "You leave the stairs for another day.", extracted: true };
    }
    if (choice === "camprest") {
      const dd = d.deep;
      if (!dd) return { text: "", stay: true };
      let used = "";
      if (dd.rations > 0) { dd.rations--; used = "a ration"; }
      else { const f = foodRow(s); if (!f) return { text: "You have nothing left to eat. Resting on an empty stomach does no good.", stay: true }; G.take(s, f.id, 1); used = D.ITEMS[f.item].name; }
      let pre = "";
      if (mods(s).has("hunt") && Math.random() < 1 / 3) {   // Relentless Hunt
        const T = DUNGEONS.THEMES[d.theme], key = T.foes[Math.floor(Math.random() * T.foes.length)][0];
        const res = h.fight(h.foe(key), { enemyFirst: true });
        if (!res.f.won) return h.lose({ text: "They found your camp.", fight: res.f, skills: res.skills }, res.f.e.name);
        pre = `They found your camp: a ${res.f.e.name.toLowerCase()} came out of the dark. It's dead now. `;
        const before = G.curHealth(s); G.setHealth(s, before + G.maxHealth(s) * 0.35 * healMult(s));
        if (dd.inj > 0) dd.inj--;
        return { text: `${pre}You eat ${used} and rest (${Math.round(before)} → ${Math.round(G.curHealth(s))} health, ${dd.inj} injur${dd.inj === 1 ? "y" : "ies"} left).`, fight: res.f, skills: res.skills, stay: true };
      }
      const before = G.curHealth(s); G.setHealth(s, before + G.maxHealth(s) * 0.5 * healMult(s));
      if (dd.inj > 0) dd.inj--;
      return { text: `You eat ${used} and rest a while (${Math.round(before)} → ${Math.round(G.curHealth(s))} health, ${dd.inj} injur${dd.inj === 1 ? "y" : "ies"} left). Curses stay until you climb out.`, stay: true };
    }
    if (choice === "descend") {
      if (depth(s) >= MAX_DEPTH) return { text: "There is nothing deeper.", stay: true };
      if (!d.deep) { d.deep = newDeep(s); if (d.run) markRun(d.run, (x) => (x.deepMark ? x : { ...x, deepMark: clone(x.pool || { items: [], gold: 0 }), deepKO: {} })); }
      const L = ++d.deep.level; d.deep.max = Math.max(d.deep.max, L);
      d.rows = layout(seedKey(s, L), L); d.row = -1; d.col = 0; d.room = null; d.path = []; d.done = false;
      let extra = "";
      const curse = L === 4 ? "mark" : L === 3 && Math.random() < 0.5 ? "wither" : null;   // the vault and the sanctuary leave their mark
      if (curse && !d.deep.curses.includes(curse)) { d.deep.curses.push(curse); extra = ` ${CURSES[curse].icon} ${CURSES[curse].name}: ${CURSES[curse].desc}`; }
      G.note(s, ` Level ${ROMAN[L]} of ${d.place}: ${DEPTH_NAME[L]}`);
      return { text: `You go down to level ${ROMAN[L]}: ${DEPTH_NAME[L].toLowerCase()}.${extra}`, descended: L };
    }
    return { text: "", stay: true };
  }

  /* a level's major fight is won: the camp chest, maybe an injury, then the camp */
  function majorDown(s, e, res, t) {
    const d = dun(s), L = depth(s), T = DUNGEONS.THEMES[d.theme], got = [];
    const g = Math.round(rint(60, 140) * d.tier * goldMult(s));
    s.gold += g; d.gold += g; d.found.push(`${g} gold`);
    const give = (item) => { if (!D.ITEMS[item]) return; G.give(s, item); d.found.push(D.ITEMS[item].name); got.push(D.ITEMS[item].name); };
    const luck = 1 + pfx(s, "deepfind") * 2;
    for (const [item, c] of D.LOOT.elite) if (Math.random() < Math.min(0.95, c * (0.7 + 0.3 * L) * luck)) give(item);
    if (T.loot?.length && Math.random() < 0.5 + 0.1 * L) give(T.loot[Math.floor(Math.random() * T.loot.length)]);
    const gems = GEMS.filter((x) => D.ITEMS[x]);
    if (gems.length && (L >= 2 || Math.random() < 0.4 * luck)) give(gems[Math.min(gems.length - 1, Math.floor((L - 1) * 1.5 + Math.random() * 2))]);
    if (L === MAX_DEPTH && gems.length) give(gems[gems.length - 1]);
    let inj = "";
    if (G.curHealth(s) < G.maxHealth(s) * 0.5 && d.deep.inj < MAX_INJ) { d.deep.inj++; inj = ` You took an injury in that fight (${d.deep.inj} of ${MAX_INJ}): you hit a little softer and take a little more, until you rest or climb out.`; }
    d.room = campRoom(s);
    G.note(s, ` Beat the ${e.name} on level ${ROMAN[L]} of ${d.place}`);
    return { text: `The ${e.name.toLowerCase()} falls. In its hoard: ${[g + " gold", ...got].join(", ")}. Unsecured until you climb out.${inj}`, fight: res.f, skills: res.skills, gold: res.gold, loot: res.loot, major: L };
  }

  /* knocked down on a deep level: no penalty (owner, 25 Nov 2026). The fight is rolled back (defeat.js) and you
     stay in front of the same room with your finds, injuries and curses as they were before it. */
  function knockout(s, res, cause, t = now()) {
    const dd = G.die(s, cause, t);
    return { ...res, ...(dd.rolledBack ? { skills: [] } : {}), died: dd.msg, knockedOut: true };
  }
  /* walking out mid-level: with Pathfinder you keep everything, otherwise the expedition's finds stay below */
  function onLeave(s) {
    const d = dun(s);
    if (!d?.deep?.snap || d.deep.extracted || d.done) return "";
    if (d.room?.type === "camp" || hasPath(s)) { d.deep.snap = null; if (d.run) markRun(d.run, (x) => ({ ...x, deepMark: null })); return hasPath(s) && d.room?.type !== "camp" ? " Pathfinder: you know the way out and bring everything with you." : ""; }
    const lost = strip(s);
    if (d.run) markRun(d.run, (x) => (x.deepMark ? { ...x, pool: x.deepMark, deepMark: null } : x));
    return lost.gold || lost.n ? ` You ran for it and dropped the expedition's finds (${[lost.gold ? lost.gold + " gold" : "", lost.n ? lost.n + " things" : ""].filter(Boolean).join(", ")}) on the way up.` : "";
  }
  function markRun(id, fn) { if (typeof Store !== "undefined" && Store.change) try { Store.change("runs", id, (x) => (x ? fn(x) || x : x)); } catch (e) { /* offline */ } }

  // ---------------------------------------------------------------- fights: modifiers, injuries, curses
  const knowsLight = (s) => (s.spells || []).some((id) => id === "candlelight" || id === "detect_life");
  function fight(f) {
    const s = f.s, d = s?.dungeon;
    if (!d || f.e?.guard) return null;
    const M = new Set(d.mods || []), L = d.deep?.level || 0, inj = d.deep?.inj || 0, curses = d.deep?.curses || [];
    if (!M.size && !inj && !curses.length) return null;
    const vf = vetFactor(s), mh = G.maxHealth(s);
    const st = { M, L, taken: 1 + (0.06 * inj + (curses.includes("wither") ? 0.1 : 0)) * vf, dealt: Math.max(0.7, 1 - 0.04 * inj * vf), heal: healMult(s),
      frost: 0, dark: M.has("darkness") && !hasPath(s) && !knowsLight(s) ? 2 : 0, risen: false, lastEl: null, bleedMe: [] };
    const et = f.enemyTurn.bind(f), act = f.act.bind(f), cast = f.cast.bind(f);
    f.enemyTurn = function () {
      const h0 = this.hp, r = et(), dmg = h0 - this.hp;
      if (dmg > 0) {
        const cap = Math.max(0, HIT_CAP * 1.1 * mh - dmg), extra = Math.min(cap, dmg * (st.taken - 1));
        if (extra > 0) this.hp -= extra;
        if (st.M.has("bloodmoon")) st.bleedMe.push({ dmg: dmg * 0.1, turns: 2 });
      }
      return r;
    };
    f.act = function (a) {
      const h0 = this.hp, e0 = this.ehp, r = act(a);
      if (this.hp > h0 && st.heal < 1) this.hp = h0 + (this.hp - h0) * st.heal;
      const m = st.dealt * (st.dark > 0 ? 0.7 : 1);
      if (this.ehp < e0 && m < 1) this.ehp = e0 - (e0 - this.ehp) * m;
      return r;
    };
    f.cast = function (id, free, dual) {
      const sp = D.SPELLS[id] || {}; st.lastEl = sp.element === "fire" || sp.element === "sun" || sp.school === "Restoration" ? "fire" : sp.element || sp.school || null;
      if (sp.element === "fire") st.frost = 0;
      const e0 = this.ehp;
      let r = cast(id, free, dual);
      if (st.M.has("arcane") && Math.random() < 0.25) {
        const x = Math.random();
        if (x < 0.3 && this.ehp < e0) { const b = (e0 - this.ehp) * 0.4; this.ehp -= b; r += ` ·  surge +${Math.round(b)}`; }
        else if (x < 0.55) { const b = Math.round(mh * 0.04); this.hp -= b; r += ` ·  backlash −${b}`; }
        else if (x < 0.8) { this.mp = Math.max(0, this.mp - 20); r += " ·  your magicka drains away"; }
        else { const b = mh * 0.05 * st.heal; this.hp = Math.min(mh, this.hp + b); r += ` ·  a warm pulse +${Math.round(b)}`; }
      }
      return r;
    };
    return st;
  }
  function tick(f, line) {
    const st = f.dd; if (!st) return;
    const mh = G.maxHealth(f.s), add = (t) => { line.me = (line.me || "") + t; };
    if (st.M.has("frost")) {
      st.frost = Math.min(5, st.frost + 1); f.sp = Math.max(0, f.sp - 3 * st.frost);
      if (st.frost >= 5) { const b = Math.round(mh * 0.05); f.hp -= b; st.frost = 1; add(` ·  the cold bites −${b}`); }
    }
    if (st.M.has("bloodmoon")) {
      if (f.bleed?.length && f.ehp > 0) { const b = f.bleed.reduce((a, y) => a + y.dmg, 0) * 0.5; f.ehp -= b; add(` ·  blood moon +${Math.round(b)}`); }
      if (st.bleedMe.length) { const b = st.bleedMe.reduce((a, y) => a + y.dmg, 0); f.hp -= b; st.bleedMe = st.bleedMe.map((y) => ({ ...y, turns: y.turns - 1 })).filter((y) => y.turns > 0); add(` ·  you bleed ${Math.round(b)}`); }
    }
    if (st.M.has("overcharge") && f.tags?.has("construct") && f.ehp > 0 && f.turn % 3 === 0) {
      const b = Math.round(f.e.damage * 0.55); f.hp -= b; f.mp = Math.max(0, f.mp - 15); add(` ·  overcharge −${b}`);
    }
    if (st.M.has("restless") && f.ehp <= 0 && !st.risen && f.tags?.has("undead") && !f.endWon && st.lastEl !== "fire" && !(f.foeSt?.burn > 0)) {
      st.risen = true; f.ehp = Math.round((f.ehp0 || f.e.health) / 3); add(" ·  it rises again!");
    }
    if (st.dark > 0) st.dark--;
  }

  // ---------------------------------------------------------------- screens
  const E = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function modChips(keys) {
    return keys.map((k) => `<div class="dd-mod" data-mod="${k}"><div class="dd-mn"><b>${MODS[k].icon} ${E(MODS[k].name)}</b></div><div class="dd-md">${E(MODS[k].desc)}</div></div>`).join("");
  }
  /* on a dungeon's place card: the difficulty picker (level 30+) and the depths note */
  function placeCard(s, place) {
    if (typeof DUNGEONS === "undefined" || !DUNGEONS.enterable(place)) return "";
    const i = DUNGEONS.info(place); if (!i || i.theme === "giantcamp" || i.theme === "lair") return "";
    const open = tiersOpen(s), cur = picked(s, place), deep = deepable(place);
    const chips = TIER_KEYS.map((k) => `<button class="chip dd-tier ${k === cur ? "on" : ""}" data-act="ddtier" data-place="${E(place)}" data-t="${k}" ${!open && k !== "normal" ? "disabled" : ""}>${E(TIERS[k].name)}${TIERS[k].n ? ` <small>${TIERS[k].n}</small>` : ""}</button>`).join("");
    const T = TIERS[cur], ms = modsAt(place, cur);
    return `<div class="dd-card" data-tier="${cur}"><h4> Difficulty</h4>
      <div class="chips dd-tiers">${chips}</div>
      ${open ? (cur === "normal" ? `<p class="sub">Veteran, Legendary and Mythic make foes tougher and add modifiers you can see here first. Better gold the harder you go.</p>`
        : `<p class="sub">${E(T.name)}: foes have ${Math.round((T.hp - 1) * 100)}% more health and hit ${Math.round((T.dmg - 1) * 100)}% harder; ×${T.gold} gold. This week's modifiers:</p><div class="dd-mods">${modChips(ms)}</div>`)
        : `<p class="sub">Veteran, Legendary and Mythic open at level ${TIER_LEVEL}.</p>`}
      ${deep ? `<p class="sub dd-deepnote"> <b>Deep expedition:</b> after its master falls, stairs lead down to five deeper levels. Extract, rest or descend after each big fight. What you find below is yours only once you climb out.</p>` : ""}</div>`;
  }
  /* a line under the health bar inside: tier, modifiers, depth, injuries, curses */
  function bannerHTML(s) {
    const d = dun(s); if (!d) return "";
    const ms = d.mods || [], dd = d.deep, bits = [];
    if (d.dtier) bits.push(`<b class="dd-t">${E(TIERS[d.dtier].name)}</b>`);
    for (const k of ms) bits.push(`<span class="dd-ic" title="${E(MODS[k].name)}: ${E(MODS[k].desc)}">${MODS[k].icon} ${E(MODS[k].name)}</span>`);
    if (dd?.level) {
      bits.push(`<b class="dd-depth"> Level ${ROMAN[dd.level]}</b>`);
      if (dd.inj) bits.push(`<span class="dd-inj"> ${dd.inj} injur${dd.inj === 1 ? "y" : "ies"}</span>`);
      for (const c of dd.curses) bits.push(`<span class="dd-curse" title="${E(CURSES[c].desc)}">${CURSES[c].icon} ${E(CURSES[c].name)}</span>`);
      const u = unsecured(s); if (u.gold || u.items) bits.push(`<span class="dd-uns">Unsecured: ${u.gold} gold, ${u.items} things</span>`);
    }
    return bits.length ? `<div class="dd-banner">${bits.join("")}</div>` : "";
  }
  /* the camp card: Extract / Rest / Descend (a party vote in a party: the evc block becomes the vote) */
  function campHTML(s) {
    const d = dun(s), L = depth(s), dd = d.deep, nx = nextLevel(s), u = unsecured(s);
    const art = typeof DUNROOMS !== "undefined" ? DUNROOMS.room("rest", d.theme) : "";
    const btn = ([c, label]) => `<button class="btn ${c === "descend" ? "danger" : c === "extract" ? "pri" : ""}" data-act="dact" data-c="${E(c)}">${E(label)}</button>`;
    const nxTxt = L < MAX_DEPTH ? `<p class="sub dd-next">Next: <b>level ${ROMAN[nx]}, ${E(DEPTH_NAME[nx].toLowerCase())}</b>. Foes +${Math.round(DEPTH_HP * nx * 100)}% health, +${Math.round(DEPTH_DMG * nx * 100)}% damage; gold ×${DEPTH_GOLD[nx]}.</p>` : `<p class="sub dd-next">You stand at the very bottom. Nothing lies deeper.</p>`;
    return `<div class="card rest dd-camp">${art}<h3> ${L ? `Camp on level ${ROMAN[L]}` : "The stairs down"}</h3><p>${E(campText(s))}</p>
      ${L ? `<div class="dd-stats"><span>Unsecured: <b class="num">${u.gold}</b> gold, <b class="num">${u.items}</b> things</span><span>Rations: <b class="num">${dd.rations}</b></span><span>Injuries: <b class="num">${dd.inj}/${MAX_INJ}</b></span>${dd.curses.map((c) => `<span class="dd-curse">${CURSES[c].icon} ${E(CURSES[c].name)}</span>`).join("")}</div>` : ""}
      ${nxTxt}<div class="evc">${campChoices(s).map(btn).join("")}</div>
      <p class="sub" style="margin-bottom:0">${L ? `Knocked down below, you lose nothing: try the fight again. Leave without extracting and the finds stay down here.${hasPath(s) ? " Pathfinder: you can also walk out from any room and keep it all." : ""}` : "Health, potions and injuries carry down with you. Down there, loot is unsecured until you extract."}</p></div>`;
  }

  // labels for the dungeon screens
  if (typeof DUNGEONS !== "undefined") { DUNGEONS.ICON.camp = ""; DUNGEONS.LABEL.camp = "Camp"; }

  return { MAX_DEPTH, TIER_LEVEL, MAX_INJ, TIERS, TIER_KEYS, MODS, MOD_KEYS, CURSES, DEPTH_NAME, ROMAN, DEPTH_HP, DEPTH_DMG, DEPTH_GOLD, MAJOR_HP, HIT_CAP, LV_BASE, LV_EASE, LV_EASE_DMG, lvEase, partyFoe, PERK_ADD, PERK_ADJ,
    deepable, tiersOpen, modsFor, modsAt, picked, pick, runFields, onEnter, scaleFoe, trapMult, goldMult, healMult, layout, seedKey, bossRoom, campRoom, offer,
    campChoices, campAct, majorDown, knockout, onLeave, unsecured, strip, gains, fight, tick, vetFactor, hasPath, placeCard, bannerHTML, campHTML, depth };
})();
