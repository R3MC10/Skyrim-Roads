const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// weather that matters: spell elements, archery aim, stamina in the cold, warm clothes, the cold meter, sneaking, Smart AI, forecast
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "solworld.js", "formulas.js", "perks.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "weatherfx.js", "enchanting.js", "quests.js", "horses.js", "horseback.js", "cooking.js", "smithing.js", "ammo.js", "tomes.js", "magic.js", "combatai.js", "roam.js", "solstheim.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const OK = (x, m) => { if (!x) throw new Error("FAIL " + m); n++; };
const realW = WEVENTS.weather;
const force = (id) => { WEVENTS.weather = (pos, t) => ({ ...realW(pos, t), id, name: WEVENTS.W[id][0], icon: WEVENTS.W[id][1], speed: WEVENTS.W[id][2], sneak: WEVENTS.W[id][3], encounters: WEVENTS.W[id][4] }); };
const mk = (where = "Whiterun") => { const s = G.newSave("w" + Math.random(), "Wx", "nord"); s.location = null; [s.x, s.y] = WORLD.places[where]; s.level = 15; for (const sl of ["chest", "head", "hands", "feet"]) G.unequip(s, sl); return s; };   // no warm hides unless a test adds them
const foe = (name = "Bandit") => ({ name, hp: 400, health: 400, damage: 5, armor: 0, level: 10, tags: [] });

// effect tables
force("rain"); let s = mk(), f = new G.Fight(s, foe());
OK(f.wx && f.wx.el.fire === 0.85 && f.wx.el.shock === 1.15, "rain: fire weaker, shock stronger");
OK(WFX.elem(f, "fire") < 1 && WFX.elem(f, "shock") > 1 && WFX.elem(f, "frost") === 1, "elem() reads the fight's weather");
force("clear"); f = new G.Fight(mk(), foe()); OK(WFX.elem(f, "fire") === 1 && f.wx.aim === 1 && !f.wx.lines.length, "clear: nothing changes");
force("fog"); f = new G.Fight(mk(), foe()); OK(f.wx.aim < 0.9, "fog spoils aim");
force("storm"); f = new G.Fight(mk(), foe()); OK(f.wx.storm && f.wx.el.shock === 1.25, "storm: shock strongest, lightning can strike");

// spell damage really changes: average firebolt in rain vs clear
const avg = (wid, spell) => { force(wid); let tot = 0, k = 0; for (let i = 0; i < 400; i++) { const s = mk(); s.spells = [...new Set([...(s.spells || []), spell])]; const f = new G.Fight(s, foe()); f.mp = 999; const r = f.cast ? f.cast(spell) : f.act("spell:" + spell); const h = f.ehp0 - f.ehp; if (h > 0) { tot += h; k++; } } return k ? tot / k : 0; };
const fireClear = avg("clear", "firebolt"), fireRain = avg("rain", "firebolt");
OK(fireClear > 0 && fireRain < fireClear * 0.93, "firebolt hits softer in the rain " + fireClear.toFixed(1) + " → " + fireRain.toFixed(1));
const shockClear = avg("clear", "lightning_bolt"), shockStorm = avg("storm", "lightning_bolt");
OK(shockClear > 0 && shockStorm > shockClear * 1.2, "lightning bolt stronger in a storm " + shockClear.toFixed(1) + " → " + shockStorm.toFixed(1));

// blizzard stamina: cold without warm clothes, fine with hide or a fur cloak
force("blizzard"); s = mk("Winterhold"); s.survival = false;
f = new G.Fight(s, foe()); OK(f.sp < G.maxStamina(s) && f.wx.lines.some((l) => /warm clothes/i.test(l)), "blizzard without warm clothes: less stamina, and a hint");
G.give(s, "fur_cloak"); OK(WFX.warmth(s) >= 0.5, "a fur cloak counts as warm clothing");
f = new G.Fight(s, foe()); OK(f.sp === G.maxStamina(s), "blizzard with a fur cloak: full stamina");
OK(D.SHOP_STOCK.general.includes("fur_cloak") && G.itemStats("fur_cloak"), "general stores sell fur cloaks, and they describe themselves");
s = mk("Winterhold"); s.survival = false; const hid = G.give(s, "hide_armor"); G.equip(s, hid); G.equip(s, G.give(s, "hide_helmet"));
OK(WFX.warmth(s) >= 0.5, "hide armour and helmet are warm: " + WFX.warmth(s));

