/* Inventory helpers [OURS]: small things that make a full pack less of a chore.
   - Keep (): mark a thing so bulk actions never touch it. Favourites-wheel items count as kept too.
   - Sell all junk: at a shop, one tap sells cheap trinkets and loose gear that's worse than what you wear
     (never kept, favourite, quest, unique, enchanted or crafted things). You see the list and the total first.
   - Pack sorting (name, value, weight, value per weight, newest) and green ▲ / red ▼ arrows on gear
     that's better or worse than what you're wearing.
   - A warning before buying or taking something makes you too heavy, with a shortcut to sell or drop things.
   - Asks first before selling, breaking (enchanter) or dropping valuable (500+ gold), unique, enchanted or kept things.
   - Undo last sale: buy it back for exactly what you got, while you're still in that town and within an in-game hour.
     The undo lives only in memory for the save object that made the sale (no save-file or backup tricks), refuses to
     make a duplicate, and a bought-back thing gives no Mercantile/Streetwise practice when sold again (no XP loops).
     Market stalls, trades and chests never create an undo: only shop sales through G.sell do. */
const INVQOL = (() => {
  const VALUABLE = 500, UNDO_GAME_SECONDS = 3600;
  const STACK = new Set(["potion", "scroll", "soulgem", "tome", "ingredient", "trophy", "poison", "material", "food", "valuable", "ammo"]);   // as engine.js
  const QUEST = new Set(["golden_claw", "dragonstone"]);
  const SORTS = [["type", "Normal"], ["name", "Name"], ["value", "Value"], ["weight", "Weight"], ["ratio", "Value/wt"], ["new", "Newest"]];
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const item = (r) => (r && D.ITEMS[r.item]) || null;
  const nameOf = (r) => { const it = item(r); return it ? (r.tq && typeof TOWNS !== "undefined" ? TOWNS.QUALITY[r.tq] + " " : "") + it.name + (r.nm ? ` “${r.nm}”` : "") : "?"; };

  // ---------------------------------------------------------------- marks
  const isKeep = (r) => !!r?.keep;
  function toggleKeep(s, id) {
    const r = G.invRow(s, id); if (!r) return "You don't have that.";
    if (r.keep) { delete r.keep; return `${nameOf(r)} is no longer marked Keep.`; }
    r.keep = 1; return ` ${nameOf(r)} marked Keep. Bulk selling will leave it alone.`;
  }
  const isFav = (s, r) => typeof FAVWHEEL !== "undefined" && !!s && FAVWHEEL.has(s, FAVWHEEL.entryFor(s, r.id));
  const isUnique = (r) => { const it = item(r); return !!it && !!(it.unique || it.dae || (it.noTrade && (it.value || 0) >= 1000)); };
  const isQuest = (r) => { const it = item(r); return !!it && (QUEST.has(r.item) || !!it.noTrade || !!it.quest); };
  const isEnchanted = (r) => { const it = item(r); return !!it && !!(it.enchant || it.aenchant || it.staff || String(r.item).startsWith("ench|")); };
  const isProtected = (s, r) => isKeep(r) || isFav(s, r) || isQuest(r) || isUnique(r);
  const wornIds = (s) => { const ids = new Set(); for (const l of Object.values(s.loadouts || {})) for (const id of Object.values(l.equipment || {})) ids.add(id); return ids; };

  /* why this action needs a second tap ("" = no need). kind: sell | drop | break */
  function confirmWhy(s, r, qty = 1, kind = "sell") {
    const it = item(r); if (!it) return "";
    const why = [];
    if (kind === "break") why.push("it's destroyed");
    if (isKeep(r)) why.push("you marked it Keep");
    else if (isFav(s, r)) why.push("it's on your favourites wheel");
    if (isUnique(r)) why.push("it's one of a kind");
    if (isEnchanted(r) && kind !== "break") why.push("it's enchanted");
    if ((it.value || 0) >= VALUABLE) why.push(`it's worth ${it.value} gold${qty > 1 ? " each" : ""}`);
    return why.join(", ");
  }

  // ---------------------------------------------------------------- better / worse than worn
  function statOf(it, r) {
    if (!it) return null;
    if (it.slot === "weapon") return (it.damage || 0) + (r?.temper || 0);
    if ((G.ARMOR_SLOTS || []).includes(it.slot)) return (it.armor || 0) + (r?.temper || 0);
    return null;
  }
  /* 1 better, -1 worse, 0 same, null: not comparable (not gear, worn itself, a different weapon skill) */
  function compare(s, itemId, r = null) {
    const it = D.ITEMS[itemId]; if (!it || !(G.SLOTS || []).includes(it.slot)) return null;
    const mine = statOf(it, r); if (mine == null) return null;
    const w = G.equipment(s)[it.slot];
    if (r && w && w.id === r.id) return null;
    if (!w) return mine > 0 ? 1 : null;
    const wit = D.ITEMS[w.item]; if (!wit) return null;
    if (it.slot === "weapon" && wit.skill !== it.skill) return null;
    const theirs = statOf(wit, w);
    return mine > theirs ? 1 : mine < theirs ? -1 : 0;
  }
  function arrow(s, itemId, r = null) {
    const c = compare(s, itemId, r); if (c == null || c === 0) return "";
    const it = D.ITEMS[itemId], w = G.equipment(s)[it.slot], word = it.slot === "weapon" ? "damage" : "armor";
    const t = w ? `${statOf(it, r)} ${word} vs ${statOf(D.ITEMS[w.item], w)} worn` : `Nothing worn there`;
    return c > 0 ? `<i class="iq-up" title="Better than worn: ${esc(t)}" aria-label="Better than what you wear">▲</i>` : `<i class="iq-dn" title="Worse than worn: ${esc(t)}" aria-label="Worse than what you wear">▼</i>`;
  }
  /* the little marks after an item's name in lists */
  const badge = (s, itemId, r = null) => (r && (isKeep(r) || isFav(s, r)) ? `<i class="iq-keep" title="${isKeep(r) ? "Keep" : "Favourite"}" aria-label="${isKeep(r) ? "Kept" : "Favourite"}">${isKeep(r) ? "" : "★"}</i>` : "") + arrow(s, itemId, r);

  // ---------------------------------------------------------------- junk
  function junkWhy(s, r, worn, fence) {
    const it = item(r); if (!it || worn.has(r.id) || isProtected(s, r) || isEnchanted(r)) return "";
    if (r.stolen && !fence) return "";
    if (r.nm || r.cv != null) return "";   // things you made or named stay
    if ((it.slot === "valuable" && !r.item.startsWith("gem_") || ((it.slot === "ring" || it.slot === "amulet") && !it.unique)) && (it.value || 0) < VALUABLE) return "trinket";   // plain rings and amulets (enchanted ones never count)
    if ((G.SLOTS || []).includes(it.slot) && (it.value || 0) < VALUABLE && compare(s, r.item, r) === -1) return "worse than worn";
    return "";
  }
  function junk(s, fence = false) {
    const worn = wornIds(s), out = [];
    for (const r of s.inv) { const why = junkWhy(s, r, worn, fence); if (why) out.push({ r, qty: r.qty, why, price: s.location ? G.lotPrice(s, r.item, r.qty, "sell", r) : 0 }); }
    return out.sort((a, b) => b.price - a.price);
  }

  // ---------------------------------------------------------------- sorting the pack
  /* rows can be inventory rows or anything holding one (get) */
  function sorted(s, rows, get = (x) => x) {
    const k = s.invSort || "type";
    if (k === "type") return rows;
    const v = (r) => (item(r)?.value || 0) * r.qty, w = (r) => (item(r)?.weight || 0) * r.qty;
    const f = { name: (a, b) => nameOf(a).localeCompare(nameOf(b)), value: (a, b) => v(b) - v(a), weight: (a, b) => w(b) - w(a),
      ratio: (a, b) => v(b) / Math.max(0.1, w(b)) - v(a) / Math.max(0.1, w(a)), new: (a, b) => b.id - a.id }[k];
    return f ? [...rows].sort((a, b) => f(get(a), get(b)) || nameOf(get(a)).localeCompare(nameOf(get(b)))) : rows;
  }
  const sortHTML = (s) => `<div class="chips iq-sort" role="group" aria-label="Sort your pack"><span class="sub">Sort:</span>${SORTS.map(([k, l]) => `<button class="chip ${(s.invSort || "type") === k ? "on" : ""}" data-act="iqsort" data-id="${k}">${l}</button>`).join("")}</div>`;

  // ---------------------------------------------------------------- weight
  /* null, or { now, after, cap } when taking qty of itemId would tip you over */
  function overAfter(s, itemId, qty = 1) {
    const it = D.ITEMS[itemId]; if (!it) return null;
    const now = G.carried(s), cap = G.capacity(s), after = now + (it.weight || 0) * qty;
    return now <= cap && after > cap ? { now, after, cap } : null;
  }

  // ---------------------------------------------------------------- sales and undo
  let last = null, batch = null;
  const gameAge = (sale, t) => (t - sale.t) * G.GAME_SPEED;
  function lastSale(s, t = G.now()) {
    if (!last || last.s !== s) return null;
    if (s.location !== last.town || gameAge(last, t) >= UNDO_GAME_SECONDS) { last = null; return null; }
    return last;
  }
  const forget = () => { last = null; };
  /* wraps G.sell (installed below): remembers what went, and keeps bought-back things from teaching Mercantile twice */
  function wrapSell(orig) {
    return function sell(s, id, qty = 1, t = G.now()) {
      const r = G.invRow(s, id), snap = r ? JSON.parse(JSON.stringify(r)) : null, gold0 = s.gold;
      const noXp = !!r?.ub, sk = noXp ? JSON.stringify([s.skills?.Mercantile, s.skills?.Streetwise, s.charXp, s.level, s.pendingLevels]) : null;
      const m = orig(s, id, qty, t);
      if (!/^Sold/.test(m) || !snap) return m;
      if (noXp) {   // a sale of something you bought back: no practice (undo loops can't farm XP)
        const [me, st, cx, lv, pl] = JSON.parse(sk);
        if (me) s.skills.Mercantile = me; if (st) s.skills.Streetwise = st; s.charXp = cx; s.level = lv; s.pendingLevels = pl;
        const live = G.invRow(s, id); if (live) delete live.ub;
      }
      delete snap.ub;
      const sale = { row: snap, qty, price: s.gold - gold0 };
      if (batch) batch.rows.push(sale);
      else last = { s, town: s.location, t, rows: [sale] };
      return noXp ? m.replace(/ (Mercantile|Streetwise|You reached).*$/, "") : m;
    };
  }
  function sellJunk(s, fence = false, t = G.now()) {
    const list = junk(s, fence); if (!list.length) return { n: 0, gold: 0, text: "No junk to sell." };
    batch = { s, town: s.location, t, rows: [] };
    let gold = 0, n = 0, err = "";
    const g0 = s.gold;
    try {
      for (const j of list) { const m = G.sell(s, j.r.id, j.qty, t); if (/^Sold/.test(m)) n++; else { err = m; if (!n) break; } }
    } finally { gold = s.gold - g0; if (batch.rows.length) last = batch; batch = null; }
    if (!n) return { n: 0, gold: 0, text: err || "The merchant won't take any of it." };
    return { n, gold, text: `Sold ${n} thing${n > 1 ? "s" : ""} of junk for ${gold} gold.` };
  }
  function undo(s, t = G.now()) {
    const sale = lastSale(s, t);
    if (!sale) return "Nothing to buy back. You can only undo your last sale in the same town, within an in-game hour.";
    if (typeof TOWNS !== "undefined" && TOWNS.wanted(s)) return "The merchant won't trade with a wanted criminal.";
    const total = sale.rows.reduce((a, x) => a + x.price, 0);
    if (s.gold < total) return `Buying it back costs ${total} gold. You have ${s.gold}.`;
    for (const x of sale.rows) {   // never make a copy: a non-stacking thing whose id is already in the pack is refused
      const it = D.ITEMS[x.row.item]; if (!it) return "The merchant has already sold it on.";
      if (!STACK.has(it.slot) && G.invRow(s, x.row.id)) return "Can't buy that back.";
    }
    s.gold -= total;
    for (const x of sale.rows) {
      const it = D.ITEMS[x.row.item];
      const same = G.invRow(s, x.row.id), other = STACK.has(it.slot) ? s.inv.find((r) => r.item === x.row.item) : null;
      if (same && same.item === x.row.item) { same.qty += x.qty; same.ub = 1; }
      else if (other) { other.qty += x.qty; other.ub = 1; }
      else {
        const id = x.row.id < s.nextInv && !G.invRow(s, x.row.id) ? x.row.id : s.nextInv++;
        s.inv.push({ ...x.row, id, qty: x.qty, ub: 1 });
      }
      if (typeof ECON !== "undefined") ECON.record(s.id, sale.town, x.row.item, x.qty, t);   // the market forgets the sale
    }
    last = null;
    const what = sale.rows.length === 1 ? `${nameOf(sale.rows[0].row)}${sale.rows[0].qty > 1 ? " ×" + sale.rows[0].qty : ""}` : `${sale.rows.length} things`;
    return `Bought back ${what} for ${total} gold.`;
  }

  // ---------------------------------------------------------------- drop
  function drop(s, id, qty = 1) {
    const r = G.invRow(s, id); if (!r) return "You don't have that.";
    if (isQuest(r)) return `You'd better hold on to the ${item(r).name}.`;
    if (wornIds(s).has(id)) return "Take it off first.";
    qty = Math.max(1, Math.min(r.qty, Math.floor(qty)));
    const n = nameOf(r); G.take(s, id, qty);
    return `You leave ${n}${qty > 1 ? " ×" + qty : ""} behind.`;
  }

  // ---------------------------------------------------------------- HTML bits for ui.js
  function shopHTML(s, shop, ok) {
    const fence = shop === "fence" || (typeof TOWNS !== "undefined" && TOWNS.canFence(s));
    const sale = lastSale(s), j = junk(s, fence), jt = j.reduce((a, x) => a + x.price, 0);
    const total = sale ? sale.rows.reduce((a, x) => a + x.price, 0) : 0;
    const what = sale ? (sale.rows.length === 1 ? nameOf(sale.rows[0].row) : `${sale.rows.length} things`) : "";
    return `<div class="iq-shop">${j.length ? `<button class="btn sm" data-act="iqjunk" data-f="${fence ? 1 : 0}" ${ok ? "" : "disabled"}> Sell all junk · ${j.length} · ${jt}g</button>` : ""}${sale ? `<button class="btn sm" data-act="iqundo" ${ok && s.gold >= total ? "" : "disabled"}>↶ Buy back ${esc(what)} · ${total}g</button>` : ""}</div>`;
  }
  /* extra buttons for an item's actions (pack row and the Items menu) */
  function acts(s, r, worn, small = true) {
    if (!r || !item(r)) return [];
    const c = small ? "btn sm" : "btn", out = [`<button class="${c} iq-k ${isKeep(r) ? "on" : ""}" data-act="iqkeep" data-id="${r.id}" aria-pressed="${isKeep(r)}">${isKeep(r) ? " Kept" : " Keep"}</button>`];
    if (!worn && !isQuest(r)) {
      out.push(`<button class="${c}" data-act="iqdrop" data-id="${r.id}" data-n="1">Drop</button>`);
      if (r.qty > 1) out.push(`<button class="${c}" data-act="iqdrop" data-id="${r.id}" data-n="${r.qty}">Drop all</button>`);
    }
    return out;
  }
  function junkModal(s, fence) {
    const j = junk(s, fence), tot = j.reduce((a, x) => a + x.price, 0);
    return `<h2>Sell all junk?</h2><p class="sub">Cheap trinkets and loose gear worse than what you wear. Kept , favourite, quest, unique, enchanted and handmade things are never in this list.</p>
      <div class="list iq-junk">${j.map((x) => `<div class="item">${typeof ICONART !== "undefined" ? ICONART.item(x.r.item, 28, x.r) : ""}<div class="t">${esc(nameOf(x.r))}${x.qty > 1 ? ` ×${x.qty}` : ""}<span>${esc(x.why)}</span></div><span class="num gold">${x.price}</span></div>`).join("")}</div>
      <p class="iq-total">Total: <b class="num gold">${tot}</b> gold</p>
      <div class="iq-btns"><button class="btn pri" data-act="iqjunkgo" data-f="${fence ? 1 : 0}">Sell ${j.length} for ${tot}g</button><button class="btn" data-act="iqno">Cancel</button></div>
      <p class="sub">Changed your mind later? “Buy back” undoes it while you're in town (an in-game hour).</p>`;
  }
  const confirmModal = (title, text, yes, danger = false) => `<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="iq-btns"><button class="btn ${danger ? "danger" : "pri"}" data-act="iqyes">${esc(yes)}</button><button class="btn" data-act="iqno">Cancel</button></div>`;
  function heavyModal(s, what, w, inShop) {
    return `<h2>Too heavy</h2><p>${esc(what)} would put you at <b class="num">${Math.round(w.after)}/${Math.round(w.cap)}</b>. Over your limit you can't run and travel slowly.</p>
      <div class="iq-btns"><button class="btn pri" data-act="iqyes">Take it anyway</button>${inShop ? `<button class="btn" data-act="iqsellmode">Sell something</button>` : ""}<button class="btn" data-act="iqheavy">${inShop ? "Drop something" : "Drop or store something"}</button><button class="btn" data-act="iqno">Cancel</button></div>`;
  }

  // ---------------------------------------------------------------- clicks (ui.js calls this first; true = handled)
  let pending = null, pass = false;
  /* ctx: { say(msg), render(), openModal(html), closeModal(), again(dataset), sellMode(), heavyPack(), stall(id) } */
  function onClick(b, s, ctx) {
    if (!b || !s || !ctx) return false;
    const a = b.dataset.act, id = +b.dataset.id;
    if (pass) { pass = false; return false; }
    const ask = (html, fn) => { pending = fn; ctx.openModal(html); return true; };
    const redo = () => { const ds = { ...b.dataset }; return () => { ctx.closeModal(); pass = true; try { ctx.again(ds); } finally { pass = false; } }; };
    switch (a) {
      case "iqyes": { const f = pending; pending = null; ctx.closeModal(); if (f) f(); return true; }
      case "iqno": pending = null; ctx.closeModal(); return true;
      case "iqsellmode": pending = null; ctx.closeModal(); ctx.sellMode?.(); return true;
      case "iqheavy": pending = null; ctx.closeModal(); ctx.heavyPack?.(); return true;
      case "iqkeep": ctx.say(toggleKeep(s, id)); return true;
      case "iqsort": if (b.dataset.id === "type") delete s.invSort; else s.invSort = b.dataset.id; ctx.render(); return true;
      case "iqdrop": {
        const r = G.invRow(s, id); if (!r) return true;
        const n = +b.dataset.n || 1, why = confirmWhy(s, r, n, "drop");
        const go = () => ctx.say(drop(s, id, n));
        if (why) return ask(confirmModal(`Drop ${nameOf(r)}${n > 1 ? " ×" + n : ""}?`, `Are you sure? ${why[0].toUpperCase() + why.slice(1)}. Dropped things are gone for good.`, "Drop it", true), go);
        go(); return true;
      }
      case "iqjunk": ctx.openModal(junkModal(s, b.dataset.f === "1")); return true;
      case "iqjunkgo": { ctx.closeModal(); const r = sellJunk(s, b.dataset.f === "1"); if (r.n && typeof GUIDE !== "undefined") GUIDE.mark(s, "trade"); ctx.say(r.text); return true; }
      case "iqundo": ctx.say(undo(s)); return true;
      case "sell": case "sellall": {
        const r = G.invRow(s, id); if (!r) return false;
        const why = confirmWhy(s, r, a === "sellall" ? r.qty : 1, "sell"); if (!why) return false;
        return ask(confirmModal(`Sell ${nameOf(r)}${a === "sellall" && r.qty > 1 ? " ×" + r.qty : ""}?`, `Are you sure? ${why[0].toUpperCase() + why.slice(1)}. You can buy it back while you're in town, within an in-game hour.`, "Sell it"), redo());
      }
      case "disench": {
        const r = G.invRow(s, id); if (!r) return false;
        const why = confirmWhy(s, r, 1, "break");
        return ask(confirmModal(`Break ${nameOf(r)}?`, `${why[0].toUpperCase() + why.slice(1)}: you learn its enchantment but lose the item for good.`, "Break it", true), redo());
      }
      case "buy": case "buyn": case "unstash": case "mbuy": {
        let itemId = null, qty = 1, what = "";
        if (a === "buy" || a === "buyn") { itemId = b.dataset.item; qty = a === "buyn" ? +b.dataset.n || 1 : 1; if (itemId === "horse") return false; }
        else if (a === "unstash") { const h = typeof TOWNS !== "undefined" ? TOWNS.home(s) : null, x = h?.chest?.[id]; if (x) { itemId = x.item; const n = b.dataset.n === "amt" ? +(typeof document !== "undefined" && document.getElementById("hsAmt")?.value) : +b.dataset.n; qty = Math.min(x.qty, n > 0 ? Math.floor(n) : x.qty); } }   // only what you take (homestash.js)
        else { const d = ctx.stall?.(b.dataset.id); if (d?.row) { itemId = d.row.item; qty = d.row.qty; } }
        if (!itemId || !D.ITEMS[itemId]) return false;
        const w = overAfter(s, itemId, qty); if (!w) return false;
        what = `${D.ITEMS[itemId].name}${qty > 1 ? " ×" + qty : ""}`;
        return ask(heavyModal(s, what, w, a === "buy" || a === "buyn"), redo());
      }
    }
    return false;
  }

  // install the sale wrapper once (G.sell is called through the G object everywhere)
  if (typeof G !== "undefined" && G.sell && !G.sell.iq) { const w = wrapSell(G.sell); w.iq = true; G.sell = w; }

  return { VALUABLE, UNDO_GAME_SECONDS, SORTS, isKeep, toggleKeep, isFav, isUnique, isQuest, isEnchanted, isProtected, confirmWhy, compare, arrow, badge, junk, sorted, sortHTML,
    overAfter, lastSale, forget, sellJunk, undo, drop, shopHTML, acts, junkModal, onClick };
})();
if (typeof module !== "undefined") module.exports = INVQOL;
