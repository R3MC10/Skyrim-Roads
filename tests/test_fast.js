/* Quicker travel and fights (fastqol.js). W=/path/to/game/ node test_fast.js — prints ALL OK.
   Recent trips and "Again"/"Back to", settings, remembered picks, the too-heavy loot ask, Fight again buttons,
   and the hooks in fightart.js / ui.js / index.html. Nothing here may change a fight. */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const store = {};
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, structuredClone,
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "smithing.js", "social.js", "roam.js", "mp.js", "fastqol.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let n = 0;
const ok = (cond, m) => { n++; if (!cond) throw new Error("FAIL " + m); };
c.ok = ok;
vm.runInContext(`(() => {
  const F = FASTQOL;
  ok(G.startTrip.fq, "startTrip is wrapped once");
  F.wrapTrips(); ok(G.startTrip.orig && !G.startTrip.orig.fq, "no double wrap");
  // ---- recent trips
  const s = G.newSave("fq", "Quick", "nord"); s._test = true;
  s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun.slice(0, 2);
  ok(F.recentHTML(s) === "", "nothing to suggest at first");
  ok(!G.startTrip(s, "Riverwood", WORLD.places.Riverwood.slice(0, 2)), "trip starts");
  ok(s.fqTrips.last.from === "Whiterun" && s.fqTrips.last.to === "Riverwood" && s.fqTrips.recent[0] === "Riverwood", "trip recorded " + JSON.stringify(s.fqTrips));
  // arrive
  let t = G.now(); for (let i = 0; i < 400 && s.trip; i++) { t += 60; if (s.trip.status !== "travel") { s.trip.status = "travel"; s.trip.encounter = null; s.trip.event = null; } G.advance(s, t, []); }
  ok(!s.trip && s.location === "Riverwood", "arrived in Riverwood");
  let sg = F.suggestions(s);
  ok(sg.again && sg.again.to === "Whiterun" && /Back to Whiterun/.test(sg.again.label), "back to where you came from " + JSON.stringify(sg));
  ok(!sg.recent.includes("Riverwood"), "never suggests where you are");
  const h = F.recentHTML(s);
  ok(/data-act="go" data-place="Whiterun"/.test(h) && /Recent trips/.test(h), "chips use the game's own Go");
  // go back, then the same trip again
  ok(!G.startTrip(s, "Whiterun", WORLD.places.Whiterun.slice(0, 2)), "trip back starts");
  ok(F.suggestions(s).again === null, "no Again while on the road");
  s.trip = null; s.location = "Riverwood"; [s.x, s.y] = WORLD.places.Riverwood.slice(0, 2);   // as if we went back to the start of that trip
  sg = F.suggestions(s);
  ok(sg.again && sg.again.to === "Whiterun" && /Again: Riverwood → Whiterun/.test(sg.again.label), "Again repeats the last trip " + JSON.stringify(sg));
  // roaming spots and unknown names aren't recorded, the list stays short and unique
  const before = JSON.stringify(s.fqTrips);
  F.record(s, "the wilds near Whiterun"); ok(JSON.stringify(s.fqTrips) === before, "roam spots not recorded");
  for (const p of ["Solitude", "Markarth", "Riften", "Windhelm", "Dawnstar", "Falkreath", "Solitude"]) { s.trip = { origin: "Riverwood" }; F.record(s, p); }
  s.trip = null;
  ok(s.fqTrips.recent.length === 6 && new Set(s.fqTrips.recent).size === 6 && s.fqTrips.recent[0] === "Solitude", "recent list " + s.fqTrips.recent);
  ok(F.suggestions(s).recent.length <= 4, "at most 4 chips plus Again");
  ok(F.suggestions({ ...s, dungeon: { place: "x" } }).recent.length === 0, "nothing inside a dungeon");
  ok(JSON.parse(JSON.stringify(s)).fqTrips.recent.length === 6, "saved with the character");
  // ---- settings
  ok(F.speed() === 1 && F.autoRoad() === false, "defaults: x1, wait for me");
  ok(F.pref("fightSpeed", "4") && F.speed() === 4, "speed x4");
  ok(F.pref("fightSpeed", "3") && F.speed() === 4, "bad speed ignored");
  ok(F.pref("fqAutoRoad", "true") && F.autoRoad() === true, "carry on");
  ok(F.pref("lang", "en") === false, "other settings untouched");
  const seg = (k, opts, cur) => k + ":" + opts.map(([v, l]) => (String(v) === String(cur) ? "[" + l + "]" : l)).join(",");
  const sh = F.settingsHTML(seg);
  ok(/fightSpeed:×1,×2,\\[×4\\]/.test(sh) && /fqAutoRoad:Wait for me,\\[Carry on\\]/.test(sh), "settings rows " + sh);
  // ---- remembered picks
  ok(F.mem("arenaStake", 100) === 100, "default bet");
  F.setMem("arenaStake", 500); F.setMem("testFoe", "Bandit");
  ok(F.mem("arenaStake", 100) === 500 && F.mem("testFoe") === "Bandit", "remembered");
  ok(F.speed() === 4, "remembering doesn't touch other prefs");
  // ---- too heavy after a fight
  const s2 = G.newSave("fq2", "Mule", "nord"); s2._test = true;
  ok(F.lootHTML(s2, { fight: { won: true }, loot: ["Iron Sword"] }) === "", "not heavy: no question");
  const heavy = Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].weight >= 10 && D.ITEMS[k].name).sort((a, b) => D.ITEMS[b].weight - D.ITEMS[a].weight)[0];
  while (!G.overweight(s2)) G.give(s2, Object.keys(D.ITEMS).find((k) => D.ITEMS[k].weight === 1), 5);
  const carried0 = G.carried(s2);
  G.give(s2, heavy); G.give(s2, heavy);
  const loot = [D.ITEMS[heavy].name, D.ITEMS[heavy].name];
  const eqBefore = JSON.stringify(G.loadout ? G.loadout(s2).equipment : {});
  const box = F.lootHTML(s2, { fight: { won: true }, loot });
  ok(/Too heavy now/.test(box) && /data-fq="lootkeep"/.test(box) && /data-fq="lootdrop"/.test(box), "asks when too heavy");
  ok(F.lootHTML(s2, { fight: { won: true }, loot, died: "x" }) === "" && F.lootHTML(s2, { fight: { won: true }, loot: [] }) === "", "no ask when dead or no loot");
  const rows = F.newRows(s2, loot);
  ok(rows.length === 2 && rows.every((r) => r.item === heavy), "finds the new rows " + JSON.stringify(rows));
  const left = F.dropHeavy(s2, loot);
  ok(left.length >= 1 && G.carried(s2) < carried0 + 2 * D.ITEMS[heavy].weight, "left some behind: " + left);
  ok(JSON.stringify(G.loadout ? G.loadout(s2).equipment : {}) === eqBefore, "equipment untouched");
  // a stack: only as many as needed
  const s3 = G.newSave("fq3", "Stack", "nord"); s3._test = true;
  const stackItem = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "ammo" && D.ITEMS[k].weight > 0) || null;
  if (stackItem) {
    while (G.capacity(s3) - G.carried(s3) > 0.5) G.give(s3, Object.keys(D.ITEMS).find((k) => D.ITEMS[k].weight === 1), 1);
    const per = D.ITEMS[stackItem].weight, q = Math.ceil(3 / per) + 20;
    G.give(s3, stackItem, q);
    ok(G.overweight(s3), "stack makes you heavy");
    const l3 = F.dropHeavy(s3, [D.ITEMS[stackItem].name + " ×" + q]);
    const row = s3.inv.find((r) => r.item === stackItem);
    ok(!G.overweight(s3) && row && row.qty > 0, "kept part of the stack: " + l3 + " · kept " + (row && row.qty));
  }
  // ---- fight again
  ok(/data-act="test"/.test(F.againHTML("test")), "Fight again reruns the test fight");
  ok(/data-act="duelgo" data-id="p1"/.test(F.againHTML("duel", "p1")) && F.againHTML("duel") === "", "Challenge again");
  ok(/&lt;x&gt;/.test(F.againHTML("duel", "<x>")), "ids escaped");
})();`, c);

