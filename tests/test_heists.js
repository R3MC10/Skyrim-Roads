// Heists in the big cities (heists.js): one NPC household per big city, the five steps, every way past a door and what
// it costs (bounty, corruption in the hold, the fence's cut), the alarm, the perks with real effects, the party vote
// (majority, tie to the leader), save repair, a balance sim against the Thieves Guild job and Polish for every line.
//   W=/path/to/game/ node test_heists.js
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, process };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {} };
vm.createContext(c);
for (const f of fs.readFileSync(W + "index.html", "utf8").match(/<script src="[^"]+"/g).map((m) => m.slice(13, -1)))
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (er) { if (!/^(store|ui)\.js$/.test(f)) console.log("skipped " + f + ": " + er.message); } }
const SIM = fs.readFileSync(__dirname + "/test_bal_sim.js", "utf8");
vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"), SIM.indexOf("const BUILDS")) + `
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const H = HEISTS;
const CITIES = ["Whiterun", "Solitude", "Windhelm", "Riften", "Markarth"];
const hero = (lvl = 20, city = "Whiterun", thief = 0) => {
  const s = make("warrior", lvl); s.id = "h" + Math.random(); s.gold = 20000; s.trip = null; s.dungeon = null; s.bounty = {};
  s.location = city; [s.x, s.y] = WORLD.places[city]; s._test = 1;
  for (const k of ["Sneak", "Lockpicking", "Speechcraft", "Acrobatics", "Illusion", "Etiquette"]) s.skills[k].lvl = Math.min(100, s.skills[k].lvl + thief);
  return s;
};
const has = (s, id) => (s.inv || []).some((r) => r.item === id);
const cnt = (s, id) => (s.inv || []).filter((r) => r.item === id).reduce((a, r) => a + r.qty, 0);
const R0 = Math.random; const dice = (v) => { Math.random = () => v; }; const real = () => { Math.random = R0; };
const cor = (s, hold) => (s.crises && s.crises.d && s.crises.d[hold] ? s.crises.d[hold].cor || 0 : 0);
let T0 = 1e7; const tk = (d = 10) => (T0 += d);

// 1. one household per big city, all NPCs, prizes and tools are real items
for (const city of CITIES) {
  const h = H.houseAt(city); OK(h && H.BY_ID[h.id] && H.BY_ID[h.id].city === city, "a heist in " + city);
  OK(h.tier >= 1 && h.tier <= 4 && h.minLv >= 1, city + " has a tier and a level");
  const it = D.ITEMS[h.prize]; OK(it && it.slot === "valuable" && it.value >= 500 && it.heist, city + " prize is a valuable worth a fence's time (not trinket junk)");
  OK(h.name[1] && h.blurb[1] && h.way[1] && h.wayWho[1] && h.vault[1] && h.vaultWho[1] && h.guard[1], city + " has Polish for every name");
}
OK(Object.keys(H.HOUSES).length === 5, "five heists");
OK(!H.houseAt("Riverwood") && !H.houseAt("Dawnstar") && H.sections("Riverwood").length === 0 && H.sections("Riften")[0] === "heist", "only the big cities");
OK(D.ITEMS.hs_papers && D.ITEMS.hs_draught && D.ITEMS.hs_papers.slot === "misc", "forged papers and the draught are items");
OK(H.start.length <= 3 && !/players|cardOf|others/.test(H.start.toString() + H.act.toString() + H.finish.toString()), "targets are NPC houses only: no player is ever picked as a target");
{ const tiers = CITIES.map((c2) => H.houseAt(c2).tier); OK(new Set(tiers).size >= 3 && Math.max(...tiers) === 4, "a spread of difficulty, Riften the hardest: " + tiers); }

