/* Achievements. Each one reads numbers the save already keeps, so old characters get credit right away.
   s.ach = { id: when earned }. check(s) returns the ones just earned (toast them). */
const ACH = (() => {
  const n = (v) => (Number.isFinite(v) ? v : 0);
  const questsDone = (s) => Object.values(s.quests || {}).filter((q) => q.done).length;
  const LIST = [
    // id, icon, name, what to do, [current, goal]
    ["first_steps", "🥾", "First Steps", "Reach level 5", (s) => [s.level, 5]],
    ["seasoned", "⚔️", "Seasoned", "Reach level 20", (s) => [s.level, 20]],
    ["explorer", "🗺", "Explorer", "Discover 30 places", (s) => [(s.discovered || []).length, 30]],
    ["delver", "🕯", "Delver", "Clear 10 dungeons", (s) => [Object.keys(s.cleared || {}).length, 10]],
    ["dragonslayer", "🐉", "Dragonslayer", "Slay a dragon", (s) => [n(s.dragons), 1]],
    ["dragonbane", "💀", "Bane of Dragons", "Slay 10 dragons", (s) => [n(s.dragons), 10]],
    ["thuum", "🗣", "The Voice", "Learn 10 Words of Power", (s) => [(s.words || []).length, 10]],
    ["stones", "🪨", "Touched by the Stones", "Take the blessing of all 13 standing stones", (s) => [new Set([...(s.stonesSeen || []), ...(s.stone ? [s.stone] : [])]).size, 13]],
    ["hero", "📜", "Hero of Skyrim", "Finish a quest line", (s) => [questsDone(s), 1]],
    ["legend", "🏆", "Legend", "Finish all four quest lines", (s) => [questsDone(s), 4]],
    ["homeowner", "🏠", "Homeowner", "Buy a house", (s) => [Object.keys(s.homes || {}).length, 1]],
    ["landlord", "🏰", "Landlord", "Own all five houses", (s) => [Object.keys(s.homes || {}).length, 5]],
    ["angler", "🎣", "Angler", "Catch 100 fish", (s) => [n((s.stats || {}).fish), 100]],
    ["light_fingers", "🪙", "Light Fingers", "Pick 25 pockets", (s) => [n((s.stats || {}).pp), 25]],
    ["builder", "⚑", "Hall Builder", "Give 1,000 to the Hall of the North", (s) => [n(s.hallPts), 1000]],
    ["champion", "🛡", "Arena Champion", "Win 10 duels in the Arena", (s) => [n((s.stats || {}).duels), 10]],
    ["stablemaster", "🐎", "Stablemaster", "Own a horse in armor", (s) => [s.horse && s.horse.armor && s.horse.armor !== "none" ? 1 : 0, 1]],
    ["rich", "💰", "Coin Hoarder", "Carry 10,000 gold", (s) => [n(s.gold), 10000]],
  ];
  const BY = Object.fromEntries(LIST.map((a) => [a[0], a]));
  function progress(s) { return LIST.map(([id, icon, name, what, f]) => { const [cur, goal] = f(s); return { id, icon, name, what, cur: Math.min(cur, goal), goal, done: !!(s.ach || {})[id] }; }); }
  /* marks newly reached ones; the first time on an old save they're granted quietly */
  function check(s, t = Date.now() / 1000) {
    const quiet = !s.ach; s.ach = s.ach || {};
    const fresh = [];
    for (const [id, icon, name, , f] of LIST) { if (s.ach[id]) continue; const [cur, goal] = f(s); if (cur >= goal) { s.ach[id] = t; if (!quiet) fresh.push({ id, icon, name }); } }
    return fresh;
  }
  const latest = (s, k = 6) => Object.entries(s.ach || {}).sort((a, b) => b[1] - a[1]).slice(0, k).map(([id]) => BY[id] && `${BY[id][1]} ${BY[id][2]}`).filter(Boolean);
  return { LIST, progress, check, latest, count: (s) => Object.keys(s.ach || {}).filter((id) => BY[id]).length, total: LIST.length };
})();
