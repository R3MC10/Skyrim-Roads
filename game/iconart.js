/* Icons for every item and enemy, drawn in code with the shared ART toolkit (ink on parchment).
   ICONART.item(id, size, row?)  → <img> HTML (row gives quality pips; enchanted items glow; a frame in the rarity colour)
   ICONART.enemy(name, tags, size) → <img> HTML portrait
   Every drawer works in a 40×40 box; ART scales and caches it per style. [OURS] */
const ICONART = (() => {
  const P = ART.PAL, INK = "#2a1f15";
  const base = (id) => (id && id.startsWith("ench|") ? id.split("|")[1] : id);
  // ---- material colours: [main, light, dark]
  const MAT = {
    iron: ["#8a8580", "#b5b0aa", "#5a5652"], steel: ["#b8bec2", "#e2e6e8", "#7c8388"], elven: ["#cdb46a", "#f0dc98", "#8e7638"],
    dwarven: ["#b07a3c", "#d9a868", "#76501f"], ebony: ["#3a3440", "#6a6075", "#1d1a21"], glass: ["#8fd3a8", "#cdf2dc", "#4f9a6c"],
    ancient_nord: ["#6e7f86", "#9fb0b6", "#46545a"], forsworn: ["#9a7a58", "#cbb08c", "#5e4630"], orcish: ["#6b7650", "#9aa576", "#424b30"],
    hide: ["#9a7650", "#c49c70", "#5e4630"], leather: ["#7a4e2c", "#a87450", "#4a2e18"], chainmail: ["#9aa0a4", "#c8ccce", "#62686c"],
    guild: ["#3e3a36", "#6a645e", "#22201d"], wuuthrad: ["#3a3440", "#7d7488", "#1d1a21"], silver: ["#c7ccd0", "#f1f3f4", "#8b9196"], gold: ["#d6b25e", "#f4dc96", "#94742c"],
    moonstone: ["#dcd6f0", "#ffffff", "#9a94b8"],
  };
  function matOf(id) {
    for (const k of ["ancient_nord", "dwarven", "elven", "ebony", "glass", "forsworn", "orcish", "chainmail", "steel", "iron", "hide", "leather", "guild", "wuuthrad", "silver", "gold"]) if (id.includes(k)) return MAT[k];
    if (/crossbow/.test(id)) return MAT.steel;
    return MAT.iron;
  }
  const WOOD = ["#7a5232", "#a0744c", "#4e321c"];
  const SCHOOL = { Destruction: "#c4572e", Restoration: "#d6b25e", Alteration: "#5f8f6a", Conjuration: "#7a4f9a", Illusion: "#4f6fae", Mysticism: "#3f8f94", Enchanting: "#8e2b25" };
  const ELEM = { fire: "#e8923a", frost: "#9fd0f0", shock: "#c9b6ff", sun: "#f4dc96" };
  const GEM = { garnet: "#9b2d3a", amethyst: "#8a5bb8", ruby: "#d0283a", sapphire: "#2f5fc4", emerald: "#2f9a5a", diamond: "#e8f4fb" };

  // ---- primitives (40×40 space)
  const poly = (g, pts, fill, stroke = INK, w = 1.3) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.lineJoin = "round"; g.stroke(); } };
  const circ = (g, x, y, r, fill, stroke = INK, w = 1.3) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); } };
  const ell = (g, x, y, rx, ry, fill, stroke = INK, w = 1.3, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); } };
  const rect = (g, x, y, w, h, fill, stroke = INK, lw = 1.3) => { g.fillStyle = fill; g.fillRect(x, y, w, h); if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.strokeRect(x, y, w, h); } };
  const line = (g, pts, color = INK, w = 1.3) => { g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
  const shine = (g, x, y, r = 1.6) => { g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  function tile(g, dark = false) {   // a small parchment card behind each icon
    const r = 6; g.beginPath(); g.moveTo(r, 1); g.arcTo(39, 1, 39, 39, r); g.arcTo(39, 39, 1, 39, r); g.arcTo(1, 39, 1, 1, r); g.arcTo(1, 1, 39, 1, r); g.closePath();
    const gr = g.createRadialGradient(20, 17, 4, 20, 20, 26);
    if (dark) { gr.addColorStop(0, "#4a3f33"); gr.addColorStop(1, "#231c15"); } else { gr.addColorStop(0, "#f1e6cc"); gr.addColorStop(1, "#cdb98f"); }
    g.fillStyle = gr; g.fill(); g.strokeStyle = dark ? "#6b5640" : "#9c8662"; g.lineWidth = 1; g.stroke();
  }
  // draw `fn` along a diagonal (vertical drawing, origin at the centre, rotated 45°)
  const diag = (g, fn, ang = Math.PI / 4) => { g.save(); g.translate(20, 20); g.rotate(ang); fn(g); g.restore(); };

  // ---- weapons (vertical, point up, origin centre)
  function blade(g, m, len, w, gripLen, guard) {
    poly(g, [[-w / 2, gripLen * 0 + 4], [-w / 2, -len + w], [0, -len], [w / 2, -len + w], [w / 2, 4]], m[0]);
    line(g, [[0, 2], [0, -len + w + 1]], m[1], 0.9);
    poly(g, [[-guard / 2, 4], [guard / 2, 4], [guard / 2, 6.5], [-guard / 2, 6.5]], m[2]);
    rect(g, -1.6, 6.5, 3.2, gripLen, "#4a2e18", INK, 1);
    circ(g, 0, 7.5 + gripLen, 2.2, m[2]);
  }
  const W = {
    dagger: (g, m) => blade(g, m, 13, 4.5, 6, 9),
    sword: (g, m) => blade(g, m, 18, 5, 7, 13),
    greatsword: (g, m) => blade(g, m, 20, 6, 10, 16),
    axe: (g, m) => { rect(g, -1.4, -14, 2.8, 30, WOOD[0], INK, 1); poly(g, [[1, -13], [9, -16], [11, -8], [9, -1], [1, -4]], m[0]); line(g, [[9.5, -15], [10.5, -2]], m[1], 0.9); },
    battleaxe: (g, m) => { rect(g, -1.4, -16, 2.8, 34, WOOD[0], INK, 1); poly(g, [[1, -15], [10, -18], [12, -9], [10, 0], [1, -5]], m[0]); poly(g, [[-1, -15], [-10, -18], [-12, -9], [-10, 0], [-1, -5]], m[0]); },
    mace: (g, m) => { rect(g, -1.4, -9, 2.8, 25, "#4a2e18", INK, 1); circ(g, 0, -12, 5.5, m[0]); for (const a of [0, 1.57, 3.14, 4.71]) poly(g, [[Math.cos(a) * 4, -12 + Math.sin(a) * 4], [Math.cos(a) * 8.5, -12 + Math.sin(a) * 8.5], [Math.cos(a + 0.5) * 4, -12 + Math.sin(a + 0.5) * 4]], m[2], INK, 1); shine(g, -2, -14, 1.3); },
    warhammer: (g, m) => { rect(g, -1.4, -14, 2.8, 32, WOOD[0], INK, 1); rect(g, -8, -18, 16, 8, m[0]); rect(g, -8, -18, 3, 8, m[2], INK, 1); },
    spear: (g, m) => { rect(g, -1.2, -10, 2.4, 29, WOOD[0], INK, 1); poly(g, [[0, -19], [3.5, -12], [0, -8], [-3.5, -12]], m[0]); circ(g, 0, -8.5, 1.5, m[2], INK, 1); },
  };
  function bow(g, m, id) {
    g.save(); g.translate(20, 20); g.rotate(-0.35);
    g.strokeStyle = INK; g.lineWidth = 4.2; g.beginPath(); g.arc(-12, 0, 18, -1.05, 1.05); g.stroke();
    g.strokeStyle = /elven|dwarven|ancient|glass|ebony/.test(id) ? m[0] : WOOD[1]; g.lineWidth = 2.6; g.beginPath(); g.arc(-12, 0, 18, -1.05, 1.05); g.stroke();
    line(g, [[-3, -15.5], [-3, 15.5]], "#efe6d2", 0.8);
    rect(g, 3.5, -2.5, 3, 5, "#4a2e18", INK, 0.8);
    g.restore();
  }
  function crossbow(g, m) {   // side view: stock pointing right, bow limbs across the front
    g.save(); g.translate(20, 20); g.rotate(-0.5);
    poly(g, [[-16, 1], [-6, -2], [14, -2], [14, 2], [-6, 2], [-16, 6]], WOOD[0], INK, 1.1);
    rect(g, -2, 2, 3, 6, "#4a2e18", INK, 0.9);
    g.strokeStyle = INK; g.lineWidth = 3.6; g.beginPath(); g.arc(22, 0, 13, Math.PI * 0.68, Math.PI * 1.32); g.stroke();
    g.strokeStyle = m[0]; g.lineWidth = 2.2; g.beginPath(); g.arc(22, 0, 13, Math.PI * 0.68, Math.PI * 1.32); g.stroke();
    line(g, [[22 + 13 * Math.cos(Math.PI * 0.68), 13 * Math.sin(Math.PI * 0.68)], [4, 0], [22 + 13 * Math.cos(Math.PI * 1.32), 13 * Math.sin(Math.PI * 1.32)]], "#efe6d2", 0.8);
    line(g, [[4, -1.2], [16, -1.2]], m[1], 1.4); poly(g, [[16, -3], [19, -1.2], [16, 0.6]], m[1], INK, 0.7);
    g.restore();
  }
  function staff(g, it) {
    const el = ELEM[D.SPELLS?.[it.staff?.spell]?.element] || SCHOOL[it.skill] || "#9fd0f0";
    diag(g, (g) => {
      rect(g, -1.4, -10, 2.8, 29, WOOD[0], INK, 1);
      poly(g, [[-4, -10], [0, -14], [4, -10], [0, -8]], WOOD[2], INK, 1);
      const gl = g.createRadialGradient(0, -16, 0.5, 0, -16, 7); gl.addColorStop(0, "#fff"); gl.addColorStop(0.35, el); gl.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gl; g.beginPath(); g.arc(0, -16, 7, 0, 7); g.fill(); circ(g, 0, -16, 3, el, INK, 1);
    });
  }
  function ammo(g, id, m) {
    const bolt = id.startsWith("bolt");
    for (const [dx, dy] of [[-5, 2], [0, 0], [5, 2]]) diag(g, (g) => {
      g.translate(dx, dy);
      line(g, [[0, bolt ? 12 : 16], [0, bolt ? -9 : -14]], WOOD[1], 1.6);
      poly(g, [[0, bolt ? -15 : -19], [2.4, bolt ? -10 : -14], [-2.4, bolt ? -10 : -14]], m[0], INK, 1);
      if (!bolt) { poly(g, [[0, 10], [3, 16], [0, 14], [-3, 16]], "#c4572e", INK, 0.8); }
      else poly(g, [[0, 8], [2.4, 12], [-2.4, 12]], "#d8cfbd", INK, 0.8);
    });
  }

  // ---- armour
  function helmet(g, id, m, type) {
    if (/chainmail/.test(id)) { ell(g, 20, 21, 12, 14, m[0]); ell(g, 20, 24, 6, 7, "#2a2622"); for (let y = 10; y < 34; y += 3) for (let x = 10; x < 31; x += 3) if (((x - 20) / 12) ** 2 + ((y - 21) / 14) ** 2 < 1 && ((x - 20) / 6) ** 2 + ((y - 24) / 7) ** 2 > 1) { g.fillStyle = m[2]; g.fillRect(x, y, 1, 1); } return; }
    if (type === "light") { poly(g, [[9, 24], [10, 13], [20, 7], [30, 13], [31, 24], [27, 27], [13, 27]], m[0]); line(g, [[11, 20], [29, 20]], m[2], 1.6); if (/hide/.test(id)) for (const x of [10, 15, 20, 25, 30]) line(g, [[x, 24], [x - 1, 29]], "#e9dcc0", 1.4); ell(g, 20, 25, 6, 3, "#2a2622", null); return; }
    poly(g, [[9, 26], [9, 15], [14, 9], [26, 9], [31, 15], [31, 26], [26, 31], [14, 31]], m[0]);
    rect(g, 12, 18, 16, 3.2, "#1d1a17", null); rect(g, 18.4, 18, 3.2, 10, "#1d1a17", null);
    line(g, [[14, 10], [20, 8], [26, 10]], m[1], 1.2);
    if (/iron|ancient_nord|steel/.test(id)) { poly(g, [[9, 15], [2, 6], [4, 3], [11, 12]], "#efe4cc", INK, 1.1); poly(g, [[31, 15], [38, 6], [36, 3], [29, 12]], "#efe4cc", INK, 1.1); }
    if (/dwarven/.test(id)) poly(g, [[17, 9], [20, 3], [23, 9]], m[1], INK, 1);
  }
  function cuirass(g, id, m, type) {
    if (type === "cloth") {
      const c = /archmage/.test(id) ? ["#3a4f8a", "#d6b25e"] : ["#5a4a7a", "#a89cc8"];
      poly(g, [[14, 6], [26, 6], [30, 12], [33, 35], [7, 35], [10, 12]], c[0]);
      poly(g, [[15, 6], [20, 12], [25, 6]], "#2a2234", INK, 1); line(g, [[20, 12], [20, 35]], c[1], 1.4); line(g, [[9, 34], [31, 34]], c[1], 1.4);
      return;
    }
    poly(g, [[12, 7], [16, 6], [20, 10], [24, 6], [28, 7], [34, 12], [31, 20], [28, 18], [28, 33], [12, 33], [12, 18], [9, 20], [6, 12]], m[0]);
    if (type === "light" || /hide|leather|forsworn|guild/.test(id)) { line(g, [[13, 14], [27, 27]], m[2], 2); line(g, [[13, 26], [27, 26]], m[2], 1.6); if (/hide|forsworn/.test(id)) for (const x of [8, 12, 28, 32]) line(g, [[x, 11], [x, 15]], "#e9dcc0", 1.2); }
    else if (/chainmail/.test(id)) { for (let y = 12; y < 32; y += 2.6) for (let x = 13; x < 28; x += 2.6) circ(g, x, y, 0.8, null, m[2], 0.6); }
    else { line(g, [[20, 11], [20, 32]], m[2], 1.2); line(g, [[12, 22], [28, 22]], m[1], 1.2); line(g, [[12, 27], [28, 27]], m[2], 1.2); ell(g, 15, 14, 4, 3, m[1], INK, 1); ell(g, 25, 14, 4, 3, m[1], INK, 1); }
  }
  function gloves(g, id, m, type) {
    poly(g, [[11, 30], [11, 18], [13, 10], [16, 10], [16, 17], [17, 8], [20, 8], [20, 16], [21, 8], [24, 8], [24, 17], [25, 10], [28, 11], [28, 22], [30, 18], [33, 19], [29, 28], [27, 30]], m[0]);
    rect(g, 10, 30, 18, 6, type === "light" ? m[2] : m[1]);
    if (type !== "light") { line(g, [[12, 22], [27, 22]], m[2], 1.2); }
  }
  function boots(g, id, m, type) {
    poly(g, [[12, 5], [24, 5], [24, 24], [33, 28], [33, 34], [9, 34], [10, 24]], m[0]);
    rect(g, 11, 5, 14, 5, type === "light" ? m[2] : m[1]);
    line(g, [[9, 31], [33, 31]], m[2], 1.6);
    if (/hide/.test(id)) for (const x of [12, 16, 20, 24]) line(g, [[x, 10], [x, 13]], "#e9dcc0", 1.2);
  }
  function shield(g, id, m) {
    if (/hide/.test(id)) { circ(g, 20, 20, 15, WOOD[1]); circ(g, 20, 20, 15, null, "#5e4630", 2.5); for (let a = 0; a < 6.28; a += 0.8) line(g, [[20 + Math.cos(a) * 15, 20 + Math.sin(a) * 15], [20 + Math.cos(a) * 18, 20 + Math.sin(a) * 18]], "#e9dcc0", 1.2); circ(g, 20, 20, 4, MAT.iron[0]); return; }
    poly(g, [[8, 7], [32, 7], [32, 20], [20, 36], [8, 20]], m[0]);
    poly(g, [[11, 10], [29, 10], [29, 20], [20, 32], [11, 20]], null, m[2], 1.2);
    circ(g, 20, 17, 3.5, m[1]);
  }

  // ---- consumables, books, magic
  function bottle(g, liquid, poison) {
    poly(g, [[17, 6], [23, 6], [23, 13], [30, 19], [30, 32], [10, 32], [10, 19], [17, 13]], "rgba(220,235,240,.55)");
    poly(g, [[11, 21], [29, 21], [29, 31], [11, 31]], liquid, null);
    rect(g, 16.5, 3, 7, 4, WOOD[1], INK, 1);
    poly(g, [[17, 6], [23, 6], [23, 13], [30, 19], [30, 32], [10, 32], [10, 19], [17, 13]], null);
    shine(g, 14, 22, 1.5);
    if (poison) { circ(g, 20, 26, 3, "#e9dcc0", INK, 0.8); g.fillStyle = INK; g.fillRect(18.6, 25.2, 1, 1); g.fillRect(20.6, 25.2, 1, 1); }
  }
  function potionColor(it) {
    const e = (it.effects && it.effects[0] && it.effects[0][0]) || "";
    const r = it.restore?.[0] || (/health/i.test(e) ? "health" : /magicka/i.test(e) ? "magicka" : /stamina/i.test(e) ? "stamina" : "");
    if (it.cures || /cure/i.test(e)) return "#e7e1d0";
    if (r === "health") return "#c3283a"; if (r === "magicka") return "#2f5fc4"; if (r === "stamina") return "#3d9a4a";
    if (/Fortify/.test(e)) return "#d6b25e"; if (/Resist/.test(e)) return "#3f8f94"; if (/Invisib|Waterbr/.test(e)) return "#9fd0f0";
    return "#8a5bb8";
  }
  function tome(g, color, glyph = "✦") {
    poly(g, [[9, 8], [29, 6], [32, 30], [12, 33]], color);
    poly(g, [[12, 33], [32, 30], [32, 33], [12, 36]], "#efe4cc", INK, 1);
    line(g, [[11, 10], [13, 31]], "#2a1f15", 1.5);
    circ(g, 21, 19, 5.5, null, "#f4dc96", 1.2);
    poly(g, [[21, 14.5], [22.4, 18], [26, 19], [22.4, 20], [21, 23.5], [19.6, 20], [16, 19], [19.6, 18]], "#f4dc96", null);
  }
  function scroll(g, color) {
    rect(g, 9, 12, 22, 16, "#efe4cc"); ell(g, 9, 20, 3, 8, "#d9c9a2"); ell(g, 31, 20, 3, 8, "#d9c9a2");
    for (const y of [16, 19.5, 23]) line(g, [[13, y], [27, y]], "#9c8662", 1);
    circ(g, 20, 29, 3.6, color || "#8e2b25");
  }
  function soulgem(g, filled, big) {
    const s = big ? 1.15 : 0.95, c = filled ? ["#8a5bb8", "#c9a8f0", "#4b2a6b"] : ["#8f8a94", "#c8c4cc", "#57535b"];
    g.save(); g.translate(20, 21); g.scale(s, s);
    if (filled) { const gl = g.createRadialGradient(0, 0, 2, 0, 0, 16); gl.addColorStop(0, "rgba(201,168,240,.9)"); gl.addColorStop(1, "rgba(201,168,240,0)"); g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill(); }
    poly(g, [[0, -14], [9, -4], [6, 11], [-6, 11], [-9, -4]], c[0]);
    poly(g, [[0, -14], [3, -4], [0, 11], [-3, -4]], c[1], c[2], 0.8); line(g, [[-9, -4], [9, -4]], c[2], 0.8);
    g.restore();
  }
  function gem(g, kind, flawless) {
    const c = GEM[kind] || "#cccccc";
    g.save(); g.translate(20, 21);
    if (flawless) { const gl = g.createRadialGradient(0, 0, 2, 0, 0, 17); gl.addColorStop(0, "rgba(255,255,255,.7)"); gl.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 17, 0, 7); g.fill(); }
    poly(g, [[-11, -4], [-6, -10], [6, -10], [11, -4], [0, 12]], c);
    poly(g, [[-6, -10], [-3, -4], [3, -4], [6, -10]], "rgba(255,255,255,.45)", INK, 0.8);
    line(g, [[-11, -4], [11, -4]], INK, 0.8); line(g, [[-3, -4], [0, 12], [3, -4]], "rgba(0,0,0,.35)", 0.8);
    if (flawless) { for (const [x, y] of [[9, -12], [-12, 6]]) { line(g, [[x - 3, y], [x + 3, y]], "#fff", 1.1); line(g, [[x, y - 3], [x, y + 3]], "#fff", 1.1); } }
    g.restore();
  }
  function ring(g, metal, gemKind) {
    const m = MAT[metal];
    g.lineWidth = 4.2; g.strokeStyle = INK; g.beginPath(); g.ellipse(20, 23, 10, 9, 0, 0, 7); g.stroke();
    g.lineWidth = 2.6; g.strokeStyle = m[0]; g.beginPath(); g.ellipse(20, 23, 10, 9, 0, 0, 7); g.stroke();
    if (gemKind) { poly(g, [[15, 14], [20, 8], [25, 14], [20, 18]], GEM[gemKind], INK, 1); shine(g, 18.5, 12.5, 1.1); } else ell(g, 20, 14, 4, 2.5, m[1]);
  }
  function necklace(g, metal, gemKind) {
    const m = MAT[metal];
    for (let a = 0.15; a < 3.0; a += 0.22) circ(g, 20 + Math.cos(a) * 13, 6 + Math.sin(a) * 15, 1.5, m[0], INK, 0.7);
    if (gemKind) { poly(g, [[15, 24], [20, 19], [25, 24], [20, 34]], GEM[gemKind], INK, 1); shine(g, 18.5, 23, 1.2); } else circ(g, 20, 25, 4, m[0]);
  }
  function ingot(g, m) { poly(g, [[7, 24], [12, 15], [33, 15], [33, 24]], m[0]); poly(g, [[7, 24], [33, 24], [33, 30], [7, 30]], m[2]); poly(g, [[12, 15], [33, 15], [33, 18], [10, 18]], m[1], null); }
  function ore(g, fleck) {
    poly(g, [[6, 28], [9, 15], [17, 9], [28, 11], [34, 20], [31, 31], [16, 33]], "#7d6c58");
    poly(g, [[9, 15], [17, 9], [20, 18], [12, 22]], "#8f7a66", null);
    const r = ART.seeded(fleck); for (let i = 0; i < 7; i++) { const x = 11 + r() * 18, y = 14 + r() * 15; poly(g, [[x, y - 2], [x + 2.2, y], [x, y + 2], [x - 2.2, y]], fleck, INK, 0.6); }
  }
  function pelt(g, c) { poly(g, [[8, 10], [14, 6], [26, 6], [32, 10], [34, 18], [30, 22], [33, 32], [24, 30], [20, 35], [16, 30], [7, 32], [10, 22], [6, 18]], c); for (let i = 0; i < 6; i++) line(g, [[12 + i * 3, 13], [13 + i * 3, 25]], "rgba(0,0,0,.25)", 1); }
  function flower(g, petal, center = "#e8c94a") { line(g, [[20, 34], [20, 18]], "#4f7a3a", 1.8); poly(g, [[20, 26], [27, 22], [24, 28]], "#5f8f4a", INK, 0.8); for (let a = 0; a < 6.28; a += 1.256) ell(g, 20 + Math.cos(a) * 5, 14 + Math.sin(a) * 5, 4, 2.8, petal, INK, 0.8, a); circ(g, 20, 14, 2.4, center, INK, 0.8); }
  function mushroom(g, cap, glow) { if (glow) { const gl = g.createRadialGradient(20, 16, 1, 20, 16, 15); gl.addColorStop(0, "rgba(159,208,240,.8)"); gl.addColorStop(1, "rgba(159,208,240,0)"); g.fillStyle = gl; g.fillRect(0, 0, 40, 40); } rect(g, 17, 18, 6, 14, "#efe4cc", INK, 1); poly(g, [[7, 20], [11, 10], [20, 6], [29, 10], [33, 20]], cap); for (const [x, y] of [[14, 13], [22, 10], [26, 15]]) circ(g, x, y, 1.4, "#efe4cc", null); }
  function berries(g, c) { line(g, [[12, 8], [20, 16], [28, 9]], "#4f7a3a", 1.4); for (const [x, y] of [[16, 22], [22, 20], [19, 27], [25, 26], [13, 28], [28, 20]]) { circ(g, x, y, 3.4, c, INK, 0.9); shine(g, x - 1, y - 1, 0.8); } poly(g, [[20, 16], [25, 12], [24, 17]], "#5f8f4a", INK, 0.8); }
  function bone(g, c = "#efe4cc") { diag(g, (g) => { rect(g, -2.5, -11, 5, 22, c, INK, 1.1); for (const y of [-12, 12]) { circ(g, -3, y, 3.6, c, INK, 1.1); circ(g, 3, y, 3.6, c, INK, 1.1); } rect(g, -2.4, -11, 4.8, 22, c, null); }); }
  function salts(g, c) { poly(g, [[7, 32], [13, 22], [20, 16], [27, 22], [33, 32]], c); for (const [x, y] of [[15, 26], [22, 22], [26, 28], [19, 30]]) poly(g, [[x, y - 2], [x + 2, y], [x, y + 2], [x - 2, y]], "rgba(255,255,255,.7)", null); }
  function fish(g, c, teeth) { poly(g, [[6, 20], [12, 13], [24, 12], [31, 18], [37, 12], [36, 28], [31, 22], [24, 28], [12, 27]], c); circ(g, 12, 18.5, 1.6, "#fff", INK, 0.8); line(g, [[18, 14], [18, 26]], "rgba(0,0,0,.25)", 1); if (teeth) for (let x = 7; x < 12; x += 1.6) poly(g, [[x, 21], [x + 0.8, 23.5], [x + 1.6, 21]], "#fff", null); }
  function veg(g, id) {
    if (/potato/.test(id)) { ell(g, 20, 22, 12, 9, "#b08a52"); for (const [x, y] of [[15, 20], [23, 24], [25, 18]]) circ(g, x, y, 0.9, "#6b5640", null); return; }
    if (/carrot/.test(id)) { poly(g, [[12, 12], [16, 9], [30, 33]], "#e07a2a"); for (const dx of [-3, 0, 3]) line(g, [[14, 10], [9 + dx, 3]], "#4f7a3a", 1.6); return; }
    if (/tomato/.test(id)) { circ(g, 20, 22, 10, "#c8302c"); poly(g, [[16, 13], [20, 10], [24, 13], [20, 15]], "#4f7a3a", INK, 0.8); shine(g, 16, 18, 1.6); return; }
    if (/cabbage/.test(id)) { circ(g, 20, 22, 12, "#7fae5a"); line(g, [[20, 11], [20, 33]], "#557a47", 1); g.beginPath(); g.arc(14, 22, 8, -1.2, 1.2); g.strokeStyle = "#557a47"; g.stroke(); return; }
    if (/leek/.test(id)) { rect(g, 17, 14, 6, 20, "#efe4cc"); poly(g, [[17, 14], [12, 3], [20, 10], [28, 3], [23, 14]], "#5f8f4a"); return; }
    if (/salt/.test(id)) return salts(g, "#f4f6f8");
    if (/horker|venison/.test(id)) { poly(g, [[8, 22], [14, 12], [28, 10], [34, 18], [30, 30], [14, 32]], "#b0463a"); ell(g, 22, 20, 5, 3.5, "#e9c6a1", null); bone(g, "#efe4cc"); return; }
    ell(g, 20, 22, 10, 8, "#9a7650");
  }
  function dish(g, id) { poly(g, [[6, 20], [34, 20], [30, 31], [10, 31]], WOOD[1]); ell(g, 20, 20, 14, 4.5, /fish|salmon/.test(id) ? "#d88a62" : /venison|horker/.test(id) ? "#8e4a2a" : "#b68f3a"); for (const [x, y] of [[15, 19], [21, 21], [25, 18]]) circ(g, x, y, 1.6, /veg/.test(id) ? "#7fae5a" : "#e07a2a", null); for (const x of [15, 20, 25]) line(g, [[x, 14], [x + 2, 9], [x, 5]], "rgba(255,255,255,.65)", 1.1); }

  // ---- ingredients by name keyword
  function ingredient(g, id, it) {
    const n = (it.name || id).toLowerCase();
    if (/nirnroot/.test(n)) { const gl = g.createRadialGradient(20, 16, 1, 20, 16, 16); gl.addColorStop(0, /crimson/.test(n) ? "rgba(230,90,90,.75)" : "rgba(150,220,255,.75)"); gl.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gl; g.fillRect(0, 0, 40, 40); line(g, [[20, 34], [20, 12]], "#4f7a3a", 2); for (const [x, y] of [[13, 14], [27, 14], [11, 22], [29, 22]]) ell(g, x, y, 5, 2.2, /crimson/.test(n) ? "#d86a6a" : "#9fd8f0", INK, 0.8, x < 20 ? 0.5 : -0.5); return; }
    if (/pearl/.test(n)) { ell(g, 20, 26, 13, 7, "#8a8070", INK, 1); circ(g, 20, 22, /small/.test(n) ? 4 : 6, "#f4f0e8", INK, 0.9); shine(g, 18, 20, 1.4); return; }
    if (/jelly/.test(n)) { poly(g, [[8, 28], [10, 16], [20, 9], [30, 16], [32, 28], [20, 33]], /ash/.test(n) ? "#c8a050" : "#8ac8b0"); shine(g, 15, 16, 2); return; }
    if (/grape/.test(n)) return berries(g, "#5a3a8a");
    if (/roe/.test(n)) return berries(g, "#e8743a");
    if (/moss/.test(n)) { for (let x = 9; x <= 31; x += 4.4) line(g, [[x, 6], [x + 1, 18], [x - 1, 30]], "#6a8a4a", 2.2); line(g, [[6, 6], [34, 6]], WOOD[0], 3); return; }
    if (/creep/.test(n) && /ash/.test(n)) return mushroom(g, "#4a4a5a", false);
    if (/dust|ash|ectoplasm/.test(n)) return salts(g, /ectoplasm/.test(n) ? "#b8e8d8" : /spawn|ash/.test(n) ? "#6a6a68" : "#d8d0d8");
    if (/amanita|crown|white cap|blisterwort|rot|pholiota|scathecraw/.test(n)) return mushroom(g, /amanita/.test(n) ? "#d83a2a" : /crown/.test(n) ? "#8a2a3a" : /white/.test(n) ? "#efe4cc" : /blister/.test(n) ? "#c89a5a" : /rot/.test(n) ? "#9a9a6a" : /scathecraw/.test(n) ? "#6a5a4a" : "#d8a04a", false);
    if (/tusk|teeth|tooth|ear\b|claw/.test(n) && !/elves/.test(n)) return bone(g, /falmer/.test(n) ? "#c8b8a0" : "#efe4cc");
    if (/thorax|bee|moth/.test(n)) { ell(g, 14, 18, 7, 9, /luna/.test(n) ? "#b8e8a0" : /bee/.test(n) ? "#e8c03a" : "#e8a040", INK, 1, -0.4); ell(g, 26, 18, 7, 9, /luna/.test(n) ? "#b8e8a0" : /bee/.test(n) ? "#e8c03a" : "#e8a040", INK, 1, 0.4); line(g, [[20, 10], [20, 30]], INK, 2.4); return; }
    if (/trama|taproot/.test(n)) { line(g, [[20, 6], [20, 22]], "#7a5a3a", 3); for (const [x, y] of [[10, 32], [16, 35], [24, 35], [30, 31]]) line(g, [[20, 20], [x, y]], "#7a5a3a", 2); return; }
    if (/salts/.test(n)) return salts(g, /frost/.test(n) ? "#9fd0f0" : /fire/.test(n) ? "#e8923a" : "#6a4a8a");
    if (/salt/.test(n)) return salts(g, "#f4f6f8");
    if (/mushroom|stool|fungal|pod|cluster|mora|tapinella/.test(n)) return mushroom(g, /glowing/.test(n) ? "#5fb0d8" : /imp/.test(n) ? "#c4572e" : /fungal/.test(n) ? "#6a8a4a" : /creep/.test(n) ? "#8a5bb8" : "#b0463a", /glowing/.test(n));
    if (/berr|juniper/.test(n)) return berries(g, /snow/.test(n) ? "#d83a4a" : "#3a3a8a");
    if (/bone|claw|toe|tooth/.test(n)) return bone(g);
    if (/tail/.test(n)) { line(g, [[8, 30], [14, 20], [24, 18], [32, 10]], "#c48a8a", 3.2); line(g, [[8, 30], [14, 20], [24, 18], [32, 10]], INK, 0.6); return; }
    if (/feather/.test(n)) { line(g, [[10, 32], [30, 8]], INK, 1.2); poly(g, [[13, 28], [17, 16], [29, 8], [24, 20]], "#c8b89a"); return; }
    if (/egg/.test(n)) { ell(g, 20, 22, 9, 11, "#efe4cc"); circ(g, 17, 18, 1.4, "#9fd0f0", null); return; }
    if (/butterfly|wing/.test(n)) { ell(g, 14, 18, 7, 9, "#5fa0d8", INK, 1, -0.4); ell(g, 26, 18, 7, 9, "#5fa0d8", INK, 1, 0.4); line(g, [[20, 10], [20, 30]], INK, 2); return; }
    if (/wheat/.test(n)) { line(g, [[20, 34], [20, 8]], "#c9a24c", 1.6); for (let y = 9; y < 22; y += 3.2) { ell(g, 17, y, 2.6, 1.6, "#d6b25e", INK, 0.7, -0.6); ell(g, 23, y, 2.6, 1.6, "#d6b25e", INK, 0.7, 0.6); } return; }
    if (/garlic/.test(n)) { poly(g, [[20, 6], [23, 14], [31, 22], [27, 32], [13, 32], [9, 22], [17, 14]], "#efe4cc"); line(g, [[20, 14], [20, 32]], "#c8b89a", 1); return; }
    if (/hide|chitin|mudcrab|fat/.test(n)) return pelt(g, /fat/.test(n) ? "#e8dcb0" : /mudcrab/.test(n) ? "#8a6a48" : "#4a3a2a");
    if (/root|toe/.test(n)) { line(g, [[20, 6], [20, 22]], "#9a7650", 3); for (const [x, y] of [[12, 32], [20, 34], [28, 31]]) line(g, [[20, 20], [x, y]], "#9a7650", 2); return; }
    if (/cotton/.test(n)) { for (const [x, y] of [[16, 16], [24, 16], [20, 22], [14, 24], [26, 24]]) circ(g, x, y, 5, "#f4f6f8", INK, 0.8); return; }
    if (/ear|leaf|wisp|thistle/.test(n) && !/flower/.test(n)) { poly(g, [[20, 5], [30, 18], [20, 35], [10, 18]], /wisp/.test(n) ? "#cfe4f0" : "#6a9a4a"); line(g, [[20, 8], [20, 32]], "rgba(0,0,0,.35)", 1); return; }
    const petal = /blue/.test(n) ? "#4f6fd8" : /purple|nightshade|lavender/.test(n) ? "#8a5bb8" : /red|dragon/.test(n) ? "#d83a3a" : /deathbell/.test(n) ? "#7a6a9a" : /mirriam|frost/.test(n) ? "#cfe4f0" : "#d8b83a";
    return flower(g, petal);
  }

  // ---- trophies, quest and misc things
  function trophy(g, id) {
    if (/scale/.test(id)) { for (const [x, y] of [[14, 14], [24, 14], [19, 22], [29, 22], [10, 22], [15, 30], [25, 30]]) poly(g, [[x - 5, y - 3], [x, y - 6], [x + 5, y - 3], [x, y + 5]], "#6a7a5a", INK, 1); return; }
    if (/bone/.test(id)) return bone(g, "#e9e0c8");
    if (/claw/.test(id)) { for (const dx of [-7, 0, 7]) poly(g, [[20 + dx - 3, 28], [20 + dx + 3, 28], [20 + dx + 5, 14], [20 + dx, 6]], MAT.gold[0]); rect(g, 9, 28, 22, 6, MAT.gold[2]); return; }
    if (/dragonstone/.test(id)) { poly(g, [[8, 10], [30, 6], [33, 30], [10, 34]], "#7d7f78"); for (const [a, b] of [[[13, 15], [20, 22]], [[22, 12], [26, 25]], [[14, 27], [28, 18]]]) line(g, [a, b], "#3b3b38", 1.2); return; }
    if (/horn/.test(id)) { g.lineWidth = 6.5; g.strokeStyle = INK; g.beginPath(); g.arc(24, 26, 13, 3.3, 5.4); g.stroke(); g.lineWidth = 4.5; g.strokeStyle = "#e9dcc0"; g.beginPath(); g.arc(24, 26, 13, 3.3, 5.4); g.stroke(); return; }
    return bone(g);
  }
  function misc(g, id, it) {
    if (/fishing_rod/.test(id)) { line(g, [[8, 34], [32, 6]], WOOD[0], 2.4); line(g, [[32, 6], [34, 22]], "#efe4cc", 0.8); circ(g, 34, 24, 1.6, "#c4572e", INK, 0.7); circ(g, 12, 29, 2.6, MAT.iron[0], INK, 1); return; }
    if (/pickaxe/.test(id)) { diag(g, (g) => { rect(g, -1.5, -12, 3, 30, WOOD[0], INK, 1); poly(g, [[-15, -11], [0, -17], [15, -11], [0, -13]], MAT.iron[0]); }); return; }
    if (/soul_gem/.test(id)) return soulgem(g, !/empty/.test(id), /greater/.test(id));
    poly(g, [[12, 14], [28, 14], [32, 32], [8, 32]], "#9a7650"); line(g, [[12, 14], [16, 9], [24, 9], [28, 14]], INK, 1.3);   // a pouch for anything else
  }

  // ---- pick the drawer for an item
  // a small spell medallion (uiart.js) on tomes, scrolls and staffs
  function spellBadge(g, spell, x, y, k) {
    if (typeof UIART === "undefined" || !D.SPELLS?.[spell]) return;
    g.save(); g.translate(x - 20 * k, y - 20 * k); g.scale(k, k); UIART.drawSpell(spell)(g); g.restore();
  }
  function drawItem(id, row) {
    const bid = base(id), it = D.ITEMS[id] || D.ITEMS[bid] || {}, m = matOf(bid), slot = it.slot;
    return (g) => {
      tile(g);
      if (slot === "weapon") {
        if (it.staff) { staff(g, it); spellBadge(g, it.staff.spell, 29, 29, 0.32); }
        else if (it.shoots === "bolt" || /crossbow/.test(bid)) crossbow(g, m);
        else if (it.skill === "Archery") bow(g, m, bid);
        else { const t = (G.wtype && G.wtype(bid)) || "sword", f = W[t === "sword" && /great|claymore/.test(bid) ? "greatsword" : t] || (it.hands === 2 ? W.greatsword : W.sword); diag(g, (g) => f(g, m)); }
      } else if (slot === "shield") shield(g, bid, m);
      else if (slot === "head" && it.mask && typeof PRIESTS !== "undefined") PRIESTS.drawMask(g, 20, 20, 1.3, it.mask);   // dragon priest masks
      else if (slot === "head") helmet(g, bid, m, it.type);
      else if (slot === "chest") cuirass(g, bid, m, it.type);
      else if (slot === "hands") gloves(g, bid, m, it.type);
      else if (slot === "feet") boots(g, bid, m, it.type);
      else if (slot === "ammo") ammo(g, bid, m);
      else if (slot === "cloak" && it.cloakLook) {   // side cloaks (cloaks.js): the side's colours, a trim, the emblem
        const k = it.cloakLook;
        poly(g, [[12, 8], [28, 8], [33, 33], [26, 30], [20, 34], [14, 30], [7, 33]], k.c);
        poly(g, [[12, 8], [28, 8], [26, 13], [14, 13]], k.fur || k.d);
        line(g, [[7, 33], [14, 30], [20, 34], [26, 30], [33, 33]], k.trim, 1.6);
        line(g, [[16, 14], [14, 30]], k.d, 1); line(g, [[24, 14], [26, 30]], k.d, 1);
        if (typeof SIDES !== "undefined" && SIDES.drawEmblem) SIDES.drawEmblem(g, k.side, 20, 21, 5 + (k.rank || 1) * 0.4);
      }
      else if (slot === "potion" || slot === "poison") bottle(g, slot === "poison" ? "#4a7a3a" : potionColor(it), slot === "poison");
      else if (slot === "scroll") { scroll(g, SCHOOL[D.SPELLS?.[it.spell]?.school]); spellBadge(g, it.spell, 30, 10, 0.3); }
      else if (slot === "tome") { tome(g, SCHOOL[D.SPELLS?.[it.spell]?.school] || "#7a4f9a"); spellBadge(g, it.spell, 21, 19, 0.36); }
      else if (slot === "soulgem") soulgem(g, true, /greater/.test(bid));
      else if (slot === "ingredient") ingredient(g, bid, it);
      else if (slot === "food") { if (/^fish_/.test(bid)) fish(g, /salmon/.test(bid) ? "#d88a62" : /slaughter/.test(bid) ? "#6a7a5a" : /perch|histcarp/.test(bid) ? "#9aa05a" : /mudcrab/.test(bid) ? "#8a6a48" : "#8aa0a8", /slaughter/.test(bid)); else if (/^dish_/.test(bid)) dish(g, bid); else veg(g, bid); }
      else if (slot === "material") {
        if (/^ore_/.test(bid)) ore(g, { ore_iron: "#9a9590", ore_corundum: "#c46a3a", ore_moonstone: "#e8e2d0", ore_silver: "#d8dde0", ore_gold: "#e8c44a" }[bid] || "#bbb");
        else if (/^pelt_/.test(bid)) pelt(g, { pelt_wolf: "#8a8580", pelt_bear: "#5a3e28", pelt_sabre: "#c8a46a" }[bid] || "#8a6a48");
        else if (/leather$/.test(bid)) { poly(g, [[8, 12], [32, 10], [30, 30], [10, 32]], MAT.leather[0]); line(g, [[11, 15], [29, 13], [27, 27], [13, 29], [11, 15]], MAT.leather[2], 0.9); }
        else if (/strips/.test(bid)) { for (const dx of [-5, 0, 5]) line(g, [[13 + dx, 8], [17 + dx, 20], [13 + dx, 32]], MAT.leather[0], 3); circ(g, 15, 20, 3, MAT.leather[2], INK, 0.8); }
        else if (/firewood/.test(bid)) { for (const [x, y] of [[13, 25], [27, 25], [20, 16]]) { ell(g, x, y, 7, 6, WOOD[0]); ell(g, x, y, 3.5, 3, "#c8a46a", INK, 0.8); } }
        else ingot(g, { mat_iron: MAT.iron, mat_steel: MAT.steel, mat_moonstone: ["#e8e2d0", "#fff", "#a8a090"], mat_dwarven: MAT.dwarven, mat_silver: MAT.silver, mat_gold: MAT.gold }[bid] || MAT.iron);
      }
      else if (slot === "valuable") {
        const gk = Object.keys(GEM).find((k) => bid.includes(k));
        if (/^gem_/.test(bid)) gem(g, gk, /flawless/.test(bid));
        else if (/ring/.test(bid)) ring(g, /^gold/.test(bid) ? "gold" : "silver", gk);
        else necklace(g, /^gold/.test(bid) ? "gold" : "silver", gk);
      }
      else if (slot === "ring" || slot === "amulet") {   // jewellery worn as gear (jewelry.js): its own metal and gem
        const mt = MAT[it.metal] ? it.metal : /^gold/.test(bid) ? "gold" : /^iron/.test(bid) ? "iron" : "silver";
        const gk = it.gem || Object.keys(GEM).find((k) => bid.includes(k));
        if (slot === "ring") ring(g, mt, gk); else necklace(g, mt, gk);
        if (it.unique) { circ(g, 8, 8, 2.2, "#f4dc96", INK, 0.7); }
      }
      else if (slot === "trophy") trophy(g, bid);
      else misc(g, bid, it);
      // extras: an enchanted glow, quality pips for improved gear
      if (it.enchant || it.aenchant) { g.globalCompositeOperation = "destination-over"; const gl = g.createRadialGradient(20, 20, 4, 20, 20, 20); gl.addColorStop(0, "rgba(160,130,255,.55)"); gl.addColorStop(1, "rgba(160,130,255,0)"); g.fillStyle = gl; g.fillRect(0, 0, 40, 40); g.globalCompositeOperation = "source-over"; circ(g, 34, 6, 3, "#a98cff", INK, 0.8); }
      const q = row?.tq || 0; for (let i = 0; i < Math.min(q, 6); i++) circ(g, 5 + i * 4.2, 35, 1.6, "#d6b25e", INK, 0.6);
    };
  }
  function item(id, size = 34, row = null) {
    if (!id || !(D.ITEMS[id] || D.ITEMS[base(id)])) return "";
    const q = row?.tq || 0;
    const rar = typeof RARITY !== "undefined" ? RARITY.of(id, row) : "common", cls = rar === "common" ? "ico" : "ico rar-" + rar;   // a thin frame in the rarity colour (rarity.js)
    const pic = typeof ASSETS !== "undefined" && typeof Image !== "undefined" ? ASSETS.img("icon-" + base(id).replace(/_/g, "-")) : null;   // [gear] a painted icon dropped in the game folder wins
    if (pic) return ART.html(size, size, (g, H, w) => { g.drawImage(pic, 0, 0, w, w); const ench = D.ITEMS[id]?.enchant || D.ITEMS[id]?.aenchant; if (ench) { g.strokeStyle = "rgba(169,140,255,.9)"; g.lineWidth = Math.max(1, w / 24); g.strokeRect(1, 1, w - 2, w - 2); } }, { key: `ip:${id}|${q}`, cls, alt: "", painted: true });
    return ART.html(size, size, (g, H, w) => { g.scale(w / 40, w / 40); drawItem(id, row)(g); }, { key: `i:${id}|${q}`, cls, alt: "" });
  }

  // ---- enemy portraits
  const ENEMY_RULES = [
    [/dragon priest/i, "priest"], [/centurion|sphere|dwarven|dwemer|automaton/i, "dwemer"], [/dragon/i, "dragon"], [/mudcrab/i, "mudcrab"], [/slaughterfish/i, "fish"], [/horker/i, "horker"], [/mammoth/i, "mammoth"], [/giant(?! frost)(?!.*spider)/i, "giant"],
    [/spider|spiderling/i, "spider"], [/skeever/i, "skeever"], [/wolf|wolves|dog/i, "wolf"], [/bear/i, "bear"], [/sabre|cat\b/i, "sabre"], [/troll/i, "troll"],
    [/skeleton/i, "skeleton"], [/draugr|wight|scourge|deathlord|restless/i, "draugr"], [/vampire|thrall/i, "vampire"], [/hagraven/i, "hagraven"], [/spriggan/i, "spriggan"],
    [/wisp/i, "wisp"], [/atronach/i, "atronach"], [/centurion|sphere|dwarven|dwemer|automaton/i, "dwemer"], [/forsworn|briarheart/i, "forsworn"], [/falmer/i, "falmer"], [/chaurus/i, "spider"],
    [/thalmor|justiciar/i, "thalmor"], [/mage|necromancer|conjurer|warlock|witch|wizard/i, "mage"], [/bandit|outlaw|thug|chief|bounty|hunter|marauder|highwayman|smuggler|robber/i, "bandit"],
  ];
  function enemyKind(name = "", tags = []) {
    const sk = typeof SOLART !== "undefined" ? SOLART.faceKind(name) : null; if (sk) return sk;   // Solstheim's creatures (solart.js)
    for (const [re, k] of ENEMY_RULES) if (re.test(name)) return k;
    const t = new Set(tags || []);
    if (t.has("dragon")) return "dragon"; if (t.has("undead")) return "draugr"; if (t.has("construct")) return "dwemer"; if (t.has("beast")) return "beast"; return "humanoid";
  }
  const eye = (g, x, y, c = "#1a1410", r = 1.4) => circ(g, x, y, r, c, null);
  const glowEye = (g, x, y, c) => { const gl = g.createRadialGradient(x, y, 0.2, x, y, 4); gl.addColorStop(0, "#fff"); gl.addColorStop(0.3, c); gl.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gl; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); };
  const FACES = {
    bandit: (g) => { poly(g, [[9, 40], [11, 26], [20, 21], [29, 26], [31, 40]], "#6b4a2e"); ell(g, 20, 17, 8, 9, P.skin[1]); poly(g, [[11, 15], [13, 6], [20, 3], [27, 6], [29, 15], [26, 11], [14, 11]], MAT.iron[0]); rect(g, 12, 18, 16, 3, "#3a2a1e", null); eye(g, 16.5, 16); eye(g, 23.5, 16); line(g, [[15, 24], [25, 24]], "#5a3a22", 2.4); },
    humanoid: (g) => { poly(g, [[9, 40], [11, 26], [20, 22], [29, 26], [31, 40]], "#5a4a7a"); ell(g, 20, 16, 8, 9, P.skin[0]); poly(g, [[11, 14], [14, 6], [20, 4], [26, 6], [29, 14], [27, 10], [13, 10]], "#5e4630"); eye(g, 16.5, 16); eye(g, 23.5, 16); line(g, [[17, 21], [23, 21]], "#8a5a3a", 1); },
    mage: (g) => { poly(g, [[7, 40], [10, 22], [20, 2], [30, 22], [33, 40]], "#3a2e4a"); ell(g, 20, 21, 6.5, 8, P.skin[0]); glowEye(g, 17.5, 20, "#c9a8f0"); glowEye(g, 22.5, 20, "#c9a8f0"); const gl = g.createRadialGradient(32, 32, 1, 32, 32, 7); gl.addColorStop(0, "#fff"); gl.addColorStop(0.4, "#e8923a"); gl.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gl; g.fillRect(24, 24, 16, 16); },
    thalmor: (g) => { poly(g, [[7, 40], [10, 22], [20, 3], [30, 22], [33, 40]], "#2a2a2e"); line(g, [[10, 22], [20, 3], [30, 22]], "#d6b25e", 1.6); ell(g, 20, 21, 6, 8, "#d8c08a"); eye(g, 17.5, 20); eye(g, 22.5, 20); },
    forsworn: (g) => { ell(g, 20, 20, 8, 10, P.skin[1]); line(g, [[13, 18], [27, 18]], "#8e2b25", 2); for (const [x1, x2] of [[12, 4], [28, 36]]) { line(g, [[x1, 12], [x2, 3]], "#e9dcc0", 1.8); line(g, [[(x1 + x2) / 2, 8], [(x1 + x2) / 2 + (x2 > x1 ? 3 : -3), 1]], "#e9dcc0", 1.4); } for (let x = 12; x < 29; x += 4) poly(g, [[x, 11], [x + 2, 4], [x + 4, 11]], "#5f8f4a", INK, 0.8); eye(g, 17, 20); eye(g, 23, 20); poly(g, [[10, 40], [13, 30], [27, 30], [30, 40]], "#6b4a2e"); },
    vampire: (g) => { poly(g, [[6, 40], [10, 26], [20, 30], [30, 26], [34, 40]], "#2a1418"); poly(g, [[8, 24], [10, 14], [20, 6], [30, 14], [32, 24], [20, 30]], "#3a1a22", null); ell(g, 20, 18, 7.5, 9, "#d8d0d4"); glowEye(g, 16.8, 17, "#ff3030"); glowEye(g, 23.2, 17, "#ff3030"); poly(g, [[18, 23], [19, 26], [20, 23]], "#fff", null); poly(g, [[20, 23], [21, 26], [22, 23]], "#fff", null); },
    draugr: (g) => { ell(g, 20, 20, 9, 11, "#8a8a6a"); for (const [x, y] of [[14, 26], [26, 25], [20, 30]]) line(g, [[x - 2, y], [x + 2, y + 1]], "#5a5a40", 1); glowEye(g, 16, 18, "#7fd0ff"); glowEye(g, 24, 18, "#7fd0ff"); poly(g, [[16, 27], [24, 27], [22, 31], [18, 31]], "#2a2418"); poly(g, [[10, 14], [12, 6], [20, 3], [28, 6], [30, 14], [26, 10], [14, 10]], MAT.ancient_nord[0]); poly(g, [[10, 12], [3, 3], [6, 2], [12, 9]], "#d8cfbd", INK, 1); poly(g, [[30, 12], [37, 3], [34, 2], [28, 9]], "#d8cfbd", INK, 1); },
    skeleton: (g) => { ell(g, 20, 17, 10, 11, "#efe4cc"); ell(g, 16, 17, 3, 3.5, "#1a1410", null); ell(g, 24, 17, 3, 3.5, "#1a1410", null); poly(g, [[19, 21], [20, 24], [21, 21]], "#1a1410", null); rect(g, 14, 27, 12, 5, "#efe4cc"); for (let x = 16; x < 25; x += 2) line(g, [[x, 27], [x, 32]], INK, 0.8); },
    wolf: (g) => { poly(g, [[8, 8], [14, 16], [26, 16], [32, 8], [30, 22], [26, 32], [20, 37], [14, 32], [10, 22]], "#8a8580"); poly(g, [[15, 26], [25, 26], [20, 37]], "#c8c4bc"); eye(g, 15, 20, "#e8c94a", 1.6); eye(g, 25, 20, "#e8c94a", 1.6); circ(g, 20, 34, 1.8, "#1a1410", null); poly(g, [[9, 9], [12, 14], [13, 9]], "#5a5652", null); poly(g, [[31, 9], [28, 14], [27, 9]], "#5a5652", null); },
    beast: (g) => FACES.wolf(g),
    bear: (g) => { circ(g, 10, 10, 5, "#5a3e28"); circ(g, 30, 10, 5, "#5a3e28"); circ(g, 20, 21, 13, "#5a3e28"); ell(g, 20, 27, 6.5, 5, "#9a7650"); circ(g, 20, 24.5, 2.2, "#1a1410", null); eye(g, 15, 18); eye(g, 25, 18); },
    sabre: (g) => { poly(g, [[8, 8], [13, 15], [27, 15], [32, 8], [32, 24], [20, 32], [8, 24]], "#c8a46a"); for (const x of [12, 16, 24, 28]) line(g, [[x, 15], [x + 1, 20]], "#6b4a2e", 1.3); ell(g, 20, 26, 6, 4, "#efe4cc"); poly(g, [[16, 28], [17, 37], [18.5, 28]], "#fff"); poly(g, [[21.5, 28], [23, 37], [24, 28]], "#fff"); eye(g, 15, 20, "#7fae5a", 1.6); eye(g, 25, 20, "#7fae5a", 1.6); },
    troll: (g) => { circ(g, 20, 21, 13, "#d8d4c8"); for (let a = 0; a < 6.28; a += 0.5) line(g, [[20 + Math.cos(a) * 12, 21 + Math.sin(a) * 12], [20 + Math.cos(a) * 16, 21 + Math.sin(a) * 16]], "#d8d4c8", 2); eye(g, 14, 16, "#c4572e", 1.8); eye(g, 20, 13, "#c4572e", 1.8); eye(g, 26, 16, "#c4572e", 1.8); poly(g, [[12, 25], [28, 25], [25, 31], [15, 31]], "#3a2a2a"); poly(g, [[15, 25], [16, 28], [17, 25]], "#fff", null); poly(g, [[23, 25], [24, 28], [25, 25]], "#fff", null); },
    spider: (g) => { for (const s of [-1, 1]) for (let i = 0; i < 4; i++) line(g, [[20, 20], [20 + s * 9, 13 + i * 5], [20 + s * 17, 10 + i * 7]], INK, 2); ell(g, 20, 26, 9, 9, "#d8dce0"); circ(g, 20, 16, 6, "#b8bec2"); for (const [x, y] of [[17, 14], [23, 14], [18.5, 17], [21.5, 17]]) eye(g, x, y, "#1a1410", 1.1); line(g, [[20, 20], [20, 32]], "#7c8388", 1.2); },
    skeever: (g) => { poly(g, [[6, 22], [16, 12], [28, 14], [34, 22], [28, 30], [16, 30]], "#7a5a42"); circ(g, 18, 11, 4, "#c48a8a"); circ(g, 18, 11, 4, null, INK, 1); circ(g, 33, 22, 2, "#e08080", null); eye(g, 26, 19, "#c4572e", 1.4); for (const y of [20, 23]) line(g, [[33, y], [38, y - 2 + (y - 20)]], INK, 0.7); line(g, [[6, 24], [1, 34]], "#c48a8a", 1.6); },
    giant: (g) => { ell(g, 20, 19, 13, 15, P.skin[0]); poly(g, [[8, 24], [12, 38], [28, 38], [32, 24], [26, 30], [14, 30]], "#6b5640"); eye(g, 15, 16); eye(g, 25, 16); line(g, [[11, 12], [17, 13]], INK, 1.6); line(g, [[23, 13], [29, 12]], INK, 1.6); poly(g, [[18, 17], [20, 23], [22, 17]], "#c99a6e", INK, 0.8); },
    mammoth: (g) => { circ(g, 20, 17, 12, "#6b4a2e"); ell(g, 7, 18, 5, 8, "#5a3e28"); ell(g, 33, 18, 5, 8, "#5a3e28"); line(g, [[20, 22], [20, 34], [24, 37]], "#5a3e28", 5); line(g, [[14, 24], [8, 34], [12, 38]], "#efe4cc", 2.8); line(g, [[26, 24], [32, 34], [28, 38]], "#efe4cc", 2.8); eye(g, 15, 15); eye(g, 25, 15); },
    dragon: (g) => { poly(g, [[6, 6], [13, 13], [10, 3], [18, 11], [27, 11], [33, 4], [32, 16], [36, 24], [28, 34], [12, 34], [5, 24], [9, 16]], "#5a6a4a"); poly(g, [[12, 26], [28, 26], [26, 37], [14, 37]], "#4a5a3a"); for (let x = 14; x < 27; x += 3) poly(g, [[x, 26], [x + 1.5, 30], [x + 3, 26]], "#fff", null); glowEye(g, 14.5, 19, "#e8923a"); glowEye(g, 25.5, 19, "#e8923a"); circ(g, 17, 31, 0.9, "#1a1410", null); circ(g, 23, 31, 0.9, "#1a1410", null); },
    hagraven: (g) => { poly(g, [[4, 40], [8, 20], [20, 14], [32, 20], [36, 40]], "#3a3036"); for (let i = 0; i < 7; i++) line(g, [[8 + i * 4, 22], [5 + i * 5, 36]], "#2a2024", 1.4); ell(g, 20, 16, 7, 8, "#a8a890"); poly(g, [[18, 18], [20, 27], [22, 18]], "#5a4a30", INK, 0.8); eye(g, 17, 14, "#c4572e"); eye(g, 23, 14, "#c4572e"); for (let x = 12; x < 29; x += 3) line(g, [[x, 9], [x - 1, 3]], "#2a2024", 1.6); },
    spriggan: (g) => { poly(g, [[12, 36], [10, 18], [14, 6], [20, 3], [26, 6], [30, 18], [28, 36]], "#8a6a48"); for (const x of [12, 16, 24, 28]) line(g, [[x, 8], [x + (x < 20 ? -4 : 4), 1]], "#6b4a2e", 1.6); glowEye(g, 16.5, 17, "#9fe08a"); glowEye(g, 23.5, 17, "#9fe08a"); line(g, [[20, 10], [20, 32]], "#5e4630", 1); const gl = g.createRadialGradient(20, 28, 1, 20, 28, 6); gl.addColorStop(0, "#c8ff9a"); gl.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gl; g.fillRect(12, 20, 16, 16); },
    wisp: (g) => { const gl = g.createRadialGradient(20, 18, 2, 20, 18, 18); gl.addColorStop(0, "#fff"); gl.addColorStop(0.3, "#9fd0f0"); gl.addColorStop(1, "rgba(159,208,240,0)"); g.fillStyle = gl; g.fillRect(0, 0, 40, 40); poly(g, [[14, 38], [12, 20], [20, 8], [28, 20], [26, 38], [20, 32]], "rgba(220,240,255,.75)", "rgba(42,31,21,.6)", 1); eye(g, 17.5, 18, "#2a4a6a"); eye(g, 22.5, 18, "#2a4a6a"); },
    atronach: (g, name) => { const c = /frost/i.test(name) ? ["#9fd0f0", "#e8f4fb"] : /storm/i.test(name) ? ["#7a6aa8", "#c9b6ff"] : ["#c4572e", "#f4c060"]; const gl = g.createRadialGradient(20, 20, 2, 20, 20, 19); gl.addColorStop(0, c[1]); gl.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gl; g.fillRect(0, 0, 40, 40); poly(g, [[12, 36], [10, 20], [14, 10], [20, 4], [26, 10], [30, 20], [28, 36], [20, 30]], c[0]); glowEye(g, 16.5, 17, "#fff"); glowEye(g, 23.5, 17, "#fff"); },
    dwemer: (g) => { circ(g, 20, 20, 13, "#b07a3c"); circ(g, 20, 20, 13, null, "#76501f", 2.2); for (let a = 0; a < 6.28; a += 0.785) circ(g, 20 + Math.cos(a) * 10.5, 20 + Math.sin(a) * 10.5, 1.1, "#d9a868", null); glowEye(g, 20, 18, "#ffd27a"); line(g, [[13, 27], [27, 27]], "#76501f", 1.6); },
    mudcrab: (g) => { ell(g, 20, 24, 13, 9, "#7a5a3e"); for (const s of [-1, 1]) { line(g, [[20 + s * 10, 22], [20 + s * 16, 14]], INK, 2); ell(g, 20 + s * 16, 11, 4, 3, "#7a5a3e", INK, 1, s * 0.5); for (let i = 0; i < 3; i++) line(g, [[20 + s * (6 + i * 3), 30], [20 + s * (9 + i * 3), 36]], INK, 1.4); } eye(g, 17, 18, "#1a1410", 1.2); eye(g, 23, 18, "#1a1410", 1.2); },
    horker: (g) => { ell(g, 20, 21, 14, 12, "#8a7a6a"); line(g, [[15, 26], [13, 38]], "#efe4cc", 2.6); line(g, [[25, 26], [27, 38]], "#efe4cc", 2.6); ell(g, 20, 24, 5, 3, "#6b5a4a", null); eye(g, 14, 17); eye(g, 26, 17); },
    fish: (g) => fish(g, "#6a7a5a", true),
    priest: (g) => { poly(g, [[6, 40], [9, 22], [20, 14], [31, 22], [34, 40]], "#3a2e2a"); poly(g, [[11, 10], [20, 3], [29, 10], [28, 26], [20, 32], [12, 26]], "#c9a24c"); rect(g, 13, 15, 5, 3, "#1a1410", null); rect(g, 22, 15, 5, 3, "#1a1410", null); line(g, [[20, 20], [20, 28]], "#8e7638", 1.2); glowEye(g, 15.5, 16.5, "#9fd0f0"); glowEye(g, 24.5, 16.5, "#9fd0f0"); },
    falmer: (g) => { poly(g, [[9, 40], [12, 28], [28, 28], [31, 40]], "#5a5a48"); ell(g, 20, 19, 8, 11, "#c8c8b8"); poly(g, [[12, 16], [3, 8], [12, 13]], "#c8c8b8"); poly(g, [[28, 16], [37, 8], [28, 13]], "#c8c8b8"); line(g, [[14, 17], [18, 18]], "#7a7a68", 1.4); line(g, [[22, 18], [26, 17]], "#7a7a68", 1.4); poly(g, [[16, 24], [24, 24], [22, 27], [18, 27]], "#3a3a30"); },
  };
  function enemy(name, tags = [], size = 40) {
    const k = enemyKind(name, tags), elite = (tags || []).includes("elite");
    return ART.html(size, size, (g, H, w) => {
      g.scale(w / 40, w / 40); tile(g, true);
      g.save(); g.beginPath(); g.arc(20, 20, 18.5, 0, 7); g.clip();
      (FACES[k] || (typeof SOLART !== "undefined" && SOLART.FACES[k]) || FACES.humanoid)(g, name || "");
      g.restore();
      circ(g, 20, 20, 18.5, null, elite ? "#d6b25e" : "#6b5640", elite ? 2 : 1.2);
    }, { key: `e:${k}:${/frost|storm/i.test(name || "") ? name : ""}:${elite ? 1 : 0}`, cls: "ico eico", alt: "" });
  }
  return { item, enemy, enemyKind, drawItem };
})();
