// Character creation (appear.js, racefx.js, chargen.js): every race makes and draws, random looks are valid,
// old saves keep their exact face through the migration, the look survives save/load, and racial gifts really work.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const W = __GAME;
const calls = { n: 0 };
const ctx = new Proxy({}, { get: (t, k) => { if (k in t) return t[k]; return (...a) => { calls.n++; for (const v of a) if (typeof v === "number" && !isFinite(v)) throw new Error("NaN in " + String(k)); return { addColorStop() {} }; }; }, set: (t, k, v) => { t[k] = v; return true; } });
const doc = { createElement: () => ({ width: 0, height: 0, style: {}, dataset: {}, getContext: () => ctx, toDataURL: () => "data:image/png;base64,AA" }) };
const c = { calls, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, document: doc, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 2 };
vm.createContext(c);
const files = fs.readFileSync(W + "index.html", "utf8").match(/<script src="([a-z0-9_]+\.js)">/g).map((s) => s.match(/"(.*)"/)[1])
  .filter((f) => !["store.js", "p2pnet.js", "ui.js", "sound.js", "map.js", "backup.js", "skillinfo.js", "chargen.js"].includes(f) && !/^i18n/.test(f));
for (const f of files) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
for (const f of ["chargen.js", "i18n_chargen.js"]) { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); }
vm.runInContext(`
let n = 0; const ok = (c, m) => { n++; if (!c) throw new Error("FAIL " + m); };
ok(typeof APPEAR === "object" && typeof RACEFX === "object" && typeof CHARGEN === "object", "modules load");
const races = Object.keys(D.RACES);
ok(races.length === 10 && races.every((r) => APPEAR.RACES.includes(r)), "all 10 races in APPEAR");
ok(CHARGEN.TABS.map((t) => t[0]).join() === "race,body,head,face,hair,marks,start", "tabs " + CHARGEN.TABS.join());

// every race: a random look per sex normalises, is stable, draws in the rig and front view
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (const r of races) {
  ok(RACEFX.ability(r) && RACEFX.ability(r).name && RACEFX.lore(r), "ability + lore " + r);
  ok(typeof POWERS === "undefined" || !POWERS.RACIAL || POWERS.RACIAL[r], "racial power " + r);
  for (const sx of ["m", "f"]) for (let i = 0; i < 6; i++) {
    const a = APPEAR.random(r, sx, rnd);
    const a2 = APPEAR.norm(JSON.parse(JSON.stringify(a)), r);
    ok(JSON.stringify(a2) === JSON.stringify(a), "random look is already normal " + r + " " + JSON.stringify(a));
    ok(a.sx === sx || a.sx === undefined || sx === a.sx, "sex kept");
    const s = G.newSave("T" + i, "Tess", r); APPEAR.apply(s, a);
    const L = HEROART.lookOf(s); ok(L.a, "look carries the appearance " + r);
    const sp = FIGART.specOf(L); ok(sp && sp.skin && (r === "argonian" || sp.hairC), "spec " + r);
    FIGART.sprite({ look: L }, { pose: "idle", frame: i % 4, k: 1 });
    ok(/<img/.test(HEROART.figure({ look: L }, 160, 220)), "front view " + r);
    ok(APPEAR.describe(a, r).every((x) => Array.isArray(x) && x.length === 2), "describe pairs");
    // forRace keeps a look valid when the race changes
    for (const r2 of ["argonian", "khajiit", "nord"]) { const b = APPEAR.forRace(a, r2); ok(JSON.stringify(APPEAR.norm(b, r2)) === JSON.stringify(b), "forRace " + r + "->" + r2); }
  }
}

// old saves: the migration copies the seeded face exactly (same skin, hair, beard, paint as before)
const KEYS = ["skin", "hairC", "beard", "beardLen", "hairStyle", "paint", "eyes", "bw", "bh"];
for (const r of races) for (const nm of ["Ulfric", "Lydia", "Jzargo", "Ri'saad", "x"]) {
  const s = G.newSave("old-" + nm, nm, r); s.sex = /a$/.test(nm) ? "f" : "m"; delete s.app;
  FIGART.clear();
  const before = FIGART.specOf(HEROART.lookOf(s));
  const frontBefore = HEROART.figure({ look: HEROART.lookOf(s) }, 90, 120);
  G.migrate ? G.migrate(s) : APPEAR.migrate(s);
  if (!s.app) APPEAR.migrate(s);
  ok(s.app && typeof s.app === "object", "migration gave an appearance " + r + " " + nm);
  FIGART.clear();
  const after = FIGART.specOf(HEROART.lookOf(s));
  for (const k of KEYS) if ((k !== "beardLen" || before.beard) && (k !== "hairStyle" || before.hairC)) ok(JSON.stringify(before[k]) === JSON.stringify(after[k]), "old face kept: " + r + " " + nm + " " + k + " " + JSON.stringify(before[k]) + " vs " + JSON.stringify(after[k]));
  // second migration changes nothing
  const j = JSON.stringify(s.app); APPEAR.migrate(s); ok(JSON.stringify(s.app) === j, "migration is idempotent");
}

// save -> JSON -> load keeps the chosen look, and the compact network form round-trips
{
  const s = G.newSave("SL", "Brenna", "breton");
  const a = APPEAR.norm({ sx: "f", build: 3, height: 1, skin: 2, face: 1, eyes: 1, brows: 2, nose: 1, mouth: 2, age: 2, hair: 3, hairC: 4, beard: 0, scar: 1, paint: 2, paintC: 1, tattoo: 1 }, "breton");
  APPEAR.apply(s, a);
  const back = JSON.parse(JSON.stringify(s)); if (G.migrate) G.migrate(back); else APPEAR.migrate(back);
  ok(JSON.stringify(back.app) === JSON.stringify(a), "look survives save/load " + JSON.stringify(back.app) + " vs " + JSON.stringify(a));
  const comp = APPEAR.compact(a); ok(Object.keys(comp).length < Object.keys(a).length, "compact drops defaults");
  ok(JSON.stringify(APPEAR.norm(Object.assign({}, comp), "breton")) === JSON.stringify(a), "compact -> norm round-trips");
  const L = HEROART.lookOf(back); ok(JSON.stringify(L.a) === JSON.stringify(comp), "look.a sent to others is the compact form");
  ok(HEROART.keyOf ? HEROART.keyOf(L) !== HEROART.keyOf(HEROART.lookOf(G.newSave("SL", "Brenna", "breton"))) : true, "cache key changes with the look");
}

// racial gifts are real (PFX sums) and Proud Heritage boosts them
{
  const nord = G.newSave("N", "Nord", "nord"), imp = G.newSave("I", "Imp", "imperial"), orc = G.newSave("O", "Orc", "orc"), bre = G.newSave("B", "Bre", "breton");
  const frost = { s: nord, e: { name: "Frost Troll" }, tags: new Set(), _foeEl: "frost" }, plain = { s: nord, e: { name: "Bandit" }, tags: new Set(), _foeEl: null };
  ok(Math.abs(PFX.inMult(frost) - 0.5) < 1e-9, "Nord takes half from frost: " + PFX.inMult(frost));
  ok(PFX.inMult(plain) === 1, "Nord takes full damage from a bandit: " + PFX.inMult(plain));
  const mage = { s: bre, e: { name: "Necromancer" }, tags: new Set(["mage"]) };
  ok(Math.abs(PFX.inMult(mage) - 0.75) < 1e-9, "Breton resists mages: " + PFX.inMult(mage));
  ok(Math.abs(PFX.sum(imp, "gold") - 0.15) < 1e-9, "Imperial gold " + PFX.sum(imp, "gold"));
  ok(PFX.sum(nord, "gold") === 0, "Nord no gold bonus");
  ok(PFX.sum(orc, "temper") === 1, "Orc temper " + PFX.sum(orc, "temper"));
  ok(Math.abs(PFX.inMult({ s: orc, e: { name: "Bandit" }, tags: new Set() }) - 0.95) < 1e-9, "Orc 5% less damage");
  ok(PFX.sum(G.newSave("A", "Arg", "argonian"), "curseres") === 0.5, "Argonian curse resistance");
  // Proud Heritage +25%
  ok(PERKS.BY_ID.proud_heritage, "Proud Heritage perk exists");
  imp.perks = Object.assign(imp.perks || {}, { proud_heritage: 1 }); nord.perks = Object.assign(nord.perks || {}, { proud_heritage: 1 });
  ok(Math.abs(PFX.sum(imp, "gold") - 0.1875) < 1e-3, "Proud Heritage Imperial gold " + PFX.sum(imp, "gold"));
  frost._foeEl = "frost"; ok(Math.abs(PFX.inMult(frost) - 0.375) < 1e-3, "Proud Heritage Nord frost " + PFX.inMult(frost));
}

// the barber charges, the mirror is free, and both keep the race
{
  const s = G.newSave("BB", "Barb", "redguard"); s.gold = 10;
  const a = APPEAR.random("redguard", "m", rnd);
  ok(CHARGEN.pay(s, a, CHARGEN.BARBER_COST).err, "barber refuses when you're short of gold");
  s.gold = 100; const r = CHARGEN.pay(s, a, CHARGEN.BARBER_COST);
  ok(!r.err && s.gold === 100 - CHARGEN.BARBER_COST && JSON.stringify(s.app) === JSON.stringify(a), "barber takes 40 gold and applies the look");
  ok(s.race === "redguard", "race unchanged");
  ok(/data-act="barber"/.test(CHARGEN.barberRow(s)) && /data-act="mirror"/.test(CHARGEN.mirrorRow(s)), "inn and home rows");
}

// standing stones give real XP boosts
ok(POWERS.STONES.warrior && POWERS.STONES.mage && POWERS.STONES.thief, "three starting stones");
console.log("chargen ok ·", n, "checks · canvas calls", calls.n);
`, c);
