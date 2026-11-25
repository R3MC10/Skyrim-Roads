/* A clearer first hour (onboard.js). [OURS]
   Builds on the guided first trip, the tab tips and the newbie guide (guide.js):
   - ideas(s, ctx): 1-3 "what to do next" ideas picked from the player's real state (road fights near Whiterun while low
     level, a dungeon, the main quest, a horse when rich, a party, rumours, homesteads and world events once they matter).
     They show as rows in the Travel tab's "What to do next" card; each can be hidden (✕), all can be switched off
     (Settings → Help & tips), and they stop for veterans (level 15+).
   - first-time tips: a small card at the top of the screen the first time something happens (over-encumbered, level-up,
     a dungeon, a party invite, a rumour). One at a time, never blocks a tap elsewhere, with "Don't show tips". A tip
     waits while a window or a result is open (overlays.js ranks them). Seen tips live in the save (s.onb.seen); the two
     switches live in this phone's prefs.
   - the first turn-by-turn fight: no wall of text, but one-line hints pinned to the control they explain (turn order,
     your moves, End turn). Each goes away once you use that control (or tap it), all of them at the result card.
   ui.js calls ONBOARD.mount({...}) once, ONBOARD.rows() inside nextCard(), ONBOARD.settingsHTML()/pref() in Settings. */
