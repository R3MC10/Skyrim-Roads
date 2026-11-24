/* Charge bars (chargebar.js): enchanted weapons and staffs use charge per hit, stop when empty, recharge with a soul gem,
   old saves start full, Thrifty Runes uses less and refills on kills, and the bar/"no charge" HTML is right.
   W=/path/to/game/ node test_chargebar.js — prints "chargebar ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "chargebar.js"];
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let n = 0; const ok = (x, m) => { n++; if (!x) { console.error("FAIL " + m); process.exit(1); } };
// seeded random so fights are the same every run
let sx = 12345; c.Math.random = () => { sx ^= sx << 13; sx >>>= 0; sx ^= sx >> 17; sx ^= sx << 5; sx >>>= 0; return sx / 4294967296; };
vm.runInContext("var __t = 1;", c);
const { G, D, CHARGE, PERKS, PFX } = c;
ok(CHARGE, "CHARGE loaded");
const mk = () => { const s = G.newSave("cb", "Charge", "nord"); s._test = true; s.level = 30; s.location = "Whiterun"; [s.x, s.y] = c.WORLD.places.Whiterun; for (const k in s.skills) s.skills[k].lvl = 50; G.setHealth(s, G.maxHealth(s)); return s; };
const foe = (name, L) => G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === name) }, L);
const W1 = "ench|steel_sword|fire|10|300";

// 1. new weapons come full; info / text / html
{
  const s = mk(); const id = G.give(s, W1); const r = G.invRow(s, id); const it = D.ITEMS[W1];
  ok(r.charge === it.enchant.capacity, "new enchanted weapon is full");
  const x = CHARGE.info(W1, r, s);
  ok(x && x.pct === 1 && !x.empty && x.hits > 0, "info: full, has hits " + JSON.stringify(x));
  ok(CHARGE.info("steel_sword", null) === null, "plain sword has no charge");
  ok(CHARGE.info("potion_health", null) === null, "potion has no charge");
  ok(/class="cbar"/.test(CHARGE.bar(W1, r, s)) && /width:100\.0%/.test(CHARGE.bar(W1, r, s)), "full bar html");
  ok(CHARGE.tag(W1, r, s) === "", "no tag when charged");
  ok(/charge 100%/.test(CHARGE.text(W1, r, s)), "text says 100%");
  ok(/100%/.test(CHARGE.inline(W1, r, s)), "inline shows percent");
  ok(/Charge/.test(CHARGE.detail(W1, r, s)) && /hits? left/.test(CHARGE.detail(W1, r, s)), "detail card");
  ok(CHARGE.info(W1, null).pct === 1, "a shop item (no row) shows full");
}
// 2. hits use charge, the enchantment stops when empty
{
  const s = mk(); const id = G.give(s, W1); G.equip(s, id);
  const r = G.invRow(s, id), cap = D.ITEMS[W1].enchant.capacity;
  let fired = 0, plain = 0;
  for (let i = 0; i < 60; i++) {
    const f = new G.Fight(s, foe("Bandit outlaw", 20)); f.turn = 1;
    const before = f.charges[id] ?? r.charge;
    f.attack(false);
    const after = f.charges[id] ?? r.charge;
    if (after < before) fired++; else plain++;
    r.charge = after;   // carry over like apply() would
  }
  ok(fired > 0, "hits used charge (" + fired + ")");
  ok(r.charge < cap, "charge went down " + r.charge + "/" + cap);
  const x = CHARGE.info(W1, r, s);
  ok(x.empty, "after many hits the weapon is empty (" + r.charge.toFixed(1) + ", per hit " + x.per.toFixed(1) + ")");
  ok(plain > 0, "once empty, hits stop using charge");
  // empty: no fire bonus
  const f = new G.Fight(s, foe("Bandit outlaw", 20)); f.turn = 1; const ch0 = r.charge; f.attack(false);
  ok((f.charges[id] ?? r.charge) === ch0, "empty weapon: no charge used");
  ok(/no charge/.test(CHARGE.tag(W1, r, s)), "tag says no charge");
  ok(/cb-empty/.test(CHARGE.bar(W1, r, s)), "bar turns red when empty");
  ok(CHARGE.text(W1, r, s) === "no charge", "text says no charge");
  ok(/cb-empty/.test(CHARGE.fightBar(f)) && /no charge/.test(CHARGE.fightBar(f)), "fight meter shows empty");
  // 3. recharge with a filled soul gem
  const gid = G.give(s, "soulgem_grand" in D.ITEMS ? "soulgem_grand" : Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "soulgem"));
  const msg = G.recharge(s, id, typeof gid === "number" ? gid : s.inv.find((q) => D.ITEMS[q.item].slot === "soulgem").id);
  ok(/recharged/.test(msg), "recharge: " + msg);
  ok(!CHARGE.info(W1, r, s).empty && r.charge === cap, "recharged to full " + r.charge);
  const f2 = new G.Fight(s, foe("Bandit outlaw", 20)); ok(/width:100\.0%/.test(CHARGE.fightBar(f2)), "fight meter full again");
}
// 4. old saves: enchanted rows with no charge number start full; staffs are left alone (they come full anyway)
{
  const s = mk(); const id = G.give(s, W1); G.invRow(s, id).charge = null;
  const sid = G.give(s, "staff_flames"); const sr = G.invRow(s, sid); sr.charge = null;
  s.folData = { lydia: { inv: [{ id: 1, item: W1, qty: 1, charge: null }] } };
  const fixed = CHARGE.migrate(s);
  ok(fixed === 2, "migrate fixed 2 rows (" + fixed + ")");
  ok(G.invRow(s, id).charge === D.ITEMS[W1].enchant.capacity, "old weapon full");
  ok(s.folData.lydia.inv[0].charge === D.ITEMS[W1].enchant.capacity, "follower's weapon full");
  ok(CHARGE.info("staff_flames", sr, s).pct === 1, "staff with no number reads full");
  ok(CHARGE.migrate(s) === 0, "migrate runs once");
}
// 5. staffs: casts use charge, empty staff says so
{
  const s = mk(); const sid = G.give(s, "staff_flames"); const sr = G.invRow(s, sid), st = D.ITEMS.staff_flames.staff;
  sr.charge = st.perCast * 0.5;
  ok(CHARGE.info("staff_flames", sr, s).empty, "staff below one cast is empty");
  sr.charge = st.perCast * 3;
  ok(CHARGE.info("staff_flames", sr, s).hits === 3, "staff: 3 casts left");
}
// 6. Thrifty Runes: real effect (less charge per hit, refills on kills), old ids kept
{
  ok(PERKS.BY_ID.thrifty_runes && PERKS.BY_ID.thrifty_runes.skill === "Enchanting", "Thrifty Runes in the Enchanting tree");
  for (const id of ["enchanter", "soul_squeezer", "soul_siphon", "deep_charge", "rune_smith"]) ok(PERKS.BY_ID[id], "old perk kept: " + id);
  const s = mk(); const per0 = CHARGE.cost(s, D.ITEMS[W1]);
  s.perks = { enchanter: 1, soul_squeezer: 1, thrifty_runes: 1 };
  const per1 = CHARGE.cost(s, D.ITEMS[W1]);
  ok(Math.abs(per1 / per0 - 0.9 * 0.8) < 1e-6, "Enchanter 1 + Thrifty Runes: 72% of the charge (" + (per1 / per0).toFixed(3) + ")");
  ok(Math.abs(CHARGE.costMult(s) - 0.8) < 1e-9, "costMult 0.8");
  ok(Math.abs(PFX.num(s, "siphon") - 0.03) < 1e-9, "kills put 3% back");
  // the engine uses the same cost
  const id = G.give(s, W1); G.equip(s, id); const r = G.invRow(s, id); const cap = r.charge;
  let used = 0, k = 0;
  while (k < 40) { const f = new G.Fight(s, foe("Bandit outlaw", 20)); f.turn = 1; const b = f.charges[id] ?? r.charge; f.attack(false); const a = f.charges[id] ?? r.charge; if (a < b) { used = b - a; break; } k++; }
  ok(Math.abs(used - per1) < 1e-6, "engine hit uses the perk's cost (" + used.toFixed(2) + " vs " + per1.toFixed(2) + ")");
  // refills on a kill
  r.charge = cap * 0.5;
  const f = new G.Fight(s, foe("Mudcrab", 1)); f.charges[id] = cap * 0.5; f.won = true; f.ehp = 0; f.apply();
  ok(r.charge > cap * 0.5 + cap * 0.029, "a kill refilled charge (" + (r.charge / cap).toFixed(3) + ")");
}
// 7. icons get the bar
{
  c.ICONART = { item: (id, size) => `<img class="art ico" width="${size}">` };
  CHARGE.wrapIcons();
  ok(/cb-ico/.test(c.ICONART.item(W1, 34, null)) && /cbar/.test(c.ICONART.item(W1, 34, null)), "icon of an enchanted weapon gets a bar");
  ok(!/cbar/.test(c.ICONART.item("steel_sword", 34, null)), "plain sword icon unchanged");
  ok(/cb-empty/.test(c.ICONART.item(W1, 34, { item: W1, charge: 0 })), "empty weapon icon: red bar");
  ok(/cbar/.test(c.ICONART.item("staff_flames", 24, null)), "staff icon gets a bar");
}
console.log("chargebar ok · " + n + " checks");
