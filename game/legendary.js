/* Fair levelling: Legendary skills and a clear progress view.
   [Skyrim, Dawnguard patch 1.9] A skill at 100 can be made Legendary: it drops back to 15 and starts to grow again,
   so your character level keeps rising. [OURS] Unlike Skyrim you keep your perks (no refund, no re-buying), and each
   Legendary star adds BONUS_PER_STAR to the skill for good (up to MAX_BONUS), so going Legendary never makes you weaker
   for long. Foes follow your fighting skills (G.fightLevel), so resetting a combat skill also eases the road a little. */
const LEGEND = (() => {
  const BONUS_PER_STAR = 4, MAX_BONUS = 20, START = 15;
  const stars = (s, sk) => (s && s.legend && s.legend[sk]) || 0;
  const bonus = (s, sk) => Math.min(MAX_BONUS, BONUS_PER_STAR * stars(s, sk));
  const total = (s) => Object.values((s && s.legend) || {}).reduce((a, b) => a + b, 0);
  const ready = (s, sk) => !!(s && s.skills && s.skills[sk] && s.skills[sk].lvl >= 100);
  function make(s, sk) {
    if (!s.skills[sk]) return "No such skill.";
    if (!ready(s, sk)) return `${sk} must reach 100 before it can be made Legendary (it is ${s.skills[sk].lvl}).`;
    s.legend = s.legend || {};
    s.legend[sk] = stars(s, sk) + 1;
    s.skills[sk].lvl = START; s.skills[sk].xp = 0;
    const b = bonus(s, sk);
    return `⭐ ${sk} is Legendary (${s.legend[sk]}★). It starts again from ${START} and keeps your perks; it gives +${b} to ${sk} for good${b >= MAX_BONUS ? " (the most stars can give)" : ""}. Raising it again raises your level again.`;
  }
  /* a skill's progress: level, XP toward the next, percent and how far from 100 */
  function row(s, sk) {
    const k = s.skills[sk], need = k.lvl >= 100 ? 0 : F.skillXpNeeded(sk, k.lvl);
    return { sk, lvl: k.lvl, xp: k.xp, need, pct: need ? Math.max(0, Math.min(100, Math.round(100 * k.xp / need))) : 100, stars: stars(s, sk), bonus: bonus(s, sk), ready: k.lvl >= 100 };
  }
  /* everything the progress view needs */
  function progress(s) {
    const rows = D.ALL_SKILLS.filter((sk) => s.skills[sk]).map((sk) => row(s, sk));
    const growing = rows.filter((r) => !r.ready).sort((a, b) => b.pct - a.pct || b.lvl - a.lvl);
    const need = F.charXpNeeded(s.level);
    const fl = typeof G !== "undefined" && G.fightLevel ? G.fightLevel(s) : s.level;
    return { rows, closest: growing.slice(0, 3), ready: rows.filter((r) => r.ready), stars: total(s), level: s.level, charXp: s.charXp, charNeed: need, charPct: Math.round(100 * s.charXp / need), fightLevel: fl };
  }
  const starText = (n) => (n ? "★".repeat(Math.min(n, 5)) + (n > 5 ? `×${n}` : "") : "");
  return { BONUS_PER_STAR, MAX_BONUS, START, stars, bonus, total, ready, make, row, progress, starText };
})();
