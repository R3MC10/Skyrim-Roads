/* Pictures for the road encounters in encounters.js, painted with EVENTART's own kit (ink or pixel through ART).
   Each scene stands on EVENTART's backdrop (ground, time of day, weather). [OURS] */
(() => {
  if (typeof EVENTART === "undefined" || !EVENTART.kit) return;
  const { P, rnd, poly, rect, line, glow, fire, smoke, shadow, person, sleeper, tree, godSign, dragon, ZOOM } = EVENTART.kit;
  const R = EVENTART.ROAD;

  /* a four-legged animal side-on: horse, deer, dog, mammoth, boar */
  function beast(g, H, x, b, o = {}) {
    const s = o.s || 1, L = (o.len || 34) * s, Ht = (o.height || 22) * s, col = o.color || "#8a5a3b", f = o.face || 1;
    shadow(g, x, b + 1, L * 0.6);
    for (const lx of [-L * 0.38, -L * 0.2, L * 0.22, L * 0.4]) rect(g, H, x + lx * f - 2 * s, b - Ht * 0.55, 4 * s * (o.thick || 1), Ht * 0.55, col, P.ink, 0.9);
    poly(g, H, [[x - L / 2, b - Ht * 0.5], [x - L / 2 + 4 * s, b - Ht], [x + L / 2 - 4 * s, b - Ht], [x + L / 2, b - Ht * 0.5], [x + L / 2 - 3 * s, b - Ht * 0.42], [x - L / 2 + 3 * s, b - Ht * 0.42]].map(([px, py]) => [x + (px - x) * f, py]), col, P.ink, 1.1);
    const hx = x + (L / 2 + (o.neck || 6) * s) * f, hy = b - Ht - (o.headUp ?? 6) * s;
    line(g, [[x + (L / 2 - 6 * s) * f, b - Ht * 0.85], [hx, hy + 4 * s]], (o.neckW || 6) * s, col);
    H.circle(g, hx, hy, (o.head || 6) * s, col, P.ink, 1);
    g.fillStyle = P.ink; g.fillRect(hx + 1.5 * s * f, hy - 1.5 * s, 1.4 * s, 1.4 * s);
    if (o.mane) line(g, [[x + (L / 2 - 6 * s) * f, b - Ht - 1 * s], [hx - 2 * s * f, hy - 4 * s]], 2.4 * s, o.mane);
    if (o.horns) { line(g, [[hx - 2 * s * f, hy - 5 * s], [hx - 6 * s * f, hy - 15 * s], [hx - 2 * s * f, hy - 18 * s]], 1.4 * s, "#e9dcc0"); line(g, [[hx + 1 * s * f, hy - 5 * s], [hx + 3 * s * f, hy - 15 * s]], 1.4 * s, "#e9dcc0"); }
    if (o.trunk) { line(g, [[hx + 4 * s * f, hy + 2 * s], [hx + 9 * s * f, hy + 12 * s], [hx + 7 * s * f, hy + 20 * s]], 4 * s, col); line(g, [[hx + 3 * s * f, hy + 4 * s], [hx + 14 * s * f, hy + 8 * s], [hx + 18 * s * f, hy + 2 * s]], 2.2 * s, "#efe6d2"); }
    if (o.tusks) line(g, [[hx + 3 * s * f, hy + 3 * s], [hx + 8 * s * f, hy + 6 * s]], 1.6 * s, "#efe6d2");
    if (o.tail) line(g, [[x - (L / 2) * f, b - Ht * 0.85], [x - (L / 2 + 6 * s) * f, b - Ht * 0.5]], 2 * s, o.tailCol || col);
    if (o.fur) { g.fillStyle = "rgba(59,44,30,0.25)"; for (let i = 0; i < 8; i++) g.fillRect(x - L / 2 + i * L / 8, b - Ht * 0.48, 2 * s, 4 * s); }
  }
  function cart(g, H, x, b, s = 1, tipped = false) {
    if (tipped) { poly(g, H, [[x - 34 * s, b], [x - 30 * s, b - 22 * s], [x + 28 * s, b - 30 * s], [x + 34 * s, b - 6 * s]], P.wood, P.ink, 1.2); H.circle(g, x + 20 * s, b - 32 * s, 9 * s, null, P.ink, 2.2); H.circle(g, x - 18 * s, b - 4 * s, 9 * s, null, P.ink, 2.2); return; }
    rect(g, H, x - 32 * s, b - 22 * s, 64 * s, 14 * s, P.wood, P.ink, 1.2); H.circle(g, x - 20 * s, b - 6 * s, 8 * s, null, P.ink, 2.2); H.circle(g, x + 20 * s, b - 6 * s, 8 * s, null, P.ink, 2.2);
  }
  function crate(g, H, x, b, s = 1, col = P.wood) { rect(g, H, x - 7 * s, b - 12 * s, 14 * s, 12 * s, col, P.ink, 1); line(g, [[x - 7 * s, b - 12 * s], [x + 7 * s, b]], 0.8, P.inkSoft); }
  function tent(g, H, x, b, s, col) { poly(g, H, [[x - 26 * s, b], [x, b - 34 * s], [x + 26 * s, b]], col, P.ink, 1.2); poly(g, H, [[x - 5 * s, b], [x, b - 16 * s], [x + 5 * s, b]], "#2a2018", null); }
  function staffMan(g, H, x, b, o) { person(g, H, x, b, o); line(g, [[x - 9 * (o.s || 1) * (o.face || 1), b], [x - 9 * (o.s || 1) * (o.face || 1), b - 44 * (o.s || 1)]], 1.8, P.wood); }
  const sparkle = (g, x, y, rgb, r = 18) => glow(g, x, y, r, rgb, 0.6);
  const gold = "#d6b25e", thal = "#c9a24c", legion = "#8e2b25", cloaks = "#3f6a9a";

  Object.assign(R, {
    thalmor(g, H, w, h) {
      const b = h * 0.86;
      person(g, H, w * 0.36, b, { body: thal, legs: "#2e2a20", skin: "#e8d39a", hood: "#7a6a3a", cape: "#2e2a20", arm: "hold", s: 1.25 });
      person(g, H, w * 0.5, b + 1, { body: "#8a7a6a", legs: P.inkSoft, skin: P.skin[0], arm: "down", s: 1.15, face: -1 });   // the bound Nord
      line(g, [[w * 0.42, b - 26], [w * 0.47, b - 24]], 1, "#6b5640");
      person(g, H, w * 0.64, b, { body: thal, legs: "#2e2a20", skin: "#e8d39a", hood: "#7a6a3a", cape: "#2e2a20", arm: "wave", s: 1.25, face: -1 });
      sparkle(g, w * 0.64 - 14, b - 50, "230,140,60", 16);
    },
    khajiit(g, H, w, h) {
      const b = h * 0.86;
      tent(g, H, w * 0.22, b - 2, 1.1, "#a84a3a"); tent(g, H, w * 0.78, b - 4, 0.95, "#c48a3a");
      cart(g, H, w * 0.5, b, 1); for (let i = 0; i < 3; i++) crate(g, H, w * 0.43 + i * 14, b - 20, 0.9, ["#c4572e", "#d6b25e", "#557a47"][i]);
      person(g, H, w * 0.66, b, { body: "#b07a3a", legs: "#5a3a20", skin: "#c8a060", hood: "#8a5a2a", arm: "wave", s: 1.2, face: -1 });
      // ears and a tail for the Khajiit
      poly(g, H, [[w * 0.66 - 5, b - 45], [w * 0.66 - 3, b - 52], [w * 0.66 - 1, b - 45]], "#c8a060", P.ink, 0.8); line(g, [[w * 0.66 + 6, b - 14], [w * 0.66 + 16, b - 22], [w * 0.66 + 14, b - 30]], 2, "#c8a060");
      fire(g, H, w * 0.33, b + 2, 0.8, true);
    },
    courier(g, H, w, h) {
      const b = h * 0.86; person(g, H, w * 0.45, b, { body: "#6a7a8a", legs: P.inkSoft, skin: P.skin[1], hood: "#4a5a6a", arm: "hold", s: 1.3 });
      rect(g, H, w * 0.45 + 10, b - 32, 12, 8, "#efe6d2", P.ink, 0.9); H.circle(g, w * 0.45 + 16, b - 28, 1.8, P.blood, null);   // the sealed letter
      rect(g, H, w * 0.45 - 16, b - 30, 8, 14, P.leather, P.ink, 0.9);   // satchel
    },
    bard(g, H, w, h) {
      const b = h * 0.86; rect(g, H, w * 0.5 - 8, b - 14, 16, 14, P.stone, P.ink, 1);   // milestone
      person(g, H, w * 0.5, b - 12, { body: "#7a3a5a", legs: "#3a2a3a", skin: P.skin[0], sit: true, arm: "hold", s: 1.15 });
      H.circle(g, w * 0.5 + 10, b - 26, 5, P.wood, P.ink, 1); line(g, [[w * 0.5 + 13, b - 28], [w * 0.5 + 24, b - 38]], 1.6, P.wood);   // lute
      g.fillStyle = P.ink; g.font = "700 14px Georgia, serif"; g.fillText("♪", w * 0.6, h * 0.42); g.fillText("♫", w * 0.66, h * 0.32);
    },
    vigilant(g, H, w, h) {
      const b = h * 0.86;
      for (const [x, f] of [[0.4, 1], [0.6, -1]]) { person(g, H, w * x, b, { body: "#7a7a72", legs: "#4a4a44", skin: P.skin[0], hood: "#5a5a54", arm: "hold", s: 1.25, face: f }); }
      godSign(g, H, w * 0.4 + 7, h * 0.86 - 30, "Stendarr", 0.8); sparkle(g, w * 0.5, b - 30, "214,178,94", 30);
    },
    hunters(g, H, w, h) {
      const b = h * 0.86; fire(g, H, w * 0.24, b, 0.9, true); smoke(g, w * 0.24, b - 18);
      beast(g, H, w * 0.5, b, { color: "#9a6a3a", len: 30, height: 20, horns: true, headUp: -6, s: 1.1 });   // a deer laid on a frame
      person(g, H, w * 0.7, b, { body: "#5a6a3a", legs: P.inkSoft, skin: P.skin[1], hood: "#4a5a2a", arm: "spear", s: 1.2, face: -1 });
      person(g, H, w * 0.82, b, { body: "#6b5640", legs: P.inkSoft, skin: P.skin[0], hair: "#6b3a20", arm: "down", s: 1.1, face: -1 });
    },
    giant(g, H, w, h) {
      const b = h * 0.86;
      beast(g, H, w * 0.22, b, { color: "#6a4a32", len: 52, height: 40, head: 11, trunk: true, fur: true, s: 0.9, thick: 1.6 });
      beast(g, H, w * 0.42, b - 6, { color: "#5a3e2a", len: 44, height: 34, head: 10, trunk: true, fur: true, s: 0.75, thick: 1.6 });
      person(g, H, w * 0.7, b, { body: "#8a7a5a", legs: "#6a5a3a", skin: "#c8b8a0", hair: "#8a8070", arm: "hold", s: 2.1, face: -1 });
      line(g, [[w * 0.7 - 20, b - 50], [w * 0.7 - 30, b - 86]], 5, P.wood);   // his club
    },
    dragonfly(g, H, w, h) { dragon(g, H, w * 0.52, h * 0.32, 1.25); shadow(g, w * 0.5, h * 0.9, 60); },
    banditToll(g, H, w, h) {
      const b = h * 0.86; rect(g, H, w * 0.18, b - 10, w * 0.5, 10, P.wood, P.ink, 1.1);   // the log
      for (const [x, f, a] of [[0.72, -1, "hold"], [0.84, -1, "spear"], [0.62, -1, "wave"]]) person(g, H, w * x, b, { body: P.leather, legs: P.inkSoft, skin: P.skin[1], hood: x === 0.62 ? null : "#5a4632", hair: "#3a2a1a", arm: a, s: 1.2, face: f });
      H.circle(g, w * 0.3, b - 16, 4, P.gold, P.ink, 0.8);
    },
    escort(g, H, w, h, ev) {
      const b = h * 0.86, g1 = ev && ev.guards === "stormcloak" ? cloaks : legion, p1 = ev && ev.guards === "stormcloak" ? legion : cloaks;
      person(g, H, w * 0.3, b, { body: g1, legs: P.iron, skin: P.skin[0], helm: P.iron, arm: "spear", s: 1.2 });
      person(g, H, w * 0.5, b, { body: p1, legs: P.inkSoft, skin: P.skin[1], arm: "down", s: 1.15 }); line(g, [[w * 0.36, b - 24], [w * 0.45, b - 22]], 1, P.iron);
      person(g, H, w * 0.7, b, { body: g1, legs: P.iron, skin: P.skin[0], helm: P.iron, arm: "spear", s: 1.2, face: -1 });
    },
    wizard(g, H, w, h) {
      const b = h * 0.86; staffMan(g, H, w * 0.3, b, { body: "#4a3a7a", legs: "#2a2240", skin: P.skin[0], hood: "#3a2a6a", arm: "wave", s: 1.2 });
      const ax = w * 0.66, ay = b - 30; glow(g, ax, ay, 46, "232,146,58", 0.6);
      poly(g, H, [[ax - 10, ay + 20], [ax - 14, ay - 4], [ax, ay - 30], [ax + 14, ay - 4], [ax + 10, ay + 20], [ax, ay + 8]], P.fire, P.ink, 1); H.circle(g, ax, ay - 32, 6, "#f6d36a", P.ink, 1);
      for (let i = 0; i < 5; i++) fire(g, H, w * (0.45 + i * 0.05), b + 2, 0.4, true);
    },
    necro(g, H, w, h) {
      const b = h * 0.86;
      for (let i = 0; i < 5; i++) { const a = Math.PI + i / 4 * Math.PI; rect(g, H, w * 0.5 + Math.cos(a) * 60 - 4, b - 22 + Math.sin(a) * 6, 8, 22, P.stone, P.ink, 1); }
      sleeper(g, H, w * 0.5, b + 2, { body: "#6a6a60", skin: "#9aa08a", s: 1 }); glow(g, w * 0.5, b - 10, 50, "120,220,120", 0.45);
      staffMan(g, H, w * 0.72, b, { body: "#2a2a2a", legs: "#1a1a1a", skin: "#b8b0a0", hood: "#1a1a1a", cape: "#3a1a2a", arm: "wave", s: 1.2, face: -1 });
    },
    pilgrims(g, H, w, h) {
      const b = h * 0.86;
      for (const [x, c] of [[0.34, "#8a7a6a"], [0.48, "#7a6a5a"], [0.62, "#9a8a70"]]) staffMan(g, H, w * x, b, { body: c, legs: P.inkSoft, skin: P.skin[x > 0.5 ? 0 : 1], hood: "#6a5a4a", arm: "down", s: 1.1 });
      poly(g, H, [[w * 0.74, h * 0.6], [w * 0.88, h * 0.14], [w * 1.02, h * 0.6]], "#c8ccd0", P.ink, 1);   // the Throat of the World far off
    },
    dog(g, H, w, h) { const b = h * 0.86; fire(g, H, w * 0.3, b, 0.9, false); beast(g, H, w * 0.56, b, { color: "#8a6a48", len: 26, height: 18, head: 6, tail: true, s: 1.4, headUp: 2 }); },
    thugs(g, H, w, h) { const b = h * 0.86; for (const [x, f] of [[0.38, 1], [0.54, 1], [0.7, -1]]) person(g, H, w * x, b, { body: "#5a4a3a", legs: "#2e2a20", skin: P.skin[x === 0.54 ? 2 : 0], hair: "#2a1a10", arm: "hold", s: 1.25, face: f }); },
    assassin(g, H, w, h) {
      const b = h * 0.86; person(g, H, w * 0.55, b, { body: "#6a1a1a", legs: "#1a1414", skin: P.skin[0], hood: "#2a1414", cape: "#1a1414", arm: "hold", s: 1.35, face: -1 });
      line(g, [[w * 0.55 - 12, b - 32], [w * 0.55 - 22, b - 38]], 2, P.steel); poly(g, H, [[w * 0.22, h * 0.6], [w * 0.36, h * 0.3], [w * 0.4, h * 0.62]], P.rock, P.ink, 1.1);
      g.fillStyle = "rgba(10,6,6,0.25)"; g.fillRect(0, 0, w, h);
    },
    hagraven(g, H, w, h) {
      const b = h * 0.86; tree(g, H, w * 0.24, b, 1.5, "dead"); for (let i = 0; i < 4; i++) line(g, [[w * 0.2 + i * 6, b - 30], [w * 0.2 + i * 6, b - 20]], 1, "#efe6d2");
      person(g, H, w * 0.5, b, { body: "#4a3a3a", legs: "#2a2020", skin: "#8a8a7a", hair: "#2a2a2a", arm: "wave", s: 1.2 });
      for (let i = 0; i < 5; i++) line(g, [[w * 0.5 - 6, b - 30 + i * 2], [w * 0.5 - 14, b - 40 + i * 3]], 1.4, "#2a2a2a");   // feathers
      person(g, H, w * 0.72, b, { body: "#6b3a2a", legs: "#3a2a1a", skin: P.skin[0], hair: "#3a2010", arm: "spear", s: 1.1, face: -1 });
      fire(g, H, w * 0.36, b + 2, 0.7, true);
    },
    wildhorse(g, H, w, h) { beast(g, H, w * 0.52, h * 0.86, { color: "#8a5a3b", len: 36, height: 30, head: 7, mane: "#2a2018", tail: true, tailCol: "#2a2018", neck: 8, headUp: 10, s: 1.25 }); },
    cart(g, H, w, h) {
      const b = h * 0.86; cart(g, H, w * 0.42, b, 1.1, true); beast(g, H, w * 0.72, b + 2, { color: "#6a4a32", len: 34, height: 12, head: 6, headUp: -10, s: 1 });
      for (let i = 0; i < 3; i++) crate(g, H, w * (0.2 + i * 0.08), b + 4, 0.9);
    },
    wreck(g, H, w, h) {
      const b = h * 0.86; g.fillStyle = "rgba(48,80,94,0.75)"; g.fillRect(0, h * 0.62, w, h * 0.14);
      poly(g, H, [[w * 0.18, h * 0.7], [w * 0.28, h * 0.5], [w * 0.62, h * 0.48], [w * 0.7, h * 0.66]], "#5a4030", P.ink, 1.2); line(g, [[w * 0.42, h * 0.49], [w * 0.38, h * 0.14]], 2.4, P.wood);
      rect(g, H, w * 0.62, b - 14, 22, 14, "#6a4a2a", P.ink, 1.1); rect(g, H, w * 0.62 + 8, b - 9, 6, 5, P.iron, P.ink, 0.8); sparkle(g, w * 0.62 + 11, b - 10, "214,178,94", 14);
    },
    rare(g, H, w, h) {
      const b = h * 0.86; beast(g, H, w * 0.3, b, { color: "#ebe6da", len: 34, height: 28, head: 7, mane: "#d6b25e", tail: true, headUp: 8, s: 1.1 });
      person(g, H, w * 0.56, b, { body: "#3a4a8a", legs: "#2a2a3a", skin: P.skin[0], hair: "#6b3a20", cape: "#7a1a2a", arm: "hold", s: 1.25, face: -1 });
      H.circle(g, w * 0.56 - 12, b - 30, 5, "#bfe8ff", P.ink, 0.9); sparkle(g, w * 0.56 - 12, b - 30, "190,232,255", 20);
      person(g, H, w * 0.74, b, { body: P.iron, legs: P.iron, skin: P.skin[1], helm: P.iron, arm: "spear", s: 1.2, face: -1 });
    },
    stranger(g, H, w, h) { const b = h * 0.86; g.globalAlpha = 0.85; person(g, H, w * 0.5, b, { body: "#3a3a44", legs: "#2a2a30", skin: "#9a9aa0", hood: "#24242c", cape: "#24242c", arm: "down", s: 1.35 }); g.globalAlpha = 1; glow(g, w * 0.5, b - 40, 40, "160,160,220", 0.3); },
    wordrumour(g, H, w, h) {
      const b = h * 0.86; staffMan(g, H, w * 0.34, b, { body: "#6a5a4a", legs: P.inkSoft, skin: P.skin[0], hair: "#d8d8d0", arm: "wave", s: 1.2 });
      poly(g, H, [[w * 0.56, b], [w * 0.6, b - 60], [w * 0.86, b - 60], [w * 0.9, b]], P.stone, P.ink, 1.2);
      const r = rnd("wall"); g.strokeStyle = P.ink; g.lineWidth = 1; for (let i = 0; i < 18; i++) { const x = w * 0.62 + r() * w * 0.22, y = b - 54 + r() * 46; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 4); g.lineTo(x + 6, y); g.stroke(); }
    },
    herbpatch(g, H, w, h) {
      const b = h * 0.86, r = rnd("patch");
      for (let i = 0; i < 26; i++) { const x = w * 0.15 + r() * w * 0.7, y = b - 6 + r() * 12; line(g, [[x, y], [x, y - 8 - r() * 6]], 1.2, P.leaf); H.circle(g, x, y - 10 - r() * 6, 2.6, ["#7a6ad0", "#c4572e", "#e9a0b0", "#f4f0d8", "#6a9ad0"][i % 5], P.ink, 0.6); }
    },
    avalanche(g, H, w, h) {
      poly(g, H, [[0, h * 0.7], [w * 0.4, h * 0.08], [w * 0.9, h * 0.7]], "#dfe5ea", P.ink, 1.2);
      g.fillStyle = "rgba(255,255,255,0.85)"; const r = rnd("aval"); for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(w * 0.2 + r() * w * 0.6, h * 0.3 + r() * h * 0.45, 6 + r() * 12, 0, 7); g.fill(); }
      person(g, H, w * 0.82, h * 0.88, { body: P.leather, legs: P.inkSoft, skin: P.skin[0], arm: "wave", s: 1.1, face: -1 });
    },
    ashfall(g, H, w, h) {
      const b = h * 0.86; g.fillStyle = "rgba(70,64,58,0.35)"; g.fillRect(0, 0, w, h);
      for (const x of [0.4, 0.62]) { person(g, H, w * x, b, { body: "#4a4440", legs: "#3a3430", skin: "#6a625a", arm: "wave", s: 1.2 }); glow(g, w * x + 2, b - 42, 10, "232,146,58", 0.8); }
      const r = rnd("ash"); g.fillStyle = "rgba(90,84,78,0.6)"; for (let i = 0; i < 60; i++) g.fillRect(r() * w, r() * h, 2, 2);
    },
    riekraid(g, H, w, h) {
      const b = h * 0.86; cart(g, H, w * 0.3, b, 0.9); person(g, H, w * 0.42, b, { body: "#7a6a5a", legs: "#4a3a2a", skin: P.skin[0], hood: "#e9e2d0", arm: "spear", s: 1.2 });
      for (const x of [0.64, 0.78]) { beast(g, H, w * x, b, { color: "#5a4a3a", len: 26, height: 16, head: 6, tusks: true, s: 1, face: -1 }); person(g, H, w * x, b - 16, { body: "#6a8aa0", legs: "#4a6a80", skin: "#7a9ab0", helm: "#e9e2d0", arm: "spear", s: 0.7, face: -1 }); }
    },
    nightvamp(g, H, w, h) { const b = h * 0.86; g.fillStyle = "rgba(14,16,28,0.45)"; g.fillRect(0, 0, w, h); person(g, H, w * 0.52, b, { body: "#2a1a24", legs: "#1a1218", skin: "#d8d0d8", hair: "#1a1a1a", cape: "#5a0a14", arm: "down", s: 1.35 }); g.fillStyle = "#ff4a3a"; g.fillRect(w * 0.52 + 2, b - 54, 2, 2); },
    wisp(g, H, w, h) { const b = h * 0.86, r = rnd("wisp"); for (let i = 0; i < 6; i++) glow(g, w * 0.25 + r() * w * 0.5, h * 0.3 + r() * h * 0.4, 14, "150,200,255", 0.8); g.globalAlpha = 0.55; person(g, H, w * 0.58, b - 6, { body: "#bcd8f0", legs: "#9ab8d8", skin: "#e0f0ff", hair: "#d0e8ff", arm: "wave", s: 1.3 }); g.globalAlpha = 1; },
    lost(g, H, w, h) { const b = h * 0.86; person(g, H, w * 0.5, b, { body: "#8a6a3a", legs: P.inkSoft, skin: P.skin[1], hair: "#8a5a2a", arm: "hold", s: 1.25 }); rect(g, H, w * 0.5 + 8, b - 34, 16, 12, "#e9dcc0", P.ink, 0.9); line(g, [[w * 0.36, b], [w * 0.36, b - 40]], 2, P.wood); rect(g, H, w * 0.33, b - 42, 22, 6, P.wood, P.ink, 0.9); },
    mudcrab(g, H, w, h) {
      const x = w * 0.52, b = h * 0.86; rect(g, H, x - 26, b - 10, 52, 10, P.rock, P.ink, 1);
      g.save(); g.translate(x, b - 16); H.circle(g, 0, 0, 14, "#8a7a5a", P.ink, 1.1); for (const s of [-1, 1]) { line(g, [[12 * s, -2], [24 * s, -10]], 2.4, "#8a7a5a"); H.circle(g, 26 * s, -12, 5, "#8a7a5a", P.ink, 0.9); } g.fillStyle = P.ink; g.fillRect(-4, -12, 2, 2); g.fillRect(3, -12, 2, 2); g.restore();
      H.circle(g, x + 34, b - 4, 4, P.gold, P.ink, 0.8);
    },
  });
  Object.assign(ZOOM, { thalmor: 1.35, khajiit: 1.2, courier: 1.5, bard: 1.5, vigilant: 1.4, hunters: 1.3, giant: 1.1, banditToll: 1.3, escort: 1.35, wizard: 1.25, necro: 1.2,
    pilgrims: 1.3, dog: 1.6, thugs: 1.4, assassin: 1.4, hagraven: 1.3, wildhorse: 1.4, cart: 1.3, wreck: 1.15, rare: 1.3, stranger: 1.45, wordrumour: 1.25, herbpatch: 1.5,
    riekraid: 1.3, nightvamp: 1.45, wisp: 1.3, lost: 1.5, mudcrab: 1.8, ashfall: 1.3 });
})();
