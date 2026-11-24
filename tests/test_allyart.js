const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Ally figures in the fight scene: every kind of helper the engine can put beside you maps to its own figure.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "guide.js", "magic.js", "spellcraft.js", "priests.js", "curses.js", "shouts2.js", "mp.js", "party.js", "art.js", "fightart.js"];
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, performance: { now: () => 0 } };
vm.createContext(c);
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
  const ok = (v, m) => { if (!v) throw new Error("FAIL " + m); };
  const K = (a) => FIGHTART.allyKind(a);
  // what the engine pushes, and the names it uses
  const cases = [
    [{ name: "Lydia", follower: true, fid: "lydia", kind: "follower" }, "follower"],
    [{ name: "Jenassa", follower: true }, "follower"],
    [{ name: "Alfa", look: { r: "nord", eq: {} } }, "mate"],
    [{ name: "Bandit thrall", thrall: true }, "zombie"],
    [{ name: "Risen dead", dmg: 8 }, "zombie"],
    [{ name: "Ice wolf", dmg: 8 }, "icewolf"],
    [{ name: "Werewolf brother", dmg: 16 }, "werewolf"],
    [{ name: "Gargoyle", dmg: 16 }, "gargoyle"],
    [{ name: "Dremora", dmg: 9 }, "dremora"],
    [{ name: "Ysgramor", valor: true }, "valor"],
    [{ name: "Odahviing", odah: true }, "odah"],
    [{ name: "A bent dragon", dmg: 22 }, "dragon"],
    [{ name: "Wild animal", beast: true }, "beast"],
    [{ name: "Flame Atronach" }, "flame_atronach"],
    [{ name: "Frost Atronach" }, "frost_atronach"],
    [{ name: "Storm Atronach" }, "storm_atronach"],
    [{ name: "Imperial soldier", dmg: 10 }, "soldier"],
  ];
  for (const [a, want] of cases) ok(K(a) === want, a.name + " -> " + K(a) + " (want " + want + ")");
  ok(FIGHTART.summonKind("conjure_familiar", "Conjure Familiar") === "familiar", "familiar summon");
  ok(FIGHTART.summonKind("dremora_lord", "Conjure Dremora Lord") === "dremora", "dremora summon");
  ok(FIGHTART.summonKind("x", "conjure flame atronach") === "flame_atronach", "atronach summon");
  // every kind draws without throwing on a recording canvas, and kinds draw differently
  const sig = {};
  for (const k of FIGHTART.ALLY_KINDS) {
    const ops = []; const g = new Proxy({}, { get: (t, p) => p === "createRadialGradient" || p === "createLinearGradient" ? () => ({ addColorStop() {} }) : p === "measureText" ? () => ({ width: 10 }) : (...a) => { ops.push(String(p) + ":" + a.map((x) => typeof x === "number" ? Math.round(x) : typeof x).join(",")); }, set: (t, p, v) => { ops.push(String(p) + "=" + v); return true; } });
    FIGHTART.allyFig(g, k, { lunge: 0.5, t: 1.2, i: 0, look: k === "mate" || k === "follower" ? PARTY.followerLook("lydia") : null });
    ok(ops.length > 10, "figure draws for " + k);
    sig[k] = ops.join("|");
  }
  const distinct = new Set(Object.values(sig)).size;
  ok(distinct >= FIGHTART.ALLY_KINDS.length - 1, "figures are distinct " + distinct + "/" + FIGHTART.ALLY_KINDS.length);   // a follower and a party member can share a look
  // the engine tags its allies
  const s = G.newSave("A", "T", "nord"); s.level = 20; s.follower = { id: "lydia", hp: 999, ts: G.now() }; s.thrall = { name: "Bandit thrall", dmg: 6, fights: 2 };
  const f = new G.Fight(s, G.scaleEnemy(D.ENCOUNTERS.find((e) => e.health), 20));
  const kinds = f.allies.map((a) => K(a));
  ok(kinds.includes("follower") && kinds.includes("zombie"), "engine allies: " + kinds.join(","));
  const h = FIGHTART.heroOf ? FIGHTART.heroOf(s, f) : null;
  ok(h && h.list.some((a) => a.kind === "follower" && a.look && a.look.eq && a.look.eq.weapon === "steel_sword"), "Lydia carries her own gear into the scene");
  for (const a of [{ name: "Dragon Slayer", player: true }, { name: "Dragon Fang", pid: "x1" }, { name: "Dragonborn", host: true }]) ok(FIGHTART.allyKind(a) !== "dragon", "a player named " + a.name + " is not drawn as a dragon");
  ok(FIGHTART.allyKind({ name: "Odahviing" }) === "odah", "real summoned dragons still are");
  console.log("allyart ok · " + FIGHTART.ALLY_KINDS.length + " kinds · " + distinct + " distinct figures");
`, c);