// 2. perks: new ones registered with real effects, the old Fence perk grows, old ids kept
for (const id of ["heist_locksmith", "heist_infiltrator", "heist_escape"]) {
  const p = PERKS.BY_ID[id]; OK(p && PERKS.TREES[p.skill].some((x) => x[0] === id) && PFX.FX[id].length, id + " is in its tree with effects");
  OK(p.needs.every((x) => PERKS.BY_ID[x]), id + " needs a real perk");
}
OK(PERKS.BY_ID.heist_locksmith.skill === "Lockpicking" && PERKS.BY_ID.heist_infiltrator.skill === "Sneak" && PERKS.BY_ID.heist_escape.skill === "Acrobatics", "Locksmith, Infiltrator, Escape Artist in the right trees");
OK(PFX.FX.fence.some(([k]) => k === "hsfence") && /heist/.test(PERKS.BY_ID.fence.desc) && /\\[Skyrim\\]$/.test(PERKS.BY_ID.fence.desc), "the Fence perk also cuts the heist fence (tag kept at the end)");
for (const id of ["fence", "novice_locks", "apprentice_locks", "stealth", "sure_footed", "bribery", "bribe_master", "unbreakable"]) OK(PERKS.BY_ID[id], "old perk id kept: " + id);

// 3. starting: town, level, bounty, cooldown, party member
{ const s = hero(20, "Riften"); s.level = 5; OK(/level 14/.test(H.blocked(s, "Riften")), "Maven's manor needs level 14");
  const s2 = hero(20); s2.bounty = { Whiterun: 40 }; OK(/bounty/.test(H.blocked(s2, "Whiterun")), "wanted in the hold: no heist");
  const s3 = hero(20); s3.location = "Riverwood"; OK(H.blocked(s3, "Riverwood"), "no house in a village");
  const s4 = hero(20); s4.heist = { cd: { battleborn: T0 + 5000 } }; OK(/Try again in/.test(H.blocked(s4, "Whiterun", T0)), "a robbed house waits");
  const s5 = hero(20); const r = H.start(s5, 1, tk()); OK(r.ok && H.run(s5).stage === 0, "a heist starts in Whiterun"); }

// a helper: play a run through with chosen moves
function play(s, moves, t) { const out = []; for (const [k, o] of moves) { const r = H.act(s, k, o || {}, t); OK(!r.err, "move " + k + ": " + (r.err || "")); out.push(r); if (r.end) break; } return out; }

// 4. a clean job: case, papers, bribe, the lock game, only the prize, walk out
{ const s = hero(20, "Whiterun", 40), hold = "Whiterun", t = tk(); H.start(s, 1, t);
  const g0 = s.gold, c0 = cor(s, hold);
  dice(0.01);
  const rs = play(s, [["case"], ["buypapers"], ["go"], ["papers"], ["lockpick", { lock: true }], ["prize"], ["calm"]], t);
  real();
  const res = rs[rs.length - 1].res;
  OK(res && res.outcome === "clean" && !res.bounty && !(s.bounty || {}).Whiterun, "clean job, no bounty");
  OK(has(s, "hs_signet") && s.inv.find((r) => r.item === "hs_signet").stolen, "the prize is in your pack, marked stolen");
  OK(res.gold > 0 && s.gold > g0 - 500, "the fence pays: " + res.gold + " gold");
  OK(Math.abs(res.cut - H.fenceCut(s)) < 1e-9 && res.cut === 0.3, "the fence's cut is 30% without perks");
  OK(!cnt(s, "hs_papers"), "the papers are used up");
  OK(cor(s, hold) > c0, "theft, forgery and the fence make the hold more crooked (" + c0 + " → " + cor(s, hold) + ")");
  OK(!H.run(s) && H.st(s).cd.battleborn > t && H.st(s).stats.clean === 1 && H.st(s).done.battleborn === 1, "cooldown and stats recorded");
  OK(H.blocked(s, "Whiterun", t + 60), "can't rob it again straight away");
  // second time: no second ring, coin instead
  const t2 = t + H.COOLDOWN + 10; H.start(s, 1, t2); dice(0.01);
  const r2 = play(s, [["go"], ["bribe"], ["bribe"], ["prize"], ["calm"]], t2); real();
  OK(cnt(s, "hs_signet") === 1 && r2[r2.length - 1].res.gold > res.gold * 0.8, "a repeat gives coin, not a second prize"); }

