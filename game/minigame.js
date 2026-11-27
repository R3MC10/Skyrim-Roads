/* minigame.js: a quick skill game on every move you make yourself in a turn-by-turn fight. [OURS]
   Owner (build 145): "where are the spell minigames? and attack minigames for combat?"
   - Weapon blows: a marker sweeps along a bar, tap when it's in the bright zone (Perfect / Good / Miss).
   - Power attacks: the same, faster and with a narrower zone, but a Perfect hits much harder.
   - Bows: hold to draw, the circle closes on the target; let go when it sits on the gold ring (wait too long and your
     arm shakes it wide again).
   - Guard / shield bash: the foe's blow closes in as a ring; press as it meets your shield.
   - Spells: glowing points of the school's rune light up; tap them in order (or trace across them) before the cast
     fizzles. Destruction is a quick three-point strike, Restoration a calm circle, Alteration a square, Illusion's
     points drift about, Conjuration is a five-point star.
   Good = the normal hit. Perfect = 25% more (40% for a power attack) and +1 stack of the move's effect (stacks.js).
   Miss = 20% less (25% for a power attack). Higher skill and some perks ("timing") widen the zone and slow the clock.
   Moves from items [itemgames]: Shield bash is a timed shove (the parry ring), a staff draws its spell's rune, a scroll
   its spell's rune, an oil flask is thrown (strike bar: a Perfect soaks the foe a round longer, a Miss a round shorter).
   Potions, poisons (poisonfight.js), food and fleeing have no game.
   [mgunique] Owner (27 Nov 2026): "Mini games in combat should be unique by weapon type, by spell school, by action."
   kindFor now also names the exact game (g.id: dagger, sword, axe, ..., guard, bash, shout, sneak, destruction-fire,
   alteration, ...) and mg_games.js registers one game per id (MINIGAME.register). The bar / bow / rune games above stay
   as the fallback and as "Simple (one tap)" in Settings. Shouts now get a game too (hold on the first word, let go on
   the last; a Perfect gives +1 Might). Grades, multipliers, the widening by skill/perks and o.onProgress are unchanged.
   Auto and the AI never play it (normal damage). Settings → Fights → Minigames turns it off.
   In a party fight each player plays it on their own phone in their own turn (sharedfight.js uses the same screen).
   [channel] o.onProgress(0..1) reports how far a game that can measure it got (the rune's points, the bow's draw):
   channel.js fills the bar teammates see over your hero. Nothing else of the game ever leaves your phone. */
