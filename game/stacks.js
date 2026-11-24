/* stacks.js: every status in a fight is a stack count. [OURS]
   Remigiusz (build 145): "all statuses should stack intensifying the status or increasing its effectiveness per turn
   per stack, they should drop down by 1 per turn."
   - Putting a status on again adds stacks (up to 10). The effect grows with the stacks; past 4 stacks each extra one
     counts half (so ten stacks don't melt a boss), and burning / bleeding / poison never take more than 5% of a foe's
     health a turn (2.5% for a boss) or 4% of yours.
   - Every status loses one stack at the end of each round (one turn for whoever holds it).
   - What a stack does:
       Burn / Bleed / Poison N   N × the stack's damage every turn
       Chill N (on a foe)        its blows land 5% softer per stack (at most 30%) and it acts later
       Chill N (on you)          your stamina comes back slower, and you lose a little each turn
       Shock N (on a foe)        Vulnerable: it takes 3% more damage per stack
       Shock N (on you)          a little magicka drains away each turn
       Vulnerable N              +3% damage taken per stack     Sunder N   +3% from weapons per stack
       Weak N                    its blows land 4% softer per stack
       Winded N / Drained N      you start your turn with 4% less stamina / magicka per stack
       Might N                   you hit 4% harder per stack    Haste N    +2 initiative per stack
       Regen N                   N × the stack's healing every turn   Ward N   a ward that soaks 4% of your health per stack
   - Hard control (paralysed, calmed, afraid): a fresh one adds its turns to what's left, but every one that lands gives
     the foe Resolve (2 for elites and bosses), and Resolve takes that many turns off the next one. foecap.js still caps
     fear and calm on elites and bosses. Resolve drops by 1 a round too.
   Shared helper (enchants2.js uses it): STACKS.add(f, side, kind, n, o)   side: "me" or "foe" (or an ally object)
   Old saves and old phones: the stacks live in fields fights already had (foeSt, meSt, bleed, kitDot, regen, ward) plus
   f.stk; anything missing just counts as zero. */
