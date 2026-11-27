/* Painted creature rigs: a creature's painting (foe-<slug>.webp) cut into body parts that ride the bones of its foe rig
   (foerig.js), so a painted wolf really bites with its head and jaw, swipes with a foreleg, a troll swings an arm, a
   spider's legs step and a dragon's wings and tail move — instead of the whole picture bending in slices. [OURS]
   Owner: "make a proper rig for all characters in the game".

   How it works (2D cut-out rigging, as in Spine / DragonBones):
   - creaturerigdata.js lists, per painting, the joints (pivots) and the polygons of the moving parts.
   - Once per picture (and per scene grading) the picture is cut: each part is its polygon widened a little past the
     joint (so it overlaps the body and no seam shows), soft-edged; the rest of the painting becomes the "base". Where a
     part covered the body (an arm in front of a chest), the hole in the base is filled with a blur of the surrounding
     paint, so a limb that swings away never leaves a see-through gap; where it stuck out into empty air, the hole stays
     empty.
   - Every frame each bone's pose (rotation, offset, scale from the foe rig's clip) turns its parts about the bone's
     painted joint; a part follows its parent bones (head → neck → body). Rest pose = the untouched painting.
   - Layers: far legs, far wing, tail behind the body (z < 0), near legs, head, jaw, near arm in front (z > 0).
   Anything missing (no data for the picture, no canvas, an error) → foerig.js slices the picture as before.

   CREATURERIG.has(key)                       data exists for a picture key ("foe-wolf")
   CREATURERIG.draw(g, R, p, st, src) → bool  draws the cut-up picture in the foe rig's root space (after its root move)
   CREATURERIG.matrices(key, R, p, wU, hU)    bone matrices (tests)
   CREATURERIG.ART_NEEDS                      painted part sheets that would look better than cut-outs */
