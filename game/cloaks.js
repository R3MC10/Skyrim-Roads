/* cloaks.js: side cloaks, one for every rank of every side. [OURS]
   Remigiusz: joining a side gives a CLOAK with the side's emblem and colour (Stormcloak blue, Imperial red, Thalmor
   gold/black). Each higher side rank unlocks a better cloak with its own buff, and an active power at high ranks.
   - A new equipment slot, "cloak". Cloaks are side-only: only a member of that side at that rank or higher can put
     one on, and it does nothing (and comes off) once you change sides.
   - Ranks 1-3: passive buffs. Rank 4: a power that fires once a fight when you're hurt. Rank 5: a power that fires
     once a fight on the second turn. The quartermaster sends each new cloak when you reach the rank.
     Stormcloaks (frost, shouts, morale): resist frost, stamina, harder blows, allies fight harder; Battle Cry (heal +
     stamina when hurt), Voice of the Storm (a frost shout).
     Imperial Legion (shields, guards, discipline): block more, extra armour, cheaper fines; Shield Wall (half damage for
     two turns when hurt), Call the Guard (a Legion soldier fights beside you).
     Aldmeri Dominion (magicka, wards, illusion): magicka regen, cheaper spells, absorb spells; Mana Surge (magicka back
     when you run low), Mind Spike (an illusion dazes the foe: they lose a blow).
   - Rule (Remigiusz): no effect or power shows up in more than one side's ladder (types(), checked by test_sides.js).
   - Passive buffs are rows like perk effects: they reach the fight code through PFX (the same road worn enchantments
     take, ENCH.pfxWorn). Powers run from PFX.tick, once per fight; the only direct damage (Voice of the Storm) is 12%
     of the foe's health at most, so nothing one-shots anyone.
   - Figures (figart.js, heroart.js, gearlook.js) draw the cape in the cloak's colours with the side's emblem. */
