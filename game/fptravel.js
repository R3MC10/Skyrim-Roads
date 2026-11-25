/* First-person travel (fptravel.js). [OURS]
   While you're on the road, the trip card is a band at the top of the map: the compass runs along its top edge and
   under it you look down the road through your own eyes. The road bends with the route, the land is the region you're
   crossing (tundra, pine forest, the Rift's birches, marsh, snow, ash, rocky hills, a river ford, a bridge, the sea on a
   ship), the sky is the real time of day and weather (sun, moon, stars, aurora, snow, rain, lightning, fog, ash), and
   trees, rocks, signposts, wayshrines and camps come toward you. The place you're heading for rises where its compass
   marker is and grows as you near it. Riding you see your horse's ears and your hands on the reins (your gloves or
   skin); walking, the view bobs at your pace. Companions talk in a small line at the bottom.
   Under the view: route, time left, a progress line with the places you pass, Walk/Ride and Stop, and chips for the
   ground, the weather and who is with you. The view folds away to just the bar (remembered per player).
     FPT.show(wrap, info, onClick)  draw/refresh the band inside the map (wrap = #mapwrap); onClick gets the band's clicks
     FPT.hide()                     remove it (no trip, a fight, a dungeon...)
     FPT.frame(info, opts)          → a one-off canvas (tests, screenshots); opts {w, h, t, travel}
     FPT.debug()                    → what the last live frame drew (tests)
   info: { route:{origin,dest}, mins, timeText, p, stops:[{name,f,passed}], ground, pace, riding, horse:{name,coat},
           downed, carriage, boat, ship, follow, sky, heading, turn, destBear, look, company:[{name,player,riding}],
           pet, say:{who,line}, reduce, id }
   Painted layers from the art branch can drop in later: FPT.LAYERS lists the file names per region; when one of them is
   in ASSETS it is drawn instead of the code-drawn layer.
   Performance: one canvas, device pixels capped (1.5 on phones), ~30 fps on phones and 45 on PCs, nothing runs while the
   band is folded, off screen or the app hidden; reduced motion draws one still frame. */
