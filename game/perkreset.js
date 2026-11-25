/* perkreset.js: reset your perks at a shrine or a temple, for gold that rises the more often you do it. [OURS]
   Owner decision (25 Nov 2026 survey): "perk reset at a shrine for gold, rising cost". Replaces respec.js (a flat
   10,000 gold button on the Character screen).
   - Where: any wayside shrine (Talos, Azura, Mehrunes Dagon, Meridia, Boethiah, the Hall of the Vigilant, Weynon
     Stones) in its "What's here" card, and the temple of a city (Whiterun, Riften, Solitude, Markarth, Windhelm,
     Falkreath) as its own place in the Area tab (Services & trainers).
   - Not while a fight is on, inside a dungeon, during a heist, with a road encounter waiting, or on the road.
   - Price: (100 + 25 × level) × min(3, 1 + 0.5 × R), R = paid resets in the last 7 days (real days, save timestamps,
     older ones drop off). Your first reset is free, at any level. Paid resets open at level 5.
     Calibration: at level 5 the first paid reset is 225 gold, about one cleared-dungeon job (120 + 150 × tier) or two
     of the early story quests (50-200). At level 20 it's 600, at 40 it's 1,100: still a few jobs. So the base stays 100.
   - What comes back: every perk point (the perk ids stay the same, you just take them again) and, as respec.js did
     (Remigiusz: "it returns all your perks and attribute points"), each Health/Magicka/Stamina level-up choice.
     Skills, skill XP, level and XP stay. Beast-form and follower perks are separate and stay.
   - One step: the price is checked, then gold, perks and choices change together; anything that throws puts the save
     back as it was. Afterwards everything that reads perks is tidied: health is capped at the new maximum, hotbar slots
     for moves you no longer have are emptied. Perk effects (perkfx.js) are read live from s.perks, so none linger.
     The save goes to the cloud and the party card is republished at once (ui.js persist(true)).
   Pure parts work in node: tests/test_perkreset.js. Screen: tests/perkreset_ui.py. */
