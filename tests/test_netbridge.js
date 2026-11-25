// Signed-in and signed-out players see each other (store.js bothLines). Signed in, a phone uses the server world AND the
// phone-to-phone world at once; before, the two were separate worlds and friends vanished for each other after one of
// them signed in. Three phones, each with its own store.js:
//   A signed in on a new build (server + phones), B signed out (phones only), C signed in on an old build (server only).
//   node test_netbridge.js        (W=/path/to/game/ for another copy of the game)
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
let n = 0, fails = 0;
const ok = (v, m) => { n++; if (!v) { fails++; console.log("FAIL", m); } };
const src = (f) => fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 =");

/* a line everyone on it can hear (the server hub or the phone mesh); messages wait in a queue until run() */
function makeLine(kind) {
  const q = [], rooms = new Map(); let next = 1;
  const line = {
    run() { for (let i = 0; i < 5000 && q.length; i++) q.shift()(); },
    transport: () => ({
      name: kind,
      join(code, h) {
        const me = kind === "server" ? next++ : kind + "-" + next++;   // the server numbers its peers, the phones use strings
        if (!rooms.has(code)) rooms.set(code, new Map());
        const ends = rooms.get(code);   // one room per world code
        for (const [other, oh] of ends) { q.push(() => oh.onJoin(me)); q.push(() => h.onJoin(other)); }
        ends.set(me, h);
        return {
          send(data, to) {
            const copy = JSON.parse(JSON.stringify(data));
            for (const [other, oh] of ends) if (other !== me && (to == null || String(other) === String(to))) q.push(() => oh.onMessage(copy, String(me)));
          },
          leave() { ends.delete(me); for (const [, oh] of ends) q.push(() => oh.onLeave(String(me))); },
          direct: () => ends.size - 1,
        };
      },
    }),
  };
  return line;
}

function makePhone(name, { server, phones }) {
  const mem = { "sk.uid": JSON.stringify(name) };
  const c = { console, Math, JSON, Object, Array, Set, Map, Number, String, Promise, Error, Date,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, addEventListener() {},
    location: { search: "" }, localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } } };
  c.window = c;
  if (phones) c.P2PNET = phones.transport();
  if (server) c.SERVERNET = { ...server.transport(), on: () => true };
  vm.createContext(c);
  for (const f of ["store.js", "netsync.js"]) vm.runInContext(src(f), c);
  return c;
}

(async () => {
  const srv = makeLine("server"), mesh = makeLine("phones");
  const run = () => { for (let i = 0; i < 20; i++) { srv.run(); mesh.run(); } };
  const A = makePhone("A", { server: srv, phones: mesh });   // signed in, this build
  const B = makePhone("B", { phones: mesh });                // signed out
  const C = makePhone("C", { server: srv });                 // signed in, older build (server only)
  for (const p of [A, B, C]) await p.Store.init();
  run();
  for (const [p, nm] of [[A, "Alfa"], [B, "Beta"], [C, "Cara"]]) await p.Store.publish({ name: nm, level: 3, x: 0.5, y: 0.5, updated: Date.now() });
  run();
  const sees = (p) => { let names = []; p.Store.watchPlayers((ps) => { names = ps.map((x) => x.name).sort(); }); return names; };
  ok(A.Store.mode === "p2p", "A plays in the shared world");
  ok(sees(A).join() === "Beta,Cara", "signed-in A sees signed-out Beta and signed-in Cara: " + sees(A));
  ok(sees(B).includes("Alfa"), "signed-out B sees signed-in Alfa: " + sees(B));
  ok(sees(C).includes("Alfa"), "old signed-in C still sees Alfa through the server: " + sees(C));
  ok(A.Store.peers === 2 && B.Store.peers >= 1, "online counts: A " + A.Store.peers + ", B " + B.Store.peers);

  // a record written by the signed-out player reaches the signed-in one, and the other way round
  B.Store.put("chat", "c1", { from: "B", text: "hi from the road", t: 1 });
  A.Store.put("chat", "c2", { from: "A", text: "hi from the server", t: 2 });
  run();
  const chat = (p) => { let t = []; p.Store.watch("chat", (d) => { t = d.map((x) => x.text).sort(); }); return t; };
  ok(chat(A).includes("hi from the road"), "A gets B's chat line");
  ok(chat(B).includes("hi from the server"), "B gets A's chat line");
  ok(chat(C).includes("hi from the server"), "C gets A's chat line through the server");

  // A goes away: everyone stops listing it
  A.Store.joinWorld("ELSEWHERE"); run();
  ok(!sees(B).includes("Alfa") && !sees(C).includes("Alfa"), "A left: B and C no longer list Alfa");

  console.log(fails ? `${fails} of ${n} netbridge checks FAILED` : `all ${n} netbridge checks passed`);
  process.exit(fails ? 1 : 0);
})();
