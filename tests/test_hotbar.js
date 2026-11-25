/* The fight hotbar (hotbar.js): 10 slots on keys 1-9 and 0, kept per hero in the save.
   Checks key mapping, cleaning bad layouts, the default fill from real heroes, put/swap/clear/reset, a save round trip,
   old saves without a hotbar, and that every default slot is a move the fight knows.
   node test_hotbar.js     (W=/path/to/game/ points at another game folder) */
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, structuredClone };
vm.createContext(c);
const tbsrc = fs.readFileSync(path.join(__dirname, "test_tbfight.js"), "utf8");
const list = JSON.parse(tbsrc.match(/for \(const f of (\[[^\]]*"tbfight\.js"[^\]]*\])/)[1]);
const EXTRA = ["guilds.js", "priests.js", "horsetravel.js", "market.js", "craftfair.js", "followers2.js", "followerai.js", "combo.js", "dragons.js", "foekit.js", "fightread.js", "foeintent.js", "tbfight.js", "sharedfight.js", "fightctl.js", "hotbar.js"];
for (const f of [...new Set(list.filter((x) => x !== "tbfight.js").concat(EXTRA))]) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const helpers = tbsrc.slice(tbsrc.indexOf("const LEVELS"), tbsrc.indexOf("if (!process.env.SIMONLY)"));
vm.runInContext(helpers + `
fails = 0; let n = 0; const OK = (x, m) => { if (!x) { fails++; console.log("FAIL", m); } else n++; };
const H = HOTBAR;
// ---- keys
OK(H.N === 10 && H.KEYS.join("") === "1234567890", "10 slots on keys 1-9 and 0");
OK(H.keyToSlot("1") === 0 && H.keyToSlot("9") === 8 && H.keyToSlot("0") === 9, "keys map to slots (0 is the tenth)");
OK(H.keyToSlot("a") === -1 && H.keyToSlot("10") === -1 && H.keyToSlot("") === -1 && H.keyToSlot(undefined) === -1, "other keys are not slots");
OK(H.slotKey(0) === "1" && H.slotKey(9) === "0", "slot numbers back to keys");
// ---- cleaning what the save holds
OK(H.clean(null) === null && H.clean("x") === null && H.clean(5) === null, "no layout: nothing");
let L = H.clean(["attack", 7, "<b>", "attack", "end", "flee", "spell:flames", null, "", "potion:health", "x:y z"]);
OK(L.length === 10, "always 10 slots");
OK(L[0] === "attack" && L[1] === null && L[2] === null && L[3] === null && L[4] === null && L[5] === null && L[6] === "spell:flames" && L[9] === "potion:health", "bad entries, repeats, End turn and Flee are emptied, the rest keep their slot " + JSON.stringify(L));
OK(H.clean(["attack"]).length === 10 && H.clean(new Array(30).fill("bash")).filter(Boolean).length === 1, "short and long lists come back as 10 slots");
OK(H.clean({ slots: ["bash"] })[0] === "bash", "an object with slots is read too");
// ---- defaults from real heroes
const fight = (b, L) => { const s = fresh(b, L); const f = new G.Fight(s, enc("Bandit outlaw", L)); return { s, f, ss: new TB.Session(f, { trySneak: false }) }; };
for (const b of ["warrior", "mage", "archer", "spellsword", "twohand"]) {
  const { s, f, ss } = fight(b, 20); ss.begin();
  const d = H.defaults(s, f);
  OK(d.length === 10, b + ": 10 default slots");
  OK(d[0] === "attack" && d[1] === "power_attack", b + ": slots 1 and 2 are the attack and the power attack " + d);
  OK(d.filter(Boolean).length >= 5, b + ": nobody starts with an empty bar " + d);
  OK(new Set(d.filter(Boolean)).size === d.filter(Boolean).length, b + ": no move twice");
  OK(d.every((a) => a === null || H.known(s, f, a)), b + ": every default is a move the hero has " + d.filter((a) => a && !H.known(s, f, a)));
  OK(!H.isCustom(s) && JSON.stringify(H.layout(s, f)) === JSON.stringify(d), b + ": without a saved bar the layout is the default");
  const cat = H.catalog(s, f);
  OK(["weapons", "spells", "shouts", "items", "abilities"].every((k) => Array.isArray(cat[k])), b + ": the picker has all five categories");
  for (const k in cat) for (const x of cat[k]) OK(x.a && x.name && H.clean([x.a])[0] === x.a, b + ": picker entry " + k + " " + x.a + " is a valid slot");
}
{ const { s, f } = fight("mage", 20);
  const d = H.defaults(s, f), sp = d.filter((a) => a && a.startsWith("spell:"));
  OK(sp.length >= 2, "a mage gets spells on the bar " + d); }
{ const { s, f } = fight("warrior", 20);
  const shield = H.known(s, f, "bash");
  const d = H.defaults(s, f); OK(d[2] === (shield ? "bash" : "block"), "slot 3 is a shield bash with a shield, else guard " + d[2]);
  const { s: s2, f: f2 } = fight("twohand", 20); OK(!H.known(s2, f2, "bash") && H.defaults(s2, f2)[2] === "block", "a two-hander gets guard, not a bash"); }
// ---- editing
{ const { s, f } = fight("spellsword", 20); const d = H.defaults(s, f);
  H.put(s, 9, "potion:stamina", f); OK(H.isCustom(s) && s.hotbar[9] === "potion:stamina", "put fills a slot and the bar is now the hero's own");
  OK(s.hotbar.every((a, i) => i === 9 || a === d[i] || (d[i] === "potion:stamina" && a === d[9])), "the other slots keep the defaults");
  const a0 = s.hotbar[0], a1 = s.hotbar[1];
  H.swap(s, 0, 1, f); OK(s.hotbar[0] === a1 && s.hotbar[1] === a0, "swap trades two slots");
  H.put(s, 5, a1, f); OK(s.hotbar[5] === a1 && s.hotbar.filter((x) => x === a1).length === 1, "a move already on the bar moves (no copies)");
  H.clear(s, 5, f); OK(s.hotbar[5] === null && s.hotbar.length === 10, "clear empties one slot");
  H.put(s, 12, "attack", f); H.put(s, -1, "attack", f); H.put(s, 3, "end", f); H.put(s, 3, "<script>", f);
  OK(s.hotbar.length === 10 && s.hotbar[3] !== "end" && s.hotbar[3] !== "<script>", "slots out of range and bad moves are refused");
  // ---- save round trip (the cloud sends the save as JSON)
  const back = JSON.parse(JSON.stringify(s));
  OK(JSON.stringify(H.layout(back, f)) === JSON.stringify(s.hotbar), "the layout survives a save and load");
  H.reset(s); OK(!H.isCustom(s) && s.hotbar === undefined, "Default goes back to the auto bar"); }
// ---- old and broken saves
{ const { s, f } = fight("archer", 20); delete s.hotbar;
  OK(H.layout(s, f).filter(Boolean).length >= 5, "an old save without a hotbar gets the default");
  s.hotbar = "garbage"; OK(H.layout(s, f).filter(Boolean).length >= 5, "a broken hotbar falls back to the default");
  s.hotbar = [null, null, null, null, null, null, null, null, null, null]; OK(H.layout(s, f).every((a) => a === null), "an emptied bar stays empty (it was the player's choice)");
  s.hotbar = ["spell:no_such_spell", "attack"]; const l = H.layout(s, f);
  OK(l[0] === "spell:no_such_spell" && !H.known(s, f, l[0]) && H.known(s, f, "attack"), "a move the hero no longer has stays in its slot, marked unknown"); }
// ---- the bar plays: each default slot's move is accepted by the fight on your turn
{ const { s, f, ss } = fight("spellsword", 20); let r = ss.begin(); let g = 0;
  while (r.turn !== "me" && g++ < 50) r = ss.advance();
  const d = H.layout(s, f), ok = d.filter((a) => a && !ss.why(a));
  OK(ok.length >= 3, "at least three default slots can be used at once " + ok);
  r = ss.act(d[0]); OK(!r.err, "slot 1 plays a real move " + (r.err || "")); }
console.log(fails ? fails + " FAILED (" + n + " ok)" : "ALL OK (" + n + " checks)");
if (fails) process.exitCode = 1;
`, c);
