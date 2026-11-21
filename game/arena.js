/* The Arena in Windhelm: friendly duels between players, with an optional bet.
   Nobody dies here: the loser kneels and the healers patch everyone up.
   The challenger's stake leaves their purse at once (held in the challenge, like trade offers),
   the opponent puts in the same when they accept, and the winner takes both.
   Ratings are per season (one calendar month, UTC) and start at 1000 (Elo, K=32). [OURS] */
const ARENA = (() => {
  const TOWN = "Windhelm", START = 1000, K = 32, MAX_STAKE = 5000, OPEN_MIN = 30;
  const season = (t = Date.now()) => { const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const seasonName = (id = season()) => { const [y, m] = id.split("-"); return `${["Morning Star", "Sun's Dawn", "First Seed", "Rain's Hand", "Second Seed", "Midyear", "Sun's Height", "Last Seed", "Hearthfire", "Frostfall", "Sun's Dusk", "Evening Star"][+m - 1]} ${y}`; };   // Skyrim's month names
  function me(s) { if (!s.arena || s.arena.season !== season()) s.arena = { season: season(), rating: START, w: 0, l: 0 }; return s.arena; }
  const expected = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  function rate(s, oppRating, won) {
    const a = me(s), before = a.rating;
    a.rating = Math.round(a.rating + K * ((won ? 1 : 0) - expected(a.rating, oppRating || START)));
    if (won) a.w++; else a.l++;
    s.stats = { ...(s.stats || {}), duels: ((s.stats || {}).duels || 0) + (won ? 1 : 0) };   // all-time, for achievements
    return a.rating - before;
  }
  const here = (s) => s.location === TOWN && !s.trip && !s.dungeon;
  /* -> { id, doc, text } or { err } */
  function challenge(s, card, stake, t = G.now()) {
    if (!here(s)) return { err: "Duels happen in the Arena in Windhelm." };
    if (!card || card.loc !== TOWN) return { err: `${card?.name || "They"} must be in Windhelm too.` };
    if (card.id === s.id) return { err: "You can't duel yourself." };
    stake = Math.max(0, Math.min(MAX_STAKE, Math.floor(+stake || 0)));
    if (stake > s.gold) return { err: `You only have ${s.gold} gold.` };
    s.gold -= stake;
    const id = `${s.id}-${Math.floor(t)}-${Math.floor(Math.random() * 900 + 100)}`;
    return { id, text: `You challenge ${card.name}${stake ? ` for ${stake} gold` : " to a friendly bout"}. ${stake ? "Your stake is held by the arena master." : ""}`,
      doc: { from: s.id, fromName: s.name, to: card.id, toName: card.name, stake, status: "open", t, season: season(), aRating: me(s).rating, aCard: MP.stats(s) } };
  }
  /* the opponent's game says yes and runs the bout. Returns the new doc, or null (with why) */
  function accept(s, doc, t = G.now()) {
    if (doc.status !== "open" || doc.to !== s.id) return { err: "That challenge is gone." };
    if (!here(s)) return { err: "Go to Windhelm to answer the challenge." };
    if (t - doc.t > OPEN_MIN * 60) return { err: "That challenge has expired." };
    if (s.gold < doc.stake) return { err: `You need ${doc.stake} gold to match the stake.` };
    s.gold -= doc.stake;
    const f = bout(doc.aCard || {}, MP.stats(s), doc.fromName);   // both fighters judged the same way: fair for whoever accepts
    const skills = G.useSkill(s, "One-Handed", 6).concat(G.useSkill(s, "Blocking", 4));
    const iWon = !!f.won, pot = doc.stake * 2, bRating = me(s).rating;
    const delta = rate(s, doc.aRating, iWon);
    if (iWon) s.gold += pot;
    return { doc: { ...doc, status: "done", winner: iWon ? doc.to : doc.from, pot, bRating, turns: f.turn, done: t }, fight: f, skills, delta,
      text: iWon ? `${doc.fromName} goes down on one knee. You win${pot ? ` ${pot} gold` : ""}. Rating ${delta >= 0 ? "+" : ""}${delta}.` : `You end up on one knee. ${doc.fromName} wins${pot ? ` the ${pot} gold` : ""}. Rating ${delta}.` };
  }
  /* a symmetric bout between two players' fighting stats. Returns a fight log the UI can show. [OURS] */
  function bout(a, b, aName) {
    let ha = Math.max(1, a.hp || 100) + (a.heal || 0), hb = Math.max(1, b.hp || 100) + (b.heal || 0);
    const maxA = ha, maxB = hb, log = [];
    const hit = (dmg, red) => Math.max(1, (dmg || 5) * (0.55 + Math.random() * 0.9) * (1 - Math.min(0.8, red || 0)));
    let turn = 0, aFirst = Math.random() < 0.5;
    while (ha > 0 && hb > 0 && turn < 80) {
      turn++;
      const x = Math.round(hit(b.dmg, a.red)), y = Math.round(hit(a.dmg, b.red));
      if (aFirst) { hb -= y; if (hb > 0) ha -= x; } else { ha -= x; if (ha > 0) hb -= y; }
      log.push({ turn, me: `You hit for ${x}`, them: `${aName} hits for ${y}`, hp: Math.max(0, Math.round(hb)), ehp: Math.max(0, Math.round(ha)) });
    }
    const won = ha <= 0 || (hb > 0 && hb / maxB > ha / maxA);
    return { won, turn, log: log.length > 12 ? [...log.slice(0, 6), ...log.slice(-6)] : log };
  }
  /* the challenger's game settles: winnings, or the stake back */
  function settle(s, doc) {
    if (doc.from !== s.id) return null;
    if (doc.status === "done") {
      const won = doc.winner === s.id, delta = doc.season === season() ? rate(s, doc.bRating, won) : 0;
      if (won) s.gold += doc.pot || 0;
      return won ? `You beat ${doc.toName} in the Arena${doc.pot ? `: +${doc.pot} gold` : ""}. Rating ${delta >= 0 ? "+" : ""}${delta}.` : `${doc.toName} beat you in the Arena${doc.stake ? ` and took your ${doc.stake} gold` : ""}. Rating ${delta}.`;
    }
    if (doc.status === "declined" || doc.status === "cancelled") { s.gold += doc.stake || 0; return doc.status === "declined" ? `${doc.toName} turned down your challenge.${doc.stake ? " Your stake is back." : ""}` : "Challenge withdrawn."; }
    return null;
  }
  const board = (docs, s) => {
    const sid = season(), rows = docs.filter((d) => d.arena && d.arena.season === sid && (d.arena.w + d.arena.l) > 0).map((d) => ({ id: d.id, name: d.name, ...d.arena }));
    if (s && (me(s).w + me(s).l) > 0 && !rows.some((r) => r.id === s.id)) rows.push({ id: s.id, name: s.name, ...me(s) });
    return rows.sort((a, b) => b.rating - a.rating || b.w - a.w);
  };
  return { TOWN, START, MAX_STAKE, OPEN_MIN, season, seasonName, me, here, challenge, accept, settle, board };
})();
