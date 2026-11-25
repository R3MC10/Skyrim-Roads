const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Tooltip providers (tooltip.js): every kind of thing turns into a tooltip with real numbers. W=/path/to/web/ node test_tooltip.js — prints "tooltip ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "festivals.js", "wars.js", "curses.js", "smithing.js", "social.js", "roam.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "spellcraft.js", "colorcode.js", "skillinfo.js", "tooltip.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL", m); } };
const s = G.newSave("tt", "Tippy", "nord"); s._test = true; s.level = 12; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; G.setHealth(s, G.maxHealth(s));
TIP.state = () => s;
const clean = (h) => typeof h === "string" && h.length > 10 && !/undefined|NaN|\\[object/.test(h);
const text = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ");

ok(["item", "inv", "slot", "spell", "shout", "power", "fx", "perk", "skill", "place", "quest", "follower", "player", "stat", "cur"].every((k) => TIP.providers.includes(k)), "all providers registered");

// items: stats, weight, value, enchantments, tomes
{ const h = TIP.html("item:steel_sword"); ok(clean(h) && /Hits for/.test(h) && /Weight/.test(h) && /Value/.test(h), "a sword: hits for (with skill), weight, value " + text(h));
  ok(new RegExp(D.ITEMS.steel_sword.damage + "").test(text(h)), "with its real damage");
  const ench = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].enchant), aen = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].aenchant);
  if (ench) ok(/✦/.test(TIP.html("item:" + ench)) && TIP.html("item:" + ench).includes(D.ITEMS[ench].enchant.effect), "weapon enchantment shown " + ench);
  if (aen) ok(TIP.html("item:" + aen).includes(D.ITEMS[aen].aenchant.name), "armor enchantment shown " + aen);
  const tome = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "tome");
  ok(clean(TIP.html("item:" + tome)) && TIP.html("item:" + tome).includes(D.SPELLS[D.ITEMS[tome].spell].name), "a spell tome names its spell");
  const pot = TIP.html("item:potion_health"); ok(clean(pot) && /Restores/.test(pot), "a potion says what it restores");
  ok(TIP.html("item:nope_not_real") === null, "unknown items give nothing");
  // a pack row: count, temper, compare with what's worn
  const id = G.give(s, "iron_sword"); const row = s.inv.find((r) => r.id === id); row.temper = 3;
  const h2 = TIP.html("inv:" + id); ok(clean(h2) && /\\(10 base\\)/.test(text(h2)), "a pack row counts its temper in the base (7 + 3) " + text(h2));
  G.equip(s, id); ok(/wearing this/.test(TIP.html("inv:" + id)), "worn gear says so");
  ok(/vs/.test(TIP.html("item:steel_sword")), "other swords compare with the worn one " + text(TIP.html("item:steel_sword")));
  ok(clean(TIP.html("slot:weapon")) && TIP.html("slot:weapon").includes("Iron Sword"), "the weapon slot shows the worn sword");
  { const e = ["head", "hands", "feet", "shield", "chest"].find((k) => !G.equipment(s)[k]); ok(!e || /Tap to choose/.test(TIP.html("slot:" + e)), "an empty slot says how to fill it " + e); }
}
// spells, shouts, powers, effects
{ const h = TIP.html("spell:flames"); ok(clean(h) && /Destruction/.test(h) && /magicka/i.test(h), "Flames: school and magicka " + text(h));
  const sh = Object.keys(POWERS.SHOUTS)[0]; ok(clean(TIP.html("shout:" + sh)), "a shout");
  ok(clean(TIP.html("power:race")) && TIP.html("power:race").includes(POWERS.RACE.nord[0]), "the racial power");
  s.fx = [{ name: "Fortify Health", key: "max:health", mag: 20, until: G.now() + 600 }];
  ok(clean(TIP.html("fx:Fortify Health:" + (G.now() + 600))), "an active effect");
}
// perks and skills
{ const h = TIP.html("perk:armsman"); ok(clean(h) && /Armsman/.test(h) && /One-Handed/.test(h), "a perk names its tree " + text(h));
  ok(/take it now|Needs/.test(h), "and says if you can take it");
  const k = TIP.html("skill:Destruction"); ok(clean(k) && /Destruction/.test(k) && /Progress/.test(k), "a skill " + text(k));
}
// places, quests, followers, players
{ const h = TIP.html("place:Whiterun"); ok(clean(h) && /City/.test(h) && /You.{0,6}re here/.test(h), "Whiterun: a city, and you're here " + text(h));
  const far = TIP.html("place:Riverwood"); ok(clean(far) && /paces/.test(far), "a town elsewhere gives the distance");
  const hidden = Object.keys(WORLD.places).find((p) => WORLD.places[p][2] === "dungeon" && !s.discovered.includes(p));
  ok(/haven.{0,6}t found/.test(TIP.html("place:" + hidden)), "places you have not found stay secret " + hidden);
  QUESTS.ensure(s); ok(clean(TIP.html("quest:main")) && /Dragonborn/.test(TIP.html("quest:main")), "the main quest " + text(TIP.html("quest:main")));
  ok(clean(TIP.html("follower:lydia")) && /knocked down/.test(TIP.html("follower:lydia")), "a follower, who never dies");
  ok(clean(TIP.html("player:" + s.id)), "you as a party member");
}
// HUD bars, level, gold
{ for (const k of ["health", "magicka", "stamina", "carry", "level"]) ok(clean(TIP.html("stat:" + k)), "stat " + k);
  ok(new RegExp(G.maxHealth(s) + "").test(TIP.html("stat:health")), "health shows the real most");
  s.gold = 321; ok(/321 gold/.test(TIP.html("cur:gold")), "gold shows how much");
}
// nothing breaks on rubbish
ok(TIP.html("") === null && TIP.html("zzz:1") === null && TIP.html("perk:") === null, "bad keys give nothing");
ok(Object.keys(D.ITEMS).every((k) => { const h = TIP.html("item:" + k); return h === null || clean(h); }), "every item in the game makes a clean tooltip");
ok(Object.keys(D.SPELLS).every((k) => clean(TIP.html("spell:" + k))), "every spell makes a clean tooltip");
ok(Object.keys(PERKS.BY_ID).every((k) => clean(TIP.html("perk:" + k))), "every perk makes a clean tooltip");
ok(D.ALL_SKILLS.every((k) => clean(TIP.html("skill:" + k))), "every skill makes a clean tooltip");
ok(Object.keys(WORLD.places).every((k) => clean(TIP.html("place:" + k))), "every place makes a clean tooltip");
ok(Object.keys(QUESTS.L).every((k) => clean(TIP.html("quest:" + k))), "every quest makes a clean tooltip");
// tomeinfo.js (when it's there) fills spell tomes with its full card
{ const tome = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "tome");
  globalThis.TOMEINFO = { isTome: (i) => D.ITEMS[i]?.slot === "tome", html: () => "<i>TOMECARD</i>", line: () => "card" };
  ok(/TOMECARD/.test(TIP.html("item:" + tome)) && !/TOMECARD/.test(TIP.html("item:steel_sword")), "tomes use TOMEINFO's card when it exists");
  delete globalThis.TOMEINFO; ok(!/TOMECARD/.test(TIP.html("item:" + tome)), "and fall back without it"); }
// a provider registered later is used
TIP.register("test", (id) => "<b>hello " + id + "</b>"); ok(TIP.html("test:x:y") === "<b>hello x:y</b>", "custom providers, ids may hold colons");
console.log(fails ? fails + " of " + n + " FAILED" : "tooltip ok (" + n + " checks)");
if (fails) process.exitCode = 1;
`, c);
