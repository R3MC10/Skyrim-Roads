/* followertab.js: the follower gets their own tab in the Character menu (Skills · Character · Follower · Perks ...). [OURS]
   - The tab holds everything that used to sit at the bottom of the Character page: overview, bond, gear, magic,
     tactics, perks, fighting style and Dismiss (drawn by followers2.js), or a friendly "where to hire one" page.
   - Gear looks like the Items menu (SkyUI): their pack or yours, category filters with counts, a sortable list with
     columns (name, type, damage/armour, weight, value), ◆ on what's worn, and a details box with the stats and how it
     compares with what they wear now. Give / Take / Equip use the same rules as before (FOL2.give/takeBack/equip).
   - The Character page keeps one line about your follower that opens this tab.
   Nothing here changes game rules. Followers still get knocked down, never killed. */
const FOLTAB = (() => {
  const E = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const F2 = () => (typeof FOL2 !== "undefined" ? FOL2 : null);
  const itemOf = (r) => (r && typeof D !== "undefined" ? D.ITEMS[r.item] : null);
  const ARMOR = () => (typeof G !== "undefined" && G.ARMOR_SLOTS) || ["head", "chest", "hands", "feet", "shield"];
  const fmtW = (n) => (Math.round(n * 10) / 10).toString();

  // ------------------------------------------------------------ the list (pure, tested in node)
  const CATS = [["all", "All"], ["weapons", "Weapons"], ["apparel", "Armor"], ["potions", "Potions"], ["misc", "Other"]];
  const catOf = (it) => !it ? "misc" : it.slot === "weapon" || it.slot === "ammo" ? "weapons"
    : ARMOR().includes(it.slot) || it.slot === "ring" || it.slot === "amulet" ? "apparel"
    : ["potion", "poison", "food"].includes(it.slot) || it.restore ? "potions" : "misc";
  const SORTS = [["name", "Name"], ["type", "Type"], ["stat", "Dmg/Armor"], ["weight", "Weight"], ["value", "Value"]];
  const SKILL_SHORT = { "One-Handed": "1-hand", "Two-Handed": "2-hand", Archery: "Bow" };
  function typeOf(it) {
    if (!it) return "";
    if (it.slot === "weapon") return it.staff ? "Staff" : SKILL_SHORT[it.skill] || "Weapon";
    if (it.slot === "ammo") return it.ammo === "bolt" ? "Bolt" : "Arrow";
    if (["potion", "poison", "food"].includes(it.slot)) return it.slot === "poison" ? "Poison" : it.slot === "food" ? "Food" : "Potion";
    const f = F2(); if (f && f.wearable && f.wearable(it)) return f.slotName(it.slot);
    return it.slot ? it.slot[0].toUpperCase() + it.slot.slice(1) : "Misc";
  }
  const statOf = (r, it) => !it ? null : it.slot === "weapon" ? (it.damage || 0) + (r.temper || 0) : ARMOR().includes(it.slot) ? (it.armor || 0) + (r.temper || 0) : it.restore ? it.restore[1] : null;
  /* things from your pack worth handing over (same as before: gear, arrows, healing) */
  const giveable = (it) => !!it && !it.quest && ((F2()?.wearable?.(it)) || it.slot === "ammo" || !!it.restore || it.slot === "potion");
  /* rows for one side: "theirs" = the follower's pack, "yours" = your pack. Remigiusz: equipped gear never shows when
     trading with a follower, so what you wear is left out of Your pack (a pair with one worn shows the spare one). */
  function rows(s, side = "theirs", cat = "all", sort = "name", dir = 1) {
    const f = F2()?.st(s); if (!f) return [];
    const src = side === "yours" ? (G.handable ? G.handable(s) : s.inv || []).filter((r) => giveable(itemOf(r))) : f.inv;
    const on = side === "yours" ? new Set() : new Set(Object.values(f.eq || {}));
    const out = src.filter((r) => itemOf(r) && (cat === "all" || catOf(itemOf(r)) === cat)).map((r) => {
      const it = itemOf(r), st = statOf(r, it);
      return { id: r.id, r, it, name: (typeof NAMES !== "undefined" ? NAMES.improved : String)(it.name, r), type: typeOf(it), stat: st, weight: +((it.weight || 0) * r.qty).toFixed(2), value: it.value || 0, qty: r.qty || 1, eq: on.has(r.id), cat: catOf(it) };
    });
    return sortRows(out, sort, dir);
  }
  function sortRows(list, k = "name", dir = 1) {
    const txt = k === "name" || k === "type";
    return [...list].sort((a, b) => (b.eq - a.eq) || (txt ? String(a[k]).localeCompare(String(b[k])) * dir
      : a[k] == null && b[k] == null ? 0 : a[k] == null ? 1 : b[k] == null ? -1 : (b[k] - a[k]) * dir) || a.name.localeCompare(b.name));
  }
  function counts(s, side) { const n = { all: 0 }; for (const r of rows(s, side)) { n.all++; n[r.cat] = (n[r.cat] || 0) + 1; } return n; }
  /* where an item would go on them, and what's there now */
  function slotFor(f, it) {
    if (!it) return null;
    if (it.slot === "ring") { const ks = Object.keys(f.eq).filter((k) => /^ring/.test(k)); return ks[0] || "ring1"; }
    return it.slot === "weapon" ? "weapon" : it.slot;
  }
  /* compare a row with what the follower wears in that slot: { label, now: {name, v} | null, v, diff } or null */
  function compare(s, row) {
    const f = F2()?.st(s), it = row?.it; if (!f || !it || !F2().wearable(it)) return null;
    const slot = slotFor(f, it), cur = F2().worn(f, slot), ci = itemOf(cur);
    const label = it.slot === "weapon" ? "Damage" : ARMOR().includes(it.slot) ? "Armor" : "Value";
    const val = (r, i) => (label === "Value" ? i.value || 0 : statOf(r, i) || 0);
    const v = val(row.r, it);
    if (!ci) return { label, slot, now: null, v, diff: v };
    return { label, slot, now: { name: ci.name, v: val(cur, ci), same: cur.id === row.r.id && !row.mine }, v, diff: v - val(cur, ci) };
  }
  /* give from your pack, then put it on (one tap in the details) */
  function giveEquip(s, invId) {
    const f = F2()?.st(s); if (!f) return "No follower.";
    const row = G.invRow(s, invId), it = itemOf(row), before = f.next;
    const m = F2().give(s, invId, 1);
    const r = f.inv.find((x) => x.id >= before && x.item === row?.item);   // a worn kind of thing never stacks, so it's a new row
    return r && F2().wearable(it) ? `${m} ${F2().equip(s, r.id)}` : m;
  }

  // ------------------------------------------------------------ view state
  const ui = { side: "theirs", cat: "all", sort: "name", dir: 1, sel: null };
  let icon = () => "";
  function act(s, d) {
    switch (d.op) {
      case "ftside": ui.side = d.id === "yours" ? "yours" : "theirs"; ui.sel = null; return "";
      case "ftcat": ui.cat = d.id; ui.sel = null; return "";
      case "ftsort": if (ui.sort === d.id) ui.dir = -ui.dir; else { ui.sort = d.id; ui.dir = 1; } return "";
      case "ftdir": ui.dir = -ui.dir; return "";
      case "ftsel": ui.sel = ui.sel === +d.id ? null : +d.id; return "";
      case "ftgiveeq": { const m = giveEquip(s, +d.id); ui.sel = null; return m; }
    }
    return "";
  }

  // ------------------------------------------------------------ drawing (browser)
  const dirLabel = (k, dir) => (k === "name" || k === "type") ? (dir > 0 ? "A–Z" : "Z–A") : (dir > 0 ? "High first" : "Low first");
  function sortBar() {
    return `<div class="m2-sort ft-sort" role="group" aria-label="Sort"><span class="m2-sl">Sort</span><div class="m2-sc">${SORTS.map(([k, l]) => `<button class="chip ${k === ui.sort ? "on" : ""}" data-act="fol2" data-op="ftsort" data-id="${k}" aria-pressed="${k === ui.sort}">${l}</button>`).join("")}</div>`
      + `<button class="m2-dir" data-act="fol2" data-op="ftdir" aria-label="Sort direction: ${dirLabel(ui.sort, ui.dir)}"><b aria-hidden="true">${ui.dir > 0 ? "▼" : "▲"}</b><span>${dirLabel(ui.sort, ui.dir)}</span></button></div>`;
  }
  function detail(s, f, row, esc) {
    if (!row) return `<div class="m2-pick ft-pick"><p>Pick an item to see it here.</p></div>`;
    const it = row.it, r = row.r, mine = ui.side === "yours", F = F2(), nm = F.nameOf(s.follower.id);
    const st = [["Type", row.type]];
    if (it.slot === "weapon") st.push(["Damage", `${it.damage || 0}${r.temper ? ` (+${r.temper})` : ""}`], ["Hands", it.hands === 2 ? "Two" : "One"]);
    if (ARMOR().includes(it.slot)) st.push(["Armor", `${it.armor || 0}${r.temper ? ` (+${r.temper})` : ""}`], ["Weight class", it.type || "—"]);
    if (it.restore) st.push(["Restores", `${it.restore[1]} ${it.restore[0]}`]);
    st.push(["Weight", fmtW((it.weight || 0) * r.qty)], ["Value", it.value || 0]);
    if (r.qty > 1) st.push(["Count", r.qty]);
    const c = compare(s, { ...row, mine });
    const cmp = !c ? "" : c.now && c.now.same ? `<p class="sub ft-cmp">${esc(nm)} wears this now.</p>`
      : `<div class="ft-cmp"><span class="sub">${c.now ? `Compared with ${esc(c.now.name)} (worn now)` : `${esc(nm)} has nothing in that slot`}</span>
        <b class="num ${c.diff > 0 ? "up" : c.diff < 0 ? "down" : ""}">${esc(c.label)} ${c.now ? `${c.now.v} → ` : ""}${c.v}${c.diff ? ` (${c.diff > 0 ? "+" : ""}${c.diff})` : ""}</b></div>`;
    const acts = [];
    if (mine) {
      if (F.wearable(it) && !row.eq) acts.push(`<button class="btn pri" data-act="fol2" data-op="ftgiveeq" data-id="${r.id}">Give & equip</button>`);
      acts.push(`<button class="btn ${F.wearable(it) && !row.eq ? "" : "pri"}" data-act="fol2" data-op="give" data-id="${r.id}" data-q="1">Give</button>`);
      if (r.qty > 1) acts.push(`<button class="btn" data-act="fol2" data-op="give" data-id="${r.id}" data-q="${r.qty}">Give all (${r.qty})</button>`);
    } else {
      const slotOn = row.eq ? Object.keys(f.eq).find((k) => f.eq[k] === r.id) : null;
      if (F.wearable(it)) acts.push(row.eq ? `<button class="btn" data-act="fol2" data-op="uneq" data-id="${slotOn}">Take off</button>` : `<button class="btn pri" data-act="fol2" data-op="eq" data-id="${r.id}">Equip</button>`);
      if (F.wearable(it) && !row.eq && F.canOff(it) && f.eq.weapon) acts.push(`<button class="btn" data-act="fol2" data-op="eqoff" data-id="${r.id}">Left hand</button>`);
      acts.push(`<button class="btn" data-act="fol2" data-op="take" data-id="${r.id}" data-q="1">Take</button>`);
      if (r.qty > 1) acts.push(`<button class="btn" data-act="fol2" data-op="take" data-id="${r.id}" data-q="${r.qty}">Take all (${r.qty})</button>`);
    }
    const ico = typeof ICONART !== "undefined" ? ICONART.item(r.item, 56, r) : "";
    return `<div class="sky-detail ft-detail">${ico ? `<div class="sky-ico">${ico}</div>` : ""}<h3 class="q-${typeof RARITY !== "undefined" ? RARITY.of(r.item, r) : "common"}">${esc(row.name)}</h3>${typeof RARITY !== "undefined" ? `<p class="tierline q-${RARITY.of(r.item, r)}">${esc(RARITY.line(r.item, r))}</p>` : ""}
      <dl class="ft-stats">${st.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="num">${esc(v)}</dd>`).join("")}</dl>${typeof CHARGE !== "undefined" ? CHARGE.detail(r.item, r, mine ? s : null) : ""}${cmp}
      ${mine && row.eq ? `<p class="sub">You're wearing this. Take it off in Items first.</p>` : ""}<div class="sky-acts">${acts.join("")}</div></div>`;
  }
  /* the Gear view inside the follower panel */
  function gear(s, f, esc = E) {
    const F = F2(), list = rows(s, ui.side, ui.cat, ui.sort, ui.dir), cnt = counts(s, ui.side);
    const sel = list.find((r) => r.id === ui.sel) || null; if (!sel) ui.sel = null;
    const badge = (n) => typeof MENUS2 !== "undefined" ? MENUS2.badge(n) : n ? ` <b class="m2-n">${n}</b>` : "";
    const statH = { weapons: "Dmg", apparel: "Armor", potions: "Power" }[ui.cat] || "Stat";
    const head = `<div class="sky-head ft-cols"><button data-act="fol2" data-op="ftsort" data-id="name">Name</button><button class="ft-ty" data-act="fol2" data-op="ftsort" data-id="type">Type</button><button data-act="fol2" data-op="ftsort" data-id="stat">${statH}</button><button data-act="fol2" data-op="ftsort" data-id="weight">Wt</button><button data-act="fol2" data-op="ftsort" data-id="value">Value</button></div>`;
    const body = list.map((r) => `<button class="sky-row ft-cols ${r.id === ui.sel ? "sel" : ""} ${r.eq ? "eq" : ""}" data-act="fol2" data-op="ftsel" data-id="${r.id}" aria-pressed="${r.id === ui.sel}"><span class="nm q-${typeof RARITY !== "undefined" ? RARITY.of(r.r.item, r.r) : "common"}">${r.eq ? `<b class="eqm" title="${ui.side === "yours" ? "You wear this" : "Worn"}" aria-label="Equipped">◆</b>` : ""}${typeof ICONART !== "undefined" ? ICONART.item(r.r.item, 24, r.r) : ""}${esc(r.name)}${r.qty > 1 ? ` <i>(${r.qty})</i>` : ""}${r.it.enchant || r.it.aenchant ? ' <i class="ench">✦</i>' : ""}${typeof RARITY !== "undefined" ? RARITY.tag(r.r.item, r.r) : ""}${typeof CHARGE !== "undefined" ? CHARGE.tag(r.r.item, r.r, s) : ""}<small class="ft-ty2">${esc(r.type)}</small></span><span class="ft-ty">${esc(r.type)}</span><span class="num">${r.stat ?? "–"}</span><span class="num">${fmtW(r.weight)}</span><span class="num">${r.value}</span></button>`).join("")
      || `<p class="sub sky-empty">${ui.side === "yours" ? "Nothing in your pack they could use here." : "Their pack is empty here. Switch to Your pack to give them something."}</p>`;
    return `<div class="ft-gear">
      <div class="ft-bar"><div class="seg ft-side" role="tablist" aria-label="Whose pack">${[["theirs", "Their pack"], ["yours", "Your pack"]].map(([k, l]) => `<button class="${ui.side === k ? "on" : ""}" role="tab" aria-selected="${ui.side === k}" data-act="fol2" data-op="ftside" data-id="${k}">${esc(l)}</button>`).join("")}</div>
        <button class="btn sm" data-act="fol2" data-op="best">Best gear</button></div>
      <p class="sub ft-wt">Their load: ${fmtW(F.weight(f))}/${F.carry(f)} · potions they carry are drunk when they're badly hurt · archers never run out of arrows</p>
      <div class="sky-cats ft-cats" role="tablist">${CATS.map(([k, l]) => `<button class="sky-cat ${k === ui.cat ? "on" : ""}" data-act="fol2" data-op="ftcat" data-id="${k}" role="tab" aria-selected="${k === ui.cat}" aria-label="${l}">${icon(k)}<span>${l}</span>${badge(cnt[k] || 0)}</button>`).join("")}</div>
      ${sortBar()}${head}<div class="sky-list ft-list">${body}</div>${detail(s, f, sel, esc)}</div>`;
  }

  /* where to find someone, when nobody walks with you */
  function empty(s, esc = E) {
    const T = typeof TOWNS !== "undefined" ? TOWNS : null, F = F2();
    if (F) F.install();
    const all = T ? Object.entries(T.FOLLOWERS).filter(([, r]) => r[1]) : [];   // ones met on the road (no town) aren't hired
    const here = all.filter(([, r]) => r[1] === s.location);
    const need = (id) => id === "lydia" ? "Becomes yours when you're made Thane of Whiterun (bring Farengar the Dragonstone)." : F && F.NEEDS[id] ? (F.NEEDS[id] === "college" ? "Join the College of Winterhold first." : "Join the Companions first.") : "";
    const row = ([id, r]) => `<div class="item ft-hire">${typeof NPCART !== "undefined" ? NPCART.follower(id, 36) : ""}<div class="t">${esc(r[0])} <span class="num">${r[2] ? `${r[2]} gold` : "Free"}</span><span>${esc(r[1])} · ${esc(r[5] || "")}${need(id) ? ` ${esc(need(id))}` : ""}</span></div></div>`;
    return `<div class="panel ft-empty"><h2>Follower</h2>
      <p class="ft-lead">${s.pet ? "No follower with you right now." : "You're travelling alone for now."}</p>${typeof PETS === "undefined" && typeof MEEKO !== "undefined" && MEEKO.tabLine(s) ? `<p class="sub ft-meeko">${esc(MEEKO.tabLine(s))}</p>` : ""}
      <p class="sub">A follower fights beside you, carries some of your things, levels up with you and picks their own perks. They never die: when a fight goes badly they're knocked down and get back up after.</p>
      ${here.length ? `<div class="ft-here"><b>Here in ${esc(s.location)}:</b><div class="list">${here.map(row).join("")}</div><button class="btn sm pri" data-act="uxtab" data-id="town">Go to the inn (Area)</button></div>` : ""}
      <h3>Where to find one</h3><p class="sub">Look in the inn or hall of these towns, then hire them from the Area tab.</p>
      <div class="ft-hires">${towns(all.filter(([, r]) => r[1] !== s.location), esc)}</div></div>`;
  }
  /* the rest, grouped by town on one line each: "Riften: Marcurio (500 gold), Mjoll (free)" */
  function towns(list, esc) {
    const by = {};
    for (const [id, r] of list) (by[r[1]] = by[r[1]] || []).push([id, r]);
    return Object.keys(by).sort().map((t) => `<p class="ft-town"><b>${esc(t)}</b><span>${by[t].map(([, r]) => `${esc(r[0])} <i>${r[2] ? `${r[2]} gold` : "Free"}</i>`).join(" · ")}</span></p>`).join("");
  }
  /* the whole tab: two sections, Follower and Pet (pets.js), each with its own Dismiss */
  const petPart = (s, esc) => (typeof PETS !== "undefined" ? PETS.panel(s, esc) : "");
  function panel(s, esc = E, iconFn) {
    if (iconFn) icon = iconFn;
    const F = F2(); if (!F) return empty(s, esc) + petPart(s, esc);
    F.install();
    if (!s.follower || typeof TOWNS === "undefined" || !TOWNS.FOLLOWERS[s.follower.id] || (typeof PETS !== "undefined" && PETS.isPet(s.follower.id))) return empty(s, esc) + petPart(s, esc);
    return F.panel(s, esc) + petPart(s, esc);
  }
  /* one line on the Character page */
  function summary(s, esc = E) {
    const F = F2(), pet = typeof PETS !== "undefined" ? PETS.summary(s, esc) : "";
    if (!F || !s.follower || typeof TOWNS === "undefined" || !TOWNS.FOLLOWERS[s.follower.id]) return pet;
    const id = s.follower.id, f = F.st(s);
    return `<button class="item ft-line" data-act="tabgo" data-id="follower">${typeof NPCART !== "undefined" ? NPCART.follower(id, 28) : ""}<div class="t">${esc(F.nameOf(id))} <span class="num">Lv ${f.lvl}</span><span>${Math.round(TOWNS.followerHp(s))}/${F.maxHp(s, id)} health · Follower tab ›</span></div></button>` + pet;
  }
  return { CATS, SORTS, catOf, typeOf, giveable, rows, sortRows, counts, compare, giveEquip, act, gear, empty, panel, summary, ui };
})();
if (typeof module !== "undefined") module.exports = FOLTAB;
