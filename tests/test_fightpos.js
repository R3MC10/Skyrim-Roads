// Where everyone stands in a fight (fightpos.js): many party / foe / screen combinations, everyone on screen,
// feet on the ground line (back rows a little higher), sizes by kind, no fighter hidden under another.
// Run: node test_fightpos.js   (W=/path/to/game/ to test another copy)
const path = require("path");
const W0 = process.env.W || path.join(__dirname, "..", "game") + "/";
const F = require(path.join(W0, "fightpos.js"));
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; if (fails < 40) console.log("FAIL", msg); } };

// stages: the phone's immersive screen (520 wide, 67 px cropped each side), a PC window, a plain phone sheet
const STAGES = [
  { name: "phone", W: 520, Hh: 343, l: 67, r: 453 },
  { name: "phone-sheet", W: 330, Hh: 218, l: 0, r: 330 },
  { name: "pc", W: 520, Hh: 292, l: 0, r: 520 },
  { name: "pc-wide", W: 520, Hh: 240, l: 0, r: 520 },
  { name: "tablet", W: 520, Hh: 390, l: 0, r: 520 },
];
const FOES = ["bandit", "person", "giant", "troll", "dragon", "mammoth", "skeever", "crab", "wolf", "wolves", "bear", "spider", "werewolf", "centurion", "lich"];
const PARTY = [0, 1, 2, 3, 4, 6, 7];   // other players (8 in a party)
const FOLS = [0, 1, 2];
const SUMS = [null, "familiar", "flame_atronach"];

