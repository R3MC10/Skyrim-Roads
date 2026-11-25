/* RIGGEAR: the weapons and shields the painted fighters (rig.js) hold. [OURS]
   Shaded, not flat: a blade has a gradient across its width, a bright edge and a dark fuller; hafts show wood grain;
   a shield is planks with grain, an iron rim with rivets and a domed boss; everything casts a soft shadow.

   Painted pictures win when they are there (rig-w-<pic>.webp in the game folder); until one loads, or for gear with no
   picture (warhammer spear club crossbow), the shaded drawings below are used, so nothing is ever missing.
   Pictures we have (side view, transparent, trimmed): sword (steel) sword-iron dagger greatsword axe battleaxe mace staff,
   bow (relaxed, with its string) bow-drawn (full draw, arrow nocked), shield shield-side (round wood, front / edge-on),
   shield-kite shield-kite-side (steel kite), arrow (spare).
     weapons   lying flat, pointing right (tip at the right edge, pommel or butt at the left); PIV[pic] = where the hand
               closes (fractions of width, height: the middle of the leather wrap); drawn SPAN[kind] units long (the fight
               figures are ~61 units tall), height to scale, then turned to the drawing's tip angle (TIP)
     bow       standing up, belly right, string left; the riser at BOWPIC.*.riser of the width, half the height. The drawn
               picture is stretched sideways so its nock sits where the string hand is; the two cross-fade while drawing
     shield    front view on the forearm, or the edge-on view (face to the right) when the arm is turned away
   Gear made of a coloured stuff (glass, ebony, elven ...) gets the picture tinted that colour (cached per colour).

     RIGGEAR.weapon(g, sp, wk, st, o)   in the hand's frame (grip at 0,0, same tips as figart.js) · o: glow, plain,
                                        pull (bow string, units back from the riser), arrow (an arrow on the string)
     RIGGEAR.shield(g, sp, front, st)   on the forearm (at 0,0)
     RIGGEAR.sprite(kind)               the painted picture when it has loaded, else null */
