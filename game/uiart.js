/* Pictures for everything that isn't an item, a place or a fight: spells, skills, powers and shouts, standing stones,
   questlines, achievements, followers, horses, Arena ranks, clan banners, festivals, holds, guide steps, the title
   panorama, the death and level-up screens. Same shared ART toolkit (ink on parchment, or pixel art); every icon
   is drawn in a 40×40 box and cached per style. [OURS]
     UIART.spell(id, size) · UIART.skill(name, size) · UIART.power(kind, id, size) · UIART.stone(id, size)
     UIART.shout(id, size) · UIART.quest(lineId, size) · UIART.ach(id, size) · UIART.follower(id, size)
     UIART.horse(coat, size) · UIART.rank(rating, size) · UIART.banner(colors, size) · UIART.hold(color, size)
     UIART.guide(stepId, size) · UIART.attr(name, size) · UIART.action(actionId, size) · UIART.fest(id, w, h)
     UIART.panorama(w, h) · UIART.death(w, h) */
const UIART = (() => {
  const INK = "#2a1f15", P = ART.PAL;
  const SCHOOL = { Destruction: ["#c4572e", "#f0a060"], Restoration: ["#c9a24c", "#f4dc96"], Alteration: ["#6a5fae", "#b8b0f0"], Conjuration: ["#7a4f9a", "#c9a0e8"],
    Illusion: ["#2f8a8a", "#90dcd8"], Mysticism: ["#4a2f7a", "#a98cff"] };
  const ELEM = { fire: ["#e8923a", "#c4572e", "#ffe08a"], frost: ["#9fd0f0", "#4f8fb8", "#ffffff"], shock: ["#c9b6ff", "#6a5fd0", "#ffffff"], sun: ["#f4dc96", "#d6b25e", "#fffbe8"] };
  const GROUP = { Warrior: ["#8e2b25", "#d98a6a"], Mage: ["#2f5f9a", "#9fc0f0"], Thief: ["#2f6b3a", "#9fd09a"], Movement: ["#2f7a7a", "#9fdcd0"], Social: ["#9a7a2c", "#f0d890"], Crafting: ["#6b4a2a", "#d0a878"] };

  // ---- primitives (40×40 space)
  const poly = (g, pts, fill, stroke = INK, w = 1.2) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.lineJoin = "round"; g.stroke(); } };
  const circ = (g, x, y, r, fill, stroke = INK, w = 1.2) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); } };
  const ell = (g, x, y, rx, ry, fill, stroke = INK, w = 1.2, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); } };
  const line = (g, pts, color = INK, w = 1.3) => { g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
  const rect = (g, x, y, w, h, fill, stroke = INK, lw = 1.2) => { g.fillStyle = fill; g.fillRect(x, y, w, h); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.strokeRect(x, y, w, h); } };
  const glow = (g, x, y, r, color, a = 0.7) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)"); g.globalAlpha = a; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; };
  const star = (g, x, y, r, n = 5, fill = "#f4dc96", stroke = INK, inner = 0.45) => { const pts = []; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r * inner : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } poly(g, pts, fill, stroke, 1); };
  const txt = (g, s, x, y, size, color = INK, font = "Georgia, serif") => { g.fillStyle = color; g.font = `700 ${size}px ${font}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s, x, y); };

  // a round medallion: dark disc, coloured ring
  function medal(g, ring, inner = "#241d16", light = null) {
    circ(g, 20, 20, 18.6, light || "#efe4cc", INK, 1.2);
    circ(g, 20, 20, 16.4, inner, ring, 2.4);
  }
  // a parchment tile (square with rounded corners)
  function tile(g, dark = false) {
    const r = 6; g.beginPath(); g.moveTo(r, 1); g.arcTo(39, 1, 39, 39, r); g.arcTo(39, 39, 1, 39, r); g.arcTo(1, 39, 1, 1, r); g.arcTo(1, 1, 39, 1, r); g.closePath();
    const gr = g.createRadialGradient(20, 17, 4, 20, 20, 26);
    if (dark) { gr.addColorStop(0, "#4a3f33"); gr.addColorStop(1, "#231c15"); } else { gr.addColorStop(0, "#f1e6cc"); gr.addColorStop(1, "#cdb98f"); }
    g.fillStyle = gr; g.fill(); g.strokeStyle = dark ? "#6b5640" : "#9c8662"; g.lineWidth = 1; g.stroke();
  }
  function shield(g, fill, stroke = INK) { poly(g, [[9, 6], [31, 6], [31, 20], [20, 35], [9, 20]], fill, stroke, 1.4); }

  // ---- glyphs, all centred around (20, 20) inside a radius of ~13
  const G_ = {
    flame(g, c = ELEM.fire, x = 20, y = 21, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); poly(g, [[0, -12], [6, -3], [8, 4], [4, 10], [-4, 10], [-8, 4], [-6, -4], [-2, -1]], c[1], INK, 1.1); poly(g, [[0, -5], [4, 2], [3, 8], [-3, 8], [-4, 2]], c[0], null); poly(g, [[0, 1], [2, 5], [0, 8], [-2, 5]], c[2], null); g.restore(); },
    flake(g, c = ELEM.frost, x = 20, y = 20, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); for (let i = 0; i < 6; i++) { g.save(); g.rotate((i * Math.PI) / 3); line(g, [[0, 0], [0, -11]], c[0], 2.2); line(g, [[0, -6], [-3, -9]], c[0], 1.5); line(g, [[0, -6], [3, -9]], c[0], 1.5); g.restore(); } circ(g, 0, 0, 2.2, c[2], null); g.restore(); },
    bolt(g, c = ELEM.shock, x = 20, y = 20, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); poly(g, [[2, -13], [-6, 1], [0, 1], [-3, 13], [7, -3], [1, -3], [5, -13]], c[0], INK, 1.1); line(g, [[1, -9], [-3, 0]], c[2], 1); g.restore(); },
    sun(g, c = ELEM.sun, x = 20, y = 20, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); for (let i = 0; i < 12; i++) { g.save(); g.rotate((i * Math.PI) / 6); poly(g, [[-1.6, -7], [0, -13], [1.6, -7]], c[1], null); g.restore(); } circ(g, 0, 0, 6.5, c[0], INK, 1); circ(g, 0, 0, 3, c[2], null); g.restore(); },
    hand(g, glowC = "#f4dc96") { glow(g, 20, 17, 13, glowC, 0.8); poly(g, [[13, 33], [13, 20], [14, 12], [16, 12], [16.5, 19], [17, 9], [19, 9], [19.5, 19], [20.5, 8], [22.5, 8], [23, 19], [24, 10], [26, 10], [26, 21], [29, 17], [31, 18], [27, 27], [25, 33]], "#e9c6a1", INK, 1); },
    ward(g, c = "#9fd0f0") { glow(g, 20, 20, 16, c, 0.5); g.strokeStyle = c; g.lineWidth = 2.4; g.beginPath(); g.arc(20, 22, 12, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.lineWidth = 1.4; g.beginPath(); g.arc(20, 22, 8, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); poly(g, [[16, 26], [20, 18], [24, 26]], "#efe4cc", INK, 1); },
    skull(g, c = "#efe4cc", eyes = "#241d16") { ell(g, 20, 17, 8, 7.5, c); rect(g, 15, 21, 10, 6, c, INK, 1); circ(g, 17, 17, 2.2, eyes, null); circ(g, 23, 17, 2.2, eyes, null); for (const x of [17, 20, 23]) line(g, [[x, 23], [x, 27]], INK, 0.9); },
    skin(g, fill, light, cracks) { poly(g, [[10, 8], [30, 8], [30, 22], [20, 33], [10, 22]], fill, INK, 1.3); poly(g, [[13, 11], [27, 11], [27, 21], [20, 29], [13, 21]], null, light, 1.1); if (cracks) for (const p of cracks) line(g, p, INK, 0.8); },
    chain(g) { for (let i = 0; i < 4; i++) ell(g, 11 + i * 6, 14 + i * 4, 4, 2.6, null, "#b8bec2", 2.2, 0.6); line(g, [[8, 30], [32, 30]], "#c9b6ff", 1); },
    candle(g) { glow(g, 20, 13, 13, "#ffe08a", 0.9); rect(g, 16, 18, 8, 15, "#efe4cc", INK, 1); poly(g, [[20, 7], [23, 13], [20, 17], [17, 13]], "#ffd060", INK, 0.9); },
    eye(g, iris = "#4f9a9a") { ell(g, 20, 20, 13, 7.5, "#efe4cc", INK, 1.2); circ(g, 20, 20, 5, iris, INK, 1); circ(g, 20, 20, 2.2, "#14100c", null); circ(g, 18.5, 18.5, 1, "#fff", null); },
    blade(g, c = "#8fd0ff") { glow(g, 20, 20, 15, c, 0.7); g.save(); g.translate(20, 20); g.rotate(Math.PI / 4); poly(g, [[-2.4, 6], [-2.4, -12], [0, -15], [2.4, -12], [2.4, 6]], c, INK, 1); rect(g, -6, 6, 12, 2.4, "#4f8fb8", INK, 0.8); rect(g, -1.4, 8.4, 2.8, 6, "#4f8fb8", INK, 0.8); g.restore(); },
    axe(g, c = "#8fd0ff") { glow(g, 20, 20, 15, c, 0.7); g.save(); g.translate(20, 20); g.rotate(Math.PI / 4); rect(g, -1.4, -13, 2.8, 26, "#4f8fb8", INK, 0.8); poly(g, [[1, -12], [10, -15], [12, -6], [10, 3], [1, 0]], c, INK, 1); poly(g, [[-1, -12], [-10, -15], [-12, -6], [-10, 3], [-1, 0]], c, INK, 1); g.restore(); },
    bow(g, c = "#8fd0ff") { glow(g, 20, 20, 15, c, 0.7); g.strokeStyle = INK; g.lineWidth = 3.6; g.beginPath(); g.arc(8, 20, 15, -1.0, 1.0); g.stroke(); g.strokeStyle = c; g.lineWidth = 2.2; g.stroke(); line(g, [[16.1, 7.4], [16.1, 32.6]], "#efe4cc", 0.9); line(g, [[12, 20], [33, 20]], c, 1.6); poly(g, [[33, 20], [29, 17.6], [29, 22.4]], c, INK, 0.8); },
    gem(g, c = "#a98cff") { glow(g, 20, 20, 14, c, 0.7); poly(g, [[20, 7], [29, 15], [20, 33], [11, 15]], c, INK, 1.2); poly(g, [[14, 15], [20, 9], [26, 15], [20, 15]], "rgba(255,255,255,.55)", null); line(g, [[11, 15], [29, 15]], INK, 0.8); },
    zombie(g, c = "#7fae6a") { glow(g, 20, 22, 14, "#7fae6a", 0.5); ell(g, 20, 17, 8, 7.5, c); rect(g, 15, 21, 10, 6, c, INK, 1); circ(g, 17, 17, 2, "#c4f0a0", null); circ(g, 23, 17, 2, "#c4f0a0", null); line(g, [[16, 25], [24, 25]], INK, 1); line(g, [[9, 33], [14, 28], [12, 24]], c, 2.4); line(g, [[31, 33], [26, 28], [28, 24]], c, 2.4); },
    atronach(g, el) { const c = ELEM[el] || ELEM.fire; glow(g, 20, 20, 15, c[0], 0.6);
      if (el === "fire") { G_.flame(g, c, 20, 23, 0.9); circ(g, 20, 10, 4.5, c[0], INK, 1); circ(g, 18.5, 9.5, 0.9, "#fff", null); circ(g, 21.5, 9.5, 0.9, "#fff", null); }
      else if (el === "frost") { poly(g, [[20, 5], [26, 14], [24, 30], [20, 35], [16, 30], [14, 14]], c[0], INK, 1.1); poly(g, [[20, 9], [23, 15], [20, 28], [17, 15]], c[2], null); line(g, [[14, 18], [7, 13]], c[1], 2.6); line(g, [[26, 18], [33, 13]], c[1], 2.6); }
      else { for (const [x, y, r] of [[20, 11, 4.5], [20, 21, 5.5], [13, 18, 3], [27, 18, 3], [16, 31, 3], [24, 31, 3]]) circ(g, x, y, r, "#8f7a66", INK, 1); G_.bolt(g, c, 20, 21, 0.45); } },
    wolf(g, c = "#9fc0f0") { glow(g, 20, 22, 14, c, 0.6); poly(g, [[8, 10], [13, 13], [20, 11], [27, 13], [32, 10], [30, 20], [25, 28], [20, 32], [15, 28], [10, 20]], c, INK, 1.1); circ(g, 15.5, 19, 1.4, "#14100c", null); circ(g, 24.5, 19, 1.4, "#14100c", null); poly(g, [[18, 26], [22, 26], [20, 29]], "#14100c", null); },
    dremora(g) { glow(g, 20, 20, 15, "#c4572e", 0.5); poly(g, [[12, 14], [8, 4], [15, 10]], "#3a2a2a", INK, 1); poly(g, [[28, 14], [32, 4], [25, 10]], "#3a2a2a", INK, 1); ell(g, 20, 21, 8.5, 10, "#7a3a3a", INK, 1.1); line(g, [[14, 16], [18, 20]], "#f4dc96", 1); line(g, [[26, 16], [22, 20]], "#f4dc96", 1); circ(g, 17, 19, 1.4, "#ffb060", null); circ(g, 23, 19, 1.4, "#ffb060", null); line(g, [[16, 27], [24, 27]], INK, 1.2); },
    heart(g, c = "#d86a8a") { poly(g, [[20, 33], [8, 20], [8, 13], [13, 8], [20, 13], [27, 8], [32, 13], [32, 20]], c, INK, 1.2); line(g, [[12, 14], [14, 11]], "rgba(255,255,255,.7)", 1.4); },
    ghost(g, c = "#c8e0e8") { poly(g, [[11, 33], [11, 16], [15, 9], [25, 9], [29, 16], [29, 33], [25, 29], [22, 33], [18, 29], [14, 33]], c, INK, 1.1); ell(g, 16.5, 18, 2, 3, "#241d16", null); ell(g, 23.5, 18, 2, 3, "#241d16", null); ell(g, 20, 26, 2.6, 3.4, "#241d16", null); },
    fist(g, c = "#e07a5a") { glow(g, 20, 20, 15, "#c4572e", 0.5); rect(g, 12, 12, 16, 14, c, INK, 1.2); for (const x of [16, 20, 24]) line(g, [[x, 12], [x, 18]], INK, 0.9); rect(g, 14, 26, 12, 7, c, INK, 1); poly(g, [[12, 18], [8, 22], [12, 26]], c, INK, 1); },
    banner(g, c = "#d6b25e") { line(g, [[12, 6], [12, 34]], "#7a5232", 2.4); poly(g, [[13, 7], [31, 9], [27, 15], [31, 21], [13, 21]], c, INK, 1.1); star(g, 20, 14, 4, 5, "#fff6d8", INK); },
    dashed(g) { g.setLineDash([2.4, 2.4]); circ(g, 20, 12, 4.5, null, "#90dcd8", 1.6); poly(g, [[13, 33], [14, 19], [26, 19], [27, 33]], null, "#90dcd8", 1.6); g.setLineDash([]); },
    foot(g) { ell(g, 20, 24, 6, 9, "#a87450", INK, 1.1); for (const [x, y] of [[14, 13], [18, 11], [22, 11], [26, 13]]) circ(g, x, y, 2.2, "#a87450", INK, 0.9); line(g, [[8, 32], [32, 8]], "#90dcd8", 2); },
    dispel(g) { g.strokeStyle = "#a98cff"; g.lineWidth = 2.4; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(20, 20, 11, i * 1.57 + 0.25, i * 1.57 + 1.3); g.stroke(); } for (let i = 0; i < 4; i++) { const a = i * 1.57 + 1.43; star(g, 20 + Math.cos(a) * 11, 20 + Math.sin(a) * 11, 2.4, 4, "#fff", null); } },
    mark(g) { glow(g, 20, 30, 12, "#a98cff", 0.6); ell(g, 20, 31, 10, 3, null, "#a98cff", 1.6); poly(g, [[20, 31], [13, 18], [13, 12], [16, 7], [24, 7], [27, 12], [27, 18]], "#7a4f9a", INK, 1.1); circ(g, 20, 13, 3.2, "#efe4cc", INK, 0.9); },
    recall(g) { glow(g, 20, 20, 15, "#a98cff", 0.6); g.strokeStyle = "#c9a0e8"; g.lineWidth = 3; g.beginPath(); g.arc(20, 20, 11, 0.4, Math.PI * 1.75); g.stroke(); poly(g, [[31, 14], [31.5, 23], [24, 19]], "#c9a0e8", INK, 0.9); circ(g, 20, 20, 3, "#fff", null); },
    absorb(g) { g.strokeStyle = "#a98cff"; g.lineWidth = 1.8; g.beginPath(); for (let a = 0; a < 12; a += 0.2) { const r = 14 - a; g.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r); } g.stroke(); circ(g, 20, 20, 3, "#ffffff", INK, 0.8); },
    transmute(g) { poly(g, [[6, 26], [10, 18], [16, 17], [18, 25], [13, 30]], "#9a9590", INK, 1); poly(g, [[22, 22], [26, 14], [33, 13], [35, 21], [29, 27]], "#e8c44a", INK, 1); line(g, [[12, 12], [20, 8], [27, 9]], "#b8b0f0", 1.6); poly(g, [[28, 9], [24, 6.5], [25, 11]], "#b8b0f0", null); },
    lifesense(g) { G_.eye(g, "#c43a3a"); for (const [x, y] of [[8, 9], [32, 10], [30, 31], [9, 30]]) circ(g, x, y, 1.8, "#e06060", null); },
    paws(g) { for (const [x, y] of [[13, 14], [24, 22]]) { ell(g, x, y + 4, 4, 3.4, "#7a5232", INK, 0.9); for (const [dx, dy] of [[-4, -1], [-1.5, -3.5], [1.5, -3.5], [4, -1]]) circ(g, x + dx, y + dy, 1.4, "#7a5232", null); } },
  };
  const LEVELS = ["Novice", "Apprentice", "Adept", "Expert", "Master"];
  function pips(g, level, color) { const n = LEVELS.indexOf(level) + 1; for (let i = 0; i < n; i++) { const x = 20 + (i - (n - 1) / 2) * 5; poly(g, [[x, 33.4], [x + 1.8, 35.4], [x, 37.4], [x - 1.8, 35.4]], color, INK, 0.6); } }

  // what to draw for each spell (by id first, then by kind and element)
  function spellGlyph(id, sp) {
    const el = sp.element, E = ELEM[el];
    const byId = {
      candlelight: G_.candle, transmute: G_.transmute, detect_life: G_.lifesense, clairvoyance: (g) => G_.eye(g, "#4fb0b0"), muffle: G_.foot, dispel: G_.dispel, mark: G_.mark, recall: G_.recall, spell_absorb: G_.absorb,
      soul_trap: (g) => G_.gem(g, "#a98cff"), courage: (g) => G_.banner(g), invisibility: G_.dashed, fury: G_.fist, dremora_lord: G_.dremora, conjure_familiar: (g) => G_.wolf(g),
      bound_sword: (g) => G_.blade(g), bound_battleaxe: (g) => G_.axe(g), bound_bow: (g) => G_.bow(g), flame_atronach: (g) => G_.atronach(g, "fire"), frost_atronach: (g) => G_.atronach(g, "frost"), storm_atronach: (g) => G_.atronach(g, "shock"),
      oakflesh: (g) => G_.skin(g, "#8a5a34", "#c49c70", [[[15, 13], [16, 26]], [[22, 12], [23, 27]]]), stoneflesh: (g) => G_.skin(g, "#8f8a80", "#c8c2b6", [[[14, 15], [19, 18], [17, 24]]]),
      ironflesh: (g) => G_.skin(g, "#7d8388", "#c8ccce"), ebonyflesh: (g) => G_.skin(g, "#3a3440", "#7d7488"), dragonhide: (g) => G_.skin(g, "#6a7a4a", "#b0c080", [[[13, 13], [17, 16], [21, 13], [25, 16], [27, 13]], [[13, 19], [17, 22], [21, 19], [25, 22], [27, 19]]]),
    };
    if (byId[id]) return byId[id];
    const k = sp.kind;
    const one = el === "frost" ? G_.flake : el === "shock" ? G_.bolt : el === "sun" ? G_.sun : G_.flame;
    if (k === "damage" && E) {
      if (sp.level === "Master") return (g) => { ell(g, 20, 11, 12, 5, "#5a5560", INK, 1); ell(g, 13, 13, 5, 4, "#5a5560", INK, 1); one(g, E, 13, 25, 0.5); one(g, E, 21, 28, 0.55); one(g, E, 28, 24, 0.5); };
      if (/ball|storm|chain|spear|incinerate|thunderbolt/.test(id)) return (g) => { glow(g, 20, 20, 16, E[0], 0.7); one(g, E, 20, 20, 1.05); if (/chain/.test(id)) { G_.bolt(g, E, 11, 26, 0.45); G_.bolt(g, E, 29, 14, 0.45); } };
      return (g) => one(g, E);
    }
    if (k === "rune" && E) return (g) => { ell(g, 20, 28, 13, 5, null, E[0], 2); ell(g, 20, 28, 8.5, 3.2, null, E[1], 1.2); for (let i = 0; i < 6; i++) { const a = i * 1.047; line(g, [[20 + Math.cos(a) * 9, 28 + Math.sin(a) * 3.4], [20 + Math.cos(a) * 12.5, 28 + Math.sin(a) * 4.6]], E[2], 1); } one(g, E, 20, 16, 0.6); };
    if (k === "cloak" && E) return (g) => { glow(g, 20, 21, 16, E[0], 0.85); circ(g, 20, 11, 4, "#e9c6a1", INK, 1); poly(g, [[13, 33], [14, 17], [26, 17], [27, 33]], "#5a4a7a", INK, 1); for (const [x, y] of [[9, 26], [31, 24], [10, 14], [30, 12]]) one(g, E, x, y, 0.32); };
    if (k === "dot" && E) return (g) => { rect(g, 6, 30, 28, 3, "#6b5640", null); for (const x of [10, 20, 30]) one(g, E, x, 22, 0.55); if (sp.level === "Master") { ell(g, 20, 8, 12, 4, "#5a5560", INK, 1); } };
    if (k === "heal" || k === "regen") return (g) => { G_.hand(g); if (k === "regen") { g.strokeStyle = "#f4dc96"; g.lineWidth = 1.6; g.beginPath(); g.arc(20, 20, 15.5, 0, 6.28); g.stroke(); } if (/grand|close/.test(id)) star(g, 30, 10, 3.6); };
    if (k === "ward") return (g) => G_.ward(g, sp.amount >= 80 ? "#f4dc96" : sp.amount >= 60 ? "#c9e0ff" : "#9fd0f0");
    if (k === "turn") return (g) => { G_.sun(g, ELEM.sun, 20, 15, 0.6); G_.skull(g); };
    if (k === "armor") return (g) => G_.skin(g, "#8a5a34", "#c49c70");
    if (k === "paralyze") return G_.chain;
    if (k === "reanimate") return (g) => G_.zombie(g, sp.level === "Master" ? "#5f8f5a" : "#7fae6a");
    if (k === "summon") return (g) => G_.wolf(g);
    if (k === "calm") return (g) => G_.heart(g, id === "harmony" ? "#f4a0c0" : "#d86a8a");
    if (k === "fear") return (g) => G_.ghost(g, id === "hysteria" ? "#e8b0b0" : "#c8e0e8");
    if (k === "courage") return (g) => G_.banner(g);
    if (k === "invisibility") return G_.dashed;
    if (k === "bound") return (g) => G_.blade(g);
    if (k === "soultrap") return (g) => G_.gem(g);
    return (g) => star(g, 20, 20, 10, 6, SCHOOL[sp.school]?.[1] || "#f4dc96");
  }
  function drawSpell(id) {
    const sp = D.SPELLS[id] || {}, sc = SCHOOL[sp.school] || ["#7a6a5a", "#cdb98f"];
    if (sp.parts) {   // a crafted spell: a medallion split between its effects, each half in its own school's colour
      const ps = sp.parts.map((p) => [p, D.SPELLS[p] || {}]);
      return (g) => {
        medal(g, sc[0]);
        ps.forEach(([pid, p], i) => {
          const c = SCHOOL[p.school] || sc, n = ps.length;
          g.save(); g.beginPath(); if (n === 1) g.arc(20, 20, 15, 0, 7); else if (i === 0) { g.moveTo(20, 20); g.arc(20, 20, 15, Math.PI * 0.75, Math.PI * 1.75); } else { g.moveTo(20, 20); g.arc(20, 20, 15, -Math.PI * 0.25, Math.PI * 0.75); }
          g.closePath(); g.clip(); glow(g, 20, 20, 15, c[1], 0.3);
          g.translate(n === 1 ? 0 : i === 0 ? -4 : 4, n === 1 ? 0 : i === 0 ? -4 : 4); g.translate(20, 20); g.scale(n === 1 ? 1 : 0.72, n === 1 ? 1 : 0.72); g.translate(-20, -20);
          spellGlyph(pid, p)(g); g.restore();
        });
        if (ps.length > 1) line(g, [[9.4, 30.6], [30.6, 9.4]], "#f4dc96", 1.4);
        star(g, 31, 9, 2.6);   // the crafter's mark
        pips(g, sp.level || "Novice", sc[1]);
      };
    }
    return (g) => { medal(g, sc[0]); g.save(); g.beginPath(); g.arc(20, 20, 15, 0, 7); g.clip(); glow(g, 20, 20, 15, sc[1], 0.25); spellGlyph(id, sp)(g); g.restore(); pips(g, sp.level || "Novice", sc[1]); };
  }

  // ---- skills
  const SKILL = {
    "One-Handed": (g) => { g.save(); g.translate(20, 20); g.rotate(Math.PI / 4); poly(g, [[-2.4, 5], [-2.4, -12], [0, -15], [2.4, -12], [2.4, 5]], "#c8ccce"); rect(g, -6.5, 5, 13, 2.6, "#6b5640"); rect(g, -1.4, 7.6, 2.8, 6, "#7a5232"); g.restore(); },
    "Two-Handed": (g) => { g.save(); g.translate(20, 20); g.rotate(Math.PI / 4); rect(g, -1.5, -14, 3, 28, "#7a5232"); poly(g, [[1, -13], [11, -15], [13, -5], [10, 3], [1, -1]], "#c8ccce"); poly(g, [[-1, -13], [-11, -15], [-13, -5], [-10, 3], [-1, -1]], "#c8ccce"); g.restore(); },
    Archery: (g) => G_.bow(g, "#c8a46a"),
    Blocking: (g) => { circ(g, 20, 20, 12, "#8a5a34"); circ(g, 20, 20, 8, null, "#c49c70", 1.4); circ(g, 20, 20, 3.4, "#c8ccce"); },
    "Heavy Armor": (g) => { poly(g, [[11, 30], [11, 14], [15, 7], [25, 7], [29, 14], [29, 30]], "#8a8580"); rect(g, 12, 17, 16, 3.4, "#14100c", null); line(g, [[20, 20], [20, 30]], INK, 1.4); poly(g, [[11, 12], [5, 5], [10, 9]], "#efe4cc"); poly(g, [[29, 12], [35, 5], [30, 9]], "#efe4cc"); },
    "Light Armor": (g) => { poly(g, [[9, 10], [15, 7], [20, 10], [25, 7], [31, 10], [29, 32], [11, 32]], "#8a5a34"); line(g, [[20, 10], [20, 32]], "#c49c70", 1.2); line(g, [[11, 22], [29, 22]], "#4a2e18", 1.6); },
    "Medium Armor": (g) => { poly(g, [[9, 10], [15, 7], [20, 10], [25, 7], [31, 10], [29, 32], [11, 32]], "#9aa0a4"); for (let y = 12; y < 31; y += 3.2) for (let x = 12; x < 29; x += 3.2) circ(g, x + ((y / 3.2) % 2) * 1.6, y, 1.1, null, "#62686c", 0.7); },
    Spear: (g) => { line(g, [[8, 33], [30, 11]], "#7a5232", 2.6); poly(g, [[30, 11], [27, 8], [35, 4], [33, 12]], "#c8ccce"); },
    "Hand-to-Hand": (g) => G_.fist(g, "#e9c6a1"),
    Unarmored: (g) => { circ(g, 20, 11, 4.6, "#e9c6a1"); poly(g, [[11, 33], [13, 18], [27, 18], [29, 33]], "#efe4cc"); poly(g, [[13, 18], [20, 26], [27, 18]], null, "#9c8662", 1); },
    Destruction: (g) => G_.flame(g), Restoration: (g) => G_.hand(g), Alteration: (g) => { g.strokeStyle = "#b8b0f0"; g.lineWidth = 2.2; g.beginPath(); for (let a = 0; a < 14; a += 0.25) g.lineTo(20 + Math.cos(a) * a, 20 + Math.sin(a) * a); g.stroke(); },
    Conjuration: (g) => G_.skull(g, "#d8c8f0", "#7a4f9a"), Illusion: (g) => G_.eye(g, "#2f8a8a"), Mysticism: (g) => G_.gem(g),
    Sneak: (g) => { poly(g, [[20, 5], [32, 22], [30, 34], [10, 34], [8, 22]], "#3a3440"); ell(g, 20, 22, 6, 7, "#14100c", null); circ(g, 17.5, 22, 1.2, "#d6b25e", null); circ(g, 22.5, 22, 1.2, "#d6b25e", null); },
    Lockpicking: (g) => { rect(g, 11, 17, 18, 15, "#b07a3c"); poly(g, [[13, 17], [13, 11], [16, 7], [24, 7], [27, 11], [27, 17]], null, "#8a8580", 2.6); circ(g, 20, 23, 2.2, "#14100c", null); rect(g, 19.2, 23, 1.6, 5, "#14100c", null); line(g, [[20, 23], [34, 33]], "#c8ccce", 1.4); },
    Pickpocket: (g) => { poly(g, [[12, 16], [28, 16], [32, 30], [8, 30]], "#8a5a34"); line(g, [[12, 16], [20, 12], [28, 16]], "#4a2e18", 1.6); for (const [x, y] of [[26, 9], [31, 12]]) circ(g, x, y, 2.6, "#d6b25e"); },
    Athletics: (g) => { poly(g, [[10, 26], [16, 8], [24, 8], [23, 21], [32, 24], [32, 31], [10, 31]], "#7a4e2c"); line(g, [[4, 14], [9, 14]], INK, 1); line(g, [[3, 20], [9, 20]], INK, 1); },
    Acrobatics: (g) => { poly(g, [[8, 32], [20, 7], [22, 9], [12, 33]], "#efe4cc"); for (let i = 0; i < 6; i++) line(g, [[18 - i * 1.8, 11 + i * 3.4], [24 - i * 1.6, 14 + i * 3.2]], "#9c8662", 0.9); },
    Mercantile: (g) => { line(g, [[20, 7], [20, 31]], INK, 1.6); line(g, [[8, 12], [32, 12]], INK, 1.6); for (const x of [10, 30]) { line(g, [[x, 12], [x - 4, 22]], INK, 0.9); line(g, [[x, 12], [x + 4, 22]], INK, 0.9); ell(g, x, 22, 6, 2.2, "#d6b25e"); } rect(g, 14, 30, 12, 3, "#7a5232"); },
    Speechcraft: (g) => { poly(g, [[7, 9], [33, 9], [33, 25], [18, 25], [11, 32], [13, 25], [7, 25]], "#efe4cc"); for (const y of [14, 19]) line(g, [[12, y], [28, y]], "#9c8662", 1.2); },
    Etiquette: (g) => { poly(g, [[8, 28], [8, 14], [14, 20], [20, 10], [26, 20], [32, 14], [32, 28]], "#d6b25e"); for (const x of [8, 20, 32]) circ(g, x, x === 20 ? 10 : 14, 1.8, "#c43a3a", INK, 0.8); rect(g, 8, 28, 24, 3, "#94742c"); },
    Streetwise: (g) => { g.save(); g.translate(20, 20); g.rotate(-Math.PI / 4); poly(g, [[-1.6, 2], [-1.6, -11], [0, -13], [1.6, -11], [1.6, 2]], "#c8ccce"); rect(g, -4, 2, 8, 2, "#6b5640"); rect(g, -1, 4, 2, 5, "#7a5232"); g.restore(); circ(g, 28, 28, 4.6, "#d6b25e"); txt(g, "¢", 28, 28.5, 6); },
    Smithing: (g) => { poly(g, [[7, 26], [33, 26], [29, 30], [11, 30]], "#5a5652"); rect(g, 14, 30, 12, 4, "#5a5652"); poly(g, [[7, 22], [33, 22], [33, 26], [7, 26]], "#8a8580"); g.save(); g.translate(22, 12); g.rotate(-0.6); rect(g, -1.4, -2, 2.8, 14, "#7a5232"); rect(g, -6, -6, 12, 5, "#8a8580"); g.restore(); },
    Enchanting: (g) => { G_.gem(g, "#8a5bb8"); for (const [x, y] of [[8, 10], [32, 12], [30, 30]]) star(g, x, y, 2.4, 4, "#fff", null); },
    Alchemy: (g) => { poly(g, [[16, 6], [24, 6], [24, 14], [32, 30], [29, 34], [11, 34], [8, 30], [16, 14]], "#efe4cc"); poly(g, [[12, 24], [28, 24], [32, 30], [29, 34], [11, 34], [8, 30]], "#7fae6a", INK, 1); circ(g, 17, 29, 1.4, "#c4f0a0", null); circ(g, 23, 27, 1, "#c4f0a0", null); },
  };
  const groupOf = (sk) => Object.entries(D.SKILL_GROUPS || {}).find(([, l]) => l.includes(sk))?.[0] || "Warrior";
  function drawSkill(sk) { const c = GROUP[groupOf(sk)] || GROUP.Warrior; return (g) => { medal(g, c[0], "#f1e6cc"); g.save(); g.beginPath(); g.arc(20, 20, 15, 0, 7); g.clip(); (SKILL[sk] || ((g) => star(g, 20, 20, 9)))(g); g.restore(); }; }

  // ---- standing stones: the stone with its constellation
  const CONST = {
    warrior: [[13, 10], [20, 14], [27, 10], [20, 22], [16, 30], [24, 30]], mage: [[20, 8], [14, 16], [26, 16], [20, 24], [20, 31]], thief: [[12, 12], [18, 18], [24, 14], [28, 22], [20, 28]],
    lady: [[20, 8], [16, 14], [24, 14], [20, 20], [14, 28], [26, 28]], lord: [[14, 10], [26, 10], [20, 16], [20, 24], [14, 30], [26, 30]], steed: [[10, 18], [16, 14], [22, 16], [28, 12], [26, 24], [16, 24]],
    lover: [[14, 12], [20, 18], [26, 12], [20, 26], [14, 30], [26, 30]], atronach: [[20, 8], [12, 16], [28, 16], [14, 28], [26, 28], [20, 20]], apprentice: [[12, 10], [18, 16], [24, 12], [28, 20], [22, 26], [16, 30]],
    ritual: [[20, 8], [13, 15], [27, 15], [20, 22], [13, 29], [27, 29]], serpent: [[10, 12], [16, 16], [22, 12], [28, 16], [24, 24], [18, 28], [24, 32]], shadow: [[14, 8], [26, 10], [20, 18], [12, 26], [28, 28]],
    tower: [[20, 6], [16, 14], [24, 14], [16, 24], [24, 24], [20, 32]],
  };
  function drawStone(id) {
    const pts = CONST[id] || CONST.warrior;
    return (g) => { tile(g, true); poly(g, [[11, 37], [12, 9], [16, 4], [24, 4], [28, 9], [29, 37]], "#7d7a72", INK, 1.2); g.globalAlpha = 0.9; line(g, pts, "#9fd0f0", 0.9); g.globalAlpha = 1; for (const [x, y] of pts) { glow(g, x, y, 3.6, "#9fd0f0", 0.9); circ(g, x, y, 1.2, "#fff", null); } };
  }
  // ---- shouts: dragon-script scratches in a ring
  const SHOUT_MARK = { unrelenting_force: [[[12, 26], [20, 12], [28, 26]], [[16, 22], [24, 22]]], fire_breath: [[[12, 12], [20, 28], [28, 12]], [[20, 8], [20, 18]]], frost_breath: [[[12, 14], [28, 14]], [[14, 22], [26, 22]], [[20, 10], [20, 30]]],
    ice_form: [[[12, 12], [28, 28]], [[28, 12], [12, 28]], [[20, 8], [20, 32]]], become_ethereal: [[[12, 28], [20, 10], [28, 28]], [[12, 28], [28, 28]]], disarm: [[[12, 10], [28, 30]], [[12, 30], [20, 20]]], kynes_peace: [[[10, 20], [20, 10], [30, 20], [20, 30], [10, 20]]],
    dragon_aspect: [[[12, 10], [20, 18], [28, 10]], [[20, 18], [20, 30]], [[12, 30], [28, 30]]], whirlwind_sprint: [[[10, 26], [16, 14], [22, 26], [28, 14]]], aura_whisper: [[[20, 10], [12, 30]], [[20, 10], [28, 30]], [[14, 22], [26, 22]]] };
  function drawShout(id) { const m = SHOUT_MARK[id] || SHOUT_MARK.unrelenting_force; return (g) => { medal(g, "#9fb0b6", "#2c3036"); glow(g, 20, 20, 14, "#9fd0f0", 0.4); for (const p of m) { line(g, p, "#14100c", 3.6); line(g, p, "#e8f4fb", 1.8); } }; }

  // ---- questlines, achievements, guide steps, actions
  const QUEST = {
    main: (g) => { glow(g, 20, 22, 15, "#c4572e", 0.45);   // a dragon, wings spread, seen from below
      poly(g, [[20, 15], [12, 9], [4, 8], [8, 13], [3, 15], [9, 18], [5, 21], [13, 21], [18, 24]], "#6a3a2a", INK, 1.1);
      poly(g, [[20, 15], [28, 9], [36, 8], [32, 13], [37, 15], [31, 18], [35, 21], [27, 21], [22, 24]], "#6a3a2a", INK, 1.1);
      for (const [x1, y1, x2, y2] of [[12, 9, 14, 20], [8, 13, 16, 21], [28, 9, 26, 20], [32, 13, 24, 21]]) line(g, [[x1, y1], [x2, y2]], "#3a2018", 0.8);
      ell(g, 20, 21, 3.6, 8, "#5a3020", INK, 1.1); poly(g, [[18, 13], [20, 6], [22, 13]], "#5a3020", INK, 1); poly(g, [[18.5, 8], [16.5, 5], [19.2, 7]], "#efe4cc", null); poly(g, [[21.5, 8], [23.5, 5], [20.8, 7]], "#efe4cc", null);
      line(g, [[20, 29], [21, 33], [18, 36]], "#5a3020", 2.2); },
    companions: (g) => { shield(g, "#8e2b25"); G_.wolf(g, "#c8ccce"); },
    thieves: (g) => { shield(g, "#3a3440"); circ(g, 20, 18, 7, "#d6b25e"); poly(g, [[12, 14], [28, 14], [26, 20], [14, 20]], "#14100c", null); },
    college: (g) => { shield(g, "#2f5f9a"); G_.eye(g, "#9fc0f0"); },
    brotherhood: (g) => { shield(g, "#1c1414");   // the black hand on a dark shield, a red rim
      poly(g, [[14, 30], [13, 20], [27, 20], [26, 30]], "#8e2b25", null);
      for (const [x, l] of [[13.6, 9], [17.4, 11], [21.2, 11], [24.6, 9]]) rect(g, x, 20 - l, 3, l, "#8e2b25", null, 0);
      poly(g, [[26, 22], [31, 17], [32.5, 19], [27, 26]], "#8e2b25", null); },
    bounty: (g) => { rect(g, 9, 6, 22, 28, "#efe4cc"); for (const y of [12, 16, 20]) line(g, [[13, y], [27, y]], "#9c8662", 1.1); circ(g, 20, 27, 4, "#8e2b25"); },
    jobs: (g) => { rect(g, 8, 8, 24, 24, "#8a5a34"); rect(g, 12, 12, 7, 8, "#efe4cc", INK, 0.8); rect(g, 21, 14, 7, 9, "#efe4cc", INK, 0.8); circ(g, 15.5, 12.5, 1, "#c43a3a", null); circ(g, 24.5, 14.5, 1, "#c43a3a", null); },
    masks: (g) => { glow(g, 20, 20, 16, "#c9a24c", 0.4); if (typeof PRIESTS !== "undefined") PRIESTS.drawMask(g, 20, 20.5, 1.25, "morokei", INK); },   // [Skyrim] a dragon priest mask
  };
  const ACH = {
    first_steps: (g) => SKILL.Athletics(g), seasoned: (g) => SKILL["One-Handed"](g), explorer: (g) => { circ(g, 20, 20, 11, "#efe4cc"); poly(g, [[20, 9], [23, 20], [20, 31], [17, 20]], "#c43a3a", INK, 0.9); poly(g, [[20, 20], [23, 20], [20, 31], [17, 20]], "#efe4cc", INK, 0.9); },
    masks: (g) => { if (typeof PRIESTS !== "undefined") PRIESTS.drawMask(g, 20, 20, 1.05, "konahrik", INK); },
    delver: G_.candle, dragonslayer: QUEST.main, dragonbane: (g) => G_.skull(g, "#efe4cc"), thuum: (g) => { for (const p of SHOUT_MARK.unrelenting_force) { line(g, p, "#14100c", 3.6); line(g, p, "#e8f4fb", 1.8); } },
    stones: (g) => { poly(g, [[13, 34], [14, 10], [18, 6], [22, 6], [26, 10], [27, 34]], "#7d7a72"); star(g, 20, 18, 4, 5, "#9fd0f0", null); }, hero: QUEST.bounty, legend: (g) => star(g, 20, 20, 12, 5, "#d6b25e"),
    homeowner: (g) => { poly(g, [[8, 20], [20, 9], [32, 20]], "#8e2b25"); rect(g, 11, 20, 18, 13, "#c49c70"); rect(g, 17, 25, 6, 8, "#5a3a2a"); }, landlord: (g) => { rect(g, 9, 14, 22, 19, "#8f8a80"); for (const x of [9, 14, 19, 24, 29]) rect(g, x, 10, 3, 4, "#8f8a80", INK, 0.8); rect(g, 17, 24, 6, 9, "#5a3a2a"); },
    angler: (g) => { poly(g, [[6, 20], [12, 13], [24, 12], [31, 18], [37, 12], [36, 28], [31, 22], [24, 28], [12, 27]], "#8aa0a8"); circ(g, 12, 18.5, 1.4, "#fff", INK, 0.7); }, light_fingers: SKILL.Pickpocket, builder: G_.banner,
    champion: (g) => { shield(g, "#8e2b25"); line(g, [[12, 10], [28, 28]], "#c8ccce", 2.2); line(g, [[28, 10], [12, 28]], "#c8ccce", 2.2); }, stablemaster: (g) => horseHead(g, "#8a5a3b", true), rich: (g) => { for (const [x, y] of [[14, 26], [22, 28], [18, 20], [26, 21], [20, 13]]) { ell(g, x, y, 6, 2.6, "#d6b25e"); } },
  };
  const GUIDE = {
    travel: (g) => SKILL.Athletics(g), trade: SKILL.Mercantile, tactics: (g) => { line(g, [[10, 10], [30, 30]], "#c8ccce", 2.6); line(g, [[30, 10], [10, 30]], "#c8ccce", 2.6); }, dungeon: G_.candle,
    level: (g) => star(g, 20, 20, 12, 5, "#d6b25e"), smith: SKILL.Smithing, cook: (g) => { ell(g, 20, 24, 12, 8, "#3a3440"); ell(g, 20, 18, 12, 3.4, "#7a5232"); for (const x of [15, 20, 25]) line(g, [[x, 13], [x + 2, 8], [x, 4]], "rgba(255,255,255,.8)", 1.2); },
    friends: (g) => { for (const [x, c] of [[14, "#8a5a34"], [26, "#2f5f9a"]]) { circ(g, x, 13, 4.5, "#e9c6a1"); poly(g, [[x - 7, 33], [x - 6, 21], [x + 6, 21], [x + 7, 33]], c); } }, home: ACH.homeowner, arena: ACH.champion,
  };
  function horseHead(g, coat, armored) {
    poly(g, [[12, 34], [12, 22], [9, 14], [11, 6], [15, 9], [24, 9], [32, 18], [33, 24], [29, 26], [23, 22], [22, 34]], coat, INK, 1.2);
    poly(g, [[11, 6], [9, 2], [14, 7]], coat, INK, 1); circ(g, 22, 14, 1.6, "#14100c", null); circ(g, 30, 22, 1, "#14100c", null);
    poly(g, [[12, 8], [9, 20], [11, 30], [14, 24], [13, 12]], "#2b2724", null);
    if (armored) poly(g, [[15, 9], [24, 9], [30, 17], [26, 19], [18, 14]], "#8a8580", INK, 1);
  }
  const ATTR = {
    health: (g) => { medal(g, "#8e2b25"); G_.heart(g, "#c43a3a"); },
    magicka: (g) => { medal(g, "#2f5f9a"); glow(g, 20, 20, 13, "#9fc0f0", 0.8); circ(g, 20, 20, 8, "#4f8fe0", INK, 1.1); circ(g, 17, 17, 2.4, "#e8f4fb", null); },
    stamina: (g) => { medal(g, "#2f6b3a"); G_.bolt(g, ["#9fd09a", "#2f6b3a", "#fff"], 20, 20, 0.95); },
  };
  function drawAction(id) {
    const [k, a] = String(id).split(":");
    if ((k === "spell" || k === "dual") && D.SPELLS[a]) return drawSpell(a);
    if (k === "potion") return (g) => { tile(g); poly(g, [[16, 7], [24, 7], [24, 13], [30, 22], [28, 33], [12, 33], [10, 22], [16, 13]], "#efe4cc"); poly(g, [[11, 22], [29, 22], [28, 33], [12, 33]], { health: "#c43a3a", magicka: "#3a6ac4", stamina: "#3a9a4a" }[a] || "#c43a3a", INK, 1); rect(g, 16, 4, 8, 4, "#7a5232"); };
    if (k === "scroll") return (g) => { tile(g); rect(g, 9, 12, 22, 16, "#efe4cc"); ell(g, 9, 20, 3, 8, "#d9c9a2"); ell(g, 31, 20, 3, 8, "#d9c9a2"); circ(g, 20, 29, 3.4, "#8e2b25"); };
    if (k === "shout") return drawShout(a);
    if (k === "power") return (g) => { medal(g, a === "beast" ? "#5a3a2a" : "#d6b25e"); a === "beast" ? G_.wolf(g, "#7a6a5a") : star(g, 20, 20, 10, 6, "#f4dc96"); };
    const BASIC = { attack: SKILL["One-Handed"], power: SKILL["Two-Handed"], block: SKILL.Blocking, flee: SKILL.Athletics, bash: SKILL.Blocking };
    return (g) => { tile(g); (BASIC[k] || SKILL["One-Handed"])(g); };
  }

  // ---- wide pictures: festival banner, title panorama, death scene
  function drawFest(id) {
    return (g, H, w, h) => {
      const c = { newlife: "#2f5f9a", frostfall: "#9fd0f0", harvest: "#c4572e", witchingmoon: "#4a2f7a", warriorsfest: "#8e2b25", sundas: "#d6b25e" }[id] || "#9a7a2c";
      H.sky(g, w, h, id === "witchingmoon" ? "night" : "dusk"); H.mountains(g, w, h * 0.92, h * 0.5, 11, P.rock, true);
      g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(0, h * 0.18); g.quadraticCurveTo(w / 2, h * 0.42, w, h * 0.18); g.stroke();
      for (let i = 0; i < 14; i++) { const t = (i + 0.5) / 14, x = t * w, y = h * 0.18 + Math.sin(t * Math.PI) * h * 0.24 * (1 - 0.5); poly(g, [[x - 6, y - 1], [x + 6, y - 1], [x, y + 11]], i % 2 ? c : "#f1e6cc", INK, 0.8); }
      for (let i = 0; i < 5; i++) { const x = w * (0.12 + i * 0.19); glow(g, x, h * 0.75, 14, "#ffd060", 0.9); rect(g, x - 1.5, h * 0.75, 3, h * 0.2, "#7a5232", null); }
    };
  }
  function drawPanorama() {
    return (g, H, w, h) => {
      H.sky(g, w, h, "night"); const r = ART.seeded("pano");
      for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; g.fillRect(r() * w, r() * h * 0.5, 1.2, 1.2); }
      glow(g, w * 0.78, h * 0.18, 40, "rgba(159,208,240,.55)", 0.8); circ(g, w * 0.78, h * 0.18, 12, "#e8f0f4", null);
      // aurora
      for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(120,220,170,${0.18 - i * 0.04})`; g.lineWidth = 16 - i * 4; g.beginPath(); for (let x = 0; x <= w; x += 10) g.lineTo(x, h * (0.22 + i * 0.04) + Math.sin(x / 50 + i) * 10); g.stroke(); }
      H.mountains(g, w, h * 0.78, h * 0.5, 21, "#3a4048", true);
      // the Throat of the World with High Hrothgar
      H.poly(g, [[w * 0.28, h * 0.8], [w * 0.5, h * 0.12], [w * 0.72, h * 0.8]], "#4a5058", INK, 1.2);
      H.poly(g, [[w * 0.43, h * 0.33], [w * 0.5, h * 0.12], [w * 0.57, h * 0.33], [w * 0.53, h * 0.3], [w * 0.5, h * 0.36], [w * 0.47, h * 0.3]], "#e8eef2", null);
      // a dragon crossing the moon
      g.save(); g.translate(w * 0.72, h * 0.2); g.scale(0.7, 0.7); poly(g, [[-24, 0], [-8, -4], [0, -14], [4, -4], [24, -10], [10, 2], [24, 10], [4, 6], [0, 14], [-8, 4]], "#14100c", null); g.restore();
      H.mountains(g, w, h * 0.95, h * 0.28, 33, "#2c3036", false); H.pines(g, w, h * 0.97, 26, 34, 16);
      g.fillStyle = "rgba(20,24,30,.55)"; g.fillRect(0, h * 0.9, w, h * 0.1);
    };
  }
  function drawDeath() {
    return (g, H, w, h) => {
      H.sky(g, w, h, "dusk"); H.mountains(g, w, h * 0.7, h * 0.35, 51, "#5a4a50", true);
      g.fillStyle = "#3a3036"; g.fillRect(0, h * 0.72, w, h * 0.28);
      const x = w * 0.5, y = h * 0.74;
      // a sword in the ground, a fallen shield, crows
      rect(g, x - 2, y - h * 0.36, 4, h * 0.32, "#a9b0b4"); rect(g, x - 10, y - h * 0.38, 20, 4, "#6b5640"); rect(g, x - 2, y - h * 0.48, 4, h * 0.1, "#7a5232"); circ(g, x, y - h * 0.5, 4, "#d6b25e");
      ell(g, x + w * 0.16, y + 8, 18, 6, "#8a5a34"); ell(g, x + w * 0.16, y + 8, 5, 2, "#c8ccce", null);
      for (const [cx, cy, s] of [[0.2, 0.3, 1], [0.3, 0.22, 0.7], [0.8, 0.35, 0.8]]) { g.save(); g.translate(w * cx, h * cy); g.scale(s, s); line(g, [[-9, 2], [-3, -3], [0, 0], [3, -3], [9, 2]], "#14100c", 2); g.restore(); }
      g.fillStyle = "rgba(142,43,37,.25)"; g.fillRect(0, 0, w, h);
    };
  }

  // ---- public: <img> HTML, cached per style
  const box = (size, key, draw, alt = "", cls = "uico") => ART.html(size, size, (g, H, w) => { g.scale(w / 40, w / 40); draw(g, H); }, { key, cls: "ico " + cls, alt });
  return {
    LEVELS, SCHOOL, GROUP, SKILL, CONST, QUEST, ACH, GUIDE,
    spell: (id, size = 32) => (D.SPELLS[id] ? box(size, "sp:" + id, drawSpell(id), D.SPELLS[id].name, "sico") : ""),
    drawSpell, drawSkill, drawStone, drawShout, drawAction,
    skill: (sk, size = 28) => box(size, "sk:" + sk, drawSkill(sk), sk, "skico"),
    stone: (id, size = 32) => box(size, "st:" + id, drawStone(id), "", "sico"),
    shout: (id, size = 32) => box(size, "sh:" + id, drawShout(id), "", "sico"),
    power: (race, size = 32) => (typeof HEROART !== "undefined" ? HEROART.portrait({ race, id: "power-" + race }, size) : box(size, "pw", (g) => { medal(g, "#d6b25e"); star(g, 20, 20, 10); })),
    quest: (line, size = 32) => box(size, "q:" + line, (g) => { tile(g); (QUEST[line] || QUEST.bounty)(g); }, "", "qico"),
    ach: (id, size = 32, done = true) => box(size, "a:" + id + (done ? "" : ":x"), (g) => { medal(g, done ? "#d6b25e" : "#8a7a6a", "#f1e6cc"); g.save(); g.beginPath(); g.arc(20, 20, 15, 0, 7); g.clip(); (ACH[id] || ACH.legend)(g); g.restore(); if (!done) { g.globalAlpha = 0.55; circ(g, 20, 20, 16.4, "#cdb98f", null); g.globalAlpha = 1; } }, "", "aico"),
    follower: (id, size = 34) => { const f = TOWNS.FOLLOWERS?.[id]; const race = { jenassa: "dunmer", marcurio: "imperial" }[id] || "nord"; return typeof HEROART !== "undefined" ? HEROART.portrait({ race, id: "fol-" + id, name: f?.[0] }, size) : ""; },
    horse: (coat, size = 34, armored = false) => { const c = (HORSES.COATS.find((x) => x[0] === coat) || HORSES.COATS[0])[2]; return box(size, "h:" + coat + (armored ? ":a" : ""), (g) => { tile(g); horseHead(g, c, armored); }, "", "hico"); },
    rank: (rating = 1000, size = 30) => { const t = rating >= 1300 ? ["#d6b25e", 3] : rating >= 1150 ? ["#c8ccce", 2] : rating >= 1000 ? ["#b07a3c", 1] : ["#8a8580", 0]; return box(size, "r:" + t[1], (g) => { shield(g, t[0]); line(g, [[13, 11], [27, 25]], INK, 2); line(g, [[27, 11], [13, 25]], INK, 2); for (let i = 0; i < t[1]; i++) star(g, 15 + i * 5, 29, 2, 5, "#fff6d8", INK); }, "", "rico"); },
    banner: (colors = [], size = 30) => { const a = colors[0] || "#8e2b25", b = colors[1] || "#d6b25e"; return box(size, "b:" + a + b, (g) => { line(g, [[10, 3], [10, 37]], "#7a5232", 2.4); poly(g, [[11, 4], [32, 4], [32, 30], [21.5, 25], [11, 30]], a, INK, 1.2); poly(g, [[11, 12], [32, 12], [32, 17], [11, 17]], b, null); star(g, 21.5, 21, 3.4, 5, b, INK); }, "", "bico"); },
    hold: (color = "#8e2b25", size = 26) => box(size, "hd:" + color, (g) => { shield(g, color); poly(g, [[14, 12], [26, 12], [20, 26]], "rgba(255,255,255,.35)", null); }, "", "hdico"),
    guide: (id, size = 30) => box(size, "g:" + id, (g) => { tile(g); (GUIDE[id] || GUIDE.level)(g); }, "", "gico"),
    attr: (name, size = 26) => box(size, "at:" + name, ATTR[name] || ATTR.health, "", "atico"),
    action: (id, size = 30) => box(size, "ac:" + id, drawAction(id), "", "acico"),
    fest: (id, w = 340, h = 70) => ART.html(w, h, drawFest(id), { key: "fest:" + id, cls: "scene fest", alt: "" }),
    panorama: (w = 390, h = 260) => ART.html(w, h, drawPanorama(), { key: "pano", cls: "pano", alt: "" }),
    death: (w = 320, h = 120) => ART.html(w, h, drawDeath(), { key: "death", cls: "scene death", alt: "" }),
  };
})();
