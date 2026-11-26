// Perk reset at a shrine or temple (perkreset.js): the price (formula, cap, 7-day expiry), the free first reset, the
// level 5 gate for paid ones, where it works, never in a fight / dungeon / heist / road encounter, every perk point
// back across every tree, no perk effect left behind, health capped, hotbar tidied, one step (rolls back on an error).
const W = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, RegExp, Error };
vm.createContext(c);
const FILES = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js",
  "enchanting.js", "smithing.js", "tomes.js", "magic.js", "spellbook.js", "potionfx.js", "afflictions.js", "heists.js", "hotbar.js", "placestuff.js", "i18n_perkreset.js", "perkreset.js"];
for (const f of FILES.filter((f) => fs.existsSync(W + f))) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
let n = 0, fails = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const { G, PERKS, PFX, PERKRESET: R, HOTBAR, PLACESTUFF } = c;
ok(R && !c.RESPEC, "perkreset.js loads; respec.js is gone");
const DAY = 86400, T0 = 2_000_000_000;
const hero = (lvl = 10, at = "Shrine of Talos") => { const s = G.newSave("h" + Math.random(), "H", "nord"); s.level = lvl; s.location = at; s.trip = null; s.gold = 0; for (const k of Object.keys(s.skills)) s.skills[k].lvl = 100; G.setHealth(s, G.maxHealth(s)); return s; };
const takeAny = (s, k = 1) => { let got = 0; for (const id of Object.keys(PERKS.BY_ID)) { while (got < k && !PERKS.canTake(s, id)) { PERKS.take(s, id); got++; } if (got >= k) break; } return got; };

// ---- 1. the price
ok(R.price(5, 0) === 225, "level 5, no recent resets: (100 + 125) × 1 = 225: " + R.price(5, 0));
ok(R.price(10, 1) === 525, "level 10, one recent: 350 × 1.5 = 525");
ok(R.price(10, 2) === 700 && R.price(10, 3) === 875, "× 2 and × 2.5");
ok(R.price(10, 4) === 1050 && R.price(10, 9) === 1050, "capped at × 3: " + R.price(10, 9));
ok(R.price(40, 0) === 1100 && R.price(1, 0) === 125, "level 40 = 1,100; level 1 = 125");
// calibration: the first paid reset is about one or two ordinary quests' pay
const jobClear1 = 120 + 150 * 1;   // towns.js: a tier-1 "clear the dungeon" job
ok(R.price(5, 0) <= 2 * jobClear1 && R.price(5, 0) >= jobClear1 * 0.5, "first paid reset (225) is within one or two jobs' pay (" + jobClear1 + ")");

// ---- 2. where
let s = hero(10, "Riverwood");
ok(!R.where(s), "Riverwood has no shrine or temple");
ok(/shrine or a city temple/.test(R.can(s, {}, T0)), "can't reset away from a shrine: " + R.can(s, {}, T0));
for (const p of ["Shrine of Talos", "Shrine of Azura", "Shrine of Mehrunes Dagon", "Statue to Meridia", "Shrine of Boethiah", "Hall of the Vigilant", "Weynon Stones"]) { s.location = p; ok(R.where(s) && !R.where(s).temple, "shrine: " + p); }
for (const p of ["Whiterun", "Riften", "Solitude", "Markarth", "Windhelm", "Falkreath"]) { s.location = p; ok(R.where(s)?.temple, "temple: " + p); ok(R.sections(p)[0] === "temple", "temple section in " + p); }
ok(R.sections("Riverwood").length === 0 && R.sections("Shrine of Talos").length === 0, "no temple section elsewhere");
s.location = "Shrine of Talos"; s.trip = { status: "travel" }; ok(!R.where(s), "not while on the road"); s.trip = null;
ok(/Reset perks/.test(PLACESTUFF.card(s)) || !R.perkCount(s), "a shrine's What's here card has the row");
ok(!/Reset perks/.test(PLACESTUFF.card({ ...s, location: "Half-Moon Mill", pstuff: {} })), "a mill doesn't");

