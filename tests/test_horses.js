// Horse breeds, rolled stats and stable upgrades (saddlebags, horseshoes, armor). node test_horses.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 10 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, HORSES, WORLD } = c;
const stables = Object.keys(WORLD.places).find((t) => G.shopTypes(t).includes("stables"));
const fresh = (gold = 99999) => { const s = c.make("warrior", 20); s.location = stables; s.gold = gold; delete s.horse; if (s.perks) delete s.perks.horse_trader; return s; };
ok(Object.keys(HORSES.BREEDS).length === 4, "four breeds");
// buying each breed: right price, stats near the breed's
for (const [id, b] of Object.entries(HORSES.BREEDS)) {
  const s = fresh(); const r = HORSES.buy(s, "Test", "bay", id);
  ok(s.horse && s.horse.breed === id && s.gold === 99999 - b.price, `${id}: bought for ${b.price}: ${r}`);
  const st = s.horse.stats;
  ok(Math.abs(st.speed / b.speed - 1) <= HORSES.ROLL + 1e-6 && Math.abs(st.carry / b.carry - 1) <= HORSES.ROLL + 0.01 && Math.abs(st.hp / b.hp - 1) <= HORSES.ROLL + 0.01, `${id}: stats roll within 5%`);
  ok(HORSES.maxHp(s.horse) === st.hp && s.horse.hp === st.hp, `${id}: starts at full health`);
}
// breeds really differ
{ const B = HORSES.BREEDS; ok(B.courser.speed > B.bay.speed && B.bay.speed > B.draft.speed && B.draft.carry > B.pony.carry && B.pony.carry > B.courser.carry && B.pony.price < B.bay.price, "courser fastest, draft carries most, pony cheapest"); }
// rolls vary between horses
{ const seen = new Set(); for (let i = 0; i < 20; i++) seen.add(HORSES.roll("bay").carry); ok(seen.size > 3, "horses of one breed differ: " + [...seen].join(",")); }
// speed and carry reach the game
{ const s = fresh(); HORSES.buy(s, "Dobbin", "bay", "draft", () => 0.5); s.horse.mounted = true;
  const cap1 = G.capacity(s), v1 = G.speed(s);
  ok(HORSES.carry(s) === 180 && Math.abs(HORSES.speed(s) - 1.6) < 1e-9, "a middling draft is exactly the breed");
  ok(/Saddlebags/.test(HORSES.buyBags(s)) && HORSES.carry(s) === 230 && G.capacity(s) === cap1 + 50, "saddlebags add carry to your capacity");
  HORSES.buyBags(s); HORSES.buyBags(s); ok(HORSES.carry(s) === 330 && /bigger/.test(HORSES.buyBags(s)), "three bag levels, then no more");
  const g0 = s.gold; ok(/farrier/.test(HORSES.buyShoes(s, "steel")) && g0 - s.gold === 600, "steel shoes cost 600");
  ok(Math.abs(HORSES.speed(s) - 1.76) < 1e-6, "steel shoes: 10% faster: " + HORSES.speed(s));
  ok(G.speed(s) > v1 * 1.05, "you really travel faster");
  ok(/better shoes/.test(HORSES.buyShoes(s, "iron")), "no stepping down to iron");
  ok(/fits/.test(HORSES.buyArmor(s, "steel")) && HORSES.maxHp(s.horse) === 360, "armor still adds health");
  s.location = null; ok(/Only stables/.test(HORSES.buyShoes(s, "elven")), "only at stables"); }
// old saves: { name } only
{ const s = fresh(); s.horse = { name: "Old" }; HORSES.fix(s); ok(s.horse.breed === "bay" && HORSES.carry(s) === 100 && HORSES.speed(s) === 1.8 && HORSES.maxHp(s.horse) === 200, "old horses become plain bays"); }
// Horse Trader: cheaper and better rolls
{ const s = fresh(); s.perks = s.perks || {}; s.perks.horse_trader = 2; s.perks.haggling = s.perks.haggling || 1;
  ok(HORSES.price(s, "bay") === 800, "Horse Trader 2: 20% off: " + HORSES.price(s, "bay"));
  const p = HORSES.price(s, "bay"); HORSES.buy(s, "Lucky", "bay", "bay", () => 0); ok(99999 - s.gold === p, "pays the discounted price");
  ok(s.horse.stats.carry >= 100, "worst roll is no worse than the breed with Horse Trader: " + s.horse.stats.carry); }
// not enough gold
{ const s = fresh(500); ok(/costs/.test(HORSES.buy(s, "x", "bay", "bay")) && !s.horse, "can't buy without the gold"); ok(!!HORSES.buy(s, "x", "bay", "pony") && !s.horse, "pony needs 700"); }
console.log(`${n - fails}/${n} horse checks passed`);
process.exit(fails ? 1 : 0);