const FPT = (() => {
  const TAU = Math.PI * 2, FOV = 200;   // the same field of view as the compass (hud.js), so markers sit over what they mark
  const TA = () => (typeof TRAVELART !== "undefined" ? TRAVELART : null);
  const seeded = (s) => (typeof ART !== "undefined" ? ART.seeded(s) : (() => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296); })());
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, k) => { const pa = hex(a), pb = hex(b); return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(k, 0, 1)).toString(16).padStart(2, "0")).join(""); };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
  const relDeg = (d) => { d %= 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };

  /* painted layers Kacper can add later, per region (TRAVELART.BIOME keys): wide strips that wrap round 360° */
  const LAYERS = {};
  for (const b of ["grass", "tundra", "forest", "pine", "autumn", "marsh", "snow", "ash", "rock"]) LAYERS[b] = { far: `fpv-${b}-far`, hills: `fpv-${b}-hills` };
  const painted = (key) => { try { return typeof ASSETS !== "undefined" && ASSETS.state(key)?.st === "ok" ? ASSETS.img(key) : null; } catch { return null; } };

  // ------------------------------------------------------------------ the band (DOM)
  let band = null, wrapEl = null, clickFn = null, info = null, shutKey = "", lastHead = "", lastSay = "", sayUntil = 0, tipShown = false;
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private window */ } } };
  const isShut = () => store.get(shutKey) === "1";
  const SVG = {
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="1.2"/></svg>',
    ride: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20l2-7 3-2 2-5 3 1 2 3 2 1-1 2-3-1-2 3 1 5"/></svg>',
    walk: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4.5" r="2"/><path d="M12 8l-3 5 3 2-1 6M12 8l3 4 3 1M10 13l-3 7"/></svg>',
    fold: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/></svg>',
  };
  function ensure(wrap) {
    if (band && band.parentNode === wrap) return band;
    band?.remove(); stop();
    band = document.createElement("div"); band.id = "fpt"; band.className = "fpt"; band.setAttribute("role", "region"); band.setAttribute("aria-label", "On the road");
    band.innerHTML = `<div class="fpt-view"><canvas aria-hidden="true"></canvas><div class="fpt-say" aria-live="polite"></div></div><div class="fpt-bar"></div>`;
    wrap.appendChild(band); wrapEl = wrap; lastHead = ""; seen = true;
    band.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      if (b.dataset.act === "fpttoggle") { e.stopPropagation(); store.set(shutKey, isShut() ? "0" : "1"); lastHead = ""; if (info) show(wrapEl, info, clickFn); return; }
      if (clickFn) clickFn(e);
    });
    if (window.IntersectionObserver) { io?.disconnect(); io = new IntersectionObserver((es) => { seen = es[0].isIntersecting; if (seen) kick(); }); io.observe(band.querySelector(".fpt-view")); }
    return band;
  }
  /* the slim bar: route · time · buttons, the progress line with stops, chips */
  function barHTML(I, shut) {
    const btn = (act, icon, label, cls = "") => `<button class="fpt-b ${cls}" data-act="${act}" aria-label="${esc(label)}" title="${esc(label)}">${icon}</button>`;
    let btns = "";
    if (I.canRide) btns += btn("hride", I.riding ? SVG.walk : SVG.ride, I.riding ? "Walk" : "Ride", I.riding ? "on" : "");
    btns += I.follow ? `<span class="fpt-chip fpt-fol">⚑ <span>following</span></span>` : btn("stop", SVG.stop, "Stop", "fpt-stop");
    btns += btn("fpttoggle", shut ? SVG.eye : SVG.fold, shut ? "Show the road" : "Hide the road");
    const stops = (I.stops || []).map((s) => `<i class="fpt-s${s.passed ? " past" : ""}" style="left:${(s.f * 100).toFixed(1)}%" title="${esc(s.name)}"></i>`).join("");
    const chips = [];
    const chip = (cls, ...parts) => chips.push(`<span class="fpt-chip ${cls}">${parts.map((p) => (Array.isArray(p) ? `<b>${esc(p[0])}</b>` : `<span>${esc(p)}</span>`)).join(" ")}</span>`);
    if (I.boat) chip("sea", "aboard", [I.ship || "the ship"]);
    else if (I.carriage) chip("cart", "by carriage");
    else {
      chip("gnd", I.ground);
      if (I.pace) chip("pace", I.pace);
      if (I.riding && I.horse) chip("ride", "riding", [I.horse.name]);
      else if (I.downed && I.horse) chip("down", [I.horse.name], "is downed");
      else if (I.horse) chip("led", "walking beside", [I.horse.name]);
      else chip("foot", I.heavy ? "too heavy to run" : "on foot");
    }
    if (I.weather) chip("wx", I.weather);
    for (const c of (I.company || []).slice(0, 4)) chip(c.player ? "pal" : "fol", [c.name]);
    if ((I.company || []).length > 4) chip("more", `+${I.company.length - 4}`);
    if (I.pet) chip("pet", [I.pet]);
    return `<div class="fpt-row"><b class="fpt-route"><span class="fpt-o">${esc(I.origin)}</span><i aria-hidden="true">→</i><span class="fpt-d">${esc(I.dest)}</span></b><span class="fpt-t num">${esc(I.timeText)}</span><span class="fpt-btns">${btns}</span></div>
      <div class="fpt-prog" title="${Math.round((I.p || 0) * 100)}%"><span class="fpt-fill"></span>${stops}<i class="fpt-s fpt-end" style="left:100%" title="${esc(I.dest)}"></i></div>
      <div class="fpt-chips">${chips.join("")}</div>`;
  }
  function show(wrap, I, onClick) {
    if (!wrap || typeof document === "undefined") return;
    info = I; clickFn = onClick || clickFn; shutKey = "fpt.shut." + (I.id || "me");
    const b = ensure(wrap), shut = isShut();
    b.classList.toggle("shut", shut);
    const head = barHTML(I, shut);
    if (head !== lastHead) { b.querySelector(".fpt-bar").innerHTML = head; lastHead = head; }
    const fill = b.querySelector(".fpt-fill"); if (fill) fill.style.width = `${clamp((I.p || 0) * 100, 0, 100).toFixed(1)}%`;
    // a companion's line, or once ever: the trip goes on while the game is closed
    const sayEl = b.querySelector(".fpt-say");
    let say = I.say ? `${I.say.who}: ${I.say.line}` : "";
    if (!say && !tipShown && store.get("fpt.tip") !== "1") { tipShown = true; store.set("fpt.tip", "1"); say = "Tip: the trip keeps going even when you close the game."; }
    if (say && say !== lastSay) { lastSay = say; sayUntil = Date.now() + 9000; sayEl.innerHTML = I.say ? `<b>${esc(I.say.who)}:</b> <span>${esc(I.say.line)}</span>` : `<span>${esc(say)}</span>`; }
    sayEl.classList.toggle("on", Date.now() < sayUntil && !shut);
    document.documentElement.classList.add("fpt-on");
    wrap.classList.add("fpt-on");
    const hgt = b.offsetHeight; if (hgt) wrap.style.setProperty("--fpt-h", hgt + "px");
    if (shut) stop(); else kick();
  }
  function hide() {
    if (!band && !info) return;   // called every refresh while not travelling: nothing to do
    stop(); io?.disconnect(); io = null;
    if (band) { band.remove(); band = null; }
    if (wrapEl) { wrapEl.classList.remove("fpt-on"); wrapEl.style.removeProperty("--fpt-h"); }
    if (typeof document !== "undefined") document.documentElement.classList.remove("fpt-on");
    info = null; lastHead = ""; lastSay = "";
  }

  // ------------------------------------------------------------------ the live loop
  let raf = 0, wait = 0, io = null, seen = true, lastTs = 0, travel = 0, headS = null, curveS = 0, walkPh = 0, last = null;
  const phone = () => typeof matchMedia !== "undefined" && (matchMedia("(pointer: coarse)").matches || innerWidth < 760);
  function kick() { if (!raf && !wait && band && info) { lastTs = 0; raf = requestAnimationFrame(loop); } }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; if (wait) clearTimeout(wait); wait = 0; }
  /* [perf] between pictures the loop sleeps on a timer instead of waking every screen refresh just to skip it
     (a 120 Hz phone woke it 120 times a second to draw 30) */
  function later(ms) { if (ms > 20) wait = setTimeout(() => { wait = 0; raf = requestAnimationFrame(loop); }, ms - 12); else raf = requestAnimationFrame(loop); }
  function loop(ts) {
    raf = 0;
    if (!band || !band.isConnected || !info || isShut()) return;
    if (typeof document !== "undefined" && document.hidden) { setTimeout(kick, 500); return; }
    const gap = phone() ? 33 : 22;
    if (lastTs && ts - lastTs < gap - 3) { later(gap - (ts - lastTs)); return; }
    const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
    const cv = band.querySelector(".fpt-view canvas"), host = cv.parentNode;
    const w = host.clientWidth, h = host.clientHeight;
    if (w > 10 && h > 10 && seen) {
      const dpr = Math.min(typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1, phone() ? 1.5 : 2);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      step(info, dt);
      paint(g, w, h, info, ts / 1000);
    }
    if (info.reduce) return;   // reduced motion: one still frame per update
    if (seen) later(gap);
  }
  /* move the world on: distance down the road, the head turning toward the route, the bend ahead */
  function step(I, dt) {
    const v = I.boat ? 1.6 : I.carriage ? 2.4 : I.riding ? 2.8 : 1.3;
    const go = I.reduce ? 0 : dt;
    travel += v * go * (I.slow ? 0.55 : 1);
    walkPh += go * (I.carriage || I.boat ? 1.4 : I.riding ? 2.5 : 1.8) * TAU * (I.slow ? 0.7 : 1);
    const hd = I.heading ?? 0;
    if (headS == null || I.reduce) headS = hd; else headS = (headS + relDeg(hd - headS) * Math.min(1, dt * 1.6) + 360) % 360;
    const c = clamp((I.turn || 0) / 70, -1, 1);
    curveS = I.reduce ? c : curveS + (c - curveS) * Math.min(1, dt * 1.2);
  }

  // ------------------------------------------------------------------ painting
  const BIO = (ground) => { const T = TA(); const k = (T && T.GROUND[ground]) || "grass"; return { k, B: (T && T.BIOME[k]) || { ground: "#7f9150", gd: "#62733f", road: "#a8916c", far: ["#8796a6", "#66788a"], hill: "#5d7347", ht: "#3f5636", trees: { pine: 0.5, broad: 0.5 }, n: 10, rocks: 3 } }; };
  function ridge(a, seed, rough) {   // a periodic skyline over 360° (a in degrees)
    const r = a * Math.PI / 180;
    return 0.5 + 0.28 * Math.sin(r * 3 + seed) + 0.16 * Math.sin(r * 7 + seed * 2.1) + rough * 0.09 * Math.sin(r * 17 + seed * 0.7) + rough * 0.05 * Math.sin(r * 31 + seed * 1.3);
  }
  function paint(g, w, h, I, t) {
    const T = TA(), st = I.sky || null, { k: kind, B: B0 } = BIO(I.ground), L = T ? T.draw.light(st) : { tod: "day", wx: "clear", tints: [], horizon: "#e8dcc0", hazeAdd: 0, glow: 0 };
    const tod = L.tod, wx = L.wx, snowy = !!B0.snowy || (st?.season === "winter" && st?.cold) || wx === "blizzard";
    const B = snowy && !B0.snowy ? { ...B0, ground: mix(B0.ground, "#e4eaee", 0.72), gd: mix(B0.gd, "#c3cdd6", 0.72), hill: mix(B0.hill, "#d4dde4", 0.6) } : B0;   // a winter coat on any region
    const bobA = I.reduce ? 0 : I.boat ? 0 : I.carriage ? 0.004 : I.riding ? 0.016 : 0.01;
    const bob = Math.sin(walkPh * (I.riding ? 1 : 2)) * h * bobA;
    const hz = Math.round(h * 0.46 + bob);
    const pxDeg = w / FOV, X = (a) => w / 2 + relDeg(a - headS) * pxDeg;
    const dbg = { w, h, hz, kind, tod, wx, riding: !!I.riding, boat: !!I.boat, objects: 0, dest: null };
    g.save();
    if (I.boat && !I.reduce) { g.translate(w / 2, h); g.rotate(Math.sin(t * 0.9) * 0.012); g.translate(-w / 2, -h); }
    // sky
    let sc = ["#93b2c6", "#e8dcc0"]; try { if (st && typeof SKY !== "undefined") sc = SKY.skyColors(st); } catch { /* plain */ }
    const sg = g.createLinearGradient(0, 0, 0, hz); sg.addColorStop(0, sc[0]); sg.addColorStop(1, sc[1]);
    g.fillStyle = sg; g.fillRect(-4, -4, w + 8, hz + 6);
    const r0 = seeded("fpt-stars");
    if (tod === "night" || tod === "dusk") {
      const k = tod === "night" ? 1 : 0.35, dull = ["cloudy", "rain", "storm", "snow", "blizzard", "fog", "ashstorm"].includes(wx) ? 0.25 : 1;
      for (let i = 0; i < 90; i++) { const az = r0() * 360, alt = r0(), x = X(az), y = hz * (1 - alt) * 0.95; if (x < -2 || x > w + 2) continue; const tw = 0.6 + 0.4 * Math.sin(t * (1 + r0() * 2) + i); g.fillStyle = `rgba(255,248,230,${(0.25 + 0.6 * r0()) * tw * k * dull})`; g.fillRect(x, y, r0() < 0.1 ? 1.6 : 1, r0() < 0.1 ? 1.6 : 1); }
      if (tod === "night" && st?.north && dull === 1) {   // the aurora over the north
        g.save(); g.globalCompositeOperation = "lighter";
        for (let j = 0; j < 3; j++) { g.strokeStyle = `rgba(${j === 1 ? "120,220,170" : "90,200,160"},${0.08 + j * 0.03})`; g.lineWidth = h * (0.08 - j * 0.02); g.beginPath();
          for (let x = 0; x <= w; x += 8) { const a = headS + (x - w / 2) / pxDeg, y = hz * (0.25 + 0.12 * Math.sin(a * 0.05 + t * 0.2 + j) + 0.05 * Math.sin(a * 0.13 - t * 0.3)); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
        g.restore();
      }
    }
    // sun / moon where they really are in the sky (east at dawn, south at noon, west at dusk)
    const hour = st?.hour ?? 13, heavy = ["storm", "blizzard", "fog", "ashstorm", "rain"].includes(wx);
    if (tod !== "night") {
      const az = 90 + (hour - 6) * 15, el = Math.max(0.04, Math.sin(Math.PI * clamp((hour - 5) / 15, 0, 1))), x = X(az), y = hz - el * hz * 0.85;
      if (x > -40 && x < w + 40) { const rr = h * 0.05; const gl = g.createRadialGradient(x, y, 0, x, y, rr * 5); gl.addColorStop(0, `rgba(255,240,200,${heavy ? 0.2 : 0.55})`); gl.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = gl; g.fillRect(x - rr * 5, y - rr * 5, rr * 10, rr * 10); if (!heavy) { g.fillStyle = tod === "day" ? "#fff6dc" : "#ffd59a"; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); } }
    } else {
      const az = 90 + ((hour + 6) % 24) * 15, x = X(az), y = hz * 0.28, rr = h * 0.045, ph = st?.moon ?? 4;
      if (x > -20 && x < w + 20 && ph !== 0) { g.fillStyle = heavy ? "rgba(230,232,240,.25)" : "#eeeadc"; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); if (ph !== 4) { g.fillStyle = sc[0]; g.beginPath(); g.arc(x + (ph < 4 ? -1 : 1) * rr * (1 - Math.abs(4 - ph) / 4) * 1.6, y, rr, 0, TAU); g.fill(); } }
    }
    // clouds drifting
    const nCloud = { clear: 3, cloudy: 9, fog: 4, rain: 10, storm: 12, snow: 8, blizzard: 10, ashstorm: 6 }[wx] ?? 4, rc = seeded("fpt-cloud");
    const cc = tod === "night" ? "#3a4252" : wx === "storm" ? "#5a6068" : tod === "dusk" ? "#d8a48a" : "#f4efe4";
    for (let i = 0; i < nCloud; i++) { const az = (rc() * 360 + t * (0.6 + rc())) % 360, x = X(az), y = hz * (0.15 + rc() * 0.5), s = h * (0.05 + rc() * 0.06); if (x < -s * 4 || x > w + s * 4) continue; g.fillStyle = rgba(cc, heavy ? 0.55 : 0.4); g.beginPath(); g.ellipse(x, y, s * 3, s * 0.9, 0, 0, TAU); g.ellipse(x - s * 1.5, y + s * 0.2, s * 1.6, s * 0.7, 0, 0, TAU); g.ellipse(x + s * 1.4, y + s * 0.1, s * 1.8, s * 0.8, 0, 0, TAU); g.fill(); }
    // far ranges (painted layer if Kacper's picture is there)
    const hazeK = 0.35 + L.hazeAdd, nightK = tod === "night" ? 0.45 : tod === "dusk" ? 0.15 : 0;
    const tone = (c, k) => mix(mix(c, L.horizon, k), "#0c1424", nightK);
    const pl = painted(LAYERS[kind]?.far);
    if (pl) { const iw = pl.width * (hz * 0.7 / pl.height), off = ((-headS / 360) * iw * 1.8) % iw; for (let x = off - iw; x < w; x += iw) g.drawImage(pl, x, hz - hz * 0.7, iw, hz * 0.7); }
    else for (const [i, amp, base, rough] of [[0, 0.55, 0.06, 1], [1, 0.36, 0.02, 1.4]]) {
      const col = tone(B.far[i] || B.far[0], hazeK * (i ? 0.7 : 1)), A = hz * amp;
      g.beginPath(); g.moveTo(-2, hz + 2);
      for (let x = -2; x <= w + 4; x += 4) { const a = headS + (x - w / 2) / pxDeg; g.lineTo(x, hz - base * hz - A * ridge(a, 1.7 + i * 2.9, rough)); }
      g.lineTo(w + 4, hz + 2); g.closePath(); g.fillStyle = col; g.fill();
      if (i === 0 && (snowy || kind === "rock" || kind === "tundra" || kind === "snow" || kind === "pine")) {   // snow on the high peaks
        g.save(); g.clip(); g.fillStyle = tone("#f2f5f7", hazeK * 0.8); g.fillRect(-2, 0, w + 8, hz - base * hz - A * (snowy ? 0.42 : 0.62)); g.restore();
      }
    }
    if (B.volcano) { const x = X(100); if (x > -60 && x < w + 60) { const s = hz * 0.5; g.fillStyle = tone("#5a4a44", hazeK * 0.6); g.beginPath(); g.moveTo(x - s * 1.6, hz); g.lineTo(x - s * 0.18, hz - s); g.lineTo(x + s * 0.18, hz - s); g.lineTo(x + s * 1.6, hz); g.fill(); for (let i = 0; i < 4; i++) { const k = (t * 0.05 + i / 4) % 1; g.fillStyle = `rgba(90,80,76,${0.3 * (1 - k)})`; g.beginPath(); g.arc(x + k * s * 0.6, hz - s - k * s * 0.8, s * (0.12 + k * 0.25), 0, TAU); g.fill(); } } }
    // hills
    const ph2 = painted(LAYERS[kind]?.hills);
    if (ph2) { const iw = ph2.width * (hz * 0.4 / ph2.height), off = ((-headS / 360) * iw * 2.6) % iw; for (let x = off - iw; x < w; x += iw) g.drawImage(ph2, x, hz - hz * 0.4 + 2, iw, hz * 0.4); }
    else { g.beginPath(); g.moveTo(-2, hz + 2); for (let x = -2; x <= w + 4; x += 4) { const a = headS * 1.4 + (x - w / 2) / pxDeg * 1.4; g.lineTo(x, hz + 1 - hz * 0.16 * ridge(a, 4.2, 2)); } g.lineTo(w + 4, hz + 2); g.closePath(); g.fillStyle = tone(B.hill, hazeK * 0.45); g.fill(); }
    // where you're heading, rising over its compass marker
    const lights = [];
    if (T && I.dest && I.destBear != null && !I.boat) {
      const rel = relDeg(I.destBear - headS);
      if (Math.abs(rel) < FOV / 2 + 10) {
        const p = clamp(I.p || 0, 0, 1), k = (h / 112) * (0.32 + p * 0.6), x = w / 2 + rel * pxDeg;
        g.save(); g.translate(x, hz + 1); g.scale(k, k); g.translate(-(360 * 0.84 - p * 8), -(74 + p * 2));
        try { T.draw.destination(g, { dest: I.dest }, p, { B, L, ink: true, st }, lights, t); } catch { /* no picture */ }
        glow(g, lights, L); g.restore(); lights.length = 0;
        dbg.dest = { x, k };
      }
    }
    // the ground
    if (I.boat) seaFloor(g, w, h, hz, t, L, tod);
    else {
      const gg = g.createLinearGradient(0, hz, 0, h); gg.addColorStop(0, tone(B.gd, 0.35)); gg.addColorStop(1, mix(B.ground, "#0c1424", nightK));
      g.fillStyle = gg; g.fillRect(-4, hz, w + 8, h - hz + 6);
      road(g, w, h, hz, I, B, kind, snowy, tone, nightK, t, lights, dbg);
    }
    // weather on top of everything in the world
    weather(g, w, h, hz, wx, t, I, kind, st, tod);
    for (const tt of L.tints) { g.fillStyle = tt; g.fillRect(-4, -4, w + 8, h + 8); }
    if (L.glow > 0.2) glow(g, lights, L);
    // you: horse ears and reins, a carriage bench, a ship's bow
    if (I.riding && !I.carriage && !I.boat) rider(g, w, h, I, walkPh, nightK);
    else if (I.carriage) bench(g, w, h, walkPh, nightK);
    else if (I.boat) bow(g, w, h, t, nightK);
    // a soft frame
    const vg = g.createRadialGradient(w / 2, h * 0.55, h * 0.4, w / 2, h * 0.55, w * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(6,7,9,0.5)");
    g.fillStyle = vg; g.fillRect(-4, -4, w + 8, h + 8);
    g.restore();
    last = dbg;
  }
  function glow(g, lights, L) {
    if (!lights.length || L.glow < 0.2) return;
    g.save(); g.globalCompositeOperation = "lighter";
    for (const [x, y, r, c, a] of lights) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${0.55 * a * L.glow})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.restore();
  }
  /* the road: slices from your feet to the horizon, bending with the route; things on both sides come toward you */
  const ZF = 46, NS = 54, STEP = 1.05, FORD = 3;
  function road(g, w, h, hz, I, B, kind, snowy, tone, nightK, t, lights, dbg) {
    const T = TA(), H = h - hz, half0 = w * 0.3;
    const cx = (z) => w / 2 + curveS * w * 0.42 * Math.pow((z - 1) / (ZF - 1), 0.7);
    const yz = (z) => hz + H / z, hw = (z) => half0 / z;
    const rc = mix(snowy ? "#d6d2ca" : B.road, "#0c1424", nightK * 1.2), rd = mix(rc, "#000000", 0.06), edge = mix(B.gd, "#000000", 0.25 + nightK * 0.3);
    const paved = I.ground === "Road" || I.ground === "Bridge", ford = I.ground === "River (ford)", bridge = I.ground === "Bridge", shore = I.ground === "Lake" || I.ground === "Sea";
    // ground stripes moving toward you (grass rows)
    for (let i = 0; i < NS; i++) {
      const z0 = Math.pow(ZF, i / NS), z1 = Math.pow(ZF, (i + 1) / NS), y0 = yz(z0), y1 = yz(z1);
      if (Math.floor((z0 + travel) / 1.6) % 2) { g.fillStyle = "rgba(0,0,0,0.05)"; g.fillRect(-4, y1, w + 8, y0 - y1 + 0.5); }
    }
    if (ford || shore) {   // water across (ford) or along one side (lake, sea)
      const zA = 1, zB = ford ? FORD : ZF;
      g.fillStyle = mix("#5f8aa0", "#0c1424", nightK);
      if (ford) g.fillRect(-4, yz(zB), w + 8, h - yz(zB) + 4);
      else { g.beginPath(); g.moveTo(-4, yz(zB)); for (let z = ZF; z >= 1; z /= 1.15) g.lineTo(cx(z) - hw(z) * 2.2, yz(z)); g.lineTo(-4, h + 4); g.closePath(); g.fill(); }
      g.strokeStyle = "rgba(235,245,250,0.35)"; g.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const z = 1 + ((i * 0.41 + travel * 0.6) % (zB - zA)), y = yz(z), x = ((i * 97) % 100) / 100 * w; g.beginPath(); g.moveTo(x - 10 / z * 3, y); g.lineTo(x + 10 / z * 3, y); g.stroke(); }
    }
    // the road itself
    for (let i = NS - 1; i >= 0; i--) {
      const z0 = Math.pow(ZF, i / NS), z1 = Math.pow(ZF, (i + 1) / NS), y0 = yz(z0), y1 = yz(z1);
      if (ford && z0 < FORD) continue;   // under water at the ford
      const a0 = cx(z0), a1 = cx(z1), h0 = hw(z0), h1 = hw(z1);
      const band = Math.floor((z0 + travel) / (paved ? 0.7 : 1.3)) % 2;
      g.fillStyle = edge; g.beginPath(); g.moveTo(a0 - h0 * 1.12, y0 + 0.5); g.lineTo(a1 - h1 * 1.12, y1); g.lineTo(a1 + h1 * 1.12, y1); g.lineTo(a0 + h0 * 1.12, y0 + 0.5); g.fill();
      g.fillStyle = band ? rc : rd; g.beginPath(); g.moveTo(a0 - h0, y0 + 0.5); g.lineTo(a1 - h1, y1); g.lineTo(a1 + h1, y1); g.lineTo(a0 + h0, y0 + 0.5); g.fill();
      if (!paved && z0 < 20) { g.fillStyle = "rgba(40,30,20,0.16)"; for (const k of [-0.45, 0.45]) { g.beginPath(); g.moveTo(a0 + h0 * k - h0 * 0.06, y0 + 0.5); g.lineTo(a1 + h1 * k - h1 * 0.06, y1); g.lineTo(a1 + h1 * k + h1 * 0.06, y1); g.lineTo(a0 + h0 * k + h0 * 0.06, y0 + 0.5); g.fill(); } }
      if (paved && band && z0 < 24) { g.fillStyle = "rgba(255,250,235,0.08)"; g.fillRect(a0 - h0 * 0.9, y1, h0 * 1.8, Math.max(0.6, (y0 - y1) * 0.25)); }
    }
    if (ford) { g.fillStyle = "rgba(235,245,250,0.3)"; g.fillRect(-4, yz(FORD) - 1, w + 8, 2); }
    // things by the road, far first
    if (!T) return;
    const D = T.draw, trees = Object.entries(B.trees || { pine: 1 }), sum = trees.reduce((a, [, v]) => a + v, 0);
    const pickTree = (r) => { let x = r() * sum; for (const [k, v] of trees) { x -= v; if (x <= 0) return k; } return trees[0][0]; };
    const season = I.sky?.season || "summer", ink = true, dens = clamp((B.n || 10) / 14, 0.55, 1.15), tuft = mix(B.gd, "#0c1424", nightK);
    const i0 = Math.floor(travel / STEP) + 1, i1 = Math.floor((travel + ZF * 0.75) / STEP);
    const seedBase = "fpt|" + (I.dest || "") + "|" + kind;
    for (let i = i1; i >= i0; i--) {
      const z = i * STEP - travel; if (z < 0.55) continue;
      if (ford && z < FORD + 0.4) continue;   // nothing grows in the river
      const r = seeded(seedBase + "|" + i), fade = z > 14 ? clamp(1 - (z - 14) / (ZF * 0.75 - 14), 0, 1) : 1;
      const base = yz(z), c = cx(z), hwz = hw(z), sc = H / z;
      g.globalAlpha = fade;
      // a landmark now and then, right by the road
      if (r() < 0.07) {
        const types = ["sign", "shrine", "stone", "cairn", "ruin", "fence", "camp", "lamp", "cart"], ty = types[Math.floor(r() * types.length)], side = r() < 0.5 ? -1 : 1;
        const x = c + side * hwz * 1.5, k = sc * 0.034;
        if (x > -sc && x < w + sc) { g.save(); g.translate(x, base); g.scale(k, k); try { D.landmark(g, ty, 0, 0, r, ink, lights, t, snowy); } catch { /* skip */ } g.restore(); dbg.objects++; }
      }
      for (const side of [-1, 1]) {
        if (r() > 0.75 * dens) continue;
        const lat = 1.35 + r() * 3.2, x = c + side * lat * hwz, kindT = pickTree(r), th = sc * (0.75 + r() * 0.55);
        if (x < -th || x > w + th) continue;
        dbg.objects++;
        try {
          if (kindT === "pine") D.pine(g, x, base, th, mix(snowy ? "#3f5a48" : "#3d5a36", "#0c1424", 0), mix("#2a4028", "#000000", 0.1), snowy, ink);
          else if (kindT === "broad") { const cols = D.treeCols("broad", season, snowy); D.broad(g, x, base, th * 0.85, cols || ["#577d3e", "#3f5f2e", "#7ea254"], ink, !cols); }
          else if (kindT === "birch") D.birch(g, x, base, th * 0.9, D.treeCols("birch", season, snowy), ink);
          else if (kindT === "dead") D.dead(g, x, base, th * 0.8, r, "#4a3a2c");
          else if (kindT === "boulder") D.boulder(g, x, base, th * 0.22, mix("#8a847a", "#0c1424", nightK), ink, snowy, kind === "forest" || kind === "pine");
          else if (kindT === "reeds") D.reeds(g, x, base, th * 0.3, r);
          else if (kindT === "bush") D.bush(g, x, base, th * 0.16, ["#6b7a44", "#56643a"]);
        } catch { /* skip */ }
      }
      // grass tufts and stones by the verge, so the ground moves past you
      if (z < 12 && !snowy) { g.strokeStyle = tuft; g.lineWidth = Math.max(0.8, sc * 0.012); g.beginPath(); for (const side of [-1, 1]) { const x = c + side * hwz * (1.2 + r() * 1.4), l = sc * 0.06; g.moveTo(x - l * 0.4, base); g.lineTo(x - l * 0.6, base - l); g.moveTo(x, base); g.lineTo(x, base - l * 1.2); g.moveTo(x + l * 0.4, base); g.lineTo(x + l * 0.6, base - l); } g.stroke(); }
      // bridge rails
      if (bridge && z < 14) for (const side of [-1, 1]) { const x = c + side * hwz * 1.08; g.fillStyle = "#5a4430"; g.fillRect(x - sc * 0.015, base - sc * 0.2, sc * 0.03, sc * 0.2); }
    }
    g.globalAlpha = 1;
  }
  function seaFloor(g, w, h, hz, t, L, tod) {
    const sg = g.createLinearGradient(0, hz, 0, h); sg.addColorStop(0, tod === "night" ? "#1c2a3a" : "#5f7f94"); sg.addColorStop(1, tod === "night" ? "#0c1620" : "#2e4a5e");
    g.fillStyle = sg; g.fillRect(-4, hz, w + 8, h - hz + 6);
    g.strokeStyle = "rgba(230,240,245,0.3)"; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const z = 1 + ((i * 1.7 + travel) % 30), y = hz + (h - hz) / z, x = ((i * 53) % 100) / 100 * w, l = 30 / z; g.beginPath(); g.moveTo(x - l, y); g.quadraticCurveTo(x, y - 2 / z * 3, x + l, y); g.stroke(); }
  }
  /* weather, in screen space */
  function weather(g, w, h, hz, wx, t, I, kind, st, tod) {
    if (I.reduce && !["fog", "blizzard"].includes(wx)) return;
    const r = seeded("fpt-wx"), wind = (st?.wind ?? 0.3) * (wx === "blizzard" ? 3 : 1);
    if (wx === "snow" || wx === "blizzard") {
      const n = wx === "blizzard" ? 150 : 70; g.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < n; i++) { const sp = 0.25 + r() * 0.6, x = ((r() * w + t * w * wind * 0.25 * sp + Math.sin(t + i) * 6) % w + w) % w, y = (r() * h + t * h * sp * 0.4) % h, s = 0.8 + r() * 1.8; g.fillRect(x, y, s, s); }
    } else if (wx === "rain" || wx === "storm") {
      g.strokeStyle = "rgba(200,215,230,0.35)"; g.lineWidth = 1; g.beginPath();
      for (let i = 0; i < (wx === "storm" ? 110 : 70); i++) { const x = ((r() * w + t * 40) % w + w) % w, y = (r() * h + t * h * (1.6 + r())) % h; g.moveTo(x, y); g.lineTo(x - 2, y + h * 0.08); }
      g.stroke();
      if (wx === "storm" && Math.sin(t * 0.7) > 0.995) { g.fillStyle = "rgba(240,240,255,0.5)"; g.fillRect(0, 0, w, h); }
    } else if (wx === "ashstorm") {
      for (let i = 0; i < 70; i++) { const x = ((r() * w + t * 30 * (0.5 + r())) % w + w) % w, y = (r() * h + t * 8) % h; g.fillStyle = r() < 0.15 ? "rgba(255,150,80,0.7)" : "rgba(90,80,72,0.6)"; g.fillRect(x, y, 1.5, 1.5); }
    } else if (kind === "autumn" && !I.reduce) {
      for (let i = 0; i < 12; i++) { const x = ((r() * w + t * 25) % w + w) % w, y = (r() * h + t * 14 + Math.sin(t * 2 + i) * 8) % h; g.fillStyle = r() < 0.5 ? "#d79a2e" : "#b8642c"; g.beginPath(); g.ellipse(x, y, 2.2, 1.2, t + i, 0, TAU); g.fill(); }
    } else if (tod === "night" && st?.season === "summer" && (kind === "forest" || kind === "grass" || kind === "marsh")) {
      for (let i = 0; i < 12; i++) { const x = r() * w + Math.sin(t * 0.7 + i) * 12, y = hz + r() * (h - hz) * 0.6 + Math.cos(t + i) * 6; g.fillStyle = `rgba(220,255,150,${0.4 + 0.4 * Math.sin(t * 3 + i)})`; g.fillRect(x, y, 1.6, 1.6); }
    }
    if (wx === "fog" || wx === "blizzard" || kind === "marsh") {
      const a = wx === "fog" ? 0.45 : wx === "blizzard" ? 0.35 : 0.18, fg = g.createLinearGradient(0, hz - h * 0.25, 0, hz + h * 0.3);
      fg.addColorStop(0, "rgba(220,224,226,0)"); fg.addColorStop(0.5, `rgba(220,224,226,${a})`); fg.addColorStop(1, "rgba(220,224,226,0)"); g.fillStyle = fg; g.fillRect(-4, hz - h * 0.25, w + 8, h * 0.55);
    }
  }
  /* your mount from the saddle: neck, mane, ears, and your hands on the reins */
  function skinOf(look) {
    const R = { nord: "#ecc9a8", imperial: "#d9ab82", breton: "#f0d2b6", redguard: "#7a4e33", altmer: "#e3cf8a", bosmer: "#b5864f", dunmer: "#7d8a92", orc: "#7f9a5c", khajiit: "#c9a46c", argonian: "#6f8a5a" };
    if (look?.ww) return "#4a3a2e";
    let c = R[look?.r] || "#e2b894"; if (look?.v) c = mix(c, "#d8d8dc", 0.5);
    return c;
  }
  function gearCol(id, fall) {
    try { if (id && typeof GEARLOOK !== "undefined") { const S = GEARLOOK.SETS[GEARLOOK.setOf(id)]; if (S?.c) return S.c; } } catch { /* plain */ }
    return fall;
  }
  function rider(g, w, h, I, ph, nightK) {
    const coat = mix(I.horse?.coat || "#8a5a3b", "#0c1424", nightK * 0.8), dark = mix(coat, "#000000", 0.35), mane = mix(I.horse?.coat === "#ebe6da" || I.horse?.coat === "#d6aa5b" ? "#e8dcc0" : "#2a2018", "#0c1424", nightK * 0.6);
    const b = Math.sin(ph) * h * 0.02, nod = Math.sin(ph + 0.6) * h * 0.012, cx = w / 2;
    const top = h * 0.64 + b + nod, s = h / 112;
    g.save();
    // neck rising from the bottom to the poll
    g.fillStyle = coat; g.beginPath(); g.moveTo(cx - 34 * s, h + 4); g.quadraticCurveTo(cx - 20 * s, top + 22 * s, cx - 9 * s, top + 6 * s); g.lineTo(cx + 9 * s, top + 6 * s); g.quadraticCurveTo(cx + 20 * s, top + 22 * s, cx + 34 * s, h + 4); g.closePath(); g.fill();
    g.fillStyle = dark; g.beginPath(); g.moveTo(cx + 10 * s, top + 10 * s); g.quadraticCurveTo(cx + 20 * s, top + 26 * s, cx + 32 * s, h + 4); g.lineTo(cx + 22 * s, h + 4); g.quadraticCurveTo(cx + 14 * s, top + 30 * s, cx + 6 * s, top + 12 * s); g.fill();
    // mane down the middle
    g.fillStyle = mane; g.beginPath(); g.moveTo(cx - 5 * s, top + 4 * s); g.quadraticCurveTo(cx - 8 * s, top + 26 * s, cx - 6 * s, h + 4); g.lineTo(cx + 6 * s, h + 4); g.quadraticCurveTo(cx + 7 * s, top + 26 * s, cx + 5 * s, top + 4 * s); g.fill();
    // ears
    for (const sd of [-1, 1]) { g.fillStyle = coat; g.beginPath(); g.moveTo(cx + sd * 3 * s, top + 6 * s); g.lineTo(cx + sd * 9 * s, top - 9 * s + Math.sin(ph * 0.5 + sd) * s); g.lineTo(cx + sd * 11 * s, top + 6 * s); g.fill(); g.fillStyle = dark; g.beginPath(); g.moveTo(cx + sd * 6 * s, top + 4 * s); g.lineTo(cx + sd * 9 * s, top - 5 * s); g.lineTo(cx + sd * 10 * s, top + 4 * s); g.fill(); }
    g.strokeStyle = "rgba(30,20,12,0.6)"; g.lineWidth = Math.max(1, s); g.beginPath(); g.moveTo(cx - 9 * s, top + 6 * s); g.quadraticCurveTo(cx - 20 * s, top + 22 * s, cx - 34 * s, h + 4); g.moveTo(cx + 9 * s, top + 6 * s); g.quadraticCurveTo(cx + 20 * s, top + 22 * s, cx + 34 * s, h + 4); g.stroke();
    // reins from the bit to your hands
    const hy = h - 6 * s + b * 0.5, hl = cx - 46 * s, hr = cx + 46 * s;
    g.strokeStyle = "#3a2618"; g.lineWidth = Math.max(1.2, 1.6 * s);
    g.beginPath(); g.moveTo(cx - 10 * s, top + 14 * s); g.quadraticCurveTo(cx - 30 * s, top + 34 * s, hl + 6 * s, hy); g.moveTo(cx + 10 * s, top + 14 * s); g.quadraticCurveTo(cx + 30 * s, top + 34 * s, hr - 6 * s, hy); g.stroke();
    // hands: gloves if you wear them, else your skin, sleeves in your armour's colour
    const look = I.look || {}, glove = look.eq?.hands ? gearCol(look.eq.hands, "#5a3e26") : skinOf(look), sleeve = gearCol(look.eq?.chest, "#6b5a46");
    for (const [x, sd] of [[hl, -1], [hr, 1]]) {
      g.fillStyle = mix(sleeve, "#0c1424", nightK); g.beginPath(); g.moveTo(x + sd * 4 * s, hy - 2 * s); g.lineTo(x + sd * 26 * s, h + 6); g.lineTo(x - sd * 6 * s, h + 6); g.closePath(); g.fill();
      g.fillStyle = mix(glove, "#0c1424", nightK); g.beginPath(); g.ellipse(x, hy, 7 * s, 5.5 * s, sd * 0.3, 0, TAU); g.fill();
      g.strokeStyle = "rgba(30,20,12,0.45)"; g.lineWidth = Math.max(0.8, s * 0.8); g.stroke();
    }
    g.restore();
  }
  function bench(g, w, h, ph, nightK) {
    const s = h / 112, j = Math.sin(ph * 2) * s * 0.8;
    // two horses' backs ahead, the driver's reins, the footboard
    for (const sd of [-1, 1]) { const x = w / 2 + sd * 16 * s, y = h * 0.74 + j; g.fillStyle = mix(sd < 0 ? "#8a5a3b" : "#6a4a32", "#0c1424", nightK); g.beginPath(); g.ellipse(x, y, 13 * s, 8 * s, 0, 0, TAU); g.fill(); g.fillStyle = "#2a2018"; g.fillRect(x - 1.5 * s, y - 9 * s, 3 * s, 10 * s); }
    g.fillStyle = mix("#6b4a2e", "#0c1424", nightK); g.fillRect(-4, h - 12 * s + j, w + 8, 14 * s); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(-4, h - 12 * s + j, w + 8, 2 * s);
  }
  function bow(g, w, h, t, nightK) {
    const s = h / 112, cx = w / 2, y0 = h * 0.7 + Math.sin(t * 1.3) * 2 * s;
    g.fillStyle = mix("#6b4a2e", "#0c1424", nightK); g.beginPath(); g.moveTo(cx, y0); g.lineTo(cx + 70 * s, h + 4); g.lineTo(cx - 70 * s, h + 4); g.closePath(); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.3)"; g.lineWidth = s; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(cx, y0 + i * 3 * s); g.lineTo(cx + 70 * s, h + 4 + i * 4 * s); g.moveTo(cx, y0 + i * 3 * s); g.lineTo(cx - 70 * s, h + 4 + i * 4 * s); g.stroke(); }
    g.strokeStyle = "#c8b48a"; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(cx, y0); g.lineTo(cx, y0 - 24 * s); g.stroke();
  }

  /* one still picture (tests, screenshots) */
  function frame(I, opts = {}) {
    const w = opts.w || 390, h = opts.h || 120, sc = opts.scale || 1;
    const c = document.createElement("canvas"); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
    const g = c.getContext("2d"); g.scale(sc, sc);
    const keep = [travel, headS, curveS, walkPh];
    travel = opts.travel ?? 7.3; headS = I.heading ?? 0; curveS = clamp((I.turn || 0) / 70, -1, 1); walkPh = opts.phase ?? 0.6;
    paint(g, w, h, I, opts.t ?? 12.3);
    [travel, headS, curveS, walkPh] = keep;
    return c;
  }
  const debug = () => (last ? { ...last, travel, heading: headS, curve: curveS, running: !!(raf || wait), shut: band ? band.classList.contains("shut") : null } : null);
  return { show, hide, frame, debug, LAYERS, FOV, get el() { return band; } };
})();
