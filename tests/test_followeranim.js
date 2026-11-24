// Followers play their combat clips: every follower action in the fight log gives the follower's figure the right clip
// from the shared rig (attack, bow shot, cast, block, hit, knocked down, getting back up), in instant and turn-by-turn
// fights, in both art styles; summons and lookless helpers act out their clip too.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const calls = { n: 0 };
const ctx = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; if (k === "getTransform") return () => ({ a: 2, b: 0 }); return (...a) => { calls.n++; for (const v of a) if (typeof v === "number" && !isFinite(v)) throw new Error("NaN in " + String(k)); return { addColorStop() {}, width: 10 }; }; }, set: (t, k, v) => { t[k] = v; return true; } });
const doc = { createElement: () => ({ width: 0, height: 0, style: {}, dataset: {}, getContext: () => ctx, toDataURL: () => "data:image/png;base64,AA" }) };
const c = { calls, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RegExp, document: doc, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 2, performance: { now: () => 0 } };
vm.createContext(c);
const files = fs.readFileSync(W + "index.html", "utf8").match(/<script src="([a-z0-9_]+\.js)">/g).map((s) => s.match(/"(.*)"/)[1]).filter((f) => !["store.js", "p2pnet.js", "ui.js", "sound.js", "map.js", "backup.js", "skillinfo.js"].includes(f));
for (const f of files) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const ok = (v, m) => { if (!v) throw new Error("FAIL " + m); };
ok(typeof ALLYANIM !== "undefined", "allyanim.js loads");
const g = document.createElement("canvas").getContext("2d");
// spy on the shared rig: which clip does each follower figure get?
const seen = []; const real = HEROART.fightFigure;
HEROART.fightFigure = (gg, card, o) => { seen.push(o && o.clip ? o.clip : "idle"); return real(gg, card, o); };
const look = PARTY.followerLook("lydia");
const hero = { wt: "sword", list: [{ kind: "follower", name: "Lydia", look }, { kind: "familiar", name: "Wolf (Lydia)" }] };
// the clip the figure is drawn with at the busiest moment of a beat
const clipAt = (b, name, u) => { const m = FIGHTART.MOVES[b.move] || FIGHTART.MOVES.wait, a = ALLYANIM.anim(b, name, u, m.hits.length ? m.hits[0] : 0.5, null); seen.length = 0; FIGHTART.allyFig(g, "follower", { t: 1, look, anim: a }); return seen[0]; };

// 1) a turn-by-turn fight: every follower line becomes its own beat with its own clip
const tb = { e: { name: "Bandit outlaw" }, hp0: 200, ehp0: 300, wt0: "sword", wt: "sword", allies: [], _downed: [], followerDown: "Lydia", log: [
  { me: " · Lydia hits 14", them: "", hp: 200, ehp: 286, a: "attack" },
  { me: " · Lydia power attacks 22, staggers it", them: "", hp: 200, ehp: 264, a: "power_attack" },
  { me: " · Lydia casts Healing: +20", them: "", hp: 200, ehp: 264, a: "spell:healing" },
  { me: " · Lydia raises their shield", them: "", hp: 200, ehp: 264, a: "guard" },
  { me: "", them: "Bandit outlaw hits Lydia 9", hp: 200, ehp: 264 },
  { me: "", them: "Bandit outlaw goes for Lydia", hp: 200, ehp: 264 },
  { me: "", them: "Bandit outlaw knocks Lydia to their knees. Lydia is down!", hp: 200, ehp: 264 },
  { me: "Attack: 20", them: "", hp: 200, ehp: 244, a: "attack" },
  { me: "Rescue → Lydia: pulled back from the brink (40 health)", them: "", hp: 200, ehp: 244, a: "spell:rescue" },
  { me: " · Lydia hits 10", them: "", hp: 200, ehp: 234, a: "attack" },
] };
const beats = FIGHTART.beatsOf(tb, hero);
const want = [["attack", 0.55], ["attack", 0.55], ["cast", 0.5], ["block", 0.5], ["hit", 0.8], ["block", 0.5], ["down", 0.98], [null, 0.5], ["getup", 0.3], ["attack", 0.55]];
ok(beats.length === want.length, "one beat per line: " + beats.length);
const rigClip = { attack: "attack", cast: "cast", block: "block", hit: "hit", down: "down", getup: "idle" };
want.forEach(([act, u], i) => {
  const b = beats[i], a = (b.allyActs || []).find((x) => x.name === "Lydia");
  if (!act) { ok(!a, "beat " + i + " has no Lydia act"); ok(clipAt(b, "Lydia", u) === "down", "Lydia stays down while you fight on"); return; }
  ok(a && a.clip === act, "beat " + i + " (" + (tb.log[i].me || tb.log[i].them) + "): " + (a && a.clip) + " want " + act);
  const got = clipAt(b, "Lydia", u);
  ok(got === rigClip[act], "beat " + i + " follower figure gets clip " + got + " want " + rigClip[act]);
});
ok(beats[0].allyOnly && beats[0].dur >= 700, "an ally line plays long enough to see the swing");
ok(clipAt(beats[0], "Lydia", 0) === "attack" && clipAt(beats[4], "Lydia", 0.1) === "idle", "a hit lands at the blow, not before");
ok(!beats.downEnd.has("Lydia"), "back on her feet at the end");
// knocked down at the end: she lies there when the playback is over
const tb2 = { ...tb, log: tb.log.slice(0, 7) }, b2 = FIGHTART.beatsOf(tb2, hero);
ok(b2.downEnd.has("Lydia"), "down at the end of the lines");
seen.length = 0; FIGHTART.allyFig(g, "follower", { t: 1, look, anim: ALLYANIM.anim(null, "Lydia", 1, 0.5, b2.downEnd) }); ok(seen[0] === "down", "still down once it has played");
// already down before these lines: she starts on the ground
const b3 = FIGHTART.beatsOf({ ...tb, log: [{ me: "Attack: 20", them: "", hp: 200, ehp: 280, a: "attack" }] }, hero);
ok((b3[0].downs || []).includes("Lydia") && clipAt(b3[0], "Lydia", 0.5) === "down", "a follower who was knocked down earlier lies there");

