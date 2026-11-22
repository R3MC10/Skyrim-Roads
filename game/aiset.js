/* AI settings and richer tactics ([OURS], after Remigiusz: "Players should adjust the AI. I can't level up all the
   skills because the AI picks melee. Let players craft their combat tactics better.").

   Every loadout carries one settings object, L.ai:
     style      balanced | aggressive | careful      how readily it heals and how hard it pushes
     prefer/w   mix | melee | ranged | magic, with weights 0–2 for melee, ranged and magic
     schools    { Destruction: false, ... }          schools it may not use
     off        [spell ids]                          spells it may not cast
     train      true/false                           "Spread practice": in easy fights, rotate skills to level them all
     potions    emergency | never | free
     shouts     yes | no | boss                      shouts and once-a-day powers
     sneak      safe | always | never                sneak openers (sneak2.js)
     healAt     10–90 (%)                            when healing starts to matter
     mpReserve  0–60 (%)                             magicka it keeps back for emergencies
     target     weakest | strongest | casters        who to hit first when several foes stand (turn-based fights)
     support    true/false                           support allies first (heal / shield friends)
   Loadout modes: "smart" (Smart AI), "custom" (your rules), "hybrid" (your rules first, Smart AI fills the gaps).

   Rules can join several conditions with AND / OR, each can be NOT. Presets build rules for your kit. Share codes
   ("ROTN1-…") copy a loadout's tactics and settings to a friend; they are cleaned on import. */
