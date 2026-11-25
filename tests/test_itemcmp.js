const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* itemcmp.js: an item against what you wear (Items side panel, tooltip, phone sheet). W=/path/to/game/ node test_itemcmp.js — prints "itemcmp ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "spellcraft.js", "colorcode.js", "skillinfo.js", "jewelry.js", "itemcmp.js", "tooltip.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL", m); } };
const text = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
const s = G.newSave("ic", "Cmp", "nord"); s._test = true; s.level = 5;
TIP.state = () => s;
const lo = G.loadout(s).equipment; for (const k of Object.keys(lo)) delete lo[k];
const iron = G.give(s, "iron_sword"), steel = G.give(s, "steel_sword");
const rowOf = (id) => s.inv.find((r) => r.id === id);
// nothing worn
ok(/Nothing worn there yet/.test(ITEMCMP.html(s, rowOf(steel))), "an empty hand says nothing is worn");
G.equip(s, iron);
const d = ITEMCMP.data(s, rowOf(steel));
ok(d && !d.wearing && d.names[0] === "Iron Sword", "steel compares against the worn iron sword " + JSON.stringify(d));
const dmg = d.rows.find((r) => r[0] === "Damage");
ok(dmg && dmg[1] === ITEMCMP.hits(s, "iron_sword") && dmg[2] === ITEMCMP.hits(s, "steel_sword"), "damage uses the with-skill-and-perks number");
ok(dmg[2] - dmg[1] === 1, "iron 7 → steel 8 is +1 at a low skill " + dmg);
const h = ITEMCMP.html(s, rowOf(steel)); const t = text(h);
ok(/Against what you wear: Iron Sword/.test(t) && /\\(\\+1\\)/.test(t), "the block reads 'Against what you wear: Iron Sword' and +1: " + t);
const cls = (k) => (h.match(new RegExp('class="ic-r ([^"]*)"><span>' + k)) || [])[1] || "";
ok(/ic-up/.test(cls("Damage")), "more damage is green");
ok(/ic-dn/.test(cls("Weight")), "more weight is red");
ok(/ic-up/.test(cls("Value")), "more value is green");
ok(/Value/.test(t) && /25 → 45/.test(t), "value 25 → 45: " + t);
ok(/wearing this/.test(ITEMCMP.html(s, rowOf(iron))), "the worn sword says so");
// the tooltip uses the same block
ok(/Against what you wear/.test(TIP.html("inv:" + steel)), "the tooltip / phone sheet has the compare block");
ok(/Against what you wear/.test(TIP.html("item:steel_sword")), "a shop item compares too");
// two-handed: both hands
const sh = G.give(s, "hide_shield"); G.equip(s, sh);
const gs = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "weapon" && D.ITEMS[k].hands === 2 && !D.ITEMS[k].staff && !D.ITEMS[k].enchant && D.ITEMS[k].skill === "Two-Handed");
const two = G.give(s, gs), d2 = ITEMCMP.data(s, rowOf(two));
ok(d2.names.length === 2 && d2.names.includes("Hide Shield"), "a two-hander compares against both hands " + d2.names);
ok(d2.rows.some((r) => r[0] === "Armor" && r[2] === 0 && r[1] > 0), "and shows the shield's armour going");
ok(d2.rows.find((r) => r[0] === "Weight")[1] === +(D.ITEMS.iron_sword.weight + D.ITEMS.hide_shield.weight).toFixed(2), "weights of both hands add up");
// armour and rings
const helm = G.give(s, "iron_helmet"); ok(/Nothing worn there yet/.test(ITEMCMP.html(s, rowOf(helm))), "an empty head slot");
const ringIds = Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].slot === "ring").slice(0, 3);
const r1 = G.give(s, ringIds[0]); ok(/Nothing worn there yet/.test(ITEMCMP.html(s, rowOf(r1))), "a free finger counts as nothing worn");
G.equip(s, r1); const r2 = G.give(s, ringIds[1]); G.equip(s, r2); const r3 = G.give(s, ringIds[2]);
ok(/Against what you wear/.test(ITEMCMP.html(s, rowOf(r3))), "a third ring compares against a worn ring");
ok(ITEMCMP.data(s, rowOf(G.give(s, "potion_health"))) === null, "potions don't compare");
// every wearable item: clean html
for (const k of Object.keys(D.ITEMS)) if (G.SLOTS.includes(D.ITEMS[k].slot)) { const x = ITEMCMP.html(s, { id: null, item: k }); ok(!/undefined|NaN/.test(x), k + " clean: " + x); }
console.log(fails ? fails + "/" + n + " FAILED" : "itemcmp ok (" + n + " checks)");
process.exitCode = fails ? 1 : 0;
`, c);
