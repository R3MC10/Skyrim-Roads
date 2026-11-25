const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// The place full screen (locscreen.js): opens for every kind of place, every service gets a reachable signpost,
// signposts never stack, backdrops exist, List/Scene is remembered per player.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const mem = {};
const localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, RegExp, localStorage,
  exists: (f) => fs.existsSync(W + f) };
vm.createContext(c);
const files = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js",
  "cooking.js", "smithing.js", "ammo.js", "gather.js", "halls.js", "homestead.js", "horses.js", "bounty.js", "festivals.js", "market.js", "social.js", "caravans.js", "rumours.js", "worldevents.js", "mp.js", "remind.js",
  "assets.js", "areaui.js", "gatherui.js", "locscreen.js"];
for (const f of files) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
vm.runInContext(`
let pass = 0;
const ok = (v, m) => { if (!v) throw new Error("FAIL " + m); pass++; };
const L = LOCSCREEN;

// ---- one place of every kind opens a scene
const KINDS = ["city", "town", "farm", "fort", "dungeon", "camp", "lair", "stone", "shrine", "landmark"];
const byKind = {};
for (const [n, p] of Object.entries(WORLD.places)) (byKind[p[2]] = byKind[p[2]] || []).push(n);
for (const k of KINDS) {
  ok(byKind[k] && byKind[k].length, "the world has a " + k);
  for (const l of byKind[k]) {
    const S = G.newSave("ls_" + k, "Remy", "nord"); S.location = l; [S.x, S.y] = WORLD.places[l];
    ok(L.placeOf(S) === l, "placeOf " + l);
    ok(L.kindOf(l) === k, "kindOf " + l);
    const sheets = { main: k === "city" || k === "town" ? "" : "<p>here</p>", gather: "<p>plants</p>", camp: "<p>fire</p>" };
    const h = L.html({ S, l, sections: [], players: [], sheets });
    ok(new RegExp('class="ls ls-' + k + ' ').test(h), "scene for " + l);
    ok(h.includes(">" + l.replace(/'/g, "&#39;") + "</h1>") || h.includes(">" + l + "</h1>"), "title " + l);
    ok(/data-act="locleave"/.test(h) && /data-act="locmode" data-id="list"/.test(h), "Leave and List on " + l);
    for (const id of Object.keys(sheets).filter((id) => sheets[id])) {
      ok(new RegExp('data-act="locsheet" data-id="' + id + '"').test(h), id + " signpost on " + l);
      ok(new RegExp('data-sheet="' + id + '"').test(h), id + " card on " + l);
    }
    // the painted backdrop: every name it lists is a real picture next to index.html
    const pics = L.backdrop(l);
    ok(pics.length && pics.every((p) => exists(p + ".webp")), "backdrops exist for " + l + ": " + pics.join());
  }
}
ok(L.backdrop("Whiterun")[0] === "place-whiterun", "Whiterun has its own painting");

// ---- a real town: every section becomes a signpost that opens it
const S = G.newSave("ls1", "Remy", "nord"); S.location = "Whiterun"; [S.x, S.y] = WORLD.places.Whiterun;
const secs = ["general", "blacksmith", "inn", "train", "alchemy", "forge", "jobs", "streets", "hire", "carriage", "home", "homes", "market", "notice", "cook", "fish", "stables", "caravans", "wizard", "enchanter", "halls", "somethingnew"];
const names = Object.fromEntries(secs.map((s) => [s, s]));
const h = L.html({ S, l: "Whiterun", sections: secs, names, open: true, hold: "Whiterun Hold", players: [{ name: "Kacper", sub: "Player" }], sheets: { gather: "<p>g</p>", news: "<p>n</p>" } });
for (const id of secs) ok(new RegExp('data-act="shop" data-id="' + id + '"').test(h), "signpost opens " + id);
ok(/class="ls-people"/.test(h) && />Kacper</.test(h), "other players show as people");
const sp = L.spots({ S, l: "Whiterun", sections: secs, names, sheets: { gather: "x", news: "y" } });
ok(sp.length === secs.length + 2, "one signpost per section and card");
ok(sp.every((x) => x.label && x.icon), "every signpost has a name and an icon");

// ---- layout: nothing on top of anything else, nothing off the picture
for (const n of [3, 8, 14, 24, 30]) {
  const ids = [...secs, "gather", "news", "x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8"].slice(0, n);
  const pos = L.layout("Whiterun", ids, "city"), ps = ids.map((id) => pos[id]);
  ok(ps.every((p) => p && p[0] >= 13 && p[0] <= 87 && p[1] >= 28 && p[1] <= 83), n + " signposts stay on the picture");
  if (n <= L.SLOTS.length) for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) ok(!L.near(ps[i], ps[j]), n + " signposts: " + ids[i] + " and " + ids[j] + " don't overlap");
}
const site = L.layout("Halted Stream Camp", ["main", "gather", "camp", "hunt"], "camp");
ok(site.main[0] === 50 && site.main[1] === 50, "a camp's own signpost sits in the middle");
L.POS["Riverwood"] = { inn: [62, 72] };
ok(L.layout("Riverwood", ["inn"], "town").inn.join() === "62,72", "per-place positions win over the kind's defaults");
delete L.POS["Riverwood"];

// ---- List / Scene remembered per player
const A = G.newSave("lsA", "A", "nord"), B = G.newSave("lsB", "B", "nord");
ok(L.mode(A) === "scene", "scene by default");
L.setMode(A, "list");
ok(L.mode(A) === "list" && L.mode(B) === "scene", "List is remembered per player");
L.setMode(A, "scene");
ok(L.mode(A) === "scene", "Scene view brings it back");

// ---- no scene on the road or in a dungeon
const T = G.newSave("lsT", "T", "nord"); T.location = "Whiterun"; T.trip = { destName: "Riverwood" };
ok(L.placeOf(T) === "", "no scene while travelling");
T.trip = null; T.dungeon = { name: "x" };
ok(L.placeOf(T) === "", "no scene inside a dungeon");
ok(L.tod(23) === "night" && L.tod(6) === "dawn" && L.tod(12) === "day" && L.tod(19) === "dusk", "time of day");

console.log("test_locscreen: " + pass + " checks passed");
`, c);
