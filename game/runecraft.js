/* runecraft.js: rune research and spell crafting at the Rune table. [OURS, from the design list item 12:
   "a spell is built from element × delivery × modifier × cost, within a fixed power budget"]
   1. Runes. Every part of a spell is a rune you have to find first: six elements (fire, frost, shock, poison, healing,
      ward), six deliveries (bolt, touch, rune trap, cloak, area, over time) and six modifiers (chain, lingering, slow,
      piercing, cheap, quick). You find them by research: reading spell tomes (knowing a spell of that kind or element),
      word walls (Words of Power), Dwemer ruins you cleared and the College of Winterhold's tasks. research() checks
      what you've done and hands out what you earned (on load, after reading a tome, and when you open the table).
   2. The Rune table, at the College or any arcane enchanter: pick an element, a delivery and a modifier (two with the
      Spellwright perk), set the power (50–100% of your budget; magicka follows it) and craft it for gold. The budget
      is set by your skill in the element's school (Destruction or Restoration): your tier (Novice … Master) and how far
      into it you are. It is always 82–90% of the strongest bought spell of that tier (Rune Scholar adds up to 10%), and
      the magicka is set from the most efficient bought spell of that tier, so a crafted spell never beats the best of
      its tier, it is just yours (tests/test_spellcraft.js runs the sims).
   3. Crafted spells are ordinary spells (D.SPELLS, kind damage / rune / cloak / dot / heal / regen / ward, custom: true)
      kept in the save (s.runeSpells) and re-registered on load: the Magic tab, tactics, the Smart AI, dual casting,
      both fight systems and the cost and fail rules all work as for bought spells. Fight.cast is wrapped to add the
      modifiers: chain arcs again (and reaches the foes behind, like area spells), lingering leaves a burn (fire leaves
      burning ground in turn-by-turn fights: reactions.js), slow numbs (frost adds a chill stack: Shatter), piercing
      ignores resistances and foe wards, quick never misses and may stagger. Poison is its own element: undead,
      machines and atronachs barely feel it.
   4. Each spell gets a generated name (English and Polish) and a drawn icon (element glyph inside its delivery motif,
      a modifier badge and tier pips, in the school's colours).
   Perks (perkfx.js): Rune Scholar (budget +5% a rank), Spellwright (a second modifier), Runic Echo (crafted cloaks,
   walls and healing circles last a round longer, crafted rune traps re-arm once at half strength). */
