const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* Reward tooltips (rewardtips.js + tooltip.js): every reward icon's card has the item's real numbers, its enchantment,
   potion effects, the comparison with what you wear and "Already have N"; gold and stacks get their own card; names from
   result lines (enchanted finds too) turn back into item ids; G.give is watched for text-only results.
   W=/path/to/web/ node test_rewardtips.js — prints "rewardtips ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { process: { env: process.env }, console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "enchants2.js", "quests.js", "cooking.js", "curses.js", "smithing.js", "ammo.js", "tomes.js", "magic.js", "spellcraft.js", "colorcode.js", "skillinfo.js", "potionfx.js", "itemcmp.js", "tooltip.js", "rewardtips.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log("FAIL", m); } };
const s = G.newSave("rt", "Loot", "nord"); s._test = true; s.level = 12; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; G.setHealth(s, G.maxHealth(s));
TIP.state = () => s;
const clean = (h) => typeof h === "string" && h.length > 10 && !/undefined|NaN|\\[object/.test(h);
const text = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();

ok(TIP.providers.includes("rw") && TIP.providers.includes("rwgold"), "reward providers registered");

// the player's screenshot: "You find 26 gold, Potion of Minor Healing, Steel Mace of Numbing."
const base = D.ITEMS.steel_mace ? "steel_mace" : Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "weapon" && /mace/i.test(k) && !k.startsWith("ench|"));
const mace = "ench|" + base + "|numbing|20|1500";
ok(D.ITEMS[mace] && /of Numbing$/.test(D.ITEMS[mace].name), "a numbing mace exists " + (D.ITEMS[mace] || {}).name);
G.give(s, mace); G.give(s, "potion_health_minor");
ok(RTIP.idOf(D.ITEMS[mace].name, s) === mace, "the enchanted find's name turns back into its id");
ok(RTIP.idOf("Potion of Minor Healing", s) === "potion_health_minor", "a potion's name");
ok(RTIP.idOf("Iron Arrow ×12", s) === RTIP.idOf("Iron Arrow", s) && RTIP.qtyOf("Iron Arrow ×12") === 12, "a stack line: name and count");
ok(RTIP.idOf("Nothing That Exists", s) === null, "unknown names give nothing");
ok(TIP.keyForText(D.ITEMS[mace].name) === "item:" + mace, "tooltip.js finds enchanted finds made after its name list was built");

