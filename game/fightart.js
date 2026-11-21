/* Fight scenes: a little animated stage above every fight log — where you are, you on the left, the foe on the
   right — that replays the fight turn by turn (lunges, hits, spells, arrows, blocks, the fall) in 1–3 seconds.
   Tap to skip. Drawn with the shared ART toolkit in the player's art style (hand-drawn ink or pixel art).
   It only reads the finished Fight (its log and start/end health); it never changes a result. [OURS] */
const FIGHTART = (() => {
  const P = ART.PAL;
  const REG = new Map(), IDS = new WeakMap(); let nextId = 1;
  const reduce = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- who and where
  const SKIN = { nord: "#e9c6a1", imperial: "#dcb48c", breton: "#ecc9a8", redguard: "#8d5a3b", altmer: "#e3cf8a", bosmer: "#c99a6e", dunmer: "#6d7f8a", orc: "#8fa070", khajiit: "#c79a5a", argonian: "#7f9a6a" };
  function sceneOf(s) {
    if (!s) return "tundra";
    if (s.dungeon) return { cave: "cave", mine: "cave", vampire: "cave", forsworn: "cave", barrow: "ruin", temple: "ruin", fort: "ruin", thalmor: "ruin", dwemer: "dwemer", camp: "camp", giantcamp: "camp" }[s.dungeon.theme] || "cave";
    if (typeof Terrain === "undefined") return "tundra";
    const T = Terrain.T, t = Terrain.typeAtPos([s.x, s.y]);
    if (t === T.SNOW || t === T.PEAK || t === T.MOUNTAIN) return "snow";
    if (t === T.FOREST || t === T.PINE) return "forest";
    if (t === T.AUTUMN) return "autumn";
    if (t === T.MARSH) return "marsh";
    if (t === T.VOLCANIC) return "ash";
    if (t === T.ROCKY) return "rocky";
    return "tundra";
  }
  function heroOf(s, f) {
    const w = f?.weapon, id = f?.eq?.weapon?.item || "";
    let wt = f?.wt || "fist";
    if (w?.staff) wt = "staff"; else if (/crossbow/.test(id)) wt = "crossbow";
    const chest = f?.armor?.chest;
    const body = !chest ? "#8a7a62" : chest.type === "heavy" ? P.steel : chest.type === "cloth" ? P.cloth : chest.type === "medium" ? "#9a9a8e" : P.leather;
    const allies = (f?.allies || []).length + (s?.thrall ? 1 : 0);
    return { skin: SKIN[s?.race] || SKIN.nord, wt, shield: !!f?.shield, body, helm: !!f?.armor?.head, allies, beast: !!s?.beastForm };
  }
  function foeOf(e) {
    const n = (e?.name || "").toLowerCase(), tg = new Set(e?.tags || []);
    if (tg.has("dragon") || /^dragon$|dragon\b(?! priest)/.test(n)) return "dragon";
    const R = [[/priest/, "lich"], [/troll/, "troll"], [/mammoth/, "mammoth"], [/giant(?! frostbite)(?!.*spider)/, "giant"], [/dwarven spider/, "dspider"], [/spider/, "spider"],
      [/bear/, "bear"], [/sabre|cat\b/, "cat"], [/wolves|pack/, "wolves"], [/wolf/, "wolf"], [/skeever/, "skeever"], [/mudcrab|crab/, "crab"],
      [/draugr|restless|wight|scourge|deathlord/, "draugr"], [/skeleton/, "skeleton"], [/vampire/, "vampire"], [/hagraven/, "hagraven"],
      [/necromancer|mage|justiciar|thalmor|wizard|conjurer/, "mage"], [/forsworn|briarheart/, "forsworn"], [/centurion/, "centurion"], [/sphere|dwarven|construct/, "sphere"],
      [/falmer/, "falmer"], [/wisp|spriggan/, "wisp"], [/atronach/, "atronach"]];
    for (const [re, k] of R) if (re.test(n)) return k;
    if (tg.has("construct")) return "sphere";
    if (tg.has("undead")) return "skeleton";
    if (tg.has("beast")) return "wolf";
    return "bandit";
  }

  // ---------------------------------------------------------------- backgrounds (cached per kind, size, style)
  function drawBg(g, H, w, h, kind, sky) {
    const ground = h * 0.8;
    if (kind === "cave" || kind === "dwemer") {
      H.sky(g, w, h, "cave");
      const r = H.seeded(kind);
      g.fillStyle = kind === "dwemer" ? "#4a3a28" : "#2e241c";
      for (let i = 0; i < 9; i++) { const x = r() * w, ww = 30 + r() * 60; H.poly(g, [[x - ww / 2, 0], [x, 20 + r() * h * 0.25], [x + ww / 2, 0]], kind === "dwemer" ? "#5a4630" : "#3a2e24", P.ink, 1); }
      if (kind === "dwemer") { g.strokeStyle = "#b8893e"; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(0, h * (0.3 + i * 0.12)); g.lineTo(w, h * (0.28 + i * 0.12)); g.stroke(); } for (let x = 20; x < w; x += 70) H.circle(g, x, h * 0.42, 9, "#c9a24c", P.ink, 1.2); }
      const torch = (x) => { g.fillStyle = P.wood; g.fillRect(x - 2, h * 0.38, 4, 16); const gl = g.createRadialGradient(x, h * 0.36, 2, x, h * 0.36, 46); gl.addColorStop(0, "rgba(232,146,58,0.55)"); gl.addColorStop(1, "rgba(232,146,58,0)"); g.fillStyle = gl; g.fillRect(x - 46, h * 0.36 - 46, 92, 92); H.circle(g, x, h * 0.36, 4, P.fire, null); };
      torch(w * 0.12); torch(w * 0.88);
      g.fillStyle = "#4a3c30"; g.fillRect(0, ground, w, h - ground); H.inkPath(g, [[0, ground], [w, ground]], false, 1.4);
      return;
    }
    if (kind === "ruin") {
      if (sky) SKY.backdrop(g, H, w, h, sky, { horizon: 0.62, seed: "ruin" }); else H.sky(g, w, h, "dusk");
      H.mountains(g, w, h * 0.62, h * 0.32, 7, "#7d6c58", true);
      const r = H.seeded("ruin");
      for (let i = 0; i < 4; i++) { const x = w * (0.08 + i * 0.28) + r() * 10, ph = h * (0.25 + r() * 0.25); H.poly(g, [[x, ground], [x, ground - ph], [x + 16, ground - ph - 6], [x + 22, ground]], "#8f8574", P.ink, 1.2); }
      g.fillStyle = "#6f6656"; g.fillRect(0, ground, w, h - ground); H.inkPath(g, [[0, ground], [w, ground]], false, 1.4);
      if (sky) { SKY.snowCover(g, w, h, ground, sky.snow, "ruin"); SKY.overlay(g, H, w, h, sky, { seed: "ruin", ground, cover: false, weather: false }); }
      return;
    }
    const mood = kind === "snow" ? "snow" : kind === "ash" ? "dusk" : "day";
    if (sky) SKY.backdrop(g, H, w, h, kind === "snow" && sky.weather === "clear" && sky.tod === "day" ? { ...sky, weather: "snow" } : sky, { horizon: 0.6, seed: kind }); else H.sky(g, w, h, mood);
    H.mountains(g, w, h * 0.6, h * 0.36, kind.length * 7, kind === "ash" ? "#5a4a40" : P.rock, kind !== "ash");
    const grounds = { snow: P.snow, forest: "#6f7f48", autumn: "#a07a44", marsh: "#5f6a48", ash: "#6a5a50", rocky: "#9a8a72", tundra: P.tundra, camp: P.tundra, arena: "#b9a07a" };
    if (kind === "forest" || kind === "snow") H.pines(g, w, h * 0.72, 16, 11, 20);
    if (kind === "autumn") { const r = H.seeded("aut"); for (let i = 0; i < 14; i++) H.circle(g, r() * w, h * (0.6 + r() * 0.1), 8 + r() * 6, ["#a8622e", "#c08a3c", "#c9a24c"][i % 3], P.ink, 1); }
    if (kind === "camp") { H.poly(g, [[w * 0.06, ground], [w * 0.16, ground - 40], [w * 0.26, ground]], "#9a7a50", P.ink, 1.2); H.poly(g, [[w * 0.8, ground], [w * 0.88, ground - 30], [w * 0.96, ground]], "#8a6a44", P.ink, 1.2); }
    if (kind === "arena") { g.fillStyle = "#8f7a66"; g.fillRect(0, h * 0.45, w, ground - h * 0.45); for (let x = 0; x < w; x += 26) H.poly(g, [[x, ground - 2], [x, h * 0.45], [x + 22, h * 0.45], [x + 22, ground - 2]], "#a48f78", P.ink, 1); }
    if (kind === "arena" && typeof RAIDART !== "undefined") RAIDART.stands(g, w, h, h * 0.08, h * 0.45);   // the crowd in the stands (raidart.js)
    g.fillStyle = grounds[kind] || P.tundra; g.fillRect(0, ground, w, h - ground); H.inkPath(g, [[0, ground], [w, ground]], false, 1.4);
    if (kind === "snow" && !sky) { const r = H.seeded("flk"); g.fillStyle = "#fff"; for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * ground, 1.6, 1.6); }
    if (sky) { if (kind !== "snow") SKY.snowCover(g, w, h, ground, sky.snow, kind); SKY.overlay(g, H, w, h, sky, { seed: kind, ground, cover: false, weather: false }); }   // seasons and the light of the hour
  }
  const bgCache = new Map();
  function bgFor(kind, w, h, style, wagon, sky) {
    const k = `${kind}|${w}|${h}|${style}|${wagon || ""}|${sky ? sky.key : ""}`;
    const draw = (g, H) => { drawBg(g, H, w, h, kind, sky); if (wagon && typeof CARAVANS !== "undefined") { g.save(); g.translate(w * 0.36, h * 0.38); g.globalAlpha = 0.9; CARAVANS.drawWagon(g, H, w * 0.3, h * 0.42, { khajiit: wagon === "khajiit", cover: wagon !== "cart", animal: true }); g.restore(); } };   // a caravan or your cart behind the fight
    if (!bgCache.has(k)) { if (bgCache.size > 12) bgCache.delete(bgCache.keys().next().value); bgCache.set(k, ART.canvas(w, h, draw, { style, block: 3 })); }
    return bgCache.get(k);
  }

  // ---------------------------------------------------------------- figures (feet at 0,0, facing right, ~60u tall)
  const H = ART.H;
  function weapon(g, wt, glow) {
    g.save(); g.lineCap = "round";
    if (glow) { g.shadowColor = "#7fb6ff"; g.shadowBlur = 10; }
    const blade = glow ? "#bcd8ff" : P.steel;
    const line = (x1, y1, x2, y2, c, w) => { g.strokeStyle = P.ink; g.lineWidth = w + 2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    switch (wt) {
      case "dagger": line(0, 0, 10, -8, blade, 2.4); break;
      case "sword": line(0, 0, 4, -3, P.wood, 2.5); line(-3, -5, 5, 3, P.iron, 2); line(3, -3, 20, -20, blade, 3); break;
      case "greatsword": line(-2, 2, 4, -3, P.wood, 3); line(-4, -7, 7, 4, P.iron, 2.4); line(4, -3, 28, -28, blade, 3.6); break;
      case "axe": line(-2, 4, 14, -14, P.wood, 2.4); H.poly(g, [[11, -16], [19, -20], [20, -10], [14, -9]], blade, P.ink, 1); break;
      case "battleaxe": line(-4, 8, 20, -22, P.wood, 3); H.poly(g, [[16, -25], [28, -28], [28, -12], [20, -14]], blade, P.ink, 1.2); break;
      case "mace": case "warhammer": line(-2, 4, 14, -14, P.wood, 2.6); wt === "mace" ? H.circle(g, 16, -16, 5, P.iron, P.ink, 1.2) : H.poly(g, [[10, -22], [22, -14], [18, -9], [6, -17]], P.iron, P.ink, 1.2); break;
      case "spear": line(-12, 12, 26, -24, P.wood, 2.4); H.poly(g, [[24, -22], [32, -30], [28, -20]], blade, P.ink, 1); break;
      case "bow": g.strokeStyle = P.ink; g.lineWidth = 4; g.beginPath(); g.arc(-6, 0, 20, -1.1, 1.1); g.stroke(); g.strokeStyle = glow ? "#bcd8ff" : P.wood; g.lineWidth = 2.6; g.beginPath(); g.arc(-6, 0, 20, -1.1, 1.1); g.stroke();
        g.strokeStyle = "#e9dcc0"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-6 + 20 * Math.cos(-1.1), 20 * Math.sin(-1.1)); g.lineTo(-6 + 20 * Math.cos(1.1), 20 * Math.sin(1.1)); g.stroke(); break;
      case "crossbow": line(-8, 0, 16, 0, P.wood, 3.4); g.strokeStyle = P.ink; g.lineWidth = 3; g.beginPath(); g.arc(14, 0, 10, -1.4, 1.4); g.stroke(); g.strokeStyle = P.iron; g.lineWidth = 2; g.beginPath(); g.arc(14, 0, 10, -1.4, 1.4); g.stroke(); break;
      case "staff": line(-4, 18, 10, -30, P.wood, 2.6); { const gl = g.createRadialGradient(10, -32, 1, 10, -32, 9); gl.addColorStop(0, "#fff"); gl.addColorStop(1, "rgba(159,208,240,0)"); g.fillStyle = gl; g.beginPath(); g.arc(10, -32, 9, 0, 7); g.fill(); } break;
      case "club": line(-2, 6, 18, -24, P.wood, 5); break;
      default: break;
    }
    g.restore();
  }
  /* a person. o: {skin, body, head:'hair'|'helm'|'hood'|'horned'|'skull'|'mask'|'feathers'|'bird', wt, shield, cape, eyes, big, hunch, legs:'robe'|'legs', lunge(0..1)} */
  function person(g, o) {
    const sk = o.skin || SKIN.nord, body = o.body || P.leather, lean = (o.hunch || 0) + (o.lunge || 0) * 0.25;
    g.save(); g.lineJoin = "round"; g.lineCap = "round";
    // legs
    if (o.legs === "robe") H.poly(g, [[-11, 0], [-8, -28], [8, -28], [12, 0]], body, P.ink, 1.4);
    else { g.strokeStyle = P.ink; g.lineWidth = 7.5; g.beginPath(); g.moveTo(-1, -26); g.lineTo(-8, 0); g.moveTo(1, -26); g.lineTo(9, 0); g.stroke(); g.strokeStyle = o.pants || "#5a4836"; g.lineWidth = 5; g.beginPath(); g.moveTo(-1, -26); g.lineTo(-8, 0); g.moveTo(1, -26); g.lineTo(9, 0); g.stroke(); }
    g.rotate(lean);
    if (o.cape) H.poly(g, [[-8, -48], [-16, -10], [-4, -14]], o.cape, P.ink, 1.2);
    // back arm + shield
    g.strokeStyle = P.ink; g.lineWidth = 6.5; g.beginPath(); g.moveTo(-6, -46); g.lineTo(-12, -32); g.stroke(); g.strokeStyle = o.arm || sk; g.lineWidth = 4.2; g.beginPath(); g.moveTo(-6, -46); g.lineTo(-12, -32); g.stroke();
    if (o.shield) { g.save(); g.translate(-10, -34); H.poly(g, [[-2, -11], [8, -11], [9, 2], [3, 10], [-3, 2]], o.shieldColor || "#8a6a44", P.ink, 1.4); H.circle(g, 3, -2, 2, P.iron, null); g.restore(); }
    // torso
    H.poly(g, [[-9, -26], [-10, -48], [10, -48], [9, -26]], body, P.ink, 1.5);
    g.fillStyle = P.ink; g.fillRect(-9, -30, 18, 2.4);
    // head
    const hx = 1, hy = -56;
    if (o.head === "skull") { H.circle(g, hx, hy, 7, "#e6e0cc", P.ink, 1.4); g.fillStyle = P.ink; g.fillRect(hx - 4, hy - 2, 3, 3); g.fillRect(hx + 2, hy - 2, 3, 3); }
    else if (o.head === "bird") { H.circle(g, hx, hy, 7, "#7a6a7a", P.ink, 1.4); H.poly(g, [[hx + 5, hy - 2], [hx + 15, hy + 2], [hx + 5, hy + 3]], "#c9a24c", P.ink, 1); for (let i = 0; i < 4; i++) H.poly(g, [[hx - 6, hy - 6 + i * 3], [hx - 16, hy - 10 + i * 4], [hx - 6, hy - 3 + i * 3]], "#3a3040", null); }
    else { H.circle(g, hx, hy, 7, sk, P.ink, 1.4); if (o.head === "hair") H.poly(g, [[hx - 7, hy - 1], [hx - 6, hy - 7], [hx + 4, hy - 8], [hx + 7, hy - 4], [hx - 2, hy - 4]], o.hair || "#6b4a2a", null); }
    if (o.head === "helm" || o.head === "horned") { H.poly(g, [[hx - 8, hy + 1], [hx - 7, hy - 7], [hx + 7, hy - 7], [hx + 8, hy + 1]], o.helmColor || P.iron, P.ink, 1.3); if (o.head === "horned") { H.poly(g, [[hx - 7, hy - 5], [hx - 14, hy - 14], [hx - 8, hy - 8]], "#e6e0cc", P.ink, 1); H.poly(g, [[hx + 7, hy - 5], [hx + 14, hy - 14], [hx + 8, hy - 8]], "#e6e0cc", P.ink, 1); } }
    if (o.head === "hood") H.poly(g, [[hx - 9, hy + 6], [hx - 8, hy - 6], [hx, hy - 11], [hx + 8, hy - 5], [hx + 4, hy + 1], [hx - 4, hy + 4]], o.hoodColor || body, P.ink, 1.3);
    if (o.head === "mask") { H.poly(g, [[hx - 7, hy + 6], [hx - 8, hy - 6], [hx + 8, hy - 6], [hx + 7, hy + 6]], "#b8893e", P.ink, 1.3); }
    if (o.head === "feathers") for (let i = -1; i <= 1; i++) H.poly(g, [[hx + i * 4 - 1, hy - 6], [hx + i * 7, hy - 20], [hx + i * 4 + 2, hy - 6]], ["#8e2b25", "#e9dcc0", "#3d5d36"][i + 1], P.ink, 0.8);
    if (o.eyes) { g.fillStyle = o.eyes; g.shadowColor = o.eyes; g.shadowBlur = 6; g.fillRect(hx + 2, hy - 2, 3, 2); g.fillRect(hx - 3, hy - 2, 3, 2); g.shadowBlur = 0; }
    // front arm + weapon
    const ang = o.wt === "bow" || o.wt === "crossbow" ? 0 : -0.5 + (o.lunge || 0) * 1.1;
    g.save(); g.translate(7, -45); g.rotate(ang);
    g.strokeStyle = P.ink; g.lineWidth = 6.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(12, 8); g.stroke(); g.strokeStyle = o.arm || sk; g.lineWidth = 4.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(12, 8); g.stroke();
    g.translate(13, 9); weapon(g, o.wt, o.glow); g.restore();
    g.restore();
  }
  function quad(g, o) {   // wolves, bears, cats, skeevers, mammoths
    const c = o.color, L = o.len, Hh = o.height, lunge = (o.lunge || 0) * 4;
    g.save(); g.lineCap = "round";
    const legs = [[-L * 0.35, 0], [-L * 0.2, 0], [L * 0.25, 0], [L * 0.4, 0]];
    for (const [x] of legs) { g.strokeStyle = P.ink; g.lineWidth = o.legW + 2.4; g.beginPath(); g.moveTo(x, -Hh * 0.55); g.lineTo(x + (x > 0 ? lunge : -lunge * 0.3), 0); g.stroke(); g.strokeStyle = c; g.lineWidth = o.legW; g.beginPath(); g.moveTo(x, -Hh * 0.55); g.lineTo(x + (x > 0 ? lunge : -lunge * 0.3), 0); g.stroke(); }
    if (o.tail) H.inkPath(g, [[-L * 0.48, -Hh * 0.7], [-L * 0.75, -Hh * (o.tail === "long" ? 0.4 : 0.85)], [-L * (o.tail === "long" ? 1.05 : 0.8), -Hh * (o.tail === "long" ? 0.25 : 0.9)]], false, o.tail === "long" ? 1.6 : 4, o.tail === "long" ? "#b89a8a" : c);
    g.beginPath(); g.ellipse(0, -Hh * 0.68, L * 0.52, Hh * 0.34, 0, 0, 7); g.fillStyle = c; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1.5; g.stroke();
    if (o.stripes) { g.strokeStyle = P.ink; g.lineWidth = 1.4; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * L * 0.13, -Hh * 0.95); g.lineTo(i * L * 0.13 + 3, -Hh * 0.6); g.stroke(); } }
    const hx = L * 0.5 + lunge, hy = -Hh * (o.headY || 0.85);
    g.beginPath(); g.ellipse(hx, hy, o.head, o.head * 0.8, 0, 0, 7); g.fillStyle = c; g.fill(); g.strokeStyle = P.ink; g.stroke();
    H.poly(g, [[hx + o.head * 0.6, hy - o.head * 0.25], [hx + o.head * 1.6, hy + o.head * 0.1], [hx + o.head * 0.6, hy + o.head * 0.55]], c, P.ink, 1.3);
    if (o.ears) { H.poly(g, [[hx - o.head * 0.4, hy - o.head * 0.6], [hx - o.head * 0.2, hy - o.head * 1.5], [hx + o.head * 0.2, hy - o.head * 0.7]], c, P.ink, 1.2); }
    if (o.fangs) { g.fillStyle = "#fff"; g.fillRect(hx + o.head * 0.9, hy + o.head * 0.3, 2, 6); }
    if (o.tusks) { g.strokeStyle = "#f4efe0"; g.lineWidth = 3; g.beginPath(); g.moveTo(hx + o.head * 0.8, hy + o.head * 0.4); g.quadraticCurveTo(hx + o.head * 2.2, hy + o.head * 1.4, hx + o.head * 2.4, hy - o.head * 0.2); g.stroke(); }
    g.fillStyle = o.eye || P.ink; g.fillRect(hx + o.head * 0.25, hy - o.head * 0.3, 2.4, 2.4);
    g.restore();
  }
  function foeFig(g, kind, lunge, glowT) {
    const humanoid = (o) => person(g, { lunge, ...o });
    switch (kind) {
      case "bandit": return humanoid({ skin: SKIN.imperial, body: P.leather, head: "hood", hoodColor: "#5a4836", wt: "axe", shield: false });
      case "forsworn": return humanoid({ skin: SKIN.breton, body: "#7a5a3a", head: "feathers", wt: "sword", cape: "#5f6a48" });
      case "draugr": return humanoid({ skin: "#6a7f78", body: "#4a5550", head: "horned", helmColor: "#5a5a50", wt: "battleaxe", eyes: "#9fd0f0", arm: "#6a7f78" });
      case "skeleton": { g.save(); g.strokeStyle = "#e6e0cc"; g.lineWidth = 3; g.lineCap = "round"; const bone = (a, b) => { g.strokeStyle = P.ink; g.lineWidth = 4.6; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); g.strokeStyle = "#e6e0cc"; g.lineWidth = 2.6; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); };
        bone([-6, 0], [0, -26]); bone([7, 0], [0, -26]); bone([0, -26], [0, -48]); for (let i = 0; i < 3; i++) bone([-7, -44 + i * 5], [7, -44 + i * 5]); bone([0, -46], [-10, -32]); bone([0, -46], [12 + lunge * 6, -38]);
        H.circle(g, 1, -56, 7, "#e6e0cc", P.ink, 1.4); g.fillStyle = P.ink; g.fillRect(-3, -58, 3, 3); g.fillRect(3, -58, 3, 3); g.translate(13 + lunge * 6, -38); weapon(g, "sword"); g.restore(); return; }
      case "vampire": return humanoid({ skin: "#d8d4dc", body: "#3a2030", head: "hair", hair: "#1c1418", wt: "dagger", eyes: "#e0303a", cape: "#5a1020" });
      case "mage": return humanoid({ skin: SKIN.altmer, body: "#3a3a6a", legs: "robe", head: "hood", hoodColor: "#2a2a4a", wt: "staff" });
      case "hagraven": return humanoid({ skin: "#8a7a80", body: "#3a3040", legs: "robe", head: "bird", wt: "staff", hunch: 0.25 });
      case "falmer": return humanoid({ skin: "#c8c8b8", body: "#6a6050", head: "skull", wt: "sword", hunch: 0.35, arm: "#c8c8b8" });
      case "lich": g.save(); g.translate(0, -10 - Math.sin(glowT * 3) * 3); humanoid({ skin: "#5a5a50", body: "#3a2e24", legs: "robe", head: "mask", wt: "staff", eyes: "#9fd0f0" }); g.restore(); return;
      case "troll": g.save(); g.scale(1.35, 1.35); humanoid({ skin: "#d8dcd8", body: "#c8ccc8", head: "hair", hair: "#e8ece8", wt: "fist", hunch: 0.4, arm: "#d8dcd8", eyes: "#e8923a", pants: "#a8aca8" }); g.restore(); return;
      case "giant": g.save(); g.scale(1.5, 1.5); humanoid({ skin: "#b8a890", body: "#8a6a44", head: "hair", hair: "#8a8070", wt: "club" }); g.restore(); return;
      case "wolf": return quad(g, { color: "#7a7268", len: 44, height: 30, head: 8, legW: 3.4, tail: "bushy", ears: 1, fangs: 1, lunge });
      case "wolves": g.save(); g.translate(18, -6); g.globalAlpha = 0.85; quad(g, { color: "#5f5850", len: 40, height: 28, head: 7, legW: 3, tail: "bushy", ears: 1, lunge }); g.restore(); return quad(g, { color: "#7a7268", len: 44, height: 30, head: 8, legW: 3.4, tail: "bushy", ears: 1, fangs: 1, lunge });
      case "bear": return quad(g, { color: "#4a3426", len: 62, height: 44, head: 12, legW: 7, ears: 1, headY: 0.8, lunge });
      case "cat": return quad(g, { color: "#d8c8a0", len: 56, height: 34, head: 10, legW: 4.4, tail: "bushy", ears: 1, fangs: 1, stripes: 1, lunge });
      case "skeever": return quad(g, { color: "#7a6a5a", len: 28, height: 16, head: 6, legW: 2.4, tail: "long", ears: 1, eye: "#c4302a", lunge });
      case "mammoth": g.save(); g.scale(1.7, 1.7); quad(g, { color: "#6a5040", len: 64, height: 50, head: 14, legW: 8, tusks: 1, headY: 0.75, lunge }); g.restore(); return;
      case "spider": case "dspider": {
        const dw = kind === "dspider", c = dw ? "#b8893e" : "#d8dcd0";
        g.save(); g.lineCap = "round"; for (let i = 0; i < 4; i++) for (const sg of [-1, 1]) { const bx = sg * (4 + i * 4), k = 14 + i * 3; g.strokeStyle = P.ink; g.lineWidth = 3.6; g.beginPath(); g.moveTo(bx, -14); g.quadraticCurveTo(bx + sg * k, -30 + i * 2, bx + sg * (k + 8), 0); g.stroke(); g.strokeStyle = c; g.lineWidth = 2; g.stroke(); }
        g.beginPath(); g.ellipse(-12, -18, 15, 12, 0, 0, 7); g.fillStyle = dw ? "#a07a36" : "#c8ccc0"; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1.5; g.stroke();
        H.circle(g, 8 + lunge * 6, -16, 8, c, P.ink, 1.4); g.fillStyle = dw ? "#9fd0f0" : "#c4302a"; g.fillRect(11 + lunge * 6, -19, 2, 2); g.fillRect(14 + lunge * 6, -18, 2, 2); g.restore(); return; }
      case "crab": g.save(); H.poly(g, [[-18, -4], [-14, -18], [14, -18], [18, -4]], "#8a6a5a", P.ink, 1.5); for (const sg of [-1, 1]) { H.inkPath(g, [[sg * 14, -12], [sg * 24, -22], [sg * 30 + lunge * 6, -14]], false, 3.4, "#8a6a5a"); H.circle(g, sg * 30 + lunge * 6, -16, 5, "#a07a6a", P.ink, 1.2); } g.restore(); return;
      case "sphere": g.save(); H.circle(g, 0, -20, 15, "#b8893e", P.ink, 1.6); H.poly(g, [[-6, -34], [6, -34], [5, -52], [-5, -52]], "#c9a24c", P.ink, 1.3); H.circle(g, 0, -56, 6, "#b8893e", P.ink, 1.3); g.fillStyle = "#9fd0f0"; g.fillRect(1, -58, 4, 2); g.translate(8 + lunge * 6, -44); weapon(g, "sword"); g.restore(); return;
      case "centurion": g.save(); g.scale(1.6, 1.6); H.poly(g, [[-12, 0], [-10, -26], [10, -26], [12, 0]], "#a07a36", P.ink, 1.4); H.poly(g, [[-14, -26], [-14, -50], [14, -50], [14, -26]], "#c9a24c", P.ink, 1.5); H.poly(g, [[-6, -50], [-6, -62], [6, -62], [6, -50]], "#b8893e", P.ink, 1.3); g.fillStyle = "#e8923a"; g.fillRect(-3, -58, 6, 2);
        H.inkPath(g, [[14, -46], [22 + lunge * 8, -34], [26 + lunge * 8, -24]], false, 5, "#a07a36"); g.restore(); return;
      case "wisp": { g.save(); const gl = g.createRadialGradient(0, -36, 2, 0, -36, 26); gl.addColorStop(0, "rgba(255,255,255,0.95)"); gl.addColorStop(0.4, "rgba(159,208,240,0.6)"); gl.addColorStop(1, "rgba(159,208,240,0)"); g.fillStyle = gl; g.beginPath(); g.arc(0, -36, 26, 0, 7); g.fill();
        for (let i = 0; i < 4; i++) H.inkPath(g, [[0, -30], [Math.sin(glowT * 4 + i) * 10 - 6 + i * 4, -8], [i * 5 - 8, 0]], false, 1.2, "#9fd0f0"); g.restore(); return; }
      case "atronach": { g.save(); const fl = (x, y, r) => { const gl = g.createRadialGradient(x, y, 1, x, y, r); gl.addColorStop(0, "#fff2c0"); gl.addColorStop(0.5, P.fire); gl.addColorStop(1, "rgba(196,87,46,0)"); g.fillStyle = gl; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
        fl(0, -40, 18); fl(0, -58, 10); fl(-10, -20, 9); fl(10, -20, 9); g.restore(); return; }
      case "dragon": {
        g.save(); g.scale(1.25, 1.25); const c = "#5a6a5a", fl = Math.sin(glowT * 5) * 6;
        H.poly(g, [[-10, -40], [-40, -78 - fl], [-6, -60], [10, -86 - fl], [16, -46]], "#7a6a5a", P.ink, 1.5);   // wing
        H.inkPath(g, [[-30, -22], [-60, -20], [-78, -8]], false, 7, c);
        g.beginPath(); g.ellipse(-6, -28, 34, 16, -0.1, 0, 7); g.fillStyle = c; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1.6; g.stroke();
        for (const x of [-26, -12, 6, 18]) H.inkPath(g, [[x, -18], [x + 2, 0]], false, 5, c);
        H.inkPath(g, [[20, -36], [32 + lunge * 6, -54], [40 + lunge * 8, -58]], false, 8, c);
        H.poly(g, [[34 + lunge * 8, -66], [58 + lunge * 8, -58], [36 + lunge * 8, -50]], c, P.ink, 1.4);
        H.poly(g, [[38 + lunge * 8, -66], [32 + lunge * 8, -78], [44 + lunge * 8, -66]], "#e6e0cc", P.ink, 1);
        g.fillStyle = "#e8923a"; g.fillRect(44 + lunge * 8, -62, 3, 2); g.restore(); return; }
      default: return humanoid({ skin: SKIN.imperial, body: P.leather, head: "hair", wt: "sword" });
    }
  }
  const PERSON = new Set(["bandit", "forsworn", "draugr", "skeleton", "vampire", "mage", "hagraven", "falmer", "lich", "troll", "giant", "sphere", "centurion"]);
  function heroFig(g, h, lunge, glowT) {
    if (h.beast) return quad(g, { color: "#4a4038", len: 50, height: 40, head: 10, legW: 5, tail: "bushy", ears: 1, fangs: 1, lunge });
    person(g, { skin: h.skin, body: h.body, head: h.helm ? "helm" : "hair", wt: h.wt === "fist" ? null : h.wt, shield: h.shield && !["bow", "crossbow", "greatsword", "battleaxe", "warhammer", "staff"].includes(h.wt), lunge, glow: h.bound, cape: "#7a2a22" });
  }
  function ally(g, i) { g.save(); g.scale(0.62, 0.62); g.globalAlpha = 0.9; person(g, { skin: [SKIN.nord, SKIN.redguard, SKIN.dunmer][i % 3], body: ["#6a5a40", P.steel, "#4a5a3a"][i % 3], head: i % 2 ? "helm" : "hair", wt: ["sword", "axe", "bow"][i % 3], shield: i % 3 === 0 }); g.restore(); }

  // ---------------------------------------------------------------- what happened each turn (read from the log text)
  const elementOf = (t) => /fire|flame|incinerat|inferno|fireball|firebolt|scorch/i.test(t) ? "fire" : /frost|ice\b|ice |blizzard|freez|frostbite|icy/i.test(t) ? "frost"
    : /lightning|shock|spark|thunder|storm/i.test(t) ? "shock" : /sun|stendarr|turn|repel/i.test(t) ? "sun" : null;
  function beatsOf(f, h) {
    const lines = f.log || [];
    let pick = lines;
    if (lines.length > 14) { const st = (lines.length - 1) / 13; pick = Array.from({ length: 14 }, (_, i) => lines[Math.round(i * st)]); }
    const beats = []; let hp = f.hp0 ?? null, ehp = f.ehp0 ?? null;
    const nm = (f.e?.name || "").toLowerCase(), strip = (t) => (nm ? t.toLowerCase().split(nm).join("") : t.toLowerCase());
    for (const l of pick) {
      const parts = strip(l.me || "").split(" · "), me = parts[0], extra = parts.slice(1).join(" "), them = strip(l.them || "");
      const nhp = l.hp ?? hp, nehp = l.ehp ?? ehp;
      if (me) {
        const spell = /cast|spell|·|ward|cloak|heal|bound|summon|familiar|atronach|rune|wall|storm|conjur|raise/i.test(me) && !/^You (hit|bash|swing)/i.test(me);
        const kind = /drink|potion/i.test(me) ? "potion" : /heal|circle|close wounds/i.test(me) ? "heal" : /ward/i.test(me) ? "ward" : /cloak/i.test(me) ? "cloak" : /bound/i.test(me) ? "bound"
          : /summon|familiar|atronach|dremora|zombie|thrall|revenant|reanimat/i.test(me) ? "summon" : /block/i.test(me) ? "block" : /miss/i.test(me) && !/dmg|\d/.test(me) ? "miss"
          : elementOf(me) ? "spell" : ["bow", "crossbow"].includes(h.wt) ? "arrow" : "hit";
        beats.push({ who: "me", kind, el: elementOf(me) || (kind === "cloak" ? "fire" : null), dmg: ehp != null && nehp != null ? Math.max(0, Math.round(ehp - nehp)) : null, hp: hp, ehp: nehp, spell, burn: elementOf(extra) });
      }
      if (them) {
        const blocked = /block/i.test(them), missed = /miss|dodge|nothing/i.test(them) && !/\d/.test(them);
        beats.push({ who: "them", kind: blocked ? "blocked" : missed ? "miss" : elementOf(them) ? "spell" : "hit", el: elementOf(them), dmg: hp != null && nhp != null ? Math.max(0, Math.round(hp - nhp)) : null, hp: nhp, ehp: nehp });
      }
      if (!me && !them) beats.push({ who: "me", kind: "wait", hp: nhp, ehp: nehp });
      hp = nhp; ehp = nehp;
    }
    return beats;
  }

  // ---------------------------------------------------------------- the stage
  function register(f, s) {
    if (!f) return 0;
    if (IDS.has(f)) return IDS.get(f);
    const id = nextId++; IDS.set(f, id);
    const arena = !f.e && f.log && f.log.length && /hits for/.test(f.log[0].them || "");
    REG.set(id, { f, scene: arena ? "arena" : sceneOf(s), hero: { ...heroOf(s, f), bound: (f.log || []).some((l) => /bound/i.test(l.me || "")) }, foe: arena ? "bandit" : foeOf(f.e), wagon: f.e?.cart ? "cart" : f.e?.caravan ? (f.e.khajiit ? "khajiit" : "nord") : null, foeName: f.e?.name || (arena && (f.log[0].them.match(/^(.+?) hits for/) || [])[1]) || "Opponent", played: false });
    { const rec = REG.get(id), outdoor = !["cave", "dwemer"].includes(rec.scene) && !s?.dungeon; if (outdoor && typeof SKY !== "undefined" && s) rec.sky = SKY.state([s.x, s.y]); }   // the sky over this fight
    if (REG.size > 40) REG.delete(REG.keys().next().value);
    return id;
  }
  const placeholder = (f, s) => { const id = register(f, s); return id ? `<div class="fscene" data-fs="${id}" role="img" aria-label="Fight scene"></div>` : ""; };

  function mount(el) {
    const rec = REG.get(+el.dataset.fs); if (!rec || el.firstChild) return;
    const W = Math.max(300, Math.min(520, Math.round(el.clientWidth || 330))), Hh = Math.round(W * 0.46);
    const style = ART.style(), pixel = style === "pixel", dpr = Math.min(2, devicePixelRatio || 1);
    const cv = document.createElement("canvas"); cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);   // CSS scales it to the box (width:100%)
    if (pixel) cv.style.imageRendering = "pixelated";
    el.appendChild(cv);
    const g = cv.getContext("2d");
    const k = pixel ? 1 / 3 : dpr;
    const work = pixel ? Object.assign(document.createElement("canvas"), { width: Math.round(W * k), height: Math.round(Hh * k) }) : cv;
    const wg = work.getContext("2d");
    const bg = bgFor(rec.scene, W, Hh, style, rec.wagon, rec.sky);
    const wxp = rec.sky ? SKY.particles(rec.sky, W, Hh, { reduce: reduce() }) : null;   // snow, rain, leaves or fireflies during the replay
    let lastNow = performance.now();
    const f = rec.f, beats = beatsOf(f, rec.hero);
    const hp0 = f.hp0 ?? Math.max(1, ...((f.log || []).map((l) => l.hp).filter((v) => v != null)));
    const ehp0 = f.ehp0 ?? Math.max(1, ...((f.log || []).map((l) => l.ehp).filter((v) => v != null)));
    const hpMax = Math.max(hp0, 1), ehpMax = Math.max(ehp0, 1);
    const last = (f.log || [])[f.log.length - 1] || {};
    const won = f.won ?? (last.ehp != null && last.hp != null ? last.hp >= last.ehp : true);
    const per = Math.max(70, Math.min(420, 2600 / Math.max(1, beats.length)));
    const total = beats.length * per + 500;
    const groundY = Hh * 0.8, s = Hh / 150, hx0 = W * 0.27, fx0 = W * 0.72;
    let particles = [], floats = [], t0 = performance.now(), done = rec.played || reduce(), raf = 0, lastBeat = -1;
    const big = ["dragon", "giant", "mammoth", "centurion"].includes(rec.foe);

    function spawn(kind, el, x, y, dir) {
      const col = { fire: [P.fire, "#fff2c0", P.ember], frost: [P.frost, "#ffffff", "#7fb0c0"], shock: [P.shock, "#ffffff", "#8a7aff"], sun: ["#fff2a0", "#ffffff", P.gold], heal: ["#9fe08a", P.gold, "#ffffff"], potion: ["#e05050", "#ffb0b0"], summon: ["#a07aff", "#e0d0ff"] }[el || kind] || [P.fire, "#fff"];
      const n = kind === "burn" ? 8 : kind === "summon" || kind === "heal" || kind === "potion" ? 16 : 22;
      for (let i = 0; i < n; i++) particles.push({ x, y, vx: (kind === "spell" ? dir * (2 + Math.random() * 3) : (Math.random() - 0.5) * 1.6), vy: kind === "heal" || kind === "potion" || kind === "summon" ? -0.6 - Math.random() * 1.2 : (Math.random() - 0.5) * 1.6, life: 1, c: col[i % col.length], r: 1.5 + Math.random() * 2.5, kind, el });
    }
    function bars(beat) {
      const hp = beat ? beat.hp ?? hp0 : (done ? last.hp ?? hp0 : hp0), ehp = beat ? beat.ehp ?? ehp0 : (done ? last.ehp ?? ehp0 : ehp0);
      g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bw = W * 0.38, bh = pixel ? 8 : 7, y = 10;
      const bar = (x, v, max, col, name, right) => {
        g.fillStyle = "rgba(28,33,40,0.75)"; g.fillRect(x - 1, y - 1, bw + 2, bh + 2);
        g.fillStyle = col; const ww = Math.max(0, Math.min(1, (v ?? max) / max)) * bw; g.fillRect(right ? x + bw - ww : x, y, ww, bh);
        g.strokeStyle = P.gold; g.lineWidth = 1; if (!pixel) g.strokeRect(x - 0.5, y - 0.5, bw + 1, bh + 1);
        g.font = pixel ? "bold 11px monospace" : "600 12px Cinzel, Georgia, serif"; g.textAlign = right ? "right" : "left"; g.textBaseline = "top";
        g.fillStyle = "#1c2128"; g.fillText(name, (right ? x + bw : x) + 1, y + bh + 4); g.fillStyle = "#fbf3dc"; g.fillText(name, right ? x + bw : x, y + bh + 3);
      };
      bar(8, hp, hpMax, "#c0392b", "You", false);
      bar(W - 8 - bw, ehp, ehpMax, "#8e6b2b", rec.foeName.length > 22 ? rec.foeName.slice(0, 21) + "…" : rec.foeName, true);
      g.restore();
    }
    function frame(now) {
      if (!cv.isConnected) { cancelAnimationFrame(raf); return; }
      const t = done ? total : now - t0, bi = Math.min(beats.length - 1, Math.floor(t / per)), bt = (t - bi * per) / per, beat = done ? null : beats[bi];
      if (bi !== lastBeat && beat && !done) {
        lastBeat = bi;
        const fromX = beat.who === "me" ? hx0 + 24 * s : fx0 - 24 * s, toX = beat.who === "me" ? fx0 : hx0, y = groundY - 36 * s;
        if (beat.kind === "spell") spawn("spell", beat.el, fromX, y, beat.who === "me" ? 1 : -1);
        if (beat.burn) spawn("burn", beat.burn, fx0, groundY - 30 * s, 0);   // cloaks, walls and bleeding tick on the foe
        else if (["heal", "potion", "summon"].includes(beat.kind)) spawn(beat.kind, beat.kind, beat.who === "me" ? hx0 : fx0, groundY - 20 * s, 0);
        if (beat.dmg) floats.push({ x: toX + (Math.random() - 0.5) * 10, y: groundY - 70 * s * (big && beat.who === "me" ? 1.4 : 1), v: beat.dmg, life: 1, me: beat.who === "them" });
        if (beat.kind === "blocked") floats.push({ x: hx0 + 6, y: groundY - 74 * s, v: "Block!", life: 1, me: true });
        if (beat.kind === "miss") floats.push({ x: toX, y: groundY - 74 * s, v: "Miss", life: 1, me: beat.who === "them" });
      }
      const sc = k;
      wg.setTransform(1, 0, 0, 1, 0, 0); wg.imageSmoothingEnabled = !pixel;
      wg.drawImage(bg, 0, 0, work.width, work.height);
      wg.setTransform(sc, 0, 0, sc, 0, 0);
      const swing = beat ? Math.sin(Math.min(1, bt * 1.6) * Math.PI) : 0;
      const meL = beat && beat.who === "me" && ["hit", "arrow", "spell", "miss"].includes(beat.kind) ? swing : 0;
      const themL = beat && beat.who === "them" ? swing : 0;
      const shakeFoe = beat && beat.who === "me" && beat.dmg && bt > 0.35 ? Math.sin(bt * 40) * 3 * (1 - bt) : 0;
      const shakeMe = beat && beat.who === "them" && beat.dmg && bt > 0.35 ? Math.sin(bt * 40) * 3 * (1 - bt) : 0;
      const tt = now / 1000;
      // allies behind you
      for (let i = 0; i < Math.min(3, rec.hero.allies); i++) { wg.save(); wg.translate(hx0 - (26 + i * 18) * s, groundY + 2 - i * 2); wg.scale(s, s); ally(wg, i); wg.restore(); }
      // you
      const meDown = done && !won, foeDown = done && won;
      wg.save(); wg.translate(hx0 + meL * 26 * s + shakeMe, groundY); wg.scale(s, s);
      if (meDown) { wg.translate(-6, 0); wg.rotate(-Math.PI / 2); wg.translate(0, 6); }
      heroFig(wg, rec.hero, meL, tt);
      wg.restore();
      // ward / cloak / heal glows on you
      if (beat && beat.who === "me" && (beat.kind === "ward" || beat.kind === "cloak" || beat.kind === "bound")) {
        wg.save(); wg.globalAlpha = 0.55 * (1 - bt * 0.5); wg.strokeStyle = beat.kind === "ward" ? "#9fd0f0" : beat.kind === "bound" ? "#bcd8ff" : P.fire; wg.lineWidth = 3;
        wg.beginPath(); beat.kind === "ward" ? wg.arc(hx0 + 18 * s, groundY - 34 * s, 30 * s, -1.2, 1.2) : wg.ellipse(hx0, groundY - 32 * s, 22 * s, 38 * s, 0, 0, 7); wg.stroke(); wg.restore();
      }
      // the foe (faces left)
      wg.save(); wg.translate(fx0 - themL * 26 * s + shakeFoe, groundY); wg.scale(-s, s);
      if (foeDown) {
        if (["wisp", "atronach"].includes(rec.foe)) wg.globalAlpha = 0.25;   // spirits fade away
        else if (PERSON.has(rec.foe)) { wg.translate(-4, 0); wg.rotate(-Math.PI / 2); wg.translate(0, big ? 18 : 6); wg.globalAlpha = 0.9; }
        else { wg.translate(0, rec.foe === "dragon" ? -10 : -6); wg.scale(1, rec.foe === "dragon" ? 0.45 : -0.9); wg.translate(0, rec.foe === "dragon" ? 0 : 12); wg.globalAlpha = 0.9; }   // beasts roll over, dragons slump
      }
      foeFig(wg, rec.foe, themL, tt);
      wg.restore();
      // weather in front of the fighters
      if (wxp) { const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000)); lastNow = now; wxp.step(wg, done ? 0 : dt); }
      // arrows
      if (beat && beat.who === "me" && beat.kind === "arrow") { const ax = hx0 + 30 * s + (fx0 - hx0 - 40 * s) * Math.min(1, bt * 1.8), ay = groundY - 38 * s; wg.strokeStyle = P.ink; wg.lineWidth = 2; wg.beginPath(); wg.moveTo(ax - 14 * s, ay); wg.lineTo(ax, ay); wg.stroke(); wg.fillStyle = P.steel; wg.beginPath(); wg.moveTo(ax + 4 * s, ay); wg.lineTo(ax - 1, ay - 3); wg.lineTo(ax - 1, ay + 3); wg.fill(); }
      // block flash
      if (beat && beat.kind === "blocked" && bt < 0.6) { wg.save(); wg.globalAlpha = 0.8 * (1 - bt / 0.6); wg.fillStyle = "#fff"; wg.beginPath(); wg.arc(hx0 + 8 * s, groundY - 36 * s, 14 * s, 0, 7); wg.fill(); wg.restore(); }
      // particles
      for (const p of particles) {
        p.x += p.vx * s * 2.2; p.y += p.vy * s * 2.2; p.life -= 0.035;
        if (p.el === "shock" && p.kind === "spell") { wg.strokeStyle = p.c; wg.globalAlpha = Math.max(0, p.life); wg.lineWidth = 1.6; wg.beginPath(); wg.moveTo(p.x, p.y); wg.lineTo(p.x - 6 * s, p.y + (Math.random() - 0.5) * 8 * s); wg.stroke(); }
        else { wg.globalAlpha = Math.max(0, p.life); wg.fillStyle = p.c; wg.beginPath(); wg.arc(p.x, p.y, p.r * s, 0, 7); wg.fill(); }
      }
      wg.globalAlpha = 1; particles = particles.filter((p) => p.life > 0);
      // copy pixel work to the screen
      if (pixel) { g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(work, 0, 0, cv.width, cv.height); }
      bars(beat);
      // floating numbers (crisp, on the screen canvas)
      g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.textAlign = "center"; g.font = pixel ? "bold 14px monospace" : "700 15px Cinzel, Georgia, serif";
      for (const fl of floats) { fl.y -= 0.5; fl.life -= 0.02; g.globalAlpha = Math.max(0, fl.life); g.fillStyle = "#1c2128"; g.fillText(fl.v, fl.x + 1, fl.y + 1); g.fillStyle = fl.me ? "#ff8a7a" : "#fff2c0"; g.fillText(fl.v, fl.x, fl.y); }
      g.restore(); floats = floats.filter((x) => x.life > 0);
      // end banner
      if (done) { g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.font = pixel ? "bold 16px monospace" : "700 18px Cinzel, Georgia, serif"; g.textAlign = "center"; const txt = won ? "Victory" : "Defeated"; const by = Hh * 0.93; g.fillStyle = "rgba(28,33,40,0.6)"; g.fillRect(W / 2 - 60, by - 15, 120, 21); g.fillStyle = won ? P.gold : "#ff8a7a"; g.fillText(txt, W / 2, by + 1); g.restore(); }
      if (!done && t < total) raf = requestAnimationFrame(frame);
      else if (!done) { done = true; rec.played = true; particles = []; floats = []; raf = requestAnimationFrame(frame); }
    }
    cv.addEventListener("click", (e) => { e.stopPropagation(); if (!done) { done = true; rec.played = true; particles = []; floats = []; } });
    raf = requestAnimationFrame(frame);
  }
  // mount any fight scene the moment it lands on the page (modals, panels, dungeon screens)
  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
    const scan = (n) => { if (n.nodeType !== 1) return; if (n.matches?.(".fscene")) mount(n); n.querySelectorAll?.(".fscene").forEach(mount); };
    new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach(scan); }).observe(document.documentElement, { childList: true, subtree: true });
  }
  return { placeholder, register, foeOf, sceneOf, beatsOf, mount };
})();
