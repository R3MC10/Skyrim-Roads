/* Pictures for the vampire war (dawnguard.js) [OURS]: Fort Dawnguard and Castle Volkihar as places (PLACEART), and five
   story scenes for quest popups (EVENTART.STORY): the coffin in Dimhollow Crypt, Castle Volkihar under a red moon,
   the hunters' fort, the Vampire Lord, and sunrise after Harkon falls. Drawn in code with the same kit as the other
   scenes, so ink and pixel styles both work (ART does the pixel filter). */
const DGART = (() => {
  if (typeof EVENTART === "undefined" || typeof PLACEART === "undefined") return { storyKind: () => null };
  const { P, rnd, poly, rect, line, glow, person } = EVENTART.kit;
  const VAMP = { body: "#2a1e26", legs: "#1a1418", skin: "#d8d0cc", hood: "#3a1e2a" }, HUNTER = { body: "#6f6a64", legs: "#4a3a2a", skin: P.skin[0], helm: "#8a8f94", cape: "#7a2a22" };

  function ground(g, H, w, h, y, col) { poly(g, H, [[0, y], [w * 0.3, y - 4], [w * 0.6, y + 2], [w, y - 3], [w, h], [0, h]], col, P.ink, 1.1); }
  function sea(g, w, y1, y2, night) {
    const gr = g.createLinearGradient(0, y1, 0, y2); gr.addColorStop(0, night ? "#2a3a48" : P.water); gr.addColorStop(1, night ? "#141c24" : P.sea); g.fillStyle = gr; g.fillRect(0, y1, w, y2 - y1);
    g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = 1; for (let i = 0; i < 10; i++) { const x = (i * 53) % w, y = y1 + 5 + (i * 17) % Math.max(5, y2 - y1 - 8); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 16, y); g.stroke(); }
  }
  function moon(g, H, x, y, r, col = "#c8343a") { glow(g, x, y, r * 3, "200,52,58", 0.35); H.circle(g, x, y, r, col, P.ink, 1); }
  function bats(g, H, x, y, n, seed) {
    const r = rnd(seed);
    for (let i = 0; i < n; i++) { const bx = x + (r() - 0.5) * 120, by = y + (r() - 0.5) * 40, s = 0.6 + r() * 0.6;
      poly(g, H, [[bx, by], [bx - 7 * s, by - 4 * s], [bx - 4 * s, by + 1 * s], [bx - 9 * s, by + 2 * s], [bx, by + 3 * s], [bx + 9 * s, by + 2 * s], [bx + 4 * s, by + 1 * s], [bx + 7 * s, by - 4 * s]], "#1a1216", null); }
  }
  /* Castle Volkihar: a black keep on a sea rock, two spires, a lit window or two */
  function castle(g, H, cx, base, s, ruined) {
    poly(g, H, [[cx - 80 * s, base], [cx - 60 * s, base - 22 * s], [cx - 20 * s, base - 30 * s], [cx + 30 * s, base - 28 * s], [cx + 70 * s, base - 18 * s], [cx + 86 * s, base]], "#4a4246", P.ink, 1.2);   // the rock
    rect(g, H, cx - 44 * s, base - 70 * s, 88 * s, 44 * s, "#2a2226", P.ink, 1.2);
    for (const [dx, hh] of [[-44, 96], [36, 110], [-6, 82]]) {
      rect(g, H, cx + dx * s, base - hh * s, 12 * s, (hh - 26) * s, "#241c20", P.ink, 1);
      if (!ruined || dx !== 36) poly(g, H, [[cx + (dx - 3) * s, base - hh * s], [cx + (dx + 6) * s, base - (hh + 22) * s], [cx + (dx + 15) * s, base - hh * s]], "#1a1418", P.ink, 1);
    }
    g.fillStyle = ruined ? "#5a4a3a" : "#d8504a"; for (const [dx, dy] of [[-30, 56], [-12, 50], [14, 58], [26, 48]]) g.fillRect(cx + dx * s, base - dy * s, 4 * s, 6 * s);
    rect(g, H, cx - 8 * s, base - 40 * s, 16 * s, 14 * s, "#120c0e", P.ink, 1);   // the gate
  }
  /* Fort Dawnguard: grey walls in a canyon, a round keep, sun banners */
  function fort(g, H, w, base, s) {
    poly(g, H, [[0, base], [0, base - 90 * s], [60 * s, base - 70 * s], [90 * s, base - 30 * s]], "#7d7468", P.ink, 1.2);   // canyon walls
    poly(g, H, [[w, base], [w, base - 96 * s], [w - 70 * s, base - 72 * s], [w - 96 * s, base - 30 * s]], "#7d7468", P.ink, 1.2);
    const x0 = w * 0.25, x1 = w * 0.75;
    rect(g, H, x0, base - 34 * s, x1 - x0, 34 * s, "#8a8f94", P.ink, 1.2);
    for (let x = x0; x < x1 - 5; x += 11 * s) rect(g, H, x, base - 39 * s, 6 * s, 5 * s, "#8a8f94", P.ink, 0.9);
    rect(g, H, w * 0.44, base - 70 * s, 32 * s, 70 * s, "#7b8086", P.ink, 1.2);   // the keep
    for (let i = 0; i < 4; i++) rect(g, H, w * 0.44 - 2 + i * 9 * s, base - 75 * s, 5 * s, 5 * s, "#7b8086", P.ink, 0.9);
    rect(g, H, w * 0.44 + 10 * s, base - 22 * s, 12 * s, 22 * s, "#3a2c1e", P.ink, 1);
    for (const bx of [x0 + 6, w * 0.44 + 16 * s, x1 - 6]) sunBanner(g, H, bx, base - (bx === x0 + 6 || bx === x1 - 6 ? 39 : 75) * s, s);
  }
  function sunBanner(g, H, x, y, s = 1) {
    line(g, [[x, y], [x, y - 24 * s]], 1.2, P.ink);
    rect(g, H, x, y - 24 * s, 12 * s, 14 * s, "#7a2a22", P.ink, 0.9);
    H.circle(g, x + 6 * s, y - 17 * s, 3 * s, "#f0c050", P.ink, 0.6);
  }
  function crossbowman(g, H, x, base, s = 1, face = 1) {
    person(g, H, x, base, { ...HUNTER, s, face, arm: "hold" });
    const hx = x + 7 * s * face, hy = base - 26 * s;
    line(g, [[hx - 2 * s * face, hy + 2 * s], [hx + 12 * s * face, hy - 2 * s]], 2.2 * s, P.wood);   // the stock
    line(g, [[hx + 9 * s * face, hy - 8 * s], [hx + 11 * s * face, hy + 4 * s]], 1.8 * s, P.steel);   // the bow
  }
  function troll(g, H, x, base, s = 1) {
    poly(g, H, [[x - 14 * s, base], [x - 18 * s, base - 30 * s], [x - 8 * s, base - 46 * s], [x + 10 * s, base - 46 * s], [x + 18 * s, base - 30 * s], [x + 14 * s, base]], "#d8d4cc", P.ink, 1.1);   // white fur
    rect(g, H, x - 13 * s, base - 40 * s, 26 * s, 18 * s, "#6f6a64", P.ink, 1);   // armour plate
    H.circle(g, x, base - 50 * s, 8 * s, "#d8d4cc", P.ink, 1);
    g.fillStyle = "#e8923a"; for (const dx of [-3, 0, 3]) g.fillRect(x + dx * s - 1, base - 52 * s, 2, 2);   // three eyes
  }
  function lord(g, H, x, base, s = 1) {
    poly(g, H, [[x, base - 50 * s], [x - 70 * s, base - 86 * s], [x - 56 * s, base - 56 * s], [x - 80 * s, base - 50 * s], [x - 44 * s, base - 34 * s], [x - 10 * s, base - 30 * s]], "#2a1e26", P.ink, 1.1);   // left wing
    poly(g, H, [[x, base - 50 * s], [x + 70 * s, base - 86 * s], [x + 56 * s, base - 56 * s], [x + 80 * s, base - 50 * s], [x + 44 * s, base - 34 * s], [x + 10 * s, base - 30 * s]], "#2a1e26", P.ink, 1.1);
    poly(g, H, [[x - 12 * s, base], [x - 14 * s, base - 46 * s], [x - 6 * s, base - 58 * s], [x + 6 * s, base - 58 * s], [x + 14 * s, base - 46 * s], [x + 12 * s, base]], "#4a3a44", P.ink, 1.1);
    H.circle(g, x, base - 64 * s, 8 * s, "#6a5a66", P.ink, 1);
    poly(g, H, [[x - 6 * s, base - 70 * s], [x - 9 * s, base - 82 * s], [x - 2 * s, base - 71 * s]], "#4a3a44", P.ink, 0.8); poly(g, H, [[x + 6 * s, base - 70 * s], [x + 9 * s, base - 82 * s], [x + 2 * s, base - 71 * s]], "#4a3a44", P.ink, 0.8);
    g.fillStyle = "#ff4040"; g.fillRect(x - 4 * s, base - 66 * s, 2.4 * s, 2 * s); g.fillRect(x + 1.6 * s, base - 66 * s, 2.4 * s, 2 * s);
    glow(g, x, base - 66 * s, 14 * s, "255,64,64", 0.35);
  }

  // ---- places
  PLACEART.CITY["Castle Volkihar"] = (g, H, w, h) => {
    sea(g, w, h * 0.6, h, true); bats(g, H, w * 0.6, h * 0.2, 7, "vbats");
    castle(g, H, w * 0.55, h * 0.78, 0.9, false);
    line(g, [[0, h * 0.9], [w * 0.22, h * 0.82]], 3, "rgba(200,190,170,0.6)");   // the wading path out to the rock
  };
  PLACEART.CITY["Fort Dawnguard"] = (g, H, w, h) => {
    ground(g, H, w, h, h * 0.78, "#a88a4e");
    fort(g, H, w, h * 0.8, 1);
    crossbowman(g, H, w * 0.18, h * 0.95, 0.8, 1); troll(g, H, w * 0.84, h * 0.97, 0.7);
  };

  // ---- story scenes
  Object.assign(EVENTART.STORY, {
    dgCrypt(g, H, w, h) {   // Dimhollow Crypt: the ring of stone and the sealed coffin opening
      H.sky(g, w, h, "cave"); rect(g, H, 0, h * 0.78, w, h * 0.22, "#4a4440", P.ink, 1);
      for (let i = 0; i < 7; i++) { const a = Math.PI + i * Math.PI / 6, x = w * 0.5 + Math.cos(a) * 110, y = h * 0.78 + Math.sin(a) * 30; rect(g, H, x - 6, y - 40, 12, 40, "#6f6a64", P.ink, 1); }
      glow(g, w * 0.5, h * 0.55, 70, "200,52,58", 0.45);
      poly(g, H, [[w * 0.44, h * 0.82], [w * 0.42, h * 0.4], [w * 0.47, h * 0.3], [w * 0.53, h * 0.3], [w * 0.58, h * 0.4], [w * 0.56, h * 0.82]], "#3a2e2e", P.ink, 1.2);   // the coffin, standing
      person(g, H, w * 0.5, h * 0.8, { ...VAMP, s: 1.1, arm: "down" });   // Serana steps out
      g.fillStyle = "#ff4040"; g.fillRect(w * 0.5 + 1, h * 0.8 - 41, 2, 1.6);
      rect(g, H, w * 0.5 - 9, h * 0.8 - 34, 4, 16, "#c9a24a", P.ink, 0.8);   // the Elder Scroll on her back
    },
    dgCastle(g, H, w, h) {   // Castle Volkihar under a red moon
      H.sky(g, w, h, "night"); moon(g, H, w * 0.78, h * 0.22, 16); bats(g, H, w * 0.5, h * 0.25, 9, "dgc");
      sea(g, w, h * 0.66, h, true); castle(g, H, w * 0.42, h * 0.82, 1, false);
      person(g, H, w * 0.85, h * 0.96, { ...HUNTER, s: 0.8, face: -1, arm: "down" }); person(g, H, w * 0.79, h * 0.96, { ...VAMP, s: 0.8, face: -1, arm: "down" });
    },
    dgFort(g, H, w, h) {   // the hunters at Fort Dawnguard
      H.sky(g, w, h, "dusk"); ground(g, H, w, h, h * 0.8, "#a88a4e"); fort(g, H, w, h * 0.82, 1.05);
      crossbowman(g, H, w * 0.2, h * 0.97, 1, 1); crossbowman(g, H, w * 0.32, h * 0.98, 0.9, 1); troll(g, H, w * 0.82, h * 0.98, 0.9);
    },
    dgLord(g, H, w, h) {   // Harkon's gift: the Vampire Lord
      H.sky(g, w, h, "night"); moon(g, H, w * 0.5, h * 0.3, 26); bats(g, H, w * 0.5, h * 0.2, 12, "dgl");
      rect(g, H, 0, h * 0.84, w, h * 0.16, "#2a2226", P.ink, 1); lord(g, H, w * 0.5, h * 0.88, 1.2);
    },
    dgDawn(g, H, w, h) {   // Harkon is dead and the sun comes back
      H.sky(g, w, h, "dusk"); glow(g, w * 0.7, h * 0.6, 120, "246,211,106", 0.6); H.circle(g, w * 0.7, h * 0.62, 20, "#f6d36a", P.ink, 1);
      sea(g, w, h * 0.66, h, false); castle(g, H, w * 0.32, h * 0.84, 0.9, true);
      crossbowman(g, H, w * 0.8, h * 0.98, 0.9, -1); sunBanner(g, H, w * 0.9, h * 0.98, 1.4);
    },
  });

  /* which scene fits a popup about the vampire war */
  function storyKind(t = "", x = "") {
    const all = `${t} ${x}`;
    if (!/Dawnguard|Volkihar|Harkon|Serana|Isran|Dimhollow/.test(all)) return null;
    if (/Destroying the Dawnguard|The Gift|Vampire Lord|Harkon's blood|Lord of Volkihar/.test(all)) return "dgLord";
    if (/Kindred Judgment|Hero of the Dawnguard|Hunt the Night complete/.test(all)) return "dgDawn";
    if (/Dimhollow|coffin|Awakening”|A New Order/.test(all)) return "dgCrypt";
    if (/Castle Volkihar|Bloodline|Chasing Echoes|Harkon/.test(all)) return "dgCastle";
    return "dgFort";
  }
  return { storyKind, castle, fort, lord, troll };
})();
/* achievement icons for the two endings: the Journal emblems (a sun shield, a red moon and bat) */
if (typeof UIART !== "undefined" && UIART.ACH && typeof DAWNGUARD !== "undefined") {
  UIART.ACH.dg_dawnguard = (g) => DAWNGUARD.emblem(g, "dg_dawnguard");
  UIART.ACH.dg_volkihar = (g) => DAWNGUARD.emblem(g, "dg_volkihar");
}
