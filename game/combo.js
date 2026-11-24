/* Combos between party members, and foe weaknesses you can read. [OURS module]
   Owner: "combat needs an overhaul". One teammate sets a foe up, another cashes in (only across different fighters: you,
   your follower, a summon, a friend in your party):
   - Shatter: a chilled foe takes a physical blow from someone else: +30% and it may stagger.
   - Overload: shock on a foe someone else set burning: +30% and it staggers (loses its next move).
   - Steam: frost on a foe someone else set burning: the rest of the burn goes off at once.
   - Thermal shock: fire on a foe someone else chilled: +25%, and the chill is gone.
   - Opening: a staggered or paralyzed foe takes +20% from your follower, summons and friends.
   Each combo adds at most 8% of the foe's full health, and a boss staggers only half as often, so no one-shots.
   How it hooks in: statuses are recorded by who applied them (wrapping PFX.hitFoe); fight.cActor says who is acting
   (followerai.js sets it for followers; anything else counts as you). The Shield-Brother perk makes combos hit harder. */
const COMBO = (() => {
  const CAP = 0.08;
  const KEY = { fire: "burn", frost: "chill", shock: "shock" };
  const who = (f) => f.cActor || "me";
  const boss = (f) => !!f.e?.boss || (f.tags && f.tags.has("boss"));
  const boostOf = (f) => 1 + (typeof PFX !== "undefined" && f.s ? Math.min(0.5, PFX.num(f.s, "combo") || 0) : 0);
  /* extra damage, capped; returns the amount dealt */
  function extra(f, amt) {
    const full = f.ehp0 || f.e?.tbHp || f.ehp || 1, d = Math.max(0, Math.min(amt * boostOf(f), CAP * full));
    f.ehp -= d; f.combos = (f.combos || 0) + 1;
    return d;
  }
  const by = (f, st) => f.cmark?.[st];
  const other = (f, st, me) => { const b = by(f, st); return !!f.foeSt?.[st] && b != null && b !== me; };

  /* elemental combos: checked as a status lands (PFX.hitFoe), before it changes anything */
  function onElement(f, el, amt) {
    const st = KEY[el], me = who(f); if (!st || !(amt > 0) || f.ehp <= 0) return "";
    if (st === "shock" && other(f, "burn", me)) {
      const d = extra(f, amt * 0.3);
      if (!boss(f) || Math.random() < 0.5) f.stagger = true;
      return ` · ✦ Overload! +${Math.round(d)}${f.stagger ? ", staggers it" : ""}`;
    }
    if (st === "chill" && other(f, "burn", me)) {
      const b = f.foeSt.burn, d = extra(f, b.dmg * b.turns * 0.8); delete f.foeSt.burn;
      return ` · ✦ Steam! the burn goes off at once (+${Math.round(d)})`;
    }
    if (st === "burn" && other(f, "chill", me)) {
      const d = extra(f, amt * 0.25); delete f.foeSt.chill;
      return ` · ✦ Thermal shock! +${Math.round(d)}`;
    }
    return "";
  }
  /* a physical blow just landed (before = the foe's health before it). me = who struck */
  function phys(f, before, me = who(f)) {
    const hit = before - f.ehp; if (!(hit > 0) || f.ehp <= 0) return "";
    if (other(f, "chill", me)) {
      const d = extra(f, hit * 0.3);
      if (Math.random() < (boss(f) ? 0.2 : 0.4)) { f.stagger = true; return ` · ✦ Shatter! +${Math.round(d)}, staggers it`; }
      return ` · ✦ Shatter! +${Math.round(d)}`;
    }
    return "";
  }
  /* anyone but you hitting a staggered or paralyzed foe */
  function opening(f, before, me = who(f)) {
    const hit = before - f.ehp; if (me === "me" || !(hit > 0) || f.ehp <= 0) return "";
    if (!(f.stagger || f.eParalyzed > 0)) return "";
    const d = extra(f, hit * 0.2);
    return ` · ✦ Opening +${Math.round(d)}`;
  }
  /* your own action in a turn-based fight (tbfight.js act): physical moves can shatter */
  function after(f, a, before) {
    if (!/^(attack|power_attack|bash)$/.test(a)) return "";
    return phys(f, before, "me");
  }
  /* for the Smart AI: how much better a move is because of a combo waiting to happen */
  function physValue(f, me) { return other(f, "chill", me) ? 1.3 : f.stagger || f.eParalyzed > 0 ? 1.2 : 1; }
  function elValue(f, me, el) {
    const st = KEY[el]; if (!st) return 1;
    if (st === "shock" && other(f, "burn", me)) return 1.3;
    if (st === "chill" && other(f, "burn", me)) return 1 + Math.min(1, (f.foeSt.burn.dmg * f.foeSt.burn.turns * 0.8) / Math.max(1, f.ehp) * 4);
    if (st === "burn" && other(f, "chill", me)) return 1.25;
    return 1;
  }

  /* weaknesses and resistances to fire/frost/shock, as chips under the foe's health (from MAGIC.elem) */
  const EL = [["fire", "🔥"], ["frost", "❄"], ["shock", "⚡"]];
  function chips(f) {
    if (typeof MAGIC === "undefined" || !f.e) return [];
    const out = [];
    for (const [el, ic] of EL) {
      const m = MAGIC.elem(f, el);
      if (m > 1.05) out.push(["weak", `${ic}▲`, `Weak to ${el}: ${el} spells do ${Math.round((m - 1) * 100)}% more.`]);
      else if (m < 0.95) out.push(["resist", `${ic}▼`, `Resists ${el}: ${el} spells do ${Math.round((1 - m) * 100)}% less.`]);
    }
    return out;
  }

  /* record who put each status on the foe, and check elemental combos first */
  function install() {
    if (typeof PFX === "undefined" || PFX.__combo) return;
    const orig = PFX.hitFoe;
    PFX.hitFoe = function (f, el, amt, src) {
      const st = KEY[el];
      const pre = st && f && f.foeSt ? onElement(f, el, amt) : "";
      const out = orig.call(this, f, el, amt, src);
      if (st && f && f.foeSt?.[st]) (f.cmark = f.cmark || {})[st] = who(f);
      return pre + out;
    };
    PFX.__combo = true;
  }
  install();
  return { install, onElement, phys, opening, after, physValue, elValue, chips, CAP };
})();
if (typeof module !== "undefined") module.exports = COMBO;
