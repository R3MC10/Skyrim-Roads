// Combat combos and reactions (reactions.js): Shatter, Exploit, Precision, Stagger exploit, Burning ground (oil flask),
// Intercept (Cover allies), the boss's Withering Hex (cleanse it) and Marked for Death (protect a friend), the Auto and
// follower AI using them, the perks, the combo icon test, Polish for every line, and a balance sim (combos on vs off:
// fights don't end much faster, no blow takes half a strong foe's health, bosses still last about 15 rounds).
//   W=/path/to/game/ node test_combos.js      (N=12 fights per row by default, N=4 for a quick run)
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, process };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {}, removeItem() {} };
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const TBT = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
vm.runInContext(TBT.slice(TBT.indexOf("const LEVELS"), TBT.indexOf("{ const TUNE")) + "; this.make = make;", c);
const { G, TB, REACT: RX, BOSSFIGHT: B, PFX, D, FOL2 } = c;
let fails = 0, n = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const N = +(process.env.N || 12);

const foeOf = (base, L, extra = {}) => { const e = G.scaleEnemy({ ...base, tags: [...base.tags], level: L, danger: "high", gold: [0, 0], text: "", ...extra }, L); if (extra.boss) { e.health = Math.round(e.health * 0.8); e.hp = e.health; e.damage = Math.round(e.damage * 8) / 10; } return e; };
const hire = (s, id) => { s.follower = { id, hp: 1, ts: G.now() }; FOL2.st(s, id); s.follower.hp = FOL2.maxHp(s, id); };
const fightOf = (build, L, e, fol) => { const s = c.make(build, L); s.health = G.maxHealth(s); s.healthTs = G.now(); if (fol) hire(s, fol); const f = new G.Fight(s, e); if (!fol) f.allies = []; return f; };
const CHIEF = { name: "Bandit chief", health: 170, damage: 22, tags: ["humanoid", "elite"] };
const BANDIT = { name: "Bandit outlaw", health: 60, damage: 10, tags: ["humanoid"] };
const TROLL = { name: "Frost troll", health: 200, damage: 24, tags: ["beast", "elite"] };
const sessOf = (f) => { const s = new TB.Session(f, { trySneak: false }); s.round = 1; f.turn = 1; s.order = [{ id: "me", name: "me", init: 99 }, { id: "foe", name: "foe", init: 1 }]; s.idx = 0; s.cur = s.order[0]; s.beginTurn(); return s; };
/* run one move until it lands (blows can miss) */
function landed(build, L, base, prep, a, look, tries = 25) {
  for (let i = 0; i < tries; i++) {
    const f = fightOf(build, L, foeOf(base, L)), s = sessOf(f); f.sp = 1e4; f.mp = 1e4;
    prep(f, s); const b = f.ehp, r = s.act(a);
    if (r && !r.err && f.ehp < b && look(s.ev[s.ev.length - 1])) return { f, s, ev: s.ev[s.ev.length - 1], b };
  }
  return null;
}

// ---- the module is in, the oil flask is for sale, party phones share the setups
{
  ok(RX && TB.FOE_KEYS.includes("rx"), "reactions.js loaded and its setups sync to party phones");
  ok(D.ITEMS.oil_flask && D.ITEMS.oil_flask.slot === "misc" && D.SHOP_STOCK.general.includes("oil_flask"), "Oil Flask item, sold in general stores");
  for (const id of ["cold_breaker", "tactician", "bodyguard"]) ok(c.PERKS.BY_ID[id] && PFX.FX[id] && PFX.FX[id].length, "new perk with a real effect: " + id);
  for (const id of ["giant_slayer", "shield_brother", "barbarian", "shield_wall"]) ok(c.PERKS.BY_ID[id], "old perk kept: " + id);
}

