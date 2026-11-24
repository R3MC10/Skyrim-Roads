/* Pickpocket mini-game. A hand sways over the mark's belt; tap "Lift" while it's over the purse: once to slip in,
   once to pull it out. Tap off the purse, or take too long while their attention grows, and you're caught.
   The purse's width is worked out from the old dice-roll chance so an "average player" (taps about 0.09 s off)
   wins as often as the roll did. Balance stays the same, and steady hands do a bit better. [OURS]
   Always on: no quick roll, no off switch. */
const PICKGAME = (() => {
  const DOM = typeof document !== "undefined";
  const params = () => (DOM ? new URLSearchParams(location.search) : new URLSearchParams(""));
  const automated = () => DOM && (navigator.webdriver || params().has("notut"));
  const reduce = () => DOM && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const wants = () => DOM && (params().has("pickgame") || !automated());   // always on for players (only automated tests skip it)

  // ------------------------------------------------------------------ the maths
  const SIGMA = 0.09;      // seconds: how far off an average player's tap lands
  const TIME = 7;          // seconds before the mark notices you anyway
  const STAGES = 2;
  /* bar widths per second; nervous marks (low chance) make your hand sway faster */
  const speed = (chance) => 0.9 + 0.9 * (1 - chance);
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
  /* chance an average player lands one tap inside a purse z bar-widths wide */
  const hitOdds = (z, v) => erf(z / (2 * v * SIGMA * Math.SQRT2));
  /* purse width (fraction of the bar) so the average player wins both taps as often as the old roll */
  function purseWidth(chance) {
    const c = Math.max(0.01, Math.min(0.99, chance)), v = speed(c), per = Math.pow(c, 1 / STAGES);
    let lo = 0.005, hi = 0.95;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (hitOdds(mid, v) < per) lo = mid; else hi = mid; }
    return Math.max(0.04, Math.min(0.9, (lo + hi) / 2));
  }
  const avgOdds = (chance) => Math.pow(hitOdds(purseWidth(chance), speed(chance)), STAGES);

  // ------------------------------------------------------------------ the game
  let pg = null;
  /* o: {title, sub, chance}; done({hit}|{auto}|{left}) */
  function open(o, done) {
    close();
    const z = purseWidth(o.chance), v = speed(o.chance);
    const spot = () => z / 2 + 0.04 + Math.random() * (1 - z - 0.08);
    pg = { ...o, z, v, at: spot(), spot, x: Math.random(), dir: Math.random() < 0.5 ? 1 : -1, stage: 0, t: 0, done, over: false, flash: 0 };
    const el = document.createElement("div");
    el.id = "pickgame"; el.className = "lockpick pickgame";
    el.innerHTML = `<div class="lpcard" role="dialog" aria-label="Pickpocketing">
      <h3>${esc(o.title)}</h3><p class="lpsub">${esc(o.sub || "")}</p>
      <canvas id="ppc" width="300" height="160" aria-hidden="true"></canvas>
      <p class="lphint" id="pphint">Tap <b>Lift</b> while your hand is over the purse. Twice: in, then out.</p>
      <div class="lprow"><span id="ppstage"></span><button class="btn pri" id="pplift">Lift</button></div>
      <div class="lprow"><button class="btn" id="ppleave">Walk away</button></div></div>`;
    document.body.appendChild(el);
    const cv = el.querySelector("#ppc");
    const lift = (e) => { e?.preventDefault?.(); tap(); };
    el.querySelector("#pplift").addEventListener("pointerdown", lift);
    cv.addEventListener("pointerdown", lift);
    el.querySelector("#ppleave").onclick = () => finish({ left: true });
    pg.key = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); tap(); } else if (e.key === "Escape") finish({ left: true }); };
    addEventListener("keydown", pg.key, true);
    let last = performance.now();
    const loop = (now) => { if (!pg || pg.over) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); draw(cv); pg.raf = requestAnimationFrame(loop); };
    pg.raf = requestAnimationFrame(loop);
    step(0); draw(cv);
  }
  function step(dt) {
    const P = pg; P.t += dt; P.flash = Math.max(0, P.flash - dt * 3);
    P.x += P.dir * P.v * dt;
    if (P.x > 1) { P.x = 2 - P.x; P.dir = -1; } else if (P.x < 0) { P.x = -P.x; P.dir = 1; }
    if (P.t >= TIME) return finish({ hit: false, why: "slow" });
    const st = DOM && document.getElementById("ppstage"); if (st) st.textContent = P.stage ? "Now pull it out" : "Slip your hand in";
  }
  const inside = (P) => Math.abs(P.x - P.at) <= P.z / 2;
  function tap() {
    const P = pg; if (!P || P.over) return;
    if (!inside(P)) return finish({ hit: false, why: "fumble" });
    P.stage++; sfx("coin");
    if (P.stage >= STAGES) return finish({ hit: true });
    P.at = P.spot(); P.flash = 1;     // the purse shifts as they move
  }
  function finish(res) {
    if (!pg || pg.over) return;
    const P = pg; P.over = true; cancelAnimationFrame(P.raf);
    const el = DOM && document.getElementById("pickgame");
    if (el && !res.auto && !res.left) { el.classList.add(res.hit ? "won" : "caught"); const h = el.querySelector("#pphint"); if (h) h.textContent = res.hit ? "Got it." : res.why === "slow" ? "They turn around…" : "Your hand bumps them…"; }
    if (!res.hit && !res.auto && !res.left) sfx("clang");
    const out = res.auto ? { auto: true } : res.left ? { left: true } : { hit: !!res.hit };
    setTimeout(() => { close(); P.done(out); }, res.auto || res.left || reduce() ? 0 : 500);
  }
  function close() {
    if (pg?.raf) cancelAnimationFrame(pg.raf);
    if (pg?.key) removeEventListener("keydown", pg.key, true);
    if (DOM) document.querySelector("#pickgame")?.remove();
    pg = null;
  }
  const sfx = (n) => { try { if (typeof SOUND !== "undefined") SOUND.fx(n); } catch { /* sound is optional */ } };
  function draw(cv) {
    const P = pg; if (!P) return;
    const W = 300, H = 160, g = (typeof FITCANVAS !== "undefined" ? FITCANVAS.fixed(cv, W, H) : cv.getContext("2d")), L = 22, R = W - 22, bw = R - L;   // sharp at any screen density (fitcanvas.js)
    const pixel = typeof ART !== "undefined" && ART.style?.() === "pixel";
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#2a2420"); bg.addColorStop(1, "#0c0b0a"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // their attention: an eye that opens as time runs out
    const att = Math.min(1, P.t / TIME);
    g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(L, 12, bw, 5);
    g.fillStyle = att > 0.7 ? "#c4572e" : "#b89a52"; g.fillRect(L, 12, bw * att, 5);
    g.save(); g.translate(W / 2, 30); g.strokeStyle = "#d9cfb6"; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(0, 0, 11, 1 + 6 * att, 0, 0, 7); g.stroke();
    if (att > 0.15) { g.fillStyle = att > 0.7 ? "#c4572e" : "#d9cfb6"; g.beginPath(); g.arc(0, 0, 1 + 3 * att, 0, 7); g.fill(); }
    g.restore();
    // the coat and the belt
    g.fillStyle = "#3b2f26"; g.fillRect(0, 70, W, H - 70);
    g.fillStyle = "#1f1813"; g.fillRect(0, 92, W, 14);
    g.fillStyle = "#8b7240"; g.fillRect(W * 0.18, 90, 12, 18); g.fillStyle = "#1f1813"; g.fillRect(W * 0.18 + 3, 94, 6, 10);
    // the purse (the zone)
    const px = L + bw * (P.at - P.z / 2), pw = Math.max(8, bw * P.z);
    const glow = 0.25 + 0.2 * Math.sin(P.t * 6) + P.flash * 0.4;
    g.fillStyle = `rgba(214,178,94,${glow})`; g.fillRect(px - 3, 96, pw + 6, 50);
    g.fillStyle = "#6e4a2a"; g.beginPath(); g.moveTo(px, 104); g.lineTo(px + pw, 104); g.lineTo(px + pw - 2, 140); g.quadraticCurveTo(px + pw / 2, 150, px + 2, 140); g.closePath(); g.fill();
    g.strokeStyle = "#c9a560"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px + 2, 108); g.lineTo(px + pw - 2, 108); g.stroke();
    for (let i = 0; i < P.stage; i++) { g.fillStyle = "#f3d98b"; g.beginPath(); g.arc(px + pw / 2 + (i - 0.5) * 8, 124, 2.5, 0, 7); g.fill(); }
    // the hand
    const hx = L + bw * P.x, on = inside(P);
    g.save(); g.translate(hx, 66);
    g.fillStyle = on ? "#f0d9b0" : "#c9b08a"; g.strokeStyle = "#2a2018"; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect ? g.roundRect(-9, -14, 18, 20, 5) : g.rect(-9, -14, 18, 20); g.fill(); g.stroke();
    for (let i = 0; i < 3; i++) { g.beginPath(); g.roundRect ? g.roundRect(-8 + i * 6, 4, 4.5, 16 - Math.abs(i - 1) * 3, 2) : g.rect(-8 + i * 6, 4, 4.5, 14); g.fill(); g.stroke(); }
    g.restore();
    g.strokeStyle = on ? "rgba(243,217,139,.8)" : "rgba(255,255,255,.15)"; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(hx, 88); g.lineTo(hx, 102); g.stroke(); g.setLineDash([]);
    cv.style.imageRendering = pixel ? "pixelated" : "";
  }

  return { wants, open, close, purseWidth, avgOdds, speed, hitOdds, TIME, STAGES, get game() { return pg; } };
})();
if (typeof module !== "undefined") module.exports = PICKGAME;