const RIGGEAR = (() => {
  const TAU = Math.PI * 2;
  const TIP = { dagger: [10, -8], sword: [20, -20], greatsword: [28, -28], axe: [19, -16], battleaxe: [28, -22], mace: [16, -16], warhammer: [18, -18], spear: [32, -30], club: [18, -24], staff: [10, -32] };
  const GRIP = { sword: 0.16, dagger: 0.26, greatsword: 0.18, axe: 0.12, battleaxe: 0.12, mace: 0.12, warhammer: 0.12, spear: 0.36, staff: 0.4, club: 0.1, crossbow: 0.4 };
  const SPAN = { sword: 33, dagger: 16, greatsword: 46, axe: 29, battleaxe: 40, mace: 28, warhammer: 30, spear: 62, staff: 52, club: 32, crossbow: 26 };
  const BOW_H = 36, BRACE = 5.6;
  /* the painted pictures: grip point (measured on the leather wrap) */
  const PIV = { sword: [0.167, 0.505], "sword-iron": [0.145, 0.522], dagger: [0.23, 0.489], greatsword: [0.155, 0.493], axe: [0.17, 0.428],
    battleaxe: [0.15, 0.495], mace: [0.2, 0.502], staff: [0.33, 0.548] };
  const BOWPIC = { bow: { riser: 0.68, nock: 0.04 }, "bow-drawn": { riser: 0.69, nock: 0.02, y: 0.48 } };
  const SHPIC = { shield: [15, 19.5], "shield-side": [4.6, 19.5], "shield-kite": [13.4, 21], "shield-kite-side": [3.6, 21] };

  // ---------------------------------------------------------------- colours
  const hex = (c) => { const m = /^#([0-9a-f]{6})$/i.exec(c || ""); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4), 16)] : [150, 150, 150]; };
  /* k > 0 toward white, k < 0 toward black */
  function tone(c, k) {
    const [r, g, b] = hex(c), f = (v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
    return "#" + [f(r), f(g), f(b)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
  }
  const STEEL = { c: "#bcc3c8", d: "#6d757b", t: "#f4f7f8" };
  function metalOf(sp, plain) {
    const m = sp && sp.wset;
    if (plain || !m || m.w === "cloth" || ["wood", "hide", "leather", "forsworn"].includes(sp.wkey)) return STEEL;
    const c = m.d && /^#[0-3]/.test(m.c) ? m.c : m.trim || STEEL.c;
    return { c, d: tone(c, -0.45), t: tone(c, 0.6) };
  }
  const WOOD = { c: "#7a5232", d: "#4a301c", t: "#a87a50" };
  const OUT = "rgba(22,16,10,0.75)";

  // ---------------------------------------------------------------- the painted pictures, when they exist
  const sprite = (kind) => { try { return typeof ASSETS !== "undefined" ? ASSETS.img("rig-w-" + kind) : null; } catch { return null; } };
  const COLOURED = /elven|glass|ebony|daedric|dwarven|orc|dragon|stalhrim|falmer/;
  const TINTS = new Map();
  /* the picture recoloured toward c (keeps its light and shade), made once per picture and colour */
  function tinted(pic, key, c) {
    const id = key + c;
    if (TINTS.has(id)) return TINTS.get(id);
    let out = pic;
    try {
      const w = pic.naturalWidth || pic.width, h = pic.naturalHeight || pic.height, cv = document.createElement("canvas");
      cv.width = w; cv.height = h; const x = cv.getContext("2d");
      x.drawImage(pic, 0, 0); x.globalCompositeOperation = "color"; x.globalAlpha = 0.7; x.fillStyle = c; x.fillRect(0, 0, w, h);
      x.globalAlpha = 1; x.globalCompositeOperation = "destination-in"; x.drawImage(pic, 0, 0); out = cv;
    } catch { out = pic; }
    TINTS.set(id, out); return out;
  }
  const dims = (p) => [p.naturalWidth || p.width, p.naturalHeight || p.height];
  /* which painted weapon picture this gear uses (null = draw it) */
  function picFor(sp, wk, M) {
    const key = wk === "sword" && sp && /iron/.test(sp.wkey || "") ? "sword-iron" : wk;
    if (!PIV[key]) return null;
    let pic = sprite(key);
    if (!pic && key === "sword-iron") { pic = sprite("sword"); return pic ? { pic, key: "sword" } : null; }
    if (!pic) return null;
    if (sp && COLOURED.test(sp.wkey || "") && M !== STEEL) pic = tinted(pic, key, M.c);
    return { pic, key };
  }
  const devScale = (g) => { try { const t = g.getTransform(); const s = Math.hypot(t.a, t.b); return isFinite(s) && s > 0 ? s : 1; } catch { return 1; } };
  function shadowOn(g, glow, st) {
    const d = devScale(g);
    if (glow) { g.shadowColor = glow; g.shadowBlur = 4 * ((st && st.k) || 1); g.shadowOffsetX = 0; g.shadowOffsetY = 0; return; }
    g.shadowColor = "rgba(0,0,0,0.38)"; g.shadowBlur = 1.6 * d; g.shadowOffsetX = 0.5 * d; g.shadowOffsetY = 0.9 * d;
  }
  function shadowOff(g) { g.shadowColor = "rgba(0,0,0,0)"; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; }

  // ---------------------------------------------------------------- pieces
  /* a gradient across a bar lying along x (from y0 to y1): dark rim, light middle, darker underside */
  function across(g, y0, y1, M) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, M.t); gr.addColorStop(0.18, tone(M.c, 0.25)); gr.addColorStop(0.5, M.c); gr.addColorStop(0.82, M.d); gr.addColorStop(1, tone(M.d, -0.3));
    return gr;
  }
  function haft(g, x0, x1, r, W) {
    g.beginPath(); g.moveTo(x0, -r); g.lineTo(x1, -r * 0.92); g.arc(x1, 0, r * 0.92, -Math.PI / 2, Math.PI / 2); g.lineTo(x0, r); g.arc(x0, 0, r, Math.PI / 2, Math.PI * 1.5); g.closePath();
    g.fillStyle = across(g, -r, r, W); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.25; g.stroke();
  }
  function grain(g, x0, x1, r, W) {   // wood grain: thin dark streaks along the haft
    g.save(); shadowOff(g); g.strokeStyle = tone(W.d, -0.2); g.globalAlpha = 0.55; g.lineWidth = 0.14;
    for (const k of [-0.45, 0.1, 0.5]) { g.beginPath(); g.moveTo(x0 + 0.5, k * r); g.bezierCurveTo((x0 + x1) * 0.4, k * r - 0.25, (x0 + x1) * 0.6, k * r + 0.25, x1 - 0.5, k * r * 0.9); g.stroke(); }
    g.restore();
  }
  function wrap(g, x0, x1, r) {   // leather wrapped round a grip
    const L = { c: "#4a3424", d: "#2a1c12", t: "#7a5a40" };
    haft(g, x0, x1, r, L);
    g.save(); shadowOff(g); g.strokeStyle = "rgba(15,10,6,0.7)"; g.lineWidth = 0.18;
    for (let x = x0 + 0.6; x < x1 - 0.2; x += 0.9) { g.beginPath(); g.moveTo(x, -r); g.lineTo(x + 0.6, r); g.stroke(); }
    g.restore();
  }
  function knob(g, x, y, r, M) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, M.t); gr.addColorStop(0.5, M.c); gr.addColorStop(1, M.d);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = gr; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.2; g.stroke();
  }

  // ---------------------------------------------------------------- weapons
  function blade(g, wk, M) {
    const t = TIP[wk], L = Math.hypot(t[0], t[1]), big = wk === "greatsword", dag = wk === "dagger";
    const w = big ? 3.2 : dag ? 2 : 2.6, gs = big ? 5 : dag ? 2.6 : 3.2, ge = big ? 4.8 : dag ? 2.6 : 3.6;
    wrap(g, -gs + 0.4, gs - 0.4, big ? 0.85 : 0.75);
    knob(g, -gs, 0, big ? 1.35 : 1.05, M);
    // the blade: a ridge down the middle, a bright top edge, a darker bottom bevel
    const b0 = gs + 0.5, pt = L - w * 1.3;
    g.beginPath(); g.moveTo(b0, -w / 2); g.lineTo(pt, -w * 0.46); g.quadraticCurveTo(L - w * 0.4, -w * 0.3, L, 0); g.quadraticCurveTo(L - w * 0.4, w * 0.3, pt, w * 0.46); g.lineTo(b0, w / 2); g.closePath();
    g.fillStyle = across(g, -w / 2, w / 2, M); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.22; g.stroke();
    g.save(); shadowOff(g);
    const sheen = g.createLinearGradient(b0, 0, L, 0);   // light running along the steel
    sheen.addColorStop(0, "rgba(255,255,255,0)"); sheen.addColorStop(0.35, "rgba(255,255,255,0.22)"); sheen.addColorStop(0.55, "rgba(255,255,255,0.04)"); sheen.addColorStop(0.8, "rgba(255,255,255,0.2)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sheen; g.fill();
    g.lineCap = "round";
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 0.22; g.beginPath(); g.moveTo(b0 + 0.6, -w * 0.4); g.lineTo(pt, -w * 0.38); g.quadraticCurveTo(L - w * 0.45, -w * 0.25, L - 0.3, -0.05); g.stroke();   // the edge catching the light
    if (!dag) { g.strokeStyle = tone(M.d, -0.25); g.globalAlpha = 0.7; g.lineWidth = 0.32; g.beginPath(); g.moveTo(b0 + 1, 0.05); g.lineTo(L * 0.72, 0.03); g.stroke(); g.globalAlpha = 1; }   // the fuller
    g.restore();
    // the guard over the blade's root
    g.beginPath(); g.moveTo(gs - 0.7, -ge); g.lineTo(gs + 0.7, -ge + 0.3); g.lineTo(gs + 0.7, ge - 0.3); g.lineTo(gs - 0.7, ge); g.closePath();
    const gg = g.createLinearGradient(gs - 0.7, 0, gs + 0.7, 0); gg.addColorStop(0, M.d); gg.addColorStop(0.4, M.t); gg.addColorStop(1, M.c);
    g.fillStyle = gg; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.22; g.stroke();
  }
  function axeHead(g, hx, s, M, flip) {
    const y = flip ? -1 : 1;
    g.beginPath(); g.moveTo(hx - 2 * s, 0.7 * y); g.quadraticCurveTo(hx - 3 * s, 4 * s * y, hx - 4.8 * s, 7.6 * s * y); g.quadraticCurveTo(hx + 1.6 * s, 8 * s * y, hx + 4.6 * s, 4.9 * s * y); g.quadraticCurveTo(hx + 2.2 * s, 3 * s * y, hx + 2.2 * s, 0.7 * y); g.closePath();
    const gr = g.createLinearGradient(hx, 0, hx, 7.5 * s * y); gr.addColorStop(0, M.d); gr.addColorStop(0.45, M.c); gr.addColorStop(0.85, tone(M.c, 0.2)); gr.addColorStop(1, M.t);
    g.fillStyle = gr; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.22; g.stroke();
    g.save(); shadowOff(g); g.lineCap = "round";
    g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 0.3; g.beginPath(); g.moveTo(hx - 4.4 * s, 7.2 * s * y); g.quadraticCurveTo(hx + 1.4 * s, 7.5 * s * y, hx + 4.2 * s, 4.8 * s * y); g.stroke();   // the honed edge
    knob(g, hx, 0, 0.55 * s, M);
    g.restore();
  }
  function weapon(g, sp, wk, st, o = {}) {
    if (!wk || wk === "fist") return;
    const M = metalOf(sp, o.plain), glow = o.glow || (sp && sp.ench);
    g.save();
    shadowOn(g, glow, st);
    if (wk === "bow") { bow(g, sp, st, o); g.restore(); return; }
    const P = picFor(sp, wk, M);
    if (P) {   // a painted picture: lying along the weapon, the hand at its grip point
      const t = TIP[wk] || [1, 0], [pw, ph] = dims(P.pic), pv = PIV[P.key];
      g.rotate(Math.atan2(t[1], t[0]));
      const w = SPAN[wk], h = w * ph / Math.max(1, pw);
      g.drawImage(P.pic, -w * pv[0], -h * pv[1], w, h); g.restore(); return;
    }
    const FK = typeof FIGART !== "undefined" ? FIGART.kit : null;
    if (wk === "crossbow" || wk === "spear" || wk === "staff" || wk === "club" || !TIP[wk]) {   // not reworked yet: the plain drawing, with a shadow
      if (FK) FK.weapon(g, sp, wk, st, o);
      g.restore(); return;
    }
    const t = TIP[wk], L = Math.hypot(t[0], t[1]);
    g.rotate(Math.atan2(t[1], t[0]));
    if (wk === "dagger" || wk === "sword" || wk === "greatsword") blade(g, wk, M);
    else if (wk === "axe" || wk === "battleaxe") {
      const big = wk === "battleaxe", hl = L + (big ? 2 : 1), s = big ? 1.35 : 1, hx = hl - (big ? 5 : 4);
      haft(g, -3, hl, big ? 0.95 : 0.8, WOOD); grain(g, -3, hl, big ? 0.95 : 0.8, WOOD);
      axeHead(g, hx, s, M, false); if (big) axeHead(g, hx, s, M, true);
    } else if (wk === "mace") {
      haft(g, -3, L - 1, 0.8, WOOD); grain(g, -3, L - 1, 0.8, WOOD);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU; g.beginPath(); g.moveTo(L, 0); g.lineTo(L + Math.cos(a) * 3.8, Math.sin(a) * 3.8); g.lineTo(L + Math.cos(a + 0.55) * 2.3, Math.sin(a + 0.55) * 2.3); g.closePath();
        const gr = g.createLinearGradient(L, 0, L + Math.cos(a) * 3.8, Math.sin(a) * 3.8); gr.addColorStop(0, M.d); gr.addColorStop(1, M.t); g.fillStyle = gr; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.2; g.stroke();
      }
      knob(g, L, 0, 2.4, M);
    } else if (wk === "warhammer") {
      haft(g, -4, L + 1, 0.9, WOOD); grain(g, -4, L + 1, 0.9, WOOD);
      g.beginPath(); g.rect(L - 2.7, -2.7, 5.4, 8.2);
      const gr = g.createLinearGradient(L - 2.7, 0, L + 2.7, 0); gr.addColorStop(0, M.d); gr.addColorStop(0.35, M.t); gr.addColorStop(0.6, M.c); gr.addColorStop(1, M.d);
      g.fillStyle = gr; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.22; g.stroke();
      g.beginPath(); g.moveTo(L - 1.4, -2.7); g.lineTo(L, -7.2); g.lineTo(L + 1.4, -2.7); g.closePath(); g.fillStyle = across(g, -7, -2.7, M); g.fill(); g.stroke();
      g.save(); shadowOff(g); g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 0.25; g.beginPath(); g.moveTo(L - 2.4, 5.3); g.lineTo(L + 2.4, 5.3); g.stroke(); g.restore();
    }
    g.restore();
  }
  /* the bow: the riser in the hand at 0,0, the limbs curving back to their tips, the string pulled o.pull units back */
  function bow(g, sp, st, o) {
    const pull = Math.max(BRACE, o.pull != null ? o.pull : BRACE), h = BOW_H / 2, k = sp ? sp.wkey || "" : "";
    const wc = /elven/.test(k) ? "#c9a75e" : k === "dwarven" ? "#c08a3c" : /glass/.test(k) ? "#8fcf9a" : /ebony|daedric/.test(k) ? "#3a3034" : WOOD.c;
    const bend = (pull - BRACE) * 0.12;   // the limbs bend further as the string comes back
    const tip = [-BRACE - bend, h - bend * 0.6];
    let pic = sprite("bow"), pd = sprite("bow-drawn");
    if (pic) {   // painted: the relaxed bow (its own string), cross-fading into the drawn one stretched to the string hand
      const tc = k && COLOURED.test(k) ? wc : null;
      if (tc) { pic = tinted(pic, "bow", tc); if (pd) pd = tinted(pd, "bow-drawn", tc); }
      const R = BOWPIC.bow, D = BOWPIC["bow-drawn"];
      const [rw, rh] = dims(pic), w = BOW_H * rw / Math.max(1, rh);
      const [dw, dh] = pd ? dims(pd) : [1, 1], dW = BOW_H * dw / Math.max(1, dh), full = (D.riser - D.nock) * dW;
      const t = pd ? Math.max(0, Math.min(1, (pull - BRACE - 0.8) / 2.2)) : 0;   // quick: half-drawn already shows the drawn bow
      if (t < 1) {   // the relaxed one bends (stretches back) so its string meets the string hand
        const rx = Math.max(1, Math.min(1.8, pull / ((R.riser - R.nock) * w)));
        g.globalAlpha = 1 - t; g.save(); g.scale(rx, 1); g.drawImage(pic, -w * R.riser, -h, w, BOW_H); g.restore();
      }
      if (t > 0) {
        const sx = Math.max(0.4, Math.min(1.25, pull / full));
        g.globalAlpha = t; g.save(); g.scale(sx, 1); g.drawImage(pd, -dW * D.riser, -BOW_H * D.y, dW, BOW_H); g.restore();
      }
      g.globalAlpha = 1;
      return;   // both pictures carry their string (and the drawn one its arrow)
    }
    {
      const limb = (y) => {
        g.beginPath(); g.moveTo(0.9, 0); g.bezierCurveTo(2.4, y * 0.35, 1.2, y * 0.75, tip[0] + 0.4, tip[1] * y / h); g.lineTo(tip[0] - 0.3, tip[1] * y / h * 0.98);
        g.bezierCurveTo(0.2, y * 0.72, 1.2, y * 0.33, -0.9, 0); g.closePath();
        const gr = g.createLinearGradient(-1, 0, 2.4, 0); gr.addColorStop(0, tone(wc, -0.35)); gr.addColorStop(0.55, wc); gr.addColorStop(1, tone(wc, 0.35));
        g.fillStyle = gr; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.22; g.stroke();
      };
      limb(-h); limb(h);
      g.save(); shadowOff(g); g.strokeStyle = tone(wc, 0.5); g.globalAlpha = 0.6; g.lineWidth = 0.2;
      for (const y of [-h, h]) { g.beginPath(); g.moveTo(1.6, y * 0.3); g.bezierCurveTo(1.4, y * 0.6, 0.4, y * 0.82, tip[0] + 0.3, tip[1] * y / h * 0.97); g.stroke(); }
      g.restore();
      g.beginPath(); g.rect(-1.1, -2.2, 2.4, 4.4); g.fillStyle = across(g, -2.2, 2.2, { c: "#4a3424", d: "#2a1c12", t: "#7a5a40" }); g.fill();   // leather on the grip
    }
    g.save(); shadowOff(g);
    g.strokeStyle = "#ece2c8"; g.lineWidth = 0.32; g.beginPath(); g.moveTo(tip[0], -tip[1]); g.lineTo(-pull, 0); g.lineTo(tip[0], tip[1]); g.stroke();
    if (o.arrow) {
      const a0 = -pull, a1 = a0 + 27;
      g.strokeStyle = "#3a2a1a"; g.lineWidth = 0.75; g.beginPath(); g.moveTo(a0, 0); g.lineTo(a1 - 2, 0); g.stroke();
      g.strokeStyle = "#c9a878"; g.lineWidth = 0.42; g.stroke();
      g.beginPath(); g.moveTo(a1 + 1.2, 0); g.lineTo(a1 - 2.2, -1.2); g.lineTo(a1 - 1.6, 0); g.lineTo(a1 - 2.2, 1.2); g.closePath(); g.fillStyle = across(g, -1.2, 1.2, STEEL); g.fill();
      g.fillStyle = "#a8442e"; for (const y of [-1, 1]) { g.beginPath(); g.moveTo(a0 + 0.4, 0); g.lineTo(a0 + 3.6, 0); g.lineTo(a0 + 3, y * 1.3); g.lineTo(a0 + 0.8, y * 1.2); g.closePath(); g.fill(); }
    }
    g.restore();
  }

  // ---------------------------------------------------------------- shields
  function shield(g, sp, front, st) {
    const S = (sp && sp.shield) || { set: { c: "#7a5232", d: "#553823", trim: "#8f8a84" }, k: "wood", kite: false }, s = S.set || {}, sf = s.f || {};
    const wooden = S.k === "wood" || S.k === "hide" || !s.metal, base = S.k === "hide" ? "#7a5232" : s.c || "#7a5232";
    const rim = { c: s.trim || "#8f8a84", d: tone(s.trim || "#8f8a84", -0.5), t: tone(s.trim || "#8f8a84", 0.55) };
    g.save(); g.translate(1.2, -1); if (front) g.scale(1.12, 1.08);
    const outline = () => { g.beginPath(); if (S.kite) { g.moveTo(-4.8, -9.6); g.quadraticCurveTo(0.6, -11.2, 5.8, -9.6); g.lineTo(5.9, 0.4); g.quadraticCurveTo(4.6, 6.6, 0.4, 10.8); g.quadraticCurveTo(-3.8, 6.6, -5.1, 0.4); g.closePath(); } else g.ellipse(0, 0, 6.8, 9.4, 0, 0, TAU); };
    shadowOn(g, null, st);
    const pk = (S.kite ? "shield-kite" : "shield") + (front ? "" : "-side");
    let pic = sprite(pk);
    if (pic) {   // painted: front view, or edge-on with its face to the foe (the strap side on the forearm)
      const tc = COLOURED.test(S.k || "") && s.c ? s.c : null;
      if (tc) pic = tinted(pic, pk, tc);
      const [w, h] = SHPIC[pk];
      if (front) g.drawImage(pic, -w / 2, -h / 2, w, h); else g.drawImage(pic, 3, -h / 2, w, h);
      if (sf.glow && FK()) FK().glowAt(g, 0.4, -1, 6, sf.glow, 0.35, st);
      g.restore(); return;
    }
    outline();
    const gr = g.createRadialGradient(-2, -3.5, 1, 0, 0, 11);
    gr.addColorStop(0, tone(base, 0.28)); gr.addColorStop(0.6, base); gr.addColorStop(1, tone(base, -0.4));
    g.fillStyle = gr; g.fill();
    shadowOff(g);
    g.save(); outline(); g.clip();
    if (wooden) {   // planks with grain
      g.strokeStyle = tone(base, -0.5); g.lineWidth = 0.28;
      for (const x of [-3.4, 0, 3.4]) { g.beginPath(); g.moveTo(x, -11); g.lineTo(x, 11); g.stroke(); }
      g.strokeStyle = tone(base, -0.3); g.globalAlpha = 0.6; g.lineWidth = 0.14;
      for (let i = 0; i < 10; i++) { const x = -6.2 + i * 1.35 + (i % 3) * 0.2; g.beginPath(); g.moveTo(x, -11); g.bezierCurveTo(x + 0.5, -4, x - 0.5, 3, x + 0.2, 11); g.stroke(); }
      g.globalAlpha = 1;
      g.strokeStyle = tone(base, 0.25); g.globalAlpha = 0.35; g.lineWidth = 0.18;
      for (const x of [-3.2, 0.2, 3.6]) { g.beginPath(); g.moveTo(x, -11); g.lineTo(x, 11); g.stroke(); }
      g.globalAlpha = 1;
    } else {   // metal: a long sheen
      const sh = g.createLinearGradient(-5, -8, 5, 8); sh.addColorStop(0.25, "rgba(255,255,255,0)"); sh.addColorStop(0.42, "rgba(255,255,255,0.35)"); sh.addColorStop(0.55, "rgba(255,255,255,0)"); g.fillStyle = sh; g.fillRect(-8, -12, 16, 24);
      if (S.kite) { g.strokeStyle = s.d || tone(base, -0.3); g.lineWidth = 0.9; g.beginPath(); g.moveTo(0.4, -10); g.lineTo(0.4, 10); g.moveTo(-5, -2.6); g.lineTo(6, -2.6); g.stroke(); }
    }
    // the shade toward the bottom edge, as if lit from above
    const lo = g.createLinearGradient(0, -10, 0, 10); lo.addColorStop(0, "rgba(255,240,210,0.12)"); lo.addColorStop(0.55, "rgba(0,0,0,0)"); lo.addColorStop(1, "rgba(0,0,0,0.35)"); g.fillStyle = lo; g.fillRect(-8, -12, 16, 24);
    g.restore();
    // the iron rim and its rivets
    outline(); g.strokeStyle = rim.d; g.lineWidth = 1.5; g.stroke();
    const rg = g.createLinearGradient(-6, -9, 6, 9); rg.addColorStop(0, rim.t); rg.addColorStop(0.45, rim.c); rg.addColorStop(1, rim.d);
    outline(); g.strokeStyle = rg; g.lineWidth = 1; g.stroke();
    if (!S.kite) for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; knob(g, Math.cos(a) * 6.75, Math.sin(a) * 9.35, 0.32, rim); }
    if (!S.kite || wooden) {   // the boss
      g.save(); shadowOn(g, null, st); knob(g, 0, 0, 2.2, rim); g.restore();
      g.beginPath(); g.arc(-0.6, -0.7, 0.6, 0, TAU); g.fillStyle = "rgba(255,255,255,0.6)"; g.fill();
    }
    if (sf.spikes && S.kite) for (const sx of [-4.4, 5.2]) { g.beginPath(); g.moveTo(sx - 1, -9.4); g.lineTo(sx + (sx > 0 ? 2 : -2), -12.4); g.lineTo(sx + 1, -9.4); g.closePath(); g.fillStyle = across(g, -12, -9, rim); g.fill(); }
    if (sf.glow && FK()) FK().glowAt(g, 0.4, -1, 6, sf.glow, 0.35, st);
    g.restore();
  }
  const FK = () => (typeof FIGART !== "undefined" ? FIGART.kit : null);
  return { weapon, shield, sprite, tone, TIP, GRIP, SPAN, BOW_H, BRACE };
})();
if (typeof module !== "undefined") module.exports = RIGGEAR;
