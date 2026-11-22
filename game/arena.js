/* The Arena in Windhelm: friendly duels between players, with an optional bet.
   Nobody dies here: the loser kneels and the healers patch everyone up.
   The challenger's stake leaves their purse at once (held in the challenge, like trade offers),
   the opponent puts in the same when they accept, and the winner takes both.
   Ratings are per season (one calendar month, UTC) and start at 1000 (Elo, K=32). [OURS] */
const ARENA = (() => {
  const TOWN = "Windhelm", START = 1000, K = 32, MAX_STAKE = 5000, OPEN_MIN = 30;
  const season = (t = Date.now()) => { const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const seasonName = (id = season()) => { const [y, m] = id.split("-"); return `${["Morning Star", "Sun's Dawn", "First Seed", "Rain's Hand", "Second Seed", "Midyear", "Sun's Height", "Last Seed", "Hearthfire", "Frostfall", "Sun's Dusk", "Evening Star"][+m - 1]} ${y}`; };   // Skyrim's month names
  function me(s) { if (!s.arena || s.arena.season !== season()) s.arena = { season: season(), rating: START, w: 0, l: 0 }; return s.arena; }
  const expected = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  function rate(s, oppRating, won) {
    const a = me(s), before = a.rating;
    a.rating = Math.round(a.rating + K * ((won ? 1 : 0) - expected(a.rating, oppRating || START)));
    if (won) a.w++; else a.l++;
    s.stats = { ...(s.stats || {}), duels: ((s.stats || {}).duels || 0) + (won ? 1 : 0) };   // all-time, for achievements
    return a.rating - before;
  }
  const here = (s) => s.location === TOWN && !s.trip && !s.dungeon;
  /* -> { id, doc, text } or { err } */
  function challenge(s, card, stake, t = G.now()) {
    if (!here(s)) return { err: "Duels happen in the Arena in Windhelm." };
    if (!card || card.loc !== TOWN) return { err: `${card?.name || "They"} must be in Windhelm too.` };
    if (card.id === s.id) return { err: "You can't duel yourself." };
    stake = Math.max(0, Math.min(MAX_STAKE, Math.floor(+stake || 0)));
    if (stake > s.gold) return { err: `You only have ${s.gold} gold.` };
    s.gold -= stake;
    const id = `${s.id}-${Math.floor(t)}-${Math.floor(Math.random() * 900 + 100)}`;
    return { id, text: `You challenge ${card.name}${stake ? ` for ${stake} gold` : " to a friendly bout"}. ${stake ? "Your stake is held by the arena master." : ""}`,
      doc: { id, from: s.id, fromName: s.name, to: card.id, toName: card.name, stake, status: "open", t, season: season(), aRating: me(s).rating, aCard: MP.stats(s), aSnap: snapshot(s) } };
  }
  /* the opponent's game says yes and runs the bout. Returns the new doc, or null (with why) */
  function accept(s, doc, t = G.now()) {
    if (doc.status !== "open" || doc.to !== s.id) return { err: "That challenge is gone." };
    if (!here(s)) return { err: "Go to Windhelm to answer the challenge." };
    if (t - doc.t > OPEN_MIN * 60) return { err: "That challenge has expired." };
    if (s.gold < doc.stake) return { err: `You need ${doc.stake} gold to match the stake.` };
    s.gold -= doc.stake;
    const f = doc.aSnap ? duel(doc.aSnap, snapshot(s), doc.id || `${doc.from}-${doc.t}`, doc.t)   // a real fight: both sides' gear, perks, spells and tactics
      : bout(doc.aCard || {}, MP.stats(s), doc.fromName);   // challenges from older games: the old stat bout
    const skills = G.useSkill(s, "One-Handed", 6).concat(G.useSkill(s, "Blocking", 4));
    const iWon = !!f.won, pot = doc.stake * 2, bRating = me(s).rating;
    const delta = rate(s, doc.aRating, iWon);
    if (iWon) s.gold += pot;
    return { doc: { ...doc, status: "done", winner: iWon ? doc.to : doc.from, pot, bRating, turns: f.turn, done: t }, fight: f, skills, delta,
      text: iWon ? `${doc.fromName} goes down on one knee. You win${pot ? ` ${pot} gold` : ""}. Rating ${delta >= 0 ? "+" : ""}${delta}.` : `You end up on one knee. ${doc.fromName} wins${pot ? ` the ${pot} gold` : ""}. Rating ${delta}.` };
  }
  /* ------------------------------------------------ tactic-driven duels [OURS]
     What the other phone needs to rebuild you as a fighter: level, skills, perks, spells, the loadout you
     fight in (its gear and tactics) and your arrows. Arena rules: no potions, scrolls, poisons or followers. */
  const SNAP_KEYS = ["id", "name", "race", "level", "hpBonus", "mpBonus", "spBonus", "perks", "spells", "stone", "words", "unlocked", "greybeards",
    "vampire", "werewolf", "sanguinare", "beastAt", "lordAt", "beastPerks", "powerAt", "stonePowerAt", "voiceAt", "stonesSeen", "souls", "dragons"];
  const cp = (o) => JSON.parse(JSON.stringify(o));
  function snapshot(s) {
    const L = G.loadout(s), worn = new Set(Object.values(L.equipment || {}));
    const o = { v: 1 };
    for (const k of SNAP_KEYS) if (s[k] !== undefined && s[k] !== null) o[k] = cp(s[k]);
    o.skills = Object.fromEntries(Object.entries(s.skills).map(([k, v]) => [k, { lvl: v.lvl, xp: 0 }]));
    o.inv = s.inv.filter((r) => worn.has(r.id) || D.ITEMS[r.item]?.slot === "ammo").map(cp);
    o.loadouts = { Arena: { rules: cp(L.rules || []), equipment: { ...L.equipment }, mode: ["custom", "hybrid"].includes(L.mode) ? L.mode : "smart", ...(L.ai ? { ai: cp(L.ai) } : {}) } }; o.loadout = "Arena";   // Smart AI or your own tactics
    return o;
  }
  function fighter(snap, t) {   // a throwaway save: nothing that happens in the bout touches the real one
    const s = cp(snap);
    if (s.loadouts?.Arena && !s.loadouts.Arena.mode) s.loadouts.Arena.mode = "custom";   // challenges made before Smart AI fought by their rules
    Object.assign(s, { location: TOWN, dungeon: null, trip: null, follower: null, thrall: null, poison: null, horse: null, fx: [], journal: [], discovered: s.discovered || [], _test: true });
    s.skills = s.skills || {}; for (const k of D.ALL_SKILLS) s.skills[k] = s.skills[k] || { lvl: D.BASE_SKILL, xp: 0 };
    s.spells = s.spells || []; s.inv = s.inv || [];
    s.health = G.maxHealth(s); s.healthTs = t;
    return s;
  }
  /* one seeded random stream per bout, so every phone that runs it gets the same fight */
  function seeded(key, fn) {
    let h = 2166136261; for (const ch of String(key)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    let a = h >>> 0;
    const rng = () => { a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const orig = Math.random; Math.random = rng;
    try { return fn(); } finally { Math.random = orig; }
  }
  const MAX_ROUNDS = 60;
  /* a hit landing on fighter o: dodges, blocks, wards, resistances (armor was already counted by the attacker) */
  function defend(o, dmg, magic, slowed) {
    if (dmg <= 0) return [0, ""];
    const s = o.s, P = G.P, armor = Object.values(o.armor);
    dmg *= slowed ? 0.5 : 1;
    if (!magic) {
      const bare = !armor.some((a) => a.type && a.type !== "cloth"), light = armor.some((a) => a.type === "light");
      if ((P(s, "evasion") && Math.random() < 0.1) || (light && P(s, "deft_movement") && Math.random() < 0.1) || (bare && P(s, "dodge") && Math.random() < 0.15)) { o.blocking = false; return [0, " (dodged)"]; }
      if (o.blocking) {
        const shieldBase = o.shield ? o.shield.armor : (o.wt === "spear" && P(s, "phalanx") ? 20 : null);
        const pct = Math.min(0.85, F.blockPercent(G.skill(s, "Blocking"), shieldBase, 10) * (1 + 0.05 * P(s, "shield_wall")));
        o.addXp("Blocking", dmg * pct); dmg *= 1 - pct; o.blocking = false; return [dmg, ` (blocked ${Math.round(pct * 100)}%)`];
      }
      return [dmg, ""];
    }
    const absorb = [0, 0.1, 0.2][P(s, "spell_absorption")] || 0;
    if (absorb && Math.random() < absorb) { o.mp = Math.min(G.maxMagicka(s), o.mp + 15); return [0, " (absorbed into magicka)"]; }
    dmg *= (1 - 0.1 * P(s, "magic_resistance")) * (1 - Math.min(0.5, G.fxSum(s, "resist") / 100));
    if (o.pw && typeof POWERS !== "undefined") dmg = POWERS.dmgIn(o, dmg, true);
    if (o.ward > 0) { const used = Math.min(o.ward, dmg); o.ward -= used; dmg -= used; if (used) return [dmg, ` (ward soaks ${Math.round(used)})`]; }
    return [dmg, ""];
  }
  /* fighter f takes one turn against o. Both keep their own Fight; f.ehp mirrors o.hp and back. */
  function step(f, o) {
    f.ehp = o.hp; o.ehp = f.hp; f.turn++;
    const n = f.e.name;
    if (o.calmTurns > 0) { o.calmTurns--; return { rule: null, own: true, text: `${f.s.name} isn't fighting` }; }
    if (o.eParalyzed > 0) { o.eParalyzed--; return { rule: null, own: true, text: `${f.s.name} is paralyzed` }; }
    if (o.stagger) { o.stagger = false; return { rule: null, own: true, text: `${f.s.name} is staggered` }; }
    let head = "";
    if (typeof MAGIC !== "undefined") {   // o's runes, fear and invisibility
      const pre = MAGIC.beforeEnemy(o);
      if (pre) { f.hp = Math.max(0, o.ehp); f.ehp = o.hp; if (pre.end || f.hp <= 0) return { rule: null, text: pre.text }; head = pre.text + " · "; }
    }
    { const { rating, pieces } = o.armorRating(); f.e.red = F.damageReduction(rating, pieces); }
    const [rule, a] = f.choose();
    const before = f.ehp;
    let text = f.act(a);
    const magic = !/^(attack|power_attack|block)$/.test(a) || !!f.weapon?.staff;
    const [dealt, note] = defend(o, Math.max(0, before - f.ehp), magic, o.slowed > 0);
    o.hp -= dealt; text += note;
    if (dealt > 0 && o.hp <= 0 && G.P(o.s, "shadow_warrior") && !o.shadowUsed) { o.shadowUsed = true; o.hp = 1; o.sneakNext = true; text += `, but ${n} vanishes into the shadows`; }
    f.ehp = o.hp;
    const line = { me: text };
    if (f.bleed.length && f.ehp > 0) { const b = f.bleed.reduce((x, y) => x + y.dmg, 0); f.ehp -= b; f.bleed = f.bleed.map((y) => ({ ...y, turns: y.turns - 1 })).filter((y) => y.turns > 0); line.me += ` · bleeds ${Math.round(b)}`; }
    if (f.summonTurns > 0 && f.ehp > 0) { f.summonTurns--; f.ehp -= f.summonDmg; line.me += ` · familiar ${Math.round(f.summonDmg)}`; }
    if (typeof MAGIC !== "undefined") MAGIC.tick(f, line);
    if (f.pw && typeof POWERS !== "undefined") POWERS.tick(f, line);
    const guard = f.healGuard(rule); if (guard) line.me += " · " + guard;
    o.hp = Math.min(o.hp, f.ehp); o.ehp = f.hp;
    o.slowed = Math.max(0, o.slowed - 1);
    return { rule, text: head + line.me };
  }
  /* challenger a vs acceptor b, told from b's side (b is "you"). Who strikes first comes from the seed. */
  function duel(snapA, snapB, key, t = G.now()) {
    return seeded(key, () => {
      const sa = fighter(snapA, t), sb = fighter(snapB, t);
      const foe = (o) => ({ name: o.name, health: G.maxHealth(o), hp: G.maxHealth(o), damage: 10, level: o.level, tags: ["humanoid"], red: 0, player: true });
      const fa = new G.Fight(sa, foe(sb), sa.loadouts.Arena.rules, t), fb = new G.Fight(sb, foe(sa), sb.loadouts.Arena.rules, t);
      for (const f of [fa, fb]) { f.allies = []; f.hidden = false; f.arena = true; }
      const hp0 = fb.hp, ehp0 = fa.hp, log = [], aName = sa.name;
      const fin = () => fa.hp <= 0 || fb.hp <= 0, said = (r) => r.own ? r.text : `${aName}: ${r.text}`;
      const snap = (l) => { l.hp = Math.max(0, Math.round(fb.hp)); l.ehp = Math.max(0, Math.round(fa.hp)); return l; };
      if (Math.random() < 0.5) log.push(snap({ turn: 0, rule: null, me: "", them: said(step(fa, fb)) }));
      let round = 0;
      while (!fin() && round < MAX_ROUNDS) {
        round++;
        const mine = step(fb, fa), line = { turn: round, rule: mine.rule, me: mine.text, them: "" };
        if (!fin()) line.them = said(step(fa, fb));
        log.push(snap(line));
        for (const f of [fa, fb]) { f.sp = Math.min(G.maxStamina(f.s), f.sp + f.regenSp); f.mp = Math.min(G.maxMagicka(f.s), f.mp + f.regenMp); }
      }
      const pa = fa.hp / ehp0, pb = fb.hp / hp0;
      const won = fa.hp <= 0 ? true : fb.hp <= 0 ? false : pb !== pa ? pb > pa : Math.random() < 0.5;   // time's up: the healthier fighter takes it
      if (!fin()) log.push({ turn: round, rule: null, me: "", them: `The arena master calls time. ${won ? "You" : aName} looked the stronger.`, hp: Math.max(0, Math.round(fb.hp)), ehp: Math.max(0, Math.round(fa.hp)) });
      return { arena: true, foeName: aName, won, turn: round, log, hp0: Math.round(hp0), ehp0: Math.round(ehp0), weapon: fb.weapon, eq: fb.eq, wt: fb.wt, armor: fb.armor, shield: fb.shield, allies: [],
        foeGear: { wt: fa.wt, shield: !!fa.shield, armor: fa.armor }, used: { a: fa.used, b: fb.used } };
    });
  }
  /* a symmetric bout between two players' fighting stats. Returns a fight log the UI can show. [OURS] */
  function bout(a, b, aName) {
    let ha = Math.max(1, a.hp || 100) + (a.heal || 0), hb = Math.max(1, b.hp || 100) + (b.heal || 0);
    const maxA = ha, maxB = hb, log = [];
    const hit = (dmg, red) => Math.max(1, (dmg || 5) * (0.55 + Math.random() * 0.9) * (1 - Math.min(0.8, red || 0)));
    let turn = 0, aFirst = Math.random() < 0.5;
    while (ha > 0 && hb > 0 && turn < 80) {
      turn++;
      const x = Math.round(hit(b.dmg, a.red)), y = Math.round(hit(a.dmg, b.red));
      if (aFirst) { hb -= y; if (hb > 0) ha -= x; } else { ha -= x; if (ha > 0) hb -= y; }
      log.push({ turn, me: `You hit for ${x}`, them: `${aName} hits for ${y}`, hp: Math.max(0, Math.round(hb)), ehp: Math.max(0, Math.round(ha)) });
    }
    const won = ha <= 0 || (hb > 0 && hb / maxB > ha / maxA);
    return { won, turn, log: log.length > 12 ? [...log.slice(0, 6), ...log.slice(-6)] : log };
  }
  /* the challenger's game settles: winnings, or the stake back */
  function settle(s, doc) {
    if (doc.from !== s.id) return null;
    if (doc.status === "done") {
      const won = doc.winner === s.id, delta = doc.season === season() ? rate(s, doc.bRating, won) : 0;
      if (won) s.gold += doc.pot || 0;
      return won ? `You beat ${doc.toName} in the Arena${doc.pot ? `: +${doc.pot} gold` : ""}. Rating ${delta >= 0 ? "+" : ""}${delta}.` : `${doc.toName} beat you in the Arena${doc.stake ? ` and took your ${doc.stake} gold` : ""}. Rating ${delta}.`;
    }
    if (doc.status === "declined" || doc.status === "cancelled") { s.gold += doc.stake || 0; return doc.status === "declined" ? `${doc.toName} turned down your challenge.${doc.stake ? " Your stake is back." : ""}` : "Challenge withdrawn."; }
    return null;
  }
  const board = (docs, s) => {
    const sid = season(), rows = docs.filter((d) => d.arena && d.arena.season === sid && (d.arena.w + d.arena.l) > 0).map((d) => ({ id: d.id, name: d.name, ...d.arena }));
    if (s && (me(s).w + me(s).l) > 0 && !rows.some((r) => r.id === s.id)) rows.push({ id: s.id, name: s.name, ...me(s) });
    return rows.sort((a, b) => b.rating - a.rating || b.w - a.w);
  };
  return { TOWN, START, MAX_STAKE, OPEN_MIN, season, seasonName, me, here, challenge, accept, settle, board, snapshot, duel, bout };
})();