const STACKS = (() => {
  const CAP = 10, CC_CAP = 4;
  const eff = (n) => (n <= 4 ? Math.max(0, n) : 4 + (n - 4) * 0.5);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ALIAS = { vulnerable: "vuln", vuln: "vuln", fire: "burn", frost: "chill", slow: "chill", jolt: "shock", strength: "might", poisoned: "poison", bleeding: "bleed", stamina: "winded", magicka: "drained" };
  const key = (k) => ALIAS[k] || k;
  const GEN = { foe: ["vuln", "sunder", "weak", "resolve"], me: ["winded", "drained", "might", "haste"] };
  /* a damage-over-time given as "dmg for t turns" turned into stacks that do the same in total: t stacks of 2·dmg/(t+1) */
  const perFor = (dmg, turns) => (dmg * 2) / (Math.max(1, turns) + 1);
  const big = (f) => !!(f.e && (f.e.boss || f.e.qboss || f.bf || (f.tags && (f.tags.has("boss") || f.tags.has("dragon")))));
  const elite = (f) => big(f) || !!(f.tags && f.tags.has("elite"));
  const foeMax = (f) => Math.max(1, f.ehp0 || (f.e && f.e.health) || f.ehp || 1);
  const myMax = (f) => (typeof G !== "undefined" && G.maxHealth && f.s ? G.maxHealth(f.s) : f.maxHp || 100);
  const S = (f) => { const s = f.stk || (f.stk = {}); s.foe = s.foe || {}; s.me = s.me || {}; s.cc = s.cc || {}; return s; };
  /* the most a damage-over-time takes a turn */
  const dotCap = (f, side) => (side === "me" ? 0.04 * myMax(f) : (big(f) ? 0.025 : 0.05) * foeMax(f));
  const dmgOf = (f, side, e) => Math.max(1, Math.round(Math.min(dotCap(f, side), (e.per || 1) * eff(e.turns))));
  /* merge n stacks of strength per into a {turns, per, dmg} entry */
  function merge(f, side, cur, n, per) {
    const had = cur && cur.turns > 0 ? cur.turns : 0, oldPer = cur ? (cur.per || (cur.dmg != null ? perFor(cur.dmg, cur.turns || 1) : per)) : per;
    const turns = Math.min(CAP, had + n), p = had ? (oldPer * had + per * n) / (had + n) : per;
    const e = Object.assign(cur || {}, { turns, per: p }); e.dmg = dmgOf(f, side, e); return e;
  }
  /* bonus stacks from perks ("+1 stack when you apply Burn"): PFX "stk" effects, by element */
  const bonus = (f, k) => (typeof PFX !== "undefined" && f.s ? Math.floor(PFX.sum(f.s, "stk", f, { el: k })) : 0);

  /* add n stacks of a status. side: "me" (you) or "foe", or an ally object. o: { per (damage/heal a stack), src: "me" when
     you put it on (your perks add stacks), name }. Returns the stacks it has now. */
  function add(f, side, kind, n = 1, o = {}) {
    if (!f) return 0;
    if (side && typeof side === "object") return addAlly(side, kind, n);
    const k = key(kind), me = side === "me";
    n = Math.max(0, Math.round(n + (!me && o.src !== "foe" && n > 0 ? bonus(f, k) : 0)));
    if (!n) return 0;
    if (!me && f.ehp <= 0) return 0;
    if (k === "burn" || k === "chill" || k === "shock" || (k === "poison" && !me)) {
      const set = me ? (f.meSt = f.meSt || {}) : (f.foeSt = f.foeSt || {});
      const per = o.per || (k === "burn" || k === "poison" ? (me ? 0.01 * myMax(f) : 0.012 * foeMax(f)) : 1);
      set[k] = merge(f, me ? "me" : "foe", set[k], n, per);
      return set[k].turns;
    }
    if (k === "bleed" && !me) {
      f.bleed = f.bleed || []; fold(f);
      const per = o.per || 0.012 * foeMax(f);
      f.bleed[0] = merge(f, "foe", f.bleed[0], n, per);
      return f.bleed[0].turns;
    }
    if ((k === "poison" || k === "bleed") && me) {
      const per = o.per || 0.01 * myMax(f);
      const cur = f.kitDot && f.kitDot.turns > 0 ? f.kitDot : null;
      f.kitDot = merge(f, "me", cur, n, per);
      f.kitDot.name = o.name || (cur && cur.name) || (k === "bleed" ? "bleeding" : "poison"); f.kitDot.magic = !!(o.magic || (cur && cur.magic));
      return f.kitDot.turns;
    }
    if (k === "regen" && me) {
      const per = o.per || 0.02 * myMax(f), cur = f.regen && f.regen.turns > 0 ? f.regen : null;
      const e = merge(f, "me", cur, n, per); e.amt = Math.round(e.per * eff(e.turns)); e.name = o.name || (cur && cur.name) || "Regeneration"; delete e.dmg;
      f.regen = e; return e.turns;
    }
    if (k === "ward" && me) {
      const amt = n * 0.04 * myMax(f); f.ward = (f.ward > 0 ? f.ward : 0) + amt; f.wardMax = Math.max(f.wardMax || 0, f.ward);
      return Math.round(f.ward);
    }
    const g = S(f)[me ? "me" : "foe"];
    g[k] = Math.min(CAP, (g[k] || 0) + n);
    return g[k];
  }
  /* allies (followers, summons, party members) keep plain counts: al.stk = { might: 2, ... } */
  function addAlly(al, kind, n) { const k = key(kind); al.stk = al.stk || {}; al.stk[k] = Math.min(CAP, (al.stk[k] || 0) + Math.max(0, Math.round(n))); return al.stk[k]; }
  const get = (f, side, kind) => {
    if (!f) return 0;
    const k = key(kind), me = side === "me";
    if (k === "burn" || k === "chill" || k === "shock" || (k === "poison" && !me)) return ((me ? f.meSt : f.foeSt) || {})[k]?.turns || 0;
    if (k === "bleed" && !me) return (f.bleed || []).reduce((t, b) => t + (b.turns || 0), 0);
    if ((k === "poison" || k === "bleed") && me) return f.kitDot?.turns || 0;
    if (k === "regen" && me) return f.regen?.turns || 0;
    return (f.stk && f.stk[me ? "me" : "foe"] && f.stk[me ? "me" : "foe"][k]) || 0;
  };

  /* raw bleed pushes ({dmg, turns} from older code) folded into one stacked entry */
  function fold(f) {
    const b = f.bleed; if (!b || !b.length) return;
    if (b.length === 1 && b[0].per) return;
    let e = b.find((x) => x.per) || null;
    for (const x of b) if (x !== e && x.turns > 0) e = merge(f, "foe", e, x.turns, perFor(x.dmg, x.turns));
    f.bleed = e && e.turns > 0 ? [e] : [];
  }
  /* hard control: a fresh paralysis / calm / fear adds to what's left, less the foe's Resolve */
  const CC = [["eParalyzed", "p"], ["calmTurns", "c"], ["fearTurns", "fe"]];
  function ccCheck(f) {
    const s = S(f), r = s.foe.resolve || 0;
    for (const [fld, id] of CC) {
      const cur = f[fld] || 0, last = s.cc[id] || 0;
      if (cur > last) {   // something just put it on (fights set the turns outright): stack it on what was left
        const got = Math.max(0, cur - r);
        const v = big(f) ? Math.min(cur, Math.max(last, got)) : Math.min(Math.max(CC_CAP, cur), last + got);
        f[fld] = v; s.foe.resolve = Math.min(CAP, r + (elite(f) ? 2 : 1));
      }
      s.cc[id] = f[fld] || 0;
    }
  }
  /* call after every move, every foe turn and at the end of a round: keeps stacks tidy */
  function sync(f) {
    if (!f) return;
    fold(f);
    for (const [set, side] of [[f.foeSt, "foe"], [f.meSt, "me"]]) if (set) for (const k of Object.keys(set)) { const e = set[k]; if (!e || !(e.turns > 0)) { delete set[k]; continue; } if (e.per) e.dmg = dmgOf(f, side, e); }
    if (f.bleed && f.bleed[0] && f.bleed[0].per) f.bleed[0].dmg = dmgOf(f, "foe", f.bleed[0]);
    if (f.kitDot) { if (!(f.kitDot.turns > 0)) f.kitDot = null; else if (f.kitDot.per) f.kitDot.dmg = dmgOf(f, "me", f.kitDot); }
    if (f.regen && f.regen.per) { if (!(f.regen.turns > 0)) f.regen = null; else f.regen.amt = Math.round(f.regen.per * eff(f.regen.turns)); }
    if (f.e) ccCheck(f);
  }
  /* end of a round: poison on the foe hurts (burn and bleed already have their own tick), the plain counts drop by one */
  function tick(f, line) {
    if (!f) return;
    const fs = f.foeSt || {};
    if (fs.poison && fs.poison.turns > 0 && f.ehp > 0) { const d = fs.poison.dmg || 1; f.ehp -= d; if (line) line.me += ` · ☠ poison ${Math.round(d)}`; }
    const s = S(f), mh = myMax(f);
    // shock and chill on you: a little drains away each turn
    const ms = f.meSt || {};
    if (ms.shock && ms.shock.turns > 0 && typeof G !== "undefined" && f.s) f.mp = Math.max(0, f.mp - 0.02 * eff(ms.shock.turns) * G.maxMagicka(f.s));
    if (ms.chill && ms.chill.turns > 0 && typeof G !== "undefined" && f.s) f.sp = Math.max(0, f.sp - 0.02 * eff(ms.chill.turns) * G.maxStamina(f.s));
    for (const side of ["foe", "me"]) for (const k of Object.keys(s[side])) { if (--s[side][k] <= 0) delete s[side][k]; }
    for (const al of f.allies || []) if (al.stk) for (const k of Object.keys(al.stk)) if (--al.stk[k] <= 0) delete al.stk[k];
    void mh;
    sync(f);
  }
  /* the start of your turn: Winded / Drained take their bite */
  function beginTurn(f) {
    if (!f || !f.stk || typeof G === "undefined" || !f.s) return "";
    const m = f.stk.me || {}; let t = "";
    if (m.winded > 0) { const d = Math.round(0.04 * eff(m.winded) * G.maxStamina(f.s)); f.sp = Math.max(0, f.sp - d); t += ` · winded −${d} stamina`; }
    if (m.drained > 0) { const d = Math.round(0.04 * eff(m.drained) * G.maxMagicka(f.s)); f.mp = Math.max(0, f.mp - d); t += ` · drained −${d} magicka`; }
    return t;
  }
  /* how much harder your hit lands from stacks on the foe and on you (Vulnerable, Shock, Sunder, Might) */
  function hitBonus(f, a) {
    const fs = (f.stk && f.stk.foe) || {}, ms = (f.stk && f.stk.me) || {};
    const phys = a === "attack" || a === "power_attack" || a === "bash" || /^(beast|lord):/.test(a || "");
    const v = 0.03 * eff((fs.vuln || 0) + (f.foeSt?.shock?.turns || 0)) + (phys ? 0.03 * eff(fs.sunder || 0) : 0) + 0.04 * eff(ms.might || 0);
    return Math.min(0.45, v);
  }
  /* after your move hit (tbfight.js): add the stacks' extra on top */
  function after(f, a, before) {
    const dealt = before - f.ehp; if (!(dealt > 0) || f.ehp <= 0) return "";
    const b = hitBonus(f, a); if (b <= 0) return "";
    const x = dealt * b; f.ehp -= x;
    return ` (+${Math.round(x)} from stacks)`;
  }
  /* how much softer the foe's blows land: Chill and Weak on it */
  function foeSoften(f) {
    const c = f.foeSt?.chill?.turns || 0, w = (f.stk && f.stk.foe && f.stk.foe.weak) || 0;
    return Math.min(0.3, 0.05 * eff(c) + 0.04 * eff(w));
  }
  /* initiative: Chill slows the foe, Haste speeds you */
  const foeInit = (f) => Math.round(eff(f?.foeSt?.chill?.turns || 0));
  const myInit = (f) => Math.round(2 * eff((f?.stk && f.stk.me && f.stk.me.haste) || 0));
  const allyBonus = (al) => (al && al.stk ? 0.04 * eff(al.stk.might || 0) : 0);

  /* tooltip line under a status chip */
  const TIP = {
    burn: "Each stack burns a little more every turn.", chill: "Each stack slows more.", shock: "Each stack makes it take 3% more damage.",
    bleed: "Each stack bleeds a little more every turn.", poison: "Each stack poisons a little more every turn.", regen: "Each stack heals a little more every turn.",
    vuln: "Each stack: +3% damage taken.", sunder: "Each stack: +3% damage from weapons.", weak: "Each stack: its blows land 4% softer.",
    resolve: "Each stack takes a turn off the next stun, calm or fear.", winded: "Each stack: −4% stamina at the start of your turn.",
    drained: "Each stack: −4% magicka at the start of your turn.", might: "Each stack: +4% damage.", haste: "Each stack: +2 initiative.",
  };
  const tipFor = (k, n) => (n > 0 ? ` ${n} stack${n === 1 ? "" : "s"}. ${TIP[key(k)] || "Each stack makes it stronger."} Drops by 1 each turn.` : "");

  return { CAP, CC_CAP, GEN, TIP, eff, perFor, add, get, fold, sync, tick, beginTurn, hitBonus, after, foeSoften, foeInit, myInit, allyBonus, tipFor, big, elite, key };
})();
if (typeof module !== "undefined") module.exports = STACKS;
