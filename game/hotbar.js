/* The hotbar: your fight's action panel as 10 slots you set up yourself, keys 1 2 3 4 5 6 7 8 9 0. [OURS]
   Players: "players should be able to adjust their action panel like a hotbar and use number keys to use them 1234567890".
   fightctl.js still draws the dock; on your turn its top part is now this bar.
   - Each slot holds one move: a blow, a power attack, a guard or shield bash, a spell (crafted rune spells too), a dual
     cast, a shout or power, a potion or scroll, or an ability (Breathe, Oil flask, Mark target, Cover allies).
   - Nobody starts empty: until you change it, the bar fills itself from your hero (blows, your best attack and healing
     spells, a health potion, your shouts, Breathe...). Your old ★ pins and favourites wheel come along.
   - Edit: "Edit hotbar" in the … menu, or a tap on an empty slot. Then tap a slot and tap
     what goes in it (or drag it there with a mouse); tap two slots (or drag one onto another) to swap them; Clear empties
     the slot you picked (or drag a slot off the bar). Default puts the self-filling bar back.
   - Saved per hero in the save file (s.hotbar), so it goes to the cloud with the rest. A save without one gets the default.
   - Keys on a PC: 1-9 and 0 use the slot, the same as a tap (a heal with teammates around asks who gets it). Nothing fires
     while you type in chat or a field, while the … menu, the fight log or a window is open. In edit mode the keys pick slots.
   - Resting the mouse on a slot (or holding a finger on it) shows what the move will do, the same as any move
     (movepreview.js), so there's no long press to edit.
   - A slot greys out when you can't use it (not enough stamina or magicka, a shout still cooling down, none left) and says
     why; a potion slot shows how many you have. In a party fight each player's phone shows their own hero's bar.
   Pure parts (layout, defaults, keys, cleaning bad saves) work without a page: tests/test_hotbar.js. */
