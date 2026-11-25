/* Stacking statuses (stacks.js). W=/path/to/game/ node test_stacks.js — prints ALL OK.
   Statuses stack (more stacks = stronger), drop by 1 a turn, have caps, hard control builds Resolve and stays capped on
   bosses, enchantments (enchants2.js) can call STACKS.add(f, side, kind, n), and fight icons show the number with a tip. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "curses.js", "magic.js", "spellbook.js", "spellcraft.js", "shouts2.js", "foekit.js", "combo.js", "fxicons.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log("FAIL " + msg); } };
const S = c.STACKS, X = c.FXICONS;
const foe = (hp = 400, extra = {}) => Object.assign({ e: { name: "Bandit", health: hp }, ehp: hp, ehp0: hp, maxHp: 100, foeSt: {}, bleed: [], tags: new Set() }, extra);

// 1. more stacks = stronger, with diminishing returns past 4, and a cap
ok(S.eff(1) === 1 && S.eff(4) === 4 && S.eff(6) === 5, "eff: full value up to 4, then half per stack");
let f = foe();
S.add(f, "foe", "burn", 1, { per: 4, src: "foe" });
const d1 = f.foeSt.burn.dmg;
S.add(f, "foe", "burn", 2, { per: 4, src: "foe" });
ok(f.foeSt.burn.turns === 3, "burn: stacks add up (1 + 2 = 3)");
ok(f.foeSt.burn.dmg > d1, `burn: 3 stacks hurt more than 1 (${d1} -> ${f.foeSt.burn.dmg})`);
S.add(f, "foe", "burn", 50, { per: 4, src: "foe" });
ok(f.foeSt.burn.turns === S.CAP, "burn: capped at " + S.CAP + " stacks");
ok(f.foeSt.burn.dmg <= 0.05 * 400 + 0.5, "burn: a tick never takes more than 5% of a foe's health");
const boss = foe(2000, { e: { name: "Alduin", health: 2000, boss: true } });
S.add(boss, "foe", "burn", 10, { per: 200, src: "foe" });
ok(boss.foeSt.burn.dmg <= 0.025 * 2000 + 0.5, "burn on a boss: at most 2.5% of its health a tick");

// 2. the enchantments signature: STACKS.add(f, side, kind, n) with chill, burn, poison, vulnerable, ward
f = foe();
const me = Object.assign(foe(), { maxHp: 100 });
ok(S.add(f, "foe", "chill", 2) === 2 && S.get(f, "foe", "chill") === 2, "enchants: chill on the foe");
ok(S.add(f, "foe", "burn", 1) >= 1 && S.get(f, "foe", "burn") >= 1, "enchants: burn on the foe");
ok(S.add(f, "foe", "poison", 3) === 3 && f.foeSt.poison.dmg > 0, "enchants: poison on the foe");
ok(S.add(f, "foe", "vulnerable", 2) === 2 && S.get(f, "foe", "vuln") === 2, "enchants: vulnerable is the same as vuln");
ok(S.add(me, "me", "ward", 2) > 0 && me.ward > 0, "enchants: ward on you gives a ward");
ok(S.add(me, "me", "poison", 2) === 2 && me.kitDot && me.kitDot.turns === 2, "poison on you uses the foe-kit damage over time");

// 3. drop by 1 a turn
f = foe();
S.add(f, "foe", "vuln", 3); S.add(f, "foe", "weak", 1); S.add(f, "me", "might", 2);
S.tick(f, { me: "" });
ok(S.get(f, "foe", "vuln") === 2 && S.get(f, "foe", "weak") === 0 && S.get(f, "me", "might") === 1, "plain stacks drop by 1 a turn (and vanish at 0)");
S.add(f, "foe", "poison", 2, { per: 5, src: "foe" });
const hp0 = f.ehp; S.tick(f, { me: "" });
ok(f.ehp < hp0, "poison on a foe hurts at the end of the round");
const al = { name: "Lydia" };
S.add(f, al, "might", 2); f.allies = [al]; S.tick(f, { me: "" });
ok(al.stk.might === 1, "allies' stacks drop by 1 too");
ok(S.allyBonus(al) > 0, "an ally with Might hits harder");

// 4. what stacks do in a fight
f = foe(); S.add(f, "foe", "vuln", 4);
const before = f.ehp; f.ehp -= 40; const txt = S.after(f, "attack", before);
ok(/from stacks/.test(txt) && before - f.ehp > 40, "Vulnerable: your hit lands harder (" + txt + ")");
S.add(f, "foe", "vuln", 10); S.add(f, "foe", "sunder", 10); S.add(f, "me", "might", 10);
ok(S.hitBonus(f, "attack") <= 0.45, "the stack bonus to a hit is capped at +45% (no one-shots)");
f = foe(); S.add(f, "foe", "chill", 3); S.add(f, "foe", "weak", 2);
ok(S.foeSoften(f) > 0 && S.foeSoften(f) <= 0.3, "Chill and Weak soften the foe's blows (capped at 30%)");
ok(S.foeInit(f) === 3, "Chill slows the foe's initiative");

// 5. hard control: Resolve, and bosses stay capped
f = foe();
f.eParalyzed = 3; S.sync(f);
ok(f.eParalyzed === 3 && S.get(f, "foe", "resolve") === 1, "first paralysis lands in full and gives 1 Resolve");
f.eParalyzed = 0; S.sync(f);
f.eParalyzed = 3; S.sync(f);
ok(f.eParalyzed === 2, "second paralysis is a turn shorter (Resolve) — got " + f.eParalyzed);
const b2 = foe(3000, { e: { name: "Dragon", health: 3000, boss: true } });
b2.eParalyzed = 1; S.sync(b2); b2.eParalyzed = 3; S.sync(b2);
ok(b2.eParalyzed <= 3, "a boss's paralysis never stacks past what one spell gives");
ok(S.get(b2, "foe", "resolve") >= 2, "bosses build Resolve twice as fast");

// 6. icons: the number on the chip and a tip that explains it
f = foe(); S.add(f, "foe", "vuln", 3); S.add(f, "foe", "burn", 2, { per: 3, src: "foe" });
const chips = X.foe(f);
const v = chips.find((x) => x.k === "vuln"), bn = chips.find((x) => x.k === "burning");
ok(v && v.n === 3 && v.stk, "Vulnerable chip shows 3");
ok(v && /3 stacks/.test(v.tip) && /Drops by 1 each turn/.test(v.tip), "Vulnerable tip explains the stacks: " + (v && v.tip));
ok(bn && bn.n === 2 && /2 stacks/.test(bn.tip), "Burning chip shows its stacks");
ok(S.tipFor("winded", 1).includes("1 stack."), "one stack reads '1 stack'");

// 7. every stack kind has a tip, and Polish covers them
const pl = fs.readFileSync(W + "i18n_stacks.js", "utf8");
for (const k of Object.keys(S.TIP)) ok(pl.includes(JSON.stringify(S.TIP[k])), `Polish for the ${k} tip`);

console.log(fails ? fails + " FAILED" : "ALL OK");
process.exit(fails ? 1 : 0);
