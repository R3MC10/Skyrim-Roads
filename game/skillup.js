/* skillup.js: Skyrim's skill-up notice. For each skill that rose, a centred toast at the top shows
   "One-Handed increased to 31" over a thin ornate bar that fills; when a level is crossed the bar runs to the end,
   flashes, chimes softly and starts again from 0 up to the new progress. Several skills play one after another
   (about 1.2 s each, tap to skip). After a fight, skills that gained XP without levelling creep up briefly too.
   A character level-up gets its own bigger "Level up" banner with the character-level bar.
   It sits in the HUD message lane (hud2.js docks it at the top of the lane, so nothing overlaps),
   and the plain "📈 X increased to N" line under a fight result is gone; follower lines stay as normal lines.
   The queue and bar maths are plain functions for tests/test_skillup.js. [OURS] */
const SKILLUP = (() => {
  const live = typeof document !== "undefined" && typeof window !== "undefined";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp01 = (x) => (x > 1 ? 1 : x > 0 ? x : 0);

  // ------------------------------------------------------------ maths (pure)
  /* how far along to the next level, 0..1 (a maxed skill is a full bar) */
  const frac = (lvl, xp, need, cap = 100) => (lvl >= cap ? 1 : need > 0 ? clamp01(xp / need) : 0);
  /* the bar's run from before {lvl, xp} to after {lvl, xp}: segments {a, b, lvl, cross}. Each crossed level is a run to
     the end (cross: true, lvl = the level reached); the last segment creeps to the new progress. need(lvl) = XP for lvl→lvl+1. */
  function run(before, after, need, cap = 100) {
    const segs = [];
    let a = frac(before.lvl, before.xp, need(before.lvl), cap);
    for (let l = before.lvl; l < after.lvl; l++) { segs.push({ a, b: 1, lvl: l + 1, cross: true }); a = 0; }
    const b = frac(after.lvl, after.xp, need(after.lvl), cap);
    if (after.lvl >= cap && segs.length) return segs;   // just maxed: the full bar is the end
    if (b > a + 1e-4 || !segs.length || segs[segs.length - 1].cross) segs.push({ a, b: Math.max(a, b), lvl: after.lvl, cross: false });
    return segs;
  }
  const crossings = (it) => it.segs.filter((s) => s.cross).length;
  /* how long a toast stays (ms): ~1.2 s for a skill-up, a bit more per extra level, quick for a creep, longer for a level-up */
  function dur(it) {
    if (it.kind === "level") return 2600 + 350 * Math.max(0, crossings(it) - 1);
    const c = crossings(it);
    return c ? 1200 + 300 * (c - 1) : 650;
  }
  /* two runs of the same bar in a row become one: the first run's crossings, then the second's (from where the first stopped) */
  function merge(x, y) {
    const keep = x.segs.filter((s) => s.cross), tail = x.segs.find((s) => !s.cross);
    const next = y.segs.map((s) => ({ ...s }));
    if (tail && next.length) next[0].a = Math.min(next[0].a, tail.a);
    return { ...x, lvl: Math.max(x.lvl, y.lvl), segs: [...keep, ...next], minor: x.minor && y.minor };
  }
  /* put items into a queue: same bar merges, skill-ups before creeps, the level-up last; at most `max` items, creeps dropped first */
  const rank = (it) => (it.kind === "level" ? 2 : it.minor ? 1 : 0);
  function enqueue(q, items, max = 10) {
    for (const it of items) {
      const i = q.findIndex((o) => o.kind === it.kind && o.name === it.name);
      if (i >= 0) q[i] = merge(q[i], it); else q.push(it);
    }
    q.sort((a, b) => rank(a) - rank(b));   // stable: keeps the order things happened in within each group
    while (q.length > max) { const j = q.map(rank).lastIndexOf(1); q.splice(j >= 0 ? j : 0, 1); }
    return q;
  }
  /* a skill's before/after into a queue item (null when nothing moved) */
  function skillItem(name, before, after, need) {
    if (!before || !after || (after.lvl === before.lvl && after.xp <= before.xp + 1e-9)) return null;
    const segs = run(before, after, need);
    return { kind: "skill", name, lvl: after.lvl, segs, minor: !segs.some((s) => s.cross) };
  }
  /* creeps after a fight: only the few that moved the most, so a long fight doesn't spam */
  function pickCreeps(items, n = 3) {
    const gain = (it) => it.segs.reduce((t, s) => t + (s.b - s.a), 0);
    return items.filter((it) => it.minor).sort((a, b) => gain(b) - gain(a)).filter((it) => gain(it) >= 0.01).slice(0, n);
  }
  /* the lines under a result that the toasts don't already show: follower words etc. (skill-ups and the level-up go to toasts) */
  const UPLINE = /(^|\s)[A-Z][A-Za-z'\- ]*? increased to \d+\.?$|^You reached level \d+/;
  const others = (list) => (list || []).filter((l) => !UPLINE.test(String(l).trim()));
  /* where the toast sits from where the lane would be */
  function spot(laneTop, area, st, covered, vw) {
    const A = !covered && area && area.width > 200 ? area : { left: 0, width: vw };
    const w = Math.round(Math.max(200, Math.min(440, A.width - 24)));
    return { left: Math.round(A.left + (A.width - w) / 2), width: w, top: Math.round(covered ? st + 8 : laneTop) };
  }

  // ------------------------------------------------------------ words (Polish through i18n)
  const PL = { "Level up": "Nowy poziom", "Level {0}": "Poziom {0}", "{0} increased to {1}": "{0} wzrasta do {1}", "Choose health, magicka or stamina": "Wybierz zdrowie, magię lub wytrzymałość", "Tap to skip": "Dotknij, aby pominąć",
    // the patch note
    "Skill-ups like in Skyrim": "Wzrost umiejętności jak w Skyrim",
    "When a skill rises, a notice at the top of the screen says so (\"One-Handed increased to 31\") over a thin bar that fills up. When it crosses a level, the bar fills to the end, flashes, chimes softly and starts again from zero.":
      "Gdy umiejętność rośnie, na górze ekranu pojawia się napis (\"Broń jednoręczna wzrasta do 31\") nad cienkim paskiem, który się napełnia. Po przekroczeniu poziomu pasek dobiega do końca, błyska, cicho dzwoni i rusza od zera.",
    "Several skills play one after another, quickly. Tap the notice to skip ahead.": "Kilka umiejętności pokazuje się po kolei, szybko. Dotknij napisu, żeby przewinąć dalej.",
    "After a fight, skills that grew a little without levelling show their bar creeping up for a moment.": "Po walce umiejętności, które urosły trochę bez nowego poziomu, na chwilę pokazują pełznący pasek.",
    "A new character level gets its own bigger Level up banner with your level bar.": "Nowy poziom postaci ma własny, większy baner Nowy poziom z paskiem poziomu.",
    "The fight result no longer lists skill-ups as one long line; your follower's words after a fight are a line of their own.": "Wynik walki nie wypisuje już wzrostu umiejętności w jednej długiej linii; słowa towarzysza po walce mają własną linię." };
  if (typeof I18N !== "undefined" && I18N.PL) for (const [k, v] of Object.entries(PL)) if (!(k in I18N.PL)) I18N.PL[k] = v;
  const pl = () => { try { return typeof I18N !== "undefined" && I18N.lang() === "pl"; } catch { return false; } };
  const L = (en, ...a) => (pl() && PL[en] ? PL[en] : en).replace(/\{(\d)\}/g, (m, i) => a[+i] ?? "");
  const skName = (n) => (pl() && typeof I18N !== "undefined" && I18N.SKILLS?.[n]) || n;

  // ------------------------------------------------------------ the queue and the toast
  const queue = [];
  const recent = new Map();   // "skill|Name|31" / "level|12" → when it was queued, so the old banners don't show it again
  const mark = (k) => { recent.set(k, Date.now()); if (recent.size > 60) recent.delete(recent.keys().next().value); };
  const fresh = (k) => Date.now() - (recent.get(k) || 0) < 15000;
  let cur = null, timer = 0, raf = 0, waitT = 0;
  const reduce = () => { try { return typeof ACCESS !== "undefined" && ACCESS.reduceMotion ? ACCESS.reduceMotion() : matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const chime = (n) => { try { if (typeof SOUND !== "undefined") SOUND.fx(n); } catch { /* sound is optional */ } };
  function host() {
    if (!live || !document.body) return null;
    let el = document.getElementById("skillup");
    if (!el) {
      el = document.createElement("div"); el.id = "skillup"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
      el.addEventListener("click", (e) => { e.stopPropagation(); skip(); });
      document.body.appendChild(el);
    }
    return el;
  }
  function add(items) {
    items = items.filter(Boolean); if (!items.length) return;
    for (const it of items) mark(it.kind === "level" ? `level|${it.lvl}` : `skill|${it.name}|${it.lvl}`);
    enqueue(queue, items);
    if (live && !cur) { clearTimeout(waitT); waitT = setTimeout(next, 120); }
  }
  /* a fight screen on top: wait for it to close (but not forever) */
  let waited = 0;
  function next() {
    if (!live) return;
    if (document.querySelector("#tbf, #tbwatch") && waited < 8000) { waited += 300; waitT = setTimeout(next, 300); return; }
    waited = 0;
    const el = host(); cur = queue.shift() || null;
    if (!el) return;
    if (!cur) { el.classList.remove("on"); el.innerHTML = ""; place(); return; }
    show(el, cur);
  }
  function show(el, it) {
    const big = it.kind === "level";
    const title = big ? L("Level up") : it.minor ? `${skName(it.name)} ${it.lvl}` : L("{0} increased to {1}", skName(it.name), it.lvl);
    const sub = big ? `<small class="su-s">${esc(L("Level {0}", it.lvl))} · ${esc(L("Choose health, magicka or stamina"))}</small>` : "";
    const px = typeof ART !== "undefined" && ART.style && ART.style() === "pixel";
    el.className = `on su-${it.kind}${it.minor ? " su-minor" : ""}${px ? " su-px" : ""}`;
    el.title = L("Tap to skip");
    el.innerHTML = `<div class="su-in"><b class="su-t">${esc(title)}</b>${sub}<div class="su-bar"><i class="su-cap"></i><span class="su-tr"><i class="su-fill"></i></span><i class="su-cap"></i></div></div>`;
    place();
    animate(el, it);
  }
  /* the bar: each segment fills over its share of the time; a crossing flashes and chimes, then the bar restarts at 0 */
  function animate(el, it) {
    const fill = el.querySelector(".su-fill"), total = dur(it), last = it.segs[it.segs.length - 1] || { b: 0 };
    const setW = (x) => { if (fill) fill.style.transform = `scaleX(${clamp01(x).toFixed(4)})`; };
    cancelAnimationFrame(raf); clearTimeout(timer);
    if (reduce()) { setW(last.b); if (crossings(it)) chime(it.kind === "level" ? "levelup" : "heal"); timer = setTimeout(done, total); return; }
    const FL = 200, fillTime = Math.max(300, total - 420), spans = it.segs.map((s) => Math.max(0.12, s.b - s.a)), sum = spans.reduce((a, b) => a + b, 0) || 1;
    const plan = []; let t = 0;
    it.segs.forEach((s, i) => { const d = (fillTime - FL * crossings(it)) * spans[i] / sum; plan.push({ s, t0: t, t1: t + d }); t += d + (s.cross ? FL : 0); });
    setW(it.segs[0]?.a || 0);
    const t0 = performance.now(); let flashed = -1;
    const step = (now) => {
      const e = now - t0;
      for (let i = 0; i < plan.length; i++) {
        const p = plan[i];
        if (e < p.t0) break;
        if (e <= p.t1) { const k = (e - p.t0) / (p.t1 - p.t0 || 1), ease = 1 - (1 - k) * (1 - k); setW(p.s.a + (p.s.b - p.s.a) * ease); break; }
        if (p.s.cross && flashed < i) { flashed = i; setW(1); el.classList.remove("su-flash"); void el.offsetWidth; el.classList.add("su-flash"); chime(it.kind === "level" ? "levelup" : "heal"); }
        if (i === plan.length - 1) setW(p.s.b);
      }
      if (e < total) raf = requestAnimationFrame(step); else done();
    };
    raf = requestAnimationFrame(step);
    timer = setTimeout(done, total + 400);   // a hidden tab stops rAF: never get stuck
  }
  function done() {
    cancelAnimationFrame(raf); clearTimeout(timer);
    const el = host(); if (!el) return;
    el.classList.add("su-out");
    timer = setTimeout(next, reduce() ? 0 : 160);
  }
  function skip() { if (!cur) return; const fill = host()?.querySelector(".su-fill"), last = cur.segs[cur.segs.length - 1]; if (fill && last) fill.style.transform = `scaleX(${last.b})`; done(); }
  function place() { try { if (typeof HUD2 !== "undefined") HUD2.place(); else dock({ top: 8, st: 0 }); } catch { /* layout only */ } }
  /* hud2.js asks where the lane goes; the toast takes the top of the lane and the lane moves down by its height */
  function dock(o) {
    const el = live ? document.getElementById("skillup") : null;
    if (!el || !el.classList.contains("on")) return 0;
    const covered = !!document.querySelector("#modal .sheet, #sky") || !!o.tw;
    const p = spot(o.top, o.m, o.st || 0, covered, innerWidth);
    const tip = document.querySelector(".obtip"), tr = tip && tip.getClientRects().length ? tip.getBoundingClientRect() : null;   // a first-hour tip sits at the top: go under it
    if (tr && tr.bottom > p.top && tr.top < p.top + el.offsetHeight) p.top = Math.round(tr.bottom + 6);
    el.style.left = p.left + "px"; el.style.width = p.width + "px"; el.style.top = p.top + "px";
    return covered ? 0 : el.offsetHeight + 6;
  }

  // ------------------------------------------------------------ hooks: where skill XP is given
  const needOf = (name) => (lvl) => (typeof F !== "undefined" ? F.skillXpNeeded(name, lvl) : 100);
  const charNeed = (lvl) => (typeof F !== "undefined" ? F.charXpNeeded(lvl) : 100);
  const snap = (s) => ({ sk: Object.fromEntries(Object.entries(s.skills || {}).map(([k, v]) => [k, { lvl: v.lvl, xp: v.xp }])), level: s.level, cx: s.charXp || 0 });
  const mine = (s) => live && s && !s._test && s.skills && (!window.__dbg || window.__dbg.save() === s);
  function levelItem(b, s) {
    if (!(s.level > b.level)) return null;
    return { kind: "level", name: "level", lvl: s.level, segs: run({ lvl: b.level, xp: b.cx }, { lvl: s.level, xp: s.charXp || 0 }, charNeed, Infinity), minor: false };
  }
  /* compare a save before and after: items for every skill that moved (creeps only if asked) and the level-up */
  function diff(b, s, creeps) {
    const items = Object.keys(s.skills).map((k) => skillItem(k, b.sk[k], s.skills[k], needOf(k))).filter(Boolean);
    const ups = items.filter((it) => !it.minor);
    return [...ups, ...(creeps ? pickCreeps(items) : []), levelItem(b, s)].filter(Boolean);
  }
  function install() {
    if (typeof G === "undefined" || install.done) return;
    install.done = true;
    if (G.Fight?.prototype?.apply) {
      const ap = G.Fight.prototype.apply;
      G.Fight.prototype.apply = function (...a) {
        const s = this.s, b = mine(s) ? snap(s) : null;
        const out = ap.apply(this, a);
        if (b) try { add(diff(b, s, true)); } catch (e) { /* never break a fight */ }
        return out;
      };
    }
    if (G.useSkill) {
      const us = G.useSkill;
      G.useSkill = function (s, name, ...a) {
        const b = mine(s) && s.skills[name] ? snap(s) : null;
        const out = us.call(this, s, name, ...a);
        if (b) try { add([skillItem(name, b.sk[name], s.skills[name], needOf(name)), levelItem(b, s)].filter((it) => it && !it.minor)); } catch (e) { /* never break */ }
        return out;
      };
    }
  }
  install();
  /* polish.js asks before it shows its old banner: skill-ups and level-ups are ours. Ones we already showed are dropped;
     ones from elsewhere (a skill book, a trainer) get a toast here with the bar from the save. */
  function claim(kind, big) {
    if (!live || (kind !== "skill" && kind !== "level")) return false;
    const S = window.__dbg?.save?.();
    if (kind === "level") {
      const lvl = +(String(big).match(/(\d+)/) || [])[1]; if (!lvl) return true;
      if (!fresh(`level|${lvl}`)) add([{ kind: "level", name: "level", lvl, segs: [{ a: 0, b: S && S.level === lvl ? frac(0, S.charXp || 0, charNeed(lvl), Infinity) : 0, lvl, cross: false }], minor: false }]);
      return true;
    }
    for (const part of String(big).split(" · ")) {
      const m = part.match(/^(.+?) (\d+)$/); if (!m) continue;
      const name = m[1].trim(), lvl = +m[2]; if (fresh(`skill|${name}|${lvl}`)) continue;
      const sk = S?.skills?.[name], end = sk && sk.lvl === lvl ? frac(lvl, sk.xp, needOf(name)(lvl)) : 0;
      add([{ kind: "skill", name, lvl, segs: [{ a: 0.8, b: 1, lvl, cross: true }, { a: 0, b: end, lvl, cross: false }], minor: false }]);
    }
    return true;
  }

  return { frac, run, dur, merge, enqueue, skillItem, pickCreeps, others, spot, diff, claim, dock, add, skip, install, PL, get queue() { return queue; }, get current() { return cur; } };
})();