const CREATURERIG = (() => {
  const DATA = typeof CREATURERIG_DATA !== "undefined" ? CREATURERIG_DATA : {};
  const slug = (key) => String(key || "").replace(/^foe-/, "").replace(/\.(webp|png|jpg)$/, "");
  const has = (key) => !!DATA[slug(key)];
  let broken = false;

  // ---------------------------------------------------------------- bone matrices in rig space
  /* W_b = W_parent · T(P_b + d) · R(rot·k) · S(sx, sy) · T(−P_b); P_b the painted joint in rig space. Bones without a
     joint in the data pass their parent's matrix on (their turns are dropped: the painting has no separate piece there). */
  function matrices(key, R, p, wU, hU) {
    const D = DATA[slug(key)]; if (!D || !R) return null;
    const M = {}, byIdx = {}, names = [];
    for (const k in R.idx) names[R.idx[k]] = k;
    const id = [1, 0, 0, 1, 0, 0];
    const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
    for (let i = 0; i < R.n; i++) {
      const nm = names[i];
      let par = R.par[i]; while (par >= 0 && !byIdx[par]) par = R.par[par];
      const PW = par >= 0 ? byIdx[par] : id, j = D.bones[nm];
      let W = PW;
      if (j && nm !== "root") {
        const o = i * 5, k = j[2] ?? 0.65, rot = (p[o] || 0) * k, dx = (p[o + 1] || 0) * k, dy = (p[o + 2] || 0) * k;
        const sx = 1 + ((p[o + 3] ?? 1) - 1) * k, sy = 1 + ((p[o + 4] ?? 1) - 1) * k;
        const px = (j[0] - 0.5) * wU, py = (j[1] - 1) * hU, c = Math.cos(rot), s = Math.sin(rot);
        const L = [c * sx, s * sx, -s * sy, c * sy, 0, 0];   // R·S about the joint
        L[4] = px + dx - (L[0] * px + L[2] * py); L[5] = py + dy - (L[1] * px + L[3] * py);
        W = mul(PW, L); byIdx[i] = W;
      } else if (nm === "root") { W = id; byIdx[i] = id; }
      M[nm] = W;
    }
    return M;
  }

  // ---------------------------------------------------------------- cutting a picture into parts (once)
  const cuts = new WeakMap();
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const path = (x, poly, w, h, ox = 0, oy = 0) => { x.beginPath(); poly.forEach(([u, v], i) => (i ? x.lineTo : x.moveTo).call(x, u * w - ox, v * h - oy)); x.closePath(); };
  function cut(src, key) {
    let byKey = cuts.get(src); if (!byKey) { byKey = {}; cuts.set(src, byKey); }
    if (byKey[key]) return byKey[key];
    const D = DATA[slug(key)], w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    const feather = Math.max(1, h / 260);
    const base = mk(w, h), bx = base.getContext("2d"); bx.drawImage(src, 0, 0, w, h);
    const parts = D.parts.map(([bone, z, poly, pad], i) => ({ bone, z, poly, pad: (pad ?? 0.014) * h, i }));
    // every part: its own polygon, widened, minus the parts listed after it (they own those pixels)
    for (const pt of parts) {
      const xs = pt.poly.map((q) => q[0] * w), ys = pt.poly.map((q) => q[1] * h), P = pt.pad + feather * 2;
      const x0 = Math.max(0, Math.floor(Math.min(...xs) - P)), y0 = Math.max(0, Math.floor(Math.min(...ys) - P)), x1 = Math.min(w, Math.ceil(Math.max(...xs) + P)), y1 = Math.min(h, Math.ceil(Math.max(...ys) + P));
      const c = mk(x1 - x0, y1 - y0), x = c.getContext("2d");
      x.drawImage(src, -x0, -y0, w, h);
      const m = mk(c.width, c.height), mx = m.getContext("2d");
      if ("filter" in mx) mx.filter = "blur(" + feather.toFixed(1) + "px)";
      mx.fillStyle = "#000"; mx.strokeStyle = "#000"; mx.lineJoin = "round"; mx.lineWidth = pt.pad * 2;
      path(mx, pt.poly, w, h, x0, y0); mx.fill(); if (pt.pad > 0) mx.stroke();
      mx.globalCompositeOperation = "destination-out"; mx.filter = "none";
      for (const later of parts) if (later.i > pt.i) { path(mx, later.poly, w, h, x0, y0); mx.fill(); }
      x.globalCompositeOperation = "destination-in"; x.drawImage(m, 0, 0);
      pt.c = c; pt.x0 = x0; pt.y0 = y0;
    }
    // the base: the painting with every part cut out. Holes left by parts drawn IN FRONT of the body (z > 0) and lying
    // inside its outline are filled with the paint around them (a blur of the base without those parts, so a limb never
    // smears its own colours over the chest); parts drawn BEHIND the body (z < 0) keep their holes open so they show.
    const hole = mk(w, h), hx = hole.getContext("2d"), back = mk(w, h), kx = back.getContext("2d"); hx.fillStyle = "#000"; kx.fillStyle = "#000";
    for (const pt of parts) { path(pt.z < 0 ? kx : hx, pt.poly, w, h); (pt.z < 0 ? kx : hx).fill(); }
    bx.globalCompositeOperation = "destination-out"; bx.drawImage(hole, 0, 0); bx.drawImage(back, 0, 0); bx.globalCompositeOperation = "source-over";
    const shrink = (im, f) => { const sm = mk(w / f, h / f), smx = sm.getContext("2d"); smx.imageSmoothingQuality = "high"; smx.drawImage(im, 0, 0, sm.width, sm.height); const big = mk(w, h), bgx = big.getContext("2d"); bgx.imageSmoothingQuality = "high"; bgx.drawImage(sm, 0, 0, w, h); return bgx; };
    try {
      const S = bx.getImageData(0, 0, w, h), s = S.data, Hd = hx.getImageData(0, 0, w, h).data;
      const A = shrink(src, 12).getImageData(0, 0, w, h).data;          // the outline: inside where the blurred picture is solid
      const B1 = shrink(base, 10).getImageData(0, 0, w, h).data, B2 = shrink(base, 28).getImageData(0, 0, w, h).data;   // paint around the holes
      const orig = (() => { const c = mk(w, h), x = c.getContext("2d"); x.drawImage(src, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; })();
      for (let i = 0; i < s.length; i += 4) {
        const a = Hd[i + 3]; if (!a) continue;
        const f = a / 255;
        if (A[i + 3] > 200) {   // inside the body: paint it over with the surrounding colour (near paint first, wider blur where the hole is big)
          const B = B1[i + 3] > 40 ? B1 : B2[i + 3] > 40 ? B2 : null; if (!B) continue;   // no paint near: leave it open
          const r = B[i], gg = B[i + 1], bb = B[i + 2];
          s[i] = orig[i] + (r - orig[i]) * f; s[i + 1] = orig[i + 1] + (gg - orig[i + 1]) * f; s[i + 2] = orig[i + 2] + (bb - orig[i + 2]) * f; s[i + 3] = orig[i + 3] + (255 - orig[i + 3]) * f;
        }
      }
      bx.putImageData(S, 0, 0);
    } catch (e) { /* a tainted canvas (file:// on a desktop browser): the holes stay cut, no fill */ }
    const all = [...parts, { bone: D.base || "body", z: 0, c: base, x0: 0, y0: 0, isBase: true }].sort((a, b) => a.z - b.z);
    return (byKey[key] = { w, h, all });
  }

  // ---------------------------------------------------------------- drawing
  function draw(g, R, p, st, src) {
    if (broken || typeof document === "undefined") return false;
    const key = st.picKey; if (!key || !has(key) || !src || !(src.width || src.naturalWidth)) return false;
    try {
      const C = cut(src, key), hU = st.picH, wU = hU * C.w / C.h, M = matrices(key, R, p, wU, hU), D = DATA[slug(key)];
      if (st.filter) g.filter = st.filter;
      const kx = wU / C.w, ky = hU / C.h;
      for (const pt of C.all) {
        const W = M[pt.bone] || M[D.base] || [1, 0, 0, 1, 0, 0];
        g.save(); g.transform(W[0], W[1], W[2], W[3], W[4], W[5]);
        g.drawImage(pt.c, -wU / 2 + pt.x0 * kx, -hU + pt.y0 * ky, pt.c.width * kx, pt.c.height * ky);
        g.restore();
      }
      g.filter = "none";
      return true;
    } catch (e) { broken = true; try { console.warn("creaturerig off:", e); } catch (e2) { /* no console */ } return false; }
  }

  /* painted part sheets that would beat cut-outs (for the art pipeline): side-on, each piece on its own layer, painted
     past every joint, same light as the full picture */
  const ART_NEEDS = {
    wolf: "head, lower jaw, near/far foreleg, near/far hind leg, tail, body",
    sabrecat: "head, lower jaw (with the sabre teeth on the upper), 4 legs, tail, body",
    skeever: "head, lower jaw, 4 legs, long tail in 3 pieces, body",
    bear: "head, lower jaw, 2 arms (raised paws), 2 legs, body (standing)",
    mammoth: "head with tusks, trunk in 2 pieces, 4 legs, tail, body",
    horker: "head with tusks, front flippers, back flippers, body",
    troll: "head, lower jaw, 2 arms in upper/lower pieces with claws, 2 legs in upper/lower pieces, body",
    frosttroll: "as the troll, plus its frost breath as a separate puff",
    giant: "head, club arm (club separate), free arm, 2 legs, body",
    centurion: "head, hammer arm (hammer separate), free arm, 2 legs in upper/lower pieces, body, chest core glow",
    frostatronach: "head, 2 arms, 2 legs, body (ice chunks)",
    flameatronach: "head with flame hair, 2 arms, body/skirt of fire (separate flame layer)",
    stormatronach: "head rock, 2 arm rock clusters, body rock cluster, separate lightning layer",
    spider: "head, fangs, abdomen, 8 legs each in 2 pieces",
    chaurus: "head with mandibles, antennae, shell, 6 legs each in 2 pieces",
    dwarvenspider: "head, glowing core, body, 8 legs each in 2 pieces",
    mudcrab: "body, eye stalks, big claw (pincer separate), small claw, 6 walking legs",
    icewraith: "head, 3 tail pieces",
    dragon: "head, lower jaw, neck in 2 pieces, near/far wing (arm + membrane), tail in 3 pieces, 4 legs in 2 pieces, body",
  };

  return { has, draw, matrices, ART_NEEDS, DATA, slug };
})();
if (typeof module !== "undefined") module.exports = CREATURERIG;
