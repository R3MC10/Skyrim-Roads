const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// gear looks: every armour/weapon item maps to a material and silhouette, the compact card code round-trips and stays small,
// unknown items on a newer client still draw from the card code. W=/path/to/web/ node test_gearlook.js
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "smithing.js", "ammo.js", "craftfair.js", "daedric.js", "civilwar.js", "magic.js", "spellbook.js", "gearlook.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const gearIds = Object.keys(D.ITEMS).filter((k) => { const it = D.ITEMS[k]; return ["head", "chest", "hands", "feet", "shield"].includes(it.slot) || it.slot === "weapon" || (it.damage && it.slot !== "ammo"); });
OK(gearIds.length > 60, "plenty of gear items: " + gearIds.length);
const seen = new Set();
for (const id of gearIds) {
  const L = GEARLOOK.of(id);
  OK(L && GEARLOOK.M[L.m], "material for " + id + " → " + (L && L.m));
  const it = D.ITEMS[id];
  if (it.slot === "head") OK(["mask", "circlet", "hood", "coif", "furcap", "feathers", "horned", "crest", "closed"].includes(L.style), "helm style " + id + " " + L.style);
  if (it.slot === "shield") OK(["round", "kite", "tower"].includes(L.style), "shield style " + id);
  if (it.slot === "weapon" || it.damage) OK(["dagger", "sword", "axe", "mace", "greatsword", "battleaxe", "warhammer", "spear", "bow", "crossbow", "staff"].includes(L.wk), "weapon kind " + id + " " + L.wk);
  seen.add(L.m);
}
OK(seen.size >= 15, "many distinct materials in the game: " + seen.size);
// spot checks
OK(GEARLOOK.matOf("dwarven_helmet") === "dw" && GEARLOOK.of("dwarven_helmet").style === "closed", "dwarven helm closed");
OK(GEARLOOK.matOf("iron_helmet") === "ir" && GEARLOOK.of("iron_helmet").style === "horned", "iron helmet horned");
OK(GEARLOOK.of("chainmail_coif").style === "coif", "coif");
OK(GEARLOOK.of("mage_robes").style === "robe", "robes");
OK(GEARLOOK.of("nightingale_armor").m === "ng" && GEARLOOK.M.ng.cape, "nightingale has a cape");
OK(GEARLOOK.of("stormcloak_officer_armor").m === "sk" && GEARLOOK.of("imperial_officer_helmet").m === "im", "uniforms");
OK(GEARLOOK.of("steel_shield").style === "kite" && GEARLOOK.of("hide_shield").style === "round" && GEARLOOK.of("spellbreaker").style === "tower", "shield shapes");
OK(GEARLOOK.of("ench|iron_sword|fire").m === "ir", "enchanted ids resolve to their base");
// future items follow their name
for (const [id, m] of [["glass_cuirass", "gl"], ["daedric_helmet", "da"], ["ebony_shield", "eb"], ["orcish_boots", "or"], ["dragonplate_armor", "dp"], ["elven_gauntlets", "el"], ["scaled_armor", "sc"], ["steel_plate_armor", "sp"], ["banded_iron_shield", "bi"], ["studded_armor", "sd"], ["fur_armor", "fu"], ["nordic_carved_helmet", "nc"]])
  OK(GEARLOOK.matOf(id) === m, "prefix rule " + id + " → " + GEARLOOK.matOf(id));
// card code round trip + size
const eq = { head: "dwarven_helmet", chest: "dwarven_armor", hands: "steel_gauntlets", feet: "ancient_nord_boots", shield: "spellbreaker", weapon: "elven_sword" };
const code = GEARLOOK.encode(eq);
OK(code.length === 13, "13 chars: " + code);
const dec = GEARLOOK.decode(code);
OK(dec.head === "dw" && dec.chest === "dw" && dec.hands === "st" && dec.feet === "an" && dec.shield === "dw" && dec.weapon === "el" && dec.wk === "sword", "round trip " + JSON.stringify(dec));
OK(GEARLOOK.encode({}) === "------------f" && GEARLOOK.decode("------------f").chest === null, "naked code");
OK(GEARLOOK.decode("bad") === null && GEARLOOK.decode(null) === null, "junk codes ignored");
// a card from a newer client with items this client doesn't know: still drawn from the code
const card = { r: "nord", id: "x", eq: { chest: "future_glass_cuirass", weapon: "future_mace" }, g: "--gl------glm" };
const sl = GEARLOOK.slotsOf(card);
OK(sl.chest && sl.chest.m === "gl" && sl.weapon.m === "gl" && sl.wk === "mace", "unknown items fall back to the card code");
// an old card (no g) still works from item ids
const old = GEARLOOK.slotsOf({ r: "nord", eq: { chest: "steel_armor", head: "iron_helmet", weapon: "steel_battleaxe" } });
OK(old.chest.m === "st" && old.head.style === "horned" && old.wk === "battleaxe" && old.heavy, "old cards without a code");
// the whole look object published on a card stays small
const look = { r: "nord", id: "abcdefgh12", eq, g: code, gl: { w: "fire", a: 1 }, v: 0, ww: 0 };
OK(JSON.stringify(look).length < 300, "card look under 300 bytes: " + JSON.stringify(look).length);
// preview: wearing one item swaps that slot (and drops the shield for two-handers)
const pv = GEARLOOK.previewLook(look, "steel_battleaxe");
OK(pv.eq.weapon === "steel_battleaxe" && !pv.eq.shield && pv.g.endsWith("b"), "preview swaps weapon and drops the shield");
const pv2 = GEARLOOK.previewLook(look, "iron_helmet");
OK(pv2.eq.head === "iron_helmet" && pv2.g.startsWith("ir"), "preview helmet");
OK(GEARLOOK.ICON_WISHLIST.every((id) => D.ITEMS[id] || /^(stalhrim|chitin|bonemold)/.test(id)), "icon wishlist only names real items (Solstheim gear lives in solstheim.js)");
console.log("gearlook ok · " + n + " checks · " + seen.size + " materials in use");
`, c);
