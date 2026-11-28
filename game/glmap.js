/* glmap.js — the world map drawn by the graphics chip (WebGL step 2, see glrender.js for the plan)

   The map's big pictures go on a VISIBLE WebGL canvas under the 2D map canvas, so nothing is ever copied back from the
   GPU (that copy is what made step 1's "draw on GL, then drawImage into 2D" slow). A frame on the GPU is a stack of
   layers inside the map frame, bottom to top:
     #mapgl     WebGL: the kept ground picture (painting, tiles, roads, frame, season) slid by whole pixels, the ambience
                (water glints, cloud shadows, birds) and the kept fog + clan colours. The two kept pictures are textures
                uploaded only when map.js rebuilds them (a zoom step, a new tile, the fog opening up) — a pan or a walk is
                just a new offset (one uniform), not a full-screen copy.
     #mapgl2    2D, transparent: trail, route, the tapped spot, sight / sneak rings, cones of sight
     light      lightfx.js's own small buffers shown as they are, stretched by the compositor with the same blend the 2D
                path uses: grade + vignette (multiply), storm wash-out (saturation), mist and high clouds, added light
                (plus-lighter). CSS blend modes are the W3C compositing formulas the 2D canvas uses, run on the GPU.
     #map       2D, transparent: places, names, heroes, everything you tap (hit-testing is unchanged: v.transform)
   Anything this can't do exactly (a zoom in progress, tiles still loading, Solstheim, the PC map's weather, lighting off)
   is drawn the classic way for that frame on #map alone, and the GL layers are hidden.

   GLMAP.use()            → draw this frame on the GPU? (GLR.on() and the Auto race "map")
   GLMAP.begin(m, cw, ch) → the layers exist and are sized; returns { ok, b2 (2D ctx) }
   GLMAP.frame(o)         → draws the GL layer; o = { ground:{c,ver,x,y}, veil:{c,ver,x,y}, clip:[x,y,w,h], k, ox, oy, rec }
   GLMAP.light(L, clip)   → shows lightfx's buffers (L from LIGHTFX.map with o.out)
   GLMAP.hide()           → classic frame: GL layers hidden
   GLMAP.recorder()       → a stand-in 2D context that records MAPART.ambient's strokes and sprites for the GL layer
*/
const GLMAP = (() => {
  const DOM = typeof document !== "undefined";
  const stats = { frames: 0, classic: 0, uploads: 0, lines: 0, sprites: 0, lost: 0, why: "", restored: 0 };
  let box = null, cv = null, gl = null, b2c = null, bad = false, lostNow = false;
  let P = null, buf = null, vao = null;
  const T = {};   // name -> { t, ver, w, h }
  const L = {};   // light layer elements

  /* ------------------------------------------------------------------ shaders */
  // one program: kind 0 = texture (premultiplied), 1 = an anti-aliased round-capped line (capsule) of one colour
  const VS = `#version 300 es
  in vec2 aP; in vec2 aU; in vec4 aS; uniform vec2 uRes; out vec2 vU; out vec2 vP; flat out vec4 vS;
  void main() { vU = aU; vP = aP; vS = aS; gl_Position = vec4(aP.x / uRes.x * 2.0 - 1.0, 1.0 - aP.y / uRes.y * 2.0, 0.0, 1.0); }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 vU; in vec2 vP; flat in vec4 vS; uniform sampler2D uTex; uniform int uKind; uniform vec4 uCol; uniform float uA;
  uniform float uHW; out vec4 o;
  void main() {
    if (uKind == 0) { o = texture(uTex, vU) * uA; return; }
    vec2 a = vS.xy, b = vS.zw, pa = vP - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0), d = length(pa - ba * h);
    float cov = clamp(uHW + 0.5 - d, 0.0, 1.0);
    o = vec4(uCol.rgb * uCol.a, uCol.a) * cov;
  }`;

  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(s));
    return s;
  }
  function setup() {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(p));
    P = { p, aP: gl.getAttribLocation(p, "aP"), aU: gl.getAttribLocation(p, "aU"), aS: gl.getAttribLocation(p, "aS") };
    for (const n of ["uRes", "uTex", "uKind", "uCol", "uA", "uHW"]) P[n] = gl.getUniformLocation(p, n);
    // one vertex layout for both kinds: position, texture uv, the line segment (x0, y0, x1, y1) it belongs to
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(P.aP); gl.vertexAttribPointer(P.aP, 2, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(P.aU); gl.vertexAttribPointer(P.aU, 2, gl.FLOAT, false, 32, 8);
    gl.enableVertexAttribArray(P.aS); gl.vertexAttribPointer(P.aS, 4, gl.FLOAT, false, 32, 16);
    gl.useProgram(p); gl.uniform1i(P.uTex, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // premultiplied source-over, as the 2D canvas
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    for (const k in T) delete T[k];
  }

  /* ------------------------------------------------------------------ the layers */
  function make(m) {
    box = document.createElement("div"); box.id = "mapgpu"; box.setAttribute("aria-hidden", "true");
    box.style.cssText = "position:absolute;inset:0;pointer-events:none;isolation:isolate";
    cv = document.createElement("canvas"); cv.id = "mapgl";
    cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lostNow = true; stats.lost++; stats.why = "context lost"; });
    cv.addEventListener("webglcontextrestored", () => { lostNow = false; stats.restored++; try { setup(); } catch (err) { fail(err); } });
    const b2 = document.createElement("canvas"); b2.id = "mapgl2";
    box.append(cv, b2);
    for (const [n, tag, blend] of [["mul", "canvas", "multiply"], ["desat", "div", "saturation"], ["air", "canvas", "normal"], ["light", "canvas", "plus-lighter"]]) {
      const e = document.createElement(tag); e.dataset.lfx = n;
      e.style.cssText = `position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none;mix-blend-mode:${blend}` + (n === "desat" ? ";background:#808080" : "");
      L[n] = { slot: e, el: e, key: "" }; box.append(e);
    }
    m.before(box);
    gl = cv.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: true, preserveDrawingBuffer: false });
    if (!gl) throw new Error("no webgl2");
    setup();
    b2c = b2.getContext("2d");
  }
  function fail(err) { bad = true; stats.why = String(err && err.message || err || "error"); try { console.warn("[GLMAP] back to classic drawing:", stats.why); } catch { /* no console */ } hide(); }

  /* draw the map on the GPU this frame? */
  function use() {
    if (!DOM || bad || lostNow || typeof GLR === "undefined" || !GLR.on()) return false;
    return GLR.pick("map") === "gpu";
  }
  function begin(m, cw, ch) {
    try {
      if (!box || box.nextElementSibling !== m || !box.isConnected) { if (box) box.remove(); make(m); }
      if (gl.isContextLost()) { lostNow = true; return { ok: false }; }
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      const b2 = b2c.canvas; if (b2.width !== cw || b2.height !== ch) { b2.width = cw; b2.height = ch; } else { b2c.setTransform(1, 0, 0, 1, 0, 0); b2c.clearRect(0, 0, cw, ch); }
      if (box.style.display === "none") box.style.display = "";
      return { ok: true, b2: b2c };
    } catch (e) { fail(e); return { ok: false }; }
  }
  function hide() { if (box && box.style.display !== "none") box.style.display = "none"; stats.classic++; }

  /* ------------------------------------------------------------------ textures */
  function texture(name, c, ver, mip) {
    let e = T[name];
    if (e && e.ver === ver && e.w === c.width && e.h === c.height) return e.t;
    if (!e) { e = T[name] = { t: gl.createTexture(), ver: null, w: 0, h: 0 }; }
    gl.bindTexture(gl.TEXTURE_2D, e.t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); }
    else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); }   // copied 1:1: every texel lands on its own pixel
    e.ver = ver; e.w = c.width; e.h = c.height; stats.uploads++;
    return e.t;
  }
  const quadV = new Float32Array(48);
  function quad(x, y, w, h) {
    const v = quadV; let i = 0;
    for (const [px, py, u, t] of [[x, y, 0, 0], [x + w, y, 1, 0], [x, y + h, 0, 1], [x, y + h, 0, 1], [x + w, y, 1, 0], [x + w, y + h, 1, 1]]) { v[i++] = px; v[i++] = py; v[i++] = u; v[i++] = t; i += 4; }
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STREAM_DRAW); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function image(t, x, y, w, h, a) { gl.uniform1i(P.uKind, 0); gl.uniform1f(P.uA, a); gl.bindTexture(gl.TEXTURE_2D, t); quad(x, y, w, h); }

  /* ------------------------------------------------------------------ the ambience recorder */
  function colour(s) {
    s = String(s).trim();
    let m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) { const p = m[1].split(",").map(Number); return [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1]; }
    m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) { const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1]; }
    return null;
  }
  function recorder() {
    const ops = [];
    let path = [], cur = null, start = null;
    const r = {
      ops, bad: false, strokeStyle: "#000", lineWidth: 1, lineCap: "butt", globalAlpha: 1, imageSmoothingQuality: "low", imageSmoothingEnabled: true,
      beginPath() { path = []; cur = start = null; },
      moveTo(x, y) { cur = start = [x, y]; },
      lineTo(x, y) { if (cur) path.push([cur[0], cur[1], x, y]); cur = [x, y]; },
      quadraticCurveTo(cx, cy, x, y) {
        if (!cur) { cur = [x, y]; return; }
        const [x0, y0] = cur, N = 8;
        for (let i = 1; i <= N; i++) { const t = i / N, u = 1 - t, nx = u * u * x0 + 2 * u * t * cx + t * t * x, ny = u * u * y0 + 2 * u * t * cy + t * t * y; path.push([cur[0], cur[1], nx, ny]); cur = [nx, ny]; }
      },
      stroke() {
        const c = colour(r.strokeStyle); if (!c) { r.bad = true; return; }
        if (r.lineCap !== "round") r.bad = true;   // only round caps are drawn exactly (the ambience uses nothing else)
        if (path.length) ops.push({ line: path.slice(), col: c, a: r.globalAlpha, w: r.lineWidth });
      },
      drawImage(img, x, y, w, h) { if (arguments.length !== 5) { r.bad = true; return; } ops.push({ img, x, y, w, h, a: r.globalAlpha }); },
      save() {}, restore() {},
    };
    for (const n of ["fill", "fillRect", "arc", "rect", "clip", "setTransform", "translate", "scale", "rotate", "createPattern", "createLinearGradient", "createRadialGradient", "fillText", "strokeText", "bezierCurveTo", "closePath", "setLineDash"]) r[n] = () => { r.bad = true; };
    Object.defineProperty(r, "globalCompositeOperation", { get: () => "source-over", set: (v) => { if (v !== "source-over") r.bad = true; } });
    return r;
  }
  let lineV = new Float32Array(48 * 64);
  function lines(op, k, ox, oy) {
    const hw = op.w * k / 2, pad = hw + 1.5;
    gl.uniform1i(P.uKind, 1); gl.uniform1f(P.uHW, hw); gl.uniform4f(P.uCol, op.col[0], op.col[1], op.col[2], op.col[3] * op.a);
    // one stroke covers each pixel once (like the 2D path's single fill): the stencil lets the first segment win
    gl.enable(gl.STENCIL_TEST); gl.clear(gl.STENCIL_BUFFER_BIT); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    // all of a stroke's segments in one draw: each is a box around it, the fragment shader keeps its round-capped band
    if (lineV.length < op.line.length * 48) lineV = new Float32Array(op.line.length * 48 * 2);
    const v = lineV; let i = 0;
    for (const [x0w, y0w, x1w, y1w] of op.line) {
      const x0 = x0w * k + ox, y0 = y0w * k + oy, x1 = x1w * k + ox, y1 = y1w * k + oy;
      const a = Math.min(x0, x1) - pad, b = Math.min(y0, y1) - pad, w = Math.abs(x1 - x0) + 2 * pad, h = Math.abs(y1 - y0) + 2 * pad;
      for (const [px, py] of [[a, b], [a + w, b], [a, b + h], [a, b + h], [a + w, b], [a + w, b + h]]) { v[i++] = px; v[i++] = py; v[i++] = 0; v[i++] = 0; v[i++] = x0; v[i++] = y0; v[i++] = x1; v[i++] = y1; }
    }
    gl.bufferData(gl.ARRAY_BUFFER, v.subarray(0, i), gl.STREAM_DRAW); gl.drawArrays(gl.TRIANGLES, 0, i / 8);
    stats.lines += op.line.length;
    gl.disable(gl.STENCIL_TEST);
  }
  // the fragment shader's coverage is exact only where a segment's own capsule decides: overlapping segments of one
  // stroke would let a partly covered first pixel block a fully covered second. Strokes here are hair-thin (1-3 px),
  // so the stencil is cleared per stroke and the AA fringe stays as soft as the 2D path's.

  /* ------------------------------------------------------------------ one frame */
  const ids = new WeakMap(); let idN = 0;
  const idOf = (o) => ids.get(o) || (ids.set(o, ++idN), idN);
  function frame(o) {
    try {
      if (gl.isContextLost()) { lostNow = true; return false; }
      const cw = cv.width, ch = cv.height;
      gl.viewport(0, 0, cw, ch); gl.useProgram(P.p); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.uniform2f(P.uRes, cw, ch); gl.activeTexture(gl.TEXTURE0);
      gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      const g = o.ground; image(texture("ground", g.c, g.ver, false), g.x, g.y, g.c.width, g.c.height, 1);
      // the ambience and the fog stay inside the map (the 2D path clips to it)
      const [cx, cy, cwid, chei] = o.clip, sx = Math.max(0, Math.round(cx)), sy = Math.max(0, Math.round(cy));
      const ex = Math.min(cw, Math.round(cx + cwid)), ey = Math.min(ch, Math.round(cy + chei));
      gl.enable(gl.SCISSOR_TEST); gl.scissor(sx, ch - ey, Math.max(0, ex - sx), Math.max(0, ey - sy));
      for (const op of o.rec ? o.rec.ops : []) {
        if (op.line) lines(op, o.k, o.ox, o.oy);
        else { image(texture("img" + idOf(op.img), op.img, idOf(op.img), true), op.x * o.k + o.ox, op.y * o.k + o.oy, op.w * o.k, op.h * o.k, op.a); stats.sprites++; }
      }
      const vl = o.veil; image(texture("veil", vl.c, vl.ver, false), vl.x, vl.y, vl.c.width, vl.c.height, 1);
      gl.disable(gl.SCISSOR_TEST);
      stats.frames++;
      return true;
    } catch (e) { fail(e); return false; }
  }

  /* lightfx's buffers, shown as they are (no copy), with the 2D path's blend modes; clip in device px, dpr for CSS */
  function put(n, el, on, alpha) {
    const s = L[n];
    if (el && s.el !== el) {   // a new buffer canvas (lightfx rebuilt it at a new size): it takes the slot's place
      el.dataset.lfx = n; el.style.cssText = s.slot.style.cssText; el.removeAttribute("aria-hidden");
      s.el.replaceWith(el); s.el = el;
    }
    const st = s.el.style, d = on ? "" : "none";
    if (st.display !== d) st.display = d;
    if (on) { const a = String(alpha); if (st.opacity !== a) st.opacity = a; }
  }
  function light(out, clip, dpr) {
    if (!box) return;
    const [x, y, w, h] = clip.map((v) => v / dpr), W2 = box.clientWidth, H2 = box.clientHeight;
    const cp = `inset(${Math.max(0, y)}px ${Math.max(0, W2 - x - w)}px ${Math.max(0, H2 - y - h)}px ${Math.max(0, x)}px)`;
    for (const n of ["mul", "desat", "air", "light"]) if (L[n].el.style.clipPath !== cp) L[n].el.style.clipPath = cp;
    put("mul", out?.mul, !!out?.mul, 1);
    put("desat", null, !!out && out.desat > 0, out ? +out.desat.toFixed(4) : 0);
    put("air", out?.air, !!out?.air, 1);
    put("light", out?.light, !!out?.light, out ? +(out.lightA ?? 1).toFixed(4) : 1);
  }

  return { use, begin, frame, light, hide, recorder, colour, stats: () => ({ ...stats, on: !!box && box.style.display !== "none", bad }), _lose: () => gl && gl.getExtension("WEBGL_lose_context") };
})();
if (typeof module !== "undefined") module.exports = GLMAP;
