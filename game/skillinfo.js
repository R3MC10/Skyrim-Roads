/* What each skill does, what your level gives you right now (numbers worked out from the real game formulas), and how to raise it.
   Every number here comes from formulas.js / engine.js / towns.js / dungeons.js / enchanting.js / smithing.js;
   `code` lists the place in the game that hands out the XP, so a test can check the text stays true. */
const SKILLINFO = (() => {
  const pc = (x) => `${Math.round(x * 100)}%`;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lv = (s, sk) => (s ? G.skill(s, sk) : 15);
  const row = (label, fn, L) => `${label}: ${fn(L)}`;   // only what you have now, never a table of later levels

  // ---- weapon damage [Skyrim] base × (1 + skill/200)
  const weapon = (what, codeSk) => ({
    what, now: (s, L) => [row("Damage bonus", (x) => `+${Math.round(x / 2)}%`, L)],
    raise: [`Hit enemies with ${codeSk === "Archery" ? "a bow or crossbow" : codeSk === "Spear" ? "a spear" : `a ${codeSk.toLowerCase()} weapon`} in fights. Harder hits teach more.`], code: ["this.addXp(sk,"],
  });
  const armor = (type, sk) => ({
    what: `Makes ${type} armor protect you better.`,
    now: (s, L) => [row(`Armor from ${type} pieces`, (x) => `+${Math.round(40 * x / 100)}%`, L)],
    raise: [`Get hit in fights while your chest piece is ${type} armor.`], code: ["this.addXp(ARMOR_SKILL[main]"],
  });
  const school = (sk, what, raise, extra) => ({
    what, now: (s, L) => [row("Spells of this school cost", (x) => `${Math.round(100 * (1 - (x / 400) ** 0.65))}%`, L), ...(extra ? extra(s, L) : [])],
    raise: [raise], code: [sk === "Restoration" ? 'this.addXp("Restoration"' : "this.addXp(sp.school"],
  });
  const lock = (L, tier) => clamp(0.92 - tier * 0.17 + (L - 15) / 110, 0.05, 0.97);

  const INFO = {
    "One-Handed": weapon("Swords, axes, maces and daggers held in one hand hit harder.", "One-Handed"),
    "Two-Handed": weapon("Greatswords and battleaxes hit harder.", "Two-Handed"),
    "Archery": weapon("Bows and crossbows hit harder.", "Archery"),
    "Spear": weapon("Spears hit harder.", "Spear"),
    "Hand-to-Hand": { what: "Fighting with your bare fists.",
      now: (s, L) => [row("Punch damage", (x) => { const [a, b] = F.unarmedRange(x, s?.race); return `${a}–${b}`; }, L)],
      raise: ["Fight with no weapon in your hands."], code: ["this.addXp(sk,", '"Hand-to-Hand"'] },
    "Blocking": { what: "Blocking with a shield (or your weapon) takes less damage from hits.",
      now: (s, L) => [row("A 20-armor shield stops", (x) => pc(F.blockPercent(x, 20)), L)],
      raise: ["Block hits in fights (a shield helps)."], code: ['this.addXp("Blocking"'] },
    "Heavy Armor": armor("heavy", "Heavy Armor"),
    "Light Armor": armor("light", "Light Armor"),
    "Medium Armor": armor("medium", "Medium Armor"),
    "Unarmored": { what: "Protects you in the armor slots you leave empty (good for mages in robes).",
      now: (s, L) => [row("Armor per empty slot", (x) => (+F.unarmoredRating(x, 1).toFixed(1)).toString(), L)],
      raise: ["Get hit in fights while some armor slots are empty."], code: ['this.addXp("Unarmored"'] },
    "Destruction": school("Destruction", "Fire, frost and shock spells.", "Cast Destruction spells in fights."),
    "Restoration": school("Restoration", "Healing spells and spells against the undead.", "Heal yourself with spells in fights (more health healed, more XP)."),
    "Alteration": school("Alteration", "Spells that harden your skin (extra armor in a fight).", "Cast Alteration spells in fights."),
    "Conjuration": school("Conjuration", "Summon a creature to fight beside you.", "Cast Conjuration spells in fights."),
    "Illusion": school("Illusion", "Calm and pacify spells that stop enemies fighting.", "Cast Illusion spells in fights."),
    "Mysticism": { what: "The magic of souls and the unseen: Soul Trap, Detect Life, Dispel, Mark and Recall, and Spell Absorption.",
      now: (s) => [D.SPELLS.recall ? `Mysticism spells cost less as it grows (Recall: ${G.spellCost(s, D.SPELLS.recall)} magicka now).` : "Mysticism spells cost less as it grows.", "Its perks absorb enemy spells, help you stay hidden and recharge your enchanted weapon on kills."],
      raise: ["Cast Mysticism spells: Soul Trap in fights, Detect Life, Dispel, Mark and Recall from the Magic menu.", "Trap souls in empty soul gems (a greater soul teaches more).", "Pray at roadside shrines.", "Learn Mysticism tomes from court wizards and the College."],
      code: ['useSkill(s, "Mysticism", full === "soul_gem_greater" ? 25 : 12)', 'useSkill(s, "Mysticism", 12)', '"Mysticism", "Novice"'] },
    "Sneak": { what: "Staying unseen: avoid road fights, slip past dungeon foes and land sneak attacks.",
      now: (s, L) => [row("Chance to stay hidden (daytime, normal foe)", (x) => pc(clamp(0.25 + x / 150, 0.05, 0.92)), L)],
      raise: ["Hide when something attacks you on the road.", "Sneak past foes in dungeons.", "Land sneak attacks in fights."], code: ['useSkill(s, "Sneak"', 'this.addXp("Sneak"'] },
    "Lockpicking": { what: "Opening locked chests without breaking your picks.",
      now: (s, L) => [row("Novice lock", (x) => pc(lock(x, 0)), L), row("Expert lock", (x) => pc(lock(x, 3)), L)],
      raise: ["Pick locked treasure chests in dungeons (harder locks teach more).", "Open locked things you find on the road."], code: ['useSkill(s, "Lockpicking"', 'xp(s, "Lockpicking"'] },
    "Pickpocket": { what: "Stealing from people's pockets without being caught.",
      now: (s, L) => [row("Lifting 50 gold from a level-10 person", (x) => pc(clamp(0.35 + x / 120 - 50 / 400 - 10 / 200, 0.05, 0.95)), L)],
      raise: ["Pick pockets in town streets or from other players (more gold stolen, more XP)."], code: ['useSkill(s, "Pickpocket"'] },
    "Athletics": { what: "Running: you travel faster on foot.",
      now: (s, L) => [row("Running speed", (x) => `×${(1.75 + x / 100).toFixed(2)}`, L), row("Action points a turn in turn-by-turn fights", (x) => `${Math.min(11, 6 + Math.floor(x / 40))} (+1 for every 150 Stamina over 150)`, L)],
      raise: ["Travel on foot (not riding, and not carrying too much).", "Flee from fights."], code: ['useSkill(s, "Athletics"'] },
    "Acrobatics": { what: "Jumping and dodging: get past traps and tricky ground.",
      now: (s, L) => [row("Diving past a dungeon trap", (x) => pc(clamp(0.45 + x / 150, 0.1, 0.95)), L), row("Initiative in turn-by-turn fights", (x) => `+${Math.round(x / 8)}`, L)],
      raise: ["Dash past traps in dungeons.", "Climb or jump when the road asks for it."], code: ['useSkill(s, "Acrobatics"', 'xp(s, "Acrobatics"'] },
    "Mercantile": { what: "Better prices when you buy and sell.",
      now: (s, L) => [row("Shops charge", (x) => `×${F.priceFactor(x).toFixed(2)} value`, L), row("Shops pay", (x) => pc(1 / F.priceFactor(x)) + " of value", L)],
      raise: ["Buy and sell in shops (bigger deals teach more).", "Buy a horse, or trade with travelling merchants."], code: ['useSkill(s, "Mercantile"'] },
    "Speechcraft": { what: "Talking your way through: rumours at inns and bluffing guards.",
      now: (s, L) => [row("Talking past a guard on the road", (x) => pc(clamp(0.3 + x / 100, 0.1, 0.95)), L)],
      raise: ["Buy rumours at inns.", "Talk your way out of trouble on the road."], code: ['useSkill(s, "Speechcraft"', 'xp(s, "Speechcraft"'] },
    "Etiquette": { what: "Manners at court: its perks make training cheaper, halve fines and get you past tolls.",
      now: (s, L) => [row("Inns and trainers charge", (x) => pc(1 - 0.15 * x / 100), L), row("Notice-board jobs pay", (x) => `+${Math.round(20 * x / 100)}%`, L)],
      raise: ["Finish jobs from a town's notice board.", "Rent a room at an inn."], code: ['useSkill(s, "Etiquette", 20)', 'useSkill(s, "Etiquette", 6)'] },
    "Streetwise": { what: "Knowing the underworld: its perks give free rumours, fences and bribes.",
      now: (s, L) => [row("A rumour at the inn costs", (x) => `${Math.round(10 * (1 - 0.5 * x / 100))} gold`, L), row("Fences pay for stolen goods", (x) => `+${Math.round(20 * x / 100)}%`, L)],
      raise: ["Buy rumours at inns.", "Sell stolen goods to a fence."], code: ['useSkill(s, "Streetwise", 12)', 'useSkill(s, "Streetwise", 8 + price / 10)'] },
    "Smithing": { what: "Making and improving weapons and armor at a forge.",
      now: (s, L) => [row("Best improvement you can make", (x) => (typeof TOWNS !== "undefined" ? TOWNS.QUALITY[Math.min(6, 1 + Math.floor(x / 20))] : ""), L), ...(L >= 50 ? ["One extra ore every time you mine."] : [])],
      raise: ["Make things at a forge (more valuable things teach more).", "Improve gear, smelt ore and tan pelts."], code: ['useSkill(s, "Smithing"'] },
    "Enchanting": { what: "Putting magic on your gear, and recharging enchanted weapons more cheaply.",
      now: (s, L) => [row("Enchantment strength", (x) => pc(0.4 + 0.6 * Math.min(100, x) / 100), L), row("Weapon charge used per hit", (x) => pc(1 - Math.sqrt(Math.min(x, 199) / 200)), L)],
      raise: ["Break enchanted items down at an arcane enchanter.", "Enchant your gear, or recharge a weapon with a soul gem."], code: ['useSkill(s, "Enchanting"'] },
    "Alchemy": { what: "Brewing potions and poisons from ingredients.",
      now: (s, L) => [row("Potion strength", (x) => `×${(1 + 0.5 * x / 100).toFixed(2)}`, L)],
      raise: ["Brew potions at an alchemy lab (more valuable potions teach more).", "Eat raw ingredients to learn their effects."], code: ['useSkill(s, "Alchemy"'] },
  };

  function trainers(sk) {
    if (typeof TOWNS === "undefined" || !TOWNS.TRAINERS) return [];
    const out = [];
    for (const [town, list] of Object.entries(TOWNS.TRAINERS)) for (const [who, k, lvl] of list) if (k === sk) out.push(`${who} in ${town} (up to ${TOWNS.CAP?.[lvl] ?? "?"})`);
    return out;
  }
  function books(sk) { return typeof SKILL_BOOKS !== "undefined" ? SKILL_BOOKS.filter(([, k]) => k === sk).map(([t]) => t) : []; }
  /* your perks in this tree (current rank only), and the next one you could take */
  function perksLine(sk, s) {
    const tree = typeof PERKS !== "undefined" ? PERKS.TREES[sk] : null;
    if (!tree?.length) return "";
    if (!s) return `${tree.length} perks in this tree.`;
    const have = tree.filter(([id]) => PERKS.rank(s, id)).map(([id, name, ranks]) => `${name}${ranks > 1 ? ` ${PERKS.rank(s, id)}/${ranks}` : ""}`);
    const lvl = s.skills?.[sk]?.lvl ?? 15;
    const open = tree.filter(([id, , ranks, req, needs]) => PERKS.rank(s, id) < ranks && (!needs.length || needs.some((n) => PERKS.rank(s, n))))
      .map(([id, name, , req]) => [name, req[PERKS.rank(s, id)]]).sort((a, b) => a[1] - b[1])[0];
    return `${have.length ? `Yours: ${have.join(", ")}.` : "No perks taken yet."}${open ? ` Next: ${open[0]}${open[1] > lvl ? ` (at ${sk} ${open[1]})` : " (ready)"}.` : ""}`;
  }
  /* everything for one skill, for this character */
  function get(s, sk) {
    const i = INFO[sk]; if (!i) return null;
    const L = lv(s, sk);
    const tr = trainers(sk), bk = books(sk);
    const raise = [...i.raise];
    if (tr.length) raise.push(`Pay a trainer: ${tr.join("; ")}. Up to 5 lessons per level.`);
    if (bk.length) raise.push(`Read the skill book "${bk[0]}" (found on the road and in dungeons): +1 at once.`);
    if (!i.raise.length) raise.unshift("No everyday action trains it yet: use trainers and skill books.");
    raise.push("Sleep at an inn or your house first: Rested makes every skill grow 5% faster (10% in your own bed). The Warrior, Mage and Thief stones add 20% to their skills.");
    const now = i.now(s, L);
    if (s && s.skills && s.skills[sk]) {   // fair levelling: say plainly how far the next level is
      const k = s.skills[sk];
      if (k.lvl < 100) now.push(`Next level: ${Math.floor(k.xp)} of ${Math.ceil(F.skillXpNeeded(sk, k.lvl))} skill XP. Each level up also gives ${k.lvl + 1} toward your character level.`);
      else now.push(`At 100: you can make it Legendary (it starts again from 15, you keep your perks and get a permanent bonus).`);
    }
    return { what: i.what, now, raise, perks: perksLine(sk, s), level: L };
  }
  const summary = (sk) => INFO[sk]?.what || "";
  return { INFO, get, summary, trainers, books };
})();