// ---- Shatter: a power attack on a chilled foe, the frost is gone, done by a friend it hits harder
{
  const r = landed("twohand", 25, CHIEF, (f) => { f.foeSt = f.foeSt || {}; f.foeSt.chill = { turns: 3 }; f.cmark = { chill: "al0" }; }, "power_attack", (e) => /shatter!/i.test(e.text));
  ok(r, "a power attack on a chilled foe Shatters");
  if (r) {
    ok(/Team shatter/.test(r.ev.text) && r.ev.rx === "shatter", "frost from a friend: a team shatter with a banner: " + r.ev.text);
    ok(!r.f.foeSt.chill, "the frost is gone after Shatter");
    const bonus = +(r.ev.text.match(/shatter! \+(\d+)/i) || [])[1];
    ok(bonus > 0 && bonus <= r.s.ehpMax * (r.f.s.perks.cold_breaker ? 0.151 : 0.101), `the Shatter bonus is capped (${bonus} of ${r.s.ehpMax})`);
    ok(r.b - r.f.ehp <= r.s.ehpMax * 0.4 + 1, "the whole blow stays under the 40% cap");
    ok(!/opening!|shatters the frost!/.test(r.ev.text), "no double bonus from the plain opening");
  }
  // Cold Breaker makes it bigger
  const avg = (perk) => { let t = 0, k = 0; for (let i = 0; i < 40; i++) { const f = fightOf("twohand", 25, foeOf(CHIEF, 25)); f.s.perks = { ...f.s.perks, cold_breaker: perk ? 1 : 0 }; f.foeSt = { chill: { turns: 2 } }; f.ehp = 1e5; f.ehp0 = 1e5; const b = 1e5 - 100; f.ehp = b; const o = RX.blow(f, "me", b + 100, RX.pre(f), true, false); if (o.key) { t += b - f.ehp; k++; } } return t / Math.max(1, k); };
  const a0 = avg(false), a1 = avg(true); ok(a1 > a0 * 1.3, `Cold Breaker: Shatter hits harder (${a0.toFixed(1)} → ${a1.toFixed(1)})`);
}

// ---- Exploit: shield bash, then a power attack in the same round
{
  const r = landed("warrior", 25, CHIEF, (f, s) => { if (!f.shield) return; s.act("bash"); f.sp = 1e4; }, "power_attack", (e) => /Exploit/.test(e.text));
  ok(r && r.ev.rx === "exploit", "bash + power attack = Exploit" + (r ? ": " + r.ev.text : ""));
  if (r) ok(r.f.stagger || /stunned foe$/.test(r.ev.text.split("·").pop().trim()), "an Exploit keeps a normal foe reeling");
  const f = fightOf("warrior", 25, foeOf(CHIEF, 25)), s = sessOf(f); f.rx = { bash: { by: "me", until: 1 } }; f.turn = 2;
  ok(!RX.pre(f).bash, "the bash window closes after its round");
}

// ---- Precision: a mark makes arrows crit (yours or a friend's)
{
  const r = landed("archer", 25, CHIEF, (f, s) => { s.act("rx:mark"); f.sp = 1e4; }, "attack", (e) => /Precision/.test(e.text));
  ok(r && r.ev.rx === "precision", "Mark target + an arrow = Precision" + (r ? ": " + r.ev.text : ""));
  const f = fightOf("warrior", 25, foeOf(CHIEF, 25)); f.allies = [];
  ok(!RX.can(f, "rx:mark"), "no bow in the group: no Mark target");
  f.allies = [{ name: "Faendal", bow: true, hp: 100, maxHp: 100, dmg: 10 }]; f.sp = 100;
  ok(RX.can(f, "rx:mark"), "a friend with a bow: you can mark for them");
}

// ---- Stagger exploit: a shout, then a blow
{
  const r = landed("warrior", 25, CHIEF, (f) => { f.rx = { force: { by: "al0", until: 2 } }; }, "attack", (e) => /Stagger exploit/.test(e.text));
  ok(r && r.ev.rx === "force", "after a shout the next blow is a Stagger exploit" + (r ? ": " + r.ev.text : ""));
  const f = fightOf("warrior", 25, foeOf(CHIEF, 25)), s = sessOf(f); f.ehp = 500;
  RX.after(s, "shout:fus", 500, RX.pre(f)); ok(RX.pre(f).force, "a shout opens the foe up");
}

