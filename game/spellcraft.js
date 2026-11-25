/* Spell crafting at the College of Winterhold ([OURS], after Morrowind's spellmaking): combine one or two effects
   from spells you already know into a spell of your own. Each effect keeps the strength limits of the spell it came
   from (you can make it weaker, never stronger), and the finished spell costs what its parts would cost to cast on
   their own — each at its own school's skill — times a crafting premium (×1.1 for one effect, ×1.35 for two), so a
   crafted spell is never a cheaper way to do what a bought spell does. Paralyze, Fear, Calm and Turn Undead can't be
   paired with each other (no locking a foe forever). Crafted spells live in your save (s.customSpells) and are
   registered into D.SPELLS as ordinary spells (kind "custom"), so the Magic menu, tactics, dual casting and costs work
   as for any other spell. Each effect is a hidden part-spell ("<id>~0") cast through the normal fight code. */
const SPELLCRAFT = (() => {
  const MAX = 8, NAME_MAX = 28, FEE_MULT = 4, PREMIUM = [1, 1.1, 1.35];
  const LEVELS = ["Novice", "Apprentice", "Adept", "Expert", "Master"];
  const TOWN = "Winterhold";
  // effects you can take from a known spell: by kind (and element). Utility, bound weapons, raised dead, summons
  // and invisibility stay as they are (they don't combine sensibly in a single cast)
  const KINDS = ["damage", "dot", "cloak", "rune", "heal", "regen", "ward", "armor", "paralyze", "fear", "calm", "turn", "courage", "soultrap"];
  const SCALES = new Set(["damage", "dot", "cloak", "rune", "heal", "regen", "ward", "armor", "courage"]);   // strength you can turn down
  const CONTROL = new Set(["paralyze", "fear", "calm", "turn"]);
  const LABEL = { damage: "damage", dot: "burning ground", cloak: "cloak", rune: "rune", heal: "Heal", regen: "Heal over time", ward: "Ward",
    armor: "Armor", paralyze: "Paralyze", fear: "Fear", calm: "Calm", turn: "Turn undead", courage: "Courage", soultrap: "Soul trap" };
  const ELN = { fire: "Fire", frost: "Frost", shock: "Shock", sun: "Sun" };

  const keyOf = (sp) => sp.kind + (sp.element && ["damage", "dot", "cloak", "rune"].includes(sp.kind) ? ":" + sp.element : "");
  const compName = (key) => { const [k, el] = key.split(":"); return el ? `${ELN[el] || el} ${LABEL[k]}` : LABEL[k]; };

  /* every effect you can craft with, from the spells you know: the strongest known spell of each kind sets the limits */
  function components(s) {
    const out = {};
    for (const id of s.spells || []) {
      const sp = D.SPELLS[id];
      if (!sp || sp.kind === "custom" || sp.hidden || !KINDS.includes(sp.kind)) continue;
      const k = keyOf(sp), cur = out[k];
      if (!cur || (sp.amount || 0) > (D.SPELLS[cur.src].amount || 0) || ((sp.amount || 0) === (D.SPELLS[cur.src].amount || 0) && sp.cost < D.SPELLS[cur.src].cost)) out[k] = { key: k, src: id };
    }
    return Object.values(out).map((c) => {
      const sp = D.SPELLS[c.src];
      return { ...c, name: compName(c.key), school: sp.school, level: sp.level || "Novice", kind: sp.kind, max: sp.amount || 0, scales: SCALES.has(sp.kind) && (sp.amount || 0) > 0,
        min: SCALES.has(sp.kind) ? Math.max(1, Math.round((sp.amount || 0) * 0.3)) : sp.amount || 0 };
    }).sort((a, b) => a.school.localeCompare(b.school) || a.name.localeCompare(b.name));
  }

  /* the part-spell for one chosen effect: the source spell, at the chosen strength */
  function partFrom(s, choice) {
    const comps = components(s), c = comps.find((x) => x.key === choice.key);
    if (!c) return null;
    const src = D.SPELLS[c.src];
    const amt = c.scales ? Math.max(c.min, Math.min(c.max, Math.round(+choice.amount || c.max))) : c.max;
    const ratio = c.scales && c.max ? amt / c.max : 1;
    const { name, xp, hidden, ...rest } = src;
    return { ...rest, key: c.key, src: c.src, amount: amt, cost: Math.max(1, Math.round(src.cost * ratio)), xp: Math.max(1, Math.round((src.xp || 5) * ratio)), level: src.level || "Novice", label: c.name };
  }

  /* check a design and work out what it would be. -> {parts, school, level, base, err?} */
  function design(s, choices) {
    choices = (choices || []).filter((c) => c && c.key).slice(0, 2);
    if (!choices.length) return { err: "Pick at least one effect." };
    if (choices.length === 2 && choices[0].key === choices[1].key) return { err: "Pick two different effects." };
    const parts = choices.map((c) => partFrom(s, c));
    if (parts.some((p) => !p)) return { err: "You can only use effects from spells you know." };
    if (parts.filter((p) => CONTROL.has(p.kind)).length > 1) return { err: "Paralyze, Fear, Calm and Turn Undead can't be combined with each other." };
    const top = [...parts].sort((a, b) => b.cost - a.cost)[0];
    const level = LEVELS[Math.max(...parts.map((p) => LEVELS.indexOf(p.level)))];
    return { parts, school: top.school, level, base: Math.round(parts.reduce((a, p) => a + p.cost, 0) * PREMIUM[parts.length]) };
  }
  /* what it costs you to cast, right now (each part at its own school's skill, then the premium) */
  function castCost(s, d) {   // same as the game will charge once it's made (spells above your level cost more)
    return Math.max(1, Math.round(d.parts.reduce((a, p) => a + G.spellCost(s, { ...p }) * (1 + Math.max(0, LEVELS.indexOf(p.level) * 25 - G.skill(s, p.school)) / 100), 0) * PREMIUM[d.parts.length]));
  }
  const fee = (d) => Math.max(50, Math.round(d.base * FEE_MULT));
  const autoName = (d) => d.parts.map((p) => p.label).join(" & ");

  /* put a save's crafted spells into D.SPELLS (on load, and after crafting) */
  /* one crafted spell and its hidden parts into D.SPELLS: yours, or a teammate's in a shared party fight (partyspells.js) */
  function define(c) {
    c.parts.forEach((p, i) => { D.SPELLS[`${c.id}~${i}`] = { ...p, name: p.label, hidden: true }; });
    D.SPELLS[c.id] = { name: c.name, school: c.school, level: c.level, cost: c.base, kind: "custom", amount: 1, xp: 0, parts: c.parts.map((_, i) => `${c.id}~${i}`), custom: true };
    return D.SPELLS[c.id];
  }
  function register(s) {
    for (const c of s.customSpells || []) {
      define(c);
      if (!s.spells.includes(c.id)) s.spells.push(c.id);
    }
    return s;
  }
  function craft(s, choices, name, t = G.now()) {
    if (s.location !== TOWN) return { err: "Spells are crafted at the College of Winterhold." };
    if ((s.customSpells || []).length >= MAX) return { err: `You can keep ${MAX} crafted spells. Forget one first.` };
    const d = design(s, choices); if (d.err) return d;
    const price = fee(d);
    if (s.gold < price) return { err: `The College asks ${price} gold for the work. You have ${s.gold}.` };
    name = String(name || "").replace(/[<>"`]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX) || autoName(d);
    if (Object.values(D.SPELLS).some((x) => !x.hidden && x.name.toLowerCase() === name.toLowerCase())) name = `${name} II`;
    s.csNext = (s.csNext || 0) + 1;
    const id = `cs_${s.id || "me"}_${s.csNext}`.replace(/[^\w]/g, "_");
    s.gold -= price;
    s.customSpells = [...(s.customSpells || []), { id, name, school: d.school, level: d.level, base: d.base, parts: d.parts, t }];
    register(s);
    const sk = G.useSkill(s, d.school, 20 + d.base / 4);
    return { id, text: ` The College's spellwrights bind ${d.parts.map((p) => p.label).join(" and ")} into "${name}" (${price} gold). Find it in the Magic menu and use it in your next fight.` + (sk.length ? " " + sk.join(". ") : "") };
  }
  function forget(s, id) {
    const c = (s.customSpells || []).find((x) => x.id === id); if (!c) return "You don't have that spell.";
    s.customSpells = s.customSpells.filter((x) => x.id !== id);
    s.spells = s.spells.filter((x) => x !== id);
    for (const lo of Object.values(s.loadouts || {})) if (lo.rules) lo.rules = lo.rules.filter((r) => !String(r.do || "").endsWith(":" + id));   // its tactics rules go too
    delete D.SPELLS[id]; c.parts.forEach((_, i) => delete D.SPELLS[`${id}~${i}`]);
    return `You let "${c.name}" fade from memory.`;
  }

  // ---- hooks into the magic system: casting, costs, fail chance, dual casting
  if (typeof MAGIC !== "undefined") {
    MAGIC.KINDS.custom = (f, sp, id) => {
      const base = D.SPELLS[id], dual = (sp.amount || 1) > 1.01;
      const out = [];
      for (const pid of base.parts) { if (f.ehp <= 0 || f.endWon) break; out.push(f.cast(pid, true, dual)); }
      return `${sp.name}: ${out.join(" · ")}`;
    };
    const fail0 = MAGIC.failChance, cost0 = MAGIC.costMult, dual0 = MAGIC.dualable;
    MAGIC.failChance = (s, id) => (D.SPELLS[id]?.parts ? Math.max(...D.SPELLS[id].parts.map((p) => fail0(s, p))) : fail0(s, id));
    MAGIC.costMult = (s, id) => (D.SPELLS[id]?.parts ? 1 : cost0(s, id));
    MAGIC.dualable = (sp) => (sp?.parts ? sp.parts.some((p) => D.SPELLS[p] && dual0(D.SPELLS[p])) : dual0(sp));
  }
  return { MAX, TOWN, FEE_MULT, PREMIUM, components, design, castCost, fee, autoName, register, define, craft, forget, compName };
})();
