/* Pictures for the Dwemer deep-dive (dwemer.js, blackreach.js) [OURS]: the Blackreach map (a glowing cavern with the
   eight spots joined by paths) and four story scenes for quest popups: a Dwemer ruin with brass towers, the lexicon on
   Calcelmo's table, the glowing cavern of Blackreach, and the Centurion master. Drawn in code with the same kit as the
   other scenes, so ink and pixel styles both work (ART does the pixel filter). */
const DWART = (() => {
  if (typeof EVENTART === "undefined" || typeof ART === "undefined") return { storyKind: () => null, reachMap: () => "" };
  const { P, rnd, poly, rect, line, glow, person, dragon } = EVENTART.kit;
  const BRASS = "#b8863a", BRASS2 = "#8a6a32", DARK = "#1c1a22";

  function cavern(g, H, w, h, seed) {   // dark rock, a roof of stalactites, a far glow
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#14141c"); gr.addColorStop(1, "#26303a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rnd(seed);
    for (let i = 0; i < 14; i++) { const x = r() * w, ww = 6 + r() * 14, hh = 10 + r() * 30; poly(g, H, [[x - ww, 0], [x, hh], [x + ww, 0]], "#20202a", P.ink, 0.8); }
  }
  function mushroom(g, H, x, base, s, col = "#4ad0c8") {
    glow(g, x, base - 26 * s, 34 * s, col === "#4ad0c8" ? "74,208,200" : "120,220,120", 0.4);
    rect(g, H, x - 2.5 * s, base - 26 * s, 5 * s, 26 * s, "#c8c0a8", P.ink, 0.8);
    poly(g, H, [[x - 16 * s, base - 22 * s], [x - 10 * s, base - 32 * s], [x, base - 35 * s], [x + 10 * s, base - 32 * s], [x + 16 * s, base - 22 * s]], col, P.ink, 1);
  }
  function tower(g, H, x, base, s, lit) {   // a Dwemer tower: brass shaft, cap and pipes
    rect(g, H, x - 9 * s, base - 70 * s, 18 * s, 70 * s, BRASS2, P.ink, 1);
    poly(g, H, [[x - 14 * s, base - 70 * s], [x, base - 84 * s], [x + 14 * s, base - 70 * s]], BRASS, P.ink, 1);
    line(g, [[x - 9 * s, base - 40 * s], [x - 20 * s, base - 40 * s], [x - 20 * s, base]], 1.5);
    if (lit) { g.fillStyle = "#f0c060"; g.fillRect(x - 3 * s, base - 60 * s, 6 * s, 8 * s); }
  }
  function centurion(g, H, x, base, s) {
    poly(g, H, [[x - 18 * s, base], [x - 14 * s, base - 40 * s], [x + 14 * s, base - 40 * s], [x + 18 * s, base]], BRASS2, P.ink, 1.2);   // legs
    rect(g, H, x - 26 * s, base - 86 * s, 52 * s, 48 * s, BRASS, P.ink, 1.3);   // body
    H.circle(g, x, base - 64 * s, 10 * s, "#f0a040", P.ink, 1); glow(g, x, base - 64 * s, 30 * s, "240,160,64", 0.5);   // the dynamo heart
    rect(g, H, x - 12 * s, base - 104 * s, 24 * s, 18 * s, BRASS2, P.ink, 1.2); g.fillStyle = "#ffd070"; g.fillRect(x - 7 * s, base - 98 * s, 14 * s, 4 * s);   // the head
    rect(g, H, x - 40 * s, base - 84 * s, 12 * s, 44 * s, BRASS2, P.ink, 1); poly(g, H, [[x + 28 * s, base - 84 * s], [x + 50 * s, base - 50 * s], [x + 42 * s, base - 46 * s], [x + 28 * s, base - 70 * s]], "#8a8f94", P.ink, 1);   // arms: hammer and axe
    for (let i = 0; i < 3; i++) glow(g, x - 20 * s + i * 20 * s, base - 110 * s - i * 6, 18 * s, "220,220,220", 0.25);   // steam
  }

  /* the Blackreach map: one painted cavern, the spots and paths on top (buttons sit over it in blackreach.js) */
  function reachMap(s) {
    const N = BLACKREACH.NODES, W = 360, Hh = 240, open = (k) => !N[k].needs || s[N[k].needs];
    const key = `brmap|${s.dwMzark ? 1 : 0}`;
    return ART.html(W, Hh, (g, H, w, h) => {
      cavern(g, H, w, h, "brmap");
      const r = rnd("brfloor");
      for (let i = 0; i < 9; i++) mushroom(g, H, r() * w, 40 + r() * (h - 40), 0.5 + r() * 0.4, i % 3 ? "#4ad0c8" : "#7ad070");
      glow(g, w * 0.83, h * 0.05, 60, "246,211,106", 0.55); H.circle(g, w * 0.83, h * 0.03, 10, "#f6d36a", P.ink, 1);   // the great orb
      tower(g, H, w * 0.59, h * 0.3, 0.45, true); tower(g, H, w * 0.64, h * 0.32, 0.35, false); tower(g, H, w * 0.83, h * 0.17, 0.5, true);
      g.setLineDash([4, 4]);
      for (const a of Object.keys(N)) for (const b of N[a].links) if (a < b) {
        g.strokeStyle = open(a) && open(b) ? "rgba(240,200,120,0.75)" : "rgba(160,160,160,0.35)"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(N[a].x * w, N[a].y * h); g.lineTo(N[b].x * w, N[b].y * h); g.stroke();
      }
      g.setLineDash([]);
    }, { key, cls: "br-art", alt: "Map of Blackreach" });
  }

  Object.assign(EVENTART.STORY, {
    dwRuin(g, H, w, h) {   // a Dwemer ruin: brass towers in a mountain hall, steam
      cavern(g, H, w, h, "dwr"); rect(g, H, 0, h * 0.82, w, h * 0.18, "#4a4440", P.ink, 1);
      tower(g, H, w * 0.25, h * 0.84, 1, true); tower(g, H, w * 0.7, h * 0.84, 1.2, true); tower(g, H, w * 0.48, h * 0.84, 0.7, false);
      person(g, H, w * 0.4, h * 0.97, { body: "#6f6a64", legs: "#4a3a2a", skin: P.skin[0], s: 0.9, arm: "down" });
    },
    dwLexicon(g, H, w, h) {   // the lexicon on Calcelmo's table, lit by a candle
      H.sky(g, w, h, "cave"); rect(g, H, w * 0.15, h * 0.62, w * 0.7, h * 0.08, "#6a4a2a", P.ink, 1.2);
      glow(g, w * 0.5, h * 0.5, 70, "122,208,192", 0.5); rect(g, H, w * 0.46, h * 0.46, w * 0.08, w * 0.08, "#c9a24a", P.ink, 1.2);
      rect(g, H, w * 0.3, h * 0.58, w * 0.1, h * 0.04, "#e8dcc0", P.ink, 0.8);
      person(g, H, w * 0.75, h * 0.98, { body: "#5a3a6a", legs: "#3a2a3a", skin: P.skin[0], s: 1, face: -1, arm: "down" });
    },
    dwReach(g, H, w, h) {   // Blackreach: the glowing cavern and the Tower of Mzark's orb
      cavern(g, H, w, h, "dwb"); glow(g, w * 0.7, h * 0.12, 80, "246,211,106", 0.55); H.circle(g, w * 0.7, h * 0.1, 12, "#f6d36a", P.ink, 1);
      rect(g, H, 0, h * 0.84, w, h * 0.16, "#2a3a3a", P.ink, 1);
      for (const [x, s, c] of [[0.12, 1.2, "#4ad0c8"], [0.3, 0.8, "#7ad070"], [0.86, 1.1, "#4ad0c8"], [0.55, 0.6, "#4ad0c8"]]) mushroom(g, H, w * x, h * 0.86, s, c);
      tower(g, H, w * 0.7, h * 0.86, 0.9, true);
      person(g, H, w * 0.42, h * 0.97, { body: "#6f6a64", legs: "#4a3a2a", skin: P.skin[0], s: 0.85, arm: "down" });
    },
    dwCenturion(g, H, w, h) {   // the Centurion master at the Great Dynamo
      cavern(g, H, w, h, "dwc"); rect(g, H, 0, h * 0.86, w, h * 0.14, "#3a3430", P.ink, 1);
      H.circle(g, w * 0.2, h * 0.5, 40, null, BRASS2, 6); H.circle(g, w * 0.2, h * 0.5, 22, null, BRASS2, 4);   // the dynamo wheel
      centurion(g, H, w * 0.62, h * 0.88, 1);
      person(g, H, w * 0.3, h * 0.97, { body: "#6f6a64", legs: "#4a3a2a", skin: P.skin[0], s: 0.8, arm: "up" });
    },
    dwDragon(g, H, w, h) {   // Vulthuryol rises from the dark under the Tower of Mzark
      cavern(g, H, w, h, "dwd"); mushroom(g, H, w * 0.1, h * 0.9, 1); mushroom(g, H, w * 0.9, h * 0.9, 0.9, "#7ad070");
      if (dragon) dragon(g, H, w * 0.5, h * 0.4, 1, "#2a2226");
      tower(g, H, w * 0.78, h * 0.9, 0.8, true);
    },
  });

  /* which scene fits a popup about the Dwemer line */
  function storyKind(t = "", x = "") {
    const all = `${t} ${x}`;
    if (!/Calcelmo|Dwemer|Blackreach|Mzark|Centurion|Mzinchaleft|Raldbthar|Alftand|lexicon|Lexicon|Vulthuryol|Great Dynamo/.test(all)) return null;
    if (/Vulthuryol/.test(all)) return "dwDragon";
    if (/Centurion|Great Dynamo|Heart of the Deep/.test(all)) return "dwCenturion";
    if (/Blackreach|Mzark|great lift|Great Lift/.test(all)) return "dwReach";
    if (/lexicon|Lexicon|Calcelmo/.test(all)) return "dwLexicon";
    return "dwRuin";
  }
  return { storyKind, reachMap, centurion, tower, mushroom };
})();
/* achievement icons: the lexicon's brass cog (the Journal emblem) and the great orb with a dragon's wing across it */
if (typeof UIART !== "undefined" && UIART.ACH) {
  if (typeof DWEMER !== "undefined") UIART.ACH.dw_lexicon = (g) => DWEMER.emblem(g);
  UIART.ACH.dw_dragon = (g) => {
    const ink = "#1a120a"; g.lineJoin = "round"; g.strokeStyle = ink; g.lineWidth = 1.2;
    g.fillStyle = "#3a8a7c"; g.beginPath(); g.arc(20, 20, 14, 0, Math.PI * 2); g.fill(); g.stroke();   // the glowing orb
    g.fillStyle = "#9ae8d8"; g.beginPath(); g.arc(16, 15, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2a1a14"; g.beginPath(); g.moveTo(4, 30); g.quadraticCurveTo(12, 18, 20, 22); g.lineTo(24, 12); g.lineTo(27, 21);
    g.lineTo(32, 14); g.lineTo(33, 23); g.quadraticCurveTo(28, 30, 20, 28); g.quadraticCurveTo(12, 28, 4, 30); g.closePath(); g.fill(); g.stroke();   // a wing
  };
}
