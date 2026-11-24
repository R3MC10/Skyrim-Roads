/* Homestead rooms: the house grows room by room (homestead.js keeps deeds, gathering, the workbench and the wings).
   [OURS, Hearthfire-inspired]
   - Two rooms that don't use a wing space: the Garden (six beds you plant from your pack; each bed gives 2 a day)
     and the Cellar (dug under the main hall: 40 things safe from death and raiders, goods keep a day longer).
   - Rooms are working stations: the Armory is a forge (make, smelt and improve gear at home), the Alchemy lab brews
     10% stronger potions, the Enchanter's tower is an arcane enchanter that makes enchantments 10% stronger.
     The main hall's hearth makes your own bed Well Rested +15% (not +10%); a kitchen's breakfast makes it last half
     again as long.
   - Display cases: 2 in the main hall, 4 more in a trophy room. Things on show are safe, visitors see them, and every
     piece on show earns visitors' gold each day.
   - Followers can live there (up to 3 once the main hall stands): they help gather (logs and stone every day) and
     defend the house. Fetch them back any time for free.
   - Raids: every few in-game days raiders (bandits; vampires by the marsh; frost trolls on the coast) come for the
     house. Defend it (a real fight; your steward and residents fight beside you; they get knocked down, never
     killed), talk them down (Speechcraft), or leave it to your household. Lose and they carry off some materials
     and the goods waiting in the wings. Storage room and cellar are never touched.
   - Party members can visit their leader's homestead: look around, rest in the guest bed, eat at the kitchen table.
   - Perks (perkfx.js): Master Builder and Hearth Forge (Smithing), Gracious Host and Call to Arms (Speechcraft).
   Lives in s.homestead[plotId] next to homestead.js's fields: rooms, beds, cellar, cases, res, raid, raidAt, xcol. */