// ---- Burning ground: oil, then fire
{
  const f = fightOf("mage", 25, foeOf(TROLL, 25)), s = sessOf(f);
  f.s.inv.push({ id: "oilt", item: "oil_flask", qty: 2 });
  ok(RX.moves(f).some(([a]) => a === "rx:oil") && s.canAfford("rx:oil"), "with an oil flask you can throw it");
  const r = s.act("rx:oil"); ok(r && !r.err && RX.pre(f).oil && f.used.oilt === 1, "throwing it soaks the foe and uses a flask");
  ok(!s.canAfford("rx:oil"), "no second flask on a soaked foe");
  const fire = (f.s.spells || []).find((id) => D.SPELLS[id]?.element === "fire" && D.SPELLS[id]?.kind === "damage") || "flames";
  if (!f.s.spells.includes(fire)) f.s.spells.push(fire);
  ok(RX.ready(s, "spell:" + fire) === "burn", "a fire spell shows the combo icon on a soaked foe");
  const b = f.ehp, t = PFX.hitFoe(f, "fire", 40, "spell");
  ok(/Burning ground/.test(t) && f.rx.fire && f.rx.fire.left === 3 && f.ehp < b, "fire on oil: Burning ground: " + t);
  const e0 = f.ehp, line = { me: "", them: "" }; RX.tick(f, line);
  ok(f.ehp < e0 && /burning ground \d+/.test(line.me) && f.rx.fire.left === 2, "the ground burns at the end of the round: " + line.me);
  ok(f.rx.fire.dmg <= s.ehpMax * 0.036, "the burn is small (" + f.rx.fire.dmg + " of " + s.ehpMax + ")");
  const g = fightOf("mage", 25, foeOf(TROLL, 25)); sessOf(g); ok(PFX.hitFoe(g, "fire", 40, "spell").indexOf("Burning") < 0, "fire without oil: no burning ground");
}

// ---- Intercept: Cover allies takes a friend's blow, softer
{
  const f = fightOf("warrior", 25, foeOf(CHIEF, 25), "lydia"), s = sessOf(f), al = f.allies.find((x) => x.follower);
  ok(al && s.canAfford("rx:cover"), "with a friend beside you, you can cover them");
  const r = s.act("rx:cover"); ok(r && r.turn === "next", "Cover allies ends your turn");
  ok(RX.covering(f), "you are covering");
  f.tgtNow = al; RX.foePre(s); ok(f.tgtNow === null, "a blow meant for your friend comes to you");
  const hpB = f.hp; f.hp -= 100; const t = RX.foePost(s, hpB);
  ok(/Intercept!/.test(t) && Math.abs((hpB - f.hp) - 65) < 0.5, "and lands 35% softer: " + t);
  f.s.perks = { ...f.s.perks, bodyguard: 1 }; ok(RX.coverCut(f) > 0.59, "Bodyguard: covering hurts you less");
  s.beginTurn(); ok(!RX.covering(f), "the stance drops when your turn comes back");
  // the "Next:" chips show the blow coming to you
  f.foeTgts = [{ k: "x1", n: "Lydia", kind: "follower" }]; f.rx.cover = { by: "me", round: 1 }; RX.retarget(s);
  ok(f.foeTgts[0].k === "host" && f.foeTgts[0].from === "Lydia", "covering: the target chip now shows you");
  RX.beginTurn(f); ok(f.foeTgts[0].k === "x1", "and goes back when the stance drops");
}

