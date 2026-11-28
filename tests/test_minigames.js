/* Unique fight minigames [mgunique] (minigame.js + mg_games.js). W=/path/to/game/ node test_minigames.js — ALL OK.
   Owner: "Mini games in combat should be unique by weapon type, by spell school, by action."
   Every weapon type, spell school / element and move maps to its own game id, every id has a registered game,
   grades and multipliers are unchanged (Good = normal hit), skill still widens the window, and the timing score
   gives Perfect inside the window, Good a little outside, Miss far off. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, structuredClone, RUNS: 1 };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "stacks.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "minigame.js", "mg_games.js", "initiative.js", "tbfight.js", "followers2.js", "followerai.js", "strategy.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
const ST = fs.readFileSync(require("path").join(__dirname, "test_strategy.js"), "utf8");
const a0 = ST.indexOf("vm.runInContext(`") + "vm.runInContext(`".length, a1 = ST.indexOf("`, c);", a0);
vm.runInContext(ST.slice(a0, a1), c);

vm.runInContext(`(() => {
const { fresh, enc, ok } = H, M = MINIGAME;
const s0 = fresh("warrior", 20), f0 = new G.Fight(s0, enc("Bandit outlaw", 20));
const as = (patch) => Object.assign(Object.create(Object.getPrototypeOf(f0)), f0, { off: null, hidden: false, sneakNext: false, turn: 2 }, patch);
const id = (f, a) => (M.kindFor(f, a) || {}).id;

// 1. every weapon type its own game; power attacks keep the same game, harder
const WT = ["dagger", "sword", "axe", "mace", "greatsword", "battleaxe", "warhammer", "spear", "bow", "crossbow", "fist"];
for (const wt of WT) {
  const f = as({ wt });
  ok(id(f, "attack") === wt, wt + ": its own game (" + id(f, "attack") + ")");
  const p = M.kindFor(f, "power_attack");
  ok(p && p.id === wt && (p.kind === "power" || p.hard), wt + ": a power attack is the same game, harder");
}
ok(new Set(WT.map((wt) => id(as({ wt }), "attack"))).size === WT.length, "no two weapon types share a game");
ok(id(as({ wt: "sword", off: D.ITEMS[Object.keys(D.ITEMS).find((k) => D.ITEMS[k].type === "weapon")] || {} }), "attack") === "dual", "two blades: the two-lane game");

// 2. moves
ok(id(f0, "block") === "guard" && id(f0, "bash") === "bash", "guard and shield bash are different games");
ok(["arrow", "claw", "spell", "blade"].includes(M.kindFor(as({}), "block").foe), "the guard game knows what blow is coming");
ok(M.incoming({ e: { name: "Bandit archer" } }) === "arrow" && M.incoming({ e: { name: "Wolf" } }) === "claw" && M.incoming({ e: { name: "Necromancer" } }) === "spell" && M.incoming({ e: { name: "Bandit chief" } }) === "blade", "arrow / claw / spell / blade by the foe");
ok(id(as({ hidden: true, turn: 1 }), "attack") === "sneak" && id(as({ sneakNext: true }), "attack") === "sneak", "a sneak opener gets the stealth game");
ok(id(as({ hidden: true, turn: 3 }), "attack") !== "sneak", "after the opener a blow is a normal blow again");
const sh = M.kindFor(f0, "shout:fus");
ok(sh && sh.id === "shout" && sh.words >= 1 && sh.words <= 3, "shouts get a game with 1-3 word beats");
ok(M.grade(0.9, sh).mult === M.GRADES.normal.perfect && M.grade(0.5, sh).mult === 1, "a shout grades like a blow (Good = normal)");
ok(M.kindFor(f0, "flee") === null && M.kindFor(f0, "potion:health") === null && M.kindFor(f0, "end") === null, "flee, potions and End turn still have no game (there's no dodge move)");

// 3. spells by school and element
const pick = (pred) => Object.keys(D.SPELLS).find((k) => pred(D.SPELLS[k]));
for (const el of ["fire", "frost", "shock"]) { const k = pick((s) => s.school === "Destruction" && s.element === el && s.kind === "damage"); if (k) ok(id(f0, "spell:" + k) === "destruction-" + el, "Destruction " + el + ": its own game"); }
for (const sc of ["Restoration", "Alteration", "Conjuration", "Illusion", "Mysticism"]) { const k = pick((s) => s.school === sc && s.kind !== "utility"); if (k) ok(id(f0, "spell:" + k) === sc.toLowerCase(), sc + ": its own game (" + id(f0, "spell:" + k) + ")"); }
const fk = pick((s) => s.school === "Destruction" && s.element === "fire" && s.kind === "damage");
ok(M.kindFor(f0, "dual:" + fk).dual === true && M.kindFor(f0, "spell:" + fk).dual !== true, "a dual cast is marked for the two-thumb game");
ok(M.SCHOOLS.Mysticism && M.SCHOOLS.Mysticism.pts.length >= 3, "Mysticism has its own rune for the simple game");

// 4. every id has a registered game (or a deliberate fallback)
const need = WT.concat(["dual", "guard", "bash", "shout", "sneak", "destruction-fire", "destruction-frost", "destruction-shock", "restoration-ally", "alteration", "conjuration", "mysticism", "dualcast"]);
for (const n of need) ok(typeof M.REG[n] === "function", "game registered: " + n);
ok(!M.REG.restoration && !M.REG.illusion && !M.REG.staff, "Restoration's calm circle, Illusion's drifting wisps and a staff's school rune use the rune game");

// 5. grades and widening unchanged
ok(M.grade(0.5, { kind: "strike" }).mult === 1 && M.grade(0.9, { kind: "power" }).mult === 1.4 && M.grade(0.1, { kind: "power" }).mult === 0.75, "grade tables unchanged");
const lo = fresh("warrior", 5), hi = fresh("warrior", 40);
const flo = new G.Fight(lo, enc("Bandit outlaw", 5)), fhi = new G.Fight(hi, enc("Bandit outlaw", 40));
ok(M.width(fhi, "attack", M.kindFor(fhi, "attack")) > M.width(flo, "attack", M.kindFor(flo, "attack")), "higher skill still widens every game's window");

// 6. timing score: inside the window Perfect, a bit off Good, far off a Miss
const t = MGGAMES.tscore;
ok(M.grade(t(0, 80), { kind: "strike" }).cls === "perfect" && M.grade(t(80, 80), { kind: "strike" }).cls === "perfect", "on time = Perfect");
ok(M.grade(t(150, 80), { kind: "strike" }).cls === "good", "a little late = Good");
ok(M.grade(t(400, 80), { kind: "strike" }).cls === "poor", "way off = Miss");
ok(t(1e9, 80) === 0 && t(0, 80) === 1, "score stays in 0..1");
// 7. simple mode is a setting, default off
ok(M.simple() === false, "unique games by default; Settings can switch to Simple (one tap)");
ok(/tbGamesSimple/.test(M.settingsHTML((k) => k)), "the Simple option is in Settings");
})();`, c);
const fails = c.H.fails();
console.log(fails ? fails + " FAILED" : "ALL OK");
process.exit(fails ? 1 : 0);
