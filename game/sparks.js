/* sparks.js: showers of hot-metal sparks, drawn on one screen-wide 2D canvas. [OURS]
     SPARKS.burst(x, y, dx, dy, count, speed, opts)   screen px; (dx, dy) = the way they're thrown (needn't be unit length)
       opts: { spread 0..1 (tight jet → wide fan), floor: y in px to skip on (or null), flash: true, hue: "metal"|"shock"|"fire",
               carry: [vx, vy] px/s the source itself is moving (sparks inherit it), occlude: () => ({ x, y, r }) a round
               thing in front of the sparks (a spinning wheel): nothing is drawn inside it, so they come out from behind it }
     SPARKS.live()                                    how many are in the air (for tests)
   The recipe (ported from a WebGL spark system to plain canvas):
   - a spark is a tapered streak, its head on the particle and its tail laid back along its own velocity, so fast
     sparks are long and slow ones short; a thin hot core over a soft halo, drawn additively so it glows
   - colour is cooling metal: white-gold, then it loses blue, then green, and ends a dull red, with a little flicker
   - real flight: gravity, air drag, a floor; heavy sparks skip off it, light ones die where they land
   - every shower mixes three kinds: ~72% fast thin streaks, ~20% heavier ones that skip, ~8% slow drifting embers
   - a short warm flash where it strikes
   Cheap: the canvas only runs while sparks are in the air, at most MAX are alive (oldest recycled), fewer on the
   Lite motion setting, none when motion is off or the phone asks for reduced motion. Units: px and seconds. */