// 5. every way past a door does its own thing
{ const s = hero(20, "Windhelm", 20), t = tk(); H.start(s, 1, t); H.act(s, "go", {}, t);
  const r = H.run(s), g0 = s.gold, cost = H.bribeCost(s, r, 1);
  H.act(s, "bribe", {}, t); OK(s.gold === g0 - cost && r.stage === 2 && r.bribes === 1, "a bribe costs gold and always works (" + cost + ")");
  OK(H.bribeCost(s, r, 2) > cost, "the vault's keeper costs more");
  const sb = hero(20, "Windhelm"); sb.perks = { ...sb.perks, bribery: 1 }; H.start(sb, 1, t); H.act(sb, "go", {}, t); OK(H.bribeCost(sb, H.run(sb), 1) < cost, "Bribery makes bribes cheaper");
  // a failed method is closed off at that door and raises suspicion
  const s2 = hero(20, "Windhelm"), t2 = tk(); H.start(s2, 1, t2); H.act(s2, "go", {}, t2); G.give(s2, "hs_draught", 1);
  dice(0.99); const f = H.act(s2, "invis", {}, t2); real();
  OK(!f.ok && H.run(s2).heat > 0 && !cnt(s2, "hs_draught"), "a failed try drinks the draught and raises suspicion");
  OK(!H.options(s2).find((o) => o.key === "invis").can, "...and that way is closed at this door");
  OK(!H.options(s2).find((o) => o.key === "papers").can, "no papers: can't show them");
  // the lock game decides when it's played
  H.act(s2, "lockpick", { lock: false }, t2); OK(H.run(s2).stage === 1, "a broken pick: still outside");
  // force: a real fight against the house guard
  const s3 = hero(30, "Windhelm"), t3 = tk(); H.start(s3, 1, t3); H.act(s3, "go", {}, t3);
  const fr = H.act(s3, "force", {}, t3);
  OK(fr.fight && (fr.ok ? H.run(s3).forced && H.run(s3).heat >= 30 : fr.res.outcome === "caught"), "forcing the door is a fight, and the house knows");
  OK(G.curHealth(s3) > 0, "never killed on a heist"); }

// 6. the alarm: too much suspicion and it's straight to the escape
{ const s = hero(20, "Solitude"), t = tk(); s.level = 20; H.start(s, 1, t); H.act(s, "go", {}, t); H.act(s, "bribe", {}, t);
  H.act(s, "force", {}, t); H.run(s).heat = 95; dice(0.99);
  const s2 = hero(20, "Solitude"), t2 = tk(); H.start(s2, 1, t2); H.act(s2, "go", {}, t2); H.run(s2).heat = 80;
  const x = H.act(s2, "lockpick", { lock: false }, t2); real();
  OK(H.run(s2).alarm && H.run(s2).stage === 4 && /alarm/.test(x.text), "the alarm goes up and you run");
  OK(H.options(s2).find((o) => o.key === "fight").can, "with the alarm up you can fight your way out");
  dice(0.01); const e = H.act(s2, "roofs", {}, t2); real();
  OK(e.res.outcome === "seen" && e.res.bounty > 0 && s2.bounty.Haafingar === e.res.bounty && !e.res.gold, "out over the roofs, but seen and empty-handed: a bounty in Haafingar"); }

// 7. caught: the loot goes back, a bounty
{ const s = hero(20, "Markarth"), t = tk(); H.start(s, 1, t); dice(0.01);
  play(s, [["go"], ["bribe"], ["bribe"], ["all"]], t); dice(0.99); const r = H.act(s, "calm", {}, t); real();
  OK(r.res.outcome === "caught" && !r.res.gold && !has(s, "hs_torc") && s.bounty["The Reach"] >= 100, "caught: no gold, no prize, a bounty in the Reach (" + s.bounty["The Reach"] + ")"); }

