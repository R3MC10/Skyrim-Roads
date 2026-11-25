// "Make your hero anew" (remake.js): old saves get one remake, new heroes don't; a race switch moves only the race's
// starting skill boost (trained skills stay), the power/gifts follow the race; Keep as is counts as done; it waits for a quiet moment.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
const doc = { createElement: () => ({ width: 0, height: 0, style: {}, dataset: {}, getContext: () => ctx, toDataURL: () => "data:image/png;base64,AA" }), querySelector: () => null };
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, document: doc, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 2 };
vm.createContext(c);
const files = fs.readFileSync(W + "index.html", "utf8").match(/<script src="([a-z0-9_]+\.js)">/g).map((s) => s.match(/"(.*)"/)[1])
  .filter((f) => !["store.js", "p2pnet.js", "ui.js", "sound.js", "map.js", "backup.js", "skillinfo.js"].includes(f) && !/^i18n/.test(f));
for (const f of files) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const ok = (c, m) => { n++; if (!c) throw new Error("FAIL " + m); };
ok(typeof REMAKE === "object" && typeof CHARGEN === "object", "modules load");

// a new hero is born done: migrate never flags it
{
  const s = G.newSave("N1", "Newbie", "nord");
  ok(s.rmkV === REMAKE.V && !s.remake, "new hero has no remake");
  G.migrate(s); ok(!s.remake && !REMAKE.pending(s), "new hero still no remake after load");
}

// an old save (made before this build: no rmkV) gets the flag once on load, and only once
const old = () => { const s = G.newSave("O1", "Ulfric", "nord"); delete s.rmkV; return s; };
{
  const s = old(); G.migrate(s);
  ok(s.remake === 1 && s.rmkV === REMAKE.V && REMAKE.pending(s), "old save flagged");
  REMAKE.keep(s); G.migrate(s); ok(!s.remake, "Keep as is: done, a later load doesn't flag it again");
  const s2 = old(); G.migrate(s2); G.migrate(s2); ok(s2.remake === 1, "two loads before choosing: still one pending remake");
}
// two save slots: each one gets its own remake
{ const a = old(), b = old(); b.id = "O2"; G.migrate(a); G.migrate(b); REMAKE.keep(a); ok(!a.remake && b.remake === 1, "each hero once"); }

// the race boost table matches newSave
{
  const nb = REMAKE.bonus("nord");
  ok(nb["Two-Handed"] === 10 && nb.Blocking === 5 && nb.Speechcraft === 5 && nb.Mercantile === 5, "Nord boost " + JSON.stringify(nb));
  for (const r of Object.keys(D.RACES)) {
    const s = G.newSave("B" + r, "Bee", r), bb = REMAKE.bonus(r);
    for (const k of D.ALL_SKILLS) ok(s.skills[k].lvl === D.BASE_SKILL + (bb[k] || 0), "newSave = base + bonus " + r + " " + k);
  }
}

