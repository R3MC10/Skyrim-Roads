/* remake.js: "Make your hero anew", a one-time remake for every hero made before women heroes and the new looks came in. [OURS]
   G.migrate marks an old save once (s.remake = 1, s.rmkV = REMAKE.V); new characters are born with s.rmkV and never get it.
   Back on the map at a quiet moment (not in a fight, a dungeon, a party run or vote, a trade or a mini-game) the creator opens
   in "remake" mode (chargen.js): name, race, sex and look again. Level, skills you trained, perks, gear and quests stay.
   Changing race moves only the race's starting skill boost (+10 / +5 / +5, Speech = Speechcraft and Mercantile) from the old
   race to the new one; racial power, abilities and resistances follow s.race by themselves (powers.js, racefx.js).
   "Keep as is" confirms what you have and counts as done.
     REMAKE.bonus(race) → { skill: +n } · REMAKE.swapRace(s, race) · REMAKE.finish(s, { name, race, app }) · REMAKE.keep(s)
     REMAKE.pending(s) · REMAKE.quiet(ctx) (ctx = { S, title, safe(), voting() }) */
const REMAKE = (() => {
  const V = 1;
  const base = () => (typeof D !== "undefined" && D.BASE_SKILL) || 15;
  /* the starting skill boost a race gives (engine.js newSave uses the same table) */
  function bonus(raceId) {
    const r = typeof D !== "undefined" && D.RACES[raceId], out = {};
    if (!r) return out;
    (r.skills || []).forEach((sk, i) => {
      for (const t of (sk === "Speech" ? ["Speechcraft", "Mercantile"] : [sk])) out[t] = (out[t] || 0) + (i === 0 ? 10 : 5);
    });
    return out;
  }
  /* mark a loaded save once (G.migrate calls this) */
  function mark(s) {
    if (!s || typeof s !== "object") return false;
    if ((s.rmkV || 0) >= V) return false;
    s.rmkV = V; s.remake = 1;
    return true;
  }
  const pending = (s) => !!(s && s.remake);
  /* swap the race's starting boost: take the old race's part off (never below the base skill), put the new race's on (max 100) */
  function swapRace(s, raceId) {
    if (!s || !D.RACES[raceId] || s.race === raceId) return false;
    const was = bonus(s.race), now = bonus(raceId), b = base();
    s.skills = s.skills || {};
    for (const [k, n] of Object.entries(was)) { const sk = s.skills[k]; if (sk) sk.lvl = Math.max(b, (sk.lvl || b) - n); }
    for (const [k, n] of Object.entries(now)) {
      const sk = s.skills[k] || (s.skills[k] = { lvl: b, xp: 0 });
      sk.lvl = Math.min(100, (sk.lvl || b) + n);
    }
    // xp already earned toward the next point stays, but never more than that point needs
    if (typeof F !== "undefined" && F.skillXpNeeded) for (const k of new Set([...Object.keys(was), ...Object.keys(now)])) {
      const sk = s.skills[k]; if (!sk) continue;
      const need = F.skillXpNeeded(k, sk.lvl); if (sk.lvl < 100 && sk.xp >= need) sk.xp = Math.max(0, need - 1);
    }
    s.race = raceId;
    return true;
  }
  /* done in the creator: name (if it's a good one), race, then the look (sex comes with the look: APPEAR.apply sets s.sex) */
  function finish(s, o = {}) {
    if (!s) return s;
    const n = String(o.name || "").trim().slice(0, 24);
    if (n && n !== s.name && !(typeof NICK !== "undefined" && NICK.problem(n))) s.name = n;
    if (o.race && o.race !== s.race) swapRace(s, o.race);
    if (o.app && typeof APPEAR !== "undefined") APPEAR.apply(s, o.app);
    else if (o.app) { s.app = o.app; if (o.app.sx === "f") s.sex = "f"; else delete s.sex; }
    keep(s);
    return s;
  }
  function keep(s) { if (s) { delete s.remake; s.rmkV = V; } return s; }
  /* is now a good moment to open it? back on the map, nothing else on screen, no party vote */
  function quiet(ctx = {}) {
    const S = ctx.S;
    if (!pending(S) || ctx.title) return false;
    if (S.dungeon || S.encounter || S.trip?.event || S.trip?.status === "encounter") return false;
    if (ctx.voting && ctx.voting()) return false;
    if (ctx.safe && !ctx.safe()) return false;
    return true;
  }
  return { V, bonus, mark, pending, swapRace, finish, keep, quiet };
})();
if (typeof module !== "undefined") module.exports = REMAKE;