// ---- the combo icon: which move would set one off now
{
  const f = fightOf("twohand", 25, foeOf(CHIEF, 25)), s = sessOf(f); f.sp = 500;
  ok(RX.ready(s, "power_attack") === null, "nothing to cash in: no icon");
  f.foeSt = { chill: { turns: 2 } }; ok(RX.ready(s, "power_attack") === "shatter" && RX.ready(s, "attack") === null, "chilled: the power attack shows Shatter");
  RX.off = true; ok(RX.ready(s, "power_attack") === null && RX.moves(f).length === 0, "combos off (for the sim): nothing"); RX.off = false;
}

// ---- Auto and the follower AI use combos
{
  const f = fightOf("twohand", 25, foeOf(CHIEF, 25)), s = sessOf(f); f.sp = 500; f.foeSt = { chill: { turns: 2 } };
  ok(RX.ai(s, "attack") === "power_attack", "Auto cashes in a Shatter with a power attack");
  f.foeSt = {}; f.rx = { oil: { by: "me", until: 3 } }; f.mp = 500; if (!f.s.spells.includes("flames")) f.s.spells.push("flames");
  ok(/^spell:/.test(RX.ai(s, "attack")), "Auto lights the oil with a fire spell");
  const al = { name: "Lydia", hp: 100, maxHp: 100 };
  f.rx = {}; f.foeSt = { chill: { turns: 2 } };
  ok(RX.value(f, al, { k: "power" }) > 1.3 && RX.value(f, al, { k: "attack" }) === 1, "a follower values a power attack on a chilled foe more");
  // a follower cashes in your frost (followerai.js)
  let hits = 0;
  for (let i = 0; i < 20 && !hits; i++) {
    const g = fightOf("mage", 25, foeOf(TROLL, 25), "lydia"), sg = sessOf(g), a = g.allies.find((x) => x.follower && x.fai);
    if (!a) break;
    g.foeSt = { chill: { turns: 3 } }; g.cmark = { chill: "me" }; a.sp = 200; a.ap = 6; g.ehp = 1e4; g.ehp0 = 1e4; sg.ehpMax = 1e4;
    c.FAI.turn(sg, g, a);
    if (sg.ev.some((e) => /shatter/i.test(e.text) && e.rx === "shatter")) hits++;
  }
  ok(hits > 0, "your follower shatters the foe you froze");
}