// Nord -> Khajiit: only the racial part moves; what was trained stays; power and gifts follow the race
{
  const s = old(); G.migrate(s);
  s.level = 17; s.perks = { ...(s.perks || {}), test_perk: 1 }; s.vampire = { stage: 2 }; s.powerAt = 1234;
  s.skills["Two-Handed"].lvl = 60; s.skills["Two-Handed"].xp = 3;   // trained 35 on top of 15 + 10
  s.skills.Sneak.lvl = 40;                                          // trained 25, no Nord boost
  s.skills.Archery.lvl = 98;                                        // near the top: the +5 stops at 100
  s.skills.Speechcraft.lvl = 20; s.skills.Mercantile.lvl = 22;      // Speech boost was 5 on each
  s.skills.Alteration.lvl = 33;                                     // untouched by both races
  const before = JSON.parse(JSON.stringify(s.skills));
  REMAKE.finish(s, { name: "Ulfric", race: "khajiit", app: APPEAR.fromSeed("x", "khajiit", true) });
  ok(s.race === "khajiit", "race switched");
  ok(s.skills["Two-Handed"].lvl === 50, "Two-Handed lost only the +10: " + s.skills["Two-Handed"].lvl);
  ok(s.skills.Blocking.lvl === before.Blocking.lvl - 5, "Blocking lost the +5");
  ok(s.skills.Speechcraft.lvl === 15 && s.skills.Mercantile.lvl === 17, "Speech boost off both");
  ok(s.skills.Sneak.lvl === 50, "Sneak got the Khajiit +10 on top of the trained 40");
  ok(s.skills.Archery.lvl === 100, "Archery capped at 100");
  ok(s.skills["One-Handed"].lvl === before["One-Handed"].lvl, "One-Handed: Nord +5 off, Khajiit +5 on");
  ok(s.skills.Alteration.lvl === 33, "other skills untouched");
  ok(s.skills.Lockpicking.lvl === before.Lockpicking.lvl + 5 && s.skills.Pickpocket.lvl === before.Pickpocket.lvl + 5, "thief boosts on");
  ok(D.ALL_SKILLS.every((k) => s.skills[k].lvl >= D.BASE_SKILL && s.skills[k].lvl <= 100), "all skills in range");
  ok(s.level === 17 && s.perks.test_perk === 1 && s.vampire.stage === 2 && s.powerAt === 1234, "level, perks, vampire, power cooldown unchanged");
  ok(s.sex === "f" && s.app.sx === "f", "sex follows the look");
  ok(!s.remake, "done");
  ok(POWERS.RACE[s.race][0] === "Night Eye", "racial power is Khajiit's");
  ok(RACEFX.ability(s.race).name === RACEFX.ability("khajiit").name, "gift is Khajiit's");
  ok(HEROART.lookOf(s).r === "khajiit" && HEROART.lookOf(s).sx === "f", "the player card look carries race and sex");
  // and back again: no double counting
  REMAKE.swapRace(s, "nord");
  ok(s.skills["Two-Handed"].lvl === 60 && s.skills.Sneak.lvl === 40 && s.skills.Speechcraft.lvl === 20 && s.skills.Mercantile.lvl === 22, "round trip restores the trained levels");
}

// a skill below its boost (shouldn't happen, but never drops under the base)
{ const s = old(); s.skills["Two-Handed"].lvl = 18; REMAKE.swapRace(s, "breton"); ok(s.skills["Two-Handed"].lvl === D.BASE_SKILL, "floor at base skill"); }

// Keep as is clears the flag and changes nothing
{
  const s = old(); G.migrate(s); const was = JSON.stringify({ r: s.race, k: s.skills, a: s.app, n: s.name });
  REMAKE.keep(s); ok(!s.remake && JSON.stringify({ r: s.race, k: s.skills, a: s.app, n: s.name }) === was, "Keep as is changes nothing");
}
// a bad name is ignored, a good one is kept
{ const s = old(); G.migrate(s); REMAKE.finish(s, { name: "x", race: "nord" }); ok(s.name === "Ulfric", "bad name ignored"); }
{ const s = old(); G.migrate(s); REMAKE.finish(s, { name: "Brynja", race: "nord" }); ok(s.name === "Brynja", "new name kept"); }

// it waits for a quiet moment: not in a dungeon, a fight, a party vote, a busy screen or on the title
{
  const s = old(); G.migrate(s);
  ok(REMAKE.quiet({ S: s, safe: () => true, voting: () => false }), "on the map: opens");
  ok(!REMAKE.quiet({ S: s, title: true }), "not on the title screen");
  ok(!REMAKE.quiet({ S: { ...s, dungeon: { room: {} } } }), "not in a dungeon");
  ok(!REMAKE.quiet({ S: { ...s, encounter: { hp: 5 } } }), "not in a fight");
  ok(!REMAKE.quiet({ S: { ...s, trip: { status: "encounter" } } }), "not in a road fight");
  ok(!REMAKE.quiet({ S: s, voting: () => true }), "not during a party vote");
  ok(!REMAKE.quiet({ S: s, safe: () => false }), "not while a party run / trade / mini-game is up (safeToUpdate)");
  REMAKE.keep(s); ok(!REMAKE.quiet({ S: s, safe: () => true }), "never again once done");
}

// the creator's remake mode: Race + look tabs, no Start tab
ok(typeof CHARGEN.remade === "function", "CHARGEN.remade");
console.log("remake ok ·", n, "checks");
`, c);
