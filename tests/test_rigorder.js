/* [offhand] Layer order of the painted rig (rig.js): the off hand is the back layer. For every set, every clip, every kind
   of gear and both facings, the shield and the left arm, a second blade and the left fist are drawn before the legs, the
   body and the head; the weapon arm, the weapon and the right fist come after the body. And every humanoid foe kind gets a
   look card (foelook.js) the painted rig can draw, while beasts, dragons and spirits don't.
   The figure is drawn onto a stub canvas (no pictures needed). */
const path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const D = require(path.join(W, "rigdata.js"));
let fails = 0;
const ok = (c, m) => { if (!c) fails++; if (!c || process.env.V) console.log((c ? "ok   " : "FAIL ") + m); };
function stubCanvas() {
  const ctx = new Proxy({ getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), globalAlpha: 1 }, {
    get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  return { width: 8, height: 8, getContext: () => ctx, ctx };
}
global.document = { createElement: () => stubCanvas() };
global.ASSETS = { img: () => ({ width: 8, height: 8, naturalWidth: 8, naturalHeight: 8 }) };
global.RIGDATA = D;
const R = require(path.join(W, "rig.js"));

const GEARS = [["1h+shield", { wt: "sword", shield: true, shieldOut: true }], ["mace+shield", { wt: "mace", shield: true, shieldOut: true }], ["2h", { wt: "greatsword" }],
  ["bow", { wt: "bow" }], ["staff", { wt: "staff" }], ["dual", { wt: "sword", off: "dagger" }], ["bare", { wt: null }]];
const sets = { "nordm-leather": { r: "nord" }, "nordm-steel": { r: "nord", heavy: true }, "nordf-iron": { r: "dunmer", fem: true, heavy: true, ck: "iron", skin: "#8a8f9a" } };
const BACK = ["shield", "offArm", "offWeapon", "offFist"], FRONT = ["mainArm", "mainWeapon", "mainFist"];
let n = 0, shieldSeen = 0;
for (const [set, base] of Object.entries(sets)) for (const clip of Object.keys(D.CLIPS)) for (const [gn, go] of GEARS) for (const face of [1, -1]) {
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, sp = { ...base, wk: go.wt, skin: base.skin || "#e2b894" }, g = stubCanvas().ctx;
    if (face < 0) g.scale(-1, 1);
    const drew = R.fight(g, { id: "ro-" + set, r: base.r }, { clip, u, w: 1, wt: go.wt, shield: !!go.shield, shieldOut: !!go.shieldOut, off: go.off || null, who: "ro", t: u }, sp);
    if (!drew) { ok(false, `${set} ${clip} ${gn}: drew`); break; }
    const o = R.last("ro").order; n++;
    const at = (x) => o.indexOf(x), legs = at("legs"), body = at("body");
    const tag = `${set} ${clip} ${gn} face ${face} u=${u.toFixed(2)}: ${o.join(",")}`;
    for (const b of BACK) if (at(b) >= 0) ok(at(b) < legs && at(b) < body, `off hand at the back (${b}) — ${tag}`);
    for (const f of FRONT) if (at(f) >= 0) ok(at(f) > body, `weapon hand in front (${f}) — ${tag}`);
    if (go.shield && at("shield") >= 0) { shieldSeen++; ok(at("shield") === 0, `the shield is the very first layer — ${tag}`); ok(R.last("ro").hands.shield.front === 0, `shield never in front — ${tag}`); }
  }
}
ok(shieldSeen > 100, `shield layers checked: ${shieldSeen}`);

// every humanoid foe gets a painted look; creatures don't
global.module = undefined;
const FOELOOK = require(path.join(W, "foelook.js"));
const PEOPLE = ["Bandit", "Bandit Outlaw", "Bandit Chief", "Bandit Marauder", "Highwayman", "Draugr", "Restless Draugr", "Draugr Wight", "Draugr Scourge", "Draugr Deathlord",
  "Forsworn", "Forsworn Briarheart", "Falmer", "Falmer Skulker", "Vampire", "Vampire Nightstalker", "Necromancer", "Conjurer", "Warlock", "Hedge Witch", "Cultist", "Thalmor Justiciar",
  "Thalmor Soldier", "Dremora", "Dremora Lord", "Imperial Soldier", "Stormcloak Soldier", "Silver Hand", "Vigilant of Stendarr", "Dark Brotherhood Assassin", "Hired Thug",
  "Mercenary", "Hunter", "Poacher", "Mage", "Battlemage", "Bandit Archer"];
const CREATURES = ["Wolf", "Ice Wolf", "Cave Bear", "Sabre Cat", "Troll", "Frost Troll", "Giant", "Mammoth", "Frostbite Spider", "Skeever", "Mudcrab", "Horker", "Chaurus",
  "Spriggan", "Hagraven", "Wisp", "Ice Wraith", "Flame Atronach", "Dwarven Centurion", "Dwarven Sphere", "Skeleton", "Dragon", "Frost Dragon", "Dragon Priest", "Riekling", "Ash Spawn", "Werewolf"];
for (const nm of PEOPLE) {
  const L = FOELOOK.look(nm, null, /archer/i.test(nm) ? "archer" : null, 0);
  ok(!!L && L.id != null && L.eq && L.eq.chest, `${nm}: has a painted look (${L ? L.foe + " " + L.r + " " + L.eq.chest + " " + (L.eq.weapon || "bare") : "none"})`);
  if (L) {
    const sp = { r: L.r, fem: L.sx === "f", heavy: /iron|steel|ancient|daedric|stormcloak|banded/.test(L.eq.chest), ck: L.eq.chest.split("_")[0] };
    ok(/^nord[mf]-(leather|iron|steel)$/.test(R.setOf(sp, L)), `${nm}: wears a painted set (${R.setOf(sp, L)})`);
    ok(FOELOOK.look(nm, null, null, 0) === FOELOOK.look(nm, null, null, 0), `${nm}: the same look every time`);
  }
}
const pack = new Set([0, 1, 2, 3].map((i) => JSON.stringify(FOELOOK.look("Bandit", null, null, i))));
ok(pack.size >= 2, `a pack of bandits isn't one person copied (${pack.size} looks of 4)`);
ok(FOELOOK.look("Bandit Archer", null, "archer", 0).eq.weapon === "hunting_bow", "a bandit archer carries a bow");
ok(FOELOOK.look("Draugr", null, null, 0).sk, "a draugr has its own grey skin");
for (const nm of CREATURES) ok(!FOELOOK.look(nm, null, null, 0), `${nm}: no person look (keeps its creature rig)`);
ok(!FOELOOK.of({ foe: "player", foeName: "Ysolda", foeLook: { id: 1 } }), "another player keeps their own look");

console.log(`rigorder: ${n} frames checked, ${fails ? fails + " FAILED" : "all ok"}`);
process.exit(fails ? 1 : 0);
