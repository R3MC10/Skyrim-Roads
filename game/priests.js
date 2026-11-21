/* [Skyrim] Dragon priests and their masks. Eight priests sleep at the end of eight Nordic ruins; each one wears
   a mask of power. Beat a priest and its mask is yours, once per hero. Morokei of Labyrinthian also guards the
   Wooden Mask, and with all eight masks (and the Wooden Mask) in your pack, the shrine of Bromjunaar under
   Labyrinthian gives up the ninth: Konahrik.
   Two lairs stand in for places this map doesn't have: Nahkriin sleeps in Yngol Barrow (Skuldafn is beyond the
   Throat of the World), and Vokun in Ironbind Barrow (High Gate Ruins isn't on the map; Ironbind is the nearest
   barrow on that northern coast). Masks are bound to their owner: they can't be sold, given, traded or lost. */
const PRIESTS = (() => {
  const MIN_LEVEL = 20;   // [OURS] below this the priests sleep on and the ruin's usual master guards it
  // id, name, lair, element of their spells, what they summon, mask armor (light/heavy), the mask's powers
  const LIST = [
    { id: "krosis", name: "Krosis", lair: "Shearpoint", el: "frost", summon: "frost atronach", type: "light", armor: 17,
      fx: [["skill:Lockpicking", 20, "Fortify Lockpicking"], ["dmg:Archery", 20, "Fortify Archery"], ["skill:Alchemy", 20, "Fortify Alchemy"]] },
    { id: "hevnoraak", name: "Hevnoraak", lair: "Valthume", el: "shock", summon: "storm atronach", type: "heavy", armor: 23,
      fx: [["immune", 1, "Immune to disease and poison"]] },
    { id: "morokei", name: "Morokei", lair: "Labyrinthian", el: "shock", summon: "storm atronach", type: "light", armor: 17,
      fx: [["regen:magicka", 100, "Fortify Magicka Regen"]] },
    { id: "nahkriin", name: "Nahkriin", lair: "Yngol Barrow", el: "fire", summon: "flame atronach", type: "light", armor: 17,
      fx: [["max:magicka", 50, "Fortify Magicka"], ["cost:Destruction", 20, "Cheaper Destruction"], ["cost:Restoration", 20, "Cheaper Restoration"]] },
    { id: "otar", name: "Otar", lair: "Ragnvald", el: "fire", summon: "flame atronach", type: "heavy", armor: 23,
      fx: [["resist", 30, "Resist Fire, Frost and Shock"]] },
    { id: "rahgot", name: "Rahgot", lair: "Forelhost", el: "frost", summon: "frost atronach", type: "heavy", armor: 23,
      fx: [["max:stamina", 70, "Fortify Stamina"]] },
    { id: "vokun", name: "Vokun", lair: "Ironbind Barrow", el: "fire", summon: "skeletal guard", type: "light", armor: 17,
      fx: [["cost:Conjuration", 20, "Cheaper Conjuration"], ["cost:Illusion", 20, "Cheaper Illusion"], ["cost:Alteration", 20, "Cheaper Alteration"]] },
    { id: "volsung", name: "Volsung", lair: "Volskygge", el: "frost", summon: "frost atronach", type: "heavy", armor: 23,
      fx: [["barter", 20, "Fortify Barter"], ["carry", 100, "Fortify Carry Weight"]] },
  ];
  const BY = Object.fromEntries(LIST.map((p) => [p.id, p]));
  const BY_LAIR = Object.fromEntries(LIST.map((p) => [p.lair, p]));
  const SHRINE = "Labyrinthian";   // Bromjunaar
  const COLOR = { krosis: "#8a7a52", hevnoraak: "#a8a48a", morokei: "#c9a24c", nahkriin: "#7d8b6a", otar: "#a3693a", rahgot: "#8b7a3a", vokun: "#5e5a52", volsung: "#b8b098", konahrik: "#e2bb64", wooden: "#7a5530" };
  const maskId = (id) => "mask_" + id;
  const ench = (fx) => ({ key: fx[0][0], mag: fx[0][1], name: fx[0][2], more: fx.slice(1).map(([key, mag, name]) => ({ key, mag, name })) });

  // ---- the masks (helmet slot, bound to you) and the priests (dungeon bosses)
  for (const p of LIST) D.ITEMS[maskId(p.id)] = { name: `Mask of ${p.name}`, slot: "head", type: p.type, armor: p.armor, weight: p.type === "heavy" ? 7 : 4, value: 2000, mask: p.id, noTrade: true, aenchant: ench(p.fx) };
  D.ITEMS.mask_konahrik = { name: "Konahrik", slot: "head", type: "heavy", armor: 26, weight: 7, value: 5000, mask: "konahrik", noTrade: true,
    aenchant: { key: "konahrik", mag: 1, name: "Konahrik's wrath", more: [] } };
  D.ITEMS.mask_wooden = { name: "Wooden Mask", slot: "head", type: "light", armor: 2, weight: 2, value: 200, mask: "wooden", noTrade: true };
  const isMask = (item) => !!D.ITEMS[item]?.mask;
  if (typeof DUNGEONS !== "undefined") for (const p of LIST) DUNGEONS.ENEMY["priest_" + p.id] = {
    name: `${p.name}, dragon priest`, health: 250, damage: 17, tags: ["undead", "elite", "big", "mage"], gold: [200, 400], level: 30, danger: "high", priest: p.id,
    text: `The sarcophagus lid grinds aside. ${p.name} rises in a cloud of ${p.el === "fire" ? "embers" : p.el === "frost" ? "frost" : "crackling light"}, mask gleaming.`,
  };

  // ---- per-hero state
  const st = (s) => (s.priests = s.priests || { got: {} });
  const got = (s, id) => !!st(s).got[id];
  const count = (s) => LIST.filter((p) => got(s, p.id)).length;
  const carried = (s, item) => (s.inv || []).some((r) => r.item === item);
  const allCarried = (s) => LIST.every((p) => carried(s, maskId(p.id))) && carried(s, "mask_wooden");
  const left = (s) => LIST.filter((p) => !got(s, p.id));
  const posOf = (s) => (s.x != null && s.y != null ? [s.x, s.y] : WORLD.places[s.location] || [0.5, 0.5]);
  function nextLair(s) {   // the nearest ruin with a priest still in it
    const here = posOf(s), l = left(s).filter((p) => WORLD.places[p.lair]);
    if (!l.length) return count(s) >= LIST.length && !got(s, "konahrik") ? SHRINE : null;
    return l.sort((a, b) => G.pxDist(here, WORLD.places[a.lair]) - G.pxDist(here, WORLD.places[b.lair]))[0].lair;
  }
  const questOn = (s) => { const v = (s.quests || {}).masks; return !!v && !v.done; };
  const marker = (s) => { if (!questOn(s)) return null; const n = nextLair(s); return n && WORLD.places[n] && s.location !== n ? { pos: WORLD.places[n], name: n } : null; };

  /* dungeons.js enter(): a priest still sleeps here → it's the boss */
  function onEnter(s) {
    const d = s.dungeon, p = d && BY_LAIR[d.place];
    if (!p || got(s, p.id)) return null;
    if (s.level < MIN_LEVEL) { G.note(s, `🎭 Something sleeps behind a sealed sarcophagus in ${d.place}. Come back stronger (level ${MIN_LEVEL}).`); return null; }
    d.boss = "priest_" + p.id; d.priest = p.id;
    return p;
  }
  /* boss down: the mask, once. Returns item names for the chest line */
  function onBoss(s, d, e) {
    const id = e?.priest; if (!id || got(s, id)) return [];
    st(s).got[id] = G.now();
    s.stats = s.stats || {}; s.stats.priests = (s.stats.priests || 0) + 1;
    const out = [];
    const give = (item) => { G.give(s, item); d.found.push(D.ITEMS[item].name); out.push(D.ITEMS[item].name); };
    give(maskId(id));
    if (id === "morokei" && !carried(s, "mask_wooden")) give("mask_wooden");
    G.note(s, `🎭 ${BY[id].name}'s mask is yours (${count(s)}/${LIST.length}).`);
    if (typeof QUESTS !== "undefined") QUESTS.ensure(s);
    return out;
  }

  /* the quest: "Masks of the Dragon Priests" */
  const stageText = ["The first mask", "Two masks", "Three masks", "Four masks", "Five masks", "Six masks", "Seven masks", "Eight masks"];
  const QUEST = { name: "Masks of the Dragon Priests", giver: "The ancient Nords", stages: [
    ...stageText.map((title, i) => ({ title, text: i === 0 ? "Eight dragon priests sleep in the old Nordic ruins, each in a mask of power. Defeat one and take its mask." : `Defeat another dragon priest and take its mask (${i}/8 so far).`, obj: { masks: i + 1 } })),
    { title: "Bromjunaar", text: "With all eight masks and the Wooden Mask in your pack, go to the shrine of Bromjunaar beneath Labyrinthian.",
      obj: { talk: SHRINE, label: "Place the masks at the shrine", need: (s) => allCarried(s) ? null : `The shrine wants all eight masks and the Wooden Mask in your pack. Missing: ${[...LIST.filter((p) => !carried(s, maskId(p.id))).map((p) => p.name), ...(carried(s, "mask_wooden") ? [] : ["the Wooden Mask"])].join(", ")}.` },
      reward: { gold: 2000, items: ["mask_konahrik"], title: "Konahrik" } },
  ] };
  /* [OURS] recommended level of the next priest: 20 for the first mask, +2 per mask after (the Journal shows it) */
  const recFor = (n) => typeof QUESTS !== "undefined" && QUESTS.recOf ? QUESTS.recOf("masks", Math.min(n, LIST.length - 1)) : MIN_LEVEL + 2 * n;
  const rec = (s) => recFor(count(s));
  function shouldStart(s) { return s.level >= MIN_LEVEL || count(s) > 0; }
  /* a copy of the stage with the next ruin filled in: the Journal's travel button and the hint */
  function stageFor(s, stg) {
    if (!stg?.obj?.masks) return stg;
    const n = nextLair(s), p = n && BY_LAIR[n];
    return { ...stg, text: stg.text + (p ? ` Nearest: ${p.name}, in ${p.lair}.` : ""), obj: { ...stg.obj, at: n || undefined } };
  }
  function syncDone(s) {   // Konahrik claimed
    const v = (s.quests || {}).masks;
    if (v?.done && !got(s, "konahrik")) st(s).got.konahrik = G.now();
  }

  // ---- in the fight: the priest's spells
  const EL = { fire: ["a fireball", "flames"], frost: ["an ice spike", "frost"], shock: ["chain lightning", "lightning"] };
  function spellHit(f, mult) {
    const s = f.s;
    let dmg = f.e.damage * mult * (0.85 + Math.random() * 0.3);
    dmg *= (1 - 0.1 * G.P(s, "magic_resistance")) * (1 - Math.min(0.5, G.fxSum(s, "resist") / 100));   // magic ignores armor; resistances don't
    if (f.pw && typeof POWERS !== "undefined") dmg = POWERS.dmgIn(f, dmg, true);
    let extra = "";
    if (typeof MAGIC !== "undefined" && f.ward) { const before = dmg; dmg = MAGIC.soak(f, dmg); if (dmg < before) extra = ` (ward soaks ${Math.round(before - dmg)})`; }
    f.hp -= dmg;
    return Math.round(dmg) + extra;
  }
  /* before its normal blow: the elemental cloak, the summon, the ward, a spell every third turn, one desperate heal.
     Returns {text, end}; end = the priest spent its turn on a spell */
  function enemyAct(f) {
    const p = BY[f.e.priest]; if (!p) return null;
    const pr = (f.priest = f.priest || { turn: 0, healed: false, sum: 0, ward: 0, wardAt: 0, warded: false }); pr.turn++;
    const n = p.name, parts = [], out = (text, end) => ({ text: [...parts, text].filter(Boolean).join(" · "), end });
    if (pr.ward > 0) {   // the ward drank part of what you dealt since last turn
      const taken = Math.max(0, pr.wardAt - f.ehp), soak = Math.min(pr.ward, Math.round(taken * 0.6));
      if (soak > 0) { f.ehp += soak; pr.ward -= soak; parts.push(`${n}'s ward soaks ${soak}`); }
      pr.wardAt = f.ehp; if (pr.ward <= 0) parts.push("the ward breaks");
    }
    if (pr.sum > 0) { pr.sum--; parts.push(`the ${p.summon} hits ${spellHit(f, 0.3)}`); }
    if (!pr.healed && f.ehp < f.ehp0 * 0.4) {   // draws on the tomb's souls, once
      pr.healed = true; const h = Math.round(f.ehp0 * 0.2); f.ehp += h; pr.wardAt = f.ehp;
      return out(`${n} draws life from the tomb (+${h})`, true);
    }
    if (pr.turn === 2) { pr.sum = 3; return out(`${n} summons a ${p.summon}`, true); }
    if (pr.turn === 4 && !pr.warded) { pr.warded = true; pr.ward = Math.round(f.e.damage * 1.5); pr.wardAt = f.ehp; return out(`${n} raises a ward (${pr.ward})`, true); }
    if (pr.turn % 3 === 0) return out(`${n} casts ${EL[p.el][0]}: ${spellHit(f, 1.2)}`, true);
    parts.push(`${EL[p.el][1]} cloak ${spellHit(f, 0.12)}`);
    return out("", false);
  }

  // ---- Konahrik: sometimes, when you're nearly down, the mask fights for you (once a fight)
  function guard(f) {
    if (f.konahrikUsed || f.hp <= 0) return null;
    if (f._kon === undefined) f._kon = G.fxSum(f.s, "konahrik") > 0;
    if (!f._kon || f.hp > G.maxHealth(f.s) * 0.3) return null;
    f.konahrikUsed = true;
    if (Math.random() < 0.35) return null;   // "sometimes"
    const h = Math.round(G.maxHealth(f.s) * 0.3), d = Math.round(20 + f.s.level * 1.5);
    f.hp += h; f.ehp -= d;
    return `Konahrik flares: a spectral dragon priest heals you (+${h}) and strikes the ${f.e.name.toLowerCase()} (${d})`;
  }
  const immune = (s) => G.fxSum(s, "immune") > 0;   // Hevnoraak

  // ---- the mask itself, drawn with plain canvas calls (hero, icons, Journal emblem, achievement)
  function drawMask(g, cx, cy, sc, id, ink = "#1a120a") {
    const c = COLOR[id] || "#c9a24c", u = sc;
    g.save(); g.translate(cx, cy); g.scale(u, u);
    g.lineJoin = "round"; g.lineWidth = 1.4; g.strokeStyle = ink;
    const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
    const gr = g.createLinearGradient(-10, -12, 10, 12); gr.addColorStop(0, shade(c, 1.35)); gr.addColorStop(0.55, c); gr.addColorStop(1, shade(c, 0.6));
    g.fillStyle = gr;
    g.beginPath();   // the face plate: a tall crown, wide brow, pointed chin
    g.moveTo(0, -13); g.lineTo(6, -9); g.lineTo(10, -4); g.lineTo(9.5, 3); g.lineTo(6, 9); g.lineTo(0, 13); g.lineTo(-6, 9); g.lineTo(-9.5, 3); g.lineTo(-10, -4); g.lineTo(-6, -9); g.closePath(); g.fill(); g.stroke();
    if (id === "wooden") { g.strokeStyle = shade(c, 0.6); g.lineWidth = 0.7; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 3.5, -10); g.quadraticCurveTo(i * 3.5 + 1, 0, i * 3, 11); g.stroke(); } g.strokeStyle = ink; g.lineWidth = 1.4; }
    g.fillStyle = shade(c, 0.45);   // brow ridges and the crest
    g.beginPath(); g.moveTo(-8, -3); g.lineTo(-1, -1.5); g.lineTo(-1, -3.5); g.lineTo(-7, -6); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(8, -3); g.lineTo(1, -1.5); g.lineTo(1, -3.5); g.lineTo(7, -6); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(0, -12); g.lineTo(1.6, -5); g.lineTo(0, -3); g.lineTo(-1.6, -5); g.closePath(); g.fill();
    g.fillStyle = id === "konahrik" ? "#ffcf6a" : "#0b0806";   // eye slits
    g.beginPath(); g.moveTo(-7, -1); g.lineTo(-2, 0); g.lineTo(-3, 1.6); g.lineTo(-6.5, 0.8); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(7, -1); g.lineTo(2, 0); g.lineTo(3, 1.6); g.lineTo(6.5, 0.8); g.closePath(); g.fill();
    g.strokeStyle = shade(c, 0.4); g.lineWidth = 0.9;   // cheek grooves and the mouth
    g.beginPath(); g.moveTo(-6, 4); g.lineTo(-3, 9); g.moveTo(6, 4); g.lineTo(3, 9); g.moveTo(-2.5, 6.5); g.lineTo(2.5, 6.5); g.stroke();
    if (id !== "wooden") { g.globalAlpha = 0.45; g.fillStyle = "#fff6d8"; g.beginPath(); g.ellipse(-4, -7, 2.2, 1, -0.5, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    g.restore();
  }

  if (typeof QUESTS !== "undefined") QUESTS.L.masks = QUEST;
  return { LIST, BY, BY_LAIR, SHRINE, MIN_LEVEL, QUEST, COLOR, maskId, isMask, got, count, carried, allCarried, left, nextLair, marker, questOn,
    onEnter, onBoss, shouldStart, stageFor, rec, recFor, syncDone, enemyAct, guard, immune, drawMask };
})();
