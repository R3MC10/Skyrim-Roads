/* dunfx.js: the air inside a dungeon. [OURS] [dungeonphone]
   Outdoor weather never reaches a room (placeart.js skips it indoors); in its place a light canvas over the painted room
   (and the entrance picture) moves what you'd see by torchlight, by the kind of place:
     dust    barrows, temples, forts, Thalmor halls: slow motes drifting through the light
     drips   caves, Forsworn dens, vampire lairs: water running off the ceiling, a small splash on the floor
     mine    dust and now and then a drip
     embers  Dwemer ruins (sparks off the old machines), bandit and giant camps, dragon lairs (fire)
   DUNFX.kind(theme) → which one · DUNFX.attach(root, theme, reduce) lays the canvas over every .droomart.painted and
   .dentrance in root (safe to call again; it keeps one canvas each). One shared animation loop that stops by itself once
   no canvas is on screen and pauses while the app is in the background. Reduce motion: one still frame of motes. */
const DUNFX = (() => {
  const KIND = { barrow: "dust", temple: "dust", fort: "dust", thalmor: "dust", cave: "drips", forsworn: "drips", vampire: "drips",
    mine: "mine", dwemer: "embers", banditcamp: "embers", giantcamp: "embers", lair: "embers" };
  const kind = (theme) => KIND[theme] || "dust";
  const live = new Set();
  let raf = 0, last = 0;
  const rand = (a, b) => a + Math.random() * (b - a);

  function spawn(L, k, w, h, fresh) {
    if (k === "drip") return { k, x: rand(0.06, 0.94) * w, y: fresh ? rand(-0.1, 0.5) * h : rand(-0.12, 0) * h, vy: rand(0.35, 0.6) * h, len: rand(5, 11), floor: rand(0.78, 0.97) * h, a: rand(0.45, 0.8) };
    if (k === "ember") return { k, x: rand(0.1, 0.9) * w, y: fresh ? rand(0.2, 1) * h : h * rand(0.92, 1.05), vx: rand(-8, 8), vy: -rand(14, 34), r: rand(0.8, 1.9), life: rand(2.5, 5), t: fresh ? rand(0, 3) : 0, ph: rand(0, 6.3) };
    return { k: "dust", x: rand(0, 1) * w, y: rand(0, 1) * h, vx: rand(-4, 4), vy: rand(-2.5, 3.5), r: rand(0.6, 1.8), a: rand(0.18, 0.5), ph: rand(0, 6.3), sp: rand(0.4, 1.2) };
  }
  function seed(L) {
    const { w, h } = L, area = Math.max(0.4, (w * h) / (360 * 200)), n = (c) => Math.round(c * Math.min(2.2, area));
    L.p = []; L.splash = [];
    const k = L.kind;
    if (k === "dust" || k === "mine") for (let i = 0; i < n(k === "mine" ? 26 : 34); i++) L.p.push(spawn(L, "dust", w, h, true));
    if (k === "drips") for (let i = 0; i < n(10); i++) L.p.push(spawn(L, "dust", w, h, true));
    if (k === "drips" || k === "mine") for (let i = 0; i < n(k === "mine" ? 2 : 6); i++) L.p.push(spawn(L, "drip", w, h, true));
    if (k === "embers") for (let i = 0; i < n(18); i++) L.p.push(spawn(L, "ember", w, h, true));
  }
  function size(L) {
    const r = L.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === L.w && h === L.h) return false;
    L.w = w; L.h = h; L.cv.width = Math.round(w * dpr); L.cv.height = Math.round(h * dpr); L.dpr = dpr;
    seed(L); return true;
  }
  function draw(L, dt, T) {
    const g = L.g, { w, h } = L;
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0); g.clearRect(0, 0, w, h);
    for (let i = 0; i < L.p.length; i++) {
      const p = L.p[i];
      if (p.k === "dust") {
        p.x += (p.vx + Math.sin(T * p.sp + p.ph) * 3) * dt; p.y += (p.vy + Math.cos(T * p.sp * 0.7 + p.ph) * 2) * dt;
        if (p.x < -4) p.x = w + 4; else if (p.x > w + 4) p.x = -4;
        if (p.y < -4) p.y = h + 4; else if (p.y > h + 4) p.y = -4;
        const tw = 0.6 + 0.4 * Math.sin(T * 1.7 + p.ph);   // motes catch the light as they turn
        g.fillStyle = `rgba(255,226,170,${(p.a * tw).toFixed(3)})`;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
      } else if (p.k === "drip") {
        p.vy += h * 1.6 * dt; p.y += p.vy * dt;
        if (p.y >= p.floor) { L.splash.push({ x: p.x, y: p.floor, t: 0 }); L.p[i] = spawn(L, "drip", w, h, false); continue; }
        if (p.y > 0) {
          const gr = g.createLinearGradient(p.x, p.y - p.len, p.x, p.y);
          gr.addColorStop(0, "rgba(190,215,235,0)"); gr.addColorStop(1, `rgba(205,228,245,${p.a})`);
          g.strokeStyle = gr; g.lineWidth = 1.2; g.beginPath(); g.moveTo(p.x, p.y - p.len); g.lineTo(p.x, p.y); g.stroke();
        }
      } else {
        p.t += dt;
        if (p.t > p.life || p.y < -6) { L.p[i] = spawn(L, "ember", w, h, false); continue; }
        p.x += (p.vx + Math.sin(T * 2.3 + p.ph) * 10) * dt; p.y += p.vy * dt;
        const a = Math.sin(Math.PI * Math.min(1, p.t / p.life)) * (0.55 + 0.45 * Math.sin(T * 9 + p.ph));
        g.fillStyle = `rgba(255,${150 + Math.round(60 * a)},70,${Math.max(0, a).toFixed(3)})`;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
        g.fillStyle = `rgba(255,140,50,${Math.max(0, a * 0.18).toFixed(3)})`;
        g.beginPath(); g.arc(p.x, p.y, p.r * 3.2, 0, 6.283); g.fill();
      }
    }
    for (let i = L.splash.length - 1; i >= 0; i--) {   // a little ring where a drop lands
      const s = L.splash[i]; s.t += dt;
      if (s.t > 0.45) { L.splash.splice(i, 1); continue; }
      const k = s.t / 0.45;
      g.strokeStyle = `rgba(200,225,240,${(0.5 * (1 - k)).toFixed(3)})`; g.lineWidth = 1;
      g.beginPath(); g.ellipse(s.x, s.y, 2 + k * 8, 0.8 + k * 2.2, 0, 0, 6.283); g.stroke();
    }
  }
  function tick(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    for (const L of live) {
      if (!L.cv.isConnected) { live.delete(L); continue; }
      size(L); draw(L, dt, now / 1000);
    }
    if (live.size && !document.hidden) raf = requestAnimationFrame(tick); else last = 0;
  }
  function go() { if (!raf && live.size && !document.hidden) raf = requestAnimationFrame(tick); }
  if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("visibilitychange", go);

  function attach(root, theme, reduce) {
    if (!root || typeof document === "undefined") return;
    const k = kind(theme);
    for (const host of root.querySelectorAll(".droomart.painted, .dentrance")) {
      let cv = host.querySelector(":scope > canvas.dunfx");
      if (cv && cv.dataset.k === k) continue;
      if (cv) cv.remove();
      cv = document.createElement("canvas"); cv.className = "dunfx"; cv.dataset.k = k; cv.setAttribute("aria-hidden", "true");
      host.appendChild(cv);
      const L = { cv, g: cv.getContext("2d"), kind: k, w: 0, h: 0, dpr: 1, p: [], splash: [] };
      if (!L.g) continue;
      if (reduce) { requestAnimationFrame(() => { size(L); L.p = L.p.filter((p) => p.k === "dust"); draw(L, 0, 0); }); continue; }   // one still frame
      live.add(L);
    }
    go();
  }
  return { KIND, kind, attach, get running() { return live.size; } };
})();