const HSROOMS = (() => {
  const DAY = 2 * 3600;
  const CELLAR_CAP = 40, BEDS = 6, RES_MAX = 3;
  const RAID_GAP = [3, 5];               // [OURS] in-game days between raids
  const BAND = { hp: 1.8, dmg: 1.3 };    // [OURS] a raid is a whole band, tougher than one foe off the road (balance sim in tests/test_hsrooms.js)
  const ROOMS = {
    garden: ["Garden", "Six fenced beds. Plant herbs or vegetables from your pack: every in-game day each bed gives 2 of what grows in it (Green Thumb doubles it).",
      { log: 8, stone: 4, clay: 6, nails: 20, fittings: 2 }, "small"],
    cellar: ["Cellar", "Dug under the main hall. Keeps 40 things safe even if you die, raiders never find it, and the wings and garden keep goods a day longer.",
      { log: 12, stone: 24, clay: 8, nails: 20, hinge: 2, lock: 1, fittings: 4 }, "hall"],
  };
  // what each wing does as a station (shown on the build list and the Home tab)
  const STATION = { armory: "A forge at home: make, smelt and improve gear here.", alchemy: "An alchemy lab at home: potions you brew here are 10% stronger.",
    enchanter: "An arcane enchanter at home: enchantments you make here are 10% stronger.", kitchen: "Breakfast in bed: Well Rested lasts half again as long.",
    trophy: "Four more display cases.", storage: "", library: "", greenhouse: "" };
  const PLANTS = ["ing_blue_flower", "ing_lavender", "ing_snowberries", "ing_juniper", "ing_deathbell", "ing_nightshade", "ing_dragons_tongue", "ing_frost_mirriam", "ing_canis_root",
    "ing_creep_cluster", "ing_thistle", "ing_tundra_cotton", "ing_purple_flower", "ing_red_flower", "ing_wheat", "ing_garlic", "ing_imp_stool", "ing_glowing_mushroom", "ing_elves_ear",
    "food_potato", "food_leek", "food_cabbage", "food_carrot", "food_tomato"];
  const PCOL = { blue: "#4f78b0", lavender: "#9a7ac0", snowberries: "#e9eef2", juniper: "#3f5f8f", deathbell: "#6f8fb0", nightshade: "#6a3f7a", dragons: "#d9862b", mirriam: "#c9e0e8",
    canis: "#c9b07a", creep: "#7f6f55", thistle: "#9b6fb0", cotton: "#f2efe6", purple: "#8a4fa0", red: "#c0403a", wheat: "#d9b85a", garlic: "#ece3cf", imp: "#c96a3a",
    glowing: "#7fd0c0", elves: "#c9b58a", potato: "#a6895a", leek: "#7fae5a", cabbage: "#8fc06a", carrot: "#e0782f", tomato: "#d0402f" };
  const plantCol = (id) => { for (const [k, c] of Object.entries(PCOL)) if (String(id).includes(k)) return c; return "#6a9a4a"; };
  // raiders by the lie of the land: [name, health, damage, tags, level, loot]
  const RAIDERS = {
    bandits: ["Bandit raiders", 85, 15, ["humanoid"], 8, [["mat_iron", 2], ["arrow_iron", 10]], "Bandits with torches are coming up the path"],
    vampires: ["Vampire raiders", 105, 16, ["undead", "humanoid"], 12, [["soul_gem_common", 1], ["ing_bone_meal", 2]], "Pale shapes come out of the fog: vampires, hungry"],
    trolls: ["Frost troll raiders", 100, 17, ["beast", "big", "troll"], 14, [["ing_troll_fat", 2]], "Two frost trolls are smashing at the fence"],
  };
  const LOOK_RAID = { lake: "bandits", marsh: "vampires", coast: "trolls" };

  const HS = () => HOMESTEAD;
  const fx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) || 0 : 0);
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const itemName = (id) => D.ITEMS[id]?.name || id;
  const count = (s, item) => s.inv.filter((r) => r.item === item).reduce((a, r) => a + r.qty, 0);
  const worn = (s, r) => Object.values(G.equipment(s) || {}).some((x) => x && x.id === r.id);

  // ---------------------------------------------------------------- ui hooks (ui.js mounts these; node tests can too)
  let ctx = { party: () => null, homes: () => [] };
  function mount(o) { ctx = { ...ctx, ...o }; }

  /* old saves: fill in the new fields */
  function norm(h) {
    if (!h) return h;
    if (!Array.isArray(h.rooms)) h.rooms = [];
    if (!Array.isArray(h.beds)) h.beds = Array(BEDS).fill(null);
    if (!Array.isArray(h.cellar)) h.cellar = [];
    if (!Array.isArray(h.cases)) h.cases = [];
    if (!Array.isArray(h.res)) h.res = [];
    if (!h.xcol) h.xcol = {};
    if (!h.raids) h.raids = { won: 0, lost: 0 };
    return h;
  }
  const plotHere = (s) => { const pid = HS().BY_TOWN[s.location]; const h = pid && HS().plot(s, pid); return h ? [pid, norm(h)] : [null, null]; };
  const has = (h, room) => !!h && ((h.wings || []).includes(room) || (h.rooms || []).includes(room));
  const slots = (s) => HS().WING_SLOTS + Math.min(1, Math.floor(fx(s, "hsslot")));
  const casesCap = (h) => (h?.hall ? 2 : 0) + (has(h, "trophy") ? 4 : 0);

  // ---------------------------------------------------------------- stations
  const WING_OF = { forge: "armory", alchemy: "alchemy", enchanter: "enchanter" };
  /* are you at your homestead and does it have this station? (forge / alchemy / enchanter) */
  function station(s, kind) {
    if (!s || s.trip) return false;
    const [, h] = plotHere(s);
    return has(h, WING_OF[kind]);
  }
  /* strength bonus for brewing ("alch") or enchanting ("ench") at your own station */
  const bonus = (s, kind) => (kind === "alch" && station(s, "alchemy")) || (kind === "ench" && station(s, "enchanter")) ? 0.1 : 0;
  /* extra improvement per hammer at your own armory (Hearth Forge) */
  const temperBonus = (s) => (station(s, "forge") ? Math.min(1, Math.floor(fx(s, "hsforge"))) : 0);

  /* your own bed: the main hall's hearth makes it +15%, a kitchen breakfast makes it last 1.5× */
  const restOf = (h) => ({ bonus: h?.hall ? 0.15 : 0.1, mult: has(h, "kitchen") ? 1.5 : 1 });

  // ---------------------------------------------------------------- building rooms
  function canBuild(s, pid, what) {
    const h = norm(HS().plot(s, pid)); if (!h) return "You don't own this land.";
    const r = ROOMS[what]; if (!r) return "You can't build that.";
    if (h.rooms.includes(what)) return `The ${r[0].toLowerCase()} is already built.`;
    if (r[3] === "hall" && !h.hall) return "The cellar goes under the main hall. Build it first.";
    if (r[3] === "small" && !h.small) return "Build the small house first.";
    return null;
  }

  // ---------------------------------------------------------------- the garden
  function plant(s, pid, bed, rowId) {
    const h = norm(HS().plot(s, pid)); if (!has(h, "garden")) return { err: "Build a garden first." };
    bed = bed | 0; if (bed < 0 || bed >= BEDS) return { err: "There's no such bed." };
    const r = G.invRow(s, rowId); if (!r || !PLANTS.includes(r.item)) return { err: "That won't grow. Plant herbs, flowers, mushrooms or vegetables." };
    G.take(s, rowId, 1);
    const was = h.beds[bed]; h.beds[bed] = { item: r.item };
    if (!h.xcol.garden) h.xcol.garden = now();
    const sk = G.useSkill(s, "Alchemy", 3);
    return { text: `You plant ${itemName(r.item)} in bed ${bed + 1}${was ? ` (instead of ${itemName(was.item)})` : ""}. It gives 2 a day.${sk.length ? " " + sk.join(". ") + "." : ""}`, fx: "click" };
  }
  function uproot(s, pid, bed) {
    const h = norm(HS().plot(s, pid)); if (!h?.beds?.[bed]) return { err: "Nothing grows there." };
    const was = h.beds[bed]; h.beds[bed] = null;
    return { text: `You dig up the ${itemName(was.item)}. The bed is empty.`, fx: "click" };
  }

  // ---------------------------------------------------------------- the cellar
  function cellarPut(s, pid, rowId) {
    const h = norm(HS().plot(s, pid)); if (!has(h, "cellar")) return { err: "Dig a cellar first." };
    const r = G.invRow(s, rowId); if (!r) return { err: "You don't have that." };
    if (worn(s, r)) return { err: "Take it off first." };
    if (h.cellar.length >= CELLAR_CAP) return { err: `The cellar is full (${CELLAR_CAP}).` };
    const copy = { ...r }; delete copy.id; G.take(s, rowId, r.qty); h.cellar.push(copy);
    return { text: `${itemName(copy.item)}${copy.qty > 1 ? ` ×${copy.qty}` : ""} goes down to the cellar.`, fx: "click" };
  }
  function giveBack(s, r) {
    const id = G.give(s, r.item, r.qty, r.charge), row = G.invRow(s, id);
    if (row && (r.temper || r.stolen || r.nm)) Object.assign(row, { temper: r.temper, tq: r.tq, stolen: r.stolen, ...(r.nm ? { nm: r.nm } : {}) });
  }
  function cellarTake(s, pid, idx) {
    const h = norm(HS().plot(s, pid)), r = h?.cellar?.[idx]; if (!r) return { err: "It's not there." };
    h.cellar.splice(idx, 1); giveBack(s, r);
    return { text: `You bring up ${itemName(r.item)}${r.qty > 1 ? ` ×${r.qty}` : ""}.`, fx: "click" };
  }

  // ---------------------------------------------------------------- display cases
  const caseGold = (s, r) => Math.round(Math.min(25, 5 + Math.floor((D.ITEMS[r.item]?.value || 0) / 200)) * (1 + Math.min(1, fx(s, "hshost"))));
  function show(s, pid, rowId) {
    const h = norm(HS().plot(s, pid)), cap = casesCap(h);
    if (!cap) return { err: "Display cases stand in the main hall. Build it first." };
    if (h.cases.length >= cap) return { err: `All ${cap} display cases are full.${has(h, "trophy") ? "" : " A trophy room adds 4 more."}` };
    const r = G.invRow(s, rowId); if (!r) return { err: "You don't have that." };
    if (worn(s, r)) return { err: "Take it off first." };
    const it = D.ITEMS[r.item]; if (!it || !(it.slot === "weapon" || G.ARMOR_SLOTS.includes(it.slot) || /^gem_|dragon|mask|claw|jewel|ring|necklace/.test(r.item) || it.value >= 100)) return { err: "Visitors want to see weapons, armor, gems and trophies." };
    const copy = { ...r, qty: 1 }; delete copy.id; G.take(s, rowId, 1); h.cases.push(copy);
    if (!h.xcol.cases) h.xcol.cases = now();
    return { text: `${itemName(copy.item)} goes in a display case. Visitors pay ${caseGold(s, copy)} gold a day to see it.`, fx: "click" };
  }
  function unshow(s, pid, idx) {
    const h = norm(HS().plot(s, pid)), r = h?.cases?.[idx]; if (!r) return { err: "That case is empty." };
    h.cases.splice(idx, 1); giveBack(s, r);
    return { text: `You take ${itemName(r.item)} out of its case.`, fx: "click" };
  }

  // ---------------------------------------------------------------- followers who live there
  const FOL = (id) => (typeof TOWNS !== "undefined" ? TOWNS.FOLLOWERS[id] : null);
  const isSteward = (id) => String(id).startsWith("hs_");
  function livesAt(s, id) { for (const pid of HS().owned(s)) if ((HS().plot(s, pid).res || []).some((r) => r.id === id)) return pid; return null; }
  function moveIn(s, pid, t = now()) {
    const h = norm(HS().plot(s, pid)); if (!h) return { err: "You don't own this land." };
    if (!h.hall) return { err: "Followers need room to live: build the main hall first." };
    if (!s.follower) return { err: "No one is following you." };
    const id = s.follower.id, f = FOL(id); if (!f) return { err: "They won't settle down." };
    if (isSteward(id)) return { err: "Your steward already has a home: send them back with the Steward tab." };
    if (h.res.length >= RES_MAX) return { err: `The house sleeps ${RES_MAX} besides you and your steward.` };
    h.res.push({ id, t }); s.follower = null;
    if (!h.xcol.help) h.xcol.help = t;
    return { text: `${f[0]} drops their pack by the hearth at ${HS().PLOTS[pid].name}. They'll chop wood, haul stone and help hold the house.`, fx: "click" };
  }
  function callOut(s, pid, idx, t = now()) {
    const h = norm(HS().plot(s, pid)), r = h?.res?.[idx]; if (!r) return { err: "They don't live here." };
    if (s.follower) return { err: `${FOL(s.follower.id)?.[0] || "Someone"} is already with you. Leave them here first.` };
    h.res.splice(idx, 1);
    s.follower = { id: r.id, hp: TOWNS.followerMax(s, r.id), ts: t };
    return { text: `${FOL(r.id)?.[0] || "They"} picks up their weapon and follows you. No fee: they live with you.`, fx: "click" };
  }

  // ---------------------------------------------------------------- daily extras, collected with the wings
  /* days waiting in the garden / cases / residents' help (same cap as the wings) */
  function extraReady(s, pid, t = now()) {
    const h = norm(HS().plot(s, pid)), cap = HS().keepDays(s, pid), out = {};
    if (!h) return out;
    if (has(h, "garden") && h.beds.some(Boolean) && h.xcol.garden) out.garden = Math.min(cap, Math.floor((t - h.xcol.garden) / DAY));
    if (h.cases.length && h.xcol.cases) out.cases = Math.min(cap, Math.floor((t - h.xcol.cases) / DAY));
    if (h.res.length && h.xcol.help) out.help = Math.min(cap, Math.floor((t - h.xcol.help) / DAY));
    if (h.spoils) out.spoils = 1;
    return out;
  }
  /* collect them: adds items to got{}, returns { gold, lines } */
  function collectExtra(s, pid, t, got) {
    const h = norm(HS().plot(s, pid)), rd = extraReady(s, pid, t), lines = []; let gold = 0;
    const roll = (k, days) => { const raw = Math.floor((t - h.xcol[k]) / DAY); h.xcol[k] = raw > days ? t - ((t - h.xcol[k]) % DAY) : h.xcol[k] + days * DAY; };
    if (rd.garden > 0) {
      const k = G.P(s, "green_thumb") ? 2 : 1;
      for (const b of h.beds) if (b && D.ITEMS[b.item]) got[b.item] = (got[b.item] || 0) + 2 * k * rd.garden;
      roll("garden", rd.garden);
    }
    if (rd.cases > 0) { gold += h.cases.reduce((a, r) => a + caseGold(s, r), 0) * rd.cases; roll("cases", rd.cases); }
    if (rd.help > 0) {
      const n = h.res.length * rd.help; h.stock.log = (h.stock.log || 0) + 3 * n; h.stock.stone = (h.stock.stone || 0) + 2 * n;
      lines.push(`your household brought in ${3 * n} logs and ${2 * n} stone`); roll("help", rd.help);
    }
    if (h.spoils) { gold += h.spoils; lines.push(`${h.spoils} gold your household took off the raiders`); h.spoils = 0; }
    return { gold, lines, any: Object.values(rd).some((d) => d > 0) };
  }

  // ---------------------------------------------------------------- raids
  const built = (h) => (h.small ? 1 : 0) + (h.hall ? 1 : 0) + (h.wings || []).length + (h.rooms || []).length;
  /* bring raids up to date: start one when it's due; if one waited a whole day, your household deals with it */
  function tick(s, pid, t = now()) {
    const h = norm(HS().plot(s, pid)); if (!h || !h.small) return null;
    if (!h.raidAt) { h.raidAt = t + rint(...RAID_GAP) * DAY; return null; }
    let msg = null;
    if (!h.raid && t >= h.raidAt) {
      const look = HS().PLOTS[pid].look, kind = Math.random() < 0.5 ? "bandits" : LOOK_RAID[look] || "bandits";
      h.raid = { kind, t: h.raidAt };
    }
    if (h.raid && t - h.raid.t >= DAY) msg = autoDefend(s, pid, h.raid.t + DAY);
    return msg;
  }
  function defenders(s, pid, t = now()) {
    const h = norm(HS().plot(s, pid)), out = [], k = (1 + 0.05 * ((s.level || 1) - 1)) * (1 + Math.min(0.5, fx(s, "hsdefend")));
    if (HS().stewardHome(s, pid)) { const st = HS().PLOTS[pid].steward; out.push({ name: st[0], dmg: st[2] * 0.55 * k, kind: "follower", home: true }); }
    for (const r of h.res) { const f = FOL(r.id); if (f) out.push({ name: f[0], dmg: f[4] * 0.55 * k, kind: f[6] || "follower", home: true }); }
    return out;
  }
  function foe(s, pid) {
    const h = norm(HS().plot(s, pid)), R = RAIDERS[h.raid?.kind] || RAIDERS.bandits, lvl = s.level || 1;
    const e = G.scaleEnemy({ name: R[0], health: R[1], damage: R[2], tags: [...R[3]], level: R[4], danger: "medium", gold: [0, 0], text: R[6] }, lvl);
    const grow = Math.min(1.6, 1 + 0.06 * built(h));   // [OURS] a bigger house draws a bigger band
    e.health = Math.round(e.health * grow * BAND.hp); e.hp = e.health; e.damage = Math.round(e.damage * (1 + (grow - 1) / 2) * BAND.dmg * 10) / 10;
    return e;
  }
  const nextRaid = (h, t) => { h.raid = null; h.raidAt = t + rint(...RAID_GAP) * DAY; };
  const raidGold = (s, h) => 40 + 12 * (s.level || 1) + 10 * built(h);
  /* raiders win: they carry off a quarter of the building materials and whatever waits in the wings and garden */
  function plunder(s, pid, t) {
    const h = norm(HS().plot(s, pid)), took = [];
    for (const k of ["log", "stone", "clay", "quartz", "nails"]) { const n = Math.floor((h.stock[k] || 0) * 0.25); if (n > 0) { h.stock[k] -= n; took.push(`${n} ${HS().MATS[k][0].toLowerCase()}`); } }
    for (const w of h.wings || []) if (h.col[w] != null) h.col[w] = Math.max(h.col[w], t - (t - h.col[w]) % DAY);
    if (h.xcol.garden) h.xcol.garden = Math.max(h.xcol.garden, t - (t - h.xcol.garden) % DAY);
    h.raids.lost++;
    return took;
  }
  function autoDefend(s, pid, t) {
    const h = norm(HS().plot(s, pid)), d = defenders(s, pid, t).length, R = RAIDERS[h.raid.kind] || RAIDERS.bandits;
    const p = Math.min(0.9, 0.2 + 0.2 * d + Math.min(0.5, fx(s, "hsdefend")));
    if (Math.random() < p) {
      const g = Math.round(raidGold(s, h) * 0.5); h.spoils = (h.spoils || 0) + g; h.raids.won++; nextRaid(h, t);
      return h.last = `${R[0]} came while you were away. Your household drove them off and kept ${g} gold of theirs for you.`;
    }
    const took = plunder(s, pid, t); nextRaid(h, t);
    return h.last = `${R[0]} came while you were away${d ? " and got past your household" : " and nobody was home"}. They carried off ${took.join(", ") || "what was lying about"} and the goods waiting in the wings.`;
  }
  function defend(s, pid, t = now()) {
    const h = norm(HS().plot(s, pid)); if (!h?.raid) return { err: "No one is raiding the house." };
    if (s.location !== HS().PLOTS[pid].town) return { err: "Get to the homestead first." };
    const R = RAIDERS[h.raid.kind] || RAIDERS.bandits, e = foe(s, pid);
    const f = new G.Fight(s, e, null, t), allies = defenders(s, pid, t);
    for (const a of allies) f.allies.push(a);
    f.run({ t }); const skills = f.apply(t);
    if (f.won) {
      const gold = raidGold(s, h); s.gold += gold; const loot = [];
      for (const [id, n] of R[5]) if (D.ITEMS[id]) { G.give(s, id, n); loot.push(`${itemName(id)} ×${n}`); }
      h.raids.won++; nextRaid(h, t);
      G.note(s, `🏡 Drove ${R[0].toLowerCase()} off ${HS().PLOTS[pid].name}.`);
      return { title: "The house holds", text: `${R[0]} break and run${allies.length ? `, chased by ${allies.map((a) => a.name).join(" and ")}` : ""}. You take ${gold} gold${loot.length ? ", " + loot.join(", ") : ""} off them.`, fight: f, skills, loot, gold: 0 };
    }
    G.setHealth(s, Math.max(1, G.maxHealth(s) * 0.25), t);   // knocked down at your own door, not killed
    const took = plunder(s, pid, t); nextRaid(h, t);
    return { title: "Raided", text: `${R[0]} knock you down in your own yard and carry off ${took.join(", ") || "what they can grab"}. Your storage room and cellar are untouched.`, fight: f, skills, loot: [], gold: 0 };
  }
  function parley(s, pid, t = now()) {
    const h = norm(HS().plot(s, pid)); if (!h?.raid) return { err: "No one is raiding the house." };
    if (h.raid.talked) return { err: "They're done talking." };
    const R = RAIDERS[h.raid.kind] || RAIDERS.bandits;
    if (h.raid.kind === "trolls") return { err: "Frost trolls don't listen. Fight them." };
    h.raid.talked = true;
    const p = Math.min(0.85, 0.15 + G.skill(s, "Speechcraft") / 250 + Math.min(0.5, fx(s, "hsparley")) + 0.05 * defenders(s, pid, t).length);
    const sk = G.useSkill(s, "Speechcraft", 30);
    if (Math.random() < p) { nextRaid(h, t); return { title: "Talked down", text: `You stand in the doorway and talk. ${R[0]} decide this house isn't worth the blood and melt away.${sk.length ? " " + sk.join(". ") + "." : ""}` }; }
    return { text: `They laugh at you. Nothing for it now but to fight.${sk.length ? " " + sk.join(". ") + "." : ""}`, fx: "click" };
  }

  // ---------------------------------------------------------------- party visits
  /* what other players see about your homesteads (added to the "homes" record by visits.js) */
  function record(s) {
    const out = {};
    for (const pid of HS().owned(s)) {
      const h = norm(HS().plot(s, pid));
      out[pid] = { st: HS().stage(h), wings: [...(h.wings || [])], rooms: [...h.rooms], steward: !!h.steward && HS().stewardHome(s, pid),
        res: h.res.map((r) => FOL(r.id)?.[0]).filter(Boolean).slice(0, RES_MAX), cases: h.cases.slice(0, 6).map((r) => ({ item: r.item, name: itemName(r.item) })),
        beds: h.beds.map((b) => (b ? b.item : null)), host: fx(s, "hshost") > 0 ? 1 : 0, raided: !!h.raid };
    }
    return Object.keys(out).length ? out : null;
  }
  /* the party leader's homestead in this town, if you're a member: { d (their homes doc), pid, hs } */
  function leaderHome(s) {
    const p = ctx.party?.(), pid = HS().BY_TOWN[s.location];
    if (!p || !pid || p.leader === s.id || !p.members?.some((m) => m.id === s.id)) return null;
    const d = (ctx.homes?.() || []).find((x) => x.id === p.leader), hs = d?.hs?.[pid];
    return hs && typeof hs.st === "number" && hs.st >= 1 ? { d, pid, hs } : null;
  }
  function guestRest(s, t = now()) {
    const L = leaderHome(s); if (!L) return { err: "Your party leader doesn't have a house here." };
    G.setHealth(s, G.maxHealth(s), t); if (typeof WFX !== "undefined") WFX.warmUp(s, 100, t);
    const well = L.hs.st >= 2 || L.hs.host; s.rested = t + 8 * DAY / 24; s.restBonus = well ? 0.1 : 0.05;
    return { text: `You sleep in ${L.d.name}'s guest bed. Fully healed and ${well ? "Well Rested (+10%)" : "Rested (+5%)"}.`, fx: "click" };
  }
  function guestMeal(s, t = now()) {
    const L = leaderHome(s); if (!L) return { err: "Your party leader doesn't have a house here." };
    if (!L.hs.wings?.includes("kitchen")) return { err: `${L.d.name}'s house has no kitchen yet.` };
    s.hsGuest = s.hsGuest || {}; const last = s.hsGuest[L.d.id] || 0;
    if (t - last < DAY) return { err: `You've eaten at ${L.d.name}'s table today. Again in ${Math.ceil((last + DAY - t) / 60)} min.` };
    s.hsGuest[L.d.id] = t;
    const pool = ["dish_venison_stew", "dish_horker_stew", "dish_veg_soup", "dish_fish_soup"].filter((i) => D.ITEMS[i]), dish = pool[Math.floor(Math.random() * pool.length)] || "potion_stamina";
    G.give(s, dish, 1);
    return { text: `${L.d.name}'s kitchen sends you off with ${itemName(dish)}.`, fx: "coin" };
  }

  // ---------------------------------------------------------------- pictures (art.js)
  function person(g, H, x, y, coat = "#30505e", torch = false) {
    H.circle(g, x, y - 26, 4.5, "#d9b48c", "#3b2c1e", 1);
    H.poly(g, [[x - 6, y - 21], [x + 6, y - 21], [x + 8, y], [x - 8, y]], coat, "#3b2c1e", 1);
    if (torch) { g.strokeStyle = "#6f4f33"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 7, y - 12); g.lineTo(x + 11, y - 30); g.stroke(); H.circle(g, x + 11, y - 33, 4, "#f0a030", null); H.circle(g, x + 11, y - 34, 2, "#ffe08a", null); }
  }
  function troll(g, H, x, y) {
    H.poly(g, [[x - 11, y], [x - 13, y - 22], [x - 6, y - 34], [x + 6, y - 34], [x + 13, y - 22], [x + 11, y]], "#e6ecef", "#3b2c1e", 1.2);
    H.circle(g, x, y - 36, 6, "#d8e0e4", "#3b2c1e", 1); g.fillStyle = "#c0403a"; g.fillRect(x - 3, y - 38, 2, 2); g.fillRect(x + 1, y - 38, 2, 2);
  }
  function gardenArt(g, H, x, y, beds, ready) {
    g.fillStyle = "#5a4330"; g.fillRect(x, y, 88, 14);
    for (let i = 0; i < BEDS; i++) {
      const b = beds[i], bx = x + 3 + i * 14;
      g.fillStyle = "#4a3626"; g.fillRect(bx, y + 3, 12, 9);
      if (b) for (let k = 0; k < 3; k++) { const px = bx + 2 + k * 4; g.strokeStyle = "#3d5d36"; g.lineWidth = 1; g.beginPath(); g.moveTo(px, y + 9); g.lineTo(px, y + 4 - (ready ? 3 : 0)); g.stroke(); H.circle(g, px, y + 3 - (ready ? 3 : 0), ready ? 2.2 : 1.5, plantCol(b), null); }
    }
    g.strokeStyle = "#6f4f33"; g.lineWidth = 1.4;   // a low wattle fence
    g.beginPath(); g.moveTo(x - 2, y + 2); g.lineTo(x + 90, y + 2); g.stroke();
    for (let fx2 = x - 2; fx2 <= x + 90; fx2 += 11) { g.beginPath(); g.moveTo(fx2, y - 4); g.lineTo(fx2, y + 13); g.stroke(); }
  }
  function cellarDoor(g, H, x, y) {
    H.poly(g, [[x, y + 10], [x + 4, y], [x + 26, y], [x + 30, y + 10]], "#6f4f33", "#3b2c1e", 1.2);
    g.strokeStyle = "#3b2c1e"; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 15, y); g.lineTo(x + 15, y + 10); g.stroke();
    g.fillStyle = "#a9b0b4"; g.fillRect(x + 12, y + 4, 2, 2); g.fillRect(x + 16, y + 4, 2, 2);
  }
  /* drawn over the outside picture by homestead.js: garden, cellar doors, residents, a raid */
  function drawExtras(g, H, o) {
    const h = o.h; if (!h) return;
    const base = o.base;
    if ((h.rooms || []).includes("garden")) gardenArt(g, H, 6, base + 2, h.beds || [], !!o.ready);
    if ((h.rooms || []).includes("cellar")) cellarDoor(g, H, o.cx + 64, base - 2);
    const coats = ["#6a3f2a", "#3d5d36", "#5a4a7a"];
    (h.res || []).slice(0, RES_MAX).forEach((r, i) => person(g, H, o.cx - 30 - i * 14, base + 4, coats[i % 3]));
    if (h.raid) {
      const R = h.raid.kind;
      g.fillStyle = "rgba(160,40,20,.16)"; g.fillRect(0, 0, o.W, o.HT);
      g.strokeStyle = "rgba(60,60,60,.55)"; g.lineWidth = 5; g.beginPath(); g.moveTo(o.cx - 10, base - 60); g.quadraticCurveTo(o.cx + 10, base - 90, o.cx - 6, base - 120); g.stroke();
      for (let i = 0; i < 3; i++) { const x = o.W - 40 - i * 22, y = base + 8; if (R === "trolls") { if (i < 2) troll(g, H, x, y); } else person(g, H, x, y, R === "vampires" ? "#2a1f2a" : "#5a4330", true); }
    }
  }
  /* inside the house, cut open: rooms in a row above ground, the cellar below; grows as you build */
  const ROOMCOL = { hall: "#7a5232", armory: "#6f6a64", library: "#6a4a30", greenhouse: "#5f7f55", kitchen: "#8a6440", trophy: "#5a4330", enchanter: "#5a5070", alchemy: "#5a6a4a", storage: "#7a5a3c" };
  function roomArt(g, H, kind, x, y, w, hgt, h) {
    g.fillStyle = ROOMCOL[kind] || "#7a5232"; g.fillRect(x, y, w, hgt); g.strokeStyle = "#3b2c1e"; g.lineWidth = 1.5; g.strokeRect(x, y, w, hgt);
    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x, y + hgt - 6, w, 6);   // floorboards
    const cx = x + w / 2, fl = y + hgt - 6;
    if (kind === "hall") {   // hearth, long table, display cases
      g.fillStyle = "#4a4440"; g.fillRect(cx - 10, fl - 18, 20, 18); H.circle(g, cx, fl - 5, 5, "#f0a030", null); H.circle(g, cx, fl - 6, 2.5, "#ffe08a", null);
      g.fillStyle = "#5a4330"; g.fillRect(x + 6, fl - 7, w * 0.28, 3); g.fillRect(x + w - 6 - w * 0.28, fl - 7, w * 0.28, 3);
      (h.cases || []).slice(0, 2).forEach((r, i) => caseArt(g, H, i ? x + w - 16 : x + 4, fl - 26, r.item));
    } else if (kind === "armory") { g.fillStyle = "#3b2c1e"; g.fillRect(cx - 8, fl - 10, 16, 10); g.fillStyle = "#f0a030"; g.fillRect(cx - 5, fl - 8, 10, 3); g.strokeStyle = "#c9d0d4"; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + 5 + i * 5, fl - 2); g.lineTo(x + 5 + i * 5, fl - 22); g.stroke(); } }
    else if (kind === "alchemy") { g.fillStyle = "#4a4440"; g.fillRect(cx - 9, fl - 8, 18, 8); for (const [dx, c] of [[-5, "#8fd070"], [0, "#c05a5a"], [5, "#6a8fd0"]]) H.circle(g, cx + dx, fl - 11, 2.5, c, "#3b2c1e", 0.8); }
    else if (kind === "enchanter") { g.strokeStyle = "rgba(201,182,255,.95)"; g.lineWidth = 1.4; g.beginPath(); g.ellipse(cx, fl - 2, w * 0.3, 3, 0, 0, 7); g.stroke(); H.circle(g, cx, fl - 14, 3, "#c9b6ff", null); }
    else if (kind === "kitchen") { g.fillStyle = "#4a4440"; g.fillRect(cx - 8, fl - 12, 16, 12); H.circle(g, cx, fl - 14, 5, "#3b3b3b", "#3b2c1e", 1); g.strokeStyle = "rgba(235,235,235,.6)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, fl - 20); g.quadraticCurveTo(cx + 4, fl - 26, cx, fl - 32); g.stroke(); }
    else if (kind === "library") { for (let i = 0; i < 5; i++) { g.fillStyle = ["#8e2b25", "#30505e", "#3d5d36", "#d6b25e", "#6a3f7a"][i]; g.fillRect(x + 5 + i * 4, fl - 20, 3, 14); } g.fillStyle = "#5a4330"; g.fillRect(x + 4, fl - 6, 22, 2); }
    else if (kind === "greenhouse") { for (let i = 0; i < 4; i++) H.circle(g, x + 7 + i * (w - 14) / 3, fl - 5, 4, i % 2 ? "#557a47" : "#3d5d36", null); }
    else if (kind === "storage") { for (const dx of [6, 20]) { g.fillStyle = "#6f4f33"; g.fillRect(x + dx, fl - 11, 12, 11); g.strokeStyle = "#3b2c1e"; g.strokeRect(x + dx, fl - 11, 12, 11); } }
    else if (kind === "trophy") {
      g.strokeStyle = "#e9dcc0"; g.lineWidth = 1.6; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(cx, y + 14); g.quadraticCurveTo(cx + d * 7, y + 9, cx + d * 10, y + 4); g.stroke(); }
      (h.cases || []).slice(2, 6).forEach((r, i) => caseArt(g, H, x + 3 + i * ((w - 14) / 3), fl - 20, r.item));
    }
  }
  function caseArt(g, H, x, y, item) {
    g.fillStyle = "rgba(190,225,235,.5)"; g.fillRect(x, y, 12, 14); g.strokeStyle = "#d6b25e"; g.lineWidth = 1; g.strokeRect(x, y, 12, 14);
    const it = D.ITEMS[item] || {};
    if (it.slot === "weapon") { g.strokeStyle = "#c9d0d4"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + 3, y + 12); g.lineTo(x + 9, y + 2); g.stroke(); }
    else if (/^gem_|ring|necklace/.test(item)) H.circle(g, x + 6, y + 7, 3, "#c0403a", "#3b2c1e", 0.8);
    else H.poly(g, [[x + 3, y + 3], [x + 9, y + 3], [x + 10, y + 12], [x + 2, y + 12]], "#8f8a80", "#3b2c1e", 0.8);
  }
  function inside(pid, h, opts = {}) {
    if (typeof ART === "undefined") return "";
    h = norm(h); const W = 360, HT = 150, ground = 96;
    const wings = h.wings || [], rooms = h.rooms || [];
    const tl = (x) => (typeof I18N !== "undefined" && I18N.lang() === "pl" ? I18N.tr(x) || x : x);   // the label is drawn, so translate it here
    const key = `hsin|${tl("Inside the house")}|${pid}|${HS().stage(h)}|${wings.join(",")}|${rooms.join(",")}|${h.cases.map((r) => r.item).join(",")}|${h.res.length}|${h.cellar.length > 0 ? 1 : 0}|${opts.guest ? 1 : 0}`;
    return ART.html(W, HT, (g, H) => {
      g.fillStyle = "#c9d6d8"; g.fillRect(0, 0, W, ground); g.fillStyle = "#6f5741"; g.fillRect(0, ground, W, HT - ground);
      g.fillStyle = "rgba(0,0,0,.15)"; for (let i = 0; i < 40; i++) g.fillRect((i * 37) % W, ground + 6 + (i * 13) % (HT - ground - 8), 3, 2);
      const list = h.hall ? ["hall", ...wings] : h.small ? ["hall"] : [];
      if (!list.length) { g.strokeStyle = "#3b2c1e"; g.setLineDash([3, 3]); g.strokeRect(120, ground - 40, 120, 40); g.setLineDash([]); }
      const rw = list.length ? Math.min(90, (W - 20) / list.length) : 0, x0 = (W - rw * list.length) / 2;
      list.forEach((k, i) => {
        const x = x0 + i * rw, hgt = k === "hall" ? (h.hall ? 62 : 44) : 48;
        H.poly(g, [[x - 2, ground - hgt], [x + rw / 2, ground - hgt - 18], [x + rw + 2, ground - hgt]], "#5a4330", "#3b2c1e", 1.2);
        roomArt(g, H, k === "hall" && !h.hall ? "kitchen" : k, x, ground - hgt, rw, hgt, h);
        if (k === "hall") (h.res || []).slice(0, RES_MAX).forEach((_, j) => person(g, H, x + 14 + j * 12, ground - 6, ["#6a3f2a", "#3d5d36", "#5a4a7a"][j]));
      });
      if (rooms.includes("cellar")) {
        const cw = Math.min(200, rw * 2.2 || 160), cx = (W - cw) / 2;
        g.fillStyle = "#4a3a2c"; g.fillRect(cx, ground + 10, cw, 34); g.strokeStyle = "#3b2c1e"; g.lineWidth = 1.5; g.strokeRect(cx, ground + 10, cw, 34);
        for (let i = 0; i < Math.min(8, 2 + Math.ceil(h.cellar.length / 6)); i++) { const bx = cx + 8 + i * 22; H.circle(g, bx + 6, ground + 34, 7, "#7a5232", "#3b2c1e", 1); g.fillStyle = "#3b2c1e"; g.fillRect(bx, ground + 33, 12, 1.5); }
        g.strokeStyle = "#6f4f33"; g.lineWidth = 1.4; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(cx + cw - 20 + i * 3, ground + 10 + i * 7); g.lineTo(cx + cw - 8 + i * 3, ground + 10 + i * 7); g.stroke(); }
      }
      if (rooms.includes("garden")) gardenArt(g, H, 4, ground - 14, h.beds, false);
      g.fillStyle = "rgba(43,32,22,.8)"; g.fillRect(6, 6, 104, 16); g.fillStyle = "#e9d7a8"; g.font = "bold 11px Georgia, serif"; g.fillText(tl(opts.guest ? "Guest of the house" : "Inside the house"), 12, 18);
      g.strokeStyle = "#3b2c1e"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, HT - 3);
    }, { key, cls: "scene hsin", alt: `Inside: ${["nothing built", "small house", "main hall"][HS().stage(h)]}${wings.length ? ", " + wings.join(", ") : ""}${rooms.length ? ", " + rooms.join(", ") : ""}` });
  }
  function thumb(what) {
    return ART.html(64, 46, (g, H) => {
      H.sky(g, 64, 46, "day"); g.fillStyle = "#8c9a5a"; g.fillRect(0, 30, 64, 16);
      if (what === "garden") { g.save(); g.scale(0.62, 0.62); gardenArt(g, H, 6, 54, ["ing_lavender", "food_cabbage", "ing_red_flower", "food_carrot", "ing_blue_flower", "ing_wheat"], true); g.restore(); }
      else { g.fillStyle = "#6f5741"; g.fillRect(0, 30, 64, 16); cellarDoor(g, H, 17, 22); g.fillStyle = "#4a3a2c"; g.fillRect(8, 36, 48, 8); H.circle(g, 20, 40, 4, "#7a5232", "#3b2c1e", 1); H.circle(g, 44, 40, 4, "#7a5232", "#3b2c1e", 1); }
      g.strokeStyle = "#3b2c1e"; g.lineWidth = 2; g.strokeRect(1, 1, 62, 44);
    }, { key: "hsthumb|" + what, cls: "hsthumb", alt: ROOMS[what][0] });
  }

  // ---------------------------------------------------------------- screen parts (homestead.js calls these)
  const btn = (act, c, label, ok = true, cls = "") => `<button class="btn sm ${cls}" data-act="hsact" data-id="${act}" data-c="${c}" ${ok ? "" : "disabled"}>${label}</button>`;
  function raidHTML(s, pid, esc) {
    const h = norm(HS().plot(s, pid)); let out = "";
    if (h?.last) out += `<p class="sub hslast">${esc(h.last)}</p>`;
    if (!h?.raid) return out;
    const R = RAIDERS[h.raid.kind] || RAIDERS.bandits, d = defenders(s, pid);
    return out + `<div class="card hsraid"><h3>⚔ Raid on the house</h3><p class="sub">${esc(R[6])}. ${d.length ? `${esc(d.map((a) => a.name).join(", "))} will fight beside you.` : "Nobody else is home to help."}</p>
      <div class="hsbtns">${btn("defend", pid, "Defend the house", true, "danger")}${h.raid.kind !== "trolls" ? btn("parley", pid, "Talk them down", !h.raid.talked) : ""}</div>
      <p class="sub">Leave it and your household deals with it within a day. If the raiders win they take materials and the goods waiting in the wings.</p></div>`;
  }
  function gardenHTML(s, pid, esc) {
    const h = norm(HS().plot(s, pid));
    if (!has(h, "garden")) return `<p class="sub">No garden yet. Build one on the Build tab (it doesn't use a wing space).</p>`;
    const rd = extraReady(s, pid).garden || 0, seeds = s.inv.filter((r) => PLANTS.includes(r.item));
    let b = `<p class="sub" style="margin-top:0">Each planted bed gives 2 of its plant every in-game day${G.P(s, "green_thumb") ? " (4 with Green Thumb)" : ""}. Collect on the Home tab.${rd ? ` <b class="hsready">${rd} day${rd > 1 ? "s" : ""} ready</b>` : ""}</p>`;
    b += h.beds.map((bed, i) => `<div class="item"><div class="t">Bed ${i + 1}<span>${bed ? esc(itemName(bed.item)) : "Empty"}</span></div>${bed ? btn("uproot", i, "Dig up") : ""}</div>`).join("");
    b += `<h3 class="hsh">Plant</h3>${seeds.length ? seeds.slice(0, 20).map((r) => `<div class="item"><div class="t">${esc(itemName(r.item))} <small>×${r.qty}</small></div><div class="hsbtns">${h.beds.map((bed, i) => bed ? "" : btn("plant", `${i}:${r.id}`, `Bed ${i + 1}`)).filter(Boolean).slice(0, 2).join("") || `<span class="sub">All beds used</span>`}</div></div>`).join("") : `<p class="sub">Nothing to plant. Herbs, flowers, mushrooms and vegetables all grow here.</p>`}`;
    return b;
  }
  function homeHTML(s, pid, esc) {
    const h = norm(HS().plot(s, pid)); if (!h) return "";
    let b = "";
    const sta = ["armory", "alchemy", "enchanter", "kitchen"].filter((w) => has(h, w));
    if (sta.length) b += `<h3 class="hsh">Stations</h3>` + sta.map((w) => `<div class="item"><div class="t">${esc(HS().WINGS[w][0])}<span>${esc(STATION[w])}${w === "armory" && fx(s, "hsforge") ? " Hearth Forge: improving adds 1 more here." : ""}</span></div></div>`).join("");
    const cap = casesCap(h);
    if (cap) {
      const pack = s.inv.filter((r) => !worn(s, r) && (D.ITEMS[r.item]?.slot === "weapon" || G.ARMOR_SLOTS.includes(D.ITEMS[r.item]?.slot) || /^gem_/.test(r.item))).slice(0, 25);
      b += `<h3 class="hsh">Display cases · ${h.cases.length}/${cap}</h3><p class="sub" style="margin-top:0">Visitors pay to see what's on show (collect it with the wings). Party members see your cases when they visit.</p>`
        + h.cases.map((r, i) => `<div class="item">${typeof ICONART !== "undefined" ? ICONART.item(r.item, 30, r) : ""}<div class="t">${esc(itemName(r.item))}<span>${caseGold(s, r)} gold a day</span></div>${btn("unshow", i, "Take out")}</div>`).join("")
        + (h.cases.length < cap ? `<details><summary class="sub" style="cursor:pointer;min-height:36px">Put something on show</summary>${pack.map((r) => `<div class="item"><div class="t">${esc(itemName(r.item))}</div>${btn("show", r.id, "Show")}</div>`).join("") || `<p class="sub">No weapons, armor or gems in your pack.</p>`}</details>` : "");
    }
    if (has(h, "cellar")) {
      const pack = s.inv.filter((r) => !worn(s, r));
      b += `<h3 class="hsh">Cellar · ${h.cellar.length}/${CELLAR_CAP}</h3>`
        + (h.cellar.length ? h.cellar.map((r, i) => `<div class="item"><div class="t">${esc(itemName(r.item))}${r.qty > 1 ? ` ×${r.qty}` : ""}</div>${btn("cellartake", i, "Take")}</div>`).join("") : `<p class="sub">Empty and cool. Safe from death and from raiders.</p>`)
        + `<details><summary class="sub" style="cursor:pointer;min-height:36px">Take something down</summary>${pack.slice(0, 40).map((r) => `<div class="item"><div class="t">${esc(itemName(r.item))}${r.qty > 1 ? ` ×${r.qty}` : ""}</div>${btn("cellarput", r.id, "Store", h.cellar.length < CELLAR_CAP)}</div>`).join("") || `<p class="sub">Your pack is empty.</p>`}</details>`;
    }
    return b;
  }
  function householdHTML(s, pid, esc) {
    const h = norm(HS().plot(s, pid)), p = HS().PLOTS[pid];
    let b = `<p class="sub" style="margin-top:0">Followers can live here: up to ${RES_MAX} once the main hall stands. Every in-game day each one brings in 3 logs and 2 stone, and they fight beside you when raiders come. They get knocked down, never killed.</p>`;
    b += h.res.length ? h.res.map((r, i) => `<div class="item">${typeof NPCART !== "undefined" ? NPCART.follower(r.id, 40) : ""}<div class="t">${esc(FOL(r.id)?.[0] || r.id)}<span>${esc(FOL(r.id)?.[5] || "")}</span></div>${btn("callout", i, "Take along", !s.follower, "pri")}</div>`).join("") : `<p class="sub">Nobody lives here yet.</p>`;
    if (s.follower && !isSteward(s.follower.id)) b += btn("movein", pid, `${esc(FOL(s.follower.id)?.[0] || "Your follower")} moves in`, !!h.hall && h.res.length < RES_MAX, "pri") + (h.hall ? "" : `<p class="sub">Build the main hall first.</p>`);
    const d = defenders(s, pid);
    b += `<h3 class="hsh">Raids</h3><p class="sub" style="margin-top:0">Every few in-game days raiders come for ${esc(p.name)}. Defenders at home now: ${d.length ? esc(d.map((a) => a.name).join(", ")) : "nobody"}. Driven off ${h.raids.won} · lost ${h.raids.lost}.</p>`
      + (h.raid ? "" : h.raidAt && h.small ? `<p class="sub">All quiet for now.</p>` : `<p class="sub">Nobody bothers bare land. Raiders come once the house stands.</p>`);
    return b;
  }
  function guestHTML(s, esc) {
    const L = leaderHome(s); if (!L) return "";
    const { d, pid, hs } = L, fake = { small: 1, hall: hs.st >= 2 ? 1 : 0, wings: hs.wings || [], rooms: hs.rooms || [], stock: {}, steward: hs.steward, res: (hs.res || []).map((n) => ({ id: n })), cases: (hs.cases || []).filter((c) => D.ITEMS[c.item]), beds: (hs.beds || []).map((x) => (x && D.ITEMS[x] ? { item: x } : null)) };
    return `<div class="card hsguest"><h3>⚑ ${esc(d.name)}'s homestead</h3><p class="sub">Your party leader's house at ${esc(HS().PLOTS[pid].name)}. Come in.</p>${inside(pid, fake, { guest: true })}
      <p class="sub">${esc(["", "Small house", "Main hall"][hs.st] || "")}${fake.wings.length ? " · " + esc(fake.wings.map((w) => HS().WINGS[w]?.[0] || w).join(", ")) : ""}${fake.rooms.length ? " · " + esc(fake.rooms.map((r) => ROOMS[r]?.[0] || r).join(", ")) : ""}${hs.res?.length ? ` · living here: ${esc(hs.res.join(", "))}` : ""}</p>
      ${fake.cases.length ? `<p class="sub">On show: ${esc(fake.cases.map((c) => c.name || itemName(c.item)).join(", "))}</p>` : ""}${hs.raided ? `<p class="sub">⚔ Raiders are at the gate. Only ${esc(d.name)} can call the defence.</p>` : ""}
      <div class="hsbtns">${btn("guestrest", d.id, "Rest in the guest bed", true, "pri")}${fake.wings.includes("kitchen") ? btn("guestmeal", d.id, "Eat at the table") : ""}</div></div>`;
  }
  const VIEWS = [["garden", "Garden"], ["household", "Household"]];
  function viewHTML(s, pid, view, esc) { return view === "garden" ? gardenHTML(s, pid, esc) : view === "household" ? householdHTML(s, pid, esc) : ""; }

  /* actions homestead.js doesn't know */
  function act(s, pid, what, c, t = now()) {
    if (what === "guestrest") return guestRest(s, t);
    if (what === "guestmeal") return guestMeal(s, t);
    if (!pid) return { err: "You don't own land here." };
    switch (what) {
      case "plant": { const [b, r] = String(c).split(":"); return plant(s, pid, +b, +r); }
      case "uproot": return uproot(s, pid, +c);
      case "cellarput": return cellarPut(s, pid, +c);
      case "cellartake": return cellarTake(s, pid, +c);
      case "show": return show(s, pid, +c);
      case "unshow": return unshow(s, pid, +c);
      case "movein": return moveIn(s, pid, t);
      case "callout": return callOut(s, pid, +c, t);
      case "defend": return defend(s, pid, t);
      case "parley": return parley(s, pid, t);
    }
    return null;
  }

  return { ROOMS, STATION, PLANTS, RAIDERS, BAND, CELLAR_CAP, BEDS, RES_MAX, mount, norm, has, slots, casesCap, station, bonus, temperBonus, restOf, canBuild,
    plant, uproot, cellarPut, cellarTake, show, unshow, caseGold, livesAt, moveIn, callOut, extraReady, collectExtra, tick, defenders, foe, defend, parley, autoDefend,
    record, leaderHome, guestRest, guestMeal, drawExtras, inside, thumb, raidHTML, gardenHTML, homeHTML, householdHTML, guestHTML, VIEWS, viewHTML, act };
})();
