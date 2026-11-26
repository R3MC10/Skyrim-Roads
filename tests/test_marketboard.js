// The market board (game/market.js board/buyAny/openParcels/noteSold): every town's stalls in one list, buy from any
// town, the goods wait in your Market parcels. Checks: double Buy -> one purchase and one payment; two buyers, one
// listing -> one wins; a full pack loses nothing (parcels); worn / bound / stolen can't be listed; and over 1,000 random
// list / buy / withdraw / settle / open sequences no item or gold is made or lost (the 5% fee is the only gold that goes).
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "rarity.js", "names.js", "economy.js", "market.js"])
  if (fs.existsSync(__GAME + f)) vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const ok = (c, m) => { if (!c) throw new Error("FAIL " + m); };
D.ITEMS.quest_test = { name: "Old Key", slot: "trophy", value: 5, noTrade: true };
const TOWNS_ = Object.keys(TOWNS.HOMES).slice(0, 3);
ok(TOWNS_.length >= 2, "towns with a market");
const GOODS = ["potion_health_minor", ...Object.keys(D.ITEMS).filter((k) => ["scroll", "soulgem"].includes(D.ITEMS[k].slot)).slice(0, 2)];
const ARMS = Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].slot === "weapon" && !D.ITEMS[k].noTrade).slice(1, 4);
function hero(id, town) {
  const s = G.newSave(id, "P" + id, "nord"); s.location = town; s.gold = 2000; s.homes = { [town]: { chest: [], garden: 0 } };
  for (const g of GOODS) G.give(s, g, 4); for (const w of ARMS) G.give(s, w, 1); G.give(s, "quest_test", 1);
  return s;
}
/* the shared stalls, with Store.change's rule: read, change, write, one at a time */
function world() {
  const docs = {};
  return {
    docs, list: () => Object.entries(docs).map(([id, d]) => ({ ...d, id })),
    put(id, d) { docs[id] = { ...d }; },
    change(id, fn) { const cur = docs[id]; if (!cur) return null; const nx = fn({ ...cur }); if (nx) docs[id] = nx; else delete docs[id]; return { before: cur, after: nx }; },
    remove(id) { delete docs[id]; },
  };
}
function count(ss) {
  const m = { gold: 0 };
  for (const s of ss) { m.gold += s.gold; for (const r of s.inv) m[r.item] = (m[r.item] || 0) + r.qty; for (const p of s.parcels || []) m[p.row.item] = (m[p.row.item] || 0) + p.row.qty; }
  return m;
}
const free = (s, item) => s.inv.find((r) => r.item === item && G.freeQty(s, r.id) > 0);