// ---- bosses: Withering Hex to cleanse, Marked for Death to protect a friend
{
  const f = fightOf("warrior", 25, foeOf(CHIEF, 25, { boss: true })), s = new TB.Session(f, { trySneak: false }), b = f.bf;
  ok(B.TELE.hex && B.TELE.doom, "two new boss moves");
  f.hp = 1e4; s.order = [{ id: "foe" }]; s.round = 3; b.tele = { key: "hex", round: 2, idx: 0, meAfter: true }; f.kit.plan = [{ id: "land", bf: "land" }]; f.ward = 0;
  const t = B.turn(s, () => f.enemyTurn());
  ok(b.hex && b.hex.left === B.HEX.rounds && /hexed/.test(t), "an unwarded hex sticks: " + t);
  s.round = 4; const h0 = f.hp, t2 = B.turn(s, () => f.enemyTurn()); ok(/the hex withers you/.test(t2) && f.hp < h0, "the hex hurts every round");
  ok(B.cleanses("potion:health") && B.cleanses("spell:healing") && !B.cleanses("attack"), "a potion or a healing spell washes it off");
  const tt = B.answer(s, "potion:health", f.ehp); ok(!b.hex && /washed away/.test(tt) && f._rxPend === "cleanse", "and it is gone, with a banner");
  b.hex = { left: 3, dmg: 5 }; ok(/^spell:|^potion:/.test(B.ai(s, "attack") || ""), "Auto cleanses a hex");
  b.hex = null;
  // Marked for Death: a friend in the fight
  const g = fightOf("warrior", 25, foeOf({ name: "Bandit warlord", health: 170, damage: 22, tags: ["humanoid", "elite"] }, 25, { boss: true }), "lydia"), sg = new TB.Session(g, { trySneak: false }), bg = g.bf;
  const al = g.allies.find((x) => x.follower);
  ok(bg && bg.prof === "warrior" && al, "a warrior boss with your follower beside you");
  if (bg && al) {
    bg.phase = 1; bg.teleN = 1; ok(B.teleKey(bg, g) === "doom", "in phase 2 it can mark a friend for death");
    g.kit.plan = [{ id: "bft_doom", bf: "tele", key: "doom" }]; sg.round = 2; sg.order = [{ id: "foe" }];
    const td = B.turn(sg, () => g.enemyTurn()); ok(bg.tele && bg.tele.key === "doom" && /marks Lydia for death/.test(td), "it marks your follower: " + td);
    const a0 = al.hp; g.hp = 1e4; const h1 = g.hp; sg.round = 3; g.kit.plan = [{ id: "land", bf: "land" }];
    const tl = B.turn(sg, () => g.enemyTurn()); ok(/unleashes Marked for Death/.test(tl) && h1 === g.hp, "uncovered, it goes for the friend, not you: " + tl);
    // covered: you take it, softer
    al.hp = a0; bg.tele = { key: "doom", round: 3, idx: 0, meAfter: true, doomK: c.FOEINTENT.keyOf(al), doomN: al.name }; g.kit.plan = [{ id: "land", bf: "land" }]; sg.round = 4;
    g.rx = { cover: { by: "me", round: 4 } }; const a1 = al.hp, h2 = g.hp;
    const tc = B.turn(sg, () => g.enemyTurn()); ok(al.hp === a1 && /you take the blow meant for Lydia/.test(tc), "covered, you take it for them: " + tc);
    ok(h2 - g.hp <= g.e.damage * 2.2 * 1.4, "and at about half");
    const s0 = fightOf("warrior", 25, foeOf({ name: "Bandit warlord", health: 170, damage: 22, tags: ["humanoid", "elite"] }, 25, { boss: true })); new TB.Session(s0, { trySneak: false });
    s0.bf.phase = 1; s0.bf.teleN = 1; ok(B.teleKey(s0.bf, s0) !== "doom", "alone: no Marked for Death");
  }
}

