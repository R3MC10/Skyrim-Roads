/* Fight fuzzer (claude/fight-logic): plays many seeded turn-based fights (tbfight.js) with every kind of move and
   checks that nothing breaks. node test_fightfuzz.js [fights]  -> "fightfuzz ok"
   Loads the whole game the way index.html does (minus the page-only ui.js / store.js), so the modules meet each
   other like on a phone. Each fight: a random build and level, a random foe (road foes, groups, bosses), sometimes a
   follower, a summon or a simulated party; on your turn a random affordable move (weapons, power attacks, block, bash,
   every known spell single and dual, support spells on allies, shouts, powers, potions, scrolls, poisons, end turn,
   sometimes flee). After every step:
   - no exception, no NaN/undefined in health, magicka, stamina, foe health or allies' health
   - magicka and stamina stay within 0..max (a little float slack), health never above max
   - AP never spent past what you have; a move that errs costs nothing
   - followers are never removed for good: knocked down, never killed
   - the fight always ends (no endless loop), and the result is settled once
   W=/path/to/game/ points at another game folder. SEED=n for another set. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const N = +(process.env.FIGHTS || process.argv[2] || 240);
let seed = +(process.env.SEED || 7);
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const c = { process: { env: process.env }, console, Math: Object.create(Math), Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, structuredClone, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} };
c.Math.random = rand;   // every module's dice come from the seed: a failure can be replayed
vm.createContext(c);
const html = fs.readFileSync(W + "index.html", "utf8");
const files = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !/^http/.test(f) && f !== "ui.js" && f !== "store.js");
for (const f of files) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f }); } catch (e) { /* page-only module */ } }
const tbsrc = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
vm.runInContext(tbsrc.slice(tbsrc.indexOf("const LEVELS"), tbsrc.indexOf("if (!process.env.SIMONLY)")), c);
c.N = N; c.rnd = rand;
vm.runInContext(`
const probs = []; let checks = 0;
const seenF = new Set(); const bad = (m) => { const k = m.split(" r")[0].split(":")[0]; if (seenF.has(k)) return; seenF.add(k); if (probs.length < 60) probs.push(m); };
const fin = (v) => typeof v === "number" && isFinite(v);
const BUILDS = ["warrior", "twohand", "archer", "sneakarcher", "mage", "spellsword"];
const ROAD = D.ENCOUNTERS.filter((e) => (e.health || e.hp) > 0 && e.damage > 0 && !e.peaceful && !e.talk && !e.trade).map((e) => e.name);
const BOSSES = Object.keys(DUNGEONS.ENEMY || {});
const pickR = (a) => a[Math.floor(rnd() * a.length)];
const FOLS = ["lydia", "jenassa", "marcurio", "uthgerd", "faendal", "brelyna"].filter((id) => !TOWNS.FOLLOWERS || (Array.isArray(TOWNS.FOLLOWERS) ? TOWNS.FOLLOWERS.some((x) => x[0] === id || x.id === id) : TOWNS.FOLLOWERS[id]));
const mate = (pid, name, role) => { const a = COOP.allyFromCard({ id: pid, name, cur: 300, coop: { prof: { dmg: 20, hp: 300, red: 0.2, role } } }); a.pid = pid; return a; };

/* a hero with a bit of everything: the build's gear and spells plus every spell they could cast, potions, a scroll,
   a poison, shout words */
function kit(b, L) {
  const s = fresh(b, L);
  for (const [id, sp] of Object.entries(D.SPELLS)) if (sp.kind !== "utility" && !s.spells.includes(id) && rnd() < 0.25) s.spells.push(id);
  for (const it of ["potion_health", "potion_magicka", "potion_stamina"]) if (D.ITEMS[it]) G.give(s, it, 2);
  for (const k of Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].slot === "scroll")) if (rnd() < 0.3) G.give(s, k, 1);
  if (!D.ITEMS.fz_poison) D.ITEMS.fz_poison = { name: "Poison of Damage Health", slot: "poison", weight: 0.5, value: 20, effects: [["Damage Health", 12, 0], ["Lingering Damage Health", 3, 4], ["Paralysis", 1, 1]] };
  G.give(s, "fz_poison", 2);
  if (typeof POWERS !== "undefined") { const ws = Object.values(POWERS.SHOUTS).flatMap((x) => x[1]).filter(() => rnd() < 0.5); s.words = ws; s.unlocked = ws.slice(); }
  if (rnd() < 0.5) s.skills.Blocking.lvl = Math.max(s.skills.Blocking.lvl, 40);
  return s;
}
function foeFor(L) {
  const r = rnd();
  if (r < 0.15 && BOSSES.length) return { e: boss(pickR(BOSSES), L), kind: "boss" };
  return { e: enc(pickR(ROAD), L), kind: "road" };
}
/* the moves you could try on your turn (the fight's own "can you afford it" decides) */
function moves(ss) {
  const f = ss.f, s = f.s, out = ["attack", "attack", "power_attack", "block", "bash", "end"];
  for (const id of s.spells || []) { out.push("spell:" + id); if (rnd() < 0.3) out.push("dual:" + id); }
  out.push("potion:health", "potion:magicka", "potion:stamina");
  for (const r of s.inv || []) { const it = D.ITEMS[r.item]; if (!it) continue; if (it.slot === "scroll") out.push("scroll:" + r.item); if (it.slot === "poison") out.push("poison:" + r.id); }
  if (typeof POWERS !== "undefined") { for (const sh of Object.keys(POWERS.SHOUTS)) out.push("shout:" + sh); out.push("power:race", "power:stone"); }
  if (rnd() < 0.02) out.push("flee");
  return out;
}
function checkState(ss, tag) {
  const f = ss.f; checks++;
  const mh = G.maxHealth(f.s), mm = G.maxMagicka(f.s), ms = G.maxStamina(f.s);
  if (!fin(f.hp) || !fin(f.ehp)) bad(tag + ": health is not a number (hp " + f.hp + ", foe " + f.ehp + ")");
  if (!fin(f.mp) || !fin(f.sp)) bad(tag + ": magicka/stamina not a number (" + f.mp + ", " + f.sp + ")");
  if (f.hp > mh + 0.5) bad(tag + ": health above max " + f.hp + "/" + mh);
  if (f.mp < -0.5 || f.mp > mm + 0.5) bad(tag + ": magicka out of range " + f.mp + "/" + mm);
  if (f.sp < -0.5 || f.sp > ms + 0.5) bad(tag + ": stamina out of range " + f.sp + "/" + ms);
  for (const a of f.allies || []) if (a && a.hp != null && !fin(a.hp)) bad(tag + ": ally " + a.name + " health is " + a.hp);
  if (ss.myActs > (ss.st?.acts || 9) + 0.01) bad(tag + ": AP spent " + ss.myActs + " of " + ss.st.acts);
  for (const k of Object.keys(f)) if (/Turns$|Left$/.test(k) && f[k] != null && typeof f[k] === "number" && (!fin(f[k]) || f[k] < -0.01)) bad(tag + ": " + k + " is " + f[k]);
  for (const d of f.dots || []) if (!d || !fin(d.dmg ?? d.amt ?? 0) || (d.turns != null && !fin(d.turns))) bad(tag + ": a damage-over-time entry is broken " + JSON.stringify(d));
  if (f.summonTurns > 0 && !fin(f.summonDmg)) bad(tag + ": summon damage is " + f.summonDmg);
}
const used = {}; const folStat = { r: 0, a: 0 }, sumStat = { r: 0, a: 0, stuck: 0 };
/* foe moves: the intent the screen showed (the plan) vs. the move it made */
const kitStat = { planned: 0, same: 0, diff: {} };
if (typeof FOEKIT !== "undefined") { const t0 = FOEKIT.turn; FOEKIT.turn = function (f, et, r) {
  const pl = f.kit && f.kit.plan && f.kit.plan[0] ? f.kit.plan[0].id : null, lock = f.calmTurns > 0 || f.eParalyzed > 0 || f.stagger || f.fearTurns > 0 || f.unseen > 0 || (f.kit && f.kit.windup);
  f.kitLast = null; const out = t0.apply(this, arguments);
  if (pl && !lock && pl !== "blow" && pl !== "land") { kitStat.planned++; if (f.kitLast === pl) kitStat.same++; else { const k = pl + "→" + (f.kitLast || "blow"); kitStat.diff[k] = (kitStat.diff[k] || 0) + 1; } }
  return out; }; }
function play(i) {
  const b = pickR(BUILDS), L = pickR([5, 10, 20, 30, 40]), s = kit(b, L);
  const mode = rnd();
  const fol = mode < 0.4 && FOLS.length ? pickR(FOLS) : null;
  if (fol) s.follower = { id: fol, hp: TOWNS.followerMax(s, fol), ts: G.now() };
  const { e, kind } = foeFor(L);
  const f = new G.Fight(s, e);
  if (mode >= 0.75) { f.allies.push(mate("p2", "Beta", "healer"), mate("p3", "Ceta", pickR(["guard", "fighter"]))); }
  const tag0 = "#" + i + " " + b + " L" + L + " vs " + e.name + (fol ? " +" + fol : "") + (mode >= 0.75 ? " +party" : "");
  let ss;
  try { ss = new TB.Session(f, { trySneak: rnd() < 0.3 }); if (mode >= 0.75) ss.remote = { ask() {}, end() {} }; } catch (x) { bad(tag0 + ": session " + x.message); return; }
  const folKeep = fol ? (f.allies || []).find((a) => a.follower) : null;
  let r, g = 0, lastA = "", rBefore = 0, sumBefore = 0, evSeen = 0;
  try {
    r = ss.begin();
    while (!ss.done && g++ < 900) {
      const tag = tag0 + " r" + ss.round + " " + lastA;
      if (r && r.turn === "me") {
        const ms = moves(ss), ap0 = ss.myActs;
        let a = null; for (let k = 0; k < 12 && !a; k++) { const m = pickR(ms); if (m === "end" || m === "flee" || ss.canAfford(m)) a = m; }
        a = a || "end"; lastA = a;
        const tgt = /^(spell|dual):/.test(a) && (f.allies || []).length && rnd() < 0.5 ? String(Math.floor(rnd() * f.allies.length)) : undefined;
        const ehp0 = f.ehp, hp0 = f.hp, mp0 = f.mp, sp0 = f.sp, ev0 = ss.ev.length;
        r = ss.act(a, tgt);
        if (r && !r.err) { const k = a.split(":")[0] + (a.includes(":") ? ":" + (D.SPELLS[a.split(":")[1]]?.kind || a.split(":")[1]) : ""); used[k] = (used[k] || 0) + 1;
          if (ss.ev.length === ev0 && a !== "end" && a !== "flee") bad(tag + ": the move did nothing at all (no log line)");
          if (/^(spell|dual):/.test(a) && f.mp > mp0 + 0.5 && !/absorb|equilibrium/.test(a)) bad(tag + ": casting gave magicka back");
        }
        if (r && r.err && ss.myActs !== ap0) bad(tag + ": an error cost AP (" + r.err + ")");
        if (r && r.err) r = ss.act("end");
        if (r && r.turn === "next") r = ss.advance();
      } else if (r && r.turn === "wait") { if (ss.waiting) ss.waiting.skip = true; r = ss.advance(); }
      else r = ss.advance();
      checkState(ss, tag);
      for (let q = evSeen; q < ss.ev.length; q++) { const t = String(ss.ev[q].text || ""); if (["NaN", "undefined", "[object", " null", "(−0", "Infinity"].some((w) => t.includes(w))) bad(tag + ": odd log line: " + t.slice(0, 160)); }
      evSeen = ss.ev.length;
      if (ss.round > rBefore && sumBefore > 1 && f.summonTurns > 0 && f.ehp > 0 && !ss.done) { sumStat.r++; if (!(ss.order || []).some((o) => o.id === "sum")) { sumStat.stuck++; if (sumStat.stuck < 4) bad(tag + ": a summon with " + f.summonTurns + " turns left has no place in the turn order"); } }
      rBefore = ss.round; sumBefore = f.summonTurns || 0;
      if (folKeep && folKeep.hp != null && folKeep.hp <= 0 && (f.allies || []).includes(folKeep) && !folKeep.down) bad(tag + ": follower at 0 health still standing");
    }
    if (folKeep) { const rounds = new Set(ss.ev.filter((e) => e.kind === "round").map((e) => e.round)).size, acts = new Set(ss.ev.filter((e) => e.who !== "me" && e.who !== "foe" && String(e.text).includes(folKeep.name.split(" ")[0])).map((e) => e.round)).size; folStat.r += rounds; folStat.a += acts; }
    if (!ss.done) bad(tag0 + ": fight never ended (" + g + " steps, round " + ss.round + ")");
    if (fol && s.follower == null) bad(tag0 + ": the follower was lost for good");
    if (ss.done && ss.result == null && ss.res == null && f.won == null && !(f.hp <= 0 || f.ehp <= 0 || f.fled || f.endWon || ss.round > ss.maxRounds)) bad(tag0 + ": ended without a result");
  } catch (x) { bad(tag0 + " r" + (ss && ss.round) + " after " + lastA + ": " + String(x && x.stack || x).split(String.fromCharCode(10)).slice(0, 3).join(" | ")); }
}
for (let i = 0; i < N; i++) play(i);
console.log("moves used: " + Object.entries(used).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(", "));
sumStat.a = 0; console.log("summon rounds " + sumStat.r + ", without a turn " + sumStat.stuck);
console.log("follower named in " + folStat.a + " of " + folStat.r + " rounds");
console.log("foe special moves as shown: " + kitStat.same + "/" + kitStat.planned + (Object.keys(kitStat.diff).length ? " changed: " + JSON.stringify(kitStat.diff) : ""));
if (kitStat.planned && kitStat.same / kitStat.planned < 0.9) bad("foe special moves often differ from their intent: " + kitStat.same + "/" + kitStat.planned + " " + JSON.stringify(kitStat.diff));
console.log("fightfuzz: " + N + " fights, " + checks + " checks, " + probs.length + " problems");
for (const m of probs) console.log("FAIL", m);
if (!probs.length) console.log("fightfuzz ok");
globalThis.__fails = probs.length;
`, c);
process.exit(c.__fails ? 1 : 0);