const SIDECLOAK = (() => {
  const LOOK = {
    stormcloak: { c: "#2f5687", d: "#1d3963", trim: "#e8e2d2", fur: "#cbb994" },
    imperial: { c: "#a3271f", d: "#6d1215", trim: "#d9b25a", fur: null },
    thalmor: { c: "#202328", d: "#121417", trim: "#d6b45c", fur: null },
  };
  const FROST = { foeEl: "frost" };
  /* [name, fx rows, power, desc] per rank 1-5 */
  const DEF = {
    stormcloak: [
      ["Unblooded Bearskin Cloak", [["in", -0.1, FROST], ["regensp", 0.1, {}]], null, "Frost hurts you 10% less; stamina comes back 10% faster."],
      ["Ice-Veins Cloak", [["in", -0.15, FROST], ["regensp", 0.1, {}], ["out", 0.04, {}]], null, "Frost hurts you 15% less; stamina 10% faster; you hit 4% harder."],
      ["Bone-Breaker's Bear Cloak", [["in", -0.2, FROST], ["regensp", 0.15, {}], ["out", 0.06, {}], ["allies", 0.1, {}]], null, "Frost hurts you 20% less; stamina 15% faster; you hit 6% harder; allies fight 10% harder."],
      ["Snow-Hammer War Cloak", [["in", -0.2, FROST], ["regensp", 0.15, {}], ["out", 0.08, {}], ["allies", 0.15, {}]], "cry", "As before, a little stronger. Power, Battle Cry: once a fight, below half health, you roar and get 12% health and 30% stamina back."],
      ["Stormblade's Mantle", [["in", -0.25, FROST], ["regensp", 0.2, {}], ["out", 0.1, {}], ["allies", 0.15, {}]], "storm", "Frost hurts you 25% less; you hit 10% harder; allies 15% harder. Powers: Battle Cry, and Voice of the Storm: once a fight a frost shout hits for 12% of the foe's health."],
    ],
    imperial: [
      ["Auxiliary's Red Cloak", [["block", 0.04, {}], ["armor", 5, {}]], null, "Blocking stops 4% more; +5 armour."],
      ["Quaestor's Cloak", [["block", 0.06, {}], ["armor", 10, {}]], null, "Blocking stops 6% more; +10 armour."],
      ["Praefect's Cloak", [["block", 0.08, {}], ["armor", 15, {}], ["bribe", 0.1, {}]], null, "Blocking stops 8% more; +15 armour; guards' fines cost 10% less."],
      ["Tribune's Battle Cloak", [["block", 0.1, {}], ["armor", 20, {}], ["bribe", 0.15, {}]], "wall", "Blocking stops 10% more; +20 armour; fines 15% less. Power, Shield Wall: once a fight, below 40% health, you take half damage for two turns."],
      ["Legate's Mantle", [["block", 0.12, {}], ["armor", 25, {}], ["bribe", 0.2, {}]], "guard", "Blocking stops 12% more; +25 armour; fines 20% less. Powers: Shield Wall, and Call the Guard: once a fight, on the second turn, a Legion soldier joins you for the rest of the fight."],
    ],
    thalmor: [
      ["Initiate's Gilded Cloak", [["regenmp", 0.1, {}]], null, "Magicka comes back 10% faster."],
      ["Agent's Shadow Cloak", [["regenmp", 0.15, {}], ["scost", 0.04, {}]], null, "Magicka 15% faster; spells cost 4% less."],
      ["Justiciar's Cloak", [["regenmp", 0.2, {}], ["scost", 0.06, {}], ["absorb", 0.05, {}]], null, "Magicka 20% faster; spells cost 6% less; you soak up 5% of the magic that hits you."],
      ["Inquisitor's Warded Cloak", [["regenmp", 0.25, {}], ["scost", 0.08, {}], ["absorb", 0.08, {}]], "surge", "Magicka 25% faster; spells 8% cheaper; absorb 8%. Power, Mana Surge: once a fight, when your magicka drops below a quarter, 40% of it comes back at once."],
      ["First Emissary's Mantle", [["regenmp", 0.3, {}], ["scost", 0.1, {}], ["absorb", 0.1, {}]], "spike", "Magicka 30% faster; spells 10% cheaper; absorb 10%. Powers: Mana Surge, and Mind Spike: once a fight, on the second turn, an illusion dazes the foe and they lose their next blow."],
    ],
  };
  /* what each effect does, for the rule "no effect in more than one side's ladder" (tests/test_sides.js checks it) */
  const ROW_TYPE = { regensp: "stamina_regen", out: "damage_dealt", allies: "ally_damage", block: "block", armor: "armor", bribe: "fines", regenmp: "magicka_regen", scost: "spell_cost", absorb: "spell_absorb" };
  const POWER_TYPE = { cry: "health_burst", storm: "frost_strike", wall: "damage_cut", guard: "summon_ally", surge: "magicka_burst", spike: "stagger" };
  const typeOfRow = ([k, , c]) => (k === "in" && c && c.foeEl ? "resist_" + c.foeEl : ROW_TYPE[k] || k);
  /* every effect type a side's ladder uses */
  function types(side) { const t = new Set(); for (const [, rows, power] of DEF[side]) { rows.forEach((r) => t.add(typeOfRow(r))); if (power) t.add(POWER_TYPE[power]); } return [...t]; }
  const TAG = { stormcloak: "sc", imperial: "il", thalmor: "ad" };
  const idOf = (side, rank) => `cloak_${TAG[side]}_${rank}`;   // rank 1-5
  if (typeof D !== "undefined" && D.ITEMS) for (const side of Object.keys(DEF)) DEF[side].forEach(([name, , , desc], i) => {
    D.ITEMS[idOf(side, i + 1)] = { name, slot: "cloak", type: "cloth", armor: 0, weight: 1 + (i >= 3 ? 1 : 0), value: 150 * (i + 1), noTrade: true, sideCloak: { side, rank: i + 1 }, cloakLook: { ...LOOK[side], side, rank: i + 1 }, desc };
  });
  if (typeof G !== "undefined" && G.SLOTS && !G.SLOTS.includes("cloak")) G.SLOTS.push("cloak");

  const mySide = (s) => (typeof SIDES !== "undefined" ? SIDES.mine(s) : null);
  const myRank = (s) => { const r = typeof SIDES !== "undefined" ? SIDES.rank(s) : null; return r ? r.i + 1 : 0; };
  const info = (itemId) => (typeof D !== "undefined" && D.ITEMS[itemId] && D.ITEMS[itemId].sideCloak) || null;
  /* can s wear this cloak? -> null or why not */
  function why(s, itemId) {
    const c = info(itemId); if (!c) return null;
    const L = typeof SIDES !== "undefined" ? SIDES.LIST[c.side] : null;
    if (mySide(s) !== c.side) return `Only soldiers of the ${L ? L.name : "side"} can wear this cloak.`;
    if (myRank(s) < c.rank) return `You need the rank of ${SIDES.rankName(c.side, c.rank - 1)} to wear this cloak.`;
    return null;
  }
  /* the cloak you're wearing that works right now: { side, rank, id } or null */
  function active(s, f) {
    let eq = null;
    try { eq = f && f.eq ? f.eq : G.equipment(s); } catch (e) { return null; }
    const r = eq && eq.cloak; if (!r) return null;
    const c = info(r.item); if (!c || why(s, r.item)) return null;
    return { ...c, id: r.item };
  }
  const rowsOf = (side, rank) => (DEF[side] && DEF[side][rank - 1] ? DEF[side][rank - 1][1] : []);
  const powersOf = (side, rank) => { const p = []; for (let i = 0; i < rank; i++) { const k = DEF[side][i][2]; if (k && !p.includes(k)) p.push(k); } return p; };
  /* fx rows for PFX (passives plus the two-turn guard from Shield Wall / Dominion Ward) */
  function rows(s, f) {
    const a = active(s, f); if (!a) return [];
    const out = rowsOf(a.side, a.rank).slice();
    if (f && f._cloak && f._cloak.guard > 0) out.push(["in", -f._cloak.guardPct, {}]);
    return out;
  }
  if (typeof ENCH !== "undefined" && ENCH.pfxWorn && !ENCH.pfxWorn._cloak) {
    const p0 = ENCH.pfxWorn;
    ENCH.pfxWorn = (s, f) => { const a = p0(s, f) || [], b = rows(s, f); return b.length ? [...a, ...b] : a; };
    ENCH.pfxWorn._cloak = true;
  }
  /* once-a-fight powers, run each turn from PFX.tick */
  const POWER_NAME = { cry: "Battle Cry", storm: "Voice of the Storm", wall: "Shield Wall", guard: "Call the Guard", surge: "Mana Surge", spike: "Mind Spike" };
  function tick(f, line) {
    if (!f || !f.s || f.hp <= 0 || f.ehp <= 0) return;
    const a = active(f.s, f); if (!a || a.rank < 4) return;
    const st = (f._cloak = f._cloak || { n: 0, used: {}, guard: 0, guardPct: 0 });
    st.n++;
    if (st.guard > 0) st.guard--;
    const mh = G.maxHealth(f.s), foeMax = Math.max(1, (f.e && (f.e.health || f.e.hp)) || f.ehp0 || f.ehp);
    const say = (txt) => { line.me = (line.me ? line.me + " · " : "") + txt; };
    const hurt = (pct) => f.hp > 0 && f.hp < pct * mh;
    for (const p of powersOf(a.side, a.rank)) {
      if (st.used[p]) continue;
      if (p === "cry" && hurt(0.5)) { st.used[p] = 1; const h = Math.round(0.12 * mh); f.hp = Math.min(mh, f.hp + h); if (typeof f.sp === "number") f.sp = Math.min(G.maxStamina ? G.maxStamina(f.s) : f.sp, f.sp + 0.3 * (G.maxStamina ? G.maxStamina(f.s) : 100)); say(` Battle Cry: +${h} health, stamina back`); }
      else if (p === "wall" && hurt(0.4)) { st.used[p] = 1; st.guard = 2; st.guardPct = 0.5; say(" Shield Wall: half damage for two turns"); }
      else if (p === "surge" && typeof f.mp === "number" && G.maxMagicka && f.mp < 0.25 * G.maxMagicka(f.s)) { st.used[p] = 1; const mm = G.maxMagicka(f.s), m = Math.round(0.4 * mm); f.mp = Math.min(mm, f.mp + m); say(` Mana Surge: +${m} magicka`); }
      else if (st.n < 2) continue;
      else if (p === "storm") { st.used[p] = 1; const d = Math.max(1, Math.round(Math.min(0.12 * foeMax, Math.max(1, f.ehp - 1)))); f.ehp -= d; say(` Voice of the Storm: ${d} frost`); }
      else if (p === "guard") { st.used[p] = 1; const dmg = Math.max(3, Math.min(0.05 * foeMax, 3 + 0.35 * (f.s.level || 1))); (f.allies = f.allies || []).push({ name: "Legion soldier", dmg, kind: "guard" }); say(" Call the Guard: a Legion soldier joins you"); }
      else if (p === "spike") { st.used[p] = 1; f.stagger = true; say(" Mind Spike: the foe is dazed"); }
    }
  }
  if (typeof PFX !== "undefined" && PFX.tick && !PFX.tick._cloak) {
    const t0 = PFX.tick;
    PFX.tick = (f, line) => { t0(f, line); try { tick(f, line); } catch (e) { /* never break a fight */ } };
    PFX.tick._cloak = true;
  }
  /* only your side's cloaks go on */
  if (typeof G !== "undefined" && G.equip && !G.equip._cloak) {
    const e0 = G.equip;
    G.equip = (s, id, hint) => { const r = G.invRow(s, id); const w = r ? why(s, r.item) : null; return w || e0(s, id, hint); };
    G.equip._cloak = true;
  }
  /* take off cloaks that stopped working (after a side change); returns true if one came off */
  function strip(s) {
    let off = false;
    for (const l of Object.values(s.loadouts || {})) {
      const eq = l && l.equipment; if (!eq || eq.cloak == null) continue;
      const r = G.invRow(s, eq.cloak);
      if (!r || why(s, r.item)) { delete eq.cloak; off = true; }
    }
    return off;
  }
  /* the quartermaster sends every cloak your rank has earned; returns notes */
  function grant(s) {
    const side = mySide(s); if (!side || !s.side) return [];
    const got = (s.side.cloaks = Array.isArray(s.side.cloaks) ? s.side.cloaks : []), notes = [], L = SIDES.LIST[side];
    for (let r = 1; r <= myRank(s); r++) {
      if (got.includes(r)) continue;
      got.push(r);
      const id = idOf(side, r);
      if (!(s.inv || []).some((x) => x.item === id)) G.give(s, id, 1);
      const m = r === 1 ? ` The ${L.name} give you their colours: ${D.ITEMS[id].name}.` : ` Promoted to ${L.ranks[r - 1]}! The quartermaster sends you a ${D.ITEMS[id].name}.`;
      notes.push(m); if (G.note && s.journal) G.note(s, m);
    }
    return notes;
  }
  /* put on the best cloak you can wear (first cloak after joining) */
  function wearBest(s) {
    const side = mySide(s); if (!side) return null;
    for (let r = myRank(s); r >= 1; r--) { const row = (s.inv || []).find((x) => x.item === idOf(side, r)); if (row) { const m = G.equip(s, row.id); return /^Equipped/.test(m) ? row : null; } }
    return null;
  }
  /* the Faction tab: the cloak you have and the next one */
  function ladder(s) {
    const side = mySide(s); if (!side) return null;
    const rk = myRank(s), cur = active(s);
    return { side, rank: rk, wearing: cur ? cur.id : null,
      list: DEF[side].map(([name, , power, desc], i) => ({ id: idOf(side, i + 1), rank: i + 1, rankName: SIDES.LIST[side].ranks[i], at: SIDES.RANK_AT[i], name, desc, power: power ? POWER_NAME[power] : null, have: i + 1 <= rk })) };
  }
  if (typeof SIDES !== "undefined" && !SIDES.pick._cloak) {   // a side change takes the old cloak off
    const p0 = SIDES.pick;
    SIDES.pick = (s, id, t) => { const r = p0(s, id, t); if (r && !r.err && typeof G !== "undefined" && s.loadouts) { if (strip(s)) r.text += " Your old side's cloak comes off: it won't work for you any more."; } return r; };
    SIDES.pick._cloak = true;
  }
  return { DEF, LOOK, ROW_TYPE, POWER_TYPE, types, typeOfRow, idOf, info, why, active, rows, rowsOf, powersOf, tick, strip, grant, wearBest, ladder, POWER_NAME };
})();
if (typeof module !== "undefined") module.exports = SIDECLOAK;
