/* The short [AI] reasons in fight logs (combatai.js shortWhy, tbfight.js). The old "What would the AI do?" tester is gone.
   W=/path/to/game/ node test_aireasons.js  - prints ALL OK. Only auto-played moves get "[AI] reason". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, structuredClone };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "sneak2.js", "aiset.js", "foeintent.js", "initiative.js", "tbfight.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const ok = (v, m) => { n++; if (!v) throw new Error("FAIL " + m); };
function hero(lvl = 12) {
  const s = G.newSave("ait", "Tess", "nord"); s._test = true; s.level = lvl; s.hpBonus = 60; s.spBonus = 40; s.mpBonus = 40;
  G.give(s, "potion_health_minor", 3);
  if (D.SPELLS.flames && !s.spells.includes("flames")) s.spells.push("flames");
  if (D.SPELLS.healing && !s.spells.includes("healing")) s.spells.push("healing");
  return s;
}

// 7) short reasons never change a pick and always say something
{ ok(COMBATAI.shortWhy("attack", "") === "steady damage" && COMBATAI.shortWhy("attack", "finishing blow") === "finishing blow", "shortWhy keeps the real reason, fills the blanks");
  const s = hero(), f = new G.Fight(G.clone(s), G.clone(G.scaleEnemy(D.ENCOUNTERS.find((x) => x.name === "Bandit outlaw") || D.ENCOUNTERS[0], s.level)));
  const a1 = COMBATAI.decide(f).action, rk = COMBATAI.rank(f, 5), a2 = COMBATAI.decide(f).action;
  ok(a1 === a2 && rk.length >= 1, "rank() doesn't change the choice"); }

// 8) instant fights: AI lines carry a reason; custom rule lines don't get [AI]
{ const s = hero(), L = G.loadout(s); L.mode = "smart"; const e = G.scaleEnemy(D.ENCOUNTERS.find((x) => x.name === "Bandit outlaw") || D.ENCOUNTERS[0], s.level);
  const f = new G.Fight(G.clone(s), G.clone(e)); f.run();
  ok(f.log.filter((l) => l.ai).length >= 1 && f.log.some((l) => l.ai && l.why), "Smart AI lines have a reason");
  const s2 = hero(); G.loadout(s2).mode = "custom"; const f2 = new G.Fight(G.clone(s2), G.clone(e)); f2.run();
  ok(!f2.log.some((l) => l.ai), "custom rules: no [AI] tag"); }

// 9) turn-based: auto-played moves end with "[AI] reason", moves you pick don't
if (typeof TB !== "undefined") {
  const s = hero(), e = G.scaleEnemy(D.ENCOUNTERS.find((x) => x.name === "Bandit outlaw") || D.ENCOUNTERS[0], s.level);
  const ss = TB.simulate(new G.Fight(G.clone(s), G.clone(e)), { trySneak: false });
  const mine = ss.ev.filter((x) => x.who === "me" && x.kind === "me");
  ok(mine.length && mine.every((x) => / \\[AI\\] \\S/.test(x.text)), "auto fight: every move of yours says [AI] why (" + (mine[0] && mine[0].text) + ")");
  ok(ss.f.log.some((l) => l.ai && l.why), "the round line knows the AI played it");
  const f2 = new G.Fight(G.clone(s), G.clone(e)), s2 = new TB.Session(f2, { trySneak: false }); let r = s2.begin(), g = 0;
  while (!s2.done && g++ < 200) { if (r.turn === "me" || s2.cur?.id === "me") { const x = s2.act("attack"); if (x && x.turn === "me") s2.act("end"); } r = s2.advance(); }
  const own = s2.ev.filter((x) => x.who === "me" && x.kind === "me");
  ok(own.length && !own.some((x) => /\\[AI\\]/.test(x.text)), "moves you pick have no [AI] note");
  ok(!f2.log.some((l) => l.ai), "and the rounds you played aren't marked [AI]");
}
console.log("ALL OK (" + n + " checks)");
`, c);