// the cold meter: rises in a blizzard in Winterhold, falls at the inn, off when Survival is off; never touches health
force("blizzard"); s = mk("Winterhold"); s.location = null; s.trip = { status: "travel" };
const t0 = G.now(); s.coldT = t0; s.coldV = 0;
const hp0 = G.curHealth(s, t0);
WFX.cold(s, t0 + 30 * 60); OK(s.coldV >= 70, "half an hour in a Winterhold blizzard: freezing " + s.coldV);
OK(WFX.coldState(s, t0 + 30 * 60).tier === 2, "tier 2 = freezing");
OK(G.curHealth(s, t0 + 30 * 60) >= hp0, "cold never hurts health");
f = new G.Fight(s, foe(), null, t0 + 30 * 60); OK(f.wx.lines.some((l) => /freezing/i.test(l)), "the fight says you're freezing");
WFX.warmUp(s, 100, t0 + 30 * 60); OK(s.coldV === 0, "a warm bed resets the cold");
const s2 = mk("Winterhold"); s2.survival = false; s2.coldT = t0; WFX.cold(s2, t0 + 3600); OK(s2.coldV === 0, "Survival off: no cold");
force("clear"); const s3 = mk("Whiterun"); s3.coldV = 50; s3.coldT = t0; s3.location = null; s3.trip = { status: "travel" };
const tDay = (() => { for (let k = 0; k < 48; k++) { const tt = t0 + k * 600; if (!G.isNight(tt)) return tt; } return t0; })();
s3.coldT = tDay; WFX.cold(s3, tDay + 10 * 60); OK(s3.coldV < 50, "fair weather in Whiterun: you warm up again " + s3.coldV);
force("blizzard"); const s4 = mk("Winterhold"); s4.location = "Winterhold"; s4.trip = null; s4.coldV = 80; s4.coldT = t0; WFX.cold(s4, t0 + 5 * 60); OK(s4.coldV < 10, "in town you warm up fast " + s4.coldV);
force("blizzard"); const s5 = mk("Winterhold"); s5.location = null; s5.trip = { status: "travel" }; s5.coldT = t0; G.give(s5, "fur_cloak"); G.equip(s5, G.give(s5, "hide_armor")); WFX.cold(s5, t0 + 30 * 60);
OK(s5.coldV < 70, "warm clothes keep you out of freezing: " + s5.coldV);

// archery: fog lowers your hit chance (seeded average)
const hits = (wid) => { force(wid); let h = 0; for (let i = 0; i < 600; i++) { const s = mk(); const b = G.give(s, "hunting_bow") || G.give(s, "long_bow"); if (b) G.equip(s, b); G.give(s, "arrow_iron", 50); const f = new G.Fight(s, foe()); const r = f.attack(false); if (!/miss/i.test(r)) h++; } return h; };
if (D.ITEMS.hunting_bow || D.ITEMS.long_bow) { const hc = hits("clear"), hf = hits("fog"); OK(hf < hc * 0.95, "fog: fewer arrows hit " + hc + " → " + hf); }

// sneaking: clear nights help
force("clear"); const sn = mk(); let tn = t0; for (let k = 0; k < 48 && !G.isNight(tn); k++) tn += 600;
OK(WFX.sneakAdd(sn, tn) > 0 && G.hiddenChance(sn, foe(), tn) > 0, "clear night: easier to hide");

// travel: blizzards slow you, warm clothes help a bit
force("blizzard"); const sa = mk("Winterhold"), sb = mk("Winterhold"); sa.survival = sb.survival = false; G.give(sb, "fur_cloak");
OK(G.speed(sb) > G.speed(sa), "warm clothes: you push through the blizzard faster");

// Smart AI picks shock over fire in a storm (equal spells otherwise)
force("storm"); const sm = mk(); sm.spells = [...new Set([...(sm.spells || []), "firebolt", "lightning_bolt"])];
const fs2 = new G.Fight(sm, foe()); fs2.mp = 999; fs2.ai = true;
if (typeof COMBATAI !== "undefined" && COMBATAI.choose) { const pick = COMBATAI.choose(fs2); OK(!pick || !/firebolt/.test(JSON.stringify(pick)), "Smart AI avoids fire in a storm: " + JSON.stringify(pick)); }

// dungeons are indoors
force("blizzard"); const sd = mk(); sd.dungeon = { place: "Bleak Falls Barrow" }; f = new G.Fight(sd, foe()); OK(f.wx.name === "Indoors" && WFX.elem(f, "fire") === 1, "dungeon fights ignore the weather");

// forecast line
WEVENTS.weather = realW; const fc = WFX.forecast(WORLD.places.Whiterun); OK(typeof fc === "string" && fc.length > 4, "forecast: " + fc);
OK(WFX.noteHTML(mk()) !== undefined, "note renders");
console.log("weatherfx ok · " + n + " checks");
`, c);