const ONBOARD = (() => {
  const VETERAN = 15;            // from this level on: no ideas, no tips (the fight hints still show: turn-by-turn is new for everyone)
  const PREFS_KEY = "rotn_prefs";
  const DOM = typeof document !== "undefined";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const prefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); } catch { return {}; } };
  const setPrefRaw = (k, v) => { try { const p = prefs(); p[k] = v; localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* storage blocked */ } };
  const ideasOn = () => prefs().obNext !== false;
  const tipsOn = () => prefs().obTips !== false;
  const st = (s) => { s.onb = s.onb || {}; s.onb.seen = s.onb.seen || {}; s.onb.hid = s.onb.hid || {}; return s.onb; };
  const veteran = (s) => (s.level || 1) >= VETERAN;
  const cleared = (s) => Object.keys(s.cleared || {}).length;
  const foesBeaten = (s) => (s.lt && s.lt.foes) || 0;
  const inTutorial = (s) => !!(s.tut && !s.tut.off && s.tut.step > 0);

  // ------------------------------------------------------------------ ideas: what to do next
  /* nearest known place matching test(name), not where you are */
  function nearest(s, ctx, test) {
    const here = ctx.here || [s.x, s.y];
    return Object.keys(WORLD.places).filter((n) => n !== s.location && (!ctx.known || ctx.known(n)) && test(n) && (!WORLD.same || WORLD.same(here, WORLD.places[n])))
      .map((n) => [n, G.pxDist(here, WORLD.places[n])]).sort((a, b) => a[1] - b[1])[0]?.[0] || null;
  }
  const go = (n) => ({ label: "Go", act: "go", attrs: `data-place="${esc(n)}"` });
  const tabBtn = (id, label) => ({ label, act: "uxtab", attrs: `data-id="${id}"` });
  /* every idea that fits right now, best first: {id, ico, title, sub, btn?, pri} */
  function candidates(s, ctx = {}) {
    const out = [], add = (o) => out.push(o);
    const lv = s.level || 1, gold = s.gold || 0, eta = ctx.eta || (() => "");
    const hurt = typeof G.curHealth === "function" && G.curHealth(s) < G.maxHealth(s) * 0.4;
    const moving = !!(s.trip && s.trip.status === "travel");
    if (hurt && !s.dungeon) add({ id: "heal", pri: 100, ico: "", title: "Patch yourself up", sub: "You're badly hurt. Rest at an inn (Area tab) or your own bed, drink a potion, eat cooked food, or cast a healing spell. Health doesn't come back by itself." + (s.location && TOWNS.isTown(s.location) ? "" : " Fights on the road go badly when you start them hurt."), btn: s.location && TOWNS.isTown(s.location) ? tabBtn("town", "Area") : null });
    if (typeof G.overweight === "function" && G.overweight(s)) add({ id: "heavy", pri: 95, ico: "", title: "Lighten your pack", sub: "You're carrying too much, so you walk slowly. Sell loot in a town (Area → General goods) or drop what you don't need.", btn: s.location && TOWNS.isTown(s.location) ? tabBtn("town", "Area") : null });
    // the main quest, when you're tracking something else (the card's first row already shows the tracked quest)
    if ((typeof QUESTS !== "undefined")) {
      const act = QUESTS.active(s), main = act.find((a) => a.id === "main");
      if (main && ctx.quest && ctx.quest !== "main") add({ id: "mainq", pri: 60, ico: "", title: "Follow the main quest", sub: `“${esc(main.st.title)}”: ${esc(main.st.text)}`, btn: { label: "Track", act: "qtrack", attrs: `data-id="main"` } });
    }
    // low level: easy fights on the roads around Whiterun
    if (lv < 5 && foesBeaten(s) < 6 && !moving && !s.dungeon) {
      const hold = (n) => G.holdAt(WORLD.places[n]) === "Whiterun" && /^(city|town|farm|landmark|stone)$/.test(WORLD.places[n][2]);
      const n = nearest(s, ctx, hold);
      if (n) add({ id: "road", pri: 70, ico: "", title: "Win a few road fights near Whiterun", sub: `Walk the roads around Whiterun: wolves, skeevers and bandits there are about your level and give good practice. Try ${esc(n)} (~${eta(n)}).`, btn: go(n) });
    }
    // a dungeon, once you've a level or two
    if (lv >= 3 && !cleared(s) && !s.dungeon && !moving && (typeof DUNGEONS !== "undefined")) {
      const n = nearest(s, ctx, (x) => DUNGEONS.enterable(x) && !(DUNGEONS.refillLeft && DUNGEONS.refillLeft(s, x)));
      if (n) add({ id: "dungeon", pri: 65, ico: "", title: "Try a dungeon", sub: `Dungeons hold the best loot. ${esc(n)} is ~${eta(n)} away. Go room by room; you can leave between rooms.`, btn: go(n) });
    }
    // a horse once you can afford one with change to spare
    const hp = D.HORSE_PRICE || 1000;
    if (!s.horse && gold >= hp + 150 && lv < VETERAN && (typeof HORSES !== "undefined")) {
      const n = HORSES.nearestStables([s.x, s.y]);
      add({ id: "horse", pri: 55, ico: "", title: "Buy a horse", sub: `You have the ${hp} gold. Riding is much faster and the horse carries things for you. Stables are outside the big cities; ${esc(n)} is closest.`, btn: s.location === n ? tabBtn("town", "Area") : go(n) });
    }
    // play with others
    if (ctx.online && !ctx.party && lv >= 3) add({ id: "party", pri: 45, ico: "⚑", title: "Team up with other players", sub: "Fights are easier together: in a party you travel as one, each plays their own turns, gold is split evenly and loot is voted on. Open  Friends.", btn: tabBtn("social", "Friends") });
    // rumours: once you can handle a detour and you're in a town with an inn
    if (lv >= 4 && (typeof RUMOURS !== "undefined") && !(s.rw && s.rw.seen) && !RUMOURS.leads(s).length && s.location && TOWNS.INNS && TOWNS.INNS[s.location] && !moving)
      add({ id: "rumour", pri: 40, ico: "", title: "Listen for rumours", sub: "Buy a round at the inn (Area tab) and the locals point you at treasure, trouble or a hidden place. Some of it is just gossip.", btn: tabBtn("town", "Area") });
    // world events, once you can survive them
    if (lv >= 8 && (typeof WORLDEV !== "undefined")) {
      const ev = WORLDEV.active()[0];
      if (ev) add({ id: "wev-" + ev.kind, pri: 35, ico: ev.icon || "✶", title: `Join in: ${esc(ev.name)}`, sub: "Everyone in the world works on this together for a while. See the Journal → Misc for what to do.", btn: tabBtn("log", "Journal") });
    }
    // a homestead when you're rich and settled
    if ((typeof HOMESTEAD !== "undefined") && !HOMESTEAD.owned(s).length && (gold >= 4000 || lv >= 12))
      add({ id: "homestead", pri: 30, ico: "", title: "Build your own house", sub: "Buy land near Falkreath, Morthal or Dawnstar from the Jarl's steward and build a home stage by stage. A deed costs about 5000 gold.", btn: s.location !== "Falkreath" ? go("Falkreath") : tabBtn("town", "Area") });
    // the next guide step as a fallback
    if ((typeof GUIDE !== "undefined")) { const g = GUIDE.STEPS.find((x) => !x[3](s)); if (g) add({ id: "guide-" + g[0], pri: 20, ico: "", title: `Next step: ${esc(g[1])}`, sub: esc(g[2]), btn: { label: "Show me", act: "guidego", attrs: `data-id="${g[0]}"` } }); }
    return out.sort((a, b) => b.pri - a.pri);
  }
  /* 1-3 ideas, or [] when switched off / for veterans / during the guided first trip */
  function ideas(s, ctx = {}) {
    if (!s || !ideasOn() || veteran(s) || inTutorial(s) || s.dungeon) return [];
    const hid = st(s).hid;
    return candidates(s, ctx).filter((c) => !hid[c.id]).slice(0, Math.max(1, Math.min(3, ctx.max ?? 3)));
  }
  /* the rows for ui.js's "What to do next" card (same look as its own rows), plus a footer to switch them off */
  function rows(s, ctx = {}) {
    return ideas(s, ctx).map((c) => `<div class="item nx obrow"><span class="nx-i" aria-hidden="true">${c.ico}</span><div class="t">${c.title}<span>${c.sub}</span></div>${c.btn ? `<button class="btn sm" data-act="${c.btn.act}" ${c.btn.attrs}>${esc(c.btn.label)}</button>` : ""}<button class="obx" data-ob="hide" data-id="${esc(c.id)}" aria-label="Hide this idea">✕</button></div>`);
  }
  const foot = () => `<p class="obfoot sub"><button class="linkbtn" data-ob="off">Turn these ideas off</button> · they come back in  Settings → Help &amp; tips</p>`;

  // ------------------------------------------------------------------ first-time tips
  /* id, applies(s, ctx), title, text (may depend on ctx) */
  const TIPS = [
    ["welcome", (s, c) => !c.fightOpen && s.tut && !s.tut.off && s.tut.step === 1 && !s.trip, "Welcome to Skyrim", (s) => `The gold card under the map (<b>Your first trip</b>) shows you what to do, one step at a time. Tips like this one pop up the first time something new happens.`, { btn: ["@tut", "Show me"] }],
    ["level", (s) => s.pendingLevels > 0 && (s.level || 1) <= 4, "Level up!", () => "Open <b>Hero</b>: pick Health, Magicka or Stamina, then spend your perk point on a skill you use. Skills rise by using them.", { btn: ["hero", "Open Hero"] }],
    ["heavy", (s) => typeof G.overweight === "function" && G.overweight(s), "Too heavy", () => "You're carrying more than you can, so you walk slowly. Sell loot in a town, keep things in a house chest, or let a horse or follower carry them."],
    ["dungeon", (s) => !!s.dungeon && !cleared(s), "Your first dungeon", () => "Go room by room. Each room may hold foes, a trap or loot; you can leave between rooms and come back later. The boss and the best chest wait at the end."],
    ["invite", (s, c) => c.invites > 0, "A party invite", () => (typeof INVITES !== "undefined" ? "Someone wants you in their party. Tap Accept on the card at the top to join, or Decline. The leader picks where to go and you travel together; gold is split evenly." : "Someone wants you in their party. Open \uE106 <b>Friends → Party</b> to join. The leader picks where to go and you travel together; gold is split evenly."), { btn: ["social", "Friends"] }],
    ["rumour", (s) => (typeof RUMOURS !== "undefined") && RUMOURS.leads(s).length > 0, "You've got a lead", () => "Rumours are marked on your map and listed in the Journal → Misc. Go there to see if it's true: some are just gossip."],
  ];
  let bound = null, shown = null, timer = null, hTimer = null;
  function ctxNow() {
    const b = bound || {};
    return { fightOpen: (typeof TB !== "undefined") && TB.open, party: !!(b.party && b.party()), invites: (b.invites && b.invites().length) || 0 };
  }
  /* which tip to show now (or null) */
  function pickTip(s, c = ctxNow()) {
    if (!s || !tipsOn()) return null;
    const seen = st(s).seen;
    for (const [id, ok, title, text, o = {}] of TIPS) {
      if (seen[id] || (veteran(s) && !o.any)) continue;
      if (c.fightOpen) continue;                                 // nothing over a fight (its hints are pinned to the controls)
      try { if (ok(s, c)) return { id, title, text: text(s, c), btn: o.btn || null }; } catch { /* a module isn't loaded */ }
    }
    return null;
  }
  function markSeen(s, id) { st(s).seen[id] = 1; }
  const zoom = () => (typeof FITCANVAS !== "undefined" ? FITCANVAS.zoom() : 1);   // zoomed page (PC, bigger text): screen px → page px
  const OV = () => (typeof OVERLAYS !== "undefined" ? OVERLAYS : null);
  /* a window or a result is on screen: tips wait (overlays.js) */
  const held = () => { const o = OV(); return !!o && o.level() >= o.LEVEL.decision; };
  function render(tip) {
    let el = document.getElementById("obtip");
    if (!tip) { if (el) el.remove(); shown = null; return; }
    if (!el) { el = document.createElement("div"); el.id = "obtip"; el.setAttribute("role", "status"); el.addEventListener("click", onTipClick); document.body.appendChild(el); }
    el.className = "obtip";
    el.innerHTML = `<div class="obtip-h"><b> ${esc(tip.title)}</b><button class="obx" data-obt="ok" aria-label="Close tip">✕</button></div><p>${tip.text}</p>
      <div class="obtip-b">${tip.btn ? `<button class="btn sm pri" data-obt="go" data-id="${tip.btn[0]}">${esc(tip.btn[1])}</button>` : ""}<button class="btn sm" data-obt="ok">Got it</button><button class="linkbtn" data-obt="off">Don't show tips</button></div>`;
    shown = tip.id;
    place();
  }
  /* just under the top bar, so Menu and Friends stay tappable */
  function place() {
    const el = document.getElementById("obtip"); if (!el) return;
    if (shown === "invite" && typeof INVITES !== "undefined") { el.style.top = "auto"; el.style.bottom = "calc(84px + env(safe-area-inset-bottom))"; return; }   // the invite card sits on top: keep clear of it
    const bar = document.querySelector("#dun .hd") || document.querySelector("#app .top"), b = bar ? bar.getBoundingClientRect().bottom / zoom() : 0;
    el.style.top = Math.max(10, Math.min(b + 6, innerHeight * 0.3)) + "px"; el.style.bottom = "auto";
  }
  function onTipClick(e) {
    const b = e.target.closest("[data-obt]"); if (!b || !bound) return;
    const s = bound.S(); if (!s) return;
    const k = b.dataset.obt;
    if (shown) markSeen(s, shown);
    if (k === "off") { setPrefRaw("obTips", false); bound.toast?.("Tips are off. Switch them back on in  Settings → Help & tips."); }
    if (k === "go" && b.dataset.id === "@tut") { const t = document.querySelector("#side .tut"); if (t) t.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (k === "go" && bound.click) { const x = document.createElement("button"); x.dataset.act = "uxtab"; x.dataset.id = b.dataset.id; try { bound.click({ target: x }); } catch { /* ignore */ } }
    bound.persist?.();
    render(null);
  }
  function tick() {
    if (!bound) return;
    const s = bound.S(); if (!s) return;
    if (shown) {                                                   // keep the shown one until it's dismissed, unless it no longer makes sense
      const def = TIPS.find((x) => x[0] === shown);
      const cx = ctxNow();
      let still = true; try { still = !def || def[1](s, cx); } catch { /* keep it */ }
      if (cx.fightOpen) render(null);                              // a fight started: put it away, it comes back later
      else if (!still) { if (!held()) markSeen(s, shown); render(null); bound.persist?.(); }   // the moment has passed (you set off...); one held under a window was never read
      else if (!tipsOn()) render(null);
      else place();
      return;
    }
    if (held()) return;                                            // a window or a result is open: the next tip waits for it
    const tip = pickTip(s);
    if (tip) render(tip);
  }

  // ------------------------------------------------------------------ fight hints: one line pinned to the control it explains
  /* id, the control, the side of it, the line. Shown in the first turn-by-turn fights until each control is used. */
  const HINTS = [
    ["order", "#tbf .tbtop .tbord|#tbf .tbtop", "below", "Turn order: the highest number acts first. A foe can act twice a round."],
    ["moves", "#tbf .tbap", "above", "Up to 4 moves a turn. Blows cost stamina, spells magicka."],
    ["end", '#tbf [data-tba="end"]', "above", "Done? End turn. Moves you don't make become guard."],
  ];
  const HKEY = (id) => "tbf-" + id;
  let hmem = { turns: 0, wasMine: false, endShown: false };
  /* pure: which hints show now. seen = s.onb.seen; f = {open, done, mine, acts, result} */
  function hintsFor(seen, f) {
    if (!f || !f.open || f.done || f.result || seen.tbfight) return [];   // seen.tbfight: the old big fight tip, or every hint, was read already
    if (!f.mine) return [];
    const out = [];
    if (f.acts === 0) { if (!seen[HKEY("order")]) out.push("order"); if (!seen[HKEY("moves")]) out.push("moves"); }
    else if (!seen[HKEY("end")]) out.push("end");
    return out;
  }
  /* mark one hint used; all of them used = the fight lesson is learnt */
  function useHint(s, id) {
    const seen = st(s).seen; if (seen[HKEY(id)]) return false;
    seen[HKEY(id)] = 1;
    if (HINTS.every(([h]) => seen[HKEY(h)])) seen.tbfight = 1;
    return true;
  }
  function hintState() {
    const B = typeof TB !== "undefined" ? TB : null, sess = B && B.open ? B.session : null, o = OV();
    return { open: !!sess, done: !!(sess && sess.done), mine: !!document.querySelector('#tbf [data-tba="end"]'), acts: sess ? sess.myActs || 0 : 0,
      result: !!(o && o.level() >= o.LEVEL.result) || !!document.querySelector("#tbf .tbdone") };
  }
  function hintTick(s) {
    if (!DOM) return;
    const f = hintState();
    let ch = false;
    if (f.open && f.mine && f.acts > 0)                            // a move made: the turn order and moves lines did their job
      for (const id of ["order", "moves"]) if (document.querySelector(`#fhints [data-h="${id}"]`)) ch = useHint(s, id) || ch;
    if (f.open && f.mine !== hmem.wasMine) {                       // a turn of yours ended with the End turn line up: after two turns it's learnt
      if (!f.mine && hmem.endShown) { hmem.turns++; hmem.endShown = false; if (hmem.turns >= 2) ch = useHint(s, "end") || ch; }
      hmem.wasMine = f.mine;
    }
    if (!f.open) hmem = { turns: 0, wasMine: false, endShown: false };
    if (ch) bound.persist?.();
    drawHints(tipsOn() ? hintsFor(st(s).seen, f) : []);
  }
  function drawHints(ids) {
    let box = document.getElementById("fhints");
    if (!ids.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.id = "fhints"; box.setAttribute("role", "status"); box.addEventListener("click", onHintClick); document.body.appendChild(box); }
    const key = ids.join(",");
    if (box.dataset.k !== key) {
      box.dataset.k = key;
      box.innerHTML = ids.map((id) => { const h = HINTS.find((x) => x[0] === id); return `<div class="fhint ${h[2]}" data-h="${id}"><span>${esc(h[3])}</span><i class="fh-ar" aria-hidden="true"></i></div>`; }).join("");
    }
    placeHints();
    if (ids.includes("end")) hmem.endShown = true;
  }
  /* pure: slide a w×h box from y (up for "above", down for "below") until it touches none of the blockers */
  function freeY(x, y, w, h, dir, blockers, minY = 4, maxY = 1e5) {
    const hit = (b) => x < b.right + 4 && b.left < x + w + 4 && y < b.bottom + 4 && b.top < y + h + 4;
    for (let i = 0; i < 12; i++) {
      const b = blockers.find(hit); if (!b) break;
      y = dir === "above" ? b.top - 8 - h : b.bottom + 8;
    }
    return Math.max(minY, Math.min(maxY - h, y));
  }
  /* pin each line next to its control, over the picture: never on top of a button, the bars, the foe card or the log.
     A line whose control isn't on screen hides. */
  function placeHints() {
    const box = document.getElementById("fhints"); if (!box) return;
    const z = zoom(), W = innerWidth / z, H = innerHeight / z;
    const sc = (r) => ({ left: r.left / z, top: r.top / z, right: r.right / z, bottom: r.bottom / z });
    const blockers = [...document.querySelectorAll("#tbf .tbtop, #tbf .tblog:not([hidden]), #tbf .tbu, #tbf .tbdock, #tbf .tballies, #tbf .bfwrap")]
      .filter((e) => e.getClientRects().length).map((e) => sc(e.getBoundingClientRect())).filter((r) => r.right > r.left);
    const dock = document.querySelector("#tbf .tbdock"), dockTop = dock && dock.getClientRects().length ? dock.getBoundingClientRect().top / z : H;
    for (const el of box.querySelectorAll(".fhint")) {
      const h = HINTS.find((x) => x[0] === el.dataset.h), a = h && h[1].split("|").map((q) => document.querySelector(q)).find((x) => x && x.getClientRects().length);
      const r = a && a.getClientRects().length ? sc(a.getBoundingClientRect()) : null;
      if (!r || r.right <= r.left) { el.hidden = true; continue; }
      el.hidden = false;
      el.style.maxWidth = Math.min(320, W - 16) + "px";
      const ew = el.offsetWidth || 240, eh = el.offsetHeight || 40, cx = (r.left + r.right) / 2;
      const left = Math.max(8, Math.min(W - ew - 8, cx - ew / 2));
      const y = h[2] === "below" ? freeY(left, r.bottom + 8, ew, eh, "below", blockers, 4, dockTop - 4)
        : freeY(left, Math.min(r.top, dockTop) - 8 - eh, ew, eh, "above", blockers, 4, H);
      el.style.left = Math.round(left) + "px"; el.style.top = Math.round(y) + "px"; el.style.bottom = "auto";
      el.style.setProperty("--ax", Math.round(Math.max(14, Math.min(ew - 14, cx - left))) + "px");
      blockers.push({ left, top: y, right: left + ew, bottom: y + eh });   // the next line keeps clear of this one
    }
  }
  function onHintClick(e) {
    const h = e.target.closest(".fhint"); if (!h || !bound) return;
    const s = bound.S(); if (!s) return;
    useHint(s, h.dataset.h); bound.persist?.();
    h.remove();
  }
  /* pressing End turn is using it */
  function onFightClick(e) {
    if (!bound || !e.target.closest?.('#tbf [data-tba="end"]') || !document.querySelector('#fhints [data-h="end"]')) return;
    const s = bound.S(); if (s && useHint(s, "end")) bound.persist?.();
  }
  /* ui.js: once, at the start of the game */
  function mount(b) {
    bound = b;
    if (!DOM) return;
    const side = document.getElementById("side");
    if (side) side.addEventListener("click", onPanelClick);
    clearInterval(timer); timer = setInterval(tick, 1000);
    clearInterval(hTimer); hTimer = setInterval(() => {   // fight hints follow their controls closely
      try { const s = bound.S(); if (s && typeof TB !== "undefined" && TB.open) hintTick(s); else drawHints([]); } catch { /* layout only */ }
    }, 250);
    document.addEventListener("click", onFightClick, true);
  }
  function onPanelClick(e) {
    const b = e.target.closest("[data-ob]"); if (!b || !bound) return;
    const s = bound.S(); if (!s) return;
    if (b.dataset.ob === "hide") { st(s).hid[b.dataset.id] = 1; bound.toast?.("Hidden. More ideas show up as you play."); }
    if (b.dataset.ob === "off") { setPrefRaw("obNext", false); bound.toast?.("Ideas are off. Switch them back on in  Settings → Help & tips."); }
    bound.persist?.(); bound.renderPanel?.(true);
  }

  // ------------------------------------------------------------------ settings
  function settingsHTML(seg) {
    return `<h3>Help &amp; tips</h3><div class="setrow"><span>Ideas on Travel</span>${seg("obNext", [[true, "On"], [false, "Off"]], ideasOn())}</div>
      <div class="setrow"><span>First-time tips</span>${seg("obTips", [[true, "On"], [false, "Off"]], tipsOn())}</div>`;
  }
  /* returns true when it handled the setting */
  function pref(k, v) {
    if (k !== "obNext" && k !== "obTips") return false;
    setPrefRaw(k, v === true || v === "true");
    if (k === "obTips" && !tipsOn() && DOM) render(null);
    return true;
  }

  return { VETERAN, TIPS, HINTS, hintsFor, freeY, candidates, ideas, rows, foot, pickTip, markSeen, mount, tick, settingsHTML, pref, ideasOn, tipsOn, veteran };
})();