const AISET = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d, a, b) => (typeof v === "number" && isFinite(v) ? clamp(Math.round(v), a, b) : d);
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const SCHOOLS = ["Destruction", "Restoration", "Alteration", "Conjuration", "Illusion", "Mysticism"];
  const PREFER = {
    mix: { melee: 1, ranged: 1, magic: 1 },
    melee: { melee: 1.5, ranged: 1, magic: 0.45 },
    ranged: { melee: 0.6, ranged: 1.5, magic: 0.7 },
    magic: { melee: 0.45, ranged: 0.7, magic: 1.6 },
  };
  const STYLES = { balanced: "Balanced", aggressive: "Aggressive", careful: "Careful" };
  function clean(a) {
    a = a && typeof a === "object" ? a : {};
    const prefer = pick(a.prefer, Object.keys(PREFER), "mix");
    const w0 = a.w && typeof a.w === "object" ? a.w : PREFER[prefer];
    const w = {}; for (const k of ["melee", "ranged", "magic"]) { const v = +w0[k]; w[k] = isFinite(v) ? clamp(v, 0, 2) : PREFER[prefer][k]; }
    const schools = {}; for (const k of SCHOOLS) if (a.schools && a.schools[k] === false) schools[k] = false;
    const off = Array.isArray(a.off) ? a.off.filter((id) => typeof id === "string" && D.SPELLS[id]).slice(0, 200) : [];
    return {
      style: pick(a.style, Object.keys(STYLES), "balanced"), prefer, w, schools, off, train: !!a.train,
      potions: pick(a.potions, ["emergency", "never", "free"], "emergency"), shouts: pick(a.shouts, ["yes", "no", "boss"], "yes"),
      sneak: pick(a.sneak, ["safe", "always", "never"], "safe"), healAt: num(a.healAt, 50, 10, 90), mpReserve: num(a.mpReserve, 0, 0, 60),
      target: pick(a.target, ["weakest", "strongest", "casters"], "weakest"), support: a.support === undefined ? true : !!a.support,
    };
  }
  /* the settings object living on the loadout (filled in place, so edits stick) */
  function get(L) {
    if (!L) return clean({});
    if (!L.ai || typeof L.ai !== "object") { L.ai = clean({}); return L.ai; }
    const c = clean(L.ai);
    for (const k of Object.keys(c)) if (k === "schools") { if (!L.ai.schools || typeof L.ai.schools !== "object") L.ai.schools = c.schools; }
      else if (L.ai[k] === undefined || JSON.stringify(L.ai[k]) !== JSON.stringify(c[k]) && !(k === "off" && Array.isArray(L.ai.off))) L.ai[k] = c[k];
    return L.ai;
  }

  // ---------------------------------------------------------------- what kind of move is it
  const spellOf = (a) => { const [k, arg] = a.split(":"); return k === "spell" || k === "dual" ? D.SPELLS[arg] : k === "scroll" ? D.SPELLS[D.ITEMS[arg]?.spell] : null; };
  function classOf(f, a) {
    if (!a) return "other";
    if (a === "attack" || a === "power_attack") return f.weapon?.staff && !f.bound ? "magic" : (f.ammoKind && f.ammoKind() && !f.bound) ? "ranged" : "melee";
    if (a === "block") return "defend";
    const k = a.split(":")[0];
    if (k === "spell" || k === "dual" || k === "scroll") return "magic";
    if (k === "potion") return "potion";
    if (k === "shout" || k === "power") return "shout";
    return "other";
  }
  const isHeal = (a) => { if (a === "potion:health") return true; const sp = spellOf(a); return !!sp && ["heal", "regen"].includes(sp.kind); };
  const isAlly = (a) => { const sp = spellOf(a); return !!sp && /^ally|^healally/.test(sp.kind); };
  const tough = (f) => !!(f.e.boss || f.e.priest || f.tags.has("dragon") || f.tags.has("elite") || f.e.danger === "high");
  const hpPct = (f) => 100 * f.hp / Math.max(1, G.maxHealth(f.s));

  /* may the AI use this move at all, given the settings? */
  function allow(f, a, st) {
    const [k, arg] = a.split(":");
    if (k === "spell" || k === "dual") {
      const sp = D.SPELLS[arg]; if (!sp) return false;
      if (st.off.includes(arg) || st.schools[sp.school] === false) return false;
      if (st.mpReserve && !(isHeal(a) && hpPct(f) < st.healAt)) {
        const cost = G.spellCost(f.s, sp) * (k === "dual" && typeof MAGIC !== "undefined" ? MAGIC.DUAL_COST : 1);
        if (f.mp - cost < G.maxMagicka(f.s) * st.mpReserve / 100) return false;
      }
    }
    if (k === "scroll") { const sp = spellOf(a); if (sp && st.schools[sp.school] === false) return false; }
    if (k === "potion" && st.potions === "never") return false;
    if ((k === "shout" || k === "power") && (st.shouts === "no" || (st.shouts === "boss" && !tough(f)))) return false;
    return true;
  }
  /* nudge a move's value by the settings (values are in "turns of advantage") */
  function tune(f, p, a, r, st) {
    if (!r || !isFinite(r.v)) return r;
    let v = r.v;
    const cls = classOf(f, a);
    if (v > 0 && st.w[cls] != null) v *= st.w[cls];
    if (isHeal(a)) {
      const hp = hpPct(f), at = st.healAt + (st.style === "careful" ? 15 : st.style === "aggressive" ? -15 : 0);
      v *= st.style === "careful" ? 1.6 : st.style === "aggressive" ? 0.6 : 1;
      if (hp < at) v += st.style === "careful" ? 0.35 : 0.15; else if (hp > at + 25) v -= 0.15;
    } else if (cls === "melee" || cls === "ranged" || (cls === "magic" && spellOf(a)?.kind === "damage")) {
      if (st.style === "aggressive" && v > 0) v *= 1.1;
    }
    if (a === "block" && st.style === "careful" && v > 0) v *= 1.3;
    if (a.startsWith("potion:") && st.potions === "free") v += 0.4;
    if (isAlly(a) && v > 0) v *= st.support ? 1.4 : 0.7;
    return { ...r, v };
  }

  // ---------------------------------------------------------------- Spread practice
  function skillOf(f, a) {
    if (a === "attack" || a === "power_attack") return f.weaponSkill();
    if (a === "block") return f.shield ? "Blocking" : null;
    const [k, arg] = a.split(":"); if (k !== "spell") return null;
    const sp = D.SPELLS[arg]; if (!sp || ["soultrap", "reanimate", "equilibrium", "banish"].includes(sp.kind)) return null;
    return sp.school;
  }
  /* skills a loadout can practise in fights */
  function trainable(s, L = G.loadout(s)) {
    const st = get(L), out = new Set(), eq = G.equipment(s), w = eq.weapon ? D.ITEMS[eq.weapon.item] : null;
    out.add(w ? (w.staff ? "Destruction" : w.skill) : "Hand-to-Hand");
    if (eq.shield) out.add("Blocking");
    for (const id of s.spells || []) { const sp = D.SPELLS[id]; if (sp && sp.kind !== "utility" && st.schools[sp.school] !== false && !st.off.includes(id) && !["soultrap", "reanimate"].includes(sp.kind)) out.add(sp.school); }
    return [...out];
  }
  /* in an easy fight, pick the move that grows the least-practised skill this fight */
  function trainPick(f, p, opts, st) {
    if (!st.train || tough(f) || p.margin < 3 || hpPct(f) < 50) return null;
    const by = {};
    for (const a of opts) {
      const sk = skillOf(f, a); if (!sk) continue;
      const sp = spellOf(a); const c = sp ? G.spellCost(f.s, sp) : 0;
      if (!by[sk] || c < by[sk].c) by[sk] = { a, c };
    }
    const skills = Object.keys(by); if (skills.length < 2) return null;
    skills.sort((x, y) => (f.xp[x] || 0) - (f.xp[y] || 0) || x.localeCompare(y));
    f.aiTrain = true;
    return { action: by[skills[0]].a, skill: skills[0] };
  }

  // ---------------------------------------------------------------- conditions
  const NEWCOND = {
    turn_at_most: ["Turn number is at most", "turn"],
    enemy_staggered: ["Enemy is staggered", false],
    enemy_paralyzed: ["Enemy is paralyzed, calmed or scared", false],
    enemy_caster: ["Enemy casts spells", false],
    enemy_archer: ["Enemy shoots arrows", false],
    enemy_weak_fire: ["Enemy is weak to fire", false],
    enemy_weak_frost: ["Enemy is weak to frost", false],
    enemy_weak_shock: ["Enemy is weak to shock", false],
    enemy_burning: ["Enemy is burning", false],
    me_burning: ["I'm burning", false],
    me_chilled: ["I'm chilled", false],
    in_party: ["Friends fight beside me", false],
    bad_weather: ["Rain, snow, fog or storm", false],
  };
  const ARCHER = /archer|hunter|ranger|marksman|sniper/i, CASTER = /mage|wizard|witch|necromancer|shaman|priest|warlock|conjurer|sorcer|hagraven|lich|thalmor/i;
  const isCaster = (f) => (typeof MAGIC !== "undefined" && MAGIC.isCaster(f)) || f.tags.has("mage") || CASTER.test(f.e.name || "");
  function cond(f, r) {
    switch (r.if) {
      case "turn_at_most": return f.turn <= (r.pct || 2);
      case "enemy_staggered": return !!f.stagger;
      case "enemy_paralyzed": return f.eParalyzed > 0 || f.calmTurns > 0 || f.fearTurns > 0;
      case "enemy_caster": return isCaster(f);
      case "enemy_archer": return f.tags.has("archer") || ARCHER.test(f.e.name || "");
      case "enemy_weak_fire": case "enemy_weak_frost": case "enemy_weak_shock": { const el = r.if.slice(11); return typeof MAGIC !== "undefined" && MAGIC.elem(f, el) > 1.05; }
      case "enemy_burning": return !!f.foeSt?.burn;
      case "me_burning": return !!f.meSt?.burn;
      case "me_chilled": return !!f.meSt?.chill;
      case "in_party": return f.allies.some((a) => a.coop || a.party || a.player);
      case "bad_weather": return !!(f.wx && (f.wx.aim < 1 || f.wx.storm));
    }
    return false;
  }
  for (const [id, v] of Object.entries(NEWCOND)) if (!D.CONDITIONS[id]) D.CONDITIONS[id] = v;
  // a "run away" move for your own rules (engine: road fights only, never from a boss; Smart AI never picks it)
  if (D.BASIC_ACTIONS && !D.BASIC_ACTIONS.flee) D.BASIC_ACTIONS.flee = "Run away (road fights only, not from bosses)";

  // ---------------------------------------------------------------- rules
  const cleanCond = (c) => { const o = { if: c.if }; if (D.CONDITIONS[c.if]?.[1]) o.pct = c.pct ?? (D.CONDITIONS[c.if][1] === "turn" ? 3 : 50); if (c.not) o.not = true; return o; };
  function makeRule(first, extra = [], join = "and") {
    const conds = [first, ...extra].filter((c) => c && D.CONDITIONS[c.if]).map(cleanCond);
    const r = { if: conds[0]?.if || "always", do: "attack" };
    if (conds[0]?.pct != null) r.pct = conds[0].pct;
    if (conds.length > 1 || conds[0]?.not) { r.conds = conds; r.join = join === "or" ? "or" : "and"; }
    return r;
  }
  function condLabel(c) {
    const [label, kind] = D.CONDITIONS[c.if] || [c.if, false];
    return kind === "turn" ? `${label} ${c.pct || 2}` : kind ? `${label} ${c.pct}%` : label;
  }
  function describe(r) {
    const conds = r.conds && r.conds.length ? r.conds : [r];
    const glue = r.join === "or" ? " OR " : " AND ";
    return { cond: conds.map((c) => (c.not ? "NOT " : "") + condLabel(c)).join(glue), act: G.describeAction(r.do) };
  }

  // ---------------------------------------------------------------- presets (built for your kit)
  function bestSpell(s, test) {
    let best = null;
    for (const id of s.spells || []) { const sp = D.SPELLS[id]; if (!sp || !test(sp)) continue; if (typeof MAGIC !== "undefined" && MAGIC.failChance(s, id) > 0.05) continue; if (!best || (sp.amount || 0) > (D.SPELLS[best].amount || 0)) best = id; }
    return best;
  }
  const R = (iff, d, pct, extra) => { const r = { if: iff, do: d }; if (pct != null) r.pct = pct; if (extra) Object.assign(r, extra); return r; };
  const end = (rules) => [...rules.filter((r) => r.do && D.CONDITIONS[r.if]), R("always", "attack")];
  const PRESETS = {
    warrior: { name: "Warrior", desc: "Potions when hurt, power attacks while you have the stamina and on a staggered foe.", build: (s) => ({ mode: "custom", ai: { prefer: "melee", w: { ...PREFER.melee } },
      rules: end([R("hp_below", "potion:health", 40), makeRule({ if: "enemy_staggered" }, [{ if: "sp_above", pct: 25 }], "and"), R("sp_above", "power_attack", 60)]).map((r) => (r.conds && r.do === "attack" ? { ...r, do: "power_attack" } : r)) }) },
    archer: { name: "Archer", desc: "Opens with a power shot, keeps shooting, drinks when hurt.", build: () => ({ mode: "custom", ai: { prefer: "ranged", w: { ...PREFER.ranged } },
      rules: end([R("hp_below", "potion:health", 40), R("first_turn", "power_attack"), R("sp_above", "power_attack", 75)]) }) },
    battlemage: { name: "Battlemage", desc: "The right element for the foe's weakness, a sword when magicka runs low.", build: (s) => {
      const fire = bestSpell(s, (sp) => sp.kind === "damage" && sp.element === "fire"), frost = bestSpell(s, (sp) => sp.kind === "damage" && sp.element === "frost"), shock = bestSpell(s, (sp) => sp.kind === "damage" && sp.element === "shock");
      const any = bestSpell(s, (sp) => sp.kind === "damage" && sp.school === "Destruction"), arm = bestSpell(s, (sp) => sp.kind === "armor");
      return { mode: "custom", ai: { prefer: "magic", w: { ...PREFER.magic } }, rules: end([R("hp_below", "potion:health", 35), arm && R("no_armor_spell", "spell:" + arm),
        fire && R("enemy_weak_fire", "spell:" + fire), frost && R("enemy_weak_frost", "spell:" + frost), shock && R("enemy_caster", "spell:" + shock), any && R("mp_above", "spell:" + any, 30)].filter(Boolean)) }; } },
    healer: { name: "Healer", desc: "Keeps friends and yourself standing; wards against casters.", build: (s) => {
      const heal = bestSpell(s, (sp) => sp.kind === "heal"), ally = bestSpell(s, (sp) => sp.kind === "healally"), ward = bestSpell(s, (sp) => sp.kind === "ward"), arm = bestSpell(s, (sp) => sp.kind === "armor");
      return { mode: "custom", ai: { style: "careful", support: true }, rules: end([ally && D.CONDITIONS.ally_hp_below && R("ally_hp_below", "spell:" + ally, 50), heal ? R("hp_below", "spell:" + heal, 55) : R("hp_below", "potion:health", 45),
        ward && R("enemy_caster", "spell:" + ward), arm && R("no_armor_spell", "spell:" + arm)].filter(Boolean)) }; } },
    necro: { name: "Necromancer", desc: "A summon or a raised corpse first, then curses and spells from behind it.", build: (s) => {
      const sum = bestSpell(s, (sp) => sp.kind === "summon"), dmg = bestSpell(s, (sp) => sp.kind === "damage"), arm = bestSpell(s, (sp) => sp.kind === "armor");
      return { mode: "custom", ai: { prefer: "magic", w: { ...PREFER.magic } }, rules: end([R("hp_below", "potion:health", 40), sum && R("no_summon", "spell:" + sum), arm && R("no_armor_spell", "spell:" + arm), dmg && R("mp_above", "spell:" + dmg, 40)].filter(Boolean)) }; } },
    mage: { name: "Mage", desc: "Heals when hurt, drinks magicka when low, and casts your strongest spell; the staff or sword only when magicka runs dry.", build: (s) => {
      const heal = bestSpell(s, (sp) => sp.kind === "heal"), dmg = bestSpell(s, (sp) => sp.kind === "damage"), arm = bestSpell(s, (sp) => sp.kind === "armor");
      return { mode: "custom", ai: { prefer: "magic", w: { ...PREFER.magic } }, rules: end([heal ? R("hp_below", "spell:" + heal, 40) : R("hp_below", "potion:health", 40), R("mp_below", "potion:magicka", 25),
        arm && R("no_armor_spell", "spell:" + arm), dmg && R("always", "spell:" + dmg)].filter(Boolean)) }; } },
    thief: { name: "Thief", desc: "Always tries to sneak up first, opens with a power attack, drinks early.", build: () => ({ mode: "custom", ai: { sneak: "always" },
      rules: end([R("hp_below", "potion:health", 50), R("first_turn", "power_attack")]) }) },
    trainer: { name: "Skill trainer", desc: "Hybrid + Spread practice: in easy fights it rotates weapons, blocks and every school you know, so all your skills grow. Dangerous fights it plays to win.", build: () => ({ mode: "hybrid", ai: { train: true },
      rules: end([R("hp_below", "potion:health", 35)]) }) },
  };
  function applyPreset(s, L, id) {
    const p = PRESETS[id]; if (!p) return null;
    const b = p.build(s);
    L.rules = b.rules; L.mode = b.mode;
    const st = get(L); Object.assign(st, b.ai || {}); if (b.ai?.prefer && !b.ai.w) st.w = { ...PREFER[b.ai.prefer] };
    return b;
  }

  // ---------------------------------------------------------------- share codes
  const b64e = (str) => (typeof btoa === "function" ? btoa(unescape(encodeURIComponent(str))) : Buffer.from(str, "utf8").toString("base64"));
  const b64d = (str) => (typeof atob === "function" ? decodeURIComponent(escape(atob(str))) : Buffer.from(str, "base64").toString("utf8"));
  function validAction(a) {
    if (typeof a !== "string" || a.length > 60) return false;
    if (["attack", "power_attack", "block", "flee"].includes(a)) return true;
    const [k, arg, more] = a.split(":"); if (more !== undefined || !arg) return false;
    if (k === "spell" || k === "dual") return !!D.SPELLS[arg];
    if (k === "potion") return ["health", "magicka", "stamina"].includes(arg);
    if (k === "scroll") return D.ITEMS[arg]?.slot === "scroll";
    if (k === "shout") return typeof POWERS !== "undefined" ? !!POWERS.SHOUTS[arg] : /^[a-z_]+$/.test(arg);
    if (k === "power") return ["race", "stone", "beast", "lord"].includes(arg);
    return false;
  }
  function cleanRule(r) {
    if (!r || typeof r !== "object" || !D.CONDITIONS[r.if] || !validAction(r.do)) return null;
    const o = { if: r.if, do: r.do }; const kind = D.CONDITIONS[r.if][1];
    if (kind) o.pct = num(+r.pct, kind === "turn" ? 3 : 50, kind === "turn" ? 1 : 0, kind === "turn" ? 60 : 100);
    if (r.off) o.off = true; if (r.not) o.not = true;
    if (Array.isArray(r.conds) && r.conds.length) {
      const cs = r.conds.slice(0, 4).filter((c) => c && D.CONDITIONS[c.if]).map((c) => { const k2 = D.CONDITIONS[c.if][1], x = { if: c.if }; if (k2) x.pct = num(+c.pct, k2 === "turn" ? 3 : 50, k2 === "turn" ? 1 : 0, k2 === "turn" ? 60 : 100); if (c.not) x.not = true; return x; });
      if (cs.length) { o.conds = cs; o.join = r.join === "or" ? "or" : "and"; o.if = cs[0].if; if (cs[0].pct != null) o.pct = cs[0].pct; else delete o.pct; }
    }
    return o;
  }
  function encode(L) {
    const st = get(L);
    return "ROTN1-" + b64e(JSON.stringify({ v: 1, mode: L.mode || "smart", ai: st, rules: (L.rules || []).map(cleanRule).filter(Boolean) }));
  }
  function decode(code) {
    code = String(code || "").trim();
    const m = /^ROTN1-([A-Za-z0-9+/=]+)$/.exec(code); if (!m || code.length > 12000) return null;
    let d; try { d = JSON.parse(b64d(m[1])); } catch { return null; }
    if (!d || typeof d !== "object") return null;
    return { mode: pick(d.mode, ["smart", "custom", "hybrid"], "smart"), ai: clean(d.ai), rules: (Array.isArray(d.rules) ? d.rules : []).map(cleanRule).filter(Boolean).slice(0, D.MAX_RULES) };
  }
  function importInto(L, code) {
    const d = decode(code); if (!d) return false;
    L.mode = d.mode; L.ai = d.ai; L.rules = d.rules.length ? d.rules : [R("always", "attack")];
    return true;
  }

  // ---------------------------------------------------------------- test-fight preview: 20 practice fights
  function preview(s, foeName, lv = s.level, n = 20) {
    const base = D.ENCOUNTERS.find((x) => x.name === foeName && x.health) || (typeof DUNGEONS !== "undefined" ? Object.values(DUNGEONS.ENEMY || {}).find((x) => x.name === foeName) : null);
    if (!base) return null;
    let win = 0, turns = 0, hpLeft = 0; const xp = {};
    for (let i = 0; i < n; i++) {
      const sim = G.clone(s); sim._test = true; sim.health = G.maxHealth(sim); sim.healthTs = G.now();
      const f = new G.Fight(sim, G.scaleEnemy({ ...base }, lv)); f.run({});
      if (f.won) win++; turns += f.turn; hpLeft += f.won ? 100 * f.hp / G.maxHealth(sim) : 0;
      for (const [k, v] of Object.entries(f.xp)) xp[k] = (xp[k] || 0) + v / n;
    }
    for (const k of Object.keys(xp)) xp[k] = Math.round(xp[k]);
    return { n, foe: foeName, win: Math.round(100 * win / n), turns: Math.round(10 * turns / n) / 10, hpLeft: win ? Math.round(hpLeft / win) : 0, xp };
  }

  // ---------------------------------------------------------------- several foes: who goes first
  function pickTarget(L, foes) {
    const t = (L && L.ai && L.ai.target) || "weakest", hp = (e) => e.hp ?? e.health ?? 0;
    const caster = (e) => (e.tags || []).includes("mage") || CASTER.test(e.name || "");
    const list = [...(foes || [])].filter((e) => hp(e) > 0);
    if (t === "strongest") return list.sort((a, b) => hp(b) * (b.damage || 1) - hp(a) * (a.damage || 1));
    if (t === "casters") return list.sort((a, b) => (caster(b) - caster(a)) || hp(a) - hp(b));
    return list.sort((a, b) => hp(a) - hp(b));
  }

  return { SCHOOLS, PREFER, STYLES, NEWCOND, PRESETS, clean, get, classOf, isHeal, allow, tune, trainable, trainPick, skillOf, cond, makeRule, describe, condLabel, applyPreset, encode, decode, importInto, validAction, preview, pickTarget };
})();
if (typeof module !== "undefined") module.exports = AISET;
