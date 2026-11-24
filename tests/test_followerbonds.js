// followers become people (followerbonds.js): opinions and loyalty, talk, personal quests with real rewards, low-loyalty
// trouble (refusing orders, walking out), the new perks, and the party rule. W=/path/to/game/ node test_followerbonds.js
const fs = require("fs"), vm = require("vm");
const W = process.env.W || require("path").join(__dirname, "../game/");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
c.__lang = "en"; c.localStorage = { getItem: () => JSON.stringify({ lang: c.__lang }), setItem() {} };   // the Polish part flips this
{ // every double-quoted string in followerbonds.js that reads like words (ids, css, html bits and templates left out)
  const code = /^(?:[a-z0-9_:\-#. ]*|.*\$\{.*|.*[=<>].*|[\][(){}].*|bond_\w+|\w+:[\w-]+|One-Handed|Two-Handed|Archery|Sneak|Destruction|Restoration|aria-live|&quot;| up| down)$/, out = new Set();
  for (const line of fs.readFileSync(W + "followerbonds.js", "utf8").split("\n")) {
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
    for (const m of line.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) { const v = m[1].replace(/\\"/g, '"'); if (/[A-Za-z]{2}/.test(v) && !code.test(v)) out.add(v); }
  }
  c.__cands = [...out]; }
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "horseback.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "craftfair.js", "social.js", "ammo.js", "tomes.js", "magic.js", "combatai.js", "mp.js", "coop.js", "party.js", "followers2.js", "followerai.js", "combo.js", "partyplay.js", "followerbonds.js", "i18n_story.js", "i18n_bonds.js", "i18n.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const mk = (id, name, lvl = 20) => { const s = G.newSave(id, name, "nord"); s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; s.level = lvl; s.gold = 9999; s.thaneWhiterun = true; s.perks = s.perks || {}; return s; };
const T = G.now();

// 1. a new follower starts Content at 50, with likes, dislikes and a personal quest
const A = mk("A", "Alfa");
TOWNS.hire(A, "lydia");
OK(BONDS.loyalty(A) === 50 && BONDS.mood(50)[1] === "Content", "Lydia starts Content at 50");
for (const id of Object.keys(TOWNS.FOLLOWERS)) {
  const p = BONDS.pers(id), q = BONDS.questOf(id);
  OK(Object.keys(p.likes).length && Object.keys(p.hates).length, id + " has likes and dislikes");
  OK(Object.keys(p.likes).concat(Object.keys(p.hates)).every((t) => BONDS.TAGS[t]), id + " only uses known deeds");
  OK(q && WORLD.places[q[2]] && DUNGEONS.enterable(q[4]), id + " has a quest with real places: " + (q && q[2] + " / " + q[4]));
  OK(q && D.ITEMS[q[9]] && D.ITEMS[q[9]].slot, id + " has a real keepsake: " + (q && q[9]));
  OK(q && ["strike", "volley", "bleed", "heal", "guard"].includes(q[8].type) && q[7].length >= 2, id + " has a signature move and 2+ choices");
}
for (const k of Object.keys(BONDS.DEEDS)) OK(BONDS.DEEDS[k].every((t) => BONDS.TAGS[t]), "deed " + k + " uses known tags");

// 2. road choices move loyalty through the real event path (G.eventChoice)
const ev = (s, id, choice) => { G.startTrip(s, "Riverwood", WORLD.places.Riverwood.slice(0, 2)); s.trip.status = "event"; s.trip.event = { id, purse: 20 }; return G.eventChoice(s, choice); };
let r = ev(A, "sleeper", "leave");
OK(BONDS.loyalty(A) > 50, "Lydia likes letting a sleeper be: " + BONDS.loyalty(A));
OK(/Lydia/.test(r.text), "her reaction shows in the event result: " + r.text);
const l1 = BONDS.loyalty(A); A.trip = null;
ev(A, "sleeper", "steal"); A.trip = null; A.dungeon = null;
OK(BONDS.loyalty(A) < l1, "Lydia hates pickpocketing: " + l1 + " -> " + BONDS.loyalty(A));
OK(FOL2.st(A).bond.log.length >= 2 && FOL2.st(A).bond.log.some((x) => x.d < 0), "reactions go in her log with the change");

// 3. big deeds are spotted from the save: crimes, murder, guild work
A.location = "Whiterun"; [A.x, A.y] = WORLD.places.Whiterun;
BONDS.observe(A); const l2 = BONDS.loyalty(A);
TOWNS.addBounty(A, "Whiterun", "assault"); BONDS.observe(A);
OK(BONDS.loyalty(A) < l2, "Lydia dislikes a bounty: " + l2 + " -> " + BONDS.loyalty(A));
const B = mk("B", "Bravo"); B.location = "Whiterun"; TOWNS.hire(B, "jenassa"); BONDS.observe(B);
B.murdered = true; BONDS.observe(B);
OK(BONDS.loyalty(B) > 50, "Jenassa likes a murder: " + BONDS.loyalty(B));
B.quests = { ...(B.quests || {}), brotherhood: { stage: 2 } }; const lb = BONDS.loyalty(B); BONDS.observe(B);
OK(BONDS.loyalty(B) > lb, "Jenassa likes Dark Brotherhood work");

// 4. perks are real: Kindred Spirit makes likes count more
{ const s1 = mk("k1", "K1"), s2 = mk("k2", "K2"); TOWNS.hire(s1, "lydia"); TOWNS.hire(s2, "lydia"); s2.perks.kindred_spirit = 1;
  BONDS.react(s1, ["kind"]); BONDS.react(s2, ["kind"]);
  OK(BONDS.loyalty(s2) > BONDS.loyalty(s1), "Kindred Spirit: faster loyalty " + BONDS.loyalty(s1) + " vs " + BONDS.loyalty(s2)); }
OK(PERKS.BY_ID.kindred_spirit && PERKS.BY_ID.heart_to_heart && PERKS.BY_ID.sworn_companion, "three new perks in the trees");
OK(PERKS.BY_ID.lydia === undefined && PERKS.BY_ID.leadership && PERKS.BY_ID.thanes_guard, "old perk ids kept");

// 5. talk and gifts help, with cooldowns
{ const s = mk("t", "Talker"); s.location = "Riften"; TOWNS.hire(s, "marcurio"); OK(s.follower, "hired Marcurio"); const v0 = BONDS.loyalty(s);
  BONDS.talk(s, T); OK(BONDS.loyalty(s) > v0, "talking helps");
  OK(/nothing new/.test(BONDS.talk(s, T + 10)), "talk has a cooldown");
  const g0 = s.gold, v1 = BONDS.loyalty(s); BONDS.gift(s, T); OK(s.gold === g0 - BONDS.GIFT_COST && BONDS.loyalty(s) > v1, "a gift costs gold and helps (Marcurio likes gold)");
  OK(/already/.test(BONDS.gift(s, T + 100)), "one gift a day"); }

// 6. mood changes how hard they fight
const foe = G.scaleEnemy({ ...D.ENCOUNTERS.find((e) => e.name === "Bandit outlaw") }, 18);
{ const s = mk("m", "Mood"); TOWNS.hire(s, "lydia"); const f = FOL2.st(s);
  f.loyal = 50; const d50 = FOL2.ally(s, 100).dmg; f.loyal = 95; const d95 = FOL2.ally(s, 100).dmg; f.loyal = 10; const d10 = FOL2.ally(s, 100).dmg;
  OK(d95 > d50 * 1.09 && d10 < d50 * 0.86, "devoted hit harder, resentful softer: " + [d10, d50, d95].map(Math.round)); }

// 7. low loyalty: complaining, refusing orders, then leaving
{ const s = mk("low", "Low"); TOWNS.hire(s, "lydia"); const f = FOL2.st(s);
  f.loyal = 10; const arch0 = f.arch;
  const no = FOL2.act(s, { op: "arch", id: "archer" });
  OK(/won't/.test(no) && f.arch === arch0, "a resentful follower refuses to change style: " + no);
  OK(/Bond|^$/.test("") && FOL2.act(s, { op: "view", id: "card" }) === "", "but you can still look at their screen");
  s.perks.heart_to_heart = 1; FOL2.act(s, { op: "arch", id: "archer" });
  OK(f.arch === "archer", "Heart to Heart: they obey anyway");
  delete s.perks.heart_to_heart;
  const msg = BONDS.react(s, ["theft", "crime", "cruel", "killer"]);
  OK(!s.follower && /walks off/.test(msg), "at 0 they walk out: " + msg);
  OK(s.folData.lydia && s.folData.lydia.lvl, "their gear and levels are kept (never dead)");
  OK(/won't even look/.test(TOWNS.hire(s, "lydia")) && !s.follower, "they won't come back right away");
  s.folData.lydia.bond.leftAt = G.now() - BONDS.REJOIN_AFTER - 1;
  TOWNS.hire(s, "lydia"); OK(s.follower && s.follower.id === "lydia" && BONDS.loyalty(s) >= 30, "after a few days they'll come back, at 30"); }

// 8. the personal quest: locked -> open -> go -> clear -> choose -> signature move + keepsake
{ const s = mk("q", "Quester"); TOWNS.hire(s, "lydia"); const f = FOL2.st(s);
  OK(BONDS.questState(s).k === "locked" && /Loyalty 80/.test(BONDS.questStart(s)), "locked below 80");
  s.perks.sworn_companion = 1; f.loyal = 70;
  OK(BONDS.questState(s).k === "open", "Sworn Companion opens it at 65");
  delete s.perks.sworn_companion; f.loyal = 85; s.location = "Riverwood";
  OK(/Whiterun/.test(BONDS.questStart(s)), "quest starts with a place to go");
  BONDS.questTick(s); OK(BONDS.questState(s).k === "go", "not there yet");
  s.location = "Whiterun"; BONDS.observe(s); OK(BONDS.questState(s).k === "clear", "arrived: now clear the dungeon");
  s.cleared = { "Dustman's Cairn": G.now() + 1 }; BONDS.observe(s); OK(BONDS.questState(s).k === "choose", "cleared: a last choice");
  // party rule: a member can't make the choice
  const role0 = PARTYPLAY.role; PARTYPLAY.role = () => "member";
  OK(/leader/.test(BONDS.questChoose(s, 1)) && BONDS.questState(s).k === "choose", "in a party only the leader chooses");
  PARTYPLAY.role = role0;
  const l0 = f.loyal, out = BONDS.questChoose(s, 1);
  OK(BONDS.questState(s).k === "done" && f.bond.sig && f.loyal > l0, "done: signature move learned, loyalty up: " + out);
  OK(s.inv.some((x) => x.item === "bond_lydia"), "keepsake given");
  OK(BONDS.sigOf(s).name === "Sworn Shield", "her move is Sworn Shield");
  // the move in a real fight: once, only when you need it, never more than a quarter of the foe
  const fx = new G.Fight(s, { ...foe }); const al = fx.allies.find((x) => x.follower);
  fx.hp = G.maxHealth(s); OK(BONDS.signature(fx, al) === "", "a guarding move waits until you're hurt");
  fx.hp = 10; const e0 = fx.ehp, t1 = BONDS.signature(fx, al);
  OK(/Sworn Shield/.test(t1) && fx.hp > 10 && fx.ehp < e0, "Sworn Shield heals you and hits back: " + t1);
  OK(e0 - fx.ehp <= (fx.e.health || e0) * 0.25 + 1e-6, "no one-shots: at most a quarter of the foe");
  OK(BONDS.signature(fx, al) === "", "once per fight");
  // through the normal turn hook
  const fy = new G.Fight(s, { ...foe }); const ay = fy.allies.find((x) => x.follower); fy.hp = 10;
  const ty = FOL2.turn(fy, ay); OK(/Sworn Shield/.test(ty || ""), "the move fires from their turn: " + ty); }
{ const s = mk("j", "J"); TOWNS.hire(s, "jenassa"); FOL2.st(s).bond.sig = true; FOL2.st(s).bond.q = { done: true };
  const fx = new G.Fight(s, { ...foe }); const al = fx.allies.find((x) => x.follower); const b0 = (fx.bleed || []).length;
  OK(/Poisoned Arrow/.test(BONDS.signature(fx, al)) && fx.bleed.length === b0 + 1, "Jenassa's arrow makes the foe bleed"); }

// 9. they talk: places, the road, after fights
{ const s = mk("p", "P"); s.location = "Riverwood"; TOWNS.hire(s, "faendal"); OK(s.follower, "hired Faendal");
  OK(BONDS.placeLine(s, "Riverwood").length > 0 && BONDS.placeLine(s, "Bleak Falls Barrow").length > 0, "they comment on places");
  const m = FOL2.gain(s, { won: true, e: { level: 10, name: "Dragon", tags: ["dragon"] }, tags: new Set(["dragon"]) });
  OK(m.some((x) => /Faendal/.test(x)), "they comment after a dragon fight: " + m.join(" | "));
  G.startTrip(s, "Whiterun", WORLD.places.Whiterun.slice(0, 2)); s.trip.status = "travel";
  const fb = FOL2.st(s).bond; fb.roadAt = 1; const rnd = Math.random; Math.random = () => 0.9;
  const said = BONDS.roadTick(s, G.now()); Math.random = rnd;
  OK(/Faendal/.test(said) && s.trip.log.some((x) => /Faendal/.test(x)), "road banter lands in the trip log: " + said);
  s.trip = null; s.location = "Riverwood"; FOL2.st(s).loyal = 10; fb.townAt = 1; Math.random = () => 0.9; const grumble = BONDS.townTick(s, G.now()); Math.random = rnd;
  OK(/pay|Remind|bleed|employers/.test(grumble), "a resentful follower grumbles: " + grumble); }

// 10. the Bond tab renders
{ const s = mk("u", "UI"); TOWNS.hire(s, "lydia"); const h = BONDS.tab(s, (x) => String(x));
  OK(/Loyalty/.test(h) && /Likes/.test(h) && /Personal quest/.test(h) && /data-b="talk"/.test(h), "Bond tab has meter, opinions, quest, talk");
  FOL2.act(s, { op: "view", id: "bond" }); OK(/class="bond"/.test(FOL2.panel(s, (x) => String(x))), "follower screen shows the Bond tab"); FOL2.reset(); }

// 11. Polish: every line players can see has a translation, and the screens and messages come out in Polish
{ const places = new Set(Object.keys(WORLD.places)), missing = __cands.filter((v) => !places.has(v) && !TOWNS.FOLLOWERS[v] && !BONDS.TAGS[v] && I18N.tr(v) == null);
  OK(!missing.length, "every followerbonds line has Polish (" + missing.length + " missing: " + missing.slice(0, 6).join(" | ") + ")");
  __lang = "pl";
  OK(I18N.lang() === "pl" && BONDS.T("Talk") === "Porozmawiaj" && BONDS.F("A gift costs {0} gold.", 100) === "Prezent kosztuje 100 złota.", "T and F translate when the game is in Polish");
  const s = mk("pl", "Polak"); TOWNS.hire(s, "lydia"); BONDS.observe(s);
  const h = BONDS.tab(s, (x) => String(x));
  OK(/Lojalność/.test(h) && /Lubi:/.test(h) && /Osobiste zadanie/.test(h) && /Porozmawiaj/.test(h) && /Zadowolony/.test(h) && /Pomaganie ludziom|Wielkie walki/.test(h), "Bond tab is in Polish");
  OK(!/>(?:Likes:|Dislikes:|Personal quest|Lately|Talk|Listen)</.test(h) && !/Loyalty </.test(h), "no English labels left on the Bond tab");
  OK(/Lojalność/.test(BONDS.meter(s)), "the meter is in Polish");
  const said = BONDS.say(s, "Keep your eyes on the treeline. Bandits love this stretch.", { bubble: false });
  OK(said === 'Lydia: "Miej oko na linię drzew. Bandyci uwielbiają ten odcinek."', "lines are said in Polish: " + said);
  OK(s.bondLog === undefined && FOL2.st(s).bond.log[0].l.startsWith("Keep your eyes"), "the log keeps English underneath, so switching language back works");
  OK(/Miej oko/.test(BONDS.tab(s, (x) => String(x))), "the Lately log shows the line in Polish");
  FOL2.st(s).loyal = 90; const q = BONDS.questStart(s);
  OK(/Przysięga huskarla/.test(q) && /idź do: Whiterun/.test(q), "quest start message is in Polish: " + q);
  FOL2.st(s).bond.q.stage = 2; const done = BONDS.questChoose(s, 1);
  OK(/Lydia podnosi/.test(done) && /Zaprzysiężona tarcza/.test(done) && /Tarcza przysięgi Lydii/.test(done), "quest ending, move and keepsake are in Polish: " + done.slice(0, 120));
  const m = { dog: BONDS.T("wags his tail") }; OK(m.dog === "merda ogonem", "dog lines work without the stars");
  __lang = "en";
  OK(/Loyalty/.test(BONDS.meter(s)) && BONDS.T("Talk") === "Talk", "back in English everything is English again"); }

console.log("followerbonds ok · " + n + " checks");
`, c);