// ---- words: Polish for every line, no emoji, no Fallout
{
  const ctx = vm.createContext({ I18N_STORY: { ex: {}, pats: [] } });
  vm.runInContext(fs.readFileSync(W + "i18n_combos.js", "utf8"), ctx);
  vm.runInContext(fs.readFileSync(W + "i18n_boss.js", "utf8"), ctx);
  const PLX = ctx.I18N_STORY.ex, words = ctx.I18N_EXTRA.words, miss = [];
  const src = fs.readFileSync(W + "reactions.js", "utf8"), need = new Set();
  for (const m of src.matchAll(/(?:fmt|T)\("([^"]+)"/g)) need.add(m[1]);
  for (const m of src.matchAll(/say\("\w+", (?:\w+ \? )?"([^"]+)"(?: : "([^"]+)")?/g)) { need.add(m[1]); if (m[2]) need.add(m[2]); }
  for (const v of Object.values(RX.NAME)) need.add(v);
  for (const k of ["rx:oil", "rx:mark", "rx:cover"]) { const f = fightOf("warrior", 10, foeOf(BANDIT, 10)); f.sp = 0; f.allies = []; need.add(RX.why(f, k)); }
  need.add("Oil flask"); need.add("Mark target"); need.add("Cover allies"); need.add(D.ITEMS.oil_flask.name); need.add(D.ITEMS.oil_flask.desc);
  for (const id of ["cold_breaker", "tactician", "bodyguard"]) { const p = c.PERKS.BY_ID[id]; need.add(p.name); need.add(p.desc.replace(/\s*\[OURS\]$/, "")); }
  for (const k of need) if (k && !(k in PLX)) miss.push(k);
  ok(miss.length === 0, "every combo line has Polish: missing " + miss.join(" | "));
  const note = c.PATCHNOTES.LIST.find((x) => x.id === "b192-combos");
  ok(note && note === c.PATCHNOTES.LIST[0] || note, "a patch note for combos");
  if (note) { const pm = [note.title, ...note.items].filter((x) => !words[x]); ok(pm.length === 0, "the patch note has Polish: missing " + pm.join(" | ")); }
  const all = src + fs.readFileSync(W + "i18n_combos.js", "utf8");
  ok(!/\p{Extended_Pictographic}/u.test(all.replace(/[←-⇿☀-➿]/g, "")), "no emoji: game icons only");
  ok(!/fallout/i.test(all), "no Fallout");
}

// ---- balance: combos on vs off. Fights don't end much faster, no blow takes half a strong foe, bosses ~15 rounds
{
  const ROWS = [["twohand", 25, CHIEF, false], ["mage", 25, TROLL, false], ["warrior", 25, CHIEF, "lydia"], ["archer", 40, TROLL, "faendal"], ["warrior", 25, CHIEF, false, true], ["mage", 40, TROLL, "lydia", true], ["twohand", 10, CHIEF, false, true]].filter((r) => !process.env.ONLY || r[0] === process.env.ONLY);
  console.log("build      L  foe           fol      boss | off: win rnds | on: win rnds combos/fight  biggest blow");
  let worst = 0;
  for (const [build, L, base, fol, boss] of ROWS) {
    const res = {};
    for (const off of [true, false]) {
      RX.off = off; let w = 0, r = 0, cb = 0, big = 0;
      for (let i = 0; i < N; i++) {
        const f = fightOf(build, L, foeOf(base, L, boss ? { boss: true } : {}), fol);
        if (build === "mage" || build === "archer") f.s.inv.push({ id: "oil" + i, item: "oil_flask", qty: 1 });
        const s = TB.simulate(f, { trySneak: false });
        if (f.won || (f.ehp <= 0 && f.hp > 0)) w++; r += s.round; cb += (f.rx && f.rx.n) || 0;
        const mx = s.ehpMax || 1; let prev = null;
        for (const e of s.ev) { if ((e.who === "me" || e.kind === "ally") && e.dmg > 0) big = Math.max(big, e.dmg / mx); }
      }
      res[off ? "off" : "on"] = { w: w / N, r: r / N, cb: cb / N, big };
    }
    RX.off = false;
    worst = Math.max(worst, res.on.big);
    console.log(`${build.padEnd(10)} ${String(L).padStart(2)} ${base.name.padEnd(13)} ${String(fol || "-").padEnd(8)} ${boss ? "boss" : "    "} |      ${(res.off.w * 100).toFixed(0).padStart(3)}% ${res.off.r.toFixed(1).padStart(4)} |     ${(res.on.w * 100).toFixed(0).padStart(3)}% ${res.on.r.toFixed(1).padStart(4)} ${res.on.cb.toFixed(1).padStart(5)}        ${(res.on.big * 100).toFixed(0)}%`);
    ok(res.on.big < 0.5, `${build} L${L} ${base.name}: no blow takes half its health (${(res.on.big * 100).toFixed(0)}%)`);
    ok(res.on.r >= res.off.r * 0.75 - 0.5, `${build} L${L} ${base.name}: combos don't end fights much faster (${res.off.r.toFixed(1)} → ${res.on.r.toFixed(1)} rounds)`);
    if (boss && L >= 25) ok(res.on.r >= 9, `${build} L${L} boss still lasts (${res.on.r.toFixed(1)} rounds)`);
    if (N >= 8) ok(res.on.w >= res.off.w - 0.25, `${build} L${L} ${base.name}: combos don't make you lose more (${(res.off.w * 100).toFixed(0)}% → ${(res.on.w * 100).toFixed(0)}%)`);
  }
}

console.log(fails ? `${fails} of ${n} checks FAILED` : `ALL OK (${n} checks)`);
process.exit(fails ? 1 : 0);
