// Worn gear never changes hands. Remigiusz: "equipped gear should never show when selling items, and the same applies
// when trading inventory with a follower or another player." Covers the hand-away list (G.handable) the shop sell list,
// stall, trade, gift, chest and follower lists use; selling and Sell all; Sell all junk; two copies with one worn; a
// follower give; a player trade offer with worn gear (refused by the sender, the receiver and the hub).
// W=/path/to/game/ node test_noequipsell.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, setTimeout: () => 0, clearTimeout: () => {} };
vm.createContext(c);
vm.runInContext("var I18N_STORY = { ex: {}, pats: [] };", c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "enchanting.js", "quests.js", "magic.js",
  "horses.js", "hall.js", "visits.js", "followers2.js", "followerai.js", "menus.js", "menus2.js", "followertab.js", "invqol.js", "market.js", "mp.js", "patchnotes.js", "i18n_noequip.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
var n = 0; var OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
var NOON = (() => { let t = G.now(); while (!G.shopsOpen(t) || Math.floor(G.clock(t).hour) !== 12) t += 60; return t; })();
var mk = () => { const s = G.newSave("ne" + Math.random(), "Tester", "nord"); s._test = true; s.level = 20; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.gold = 9999; s.thaneWhiterun = true; G.setHealth(s, G.maxHealth(s)); return s; };
var ids = (rows) => rows.map((r) => r.id);
D.ITEMS.test_ring = D.ITEMS.test_ring || { name: "Plain Test Ring", slot: "ring", value: 20, weight: 0.25 };   // jewellery (real rings come from jewelry.js)
`, c);

// 1. the hand-away list: worn rows drop out, the pack view (s.inv) keeps them
vm.runInContext(`
var A = mk();
var sw = G.give(A, "steel_sword"), helm = G.give(A, "iron_helmet"), ring = G.give(A, "test_ring"), pot = G.give(A, "potion_health", 3);
G.equip(A, sw); G.equip(A, helm); G.equip(A, ring);
OK(G.wornCount(A, sw) === 1 && G.freeQty(A, sw) === 0 && G.freeQty(A, pot) === 3, "worn count / free qty");
var H = G.handable(A);
OK(![sw, helm, ring].some((id) => ids(H).includes(id)), "weapon, armour and jewellery you wear are not in the hand-away list");
OK(ids(H).includes(pot), "loose things are");
for (const id of Object.values(G.loadout(A).equipment)) OK(!ids(H).includes(id), "nothing worn in the hand-away list (" + id + ")");
OK(A.inv.some((r) => r.id === sw), "your own pack still has the worn sword");
`, c);

// 2. two copies: wear one, only the other shows; a stack of two with one in hand shows as one
vm.runInContext(`
var B = mk();
var a = G.give(B, "iron_dagger"), b = G.give(B, "iron_dagger"); G.equip(B, a);
var hb = G.handable(B).filter((r) => r.item === "iron_dagger");
OK(hb.length === 1 && hb[0].id === b, "two daggers, one worn: only the spare shows");
var st = G.invRow(B, a); st.qty = 2; G.invRow(B, b).qty = 1; B.inv = B.inv.filter((r) => r.id !== b);
var hs = G.handable(B).filter((r) => r.id === a);
OK(hs.length === 1 && hs[0].qty === 1 && G.invRow(B, a).qty === 2, "a stack of two with one worn shows ×1 (count minus one), the pack keeps 2");
OK(/Take it off/.test(G.sell(B, a, 2, NOON)) && G.invRow(B, a).qty === 2, "selling both refuses");
OK(/^Sold/.test(G.sell(B, a, 1, NOON)) && G.invRow(B, a)?.qty === 1 && G.loadout(B).equipment.weapon === a, "selling the spare works, the worn one stays on");
G.equipOff && (G.invRow(B, a).qty = 2, G.equipOff(B, a));
if (G.loadout(B).equipment.offhand === a) OK(G.freeQty(B, a) === 0 && !ids(G.handable(B)).includes(a), "both hands: none to hand away");
`, c);

// 3. shops: G.sell refuses worn gear; Sell all junk never sells it; the sell list code uses the hand-away list
vm.runInContext(`
var C = mk();
var w = G.give(C, "iron_sword"); G.equip(C, w);
var g0 = C.gold;
OK(/Take it off/.test(G.sell(C, w, 1, NOON)) && G.invRow(C, w) && C.gold === g0, "a shop won't buy the sword in your hand");
C.location = "Riften";
OK(G.invRow(C, w) && !/^Sold/.test(G.sell(C, w, 1, NOON)), "a fence town too");
C.location = "Whiterun";
var plain = G.give(C, "test_ring"); G.equip(C, plain);   // a plain ring counts as junk unless worn
var spare = G.give(C, "test_ring");
var j = INVQOL.junk(C).map((x) => x.r.id);
OK(!j.includes(plain) && !j.includes(w), "the junk list never holds worn things");
INVQOL.sellJunk(C, true, NOON);
OK(G.invRow(C, plain) && G.invRow(C, w) && G.loadout(C).equipment.ring === plain, "Sell all junk leaves worn gear alone");
OK(!G.invRow(C, spare), "and still sells the loose ring");
`, c);
const ui = fs.readFileSync(W + "ui.js", "utf8");
const sellList = ui.slice(ui.indexOf('const fence = shop === "fence"'), ui.indexOf('const fence = shop === "fence"') + 400);
if (!/G\.handable\(S\)/.test(sellList)) throw new Error("FAIL shop sell list uses G.handable");
if (!/data-act="sell" data-id="\$\{r\.id\}">Sell · /.test(ui) || !/canShop && G\.freeQty\(S, r\.id\) > 0\) acts\.push\(`<button class="btn" data-act="sell"/.test(ui)) throw new Error("FAIL item details hide Sell for worn gear");
if (!/G\.sell\(S, r\.id, G\.freeQty\(S, r\.id\)/.test(ui)) throw new Error("FAIL Sell all sells only the unworn ones");
for (const tag of ["const loose = G.handable(S)", "const pack = G.handable(S).filter((r) => !r.stolen && D.ITEMS[r.item])", "const putRows = G.handable(S)"])
  if (!ui.includes(tag)) throw new Error("FAIL list uses G.handable: " + tag);
if (fs.existsSync(W + "homestash.js") && !/G\.freeQty/.test(fs.readFileSync(W + "homestash.js", "utf8"))) throw new Error("FAIL house chest pack list uses G.freeQty");

// 4. follower: Your pack leaves worn gear out, Give refuses it, a spare copy can be given
vm.runInContext(`
var F = mk();
OK(TOWNS.hire(F, "lydia").includes("Lydia"), "hire Lydia");
var x = G.give(F, "steel_sword"), y = G.give(F, "steel_sword"); G.equip(F, x);
var yours = FOLTAB.rows(F, "yours", "weapons").map((r) => r.id);
OK(!yours.includes(x) && yours.includes(y), "Follower tab Your pack: only the spare sword");
OK(FOLTAB.rows(F, "yours").every((r) => !r.eq), "no worn rows in Your pack");
var m = FOL2.give(F, x, 1);
OK(/Take it off/.test(m) && G.invRow(F, x) && G.loadout(F).equipment.weapon === x, "Give refuses the sword in your hand: " + m);
OK(/Take it off/.test(FOLTAB.giveEquip(F, x)) && G.invRow(F, x), "Give & equip refuses it too");
m = FOL2.give(F, y, 1);
OK(/give/.test(m) && !G.invRow(F, y), "the spare goes to her: " + m);
`, c);

// 5. player trade: an offer with worn gear is refused (sender), a doc claiming worn gear is refused (receiver, hub)
vm.runInContext(`
var P = mk(), Q = mk();
var ws = G.give(P, "steel_sword"), pt = G.give(P, "potion_health", 2); G.equip(P, ws);
var o = MP.makeOffer(P, { id: Q.id, name: "Q" }, [ws, pt], 0, 0);
OK(!o.doc && /Take it off/.test(o.text) && G.invRow(P, ws) && G.invRow(P, pt).qty === 2, "offer with your worn sword is refused, nothing leaves your pack");
o = MP.makeOffer(P, { id: Q.id, name: "Q" }, [pt], 0, 0);
OK(o.doc && o.doc.items.length === 1 && !G.invRow(P, pt), "an offer of loose things still works");
var bad = { ...o.doc, items: [{ item: "steel_sword", qty: 1, worn: true }] };
OK(!MP.offerOk(bad) && MP.accept(Q, bad) === null, "the receiver refuses an offer holding worn gear");
OK(MP.accept(Q, { ...o.doc }) && Q.inv.some((r) => r.item === "potion_health"), "a clean offer is accepted");
// a pair with one worn: the offer carries the spare only
var d1 = G.give(P, "iron_dagger"); G.invRow(P, d1).qty = 2; G.equip(P, d1);
o = MP.makeOffer(P, { id: Q.id, name: "Q" }, [d1], 0, 0);
OK(o.doc && o.doc.items[0].qty === 1 && G.invRow(P, d1)?.qty === 1 && G.loadout(P).equipment.weapon === d1, "two daggers, one in hand: the offer takes one");
// gifts and stalls
P.homes = P.homes || {};
var gs = G.give(P, "steel_sword"); G.equip(P, gs);
OK(VISITS.giftItem(P, { id: Q.id, name: "Q", towns: ["Whiterun"] }, "Whiterun", gs, "").err, "a gift of worn gear is refused");
OK(MARKET.list(P, gs, 10, []).err, "a stall won't take worn gear");
`, c);

// 6. the hub drops trade/gift/stall records that claim worn gear
// (read from the source so this test needs no server packages)
const src = fs.readFileSync(path.join(__dirname, "../server/src/hub.js"), "utf8");
if (!/HANDOVER\.includes\(data\.col\) && holdsWorn\(data\.doc\)\) return;/.test(src)) throw new Error("FAIL hub checks trades for worn gear");
const hubFns = vm.runInNewContext(src.match(/const HANDOVER = [^\r\n]*/)[0] + "\n" + src.match(/const holdsWorn = [^\r\n]*/)[0] + "\n({ HANDOVER, holdsWorn })", { Array });
if (!hubFns.HANDOVER.includes("trades") || !hubFns.HANDOVER.includes("gifts") || !hubFns.HANDOVER.includes("stalls")) throw new Error("FAIL hub guards trades, gifts and stalls");
if (!hubFns.holdsWorn({ items: [{ item: "steel_sword", qty: 1, worn: true }] }) || !hubFns.holdsWorn({ row: { item: "steel_sword", eq: 1 } })) throw new Error("FAIL hub spots worn gear");
if (hubFns.holdsWorn({ items: [{ item: "potion_health", qty: 1 }] }) || hubFns.holdsWorn({ row: { item: "potion_health" } })) throw new Error("FAIL hub keeps clean records");

// 7. patch note + Polish
vm.runInContext(`
var top = PATCHNOTES.LIST ? (PATCHNOTES.LIST.find((n) => n.id === "b144-noequipsell") || PATCHNOTES.LIST[0]) : null;
OK(!top || /wear/i.test(JSON.stringify(top)), "patch note on top mentions worn gear");
OK(I18N_STORY.ex["You're wearing that. Take it off first."], "Polish for the new line");
var pn = PATCHNOTES.LIST.find((x) => x.id === "b144-noequipsell");
OK(pn && new Set(PATCHNOTES.LIST.map((x) => x.id)).size === PATCHNOTES.LIST.length, "patch note listed with a unique id");
for (const x of [pn.title, ...pn.items]) OK(I18N_STORY.ex[x], "Polish for: " + x.slice(0, 40));
`, c);

console.log(`noequipsell ok (${vm.runInContext("n", c)} checks)`);
process.exit(0);