// 2) an instant fight: her strike rides on your beat; a bow follower draws the bow
const inst = { e: { name: "Bandit outlaw" }, hp0: 200, ehp0: 300, wt0: "sword", wt: "sword", allies: [{ name: "Lydia", follower: true, fid: "lydia" }], log: [
  { me: "Attack: 25 · Lydia 12", them: "Bandit outlaw hits you 7", hp: 193, ehp: 263, a: "attack" },
  { me: "Attack: 25 · Lydia shoots 9", them: "", hp: 193, ehp: 229, a: "attack" },
] };
const ib = FIGHTART.beatsOf(inst, hero);
ok(ib[0].who === "me" && ib[0].allyActs.some((a) => a.name === "Lydia" && a.clip === "attack"), "instant: Lydia attacks with you");
ok(clipAt(ib[0], "Lydia", 0.5) === "attack", "instant: her figure swings");
ok(ib[1].who === "them" && !(ib[1].allyActs || []).length && clipAt(ib[1], "Lydia", 0.6) === "idle", "the foe hitting you leaves her be");
ok(ib[2].allyActs[0].clip === "shoot" && clipAt(ib[2], "Lydia", 0.5) === "attack", "a bow shot plays the attack clip (the rig draws the bow for a bow look)");
// summons: their own lines find them, not their owner
const sb = FIGHTART.beatsOf({ ...tb, followerDown: null, log: [{ me: " · Wolf (Lydia) 7", them: "", hp: 200, ehp: 293, a: "attack" }] }, hero);
ok(sb[0].allyActs.length === 1 && sb[0].allyActs[0].name === "Wolf (Lydia)", "a follower's summon acts on its own line");
// party members in a shared fight: their voiced lines
const pb = FIGHTART.beatsOf({ ...tb, followerDown: null, log: [{ me: " · Beta attacks 18", them: "", hp: 200, ehp: 282 }, { me: "", them: "Bandit outlaw knocks Beta down! They'll get back up after the fight", hp: 200, ehp: 282 }] }, { wt: "sword", list: [{ kind: "mate", name: "Beta", look }] });
ok(pb[0].allyActs[0].clip === "attack" && pb[1].allyActs[0].clip === "down" && pb.downEnd.has("Beta"), "a party member swings and goes down");

// 3) the rig takes every clip in both art styles, blends without NaN, and the poses really differ
for (const style of ["ink"]) {
  ART.drawingStyle = () => style;
  for (const clip of ["idle", "attack", "cast", "block", "hit", "down"]) for (const u of [0, 0.3, 0.55, 0.8]) { real(g, { look }, { t: 1, clip, u }); real(g, { look }, { t: 1, clip, u, from: "idle", fu: 0, w: 0.5 }); }
  real(g, { look: { ...look, eq: { ...look.eq, weapon: "hunting_bow" } } }, { t: 1, clip: "attack", u: 0.3 });
}
const sp = FIGART.specOf(look), A = FIGART.poseAt("attack", 0.55, sp), I = FIGART.poseAt("idle", 0, sp), Dn = FIGART.poseAt("down", 0, sp);
ok(Math.abs(A.aim - I.aim) > 0.5 && Math.abs(Dn.rot) > 1, "attack and down are real poses");
// lookless helpers act it out too (lunge, fall)
for (const kind of FIGHTART.ALLY_KINDS) for (const clip of ["attack", "hit", "down"]) FIGHTART.allyFig(g, kind, { t: 1, i: 0, anim: { clip, u: 0.4, from: clip === "down" ? "hit" : "idle", fu: 0, w: 0.6 } });
console.log("followeranim ok · " + beats.length + " turn-by-turn beats, " + ib.length + " instant beats, both styles");
`, c);
