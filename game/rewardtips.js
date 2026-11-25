/* Item tooltips on reward and loot screens (rewardtips.js). [OURS]
   A player: "on rewards screen there are no proper item tooltips". The dungeon's loot icons only had a plain title with
   the name, and enchanted finds ("Steel Mace of Numbing") weren't even found by name. Now every reward icon shows the
   same SkyUI card as the Items menu (tooltip.js itemHTML): name in its rarity colour, type, damage or armour, weight,
   value, the enchantment and what it does, potion effects, a green/red comparison with what you wear and
   "Already have N". Gold and stacks get a short card of their own.
   - attr(id, qty) / goldAttr(n): the markup a reward icon carries (data-tip-k="rw:<id>*<qty>" + data-rtip).
   - idOf(name, s): an item id from the name a result line uses (your newest pack row with that name first).
   - strip(gold, list): a row of reward icons (names, ids or [id, qty]); the dungeon's look (.dloots).
   - Every item icon drawn without a pack row (ICONART.item(id)) carries the item's tooltip too.
   - G.give is watched: take() hands a result window what you were just given, so text-only results
     (road events, quests, crisis rewards...) can show their icons.
   - Input: PC hover (tooltip.js); phone: tap an icon (or hold it) and the card slides up as the bottom sheet (tooltip.js
     tt-sheet), tap anywhere else to close. The comparison is itemcmp.js's block (via TIP.itemHTML), as in the Items menu. A reward icon under a
     higher overlay (overlays.js: a VICTORY card over a dungeon room) shows nothing. */
