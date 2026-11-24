/* Favourites wheel: Skyrim's Q menu as a touch wheel.
   Mark weapons, armour, potions, spells, shouts and powers as favourites (★ in the Items and Magic menus),
   then long-press the compass (or tap the ★ button) and pick one:
   - weapons and armour are equipped at once (in your current loadout)
   - a spell, shout or power becomes your "readied" move: Smart AI opens the next fights with it
   - a potion is "queued": Smart AI drinks that kind without saving it for later in the next fight */
const FAVWHEEL = (() => {
  const MAX = 8;
  const live = typeof document !== "undefined";
  let ctx = null, open = false, press = null, swallowClick = false;

  // ---- data: s.favs = [{ k: "item", id: "steel_sword" } | { k: "spell"|"shout"|"power", id }]
  const keyOf = (f) => `${f.k}:${f.id}`;
  function list(s) { if (!Array.isArray(s.favs)) s.favs = []; return s.favs; }
  /* a magic-menu id ("spell:firebolt", "shout:unrelenting_force", "power:race") or an inventory row id */
  function entryFor(s, ref) {
    if (typeof ref === "string" && /^(spell|shout|power):/.test(ref)) { const [k, id] = ref.split(":"); return { k, id }; }
    const r = typeof G !== "undefined" ? G.invRow(s, ref) : null; if (!r) return null;
    const it = D.ITEMS[r.item]; if (!it) return null;
    if (!(G.SLOTS || []).includes(it.slot) && it.slot !== "potion") return null;   // only gear and potions go on the wheel
    return { k: "item", id: r.item };
  }
  const has = (s, e) => !!e && list(s).some((f) => keyOf(f) === keyOf(e));
  function toggle(s, ref) {
    const e = entryFor(s, ref); if (!e) return { ok: false, text: "That can't go on the favourites wheel." };
    const L = list(s), i = L.findIndex((f) => keyOf(f) === keyOf(e));
    if (i >= 0) { L.splice(i, 1); if (s.favReady === actionOf(e)) delete s.favReady; return { ok: true, on: false, text: `Removed from favourites.` }; }
    if (L.length >= MAX) return { ok: false, text: `The wheel holds ${MAX}. Take something off first.` };
    L.push(e); return { ok: true, on: true, text: "★ Added to favourites. Long-press the map or the compass to open the wheel." };
  }
  /* the fight action a favourite stands for */
  function actionOf(e) {
    if (e.k === "spell") return `spell:${e.id}`;
    if (e.k === "shout") return `shout:${e.id}`;
    if (e.k === "power") return `power:${e.id}`;
    return null;
  }
  function rowFor(s, item) {
    let best = null;
    for (const r of s.inv) if (r.item === item && (!best || (r.temper || 0) > (best.temper || 0))) best = r;
    return best;
  }
  function info(s, e) {
    if (e.k === "item") {
      const it = D.ITEMS[e.id], r = rowFor(s, e.id), eq = r && Object.values(G.equipment(s)).some((x) => x && x.id === r.id);
      const sub = !it ? "" : it.slot === "potion" ? (s.favPot && it.restore?.[0] === s.favPot ? "queued" : `${r ? r.qty : 0} left`) : eq ? "worn" : r ? "" : "not in pack";
      return { name: it ? it.name : e.id, sub, have: !!r, on: eq || (it?.slot === "potion" && it.restore?.[0] === s.favPot), kind: it?.slot || "item" };
    }
    if (e.k === "spell") { const sp = D.SPELLS[e.id]; return { name: sp ? sp.name : e.id, sub: s.favReady === actionOf(e) ? "readied" : sp ? `${G.spellCost(s, sp)} mp` : "", have: (s.spells || []).includes(e.id), on: s.favReady === actionOf(e), kind: "spell" }; }
    if (e.k === "shout") { const sh = POWERS.SHOUTS[e.id]; return { name: sh ? sh[0] : e.id, sub: s.favReady === actionOf(e) ? "readied" : "shout", have: !!sh && POWERS.level(s, e.id) > 0, on: s.favReady === actionOf(e), kind: "shout" }; }
    const name = e.id === "race" ? POWERS.RACE[s.race]?.[0] : e.id === "stone" ? POWERS.STONES[s.stone]?.[0] : "Beast Form";
    return { name: name || "Power", sub: s.favReady === actionOf(e) ? "readied" : "power", have: e.id === "race" || (e.id === "stone" ? POWERS.stoneHasPower(s) : !!s.werewolf), on: s.favReady === actionOf(e), kind: "power" };
  }
  /* pick a favourite: equip / ready / queue. Returns a message */
  function use(s, i) {
    const e = list(s)[i]; if (!e) return { ok: false, text: "Empty slot." };
    const nfo = info(s, e);
    if (!nfo.have) return { ok: false, text: `You don't have ${nfo.name} right now.` };
    if (e.k === "item") {
      const it = D.ITEMS[e.id];
      if (it.slot === "potion") {
        const res = it.restore?.[0];
        if (!res) return { ok: false, text: `${it.name} can't be queued for a fight.` };
        if (s.favPot === res) { delete s.favPot; return { ok: true, text: `${it.name} unqueued.` }; }
        s.favPot = res; return { ok: true, text: ` ${it.name} queued: in your next fights you'll drink ${res} potions without saving them.` };
      }
      const r = rowFor(s, e.id);
      if (Object.values(G.equipment(s)).some((x) => x && x.id === r.id)) return { ok: true, text: `${it.name} is already worn.` };
      const msg = G.equip(s, r.id);
      return { ok: !/can't|don't/.test(msg), text: msg };
    }
    const a = actionOf(e);
    if (s.favReady === a) { delete s.favReady; return { ok: true, text: `${nfo.name} no longer readied.` }; }
    s.favReady = a;
    return { ok: true, text: ` ${nfo.name} readied: Smart AI opens your fights with it when it can.` };
  }

  // ---- fight hooks (Smart AI): the readied opener on the first turn, the queued potion kind not saved
  function opener(f) {
    const a = f?.s?.favReady; if (!a || f.turn !== 1) return null;
    try { return f.affordable(a) ? a : null; } catch { return null; }
  }
  const potFree = (f, a) => !!f?.s?.favPot && a === `potion:${f.s.favPot}`;

  // ---- the wheel
  const $ = (q) => live ? document.querySelector(q) : null;
  function slotIcon(s, e, size) {
    if (e.k === "item") return typeof ICONART !== "undefined" ? ICONART.item(e.id, size) : "";
    if (typeof UIART === "undefined") return "";
    if (e.k === "spell") return UIART.spell(e.id, size);
    if (e.k === "shout") return UIART.shout(e.id, size);
    return e.id === "stone" && s.stone ? UIART.stone(s.stone, size) : e.id === "race" ? UIART.power(s.race, size) : UIART.action("power:beast", size);
  }
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function html(s) {
    const L = list(s), n = Math.max(L.length, 4), R = 118;
    const slots = L.map((e, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, x = Math.cos(a) * R, y = Math.sin(a) * R, nf = info(s, e);
      return `<button class="fw-slot ${nf.on ? "on" : ""} ${nf.have ? "" : "off"}" data-fw="${i}"${["item", "spell", "shout"].includes(e.k) ? ` data-tip-k="${e.k}:${esc(e.id)}"` : ""} style="--x:${x.toFixed(1)}px;--y:${y.toFixed(1)}px;--i:${i}" aria-label="${esc(nf.name)}${nf.sub ? ", " + esc(nf.sub) : ""}">
        <span class="fw-ico">${slotIcon(s, e, 34)}</span><span class="fw-nm">${esc(nf.name)}</span>${nf.sub ? `<span class="fw-sub">${esc(nf.sub)}</span>` : ""}</button>`;
    }).join("");
    const empty = !L.length ? `<p class="fw-empty">No favourites yet.<br>Open Items or Magic, pick something and tap <b>★ Favourite</b>.</p>` : "";
    const ready = s.favReady ? (() => { const e = L.find((f) => actionOf(f) === s.favReady); return e ? info(s, e).name : null; })() : null;
    return `<div class="fw-in" role="dialog" aria-label="Favourites">
      <div class="fw-ring"></div>${slots}
      <div class="fw-hub"><b>Favourites</b><span>${ready ? `Readied: ${esc(ready)}` : L.length ? "Tap to equip or ready" : ""}</span><button class="fw-x" data-fw="close" aria-label="Close favourites">✕</button></div>${empty}</div>`;
  }
  function render() {
    const s = ctx?.save(); const el = $("#favwheel"); if (!el || !s) return;
    el.innerHTML = html(s);
  }
  function show() {
    const s = ctx?.save(); if (!s || !live) return;
    let el = $("#favwheel");
    if (!el) {
      el = document.createElement("div"); el.id = "favwheel"; el.className = "favwheel";
      el.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-fw]");
        if (!b) { if (ev.target === el) hide(); return; }
        const v = b.dataset.fw; if (v === "close") return hide();
        pick(+v);
      });
      document.body.appendChild(el);
    }
    open = true; render();
    el.classList.remove("fw-out"); void el.offsetWidth; el.classList.add("fw-on");
    try { ctx.sound?.("click"); } catch { /* fine */ }
  }
  function hide() {
    const el = $("#favwheel"); open = false; if (!el) return;
    const rm = typeof MOTION === "undefined" || !MOTION.on || !MOTION.on();
    if (rm) { el.remove(); return; }
    el.classList.add("fw-out"); setTimeout(() => { if (!open) el.remove(); }, 180);
  }
  function pick(i) {
    const s = ctx.save(); const r = use(s, i);
    ctx.toast?.(r.text);
    if (r.ok) { ctx.persist?.(); try { ctx.sound?.("equip"); } catch { /* fine */ } }
    const b = $(`#favwheel [data-fw="${i}"]`);
    if (b && r.ok) { b.classList.add("fw-hit"); setTimeout(() => { hide(); ctx.refresh?.(); }, 160); } else render();
  }

  // ---- long-press the compass; or tap the ★ button
  const HOLD_MS = 480;
  const fingers = new Set();   // pointers currently down: two or more means a pinch, never a long-press
  function onDown(ev) {
    fingers.add(ev.pointerId);
    if (fingers.size > 1) { cancel(); return; }
    if (open || !ctx?.save()) return;
    const t = ev.target; if (!t.closest) return;
    const zone = t.closest("#tw");   // only the compass: the map uses holds and pinches for zooming and panning
    if (!zone || t.closest("button, a, input, select, textarea, [data-act], [data-twgo], [data-twq]")) return;
    const p = ev.touches ? ev.touches[0] : ev;
    press = { x: p.clientX, y: p.clientY, timer: setTimeout(() => { press = null; swallowClick = true; setTimeout(() => { swallowClick = false; }, 600); show(); }, HOLD_MS) };
  }
  function onMove(ev) {
    if (!press) return;
    const p = ev.touches ? ev.touches[0] : ev;
    if (Math.hypot(p.clientX - press.x, p.clientY - press.y) > 10) cancel();
  }
  function cancel() { if (press) { clearTimeout(press.timer); press = null; } }
  function lift(ev) { fingers.delete(ev.pointerId); cancel(); }
  function mount(c) {
    ctx = c; if (!live) return;
    if (!$("#favBtn")) {
      const b = document.createElement("button"); b.id = "favBtn"; b.className = "favbtn"; b.setAttribute("aria-label", "Favourites wheel");
      b.innerHTML = "★"; b.onclick = () => (open ? hide() : show());
      document.body.appendChild(b);
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", lift, true);
      document.addEventListener("pointercancel", lift, true);
      document.addEventListener("wheel", cancel, { capture: true, passive: true });
      document.addEventListener("touchstart", (ev) => { if (ev.touches.length > 1) cancel(); }, { capture: true, passive: true });
      document.addEventListener("click", (ev) => { if (swallowClick && !ev.target.closest("#favwheel")) { ev.stopPropagation(); ev.preventDefault(); swallowClick = false; } }, true);
      document.addEventListener("contextmenu", (ev) => { if (ev.target.closest?.("#map, canvas#map, #tw")) ev.preventDefault(); });
    }
  }
  /* the ★ Favourite button for the Items / Magic menu details */
  function menuButton(s, ref) {
    const e = entryFor(s, ref); if (!e) return "";
    const on = has(s, e);
    return `<button class="btn fw-star ${on ? "on" : ""}" data-act="favtoggle" data-id="${esc(ref)}" aria-pressed="${on}">${on ? "★ Favourite" : "☆ Favourite"}</button>`;
  }
  function afterMenu(el, s, sky) {
    if (!el || !s || !sky || sky.sel == null || (sky.page !== "items" && sky.page !== "magic")) return;
    const acts = el.querySelector(".sky-detail .sky-acts") || (() => { const d = el.querySelector(".sky-detail"); if (!d) return null; const a = document.createElement("div"); a.className = "sky-acts"; d.appendChild(a); return a; })();
    if (!acts || acts.querySelector(".fw-star")) return;
    const h = menuButton(s, sky.sel); if (h) acts.insertAdjacentHTML("beforeend", h);
  }

  return { MAX, list, entryFor, has, toggle, actionOf, info, use, opener, potFree, mount, show, hide, html, menuButton, afterMenu, get open() { return open; } };
})();
if (typeof module !== "undefined") module.exports = FAVWHEEL;
