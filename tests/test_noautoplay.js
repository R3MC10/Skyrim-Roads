/* No auto-play (noautoplay.js): your character only acts when you pick the move.
   "for some reason characters attack automatically at some event, fix that."
   W=/path/to/game/ node test_noautoplay.js — prints "noautoplay ok".
   1. every file that runs a fight is one we checked (a new event fight has to be added here, and wired to the fight screen)
   2. world events (Oblivion gates, dragon migration), great world events (dragon / rift / siege charges), rumours and
      whispers open the turn-by-turn fight screen on your turn instead of playing the fight out by the AI; solo and in a party
   3. a party member whose phone doesn't answer only guards (never attacks for them), and the screen says so
   4. on a member's own phone a turn that runs out only guards, and says so
   5. a member's phone following the leader's dungeon choice doesn't fight that room again with the AI */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");

// ---- a tiny fake page: enough for the fight screen to open and for the event buttons to be clicked
const ids = {}, docL = {};
function El(tag) {
  return { tagName: tag, id: "", children: [], dataset: {}, style: {}, className: "", innerHTML: "", textContent: "", _l: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute(k, v) { this[k] = v; }, getAttribute: () => null, removeAttribute() {},
    addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); }, removeEventListener() {},
    appendChild(ch) { this.children.push(ch); if (ch.id) ids[ch.id] = ch; return ch; }, remove() { if (this.id && ids[this.id] === this) delete ids[this.id]; },
    querySelector: () => null, querySelectorAll: () => [], closest: () => null, before() {}, after() {}, insertBefore() {}, prepend() {}, append() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640, right: 360, bottom: 640 }), animate: () => ({ finished: Promise.resolve(), cancel() {} }) };
}
const document = { body: El("body"), documentElement: El("html"), getElementById: (id) => ids[id] || null, createElement: El, querySelector: () => null, querySelectorAll: () => [],
  addEventListener(t, f) { (docL[t] = docL[t] || []).push(f); }, removeEventListener() {}, hidden: false };
const store = {};
const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const timers = [];
// seeded dice so every run is the same (the party great-event check failed now and then: when Beta wins the first turn, the screen rightly waits on her phone first, but the check wants your turn first); SEED=n to try others
{ let sd = +(process.env.SEED || 7) >>> 0; Math.random = () => { sd = (sd + 0x6D2B79F5) >>> 0; let t = sd; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Uint32Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RegExp, Promise,
  structuredClone, document, localStorage, setTimeout: (f, ms) => { const h = setTimeout(f, ms); timers.push(h); return h; }, clearTimeout, setInterval: (f, ms) => { const h = setInterval(f, ms); timers.push(h); return h; }, clearInterval,
  requestAnimationFrame: () => 0, cancelAnimationFrame() {}, process: { env: process.env } };
c.window = c;
vm.createContext(c);
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "shieldfx.js", "foegroups.js", "legendary.js", "powers.js", "engine.js", "foecap.js", "events.js", "dungeons.js", "towns.js",
  "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js",
  "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "spellbook.js", "mp.js", "spellcraft.js", "shouts2.js", "coop.js", "party.js", "combatai.js", "foeintent.js", "dragons.js",
  "tbfight.js", "sharedfight.js", "noautoplay.js", "greatevents.js", "worldevents.js", "rumours.js", "livingworld.js"];
for (const f of FILES) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
c.__fs = fs; c.__W = W; c.__docL = docL;

