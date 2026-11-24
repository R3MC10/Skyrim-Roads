/* Buff and debuff icons in fights (fxicons.js). W=/path/to/game/ node test_fxicons.js — prints ALL OK.
   Lists every effect type the engine can put on someone (spell kinds, shouts and powers, potions/food/shrines, foe moves,
   statuses, ally spells) and checks each has an icon and a tooltip with real words, and that a fighter carrying it shows it. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "curses.js", "magic.js", "spellbook.js", "spellcraft.js", "shouts2.js", "foekit.js", "combo.js", "fxicons.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log("FAIL " + msg); } };
const R = vm.runInContext(`(() => {
  const X = FXICONS, out = { types: Object.keys(X.TYPES), kinds: [], powers: [], potions: [] };
  for (const sp of Object.values(D.SPELLS)) out.kinds.push(sp.kind);
  for (const k of Object.keys(MAGIC.KINDS)) out.kinds.push(k);
  for (const k of Object.keys(POWERS.SHOUTS)) if (!POWERS.ROAD_SHOUTS.includes(k)) out.powers.push(k);
  for (const k of Object.keys(POWERS.RACE)) out.powers.push(k);
  out.powers.push("serpent", "ritual", "shadow", "tower", "beast", "lord");
  for (const [nm, e] of Object.entries(EFFECTS)) if (e[3] !== "none" && !String(e[3]).startsWith("restore:") && !String(e[3]).startsWith("poison")) out.potions.push([nm, e[3]]);
  return out;
})()`, c);
const X = c.FXICONS;

// 1. every type: an icon, a name and a tooltip with words (and numbers where it has them)
const SAMPLE = { n: 3, amt: 12, max: 40, red: 0.2, dot: 5, el: "fire", name: "Oakflesh", what: "health", left: "5m", tip: "Weak to fire: fire spells do 25% more." };
for (const k of R.types) {
  const [ic, nm, buff, tip] = X.TYPES[k];
  ok(typeof ic === "string" && ic.trim().length > 0, `${k}: has an icon`);
  ok(typeof nm === "string" && nm.length > 2, `${k}: has a name`);
  ok(typeof buff === "boolean", `${k}: is marked buff or debuff`);
  const t = tip(SAMPLE);
  ok(typeof t === "string" && t.length >= 12 && !/undefined|NaN/.test(t), `${k}: tooltip reads well (${t})`);
}
// 2. every kind of spell the game has is listed, with types that exist
for (const k of new Set(R.kinds)) {
  ok(k in X.SPELL_KIND, `spell kind "${k}" is listed in FXICONS.SPELL_KIND`);
  for (const ty of X.SPELL_KIND[k] || []) ok(X.TYPES[ty], `spell kind ${k} → ${ty} has an icon`);
}
// 3. every shout, racial power and stone power
for (const k of R.powers) {
  ok(k in X.POWER_FX, `power/shout "${k}" is listed in FXICONS.POWER_FX`);
  for (const ty of X.POWER_FX[k] || []) ok(X.TYPES[ty], `power ${k} → ${ty} has an icon`);
}
// 4. a fighter carrying each effect shows it
const has = (list, k) => list.some((x) => x.k === k && x.ic && x.tip && x.tip.length > 10);
const S = { level: 10, fx: [], skills: {} };
const base = () => ({ s: { ...S, fx: [] }, t: 1000, pw: {}, foeSt: {}, meSt: {}, allies: [], tags: new Set(), e: { name: "Bandit", damage: 10 } });
const ME = {
  armour: { armorSpell: 40 }, ward: { ward: 30, wardMax: 50 }, healing: { regen: { amt: 8, turns: 3, name: "Healing Hands" } },
  cloak: { cloak: { dmg: 6, el: "fire", turns: 4, name: "Flame Cloak" } }, rune: { rune: { dmg: 30, el: "fire", name: "Fire Rune" } },
  bound: { bound: { dmg: 12, name: "bound sword" } }, invisible: { unseen: 2 }, sneak: { sneakNext: true }, courage: { braveHp: 20 },
  summon: { summonTurns: 5, summonDmg: 9, summonName: "Flame Atronach" }, reanimate: { reanimate: { max: 10, fights: 2, name: "Raise Zombie" } },
  guard: { tbGuard: 0.3 }, poisoned: { kitDot: { name: "poison", dmg: 4, turns: 3 } }, bleeding: { kitDot: { name: "bleeding", dmg: 4, turns: 3 } },
  burning: { meSt: { burn: { dmg: 5, turns: 2 } } }, chilled: { meSt: { chill: { turns: 2 } } }, jolted: { meSt: { shock: { turns: 1 } } },
  winded: { stk: { me: { winded: 2 } } }, drained: { stk: { me: { drained: 1 } } }, might: { stk: { me: { might: 2 } } }, haste: { stk: { me: { haste: 1 } } }, spent: { bpTired: 2 },
  pw_rage: { pw: { rage: 5 } }, pw_adren: { pw: { adren: 5 } }, pw_high: { pw: { high: 5 } }, pw_cloak: { pw: { cloak: 5 } }, pw_hist: { pw: { hist: 5 } }, pw_skin: { pw: { skin: 5 } },
  pw_ether: { pw: { ether: 3 } }, pw_aspect: { pw: { aspect: 0.2, aspectRed: 0.15 } }, pw_fury: { pw: { fury: 4, furyMult: 0.2 } }, pw_storm: { pw: { storm: 4, stormDmg: 15 } },
  beast: { pw: { beast: 6 } }, lord: { pw: { lord: 6 } },
};
for (const [k, set] of Object.entries(ME)) { const f = Object.assign(base(), set); ok(has(X.me(f, { ev: [{ text: "Oakflesh: +40 armor" }] }), k), `you: ${k} shows`); }
{ const f = base(); f.s.poison = { name: "Deathbell poison", hits: 2, effects: [] }; ok(has(X.me(f), "poisoned_blade"), "you: a poisoned weapon shows"); }
{ const f = base(); f.armorSpell = 40; ok(X.me(f, { ev: [{ text: "Oakflesh: +40 armor" }] }).some((x) => x.nm === "Oakflesh"), "the armour spell is named after the spell you cast (+Oakflesh)"); }
{ const f = base(); f.s.vampire = true; f.s.vampAte = 0; ok(has(X.me(f), "vampire"), "you: vampirism shows"); }
{ const f = base(); f.s.sanguinare = true; ok(has(X.me(f), "sanguinare"), "you: Sanguinare Vampiris shows"); }
// potions, food and shrines: every lasting alchemy effect shows with its timer
for (const [nm, key] of R.potions) {
  const f = base(); f.s.fx = [{ key, mag: 10, until: 1000 + 600, name: nm }];
  const l = X.me(f);
  ok(l.length === 1 && l[0].tip.includes(nm) && l[0].left === "10m", `potion "${nm}" (${key}) shows on you with its time left`);
}
const FOE = {
  burning: { foeSt: { burn: { dmg: 6, turns: 3 } } }, chilled: { foeSt: { chill: { turns: 2 } } }, jolted: { foeSt: { shock: { turns: 2 } } }, bleeding: { bleed: [{ dmg: 3, turns: 3 }] },
  paralyzed: { eParalyzed: 2 }, stunned: { tbStunLeft: 1 }, staggered: { stagger: true }, slowed: { slowed: 2 }, calm: { calmTurns: 4 }, fear: { fearTurns: 3 },
  rattled: { fcap: { rattled: 2 } }, shaken: { shaken: 3 }, disarmed: { disarmed: 2 }, disarm_shout: { pw: { disarm: 0.3 } }, marked: { pw: { mark: 0.25, markDot: 6 } },
  rend: { pw: { rend: 0.25 }, tags: new Set(["dragon"]) }, ground: { dots: [{ dmg: 8, el: "fire", turns: 3, name: "Wall of Flames" }] }, soultrap: { soulTrap: true }, flying: { dStance: "air" },
  vuln: { stk: { foe: { vuln: 2 } } }, sunder: { stk: { foe: { sunder: 1 } } }, weakened: { stk: { foe: { weak: 2 } } }, resolve: { stk: { foe: { resolve: 1 } } },
  kit_windup: { kit: { windup: "big" } }, kit_guard: { kit: { guard: 1 } }, kit_ward: { kit: { ward: 2 } }, kit_evade: { kit: { evade: 1 } }, kit_rage: { kit: { rage: 2 } },
};
for (const [k, set] of Object.entries(FOE)) { const f = Object.assign(base(), set); ok(has(X.foe(f), k), `foe: ${k} shows`); }
const AL = { ward: { ward: 30, reflect: 0.2 }, stoneskin: { armorT: 4, armorRed: 0.3 }, imbue: { imbue: { dmg: 6, el: "fire", turns: 4, name: "Fire blade" } },
  thorns: { thorns: { dmg: 5, el: "shock", turns: 3 } }, heroism: { heroT: 3, dmg: 12, _baseDmg: 10 }, invisible: { unseen: 2 }, guard: { tbGuard: 0.3 } };
for (const [k, set] of Object.entries(AL)) ok(has(X.ally(base(), { name: "Lydia", hp: 50, ...set }), k), `ally: ${k} shows`);
ok(has(X.ally(base(), { name: "Lydia", hp: 0 }, true), "down"), "ally: knocked down shows (never dead)");
// every type in the list is reachable from at least one of the checks above
const seen = new Set([...Object.keys(ME), ...Object.keys(FOE), ...Object.keys(AL), "dazed", "regen_stk", "poisoned_blade", "vampire", "sanguinare", "down", "sunlight", "weak", "resist",
  ...R.potions.map(([, key]) => X.me(Object.assign(base(), { s: { fx: [{ key, mag: 1, until: 2000, name: "x" }] } }))[0]?.k)]);
for (const k of R.types) ok(seen.has(k), `${k}: covered by a test fighter`);
// the icons row is safe HTML with the tooltip on it
const h = X.html(X.foe(Object.assign(base(), { eParalyzed: 2, foeSt: { burn: { dmg: 6, turns: 3 } } })), "foe");
ok(/class="c2fx foe"/.test(h) && (h.match(/data-tip="/g) || []).length === 2 && /<small aria-hidden="true">2<\/small>/.test(h), "icons row: one icon per effect, a tooltip each, turns left as a number");
console.log(`${R.types.length} effect types, ${new Set(R.kinds).size} spell kinds, ${R.powers.length} powers and shouts, ${R.potions.length} potion effects checked`);
console.log(fails ? `${fails} FAILED` : "ALL OK");
process.exit(fails ? 1 : 0);
