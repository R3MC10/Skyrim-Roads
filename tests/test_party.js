const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// parties: members near you fight beside you on their own tactics, share the spoils once each, and walk with you in the travel picture
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "priests.js", "horses.js", "horseback.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "craftfair.js", "social.js", "ammo.js", "tomes.js", "magic.js", "mp.js", "coop.js", "party.js", "heroart.js"])
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (e) { if (f !== "heroart.js") throw e; } }
vm.runInContext(`
const ok = (x, m) => { if (!x) throw new Error("FAIL " + m); };
let n = 0; const OK = (x, m) => { ok(x, m); n++; };
const mk = (id, name) => { const s = G.newSave(id, name, "nord"); s.location = null; [s.x, s.y] = WORLD.places["Whiterun"]; s.level = 12; return s; };
const A = mk("A", "Alfa"), B = mk("B", "Beta"), C = mk("C", "Ceta"), Z = mk("Z", "Zed");
const party = { id: "p1", leader: "A", members: [{ id: "A", name: "Alfa" }, { id: "B", name: "Beta" }, { id: "C", name: "Ceta" }] };
// B is a healer by their own tactics: give them a heal spell rule
B.spells = [...new Set([...(B.spells || []), "healing"])];
const lo = G.loadout(B); lo.rules = [{ if: "hp_below", pct: 60, do: "spell:healing" }, ...(lo.rules || [])];
const look = { r: "redguard", id: "B", eq: { weapon: "steel_sword", chest: "steel_armor", head: "steel_helmet", shield: "steel_shield" }, gl: {} };
const card = (s, extra = {}) => ({ id: s.id, name: s.name, race: s.race, level: s.level, x: s.x, y: s.y, look: s.id === "B" ? look : { r: "nord", id: s.id, eq: {}, gl: {} }, ...MP.stats(s), ...PARTY.cardBits(s, party), ...extra });
const cb = card(B), cc = card(C);
OK(cb.pp && cb.pp.role === "healer", "B publishes their own tactics profile: " + JSON.stringify(cb.pp && cb.pp.role));
OK(!PARTY.cardBits(B, null).pp, "nothing extra published outside a party");
const pos = (o) => [o.x, o.y];
const far = { ...card(Z), id: "Z" };
const cards = [cb, cc, { ...card(Z), x: A.x + 500 }];
// near mates: party members only, close by, not downed
let mates = PARTY.nearMates(A, party, cards, [A.x, A.y], pos, MP.NEAR_PX);
OK(mates.length === 2 && mates.every((m) => ["B", "C"].includes(m.id)), "B and C are near and in the party");
OK(PARTY.nearMates(A, party, [{ ...cb, x: A.x + 200 }], [A.x, A.y], pos, MP.NEAR_PX).length === 0, "too far away: no help");
OK(PARTY.nearMates(A, party, [{ ...cb, cur: 0 }], [A.x, A.y], pos, MP.NEAR_PX).length === 0, "a downed member can't help");
OK(PARTY.nearMates(A, null, cards, [A.x, A.y], pos, MP.NEAR_PX).length === 0, "no party: nobody");
OK(PARTY.nearMates(A, party, [{ ...card(Z), x: A.x }], [A.x, A.y], pos, MP.NEAR_PX).length === 0, "outsiders never join your fight");
A.dungeon = { place: "Bleak Falls Barrow" };
OK(PARTY.nearMates(A, party, [{ ...cb, dungeon: "Bleak Falls Barrow" }, { ...cc }], [A.x, A.y], pos, MP.NEAR_PX).map((m) => m.id).join() === "B", "in a dungeon: only members in the same dungeon");
A.dungeon = null;
// allies use co-op fighting with each owner's own profile, and carry their look for the fight picture
const al = PARTY.allyFromCard(cb);
OK(al.coop && al.role === "healer" && al.uid === "B" && al.look && al.look.eq.weapon === "steel_sword", "B fights as a healer, in their gear");
// a real fight
G.setAllyProvider(() => PARTY.allies(A, party, cards, [A.x, A.y], pos, MP.NEAR_PX));
const e = { name: "Bandit Chief", level: 12, health: 260, hp: 260, damage: 12, armor: 20 };
const f = new G.Fight(A, { ...e }, null, G.now());
OK(f.allies.filter((a) => a.party).length === 2, "two party allies in the fight");
f.run({ t: G.now() });
OK(f.log.some((l) => /Beta|Ceta/.test((l.me || "") + (l.them || ""))), "allies show in the fight log");
OK(PARTY.fought().ids.join() === "B,C", "who fought is remembered");
// win rate with and without the party
let solo = 0, team = 0;
for (let i = 0; i < 120; i++) {
  const S1 = mk("A" + i, "Alfa"); G.setAllyProvider(() => []); const f1 = new G.Fight(S1, { ...e, health: 420, hp: 420, damage: 22 }, null, G.now()); f1.run({ t: G.now() }); if (f1.won) solo++;
  const S2 = mk("A" + i, "Alfa"); G.setAllyProvider(() => PARTY.allies(S2, party, cards, [S2.x, S2.y], pos, MP.NEAR_PX)); const f2 = new G.Fight(S2, { ...e, health: 420, hp: 420, damage: 22 }, null, G.now()); f2.run({ t: G.now() }); if (f2.won) team++;
}
G.setAllyProvider(() => []);
OK(team > solo, "fighting together wins more: solo " + solo + "/120, party " + team + "/120");
console.log("win rate tough foe: solo", solo, "party", team);
// spoils: one share each, fixed roll, only members who fought, only once
const sd = PARTY.shareDoc(A, f, ["B", "C"], ["Beta", "Ceta"]);
let doc = sd.doc;
OK(doc.members.join() === "B,C" && doc.by === "A", "share lists who fought");
let o = PARTY.claim(doc, sd.id, "B"); OK(o.got && o.got.gold > 0 && o.got.xp > 0, "B takes a share"); doc = o.doc;
OK(!PARTY.claim(doc, sd.id, "B").got, "B can't take it twice");
OK(!PARTY.claim(doc, sd.id, "Z").got, "an outsider gets nothing");
OK(!PARTY.claim(doc, sd.id, "A").got, "the one who posted it already got their own loot");
const rc = PARTY.roll(sd.id, doc, "C"); o = PARTY.claim(doc, sd.id, "C"); OK(JSON.stringify(o.got) === JSON.stringify(rc), "rolls are fixed per player"); doc = o.doc;
const g0 = B.gold, xp0 = JSON.stringify(B.skills);
const res = PARTY.give(B, sd.id, doc, PARTY.roll(sd.id, doc, "B"));
OK(res && B.gold > g0 && JSON.stringify(B.skills) !== xp0, "B gets gold and combat practice: " + (res && res.text));
OK(!PARTY.give(B, sd.id, doc, PARTY.roll(sd.id, doc, "B")) && B.gold === g0 + PARTY.roll(sd.id, doc, "B").gold, "and only once in their save");
OK(PARTY.mineToTake([doc], "B", B).length === 0 && PARTY.mineToTake([{ ...doc, id: "x2", claims: {} }], "C", C).length === 1, "what's left to take");
OK(!PARTY.claim({ ...doc, claims: {}, t: G.now() - PARTY.SHARE_SECONDS - 5 }, "old", "B").got, "old shares expire");
// travel company: party members close by, plus followers (yours first)
A.follower = { id: "lydia" };
const cbFol = { ...cb, fol: "jenassa", ride: "#6b4a2e" };
const co = PARTY.companions(A, party, [cbFol, cc, { ...cb, id: "Q", name: "Far", x: A.x + 300 }], [A.x, A.y], pos, MP.NEAR_PX);
OK(co[0].name === "Lydia" && co[0].follower && co[0].look.eq.shield, "your follower walks first, in her gear");
OK(co.some((m) => m.name === "Beta" && m.riding && m.look.eq.weapon === "steel_sword"), "Beta rides along, in her gear");
OK(co.some((m) => m.name === "Jenassa" && m.follower), "Beta's follower comes too");
OK(co.some((m) => m.name === "Ceta") && !co.some((m) => m.name === "Far"), "far members don't");
OK(PARTY.companions(A, null, [cb], [A.x, A.y], pos, MP.NEAR_PX).length === 1, "no party: only your follower");
OK(co.length <= 10, "at most ten in the picture (parties of 8)");
console.log("party ok ·", n, "checks");
`, c);
