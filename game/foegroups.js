/* Foe archetypes and groups. [OURS]
   Remigiusz: "Humanoid enemies should be like players wearing gear that is visible with animations."
              "Humanoids can also appear as different archetypes, it also applies to undead."
              "Enemies should come in numbers too but it should be balanced."
   - Archetypes: bandits, Forsworn, draugr, skeletons, vampires and Falmer come as warriors (sword and shield, harder to hurt),
     brutes (two-handed, hit harder), archers (bow), mages (staff and spells) or rogues (dagger, quick and fragile).
     Each one changes the foe's real numbers and what it carries in the fight scene.
   - Groups: on your own, a fight against these foes is sometimes 2 of them, side by side in a front and a back row (foefield.js).
     Balanced: the group's total health is only +30% per extra foe, split between them, and they share the foe side's moves.
     Bosses, named foes and other players always come alone. Parties meet 2-6 by party size (foefield.js count). */
const FOEGROUPS = (() => {
  //            label        weapon        shield  hp     dmg    armour  look
  const ARCH = {
    warrior: { label: "warrior", wt: "sword", shield: true, hp: 1.05, dmg: 0.95, red: 0.08, look: { head: "helm" } },
    brute:   { label: "brute", wt: "battleaxe", shield: false, hp: 1.1, dmg: 1.2, red: -0.04, look: {} },
    archer:  { label: "archer", wt: "bow", shield: false, hp: 0.85, dmg: 1.05, red: 0, look: { head: "hood" } },
    mage:    { label: "mage", wt: "staff", shield: false, hp: 0.8, dmg: 1.15, red: -0.04, look: { legs: "robe", head: "hood" }, cast: true },
    rogue:   { label: "rogue", wt: "dagger", shield: false, hp: 0.85, dmg: 1.12, red: 0, look: { head: "hood" } },
    // [rows] party fights only (foefield.js composition): a healer in the back, and a leader who rallies the rest
    healer:  { label: "healer", wt: "staff", shield: false, hp: 0.85, dmg: 0.8, red: -0.04, look: { legs: "robe", head: "hood" }, cast: true, party: true },
    chief:   { label: "chief", wt: "battleaxe", shield: false, hp: 1.1, dmg: 1.0, red: 0.04, look: { head: "helm" }, party: true },
  };
  // which archetypes each kind of foe comes in (draugr mages are frost casters, like Skyrim's wights and scourges)
  const KINDS = {
    bandit: ["warrior", "brute", "archer", "mage", "rogue"],
    forsworn: ["warrior", "brute", "archer", "mage"],
    draugr: ["warrior", "brute", "archer", "mage"],
    skeleton: ["warrior", "archer"],
    vampire: ["rogue", "mage", "warrior"],
    falmer: ["warrior", "archer", "mage"],
  };
  const EL = { draugr: "frost", skeleton: "frost", vampire: "frost", falmer: "shock", forsworn: "fire", bandit: "fire" };
  const GROUP_HP = 0.3;    // each extra foe adds 30% to the group's total health
  const MAX_GROUP = 2;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function kindOf(e) {
    if (!e || e.look || e.player) return null;
    let k = null;
    try { if (typeof FIGHTART !== "undefined") k = FIGHTART.foeOf(e); } catch { k = null; }
    if (k && KINDS[k]) return k;
    const n = String(e.name || "").toLowerCase(), tg = new Set(e.tags || []);
    if (/draugr|restless|wight|scourge|deathlord/.test(n)) return "draugr";
    if (/skeleton/.test(n)) return "skeleton";
    if (/vampire/.test(n)) return "vampire";
    if (/falmer/.test(n)) return "falmer";
    if (/forsworn/.test(n)) return "forsworn";
    if (/bandit|outlaw|highwayman|thug|marauder|brigand|robber|thief/.test(n)) return "bandit";
    if (tg.has("undead") && !tg.has("big")) return "draugr";
    return null;
  }
  /* an archetype that fits the name, if the name says one ("Bandit archer", "Draugr mage"), else a random one */
  function archFor(e, kind) {
    const n = String(e.name || "").toLowerCase(), list = KINDS[kind];
    if (/archer|hunter|marksman|ranger|sniper/.test(n)) return "archer";
    if (/mage|wizard|witch|caster|shaman|wight|scourge/.test(n) && list.includes("mage")) return "mage";
    if (/brute|berserk|marauder|chief|overlord|plunderer/.test(n) && list.includes("brute")) return "brute";
    return pick(list);
  }
  const lone = (e) => !!(e.boss || e.unique || e.named || e.noGroup || e.player || e.look || e.cart || e.caravan || (e.tags || []).includes("boss"));

  /* how many come at you on your own: mostly one, sometimes two ([rows] never three: a lone hero meets 1-2) */
  function groupSize(e, level) {
    if (lone(e) || e.danger === "high") return 1;
    return Math.random() < 0.4 ? 2 : 1;
  }
  /* apply one archetype's numbers to the foe (from its base numbers, so a new wave doesn't stack) */
  function setArch(e, id) {
    const a = ARCH[id]; if (!a) return;
    e.arch = id; e.archLabel = a.label;
    e.damage = Math.max(1, Math.round(e.baseDamage * a.dmg * 10) / 10);
    e.red = Math.max(0, Math.min(0.8, (e.baseRed || 0) + a.red));
  }
  /* the turn-based fight calls this before working out the foe's health. Returns {n, hp(i)} */
  function prep(f, players = 0) {
    if (!f || !f.e) return { n: 1, hpMul: [1] };
    const kind = kindOf(f.e);
    if (!kind || lone(f.e)) return { n: 1, hpMul: [1] };
    const e = f.e;   // the same record the encounter keeps (it reads health and flee state after the fight)
    if (e.baseDamage == null) e.baseDamage = e.damage ?? 5;   // numbers before any archetype, so a second fight doesn't stack
    if (e.baseRed == null) e.baseRed = e.red || 0;
    e.archKind = kind;
    const n = players > 0 ? 1 : groupSize(e, f.s?.level || 1);
    const first = archFor(e, kind);
    e.group = [first, ...Array.from({ length: n - 1 }, () => pick(KINDS[kind]))];
    setArch(e, first);
    e.element = ARCH[first].cast ? EL[kind] || "fire" : null;
    const total = 1 + GROUP_HP * (n - 1);
    return { n, hpMul: e.group.map((id) => (total / n) * ARCH[id].hp), kind };
  }
  /* the next foe of the group steps in */
  function next(f, i) {
    const e = f.e, id = e.group?.[i]; if (!id) return null;
    setArch(e, id);
    e.element = ARCH[id].cast ? EL[e.archKind] || "fire" : null;
    return ARCH[id];
  }
  /* the fight scene: what this archetype wears and carries */
  function look(e) {
    const a = e && ARCH[e.arch]; if (!a) return null;
    return { wt: a.wt, shield: a.shield, ...a.look };
  }
  const label = (e) => (e && ARCH[e.arch] ? ARCH[e.arch].label : "");
  return { ARCH, KINDS, GROUP_HP, MAX_GROUP, kindOf, archFor, groupSize, prep, next, setArch, look, label };
})();
if (typeof module !== "undefined") module.exports = FOEGROUPS;