const PERKRESET = (() => {
  const BASE = 100, PER_LEVEL = 25, STEP = 0.5, CAP = 3, MIN_LEVEL = 5, WEEK = 7 * 86400;
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = (en, v) => { let x = en; try { if (typeof I18N !== "undefined" && I18N.tr && I18N.lang() === "pl") x = I18N.tr(en) || en; } catch { /* English */ } return v ? x.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : x; };
  const now = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // ------------------------------------------------------------ where
  /* wayside shrines (world.js kind "shrine") and two temple-like landmarks with a blessing */
  const SHRINES = new Set(["Hall of the Vigilant", "Weynon Stones"]);
  const TEMPLES0 = { Whiterun: "the Temple of Kynareth", Riften: "the Temple of Mara", Solitude: "the Temple of the Divines", Markarth: "the Temple of Dibella", Windhelm: "the Temple of Talos", Falkreath: "the Hall of the Dead" };
  const temples = () => (typeof AFFL !== "undefined" && AFFL.TEMPLES) || TEMPLES0;
  const isShrine = (n) => !!n && typeof WORLD !== "undefined" && !!WORLD.places[n] && (WORLD.places[n][2] === "shrine" || SHRINES.has(n));
  const isTemple = (n) => !!n && !!temples()[n];
  /* the shrine or temple you stand at: { place, name, temple } or null */
  function where(s) {
    const n = s?.location;
    if (!n || (s.trip && s.trip.status !== "done")) return null;
    if (isTemple(n)) return { place: n, name: temples()[n], temple: true };
    if (isShrine(n)) return { place: n, name: n, temple: false };
    return null;
  }

  // ------------------------------------------------------------ what you'd get back
  const per = () => (typeof F !== "undefined" && F.ATTRIBUTE_PER_LEVEL) || 10;
  const perkCount = (s) => Object.values(s?.perks || {}).reduce((a, b) => a + (+b > 0 ? +b : 0), 0);
  const attrCount = (s) => Math.floor(((s?.hpBonus || 0) + (s?.mpBonus || 0) + (s?.spBonus || 0)) / per());

  // ------------------------------------------------------------ price
  function st(s) {
    let o = s.perkReset;
    if (!o || typeof o !== "object") o = {};
    if (!Array.isArray(o.paid)) o.paid = [];
    o.paid = o.paid.filter((t) => typeof t === "number" && isFinite(t));
    o.freeUsed = !!o.freeUsed;
    s.perkReset = o;
    return o;
  }
  /* paid resets in the last 7 days (read only: never changes the save) */
  function recent(s, t = now()) {
    const p = Array.isArray(s?.perkReset?.paid) ? s.perkReset.paid : [];
    return p.filter((x) => typeof x === "number" && x <= t && t - x < WEEK).length;
  }
  const mult = (r) => Math.min(CAP, 1 + STEP * Math.max(0, r));
  const price = (level, r) => Math.round((BASE + PER_LEVEL * Math.max(1, level || 1)) * mult(r));
  const freeLeft = (s) => !s?.perkReset?.freeUsed;
  /* the whole offer: { free, cost, next, perks, attrs, recent } — cost 0 when free; next = the price of the one after */
  function quote(s, t = now()) {
    const L = s?.level || 1, r = recent(s, t), free = freeLeft(s);
    const cost = free ? 0 : price(L, r);
    const next = free ? price(L, 0) : price(L, r + 1);
    return { free, cost, next, nextLocked: L < MIN_LEVEL, perks: perkCount(s), attrs: attrCount(s), recent: r, level: L };
  }
  /* when the oldest recent paid reset drops off (seconds from t), or 0 */
  function easesIn(s, t = now()) {
    const p = (s?.perkReset?.paid || []).filter((x) => x <= t && t - x < WEEK);
    return p.length ? Math.max(0, Math.min(...p) + WEEK - t) : 0;
  }

  // ------------------------------------------------------------ can you, right now?
  /* ctx: { fight: bool } from the page (a fight on screen); node tests pass it in */
  function busy(s, ctx = {}) {
    const fight = ctx.fight ?? (typeof TB !== "undefined" && !!TB.open);
    if (fight) return T("Not in the middle of a fight.");
    if (s.dungeon) return T("Not inside a dungeon. Finish it or leave first.");
    if (s.heist && s.heist.run) return T("Not in the middle of a heist.");
    if (s.encounter) return T("Deal with what's on the road first.");
    return null;
  }
  function can(s, ctx = {}, t = now()) {
    const b = busy(s, ctx); if (b) return b;
    if (!where(s)) return T("Pray at a shrine or a city temple to reset your perks.");
    const q = quote(s, t);
    if (q.perks + q.attrs <= 0) return T("Nothing to take back yet.");
    if (!q.free && q.level < MIN_LEVEL) return T("Paid resets open at level {n}.", { n: MIN_LEVEL });
    if (!q.free && (s.gold || 0) < q.cost) return T("You need {n} gold.", { n: fmt(q.cost) });
    return null;
  }

  // ------------------------------------------------------------ the reset (one step)
  function tidy(s) {
    if (typeof G !== "undefined" && G.maxHealth && G.setHealth) {
      const cur = G.curHealth ? G.curHealth(s) : s.health;
      if (cur > G.maxHealth(s)) G.setHealth(s, G.maxHealth(s));
    } else if (typeof s.health === "number" && typeof s.maxHealth === "number") s.health = Math.min(s.health, s.maxHealth);
    if (typeof HOTBAR !== "undefined" && HOTBAR.saved && HOTBAR.known && HOTBAR.store) {
      const L = HOTBAR.saved(s);
      if (L) { const out = L.map((a) => (a && !HOTBAR.known(s, null, a) ? null : a)); if (out.some((a, i) => a !== L[i])) HOTBAR.store(s, out); }
    }
  }
  function run(s, ctx = {}, t = now()) {
    const err = can(s, ctx, t); if (err) return { err };
    const q = quote(s, t);
    const keep = JSON.stringify({ gold: s.gold, perks: s.perks, pendingLevels: s.pendingLevels, hpBonus: s.hpBonus, mpBonus: s.mpBonus, spBonus: s.spBonus, perkReset: s.perkReset, health: s.health, healthTs: s.healthTs, hotbar: s.hotbar });
    try {
      const o = st(s);
      o.paid = o.paid.filter((x) => x <= t && t - x < WEEK);   // older resets expire
      if (q.free) o.freeUsed = true; else { s.gold -= q.cost; o.paid.push(t); }
      o.last = t; o.count = (o.count || 0) + 1;
      s.perks = {};
      s.pendingLevels = (s.pendingLevels || 0) + q.attrs;
      s.hpBonus = 0; s.mpBonus = 0; s.spBonus = 0;
      tidy(s);
    } catch (e) {
      const k = JSON.parse(keep);
      for (const [key, v] of Object.entries(k)) { if (v === undefined) delete s[key]; else s[key] = v; }
      return { err: T("The shrine stays silent. Nothing changed.") };
    }
    const after = quote(s, t);
    const bits = [T(q.perks === 1 ? "1 perk point" : "{n} perk points", { n: q.perks })];
    if (q.attrs) bits.push(T(q.attrs === 1 ? "1 level-up choice" : "{n} level-up choices", { n: q.attrs }));
    return { text: T("Your perks are reset: {what} are back to spend.", { what: bits.join(T(" and ")) }) + " " + (q.free ? T("This one was free.") : T("You paid {n} gold.", { n: fmt(q.cost) })),
      cost: q.cost, free: q.free, perks: q.perks, attrs: q.attrs, next: after.cost };
  }

  // ------------------------------------------------------------ the page
  const giveBack = (q) => [q.perks ? T(q.perks === 1 ? "1 perk point" : "{n} perk points", { n: q.perks }) : "", q.attrs ? T(q.attrs === 1 ? "1 level-up choice" : "{n} level-up choices", { n: q.attrs }) : ""].filter(Boolean).join(" · ");
  const priceTxt = (q) => (q.free ? T("Free (your first reset)") : T("{n} gold", { n: fmt(q.cost) }));
  const nextTxt = (q) => (q.nextLocked ? T("Paid resets open at level {n}.", { n: MIN_LEVEL }) : T("Next reset: {n} gold", { n: fmt(q.next) }) + (q.free ? "" : T(" (drops again a week after each reset)")));
  /* the row: in a shrine's "What's here" card, or the temple's list in town */
  function row(s, ctx = {}) {
    if (!where(s)) return "";
    const q = quote(s), err = can(s, ctx);
    const sub = `${q.perks + q.attrs > 0 ? esc(T("Take back {what}.", { what: giveBack(q) })) : esc(T("Nothing to take back yet."))} ${esc(T("Skills and level stay."))}`;
    const b = err ? `<button class="btn sm" disabled title="${esc(err)}">${esc(T("Reset perks"))}</button>` : `<button class="btn sm" data-act="perkreset" data-id="ask">${esc(T("Reset perks"))}</button>`;
    return `<div class="item pstuff-row prs-row"><span class="ps-i" aria-hidden="true"></span><div class="t">${esc(T("Reset perks"))}<span>${sub} · <b class="gold">${esc(priceTxt(q))}</b>${err && q.perks + q.attrs > 0 ? ` · ${esc(err)}` : ""}</span></div>${b}</div>`;
  }
  /* the confirmation window */
  function dialog(s, ctx = {}) {
    const w = where(s), q = quote(s), err = can(s, ctx);
    const art = typeof PLACEART !== "undefined" && w && !w.temple && PLACEART.scene ? PLACEART.scene(w.place) : "";
    return `<h2>${esc(T("Reset perks"))}</h2>${art}<p class="sub">${esc(w ? (w.temple ? T("The priests of {p} can lift your old path from you.", { p: w.name }) : T("You kneel at {p} and let your old path go.", { p: w.name })) : "")}</p>
      <div class="list prs-dlg">
        <div class="item"><div class="t">${esc(T("Price"))}<span>${esc(T("You have {n} gold.", { n: fmt(s.gold || 0) }))}</span></div><b class="num gold">${esc(priceTxt(q))}</b></div>
        <div class="item"><div class="t">${esc(T("You get back"))}<span>${esc(T("Skills, skill XP and level stay."))}</span></div><b class="num">${esc(giveBack(q) || "—")}</b></div>
        <div class="item"><div class="t">${esc(T("After this"))}<span>${esc(nextTxt(q))}</span></div></div>
      </div>
      ${err ? `<p class="sub danger-high">${esc(err)}</p>` : ""}
      <div class="grid2" style="margin-top:10px"><button class="btn pri" data-act="perkreset" data-id="go"${err ? " disabled" : ""}>${esc(q.free ? T("Reset for free") : T("Reset for {n} gold", { n: fmt(q.cost) }))}</button><button class="btn ghost" data-act="close">${esc(T("Keep my perks"))}</button></div>`;
  }
  /* ui: { openModal, closeModal, toast, persist, renderPanel, fight } */
  function onClick(b, s, ui) {
    const ctx = { fight: !!ui.fight };
    if (b.dataset.id === "ask") return ui.openModal(dialog(s, ctx), "prs-sheet");
    if (b.dataset.id === "go") {
      const r = run(s, ctx);
      if (r.err) { ui.toast(r.err); return ui.openModal(dialog(s, ctx), "prs-sheet"); }
      if (typeof SOUND !== "undefined" && SOUND.fx) SOUND.fx("coin");
      if (typeof G !== "undefined" && G.note) G.note(s, r.text);
      ui.persist(true); ui.renderPanel(true);
      return ui.openModal(`<h2>${esc(T("Perks reset"))}</h2><p>${esc(r.text)}</p><p class="sub">${esc(T("Spend your points again in Character → Perks."))}</p><div class="grid2"><button class="btn pri" data-act="perkreset" data-id="perks">${esc(T("Open perks"))}</button><button class="btn ghost" data-act="close">${esc(T("Close"))}</button></div>`, "prs-sheet");
    }
  }
  /* the Character screen's pointer (where the old Respec button was) */
  function hint(s) {
    if (perkCount(s) + attrCount(s) <= 0) return "";
    const q = quote(s);
    return `<div class="panel prs-hint"><h3>${esc(T("Reset perks"))}</h3><p class="sub">${esc(T("Want a different build? Pray at any shrine or city temple to take your perks back."))} ${esc(q.free ? T("Your first reset is free.") : q.level < MIN_LEVEL ? T("Paid resets open at level {n}.", { n: MIN_LEVEL }) : T("Right now it costs {n} gold.", { n: fmt(q.cost) }))}</p></div>`;
  }
  /* the temple tile's few words on the Area board (areaui.js) */
  function status(s) {
    if (perkCount(s) + attrCount(s) <= 0) return null;
    const q = quote(s);
    return q.free ? { text: T("First perk reset free") } : q.level < MIN_LEVEL ? null : { text: T("Perk reset {n} gold", { n: fmt(q.cost) }) };
  }
  // town temples: a place of their own in the Area tab
  const sections = (l) => (isTemple(l) ? ["temple"] : []);
  const names = () => ({ temple: T("Temple") });
  function townHTML(s, ui = {}) {
    const w = where(s);
    return { note: T("Priests cure diseases and lift your old path: reset your perks here. Your first reset is free; after that the price rises with your level and with each reset this week."),
      body: (w ? `<p class="sub">${esc(w.name.replace(/^the /, "The "))}</p>` : "") + row(s, ui) };
  }

  return { BASE, PER_LEVEL, STEP, CAP, MIN_LEVEL, WEEK, SHRINES, where, isShrine, isTemple, perkCount, attrCount, recent, mult, price, quote, easesIn, busy, can, run, tidy, row, dialog, onClick, hint, status, sections, names, townHTML };
})();
if (typeof module !== "undefined") module.exports = PERKRESET;
