/* Fight screen tooltips: what each action does and what it costs, who you're fighting and how tough they are. [OURS]
   Remigiusz: "Combat needs tooltips, tap and hold for mobile, hover over for pc."
   tbfight.js puts the text in data-tip on cards, unit frames, the turn-order chips and status icons;
   tbui.js shows it (hold a finger on it for a moment, or hover with a mouse). */
const TBTIPS = (() => {
  const r0 = (v) => Math.round(v);
  const spread = () => (typeof F !== "undefined" && F.DAMAGE_SPREAD ? F.DAMAGE_SPREAD : [0.8, 1.2]);
  const hitPct = () => r0(100 * (typeof F !== "undefined" ? F.HIT_CHANCE : 0.85));
  function range(base) { const [a, b] = spread(); return `${Math.max(1, r0(base * a))}–${Math.max(1, r0(base * b))}`; }
  function foeCut(f, d) { return f.e?.red ? d * (1 - f.e.red) : d; }
  function weaponName(f) { return f.bound ? f.bound.name || "bound weapon" : f.weapon ? f.weapon.name || "weapon" : "fists"; }
  function safeDmg(f) { try { return f.weaponDamage(); } catch (e) { return 0; } }

  /* text for one action card */
  function action(f, a, ap) {
    const apTxt = ap >= 99 ? "Uses all your AP." : `${ap} AP.`;
    if (a === "attack") {
      const d = foeCut(f, safeDmg(f));
      return `Attack with your ${weaponName(f)}: about ${range(d)} damage, ${hitPct()}% to hit. ${apTxt}`;
    }
    if (a === "power_attack") {
      const d = foeCut(f, safeDmg(f) * (typeof F !== "undefined" ? F.POWER_ATTACK_DAMAGE : 2));
      return `A heavy swing: about ${range(d)} damage and it can stagger the foe. Costs ${r0(f.paCost || 0)} stamina. ${apTxt}`;
    }
    if (a === "block") return f.shield
      ? `Slam your shield into the foe: small damage and they're stunned and lose their next turn. Costs a lot of stamina. ${apTxt}`
      : `Raise your guard: the next blow is partly blocked. ${apTxt}`;
    if (a === "bash") return `Slam your shield into the foe: small damage and they're stunned and lose their next turn. Costs a lot of stamina. ${apTxt}`;
    if (a === "flee") return "Try to break away from the fight. Uses all your AP; the foe may cut you off.";
    if (a === "end") return "End your turn. Leftover AP becomes guard (up to 30% less damage until your next turn).";
    const [k, arg] = a.split(":");
    if (k === "spell" || k === "dual" || k === "scroll") {
      const id = k === "scroll" ? D.ITEMS[arg]?.spell : arg, sp = D.SPELLS[id];
      if (!sp) return apTxt;
      const mc = k === "scroll" ? 0 : r0((typeof G.spellCost === "function" ? G.spellCost(f.s, sp) : sp.cost) * (k === "dual" ? 2.2 : 1));
      const el = sp.element && sp.element !== "none" ? ` ${sp.element}` : "";
      const amt = sp.amount ? r0(sp.amount * (k === "dual" ? 2.2 : 1)) : 0;
      const what = sp.kind === "damage" ? `about ${amt}${el} damage` : sp.kind === "heal" ? `heals about ${amt}` : sp.kind === "armor" ? `+${amt} armour for the fight` : sp.kind;
      const src = k === "scroll" ? "Read the scroll (it's used up)" : k === "dual" ? "Cast it with both hands: stronger, costs more" : `${sp.school || "Magic"} spell`;
      return `${sp.name}: ${what}. ${src}.${mc ? ` ${mc} magicka.` : ""} ${apTxt}`;
    }
    if (k === "potion") return `Drink your best ${arg} potion. ${apTxt}`;
    if (k === "shout") return `Shout ${String(arg).toUpperCase()}: a dragon shout, needs time to recharge afterwards. ${apTxt}`;
    if (k === "power") return `Your racial power, once per day. ${apTxt}`;
    return apTxt;
  }

  /* text for your own frame */
  function me(f, st) {
    let arm = 0, red = 0;
    try { const { rating, pieces } = f.armorRating(); arm = r0(rating); red = r0(100 * F.damageReduction(rating, pieces)); } catch (e) { /* no armour info */ }
    const blk = typeof SHIELDFX !== "undefined" ? r0(100 * SHIELDFX.passive(f)) : 0;
    return `You. Armour ${arm} (blows ${red}% weaker)${blk ? `, ${blk}% chance to block with your shield` : ""}. ${st.ap} AP a turn${st.spellAp ? ` + ${st.spellAp} for spells` : ""}, initiative ${st.init}.`;
  }
  /* text for the foe's frame */
  function foe(f, ehpMax) {
    const e = f.e || {}, tags = [...(f.tags || [])].filter((t) => !/^(normal|tough|boss)$/.test(t));
    const kind = f.tags?.has?.("boss") ? "Boss" : f.tags?.has?.("tough") ? "Tough foe" : "Foe";
    return `${kind}: ${e.name}. ${r0(Math.max(0, f.ehp))} / ${r0(ehpMax)} health, hits for about ${range(e.damage || 0)}.${e.red ? ` Armour blunts ${r0(e.red * 100)}% of your blows.` : ""}${tags.length ? ` (${tags.join(", ")})` : ""}${typeof FOEKIT !== "undefined" && FOEKIT.names(f).length ? ` Can use: ${FOEKIT.names(f).join(", ")}.` : ""}`;
  }
  const STATUS = { burn: "Burning: takes fire damage each turn", chill: "Chilled: slower and clumsier, misses more", shock: "Shocked: loses magicka and takes shock damage", para: "Paralyzed: can't act", stag: "Staggered: loses their next move", stun: "Stunned by your shield: loses their next turn" };
  return { action, me, foe, STATUS };
})();
if (typeof module !== "undefined") module.exports = TBTIPS;