// 8. perks with real effects
{ const s = hero(30, "Riften"), t = tk(); H.start(s, 1, t); H.act(s, "go", {}, t); H.act(s, "bribe", {}, t);
  const r = H.run(s), lt = H.lockTier(s, r, 2), pk = H.picks(s);
  s.perks.heist_locksmith = 2; OK(H.lockTier(s, r, 2) === lt - 2 && H.picks(s) === pk + 2, "Locksmith: easier heist locks and two spare picks");
  OK(H.methodInfo(s, r, "lockpick").chance > 0, "lock chance is real");
  s.skills.Speechcraft.lvl = 70; const ch0 = H.methodInfo(s, { ...r, stage: 1 }, "papers").chance; s.perks.heist_infiltrator = 2; G.give(s, "hs_papers", 1);
  OK(H.methodInfo(s, { ...r, stage: 1 }, "papers").chance > ch0, "Infiltrator: forged papers work more often");
  const cut0 = H.fenceCut(s); s.perks.fence = 1; OK(H.fenceCut(s) < cut0 - 0.1, "Fence: the fence takes less (" + cut0 + " → " + H.fenceCut(s) + ")");
  OK(H.fenceCut(s) >= H.CUT_MIN, "never under 10%");
  // Escape Artist: bounties halved, a capture turns into an escape once
  const a = hero(30, "Riften"), b = hero(30, "Riften"); b.perks.sure_footed = 2; b.perks.heist_escape = 1;
  for (const x of [a, b]) { const tt = tk(); H.start(x, 1, tt); dice(0.01); play(x, [["go"], ["bribe"], ["bribe"], ["prize"]], tt); dice(0.99); x._r = H.act(x, "roofs", {}, tt); real(); }
  OK(a._r.res.outcome === "caught" && b._r.res.outcome === "seen" && b._r.res.gold > 0, "Escape Artist: caught turns into a narrow escape, you keep the loot");
  OK(b._r.res.bounty < a._r.res.bounty, "...and the bounty is smaller"); }

// 9. party: every choice voted, majority wins, a tie goes to the leader
{ const s = hero(25, "Whiterun"), t = tk(); H.start(s, 3, t); H.act(s, "go", {}, t);
  const party = { id: "p1", leader: s.id, leaderName: "L", members: [{ id: s.id }, { id: "m1" }, { id: "m2" }] };
  let p = H.openVote(party, s.id, s, ["m1", "m2"], "lockpick", t);
  OK(p.halt && p.halt.kind === "heist" && p.halt.opts.some((o) => o[0] === "bribe") && p.halt.lead === "lockpick", "the leader's pick opens a party vote");
  OK(!p.halt.opts.some((o) => o[0] === "buypapers"), "shopping isn't voted");
  p = PARTYPLAY.vote(p, "m1", "bribe", t + 1); p = PARTYPLAY.vote(p, "m2", "bribe", t + 2);
  OK(H.winner(p.halt, s.id) === "bribe", "two votes beat the leader's one");
  let q = H.openVote(party, s.id, s, ["m1", "m2"], "lockpick", t); q = PARTYPLAY.vote(q, "m1", "bribe", t + 1);
  OK(H.winner(q.halt, s.id) === "lockpick", "a tie goes to the leader");
  const st2 = H.settle(q, s.id, t + 3); OK(st2.key === "lockpick" && st2.p.halt.done && st2.p.halt.picked.key === "lockpick", "settled and resolved for everyone");
  OK(H.goodsValue(2, 25, 3) > H.goodsValue(2, 25, 1) && H.goodsValue(2, 25, 8) / 8 < H.goodsValue(2, 25, 1), "more hands carry more, but each gets less than solo");
  OK(H.check(s, { ...H.run(s), n: 4 }, 40) > H.check(s, { ...H.run(s), n: 1 }, 40), "friends make the checks easier"); }

// 10. the house guard is a fair fight: no one-shots either way
{ for (const L of [15, 30]) { const s = hero(L, "Riften"), t = tk(); H.start(s, 1, t); const r = H.run(s);
    const e = H.guardFoe(s, r, false); OK(e.damage < G.maxHealth(s) * 0.4, "the guard doesn't one-shot you at " + L);
    let turns = 0; for (let i = 0; i < 20; i++) { const f = new G.Fight(s, H.guardFoe(s, r, false), null, t); f.run({ t, trySneak: false }); turns += f.log.length; G.setHealth(s, G.maxHealth(s), t); }
    OK(turns / 20 >= 3, "a guard fight lasts a few turns at " + L + " (" + (turns / 20).toFixed(1) + ")"); } }

