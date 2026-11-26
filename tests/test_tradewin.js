// The live trade window (game/tradewin.js): two phones, each writing only its own record, with records arriving late,
// out of order or not at all. Checks the safety rules: one exchange when both confirm at once, change after Ready clears
// both confirmations, disconnect before confirm gives everything back, disconnect during commit is all or nothing,
// worn / bound items refused, and no item or gold is ever made or lost over 1,000 random trades.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "rarity.js", "names.js", "market.js", "tradewin.js"])
  if (fs.existsSync(__GAME + f)) vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const ok = (c, m) => { if (!c) throw new Error("FAIL " + m); };
const T = TRADEWIN;
D.ITEMS.quest_test = { name: "Old Key", slot: "trophy", value: 5, noTrade: true };
const POT = "potion_health_minor";
const GEMS = Object.keys(D.ITEMS).filter((k) => ["ingredient", "material", "valuable", "scroll", "soulgem"].includes(D.ITEMS[k].slot) && !D.ITEMS[k].noTrade && (D.ITEMS[k].value || 0) >= 1).slice(0, 2);
if (GEMS.length < 2) throw new Error("FAIL no stackable test goods");
const ARMS = Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].slot === "weapon" && !D.ITEMS[k].noTrade).slice(0, 3);
function hero(id) {
  const s = G.newSave(id, id === "A" ? "Alfa" : "Beta", "nord"); s.location = "Whiterun"; s.gold = 500;
  G.give(s, POT, 5); for (const g of GEMS) G.give(s, g, 3); for (const w of ARMS) G.give(s, w, 1); G.give(s, "quest_test", 1);
  const r = G.invRow(s, G.give(s, ARMS[0], 1)); r.tq = 3; r.temper = 3; r.stolen = true;
  return s;
}
/* everything a player owns: pack + what sits in their trade window */
function count(...ss) {
  const m = { gold: 0 };
  for (const s of ss) {
    m.gold += s.gold;
    const rows = [...s.inv, ...((s.lt && s.lt.items) || [])];
    for (const r of rows) m[r.item] = (m[r.item] || 0) + (r.qty || 1);
    if (s.lt && s.lt.gold) m.gold += s.lt.gold;
  }
  return m;
}
const same = (a, b) => JSON.stringify(Object.keys({ ...a, ...b }).sort().map((k) => [k, a[k] || 0])) === JSON.stringify(Object.keys({ ...a, ...b }).sort().map((k) => [k, b[k] || 0]));
const freeRow = (s, item) => s.inv.find((r) => r.item === item && G.freeQty(s, r.id) > 0 && !D.ITEMS[r.item].noTrade);

/* a little network: each phone has its own view of the other's record; posts arrive when deliver() runs */
function net() {
  const box = { A: null, B: null }, q = [], down = { A: false, B: false }; let seq = 0;
  return {   // like the shared store: the newest write wins, an older one arriving late is ignored; a phone that's down hears nothing until it's back
    post(s, t) { if (down[s.id]) return; const d = T.doc(s, t); if (d) q.push({ to: s.id === "A" ? "B" : "A", seq: ++seq, d: JSON.parse(JSON.stringify(d)) }); },
    deliver(n = Infinity) {
      let k = 0;
      while (k < n) {
        const ready = q.filter((m) => !down[m.to]); if (!ready.length) break;
        const m = ready[Math.floor(Math.random() * Math.min(ready.length, 2))]; q.splice(q.indexOf(m), 1);
        if (!box[m.to] || m.seq > box[m.to].seq) box[m.to] = { ...m.d, seq: m.seq };
        k++;
      }
    },
    deliverAll() { this.deliver(); },
    view(id) { return box[id]; }, down, q, box,
  };
}
/* open a trade between a and b on a fresh network */
function openPair(a, b, n, t) {
  ok(T.invite(a, { id: b.id, name: b.name }, "Whiterun", t).ok, "invite");
  n.post(a, t); n.deliverAll();
  ok(T.invitesFor([n.view("B")], "B", t).length === 1, "B sees the invite");
  ok(T.join(b, n.view("B"), t).ok, "join"); n.post(b, t); n.deliverAll();
  T.step(a, n.view("A"), t); ok(a.lt.status === "open", "A opens");
}
const pump = (a, b, n, t) => { for (let i = 0; i < 4; i++) { n.deliverAll(); T.step(a, n.view("A"), t); n.post(a, t); T.step(b, n.view("B"), t); n.post(b, t); } n.deliverAll(); };