const HOTBAR = (() => {
  const N = 10;
  const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const DOM = typeof document !== "undefined";
  const ID_RE = /^[a-z_]+(?::[\w.\-]+)?$/i;
  const FIXED = new Set(["end", "flee"]);   // End turn and Flee keep their own buttons
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const buzz = (ms) => { try { if (!(DOM && document.documentElement.classList.contains("a11y-still"))) navigator.vibrate?.(ms); } catch { /* no vibration */ } };
  const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

  // ------------------------------------------------------------------ keys
  const keyToSlot = (k) => KEYS.indexOf(String(k));
  const slotKey = (i) => KEYS[i] ?? "";

  // ------------------------------------------------------------------ the layout (pure)
  /* any saved value -> 10 slots of action ids or null (bad entries, doubles, End turn and Flee are dropped). null when
     there's nothing usable saved at all. Accepts the plain array and a {slots: [...]} object. */
  function clean(v) {
    const arr = Array.isArray(v) ? v : v && typeof v === "object" && Array.isArray(v.slots) ? v.slots : null;
    if (!arr) return null;
    const out = [], seen = new Set();
    for (let i = 0; i < N; i++) {
      const a = arr[i];
      const good = typeof a === "string" && a.length <= 80 && ID_RE.test(a) && !FIXED.has(a) && !seen.has(a);
      if (good) seen.add(a);
      out.push(good ? a : null);
    }
    return out;
  }
  const saved = (s) => (s ? clean(s.hotbar) : null);
  const isCustom = (s) => !!saved(s);

  const tierN = { Novice: 1, Apprentice: 2, Adept: 3, Expert: 4, Master: 5 };
  function spellsOf(s) {
    const D0 = typeof D !== "undefined" ? D : null; if (!D0 || !s) return [];
    return (s.spells || []).filter((id) => D0.SPELLS[id] && D0.SPELLS[id].kind !== "utility").map((id) => [id, D0.SPELLS[id]]);
  }
  function bestSpell(s, pred, skip = []) {
    return spellsOf(s).filter(([id, x]) => pred(x) && !skip.includes(id))
      .sort((a, b) => (tierN[b[1].level] || 1) - (tierN[a[1].level] || 1) || (b[1].amount || 0) - (a[1].amount || 0))[0]?.[0] || null;
  }
  const hitSpell = (x) => x.element && x.element !== "none" && x.kind !== "heal";
  function shoutsOf(s) {
    if (typeof POWERS === "undefined" || !s) return [];
    const out = [];
    try { for (const id of Object.keys(POWERS.SHOUTS)) if (!POWERS.ROAD_SHOUTS.includes(id) && POWERS.level(s, id) > 0) out.push("shout:" + id); } catch { /* none */ }
    return out;
  }
  function hasShield(s, f) {
    if (f) return !!f.shield && typeof SHIELDFX !== "undefined";
    try { const L = typeof G !== "undefined" && G.loadout ? G.loadout(s) : null; return !!(L && L.shield) && typeof SHIELDFX !== "undefined"; } catch { return false; }
  }
  function potCount(s, f, kind) {
    let n = 0;
    try { for (const r of s.inv || []) if (D.ITEMS[r.item]?.slot === "potion" && D.ITEMS[r.item].restore?.[0] === kind) n += Math.max(0, f && f.left ? f.left(r.id) : r.qty || 0); } catch { /* none */ }
    return n;
  }
  /* the self-filling bar: blows first, then your pins / favourites wheel, then what suits the hero */
  function defaults(s, f) {
    const out = [], add = (a) => { if (a && !out.includes(a) && !FIXED.has(a) && out.length < N && ID_RE.test(a)) out.push(a); };
    add("attack"); add("power_attack"); add(hasShield(s, f) ? "bash" : "block");
    const spellOk = (a) => { const [k, id] = a.split(":"); return k !== "spell" && k !== "dual" ? true : spellsOf(s).some(([x]) => x === id); };
    // what you pinned in the old quick slots (★) and the favourites wheel
    try { const L = typeof FIGHTCTL !== "undefined" && FIGHTCTL.favs ? FIGHTCTL.favs() : null; if (L) L.filter((a) => typeof a === "string" && spellOk(a)).forEach(add); } catch { /* none */ }
    for (const e of Array.isArray(s?.favs) ? s.favs : []) {
      if (e?.k === "spell" && spellOk("spell:" + e.id)) add("spell:" + e.id);
      else if (e?.k === "item" && typeof D !== "undefined" && D.ITEMS[e.id]?.restore?.[0]) add("potion:" + D.ITEMS[e.id].restore[0]);
    }
    const hit = bestSpell(s, hitSpell), heal = bestSpell(s, (x) => x.kind === "heal");
    if (hit) add("spell:" + hit);
    if (heal) add("spell:" + heal);
    add("potion:health");
    for (const a of shoutsOf(s).slice(0, 2)) add(a);
    if (typeof STRAT !== "undefined") add("recover");
    if (hit || potCount(s, f, "magicka")) add("potion:magicka");
    if (potCount(s, f, "stamina") || !hit) add("potion:stamina");
    const armor = bestSpell(s, (x) => x.kind === "armor" || x.kind === "ward");
    if (armor) add("spell:" + armor);
    const hit2 = bestSpell(s, hitSpell, [hit]);
    if (hit2) add("spell:" + hit2);
    if (typeof REACT !== "undefined" && f) { try { for (const [a] of REACT.moves(f)) add(a); } catch { /* none */ } }
    while (out.length < N) out.push(null);
    return out;
  }
  const layout = (s, f) => saved(s) || defaults(s, f);
  function store(s, L) { if (!s) return null; s.hotbar = clean(L) || Array(N).fill(null); return s.hotbar; }
  /* put a move in slot i; if it already sits in another slot the two trade places */
  function put(s, i, a, f) {
    if (!(i >= 0 && i < N) || typeof a !== "string" || !ID_RE.test(a) || FIXED.has(a)) return false;
    const L = layout(s, f).slice(), j = L.indexOf(a);
    if (j >= 0 && j !== i) L[j] = L[i];
    L[i] = a; store(s, L); return true;
  }
  function swap(s, i, j, f) {
    if (!(i >= 0 && i < N && j >= 0 && j < N) || i === j) return false;
    const L = layout(s, f).slice(); [L[i], L[j]] = [L[j], L[i]]; store(s, L); return true;
  }
  function clear(s, i, f) {
    if (!(i >= 0 && i < N)) return false;
    const L = layout(s, f).slice(); L[i] = null; store(s, L); return true;
  }
  function reset(s) { if (s) delete s.hotbar; }

  // ------------------------------------------------------------------ the picker's lists
  function names(s, f, a) {
    const [k, arg] = a.split(":");
    const bow = f ? f.wt === "bow" || f.wt === "crossbow" : false;
    if (a === "attack") return bow ? "Shoot" : "Attack";
    if (a === "power_attack") return "Power attack";
    if (a === "block") return "Guard";
    if (a === "bash") return "Shield bash";
    if (a === "recover") return "Breathe";
    if (k === "spell") return D.SPELLS[arg]?.name || arg;
    if (k === "dual") return "Dual " + (D.SPELLS[arg]?.name || arg);
    if (k === "potion") return cap(arg) + " potion";
    if (k === "scroll") return D.ITEMS[arg]?.name || "Scroll";
    if (k === "shout") return (typeof POWERS !== "undefined" && POWERS.SHOUTS[arg]?.[0]) || cap(arg);
    if (k === "power") return arg === "race" ? "Racial power" : arg === "stone" ? "Standing stone" : cap(arg);
    if (k === "rx") return ({ oil: "Oil flask", mark: "Mark target", cover: "Cover allies" })[arg] || cap(arg);
    return cap(a.replace(/_/g, " "));
  }
  /* short label under a slot */
  function short(s, f, a) {
    const [k, arg] = a.split(":");
    if (k === "potion") return cap(arg);
    if (k === "scroll") return names(s, f, a).replace(/^Scroll of /i, "");
    if (k === "shout") { const w = typeof POWERS !== "undefined" && POWERS.SHOUTS[arg]?.[1]?.[0]; return w || names(s, f, a); }
    if (a === "power_attack") return "Power";
    if (a === "bash") return "Bash";
    return names(s, f, a);
  }
  const CATS = [["weapons", "Weapons"], ["spells", "Spells"], ["shouts", "Shouts"], ["items", "Items"], ["abilities", "Abilities"]];
  /* everything that can go on the bar, by category: {weapons: [{a, name, sub}], ...} */
  function catalog(s, f) {
    const out = { weapons: [], spells: [], shouts: [], items: [], abilities: [] }, R = (c, a, sub) => out[c].push({ a, name: names(s, f, a), sub: sub || "" });
    R("weapons", "attack"); R("weapons", "power_attack"); R("weapons", "block");
    if (hasShield(s, f)) R("weapons", "bash");
    for (const [id, sp] of spellsOf(s)) {
      const mc = typeof G !== "undefined" && G.spellCost ? Math.round(G.spellCost(s, sp)) : sp.cost;
      R("spells", "spell:" + id, `${sp.level || (typeof TOMES !== "undefined" && TOMES.level ? TOMES.level(id) : "Novice")} · ${mc} magicka`);
      if (typeof MAGIC !== "undefined" && MAGIC.dualable && MAGIC.dualable(sp)) R("spells", "dual:" + id, "Both hands");
    }
    for (const a of shoutsOf(s)) R("shouts", a, "Shout");
    if (typeof POWERS !== "undefined" && s?.race && POWERS.RACE?.[s.race]) R("shouts", "power:race", POWERS.RACE[s.race][0]);
    try { if (typeof POWERS !== "undefined" && POWERS.stoneHasPower && POWERS.stoneHasPower(s)) R("shouts", "power:stone", "Once a day"); } catch { /* none */ }
    for (const r of ["health", "magicka", "stamina"]) R("items", "potion:" + r, `${potCount(s, f, r)} left`);
    const scrolls = new Set();
    try { for (const r of s.inv || []) { const it = D.ITEMS[r.item]; if (it?.spell && D.SPELLS[it.spell] && (f && f.left ? f.left(r.id) : r.qty) > 0) scrolls.add(r.item); } } catch { /* none */ }
    for (const it of [...scrolls].slice(0, 12)) R("items", "scroll:" + it, "Scroll");
    if (typeof STRAT !== "undefined") R("abilities", "recover", "Get your breath back");
    if (typeof REACT !== "undefined") { R("abilities", "rx:oil", "Combo"); R("abilities", "rx:mark", "Combo"); R("abilities", "rx:cover", "Combo"); }
    return out;
  }
  /* is this slot's move still yours? (a forgotten spell or a shout you don't know shows greyed out as "Not known") */
  function known(s, f, a) {
    const [k, arg] = a.split(":");
    if (k === "spell" || k === "dual") return spellsOf(s).some(([id]) => id === arg) && (k === "spell" || (typeof MAGIC !== "undefined" && MAGIC.dualable(D.SPELLS[arg])));
    if (k === "shout") return shoutsOf(s).includes(a);
    if (a === "bash") return hasShield(s, f);
    if (a === "recover") return typeof STRAT !== "undefined";
    if (k === "rx") return typeof REACT !== "undefined";
    if (k === "beast" || k === "lord" || k === "vamp") return false;   // a form's own moves live on the form's bar
    return true;
  }

  // ------------------------------------------------------------------ edit mode state
  let editing = false, sel = -1, tab = "weapons", swallowT = 0, drag = null;
  const root = () => (DOM ? document.getElementById("tbf") : null);
  const sessS = (sess) => sess?.f?.s || null;
  /* the layout lives in the hero's save (s.hotbar). A fight works on the live save and keeps it when it ends
     (tbfight.js finalS), so a change made mid-fight is saved, and goes to the cloud, with the fight's result. */
  const persist = () => {};

  // ------------------------------------------------------------------ drawing
  /* the bar on your turn: 10 slots. api/ui come from fightctl.js (its buttons, icons and costs) */
  function bar(sess, api, ui) {
    const f = sess.f, s = f.s;
    if (editing) return editHTML(sess, api, ui);
    const L = layout(s, f);
    const slots = L.map((a, i) => {
      const k = slotKey(i);
      if (!a) return `<button class="hb-s hb-empty" type="button" data-hbx="slot" data-hbs="${i}" aria-label="Empty slot ${k}. Tap to set it up"><span class="ic" aria-hidden="true"></span><b></b><kbd class="fc-k" aria-hidden="true">${k}</kbd></button>`;
      if (!known(s, f, a)) return `<button class="tbact fc-b hb-s hb-gone off" type="button" disabled data-hbs="${i}" aria-label="${esc(names(s, f, a))}: not known"><span class="ic" aria-hidden="true">${ui.icon(f, a)}</span><b>${esc(short(s, f, a))}</b><small class="fc-why">Not known</small><kbd class="fc-k" aria-hidden="true">${k}</kbd></button>`;
      const extra = "hb-s fc-q" + (/^(shout|power):/.test(a) ? " shout" : "") + (a === "recover" ? " rec" : "") + (a === "power_attack" ? " pw" : "") + (a === "block" || a === "bash" ? " gd" : "");
      return ui.btn(sess, api, a, { label: short(s, f, a), extra, key: k, badge: a.startsWith("potion:") ? potCount(s, f, a.split(":")[1]) : null }).replace("<button ", `<button data-hbs="${i}" `);
    }).join("");
    return `<div class="hb-bar" role="toolbar" aria-label="Hotbar">${slots}</div>`;
  }
  function editHTML(sess, api, ui) {
    const f = sess.f, s = f.s, L = layout(s, f), cat = catalog(s, f);
    if (!cat[tab]?.length) tab = "weapons";
    const where = new Map(L.map((a, i) => [a, i]).filter(([a]) => a));
    const tabs = CATS.map(([id, label]) => `<button class="hb-tab${tab === id ? " on" : ""}" type="button" data-hbtab="${id}" aria-pressed="${tab === id}">${label}<i>${cat[id].length}</i></button>`).join("");
    const rows = cat[tab].map((e) => {
      const at = where.get(e.a);
      return `<button class="hb-p${at != null ? " in" : ""}" type="button" data-hbp="${esc(e.a)}" aria-label="${esc(e.name)}${at != null ? `, in slot ${slotKey(at)}` : ""}"><span class="hb-pic" aria-hidden="true">${ui.icon(f, e.a, 26)}</span><span class="hb-pn">${esc(e.name)}<small>${esc(e.sub)}</small></span>${at != null ? `<kbd class="hb-at">${slotKey(at)}</kbd>` : ""}</button>`;
    }).join("") || `<p class="sub">Nothing here yet.</p>`;
    const slots = L.map((a, i) => `<button class="hb-slot${i === sel ? " sel" : ""}${a ? "" : " hb-none"}${a && !known(s, f, a) ? " gone" : ""}" type="button" data-hbs="${i}" aria-pressed="${i === sel}" aria-label="Slot ${slotKey(i)}: ${a ? esc(names(s, f, a)) : "empty"}"><span class="ic" aria-hidden="true">${a ? ui.icon(f, a, 26) : "+"}</span><b>${a ? esc(short(s, f, a)) : ""}</b><kbd class="fc-k" aria-hidden="true">${slotKey(i)}</kbd></button>`).join("");
    const fine = typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches;
    const hint = sel >= 0 ? `Slot ${slotKey(sel)}: tap a move to put it here, or another slot to swap.` : fine ? "Drag a move onto a slot. Drag slots to swap, or off the bar to clear. Or click a slot, then a move." : "Tap a slot, then tap what goes in it. Tap two slots to swap them.";
    return `<div class="hb-edit" role="group" aria-label="Edit hotbar">
      <div class="hb-pick"><div class="hb-tabs" role="tablist">${tabs}</div><div class="hb-list">${rows}</div></div>
      <p class="hb-hint" role="status">${esc(hint)}</p>
      <div class="hb-bar hb-ebar" role="toolbar" aria-label="Hotbar slots">${slots}</div>
      <div class="hb-tools"><button class="hb-tb" type="button" data-hbx="clear"${sel >= 0 && L[sel] ? "" : " disabled"}>Clear slot</button><button class="hb-tb" type="button" data-hbx="reset"${isCustom(s) ? "" : " disabled"}>Default</button><button class="hb-tb pri" type="button" data-hbx="done">Done</button></div>
    </div>`;
  }

  // ------------------------------------------------------------------ clicks (tbfight.js onClick hands them over, then redraws)
  function setEdit(on, at = -1) {
    editing = !!on; sel = editing ? at : -1;
    if (editing && at >= 0) { const s = typeof TB !== "undefined" ? TB.session?.f?.s : null, a = s ? layout(s, TB.session.f)[at] : null; if (a) tab = catOf(a); }
    if (typeof FIGHTCTL !== "undefined" && FIGHTCTL.cancelAim) FIGHTCTL.cancelAim();
  }
  function catOf(a) {
    const k = a.split(":")[0];
    return k === "spell" || k === "dual" ? "spells" : k === "shout" || k === "power" ? "shouts" : k === "potion" || k === "scroll" ? "items" : a === "recover" || k === "rx" ? "abilities" : "weapons";
  }
  /* true when the click was ours (the caller redraws) */
  function click(b, sess) {
    if (!b || !sess) return false;
    const s = sessS(sess), f = sess.f;
    if (b.dataset.tbx === "hbedit") { const p = pendSel; pendSel = -1; setEdit(p >= 0 ? true : !editing, p); return true; }
    const x = b.dataset.hbx;
    if (!editing) {
      if (x === "slot" && b.dataset.hbs != null) { setEdit(true, +b.dataset.hbs); buzz(10); return true; }
      return false;
    }
    if (b.dataset.hbtab) { tab = b.dataset.hbtab; return true; }
    if (x === "done") { setEdit(false); return true; }
    if (x === "reset") { reset(s); sel = -1; persist(); return true; }
    if (x === "clear") { if (sel >= 0) { clear(s, sel, f); persist(); } return true; }
    if (b.dataset.hbs != null && b.classList.contains("hb-slot")) {
      const i = +b.dataset.hbs;
      if (sel < 0) sel = i;
      else if (sel === i) sel = -1;
      else { swap(s, sel, i, f); persist(); sel = -1; buzz(12); }
      return true;
    }
    if (b.dataset.hbp) {
      const a = b.dataset.hbp, L = layout(s, f);
      let i = sel;
      if (i < 0) i = L.indexOf(null);
      if (i < 0) { flash("Pick a slot first"); return true; }
      put(s, i, a, f); persist(); buzz(12);
      sel = -1;   // done with that slot: the next tap on a slot picks a new one (it never swaps by surprise)
      return true;
    }
    return false;
  }
  function flash(t) { const h = root()?.querySelector(".hb-hint"); if (h) { h.textContent = t; h.classList.remove("hb-flash"); void h.offsetWidth; h.classList.add("hb-flash"); } }

  // ------------------------------------------------------------------ keys: is it safe for a number key to fire?
  function blocked(ev) {
    const t = ev?.target;
    if (ev && (ev.ctrlKey || ev.metaKey || ev.altKey)) return true;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || "") || t.isContentEditable)) return true;
    if (!DOM) return false;
    const a = document.activeElement;
    if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || "") || a.isContentEditable)) return true;
    const r = root(); if (!r) return true;
    if (r.querySelector(".tbsheet") || document.querySelector(".tbtime")) return true;   // the fight log, the timing ring
    if (typeof FIGHTDC !== "undefined" && FIGHTDC.menuOpen) return true;                   // the … menu
    if (document.querySelector("#pausem")?.getClientRects().length) return true;            // the pause menu (Esc)
    // a window over the fight (overlays.js ranks them; only ones drawn above the fight count)
    const z = +getComputedStyle(r).zIndex || 0;
    for (const m of document.querySelectorAll("#modal .sheet, #tabmenu.open, .tm-open, #favwheel.open, #lvlpick")) {
      if (r.contains(m) || !m.getClientRects().length) continue;
      const host = m.closest("[style*=z-index], #modal, #tabmenu, #favwheel, #lvlpick") || m;
      if ((+getComputedStyle(host).zIndex || 0) >= z) return true;
    }
    if (typeof OVERLAYS !== "undefined" && OVERLAYS.top) { try { const o = OVERLAYS.top(); if (o.level >= 3 && o.el && !r.contains(o.el) && (+getComputedStyle(o.el.closest("#modal") || o.el).zIndex || 0) >= z) return true; } catch { /* fine */ } }
    return false;
  }
  /* a number key in edit mode: pick (or swap with) that slot. Returns true when handled. */
  function editKey(ev) {
    if (!editing) return false;
    const r = root(); if (!r || !r.querySelector(".hb-edit")) return false;
    if (ev.key === "Escape") { ev.preventDefault(); r.querySelector('[data-hbx="done"]')?.click(); return true; }
    if ((ev.key === "Delete" || ev.key === "Backspace") && sel >= 0) { ev.preventDefault(); r.querySelector('[data-hbx="clear"]')?.click(); return true; }
    const i = keyToSlot(ev.key); if (i < 0) return false;
    ev.preventDefault(); r.querySelector(`.hb-slot[data-hbs="${i}"]`)?.click(); return true;
  }

  // ------------------------------------------------------------------ dragging (mouse) in edit mode
  /* no long press on the bar any more: holding a slot shows what the move will do (movepreview.js) and its tooltip,
     so edit mode opens from the … menu or a tap on an empty slot */
  function onDown(ev) {
    const r = root(); if (!r || !editing) return;
    const src = ev.target.closest?.("#tbf .hb-edit [data-hbp], #tbf .hb-edit .hb-slot[data-hbs]"); if (!src || ev.button > 0) return;
    if (src.dataset.hbp && ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;   // the list scrolls under a finger: taps only
    drag = { src, x: ev.clientX, y: ev.clientY, id: ev.pointerId, on: false };
  }
  let pendSel = -1;
  function onMove(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    if (!drag.on) {
      if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 8) return;
      drag.on = true;
      const g = document.createElement("div"); g.className = "hb-ghost"; g.setAttribute("aria-hidden", "true");
      g.innerHTML = (drag.src.querySelector(".hb-pic, .ic")?.innerHTML || "") + `<b>${esc(drag.src.querySelector(".hb-pn")?.firstChild?.textContent || drag.src.querySelector("b")?.textContent || "")}</b>`;
      document.body.appendChild(g); drag.g = g; root()?.classList.add("hb-dragging");
    }
    ev.preventDefault();
    drag.g.style.transform = `translate(${ev.clientX - 24}px,${ev.clientY - 24}px)`;
    const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("#tbf .hb-edit .hb-slot[data-hbs]") || null;
    if (over !== drag.over) { drag.over?.classList.remove("hb-over"); over?.classList.add("hb-over"); drag.over = over; }
  }
  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.on) return;   // a plain tap: the click does it
    d.g?.remove(); d.over?.classList.remove("hb-over"); root()?.classList.remove("hb-dragging");
    swallowT = Date.now() + 400;
    const sess = typeof TB !== "undefined" ? TB.session : null; if (!sess || ev.type !== "pointerup") return;
    const s = sess.f.s, f = sess.f, to = d.over ? +d.over.dataset.hbs : -1;
    if (d.src.dataset.hbp) { if (to >= 0) { put(s, to, d.src.dataset.hbp, f); sel = -1; } }
    else {
      const from = +d.src.dataset.hbs;
      if (to >= 0) swap(s, from, to, f);
      else if (!document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("#tbf .hb-ebar")) clear(s, from, f);   // dropped off the bar
      sel = -1;
    }
    persist(); buzz(12);
    redraw();
  }
  function redraw() {
    // tbfight.js redraws on any click it handles: a tab button re-picks the current tab, which is a no-op redraw
    const r = root(); const b = r?.querySelector(`.hb-edit [data-hbtab="${tab}"]`);
    if (b) { b.click(); }
  }
  function eat(ev) {
    if (Date.now() < swallowT && ev.isTrusted && ev.target.closest?.("#tbf")) {
      if (ev.target.closest?.('[data-tbx="hbedit"]')) return;
      ev.stopImmediatePropagation(); ev.preventDefault(); swallowT = 0;
    }
  }
  if (DOM && typeof addEventListener === "function") {
    addEventListener("pointerdown", onDown, true);
    addEventListener("pointermove", onMove, { capture: true, passive: false });
    addEventListener("pointerup", onUp, true);
    addEventListener("pointercancel", onUp, true);
    addEventListener("click", eat, true);
  }

  /* after each redraw: the "Edit hotbar" item for the … menu (fightdeclutter.js moves it there) */
  function decorate(el, sess) {
    if (!DOM || !el) return;
    const top = el.querySelector(".tbtop");
    if (top && !top.querySelector('[data-tbx="hbedit"]') && !sess?.done) {
      top.insertAdjacentHTML("beforeend", `<button class="tbff hb-ed${editing ? " on" : ""}" type="button" data-tbx="hbedit" aria-label="Edit hotbar" data-tip="Set up your hotbar: which move sits on which number key."><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg></button>`);
    }
    el.classList.toggle("hb-editing", editing && !!el.querySelector(".hb-edit"));
  }
  /* the fight closed: leave edit mode */
  function reset0() { editing = false; sel = -1; pendSel = -1; }

  return { N, KEYS, keyToSlot, slotKey, clean, saved, isCustom, defaults, layout, store, put, swap, clear, reset, catalog, known, names, short, CATS,
    bar, click, blocked, editKey, decorate, setEdit, reset0, potCount,
    get editing() { return editing; }, get sel() { return sel; } };
})();
if (typeof module !== "undefined") module.exports = HOTBAR;
