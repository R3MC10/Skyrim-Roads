/* introquests.js: short first quests for the first unlocks. [OURS]
   An unlock scene (rewards.js) offers one of these with a "Start" button: one step each, a small useful reward, and they
   live in the normal Journal (QUESTS.L), tracked at once so the compass and the HUD show them as your goal.
   - The Blacksmith's Apprentice (smithing): make or improve one thing at a forge. 40 gold, an Iron Ingot and Leather.
   - Gifts of the Land (gathering): pick three plants or parts. 30 gold and a Potion of Minor Healing.
   - A Sword at Your Side (followers): hire a follower. 50 gold and a Potion of Minor Healing.
   - Hooves on the Road (horses): get a horse. 50 gold and a Potion of Stamina.
   - Into the Dark (first proper dungeon): clear any dungeon. 100 gold and a Potion of Healing.
   Objectives are checks (QUESTS met(): obj.test) against what the save already keeps, measured from the moment you start:
   Smithing XP, s.gather.got, s.follower, s.horse, s.cleared. Someone who already has a horse finishes that one at once. */
const INTROQ = (() => {
  const sk = (s, n) => { const k = s && s.skills && s.skills[n]; return k ? (k.lvl || 0) * 1e4 + (+k.xp || 0) : 0; };
  const picked = (s) => Object.values((s && s.gather && s.gather.got) || {}).reduce((a, b) => a + (+b || 0), 0);
  const clearedSince = (s, t) => Object.values((s && s.cleared) || {}).filter((x) => +x >= t).length;
  const snap = (s) => ({ smith: sk(s, "Smithing"), pick: picked(s) });
  /* id → [unlock id pattern, recommended level, the line] */
  const LINES = {
    intro_smith: [/smith|forge/i, 4, { name: "The Blacksmith's Apprentice", story: "hall", icon: "jobs", giver: "Any town forge", stages: [
      { title: "Heat the Forge", text: "Go to a town with a blacksmith (Area tab, Forge) and make or improve one thing. An Iron Dagger is the cheapest start.",
        obj: { test: (s, v) => sk(s, "Smithing") > ((v.snap || {}).smith ?? 0) }, reward: { gold: 40, items: ["mat_iron", "mat_leather"] } }] }],
    intro_gather: [/gather|harvest|forag/i, 3, { name: "Gifts of the Land", story: "dawn", icon: "angler", giver: "The wild", stages: [
      { title: "Pick Three", text: "Pick three plants or creature parts. Patches show as leaves on the map; walk close and Gather.",
        obj: { test: (s, v) => picked(s) >= ((v.snap || {}).pick ?? 0) + 3 }, reward: { gold: 30, items: ["potion_health_minor"] } }] }],
    intro_follower: [/follower|hireling|companion/i, 5, { name: "A Sword at Your Side", story: "guard", icon: "companions", giver: "Any inn", stages: [
      { title: "Hire a Follower", text: "Find someone to travel with you. Inns and town boards have people looking for work (Area tab).",
        obj: { test: (s) => !!s.follower }, reward: { gold: 50, items: ["potion_health_minor"] } }] }],
    intro_horse: [/horse|stable|mount/i, 6, { name: "Hooves on the Road", story: "dawn", icon: "travel", giver: "Any stables", stages: [
      { title: "Get a Horse", text: "Buy a horse at the stables outside a city. Riding makes every trip faster and the horse carries more.",
        obj: { test: (s) => !!s.horse }, reward: { gold: 50, items: ["potion_stamina"] } }] }],
    intro_dungeon: [/dungeon|delve|elite/i, 7, { name: "Into the Dark", story: "claw", icon: "bounty", giver: "The roads of Skyrim", stages: [
      { title: "Clear a Dungeon", text: "Pick a dungeon on the map and fight your way to its end. Rest rooms let you catch your breath.",
        obj: { test: (s, v) => clearedSince(s, v.t || 0) >= 1 }, reward: { gold: 100, items: ["potion_health"] } }] }],
  };
  const ids = Object.keys(LINES);
  for (const id of ids) { const L = LINES[id][2], ic = L.icon; L.emblem = (g) => { try { (UIART.QUEST[ic] || UIART.QUEST.bounty)(g); } catch { /* no art yet */ } }; }   // Journal emblem (uiart.js picks up .emblem); .story = eventart.js's scene
  if (typeof QUESTS !== "undefined") for (const id of ids) { QUESTS.L[id] = LINES[id][2]; QUESTS.REC[id] = [LINES[id][1]]; }
  /* the intro quest for an unlock id (or null) */
  const forUnlock = (uid) => ids.find((id) => LINES[id][0].test(String(uid || ""))) || null;
  const name = (id) => (LINES[id] ? LINES[id][2].name : "");
  const started = (s, id) => !!(s && s.quests && s.quests[id]);
  /* start it (once) and track it → the line to show, or "" */
  function start(s, id, now = typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000) {
    if (!s || !LINES[id] || started(s, id)) return "";
    s.quests = s.quests || {};
    s.quests[id] = { stage: 0, t: now, base: { ...(s.stats || {}) }, snap: snap(s) };
    s.trackQ = id;
    const st = LINES[id][2].stages[0];
    return `New quest: ${LINES[id][2].name}. ${st.text}`;
  }
  return { LINES, ids, forUnlock, name, start, started, snap };
})();
if (typeof module !== "undefined") module.exports = INTROQ;