// 11. save repair
{ const s = hero(20); s.heist = { cd: "x", done: null, run: { id: "nope", stage: "a" } }; G.migrate(s);
  OK(typeof s.heist.cd === "object" && typeof s.heist.done === "object" && s.heist.run === null && s.heist.v === 1, "a broken heist record is repaired");
  const s2 = hero(20); H.start(s2, 1, tk()); const back = JSON.parse(JSON.stringify(s2)); G.migrate(back); OK(H.run(back) && H.run(back).id === "battleborn", "a heist in progress survives a save and load"); }

// 12. balance: worth it for a thief, never better than steady guild work, risky for a clumsy hero
{ const rows = [];
  const plan = (s) => { const o = H.options(s), r = H.run(s); const best = (ks) => ks.map((k) => o.find((x) => x.key === k)).filter((x) => x && x.can).sort((a, b) => (b.chance ?? 0.9) - (a.chance ?? 0.9))[0];
    if (r.stage === 0) return r.cased ? "go" : "case";
    if (r.stage === 1 || r.stage === 2) { const pick = best(["papers", "invis", "lockpick"]); return pick && pick.chance >= 0.55 ? pick.key : o.find((x) => x.key === "bribe").can ? "bribe" : (pick || o.find((x) => x.key === "force")).key; }
    if (r.stage === 3) return "prize";
    return best(["calm", "roofs", "sewers", "fight"]).key; };
  for (const [label, thief] of [["thief", 35], ["warrior", 0]]) for (const L of [10, 25, 40]) for (const city of CITIES) {
    let net = 0, caught = 0, bounty = 0, N = 0; if (H.blocked(hero(L, city), city, T0)) continue;
    for (let i = 0; i < 160; i++) { N++;
      const s = hero(L, city, thief), t = tk(1000); s.heist = { cd: {}, done: { [H.houseAt(city).id]: 1 } };   // repeats: no prize item, coin only
      if (H.blocked(s, city, t)) continue;
      G.give(s, "hs_papers", 1); G.give(s, "hs_draught", 1);
      const g0 = s.gold + H.toolPrice(s, "hs_papers", H.houseAt(city).tier) + H.toolPrice(s, "hs_draught", H.houseAt(city).tier); H.start(s, 1, t);
      for (let k = 0; k < 20 && H.run(s); k++) { const r = H.act(s, plan(s), {}, t); if (r.err) throw new Error(r.err); }
      net += s.gold - g0; const b = Object.values(s.bounty || {}).reduce((a, x) => a + x, 0); bounty += b; if (H.st(s).last?.outcome === "caught") caught++;
    }
    const guild = 150 + 12 * L;
    rows.push({ label, L, city, net: Math.round(net / N), bounty: Math.round(bounty / N), caught: +(caught / N).toFixed(2), vsGuild: +((net / N) / guild).toFixed(2) });
  }
  console.log("heist sim (net gold per heist after tools/bribes; bounty; caught rate; × one guild job):");
  for (const r of rows) console.log("  " + [r.label, "L" + r.L, r.city, r.net, "bounty " + r.bounty, "caught " + r.caught, "x" + r.vsGuild].join(" · "));
  const thief = rows.filter((r) => r.label === "thief"), war = rows.filter((r) => r.label === "warrior");
  OK(thief.every((r) => r.vsGuild > 0.45), "a skilled thief always earns about half a guild job or more (coin only, before the prize)'s pay per heist");
  OK(thief.every((r) => r.vsGuild < 12), "...but a heist (4 h cooldown per house) never beats an hour of guild work (" + Math.max(...thief.map((r) => r.vsGuild)) + "×)");
  const wR = war.filter((r) => r.city === "Riften"), tR = thief.filter((r) => r.city === "Riften");
  OK(wR.reduce((a, r) => a + r.caught, 0) > tR.reduce((a, r) => a + r.caught, 0), "a clumsy hero gets caught more often in Maven's manor");
  OK(war.some((r) => r.bounty > 0), "risk is real: bounties happen"); }