// ---- the hooks in shared files
const fa = fs.readFileSync(W + "fightart.js", "utf8"), ui = fs.readFileSync(W + "ui.js", "utf8"), html = fs.readFileSync(W + "index.html", "utf8");
ok(/\[1, 2, 4\]\.includes\(prefs\(\)\.fightSpeed\)/.test(fa) && /speed === 1 \? 2 : speed === 2 \? 4 : 1/.test(fa), "fightart: x1/x2/x4");
ok(/Skip to result/.test(fa) && /finishAll, playing/.test(fa), "fightart: Skip to result, finishAll");
ok(/FASTQOL\.recentHTML\(S\)/.test(ui) && /FASTQOL\.lootHTML\(S, r\)/.test(ui) && /FASTQOL\.againHTML\("test"\)/.test(ui) && /FASTQOL\.againHTML\("duel"/.test(ui) && /FASTQOL\.settingsHTML\(seg\)/.test(ui) && /FASTQOL\.pref\(k/.test(ui), "ui.js hooks");
for (const m of ui.matchAll(/[^\n]*FASTQOL\.[^\n]*/g)) ok(/typeof FASTQOL !== "undefined"/.test(m[0]), "guarded: " + m[0].trim().slice(0, 80));
const iF = html.indexOf('src="fastqol.js"'), iU = html.indexOf('src="ui.js"'), iA = html.indexOf('src="fightart.js"');
ok(iF > 0 && iF < iU && iA < iU, "fastqol.js loads before ui.js");
const st2 = html.lastIndexOf("</style>"), cssAt = html.indexOf(".fqrecent{");
ok(cssAt > 0 && cssAt < st2 && cssAt > html.indexOf("<style>", 20), "CSS in the second style block");
// fights untouched: fastqol never touches the fight engine
const src = fs.readFileSync(W + "fastqol.js", "utf8");
ok(!/Fight\.prototype|G\.Fight\s*=|Math\.random\s*=/.test(src), "fastqol doesn't touch fights");
console.log(`ALL OK (${n} checks)`);
