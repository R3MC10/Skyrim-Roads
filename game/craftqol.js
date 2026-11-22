/* Crafting shortcuts [OURS]: the same helpers at every crafting station (forge make / smelt & tan / improve,
   alchemy lab, cooking pot and campfire, arcane enchanter, homestead workbench; arrows and bolts are forge recipes).
   - "Can make now": one switch (saved) that hides what you can't make; every recipe says how many you can make
     from what you carry, or what's missing ("Missing: 2 Iron Ingot").
   - Quantity: the normal button still makes one (with its mini-game). ×5 and Max ("until you run out") ask once,
     then make them one after another through the exact same single-craft code with the plain "Quick craft" result,
     so materials and skill gains are exactly what crafting them one at a time gives. One summary toast at the end.
   - Favourites: tap ☆ to pin a recipe (or an alchemy mix, or an enchantment) to the top of its list.
   Pure logic first (tested in Node: tests/test_craft.js), then small HTML helpers and the click handler ui.js calls. */
const CRAFTQOL = (() => {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MAX_LOOP = 500;                                  // a safety stop; nothing real gets near it
  const nm = (i) => D.ITEMS[i]?.name || i;
  const cnt = (s, i) => s.inv.filter((r) => r.item === i).reduce((a, r) => a + r.qty, 0);
  const QUICK = () => (typeof CG !== "undefined" ? CG.QUICK : "good");

  // ---------------------------------------------------------------- settings kept on the save
  const favs = (s) => (Array.isArray(s.cqfav) ? s.cqfav : (s.cqfav = []));
  const key = (kind, id) => `${kind}:${id}`;
  const isFav = (s, kind, id) => favs(s).includes(key(kind, id));
  function toggleFav(s, kind, id) {
    const k = key(kind, id), f = favs(s);
    s.cqfav = f.includes(k) ? f.filter((x) => x !== k) : [...f, k].slice(-60);
    return s.cqfav.includes(k);
  }
  const onlyCan = (s) => !!s.cqonly;
  const setOnly = (s, v) => { s.cqonly = !!v; return s.cqonly; };
  const favMixes = (s) => favs(s).filter((k) => k.startsWith("alch:")).map((k) => k.slice(5));
  const mixKey = (items) => [...new Set(items)].sort().join("+");

  // ---------------------------------------------------------------- alchemy: shared effects you know
  function knownFx(s, item) {
    const fx = TOWNS.INGREDIENT_FX[item]?.[1] || [], k = (s.known || {})[item] || [];
    return fx.filter((e, i) => k[i]);
  }
  function knownShared(s, items) {
    const lists = items.map((i) => knownFx(s, i));
    return [...new Set(lists.flat())].filter((e) => lists.filter((l) => l.includes(e)).length >= 2);
  }

  // ---------------------------------------------------------------- what one craft needs, per station
  /* -> { name, out, mats: [[label, per craft, have]], hard: reason that isn't materials | null } */
  function need(s, kind, id) {
    if (kind === "smith") {
      const i = SMITH.info(s, id); if (!i) return null;
      return { name: nm(id), out: i.out || 1, mats: i.mats.map(([m, n]) => [nm(m), n, cnt(s, m)]), hard: i.block && !/^Missing/.test(i.block) ? i.block : null };
    }
    if (kind === "refine") {
      const i = SMITH.refineInfo(s, +id);
      return { name: nm(i.out), out: i.n, mats: i.mats.map(([m, n]) => [nm(m), n, cnt(s, m)]), hard: null };
    }
    if (kind === "cook") {
      const rc = COOK.RECIPES[id]; if (!rc) return null;
      return { name: rc[0], out: 1, mats: rc[1].map(([it, q]) => [it === "fish" ? "any fish" : nm(it), q, COOK.countOf(s, it)]), hard: null };
    }
    if (kind === "alch") {
      const items = String(id).split("+").filter((x) => TOWNS.INGREDIENT_FX[x]);
      if (items.length < 2) return null;
      const sh = knownShared(s, items);
      return { name: sh.length ? sh.join(", ") : items.map(nm).join(" + "), out: 1, mats: items.map((i) => [nm(i), 1, cnt(s, i)]), hard: sh.length ? null : "You don't know an effect these share yet." };
    }
    if (kind === "bench") {
      const H = typeof HOMESTEAD !== "undefined" ? HOMESTEAD : null, b = H?.BENCH[id];
      const pid = H?.BY_TOWN[s.location], h = pid && H.plot(s, pid);
      if (!b) return null;
      return { name: H.MATS[id][0], out: b[0], mats: [...Object.entries(b[1]).map(([i, n]) => [nm(i), n, cnt(s, i)]), ...Object.entries(b[2]).map(([q, n]) => [H.MATS[q][0].toLowerCase(), n, h ? h.stock[q] || 0 : 0])], hard: h ? null : "The workbench is at your plot." };
    }
    return null;
  }
  /* how many times you can make it right now -> { n, missing: ["2 Iron Ingot"], hard, name, out, mats } */
  function can(s, kind, id) {
    if (kind === "temper") return canTemper(s, id);
    const q = need(s, kind, id);
    if (!q) return { n: 0, missing: [], hard: "You can't make that.", name: "", out: 0, mats: [] };
    const n = q.hard ? 0 : Math.max(0, Math.min(...q.mats.map(([, per, have]) => Math.floor(have / per))));
    return { ...q, n: Number.isFinite(n) ? n : 0, missing: q.mats.filter(([, per, have]) => have < per).map(([l, per, have]) => `${per - have} ${l}`) };
  }
  /* improving one item: each step uses one ingot, up to what your Smithing allows */
  function canTemper(s, rowId) {
    const r = G.invRow(s, +rowId), i = r && TOWNS.temperInfo(s, r);
    if (!i) return { n: 0, missing: [], hard: "That can't be improved.", name: "", out: 1, mats: [] };
    const hard = i.block && !/^Needs 1 /.test(i.block) ? i.block : null;
    const n = hard ? 0 : Math.max(0, Math.min(i.maxQ - i.q, i.have));
    return { n, hard, name: nm(r.item), out: 1, mats: [[nm(i.ingot), 1, i.have]], missing: i.have ? [] : [`1 ${nm(i.ingot)}`] };
  }

  // ---------------------------------------------------------------- one craft, through the game's own single-craft code
  function pickRows(s, items, prefer = []) {
    return items.map((it) => {
      const p = prefer.map((id) => G.invRow(s, id)).find((r) => r && r.item === it);
      return (p || s.inv.find((r) => r.item === it && !r.stolen) || s.inv.find((r) => r.item === it))?.id;
    });
  }
  function craftOnce(s, kind, id, o = {}) {
    const hasCG = typeof CG !== "undefined";
    if (kind === "smith") { const t = hasCG ? CG.smithMake(s, id, QUICK()) : SMITH.make(s, id); return { ok: /^You make/.test(t), text: t }; }
    if (kind === "refine") { const t = hasCG ? CG.refine(s, +id, false, QUICK()) : SMITH.refine(s, +id); return { ok: /^You (smelt|tan)/.test(t), text: t }; }
    if (kind === "cook") { const t = COOK.cook(s, id); return { ok: /^You cook/.test(t), text: t }; }
    if (kind === "alch") {
      const rows = pickRows(s, String(id).split("+"), o.rows || []);
      if (rows.some((x) => x == null)) return { ok: false, text: "You've run out of an ingredient." };
      const r = hasCG ? CG.brew(s, rows, QUICK()) : TOWNS.brew(s, rows);
      return { ok: /^You brew/.test(r.text), text: r.text };
    }
    if (kind === "bench") { const r = HOMESTEAD.make(s, HOMESTEAD.BY_TOWN[s.location], id, 1); return { ok: !r.err, text: r.err || r.text }; }
    if (kind === "temper") { const t = TOWNS.temper(s, +id); return { ok: /^You hammer/.test(t), text: t }; }
    return { ok: false, text: "Nothing to make." };
  }

  // ---------------------------------------------------------------- many crafts: one after another, then one summary
  function snapshot(s, kind) {
    const inv = {}; for (const r of s.inv) inv[r.item] = (inv[r.item] || 0) + r.qty;
    const lv = Object.fromEntries(Object.entries(s.skills).map(([k, v]) => [k, v.lvl]));
    const pid = kind === "bench" && typeof HOMESTEAD !== "undefined" ? HOMESTEAD.BY_TOWN[s.location] : null, h = pid && HOMESTEAD.plot(s, pid);
    return { inv, lv, level: s.level, stock: h ? { ...h.stock } : null };
  }
  const list = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  function summary(s, kind, id, made, b, last) {
    const a = snapshot(s, kind), got = [], used = [];
    for (const it of new Set([...Object.keys(b.inv), ...Object.keys(a.inv)])) {
      const d = (a.inv[it] || 0) - (b.inv[it] || 0);
      if (d > 0) got.push(`${nm(it)} ×${d}`); else if (d < 0) used.push(`${nm(it)} ×${-d}`);
    }
    if (a.stock && b.stock) for (const q of Object.keys(HOMESTEAD.MATS)) {
      const d = (a.stock[q] || 0) - (b.stock[q] || 0), l = HOMESTEAD.MATS[q][0].toLowerCase();
      if (d > 0) got.push(`${l} ×${d}`); else if (d < 0) used.push(`${l} ×${-d}`);
    }
    const ups = Object.keys(a.lv).filter((k) => a.lv[k] > b.lv[k]).map((k) => `${k} ${b.lv[k]} → ${a.lv[k]}`);
    if (kind === "temper") { const r = G.invRow(s, +id); got.length = 0; if (r) got.push(`${nm(r.item)} is now ${TOWNS.QUALITY[r.tq] || "better"}`); }
    const verb = { smith: "You make", refine: "You get", cook: "You cook", alch: "You brew", bench: "At the workbench you make" }[kind] || "You make";
    let text = kind === "temper" ? `You improve it ${made} time${made > 1 ? "s" : ""}: ${got.join("")}.` : `${verb} ${list(got) || "nothing"}${made > 1 && got.some((g) => !g.endsWith("×" + made)) ? ` (${made} batches)` : ""}.`;
    if (used.length) text += ` Used ${list(used)}.`;
    if (ups.length) text += ` 📈 ${ups.join(" · ")}.`;
    if (a.level > b.level) text += ` You reached level ${a.level}! Choose health, magicka or stamina.`;
    const less = /\((Making the same|The same)[^)]*\)/.exec(last || "");
    if (less) text += " " + less[0];
    return text;
  }
  /* want: a number or "max" -> { made, ok, text, stop } */
  function bulk(s, kind, id, want, o = {}) {
    const start = can(s, kind, id);
    const target = want === "max" ? start.n : Math.max(0, Math.floor(+want || 0));
    if (!target || !start.n) return { made: 0, ok: false, text: start.hard || (start.missing.length ? `Missing: ${start.missing.join(", ")}.` : "You can't make that now.") };
    const b = snapshot(s, kind);
    let made = 0, last = "", stop = null;
    for (let i = 0; i < Math.min(target, MAX_LOOP); i++) {
      if (!can(s, kind, id).n) { stop = "out"; break; }
      const r = craftOnce(s, kind, id, o);
      last = r.text;
      if (!r.ok) { stop = r.text; break; }
      made++;
    }
    if (!made) return { made: 0, ok: false, text: last || "You can't make that now." };
    let text = summary(s, kind, id, made, b, last);
    if (made < target) text += ` You stopped after ${made}: ${stop === "out" || !stop ? "you ran out of materials" : stop.replace(/\.$/, "").toLowerCase()}.`;
    return { made, ok: true, text, stop };
  }

  // ---------------------------------------------------------------- the screens (small HTML pieces ui.js and homestead.js drop in)
  /* favourites first, then the rest in their usual order; with "Can make now" on, only what you can make */
  function order(s, kind, ids, opt = {}) {
    let out = ids;
    if (onlyCan(s) && !opt.keep) out = out.filter((id) => can(s, kind, id).n > 0);
    return [...out.filter((id) => isFav(s, kind, id)), ...out.filter((id) => !isFav(s, kind, id))];
  }
  function bar(s, kind, ids) {
    const ready = ids.filter((id) => can(s, kind, id).n > 0).length, on = onlyCan(s);
    return `<div class="cqbar"><button class="chip cqonly ${on ? "on" : ""}" data-act="cqonly" aria-pressed="${on}">${on ? "✔" : "○"} Can make now</button><span class="cqready">${ready} of ${ids.length} ready${favs(s).some((k) => k.startsWith(kind + ":")) ? " · ★ pinned first" : ""}</span></div>`
      + (on && !ready && ids.length ? `<p class="sub cqnone">Nothing here you can make from what you carry. Switch off “Can make now” to see what's missing.</p>` : "");
  }
  function star(s, kind, id, label = "") {
    const on = isFav(s, kind, id);
    return `<button class="cqstar ${on ? "on" : ""}" data-act="cqfav" data-k="${kind}" data-id="${esc(id)}" aria-pressed="${on}" aria-label="${on ? "Unpin" : "Pin to the top"}${label ? " " + esc(label) : ""}" title="${on ? "Pinned to the top" : "Pin to the top"}">${on ? "★" : "☆"}</button>`;
  }
  function status(s, kind, id, c = can(s, kind, id)) {
    if (c.hard) return `<span class="cqst no">🔒 ${esc(c.hard)}</span>`;
    if (c.n) return `<span class="cqst ok">Can make ${c.n}${c.out > 1 ? ` (${c.n * c.out} in all)` : ""}</span>`;
    return `<span class="cqst no">Missing: ${esc(c.missing.join(", "))}</span>`;
  }
  function qty(s, kind, id, c = can(s, kind, id), five = true) {
    return (five ? `<button class="btn sm cqq" data-act="cqask" data-k="${kind}" data-id="${esc(id)}" data-n="5" ${c.n >= 5 ? "" : "disabled"} aria-label="Make 5">×5</button>` : "")
      + `<button class="btn sm cqq" data-act="cqask" data-k="${kind}" data-id="${esc(id)}" data-n="max" ${c.n >= 2 ? "" : "disabled"} aria-label="Make as many as you can${c.n >= 2 ? ` (${c.n})` : ""}">Max${c.n >= 2 ? ` ${c.n}` : ""}</button>`;
  }
  /* the cooking pot / campfire list (same "cook" buttons as before) */
  function cookList(s, canCook) {
    const ids = Object.keys(COOK.RECIPES);
    return bar(s, "cook", ids) + order(s, "cook", ids).map((id) => {
      const [name, ings, , what] = COOK.RECIPES[id], c = can(s, "cook", id);
      return `<div class="item cqrow"><div class="t">${esc(name)}<span>${esc(what)} · ${ings.map(([it, q]) => `${q > 1 ? q + " " : ""}${it === "fish" ? "any fish" : esc(nm(it))}`).join(", ")}</span>${status(s, "cook", id, c)}</div>
        <div class="cqbtns">${star(s, "cook", id, name)}<button class="btn sm ${c.n ? "pri" : ""}" data-act="cook" data-id="${id}" ${c.n && canCook ? "" : "disabled"}>Cook</button>${canCook ? qty(s, "cook", id, c) : ""}</div></div>`;
    }).join("");
  }
  /* alchemy: favourite mixes on top, and a filter for ingredients that pair with something you carry */
  function alchTop(s) {
    const mixes = favMixes(s), on = onlyCan(s);
    const rows = (on ? mixes.filter((m) => can(s, "alch", m).n > 0) : mixes).map((m) => {
      const c = can(s, "alch", m), items = m.split("+");
      return `<div class="item cqrow"><div class="t">★ ${esc(items.map(nm).join(" + "))}<span>${esc(knownShared(s, items).join(", ") || "No shared effect known")}</span>${status(s, "alch", m, c)}</div>
        <div class="cqbtns">${star(s, "alch", m, "mix")}<button class="btn sm" data-act="cqmix" data-id="${esc(m)}" ${c.n ? "" : "disabled"}>Pick</button>${qty(s, "alch", m, c)}</div></div>`;
    }).join("");
    return `<div class="cqbar"><button class="chip cqonly ${on ? "on" : ""}" data-act="cqonly" aria-pressed="${on}">${on ? "✔" : "○"} Can make now</button><span class="cqready">${on ? "Only ingredients that pair with one you carry" : "Tap to hide ingredients with no known partner"}</span></div>`
      + (mixes.length ? `<h3 class="cqh">Favourite mixes</h3>${rows || `<p class="sub">You can't brew any of your favourite mixes right now.</p>`}<h3 class="cqh">Ingredients</h3>` : "");
  }
  function alchFilter(s, rows, sel = []) {
    if (!onlyCan(s)) return rows;
    const items = [...new Set(rows.map((r) => r.item))];
    return rows.filter((r) => sel.includes(r.id) || items.some((o) => o !== r.item && knownShared(s, [r.item, o]).length));
  }
  /* under the Brew button: pin this mix, brew 5 or as many as you can */
  function alchBulk(s, selRows) {
    const items = [...new Set(selRows.filter(Boolean).map((r) => r.item))];
    if (items.length < 2) return "";
    const m = mixKey(items), c = can(s, "alch", m);
    return `<div class="cqbtns cqalch">${star(s, "alch", m, "this mix")}<span class="cqready">${c.hard ? esc(c.hard) : `Enough for ${c.n}`}</span>${qty(s, "alch", m, c)}</div>`;
  }
  /* the enchanter: "can make now" keeps only gear a known effect fits; favourite effects first; what's missing */
  function enchBlanks(s, blanks, known) {
    return onlyCan(s) ? blanks.filter((r) => known.some((e) => ENCH.canTake(D.ITEMS[r.item], e))) : blanks;
  }
  function enchBar(s) {
    const on = onlyCan(s);
    return `<div class="cqbar"><button class="chip cqonly ${on ? "on" : ""}" data-act="cqonly" aria-pressed="${on}">${on ? "✔" : "○"} Can make now</button><span class="cqready">${on ? "Only gear an effect you know fits" : "Showing all your gear"}</span></div>`;
  }
  function enchMissing(blanks, known, gems) {
    const miss = [...(blanks ? [] : ["an unenchanted weapon or piece of armor"]), ...(known ? [] : ["a known effect (break enchanted gear here to learn one)"]), ...(gems ? [] : ["a filled soul gem (court wizards sell them)"])];
    return `<p class="sub"><span class="cqst no">Missing: ${esc(list(miss))}.</span></p>`;
  }
  /* the forge's group chips get a count of what you can make in each */
  function groupCount(s, g) {
    const n = SMITH.byGroup(g).filter((id) => can(s, "smith", id).n > 0).length;
    return n ? ` <b class="cqn">${n}</b>` : "";
  }

  // ---------------------------------------------------------------- clicks (ui.js routes every data-act starting with "cq" here)
  /* ui: { toast, openModal, closeModal, persist, renderPanel, tally, sound, guide, selectMix(rowIds), alchSel() } */
  function act(s, b, ui) {
    const a = b.dataset.act, k = b.dataset.k, id = b.dataset.id;
    if (a === "cqonly") { setOnly(s, !onlyCan(s)); ui.persist(); ui.renderPanel(true); return; }
    if (a === "cqfav") { const on = toggleFav(s, k, id); ui.persist(); ui.renderPanel(true); ui.toast(on ? "Pinned to the top." : "Unpinned."); return; }
    if (a === "cqmix") { ui.selectMix(pickRows(s, id.split("+")).filter((x) => x != null)); return; }
    if (a === "cqask") {
      const c = can(s, k, id), n = b.dataset.n === "max" ? c.n : Math.min(+b.dataset.n || 1, c.n);
      if (!n) return ui.toast(c.hard || `Missing: ${c.missing.join(", ")}.`);
      const what = k === "temper" ? `Improve ${esc(c.name)} ${n} step${n > 1 ? "s" : ""}` : k === "alch" ? `Brew ${n} × ${esc(c.name)}` : k === "cook" ? `Cook ${n} × ${esc(c.name)}` : `Make ${n} × ${esc(c.name)}`;
      const uses = c.mats.map(([l, per]) => `${per * n} ${esc(l)}`).join(", ");
      ui.openModal(`<h2>${what}?</h2><p>${c.out > 1 ? `You get ${c.out * n} in all. ` : ""}Uses ${uses}.</p>
        <p class="sub">Batches skip the mini-game and give the plain Quick craft result. Skill gains are exactly the same as making them one at a time.</p>
        <div class="grid2"><button class="btn pri" data-act="cqgo" data-k="${k}" data-id="${esc(id)}" data-n="${n}">${k === "temper" ? "Improve" : k === "cook" ? "Cook" : k === "alch" ? "Brew" : "Make"} ${n}</button><button class="btn" data-act="close">Cancel</button></div>`);
      return;
    }
    if (a === "cqgo") {
      ui.closeModal();
      const r = bulk(s, k, id, +b.dataset.n || 1, { rows: k === "alch" && ui.alchSel ? ui.alchSel() : [] });
      if (r.made) {
        if (k === "smith") { ui.guide?.("smith"); ui.tally?.("crafted", r.made); }
        if (k === "temper") ui.guide?.("smith");
        if (k === "cook") ui.guide?.("cook");
        if (k === "alch") ui.tally?.("potions", r.made);
        ui.sound?.(k === "cook" || k === "alch" ? "potion" : "clang");
        ui.persist(true);
      }
      ui.renderPanel(true);
      ui.toast(r.text);
    }
  }

  return { favs, isFav, toggleFav, onlyCan, setOnly, favMixes, mixKey, knownShared, need, can, craftOnce, bulk, order, bar, star, status, qty, cookList, alchTop, alchFilter, alchBulk, enchBlanks, enchBar, enchMissing, groupCount, act, MAX_LOOP };
})();
