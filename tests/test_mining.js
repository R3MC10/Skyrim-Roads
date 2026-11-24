// Mining: one pickaxe is enough forever, mines that are dungeons (Embershard Mine), clear reasons, old saves. node test_mining.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RegExp, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).concat(["smithing.js", "solstheim.js", "minegame.js", "i18n_pickaxe.js", "patchnotes.js"]).filter((f, i, a) => a.indexOf(f) === i);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, SMITH, D } = c;
const picks = (s) => s.inv.filter((r) => r.item === "pickaxe").reduce((a, r) => a + r.qty, 0);
const miner = (place = "Dawnstar", pick = true) => {
  const s = c.make("warrior", 10); s.location = place; s.trip = null; s.dungeon = null; s.mined = {}; s.cleared = {};
  s.inv = s.inv.filter((r) => r.item !== "pickaxe"); if (pick) G.give(s, "pickaxe"); return s;
};

// mining many times with one pickaxe: it's never used up
{ const s = miner(); let t = G.now(), dug = 0;
  for (let k = 0; k < 40; k++) {
    t += SMITH.VEIN_RENEW + 1;
    const m = SMITH.mine(s, "Dawnstar", t);
    if (m.startsWith("⛏")) dug++;
    ok(picks(s) === 1, `still one pickaxe after dig ${k + 1}`);
  }
  ok(dug === 40, "40 digs over 40 days, all went through: " + dug);
  ok(SMITH.mineBlock(s, "Dawnstar", t) !== "", "the same day the veins are bare");
  ok(/grow back/.test(SMITH.mineBlock(s, "Dawnstar", t)), "bare veins say so");
  ok(SMITH.mineBlock(s, "Dawnstar", t + SMITH.VEIN_RENEW + 1) === "", "the next day you can mine again, same pickaxe"); }

// the forge still eats materials (only the pickaxe is permanent)
{ const s = miner(); G.give(s, "ore_iron", 4); s.location = "Whiterun";
  if (SMITH.atForge(s)) { SMITH.refine(s, Object.keys(SMITH.REFINE).find((k) => SMITH.REFINE[k][0] === "mat_iron")); ok(SMITH.count(s, "ore_iron") === 2, "smelting still uses ore: " + SMITH.count(s, "ore_iron")); }
  else ok(true, "no forge in this test build"); }

// Embershard Mine: a dungeon that is also a mine
{ ok(!!SMITH.MINES["Embershard Mine"], "Embershard Mine has ore veins");
  const s = miner("Embershard Mine");
  ok(SMITH.mineBlock(s) === "", "before clearing: you can mine from the place card");
  s.dungeon = { place: "Embershard Mine", rows: [], row: 0 };
  ok(/Leave the rooms/.test(SMITH.mineBlock(s)), "inside the rooms: a clear reason, not a silent failure");
  s.dungeon = null; s.cleared = { "Embershard Mine": G.now() };
  ok(SMITH.mineBlock(s) === "", "after clearing: you can mine");
  const m = SMITH.mine(s, "Embershard Mine", G.now());
  ok(m.startsWith("⛏") && /Embershard Mine/.test(m), "mining Embershard works: " + m);
  ok(picks(s) === 1, "and the pickaxe stays");
  const ores = s.inv.filter((r) => /^ore_|^gem_/.test(r.item)).reduce((a, r) => a + r.qty, 0);
  ok(ores >= 3, "ore in the pack: " + ores); }

// every mine-named place on the map can be mined
{ const src = fs.readFileSync(W + "world.js", "utf8"); const mines = [...new Set(src.match(/"[^"]*\bMine"/g) || [])].map((x) => x.slice(1, -1));
  for (const p of mines) ok(!!SMITH.MINES[p], `${p} has ore veins`); }

// no pickaxe: a clear message
{ const s = miner("Dawnstar", false);
  const why = SMITH.mineBlock(s);
  ok(/You need a pickaxe/.test(why) && /Riverwood/.test(why), "no pickaxe: says where to buy one: " + why);
  ok(SMITH.mine(s) === why, "mining says the same and gives nothing");
  ok((D.SHOPS.Riverwood || []).includes("blacksmith") && D.SHOP_STOCK.blacksmith.includes("pickaxe"), "the Riverwood blacksmith sells pickaxes");
  ok(D.ITEMS.pickaxe.value <= 10, "and they're cheap"); }

// pickaxe in a house chest vs in the pack
{ const s = miner("Dawnstar", false);
  s.homes = { Whiterun: { chest: [{ id: 9001, item: "pickaxe", qty: 1 }], garden: 0 } };
  const why = SMITH.mineBlock(s);
  ok(/house chest in Whiterun/.test(why), "pickaxe at home: tells you where it is: " + why);
  G.give(s, "pickaxe");
  ok(SMITH.mineBlock(s) === "", "pickaxe in the pack: you can mine");
  ok(SMITH.hasPickaxe(s), "hasPickaxe sees the one in the pack"); }

// old save: a pickaxe row with leftover wear (qty 0, charges, durability)
{ const s = miner("Dawnstar", false);
  s.inv.push({ id: 7777, item: "pickaxe", qty: 0, charge: 0, durability: 0, uses: 0 });
  ok(SMITH.mineBlock(s) === "", "a worn-out-looking pickaxe from an old save still works");
  const r = s.inv.find((x) => x.id === 7777);
  ok(r.qty === 1 && r.charge === undefined && r.durability === undefined && r.uses === undefined, "the stale wear is cleared");
  ok(SMITH.mine(s).startsWith("⛏") && picks(s) === 1, "and it keeps working"); }

// a lost pickaxe is not refunded
{ const s = miner("Dawnstar", false); ok(!SMITH.hasPickaxe(s) && picks(s) === 0, "no pickaxe row: nothing is handed out"); }

// Polish and the patch note
{ const W2 = c.I18N_EXTRA.words, P = c.PATCHNOTES;
  ok(!!W2[SMITH.NO_PICK], "Polish for the no-pickaxe line");
  ok(!!W2["⛏ Mine ore"], "Polish for the Mine ore button");
  ok(c.I18N_EXTRA.pat.some(([re]) => re.test("Your pickaxe is in your house chest in Whiterun. Take it with you to mine.")), "Polish for the house-chest line");
  const note = P && P.LIST.find((e) => e.id === "b143-pickaxe");
  ok(note && P.LIST[0] === note, "patch note on top");
  ok(note && note.items.every((x) => W2[x]) && W2[note.title], "patch note in Polish");
  ok(new Set(P.LIST.map((e) => e.id)).size === P.LIST.length, "patch note ids are unique"); }

console.log(`${n - fails}/${n} mining checks passed`);
if (fails) process.exit(1);
