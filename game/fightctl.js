/* Fight controls: the action bar at the bottom of the turn-based fight screen. [OURS]
   Remigiusz: "Combat controls should be AAA."
   tbfight.js still runs the fight; this module only draws the controls and makes them feel good:
   - Big thumb-sized buttons with drawn icons: Attack / Power attack / Guard (or Shield bash).
   - Every move shows what it costs in stamina (green), magicka (blue) or health (red); hovering or pressing a move
     lights up the move pip it would use (up to 4 moves a turn, the same move again costs more).
   - A greyed-out move says why ("Need 12 more stamina", "4 moves a turn", "None left"...).
   - Quick slots above the big buttons: your shouts and favourite spells, potions and scrolls (★ in the Magic and Items
     lists pins them; until you pin any, the bar suggests your best heal, best attack spell and a health potion).
   - Healing and support moves ask who gets them when you have teammates: tap a portrait (or the button again for
     yourself). Dragging still works as before (tbui.js).
   - Press feedback (glow, a small squash, a short buzz on phones), the bar rises in at the start of your turn and the
     move pip you just used bursts away.
   - PC keys: 1-9 and 0 the hotbar slots (hotbar.js), Space ends the turn (or hurries the foe's turn / continues), R Breathe (no F key any more: build 146), M magic, I items, Esc back or cancel.
   The old cards and the combat wheel are still there: Settings → Fights → Controls. */
