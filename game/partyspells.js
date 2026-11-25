/* Crafted spells in shared party fights. [OURS]
   Rune spells (runecraft.js, s.runeSpells, ids "rc_…") and combined spells (spellcraft.js, s.customSpells, ids "cs_…")
   live only in their maker's save. In a shared party fight (sharedfight.js) everyone else's phone saw "spell:rc_p2_1"
   in the log and had no idea what it was: no icon, no element for the battle scene, no Polish name, the combo rules
   (oil + fire, hex + heal) couldn't tell what it did.
   Now the definition travels with the fight:
   - a teammate's turn reply (tbf/<id>~<pid>) carries the crafted spells cast in that turn (used());
   - the leader's phone learns them (applyRemote → learn()) and its fight record (tbf/<id>) carries every crafted spell
     cast so far in the fight, its own and the teammates' (forRecord());
   - every teammate's phone learns them from the record (Mirror.sync → learn()).
   Only spells actually cast are sent, so the record stays small. A learned spell goes into D.SPELLS (marked foreign)
   but never into your own spell list; a spell you own yourself is never overwritten. What arrives is checked and
   clamped (it comes from another phone). Pure JS, works in node (tests/test_partyspells.js). */
const PARTYSPELLS = (() => {
  const known = {};   // id -> {t:"rc"|"cs", c: record}, learned from teammates
  const ID = /^(rc|cs)_[\w]{1,60}$/;
  const R = Math.round;
  const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  const str = (v, n = 40) => String(v ?? "").replace(/[<>"`]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, q) => ((o[q] = x[q]), o), {}) : x));
  const LEVELS = ["Novice", "Apprentice", "Adept", "Expert", "Master"];
  const SCHOOLS = new Set(["Destruction", "Restoration", "Alteration", "Illusion", "Conjuration", "Mysticism"]);
  const RC_KINDS = new Set(["damage", "rune", "cloak", "dot", "heal", "regen", "ward"]);
  const CS_KINDS = new Set(["damage", "dot", "cloak", "rune", "heal", "regen", "ward", "armor", "paralyze", "fear", "calm", "turn", "courage", "soultrap"]);
  const ELS = new Set(["fire", "frost", "shock", "poison", "sun"]);

  const idOf = (a) => { const m = /^(?:spell|dual):(.+)$/.exec(String(a || "")); return m && ID.test(m[1]) ? m[1] : null; };
  /* your own crafted spell, as a record to send */
  function ownRec(s, id) {
    const r = (s?.runeSpells || []).find((x) => x && x.id === id); if (r) return { t: "rc", c: r };
    const c = (s?.customSpells || []).find((x) => x && x.id === id); if (c) return { t: "cs", c };
    return null;
  }
  const pack = (s, id) => { const o = ownRec(s, id); if (o) { const c = clone(o.c); delete c.t; return { t: o.t, c }; } return known[id] ? clone(known[id]) : null; };
  /* the crafted spells named by these moves ("spell:rc_p2_1", "dual:cs_p3_2"): {id: def} */
  function defsFor(s, acts) {
    const out = {};
    for (const a of acts || []) { const id = idOf(a); if (id && !out[id]) { const d = pack(s, id); if (d) out[id] = d; } }
    return out;
  }
  /* a teammate's reply: the crafted spells cast in this turn */
  const used = (s, evs) => defsFor(s, (evs || []).map((e) => e && e.a));
  /* the leader's record: every crafted spell cast so far in this fight (the leader's and the teammates') */
  function forRecord(sess) {
    if (!sess || !sess.f) return {};
    const m = defsFor(sess.f.s, (sess.ev || []).map((e) => e && e.a));
    return Object.keys(m).length ? { spells: m } : {};
  }

  // ------------------------------------------------------------------ checking what arrives
  function cleanRc(c, id) {
    const RC = typeof RUNECRAFT !== "undefined" ? RUNECRAFT : null; if (!RC) return null;
    if (!RC.ELEMENTS[c.el] || !RC.DELIVERIES[c.dl] || !RC_KINDS.has(c.kind)) return null;
    const mods = (Array.isArray(c.mods) ? c.mods : []).filter((m) => RC.MODS[m]).slice(0, 2);
    const out = { id, name: str(c.name, 32) || "Rune spell", pl: c.pl ? str(c.pl, 48) : null, el: c.el, dl: c.dl, mods, pw: num(c.pw, 0.5, 1, 1), kind: c.kind,
      amount: num(c.amount, 0, 5000), cost: R(num(c.cost, 1, 5000, 1)), turns: R(num(c.turns, 0, 20)), school: SCHOOLS.has(c.school) ? c.school : "Destruction",
      level: LEVELS.includes(c.level) ? c.level : "Novice" };
    if (c.area) out.area = true;
    if (ELS.has(c.element)) out.element = c.element;
    return out;
  }
  function cleanPart(p) {
    if (!p || typeof p !== "object" || !CS_KINDS.has(p.kind)) return null;
    const o = {};
    for (const [k, v] of Object.entries(p)) {
      if (["parts", "hidden", "rc", "custom", "foreign"].includes(k) || !/^\w{1,20}$/.test(k)) continue;
      if (typeof v === "number") o[k] = num(v, -5000, 5000);
      else if (typeof v === "boolean") o[k] = v;
      else if (typeof v === "string") o[k] = str(v, 60);
    }
    o.kind = p.kind; o.label = str(p.label || p.kind, 40); o.level = LEVELS.includes(p.level) ? p.level : "Novice";
    if (o.element && !ELS.has(o.element)) delete o.element;
    return o;
  }
  function cleanCs(c, id) {
    const parts = (Array.isArray(c.parts) ? c.parts : []).slice(0, 2).map(cleanPart);
    if (!parts.length || parts.some((p) => !p)) return null;
    return { id, name: str(c.name, 32) || parts.map((p) => p.label).join(" & "), school: SCHOOLS.has(c.school) ? c.school : parts[0].school || "Destruction",
      level: LEVELS.includes(c.level) ? c.level : "Novice", base: R(num(c.base, 1, 5000, 1)), parts };
  }

  /* learn a teammate's crafted spells (a reply's or a record's map). Returns how many were new or changed. */
  function learn(map, s) {
    if (!map || typeof map !== "object" || typeof D === "undefined") return 0;
    let n = 0;
    for (const [id, d] of Object.entries(map).slice(0, 40)) {
      if (!ID.test(id) || !d || typeof d !== "object" || !d.c || typeof d.c !== "object") continue;
      if (ownRec(s, id)) continue;   // your own spell stays yours
      if (D.SPELLS[id] && !D.SPELLS[id].foreign) continue;   // never over anything that isn't a teammate's spell
      const t = d.t === "cs" || id.startsWith("cs_") ? "cs" : "rc";
      if ((t === "cs") !== id.startsWith("cs_")) continue;
      const c = t === "rc" ? cleanRc(d.c, id) : cleanCs(d.c, id); if (!c) continue;
      const def = { t, c };
      if (known[id] && canon(known[id]) === canon(def) && D.SPELLS[id]) continue;
      let sp = null;
      try { sp = t === "rc" ? (typeof RUNECRAFT !== "undefined" ? RUNECRAFT.define(c) : null) : typeof SPELLCRAFT !== "undefined" ? SPELLCRAFT.define(c) : null; } catch (e) { sp = null; }
      if (!sp) continue;
      sp.foreign = true;
      known[id] = def; n++;
    }
    return n;
  }
  return { learn, used, forRecord, defsFor, pack, idOf, get known() { return known; }, _reset: () => { for (const k of Object.keys(known)) { delete known[k]; } } };
})();
if (typeof module !== "undefined") module.exports = PARTYSPELLS;
