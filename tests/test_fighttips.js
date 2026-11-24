// Fight-screen tooltips (fighttips.js): every fight key turns into a tooltip with real numbers, greyed moves say why,
// afraid / calmed / rattled foes get chips. node test_fighttips.js — prints "fighttips ok".
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RUNS: 1 });
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const FILES = JSON.parse(TBT.match(/for \(const f of (\[[^\]]+\])\)/)[1]).filter((f) => f !== "tbfight.js")
  .concat(["foekit.js", "tbfight.js", "tbtips.js", "fightctl.js", "skillinfo.js", "tooltip.js", "fighttips.js"]);
for (const f of [...new Set(FILES)]) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, D, TB, TIP, FIGHTTIPS: FT } = c;
const text = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ").trim();
const clean = (h) => typeof h === "string" && h.length > 10 && !/undefined|NaN|\[object/.test(h);
ok(FT && typeof FT.html === "function" && typeof FT.decorate === "function", "fighttips loads");
ok(TIP.providers.includes("fa"), "the fight provider is registered with tooltip.js");
ok(typeof TIP.eatClick === "function", "tooltip.js hands its click eater to the fight screen");

// a mage at level 20 against a bandit, with a known spell list
const s = c.make("mage", 20); s.health = G.maxHealth(s); s.healthTs = G.now();
for (const id of ["flames", "healing", "greater_ward", "fear"]) if (D.SPELLS[id] && !s.spells.includes(id)) s.spells.push(id);
const e = G.scaleEnemy({ name: "Bandit", health: 260, damage: 14, tags: ["humanoid"], level: 20, danger: "medium", gold: [0, 0], text: "" }, 20);
const f = new G.Fight(s, e); f.allies = [];
const sess = Object.assign(Object.create(TB.Session.prototype), { f, myActs: 0, pots: 0, used: {}, st: { acts: 4, pots: 2, spCut: 0, mpCut: 0, init: 12 }, ehpMax: Math.round(f.ehp) });   // build 146: no AP, moves cost stamina / magicka

// spells: what it does, numbers with perks, single and dual, magicka, cost, how long
{ const h = FT.html(sess, "spell:flames"); ok(clean(h), "Flames tooltip " + text(h));
  ok(/Flames/.test(h) && /Destruction/.test(h) && /magicka/i.test(h) && /Costs <b>\d+ magicka/.test(h), "names, school, magicka and the cost");
  ok(h.includes(String(Math.round(G.spellDamage(s, D.SPELLS.flames)))), "the damage with your perks " + Math.round(G.spellDamage(s, D.SPELLS.flames)));
  ok(/Dual cast/.test(h), "the dual cast row");
  ok(/turns?/.test(text(h)), "how long the burn lasts");
  ok(/drag it onto the foe/.test(h), "how to use it");
  const d = FT.html(sess, "dual:flames"); ok(clean(d) && /dual cast/.test(d) && /Both hands/.test(d), "Dual button " + text(d));
  ok(/Costs <b>/.test(d) && d.includes(String(TB.cost(f, "dual:flames", sess).mp)), "dual magicka cost");
  const heal = Object.keys(D.SPELLS).find((k) => D.SPELLS[k].kind === "heal" && s.spells.includes(k));
  if (heal) ok(/onto yourself or a teammate/.test(FT.html(sess, "spell:" + heal)), "a heal goes on yourself or a teammate");
  const ward = s.spells.find((k) => D.SPELLS[k]?.kind === "ward");
  if (ward) ok(/soak/i.test(FT.html(sess, "spell:" + ward)), "a ward says what it soaks");
}
// greyed out: why, with the numbers
{ f.mp = 10; const sp = D.SPELLS.flames, need = Math.ceil(G.spellCost(s, sp));
  if (need > 10) { const h = FT.html(sess, "spell:flames"); ok(/tt-dn/.test(h) && new RegExp(`Need ${need - 10} more magicka: you have 10, it needs ${need}`).test(h), "not enough magicka: " + text(h)); }
  f.mp = G.maxMagicka(s);
  sess.myActs = 4;
  const a = FT.html(sess, "attack"); ok(/tt-dn/.test(a) && /4 moves a turn/.test(a), "out of moves: " + text(a));
  sess.myActs = 1; f.sp = 0;
  const a2 = FT.html(sess, "attack"); ok(/Need \d+ more stamina: you have 0, it needs \d+/.test(a2), "out of stamina: " + text(a2));
  sess.myActs = 0; f.sp = G.maxStamina(s);
  f.sp = 0; const p = FT.html(sess, "power_attack"); ok(/tt-dn/.test(p) && /stamina/.test(p), "power attack without stamina: " + text(p)); f.sp = G.maxStamina(s);
  ok(!/tt-dn/.test(FT.html(sess, "attack")), "an attack you can afford isn't flagged");
}
// the big buttons, potions, scrolls
{ for (const a of ["attack", "power_attack", "block", "flee", "end"]) ok(clean(FT.html(sess, a)), "move " + a + ": " + text(FT.html(sess, a)).slice(0, 80));
  ok(/damage/.test(FT.html(sess, "attack")), "attack gives damage");
  ok(/Stamina/.test(FT.html(sess, "power_attack")), "power attack gives its stamina cost");
  ok(/Guard/.test(FT.html(sess, "end")), "end turn says what the moves you don't make give");
  G.give(s, "potion_health");
  const cnt = s.inv.filter((r) => D.ITEMS[r.item]?.slot === "potion" && D.ITEMS[r.item].restore?.[0] === "health").reduce((t, r) => t + r.qty, 0);
  const h = FT.html(sess, "potion:health"); ok(clean(h) && /Restores/.test(h) && new RegExp(`Left <b>${cnt}<`).test(h), "a health potion: what it restores and how many " + text(h));
  const sc = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "scroll" && D.SPELLS[D.ITEMS[k].spell]);
  if (sc) { G.give(s, sc); ok(clean(FT.html(sess, "scroll:" + sc)) && /uses the scroll up/.test(FT.html(sess, "scroll:" + sc)), "a scroll"); }
}
// the AP row, bars, you, the foe, menus, filters
{ ok(/Moves/.test(FT.html(sess, "ap")) && /0\/4/.test(FT.html(sess, "ap")) && /stamina/i.test(FT.html(sess, "ap")), "moves row " + text(FT.html(sess, "ap")));
  for (const k of ["hp", "mp", "sp"]) ok(clean(FT.html(sess, k)) && /Now/.test(FT.html(sess, k)), "bar " + k);
  ok(/Cheapest spell/.test(FT.html(sess, "mp")), "magicka bar names the cheapest spell " + text(FT.html(sess, "mp")));
  ok(/Armour/.test(FT.html(sess, "me")) && /Initiative/.test(FT.html(sess, "me")), "you: armour and initiative");
  const fo = FT.html(sess, "foe"); ok(clean(fo) && /Bandit/.test(fo) && /Health/.test(fo) && /Hits for/.test(fo), "the foe " + text(fo));
  for (const k of ["menu:magic", "menu:items", "back", "filter:all", "filter:fav", "filter:Destruction"]) ok(clean(FT.html(sess, k)), "menu bit " + k);
  ok(FT.html(null, "attack") === null && FT.html(sess, "") === null, "no fight, no tooltip");
}
// afraid, calmed, rattled foes get chips with words
{ f.fearTurns = 2; f.calmTurns = 1; f.fcap = { rattled: 3 };
  const ch = FT.foeChips(f); ok(/Afraid/.test(ch) && /2 more turns/.test(ch) && /Calmed/.test(ch) && /1 more turn\./.test(ch) && /Rattled/.test(ch) && /20% softer/.test(ch), "status chips " + text(ch));
  f.fearTurns = 0; f.calmTurns = 0; f.fcap = null; ok(FT.foeChips(f) === "", "no chips when nothing's on it");
}
// the Polish file has every new fixed line
{ const pl = fs.readFileSync(W + "i18n_fighttips.js", "utf8");
  for (const t of ["Moves made", "Make up to 4 moves a turn. Blows and guards cost stamina, spells magicka: the coloured numbers on each button.", "Drag attacks and spells here.", "Tooltips in fights"]) ok(pl.includes(JSON.stringify(t)), "Polish for " + t);
}
console.log(fails ? `${fails}/${n} FAILED` : `fighttips ok (${n} checks)`);
process.exit(fails ? 1 : 0);
