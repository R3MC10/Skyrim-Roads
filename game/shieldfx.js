/* Shields: a passive block chance, and the Shield bash. [OURS]
   Remigiusz: "Carrying a shield should just give a passive block chance. Shield up should be replaced with shield bash,
   so the enemy gets stunned. High stamina cost."
   - Passive block: with a shield on your arm, any blow has a chance to be caught on it (blocked like a raised guard).
     12% base, +1% per 5 Blocking (up to +20%), +2% per Shield Wall rank, plus the block perks; at most 45%.
   - Shield bash (turn-based fights, replaces Shield up): 3 AP and 40% of your max stamina (at least 35). Small damage;
     the foe loses its next turn. Tough foes shake it off 15% of the time, bosses and dragons 40%. Once stunned, a foe
     can't be stunned again for 2 rounds (no stun-locking).
   Perks: Power Bash (+15% to stun tough foes and bosses), Deadly Bash (bash damage grows with Blocking),
   Disarming Bash (stunned foes hit softer after), Shield Charge (your first bash always stuns). */
const SHIELDFX = (() => {
  const rk = (s, id) => (typeof PERKS !== "undefined" ? PERKS.rank(s, id) : 0);
  const sk = (s, n) => (typeof G !== "undefined" && G.skill ? G.skill(s, n) : 15);
  const maxSp = (s) => (typeof G !== "undefined" && G.maxStamina ? G.maxStamina(s) : 100);
  const pfx = (s, k, f) => (typeof PFX !== "undefined" ? PFX.sum(s, k, f, {}) : 0);

  function passive(f) {
    if (!f?.shield) return 0;
    const s = f.s;
    const c = 0.12 + Math.min(0.2, sk(s, "Blocking") / 500) + 0.02 * rk(s, "shield_wall") + 0.5 * Math.min(0.25, pfx(s, "block", f));
    return Math.min(0.45, c);
  }
  /* called before a blow lands on you: true = it's caught on the shield (blocked like a raised guard) */
  function roll(f) { const c = passive(f); return c > 0 && Math.random() < c; }

  const cost = (f) => Math.max(35, Math.round(0.4 * maxSp(f.s)));
  const can = (f) => !!f?.shield && f.sp >= cost(f);

  function bash(f) {
    const s = f.s, n = f.e?.name || "the foe";
    f.sp -= cost(f);
    const blk = sk(s, "Blocking");
    let d = (4 + (f.shield.armor || 10) * 0.4 + blk / 10) * (rk(s, "deadly_bash") ? 1 + blk / 50 : 1) * (0.85 + Math.random() * 0.3);
    if (f.e?.red) d *= 1 - f.e.red;
    f.ehp -= d;
    if (typeof f.addXp === "function") f.addXp("Blocking", 12);
    const first = !f.tbBashed && typeof PFX !== "undefined" && PFX.has(s, "firstbash", f, {}); f.tbBashed = true;   // Shield Charge
    const tags = f.tags || new Set();
    const resist = tags.has("boss") || tags.has("dragon") ? 0.4 : tags.has("tough") ? 0.15 : 0;
    const shake = Math.max(0, resist - (rk(s, "power_bash") ? 0.15 : 0));
    let t = `Shield bash: ${Math.round(d)}`;
    if (!first && (f.tbStunCd || 0) > 0) return t + ` (${n} is still braced, no stun)`;
    if (!first && Math.random() < shake) { f.tbStunCd = 1; return t + ` (${n} shakes it off)`; }
    f.tbStunLeft = 1; f.tbStunCd = 3;   // counts down at the end of each round: this one, then 2 more
    const dis = pfx(s, "disarm", f); if (dis) f.disarmed = Math.max(f.disarmed || 0, dis);   // Disarming Bash
    return t + `, ${n} is stunned${dis ? " and their weapon knocked aside" : ""}!`;
  }
  /* the foe's turn: a stunned foe loses all its moves this round */
  function stunned(f, round) {
    if (!(f.tbStunLeft > 0)) return false;
    f.tbStunRound = round; return true;
  }
  function endRound(f, round) {
    if (f.tbStunRound === round) { f.tbStunLeft = 0; f.tbStunRound = null; }
    if (f.tbStunCd > 0) f.tbStunCd--;
  }
  return { passive, roll, cost, can, bash, stunned, endRound };
})();
if (typeof module !== "undefined") module.exports = SHIELDFX;
