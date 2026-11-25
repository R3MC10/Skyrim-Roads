/* Fight scenes: a little animated stage above every fight log — where you are, you on the left, the foe on the
   right — that replays the whole fight turn by turn at a natural pace (about a second an action: wind-up, strike,
   impact, recovery). Every weapon swings its own way, every spell has its own effect, with particles, screen shake,
   hit-stop and a slow finishing blow. Tap the scene to skip (no speed buttons since build 146). Drawn with the shared ART
   toolkit (hand-drawn ink).
   It only reads the finished Fight (its log, what was done each turn, start/end health); it never changes a result. [OURS] */
const FIGHTART = (() => {
  const P = ART.PAL;
  const L = (x) => (typeof I18N_SWEEP !== "undefined" ? I18N_SWEEP.c(x) : x);   // words drawn on the picture, in the player's language
  const REG = new Map(), IDS = new WeakMap(); let nextId = 1;
  const IDLE = new Set();   // finished scenes still animating their painted backdrop (battlescene.js)
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
    if (t === T.VOLCANIC || t === T.ASH) return "ash";
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
    const mates = (f?.allies || []).filter((a) => a.look).slice(0, 7).map((a) => ({ name: a.name, look: a.look }));   // party members: drawn in their own gear
    const toSlot = (a) => ({ kind: allyKind(a), name: a.name, look: a.look || (a.follower && typeof PARTY !== "undefined" && a.fid ? PARTY.followerLook(a.fid) : null) });
    const list = (f?.allies || []).map(toSlot);
    for (const a of f?._downed || []) if (a && a.name && !list.some((x) => x.name === a.name)) list.push(toSlot(a));   // [OURS] knocked down, not gone: they lie there until they get back up (allyanim.js)
    if (f?.followerDown && !list.some((x) => x.name === f.followerDown)) { const fid = s?.follower?.id; list.push({ kind: "follower", name: f.followerDown, look: fid && fid !== "meeko" && typeof PARTY !== "undefined" ? PARTY.followerLook(fid) : null }); }
    if (s?.thrall && !(f?.allies || []).some((a) => a.thrall)) list.push({ kind: "zombie", name: s.thrall.name });
    let gearO = null; try { if (typeof GEARLOOK !== "undefined" && typeof HEROART !== "undefined" && s?.loadouts) gearO = GEARLOOK.person(HEROART.lookOf(s)); } catch { /* bare save */ }
    const off = f?.off && f?.eq?.offhand ? (G.wtype ? G.wtype(f.eq.offhand.item) : "sword") : null;   // dual wielding
    const ench = typeof COMBATFX !== "undefined" ? COMBATFX.glowOf(COMBATFX.enchantOf(f)) : null;   // [OURS] colour-coded glow (combatfx.js)
    let look = null; try { if (typeof HEROART !== "undefined" && s?.loadouts) look = HEROART.lookOf(s); } catch { /* bare save */ }
    return { skin: SKIN[s?.race] || SKIN.nord, wt, shield: !!f?.shield, off, ench, body: gearO?.body || body, helm: !!f?.armor?.head, allies, mates, list, beast: !!s?.beastForm, gearO, look };
  }
  function foeOf(e) {
    if (e?.look) return "player";   // another player: drawn in their own gear (matePerson)
    const n = (e?.name || "").toLowerCase(), tg = new Set(e?.tags || []);
    const sk = typeof SOLART !== "undefined" ? SOLART.foeKind(n) : null; if (sk) return sk;   // Solstheim's creatures (solart.js)
    if (tg.has("dragon") || /^dragon$|dragon\b(?! priest)/.test(n)) return "dragon";
    const R = [[/priest/, "lich"], [/troll/, "troll"], [/mammoth/, "mammoth"], [/giant(?! frostbite)(?!.*spider)/, "giant"], [/dwarven spider/, "dspider"], [/spider/, "spider"],
      [/bear/, "bear"], [/sabre|cat\b/, "cat"], [/werewolf/, "werewolf"], [/wolves|pack/, "wolves"], [/wolf/, "wolf"], [/skeever/, "skeever"], [/mudcrab|crab/, "crab"],
      [/draugr|restless|wight|scourge|deathlord/, "draugr"], [/skeleton/, "skeleton"], [/vampire/, "vampire"], [/hagraven/, "hagraven"],
      [/necromancer|mage|justiciar|thalmor|wizard|conjurer/, "mage"], [/forsworn|briarheart/, "forsworn"], [/centurion/, "centurion"], [/sphere|dwarven|construct/, "sphere"],
      [/falmer/, "falmer"], [/wisp|spriggan/, "wisp"], [/atronach/, "atronach"]];
    for (const [re, k] of R) if (re.test(n)) return k;
    if (tg.has("construct")) return "sphere";
    if (tg.has("undead")) return "skeleton";
    if (tg.has("beast")) return "wolf";
    return "bandit";
  }

  // ---------------------------------------------------------------- backgrounds (cached per kind and size)
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
    if (kind === "snow" && !sky) { const r = H.seeded("flk"); g.fillStyle = "rgba(255,255,255,0.85)"; g.beginPath(); for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * ground, rr = 0.6 + (i % 3) * 0.35; g.moveTo(x + rr, y); g.arc(x, y, rr, 0, 6.2832); } g.fill(); }   // round flakes in three sizes
    if (sky) { if (kind !== "snow") SKY.snowCover(g, w, h, ground, sky.snow, kind); SKY.overlay(g, H, w, h, sky, { seed: kind, ground, cover: false, weather: false }); }   // seasons and the light of the hour
  }
  const bgCache = new Map();
  function bgFor(kind, w, h, wagon, sky) {
    const k = `${kind}|${w}|${h}|${wagon || ""}|${sky ? sky.key : ""}`;
    const draw = (g, H) => { drawBg(g, H, w, h, kind, sky); if (wagon && typeof CARAVANS !== "undefined") { g.save(); g.translate(w * 0.36, h * 0.38); g.globalAlpha = 0.9; CARAVANS.drawWagon(g, H, w * 0.3, h * 0.42, { khajiit: wagon === "khajiit", cover: wagon !== "cart", animal: true }); g.restore(); } };   // a caravan or your cart behind the fight
    if (!bgCache.has(k)) { if (bgCache.size > 12) bgCache.delete(bgCache.keys().next().value); bgCache.set(k, ART.canvas(w, h, draw)); }
    return bgCache.get(k);
  }

  // ---------------------------------------------------------------- figures (feet at 0,0, facing right, ~60u tall)
  const H = ART.H;
  function weapon(g, wt, glow, draw = 0, wmat = null) {
    g.save(); g.lineCap = "round";
    const mg = wmat?.f?.glow;
    if (glow) { g.shadowColor = "#7fb6ff"; g.shadowBlur = 10; } else if (mg) { g.shadowColor = mg; g.shadowBlur = 7; }
    const blade = glow ? "#bcd8ff" : wmat && wmat.w !== "cloth" ? (wmat.d && /^#[0-3]/.test(wmat.c) ? wmat.c : wmat.trim) : P.steel;   // the blade shows its material: glass green, ebony black, dwarven bronze
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
        { const sx = -6 + 20 * Math.cos(1.1), sy = 20 * Math.sin(1.1), px = sx - draw * 13;   // the string, pulled back as you draw
          g.strokeStyle = "#e9dcc0"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(sx, -sy); g.lineTo(px, 0); g.lineTo(sx, sy); g.stroke();
          if (draw > 0.05) { g.strokeStyle = P.ink; g.lineWidth = 2.2; g.beginPath(); g.moveTo(px, 0); g.lineTo(px + 26, 0); g.stroke(); g.strokeStyle = "#c9a878"; g.lineWidth = 1.2; g.stroke(); H.poly(g, [[px + 30, 0], [px + 25, -2.5], [px + 25, 2.5]], P.steel, P.ink, 0.8); } }
        break;
      case "crossbow": line(-8, 0, 16, 0, P.wood, 3.4); g.strokeStyle = P.ink; g.lineWidth = 3; g.beginPath(); g.arc(14, 0, 10, -1.4, 1.4); g.stroke(); g.strokeStyle = P.iron; g.lineWidth = 2; g.beginPath(); g.arc(14, 0, 10, -1.4, 1.4); g.stroke();
        if (draw > 0.05) { g.strokeStyle = P.ink; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, -2); g.lineTo(20, -2); g.stroke(); g.strokeStyle = P.steel; g.lineWidth = 1.2; g.stroke(); } break;
      case "staff": line(-4, 18, 10, -30, P.wood, 2.6); { const gl = g.createRadialGradient(10, -32, 1, 10, -32, 9); gl.addColorStop(0, "#fff"); gl.addColorStop(1, "rgba(159,208,240,0)"); g.fillStyle = gl; g.beginPath(); g.arc(10, -32, 9, 0, 7); g.fill(); } break;
      case "club": line(-2, 6, 18, -24, P.wood, 5); break;
      default: break;
    }
    g.restore();
  }
  /* a person. o: {skin, body, head:'hair'|'helm'|'hood'|'horned'|'skull'|'mask'|'feathers'|'bird', wt, shield, cape, eyes, big, hunch, legs:'robe'|'legs', lunge(0..1)} */
  /* armour detail on the small fight torso (x -10..10, y -48..-26), from the set's features (GEARLOOK) */
  function gearTorso(g, gr, F) {
    const ink = P.ink, heavy = gr.w === "heavy";
    if (F.chain) { g.fillStyle = gr.d; for (let y = -45; y < -28; y += 3) for (let x = -8 + ((y / 3) % 2) * 1.5; x < 9; x += 3) g.fillRect(x, y, 1, 1); }
    if (F.scales) { g.strokeStyle = gr.d; g.lineWidth = 0.7; for (let y = -45; y < -29; y += 3.5) for (let x = -8; x < 9; x += 3.5) { g.beginPath(); g.arc(x, y, 1.7, 0, Math.PI); g.stroke(); } }
    if (F.seg) { g.strokeStyle = gr.d; g.lineWidth = 1; for (const y of [-42, -37, -32]) { g.beginPath(); g.moveTo(-9, y); g.quadraticCurveTo(0, y + 2.5, 9, y); g.stroke(); } }
    if (heavy) {
      H.poly(g, [[-7, -46], [7, -46], [6, -34], [0, -31], [-6, -34]], gr.trim, ink, 1);
      if (gr.metal) { const lg = g.createLinearGradient(-7, -46, 7, -32); lg.addColorStop(0.35, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255,0.45)"); lg.addColorStop(0.65, "rgba(255,255,255,0)"); g.fillStyle = lg; g.fillRect(-7, -46, 14, 14); }
      for (const sx of [-1, 1]) {   // pauldrons
        const x = sx * 10;
        H.poly(g, [[x - sx * 1, -50], [x + sx * 5, -49], [x + sx * 5, -42], [x - sx * 1, -42]], gr.d, ink, 1);
        if (F.spikes) for (let k = 0; k < (F.spikes > 1 ? 2 : 1); k++) H.poly(g, [[x + sx * (0.5 + k * 2.5), -50], [x + sx * (1.5 + k * 2.5), -56 - k], [x + sx * (2.5 + k * 2.5), -50]], gr.trim, ink, 0.8);
        if (F.bone) { g.strokeStyle = gr.trim; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x, -47); g.lineTo(x + sx * 4, -47); g.moveTo(x, -45); g.lineTo(x + sx * 4, -45); g.stroke(); }
      }
      if (F.plates) { g.strokeStyle = gr.d; g.lineWidth = 1; for (let i = 0; i < F.plates; i++) { g.beginPath(); g.moveTo(-8, -30 - i * 2.4); g.lineTo(8, -30 - i * 2.4); g.stroke(); } }
      if (F.tabard) H.poly(g, [[-3, -44], [3, -44], [3, -20], [-3, -20]], F.tabard, ink, 0.8);
    } else {
      if (F.sash) { g.strokeStyle = F.sash; g.lineWidth = 3; g.beginPath(); g.moveTo(-9, -47); g.lineTo(9, -28); g.stroke(); }
      if (F.ridges) H.poly(g, [[-6, -45], [6, -45], [5, -34], [-5, -34]], gr.trim, ink, 0.8);
      if (F.feathers) for (let k = 0; k < 3; k++) H.poly(g, [[-11 + k * 2, -48], [-13 + k * 3, -55], [-9 + k * 2, -48]], ["#8e2b25", "#e9dcc0", "#3d5d36"][k], ink, 0.6);
      if (F.rivets) { g.fillStyle = gr.trim; for (let y = -44; y < -30; y += 4) for (let x = -6; x < 7; x += 4) g.fillRect(x, y, 1.2, 1.2); }
    }
    if (F.gem) H.poly(g, [[0, -44], [3, -40], [0, -36], [-3, -40]], F.gem, ink, 0.7);
    if (F.translucent) { g.globalAlpha = 0.35; g.fillStyle = "#fff"; g.fillRect(-8, -47, 3, 18); g.globalAlpha = 1; }
    if (F.fur) for (let i = 0; i < 6; i++) H.circle(g, -9 + i * 3.6, -48 + (i % 2), F.fur > 1 ? 2.6 : 2.1, i % 2 ? "#d8c8a8" : "#b8a080", ink, 0.6);
    if (F.glow) { const rg = g.createRadialGradient(0, -38, 1, 0, -38, 14); rg.addColorStop(0, F.glow); rg.addColorStop(1, "rgba(0,0,0,0)"); g.globalAlpha = 0.35; g.fillStyle = rg; g.fillRect(-14, -52, 28, 28); g.globalAlpha = 1; }
  }
  function person(g, o) {
    const sk = o.skin || SKIN.nord, body = o.body || P.leather, lean = (o.hunch || 0) + (o.lunge || 0) * 0.25, gr = o.gear, GF = (gr && gr.f) || {};
    g.save(); g.lineJoin = "round"; g.lineCap = "round";
    const breath = o.t != null && !(o.lunge > 0.05) ? Math.sin(o.t * 2.2) : 0;   // idle breathing: the chest rises and falls
    // legs
    if (o.legs === "robe") H.poly(g, [[-11, 0], [-8, -28], [8, -28], [12, 0]], body, P.ink, 1.4);
    else { g.strokeStyle = P.ink; g.lineWidth = 7.5; g.beginPath(); g.moveTo(-1, -26); g.lineTo(-8, 0); g.moveTo(1, -26); g.lineTo(9, 0); g.stroke(); g.strokeStyle = o.pants || "#5a4836"; g.lineWidth = 5; g.beginPath(); g.moveTo(-1, -26); g.lineTo(-8, 0); g.moveTo(1, -26); g.lineTo(9, 0); g.stroke(); }
    if (o.boots && o.legs !== "robe") for (const x of [-8, 9]) H.poly(g, [[x - 3.5, -7], [x + 3.5, -7], [x + 5, 0], [x - 4, 0]], o.boots, P.ink, 1);
    g.rotate(lean);
    if (o.cape) { const sw = o.t != null ? Math.sin(o.t * 1.6) * 1.5 : 0; H.poly(g, [[-8, -48], [-16 - sw - (o.lunge || 0) * 5, -10], [-4, -14]], o.cape, P.ink, 1.2); }
    // back arm + shield (in front of the body when raised to guard or cast)
    const backArm = () => { const bc = Math.cos(o.back || 0), bs = Math.sin(o.back || 0), ex = -6 + (-6 * bc - 14 * bs), ey = -46 + (-6 * bs + 14 * bc);   // the back arm swings forward to guard or to cast
      g.strokeStyle = P.ink; g.lineWidth = 6.5; g.beginPath(); g.moveTo(-6, -46); g.lineTo(ex, ey); g.stroke(); g.strokeStyle = o.armC || sk; g.lineWidth = 4.2; g.beginPath(); g.moveTo(-6, -46); g.lineTo(ex, ey); g.stroke();
    if (o.shield) { g.save(); g.translate(-6, -46); g.rotate(o.back || 0); g.translate(-4, 12);
      if (o.shieldShape === "round") { H.circle(g, 3, -1, 9, o.shieldColor || "#8a6a44", P.ink, 1.4); g.strokeStyle = o.shieldTrim || P.iron; g.lineWidth = 1.6; g.beginPath(); g.arc(3, -1, 6.5, 0, 7); g.stroke(); H.circle(g, 3, -1, 2.2, o.shieldTrim || P.iron, P.ink, 0.8); }
      else { H.poly(g, [[-2, -11], [8, -11], [9, 2], [3, 10], [-3, 2]], o.shieldColor || "#8a6a44", P.ink, 1.4); if (o.shieldTrim) { g.strokeStyle = o.shieldTrim; g.lineWidth = 1.2; g.beginPath(); g.moveTo(3, -10); g.lineTo(3, 8); g.moveTo(-1, -3); g.lineTo(8, -3); g.stroke(); } else H.circle(g, 3, -2, 2, P.iron, null); }
      g.restore(); }
      };
    const front = (o.back || 0) < -0.8;
    if (!front) backArm();
    // torso
    g.save(); g.translate(0, -26); g.scale(1 + breath * 0.012, 1 + breath * 0.02); g.translate(0, 26);
    H.poly(g, [[-9, -26], [-10, -48], [10, -48], [9, -26]], body, P.ink, 1.5);
    if (gr) gearTorso(g, gr, GF);
    g.fillStyle = P.ink; g.fillRect(-9, -30, 18, 2.4);
    g.restore();
    if (front) backArm();
    if (o.off && !o.shield) { g.save(); g.translate(-3, -31); g.rotate(0.55 + (o.lunge || 0) * 0.7); weapon(g, o.off, o.glow, 0, o.wmat); H.circle(g, 0, 0, 2.6, sk, P.ink, 1); g.restore(); }   // dual wielding: the left-hand blade, held low in front
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
    const ang = o.aim != null ? o.aim : o.wt === "bow" || o.wt === "crossbow" ? 0 : -0.5 + (o.lunge || 0) * 1.1;
    g.save(); g.translate(7, -45); g.rotate(ang);
    g.strokeStyle = P.ink; g.lineWidth = 6.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(12, 8); g.stroke(); g.strokeStyle = o.armC || sk; g.lineWidth = 4.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(12, 8); g.stroke();
    g.translate(13, 9);
    if (o.flask) { H.poly(g, [[-3, -2], [3, -2], [4, -9], [1, -11], [1, -14], [-1, -14], [-1, -11], [-4, -9]], o.flask, P.ink, 1); }   // a potion at your lips
    else weapon(g, o.wt, o.glow, o.draw || 0, o.wmat);
    g.restore();
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
  let curFoeLook = null;   // the look of the player being fought, set just before drawing the foe
  let curDragon = null;    // the dragon's kind colours and whether it's flying (dragons.js)
  let curArchLook = null;  // a bandit archer, a draugr mage...: what this foe's archetype carries (foegroups.js)
  function foeFig(g, kind, lunge, glowT, pose) {
    const humanoid = (o) => { if (curArchLook && kind !== "player") Object.assign(o, curArchLook); o.lunge = lunge; if (pose) { o.aim = pose.aim; o.back = pose.back; o.hunch = (o.hunch || 0) + pose.lean; o.draw = pose.draw; if (pose.wt) o.wt = pose.wt; } return person(g, o); };
    if (typeof SOLART !== "undefined" && SOLART.foeFig(g, kind, lunge, glowT, { humanoid, quad: (o) => quad(g, { lunge, ...o }), SKIN })) return;
    switch (kind) {
      case "player": if (curFoeLook && rigged()) return HEROART.fightFigure(g, { look: curFoeLook }, { lunge, t: glowT, aim: pose?.aim, back: pose?.back, hunch: pose?.lean || 0, draw: pose?.draw, wt: pose?.wt || undefined, glow: !!curFoeLook.gl?.w });
        return humanoid({ ...matePerson(curFoeLook) });
      case "bandit": return humanoid({ skin: SKIN.imperial, body: P.leather, head: "hood", hoodColor: "#5a4836", wt: "axe", shield: false });
      case "forsworn": return humanoid({ skin: SKIN.breton, body: "#7a5a3a", head: "feathers", wt: "sword", cape: "#5f6a48" });
      case "draugr": return humanoid({ skin: "#6a7f78", body: "#4a5550", head: "horned", helmColor: "#5a5a50", wt: "battleaxe", eyes: "#9fd0f0", armC: "#6a7f78" });
      case "skeleton": { g.save(); g.strokeStyle = "#e6e0cc"; g.lineWidth = 3; g.lineCap = "round"; const bone = (a, b) => { g.strokeStyle = P.ink; g.lineWidth = 4.6; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); g.strokeStyle = "#e6e0cc"; g.lineWidth = 2.6; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); };
        bone([-6, 0], [0, -26]); bone([7, 0], [0, -26]); bone([0, -26], [0, -48]); for (let i = 0; i < 3; i++) bone([-7, -44 + i * 5], [7, -44 + i * 5]); bone([0, -46], [-10, -32]); bone([0, -46], [12 + lunge * 6, -38]);
        H.circle(g, 1, -56, 7, "#e6e0cc", P.ink, 1.4); g.fillStyle = P.ink; g.fillRect(-3, -58, 3, 3); g.fillRect(3, -58, 3, 3); g.translate(13 + lunge * 6, -38); weapon(g, "sword"); g.restore(); return; }
      case "werewolf": if (typeof BEASTART !== "undefined") { g.save(); g.scale(1.1, 1.1); BEASTART.wolf(g, { lunge, t: glowT }); g.restore(); return; }   // a wild werewolf on the road (beastpaths.js)
        return quad(g, { color: "#4a4038", len: 50, height: 40, head: 10, legW: 5, tail: "bushy", ears: 1, fangs: 1, lunge });
      case "vampire": return humanoid({ skin: "#d8d4dc", body: "#3a2030", head: "hair", hair: "#1c1418", wt: "dagger", eyes: "#e0303a", cape: "#5a1020" });
      case "mage": return humanoid({ skin: SKIN.altmer, body: "#3a3a6a", legs: "robe", head: "hood", hoodColor: "#2a2a4a", wt: "staff" });
      case "hagraven": return humanoid({ skin: "#8a7a80", body: "#3a3040", legs: "robe", head: "bird", wt: "staff", hunch: 0.25 });
      case "falmer": return humanoid({ skin: "#c8c8b8", body: "#6a6050", head: "skull", wt: "sword", hunch: 0.35, armC: "#c8c8b8" });
      case "lich": g.save(); g.translate(0, -10 - Math.sin(glowT * 3) * 3); humanoid({ skin: "#5a5a50", body: "#3a2e24", legs: "robe", head: "mask", wt: "staff", eyes: "#9fd0f0" }); g.restore(); return;
      case "troll": g.save(); g.scale(1.35, 1.35); humanoid({ skin: "#d8dcd8", body: "#c8ccc8", head: "hair", hair: "#e8ece8", wt: "fist", hunch: 0.4, armC: "#d8dcd8", eyes: "#e8923a", pants: "#a8aca8" }); g.restore(); return;
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
        g.save(); g.scale(1.25, 1.25); const c = curDragon?.body || "#5a6a5a", fl = Math.sin(glowT * (curDragon?.air ? 9 : 5)) * (curDragon?.air ? 12 : 6);
        H.poly(g, [[-10, -40], [-40, -78 - fl], [-6, -60], [10, -86 - fl], [16, -46]], curDragon?.wing || "#7a6a5a", P.ink, 1.5);   // wing
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
  const PERSON = new Set(["player", "bandit", "forsworn", "draugr", "skeleton", "vampire", "mage", "hagraven", "falmer", "lich", "troll", "giant", "sphere", "centurion"]);
  const TWO_HANDED = new Set(["bow", "crossbow", "greatsword", "battleaxe", "warhammer", "staff"]);
  function heroFig(g, h, lunge, glowT, pose) {
    if (h.lord && typeof BEASTART !== "undefined") return BEASTART.lord(g, { lunge, t: glowT });
    if (h.beast && typeof BEASTART !== "undefined") return BEASTART.wolf(g, { lunge, t: glowT });
    if (h.beast) return quad(g, { color: "#4a4038", len: 50, height: 40, head: 10, legW: 5, tail: "bushy", ears: 1, fangs: 1, lunge });
    const wt = pose?.wt || h.wt;
    if (h.look && rigged()) {   // the shared rigged character (figart.js), posed by the replay
      const w2 = wt === "fist" ? null : wt;
      return HEROART.fightFigure(g, { look: h.look }, { t: glowT, wt: w2, shield: h.shield && !TWO_HANDED.has(wt), shieldOut: true, off: !TWO_HANDED.has(wt) && wt !== "fist" ? h.off : null, lunge,
        glow: pose ? pose.glow : h.bound, aim: pose?.aim, back: pose?.back, hunch: pose?.lean || 0, draw: pose?.draw, flask: pose?.flask,
        move: pose?.move, mu: pose?.mu, hitU: pose?.hitU, power: pose?.power, knock: pose?.knock || 0, down: pose?.down || 0, ride: !!pose?.ride, rideLayer: pose?.rideLayer || null, dx: pose?.dx || 0 });
    }
    const go = h.gearO || {};
    person(g, { skin: h.skin, body: h.body, head: go.head || (h.helm ? "helm" : "hair"), helmColor: go.helmColor, hoodColor: go.hoodColor, armC: go.armC, pants: go.pants, boots: go.boots, legs: go.legs, gear: go.gear, wmat: go.wmat,
      shieldColor: go.shieldColor, shieldTrim: go.shieldTrim, shieldShape: go.shieldShape, t: glowT,
      wt: wt === "fist" ? null : wt, shield: h.shield && !TWO_HANDED.has(wt), off: !TWO_HANDED.has(wt) && wt !== "fist" ? h.off : null, lunge, glow: pose ? pose.glow : h.bound, cape: go.cape === undefined ? "#7a2a22" : go.cape,
      aim: pose?.aim, back: pose?.back, hunch: pose?.lean || 0, draw: pose?.draw, flask: pose?.flask });
  }
  /* a party member from their published look: skin, armor colour, helmet, weapon and shield */
  function matePerson(L) {
    if (typeof GEARLOOK !== "undefined") { const o = GEARLOOK.person(L); return { ...o, skin: SKIN[L?.r] || SKIN.nord, glow: !!L?.gl?.w }; }
    return { skin: SKIN[L?.r] || SKIN.nord, body: "#8a7a62", head: "hair", wt: "fist" };
  }
  const rigged = () => typeof HEROART !== "undefined" && !!HEROART.fightFigure;
  function mate(g, m) {
    g.save(); if (m.look && rigged()) HEROART.fightFigure(g, { look: m.look }, {}); else person(g, matePerson(m.look)); g.restore();
  }
  function ally(g, i) { g.save(); g.scale(0.62, 0.62); g.globalAlpha = 0.9; person(g, { skin: [SKIN.nord, SKIN.redguard, SKIN.dunmer][i % 3], body: ["#6a5a40", P.steel, "#4a5a3a"][i % 3], head: i % 2 ? "helm" : "hair", wt: ["sword", "axe", "bow"][i % 3], shield: i % 3 === 0 }); g.restore(); }

  /* [summ] every kind of helper gets its own figure: what an ally record is */
  const ALLY_KINDS = ["follower", "mate", "soldier", "zombie", "icewolf", "werewolf", "vlord", "gargoyle", "dremora", "valor", "odah", "dragon", "beast", "familiar", "flame_atronach", "frost_atronach", "storm_atronach", "dog"];
  const FLYERS = new Set(["odah", "dragon"]);
  const ALLY_W = { mate: 30, follower: 30, soldier: 20, zombie: 20, valor: 26, dremora: 24, icewolf: 36, beast: 40, familiar: 34, werewolf: 30, vlord: 30, gargoyle: 30, flame_atronach: 28, frost_atronach: 30, storm_atronach: 32 };   // how much room each figure needs in the line
  function allyKind(a) {
    if (!a) return "soldier";
    if (a.form === "wolf") return "werewolf";   // a teammate in Beast Form or Vampire Lord form (beastpaths.js: the form travels with their turn)
    if (a.form === "lord") return "vlord";
    if (a.kind && ALLY_KINDS.includes(a.kind)) return a.kind;
    if (a.look) return "mate";
    if (a.follower) return "follower";
    if (a.thrall) return "zombie";
    if (a.valor) return "valor";
    if (a.odah) return "odah";
    if (a.beast) return "beast";
    if (a.player || a.pid || a.host) return "soldier";   // a real player is never guessed from their name ("Dragon..." is not a dragon)
    const n = (a.name || "").toLowerCase();
    if (/ice wolf/.test(n)) return "icewolf";
    if (/werewolf/.test(n)) return "werewolf";
    if (/gargoyle/.test(n)) return "gargoyle";
    if (/dremora/.test(n)) return "dremora";
    if (/atronach/.test(n)) return /frost/.test(n) ? "frost_atronach" : /storm/.test(n) ? "storm_atronach" : "flame_atronach";
    if (/odahviing/.test(n)) return "odah";
    if (/dragon/.test(n)) return "dragon";
    if (/risen|zombie|corpse|thrall|revenant|dead/.test(n)) return "zombie";
    if (/familiar|spectral/.test(n)) return "familiar";
    if (/wild animal|bear|sabre|wolf/.test(n)) return "beast";
    return "soldier";
  }
  function summonKind(id, txt) {
    const t = `${id || ""} ${txt || ""}`.toLowerCase();
    if (/dremora/.test(t)) return "dremora";
    if (/flaming_familiar|flaming familiar/.test(t)) return "flame_atronach";
    if (/zombie|raise|reanimat|corpse|dead thrall/.test(t)) return "zombie";
    if (/atronach/.test(t)) return /frost/.test(t) ? "frost_atronach" : /storm|shock/.test(t) ? "storm_atronach" : "flame_atronach";
    return "familiar";
  }
  const ATRO = { flame_atronach: ["#fff2c0", "#e8823a", "rgba(196,87,46,0)"], frost_atronach: ["#ffffff", "#9fd0f0", "rgba(120,170,220,0)"], storm_atronach: ["#f4f0ff", "#9a8ae8", "rgba(110,90,200,0)"] };
  /* draws one helper at the origin, feet on the ground, facing the foe (right). o: { lunge 0..1, t seconds, i slot, look } */
  function allyFig(g, kind, o = {}) {
    const an = o.anim, t = o.t || 0, i = o.i || 0, rig = (kind === "mate" || kind === "follower") && o.look && rigged();
    let lunge = o.lunge || 0;
    if (o.rideLayer === "far" && !rig) return;   // [riding] only the painted rider has a far-leg pass
    g.save(); g.lineJoin = "round"; g.lineCap = "round";
    if (an && !rig) {   // [OURS] figures without the shared rig still act out their clip (allyanim.js): lunge, flinch, fall, get up
      const w = an.w == null ? 1 : an.w, fall = an.clip === "down" ? (an.from && an.from !== "down" ? w : 1) : an.from === "down" ? 1 - w : 0;
      if (an.clip === "attack") lunge = Math.max(lunge, Math.sin(Math.PI * Math.min(1, an.u / 0.8)) * w);
      if (an.clip === "hit" || (an.clip === "down" && an.from === "hit")) { const k = an.clip === "hit" ? w : 1 - w; g.translate(-3 * k, 0); g.rotate(-0.18 * k); }
      if (fall > 0) { g.translate(-6 * fall, 0); g.rotate(-Math.PI / 2 * fall); g.translate(0, 6 * fall); }
      if (an.clip === "block") g.translate(-2 * w, 0);
    }
    switch (kind) {
      case "mate": case "follower": {   // [followersize] full size, the same as you: the rig itself makes women and some races a touch shorter (figart.js bh)
        if (rig) { const sh = !!(o.look.eq && o.look.eq.shield) && !o.ride;   // [shieldshow] a party member's or follower's shield on their arm
          HEROART.fightFigure(g, { look: o.look }, an ? { t, clip: an.clip, u: an.u, from: an.from, fu: an.fu, w: an.w, ride: !!o.ride && an.clip !== "down", rideLayer: o.rideLayer || null, shield: sh, shieldOut: sh } : { lunge, t, ride: !!o.ride, rideLayer: o.rideLayer || null, shield: sh, shieldOut: sh }); }
        else if (o.look) person(g, { ...matePerson(o.look), lunge });
        else person(g, { skin: SKIN.nord, body: P.steel, head: "helm", wt: "sword", shield: true, lunge });
        break; }
      case "dog": {   // Meeko, the stray from the road
        g.scale(0.62, 0.62);
        quad(g, { color: "#8a6a48", len: 40, height: 26, head: 8, legW: 3.2, tail: "long", ears: 1, lunge });
        break; }
      case "zombie": {   // grey-green, hunched, tattered, a slow sway
        g.scale(0.7, 0.7); g.rotate(Math.sin(t * 1.7 + i) * 0.04);
        person(g, { skin: "#8a9a7c", body: "#5a5244", head: "hair", hair: "#3a3a30", wt: "fist", hunch: 6, eyes: "#c8f0a0", lunge });
        g.globalAlpha = 0.35; g.fillStyle = "#9ad070"; g.beginPath(); g.ellipse(0, -2, 14, 3, 0, 0, 7); g.fill();
        break; }
      case "icewolf": {   // a pale blue wolf with a breath of frost
        g.scale(0.78, 0.78); g.translate(0, -Math.abs(Math.sin(t * 9 + i)) * (lunge ? 4 : 1.2));
        quad(g, { color: "#b8d8f0", len: 44, height: 30, head: 8, legW: 3.4, tail: "bushy", ears: 1, fangs: 1, lunge, eye: "#e8fbff" });
        g.globalAlpha = 0.45; g.fillStyle = "#e8f6ff"; g.beginPath(); g.arc(30 + lunge * 6, -24, 4 + Math.sin(t * 4) * 1.5, 0, 7); g.fill();
        break; }
      case "werewolf": {
        g.scale(0.62, 0.62);
        if (typeof BEASTART !== "undefined") BEASTART.wolf(g, { lunge, t: t + i });
        else quad(g, { color: "#4a4038", len: 50, height: 40, head: 10, legW: 5, tail: "bushy", ears: 1, fangs: 1, lunge });
        break; }
      case "vlord": {
        g.scale(0.62, 0.62);
        if (typeof BEASTART !== "undefined") BEASTART.lord(g, { lunge, t: t + i });
        else quad(g, { color: "#3a2030", len: 40, height: 44, head: 9, legW: 4, ears: 1, fangs: 1, lunge });
        break; }
      case "gargoyle": {   // stone wings, hovering low, swoops when it strikes
        const hov = -10 - Math.sin(t * 2.4 + i) * 4 + lunge * 8;
        g.translate(lunge * 10, hov); g.scale(0.7, 0.7);
        const stone = "#7d7a72", dark = "#4c4a44", flap = Math.sin(t * 6) * 0.25;
        for (const side of [-1, 1]) { g.save(); g.translate(-2, -44); g.rotate(side * (0.5 + flap) - 0.35); H.poly(g, [[0, 0], [-34, -16], [-42, 2], [-30, 0], [-26, 12], [-14, 6]], side < 0 ? dark : stone, P.ink, 1.4); g.restore(); }
        g.beginPath(); g.ellipse(0, -30, 11, 16, 0.15, 0, 7); g.fillStyle = stone; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 1.5; g.stroke();
        H.inkPath(g, [[-4, -16], [-8, -2], [-2, 0]], false, 5, stone); H.inkPath(g, [[5, -16], [8, -2], [14, 0]], false, 5, stone);
        H.inkPath(g, [[6, -38], [18 + lunge * 12, -30 + lunge * 6], [24 + lunge * 14, -32]], false, 4.5, stone);
        g.beginPath(); g.arc(6, -50, 8, 0, 7); g.fillStyle = stone; g.fill(); g.stroke();
        H.poly(g, [[0, -56], [-4, -68], [4, -57]], dark, P.ink, 1); H.poly(g, [[8, -57], [12, -69], [12, -55]], dark, P.ink, 1);
        g.fillStyle = "#ff5a3a"; g.fillRect(9, -52, 3, 2);
        break; }
      case "dremora": {   // ebony-dark armour, horned helm, red glow
        g.scale(0.82, 0.82);
        person(g, { skin: "#7a3a34", body: "#2a2226", head: "horned", helmColor: "#3a2a2c", wt: "greatsword", eyes: "#ff6a3a", armC: "#3a2a2c", cape: "#5a1a1a", lunge });
        g.globalAlpha = 0.25 + Math.sin(t * 3) * 0.08; g.fillStyle = "#d8402a"; g.beginPath(); g.ellipse(0, -1, 16, 3.5, 0, 0, 7); g.fill();
        break; }
      case "valor": {   // a hero of Sovngarde: blue-white, see-through, a soft light
        g.scale(0.84, 0.84);
        const gl = g.createRadialGradient(0, -36, 2, 0, -36, 46); gl.addColorStop(0, "rgba(220,236,255,.16)"); gl.addColorStop(1, "rgba(160,200,255,0)");
        g.fillStyle = gl; g.beginPath(); g.arc(0, -36, 46, 0, 7); g.fill();
        g.globalAlpha = 0.62 + Math.sin(t * 2.2 + i) * 0.1;
        person(g, { skin: "#dfe9f6", body: "#a8c4e8", head: "horned", helmColor: "#c8dcf4", wt: ["greatsword", "battleaxe", "sword", "axe"][i % 4], shield: i % 2 === 1, shieldColor: "#b8d0f0", eyes: "#ffffff", cape: "#8aa8d8", lunge });
        break; }
      case "beast": {   // Animal Allegiance: a bear or a sabre cat turns on your foe
        g.scale(0.74, 0.74);
        if (i % 2) quad(g, { color: "#c8a86a", len: 46, height: 30, head: 9, legW: 3.6, tail: "long", ears: 1, fangs: 1, lunge });
        else quad(g, { color: "#5a4632", len: 52, height: 40, head: 11, legW: 6, tail: "stub", ears: 1, lunge });
        break; }
      case "familiar": {   // the spectral wolf
        g.scale(0.8, 0.8); g.globalAlpha = 0.62;
        quad(g, { color: "#8ab8f0", len: 44, height: 30, head: 8, legW: 3.4, tail: "bushy", ears: 1, fangs: 1, lunge, eye: "#ffffff" });
        break; }
      case "flame_atronach": case "frost_atronach": case "storm_atronach": {   // floating elementals
        const c = ATRO[kind], bob = Math.sin(t * 2.6 + i) * 4, fl = (x, y, r) => { const gl = g.createRadialGradient(x, y, 1, x, y, r); gl.addColorStop(0, c[0]); gl.addColorStop(0.5, c[1]); gl.addColorStop(1, c[2]); g.fillStyle = gl; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
        g.translate(lunge * 14, -8 + bob); g.scale(0.85, 0.85);
        if (kind === "frost_atronach") {   // a hulk of ice shards
          H.poly(g, [[-14, -20], [-18, -52], [-4, -70], [12, -58], [16, -24], [0, -14]], "#bfe0f4", P.ink, 1.4);
          H.poly(g, [[-18, -50], [-30, -40], [-22 + lunge * 6, -22]], "#9fc8e8", P.ink, 1.2); H.poly(g, [[14, -54], [28 + lunge * 10, -40], [18, -26]], "#9fc8e8", P.ink, 1.2);
          g.fillStyle = "#ffffff"; g.fillRect(-2, -60, 3, 3); g.fillRect(5, -60, 3, 3); fl(0, -40, 10);
        } else if (kind === "storm_atronach") {   // rocks orbiting a crackling core
          fl(0, -42, 16);
          for (let k = 0; k < 6; k++) { const a = t * 1.6 + k * 1.047, rx = Math.cos(a) * 18, ry = Math.sin(a) * 26; H.poly(g, [[rx - 5, -42 + ry - 4], [rx + 4, -42 + ry - 5], [rx + 5, -42 + ry + 4], [rx - 4, -42 + ry + 5]], "#6a6478", P.ink, 1); }
          g.strokeStyle = "#e8e4ff"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-6, -50); g.lineTo(2, -44); g.lineTo(-3, -38); g.lineTo(6, -32); g.stroke();
        } else {   // a woman of fire
          fl(0, -44, 17); fl(0, -64, 9); fl(-10, -22, 9); fl(10 + lunge * 8, -40, 8);
          g.fillStyle = "#3a1a10"; g.beginPath(); g.ellipse(0, -46, 6, 13, 0, 0, 7); g.fill(); g.beginPath(); g.arc(0, -64, 5, 0, 7); g.fill();
        }
        break; }
      case "odah": case "dragon": {   // flies: the dragon figure, facing the foe
        g.scale(kind === "odah" ? 0.72 : 0.62, kind === "odah" ? 0.72 : 0.62);
        foeFig(g, "dragon", lunge, t);
        if (kind === "odah") { g.globalAlpha = 0.35; g.fillStyle = "#c0402a"; g.beginPath(); g.ellipse(-6, -34, 30, 12, -0.1, 0, 7); g.fill(); }   // Odahviing's red scales
        break; }
      default: { g.scale(0.62, 0.62); g.globalAlpha = 0.9; person(g, { skin: [SKIN.nord, SKIN.redguard, SKIN.dunmer][i % 3], body: ["#6a5a40", P.steel, "#4a5a3a"][i % 3], head: i % 2 ? "helm" : "hair", wt: ["sword", "axe", "bow"][i % 3], shield: i % 3 === 0, lunge }); }
    }
    g.restore();
  }
  const SPARK = { icewolf: ["#e8f6ff", 2, -10], flame_atronach: ["#ffb060", 0, -40], frost_atronach: ["#e8f6ff", 2, 8], storm_atronach: ["#d8d0ff", 1, 0], valor: ["#dcecff", 4, -20], dremora: ["#ff7a4a", 0, -30], familiar: ["#bcd8ff", 0, -10], zombie: ["#a8d080", 2, -6] };

  // ---------------------------------------------------------------- what happened each turn
  // The log says what was done each turn (line.a: "attack", "power_attack", "block", "spell:firebolt", "dual:…",
  // "scroll:…", "potion:…", "shout:…", "power:…"; line.wt: the weapon in hand). Older logs (and the arena) only have text.
  const elementOf = (t) => /fire|flame|incinerat|inferno|fireball|firebolt|scorch/i.test(t) ? "fire" : /frost|ice\b|ice |blizzard|freez|frostbite|icy/i.test(t) ? "frost"
    : /lightning|shock|spark|thunder|storm/i.test(t) ? "shock" : /sun|stendarr|turn|repel/i.test(t) ? "sun" : null;
  const KIND_FX = { heal: "heal", armor: "armor", summon: "summon", calm: "illusion", fear: "illusion", courage: "illusion", rune: "rune", cloak: "cloak", dot: "wall", ward: "ward",
    turn: "turn", regen: "circle", utility: "glow", paralyze: "paralyze", bound: "bound", reanimate: "necro", soultrap: "soultrap", invisibility: "invis",
    healally: "support", allyward: "support", allyarmor: "support", allyimbue: "support", allycourage: "support", allyunseen: "support", allyrescue: "support", allythorns: "support",
    banish: "turn", equilibrium: "glow", absorb: "shock" };
  const SHOUT_FX = { unrelenting_force: "fus", disarm: "fus", fire_breath: "breath", frost_breath: "breath", ice_form: "frost", kynes_peace: "illusion", become_ethereal: "invis", dragon_aspect: "armor" };
  const RACE_FX = { dunmer: "cloak", nord: "illusion", imperial: "illusion", bosmer: "illusion", breton: "ward", argonian: "heal", khajiit: "invis", redguard: "glow", altmer: "glow", orc: "glow" };
  const AT_FOE = new Set(["sun", "wall", "rune", "illusion", "soultrap", "necro"]), PROJ = new Set(["fire", "frost", "shock", "paralyze"]);
  const spells = () => (typeof D !== "undefined" && D.SPELLS) || {};
  function spellFx(id, text) {   // which effect a spell plays: fire, frost, shock, sun, heal, ward, cloak, rune, wall, …
    let sp = spells()[id];
    if (sp && sp.kind === "custom") sp = (sp.parts || []).map((p) => spells()[p]).find((x) => x && x.kind === "damage") || spells()[(sp.parts || [])[0]] || sp;
    if (!sp) { const el = elementOf(text || ""); return { fx: el || (/heal/i.test(text) ? "heal" : /ward/i.test(text) ? "ward" : "glow"), el }; }
    if (sp.kind === "damage") return { fx: sp.element || "fire", el: sp.element || "fire" };
    const fx = KIND_FX[sp.kind] || "glow";
    return { fx, el: sp.element || (fx === "cloak" ? "fire" : null), turns: sp.turns, name: sp.name, storm: /storm|blizzard/i.test(sp.name || "") };
  }
  // the moves. Each row: [u, arm aim, back arm, lean, step forward, rise, bow draw (or a beast's lunge), easing]
  const R = (u, aim, back, lean, dx, dy, draw, e) => [u, aim, back, lean, dx, dy, draw, e || "io"];
  const I0 = (u, e) => R(u, -0.5, 0, 0, 0, 0, 0, e), B0 = (u, e) => R(u, 0, 0, 0, 0, 0, 0, e);
  const MOVES = {
    dagger: { dur: 850, hits: [0.32, 0.5], trail: "stab", fx: "stab", kf: [I0(0), R(0.2, -0.9, 0, -0.05, 70, 0, 0), R(0.32, 0.15, 0, 0.2, 96, 0, 0, "in"), R(0.41, -0.7, 0, 0.06, 88, 0, 0, "out"), R(0.5, 0.2, 0, 0.22, 98, 0, 0, "in"), R(0.7, -0.3, 0, 0.05, 76, 0, 0, "out"), I0(1)] },
    sword: { dur: 950, hits: [0.44], trail: "arc", fx: "slash", kf: [I0(0), R(0.26, -2.1, 0, -0.12, 74, 0, 0), R(0.44, 0.95, 0, 0.2, 96, 0, 0, "in"), R(0.6, 0.8, 0, 0.15, 92, 0, 0, "out"), I0(1)] },
    axe: { dur: 950, hits: [0.46], trail: "arc", fx: "chop", kf: [I0(0), R(0.3, -2.7, 0, -0.2, 74, -3, 0), R(0.46, 0.75, 0, 0.3, 94, 0, 0, "in"), R(0.62, 0.6, 0, 0.26, 90, 0, 0, "out"), I0(1)] },
    mace: { dur: 950, hits: [0.46], trail: "arc", fx: "dust", kf: [I0(0), R(0.28, -1.8, 0, -0.12, 74, 0, 0), R(0.46, 1.05, 0, 0.24, 96, 0, 0, "in"), R(0.62, 0.9, 0, 0.2, 92, 0, 0, "out"), I0(1)] },
    greatsword: { dur: 1100, hits: [0.5], trail: "wide", fx: "sweep", kf: [I0(0), R(0.34, -2.5, 0, -0.24, 70, 0, 0), R(0.5, 1.3, 0, 0.34, 98, 0, 0, "in"), R(0.68, 1.1, 0, 0.28, 94, 0, 0, "out"), I0(1)] },
    battleaxe: { dur: 1150, hits: [0.52], trail: "arc", fx: "slam", kf: [I0(0), R(0.22, -1.6, 0, -0.1, 56, 0, 0), R(0.38, -3.0, 0, -0.3, 80, -9, 0, "out"), R(0.52, 0.95, 0, 0.4, 96, 0, 0, "in"), R(0.72, 0.9, 0, 0.36, 92, 0, 0, "out"), I0(1)] },
    spear: { dur: 900, hits: [0.42], trail: "stab", fx: "pierce", kf: [I0(0), R(0.26, 0.35, 0, -0.14, 52, 0, 0), R(0.42, 0.5, 0, 0.24, 84, 0, 0, "in"), R(0.58, 0.45, 0, 0.18, 78, 0, 0, "out"), I0(1)] },
    bow: { dur: 1050, hits: [0.72], proj: [0.52, 0.72, "arrow"], kf: [B0(0), R(0.15, -0.05, -0.9, 0, 0, 0, 0.1), R(0.42, -0.05, -1.0, -0.04, -3, 0, 1), R(0.5, -0.05, -1.0, -0.04, -3, 0, 1), R(0.53, -0.05, -0.8, -0.1, -5, 0, 0, "out"), B0(1)] },
    crossbow: { dur: 800, hits: [0.42], proj: [0.32, 0.42, "bolt"], kf: [R(0, 0, 0, 0, 0, 0, 1), R(0.28, -0.02, -0.6, 0.02, 0, 0, 1), R(0.32, -0.08, -0.6, -0.12, -7, 0, 0, "out"), R(0.6, -0.02, -0.4, -0.04, -2, 0, 0), R(1, 0, 0, 0, 0, 0, 1)] },
    staff: { dur: 1000, hits: [0.66], proj: [0.46, 0.66, "spell"], charge: [0.12, 0.46], kf: [I0(0), R(0.3, -1.5, -0.8, -0.1, 0, 0, 0), R(0.46, -0.2, -0.3, 0.14, 8, 0, 0, "in"), R(0.7, -0.3, -0.2, 0.08, 6, 0, 0, "out"), I0(1)] },
    fist: { dur: 900, hits: [0.24, 0.62], fx: "punch", kf: [I0(0), R(0.12, -0.3, 0, 0, 76, 0, 0), R(0.24, -0.05, 0, 0.16, 96, 0, 0, "in"), R(0.36, -0.6, 0, 0.02, 86, 0, 0, "out"), R(0.5, -1.3, 0, -0.12, 84, 0, 0), R(0.62, 0.55, 0, 0.26, 98, 0, 0, "in"), R(0.78, -0.3, 0, 0.05, 80, 0, 0, "out"), I0(1)] },
    bash: { dur: 850, hits: [0.42], fx: "bash", kf: [I0(0), R(0.25, -0.5, -0.6, -0.1, 72, 0, 0), R(0.42, -0.5, -1.7, 0.28, 100, 0, 0, "in"), R(0.6, -0.5, -1.6, 0.18, 94, 0, 0, "out"), I0(1)] },
    block: { dur: 650, hits: [], kf: [I0(0), R(0.3, -0.6, -1.66, -0.08, -4, 0, 0, "out"), R(1, -0.6, -1.66, -0.08, -4, 0, 0)] },
    cast: { dur: 1000, hits: [0.64], proj: [0.44, 0.64, "spell"], charge: [0.1, 0.44], kf: [I0(0), R(0.3, -1.5, -1.4, -0.08, -2, 0, 0), R(0.44, -0.25, -0.5, 0.14, 6, 0, 0, "in"), R(0.7, -0.35, -0.3, 0.06, 4, 0, 0, "out"), I0(1)] },
    self: { dur: 950, hits: [0.46], charge: [0.1, 0.4], kf: [I0(0), R(0.32, -1.9, -1.9, -0.1, 0, 0, 0), R(0.46, -1.6, -1.6, -0.04, 0, -2, 0), R(0.8, -1.2, -1.0, 0, 0, 0, 0, "out"), I0(1)] },
    potion: { dur: 850, hits: [0.52], flask: 1, kf: [I0(0), R(0.3, -2.2, 0, -0.18, 0, 0, 0), R(0.65, -2.2, 0, -0.2, 0, 0, 0), I0(1)] },
    shout: { dur: 1000, hits: [0.6], proj: [0.46, 0.6, "wave"], kf: [I0(0), R(0.32, -0.5, 0, -0.22, -4, 0, 0), R(0.46, -0.3, 0, 0.26, 6, 0, 0, "in"), R(0.8, -0.3, 0, 0.2, 4, 0, 0), I0(1)] },
    wait: { dur: 480, hits: [], kf: [I0(0), I0(1)] },
    // the foe's own moves
    bite: { dur: 850, hits: [0.48], fx: "bite", kf: [B0(0), R(0.3, 0, 0, -0.08, -6, 0, 0), R(0.48, 0, 0, 0.12, 104, -6, 1, "in"), R(0.62, 0, 0, 0.06, 96, 0, 0.7, "out"), B0(1)] },
    claw: { dur: 900, hits: [0.48], fx: "claw", kf: [B0(0), R(0.3, 0, 0, -0.18, -4, -8, 0), R(0.48, 0, 0, 0.16, 100, 0, 1, "in"), R(0.64, 0, 0, 0.08, 92, 0, 0.6, "out"), B0(1)] },
    stomp: { dur: 1100, hits: [0.52], fx: "slam", kf: [B0(0), R(0.36, 0, 0, -0.3, 40, -8, 0), R(0.52, 0, 0, 0.1, 70, 0, 1, "in"), R(0.72, 0, 0, 0.04, 64, 0, 0.4, "out"), B0(1)] },
    slam: { dur: 1150, hits: [0.52], fx: "slam", kf: [I0(0), R(0.36, -3.0, 0, -0.25, 50, -4, 0), R(0.52, 0.9, 0, 0.36, 74, 0, 0, "in"), R(0.72, 0.85, 0, 0.3, 70, 0, 0, "out"), I0(1)] },
    breath: { dur: 1250, hits: [0.56], proj: [0.36, 0.86, "cone"], kf: [B0(0), R(0.3, 0, 0, -0.15, -4, -6, 0), R(0.38, 0, 0, 0.1, 4, 0, 0.6, "in"), R(0.86, 0, 0, 0.1, 4, 0, 0.6), B0(1)] },
    drain: { dur: 1000, hits: [0.6], proj: [0.36, 0.8, "drain"], kf: [I0(0), R(0.3, -1.2, -1.2, -0.06, 0, 0, 0), R(0.4, -0.3, -0.6, 0.1, 6, 0, 0, "in"), R(0.8, -0.3, -0.6, 0.1, 6, 0, 0), I0(1)] },
  };
  MOVES.club = MOVES.mace; MOVES.warhammer = MOVES.battleaxe;
  const WEAPONS = ["dagger", "sword", "greatsword", "axe", "battleaxe", "mace", "warhammer", "spear", "bow", "crossbow", "staff", "fist", "club"];
  const FOE_MOVE = { wolf: "bite", wolves: "bite", skeever: "bite", spider: "bite", dspider: "bite", crab: "claw", bear: "claw", cat: "claw", troll: "claw", mammoth: "stomp", giant: "slam", centurion: "slam",
    dragon: "breath", mage: "cast", hagraven: "cast", lich: "cast", wisp: "cast", atronach: "cast", bandit: "axe", forsworn: "sword", draugr: "battleaxe", skeleton: "sword", vampire: "dagger", falmer: "sword", sphere: "sword" };
  const FOE_EL = { mage: "shock", hagraven: "fire", lich: "frost", wisp: "frost", atronach: "fire", dragon: "fire" };
  const REACH = { bear: 0.88, cat: 0.9, mammoth: 0.55, giant: 0.72, troll: 0.78, centurion: 0.66, skeever: 1.06, dragon: 0.5 };
  const SIZE = { giant: 1.5, troll: 1.35, centurion: 1.6, mammoth: 1.5, dragon: 1.1, werewolf: 1.25 };
  const moveFor = (wt) => MOVES[wt] ? wt : "sword";
  // [phantom] only a real blow is drawn as one. Your moves that aren't blows (Breathe, Mark, Cover, Mount, an end-of-round
  // tick: a burn, bleed or poison doing its work) and the foe's turns that aren't blows (winding up, taking aim, a war cry,
  // a potion, a ward, bracing behind a shield, a new foe stepping in) used to fall through to a weapon swing.
  const MY_KNOWN = new Set(["attack", "power_attack", "block", "bash", "spell", "dual", "scroll", "potion", "shout", "power", "beast", "lord", "vamp"]);
  const FOE_PREP = [[/winding up|lifts the weapon high/, "Winds up!"], [/takes careful aim/, "Takes aim!"], [/war cry|howls, hackles/, "War cry!"],
    [/gulps down|casts a healing spell|wounds close up/, "Heals"], [/raises a ward/, "Ward up"], [/raises a shield and braces/, "Braces"], [/slips into the shadows/, "Hides"],
    [/circles overhead/, "Takes flight"], [/steps in!/, null]];
  const FOE_BLOW = /\bhits\b|misses|goes for|attacks, but|steps on your|is absorbed|passes through|soaks|reflected|knocks/;
  function foePrep(them) {   // a foe's turn that isn't a blow -> [label] (the text is already lower case, the foe's name cut out)
    const t = String(them || "").replace(/^ ?ambush! /, "").split(" · ").filter((x) => !/^ *you take \d+ from /.test(x)).join(" · ").replace(/\([^)]*\)/g, "");
    if (FOE_BLOW.test(t)) return null;
    const p = FOE_PREP.find(([re]) => re.test(t));
    return p ? [p[1]] : !/\S/.test(t) ? [null] : null;
  }
  function beatsOf(f, h) {
    const lines = f.log || [], beats = [];
    let hp = f.hp0 ?? null, ehp = f.ehp0 ?? null;
    const nm = (f.e?.name || "").toLowerCase(), strip = (t) => (nm ? t.toLowerCase().split(nm).join("") : t.toLowerCase());
    const kind = foeOf(f.e), archer = /archer|hunter|marksman|ranger|sniper|bowman|crossbow|ballista|sharpshooter/.test(nm), bolter = /crossbow|ballista/.test(nm), base = f.wt0 || h.wt;
    const st = { bound: false, invis: false, rune: null, ward: false, soul: false, cloak: null, guard: false, beast: false, lord: false, summon: null };
    { const as = lines.map((l) => l.a || ""), back = lines.some((l) => /change back/.test(l.me || ""));   // a turn-by-turn screen shows a few lines at a time: start in the form you're in (beastpaths.js)
      if (!as.includes("power:beast")) st.beast = (f.pw?.beast || 0) > 0 || (back && !!f.usedBeast && !as.includes("power:lord"));
      if (!as.includes("power:lord")) st.lord = (f.pw?.lord || 0) > 0 || (back && !!f.usedLord && !st.beast); }
    let foeAtk = 0;
    // [OURS] allies play their own clips (allyanim.js): who did what in each beat, and who is down on the ground
    const AA = typeof ALLYANIM !== "undefined" ? ALLYANIM : null, anames = (h.list || []).map((a) => a.name).filter(Boolean);
    const downs = AA ? AA.downAtStart(f, lines, anames) : new Set();
    const track = (b) => { b.downs = [...downs]; for (const a of b.allyActs || []) { if (a.clip === "down") downs.add(a.name); else if (a.clip === "getup") downs.delete(a.name); } return b; };
    lines.forEach((l, li) => {
      const raw = l.me || "", parts = raw.split(" · "), me = parts[0], extra = parts.slice(1).join(" · "), them = strip(l.them || "");
      const nhp = l.hp ?? hp, nehp = l.ehp ?? ehp;
      if (/dremora/i.test(`${l.me || ""} ${l.them || ""}`)) st.summon = "dremora";   // [summ] the Sanguine Rose's Dremora
      if (/familiar \d/.test(l.me || "") && !st.summon) st.summon = "familiar";
      st.cloak = /cloak|flames wreathe/i.test(extra) ? elementOf(extra) || "fire" : null;
      if (me) {
        const [k, arg] = (l.a || "").split(":");
        const b = { who: "me", li, move: "wait", wt: h.wt, fx: null, el: null, miss: false, crit: false, power: false, sneak: null, dmg: null, heal: null, hpT: hp, ehpT: nehp,
          ally: /· (?!bleeds|familiar|Your )[A-Z][^·]* \d+/.test(" · " + extra) && (f.allies || []).length > 0 && (!anames.length || extra.split(" · ").some((x) => /\d/.test(x) && anames.some((n) => x.startsWith(n + " ")))), wolf: /familiar \d|^Your .+ strikes \d| · Your .+ strikes \d/.test(extra), burn: /bleeds|wall|storm|blizzard/i.test(extra) ? elementOf(extra) || "dust" : null, flask: null };
        let lwt = l.wt || base; if (lwt === base) lwt = h.wt;   // staffs and crossbows are told apart by the scene, not the engine
        if (l.wt && l.wt !== base) st.bound = true;
        const spellish = k === "spell" || k === "dual" || k === "scroll" || (!k && (elementOf(me) || /ward|cloak|heal|bound|summon|familiar|rune|wall|conjur|raise|paralyz|calm|fear|courage|invisib|soul|turn|oakflesh|dragonhide|armor/i.test(me)) && !/^(power )?attack|^sneak attack/i.test(me));
        if (k === "tick") {   // [phantom] the end of the round: burns, bleeds and poison tick, nobody swings
          b.tick = true; b.ally = false;
          if (nehp != null && ehp != null && nehp < ehp) b.burn = elementOf(raw) || (/poison|venom/i.test(raw) ? "dust" : "fire");
        } else if (k && !MY_KNOWN.has(k)) {   // [phantom] a move that isn't a blow: no swing
          const a0 = l.a;
          if (a0 === "rx:cover") { b.move = "block"; st.guard = true; }
          else if (a0 === "rx:oil") Object.assign(b, { move: "cast", fx: "dust" });
          b.tag = a0 === "recover" ? "Catch breath" : a0 === "rx:mark" ? "Marked!" : a0 === "rx:cover" ? "Cover!" : null;
        } else if (k === "beast" || k === "lord" || k === "vamp") {   // a form's own moves and a vampire's powers (beastpaths.js)
          if (k === "beast") st.beast = true; if (k === "lord") st.lord = true;
          if (arg === "howl") Object.assign(b, { move: "shout", fx: "fus", el: null });
          else if (arg === "raise") { st.summon = "zombie"; Object.assign(b, { move: "self", fx: "necro", el: null }); }
          else if (arg === "shadows") { st.invis = true; Object.assign(b, { move: "self", fx: "invis", el: null }); }
          else if (arg === "seduce") Object.assign(b, { move: "cast", fx: "illusion", el: null });
          else if (arg === "revert") Object.assign(b, { move: "self", fx: "glow", el: null });
          else if (arg === "drain") { b.drain = true; Object.assign(b, { move: "claw", wt: null }); }
          else Object.assign(b, { move: "claw", wt: null, power: arg === "maul" || arg === "pounce", miss: /misses|dodges/i.test(me) });
          if (arg === "bite" || arg === "feast") b.crit = true;
        } else if (k === "potion" || (!k && /^drinks/i.test(me))) {
          const it = typeof D !== "undefined" && D.ITEMS?.[arg]; const res = it?.restore?.[0] || (/magicka/i.test(me) ? "magicka" : /stamina/i.test(me) ? "stamina" : "health");
          Object.assign(b, { move: "potion", fx: "potion", el: res, flask: res === "magicka" ? "#4a7ac8" : res === "stamina" ? "#4a9a5a" : "#c03a3a" });
        } else if (k === "block" || k === "bash" || (!k && /^raises guard|^shield bash/i.test(me))) {   // [movefx2] a turn-by-turn bash (a: "bash") is a bash too, not a sword swing
          b.move = k === "bash" || /^shield bash/i.test(me) ? "bash" : "block"; st.guard = true;
        } else if (k === "shout" || k === "power") {
          const fx = k === "shout" ? SHOUT_FX[arg] || "fus" : RACE_FX[arg] || "glow";
          Object.assign(b, { move: k === "shout" ? "shout" : "self", fx, el: arg === "frost_breath" || arg === "ice_form" ? "frost" : arg === "fire_breath" || arg === "dunmer" ? "fire" : null });
          if (fx === "breath") b.move = "shout";
          if (fx === "invis") st.invis = true;
          if (k === "power" && arg === "beast") { st.beast = true; Object.assign(b, { move: "shout", fx: "fus", el: null }); }   // the howl
          if (k === "power" && arg === "lord") { st.lord = true; Object.assign(b, { move: "self", fx: "summon", el: null }); }
        } else if (spellish) {
          const id = k === "scroll" ? (typeof D !== "undefined" && D.ITEMS?.[arg]?.spell) : arg;
          const sf = spellFx(id, me);
          if (sf.fx === "summon") st.summon = summonKind(id, me);   // [summ] what answered your call
          Object.assign(b, { fx: sf.fx, el: sf.el, storm: sf.storm, move: PROJ.has(sf.fx) ? "cast" : AT_FOE.has(sf.fx) ? "cast" : "self" });
          if (/fizzles/i.test(me)) Object.assign(b, { fx: "fizzle", move: "self" });
          b.miss = /misses|no effect|resists|shrugs|too strong|nothing/i.test(me);
          if (/\(sneak ×2\)/.test(me)) b.sneak = "SNEAK ATTACK ×2";
          if (sf.fx === "bound") st.bound = true; if (sf.fx === "invis") st.invis = true; if (sf.fx === "ward") st.ward = true; if (sf.fx === "soultrap") st.soul = true;
          if (sf.fx === "rune") st.rune = sf.el || "fire";
          if (sf.fx === "cloak") st.cloak = sf.el || "fire";
          if (k === "dual") b.dual = true;
        } else {   // a weapon: attack or power attack
          const staffSp = h.wt === "staff" && !st.bound && f.weapon?.staff ? f.weapon.staff.spell : null;
          if (staffSp && !/spent/i.test(me)) { const sf = spellFx(staffSp, me); Object.assign(b, { move: "staff", fx: sf.fx, el: sf.el || "frost", miss: /misses|no effect|resists/i.test(me) }); }
          else {
            const w = /^bashes with the bow/i.test(me) ? "fist" : /spent/i.test(me) ? "mace" : lwt;
            Object.assign(b, { move: moveFor(w), wt: w === "fist" ? (lwt === "bow" ? "bow" : "fist") : lwt, miss: /misses/i.test(me) });
            b.power = k === "power_attack" || /^power attack/i.test(me);
            b.crit = /\(critical\)/.test(me);
            const sn = me.match(/^Sneak attack ×(\d+)/i); if (sn) b.sneak = `SNEAK ATTACK ×${sn[1]}`;
            b.second = /second arrow/.test(me);
            if (/\(riposte\)/.test(me)) b.tag = "Riposte!";   // [phantom] a dodge set it up: say why this blow is extra strong
            const en = me.match(/\+(fire|frost|shock|absorb)/); if (en) b.enchant = en[1] === "absorb" ? "drain" : en[1];
            if (!b.enchant && /poison/i.test(raw) && (b.move === "bow" || b.move === "crossbow")) b.poison = true;   // [arrowfx] a poisoned arrow drips green
            if (/paralyzes/.test(me)) b.para = true;
            if (st.beast || st.lord) Object.assign(b, { move: "claw", wt: null });   // a werewolf or a Vampire Lord fights with claws
            st.invis = false;
          }
        }
        b.dmg = ehp != null && nehp != null ? Math.max(0, Math.round(ehp - nehp)) : null;
        const hg = me.match(/\+(\d+) health/); if (hg) b.heal = +hg[1];
        if (b.move === "potion" && b.el === "health") b.heal = b.heal || Math.max(0, Math.round((nhp ?? 0) - (hp ?? 0))) || null;
        b.hpT = b.heal && hp != null ? Math.min(f.hp0 ?? 1e9, hp + b.heal) : hp;
        if (/flees in terror|stops fighting|lower their weapons/.test(me) && f.endWon) b.turned = true;
        if (st.lord && /drain life/.test(extra)) b.drain = true;
        Object.assign(b, { st: { ...st } });
        if (/change back/.test(extra)) { st.beast = false; st.lord = false; }
        if (AA && !b.tick) { b.allyActs = AA.actsOf(extra, anames); for (const n of AA.revivedIn(me, anames)) if (!b.allyActs.some((a) => a.name === n)) b.allyActs.push({ name: n, clip: "getup" }); }
        beats.push(track(b));
      }
      if (them) {
        const b = { who: "them", li, move: "wait", wt: null, fx: null, el: null, miss: false, dmg: hp != null && nhp != null ? Math.max(0, Math.round(hp - nhp)) : null, hpT: nhp, ehpT: nehp, ally: false };
        let pr = null; const fo = AA ? AA.foeOn(them, anames) : null;   // the blow goes for one of your allies
        if (/steps on your/.test(them)) b.rune = st.rune || "fire", st.rune = null;
        if (/cowers|can't find you|isn't fighting|is paralyzed|is staggered|frozen|flees|obeys|shrugs/.test(them) && !/ hits | misses/.test(them)) {
          b.status = /paralyz|frozen/.test(them) ? "para" : /stagger/.test(them) ? "stagger" : /can't find/.test(them) ? "lost" : "fear";
        } else if ((pr = foePrep(them))) {   // [phantom] its turn went into something else than a blow: no swing, a label says what
          b.prep = true; b.tag = pr[0];
        } else if (fo || (/goes for|knocks .* to their knees| hits (?!\d)[a-z]/.test(them) && ((f.allies || []).length || f.followerDown))) {
          Object.assign(b, { move: FOE_MOVE[kind] || "sword", ally: true, allyActs: fo ? [fo] : [] });
        } else if (/(^| )(misses|attacks, but you dodge)/.test(them)) {
          const aw0 = typeof FOEGROUPS !== "undefined" ? FOEGROUPS.look(f.e)?.wt : null, shoots = bolter || archer || aw0 === "bow";   // [arrowfx] an archer's miss still flies
          Object.assign(b, { move: bolter ? "crossbow" : shoots ? "bow" : FOE_MOVE[kind] || "sword", miss: true });
          if (shoots) b.wt = bolter ? "crossbow" : "bow";
        } else if (/hits|blow|breath|bites|claws|strikes|\d/.test(them)) {
          const aw = typeof FOEGROUPS !== "undefined" ? FOEGROUPS.look(f.e)?.wt : null;   // the foe's archetype weapon
          b.move = bolter ? "crossbow" : archer || aw === "bow" ? "bow" : aw === "staff" ? "cast" : aw && MOVES[aw] ? aw : FOE_MOVE[kind] || "sword";
          if (bolter) b.wt = "crossbow"; else if (archer || aw === "bow") b.wt = "bow"; else if (aw && aw !== "staff") b.wt = aw;
          if (/ballista/.test(nm)) b.ballista = true;   // [arrowfx] a big brass bolt
          foeAtk++;
          if (kind === "draugr" && foeAtk % 3 === 0) Object.assign(b, { move: "shout", fx: "fus" });
          if (kind === "vampire" && foeAtk % 2 === 0) Object.assign(b, { move: "drain", el: "drain" });
          if (b.move === "cast" || b.move === "breath") b.el = elementOf(them) || (kind === "dragon" && /frost|ice|blood|revered|legendary/.test(nm) ? "frost" : f.e?.element || FOE_EL[kind]) || "shock", b.fx = b.el;
          b.blocked = /block/.test(them) || (st.guard && /\(blocked/.test(them));
          b.absorbed = /absorbed|passes through|ward soaks/.test(them);
          b.reflect = /reflected/.test(them);
          if (/ward soaks[^)]*breaks/.test(them)) st.ward = false;
        }
        if (!b.tag && /punch back \d/.test(them)) Object.assign(b, { tag: "Counter!", tagU: 0.55 });   // [phantom] your blow back on its miss (Counterpunch): said on the picture too
        else if (!b.tag && /thorns \d/.test(them)) Object.assign(b, { tag: "Thorns!", tagU: 0.55 });
        b.guard = st.guard; st.guard = false;
        b.st = { ...st };
        beats.push(track(b));
      }
      if (!me && !them) {   // a turn-by-turn ally line (" · Lydia hits 12"): their own beat, so they swing, cast or guard on screen
        const acts = AA && extra ? AA.actsOf(extra, anames) : [];
        if (AA && extra) for (const n of AA.revivedIn(extra, anames)) if (!acts.some((a) => a.name === n)) acts.push({ name: n, clip: "getup" });
        beats.push(track(acts.length ? { who: "me", li, move: "wait", ally: true, allyOnly: true, allyActs: acts, dmg: ehp != null && nehp != null ? Math.max(0, Math.round(ehp - nehp)) : null, hpT: nhp, ehpT: nehp, st: { ...st } } : { who: "me", li, move: "wait", hpT: nhp, ehpT: nehp, st: { ...st } }));
      }
      hp = nhp; ehp = nehp;
    });
    // the finishing blow: the beat that drops the loser
    const won = f.won ?? true;
    for (const b of beats) if ((won ? b.ehpT != null && b.ehpT <= 0 : b.hpT != null && b.hpT <= 0) || b.turned) { b.final = true; break; }
    if (!beats.some((b) => b.final) && beats.length) beats[beats.length - 1].final = f.won != null;
    for (const b of beats) { const m = MOVES[b.move] || MOVES.wait; b.dur = b.allyOnly ? 820 : b.tag && b.move === "wait" ? 760 : m.dur * (b.power ? 1.15 : 1); b.num = b.dmg ? String(b.dmg) : null; }
    beats.downEnd = downs;   // who is still down once it has all played
    return beats;
  }
  const animFor = (wt) => MOVES[wt] ? wt : null;   // for tests: every weapon type has its own move

  // ---------------------------------------------------------------- the stage
  function register(f, s) {
    if (!f) return 0;
    if (IDS.has(f)) return IDS.get(f);
    const id = nextId++; IDS.set(f, id);
    const arena = !!f.arena || !f.e && f.log && f.log.length && /hits for/.test(f.log[0].them || "");
    REG.set(id, { f, scene: arena ? "arena" : sceneOf(s), hero: { ...heroOf(s, f), bound: false }, foe: f.e?.look || f.foeLook ? "player" : arena ? "bandit" : foeOf(f.e), foeLook: f.e?.look || f.foeLook || null, wagon: f.e?.cart ? "cart" : f.e?.caravan ? (f.e.khajiit ? "khajiit" : "nord") : null, foeName: f.e?.name || f.foeName || (arena && (f.log[0].them.match(/^(.+?) hits for/) || [])[1]) || "Opponent", played: !!f.tbPlayed });   // a turn-based fight was already watched live
    { const rec = REG.get(id), outdoor = !["cave", "dwemer"].includes(rec.scene) && !s?.dungeon; if (outdoor && typeof SKY !== "undefined" && s) rec.sky = SKY.state([s.x, s.y]); }   // the sky over this fight
    if (typeof BSCENE !== "undefined") { const rec = REG.get(id); rec.art = BSCENE.artOf(s, { arena: rec.scene === "arena" }); if (rec.art) BSCENE.prefetch(rec.art); }   // [OURS] painted scene (battlescene.js); rec.scene stays the drawn fallback
    { const rec = REG.get(id); if (f.mount && !f.mount.foot && typeof HORSEBACK !== "undefined") { rec.horse = typeof HORSES !== "undefined" && s?.horse ? HORSES.coat(s.horse.coat)[2] : "#6b4a2e"; rec.horseCoat = s?.horse?.coat || null; } }   // [OURS] fighting from the saddle
    if (REG.size > 40) REG.delete(REG.keys().next().value);
    return id;
  }
  const placeholder = (f, s) => { const id = register(f, s); return id ? `<div class="fscene" data-fs="${id}" role="img" aria-label="Fight scene"></div>` : ""; };

  // easing and keyframes
  const EASE = { io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2), in: (u) => u * u * u, out: (u) => 1 - Math.pow(1 - u, 3), lin: (u) => u };
  function poseAt(m, u, out, reach) {
    const kf = m.kf; let i = 1; while (i < kf.length - 1 && kf[i][0] < u) i++;
    const a = kf[i - 1], b = kf[i], span = b[0] - a[0], t = span > 0 ? Math.max(0, Math.min(1, (u - a[0]) / span)) : 1, e = EASE[b[7]](t);
    out.aim = a[1] + (b[1] - a[1]) * e; out.back = a[2] + (b[2] - a[2]) * e; out.lean = a[3] + (b[3] - a[3]) * e;
    out.dx = (a[4] + (b[4] - a[4]) * e) * reach; out.dy = a[5] + (b[5] - a[5]) * e; out.draw = a[6] + (b[6] - a[6]) * e;
    return out;
  }
  const idlePose = (out, wt) => { out.aim = wt === "bow" || wt === "crossbow" ? 0 : -0.5; out.back = 0; out.lean = 0; out.dx = 0; out.dy = 0; out.draw = wt === "crossbow" ? 1 : 0; return out; };
  // colours of each effect
  const COL = { fire: ["#ffb347", "#ff7a2a", "#fff2c0"], frost: ["#bfe8ff", "#ffffff", "#7fb0d8"], shock: ["#c8b8ff", "#ffffff", "#8a7aff"], sun: ["#fff2a0", "#ffffff", "#ffd060"],
    heal: ["#a8f08a", "#fff2a0", "#ffffff"], circle: ["#a8f08a", "#fff2a0"], ward: ["#9fd0f0", "#d8f0ff"], armor: ["#c9a878", "#8a6a44", "#e0d0a0"], illusion: ["#c89aff", "#ff9ae0", "#ffffff"],
    summon: ["#a07aff", "#e0d0ff"], necro: ["#9a7aff", "#7af0b0"], paralyze: ["#9aff6a", "#e0ffb0"], soultrap: ["#b07aff", "#ffffff"], spark: ["#fff2c0", "#ffd080", "#ffffff"],
    dust: ["#b8a890", "#9a8a72", "#cbbca0"], smoke: ["#5a5450", "#7a726a"], health: ["#ff6a6a", "#ffb0b0"], magicka: ["#6aa8ff", "#b0d8ff"], stamina: ["#7aff8a", "#c0ffc0"],
    drain: ["#ff4060", "#ff9aa0"], support: ["#9affc0", "#fff2a0", "#ffffff"], glow: ["#fff2c0", "#ffffff"], invis: ["#d8f0ff", "#ffffff"], bound: ["#bcd8ff", "#ffffff"], turn: ["#fff2a0", "#ffffff"], cloak: ["#ffb347", "#ff7a2a"], rune: ["#ffb347", "#fff2c0"], wall: ["#ffb347", "#ff7a2a"], fizzle: ["#8a8480", "#a8a29a"] };
  const colOf = (fx, el) => COL[(fx === "cloak" || fx === "rune" || fx === "wall" || fx === "breath" || fx === "staff" || fx === "support") && el ? el : fx] || COL[el] || COL.glow;
  const glowSprites = new Map();
  /* [weaponshine] the colour of an enchanted weapon's edge shine, by enchantment (combatfx.js GLOW key); others use their own first colour */
  const SHINE = [["fire", "#ff8a3a"], ["frost", "#9fd4f2"], ["shock", "#a08cf0"], ["drain", "#9a78d8"], ["absorb", "#9a78d8"], ["paralyze", "#8fd870"], ["fear", "#a882e0"]];
  function glowSprite(c) {
    let sp = glowSprites.get(c);
    if (!sp && typeof document !== "undefined") {
      sp = document.createElement("canvas"); sp.width = sp.height = 32; const x = sp.getContext("2d"), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.12, c); gr.addColorStop(0.45, c + "88"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); glowSprites.set(c, sp);
    }
    return sp;
  }
  // [blood3] dust, smoke and mist puffs: a soft round haze with no hard edge (it used to be a flat disc)
  const softSprites = new Map();
  function softSprite(c) {
    let sp = softSprites.get(c);
    if (!sp && typeof document !== "undefined") {
      sp = document.createElement("canvas"); sp.width = sp.height = 32; const x = sp.getContext("2d"), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, c); gr.addColorStop(0.35, c + "b0"); gr.addColorStop(0.7, c + "40"); gr.addColorStop(1, c + "00"); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); softSprites.set(c, sp);
    }
    return sp;
  }
  let MANUAL = false; const LIVE = new Set();
  const PERF = new Float32Array(2000); let perfN = 0;
  const prefs = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}"); } catch { return {}; } };
  const setPref = (k, v) => { try { const p = prefs(); p[k] = v; localStorage.setItem("rotn_prefs", JSON.stringify(p)); } catch { /* private mode */ } };
  const autoSkip = () => typeof navigator !== "undefined" && navigator.webdriver && !(typeof location !== "undefined" && /[?&]fightanim/.test(location.search));

  /* [assetquality] backing pixels per drawing unit for the stage: its laid-out width (not the on-screen box, which is
     still small while the fight sheet pops in with a scale animation; a transform never tells a ResizeObserver) x zoom
     x density, up to 6 */
  const stageK = (e, W) => {
    const z = FITCANVAS.zoom(), lw = (e.offsetWidth || e.clientWidth || 0) * z;
    return Math.min(6, Math.max(1, (lw > 0 ? lw / W : 1) * FITCANVAS.dpr(3)));
  };
  function mount(el) {
    const rec = REG.get(+el.dataset.fs); if (!rec || el.firstChild) return;
    const W = Math.max(300, Math.min(520, Math.round(el.clientWidth || 330))), Hh = Math.round(W * (rec.f.tbAspect || (rec.f.tbTall ? 0.66 : 0.46)));   // the turn-by-turn screen gets a taller stage (on a PC: the window's own shape, combat2.js)
    const rm = reduce();
    const FS = typeof FIGHTSET !== "undefined" ? FIGHTSET : null;   // [OURS] Settings → Fights: quality caps the sharpness (fightset.js)
    const kOf = (e) => Math.min(FS ? FS.dpr() : 6, stageK(e, W));
    const dpr = typeof FITCANVAS !== "undefined" ? kOf(el) : Math.min(2, devicePixelRatio || 1);   // backing pixels per drawing unit: the box on screen × density (sharp on tablets and PCs too)
    const cv = document.createElement("canvas"); cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);   // CSS scales it to the box (width:100%)
    el.appendChild(cv);
    const g = cv.getContext("2d");
    let k = dpr;
    // [c2polish] screen pixels per drawing unit: on a wide PC window the small stage is shown up to ~4x, so name tags,
    // banners and snow are drawn smaller in drawing units to stay their normal size on screen
    let vs = Math.max(1, (cv.clientWidth || el.clientWidth || W) / W);
    const lbl = (n) => n * Math.min(1, 1.8 / vs), tagSz = () => (11 * Math.min(vs, 1.25)) / vs;
    // [assetquality] the stage often grows after it's mounted (wide PC column, turning the phone): keep the backing
    // pixels = the box on screen x density, so the painted scene and foe are never blown up by CSS
    // (it can also be measured while its sheet is still being laid out, and be full size by the first resize report,
    // which only sets the baseline: so check again on the next frames too)
    if (typeof FITCANVAS !== "undefined") {
      const refit = () => {
        if (!cv.isConnected || !cv.offsetWidth) return;
        vs = Math.max(1, cv.offsetWidth / W);
        try { replace(); } catch (e) { /* not laid out yet: mount does it */ }   // [fightpos] the visible part of the stage may have changed
        const nk = kOf(cv);
        if (Math.abs(nk - k) / k > 0.04) { k = nk; cv.width = Math.round(W * k); cv.height = Math.round(Hh * k);
          try { if (!MANUAL) draw(performance.now()); } catch { /* the next frame draws it */ } }
      };
      FITCANVAS.watch(cv, refit);
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(refit);
      setTimeout(refit, 450);
    }
    const work = cv, wg = g;   // one canvas: the stage is drawn straight to the screen

    const bg = bgFor(rec.scene, W, Hh, rec.wagon, rec.sky);
    const wxp = rec.sky && (!FS || FS.weather()) ? SKY.particles(rec.sky, W, Hh, { reduce: rm, scale: () => vs }) : null;   // snow, rain, leaves or fireflies during the replay
    const f = rec.f, beats = beatsOf(f, rec.hero);
    const hp0 = f.hp0 ?? Math.max(1, ...((f.log || []).map((l) => l.hp).filter((v) => v != null)));
    const ehp0 = f.ehp0 ?? Math.max(1, ...((f.log || []).map((l) => l.ehp).filter((v) => v != null)));
    const hpMax = Math.max(f.tbHpMax || hp0, 1), ehpMax = Math.max(f.tbEhpMax || ehp0, 1);   // a turn-by-turn fight shows one turn at a time against the full bars
    const last = (f.log || [])[f.log.length - 1] || {};
    const won = f.won ?? (last.ehp != null && last.hp != null ? last.hp >= last.ehp : true);
    const NOST = { me: {}, foe: {} };
    function curSt() {   // statuses as of the beat being shown (none once the fight has finished playing)
      if (done || phase === "end") return NOST;
      const b = beats[Math.min(bi, beats.length - 1)], ln = b ? (f.log || [])[b.li] : null;
      return ln?.st ? { me: ln.st.me || {}, foe: ln.st.foe || {} } : NOST;
    }
    const turned = !!f.endWon;
    const groundY = Hh * 0.8, s = Hh / 150;
    const foeK = rec.foe, fSize = SIZE[foeK] || 1, reach = REACH[foeK] || 1, isPerson = PERSON.has(foeK);
    const heroChest = groundY - 36 * s;
    /* [fightpos] where everyone stands comes from fightpos.js: you, up to 7 other players plus followers, thralls and
       summons in depth rows behind you, the foe across the gap (big ones shrink only when they would not fit) and the
       foes still waiting their turn behind it, all inside the part of the stage that is really on screen (the phone's
       immersive screen crops its sides). The health plate, pop-ups and the target ring read the same spots. */
    const ALLY_MAX = 11, alist0 = rec.hero.list || [], groundL = alist0.filter((a) => !FLYERS.has(a.kind)).slice(0, ALLY_MAX), flyers = alist0.filter((a) => FLYERS.has(a.kind)).slice(0, 1);
    const nGen = Math.max(0, Math.min(ALLY_MAX, rec.hero.allies) - groundL.length - flyers.length);
    const slots = [...groundL, ...Array.from({ length: Math.min(ALLY_MAX - groundL.length, nGen) }, () => ({ kind: "soldier" }))];
    const FP = typeof FIGHTPOS !== "undefined" ? FIGHTPOS : null, nWait = Math.max(0, rec.f.tbWait | 0);
    const hasAllies = slots.length > 0 || flyers.length > 0;
    let LAY = null, band = [0, W], fx0 = W * 0.72, hx0 = Math.max(W * 0.27, Math.min(W * 0.4, (hasAllies ? 60 : 24) * s)), FSC = 1, foeChest = groundY - 34 * s * fSize;
    const slotOf = new Map();   // an ally (its place in slots) -> its spot
    function bandOf() {   // the stage's on-screen part, in stage units (a parent that clips it, or the window)
      if (!cv.isConnected || typeof getComputedStyle !== "function") return [0, W];
      const rc = cv.getBoundingClientRect(); if (!rc.width) return [0, W];
      let lo = 0, hi = typeof innerWidth === "number" && innerWidth ? innerWidth : rc.right;
      for (let e = cv.parentElement; e && e !== document.body; e = e.parentElement) {
        if (getComputedStyle(e).overflowX === "visible") continue;
        const er = e.getBoundingClientRect(); lo = Math.max(lo, er.left); hi = Math.min(hi, er.right);
      }
      const l = Math.max(0, ((lo - rc.left) / rc.width) * W), r = Math.min(W, ((hi - rc.left) / rc.width) * W);
      // [magicaim] the top too: on a wide screen the stage can slide up under the turn strip (fightfit.js)
      const strip = cv.closest && cv.closest("#tbf")?.querySelector(".tbtop"), sb = strip ? strip.getBoundingClientRect().bottom : 0;
      const t = rc.height ? Math.max(0, Math.min(Hh * 0.5, ((Math.max(0, sb) - rc.top) / rc.height) * Hh)) : 0;
      return r - l > W * 0.5 ? [Math.round(l), Math.round(r), Math.round(t)] : [0, W, Math.round(t)];
    }
    function relayout() {
      if (!FP) return false;
      const nb = bandOf(); if (LAY && Math.abs(nb[0] - band[0]) < 3 && Math.abs(nb[1] - band[1]) < 3 && Math.abs((nb[2] || 0) - (band[2] || 0)) < 3) return false;
      band = nb;
      const MF = typeof MOUNTFIGHT !== "undefined" && typeof HORSEBACK !== "undefined" ? MOUNTFIGHT : null;
      const al = slots.map((a, i) => ({ name: "#" + i, kind: a.kind, ride: !!(MF && a.kind === "mate" && a.name && MF.allyHorse(f, a.name)) }));
      for (const a of flyers) al.push({ name: "#fly", kind: a.kind });
      LAY = FP.layout({ W, Hh, l: band[0], r: band[1], t: band[2] || 0, groundY, ride: !!rec.horse, allies: al, foe: { kind: foeK }, waiting: nWait });
      hx0 = LAY.hero.x; fx0 = LAY.foe.x; FSC = LAY.foe.fs; foeChest = groundY - 34 * s * fSize * FSC;
      slotOf.clear();
      for (const p of LAY.allies) { const i = +p.name.slice(1); slotOf.set(i, p); p.name = slots[i]?.name || p.name; }   // the target ring finds them by name
      for (const p of LAY.flyers) p.name = flyers[0]?.name || p.name;
      FP.publish(cv, LAY);
      return true;
    }
    const replace = () => { if (relayout() && typeof COMBAT2 !== "undefined" && COMBAT2.place) { const tb = cv.closest && cv.closest("#tbf"); if (tb) try { COMBAT2.place(tb, true); } catch (e) { /* the plate stays where it was */ } } };
    replace();
    cv.__fpRe = replace;   // [magicaim] combat2.js: the stage moved (the Magic drawer opened): lay everyone out again
    // [OURS] foe rigs (foerig.js): the foe is a little skeleton that breathes, winds up, flinches, staggers and falls
    const RIG = typeof FOERIG !== "undefined" && FOERIG.on() ? FOERIG.ctl(foeK, rec.foeName, { look: foeK === "player" ? matePerson(rec.foeLook) : null, foeLook: rec.foeLook, arch: typeof FOEGROUPS !== "undefined" ? FOEGROUPS.look(rec.f?.e) : null }) : null;
    const RIGKIT = { weapon, gearTorso, foeFig, person, H: ART.H }, RIGST = { t: 0, clip: null, u: 0, hitU: null, pose: null, pic: null, picH: 0, filter: null, dragon: null, kit: RIGKIT, jitter: false, still: false };
    // [fightpos] the foes waiting their turn: the same kind of foe, idle, one rig shared by all of them
    const RIGW = RIG && nWait ? FOERIG.ctl(foeK, rec.foeName, { look: foeK === "player" ? matePerson(rec.foeLook) : null, foeLook: rec.foeLook, arch: typeof FOEGROUPS !== "undefined" ? FOEGROUPS.look(rec.f?.e) : null }) : null;
    const RIGWST = { ...RIGST, still: !!rm }, waitP = idlePose({}, null);
    function drawWaiting(tt) {
      const pic0 = foeK !== "player" && typeof ASSETS !== "undefined" ? ASSETS.img(ASSETS.foeKey(rec.foeName, foeK, rec.f?.e?.arch)) : null;
      const pic = pic0 && typeof RIGLOOK !== "undefined" ? RIGLOOK.graded(pic0) : pic0, picH = (foeK === "dragon" ? 120 : 66) * Math.min(1.8, fSize);
      curFoeLook = rec.foeLook; curArchLook = typeof FOEGROUPS !== "undefined" ? FOEGROUPS.look(rec.f?.e) : null; curDragon = null;
      for (const w of LAY.waiting) {
        wg.save(); wg.translate(w.x, w.y); wg.scale(-s * w.sc, s * w.sc); wg.globalAlpha = 0.86;
        if (RIGW) { RIGWST.t = rm ? 0 : tt + w.x * 0.013; RIGWST.pose = isPerson || foeK === "player" ? waitP : null; RIGWST.pic = pic; RIGWST.picH = pic ? picH : 0; RIGW.draw(wg, RIGWST); }
        else if (pic) { const wU = picH * pic.naturalWidth / pic.naturalHeight; wg.drawImage(pic, -wU / 2, -picH, wU, picH); }
        else foeFig(wg, foeK, 0, tt + w.x * 0.013, isPerson ? waitP : null);
        wg.restore();
      }
    }
    const pmul = rm ? 0.4 : 1;
    // [arrowfx] bows and crossbows shoot a painted arrow or bolt (arrowfx.js); [movefx] every spell has its own painted effect (movefx.js)
    const lowQ = !!(FS && FS.quality && FS.quality() === "low");
    const AFX = typeof ARROWFX !== "undefined" ? ARROWFX.scene({ s, groundY, reduce: rm, low: lowQ }) : null;
    const MFX = typeof MOVEFX !== "undefined" ? MOVEFX.scene({ s, W, H: Hh, groundY, reduce: rm, low: lowQ }) : null;
    let seatLift = 0, muteFx = false;   // how high you sit in the saddle (shots leave from there); muteFx: movefx draws this impact, the shared bursts stay quiet
    // ---- state (all allocated once)
    let bi = 0, lt = 0, hitIdx = 0, phase = beats.length ? "play" : "end", phaseT = 0, real = 0, hitstop = 0, slowT = 0, shake = 0, zoom = 1, zoomT = 0, zcx = W / 2, zcy = Hh / 2, flash = 0, flashC = "#fff";
    let done = false, speed = rm ? 2 : 1, lastNow = performance.now(), raf = 0, revealed = -2;
    let hpD = hp0, hpT = hp0, hpL = hp0, hpLT = 0, ehpD = ehp0, ehpT = ehp0, ehpL = ehp0, ehpLT = 0;
    const heroP = idlePose({}, rec.hero.wt), foeP = idlePose({}, null), tmpP = {};
    let heroKnock = 0, foeKnock = 0, heroDodge = 1, foeDodge = 1, claw = 0, label = null, labelT = 0, labelC = P.gold, fall = 0, wolfT = 1;
    // particle pool: x, y, vx, vy, life, max, size, gravity; type 0 glow · 1 spark · 2 dust/smoke · 3 chunk · 4 mote
    const NP = 160, px = new Float32Array(NP), py = new Float32Array(NP), pvx = new Float32Array(NP), pvy = new Float32Array(NP), pl = new Float32Array(NP), pm = new Float32Array(NP),
      ps = new Float32Array(NP), pg = new Float32Array(NP), pt = new Uint8Array(NP), pc = new Array(NP).fill("#fff");
    let pcur = 0, alive = 0;
    function spawn(type, c, x, y, vx, vy, life, size, grav) {
      let i = pcur, n = 0; while (pl[i] > 0 && n < NP) { i = (i + 1) % NP; n++; }
      pcur = (i + 1) % NP;
      px[i] = x; py[i] = y; pvx[i] = vx; pvy[i] = vy; pl[i] = pm[i] = life; ps[i] = size; pg[i] = grav; pt[i] = type; pc[i] = c;
    }
    function burst(x, y, n, type, cols, sp, life, size, grav, upward) {
      if (muteFx) return;
      n = Math.max(1, Math.round(n * pmul));
      for (let i = 0; i < n; i++) { const a = upward ? -Math.PI / 2 + (Math.random() - 0.5) * 2.2 : Math.random() * 6.283, v = sp * (0.35 + Math.random() * 0.65);
        spawn(type, cols[i % cols.length], x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), grav); }
    }
    // floating numbers
    const NF = 10, fxs = new Float32Array(NF), fys = new Float32Array(NF), fvx = new Float32Array(NF), fvy = new Float32Array(NF), fl = new Float32Array(NF), fsz = new Float32Array(NF), ftx = new Array(NF).fill(""), fcl = new Array(NF).fill("#fff");
    let fcur = 0;
    const float = (x, y, txt, col, size) => { const i = fcur; fcur = (fcur + 1) % NF; fxs[i] = x; fys[i] = y; fvx[i] = (Math.random() - 0.5) * 60; fvy[i] = -85; fl[i] = 1; fsz[i] = size; ftx[i] = L(txt); fcl[i] = col; };
    // a lightning bolt (re-jagged every few frames)
    const BOLT = new Float32Array(48), FORK = new Float32Array(20); let boltOn = 0, boltX0 = 0, boltY0 = 0, boltX1 = 0, boltY1 = 0, boltC = "#c8b8ff", boltJag = 0;
    function jag() { const n = 24; for (let i = 0; i < n; i++) { const t = i / (n - 1), off = i === 0 || i === n - 1 ? 0 : (Math.random() - 0.5) * 18 * s; BOLT[i * 2] = boltX0 + (boltX1 - boltX0) * t; BOLT[i * 2 + 1] = boltY0 + (boltY1 - boltY0) * t + off; }
      const at = 8 + Math.floor(Math.random() * 8); let x = BOLT[at * 2], y = BOLT[at * 2 + 1]; for (let i = 0; i < 10; i++) { FORK[i * 2] = x; FORK[i * 2 + 1] = y; x += (4 + Math.random() * 6) * s; y += (Math.random() * 7 + 1) * s; } }
    // weapon-tip trail
    const TR = new Float32Array(26); let trOn = false, trailC = "#f4f6ff";
    /* [rigraces] the swing trail: the blade tip (x,y) and a point part way down the blade (bx,by), sampled as the blade
       moves; drawn as a soft crescent between the two that tapers and fades toward its tail. The painted fighter reports
       its real blade (PAINTRIG.tip), the ink figures the drawn tip; a jump or a point far over the head starts it over */
    const TRL = []; let heroRig = false, tipN = -1;
    const nowS = () => real;   // the scene's own clock, so a paused or hand-stepped scene keeps its trail
    function pushTrail(x, y, bx, by) {
      if (!(isFinite(x) && isFinite(y) && isFinite(bx) && isFinite(by))) return;
      if (y < groundY - 110 * s || y > groundY + 4 * s) { TRL.length = 0; return; }
      const q = TRL[TRL.length - 1];
      if (q && Math.hypot(x - q.x, y - q.y) > Math.max(40 * s, 4 * Math.hypot(x - bx, y - by))) TRL.length = 0;   // a fast swing moves the tip far between frames; only a jump of several blade lengths is a glitch
      TRL.push({ x, y, bx, by, t: nowS() }); if (TRL.length > 24) TRL.shift();
    }
    // [OURS] combat effects (combatfx.js): blood, the way the foe dies, the camera
    const CFX = typeof COMBATFX !== "undefined" ? COMBATFX : null, goreOn = !!CFX && CFX.gore(), bleed = CFX ? CFX.bleedOf(foeK) : [null, null, "none"];
    const NECK = -52 * fSize;
    // [OURS] blood and gore (gore.js): sprays, splats that stay for the fight, streaks on the hurt, pools, flourishes. Seeded, so every phone sees the same.
    const fightOf = f.tbTall && Object.getPrototypeOf(f) !== Object.prototype ? Object.getPrototypeOf(f) : f;   // a turn-by-turn screen is a view of the whole fight: its splats stay turn to turn
    const GS = typeof GORE !== "undefined" && GORE.on() ? GORE.scene({ fight: fightOf, W, H: Hh, groundY, s, pixel: false, reduce: rm, foeK, foeName: rec.foeName, tags: f.e?.tags, ehpMax }) : null;
    const foeMetal = bleed[2] === "oil" || (typeof GOREFX2 !== "undefined" && GOREFX2.metal ? GOREFX2.metal(rec.foeName) : false);   // [blood3] plate or a machine: a blade sparks on it
    const goreKey = (b, i) => `${(f.log || [])[b.li]?.turn ?? b.li}|${b.li}|${b.who}|${b.dmg ?? 0}|${i}`;
    let deathK = null, camF = 0.5;
    const meleeOf = (b) => !!b && !MOVES[b.move]?.proj && !["self", "potion", "wait", "block", "cast", "shout"].includes(b.move);
    function pickDeath() {
      if (deathK || !CFX || !won || turned) return;
      const fb = beats.find((x) => x.final) || beats[beats.length - 1];
      deathK = CFX.deathOf(fb, foeK, { melee: fb?.who === "me" && meleeOf(fb), person: isPerson, gore: goreOn, wt: fb?.wt });
      if (GS) GS.kill({ side: "foe", x: fx0, y: foeChest, size: fSize, person: isPerson, bodyX: fx0 + (isPerson ? 30 : 4) * s * Math.min(1.4, fSize) * (deathK === "launch" ? 1.6 : 1) }, { death: deathK, crit: !!(fb?.crit || fb?.sneak), power: !!fb?.power, boss: !!f.bf, slowmo: !!f.bf, type: GORE.typeOf(fb, MOVES[fb?.move] || {}), from: 1, key: fb ? goreKey(fb, 9) : 0, instant: done });
      if (typeof SOUND !== "undefined" && SOUND.fx && !rm && !rec.played) SOUND.fx(deathK === "decap" ? "hit-gore" : deathK === "shatter" ? "death-shatter" : deathK === "ash" ? "spell-fire" : deathK === "fry" ? "spell-shock" : "hit", 0.05);
    }
    /* blood (or bone chips, oil, grave dust) from a blow; on you it's always red */
    function bloodAt(x, y, dir, n, onMe) {
      if (!goreOn || GS) return;   // gore.js draws it when it's loaded
      const [c0, c1, kind] = onMe ? ["#a01010", "#5a0606", "blood"] : bleed;
      if (kind === "none") return;
      n = Math.max(1, Math.round(n * pmul));
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + dir * (0.4 + Math.random() * 0.9), v = (90 + Math.random() * 170) * s;
        spawn(kind === "ash" ? 2 : 3, i % 3 ? c0 : c1, x, y, Math.cos(a) * v * (kind === "ash" ? 0.4 : 1), Math.sin(a) * v * (kind === "ash" ? 0.4 : 1), 0.5 + Math.random() * 0.4, kind === "blood" ? 1.6 + Math.random() * 1.4 : 2.2, kind === "ash" ? -10 : 420);
      }
      if (kind === "blood") spawn(2, c1, x, y, dir * 30 * s, -10 * s, 0.6, 4, 0);   // a fine red mist
      if (kind === "oil") burst(x, y, 6, 1, COL.spark, 200 * s, 0.3, 2, 260);
    }
    const TIP = { dagger: [10, -8], sword: [20, -20], greatsword: [28, -28], axe: [19, -16], battleaxe: [28, -22], mace: [16, -16], warhammer: [18, -18], spear: [32, -30], club: [18, -24], staff: [10, -32], fist: [0, 0] };
    function tipOf(side, pose, wt, i) {   // where the weapon tip is on screen
      const t = TIP[wt] || TIP.sword, ca = Math.cos(pose.aim), sa = Math.sin(pose.aim), lx = 13 + t[0], ly = 9 + t[1];
      let x = 7 + ca * lx - sa * ly, y = -45 + sa * lx + ca * ly;
      const lean = pose.lean, cl = Math.cos(lean), sl = Math.sin(lean), rx = cl * x - sl * y, ry = sl * x + cl * y;
      const sc = side > 0 ? s : s * fSize;
      TR[i] = side > 0 ? hx0 + pose.dx * s + rx * sc : fx0 - pose.dx * s - rx * sc; TR[i + 1] = groundY + pose.dy * s + ry * sc;
    }
    // where things are
    const handX = (side, pose) => side > 0 ? hx0 + (pose.dx + 22) * s : fx0 - (pose.dx + 22) * s * (foeK === "dragon" ? 2.2 : 1);
    const handY = (side) => side > 0 ? groundY - 46 * s : foeK === "dragon" ? groundY - 80 * s : groundY - 46 * s * Math.min(1.4, fSize);
    const allyX = () => hx0 - 26 * s;
    const GEO = { hand: [0, 0], hand2: [0, 0], from: [0, 0], to: [0, 0], ally: [0, 0], gy: groundY };   // [movefx] where things are this frame
    function mfxGeo() {
      const hx = handX(1, heroP), hy = handY(1) - seatLift;
      GEO.hand[0] = hx; GEO.hand[1] = hy; GEO.hand2[0] = hx - 12 * s; GEO.hand2[1] = hy + 5 * s;
      GEO.from[0] = hx0; GEO.from[1] = heroChest - seatLift; GEO.to[0] = fx0 - (foeP.dx || 0) * s; GEO.to[1] = foeChest; GEO.ally[0] = allyX(); GEO.ally[1] = groundY - 36 * s;
      return GEO;
    }

    // ---- the effects at the moment of impact
    function impact(b, last) {   // [movefx] a beat movefx.js owns draws its own impact; the sound, the flinch, gore, knockback and hitstop stay
      const own = !!(MFX && MFX.owns(b));
      if (!own) return impact0(b, last);
      MFX.hit(b, last);
      const keep = [ringT, beamT, flash, flashC, claw]; muteFx = true;
      try { impact0(b, last); } finally { muteFx = false; const fl = flash, fc = flashC; [ringT, beamT, flash, flashC, claw] = keep; if (b.final) { flash = fl; flashC = fc; } }
    }
    function impact0(b, last) {
      const me = b.who === "me", tx = me ? fx0 : (b.ally ? allyX() : hx0), ty = me ? foeChest : heroChest, dir = me ? 1 : -1;
      const fx = b.fx, cols = colOf(fx, b.el), big = b.power || b.final;
      if (last && CFX && typeof SOUND !== "undefined" && SOUND.fx && !["potion", "self", "wait"].includes(b.move)) SOUND.fx(CFX.soundOf(b, me ? foeK : "person", meleeOf(b), goreOn));
      if (RIG && me && !["potion", "self", "wait"].includes(b.move) && (last || !b.miss)) RIG.event(b.miss ? "dodge" : b.blocked ? "block" : b.power || b.crit || b.final ? "stagger" : "hit");   // the foe flinches, reels or ducks aside
      if (b.miss) {   // a whoosh, the other side steps aside
        if (me) foeDodge = 0; else heroDodge = 0;
        if (last) float(tx, ty - 34 * s, "Miss", "#e9dcc0", 14);
        return;
      }
      if (!me && b.blocked) {   // sparks off your shield
        burst(hx0 + 10 * s, heroChest, 16, 1, COL.spark, 260 * s, 0.35, 2, 300); if (last) float(hx0 + 4, groundY - 76 * s, "Block!", "#d8f0ff", 15);
        heroKnock = 5; shake = Math.max(shake, 2); hitstop = rm ? 0 : 0.05; return;
      }
      if (!me && b.absorbed) { burst(hx0 + 14 * s, heroChest, 14, 0, COL.ward, 120 * s, 0.5, 3, 0); }
      const melee = !MOVES[b.move]?.proj && !["self", "potion", "wait", "block", "cast"].includes(b.move);
      if (b.move === "potion" || b.move === "self") {
        const cx = hx0, cy = groundY - 30 * s;
        if (fx === "heal" || fx === "circle" || fx === "potion") { burst(cx, groundY - 6 * s, 22, 4, fx === "potion" ? COL[b.el] || COL.health : cols, 60 * s, 1.1, 3, -40, true); if (fx === "circle") burst(cx, groundY - 2 * s, 14, 0, cols, 90 * s, 0.6, 3, 0); }
        else if (fx === "armor") { burst(cx, cy, 16, 3, cols, 110 * s, 0.6, 2.4, 200); flash = 0.15; flashC = "#e0c890"; }
        else if (fx === "fizzle") burst(handX(1, heroP), handY(1), 10, 2, COL.fizzle, 30 * s, 0.9, 5, -30, true);
        else if (fx === "turn") { burst(cx + 10 * s, cy, 30, 1, COL.turn, 320 * s, 0.6, 2.4, 0); flash = 0.4; flashC = "#fff6c0"; }
        else if (fx === "support") { beamT = 0; beamC = colOf("support", b.el)[0]; burst(allyX(), groundY - 30 * s, 22, 4, colOf("support", b.el), 70 * s, 1, 3, -40, true); burst(cx, cy, 8, 0, colOf("support", b.el), 40 * s, 0.5, 3, 0); }   // [spellbook] a beam to the ally you help
        else if (fx === "summon") { wolfT = 0; burst(hx0 + 46 * s, groundY - 10 * s, 8, 4, COL.summon, 60 * s, 0.6, 1.3, -60, true); }   // [summonfx] a faint shimmer, not a white cloud
        else if (fx === "bound") burst(handX(1, heroP), handY(1), 18, 0, COL.bound, 70 * s, 0.5, 3, 0);
        else if (fx === "invis") burst(cx, cy, 18, 4, COL.invis, 50 * s, 0.9, 3, -30, true);
        else burst(cx, cy, 18, 4, cols, 60 * s, 0.9, 3, -40, true);
        return;
      }
      // a hit lands
      const n = big ? 1.6 : 1, hurt = melee || b.dmg > 0 || !me;
      if (GS && hurt && (b.dmg > 0 || melee || !me)) {   // [OURS] gore.js: the spray, the splats, the streaks (a horse takes some of the blows you take in the saddle)
        const horse = !me && !b.ally && rec.horse && b.li % 3 === 0, side = me ? "foe" : b.ally ? "ally" : horse ? "horse" : "hero";
        GS.hit({ side, x: tx - dir * 2 * s, y: horse ? groundY - 20 * s : ty - 4 * s, live: !done }, { dmg: b.dmg, frac: (b.dmg || 0) / (me ? ehpMax : hpMax), type: GORE.typeOf(b, MOVES[b.move] || {}), crit: !!(b.crit || b.sneak), power: !!b.power, final: !!b.final && me, from: dir, arrow: ["arrow", "bolt"].includes(MOVES[b.move]?.proj?.[2]), key: goreKey(b, hitIdx) });
      }
      if (hurt) { if (me) foeKnock = b.final ? 20 : b.power ? 14 : 7; else if (!b.ally) heroKnock = b.final ? 20 : b.power ? 12 : 7; }
      if (AT_FOE.has(fx) && me) {   // spells that happen where the foe stands
        if (fx === "sun") burst(tx, ty, 22, 4, COL.sun, 80 * s, 0.9, 3, -50, true);
        else if (fx === "wall") burst(tx, groundY, 18, b.el === "frost" ? 3 : 0, colOf("wall", b.el), 90 * s, 0.8, 3, -80, true);
        else if (fx === "rune") burst(fx0, groundY - 2 * s, 12, 4, colOf("rune", b.el), 40 * s, 0.8, 3, -30, true);
        else burst(tx, ty, 18, 4, cols, 70 * s, 0.9, 3, -30, true);
      } else if (melee || b.move === "staff" && !PROJ.has(fx)) {
        const mfx = MOVES[b.move].fx || "slash";
        if (mfx === "slam" || mfx === "dust" || b.move === "stomp") { burst(tx, groundY - 2 * s, 18 * n, 2, COL.dust, 140 * s, 0.7, 6, -20, true); }
        if (mfx === "slam") { ringT = 0; ringX = tx; shake = Math.max(shake, 7); }
        if (mfx === "claw") claw = me ? -1 : 1;
        if (mfx === "punch") burst(tx, ty, 8, 2, COL.dust, 80 * s, 0.4, 4, 0);
        if (!GS) burst(tx - dir * 6 * s, ty, (mfx === "stab" || mfx === "bite" ? 8 : 14) * n, 1, COL.spark, 240 * s, 0.35, 2, 260);
        else if (me && foeMetal && mfx !== "bite" && mfx !== "claw") burst(tx - dir * 6 * s, ty, 5 * n, 1, COL.spark, 280 * s, 0.18, 1.5, 200);   // [blood3] with blood on, sparks only off metal: few, bright, quick
        if (b.enchant) burst(tx, ty, 12, 0, COL[b.enchant] || COL.glow, 120 * s, 0.5, 3, 0);
        if (hurt && !b.ally) bloodAt(tx - dir * 2 * s, ty - 4 * s, dir, (b.final ? 26 : b.crit || b.sneak ? 18 : b.power ? 14 : 8) * (mfx === "stab" || mfx === "bite" ? 0.7 : 1), !me);
        { const gr = !me ? rec.hero.gearO?.gear : null; if (gr && gr.w === "heavy" && gr.metal) burst(tx, ty, 6 * n, 1, ["#ffffff", "#ffe8a0", "#fff2c0"], 280 * s, 0.2, 1.5, 220); }   // armour clank: a few quick sparks off plate [blood3]
      } else if (fx === "fire" || b.el === "fire" && fx !== "breath" && fx !== "fus") {
        burst(tx, ty, 26 * n, 0, COL.fire, 200 * s, 0.6, 4, 120); burst(tx, ty, 8, 2, COL.smoke, 40 * s, 1.3, 9, -40, true); ringT = 0; ringX = tx; ringC = "#ffb347";
      } else if (fx === "frost" || b.el === "frost" && fx !== "breath") {
        burst(tx, ty, 16 * n, 3, COL.frost, 210 * s, 0.6, 2.6, 260); burst(tx, ty, 10, 2, ["#d8f0ff", "#bfe8ff"], 40 * s, 1.1, 10, -10);
      } else if (fx === "shock" || b.el === "shock") {
        burst(tx, ty, 16 * n, 1, COL.shock, 260 * s, 0.4, 2, 0); flash = 0.25; flashC = "#d8d0ff";
      } else if (fx === "paralyze") burst(tx, ty, 16, 1, COL.paralyze, 160 * s, 0.5, 2, 0);
      else if (fx === "fus") { burst(tx, groundY - 4 * s, 20, 2, COL.dust, 180 * s, 0.7, 6, -10, true); foeKnock = me ? 28 : foeKnock; if (!me) heroKnock = 24; shake = Math.max(shake, 6); }
      else if (fx === "breath") burst(tx, ty, 14, b.el === "frost" ? 3 : 0, COL[b.el] || COL.fire, 140 * s, 0.6, 3, 60);
      else if (b.move === "drain") burst(tx, ty, 10, 0, COL.drain, 80 * s, 0.5, 3, 0);
      else { burst(tx, ty, 14, 1, COL.spark, 220 * s, 0.35, 2, 260); if (["arrow", "bolt"].includes(MOVES[b.move]?.proj?.[2]) && !b.ally) bloodAt(tx, ty, dir, b.final || b.crit ? 12 : 6, !me); }
      if (rm) { shake = 0; return; }
      if (b.power) { hitstop = 0.08; shake = Math.max(shake, 5); }
      if (b.crit || b.sneak) { slowT = 0.45; shake = Math.max(shake, 4); }
      if (b.final) { slowT = f.bf && b.who === "me" ? 1.4 : f.tbTall ? 1.3 : 0.6; /* [OURS] the blow that ends a turn-by-turn fight plays in slow motion */ shake = Math.max(shake, 8); zoomT = f.bf ? 1.5 : 0.9; if (!CFX) { zcx = tx; zcy = ty; } flash = Math.max(flash, 0.3); flashC = "#fff"; }
    }
    let ringT = 1, ringX = 0, ringC = "#e9dcc0", beamT = 1, beamC = "#9affc0";
    function landNumbers(b) {   // the number and the health bars, once per beat (on the last hit)
      const me = b.who === "me", tx = me ? fx0 : hx0, ty = Math.max(46, (me ? foeChest : heroChest) - 18 * s);
      if (b.ehpT != null && b.ehpT !== ehpT) { ehpT = b.ehpT; ehpLT = 0.35; }
      if (b.hpT != null && b.hpT !== hpT) { hpT = b.hpT; hpLT = 0.35; }
      const ELC = { fire: "#ff9a4a", frost: "#a8e0ff", shock: "#dcc4ff", poison: "#a6e870" };   // colour-coded damage numbers by element
      if (b.dmg && !b.miss) float(tx, ty, b.num, ELC[b.el] || (me ? (b.crit || b.sneak ? "#ffd060" : "#fff2c0") : "#ff8a7a"), b.crit || b.sneak || b.final ? 22 : b.power ? 18 : 15);
      if (b.heal) float(hx0, groundY - 70 * s, "+" + b.heal, "#a8f08a", 16);
      if (b.crit) { label = L("CRITICAL"); labelT = 1.1; labelC = "#ffd060"; }
      if (b.sneak) { label = L(b.sneak); labelT = 1.2; labelC = "#c8b8ff"; }
      if (b.rune) { burst(fx0, groundY - 4 * s, 26, 0, COL[b.rune] || COL.fire, 190 * s, 0.7, 4, 60, true); ringT = 0; ringX = fx0; ringC = COL[b.rune]?.[0] || "#ffb347"; shake = rm ? 0 : Math.max(shake, 4); }
    }
    function revealLog(li) {
      if (li <= revealed) return; revealed = li;
      const det = el.nextElementSibling; if (!det || !det.matches?.("details")) return;
      const rows = det.querySelectorAll(".flog > div");
      for (let i = 0; i < rows.length; i++) rows[i].classList.toggle("fpend", i > li);
    }
    function finish() {
      done = true; rec.played = true; phase = f.tbMid ? "idle" : "end"; bi = beats.length; fall = f.tbMid ? 0 : 1;
      hpD = hpT = hpL = last.hp ?? hpT; ehpD = ehpT = ehpL = last.ehp ?? ehpT;
      for (let i = 0; i < NP; i++) pl[i] = 0; for (let i = 0; i < NF; i++) fl[i] = 0;
      label = null; slowT = 0; shake = 0; zoomT = 0; zoom = 1; camF = 0.5; hitstop = 0; flash = 0; boltOn = 0; AFX?.clear(); MFX?.clear();
      if (!f.tbMid) pickDeath();
      GS?.settle();   // what's in the air drops; what has landed stays
      revealLog(1e9); ctl?.remove();
      draw(performance.now());
      idleArt();
    }
    // ---- no speed or skip buttons any more (build 146: players didn't want them); tapping the scene still finishes it
    let ctl = null;
    if (!(rec.played || autoSkip() || !beats.length)) revealLog(-1);

    // ---- one step of time
    function update(dtr) {
      if (done) return;
      real += dtr;
      if (hitstop > 0) { hitstop -= dtr; dtr = 0; }
      let dt = dtr;
      if (slowT > 0) { slowT -= dtr; dt *= 0.3; }
      if (RIG) RIG.update(dt);
      // bars drain smoothly, the white lag bar follows a moment later
      hpD += (hpT - hpD) * Math.min(1, dtr * 10); ehpD += (ehpT - ehpD) * Math.min(1, dtr * 10);
      if (hpLT > 0) hpLT -= dtr; else hpL += (hpD - hpL) * Math.min(1, dtr * 4);
      if (ehpLT > 0) ehpLT -= dtr; else ehpL += (ehpD - ehpL) * Math.min(1, dtr * 4);
      shake = Math.max(0, shake - dtr * 22); flash = Math.max(0, flash - dtr * 2.5); zoomT = Math.max(0, zoomT - dtr);
      if (CFX && !rm) {   // the camera leans toward the swing, follows the blow, punches in on crits and holds on the killing blow
        let tf = 0.5, tz = 1;
        if (phase === "play" && beats[bi]) { const b2 = beats[bi], m2 = MOVES[b2.move] || MOVES.wait; [tf, tz] = CFX.camFor(b2, Math.min(1, lt / b2.dur), { hx: hx0 / W, fx: fx0 / W, hitU: m2.hits[0] ?? 0.55, boss: !!f.bf }); }
        else if (phase === "fall") { tf = (won && !turned ? fx0 : hx0) / W; tz = 1.15; }
        if (zoomT > 0) tz = Math.max(tz, 1.2);
        camF += (tf - camF) * Math.min(1, dtr * 4); zoom += (tz - zoom) * Math.min(1, dtr * (tz > zoom ? 7 : 3));
      } else zoom += ((zoomT > 0 && !rm ? 1.12 : 1) - zoom) * Math.min(1, dtr * 8);
      heroKnock *= Math.exp(-dtr * 7); foeKnock *= Math.exp(-dtr * 7);
      heroDodge = Math.min(1, heroDodge + dtr * 2.6); foeDodge = Math.min(1, foeDodge + dtr * 2.6); wolfT = Math.min(1, wolfT + dtr * 1.4);
      claw *= Math.exp(-dtr * 5); if (labelT > 0) labelT -= dtr; ringT = Math.min(1, ringT + dtr * 2.2); beamT = Math.min(1, beamT + dtr * 1.8);
      for (let i = 0; i < NF; i++) if (fl[i] > 0) { fxs[i] += fvx[i] * dtr; fys[i] += fvy[i] * dtr; fvy[i] += 220 * dtr; fl[i] -= dtr * 0.9; }
      // [OURS] elemental statuses (perkfx.js): flames lick a burning figure, frost mist on a chilled one, sparks on a jolted one
      { const cs = curSt(); const fire = ["#ffb347", "#ff7a2a", "#ffd27a"];
        for (const [who, st] of [["me", cs.me], ["foe", cs.foe]]) {
          const X0 = who === "me" ? hx0 : fx0, Y0 = who === "me" ? heroChest : foeChest;
          if (st.burn && Math.random() < (rm ? 0.15 : 0.45)) spawn(0, fire[(Math.random() * 3) | 0], X0 + (Math.random() - 0.5) * 22 * s, Y0 + (Math.random() * 20 - 4) * s, (Math.random() - 0.5) * 12 * s, -60 * s, 0.6, 3, -20);
          if (st.chill && Math.random() < (rm ? 0.08 : 0.25)) spawn(2, "#e0f4ff", X0 + (Math.random() - 0.5) * 24 * s, Y0 + 10 * s, 0, -12 * s, 0.9, 5, 0);
          if (st.shock && Math.random() < (rm ? 0.08 : 0.25)) spawn(1, "#cfe7ff", X0 + (Math.random() - 0.5) * 20 * s, Y0 + (Math.random() - 0.5) * 20 * s, (Math.random() - 0.5) * 120 * s, (Math.random() - 0.5) * 120 * s, 0.25, 2, 0);
        } }
      if (GS) { if (phase === "play" && beats[bi]) GS.statusOf((f.log || [])[beats[bi].li]); GS.update(dt); }   // [OURS] gore.js
      AFX?.tick(dt); MFX?.tick(dt);
      // particles
      alive = 0;
      for (let i = 0; i < NP; i++) { if (pl[i] <= 0) continue; alive++; pl[i] -= dt; pvy[i] += pg[i] * s * dt; const dr = pt[i] === 2 ? 0.96 : 0.985; pvx[i] *= dr; pvy[i] *= dr; px[i] += pvx[i] * dt; py[i] += pvy[i] * dt; if (pt[i] === 2) ps[i] += dt * 6; if (pt[i] === 4) px[i] += Math.sin(py[i] * 0.1) * 0.4; }
      if (phase === "play") {
        const b = beats[bi], m = MOVES[b.move] || MOVES.wait;
        // the pace: real time at first, a little quicker after 12 turns, fast-forward past ~25 s
        const auto = (b.li > 12 ? 1.35 : 1) * (real > 25 ? 6 : 1);
        lt += dt * 1000 * speed * auto;
        const u = Math.min(1, lt / b.dur);
        if (b.tag && !b.tagShown && u >= (b.tagU || 0)) { b.tagShown = true; label = L(b.tag); labelT = 1.1; labelC = b.who === "me" ? "#e9dcc0" : "#ffb070"; }   // [phantom] "Winds up!", "Counter!": what this beat is when it isn't a plain blow
        // charging hands, projectiles in flight
        const own = MFX ? MFX.step(dt, b, (f.log || [])[b.li], m, u, mfxGeo()) : false;   // [movefx] this spell's own charge, delivery and impact
        if (!own && m.charge && u > m.charge[0] && u < m.charge[1] && Math.random() < 0.7 * pmul) { const side = b.who === "me" ? 1 : -1, P0 = side > 0 ? heroP : foeP, c = colOf(b.fx, b.el); spawn(0, c[(Math.random() * c.length) | 0], handX(side, P0) + (Math.random() - 0.5) * 14 * s, handY(side) + (Math.random() - 0.5) * 14 * s, 0, -20 * s, 0.4, 1.8, 0); }
        if (m.proj && !own) projStep(b, m, u);
        sampleTrail(b, m, u);
        if (!own && b.who === "me" && !b.miss && b.fx === "wall" && u > 0.45) for (let i = 0; i < 3; i++) if (Math.random() < 0.9 * pmul) {   // walls and storms: columns of fire, frost or lightning
          const cx = fx0 + (i - 1) * 16 * s, c = colOf("wall", b.el), down = b.el === "frost" && b.storm, x = cx + (Math.random() - 0.5) * 7 * s;
          spawn(b.el === "frost" ? 3 : 0, c[(Math.random() * c.length) | 0], x, down ? groundY - 90 * s : groundY, 0, (down ? 170 : -150) * s, 0.55, 3, 0);
          if (b.el === "frost" && Math.random() < 0.3) spawn(2, "#e0f4ff", x, groundY - 10 * s, 0, -20 * s, 0.9, 6, 0);
        }
        if (b.burn && u > 0.8 && Math.random() < 0.6 * pmul) { const c = colOf("wall", b.burn === "dust" ? "fire" : b.burn); spawn(0, c[0], fx0 + (Math.random() - 0.5) * 20 * s, foeChest + 10 * s, 0, -50 * s, 0.4, 3, 0); }
        while (hitIdx < m.hits.length && u >= m.hits[hitIdx]) { const lastHit = hitIdx === m.hits.length - 1; impact(b, lastHit); if (lastHit) landNumbers(b); hitIdx++; }
        if (b.wolf && u > 0.55 && wolfT >= 1) wolfT = 0;   // your familiar joins in
        if (u >= 1) {
          if (!m.hits.length) landNumbers(b);
          revealLog(b.li);
          bi++; lt = 0; hitIdx = 0; boltOn = 0; TRL.length = 0;
          if (bi >= beats.length) { phase = f.tbMid ? (CFX && !rm ? "settle" : "idle") : "fall"; phaseT = 0; if (phase === "idle") { done = true; rec.played = true; revealLog(1e9); ctl?.remove(); } if (phase === "fall") pickDeath(); }
        }
      } else if (phase === "settle") {   // a turn-by-turn fight: let the camera ease back before the scene rests
        phaseT += dtr; if (phaseT > 0.5 || Math.abs(zoom - 1) < 0.004) { zoom = 1; camF = 0.5; phase = "idle"; done = true; rec.played = true; revealLog(1e9); ctl?.remove(); }
      } else if (phase === "fall") {
        phaseT += dt; fall = Math.min(1, phaseT / 0.7);
        if (deathK === "decap" && phaseT < 0.9) {   // the neck sprays as the body goes down
          const th = Math.PI / 2 * EASE.out(fall), nx = fx0 - s * NECK * Math.sin(th), ny = groundY + s * NECK * Math.cos(th);
          if (GS) { if ((phaseT * 30 | 0) !== ((phaseT - dt) * 30 | 0)) GS.spurt(nx, ny, phaseT * 30 | 0); } else if (Math.random() < 0.9 * pmul) bloodAt(nx, ny, 1, 2, false);
        }
        if (deathK === "ash" && phaseT > 0.35 && phaseT < 1.2 && Math.random() < 0.8 * pmul) { const c = Math.random() < 0.5 ? "#3a3430" : "#ff7a2a"; spawn(Math.random() < 0.3 ? 0 : 2, c, fx0 + (Math.random() - 0.5) * 24 * s * fSize, groundY - Math.random() * 60 * s * fSize, (Math.random() - 0.2) * 30 * s, -40 * s, 0.9, 3, -15); }
        if (deathK === "shatter" && phaseT >= 0.45 && phaseT - dt < 0.45) { burst(fx0, foeChest, 34, 3, ["#e8f8ff", "#bfe8ff", "#7fb0d8"], 260 * s, 0.9, 3.4, 380); burst(fx0, foeChest, 10, 2, ["#e0f4ff"], 60 * s, 1, 8, -10); flash = rm ? 0 : 0.25; flashC = "#e8f8ff"; shake = rm ? 0 : Math.max(shake, 5); }
        if (deathK === "fry" && phaseT < 0.7 && Math.random() < 0.6 * pmul) spawn(1, Math.random() < 0.5 ? "#c8b8ff" : "#ffffff", fx0 + (Math.random() - 0.5) * 26 * s, foeChest + (Math.random() - 0.5) * 30 * s, (Math.random() - 0.5) * 200 * s, (Math.random() - 0.5) * 200 * s, 0.2, 2, 0);
        const lb = beats[beats.length - 1];
        if (lb && lb.st && lb.st.soul && won && phaseT < 0.9 && Math.random() < pmul) spawn(0, "#b07aff", fx0, foeChest, (hx0 - fx0) * 1.3, -30 * s, 0.7, 3, 0);   // the soul streams into you
        if (phaseT > 0.7 && phaseT - dt <= 0.7 && !rm) {   // [blood3] the body hits the ground: a low, faint puff of dust that settles fast (no discs floating up)
          const bx = won ? fx0 : hx0; for (let i = 0, nn = Math.max(2, Math.round(8 * pmul)); i < nn; i++) { const sd = (i % 2 ? 1 : -1) * (0.4 + Math.random() * 0.6); spawn(2, COL.dust[i % 3], bx + sd * 14 * s, groundY - (1 + Math.random() * 3) * s, sd * 70 * s, -(4 + Math.random() * 8) * s, 0.45 + Math.random() * 0.2, 3.5 + Math.random() * 2, 0); }
          shake = Math.max(shake, 3);
        }
        if (phaseT > 1.4) { done = true; rec.played = true; phase = "end"; revealLog(1e9); ctl?.remove(); }
      }
    }
    // projectiles: arrows, bolts, spell bolts, lightning, shouts, breath, drain streams
    function projStep(b, m, u) {
      const [a0, a1, ptype] = m.proj, me = b.who === "me", side = me ? 1 : -1, type = b.fx === "breath" ? "cone" : ptype;
      if (AFX && (type === "arrow" || type === "bolt")) {   // [arrowfx] on the release of the draw: one painted shot from the bow to the target
        if (u >= a0 && !b.shot) {
          b.shot = 1;
          const pace = speed * (b.li > 12 ? 1.35 : 1) * (real > 25 ? 6 : 1), dur = (a1 - a0) * b.dur / 1000 / pace;
          const x0 = handX(side, me ? heroP : foeP) + side * 4 * s, y0 = handY(side) - (me ? seatLift : 0), x1 = me ? fx0 : (b.ally ? allyX() : hx0), y1 = me ? foeChest : heroChest - (b.ally ? 0 : seatLift);
          const sp = ARROWFX.spec({ wt: type === "bolt" ? "crossbow" : "bow", el: b.enchant || (b.poison ? "poison" : null), power: b.power, sneak: !!b.sneak, crit: b.crit, ballista: b.ballista });
          AFX.fire(null, { x0, y0, x1, y1, dur, sp, miss: b.miss, blocked: !me && !!b.blocked, gore: me && !!GS });
          if (b.second) AFX.fire(null, { x0, y0: y0 + 3 * s, x1, y1: y1 - 6 * s, dur: dur * 1.15, sp, miss: b.miss, gore: me && !!GS });   // a second arrow right behind
        }
        projX = -1; return;
      }
      if (u < a0 || u > a1 + 0.02) { if (u > a1) boltOn = 0; return; }
      const p = Math.max(0, Math.min(1, (u - a0) / (a1 - a0)));
      const breathMe = type === "cone" && me, x0 = breathMe ? hx0 + (heroP.dx + 12) * s : handX(side, me ? heroP : foeP), y0 = breathMe ? groundY - 56 * s : handY(side), x1 = me ? fx0 : (b.ally ? allyX() : hx0), y1 = me ? foeChest : heroChest;
      const fx = b.fx || type, el = b.el;
      if (type === "spell" && AT_FOE.has(fx)) { projX = -1; return; }
      if (type === "spell" && (fx === "shock" || el === "shock") || type === "spell" && fx === "paralyze") {   // instant lightning
        boltOn = 1; boltX0 = x0; boltY0 = y0; boltX1 = x1; boltY1 = y1; boltC = fx === "paralyze" ? "#9aff6a" : "#c8b8ff";
        if (++boltJag % 3 === 1) jag(); projX = -1; return;
      }
      projX = x0 + (x1 - x0) * EASE.in(p) * 0.6 + (x1 - x0) * p * 0.4; projY = y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * (type === "arrow" ? 12 : 4) * s; projType = type; projEl = el; projFx = fx; projSide = side; projP = p;
      if (b.miss && p > 0.8) projY -= (p - 0.8) * 60 * s;   // sails past
      const c = colOf(fx, el);
      if (type === "arrow" || type === "bolt") { if (Math.random() < 0.6 * pmul) spawn(1, "#e9dcc0", projX, projY, -side * 40 * s, 0, 0.18, 1.4, 0); if (b.enchant) spawn(0, (COL[b.enchant] || COL.glow)[0], projX, projY, 0, 0, 0.3, 3, 0); }
      else if (type === "spell") { for (let i = 0; i < 2; i++) if (Math.random() < 0.8 * pmul) spawn(el === "frost" ? 2 : 0, c[(Math.random() * c.length) | 0], projX, projY + (Math.random() - 0.5) * 6 * s, -side * (30 + Math.random() * 40) * s, (Math.random() - 0.5) * 30 * s, el === "frost" ? 0.5 : 0.35, el === "frost" ? 4 : 3, el === "fire" ? -60 : 0); }
      else if (type === "cone") { const cc = COL[el] || COL.fire; for (let i = 0; i < 3; i++) if (Math.random() < pmul) { const a = Math.PI + (Math.random() - 0.5) * 0.5 - 0.25 * side, v = (220 + Math.random() * 120) * s; spawn(el === "frost" ? 2 : 0, cc[(Math.random() * cc.length) | 0], x0, y0, me ? -Math.cos(a) * v : Math.cos(a) * v, Math.abs(Math.sin(a)) * v * 0.6 + 50 * s, 0.6, el === "frost" ? 5 : 4, 0); } projX = -1; }
      else if (type === "wave") { if (Math.random() < 0.9 * pmul) spawn(1, Math.random() < 0.5 ? "#ffffff" : "#d8e8ff", projX - side * 10 * s, projY + (Math.random() - 0.5) * 40 * s, side * 380 * s, 0, 0.22, 2.2, 0); }
      else if (type === "drain") { if (Math.random() < pmul) spawn(0, COL.drain[(Math.random() * 2) | 0], x1 + (x0 - x1) * Math.random() * 0.2, y1, (x0 - x1) * 1.6, (y0 - y1) * 1.6 - 20 * s, 0.6, 3, 0); projX = -1; }
    }
    let projX = -1, projY = 0, projType = "", projEl = null, projFx = null, projSide = 1, projP = 0;

    function poses(b, m, u, st, tt) {
      idlePose(heroP, rec.hero.wt); idlePose(foeP, null);
      if (b && b.who === "me" && m) poseAt(m, u, heroP, 1);
      if (b && b.who === "them" && m) { poseAt(m, u, foeP, reach); if (b.guard) { heroP.back = -1.66; heroP.aim = -0.6; } }
      if (b && b.who === "them" && b.status === "stagger") foeP.lean = Math.sin(tt * 12) * 0.08 - 0.12;
      heroP.wt = b && b.who === "me" && b.move !== "potion" ? b.wt : rec.hero.wt; heroP.glow = !!(st && st.bound); heroP.flask = b && b.move === "potion" && u > 0.15 && u < 0.85 ? b.flask : null;
      foeP.wt = b && b.who === "them" && b.wt ? b.wt : null;
      const mine = !!(b && b.who === "me" && m);   // [OURS] the painted figure (rig.js) plays the body of the move, its blow landing on the hit frame
      heroP.move = mine ? b.move : null; heroP.mu = mine ? u : null; heroP.hitU = mine && m.hits ? m.hits[0] : null; heroP.power = mine && !!b.power;
    }
    function sampleTrail(b, m, u) {   // the weapon tip, every step, so the trail follows the real arc
      if (!m.trail) return;
      const hitU = m.hits[0], side = b.who === "me" ? 1 : -1;
      if (side > 0 && heroRig) return;   // the painted figure reports its own blade while it is drawn (draw)
      if (u > hitU - 0.18 && u < hitU + 0.1) {
        poses(b, m, u, b.st, 0); const P0 = side > 0 ? heroP : foeP; tipOf(side, P0, side > 0 ? heroP.wt : (foeP.wt || FOE_MOVE[foeK]), 22);
        const hx = handX(side, P0), hy = handY(side), x = TR[22], y = TR[23];
        pushTrail(x, y, hx + (x - hx) * 0.45, hy + (y - hy) * 0.45);
      }
    }
    // ---- drawing
    function draw(now) {
      const t0 = performance.now();
      const b = phase === "play" ? beats[bi] : null, m = b ? MOVES[b.move] || MOVES.wait : null, u = b ? Math.min(1, lt / b.dur) : 1;
      const st = b ? b.st : beats.length ? beats[beats.length - 1].st : {};
      const tt = now / 1000;
      poses(b, m, u, st, tt);
      // camera
      const camK = FS ? FS.cam() : 1, sh = rm ? 0 : shake * camK, z = 1 + (zoom - 1) * camK, ox = (sh ? (Math.random() - 0.5) * sh * 2 : 0) + (CFX && !rm ? CFX.pan(camF * W, z, W, zcx) : 0), oy = (sh ? (Math.random() - 0.5) * sh * 2 : 0) + (CFX && !rm ? CFX.pan(heroChest, z, Hh, zcy) : 0);
      wg.setTransform(1, 0, 0, 1, 0, 0); wg.imageSmoothingEnabled = true;
      if (z !== 1 || sh) { wg.fillStyle = "#1c2128"; wg.fillRect(0, 0, work.width, work.height); }
      const sc = k * z, tx = (ox + zcx - zcx * z) * k, ty = (oy + zcy - zcy * z) * k;
      wg.setTransform(sc, 0, 0, sc, tx, ty);
      const art = rec.art && typeof BSCENE !== "undefined" ? BSCENE.ready(rec.art) : null;   // [OURS] the painted scene once its pictures are in, else the drawn one
      const artO = art ? { W, Hh, t: rm ? 0 : tt, ox, sky: rec.sky, wagon: rec.wagon } : null;
      if (art) BSCENE.back(wg, art, artO); else wg.drawImage(bg, 0, 0, W, Hh);
      if (cv.dataset.bs !== (art ? rec.art : "")) cv.dataset.bs = art ? rec.art : "";   // which painted scene is on (screen tests)
      const RL = typeof RIGLOOK !== "undefined" ? RIGLOOK : null; if (RL) RL.scene(art ? rec.art : null);   // [rigcohesion] the fighters take this scene's light (riglook.js)
      GS?.drawGround(wg);   // [OURS] gore.js: splats, pools and scorch marks on the ground (they stay for the fight)
      MFX?.drawGround(wg);   // [movefx] scorch, frost creep, rune circles left by spells
      const mOwn = !!(MFX && b && MFX.owns(b));
      // a rune waiting on the ground, a portal
      if (st.rune) rune(fx0, groundY, COL[st.rune]?.[0] || "#ffb347", tt);
      if (b && !mOwn && b.fx === "rune" && b.who === "me" && u > 0.4) rune(fx0, groundY, COL[b.el]?.[0] || "#ffb347", tt);
      if (b && !mOwn && b.fx === "summon" && b.who === "me" && u > 0.2) portal(Math.min(hx0 + 46 * s, fx0 - 40 * s), groundY, Math.min(1, (u - 0.2) * 3) * (u > 0.85 ? (1 - u) / 0.15 : 1), tt);
      // [fightpos] the foes still waiting their turn stand behind the one you fight (dimmer, a little smaller), idle
      if (LAY && LAY.waiting.length) drawWaiting(tt);
      // allies behind you: each kind has its own figure (allyFig); dragons fly overhead
      // up to 7 other players plus followers stand with you, in depth rows from fightpos.js (the back rows drawn first)
      const mateTags = [];
      const allyLunge0 = b && b.who === "me" && b.ally && u > 0.5 && u < 0.85 ? Math.sin((u - 0.5) / 0.35 * Math.PI) : 0;
      const AA = typeof ALLYANIM !== "undefined" ? ALLYANIM : null, named = !!(b && b.allyActs && b.allyActs.length), hitU0 = m && m.hits.length ? m.hits[0] : 0.5;
      const allyLunge = named ? 0 : allyLunge0;   // [OURS] named allies play their own clip (allyanim.js); the rest step in together as before
      const animOf = (a) => AA && a.name ? AA.anim(b, a.name, u, hitU0, beats.downEnd) : null;
      if (slots.length) { const tag = slots.map((a) => { const x = animOf(a); return x ? x.clip : "idle"; }).join(","); if (cv.dataset.allyClips !== tag) cv.dataset.allyClips = tag; }   // which clip each ally is on (screen tests)
      const two = slots.length > 3;
      const order = slots.map((a, i) => ({ a, i, p: slotOf.get(i) || { x: hx0 - (26 + i * 20) * s, y: groundY, sc: 1, row: 0 } })).sort((p, q) => q.p.row - p.p.row || p.p.x - q.p.x);
      const foeFront = ((FP && FP.FOE[foeK]) || [0, 15])[1] * FSC;
      for (const { a, i, p } of order) {
        const an = animOf(a), al2 = an && an.clip === "attack" && !an.shoot ? Math.sin(Math.PI * Math.min(1, an.u / 0.8)) * (an.w ?? 1) : 0;
        // a melee blow: they step out of their row up to the foe, then back to their spot
        const tx = fx0 - (foeFront + 16) * s, sc2 = s * (p.sc + (1 - p.sc) * al2), ax = p.x + Math.max(0, tx - p.x) * al2 + allyLunge * 14 * s, ay = p.y + (groundY - p.y) * al2;
        const ahc = a.kind === "mate" && typeof MOUNTFIGHT !== "undefined" && typeof HORSEBACK !== "undefined" && !(an && an.clip === "down") ? MOUNTFIGHT.allyHorse(f, a.name) : null;   // a teammate in the saddle (mountfight.js)
        if (a.name && !two && (a.kind === "mate" || a.kind === "follower" || a.kind === "valor" || a.kind === "dog")) mateTags.push([a.name, ax * z + ox + zcx - zcx * z, (ay - (66 + (ahc ? 30 : 0)) * sc2) * z + oy + zcy - zcy * z]);   // [followersize] just over the head (a rider sits higher)
        if (AFX && an && an.shoot && an.u >= 0.55 && b && phase === "play" && !(b.shotBy && b.shotBy.includes(a.name))) {   // [arrowfx] a follower or party archer looses at the foe
          (b.shotBy = b.shotBy || []).push(a.name);
          AFX.fire(null, { x0: ax + 16 * sc2, y0: ay - (ahc ? 74 : 44) * sc2, x1: fx0, y1: foeChest, dur: 0.24, sp: ARROWFX.spec({ wt: /crossbow/.test(a.look?.wt || "") ? "crossbow" : "bow" }), miss: false, gore: !!GS });
        }
        wg.save(); wg.translate(ax, ay); wg.scale(sc2, sc2); if (p.row && !al2) wg.globalAlpha = 0.94;
        if (ahc) { const by = -30 - (HORSEBACK.riderBob ? HORSEBACK.riderBob(ahc, tt + i) : 0); wg.save(); wg.translate(0, by); allyFig(wg, a.kind, { lunge: allyLunge, t: tt, i, look: a.look, anim: an, ride: true, rideLayer: "far" }); wg.restore(); }
        if (ahc) { HORSEBACK.drawHorse(wg, ahc, 0, tt + i, "back"); HORSEBACK.drawHorse(wg, ahc, 0, tt + i, "front"); wg.translate(0, -30 - (HORSEBACK.riderBob ? HORSEBACK.riderBob(ahc, tt + i) : 0)); }   // [riding] the horse first, the rider on it
        allyFig(wg, a.kind, { lunge: allyLunge, t: tt, i, look: a.look, anim: an, ride: !!ahc });
        wg.restore();
        const sp = SPARK[a.kind]; if (sp && Math.random() < (two ? 0.09 : 0.18) * pmul) spawn(sp[1], sp[0], ax + (Math.random() - 0.5) * 18 * s, ay + (sp[2] - Math.random() * 30) * s, (Math.random() - 0.5) * 14 * s, -20 * s, 0.7, 1.3, 0);   // [summonfx] small motes, never a glow over the figure
      }
      if (two) { const named = slots.filter((a) => a.kind === "mate").length, tg = LAY && LAY.tag ? LAY.tag : { x: hx0 - 50 * s, y: groundY - 78 * s }; mateTags.push([L(`⚑ ${named ? `${named} of your party` : `${slots.length} allies`} with you`), tg.x * z + ox + zcx - zcx * z, tg.y * z + oy + zcy - zcy * z]); }   // a big party: one label instead of a pile of names
      for (const a of flyers) {   // a dragon circles above and dives in with fire when it strikes
        const fp0 = LAY && LAY.flyers[0], cx = Math.max(band[0] + 40 * s, (fp0 ? fp0.x : hx0 - 10 * s) + Math.sin(tt * 0.5) * 30 * s) + allyLunge * (fx0 - hx0) * 0.35, cy = (fp0 ? fp0.y : groundY - 44 * s) + allyLunge * 10 * s + Math.sin(tt * 1.3) * 4 * s;
        wg.save(); wg.translate(cx, cy); wg.scale(s, s); allyFig(wg, a.kind, { lunge: allyLunge, t: tt }); wg.restore();
        if (allyLunge > 0.3) for (let k = 0; k < 3; k++) if (Math.random() < pmul) spawn(0, ["#fff2c0", "#ffb347", "#e8653a"][k], cx + 40 * s, cy - 40 * s, (fx0 - cx) * (1.2 + Math.random() * 0.6), (groundY - 40 * s - cy) * (1.1 + Math.random() * 0.5), 0.6, 4, 0);
        if (a.name) mateTags.push([a.name, cx * z + ox + zcx - zcx * z, (cy - 50 * s) * z + oy + zcy - zcy * z]);
      }
      // your summon: the spectral wolf, a Dremora, an atronach
      const liveSum = f.tbMid && f.summonTurns > 0 && f.summonId ? summonKind(f.summonId, f.summonName) : null;   // a turn-by-turn fight: your summon stays in view between turns
      if ((st && b && b.wolf) || (b && b.fx === "summon" && b.who === "me" && u > 0.5) || liveSum) {
        const lunge = wolfT < 1 ? Math.sin(wolfT * Math.PI) : 0, sk = (b && b.st && b.st.summon) || st.summon || liveSum || "familiar";
        // [fightpos] one row back, just ahead of you and short of the foe; it bounds forward when it strikes
        const sx0 = Math.min(hx0 + 34 * s, fx0 - (foeFront + 24) * s), sx = sx0 + lunge * Math.max(0, Math.min(50 * s, fx0 - (foeFront + 12) * s - sx0)), sy = groundY - (LAY ? 7 * s * (1 - lunge) : 0), ss = s * (LAY ? 0.9 + 0.1 * lunge : 1);
        wg.save(); wg.translate(sx, sy); wg.scale(ss, ss); allyFig(wg, sk, { lunge, t: tt }); wg.restore();
        const sp = SPARK[sk]; if (sp && Math.random() < 0.14 * pmul) spawn(sp[1], sp[0], sx + (Math.random() - 0.5) * 16 * s, groundY + (sp[2] - Math.random() * 30) * s, (Math.random() - 0.5) * 12 * s, -24 * s, 0.6, 1.1, 0);   // [summonfx] a few small motes
      }
      // you
      const over = phase !== "play" && phase !== "idle" && phase !== "settle";   // "idle": one turn of a turn-by-turn fight has played, both still stand
      const meDown = over && !won, foeDown = over && won && !turned, fallE = EASE.out(fall);
      if (GS && meDown && GS.down && !GS.downDone) { GS.downDone = true; GS.down({ side: "hero", x: hx0 - 14 * s, ground: groundY, instant: done }); }   // [blood2] knocked down: a pool spreads under you (gorefx2.js; never under friends or horses)
      const hdg = heroDodge < 1 ? Math.sin(heroDodge * Math.PI) : 0, fdg = foeDodge < 1 ? Math.sin(foeDodge * Math.PI) : 0;
      if (rec.horse && typeof HORSEBACK !== "undefined" && HORSEBACK.drawDowned && HORSEBACK.downAt(f, phase === "play" ? bi / Math.max(1, beats.length) : 1)) {   // [OURS] your horse is downed: it lies behind you, you fight on foot
        wg.save(); wg.translate(hx0 - 58 * s, groundY); wg.scale(s, s); HORSEBACK.drawDowned(wg, rec.horse, tt, L("Downed"), rec.horseCoat); wg.restore();
      }
      wg.save(); wg.translate(hx0 + (heroP.dx - heroKnock - hdg * 18) * s, groundY + (heroP.dy - hdg * 3) * s); wg.scale(s, s);
      const painted = !!rec.hero.look && !rec.hero.beast && typeof PAINTRIG !== "undefined" && PAINTRIG.can(rec.hero.look);   // the painted figure falls by itself
      heroP.knock = heroKnock; heroP.down = meDown && painted ? fallE : 0; heroRig = painted;
      if (meDown && !painted) { wg.translate(-6 * fallE, 0); wg.rotate(-Math.PI / 2 * fallE); wg.translate(0, 6 * fallE); }
      if (st.invis && !(b && b.who === "me" && b.move !== "self" && b.move !== "shout")) wg.globalAlpha = 0.28 + Math.sin(tt * 3) * 0.05;
      const MFx = typeof MOUNTFIGHT !== "undefined" ? MOUNTFIGHT : null, rfrac = phase === "play" && b ? (b.li != null ? b.li + u : (bi + u) / Math.max(1, beats.length) * (f.log || []).length) / Math.max(1, (f.log || []).length) : 1;
      const mp = rec.horse && !meDown && MFx ? MFx.pose(f, rfrac, b ? b.who : null) : null;   // mountfight.js: charge, getting on / off, thrown, the horse waiting or knocked down
      const onHorse = rec.horse && !meDown && typeof HORSEBACK !== "undefined" && (mp ? mp.ride : HORSEBACK.upAt(f, phase === "play" ? bi / Math.max(1, beats.length) : 1));   // the rider sits up on the horse
      if (mp && !mp.ride && mp.stand) MFx.drawStand(wg, rec.horse, mp, tt, rec.horseCoat);
      heroP.ride = !!onHorse && (mp && MFx.seated ? MFx.seated(mp) : true);
      seatLift = onHorse && heroP.ride ? 30 * s : 0;   // [arrowfx] shots leave from the saddle   // legs astride (not while you still stand beside it, getting on or off)
      /* [riding] in the saddle the layers go: your far leg (in shade), the whole horse, then you with the near leg over its flank */
      const seatHere = () => { if (mp) MFx.seat(wg, mp, tt, rec.horse); else wg.translate(0, -30 - (HORSEBACK.riderBob ? HORSEBACK.riderBob(rec.horse, tt) : 0)); };
      if (onHorse && heroP.ride && rec.hero.look && !rec.hero.beast && !rec.hero.lord && !(b && b.st && (b.st.beast || b.st.lord))) { wg.save(); seatHere(); heroFig(wg, rec.hero, 0, tt, { ...heroP, rideLayer: "far" }); wg.restore(); }
      if (onHorse) { for (const part of ["back", "front"]) { if (mp) MFx.drawMount(wg, rec.horse, mp, tt, part, rec.horseCoat); else HORSEBACK.drawHorse(wg, rec.horse, 0, tt, part, rec.horseCoat); } wg.save(); seatHere(); }
      { const fs = b ? b.st : st, form = fs && (fs.beast || fs.lord) && (phase === "play" || phase === "settle" || phase === "idle"); heroFig(wg, form ? { ...rec.hero, beast: fs.beast, lord: fs.lord } : rec.hero, form ? Math.max(0, Math.min(1, (heroP.dx || 0) / 40)) : 0, tt, heroP);
        if (form) heroRig = false;
        else if (painted && b && b.who === "me" && m && m.trail && phase === "play" && u > m.hits[0] - 0.15 && u < m.hits[0] + 0.1 && PAINTRIG.tip) {   // [rigraces] the painted blade, where it really is
          const T = PAINTRIG.tip("me");
          if (T && T.n !== tipN) { tipN = T.n; const q = TRL[TRL.length - 1]; if (q && TRL.length < 8 && (T.x - tx) / sc < q.x - s) TRL.length = 0;   /* the backswing leaves no trail */ pushTrail((T.x - tx) / sc, (T.y - ty) / sc, (T.bx - tx) / sc, (T.by - ty) / sc); }
        } }   // werewolf or Vampire Lord while changed
      if (onHorse) wg.restore();
      wg.restore();
      if (GS) GS.drawMarks(wg, "hero", hx0 + (heroP.dx - heroKnock - hdg * 18) * s, heroChest - (onHorse ? 30 * s : 0), s, hpD / hpMax, meDown || !!st.invis);
      if (rec.hero.ench && !meDown && heroP.wt !== "fist" && !heroP.flask) {   // [OURS] an enchanted weapon glows in its colour and sheds motes
        const c = rec.hero.ench; tipOf(1, heroP, heroP.wt, 24);
        let hxH = handX(1, heroP) - (heroKnock + hdg * 18) * s, hyH = handY(1), tx2 = TR[24] - (heroKnock + hdg * 18) * s, ty2 = TR[25], glowOn = true;
        if (heroRig) {   // [herorig] the painted figure holds its weapon somewhere else than the ink one: glow along the real blade (PAINTRIG.tip), or not at all (no stray blob in the air)
          const T = PAINTRIG.tip ? PAINTRIG.tip("me") : null; glowOn = false;
          if (T && T.gx != null) { try { const M = wg.getTransform().inverse(), g0 = M.transformPoint({ x: T.gx, y: T.gy }), t0 = M.transformPoint({ x: T.x, y: T.y }); hxH = g0.x; hyH = g0.y; tx2 = t0.x; ty2 = t0.y; glowOn = true; } catch (e) { glowOn = false; } }
        }
        if (glowOn) {   // [weaponshine] a thin, soft shine along the weapon's own edge in the enchantment's colour, never a blob over it
          const wt = heroP.wt || "sword", GL = COMBATFX.GLOW, col = SHINE.find(([k]) => GL[k] === c)?.[1] || c[0];
          const dx = tx2 - hxH, dy = ty2 - hyH, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
          const pulse = 0.75 + 0.25 * Math.sin(tt * 2.6), at = (q, o) => [hxH + dx * q + nx * o, hyH + dy * q + ny * o];
          wg.save(); wg.lineCap = "round"; wg.lineJoin = "round"; wg.strokeStyle = col; wg.shadowColor = col; wg.shadowBlur = 3 * s * k * z;
          if (/axe|mace|hammer|staff/.test(wt)) {   // a head at the end of a haft: a faint rim around the head, the haft stays plain
            const r = (/battleaxe|warhammer/.test(wt) ? 5 : /staff/.test(wt) ? 2.5 : 3.6) * s, [cx, cy] = at(heroRig ? 0.9 : 0.92, 0);
            wg.globalAlpha = 0.34 * pulse; wg.lineWidth = 0.7 * s; wg.beginPath(); wg.arc(cx, cy, r, 0, Math.PI * 2); wg.stroke();
          } else if (/bow/.test(wt)) {   // a bow: a hairline along the limb
            wg.globalAlpha = 0.3 * pulse; wg.lineWidth = 0.6 * s; wg.beginPath(); wg.moveTo(...at(0.15, 0)); wg.lineTo(...at(1, 0)); wg.stroke();
          } else {   // a blade: both edges from the guard to the point, meeting at the tip
            const q0 = heroRig ? 0.42 : 0.3, half = (/greatsword/.test(wt) ? 1.3 : /dagger/.test(wt) ? 0.7 : 1) * s;
            wg.globalAlpha = 0.36 * pulse; wg.lineWidth = 0.55 * s;
            wg.beginPath(); wg.moveTo(...at(q0, half)); wg.lineTo(...at(0.9, half * 0.55)); wg.lineTo(...at(1, 0)); wg.lineTo(...at(0.9, -half * 0.55)); wg.lineTo(...at(q0, -half)); wg.stroke();
          }
          wg.restore();
          if (Math.random() < 0.16 * pmul) { const q = 0.5 + Math.random() * 0.5, [x, y] = at(q, 0); spawn(c === GL.shock ? 1 : 4, col, x, y, (Math.random() - 0.5) * 12 * s, (c === GL.frost ? 10 : -16) * s, 0.55, 1.1, 0); }
        }
      }
      if (b && b.drain && b.who === "me" && typeof BEASTART !== "undefined") BEASTART.drain(wg, hx0 + 24 * s, heroChest - 8 * s, fx0, foeChest, u, tt);   // a Vampire Lord's drain
      // auras on you: ward, cloak, armor, bound
      if (st.ward || (b && b.who === "me" && b.fx === "ward" && u > 0.4)) hexWard(hx0 + 26 * s, heroChest, b && b.who === "them" && b.absorbed && u > 0.4 ? 1 : 0.5, tt);
      const cloakEl = st.cloak || (b && b.who === "me" && b.fx === "cloak" && u > 0.4 ? b.el || "fire" : null);
      if (cloakEl) orbit(hx0 + heroP.dx * s, heroChest, colOf("cloak", cloakEl), tt);
      if (b && b.who === "me" && b.fx === "armor" && u > 0.4) { wg.save(); wg.globalAlpha = 0.5 * (1 - u); wg.strokeStyle = "#e0c890"; wg.lineWidth = 3; wg.beginPath(); wg.ellipse(hx0, groundY - 32 * s, 20 * s, 36 * s, 0, 0, 7); wg.stroke(); wg.restore(); }
      // the foe (faces left)
      wg.save();
      const fleeing = over && won && turned ? fallE : 0;
      wg.translate(fx0 - (foeP.dx - foeKnock - fdg * 18) * s + fleeing * W * 0.4, groundY + (foeP.dy - fdg * 3) * s); wg.scale(-s * FSC, s * FSC);
      if (fleeing) wg.globalAlpha = 1 - fleeing;
      const dk = foeDown ? deathK : null, dT = phase === "fall" ? phaseT : 9;
      if (dk && goreOn && !GS && (bleed[2] === "blood" || bleed[2] === "oil") && !["ash", "shatter", "fade"].includes(dk)) {   // a pool spreads under the body
        wg.save(); wg.scale(-1 / (s * FSC), 1 / (s * FSC)); wg.globalAlpha = 0.75; wg.fillStyle = bleed[1];
        const pr = Math.min(1, dT / 1.3) * 16 * s * Math.min(1.6, fSize), pxo = (dk === "launch" ? 26 : isPerson ? 30 : 4) * s * fallE;
        wg.beginPath(); wg.ellipse(pxo, 1 * s, pr * 1.4, pr * 0.32, 0, 0, 7); wg.fill(); wg.restore();
      }
      if (dk === "ash") {   // burned to a cinder: it blackens, then crumbles away into a pile of ash
        const p = Math.min(1, dT / 0.5); wg.filter = `brightness(${1 - 0.8 * p}) sepia(${p * 0.6})`; wg.globalAlpha = dT < 0.55 ? 1 : Math.max(0, 1 - (dT - 0.55) / 0.6);
        if (dT > 0.5) { wg.save(); wg.filter = "none"; wg.globalAlpha = Math.min(1, (dT - 0.5) * 2); wg.fillStyle = "#3a3430"; wg.beginPath(); wg.ellipse(0, -2, 14 * fSize, 5 * fSize, 0, Math.PI, 0); wg.fill(); wg.fillStyle = "#ff7a2a"; wg.globalAlpha *= 0.5 + 0.3 * Math.sin(tt * 5); wg.fillRect(-3, -4, 2, 1.5); wg.fillRect(4, -3, 1.5, 1.5); wg.restore(); }
      } else if (dk === "shatter") {   // frozen solid, then it shatters into ice
        const p = Math.min(1, dT / 0.35); wg.filter = `brightness(${1 + 0.35 * p}) saturate(${1 - 0.6 * p}) hue-rotate(${170 * p}deg) contrast(${1 - 0.15 * p})`; if (dT >= 0.45) wg.globalAlpha = 0;
        if (dT >= 0.45) { wg.save(); wg.filter = "none"; wg.globalAlpha = 0.9; wg.fillStyle = "#cfeaff"; for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 6 * fSize; wg.beginPath(); wg.moveTo(x - 3, 0); wg.lineTo(x + 1, -4 - (i % 3) * 2); wg.lineTo(x + 4, 0); wg.fill(); } wg.restore(); }
      } else if (dk === "fry") wg.filter = `brightness(${dT < 0.7 ? 0.5 + Math.random() * 1.2 : 0.45})`;   // lightning: it jerks and flickers, then lies scorched
      if (dk === "launch") { const l = EASE.out(Math.min(1, dT / 0.6)); wg.translate(-26 * l, -Math.sin(l * Math.PI) * 16); }   // hammered (or Shouted) off its feet
      if (foeDown && dk !== "ash" && dk !== "shatter") {
        if (["wisp", "atronach"].includes(foeK)) wg.globalAlpha = 1 - 0.75 * fallE;   // spirits fade away
        else if (RIG && dk !== "decap") { /* the rig plays its own fall (foerig.js) */ }
        else if (isPerson) { wg.translate(-4 * fallE, 0); wg.rotate(-Math.PI / 2 * fallE); wg.translate(0, ((SIZE[foeK] || 1) > 1.2 ? 18 : 6) * fallE); }
        else { const dr = foeK === "dragon"; wg.translate(0, (dr ? -10 : -6) * fallE); wg.scale(1, 1 - (1 - (dr ? 0.45 : -0.9)) * fallE); wg.translate(0, (dr ? 0 : 12) * fallE); }   // beasts roll over, dragons slump
      }
      const drawFoe = () => {
      const lunge = !isPerson ? foeP.draw : ["skeleton", "sphere", "centurion"].includes(foeK) ? Math.max(0, Math.min(1, (foeP.aim + 0.5) / 1.4)) : 0;
      curFoeLook = rec.foeLook; curArchLook = typeof FOEGROUPS !== "undefined" ? FOEGROUPS.look(rec.f?.e) : null;
      curDragon = foeK === "dragon" && typeof DRAGONS !== "undefined" ? DRAGONS.art(rec.f) : null;
      if (curDragon?.air && !foeDown) {   // a flying dragon: its shadow on the ground, the dragon high above, bobbing on its wings
        wg.save(); wg.globalAlpha = 0.25; wg.fillStyle = "#000"; wg.beginPath(); wg.ellipse(0, 0, 46, 7, 0, 0, 7); wg.fill(); wg.restore();
        wg.translate(0, -(22 + Math.sin(tt * 1.7) * 5));
      }
      const lhP = typeof LEGHUNT !== "undefined" && LEGHUNT.paintOf ? LEGHUNT.paintOf(rec.f?.e) : null;   // a legendary beast: its own painted picture, colour-graded and a little bigger (leghunt.js)
      const picK0 = () => (lhP ? lhP.scale : 1);
      const foePic0 = foeK !== "player" && typeof ASSETS !== "undefined" ? ASSETS.img(lhP ? lhP.key : ASSETS.foeKey(rec.foeName, foeK, rec.f?.e?.arch)) : null;
      const foePic = foePic0 && RL ? RL.graded(foePic0) : foePic0;   // [rigcohesion] in the scene's light
      if (foePic && RL && !curDragon?.air) RL.shadow(wg, foeK === "dragon" ? -10 : 2, 0.4, (foeK === "dragon" ? 60 : 20) * Math.min(1.8, fSize) * picK0(), 4.2 * Math.min(1.8, fSize), foeDown ? 0.4 : 0.75);   // its contact shadow
      const picK = picK0();
      if (RIG) {   // [OURS] the rig picks its clip from the beat: an attack locked to the move's timing, the fall, a gloat, a stagger...
        const R = RIGST, them = b && b.who === "them";
        R.t = rm ? 0 : tt; R.clip = null; R.u = 0; R.hitU = null; R.jitter = false; R.still = !!rm;
        R.pose = isPerson || foeK === "player" ? foeP : null; R.dragon = curDragon;
        if (foeDown) { if (dk === "decap") R.clip = "hit", R.u = 0.3; else if (dk === "ash" || dk === "shatter") R.clip = "stagger", R.u = Math.min(0.35, dT); else R.clip = "death", R.u = fallE; }
        else if (meDown) R.clip = "taunt";
        else if (them && b.status) { if (b.status === "stagger") R.clip = "stagger", R.u = u; else if (b.status === "para") R.clip = "para", R.u = 0.3, R.jitter = true; else if (b.status === "fear") R.clip = "cower"; }
        else if (them && m && b.move !== "wait") { R.clip = RIG.clipFor(b.move); R.u = u; R.hitU = m.hits?.[0] ?? null; }
        R.pic = foePic; R.picH = foePic ? (foeK === "dragon" ? 120 : 66) * Math.min(1.8, fSize) * picK : 0; R.filter = curDragon?.filter || (lhP && foePic ? lhP.filter : null);
        RIG.draw(wg, R);
        if (cv.dataset.rig !== RIG.state) cv.dataset.rig = RIG.state;   // which clip is on (screen tests)
      } else if (foePic) {   // a painted foe: stands on the ground line, breathes, leans into its attacks
        const hU = (foeK === "dragon" ? 120 : 66) * Math.min(1.8, fSize) * picK, wU = hU * foePic.naturalWidth / foePic.naturalHeight;
        const breathe = 1 + Math.sin(tt * 2.2) * 0.012;
        wg.save(); wg.translate(lunge * 10, 0); wg.scale(1, breathe);
        if (curDragon?.filter) wg.filter = curDragon.filter;   // a frost dragon, a blood dragon...
        else if (lhP) wg.filter = lhP.filter;   // a legendary beast
        wg.drawImage(foePic, -wU / 2, -hU, wU, hU);
        wg.restore();
      } else foeFig(wg, foeK, lunge, tt, isPerson ? foeP : null);
      };
      if (dk === "decap") {   // the body (below the neck) goes down...
        wg.save(); wg.beginPath(); wg.rect(-300, NECK, 600, 400); wg.clip(); drawFoe(); wg.restore();
        wg.save(); wg.fillStyle = bleed[1]; wg.beginPath(); wg.ellipse(0, NECK + 1, 4 * fSize, 1.6, 0, 0, 7); wg.fill(); wg.restore();
      } else drawFoe();
      wg.filter = "none";
      wg.restore();
      if (GS) GS.drawMarks(wg, "foe", fx0 - (foeP.dx - foeKnock - fdg * 18) * s, foeChest, s * FSC * Math.min(1.6, fSize), ehpD / ehpMax, foeDown || fleeing > 0 || (curDragon?.air && !foeDown));   // streaks, stuck arrows, char
      if (dk === "decap") {   // ...and the head flies, tumbling, and rolls to a stop
        const vy = -95, gr = 300, yMax = -6 - (NECK - 8), tl = (-vy + Math.sqrt(vy * vy + 2 * gr * yMax)) / gr, t = Math.min(dT, tl);
        const hxo = -t * 70 - (dT > tl ? Math.min(dT - tl, 0.4) * 30 : 0), hyo = Math.min(yMax, vy * t + 0.5 * gr * t * t), rot = t * 8 + (dT > tl ? Math.min(dT - tl, 0.4) * 5 : 0);
        wg.save(); wg.translate(fx0, groundY); wg.scale(-s * FSC, s * FSC); wg.translate(hxo, hyo); wg.translate(0, NECK - 8); wg.rotate(rot); wg.translate(0, -(NECK - 8));
        wg.beginPath(); wg.rect(-300, NECK - 300, 600, 300); wg.clip(); drawFoe(); wg.filter = "none"; wg.restore();
      }
      // states on the foe: paralysis crackle, fear swirls, soul trap glow
      if ((b && b.who === "them" && b.status === "para") || (b && b.who === "me" && (b.fx === "paralyze" || b.para) && u > 0.6 && !b.miss)) crackle(fx0, foeChest, "#9aff6a", tt);
      if (b && ((b.who === "them" && b.status === "fear") || (b.who === "me" && b.fx === "illusion" && u > 0.6 && !b.miss && !mOwn))) swirl(fx0, foeChest - 20 * s, "#c89aff", tt);
      if (st.soul && phase === "play") { wg.save(); wg.globalAlpha = 0.25 + 0.1 * Math.sin(tt * 4); wg.drawImage(glowSprite("#b07aff"), fx0 - 30 * s, foeChest - 30 * s, 60 * s, 60 * s); wg.restore(); }
      // at-foe spells: sun beam, walls and storms, illusions
      if (b && b.who === "me" && !b.miss && !mOwn) {
        if (b.fx === "sun" && u > 0.4 && u < 0.8) { const a = Math.sin((u - 0.4) / 0.4 * Math.PI); wg.save(); additive(); wg.globalAlpha = 0.7 * a; const gr = sunGrad(); wg.fillStyle = gr; wg.translate(fx0, 0); wg.fillRect(-18 * s * a, 0, 36 * s * a, groundY); wg.restore(); }
        if (b.fx === "wall" && b.el === "shock" && u > 0.5 && Math.random() < 0.3) { boltOn = 1; boltX0 = fx0 + (Math.random() - 0.5) * 30 * s; boltX1 = boltX0; boltY0 = groundY - 100 * s; boltY1 = groundY; boltC = "#c8b8ff"; jag(); }
        if (b.fx === "turn" && u > 0.4 && u < 0.9) rays(hx0, heroChest, (u - 0.4) / 0.5);
      }
      if (RL) RL.scene(null);   // figures drawn anywhere else (character screens) stay ungraded
      if (art) BSCENE.front(wg, art, artO);   // the near-edge strip goes over the fighters' feet, under the weather and the HUD
      // weather in front of the fighters
      if (wxp) { const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000)); lastNow = now; wxp.step(wg, done ? 0 : dt); }
      // weapon trail
      if (b && m && m.trail && phase === "play") {
        const hitU = m.hits[0];
        trailC = b.who === "me" && rec.hero.ench ? rec.hero.ench[1] : "#f4f6ff";
        if (TRL.length > 1 && u < hitU + 0.22) trail(m.trail, b.miss ? 0.35 : 0.75 * (u < hitU + 0.1 ? 1 : 1 - (u - hitU - 0.1) / 0.12), b.power);
      }
      // a projectile in flight
      if (projX >= 0 && b && m && m.proj && u >= m.proj[0] && u <= m.proj[1]) projectile();
      projX = -1;
      if (boltOn) bolt();
      if (AFX) { AFX.draw(wg); const n = String(AFX.fired()); if (cv.dataset.shots !== n) cv.dataset.shots = n; }   // [arrowfx] arrows and bolts in flight, stuck, broken or in the ground
      // shockwave ring
      if (beamT < 1) { wg.save(); additive(); wg.globalAlpha = (1 - beamT) * 0.85; wg.strokeStyle = beamC; wg.lineWidth = Math.max(2, 5 * (1 - beamT)) * s; wg.beginPath(); wg.moveTo(hx0 + 8 * s, groundY - 44 * s); wg.quadraticCurveTo((hx0 + allyX()) / 2, groundY - 70 * s, allyX(), groundY - 36 * s); wg.stroke(); wg.restore(); }   // [spellbook] support beam, colour by element
      if (ringT < 1) { wg.save(); additive(); wg.globalAlpha = (1 - ringT) * 0.8; wg.strokeStyle = ringC; wg.lineWidth = Math.max(2, 6 * (1 - ringT)) * s; wg.beginPath(); wg.ellipse(ringX, groundY, 70 * s * EASE.out(ringT), 14 * s * EASE.out(ringT), 0, 0, 7); wg.stroke(); wg.restore(); }
      // claw marks
      if (Math.abs(claw) > 0.05) { const cx = claw < 0 ? fx0 : hx0, a = Math.abs(claw); wg.save(); wg.globalAlpha = a; wg.strokeStyle = "#fff6e0"; wg.lineWidth = Math.max(1.6, 2.4 * s); for (let i = -1; i <= 1; i++) { wg.beginPath(); wg.moveTo(cx - 12 * s + i * 7 * s, heroChest - 18 * s); wg.lineTo(cx + 8 * s + i * 7 * s, heroChest + 12 * s); wg.stroke(); } wg.restore(); }
      // particles: dust and chunks first, then the glowing ones added on top
      drawParticles();
      if (MFX) { MFX.drawFront(wg, now); const k = MFX.key() || ""; if (cv.dataset.mfx !== k && k) cv.dataset.mfx = k; }   // [movefx] the spell's own charge, delivery and impact
      if (GS) { if (done && !GS.settled) { GS.settle(); GS.settled = true; } GS.drawFront(wg); }   // [OURS] gore.js: drops, chips, sparks and flourishes in the air
      // screen flash
      if (flash > 0.01 && !rm) { wg.save(); wg.setTransform(1, 0, 0, 1, 0, 0); wg.globalAlpha = flash; wg.fillStyle = flashC; wg.fillRect(0, 0, work.width, work.height); wg.restore(); }
      if (!f.tbHud) bars();   // combat2.js draws the bars over the fighters itself
      // floating numbers and labels (crisp, on the screen canvas)
      g.save(); g.setTransform(k, 0, 0, k, 0, 0); g.textAlign = "center";
      for (let i = 0; i < NF; i++) if (fl[i] > 0) {
        const pop = Math.min(1, (1 - fl[i]) * 8), sz = Math.round(fsz[i] * (1 + (1 - pop) * 0.5));
        g.font = `700 ${sz}px Cinzel, Georgia, serif`; g.globalAlpha = Math.max(0, Math.min(1, fl[i] * 2.5));
        g.fillStyle = "#1c2128"; g.fillText(ftx[i], fxs[i] + 1.5, fys[i] + 1.5); g.fillStyle = fcl[i]; g.fillText(ftx[i], fxs[i], fys[i]);
      }
      g.globalAlpha = 1;
      for (const [nm, tx2, ty2] of mateTags) { const ts = tagSz(), tu = ts / 11; g.font = `600 ${ts.toFixed(2)}px "Barlow Semi Condensed", sans-serif`; const w = g.measureText(nm).width + 10 * tu, tx3 = Math.max(band[0] + w / 2 + 2, Math.min(band[1] - w / 2 - 2, tx2)), ty3 = Math.max(26 * tu, ty2); g.fillStyle = "rgba(14,15,18,0.72)"; g.fillRect(tx3 - w / 2, ty3 - 11 * tu, w, 15 * tu); g.fillStyle = "#c8f0c0"; g.fillText(nm, tx3, ty3 + 0.5); }   // party members' names, crisp in both styles
      if (label && labelT > 0) { const a = Math.min(1, labelT * 3), sz = lbl(20); g.globalAlpha = a; g.font = `700 ${sz}px Cinzel, Georgia, serif`; const y = Hh * 0.25 - (1 - a) * 8; g.fillStyle = "rgba(28,33,40,0.7)"; const pu = sz / 20, w = g.measureText(label).width + 18 * pu; g.fillRect(W / 2 - w / 2, y - sz + 2 * pu, w, sz + 8 * pu); g.fillStyle = labelC; g.fillText(label, W / 2, y); }
      g.restore();
      // end banner
      if (phase === "end" || (phase === "fall" && phaseT > 0.6)) { const a = phase === "end" ? 1 : Math.min(1, (phaseT - 0.6) * 2.5); g.save(); g.setTransform(k, 0, 0, k, 0, 0); g.globalAlpha = a; g.font = `700 ${lbl(18).toFixed(2)}px Cinzel, Georgia, serif`; g.textAlign = "center"; const txt = L(won ? (turned ? "They flee" : "Victory") : "Defeated"), eu = lbl(18) / 18, bw2 = Math.max(120 * eu, g.measureText(txt).width + 24 * eu); const by = Hh * 0.93; g.fillStyle = "rgba(28,33,40,0.6)"; g.fillRect(W / 2 - bw2 / 2, by - 15 * eu, bw2, 21 * eu); g.fillStyle = won ? P.gold : "#ff8a7a"; g.fillText(txt, W / 2, by + 1); g.restore(); }
      if (!done) { PERF[perfN % PERF.length] = performance.now() - t0; perfN++; }
    }
    const additive = () => { wg.globalCompositeOperation = "lighter"; };
    let sunG = null; const sunGrad = () => { if (!sunG) { sunG = wg.createLinearGradient(0, 0, 0, groundY); sunG.addColorStop(0, "rgba(255,242,160,0)"); sunG.addColorStop(0.5, "rgba(255,242,160,0.8)"); sunG.addColorStop(1, "rgba(255,255,255,1)"); } return sunG; };
    function drawParticles() {
      if (!alive) return;
      wg.save();
      for (let pass = 0; pass < 2; pass++) {
        if (pass === 1) additive();
        for (let i = 0; i < NP; i++) {
          if (pl[i] <= 0) continue; const ty = pt[i], glow = ty === 0 || ty === 1 || ty === 4; if (glow !== (pass === 1)) continue;
          const a = pl[i] / pm[i], sz = ps[i] * s;
          wg.globalAlpha = ty === 2 ? a * 0.45 : Math.min(1, a * 1.3);
          if (ty === 1) { wg.strokeStyle = pc[i]; wg.lineCap = "round"; wg.lineWidth = Math.max(1, sz * 0.4); wg.beginPath(); wg.moveTo(px[i], py[i]); wg.lineTo(px[i] - pvx[i] * 0.022, py[i] - pvy[i] * 0.022); wg.stroke(); }   // [blood3] a spark: a thin bright flick, not a stick
          else if (ty === 0 || ty === 4) { const r = sz * 3; wg.drawImage(glowSprite(pc[i]), px[i] - r, py[i] - r, r * 2, r * 2); }
          else if (ty === 2 && /^#[0-9a-f]{6}$/i.test(pc[i]) && softSprite(pc[i])) { const r = sz * 1.5; wg.drawImage(softSprite(pc[i]), px[i] - r, py[i] - r, r * 2, r * 2); }   // [blood3] soft puff, no hard-edged disc
          else { wg.fillStyle = pc[i]; if (ty === 3) wg.fillRect(px[i] - sz / 2, py[i] - sz / 2, sz, sz); else { wg.beginPath(); wg.arc(px[i], py[i], sz, 0, 6.283); wg.fill(); } }
        }
      }
      wg.restore();
    }
    /* [rigcohesion] a faint motion smear hugging the blade: only the blade's last ~75° of travel, a few feathered streaks
       from the tip to part way down the blade, each a soft wide pass and a thin one, clear at the tail and at most about
       0.35 strong at the blade (additive), so it reads as speed, never as a white sector in the sky */
    function trail(kind, a, power) {
      const now = nowS(), life = kind === "stab" ? 0.08 : 0.12;
      while (TRL.length && now - TRL[0].t > life) TRL.shift();
      if (TRL.length < 2) return;
      const bladeA = (q) => Math.atan2(q.y - q.by, q.x - q.bx), maxTurn = kind === "stab" ? 0.6 : 1.3;
      let turned = 0, from = TRL.length - 1;
      for (let i = TRL.length - 1; i > 0; i--) { let d = bladeA(TRL[i]) - bladeA(TRL[i - 1]); d = Math.atan2(Math.sin(d), Math.cos(d)); turned += Math.abs(d); if (turned > maxTurn) break; from = i - 1; }
      const pts = TRL.slice(from), n = pts.length; if (n < 2) return;
      const c = power ? "#ffe6b0" : trailC, rgb = /^#[0-9a-f]{6}$/i.test(c) ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).join(",") : "244,246,255";
      const top = 0.35 * Math.min(1, a / 0.75), reach = kind === "wide" ? 0.5 : kind === "stab" ? 0.2 : 0.4, h = pts[n - 1], t0 = pts[0];
      const at = (q, f) => [q.x + (q.bx - q.x) * f, q.y + (q.by - q.y) * f];
      wg.save(); additive(); wg.lineCap = "round"; wg.lineJoin = "round";
      for (let k = 0; k < 4; k++) {
        const f = (k / 3) * reach, al = top * (1 - k * 0.2), A = at(t0, f), Z = at(h, f);
        for (const [lw, am] of [[4.2, 0.28], [1.3, 1]]) {
          const gr = wg.createLinearGradient(A[0], A[1], Z[0], Z[1]);
          gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(1, `rgba(${rgb},${(al * am).toFixed(3)})`);
          wg.strokeStyle = gr; wg.lineWidth = Math.max(0.8, lw * (1 - k * 0.15) * s);
          wg.beginPath(); for (let i = 0; i < n; i++) { const p = at(pts[i], f); i ? wg.lineTo(p[0], p[1]) : wg.moveTo(p[0], p[1]); } wg.stroke();
        }
      }
      wg.restore();
    }
    function projectile() {
      wg.save();
      if (projType === "arrow" || projType === "bolt") {
        const len = (projType === "bolt" ? 12 : 18) * s, d = -projSide;
        wg.strokeStyle = P.ink; wg.lineWidth = Math.max(1, 2.4 * s * 0.7); wg.beginPath(); wg.moveTo(projX + d * len, projY + (projType === "arrow" ? (projP - 0.5) * 4 * s : 0)); wg.lineTo(projX, projY); wg.stroke();
        wg.fillStyle = P.steel; wg.beginPath(); wg.moveTo(projX - d * 4 * s, projY); wg.lineTo(projX + d * 1, projY - 3 * s); wg.lineTo(projX + d * 1, projY + 3 * s); wg.fill();
        wg.fillStyle = "#e9dcc0"; wg.fillRect(projX + d * len - 2 * s, projY - 2 * s, 3 * s, 4 * s);
      } else if (projType === "spell") {
        const c = colOf(projFx, projEl);
        additive();
        if (projEl === "frost") { wg.fillStyle = "#e8f8ff"; for (let i = 0; i < 3; i++) { const ox = -projSide * i * 9 * s, oy = (i - 1) * 4 * s; wg.beginPath(); wg.moveTo(projX + ox + projSide * 7 * s, projY + oy); wg.lineTo(projX + ox, projY + oy - 2.5 * s); wg.lineTo(projX + ox - projSide * 5 * s, projY + oy); wg.lineTo(projX + ox, projY + oy + 2.5 * s); wg.fill(); } }
        const r = (projEl === "fire" ? 11 : 8) * s; wg.drawImage(glowSprite(c[0]), projX - r * 1.6, projY - r * 1.6, r * 3.2, r * 3.2);
      } else if (projType === "wave") {   // Fus Ro Dah: rings rolling forward
        wg.strokeStyle = "#5f8797"; wg.lineWidth = Math.max(1.5, 3.4 * s);
        for (let i = 0; i < 3; i++) { const q = projP - i * 0.18; if (q < 0) continue; wg.globalAlpha = 0.8 * (1 - q); const x = projX - projSide * i * 22 * s; wg.beginPath(); wg.arc(x - projSide * 20 * s, projY, (14 + q * 26) * s, -0.9, 0.9); if (projSide < 0) { wg.beginPath(); wg.arc(x + 20 * s, projY, (14 + q * 26) * s, Math.PI - 0.9, Math.PI + 0.9); } wg.stroke(); }
      }
      wg.restore();
    }
    function bolt() {
      wg.save(); additive(); wg.lineJoin = "round";
      for (let pass = 0; pass < 2; pass++) {
        wg.strokeStyle = pass ? "#ffffff" : boltC; wg.lineWidth = Math.max(1, (pass ? 1.2 : 4) * s); wg.globalAlpha = pass ? 1 : 0.7;
        wg.beginPath(); wg.moveTo(BOLT[0], BOLT[1]); for (let i = 1; i < 24; i++) wg.lineTo(BOLT[i * 2], BOLT[i * 2 + 1]); wg.stroke();
        wg.beginPath(); wg.moveTo(FORK[0], FORK[1]); for (let i = 1; i < 10; i++) wg.lineTo(FORK[i * 2], FORK[i * 2 + 1]); wg.stroke();   // the chain branching off
      }
      wg.restore();
    }
    function hexWard(x, y, a, tt) {
      wg.save(); additive(); wg.strokeStyle = "#9fd0f0"; wg.lineWidth = Math.max(1, 1.4 * s);
      for (let r = -2; r <= 2; r++) for (let c = 0; c < 2; c++) {
        const hy = y + r * 11 * s, hx = x + c * 9 * s - Math.abs(r) * 3 * s, R6 = 6 * s; wg.globalAlpha = a * (0.45 + 0.35 * Math.sin(tt * 5 + r + c * 2));
        wg.beginPath(); for (let i = 0; i < 6; i++) { const an = i * 1.047; i ? wg.lineTo(hx + Math.cos(an) * R6, hy + Math.sin(an) * R6) : wg.moveTo(hx + R6, hy); } wg.closePath(); wg.stroke();
      }
      wg.restore();
    }
    function orbit(x, y, cols, tt) {
      wg.save(); additive();
      for (let i = 0; i < 8; i++) { const an = tt * 3 + i * 0.785, ox = Math.cos(an) * 22 * s, oy = Math.sin(an) * 34 * s * 0.6 + Math.sin(tt * 2 + i) * 6 * s, r = (Math.sin(an) > 0 ? 5 : 3.5) * s;
        wg.drawImage(glowSprite(cols[i % cols.length]), x + ox - r * 2, y + oy - r * 2, r * 4, r * 4); }
      wg.restore();
    }
    function crackle(x, y, c, tt) {
      wg.save(); additive(); wg.strokeStyle = c; wg.lineWidth = Math.max(1, 1.4 * s); wg.globalAlpha = 0.8;
      for (let i = 0; i < 4; i++) { const an = tt * 7 + i * 1.6, r = 18 * s; let ax = x + Math.cos(an) * r, ay = y + Math.sin(an) * r * 1.4; wg.beginPath(); wg.moveTo(ax, ay); for (let j = 0; j < 3; j++) { ax += (Math.random() - 0.5) * 10 * s; ay += (Math.random() - 0.5) * 10 * s; wg.lineTo(ax, ay); } wg.stroke(); }
      wg.restore();
    }
    function swirl(x, y, c, tt) {
      wg.save(); additive(); wg.strokeStyle = c; wg.lineWidth = Math.max(1, 1.6 * s); wg.globalAlpha = 0.75;
      for (let i = 0; i < 2; i++) { wg.beginPath(); for (let j = 0; j < 14; j++) { const an = tt * 4 + i * Math.PI + j * 0.45, r = j * 1.2 * s; const X = x + Math.cos(an) * r, Y = y + Math.sin(an) * r * 0.5; j ? wg.lineTo(X, Y) : wg.moveTo(X, Y); } wg.stroke(); }
      wg.restore();
    }
    function rune(x, y, c, tt) {
      wg.save(); additive(); wg.strokeStyle = c; wg.lineWidth = Math.max(1, 1.6 * s); wg.globalAlpha = 0.55 + 0.25 * Math.sin(tt * 4);
      wg.beginPath(); wg.ellipse(x, y - 1, 22 * s, 5 * s, 0, 0, 7); wg.stroke();
      wg.beginPath(); for (let i = 0; i < 5; i++) { const an = i * 2.513 - 1.57; const X = x + Math.cos(an) * 18 * s, Y = y - 1 + Math.sin(an) * 4 * s; i ? wg.lineTo(X, Y) : wg.moveTo(X, Y); } wg.closePath(); wg.stroke();
      wg.restore();
    }
    function portal(x, y, a, tt) {
      if (a <= 0) return;
      wg.save(); additive(); wg.globalAlpha = a;
      wg.globalAlpha = a * 0.6; for (let i = 0; i < 3; i++) { wg.strokeStyle = COL.summon[i % 2]; wg.lineWidth = Math.max(1, (1.6 - i * 0.4) * s); wg.beginPath(); wg.ellipse(x, y - 30 * s, (14 - i * 3) * s, (30 - i * 6) * s, Math.sin(tt * 2 + i) * 0.1, 0, 7); wg.stroke(); }
      wg.globalAlpha = a * 0.12; wg.drawImage(glowSprite("#a07aff"), x - 16 * s, y - 46 * s, 32 * s, 32 * s);   // [summonfx] only a hint of light in the tear
      wg.restore();
    }
    function rays(x, y, p) {
      wg.save(); additive(); wg.strokeStyle = "#fff2a0"; wg.globalAlpha = 0.7 * (1 - p); wg.lineWidth = Math.max(1, 2 * s);
      for (let i = 0; i < 10; i++) { const an = i * 0.628, r0 = (10 + p * 30) * s, r1 = (24 + p * 70) * s; wg.beginPath(); wg.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0); wg.lineTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1); wg.stroke(); }
      wg.restore();
    }
    function bars() {
      g.save(); g.setTransform(k, 0, 0, k, 0, 0);
      const bw = W * 0.38, bh = 7, y = 10;
      const bar = (x, v, lag, max, col, name, right) => {
        g.fillStyle = "rgba(28,33,40,0.75)"; g.fillRect(x - 1, y - 1, bw + 2, bh + 2);
        const fr = (q) => Math.max(0, Math.min(1, q / max)) * bw;
        const wl = fr(lag), ww = fr(v);
        g.fillStyle = "#f4efe0"; g.fillRect(right ? x + bw - wl : x, y, wl, bh);   // what you just lost, draining a moment later
        g.fillStyle = col; g.fillRect(right ? x + bw - ww : x, y, ww, bh);
        g.strokeStyle = P.gold; g.lineWidth = 1; g.strokeRect(
x - 0.5, y - 0.5, bw + 1, bh + 1);
        g.font = "600 12px Cinzel, Georgia, serif"; g.textAlign = right ? "right" : "left"; g.textBaseline = "top";
        g.fillStyle = "#1c2128"; g.fillText(name, (right ? x + bw : x) + 1, y + bh + 4); g.fillStyle = "#fbf3dc"; g.fillText(name, right ? x + bw : x, y + bh + 3);
      };
      bar(8, hpD, Math.max(hpL, hpD), hpMax, "#c0392b", L("You"), false);
      bar(W - 8 - bw, ehpD, Math.max(ehpL, ehpD), ehpMax, "#8e6b2b", ((n) => (n.length > 22 ? n.slice(0, 21) + "…" : n))(L(rec.foeName)), true);
      // status icons with turns left, under each name:  burning ·  chilled ·  jolted
      const cs = curSt(), ICO = { burn: ["", "#ff9a3c"], chill: ["", "#bfe6ff"], shock: ["", "#ffe37a"] };
      const chips = (st, x, right) => {
        let off = 0;
        for (const k of ["burn", "chill", "shock"]) if (st[k]) {
          const txt = `${ICO[k][0]}${st[k]}`, w = 26, cx = right ? x - off - w : x + off;
          g.fillStyle = "rgba(20,22,26,0.78)"; g.fillRect(cx, y + bh + 20, w, 15);
          g.strokeStyle = ICO[k][1]; g.lineWidth = 1; g.strokeRect(cx + 0.5, y + bh + 20.5, w - 1, 14);
          g.font = "600 10px GameIcons, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = ICO[k][1];
          g.fillText(txt, cx + w / 2, y + bh + 28);
          off += w + 3;
        }
      };
      chips(cs.me, 8, false); chips(cs.foe, W - 8, true);
      g.restore();
    }
    const runner = {
      step(ms) { for (let left = ms; left > 0; left -= 16) update(Math.min(16, left) / 1000); draw(performance.now()); },
      finish() { if (!done) finish(); },   // [OURS] tap anywhere on the fight screen (fastqol.js)
      get done() { return done; }, get beat() { return bi; }, get cam() { return [zoom, camF, deathK]; }, beats, el,
    };
    const minGap = FS ? FS.frameMs() : 0;   // the frame-rate cap (Settings → Fights → Frame rate)
    function frame(now) {
      if (!cv.isConnected) { cancelAnimationFrame(raf); LIVE.delete(runner); return; }
      if (minGap && now - lastNow < minGap) { raf = requestAnimationFrame(frame); return; }
      if (!MANUAL) { const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000)); update(dt); draw(now); }
      lastNow = now;
      if (!done) raf = requestAnimationFrame(frame); else { LIVE.delete(runner); idleArt(); }
    }
    /* [OURS] a finished scene with a painted backdrop keeps its torches flickering and banners moving (12 frames a second,
       only the newest two scenes, only while on screen); with reduced motion it just redraws once the pictures arrive */
    let idleT = 0, idleDrawn = false;
    function idleArt() {
      const bs = !!rec.art && typeof BSCENE !== "undefined", rigLive = !!RIG && !rm && (phase === "idle" || !won);   // [OURS] a standing foe keeps breathing (or gloating) between turns
      if (idleT || (!bs && !rigLive)) return;
      const tick = () => {
        idleT = 0;
        if (!cv.isConnected || !IDLE.has(tick)) { IDLE.delete(tick); return; }
        const ok = bs ? !!BSCENE.ready(rec.art) : true;
        if (!MANUAL && !(typeof document !== "undefined" && document.hidden) && ok && (!rm || !idleDrawn)) { draw(performance.now()); idleDrawn = true; }
        if ((!bs || (ok && (rm || !BSCENE.animated(rec.art))) || (!ok && BSCENE.failed(rec.art))) && !rigLive) { IDLE.delete(tick); return; }
        idleT = setTimeout(tick, ok ? (rigLive ? 50 : 83) : 300);
      };
      IDLE.add(tick); while (IDLE.size > 2) IDLE.delete(IDLE.values().next().value);
      idleT = setTimeout(tick, 83);
    }
    cv.addEventListener("click", (e) => { e.stopPropagation(); if (!done) finish(); });
    if (rec.played || autoSkip() || !beats.length) { finish(); return; }
    LIVE.add(runner);
    draw(performance.now());
    raf = requestAnimationFrame(frame);
  }
  // mount any fight scene the moment it lands on the page (modals, panels, dungeon screens)
  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
    const scan = (n) => { if (n.nodeType !== 1) return; if (n.matches?.(".fscene")) mount(n); n.querySelectorAll?.(".fscene").forEach(mount); };
    new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach(scan); }).observe(document.documentElement, { childList: true, subtree: true });
  }
  // for tests: step every playing scene by hand, and read frame times
  const manual = (on) => { MANUAL = !!on; };
  const advance = (ms) => { for (const r of LIVE) { if (!r.el.isConnected) { LIVE.delete(r); continue; } r.step(ms); } return [...LIVE].map((r) => ({ beat: r.beat, beats: r.beats.length, done: r.done, cam: r.cam })); };
  const perf = () => { const n = Math.min(perfN, PERF.length), a = Array.from(PERF.subarray(0, n)).sort((x, y) => x - y); return { frames: perfN, p50: a[Math.floor(n * 0.5)] || 0, p90: a[Math.floor(n * 0.9)] || 0, max: a[n - 1] || 0 }; };
  const resetPerf = () => { perfN = 0; };
  /* [OURS] finish every scene still playing (tap-anywhere on a fight screen, fastqol.js) -> how many were playing */
  const finishAll = () => { let n = 0; for (const r of [...LIVE]) { if (!r.el.isConnected) { LIVE.delete(r); continue; } if (!r.done) { n++; r.finish(); } } return n; };
  const playing = () => [...LIVE].some((r) => r.el.isConnected && !r.done);
  return { placeholder, register, foeOf, sceneOf, beatsOf, allyKind, allyFig, summonKind, ALLY_KINDS, heroOf, mount, animFor, spellFx, MOVES, WEAPONS, FOE_MOVE, KIND_FX, SHOUT_FX, manual, advance, perf, resetPerf, finishAll, playing };
})();
