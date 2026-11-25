/* "What would the AI do?" ([OURS]) — a small tester on the AI & Loadouts screen. You set a made-up moment of a fight
   (your health, stamina and magicka, the foe's health, what kind of foe, how many, a friend knocked down) and it shows the
   move your loadout would play right now and why. In Custom and Hybrid it walks your rules top to bottom: ✓ fired,
   ✗ skipped and the reason ("health is 80%, rule needs below 40%").

   It is read-only: it builds a practice copy of your hero and a real fight (G.Fight), sets the numbers, and asks the
   same code the fight uses (COMBATAI.decide → Fight.choose). Rules are checked with the fight's own cond()/affordable(),
   so what it shows is what the fight would do. Nothing in your save changes. */
const AITEST = (() => {
  const FOES = [["normal", "Normal"], ["strong", "Strong"], ["boss", "Boss"], ["dragon", "Dragon"], ["caster", "Caster"]];
  const DEF = { hp: 100, sp: 100, mp: 100, ehp: 100, foe: "normal", n: 1, down: false };
  let sit = { ...DEF }, lastS = null, lastEsc = (t) => String(t), raf = 0;

  const tagsOf = (e) => e.tags || [];
  const TEST = {
    normal: (e) => !e.boss && e.danger !== "high" && !tagsOf(e).includes("dragon"),
    strong: (e) => !e.boss && e.danger === "high" && !tagsOf(e).includes("dragon"),
    boss: (e) => !!e.boss,
    dragon: (e) => tagsOf(e).includes("dragon"),
    caster: (e) => tagsOf(e).includes("mage") || /mage|necromancer|witch|wizard|conjurer|warlock|hagraven/i.test(e.name || ""),
  };
  /* a real foe of that kind, the one closest to your level; made up from the nearest one if the game has none */
  function foeFor(type, level) {
    const all = (D.ENCOUNTERS || []).filter((e) => e && e.kind !== "event" && e.health);
    const near = (list) => list.slice().sort((a, b) => Math.abs((a.level || 1) - level) - Math.abs((b.level || 1) - level))[0];
    const hit = near(all.filter(TEST[type] || TEST.normal));
    if (hit) return G.clone(hit);
    const base = G.clone(near(all.filter(TEST.normal)) || all[0]);
    if (type === "boss") Object.assign(base, { boss: true, danger: "high", health: Math.round(base.health * 3), name: base.name + " (boss)" });
    if (type === "strong") Object.assign(base, { danger: "high", health: Math.round(base.health * 1.8), tags: [...tagsOf(base), "elite"] });
    if (type === "caster") Object.assign(base, { tags: [...tagsOf(base), "mage"], name: base.name + " (caster)" });
    return base;
  }

  /* the practice fight for a moment: a copy of your hero, mid-fight (turn 2, not hidden) */
  function build(s, o = sit) {
    const sim = G.clone(s); sim._test = true; sim.health = G.maxHealth(sim); sim.healthTs = G.now();
    const e = G.scaleEnemy(foeFor(o.foe, sim.level || 1), sim.level || 1);
    const f = new G.Fight(sim, e);
    f.turn = 2; f.hidden = false; f.sneakNext = false;
    f.hp = Math.max(1, G.maxHealth(sim) * o.hp / 100);
    f.sp = G.maxStamina(sim) * o.sp / 100;
    f.mp = G.maxMagicka(sim) * o.mp / 100;
    f.ehp = Math.max(1, e.health * o.ehp / 100);
    if (o.n > 1) f.adds = Array.from({ length: o.n - 1 }, () => ({ ...e, hp: e.health }));
    if (o.down) {   // a friend knocked down (followers are never killed, just knocked down)
      let al = f.allies.find((a) => a.follower) || f.allies[0];
      if (al) f.allies = f.allies.filter((a) => a !== al);
      else al = { name: "Your follower", dmg: 6, follower: true, max: 60 };
      al.down = true; al.hp = 0; f._downed = [al]; f.followerDown = al.name;
    }
    return f;
  }

  // ---- why a condition is (not) true, in plain words
  const PCT = {
    hp_below: ["health", "hp", "below"], hp_above: ["health", "hp", "above"], mp_below: ["magicka", "mp", "below"], mp_above: ["magicka", "mp", "above"],
    sp_below: ["stamina", "sp", "below"], sp_above: ["stamina", "sp", "above"], enemy_hp_below: ["foe's health", "ehp", "below"], enemy_hp_above: ["foe's health", "ehp", "above"],
  };
  const pctOf = (f, k) => Math.round(k === "hp" ? f.pct(f.hp, G.maxHealth(f.s)) : k === "mp" ? f.pct(f.mp, G.maxMagicka(f.s)) : k === "sp" ? f.pct(f.sp, G.maxStamina(f.s)) : f.pct(f.ehp, f.e.health));
  function condWhy(f, c) {
    const ok = !!f.cond1(c) !== !!c.not, P = PCT[c.if];
    if (P) return { ok, text: `${P[0]} is ${pctOf(f, P[1])}%, rule needs ${c.not ? "not " : ""}${P[2]} ${c.pct || 0}%` };
    if (c.if === "always") return { ok, text: c.not ? "never true" : "always true" };
    if (c.if === "turn_at_least" || c.if === "turn_at_most") return { ok, text: `it's turn ${f.turn}, rule needs ${c.not ? "not " : ""}turn ${c.pct || 2} or ${c.if === "turn_at_least" ? "later" : "earlier"}` };
    if (c.if === "first_turn") return { ok, text: `it's turn ${f.turn}, rule needs ${c.not ? "not " : ""}the first turn` };
    if (c.if === "hp_lower_than_enemy") return { ok, text: `your health ${pctOf(f, "hp")}% vs the foe's ${pctOf(f, "ehp")}%` };
    const label = (D.CONDITIONS[c.if] || [c.if])[0], yes = !!f.cond1(c);
    return { ok, text: `${label}: ${yes ? "yes" : "no"}${c.not ? " (rule needs no)" : ""}` };
  }
  function ruleWhy(f, r) {   // the conditions that decided it
    const conds = r.conds && r.conds.length ? r.conds : [r];
    const all = conds.map((c) => condWhy(f, c)), ok = f.cond(r);
    const or = r.join === "or" && conds.length > 1;
    const show = ok ? all.filter((x) => x.ok) : or ? all : all.filter((x) => !x.ok);
    return { ok, text: (ok && or ? show.slice(0, 1) : show).map((x) => x.text).join(" · ") };
  }
  /* why a move can't be made right now */
  function cantWhy(f, a) {
    const s = f.s, [k, arg] = a.split(":"), r0 = Math.round;
    if (a === "power_attack") return `not enough stamina (needs ${r0(f.paCost)}, has ${r0(f.sp)})`;
    if (a === "block") return f.weapon && f.weapon.skill === "Archery" ? "can't block with a bow" : `not enough stamina to block (needs ${F.BLOCK_STAMINA}, has ${r0(f.sp)})`;
    if (a === "flee") return "can't run from this fight";
    if (k === "spell" || k === "dual") {
      if (!(s.spells || []).includes(arg) || !D.SPELLS[arg]) return "you don't know that spell";
      const c = G.spellCost(s, D.SPELLS[arg]) * (k === "dual" && typeof MAGIC !== "undefined" ? MAGIC.DUAL_COST : 1);
      return `not enough magicka (needs ${r0(c)}, has ${r0(f.mp)})`;
    }
    if (k === "potion") return typeof CURSE !== "undefined" && CURSE.noPotions && CURSE.noPotions(f) ? "no potions in Beast Form" : `no ${arg} potion in your pack`;
    if (k === "scroll") return "no scroll of that kind left";
    if (k === "power" || k === "shout") return "not ready (used today or still cooling down)";
    return "can't do it right now";
  }
  const isFiller = (r) => r && !r.off && r.if === "always" && r.do === "attack";   // the same test as the engine's catchAll()

  /* the whole answer for a fight: what it plays, why, and every rule's verdict. Matches Fight.choose(). */
  function explain(f) {
    const mode = !f.ai ? "custom" : f.hybrid ? "hybrid" : "smart";
    const rows = [];
    let fired = 0;
    if (mode !== "smart") {
      f.rules.forEach((r, i) => {
        const d = G.describeRule(r), row = { n: i + 1, cond: d.cond, act: d.act, state: "", why: "" };
        if (fired) { row.state = "later"; row.why = "not checked: an earlier rule fired"; }
        else if (r.off) { row.state = "skip"; row.why = "switched off"; }
        else if (mode === "hybrid" && isFiller(r)) { row.state = "skip"; row.why = "in Hybrid, the “Always → Attack” filler lets Smart AI pick instead"; }
        else {
          const c = ruleWhy(f, r);
          if (!c.ok) { row.state = "skip"; row.why = c.text; }
          else if (!f.affordable(r.do)) { row.state = "skip"; row.why = cantWhy(f, r.do); }
          else { row.state = "fire"; row.why = c.text; fired = i + 1; }
        }
        rows.push(row);
      });
    }
    const d = COMBATAI.decide(f);   // the real choice, from the fight's own code
    const why = d.rule ? `your rule ${d.rule} fired` : mode === "custom" ? "no rule fired, so you attack" : COMBATAI.shortWhy(d.action, d.why);
    const alts = d.rule || mode === "custom" ? [] : COMBATAI.rank(f, 4).filter((x) => x.a !== d.action).slice(0, 2).map((x) => G.describeAction(x.a));
    return { mode, action: d.action, label: G.describeAction(d.action), rule: d.rule || 0, why, alts, rows, fired, foe: f.e.name };
  }
  const run = (s, o) => explain(build(s, o || sit));

  // ---- the card
  function slider(k, label) {
    return `<label class="aitrow"><span>${label}</span><input type="range" class="aitslide" data-k="${k}" min="0" max="100" step="5" value="${sit[k]}" aria-label="${label}"><b class="num" data-v="${k}">${sit[k]}%</b></label>`;
  }
  function resultHTML(s, esc) {
    let x; try { x = run(s); } catch (e) { return `<p class="sub">Couldn't work it out for this moment.</p>`; }
    const ic = typeof UIART !== "undefined" && UIART.action ? UIART.action(x.action, 34) : "";
    const ruleRows = x.rows.map((r) => `<div class="aitrule ${r.state}"><span class="aitmark">${r.state === "fire" ? "✓" : r.state === "later" ? "·" : "✗"}</span><span class="aitn">${r.n}</span><span class="aitrt"><b>${esc(r.cond)}</b> → <span>${esc(r.act)}</span><small>${r.why.split(" · ").map((w) => `<span>${esc(w)}</span>`).join(" · ")}</small></span></div>`).join("");
    const head = x.mode === "smart" ? "" : `<div class="aitrules"><p class="sub aitsubh">Your rules, top to bottom${x.mode === "hybrid" ? " (then Smart AI)" : ""}:</p>${ruleRows || `<p class="sub">No rules: you just attack.</p>`}</div>`;
    return `<div class="aitpick" data-action="${esc(x.action)}" data-rule="${x.rule}">${ic}<div><small>Against a ${esc(x.foe)}, it would:</small><b>${esc(x.label)}</b><span class="aitwhy">${esc(x.rule ? `Rule ${x.rule} fired` : x.mode === "custom" ? "No rule fired" : "Smart AI")}: ${esc(x.why)}</span>${x.alts.length ? `<small class="aitalt">Next best: ${x.alts.map(esc).join(" · ")}</small>` : ""}</div></div>${head}`;
  }
  function html(s, esc) {
    lastS = s; lastEsc = esc || lastEsc;
    if (typeof G === "undefined" || typeof COMBATAI === "undefined") return "";
    const chip = (k, v, label) => `<button class="chip sm ${sit[k] === v ? "on" : ""}" data-ait="${k}" data-v="${v}" aria-pressed="${sit[k] === v}">${label}</button>`;
    return `<div class="card aitest" id="aitcard"><h3>What would the AI do?</h3><p class="sub">Set up a moment of a fight and see the move your loadout plays right now, and why. Just a test: nothing is used up.</p>
      <div class="aitsl">${slider("hp", "Your health")}${slider("sp", "Your stamina")}${slider("mp", "Your magicka")}${slider("ehp", "Foe's health")}</div>
      <div class="aitchips"><span class="aitl">Foe</span>${FOES.map(([v, l]) => chip("foe", v, l)).join("")}</div>
      <div class="aitchips"><span class="aitl">Foes</span>${[1, 2, 3].map((n) => chip("n", n, n === 3 ? "3+" : String(n))).join("")}<span class="aitl">Friend down</span>${chip("down", false, "No")}${chip("down", true, "Yes")}</div>
      <div class="aitout" id="aitout" aria-live="polite">${resultHTML(s, lastEsc)}</div></div>`;
  }
  function refresh() {
    const out = typeof document !== "undefined" && document.getElementById("aitout");
    if (out && lastS) out.innerHTML = resultHTML(lastS, lastEsc);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("input", (ev) => {
      const t = ev.target; if (!t || !t.classList || !t.classList.contains("aitslide")) return;
      const k = t.dataset.k; sit[k] = +t.value;
      const v = document.querySelector(`#aitcard [data-v="${k}"]`); if (v) v.textContent = sit[k] + "%";
      cancelAnimationFrame(raf); raf = requestAnimationFrame(refresh);
    });
    document.addEventListener("click", (ev) => {
      const b = ev.target && ev.target.closest && ev.target.closest("#aitcard [data-ait]"); if (!b) return;
      ev.stopPropagation();
      const k = b.dataset.ait, v = k === "n" ? +b.dataset.v : k === "down" ? b.dataset.v === "true" : b.dataset.v;
      sit[k] = v;
      for (const c of document.querySelectorAll(`#aitcard [data-ait="${k}"]`)) { const on = c === b; c.classList.toggle("on", on); c.setAttribute("aria-pressed", String(on)); }
      refresh();
    }, true);
  }
  const set = (o) => { sit = { ...sit, ...o }; return sit; };
  const reset = () => { sit = { ...DEF }; };
  return { FOES, foeFor, build, explain, run, condWhy, cantWhy, html, set, reset, get sit() { return sit; } };
})();
if (typeof module !== "undefined") module.exports = AITEST;