const RTIP = (() => {
  const DOM = typeof document !== "undefined" && typeof window !== "undefined";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const items = () => (typeof D !== "undefined" && D.ITEMS ? D.ITEMS : {});
  const save = () => { try { return DOM && window.__dbg?.save ? window.__dbg.save() : null; } catch { return null; } };

  // ------------------------------------------------------------ names → ids
  let byName = null;
  function names() {
    const I = items(), n = Object.keys(I).length;
    if (byName && byName.n === n) return byName;
    byName = new Map(); byName.n = n;
    for (const [id, it] of Object.entries(I)) if (it?.name && (!byName.has(it.name) || byName.get(it.name).startsWith("ench|"))) byName.set(it.name, id);
    return byName;
  }
  /* "Steel Mace of Numbing" → "ench|steel_mace|numbing|20|..." (your newest pack row with that name wins) */
  function idOf(name, s = save()) {
    const nm = String(name || "").replace(/^\s*\d+\s*[×x]\s*/, "").replace(/\s*[×x]\s*\d+\s*$/, "").replace(/\s*“[^”]*”\s*$/, "").trim();
    if (!nm) return null;
    const I = items();
    if (I[nm]) return nm;
    if (s?.inv) for (let i = s.inv.length - 1; i >= 0; i--) { const r = s.inv[i]; if (I[r.item]?.name === nm) return r.item; }
    return names().get(nm) || null;
  }
  const qtyOf = (name) => { const m = String(name || "").match(/(?:^\s*(\d+)\s*[×x]\s)|(?:[×x]\s*(\d+)\s*$)/); return m ? +(m[1] || m[2]) : 1; };

  // ------------------------------------------------------------ the tooltips
  const tipOK = () => typeof TIP !== "undefined";
  function have(s, id) { return (s?.inv || []).reduce((a, r) => a + (r.item === id ? r.qty || 1 : 0), 0); }
  function itemCard(key, s) {
    const [id, q0] = String(key).split("*"), q = Math.max(1, +q0 || 1), it = items()[id];
    if (!it || !tipOK()) return null;
    const h = TIP.itemHTML(id, s); if (!h) return null;
    const stack = q > 1 ? `<p class="tt-stack">Stack of ${q} · weight ${+((it.weight || 0) * q).toFixed(2)} · value ${(it.value || 0) * q}</p>` : "";
    return h.replace(/(<p class="tt-have">)/, stack + "$1") + (h.includes("tt-have") ? "" : stack);
  }
  function goldCard(n, s) {
    const g = Math.max(0, Math.round(+n || 0));
    return `<b class="tt-h tt-gold">${g} gold</b><div class="tt-sub">Gold</div>${s ? `<p>Into your purse. You now have ${Math.round(s.gold || 0)} gold.</p>` : ""}<p class="tt-hint">In a party, gold is split evenly.</p>`;
  }
  if (tipOK()) {
    TIP.register("rw", (k, s) => itemCard(k, s));
    TIP.register("rwgold", (n, s) => goldCard(n, s));
  }
  /* the markup for one reward icon */
  const attr = (id, qty = 1) => (id && items()[id] ? ` data-tip-k="rw:${esc(id)}${qty > 1 ? "*" + qty : ""}" data-rtip="1"` : "");
  const goldAttr = (n) => ` data-tip-k="rwgold:${Math.round(+n || 0)}" data-rtip="1"`;
  /* an item icon without its own tooltip key (the reward wrapper around it carries the fuller one) */
  const icon = (id, size = 34, row = null) => (id && typeof ICONART !== "undefined" ? String(ICONART.item(id, size, row) || "").replace(/ data-tip-k="item:[^"]*"/, "") : "");
  /* a row of reward icons: list of names ("Iron Sword ×2"), ids, or [id, qty] / {id, n} */
  function norm(list, s) {
    return (list || []).map((x) => {
      if (Array.isArray(x)) return { id: x[0], n: x[1] || 1 };
      if (x && typeof x === "object") return { id: x.id || x.item, n: x.n || x.qty || 1 };
      const id = items()[x] ? x : idOf(x, s); return { id, n: items()[x] ? 1 : qtyOf(x), name: items()[x] ? null : String(x).replace(/\s*[×x]\s*\d+\s*$/, "").replace(/^\s*\d+\s*[×x]\s*/, "") };
    }).filter((x) => x.id || x.name);
  }
  function strip(gold, list, o = {}) {
    const s = o.s || save(), size = o.size || 34, L = norm(list, s);
    if (!gold && !L.length) return "";
    const ico = (id) => icon(id, size);
    const coins = () => (typeof DUNART !== "undefined" && DUNART.coins ? DUNART.coins(size) : `<span class="rt-coin" style="width:${size}px;height:${size}px"></span>`);
    let i = 0;
    const one = (icon, label, a) => `<span class="dloot rt"${a} tabindex="0" role="img" aria-label="${esc(label)}" style="animation-delay:${i++ * 90}ms">${icon}<small>${esc(label)}</small></span>`;
    return `<div class="dloots rt-strip${o.cls ? " " + o.cls : ""}">${gold ? one(coins(), `${gold} gold`, goldAttr(gold)) : ""}${L.map((x) => one(ico(x.id), `${x.id ? items()[x.id].name : x.name}${x.n > 1 ? " ×" + x.n : ""}`, attr(x.id, x.n))).join("")}</div>`;
  }

  // ------------------------------------------------------------ what you were just given (G.give)
  let gains = [];
  function watchGive() {
    if (typeof G === "undefined" || !G.give || G.give._rt) return;
    const base = G.give;
    const w = function (s, item, qty = 1, ...rest) {
      const r = base.call(this, s, item, qty, ...rest);
      try { const me = save(); if (s && (!me || s === me) && items()[item]) gains.push({ id: item, n: qty || 1, t: Date.now() }); if (gains.length > 60) gains = gains.slice(-60); } catch { /* fine */ }
      return r;
    };
    w._rt = true; G.give = w;
  }
  watchGive();
  /* the items given in the last few seconds, merged by id (and forgotten, so the next window doesn't show them again) */
  function take(maxAge = 5000, now = Date.now()) {
    const out = new Map();
    for (const g of gains) if (now - g.t <= maxAge) out.set(g.id, (out.get(g.id) || 0) + g.n);
    gains = [];
    return [...out].map(([id, n]) => [id, n]);
  }
  const peek = () => gains.slice();
  const forget = () => { gains = []; };

  // ------------------------------------------------------------ every bare item icon carries its tooltip
  function stampIcons() {
    if (typeof ICONART === "undefined" || !ICONART.item || ICONART.item._rt) return;
    const base = ICONART.item;
    const w = function (id, size = 34, row = null) {
      const h = base.call(this, id, size, row);
      if (!h || row || typeof h !== "string" || /data-tip-k=/.test(h.slice(0, 200))) return h;
      return h.replace(/^<(\w+)/, `<$1 data-tip-k="item:${esc(id)}"`);
    };
    Object.assign(w, base); w._rt = true; ICONART.item = w;
  }

  // ------------------------------------------------------------ overlays.js: a reward icon under a higher overlay stays quiet
  function allowed(el) {
    if (!el?.closest?.("[data-rtip]")) return true;
    if (el.closest(".bfov")) return true;   // the boss loot card sits over everything
    if (typeof OVERLAYS !== "undefined" && OVERLAYS.top) {   // a result card (VICTORY, level up) owns the screen: only its own icons
      const t = OVERLAYS.top();
      if (t && t.level >= 4 && t.el) { const box = t.el.closest(".c2res, #tbf, #modal, #lvlpick") || t.el; if (!box.contains(el)) return false; }
    }
    try {   // and nothing else lies on top of the icon
      const r = el.getBoundingClientRect(); if (!r.width && !r.height) return false;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && !el.contains(top) && !top.contains(el) && !top.closest("#tip")) return false;
    } catch { /* no layout (tests) */ }
    return true;
  }

  // ------------------------------------------------------------ phone: tap a reward icon to see it, tap elsewhere to close
  let touch = false, openOn = null;
  const ACT = "button, a, input, select, textarea, [data-act], [data-tba], [data-tbx], [role=button]";
  function onDown(e) {
    touch = e.pointerType === "touch" || e.pointerType === "pen";
    openOn = tipOK() && TIP.open ? TIP.current?.el || null : null;   // (before tooltip.js closes it on this touch)
  }
  function onClick(e) {
    if (!touch || !tipOK()) return;
    const el = e.target?.closest?.("[data-rtip]"); if (!el) return;
    const act = el.closest(ACT); if (act && act !== el && !el.contains(act)) return;   // an icon inside a button: the button's job
    e.stopPropagation(); e.preventDefault();
    if (openOn === el) { TIP.hide(); openOn = null; return; }   // the same icon again: close
    const k = el.dataset.tipK; if (!k) return;
    TIP.show({ el, k, tap: true });   // a phone: the bottom sheet (tooltip.js), like a held finger
  }

  function mount() {
    if (!DOM || mount.done) return; mount.done = true;
    stampIcons(); watchGive();
    if (tipOK()) TIP.gate = allowed;
    window.addEventListener("pointerdown", onDown, true);
    document.addEventListener("click", onClick, true);
  }
  if (DOM) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount(); }
  else stampIcons();

  return { idOf, qtyOf, have, attr, icon, goldAttr, strip, itemCard, goldCard, take, peek, forget, allowed, stampIcons, watchGive, norm };
})();
if (typeof module !== "undefined") module.exports = RTIP;
