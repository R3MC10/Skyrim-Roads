const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* One queue for pop-ups (notices.js): windows one at a time, duplicates merged, a pushed-off window back in line, and
   the stacking that keeps banners, tips and fight tips off each other and off the key buttons.
   W=/path/to/game/ node test_notices.js — prints "notices ok". */
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String };
vm.createContext(c);
vm.runInContext(fs.readFileSync(__GAME + "notices.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
var n = 0; const ok = (cnd, m) => { n++; if (!cnd) throw new Error("FAIL " + m); };
const N = NOTICES;
// 1. windows: one at a time, in order
{
  const q = N.core(); const shown = [];
  const ask = (k, t, s) => q.ask({ key: k, run: () => shown.push(k) }, t, s);
  ok(ask("a", 0, {}) === "show" && q.cur.key === "a", "a clear screen: it opens at once");
  ok(ask("b", 10, { modal: true, cur: true }) === "queued", "another window is open: it waits");
  ok(ask("c", 20, { modal: true, cur: true }) === "queued", "a third one waits behind it");
  ok(ask("b", 30, { modal: true, cur: true }) === "merged" && q.queue.length === 2 && q.queue[0].n === 2, "the same one twice: shown once");
  ok(ask("a", 40, { modal: true, cur: true }) === "merged", "the same as the one on screen: dropped");
  ok(q.tick(50, { modal: true, cur: true }) === null, "nothing while it's still open");
  ok(q.tick(100, { modal: false, cur: false }) === null && q.cur === null, "closed: a short gap first");
  ok(q.tick(100 + N.GAP, {}).key === "b", "then the next one, in order");
  ok(q.tick(200 + N.GAP, { modal: true, cur: true }) === null, "one at a time");
  q.tick(300 + N.GAP, {}); ok(q.tick(300 + 2 * N.GAP, {}).key === "c" && q.queue.length === 0, "then the last one");
}
// 2. fights, menus and the player's own taps
{
  const q = N.core();
  ok(q.ask({ key: "f" }, 0, { fight: true }) === "queued", "a fight is on: it waits");
  ok(q.ask({ key: "g" }, 0, { fight: true, input: true }) === "queued", "even right after a tap, never under a fight");
  ok(q.tick(1000, { fight: true }) === null, "still fighting: nothing");
  ok(q.tick(2000, { menu: true }) === null, "a menu is open: it waits for that too");
  ok(q.tick(3000, {}).key === "f", "the fight is over: it opens");
  const q2 = N.core();
  q2.ask({ key: "shop" }, 0, {});
  ok(q2.ask({ key: "mine" }, 10, { modal: true, cur: true, input: true }) === "show", "you tapped for it: it opens at once over the old one");
  ok(q2.ask({ key: "x" }, 20, { menu: true }) === "queued", "uninvited, over a menu: it waits");
  ok(q2.ask({ key: "y" }, 30, {}) === "queued", "one already waits: the next keeps its place in line");
}
// 3. a road encounter pushes a waiting message off: it goes back to the front
{
  const q = N.core();
  q.ask({ key: "letter" }, 0, {}); q.ask({ key: "event" }, 5, { modal: true, cur: true });
  ok(q.displaced({}) && q.queue[0].key === "letter" && q.queue[1].key === "event" && q.cur === null, "pushed off: back at the front");
  ok(q.tick(1000, { modal: true }) === null, "it waits for the encounter");
  ok(q.tick(2000, {}).key === "letter", "and opens after it");
  ok(!q.displaced({ input: true }) && q.cur === null, "replaced by your own tap: it was read");
  ok(!N.core().displaced({}), "nothing of ours on screen: nothing to do");
}
// 4. stacking
{
  const V = { top: 0, bottom: 800 };
  const lane = { l: 10, r: 300, t: 10, b: 40, pin: true }, tip = { l: 10, r: 380, t: 20, b: 120, dir: "down" }, ban = { l: 40, r: 350, t: 30, b: 90, dir: "down" };
  const r = N.stack([lane, tip, ban], [], V);
  ok(r[0].dy === 0 && !r[0].hide, "the message lane keeps its spot");
  ok(r[1].dy === 40 - 20 + 6, "the tip slides under the lane " + r[1].dy);
  const tipB = tip.b + r[1].dy;
  ok(r[2].dy === tipB + 6 - ban.t, "the banner slides under the tip " + r[2].dy);
  const boxes = [lane, tip, ban].map((b, i) => ({ l: b.l, r: b.r, t: b.t + r[i].dy, b: b.b + r[i].dy }));
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) ok(!N.hit(boxes[i], boxes[j]), "no two overlap " + i + j);
  const side = N.stack([lane, { l: 320, r: 380, t: 10, b: 40, dir: "down" }], [], V);
  ok(side[1].dy === 0, "side by side: nobody moves");
  const key = { l: 0, r: 400, t: 100, b: 150 };
  const k = N.stack([{ l: 20, r: 200, t: 110, b: 130, dir: "down" }], [key], V);
  ok(k[0].dy === 150 + 6 - 110, "a key button: the notice slides below it");
  const full = N.stack([{ l: 20, r: 200, t: 700, b: 790, dir: "down" }], [{ l: 0, r: 400, t: 690, b: 800 }], V);
  ok(full[0].hide, "no room left: it waits hidden");
  // fight tips go up above the action buttons
  const dock = { l: 0, r: 400, t: 600, b: 800 };
  const f = N.stack([{ l: 100, r: 300, t: 580, b: 640, dir: "up" }], [dock], V);
  ok(f[0].dy === 600 - 6 - 640 && !N.hit({ l: 100, r: 300, t: 580 + f[0].dy, b: 640 + f[0].dy }, dock), "a combo banner on the buttons slides up above them " + f[0].dy);
  const hint = { l: 100, r: 300, t: 500, b: 540, pin: true };
  const f2 = N.stack([hint, { l: 120, r: 280, t: 520, b: 560, dir: "up" }], [dock], V);
  ok(f2[1].dy === 500 - 6 - 560, "and above a pinned first-fight hint too " + f2[1].dy);
}
// 5. no page: windows open at once (node tools, tests)
{ let ran = 0; ok(N.modal("k", () => ran++) === "show" && ran === 1, "no page: it just opens"); }
ok(typeof N.fightTip === "function" && typeof N.opening === "function" && typeof N.layout === "function", "the hooks are there");
console.log("notices ok (" + n + " checks)");
`, c);