// ---- 1. a plain trade, item details carried (forge level, stolen)
{
  const a = hero("A"), b = hero("B"), n = net(), t = 1000, start = count(a, b);
  openPair(a, b, n, t);
  const forged = a.inv.find((r) => r.tq === 3);
  ok(T.add(a, forged.id).ok && T.add(a, freeRow(a, POT).id, 2).ok && T.setGold(a, 50).ok, "A adds");
  ok(a.gold === 450 && !G.invRow(a, forged.id), "A's things leave the pack at once (held)");
  ok(T.add(b, freeRow(b, GEMS[0]).id).ok, "B adds");
  pump(a, b, n, t);
  ok(T.confirm(a, n.view("A")).err, "can't confirm before Ready");
  ok(T.ready(a, n.view("A")).ok && T.ready(b, n.view("B")).ok, "both ready"); pump(a, b, n, t);
  ok(T.confirm(a, n.view("A")).ok, "A confirms"); n.post(a, t); pump(a, b, n, t);
  ok(a.lt.status === "open" && a.lt.confirm, "A waits for B");
  ok(T.cancel(a).err, "A can't pull out after confirming");
  ok(T.add(a, freeRow(a, POT).id).err, "A can't change after confirming");
  ok(T.confirm(b, n.view("B")).ok, "B confirms"); n.post(b, t); pump(a, b, n, t);
  ok(a.lt.status === "done" && b.lt.status === "done", "both done " + a.lt.status + b.lt.status);
  ok(same(count(a, b), start), "nothing made or lost");
  const got = b.inv.find((r) => r.item === ARMS[0] && r.tq === 3);
  ok(got && got.stolen && got.temper === 3, "forge level kept, stolen stays stolen");
  ok(b.gold === 550, "B got the gold");
  // a finished trade stays finished
  const after = count(a, b); for (let i = 0; i < 5; i++) pump(a, b, n, t + i * 100); ok(same(count(a, b), after), "done stays done");
  ok(T.cancel(a).closed, "cancel after done does nothing");
}
// ---- 2. both confirm at the same moment -> exactly one exchange
for (let k = 0; k < 50; k++) {
  const a = hero("A"), b = hero("B"), n = net(), t = 2000, start = count(a, b);
  openPair(a, b, n, t);
  T.add(a, freeRow(a, GEMS[1]).id); T.add(b, freeRow(b, POT).id, 3); T.setGold(b, 20);
  pump(a, b, n, t); T.ready(a, n.view("A")); T.ready(b, n.view("B")); pump(a, b, n, t);
  ok(T.confirm(a, n.view("A")).ok && T.confirm(b, n.view("B")).ok, "both confirm");
  n.post(a, t); n.post(b, t);                 // both records in flight at once
  for (let i = 0; i < 6; i++) { n.deliver(1); T.step(a, n.view("A"), t); T.step(b, n.view("B"), t); n.post(a, t); n.post(b, t); }
  pump(a, b, n, t);
  ok(a.lt.status === "done" && b.lt.status === "done", "both done (same moment)");
  const g = a.gold; T.step(a, n.view("A"), t); T.step(a, n.view("A"), t); ok(a.gold === g, "stepping again pays nothing");
  ok(same(count(a, b), start), "one exchange only " + JSON.stringify(start) + JSON.stringify(count(a, b)) + JSON.stringify([a.lt.got, a.lt.gave, b.lt.got, b.lt.gave]));
}
// ---- 3. a change after Ready clears both confirmations
{
  const a = hero("A"), b = hero("B"), n = net(), t = 3000, start = count(a, b);
  openPair(a, b, n, t);
  T.add(a, freeRow(a, GEMS[0]).id); T.add(b, freeRow(b, GEMS[1]).id); pump(a, b, n, t);
  T.ready(a, n.view("A")); T.ready(b, n.view("B")); pump(a, b, n, t);
  ok(T.confirm(a, n.view("A")).ok, "A confirms"); n.post(a, t); n.deliverAll();
  ok(T.add(b, freeRow(b, POT).id, 1).ok, "B changes after A confirmed"); ok(!b.lt.ready && !b.lt.confirm, "B un-readied");
  n.post(b, t); n.deliverAll(); const r = T.step(a, n.view("A"), t);
  ok(r.flash && !a.lt.ready && !a.lt.confirm, "A's Ready and Confirm cleared, with a flash");
  // B still holding the old view of A's confirm can't finish the trade on it
  T.step(b, n.view("B"), t); ok(b.lt.status === "open", "no swap on an old confirm");
  ok(T.confirm(b, n.view("B")).err, "B can't confirm while A isn't ready");
  ok(T.cancel(a).ok && a.lt.status === "cancel", "A calls it off"); n.post(a, t); pump(a, b, n, t);
  ok(b.lt.status === "cancel", "B's window closes too"); ok(same(count(a, b), start), "all returned");
}
// ---- 4. disconnect before confirm -> everything back after 30 s
{
  const a = hero("A"), b = hero("B"), n = net(), t = 4000, start = count(a, b), sA = count(a), sB = count(b);
  openPair(a, b, n, t);
  T.add(a, freeRow(a, GEMS[0]).id); T.setGold(a, 99); T.add(b, freeRow(b, POT).id, 2); pump(a, b, n, t);
  T.ready(a, n.view("A")); pump(a, b, n, t);
  n.down.B = true;                                         // B's phone drops off
  T.step(a, n.view("A"), t + 20); ok(a.lt.status === "open", "20 s: still waiting");
  T.step(a, n.view("A"), t + 31); ok(a.lt.status === "cancel", "31 s: called off");
  ok(same(count(a), sA), "A has everything back");
  T.step(b, n.view("B"), t + 40); ok(b.lt.status === "cancel" && same(count(b), sB), "B, alone, gives itself everything back too");
  ok(same(count(a, b), start), "nothing lost");
}
// ---- 5. disconnect during the commit -> all or nothing
{
  const a = hero("A"), b = hero("B"), n = net(), t = 5000, start = count(a, b);
  openPair(a, b, n, t);
  T.add(a, freeRow(a, GEMS[0]).id); T.add(b, freeRow(b, GEMS[1]).id); T.setGold(b, 40); pump(a, b, n, t);
  T.ready(a, n.view("A")); T.ready(b, n.view("B")); pump(a, b, n, t);
  T.confirm(b, n.view("B")); n.post(b, t); n.deliverAll();          // B confirms first, A sees it
  T.confirm(a, n.view("A")); T.step(a, n.view("A"), t);            // A confirms and finishes the swap at once
  ok(a.lt.status === "done", "A finished");
  n.down.B = true; n.post(a, t);                                  // ...and B's phone dies before it hears
  for (const dt of [10, 40, 400, 4000]) T.step(b, n.view("B"), t + dt);
  ok(b.lt.status === "wait" && b.lt.items.length, "B waits, its offer still held (not given back)");
  ok(T.cancel(b).err, "B can't call it off while it may have gone through");
  ok(T.invite(b, { id: "C", name: "Cid" }, "x", t + 5000).err, "no new trade while settling");
  n.down.B = false; n.post(a, t + 5000); n.deliverAll(); T.step(b, n.view("B"), t + 5000);
  ok(b.lt.status === "done", "B finishes when it's back"); ok(same(count(a, b), start), "all or nothing: one full swap");
  // other way round: A confirmed, B never did and went away, then came back
  const a2 = hero("A"), b2 = hero("B"), n2 = net(), st2 = count(a2, b2);
  openPair(a2, b2, n2, t);
  T.add(a2, freeRow(a2, GEMS[0]).id); T.add(b2, freeRow(b2, GEMS[1]).id); pump(a2, b2, n2, t);
  T.ready(a2, n2.view("A")); T.ready(b2, n2.view("B")); pump(a2, b2, n2, t);
  T.confirm(a2, n2.view("A")); n2.down.B = true; n2.post(a2, t);
  T.step(a2, n2.view("A"), t + 60); ok(a2.lt.status === "wait", "A (confirmed) keeps it held");
  T.step(b2, n2.view("B"), t + 60); ok(b2.lt.status === "cancel", "B (not confirmed) calls it off");
  n2.down.B = false; n2.post(b2, t + 61); n2.deliverAll(); T.step(a2, n2.view("A"), t + 61);
  ok(a2.lt.status === "cancel", "A gets everything back when B's call-off arrives"); ok(same(count(a2, b2), st2), "nothing lost");
}
// ---- 6. worn, bound and quest things are refused
{
  const a = hero("A"), b = hero("B"), n = net(), t = 6000;
  openPair(a, b, n, t);
  const worn = G.loadout(a).equipment.weapon;
  ok(/wearing/.test(T.add(a, worn).err || ""), "worn gear refused");
  ok(/bound/.test(T.add(a, a.inv.find((r) => r.item === "quest_test").id).err || ""), "bound/quest thing refused");
  ok(!T.sideOk({ items: [{ item: POT, qty: 1, worn: true }], gold: 0 }), "a record that says it holds worn gear is refused");
  ok(!T.sideOk({ items: [{ item: "quest_test", qty: 1 }], gold: 0 }), "a record with a bound thing is refused");
  ok(T.setGold(a, 99999).ok && a.lt.gold === 500 && a.gold === 0, "gold can't go over what you have");
  ok(T.setGold(a, 0).ok && a.gold === 500, "gold back");
  ok(T.warnings({ items: [{ item: GEMS[0], qty: 3 }], gold: 300 }, { items: [], gold: 0 }).length, "warn: nothing back");
}
// ---- 7. no duplication over 1,000 random trades
{
  let finished = 0, swaps = 0; const why = {};
  for (let k = 0; k < 1000; k++) {
    const a = hero("A"), b = hero("B"), n = net(); let t = 10000 + k * 1000;
    const start = count(a, b);
    openPair(a, b, n, t);
    const P = [a, b];
    for (let i = 0; i < 40; i++) {
      const s = P[Math.random() < 0.5 ? 0 : 1], o = s.id, roll = Math.random();
      t += Math.random() < 0.01 ? 35 : Math.random() * 2;
      if (roll < 0.15) { const r = s.inv.filter((x) => G.freeQty(s, x.id) > 0)[Math.floor(Math.random() * s.inv.length)]; if (r) T.add(s, r.id, 1 + Math.floor(Math.random() * 3)); }
      else if (roll < 0.22) T.drop(s, Math.floor(Math.random() * 3));
      else if (roll < 0.3) T.setGold(s, Math.floor(Math.random() * 200));
      else if (roll < 0.5) T.ready(s, n.view(o));
      else if (roll < 0.68) T.confirm(s, n.view(o));
      else if (roll < 0.705) T.cancel(s);
      else if (roll < 0.73) n.down[o] = !n.down[o];
      else if (roll < 0.95) n.deliver(2 + Math.floor(Math.random() * 10));
      T.step(s, n.view(o), t); n.post(s, t);
    }
    // settle: everyone back online, every record delivered; whoever hasn't confirmed calls it off
    n.down.A = n.down.B = false;
    const agree = Math.random() < 0.6;   // most runs try to finish the swap (with records still arriving late), the rest call it off
    for (let r = 0; r < 6; r++) {
      pump(a, b, n, t);
      if (agree) {
        for (const s of P) if (s.lt.status === "open") { T.ready(s, n.view(s.id)); n.post(s, t); }
        n.deliver(1 + Math.floor(Math.random() * 3)); for (const s of P) T.step(s, n.view(s.id), t);
        for (const s of P) if (s.lt.status === "open") { T.confirm(s, n.view(s.id)); T.step(s, n.view(s.id), t); n.post(s, t); }
      } else for (const s of P) if (s.lt.status === "open" && !s.lt.confirm && Math.random() < 0.5) { T.cancel(s); n.post(s, t); }
    }
    for (const s of P) if (s.lt.status === "open" && !s.lt.confirm) { T.cancel(s); n.post(s, t); }
    pump(a, b, n, t); pump(a, b, n, t);
    const end = count(a, b);
    ok(["done", "cancel"].includes(a.lt.status) && ["done", "cancel"].includes(b.lt.status), "run " + k + " ends: " + a.lt.status + "/" + b.lt.status);
    ok(a.lt.status === b.lt.status, "run " + k + ": both phones agree (" + a.lt.status + "/" + b.lt.status + ")");
    ok(same(end, start), "run " + k + ": counts match " + JSON.stringify(start) + " vs " + JSON.stringify(end));
    finished++; if (a.lt.status === "done") swaps++; else why[a.lt.note] = (why[a.lt.note] || 0) + 1;
  }
  console.log("random trades:", finished, "finished,", swaps, "swaps", JSON.stringify(why));
}
console.log("tradewin ok");
`, c);
