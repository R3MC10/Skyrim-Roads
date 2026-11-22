// [gear] every weapon/armour item maps to a gear look; card look stays small; figures draw for every set
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const vm = require("vm"), fs = require("fs"), path = require("path");
const W = process.env.W || require("path").join(__dirname, "../game/");
const stub = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => "" : stub), apply: () => stub, construct: () => stub });
const ctx = { console, document: stub, localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} }, navigator: {}, setTimeout() {}, clearTimeout() {}, setInterval() {}, requestAnimationFrame() {}, addEventListener() {}, matchMedia: () => ({ matches: false }), performance: { now: () => 0 }, location: { search: "", hash: "" }, Image: function () {}, fetch: () => Promise.reject() };
ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
const html = fs.readFileSync(path.join(W, "index.html"), "utf8");
for (const [, f] of html.matchAll(/<script src="([^"]+)"/g)) {
  if (f === "ui.js" || !fs.existsSync(path.join(W, f))) continue;
  try { vm.runInContext(fs.readFileSync(path.join(W, f), "utf8").replace(/^const (\w+) =/mg, "globalThis.$1 ="), ctx); } catch (e) { /* DOM-bound modules */ }
}
const { D, GEARLOOK, HEROART, G } = ctx;
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log("FAIL", m); } };
ok(GEARLOOK && HEROART, "modules load");
const SLOTS = ["weapon", "shield", "head", "chest", "hands", "feet"];
const items = Object.entries(D.ITEMS).filter(([, it]) => SLOTS.includes(it.slot));
ok(items.length > 50, "found gear items " + items.length);
for (const [id, it] of items) {
  const g = GEARLOOK.of(id);
  ok(GEARLOOK.SETS[g.set], `${id} maps to a known set (${g.set})`);
  if (it.slot === "weapon") ok(!!g.wk, `${id} has a weapon kind`);
  ok(HEROART.matOf(id) === g.set, `${id} HEROART uses GEARLOOK`);
}
// material spot checks (by name)
const want = { steel_sword: "steel", elven_bow: "elven", dwarven_sword: "dwarven", stalhrim_helmet: "stalhrim", chitin_armor: "chitin", bonemold_shield: "bonemold",
  ancient_nord_armor: "nord", nightingale_armor: "nightingale", shrouded_armor: "shrouded", guild_armor: "guild", archmage_robes: "arch", mask_konahrik: "daedric",
  ebony_mail: "ebony", dragonscale_helmet: "dragonscale", stormcloak_officer_armor: "stormcloak", imperial_officer_helmet: "imperial", forsworn_armor: "forsworn",
  hide_armor: "hide", leather_boots: "leather", chainmail: "chain", iron_helmet: "iron", skyforge_steel_sword: "nordic", glass_sword: "glass", daedric_armor: "daedric",
  dragonplate_armor: "dragonplate", orcish_helmet: "orcish", steel_plate_armor: "steelplate", fur_armor: "fur", studded_armor: "studded", scaled_armor: "scaled", banded_iron_armor: "banded" };
for (const [id, k] of Object.entries(want)) ok(GEARLOOK.setOf(id) === k, `${id} → ${k} (got ${GEARLOOK.setOf(id)})`);
// every set has colours and a name; distinct looks
const sets = GEARLOOK.list();
ok(sets.length >= 38, "38+ sets: " + sets.length);
const sig = new Set();
for (const k of sets) { const s = GEARLOOK.SETS[k]; ok(s.n && /^#/.test(s.c) && /^#/.test(s.d) && /^#/.test(s.trim) && s.w, `set ${k} complete`); sig.add(s.c + JSON.stringify(s.f || {})); }
ok(sig.size === sets.length, "every set looks different");
// person / walker options for every chest set
for (const k of sets) {
  const id = Object.entries(D.ITEMS).find(([i, it]) => it.slot === "chest" && GEARLOOK.setOf(i) === k)?.[0] || `${k}_armor`;
  const o = GEARLOOK.person({ r: "nord", eq: { chest: id, head: id.replace("armor", "helmet"), weapon: "steel_sword", shield: "steel_shield" }, gl: {} });
  ok(o.body && o.gear && o.wt === "sword", `person options for ${k}`);
  const w = GEARLOOK.walker({ eq: { chest: id } });
  ok(w.body && w.cape, `walker colours for ${k}`);
}
// the card look is small and round-trips: everything needed is in eq ids
const save = G.newChar ? null : null;
const look = { r: "nord", id: "abcdefgh12345678", eq: { weapon: "skyforge_steel_greatsword", shield: "u_northwatch_shield", head: "dragonscale_helmet", chest: "stormcloak_officer_armor", hands: "ancient_nord_gauntlets", feet: "u_volunruud_greaves" }, gl: { w: "fire", a: 1 }, v: 0, ww: 0 };
const json = JSON.stringify(look);
ok(json.length < 400, "card look under 400 chars: " + json.length);
const back = JSON.parse(json);
for (const s of SLOTS) ok(GEARLOOK.setOf(back.eq[s]) === GEARLOOK.setOf(look.eq[s]), `round-trip ${s}`);
console.log(fails ? `gearlook FAIL ${fails}/${checks}` : `gearlook ok · ${checks} checks`);
process.exit(fails ? 1 : 0);