vm.runInContext(`
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };

// ---------------------------------------------------------------- 1. every fight in the game is one we checked
{ const REVIEWED = {   // file -> how its fights reach the player (ui.js tbCall / NOAUTO.call open the turn-by-turn screen)
    "engine.js": "road encounters + events (ui.js tbCall)", "dungeons.js": "dungeon rooms (ui.js tbCall; members following: NOAUTO.carried)",
    "greatevents.js": "NOAUTO.call", "worldevents.js": "NOAUTO.call", "rumours.js": "NOAUTO.call", "livingworld.js": "NOAUTO.call",
    "guilds.js": "ui.js tbCall", "hsrooms.js": "homestead defend (ui.js tbCall)", "mp.js": "PvP attack (ui.js tbCall)", "quests.js": "quest talk (ui.js tbCall; Dawnguard, Daedric, curses ride on it)",
    "towns.js": "guards (ui.js tbCall)", "wevents.js": "dragon raids (ui.js tbCall)",
    "aiset.js": "tactics preview sim on a copy of your save", "ui.js": "tactics test fight on a copy of your save", "arena.js": "Arena duel between two saved builds (both players agreed to it)", "holdrule.js": "hold claim / raid (holdui.js TB.call)", "blackreach.js": "Blackreach map (ui.js tbCall, passed in as ctx.tb)",
    "sides.js": "PvP attack on another side (ui.js tbCall)", "tourney.js": "festival duels and the Grand Arena (tourneyui.js api.tbCall / TB.call)",
    "crises.js": "crisis contracts and the ringleader fight (NOAUTO.call)" };
  const files = __fs.readdirSync(__W).filter((f) => f.endsWith(".js"));
  const runs = files.filter((f) => /\\bf[ab]?\\.run\\(\\s*\\{|new G\\.Fight\\([^)]*\\)\\s*;\\s*f\\.run\\(|\\bf\\.run\\(\\)/.test(__fs.readFileSync(__W + f, "utf8")));
  for (const f of runs) ok(REVIEWED[f], f + " runs a fight that nobody checked opens on the turn-by-turn screen (add it to REVIEWED once it does)");
  for (const f of ["greatevents.js", "worldevents.js", "rumours.js", "livingworld.js", "crises.js"]) ok(/fightCall\\(|NOAUTO\\.call/.test(__fs.readFileSync(__W + f, "utf8")), f + ": its fight button goes through the fight screen");
  ok(/NOAUTO\\.carried\\(act\\)/.test(__fs.readFileSync(__W + "ui.js", "utf8")), "ui.js: a member's replayed dungeon room isn't fought again by the AI");
  ok(/tbCall: \\(fn, done\\) => tbCall\\(fn, done\\)/.test(__fs.readFileSync(__W + "ui.js", "utf8")), "ui.js offers tbCall to the event modules");
  ok(/noautoplay\\.js/.test(__fs.readFileSync(__W + "index.html", "utf8")), "index.html loads noautoplay.js"); }

// ---------------------------------------------------------------- helpers
const mk = (id, lvl, loc) => { const s = G.newSave(id, "P" + id, "nord"); s.id = id; s.level = lvl; s.hpBonus = lvl * 6; s.location = loc; [s.x, s.y] = WORLD.places[loc];
  for (const k of Object.keys(s.skills)) s.skills[k].lvl = Math.min(100, Math.max(s.skills[k].lvl, 15 + lvl * 2));
  for (const it of ["steel_sword", "steel_armor", "steel_helmet", "steel_boots", "steel_gauntlets", "steel_shield"]) { G.give(s, it); G.equip(s, s.inv[s.inv.length - 1].id); }
  G.give(s, "potion_health", 3); G.setHealth(s, G.maxHealth(s)); return s; };
const move = (s, loc) => { s.location = loc; [s.x, s.y] = WORLD.places[loc]; };
let S = null, results = [];
const api = { S: () => S, persist() {}, toast: (t) => results.push({ toast: t }), showFightResult: (r) => results.push(r), showMessage() {}, openModal() {}, closeModal() {}, postNews() {}, click() {}, party: () => null };
window.__ui = { tbCall: (fn, done) => TB.call(S, fn, done), fight: (r) => results.push(r), save() {}, refresh() {} };
window.__dbg = { save: () => S, toast: (t) => results.push({ toast: t }), message: (t, x) => results.push({ msg: t, text: x }) };
let remoteLive = true; const asked = [];
TB.init({ toast() {}, remote: { ask: (sess, al) => asked.push(al.pid), sync() {}, end() {}, live: () => remoteLive } });
const click = (attr, data) => { const btn = { dataset: data, disabled: false }; const ev = { target: { closest: (sel) => (sel === "[" + attr + "]" ? btn : null) } }; for (const f of (__docL.click || []).slice()) f(ev); };
/* the fight screen is open on YOUR turn, and your character hasn't done a thing yet */
function onMyTurn(label) {
  ok(TB.open, label + ": the turn-by-turn fight screen opened");
  const sess = TB.session; if (!sess) return null;
  ok(sess.cur && sess.cur.id === "me" && !sess.done, label + ": it's waiting for you to pick a move (now: " + (sess.cur && sess.cur.id) + ")");
  ok(!sess.ev.some((e) => e.who === "me"), label + ": your character hasn't acted on its own");
  ok(!sess.opts.auto && !sess.autoRest, label + ": no Auto switched on for you");
  return sess;
}
/* play it out yourself (attack every turn), then close the screen: the event gets the played result */
function playOut(sess, label) {
  let g = 0, r = { turn: "me" };
  while (!sess.done && g++ < 400) {
    if (sess.cur && sess.cur.id === "me") { r = sess.act("attack"); if (r && r.err) r = sess.act("end"); if (r && r.turn === "next") r = sess.advance(); }
    else if (sess.waiting) { sess.waiting.until = 0; r = sess.advance(); }
    else r = sess.advance();
  }
  ok(sess.done, label + ": the fight ended");
  const before = results.length;
  TB.close();
  ok(!TB.open && results.length > before, label + ": the event finished with the fight you played");
  return results[results.length - 1];
}
`, c);

