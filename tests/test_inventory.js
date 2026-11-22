const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Inventory helpers (invqol.js): Keep marks, junk, better/worse arrows, sorting, weight warning, confirms, undo last sale.
   W=/path/to/game/ node test_inventory.js — prints "inventory ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, setTimeout: () => 0, clearTimeout: () => {} };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "spellcraft.js", "coop.js", "combatai.js", "favwheel.js", "daedric.js", "explore.js", "economy.js", "market.js", "invqol.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL", m); } };
const NOON = (() => { let t = G.now(); while (!G.shopsOpen(t) || Math.floor(G.clock(t).hour) !== 12) t += 60; return t; })();
const mk = () => { const s = G.newSave("iq" + Math.random(), "Inv", "nord"); s._test = true; s.level = 20; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.gold = 5000; G.setHealth(s, G.maxHealth(s)); return s; };
const has = (s, item) => s.inv.filter((r) => r.item === item).reduce((a, r) => a + r.qty, 0);

ok(G.sell.iq === true, "G.sell is wrapped");

// 1. keep marks, favourites, protection
{ const s = mk();
  const sw = G.give(s, "iron_sword"), ring = G.give(s, "silver_ring", 2), claw = G.give(s, "golden_claw");
  ok(!INVQOL.isKeep(G.invRow(s, sw)), "not kept at first");
  ok(/Keep/.test(INVQOL.toggleKeep(s, sw)) && INVQOL.isKeep(G.invRow(s, sw)), "marked Keep");
  ok(INVQOL.isProtected(s, G.invRow(s, sw)), "kept = protected");
  INVQOL.toggleKeep(s, sw); ok(!INVQOL.isProtected(s, G.invRow(s, sw)), "unmarked");
  FAVWHEEL.toggle(s, sw); ok(INVQOL.isFav(s, G.invRow(s, sw)) && INVQOL.isProtected(s, G.invRow(s, sw)), "a favourite is protected");
  ok(INVQOL.isQuest(G.invRow(s, claw)) && INVQOL.isProtected(s, G.invRow(s, claw)), "the golden claw is protected");
  ok(!INVQOL.isProtected(s, G.invRow(s, ring)), "a ring isn't");
}
// 2. better / worse than worn
{ const s = mk();
  const iron = G.give(s, "iron_sword"), steel = G.give(s, "steel_sword"), bow = G.give(s, "hunting_bow");
  G.equip(s, steel);
  ok(INVQOL.compare(s, "iron_sword", G.invRow(s, iron)) === -1, "iron sword worse than worn steel");
  ok(INVQOL.compare(s, "steel_sword", G.invRow(s, steel)) === null, "the worn one itself: no arrow");
  ok(INVQOL.compare(s, "hunting_bow", G.invRow(s, bow)) === null, "a bow isn't compared with a sword");
  ok(INVQOL.compare(s, "elven_sword") === 1, "an elven sword in a shop is better");
  ok(/iq-dn/.test(INVQOL.arrow(s, "iron_sword", G.invRow(s, iron))) && /iq-up/.test(INVQOL.arrow(s, "elven_sword")), "arrows draw");
  G.give(s, "steel_helmet"); ok(INVQOL.compare(s, "steel_helmet") === 1, "nothing worn on the head: any helmet is better");
  ok(INVQOL.compare(s, "potion_health") === null, "potions get no arrow");
  const tempered = G.invRow(s, iron); tempered.temper = 10;
  ok(INVQOL.compare(s, "iron_sword", tempered) === 1, "an improved iron sword can beat it");
}
// 3. junk: trinkets and worse loose gear, never protected / enchanted / unique / gems / handmade / worn
{ const s = mk();
  const steel = G.give(s, "steel_sword"); G.equip(s, steel);
  const iron = G.give(s, "iron_sword"), iron2 = G.give(s, "iron_sword"), ring = G.give(s, "silver_ring", 3), gem = G.give(s, "gem_garnet", 2), pot = G.give(s, "potion_health", 2);
  const ench = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "weapon" && D.ITEMS[k].enchant && D.ITEMS[k].skill === "One-Handed" && D.ITEMS[k].damage < 8 && D.ITEMS[k].value < 500);
  const e = ench ? G.give(s, ench) : null;
  const uq = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].unique && D.ITEMS[k].slot === "weapon" && D.ITEMS[k].skill === "One-Handed");
  const u = uq ? G.give(s, uq) : null;
  const made = G.give(s, "iron_sword"); G.invRow(s, made).cv = 20;
  INVQOL.toggleKeep(s, iron2);
  const j = INVQOL.junk(s), ids = j.map((x) => x.r.id);
  ok(ids.includes(iron), "a worse loose sword is junk");
  ok(ids.includes(ring), "a silver ring is junk");
  ok(!ids.includes(iron2), "kept sword is not junk");
  ok(!ids.includes(steel), "worn sword is not junk");
  ok(!ids.includes(gem), "gems are smithing materials, not junk");
  ok(!ids.includes(pot), "potions are not junk");
  ok(!e || !ids.includes(e), "enchanted gear is not junk");
  ok(!u || !ids.includes(u) || D.ITEMS[uq].damage >= 7, "unique gear is not junk");
  ok(!ids.includes(made), "handmade gear is not junk");
  ok(j.every((x) => x.price > 0), "every junk line has a price");
  const stolenRing = G.give(s, "gold_ring"); G.invRow(s, stolenRing).stolen = true;
  ok(!INVQOL.junk(s, false).some((x) => x.r.id === stolenRing) && INVQOL.junk(s, true).some((x) => x.r.id === stolenRing), "stolen junk only counts at a fence");
  delete G.invRow(s, stolenRing).stolen;
  const g0 = s.gold, tot = INVQOL.junk(s).reduce((a, x) => a + x.price, 0);
  const r = INVQOL.sellJunk(s, false, NOON);
  ok(r.n >= 2 && s.gold - g0 === r.gold && Math.abs(r.gold - tot) <= tot * 0.1 + 2, "sell all junk pays about the shown total " + r.text + " shown " + tot);
  ok(!G.invRow(s, iron) && !has(s, "silver_ring") && G.invRow(s, iron2) && G.invRow(s, steel) && has(s, "gem_garnet") === 2, "junk gone, the rest stays");
  const sale = INVQOL.lastSale(s, NOON + 10); ok(sale && sale.rows.length === r.n, "the whole junk sale is one undo");
  const u2 = INVQOL.undo(s, NOON + 20);
  ok(/Bought back/.test(u2) && s.gold === g0 && G.invRow(s, iron) && has(s, "silver_ring") === 3, "undo brings the junk back at the same price " + u2);
}
// 4. undo last sale: same price, time and place limits, single use
{ const s = mk();
  const sw = G.give(s, "steel_sword"), g0 = s.gold;
  const m = G.sell(s, sw, 1, NOON); ok(/^Sold/.test(m), "sold " + m);
  const got = s.gold - g0;
  ok(INVQOL.lastSale(s, NOON + 1)?.rows[0].price === got, "the sale is remembered with its price");
  ok(/Bought back/.test(INVQOL.undo(s, NOON + 60)) && s.gold === g0 && G.invRow(s, sw)?.item === "steel_sword", "bought back for what we got, same id");
  ok(/Nothing to buy back/.test(INVQOL.undo(s, NOON + 61)), "undo works once");
  // an in-game hour = 300 real seconds
  G.sell(s, sw, 1, NOON); ok(!INVQOL.lastSale(s, NOON + 3600 / G.GAME_SPEED + 1) && /Nothing/.test(INVQOL.undo(s, NOON + 3600 / G.GAME_SPEED + 1)), "after an in-game hour it's gone");
  const sw2 = G.give(s, "steel_sword"); G.sell(s, sw2, 1, NOON); s.location = "Riverwood";
  ok(/Nothing/.test(INVQOL.undo(s, NOON + 5)), "leaving town ends the undo"); s.location = "Whiterun";
  const sw3 = G.give(s, "steel_sword"); G.sell(s, sw3, 1, NOON); const keep = s.gold; s.gold = 1;
  ok(/costs/.test(INVQOL.undo(s, NOON + 5)) && s.gold === 1 && !G.invRow(s, sw3), "can't buy back without the gold"); s.gold = keep;
  // another save object can't use this save's undo
  const other = mk(); other.gold = 99999; ok(/Nothing/.test(INVQOL.undo(other, NOON + 5)), "another character can't use it");
  ok(/Bought back/.test(INVQOL.undo(s, NOON + 5)), "but the seller still can");
  // stacks: part of a stack, then the whole stack
  const p = G.give(s, "potion_health", 5); G.sell(s, p, 2, NOON);
  ok(has(s, "potion_health") === 3 && /Bought back/.test(INVQOL.undo(s, NOON + 5)) && has(s, "potion_health") === 5 && s.inv.filter((r) => r.item === "potion_health").length === 1, "a partial stack comes back into the same stack");
  const r = G.invRow(s, p); G.sell(s, p, r.qty, NOON); INVQOL.undo(s, NOON + 5);
  ok(has(s, "potion_health") === 5, "a whole stack comes back");
  // fields survive (improved, quality, name, keep, charge)
  const fancy = G.give(s, "steel_sword"); Object.assign(G.invRow(s, fancy), { temper: 4, nm: "Bitey", keep: 1 });
  G.sell(s, fancy, 1, NOON); INVQOL.undo(s, NOON + 5);
  const back = G.invRow(s, fancy); ok(back && back.temper === 4 && back.nm === "Bitey" && back.keep === 1, "improvements, names and Keep survive a buy-back");
}
// 5. no exploits: no XP loop, no duplicates, market stalls and trades make no undo
{ const s = mk();
  const sw = G.give(s, "steel_sword");
  const xp0 = JSON.stringify(s.skills.Mercantile);
  G.sell(s, sw, 1, NOON); const xp1 = JSON.stringify(s.skills.Mercantile);
  ok(xp1 !== xp0, "the first sale teaches Mercantile");
  INVQOL.undo(s, NOON + 1);
  ok(G.invRow(s, sw).ub === 1, "bought back things are flagged");
  for (let i = 0; i < 5; i++) { G.sell(s, sw, 1, NOON); INVQOL.undo(s, NOON + 1); }
  ok(JSON.stringify(s.skills.Mercantile) === xp1, "sell/undo loops give no more Mercantile");
  G.sell(s, sw, 1, NOON); const g1 = s.gold; INVQOL.undo(s, NOON + 1);
  ok(s.gold < g1 && s.inv.filter((r) => r.item === "steel_sword").length === 1, "never a duplicate");
  // a copy of the sold row turning up again (another device, a backup) blocks the undo instead of duplicating
  const sw4 = G.give(s, "iron_sword"), snap = JSON.parse(JSON.stringify(G.invRow(s, sw4)));
  G.sell(s, sw4, 1, NOON); s.inv.push(snap); const g2 = s.gold;
  ok(!/Bought back/.test(INVQOL.undo(s, NOON + 1)) && s.gold === g2 && s.inv.filter((r) => r.id === sw4).length === 1, "an id already back in the pack blocks the undo");
  // market stall: listing doesn't touch the undo, and a stall sale isn't undoable
  INVQOL.forget();
  s.homes = { Whiterun: { chest: [] } };
  const ring = G.give(s, "gold_ring"); const L = MARKET.list(s, ring, 100, [], NOON);
  ok(L.id && !INVQOL.lastSale(s, NOON + 1), "putting something on a stall makes no undo");
  const buyer = mk(); const out = {}; const d2 = MARKET.buy(buyer, { ...L.doc }, out);
  ok(d2 && !INVQOL.lastSale(buyer, NOON + 1) && !INVQOL.lastSale(s, NOON + 1), "buying from a stall makes no undo");
  ok(/Nothing/.test(INVQOL.undo(s, NOON + 2)), "nothing to undo after stall trading");
  // a shop sale, then selling the gold away: undo needs the gold
  const sw5 = G.give(s, "steel_sword"); G.sell(s, sw5, 1, NOON); s.gold = 0;
  ok(!/Bought back/.test(INVQOL.undo(s, NOON + 1)) && !G.invRow(s, sw5), "no gold, no buy-back");
}
// 6. confirms
{ const s = mk();
  const cheap = G.give(s, "iron_sword"), dear = G.give(s, "gem_emerald"), kept = G.give(s, "iron_dagger");
  INVQOL.toggleKeep(s, kept);
  ok(INVQOL.confirmWhy(s, G.invRow(s, cheap), 1, "sell") === "", "cheap things sell without asking");
  ok(/500|worth/.test(INVQOL.confirmWhy(s, G.invRow(s, dear), 1, "sell")), "a 750-gold emerald asks first");
  ok(/Keep/.test(INVQOL.confirmWhy(s, G.invRow(s, kept), 1, "drop")), "a kept thing asks before dropping");
  const ench = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].enchant && D.ITEMS[k].value < 500);
  if (ench) ok(/enchanted/.test(INVQOL.confirmWhy(s, G.invRow(s, G.give(s, ench)), 1, "sell")), "enchanted asks first");
  ok(/destroyed/.test(INVQOL.confirmWhy(s, G.invRow(s, cheap), 1, "break")), "breaking always asks");
  const uq = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].unique);
  if (uq) ok(/one of a kind/.test(INVQOL.confirmWhy(s, G.invRow(s, G.give(s, uq)), 1, "sell")), "unique asks first");
}
// 7. drop, sort, weight
{ const s = mk();
  const a = G.give(s, "iron_sword"), b = G.give(s, "arrow_iron", 30), claw = G.give(s, "golden_claw");
  ok(/leave/.test(INVQOL.drop(s, b, 10)) && has(s, "arrow_iron") === 20, "drop part of a stack");
  ok(/hold on/.test(INVQOL.drop(s, claw)) && G.invRow(s, claw), "quest things can't be dropped");
  G.equip(s, a); ok(/Take it off/.test(INVQOL.drop(s, a)) && G.invRow(s, a), "worn things can't be dropped");
  G.give(s, "steel_armor"); G.give(s, "gem_diamond");
  s.invSort = "weight"; const w = INVQOL.sorted(s, s.inv); ok(w[0].item === "steel_armor", "sort by weight");
  s.invSort = "value"; ok(INVQOL.sorted(s, s.inv)[0].item === "gem_diamond", "sort by value");
  s.invSort = "name"; const nm = INVQOL.sorted(s, s.inv).map((r) => D.ITEMS[r.item].name); ok(nm.join() === [...nm].sort((x, y) => x.localeCompare(y)).join(), "sort by name");
  s.invSort = "new"; ok(INVQOL.sorted(s, s.inv)[0].id === Math.max(...s.inv.map((r) => r.id)), "newest first");
  delete s.invSort; ok(INVQOL.sorted(s, s.inv) === s.inv, "type keeps the usual order");
  ok(/iqsort/.test(INVQOL.sortHTML(s)), "sort chips draw");
  const cap = G.capacity(s), now = G.carried(s);
  const heavy = Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].weight > 0).sort((x, y) => D.ITEMS[y].weight - D.ITEMS[x].weight)[0];
  const need = Math.ceil((cap - now) / D.ITEMS[heavy].weight) + 1;
  ok(INVQOL.overAfter(s, heavy, 1) === null || cap - now < D.ITEMS[heavy].weight, "one light enough thing: no warning");
  const w2 = INVQOL.overAfter(s, heavy, need); ok(w2 && w2.after > w2.cap, "too much: a warning");
  for (let i = 0; i < need; i++) G.give(s, heavy);
  ok(G.overweight(s) && INVQOL.overAfter(s, "iron_dagger", 1) === null, "already over: no nagging on every pick-up");
}
// 8. HTML bits have no holes
{ const s = mk();
  const sw = G.give(s, "steel_sword"); G.give(s, "silver_ring", 2); G.give(s, "iron_sword"); G.equip(s, sw);
  const h1 = INVQOL.shopHTML(s, "general", true); ok(/iqjunk/.test(h1) && !/undefined|NaN/.test(h1), "shop shows Sell all junk");
  const iron = s.inv.find((r) => r.item === "iron_sword"); G.sell(s, iron.id, 1, NOON);
  const h2 = INVQOL.shopHTML(s, "general", true); ok(/iqundo/.test(h2) && /Buy back/.test(h2), "and Buy back after a sale");
  const jm = INVQOL.junkModal(s, false); ok(/Total/.test(jm) && /iqjunkgo/.test(jm) && !/undefined|NaN/.test(jm), "junk list shows the total");
  const acts = INVQOL.acts(s, G.invRow(s, sw), true).join(""); ok(/iqkeep/.test(acts) && !/iqdrop/.test(acts), "worn: Keep but no Drop");
  const r2 = s.inv.find((r) => r.item === "silver_ring"); ok(/Drop all/.test(INVQOL.acts(s, r2, false).join("")), "stacks get Drop all");
}
console.log(fails ? fails + " of " + n + " FAILED" : "inventory ok (" + n + " checks)");
if (fails) process.exitCode = 1;
`, c);
