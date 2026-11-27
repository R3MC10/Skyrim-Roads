/* The diorama road view (diorama.js). [OURS]
   While you travel, the band above the map shows the road as a small painted world: the real route bending over
   gentle hills (dioramaroute.js), hand-painted trees, plants and rocks standing in it as cut-outs (dioramakits.js:
   what grows depends on the region), painted distant ridges and sky, and you on the road in your real look: on foot
   walking, or on your horse (mapride.js draws both). A finish makes it read as a model landscape: depth blur above and
   below the focus line, a soft glow on bright spots, fog with distance, a colour grade and a darker frame. Time of day
   and the weather tint it; snow falls when it snows.
   It needs WebGL: three.js (three.min.js, r128) loads the first time a trip shows the band, never at start-up. Until it
   has loaded, and whenever the diorama can't run (no WebGL, a region without a kit, a ship or carriage, Battery saver,
   Road view: Classic in Settings, or it keeps running below ~24 fps), the classic road view (fptravel.js) draws instead.
     DIORAMA.frame(host, info, dt, t, region) → true when it drew this frame (fptravel.js hides its own canvas then)
     DIORAMA.detach()                         → removes its canvas (the band closed)
     DIORAMA.mode() / setMode("diorama"|"classic") · DIORAMA.settingsHTML(seg) · DIORAMA.pref(k, v)
     DIORAMA.debug()                          → what the last frame drew (tests)
   Performance: one WebGL canvas (device pixels capped at 1.5 on phones), the trees and plants of one kind drawn in a
   single call each (instanced cut-outs that turn to face you in the vertex shader), the ground patch and road rebuilt
   only every ~25 m, the finish a single full-screen pass. */