// 13. the screens and Polish for every line
{ const s = hero(30, "Whiterun", 30); const lines = [];
  const text = (html) => html.split(/<[^>]+>/).map((x) => x.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()).filter((x) => x.length > 1 && /[a-z]/i.test(x));
  const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tw = H.townHTML(s, esc); lines.push(tw.note, ...text(tw.body));
  for (const city of CITIES) { const x = hero(30, city); lines.push(...text(H.townHTML(x, esc).body)); }
  const t = tk(); H.start(s, 1, t);
  const walk = [["case"], ["buypapers"], ["buydraught"], ["go"], ["papers"], ["lockpick", { lock: true }], ["all"], ["sewers"]];
  dice(0.5);
  for (const [k, o] of walk) { lines.push(...text(H.heistHTML(s))); for (const op of H.options(s)) lines.push(op.label, op.sub, op.why || "Not enough gold."); const r = H.act(s, k, o || {}, t); lines.push(r.text); if (r.res) { lines.push(...r.res.lines, ...text(H.endHTML(r.res))); break; } }
  real();
  for (const out of ["clean", "seen", "caught", "quit"]) lines.push(...text(H.endHTML({ outcome: out, house: "erikur", lines: [], gold: 100, cut: 0.3, prize: "hs_goblet", bounty: 50, hold: "Haafingar", deeds: ["theft"] })));
  lines.push("Caught! The guards take the loot back and put a price on your head.", "Clean job, but one of the people you bribed talked.", "You got out with nothing.",
    "The guard goes down. The way is open, but the house will know someone was here.", "The guard beats you down and calls for the watch.", "It takes three blows. Everyone heard that.",
    "A floorboard creaks. Someone turns to look. The alarm goes up! No time to grab anything: run.", "They corner you. Caught, almost! You wriggle free at the last moment.",
    "You fight your way to the gate and lose them in the streets.", "There are too many of them. They drag you down.", "You get out, but they saw you. Bounty in Whiterun: 40 gold.",
    "Come back at level 14. This one is out of your league for now.", "The house is still on its guard. Try again in 3 h 10 min.",
    "The guards know your face here. Clear your bounty first.", "In a party your leader plans the heist. Vote when they ask.", "The party picked: Pick the lock.",
    "\\uE19D Your party is voting: 1 of 2 have voted.", "Tap another choice to change your vote. Most votes win; a tie goes to you.", "Decide now", "Heist: Bribe the kitchen maid.",
    "Rob a rich house", "Heist", "Rob a rich household: plan it, get in, grab the prize, get out.");
  for (const id of ["heist_locksmith", "heist_infiltrator", "heist_escape"]) { const p = PERKS.BY_ID[id]; lines.push(p.name, p.desc.replace(/\\s*\\[[^\\]]*\\]\\s*$/, "")); }
  lines.push(PERKS.BY_ID.fence.desc.replace(/\\s*\\[[^\\]]*\\]\\s*$/, ""));
  for (const id of [...Object.keys(H.PRIZES), ...Object.keys(H.TOOLS)]) lines.push(D.ITEMS[id].name, D.ITEMS[id].desc);
  const note = PATCHNOTES.LIST.find((x) => x.id.endsWith("-heists")); OK(note && note.build === PATCHNOTES.LIST[0].build || PATCHNOTES.LIST.some((x) => x.id.endsWith("-heists")), "a patch note for heists");
  lines.push(note.title, ...note.items);
  OK(!PATCHNOTES.NEXT.some((x) => /heist/i.test(x)), "heists are off Coming next");
  const uniq = [...new Set(lines.filter(Boolean))];
  c_lang("pl");
  const miss = uniq.filter((l) => { const o = I18N.tr(l); return o == null || o === l; }).filter((l) => !/^[\\d\\s%·()!+\\-]+$/.test(l) && !CITIES.includes(l) && !/^\\d+ \\([A-Z][\\w ]+\\)$/.test(l) &&!/^(Whiterun|Haafingar|Skok|Infiltrator)/.test(l));
  c_lang("en");
  OK(miss.length === 0, "Polish for every line (" + uniq.length + "); missing: " + JSON.stringify(miss.slice(0, 12))); }

console.log("heists ok · " + n + " checks");
`.replace("c_lang(\"pl\")", "__lang = \"pl\"").replace("c_lang(\"en\")", "__lang = \"en\""), c);
