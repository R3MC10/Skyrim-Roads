/* Game rules. No screen code here. A player's whole save is one plain object (easy to sync over the network).
   Shared world things (other players, dropped bags) go through the store in store.js. */
const G = (() => {
  const MAP_W = 1000, MAP_H = 700;
  const BASE_WALK = 17.2;          // px per real minute walking; running at Athletics 15 → Whiterun–Windhelm ≈ 10 min
  /* how close you must pass to spot a place: cities from far off, small spots only up close ([OURS]) */
  const discoverRadius = (kind) => ({ city: 90, town: 65, dungeon: 50, fort: 50, lair: 50, camp: 50 })[kind] || 40;
  const ENCOUNTER_PER_MIN = 0.16, DISCOVER_PX = 55, BAG_PICKUP_PX = 30, BAG_MINUTES = 30, TRAIL_STEP_PX = 25;
  const STEP_SECONDS = 30;          // travel is simulated in 30-second steps (also while the page is closed)
  const GAME_SPEED = 12, GAME_EPOCH = 1795132800, NIGHT_START = 20, NIGHT_END = 6, SHOP_OPEN = 8, SHOP_CLOSE = 20;
  const SLOTS = ["weapon", "shield", "head", "chest", "hands", "feet", "amulet", "ring"];
  const JEWEL_SLOTS = ["amulet", "ring", "ring2"];   // [Skyrim] one amulet, and (ours) two rings: "ring2" is the second ring finger
  const ARMOR_SLOTS = ["head", "chest", "hands", "feet", "shield"];
  const ARMOR_SKILL = { light: "Light Armor", medium: "Medium Armor", heavy: "Heavy Armor" };
  const STACKABLE = new Set(["potion", "scroll", "soulgem", "tome", "ingredient", "trophy", "poison", "material", "food", "valuable", "ammo"]);
  const P = (s, id) => (typeof PERKS !== "undefined" ? PERKS.rank(s, id) : 0);
  // spell tiers for the "Novice ... Expert <school>" perks [Skyrim]
  const SPELL_TIER = { flames: "novice", frostbite: "novice", sparks: "novice", healing: "novice", oakflesh: "novice", conjure_familiar: "novice", fury: "novice",
    firebolt: "apprentice", ice_spike: "apprentice", lightning_bolt: "apprentice", fast_healing: "apprentice", sun_fire: "apprentice", calm: "apprentice", fireball: "adept" };
  // weapon type from its id (for Bladesman, Bone Breaker, Assassin's Blade...)
  function wtype(id) {
    if (!id) return "fist";
    if (/dagger/.test(id)) return "dagger"; if (/greatsword/.test(id)) return "greatsword"; if (/battleaxe/.test(id)) return "battleaxe";
    if (/warhammer/.test(id)) return "warhammer"; if (/bow/.test(id)) return "bow"; if (/spear/.test(id)) return "spear";
    if (/war_axe|_axe/.test(id)) return "axe"; if (/mace/.test(id)) return "mace"; return "sword";
  }
  /* active potion effects: s.fx = [{key, mag, until, name}]. key e.g. "skill:Sneak", "dmg:One-Handed", "max:health", "carry", "barter" */
  function fxSum(s, key, t = now()) {
    return (s.fx || []).filter((f) => f.key === key && f.until > t).reduce((a, f) => a + f.mag, 0)
      + (typeof ENCH !== "undefined" && s.loadouts ? ENCH.worn(s, key) : 0)   // potions + enchanted armor you wear
      + (typeof CURSE !== "undefined" ? CURSE.fx(s, key, t) : 0);             // vampire strengths and weaknesses
  }
  const rested = (s, t = now()) => (s.rested || 0) > t;
  const now = () => Date.now() / 1000;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pxDist = (a, b) => Math.hypot((a[0] - b[0]) * MAP_W, (a[1] - b[1]) * MAP_H);
  const PLACES = WORLD.places;
  const loc = (name) => PLACES[name];
  const holdAt = (pos) => WORLD.isSol?.(pos) ? "Solstheim" : WORLD.holdAt ? WORLD.holdAt(pos) : Object.keys(WORLD.holds).reduce((best, h) =>
    pxDist(pos, WORLD.holds[h][1]) < pxDist(pos, WORLD.holds[best][1]) ? h : best);

  // ---------------------------------------------------------------- clock
  function clock(t = now()) {
    const hours = (t - GAME_EPOCH) * GAME_SPEED / 3600 + 8;
    return { day: Math.floor(hours / 24) + 1, hour: ((hours % 24) + 24) % 24 };
  }
  const isNight = (t) => { const h = clock(t).hour; return h >= NIGHT_START || h < NIGHT_END; };
  const shopsOpen = (t) => { const h = clock(t).hour; return h >= SHOP_OPEN && h < SHOP_CLOSE; };
  function clockText(t) {
    const { day, hour } = clock(t);
    return `Day ${day}, ${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.floor((hour % 1) * 60)).padStart(2, "0")}`;
  }

  // ---------------------------------------------------------------- new character
  function newSave(id, name, raceId) {
    const race = D.RACES[raceId];
    const skills = {};
    for (const s of D.ALL_SKILLS) skills[s] = { lvl: D.BASE_SKILL, xp: 0 };
    race.skills.forEach((s, i) => {
      for (const t of (s === "Speech" ? ["Speechcraft", "Mercantile"] : [s])) skills[t].lvl += i === 0 ? 10 : 5;
    });
    const [x, y] = loc(D.START_LOCATION);
    const s = {
      v: 5, id, name, race: raceId, level: 1, charXp: 0, pendingLevels: 0, hpBonus: 0, mpBonus: 0, spBonus: 0,
      health: 100, healthTs: now(), gold: D.START_GOLD, x, y, location: D.START_LOCATION,
      discovered: [...D.START_DISCOVERED], explored: [[x, y]], skills, spells: [...D.START_SPELLS], horse: null,
      inv: [], nextInv: 1, loadouts: {}, loadout: "Main", trip: null, journal: [], created: now(),
    };
    const eq = {};
    for (const [item, qty, equip] of D.START_KIT) {
      const id2 = give(s, item, qty);
      if (equip) eq[D.ITEMS[item].slot] = id2;
    }
    s.loadouts.Main = { rules: clone(D.PRESETS[D.DEFAULT_PRESET].rules), equipment: eq };
    note(s, `You arrive in ${D.START_LOCATION}.`);
    return s;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  /* Older saves: the world map changed in v2, so put the player in the matching town and drop old places. */
  /* moves a point from an older map onto this one: same offset from the nearest place that existed then */
  const movedFrom = (old) => (p) => {
    if (WORLD.isSol?.(p)) return p;   // Solstheim didn't move
    let best = null, bd = Infinity;
    for (const [n, q] of Object.entries(old)) { const d = pxDist(p, q); if (d < bd && PLACES[n]) { bd = d; best = n; } }
    if (!best) return [...loc(D.START_LOCATION).slice(0, 2)];
    const o = old[best], n = loc(best), k = bd < 25 ? 1 : 25 / bd;   // keep a small offset from the nearest place
    let q = [n[0] + (p[0] - o[0]) * k, n[1] + (p[1] - o[1]) * k];
    if (typeof ROAM !== "undefined") q = ROAM.snap(q) || [n[0], n[1]];
    return [+q[0].toFixed(4), +q[1].toFixed(4)];
  };
  function migrate(s) {
    // a won turn-by-turn road fight used to leave the road blocked by a dead foe: clear it
    if (s.trip?.status === "encounter" && (!s.trip.encounter || s.trip.encounter.hp <= 0)) { s.trip.status = "travel"; s.trip.encounter = null; s.trip.lastTick = now(); }
    if (s.dungeon?.room?.enemy && s.dungeon.room.enemy.hp <= 0) s.dungeon.room = null;   // same bug inside dungeons: a dead foe kept the room shut
    if ((s.v || 1) < 2) {
      const at = PLACES[s.location] ? s.location : D.START_LOCATION;
      [s.x, s.y] = loc(at); s.location = at; s.trip = null;
      s.discovered = [...new Set([...s.discovered.filter((n) => PLACES[n]), ...D.START_DISCOVERED])];
      s.explored = s.discovered.map((n) => [...loc(n).slice(0, 2)]);
      s.v = 5;   // already placed on the current map
      note(s, "The world map was redrawn. You find yourself in " + at + ".");
    }
    if (s.v < 3 && WORLD.v2Places) {   // the map became 1:1 with Skyrim: move you (and the trail you've walked) to the same spot on it
      const moveOld = movedFrom(WORLD.v2Places);
      if (PLACES[s.location]) [s.x, s.y] = loc(s.location).slice(0, 2);
      else [s.x, s.y] = moveOld([s.x, s.y]);
      if (s.trip && !s.trip.boat) { s.trip = null; note(s, "Your journey was interrupted: the world map was redrawn to match Skyrim's real layout."); }
      s.explored = (s.explored || []).map((p) => moveOld(p)).filter((p, i, a) => !i || pxDist(p, a[i - 1]) > 2).slice(-400);
      if (!s.explored.length) s.explored = [[s.x, s.y]];
      s.v = 5;   // straight onto the current map
      note(s, "🗺 The world map now matches Skyrim 1:1 — coast, borders, holds, roads and every place where it really is.");
    }
    if (s.v < 4) {   // the coast was sharpened (Solitude's estuary, the Hjaalmarch inlets, Dawnstar's bay): step out of any new water
      if (PLACES[s.location]) [s.x, s.y] = loc(s.location).slice(0, 2);
      else if (!s.trip && typeof ROAM !== "undefined" && !WORLD.isSol?.([s.x, s.y])) { const q = ROAM.snap([s.x, s.y]); if (q) [s.x, s.y] = [+q[0].toFixed(4), +q[1].toFixed(4)]; }
      s.v = 4;
    }
    if (s.v < 5 && WORLD.v4Places) {   // the map was re-measured from the game's own markers, heights and roads: move to the same spot on it
      const moveOld = movedFrom(WORLD.v4Places);
      if (PLACES[s.location]) [s.x, s.y] = loc(s.location).slice(0, 2);
      else [s.x, s.y] = moveOld([s.x, s.y]);
      if (s.trip && !s.trip.boat) { s.trip = null; note(s, "Your journey was interrupted: the map was re-measured from the real game."); }
      s.explored = (s.explored || []).map((p) => moveOld(p)).filter((p, i, a) => !i || pxDist(p, a[i - 1]) > 2).slice(-400);
      if (!s.explored.length) s.explored = [[s.x, s.y]];
      s.v = 5;
      note(s, "🗺 The world map was re-measured from Skyrim itself: every place, road, river, lake and mountain now sits exactly where it is in the game.");
    }
    s.discovered = s.discovered.filter((n) => PLACES[n]);
    for (const r of [...(s.inv || [])]) {   // rings and amulets used to stack as valuables: now each one is its own piece of gear
      const it = D.ITEMS[r.item];
      if (it && (it.slot === "ring" || it.slot === "amulet") && r.qty > 1) { const n = r.qty - 1; r.qty = 1; for (let i = 0; i < n; i++) s.inv.push({ id: s.nextInv++, item: r.item, qty: 1, charge: null }); }
    }
    if (typeof AMMO !== "undefined") { const m = AMMO.migrate(s); if (m) note(s, m); }
    if (fixTactics(s)) note(s, "⚔ Your tactics were fixed: rules you added under \"Always → Attack\" never fired. They now come first.");
    if (typeof SPELLCRAFT !== "undefined") SPELLCRAFT.register(s);   // crafted spells back into the spellbook
    // Bleak Falls Barrow cleared but no Dragonstone (the claw door used to make the boss skip it): hand it over so the quest can finish
    if (s.cleared?.["Bleak Falls Barrow"] && !s.thaneWhiterun && typeof DUNGEONS !== "undefined" && D.ITEMS.dragonstone && !DUNGEONS.hasDragonstone(s)) {
      give(s, "dragonstone");
      note(s, "📜 You find the Dragonstone from Bleak Falls Barrow in your pack after all. Bring it to Farengar in Dragonsreach (Whiterun).");
    }
    return s;
  }
  function note(s, text) { s.journal.unshift({ t: now(), text }); s.journal = s.journal.slice(0, 60); }

  // ---------------------------------------------------------------- stats
  const maxHealth = (s) => 100 + s.hpBonus + fxSum(s, "max:health");
  const maxMagicka = (s) => D.RACES[s.race].magicka + s.mpBonus + fxSum(s, "max:magicka") + (s.stone === "atronach" ? 50 : 0);   // [Skyrim] Atronach Stone
  const maxStamina = (s) => 100 + s.spBonus + fxSum(s, "max:stamina");
  function curHealth(s, t = now()) {
    if (s.dungeon) return Math.min(maxHealth(s), s.health);   // [OURS] no regeneration inside a dungeon
    // [OURS] no passive healing: health only comes back from potions, food, spells, beds, or a "regenerate health" effect while it lasts
    const rate = F.REGEN_PER_SECOND.health * maxHealth(s) * (s.stone === "lady" ? 1.25 : 1), from = s.healthTs || t;
    let gain = 0;
    for (const f of s.fx || []) if (f.key === "regen:health" && f.mag > 0) gain += Math.max(0, Math.min(t, f.until) - from) * rate * (1 + f.mag / 100);   // food, potions, shrines: only while they last
    const worn = (typeof ENCH !== "undefined" && s.loadouts ? ENCH.worn(s, "regen:health") : 0) + (typeof CURSE !== "undefined" ? CURSE.fx(s, "regen:health", t) : 0);
    if (worn > 0) gain += Math.max(0, t - from) * rate * (worn / 100);   // enchanted gear heals slowly
    return Math.min(maxHealth(s), s.health + gain);
  }
  function setHealth(s, hp, t = now()) { s.health = Math.max(0, Math.min(maxHealth(s), hp)); s.healthTs = t; }
  const skill = (s, name) => s.skills[name].lvl + fxSum(s, "skill:" + name) + (typeof LEGEND !== "undefined" ? LEGEND.bonus(s, name) : 0);   // potions add skill points [OURS simplification]; legendary stars add a little
  /* [OURS] fair levelling: foes scale with how strong you are in a fight, not just your level. Levelling by crafting,
     trading or sneaking raises your level but not your fighting, so foes follow your best attack and defence skills
     (never lower than 60% of your level), and stop growing at D.SCALE_LEVEL_CAP so legendary skills don't snowball. */
  const FIGHT_ATK = ["One-Handed", "Two-Handed", "Archery", "Spear", "Hand-to-Hand", "Destruction", "Conjuration"];
  const FIGHT_DEF = ["Heavy Armor", "Light Armor", "Medium Armor", "Unarmored", "Blocking", "Alteration", "Restoration"];
  function fightLevel(s) {
    if (!s || !s.skills) return s?.level || 1;
    const best = (l) => Math.max(15, ...l.filter((k) => s.skills[k]).map((k) => s.skills[k].lvl + (typeof LEGEND !== "undefined" ? LEGEND.bonus(s, k) : 0)));
    const combat = Math.round(((best(FIGHT_ATK) + best(FIGHT_DEF)) / 2 - 15) * 0.6) + 1;
    return Math.max(1, Math.min(s.level, D.SCALE_LEVEL_CAP ?? 60, Math.max(Math.round(s.level * 0.6), combat)));
  }

  function useSkill(s, name, baseXp) {
    const sk = s.skills[name];
    sk.xp += F.skillXpGained(name, baseXp) * (rested(s) && !s.werewolf ? 1 + (s.restBonus || 0.05) : 1) * (typeof POWERS !== "undefined" ? POWERS.xpMult(s, name) : 1) * (typeof HALLS !== "undefined" ? HALLS.xpMult(s, name) : 1);   // Rested; standing stones   // [Skyrim] Rested: skills improve 10% faster
    const msgs = [];
    while (sk.lvl < 100 && sk.xp >= F.skillXpNeeded(name, sk.lvl)) {
      sk.xp -= F.skillXpNeeded(name, sk.lvl);
      sk.lvl += 1;
      msgs.push(`${name} increased to ${sk.lvl}`);
      s.charXp += sk.lvl;
      while (s.charXp >= F.charXpNeeded(s.level)) {
        s.charXp -= F.charXpNeeded(s.level);
        s.level += 1;
        s.pendingLevels += 1;
        msgs.push(`You reached level ${s.level}! Choose health, magicka or stamina.`);
      }
    }
    return msgs;
  }
  function levelUp(s, attr) {
    if (s.pendingLevels <= 0) return "No level-up to spend.";
    const f = { health: "hpBonus", magicka: "mpBonus", stamina: "spBonus" }[attr];
    s[f] += F.ATTRIBUTE_PER_LEVEL;
    s.pendingLevels -= 1;
    if (attr === "health") s.health = Math.min(maxHealth(s), s.health + F.ATTRIBUTE_PER_LEVEL);
    return `+${F.ATTRIBUTE_PER_LEVEL} ${attr}` + (attr === "stamina" ? ` and +${F.CARRY_PER_STAMINA_LEVEL} carry weight` : "");
  }

  /* [OURS] chance to pick a lock of tier 0..4 (Novice..Master); [Skyrim] "<tier> Locks" perks make that tier much easier */
  function lockChance(s, tier) {
    const perk = ["novice_locks", "apprentice_locks", "adept_locks", "expert_locks", "master_locks"][tier];
    return Math.max(0.05, Math.min(0.97, 0.92 - tier * 0.17 + (skill(s, "Lockpicking") - 15) / 110 + (P(s, perk) ? 0.3 : 0) + (typeof PFX !== "undefined" ? PFX.num(s, "lock") : 0)));   // + Quick Hands
  }
  /* one pick attempt: the lockpicking mini-game can decide it (s._lockForce), else the old roll */
  function lockRoll(s, chance) {
    let ok;
    if (s && s._lockForce !== undefined) { ok = !!s._lockForce; delete s._lockForce; } else ok = Math.random() < chance;
    if (ok && s) { s.lt = s.lt || {}; s.lt.locks = (s.lt.locks || 0) + 1; }
    return ok;
  }
  let allyProvider = () => [];
  const setAllyProvider = (fn) => { allyProvider = fn; };

  // ---------------------------------------------------------------- inventory & gear
  function give(s, item, qty = 1, charge = null) {
    const it = D.ITEMS[item];
    if (STACKABLE.has(it.slot)) {
      const row = s.inv.find((r) => r.item === item);
      if (row) { row.qty += qty; return row.id; }
      s.inv.push({ id: s.nextInv, item, qty, charge: null });
      return s.nextInv++;
    }
    if (charge == null && it.enchant) charge = it.enchant.capacity;
    let last = null;
    for (let i = 0; i < qty; i++) { s.inv.push({ id: s.nextInv, item, qty: 1, charge }); last = s.nextInv++; }
    return last;
  }
  const invRow = (s, id) => s.inv.find((r) => r.id === id);
  function take(s, id, qty = 1) {
    const r = invRow(s, id);
    if (!r || r.qty < qty) return false;
    r.qty -= qty;
    if (r.qty <= 0) {
      s.inv = s.inv.filter((x) => x.id !== id);
      for (const lo of Object.values(s.loadouts))
        for (const k of Object.keys(lo.equipment)) if (lo.equipment[k] === id) delete lo.equipment[k];
    }
    return true;
  }
  function carried(s) {
    const worn = new Set(Object.values(lo(s).equipment));
    return s.inv.reduce((sum, r) => {
      const it = D.ITEMS[r.item]; let w = (it?.weight || 0) * r.qty;
      if (worn.has(r.id) && it.type && s.stone === "steed") w = 0;   // [Skyrim] Steed Stone
      if (worn.has(r.id) && it.type) {
        if ((it.type === "heavy" && P(s, "conditioning")) || (it.type === "light" && P(s, "unhindered"))) w = 0;   // [Skyrim]
        if (it.type === "medium" && P(s, "balanced_load")) w /= 2;
      }
      return sum + w;
    }, 0);
  }
  /* horses: riding gives speed; a horse that's with you (ridden or led) carries for you */
  const riding = (s) => (typeof HORSES !== "undefined" ? HORSES.riding(s) : !!s.horse);
  const withHorse = (s) => (typeof HORSES !== "undefined" ? HORSES.present(s) : !!s.horse);
  const capacity = (s) => F.BASE_CARRY + Math.floor(s.spBonus / F.ATTRIBUTE_PER_LEVEL) * F.CARRY_PER_STAMINA_LEVEL
    + (withHorse(s) ? (typeof HORSES !== "undefined" ? HORSES.carry(s) : D.HORSE_CARRY) : 0) + (P(s, "extra_pockets") ? 100 : 0) + fxSum(s, "carry") + (typeof PFX !== "undefined" ? PFX.num(s, "carry") : 0) + (s.stone === "steed" ? 100 : 0) + (s.follower ? 100 : 0)   // [OURS] a follower carries 100 for you
    + (typeof HALL !== "undefined" ? HALL.carryBonus() : 0)   // [OURS] Jarl's Keep tier of the shared hall
    + (typeof CARAVANS !== "undefined" ? CARAVANS.cartCarry(s) : 0);   // [OURS] a cart behind your horse
  const overweight = (s) => carried(s) > capacity(s);
  const lo = (s) => s.loadouts[s.loadout] || Object.values(s.loadouts)[0];
  function equipment(s) {
    const out = {};
    for (const [slot, id] of Object.entries(lo(s).equipment)) { const r = invRow(s, id); if (r) out[slot] = r; }
    return out;
  }
  function equip(s, id, hint) {
    const r = invRow(s, id);
    if (!r) return "You don't have that.";
    const it = D.ITEMS[r.item];
    if (!SLOTS.includes(it.slot)) return "That can't be equipped.";
    const eq = lo(s).equipment;
    const cur = equipment(s);
    let extra = "";
    if (it.slot === "weapon" && it.hands === 2 && eq.shield) { delete eq.shield; extra = " Shield taken off (two-handed weapon)."; }
    if (it.slot === "shield" && cur.weapon && D.ITEMS[cur.weapon.item].hands === 2) return "You can't use a shield with a two-handed weapon.";
    if (eq.offhand != null) {   // [OURS] dual wielding: a shield or a two-handed weapon frees the left hand; one sword can't be in both hands
      const offR = invRow(s, eq.offhand);
      if (it.slot === "shield" || (it.slot === "weapon" && it.hands === 2)) { delete eq.offhand; extra += " Left-hand weapon put away."; }
      else if (it.slot === "weapon" && offR && offR.id === id && (offR.qty || 1) < 2) { delete eq.offhand; }
    }
    if (it.slot === "ring") {   // two ring fingers: the free one, or the one you picked (hint), else swap the first
      const other = (k) => (k === "ring" ? "ring2" : "ring");
      const at = hint === "ring" || hint === "ring2" ? hint : eq.ring == null ? "ring" : eq.ring2 == null ? "ring2" : "ring";
      if (eq[other(at)] === id) delete eq[other(at)];   // one ring can't sit on two fingers
      eq[at] = id;
      return `Equipped ${it.name}.`;
    }
    eq[it.slot] = id;
    return `Equipped ${it.name}.${extra}`;
  }
  function unequip(s, slot) { delete lo(s).equipment[slot]; }
  /* which equipment slot a row is worn in (rings can be on either finger) */
  function wornSlot(s, id) { const eq = lo(s).equipment; return Object.keys(eq).find((k) => eq[k] === id) || null; }
  /* [OURS] dual wielding: a one-handed weapon in your left hand (no shield). Remigiusz: "Dual weilding should be possible." */
  const canOffhand = (it) => !!it && it.slot === "weapon" && it.hands !== 2 && it.skill === "One-Handed" && !it.staff;
  function equipOff(s, id) {
    const r = invRow(s, id);
    if (!r) return "You don't have that.";
    const it = D.ITEMS[r.item], eq = lo(s).equipment, cur = equipment(s);
    if (!canOffhand(it)) return "Only one-handed weapons fit in your left hand.";
    if (cur.weapon && D.ITEMS[cur.weapon.item].hands === 2) return "Your two-handed weapon needs both hands.";
    if (cur.weapon && cur.weapon.id === id && (r.qty || 1) < 2) return "You only have one of those. Hold another weapon in your right hand.";
    let extra = "";
    if (eq.shield != null) { delete eq.shield; extra = " Shield taken off."; }
    eq.offhand = id;
    return `Equipped ${it.name} in your left hand.${extra}`;
  }
  function equippedAnywhere(s) {
    const ids = new Set();
    for (const l of Object.values(s.loadouts)) for (const id of Object.values(l.equipment)) ids.add(id);
    return ids;
  }
  function countRestore(s, res) {
    return s.inv.filter((r) => D.ITEMS[r.item]?.restore?.[0] === res).reduce((a, r) => a + r.qty, 0);
  }
  function itemStats(item) {
    const it = D.ITEMS[item];
    if (it.slot === "weapon") return `${it.damage} dmg · ${it.skill}${it.hands === 2 ? " · 2 hands" : ""}${it.enchant ? ` · +${it.enchant.magnitude} ${typeof ENCH !== "undefined" && ENCH.short ? ENCH.short(it.enchant.effect) : it.enchant.effect}` : ""}`;
    if (ARMOR_SLOTS.includes(it.slot)) return `${it.armor} armor · ${it.type}${it.aenchant ? ` · ${it.aenchant.name}${it.aenchant.mag > 1 ? " " + it.aenchant.mag : ""}${it.aenchant.more?.length ? ` +${it.aenchant.more.length} more` : ""}` : ""}`;
    if (it.effects) return it.effects.map(([e, m, d]) => `${e} ${m}${d * 5 >= 60 ? ` · ${Math.round(d * 5 / 60)} min` : ""}`).join(", ");
    if (it.slot === "potion") return it.restore ? `+${it.restore[1]} ${it.restore[0]}` : it.cures ? "Cures diseases" : "";
    if (it.slot === "scroll" || it.slot === "tome") return D.SPELLS[it.spell].name;
    if (it.slot === "soulgem") return `${it.charge} charge`;
    if (it.slot === "ingredient") return "Ingredient";
    if (it.slot === "trophy") return it.dae || it.desc ? "Daedric artifact" : "Trophy";
    if (it.slot === "material") return "Crafting material";
    if (it.slot === "valuable") return "Valuable · sells well";
    if (it.slot === "ring" || it.slot === "amulet") return `${it.slot === "ring" ? "Ring" : "Amulet"}${it.aenchant ? ` · ${it.aenchant.name}${it.aenchant.mag > 1 ? " " + it.aenchant.mag : ""}${it.aenchant.more?.length ? ` +${it.aenchant.more.length} more` : ""}` : " · can be enchanted"}`;
    if (it.slot === "misc" && it.desc) return it.desc;
    if (it.slot === "ammo") return `${it.damage} damage · ${it.ammo === "bolt" ? "crossbow bolt" : "arrow"}`;
    if (it.shoots === "bolt") return `${it.damage} dmg · Archery · shoots bolts`;
    return "";
  }

  /* tactics: a rule that is always true and always affordable (plain attack) ends the list: nothing under it can fire.
     New rules go just above such a catch-all so they actually get used. */
  const catchAll = (r) => r && !r.off && r.if === "always" && r.do === "attack";
  function ruleSlot(rules) { const i = rules.findIndex(catchAll); return i < 0 ? rules.length : i; }
  function addRule(rules, r, max = D.MAX_RULES) {
    if (rules.length >= max) return false;
    rules.splice(ruleSlot(rules), 0, r); return true;
  }
  /* which rules can never fire, and why (shown in the Tactics tab) */
  function deadRules(rules) {
    const out = {}, stop = rules.findIndex(catchAll);
    if (stop >= 0) for (let i = stop + 1; i < rules.length; i++) if (!rules[i].off) out[i] = `Never used: rule ${stop + 1} (always attack) is above it.`;
    return out;
  }
  /* [OURS] fixing older saves: rules the player added used to land under "always → attack" and never fired */
  function fixTactics(s) {
    if (s.tacV >= 2) return false;
    let moved = false;
    for (const l of Object.values(s.loadouts || {})) {
      if (!Array.isArray(l.rules)) { l.rules = clone(D.PRESETS[D.DEFAULT_PRESET].rules); continue; }
      l.rules = l.rules.filter((r) => r && r.if && r.do);
      const i = l.rules.findIndex(catchAll);
      if (i >= 0 && i < l.rules.length - 1) { const [c] = l.rules.splice(i, 1); l.rules.push(c); moved = true; }
    }
    s.tacV = 2;
    return moved;
  }

  // loadouts
  function saveLoadoutAs(s, name) {
    if (!s.loadouts[name] && Object.keys(s.loadouts).length >= D.MAX_LOADOUTS) return `Max ${D.MAX_LOADOUTS} loadouts.`;
    s.loadouts[name] = clone(lo(s));
    s.loadout = name;
    return `Saved as ${name}.`;
  }
  function deleteLoadout(s, name) {
    if (Object.keys(s.loadouts).length <= 1) return "You need at least one loadout.";
    delete s.loadouts[name];
    if (s.loadout === name) s.loadout = Object.keys(s.loadouts)[0];
    return `Deleted ${name}.`;
  }

  // ---------------------------------------------------------------- combat
  function spellCost(s, sp) {
    if (sp?.parts && typeof SPELLCRAFT !== "undefined") return Math.max(1, Math.round(sp.parts.reduce((a, p) => a + (D.SPELLS[p] ? spellCost(s, D.SPELLS[p]) : 0), 0) * SPELLCRAFT.PREMIUM[sp.parts.length]));   // crafted: its parts, each at its own school
    const id = Object.keys(D.SPELLS).find((k) => D.SPELLS[k] === sp), tier = SPELL_TIER[id] || (sp.level || "").toLowerCase();
    const half = tier && P(s, `${tier}_${sp.school.toLowerCase()}`) ? 0.5 : 1;   // [Skyrim] "<tier> <school>" perks: half cost
    return Math.floor(F.spellCost(sp.cost, skill(s, sp.school)) * half * (typeof MAGIC !== "undefined" && id ? MAGIC.costMult(s, id) : 1) * (1 - Math.min(0.5, fxSum(s, "cost:" + sp.school) / 100)) * (1 - (typeof PFX !== "undefined" ? Math.min(0.4, PFX.sum(s, "scost", null, { school: sp.school })) : 0)));   // Atromancy, Mystic Focus   // dragon priest masks   // spells above your level cost more
  }
  /* ---- pure spell numbers: what one cast does for this character before the foe's own weaknesses and resistances.
     Fight.cast uses these, and the Magic menu shows them, so the menu always matches the fight. */
  const PX = (s, key, f, x) => (typeof PFX !== "undefined" ? PFX.sum(s, key, f, x || {}) : 0);
  function spellDamage(s, sp) {
    const aug = { fire: P(s, "augmented_flames"), frost: P(s, "augmented_frost"), shock: P(s, "augmented_shock") }[sp.element] || 0;
    return sp.amount * (1 + 0.25 * aug) * (1 + fxSum(s, "spell:" + sp.school) / 100);
  }
  const spellHeal = (s, sp) => sp.amount * (P(s, "regeneration") ? 1.5 : 1) * (1 + fxSum(s, "spell:Restoration") / 100);
  /* armor spells: Mage Armor needs no worn armor; armorWorn = the pieces you wear (item defs) */
  function spellArmor(s, sp, armorWorn, f) {
    const bare = !armorWorn.some((a) => a && ARMOR_SKILL[a.type]);
    return sp.amount * (bare && P(s, "mage_armor") ? [1, 2, 2.5, 3][P(s, "mage_armor")] : 1) * (1 + PX(s, "armorspell", f));   // [Skyrim] Mage Armor, Stability
  }
  /* what a summon spell calls up, in words: "Conjure Flame Atronach" -> "flame atronach" */
  const SUMMON_NAMES = { conjure_familiar: "spectral wolf", flaming_familiar: "flaming familiar", spectral_archer: "spectral archer", seeker: "seeker" };
  const summonName = (id, sp) => SUMMON_NAMES[String(id || "").replace(/_dual$/, "")] || String(sp?.name || "summon").replace(/\s*\(dual\)$/, "").replace(/^(conjure|summon|call|raise)\s+/i, "").toLowerCase();
  const spellSummon = (s, sp, f) => ({
    turns: sp.turns + 2 * P(s, "summoner") + PX(s, "summonturns", f),
    dmg: sp.amount * (P(s, "elemental_potency") ? 1.5 : 1) * (P(s, "twin_souls") ? 2 : 1) * (1 + PX(s, "summon", f)),   // Necromancy, Dark Souls
    count: P(s, "twin_souls") ? 2 : 1,
  });
  /* calm: the highest foe level it works on (beasts and people get more with Animage / Kindred Mage) */
  const spellCalm = (s, sp, tags, f) => ({
    cap: sp.max_level + (tags?.has("beast") && P(s, "animage") ? 8 : 0) + (tags?.has("humanoid") && P(s, "kindred_mage") ? 8 : 0) + PX(s, "calm", f),
    turns: sp.turns + PX(s, "calmturns", f),   // Hypnotic Gaze
  });
  /* dual casting: magicka for both hands (Dual Casting perks cut it) */
  const dualCost = (s, sp, f) => spellCost(s, sp) * (typeof MAGIC !== "undefined" ? MAGIC.DUAL_COST : 2.8) * (1 - Math.min(0.5, PX(s, "dualcost", f, { school: sp.school })));
  const enchantCost = (e, s) => F.enchantCost(e.base_cost, e.magnitude, e.max_magnitude, skill(s, "Enchanting")) * (1 - 0.1 * P(s, "enchanter"));
  function describeAction(a) {
    if (D.BASIC_ACTIONS[a]) return D.BASIC_ACTIONS[a];
    const [kind, arg] = a.split(":");
    if (kind === "spell") return `Cast ${D.SPELLS[arg]?.name || arg}`;
    if (kind === "dual") return `Dual-cast ${D.SPELLS[arg]?.name || arg}`;
    if (kind === "potion") return `Drink a ${arg} potion`;
    if (kind === "scroll") return `Read ${D.ITEMS[arg]?.name || arg}`;
    if ((kind === "power" || kind === "shout") && typeof POWERS !== "undefined") return POWERS.describe(a);
    return a;
  }
  function describeRule(r) {
    if (r && (r.conds?.length || r.not) && typeof AISET !== "undefined") return AISET.describe(r);   // AND / OR / NOT rules
    const [label, kind] = D.CONDITIONS[r.if] || [r.if, false];
    return { cond: kind === "turn" ? `${label} ${r.pct || 2}` : kind ? `${label} ${r.pct}%` : label, act: describeAction(r.do) };
  }
  function hiddenChance(s, e, t) {   // [OURS] Skyrim detection is real-time line of sight; this is our stand-in
    const sm = typeof SNEAKMODE !== "undefined" ? SNEAKMODE.hideAdd(s) : 0;   // sneaking on the road: they find you, but you saw them first
    if (typeof SNEAK2 !== "undefined") return Math.min(0.95, SNEAK2.chance(s, e, t) + sm);   // sneak2.js: armor, daylight and the foe's awareness count
    const base = 0.25 + skill(s, "Sneak") / 150 - (e.danger === "high" ? 0.15 : 0) + (isNight(t) ? 0.1 : 0) + 0.15 * P(s, "detect_life") + fxSum(s, "hide", t || now()) / 100 + (typeof PFX !== "undefined" ? Math.min(25, PFX.num(s, "hide")) / 100 : 0)
      + (typeof WEVENTS !== "undefined" ? WEVENTS.weather([s.x, s.y], t || now()).sneak : 0) + (typeof WFX !== "undefined" ? WFX.sneakAdd(s, t || now()) : 0);   // rain, fog and snow hide you; clear nights too
    const seen = (1 - base - sm) * (1 - 0.12 * P(s, "stealth"));   // [Skyrim] Stealth: 20% harder to detect per rank (our scale)
    return Math.max(0.05, Math.min(0.92, 1 - seen));
  }

  class Fight {
    constructor(s, enemy, rules, t = now()) {
      this.s = s; this.e = enemy; this.rules = rules || lo(s).rules; this.t = t;
      { const L = Object.values(s.loadouts || {}).find((l) => l && l.rules === this.rules) || (s.loadouts ? lo(s) : null);   // [OURS] Smart AI unless this loadout is set to Custom tactics
        this.ai = typeof COMBATAI !== "undefined" && !!L && COMBATAI.isSmart(L); this.L = L; this.hybrid = !!L && L.mode === "hybrid"; }
      this.eq = equipment(s);
      this.hp = curHealth(s, t); this.mp = maxMagicka(s); this.sp = maxStamina(s);
      this.ehp = enemy.hp ?? enemy.health;
      this.wx = typeof WFX !== "undefined" ? WFX.fight(s, t) : null;   // [OURS] weather that matters (weatherfx.js)
      if (this.wx && this.wx.stam < 1) this.sp = Math.round(this.sp * this.wx.stam);
      this.hp0 = this.hp; this.ehp0 = this.ehp;   // start health, for the fight scene's health bars
      this.tags = new Set(enemy.tags || []);
      this.fp = typeof FOEPERKS !== "undefined" ? FOEPERKS.build(enemy) : null;   // [OURS] humanoid foes have perks too (foeperks.js)
      this.fpLine = this.fp ? FOEPERKS.label(enemy) : "";
      this.armorSpell = 0; this.summonTurns = 0; this.summonDmg = 0; this.calmTurns = 0;
      this.slowed = 0; this.stagger = false; this.blocking = false; this.turn = 0; this.hidden = false;
      this.log = []; this.xp = {}; this.used = {}; this.charges = {};
      const w = this.eq.weapon;
      this.weapon = w ? D.ITEMS[w.item] : null; this.weaponInv = w ? w.id : null;
      this.armor = {};
      for (const sl of ARMOR_SLOTS) if (this.eq[sl]) this.armor[sl] = D.ITEMS[this.eq[sl].item];
      this.shield = this.armor.shield || null;
      const oh = this.eq.offhand;   // [OURS] dual wielding: the left-hand weapon (dualwield in the attack below)
      this.off = oh && !this.shield && this.weapon && this.weapon.hands !== 2 && canOffhand(D.ITEMS[oh.item]) ? D.ITEMS[oh.item] : null; this.offTemper = oh?.temper || 0;
      const regen = Object.values(this.armor).reduce((a, x) => a + (x.magicka_regen || 0), 0);
      this.regenMp = maxMagicka(s) * F.REGEN_PER_SECOND.magicka * (1 + regen) * (1 + 0.25 * P(s, "recovery") + (typeof PFX !== "undefined" ? PFX.sum(s, "regenmp", this, {}) : 0)) * (1 + fxSum(s, "regen:magicka") / 100)
        * (s.stone === "atronach" ? 0.5 : s.stone === "apprentice" ? 2 : 1);
      const lightWorn = Object.values(this.armor).some((a) => a.type === "light");
      this.regenSp = maxStamina(s) * F.REGEN_PER_SECOND.stamina * (1 + (lightWorn && P(s, "wind_walker") ? 0.5 : 0) + 0.25 * P(s, "second_wind") + (typeof PFX !== "undefined" ? PFX.sum(s, "regensp", this, {}) : 0)) * (1 + fxSum(s, "regen:stamina") / 100) * (s.stone === "lady" ? 1.25 : 1);
      this.wt = wtype(w?.item); this.wt0 = this.wt;   // wt0: the weapon you came with (bound weapons change wt), for the fight scene
      const sk0 = this.weapon?.skill;
      this.paCost = F.powerAttackCost(this.weapon ? this.weapon.weight : 0)
        * ((sk0 === "One-Handed" && P(s, "fighting_stance")) || (sk0 === "Two-Handed" && P(s, "champions_stance")) ? 0.75 : 1)
        * Math.max(0.3, 1 + (typeof PFX !== "undefined" ? PFX.sum(s, "pa", this, { sk: sk0 || "Hand-to-Hand", wt: this.wt }) : 0));   // Ranger, Brawler, Endurance
      if (this.off) this.paCost *= 1.5 * Math.max(0.4, 1 - (typeof PFX !== "undefined" ? PFX.num(s, "dualpa") : 0));   // [Skyrim] dual power attacks swing both blades and cost more
      this.temper = w?.temper || 0;
      this.allies = allyProvider(s) || [];   // party members fighting beside you: [{name, dmg}]
      if (s.follower && typeof TOWNS !== "undefined") {   // your follower fights too, and can fall
        const fd = TOWNS.FOLLOWERS[s.follower.id];
        const fa = typeof FOL2 !== "undefined" ? FOL2.ally(s, TOWNS.followerHp(s, t)) : null;   // their own gear, level and perks
        if (fa && fd[6] && !fa.kind) fa.kind = fd[6];
        this.allies.push(fa || { name: fd[0], dmg: fd[4] * 0.55 * (1 + 0.05 * (s.level - 1)), hp: TOWNS.followerHp(s, t), follower: true, fid: s.follower.id, kind: fd[6] || "follower" });   // [OURS] 55% of their listed damage
      }
      if (s.thrall && s.thrall.fights > 0) { this.allies.push({ name: s.thrall.name, dmg: s.thrall.dmg, thrall: true, kind: "zombie" }); this.thrallFought = true; }   // a raised corpse fights for you
      this.pw = typeof POWERS !== "undefined" ? POWERS.fightState() : null;
      if (typeof PFX !== "undefined") { const ab = Math.min(0.5, PFX.sum(s, "allies", null, {})); if (ab) for (const al of this.allies) if (al.dmg) al.dmg *= 1 + ab; }   // Inspiring, Rally, Thane's Guard
      this.foeSt = {}; this.meSt = {}; this.bashed = false; this.avoidUsed = false; this.riposte = false;
      this.bleed = []; this.eParalyzed = 0; this.flurry = 0; this.firstHit = true; this.shadowUsed = false; this.sneakNext = false;
    }
    addXp(k, v) { this.xp[k] = (this.xp[k] || 0) + v; }
    weaponSkill() { return this.bound ? this.bound.skill : this.weapon ? this.weapon.skill : "Hand-to-Hand"; }
    weaponDamage() {
      const s = this.s;
      if (this.bound && (!this.weapon || this.weapon.staff || this.bound.dmg >= this.weapon.damage + this.temper)) return F.weaponDamage(this.bound.dmg, skill(s, this.bound.skill), this.bound.skill === "Archery");   // [Skyrim] bound weapons
      if (!this.weapon) { const [a, b] = F.unarmedRange(skill(s, "Hand-to-Hand"), s.race); return rnd(a, b) + 4 * P(s, "iron_fists") + (typeof PFX !== "undefined" && PFX.has(s, "fists", this, {}) && this.armor.hands?.type === "heavy" ? Math.round((this.armor.hands.armor || 0) / 3) : 0); }
      const sk = this.weapon.skill;
      const perk = { "One-Handed": 0.2 * P(s, "armsman"), "Two-Handed": 0.2 * P(s, "barbarian"), "Archery": 0.2 * P(s, "overdraw"), "Spear": 0.15 * P(s, "long_reach") }[sk] || 0;
      let base = this.weapon.damage + this.temper;
      const ak = this.ammoKind();
      if (ak) {   // [Skyrim] the arrow's damage adds to the bow's; the formula already counts an iron arrow
        const am = this.shotAmmo !== undefined ? this.shotAmmo : this.ammoRow();
        if (!am) return Math.max(1, F.weaponDamage(base * 0.3, skill(s, sk), false));   // no ammo: a weak bash with the bow
        base += D.ITEMS[am.item].damage - F.IRON_ARROW_DAMAGE;
        if (ak === "bolt") base *= 0.75;   // [OURS] crossbows reload slowly; fights here are one attack a turn
      }
      return F.weaponDamage(base, skill(s, sk), sk === "Archery") * (1 + perk) * (1 + fxSum(s, "dmg:" + sk) / 100);
    }
    ammoKind() { return typeof AMMO !== "undefined" ? AMMO.kindFor(this.weapon, this.eq.weapon?.item) : null; }
    ammoRow() { const k = this.ammoKind(); return k ? AMMO.best(this.s, k, (r) => this.left(r.id)) : null; }
    shoot() {   // take one arrow/bolt for this shot (some are picked up again afterwards)
      const r = this.ammoRow(); this.shotAmmo = r;
      if (r && Math.random() > AMMO.RECOVER * (1 + (typeof PFX !== "undefined" ? PFX.num(this.s, "ammo") : 0))) this.used[r.id] = (this.used[r.id] || 0) + 1;
      return r;
    }
    critChance() {   // [Skyrim] crits only come from perks; crit damage = half the weapon's base damage, perks add 25/50/75%
      const s = this.s, wt = this.wt;
      const r = wt === "sword" || wt === "dagger" ? P(s, "bladesman") : wt === "greatsword" ? P(s, "deep_wounds") : wt === "bow" ? P(s, "critical_shot") : 0;
      const ex = typeof PFX !== "undefined" ? Math.min(0.15, PFX.sum(s, "crit", this, {})) : 0;   // Fortify Critical rings and gauntlets
      if (r) return [[0, 0.1, 0.15, 0.2][r] + ex, 0.5 * (1 + 0.25 * r)];
      if (wt === "spear" && P(s, "impale")) return [0.15 + ex, 0.5];
      return ex ? [ex, 0.5] : [0, 0];
    }
    armorRating() {
      const s = this.s;
      let rating = this.armorSpell + (s.stone === "lord" ? 50 : 0), pieces = 0;   // [Skyrim] Lord Stone
      const perkMult = { heavy: 0.2 * P(s, "juggernaut"), light: 0.2 * P(s, "agile_defender"), medium: 0.2 * P(s, "chain_drills") };
      const counts = {};
      for (const [sl, a] of Object.entries(this.armor)) {
        const sk = ARMOR_SKILL[a.type];
        if (!sk) continue;
        const temper = this.eq[sl]?.temper || 0;
        rating += F.armorPieceRating(a.armor + temper, skill(s, sk)) * (1 + (sl === "shield" ? 0 : perkMult[a.type] || 0)); pieces++;
        if (sl !== "shield") counts[a.type] = (counts[a.type] || 0) + 1;
      }
      const set = { heavy: "well_fitted", light: "custom_fit", medium: "layered" };   // [Skyrim] +25% for a matching set of 4
      for (const [ty, perk] of Object.entries(set)) if (counts[ty] === 4 && P(s, perk)) rating *= 1.25;
      const empty = ARMOR_SLOTS.filter((sl) => !this.armor[sl] || this.armor[sl].type === "cloth").length;
      rating += F.unarmoredRating(skill(s, "Unarmored"), empty) * (1 + 0.25 * P(s, "monks_grace"));
      if (typeof PFX !== "undefined") rating = (rating + PFX.sum(s, "armor", this, {})) * (1 + PFX.sum(s, "armorpct", this, {}));   // Iron Skin; Dragon Armor
      return { rating, pieces, empty };
    }
    pct(c, m) { return 100 * c / Math.max(1, m); }
    left(id) { return (this.s.inv.find((r) => r.id === id)?.qty || 0) - (this.used[id] || 0); }
    findPotion(res) {
      let best = null;
      for (const r of this.s.inv) {
        const it = D.ITEMS[r.item];
        if (it?.restore?.[0] === res && this.left(r.id) > 0 && (!best || it.restore[1] > D.ITEMS[best.item].restore[1])) best = r;
      }
      return best;
    }
    findItem(item) { return this.s.inv.find((r) => r.item === item && this.left(r.id) > 0) || null; }
    cond(r) {   // a rule's IF: one condition, or several joined with AND / OR (each can be NOT)
      if (r && Array.isArray(r.conds) && r.conds.length) {
        const vals = r.conds.map((c) => !!this.cond1(c) !== !!c.not);
        return r.join === "or" ? vals.some(Boolean) : vals.every(Boolean);
      }
      return !!this.cond1(r) !== !!(r && r.not);
    }
    cond1(r) {
      const s = this.s, p = r.pct || 0;
      switch (r.if) {
        case "always": return true;
        case "hp_below": return this.pct(this.hp, maxHealth(s)) < p;
        case "hp_above": return this.pct(this.hp, maxHealth(s)) > p;
        case "mp_above": return this.pct(this.mp, maxMagicka(s)) > p;
        case "mp_below": return this.pct(this.mp, maxMagicka(s)) < p;
        case "sp_above": return this.pct(this.sp, maxStamina(s)) > p;
        case "sp_below": return this.pct(this.sp, maxStamina(s)) < p;
        case "enemy_hp_below": return this.pct(this.ehp, this.e.health) < p;
        case "enemy_hp_above": return this.pct(this.ehp, this.e.health) > p;
        case "first_turn": return this.turn === 1;
        case "enemy_undead": return this.tags.has("undead");
        case "enemy_beast": return this.tags.has("beast");
        case "enemy_humanoid": return this.tags.has("humanoid");
        case "enemy_big": return this.tags.has("big");
        case "no_summon": return this.summonTurns === 0;
        case "summon_active": return this.summonTurns > 0;
        case "no_armor_spell": return this.armorSpell === 0;
        case "turn_at_least": return this.turn >= (r.pct || 2);
        case "hp_lower_than_enemy": return this.pct(this.hp, maxHealth(s)) < this.pct(this.ehp, this.e.health);
        case "enemy_dragon": return this.tags.has("dragon");
        case "enemy_construct": return this.tags.has("construct");
        case "enemy_tough": return this.tags.has("elite") || this.e.danger === "high";
        case "enemy_boss": return !!this.e.boss;
        case "sneak_ready": return (this.turn === 1 && this.hidden) || this.sneakNext;
        case "follower_down": return !!this.followerDown;
        case "follower_fighting": return this.allies.some((a) => a.follower);
        case "mounted": return !!this.mount?.up;
        case "ally_hp_below": case "ally_down": return typeof SPELLBOOK !== "undefined" ? !!SPELLBOOK.condAlly(this, r) : false;   // support spells (spellbook.js)
      }
      if (typeof AISET !== "undefined" && AISET.NEWCOND[r.if]) return AISET.cond(this, r);   // the newer conditions (aiset.js)
      return false;
    }
    affordable(a) {
      if (a === "attack") return true;
      if (a === "flee") return !!this.canFlee && !this.e.boss;   // only on the road, never from a boss
      if (a === "power_attack") return this.sp >= this.paCost;
      if (a === "block") return this.sp >= F.BLOCK_STAMINA && !(this.weapon && this.weapon.skill === "Archery");
      const [kind, arg] = a.split(":");
      if ((kind === "power" || kind === "shout") && this.pw) return POWERS.affordable(this, kind, arg);
      if (kind === "spell") return this.s.spells.includes(arg) && D.SPELLS[arg] && this.mp >= spellCost(this.s, D.SPELLS[arg]);
      if (kind === "dual") return this.s.spells.includes(arg) && D.SPELLS[arg] && typeof MAGIC !== "undefined" && MAGIC.dualable(D.SPELLS[arg]) && this.mp >= spellCost(this.s, D.SPELLS[arg]) * MAGIC.DUAL_COST;
      if (kind === "potion") return !!this.findPotion(arg) && !(typeof CURSE !== "undefined" && CURSE.noPotions(this));   // no potions in Beast Form
      if (kind === "scroll") return !!this.findItem(arg);
      return false;
    }
    choose() {
      if (this.ai && this.hybrid) {   // Hybrid: your rules first (the plain "always → attack" filler doesn't count), Smart AI fills the gaps
        for (let i = 0; i < this.rules.length; i++) {
          const r = this.rules[i];
          if (!r || r.off || catchAll(r) || (this.healSkip && this.healSkip[i + 1] >= this.turn)) continue;
          if (this.cond(r) && this.affordable(r.do)) { this.aiWhy = ""; return [i + 1, r.do]; }
        }
      }
      if (this.ai) { const [a, why] = COMBATAI.choose(this); this.aiWhy = why; return [0, a]; }   // [OURS] combatai.js
      for (let i = 0; i < this.rules.length; i++) {
        const r = this.rules[i];
        if (this.healSkip && this.healSkip[i + 1] >= this.turn) continue;   // a heal that wasn't keeping up sits out a couple of turns
        if (r && !r.off && this.cond(r) && this.affordable(r.do)) return [i + 1, r.do];
      }
      return [0, "attack"];
    }
    /* [OURS] heal-loop guard: a "health below X → heal" rule that fires twice running without lifting you over X
       would otherwise heal forever while the enemy wins. It sits out the next 2 turns and you fight instead. */
    isHealRule(r) {
      if (!r || r.if !== "hp_below" || !r.do) return false;
      const [k, arg] = r.do.split(":");
      if (k === "potion") return arg === "health";
      const sp = D.SPELLS[k === "scroll" ? D.ITEMS[arg]?.spell : arg];
      return (k === "spell" || k === "dual" || k === "scroll") && !!sp && (sp.kind === "heal" || sp.kind === "regen");
    }
    healGuard(ruleNo) {
      const r = ruleNo ? this.rules[ruleNo - 1] : null;
      if (!this.isHealRule(r) || !this.cond(r)) { this.healRun = null; return ""; }
      this.healRun = this.healRun && this.healRun.rule === ruleNo ? { rule: ruleNo, n: this.healRun.n + 1 } : { rule: ruleNo, n: 1 };
      if (this.healRun.n < 2) return "";
      this.healRun = null; (this.healSkip = this.healSkip || {})[ruleNo] = this.turn + 2;
      return "Healing isn't keeping up — you press the attack";
    }
    attack(power) {
      if (this.weapon?.staff && !this.bound && typeof MAGIC !== "undefined") { if (power) this.sp -= this.paCost; return MAGIC.staffAttack(this); }   // a staff casts instead of swinging
      const sk = this.weaponSkill();
      if (power) this.sp -= this.paCost;
      const ammoK = this.bound ? null : this.ammoKind(), shot = ammoK ? this.shoot() : null;
      const sneak = (this.turn === 1 && this.hidden) || this.sneakNext;
      this.sneakNext = false;
      const mt = this.mount && typeof HORSEBACK !== "undefined" ? HORSEBACK.strike(this, power, sneak) : null;   // [OURS] fighting from the saddle (horseback.js)
      const px = { power, sneak, sk, wt: this.wt };   // [OURS] for the bigger perk trees (perkfx.js)
      const aimW = ammoK && this.wx ? 1 - (1 - this.wx.aim) * (typeof PFX !== "undefined" && PFX.has(this.s, "aimwx", this, px) ? 0.5 : 1) : 1;
      const sure = typeof PFX !== "undefined" && PFX.has(this.s, "sure", this, px);
      if (!sneak && !mt?.sure && !sure && Math.random() > Math.min(0.98, (F.HIT_CHANCE + (typeof PFX !== "undefined" ? PFX.sum(this.s, "hit", this, px) : 0)) * aimW)) return power ? "Power attack misses" : "Attack misses";
      const s = this.s, wt = this.wt;
      let dmg = this.weaponDamage() * rnd(...F.DAMAGE_SPREAD) * (power ? F.POWER_ATTACK_DAMAGE : 1);
      if (power && ((sk === "One-Handed" && P(s, "savage_strike")) || (sk === "Two-Handed" && P(s, "devastating_blow")))) dmg *= 1.25;
      let label = power ? "Power attack" : "Attack";
      if (ammoK && !shot) label = `Bashes with the bow (no ${AMMO.label(ammoK)})`;
      if (sneak) {
        const sx = typeof PFX !== "undefined" ? PFX.sum(s, "sneakx", this, px) : 0;
        const m = wt === "dagger" && P(s, "assassins_blade") ? 15 : sk === "One-Handed" && P(s, "backstab") ? 6 : sk === "Archery" && P(s, "deadly_aim") ? 3 : sx ? Math.max(sx, F.sneakMultiplier(sk)) : F.sneakMultiplier(sk);   // [Skyrim]
        dmg *= m; this.addXp("Sneak", 30); label = `Sneak attack ×${m}`;
      }
      if (mt) { dmg *= mt.mult; if (mt.label && !sneak) label = mt.label; }
      const [cc, cm] = this.critChance();
      if (cc && Math.random() < cc) { dmg += (this.weapon ? this.weapon.damage : 0) * cm + (wt === "spear" ? dmg * 0.5 : 0); label += " (critical)"; }
      if (wt === "spear" && this.firstHit && P(s, "long_reach")) dmg *= 1.5;
      if (this.pw) dmg *= POWERS.dmgOut(this);
      if (typeof PFX !== "undefined") { dmg *= PFX.out(this, px); if (this.riposte) { dmg *= 1.5; label += " (riposte)"; } }   // new perks: first strikes, dual savagery, sneak, saddle...
      this.firstHit = false;
      if (wt === "fist") { if (P(s, "flurry")) { dmg *= 1 + Math.min(0.5, 0.1 * this.flurry); this.flurry++; } }
      // enemy armor (other players): maces and warhammers ignore some of it
      if (this.e.red) {
        const ignore = Math.min(0.9, (wt === "mace" ? 0.25 * P(s, "bone_breaker") : wt === "warhammer" ? 0.25 * P(s, "skullcrusher") : 0) + (typeof PFX !== "undefined" ? PFX.sum(s, "pierce", this, px) : 0));
        dmg *= 1 - this.e.red * (1 - ignore);
      }
      const bleedR = wt === "axe" ? P(s, "hack_and_slash") : wt === "battleaxe" ? P(s, "limbsplitter") : 0;
      if (bleedR) this.bleed.push({ dmg: 2 + bleedR, turns: 3 });
      this.addXp(sk, this.weapon ? this.weapon.damage : dmg);
      if (this.weapon?.enchant) {
        const en = this.weapon.enchant;
        const row = this.s.inv.find((r) => r.id === this.weaponInv);
        const charge = this.charges[this.weaponInv] ?? row.charge ?? 0;
        const cost = enchantCost(en, this.s);
        if (charge >= cost) {
          this.charges[this.weaponInv] = charge - cost;
          if (en.effect === "frost") this.slowed = 2;
          const em = en.magnitude * (1 + (typeof PFX !== "undefined" ? PFX.sum(s, "enchhit", this, px) : 0));   // Deep Charge
          const oh = typeof ENCH !== "undefined" && ENCH.onHit ? ENCH.onHit(this, en, em, { label, dmg }) : { dmg: em, label: ` +${en.effect}` };   // absorb, paralyze, fear, bleed... (enchanting.js)
          dmg += oh.dmg;
          label += oh.label;
          if (typeof PFX !== "undefined" && ["fire", "frost", "shock"].includes(en.effect)) this.pendingEl = [en.effect, em, "weapon"];   // burning / chill / jolt after the hit lands
        }
      }
      if (power && Math.random() < F.STAGGER_CHANCE) { this.stagger = true; label += ", staggers"; }
      if (power && wt === "fist" && P(s, "knockout") && Math.random() < 0.4) { this.stagger = true; label += ", knocks them down"; }
      if (power && ((sk === "One-Handed" && P(s, "paralyzing_strike")) || (sk === "Two-Handed" && P(s, "warmaster"))) && Math.random() < 0.25) { this.eParalyzed = 2; label += ", paralyzes"; }
      if (wt === "bow") {
        if (P(s, "power_shot") && Math.random() < 0.5) { this.stagger = true; if (!label.includes("stagger")) label += ", staggers"; }
        if (P(s, "bullseye") && Math.random() < 0.15) { this.eParalyzed = 2; label += ", paralyzes"; }
      }
      if (s.poison && this.ehp - dmg > 0) {   // a coated weapon delivers its poison on a hit
        for (const [e, m, d] of s.poison.effects) {
          const pm = 1 + (typeof PFX !== "undefined" ? PFX.num(s, "poison") : 0);   // Poisoned
          if (e === "Damage Health") dmg += m * pm;
          if (e === "Ravage Health") dmg += m * 2 * pm;
          if (e === "Lingering Damage Health") this.bleed.push({ dmg: m, turns: Math.max(1, Math.round(d / 2)) });
          if (e === "Paralysis") this.eParalyzed = 2;
          if (e === "Slow") this.slowed = 3;
        }
        label += ` · ${s.poison.name}`;
        if (--s.poison.hits <= 0) s.poison = null;
      }
      if (this.weapon?.dae && typeof DAEDRIC !== "undefined") { const dr = DAEDRIC.onHit(this, dmg); dmg = dr.dmg; label += dr.label; }   // Daedric artifacts
      if (this.fp) {   // the foe's own perks: dodging, blocking, armor
        const fp = this.fp;
        if (fp.dodge && Math.random() < fp.dodge) return `${label}: ${this.e.name} dodges`;
        if ((wt === "bow" || wt === "crossbow") && fp.arrows && fp.block) { dmg *= 1 - fp.arrows; label += " (deflected)"; }
        else if (fp.block && Math.random() < fp.block) { dmg *= 0.5; label += " (blocked)"; }
        dmg *= fp.taken;
        if (fp.reflect && Math.random() < fp.reflect) { const rb = dmg * 0.5; this.hp -= rb; label += ` · ${this.e.name} turns it back on you (${Math.round(rb)})`; }
      }
      if (sneak && typeof SNEAK2 !== "undefined") { const c = SNEAK2.cap(this); if (c && dmg > c) { dmg = c; label += " (it reels, but stands)"; } }   // no one-shots on strong foes
      this.ehp -= dmg;
      if (typeof PFX !== "undefined") {
        label += PFX.onHit(this, px, dmg);
        if (this.pendingEl) { const [el, a, src] = this.pendingEl; this.pendingEl = null; label += PFX.hitFoe(this, el, a, src); }
      }
      let offTxt = "";
      if (this.off && this.ehp > 0 && !ammoK && !this.bound) {   // [OURS] dual wielding: your left hand follows up (about a fifth of a blow, more on a power attack; tuned with test_dual)
        let d2 = F.weaponDamage(this.off.damage + this.offTemper, skill(s, "One-Handed"), false) * rnd(...F.DAMAGE_SPREAD) * (power ? 0.42 : 0.22)
          * (1 + 0.2 * P(s, "armsman")) * (1 + (typeof PFX !== "undefined" ? PFX.num(s, "offhand") : 0)) * (1 + fxSum(s, "dmg:One-Handed") / 100);
        if (this.e.red) d2 *= 1 - this.e.red;
        if (this.fp) d2 *= this.fp.taken;
        if (this.pw) d2 *= POWERS.dmgOut(this);
        this.ehp -= d2; this.addXp("One-Handed", this.off.damage * 0.5); offTxt = ` · left hand ${Math.round(d2)}`;
      }
      if (wt === "bow" && P(s, "quick_shot") && Math.random() < 0.3 && this.ehp > 0) {   // a second arrow
        if (this.ammoKind() && !this.shoot()) return `${label}: ${Math.round(dmg)}`;
        const d2 = this.weaponDamage() * rnd(...F.DAMAGE_SPREAD); this.ehp -= d2; return `${label}: ${Math.round(dmg)} · second arrow ${Math.round(d2)}`;
      }
      return `${label}: ${Math.round(dmg)}${offTxt}`;
    }
    cast(id, free, dual) {
      let sp = D.SPELLS[id];
      const mg = typeof MAGIC !== "undefined";
      if (!free) this.mp -= dual && mg ? dualCost(this.s, sp, this) : spellCost(this.s, sp);
      if (dual && mg) sp = { ...sp, amount: (sp.amount || 0) * MAGIC.DUAL_POWER, name: `${sp.name} (dual)` };   // [Skyrim] dual casting
      const s = this.s;
      if (!free && mg && Math.random() < MAGIC.failChance(s, id)) { this.addXp(sp.school, sp.xp * 0.25); return `${sp.name} fizzles (too advanced for you yet)`; }
      if (mg && MAGIC.KINDS[sp.kind]) { this.addXp(sp.school, sp.xp); return MAGIC.KINDS[sp.kind](this, sp, id); }
      if (sp.kind === "damage") {
        this.addXp(sp.school, sp.xp);
        if (Math.random() > F.SPELL_HIT_CHANCE) return `${sp.name} misses`;
        if (sp.element === "sun" && !this.tags.has("undead")) return `${sp.name}: no effect (undead only)`;
        if (sp.element === "frost") this.slowed = 2;
        let amt = spellDamage(s, sp) * (this.tags.has("undead") && P(s, "necromage") ? 1.25 : 1) * (mg && sp.element !== "sun" ? MAGIC.elem(this, sp.element) : 1) * (this.wx ? this.wx.el[sp.element] || 1 : 1);   // weaknesses and resistances; rain dulls fire, storms feed shock
        const stormHit = typeof WFX !== "undefined" && WFX.stormStrike(this, sp.element); if (stormHit) amt *= 1.5;
        let label = sp.name + (stormHit ? " ⚡ (the storm answers)" : "");
        if (this.turn === 1 && this.hidden && P(s, "quiet_casting")) { amt *= 2; label += " (sneak ×2)"; }
        if (sp.school === "Destruction" && P(s, "impact") && Math.random() < 0.3) { this.stagger = true; label += ", staggers"; }
        if (this.fp && this.fp.ward) { amt *= 1 - this.fp.ward; label += ` (${this.e.name}'s ward soaks ${Math.round(this.fp.ward * 100)}%)`; }   // Ward Absorb, Magic Resistance, Atronach
        this.ehp -= amt;
        if (typeof PFX !== "undefined") label += PFX.hitFoe(this, sp.element, amt, "spell");   // fire burns, frost chills, shock jolts
        return `${label}: ${Math.round(amt)}`;
      }
      if (sp.kind === "heal") {
        const before = this.hp;
        const amt = spellHeal(s, sp);
        this.hp = Math.min(maxHealth(s), this.hp + amt);
        if (P(s, "respite")) this.sp = Math.min(maxStamina(s), this.sp + amt);
        this.addXp("Restoration", this.hp - before);
        return `${sp.name}: +${Math.round(this.hp - before)} health`;
      }
      this.addXp(sp.school, sp.xp);
      if (sp.kind === "armor") {
        this.armorSpell = spellArmor(s, sp, Object.values(this.armor), this); return `${sp.name}: +${Math.round(this.armorSpell)} armor`;
      }
      if (sp.kind === "summon") {
        const sm = spellSummon(s, sp, this); this.summonTurns = sm.turns; this.summonDmg = sm.dmg;
        const who = summonName(id, sp); this.summonId = id; this.summonName = who;
        return `${sp.name}: ${P(s, "twin_souls") ? `two of them appear (${who})` : `${/^[aeiou]/i.test(who) ? "an" : "a"} ${who} appears`}`;
      }
      if (sp.kind === "calm") {
        if ((this.tags.has("undead") || this.tags.has("construct")) && !P(s, "master_of_the_mind")) return `${sp.name}: no effect on the ${this.tags.has("undead") ? "undead" : "machine"}`;
        const cm = spellCalm(s, sp, this.tags, this);
        if ((this.e.level ?? 99) > cm.cap) return `${sp.name}: no effect (level too high)`;
        this.calmTurns = cm.turns; return `${sp.name}: it stops fighting`;
      }
      return sp.name;
    }
    act(a) {
      if (a === "attack") return this.attack(false);
      if (a === "flee") {   // break off and run (road fights only)
        const ch = 0.45 + skill(this.s, "Athletics") / 200 - (this.e.danger === "high" ? 0.2 : 0) + (riding(this.s) ? 0.15 : 0);
        this.addXp("Athletics", 10);
        if (Math.random() < ch) { this.fled = true; return "You break away and run!"; }
        return "You try to run, but it cuts you off";
      }
      if (a === "power_attack") return this.attack(true);
      if (a === "block") {
        const px = typeof PFX !== "undefined";
        this.sp -= F.BLOCK_STAMINA * Math.max(0, 1 - (px ? Math.min(1, PFX.sum(this.s, "blockcost", this, {})) : 0)); this.blocking = true;   // Block Runner, Iron Lungs
        const first = px && !this.bashed && PFX.has(this.s, "firstbash", this, {}); this.bashed = true;   // Shield Charge
        if ((P(this.s, "power_bash") && Math.random() < 0.3) || first) {
          this.stagger = true;
          const d = P(this.s, "deadly_bash") ? 5 * skill(this.s, "Blocking") / 20 : 0; this.ehp -= d;
          const dis = px ? PFX.sum(this.s, "disarm", this, {}) : 0; if (dis) this.disarmed = dis;   // Disarming Bash
          return `Shield bash${d ? `: ${Math.round(d)}` : ""}, staggers${dis ? ", knocks their weapon aside" : ""}`;
        }
        if (px && this.wt === "spear" && PFX.has(this.s, "guardjab", this, {})) { const d = 4 + skill(this.s, "Spear") / 20; this.ehp -= d; return `Raises guard and jabs with the spear: ${Math.round(d)}`; }   // Spear Wall
        return "Raises guard";
      }
      const [kind, arg] = a.split(":");
      if ((kind === "power" || kind === "shout") && this.pw) return POWERS.act(this, kind, arg);
      if (kind === "spell") return this.cast(arg, false);
      if (kind === "dual") return this.cast(arg, false, true);
      if (kind === "potion") {
        const r = this.findPotion(arg), it = D.ITEMS[r.item];
        this.used[r.id] = (this.used[r.id] || 0) + 1;
        const [res, amt] = it.restore;
        if (res === "health") this.hp = Math.min(maxHealth(this.s), this.hp + amt * (1 + (typeof PFX !== "undefined" ? PFX.sum(this.s, "potion", this, {}) : 0)));   // Field Medic
        else if (res === "magicka") this.mp = Math.min(maxMagicka(this.s), this.mp + amt);
        else this.sp = Math.min(maxStamina(this.s), this.sp + amt);
        return `Drinks ${it.name}`;
      }
      if (kind === "scroll") {
        const r = this.findItem(arg);
        this.used[r.id] = (this.used[r.id] || 0) + 1;
        return "Scroll: " + this.cast(D.ITEMS[arg].spell, true);
      }
      return this.attack(false);
    }
    enemyTurn() {
      const pre = typeof MAGIC !== "undefined" ? MAGIC.beforeEnemy(this) : null;   // runes, fear, invisibility
      if (pre?.end) return pre.text;
      const head = pre ? pre.text + " · " : "";
      let pr = null;   // [Skyrim] dragon priests: cloak, summons, ward and spells (priests.js)
      if (this.e.priest && typeof PRIESTS !== "undefined" && !(this.calmTurns > 0) && !(this.eParalyzed > 0) && !this.stagger) pr = PRIESTS.enemyAct(this);
      let out = pr?.end ? head + pr.text : head + (pr?.text ? pr.text + " · " : "") + this.enemyTurnInner();
      const kon = typeof PRIESTS !== "undefined" ? PRIESTS.guard(this) : null;   // Konahrik
      if (kon) out += " · " + kon;
      const dae = typeof DAEDRIC !== "undefined" ? DAEDRIC.onEnemy(this) : null;   // Ebony Mail, Sanguine Rose, Wabbajack
      if (dae) out += " · " + dae;
      return out;
    }
    enemyTurnInner() {
      const n = this.e.name, s = this.s;
      if (this.calmTurns > 0) { this.calmTurns--; return `${n} isn't fighting`; }
      if (this.eParalyzed > 0) { this.eParalyzed--; return `${n} is paralyzed`; }
      if (this.stagger) { this.stagger = false; return `${n} is staggered`; }
      const fp = this.fp;
      if (fp && this.ehp > 0) {
        if (fp.avoid && !this.fpAvoided && this.ehp < 0.15 * this.ehp0) { this.fpAvoided = true; const h = Math.round(fp.avoid * this.ehp0); this.ehp += h; return `${n} refuses to fall (Avoid Death) and heals ${h}`; }
        if (fp.heal && this.ehp < 0.45 * this.ehp0 && (typeof FOECAP === "undefined" || FOECAP.canHeal(this)) && Math.random() < fp.heal) {   // foecap.js: capped at 65%, 35% a fight, a rest between
          let h = Math.round(fp.healAmt * this.ehp0);
          if (typeof FOECAP !== "undefined") h = FOECAP.heal(this, h); else this.ehp = Math.min(this.ehp0, this.ehp + h);
          return `${n} casts a healing spell: +${h}`;
        }
      }
      const cover = this.coverAl && this.allies.includes(this.coverAl) ? this.coverAl : null; this.coverAl = null;   // a smart follower stepped in front of you
      const tg = this.tgtNow; this.tgtNow = undefined;   // foeintent.js: the target its intent showed (null = you), rolled with the same odds
      const fixed = tg !== undefined && (tg === null || this.allies.includes(tg));
      this.tgtHit = null; this.tgtFixed = fixed && !cover;
      const aw = typeof FAI !== "undefined" ? FAI.aggro(this) : this.allies.length;   // followerai.js: back-row allies draw fewer blows
      if (this.allies.length && (cover || (fixed ? !!tg : Math.random() < aw / (aw + 1) * 0.7))) {   // [OURS] you're still the main target
        this.blocking = false;
        const al = cover || (fixed ? tg : typeof FAI !== "undefined" ? FAI.pickAlly(this) : pick(this.allies));
        this.tgtHit = al;
        if (al.fsum && typeof FAI !== "undefined") return FAI.hitSummon(this, al);   // a follower's summon takes the blow
        if (al.coop && typeof COOP !== "undefined") return COOP.hitAlly(this, al);   // co-op party members take their own blows
        if (al.follower && Math.random() < F.HIT_CHANCE) {
          let d = this.e.damage * rnd(...F.DAMAGE_SPREAD) * (typeof FOL2 !== "undefined" && al.fid === s.follower?.id ? FOL2.taken(s) : 0.8);   // [OURS] followers wear armor (their real armor, with FOL2)
          if (typeof SPELLBOOK !== "undefined") d = SPELLBOOK.allyTakes(this, al, d);   // wards, stoneskin and veils you cast on them
          if (al.fai && typeof FAI !== "undefined") d = FAI.takes(this, al, d);   // a follower on guard blocks part of it
          al.hp -= d;
          if (al.hp <= 0) { this.allies = this.allies.filter((x) => x !== al); this.followerDown = al.name; return `${n} knocks ${al.name} to their knees. ${al.name} is down!`; }   // [Skyrim] protected followers kneel instead of dying
          return `${n} hits ${al.name} ${Math.round(d)}`;
        }
        return `${n} goes for ${al.name}`;
      }
      if (this.mount && typeof HORSEBACK !== "undefined") { const hr = HORSEBACK.enemyTurn(this); if (hr) { this.blocking = false; return hr; } }   // [OURS] foes go for your horse
      const px = typeof PFX !== "undefined";
      if (Math.random() > Math.min(0.97, F.HIT_CHANCE + (fp ? fp.hit : 0)) * (this.wx && /archer|bow|hunter|marksman/i.test(this.e.name || "") ? this.wx.aim : 1) * (this.foeSt?.chill ? 0.85 : 1)) {   // chilled foes are clumsy
        this.blocking = false;
        let back = "";
        if (px && this.ehp > 0 && Math.random() < PFX.sum(s, "counter", this, {})) { const d = this.weaponDamage() * 0.5; this.ehp -= d; back = ` · you punch back ${Math.round(d)}`; }   // Counterpunch
        if (px && Math.random() < PFX.sum(s, "vanish", this, {})) { this.sneakNext = true; back += " · you slip back into the shadows"; }   // Vanish
        return `${n} misses${back}`;
      }
      const bareNow = !Object.values(this.armor).some((a) => ARMOR_SKILL[a.type]), lightNow = Object.values(this.armor).some((a) => a.type === "light");
      if ((typeof CURSE !== "undefined" && CURSE.dodge && CURSE.dodge(this)) || (P(s, "evasion") && Math.random() < 0.1) || (lightNow && P(s, "deft_movement") && Math.random() < 0.1) || (bareNow && P(s, "dodge") && Math.random() < 0.15) || (px && Math.random() < Math.min(0.3, PFX.sum(s, "dodge", this, {})))) {   // + Glancing Blows, Perfect Form, Roll, Nimble...
        if (px && PFX.has(s, "riposte", this, {})) this.riposte = true; this.blocking = false; return `${n} attacks, but you dodge`; }
      const absorb = [0, 0.1, 0.2][P(s, "spell_absorption")];
      if (absorb && Math.random() < absorb) { this.mp = Math.min(maxMagicka(s), this.mp + 15); this.blocking = false; return `${n}'s blow is absorbed into magicka`; }
      let raw = this.e.damage * rnd(...F.DAMAGE_SPREAD) * (this.slowed ? 0.5 : 1) * (this.disarmed > 0 ? 0.6 : 1);
      if (this.disarmed > 0) this.disarmed--;
      let fpTag = "";
      if (fp) {   // their perks: damage, power attacks, crits, dual casting, ambush openers
        raw *= fp.caster ? fp.spell : fp.dmg;
        if (fp.caster && fp.dual && Math.random() < fp.dual) { raw *= 2.2; fpTag = " (dual cast)"; }
        else if (!fp.caster && fp.power && Math.random() < fp.power) { raw *= fp.powerX; fpTag = " (power attack)"; }
        if (fp.crit && Math.random() < fp.crit) { raw *= 1.5; fpTag += " (critical)"; }
        if (this.turn === 0 && fp.opener > 1) { raw *= fp.opener; fpTag += " (sneak attack)"; }
      }
      let dmg = raw, extra = fpTag;
      if (!this.blocking && typeof SHIELDFX !== "undefined" && SHIELDFX.roll(this)) { this.blocking = true; this.shieldCaught = true; }   // [OURS] a shield on your arm catches some blows by itself (shieldfx.js)
      const wasBlocking = this.blocking, magicHit = this.tags.has("mage") || this.tags.has("dragon");
      if (this.blocking) {
        const shieldBase = this.shield ? this.shield.armor : (this.wt === "spear" && P(s, "phalanx") ? 20 : null);
        let pct = F.blockPercent(skill(this.s, "Blocking"), shieldBase, this.tags.has("humanoid") ? this.e.damage : 0);
        pct = Math.min(0.85, pct * (1 + 0.05 * P(s, "shield_wall")) + (this.shield && (this.tags.has("dragon") || this.tags.has("mage")) && P(s, "elemental_protection") ? 0.5 * (1 - pct) : 0));
        if (px) pct = Math.min(0.9, pct + Math.min(0.25, PFX.sum(s, "block", this, {})));   // Guardian, Tower of Strength, Steady Stance
        this.addXp("Blocking", raw * pct);
        dmg *= 1 - pct; extra = ` (${this.shieldCaught ? "caught on your shield" : "blocked"} ${Math.round(pct * 100)}%)`; this.blocking = false; this.shieldCaught = false;
      }
      const { rating, pieces, empty } = this.armorRating();
      dmg *= 1 - F.damageReduction(rating, pieces);
      if (this.tags.has("mage") || this.tags.has("dragon")) dmg *= (1 - 0.1 * P(s, "magic_resistance")) * (1 - Math.min(0.5, fxSum(s, "resist") / 100));
      if (px) {
        const k = PFX.inMult(this, { blocking: wasBlocking, hit: dmg });   // armor and fighting-style perks
        if (k === 0) return `${n}'s arrow glances off your shield`;
        dmg *= k;
        if (magicHit && Math.random() < PFX.sum(s, "reflect", this, {})) { this.ehp -= dmg; return `${n}'s magic is reflected back at them (${Math.round(dmg)})`; }   // Spell Reflection
        const ab = magicHit ? Math.min(0.5, PFX.sum(s, "absorb", this, {})) : 0;   // Atronach
        if (ab) { this.mp = Math.min(maxMagicka(s), this.mp + dmg * ab); dmg *= 1 - ab; extra += ` (${Math.round(ab * 100)}% absorbed)`; }
      }
      if (this.pw) { dmg = POWERS.dmgIn(this, dmg, this.tags.has("mage") || this.tags.has("dragon")); if (dmg === 0) return `${n}'s blow passes through you`; }
      if (Object.values(this.armor).some((a) => a.type === "heavy") && P(s, "reflect_blows") && Math.random() < 0.1) { this.ehp -= dmg; return `${n}'s blow is reflected back (${Math.round(dmg)})`; }
      if (typeof MAGIC !== "undefined" && this.ward > 0) {   // wards only stop magic: casters, breath, spells a foe throws (eMagic)
        const before = dmg; dmg = MAGIC.soak(this, dmg, magicHit || !!(fp && fp.caster) || !!this.eMagic || MAGIC.isCaster(this));
        if (dmg < before) extra += ` (ward soaks ${Math.round(before - dmg)}${this.wardBroke ? ", and breaks" : `, ${Math.round(this.ward)} left`})`; this.wardBroke = false;
      }
      if (fp && dmg > 0) {
        if (fp.bleed) { dmg += fp.bleed; extra += ` · you bleed ${fp.bleed}`; }
        if (fp.stagger && Math.random() < fp.stagger) { this.sp = Math.max(0, this.sp - 15); this.blocking = false; extra += " · staggers you"; }
        if (fp.paralyze && Math.random() < fp.paralyze) { this.sp = Math.max(0, this.sp - 30); extra += " · knocks the wind out of you"; }
      }
      this.hp -= dmg;
      if (px) {
        const fe = PFX.foeElement(this.e);   // fire mages burn you, frost trolls chill you, storm atronachs jolt you
        if (fe && dmg > 0 && Math.random() < fe.ch + (fp ? fp.status : 0)) extra += PFX.hitMe(this, fe.el, dmg);
        const ad = PFX.sum(s, "avoiddeath", this, {});   // Avoid Death
        if (ad && !this.avoidUsed && this.hp < 0.1 * maxHealth(s)) { this.avoidUsed = true; this.hp = Math.min(maxHealth(s), Math.max(1, this.hp) + ad); extra += ` · Avoid Death heals you ${ad}`; }
      }
      if (this.hp <= 0 && P(s, "shadow_warrior") && !this.shadowUsed) { this.shadowUsed = true; this.hp = 1; this.sneakNext = true; return `${n} hits ${Math.round(dmg)}, but you vanish into the shadows`; }
      if (empty && Math.random() < empty / ARMOR_SLOTS.length) this.addXp("Unarmored", F.UNARMORED_XP_PER_HIT);
      else if (pieces) {
        const types = Object.values(this.armor).map((a) => a.type).filter((t) => ARMOR_SKILL[t]);
        const main = types.sort((a, b) => types.filter((x) => x === b).length - types.filter((x) => x === a).length)[0];
        this.addXp(ARMOR_SKILL[main], raw);
      }
      return `${n} hits ${Math.round(dmg)}${extra}`;
    }
    run({ enemyFirst = false, trySneak = true, maxTurns = 60, t, hidden = null } = {}) {
      this.dark = isNight(t || now()) || !!(this.wx && this.wx.aim < 1);   // night, fog, rain: Silent Roll
      if (hidden != null && !enemyFirst) this.hidden = hidden;
      else if (!trySneak || enemyFirst) this.hidden = false;
      else if (typeof SNEAK2 !== "undefined") {   // sneak2.js: only try when it makes sense; a failed try hands the foe the first blow
        const o = SNEAK2.opener(this, t); this.sneakTry = o; this.hidden = o.hidden;
        if (o.spotted) this.log.push({ turn: 0, rule: null, me: `Spotted while sneaking up (${Math.round(o.chance * 100)}% chance)!`, them: this.enemyTurn() });
      } else this.hidden = Math.random() < hiddenChance(this.s, this.e, t);
      if (enemyFirst) this.log.push({ turn: 0, rule: null, me: "", them: this.enemyTurn() });
      while (this.hp > 0 && this.ehp > 0 && !this.endWon && !this.fled && this.turn < maxTurns) {
        this.turn++;
        const [rule, a] = this.choose();
        const line = { turn: this.turn, rule, me: this.act(a), them: "", a, wt: this.wt };   // a / wt: what was done, for the fight scene only
        if (this.ai && !rule) { line.ai = true; if (this.aiWhy && this.aiWhy !== this.aiLastWhy) line.why = this.aiWhy; this.aiLastWhy = this.aiWhy; }   // why the AI did it (shown when the reason changes)
        if (this.bleed.length && this.ehp > 0) { const b = this.bleed.reduce((x, y) => x + y.dmg, 0); this.ehp -= b; this.bleed = this.bleed.map((y) => ({ ...y, turns: y.turns - 1 })).filter((y) => y.turns > 0); line.me += ` · bleeds ${Math.round(b)}`; }
        for (const al of [...this.allies]) if (this.ehp > 0) { if (al.coop && typeof COOP !== "undefined") { line.me += COOP.allyAct(this, al); continue; } if (al.follower && typeof FOL2 !== "undefined") { const ft = FOL2.turn(this, al); if (ft) { line.me += ft; continue; } } if (al.follower && this.ai) { line.me += COMBATAI.followerAct(this, al); continue; } const d = al.dmg * rnd(...F.DAMAGE_SPREAD); this.ehp -= d; line.me += ` · ${al.name} ${Math.round(d)}`; }
        if (typeof PFX !== "undefined") PFX.tick(this, line);   // burning, chills and jolts
        if (this.summonTurns > 0 && this.ehp > 0) { this.summonTurns--; this.ehp -= this.summonDmg; line.me += ` · familiar ${this.summonDmg}`; }
        if (typeof MAGIC !== "undefined" && !this.endWon) MAGIC.tick(this, line);   // cloaks, burning walls, healing circles
        { const g = this.healGuard(rule); if (g) line.me += " · " + g; }
        if (this.ehp > 0 && !this.endWon && !this.fled) line.them = this.enemyTurn();
        if (this.pw) POWERS.tick(this, line);
        line.hp = Math.max(0, Math.round(this.hp)); line.ehp = Math.max(0, Math.round(this.ehp));
        this.log.push(line);
        this.sp = Math.min(maxStamina(this.s), this.sp + this.regenSp * (this.regenSpHold ? 0.5 : 1)); this.regenSpHold = false;   // a chill slows your stamina
        this.mp = Math.min(maxMagicka(this.s), this.mp + this.regenMp);
        this.slowed = Math.max(0, this.slowed - 1);
        if (this.mount && typeof HORSEBACK !== "undefined") HORSEBACK.tick(this);
      }
      this.won = this.ehp <= 0 || !!this.endWon;
      if (this.endWon) { this.e.fled = true; this.e.gold = [0, 0]; }   // turned undead run off and leave nothing
      this.e.hp = Math.max(0, Math.round(this.ehp));
      return this.won;
    }
    apply(t = now()) {
      const daeMsgs = [...(typeof DAEDRIC !== "undefined" ? DAEDRIC.after(this) : []), ...(typeof CURSE !== "undefined" && CURSE.after ? CURSE.after(this) : [])];   // Azura's Star; feeding, Lord kills
      if (this.won && this.weaponInv && this.weapon?.enchant) {   // [Skyrim] Soul Siphon; [OURS] Soul Trap perk
        const extra = 0.05 * P(this.s, "soul_siphon") + 0.1 * P(this.s, "soul_trap") + (typeof PFX !== "undefined" ? PFX.num(this.s, "siphon") : 0);
        if (extra) { const row = invRow(this.s, this.weaponInv); const cap = this.weapon.enchant.capacity; this.charges[this.weaponInv] = Math.min(cap, (this.charges[this.weaponInv] ?? row.charge ?? 0) + cap * extra); }
      }
      setHealth(this.s, this.hp, t);
      if (this.s.follower && !this.s._test) {
        const fa = this.allies.find((a) => a.follower);
        if (this.followerDown) { this.s.follower.hp = Math.max(1, TOWNS.followerMax(this.s, this.s.follower.id) * 0.1); this.s.follower.ts = t; }   // gets back up after the fight, badly hurt
        else if (fa) { this.s.follower.hp = Math.max(1, fa.hp); this.s.follower.ts = t; }
      }
      if (typeof FOL2 !== "undefined" && this.s.follower && !this.s._test && (this.followerDown || this.allies.some((a) => a.follower))) daeMsgs.push(...FOL2.gain(this.s, this));   // they learn from fights they were in
      const extraMsgs = this.won && this.ehp <= 0 && this.tags.has("dragon") && typeof POWERS !== "undefined" && !this.s._test ? [POWERS.absorb(this.s)] : [];
      for (const [id, q] of Object.entries(this.used)) take(this.s, +id, q);
      for (const [id, c] of Object.entries(this.charges)) { const r = invRow(this.s, +id); if (r) r.charge = c; }
      const msgs = typeof MAGIC !== "undefined" ? MAGIC.after(this) : [];
      if (this.mount && typeof HORSEBACK !== "undefined") msgs.push(...HORSEBACK.after(this, t));
      if (!this.e.guard) for (const [k, v] of Object.entries(this.xp)) msgs.push(...useSkill(this.s, k, v));   // [OURS] fighting guards teaches you nothing
      return [...(this.followerDown ? [`${this.followerDown} gets back up after the fight, badly hurt.`] : []), ...extraMsgs, ...daeMsgs, ...msgs];
    }
  }

  /* [OURS] story foes (quest fights, dragon priests) have a recommended level and scale inside a band, like Skyrim's
     leveled quest encounters with a min and max level. Under the recommended level the foe stands at most
     QUEST_LEVEL_OVER levels above you; from there it is never below its recommended level, follows you at
     QUEST_LEVEL_FOLLOW speed, and stops QUEST_LEVEL_SPAN levels above it. It is scaled as an equal-level foe at
     that level, without the road catch-up for under-levelled foes. */
  function questLevel(level, rec) {
    if (level <= rec) return Math.min(rec, level + D.QUEST_LEVEL_OVER);
    return Math.round(rec + Math.min(D.QUEST_LEVEL_SPAN, (level - rec) * D.QUEST_LEVEL_FOLLOW));
  }
  function scaleQuestFoe(e, level, rec = e.rec ?? e.level ?? level) {
    e = clone(e);
    const lv = questLevel(level, rec), sc = 1 + 0.02 * (lv - 1), curve = 1 + D.QUEST_HP_CURVE * Math.max(0, lv - 10) ** 2 / sc;
    e.health = Math.floor(e.health * sc * curve * D.ENEMY_HEALTH_MULT); e.hp = e.health;
    e.damage = Math.round(e.damage * sc * D.ENEMY_DAMAGE_MULT * 10) / 10;
    delete e.fp;
    return Object.assign(e, { level: lv, rec, qlevel: lv, plevel: lv });
  }
  function scaleEnemy(e, level) {
    e = clone(e);
    if (e.kind !== "event") {
      const sc = 1 + 0.02 * (level - 1);            // [OURS] everything grows a little with you
      // [OURS, after Skyrim's leveled lists] foes from below your level catch up: a level-30 hero meets bandit
      // marauders, not the outlaws a level-6 hero met. Foes at or above your level (dragons, giants) don't.
      const gap = Math.min(D.ENEMY_CATCHUP_MAX, Math.max(0, level - (e.level ?? level) - D.ENEMY_CATCHUP_GRACE));   // a few levels' head start before they catch up
      const soft = (e.tags || []).includes("elite") ? D.ENEMY_CATCHUP_ELITE : 1;   // tough foes and bosses are already tough: they catch up more slowly
      const hpC = 1 + D.ENEMY_CATCHUP_HP * soft * gap, dmgC = 1 + D.ENEMY_CATCHUP_DMG * soft * gap;
      const curve = 1 + D.ENEMY_HP_CURVE * Math.max(0, level - 10) ** 2 / sc;   // [OURS] from level 10 on, health keeps pace with your gear and perks (×1.18 at 20, ×1.6 at 30, ×2.2 at 40)
      e.health = Math.floor(e.health * sc * curve * hpC * D.ENEMY_HEALTH_MULT);
      e.damage = Math.round(e.damage * sc * dmgC * D.ENEMY_DAMAGE_MULT * 10) / 10;
      e.hp = e.health;
      e.plevel = Math.min(Math.max(level, e.level ?? level), (e.level ?? level) + gap);   // the level its perks are picked at
      delete e.fp;
    }
    return e;
  }
  const ammoQty = (item) => { const it = D.ITEMS[item]; return it?.slot === "ammo" && typeof AMMO !== "undefined" ? rint(...AMMO.LOOT_QTY[it.ammo]) : 1; };
  function rollLoot(s, e) {
    const got = [], tags = new Set(e.tags || []);
    if (e.fled || e.guard) return got;   // [OURS] guards can't be farmed for gear
    for (const table of [...(tags.has("humanoid") ? ["humanoid"] : []), ...(tags.has("elite") ? ["elite"] : [])])
      for (const [item, ch] of D.LOOT[table]) if (Math.random() < ch) { const q = ammoQty(item); give(s, item, q); got.push(D.ITEMS[item].name + (q > 1 ? ` ×${q}` : "")); }
    if (tags.has("beast") && typeof SMITH !== "undefined") { const p = SMITH.peltFor(e.name); if (p && Math.random() < 0.7) { give(s, p); got.push(D.ITEMS[p].name); } }   // [Skyrim] pelts from animals
    if (e.hunt && typeof HUNT !== "undefined") got.push(...HUNT.loot(s, e));
    if (typeof JEWELRY !== "undefined") got.push(...JEWELRY.loot(s, e));   // rings and amulets, often enchanted (jewelry.js)   // venison and hides from game (hunting.js)
    if (typeof GATHER !== "undefined") got.push(...GATHER.creatureParts(s, e));   // [Skyrim] claws, teeth, eggs, jelly (gather.js)
    return got;
  }
  function rollEncounter(s, t) {
    const night = isNight(t), hold = holdAt([s.x, s.y]);
    const raid = typeof CARAVANS !== "undefined" ? CARAVANS.cartAmbush(s) : null;   // bandits after your cart's cargo
    if (raid) { const e = scaleEnemy(raid, fightLevel(s)); e.hold = hold; return e; }
    const owed = (s.bounty || {})[hold] || 0;
    if (owed && Math.random() < Math.min(0.5, 0.1 + owed / 1500)) {   // [Skyrim] bounty collectors find wanted people ([OURS] chance)
      const e = scaleEnemy({ name: "Bounty hunter", danger: "medium", level: 10, tags: ["humanoid"], health: 90, damage: 16, gold: [20, 60],
        text: `"${s.name}? There's ${owed} gold on your head in ${hold}. Pay up, or I collect it the hard way."` }, s.level);
      e.hold = hold; e.bountyHold = hold; e.owed = owed;
      return e;
    }
    const w = { ...D.DANGER_WEIGHTS };
    if (night) w.high *= D.NIGHT_HIGH_MULT;
    let r = Math.random() * Object.values(w).reduce((a, b) => a + b), danger = "low";
    for (const [k, v] of Object.entries(w)) { if (r < v) { danger = k; break; } r -= v; }
    const ground = Terrain.NAMES[Terrain.typeAtPos([s.x, s.y])];
    const inHold = (e) => (e.holds ? e.holds.includes(hold) : hold !== "Solstheim");   // Solstheim has its own creatures (solworld.js)
    let pool = D.ENCOUNTERS.filter((e) => e.danger === danger && inHold(e) && (night || !e.night));
    const onGround = pool.filter((e) => !e.terrain || e.terrain.includes(ground));
    if (onGround.length) pool = onGround;
    const filtered = pool.filter((e) => !e.rare || Math.random() < 0.25);
    if (filtered.length) pool = filtered;
    let witching = false;
    if (night && typeof FEST !== "undefined" && FEST.undeadNight(t) && Math.random() < 0.6) {   // the Witchingmoon: the dead walk
      const dead = D.ENCOUNTERS.filter((x) => (x.tags || []).includes("undead") && inHold(x));
      const same = dead.filter((x) => x.danger === danger);
      if (same.length || dead.length) { pool = same.length ? same : dead; witching = true; }
    }
    const e = scaleEnemy(pick(pool), fightLevel(s));
    if (witching) e.gold = [Math.round(e.gold[0] * 1.5), Math.round(e.gold[1] * 1.5)];
    e.hold = hold;
    return e;
  }

  // ---------------------------------------------------------------- death (corpse run)
  function die(s, cause, t = now(), byPlayer = false) {
    const keep = equippedAnywhere(s);
    const items = [];
    s.inv = s.inv.filter((r) => { if (keep.has(r.id) || D.ITEMS[r.item]?.noTrade) return true; items.push([r.item, r.qty, r.charge]); return false; });
    const bag = (s.gold || items.length) ? { id: `${s.id}-${Math.floor(t)}`, ownerId: s.id, ownerName: s.name,
      x: s.x, y: s.y, gold: s.gold, items, expires: t + BAG_MINUTES * 60 } : null;
    const lost = `${s.gold} gold and ${items.reduce((a, i) => a + i[1], 0)} items`;
    s.gold = 0;
    const towns = s.discovered.filter((n) => ["city", "town"].includes(loc(n)?.[2]));
    const town = (towns.length ? towns : [D.START_LOCATION]).reduce((a, b) => pxDist([s.x, s.y], loc(a)) <= pxDist([s.x, s.y], loc(b)) ? a : b);
    [s.x, s.y] = loc(town);
    s.location = town;
    setHealth(s, maxHealth(s) * 0.5, t);
    s.trip = null; s.dungeon = null; s.ambush = false;
    const msg = `Killed by ${byPlayer ? "" : "the "}${cause}. You wake up in ${town}'s temple. Your bag (${lost}) lies where you fell for ${BAG_MINUTES} minutes — get it before someone else does.`;
    note(s, "💀 " + msg);
    return { msg, bag };
  }
  function pickUpBags(s, bags, t = now()) {
    const taken = [], msgs = [];
    for (const b of bags) {
      if (b.expires <= t || pxDist([s.x, s.y], [b.x, b.y]) > BAG_PICKUP_PX) continue;
      s.gold += b.gold;
      for (const [item, qty, charge] of b.items) if (D.ITEMS[item]) give(s, item, qty, charge);
      taken.push(b.id);
      msgs.push(b.ownerId === s.id ? `You recovered your bag (${b.gold} gold).` : `You found ${b.ownerName}'s abandoned bag and took ${b.gold} gold and their things.`);
    }
    return { taken, msgs };
  }

  // ---------------------------------------------------------------- travel
  /* travel speed on open ground, map pixels per minute. Terrain (terrain.js) speeds it up (roads) or slows it down. */
  function speed(s) {
    if (s.trip?.speed) return s.trip.speed;   // following a party: everyone walks at the slowest member's pace
    const c = carried(s), cap = capacity(s);
    let v = F.travelSpeed(BASE_WALK, skill(s, "Athletics"), c, cap);
    if (c > cap && P(s, "marathon")) v = (v + F.travelSpeed(BASE_WALK, skill(s, "Athletics"), cap, cap)) / 2;
    v *= 1 + 0.05 * P(s, "long_strider") + (typeof PFX !== "undefined" ? Math.min(0.15, PFX.num(s, "travel")) : 0);   // Fleet Foot, Trailblazer...
    if (typeof WEVENTS !== "undefined") { const wf = WEVENTS.weather([s.x, s.y]).speed; v *= wf < 1 && fxSum(s, "warmth") > 0 ? (1 + wf) / 2 : wf; if (typeof WFX !== "undefined") v *= WFX.speedMult(s); }   // [OURS] snow and storms slow you down; hot soup halves that
    if (typeof HUNT !== "undefined") v *= HUNT.speedMult(s);   // tracking game is slower (hunting.js)
    if (riding(s)) v *= typeof HORSES !== "undefined" ? HORSES.speed(s) : D.HORSE_SPEED;   // breed, roll and horseshoes
    if (typeof CARAVANS !== "undefined") v *= CARAVANS.cartSpeed(s);   // [OURS] a loaded cart is a little slower
    if (typeof SNEAKMODE !== "undefined") v *= SNEAKMODE.speedMult(s);   // sneaking on the road is slower (sneakmode.js)
    return v;
  }
  function startTrip(s, destName, dest, t = now()) {
    if (s.trip?.status === "encounter") return "Deal with the encounter first.";
    if (s.dungeon) return `You're inside ${s.dungeon.place}. Leave it first.`;
    if (!WORLD.same([s.x, s.y], dest)) return WORLD.isSol(dest) ? "Solstheim is across the sea. Take the Northern Maiden from the Windhelm docks (Area tab)." : "Skyrim is across the sea. Take the boat from the Raven Rock docks (Area tab).";
    const path = Terrain.route([s.x, s.y], dest);
    s.trip = { destName, dest, origin: s.location || "the wilds", start: [s.x, s.y], path, idx: 0, trail: [[s.x, s.y]],
      lastTick: t, status: "travel", encounter: null, log: [] };
    s.location = null;
    return null;
  }
  /* where you are `seconds` after the last saved step (for smooth movement on screen) */
  function posAfter(s, seconds) {
    const tr = s.trip;
    if (!tr || tr.status !== "travel") return [s.x, s.y];
    if (seconds <= 0) return [s.x, s.y];
    return Terrain.moveAlong(tr.path, tr.idx, [s.x, s.y], seconds, speed(s) / 60).pos;
  }
  const minutesLeft = (s) => s.trip ? (s.trip.boat ? s.trip.sail / 60 : Terrain.secondsLeft(s.trip.path, s.trip.idx, [s.x, s.y], speed(s) / 60) / 60) : 0;
  const minutesTo = (s, dest) => Terrain.secondsLeft(Terrain.route([s.x, s.y], dest), 0, [s.x, s.y], speed(s) / 60) / 60;
  function tripLog(s, text) { s.trip.log.unshift(text); s.trip.log = s.trip.log.slice(0, 8); note(s, text); }

  /* Move a trip forward to time t, in 30 s steps (so a closed page catches up the same way).
     Returns {events, bag?, died?, arrived?, encounter?}. bags = shared bags list for pick-ups. */
  function advance(s, t = now(), bags = []) {
    const out = { events: [], taken: [] };
    if (typeof WFX !== "undefined") WFX.cold(s, t);   // [OURS] the cold meter (weatherfx.js)
    const tr = s.trip;
    if (!tr || tr.status !== "travel") return out;
    if (tr.boat && typeof SOL !== "undefined") return SOL.sailOn(s, t, out);   // at sea: the boat just carries you (solstheim.js)
    while (tr.lastTick + 1 <= t) {
      const dt = Math.min(STEP_SECONDS, t - tr.lastTick);
      const stepT = tr.lastTick + dt;
      tr.lastTick = stepT;
      if (!tr.path) { tr.path = Terrain.route([s.x, s.y], tr.dest); tr.idx = 0; }
      const mv = Terrain.moveAlong(tr.path, tr.idx, [s.x, s.y], dt, speed(s) / 60), was = [s.x, s.y];
      [s.x, s.y] = mv.done ? tr.dest : mv.pos; tr.idx = mv.idx;
      if (typeof SNEAKMODE !== "undefined" && s.sneak && !tr.carriage && !tr.follow) SNEAKMODE.train(s, dt).forEach((m) => tripLog(s, "📈 " + m));
      const last = s.explored[s.explored.length - 1];
      if (!last || pxDist(last, [s.x, s.y]) >= TRAIL_STEP_PX) s.explored.push([+s.x.toFixed(4), +s.y.toFixed(4)]);
      tr.trail.push([+s.x.toFixed(4), +s.y.toFixed(4)]);
      if (tr.trail.length > 120) tr.trail.splice(1, 1);
      if (!riding(s) && !overweight(s)) for (const m of useSkill(s, "Athletics", dt * F.ATHLETICS_XP_PER_SECOND)) tripLog(s, "📈 " + m);
      const known = new Set(s.discovered);
      for (const [n, [lx, ly, kind]] of Object.entries(PLACES))
        if (!known.has(n) && pxDist([s.x, s.y], [lx, ly]) <= discoverRadius(kind)) { s.discovered.push(n); tripLog(s, `📍 Discovered ${n}`); if (typeof EXPLORE !== "undefined") EXPLORE.onDiscover(s, n, tripLog); }
      if (typeof VISION !== "undefined") VISION.step(s, was, stepT, tripLog);   // look ahead: spot places inside your cone of sight (vision.js)
      if (typeof GATHER !== "undefined") GATHER.onStep(s, (m) => tripLog(s, m), stepT);   // plant patches you pass (gather.js)
      const pk = pickUpBags(s, bags.filter((b) => !out.taken.includes(b.id)), stepT);
      out.taken.push(...pk.taken);
      pk.msgs.forEach((m) => tripLog(s, "🎒 " + m));

      if (s.x === tr.dest[0] && s.y === tr.dest[1]) {
        if (PLACES[tr.destName]) { s.location = tr.destName; if (!s.discovered.includes(tr.destName)) s.discovered.push(tr.destName); }
        tripLog(s, `🏁 Arrived at ${tr.destName}`);
        s.trip = null;
        out.arrived = tr.destName;
        if (typeof SOL !== "undefined") SOL.arrived(s, tr.destName, out);
        return out;
      }
      if (tr.caravan && typeof CARAVANS !== "undefined") {   // guarding a caravan: its ambushes come on its own schedule
        const ce = CARAVANS.ambushDue(s, tr, stepT);
        if (ce) { const e = scaleEnemy(ce, fightLevel(s)); tr.status = "encounter"; tr.encounter = e; out.encounter = e; note(s, `⚠️ Caravan ambush: ${e.name}`); return out; }
        continue;
      }
      const rate = tr.carriage || tr.follow ? 0 : ENCOUNTER_PER_MIN * (isNight(stepT) ? D.NIGHT_ENCOUNTER_MULT : 1) * (typeof WEVENTS !== "undefined" ? WEVENTS.weather([s.x, s.y], stepT).encounters : 1) * (typeof SNEAKMODE !== "undefined" ? SNEAKMODE.encounterMult(s) : 1) * (typeof CVROAD !== "undefined" ? CVROAD.ambushMult(s, stepT) : 1);   // nobody robs a carriage on a Jarl's road; party members following their leader leave the road to them (partyplay.js)
      if (Math.random() < 1 - (1 - rate) ** (dt / 60)) {
        const e = rollEncounter(s, stepT);
        if (e.danger === "low" && e.kind === "event") {   // every fight is yours to play: the trip stops for it (no auto fighting)
          const g = rint(...e.gold); s.gold += g;
          tripLog(s, e.text + (g ? ` (+${g} gold)` : ""));
        } else {
          const hm = typeof HORSES !== "undefined" ? HORSES.hurt(s, e, stepT, 0.25) : null;   // horses go down, they never die
          if (hm) tripLog(s, hm);
          tr.status = "encounter"; tr.encounter = e;
          out.encounter = e;
          note(s, `⚠️ Encounter: ${e.name}`);
          return out;
        }
      }
      const hr = typeof HUNT !== "undefined" ? HUNT.rate(s, stepT) : 0;   // hunting: animals turn up far more often (hunting.js)
      if (hr && Math.random() < 1 - (1 - hr) ** (dt / 60)) {
        const e = scaleEnemy(HUNT.pick(s), fightLevel(s)); e.hold = holdAt([s.x, s.y]);
        tr.status = "encounter"; tr.encounter = e; out.encounter = e;
        note(s, `🏹 Hunting: ${e.name}`);
        return out;
      }
    }
    return out;
  }

  /* A button press during an encounter. Returns {text, fight?, died?, bag?}. */
  function encounterAction(s, action, t = now(), opts = {}) {
    const tr = s.trip, e = tr.encounter;
    const lines = [];
    if (action === "pay" && e.bountyHold) {
      const owed = (s.bounty || {})[e.bountyHold] || 0;
      if (s.gold < owed) return { text: `You only have ${s.gold} gold. The hunter laughs.` };
      s.gold -= owed; delete s.bounty[e.bountyHold];
      tr.status = "travel"; tr.encounter = null; tr.lastTick = t; tripLog(s, `⚖️ Paid off your ${e.bountyHold} bounty (${owed} gold)`);
      return { text: `You count out ${owed} gold. "Pleasure doing business." Your bounty in ${e.bountyHold} is cleared.` };
    }
    if (action === "potion") {
      const f = new Fight(s, e, null, t), r = f.findPotion("health");
      if (!r) return { text: "You have no healing potions!" };
      const before = curHealth(s, t), it = D.ITEMS[r.item];
      take(s, r.id); setHealth(s, before + it.restore[1], t);
      return { text: `You drink a ${it.name} (${Math.round(before)} → ${Math.round(curHealth(s))} health).` };
    }
    let enemyFirst = !!opts.enemyFirst;
    if (action === "flee") {
      const ch = 0.55 + skill(s, "Athletics") / 250 - (e.danger === "high" ? 0.2 : 0) + (riding(s) ? 0.15 : 0);   // [OURS]
      lines.push(...useSkill(s, "Athletics", 10 * F.ATHLETICS_XP_PER_SECOND));
      if (Math.random() < ch) { tr.status = "travel"; tr.encounter = null; tr.lastTick = t; tripLog(s, `🏃 Escaped the ${e.name}`); const ds = e.caravan && typeof CARAVANS !== "undefined" ? CARAVANS.deserted(s) : null; return { text: `You ${riding(s) ? "ride" : "run"} and lose the ${e.name}.${ds ? " " + ds : ""}`, skills: lines }; }
      enemyFirst = true; lines.unshift(`You try to escape, but the ${e.name} catches you!`);
    } else if (action === "sneak") {
      lines.push(...useSkill(s, "Sneak", 2.5 + 0.625 * 10));   // [Skyrim] 2.5 for hiding + 0.625/s hidden
      if (Math.random() < hiddenChance(s, e, t)) { tr.status = "travel"; tr.encounter = null; tr.lastTick = t; tripLog(s, `🥷 Slipped past the ${e.name}`); return { text: `You slip past the ${e.name} unseen.`, skills: lines }; }
      enemyFirst = true; lines.unshift(`A twig snaps. The ${e.name} spots you!`);
    }
    const f = new Fight(s, e, null, t);
    if (typeof HORSEBACK !== "undefined") HORSEBACK.engage(f, t);   // [OURS] riding? you fight from the saddle
    f.canFlee = true;   // a "flee" tactic can break off a road fight
    f.run({ enemyFirst, t, hidden: opts.hidden ?? null });
    const skillMsgs = f.apply(t);
    if (f.fled && !f.won && f.hp > 0) {
      tr.status = "travel"; tr.encounter = null; tr.lastTick = t; tripLog(s, `🏃 Broke off the fight with the ${e.name}`);
      return { text: [...lines, `You break off the fight and leave the ${e.name} behind.`].join(" "), fight: f, fled: true, skills: skillMsgs };
    }
    if (f.won) {
      const g = rint(...e.gold); s.gold += g; const loot = rollLoot(s, e);
      tr.status = "travel"; tr.encounter = null; tr.lastTick = t;
      tripLog(s, `⚔️ Defeated the ${e.name}${g ? ` (+${g} gold)` : ""}`);
      return { text: lines.join(" ") || `You defeat the ${e.name}.`, fight: f, gold: g, loot, skills: skillMsgs };
    }
    const d = die(s, e.name, t);
    return { text: lines.join(" "), fight: f, died: d.msg, bag: d.bag, skills: skillMsgs };
  }

  // ---------------------------------------------------------------- road events (events.js; only rolled while the page is open)
  function startEvent(s, t = now()) {
    const tr = s.trip;
    if (!tr || tr.status !== "travel" || typeof ROAD_EVENTS === "undefined") return null;
    tr.status = "event"; tr.event = ROAD_EVENTS.roll(s); tr.lastTick = t;
    return tr.event;
  }
  const eventChoices = (s) => s.trip?.event ? ROAD_EVENTS.choices(s.trip.event, s) : [];
  /* Returns {text, skills?, fight?, died?, bag?}. The trip stays paused while trip.status === "event". */
  function eventChoice(s, choice, t = now()) {
    const tr = s.trip, ev = tr?.event;
    if (!ev) return { text: "" };
    const r = ROAD_EVENTS.choose(s, ev, choice);
    if (r.fee) ev.fee = r.fee;
    if (r.shop) ev.shop = r.shop;
    if (r.fight || r.foe) {
      const base = r.foe || D.ENCOUNTERS.find((e) => e.name === r.fight) || D.ENCOUNTERS[0];   // encounters.js can bring its own foe
      const e = scaleEnemy(base, fightLevel(s)); e.hold = holdAt([s.x, s.y]);
      tr.status = "encounter"; tr.event = null; tr.encounter = e;
      const fr = encounterAction(s, "fight", t, { enemyFirst: r.enemyFirst, hidden: r.hidden ? true : null });
      let after = "";
      if (fr.fight && fr.fight.won && r.afterFn) { try { after = r.afterFn(s) || ""; } catch (err) { after = ""; } }
      fr.text = [r.text, fr.text, after].filter(Boolean).join(" ").trim();
      if (r.skills?.length) fr.skills = [...r.skills, ...(fr.skills || [])];
      if (after) tripLog(s, "🛤 " + after);
      return fr;
    }
    if (r.rob) { const lost = Math.min(s.gold, rint(20, 60)); s.gold -= lost; r.text += ` (−${lost} gold)`; }
    if (r.keep) return r;
    tr.status = "travel"; tr.event = null; tr.lastTick = t + (r.delay || 0);
    if (r.skip) { const mv = Terrain.moveAlong(tr.path, tr.idx, [s.x, s.y], r.skip, speed(s) / 60); if (!mv.done) { [s.x, s.y] = mv.pos; tr.idx = mv.idx; } }
    if (choice !== "leave") tripLog(s, "🛤 " + r.text);
    return r;
  }
  function buyFrom(s, item) {   // a travelling merchant: same barter formula as towns, no opening hours (and no town market)
    if (typeof SHOPCAP !== "undefined" && !SHOPCAP.ok(item)) return SHOPCAP.why(item);
    const price = buyPrice(s, item, null);
    if (s.gold < price) return `That costs ${price} gold. You have ${s.gold}.`;
    s.gold -= price; give(s, item);
    const m = useSkill(s, "Mercantile", price);
    return `Bought ${D.ITEMS[item].name} for ${price} gold.` + (m.length ? " " + m.join(". ") : "");
  }

  // ---------------------------------------------------------------- towns
  const shopTypes = (l) => D.SHOPS[l] || [];
  const shopStock = (l) => { const all = [...new Set(shopTypes(l).flatMap((k) => [...(D.SHOP_STOCK[k] || []), ...(((D.TOWN_STOCK || {})[l] || {})[k] || [])]))]; return typeof SHOPCAP !== "undefined" ? SHOPCAP.filter(all) : all; };   // [OURS] traders sell basic gear only (shopcap.js)
  const haggle = (s) => 1 + [0, 0.1, 0.15, 0.2, 0.25, 0.3][P(s, "haggling")] + fxSum(s, "barter") / 100 + (typeof PFX !== "undefined" ? Math.min(0.15, PFX.num(s, "price")) : 0);   // + Merchant, Investor, Silver Tongue...   // [Skyrim] Haggling; Fortify Barter
  /* [OURS] the town's market (economy.js): regional goods, today's shortage, caravans and what players trade move prices.
     Trade goods are dealt wholesale (a smaller merchant's cut). extra = units already in this lot, so bulk deals slide. */
  const econOn = () => typeof ECON !== "undefined";
  const econ = (town, item, side, extra) => (econOn() && town ? ECON.mult(town, item, side, extra) : 1);
  const cutOf = (s, item) => { const pf = F.priceFactor(skill(s, "Mercantile")); return econOn() && ECON.isTrade(item) ? ECON.tradeFactor(pf) : pf; };
  const buyPrice = (s, item, town = s.location, extra = 0) => {
    const v = D.ITEMS[item].value * econ(town, item, "buy", extra);
    const base = econOn() && ECON.isTrade(item) ? Math.max(Math.round(v * 1.05), Math.round(v * cutOf(s, item))) : F.buyPrice(v, skill(s, "Mercantile"));
    return Math.max(1, Math.round(base / haggle(s) * (typeof FEST !== "undefined" ? FEST.shopDiscount() : 1)   // Midyear: 10% off
      * (typeof WARS !== "undefined" && town && PLACES[town] ? WARS.discount(s, holdAt(PLACES[town])) : 1)   // your clan rules this hold
      * (typeof RUMOURS !== "undefined" && town ? RUMOURS.priceMult(s, town) : 1)   // local hero discount; knocked-up shop at night (rumours.js)
      * (typeof BEASTPATH !== "undefined" && town ? BEASTPATH.priceMult(s, town) : 1)   // a hungry vampire, a werewolf seen in town (beastpaths.js)
      * (typeof GREATEV !== "undefined" && town ? GREATEV.priceMult(s, town) : 1)));   // a fair in town, a burned town, a plundered or grateful hold (greatevents.js)
  };
  function sellPrice(s, row, town = s.location, extra = 0) {
    const it = D.ITEMS[row.item];
    let v = it.value;
    if (it.enchant && row.charge != null) v = it.value * (0.5 + 0.5 * row.charge / it.enchant.capacity);   // [OURS]
    v *= econ(town, row.item, "sell", extra);
    if (typeof CRAFTFAIR !== "undefined") v = CRAFTFAIR.sellValue(row, v);   // things you made sell for no more than their materials
    const guild = typeof GUILDS !== "undefined" ? GUILDS.fenceMult(s, row) : 1;   // Thieves Guild ranks: the fence pays more
    const fair = econOn() && ECON.isTrade(row.item) ? Math.min(Math.round(v), Math.round(v / cutOf(s, row.item))) : F.sellPrice(v, skill(s, "Mercantile"));
    let p = Math.max(1, Math.round(Math.min(Math.round(v), Math.round(fair * haggle(s) * (P(s, "master_trader") ? 1.1 : 1))) * guild * (row.stolen ? 1 + 0.2 * Math.min(100, skill(s, "Streetwise")) / 100 : 1)));   // Streetwise: fences pay up to 20% more
    if (typeof RUMOURS !== "undefined" && town) p = Math.max(1, Math.round(p * RUMOURS.sellMult(s, town)));   // night prices after knocking (rumours.js)
    if (econOn() && town) p = Math.max(1, Math.min(p, Math.floor(0.9 * buyPrice(s, row.item, town, extra))));   // never more than 90% of their asking price
    return p;
  }
  /* the price of a whole lot: each unit nudges the market a little */
  function lotPrice(s, item, qty, side = "buy", row = null, town = s.location) {
    qty = Math.max(1, Math.floor(qty));
    if (!econOn() || !town || qty === 1) return (side === "buy" ? buyPrice(s, item, town) : sellPrice(s, row || { item }, town)) * qty;
    let tot = 0;
    for (let k = 0; k < qty; k++) tot += side === "buy" ? buyPrice(s, item, town, k) : sellPrice(s, row || { item }, town, -k);
    return tot;
  }
  const knockOk = (s, t) => typeof RUMOURS !== "undefined" && RUMOURS.knocked(s, s.location, t);   // closed, but you knocked (rumours.js)
  function buy(s, item, qty = 1, t = now()) {
    if (!s.location || !shopTypes(s.location).length) return "There's no shop here.";
    if (typeof TOWNS !== "undefined" && TOWNS.wanted(s)) return "The merchant won't trade with a wanted criminal.";
    if (typeof BEASTPATH !== "undefined") { const no = BEASTPATH.refuse(s); if (no) return no; }   // a starving vampire
    if (!shopsOpen(t) && !knockOk(s, t)) return `The shops are closed (${clockText(t)}). They open at 08:00.`;
    if (typeof MAGIC !== "undefined") { const no = MAGIC.canBuy(s, item); if (no) return no; }
    if (typeof SHOPCAP !== "undefined" && !SHOPCAP.ok(item)) return SHOPCAP.why(item);
    if (item === "horse") {
      if (!shopTypes(s.location).includes("stables")) return "No stables here.";
      if (typeof HORSES !== "undefined") return HORSES.buy(s);
      if (s.horse) return "You already have a horse.";
      if (s.gold < D.HORSE_PRICE) return `A horse costs ${D.HORSE_PRICE} gold.`;
      s.gold -= D.HORSE_PRICE;
      s.horse = { name: pick(["Frost", "Arvak", "Old Bessie", "Lucky", "Thunder", "Mead", "Ember", "Ash"]) };
      useSkill(s, "Mercantile", D.HORSE_PRICE);
      return `You bought ${s.horse.name}. You travel ${D.HORSE_SPEED}× faster.`;
    }
    const price = lotPrice(s, item, qty, "buy");
    if (s.gold < price) return `That costs ${price} gold. You have ${s.gold}.`;
    s.gold -= price; give(s, item, qty);
    if (econOn()) ECON.record(s.id, s.location, item, qty, t);
    const m = useSkill(s, "Mercantile", price);
    return `Bought ${D.ITEMS[item].name}${qty > 1 ? " ×" + qty : ""} for ${price} gold.` + (m.length ? " " + m.join(". ") : "");
  }
  function sell(s, id, qty = 1, t = now()) {
    if (!s.location || !shopTypes(s.location).length) return "There's no shop here.";
    if (typeof TOWNS !== "undefined" && TOWNS.wanted(s)) return "The merchant won't trade with a wanted criminal.";
    if (invRow(s, id)?.stolen && !(typeof TOWNS !== "undefined" && TOWNS.canFence(s))) return "\"That's stolen. I don't want it.\" You need a fence: the Ragged Flagon in Riften, or the Fence perk.";
    if (!shopsOpen(t) && !knockOk(s, t)) return `The shops are closed (${clockText(t)}).`;
    const r = invRow(s, id);
    if (!r || r.qty < qty) return "You don't have that.";
    if (D.ITEMS[r.item].noTrade) return `The ${D.ITEMS[r.item].name} is bound to you. No merchant will take it.`;
    const price = lotPrice(s, r.item, qty, "sell", r), name = D.ITEMS[r.item].name, item = r.item;
    const wasStolen = !!invRow(s, id)?.stolen;
    take(s, id, qty); s.gold += price;
    if (econOn()) ECON.record(s.id, s.location, item, -qty, t);
    const m = [...useSkill(s, "Mercantile", price), ...(wasStolen ? useSkill(s, "Streetwise", 8 + price / 10) : [])];   // [OURS] fencing teaches Streetwise
    return `Sold ${name} for ${price} gold.` + (m.length ? " " + m.join(". ") : "");
  }
  function readTome(s, id) {
    const r = invRow(s, id);
    if (!r || D.ITEMS[r.item].slot !== "tome") return "That's not a spell tome.";
    const sp = D.ITEMS[r.item].spell;
    if (s.spells.includes(sp)) return "You already know that spell.";
    take(s, id); s.spells.push(sp);
    return `You learned ${D.SPELLS[sp].name}. ${typeof MAGIC !== "undefined" && D.SPELLS[sp].kind === "utility" ? "Cast it from the Magic menu (Pack → Magic), outside fights." : "Add it to your tactics."}`;
  }
  function drinkPotion(s, t = now()) {
    const f = new Fight(s, { name: "-", health: 1, damage: 0 }), r = f.findPotion("health");
    if (!r) return "No healing potions.";
    const before = curHealth(s, t), it = D.ITEMS[r.item];
    take(s, r.id); setHealth(s, before + it.restore[1], t);
    return `${it.name}: ${Math.round(before)} → ${Math.round(curHealth(s, t))} health.`;
  }
  function recharge(s, wId, gId) {
    const w = invRow(s, wId), g = invRow(s, gId);
    if (!w || !(D.ITEMS[w.item].enchant || D.ITEMS[w.item].staff)) return "Pick an enchanted weapon or a staff.";
    if (!g || D.ITEMS[g.item].slot !== "soulgem") return "Pick a filled soul gem.";
    if (D.ITEMS[w.item].staff && w.charge == null) w.charge = D.ITEMS[w.item].staff.capacity;
    const cap = (D.ITEMS[w.item].enchant || D.ITEMS[w.item].staff).capacity, gem = D.ITEMS[g.item].charge * (P(s, "soul_squeezer") ? 1.5 : 1);
    w.charge = Math.min(cap, (w.charge || 0) + gem);
    take(s, gId);
    const m = useSkill(s, "Enchanting", F.RECHARGE_XP[gem] || 0.2);
    return `${D.ITEMS[w.item].name} recharged to ${Math.round(100 * w.charge / cap)}%.` + (m.length ? " " + m.join(". ") : "");
  }

  return {
    MAP_W, MAP_H, STEP_SECONDS, SLOTS, ARMOR_SLOTS, JEWEL_SLOTS, wornSlot, GAME_SPEED, now, pxDist, holdAt, clock, isNight, shopsOpen, clockText,
    P, wtype, fxSum, lockChance, lockRoll, setAllyProvider, hiddenChance, rested, haggle, SPELL_TIER, newSave, maxHealth, maxMagicka, maxStamina, curHealth, setHealth, skill, useSkill, levelUp, fightLevel,
    riding, withHorse, give, take, invRow, carried, capacity, overweight, equipment, equip, unequip, equipOff, canOffhand, countRestore, itemStats,
    loadout: lo, addRule, ruleSlot, deadRules, fixTactics, saveLoadoutAs, deleteLoadout, spellCost, describeRule, describeAction, Fight, scaleEnemy, scaleQuestFoe, questLevel, rollLoot,
    rollEncounter, die, speed, discoverRadius, startTrip, startEvent, eventChoices, eventChoice, buyFrom, minutesLeft, minutesTo, posAfter, advance, encounterAction, migrate, PLACES,
    spellDamage, spellHeal, spellArmor, spellSummon, spellCalm, dualCost, shopTypes, shopStock, buyPrice, sellPrice, lotPrice, buy, sell, readTome, drinkPotion, recharge, clone, note,
  };
})();
if (typeof module !== "undefined") module.exports = G;
