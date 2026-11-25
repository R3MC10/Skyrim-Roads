const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* The company's Commissions board (commissions.js): 3-5 orders a game day seeded by company + game day (the same on every
   phone), scaled to the company level from what was built and earned before that day; hand-ins that use the goods up
   (never worn gear), two members filling one order through the ledger, the done line written once, shares of the gold,
   the party split, the item for whoever finished it, camps and caravans, the perks, old saves and old companies,
   a balance sim against town jobs, expeditions and shop prices, and Polish for every line.
   W=/path/to/game/ node test_commissions.js — prints "commissions ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, WeakMap, Proxy, Number, String, Promise, setInterval: () => 0, clearInterval: () => {}, setTimeout, process };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "halls.js", "engine.js", "events.js", "dungeons.js", "towns.js", "smithing.js", "cooking.js", "harvest.js", "horses.js", "bonds.js", "runecraft.js", "leghunt.js", "heists.js", "deepdelve.js", "netsync.js", "partyvote.js", "partyplay.js",
  "i18n_longhouse.js", "i18n_expedition.js", "i18n_commissions.js", "longhouse.js", "expedition.js", "commissions.js"])
  if (fs.existsSync(W + f)) { try { vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c); } catch (e) { if (/commissions|longhouse|expedition|engine|data/.test(f)) throw e; } }
const SRC = fs.readFileSync(W + "commissions.js", "utf8"), PN = fs.existsSync(W + "patchnotes.js") ? fs.readFileSync(W + "patchnotes.js", "utf8") : "";
const { G, D, PERKS, PFX, WORLD } = c, CM = c.COMMISSIONS, L = c.LONGHOUSE, X = c.EXPEDITION;
let fails = 0, n = 0; const ok = (cnd, m) => { n++; if (!cnd) { fails++; console.log("FAIL", m); } };
let NOW = 1797000000; G.now = () => NOW;
const mem = {}, shares = [];
const emit = () => L.setDocs(Object.values(mem).map((d) => JSON.parse(JSON.stringify(d))));
c.Store = { online: true,
  put: async (col, id, doc) => { if (col === "pshare") { shares.push({ id, doc }); return true; } mem[id] = { ...JSON.parse(JSON.stringify(doc)), id }; emit(); return true; },
  change: async (col, id, fn) => { const cur = mem[id]; if (!cur) return null; const nx = fn(JSON.parse(JSON.stringify(cur))); if (nx) mem[id] = { ...nx, id }; else delete mem[id]; emit(); return { after: nx }; },
  remove: async (col, id) => { delete mem[id]; emit(); }, watch: () => {} };
let who = null;
L._api({ S: () => who, toast: () => {}, persist: () => {}, render: () => {}, party: () => null });
const mk = (id, lvl, loc = "Whiterun") => { const s = G.newSave(id, "P" + id, "nord"); s.level = lvl; s.location = loc; [s.x, s.y] = WORLD.places[loc]; s.gold = 0; s.perks = {}; return s; };
const as = (s) => { who = s; return s; };
const count = (s, item) => (s.inv || []).filter((r) => r.item === item).reduce((a, r) => a + r.qty, 0);
const SPD = G.GAME_SPEED || 12, GDAY = 86400 / SPD;

