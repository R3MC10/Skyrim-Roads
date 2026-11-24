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
  let st = null;
  /* play(s, place, done(got|null)): done gets the dug-out items, or null for a quick dig */
  function play(s, place, done) {
    if (!wants()) return done(null);
    close();
    const g = plan(s, place), skill = G.skill(s, "Smithing");
    st = { g, done, z: zone(skill), t0: performance.now(), raf: 0, struck: false, skill };
    const mine = SMITH.MINES[place];
    const el = document.createElement("div");
    el.id = "minegame"; el.className = "craftgame minegame";
    el.innerHTML = `<div class="cgcard" role="dialog" aria-label="Mining">
      <h3> ${esc(mine ? mine[0] : place)}</h3><p class="cgsub">Smithing ${skill} · <span id="mgsw"></span></p>
      <div class="mgmeter" aria-hidden="true"><i class="mgz"></i><i class="mgp"></i><b class="mgn"></b></div>
      <div class="mgwall">${g.cells.map((c, i) => `<button class="mgc" data-i="${i}" aria-label="Rock ${i + 1}"><span class="mgcr"></span></button>`).join("")}</div>
      <p class="cghint">Tap a stone when the needle is in the bright band. Glinting stones hold ore.</p>
      <div class="mggot" id="mggot"></div>
      <div class="cgrow"><button class="btn" id="mgquick">Quick dig</button><button class="btn pri" id="mgdone">Done</button></div>
      <label class="lppref cgpref"><input type="checkbox" id="mgpref" ${pref("mineGame", true) ? "checked" : ""}> Always play the mining game</label></div>`;
    document.body.appendChild(el);
    el.querySelectorAll(".mgc").forEach((b) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(+b.dataset.i); }));
    el.querySelector("#mgquick").onclick = () => finish(!st.struck);
    el.querySelector("#mgdone").onclick = () => { if (st.struck) return finish(false); const d = st.done; close(); d("cancel"); };   // left before a swing: nothing happens
    el.querySelector("#mgpref").onchange = (e) => setPref("mineGame", e.target.checked);
    paint(); placeZone();
    const loop = () => { if (!st) return; const n = el.querySelector(".mgn"); if (n) n.style.left = (pos() * 100).toFixed(2) + "%"; st.raf = requestAnimationFrame(loop); };
    st.raf = requestAnimationFrame(loop);
  }
  /* needle: there and back */
  const pos = () => { const p = ((performance.now() - st.t0) / 1000 * SPEED / ez("timingEase")) % 2; return p < 1 ? p : 2 - p; };
  function placeZone() {
    const el = document.querySelector("#minegame"); if (!el) return;
    const z = st.z;
    Object.assign(el.querySelector(".mgz").style, { left: ((z.mid - z.good / 2) * 100).toFixed(2) + "%", width: (z.good * 100).toFixed(2) + "%" });
    Object.assign(el.querySelector(".mgp").style, { left: ((z.mid - z.perfect / 2) * 100).toFixed(2) + "%", width: (z.perfect * 100).toFixed(2) + "%" });
  }
  function paint() {
    const el = document.querySelector("#minegame"); if (!el || !st) return;
    const g = st.g;
    el.querySelectorAll(".mgc").forEach((b) => {
      const c = g.cells[+b.dataset.i];
      b.className = "mgc" + (c.broken ? ` broken ${c.kind}` : "") + (!c.broken && c.glint ? ` glint ${c.kind}` : "") + (!c.broken && c.hp < c.max ? ` cr${c.max - c.hp}` : "");
      b.disabled = c.broken || g.over;
      if (c.broken && c.item && !b.dataset.shown) { b.dataset.shown = 1; b.innerHTML = `<span class="mgo" style="--oc:${oreColour(c.item)}"></span><small>${esc(short(c.item))}</small>`; }
    });
    el.querySelector("#mgsw").textContent = `${g.swings} swing${g.swings === 1 ? "" : "s"} left`;
    el.querySelector("#mggot").innerHTML = Object.entries(g.got).map(([id, n]) => `<span><i style="--oc:${oreColour(id)}"></i>${n} ${esc(D.ITEMS[id]?.name || id)}</span>`).join("") || `<span class="mute">Nothing yet</span>`;
    el.querySelector("#mgquick").disabled = st.struck;
  }
  const short = (id) => (D.ITEMS[id]?.name || id).replace(/ Ore$/, "").replace(/^Flawless /, "");
  function oreColour(id) {
    const m = { iron: "#8d7b6e", silver: "#d9dde2", gold: "#e8c25a", corundum: "#c07a4c", moonstone: "#c9d8ee", malachite: "#4fae7a", ebony: "#3a3440", orichalcum: "#7a9a5a", quicksilver: "#b8c4cc", stalhrim: "#9fd6ee", garnet: "#b3364a", amethyst: "#9a5ad1", ruby: "#e0384a", sapphire: "#3a6ee0", emerald: "#2fbf6a", diamond: "#f2f6ff" };
    const k = Object.keys(m).find((x) => id.includes(x)); return k ? m[k] : "#a89a88";
  }
  function hit(i) {
    if (!st || st.g.over) return;
    const p = pos(), dmg = power(st.z, p), r = strike(st.g, i, dmg);
    if (!r) return;
    st.struck = true;
    const el = document.querySelector("#minegame"), b = el?.querySelector(`.mgc[data-i="${i}"]`);
    sfx(r.broke && r.item ? (r.kind === "gem" ? "coin" : "clang") : "hit");
    if (navigator.vibrate) try { navigator.vibrate(dmg === PERFECT ? [14, 30, 14] : 10); } catch { /* ignore */ }
    if (b) {
      b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake");
      const rc = b.getBoundingClientRect(), card = el.querySelector(".cgcard").getBoundingClientRect();
      const tag = document.createElement("span"); tag.className = "mgtag p" + dmg;
      tag.textContent = r.broke && r.item ? `+${r.n} ${short(r.item)}` : dmg === PERFECT ? "Perfect!" : dmg === GOOD ? "Good" : "Glancing";
      tag.style.left = (rc.left - card.left + rc.width / 2) + "px"; tag.style.top = (rc.top - card.top) + "px";
      el.querySelector(".cgcard").appendChild(tag); setTimeout(() => tag.remove(), 900);
      for (let k = 0; k < 5 + dmg * 2; k++) {
        const ch = document.createElement("i"); ch.className = "mgchip";
        const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 26;
        ch.style.cssText = `left:${rc.left - card.left + rc.width / 2}px;top:${rc.top - card.top + rc.height / 2}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 10}px;background:${r.item && r.broke ? oreColour(r.item) : "#8a8178"}`;
        el.querySelector(".cgcard").appendChild(ch); setTimeout(() => ch.remove(), 600);
      }
    }
    st.z = zone(st.skill);   // the band moves after every swing
    placeZone(); paint();
    if (st.g.over) setTimeout(() => finish(false), 650);
  }
  function finish(quick) {
    if (!st) return;
    const S = st; close();
    S.done(quick ? null : S.g.got);
  }
  function close() { if (st?.raf) cancelAnimationFrame(st.raf); if (DOM) document.querySelector("#minegame")?.remove(); st = null; }
  return { COLS, ROWS, HP, PERFECT, GOOD, POOR, plan, zone, power, strike, total, play, close, wants, state: () => st, _hit: hit };
})();
if (typeof module !== "undefined") module.exports = MINEGAME;
