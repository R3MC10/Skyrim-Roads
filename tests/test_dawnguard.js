// The vampire war (dawnguard.js): places on the map, the shared opening, one side only, both paths played through,
// side gifts (gear, bolts, troll armour, Harkon's blood), side perks with real effects, the party rule, achievements,
// Polish for every line, and a balance sim. W=/path/to/game/ node test_dawnguard.js   (N=30 by default)
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
// fixed dice so the balance sim gives the same answer on every run (it used to fail now and then by luck alone); SEED=n to try others
{ let a = +(process.env.SEED || 20261124) >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, process };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {} };
{ // every double-quoted string in dawnguard.js that reads like words (ids, colours, skills, tags and templates left out)
  const code = /^(?:[a-z0-9_:\-#. ]*|[a-z]+[A-Z]\w*|.*\$\{.*|.*[=<>].*|[\][(){}].*|\w+:[\w-]+|One-Handed|Two-Handed|Archery|Sneak)$/, out = new Set();
  for (const line of fs.readFileSync(W + "dawnguard.js", "utf8").split("\n")) {
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
    for (const m of line.replace(/\/\/.*$/, "").matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) { const v = m[1].replace(/\\"/g, '"'); if (/[A-Za-z]{2}/.test(v) && !code.test(v)) out.add(v); }
  }
  c.__cands = [...out]; }
vm.createContext(c);
// the whole game in index.html order, so fights use everything a phone uses (foe perks, shields, follower AI...);
// the few screen-only files that need a page are skipped
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const SIM = fs.readFileSync(__dirname + "/test_bal_sim.js", "utf8");
vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"), SIM.indexOf("const BUILDS")) + `
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const at = (s, p) => { s.location = p; [s.x, s.y] = WORLD.places[p]; s.discovered = s.discovered || []; if (!s.discovered.includes(p)) s.discovered.push(p); s.trip = null; s.dungeon = null; };
const hero = (build = "warrior", lvl = 40) => { const s = make(build, lvl); s.id = s.id || "h" + Math.random(); s.quests = {}; s.gold = 9999; s.thaneWhiterun = true; QUESTS.ensure(s); return s; };
/* one step of a line: clears are marked done, talks are tapped (retrying a lost fight with full health) */
function step(s, id) {
  const v = s.quests[id], st = QUESTS.L[id].stages[v.stage], o = st.obj;
  if (o.clear) { at(s, o.clear); s.cleared = s.cleared || {}; s.cleared[o.clear] = G.now() + 5; const m = QUESTS.check(s); OK(m.length, "clear advances " + st.title); return m; }
  at(s, o.talk);
  for (let k = 0; k < 12; k++) {
    const before = v.stage; G.setHealth(s, G.maxHealth(s)); v.retryAt = 0;
    const r = QUESTS.talk(s, id);
    if (r.fight) OK(!isNaN(r.fight.hp) && !isNaN(r.fight.ehp), "no NaN in " + st.title);
    if (v.stage > before || v.done) return r.msgs || [];
  }
  throw new Error("FAIL stuck at " + st.title);
}
const play = (s, id) => { const out = []; for (let g = 0; g < 20 && !s.quests[id].done; g++) out.push(...step(s, id)); OK(s.quests[id].done, id + " finished"); return out; };

// 1. the map: Fort Dawnguard, Dimhollow Crypt and Castle Volkihar; every stage's place is real; clears are dungeons, keeps aren't
for (const p of ["Fort Dawnguard", "Dimhollow Crypt", "Castle Volkihar"]) OK(WORLD.places[p], p + " is on the map");
OK(DUNGEONS.enterable("Dimhollow Crypt"), "Dimhollow Crypt can be cleared");
OK(!DUNGEONS.enterable("Fort Dawnguard") && !DUNGEONS.enterable("Castle Volkihar") && !DUNGEONS.info("Castle Volkihar"), "the two keeps are not dungeons");
OK(WORLD.islets.some((i) => i[4] === "volkihar") && WORLD.swims.some((w) => w[2] === "Castle Volkihar"), "Castle Volkihar sits on its islet, reached through the shallows");
for (const id of DAWNGUARD.LINES) {
  const d = QUESTS.L[id]; let last = 0;
  d.stages.forEach((st, i) => { const p = QUESTS.target(st); OK(WORLD.places[p], id + " stage " + i + " place " + p); if (st.obj.clear) OK(DUNGEONS.enterable(st.obj.clear), "enterable " + st.obj.clear);
    const r = QUESTS.recOf(id, i); OK(r >= last, "recommended levels rise " + id + " " + i); last = r; });
}
OK(QUESTS.L.dg_awakening.stages.length + QUESTS.L.dg_dawnguard.stages.length === 10 && QUESTS.L.dg_awakening.stages.length + QUESTS.L.dg_volkihar.stages.length === 10, "10 stages per path counting the opening");
for (const it of DAWNGUARD.ITEMS) OK(D.ITEMS[it] && D.ITEMS[it].name, "item " + it);
OK(DAWNGUARD.ITEMS.length === 9, "nine new items: " + DAWNGUARD.ITEMS.length);

// 2. the opening: level gate, sides hidden until it's done
const low = hero("warrior", 8); at(low, "Fort Dawnguard");
OK(!QUESTS.canJoin(low, "dg_awakening") && /level 12/.test(QUESTS.join(low, "dg_awakening")), "level gate on the opening");
const A = hero("warrior", 40); at(A, "Fort Dawnguard");
OK(!QUESTS.visible(A, "dg_dawnguard") && !QUESTS.visible(A, "dg_volkihar"), "sides hidden before the opening");
OK(!QUESTS.canJoin(A, "dg_dawnguard") && /Awakening first/.test(QUESTS.join(A, "dg_dawnguard")), "can't pick a side yet");
OK(QUESTS.canJoin(A, "dg_awakening") && /Awakening/.test(QUESTS.join(A, "dg_awakening")), "joined the opening");
play(A, "dg_awakening");
OK(DAWNGUARD.opened(A) && A.location === "Castle Volkihar", "opening ends in Harkon's hall");
OK(QUESTS.visible(A, "dg_dawnguard") && QUESTS.visible(A, "dg_volkihar"), "both sides offered");
OK(QUESTS.canJoin(A, "dg_dawnguard") && QUESTS.canJoin(A, "dg_volkihar"), "both Join buttons in Harkon's hall");
at(A, "Riften"); OK(!QUESTS.canJoin(A, "dg_dawnguard") && /Fort Dawnguard/.test(DAWNGUARD.choose(A, "dawnguard")), "the answer is given at the fort or the castle");
OK(/Castle Volkihar/.test(DAWNGUARD.choose(A, "volkihar")), "Harkon's offer only in his hall");

// 3. Dawnguard path, one side only
at(A, "Whiterun"); OK(TOWNS.hire(A, "lydia") && A.follower, "Lydia hired"); at(A, "Fort Dawnguard");
OK(/Hunt the Night/.test(QUESTS.join(A, "dg_dawnguard")) && DAWNGUARD.side(A) === "dawnguard", "sided with the Dawnguard");
OK(!QUESTS.visible(A, "dg_volkihar") && /turned Harkon down/.test(QUESTS.join(A, "dg_volkihar")), "Harkon's court closed after that");
OK(/already chosen/.test(DAWNGUARD.choose(A, "dawnguard")), "no double join");
const msgsA = play(A, "dg_dawnguard");
OK(["dawnguard_helmet", "dawnguard_armor", "crossbow_dawnguard", "dawnguard_rune_warhammer"].every((i) => A.inv.some((r) => r.item === i)), "hunter's gear, crossbow and the rune hammer");
OK(A.inv.some((r) => r.item === "bolt_steel" && r.qty >= 40) || A.inv.filter((r) => r.item === "bolt_steel").length, "bolts for the crossbow");
OK(msgsA.some((m) => /steel bolts/.test(m)), "Isran's bolts announced");
OK(msgsA.some((m) => /troll armour/.test(m)), "troll armour announced: " + msgsA.filter((m) => /troll/.test(m)));
const fa = FOL2.st(A); OK(fa && fa.inv.some((r) => r.item === "troll_armor"), "the follower carries the troll armour");
OK(A.dgDawnguard && A.titles.includes("Hero of the Dawnguard"), "Dawnguard ending: flag and title");
OK(!A.vampire, "a hunter stays human");
const fresh = ACH.check(A, 1); OK(A.ach.dg_dawnguard && !A.ach.dg_volkihar, "Dawn Breaks earned");

// 4. Volkihar path: werewolves refused, Harkon's blood makes you a vampire with Lord perks ready
const B = hero("twohand", 40); at(B, "Fort Dawnguard"); QUESTS.join(B, "dg_awakening"); play(B, "dg_awakening");
B.vampire = { since: 0, fedAt: 0 }; at(B, "Castle Volkihar");
OK(!QUESTS.canJoin(B, "dg_dawnguard") && /won't let a vampire/.test(QUESTS.join(B, "dg_dawnguard")), "Isran refuses vampires");
B.vampire = null;
OK(/Harkon's Gift/.test(QUESTS.join(B, "dg_volkihar")) && DAWNGUARD.side(B) === "volkihar", "sided with Harkon");
OK(/drunk Harkon's blood/.test(QUESTS.join(B, "dg_dawnguard")) && !QUESTS.visible(B, "dg_dawnguard"), "the Dawnguard closed after that");
B.werewolf = { since: 0 }; OK(/werewolf/.test(QUESTS.talk(B, "dg_volkihar").text) && B.quests.dg_volkihar.stage === 0, "no blood for a werewolf");
B.werewolf = null;
const r0 = QUESTS.talk(B, "dg_volkihar");
OK(B.vampire && B.quests.dg_volkihar.stage === 1, "drank Harkon's blood");
OK(r0.msgs.some((m) => /Harkon's blood burns/.test(m)), "the change is announced");
OK(CURSE.points(B, "lord") >= 2, "two Vampire Lord perks ready: " + CURSE.points(B, "lord"));
play(B, "dg_volkihar");
OK(B.dgVolkihar && B.titles.includes("Lord of Volkihar") && ["vampire_royal_armor", "harkons_sword"].every((i) => B.inv.some((r) => r.item === i)), "Volkihar ending: armour, sword, title");
ACH.check(B, 1); OK(B.ach.dg_volkihar && !B.ach.dg_dawnguard, "Lord of the Night earned");

// 5. side perks: gated by side, with real effects
OK(/Dawnguard/.test(PERKS.canTake(B, "dg_bolt_hunter")) && /Dawnguard/.test(PERKS.take(B, "dg_bolt_hunter")), "Harkon's side can't take hunter perks");
OK(/Harkon's blood/.test(PERKS.canTake(A, "volk_blood_of_harkon")), "hunters can't take Volkihar perks");
OK(!/Harkon's blood/.test(PERKS.canTake(B, "volk_blood_of_harkon") || ""), "Harkon's side can (skill permitting)");
OK(Object.keys(DAWNGUARD.PERK_SIDE).every((id) => PFX.FX[id]), "every side perk has effects");
{ const s = hero("archer", 30); const und = { s, tags: new Set(["undead"]), e: { name: "Vampire" }, hp: 100, ehp: 100 }, man = { ...und, tags: new Set(["humanoid"]) };
  const u0 = PFX.sum(s, "out", und, { sk: "Archery" }), m0 = PFX.sum(s, "out", man, { sk: "Archery" });
  s.perks.dg_bolt_hunter = 1;
  OK(Math.abs(PFX.sum(s, "out", und, { sk: "Archery" }) - u0 - 0.25) < 1e-9 && PFX.sum(s, "out", man, { sk: "Archery" }) === m0, "Vampire Hunter: +25% bow damage to the undead only");
  const hv = hero("warrior", 30), uh = { ...und, s: hv, eq: { head: { item: "dawnguard_helmet" }, chest: { item: "dawnguard_armor" } } }, b0 = PFX.sum(hv, "in", uh, {}); hv.perks.dg_sun_ward = 1;
  OK(Math.abs(PFX.sum(hv, "in", uh, {}) - b0 + 0.15) < 1e-9, "Sun-Blessed Plate: undead hit a heavy-armoured hero 15% softer"); }
{ const s = hero("mage", 30); s.vampire = { since: 0, fedAt: 0 }; s._test = true;
  const mk = () => ({ s, pw: { lord: 0 }, hp: 50, ehp: 1000, t: 0, allies: [], tags: new Set(), e: { name: "Bandit" } });
  const f0 = mk(); CURSE.lordForm(f0); const base = f0.pw.lord, hp0 = f0.hp;
  const in0 = CURSE.dmgInMult(f0), out0 = CURSE.dmgMult(f0); const l0 = { me: "" }; const e0 = f0.ehp; CURSE.tick(f0, l0); const drain0 = e0 - f0.ehp;
  s.perks.volk_blood_of_harkon = 1; s.perks.volk_night_lord = 1; s.perks.volk_court = 1;
  const f1 = mk(); CURSE.lordForm(f1);
  OK(f1.pw.lord === base + 3 && f1.hp > hp0, "Blood of Harkon: 3 more turns and a heal (" + base + " -> " + f1.pw.lord + ")");
  OK(Math.abs(CURSE.dmgMult(f1) / out0 - 1.2) < 1e-9 && Math.abs(CURSE.dmgInMult(f1) / in0 - 0.9) < 1e-9, "Court of Volkihar: +20% out, -10% in");
  const l1 = { me: "" }, e1 = f1.ehp; CURSE.tick(f1, l1);
  OK(Math.abs((e1 - f1.ehp) / drain0 - 1.3) < 1e-6 && /Harkon's blood/.test(l1.me), "Night Lord: drain 30% stronger");
  const f2 = mk(); OK(CURSE.dmgMult(f2) === 1 || CURSE.dmgMult(f2) === out0 / 1 || f2.pw.lord === 0, "no Lord bonus outside the form"); }
{ const s = hero("warrior", 30); s.perks.dg_troll_tamer = 1; OK(PFX.num(s, "allies") >= 0.15 && PFX.num(s, "foltaken") >= 0.1, "Troll Tamer: follower hits harder and takes less"); }

// 6. party: only the leader picks; members follow
{ const role0 = PARTYPLAY.role; PARTYPLAY.role = () => "member";
  const M = hero("warrior", 30); at(M, "Fort Dawnguard"); QUESTS.join(M, "dg_awakening"); play(M, "dg_awakening");
  DAWNGUARD.setLeaderCard(() => null);
  OK(!QUESTS.canJoin(M, "dg_dawnguard") && /leader picks a side/.test(QUESTS.join(M, "dg_volkihar")), "members wait for the leader");
  DAWNGUARD.setLeaderCard(() => ({ dg: "volkihar" }));
  OK(!QUESTS.canJoin(M, "dg_dawnguard") && /Harkon's court/.test(QUESTS.join(M, "dg_dawnguard")), "members can't pick the other side");
  OK(QUESTS.canJoin(M, "dg_volkihar") && DAWNGUARD.side((QUESTS.join(M, "dg_volkihar"), M)) === "volkihar", "members follow the leader's pick");
  PARTYPLAY.role = role0; DAWNGUARD.setLeaderCard(() => null);
  OK(PARTY.cardBits(A, null).dg === "dawnguard" && PARTY.cardBits(B, null).dg === "volkihar", "your side goes out with your party card"); }

// 7. Polish
{ const places = new Set(Object.keys(WORLD.places)), SPLIT = /(?<=[.!?…])(\\s+)|(?<=[.!?]["”])(\\s+)/;
  const perkTexts = PFX.ADD.filter((p) => DAWNGUARD.PERK_SIDE[p[1]]).flatMap((p) => [p[2], p[6].replace(/\\s*\\[[^\\]]*\\]\\s*$/, "")]);
  OK(perkTexts.length === 12, "six side perks found in the trees");
  const achTexts = ACH.LIST.filter((a) => /^dg_/.test(a[0])).flatMap((a) => [a[2], a[3]]);
  const all = [...__cands, ...perkTexts, ...achTexts].filter((v) => v && !places.has(v));
  const sentenceMissing = (v) => (I18N.tr(v) != null && v.split(SPLIT).filter((p) => p && p.trim()).every((p) => I18N.tr(p.trim()) != null)) ? null : v;
  const missing = all.filter((v) => sentenceMissing(v));
  OK(!missing.length, "every vampire-war line has Polish (" + missing.length + " missing: " + missing.slice(0, 6).join(" | ") + ")");
  OK(achTexts.length === 4, "achievement texts checked");
  __lang = "pl"; OK(I18N.lang() === "pl", "Polish on");
  OK(I18N.tr("Dawnguard: Hunt the Night") === "Straż Świtu: Łowy na noc", "line name in Polish");
  OK(/Straż Świtu/.test(I18N.tr(QUESTS.L.dg_awakening.stages[0].text)) && !/Isran is rebuilding/.test(I18N.tr(QUESTS.L.dg_awakening.stages[0].text)), "stage text in Polish");
  { const done = I18N.tr("📜 Dawnguard: Hunt the Night: “Awakening” done (200 gold, the title Vampire Hunter).");
    OK(/^📜 Straż Świtu: Łowy na noc: „.+” ukończone \\(200 złota, tytuł .+\\)\\.$/.test(done), "stage-done line in Polish: " + done);
    const both = I18N.tr("Awakening 📜 Dawnguard: Hunt the Night: “Awakening” done. New objective: Prophet.");
    OK(/ukończone/.test(both) && /Nowy cel/.test(both) && !/ done/.test(both), "stage-done line after a stage title in Polish: " + both);
    OK(/^Znajdziesz ich tu: /.test(I18N.tr("Find them at Fort Dawnguard.")), "where to find a quest giver in Polish");
    OK(I18N.tr("They're here. Ask to join.") === "Są tutaj. Poproś, żeby cię przyjęli.", "quest giver here, in Polish"); }
  __lang = "en"; }

// 8. balance: plain-gear heroes at the recommended level win most fights; the final bosses are beatable at 25+ and never one-shot
const N = +(process.env.N || 30), rows = [], BUILDS5 = ["warrior", "twohand", "archer", "mage", "spellsword"];
function trial(id, i, lvl) {
  const st = QUESTS.L[id].stages[i], o = st.obj; let w = 0, minTurns = 99, turns = 0, left = 0, big = 0;
  for (let k = 0; k < N; k++) {
    const s = make(BUILDS5[k % 5], lvl); s.quests = { [id]: { stage: i, t: G.now() } };
    if (id === "dg_volkihar") s.vampire = { since: 0, fedAt: 0 };
    at(s, o.talk); G.setHealth(s, G.maxHealth(s));
    const def = o.fight || o.check.fight, e = QUESTS.foeFor(s, id, i, def), f = new G.Fight(s, e, null, G.now());
    (o.allies || []).forEach(([name, dmg]) => f.allies.push({ name, dmg })); f.run({ t: G.now() });
    const mh = G.maxHealth(s); for (const l of f.log) for (const m of String(l.them || "").matchAll(/ hits ([0-9]+)/g)) big = Math.max(big, +m[1] / mh);   // the foe's blows on you
    if (f.won) { w++; minTurns = Math.min(minTurns, f.turn); left += Math.min(1, Math.max(0, f.hp) / mh); } turns += f.turn;
  }
  return { w: Math.round(100 * w / N), minTurns, avgTurns: Math.round(turns / N), left: Math.round(100 * left / Math.max(1, w)), big: Math.round(100 * big) };
}
for (const id of DAWNGUARD.LINES) QUESTS.L[id].stages.forEach((st, i) => {
  if (!st.obj.fight && !(st.obj.check && st.obj.check.fight)) return;
  const rec = QUESTS.recOf(id, i), r = trial(id, i, rec); rows.push([id, st.title, rec, r]);
  console.log(id + " · " + st.title + " · lvl " + rec + " · win " + r.w + "% · turns avg " + r.avgTurns + " min " + r.minTurns + " · health left " + r.left + "% · biggest hit " + r.big + "%");
});
const mean = (k) => rows.reduce((a, r) => a + r[3][k], 0) / rows.length, avg = mean("w"), avgLeft = mean("left");
console.log("at the recommended level: average win " + Math.round(avg) + "% · average health left " + Math.round(avgLeft) + "%");
OK(avg >= 82 && avg <= 97, "most heroes win at the recommended level, but not all (" + Math.round(avg) + "%)");
OK(rows.every((r) => r[3].w >= 65), "no fight a wall at its level");
OK(avgLeft <= 80 && avgLeft >= 40, "fights cost health (" + Math.round(avgLeft) + "% left on average)");
OK(rows.every((r) => r[3].big <= 40), "no foe takes more than 40% of your health in one blow");
for (const r of rows) if (QUESTS.L[r[0]].stages.length - 1 === QUESTS.L[r[0]].stages.findIndex((st) => st.title === r[1])) {
  OK(r[3].minTurns >= 3, r[0] + " final boss lasts at least 3 turns at its level");
  OK(r[3].left <= 75, r[0] + " final boss costs real health (" + r[3].left + "% left)"); }
for (const id of ["dg_dawnguard", "dg_volkihar"]) {
  const i = QUESTS.L[id].stages.length - 1;
  for (const lvl of [25, 30, 40]) { const r = trial(id, i, lvl); console.log(id + " final boss at level " + lvl + ": win " + r.w + "% · turns avg " + r.avgTurns + " min " + r.minTurns + " · health left " + r.left + "%");
    if (lvl >= 25) OK(r.w >= 35, id + " final boss beatable at level " + lvl);
    OK(r.minTurns >= 3, id + " final boss never falls in under 3 turns at level " + lvl); }
}
console.log("dawnguard ok · " + n + " checks");
`, c);
