/* Pet followers (pets.js): an old save with Meeko in the follower slot moves him to the pet slot (health, bond and quest
   kept, his gear back in your pack); a follower and a pet travel together and are dismissed one at a time; pets wear no
   gear; in a fight the pet is its own ally that gets knocked down and gets back up; party cards carry it; it carries
   a little; the Pack Leader perk works; Polish is there.
   Loads the game like the page does (every script in index.html). W=/path/to/game/ node test_pets.js */
const W = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
const doc = { createElement: () => ({ width: 0, height: 0, style: {}, dataset: {}, getContext: () => ctx, toDataURL: () => "data:image/png;base64,AA" }), addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Reflect, Number, String, structuredClone,
  document: doc, addEventListener() {}, setTimeout, clearTimeout, setInterval() {}, localStorage: { getItem: () => null, setItem() {} }, devicePixelRatio: 2, process: { env: {} } };
vm.createContext(c);
const files = fs.readFileSync(W + "index.html", "utf8").match(/<script src="([a-z0-9_]+\.js)">/g).map((s) => s.match(/"(.*)"/)[1])
  .filter((f) => !["store.js", "p2pnet.js", "ui.js", "sound.js", "map.js", "backup.js", "skillinfo.js", "chargen.js"].includes(f));
if (!files.includes("pets.js")) { console.log("FAIL pets.js is not loaded by index.html"); process.exit(1); }
if (!files.includes("i18n_pets.js") || files.indexOf("i18n_pets.js") > files.indexOf("i18n.js")) { console.log("FAIL i18n_pets.js must load before i18n.js"); process.exit(1); }
for (const f of files) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
vm.runInContext(`
let n = 0, fails = 0; const ok = (x, m) => { n++; if (!x) { fails++; console.log("FAIL", m); } };
const hero = (lv = 12) => { const s = G.newSave("p" + Math.random(), "Tess", "nord"); s.level = lv; s.gold = 5000; s.location = "Whiterun"; [s.x, s.y] = WORLD.places.Whiterun; return s; };
const reload = (s) => G.migrate(JSON.parse(JSON.stringify(s)));
const both = (s) => { s.follower = { id: "lydia", hp: TOWNS.followerMax(s, "lydia"), ts: G.now() }; PETS.adopt(s, "meeko"); return s; };
const bandit = (hp = 80, dmg = 5) => ({ name: "Bandit", health: hp, hp, damage: dmg, tags: ["humanoid"], gold: [0, 0], level: 5 });
const count = (s, id) => s.inv.filter((r) => r.item === id).reduce((a, r) => a + r.qty, 0);

// 1. migration: Meeko in the follower slot moves to the pet slot; health, bond, quest kept; his gear comes home
{ const s = hero(); s.encFlags = { dog: true, once_dog: true };
  s.follower = { id: "meeko", hp: 37, ts: G.now() };
  BONDS.bond(s, "meeko"); const f = FOL2.st(s, "meeko"); f.loyal = 77; f.bond.q = 2; f.lvl = 6;
  f.inv = [{ id: 1, item: "iron_sword", qty: 1, temper: 2 }, { id: 2, item: "iron_dagger", qty: 2 }]; f.eq = { weapon: 1 };
  const swords = count(s, "iron_sword"), daggers = count(s, "iron_dagger");
  const r = reload(s);
  ok(r.pet && r.pet.id === "meeko" && !r.follower, "Meeko moved to the pet slot");
  ok(r.pet.hp === 37, "his health came with him: " + r.pet.hp);
  const rf = FOL2.st(r, "meeko"); ok(rf.loyal === 77 && rf.bond.q === 2 && rf.lvl === 6, "bond, quest step and level kept");
  ok(count(r, "iron_sword") === swords + 1 && count(r, "iron_dagger") === daggers + 2, "his sword and daggers are back in your pack");
  ok(r.inv.some((x) => x.item === "iron_sword" && x.temper === 2), "the sword kept its improvement");
  ok(!rf.inv.length && !Object.keys(rf.eq).length, "he holds and wears nothing");
  ok(/pets don't wear gear/.test(JSON.stringify(r.journal || []) + JSON.stringify(r.log || []) + JSON.stringify(r)), "you get a note about it");
  const r2 = reload(r); ok(count(r2, "iron_sword") === swords + 1, "a second load gives nothing twice");
  ok(r2.pet && r2.pet.id === "meeko", "still a pet after another load"); }

// 2. both slots at once, each dismissed on its own
{ const s = both(hero());
  ok(s.follower.id === "lydia" && s.pet.id === "meeko", "Lydia and Meeko together");
  ok(/already have a pet/.test(PETS.adopt(s, "meeko") + PETS.adopt(s, "nope_pet")) || /already with you/.test(PETS.adopt(s, "meeko")), "a second pet is refused");
  const r = reload(s); ok(r.follower.id === "lydia" && r.pet.id === "meeko", "both survive a load");
  const html = FOLTAB.panel(r, String);
  ok(/Lydia/.test(html) && /pet-panel/.test(html) && /Meeko/.test(html), "the Follower tab shows both sections");
  ok((html.match(/data-op="petdismiss"/g) || []).length === 1, "the pet has its own Dismiss");
  ok(/Pets don't wear gear/.test(html), "the Pet section says pets don't wear gear");
  const petPart = html.slice(html.indexOf("pet-panel"));
  ok(!/data-op="(give|equip|best|outfit|loadout|trade|take)"/.test(petPart), "no gear, trade or outfit buttons for the pet");
  ok(/Meeko/.test(FOLTAB.summary(r, String)) && /Lydia/.test(FOLTAB.summary(r, String)), "the Character page lists both");
  const m = FOL2.act(r, { op: "petdismiss" });
  ok(!r.pet && r.follower && r.follower.id === "lydia", "dismissing the pet keeps Lydia: " + m);
  const s2 = both(hero()); TOWNS.dismiss(s2);
  ok(!s2.follower && s2.pet && s2.pet.id === "meeko", "dismissing Lydia keeps Meeko");
  const h2 = FOLTAB.panel(s2, String); ok(/No follower with you right now/.test(h2) && /pet-panel/.test(h2) && /petdismiss/.test(h2), "follower gone, pet still shown"); }

// 3. pets wear no gear, and the Hunting Boots stay yours
{ const s = hero(); s.follower = { id: "meeko", hp: 60, ts: G.now() };   // an old save not yet loaded
  const row = G.give(s, "iron_sword", 1);
  ok(/pet/.test(String(FOL2.give(s, row, 1))) && !(FOL2.st(s, "meeko").inv || []).length, "you can't hand Meeko a sword");
  ok(/pet/.test(String(FOL2.equip(s, row))), "nothing can be put on him");
  ok(/pet/.test(String(FOL2.bestEquip(s, "meeko"))), "no auto-equip either");
  ok(D.ITEMS.bond_meeko && D.ITEMS.bond_meeko.slot === "feet", "the Old Master's Hunting Boots are a player item");
  const r = reload(s); G.give(r, "bond_meeko", 1);
  ok(!(FOL2.st(r, "meeko").inv || []).some((x) => x.item === "bond_meeko"), "the boots never end up on Meeko"); }

// 4. fights: Meeko is his own ally beside Lydia, knocked down but never killed
{ const s = both(hero(20)); s.pet.hp = PETS.maxHp(s);
  const f = new G.Fight(s, bandit(), null, G.now());
  const pa = f.allies.find((a) => a.pet), fa = f.allies.find((a) => a.follower);
  ok(pa && fa && pa.name === "Meeko" && fa.name === "Lydia", "Lydia and Meeko both fight");
  ok(pa.maxHp > 0 && pa.dmg > 0 && pa.kind === "dog", "Meeko has his own health bar and bite");
  ok(pa.maxHp < TOWNS.followerMax(s, "lydia") && pa.dmg < (fa.dmg || 99), "he's weaker than a follower: " + pa.maxHp + "hp " + pa.dmg + " dmg");
  f.run({ t: G.now() }); ok(f.won, "they win a bandit fight");
  f.apply(G.now()); ok(s.pet && s.pet.id === "meeko" && s.pet.hp > 0, "Meeko still with you after the fight");
  // a foe that floors him: he goes down, never dies, gets back up
  let down = 0, gone = 0;
  for (let i = 0; i < 40; i++) {
    const s2 = both(hero(10)); s2.pet.hp = 5;
    const f2 = new G.Fight(s2, bandit(900, 40), null, G.now()); f2.run({ t: G.now(), maxTurns: 12 }); f2.apply(G.now());
    if (f2.petDown) down++; if (!s2.pet) gone++;
    if (f2.petDown) ok(s2.pet.hp >= 1, "up again with health after being knocked down");
  }
  ok(down > 0, "a big foe can knock him down: " + down + "/40");
  ok(gone === 0, "he never dies or leaves because of a fight");
  const s3 = hero(); s3.pet = { id: "meeko", hp: 1, ts: G.now() };
  const fx = { s: s3, allies: [{ pet: true, fid: "meeko", hp: 0 }], petDown: "Meeko", won: false };
  const msgs = PETS.after(fx, G.now()); ok(s3.pet.hp >= 1 && msgs.some((x) => /gets back up/.test(x)), "after(): back up, with a line");
  // a pet alone fights too
  const s4 = hero(); PETS.adopt(s4, "meeko"); const f4 = new G.Fight(s4, bandit(), null, G.now());
  ok(f4.allies.some((a) => a.pet) && !f4.allies.some((a) => a.follower), "a pet without a follower still fights");
  // the turn bites
  const fb = { s: hero(), ehp: 100, allies: [] }; const t = PETS.turn(fb, { name: "Meeko", dmg: 10, fid: "x" });
  ok(fb.ehp < 100 && /Meeko/.test(t), "his turn is a bite: " + t); }

// 5. party: your card carries your pet; friends see it as an ally; it's never a player
{ const s = both(hero());
  const card = PARTY.cardBits(s, null);
  ok(card && card.pet && card.pet.id === "meeko", "your party card has your pet");
  const al = FOL2.cardAllies({ id: "u2", ...card });
  ok(al.some((a) => a.partyPet && a.name === "Meeko") && al.filter((a) => a.partyPet).length === 1, "a friend's Meeko fights beside you");
  ok(!al.some((a) => a.partyPet && a.uid), "the pet is never a player");
  ok(!FOL2.cardAllies({ id: "u3", pet: { id: "lydia", n: "Lydia" } }).some((a) => a.partyPet), "only real pets come through as pets"); }

// 6. carrying, and the Pack Leader perk
{ const s = hero(); const cap0 = G.capacity(s); PETS.adopt(s, "meeko");
  ok(G.capacity(s) - cap0 === PETS.carry(s) && PETS.carry(s) >= PETS.BASE_CARRY && PETS.carry(s) < 100, "he carries a little for you: +" + (G.capacity(s) - cap0));
  const hp0 = PETS.maxHp(s), d0 = PETS.dmg(s), tk0 = PETS.taken(s);
  const def = PFX.LIST ? PFX.LIST.find((p) => p[1] === "pack_leader") : null;
  ok(!PFX.LIST || def, "Pack Leader is a perk");
  s.perks = s.perks || {}; s.perks.pack_leader = 2;
  ok(PFX.num(s, "petdmg") > 0, "Pack Leader gives petdmg: " + PFX.num(s, "petdmg"));
  ok(PETS.maxHp(s) > hp0 && PETS.dmg(s) > d0 && PETS.taken(s) < tk0, "Pack Leader: more health, harder bites, takes less");
  const fx = { s, allies: [], petDown: "Meeko", won: false }; s.pet.hp = 1; PETS.after(fx, G.now());
  ok(s.pet.hp > Math.round(PETS.maxHp(s) * 0.1), "Pack Leader: gets up with more health: " + s.pet.hp); }

// 7. Polish
for (const k of ["Pet", "No pet with you.", "You already have a pet with you.", "Pack Leader", "No follower with you right now."]) ok(I18N.PL[k], "Polish for " + k);
ok(/zwierzak/i.test(I18N.PL[MEEKO.TXT.busy] || ""), "Meeko's busy line in Polish talks about pets");
ok(/zdrowia · gryzie ~4/.test(I18N.tr("30/72 health · bites ~4 · carries 50 for you · goes down instead of dying") || ""), "the pet's stat line in Polish");
ok(/wstaje po walce/.test(I18N.tr("Meeko gets back up after the fight, a bit wobbly.") || ""), "the get-up line in Polish");

console.log(fails ? fails + " FAILED of " + n : "pets ok · " + n + " checks");
if (fails) process.exitCode = 1;
`, c);
if (c.process.exitCode) process.exitCode = c.process.exitCode;