vm.runInContext(`GREATEV.mount(api); WORLDEV.mount(api);`, c);   // their buttons listen on the page (rumours and whispers listen from load)

vm.runInContext(`
const H = 3600;
// ---------------------------------------------------------------- 2a. great world events: a charge opens the fight screen on your turn
{ const T0 = Math.floor(Date.UTC(2026, 10, 24, 0) / 1000); let ev = null, t = 0;
  for (let b = Math.floor(T0 / GREATEV.BLOCK); b < Math.floor(T0 / GREATEV.BLOCK) + 12 && !ev; b++) { const e = GREATEV.eventIn(b); if (e.kind !== "fair") { ev = e; t = e.start + 60; } }
  ok(ev, "found a great world event");
  for (const party of [false, true]) {
    const label = "great event " + ev.kind + (party ? " (party)" : " (solo)");
    G.now = () => t;
    S = mk("gev" + party, 30, ev.place); results = [];
    const mate = party ? { ...COOP.allyFromCard({ id: "mate1", name: "Beta", coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }), uid: "mate1", party: true } : null;
    G.setAllyProvider(() => (mate ? [mate] : []));
    click("data-gev", { gev: "fight" });
    const sess = onMyTurn(label);
    if (sess) {
      ok(sess.f.e.pool && sess.waves === 1, label + ": a charge against the event's shared health (no extra foes or health boost)");
      if (party) { remoteLive = true; asked.length = 0; let g = 0, r; while (!sess.done && !sess.waiting && g++ < 60) { r = sess.cur.id === "me" ? sess.act("end") : sess.advance(); if (r && r.turn === "next") sess.advance(); }
        ok(sess.waiting && asked.includes("mate1"), label + ": Beta's turn waits for her own phone"); }
      const out = playOut(sess, label);
      ok(out && out.fight && out.fight.tbPlayed, label + ": the result is the fight you played");
      if (party) ok(!sess.ev.some((e) => /^Beta (attacks|power attack|\\d)/.test(e.text) || / · Beta \\d/.test(e.text)), label + ": Beta never attacked without choosing to");
    }
    G.setAllyProvider(() => []);
  }
}
// ---------------------------------------------------------------- 2b. world events: an Oblivion gate and a dragon migration
{ const T0 = Math.floor(Date.UTC(2026, 10, 24, 0) / 1000);
  for (const kind of ["inv", "mig"]) {
    let ev = null, t = 0; for (let x = T0; x < T0 + 60 * 86400 && !ev; x += 1800) { const a = WORLDEV.active(x).find((e) => e.kind === kind); if (a) { ev = a; t = x; } }
    if (!ev) { console.log("(no " + kind + " event in 60 days, skipped)"); continue; }
    G.now = () => t;
    const label = "world event " + kind;
    S = mk("wev" + kind, 30, kind === "inv" ? ev.sites[0] : Object.keys(WORLD.places).find((p) => G.holdAt(WORLD.places[p]) === ev.hold && WORLD.places[p][2] === "city") || Object.keys(WORLD.places).find((p) => G.holdAt(WORLD.places[p]) === ev.hold)); results = [];
    click("data-wev", { wev: kind === "inv" ? "gate" : "hunt" });
    const sess = onMyTurn(label);
    if (sess) { const out = playOut(sess, label); ok(out && out.fight && out.fight.tbPlayed, label + ": the result is the fight you played"); }
  }
}
// ---------------------------------------------------------------- 2c. rumours and whispers that turn into fights
{ G.now = () => Math.floor(Date.now() / 1000); const t = G.now();
  S = mk("rw", 25, "Whiterun"); results = [];
  RUMOURS.st(S).list.push({ id: "lead1", kind: "bandits", place: "Whiterun", hold: "Whiterun", real: true, until: t + 3600, name: "Bandit chief" });
  if (RUMOURS.st) { click("data-rw", { rw: "act", id: "lead1" });
    const sess = onMyTurn("rumour (bandits)"); if (sess) { const out = playOut(sess, "rumour (bandits)"); ok(out && out.fight && out.fight.tbPlayed, "rumour: the result is the fight you played"); } }
  S = mk("lw", 25, "Whiterun"); results = [];
  LIVING.st(S).wh.push({ id: "wh1", k: "warband", place: "Whiterun", hold: "Whiterun", st: "live", until: t + 3600, due: t - 60 });
  click("data-lw", { lw: "act", id: "wh1" });
  const sess = onMyTurn("whisper (warband)"); if (sess) { const out = playOut(sess, "whisper (warband)"); ok(out && out.fight && out.fight.tbPlayed, "whisper: the result is the fight you played"); }
}

// ---------------------------------------------------------------- 3. a party member who can't be reached only guards
{ for (const live of [true, false]) {
    const label = live ? "member's phone too slow" : "member's phone not connected";
    const s = mk("lead" + live, 20, "Whiterun"), f = new G.Fight(s, G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === "Bandit outlaw") }, 20));
    const mate = COOP.allyFromCard({ id: "p2", name: "Beta", coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }); f.allies.push(mate);
    const ss = new TB.Session(f, { trySneak: false }); ss.remote = { ask() {}, end() {}, live: () => live };
    let r = ss.begin(), g = 0, sawTurn = false;
    while (!ss.done && g++ < 400) {
      if (r.turn === "me") { sawTurn = true; r = ss.act("attack"); if (r.err) r = ss.act("end"); if (r.turn === "next") r = ss.advance(); continue; }
      if (r.turn === "wait") { ss.waiting.until = 0; r = ss.advance(); continue; }
      r = ss.advance();
    }
    ok(sawTurn, label + ": you got your own turns");
    const lines = ss.ev.filter((e) => e.kind === "ally" && /Beta/.test(e.text)).map((e) => e.text);
    ok(lines.length > 0 && lines.every((x) => /keeps their guard up/.test(x)), label + ": Beta only guards, and the log says why (" + lines.slice(0, 2).join(" | ") + ")");
  }
  // sims and the AI's own fights still play everyone (no change to balance runs)
  const s = mk("sim", 20, "Whiterun"), f = new G.Fight(s, G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === "Bandit outlaw") }, 20));
  f.allies.push(COOP.allyFromCard({ id: "p2", name: "Beta", coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }));
  const ss = TB.simulate(f, { t: G.now() }); ok(ss.done && ss.ev.some((e) => e.kind === "ally" && /Beta \\d/.test(e.text)), "sims still let the AI play a party member");
}

// ---------------------------------------------------------------- 4. on Beta's own phone: a turn that runs out only guards, and says so
{ const s = mk("p1", 20, "Whiterun"); s.name = "Alfa";
  const f = new G.Fight(s, G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === "Bandit outlaw") }, 20));
  const mate = COOP.allyFromCard({ id: "p2", name: "Beta", cur: 250, coop: { prof: { dmg: 20, hp: 300, red: 0.2, role: "fighter" } } }); f.allies.push(mate);
  const ss = new TB.Session(f, { trySneak: false }); ss.remote = { ask() {}, end() {}, live: () => true };
  let r = ss.begin(), g = 0;
  while (r.turn !== "wait" && !ss.done && g++ < 60) { r = r.turn === "me" ? ss.act("end") : ss.advance(); if (r.turn === "next") r = ss.advance(); }
  ok(r.turn === "wait", "the leader's phone waits for Beta");
  const d = { id: "fid1", owner: "p1", ...TB.fightState(ss) };
  const s2 = mk("p2", 20, "Whiterun"); s2.name = "Beta";
  let sent = null; const m = SHAREDFIGHT.build(s2, d, (x) => { sent = x; });
  ok(m.advance().turn === "me", "Beta's phone: her own turn, waiting for her pick (nothing played for her)");
  ok(!m.ev.some((e) => e.who === "me"), "Beta's character hasn't acted on its own");
  const e0 = m.f.ehp; m.timeUp();
  ok(sent && Math.round(sent.ehp) === Math.round(e0) && !sent.ev.some((x) => x.dmg > 0), "time ran out: no attack was made for her");
  ok(sent && sent.guard > 0 && sent.ev.some((x) => /hold back and keep your guard up .out of time./.test(x.text)), "time ran out: she guards, and her log says so");
  ss.waiting.reply = sent; ss.advance();
  ok(ss.ev.some((e) => /Beta holds back and keeps their guard up .out of time./.test(e.text)), "the leader's screen says Beta ran out of time: " + (ss.ev.filter((e) => /Beta/.test(e.text)).map((e) => e.text).pop() || ""));
}

// ---------------------------------------------------------------- 5. a member following the leader's dungeon choice: no second fight by the AI
{ const place = Object.keys(WORLD.places).find((p) => WORLD.places[p][2] === "dungeon");
  const prep = () => { const s = mk("mem", 20, place); const e = DUNGEONS.enter(s); if (e) return null;
    s.dungeon.room = { type: "fight", tier: 1, enemy: G.scaleEnemy({ ...D.ENCOUNTERS.find((x) => x.name === "Draugr") || D.ENCOUNTERS.find((x) => x.danger === "medium") }, 20) };
    G.setHealth(s, G.maxHealth(s) * 0.8); return s; };
  const s = prep();
  if (!s) ok(false, "could not enter a dungeon for the follow test");
  else {
    const hp0 = Math.round(G.curHealth(s)), pots0 = G.countRestore(s, "health"), xp0 = JSON.stringify(s.skills);
    const r = NOAUTO.carried(() => DUNGEONS.act(s, "fight"));
    ok(r.fight && r.fight.won && r.fight.carried && !r.died, "the room counts as won with the party");
    ok(!s.dungeon.room, "the member's copy of the room is cleared, so they keep following");
    ok(Math.round(G.curHealth(s)) === hp0 && G.countRestore(s, "health") === pots0, "no blows taken and no potions drunk by the AI on the member's phone");
    ok(JSON.stringify(s.skills) === xp0, "no skill practice from a fight the member didn't play there");
    ok(G.Fight.prototype.run !== undefined && (() => { const f = new G.Fight(mk("x", 20, place), G.scaleEnemy({ ...D.ENCOUNTERS.find((x) => x.name === "Bandit outlaw") }, 20)); f.run({}); return f.log.length > 1; })(), "fights work normally again afterwards");
  }
}

console.log(fails ? fails + " of " + n + " checks FAILED" : "noautoplay ok (" + n + " checks)");
__exit(fails ? 1 : 0);
`, Object.assign(c, { __exit: (code) => process.exit(code) }));
