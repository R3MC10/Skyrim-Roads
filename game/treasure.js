/* Treasure maps and archaeology [OURS].
   - Leads: loot can hold a hand-drawn treasure map (an ink sketch of the real land around the spot: coast, lakes,
     rivers, hills, woods, one or two landmarks and an X, never a name), an old journal with a riddle, or a torn piece of
     a map (2-4 pieces make one map). None of them puts a marker on your world map: you compare the sketch or the riddle
     with the painted map, travel there and dig. A wrong guess costs only time (you're worn out for a little while).
     Stuck? Every two wrong digs unlock a hint (the hold, then a town and a direction, then the landmark), an innkeeper
     sells one for gold, and the Cartographer perk gives you the first one for free.
   - Everything about a lead is in its item id (tmap|seed, tjour|seed, tfrag|seed|piece|of), so a map you trade or give
     away points to the same spot for your friend. The spot comes from the seed: a real place (standing stone, tower,
     farm, barrow...) and a short walk from it, on ground you can stand on.
   - Finds: a buried cache (gold, gems, rare ores), now and then a lost unique, and sometimes a sealed tomb: a small
     one-off Nordic barrow run through the usual dungeon rooms (dungeons.js), gone once you clear it.
   - Archaeology: relic fragments from Nordic barrows and Dwemer ruins; three make a restored relic (two with Antiquarian)
     that you keep on your shelf or sell to a collector (Urag at the College in Winterhold, Calcelmo in Markarth).
   - Party: only the leader digs; the leader can put "where do we dig?" to a vote (the party's road vote in partyplay.js,
     carried by netsync.js like any other road vote). Gold from a dig is split evenly with the party.
   - Perks (perkfx.js): Cartographer (Streetwise), Antiquarian (Mercantile), Excavator (Athletics).
   The rules up top are plain JS (node tests); drawing and screens only run in the browser. */