// ---- 3. the free first reset, at any level
s = hero(3);
ok(R.can(s, {}, T0) === "Nothing to take back yet.", "nothing to take back on a fresh hero");
takeAny(s, 2);
let q = R.quote(s, T0);
ok(q.free && q.cost === 0 && q.perks === 2, "first reset is free: " + JSON.stringify(q));
ok(q.nextLocked, "level 3: the next one says paid resets open at level 5");
ok(/level 5/.test(R.dialog(s)) && /Free/.test(R.dialog(s)), "dialog: free price and the level 5 note");
let r = R.run(s, {}, T0);
ok(!r.err && r.free && s.gold === 0 && PERKS.pointsLeft(s) === 2 && !Object.keys(s.perks).length, "free reset worked: " + JSON.stringify(r));
ok(s.perkReset.freeUsed && s.perkReset.paid.length === 0, "free reset used, not counted as paid");

// ---- 4. level gate for paid resets
takeAny(s, 1); s.gold = 99999;
ok(/level 5/.test(R.can(s, {}, T0)), "paid resets need level 5: " + R.can(s, {}, T0));
s.level = 5; takeAny(s, 2); s.gold = 224;
ok(/225/.test(R.can(s, {}, T0)), "not enough gold: " + R.can(s, {}, T0));
ok(/disabled/.test(R.row(s)), "row button disabled when short of gold");
const before = JSON.stringify({ g: s.gold, p: s.perks });
ok(R.run(s, {}, T0).err && JSON.stringify({ g: s.gold, p: s.perks }) === before, "a refused reset changes nothing");
s.gold = 1000;
q = R.quote(s, T0);
ok(q.cost === 225 && q.next === 338, "price 225, next 338 (225 × 1.5): " + JSON.stringify(q));
ok(/225 gold/.test(R.dialog(s)) && /338 gold/.test(R.dialog(s)), "dialog shows the price and the next price (numbers, not the formula)");
ok(!/100 \+|× level|min\(/.test(R.dialog(s)), "no formula in the dialog");
r = R.run(s, {}, T0);
ok(!r.err && s.gold === 775 && r.cost === 225 && PERKS.pointsLeft(s) === 4, "paid reset: gold and perks in one step: " + JSON.stringify(r));

// ---- 5. rising price and the 7-day expiry
s.level = 10; s.gold = 100000;
const paidAt = (t) => { takeAny(s, 1); const x = R.run(s, {}, t); ok(!x.err, "reset at " + t + ": " + x.err); return x.cost; };
const c1 = paidAt(T0 + DAY);                 // one paid reset this week already → × 1.5
ok(c1 === 525, "second paid reset in the week costs 350 × 1.5 = 525: " + c1);
const c2 = paidAt(T0 + 2 * DAY), c3 = paidAt(T0 + 3 * DAY), c4 = paidAt(T0 + 3 * DAY + 60), c5 = paidAt(T0 + 3 * DAY + 120);
ok(c2 === 700 && c3 === 875 && c4 === 1050 && c5 === 1050, "× 2, × 2.5, then capped at × 3: " + [c2, c3, c4, c5]);
ok(R.recent(s, T0 + 3 * DAY + 120) === 6, "six paid resets this week");
ok(R.recent(s, T0 + 7 * DAY + 1) === 5, "the first one drops off after 7 days");
ok(R.recent(s, T0 + 11 * DAY) === 0 && R.quote(s, T0 + 11 * DAY).cost === 350, "a quiet week: back to the base price (350 at level 10)");
ok(R.easesIn(s, T0 + 3 * DAY + 60) > 0, "easesIn says when the price drops");
takeAny(s, 1); R.run(s, {}, T0 + 11 * DAY);
ok(s.perkReset.paid.length === 1, "old timestamps are pruned from the save: " + s.perkReset.paid.length);

// ---- 6. never in a fight, a dungeon, a heist or a road encounter
s = hero(10); takeAny(s, 3); s.perkReset = { freeUsed: true, paid: [] }; s.gold = 5000;
const g0 = s.gold, p0 = JSON.stringify(s.perks);
ok(/fight/.test(R.run(s, { fight: true }, T0).err), "not in a fight");
s.dungeon = { name: "Bleak Falls Barrow" }; ok(/dungeon/.test(R.run(s, {}, T0).err), "not in a dungeon"); s.dungeon = null;
s.heist = { run: { id: "x", stage: 1 } }; ok(/heist/.test(R.run(s, {}, T0).err), "not during a heist"); s.heist = null;
s.encounter = { id: "wolves" }; ok(/road/.test(R.run(s, {}, T0).err), "not with a road encounter waiting"); s.encounter = null;
ok(s.gold === g0 && JSON.stringify(s.perks) === p0, "nothing changed by the refused tries");
ok(!R.run(s, { fight: false }, T0).err, "and it works once you're free");

// ---- 7. every tree: every point back, no perk effect left behind
s = hero(400); s.gold = 1e7; s.perkReset = { freeUsed: true, paid: [] };
const base = hero(400);   // same race, no perks: what perk-free numbers look like
let took = 0, more = true;
while (more) { more = false; for (const id of Object.keys(PERKS.BY_ID)) while (!PERKS.canTake(s, id)) { PERKS.take(s, id); took++; more = true; } }
const trees = new Set(Object.keys(s.perks).map((id) => PERKS.BY_ID[id]?.skill));
ok(trees.size === Object.keys(PERKS.TREES).length, `perks taken in every tree (${trees.size}/${Object.keys(PERKS.TREES).length})`);
ok(took > 100 && R.perkCount(s) === took, "took " + took + " ranks");
const keys = new Set(); for (const fx of Object.values(PFX.FX)) for (const [k] of fx) keys.add(k);
const withPerks = [...keys].filter((k) => PFX.num(s, k) !== PFX.num(base, k)).length;
ok(withPerks > 0, "perks change some numbers before the reset (" + withPerks + " keys)");
s.hpBonus = 30; s.pendingLevels = 0; const pend = R.attrCount(s);
r = R.run(s, {}, T0);
ok(!r.err && r.perks === took && r.attrs === pend, "refund: every rank and every choice: " + JSON.stringify(r));
ok(PERKS.pointsLeft(s) === s.level - 1, "all " + (s.level - 1) + " perk points back");
ok(Object.keys(PERKS.BY_ID).every((id) => PERKS.rank(s, id) === 0 && !G.P(s, id)), "every perk at rank 0");
const dangling = [...keys].filter((k) => PFX.num(s, k) !== PFX.num(base, k));
ok(!dangling.length, "no perk effect lingers: " + dangling.join(", "));
ok(G.maxHealth(s) === G.maxHealth(base) && G.curHealth(s) <= G.maxHealth(s), "health back to the perk-free maximum and capped");
ok(s.pendingLevels === pend && s.hpBonus === 0, "level-up choices back to spend");
ok(Object.keys(PERKS.BY_ID).length === new Set(Object.keys(PERKS.BY_ID)).size && PERKS.BY_ID.armsman, "perk ids are untouched");
// and they can be taken again
ok(!PERKS.canTake(s, "armsman") && /learned/.test(PERKS.take(s, "armsman")), "perks can be taken again");

// ---- 8. tidy: hotbar slots for moves you no longer have are emptied; one step (rolls back)
if (HOTBAR) {
  s = hero(10); takeAny(s, 2); s.perkReset = { freeUsed: true, paid: [] }; s.gold = 5000;
  s.hotbar = ["attack", "spell:nope_not_known", "potion:health", null, null, null, null, null, null, null];
  R.run(s, {}, T0);
  ok(s.hotbar[0] === "attack" && s.hotbar[1] === null && s.hotbar[2] === "potion:health", "hotbar: unknown move cleared, the rest kept: " + s.hotbar.slice(0, 3));
}
s = hero(10); takeAny(s, 2); s.perkReset = { freeUsed: true, paid: [] }; s.gold = 5000;
const snap = JSON.stringify({ g: s.gold, p: s.perks, r: s.perkReset, h: s.health });
const setH = G.setHealth, maxH = G.maxHealth;
G.maxHealth = () => { throw new Error("boom"); };
r = R.run(s, {}, T0);
G.maxHealth = maxH; G.setHealth = setH;
ok(r.err && JSON.stringify({ g: s.gold, p: s.perks, r: s.perkReset, h: s.health }) === snap, "an error mid-way puts gold, perks and the price log back: " + r.err);

// ---- 9. the page bits
s = hero(10); takeAny(s, 2);
ok(/data-act="perkreset" data-id="ask"/.test(R.row(s)), "row has the Reset perks button");
ok(/First perk reset free/.test(R.status(s).text), "temple tile: first reset free");
ok(/Pray at any shrine/.test(R.hint(s)) && R.hint(hero(5)) === "", "Character screen points to the shrines (only when there's something to reset)");
s.location = "Whiterun"; ok(/Reset perks/.test(R.townHTML(s).body) && R.names().temple === "Temple", "temple place in town");

console.log(fails ? `FAILED ${fails} of ${n}` : `perkreset ok (${n} checks)`);
process.exit(fails ? 1 : 0);
