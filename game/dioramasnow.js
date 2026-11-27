/* Falling snow for the diorama road view (dioramasnow.js). [OURS]
   The map's snow (snowfx.js) seen from the side instead of from above: the same flake paintings (irregular clumps of
   crystals, small slanted crystals, hard grains; lit from the upper left, soft and partly see-through), the same
   weather presets, one gusting wind with eddies, flutter and tumbling, a glint when a flake faces the light, flakes
   close to the camera blurred into faint discs, fast ones smeared like film. A blizzard is mostly small hard grains
   blown nearly flat, snow blowing low along the ground and whiteout drifting past (the post pass draws that).
     DIOSNOW.make(THREE, max)  → { mesh, update(dt, t, camera, groundY, Lt, o), whiteout(), live() }
       Lt: the diorama's light (tint, fog, near, far, wx); o: { reduce, lite }
   Flakes live in world metres in the camera's view: one blown out of a side comes back on the other at the same depth,
   one that falls out of the bottom comes back at the top, so the view stays evenly filled whatever the wind does. */
const DIOSNOW = (() => {
  // the map's presets, in metres: counts are a share of the flakes the view holds, speeds in m/s
  const LOCAL = {
    clear:     { n: 0,    wind: 12,  gust: 0.5, fall: 1,   kinds: [0.6, 0.4, 0],     size: 1,    whiteout: 0, drift: 0 },
    lightsnow: { n: 140,  wind: 10,  gust: 0.5, fall: 0.8, kinds: [0.85, 0.15, 0],   size: 1.35, whiteout: 0, drift: 0 },
    snow:      { n: 420,  wind: 28,  gust: 0.7, fall: 1,   kinds: [0.65, 0.3, 0.05], size: 1,    whiteout: 0, drift: 0 },
    heavysnow: { n: 800,  wind: 60,  gust: 0.9, fall: 1.15, kinds: [0.55, 0.2, 0.25], size: 0.95, whiteout: 0.25, drift: 0.3 },
    blizzard:  { n: 1300, wind: 230, gust: 1.2, fall: 1.4, kinds: [0.15, 0.15, 0.7], size: 0.8,  whiteout: 0.8, drift: 1 },
  };
  const WX = () => (typeof SNOWFX !== "undefined" && SNOWFX.WX) || LOCAL;
  const WIND = 0.045, NMAX = 1300;   // map wind px/s → m/s; the preset count that fills every flake we have
  const DMIN = 3, DMAX = 50, FOCUS = 16;   // depth range the flakes fill; the camera is focused on you, 16 m off
  const SHUTTER = 1 / 60;
  const rnd = (a, b) => a + Math.random() * (b - a), ease = (a, b, k) => a + (b - a) * k;
  const G = 5, TILE = 96;   // the atlas: 5 x 5 tiles of the map's 96 px flake paintings; the last tile is the blurred disc
  function atlasCanvas() {
    const c = document.createElement("canvas"); c.width = c.height = G * TILE; const x = c.getContext("2d");
    let A = null; try { A = typeof SNOWFX !== "undefined" && SNOWFX.atlas ? SNOWFX.atlas() : null; } catch { A = null; }
    const tiles = A ? [...A.clump.slice(0, 10), ...A.crystal.slice(0, 8), ...A.grain.slice(0, 6)] : [];
    const put = (img, i) => x.drawImage(img, (i % G) * TILE, Math.floor(i / G) * TILE, TILE, TILE);
    if (tiles.length) tiles.forEach(put);
    else {   // no map snow loaded: soft round flakes
      const d = document.createElement("canvas"); d.width = d.height = TILE; const y = d.getContext("2d"), m = TILE / 2, gr = y.createRadialGradient(m, m, 0, m, m, m * 0.32);
      gr.addColorStop(0, "rgba(246,248,252,.95)"); gr.addColorStop(1, "rgba(246,248,252,0)"); y.fillStyle = gr; y.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 24; i++) put(d, i);
    }
    if (A && A.disc) put(A.disc, 24);
    else { const m = TILE / 2, gx = (G - 1) * TILE + m, gy = (G - 1) * TILE + m, gr = x.createRadialGradient(gx, gy, 0, gx, gy, m); gr.addColorStop(0, "rgba(246,248,252,.16)"); gr.addColorStop(0.9, "rgba(246,248,252,.26)"); gr.addColorStop(1, "rgba(246,248,252,0)"); x.fillStyle = gr; x.fillRect((G - 1) * TILE, (G - 1) * TILE, TILE, TILE); }
    return { c, counts: A ? [Math.min(10, A.clump.length), Math.min(8, A.crystal.length), Math.min(6, A.grain.length)] : [10, 8, 6] };
  }
  const VS = `
    attribute vec3 aPos; attribute vec3 aVel; attribute vec4 aP; attribute float aSq;
    uniform float shutter, focus, halfH;
    varying vec2 vUv; varying float vA; varying float vD;
    void main(){
      vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
      float d = -mv.z; vD = d;
      // out of focus close to the camera: a bigger, fainter disc
      float defocus = max(0., (focus * 0.3 - d) / (focus * 0.3));
      float D = aP.x * (1. + defocus * 1.6);
      // the flake's motion across the view (the camera's own motion is already in aVel)
      vec3 vv = mat3(viewMatrix) * aVel; vec2 m2 = vv.xy; float sp = length(m2) * shutter;
      vec2 c = position.xy;   // -0.5..0.5
      vec2 off;
      float tile = defocus > 0.35 ? 24. : aP.z;
      if (sp > D * 0.5 && defocus <= 0.35) {   // smeared along its path, thinner as it turns edge-on
        vec2 u = m2 / max(length(m2), 1e-5), w = vec2(-u.y, u.x);
        float len = sp + D * 0.45;
        off = u * c.x * (len + D * 0.6) + w * c.y * D * aSq;
        vA = aP.y * clamp(D * 0.7 / len + 0.3, 0.5, 1.);
      } else {
        float cr = cos(aP.w), sr = sin(aP.w), sq = defocus > 0.35 ? 1. : aSq;
        vec2 q = vec2(c.x * D, c.y * D * sq);
        off = vec2(q.x * cr - q.y * sr, q.x * sr + q.y * cr);
        vA = aP.y / (1. + defocus * 1.6);
      }
      // never smaller than a visible speck
      float px = D / d * projectionMatrix[1][1] * halfH; if (px < 4.5) { off *= 4.5 / max(px, 0.01); vA *= max(px, 0.01) / 4.5 * .6 + .4; }
      if (px > 44.) { off *= 44. / px; }   // a flake right by the lens stays a soft disc, never a big ring over the view
      mv.xy += off;
      vUv = (vec2(mod(tile, 5.), floor(tile / 5.)) + vec2(c.x + .5, .5 - c.y)) / 5.;
      vUv.y = 1. - vUv.y;
      gl_Position = projectionMatrix * mv;
    }`;
  const FS = `
    uniform sampler2D map; uniform vec3 tint, fogColor; uniform float fogNear, fogFar;
    varying vec2 vUv; varying float vA; varying float vD;
    void main(){
      vec4 s = texture2D(map, vUv);
      float f = smoothstep(fogNear, fogFar, vD);
      vec3 col = mix(s.rgb * tint, fogColor, f * .85);
      float a = s.a * vA * (1. - f * .7);
      if (a < .004) discard;
      gl_FragColor = vec4(col, a);
    }`;

  function make(THREE, max) {
    const N = max;
    const { c, counts } = atlasCanvas();
    const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;   // like the map's canvas drawing: thin arms stay bright when small tex.magFilter = THREE.LinearFilter;
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index; geo.setAttribute("position", quad.attributes.position);
    const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), prm = new Float32Array(N * 4), sqA = new Float32Array(N);
    const aPos = new THREE.InstancedBufferAttribute(pos, 3), aVel = new THREE.InstancedBufferAttribute(vel, 3), aP = new THREE.InstancedBufferAttribute(prm, 4), aSq = new THREE.InstancedBufferAttribute(sqA, 1);
    for (const a of [aPos, aVel, aP, aSq]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aPos", aPos); geo.setAttribute("aVel", aVel); geo.setAttribute("aP", aP); geo.setAttribute("aSq", aSq);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      uniforms: { map: { value: tex }, tint: { value: new THREE.Color(1, 1, 1) }, fogColor: { value: new THREE.Color(0x8e9fae) }, fogNear: { value: 30 }, fogFar: { value: 190 }, shutter: { value: SHUTTER }, focus: { value: FOCUS }, halfH: { value: 300 } } });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false;

    const P = JSON.parse(JSON.stringify(WX().clear));
    const F = [];   // flakes: x, y, z (world m), vx, vy, vz, kind, fall, r, flutter, rates and phases
    let first = true, wind = [0, 0], windFrom = 290, gustSeed = rnd(0, 100), alive = 0, cam = null;
    const camPrev = new THREE.Vector3(), camVel = new THREE.Vector3(), v3 = new THREE.Vector3(), R = new THREE.Vector3(), U = new THREE.Vector3(), Fw = new THREE.Vector3();
    const gustAt = (tt) => 1 + (Math.sin(tt * 0.19 + gustSeed) * 0.55 + Math.sin(tt * 0.47 + gustSeed * 1.9) * 0.3 + Math.sin(tt * 1.13 + gustSeed * 0.7) * 0.15) * P.gust;
    function eddy(x, z, y, tt, out) {   // the map's swirl field, in metres
      const k1 = 0.27, k2 = 0.75;
      out[0] = Math.sin(z * k1 + tt * 0.35 + y * 0.09) + 0.5 * Math.sin(z * k2 - tt * 0.9 + x * 0.18);
      out[1] = -(Math.sin(x * k1 - tt * 0.3 + y * 0.07) + 0.5 * Math.sin(x * k2 + tt * 0.8 - z * 0.18));
      return out;
    }
    // a point in view: across (-1..1 of the half width at that depth), up (-1..1), depth in metres
    function place(f, ax, ay, d) {
      const th = Math.tan(cam.fov * Math.PI / 360), tw = th * cam.aspect;
      v3.copy(cam.position).addScaledVector(Fw, d).addScaledVector(R, ax * tw * d).addScaledVector(U, ay * th * d);
      f.x = v3.x; f.y = v3.y; f.z = v3.z;
    }
    function spawn(f, fresh) {
      const r = Math.random(), K = P.kinds; f.kind = r < K[0] ? 0 : r < K[0] + K[1] ? 1 : 2;   // 0 fluffy clump, 1 crystal, 2 hard grain
      f.fall = (f.kind === 0 ? rnd(0.9, 1.5) : f.kind === 1 ? rnd(0.7, 1.1) : rnd(2.0, 3.0)) * P.fall;
      f.r = (f.kind === 0 ? rnd(0.04, 0.08) : f.kind === 1 ? rnd(0.03, 0.05) : rnd(0.022, 0.034)) * P.size;
      f.flA = f.kind === 0 ? rnd(0.15, 0.35) : f.kind === 1 ? rnd(0.08, 0.18) : rnd(0.01, 0.04);
      f.flF = f.kind === 2 ? rnd(4, 7) : rnd(1.2, 3.2); f.ph = rnd(0, 7); f.ph2 = rnd(0, 7);
      f.si = Math.floor(Math.random() * counts[f.kind]); f.op = rnd(0.65, 0.95); f.rot = rnd(0, 7); f.spin = rnd(-1.5, 1.5) * (f.kind === 2 ? 2 : 1); f.tum = rnd(0.6, 2.2); f.glint = rnd(0, 7);
      f.vx = wind[0]; f.vz = wind[1]; f.vy = -f.fall; f.age = fresh ? 1 : 0; f.drifted = false; f.dead = false;
      // more flakes close by than an even fill would give: far off they're only specks in the fog
      const d = Math.max(DMIN, DMAX * Math.sqrt(rnd(0.001, 1)));
      place(f, rnd(-1.1, 1.1), rnd(-1.1, 1.15), d);
      return f;
    }
    const tmp = [0, 0], tileBase = [0, counts[0], counts[0] + counts[1]];

    function update(dt, t, camera, groundY, Lt, o = {}) {
      cam = camera;
      const want = WX()[Lt.wx] ? Lt.wx : "clear";
      if (o.reduce) dt = 0;
      const T = WX()[want], k = first ? 1 : 1 - Math.exp(-(dt || 0.016) / 1.2); first = false;   // already snowing when the view opens; later changes ease in
      for (const key of Object.keys(P)) if (key === "kinds") P.kinds = P.kinds.map((v, i) => ease(v, T.kinds[i], k)); else P[key] = ease(P[key], T[key], k);
      const cap = Math.min(N, Math.round(N * Math.min(1, P.n / NMAX) * (o.lite ? 0.55 : 1)));
      mesh.visible = cap > 0 || alive > 0;
      if (!mesh.visible) { F.length = 0; geo.instanceCount = 0; return; }
      camera.updateMatrixWorld();
      R.setFromMatrixColumn(camera.matrixWorld, 0); U.setFromMatrixColumn(camera.matrixWorld, 1); Fw.setFromMatrixColumn(camera.matrixWorld, 2).negate();
      if (dt > 0) camVel.subVectors(camera.position, camPrev).divideScalar(dt); if (camVel.length() > 30) camVel.set(0, 0, 0);
      camPrev.copy(camera.position);
      const ang = (windFrom + 180) * Math.PI / 180, ws = P.wind * WIND * gustAt(t);
      wind = [Math.sin(ang) * ws, -Math.cos(ang) * ws];
      while (F.length < cap) F.push(spawn({}, true));
      const th = Math.tan(camera.fov * Math.PI / 360), tw = th * camera.aspect;
      const floor = groundY - 1.5;   // under the road: a flake this low is out of sight behind the land (or fades away)
      alive = 0; let n = 0;
      for (const f of F) {
        if (f.dead) continue;
        // air: the wind and the eddies (calmer near the ground)
        const lift = 0.55 + 0.45 * Math.min(1, Math.max(0, f.y - groundY) / 8);
        eddy(f.x, f.z, f.y, t, tmp);
        const ed = 0.6 + ws * 0.35;
        const tx = (wind[0] + tmp[0] * ed) * lift, tz = (wind[1] + tmp[1] * ed) * lift;
        const resp = f.kind === 2 ? 2.4 : 1.4;   // light clumps lag the gusts a little more
        f.vx += (tx - f.vx) * Math.min(1, dt * resp); f.vz += (tz - f.vz) * Math.min(1, dt * resp);
        f.vy = -f.fall * (1 + 0.15 * Math.sin(t * f.flF * 0.5 + f.ph)) * (f.drifted ? 0.08 : 1);
        // flutter: a small wobbling loop as the flake rocks (moves it, adds to how fast it crosses the view)
        const fl = f.flA, fx = -Math.sin(t * f.flF + f.ph) * fl * f.flF, fz = Math.cos(t * f.flF * 0.8 + f.ph2) * fl * 0.6 * f.flF * 0.8;
        f.x += (f.vx + fx) * dt; f.z += (f.vz + fz) * dt; f.y += f.vy * dt; f.age += dt;
        // where is it in the view?
        v3.set(f.x - camera.position.x, f.y - camera.position.y, f.z - camera.position.z);
        const d = v3.dot(Fw), ax = v3.dot(R) / (tw * Math.max(d, 0.1)), ay = v3.dot(U) / (th * Math.max(d, 0.1));
        if (d < DMIN * 0.6 || d > DMAX * 1.05) {   // left the volume toward or away from the camera: back in somewhere else
          if (alive >= cap) { f.dead = true; continue; }
          spawn(f, false);
        } else if (ax < -1.2 || ax > 1.2) {   // blown out of a side: back in on the other
          place(f, ax < 0 ? ax + 2.3 : ax - 2.3, ay, d);
        } else if (P.drift > 0.05 && f.kind === 2 && !f.drifted && f.y < groundY && f.y - f.vy * dt >= groundY && Math.random() < 0.35 * P.drift) {
          f.y = groundY + rnd(0.05, 0.8); f.drifted = true; f.vx *= 1.6; f.vz *= 1.6;   // blowing snow: a grain swept along the ground
        } else if (ay < -1.2 || f.y < floor) {   // fell out of the bottom: back in at the top, a fresh flake
          if (alive >= cap) { f.dead = true; continue; }
          spawn(f, false); place(f, ax, 1.15, d);
        } else if (ay > 1.25) { place(f, ax, -1.15, d); }
        alive++;
        // tumbling: it turns edge-on and face-on as it rocks, and catches the light for a moment when it faces it
        f.rot += f.spin * dt;
        const face = Math.abs(Math.cos(t * f.tum + f.ph)), glint = Math.pow(Math.max(0, Math.cos(t * f.tum * 1.7 + f.glint)), 24);
        const fadeIn = Math.min(1, f.age * 3), low = Math.min(1, Math.max(0, (f.y - floor) / 1.2));
        let a = f.op * fadeIn * low * (0.8 + 0.5 * glint); if (f.drifted) a *= 0.7;
        pos[n * 3] = f.x; pos[n * 3 + 1] = f.y; pos[n * 3 + 2] = f.z;
        vel[n * 3] = f.vx + fx - camVel.x; vel[n * 3 + 1] = f.vy - camVel.y; vel[n * 3 + 2] = f.vz + fz - camVel.z;
        prm[n * 4] = Math.max(0.03, f.r * 3.9); prm[n * 4 + 1] = Math.min(0.9, a); prm[n * 4 + 2] = tileBase[f.kind] + f.si; prm[n * 4 + 3] = f.rot;
        sqA[n] = 0.3 + 0.7 * face;
        n++;
      }
      for (let i = F.length - 1; i >= 0; i--) if (F[i].dead) F.splice(i, 1);
      geo.instanceCount = n;
      for (const a of [aPos, aVel, aP, aSq]) a.needsUpdate = true;
      const u = mat.uniforms; u.halfH.value = (o.h || 600) / 2; u.tint.value.copy(Lt.tint); u.fogColor.value.copy(Lt.fog); u.fogNear.value = Lt.near; u.fogFar.value = Lt.far;
    }
    return { mesh, update, whiteout: () => P.whiteout, windDir: () => wind, live: () => alive };
  }
  return { make };
})();
if (typeof module !== "undefined") module.exports = DIOSNOW;
