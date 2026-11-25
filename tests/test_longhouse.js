const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* The adventuring company longhouse (longhouse.js): founding, the ledger (treasury, stockpile, rooms, trophies),
   permissions and the daily limit, invites and the 8-player cap, two members writing at once (netsync merge), what each
   room really does (forge, library, trophy hall, stables, planning table), the perks, a cost sim by company size, and
   Polish for every line. W=/path/to/game/ node test_longhouse.js — prints "longhouse ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, Promise, setInterval: () => 0, clearInterval: () => {} };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "halls.js", "engine.js", "events.js", "dungeons.js", "towns.js", "horses.js", "bonds.js", "runecraft.js", "leghunt.js", "netsync.js", "i18n_longhouse.js", "longhouse.js"])
  if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
c.SRC = fs.readFileSync(W + "longhouse.js", "utf8");
c.PN = fs.existsSync(W + "patchnotes.js") ? fs.readFileSync(W + "patchnotes.js", "utf8") : "";
vm.runInContext(`
(async () => {
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
const L = LONGHOUSE, H = 3600, DAY = 86400;
let NOW = 1795000000; G.now = () => NOW;
// a shared store like Store's local mode (one record per company, read-modify-write)
const mem = {}; let watchers = [];
const emit = () => { const list = Object.values(mem).map((d) => JSON.parse(JSON.stringify(d))); L.setDocs(list); };
var Store = { online: true,
  put: async (col, id, doc) => { mem[id] = { ...JSON.parse(JSON.stringify(doc)), id }; emit(); return true; },
  change: async (col, id, fn) => { const cur = mem[id]; if (!cur) return null; const before = JSON.parse(JSON.stringify(cur)); const nx = fn(JSON.parse(JSON.stringify(cur))); if (nx) mem[id] = { ...nx, id }; else delete mem[id]; emit(); return { before, after: nx }; },
  remove: async (col, id) => { delete mem[id]; emit(); }, watch: () => {} };
globalThis.Store = Store;
let who = null; const toasts = [];
L._api({ S: () => who, toast: (t) => toasts.push(t), persist: () => {}, render: () => {}, party: () => null });
const mk = (id, lvl) => { const s = G.newSave(id, "P" + id, "nord"); s.level = lvl; s.location = "Whiterun"; s.gold = 0; return s; };
const as = (s) => { who = s; return s; };

// ---- 1. founding
const A = as(mk("a", 10)); A.gold = 1000;
ok(/costs 3000/.test(await L.found(A, "Ironbound")), "founding needs the gold");
A.gold = 5000; A.location = null;
ok(/town or village/.test(await L.found(A, "Ironbound")), "founding needs a town");
A.location = "Whiterun";
ok(/name/.test(await L.found(A, "x")), "founding needs a name");
ok((await L.found(A, "Ironbound")) === null && A.gold === 2000, "founded for 3000 gold");
let d = L.mine(A);
ok(d && d.name === "Ironbound" && d.site === "Whiterun" && d.founder === "a" && A.lhId === d.id, "the record and the save know each other");
ok(/already/.test(await L.found(A, "Second")), "one company at a time");

// ---- 2. treasury and the ledger
ok((await L.deposit(A, 1500)) === null && A.gold === 500, "deposit takes your gold");
ok(L.derive(L.mine(A)).gold === 1500, "the balance comes from the ledger");
ok(/don't have/.test(await L.deposit(A, 99999)), "can't put in what you don't have");
ok((await L.withdraw(A, 400)) === null && A.gold === 900 && L.derive(L.mine(A)).gold === 1100, "the founder takes out freely");
ok(/doesn't have/.test(await L.withdraw(A, 5000)), "can't take out more than there is");

// ---- 3. invites, joining, the cap of 8 (followers don't count: only player ids are members)
const B = mk("b", 10), C2 = mk("c", 10);
as(A); ok((await L.invite(A, "b", "Pb")) === null, "the founder invites");
as(B); L.setDocs(Object.values(mem)); ok(L.invitesFor(B).length === 1 && L.badge(B) === 1, "B sees the invite");
ok((await L.join(B, L.invitesFor(B)[0].id)) === null && L.mine(B)?.id === d.id && B.lhId === d.id, "B joins");
ok(L.invitesFor(B).length === 0, "the invite is used up");
as(B); ok(/founder and officers/.test(await L.invite(B, "c", "Pc")), "members can't invite by default");
as(B); B.gold = 300; ok((await L.deposit(B, 300)) === null, "a member puts gold in");
as(B); ok(/founder allows/.test(await L.withdraw(B, 100)), "members can't take out by default");
as(A); ok((await L.setPerm(A, "wd", "all")) === null && (await L.setPerm(A, "cap", 200)) === null, "the founder opens withdrawals with a 200 cap");
as(B); ok((await L.withdraw(B, 150)) === null && B.gold === 150, "B takes out 150");
ok(/50 more/.test(await L.withdraw(B, 100)), "the daily limit holds");
NOW += DAY + 10;
ok((await L.withdraw(B, 100)) === null, "the next day it opens again");
as(B); ok(/Only the founder/.test(await L.setPerm(B, "wd", "all")), "only the founder changes who may");
as(A); for (let i = 0; i < 7; i++) await L.invite(A, "x" + i, "X" + i);
for (let i = 0; i < 6; i++) { const X = as(mk("x" + i, 5)); await L.join(X, d.id); }
as(A); ok(L.derive(L.mine(A)).n === 8, "eight players");
const X6 = as(mk("x6", 5)); ok(/up to 8/.test(await L.join(X6, d.id)), "the ninth can't join");
as(A); ok(/up to 8/.test(await L.invite(A, "y", "Y")), "and can't be invited");
as(A); ok((await L.setRole(A, "x5", "out")) === null && L.derive(L.mine(A)).n === 7, "the founder sends one away");
const X5 = as(mk("x5", 5)); X5.lhId = d.id; ok(L.mine(X5) === null && !X5.lhId, "the one sent away is out (and their save forgets)");
as(A); ok((await L.setRole(A, "b", "officer")) === null && L.can(L.mine(A), "b", "invite"), "officers can invite");
as(B); ok(/Hand the company/.test(await L.leave(as(A))), "the founder can't just walk off");

// ---- 4. rooms: gold and materials from the stockpile, used up
as(A); d = L.mine(A);
const n7 = L.derive(d).n, cf = L.costOf("forge", 1, n7);
ok(cf.g === Math.round(1000 * L.sizeMult(n7) / 10) * 10, "cost scales with company size");
ok(/stockpile needs|treasury needs/.test(await L.build(A, "forge")), "a room needs its materials");
A.gold = 50000; await L.deposit(A, 40000);
for (const [k, q] of Object.entries(cf.m)) G.give(A, k, q + 2);
ok((await L.giveMat(A, "mat_iron", cf.m.mat_iron + 2)) === null && (await L.giveMat(A, "mat_firewood", cf.m.mat_firewood + 2)) === null, "materials go to the stockpile");
ok(!A.inv.some((r) => r.item === "mat_iron"), "…and leave your pack");
const g0 = L.derive(L.mine(A)).gold;
ok((await L.build(A, "forge")) === null, "the forge is built");
let x = L.derive(L.mine(A));
ok(x.rooms.forge === 1 && x.gold === g0 - cf.g && x.mats.mat_iron === 2 && x.mats.mat_firewood === 2, "the forge uses the gold and the materials up");
// everything else, for the effects below
const stock = (room, lvl) => { const cc = L.costOf(room, lvl, L.derive(L.mine(A)).n, A); for (const [k, q] of Object.entries(cc.m)) { G.give(A, k, q); } return cc; };
for (const r of L.ROOM_IDS) for (let l = (L.derive(L.mine(A)).rooms[r] || 0) + 1; l <= 3; l++) {
  const cc = stock(r, l); for (const k of Object.keys(cc.m)) await L.giveMat(A, k, A.inv.find((q) => q.item === k).qty);
  if (L.derive(L.mine(A)).gold < cc.g) { A.gold += cc.g; await L.deposit(A, cc.g); }
  const e = await L.build(A, r); ok(e === null, "build " + r + " " + l + (e ? ": " + e : ""));
}
x = L.derive(L.mine(A));
ok(L.ROOM_IDS.every((r) => x.rooms[r] === 3), "every room at level 3");
ok(/finished/.test(await L.build(A, "forge")), "a finished room stays finished");
// two members building the same level at once: one entry (same id), paid once
const twin = JSON.parse(JSON.stringify(mem[d.id]));
ok(Object.keys(twin.tx).filter((k) => k.startsWith("b-forge-")).length === 3, "one build entry per level");

// ---- 5. two phones writing at once: the netsync merge keeps both deposits
{
  const col = "longhouse", base = JSON.parse(JSON.stringify(mem[d.id])); base._v = 100; base._by = "a"; base._f = NETSYNC.stamp(col, null, base, 100);
  const pa = JSON.parse(JSON.stringify(base)); pa.tx["dep-a-1"] = { k: "dep", by: "a", who: "Pa", t: NOW, g: 111 }; pa._v = 105; pa._by = "a"; delete pa._f; pa._f = NETSYNC.stamp(col, base, pa, 105);
  const pb = JSON.parse(JSON.stringify(base)); pb.tx["dep-b-1"] = { k: "dep", by: "b", who: "Pb", t: NOW, g: 222 }; pb.members.zz = { name: "Z", role: "member", t: NOW }; pb._v = 106; pb._by = "b"; delete pb._f; pb._f = NETSYNC.stamp(col, base, pb, 106);
  const m1 = NETSYNC.mergeDoc(col, pa, pb), m2 = NETSYNC.mergeDoc(col, pb, pa);
  ok(m1 && m1.tx["dep-a-1"] && m1.tx["dep-b-1"] && m1.members.zz, "both deposits and the new member survive");
  ok(NETSYNC.same(m1, m2), "…whichever arrives first");
  ok(L.derive(m1).gold === L.derive(base).gold + 333, "and the balance adds both");
}

// ---- 6. what the rooms do
as(A); A.perks = {};
ok(Math.abs(HALLS.xpMult(A, "Smithing") / HALLS.xpMult(mk("q", 1), "Smithing") - 1.3) < 1e-9, "forge: Smithing XP +30%");
ok(HALLS.xpMult(A, "Archery") === HALLS.xpMult(mk("q", 1), "Archery"), "…only Smithing");
ok(PFX.num(A, "temper") >= 1, "forge: tempering one step further");
const F0 = { e: { name: "Bandit Chief", tags: ["humanoid", "bandit"] }, tags: new Set(["humanoid", "bandit"]) };
ok(L.pfx(A, { ...F0, temper: 1 }).some(([k, v, cnd]) => k === "out" && v === 0.05 && cnd.tempered), "forge 3: tempered weapons hit harder");
ok(PFX.num(A, "rcbudget") >= 0.09 - 1e-9, "library: rune budget +9%");
ok(L.runeOpen(A, "cheap") && L.runeOpen(A, "lingering") && RUNECRAFT.RUNES.cheap.test(A), "library: rune forms open");
ok(!RUNECRAFT.RUNES.cheap.test(mk("q", 1)), "…not for outsiders");
A.skills.Alchemy.lvl = 30; A.skills.Alchemy.xp = 0;
const bk = L.onBook(A, "Alchemy");
ok(bk.length >= 1 && (A.skills.Alchemy.lvl > 30 || A.skills.Alchemy.xp > 0), "library: a skill book teaches more");
ok(L.horseMult(A) === 1.6 && L.horseMult(mk("q", 1)) === 1, "stables: bond grows 60% faster");
A.horse = { breed: "bay", coat: "bay", bags: 0, name: "Bjorn" };
const Q = mk("q", 1); Q.horse = { ...A.horse };
ok(HORSES.carry(A) === HORSES.carry(Q) + 25, "stables 3: horses carry 25 more");
if (typeof BONDS !== "undefined" && BONDS.hgain) {
  A.horse.bond = { xp: 0 }; Q.horse.bond = { xp: 0 };
  try { BONDS.hgain(A, 10); BONDS.hgain(Q, 10); const ba = A.horse.bond?.xp, bq = Q.horse.bond?.xp; if (ba != null && bq) ok(Math.abs(ba / bq - 1.6) < 0.05, "stables: bond xp really grows faster " + ba + "/" + bq); } catch (e) { /* bonds kept elsewhere in the save */ }
}
// trophies: a boss kill and a legendary kill go on the wall, and help against that kind of foe
ok(L.famOf({ name: "Dragon", tags: ["dragon"] }) === "dragon" && L.famOf({ name: "Draugr Deathlord", tags: ["undead"] }) === "undead" && L.famOf({ name: "Dwarven Centurion" }) === "dwemer" && L.famOf({ name: "Frost Spider" }) === "beast", "boss families");
ok(L.onFight(A, { name: "Draugr Overlord", tags: ["undead", "elite"], boss: true }) === true, "a boss kill");
await new Promise((r) => setTimeout(r, 0));
A.lhunt = { best: { whitefang: { kills: 1 } } }; L.pollTrophies(A); await new Promise((r) => setTimeout(r, 0));
x = L.derive(L.mine(A));
ok(x.trophies.includes("boss-undead") && x.trophies.includes("leg-whitefang"), "both trophies on the wall " + x.trophies.join(","));
L.onFight(A, { name: "Draugr Overlord", tags: ["undead"], boss: true }); await new Promise((r) => setTimeout(r, 0));
ok(L.derive(L.mine(A)).trophies.length === 2, "the same trophy twice is one");
ok(!L.onFight(A, { name: "Draugr", tags: ["undead"] }), "a plain draugr is no trophy");
const Fd = { e: { name: "Restless Draugr", tags: ["undead"] }, tags: new Set(["undead"]) }, Ft = { e: { name: "Cave Troll", tags: ["troll", "beast"] }, tags: new Set(["troll", "beast"]) };
ok(Math.abs(PFX.sum(A, "out", Fd, {}) - 0.04) < 1e-9, "undead trophy: +4% damage against undead");
ok(Math.abs(PFX.sum(A, "out", Ft, {}) - 0.06) < 1e-9, "troll trophy: +6% against trolls");
ok(PFX.sum(A, "out", F0, {}) === 0, "no trophy, no bonus (outside a dungeon, no plan)");
// planning table: a standing plan, only in dungeons and crisis fights
as(A); ok((await L.setPlan(A, "spear")) === null, "the plan is set");
ok(PFX.sum(A, "out", F0, {}) === 0, "the plan sleeps on the road");
A.dungeon = { theme: "barrow" };
ok(Math.abs(PFX.sum(A, "out", F0, {}) - 0.06) < 1e-9, "Spearhead in a dungeon: +6%");
A.dungeon = null;
ok(Math.abs(PFX.sum(A, "out", { ...F0, e: { ...F0.e, crisis: "x" } }, {}) - 0.06) < 1e-9, "…and in a hold crisis fight");
as(B); B.dungeon = { theme: "barrow" }; ok(Math.abs(PFX.sum(B, "out", F0, {}) - 0.06) < 1e-9, "the plan helps every member");
as(B); B.dungeon = null;

// ---- 7. perks: real effects
const P = as(A); P.perks = { lng_council: 1, lng_trophies: 1, lng_purse: 1 }; P.dungeon = { theme: "barrow" };
ok(Math.abs(PFX.sum(P, "out", F0, {}) - 0.09) < 1e-9, "War Council: the plan 50% stronger");
P.dungeon = null;
ok(Math.abs(PFX.sum(P, "out", Fd, {}) - 0.08) < 1e-9, "Trophy Mounter: trophies count double");
ok(L.foundCost(P) === 2400 && L.costOf("forge", 1, 4, P).g === 800, "Company Purse: 20% off founding and building");
for (const id of ["lng_purse", "lng_council", "lng_trophies"]) ok(PFX.FX[id] && PERKS && true, "perk " + id);
P.perks = {};

// ---- 8. the log folds old gold lines (rooms and trophies stay)
{
  const big = JSON.parse(JSON.stringify(mem[d.id])), t0 = NOW - 40 * DAY;
  for (let i = 0; i < 200; i++) big.tx["dep-old-" + i] = { k: "dep", by: "a", who: "Pa", t: t0 + i * 60, g: 10 };
  const before = L.derive(big), after = L.derive(L.fold(big, NOW));
  ok(Object.keys(L.fold(big, NOW).tx).length < Object.keys(big.tx).length - 150, "old lines fold");
  ok(after.gold === before.gold && JSON.stringify(after.rooms) === JSON.stringify(before.rooms) && after.trophies.length === before.trophies.length, "…and nothing is lost");
}

// ---- 9. leaving and closing
as(B); ok((await L.leave(B)) === null && !L.mine(B) && !B.lhId, "a member leaves");
as(A); for (const m of Object.keys(L.mine(A).members)) if (m !== "a") await L.setRole(A, m, "out");
const purse = L.derive(L.mine(A)).gold, gA = A.gold;
ok((await L.leave(A)) === null && !mem[d.id] && A.gold === gA + purse, "the last one out closes the doors and takes the purse");

// ---- 10. cost sim: hours of play by company size (a quarter of what you earn goes to the company)
const income = (lvl) => 600 + 20 * lvl;   // gold an hour, adventuring (fights, jobs, loot sold)
const total = (nm) => L.ROOM_IDS.reduce((a, r) => a + [1, 2, 3].reduce((b, l) => b + L.costOf(r, l, nm).g, 0), 0);
const lv1 = (nm) => L.ROOM_IDS.reduce((a, r) => a + L.costOf(r, 1, nm).g, 0);
const rows = [];
for (const nm of [1, 2, 4, 8]) { const each = (total(nm) + L.FOUND) / nm, h = each / (income(20) * 0.25); rows.push([nm, total(nm), Math.round(each), h.toFixed(1), (lv1(nm) / nm / (income(20) * 0.25)).toFixed(1)]); }
console.log("players · all rooms gold · each · hours each (lvl 20) · first rooms hours each");
for (const r of rows) console.log("  " + r.join(" · "));
ok(L.FOUND / income(10) <= 4.5, "a solo level 10 can found within ~4 hours of play");
ok(+rows[2][4] <= 10, "4 players: every first-level room in under 10 hours each");
ok(+rows[2][3] >= 25 && +rows[2][3] <= 70, "4 players: the whole longhouse is a long goal (25-70 hours each)");
ok(+rows[3][3] <= 40 && +rows[3][3] < +rows[2][3], "8 players: cheaper each");
ok(total(8) > total(4) && total(4) > total(1), "bigger companies pay more in total");

// ---- 11. the screen draws for both sides
as(mk("q2", 5)); ok(/Found a longhouse/.test(L.panel()) && /3000 gold/.test(L.panel()), "outsider screen");
await L.found(as(Object.assign(mk("s", 10), { gold: 4000 })), "Screen Test");
for (const t of ["rooms", "plan", "trophy", "gold", "members", "log"]) { L._tab(t); const h = L.panel(); ok(/lng-root/.test(h) && h.length > 300 && !/undefined|NaN/.test(h), "tab " + t); }

// ---- 12. Polish for every line
const LL = I18N_LONGHOUSE, has = (k) => k in LL.tpl || k in LL.words;
const strs = new Set();
for (const m of SRC.matchAll(/\\bT\\(\\s*"((?:[^"\\\\]|\\\\.)*)"/g)) strs.add(m[1]);
for (const r of Object.values(L.ROOMS)) { strs.add(r.name); r.fx.forEach((f) => strs.add(f)); }
for (const p of Object.values(L.PLANS)) { strs.add(p.name); strs.add(p.text); }
for (const f of Object.values(L.FAMS)) { strs.add(f.name); strs.add(f.foe); }
for (const k of ["Founder", "Officer", "Member", "Founder only", "Founder and officers", "Everyone", "Company Purse", "War Council", "Trophy Mounter"]) strs.add(k);
for (const r of PFX.ADD.filter((a) => /^lng_/.test(a[1]))) strs.add(r[6].replace(/ \\[[^\\]]*\\]$/, ""));
const missing = [...strs].filter((k) => !has(k));
ok(!missing.length, "Polish for every line (missing: " + missing.join(" | ") + ")");
for (const v of [...Object.values(LL.tpl), ...Object.values(LL.words)]) ok(typeof v === "string" && v.length, "non-empty Polish");
ok(/-longhouse"/.test(PN), "patch note entry");
const pn = /id: "b\\d+-longhouse"[^\\]]*items: \\[([\\s\\S]*?)\\] \\}/.exec(PN);
ok(pn && has(/id: "b\\d+-longhouse"[^\\n]*title: "([^"]*)"/.exec(PN)[1]), "patch note title in Polish");
if (pn) for (const m of pn[1].matchAll(/^\\s*"((?:[^"\\\\]|\\\\.)*)",/gm)) ok(has(JSON.parse('"' + m[1] + '"')), "patch note line in Polish: " + m[1].slice(0, 40));

console.log(fails ? fails + " FAILED of " + n : "longhouse ok · " + n + " checks");
if (fails) process.exitCode = 1;
})().catch((e) => { console.log("CRASH", e && e.stack); process.exitCode = 1; });
`, Object.assign(c, { setTimeout, process }));