const FIGHTCTL = (() => {
  const DOM = typeof document !== "undefined";
  const FAVKEY = "rotn_fcfav";
  const MAXQ = 6;
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const prefs = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}"); } catch { return {}; } };
  const buzz = (ms) => { try { if (!(DOM && document.documentElement.classList.contains("a11y-still"))) navigator.vibrate?.(ms); } catch { /* no vibration */ } };
  /* on unless switched off in Settings, or the page asks for the wheel (?wheel, the wheel's own screen test) */
  function on() {
    if (DOM && typeof location !== "undefined" && /[?&]wheel\b/.test(location.search)) return false;
    return prefs().tbDock !== false;
  }

  // ------------------------------------------------------------------ favourites (quick slots)
  function favs() { try { const v = JSON.parse(localStorage.getItem(FAVKEY) || "null"); return Array.isArray(v) ? v : null; } catch { return null; } }
  function setFavs(L) { try { localStorage.setItem(FAVKEY, JSON.stringify(L.slice(0, 12))); } catch { /* ignore */ } }
  const isFav = (a) => (favs() || []).includes(a);
  function toggleFav(a, f) {
    // the first pin keeps what the slots already showed (the suggestions), so nothing useful vanishes
    const L = favs() || (f ? quick(f).filter((x) => !/^(shout|power):/.test(x.a)).map((x) => x.a) : []), i = L.indexOf(a);
    if (i >= 0) L.splice(i, 1); else L.push(a);
    setFavs(L);
    return i < 0;
  }
  /* what the quick slots hold: shouts you can use, then your pins (or, if you never pinned, the favourites wheel's
     spells and potions, else a few suggestions) */
  function quick(f) {
    const s = f.s, out = [], seen = new Set();
    const add = (a, sugg) => { if (!a || seen.has(a) || out.length >= MAXQ) return; if (!valid(f, a)) return; seen.add(a); out.push({ a, sugg }); };
    for (const a of ["shout:fus", "shout:yol", "shout:fo", "power:racial"]) { try { if (f.pw && f.affordable(a)) add(a); } catch { /* not known */ } }
    const L = favs();
    if (L) L.forEach((a) => add(a));
    else {
      const wheel = Array.isArray(s.favs) ? s.favs : [];
      for (const e of wheel) {
        if (e.k === "spell") add("spell:" + e.id);
        else if (e.k === "item" && D.ITEMS[e.id]?.restore?.[0]) add("potion:" + D.ITEMS[e.id].restore[0]);
      }
      if (out.length < 3) suggest(f).forEach((a) => add(a, true));
    }
    return out;
  }
  function valid(f, a) {
    const [k, arg] = a.split(":");
    if (k === "spell" || k === "dual") return (f.s.spells || []).includes(arg) && !!D.SPELLS[arg] && D.SPELLS[arg].kind !== "utility";
    if (k === "potion") return potCount(f, arg) > 0;
    if (k === "scroll") { try { return !!f.findItem(arg); } catch { return false; } }
    return k === "shout" || k === "power";
  }
  const tierN = { Novice: 1, Apprentice: 2, Adept: 3, Expert: 4, Master: 5 };
  function suggest(f) {
    const sp = (f.s.spells || []).map((id) => [id, D.SPELLS[id]]).filter(([, x]) => x && x.kind !== "utility");
    const best = (pred) => sp.filter(([, x]) => pred(x)).sort((a, b) => (tierN[b[1].level] || 1) - (tierN[a[1].level] || 1) || (b[1].amount || 0) - (a[1].amount || 0))[0];
    const heal = best((x) => x.kind === "heal"), hit = best((x) => x.element && x.element !== "none" && x.kind !== "heal");
    return [heal && "spell:" + heal[0], hit && "spell:" + hit[0], "potion:health"].filter(Boolean);
  }
  function potCount(f, kind) {
    let n = 0;
    try { for (const r of f.s.inv) if (D.ITEMS[r.item]?.slot === "potion" && D.ITEMS[r.item].restore?.[0] === kind) n += Math.max(0, f.left ? f.left(r.id) : r.qty); } catch { /* none */ }
    return n;
  }

  // ------------------------------------------------------------------ why a move is greyed out
  function reason(sess, a, c) {
    const f = sess.f;
    const [k, arg] = a.split(":");
    try {
      const w = sess.why ? sess.why(a) : ""; if (w) return w;
      if (typeof STRAT !== "undefined" && STRAT.owns(a)) return STRAT.why(f, a);
      if (typeof REACT !== "undefined" && REACT.owns(a)) return REACT.why(f, a);   // reactions.js
      if (a === "flee") return f.e.boss ? "Not from a boss" : !f.canFlee ? "No way out here" : "";
      if (typeof MOUNTFIGHT !== "undefined") { const mw = MOUNTFIGHT.why(f, a); if (mw) return mw; }   // the saddle
      if (a === "power_attack") return "Not enough stamina";
      if (a === "block") return f.weapon && f.weapon.skill === "Archery" ? "Not with a bow" : "Not enough stamina";
      if (a === "bash") return "Not enough stamina";
      if (k === "spell" || k === "dual") {
        const sp = D.SPELLS[arg]; if (!sp) return "Unknown";
        const need = (typeof G.spellCost === "function" ? G.spellCost(f.s, sp) : sp.cost) * (k === "dual" ? (typeof MAGIC !== "undefined" ? MAGIC.DUAL_COST : 2.2) : 1);
        return f.mp < need ? `Need ${Math.ceil(need - f.mp)} more magicka` : "";
      }
      if (k === "potion") return typeof CURSE !== "undefined" && CURSE.noPotions && CURSE.noPotions(f) ? "Not in Beast Form" : potCount(f, arg) ? "" : "None left";
      if (k === "scroll") return "None left";
      if (k === "shout" || k === "power") return "Not ready yet";
      if (typeof BEASTPATH !== "undefined" && BEASTPATH.why) { const w = BEASTPATH.why(f, a); if (w) return w; }
    } catch { /* fall through */ }
    return "";
  }

  // ------------------------------------------------------------------ icons (drawn; emoji fallback)
  function iconFor(f, a, api, size = 34) {
    if (typeof UIART === "undefined") return `<span class="em">${api.iconOf(f, a)}</span>`;
    try {
      const sk = f.weapon?.skill || (f.wt === "bow" || f.wt === "crossbow" ? "Archery" : "Hand-to-Hand");
      if (/^(beast|lord|vamp|rx):|^power:(beast|lord)$/.test(a)) return `<span class="em">${api.iconOf(f, a)}</span>`;   // a werewolf's / vampire's own moves (beastpaths.js)
      if (a === "attack") return UIART.skill(sk, size);
      if (a === "power_attack") return UIART.skill(sk === "Archery" ? "Archery" : "Two-Handed", size);
      if (a === "magic") return UIART.skill("Destruction", size);
      if (a === "items") return UIART.action("potion:health", size);
      const [k, arg] = a.split(":");
      if (k === "spell" || k === "dual") return UIART.spell(arg, size) || `<span class="em">${api.iconOf(f, a)}</span>`;
      return UIART.action(a, size);
    } catch { return `<span class="em">${api.iconOf(f, a)}</span>`; }
  }

  // ------------------------------------------------------------------ the bar
  let last = { key: null, left: 0 }, dockKey = null, filter = "all";
  const pipsHTML = (c) => (typeof TB !== "undefined" && TB.costHTML ? TB.costHTML(c) : "");
  const cTxt = (c) => (typeof TB !== "undefined" && TB.costTxt ? TB.costTxt(c) : "");
  const guardOf = (sess) => Math.round((sess.guardLeft ? sess.guardLeft() : 0) * 100);
  const keyLbl = (k) => (k ? `<kbd class="fc-k" aria-hidden="true">${k === " " ? "Space" : esc(k)}</kbd>` : "");
  /* one button. o: {label, extra, key, sub, icon, badge} */
  function btn(sess, api, a, o = {}) {
    const f = sess.f, c = api.cost(f, a, sess), ok = sess.canAfford(a), z = api.zoneOf(a), why = ok ? "" : reason(sess, a, c);
    const tipT = typeof TBTIPS !== "undefined" ? TBTIPS.action(f, a, c) : "";
    const tip = (why ? why + ". " : "") + tipT;
    const sp = /^(spell|dual|scroll):/.test(a) ? 1 : 0;
    return `<button class="tbact fc-b ${o.extra || ""}${ok ? "" : " off"}" data-tba="${esc(a)}"${z ? ` data-tz="${z}"` : ""} data-c="1" data-sp="${sp}"${o.key ? ` data-fk="${esc(o.key)}"` : ""}${tip ? ` data-tip="${esc(tip)}"` : ""} aria-label="${esc(o.label)}, ${esc(cTxt(c))}${why ? `, ${esc(why)}` : ""}" ${ok ? "" : "disabled"}>
      <span class="ic" aria-hidden="true">${o.icon || iconFor(f, a, api)}</span><b>${esc(o.label)}</b>${why ? `<small class="fc-why">${esc(why)}</small>` : o.sub ? `<small>${esc(o.sub)}</small>` : ""}<span class="cp" aria-hidden="true">${pipsHTML(c)}</span>${o.badge != null ? `<span class="fc-n">${esc(o.badge)}</span>` : ""}${keyLbl(o.key)}</button>`;
  }
  function shortName(f, a) {
    const [k, arg] = a.split(":");
    if (k === "spell" || k === "dual") return (k === "dual" ? "Dual " : "") + (D.SPELLS[arg]?.name || arg);
    if (k === "potion") return arg[0].toUpperCase() + arg.slice(1);
    if (k === "scroll") return (D.ITEMS[arg]?.name || "Scroll").replace(/^Scroll of /i, "");
    if (k === "shout") return arg.toUpperCase();
    if (k === "power") return "Power";
    if (a === "mount" || a === "dismount") return a === "mount" ? "Mount" : "Dismount";
    if (k === "rx" && typeof REACT !== "undefined") { const m = REACT.moves(f).find((x) => x[0] === a); if (m) return m[1]; }   // Oil flask, Mark target, Cover allies
    return a;
  }
  function dock(sess, api) {
    const f = sess.f, s = f.s;
    const key = sess.round + ":" + sess.idx, enter = key !== dockKey;
    if (enter && dockKey !== null) buzz(18);
    dockKey = key;
    if (api.menu === "magic" || api.menu === "items") return picker(sess, api, enter);
    const bx = typeof BEASTPATH !== "undefined" ? BEASTPATH.moves(f) : { form: null, list: [] };   // Beast Form / Vampire Lord / vampire powers (beastpaths.js)
    if (bx.form) return beastDock(sess, api, bx, enter);
    if (typeof HOTBAR !== "undefined") return hotDock(sess, api, enter);   // hotbar.js: 10 slots you set up yourself, keys 1-0
    const bow = f.wt === "bow" || f.wt === "crossbow";
    const guard = f.shield && typeof SHIELDFX !== "undefined" ? ["bash", "Shield bash"] : ["block", "Guard"];
    const main = [btn(sess, api, "attack", { label: bow ? "Shoot" : "Attack", extra: "main big", key: "1" }),
      btn(sess, api, "power_attack", { label: "Power attack", extra: "main big pw", key: "2" }),
      btn(sess, api, guard[0], { label: guard[1], extra: "main big gd", key: "3" })].join("");
    const q = quick(f);
    for (const [a] of bx.list) if (q.length < MAXQ + 2 && !q.some((x) => x.a === a)) q.unshift({ a });
    if (typeof MOUNTFIGHT !== "undefined") for (const [a] of MOUNTFIGHT.moves(f)) q.unshift({ a });   // Mount / Dismount (mountfight.js)
    if (typeof REACT !== "undefined") for (const [a] of REACT.moves(f)) if ((REACT.worth ? REACT.worth(f, a) : REACT.can(f, a)) && !q.some((x) => x.a === a)) q.push({ a });   // Oil flask, Mark target, Cover allies (reactions.js): only when they are worth it, the tray stays short
    const tray = q.map((x, i) => btn(sess, api, x.a, { label: shortName(f, x.a), extra: "fc-q" + (x.sugg ? " sugg" : "") + (/^(shout|power):/.test(x.a) ? " shout" : ""), key: String(4 + i), badge: x.a.startsWith("potion:") ? potCount(f, x.a.split(":")[1]) : null })).join("");
    const nSp = (s.spells || []).filter((id) => D.SPELLS[id] && D.SPELLS[id].kind !== "utility").length;
    const nPot = ["health", "magicka", "stamina"].reduce((t, k) => t + potCount(f, k), 0);
    const menuB = (m, label, sub, k, ic) => `<button class="tbact menu fc-m" data-tbm="${m}" data-fk="${k}" aria-label="${label}, ${sub}"><span class="ic" aria-hidden="true">${ic}</span><b>${label}</b><small>${sub}</small>${keyLbl(k)}</button>`;
    const end = endBtn(sess, f);
    return `<div class="fc${enter ? " enter" : ""}" data-fcmode="main">
      <div class="fc-tray" role="group" aria-label="Quick slots" style="--n:${Math.max(3, q.length)}">${tray || `<p class="fc-empty">Quick slots: tap ★ next to a spell or potion to pin it here</p>`}</div>
      <div class="tbgrid fc-main">${main}</div>
      <div class="fc-row">${menuB("magic", "Magic", `${nSp} spell${nSp === 1 ? "" : "s"}`, "M", iconFor(f, "magic", api, 26))}${menuB("items", "Items", `${nPot} potion${nPot === 1 ? "" : "s"}`, "I", iconFor(f, "items", api, 26))}${typeof STRAT !== "undefined" ? btn(sess, api, "recover", { label: "Breathe", extra: "rec fc-m", key: "R" }) : ""}${btn(sess, api, "flee", { label: "Flee", extra: "flee fc-m" })}${end}</div>
    </div>`;
  }
  /* the hotbar (hotbar.js) and beside it Magic, Items, Flee and End turn */
  function hotDock(sess, api, enter) {
    const f = sess.f, s = f.s;
    const ui = { btn, icon: (ff, a, sz) => iconFor(ff, a, api, sz || 34) };
    if (HOTBAR.editing) return `<div class="fc fc-hb hb-on${enter ? " enter" : ""}" data-fcmode="edit">${HOTBAR.bar(sess, api, ui)}</div>`;
    const nSp = (s.spells || []).filter((id) => D.SPELLS[id] && D.SPELLS[id].kind !== "utility").length;
    const nPot = ["health", "magicka", "stamina"].reduce((t, k) => t + potCount(f, k), 0);
    const menuB = (m, label, sub, k, ic) => `<button class="tbact menu fc-m" data-tbm="${m}" data-fk="${k}" aria-label="${label}, ${sub}"><span class="ic" aria-hidden="true">${ic}</span><b>${label}</b><small>${sub}</small>${keyLbl(k)}</button>`;
    const extra = (typeof MOUNTFIGHT !== "undefined" ? MOUNTFIGHT.moves(f) : []).map(([a, n]) => btn(sess, api, a, { label: n, extra: "fc-m mount" })).join("");
    return `<div class="fc fc-hb${enter ? " enter" : ""}" data-fcmode="main">
      ${HOTBAR.bar(sess, api, ui)}
      <div class="hb-side">${menuB("magic", "Magic", `${nSp} spell${nSp === 1 ? "" : "s"}`, "M", iconFor(f, "magic", api, 26))}${menuB("items", "Items", `${nPot} potion${nPot === 1 ? "" : "s"}`, "I", iconFor(f, "items", api, 26))}${extra}${btn(sess, api, "flee", { label: "Flee", extra: "flee fc-m" })}${endBtn(sess, f)}</div>
    </div>`;
  }
  /* changed into a beast or a Vampire Lord: the form's own moves, big; no magic or items (beastpaths.js) */
  function beastDock(sess, api, bx, enter) {
    const f = sess.f;
    const big = bx.list.slice(0, 3), rest = bx.list.slice(3);
    const main = big.map(([a, n], i) => btn(sess, api, a, { label: n, extra: "main big beast", key: String(i + 1) })).join("");
    const tray = rest.map(([a, n], i) => btn(sess, api, a, { label: n, extra: "fc-q beast", key: String(4 + i) })).join("");
    const end = endBtn(sess, f);
    return `<div class="fc fc-beast ${bx.form}${enter ? " enter" : ""}" data-fcmode="${bx.form}">
      <div class="fc-tray" role="group" aria-label="${bx.form === "wolf" ? "Beast Form" : "Vampire Lord"} moves" style="--n:${Math.max(3, rest.length)}">${tray}</div>
      <div class="tbgrid fc-main">${main}</div>
      <div class="fc-row"><span class="fc-form">${bx.form === "wolf" ? " Beast Form" : " Vampire Lord"} · ${bx.left} round${bx.left === 1 ? "" : "s"} left</span>${btn(sess, api, "flee", { label: "Flee", extra: "flee fc-m" })}${end}</div>
    </div>`;
  }
  /* the magic / items list: tabs, filters by school, ★ to pin, numbered Cast buttons */
  function picker(sess, api, enter) {
    const f = sess.f, s = f.s, m = api.menu;
    let n = 0;
    const star = (a) => `<button class="fc-star${isFav(a) ? " on" : ""}" data-fc="fav" data-a="${esc(a)}" aria-pressed="${isFav(a)}" aria-label="${isFav(a) ? "Unpin from" : "Pin to"} quick slots">★</button>`;
    let body = "", chips = "";
    if (m === "magic") {
      const ids = (s.spells || []).filter((id) => D.SPELLS[id] && D.SPELLS[id].kind !== "utility");
      const schools = [...new Set(ids.map((id) => D.SPELLS[id].school).filter(Boolean))];
      if (filter !== "all" && filter !== "fav" && !schools.includes(filter)) filter = "all";
      chips = ids.length > 3 ? `<div class="fc-chips" role="group" aria-label="Filter">${[["all", "All"], ["fav", "★"], ...schools.map((x) => [x, x])].map(([v, l]) => `<button class="fc-chip${filter === v ? " on" : ""}" data-fc="filter" data-v="${esc(v)}" aria-pressed="${filter === v}">${esc(l)}</button>`).join("")}</div>` : "";
      const shown = ids.filter((id) => filter === "all" || (filter === "fav" ? isFav("spell:" + id) || isFav("dual:" + id) : D.SPELLS[id].school === filter));
      body = shown.map((id) => {
        const sp = D.SPELLS[id], mc = typeof G.spellCost === "function" ? Math.round(G.spellCost(s, sp)) : sp.cost;
        const dual = typeof MAGIC !== "undefined" && MAGIC.dualable && MAGIC.dualable(sp);
        const k = ++n <= 9 ? String(n) : "";
        return `<div class="tbsp fc-row2"><span class="nm el-${esc(sp.element || "none")}"><span class="fc-sic" aria-hidden="true">${iconFor(f, "spell:" + id, api, 30)}</span><span class="fc-nm">${esc(sp.name)}<small>${esc(api.tierOf(id, sp))} · ${mc} magicka</small></span></span>${star("spell:" + id)}${btn(sess, api, "spell:" + id, { label: "Cast", extra: "fc-cast", key: k, icon: " " })}${dual ? btn(sess, api, "dual:" + id, { label: "Dual", extra: "fc-cast", icon: " " }) : `<span></span>`}</div>`;
      }).join("") || `<p class="sub">${ids.length ? "Nothing here. Pick another filter, or ★ a spell." : "You don't know any fighting spells yet."}</p>`;
    } else {
      const rows = [];
      for (const r of ["health", "magicka", "stamina"]) if (potCount(f, r)) rows.push(["potion:" + r, `${r[0].toUpperCase() + r.slice(1)} potion`, `${potCount(f, r)} left`]);
      const scrolls = [...new Set(s.inv.filter((r) => D.ITEMS[r.item]?.spell && f.left(r.id) > 0).map((r) => r.item))].slice(0, 6);
      for (const it of scrolls) rows.push(["scroll:" + it, D.ITEMS[it].name, "scroll"]);
      body = rows.map(([a, name, sub]) => {
        const k = ++n <= 9 ? String(n) : "";
        return `<div class="tbsp fc-row2"><span class="nm"><span class="fc-sic" aria-hidden="true">${iconFor(f, a, api, 30)}</span><span class="fc-nm">${esc(name)}<small>${esc(sub)}</small></span></span>${star(a)}${btn(sess, api, a, { label: a.startsWith("potion:") ? "Drink" : "Read", extra: "fc-cast", key: k, icon: " " })}<span></span></div>`;
      }).join("") || `<p class="sub">No potions or scrolls.</p>`;
    }
    const tab = (id, label) => `<button class="fc-tab${m === id ? " on" : ""}" data-tbm="${id}" aria-pressed="${m === id}"><span class="ic" aria-hidden="true">${iconFor(f, id, api, 20)}</span>${label}</button>`;
    return `<div class="fc fc-pick${enter ? " enter" : ""}" data-fcmode="${m}">
      <div class="tbmenu fc-sheet">
        <div class="tbmh fc-head"><div class="fc-tabs" role="tablist">${tab("magic", "Magic")}${tab("items", "Items")}</div><small>${m === "magic" ? "Tap Cast, or drag onto a target" : "Tap to use, or drag onto someone"} · ★ pins to quick slots</small></div>
        ${chips}<div class="fc-list">${body}</div>
        <button class="tbact back fc-back" data-tbm="" aria-label="Back to moves">‹ Back${keyLbl("Esc")}</button>
      </div>
    </div>`;
  }

  /* End turn: a big clear button that says what holding back is worth */
  function endBtn(sess, f) {
    const g = guardOf(sess);
    const endTip = typeof TBTIPS !== "undefined" ? ` data-tip="${esc(TBTIPS.action(f, "end", 0))}"` : "";
    return `<button class="tbact end fc-end${g > 0 ? "" : " ready"}" data-tba="end" data-fk=" "${endTip} aria-label="End turn${g > 0 ? `, +${g}% guard` : ""}">
      <span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 5l8 7-8 7z M13 5l8 7-8 7z" fill="currentColor"/></svg></span><b>End turn</b><small>${g > 0 ? `+${g}% guard` : "ready"}</small>${keyLbl(" ")}</button>`;
  }
  /* the top row of your turn: moves left (used ones burst away) and "Your turn". Stamina / magicka / health live in
     the orb (fightdeclutter.js: one place for each number), so no coloured numbers here any more. */
  function apHTML(sess) {
    const key = sess.round + ":" + sess.idx, same = key === last.key, acts = sess.st.acts || 4, left = Math.max(0, acts - (sess.myActs || 0));
    const lost = same ? Math.max(0, last.left - left) : 0;
    last = { key, left };
    const row = Array.from({ length: acts }, (_, i) => `<i class="${i < left ? "on " : i < left + lost ? "lost " : ""}ap"></i>`).join("");
    return `<span class="fc-apl">Moves</span><span class="fc-pips" data-k="ap">${row}</span><b class="fc-apn num">${left}<small>/${acts}</small></b><em>Your turn${sess.until ? ` <b class="num" id="tbcd">${Math.max(0, Math.ceil((sess.until - Date.now()) / 1000))}s</b>` : ""}</em>`;
  }

  // ------------------------------------------------------------------ settings row (Settings → Fights)
  function settingsHTML(seg) {
    if (typeof seg !== "function") return "";
    return `<div class="setrow"><span>Controls</span>${seg("tbDock", [[true, "Action bar"], [false, "Cards / wheel"]], prefs().tbDock !== false)}</div>${typeof MINIGAME !== "undefined" ? MINIGAME.settingsHTML(seg) : ""}`;
  }

  // ------------------------------------------------------------------ clicks that are ours (stars, filters); tbfight.js redraws after
  function click(b) {
    const w = b.dataset.fc;
    if (w === "fav") { const on = toggleFav(b.dataset.a, typeof TB !== "undefined" ? TB.session?.f : null); buzz(12); return on; }
    if (w === "filter") { filter = b.dataset.v || "all"; return true; }
    return false;
  }

  // ------------------------------------------------------------------ choosing a target for healing / support
  let aim = null;
  const root = () => (DOM ? document.getElementById("tbf") : null);
  function needsTarget(b) {
    const r = root(); if (!r || !b.dataset.tz || b.disabled) return null;
    const a = b.dataset.tba, z = b.dataset.tz;
    if (z === "foe" || !r.querySelector(".tbu.ally")) return null;
    if (z === "self") {
      const sp = /^(spell|dual|scroll):/.test(a) ? (() => { const [k, arg] = a.split(":"); return k === "scroll" ? D.SPELLS[D.ITEMS[arg]?.spell] : D.SPELLS[arg]; })() : null;
      const heal = a === "potion:health" || sp?.kind === "heal";
      if (!heal || !r.querySelector('.tbu.ally[data-tbzone~="self"]')) return null;
    }
    return z;
  }
  function startAim(b, z) {
    const r = root(); if (!r) return;
    cancelAim();
    aim = { b, a: b.dataset.tba, z };
    r.classList.add("fc-aiming", "dz-" + z);
    r.querySelectorAll(`[data-tbzone~="${z}"]`).forEach((e) => { if (e.classList.contains("tbu")) e.classList.add("drop-ok", "fc-tgt"); });
    b.classList.add("fc-armed");
    const bar = document.createElement("div"); bar.className = "fc-aimbar"; bar.setAttribute("role", "status");
    /* one button per target right in the bar: on phones an open menu (Magic, Items) covers the portraits */
    const T = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);
    const who = [...r.querySelectorAll(".tbu.fc-tgt")].map((e) => {
      const me = e.classList.contains("me"), nm = me ? T("You") : (e.querySelector(".nm")?.firstChild?.textContent || "").replace(/^[-\s]+/, "").trim();
      return `<button class="fc-who fc-tgt${me ? " me" : ""}"${me ? "" : ` data-ally="${esc(e.dataset.ally)}"`}>${esc(nm || "?")}</button>`;
    }).join("");
    const what = esc(b.closest(".tbsp")?.querySelector(".fc-nm")?.firstChild?.textContent || b.querySelector("b")?.textContent || "");
    bar.innerHTML = `<span>${what ? `<b>${what}</b> ` : ""}<em>${esc(T(who ? "Who gets it? Tap a name, their plate or them in the scene." : "Who gets it? Tap a portrait."))}</em></span><button class="fc-cancel" data-fcx="cancel" aria-label="Cancel">✕</button>${who ? `<div class="fc-whos">${who}</div>` : ""}`;
    r.appendChild(bar); aim.bar = bar;
    buzz(10);
  }
  function cancelAim() {
    if (!aim) return;
    const r = root();
    r?.classList.remove("fc-aiming", "dz-self", "dz-ally");
    r?.querySelectorAll(".fc-tgt").forEach((e) => e.classList.remove("drop-ok", "fc-tgt"));
    aim.b?.classList.remove("fc-armed"); aim.bar?.remove();
    aim = null;
  }
  function fireAim(zone) {
    const r = root(), x = aim; if (!r || !x) return;
    cancelAim();
    if (!x.b.isConnected) return;
    if (zone && zone.dataset.ally != null) r.dataset.tbt = zone.dataset.ally; else delete r.dataset.tbt;
    zone?.classList.add("fc-hitme"); buzz(14);
    x.b.click();
  }
  /* a key press on a move: the same as a tap, so a heal with teammates around asks who gets it */
  function press(b) {
    if (aim && aim.b === b) return b.click();   // the same key again: on yourself
    const z = root()?.dataset.tbt == null ? needsTarget(b) : null;
    if (z) startAim(b, z); else b.click();
  }
  /* [magicaim] a tap on someone's figure in the fight scene (fightpos.js knows where everyone stands): their plate */
  function sceneTgt(r, ev) {
    if (typeof FIGHTPOS === "undefined" || ev.clientX == null || !ev.target.closest?.(".tbstage")) return null;
    const cv = r.querySelector(".fscene canvas"), L = cv && cv.__fp, f = typeof TB !== "undefined" ? TB.session?.f : null;
    if (!L || !f) return null;
    const hit = (who) => {
      const p = FIGHTPOS.screenOf(cv, who); if (!p) return Infinity;
      const m = 6 * p.s;
      return ev.clientX >= p.left - m && ev.clientX <= p.right + m && ev.clientY >= p.top - m && ev.clientY <= p.y + m ? Math.abs(ev.clientX - p.x) : Infinity;
    };
    let best = null, bd = Infinity;
    for (const card of r.querySelectorAll(".tbu.ally.fc-tgt[data-ally]")) {
      const i = +card.dataset.ally, a = i >= 1000 ? (f._downed || [])[i - 1000] : (f.allies || [])[i];
      const d = a && a.name ? hit(a.name) : Infinity;
      if (d < bd) { bd = d; best = card; }
    }
    const me = r.querySelector(".tbu.me.fc-tgt");
    if (me) { const d = hit("me"); if (d < bd) { bd = d; best = me; } }
    return best;
  }
  function onClickCap(ev) {
    const r = root(); if (!r || !r.contains(ev.target)) { if (aim && !r) aim = null; return; }
    if (aim) {
      if (!aim.b.isConnected) { cancelAim(); return; }
      if (ev.target.closest("[data-fcx=cancel]")) { ev.stopImmediatePropagation(); ev.preventDefault(); cancelAim(); return; }
      const zone = ev.target.closest(".fc-tgt") || sceneTgt(r, ev);
      const sameBtn = ev.target.closest("button") === aim.b;
      if (zone || (sameBtn && aim.z === "self")) {
        ev.stopImmediatePropagation(); ev.preventDefault();
        fireAim(zone && zone.classList.contains("me") ? null : zone);
        return;
      }
      if (ev.isTrusted) cancelAim();   // tapped something else: that wins
      return;
    }
    if (!ev.isTrusted) return;         // a drop from tbui.js or a key press: it already knows its target
    const b = ev.target.closest("#tbf .tbact[data-tba]"); if (!b) return;
    if (r.dataset.tbt != null) return;
    const z = needsTarget(b); if (!z) return;
    ev.stopImmediatePropagation(); ev.preventDefault();
    startAim(b, z);
  }

  // ------------------------------------------------------------------ press feedback, move preview, foe highlight
  function preview(b) {
    const r = root(); if (!r) return;
    r.querySelectorAll(".tbap .pv").forEach((i) => i.classList.remove("pv"));
    r.querySelector(".tbap")?.classList.remove("short");
    r.classList.remove("fc-aimfoe");
    if (!b || b.disabled || !b.dataset.c) return;
    if (b.dataset.tz === "foe") r.classList.add("fc-aimfoe");
    let c = +b.dataset.c || 0;
    const on = [...r.querySelectorAll(`.tbap .fc-pips[data-k="ap"] i.on`)].reverse(); for (const i of on) { if (c <= 0) break; i.classList.add("pv"); c--; }
    if (c > 0) r.querySelector(".tbap")?.classList.add("short");
  }
  function down(ev) {
    const b = ev.target.closest?.("#tbf .tbact, #tbf .fc-star, #tbf .fc-chip, #tbf .fc-tab, #tbf .tbskip, #tbf .tbdone");
    if (!b || b.disabled) return;
    b.classList.remove("fc-press"); void b.offsetWidth; b.classList.add("fc-press");
    const rc = b.getBoundingClientRect();
    b.style.setProperty("--px", (ev.clientX - rc.left) + "px"); b.style.setProperty("--py", (ev.clientY - rc.top) + "px");
    if (ev.pointerType !== "mouse") buzz(8);
    if (b.classList.contains("tbact")) preview(b);
  }
  function up() { const r = root(); if (!r) return; setTimeout(() => { if (!r.matches(":hover")) preview(null); r.querySelectorAll(".fc-press").forEach((b) => b.classList.remove("fc-press")); }, 160); }
  function over(ev) {
    if (ev.pointerType && ev.pointerType !== "mouse") return;
    const b = ev.target.closest?.("#tbf .tbdock .tbact");
    if (b !== over.b) { over.b = b; preview(b); }
  }
  function focusIn(ev) { const b = ev.target.closest?.("#tbf .tbdock .tbact"); if (b) preview(b); }

  // ------------------------------------------------------------------ keys on a PC
  function key(ev) {
    const r = root(); if (!r || !r.querySelector(".fc, .tbdone, .tbskip")) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target?.tagName || "") || ev.target?.isContentEditable) return;
    if (document.querySelector(".tbtime")) return;      // the timing ring has the keys
    if (typeof HOTBAR !== "undefined" && /^[0-9]$/.test(ev.key) && HOTBAR.blocked(ev)) { ev.stopImmediatePropagation(); return; }   // typing, a menu or a window: number keys do nothing
    if (typeof HOTBAR !== "undefined" && HOTBAR.editKey(ev)) { ev.stopImmediatePropagation(); return; }   // edit mode: keys pick slots
    const hit = (el) => { if (!el || el.disabled) return false; ev.preventDefault(); ev.stopImmediatePropagation(); el.classList.add("fc-press"); el.click(); return true; };
    const k = ev.key;
    if (k === "Escape") {
      if (aim) { ev.preventDefault(); ev.stopImmediatePropagation(); return cancelAim(); }
      if (r.querySelector(".tbsheet")) return hit(r.querySelector('[data-tbx="logx"]'));
      return hit(r.querySelector('.fc [data-tbm=""]'));
    }
    if (aim && (k === "Enter" || k === " ") && aim.z === "self") { ev.preventDefault(); ev.stopImmediatePropagation(); return fireAim(null); }
    if (k === " " || k === "Enter" || k === "Spacebar") {
      if (ev.repeat) { ev.preventDefault(); return; }
      return hit(r.querySelector(".tbdone")) || hit(r.querySelector(".tbskip")) || hit(r.querySelector('.fc [data-tba="end"]'));
    }
    const fc = r.querySelector(".fc"); if (!fc) return;
    if (/^[0-9]$/.test(k)) { ev.preventDefault(); ev.stopImmediatePropagation(); const b = fc.querySelector(`[data-fk="${k}"]`); if (b && !b.disabled) { b.classList.add("fc-press"); press(b); } return; }
    const ch = k.length === 1 ? k.toUpperCase() : "";
    if (ch === "M") return hit(fc.querySelector('[data-tbm="magic"]:not(.on)')) || hit(fc.querySelector('[data-tbm=""]'));
    if (ch === "I") return hit(fc.querySelector('[data-tbm="items"]:not(.on)')) || hit(fc.querySelector('[data-tbm=""]'));
    if (ch === "R") return hit(fc.querySelector('[data-fk="R"]')) || hit(fc.querySelector('.hb-bar [data-tba="recover"]'));   // Catch your breath (strategy.js)
  }

  if (DOM && typeof addEventListener === "function") {
    addEventListener("click", onClickCap, true);
    addEventListener("pointerdown", down, true);
    addEventListener("pointerup", up, true);
    addEventListener("pointercancel", up, true);
    addEventListener("pointerover", over, true);
    addEventListener("focusin", focusIn, true);
    addEventListener("keydown", key, true);
  }
  return { on, dock, apHTML, click, settingsHTML, quick, reason, suggest, toggleFav, favs, press, get aiming() { return !!aim; }, cancelAim };
})();
if (typeof module !== "undefined") module.exports = FIGHTCTL;
