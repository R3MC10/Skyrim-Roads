/* glrender.js — GPU drawing (WebGL) for the big moving pictures. Global GLR.

   WHY / WHAT (step 1 of 4, Nov 2026)
   Remigiusz asked for the whole game's drawing on the graphics chip, without the look changing at all. This file is the
   shared GPU layer; fights use it first. Map and title follow (plan below). The road view is Kacper's (his own
   WebGL diorama, three.js, issue #255) and isn't touched from here.

   INVENTORY of the game's canvases (grep getContext, 53 files), by kind:
   A) big pictures redrawn every frame — candidates for the GPU:
      - fight stage: fightart.js (stage canvas) → battlescene.js back/front (painted plates, props) through fightcam.js
        layers; rig.js / riggear.js / riglook.js / figart.js / foerig.js / creaturerig.js / horseart.js (painted figures);
        effects: sparks.js, movefx.js, gore.js, gorefx2.js, fightnums.js, snowfx.js (weather), arrowfx/weaponfx in fightart
      - map: map.js, maptiles.js (painted tiles), mapart.js, mapfx.js, mapride.js, inkmap.js, lightfx.js (grade, fog)
      - road view: fptravel.js, fpworld.js, travelart.js — owned by Kacper's side, becoming a three.js diorama (diorama.js)
      - title / sky: titleart.js, skyart.js (panorama, aurora), solart.js
      - mini-games drawn every frame while open: fishing.js/fishart.js, huntgame.js/huntart.js, lockgame.js, pickgame.js,
        minegame.js, smithgame.js, harvestgame.js, craftgames.js, dungeongames.js
   B) small pictures drawn once and kept (no GPU needed — they already end up as cached images): icons (iconart/uiart),
      portraits and paper dolls (dollfront.js, chargen.js, chargenrig.js), part tints (rig.js tint(), riggear.js),
      ground textures, sky overlays, art.js ART.canvas caches, fitcanvas.js helpers, gripdata/riglook samplers, vision.js
   C) everything else is HTML/CSS (menus, cards, bars, the fight's buttons and feed) and stays as it is.

   HOW IT FITS (so nothing looks different)
   The fight stage stays one 2D canvas, drawn in the same order as before. The painted backdrop — the biggest pixel cost:
   two full-stage plates cut into parallax rows with mirrored edges, plus the props — is drawn by the GPU into its own
   offscreen WebGL canvas and then put onto the stage with ONE drawImage at the very bottom. Everything above it (figures,
   glows that add light over the backdrop, the near-edge strip, weather, labels) is drawn exactly as before, so blending
   over the backdrop is unchanged. When nothing in the backdrop moved since the last frame, the GPU frame is simply
   reused. Any drawing call the GPU layer doesn't know, a lost WebGL context, no WebGL at all, ?nogl=1 in the address, or
   Settings → Performance → Graphics engine: Classic → the old 2D path, automatically. On Auto (the default) the GPU
   is only kept on phones where it is really quicker (see "GPU or 2D" below).

   PLAN for the next steps (each its own pull request, pixel-compared against the 2D path):
   2) map: painted tiles + clan tint + fog as GPU sprites (pan/zoom = one matrix change), labels/pins stay 2D on top.
   3) title / sky panorama, mini-games' painted backgrounds.
   4) painted figures (rig parts are already separate pictures → one batch per figure) and the rest of the fight effects.
   (the road view is not in this plan: Kacper's diorama already draws it with WebGL)

   API
     GLR.on()                    → use the GPU now? (WebGL works, not turned off, not broken)
     GLR.layer()                 → { canvas, ctx, begin(w, h, rgba?), end(), ok } an offscreen GPU picture; ctx answers the
                                   2D calls the painted backdrop uses: save/restore, (set|reset)Transform, transform,
                                   translate/rotate/scale, getTransform, globalAlpha, globalCompositeOperation
                                   (source-over, screen, lighter, multiply), drawImage (3/5/9 args), fillRect/clearRect with
                                   a plain colour. Anything else marks the frame unusable (layer.bad) and the caller draws
                                   the old way.
     GLR.settingsHTML(seg), GLR.pref(k, v)  → Settings → Performance row
     GLR.stats()                 → counters for tests (frames, batches, quads, texture uploads, fallbacks)
*/
const GLR = (() => {
  const DOM = typeof document !== "undefined";
  const KEY = "rotn_prefs";
  const prefs = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const setPref = (k, v) => { try { const p = prefs(); p[k] = v; localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ } };
  const stats = { frames: 0, reused: 0, batches: 0, quads: 0, uploads: 0, fallbacks: 0, lost: 0, why: "" };

  /* ------------------------------------------------------------------ is the GPU usable? */
  let probe = null;   // null = not tried, true / false
  function supported() {
    if (probe !== null) return probe;
    probe = false;
    if (!DOM) return probe;
    try {
      const c = document.createElement("canvas"), g = c.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
      probe = !!g;
      const lc = g && g.getExtension("WEBGL_lose_context"); if (lc) lc.loseContext();   // don't keep a context alive for the probe
    } catch { probe = false; }
    return probe;
  }
  let broken = false;   // something went wrong this session: stay on the old path
  const noGlUrl = () => { try { return DOM && /[?&]nogl(=1)?(&|$)/.test(location.search); } catch { return false; } };
  const engine = () => { const v = prefs().gfxEngine; return v === "classic" || v === "gpu" ? v : "auto"; };
  const on = () => !broken && engine() !== "classic" && !noGlUrl() && supported();
  function fail(why) { broken = true; stats.fallbacks++; stats.why = String(why || "error"); try { console.warn("[GLR] back to classic drawing:", stats.why); } catch { /* no console */ } }

  /* ------------------------------------------------------------------ pure helpers (also used by the node test) */
  // 2D affine matrix [a, b, c, d, e, f] like DOMMatrix: x' = a*x + c*y + e, y' = b*x + d*y + f
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  /* blend factors for premultiplied colours, per Canvas 2D composite mode (the ones the painted scenes use) */
  const BLEND = {
    "source-over": ["ONE", "ONE_MINUS_SRC_ALPHA"],
    lighter: ["ONE", "ONE"],
    screen: ["ONE", "ONE_MINUS_SRC_COLOR"],          // s + d·(1 − s)
    multiply: ["DST_COLOR", "ONE_MINUS_SRC_ALPHA"],  // s·d + d·(1 − sa)   (exact over an opaque picture)
  };
  /* drawImage's argument forms → normalised source and destination rects (negative sizes flip like the 2D canvas;
     a source rect past the picture's edge is clipped and the destination shrinks with it, as the spec says) */
  function rects(iw, ih, a) {
    let sx = 0, sy = 0, sw = iw, sh = ih, dx, dy, dw, dh;
    if (a.length === 2) { [dx, dy] = a; dw = iw; dh = ih; }
    else if (a.length === 4) { [dx, dy, dw, dh] = a; }
    else if (a.length === 8) { [sx, sy, sw, sh, dx, dy, dw, dh] = a; }
    else return null;
    if (sw < 0) { sx += sw; sw = -sw; } if (sh < 0) { sy += sh; sh = -sh; }
    if (dw < 0) { dx += dw; dw = -dw; } if (dh < 0) { dy += dh; dh = -dh; }
    if (!(sw > 0 && sh > 0 && dw > 0 && dh > 0) || ![sx, sy, dx, dy].every(Number.isFinite)) return null;
    const kx = dw / sw, ky = dh / sh;
    if (sx < 0) { dx -= sx * kx; dw += sx * kx; sw += sx; sx = 0; }
    if (sy < 0) { dy -= sy * ky; dh += sy * ky; sh += sy; sy = 0; }
    if (sx + sw > iw) { const cut = sx + sw - iw; sw -= cut; dw -= cut * kx; }
    if (sy + sh > ih) { const cut = sy + sh - ih; sh -= cut; dh -= cut * ky; }
    if (!(sw > 0 && sh > 0 && dw > 0 && dh > 0)) return null;
    return { sx, sy, sw, sh, dx, dy, dw, dh };
  }
  function parseColor(s) {   // "#rgb", "#rrggbb", "rgb()/rgba()" → [r, g, b, a] in 0..1, else null
    if (typeof s !== "string") return null;
    let m = s.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) { const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1); }
    m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
    if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255, m[4] == null ? 1 : +m[4]];
    return null;
  }

  /* ------------------------------------------------------------------ the GPU picture */
  const VS = `#version 300 es
    in vec2 aPos; in vec2 aUv; in float aA; uniform vec2 uRes; out vec2 vUv; out float vA;
    void main() { vUv = aUv; vA = aA; vec2 c = aPos / uRes * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }`;
  const FS = `#version 300 es
    precision mediump float; uniform sampler2D uTex; uniform vec4 uCol; uniform float uSolid; uniform float uBias; in vec2 vUv; in float vA; out vec4 o;
    void main() { vec4 t = uSolid > 0.5 ? uCol : texture(uTex, vUv, uBias); o = t * vA; }`;
  const FLOATS = 5, MAXQ = 2048;
  let MIP = "LINEAR_MIPMAP_NEAREST", BIAS = -0.5;   // matched against Chrome's 2D canvas downscaling (tests/glfight_ui.py)

  /* browsers allow only a handful of live GPU pictures and kill the oldest past that (which would read as a lost
     context): a layer belongs to an element (the fight stage), and is freed once that element has left the page */
  const LIVE = [];
  function sweep() {
    for (let i = LIVE.length - 1; i >= 0; i--) { const l = LIVE[i]; if (!l.ok || (l.owner && !l.owner.isConnected)) { LIVE.splice(i, 1); if (l.ok) l.dispose(); } }
    while (LIVE.length >= 6) LIVE.shift().dispose();
  }
  function layer(owner) {
    sweep();
    const L = { ok: false, owner: owner || null, bad: false, canvas: null, ctx: null, begin, end, dirty, dispose };
    if (!on()) return L;
    let gone = false, gl, prog, buf, vbo, loc, texes = new WeakMap(), live = [], q = 0, cur = { tex: null, blend: "", solid: null }, W = 0, H = 0;
    const cv = document.createElement("canvas");
    try {
      gl = cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });   // the frame is reused while the backdrop stands still
      if (!gl) { fail("no webgl2"); return L; }
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      loc = { pos: gl.getAttribLocation(prog, "aPos"), uv: gl.getAttribLocation(prog, "aUv"), a: gl.getAttribLocation(prog, "aA"), res: gl.getUniformLocation(prog, "uRes"), col: gl.getUniformLocation(prog, "uCol"), solid: gl.getUniformLocation(prog, "uSolid"), bias: gl.getUniformLocation(prog, "uBias") };
      buf = new Float32Array(MAXQ * 6 * FLOATS); vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, buf.byteLength, gl.DYNAMIC_DRAW);
      const st = FLOATS * 4;
      gl.enableVertexAttribArray(loc.pos); gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, st, 0);
      gl.enableVertexAttribArray(loc.uv); gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, st, 8);
      gl.enableVertexAttribArray(loc.a); gl.vertexAttribPointer(loc.a, 1, gl.FLOAT, false, st, 16);
      gl.enable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); if (gone) return; stats.lost++; L.ok = false; fail("context lost"); });
    } catch (e) { fail(e && e.message); return L; }
    L.canvas = cv; L.ok = true; LIVE.push(L);

    /* a picture → its texture (uploaded once; a canvas that changes can be marked with GLR's layer.dirty(src)) */
    function tex(src) {
      let t = texes.get(src);
      if (t && !t.stale) return t;
      const w = src.naturalWidth || src.videoWidth || src.width, h = src.naturalHeight || src.videoHeight || src.height;
      if (!(w > 0 && h > 0)) return null;
      flush();   // quads already queued use the texture bound now; draw them before binding another
      if (!t) { t = { t: gl.createTexture(), w, h }; texes.set(src, t); live.push(t); }
      gl.bindTexture(gl.TEXTURE_2D, t.t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);   // like the 2D canvas's default ("low") smoothing
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      if (MIP) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[MIP]); }   // shrunk pictures keep the same smooth grain as the 2D canvas
      t.w = w; t.h = h; t.stale = false; stats.uploads++;
      cur.tex = null;
      return t;
    }
    function dirty(src) { const t = texes.get(src); if (t) t.stale = true; }
    function flush() {
      if (!q) return;
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf.subarray(0, q * 6 * FLOATS));
      gl.drawArrays(gl.TRIANGLES, 0, q * 6);
      stats.batches++; stats.quads += q; q = 0;
    }
    function state(t, blend, solid) {
      const bl = BLEND[blend] ? blend : null;
      if (!bl) { L.bad = true; return false; }
      if (t !== cur.tex || bl !== cur.blend || (solid || null) !== cur.solid) {
        flush();
        if (bl !== cur.blend) { const f = BLEND[bl]; gl.blendFunc(gl[f[0]], gl[f[1]]); cur.blend = bl; }
        if (solid) { gl.uniform1f(loc.solid, 1); gl.uniform4f(loc.col, solid[0] * solid[3], solid[1] * solid[3], solid[2] * solid[3], solid[3]); }
        else gl.uniform1f(loc.solid, 0);
        if (t && t !== cur.tex) gl.bindTexture(gl.TEXTURE_2D, t.t);
        cur.tex = t; cur.solid = solid || null;
      }
      return true;
    }
    function quad(m, x0, y0, x1, y1, u0, v0, u1, v1, a) {
      if (q >= MAXQ) flush();
      const p = [apply(m, x0, y0), apply(m, x1, y0), apply(m, x1, y1), apply(m, x0, y1)], uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      let o = q * 6 * FLOATS;
      for (const i of [0, 1, 2, 0, 2, 3]) { buf[o++] = p[i][0]; buf[o++] = p[i][1]; buf[o++] = uv[i][0]; buf[o++] = uv[i][1]; buf[o++] = a; }
      q++;
    }

    /* ---- the 2D-canvas-like context ---- */
    let S = { m: [1, 0, 0, 1, 0, 0], alpha: 1, comp: "source-over", fill: "#000" }, stack = [];
    const unknown = (n) => () => { L.bad = true; if (!stats.why) stats.why = "unsupported " + n; };
    const ctx = {
      canvas: cv,
      save() { stack.push({ ...S, m: S.m.slice() }); },
      restore() { if (stack.length) S = stack.pop(); },
      setTransform(a, b, c, d, e, f) { if (a && typeof a === "object") S.m = [a.a, a.b, a.c, a.d, a.e, a.f]; else S.m = [a, b, c, d, e, f]; },
      resetTransform() { S.m = [1, 0, 0, 1, 0, 0]; },
      getTransform() { const [a, b, c, d, e, f] = S.m; return typeof DOMMatrix !== "undefined" ? new DOMMatrix([a, b, c, d, e, f]) : { a, b, c, d, e, f }; },
      transform(a, b, c, d, e, f) { S.m = mul(S.m, [a, b, c, d, e, f]); },
      translate(x, y) { S.m = mul(S.m, [1, 0, 0, 1, x, y]); },
      scale(x, y) { S.m = mul(S.m, [x, 0, 0, y, 0, 0]); },
      rotate(r) { const c = Math.cos(r), s = Math.sin(r); S.m = mul(S.m, [c, s, -s, c, 0, 0]); },
      get globalAlpha() { return S.alpha; }, set globalAlpha(v) { if (Number.isFinite(v) && v >= 0 && v <= 1) S.alpha = v; },
      get globalCompositeOperation() { return S.comp; }, set globalCompositeOperation(v) { if (typeof v === "string") S.comp = v; },
      get fillStyle() { return S.fill; }, set fillStyle(v) { S.fill = v; },
      imageSmoothingEnabled: true, imageSmoothingQuality: "low",
      drawImage(src, ...a) {
        if (!src || S.alpha <= 0) return;
        const t = tex(src); if (!t) return;
        const r = rects(t.w, t.h, a); if (!r) return;
        if (!state(t, S.comp, null)) return;
        quad(S.m, r.dx, r.dy, r.dx + r.dw, r.dy + r.dh, r.sx / t.w, r.sy / t.h, (r.sx + r.sw) / t.w, (r.sy + r.sh) / t.h, S.alpha);
      },
      fillRect(x, y, w, h) {
        const c = parseColor(S.fill); if (!c) { L.bad = true; return; }
        if (!state(null, S.comp, c)) return;
        quad(S.m, x, y, x + w, y + h, 0, 0, 1, 1, S.alpha);
      },
      clearRect(x, y, w, h) {   // only a whole-picture clear is needed (and supported)
        if (x <= 0 && y <= 0 && x + w >= W - 1e-6 && y + h >= H - 1e-6 && S.m[0] === 1 && S.m[3] === 1 && !S.m[1] && !S.m[2] && !S.m[4] && !S.m[5]) { flush(); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
        else L.bad = true;
      },
    };
    for (const n of ["beginPath", "moveTo", "lineTo", "arc", "rect", "fill", "stroke", "fillText", "strokeText", "createLinearGradient", "createRadialGradient", "createPattern", "clip", "getImageData", "putImageData", "quadraticCurveTo", "bezierCurveTo", "ellipse", "closePath", "measureText", "strokeRect", "setLineDash"]) ctx[n] = unknown(n);
    L.ctx = ctx;

    /* start a frame: size w×h device pixels, cleared to rgba (default: transparent) */
    function begin(w, h, rgba) {
      if (!L.ok) return false;
      L.bad = false; q = 0; stack = []; S = { m: [1, 0, 0, 1, 0, 0], alpha: 1, comp: "source-over", fill: "#000" };
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      W = w; H = h;
      gl.viewport(0, 0, w, h); gl.useProgram(prog); gl.uniform2f(loc.res, w, h); gl.uniform1f(loc.bias, BIAS);
      cur = { tex: null, blend: "", solid: null };
      const c = rgba ? parseColor(rgba) : null;
      gl.clearColor(c ? c[0] * c[3] : 0, c ? c[1] * c[3] : 0, c ? c[2] * c[3] : 0, c ? c[3] : 0); gl.clear(gl.COLOR_BUFFER_BIT);
      return true;
    }
    /* finish the frame; false when something couldn't be drawn on the GPU (the caller draws it the old way) */
    function end() {
      if (!L.ok) return false;
      try { flush(); } catch (e) { fail(e && e.message); L.ok = false; return false; }
      if (gl.isContextLost()) { L.ok = false; return false; }
      stats.frames++;
      if (L.bad) { fail(stats.why || "unsupported drawing"); return false; }   // the same scene would fail every frame: stay on the old path
      return true;
    }
    function dispose() {   // our own clean-up: not a lost context
      gone = true; const i = LIVE.indexOf(L); if (i >= 0) LIVE.splice(i, 1);
      try { for (const t of live) gl.deleteTexture(t.t); live = []; texes = new WeakMap(); const lc = gl.getExtension("WEBGL_lose_context"); if (lc) lc.loseContext(); } catch { /* already gone */ }
      L.ok = false;
    }
    return L;
  }

  /* ------------------------------------------------------------------ GPU or 2D: whichever is quicker on this phone
     Drawing on the GPU is nearly free, but putting the GPU picture into the 2D stage is a copy: chip to chip where the
     2D canvas is itself on the GPU (then the gain is small), a slow read-back where it is drawn in software (some phones,
     headless browsers: much slower). Timing the calls in JS can't tell (a 2D canvas paints later), so on Auto the real
     time between finished frames is measured: the first frames one way, then the other, and the GPU is kept only when
     it is clearly quicker (10%+); otherwise the old way, which looks the same. Setting "GPU" or ?gl=force skips the race. */
  const RACE = {}, RN = 30, WARM = 5, GAIN = 0.9;
  const forced = () => { try { return engine() === "gpu" || (DOM && /[?&]gl=force(&|$)/.test(location.search)); } catch { return false; } };
  const median = (a) => { const b = a.slice(WARM).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : Infinity; };
  function pick(name) {
    if (forced()) return "gpu";
    const r = RACE[name] || (RACE[name] = { gpu: [], cpu: [], pick: null, last: 0, side: "" });
    if (r.pick) return r.pick;
    if (r.gpu.length < RN) return "gpu";
    if (r.cpu.length < RN) return "cpu";
    const g = median(r.gpu), c = median(r.cpu);
    r.pick = g <= c * GAIN ? "gpu" : "cpu"; r.ms = [+g.toFixed(2), +c.toFixed(2)];
    try { console.info(`[GLR] ${name}: ${r.ms[0]} ms a frame on the GPU vs ${r.ms[1]} ms the old way → ${r.pick}`); } catch { /* no console */ }
    return r.pick;
  }
  /* a frame of `name` was drawn the `side` way at time `now` (ms); back-to-back frames of the same way are timed */
  function tick(name, side, now) {
    const r = RACE[name]; if (!r || r.pick || !Number.isFinite(now)) return;
    const d = now - r.last;
    if (r.side === side && d > 0 && d < 250) r[side].push(d);
    r.last = now; r.side = side;
  }

  /* ------------------------------------------------------------------ Settings → Performance */
  function settingsHTML(seg) {
    if (typeof seg !== "function") return "";
    return `<div class="setrow"><span>Graphics engine</span>${seg("gfxEngine", [["auto", "Auto"], ["gpu", "GPU"], ["classic", "Classic"]], engine())}</div>
      <p class="mute" style="font-size:13px">Auto lets the graphics chip draw the big painted pictures when that's quicker on your phone (it checks in the first seconds of a fight). GPU always uses it, Classic never does. They all look the same.</p>`;
  }
  function pref(k, v) {
    if (k !== "gfxEngine") return false;
    setPref("gfxEngine", v === "classic" || v === "gpu" ? v : "auto");
    if (v !== "classic") broken = false;
    for (const k in RACE) delete RACE[k];   // time it again with the new choice   // give the GPU another go
    return true;
  }

  return { on, supported, layer, pick, tick, reused() { stats.reused++; }, settingsHTML, pref, stats: () => ({ ...stats, live: LIVE.length, race: Object.fromEntries(Object.entries(RACE).map(([k, r]) => [k, { pick: r.pick, ms: r.ms, n: [r.gpu.length, r.cpu.length] }])) }), _t: { race: RACE, median, setMip(v) { MIP = v; }, setBias(v) { BIAS = v; }, mul, apply, rects, parseColor, BLEND, engine } };
})();
if (typeof module !== "undefined") module.exports = GLR;