const TREASURE = (() => {
  const DOM = typeof document !== "undefined" && typeof document.addEventListener === "function";
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const MW = 1000, MH = 700;
  const DIG_PX = 32;          // stand within this many map px of the spot to dig it up
  const WIN_W = 150, WIN_H = 110;   // the patch of land a sketch shows (map px)
  const REST_S = 40;          // a wrong dig wears you out for this many seconds (Excavator halves it)
  const HINT_GOLD = 60;       // an innkeeper's rumour
  const COLLECT_FEE = 100;    // a collector restores a relic for you (no Antiquarian)
  const pxd = (a, b) => Math.hypot((a[0] - b[0]) * MW, (a[1] - b[1]) * MH);

  // ---------------------------------------------------------------- seeded dice
  function hash(str) { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = hash(seed) || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const newSeed = () => { let o = ""; for (let i = 0; i < 7; i++) o += "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 32)]; return o; };
  const SEED_RE = /^[a-z0-9]{4,12}$/;

  // ---------------------------------------------------------------- the words ([english, polish]); i18n_treasure.js reads them all
  const KINDS = { stone: "stone", fort: "tower", shrine: "shrine", landmark: "cairn", town: "village", city: "village", farm: "farm", camp: "tent", lair: "skull" };
  const kindOf = (name, k) => (k === "dungeon" ? (/Barrow|Tomb|Crypt|Sepulch|Ruin/i.test(name) ? "barrow" : "cave") : KINDS[k] || "cairn");
  const ANCHOR_KINDS = new Set(["stone", "shrine", "landmark", "farm", "fort", "dungeon", "camp", "town"]);
  const PRIORITY = ["stone", "tower", "shrine", "barrow", "cairn", "village", "farm", "cave", "tent", "skull"];
  const THING = { stone: ["a standing stone", "kamienia mocy"], tower: ["an old watchtower", "starej wieży strażniczej"], shrine: ["a wayside shrine", "przydrożnej kapliczki"],
    village: ["a village with smoking chimneys", "wioski z dymiącymi kominami"], farm: ["a lonely farm", "samotnej farmy"], barrow: ["a barrow of the old Nords", "kurhanu dawnych Nordów"],
    cave: ["a dark cave mouth", "ciemnego wylotu jaskini"], tent: ["a camp of rough folk", "obozu podejrzanych typów"], skull: ["the bones of a dragon's roost", "kości na smoczym legowisku"],
    cairn: ["a place travellers still talk about", "miejsca, o którym wciąż mówią podróżni"] };
  const DIRS = [["north", "na północ"], ["north-east", "na północny wschód"], ["east", "na wschód"], ["south-east", "na południowy wschód"], ["south", "na południe"],
    ["south-west", "na południowy zachód"], ["west", "na zachód"], ["north-west", "na północny zachód"]];
  const dirOf = (from, to) => { const a = Math.atan2((to[1] - from[1]) * MH, (to[0] - from[0]) * MW); return Math.round(((a * 180 / Math.PI) + 90 + 360) / 45) % 8; };   // 0 = north (up)
  const GROUND = { forest: ["Under green leaves, where the light comes down in pieces.", "Pod zielonymi liśćmi, gdzie światło spada kawałkami.", "woods", "las"],
    pine: ["Under dark pines that never lose their needles.", "Pod ciemnymi sosnami, które nigdy nie gubią igieł.", "pines", "sosny"],
    autumn: ["Where the leaves burn gold and red all year.", "Tam, gdzie liście przez cały rok płoną złotem i czerwienią.", "red leaves", "czerwone liście"],
    snow: ["Where the snow never quite melts.", "Tam, gdzie śnieg nigdy do końca nie topnieje.", "snow", "śnieg"],
    tundra: ["On the cold open tundra, flat as a table.", "Na zimnej, otwartej tundrze, płaskiej jak stół.", "tundra", "tundra"],
    marsh: ["Where the bog pulls at your boots.", "Tam, gdzie bagno wciąga buty.", "marsh", "bagno"],
    rocky: ["High among bare grey stones.", "Wysoko, wśród nagich szarych kamieni.", "hills", "wzgórza"],
    grass: ["On open grass, with nothing to hide behind.", "Na otwartej trawie, bez żadnej osłony.", "plains", "równiny"],
    ash: ["Where grey ash lies over everything.", "Tam, gdzie szary popiół pokrywa wszystko.", "ash", "popiół"] };
  const WATER = { river: ["Close enough to hear running water.", "Na tyle blisko, by słyszeć płynącą wodę."], sea: ["Close enough to smell the sea.", "Na tyle blisko, by czuć zapach morza."],
    lake: ["Within sight of still water.", "W zasięgu wzroku od stojącej wody."], none: ["No water in sight, so bring your own.", "Wody nie widać, więc weź własną."] };
  const HOLDS = { Haafingar: ["In the hold of the Blue Palace.", "W twierdzy Błękitnego Pałacu."], Hjaalmarch: ["In the hold of fog and marsh.", "W twierdzy mgły i bagien."],
    "The Pale": ["In the hold of the long cold coast.", "W twierdzy długiego, zimnego wybrzeża."], Winterhold: ["In the hold where the old College stands on its cliff.", "W twierdzy, gdzie stara Akademia stoi na urwisku."],
    Eastmarch: ["In the hold of hot springs and grey stone.", "W twierdzy gorących źródeł i szarego kamienia."], "The Rift": ["In the hold of golden autumn.", "W twierdzy złotej jesieni."],
    Whiterun: ["In the hold of wide grassy plains.", "W twierdzy szerokich, trawiastych równin."], "The Reach": ["In the hold of red rock and Forsworn.", "W twierdzy czerwonych skał i Wiarołomnych."],
    Falkreath: ["In the hold of graves and tall pines.", "W twierdzy grobów i wysokich sosen."] };
  const BURIED = (d, t) => [`I buried it a short walk ${DIRS[d][0]} of ${THING[t][0]}.`, `Zakopałem to kawałek drogi ${DIRS[d][1]} od ${THING[t][1]}.`];
  const CLOSERS = [["If you find it, it's yours. I won't be coming back.", "Jeśli to znajdziesz, jest twoje. Ja już nie wrócę."],
    ["Dig deep. I did.", "Kop głęboko. Ja kopałem."], ["Don't tell my brother.", "Nie mów mojemu bratu."],
    ["The rest of the page is torn away.", "Reszta strony jest wyrwana."], ["The ink runs here, as if it got wet.", "Atrament się tu rozmazał, jakby zamókł."]];
  const JTITLES = [["A Smuggler's Last Pages", "Ostatnie strony przemytnika"], ["Diary of a Barrow Robber", "Pamiętnik rabusia kurhanów"], ["Notes of a Lost Courier", "Notatki zaginionego kuriera"],
    ["A Hunter's Ledger", "Księga myśliwego"], ["The Miser's Journal", "Dziennik skąpca"], ["A Deserter's Diary", "Pamiętnik dezertera"]];
  const groundOf = (T, t) => (t === T.FOREST ? "forest" : t === T.PINE ? "pine" : t === T.AUTUMN ? "autumn" : t === T.SNOW || t === T.PEAK ? "snow" : t === T.TUNDRA ? "tundra"
    : t === T.MARSH ? "marsh" : t === T.ROCKY || t === T.MOUNTAIN ? "rocky" : t === T.ASH || t === T.VOLCANIC ? "ash" : "grass");
  const NAMES = { map: ["Old treasure map", "Stara mapa skarbu"], frag: ["Torn map piece", "Podarty kawałek mapy"] };

  // ---------------------------------------------------------------- the land (built once, from WORLD and the terrain grid)
  const TER = () => (typeof Terrain !== "undefined" ? Terrain : null);
  let ANCH = null;
  function anchors() {
    if (ANCH) return ANCH;
    ANCH = Object.entries(WORLD.places).filter(([n, p]) => p[0] > 0.03 && p[0] < 0.97 && p[1] > 0.04 && p[1] < 0.96 && ANCHOR_KINDS.has(p[2]))
      .map(([n, p]) => [n, p[0], p[1], p[2]]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    return ANCH;
  }
  const standable = (p) => { const T = TER(); if (!T) return true; const k = T.typeAtPos(p); return k !== T.T.SEA && k !== T.T.LAKE && k !== T.T.PEAK && k !== T.T.BEYOND; };
  const tcache = new Map();
  /* where a seed's treasure lies: a real place and a short walk from it */
  function target(seed) {
    if (tcache.has(seed)) return tcache.get(seed);
    const r = rng("t|" + seed), list = anchors(), a = list[Math.floor(r() * list.length)];
    let pos = [a[1], a[2]];
    for (let i = 0; i < 14; i++) {
      const ang = r() * Math.PI * 2, d = 10 + r() * 14, p = [a[1] + Math.cos(ang) * d / MW, a[2] + Math.sin(ang) * d / MH];
      if (standable(p)) { pos = [+p[0].toFixed(4), +p[1].toFixed(4)]; break; }
    }
    const t = { seed, anchor: a[0], kind: kindOf(a[0], a[3]), apos: [a[1], a[2]], pos, hold: WORLD.holdAt ? WORLD.holdAt(pos) : null };
    if (tcache.size > 300) tcache.clear();
    tcache.set(seed, t);
    return t;
  }
  /* what the ground is like at the spot (for riddles and names) */
  function lay(seed) {
    const t = target(seed), T = TER();
    if (!T) return { ground: "grass", water: "none" };
    const cnt = {}, near = { river: 1e9, sea: 1e9, lake: 1e9 };
    for (let dy = -30; dy <= 30; dy += 4) for (let dx = -30; dx <= 30; dx += 4) {
      const p = [t.pos[0] + dx / MW, t.pos[1] + dy / MH], k = T.typeAtPos(p), d = Math.hypot(dx, dy);
      if (k === T.T.RIVER || k === T.T.BRIDGE) near.river = Math.min(near.river, d);
      else if (k === T.T.SEA) near.sea = Math.min(near.sea, d);
      else if (k === T.T.LAKE) near.lake = Math.min(near.lake, d);
      else if (k !== T.T.ROAD && d <= 14) { const g = groundOf(T.T, k); cnt[g] = (cnt[g] || 0) + 1; }
    }
    const ground = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || "grass";
    const water = near.river <= 20 ? "river" : near.sea <= 34 ? "sea" : near.lake <= 30 ? "lake" : "none";
    return { ground, water };
  }

  /* the sketch: a patch of land around the spot (map px box), the ground in cells, rivers and roads as lines, landmarks, the X.
     Everything is in box-local units (0..1). clear: the Cartographer's eye (one more landmark, roads drawn firm). */
  const SK_COLS = 30, SK_ROWS = 22;
  function sketch(seed, clear = false) {
    const t = target(seed), r = rng("s|" + seed), T = TER();
    let cx = t.pos[0] * MW + (r() - 0.5) * WIN_W * 0.55, cy = t.pos[1] * MH + (r() - 0.5) * WIN_H * 0.55;
    cx = Math.max(WIN_W / 2, Math.min(MW - WIN_W / 2, cx)); cy = Math.max(WIN_H / 2, Math.min(MH - WIN_H / 2, cy));
    const box = { x0: cx - WIN_W / 2, y0: cy - WIN_H / 2, w: WIN_W, h: WIN_H };
    const loc = (px, py) => [(px - box.x0) / box.w, (py - box.y0) / box.h];
    const cells = [];
    if (T) for (let j = 0; j < SK_ROWS; j++) for (let i = 0; i < SK_COLS; i++) {
      const k = T.typeAtPos([(box.x0 + (i + 0.5) * box.w / SK_COLS) / MW, (box.y0 + (j + 0.5) * box.h / SK_ROWS) / MH]);
      cells.push(k === T.T.SEA || k === T.T.LAKE || k === T.T.BEYOND ? (k === T.T.BEYOND ? "x" : "w") : k === T.T.PEAK ? "P" : k === T.T.MOUNTAIN ? "M" : k === T.T.ROCKY ? "h"
        : k === T.T.FOREST || k === T.T.AUTUMN ? "f" : k === T.T.PINE ? "p" : k === T.T.MARSH ? "m" : k === T.T.SNOW ? "s" : ".");
    }
    const clip = (lines) => {
      const out = [];
      for (const pts of lines || []) {
        let cur = [];
        for (const [px, py] of pts) {
          const q = loc(px, py), inside = q[0] > -0.15 && q[0] < 1.15 && q[1] > -0.15 && q[1] < 1.15;
          if (inside) cur.push(q); else { if (cur.length) { cur.push(q); if (cur.length > 1) out.push(cur); } cur = []; }
          if (!inside && !cur.length) cur = [];
        }
        if (cur.length > 1) out.push(cur);
      }
      // a polyline that only touches the box from outside on both ends still crosses it: keep segments that pass through
      return out;
    };
    const dense = (lines) => (lines || []).map((pts) => { const o = []; for (let i = 0; i < pts.length; i++) { if (i) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 6)); for (let k = 1; k < n; k++) o.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); } o.push(pts[i]); } return o; });
    const rivers = T ? clip(dense(T.rivers)) : [], roads = T ? clip(dense(T.roads)) : [];
    // landmarks: the place the treasure hangs on, then the most striking others in view; never their names
    const inBox = (p) => { const q = loc(p[0] * MW, p[1] * MH); return q[0] > 0.04 && q[0] < 0.96 && q[1] > 0.05 && q[1] < 0.95; };
    const others = Object.entries(WORLD.places).filter(([n, p]) => n !== t.anchor && p[1] <= 1 && inBox(p))
      .map(([n, p]) => ({ place: n, kind: kindOf(n, p[2]), p })).sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) || (a.place < b.place ? -1 : 1));
    const want = (clear ? 3 : 2) - 1;
    const marks = [{ place: t.anchor, kind: t.kind, p: t.apos, anchor: true }, ...others.slice(0, want)].map((m) => ({ place: m.place, kind: m.kind, anchor: !!m.anchor, at: loc(m.p[0] * MW, m.p[1] * MH) }));
    return { seed, box, cols: SK_COLS, rows: SK_ROWS, cells, rivers, roads, marks, x: loc(t.pos[0] * MW, t.pos[1] * MH), clear: !!clear, wob: clear ? 0.4 : 1, ink: r() };
  }
  /* the riddle in an old journal: [english lines], [polish lines] */
  function riddle(seed) {
    const t = target(seed), L = lay(seed), r = rng("j|" + seed);
    const lines = [GROUND[L.ground].slice(0, 2), WATER[L.water], BURIED(dirOf(t.apos, t.pos), t.kind)];
    if (t.hold && HOLDS[t.hold]) lines.unshift(HOLDS[t.hold]);
    lines.push(CLOSERS[Math.floor(r() * CLOSERS.length)]);
    return { en: lines.map((x) => x[0]), pl: lines.map((x) => x[1]), title: JTITLES[Math.floor(rng("jt|" + seed)() * JTITLES.length)] };
  }

  // ---------------------------------------------------------------- the items: made on demand from their id
  function parse(id) {
    if (typeof id !== "string") return null;
    const a = id.split("|");
    if (a[0] === "tmap" && a.length === 2 && SEED_RE.test(a[1])) return { kind: "map", seed: a[1] };
    if (a[0] === "tjour" && a.length === 2 && SEED_RE.test(a[1])) return { kind: "journal", seed: a[1] };
    if (a[0] === "tfrag" && a.length === 4 && SEED_RE.test(a[1])) { const k = +a[2], n = +a[3]; if (n >= 2 && n <= 4 && k >= 1 && k <= n && Number.isInteger(k) && Number.isInteger(n)) return { kind: "frag", seed: a[1], k, n }; }
    return null;
  }
  const idOf = { map: (seed) => `tmap|${seed}`, journal: (seed) => `tjour|${seed}`, frag: (seed, k, n) => `tfrag|${seed}|${k}|${n}` };
  function nameOf(id) {
    const p = parse(id); if (!p) return null;
    if (p.kind === "journal") return riddle(p.seed).title[0];
    const g = GROUND[lay(p.seed).ground][2];
    return p.kind === "map" ? `${NAMES.map[0]} (${g})` : `${NAMES.frag[0]} ${p.k}/${p.n} (${g})`;
  }
  function makeItem(id) {
    const p = parse(id); if (!p) return undefined;
    const base = { slot: "map", tre: p, weight: p.kind === "journal" ? 0.5 : 0.1, value: p.kind === "map" ? 30 : p.kind === "journal" ? 25 : 10 };
    const desc = p.kind === "map" ? "An ink sketch of a patch of land and an X. No names. Find the place on your map, go there and dig."
      : p.kind === "journal" ? "Someone's last notes, and a riddle about where they buried their things."
        : `One piece of a torn map. Find the other ${p.n - 1} and put them together.`;
    return { ...base, name: nameOf(id), desc };
  }
  if (typeof D !== "undefined") {
    const inner = D.ITEMS;
    D.ITEMS = new Proxy(inner, { get(t, k) { if (typeof k === "string" && !(k in t) && /^t(map|jour|frag)\|/.test(k)) { const it = makeItem(k); if (it) t[k] = it; } return t[k]; } });
    Object.assign(inner, {
      relic_nord_frag: { name: "Weathered Nordic Relic Fragment", slot: "valuable", weight: 0.5, value: 40, desc: "A piece of something old and carved, from a Nordic barrow. Three of them make a whole relic." },
      relic_dwemer_frag: { name: "Corroded Dwemer Relic Fragment", slot: "valuable", weight: 0.5, value: 45, desc: "A piece of Dwemer brass with tiny dials, from a Dwemer ruin. Three of them make a whole relic." },
      relic_nord_mask: { name: "Restored Nordic Burial Mask", slot: "valuable", weight: 2, value: 450, desc: "An old Nordic burial mask, pieced back together. Keep it on your shelf or sell it to a collector." },
      relic_dwemer_astrolabe: { name: "Restored Dwemer Astrolabe", slot: "valuable", weight: 3, value: 600, desc: "A Dwemer star-reader, its rings turning again. Keep it on your shelf or sell it to a collector." },
      // lost uniques that only buried treasure gives up ([OURS] names and stats)
      tr_delver_spade: { name: "Old Delver's Spade", slot: "weapon", hands: 2, skill: "Two-Handed", damage: 15, weight: 14, value: 380, noTrade: true, desc: "Its edge is notched from a hundred digs. Somebody loved this spade." },
      tr_wayfinder: { name: "Amulet of the Wayfinder", slot: "amulet", weight: 0.5, value: 900, noTrade: true,
        aenchant: { key: "skill:Lockpicking", mag: 12, name: "Fortify Lockpicking", more: [{ key: "skill:Sneak", mag: 12, name: "Fortify Sneak" }] }, desc: "A compass rose on a chain. It always points a little away from north." },
      tr_warden_helm: { name: "Helm of the Barrow Warden", slot: "head", type: "heavy", armor: 20, weight: 6, value: 800, noTrade: true,
        aenchant: { key: "skill:Blocking", mag: 15, name: "Fortify Block" }, desc: "Worn by whoever guarded the old tombs. It smells of cold stone." },
    });
  }
  const RELICS = { relic_nord_mask: { from: "relic_nord_frag", need: 3 }, relic_dwemer_astrolabe: { from: "relic_dwemer_frag", need: 3 } };
  const UNIQUES = ["tr_delver_spade", "tr_wayfinder", "tr_warden_helm"];
  const COLLECTORS = { Winterhold: "Urag gro-Shub at the College", Markarth: "Calcelmo in Understone Keep" };

  // ---------------------------------------------------------------- your record (save) and the migration
  function st(s) {
    const o = s.tre && typeof s.tre === "object" && !Array.isArray(s.tre) ? s.tre : {};
    for (const k of ["dug", "tries", "bought", "tombs", "uniq"]) if (!o[k] || typeof o[k] !== "object" || Array.isArray(o[k])) o[k] = {};
    if (typeof o.rest !== "number" || !isFinite(o.rest)) o.rest = 0;
    if (typeof o.finds !== "number" || !isFinite(o.finds)) o.finds = 0;
    o.v = 1; s.tre = o;
    return o;
  }
  /* an old or damaged save: unreadable treasure items are dropped, the record is put back in shape */
  function migrate(s) {
    if (!s || typeof s !== "object") return s;
    const x = st(s);
    if (Array.isArray(s.inv)) s.inv = s.inv.filter((r) => !(r && typeof r.item === "string" && /^t(map|jour|frag)\|/.test(r.item) && !parse(r.item)));
    for (const [k, v] of Object.entries(x.tombs)) if (!v || !Array.isArray(v.pos) || !SEED_RE.test(k)) delete x.tombs[k];
    return s;
  }
  if (typeof G !== "undefined" && G.migrate) { const m0 = G.migrate; G.migrate = (s, ...a) => { const r = m0(s, ...a); try { migrate(s); } catch { /* never block a load */ } return r; }; }

  // ---------------------------------------------------------------- leads you carry
  const rowsOf = (s) => (s.inv || []).map((r) => ({ r, p: parse(r.item) })).filter((x) => x.p);
  /* maps and journals you can dig for (one per seed) */
  function leads(s) {
    const x = st(s), seen = new Set(), out = [];
    for (const { r, p } of rowsOf(s)) if (p.kind !== "frag" && !x.dug[p.seed] && !seen.has(p.seed)) { seen.add(p.seed); out.push({ id: r.item, row: r.id, ...p }); }
    return out;
  }
  /* torn pieces, grouped by the map they belong to */
  function sets(s) {
    const by = {};
    for (const { r, p } of rowsOf(s)) if (p.kind === "frag") { const b = by[p.seed] = by[p.seed] || { seed: p.seed, n: p.n, have: {} }; if (p.n === b.n) b.have[p.k] = r.id; }
    return Object.values(by).map((b) => ({ ...b, count: Object.keys(b.have).length, full: Object.keys(b.have).length === b.n }));
  }
  function combine(s, seed) {
    const b = sets(s).find((x) => x.seed === seed);
    if (!b) return { err: "You have no pieces of that map." };
    if (!b.full) return { err: `You have ${b.count} of ${b.n} pieces. Find the rest first.` };
    for (const id of Object.values(b.have)) G.take(s, id);
    G.give(s, idOf.map(seed));
    return { text: "The torn edges line up. You have a whole treasure map now.", item: idOf.map(seed) };
  }

  // ---------------------------------------------------------------- finding them
  /* a new lead: a map, a journal or a torn piece (a piece you're missing comes first) */
  function newLead(s, r = Math.random) {
    const x = st(s), open = sets(s).filter((b) => !b.full && !x.dug[b.seed]);
    const roll = r();
    let id;
    if (roll < 0.4) {
      if (open.length && r() < 0.75) { const b = open[Math.floor(r() * open.length)], miss = [...Array(b.n)].map((_, i) => i + 1).filter((k) => !b.have[k]); id = idOf.frag(b.seed, miss[Math.floor(r() * miss.length)], b.n); }
      else { const n = 2 + Math.floor(r() * 3); id = idOf.frag(newSeed(), 1 + Math.floor(r() * n), n); }
    } else id = roll < 0.75 ? idOf.map(newSeed()) : idOf.journal(newSeed());
    G.give(s, id);
    return id;
  }
  /* engine.js rollLoot: people (bandits, necromancers...) sometimes carry a lead */
  function loot(s, e) {
    if (!s || !e || e.fled || e.guard || s._test) return [];
    const tags = new Set(e.tags || []);
    const ch = tags.has("boss") ? 0.1 : tags.has("elite") ? 0.04 : tags.has("humanoid") ? 0.012 : 0;
    if (!(Math.random() < ch)) return [];
    return [D.ITEMS[newLead(s)].name];
  }
  const relicFor = (theme) => (theme === "barrow" ? "relic_nord_frag" : theme === "dwemer" ? "relic_dwemer_frag" : null);

  // ---------------------------------------------------------------- digging
  const role = (s) => (typeof PARTYPLAY !== "undefined" ? (() => { try { return PARTYPLAY.role(s); } catch { return "solo"; } })() : "solo");
  const stopped = (s) => !(s.trip && s.trip.status === "travel") && !s.dungeon;
  function restLeft(s, t = now()) { return Math.max(0, Math.ceil(st(s).rest - t)); }
  /* which lead's spot you're standing on, if any */
  function spotHere(s) { const me = [s.x, s.y]; return leads(s).find((l) => pxd(me, target(l.seed).pos) <= DIG_PX) || null; }
  /* hints: 0 none, 1 the hold, 2 a town and a direction, 3 the landmark */
  function hintLevel(s, seed) { const x = st(s); return Math.min(3, Math.floor((x.tries[seed] || 0) / 2) + (x.bought[seed] || 0) + (pfx(s, "tmapx") > 0 ? 1 : 0)); }
  const TOWN_KINDS = new Set(["city", "town"]);
  function nearestTown(pos) {
    let best = null, bd = 1e9;
    for (const [n, p] of Object.entries(WORLD.places)) if (TOWN_KINDS.has(p[2]) && p[1] <= 1 && !(WORLD.hidden?.has(n))) { const d = pxd(pos, p); if (d < bd) { bd = d; best = n; } }
    return best ? { name: best, d: bd } : null;
  }
  const walkWords = (d) => (d < 60 ? ["a short walk", "krótki spacer"] : d < 140 ? ["an hour or two on foot", "godzinę lub dwie pieszo"] : ["half a day on foot", "pół dnia pieszo"]);
  function hints(s, seed) {
    const t = target(seed), lv = hintLevel(s, seed), out = [];
    if (lv >= 1 && t.hold) out.push(`The map points somewhere in ${t.hold}.`);
    if (lv >= 2) { const tw = nearestTown(t.pos); if (tw) out.push(`It lies ${DIRS[dirOf(WORLD.places[tw.name], t.pos)][0]} of ${tw.name}, ${walkWords(tw.d)[0]} away.`); }
    if (lv >= 3) out.push(`Look near ${t.anchor}.`);
    return out;
  }
  /* an innkeeper's rumour: the next hint, for gold */
  function askInn(s, seed) {
    const inn = typeof TOWNS !== "undefined" && TOWNS.INNS ? TOWNS.INNS[s.location] : null;
    if (!inn) return { err: "Ask at an inn: innkeepers hear everything." };
    if (!leads(s).some((l) => l.seed === seed)) return { err: "You don't have that map any more." };
    if (hintLevel(s, seed) >= 3) return { err: "The innkeeper has nothing more to tell you about that one." };
    if (s.gold < HINT_GOLD) return { err: `A rumour costs ${HINT_GOLD} gold.` };
    s.gold -= HINT_GOLD; const x = st(s); x.bought[seed] = (x.bought[seed] || 0) + 1;
    const h = hints(s, seed);
    return { text: "The innkeeper looks at your map, then leans in and lowers their voice.", hint: h[h.length - 1] || "", gold: HINT_GOLD };
  }
  /* dig (or search) right here. Wrong: you lose a little time. Right: the find. */
  function dig(s, opts = {}) {
    const t = opts.t ?? now(), x = st(s);
    if (!stopped(s)) return { err: "Stop somewhere first: you can't dig on the move." };
    if (role(s) === "member") return { err: "In a party only your leader digs. Vote for the spot when they ask." };
    const ls = leads(s);
    if (!ls.length) return { err: sets(s).length ? "Put the torn pieces together first: you can't dig from a scrap." : "You have no treasure map or journal to follow." };
    const left = restLeft(s, t);
    if (left) return { err: `You're still worn out from the last dig. Rest ${left} s.`, rest: left };
    const hit = spotHere(s);
    if (!hit) {
      for (const l of ls) x.tries[l.seed] = (x.tries[l.seed] || 0) + 1;
      x.rest = t + Math.round(REST_S * (1 - Math.min(0.75, pfx(s, "digrest"))));
      const fresh = ls.map((l) => ({ seed: l.seed, lv: hintLevel(s, l.seed), was: Math.min(3, Math.floor(((x.tries[l.seed] || 1) - 1) / 2) + (x.bought[l.seed] || 0) + (pfx(s, "tmapx") > 0 ? 1 : 0)) })).filter((h) => h.lv > h.was);
      return { wrong: true, text: "You dig for an hour and hit only roots and stones. Not here.", hint: fresh.length ? hints(s, fresh[0].seed).slice(-1)[0] : null, rest: x.rest - t };
    }
    return find(s, hit, t, opts.r || Math.random);
  }
  function find(s, lead, t, r) {
    const x = st(s), seed = lead.seed, lvl = Math.max(1, s.level || 1);
    G.take(s, lead.row); x.dug[seed] = t; x.finds++;
    for (const k of Object.keys(x.dug)) if (t - x.dug[k] > 86400 * 60) delete x.dug[k];   // forget digs older than two months (seeds are never reused anyway)
    const more = pfx(s, "digloot"), got = [];
    const gold = Math.round((110 + 16 * Math.min(lvl, 50)) * (0.8 + r() * 0.5) * (1 + more));
    s.gold += gold; got.push(`${gold} gold`);
    const give = (id, n = 1) => { if (!D.ITEMS[id]) return; G.give(s, id, n); got.push(D.ITEMS[id].name + (n > 1 ? ` ×${n}` : "")); };
    const GEMS = ["gem_garnet", "gem_amethyst", "gem_sapphire", "gem_ruby", "gem_emerald", "gem_diamond", "gem_flawless_amethyst", "gem_flawless_sapphire", "gem_flawless_ruby", "gem_flawless_diamond"].filter((g) => D.ITEMS[g]);
    const MATS = ["ore_moonstone", "ore_corundum", "ore_silver", "ore_gold", "mat_moonstone", "dwemer_scrap", "dwemer_gear"].filter((g) => D.ITEMS[g]);
    const gemTop = Math.min(GEMS.length, 3 + Math.floor(lvl / 8));
    const nGems = 1 + (r() < 0.45 ? 1 : 0) + Math.round(pfx(s, "diggem"));
    for (let i = 0; i < nGems && GEMS.length; i++) give(GEMS[Math.floor(r() * gemTop)]);
    if (MATS.length) give(MATS[Math.floor(r() * MATS.length)], 1 + Math.floor(r() * 2));
    if (r() < 0.3 + (pfx(s, "diggem") > 0 ? 0.2 : 0)) give(r() < 0.5 ? "relic_nord_frag" : "relic_dwemer_frag");
    let tomb = null, uniq = null;
    const left = UNIQUES.filter((u) => !x.uniq[u] && D.ITEMS[u]);
    const roll = r();
    if (lvl >= 5 && roll < 0.16) {
      const tg = target(seed), tier = lvl < 15 ? 1 : lvl < 30 ? 2 : 3;
      tomb = x.tombs[seed] = { pos: tg.pos.slice(), tier, name: `Sealed tomb near ${tg.anchor}`, t, done: 0 };
    } else if (left.length && roll < 0.28) { uniq = left[Math.floor(r() * left.length)]; x.uniq[uniq] = t; give(uniq); }
    if (typeof IMM !== "undefined" && IMM.count) { try { IMM.count(s, "treasure"); } catch { /* optional */ } }
    const text = tomb ? `Your spade hits stone: a slab with old carvings. Under the dirt you find ${got.join(", ")}, and beneath the slab, steps lead down into the dark.`
      : uniq ? `Your spade hits a wrapped bundle. Inside: ${got.join(", ")}. Someone hid this for a reason.`
        : `Your spade hits wood: a rotten chest. Inside: ${got.join(", ")}.`;
    return { ok: true, seed, gold, got, tomb: !!tomb, uniq, text };
  }

  // ---------------------------------------------------------------- sealed tombs: a one-off Nordic barrow at the dig site
  function tombHere(s) {
    const me = [s.x, s.y];
    const e = Object.entries(st(s).tombs).find(([, v]) => !v.done && pxd(me, v.pos) <= DIG_PX);
    return e ? { seed: e[0], ...e[1] } : null;
  }
  function enterTomb(s, t = now()) {
    if (!stopped(s)) return { err: "Stop at the tomb first." };
    if (role(s) === "member") return { err: "In a party only your leader opens the tomb." };
    const tb = tombHere(s);
    if (!tb || typeof DUNGEONS === "undefined") return { err: "There's no tomb here." };
    s.dungeon = { place: tb.name, theme: "barrow", tier: tb.tier, rows: DUNGEONS.layout("barrow", tb.tier), row: -1, col: 0, room: null, found: [], gold: 0, t, tomb: tb.seed };
    G.setHealth(s, G.curHealth(s, t), t);
    G.note(s, `\uE10E Went down into ${tb.name}`);
    return { ok: true, name: tb.name };
  }

  // ---------------------------------------------------------------- dungeons: relic fragments and leads in chests and boss rooms; tombs close once cleared
  function onDungeon(s, d, type, wasDone, res, t) {
    const out = [], r = Math.random, rel = relicFor(d.theme);
    const give = (id) => { G.give(s, id); const n = D.ITEMS[id].name; if (Array.isArray(d.found)) d.found.push(n); out.push(n); };
    const solved = !d.room && type && !res.stay && !res.died;
    if (solved && type === "treasure") { if (rel && r() < 0.35) give(rel); if (r() < 0.08) give(newLead(s)); }
    if (res.fight?.won && rel && r() < 0.06) give(rel);
    if (d.done && !wasDone) {
      if (rel && r() < 0.6) give(rel);
      if (r() < (d.tomb ? 0.5 : 0.2)) give(newLead(s));
      if (d.tomb) {
        const x = st(s), tb = x.tombs[d.tomb];
        if (tb) tb.done = t;
        if (s.cleared) delete s.cleared[d.place];   // a one-off: nothing moves back in, and it isn't a place on the map
        const left = UNIQUES.filter((u) => !x.uniq[u] && D.ITEMS[u]);
        if (left.length && r() < 0.5) { const u = left[Math.floor(r() * left.length)]; x.uniq[u] = t; give(u); }
      }
    }
    return out;
  }
  if (typeof DUNGEONS !== "undefined") {
    const act0 = DUNGEONS.act;
    DUNGEONS.act = (s, choice, t = now()) => {
      const d = s.dungeon, type = d?.room?.type, wasDone = !!d?.done;
      const res = act0(s, choice, t);
      try {
        if (d && res && !res.died && s.dungeon === d) {
          const got = onDungeon(s, d, type, wasDone, res, t);
          if (got.length) { if (res.text) res.text += ` You also find: ${got.join(", ")}.`; else res.loot = [...(res.loot || []), ...got]; }
        }
      } catch (e) { if (typeof console !== "undefined") console.warn("treasure: dungeon hook", e); }
      return res;
    };
  }

  // ---------------------------------------------------------------- archaeology: restore relics, sell them to a collector
  function relicInfo(s, id) {
    const R = RELICS[id]; if (!R) return null;
    const have = (s.inv || []).filter((r) => r.item === R.from).reduce((a, r) => a + r.qty, 0);
    const self = pfx(s, "relicfix") > 0, need = self ? R.need - 1 : R.need, at = COLLECTORS[s.location] || null;
    return { id, from: R.from, have, need, self, at, fee: self ? 0 : COLLECTOR_FEE(), can: have >= need && (self || !!at) && (self || s.gold >= COLLECTOR_FEE()) };
  }
  function COLLECTOR_FEE() { return COLLECT_FEE; }
  function restore(s, id) {
    const i = relicInfo(s, id); if (!i) return { err: "?" };
    if (i.have < i.need) return { err: `You need ${i.need} fragments (you have ${i.have}).` };
    if (!i.self && !i.at) return { err: "Only a collector can put it back together: Urag in Winterhold or Calcelmo in Markarth. (Or learn Antiquarian.)" };
    if (!i.self && s.gold < i.fee) return { err: `The collector wants ${i.fee} gold for the work.` };
    let n = i.need;
    for (const r of (s.inv || []).filter((x) => x.item === i.from)) { const k = Math.min(n, r.qty); G.take(s, r.id, k); n -= k; if (!n) break; }
    if (!i.self) s.gold -= i.fee;
    G.give(s, id);
    return { text: i.self ? `You fit the pieces together yourself. ${D.ITEMS[id].name}.` : `The collector fits the pieces together for ${i.fee} gold. ${D.ITEMS[id].name}.`, item: id };
  }
  const relicPrice = (s, id) => Math.round((D.ITEMS[id]?.value || 0) * (1 + pfx(s, "relicpay")));
  function sellRelic(s, id) {
    if (!RELICS[id]) return { err: "?" };
    if (!COLLECTORS[s.location]) return { err: "Only a collector buys relics at their worth: Winterhold or Markarth." };
    const r = (s.inv || []).find((x) => x.item === id);
    if (!r) return { err: "You don't have that relic." };
    const p = relicPrice(s, id); G.take(s, r.id); s.gold += p;
    return { text: `${COLLECTORS[s.location].split(" ")[0]} turns it over in the light and pays ${p} gold.`, gold: p };
  }

  // ---------------------------------------------------------------- party: "where do we dig?" (the party's road vote, partyplay.js)
  /* the choices: right here, and the nearest places you know */
  function voteOpts(s, max = 4) {
    const me = [s.x, s.y], known = new Set(s.discovered || []);
    const near = Object.entries(WORLD.places).filter(([n, p]) => p[1] <= 1 && known.has(n) && n !== s.location && pxd(me, p) <= 260).sort((a, b) => pxd(me, a[1]) - pxd(me, b[1])).slice(0, max - 1);
    return [["here", s.location ? `Dig here at ${s.location}` : "Dig right here", "btn pri"], ...near.map(([n]) => [`at:${n}`, `Go and dig at ${n}`, "btn"])];
  }
  function openVote(p, leader, s, who, t = now()) {
    if (typeof PARTYPLAY === "undefined") return p;
    return PARTYPLAY.halt(p, leader, { kind: "dig", name: "Treasure", title: "Where do we dig?", sub: "Treasure hunt", text: "Look at the map together and vote for the spot.", opts: voteOpts(s), who, pos: [s.x, s.y] }, t);
  }
  /* the leader settles it: the most votes, a tie goes to the first option */
  function settle(p, leader, t = now()) {
    if (typeof PARTYPLAY === "undefined" || !p?.halt || p.halt.kind !== "dig") return { p, key: null };
    const tl = PARTYPLAY.tally(p.halt), opts = p.halt.opts.map((o) => o[0]);
    let key = opts[0], best = -1;
    for (const k of opts) { const n = (tl[k] || []).length; if (n > best) { best = n; key = k; } }
    const o = p.halt.opts.find((x) => x[0] === key);
    const np = PARTYPLAY.resolve(PARTYPLAY.pick(p, leader, key, t), leader, key === "here" ? "We dig here." : `We dig at ${key.slice(3)}.`, t);
    return { p: np, key, label: o ? o[1] : key };
  }

  // ---------------------------------------------------------------- drawing (browser)
  const INK = "#3b2c1e", RED = "#8e2b25", WATERC = "#4a6670";
  function jag(r, w, h, m, amp) {   // a torn, burnt edge around the sheet
    const pts = [], step = 9;
    for (let x = m; x <= w - m; x += step) pts.push([x, m + (r() - 0.5) * amp]);
    for (let y = m; y <= h - m; y += step) pts.push([w - m + (r() - 0.5) * amp, y]);
    for (let x = w - m; x >= m; x -= step) pts.push([x, h - m + (r() - 0.5) * amp]);
    for (let y = h - m; y >= m; y -= step) pts.push([m + (r() - 0.5) * amp, y]);
    return pts;
  }
  function wobLine(g, pts, r, wob, w, color, dash) {
    if (pts.length < 2) return;
    g.save(); g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; if (dash) g.setLineDash(dash);
    g.beginPath(); pts.forEach(([x, y], i) => { const jx = (r() - 0.5) * wob, jy = (r() - 0.5) * wob; if (i) g.lineTo(x + jx, y + jy); else g.moveTo(x + jx, y + jy); }); g.stroke(); g.restore();
  }
  function icon(g, kind, x, y, k, r) {
    g.save(); g.translate(x, y); g.scale(k, k); g.strokeStyle = INK; g.fillStyle = "#cbb68c"; g.lineWidth = 1.4; g.lineJoin = "round";
    const P = (pts, fill = true) => { g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); if (fill) g.fill(); g.stroke(); };
    if (kind === "stone") { P([[-4, 7], [-5, -6], [-1, -11], [4, -8], [5, 7]]); g.beginPath(); g.moveTo(0, -5); g.lineTo(0, 3); g.moveTo(-2, -1); g.lineTo(2, -1); g.stroke(); }
    else if (kind === "tower") { P([[-5, 8], [-4, -6], [4, -6], [5, 8]]); P([[-6, -6], [-6, -10], [-3, -10], [-3, -8], [-1, -8], [-1, -10], [1, -10], [1, -8], [3, -8], [3, -10], [6, -10], [6, -6]]); g.fillStyle = INK; g.fillRect(-1, 1, 2, 4); }
    else if (kind === "shrine") { P([[-6, 7], [-6, 0], [0, -7], [6, 0], [6, 7]]); g.beginPath(); g.arc(0, 2, 2, 0, 7); g.stroke(); }
    else if (kind === "village") { P([[-9, 7], [-9, 0], [-5, -4], [-1, 0], [-1, 7]]); P([[0, 7], [0, -2], [5, -7], [10, -2], [10, 7]]); g.beginPath(); g.moveTo(7, -9); g.quadraticCurveTo(9, -13, 6, -16); g.stroke(); }
    else if (kind === "farm") { P([[-7, 7], [-7, 0], [0, -6], [7, 0], [7, 7]]); g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(-10 + i * 0, 10 + i); } g.moveTo(-10, 11); g.lineTo(10, 11); g.moveTo(-9, 13); g.lineTo(9, 13); g.stroke(); }
    else if (kind === "barrow") { g.beginPath(); g.moveTo(-10, 7); g.quadraticCurveTo(0, -10, 10, 7); g.closePath(); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(0, 5, 2.5, Math.PI, 0); g.fill(); }
    else if (kind === "cave") { g.beginPath(); g.moveTo(-10, 7); g.lineTo(-6, -5); g.lineTo(2, -8); g.lineTo(9, 7); g.closePath(); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.moveTo(-3, 7); g.quadraticCurveTo(0, -1, 3, 7); g.fill(); }
    else if (kind === "tent") { P([[-8, 7], [0, -7], [8, 7]]); g.beginPath(); g.moveTo(0, -7); g.lineTo(0, 7); g.stroke(); }
    else if (kind === "skull") { g.beginPath(); g.arc(0, -1, 6, 0, 7); g.fill(); g.stroke(); g.fillStyle = INK; g.fillRect(-3.5, -2, 2.5, 2.5); g.fillRect(1, -2, 2.5, 2.5); g.beginPath(); g.moveTo(-4, 7); g.lineTo(4, 7); g.stroke(); }
    else { for (const [a, b, c] of [[-6, 7, 5], [-3, 2, 4], [0, -3, 3]]) { g.beginPath(); g.ellipse(a + 3, b, c, c * 0.6, 0, 0, 7); g.fill(); g.stroke(); } }
    g.restore();
  }
  /* draw a sketch model onto a canvas. piece: {k, n} draws just that piece of a torn map */
  function drawSketch(g, w, h, m, piece) {
    const r = rng("d|" + m.seed + (piece ? "|" + piece.k : "")), wob = 2.2 * m.wob, M = 10, IW = w - 2 * M, IH = h - 2 * M;
    const X = (u) => M + u * IW, Y = (v) => M + v * IH;
    g.save();
    let clipR = null;
    if (piece) {   // which slice of the sheet this piece is
      const n = piece.n, k = piece.k - 1;
      clipR = n === 4 ? [(k % 2) * w / 2, Math.floor(k / 2) * h / 2, w / 2, h / 2] : [k * w / n, 0, w / n, h];
    }
    const edge = piece ? (() => { const [x0, y0, cw, ch] = clipR, rr = rng("e|" + m.seed + piece.k), pts = []; const st = 7;
      for (let x = x0; x <= x0 + cw; x += st) pts.push([x, y0 + (y0 > 0 ? (rr() - 0.5) * 8 : 3 + rr() * 3)]);
      for (let y = y0; y <= y0 + ch; y += st) pts.push([x0 + cw - (x0 + cw < w - 1 ? (rr() - 0.5) * 8 : 3 + rr() * 3), y]);
      for (let x = x0 + cw; x >= x0; x -= st) pts.push([x, y0 + ch - (y0 + ch < h - 1 ? (rr() - 0.5) * 8 : 3 + rr() * 3)]);
      for (let y = y0 + ch; y >= y0; y -= st) pts.push([x0 + (x0 > 0 ? (rr() - 0.5) * 8 : 3 + rr() * 3), y]);
      return pts; })() : jag(r, w, h, 4, 5);
    g.beginPath(); edge.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); g.clip();
    // the paper
    const pg = g.createLinearGradient(0, 0, w, h); pg.addColorStop(0, "#ecdcb6"); pg.addColorStop(0.5, "#e3cfa2"); pg.addColorStop(1, "#d7bf8c"); g.fillStyle = pg; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.07; for (let i = 0; i < w * h / 70; i++) { g.fillStyle = r() < 0.5 ? "#6b5640" : "#fff6dc"; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); } g.globalAlpha = 1;
    g.globalAlpha = 0.12; g.strokeStyle = "#7a5a32"; g.lineWidth = 3; g.beginPath(); g.arc(w * (0.2 + r() * 0.6), h * (0.2 + r() * 0.6), 14 + r() * 10, 0, 5.6); g.stroke(); g.globalAlpha = 1;   // a mug ring
    const cw = IW / m.cols, ch = IH / m.rows, at = (i, j) => (i < 0 || j < 0 || i >= m.cols || j >= m.rows ? null : m.cells[j * m.cols + i]);
    // water: soft blobs (an ink shore, the paper inside, a pale wash), then a few waves
    const wetCells = []; for (let j = 0; j < m.rows; j++) for (let i = 0; i < m.cols; i++) if (at(i, j) === "w" || at(i, j) === "x") wetCells.push([X((i + 0.5) / m.cols), Y((j + 0.5) / m.rows)]);
    const wr = Math.max(cw, ch) * 0.82, blob = (rad, fill) => { g.fillStyle = fill; g.beginPath(); for (const [x0, y0] of wetCells) { g.moveTo(x0 + rad, y0); g.arc(x0, y0, rad, 0, Math.PI * 2); } g.fill(); };
    if (wetCells.length) { blob(wr, WATERC); blob(wr - 1.4, "#e2cd9f"); blob(wr - 1.4, "rgba(74,102,112,0.24)"); }
    g.lineWidth = 0.9; g.beginPath();
    for (let j = 1; j < m.rows; j += 3) for (let i = (j % 2); i < m.cols; i += 4) if (at(i, j) === "w" && r() < 0.6) { const x0 = X((i + 0.2) / m.cols), y0 = Y((j + 0.5) / m.rows); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + cw * 0.5, y0 - 2.5, x0 + cw, y0); g.quadraticCurveTo(x0 + cw * 1.5, y0 + 2.5, x0 + cw * 2, y0); }
    g.stroke();
    // marsh tufts, woods and hills, sparse and seeded (a sketch, not a survey)
    for (let j = 0; j < m.rows; j++) for (let i = 0; i < m.cols; i++) {
      const c = at(i, j), x0 = X((i + 0.5) / m.cols) + (r() - 0.5) * cw * 0.6, y0 = Y((j + 0.5) / m.rows) + (r() - 0.5) * ch * 0.6;
      if ((c === "M" || c === "P") && (i + j * 3) % 2 === 0 && r() < 0.75) {
        const s = c === "P" ? 7.5 : 5.5;
        g.fillStyle = "#cdb488"; g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0 - s, y0 + s * 0.5); g.lineTo(x0 - s * 0.1, y0 - s); g.lineTo(x0 + s, y0 + s * 0.5); g.fill(); g.stroke();
        g.lineWidth = 0.7; g.beginPath(); for (let q = 0; q < 3; q++) { g.moveTo(x0 + q * 1.6, y0 - s * 0.6 + q * 2.6); g.lineTo(x0 + s * 0.6, y0 + s * 0.4); } g.stroke();
        if (c === "P") { g.fillStyle = "#f6f1e6"; g.beginPath(); g.moveTo(x0 - s * 0.35, y0 - s * 0.35); g.lineTo(x0 - s * 0.1, y0 - s); g.lineTo(x0 + s * 0.3, y0 - s * 0.4); g.fill(); }
      } else if (c === "h" && (i + j) % 3 === 0 && r() < 0.7) { g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 - 5, y0 + 2); g.quadraticCurveTo(x0, y0 - 5, x0 + 5, y0 + 2); g.stroke(); }
      else if ((c === "f" || c === "p") && (i * 2 + j) % 3 === 0 && r() < 0.75) {
        g.strokeStyle = INK; g.lineWidth = 1; g.fillStyle = c === "p" ? "#6f7d55" : "#8c9a5a";
        if (c === "p") { g.beginPath(); g.moveTo(x0, y0 - 6); g.lineTo(x0 - 3.2, y0 + 2); g.lineTo(x0 + 3.2, y0 + 2); g.closePath(); g.fill(); g.stroke(); }
        else { g.beginPath(); g.arc(x0, y0 - 2, 3.2, 0, 7); g.fill(); g.stroke(); }
        g.beginPath(); g.moveTo(x0, y0 + 2); g.lineTo(x0, y0 + 4.5); g.stroke();
      } else if (c === "m" && (i + j) % 2 === 0 && r() < 0.6) { g.strokeStyle = "#4f5a3a"; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x0 - 4, y0 + 2); g.lineTo(x0 + 4, y0 + 2); for (const dx of [-2, 0, 2]) { g.moveTo(x0 + dx, y0 + 2); g.lineTo(x0 + dx * 1.4, y0 - 3); } g.stroke(); }
      else if (c === "s" && (i + j) % 4 === 0 && r() < 0.5) { g.fillStyle = "rgba(59,44,30,.35)"; g.fillRect(x0, y0, 1.4, 1.4); }
      else if (c === "." && (i * 7 + j * 3) % 5 === 0 && r() < 0.55) { g.strokeStyle = "rgba(70,60,30,.55)"; g.lineWidth = 0.8; g.beginPath(); for (const dx of [-2, 0, 2]) { g.moveTo(x0 + dx, y0 + 2); g.lineTo(x0 + dx * 1.5, y0 - 1.5 - (dx ? 0 : 1)); } g.stroke(); }
    }
    // rivers and roads
    for (const ln of m.rivers) wobLine(g, ln.map(([u, v]) => [X(u), Y(v)]), r, wob * 0.8, 2.1, WATERC);
    for (const ln of m.roads) wobLine(g, ln.map(([u, v]) => [X(u), Y(v)]), r, wob * 0.6, m.clear ? 1.4 : 1, m.clear ? "#5a4028" : "rgba(90,64,40,.55)", [4, 3]);
    // landmarks (never named), the walk from the main one and the X
    for (const mk of m.marks) icon(g, mk.kind, X(mk.at[0]), Y(mk.at[1]), mk.anchor ? 1.15 : 0.95, r);
    const a = m.marks.find((x) => x.anchor), xx = X(m.x[0]), xy = Y(m.x[1]);
    if (a) { const ax = X(a.at[0]), ay = Y(a.at[1]); g.save(); g.strokeStyle = RED; g.globalAlpha = 0.75; g.lineWidth = 1.2; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + xx) / 2 + (r() - 0.5) * 14, (ay + xy) / 2 + (r() - 0.5) * 14, xx, xy); g.stroke(); g.restore(); }
    g.save(); g.strokeStyle = RED; g.lineWidth = 3.2; g.lineCap = "round"; g.beginPath(); g.moveTo(xx - 6, xy - 6); g.lineTo(xx + 6, xy + 6); g.moveTo(xx + 6, xy - 6); g.lineTo(xx - 6, xy + 6); g.stroke(); g.restore();
    // north (and a full rose for a Cartographer)
    const nx = w - M - 14, ny = M + 18;
    g.save(); g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 1.2;
    if (m.clear) { g.beginPath(); g.arc(nx, ny, 9, 0, 7); g.stroke(); for (let q = 0; q < 4; q++) { g.save(); g.translate(nx, ny); g.rotate(q * Math.PI / 2); g.beginPath(); g.moveTo(0, -12); g.lineTo(2.4, 0); g.lineTo(-2.4, 0); g.closePath(); q ? g.stroke() : g.fill(); g.restore(); } }
    else { g.beginPath(); g.moveTo(nx, ny + 8); g.lineTo(nx, ny - 9); g.moveTo(nx - 3.5, ny - 4); g.lineTo(nx, ny - 10); g.lineTo(nx + 3.5, ny - 4); g.stroke(); }
    g.font = "bold 10px Georgia, serif"; g.textAlign = "center"; g.fillText("N", nx, ny - (m.clear ? 14 : 12)); g.restore();
    // a burnt rim
    const bg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.68); bg.addColorStop(0, "rgba(0,0,0,0)"); bg.addColorStop(1, "rgba(80,45,15,0.45)"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.restore();
    g.save(); g.strokeStyle = "rgba(60,30,10,.75)"; g.lineWidth = 1.6; g.beginPath(); edge.forEach(([a2, b], i) => (i ? g.lineTo(a2, b) : g.moveTo(a2, b))); g.closePath(); g.stroke(); g.restore();
  }
  const SW = 320, SH = 235;
  function sketchImg(s, id, w = SW) {
    const p = parse(id); if (!p || typeof ART === "undefined") return "";
    const clear = pfx(s, "tmapx") > 0, m = sketch(p.seed, clear), h = Math.round(w * SH / SW);
    return ART.html(w, h, (g, H, cw, chh) => drawSketch(g, cw, chh, m, p.kind === "frag" ? { k: p.k, n: p.n } : null), { key: `tmap|${id}|${clear ? 1 : 0}`, cls: "tm-sketch", alt: "A hand-drawn treasure map" });
  }

  // ---------------------------------------------------------------- icons in the pack
  if (typeof ICONART !== "undefined" && ICONART.item && typeof ART !== "undefined") {
    const item0 = ICONART.item;
    const RELIC_PIC = { relic_nord_frag: 0, relic_dwemer_frag: 1, relic_nord_mask: 2, relic_dwemer_astrolabe: 3 };
    ICONART.item = (id, size = 34, row = null) => {
      const p = parse(id);
      if (p) return ART.html(size, size, (g, H, w) => { g.scale(w / 40, w / 40);
        if (p.kind === "journal") { H.poly(g, [[9, 6], [31, 6], [31, 34], [9, 34]], "#7a4a2a", INK, 1.4); H.poly(g, [[12, 9], [29, 9], [29, 31], [12, 31]], "#e3cfa2", null); g.strokeStyle = INK; g.lineWidth = 0.8; for (let y = 13; y < 29; y += 3.5) { g.beginPath(); g.moveTo(14, y); g.lineTo(27, y); g.stroke(); } g.strokeStyle = RED; g.lineWidth = 1.6; g.beginPath(); g.moveTo(22, 22); g.lineTo(26, 26); g.moveTo(26, 22); g.lineTo(22, 26); g.stroke(); return; }
        const torn = p.kind === "frag";
        H.poly(g, torn ? [[7, 9], [24, 7], [21, 14], [26, 20], [22, 27], [25, 33], [8, 32]] : [[5, 9], [35, 7], [34, 32], [6, 33]], "#e3cfa2", INK, 1.3);
        g.strokeStyle = WATERC; g.lineWidth = 1.2; g.beginPath(); g.moveTo(8, 26); g.quadraticCurveTo(14, 18, 20, 22); if (!torn) g.quadraticCurveTo(26, 26, 32, 16); g.stroke();
        g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(10, 18); g.lineTo(13, 12); g.lineTo(16, 18); g.stroke();
        g.strokeStyle = RED; g.lineWidth = 2; g.beginPath(); const cx = torn ? 16 : 26, cy = torn ? 26 : 22; g.moveTo(cx - 3, cy - 3); g.lineTo(cx + 3, cy + 3); g.moveTo(cx + 3, cy - 3); g.lineTo(cx - 3, cy + 3); g.stroke();
      }, { key: `ti:${p.kind}`, cls: "ico", alt: "" });
      if (id in RELIC_PIC) return ART.html(size, size, (g, H, w) => { g.scale(w / 40, w / 40); const k = RELIC_PIC[id];
        if (k % 2 === 0) { H.poly(g, k ? [[10, 8], [30, 8], [32, 22], [26, 33], [14, 33], [8, 22]] : [[12, 10], [26, 8], [24, 20], [15, 22]], "#9a9078", INK, 1.3); g.fillStyle = INK; if (k) { g.fillRect(14, 17, 4, 2.5); g.fillRect(22, 17, 4, 2.5); g.fillRect(19, 25, 2, 4); } else { g.beginPath(); g.moveTo(15, 13); g.lineTo(22, 13); g.stroke(); } }
        else { g.fillStyle = "#b8863a"; g.strokeStyle = INK; g.lineWidth = 1.3; if (k === 3) { for (const rr of [13, 9]) { g.beginPath(); g.arc(20, 20, rr, 0, 7); g.stroke(); } g.beginPath(); g.arc(20, 20, 4, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(20, 7); g.lineTo(20, 33); g.stroke(); } else { H.poly(g, [[11, 12], [27, 10], [29, 25], [13, 28]], "#b8863a", INK, 1.3); g.beginPath(); g.arc(20, 19, 4, 0, 7); g.stroke(); } }
      }, { key: `ti:${id}`, cls: "ico", alt: "" });
      return item0(id, size, row);
    };
  }

  // ---------------------------------------------------------------- screens (browser)
  let ctx = null, pinned = null, voteTimer = null;
  function mount(c) { ctx = c; if (DOM && !mount.on) { mount.on = true; document.addEventListener("click", onClick, true); } }
  const S = () => (ctx ? ctx.S() : null);
  function leadLabel(id) { const it = D.ITEMS[id]; return it ? it.name : id; }
  /* item details in the pack: what it says, and what you can do with it */
  function detailLines(s, r) {
    const p = parse(r.item), out = [];
    if (p) {
      if (p.kind === "frag") { const b = sets(s).find((x) => x.seed === p.seed); if (b) out.push(`You have ${b.count} of ${b.n} pieces of this map.`); }
      if (st(s).dug[p.seed]) out.push("Someone already dug this one up.");
      return out;
    }
    const rel = Object.entries(RELICS).find(([, v]) => v.from === r.item);
    if (rel) { const i = relicInfo(s, rel[0]); out.push(`${i.have} of ${i.need} fragments for a ${D.ITEMS[rel[0]].name}.`); }
    if (RELICS[r.item] && COLLECTORS[s.location]) out.push(`The collector here pays ${relicPrice(s, r.item)} gold for it.`);
    return out;
  }
  function detailActs(s, r) {
    const p = parse(r.item), out = [];
    if (p) {
      out.push(`<button class="btn pri" data-tm="look" data-id="${esc(r.item)}">${p.kind === "journal" ? "\uE108 Read" : "\uE128 Look at it"}</button>`);
      if (p.kind === "frag") { const b = sets(s).find((x) => x.seed === p.seed); if (b?.full) out.push(`<button class="btn" data-tm="combine" data-seed="${esc(p.seed)}">\uE164 Piece them together</button>`); }
      return out;
    }
    const rel = Object.entries(RELICS).find(([, v]) => v.from === r.item);
    if (rel) { const i = relicInfo(s, rel[0]); if (i.have >= i.need) out.push(`<button class="btn pri" data-tm="restore" data-id="${rel[0]}" ${i.can ? "" : "disabled"}>\uE19E Restore${i.self ? "" : ` · ${i.fee} gold`}</button>`); }
    if (RELICS[r.item] && COLLECTORS[s.location]) out.push(`<button class="btn" data-tm="sellrelic" data-id="${r.item}">Sell to the collector · ${relicPrice(s, r.item)} gold</button>`);
    return out;
  }
  /* a card on the Travel tab: your leads, Dig here, a tomb at your feet, the collector in town */
  function card(s) {
    if (!s || !stopped(s)) return "";
    const ls = leads(s), bs = sets(s).filter((b) => !st(s).dug[b.seed]), tb = tombHere(s), coll = COLLECTORS[s.location];
    const relics = (s.inv || []).filter((r) => RELICS[r.item] || r.item === "relic_nord_frag" || r.item === "relic_dwemer_frag");
    if (!ls.length && !bs.length && !tb && !(coll && relics.length)) return "";
    const left = restLeft(s), lead = role(s) === "leader" && ctx?.party?.()?.members?.length > 1, mem = role(s) === "member";
    const rows = [...ls.map((l) => `<div class="item tm-row">${ICONART.item(l.id, 30)}<div class="t">${esc(leadLabel(l.id))}<span>${hints(s, l.seed).map(esc).join(" ") || "No hints yet."}</span></div><button class="btn sm" data-tm="look" data-id="${esc(l.id)}">${l.kind === "journal" ? "Read" : "Look"}</button></div>`),
      ...bs.map((b) => `<div class="item tm-row">${ICONART.item(idOf.frag(b.seed, 1, b.n), 30)}<div class="t">${esc(`Torn map: ${b.count} of ${b.n} pieces`)}<span>${b.full ? "All here: put them together." : "Find or trade for the rest."}</span></div>${b.full ? `<button class="btn sm pri" data-tm="combine" data-seed="${esc(b.seed)}">Piece together</button>` : `<button class="btn sm" data-tm="look" data-id="${esc(idOf.frag(b.seed, +Object.keys(b.have)[0], b.n))}">Look</button>`}</div>`)].join("");
    const tombH = tb ? `<div class="tm-tomb"><p>\uE10E ${esc("Steps lead down under the slab you dug up. Whatever was buried here, someone made sure it stayed down.")}</p><button class="btn danger" data-tm="tomb" style="width:100%">${esc("\uE10E Go down into the tomb")}</button></div>` : "";
    const collH = coll && relics.length ? `<p class="sub">${esc(`\uE19E ${coll} collects old relics.`)}</p>${relics.map((r) => `<div class="item tm-row">${ICONART.item(r.item, 28)}<div class="t">${esc(D.ITEMS[r.item].name)}${r.qty > 1 ? ` ×${r.qty}` : ""}</div>${detailActs(s, r).join("")}</div>`).join("")}` : "";
    const digB = ls.length ? `<div class="tm-btns"><button class="btn pri" data-tm="dig" ${left || mem ? "disabled" : ""}>${esc(left ? `\uE12A Rest ${left} s` : "\uE12A Dig here")}</button>${lead ? `<button class="btn" data-tm="vote">${esc("\uE19D Ask the party")}</button>` : ""}</div>` : "";
    return `<div class="panel tmcard"><h2>\uE128 ${esc("Treasure hunt")}</h2>${tombH}${ls.length || bs.length ? `<p class="sub">${esc("No marker on your map: match the sketch or the riddle to the land, go there and dig. A wrong guess only costs you a little time.")}</p>` : ""}${mem ? `<p class="sub">${esc("In a party only your leader digs. Vote for the spot when they ask.")}</p>` : ""}
      <div class="list">${rows}</div>${digB}${collH}</div>`;
  }
  /* the look window: the sketch (or riddle), hints, pin to the map, ask the innkeeper */
  function lookHTML(s, id) {
    const p = parse(id); if (!p) return "";
    const it = D.ITEMS[id], seed = p.seed, hs = p.kind === "frag" ? [] : hints(s, seed), inn = typeof TOWNS !== "undefined" && TOWNS.INNS?.[s.location];
    let body;
    if (p.kind === "journal") { const rd = riddle(seed); body = `<div class="tm-journal"><h3>${esc(rd.title[0])}</h3>${rd.en.map((l) => `<p>${esc(l)}</p>`).join("")}</div>`; }
    else {
      const b = p.kind === "frag" ? sets(s).find((x) => x.seed === seed) : null;
      const pieces = b ? Object.keys(b.have).map((k) => sketchImg(s, idOf.frag(seed, +k, b.n), 150)).join("") : "";
      body = p.kind === "frag" ? `<div class="tm-pieces">${pieces}</div><p class="sub">${esc(`You have ${b ? b.count : 1} of ${p.n} pieces.`)}</p>` : `<div class="tm-sheet">${sketchImg(s, id)}</div><p class="sub">${esc("No names, just the land. North is up.")}</p>`;
    }
    const hintH = hs.length ? `<div class="tm-hints"><b>${esc("Hints")}</b>${hs.map((h) => `<p>${esc(h)}</p>`).join("")}</div>` : (p.kind !== "frag" ? `<p class="sub">${esc("Every two wrong digs, you'll work out a little more.")}</p>` : "");
    const left = restLeft(s), canDig = p.kind !== "frag" && stopped(s) && role(s) !== "member";
    const btns = [canDig ? `<button class="btn" data-tm="dig" ${left ? "disabled" : ""}>${esc(left ? `\uE12A Rest ${left} s` : "\uE12A Dig here")}</button>` : "",
      p.kind !== "frag" ? `<button class="btn pri" data-tm="pin" data-id="${esc(id)}">${esc("\uE122 Pin it next to the world map")}</button>` : "",
      p.kind !== "frag" && inn && hintLevel(s, seed) < 3 ? `<button class="btn" data-tm="inn" data-seed="${esc(seed)}" ${s.gold >= HINT_GOLD ? "" : "disabled"}>${esc(`\uE15A Ask the innkeeper · ${HINT_GOLD} gold`)}</button>` : "",
      p.kind === "frag" && sets(s).find((x) => x.seed === seed)?.full ? `<button class="btn pri" data-tm="combine" data-seed="${esc(seed)}">${esc("\uE164 Piece them together")}</button>` : "",
      `<button class="btn" data-act="close">${esc("Close")}</button>`].filter(Boolean).join("");
    return `<div class="tm-look"><h2>${esc(it?.name || "Treasure map")}</h2>${body}${hintH}<div class="tm-btns col">${btns}</div></div>`;
  }
  /* the compare: the sketch (or riddle) pinned over the world map */
  function pin(id) {
    if (!DOM) return;
    unpin();
    const s = S(), p = parse(id); if (!s || !p) return;
    pinned = id;
    const el = document.createElement("div");
    el.id = "tmpin"; el.className = "tmpin"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Pinned treasure map");
    const inner = p.kind === "journal" ? `<div class="tm-journal sm">${riddle(p.seed).en.map((l) => `<p>${esc(l)}</p>`).join("")}</div>` : sketchImg(s, id, 220);
    el.innerHTML = `<div class="tmpin-hd"><b>${esc(D.ITEMS[id].name)}</b><button class="tmpin-sz" data-tm="pinsize" aria-label="Bigger or smaller">⤢</button><button class="tmpin-x" data-tm="unpin" aria-label="Unpin">✕</button></div>${inner}<p class="tmpin-tip">${esc("Pan the map until the land matches the sketch.")}</p>`;
    document.body.appendChild(el);
  }
  function unpin() { if (!DOM) return; document.getElementById("tmpin")?.remove(); pinned = null; }

  function after(r, title) {
    if (!ctx) return;
    if (r.err) return ctx.toast(r.err);
    ctx.persist(true); ctx.renderPanel(true);
  }
  function doDig() {
    const s = S(); if (!s) return;
    const r = dig(s);
    if (r.err) return ctx.toast(r.err);
    try { if (typeof SOUND !== "undefined") SOUND.fx(r.ok ? "coin" : "hit"); } catch { /* optional */ }
    let split = null;
    if (r.ok && r.gold && role(s) === "leader" && ctx.splitGold) split = ctx.splitGold(r.gold, "the buried treasure");
    if (r.ok) G.note(s, `\uE12A ${r.text}`);
    ctx.persist(true); ctx.renderPanel(true);
    if (r.ok) ctx.openModal(`<div class="tm-found"><h2>\uE12A ${esc("Buried treasure")}</h2><p>${esc(r.text)}</p>${split ? `<p class="sub">${esc(split)}</p>` : ""}${r.tomb ? `<button class="btn danger" data-tm="tomb" style="width:100%;margin-bottom:6px">${esc("\uE10E Go down into the tomb")}</button>` : ""}<button class="btn pri" data-act="close" style="width:100%">${esc("Continue")}</button></div>`);
    else ctx.openModal(`<div class="tm-found"><h2>\uE12A ${esc("Nothing here")}</h2><p>${esc(r.text)}</p>${r.hint ? `<p class="tm-hintnew">\uE163 ${esc(r.hint)}</p>` : ""}<button class="btn pri" data-act="close" style="width:100%">${esc("Continue")}</button></div>`);
  }
  function voteModal() {
    const p = ctx.party?.(); const h = p?.halt;
    if (!h || h.kind !== "dig") return "";
    const tl = typeof PARTYPLAY !== "undefined" ? PARTYPLAY.tally(h) : {};
    return `<div class="tmvote"><h2>\uE19D ${esc("Where do we dig?")}</h2><p class="sub">${esc("Your party is voting. Settle it when you're ready: the most votes win.")}</p>
      <div class="list">${h.opts.map(([k, l]) => `<div class="item"><div class="t">${esc(l)}</div><b class="num">${(tl[k] || []).length}</b></div>`).join("")}</div>
      <div class="tm-btns col"><button class="btn pri" data-tm="vsettle">${esc("Settle the vote")}</button><button class="btn" data-tm="vcancel">${esc("Call it off")}</button></div></div>`;
  }
  async function startVote() {
    const s = S(), p = ctx.party?.();
    if (!s || !p || role(s) !== "leader" || !ctx.Store) return;
    const who = p.members.map((m) => m.id).filter((id) => id !== s.id);
    await ctx.Store.change("parties", p.id, (x) => (x ? openVote(x, s.id, s, who) : x));
    ctx.openModal(voteModal() || `<p>${esc("Asking the party...")}</p>`);
    clearInterval(voteTimer);
    voteTimer = setInterval(() => { const m = document.querySelector("#modal .tmvote"); if (!m) { clearInterval(voteTimer); return; } const html = voteModal(); if (html) m.outerHTML = html; }, 1500);
  }
  async function endVote(cancel) {
    const s = S(), p = ctx.party?.(); clearInterval(voteTimer);
    if (!s || !p) return ctx.closeModal();
    let out = null;
    await ctx.Store.change("parties", p.id, (x) => { if (!x) return x; if (cancel) return typeof PARTYPLAY !== "undefined" ? PARTYPLAY.resolve(x, s.id, "No digging after all.") : x; const r = settle(x, s.id); out = r; return r.p; });
    ctx.closeModal();
    if (cancel || !out?.key) return;
    if (out.key === "here") return doDig();
    const place = out.key.slice(3);
    ctx.toast(`The party picked ${place}. Travel there together and dig.`);
    try { window.__ui?.jump?.({ place, tab: "map" }); } catch { /* optional */ }
  }
  function onClick(e) {
    const b = e.target.closest && e.target.closest("[data-tm]");
    if (!b || !ctx) return;
    e.preventDefault(); e.stopPropagation();
    const s = S(), k = b.dataset.tm;
    if (!s && k !== "unpin" && k !== "pinsize") return;
    if (k === "look") return void ctx.openModal(lookHTML(s, b.dataset.id));
    if (k === "dig") return void doDig();
    if (k === "pin") { ctx.closeModal(); try { window.__ui?.go?.("map"); } catch { /* optional */ } pin(b.dataset.id); return; }
    if (k === "unpin") return void unpin();
    if (k === "pinsize") { document.getElementById("tmpin")?.classList.toggle("big"); return; }
    if (k === "combine") { const r = combine(s, b.dataset.seed); if (r.err) return void ctx.toast(r.err); ctx.persist(true); ctx.renderPanel(true); ctx.openModal(lookHTML(s, r.item)); ctx.toast(r.text); return; }
    if (k === "inn") { const r = askInn(s, b.dataset.seed); if (r.err) return void ctx.toast(r.err); ctx.persist(true); ctx.renderPanel(true); const l = leads(s).find((x) => x.seed === b.dataset.seed); if (l) ctx.openModal(lookHTML(s, l.id)); ctx.toast(`${r.text} ${r.hint}`); return; }
    if (k === "restore" || k === "sellrelic") { const r = k === "restore" ? restore(s, b.dataset.id) : sellRelic(s, b.dataset.id); if (r.err) return void ctx.toast(r.err); try { if (typeof SOUND !== "undefined") SOUND.fx("coin"); } catch { /* optional */ } ctx.closeModal?.(); ctx.persist(true); ctx.renderPanel(true); ctx.toast(r.text); return; }
    if (k === "tomb") { const r = enterTomb(s); if (r.err) return void ctx.toast(r.err); ctx.closeModal?.(); ctx.persist(true); if (ctx.enterDungeon) ctx.enterDungeon(); return; }
    if (k === "vote") return void startVote();
    if (k === "vsettle" || k === "vcancel") return void endVote(k === "vcancel");
  }

  // ---------------------------------------------------------------- hooks: the Travel tab card, Journal → Discoveries
  if (typeof EXPLORE !== "undefined") {
    const card0 = EXPLORE.placeCard, panel0 = EXPLORE.panel;
    if (card0) EXPLORE.placeCard = (s) => card0(s) + (() => { try { return card(s); } catch (e) { console.warn("treasure card", e); return ""; } })();
    if (panel0) EXPLORE.panel = (s) => panel0(s) + (() => { try { return journalPanel(s); } catch { return ""; } })();
  }
  function journalPanel(s) {
    const x = st(s), ls = leads(s), bs = sets(s);
    const relics = Object.keys(RELICS).map((id) => { const i = relicInfo(s, id); return `<div class="item">${ICONART.item(id, 28)}<div class="t">${esc(D.ITEMS[id].name)}<span>${esc(`${i.have} of ${i.need} fragments`)}</span></div></div>`; }).join("");
    return `<div class="panel"><h2>${esc("Treasure hunts")}</h2><p class="sub">${esc("Treasure maps, old journals and torn pieces from loot. No marker shows the way: compare them with the world map, then go and dig.")}</p>
      <div class="xstats"><span>\uE12A ${esc("Dug up")} <b>${x.finds}</b></span><span>\uE128 ${esc("Leads")} <b>${ls.length}</b></span><span>\uE164 ${esc("Torn maps")} <b>${bs.length}</b></span></div>
      <div class="list">${ls.map((l) => `<div class="item">${ICONART.item(l.id, 28)}<div class="t">${esc(leadLabel(l.id))}</div><button class="btn sm" data-tm="look" data-id="${esc(l.id)}">${l.kind === "journal" ? "Read" : "Look"}</button></div>`).join("")}</div>
      <h3 class="xh">${esc("Relics")}</h3><div class="list">${relics}</div></div>`;
  }

  /* Polish lines for i18n_treasure.js: every riddle sentence and generated name */
  function plPairs() {
    const out = [];
    for (const v of Object.values(GROUND)) { out.push([v[0], v[1]]); for (const n of [2, 3, 4]) for (let k = 1; k <= n; k++) out.push([`${NAMES.frag[0]} ${k}/${n} (${v[2]})`, `${NAMES.frag[1]} ${k}/${n} (${v[3]})`]); out.push([`${NAMES.map[0]} (${v[2]})`, `${NAMES.map[1]} (${v[3]})`]); }
    for (const v of Object.values(WATER)) out.push(v);
    for (const v of Object.values(HOLDS)) out.push(v);
    for (const v of CLOSERS) out.push(v);
    for (const v of JTITLES) out.push(v);
    for (let d = 0; d < 8; d++) for (const t of Object.keys(THING)) out.push(BURIED(d, t));
    return out;
  }
  const plPats = () => DIRS.flatMap(([en, pl]) => [[`It lies ${en} of {0}, a short walk away.`, `Leży ${pl} od {0}, krótki spacer stąd.`], [`It lies ${en} of {0}, an hour or two on foot away.`, `Leży ${pl} od {0}, godzinę lub dwie pieszo stąd.`], [`It lies ${en} of {0}, half a day on foot away.`, `Leży ${pl} od {0}, pół dnia pieszo stąd.`]]);

  return { DIG_PX, WIN_W, WIN_H, REST_S, HINT_GOLD, COLLECT_FEE, RELICS, UNIQUES, COLLECTORS, DIRS, THING, GROUND,
    hash, rng, newSeed, parse, idOf, nameOf, makeItem, anchors, target, lay, sketch, riddle, st, migrate, leads, sets, combine, newLead, loot,
    spotHere, hintLevel, hints, askInn, dig, restLeft, tombHere, enterTomb, onDungeon, relicInfo, restore, relicPrice, sellRelic, voteOpts, openVote, settle,
    drawSketch, sketchImg, mount, card, lookHTML, detailLines, detailActs, journalPanel, pin, unpin, plPairs, plPats, get pinned() { return pinned; } };
})();