{ const h = TIP.html("rw:" + mace), t = text(h);
  ok(clean(h), "mace card is clean " + t);
  ok(/Hits for \\d+ \\(/.test(t) && t.includes("(" + D.ITEMS[mace].damage + " base)"), "damage shown: with-skill number and its base " + t);
  ok(/Weight/.test(t) && /Value/.test(t), "weight and value shown");
  ok(/One-handed|Two-handed/.test(t), "type and hands shown");
  ok(/Numbing Cold/.test(t) && /frost damage/.test(t), "the enchantment and what it does " + t);
  ok(/tt-h q-[a-z]+/.test(h), "rarity colour class " + h.slice(0, 60));
  ok(/Already have 1/.test(t), "already have 1 " + t);
  ok(/Against what you wear|Nothing worn there yet/.test(t) && /ic-cmp/.test(h), "itemcmp's compare block " + t);
}
// equip a weaker weapon: the mace compares green, a weaker one red
{ const id = G.give(s, "iron_dagger" in D.ITEMS ? "iron_dagger" : "iron_sword"); G.equip(s, id);
  const worn = D.ITEMS[s.inv.find((r) => r.id === id).item];
  if (worn.skill === D.ITEMS[mace].skill) ok(/tt-up/.test(TIP.html("rw:" + mace)), "a better weapon shows green");
  const sw = Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].slot === "weapon" && D.ITEMS[k].skill === worn.skill && !k.startsWith("ench|"));
  const weaker = sw.find((k) => D.ITEMS[k].damage < worn.damage), better = sw.find((k) => D.ITEMS[k].damage > worn.damage);
  const dmg = (k) => (String(TIP.html("rw:" + k)).match(/<div class="ic-r ([^"]*)"><span>Hits for/) || [])[1];
  ok(/Against what you wear/.test(text(TIP.html("rw:" + mace))) && text(TIP.html("rw:" + mace)).includes(worn.name), "compares against the worn weapon by name");
  if (weaker) ok(/ic-dn/.test(dmg(weaker) || ""), "a weaker weapon's damage shows red " + dmg(weaker));
  if (better) ok(/ic-up/.test(dmg(better) || ""), "a better weapon's damage shows green " + dmg(better));
}
// potions: effect and how long it works
{ const t = text(TIP.html("rw:potion_health_minor"));
  ok(/Restores 25 health/.test(t), "potion effect " + t);
  ok(/round|seconds/.test(t), "potion duration (over a few rounds) " + t);
  const np = s.inv.filter((r) => r.item === "potion_health_minor").reduce((a, r) => a + r.qty, 0); ok(new RegExp("Already have " + np).test(t), "potion already have " + np);
}
// stacks and gold
{ G.give(s, "potion_health_minor", 2);
  const t = text(TIP.html("rw:potion_health_minor*3"));
  ok(/Stack of 3 · weight 1.5 · value 51/.test(t) && /Already have [0-9]+/.test(t), "stack card " + t);
  s.gold = 126; const g = text(TIP.html("rwgold:26"));
  ok(/^26 gold/.test(g) && /You now have 126 gold/.test(g), "gold card " + g);
}
// markup and strips
{ ok(/data-tip-k="rw:potion_health_minor\\*3" data-rtip="1"/.test(RTIP.attr("potion_health_minor", 3)), "attr markup");
  ok(RTIP.attr("not_an_item") === "", "no markup for unknown items");
  ok(/rwgold:26/.test(RTIP.goldAttr(26)), "gold markup");
  const st = RTIP.strip(26, ["Potion of Minor Healing", D.ITEMS[mace].name], { s });
  ok(/rwgold:26/.test(st) && st.includes("rw:potion_health_minor") && st.includes("rw:" + mace), "strip carries every reward " + st.slice(0, 200));
}
// G.give is watched: a text-only result can show what you were just given
{ RTIP.forget(); G.give(s, "potion_health_minor", 2); G.give(s, mace);
  const got = RTIP.take(); ok(got.length === 2 && got.find(([i, q]) => i === "potion_health_minor" && q === 2), "take() lists what was given " + JSON.stringify(got));
  ok(RTIP.take().length === 0, "and forgets it");
}
// the inventory's own rows stay as they were (no "Already have" on your own pack row)
{ const r = s.inv.find((x) => x.item === mace); ok(!/Already have/.test(TIP.html("inv:" + r.id)), "pack rows unchanged"); }
// [itemcards2] a loot card for a two-hander while you hold a sword and shield says the shield comes off and the skill changes
{ const sw = G.give(s, "iron_sword"), shd = G.give(s, "hide_shield"); G.equip(s, sw); G.equip(s, shd);
  const gs = Object.keys(D.ITEMS).find((k) => D.ITEMS[k].slot === "weapon" && D.ITEMS[k].hands === 2 && D.ITEMS[k].skill === "Two-Handed" && !k.startsWith("ench|"));
  const t = text(TIP.html("rw:" + gs));
  ok(/Takes both hands: your Hide Shield comes off/.test(t) && /Uses Two-Handed [(]yours: [0-9]+[)] instead of One-Handed [(][0-9]+[)]/.test(t), "reward card: shield comes off + skill switch " + t);
  ok(!/comes off|instead of/.test(text(TIP.html("rw:steel_sword"))), "a one-hander reward has neither line");
}
console.log(fails ? fails + " of " + n + " failed" : "rewardtips ok (" + n + " checks)");
if (fails) process.exitCode = 1;
`, c);