// ---- the board: all towns, search, filter, sort
{
  const W = world(), a = hero("A", TOWNS_[0]), b = hero("B", TOWNS_[1]), me = hero("M", TOWNS_[2]);
  const l1 = MARKET.list(a, free(a, GOODS[0]).id, 30, W.list(), 100); W.put(l1.id, l1.doc);
  const l2 = MARKET.list(b, free(b, ARMS[0]).id, 500, W.list(), 200); W.put(l2.id, l2.doc);
  const l3 = MARKET.list(b, free(b, GOODS[1]).id, 90, W.list(), 300); W.put(l3.id, l3.doc);
  ok(MARKET.board(W.list(), {}, me.id).length === 3, "every town's listings show");
  ok(MARKET.board(W.list(), {}, b.id).length === 1, "not your own");
  ok(MARKET.board(W.list(), { sort: "cheap" }, me.id)[0].price === 30 && MARKET.board(W.list(), { sort: "dear" }, me.id)[0].price === 500, "sort by price");
  ok(MARKET.board(W.list(), { sort: "new" }, me.id)[0].t === 300, "newest first");
  ok(MARKET.board(W.list(), { kind: "weapon" }, me.id).length === 1, "type filter");
  ok(MARKET.board(W.list(), { text: D.ITEMS[ARMS[0]].name.slice(0, 4) }, me.id).some((d) => d.row.item === ARMS[0]), "name search");
  ok(MARKET.board(W.list(), { text: TOWNS_[1] }, me.id).length === 2, "search by the seller's town");
  ok(MARKET.board(W.list(), { rarity: "legendary" }, me.id).length === 0, "rarity filter");
  ok(MARKET.board([{ ...l1.doc, id: "x", row: { ...l1.doc.row, worn: true } }], {}, me.id).length === 0, "a listing that says it's worn never shows");
  // buy from another town: goes to parcels, paid once
  const g0 = me.gold, out = {};
  W.change(l2.id, (d) => MARKET.buyAny(me, d, out) || d);
  ok(out.text && me.gold === g0 - 500 && me.parcels.length === 1, "bought from afar into parcels");
  const out2 = {}; W.change(l2.id, (d) => MARKET.buyAny(me, d, out2) || d);
  ok(out2.err && me.gold === g0 - 500 && me.parcels.length === 1, "double Buy: one purchase, one payment");
  const other = hero("O", TOWNS_[0]), out3 = {}; W.change(l2.id, (d) => MARKET.buyAny(other, d, out3) || d);
  ok(out3.err && other.gold === 2000 && !(other.parcels || []).length, "second buyer loses, pays nothing");
  ok(MARKET.noteSold(me, { ...W.docs[l2.id] }) && MARKET.lastSold(me, ARMS[0]) === 500, "last sold for ~X");
  // seller gets paid minus 5%
  const bg = b.gold; MARKET.settle(b, W.docs[l2.id]); W.remove(l2.id); ok(b.gold === bg + 475, "seller paid minus 5%");
  // parcels open only in a town with a market; everything lands in the pack
  me.location = "nowhere-town"; ok(MARKET.openParcels(me).err && me.parcels.length === 1, "no market, no parcels");
  me.location = TOWNS_[2]; const n0 = me.inv.filter((r) => r.item === ARMS[0]).length;
  ok(MARKET.openParcels(me).n === 1 && me.parcels.length === 0 && me.inv.filter((r) => r.item === ARMS[0]).length === n0 + 1, "parcels opened into the pack");
  // a full, heavy pack: nothing is lost
  for (let i = 0; i < 300; i++) G.give(me, ARMS[1], 1);
  const o4 = {}; W.change(l3.id, (d) => MARKET.buyAny(me, d, o4) || d); const before = count([me]);
  ok(MARKET.openParcels(me).n === 1 && JSON.stringify(count([me])) === JSON.stringify(before), "full pack: nothing lost");
  // worn / bound / stolen can't be listed
  ok(MARKET.list(me, G.loadout(me).equipment.weapon, 10, []).err, "worn refused");
  ok(MARKET.list(me, me.inv.find((r) => r.item === "quest_test").id, 10, []).err, "bound refused");
  const st = G.invRow(me, G.give(me, ARMS[2], 1)); st.stolen = true; ok(MARKET.list(me, st.id, 10, []).err, "stolen refused");
  ok(MARKET.buyAny(b, { ...l1.doc, id: l1.id }, {}) && true, "buy works with poor seller too");
  ok(!MARKET.buyAny(a, { ...l1.doc, id: l1.id }, {}), "not your own listing");
  const poor = hero("P", TOWNS_[0]); poor.gold = 5; const o5 = {}; ok(!MARKET.buyAny(poor, { ...l1.doc }, o5) && o5.err && poor.gold === 5, "can't afford: nothing happens");
}
// ---- 1,000 random sequences: count every item and gold before and after
{
  const W = world(), P = [0, 1, 2, 3].map((i) => hero("H" + i, TOWNS_[i % TOWNS_.length]));
  const start = count(P); let fees = 0, buys = 0;
  for (let k = 0; k < 1000; k++) {
    const s = P[Math.floor(Math.random() * P.length)], roll = Math.random();
    if (roll < 0.3) {
      const r = s.inv[Math.floor(Math.random() * s.inv.length)];
      s.location = Object.keys(s.homes)[0];
      if (r) { const x = MARKET.list(s, r.id, 1 + Math.floor(Math.random() * 300), W.list(), k); if (x.doc) W.put(x.id, x.doc); }
    } else if (roll < 0.6) {
      const list = MARKET.board(W.list(), { sort: ["new", "cheap", "dear"][k % 3] }, s.id); const d = list[Math.floor(Math.random() * list.length)];
      if (d) { const reps = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < reps; i++) { const o = {}; W.change(d.id, (x) => MARKET.buyAny(s, x, o) || x); if (o.text) buys++; } }   // double/triple taps
    } else if (roll < 0.7) {
      const mine = MARKET.mine(W.list(), s.id); const d = mine[Math.floor(Math.random() * mine.length)];
      if (d) W.change(d.id, (x) => (x.status === "open" && x.seller === s.id ? { ...x, status: "withdrawn" } : x));
    } else if (roll < 0.85) {
      for (const d of W.list()) if (d.seller === s.id && (d.status === "sold" || d.status === "withdrawn")) {
        const g = s.gold; W.remove(d.id); MARKET.settle(s, d); if (d.status === "sold") fees += d.price - (s.gold - g);
      }
    } else if (s.parcels && s.parcels.length) { s.location = TOWNS_[Math.floor(Math.random() * TOWNS_.length)]; MARKET.openParcels(s); }
  }
  // close out: settle everything still on the books, take back the rest
  for (const s of P) for (const d of W.list()) if (d.seller === s.id) {
    if (d.status === "open") W.change(d.id, (x) => ({ ...x, status: "withdrawn" }));
    const cur = W.docs[d.id]; W.remove(d.id); const g = s.gold; MARKET.settle(s, { ...cur, id: d.id }); if (cur.status === "sold") fees += cur.price - (s.gold - g);
  }
  for (const s of P) if (s.parcels && s.parcels.length) MARKET.openParcels(s);
  const end = count(P);
  ok(end.gold + fees === start.gold, "gold: only the fee leaves " + start.gold + " vs " + end.gold + "+" + fees);
  for (const k of Object.keys(start)) if (k !== "gold") ok(start[k] === (end[k] || 0), "item " + k + ": " + start[k] + " vs " + end[k]);
  for (const k of Object.keys(end)) ok(k in start, "no new item " + k);
  console.log("random market:", buys, "purchases, fees", fees);
}
console.log("marketboard ok");
`, c);