function company(players, fols, ride, extra) {
  const a = [];
  for (let i = 0; i < players; i++) a.push({ name: "P" + i, kind: "mate", ride: ride && i % 2 === 0 });
  for (let i = 0; i < fols; i++) a.push({ name: "F" + i, kind: "follower" });
  if (extra) a.push({ name: "X", kind: extra });
  return a;
}
let n = 0, worstOv = 0;
for (const st of STAGES) for (const foe of FOES) for (const p of PARTY) for (const fo of FOLS) for (const ride of [false, true]) for (const wait of [0, 2, 5]) {
  if (ride && p === 0 && fo === 0 && wait) continue;
  const extra = p === 3 ? "icewolf" : p === 6 ? "odah" : null;
  const allies = company(p, fo, ride && p > 0, extra);
  const sum = SUMS[(p + fo) % 3];
  const L = F.layout({ W: st.W, Hh: st.Hh, l: st.l, r: st.r, ride, allies, foe: { kind: foe }, waiting: wait, summon: sum });
  n++;
  const tag = `${st.name} ${foe} p${p} f${fo}${ride ? " ride" : ""} w${wait}`;
  const s = L.s, gy = L.gy, eps = 1.5;
  const all = [["hero", L.hero], ["foe", L.foe], ...L.allies.map((a) => ["ally " + a.name, a]), ...L.waiting.map((w, i) => ["waiting " + i, w])];
  if (L.summon) all.push(["summon", L.summon]);
  // everyone inside the visible band, heads below the top of the stage
  for (const [who, f] of all) {
    ok(f.left >= st.l - eps && f.right <= st.r + eps, `${tag}: ${who} off screen (${f.left.toFixed(0)}..${f.right.toFixed(0)} of ${st.l}..${st.r})`);
    ok(f.top >= 0, `${tag}: ${who} head above the stage (${f.top.toFixed(0)})`);
  }
  // feet: on the ground line, back rows a little higher, never below it (the foreground strip)
  ok(Math.abs(L.hero.y - gy) < 0.01 && Math.abs(L.foe.y - gy) < 0.01, `${tag}: you or the foe not on the ground line`);
  for (const [who, f] of all) ok(f.y <= gy + 0.01 && f.y >= Math.min(gy - (L.rows + 2) * Math.max(L.lift, L.wlift) * s, who.startsWith("waiting") ? L.foe.top : gy) - 0.01, `${tag}: ${who} feet off the ground (${f.y.toFixed(1)} vs ${gy.toFixed(1)})`);   // (a crowd waiting over the foe's shoulder stands further back, never higher than its head)
  // sides: your company left of the foe, you facing it with a gap
  ok(L.hero.x < L.foe.x, `${tag}: you stand right of the foe`);
  ok(L.hero.right <= L.foe.x, `${tag}: you stand inside the foe`);
  for (const a of L.allies) ok(a.x < L.foe.x, `${tag}: ally ${a.name} on the foe's side`);
  for (const w of L.waiting) ok(w.x > L.foe.x || w.y < L.foe.y - 0.3 * (L.foe.y - L.foe.top), `${tag}: a waiting foe in front of the foe`);   // (or well back, over its shoulder)
  // rows: one scale per row, back rows smaller and higher
  const byRow = {};
  for (const a of L.allies) (byRow[a.row] = byRow[a.row] || []).push(a);
  for (const [r, list] of Object.entries(byRow)) {
    ok(list.every((a) => Math.abs(a.sc - L.rowSc[r]) < 1e-6 && L.rowSc[r] <= F.ROW_SC ** r + 1e-9 && L.rowSc[r] >= 0.78 * F.ROW_SC ** r - 1e-9), `${tag}: row ${r} has mixed sizes`);
    ok(list.every((a) => Math.abs(a.y - (gy - r * L.lift * s)) < 0.01), `${tag}: row ${r} not on its depth line`);
  }
  ok(L.rows <= 5, `${tag}: ${L.rows} rows`);
  // nobody fully hidden: two allies in one row never share a spot
  for (const list of Object.values(byRow)) {
    const xs = list.map((a) => a.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      const gap = (xs[i] - xs[i - 1]) / s;
      ok(gap >= 2.5, `${tag}: two allies stacked in a row (${gap.toFixed(1)} units apart)`);
      if (st.name !== "phone-sheet" && p + fo <= 5) worstOv = Math.max(worstOv, 12 - gap);
    }
  }
  // a small party on a big screen: shoulder to shoulder, no pile
  if (st.name === "pc-wide" && p + fo <= 4) for (const list of Object.values(byRow)) {
    const xs = list.map((a) => a.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) ok((xs[i] - xs[i - 1]) / s >= 20, `${tag}: small party squeezed on a wide screen`);
  }
  // sizes: big foes stay bigger than you, small ones smaller; scale never blows up
  const fh = (F.FOE[foe] || F.FOE.person)[2] * L.foe.fs;
  if (["giant", "troll", "dragon", "mammoth", "centurion"].includes(foe)) ok(fh >= 72 * 1.05, `${tag}: a ${foe} is not bigger than you (${fh.toFixed(0)})`);
  if (["skeever", "crab"].includes(foe)) ok(fh < 40, `${tag}: a ${foe} is not small`);
  ok(L.foe.fs <= 1 && L.foe.fs >= 0.5, `${tag}: foe scale ${L.foe.fs}`);
  ok(L.more >= 0 && L.waiting.length + L.more === wait, `${tag}: waiting count ${L.waiting.length}+${L.more} != ${wait}`);
  ok(!L.tag || (L.tag.x > st.l && L.tag.x < st.r), `${tag}: the party label off screen`);
}
// the same input gives the same answer (every phone in a party draws the same picture)
const A = JSON.stringify(F.layout({ W: 520, Hh: 343, l: 67, r: 453, allies: company(7, 2, false), foe: { kind: "dragon" }, waiting: 3 }));
const B = JSON.stringify(F.layout({ W: 520, Hh: 343, l: 67, r: 453, allies: company(7, 2, false), foe: { kind: "dragon" }, waiting: 3 }));
ok(A === B, "layout is not repeatable");
// a solo fight keeps the classic spots: you at about a quarter, the foe at about three quarters
const S = F.layout({ W: 520, Hh: 292, l: 0, r: 520, allies: [], foe: { kind: "bandit" } });
ok(Math.abs(S.hero.x / 520 - 0.27) < 0.03 && Math.abs(S.foe.x / 520 - 0.74) < 0.03, `solo spots moved: ${S.hero.x} ${S.foe.x}`);
console.log(`fightpos: ${n} layouts, ${checks} checks, ${fails} failed`);
if (fails) process.exit(1);
console.log("fightpos ok");
