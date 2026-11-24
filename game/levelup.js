/* Levelling like Skyrim ([Skyrim] rules, [OURS] look). The rules live in engine.js (G.useSkill → G.skillRose):
   - using a skill raises it; each skill increase adds character XP equal to the skill's new level;
   - a level needs (level + 3) × 25 character XP (F.charXpNeeded);
   - every level gives one perk point (perks.js) and one choice: +10 Health, +10 Magicka or +10 Stamina
     (Stamina also +5 carry weight). Choices can wait: they bank up, and the Skills screen asks for them.
   This file is what you see and hear around that:
   - "One-Handed increased to 36" centred near the top, with a thin bar for the skill and the level bar under it;
   - a big "LEVEL UP" moment with the new level, the bar fills and starts again;
   - the three pillars (Health / Magicka / Stamina) to spend a banked level-up, opened from the Skills screen
     or from the compass (the Skills direction says "Level up" while one is waiting);
   - a hook other systems can listen to: LEVELUP.on("level", ({ s, level }) => ...) (also "skill" and "choice"),
     and a window "levelup" event in the browser with { detail: { level } } for the player's own hero.
   Followers level on their own (followers2.js) and are not touched here. */
const LEVELUP = (() => {
  const DOM = typeof document !== "undefined" && typeof document.createElement === "function";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PER = () => (typeof F !== "undefined" && F.ATTRIBUTE_PER_LEVEL) || 10;
  const CARRY = () => (typeof F !== "undefined" && F.CARRY_PER_STAMINA_LEVEL) || 5;
  const need = (level) => (typeof F !== "undefined" ? F.charXpNeeded(level) : (level + 3) * 25);

  // ------------------------------------------------------------ events (any module can listen)
  const subs = {};
  function on(type, fn) {
    if (typeof type === "function") { fn = type; type = "level"; }
    (subs[type] = subs[type] || []).push(fn);
    return () => { subs[type] = (subs[type] || []).filter((f) => f !== fn); };
  }
  function emit(type, d) {
    for (const fn of (subs[type] || []).slice()) { try { fn(d); } catch (e) { /* a listener never breaks levelling */ } }
  }

  // ------------------------------------------------------------ pure helpers (tested in node)
  /* character XP needed to go from level 1 to `level` */
  function xpTo(level) { let t = 0; for (let l = 1; l < level; l++) t += need(l); return t; }
  function progress(s) {
    const n = need(s.level), xp = Math.max(0, +s.charXp || 0);
    return { level: s.level, xp, need: n, pct: Math.max(0, Math.min(100, Math.round(100 * xp / n))), pending: s.pendingLevels || 0 };
  }
  const pending = (s) => Math.max(0, s.pendingLevels || 0);
  /* the three pillars: what each one is now and after the choice */
  function choices(s) {
    const p = PER(), hp = G.maxHealth(s), mp = G.maxMagicka(s), sp = G.maxStamina(s), cap = G.capacity(s);
    return [
      { attr: "health", name: "Health", now: hp, next: hp + p, extra: "" },
      { attr: "magicka", name: "Magicka", now: mp, next: mp + p, extra: "" },
      { attr: "stamina", name: "Stamina", now: sp, next: sp + p, extra: `Carry weight ${Math.round(cap)} → ${Math.round(cap) + CARRY()}` },
    ];
  }
  /* old saves: the rules didn't change (always Skyrim's), so a save keeps its level, its perks and its choices.
     This only tidies numbers a bug or an old version could have left odd, and spends XP that already reached a level. */
  function migrate(s) {
    if (!s || typeof s !== "object") return null;
    s.level = Math.max(1, Math.floor(+s.level || 1));
    s.charXp = Number.isFinite(+s.charXp) ? Math.max(0, +s.charXp) : 0;
    s.pendingLevels = Math.max(0, Math.floor(+s.pendingLevels || 0));
    for (const k of ["hpBonus", "mpBonus", "spBonus"]) s[k] = Number.isFinite(+s[k]) ? +s[k] : 0;
    let up = 0;
    while (s.charXp >= need(s.level)) { s.charXp -= need(s.level); s.level += 1; s.pendingLevels += 1; up++; }
    return up ? `You reached level ${s.level}! Open Skills to choose what grows.` : null;
  }
  /* what other players see of you (party cards, roster): your three maximums and how far to the next level */
  function cardBits(s) {
    try { return { vit: [Math.round(G.maxHealth(s)), Math.round(G.maxMagicka(s)), Math.round(G.maxStamina(s))], lvp: progress(s).pct, lvq: pending(s) ? 1 : 0 }; } catch { return {}; }
  }
  /* "Level 12 · 120 health · 110 magicka · 150 stamina" for someone else's card */
  function cardText(c) {
    if (!c || !Array.isArray(c.vit)) return "";
    return ` · ♥${c.vit[0]} ✦${c.vit[1]} ⚡${c.vit[2]}`;
  }
  /* the prompt on the Skills screens while a level-up waits */
  function promptHTML(s) {
    const n = pending(s); if (!n) return "";
    return `<button class="lvlprompt" data-act="lvlpick"><span class="lvp-ar" aria-hidden="true">▲</span><span class="lvp-tx"><b>Level up</b><small>${n > 1 ? `${n} level-ups waiting · ` : ""}Choose Health, Magicka or Stamina</small></span></button>`;
  }

  // ------------------------------------------------------------ the screen side (browser only)
  let api = null, mounted = false;
  const reduce = DOM && typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mine = (s) => api && s && s === api.S();
  const queue = []; let busy = false, timer = null;
  function host() {
    let el = document.getElementById("lvln");
    if (!el) { el = document.createElement("div"); el.id = "lvln"; el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
    return el;
  }
  function onSkill({ s, skill, lvl, from: fl, fromXp }) {
    if (!mine(s)) return;
    const k = s.skills[skill], n = k && k.lvl < 100 ? F.skillXpNeeded(skill, k.lvl) : 0;
    const now = progress(s), lv0 = fl || now.level, from = { level: lv0, pct: Math.max(0, Math.min(100, Math.round(100 * (fromXp || 0) / need(lv0)))) };   // where the level bar stood before this rise
    const skPct = n ? Math.max(0, Math.min(100, Math.round(100 * k.xp / n))) : 100;
    // a burst (a long fight, the Oghma): the same skill again in a row is one line, the newest number wins
    const same = queue[queue.length - 1];
    if (same && same.kind === "skill" && same.skill === skill) { same.lvl = Math.max(same.lvl, lvl); same.skPct = skPct; same.to = now; same.up = same.up || now.level > same.from.level; }
    else queue.push({ kind: "skill", skill, lvl, skPct, from, to: now, up: now.level > from.level });
    pump();
  }
  function onLevel({ s, level }) {
    if (!mine(s)) return;
    queue.push({ kind: "level", level, to: progress(s) });
    try { window.dispatchEvent(new CustomEvent("levelup", { detail: { level } })); } catch { /* old browsers */ }
    try { api.publishCard && api.publishCard(); } catch { /* sync on the next tick */ }
    pump();
  }
  const blocked = () => !!document.querySelector("#tbf, #lockpick, #pickgame");   // a turn-based fight or a mini-game: wait
  function pump() {
    if (busy || !queue.length) return;
    if (blocked()) { clearTimeout(timer); timer = setTimeout(pump, 800); return; }
    const it = queue.shift(), S = api.S();
    if (!S || (it.kind === "level" && S.level < it.level)) { pump(); return; }   // undone (sold back an item…): nothing to celebrate
    busy = true;
    const el = host(), node = document.createElement("div");
    const lvBar = (lv, a, b) => `<div class="lvn-lv"><span class="num">${lv}</span><i class="lvn-xb"><i style="width:${a}%" data-to="${b}"></i></i><span class="num">${lv + 1}</span></div>`;
    let life;
    if (it.kind === "skill") {
      const skIc = typeof UIART !== "undefined" ? UIART.skill(it.skill, 22) : "";
      node.className = "lvn lvn-skill";
      node.innerHTML = `<p class="lvn-t">${skIc}<span>${esc(it.skill)} increased to ${it.lvl}</span></p><i class="lvn-sb"><i style="width:0%" data-to="${it.skPct}"></i></i>${lvBar(it.from.level, it.from.pct, it.up ? 100 : it.to.pct)}`;
      life = queue.length > 3 ? 1300 : 2300;
    } else {
      node.className = "lvn lvn-level";
      node.innerHTML = `<p class="lvn-big">Level up</p><p class="lvn-n num">${it.level}</p>${lvBar(it.level - 1, 100, 100)}`;
      life = 3400;
      try { SOUND.fx("levelup"); } catch { /* sound never breaks the game */ }
      try { if (typeof POLISH !== "undefined" && POLISH.burst) POLISH.burst(); } catch { /* decoration */ }
    }
    el.appendChild(node);
    const fill = () => node.querySelectorAll("[data-to]").forEach((b) => { b.style.width = `${b.dataset.to}%`; });
    if (reduce) fill(); else requestAnimationFrame(() => requestAnimationFrame(fill));
    if (it.kind === "level") {   // the bar is full: it starts again from where the new level stands
      setTimeout(() => {
        const lv = node.querySelector(".lvn-lv"); if (!lv) return;
        lv.outerHTML = lvBar(it.level, 0, it.to.level === it.level ? it.to.pct : 0);
        if (reduce) fill(); else requestAnimationFrame(() => requestAnimationFrame(fill));
      }, reduce ? 300 : 1500);
    }
    setTimeout(() => { node.classList.add("out"); setTimeout(() => { node.remove(); busy = false; pump(); }, reduce ? 0 : 380); }, life);
  }

  // ---- the pillars
  let after = null;
  function pickHTML(S) {
    const n = pending(S), ic = (a) => (typeof UIART !== "undefined" && UIART.attr ? UIART.attr(a, 40) : "");
    const pts = typeof PERKS !== "undefined" ? PERKS.pointsLeft(S) : 0;
    return `<div class="lvk-in" role="dialog" aria-label="Level up">
      <p class="lvk-k">Level ${S.level}</p><h2 class="lvk-h">Choose what grows</h2>
      <p class="lvk-s">${n > 1 ? `<span>${n} level-ups to spend</span> · ` : ""}<span>Each gives +${PER()} to one of these</span>${pts > 0 ? ` · <span>${pts} perk point${pts === 1 ? "" : "s"} to spend</span>` : ""}</p>
      <div class="lvk-cols">${choices(S).map((c) => `<button class="lvk-p lvk-${c.attr}" data-lvk="${c.attr}"><span class="lvk-cap" aria-hidden="true"></span>${ic(c.attr)}<b>${c.name}</b><span class="lvk-v num">${c.now} <i>→</i> <em>${c.next}</em></span>${c.extra ? `<small>${esc(c.extra)}</small>` : "<small>&nbsp;</small>"}<span class="lvk-base" aria-hidden="true"></span></button>`).join("")}</div>
      <button class="btn ghost lvk-later" data-lvk="later">Decide later</button></div>`;
  }
  function open(then) {
    const S = api && api.S(); if (!DOM || !S || !pending(S)) { if (then) then(); return false; }
    after = then || null;
    let el = document.getElementById("lvlpick");
    if (!el) {
      el = document.createElement("div"); el.id = "lvlpick"; el.className = "lvk";
      el.addEventListener("click", onPick); document.body.appendChild(el);
    }
    el.innerHTML = pickHTML(S);
    try { SOUND.fx("page"); } catch { /* ignore */ }
    return true;
  }
  function close() {
    document.getElementById("lvlpick")?.remove();
    const f = after; after = null; if (f) f();
  }
  function onPick(e) {
    const b = e.target.closest("[data-lvk]");
    if (!b) { if (e.target.id === "lvlpick") close(); return; }
    const a = b.dataset.lvk; if (a === "later") return close();
    const S = api.S(), msg = G.levelUp(S, a);
    try { SOUND.fx("levelup", 0.25); } catch { /* ignore */ }
    api.persist(true); api.toast(msg);
    if (pending(S)) { const el = document.getElementById("lvlpick"); el.innerHTML = pickHTML(S); el.querySelector(`.lvk-${a}`)?.classList.add("lvk-took"); }
    else close();
    try { api.refresh(); } catch { /* ignore */ }
  }
  const isOpen = () => DOM && !!document.getElementById("lvlpick");

  /* ui.js: mount({ S, persist, toast, refresh, publishCard }) once the game is running */
  function mount(o) {
    api = o;
    if (mounted) return; mounted = true;
    on("skill", onSkill); on("level", onLevel);
  }
  return { on, emit, xpTo, need, progress, pending, choices, migrate, cardBits, cardText, promptHTML, mount, open, close, get isOpen() { return isOpen(); }, get live() { return mounted; } };
})();