const SPARKS = (() => {
  const MAX = 240, PX = 260;   // px per "metre": 9.8 m/s² gravity → ~2550 px/s²
  let cv = null, g = null, P = [], flashes = [], occ = new Set(), running = false, last = 0, slow = 1;   // slow: tests and demos can play it in slow motion
  const calm = () => { try { return typeof MOTION !== "undefined" ? !MOTION.on() : matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const lite = () => { try { return typeof MOTION !== "undefined" && MOTION.lite(); } catch (e) { return false; } };
  function size() { if (!cv) return; const d = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d); g.setTransform(d, 0, 0, d, 0, 0); }
  function canvas() {
    if (cv && cv.isConnected) return true;
    if (typeof document === "undefined" || !document.body) return false;
    cv = document.createElement("canvas"); cv.className = "sparkfx"; cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
    document.body.appendChild(cv); g = cv.getContext("2d"); size(); addEventListener("resize", size);
    return true;
  }
  const TINT = { metal: [1, 0.84, 0.4], shock: [0.75, 0.9, 1], fire: [1, 0.62, 0.22] };
  function burst(x, y, dx = 0, dy = -1, count = 12, speed = 6.5, opts = {}) {
    if (calm() || !canvas()) return;
    const n = Math.max(1, Math.round(count * (lite() ? 0.4 : 1))), spread = opts.spread ?? 1, l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l, base = TINT[opts.hue] || TINT.metal;
    for (let i = 0; i < n; i++) {
      const roll = Math.random(), heavy = roll > 0.72 && roll <= 0.92, ember = roll > 0.92;
      const sp = speed * PX * (ember ? 0.25 + Math.random() * 0.3 : heavy ? 0.5 + Math.random() * 0.5 : 0.7 + Math.random() * 0.9);
      const cvx = opts.carry ? opts.carry[0] : 0, cvy = opts.carry ? opts.carry[1] : 0;
      // thrown along (ux, uy), fanned sideways by spread, plus whatever the source was doing
      const side = (Math.random() - 0.5) * spread, vx = (ux - uy * side) * sp + cvx, vy = (uy + ux * side) * sp + cvy;
      const tint = Math.random(), life = ember ? 0.9 + Math.random() * 0.9 : heavy ? 0.45 + Math.random() * 0.5 : 0.12 + Math.random() * 0.28;
      P.push({ x, y, vx, vy, life, span: life, seed: Math.random(), floor: opts.floor ?? null,
        size: (ember ? 1.6 + Math.random() : heavy ? 1.8 + Math.random() * 1.5 : 0.8 + Math.random() * 1) * (opts.scale || 1),
        trail: ember ? 0.012 : 0.022 + Math.random() * 0.03, grav: (ember ? 1.5 : 9.8) * PX, drag: ember ? 2.2 : 1 + Math.random() * 1.5,
        bounce: heavy ? 0.35 + Math.random() * 0.25 : 0, col: [base[0], base[1] * (0.88 + tint * 0.24), base[2] * (0.7 + tint * 0.75)] });
    }
    if (P.length > MAX) P.splice(0, P.length - MAX);
    if (opts.occlude) occ.add(opts.occlude);
    if (opts.flash !== false) flashes.push({ x, y, t: 0, r: 26 + speed * 3, c: base });
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  }
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.004, (now - last) / 1000)) * slow; last = now;
    if (!cv || !cv.isConnected) { running = false; P = []; flashes = []; return; }
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalCompositeOperation = "lighter"; g.lineCap = "round";
    // the flash: a warm light at the strike for ~80 ms
    flashes = flashes.filter((f) => {
      f.t += dt; if (f.t > 0.12) return false;
      const a = Math.exp(-f.t * 28), gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      gr.addColorStop(0, `rgba(255,${Math.round(200 * f.c[1])},${Math.round(140 * f.c[2])},${(0.55 * a).toFixed(3)})`); gr.addColorStop(1, "rgba(255,140,40,0)");
      g.fillStyle = gr; g.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2); return true;
    });
    P = P.filter((p) => {
      p.life -= dt; if (p.life <= 0) return false;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor != null && p.vy > 0 && p.y > p.floor) {   // heavy sparks skip and lose heat; light ones die where they land
        p.y = p.floor;
        if (p.bounce > 0 && p.vy > 0.8 * PX) { p.vy *= -p.bounce; p.vx *= 0.6; p.life *= 0.75; } else { p.vx *= 0.3; p.vy = 0; p.life = Math.min(p.life, 0.12); }
      }
      if (p.y > innerHeight + 40 || p.x < -40 || p.x > innerWidth + 40) return false;
      // cooling metal
      const age = 1 - p.life / p.span, heat = (1 - age) * (0.85 + 0.15 * Math.sin((age * 40 + p.seed * 9) * 3.1));
      const bright = 0.6 + heat * heat * 5.2;   // over 1 while young: clamps to white-hot
      const r = Math.min(255, 255 * p.col[0] * bright), gg = Math.min(255, 255 * p.col[1] * bright * (0.3 + 0.7 * heat)), b = Math.min(255, 255 * p.col[2] * bright * Math.max(0, heat - 0.45) * 1.1);
      const a = Math.min(1, (1 - age) * 3);
      // the streak: head on the particle, tail back along its motion; thins as it cools
      const sp = Math.hypot(p.vx, p.vy) || 1e-6, len = Math.max(p.size * 2.2, sp * p.trail);
      const tx = p.x - (p.vx / sp) * len, ty = p.y - (p.vy / sp) * len, w = p.size * (0.55 + 0.45 * (1 - age));
      const grd = g.createLinearGradient(tx, ty, p.x, p.y);   // a thin tail that fades in, a hot head
      const col = (k) => `rgba(${r | 0},${gg | 0},${b | 0},${(a * k).toFixed(3)})`;
      grd.addColorStop(0, col(0)); grd.addColorStop(0.3, col(0.35)); grd.addColorStop(1, col(1));
      g.strokeStyle = `rgba(${r | 0},${(gg * 0.75) | 0},${(b * 0.5) | 0},${(0.16 * a).toFixed(3)})`; g.lineWidth = w * 3.4;   // halo
      g.beginPath(); g.moveTo(tx + (p.x - tx) * 0.3, ty + (p.y - ty) * 0.3); g.lineTo(p.x, p.y); g.stroke();
      g.strokeStyle = grd; g.lineWidth = w;   // core
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(p.x, p.y); g.stroke();
      return true;
    });
    // whatever stands in front (the star): cut it out, so sparks appear from behind its edge
    g.globalCompositeOperation = "destination-out";
    for (const f of occ) { try { const o = f(); if (o) { g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill(); } } catch (e) { occ.delete(f); } }
    g.globalCompositeOperation = "source-over";
    if (P.length || flashes.length) requestAnimationFrame(frame); else { running = false; occ.clear(); g.clearRect(0, 0, innerWidth, innerHeight); }
  }
  return { burst, live: () => P.length, slowMo: (k) => { slow = Math.max(0.02, Math.min(1, +k || 1)); } };
})();
if (typeof module !== "undefined") module.exports = SPARKS;
