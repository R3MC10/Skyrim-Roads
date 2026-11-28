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
    t.anisotropy = /dio-floor|dio-road/.test(name) ? MAXANI : 4; TEX[name] = t; return t;   // the ground is seen at a low angle: full anisotropic filtering keeps it sharp instead of smeared sideways
  }
  // a region's paintings, asked for (ground and ridges tile, so they wrap) and all here?
  let MAXANI = 8;   // set from the GPU once the renderer exists
  const ready = (kit) => K().filesFor(kit).every((f) => { tex(f, /dio-(floor|far|mid|sky|road)/.test(f)); return LOADED.has(f); });

  /* fog (one model for everything in the view): exponential height fog after Inigo Quilez's "better fog": the air is
     thickest low down and thins with height, so mist pools in hollows and along the ground while hilltops and the
     ridges' peaks stand out of it. Extinction and in-scattering per colour (blue scatters more), so far things turn
     soft and blue instead of a flat grey; the fog glows warm toward the sun; slow wisps of thicker and thinner air
     drift with the wind. dfMul shortens the distance for paintings that already carry their own haze (places, ridges). */
  const FOG_GLSL = `
    uniform vec3 dfCol, dfSun, dfSunDir, dfCam; uniform float dfA, dfHaze, dfB, dfBase, dfT, dfWisp, dfMax; uniform vec2 dfWind;
    float dfH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float dfN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(dfH(i), dfH(i + vec2(1., 0.)), f.x), mix(dfH(i + vec2(0., 1.)), dfH(i + 1.), f.x), f.y); }
    float dfLayer(float a, float k, float h0, float rdy, float dist){   // fog along a line of sight for density a * exp(-k * height), exact
      float kk = k * rdy, e = kk * dist;
      return a * exp(-k * h0) * (abs(e) > 1e-4 ? (1. - exp(-e)) / kk : dist);
    }
    vec3 dioFog(vec3 col, vec3 wp, float mul){   // mul < 0: the sky, infinitely far
      vec3 rd = wp - dfCam; float len = max(length(rd), 1e-4); rd /= len;
      float sky = mul < 0. ? 1. : 0., dist = sky > .5 ? 1e5 : len * mul, rdy = sky > .5 ? max(rd.y, .012) : rd.y, h0 = dfCam.y - dfBase;
      // a light haze (the air itself, thinning slowly with height) + a mist lying on the ground that thins fast:
      // along the horizon the sky never leaves the haze, looking up it soon does, so the land melts into a bright band
      float od = dfLayer(dfHaze, 1. / 120., h0, rdy, dist) + dfLayer(dfA, dfB, h0, rdy, dist);
      // wisps: thicker and thinner mist sampled at three points through the air in front of the surface, weighted
      // by how much mist is at that height, so you look through them instead of seeing them painted on the ground
      if (dfWisp > 0.01 && sky < .5) {
        float L = min(dist, 160.), w = 0.;
        for (int i = 0; i < 3; i++) {
          float sd = L * (float(i) + .5) / 3.; vec3 p = dfCam + rd * sd;
          float dens = dfA * exp(-dfB * max(p.y - dfBase, -6.));
          vec2 q = (p.xz - dfWind * dfT) * .03 + vec2(p.y * .05, 0.);
          float n = dfN(q) * .62 + dfN(q * 2.6 + 7.3) * .38;
          w += dens * (n - .47) * (L / 3.);
        }
        od += dfWisp * 2.4 * w;
      }
      vec3 ext = max(exp(-max(od, 0.) * vec3(.9, 1., 1.12)), vec3(1. - dfMax));
      float s = pow(max(dot(rd, dfSunDir), 0.), 5.);
      vec3 fc = mix(dfCol * .94, dfCol * 1.08 + .02, smoothstep(-.15, .12, rd.y));   // the mist is lit from above: brighter toward the sky
      return col * ext + mix(fc, dfSun, s * .6) * (1. - ext);
    }`;
  let FOGU = null;   // the fog's uniforms, shared by every material (made once three.js is here)
  const fogU = () => FOGU || (FOGU = { dfCol: { value: new THREE.Color(0x8e9fae) }, dfSun: { value: new THREE.Color(0xffe9c4) }, dfSunDir: { value: new THREE.Vector3(0, 0.3, 1) },
    dfA: { value: 0.012 }, dfHaze: { value: 0.0025 }, dfB: { value: 0.12 }, dfBase: { value: 0 }, dfT: { value: 0 }, dfWisp: { value: 0.15 }, dfMax: { value: 0.97 }, dfWind: { value: new THREE.Vector2(0, 0) }, dfCam: { value: new THREE.Vector3() } });   // dfCam: three.js doesn't hand its basic materials the camera's position
  /* three.js's own materials (ground, road, bridges, you, your company, the ridges) take the same fog: their fog lines
     are swapped for dioFog. material.userData.dfMul shortens the distance; a material with fog: false keeps none. */
  function patchFog() {
    const M = THREE.MeshBasicMaterial.prototype;
    if (M.__dioFog) return; M.__dioFog = true;
    M.onBeforeCompile = function (sh) {
      if (!this.fog) return;
      Object.assign(sh.uniforms, fogU(), { dfMul: { value: (this.userData && this.userData.dfMul) || 1 } });
      sh.vertexShader = sh.vertexShader.replace("#include <fog_pars_vertex>", "varying vec3 vDioW;")
        .replace("#include <fog_vertex>", "{ vec4 dw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n dw = instanceMatrix * dw;\n#endif\n vDioW = (modelMatrix * dw).xyz; }");
      sh.fragmentShader = sh.fragmentShader.replace("#include <fog_pars_fragment>", "varying vec3 vDioW; uniform float dfMul;" + FOG_GLSL)
        .replace("#include <fog_fragment>", "gl_FragColor.rgb = dioFog(gl_FragColor.rgb, vDioW, dfMul);");
    };
  }

  /* cut-outs that turn to face you: one instanced quad per kind; position, size and mirror per instance */
  const CARD_VS = `
    attribute vec3 iPos; attribute vec2 iSize; attribute float iFlip;
    uniform vec3 camRight; uniform vec3 heroPos; uniform vec3 camPos; uniform float fogMul;
    varying vec2 vUv; varying vec3 vW; varying float vFade;
    void main() {
      vUv = uv;
      vec3 r = normalize(vec3(camRight.x, 0.0, camRight.z));
      vec3 wp = iPos + r * position.x * iSize.x * iFlip + vec3(0.0, position.y * iSize.y, 0.0);
      vec4 mv = viewMatrix * vec4(wp, 1.0);
      vW = wp;
      // see-through: something tall standing between you and the camera fades so it never hides you
      float dHero = distance(camPos.xz, heroPos.xz), dMe = distance(camPos.xz, iPos.xz);
      float lat = abs(dot(iPos.xz - heroPos.xz, r.xz));
      vFade = (iSize.y > 2.5 && dMe < dHero - 2.5 && lat < 6.0 + iSize.x * 0.5) ? 0.22 : 1.0;
      gl_Position = projectionMatrix * mv;
    }`;
  const CARD_FS = `
    uniform sampler2D map; uniform vec3 tint; uniform float fogMul;
    varying vec2 vUv; varying vec3 vW; varying float vFade;${FOG_GLSL}
    void main() {
      vec4 c = texture2D(map, vUv);
      if (c.a < 0.45) discard;
      if (vFade < 1.0) { vec2 p = floor(gl_FragCoord.xy); if (mod(p.x + p.y, 2.0) < 1.0 || mod(p.y, 2.0) < 1.0) discard; }
      vec3 col = c.rgb * tint;
      col = dioFog(col, vW, fogMul);
      gl_FragColor = vec4(col, 1.0);
    }`;
  function cardMaterial(map) {
    return new THREE.ShaderMaterial({ vertexShader: CARD_VS, fragmentShader: CARD_FS, side: THREE.DoubleSide,
      uniforms: { map: { value: map }, tint: { value: new THREE.Color(1, 1, 1) }, camRight: { value: new THREE.Vector3(1, 0, 0) }, heroPos: { value: new THREE.Vector3() }, camPos: { value: new THREE.Vector3() },
        fogMul: { value: 1 }, ...fogU() } });
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
    uniform sampler2D t; uniform vec2 res; uniform float focus, band, blur, taps, dark, wo, woT; uniform vec2 woDir; uniform vec3 grade; varying vec2 vUv;
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
      if (wo > .01) {   // whiteout drifting past in patches, carried by the wind
        vec2 p = vUv * vec2(res.x / res.y, 1.) * 1.6 - woDir * woT * .02;
        float n = sin(p.x * 2.1 + woT * .21) * sin(p.y * 2.7 - woT * .17) + .6 * sin(p.x * 4.3 - p.y * 3.1 + woT * .33);
        col = mix(col, vec3(.93, .95, .98) * grade, wo * .08 * smoothstep(-.6, 1.3, n));
      }
      vec2 q = vUv - .5; col *= 1. - dot(q * vec2(1., 1.25), q * vec2(1., 1.25)) * (.5 + dark);
      gl_FragColor = vec4(col, 1.);
    }`;

  /* the ground: the painting is laid on from above where the land is flat and from the side where it is steep
     (triplanar), so embankments never stretch it into streaks; across a region border it blends from the last
     region's ground (map2, oldTint) to the new one over ~60 m, along a line across the road where you crossed (edge) */
  function groundMat(map) {
    const m = new THREE.MeshBasicMaterial({ map }), fogP = THREE.MeshBasicMaterial.prototype.onBeforeCompile;
    m.userData.tri = { map2: { value: map }, oldTint: { value: new THREE.Color(1, 1, 1) }, edge: { value: new THREE.Vector4(0, 0, 1, 0) }, edgeOn: { value: 0 } };
    m.onBeforeCompile = function (sh, r) {
      fogP.call(this, sh, r);
      Object.assign(sh.uniforms, m.userData.tri);
      sh.vertexShader = sh.vertexShader.replace("varying vec3 vDioW;", "varying vec3 vDioW; varying vec3 vTriN;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n vTriN = normalize(mat3(modelMatrix) * normal);");
      sh.fragmentShader = sh.fragmentShader.replace("varying vec3 vDioW;", "varying vec3 vDioW; varying vec3 vTriN; uniform sampler2D map2; uniform vec3 oldTint; uniform vec4 edge; uniform float edgeOn;")
        .replace("#include <map_fragment>", `
          vec3 tn = normalize(vTriN), tw = pow(abs(tn), vec3(4.)); tw /= tw.x + tw.y + tw.z;
          vec2 ua = vDioW.xz * vec2(1., -1.) / 9., ub = vec2(vDioW.x, -vDioW.y) / 9., uc = vec2(vDioW.z, -vDioW.y) / 9.;
          // seen at a very low angle the painting's clumps squash into stripes; real ground just looks smooth there,
          // so it eases toward the painting's soft average colour (a blurrier level of the same texture)
          float sharp = smoothstep(.05, .32, abs(dot(normalize(vDioW - dfCam), tn)));
          vec4 t1 = mix(texture2D(map, ua, 5.) * tw.y + texture2D(map, ub, 5.) * tw.z + texture2D(map, uc, 5.) * tw.x, texture2D(map, ua) * tw.y + texture2D(map, ub) * tw.z + texture2D(map, uc) * tw.x, sharp);
          diffuseColor *= mapTexelToLinear(t1);
          if (edgeOn > 0.) {
            vec4 t0 = mix(texture2D(map2, ua, 5.) * tw.y + texture2D(map2, ub, 5.) * tw.z + texture2D(map2, uc, 5.) * tw.x, texture2D(map2, ua) * tw.y + texture2D(map2, ub) * tw.z + texture2D(map2, uc) * tw.x, sharp);
            float f = smoothstep(-25., 25., dot(vDioW.xz - edge.xy, edge.zw) + (texture2D(map, vDioW.xz / 61.).g - .5) * 30.);   // a ragged line
            diffuseColor.rgb = mix(oldTint * mapTexelToLinear(t0).rgb, diffuseColor.rgb, f);
          }`);
    };
    m.customProgramCacheKey = () => "dio-ground";
    return m;
  }
  function build(host) {
    const canvas = document.createElement("canvas"); canvas.className = "dio-cv"; canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: /[?&]diorama\b/.test(location.search) /* tests read the picture back */ }); } catch { canvas.remove(); webgl = false; return null; }
    patchFog();
    MAXANI = Math.min(16, renderer.capabilities.getMaxAnisotropy() || 4); for (const [k, t] of Object.entries(TEX)) if (/dio-floor|dio-road/.test(k)) { t.anisotropy = MAXANI; t.needsUpdate = true; }
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 2, 0.5, 2600);
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
    sky.material.fog = true; sky.material.userData.dfMul = -1;   // the sky takes the fog as infinitely far: a bright band at the horizon
    // a haze band round the horizon in the fog colour, between the sky and the ridges: the ridges' misty, see-through
    // feet never let the sky's sunrise colour show through as a strip
    const hzc = document.createElement("canvas"); hzc.width = 4; hzc.height = 64; const hgc = hzc.getContext("2d");
    const hgr = hgc.createLinearGradient(0, 0, 0, 64); hgr.addColorStop(0, "rgba(255,255,255,0)"); hgr.addColorStop(0.45, "rgba(255,255,255,1)"); hgr.addColorStop(1, "rgba(255,255,255,1)");
    hgc.fillStyle = hgr; hgc.fillRect(0, 0, 4, 64);
    const hazeG = new THREE.CylinderGeometry(1450, 1450, 260, 64, 1, true); hazeG.translate(0, 130, 0);
    const haze = new THREE.Mesh(hazeG, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hzc), transparent: true, depthWrite: false, fog: false, side: THREE.BackSide }));
    haze.renderOrder = -9.5; haze.frustumCulled = false; haze.userData = { base: -200 }; scene.add(haze);
    const backs = [ring("dio-far", 900, 1400 * 0.2 * 1.1, -16, 4, -9), ring("dio-mid", 430, 620 * 0.168 * 1.1, -28, 4, -8)];
    backs.forEach((b, i) => { b.material.fog = true; b.material.userData.dfMul = i ? 0.09 : 0.06; });   // the ridges sit in the same fog: their feet in the mist, the peaks above it
    const farGround = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8e9fae, depthWrite: false }));   // the land beyond the patch: the forest floor, fading into the fog farGround.renderOrder = -11; scene.add(farGround);   // never hides the ridges behind it
    // the ground patch round you (rebuilt as you go) and the road ribbon
    const gGeo = new THREE.PlaneGeometry(240, 240, 96, 96); gGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(gGeo, groundMat(tex("dio-floor", true))); ground.frustumCulled = false; scene.add(ground);
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
    for (const kind of K().BASE) { const m = cardMesh(kind, K().PROPS[kind].tree ? 1800 : 2600); cards[kind] = m; scene.add(m); }   // a region's own cut-outs are added when it first needs them
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
    // water: deeper and darker in the middle, the sky's colour near the banks, two layers of ripples drifting with the
    // current, a faint pale line where it meets the bank, edges that fade into the ground; fog and time of day apply
    const waterMat = (lakeMode) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { map: { value: waterTex }, t: { value: 0 }, deep: { value: new THREE.Color(0x2c4652) }, shallow: { value: new THREE.Color(0x8fa6b2) }, tint: { value: new THREE.Color(1, 1, 1) },
        lake: { value: lakeMode ? 1 : 0 }, ...fogU() },
      vertexShader: "varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; gl_Position = projectionMatrix * mv; }",
      fragmentShader: `uniform sampler2D map; uniform float t, lake; uniform vec3 deep, shallow, tint; varying vec2 vUv; varying vec3 vW;${FOG_GLSL}
        void main(){
          float e = lake > 0.5 ? 1.0 : min(vUv.x, 1.0 - vUv.x) * 2.0;           // 0 at the banks, 1 mid-stream
          vec2 p = lake > 0.5 ? vW.xz / 22.0 : vec2(vUv.x, vUv.y);
          vec2 f1 = lake > 0.5 ? vec2(t * 0.004, t * 0.002) : vec2(0.0, -t * 0.12), f2 = lake > 0.5 ? vec2(-t * 0.003, t * 0.005) : vec2(0.3, -t * 0.21);
          float r = dot(texture2D(map, p + f1).rgb, vec3(0.333)) * 0.5 + dot(texture2D(map, p * 1.7 + f2).rgb, vec3(0.333)) * 0.5;
          vec3 col = mix(shallow, deep, smoothstep(0.15, 0.95, e));
          col += (r - 0.36) * 0.45;
          float foam = lake > 0.5 ? 0.0 : smoothstep(0.06, 0.13, e) * (1.0 - smoothstep(0.13, 0.24, e)) * 0.3;
          col = mix(col, vec3(0.86, 0.9, 0.92), foam);
          col *= tint;
          col = dioFog(col, vW, 1.0);
          gl_FragColor = vec4(col, (lake > 0.5 ? 0.93 : smoothstep(0.0, 0.32, e) * 0.95));
        }` });
    const river = new THREE.Mesh(new THREE.BufferGeometry(), waterMat(false)); river.renderOrder = 0.5; river.frustumCulled = false; scene.add(river);
    const lakeTex = waterTex;
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), waterMat(true));
    lake.renderOrder = 0.5; lake.visible = false; scene.add(lake);
    // places and bridges: cut-outs made when first needed
    const places = {};
    // snow: the map's flakes, seen from the side (dioramasnow.js)
    const snow = typeof DIOSNOW !== "undefined" ? DIOSNOW.make(THREE, phone() ? 700 : 1400) : null;
    if (snow) scene.add(snow.mesh);
    scene.fog = new THREE.Fog(0x8e9fae, 30, 190);
    // the finish
    const rt = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    const post = new THREE.ShaderMaterial({ uniforms: { t: { value: rt.texture }, res: { value: new THREE.Vector2(1, 1) }, focus: { value: 0.38 }, band: { value: 0.18 }, blur: { value: 8 }, taps: { value: 14 }, grade: { value: new THREE.Vector3(1, 1, 1) }, dark: { value: 0 }, wo: { value: 0 }, woT: { value: 0 }, woDir: { value: new THREE.Vector2(0, 0) } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }", fragmentShader: POST_FS, depthTest: false, depthWrite: false });
    const postScene = new THREE.Scene(), postCam = new THREE.Camera(); postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
    return { haze, shadowTex, actors: new Map(), canvas, renderer, scene, camera, sky, backs, farGround, gGeo, ground, road, shadows, cards, hero, hg, heroTex, heroShadow, snow, rt, post, postScene, postCam, river, waterTex, lake, lakeTex, places, placeList: [], labels: new Map(),
      w: 0, h: 0, prof: null, profKey: "", sDisp: null, sTarget: null, vEst: 0, lastS: null, hint: null, patch: null, yaw: null, camY: null, rideSt: {}, stride: 0, dbg: {} };
  }

  // ---------------------------------------------------------------- the world round you
  const hAt = (p) => { try { return typeof FPREAL !== "undefined" ? FPREAL.heightAt(p) : 0; } catch { return 0; } };
  const CELL = 6, RAD = 115, LAKE_LEVEL = new Map();
  /* the ground patch, the road ribbon and what grows, round (cx, cz); rebuilt every ~25 m */
  /* the regions along the road, worked out once per trip from the map with the same survey the game uses for where
     you are, so each region begins at a fixed place on the land and you see it coming as you travel. Stretches under
     60 m merge into the land round them. If the game names a region that the map doesn't show here (or there's no map),
     that region holds for the whole trip. */
  function regionsAlong(P, region, pos) {
    const S = typeof FPSCENE !== "undefined" ? FPSCENE : null, D = R(), want = K().of(region);
    let start = null; try { start = S && pos ? S.survey(pos) : null; } catch { start = null; }
    if (!S || !start || start.region !== region) return [{ s0: -1e9, s1: 1e9, kit: want }];
    const step = 15, segs = [];
    for (let s = 0; s <= P.len; s += step) {
      const a = D.at(P, s); let k = null; try { const sv = S.survey(D.toMap(a.x, a.z)); k = sv ? K().of(sv.region) : null; } catch { k = null; }
      k = k || (segs.length ? segs[segs.length - 1].kit : want);
      if (segs.length && segs[segs.length - 1].kit === k) segs[segs.length - 1].s1 = s + step; else segs.push({ s0: s, s1: s + step, kit: k });
    }
    for (let i = 0; i < segs.length && segs.length > 1;) {   // a short stretch joins the one before it (or after, at the start)
      const g = segs[i]; if (g.s1 - g.s0 >= 60) { i++; continue; }
      const nb = segs[i - 1] || segs[i + 1]; nb.s0 = Math.min(nb.s0, g.s0); nb.s1 = Math.max(nb.s1, g.s1); segs.splice(i, 1);
      for (let j = segs.length - 1; j > 0; j--) if (segs[j].kit === segs[j - 1].kit) { segs[j - 1].s1 = segs[j].s1; segs.splice(j, 1); }
      i = 0;
    }
    segs[0].s0 = -1e9; segs[segs.length - 1].s1 = 1e9;
    return segs;
  }
  const kitAt = (s) => { const g = (V.regs || []).find((q) => s >= q.s0 && s < q.s1); return g ? g.kit : null; };
  // the border nearest you (within 400 m), as a line across the road: the ground blends across it
  function borderNear(s) {
    const rs = V.regs || []; let best = null;
    for (let i = 1; i < rs.length; i++) { const b = rs[i].s0; if (Math.abs(b - s) < 400 && (!best || Math.abs(b - s) < Math.abs(best.s - s))) best = { s: b, before: rs[i - 1].kit, after: rs[i].kit }; }
    if (best && !best.x) { const D = R(), a = D.at(V.prof, best.s - 2), c = D.at(V.prof, best.s + 2), l = Math.hypot(c.x - a.x, c.z - a.z) || 1; Object.assign(best, { x: (a.x + c.x) / 2, z: (a.z + c.z) / 2, tx: (c.x - a.x) / l, tz: (c.z - a.z) / l }); }
    return best;
  }
  function rebuild(cx, cz, kit) {
    const P = V.prof, D = R();
    // ground
    const p = V.gGeo.attributes.position, uv = V.gGeo.attributes.uv;
    if (!V.gGeo.userData.base) V.gGeo.userData.base = Float32Array.from(p.array);
    const b = V.gGeo.userData.base;
    let hint = V.hint;
    const TR = typeof Terrain !== "undefined" ? Terrain : null, TT = TR?.T || {};
    const segs = TR ? D.riverSegs(TR.rivers, cx, cz, 170) : [];
    // the road wins over the river away from bridges: no channel or water under it (the map's river can brush a road)
    const nearBridge = (x, z) => (V.bridges || []).some((b) => Math.hypot(b.x - x, b.z - z) < (b.len || 24) / 2 + 6);
    const underBridge = (x, z) => (V.bridges || []).some((b) => Math.hypot(b.x - x, b.z - z) < 10);   // the span itself
    const roadKeep = (x, z) => { const d = D.near(P, x, z).d; if (d > 9 || nearBridge(x, z)) return 1; return d < 5 ? 0 : (d - 5) / 4; };
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
      if (segs.length) { const rd = D.riverDist(segs, x, z); if (rd < 8) { const k = rd < 3.5 ? 1 : 1 - (rd - 3.5) / 4.5, keep = roadKeep(x, z); y -= (underBridge(x, z) ? 3.8 : 2.2) * k * k * (3 - 2 * k) * keep; } }
      if (TR) { let ty = -1; try { ty = TR.typeAtPos(D.toMap(x, z)); } catch { /* off the map */ } if (ty === TT.SEA || ty === TT.LAKE) { lakeH.push(y); y = level != null ? Math.min(y - 2.6, level - 1.6) : y - 2.6; } }
      p.setXYZ(i, x, y, z); uv.setXY(i, x / 9, -z / 9);
    }
    V.gGeo.computeVertexNormals();   // the ground shader picks top or side projection by slope
    // the lake / sea sheet sits a little under the lowest shore round it
    if (lakeH.length > 6 && level != null) { V.lake.visible = true; V.lake.position.set(cx, level, cz); } else V.lake.visible = false;
    // river ribbons, 9 m wide, a metre under the banks
    { const pos = [], uvs = [], idx = []; let k = 0;
      for (const [ax, az, bx, bz] of segs) {
        const L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
        const nx = -(bz - az) / L * 4.5, nz = (bx - ax) / L * 4.5, steps = Math.max(1, Math.ceil(L / 3));
        for (let q = 0; q <= steps; q++) {
          const x = ax + (bx - ax) * q / steps, z = az + (bz - az) * q / steps, y = D.land(P, x, z, hAt, hint) - (underBridge(x, z) ? 2.7 : 1.0) - (1 - roadKeep(x, z)) * 3, v = q * 3 / 9;   // under the road the water sinks out of sight
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
      return TR ? D.riverDist(D.riverSegs(TR.rivers, x, z, 40), x, z) < 6.5 : false;
    };
    V.wet = wet;
    // bridges where the road crosses a river on a real bridge (a ford stays a ford)
    const bridges = (V.bridges || []).filter((c) => Math.hypot(c.x - cx, c.z - cz) < 160);   // the map grid is coarse: any crossing that isn't a ford gets a bridge
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
        if ((V.bridges || []).some((b) => Math.abs(r.s - b.s) < (b.len || 24) / 2 + 4 && r.d < 7)) continue;   // nor on a bridge or right by its ends
        { let ty = -1; try { ty = TR ? TR.typeAtPos(D.toMap(x, z)) : -1; } catch { /* off the map */ } if (ty === TT.SEA || ty === TT.LAKE) continue; }
        // each spot grows what its region grows; the border is a ragged band ~50 m wide, fixed on the land
        const kk = kitAt(r.s + (D.rand(i, j, 97) - 0.5) * 50) || kit;
        const tall = n === 0 && r.d > 3.8 && (r.side < 0 || r.d > 26) && D.rand(i, j, 31) < kk.trees;
        const small = !tall && D.rand(i, j, 41 + n) < kk.clutter * (r.d < 12 ? 1 : 0.55);
        if (!tall && !small) continue;
        const kind = tall ? pickFrom(kk.treeMix, D.rand(i, j, 51)) : pickFrom(kk.clutterMix, D.rand(i, j, 61 + n));
        const Pp = K().PROPS[kind], s = D.rand(i, j, 71 + n), hgt = Pp.h[0] + (Pp.h[1] - Pp.h[0]) * s, y = D.land(P, x, z, hAt, r.i) - 0.05;
        lists[kind].push([x, y, z, hgt, s > 0.5 ? 1 : -1]);
        if (Pp.shadow) sh.push([x, y, z, Pp.shadow * (0.8 + s * 0.4)]);
      }
    }
    for (const [kind, arr] of Object.entries(lists)) {
      if (!V.cards[kind] && arr.length && LOADED.has(K().PROPS[kind].file)) { V.cards[kind] = cardMesh(kind, K().PROPS[kind].tree ? 1800 : 2600); V.scene.add(V.cards[kind]); }
      const m = V.cards[kind]; if (!m) continue;
      const g = m.geometry, n = Math.min(arr.length, m.userData.max);
      const ip = g.attributes.iPos.array, is = g.attributes.iSize.array, iff = g.attributes.iFlip.array, asp = m.userData.aspect;
      for (let q = 0; q < n; q++) { const [x, y, z, hh, fl] = arr[q]; ip[q * 3] = x; ip[q * 3 + 1] = y; ip[q * 3 + 2] = z; is[q * 2] = hh * asp; is[q * 2 + 1] = hh; iff[q] = fl; }
      g.instanceCount = n; g.attributes.iPos.needsUpdate = g.attributes.iSize.needsUpdate = g.attributes.iFlip.needsUpdate = true;
    }
    // places: where they really are on the land, never on the road or in water
    const B = K().BRIDGE, PL = K().PLACES, Wd = typeof WORLD !== "undefined" ? WORLD.places || {} : {}, byFile = {};
    const list = [];
    for (const o of V.placed || []) {
      if (Math.hypot(o.x - cx, o.z - cz) > 900) continue;
      list.push(o); (byFile[o.file] ||= []).push([o.x, o.y, o.z, o.h, 1]);
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
        V.bridgeMats = { face: new THREE.MeshBasicMaterial({ map: TEX[B.file], alphaTest: 0.45 }), stone: new THREE.MeshBasicMaterial({ map: st }), none: new THREE.MeshBasicMaterial({ visible: false }) };
      }
      const M = V.bridgeMats, img = TEX[B.file].image;
      for (const c of bridges) {
        // built along the road in short sections: every section takes the road's height and direction there, so both ends
        // always meet the road and the bridge bends and rises with it in between. Two painted walls (outer and inner
        // faces, 0.55 m apart) and a stone deck under the road.
        const Hs = B.h, Lb = Math.max(Hs * img.width / img.height, c.len * 0.8), half = 3.1, thick = 0.55, N = 18;
        const s0 = c.s - Lb / 2, top = Hs * (1 - B.deck), down = Hs * B.deck;
        const wall = [], wuv = [], deck = [], duv = [], wi = [], di = [];
        for (let k = 0; k <= N; k++) {
          const q = D.at(P, s0 + Lb * k / N), nx = -q.tz, nz = q.tx, y = q.y + 0.05, u = k / N;
          for (const off of [-(half + thick), -half, half, half + thick]) {   // four wall faces: outer and inner on each side
            wall.push(q.x + nx * off, y - down, q.z + nz * off, q.x + nx * off, y + top, q.z + nz * off); wuv.push(u, 0, u, 1);
          }
          deck.push(q.x + nx * half, y - 0.03, q.z + nz * half, q.x - nx * half, y - 0.03, q.z - nz * half); duv.push(0, u * Lb / 3, 1, u * Lb / 3);
          if (k) {
            for (let f = 0; f < 4; f++) { const a = ((k - 1) * 4 + f) * 2, b = (k * 4 + f) * 2; wi.push(a, a + 1, b, a + 1, b + 1, b); }
            const a = (k - 1) * 2; di.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
          }
        }
        const grp = new THREE.Group();
        const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.Float32BufferAttribute(wall, 3)); wg.setAttribute("uv", new THREE.Float32BufferAttribute(wuv, 2)); wg.setIndex(wi);
        grp.add(new THREE.Mesh(wg, M.faceBoth || (M.faceBoth = new THREE.MeshBasicMaterial({ map: TEX[B.file], alphaTest: 0.45, side: THREE.DoubleSide }))));
        const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.Float32BufferAttribute(deck, 3)); dg.setAttribute("uv", new THREE.Float32BufferAttribute(duv, 2)); dg.setIndex(di);
        grp.add(new THREE.Mesh(dg, M.deck || (M.deck = new THREE.MeshBasicMaterial({ map: M.stone.map, side: THREE.DoubleSide }))));
        grp.userData = { s0, s1: s0 + Lb };
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

  /* where every place along the trip stands, worked out once per trip so nothing ever shifts: on dry land with its
     whole footprint (the painting's width) clear of water and of the road, and clear of the other places. The most
     important place keeps its spot (city, town, fort...); a smaller one moves to the nearest free dry spot within 120 m,
     preferring the road's far side; with none it isn't shown. */
  /* a cut-out stands on a strip of ground along its base: it faces the camera, which looks across the road, so the strip
     runs along the road's direction there. That strip (its width, 6 m deep) must be dry; water in front is fine. */
  function footWet(P, x, z, rad, wetPt) {
    const q = P.pts[R().near(P, x, z).i];
    for (const f of [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9]) for (const dd of [-3, 0, 3]) if (wetPt(x + q.tx * f * rad - q.tz * dd, z + q.tz * f * rad + q.tx * dd)) return true;
    return false;
  }
  function placeAll(P, segs, TR, TT) {
    const D = R(), PL = K().PLACES, Wd = typeof WORLD !== "undefined" ? WORLD.places || {} : {}, out = [];
    let near = [];   // the rivers round the place being placed (set per place below)
    const wetPt = (x, z) => {
      let ty = -1; try { ty = TR ? TR.typeAtPos(D.toMap(x, z)) : -1; } catch { /* off the map */ }
      return ty === TT.SEA || ty === TT.LAKE || ty === TT.RIVER || (near.length > 0 && D.riverDist(near, x, z) < 8);
    };
    const cand = [];
    for (const [name, pp] of Object.entries(Wd)) {
      if (!pp) continue; const kind = pp[2] || "town", own = K().NAMED[name], base = PL[kind] || (own ? PL.town : null); if (!base) continue;
      const art = own ? { ...base, ...own } : base;   // its own painting when it has one
      const [x, z] = D.toWorld(pp), r = D.near(P, x, z); if (r.d > 1000) continue;
      cand.push({ name, kind, art, x0: x, z0: z, rad: art.h * art.w / 2 });
    }
    cand.sort((a, b) => b.art.rank - a.art.rank || a.name.localeCompare(b.name));
    for (const c of cand) {
      near = TR ? D.riverSegs(TR.rivers, c.x0, c.z0, c.rad + 170) : [];
      const fits = (x, z) => {
        const rn = D.near(P, x, z);
        if (rn.d < c.rad * 0.45 + 5) return false;                                          // the road stays clear (a cut-out faces you: half its width is enough)
        if (rn.side > 0 && rn.d < c.rad + 45) return false;                                 // never close by on the camera's side (it would block the view or go unseen)
        if (out.some((o) => Math.hypot(o.x - x, o.z - z) < (o.rad + c.rad) * 0.8 + 3)) return false;  // so do the other places
        // and they don't stand behind one another as seen from the road (that reads as a tower growing out of a house)
        if (out.some((o) => Math.abs(o.s - rn.s) < (o.rad + c.rad) * 0.9 + 4 && Math.abs(o.d * o.side - rn.d * rn.side) < 160)) return false;
        return !footWet(P, x, z, c.rad, wetPt);
      };
      // the camera always looks across the road from its left side: a place close by on that side would stand behind the
      // camera, never seen. It stands mirrored across the road instead, the same distance from it.
      { const r0 = D.near(P, c.x0, c.z0), q0 = P.pts[r0.i];
        if (r0.side > 0 && r0.d < c.rad + 45) { c.x0 += q0.tz * r0.d * 2; c.z0 -= q0.tx * r0.d * 2; } }
      let spot = fits(c.x0, c.z0) ? [c.x0, c.z0] : null;
      if (!spot) {
        const r = D.near(P, c.x0, c.z0), q = P.pts[r.i];
        // try outward in rings, the road's far side first (the camera looks from the other)
        const reach = c.art.rank >= 7 ? 220 : 120;   // towns and cities look further for dry land before giving up
        for (let dist = 6; dist <= reach && !spot; dist += 6) for (let k = 0; k < 16 && !spot; k++) {
          const a = Math.atan2(-q.tx, q.tz) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);   // starts pointing to the far side, then fans round
          const x = c.x0 + Math.cos(a) * dist, z = c.z0 + Math.sin(a) * dist;
          if (fits(x, z)) spot = [x, z];
        }
      }
      if (!spot) continue;
      const rs = D.near(P, spot[0], spot[1]);
      out.push({ name: c.name, kind: c.kind, x: spot[0], z: spot[1], s: rs.s, d: rs.d, side: rs.side, y: D.land(P, spot[0], spot[1], hAt) - 0.4, h: c.art.h, rad: c.rad, file: c.art.file });
    }
    return out;
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
    const thick = { fog: 0.35, blizzard: 0.55, snow: 0.7, rain: 0.7, storm: 0.6, ashstorm: 0.4, cloudy: 0.9 }[wx] || 1;
    if (wx === "fog" || wx === "blizzard") fog.lerp(new THREE.Color(0xd6dadc), (wx === "fog" ? 0.45 : 0.3) * (tod === "night" ? 0.3 : 1));
    const dull = { cloudy: 0.9, rain: 0.78, storm: 0.62, fog: 0.9, snow: 0.92, blizzard: 0.85 }[wx] || 1;
    const t = new THREE.Color(L.tint[0] * dull, L.tint[1] * dull, L.tint[2] * dull);
    const W = { fog: [0.007, 0.03], blizzard: [0.0028, 0.008], snow: [0.0026, 0.006], rain: [0.0028, 0.006], storm: [0.0034, 0.008], ashstorm: [0.006, 0.016], cloudy: [0.0022, 0.005] }[wx] || [0.0018, 0.004];   // [haze per metre, ground mist]
    const haze = W[0], fogA = W[1], wisp = ({ fog: 0.85, blizzard: 1, snow: 0.45, rain: 0.4, storm: 0.5, ashstorm: 0.8, cloudy: 0.3 }[wx] || 0.18);
    const sun = new THREE.Color({ night: 0x8b9bbd, dusk: 0xffae6a, dawn: 0xffc2a6 }[tod] || 0xffe9c4).lerp(fog, wx === "clear" ? 0 : ["cloudy", "snow", "rain"].includes(wx) ? 0.5 : 0.8);
    return { tod, wx, fog, fogA, haze, wisp, sun, near: 30 * thick, far: 190 * thick, tint: t, grade: L.grade, dark: L.dark + (wx === "storm" ? 0.15 : 0), snow: ["snow", "blizzard"].includes(wx) };
  }

  /* walking up to whoever stops you: how far back they first stand (just out of view) and at what pace; the event card
     waits about as long (DIORAMA.cueMs, used by ui.js) */
  const APPROACH = { gap: 7, walk: { dist: 9, v: 1.8 }, ride: { dist: 16, v: 3.2 } };
  const cueMs = (riding) => { const p = riding ? APPROACH.ride : APPROACH.walk; return Math.round(p.dist / p.v * 1000 + 600); };
  // ---------------------------------------------------------------- your company and who's on the road ahead
  /* who stands on the road for each road event (events.js) and encounter (encounters.js): painted foes (foe-*.webp)
     or people drawn with the hero figure; a shrine or a camp is a place painting by the road */
  const P_ = (r, eq) => ({ person: { r, eq } });
  const BANDITS = [{ foe: "foe-banditchief" }, { foe: "foe-bandit" }, { foe: "foe-bandit-archer" }];
  const CAST = {
    toll: BANDITS, banditToll: BANDITS, thugs: [{ foe: "foe-bandit" }, { foe: "foe-bandit" }],
    thalmor: [{ foe: "foe-thalmor" }, { foe: "foe-thalmor" }, { foe: "foe-thalmor" }], necro: [{ foe: "foe-necromancer" }], hagraven: [{ foe: "foe-hagraven" }],
    giant: [{ foe: "foe-giant" }], riekraid: [{ foe: "foe-riekling" }, { foe: "foe-riekling" }, { foe: "foe-riekling" }], nightvamp: [{ foe: "foe-vampire" }],
    mudcrab: [{ foe: "foe-mudcrab" }, { foe: "foe-mudcrab" }], dragonfly: [{ foe: "foe-dragon", far: true }],
    khajiit: [P_("khajiit", { chest: "leather_armor" }), P_("khajiit", { chest: "leather_armor" })], courier: [P_("imperial", { chest: "leather_armor" })],
    bard: [P_("breton", {})], vigilant: [P_("nord", { chest: "steel_armor", weapon: "steel_sword" }), P_("imperial", { chest: "steel_armor", weapon: "steel_sword" })],
    hunters: [P_("bosmer", { chest: "leather_armor", weapon: "hunting_bow" }), P_("nord", { chest: "leather_armor", weapon: "hunting_bow" })],
    escort: [P_("nord", { chest: "steel_armor", weapon: "steel_sword" }), P_("breton", {})], wizard: [P_("altmer", {})], assassin: [P_("dunmer", { chest: "leather_armor" })],
    pilgrims: [P_("nord", {}), P_("imperial", {}), P_("breton", {})], stranger: [P_("redguard", { chest: "leather_armor" })], lost: [P_("imperial", {})], rare: [P_("dunmer", {})],
    peddler: [P_("imperial", { chest: "leather_armor" })], caravan: [P_("khajiit", { chest: "leather_armor" }), P_("khajiit", {})], injured: [P_("nord", { chest: "leather_armor" })],
    sleeper: [P_("nord", {})], shrine: [{ place: "dio-place-shrine", h: 4.2 }], camp: [{ place: "dio-place-camp", h: 9, side: 6 }],
    wildhorse: [{ horse: "#7a5a3a" }], dog: [{ pet: "foe-wolf" }],
  };
  /* heights of the painted foes in metres (the painting's own proportions give the width) */
  const FOE_H = { "foe-giant": 6, "foe-dragon": 7, "foe-mammoth": 5, "foe-troll": 3, "foe-frosttroll": 3, "foe-bear": 1.9, "foe-sabrecat": 1.4, "foe-wolf": 1, "foe-mudcrab": 0.7, "foe-skeever": 0.6,
    "foe-riekling": 1.2, "foe-spider": 1.4, "foe-hagraven": 2, "foe-dwarvenspider": 1.2, "foe-horker": 1.3, "foe-chaurus": 1.4, "foe-centurion": 4.5 };
  const PET_ART = { dog: ["foe-wolf", 0.85], wolf: ["foe-wolf", 0.95], fox: ["animal-fox", 0.6], cat: ["foe-sabrecat", 0.6] };
  function castOf(stop) {
    if (!stop) return [];
    if (stop.id) return CAST[stop.id] || [];
    let key = null; try { key = typeof ASSETS !== "undefined" && ASSETS.foeKey ? ASSETS.foeKey(stop.foe, stop.kind, stop.arch) : null; } catch { key = null; }
    if (!key) return [];
    const n = Math.max(1, Math.min(3, stop.n | 0 || 1));
    return Array.from({ length: n }, () => ({ foe: key }));
  }
  /* one card: a cut-out standing on the road that faces the camera. Painted pictures use their own texture; people
     and riders are drawn into a small canvas (mapride.js), redrawn while they move */
  function actor(key, make) {
    let a = V.actors.get(key);
    if (!a) { a = make(); a.key = key; V.actors.set(key, a); V.scene.add(a.mesh); if (a.shadow) V.scene.add(a.shadow); }
    a.seen = true; return a;
  }
  function shadowMesh(w) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: V.shadowTex, transparent: true, depthWrite: false }));
    m.scale.set(w, 1, w * 0.4); m.renderOrder = 2; return m;
  }
  function pictureActor(file, h) {
    tex(file); if (!LOADED.has(file)) return null;
    const img = TEX[file].image, w = h * img.width / img.height, g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0);
    return { mesh: new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: TEX[file], alphaTest: 0.4, side: THREE.DoubleSide })), shadow: shadowMesh(w * 0.8), h, w };
  }
  function figureActor() {
    const c = document.createElement("canvas"); c.width = c.height = 320; const t = new THREE.CanvasTexture(c);
    const HS = 3.6, g = new THREE.PlaneGeometry(HS, HS); g.translate(0, HS / 2 - HS * (24 / 320), 0);
    return { mesh: new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.35, side: THREE.DoubleSide })), shadow: shadowMesh(1.4), c, g2: c.getContext("2d"), t, st: {}, frame: -1 };
  }
  function drawFigure(a, look, riding, coat, moving, pace, t, u, flip, id) {
    const g = a.g2, MR = typeof MAPRIDE !== "undefined" ? MAPRIDE : null; g.clearRect(0, 0, 320, 320);
    let ok = false;
    try {
      if (MR && riding) { MR.mounted(g, 160, 296, 2.15, { look, coat: coat || "#8a6a48", st: a.st, t, moving, pace, id, flip, noRider: !look }); ok = true; }
      else if (MR && look) ok = MR.walker(g, look, 160, 296, 168, { clip: moving ? "walk" : "idle", u, flip });
      if (!ok && typeof PAINTRIG !== "undefined") { g.save(); g.translate(160, 296); g.scale(flip ? -2.75 : 2.75, 2.75); ok = !!PAINTRIG.draw(g, look || { id: id || "npc", r: "nord" }, { clip: moving ? "walk" : "idle", u, wt: null, shield: false }); g.restore(); }
    } catch { ok = false; }
    a.t.needsUpdate = true; return ok;
  }
  /* place a card at road distance s, off to one side (lat metres: + the camera's side, − the far side) */
  function stand(a, P, s, lat, camYaw, bob = 0) {
    const q = R().at(P, s), x = q.x - q.tz * lat, z = q.z + q.tx * lat;
    a.mesh.position.set(x, q.y + bob, z); a.mesh.rotation.y = -camYaw;
    if (a.shadow) { a.shadow.position.set(x + 0.2, q.y + 0.04, z); a.shadow.rotation.y = -camYaw; }
    a.mesh.visible = true; if (a.shadow) a.shadow.visible = true;
  }
  function company(I, P, here, camYaw, moving, speed, t) {
    for (const a of V.actors.values()) a.seen = false;
    const S0 = V.sDisp, fr = V.frameN = (V.frameN || 0) + 1;
    // party members and followers, one behind the other (riders need more room)
    let back = 0;
    (I.company || []).slice(0, 7).forEach((c, i) => {
      back += c.riding ? 4.4 : 2.8;
      const a = actor("co:" + c.name, figureActor);
      if (a.frame < 0 || fr % (moving ? 2 : 4) === i % (moving ? 2 : 4)) {   // walking: every other frame; standing: every 4th (they settle and breathe)
        drawFigure(a, c.look || null, !!c.riding, c.horse, moving, c.riding ? 2.3 : 1, t, (V.stride + 0.37 * (i + 1)) % 1, false, c.name);
        a.frame = fr; a.wasMoving = moving;
      }
      stand(a, P, S0 - back, i % 2 ? 0.9 : -0.9, camYaw);
    });
    // pets trot beside you, a little behind, with a hop when moving
    (I.pets || []).slice(0, 4).forEach((p, j) => {
      const [file, h] = PET_ART[p.kind] || PET_ART.dog;
      const a = V.actors.get("pet:" + p.name) || (pictureActor(file, h) && actor("pet:" + p.name, () => pictureActor(file, h)));
      if (!a) return; a.seen = true;
      const hop = moving ? Math.abs(Math.sin(t * 9 + j)) * 0.12 : 0;
      stand(a, P, S0 - 1.4 - j * 1.6, -1.3, camYaw, hop);
    });
    // who's on the road ahead when something stops you
    const cast = castOf(I.stop);
    cast.forEach((c, k) => {
      const key = "cast:" + (I.stop.id || I.stop.foe) + ":" + k, ahead = (V.stopAt != null ? V.stopAt : S0 + 8) + (c.far ? 14 : 0) + k * 2.4, lat = c.side != null ? -c.side : k % 2 ? 1.1 : -1.1;
      if (c.foe || c.pet) {
        const file = c.foe || c.pet, h = c.pet ? 0.85 : FOE_H[file] || 1.85;
        const a = V.actors.get(key) || (pictureActor(file, h) && actor(key, () => pictureActor(file, h))); if (!a) return; a.seen = true;
        stand(a, P, ahead, lat, camYaw, c.far ? 7 : 0);
      } else if (c.place) {
        const a = V.actors.get(key) || (pictureActor(c.place, c.h) && actor(key, () => pictureActor(c.place, c.h))); if (!a) return; a.seen = true;
        stand(a, P, ahead + 2, lat - 5, camYaw);
      } else {
        const a = actor(key, figureActor);
        if (a.frame < 0) { drawFigure(a, c.person ? { id: key, r: c.person.r, eq: c.person.eq || {} } : null, !!c.horse, c.horse, false, 1, t, 0, true, key); a.frame = fr; }
        stand(a, P, ahead, lat, camYaw);
      }
    });
    for (const [k, a] of V.actors) if (!a.seen) { V.scene.remove(a.mesh); if (a.shadow) V.scene.remove(a.shadow); a.mesh.geometry.dispose(); V.actors.delete(k); }
    V.dbg.company = (I.company || []).map((c) => (c.riding ? "+" : "") + c.name); V.dbg.pets = (I.pets || []).map((p) => p.name); V.dbg.cast = cast.map((c) => c.foe || c.place || c.pet || (c.horse ? "horse" : c.person?.r));
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
    const D = R();
    // the route
    const pk = (I.origin || "") + ">" + (I.dest || "") + "|" + I.path.length;
    if (pk !== V.profKey) {
      V.prof = D.profile(I.path, hAt); V.profKey = pk; V.sDisp = null; V.patch = null; V.hint = null; V.allReady = false; if (!V.prof) return false;
      // bridges for the whole trip, found once: the road is straightened and levelled across each one
      const TR = typeof Terrain !== "undefined" ? Terrain : null, TT = TR?.T || {}, pts = V.prof.pts;
      let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity; for (const q of pts) { bx0 = Math.min(bx0, q.x); bx1 = Math.max(bx1, q.x); bz0 = Math.min(bz0, q.z); bz1 = Math.max(bz1, q.z); }
      const segsAll = TR ? D.riverSegs(TR.rivers, (bx0 + bx1) / 2, (bz0 + bz1) / 2, Math.max(bx1 - bx0, bz1 - bz0) / 2 + 20) : [];
      const cross = D.crossings(V.prof, segsAll).filter((c) => { try { return !TR || TR.typeAtPos(D.toMap(c.x, c.z)) !== TT.RIVER; } catch { return true; } });   // fords stay fords
      V.bridges = D.straighten(V.prof, cross);
      V.placed = placeAll(V.prof, segsAll, TR, TT);
      V.regs = regionsAlong(V.prof, region, I.pos);
    }
    // every region on this road has its paintings asked for at the start of the trip; the first trip waits for them
    // (classic view meanwhile), later ones carry on and fill in as they arrive
    if (!V.allReady) { V.allReady = V.regs.every((g) => ready(g.kit)); if (V.allReady) V.patch = null; else if (!V.drewOnce) return false; }
    const P = V.prof, [hx0, hz0] = D.toWorld(I.pos);
    const nr = D.near(P, hx0, hz0, V.hint); V.hint = nr.i;
    // where you are along the road, eased so the trip's updates glide instead of jumping
    const target = nr.s;
    if (V.sDisp == null || Math.abs(target - V.sDisp) > 80) { V.sDisp = target; V.vEst = 0; }
    // how fast the trip is really moving: distance between two updates of your position over the time between them (the
    // game moves you about once a second). No update for 1.6 s, or something stopping you, means you've stopped.
    V.since = (V.since || 0) + dt;
    if (V.sTarget != null && target !== V.sTarget) { const v = clamp((target - V.sTarget) / Math.max(V.since, 1 / 30), 0, 12); V.vEst = V.vEst ? V.vEst * 0.6 + v * 0.4 : v; V.since = 0; }
    if (V.since > 1.6 || I.stop) V.vEst = 0;
    V.sTarget = target;
    // something stops you: the game stops the trip at once, but here they stand a little further down the road, just out
    // of view, and you ride (or walk) up to them first. Afterwards the road view is that much ahead of the trip, and
    // eases back by walking a touch slower until they match (never a jump back).
    const stopKey = I.stop ? String(I.stop.id || I.stop.foe) : null, appr = I.riding ? APPROACH.ride : APPROACH.walk;
    if (stopKey && V.stopKey !== stopKey) { V.stopKey = stopKey; V.stopAt = Math.min(V.sDisp + appr.dist + APPROACH.gap, P.len); }
    if (!stopKey && V.stopKey) { V.stopKey = null; V.ahead = Math.max(0, V.sDisp - target); }
    if (!stopKey && V.ahead > 0) V.ahead = Math.max(0, V.ahead - (0.18 * V.vEst + 0.04) * dt);
    const before = V.sDisp;
    if (I.reduce) V.sDisp = stopKey ? V.stopAt - APPROACH.gap : target;
    else if (stopKey) V.sDisp += clamp(V.stopAt - APPROACH.gap - V.sDisp, 0, appr.v * dt);
    else { const goal = target + (V.ahead || 0), gap = goal - V.sDisp, vmax = Math.max(0.6, V.vEst * 1.6 + 0.5); V.sDisp += clamp(gap, -vmax * dt, vmax * dt); }
    const speed = dt > 0 ? (V.sDisp - before) / dt : 0;
    const moving = !I.reduce && (stopKey ? speed > 0.15 : speed > 0.15 || V.vEst > 0.15);
    const here = D.at(P, V.sDisp), kit = V.kit = kitAt(V.sDisp);
    // rebuild the land when you've moved on
    if (!V.patch || Math.hypot(here.x - V.patch[0], here.z - V.patch[1]) > 25) rebuild(here.x, here.z, kit);
    // size
    const w = host.clientWidth, h = host.clientHeight, pr = Math.min(devicePixelRatio || 1, phone() ? 1.5 : 1.75);
    if (w !== V.w || h !== V.h || V.pr !== pr) {
      V.w = w; V.h = h; V.pr = pr; V.renderer.setPixelRatio(pr); V.renderer.setSize(w, h, false);
      V.camera.aspect = w / Math.max(1, h); V.camera.fov = V.camera.aspect < 1.2 ? 44 : 30; V.camera.updateProjectionMatrix();
      V.rt.setSize(Math.round(w * pr), Math.round(h * pr)); V.post.uniforms.res.value.set(w * pr, h * pr);
      V.post.uniforms.taps.value = phone() ? 10 : 16; V.post.uniforms.blur.value = (phone() ? 4.5 : 6) * pr;
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
    const look = I.stop ? 4 : 0; V.lookA = V.lookA == null ? look : V.lookA + (look - V.lookA) * Math.min(1, dt * 1.5);   // something on the road: look a little ahead
    const lx = here.x + cx * (lead + V.lookA), lz = here.z + cz * (lead + V.lookA);
    V.camera.position.set(lx - fx * away, V.camY + up, lz - fz * away);
    V.camera.lookAt(lx + cx * (tall ? 0.4 : 1) + fx * 1.5, V.camY + (short ? 2.1 : 2.9), lz + cz * (tall ? 0.4 : 1) + fz * 1.5);
    const right = new THREE.Vector3(cx, 0, cz);
    // you
    if (moving) V.stride += speed * dt / (I.riding ? 2.6 : 0.84);
    const pace = I.riding ? clamp(speed / 1.6, 0, 4) : 1;
    drawHero(I, moving, pace, t, V.stride % 1);
    V.hero.position.set(here.x, here.y, here.z); V.hero.rotation.y = -camYaw;
    company(I, P, here, camYaw, moving, speed, t);
    V.heroShadow.position.set(here.x + 0.25, here.y + 0.05, here.z); V.heroShadow.scale.set(I.riding ? 3.2 : 1.5, 1, I.riding ? 1 : 0.6); V.heroShadow.rotation.y = -camYaw;
    // light
    const Lt = light(I, kit);
    // crossing a border, the air and the far hills change colour slowly, as the land around you does
    if (!V.fogC || I.reduce) V.fogC = Lt.fog.clone(); else V.fogC.lerp(Lt.fog, Math.min(1, dt * 0.35)); Lt.fog = V.fogC.clone();
    const B = borderNear(V.sDisp), gk = B ? B.after : kit;   // the ground: the nearest border's two regions
    V.scene.fog.color.copy(Lt.fog); V.scene.fog.near = Lt.near; V.scene.fog.far = Lt.far; V.renderer.setClearColor(Lt.fog);
    const gt = new THREE.Color(Lt.tint.r * gk.ground[0], Lt.tint.g * gk.ground[1], Lt.tint.b * gk.ground[2]);
    V.farGround.material.color.copy(gt);
    { // the region's own ground and distant ridges
      const fl = gk.floor || "dio-floor";
      if (V.floorFile !== fl && LOADED.has(fl)) {
        const gt0 = TEX[fl]; gt0.repeat.copy(TEX["dio-floor"].repeat); V.ground.material.map = gt0; V.ground.material.needsUpdate = true;
        const ft = gt0.clone(); ft.needsUpdate = true; ft.repeat.set(8000 / 60, 8000 / 60); V.farGround.material.map = ft; V.farGround.material.needsUpdate = true; V.floorFile = fl;
      }
      [kit.farFile || "dio-far", kit.midFile || "dio-mid"].forEach((f, i) => {
        const b = V.backs[i]; if (b.userData.file === f || !LOADED.has(f)) return;
        if (b.userData.file) {   // the old ridge stays as a ghost that fades out while the new one fades in
          if (b.userData.ghost) V.scene.remove(b.userData.ghost);
          const gh = new THREE.Mesh(b.geometry, b.material.clone()); gh.renderOrder = b.renderOrder - 0.01; gh.frustumCulled = false; V.scene.add(gh);
          b.userData.ghost = gh; b.userData.fadeAt = t;   // slowly: 6 s
        }
        TEX[f].repeat.set(4, 1); b.material = b.material.clone(); b.material.map = TEX[f]; b.material.needsUpdate = true; b.userData.file = f;
      });
    }
    { // the fog: thickness and colour from the weather, the sun's side of the sky glowing warmer, wisps carried by the wind
      const F = fogU(), wd = V.snow && Lt.snow ? V.snow.windDir() : [0.7, 0.25], fwd = new THREE.Vector3(); V.camera.getWorldDirection(fwd);
      F.dfCam.value.copy(V.camera.position); F.dfCol.value.copy(Lt.fog); F.dfA.value = Lt.fogA; F.dfHaze.value = Lt.haze; F.dfBase.value = here.y - 1; F.dfT.value = I.reduce ? 0 : t; F.dfWisp.value = Lt.wisp; F.dfWind.value.set(wd[0], wd[1]);
      F.dfSun.value.copy(Lt.sun); F.dfSunDir.value.set(-right.x * 0.7 + fwd.x * 0.6, 0.35, -right.z * 0.7 + fwd.z * 0.6).normalize();   // the light comes from the upper left, as in every painting
    }
    V.ground.material.color.copy(gt);
    { const T = V.ground.material.userData.tri, f0 = B && (B.before.floor || "dio-floor");   // the ground blends across the border, fixed on the land
      T.edgeOn.value = B && LOADED.has(f0) ? 1 : 0;
      if (T.edgeOn.value) { T.map2.value = TEX[f0]; T.edge.value.set(B.x, B.z, B.tx, B.tz); T.oldTint.value.setRGB(Lt.tint.r * B.before.ground[0], Lt.tint.g * B.before.ground[1], Lt.tint.b * B.before.ground[2]); } } for (const a of V.actors.values()) a.mesh.material.color.setRGB(Math.max(0.7, Lt.tint.r), Math.max(0.72, Lt.tint.g), Math.max(0.8, Lt.tint.b)); if (V.bridgeMats) for (const m of Object.values(V.bridgeMats)) if (m.color) m.color.copy(Lt.tint); V.road.material.color.copy(Lt.tint); V.hero.material.color.setRGB(Math.max(0.78, Lt.tint.r), Math.max(0.8, Lt.tint.g), Math.max(0.86, Lt.tint.b)); V.sky.material.color.copy(Lt.tint);   // you stay easy to see
    { const fc = new THREE.Color(Lt.tint.r * kit.far[0], Lt.tint.g * kit.far[1], Lt.tint.b * kit.far[2]); if (!V.farC || I.reduce) V.farC = fc; else V.farC.lerp(fc, Math.min(1, dt * 0.35)); V.backs.forEach((b) => b.material.color.copy(V.farC)); }
    for (const m of [...Object.values(V.cards), ...Object.values(V.places)]) { const u = m.material.uniforms; u.tint.value.copy(Lt.tint); u.camRight.value.copy(right); u.heroPos.value.set(here.x, here.y, here.z); u.camPos.value.copy(V.camera.position); }
    V.post.uniforms.grade.value.set(...Lt.grade); V.post.uniforms.dark.value = Lt.dark;
    // sky and ridges sit far off along the camera's view, turning with it
    const cpos = V.camera.position;
    V.sky.position.set(cpos.x, V.camY + V.sky.userData.base, cpos.z);
    V.haze.position.set(cpos.x, V.camY + V.haze.userData.base, cpos.z); V.haze.material.color.copy(Lt.fog);
    for (const b of V.backs) {
      b.position.set(cpos.x, V.camY + b.userData.base, cpos.z);
      const gh = b.userData.ghost;
      if (gh) { const k = clamp((t - b.userData.fadeAt) / 6, 0, 1); b.material.opacity = k; gh.material.opacity = 1 - k; gh.position.copy(b.position); gh.material.color.copy(b.material.color);
        if (k >= 1) { V.scene.remove(gh); gh.material.dispose(); b.userData.ghost = null; b.material.opacity = 1; } }
    }
    V.farGround.position.set(cpos.x, Math.min(here.y, V.camY) - 0.8, cpos.z);
    // snow (it eases in and out with the weather, like the map's)
    if (V.snow) { V.snow.update(dt, t, V.camera, here.y, Lt, { reduce: I.reduce, lite: phone(), h: V.h }); V.post.uniforms.wo.value = I.reduce ? 0 : V.snow.whiteout(); V.post.uniforms.woT.value = t; const wd = V.snow.windDir(); V.post.uniforms.woDir.value.set(wd[0] * right.x + wd[1] * right.z, 0); }
    // a place's picture just arrived: put it in
    if (V.placeList.some((o) => LOADED.has(o.file) && !V.places[o.file]) || (V.wantBridge && LOADED.has(K().BRIDGE.file))) { V.patch = null; V.wantBridge = false; }
    // the current drifts down the river; the lake ripples slowly
    { V.waterT = (V.waterT || 0) + (I.reduce ? 0 : dt);
      for (const m of [V.river.material, V.lake.material]) { const u = m.uniforms; u.t.value = V.waterT; u.tint.value.copy(Lt.tint);
        u.shallow.value.setRGB(0.36, 0.48, 0.52).lerp(Lt.fog, 0.35); u.deep.value.setRGB(0.1, 0.17, 0.21).lerp(Lt.fog, 0.15); } }
    labels(host, I, here);
    V.lastDrew = performance.now(); V.drewOnce = true;
    // draw: the scene, then the finish
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    V.renderer.setRenderTarget(V.rt); V.renderer.render(V.scene, V.camera);
    V.renderer.setRenderTarget(null); V.renderer.render(V.postScene, V.postCam);
    // too slow for this phone? frames that keep taking long hand back to the classic view
    // too slow for this phone? an average under ~18 pictures a second for 6 s hands back to the classic view
    if (dt > 0 && !I.reduce) { avgDt = avgDt ? avgDt * 0.95 + Math.min(dt, 0.25) * 0.05 : dt; if (avgDt > 0.055) slow += dt; else slow = Math.max(0, slow - dt); }
    V.dbg = { ...V.dbg, region, ahead: V.ahead || 0, stopAt: V.stopKey ? V.stopAt : null, s: V.sDisp, len: P.len, moving, riding: !!I.riding, tod: Lt.tod, wx: Lt.wx, snow: V.snow ? V.snow.live() : 0, ms: (typeof performance !== "undefined" ? performance.now() : 0) - t0, y: here.y };
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
  return { frame, detach, mode, setMode, settingsHTML, pref, usable, cueMs, showing: () => !!(V && V.canvas.isConnected && V.lastDrew && performance.now() - V.lastDrew < 1500), debug: () => (V ? V.dbg : null),
    /* tests: every cut-out and place as it stands now, and whether a spot is in water */
    _v: () => V, _snap: () => V && { props: Object.entries(V.cards).flatMap(([k, m]) => { const a = m.geometry.attributes.iPos.array, n = m.geometry.instanceCount, out = []; for (let i = 0; i < n; i++) out.push([k, a[i * 3], a[i * 3 + 1], a[i * 3 + 2]]); return out; }),
      places: V.placeList.map((o) => ({ name: o.name, file: o.file, x: o.x, y: o.y, z: o.z, rad: o.rad, s: o.s, d: o.d * o.side, wet: V.wet ? footWet(V.prof, o.x, o.z, o.rad, V.wet) : null })), patch: V.patch, lake: V.lake.visible ? V.lake.position.y : null }, why: () => why || (threeState !== "ready" ? "loading three.js" : V && !ready() ? "loading paintings" : ""), _slow: () => slow };
})();
if (typeof module !== "undefined") module.exports = DIORAMA;
