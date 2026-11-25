/* Mining mini-game. [OURS]
   Remigiusz: "Mining should have a mini game. There should be mini games everywhere."
   - The rock face is a 4×4 wall. Some stones hide ore, sometimes a gem. Veins you can spot glint; the better your
     Smithing, the more of them you spot. Blank rock breaks in one blow (and wastes the swing).
   - A strike meter swings back and forth. Tap a stone while the needle is in the bright band: Perfect hits for 3,
     Good for 2, a miss for 1. Ore takes 3, a gem 4. Break ore with a Perfect blow and it can split into two pieces.
   - You get a few swings (more with Smithing and the Prospector perk). Stop any time and keep what you dug out.
   - "Quick dig" skips the game and gives the plain result, same as mining always gave. The game can do better or worse.
   Screen tests skip it unless the page has ?minegame. */
const MINEGAME = (() => {
  const DOM = typeof document !== "undefined";
  const COLS = 4, ROWS = 4;
  const HP = { stone: 1, ore: 3, gem: 4 };
  const PERFECT = 3, GOOD = 2, POOR = 1;
  const SPEED = 0.95;                       // meter sweeps per second (there and back is two)
  const params = () => (DOM ? new URLSearchParams(location.search) : new URLSearchParams(""));
  const automated = () => DOM && (navigator.webdriver || params().has("notut"));
  const PREFS = "rotn_prefs";
  const pref = (k, d) => { try { const v = JSON.parse(localStorage.getItem(PREFS) || "{}")[k]; return v === undefined ? d : v; } catch { return d; } };
  const setPref = (k, v) => { try { const p = JSON.parse(localStorage.getItem(PREFS) || "{}"); p[k] = v; localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* ignore */ } };
  const wants = () => DOM && (params().has("minegame") || (!automated() && pref("mineGame", true)));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sfx = (n) => { try { if (typeof SOUND !== "undefined") SOUND.fx(n); } catch { /* no audio */ } };
  const perk = (s, k) => (typeof PFX !== "undefined" ? +PFX.num(s, k) || 0 : 0);

  // ====================================================================== the rules (pure, tested in Node)
  /* a fresh rock face for this mine */
  function plan(s, place, rnd = Math.random) {
    const skill = G.skill(s, "Smithing"), bag = SMITH.oreBag(place), n = SMITH.oreCount(s, rnd);
    const cells = Array.from({ length: COLS * ROWS }, () => ({ kind: "stone", item: null, hp: HP.stone, max: HP.stone, glint: false, broken: false }));
    const free = [...cells.keys()].sort(() => rnd() - 0.5);
    const spot = perk(s, "prospect") > 0 ? 1 : Math.min(0.95, 0.55 + skill / 200);   // Prospector: every vein glints
    for (let k = 0; k < n && free.length; k++) {
      const c = cells[free.pop()];
      Object.assign(c, { kind: "ore", item: bag[Math.floor(rnd() * bag.length)], hp: HP.ore, max: HP.ore, glint: rnd() < spot });
    }
    if (rnd() < 0.15 + perk(s, "gemfind") && free.length) {
      const c = cells[free.pop()];
      Object.assign(c, { kind: "gem", item: "gem_" + SMITH.GEM_BAG[Math.floor(rnd() * SMITH.GEM_BAG.length)], hp: HP.gem, max: HP.gem, glint: rnd() < spot * 0.6 });
    }
    const swings = 15 + Math.floor(skill / 25) + Math.round(perk(s, "mineswing"));
    return { place, cells, swings, swings0: swings, got: {}, log: [], over: false, rnd };
  }
  /* the bright band on the meter: wider with skill */
  const ez = (k) => (typeof A11Y !== "undefined" && A11Y[k] ? A11Y[k]() : 1);   // Settings → Accessibility → Easy timing
  function zone(skill, rnd = Math.random) {
    const good = Math.min(0.56, Math.min(0.4, 0.2 + Math.max(0, skill - 15) / 100 * 0.16) * ez("zoneEase")), perfect = good * 0.36;
    const mid = good / 2 + 0.05 + rnd() * (0.9 - good);
    return { mid, good, perfect };
  }
  /* how hard the blow lands, for a needle at pos (0..1) */
  function power(z, pos) {
    if (pos == null) return POOR;
    const d = Math.abs(pos - z.mid);
    return d <= z.perfect / 2 ? PERFECT : d <= z.good / 2 ? GOOD : POOR;
  }
  const left = (g) => g.cells.some((c) => !c.broken && c.kind !== "stone");
  /* swing at stone i with this much power. Returns what happened: {broke, item, n, kind} or null if nothing to hit */
  function strike(g, i, dmg) {
    const c = g.cells[i];
    if (g.over || !c || c.broken || g.swings <= 0) return null;
    g.swings--;
    c.hp = Math.max(0, c.hp - dmg);
    const out = { i, dmg, broke: false, kind: c.kind, item: null, n: 0 };
    if (c.hp <= 0) {
      c.broken = true; out.broke = true;
      if (c.kind !== "stone") {
        out.item = c.item; out.n = 1 + (c.kind === "ore" && dmg === PERFECT && g.rnd() < 0.5 ? 1 : 0);   // a clean split
        g.got[c.item] = (g.got[c.item] || 0) + out.n;
      }
    }
    if (g.swings <= 0 || !left(g)) g.over = true;
    return out;
  }
  /* how many pieces in all */
  const total = (got) => Object.values(got || {}).reduce((a, b) => a + b, 0);

  // ====================================================================== the screen
  /* The look (b193): the painted cave (mg-mining-bg) behind, the rock wall cut from the same painting, ore chunks
     (ore-*.webp) showing in the veins you spot, and a painted pickaxe (tool-pickaxe) that swings onto the stone you tap.
     Timing after GPT's notes: wind-up then a fast strike (~190 ms to impact), a 40 ms hit freeze, a 220 ms rebound.
     The impact cracks the stone, throws chips and dust (sparks on a Perfect), a glint flares on ore, and broken-out
     ore pops up and flies into the haul row. A Perfect shakes the screen. A result card shows the haul at the end.
     Every picture is optional: without them the old drawn stones and ore blobs stay, and there's no pickaxe. */
  const ART = { bg: "mg-mining-bg", pick: "tool-pickaxe", iron: "ore-iron", silver: "ore-silver", gold: "ore-gold", ebony: "ore-ebony" };
  const BG = { w: 2048, h: 1152, x: 550, y: 110, s: 900 };   // the painting, and the square of it the wall is cut from (the vein)
  const PICK = { w: 768, h: 356, gx: 0.22, gy: 0.43, ang: 160.0, len: 0.7524 };   // grip point; grip→tip angle and length (per width), mirrored
  /* ores without their own chunk borrow one, tinted */
  const ORE_ART = { iron: ["iron", ""], silver: ["silver", ""], gold: ["gold", ""], ebony: ["ebony", ""],
    corundum: ["iron", "saturate(1.3) hue-rotate(12deg) brightness(1.22)"], moonstone: ["silver", "sepia(.3) hue-rotate(170deg) saturate(1.5) brightness(1.12)"],
    malachite: ["silver", "sepia(1) hue-rotate(95deg) saturate(2.2)"], orichalcum: ["gold", "hue-rotate(50deg) saturate(.85)"],
    quicksilver: ["silver", "brightness(1.18) contrast(1.1)"], stalhrim: ["silver", "sepia(.6) hue-rotate(160deg) saturate(2.4) brightness(1.15)"] };
  const artUrl = (k) => { try { return typeof ASSETS !== "undefined" ? ASSETS.url(k) : ""; } catch { return ""; } };
  function oreArt(id) {
    const k = Object.keys(ORE_ART).find((x) => id.includes(x)); if (!k) return null;
    const u = artUrl(ART[ORE_ART[k][0]]); return u ? { u, f: ORE_ART[k][1] } : null;
  }
  /* a chunk of this item: the painted ore, or the old drawn blob (gems are always drawn) */
  const chunk = (id, cls = "") => { const a = oreArt(id); return a ? `<img class="mgimg ${cls}" src="${a.u}" alt="" style="filter:${a.f || "none"}" draggable="false">` : `<i class="mgo ${cls}${id.startsWith("gem_") ? " gem" : ""}" style="--oc:${oreColour(id)}"></i>`; };
  const calm = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const rr = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };   // steady per-stone noise
  /* an uneven stone outline */
  function shape(i) {
    const j = (k, m = 7) => (rr(i, k) * m).toFixed(1);
    return `polygon(${j(1)}% ${j(2)}%,${(40 + rr(i, 3) * 20).toFixed(1)}% ${j(4, 4)}%,${100 - j(5)}% ${j(6)}%,${100 - j(7, 4)}% ${(40 + rr(i, 8) * 20).toFixed(1)}%,`
      + `${100 - j(9)}% ${100 - j(10)}%,${(40 + rr(i, 11) * 20).toFixed(1)}% ${100 - j(12, 4)}%,${j(13)}% ${100 - j(14)}%,${j(15, 4)}% ${(40 + rr(i, 16) * 20).toFixed(1)}%)`;
  }
  /* three jagged cracks per stone, shown one per blow taken */
  function cracks(i) {
    let out = "";
    for (let k = 0; k < 3; k++) {
      let x = 38 + rr(i, 20 + k) * 24, y = 38 + rr(i, 30 + k) * 24, a = rr(i, 40 + k) * Math.PI * 2;
      const pts = [[x, y]];
      for (let s = 0; s < 5; s++) { a += (rr(i, 50 + k * 7 + s) - 0.5) * 1.3; const d = 7 + rr(i, 60 + k * 7 + s) * 8; x += Math.cos(a) * d; y += Math.sin(a) * d; pts.push([x, y]); }
      const p = pts.map(([u, v]) => `${u.toFixed(1)},${v.toFixed(1)}`).join(" ");
      out += `<g class="k${k + 1}"><polyline points="${p}" pathLength="1"/><polyline class="hl" points="${p}" pathLength="1"/></g>`;
    }
    return `<svg class="mgcr" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${out}</svg>`;
  }
  let st = null, hooked = false;
  const $ = (q) => st?.el.querySelector(q);
  /* play(s, place, done(got|null)): done gets the dug-out items, or null for a quick dig */
  function play(s, place, done) {
    if (!wants()) return done(null);
    close();
    const g = plan(s, place), skill = G.skill(s, "Smithing");
    for (const k of Object.values(ART)) artUrl(k);   // ask for the pictures (they arrive through ASSETS.on)
    if (!hooked && typeof ASSETS !== "undefined" && ASSETS.on) { hooked = true; ASSETS.on(() => { if (st) dress(); }); }
    const mine = SMITH.MINES[place];
    const el = document.createElement("div");
    el.id = "minegame"; el.className = "craftgame minegame";
    el.innerHTML = `<div class="mgbg" aria-hidden="true"></div>
      <div class="mgstage" role="dialog" aria-label="Mining">
      <div class="mghead"><h3> ${esc(mine ? mine[0] : place)}</h3><p class="cgsub">Smithing ${skill} · <span id="mgsw"></span></p></div>
      <div class="mgwall">${g.cells.map((c, i) => `<button class="mgc" data-i="${i}" aria-label="Rock ${i + 1}"><span class="mgs" style="clip-path:${shape(i)};--lit:${(0.85 + rr(i, 70) * 0.3).toFixed(2)}"><span class="mgv"></span>${cracks(i)}</span><span class="mgh" style="clip-path:${shape(i)}"></span></button>`).join("")}</div>
      <div class="mgmeter" aria-hidden="true"><i class="mgz"></i><i class="mgp"></i><b class="mgn"></b></div>
      <p class="cghint">Tap a stone when the needle is in the bright band. Glinting stones hold ore.</p>
      <div class="mggot" id="mggot"></div>
      <div class="cgrow"><button class="btn" id="mgquick">Quick dig</button><button class="btn pri" id="mgdone">Done</button></div>
      <label class="lppref cgpref"><input type="checkbox" id="mgpref" ${pref("mineGame", true) ? "checked" : ""}> Always play the mining game</label></div>
      <canvas class="mgfx" aria-hidden="true"></canvas><div class="mgpick" aria-hidden="true"><img alt="" draggable="false"></div>`;
    document.body.appendChild(el);
    st = { g, done, el, z: zone(skill), t0: performance.now(), raf: 0, struck: false, skill, parts: [], last: -1, hover: -1, perf: 0, shown: {}, tl: performance.now(), timers: [], ending: false, swingNo: 0 };
    el.querySelectorAll(".mgc").forEach((b) => {
      const i = +b.dataset.i;
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(i); });
      b.addEventListener("click", (e) => { if (e.detail === 0) hit(i); });   // keyboard: Space / Enter on a focused stone
      b.addEventListener("pointerenter", () => { if (st) st.hover = i; });
    });
    $("#mgquick").onclick = () => finish(!st.struck);
    $("#mgdone").onclick = () => { if (st.struck) return finish(false); const d = st.done; close(); d("cancel"); };   // left before a swing: nothing happens
    $("#mgpref").onchange = (e) => setPref("mineGame", e.target.checked);
    st.onkey = (e) => {   // PC: Space strikes the stone under the mouse (or the last one)
      if (!st || st.ending || e.key !== " " || /^(BUTTON|INPUT)$/.test(e.target?.tagName)) return;
      e.preventDefault(); const i = st.hover >= 0 ? st.hover : st.last; if (i >= 0) hit(i);
    };
    st.onsize = () => layout();
    addEventListener("keydown", st.onkey); addEventListener("resize", st.onsize);
    dress(); paint(); placeZone(); layout();
    const loop = (now) => {
      if (!st) return;
      const n = st.el.querySelector(".mgn"); if (n) n.style.left = (pos() * 100).toFixed(2) + "%";
      const dt = Math.min(0.05, (now - st.tl) / 1000); st.tl = now; tick(dt);
      st.raf = requestAnimationFrame(loop);
    };
    st.raf = requestAnimationFrame(loop);
  }
  /* put the painted pictures on (now, or when they arrive) */
  function dress() {
    if (!st) return;
    const bg = artUrl(ART.bg), pk = artUrl(ART.pick);
    st.el.classList.toggle("mgart", !!bg);
    if (bg) st.el.style.setProperty("--mgbgi", `url("${bg}")`);
    const im = $(".mgpick img");
    if (pk && im && !im.getAttribute("src")) im.src = pk;
    st.el.classList.toggle("mghaspick", !!pk);
    st.dressed = { bg: !!bg, pick: !!pk };
    paint(); layout();
  }
  /* sizes that follow the screen: the stones' share of the painting, the pickaxe, the effects canvas */
  function layout() {
    if (!st) return;
    const el = st.el, wall = $(".mgwall"); if (!wall) return;
    const wr = wall.getBoundingClientRect(), cs = getComputedStyle(wall);
    const ix = wr.left + parseFloat(cs.paddingLeft), iy = wr.top + parseFloat(cs.paddingTop), iw = wr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const zz = st.zz = (el.getBoundingClientRect().width / el.offsetWidth) || 1;   // page zoom (big PC screens, text size): screen px per CSS px
    const k = iw / BG.s / zz;
    el.querySelectorAll(".mgc").forEach((b) => {   // each stone (and the hole it leaves) shows its own piece of the painting
      const r = b.getBoundingClientRect(), sz = `${(BG.w * k).toFixed(1)}px ${(BG.h * k).toFixed(1)}px`, at = `${(-(BG.x * k) - (r.left - ix) / zz).toFixed(1)}px ${(-(BG.y * k) - (r.top - iy) / zz).toFixed(1)}px`;
      Object.assign(b.querySelector(".mgs").style, { backgroundSize: sz, backgroundPosition: at });
      Object.assign(b.querySelector(".mgh").style, { backgroundSize: `100% 100%,100% 100%,${sz}`, backgroundPosition: `0 0,0 0,${at}` });
    });
    const pw = Math.round(Math.max(150 * zz, wr.width * 0.62)), lw = pw / zz, lh = lw * PICK.h / PICK.w;
    const im = $(".mgpick img");
    if (im) Object.assign(im.style, { width: lw.toFixed(1) + "px", height: lh.toFixed(1) + "px", left: (-(1 - PICK.gx) * lw).toFixed(1) + "px", top: (-PICK.gy * lh).toFixed(1) + "px" });
    st.pw = pw; st.wr = wr;
    const cv = $(".mgfx"), dpr = Math.min(2, devicePixelRatio || 1);
    if (cv) { cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); st.dpr = dpr; }
    st.sc = Math.max(0.7, Math.min(1.8, wr.width / 400));
    if (!st.swinging) rest();
  }
  /* the pickaxe pose: grip at G, rotated a degrees */
  const tf = (G, a, s = 1) => `translate(${(G[0] / (st.zz || 1)).toFixed(1)}px,${(G[1] / (st.zz || 1)).toFixed(1)}px) rotate(${a.toFixed(1)}deg) scale(${s})`;
  function aim(T, phi = 205) {   // grip position and angles for a blow that lands on T
    const L = PICK.len * st.pw, r = phi * Math.PI / 180;
    const G = [T[0] - Math.cos(r) * L, T[1] - Math.sin(r) * L];
    return { G, hit: phi - PICK.ang, up: phi - PICK.ang + 58 };
  }
  /* the angle the pick comes in at: from the lower right, steeper where there's no room to the right (phones), so the
     grip stays on screen */
  const slope = (T) => { const room = (innerWidth - 8 - T[0]) / (PICK.len * st.pw); return Math.min(258, Math.max(204, 180 + Math.acos(Math.max(0, Math.min(1, room))) * 180 / Math.PI)); };
  function rest() {   // resting just below the wall's lower right, head up
    const pk = $(".mgpick"); if (!pk || !st.wr) return;
    const w = st.wr, T = [w.right - w.width * 0.24, w.bottom - w.width * 0.06], a = aim(T, slope(T) + 22);
    st.rest = tf(a.G, a.hit, 1.02);
    pk.style.transform = st.rest;
  }
  /* swing at the stone; then() runs on impact */
  function swing(b, then) {
    const pk = $(".mgpick"), rc = b.getBoundingClientRect();
    if (!st.dressed?.pick || !pk || !pk.animate || calm()) { then(); return; }
    const T = [rc.left + rc.width * (0.42 + Math.random() * 0.16), rc.top + rc.height * (0.4 + Math.random() * 0.16)];
    const a = aim(T, slope(T) - 4 + Math.random() * 8);
    st.lastT = T; st.swinging = (st.swinging || 0) + 1;
    pk.getAnimations().forEach((x) => x.cancel());
    const from = pk.style.transform || st.rest, hitTf = tf(a.G, a.hit), back = tf([a.G[0] + 10, a.G[1] + 14], a.hit + 34, 1.02);
    pk.style.transform = hitTf;
    pk.animate([{ transform: from, easing: "cubic-bezier(.2,.7,.35,1)" }, { transform: tf(a.G, a.up, 1.07), offset: 0.55, easing: "cubic-bezier(.6,0,.9,.6)" }, { transform: hitTf }], { duration: 190 });
    const t1 = setTimeout(() => {
      if (!st) return;
      then();
      const t2 = setTimeout(() => {   // the hit freeze, then the rebound
        if (!st) return;
        st.swinging--; st.rest = back; pk.style.transform = back;
        pk.animate([{ transform: hitTf, easing: "cubic-bezier(.15,.8,.3,1)" }, { transform: tf([a.G[0] + 18, a.G[1] + 8], a.hit + 26, 1.03), offset: 0.45 }, { transform: back }], { duration: 220 });
        const n = ++st.swingNo;
        st.timers.push(setTimeout(() => {   // nothing more for a while: the pick drifts back to its rest by the wall
          if (!st || st.swinging || st.swingNo !== n) return;
          const from = pk.style.transform; rest();
          pk.animate([{ transform: from }, { transform: st.rest }], { duration: 450, easing: "cubic-bezier(.4,0,.2,1)" });
        }, 900));
      }, 40);
      st.timers.push(t2);
    }, 190);
    st.timers.push(t1);
  }
  /* needle: there and back */
  const pos = () => { const p = ((performance.now() - st.t0) / 1000 * SPEED / ez("timingEase")) % 2; return p < 1 ? p : 2 - p; };
  function placeZone() {
    if (!st) return;
    const z = st.z;
    Object.assign($(".mgz").style, { left: ((z.mid - z.good / 2) * 100).toFixed(2) + "%", width: (z.good * 100).toFixed(2) + "%" });
    Object.assign($(".mgp").style, { left: ((z.mid - z.perfect / 2) * 100).toFixed(2) + "%", width: (z.perfect * 100).toFixed(2) + "%" });
  }
  /* the stones as the rules see them (seen = what has reached the screen: a blow shows on impact) */
  function paint() {
    if (!st) return;
    const g = st.g;
    st.el.querySelectorAll(".mgc").forEach((b) => {
      const i = +b.dataset.i, c = g.cells[i], v = st.shown[i] || { hp: c.max, broken: false };
      const dmg = Math.min(3, c.max - v.hp), ore = c.kind !== "stone";
      b.className = "mgc" + (v.broken ? ` broken ${c.kind}` : "") + (!v.broken && c.glint ? ` glint ${c.kind}` : "") + (!v.broken && dmg > 0 ? ` cr${dmg} ${c.kind}` : "") + (b.classList.contains("breaking") ? " breaking" : "");
      b.disabled = c.broken || g.over;
      const vein = b.querySelector(".mgv"), seen = ore && !v.broken && (c.glint || dmg > 0), key = seen ? (oreArt(c.item) ? "a" : "d") + c.item : "";
      if (vein.dataset.k !== key) {   // the ore showing in the vein: spotted, or a blow cracked it open
        vein.dataset.k = key;
        vein.innerHTML = seen ? (c.kind === "gem" || !oreArt(c.item) ? `<i class="mgo${c.kind === "gem" ? " gem" : ""}" style="--oc:${oreColour(c.item)}"></i>` : chunk(c.item)) : "";
        vein.style.setProperty("--rot", (rr(i, 80) * 70 - 35).toFixed(0) + "deg");
      }
      const h = b.querySelector(".mgh");
      if (v.broken && !h.dataset.done) { h.dataset.done = 1; h.innerHTML = c.item ? `<small>${esc(short(c.item))}</small>` : ""; }
    });
    $("#mgsw").textContent = `${g.swings} swing${g.swings === 1 ? "" : "s"} left`;
    paintGot();
    $("#mgquick").disabled = st.struck;
  }
  /* the haul row (counts move up when a chunk lands in it) */
  function paintGot() {
    const row = $("#mggot"); if (!row) return;
    const got = st.bag || {};
    row.innerHTML = Object.entries(got).map(([id, n]) => `<span data-id="${esc(id)}"><b class="mgico">${chunk(id)}</b>${n} ${esc(D.ITEMS[id]?.name || id)}</span>`).join("") || `<span class="mute">Nothing yet</span>`;
  }
  const short = (id) => (D.ITEMS[id]?.name || id).replace(/ Ore$/, "").replace(/^Flawless /, "");
  function oreColour(id) {
    const m = { iron: "#8d7b6e", silver: "#d9dde2", gold: "#e8c25a", corundum: "#c07a4c", moonstone: "#c9d8ee", malachite: "#4fae7a", ebony: "#3a3440", orichalcum: "#7a9a5a", quicksilver: "#b8c4cc", stalhrim: "#9fd6ee", garnet: "#b3364a", amethyst: "#9a5ad1", ruby: "#e0384a", sapphire: "#3a6ee0", emerald: "#2fbf6a", diamond: "#f2f6ff" };
    const k = Object.keys(m).find((x) => id.includes(x)); return k ? m[k] : "#a89a88";
  }
  function hit(i) {
    if (!st || st.g.over || st.ending) return;
    const p = pos(), dmg = power(st.z, p), r = strike(st.g, i, dmg);
    if (!r) return;
    st.struck = true; st.last = i;
    if (dmg === PERFECT) st.perf++;
    const c = st.g.cells[i], after = { hp: c.hp, broken: c.broken };
    st.z = zone(st.skill);   // the band moves after every swing
    placeZone();
    $("#mgsw").textContent = `${st.g.swings} swing${st.g.swings === 1 ? "" : "s"} left`;
    $("#mgquick").disabled = true;
    const b = st.el.querySelector(`.mgc[data-i="${i}"]`);
    if (st.g.over) st.ending = true;
    swing(b, () => impact(i, r, dmg, after, b));
  }
  /* the blow lands */
  function impact(i, r, dmg, after, b) {
    if (!st) return;
    st.shown[i] = after;
    sfx(r.broke && r.item ? (r.kind === "gem" ? "coin" : "clang") : "hit");
    if (navigator.vibrate) try { navigator.vibrate(dmg === PERFECT ? [14, 30, 14] : 10); } catch { /* ignore */ }
    const rc = b.getBoundingClientRect(), x = rc.left + rc.width / 2, y = rc.top + rc.height / 2, ore = r.kind !== "stone";
    const T = st.lastT && st.dressed?.pick && !calm() ? st.lastT : [x, y];
    paint();
    if (r.broke) { b.classList.add("breaking"); setTimeout(() => b.classList.remove("breaking"), 420); }
    b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake");
    // effects
    const sc = st.sc || 1, col = ore ? oreColour(r.item || st.g.cells[i].item) : null;
    burst(T[0], T[1], dmg, r.broke, col, rc.width);
    if (ore) flare(T[0], T[1], col, (r.broke ? 1.4 : 1) * sc);
    if (dmg === PERFECT || (r.broke && ore)) shake(dmg === PERFECT ? 5 : 2);
    if (dmg === PERFECT) { const m = $(".mgmeter"); if (m) { m.classList.remove("flash"); void m.offsetWidth; m.classList.add("flash"); } }
    const tag = document.createElement("span"); tag.className = "mgtag p" + dmg;
    tag.textContent = r.broke && r.item ? `+${r.n} ${short(r.item)}` : dmg === PERFECT ? "Perfect!" : dmg === GOOD ? "Good" : "Glancing";
    const zz = st.zz || 1; tag.style.left = x / zz + "px"; tag.style.top = rc.top / zz + "px";
    st.el.appendChild(tag); setTimeout(() => tag.remove(), 900);
    if (r.broke && r.item) for (let k = 0; k < r.n; k++) setTimeout(() => fly(r.item, x, y, k), 60 + k * 110);
    if (st.g.over) st.timers.push(setTimeout(() => finish(false), 650 + (r.broke && r.item ? 700 : 0)));
  }
  /* broken-out ore pops up and flies into the haul row */
  function fly(id, x, y, k) {
    if (!st) return;
    const land = () => { if (!st) return; st.bag = st.bag || {}; st.bag[id] = (st.bag[id] || 0) + 1; paintGot(); const s = $(`#mggot span[data-id="${id}"]`); if (s) { s.classList.add("pulse"); } };
    const row = $("#mggot"), rr2 = row?.getBoundingClientRect();
    if (!rr2 || calm() || !document.body.animate) return land();
    const f = document.createElement("div"); f.className = "mgfly"; f.innerHTML = chunk(id);
    const zz = st.zz || 1, size = Math.max(34, (st.wr?.width || 360) / 7.5 / zz); f.style.width = f.style.height = size + "px";
    x /= zz; y /= zz;
    st.el.appendChild(f);
    const tgt = $(`#mggot span[data-id="${id}"] .mgico`)?.getBoundingClientRect();
    const bx = (tgt ? tgt.left + tgt.width / 2 : rr2.left + rr2.width / 2) / zz, by = (tgt ? tgt.top + tgt.height / 2 : rr2.top + rr2.height / 2) / zz;
    const px = x + (k ? 22 : -14) * (st.sc || 1), py = y - 56 * (st.sc || 1);   // the top of the pop
    const cx = (px + bx) / 2 + (bx > px ? -40 : 40), cy = Math.min(py, by) - 90 * (st.sc || 1);   // the arc to the bag
    const fr = [{ transform: `translate(${x - size / 2}px,${y - size / 2}px) scale(.35) rotate(0deg)`, opacity: 0.4 },
      { transform: `translate(${px - size / 2}px,${py - size / 2}px) scale(1.25) rotate(-18deg)`, opacity: 1, offset: 0.3 }];
    for (let n = 1; n <= 7; n++) {
      const t = n / 7, u = 1 - t, qx = u * u * px + 2 * u * t * cx + t * t * bx, qy = u * u * py + 2 * u * t * cy + t * t * by;
      fr.push({ transform: `translate(${qx - size / 2}px,${qy - size / 2}px) scale(${(1.25 - t * 0.85).toFixed(2)}) rotate(${(-18 + t * 220).toFixed(0)}deg)`, opacity: 1, offset: 0.3 + t * 0.7 });
    }
    const an = f.animate(fr, { duration: 820, easing: "cubic-bezier(.3,0,.6,1)", fill: "forwards" });
    an.onfinish = () => { f.remove(); land(); };
  }
  /* camera shake (a Perfect blow, ore breaking out) */
  function shake(px) {
    if (calm()) return;
    const s = $(".mgstage"), bg = $(".mgbg"); if (!s?.animate) return;
    const fr = [0, 1, 2, 3, 4, 5].map((k) => { const a = px * (1 - k / 6); return { transform: `translate(${((Math.random() - 0.5) * 2 * a).toFixed(1)}px,${((Math.random() - 0.5) * 2 * a).toFixed(1)}px)` }; });
    fr.push({ transform: "translate(0,0)" });
    s.animate(fr, { duration: 260, easing: "linear" });
    bg?.animate(fr.map((f) => ({ transform: f.transform.replace(/(-?[\d.]+)px/g, (m, v) => (v * 0.4).toFixed(1) + "px") })), { duration: 260 });
  }
  // ---- particles on one canvas: chips, dust, sparks, flares (20-60 at a time)
  const ROCK = ["#6d6258", "#8b7f72", "#4b433c", "#a39584", "#5c524a"];
  function burst(x, y, dmg, broke, col, cw) {
    const sc = st.sc || 1, few = calm() ? 0.4 : 1, P = st.parts;
    const nChip = Math.round((6 + dmg * 4 + (broke ? 10 : 0)) * few), nDust = Math.round((4 + dmg * 2 + (broke ? 6 : 0)) * few);
    for (let k = 0; k < nChip; k++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5, v = (120 + Math.random() * 260 + dmg * 40) * sc;
      P.push({ t: "chip", x, y, vx: Math.cos(a) * v + 40 * sc, vy: Math.sin(a) * v, g: 1300 * sc, life: 0.55 + Math.random() * 0.4, age: 0,
        s: (2 + Math.random() * (broke ? 6 : 4)) * sc, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18, c: col && Math.random() < 0.35 ? col : ROCK[k % ROCK.length], n: 3 + (k % 3) });
    }
    for (let k = 0; k < nDust; k++) {
      const a = Math.random() * Math.PI * 2, v = (20 + Math.random() * 70) * sc;
      P.push({ t: "dust", x: x + Math.cos(a) * 6 * sc, y: y + Math.sin(a) * 6 * sc, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 25 * sc, g: -10 * sc, life: 0.6 + Math.random() * 0.5, age: 0,
        s: (6 + Math.random() * 10) * sc * (broke ? 1.5 : 1), grow: 2.4, c: "190,172,148", a0: 0.28 + Math.random() * 0.12 });
    }
    if (dmg === PERFECT) for (let k = 0; k < Math.round(14 * few); k++) {
      const a = -Math.PI * 0.85 + Math.random() * Math.PI * 0.9, v = (320 + Math.random() * 380) * sc;
      P.push({ t: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900 * sc, life: 0.22 + Math.random() * 0.25, age: 0, s: 1.6 * sc });
    }
    P.push({ t: "ring", x, y, life: 0.16, age: 0, s: cw * 0.35 });
    if (P.length > 140) P.splice(0, P.length - 140);
  }
  function flare(x, y, col, s) { st.parts.push({ t: "flare", x: x + (Math.random() - 0.5) * 18, y: y - 6, life: 0.5, age: 0, s: 34 * s, c: col, rot: Math.random() }); }
  function tick(dt) {
    const cv = $(".mgfx"); if (!cv) return;
    const P = st.parts, ctx = cv.getContext("2d");
    if (!P.length) { if (st.drawn) { ctx.clearRect(0, 0, cv.width, cv.height); st.drawn = false; } return; }
    st.drawn = true;
    const d = st.dpr || 1, px = document.documentElement.classList.contains("art-pixel");
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(d, 0, 0, d, 0, 0);
    for (let k = P.length - 1; k >= 0; k--) {
      const p = P[k]; p.age += dt;
      if (p.age >= p.life) { P.splice(k, 1); continue; }
      const f = p.age / p.life;
      if (p.vx !== undefined) { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      if (p.t === "chip") {
        p.rot += p.vr * dt; ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = f > 0.7 ? (1 - f) / 0.3 : 1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(px ? 0 : p.rot); ctx.fillStyle = p.c;
        if (px) ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        else { ctx.beginPath(); for (let v = 0; v < p.n; v++) { const a = (v / p.n) * Math.PI * 2, r = p.s * (0.6 + ((v * 37 + p.n) % 5) / 10); ctx[v ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
          ctx.fillStyle = "rgba(255,240,220,.25)"; ctx.fillRect(-p.s * 0.4, -p.s * 0.4, p.s * 0.4, p.s * 0.3); }
        ctx.restore();
      } else if (p.t === "dust") {
        p.vx *= 1 - 2.5 * dt; p.vy *= 1 - 2.5 * dt;
        const r = p.s * (1 + (p.grow - 1) * Math.sqrt(f)), a = p.a0 * (1 - f);
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
        if (px) { ctx.fillStyle = `rgba(${p.c},${a})`; ctx.fillRect(Math.round(p.x - r / 2), Math.round(p.y - r / 2), Math.round(r), Math.round(r)); }
        else { const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, `rgba(${p.c},${a})`); gr.addColorStop(1, `rgba(${p.c},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); }
      } else if (p.t === "spark") {
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 1 - f; ctx.strokeStyle = f < 0.4 ? "#fff2c0" : "#ffb347"; ctx.lineWidth = p.s; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); ctx.stroke();
      } else if (p.t === "ring") {
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - f) * 0.55;
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * (0.6 + f)); gr.addColorStop(0, "rgba(255,236,200,.9)"); gr.addColorStop(1, "rgba(255,236,200,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (0.6 + f), 0, 7); ctx.fill();
      } else if (p.t === "flare") {   // a four-point glint on ore
        const k2 = Math.sin(f * Math.PI), r = p.s * k2;
        ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = k2;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + f * 0.8);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5); gr.addColorStop(0, "rgba(255,255,240,1)"); gr.addColorStop(0.4, p.c + "aa"); gr.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,250,230,.95)";
        for (let q = 0; q < 4; q++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -r * 0.07); ctx.lineTo(r, 0); ctx.lineTo(0, r * 0.07); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  /* the end: quick dig gives the plain result straight away, otherwise the haul card */
  function finish(quick) {
    if (!st) return;
    if (quick) { const S = st; close(); return S.done(null); }
    if (st.res) return;
    st.ending = true; st.res = true;
    const got = st.g.got, items = Object.entries(got), tot = total(got), used = st.g.swings0 - st.g.swings;
    const title = !tot ? "Nothing but rubble" : tot >= 6 ? "A rich haul" : "A good haul";
    const res = document.createElement("div"); res.className = "mgres"; res.setAttribute("role", "dialog"); res.setAttribute("aria-label", title);
    res.innerHTML = `<div class="mgrescard"><h3>${title}</h3>
      <div class="mgresitems">${items.map(([id, n], k) => `<div class="mgri" style="--d:${(k * 0.12 + 0.15).toFixed(2)}s"><span class="mgrart">${chunk(id)}</span><b>×${n}</b><small>${esc(D.ITEMS[id]?.name || id)}</small></div>`).join("") || `<p class="mute">The rock gave up nothing this time.</p>`}</div>
      <p class="mgresst">${tot} piece${tot === 1 ? "" : "s"} · ${st.perf} Perfect blow${st.perf === 1 ? "" : "s"} · ${used} swing${used === 1 ? "" : "s"}</p>
      <button class="btn pri" id="mgok">${tot ? "Take it" : "Leave"}</button></div>`;
    st.el.appendChild(res); st.el.classList.add("mgend");
    res.querySelector("#mgok").onclick = () => { const S = st; close(); S.done(S.g.got); };
    setTimeout(() => { try { res.querySelector("#mgok").focus({ preventScroll: true }); } catch { /* ignore */ } }, 50);
  }
  function close() {
    if (st) {
      if (st.raf) cancelAnimationFrame(st.raf);
      st.timers.forEach(clearTimeout);
      removeEventListener("keydown", st.onkey); removeEventListener("resize", st.onsize);
    }
    if (DOM) document.querySelector("#minegame")?.remove();
    st = null;
  }
  return { COLS, ROWS, HP, PERFECT, GOOD, POOR, plan, zone, power, strike, total, play, close, wants, state: () => st, _hit: hit, _finish: finish };
})();
if (typeof module !== "undefined") module.exports = MINEGAME;
