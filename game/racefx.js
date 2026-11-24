/* racefx.js: what each race is born with, beyond its skills and its once-a-day power. [OURS module, [Skyrim] abilities]
   The race descriptions always promised "50% frost resistance" and so on; this makes them real. Each race gives effects in
   the same [key, value, condition] form perks use, and PFX.each (perkfx.js) adds them to the perk sums, so the fight
   engine, the Smart AI and the town code pick them up with no extra wiring:
     "in" (damage taken), "gold" (gold found), "regenmp", "curseres", "temper", "hit", "travel".
   The Speechcraft perk Proud Heritage ("heritage") makes all of them 25% stronger. */
const RACEFX = (() => {
  const LIST = {
    nord: { name: "Resist Frost", desc: "Frost and cold-blooded foes hurt you half as much.", fx: [["in", -0.5, { foeEl: "frost" }]] },
    imperial: { name: "Imperial Luck", desc: "You find 15% more gold in dungeons.", fx: [["gold", 0.15, {}]] },
    breton: { name: "Resist Magic", desc: "Mages and dragons hurt you 25% less.", fx: [["in", -0.25, { magic: 1 }]] },
    redguard: { name: "Resist Poison", desc: "Spiders, snakes, poisoners and other venomous foes hurt you half as much.", fx: [["in", -0.5, { venom: 1 }]] },
    altmer: { name: "Highborn Mind", desc: "50 extra magicka, and magicka comes back 10% faster.", fx: [["regenmp", 0.1, {}]] },
    bosmer: { name: "Resist Poison and Disease", desc: "Venomous foes hurt you half as much, and you shrug off half the vampire and werewolf curses.", fx: [["in", -0.5, { venom: 1 }], ["curseres", 0.5, {}]] },
    dunmer: { name: "Resist Fire", desc: "Fire and burning foes hurt you half as much.", fx: [["in", -0.5, { foeEl: "fire" }]] },
    orc: { name: "Orc Forge-Blood", desc: "Improving weapons and armor at a forge adds 1 more, and you hold your ground: 5% less damage from everything.", fx: [["temper", 1, {}], ["in", -0.05, {}]] },
    khajiit: { name: "Claws and Night Eyes", desc: "Bare-handed you fight with claws, and you hit 5% more often at night, in fog and in storms.", fx: [["hit", 0.05, { dark: 1 }]] },
    argonian: { name: "Hist-Blood", desc: "You shrug off half the vampire and werewolf curses, and you travel 5% faster on the roads.", fx: [["curseres", 0.5, {}], ["travel", 0.05, {}]] },
  };
  const LORE = {
    nord: "Tall, fair-haired children of Skyrim, hardened by its cold and its wars.",
    imperial: "Disciplined citizens of Cyrodiil: soldiers, diplomats and traders with an eye for coin.",
    breton: "Half-elven folk of High Rock with magic in their blood and a stubborn will.",
    redguard: "Desert warriors of Hammerfell, the most naturally gifted fighters in Tamriel.",
    altmer: "Proud High Elves of the Summerset Isles, born to sorcery.",
    bosmer: "Quick Wood Elves of Valenwood, the best archers alive.",
    dunmer: "Grey-skinned Dark Elves of Morrowind, fierce and fire-touched.",
    orc: "Mountain folk of Orsinium: unbreakable smiths and fighters.",
    khajiit: "Cat-folk of Elsweyr: clever, quick and at home in the dark.",
    argonian: "Scaled folk of Black Marsh, blessed by the Hist trees.",
  };
  const rank = (s, id) => (typeof PERKS !== "undefined" && PERKS.rank ? PERKS.rank(s, id) : (s.perks && s.perks[id]) || 0);
  /* how much Proud Heritage adds (the perk's own "heritage" value per rank) */
  const boost = (s) => { const r = rank(s, "proud_heritage"); if (!r) return 1; const v = typeof PFX !== "undefined" && PFX.FX && PFX.FX.proud_heritage ? (PFX.FX.proud_heritage.find((x) => x[0] === "heritage") || [0, 0.25])[1] : 0.25; return 1 + (Array.isArray(v) ? v[Math.min(r, v.length) - 1] : v * r); };
  /* the effects this character has from their race: [[key, value, condition]] */
  function fx(s) {
    const L = s && LIST[s.race]; if (!L) return [];
    const b = boost(s);
    return L.fx.map(([k, v, c]) => [k, b === 1 ? v : Math.round(v * b * 1000) / 1000, c]);
  }
  const ability = (r) => LIST[r] || null;
  const lore = (r) => LORE[r] || "";
  return { LIST, LORE, fx, ability, lore, boost };
})();
