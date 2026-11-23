/* Dragons: kinds, flying and landing, and their attacks. [OURS, kinds from Skyrim]
   Remigiusz: "Dragons should be of different kinds ... fight airborne and grounded; land below 35% HP ...
               different attacks and abilities per stance."
   - Kinds: Dragon, Frost Dragon, Blood Dragon, Elder, Ancient, Revered and Legendary dragons. Each has its own
     breath (fire or frost), toughness, strength and colour. Stronger kinds only show up at higher levels.
   - In the air: it breathes fire or frost and dives at you with its claws, and sometimes climbs out of reach.
     Melee blows only graze it (60% damage), arrows hit for 85% (it weaves about), spells and shouts hit fully.
   - Below 35% health (or hit with Dragonrend) it crashes down and fights on the ground: bite, tail swipe,
     wing buffet (knocks the stamina out of you) and a shorter breath. On the ground every blow lands fully. */
const DRAGONS = (() => {
  //  id          name               breath   hp    dmg   level  colour filter for the painted dragon
  const KINDS = [
    { id: "dragon", name: "Dragon", el: "fire", hp: 1, dmg: 1, lv: 0, filter: "", body: "#5a6a5a", wing: "#7a6a5a" },
    { id: "frost", name: "Frost Dragon", el: "frost", hp: 1.05, dmg: 1, lv: 0, filter: "hue-rotate(170deg) saturate(0.55) brightness(1.2)", body: "#8aa4b4", wing: "#b8ccd8" },
    { id: "blood", name: "Blood Dragon", el: "frost", hp: 1.15, dmg: 1.08, lv: 10, filter: "hue-rotate(-40deg) saturate(1.5) brightness(0.9)", body: "#7a3a32", wing: "#a0584a" },
    { id: "elder", name: "Elder Dragon", el: "fire", hp: 1.3, dmg: 1.15, lv: 20, filter: "sepia(0.5) saturate(1.2) brightness(0.95)", body: "#6a6248", wing: "#8a7a58" },
    { id: "ancient", name: "Ancient Dragon", el: "fire", hp: 1.45, dmg: 1.22, lv: 30, filter: "sepia(0.8) hue-rotate(-15deg) saturate(1.6)", body: "#7a5a2a", wing: "#a07a3a" },
    { id: "revered", name: "Revered Dragon", el: "frost", hp: 1.6, dmg: 1.3, lv: 40, filter: "hue-rotate(200deg) saturate(1.3) brightness(0.8)", body: "#3a4a6a", wing: "#5a6a8a" },
    { id: "legendary", name: "Legendary Dragon", el: "frost", hp: 1.8, dmg: 1.4, lv: 50, filter: "grayscale(0.6) brightness(1.35) contrast(1.1)", body: "#c0c4c8", wing: "#e0e4e8" },
  ];
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const LAND = 0.35;          // lands below 35% health
  const AIR_MELEE = 0.6;      // melee only grazes a flying dragon (60%)
  const LEAP_MELEE = 0.8;     // with Critical Charge / Great Critical Charge you leap at it
  const AIR_ARROW = 0.85;     // arrows: it weaves through the sky, so some only clip it
  const MELEE = new Set(["attack", "power_attack", "bash"]);
  const RANGED_WT = new Set(["bow", "crossbow"]);
  //           what it does                                       how likely  how hard
  const MOVES = {
    air: [
      { id: "breath", w: 4, mul: 1.3, label: (k) => `${k.el === "frost" ? "Frost" : "Fire"} breath rains down` },
      { id: "dive", w: 3, mul: 1.1, label: () => "It dives and rakes you with its claws" },
      { id: "circle", w: 2, mul: 0, label: () => "It climbs high and circles, out of reach" },
    ],
    ground: [
      { id: "bite", w: 4, mul: 1.05, label: () => "It snaps at you with its jaws" },
      { id: "tail", w: 3, mul: 1.2, label: () => "Tail swipe" },
      { id: "wing", w: 2, mul: 0.7, label: () => "Wing buffet knocks the wind out of you", sp: 0.2 },
      { id: "breath", w: 2, mul: 1.15, label: (k) => `A short blast of ${k.el === "frost" ? "frost" : "fire"}` },
    ],
  };
  const h01 = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };
  const unlocked = (level) => KINDS.filter((k) => k.lv <= Math.max(0, level || 0));

  /* which kind a dragon is: the name says it ("Blood Dragon", "Frost dragon"), else picked from the kinds your level allows */
  function kindOf(e, level, seed) {
    if (!e) return BY.dragon;
    if (e.dKind && BY[e.dKind]) return BY[e.dKind];
    const n = String(e.name || "").toLowerCase();
    for (const k of KINDS.slice(1)) if (n.includes(k.id)) return k;
    const list = unlocked(level ?? e.level);
    return list[Math.floor((seed != null ? h01(seed) : Math.random()) * list.length)] || BY.dragon;
  }
  const is = (f) => !!(f && f.tags && f.tags.has("dragon") && !f.e?.player && !f.e?.ally);
  /* the turn-based fight calls this once at the start: a dragon starts in the air */
  function setup(f, sess) {
    if (!is(f)) return;
    const k = kindOf(f.e, f.s?.level, f.e.dSeed);
    f.e.dKind = k.id; f.e.element = k.el;
    f.dStance = "air";
    sess.emit("foe", `The ${k.name.toLowerCase()} circles overhead. While it flies, melee blows only graze it and arrows can miss their mark; spells and shouts hit fully.`, "foe", { dmg: 0, stance: "air" });
  }
  /* how much health is left: of the shared pool for a raid dragon, else of this fight */
  const frac = (f, sess) => Math.max(0, f.ehp) / Math.max(1, f.e.pool || sess.ehpMax || f.ehp0 || 1);
  /* lands below 35% health, or when Dragonrend brings it down */
  function check(f, sess) {
    if (!is(f) || f.dStance !== "air" || f.ehp <= 0) return "";
    const rent = f.pw && f.pw.rend > 0;
    if (frac(f, sess) >= LAND && !rent) return "";
    f.dStance = "ground";
    const t = rent ? "Dragonrend tears it out of the sky! It crashes to the ground." : "Badly hurt, the dragon crashes to the ground and fights on its feet!";
    sess.emit("foe", t, "foe", { dmg: 0, stance: "ground" });
    return t;
  }
  /* melee blows only graze a flying dragon */
  function graze(f, a, before) {
    if (!is(f) || f.dStance !== "air" || !MELEE.has(a) || f.ehp >= before) return "";
    const pf = (k) => (typeof PFX !== "undefined" ? PFX.num(f.s, k) : 0);
    if (RANGED_WT.has(f.wt)) { if (!pf("skyshot")) f.ehp += (before - f.ehp) * (1 - AIR_ARROW); return ""; }   // Eagle Eye: full damage
    f.ehp += (before - f.ehp) * (1 - (pf("leap") ? LEAP_MELEE : AIR_MELEE));   // Critical Charge: you leap at it
    return " (it's in the air: only a graze)";
  }
  function pickMove(f) {
    const list = MOVES[f.dStance] || MOVES.air, tot = list.reduce((a, m) => a + m.w, 0);
    let r = Math.random() * tot;
    for (const m of list) { r -= m.w; if (r < 0) return m; }
    return list[0];
  }
  /* the dragon's turn: picks an attack for its stance, the normal hit works out armour, blocks and wards, then the move
     scales it. Returns the log text. `enemyTurn` is the fight's normal foe turn. */
  function turn(f, enemyTurn) {
    if (!f.dStance || f.eParalyzed > 0 || f.calmTurns > 0) return enemyTurn();
    const k = BY[f.e.dKind] || BY.dragon, m = pickMove(f);
    if (m.mul === 0) return m.label(k);
    const hpB = f.hp, t = enemyTurn(), loss = hpB - f.hp;
    if (loss <= 0) return t;
    f.hp = hpB - loss * m.mul * k.dmg;
    let extra = "";
    if (m.sp) { const b = f.sp; f.sp = Math.max(0, f.sp - G.maxStamina(f.s) * m.sp); if (b > f.sp) extra = ` (−${Math.round(b - f.sp)} stamina)`; }
    return `${m.label(k)}: ${t}${extra}`;
  }
  /* what the fight scene needs: in the air or not, and the kind's colours */
  function art(f) {
    if (!is(f)) return null;
    const k = BY[f.e.dKind] || BY.dragon;
    return { air: f.dStance === "air", filter: k.filter, body: k.body, wing: k.wing, el: k.el };
  }
  return { KINDS, BY, LAND, AIR_MELEE, AIR_ARROW, MOVES, kindOf, is, setup, check, graze, turn, art, frac, h01 };
})();
if (typeof module !== "undefined") module.exports = DRAGONS;