const MINIGAME = (() => {
  const DOM = typeof document !== "undefined";
  const prefs = () => { try { return JSON.parse(localStorage.getItem("rotn_prefs") || "{}"); } catch { return {}; } };
  const GRADES = {
    normal: { perfect: 1.25, good: 1, miss: 0.8 },
    power: { perfect: 1.4, good: 1, miss: 0.75 },
  };
  const SCHOOLS = {
    Destruction: { pts: [[50, 18], [80, 74], [20, 74]], time: 2300, col: "#ff8a3d", drift: 0 },
    Restoration: { pts: [[50, 15], [83, 39], [71, 79], [29, 79], [17, 39]], time: 3400, col: "#ffe58a", drift: 0, circle: true },
    Alteration: { pts: [[22, 22], [78, 22], [78, 78], [22, 78]], time: 3000, col: "#8ad1ff", drift: 0 },
    Illusion: { pts: [[30, 25], [72, 35], [60, 75], [25, 68]], time: 3200, col: "#c99bff", drift: 1 },
    Conjuration: { pts: [[50, 12], [72, 82], [14, 38], [86, 38], [28, 82]], time: 3600, col: "#9dffb5", drift: 0 },
    Mysticism: { pts: [[30, 30], [70, 30], [50, 75]], time: 3000, col: "#7fe0d6", drift: 0 },
  };
  /* [mgunique] every weapon type, spell school and move has its own game (mg_games.js registers them by id).
     Owner (27 Nov): "Mini games in combat should be unique by weapon type, by spell school, by action."
     The grade tables above stay the same for all of them: Good = a normal hit, Perfect/Miss as before. */
  const REG = {};
  function register(id, build) { REG[id] = build; }
  const simple = () => { const p = prefs(); return p.tbGamesSimple === true; };   // Settings → Fights → Simple minigames: one tap for everything
  const reduced = () => { try { return !!(DOM && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
  const WEAPON_IDS = { dagger: "dagger", sword: "sword", axe: "axe", mace: "mace", greatsword: "greatsword", battleaxe: "battleaxe", warhammer: "warhammer", spear: "spear", bow: "bow", crossbow: "crossbow", fist: "fist", staff: "staff", claw: "claw" };
  /* what kind of blow is coming at your guard: an arrow, a claw, a spell or a blade */
  function incoming(f) {
    const e = f && f.e; if (!e) return "blade";
    const fp = e.fp || null, n = String(e.name || "");
    if ((fp && fp.caster) || /mage|wizard|necromancer|sorcer|witch|shaman|priest|atronach|wisp|hagraven|lich/i.test(n)) return "spell";
    if (/archer|hunter|ranger|marksman|bow|scout/i.test(n)) return "arrow";
    const tags = new Set(e.tags || []);
    if (tags.has("spirit")) return "spell";
    if (tags.has("beast") || tags.has("animal") || tags.has("dragon") || /wolf|bear|cat|troll|skeever|spider|chaurus|mudcrab|horker|mammoth|sabre/i.test(n)) return "claw";
    return "blade";
  }
  function on() {
    const p = prefs();
    if (p.tbGames === false) return false;
    if (DOM && typeof location !== "undefined" && /[?&]games\b/.test(location.search)) return true;
    if (p.tbGames === true) return true;
    return !(typeof navigator !== "undefined" && navigator.webdriver);   // older screen tests click straight through
  }
  const isBow = (f) => f.wt === "bow" || f.wt === "crossbow";
  const spellOf = (a) => {
    const [k, arg] = String(a).split(":");
    if ((k === "spell" || k === "dual") && typeof D !== "undefined") return D.SPELLS[arg] || null;
    if (k === "scroll" && typeof D !== "undefined") return D.SPELLS[D.ITEMS[arg]?.spell] || null;
    return null;
  };
  /* a staff in your hand casts its spell instead of swinging (magic.js staffAttack): it draws that spell's rune */
  const staffSpell = (f) => (f && f.weapon && f.weapon.staff && !f.bound && typeof D !== "undefined" ? D.SPELLS[f.weapon.staff.spell] || null : null);
  /* which game a move gets (null: none, e.g. potions, poisons, Breathe, End turn) */
  function kindFor(f, a) {
    const g = kindBase(f, a);
    if (!g) return null;
    if (!g.id) {
      if (g.kind === "rune") g.id = g.staff ? "staff" : String(g.school).toLowerCase() + (g.school === "Destruction" ? "-" + ((g.spell && g.spell.element) || "fire") : "") + (g.spell && g.spell.kind === "healally" ? "-ally" : "");
      else if (g.kind === "parry") { g.id = g.shove ? "bash" : "guard"; if (!g.shove) g.foe = incoming(f); }
      else if (g.toss) g.id = "toss";
      else if (g.kind === "shout") g.id = "shout";
      else if (a === "beast:claw" || a === "lord:claw" || a === "beast:maul") g.id = "claw";
      else if (f.hidden && (a === "attack" || a === "power_attack") && g.kind !== "aim") g.id = "sneak";   // your first strike from hiding
      else if (f.off && (a === "attack" || a === "power_attack") && g.kind !== "aim") g.id = "dual";   // two blades: two lanes
      else g.id = WEAPON_IDS[f.wt] || (g.kind === "aim" ? "bow" : "sword");
    }
    if (String(a).startsWith("dual:") && g.kind === "rune") g.dual = true;   // a dual cast: both thumbs
    return g;
  }
  function kindBase(f, a) {
    if (!f || !a) return null;
    if (a === "attack" || a === "power_attack") {   // [itemgames] a staff: the rune of its spell's school
      const st = staffSpell(f);
      if (st && st.kind !== "utility") return { kind: "rune", school: SCHOOLS[st.school] ? st.school : "Destruction", spell: st, staff: true, label: f.weapon.name };
    }
    if (a === "bash") return { kind: "parry", shove: true, label: "Shield bash" };   // [itemgames] your shield meets the foe
    if (a === "rx:oil") return { kind: "strike", toss: true, label: "Oil flask" };   // [itemgames] throw it true: the foe stays soaked longer
    if (a === "attack" || a === "beast:claw" || a === "lord:claw") return isBow(f) && a === "attack" ? { kind: "aim" } : { kind: "strike" };
    if (a === "power_attack" || a === "beast:maul") return isBow(f) && a === "power_attack" ? { kind: "aim", hard: true } : { kind: "power" };
    if (a === "block") return { kind: "parry" };
    if (/^shout:/.test(a)) { let words = 1; try { const k = a.split(":")[1]; words = Math.max(1, Math.min(3, (typeof POWERS !== "undefined" && POWERS.level && f.s ? POWERS.level(f.s, k) : 1) || 1)); } catch (e) { words = 1; } return { kind: "shout", words, label: "Shout" }; }   // [mgunique] shouts get a game too
    const sp = spellOf(a);
    if (sp && sp.kind !== "utility") return { kind: "rune", school: SCHOOLS[sp.school] ? sp.school : "Destruction", spell: sp };
    return null;
  }
  /* how wide the sweet spot is: skill and "timing" perks (perkfx.js) widen it */
  function width(f, a, g) {
    const s = f.s, sk = (n) => { try { const v = typeof G !== "undefined" && G.skill && s ? G.skill(s, n) : 15; return Number.isFinite(v) ? v : 15; } catch (e) { return 15; } };   // an unknown skill name must never break the game (hotfix: "Block" used to throw, so guards and shield bashes never got one)
    const skill = g.kind === "rune" ? sk(g.school) : a === "block" || a === "bash" ? sk("Blocking") : a === "rx:oil" ? sk("Archery") : sk(f.weapon?.skill || (isBow(f) ? "Archery" : "One-Handed"));
    const perk = typeof PFX !== "undefined" && s ? PFX.num(s, "timing") : 0;
    return Math.min(1.9, (1 + Math.max(0, skill - 15) / 100) * (1 + (perk || 0))) * (typeof DIFF !== "undefined" ? DIFF.window(f) : 1);   // Story wider, Hard tighter (difficulty.js)
  }
  /* turn a score (0..1, 1 = dead centre) into a grade */
  function grade(score, g) {
    const t = GRADES[g.kind === "power" || g.hard ? "power" : "normal"];
    if (score >= 0.75) return { mult: t.perfect, label: "Perfect!", cls: "perfect", kind: g.kind };
    if (score >= 0.35) return { mult: t.good, label: "Good", cls: "good", kind: g.kind };
    return { mult: t.miss, label: g.kind === "rune" ? "Fizzled" : g.kind === "parry" ? "Late" : "Miss", cls: "poor", kind: g.kind };
  }
  /* balance sims: what an average player rolls (a quarter Perfect, a fifth Miss) */
  function simGrade(g, rnd = Math.random) { const r = rnd(); return grade(r < 0.25 ? 0.9 : r < 0.8 ? 0.5 : 0.1, g || { kind: "strike" }); }

  // ------------------------------------------------------------------ what a Perfect adds (+1 stack, stacks.js)
  const BLADE = new Set(["dagger", "sword", "axe", "greatsword", "battleaxe", "spear", "claw"]);
  function perfect(f, a, before) {
    if (typeof STACKS === "undefined" || !f) return "";
    const g = kindFor(f, a); if (!g) return "";
    const tr = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);
    const say = (n, what) => ` · ${tr("Perfect")}: +${n} ${tr(what)}`;
    if (g.toss) return "";   // the oil flask: itemFx below
    if (g.kind === "shout") { STACKS.add(f, "me", "might", 1); return say(1, "Might"); }   // [mgunique] a shout in rhythm
    if (g.kind === "parry") { STACKS.add(f, "me", "might", 1); STACKS.add(f, "me", "haste", 1); return say(1, "Might, +1 Haste"); }
    if (g.kind === "rune") {
      const sp = g.spell, el = sp.element;
      if (sp.school === "Destruction" && (el === "fire" || el === "frost" || el === "shock") && f.ehp > 0) { const k = { fire: "burn", frost: "chill", shock: "shock" }[el]; STACKS.add(f, "foe", k, 1, { src: "me" }); return say(1, { burn: "Burn", chill: "Chill", shock: "Shock" }[k]); }
      if (sp.school === "Restoration") { STACKS.add(f, "me", "regen", 1); return say(1, "Regen"); }
      if (sp.school === "Alteration") { STACKS.add(f, "me", "ward", 1); return say(1, "Ward"); }
      if (sp.school === "Illusion" && f.ehp > 0) { STACKS.add(f, "foe", "weak", 1, { src: "me" }); return say(1, "Weak"); }
      if (sp.school === "Conjuration") { if (f.summonTurns > 0) f.summonTurns++; STACKS.add(f, "me", "might", 1); return say(1, "Might"); }
      STACKS.add(f, "me", "might", 1); return say(1, "Might");
    }
    if (!(f.ehp > 0) || !(f.ehp < before)) return "";
    const n = g.kind === "power" || g.hard ? 2 : 1;
    if (isBow(f)) { STACKS.add(f, "foe", "vuln", n, { src: "me" }); return say(n, "Vulnerable"); }
    if (BLADE.has(f.wt) || a.startsWith("beast:") || a.startsWith("lord:")) { STACKS.add(f, "foe", "bleed", n, { src: "me" }); return say(n, "Bleed"); }
    STACKS.add(f, "foe", "sunder", n, { src: "me" }); return say(n, "Sunder");
  }

  /* [itemgames] what the grade does to a move that comes from an item, beyond its damage (tbfight.js act). Returns text.
     Oil flask: Perfect soaks the foe a round longer, a Miss splashes most of it on the ground (a round shorter). */
  function itemFx(f, a, gr) {
    if (!f || !gr || a !== "rx:oil") return "";
    const o = f.rx && f.rx.oil; if (!o) return "";
    if (gr.cls === "perfect") { o.until += 1; return ` · ${tr("Perfect")}: ${tr("soaked a round longer")}`; }
    if (gr.cls === "poor") { o.until -= 1; return ` · ${tr("Miss")}: ${tr("most of it splashes on the ground")}`; }
    return "";
  }

  // ------------------------------------------------------------------ the games (each returns a Promise of a grade)
  const tr = (t) => (typeof I18N !== "undefined" && I18N.tr && I18N.lang?.() === "pl" ? I18N.tr(t) ?? t : t);
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  function shell(host, g, o, inner, hint) {
    const el = document.createElement("div");
    el.className = `tbtime mg mg-${g.kind}${g.id ? " mg-id-" + g.id : ""}${g.hard || g.kind === "power" ? " hard" : ""}${g.dual ? " dual" : ""}`; el.setAttribute("role", "button"); el.tabIndex = 0;
    el.setAttribute("aria-label", tr(hint));
    if (g.school && SCHOOLS[g.school]) el.style.setProperty("--mgc", SCHOOLS[g.school].col);
    el.innerHTML = `<div class="tbt-in mg-in">${inner}<b class="tl">${o.icon || ""} ${o.label || ""}</b><small class="mg-hint">${tr(hint)}</small></div>`;
    host.appendChild(el);
    return el;
  }
  function finish(el, gr, done, cleanup) {
    if (el._fin) return; el._fin = true; cleanup();
    el.classList.add("hit", gr.cls); const tl = el.querySelector(".tl"); if (tl) tl.textContent = tr(gr.label);
    if (typeof navigator !== "undefined" && navigator.vibrate) try { navigator.vibrate(gr.cls === "perfect" ? [12, 30, 12] : 10); } catch (e) { /* ignore */ }
    if (gr.cls === "poor" && typeof SOUND !== "undefined" && SOUND.fx) try { SOUND.fx("miss"); } catch (e) { /* ignore */ }
    setTimeout(() => { el.remove(); done(gr); }, gr.cls === "perfect" ? 420 : 260);
  }
  const keys = (fn, up) => {
    const d = (ev) => { if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); if (!ev.repeat) fn(ev); } };
    const u = (ev) => { if (up && (ev.key === " " || ev.key === "Enter")) { ev.preventDefault(); ev.stopPropagation(); up(ev); } };
    addEventListener("keydown", d, true); if (up) addEventListener("keyup", u, true);
    return () => { removeEventListener("keydown", d, true); if (up) removeEventListener("keyup", u, true); };
  };
  /* strike / power / parry: a marker moves, press in the zone */
  function bar(host, g, o, w) {
    return new Promise((done) => {
      const power = g.kind === "power", parry = g.kind === "parry";
      const zone = Math.min(0.4, (power ? 0.13 : parry ? 0.2 : 0.18) * w), centre = 0.3 + Math.random() * 0.4;
      const period = (power ? 900 : parry ? 1400 : 1200) / Math.min(1.4, 0.8 + w * 0.2), limit = period * 2.4;
      const inner = parry
        ? `<svg class="mg-parry" viewBox="0 0 100 100" aria-hidden="true"><circle class="mg-shield" cx="50" cy="50" r="${(14 + zone * 30).toFixed(1)}"/><circle class="mg-blow" cx="50" cy="50" r="46"/></svg>`
        : `<div class="mg-bar" aria-hidden="true"><i class="mg-zone" style="left:${((centre - zone / 2) * 100).toFixed(1)}%;width:${(zone * 100).toFixed(1)}%"></i><i class="mg-pz" style="left:${((centre - zone / 6) * 100).toFixed(1)}%;width:${(zone / 3 * 100).toFixed(1)}%"></i><i class="mg-mark"></i></div>`;
      const el = shell(host, g, o, inner, g.shove ? "Slam as your shield meets the foe" : parry ? "Press as the blow meets your shield" : g.toss ? "Throw in the bright zone" : "Tap in the bright zone");
      const mark = el.querySelector(".mg-mark"), blow = el.querySelector(".mg-blow"), shieldR = 14 + zone * 30;
      const t0 = now(); let raf = 0;
      const pos = () => { const p = ((now() - t0) % (2 * period)) / period; return p <= 1 ? p : 2 - p; };   // back and forth
      const r = () => Math.max(4, 46 - ((now() - t0) / period) * 40);   // parry: the blow closes in once
      const score = () => {
        if (parry) { const d = Math.abs(r() - shieldR) / (zone * 30 + 4); return Math.max(0, 1 - d); }
        const d = Math.abs(pos() - centre) / (zone / 2); return d <= 1 ? 1 - d * 0.62 : Math.max(0, 0.3 - (d - 1) * 0.3);
      };
      let unkey = () => {};
      const stop = () => { cancelAnimationFrame(raf); unkey(); };
      const press = () => finish(el, grade(score(), g), done, stop);
      const frame = () => {
        if (now() - t0 > (parry ? period * 1.15 : limit)) return finish(el, grade(0, g), done, stop);
        if (mark) mark.style.left = (pos() * 100).toFixed(2) + "%";
        if (blow) blow.setAttribute("r", r().toFixed(2));
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      el.addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); press(); });
      el.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); });
      unkey = keys(press);
    });
  }
  /* bows: hold to draw, the circle closes on the target ring; let go on it */
  function aim(host, g, o, w) {
    return new Promise((done) => {
      const target = 16, tol = Math.min(9, 4 * w * (g.hard ? 0.75 : 1)), draw = g.hard ? 900 : 1100;
      const el = shell(host, g, o, `<svg class="mg-aim" viewBox="0 0 100 100" aria-hidden="true"><circle class="mg-tg" cx="50" cy="50" r="${target}"/><circle class="mg-tgw" cx="50" cy="50" r="${target}" style="stroke-width:${(tol * 2).toFixed(1)}"/><circle class="mg-ret" cx="50" cy="50" r="46"/><path class="mg-x" d="M50 44v12M44 50h12"/></svg>`, "Hold to draw, let go on the gold ring");
      const ret = el.querySelector(".mg-ret");
      let t0 = 0, raf = 0, held = false, unkey = () => {};
      const start0 = now();
      const radius = () => { if (!held) return 46; const t = (now() - t0) / draw; return t <= 1 ? 46 - (46 - 8) * t : 8 + Math.min(38, (t - 1) * 60 + Math.sin(t * 20) * 3); };   // holding too long: your arm shakes
      const stop = () => { cancelAnimationFrame(raf); unkey(); };
      const release = () => { if (!held) return; const d = Math.abs(radius() - target); finish(el, grade(d <= tol ? 1 - (d / tol) * 0.25 : Math.max(0, 0.6 - (d - tol) / 20), g), done, stop); };
      const grab = () => { if (held || el._fin) return; held = true; t0 = now(); el.classList.add("drawing"); };
      const frame = () => {
        if (!held && now() - start0 > 3500) return finish(el, grade(0, g), done, stop);
        if (held && now() - t0 > draw * 2.4) return finish(el, grade(0, g), done, stop);
        ret.setAttribute("r", radius().toFixed(2));
        if (held && o.onProgress) o.onProgress(Math.min(1, (now() - t0) / draw));   // [channel] the draw, for teammates' bars
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      el.addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); try { el.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } grab(); });
      el.addEventListener("pointerup", (ev) => { ev.preventDefault(); ev.stopPropagation(); release(); });
      el.addEventListener("pointercancel", () => release());
      el.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); });
      unkey = keys(grab, release);
    });
  }
  /* spells: tap (or trace across) the rune's points in order before it fizzles */
  function rune(host, g, o, w) {
    return new Promise((done) => {
      const S = Object.assign({}, SCHOOLS[g.school] || SCHOOLS.Destruction, g.rune || {}), n = S.pts.length, limit = S.time * Math.min(1.6, w);   // [mgunique] g.rune: an element's own shape (fire flame, shock zigzag)
      const pts = S.pts.map(([x, y]) => [x, y]);
      const lines = S.circle ? `<circle class="mg-path" cx="50" cy="50" r="35"/>` : `<path class="mg-path" d="M${pts.map((p) => p.join(" ")).join(" L")}${n > 3 ? "" : " Z"}"/>`;
      const el = shell(host, g, o, `<svg class="mg-rune" viewBox="0 0 100 100" aria-hidden="true">${lines}<circle class="mg-clock" cx="50" cy="50" r="47"/>${pts.map(([x, y], i) => `<g class="mg-pt" data-i="${i}"><circle cx="${x}" cy="${y}" r="8"/><text x="${x}" y="${y + 3}">${i + 1}</text></g>`).join("")}</svg>`, "Tap the glowing points in order");
      const svg = el.querySelector("svg"), dots = [...el.querySelectorAll(".mg-pt")], clock = el.querySelector(".mg-clock");
      let next = 0, errs = 0, raf = 0, down = false, unkey = () => {};
      const t0 = now();
      const mark = () => dots.forEach((d, i) => { d.classList.toggle("on", i === next); d.classList.toggle("done", i < next); });
      mark();
      const stop = () => { cancelAnimationFrame(raf); unkey(); };
      const end = () => {
        const left = Math.max(0, 1 - (now() - t0) / limit), done0 = next / n;
        const score = next < n ? done0 * 0.3 : Math.max(0.36, Math.min(1, 0.45 + left * 0.9 - errs * 0.2));
        finish(el, grade(score, g), done, stop);
      };
      const at = (ev) => { const r = svg.getBoundingClientRect(); return [((ev.clientX - r.left) / r.width) * 100, ((ev.clientY - r.top) / r.height) * 100]; };
      const hitAt = (x, y, strict) => {
        if (el._fin) return;
        let best = -1, bd = 1e9; pts.forEach(([px, py], i) => { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = i; } });
        if (bd > 13) { if (strict) errs++; return; }
        if (best === next) { next++; dots[best].classList.add("pop"); mark(); if (o.onProgress) o.onProgress(next / n); if (next >= n) end(); }   // [channel] how far the rune got, for teammates' bars
        else if (best > next && strict) errs++;
      };
      const frame = () => {
        const t = (now() - t0) / limit;
        if (t >= 1) return end();
        clock.style.strokeDashoffset = (t * 295).toFixed(1);
        if (S.drift) pts.forEach((p, i) => { const [bx, by] = S.pts[i]; p[0] = bx + Math.sin(now() / 500 + i * 1.7) * 6; p[1] = by + Math.cos(now() / 600 + i) * 5; const d = dots[i]; d.firstChild.setAttribute("cx", p[0].toFixed(1)); d.firstChild.setAttribute("cy", p[1].toFixed(1)); d.lastChild.setAttribute("x", p[0].toFixed(1)); d.lastChild.setAttribute("y", (p[1] + 3).toFixed(1)); });
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      el.addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); down = true; try { el.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } const [x, y] = at(ev); hitAt(x, y, true); });
      el.addEventListener("pointermove", (ev) => { if (!down) return; const [x, y] = at(ev); hitAt(x, y, false); });   // trace the rune
      el.addEventListener("pointerup", () => { down = false; });
      el.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); });
      unkey = keys(() => { if (next < n) { const [x, y] = pts[next]; hitAt(x, y, true); } });   // PC: Space taps the next point in time
    });
  }
  /* play the game for move a. Resolves to { mult, label, cls, kind } (Good with no screen) */
  function play(host, f, a, o = {}) {
    const g = kindFor(f, a);
    if (!g) return Promise.resolve(null);
    if (!DOM || !host) return Promise.resolve(grade(0.5, g));
    const w = width(f, a, g) * (reduced() ? 1.2 : 1);   // reduced motion: a little more time
    if (simple()) return bar(host, Object.assign({}, g, { kind: g.kind === "power" || g.hard ? "power" : g.kind === "parry" ? "parry" : "strike", simple: true }), o, w);   // one tap timing for every move
    const id = g.dual && REG.dualcast ? "dualcast" : g.id;
    if (id && REG[id]) { try { const pr = REG[id](host, g, o, w, KIT); if (pr && typeof pr.then === "function") return pr; } catch (e) { console.error("minigame", id, e); } }
    if (g.kind === "shout") return bar(host, Object.assign({}, g, { kind: "strike" }), o, w);
    if (g.kind === "aim") return aim(host, g, o, w);
    if (g.kind === "rune") return rune(host, g, o, w);
    return bar(host, g, o, w);
  }
  /* Settings → Fights */
  function settingsHTML(seg) {
    if (typeof seg !== "function") return "";
    return `<div class="setrow"><span>${tr("Minigames")}</span>${seg("tbGames", [[true, tr("On")], [false, tr("Off")]], prefs().tbGames !== false)}</div>`
      + `<div class="setrow"><span>${tr("Minigame style")}</span>${seg("tbGamesSimple", [[false, tr("Unique per move")], [true, tr("Simple (one tap)")]], prefs().tbGamesSimple === true)}</div>`;
  }
  const KIT = { shell, finish, keys, now, grade, tr, SCHOOLS, reduced, bar, aim, rune };
  return { on, kindFor, width, grade, simGrade, perfect, itemFx, play, settingsHTML, GRADES, SCHOOLS, register, REG, incoming, KIT, simple };
})();
if (typeof module !== "undefined") module.exports = MINIGAME;
