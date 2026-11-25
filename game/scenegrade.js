/* scenegrade.js: time of day and weather laid over a painted mini-game scene. [OURS]
   The painted backdrops (fishing lake, hunting clearing) are painted at dusk. This grades them so the picture matches
   the clock and the sky: night goes dark blue (the painted sun covered, a moon and a few stars), day gets brighter and
   less orange, rain and storms go darker and greyer, fog goes pale and flat, snow goes cold. No new art, only canvas
   blending (multiply / screen / saturation) and soft overlays.
     SCENEGRADE.look(pos)                     → { night, wx } for a map spot right now (safe without a clock or weather)
     SCENEGRADE.grade(g, W, H, o)             grade what is drawn so far. o: night, wx, sun [x,y], moon [x,y], hz (horizon y),
                                              T (seconds), calm (no motion), moonPath (moon glints on water below the moon),
                                              soft (a lighter night, so a hunted animal still shows)
     SCENEGRADE.front(g, W, H, o)             falling rain or snow in front of everything (o: wx, T, calm, wind)
     SCENEGRADE.lamp(o)                       a canvas filter for things held close (a bow): darker at night, greyer in rain
   Everything is in the caller's drawing units. */
const SCENEGRADE = (() => {
  const WET = { rain: 1, storm: 1 }, COLD = { snow: 1, blizzard: 1 };
  function look(pos) {
    let night = false, wx = "clear";
    try { if (typeof G !== "undefined") night = !!G.isNight(); } catch { /* no clock */ }
    try { if (typeof WEVENTS !== "undefined" && pos) wx = WEVENTS.weather(pos).id || "clear"; } catch { /* no weather */ }
    return { night, wx };
  }
  const hash = (k) => { const v = Math.sin(k * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
  function fill(g, op, c, W, H, a = 1) { g.globalCompositeOperation = op; g.globalAlpha = a; g.fillStyle = c; g.fillRect(0, 0, W, H); }
  function glow(g, x, y, r, c, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  /* soft cloud bank: a row of overlapping glows */
  function clouds(g, x, y, w, c, a, T) {
    for (let k = 0; k < 6; k++) glow(g, x + (k - 2.5) * w / 5 + Math.sin(T * 0.05 + k) * 4, y + ((k * 7) % 5) - 2, w / 3.2, c, a);
  }
  function grade(g, W, H, o = {}) {
    const wx = o.wx || "clear", night = !!o.night, wet = !!WET[wx], cold = !!COLD[wx], fog = wx === "fog";
    const sun = o.sun || [W * 0.12, H * 0.12], hz = o.hz || H * 0.4, T = o.calm ? 0 : o.T || 0;
    g.save();
    // 1. take the dusk colour out: always a little, a lot in grey weather or at night
    fill(g, "saturation", "#808080", W, H, night ? 0.5 : wet ? 0.5 : fog ? 0.55 : cold ? 0.4 : 0.1);
    if (night) {
      // 2. cover the painted sun with dark cloud before anything else
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      glow(g, sun[0], sun[1], H * 0.5, "16,20,30", 0.85);
      clouds(g, sun[0] + W * 0.04, sun[1] + 4, W * 0.36, "22,26,36", 0.55, T);
      // 3. moonlight: deep blue and dark
      // soft: a lighter night where the player must still pick things out (the hunt's animal)
      fill(g, "multiply", o.soft ? (wet ? "#6a7487" : "#7a8ab2") : wet ? "#465063" : cold ? "#5a6680" : "#52648f", W, H);
      fill(g, "source-over", "#060a18", W, H, o.soft ? 0 : wet ? 0.25 : 0.12);
      if (cold) fill(g, "screen", "#1c2638", W, H, 0.6);   // snow on the ground keeps a little light
      if (fog) fill(g, "source-over", "#3c4452", W, H, 0.35);
      // 4. the moon (veiled when the sky is thick)
      const mo = o.moon;
      if (mo) {
        const veil = wet || cold || fog ? 0.35 : 1;
        g.globalCompositeOperation = "lighter";
        glow(g, mo[0], mo[1], H * 0.22, "150,170,205", 0.28 * veil);
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = veil; g.fillStyle = "#e8ecf2"; g.beginPath(); g.arc(mo[0], mo[1], H * 0.026, 0, 7); g.fill();
        g.fillStyle = "rgba(150,165,190,.4)"; g.beginPath(); g.arc(mo[0] + H * 0.009, mo[1] - H * 0.006, H * 0.021, 0, 7); g.fill();
        g.globalAlpha = 1;
        if (o.moonPath) {
          g.globalCompositeOperation = "lighter";
          for (let j = 0; j < 16; j++) {
            const y = o.moonPath + j * H * 0.02 + (j % 3), w = 4 + j * 0.9, x = mo[0] + Math.sin(j * 2.3 + T * 1.4) * (2 + j * 0.6);
            g.fillStyle = `rgba(205,218,238,${((0.1 + 0.12 * Math.max(0, Math.sin(T * 2 + j * 1.9))) * veil).toFixed(3)})`; g.fillRect(x - w / 2, y, w, 1.1);
          }
        }
      }
      // 5. stars in a clear sky
      if (!wet && !cold && !fog) {
        g.globalCompositeOperation = "lighter";
        for (let k = 0; k < 46; k++) {
          const x = (k * 137.5) % W, y = ((k * 61.3) % (hz * 0.78)), tw = 0.45 + 0.4 * Math.sin(T * (1 + (k % 5) * 0.4) + k);
          g.fillStyle = `rgba(225,232,245,${(tw * (k % 4 ? 0.5 : 0.9)).toFixed(3)})`; g.fillRect(x, y, k % 6 ? 0.8 : 1.3, k % 6 ? 0.8 : 1.3);
        }
      }
    } else if (wet) {
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      glow(g, sun[0], sun[1], H * 0.42, "90,96,106", 0.75);   // the sun behind rain cloud
      clouds(g, W * 0.5, hz * 0.3, W * 1.1, "70,76,88", 0.35, T);
      fill(g, "multiply", wx === "storm" ? "#7a828f" : "#959daa", W, H);
      fill(g, "source-over", "#3a414c", W, H, wx === "storm" ? 0.3 : 0.2);
    } else if (fog) {
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      glow(g, sun[0], sun[1], H * 0.4, "196,198,198", 0.7);
      fill(g, "multiply", "#bfc3c8", W, H);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, "rgba(196,198,200,.7)"); gr.addColorStop(hz / H, "rgba(200,202,204,.72)"); gr.addColorStop(1, "rgba(190,192,194,.3)");
      g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, 0, W, H);
    } else if (cold) {
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      glow(g, sun[0], sun[1], H * 0.4, "200,208,220", 0.6);
      fill(g, "multiply", "#c4d2ea", W, H);
      fill(g, "screen", "#4a5468", W, H, 0.45);
      fill(g, "source-over", "#dfe6f0", W, H, 0.1);
    } else {
      // clear day: the sun's orange turns to a pale white glare, the whole picture cooler and lighter
      g.globalCompositeOperation = "color"; g.globalAlpha = 1;
      glow(g, sun[0], sun[1], H * 0.55, "235,238,240", 0.7);
      glow(g, sun[0], 2 * hz - sun[1] + H * 0.08, H * 0.4, "225,232,238", 0.55);   // and its sunset path on the water / grass
      const sky = g.createLinearGradient(0, 0, 0, hz * 1.4);   // a blue sky above, fading out below the far shore
      sky.addColorStop(0, "rgba(110,150,205,.55)"); sky.addColorStop(0.75, "rgba(150,180,215,.25)"); sky.addColorStop(1, "rgba(150,180,215,0)");
      g.fillStyle = sky; g.fillRect(0, 0, W, hz * 1.4);
      fill(g, "multiply", "#e6eeff", W, H);
      fill(g, "screen", "#3c4652", W, H, 0.6);
      g.globalCompositeOperation = "lighter";
      glow(g, sun[0], sun[1], H * 0.2, "255,250,235", 0.18);
    }
    g.restore();
  }
  function front(g, W, H, o = {}) {
    const wx = o.wx, T = o.calm ? 0 : o.T || 0, wind = o.wind || 0;
    g.save();
    if (WET[wx]) {
      g.strokeStyle = "rgba(210,220,232,.32)"; g.lineWidth = 0.9; g.beginPath();
      for (let k = 0; k < (wx === "storm" ? 110 : 70); k++) {
        const r1 = hash(k), r2 = hash(k + 99), x = ((r1 * (W + 40) - T * 120 * (1 + wind * 0.3)) % (W + 40) + W + 40) % (W + 40) - 20, y = (r2 * H + T * (480 + r1 * 120)) % H;
        g.moveTo(x, y); g.lineTo(x - 5 - wind * 2, y + 14);
      }
      g.stroke();
    }
    if (COLD[wx]) {
      g.fillStyle = "#f6f6f4";
      for (let k = 0; k < (wx === "blizzard" ? 110 : 60); k++) {
        const z = 0.5 + (k % 5) / 4, x = ((k * 89 + T * (wx === "blizzard" ? 90 : 22 + wind * 8) * z + 14 * Math.sin(T * 0.8 + k)) % W + W) % W, y = (k * 41 + T * 34 * z) % H;
        g.globalAlpha = 0.45 + z * 0.35; g.beginPath(); g.arc(x, y, 0.45 + z * 0.55, 0, 7); g.fill();
      }
    }
    g.restore();
  }
  function lamp(o = {}) {
    if (o.night) return "brightness(.5) saturate(.6) hue-rotate(10deg)";
    if (WET[o.wx]) return "brightness(.78) saturate(.7)";
    if (o.wx === "fog") return "brightness(.9) saturate(.65)";
    if (COLD[o.wx]) return "brightness(.95) saturate(.75)";
    return "none";
  }
  return { look, grade, front, lamp };
})();
if (typeof module !== "undefined") module.exports = SCENEGRADE;
