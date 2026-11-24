/* foecap.js: limits that keep big fights from being won by stalling or lost to heal loops. [OURS]
   1. Fear and "stops fighting" effects (Battle Cry, Voice of the Emperor, Dismay, Kyne's Peace, Fear spells, Command...)
      hold a boss for at most 2 turns at a time and 3 turns a fight, an elite foe for 3 at a time and 5 a fight.
      Normal foes keep the full effect. Aspect of Terror adds a turn to both. The turns it shook off aren't wasted: it
      stays rattled for that many turns (up to 6) and its blows land 20% softer.
   2. A foe's own healing (healing spells, potions, life drain) can't lift it above 65% of its health once it has dropped
      below, heals at most 35% of its health in a whole fight, and a healing spell needs 3 turns to come back.
   Loaded after engine.js; wraps Fight.act (cap right after you use the effect, so the foe's chips show the real count)
   and Fight.enemyTurn (count the turns it loses). Without this file everything works as before. */
const FOECAP = (() => {
  const HOLD = [0, 3, 2], BUDGET = [0, 5, 3];   // by tier: 0 normal, 1 elite, 2 boss
  const HEAL_CEIL = 0.65, HEAL_BUDGET = 0.35, HEAL_CD = 3;
  const KEYS = ["calmTurns", "fearTurns"];

  function tier(f) {
    const e = f.e || {}, tags = f.tags || new Set();
    if (e.player || e.pvp) return 0;
    if (e.boss || e.qboss || e.priest || f.bf || tags.has("boss") || tags.has("dragon")) return 2;
    if (tags.has("elite")) return 1;
    return 0;
  }
  const RATTLE = 0.8, RATTLE_MAX = 6;
  const st = (f) => f.fcap || (f.fcap = { cc: 0, healed: 0, healCd: -1, rattled: 0 });
  const terror = (f) => (typeof G !== "undefined" && f.s && G.P(f.s, "aspect_of_terror") ? 1 : 0);
  const hold = (f) => { const t = tier(f); return t ? HOLD[t] + terror(f) : Infinity; };
  const budget = (f) => { const t = tier(f); return t ? BUDGET[t] + terror(f) : Infinity; };

  /* cut any fear / calm on a big foe down to what it can be held for (what's left of the fight's budget, too) */
  function clamp(f) {
    if (!tier(f)) return false;
    const left = Math.max(0, budget(f) - st(f).cc), cap = Math.min(hold(f), left);
    let cut = false;
    for (const k of KEYS) if ((f[k] || 0) > cap) { st(f).rattled = Math.min(RATTLE_MAX, Math.max(st(f).rattled || 0, f[k] - cap)); f[k] = cap; cut = cut || cap === 0; }
    return cut;   // true: it shook the effect off completely
  }
  /* at the start of the foe's turn: a turn lost to fear counts against the fight's budget */
  function spend(f) {
    if (!tier(f)) return "";
    const had = KEYS.some((k) => (f[k] || 0) > 0);
    clamp(f);
    const lose = KEYS.some((k) => (f[k] || 0) > 0);
    if (lose) { st(f).cc++; return ""; }
    return had ? `${f.e.name} shakes off the fear` : "";
  }

  /* foe healing */
  function canHeal(f, o = {}) {
    const s = st(f), max = f.ehp0 || f.ehp;
    if (!o.noCd && s.healCd > (f.turn || 0)) return false;
    if (s.healed >= HEAL_BUDGET * max) return false;
    return f.ehp < HEAL_CEIL * max;
  }
  /* heal the foe by up to h; returns what it really got */
  function heal(f, h, o = {}) {
    const s = st(f), max = f.ehp0 || f.ehp;
    const room = Math.max(0, Math.min(HEAL_CEIL * max - f.ehp, HEAL_BUDGET * max - s.healed));
    const got = Math.max(0, Math.round(Math.min(h, room)));
    f.ehp += got; s.healed += got;
    if (!o.noCd) s.healCd = (f.turn || 0) + HEAL_CD;
    return got;
  }

  if (typeof G !== "undefined" && G.Fight) {
    const P = G.Fight.prototype, act0 = P.act, et0 = P.enemyTurn;
    P.act = function (a) { const r = act0.call(this, a); return clamp(this) && typeof r === "string" ? r + ` · ${this.e.name} shakes it off` : r; };
    P.enemyTurn = function () {
      const shook = spend(this), s = this.fcap, lose = KEYS.some((k) => (this[k] || 0) > 0);
      if (lose || !(s && s.rattled > 0)) { const r = et0.call(this); return shook ? shook + " · " + r : r; }
      s.rattled--; const e = this.e, d0 = e.damage; e.damage = d0 * RATTLE;   // still shaken: softer blows
      let r; try { r = et0.call(this); } finally { e.damage = d0; }
      return (shook ? shook + " · " : "") + r + (s.rattled > 0 ? " (still rattled)" : "");
    };
  }
  return { tier, hold, budget, clamp, spend, canHeal, heal, HOLD, BUDGET, RATTLE, RATTLE_MAX, HEAL_CEIL, HEAL_BUDGET, HEAL_CD };
})();