const RUNECRAFT = (() => {
  const TIERS = ["Novice", "Apprentice", "Adept", "Expert", "Master"];
  const REQ = [0, 25, 50, 75, 100];
  const MAX = 10, NAME_MAX = 28, PW_MIN = 0.5;
  const R = Math.round, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pfx = (s, k) => (typeof PFX !== "undefined" && s ? PFX.num(s, k) || 0 : 0);
  const T = (x) => { try { if (typeof I18N !== "undefined" && I18N.lang() === "pl") { const r = I18N.tr(String(x)); if (r != null) return r; } } catch (e) { /* English */ } return x; };

  // ------------------------------------------------------------------ the runes
  // element: school, which bought spells set its budget (ref), the damage element
  const ELEMENTS = {
    fire: { name: "Fire", school: "Destruction", ref: "dmg", el: "fire", col: "#ff8c42" },
    frost: { name: "Frost", school: "Destruction", ref: "dmg", el: "frost", col: "#9fdcff" },
    shock: { name: "Shock", school: "Destruction", ref: "dmg", el: "shock", col: "#d6bcff" },
    poison: { name: "Poison", school: "Destruction", ref: "dmg", el: "poison", col: "#9fe26a" },
    healing: { name: "Healing", school: "Restoration", ref: "heal", col: "#f2dc84" },
    ward: { name: "Ward", school: "Restoration", ref: "ward", col: "#a9d8ff" },
  };
  /* delivery: per budget family (dmg/heal/ward): [spell kind, power ×, magicka ×, turns]. Missing = not possible. */
  const DELIVERIES = {
    bolt: { name: "Bolt", dmg: ["damage", 1, 1], heal: ["heal", 1, 1], ward: ["ward", 1, 1] },
    touch: { name: "Touch", dmg: ["damage", 1, 0.95], heal: ["heal", 1, 0.95], ward: ["ward", 1, 0.95] },
    rune: { name: "Rune trap", dmg: ["rune", 1.4, 1.45] },
    cloak: { name: "Cloak", dmg: ["cloak", 0.15, 1.6, 10], heal: ["regen", 0.12, 1.7, 9], ward: ["ward", 0.6, 1.3] },
    area: { name: "Area", dmg: ["damage", 0.8, 1.35], area: true },
    over: { name: "Over time", dmg: ["dot", 0.4, 1.7, 4], heal: ["regen", 0.2, 1.6, 5] },
  };
  /* modifier: power ×, magicka ×, which families and deliveries it fits */
  const MODS = {
    chain: { name: "Chain", pow: 0.65, cost: 1.15, fam: { dmg: ["bolt", "touch", "area"], heal: ["bolt", "touch"] } },
    lingering: { name: "Lingering", pow: 0.65, cost: 1.15, fam: { dmg: ["bolt", "touch", "area"], heal: ["bolt", "touch"], ward: ["bolt", "touch", "cloak"] } },
    slow: { name: "Slow", pow: 0.85, cost: 1.05, fam: { dmg: ["bolt", "touch", "area", "over"] } },
    piercing: { name: "Piercing", pow: 0.85, cost: 1.05, fam: { dmg: ["bolt", "touch", "rune", "cloak", "area", "over"] } },
    cheap: { name: "Cheap", pow: 0.75, cost: 0.74, fam: { dmg: ["bolt", "touch", "rune", "cloak", "area", "over"], heal: ["bolt", "touch", "cloak", "over"], ward: ["bolt", "touch", "cloak"] } },
    quick: { name: "Quick", pow: 0.85, cost: 1, fam: { dmg: ["bolt", "touch", "area"] } },
  };
  const LINGER = { share: 0.15, turns: 3 }, CHAIN = 0.5, QUICK_STAGGER = 0.2, WARD_MEND = { share: 0.06, turns: 6 }, ALLY_HEAL = 0.5;
  const famOf = (el) => ELEMENTS[el]?.ref;

  // what each rune does, in plain words (the tiles and the rune list)
  const WHAT = {
    fire: "Burns. Sets foes burning and lights oil into burning ground.",
    frost: "Chills and slows. A power attack on a chilled foe Shatters it.",
    shock: "Jolts. Drains mages and can interrupt their spells.",
    poison: "Eats at the living. Undead, machines and atronachs barely feel it.",
    healing: "Mends your wounds.",
    ward: "A shield against spells, breath and enchanted blows.",
    bolt: "One hit at range.",
    touch: "A hit up close. Costs a little less magicka than a bolt.",
    rune: "A trap on the ground. Hits hard when the foe moves onto it.",
    cloak: "Wraps around you and works every round.",
    area: "A burst that also reaches the foes waiting behind.",
    over: "Works every round for a few rounds.",
    chain: "Arcs again for half, and jumps to the foes behind. Healing jumps to your allies.",
    lingering: "Leaves a burn for 3 rounds. Fire leaves burning ground. Healing leaves a glow, wards mend.",
    slow: "Numbs the foe so it acts later. Frost adds another chill (Shatter).",
    piercing: "Ignores resistances and the foe's own wards.",
    cheap: "Much less magicka, a little weaker.",
    quick: "Never misses, and staggers now and then.",
  };
  /* where each rune is found. test(s, k) -> true when earned; how: the hint while it's not */
  const words = (s) => (s.words || []).length;
  const dwemer = (s) => { try { return Object.keys(s.cleared || {}).filter((n) => typeof DUNGEONS !== "undefined" && DUNGEONS.info(n)?.theme === "dwemer").length; } catch (e) { return 0; } };
  const college = (s) => { const q = (s.quests || {}).college; return q ? (q.done ? 99 : q.stage || 0) : 0; };
  const knows = (s, fn) => (s.spells || []).some((id) => { const sp = D.SPELLS[id]; return sp && !sp.custom && !sp.hidden && fn(sp, id); });
  const RUNES = {
    fire: { g: "el", how: "Read a fire spell tome.", test: (s) => knows(s, (sp) => sp.element === "fire") },
    frost: { g: "el", how: "Read a frost spell tome.", test: (s) => knows(s, (sp) => sp.element === "frost") },
    shock: { g: "el", how: "Read a shock spell tome.", test: (s) => knows(s, (sp) => sp.element === "shock") },
    poison: { g: "el", how: "Clear a Dwemer ruin (Falmer venom), or reach Alchemy 40.", test: (s) => dwemer(s) >= 1 || G.skill(s, "Alchemy") >= 40 },
    healing: { g: "el", how: "Read a healing spell tome.", test: (s) => knows(s, (sp) => sp.kind === "heal" || sp.kind === "regen") },
    ward: { g: "el", how: "Read a ward spell tome.", test: (s) => knows(s, (sp) => sp.kind === "ward") },
    bolt: { g: "dl", how: "Everyone knows this one.", test: () => true },
    touch: { g: "dl", how: "Everyone knows this one.", test: () => true },
    rune: { g: "dl", how: "Read a rune spell tome, or do the College's first lesson.", test: (s) => knows(s, (sp) => sp.kind === "rune") || college(s) >= 1 },
    cloak: { g: "dl", how: "Read a cloak spell tome, or learn 2 Words of Power at word walls.", test: (s) => knows(s, (sp) => sp.kind === "cloak") || words(s) >= 2 },
    area: { g: "dl", how: "Read a tome for a spell that hits a group (Fireball, Chain Lightning…), or clear a Dwemer ruin.", test: (s) => knows(s, (sp) => !!sp.area || sp.kind === "dot") || dwemer(s) >= 1 },
    over: { g: "dl", how: "Read a tome for a wall or a healing circle, or join the College's dig at Saarthal.", test: (s) => knows(s, (sp) => sp.kind === "dot" || sp.kind === "regen") || college(s) >= 2 },
    chain: { g: "md", how: "Clear 2 Dwemer ruins (their arc coils), or read Chain Lightning.", test: (s) => dwemer(s) >= 2 || (s.spells || []).includes("chain_lightning") },
    lingering: { g: "md", how: "Join the College's dig at Saarthal, or read a wall spell tome.", test: (s) => college(s) >= 2 || knows(s, (sp) => sp.kind === "dot") },
    slow: { g: "md", how: "Learn 3 Words of Power at word walls.", test: (s) => words(s) >= 3 },
    piercing: { g: "md", how: "Clear a Dwemer ruin (their focusing lenses).", test: (s) => dwemer(s) >= 1 },
    cheap: { g: "md", how: "Do the College's first lesson for Faralda.", test: (s) => college(s) >= 1 },
    quick: { g: "md", how: "Learn a Word of Power at a word wall.", test: (s) => words(s) >= 1 },
  };
  const NAMES = { ...Object.fromEntries(Object.entries(ELEMENTS).map(([k, v]) => [k, v.name])), ...Object.fromEntries(Object.entries(DELIVERIES).map(([k, v]) => [k, v.name])), ...Object.fromEntries(Object.entries(MODS).map(([k, v]) => [k, v.name])) };
  const GROUPS = [["el", "Element"], ["dl", "Delivery"], ["md", "Modifier"]];
  const known = (s) => new Set(s.runes || []);
  /* research: hand out every rune you've earned. Returns the new ones (ids). */
  function research(s) {
    if (!s) return [];
    const have = known(s), fresh = [];
    for (const [k, r] of Object.entries(RUNES)) { let ok = false; try { ok = r.test(s); } catch (e) { ok = false; } if (ok && !have.has(k)) { have.add(k); fresh.push(k); } }
    if (fresh.length || !Array.isArray(s.runes)) s.runes = [...have];
    return fresh;
  }
  const freshText = (fresh) => (fresh.length ? ` New ${fresh.length > 1 ? "runes" : "rune"} for the Rune table: ${fresh.map((k) => NAMES[k]).join(", ")}.` : "");

  // ------------------------------------------------------------------ the power budget
  /* the bought spells each budget is measured against: best amount and best amount per magicka, per tier */
  let refCache = null;
  function refs() {
    if (refCache) return refCache;
    const fam = { dmg: (sp) => sp.kind === "damage" && ["fire", "frost", "shock"].includes(sp.element), heal: (sp) => sp.kind === "heal", ward: (sp) => sp.kind === "ward" };
    const out = {};
    for (const [k, fn] of Object.entries(fam)) {
      out[k] = TIERS.map(() => null);
      for (const sp of Object.values(D.SPELLS)) {
        if (!sp || sp.custom || sp.hidden || sp.rc || !fn(sp) || !(sp.cost > 0) || !(sp.amount > 0)) continue;
        const t = TIERS.indexOf(sp.level || "Novice"); if (t < 0) continue;
        const cur = out[k][t] || { amt: 0, eff: 0 };
        out[k][t] = { amt: Math.max(cur.amt, sp.amount), eff: Math.max(cur.eff, sp.amount / sp.cost) };
      }
      for (let t = 0; t < TIERS.length; t++) if (!out[k][t]) { const lo = out[k].slice(0, t).reverse().find(Boolean); out[k][t] = lo ? { amt: lo.amt * 1.35, eff: lo.eff * 0.9 } : { amt: 10, eff: 0.5 }; }
    }
    /* the same kind of bought spell in the same tier (runes, cloaks, walls, healing circles, wards): a crafted one never
       does more in total, or more per magicka, than the best of them */
    const tot = (sp) => (["cloak", "dot", "regen"].includes(sp.kind) ? sp.amount * (sp.turns || 1) : sp.amount);
    out.kind = {};
    for (const sp of Object.values(D.SPELLS)) {
      if (!sp || sp.custom || sp.hidden || sp.rc || !(sp.cost > 0) || !(sp.amount > 0) || !["damage", "rune", "cloak", "dot", "heal", "regen", "ward"].includes(sp.kind)) continue;
      if (["damage", "rune", "cloak", "dot"].includes(sp.kind) && sp.element && !["fire", "frost", "shock"].includes(sp.element)) continue;
      const t = TIERS.indexOf(sp.level || "Novice"); if (t < 0) continue;
      const row = out.kind[sp.kind] || (out.kind[sp.kind] = TIERS.map(() => null)), cur = row[t] || { tot: 0, eff: 0, per: 0 };
      row[t] = { tot: Math.max(cur.tot, tot(sp)), eff: Math.max(cur.eff, tot(sp) / sp.cost), per: Math.max(cur.per, sp.amount) };
    }
    return (refCache = out);
  }
  const tierOf = (skill) => { let t = 0; for (let i = 0; i < REQ.length; i++) if (skill >= REQ[i]) t = i; return t; };
  /* your budget for an element: { tier, prog, k (share of the best bought spell), amt, eff, skill, school } */
  function budget(s, el) {
    const E = ELEMENTS[el]; if (!E) return null;
    const skill = G.skill(s, E.school), t = tierOf(skill), prog = t >= 4 ? 1 : clamp((skill - REQ[t]) / 25, 0, 1);
    const k = (0.82 + 0.08 * prog) * (1 + Math.min(0.1, pfx(s, "rcbudget")));
    const ref = refs()[E.ref][t];
    return { tier: t, level: TIERS[t], prog, k, amt: ref.amt * k, eff: ref.eff * EFF, skill, school: E.school };
  }
  const EFF = 0.9;   // crafted spells get at most 90% of the best bought spell's damage (or healing) per magicka
  const modSlots = (s) => 1 + (pfx(s, "rcmods") > 0 ? 1 : 0);   // Spellwright
  /* check a design. spec: { el, dl, mods: [], pw }. -> stats or { err } */
  function design(s, spec) {
    spec = spec || {};
    const el = spec.el, dl = spec.dl, mods = [...new Set((spec.mods || []).filter(Boolean))], pw = clamp(+spec.pw || 1, PW_MIN, 1);
    if (!ELEMENTS[el]) return { err: "Pick an element." };
    if (!DELIVERIES[dl]) return { err: "Pick a delivery." };
    const have = known(s);
    if (!have.has(el) || !have.has(dl) || mods.some((m) => !have.has(m))) return { err: "You haven't found that rune yet." };
    const fam = famOf(el), D0 = DELIVERIES[dl][fam];
    if (!D0) return { err: `${ELEMENTS[el].name} can't be cast as ${DELIVERIES[dl].name.toLowerCase()}.` };
    if (mods.length > modSlots(s)) return { err: modSlots(s) > 1 ? "Two modifiers at most." : "One modifier (the Spellwright perk allows two)." };
    for (const m of mods) if (!MODS[m] || !(MODS[m].fam[fam] || []).includes(dl)) return { err: `${MODS[m]?.name || m} doesn't fit ${ELEMENTS[el].name.toLowerCase()} ${DELIVERIES[dl].name.toLowerCase()}.` };
    const b = budget(s, el);
    const [kind, dPow, dCost, turns] = D0;
    const mPow = mods.reduce((a, m) => a * MODS[m].pow, 1), mCost = mods.reduce((a, m) => a * MODS[m].cost, 1);
    const base = b.amt * pw;                        // a plain bolt of this power
    let a0 = base * dPow, c0 = base / b.eff * dCost;   // this delivery, before the modifiers
    const n = kind === "cloak" || kind === "dot" || kind === "regen" ? (turns || 5) + (pfx(s, "rcturns") > 0 ? 1 : 0) : 1;
    const sk = refs().kind[kind]?.[b.tier];
    if (sk && !["damage", "heal", "ward"].includes(kind)) { a0 = Math.min(a0, (sk.tot * b.k * pw) / n, sk.per * b.k * pw); c0 = Math.max(c0, (a0 * n) / (sk.eff * EFF)); }
    const amount = Math.max(1, Math.floor(a0 * mPow * 10) / 10);
    const cost = Math.max(5, Math.ceil(c0 * mCost), Math.ceil(amount * (c0 / a0) * (mCost / mPow)));
    return { el, dl, mods, pw, kind, amount, cost, turns: turns || 0, level: b.level, tier: b.tier, school: b.school, budget: b,
      area: !!DELIVERIES[dl].area || mods.includes("chain"), element: ELEMENTS[el].el || null, share: pw };
  }
  const fee = (d) => Math.max(60, R(40 + d.cost * 3 + d.tier * 60));

  // ------------------------------------------------------------------ names
  const NM = {
    el: { fire: ["Ember", "Cinder", "Blaze"], frost: ["Rime", "Frost", "Glacial"], shock: ["Storm", "Spark", "Thunder"], poison: ["Venom", "Blight", "Bile"], healing: ["Mending", "Dawn", "Balm"], ward: ["Aegis", "Bulwark", "Haven"] },
    dl: { bolt: ["Bolt", "Lance", "Dart"], touch: ["Touch", "Grasp", "Palm"], rune: ["Rune", "Snare", "Glyph"], cloak: ["Cloak", "Mantle", "Shroud"], area: ["Burst", "Nova", "Tempest"], over: ["Wall", "Field", "Tide"] },
    md: { chain: ["Forking", "Chained"], lingering: ["Lingering", "Smouldering"], slow: ["Numbing", "Binding"], piercing: ["Piercing", "Keen"], cheap: ["Humble", "Thrifty"], quick: ["Swift", "Snap"] },
  };
  const PLN = {
    el: { fire: ["Żaru", "Popiołu", "Płomienia"], frost: ["Szronu", "Mrozu", "Lodu"], shock: ["Burzy", "Iskier", "Gromu"], poison: ["Jadu", "Zarazy", "Żółci"], healing: ["Ukojenia", "Świtu", "Balsamu"], ward: ["Osłony", "Tarczy", "Schronienia"] },
    dl: { bolt: [["Pocisk", "m"], ["Grot", "m"], ["Strzała", "f"]], touch: [["Dotyk", "m"], ["Uścisk", "m"], ["Dłoń", "f"]], rune: [["Runa", "f"], ["Pułapka", "f"], ["Znak", "m"]], cloak: [["Płaszcz", "m"], ["Okrycie", "n"], ["Całun", "m"]], area: [["Wybuch", "m"], ["Fala", "f"], ["Nawałnica", "f"]], over: [["Ściana", "f"], ["Pole", "n"], ["Przypływ", "m"]] },
    md: { chain: [["Rozwidlony", "Rozwidlona", "Rozwidlone"], ["Łańcuchowy", "Łańcuchowa", "Łańcuchowe"]], lingering: [["Tlący", "Tląca", "Tlące"], ["Trwały", "Trwała", "Trwałe"]], slow: [["Drętwiący", "Drętwiąca", "Drętwiące"], ["Wiążący", "Wiążąca", "Wiążące"]],
      piercing: [["Przeszywający", "Przeszywająca", "Przeszywające"], ["Ostry", "Ostra", "Ostre"]], cheap: [["Skromny", "Skromna", "Skromne"], ["Oszczędny", "Oszczędna", "Oszczędne"]], quick: [["Szybki", "Szybka", "Szybkie"], ["Nagły", "Nagła", "Nagłe"]] },
  };
  /* a name from the parts and a seed: "Swift Rime Lance" / "Szybki Grot Szronu" */
  function names(d, seed) {
    const n = (arr, k) => arr[Math.abs(Math.floor(seed / k)) % arr.length];
    const m = d.mods[0], e = n(NM.el[d.el], 1), dl = n(NM.dl[d.dl], 3), md = m ? n(NM.md[m], 7) : "";
    const pe = n(PLN.el[d.el], 1), [pd, g] = n(PLN.dl[d.dl], 3), pmArr = m ? n(PLN.md[m], 7) : null, pm = pmArr ? pmArr[{ m: 0, f: 1, n: 2 }[g]] : "";
    const en = (md ? md + " " : "") + e + " " + dl, pl = (pm ? pm + " " : "") + pd + " " + pe;
    return { en, pl };
  }
  function addPolish(en, pl) { try { if (typeof I18N !== "undefined" && I18N.add && en && pl) I18N.add({}, { [en]: pl }); } catch (e) { /* no Polish */ } }

  // ------------------------------------------------------------------ crafted spells in the save
  const where = (s) => (s.location === "Winterhold" ? "College" : typeof ENCH !== "undefined" && ENCH.atEnchanter && ENCH.atEnchanter(s) ? "Enchanter" : null);
  const canCraftHere = (s) => !!where(s);
  function entry(c) {
    const turns = c.turns || undefined;
    const sp = { name: c.name, school: c.school, level: c.level, cost: c.cost, kind: c.kind, amount: c.amount, xp: Math.max(4, R(c.cost * 0.5)), custom: true,
      rc: { el: c.el, dl: c.dl, mods: c.mods || [], pw: c.pw }, desc: describe(c) };
    if (c.element) sp.element = c.element;
    if (turns) sp.turns = turns;
    if (c.area) sp.area = true;
    if (c.kind === "regen" && !turns) sp.turns = 5;
    return sp;
  }
  /* put a save's crafted spells into D.SPELLS (on load and after crafting) */
  function register(s) {
    if (!s) return s;
    for (const c of s.runeSpells || []) {
      D.SPELLS[c.id] = entry(c);
      if (c.pl) addPolish(c.name, c.pl);
      s.spells = s.spells || [];
      if (!s.spells.includes(c.id)) s.spells.push(c.id);
    }
    return s;
  }
  function craft(s, spec, name, t = (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000)) {
    if (!canCraftHere(s)) return { err: "You need the Rune table: at the College of Winterhold or an arcane enchanter." };
    if ((s.runeSpells || []).length >= MAX) return { err: `You can keep ${MAX} rune spells. Forget one first.` };
    const d = design(s, spec); if (d.err) return d;
    const price = fee(d);
    if ((s.gold || 0) < price) return { err: `The work takes ${price} gold. You have ${s.gold || 0}.` };
    s.rcNext = (s.rcNext || 0) + 1;
    const id = `rc_${String(s.id || "me").replace(/[^\w]/g, "_")}_${s.rcNext}`;
    const auto = names(d, s.rcNext * 7 + (s.runeSpells || []).length * 13 + d.cost);
    let nm = String(name || "").replace(/[<>"`]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
    const own = !!nm; if (!nm) nm = auto.en;
    if (Object.entries(D.SPELLS).some(([k, x]) => k !== id && !x.hidden && String(x.name).toLowerCase() === nm.toLowerCase())) nm = `${nm} II`.slice(0, NAME_MAX + 3);
    s.gold -= price;
    const rec = { id, name: nm, pl: own ? null : auto.pl, el: d.el, dl: d.dl, mods: d.mods, pw: d.pw, kind: d.kind, amount: d.amount, cost: d.cost, turns: d.turns, area: d.area, element: d.element, school: d.school, level: d.level, t };
    if (rec.pl && nm !== auto.en) rec.pl = rec.pl + " II";
    s.runeSpells = [...(s.runeSpells || []), rec];
    register(s);
    const sk = G.useSkill ? G.useSkill(s, d.school, 15 + d.cost / 5) : [];
    if (G.useSkill && G.skill(s, "Enchanting") != null && s.skills?.Enchanting) G.useSkill(s, "Enchanting", 8);
    return { id, rec, text: `You trace the runes and bind them: "${nm}" (${price} gold). Add it to your tactics or cast it from the Magic tab.` + (sk && sk.length ? " " + sk.join(". ") : "") };
  }
  function forget(s, id) {
    const c = (s.runeSpells || []).find((x) => x.id === id); if (!c) return "You don't have that spell.";
    s.runeSpells = s.runeSpells.filter((x) => x.id !== id);
    s.spells = (s.spells || []).filter((x) => x !== id);
    for (const lo of Object.values(s.loadouts || {})) if (lo && lo.rules) lo.rules = lo.rules.filter((r) => !String(r.do || "").endsWith(":" + id));
    delete D.SPELLS[id];
    return `You let "${c.name}" fade from memory.`;
  }

  // ------------------------------------------------------------------ plain words
  /* what a spell does, in plain words; the Polish line is registered with it (the screens translate on their own) */
  const turnsTxt = (n) => `${n} ${n === 1 ? "round" : "rounds"}`;
  const plTurns = (n) => `${n} ${n === 1 ? "rundę" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "rundy" : "rund"}`;
  const PLEL = { fire: "od ognia", frost: "od mrozu", shock: "od porażenia", poison: "od trucizny" };
  function describe(c) {
    const E = ELEMENTS[c.el], a = R(c.amount), en = [], pl = [], el = E.name.toLowerCase(), pe = PLEL[c.el] || "";
    const add = (e, p) => { en.push(e); pl.push(p); };
    if (c.kind === "damage") add(`${a} ${el} damage${c.dl === "area" ? ", also reaching the foes behind" : c.dl === "touch" ? " up close" : ""}`, `${a} obrażeń ${pe}${c.dl === "area" ? ", sięga też wrogów z tyłu" : c.dl === "touch" ? " z bliska" : ""}`);
    else if (c.kind === "rune") add(`a rune trap: ${a} ${el} damage when the foe steps on it`, `runa-pułapka: ${a} obrażeń ${pe}, gdy wróg na nią wejdzie`);
    else if (c.kind === "cloak") add(`a cloak: ${a} ${el} damage every round for ${turnsTxt(c.turns)}`, `płaszcz: ${a} obrażeń ${pe} co rundę przez ${plTurns(c.turns)}`);
    else if (c.kind === "dot") add(`${a} ${el} damage every round for ${turnsTxt(c.turns)}`, `${a} obrażeń ${pe} co rundę przez ${plTurns(c.turns)}`);
    else if (c.kind === "heal") add(`heals ${a}`, `leczy ${a}`);
    else if (c.kind === "regen") add(`heals ${a} every round for ${turnsTxt(c.turns || 5)}`, `leczy ${a} co rundę przez ${plTurns(c.turns || 5)}`);
    else if (c.kind === "ward") add(`a ward of ${a}${c.dl === "cloak" ? ` that mends itself for ${turnsTxt(WARD_MEND.turns)}` : ""}`, `osłona ${a}${c.dl === "cloak" ? `, która sama się odnawia przez ${plTurns(WARD_MEND.turns)}` : ""}`);
    for (const m of c.mods || []) { const [e, p] = MODLINE[m](c); add(e, p); }
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1) + ".";
    const out = cap(en.join("; "));
    addPolish(out, cap(pl.join("; ")));
    return out;
  }
  const MODLINE = {
    chain: (c) => (famOf(c.el) === "heal" ? ["the light jumps to your allies for half", "światło przeskakuje na sojuszników za połowę"] : ["arcs again for half and jumps to the foes behind", "przeskakuje drugi raz za połowę i sięga wrogów z tyłu"]),
    lingering: (c) => (famOf(c.el) === "heal" ? ["leaves a healing glow", "zostawia leczącą poświatę"] : famOf(c.el) === "ward" ? ["the ward mends itself", "osłona sama się odnawia"] : c.el === "fire" ? ["leaves burning ground", "zostawia płonącą ziemię"] : ["leaves a lingering burn", "zostawia długo piekący ślad"]),
    slow: (c) => (c.el === "frost" ? ["numbs and chills deeper", "otępia i mrozi głębiej"] : ["numbs the foe", "otępia wroga"]),
    piercing: () => ["ignores resistances and wards", "omija odporności i osłony"],
    cheap: () => ["cheap to cast", "tani w rzucaniu"],
    quick: () => ["never misses, may stagger", "nigdy nie chybia, może zachwiać wrogiem"],
  };

  // ------------------------------------------------------------------ in fights
  /* poison: living foes feel it fully, beasts a bit more; undead, machines, atronachs and spirits hardly at all */
  function poisonK(f) {
    if (!f || !f.e) return 1;
    const n = f.e.name || "", tags = f.tags || new Set();
    if (tags.has("undead") || tags.has("construct") || /atronach|ghost|wisp|spirit|centurion|sphere|spider \(dwarven\)|dwarven/i.test(n)) return 0.25;
    if (tags.has("beast") || tags.has("animal") || /wolf|bear|sabre|skeever|troll|spriggan|chaurus/i.test(n)) return 1.15;
    return 1;
  }
  function installMagic() {
    if (typeof MAGIC === "undefined" || MAGIC.__rc) return;
    MAGIC.__rc = true;
    const e0 = MAGIC.elem;
    MAGIC.elem = (f, el) => { let v = el === "poison" ? poisonK(f) : e0(f, el); if (f && f._rcPierce) v = Math.max(1, v); return v; };
    const tick0 = MAGIC.tick;
    MAGIC.tick = (f, line) => {
      tick0(f, line);
      const m = f.rcMend;   // a crafted ward mending itself
      if (m && m.turns > 0) { if (f.ward > 0) { const b = f.ward; f.wardMax = Math.max(f.wardMax || 0, f.ward); f.ward = Math.min(f.wardMax, f.ward + m.per); if (f.ward - b >= 1 && line) line.me += ` · ward mends +${R(f.ward - b)}`; } if (--m.turns <= 0) f.rcMend = null; }
    };
    const be0 = MAGIC.beforeEnemy;
    MAGIC.beforeEnemy = (f) => { const r = be0(f); if (f.rcRearm && !f.rune && f.ehp > 0) { f.rune = f.rcRearm; f.rcRearm = null; } return r; };   // Runic Echo: the trap re-arms once
    const i0 = MAGIC.infoHTML;
    if (i0) MAGIC.infoHTML = (s, id) => { const h = i0(s, id), sp = D.SPELLS[id]; return sp && sp.rc ? h + `<p class="sub rc-desc">${runeChips(sp.rc)}${esc(sp.desc || "")}</p>` : h; };
  }
  function installFight() {
    if (typeof G === "undefined" || !G.Fight || G.Fight.prototype.__rc) return;
    const cast0 = G.Fight.prototype.cast;
    G.Fight.prototype.cast = function (id, free, dual) {
      const sp = D.SPELLS[id];
      if (!sp || !sp.rc) return cast0.call(this, id, free, dual);
      return castRune(this, cast0, id, sp, free, dual);
    };
    G.Fight.prototype.__rc = true;
  }
  function castRune(f, cast0, id, sp, free, dual) {
    const rc = sp.rc, mods = rc.mods || [], fam = famOf(rc.el), s = f.s;
    const b = f.ehp, n0 = (f.dots || []).length, hadRune = f.rune;
    let hit0 = null, fpw = null;
    if (mods.includes("quick") && typeof F !== "undefined") { hit0 = F.SPELL_HIT_CHANCE; F.SPELL_HIT_CHANCE = 1; }
    if (mods.includes("piercing")) { f._rcPierce = true; if (f.fp && f.fp.ward) { fpw = f.fp.ward; f.fp.ward = 0; } }
    let out;
    try { out = cast0.call(f, id, free, dual); } finally { if (hit0 != null) F.SPELL_HIT_CHANCE = hit0; f._rcPierce = false; if (fpw != null && f.fp) f.fp.ward = fpw; }
    if (/fizzles|misses|no effect/.test(String(out))) return out;
    const extra = [], echo = pfx(s, "rcturns") > 0 ? 1 : 0, k = dual ? (typeof MAGIC !== "undefined" ? MAGIC.DUAL_POWER : 2.2) : 1;
    const pk = rc.el === "poison" ? poisonK(f) : 1;
    // poison runes, cloaks and walls: the foe's own tolerance (magic.js ticks them without it)
    if (rc.el === "poison") {
      if (f.rune && f.rune !== hadRune) f.rune.dmg *= pk;
      if (f.cloak && sp.kind === "cloak") f.cloak.dmg *= pk;
      for (const x of (f.dots || []).slice(n0)) x.dmg *= pk;
    }
    // Runic Echo: what stays lasts a round longer; a rune trap re-arms once at half
    if (echo) {
      if (sp.kind === "cloak" && f.cloak) f.cloak.turns += 1;
      for (const x of (f.dots || []).slice(n0)) x.turns += 1;
      if (sp.kind === "regen" && f.regen && f.regen.turns) f.regen.turns += 1;
      if (sp.kind === "rune" && f.rune) f.rcRearm = { ...f.rune, dmg: f.rune.dmg * 0.5 };
    }
    const dealt = Math.max(0, b - f.ehp);
    if (fam === "dmg" && dealt > 0) {
      if (mods.includes("chain") && f.ehp > 0) { const d = dealt * CHAIN; f.ehp -= d; extra.push(`arcs again ${R(d)}`); }
      if (mods.includes("lingering") && f.ehp > 0) {
        const per = Math.max(1, sp.amount * k * LINGER.share * (rc.el === "poison" ? pk : typeof MAGIC !== "undefined" && rc.el ? MAGIC.elem(f, rc.el) : 1));
        if (rc.el === "fire" && f.tb && typeof REACT !== "undefined" && !REACT.off) {   // fire: burning ground (reactions.js ticks it at the end of each round)
          const rx = f.rx || (f.rx = {}); rx.fire = { left: Math.max(LINGER.turns, rx.fire?.left || 0), dmg: R(Math.max(per, rx.fire?.dmg || 0)) }; f._rxPend = "burn";
          extra.push("burning ground");
        } else {
          f.dots = [...(f.dots || []), { dmg: per / (rc.el === "poison" ? 1 : typeof MAGIC !== "undefined" && rc.el ? MAGIC.elem(f, rc.el) || 1 : 1), el: rc.el, turns: LINGER.turns, name: rc.el === "fire" ? "Burning ground" : `Lingering ${ELEMENTS[rc.el].name.toLowerCase()}` }];
          extra.push(rc.el === "fire" ? "the ground burns" : "it lingers");
        }
      }
      if (mods.includes("slow") && f.ehp > 0) {
        f.slowed = Math.max(f.slowed || 0, 2);
        if (rc.el === "frost" && typeof PFX !== "undefined") { const t = PFX.hitFoe(f, "frost", dealt, "spell"); extra.push(t ? "chilled deeper" : "numbed"); }
        else extra.push("numbed");
      }
      if (mods.includes("quick") && f.ehp > 0 && !f.stagger && Math.random() < QUICK_STAGGER) { f.stagger = true; extra.push("staggers"); }
    }
    if (fam === "heal") {
      if (mods.includes("chain")) { let n = 0; for (const al of f.allies || []) { if (!al || al.down || !(al.maxHp > 0) || al.hp == null) continue; const add = Math.min(al.maxHp - al.hp, sp.amount * k * ALLY_HEAL); if (add > 0) { al.hp += add; n++; } } if (n) extra.push(`the light jumps to ${n === 1 ? "an ally" : n + " allies"}`); }
      if (mods.includes("lingering")) { const per = sp.amount * k * 0.15, turns = 3; if (typeof STACKS !== "undefined") STACKS.add(f, "me", "regen", turns, { per: STACKS.perFor(per * turns / 2, turns), name: sp.name }); else f.regen = { amt: per, turns, name: sp.name }; extra.push("a healing glow stays"); }
    }
    if (fam === "ward" && (rc.dl === "cloak" || mods.includes("lingering"))) { f.rcMend = { per: sp.amount * k * WARD_MEND.share, turns: WARD_MEND.turns + echo }; extra.push("it mends itself"); }
    return extra.length ? `${out} · ${extra.join(" · ")}` : out;
  }

  // ------------------------------------------------------------------ pictures
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // 24×24 line glyphs (stroke paths): the tiles use them as SVG, the spell icons draw them with Path2D
  const GLY = {
    fire: "M12 3c1 3 5 5 5 10a5 5 0 01-10 0c0-3 2-4 2-6 1 2 2 2 3 2 0-2-1-4 0-6z",
    frost: "M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2",
    shock: "M13 2L5 13h6l-1 9 8-12h-6l1-8z",
    poison: "M12 3c3 5 6 8 6 12a6 6 0 01-12 0c0-4 3-7 6-12zM9.5 15.5a2.5 2.5 0 003 2.4",
    healing: "M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11zM12 9v6M9 12h6",
    ward: "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z",
    bolt: "M3 21L15 9M15 9l-1 6M15 9l-6 1M14 4l6 6M17 2l5 5",
    touch: "M8 13V5a1.5 1.5 0 013 0v6M11 11V3.5a1.5 1.5 0 013 0V11M14 11V5a1.5 1.5 0 013 0v8c0 5-3 8-7 8-3 0-5-2-6-5l-1.5-4a1.5 1.5 0 012.7-1.2L8 13",
    rune: "M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v10M8.5 9.5l7 5M15.5 9.5l-7 5",
    cloak: "M12 3a3 3 0 110 6 3 3 0 010-6zM6 21c0-6 2-10 6-10s6 4 6 10M3 14c1-3 2-5 3-6M21 14c-1-3-2-5-3-6",
    area: "M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3",
    over: "M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9",
    chain: "M9 15l6-6M8 11l-2 2a3.5 3.5 0 005 5l2-2M16 13l2-2a3.5 3.5 0 00-5-5l-2 2",
    lingering: "M5 20c0-4 4-4 4-8M11 20c0-5 4-5 4-10M17 20c0-3 3-3 3-6M3 20h18",
    slow: "M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v5l3 2",
    piercing: "M3 12h14M13 7l6 5-6 5M3 9v6",
    cheap: "M12 3a9 9 0 110 18 9 9 0 010-18zM12 7v10M15 9.5c-1-1-5-1.5-5 .8 0 2.7 5 1.5 5 4.2 0 2.2-4 2-5 .8",
    quick: "M4 12h9M2 8h8M5 16h8M14 5l7 7-7 7",
  };
  const svg = (k, col, size = 24) => `<svg class="rcg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${GLY[k] || ""}" fill="none" stroke="${col || "currentColor"}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const colOf = (el) => ELEMENTS[el]?.col || "#e2bb64";
  const runeChips = (rc) => `<span class="rc-chips">${[rc.el, rc.dl, ...(rc.mods || [])].map((k) => `<i class="rc-chip" title="${esc(NAMES[k])}">${svg(k, k === rc.el ? colOf(rc.el) : "#d9d4c7", 14)}</i>`).join("")}</span>`;
  const SCHOOLC = { Destruction: ["#8e3a24", "#ff8c5a"], Restoration: ["#8a7430", "#f2dc84"] };
  /* the spell's icon: medal in the school's colours, the delivery motif, the element glyph inside, a modifier badge, tier pips */
  function drawIcon(rc, level) {
    return (g) => {
      if (typeof Path2D === "undefined") return;
      const sc = SCHOOLC[ELEMENTS[rc.el]?.school] || ["#5a4a3a", "#d6b25e"], col = colOf(rc.el), INK = "#1a1410";
      const P = (k) => new Path2D(GLY[k]);
      const stroke = (k, x, y, sz, c, w) => { g.save(); g.translate(x - sz / 2, y - sz / 2); g.scale(sz / 24, sz / 24); g.strokeStyle = c; g.lineWidth = w * 24 / sz; g.lineCap = "round"; g.lineJoin = "round"; g.stroke(P(k)); g.restore(); };
      // medal
      g.beginPath(); g.arc(20, 20, 18.6, 0, 7); g.fillStyle = "#efe4cc"; g.fill(); g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.arc(20, 20, 16.4, 0, 7); g.fillStyle = "#241d16"; g.fill(); g.lineWidth = 2.4; g.strokeStyle = sc[0]; g.stroke();
      const gr = g.createRadialGradient(20, 20, 1, 20, 20, 15); gr.addColorStop(0, col + "aa"); gr.addColorStop(1, col + "00");
      g.save(); g.beginPath(); g.arc(20, 20, 15, 0, 7); g.clip(); g.fillStyle = gr; g.fillRect(0, 0, 40, 40);
      // delivery motif behind, element glyph on top
      stroke(rc.dl, 20, 20, 26, "rgba(239,228,204,.45)", 1.6);
      stroke(rc.el, 20, 20, 17, col, 2.2);
      g.restore();
      // modifier badge(s)
      (rc.mods || []).slice(0, 2).forEach((m, i) => {
        const x = 31 - i * 22, y = 9;
        g.beginPath(); g.arc(x, y, 5.6, 0, 7); g.fillStyle = "#2a2018"; g.fill(); g.lineWidth = 1; g.strokeStyle = "#e2bb64"; g.stroke();
        stroke(m, x, y, 8.5, "#f4dc9a", 1.4);
      });
      // tier pips
      const n = TIERS.indexOf(level) + 1;
      for (let i = 0; i < n; i++) { const x = 20 + (i - (n - 1) / 2) * 5; g.beginPath(); g.moveTo(x, 33.4); g.lineTo(x + 1.8, 35.4); g.lineTo(x, 37.4); g.lineTo(x - 1.8, 35.4); g.closePath(); g.fillStyle = sc[1]; g.fill(); g.lineWidth = 0.6; g.strokeStyle = INK; g.stroke(); }
    };
  }
  const iconKey = (rc, level) => `rc:${rc.el}:${rc.dl}:${(rc.mods || []).join("+")}:${level}`;
  function icon(rc, level, size = 32, alt = "") {
    if (typeof ART === "undefined" || !ART.html) return svg(rc.el, colOf(rc.el), size);
    return ART.html(size, size, (g, H, w) => { g.scale(w / 40, w / 40); drawIcon(rc, level)(g); }, { key: iconKey(rc, level), cls: "ico sico rcico", alt });
  }
  function installIcons() {
    if (typeof UIART === "undefined" || UIART.__rc) return;
    UIART.__rc = true;
    const sp0 = UIART.spell, ds0 = UIART.drawSpell;
    UIART.spell = (id, size = 32) => { const sp = D.SPELLS[id]; return sp && sp.rc ? icon(sp.rc, sp.level, size, sp.name) : sp0(id, size); };
    if (ds0) UIART.drawSpell = (id) => { const sp = D.SPELLS[id]; return sp && sp.rc ? drawIcon(sp.rc, sp.level) : ds0(id); };
  }

  // ------------------------------------------------------------------ hooks: tomes, saves
  function installHooks() {
    if (typeof G === "undefined" || G.__rc) return;
    G.__rc = true;
    if (G.readTome) { const rt0 = G.readTome; G.readTome = function (s, id) { const out = rt0.call(this, s, id); return out + freshText(research(s)); }; }
  }

  // ------------------------------------------------------------------ the Rune table (a full-screen SkyUI panel)
  const DOM = typeof document !== "undefined";
  let ui = null;   // { s, cb, tab, spec, name, msg }
  function open(s, cb = {}) {
    if (!DOM) return;
    const fresh = research(s);
    ui = { s, cb, tab: "make", spec: ui?.spec || { el: null, dl: "bolt", mods: [], pw: 1 }, name: "", msg: fresh.length ? freshText(fresh).trim() : "" };
    if (fresh.length) cb.save && cb.save();
    const have = known(s);
    if (!ui.spec.el || !have.has(ui.spec.el)) ui.spec.el = Object.keys(ELEMENTS).find((k) => have.has(k)) || null;
    close();
    const m = document.createElement("div");
    m.id = "rct"; m.className = "rct-wrap";
    m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", "Rune table");
    m.addEventListener("click", onClick); m.addEventListener("input", onInput);
    document.body.appendChild(m);
    document.addEventListener("keydown", onKey);
    render();
  }
  function close() { const m = DOM && document.getElementById("rct"); if (m) m.remove(); if (DOM) document.removeEventListener("keydown", onKey); }
  const onKey = (e) => { if (e.key === "Escape" && document.getElementById("rct")) { e.stopPropagation(); close(); ui?.cb?.refresh?.(); } };
  function tile(k, on, s, spec) {
    const r = RUNES[k], have = known(s).has(k), g = r.g;
    let fits = true;
    if (have && spec.el && g !== "el") { const fam = famOf(spec.el); fits = g === "dl" ? !!DELIVERIES[k][fam] : !!(MODS[k].fam[fam] || []).includes(spec.dl); }
    const col = g === "el" ? colOf(k) : "#d9d4c7";
    return `<button class="rct-tile ${on ? "on" : ""} ${have ? "" : "lock"} ${have && !fits ? "nofit" : ""} rg-${g}" data-rk="${g}" data-rv="${k}" aria-pressed="${on}" ${have ? "" : 'aria-disabled="true"'}>
      <span class="rct-gl" style="--rc:${col}">${svg(k, have ? col : "#6b6358", 26)}</span><b>${esc(NAMES[k])}</b>${have ? "" : `<small class="rct-lk">Not found yet</small>`}</button>`;
  }
  function makeHTML(s) {
    const sp = ui.spec, d = design(s, sp), b = sp.el ? budget(s, sp.el) : null;
    const grp = (g, label, keys, sel) => `<div class="rct-grp"><h4><span class="rct-n">${{ el: "I", dl: "II", md: "III" }[g]}</span>${label}${g === "md" ? ` <small class="rct-slots">${modSlots(s) > 1 ? "(two at most)" : "(one at most)"}</small>` : ""}</h4><div class="rct-tiles">${keys.map((k) => tile(k, sel(k), s, sp)).join("")}</div></div>`;
    const pick = `<section class="rct-pick">
      ${grp("el", "Element", Object.keys(ELEMENTS), (k) => sp.el === k)}
      ${grp("dl", "Delivery", Object.keys(DELIVERIES), (k) => sp.dl === k)}
      ${grp("md", "Modifier", Object.keys(MODS), (k) => (sp.mods || []).includes(k))}
    </section>`;
    let prev;
    if (d.err) prev = `<div class="rct-card empty"><p class="sub">${esc(d.err)}</p>${b ? budgetHTML(b, null) : ""}</div>`;
    else {
      const auto = names(d, (s.rcNext || 0) * 7 + 7 + (s.runeSpells || []).length * 13 + d.cost), price = fee(d), full = (s.runeSpells || []).length >= MAX;
      const c = { ...d, name: ui.name || auto.en };
      const castNow = (() => { try { return G.spellCost(s, { ...entry({ ...c, id: "x" }) }); } catch (e) { return d.cost; } })();
      prev = `<div class="rct-card">
        <div class="rct-top">${icon({ el: d.el, dl: d.dl, mods: d.mods }, d.level, 64, "")}<div class="rct-nm"><input id="rctName" maxlength="${NAME_MAX}" placeholder="${esc(T(auto.en))}" value="${esc(ui.name)}" autocomplete="off" aria-label="Spell name"><small><span>${esc(d.school)}</span> · <span>${esc(d.level)}</span></small></div></div>
        <p class="rct-desc">${esc(describe(c))}</p>
        <div class="rct-stats"><div><small>Magicka</small><b class="nv-mana">${castNow}</b></div><div><small>Power</small><b>${R(d.amount)}</b></div><div><small>Gold</small><b class="gold">${price}</b></div></div>
        ${budgetHTML(b, d)}
        <label class="rct-pw"><span>Power</span> <b id="rctPwV">${R(d.pw * 100)}%</b><input type="range" id="rctPw" min="${PW_MIN * 100}" max="100" step="5" value="${R(d.pw * 100)}" aria-label="Power"><small>Less power, less magicka.</small></label>
        <button class="btn pri rct-go" data-rx="craft" ${(s.gold || 0) >= price && !full ? "" : "disabled"}>${full ? `<span>Spell list full</span>` : `<span>Craft</span> <span class="gold">${price}</span> <span>gold</span>`}</button>
      </div>`;
    }
    return `<div class="rct-make">${pick}<section class="rct-side">${prev}</section></div>`;
  }
  function budgetHTML(b, d) {
    const used = d ? clamp(d.pw, 0, 1) : 0;
    return `<div class="rct-bud" role="img" aria-label="Power budget">
      <div class="rct-budh"><span>Power budget</span> <b><span>${esc(b.school)}</span> <span>${b.skill}</span></b> · <span>${esc(b.level)}</span></div>
      <div class="rct-bar"><i style="width:${R(b.k / 1 * 100)}%"></i>${d ? `<em style="width:${R(b.k * used * 100)}%"></em>` : ""}<u title="The best bought spell of this tier" style="left:100%"></u></div>
      <small>${b.tier < 4 ? `<span>Next tier at</span> <b>${REQ[b.tier + 1]}</b>. ` : ""}<span>Never stronger than the best bought spell of your tier.</span></small></div>`;
  }
  function runesHTML(s) {
    const have = known(s);
    return GROUPS.map(([g, label]) => `<div class="rct-grp"><h4>${label}</h4><div class="rct-list">${Object.keys(RUNES).filter((k) => RUNES[k].g === g).map((k) => {
      const ok = have.has(k), col = g === "el" ? colOf(k) : "#d9d4c7";
      return `<div class="rct-rune ${ok ? "" : "lock"}">${svg(k, ok ? col : "#6b6358", 28)}<div><b>${esc(NAMES[k])}</b>${ok ? `<span class="rct-ok">Learned</span>` : `<span class="rct-lk">Not found yet</span>`}<p>${esc(WHAT[k])}</p>${ok ? "" : `<p class="rct-how"><span>Where:</span> ${esc(RUNES[k].how)}</p>`}</div></div>`;
    }).join("")}</div></div>`).join("");
  }
  function mineHTML(s) {
    const list = s.runeSpells || [];
    if (!list.length) return `<p class="sub">No rune spells yet. Craft one on the first page.</p>`;
    return `<div class="rct-list">${list.map((c) => `<div class="rct-rune mine">${icon({ el: c.el, dl: c.dl, mods: c.mods }, c.level, 40, c.name)}<div><b>${esc(c.name)}</b><span class="sub"><span>${esc(c.school)}</span> · <span>${esc(c.level)}</span> · <span class="nv-mana">${D.SPELLS[c.id] ? G.spellCost(s, D.SPELLS[c.id]) : c.cost}</span> <span>magicka</span></span><p>${esc(describe(c))}</p></div><button class="btn sm" data-rx="forget" data-id="${esc(c.id)}">Forget</button></div>`).join("")}</div>`;
  }
  function render() {
    const m = DOM && document.getElementById("rct"); if (!m || !ui) return;
    const s = ui.s, have = known(s), place = where(s);
    const tabs = [["make", "Craft"], ["runes", `Runes`, `${have.size}/${Object.keys(RUNES).length}`], ["mine", "Your spells", `${(s.runeSpells || []).length}/${MAX}`]];
    const body = ui.tab === "runes" ? runesHTML(s) : ui.tab === "mine" ? mineHTML(s) : makeHTML(s);
    const keepScroll = m.querySelector(".rct-body")?.scrollTop || 0;
    m.innerHTML = `<div class="rct">
      <header class="rct-h"><div><h2>Rune table</h2><small><span>${place === "College" ? "College of Winterhold" : "Arcane enchanter"}</span> · <span class="gold">${s.gold || 0}</span> <span>gold</span></small></div><button class="rct-x" data-rx="close" aria-label="Close">✕</button></header>
      <nav class="rct-tabs" role="tablist">${tabs.map(([k, l, n]) => `<button role="tab" aria-selected="${ui.tab === k}" class="${ui.tab === k ? "on" : ""}" data-rt="${k}"><span>${l}</span>${n ? ` <small>${n}</small>` : ""}</button>`).join("")}</nav>
      ${ui.msg ? `<p class="rct-msg" role="status">${esc(ui.msg)}</p>` : ""}
      <div class="rct-body">${body}</div></div>`;
    const bd = m.querySelector(".rct-body"); if (bd) bd.scrollTop = keepScroll;
    try { if (typeof I18N !== "undefined" && I18N.lang() === "pl" && I18N.walk) I18N.walk(m); } catch (e) { /* observer does it */ }
  }
  function onClick(e) {
    const t = e.target;
    if (t.id === "rct") { close(); ui?.cb?.refresh?.(); return; }
    const b = t.closest("button"); if (!b || !ui) return;
    const s = ui.s;
    if (b.dataset.rt) { ui.tab = b.dataset.rt; ui.msg = ""; render(); return; }
    if (b.dataset.rk) {
      const g = b.dataset.rk, v = b.dataset.rv;
      if (!known(s).has(v)) { ui.msg = `${NAMES[v]}: ${RUNES[v].how}`; render(); return; }
      const sp = ui.spec;
      if (g === "el") { sp.el = v; const fam = famOf(v); if (!DELIVERIES[sp.dl]?.[fam]) sp.dl = "bolt"; sp.mods = (sp.mods || []).filter((m) => (MODS[m].fam[fam] || []).includes(sp.dl)); }
      else if (g === "dl") { if (sp.el && !DELIVERIES[v][famOf(sp.el)]) { ui.msg = `${ELEMENTS[sp.el].name} can't be cast as ${DELIVERIES[v].name.toLowerCase()}.`; render(); return; } sp.dl = v; sp.mods = (sp.mods || []).filter((m) => !sp.el || (MODS[m].fam[famOf(sp.el)] || []).includes(v)); }
      else {
        const on = (sp.mods || []).includes(v);
        if (on) sp.mods = sp.mods.filter((m) => m !== v);
        else { if (sp.el && !(MODS[v].fam[famOf(sp.el)] || []).includes(sp.dl)) { ui.msg = `${MODS[v].name} doesn't fit ${ELEMENTS[sp.el].name.toLowerCase()} ${DELIVERIES[sp.dl].name.toLowerCase()}.`; render(); return; } sp.mods = [...(sp.mods || []), v].slice(-modSlots(s)); }
      }
      ui.msg = ""; if (typeof SOUND !== "undefined" && SOUND.fx) SOUND.fx("click"); render(); return;
    }
    const a = b.dataset.rx;
    if (a === "close") { close(); ui.cb.refresh && ui.cb.refresh(); return; }
    if (a === "craft") {
      const r = craft(s, ui.spec, ui.name);
      if (r.err) { ui.msg = r.err; render(); return; }
      if (typeof SOUND !== "undefined" && SOUND.fx) SOUND.fx("spell");
      ui.msg = r.text; ui.name = ""; ui.tab = "mine";
      ui.cb.save && ui.cb.save(); ui.cb.say && ui.cb.say(r.text);
      render(); return;
    }
    if (a === "forget") { ui.msg = forget(s, b.dataset.id); ui.cb.save && ui.cb.save(); render(); }
  }
  function onInput(e) {
    if (!ui) return;
    if (e.target.id === "rctName") { ui.name = e.target.value; return; }
    if (e.target.id === "rctPw") {
      ui.spec.pw = +e.target.value / 100;
      // update the numbers in place (re-rendering would drop the slider under the finger)
      const d = design(ui.s, ui.spec); if (d.err) return;
      const m = document.getElementById("rct"), set = (sel, v) => { const x = m.querySelector(sel); if (x) x.textContent = v; };
      set("#rctPwV", `${R(d.pw * 100)}%`);
      const st = m.querySelectorAll(".rct-stats b");
      let castNow = d.cost; try { castNow = G.spellCost(ui.s, entry({ ...d, name: "x" })); } catch (er) { /* base */ }
      if (st[0]) st[0].textContent = castNow; if (st[1]) st[1].textContent = R(d.amount); if (st[2]) st[2].textContent = fee(d);
      const em = m.querySelector(".rct-bar em"); if (em) em.style.width = `${R(d.budget.k * d.pw * 100)}%`;
      const ds = m.querySelector(".rct-desc"); if (ds) ds.textContent = T(describe(d));
      const go = m.querySelector(".rct-go .gold"); if (go) go.textContent = fee(d);
      const btn = m.querySelector(".rct-go"); if (btn && (ui.s.runeSpells || []).length < MAX) btn.disabled = (ui.s.gold || 0) < fee(d);
    }
  }
  /* the button the town screens show (College spell crafting, arcane enchanters) */
  const button = (s) => `<button class="btn pri rct-open" data-act="runetable" style="width:100%;margin:4px 0 10px">ᛟ <span>Rune table</span> <small>· <span>${known(s).size}/${Object.keys(RUNES).length}</span> <span>runes</span></small></button>`;

  installMagic(); installFight(); installHooks(); installIcons();
  if (typeof TB !== "undefined" && Array.isArray(TB.FOE_KEYS) && !TB.FOE_KEYS.includes("rcRearm")) TB.FOE_KEYS.push("rcRearm");
  return { TIERS, ELEMENTS, DELIVERIES, MODS, RUNES, NAMES, MAX, PW_MIN, CHAIN, LINGER, refs, budget, design, fee, names, describe, research, register, craft, forget,
    poisonK, canCraftHere, where, modSlots, icon, drawIcon, svg, open, close, button, freshText, _reset: () => { refCache = null; } };
})();
if (typeof module !== "undefined") module.exports = RUNECRAFT;
