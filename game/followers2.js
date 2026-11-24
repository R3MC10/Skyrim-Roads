/* Followers, grown up: their own pack and gear (which sets how hard they hit, how much they shrug off and how they look
   everywhere), levels earned in fights, and perks they pick themselves from the real perk trees, by their archetype
   ([Skyrim] every follower has a combat style: Lydia sword and shield, Jenassa bow, Marcurio destruction...).
   A follower is never a party member: in a party each player's follower walks and fights alongside, and other phones
   see them from the follower summary in your player card. Progress is kept per follower in s.folData, so a follower you
   dismiss and hire again still has their kit and levels. */
const FOL2 = (() => {
  // ---- archetypes: which skills grow fastest and which perk trees they spend in, in order
  const ARCH = {
    warrior: { name: "Warrior", desc: "Sword and shield, heavy armor.", main: ["One-Handed", "Heavy Armor", "Blocking"], sec: ["Two-Handed", "Archery"], armor: "heavy", weapon: "One-Handed", role: "guard" },
    twohand: { name: "Two-hander", desc: "Big two-handed weapons, heavy armor.", main: ["Two-Handed", "Heavy Armor"], sec: ["One-Handed", "Blocking"], armor: "heavy", weapon: "Two-Handed", role: "striker" },
    archer: { name: "Archer", desc: "Bow first, light armor, quiet feet.", main: ["Archery", "Sneak", "Light Armor"], sec: ["One-Handed"], armor: "light", weapon: "Archery", role: "fighter", sneaky: true },
    spellsword: { name: "Spellsword", desc: "A blade in one hand, fire in the other.", main: ["One-Handed", "Destruction", "Light Armor"], sec: ["Restoration", "Blocking"], armor: "light", weapon: "One-Handed", role: "striker", mage: 0.35 },
    thief: { name: "Thief", desc: "Daggers, sneak attacks, light armor.", main: ["One-Handed", "Sneak", "Light Armor"], sec: ["Archery"], armor: "light", weapon: "One-Handed", role: "fighter", sneaky: true },
    mage: { name: "Mage", desc: "Destruction spells, wards and healing.", main: ["Destruction", "Restoration", "Alteration"], sec: ["Conjuration"], armor: "cloth", weapon: null, role: "fighter", mage: 1 },
    conjurer: { name: "Conjurer", desc: "Summons and the dead, a little fire.", main: ["Conjuration", "Destruction", "Illusion"], sec: ["Alteration"], armor: "cloth", weapon: null, role: "fighter", mage: 1 },
    healer: { name: "Healer", desc: "Keeps you standing: heals and wards.", main: ["Restoration", "Alteration", "Light Armor"], sec: ["Destruction", "One-Handed"], armor: "light", weapon: "One-Handed", role: "healer", mage: 0.5 },
  };
  // [Skyrim] default styles and level caps; race for their look; starting kit (ids that exist in the game are used)
  const INFO = {
    lydia: ["warrior", 50, "nord", ["steel_sword", "steel_shield", "steel_armor", "steel_helmet"]],
    jenassa: ["archer", 40, "dunmer", ["hunting_bow", "leather_armor", "iron_dagger"]],
    belrand: ["spellsword", 40, "nord", ["steel_sword", "chainmail"]],
    marcurio: ["mage", 40, "imperial", ["mage_robes"]],
    vorstag: ["warrior", 40, "nord", ["iron_war_axe", "steel_armor", "steel_helmet", "iron_shield"]],
    stenvar: ["twohand", 40, "nord", ["iron_greatsword", "steel_armor"]],
    erik: ["warrior", 50, "nord", ["iron_sword", "iron_armor"]],
    faendal: ["archer", 30, "bosmer", ["hunting_bow", "leather_armor"]],
    uthgerd: ["twohand", 50, "nord", ["iron_greatsword", "iron_armor"]],
    mjoll: ["warrior", 50, "nord", ["steel_sword", "steel_armor", "steel_shield"]],
    aela: ["archer", 50, "nord", ["hunting_bow", "leather_armor", "steel_dagger"]],
    farkas: ["twohand", 50, "nord", ["steel_greatsword", "steel_armor"]],
    vilkas: ["twohand", 50, "nord", ["steel_greatsword", "steel_armor"]],
    jzargo: ["mage", 50, "khajiit", ["mage_robes"]],
    brelyna: ["conjurer", 50, "dunmer", ["mage_robes"]],
    onmund: ["mage", 50, "nord", ["mage_robes"]],
    benor: ["warrior", 30, "nord", ["iron_war_axe", "iron_armor", "iron_shield"]],
    annekke: ["archer", 50, "nord", ["hunting_bow", "fur_armor"]],
    borgakh: ["warrior", 40, "orc", ["orcish_war_axe", "orcish_armor", "orcish_shield"]],
    teldryn: ["spellsword", 50, "dunmer", ["steel_sword", "chitin_armor"]],
  };
  // [Skyrim] more followers, where you meet them. [OURS] prices; the guild ones need you to have joined that guild
  const MORE = {
    faendal: ["Faendal", "Riverwood", 0, 110, 10, "Wood elf hunter from the Riverwood mill. Handy with a bow."],
    uthgerd: ["Uthgerd the Unbroken", "Whiterun", 100, 160, 12, "Bannered Mare brawler. Lose a bet to her and she'll follow you anywhere."],
    mjoll: ["Mjoll the Lioness", "Riften", 0, 170, 12, "Adventurer cleaning up Riften. Sword, shield and a lot of opinions about the Thieves Guild."],
    aela: ["Aela the Huntress", "Whiterun", 0, 150, 13, "Companion and huntress. Bow, dagger and a wild streak."],
    farkas: ["Farkas", "Whiterun", 0, 190, 13, "Companion. Huge, kind and simple. Hits like a mammoth."],
    vilkas: ["Vilkas", "Whiterun", 0, 175, 13, "Companion. Sharp-tongued master of the greatsword."],
    jzargo: ["J'zargo", "Winterhold", 0, 105, 14, "Khajiit student at the College. Very sure he is the best mage in Skyrim."],
    brelyna: ["Brelyna Maryon", "Winterhold", 0, 105, 12, "Dark elf apprentice at the College. Summons, illusions, nervous spells."],
    onmund: ["Onmund", "Winterhold", 0, 110, 12, "Nord student at the College, proud of it. Fire and frost."],
    benor: ["Benor", "Morthal", 100, 140, 11, "Morthal guard. Beat him and he'll walk with you."],
    annekke: ["Annekke Crag-Jumper", "Darkwater Crossing", 0, 130, 11, "Miner and adventurer from Darkwater Crossing. Good with a bow."],
    borgakh: ["Borgakh the Steel Heart", "Mor Khazgur", 500, 165, 13, "Orc warrior who wants out of her stronghold. Axe and shield."],
    teldryn: ["Teldryn Sero", "Raven Rock", 500, 140, 13, "Dunmer spellsword for hire at the Retching Netch. Chitin, steel and fire."],
  };
  const NEEDS = { aela: "companions", farkas: "companions", vilkas: "companions", jzargo: "college", brelyna: "college", onmund: "college" };
  const NEED_TEXT = { companions: "Join the Companions in Jorrvaskr first.", college: "Join the College of Winterhold first." };

  const SKILLS = () => (typeof PERKS !== "undefined" ? Object.keys(PERKS.TREES) : []);
  const has = (id) => typeof D !== "undefined" && !!D.ITEMS[id];
  const itemOf = (row) => (row ? D.ITEMS[row.item] : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const archOf = (id) => INFO[id]?.[0] || "warrior";
  const capOf = (id) => INFO[id]?.[1] || 40;
  const nameOf = (id) => (typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS[id]?.[0]) || id;
  const FB = () => (typeof FBUILD !== "undefined" ? FBUILD : null);   // folbuild.js: real skills, builds from gear

  // ---- the stored state of one follower
  function st(s, id = s.follower?.id) {
    if (!id) return null;
    s.folData = s.folData || {};
    let f = s.folData[id];
    if (!f) {
      f = s.folData[id] = { inv: [], next: 1, eq: {}, lvl: 1, xp: 0, perks: {}, arch: archOf(id), fights: 0, loyal: 50 };
      f.lvl = clamp((s.level || 1) - 1, 1, capOf(id));
      if (FB()) FB().seed(f, id);
      for (const it of INFO[id]?.[3] || []) if (has(it)) { const r = { id: f.next++, item: it, qty: 1, charge: D.ITEMS[it].enchant?.capacity ?? null }; f.inv.push(r); }
      bestEquip(s, id);
      spend(s, id);
    }
    if (!f.skills && FB()) FB().seed(f, id);   // old saves: skills from their level and build (folbuild.js)
    if (typeof FAI !== "undefined") FAI.seed(f);   // known spells, tactics (followerai.js)
    return f;
  }
  // a stand-in save the perk code can read: level, skills, perks
  function pseudo(f) {
    const a = ARCH[f.arch] || ARCH.warrior, skills = {};
    if (f.skills) return { level: f.lvl, skills: f.skills, perks: f.perks, race: "nord", fx: [], inv: [], loadouts: {}, spells: [] };   // their own skills (folbuild.js)
    for (const k of SKILLS()) {
      const v = a.main.includes(k) ? 20 + 2.6 * (f.lvl - 1) : a.sec.includes(k) ? 15 + 1.5 * (f.lvl - 1) : 15;
      skills[k] = { lvl: Math.round(clamp(v, 15, 100)), xp: 0 };
    }
    return { level: f.lvl, skills, perks: f.perks, race: "nord", fx: [], inv: [], loadouts: {}, spells: [] };
  }
  const skillOf = (f, k) => (f.skills ? f.skills[k]?.lvl ?? 15 : pseudo(f).skills[k]?.lvl || 15);
  const rank = (f, id) => f.perks?.[id] || 0;

  /* [OURS] followers spend their own points: round-robin through their main trees, then the secondary ones,
     taking the first perk each tree allows (roots first, like a player filling a constellation from the bottom) */
  function spend(s, id) {
    const f = st(s, id); if (!f || typeof PERKS === "undefined") return [];
    const a = ARCH[f.arch] || ARCH.warrior, ps = pseudo(f), took = [];
    for (let guard = 0; guard < 200 && PERKS.pointsLeft(ps) > 0; guard++) {
      let got = false;
      for (const group of [a.main, a.sec]) {
        for (const tree of group) {
          if (PERKS.pointsLeft(ps) <= 0) break;
          const list = PERKS.TREES[tree] || [];
          const pick = list.find(([pid]) => !PERKS.canTake(ps, pid));
          if (pick) { PERKS.take(ps, pick[0]); took.push(pick[1]); got = true; }
        }
        if (got) break;
      }
      if (!got) break;
    }
    f.perks = ps.perks;
    return took;
  }
  function setArch(s, arch) {
    const f = st(s); if (!f || !ARCH[arch]) return "No such style.";
    if (f.arch === arch) return `${nameOf(s.follower.id)} already fights as a ${ARCH[arch].name.toLowerCase()}.`;
    f.arch = arch; f.perks = {};
    spend(s, s.follower.id);
    bestEquip(s, s.follower.id);
    return `${nameOf(s.follower.id)} will fight as a ${ARCH[arch].name.toLowerCase()} now and rethinks their perks.`;
  }

  // ---- gear
  const worn = (f, slot) => f.inv.find((r) => r.id === f.eq[slot]) || null;
  const weight = (f) => f.inv.reduce((a, r) => a + (itemOf(r)?.weight || 0) * r.qty, 0);
  const carry = (f) => 150 + 5 * f.lvl;
  /* every equipment slot you have (the engine's shared list: weapon, shield, armor pieces, and jewelry once that's in),
     plus a left hand for a second one-handed weapon, like yours. Numbered slots ("ring1", "ring2") take items of "ring". */
  const SLOTS = () => ((typeof G !== "undefined" && G.SLOTS) || ["weapon", "shield", "head", "chest", "hands", "feet"]).filter((x) => x !== "offhand");
  const ARMOR = () => (typeof G !== "undefined" && G.ARMOR_SLOTS) || ["head", "chest", "hands", "feet", "shield"];
  const fits = (slot, it) => !!it && (slot === it.slot || (slot.startsWith(it.slot) && /\d$/.test(slot)));
  const eqSlots = () => { const l = SLOTS(); const i = l.indexOf("weapon"); return [...l.slice(0, i + 1), "offhand", ...l.slice(i + 1)]; };
  const wearable = (it) => !!it && SLOTS().some((x) => fits(x, it));
  const canOff = (it) => !!it && it.slot === "weapon" && it.hands !== 2 && it.skill === "One-Handed" && !it.staff;
  const SLOT_NAME = { weapon: "Right hand", offhand: "Left hand", shield: "Shield", head: "Head", chest: "Body", hands: "Hands", feet: "Feet", amulet: "Neck", ring: "Ring" };
  const slotName = (k) => SLOT_NAME[k] || SLOT_NAME[k.replace(/\d+$/, "")] || k[0].toUpperCase() + k.slice(1);
  function slotFor(f, it) { const all = SLOTS().filter((x) => fits(x, it)); return all.find((x) => !f.eq[x]) || all[0] || null; }
  function equip(s, rowId, left) {
    const f = st(s); if (!f) return "No follower.";
    const r = f.inv.find((x) => x.id === rowId), it = itemOf(r);
    if (!it || !wearable(it)) return "They can't wear that.";
    if (left) {   // a one-handed weapon in the left hand: no shield, no two-hander
      if (!canOff(it)) return "Only one-handed weapons fit in the left hand.";
      if (itemOf(worn(f, "weapon"))?.hands === 2) return "Not with a two-handed weapon.";
      if (f.eq.weapon === r.id && (r.qty || 1) < 2) return "They only have one of those.";
      delete f.eq.shield; f.eq.offhand = r.id;
      return `${nameOf(s.follower.id)} takes the ${it.name} in their left hand.` + refit(s);
    }
    if (it.slot === "shield" && itemOf(worn(f, "weapon"))?.hands === 2) return "Not with a two-handed weapon.";
    if (it.slot === "shield") delete f.eq.offhand;
    if (it.slot === "weapon" && it.hands === 2) { delete f.eq.shield; delete f.eq.offhand; }
    if (it.slot === "weapon" && f.eq.offhand === r.id && (r.qty || 1) < 2) delete f.eq.offhand;
    f.eq[slotFor(f, it)] = r.id;
    return `${nameOf(s.follower.id)} equips the ${it.name}.` + refit(s);
  }
  function unequip(s, slot) { const f = st(s); if (f) delete f.eq[slot]; return "Taken off." + refit(s); }
  /* their gear changed: the build follows it (folbuild.js), free */
  const refit = (s) => { const m = FB() ? FB().refit(s) : ""; return m ? " " + m : ""; };
  /* best kit for their style: weapon of their skill by damage (a bow for archers), armor of their type by rating */
  function bestEquip(s, id = s.follower?.id) {
    const f = st(s, id); if (!f) return "No follower.";
    const a = ARCH[f.arch] || ARCH.warrior;
    const score = (r) => { const it = itemOf(r); if (!it) return -1;
      if (it.slot !== "weapon" && !ARMOR().includes(it.slot)) return (it.value || 0) / 100 + (it.enchant || it.aenchant ? 10 : 0) + (r.ench ? 10 : 0);   // amulets and rings: the best one
      if (it.slot === "weapon") { if (it.staff) return a.mage ? 50 + (it.value || 0) / 100 : -1; return (it.damage || 0) + (r.temper || 0) + (it.skill === a.weapon ? 100 : it.skill === "One-Handed" && a.weapon === "Two-Handed" ? 20 : 0); }
      const typeBonus = it.type === a.armor ? 100 : a.armor === "cloth" ? (it.type === "cloth" ? 100 : it.type === "light" ? 10 : -50) : it.type === "cloth" ? -20 : 0;
      return (it.armor || 0) + (r.temper || 0) + typeBonus + (it.enchant ? 5 : 0); };
    f.eq = {};
    const used = new Set();
    for (const slot of SLOTS()) {
      const best = f.inv.filter((r) => fits(slot, itemOf(r)) && !used.has(r.id)).sort((x, y) => score(y) - score(x))[0];
      if (!best || score(best) < 0) continue;
      if (slot === "shield" && (a.weapon === "Two-Handed" || a.weapon === "Archery" || itemOf(worn(f, "weapon"))?.hands === 2)) continue;
      if (slot === "weapon" && a.mage === 1 && !itemOf(best).staff) continue;   // mages keep their hands free for spells
      f.eq[slot] = best.id; if ((best.qty || 1) < 2) used.add(best.id);
    }
    if (a.sneaky && a.weapon === "One-Handed" && !f.eq.shield) {   // thieves fight with a blade in each hand when they have two
      const off = f.inv.filter((r) => canOff(itemOf(r)) && !used.has(r.id)).sort((x, y) => score(y) - score(x))[0];
      if (off && f.eq.weapon) f.eq.offhand = off.id;
    }
    return `${nameOf(id)} puts on their best kit.`;
  }
  const STACK = new Set(["potion", "ammo", "ingredient", "misc", "food", "ore", "ingot", "gem", "soulgem", "scroll", "poison"]);
  const stackable = (it) => it && (STACK.has(it.slot) || !wearable(it)) && !it.enchant;
  /* hand an item from your pack to them */
  function give(s, invId, qty = 1) {
    const f = st(s); if (!f) return "No follower.";
    const r = G.invRow(s, invId), it = itemOf(r);
    if (!r || !it) return "You don't have that.";
    if (it.quest) return "Keep quest items yourself.";
    const free = G.freeQty ? G.freeQty(s, r.id) : r.qty;   // what you wear now never changes hands; a pair with one worn gives the spare
    if (free <= 0) return "You're wearing that. Take it off first.";
    const n = Math.min(free, Math.max(1, qty));
    if (r.qty <= n) { const ids = new Set(); for (const l of Object.values(s.loadouts || {})) for (const v of Object.values(l.equipment || {})) ids.add(v); if (ids.has(r.id)) return "You're wearing that in a loadout. Take it off first."; }
    if (weight(f) + (it.weight || 0) * n > carry(f) + 1e-6) return `${nameOf(s.follower.id)} can't carry that much (${Math.round(weight(f))}/${carry(f)}).`;
    const copy = { ...r, qty: n };
    G.take(s, r.id, n);
    const same = stackable(it) && f.inv.find((x) => x.item === r.item && !x.temper && !x.ench);
    if (same) same.qty += n; else f.inv.push({ ...copy, id: f.next++ });
    return `You give ${nameOf(s.follower.id)} ${n > 1 ? n + "× " : ""}${it.name}.`;
  }
  /* take an item back */
  function takeBack(s, rowId, qty = 1) {
    const f = st(s); if (!f) return "No follower.";
    const r = f.inv.find((x) => x.id === rowId), it = itemOf(r);
    if (!r) return "They don't have that.";
    const n = Math.min(r.qty, Math.max(1, qty));
    r.qty -= n;
    let wasWorn = false;
    if (r.qty <= 0) { f.inv = f.inv.filter((x) => x !== r); for (const k of Object.keys(f.eq)) if (f.eq[k] === r.id) { delete f.eq[k]; wasWorn = true; } }
    if (stackable(it)) G.give(s, r.item, n);
    else { const { id: _drop, ...rest } = r; s.inv.push({ ...rest, qty: 1, id: s.nextInv++ }); for (let i = 1; i < n; i++) s.inv.push({ ...rest, qty: 1, id: s.nextInv++ }); }
    return `You take ${n > 1 ? n + "× " : ""}${it?.name || "it"} back.` + (wasWorn ? refit(s) : "");
  }

  // ---- what their kit and perks mean in a fight
  const DMG_PERK = { "One-Handed": "armsman", "Two-Handed": "barbarian", Archery: "overdraw" };
  const ARMOR_PERK = { heavy: "juggernaut", light: "agile_defender" };
  const ARROW = () => (typeof F !== "undefined" ? F.IRON_ARROW_DAMAGE || 8 : 8);
  function bestArrow(f) { let b = 0; for (const r of f.inv) { const it = itemOf(r); if (it?.slot === "ammo" && it.ammo === "arrow") b = Math.max(b, it.damage || 0); } return b; }
  /* raw hit before the 55% follower share: weapon (or spells) × skill × their damage perk */
  function rawHit(f) {
    const a = ARCH[f.arch] || ARCH.warrior, w = worn(f, "weapon"), it = itemOf(w);
    let melee;
    if (it && !it.staff) {
      const sk = it.skill || "One-Handed", bow = sk === "Archery";
      const base = (it.damage || 4) + (w.temper || 0) + (bow ? Math.max(0, bestArrow(f) - ARROW()) : 0);
      const wd = typeof F !== "undefined" ? F.weaponDamage(base, skillOf(f, sk), bow) : base * (1 + skillOf(f, sk) / 200);
      melee = wd * (1 + 0.2 * rank(f, DMG_PERK[sk] || "")) * (it.hands === 2 ? 0.65 : 1);   // [OURS] big weapons and bows swing slower: about the same damage a turn
    } else melee = 4 * (1 + skillOf(f, "Hand-to-Hand") / 200);
    if (!a.mage) return melee;
    // [OURS] a follower's spells: about a Firebolt that grows with Destruction, boosted by Augmented Flames/Frost/Shock
    const aug = Math.max(rank(f, "augmented_flames"), rank(f, "augmented_frost"), rank(f, "augmented_shock"));
    const spell = (6 + skillOf(f, a.main.includes("Destruction") || a.sec.includes("Destruction") ? "Destruction" : "Conjuration") * 0.18) * (1 + 0.25 * aug) * (it?.staff ? 1.15 : 1);
    return a.mage >= 1 ? spell : melee * (1 - a.mage) + spell * a.mage;
  }
  const pnum = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) || 0 : 0);   // Leadership (Speechcraft)
  const dmg = (s) => { const f = st(s); return f ? Math.round(rawHit(f) * 0.55 * 10) / 10 : 0; };
  function armorRating(f) {
    const a = ARCH[f.arch] || ARCH.warrior;
    let ar = 0;
    for (const slot of ARMOR()) { const r = worn(f, slot), it = itemOf(r); if (!it || !it.armor) continue;
      const sk = it.type === "heavy" ? "Heavy Armor" : it.type === "light" ? "Light Armor" : slot === "shield" ? "Blocking" : null;
      ar += (it.armor + (r.temper || 0)) * (1 + (sk ? skillOf(f, sk) : 15) / 200) * (1 + 0.2 * rank(f, ARMOR_PERK[it.type] || "")); }
    if (a.mage && a.main.includes("Alteration")) ar += 40 + skillOf(f, "Alteration") * 0.6;   // [Skyrim] mages cast a flesh spell
    return Math.round(ar);
  }
  /* share of a blow they still feel: 1 = no armor, at most 60% off */
  const taken = (s) => { const f = st(s); return f ? Math.round((1 - Math.min(0.6, armorRating(f) / 400)) * (1 - Math.min(0.2, pnum(s, "foltaken"))) * 100) / 100 : 0.8; };
  function maxHp(s, id = s.follower?.id) {
    const fd = typeof TOWNS !== "undefined" ? TOWNS.FOLLOWERS[id] : null; if (!fd) return 100;
    const f = s.folData?.[id];
    const lvl = f ? f.lvl : clamp((s.level || 1) - 1, 1, capOf(id));
    if (f?.ups) return Math.round(fd[3] * (1 + 0.015 * (lvl - 1)) + 10 * (f.ups.health || 0));   // folbuild.js: +10 for every Health pick at a level-up
    return Math.round(fd[3] * (1 + 0.05 * (lvl - 1)));   // [OURS] same 5% a level as before, but by their own level
  }
  const potions = (f) => f.inv.filter((r) => itemOf(r)?.restore?.[0] === "health");
  const healer = (f) => { const a = ARCH[f.arch] || ARCH.warrior; return a.role === "healer" || (a.mage && a.main.includes("Restoration")); };
  const healAmt = (f) => Math.round(20 + skillOf(f, "Restoration") * 0.6);
  /* an ally record for your own follower (engine pushes it) */
  function ally(s, hp) {
    const f = st(s); if (!f) return null;
    const rec = { name: nameOf(s.follower.id), dmg: dmg(s), hp, follower: true, fid: s.follower.id, kind: "follower", look: look(s), heals: healer(f) && skillOf(f, "Restoration") >= 25 ? 2 : 0 };
    return typeof FAI !== "undefined" ? FAI.equipAlly(s, f, rec) : rec;   // spells, magicka, stamina, pace, tactics
  }
  /* their own turn's extras: drink a potion when badly hurt, heal you when you're in trouble. null = just attack */
  function turn(fight, al) {
    const s = fight.s, f = s.folData?.[al.fid]; if (!f || al.fid !== s.follower?.id) return null;
    if (al.fai && typeof FAI !== "undefined") return FAI.turn(null, fight, al) || ` · ${al.name} keeps their guard up`;   // their whole turn, picked by their AI
    const max = maxHp(s, al.fid);
    if (al.hp < max * 0.35) { const p = potions(f)[0]; if (p) { const amt = D.ITEMS[p.item].restore[1]; al.hp = Math.min(max, al.hp + amt); p.qty--; if (p.qty <= 0) f.inv = f.inv.filter((x) => x !== p); return ` · ${al.name} drinks a ${D.ITEMS[p.item].name} (+${amt})`; } }
    if (al.heals > 0 && fight.hp > 0 && fight.hp < G.maxHealth(s) * 0.4) { al.heals--; const before = fight.hp; fight.hp = Math.min(G.maxHealth(s), fight.hp + healAmt(f)); return ` · ${al.name} heals you +${Math.round(fight.hp - before)}`; }
    return null;
  }

  // ---- levels: [OURS] XP from fights they were in; they level up on their own, never past you or their cap
  const need = (lvl) => 60 + 20 * lvl;
  function gain(s, fight) {
    const f = st(s); if (!f || !fight) return [];
    const e = fight.e || {}, id = s.follower.id;
    f.fights = (f.fights || 0) + 1;
    if (FB()) { if (fight.won) f.loyal = Math.min(100, (f.loyal || 50) + 1); return FB().after(s, fight); }   // skills rise with use, levels from skill XP (folbuild.js)
    if (!fight.won) return [];
    const behind = f.lvl < (s.level || 1) - 3 ? 2 : 1;
    f.xp += Math.round((12 + (e.level || s.level || 1) * 3) * (e.boss || (e.tags || []).includes("boss") ? 3 : 1) * behind * (1 + Math.min(0.5, pnum(s, "folxp"))));
    f.loyal = Math.min(100, (f.loyal || 50) + 1);
    const top = Math.min(capOf(id), Math.max(1, s.level || 1)), msgs = [];
    while (f.lvl < top && f.xp >= need(f.lvl)) {
      f.xp -= need(f.lvl); f.lvl++;
      const took = spend(s, id);
      msgs.push(` ${nameOf(id)} reaches level ${f.lvl}${took.length ? ` and learns ${took.join(", ")}` : ""}.`);
    }
    if (f.lvl >= top) f.xp = Math.min(f.xp, need(f.lvl) - 1);
    return msgs;
  }

  // ---- how they look (your screen and everyone else's)
  const raceOf = (id) => INFO[id]?.[2] || "nord";
  const eqItems = (f) => { const o = {}; for (const slot of eqSlots()) { const r = worn(f, slot); if (r) o[slot] = r.item; } return o; };
  function look(s, id = s.follower?.id) { const f = st(s, id); return { r: raceOf(id), id: "f-" + id, eq: f ? eqItems(f) : {}, gl: {} }; }
  /* the small summary that goes in your player card, so party members can see and fight beside them */
  function card(s) {
    const id = s.follower?.id; if (!id) return null;
    const f = st(s), a = ARCH[f.arch] || ARCH.warrior, mx = maxHp(s, id);
    return { id, n: nameOf(id), l: f.lvl, a: f.arch, r: raceOf(id), eq: eqItems(f), dmg: dmg(s), hp: mx,
      cur: Math.round(typeof TOWNS !== "undefined" ? TOWNS.followerHp(s) : mx), red: Math.round((1 - taken(s)) * 100) / 100, role: a.role, heals: healer(f) ? 2 : 0, ha: healAmt(f), sn: !!a.sneaky,
      ...(FB() ? FB().card(f) : {}) };   // their top skills and perk count, for party members' screens
  }
  const lookFromCard = (c) => (c?.fold ? { r: c.fold.r || "nord", id: "f-" + c.fold.id + "-" + c.id, eq: { ...(c.fold.eq || {}) }, gl: {} } : null);
  /* someone else's follower, fighting beside you on your phone from their card ([OURS] same fighting code as co-op allies) */
  function cardAllies(c) {
    const p = c?.fold; if (!p || !p.id) return [];
    const hp = Math.max(20, p.cur || p.hp || 100);
    return [{ name: p.n || nameOf(p.id), dmg: Math.max(1, p.dmg || 5), hp, maxHp: p.hp || hp, red: clamp(p.red || 0, 0, 0.7), role: p.role || "fighter", sneaky: !!p.sn,
      healAt: 45, healAmt: p.ha || 0, heals: p.heals || 0, potAt: 0, pots: 0, potAmt: 50, coop: typeof COOP !== "undefined", kind: "follower", fid: p.id, ofUid: c.id, look: lookFromCard(c), partyFollower: true }];
  }

  // ---- hiring the extra followers (added to the town list) and their conditions
  function install() {
    looks();
    if (typeof TOWNS === "undefined" || TOWNS.__fol2) return;
    TOWNS.__fol2 = true;
    for (const [id, row] of Object.entries(MORE)) if (!TOWNS.FOLLOWERS[id] && (typeof WORLD === "undefined" || WORLD.places[row[1]])) TOWNS.FOLLOWERS[id] = row;
    const hire0 = TOWNS.hire;
    TOWNS.hire = (s, id, t) => {
      const need = NEEDS[id];
      if (need && !(s.quests && s.quests[need])) return `${nameOf(id)} won't follow an outsider. ${NEED_TEXT[need]}`;
      const msg = hire0(s, id, t);
      if (s.follower?.id === id) { st(s, id); s.follower.hp = maxHp(s, id); }
      return msg;
    };
  }
  const lookDone = { p: false, n: false };
  function looks() {
    if (typeof PARTY !== "undefined" && PARTY.FOLLOWER_LOOK && !lookDone.p) { lookDone.p = true; for (const [id, i] of Object.entries(INFO)) if (!PARTY.FOLLOWER_LOOK[id]) PARTY.FOLLOWER_LOOK[id] = { r: i[2], eq: Object.fromEntries(i[3].filter(has).map((x) => [D.ITEMS[x].slot, x])) }; }
  }

  // ---- the follower screen (Hero tab): card, then Pack / Skills & perks / Style
  let view = "card", invTab = "theirs", perkTree = null;
  const fmtW = (n) => (Math.round(n * 10) / 10).toString();
  function panel(s, esc) {
    install();
    if (!s.follower || typeof TOWNS === "undefined" || !TOWNS.FOLLOWERS[s.follower.id]) return "";
    const id = s.follower.id, f = st(s), a = ARCH[f.arch] || ARCH.warrior, mx = maxHp(s, id), hp = Math.round(TOWNS.followerHp(s));
    const top = Math.min(capOf(id), s.level || 1), portrait = typeof NPCART !== "undefined" ? NPCART.follower(id, 44) : "";
    const tabs = `<div class="seg fol2tabs" role="tablist" aria-label="Follower">${[["card", "Overview"], ["bond", "Bond"], ["inv", "Gear"], ["magic", "Magic"], ["tactics", "Tactics"], ["perks", FB() ? "Skills" : "Perks"]].filter(([k]) => (typeof FAI !== "undefined" || (k !== "magic" && k !== "tactics")) && (k !== "bond" || typeof BONDS !== "undefined")).map(([k, l]) => `<button class="${view === k ? "on" : ""}" role="tab" aria-selected="${view === k}" data-act="fol2" data-op="view" data-id="${k}">${l}</button>`).join("")}</div>`;   // one row, no wrapping (menus2)
    const head = `<div class="item fol2head">${portrait}<div class="t">${esc(nameOf(id))} <span class="num">Lv ${f.lvl}</span><span>${esc(a.name)} · ${hp}/${mx} health · hits ~${Math.round(dmg(s))} · armor ${armorRating(f)} · goes down instead of dying</span>
      <div class="bar fol2xp"><i style="width:${f.lvl >= top ? 100 : Math.round((FB() && f.skills ? (f.cxp || 0) / F.charXpNeeded(f.lvl) : f.xp / need(f.lvl)) * 100)}%"></i></div><span class="sub">${f.lvl >= top ? (f.lvl >= capOf(id) ? `Level cap ${capOf(id)}` : "Levels up as you do") : FB() && f.skills ? `${Math.floor(f.cxp || 0)}/${F.charXpNeeded(f.lvl)} toward level ${f.lvl + 1}` : `${f.xp}/${need(f.lvl)} XP to level ${f.lvl + 1}`}${typeof BONDS !== "undefined" ? "" : ` · loyalty ${f.loyal || 50}/100`}</span>${typeof BONDS !== "undefined" ? BONDS.meter(s, esc) : ""}</div>
      <button class="btn sm" data-act="dismiss">Dismiss</button></div>`;
    let body = "";
    if (view === "card") {
      const gear = eqSlots().map((slot) => { const r = worn(f, slot), it = itemOf(r); return `<div class="slot">${esc(slotName(slot))}<b style="display:block">${it ? esc(it.name) + (r.temper ? ` +${r.temper}` : "") : "—"}</b></div>`; }).join("");
      body = `<div class="grid2 fol2gear">${gear}</div>
        <h3>Fighting style</h3><p class="sub">${esc(a.desc)} Main skills: ${a.main.map(esc).join(", ")}. They pick perks from these trees by themselves.</p>${FB() ? `<p class="sub">Their gear picks the build; tap a style to have them put on their best gear for it.</p>` : ""}
        <div class="chips m2-row">${Object.entries(ARCH).map(([k, v]) => `<button class="chip ${k === f.arch ? "on" : ""}" data-act="fol2" data-op="arch" data-id="${k}">${esc(v.name)}${k === archOf(id) ? " ★" : ""}</button>`).join("")}</div>
        <p class="sub">★ = their natural style. Changing it resets and re-picks their perks.</p>`;
    } else if (view === "inv" && typeof FOLTAB !== "undefined") body = FOLTAB.gear(s, f, esc);   // SkyUI-style list (followertab.js)
    else if (view === "inv") {
      const mine = (G.handable ? G.handable(s) : s.inv).filter((r) => { const it = itemOf(r); return it && !it.quest && (wearable(it) || it.slot === "ammo" || it.restore); });
      const rows = invTab === "theirs"
        ? f.inv.map((r) => { const it = itemOf(r), on = Object.values(f.eq).includes(r.id), eqable = wearable(it), slotOn = on ? Object.keys(f.eq).find((k) => f.eq[k] === r.id) : null;
            return `<div class="item ${on ? "on" : ""}"><div class="t">${esc(it?.name || r.item)}${r.qty > 1 ? ` <span class="num">×${r.qty}</span>` : ""}${on ? " · worn" : ""}<span>${it?.damage ? `dmg ${it.damage} · ` : ""}${it?.armor ? `armor ${it.armor} · ` : ""}${fmtW((it?.weight || 0) * r.qty)} wt</span></div>
              ${eqable ? (on ? `<button class="btn sm" data-act="fol2" data-op="uneq" data-id="${slotOn}">Take off</button>` : `<button class="btn sm pri" data-act="fol2" data-op="eq" data-id="${r.id}">Equip</button>${canOff(it) && f.eq.weapon ? `<button class="btn sm" data-act="fol2" data-op="eqoff" data-id="${r.id}">Left hand</button>` : ""}`) : ""}
              <button class="btn sm" data-act="fol2" data-op="take" data-id="${r.id}" data-q="${r.qty}">Take</button></div>`; }).join("") || `<p class="sub">Their pack is empty. Give them gear from yours.</p>`
        : mine.map((r) => { const it = itemOf(r); return `<div class="item"><div class="t">${esc(it.name)}${r.qty > 1 ? ` <span class="num">×${r.qty}</span>` : ""}<span>${it.damage ? `dmg ${it.damage} · ` : ""}${it.armor ? `armor ${it.armor} · ` : ""}${fmtW((it.weight || 0) * r.qty)} wt</span></div>
              <button class="btn sm pri" data-act="fol2" data-op="give" data-id="${r.id}" data-q="1">Give</button>${r.qty > 1 ? `<button class="btn sm" data-act="fol2" data-op="give" data-id="${r.id}" data-q="${r.qty}">All</button>` : ""}</div>`; }).join("") || `<p class="sub">Nothing in your pack they could use.</p>`;
      body = `<p class="sub num">Their pack: ${fmtW(weight(f))}/${carry(f)} weight · potions they carry are drunk when they're badly hurt · archers shoot their best arrows (they never run out)</p>
        <div class="chips m2-row">${[["theirs", "Their pack"], ["yours", "Give from yours"]].map(([k, l]) => `<button class="chip ${invTab === k ? "on" : ""}" data-act="fol2" data-op="invtab" data-id="${k}">${l}</button>`).join("")}
        <button class="btn sm" data-act="fol2" data-op="best">Best gear</button></div><div class="list fol2list">${rows}</div>`;
    } else if (view === "bond" && typeof BONDS !== "undefined") body = BONDS.tab(s, esc);   // opinions, loyalty, personal quest (followerbonds.js)
    else if (view === "magic" && typeof FAI !== "undefined") body = FAI.magicTab(s, f, esc);
    else if (view === "tactics" && typeof FAI !== "undefined") body = FAI.tacticsTab(s, f, esc);
    else {
      const ps = pseudo(f), trees = [...a.main, ...a.sec].filter((k) => PERKS.TREES[k]);
      if (FB()) body += FB().view(s, f, esc, id) + `<h3>Browse their trees</h3>`;
      if (!trees.includes(perkTree)) perkTree = trees[0];
      const taken0 = Object.values(f.perks || {}).reduce((x, y) => x + y, 0);
      body += `<p class="sub">${taken0} perks taken · ${Math.max(0, PERKS.pointsLeft(ps))} waiting (they spend them themselves as soon as they can)</p>
        <div class="grid2 fol2skills">${trees.map((k) => `<div class="slot">${esc(k)} <b class="num">${ps.skills[k].lvl}</b><div class="bar"><i style="width:${ps.skills[k].lvl}%"></i></div></div>`).join("")}</div>
        <div class="chips m2-row">${trees.map((k) => `<button class="chip ${k === perkTree ? "on" : ""}" data-act="fol2" data-op="tree" data-id="${esc(k)}">${esc(k)} ${PERKS.TREES[k].filter(([pid]) => rank(f, pid)).length}/${PERKS.TREES[k].length}</button>`).join("")}</div>
        ${typeof SKYUI !== "undefined" ? `<div class="skc fol2sky">${SKYUI.svg(perkTree, ps)}</div>` : ""}
        <div class="list">${PERKS.TREES[perkTree].map(([pid, name, ranks]) => { const r = rank(f, pid); return `<div class="item ${r ? "on" : ""}"><div class="t">${esc(name)}${ranks > 1 ? ` <span class="num">${r}/${ranks}</span>` : r ? " ✓" : ""}<span>${esc(PERKS.BY_ID[pid].desc)}</span></div></div>`; }).join("")}</div>`;
    }
    return `<div class="panel fol2"><h2>Follower</h2>${head}${tabs}${body}</div>`;
  }
  function act(s, d) {
    const op = d.op, id = d.id;
    switch (op) {
      case "view": view = id; return "";
      case "invtab": invTab = id; return "";
      case "tree": perkTree = id; return "";
      case "arch": return setArch(s, id);
      case "eq": return equip(s, +id);
      case "eqoff": return equip(s, +id, true);
      case "teach": return typeof FAI !== "undefined" ? FAI.teach(s, +id) + refit(s) : "";
      case "spell": return typeof FAI !== "undefined" ? FAI.toggle(s, id) : "";
      case "tactic": return typeof FAI !== "undefined" ? FAI.setTactic(s, id) : "";
      case "savepots": return typeof FAI !== "undefined" ? FAI.setSavePots(s, id === "1") : "";
      case "uneq": return unequip(s, id);
      case "best": return bestEquip(s) + refit(s);
      case "give": return give(s, +id, +(d.q || 1));
      case "take": return takeBack(s, +id, +(d.q || 1));
    }
    return typeof FOLTAB !== "undefined" ? FOLTAB.act(s, d) : "";   // the Follower tab's own list taps (followertab.js)
  }
  const reset = () => { view = "card"; invTab = "theirs"; perkTree = null; };

  install();
  return { ARCH, INFO, MORE, NEEDS, st, pseudo, skillOf, spend, setArch, equip, unequip, bestEquip, give, takeBack, weight, carry, rawHit, dmg, armorRating, taken, maxHp,
    ally, turn, gain, need, look, card, lookFromCard, cardAllies, install, panel, act, reset, capOf, archOf, slotName, wearable, canOff, eqSlots, worn, nameOf, get view() { return view; } };
})();
if (typeof module !== "undefined") module.exports = FOL2;