const DIORAMA = (() => {
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  const KEY = "rotn_roadview";
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const R = () => (typeof DIOROUTE !== "undefined" ? DIOROUTE : null);
  const K = () => (typeof DIOKITS !== "undefined" ? DIOKITS : null);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } } };
  const mode = () => (store.get(KEY) === "classic" ? "classic" : "diorama");
  const setMode = (m) => store.set(KEY, m === "classic" ? "classic" : "diorama");
  const phone = () => DOM && (matchMedia("(pointer: coarse)").matches || innerWidth < 760);
  function settingsHTML(seg) { return `<div class="setrow"><span>Road view</span>${seg("roadView", [["diorama", "Diorama"], ["classic", "Classic"]], mode())}</div>`; }
  function pref(k, v) { if (k !== "roadView") return false; setMode(v); if (v === "classic") detach(); slow = 0; avgDt = 0; return true; }

  // ---------------------------------------------------------------- can it run?
  let webgl = null, threeState = "none", slow = 0, avgDt = 0;   // slow: seconds spent running too slowly
  function hasWebGL() {
    if (webgl !== null) return webgl;
    try { const c = document.createElement("canvas"); webgl = !!(c.getContext("webgl") || c.getContext("experimental-webgl")); } catch { webgl = false; }
    return webgl;
  }
  function loadThree() {
    if (typeof THREE !== "undefined") { threeState = "ready"; return true; }
    if (threeState === "none" && DOM) {
      threeState = "loading";
      const s = document.createElement("script"); s.src = "three.min.js"; s.async = true;
      s.onload = () => { threeState = typeof THREE !== "undefined" ? "ready" : "failed"; };
      s.onerror = () => { threeState = "failed"; };
      document.head.appendChild(s);
    }
    return false;
  }
  let why = "";
  function usable(I, region) {
    const no = (r) => { why = r; return false; };
    if (!DOM || mode() !== "diorama") return no("classic chosen");
    if (!I || I.boat || I.carriage) return no("ship or carriage");
    if (!I.pos || !Array.isArray(I.path) || I.path.length < 2) return no("no route");
    if (!R() || !K() || !K().of(region)) return no("no kit for " + region);
    if (typeof PERFMODE !== "undefined" && PERFMODE.saver && PERFMODE.saver()) return no("battery saver");
    if (slow > 6 && !/[?&]diorama\b/.test(location.search)) return no("too slow");   /* ?diorama (tests): always draw */
    if (threeState === "failed") return no("three.js failed"); if (!hasWebGL()) return no("no WebGL");
    if (typeof navigator !== "undefined" && navigator.webdriver && !/[?&](assets|diorama)\b/.test(location.search)) return no("screen test");   // screen tests keep the classic view unless they ask
    why = ""; return true;
  }

  // ---------------------------------------------------------------- the scene
  let V = null;   // everything built: { renderer, scene, camera, ... }
  const TEX = {}, LOADED = new Set();
  function tex(name, wrap) {
    if (TEX[name]) return TEX[name];
    const t = new THREE.TextureLoader().load(name + ".webp", () => LOADED.add(name));
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4; TEX[name] = t; return t;
  }
  const ready = () => K().FILES.every((f) => LOADED.has(f));

  /* cut-outs that turn to face you: one instanced quad per kind; position, size and mirror per instance */
  const CARD_VS = `
    attribute vec3 iPos; attribute vec2 iSize; attribute float iFlip;
    uniform vec3 camRight; uniform vec3 heroPos; uniform vec3 camPos; uniform float fogMul;
    varying vec2 vUv; varying float vFog; varying float vFade;
    void main() {
      vUv = uv;
      vec3 r = normalize(vec3(camRight.x, 0.0, camRight.z));
      vec3 wp = iPos + r * position.x * iSize.x * iFlip + vec3(0.0, position.y * iSize.y, 0.0);
      vec4 mv = viewMatrix * vec4(wp, 1.0);
      vFog = -mv.z * fogMul;
      // see-through: something tall standing between you and the camera fades so it never hides you
      float dHero = distance(camPos.xz, heroPos.xz), dMe = distance(camPos.xz, iPos.xz);
      float lat = abs(dot(iPos.xz - heroPos.xz, r.xz));
      vFade = (iSize.y > 2.5 && dMe < dHero - 2.5 && lat < 6.0 + iSize.x * 0.5) ? 0.22 : 1.0;
      gl_Position = projectionMatrix * mv;
    }`;
  const CARD_FS = `
    uniform sampler2D map; uniform vec3 tint; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
    varying vec2 vUv; varying float vFog; varying float vFade;
    void main() {
      vec4 c = texture2D(map, vUv);
      if (c.a < 0.45) discard;
      if (vFade < 1.0) { vec2 p = floor(gl_FragCoord.xy); if (mod(p.x + p.y, 2.0) < 1.0 || mod(p.y, 2.0) < 1.0) discard; }
      vec3 col = c.rgb * tint;
      col = mix(col, fogColor, smoothstep(fogNear, fogFar, vFog));
      gl_FragColor = vec4(col, 1.0);
    }`;
  function cardMaterial(map) {
    return new THREE.ShaderMaterial({ vertexShader: CARD_VS, fragmentShader: CARD_FS, side: THREE.DoubleSide,
      uniforms: { map: { value: map }, tint: { value: new THREE.Color(1, 1, 1) }, camRight: { value: new THREE.Vector3(1, 0, 0) }, heroPos: { value: new THREE.Vector3() }, camPos: { value: new THREE.Vector3() },
        fogColor: { value: new THREE.Color(0x8e9fae) }, fogNear: { value: 30 }, fogFar: { value: 190 }, fogMul: { value: 1 } } });
  }
  function cardMesh(kind, max, file) {
    const map = tex(file || K().PROPS[kind].file), img = map.image, aspect = img && img.width ? img.width / img.height : 0.6;
    const base = new THREE.PlaneGeometry(1, 1); base.translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    g.setAttribute("iPos", new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3));
    g.setAttribute("iSize", new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2));
    g.setAttribute("iFlip", new THREE.InstancedBufferAttribute(new Float32Array(max), 1));
    g.instanceCount = 0;
    const m = new THREE.Mesh(g, cardMaterial(map)); m.frustumCulled = false; m.userData = { kind, aspect, max };
    return m;
  }

  /* the finish: depth blur above and below the focus line, a soft glow, a grade, a frame */
  const POST_FS = `
    uniform sampler2D t; uniform vec2 res; uniform float focus, band, blur, taps, dark; uniform vec3 grade; varying vec2 vUv;
    void main(){
      vec3 base = texture2D(t, vUv).rgb;
      float d = max(0., abs(vUv.y - focus) - band) / (1. - band);
      float r = d * d * blur * 2.2;
      vec3 acc = base; float wsum = 1.; vec3 glow = vec3(0.);
      for (int i = 0; i < 20; i++) {
        if (float(i) >= taps) break;
        float fi = float(i) + .5, a = fi * 2.39996, rr = sqrt(fi / taps);
        vec2 o = vec2(cos(a), sin(a)) * rr;
        acc += texture2D(t, vUv + o * r / res).rgb; wsum += 1.;
        glow += max(texture2D(t, vUv + o * 14. / res).rgb - .62, 0.);
      }
      vec3 col = acc / wsum + glow / taps * .8;
      col *= grade;
      float l = dot(col, vec3(.3,.59,.11));
      col = mix(vec3(l), col, 1.06);
      col = mix(col, col * vec3(.84,.92,1.05), (1. - l) * .22);
      vec2 q = vUv - .5; col *= 1. - dot(q * vec2(1., 1.25), q * vec2(1., 1.25)) * (.5 + dark);
      gl_FragColor = vec4(col, 1.);
    }`;

  function build(host) {
    const canvas = document.createElement("canvas"); canvas.className = "dio-cv"; canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: /[?&]diorama\b/.test(location.search) /* tests read the picture back */ }); } catch { canvas.remove(); webgl = false; return null; }
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 2, 0.5, 2600);
    const fogU = []; // every material that follows the fog
    const basic = (map, o = {}) => new THREE.MeshBasicMaterial({ map, ...o });
    // sky and two ridges: rings round the camera, far enough to count as the horizon. They move with you but never
    // turn: turning the camera simply looks round at them, like the real horizon (no sliding or racing)
    const ring = (file, r, h, base, repeat, order) => {
      const t = tex(file, true); t.repeat.set(repeat, 1);
      const g = new THREE.CylinderGeometry(r, r, h, 96, 1, true); g.translate(0, h / 2, 0);
      const m = new THREE.Mesh(g, basic(t, { transparent: true, depthWrite: false, fog: false, side: THREE.BackSide }));
      m.userData = { base }; m.renderOrder = order; m.frustumCulled = false; scene.add(m); return m;
    };
    const sky = ring("dio-sky", 1500, 1500, -300, 3, -10);
    const backs = [ring("dio-far", 900, 1400 * 0.2 * 1.1, -16, 4, -9), ring("dio-mid", 430, 620 * 0.168 * 1.1, -28, 4, -8)];
    const farGround = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8e9fae, depthWrite: false })); farGround.renderOrder = -11; scene.add(farGround);   // never hides the ridges behind it
    // the ground patch round you (rebuilt as you go) and the road ribbon
    const gGeo = new THREE.PlaneGeometry(240, 240, 96, 96); gGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(gGeo, basic(tex("dio-floor", true))); ground.frustumCulled = false; scene.add(ground);
    const edge = document.createElement("canvas"); edge.width = 64; edge.height = 4; const eg = edge.getContext("2d");
    const gr = eg.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, "#000"); gr.addColorStop(0.2, "#fff"); gr.addColorStop(0.8, "#fff"); gr.addColorStop(1, "#000"); eg.fillStyle = gr; eg.fillRect(0, 0, 64, 4);
    const road = new THREE.Mesh(new THREE.BufferGeometry(), basic(tex("dio-road", true), { alphaMap: new THREE.CanvasTexture(edge), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    road.renderOrder = 1; road.frustumCulled = false; scene.add(road);
    // soft blob shadows under everything
    const sc = document.createElement("canvas"); sc.width = sc.height = 64; const sg = sc.getContext("2d");
    const rad = sg.createRadialGradient(32, 32, 2, 32, 32, 31); rad.addColorStop(0, "rgba(20,24,20,.5)"); rad.addColorStop(1, "rgba(20,24,20,0)"); sg.fillStyle = rad; sg.fillRect(0, 0, 64, 64);
    const shadowTex = new THREE.CanvasTexture(sc);
    const shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }), 4000);
    shadows.count = 0; shadows.renderOrder = 2; shadows.frustumCulled = false; scene.add(shadows);
    // the cut-outs, one mesh per kind
    const cards = {};
    for (const kind of Object.keys(K().PROPS)) { const m = cardMesh(kind, K().PROPS[kind].tree ? 1800 : 2600); cards[kind] = m; scene.add(m); }
    // you: drawn into a small canvas each frame (mapride.js), shown as a cut-out standing on the road
    const hc = document.createElement("canvas"); hc.width = 320; hc.height = 320; const hg = hc.getContext("2d");
    const heroTex = new THREE.CanvasTexture(hc);
    const HS = 3.6, hgeo = new THREE.PlaneGeometry(HS, HS); hgeo.translate(0, HS / 2 - HS * (24 / 320), 0);
    const hero = new THREE.Mesh(hgeo, basic(heroTex, { alphaTest: 0.35, side: THREE.DoubleSide, fog: true })); hero.renderOrder = 3; scene.add(hero);
    const heroShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); scene.add(heroShadow);
    // water: rivers as ribbons along the map's river lines, lakes and the sea as one level sheet; a painted streak
    // texture drifting with the current
    const wc = document.createElement("canvas"); wc.width = wc.height = 256; const wg = wc.getContext("2d");
    wg.fillStyle = "#4d6d7c"; wg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 140; i++) { const y = R().rand(i, 1, 5) * 256, x = R().rand(i, 2, 5) * 256, l = 20 + R().rand(i, 3, 5) * 70; wg.strokeStyle = `rgba(${R().rand(i, 4, 5) < 0.5 ? "214,228,232" : "40,62,74"},${0.12 + R().rand(i, 6, 5) * 0.25})`; wg.lineWidth = 1 + R().rand(i, 7, 5) * 2; wg.beginPath(); wg.moveTo(x, y); wg.lineTo(x + l, y + (R().rand(i, 8, 5) - 0.5) * 4); wg.stroke(); }
    const waterTex = new THREE.CanvasTexture(wc); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    const waterMat = new THREE.MeshBasicMaterial({ map: waterTex, transparent: true, opacity: 0.93, depthWrite: false });
    const river = new THREE.Mesh(new THREE.BufferGeometry(), waterMat); river.renderOrder = 0.5; river.frustumCulled = false; scene.add(river);
    const lakeTex = waterTex.clone(); lakeTex.needsUpdate = true; lakeTex.repeat.set(24, 24);
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: lakeTex, transparent: true, opacity: 0.94, depthWrite: false }));
    lake.renderOrder = 0.5; lake.visible = false; scene.add(lake);
    // places and bridges: cut-outs made when first needed
    const places = {};
    // snow
    const N = phone() ? 700 : 1400, sp = new Float32Array(N * 3), rr = (i) => R().rand(i, 7, 9);
    for (let i = 0; i < N; i++) { sp[i * 3] = (rr(i) - 0.5) * 80; sp[i * 3 + 1] = R().rand(i, 3, 2) * 28; sp[i * 3 + 2] = (R().rand(i, 5, 1) - 0.5) * 60; }
    const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const fc = document.createElement("canvas"); fc.width = fc.height = 32; const fg = fc.getContext("2d");
    const fr = fg.createRadialGradient(16, 16, 0, 16, 16, 15); fr.addColorStop(0, "rgba(255,255,255,.95)"); fr.addColorStop(1, "rgba(255,255,255,0)"); fg.fillStyle = fr; fg.fillRect(0, 0, 32, 32);
    const snow = new THREE.Points(sgeo, new THREE.PointsMaterial({ size: 0.2, map: new THREE.CanvasTexture(fc), transparent: true, depthWrite: false, opacity: 0.85 }));
    snow.visible = false; snow.renderOrder = 5; snow.frustumCulled = false; scene.add(snow);
    scene.fog = new THREE.Fog(0x8e9fae, 30, 190);
    // the finish
    const rt = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    const post = new THREE.ShaderMaterial({ uniforms: { t: { value: rt.texture }, res: { value: new THREE.Vector2(1, 1) }, focus: { value: 0.38 }, band: { value: 0.14 }, blur: { value: 8 }, taps: { value: 14 }, grade: { value: new THREE.Vector3(1, 1, 1) }, dark: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }", fragmentShader: POST_FS, depthTest: false, depthWrite: false });
    const postScene = new THREE.Scene(), postCam = new THREE.Camera(); postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
    return { canvas, renderer, scene, camera, sky, backs, farGround, gGeo, ground, road, shadows, cards, hero, hg, heroTex, heroShadow, snow, rt, post, postScene, postCam, river, waterTex, lake, lakeTex, places, placeList: [], labels: new Map(),
      w: 0, h: 0, prof: null, profKey: "", sDisp: null, sTarget: null, vEst: 0, lastS: null, hint: null, patch: null, yaw: null, camY: null, rideSt: {}, stride: 0, dbg: {} };
  }

  // ---------------------------------------------------------------- the world round you
  const hAt = (p) => { try { return typeof FPREAL !== "undefined" ? FPREAL.heightAt(p) : 0; } catch { return 0; } };
  const CELL = 6, RAD = 115, LAKE_LEVEL = new Map();
  /* the ground patch, the road ribbon and what grows, round (cx, cz); rebuilt every ~25 m */
  function rebuild(cx, cz, kit) {
    const P = V.prof, D = R();
    // ground
    const p = V.gGeo.attributes.position, uv = V.gGeo.attributes.uv;
    if (!V.gGeo.userData.base) V.gGeo.userData.base = Float32Array.from(p.array);
    const b = V.gGeo.userData.base;
    let hint = V.hint;
    const TR = typeof Terrain !== "undefined" ? Terrain : null, TT = TR?.T || {};
    const segs = TR ? D.riverSegs(TR.rivers, cx, cz, 170) : [];
    const lakeH = [];
    const tile = Math.floor(cx / 600) + "," + Math.floor(cz / 600);
    let level = LAKE_LEVEL.get(tile);
    if (level === undefined && TR) {
      const hs = [];
      for (let x = Math.floor(cx / 600) * 600 - 300; x < Math.floor(cx / 600) * 600 + 900; x += 15) for (let z = Math.floor(cz / 600) * 600 - 300; z < Math.floor(cz / 600) * 600 + 900; z += 15) {
        let ty = -1; try { ty = TR.typeAtPos(D.toMap(x, z)); } catch { /* off the map */ }
        if (ty === TT.SEA || ty === TT.LAKE) hs.push(hAt(D.toMap(x, z)) * D.HS);
      }
      hs.sort((a, c) => a - c); level = hs.length > 4 ? hs[Math.floor(hs.length * 0.1)] - 0.6 : null; LAKE_LEVEL.set(tile, level);
    }
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3] + cx, z = b[i * 3 + 2] + cz;
      let y = D.land(P, x, z, hAt, hint);
      // water: the river's channel and lake or sea beds sink below the banks
      if (segs.length) { const rd = D.riverDist(segs, x, z); if (rd < 8) { const k = rd < 3.5 ? 1 : 1 - (rd - 3.5) / 4.5; y -= 2.2 * k * k * (3 - 2 * k); } }
      if (TR) { let ty = -1; try { ty = TR.typeAtPos(D.toMap(x, z)); } catch { /* off the map */ } if (ty === TT.SEA || ty === TT.LAKE) { lakeH.push(y); y = level != null ? Math.min(y - 2.6, level - 1.6) : y - 2.6; } }
      p.setXYZ(i, x, y, z); uv.setXY(i, x / 9, -z / 9);
    }
    // the lake / sea sheet sits a little under the lowest shore round it
    if (lakeH.length > 6 && level != null) { V.lake.visible = true; V.lake.position.set(cx, level, cz); } else V.lake.visible = false;
    // river ribbons, 9 m wide, a metre under the banks
    { const pos = [], uvs = [], idx = []; let k = 0;
      for (const [ax, az, bx, bz] of segs) {
        const L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
        const nx = -(bz - az) / L * 4.5, nz = (bx - ax) / L * 4.5, steps = Math.max(1, Math.ceil(L / 3));
        for (let q = 0; q <= steps; q++) {
          const x = ax + (bx - ax) * q / steps, z = az + (bz - az) * q / steps, y = D.land(P, x, z, hAt, hint) - 1.0, v = q * 3 / 9;
          pos.push(x + nx, y, z + nz, x - nx, y, z - nz); uvs.push(0, v, 1, v);
          if (q) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
          k++;
        }
      }
      const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); if (idx.length) rg.setIndex(idx);
      V.river.geometry.dispose(); V.river.geometry = rg; V.river.material.side = THREE.DoubleSide; V.river.visible = idx.length > 0; }
    V.dbg.rivers = segs.length; V.dbg.lake = V.lake.visible;
    const wet = (x, z) => {
      let ty = -1; try { ty = TR ? TR.typeAtPos(D.toMap(x, z)) : -1; } catch { /* off the map */ }
      if (ty === TT.SEA || ty === TT.LAKE || ty === TT.RIVER) return true;
      return TR ? D.riverDist(D.riverSegs(TR.rivers, x, z, 40), x, z) < 10 : false;
    };
    V.wet = wet;
    // bridges where the road crosses a river on a real bridge (a ford stays a ford)
    const bridges = D.crossings(P, segs).filter((c) => { try { return !TR || TR.typeAtPos(D.toMap(c.x, c.z)) !== TT.RIVER; } catch { return true; } });   // the map grid is coarse: any crossing that isn't a ford gets a bridge
    V.dbg.bridges = bridges.length;
    p.needsUpdate = true; uv.needsUpdate = true; V.gGeo.computeBoundingSphere();
    // road: the profile points within reach, a ribbon 5.2 m wide
    const pos = [], uvs = [], idx = []; const W = 2.6; let k = 0;
    for (const q of P.pts) {
      if (Math.abs(q.x - cx) > 130 || Math.abs(q.z - cz) > 130) continue;
      const nx = -q.tz, nz = q.tx, y = q.y + 0.05;
      pos.push(q.x + nx * W, y, q.z + nz * W, q.x - nx * W, y, q.z - nz * W); uvs.push(0, q.s / 5, 1, q.s / 5);
      if (k) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      k++;
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); rg.setIndex(idx);
    V.road.geometry.dispose(); V.road.geometry = rg; V.road.material.side = THREE.DoubleSide;
    // what grows: a seeded pick per 6 m cell, the same every time for that spot
    const lists = {}; for (const kind of Object.keys(K().PROPS)) lists[kind] = [];
    const sh = [];
    const pickFrom = (mix, u) => { let a = 0; for (const [kk, w] of Object.entries(mix)) { a += w; if (u <= a) return kk; } return Object.keys(mix)[0]; };
    const c0x = Math.floor((cx - RAD) / CELL), c1x = Math.floor((cx + RAD) / CELL), c0z = Math.floor((cz - RAD) / CELL), c1z = Math.floor((cz + RAD) / CELL);
    for (let i = c0x; i <= c1x; i++) for (let j = c0z; j <= c1z; j++) {
      for (let n = 0; n < 2; n++) {
        const x = (i + D.rand(i, j, 11 + n)) * CELL, z = (j + D.rand(i, j, 21 + n)) * CELL;
        const r = D.near(P, x, z); if (r.d < 2.9) continue;
        if (segs.length && D.riverDist(segs, x, z) < 6) continue;   // nothing grows in the river
        { let ty = -1; try { ty = TR ? TR.typeAtPos(D.toMap(x, z)) : -1; } catch { /* off the map */ } if (ty === TT.SEA || ty === TT.LAKE) continue; }
        const tall = n === 0 && r.d > 3.8 && (r.side < 0 || r.d > 26) && D.rand(i, j, 31) < kit.trees;
        const small = !tall && D.rand(i, j, 41 + n) < kit.clutter * (r.d < 12 ? 1 : 0.55);
        if (!tall && !small) continue;
        const kind = tall ? pickFrom(kit.treeMix, D.rand(i, j, 51)) : pickFrom(kit.clutterMix, D.rand(i, j, 61 + n));
        const Pp = K().PROPS[kind], s = D.rand(i, j, 71 + n), hgt = Pp.h[0] + (Pp.h[1] - Pp.h[0]) * s, y = D.land(P, x, z, hAt, r.i) - 0.05;
        lists[kind].push([x, y, z, hgt, s > 0.5 ? 1 : -1]);
        if (Pp.shadow) sh.push([x, y, z, Pp.shadow * (0.8 + s * 0.4)]);
      }
    }
    for (const [kind, arr] of Object.entries(lists)) {
      const m = V.cards[kind], g = m.geometry, n = Math.min(arr.length, m.userData.max);
      const ip = g.attributes.iPos.array, is = g.attributes.iSize.array, iff = g.attributes.iFlip.array, asp = m.userData.aspect;
      for (let q = 0; q < n; q++) { const [x, y, z, hh, fl] = arr[q]; ip[q * 3] = x; ip[q * 3 + 1] = y; ip[q * 3 + 2] = z; is[q * 2] = hh * asp; is[q * 2 + 1] = hh; iff[q] = fl; }
      g.instanceCount = n; g.attributes.iPos.needsUpdate = g.attributes.iSize.needsUpdate = g.attributes.iFlip.needsUpdate = true;
    }
    // places: where they really are on the land, never on the road or in water
    const B = K().BRIDGE, PL = K().PLACES, Wd = typeof WORLD !== "undefined" ? WORLD.places || {} : {}, byFile = {};
    const list = [];
    for (const [name, pp] of Object.entries(Wd)) {
      if (!pp) continue; const kind = pp[2] || "town", art = PL[kind]; if (!art) continue;
      let [x, z] = D.toWorld(pp); const dd = Math.hypot(x - cx, z - cz); if (dd > 900) continue;
      const r = D.near(P, x, z), q = P.pts[r.i], minD = 9 + art.h * 0.7;
      // on the road, or standing in water: move it back from the road on the far side (the camera looks from the other)
      // until it stands on dry land clear of the road; if there's none within 90 m it isn't shown
      const wetAt = (px, pz) => wet(px, pz) || D.near(P, px, pz).d < minD;
      if (wetAt(x, z)) {
        let ok = false;
        for (let k = minD; k <= minD + 90 && !ok; k += 6) { const nx = q.x + q.tz * k, nz = q.z - q.tx * k; if (!wetAt(nx, nz)) { x = nx; z = nz; ok = true; } }
        if (!ok) continue;
      }
      const y = D.land(P, x, z, hAt) - 0.4;
      list.push({ name, kind, x, y, z, h: art.h, file: art.file });
      (byFile[art.file] ||= []).push([x, y, z, art.h, 1]);
    }
    // bridges: built in 3D along the road. Two stone side walls with real thickness, painted with the bridge's arches and
    // parapet on their outer faces; a stone deck between them under the road; stone on the ends and tops
    for (const grp of V.bridgeMeshes || []) { V.scene.remove(grp); grp.traverse((o) => o.geometry && o.geometry.dispose()); }
    V.bridgeMeshes = [];
    tex(B.file);
    if (LOADED.has(B.file)) {
      if (!V.bridgeMats) {
        const img = TEX[B.file].image, c = document.createElement("canvas"); c.width = c.height = 128;
        c.getContext("2d").drawImage(img, img.width * 0.43, img.height * 0.4, img.width * 0.12, img.height * 0.3, 0, 0, 128, 128);   // a patch of the painted stonework
        const st = new THREE.CanvasTexture(c); st.wrapS = st.wrapT = THREE.RepeatWrapping;
        V.bridgeMats = { face: new THREE.MeshBasicMaterial({ map: TEX[B.file], alphaTest: 0.45 }), stone: new THREE.MeshBasicMaterial({ map: st }) };
      }
      const M = V.bridgeMats, img = TEX[B.file].image;
      for (const c of bridges) {
        const q = D.at(P, c.s), Hs = B.h, Lb = Hs * img.width / img.height, deckY = Hs * B.deck, half = 3.1, thick = 0.55;
        const grp = new THREE.Group();
        grp.position.set(c.x, q.y + 0.05 - deckY, c.z); grp.rotation.y = -Math.atan2(q.tz, q.tx);   // local x runs along the road
        for (const sd of [-1, 1]) {
          const g = new THREE.BoxGeometry(Lb, Hs, thick); g.translate(0, Hs / 2, sd * (half + thick / 2));
          grp.add(new THREE.Mesh(g, [M.stone, M.stone, M.stone, M.stone, M.face, M.face]));
        }
        const dg = new THREE.BoxGeometry(Lb - 0.3, 0.7, half * 2); dg.translate(0, deckY - 0.37, 0);
        grp.add(new THREE.Mesh(dg, M.stone));
        V.scene.add(grp); V.bridgeMeshes.push(grp);
      }
    } else if (bridges.length) V.wantBridge = true;
    for (const m of Object.values(V.places)) m.geometry.instanceCount = 0;
    for (const [file, arr] of Object.entries(byFile)) {
      let m = V.places[file];
      if (!m) { tex(file); if (!LOADED.has(file)) continue; m = V.places[file] = cardMesh(file, 40, file); m.material.uniforms.fogMul.value = file === B.file ? 1 : 0.45; V.scene.add(m); }
      const g = m.geometry, n = Math.min(arr.length, 40), ip = g.attributes.iPos.array, is = g.attributes.iSize.array, iff = g.attributes.iFlip.array, asp = m.userData.aspect;
      for (let q = 0; q < n; q++) { const [x, y, z, hh] = arr[q]; ip[q * 3] = x; ip[q * 3 + 1] = y; ip[q * 3 + 2] = z; is[q * 2] = hh * asp; is[q * 2 + 1] = hh; iff[q] = 1; }
      g.instanceCount = n; g.attributes.iPos.needsUpdate = g.attributes.iSize.needsUpdate = g.attributes.iFlip.needsUpdate = true;
    }
    V.placeList = list; V.dbg.places = list.map((o) => o.name);
    const d = new THREE.Object3D(), n = Math.min(sh.length, 4000);
    for (let q = 0; q < n; q++) { const [x, y, z, w] = sh[q]; d.position.set(x + w * 0.25, y + 0.04, z); d.scale.set(w * 1.6, 1, w * 0.7); d.updateMatrix(); V.shadows.setMatrixAt(q, d.matrix); }
    V.shadows.count = n; V.shadows.instanceMatrix.needsUpdate = true;
    V.patch = [cx, cz]; V.dbg.props = Object.fromEntries(Object.entries(lists).map(([kk, a]) => [kk, a.length]));
  }

  // ---------------------------------------------------------------- light: time of day and weather
  const TOD = {
    dawn: { tint: [1, 0.9, 0.86], grade: [1.05, 0.97, 0.95], dark: 0.05 },
    day: { tint: [1, 1, 1], grade: [1.03, 1, 0.96], dark: 0 },
    dusk: { tint: [1, 0.78, 0.62], grade: [1.08, 0.94, 0.84], dark: 0.12 },
    night: { tint: [0.5, 0.56, 0.76], grade: [0.92, 0.98, 1.12], dark: 0.28 },
  };
  function light(I, kit) {
    const st = I.sky || null, tod = TOD[st?.tod] ? st.tod : "day", wx = st?.weather || "clear", L = TOD[tod];
    let fog = new THREE.Color(kit.fog).lerp(new THREE.Color(0x5d7887), 0.45);
    if (tod === "night") fog = new THREE.Color(0x1f2a40); else if (tod === "dusk") fog.lerp(new THREE.Color(0x9a8274), 0.6); else if (tod === "dawn") fog.lerp(new THREE.Color(0xb39a98), 0.35);
    const thick = { fog: 0.35, blizzard: 0.3, snow: 0.7, rain: 0.7, storm: 0.6, ashstorm: 0.4, cloudy: 0.9 }[wx] || 1;
    if (wx === "fog" || wx === "blizzard") fog.lerp(new THREE.Color(0xd6dadc), 0.45 * (tod === "night" ? 0.3 : 1));
    const dull = { cloudy: 0.9, rain: 0.78, storm: 0.62, fog: 0.9, snow: 0.92, blizzard: 0.85 }[wx] || 1;
    const t = new THREE.Color(L.tint[0] * dull, L.tint[1] * dull, L.tint[2] * dull);
    return { tod, wx, fog, near: 30 * thick, far: 190 * thick, tint: t, grade: L.grade, dark: L.dark + (wx === "storm" ? 0.15 : 0), snow: ["snow", "blizzard"].includes(wx) };
  }

  // ---------------------------------------------------------------- one frame
  function drawHero(I, moving, pace, t, u) {
    const g = V.hg; g.clearRect(0, 0, 320, 320);
    const MR = typeof MAPRIDE !== "undefined" ? MAPRIDE : null;
    let ok = false;
    try {
      if (MR && I.riding && I.horse) { MR.mounted(g, 150, 296, 2.15, { look: I.look, coat: I.horse.coat, st: V.rideSt, t, moving, pace, reduce: !!I.reduce, id: I.id }); ok = true; }
      else if (MR) ok = MR.walker(g, I.look, 160, 296, 168, { clip: moving ? "walk" : "idle", u });
      if (!ok && typeof PAINTRIG !== "undefined" && I.look) { g.save(); g.translate(160, 296); g.scale(2.75, 2.75); ok = !!PAINTRIG.draw(g, I.look, { clip: moving ? "walk" : "idle", u, wt: null, shield: false }); g.restore(); }
    } catch { ok = false; }
    V.heroTex.needsUpdate = true;
    return ok;
  }
  function frame(host, I, dt, t, region) {
    if (!usable(I, region)) { detach(); return false; }
    if (!loadThree()) return false;
    if (!V || !V.canvas.isConnected || V.canvas.parentNode !== host) { detach(); V = build(host); if (!V) return false; }
    if (!ready()) return false;                          // the paintings are still arriving: classic view meanwhile
    const kit = K().of(region), D = R();
    // the route
    const pk = (I.origin || "") + ">" + (I.dest || "") + "|" + I.path.length;
    if (pk !== V.profKey) { V.prof = D.profile(I.path, hAt); V.profKey = pk; V.sDisp = null; V.patch = null; V.hint = null; if (!V.prof) return false; }
    const P = V.prof, [hx0, hz0] = D.toWorld(I.pos);
    const nr = D.near(P, hx0, hz0, V.hint); V.hint = nr.i;
    // where you are along the road, eased so the trip's updates glide instead of jumping
    const target = nr.s;
    if (V.sDisp == null || Math.abs(target - V.sDisp) > 80) { V.sDisp = target; V.vEst = 0; }
    if (V.sTarget != null && dt > 0) { const v = (target - V.sTarget) / Math.max(dt, 1e-3); if (target !== V.sTarget) V.vEst = V.vEst * 0.8 + clamp(v, 0, 12) * 0.2; }
    V.sTarget = target;
    const before = V.sDisp, gap = target - V.sDisp, vmax = Math.max(0.6, V.vEst * 1.6 + 0.5);
    if (!I.reduce) V.sDisp += clamp(gap, -vmax * dt, vmax * dt); else V.sDisp = target;
    const speed = dt > 0 ? (V.sDisp - before) / dt : 0, moving = !I.reduce && (speed > 0.15 || V.vEst > 0.15);
    const here = D.at(P, V.sDisp);
    // rebuild the land when you've moved on
    if (!V.patch || Math.hypot(here.x - V.patch[0], here.z - V.patch[1]) > 25) rebuild(here.x, here.z, kit);
    // size
    const w = host.clientWidth, h = host.clientHeight, pr = Math.min(devicePixelRatio || 1, phone() ? 1.5 : 1.75);
    if (w !== V.w || h !== V.h || V.pr !== pr) {
      V.w = w; V.h = h; V.pr = pr; V.renderer.setPixelRatio(pr); V.renderer.setSize(w, h, false);
      V.camera.aspect = w / Math.max(1, h); V.camera.fov = V.camera.aspect < 1.2 ? 44 : 30; V.camera.updateProjectionMatrix();
      V.rt.setSize(Math.round(w * pr), Math.round(h * pr)); V.post.uniforms.res.value.set(w * pr, h * pr);
      V.post.uniforms.taps.value = phone() ? 10 : 16; V.post.uniforms.blur.value = (phone() ? 6 : 8) * pr;
    }
    // the camera: beside the road, looking across it, a little behind you, turning gently with the road
    const ahead = D.at(P, V.sDisp + 14), back = D.at(P, V.sDisp - 14);
    let tx = ahead.x - back.x, tz = ahead.z - back.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    let yaw = Math.atan2(tz, tx);
    if (V.yaw == null || I.reduce) V.yaw = yaw; else { let d = yaw - V.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; V.yaw += d * Math.min(1, dt * 0.8); }
    // nearly there: the camera swings round to look down the road, so the place you're heading for comes into view
    const left = P.len - V.sDisp, swing = I.reduce ? 0 : 0.62 * (left > 170 ? 0 : left < 45 ? 1 : (170 - left) / 125);
    V.swing = V.swing == null ? swing : V.swing + (swing - V.swing) * Math.min(1, dt * 0.7);
    const camYaw = V.yaw + V.swing;
    const cx = Math.cos(camYaw), cz = Math.sin(camYaw);       // the way you're going, on screen: to the right
    const fx = cz, fz = -cx;                               // the camera looks across the road
    if (V.camY == null || I.reduce) V.camY = here.y; else V.camY += (here.y - V.camY) * Math.min(1, dt * 1.5);
    const tall = V.camera.aspect < 1.2, short = V.h < 200, away = tall ? 11 : short ? 8.5 : 16, up = tall ? 3.6 : short ? 2.8 : 4.2, lead = tall || short ? 0.7 : 2;
    const lx = here.x + cx * lead, lz = here.z + cz * lead;
    V.camera.position.set(lx - fx * away, V.camY + up, lz - fz * away);
    V.camera.lookAt(lx + cx * (tall ? 0.4 : 1) + fx * 1.5, V.camY + (short ? 2.1 : 2.9), lz + cz * (tall ? 0.4 : 1) + fz * 1.5);
    const right = new THREE.Vector3(cx, 0, cz);
    // you
    if (moving) V.stride += speed * dt / (I.riding ? 2.6 : 0.84);
    const pace = I.riding ? clamp(speed / 1.6, 0, 4) : 1;
    drawHero(I, moving, pace, t, V.stride % 1);
    V.hero.position.set(here.x, here.y, here.z); V.hero.rotation.y = -camYaw;
    V.heroShadow.position.set(here.x + 0.25, here.y + 0.05, here.z); V.heroShadow.scale.set(I.riding ? 3.2 : 1.5, 1, I.riding ? 1 : 0.6); V.heroShadow.rotation.y = -camYaw;
    // light
    const Lt = light(I, kit);
    V.scene.fog.color.copy(Lt.fog); V.scene.fog.near = Lt.near; V.scene.fog.far = Lt.far; V.farGround.material.color.copy(Lt.fog); V.renderer.setClearColor(Lt.fog);
    const gt = new THREE.Color(Lt.tint.r * kit.ground[0], Lt.tint.g * kit.ground[1], Lt.tint.b * kit.ground[2]);
    V.ground.material.color.copy(gt); if (V.bridgeMats) { V.bridgeMats.face.color.copy(Lt.tint); V.bridgeMats.stone.color.copy(Lt.tint); } V.road.material.color.copy(Lt.tint); V.hero.material.color.setRGB(Math.max(0.78, Lt.tint.r), Math.max(0.8, Lt.tint.g), Math.max(0.86, Lt.tint.b)); V.sky.material.color.copy(Lt.tint);   // you stay easy to see
    V.backs.forEach((b) => b.material.color.setRGB(Lt.tint.r * kit.far[0], Lt.tint.g * kit.far[1], Lt.tint.b * kit.far[2]));
    for (const m of [...Object.values(V.cards), ...Object.values(V.places)]) { const u = m.material.uniforms; u.tint.value.copy(Lt.tint); u.camRight.value.copy(right); u.heroPos.value.set(here.x, here.y, here.z); u.camPos.value.copy(V.camera.position); u.fogColor.value.copy(Lt.fog); u.fogNear.value = Lt.near; u.fogFar.value = Lt.far; }
    V.post.uniforms.grade.value.set(...Lt.grade); V.post.uniforms.dark.value = Lt.dark;
    // sky and ridges sit far off along the camera's view, turning with it
    const cpos = V.camera.position;
    V.sky.position.set(cpos.x, V.camY + V.sky.userData.base, cpos.z);
    for (const b of V.backs) { b.position.set(cpos.x, V.camY + b.userData.base, cpos.z); }
    V.farGround.position.set(cpos.x, Math.min(here.y, V.camY) - 0.8, cpos.z);
    // snow
    V.snow.visible = Lt.snow && !I.reduce;
    if (V.snow.visible) {
      const a = V.snow.geometry.attributes.position, arr = a.array;
      for (let i = 0; i < arr.length; i += 3) { arr[i + 1] -= dt * (1.4 + (i % 7) * 0.12) * (Lt.wx === "blizzard" ? 2 : 1); arr[i] += dt * (0.6 + Math.sin(t + i) * 0.4) * (Lt.wx === "blizzard" ? 4 : 1); if (arr[i + 1] < -2) arr[i + 1] = 26; if (arr[i] > 40) arr[i] -= 80; }
      a.needsUpdate = true; V.snow.position.set(here.x, V.camY, here.z); V.snow.rotation.y = -camYaw;
    }
    // a place's picture just arrived: put it in
    if (V.placeList.some((o) => LOADED.has(o.file) && !V.places[o.file]) || (V.wantBridge && LOADED.has(K().BRIDGE.file))) { V.patch = null; V.wantBridge = false; }
    // the current drifts down the river; the lake ripples slowly
    if (!I.reduce) { V.waterTex.offset.y -= dt * 0.12; V.lakeTex.offset.x += dt * 0.004; }
    labels(host, I, here);
    // draw: the scene, then the finish
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    V.renderer.setRenderTarget(V.rt); V.renderer.render(V.scene, V.camera);
    V.renderer.setRenderTarget(null); V.renderer.render(V.postScene, V.postCam);
    // too slow for this phone? frames that keep taking long hand back to the classic view
    // too slow for this phone? an average under ~18 pictures a second for 6 s hands back to the classic view
    if (dt > 0 && !I.reduce) { avgDt = avgDt ? avgDt * 0.95 + Math.min(dt, 0.25) * 0.05 : dt; if (avgDt > 0.055) slow += dt; else slow = Math.max(0, slow - dt); }
    V.dbg = { ...V.dbg, region, s: V.sDisp, len: P.len, moving, riding: !!I.riding, tod: Lt.tod, wx: Lt.wx, ms: (typeof performance !== "undefined" ? performance.now() : 0) - t0, y: here.y };
    return true;
  }
  /* names over the places you know (and the one you're heading for); an arrow at the edge while it's still off screen */
  function labels(host, I, here) {
    const seen = new Set(), v = new THREE.Vector3(), W = V.w, H = V.h, NMf = (n) => { try { return typeof NM !== "undefined" && NM.place ? NM.place(n) : n; } catch { return n; } };
    const knows = (n) => { try { return typeof I.known !== "function" || I.known(n); } catch { return true; } };
    const put = (key, text, x, y, cls) => {
      let el = V.labels.get(key);
      if (!el) { el = document.createElement("div"); el.className = "dio-lbl"; host.appendChild(el); V.labels.set(key, el); }
      if (el.textContent !== text) el.textContent = text;
      el.className = "dio-lbl" + (cls ? " " + cls : ""); el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) ${cls === "edge" ? "translate(-100%,-50%)" : "translate(-50%,-100%)"}`;
      seen.add(key);
    };
    for (const o of V.placeList) {
      const dest = o.name === I.dest; if (!dest && !knows(o.name)) continue;
      const d = Math.hypot(o.x - here.x, o.z - here.z); if (d > (dest ? 900 : 380)) continue;
      v.set(o.x, o.y + o.h * 1.02, o.z).project(V.camera);
      if (v.z > 1 || v.x < -1.05 || v.x > 1.05 || v.y < -1) { if (dest && v.z <= 1 && v.x > 1) put("edge", NMf(o.name) + " \u203A", W - 6, H * 0.36, "edge"); continue; }
      put(o.name, NMf(o.name), (v.x + 1) / 2 * W, Math.max(16, (1 - v.y) / 2 * H - 2), dest ? "dest" : "");   // tall places: the name stays inside the band
    }
    for (const [k, el] of V.labels) if (!seen.has(k)) { el.remove(); V.labels.delete(k); }
  }
  function detach() {
    if (!V) return;
    try { V.renderer.dispose(); V.rt.dispose(); } catch { /* gone */ }
    V.canvas.remove(); for (const el of V.labels.values()) el.remove(); V = null;
  }
  return { frame, detach, mode, setMode, settingsHTML, pref, usable, debug: () => (V ? V.dbg : null),
    /* tests: every cut-out and place as it stands now, and whether a spot is in water */
    _snap: () => V && { props: Object.entries(V.cards).flatMap(([k, m]) => { const a = m.geometry.attributes.iPos.array, n = m.geometry.instanceCount, out = []; for (let i = 0; i < n; i++) out.push([k, a[i * 3], a[i * 3 + 1], a[i * 3 + 2]]); return out; }),
      places: V.placeList.map((o) => ({ name: o.name, x: o.x, y: o.y, z: o.z, wet: V.wet ? V.wet(o.x, o.z) : null })), patch: V.patch, lake: V.lake.visible ? V.lake.position.y : null }, why: () => why || (threeState !== "ready" ? "loading three.js" : V && !ready() ? "loading paintings" : ""), _slow: () => slow };
})();
if (typeof module !== "undefined") module.exports = DIORAMA;