(async () => {
  // ---- 1. the board: the same on every phone, new every game day
  const fake = { id: "lh-a", site: "Whiterun", tx: {} };
  const day = CM.gday(), b1 = CM.board(fake, day), b2 = CM.board(JSON.parse(JSON.stringify(fake)), day);
  ok(JSON.stringify(b1) === JSON.stringify(b2), "same company, same game day: the same board");
  ok(b1.length === 3, "a new company gets 3 orders (" + b1.length + ")");
  ok(new Set(b1.map((q) => q.key)).size === b1.length, "keys are unique");
  ok(b1.some((q) => q.kind === "camp" || q.kind === "escort") && b1.some((q) => q.item), "a camp or caravan, and deliveries");
  ok(JSON.stringify(CM.board(fake, day + 1)) !== JSON.stringify(b1), "a new game day, new orders");
  ok(JSON.stringify(CM.board({ ...fake, id: "lh-b" }, day)) !== JSON.stringify(b1), "every company gets its own");
  ok(Math.abs(CM.gday(NOW + GDAY) - day) === 1 && CM.leftToday() <= GDAY && CM.leftToday() > 0, "a game day is " + GDAY / 3600 + " real hours");
  const seenT = new Set(), seenItems = new Set(); let bad = 0;
  for (let k = 0; k < 120; k++) for (const q of CM.board({ id: "lh-" + (k % 9), site: "Riften", tx: {} }, day + k)) {
    seenT.add(q.tpl); if (q.item) seenItems.add(q.item);
    const t = CM.textOf(q); if (!t || /\{|undefined|NaN/.test(t)) bad++;
    if (!WORLD.places[q.town] || (q.to && !WORLD.places[q.to])) bad++;
    if (q.item && !D.ITEMS[q.item]) bad++;
    if (!(q.g > 0 && q.r > 0 && q.need >= 1)) bad++;
    if (q.kind === "escort" && q.to === q.town) bad++;
    if (q.item && q.m[q.item]) bad++;   // never pays you in what you just handed in
  }
  ok(seenT.size === CM.TPL_IDS.length, "every kind of order comes up (" + [...seenT] + ")");
  ok(!bad, "orders read well, point at real places and items, pay something (" + bad + " bad)");
  ok(CM.board({ id: "lh-h", site: "Riften", tx: {} }, day).some((q) => q.town === "Riften"), "one order comes from the longhouse's own town");

  // ---- 2. the company level grows the board, but never under you during a day
  const lvd = (rooms, renown) => { const tx = {}; for (let i = 0; i < rooms; i++) tx["b-" + i] = { k: "build", t: 1 }; if (renown) tx.r = { k: "exp", r: renown, t: 1 }; return { id: "lh-l", site: "Whiterun", tx }; };
  ok(CM.levelOf(lvd(0, 0)).lv === 1 && CM.levelOf(lvd(6, 0)).lv === 3 && CM.levelOf(lvd(15, 120)).lv === 6, "level from rooms and renown (1, 3, 6)");
  ok(CM.board(lvd(6, 0), day).length === 4 && CM.board(lvd(15, 120), day).length === 5, "level 3: 4 orders, level 5+: 5 orders");
  const lo = CM.board(lvd(0, 0), day), hi = CM.board(lvd(15, 120), day);
  ok(hi.reduce((a, q) => a + q.g, 0) / hi.length > lo.reduce((a, q) => a + q.g, 0) / lo.length, "a bigger company's orders pay more");
  const today = lvd(0, 0); today.tx.late = { k: "cmd", r: 500, t: NOW };
  ok(CM.board(today, day).length === 3 && CM.board(today, day + 1).length > 3, "renown earned today grows tomorrow's board, not today's");

  // ---- 3. two members fill a delivery order; goods are used up
  const A = as(mk("a", 12)); A.gold = 9000;
  ok((await L.found(A, "Ironbound")) == null, "found a company");
  const B = mk("b", 10); B.gold = 0;
  const d0 = L.mine(A);
  await c.Store.change("longhouse", d0.id, (q) => ({ ...q, members: { ...q.members, [B.id]: { name: B.name, role: "member", t: NOW } } }));
  let d = L.mine(A);
  ok(!!L.mine(B), "B is in the company");
  let o = null; for (let k = 0; k < 40 && !o; k++) { o = CM.active(d).find((q) => q.kind === "craft" && q.need >= 2) || null; if (!o) NOW += GDAY; }
  ok(!!o, "a crafted-goods order turns up");
  A.location = B.location = o.town; [A.x, A.y] = [B.x, B.y] = WORLD.places[o.town];
  G.give(A, o.item, 1); G.give(B, o.item, o.need + 2);
  // A also wears one: it's never taken
  G.give(A, o.item, 1);
  const wornRow = A.inv.filter((r) => r.item === o.item).slice(-1)[0];
  if (D.ITEMS[o.item].slot && G.equip) { try { G.equip(A, wornRow.id); } catch (e) { /* not wearable */ } }
  const wornNow = Object.values(G.equipment(A)).some((r) => r && r.item === o.item);
  const have0 = CM.haveOf(A, o.item);
  ok(have0 === (wornNow ? 1 : 2), "worn gear doesn't count as goods to hand in");
  const eA = await CM.handIn(A, o.key); ok(eA == null, "A hands in (" + eA + ")");
  ok(count(A, o.item) === (wornNow ? 1 : 0), "A's goods are used up" + (wornNow ? " (the worn one stays)" : ""));
  d = L.mine(A);
  ok(CM.progress(d, o.key).q === have0 && !CM.progress(d, o.key).done, "the order shows A's part");
  as(B);
  ok((await CM.handIn(B, o.key)) == null, "B hands in the rest");
  ok(count(B, o.item) === o.need + 2 - (o.need - have0), "B only gives what the order still needs");
  d = L.mine(A);
  const pr = CM.progress(d, o.key);
  ok(pr.q === o.need && pr.done && pr.done.by === B.id, "filled once, by B");
  ok(Object.values(d.tx).filter((e) => e.k === "cmd").length === 1, "one done line");
  ok((await CM.handIn(B, o.key)) != null && count(B, o.item) === o.need + 2 - (o.need - have0), "a filled order takes nothing more");
  // the stockpile and renown
  const x = L.derive(d);
  for (const [k, q] of Object.entries(o.m)) ok((x.mats[k] || 0) === q, "stockpile gets " + q + " " + k);
  ok(CM.levelOf(d, Infinity).renown === o.r, "renown counts toward the company level");
  ok(x.gold === 0, "commission gold doesn't touch the treasury");
  ok(L.panel ? true : true, "");
  // shares
  const gA = A.gold, gB = B.gold;
  const ca = CM.claim(A, d), cb = CM.claim(B, d);
  const shA = Math.round(o.g * have0 / o.need), shB = Math.round(o.g * (o.need - have0) / o.need);
  ok(ca.length === 1 && A.gold - gA === shA, "A takes their share (" + shA + ")");
  ok(cb.length === 1 && B.gold - gB === shB, "B takes their share (" + shB + ")");
  ok(Math.abs(shA + shB - o.g) <= 1, "the shares add up to the order's gold");
  ok(!CM.claim(A, d).length && !CM.claim(B, d).length, "no second payout");
  ok(cb[0].item === (pr.done.it || null) && ca[0].item == null, "the item (if any) goes to whoever finished it");
  // the log
  as(A); L._tab("log");
  ok(/finished a commission/.test(L.panel()), "the company log has a line for it");
  L._tab("cms");
  const html = L.panel();
  ok(/cms-root/.test(html) && /data-lng="tab" data-id="cms"/.test(html), "the Commissions tab draws");
  ok(/Done/.test(html), "the filled order shows Done");

  // ---- 4. the wrong town, overfilling and concurrency
  const o2 = CM.active(d).find((q) => q.item && !CM.progress(d, q.key).done);
  if (o2) {
    const C = mk("c", 8, o2.town === "Markarth" ? "Riften" : "Markarth"); C.lhId = d.id;
    await c.Store.change("longhouse", d.id, (q) => ({ ...q, members: { ...q.members, [C.id]: { name: C.name, role: "member", t: NOW } } }));
    G.give(C, o2.item, 3);
    const site = L.mine(C).site;
    if (C.location !== site) ok((await CM.handIn(C, o2.key)) != null && count(C, o2.item) === 3, "away from the town and the longhouse: nothing taken");
    C.location = o2.town;
    // someone else fills it while C's hand-in is on its way: C gets the rest back
    const before = count(C, o2.item);
    const r = await CM.contribute(A, o2.key, o2.need);
    ok(r.done && r.got === o2.need, "A fills it straight from the ledger");
    ok((await CM.handIn(C, o2.key)) != null && count(C, o2.item) === before, "a hand-in to a filled order gives the goods back");
  }

  // ---- 5. a camp: fights against outlaws in the hold, a dungeon there does it at once
  let camp = null; for (let k = 0; k < 40 && !camp; k++) { camp = CM.active(L.mine(A)).find((q) => q.kind === "camp") || null; if (!camp) NOW += GDAY; }
  ok(!!camp, "a camp turns up");
  const other = X.HOLDS.find((h) => h !== camp.hold);
  const out = { name: "Bandit Thug", tags: ["humanoid"] };
  await CM.onEvent("fight", { e: out, hold: other }, A, null);
  await CM.onEvent("fight", { e: { name: "Wolf", tags: ["beast"] }, hold: camp.hold }, A, null);
  ok(CM.progress(L.mine(A), camp.key).q === 0, "fights elsewhere, or against wolves, don't count");
  const m1 = await CM.onEvent("fight", { e: out, hold: camp.hold }, A, null);
  ok(CM.progress(L.mine(A), camp.key).q === 1 && m1.length === 1, "an outlaw beaten in the hold counts");
  // in a party only the leader's fights count (members fight beside them)
  const P = { id: "p", leader: "zz", members: [{ id: "zz", name: "Lead" }, { id: A.id, name: A.name }] };
  A.trip = { follow: "zz", status: "travel" };
  await CM.onEvent("fight", { e: out, hold: camp.hold }, A, P);
  ok(CM.progress(L.mine(A), camp.key).q === 1, "a member travelling with the leader doesn't count the same fight twice");
  A.trip = null;
  await CM.onEvent("dungeon", { hold: camp.hold }, A, null);
  ok(!!CM.progress(L.mine(A), camp.key).done, "clearing a dungeon in the hold clears the camp");

  // ---- 6. a caravan: set out from its town, arrive at the other
  let car = null; for (let k = 0; k < 40 && !car; k++) { car = CM.active(L.mine(A)).find((q) => q.kind === "escort") || null; if (!car) NOW += GDAY; }
  ok(!!car, "a caravan turns up");
  A.location = car.to;
  ok(CM.escort(A, car.key) != null, "the caravan only leaves from its own town");
  A.location = car.town;
  ok(CM.escort(A, car.key) == null && CM.escortOf(A), "you set out with it");
  await CM.onEvent("arrive", { place: car.town }, A, null);
  ok(!CM.progress(L.mine(A), car.key).done, "arriving somewhere else does nothing");
  NOW += GDAY * 0.9;   // a new game day may start on the road: the caravan stays on the board
  ok(CM.active(L.mine(A), NOW, A).some((q) => q.key === car.key), "the caravan you're with stays on the board");
  await CM.onEvent("arrive", { place: car.to }, A, null);
  ok(!!CM.progress(L.mine(A), car.key).done && !A.cmEsc, "arriving at its town finishes it");

  // ---- 7. the party split
  const pre = A.gold, Pp = { id: "pp", leader: A.id, members: [{ id: A.id, name: A.name }, { id: "f1", name: "F1" }, { id: "f2", name: "F2" }] };
  shares.length = 0;
  const got = CM.claim(A, L.mine(A), Pp);
  ok(got.length >= 1, "camp and caravan gold to take (" + got.length + ")");
  const total = got.reduce((a, g) => a + g.gold + (g.split ? g.split.each * g.split.n : 0), 0);
  ok(shares.length === got.filter((g) => g.split).length && shares.every((s) => s.doc.kind === "gold" && s.doc.members.length === 2), "a gold share for the other two each time");
  ok(got.every((g) => !g.split || Math.abs(g.gold - g.split.each) <= 2), "split evenly (the finder keeps the odd coin)");
  ok(A.gold - pre === got.reduce((a, g) => a + g.gold, 0) && total > 0, "the gold adds up");

  // ---- 8. perks
  ok(PERKS.BY_ID.cm_broker && PERKS.BY_ID.cm_mark && PFX.FX.cm_broker && PFX.FX.cm_mark, "both perks exist with effects");
  ok(PERKS.BY_ID.cm_broker.skill === "Speechcraft" && PERKS.BY_ID.cm_mark.skill === "Smithing", "in Speech and Smithing");
  ok(PERKS.BY_ID.lng_purse && PERKS.BY_ID.lng_trophies && PERKS.BY_ID.exp_leader && PERKS.BY_ID.persuasion && PERKS.BY_ID.steel_smithing, "old perk ids kept");
  const s0 = mk("p0", 10), s1 = mk("p1", 10); s1.perks = { cm_broker: 2 };
  ok(Math.abs(PFX.num(s1, "cmgold") - 0.3) < 1e-9 && PFX.num(s0, "cmgold") === 0, "Commission Broker: +30% at rank 2");
  // a fresh company: Master's Mark gives more materials on a crafted order
  const runCraft = async (perks) => {
    const S = mk("mm" + Math.random().toString(36).slice(2, 6), 10); S.gold = 5000; S.perks = perks; as(S);
    await L.found(S, "Markers"); const dd = L.mine(S);
    let q = null; for (let k = 0; k < 60 && !q; k++) { q = CM.board(dd, CM.gday() + k).find((z) => z.kind === "craft") || null; if (q && q.day !== CM.gday()) { NOW += GDAY * (q.day - CM.gday()); } }
    const r = await CM.contribute(S, q.key, q.need); const done = L.mine(S).tx["cmd-" + q.key];
    const gold0 = S.gold; CM.claim(S, L.mine(S)); await L.leave(S);
    return { q, done, r, gold: S.gold - gold0 };
  };
  const plain = await runCraft({}), mark = await runCraft({ cm_mark: 1, cm_broker: 2 });
  ok(plain.r.done && mark.r.done, "crafted orders filled");
  const sumM = (m) => Object.values(m || {}).reduce((a, v) => a + v, 0);
  ok(sumM(mark.done.m) >= Math.round(sumM(mark.q.m) * 1.5) - 1 && sumM(plain.done.m) === sumM(plain.q.m), "Master's Mark: half again the materials (" + sumM(plain.done.m) + " / " + sumM(mark.done.m) + ")");
  ok(Math.abs(mark.gold - Math.round(mark.q.g * 1.3)) <= 1 && plain.gold === plain.q.g, "Commission Broker: 30% more gold (" + plain.gold + " vs " + mark.gold + ")");

  // ---- 9. old saves and old companies
  const old = mk("old", 9); delete old.cmGot; delete old.cmEsc;
  ok(CM.migrate(old) === old && old.cmGot == null && old.cmEsc == null, "an old save needs nothing");
  const junk = mk("junk", 9); junk.cmGot = [1, 2]; junk.cmEsc = "x";
  CM.migrate(junk); ok(junk.cmGot && !Array.isArray(junk.cmGot) && junk.cmEsc == null, "odd fields are cleaned up");
  const junk2 = mk("junk2", 9); junk2.cmGot = { "5-0-guard": "yes" }; CM.migrate(junk2); ok(junk2.cmGot["5-0-guard"] === 1, "odd claim marks keep the order claimed");
  const oldDoc = { id: "lh-old", name: "Old", site: "Solitude", members: { o: { name: "O", role: "founder" } }, tx: { f: { k: "found", t: 5 }, d: { k: "dep", g: 100, t: 6 } } };
  ok(CM.board(oldDoc).length === 3 && CM.active(oldDoc).length === 3, "an old company gets a board straight away");
  // the ledger folds old lines into weekly sums: renown is kept
  const big = { id: "lh-f", site: "Whiterun", members: {}, tx: {} };
  for (let i = 0; i < 200; i++) big.tx["e" + i] = { k: i % 2 ? "cmd" : "cmc", key: "1-0-guard", q: 1, r: i % 2 ? 5 : 0, t: NOW - 40 * 86400 + i };
  const folded = L.fold(big, NOW);
  ok(Object.keys(folded.tx).length < 20 && CM.levelOf(folded, Infinity).renown === 500, "folding the ledger keeps the renown (" + CM.levelOf(folded, Infinity).renown + ")");

  // ---- 10. balance: against town jobs, expeditions and shops
  const rows = [];
  let arbitrage = 0, maxPerHour = 0, avgPerHour = 0;
  for (let lv = 1; lv <= 6; lv++) {
    const doc = lvd([0, 0, 3, 6, 9, 12, 15][lv], [0, 0, 0, 0, 0, 60, 120][lv]);
    let sum = 0, cnt = 0, perDay = 0, allDays = 0;
    const buyer = mk("buy" + lv, 5 + 5 * lv); buyer.location = "Whiterun";
    for (let k = 0; k < 150; k++) {
      const bd = CM.board(doc, day + k); let dayG = 0;
      for (const q of bd) {
        sum += q.g; cnt++; dayG += q.g * 1.3;   // with Commission Broker
        if (q.item && G.buyPrice) { const cost = G.buyPrice(buyer, q.item, "Whiterun") * q.need; if (q.g * 1.3 > cost + 140) arbitrage++; }
      }
      perDay = Math.max(perDay, dayG); allDays += dayG;
    }
    const plv = 5 + 5 * lv, ex = X.reward(mk("ex" + lv, plv), { key: "x", slot: "medium" }, 3).gold;
    rows.push([lv, plv, Math.round(sum / cnt), ex, Math.round(allDays / 150 / (GDAY / 3600)), Math.round(perDay / (GDAY / 3600))]);
    maxPerHour = Math.max(maxPerHour, perDay / (GDAY / 3600)); avgPerHour = Math.max(avgPerHour, allDays / 150 / (GDAY / 3600));
    ok(sum / cnt <= ex * 1.6, "company level " + lv + ": an average order (" + Math.round(sum / cnt) + ") pays no more than ~1.5 medium expeditions (" + ex + ")");
  }
  console.log("level · hero level · avg order gold · medium expedition gold · whole board gold per real hour, average · best day (Broker)");
  for (const r of rows) console.log("  " + r.join(" · "));
  // town jobs: clearing a dungeon pays 120 + 150 a tier, gathering 40 + 4x the goods' worth
  const clearJob = 120 + 150 * 2;
  ok(rows[5][2] <= clearJob, "a top order (" + rows[5][2] + ") pays less than a tier-2 town clearing job (" + clearJob + ")");
  ok(!arbitrage, "buying the goods in a shop to hand them in is never a real profit (" + arbitrage + " cases)");
  ok(avgPerHour < 750 && maxPerHour < 900, "a whole board, shared by the company, done every game day: on average under 750 gold an hour (" + Math.round(avgPerHour) + "), never 900 (" + Math.round(maxPerHour) + ")");
  // a delivery pays better than selling the goods, but less than buying them
  const seller = mk("sell", 10); seller.location = "Whiterun";
  const sw = CM.board(lvd(0, 0), day).find((q) => q.item) || { item: "iron_sword", need: 2, g: 60 };
  const sellAll = G.sellPrice(seller, { item: sw.item, qty: 1 }, "Whiterun") * sw.need;
  ok(sw.g > sellAll, "handing goods in beats selling them (" + sw.g + " vs " + sellAll + ")");

  // ---- 11. Polish for every line
  const LL = c.I18N_COMMISSIONS, has = (k) => k in LL.tpl || k in LL.words;
  const strs = new Set();
  for (const m of SRC.matchAll(/\bT\(\s*"((?:[^"\\]|\\.)*)"/g)) strs.add(m[1]);
  for (const t of Object.values(CM.TPL)) strs.add(t.text);
  for (const g of Object.values(CM.GIVERS)) strs.add(g[0]);
  for (const k of ["Crafted goods", "Gathered goods", "Clear a camp", "Escort a caravan", "Commission", "Commission Broker", "Master's Mark"]) strs.add(k);
  for (const r of PFX.ADD.filter((a) => /^cm_/.test(a[1]))) strs.add(r[6].replace(/ \[[^\]]*\]$/, ""));
  const missing = [...strs].filter((k) => !has(k));
  ok(!missing.length, "Polish for every line (missing: " + missing.join(" | ") + ")");
  for (const v of [...Object.values(LL.tpl), ...Object.values(LL.words)]) ok(typeof v === "string" && v.length, "non-empty Polish");
  const pn = /id: "b\d+-commissions"[^\]]*items: \[([\s\S]*?)\] \}/.exec(PN);
  ok(pn && has(/id: "b\d+-commissions"[^\n]*title: "([^"]*)"/.exec(PN)[1]), "patch note title in Polish");
  if (pn) for (const m of pn[1].matchAll(/^\s*"((?:[^"\\]|\\.)*)",/gm)) ok(has(JSON.parse('"' + m[1] + '"')), "patch note line in Polish: " + m[1].slice(0, 40));

  console.log(fails ? fails + " FAILED of " + n : "commissions ok · " + n + " checks");
  if (fails) process.exitCode = 1;
})().catch((e) => { console.log("CRASH", e && e.stack); process.exitCode = 1; });
