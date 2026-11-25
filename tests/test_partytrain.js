// PARTYTRAIN: a party travelling together is drawn as a line (leader in front, then party order, spaced along the
// road walked), lined up in a row beside a town when standing there; strangers and far-off members are left alone
const W = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const c = { Math, Map, Set, Array, Object, isFinite, console, module: undefined };
vm.createContext(c);
const html = fs.readFileSync(W + "index.html", "utf8");
if (!/<script src="partytrain\.js"><\/script>\s*<script src="map\.js">/.test(html)) throw new Error("FAIL partytrain.js must load right before map.js");
if (!html.includes('<script src="i18n_partytrain.js">')) throw new Error("FAIL i18n_partytrain.js not loaded");
vm.runInContext(fs.readFileSync(W + "partytrain.js", "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
const T = c.PARTYTRAIN;
let n = 0;
const ok = (cond, m) => { if (!cond) throw new Error("FAIL " + m); n++; };
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const near = (a, b, e = 1e-6) => d(a, b) < e;

// along: spots at gap, 2·gap, … measured along the road behind the front, carrying on past its end
{
  const sp = T.along([100, 0], [[100, 0], [50, 0], [50, 50]], 4, 30);
  ok(sp.length === 4, "4 spots");
  ok(near(sp[0], [70, 0]) && near(sp[1], [50, 10]) && near(sp[2], [50, 40]), "spots follow the bend of the road");
  ok(near(sp[3], [50, 70]), "past the end it carries on the same way");
  const free = T.along([0, 0], [], 2, 10, [-1, 0]);
  ok(near(free[0], [-10, 0]) && near(free[1], [-20, 0]), "no road: falls back on the given direction");
  const up = T.along([0, 0], [[0, 0], [0, -100]], 2, 20, undefined, 1.5);
  ok(near(up[0], [0, -30]) && near(up[1], [0, -60]), "a road up the map spaces the line out more (figures are tall)");
  const across = T.along([0, 0], [[0, 0], [100, 0]], 1, 20, undefined, 1.5);
  ok(near(across[0], [20, 0]), "across the map the gap is as given");
  const dup = T.along([5, 5], [[5, 5], [5, 5]], 1, 10, [0, 1]);
  ok(near(dup[0], [5, 15]), "zero-length road bits are skipped");
}
// group + place on the road: leader first, then party order; far members and strangers stay where they are
{
  const party = { leader: "L", ids: ["L", "A", "me", "B", "far"] };
  const walkers = [
    { id: "me", pos: [200, 100], moving: true }, { id: "B", pos: [201, 100], moving: true },
    { id: "L", pos: [200.5, 100], moving: true }, { id: "A", pos: [199, 101], moving: true }, { id: "far", pos: [400, 300], moving: true },
  ];
  const g = T.group(walkers, party, "me", 8);
  ok(g.map((w) => w.id).join() === "L,A,me,B", "order: leader, then party order, far member left out");
  const behind = [[200.5, 100], [150, 100], [100, 100]];
  const m = T.place(walkers, { party, me: "me", behind, gap: 20, near: 8, first: 10 });
  ok(m.size === 4 && !m.has("far"), "four in the line");
  ok(near(m.get("L"), [200.5, 100]), "the leader stays on their own spot in front");
  ok(near(m.get("A"), [180.5, 100]) && near(m.get("me"), [160.5, 100]) && near(m.get("B"), [140.5, 100]), "the rest one behind another on the road");
  const spots = [...m.values()];
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) ok(d(spots[i], spots[j]) >= 19.9, "no two figures closer than the gap");
  // zoomed out: the gap (screen px × map units per px) is bigger, so the line stays readable
  const z = T.place(walkers, { party, me: "me", behind, gap: 60, near: 60, first: 10 });
  ok(near(z.get("B"), [100, 100].map((v, i) => (i ? 100 : 20.5))), "zoomed out the line keeps its screen spacing and runs on past the road");
}
// no leader in sight: you lead the line; alone (or only strangers): no line at all
{
  const party = { leader: "gone", ids: ["gone", "me", "A"] };
  const m = T.place([{ id: "me", pos: [0, 0] }, { id: "A", pos: [1, 1] }], { party, me: "me", behind: [], gap: 10, near: 8, first: 5 });
  ok(near(m.get("me"), [0, 0]) && m.has("A"), "without the leader you are in front");
  ok(T.place([{ id: "me", pos: [0, 0] }], { party, me: "me", behind: [], gap: 10, near: 8, first: 5 }).size === 0, "alone: nothing to line up");
  const solo = T.place([{ id: "me", pos: [0, 0] }, { id: "A", pos: [1, 1] }], { party: null, me: "me", behind: [], gap: 10, near: 8, first: 5 });
  ok(solo.size === 0, "no party: only party members ever line up");
}
// standing in a town: a row to the right of the town's icon, leader nearest; someone on the road isn't in it
{
  const party = { leader: "me", ids: ["me", "A", "B", "C"] };
  const town = [500, 300];
  const walkers = [{ id: "me", pos: town, atPlace: true }, { id: "A", pos: town, atPlace: true }, { id: "B", pos: town, atPlace: true }, { id: "C", pos: [503, 300], atPlace: false, moving: true }];
  const m = T.place(walkers, { party, me: "me", behind: [], gap: 30, near: 8, first: 18 });
  ok(m.size === 3 && !m.has("C"), "the one walking off isn't in the town row");
  ok(near(m.get("me"), [518, 300]) && near(m.get("A"), [548, 300]) && near(m.get("B"), [578, 300]), "row: leader first, gap apart, right of the icon");
}
// no NaN with odd input
{
  const m = T.place([{ id: "me", pos: [10, 10], moving: true }, { id: "A", pos: [10, 10], moving: true }], { party: { leader: "me", ids: ["me", "A"] }, me: "me", behind: [[NaN, 1], null, [10, 10]], gap: 5, near: 8, first: 5 });
  ok([...m.values()].every((p) => isFinite(p[0]) && isFinite(p[1])), "finite spots");
}
console.log(`partytrain: ${n} checks passed`);
