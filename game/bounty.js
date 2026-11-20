/* The Jarl's bounty board: every week the whole world gets 3 shared goals.
   Each player writes only their own tally for the week ("bounty" collection, id week-playerId),
   so totals are just sums and nobody overwrites anybody. Weeks start Monday 00:00 UTC. [OURS] */
const BOUNTY = (() => {
  const WEEK = 7 * 864e5, MONDAY0 = Date.UTC(2026, 0, 5);   // a Monday
  const GOALS = {
    foes:     { title: "Clear the roads", text: "Win fights against bandits, beasts and worse", target: 120, gold: 300, item: ["mat_steel", 3], top: "Roadwarden" },
    dungeons: { title: "Into the deep", text: "Clear dungeons to the last room", target: 12, gold: 400, item: ["soul_gem_common", 1], top: "Delver" },
    dragons:  { title: "Dragon season", text: "Slay dragons (town attacks count for everyone who fought)", target: 3, gold: 500, item: ["mat_dwarven", 2], top: "Dragonbane" },
    potions:  { title: "The apothecary's order", text: "Brew potions at any alchemy lab", target: 40, gold: 250, item: ["mat_moonstone", 2], top: "Master Brewer" },
    arrivals: { title: "Map the North", text: "Arrive at places across Skyrim", target: 60, gold: 250, item: ["mat_leather", 4], top: "Pathfinder" },
    jobs:     { title: "Honest work", text: "Finish jobs from town notice boards", target: 15, gold: 300, item: ["mat_iron", 5], top: "Jarl's Hand" },
  };
  const KINDS = Object.keys(GOALS);
  const week = (t = Date.now()) => Math.floor((t - MONDAY0) / WEEK);
  const weekEnds = (w = week()) => MONDAY0 + (w + 1) * WEEK;
  /* three goals per week, the same on every phone */
  function goalsFor(w) {
    let x = (w * 2654435761) >>> 0; const rnd = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    const pool = [...KINDS], out = [];
    while (out.length < 3) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  }
  let docs = [], raw = [];
  function setDocs(list, me) {
    if (list) raw = list;
    docs = raw.filter((d) => Number.isInteger(d.week) && d.c && typeof d.c === "object" && typeof d.name === "string");
    if (me?.bounty && !docs.some((d) => d.uid === me.id && d.week === me.bounty.week)) docs.push({ uid: me.id, name: me.name, week: me.bounty.week, c: me.bounty.c });
    else if (me?.bounty) docs = docs.map((d) => (d.uid === me.id && d.week === me.bounty.week ? { ...d, c: me.bounty.c } : d));   // trust our own latest
  }
  const num = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  function goal(w, kind, meId) {
    const g = GOALS[kind], rows = docs.filter((d) => d.week === w && num(d.c[kind]) > 0).map((d) => ({ uid: d.uid, name: d.name, n: num(d.c[kind]) })).sort((a, b) => b.n - a.n);
    const total = rows.reduce((a, r) => a + r.n, 0), mine = rows.find((r) => r.uid === meId)?.n || 0;
    return { kind, ...g, total, done: total >= g.target, pct: Math.min(100, (100 * total) / g.target), helpers: rows.length, top: rows[0] || null, mine };
  }
  const board = (w, meId) => goalsFor(w).map((k) => goal(w, k, meId));
  /* count something you did; returns true when this week's record changed (the caller publishes it) */
  function add(s, kind, n = 1) {
    const w = week();
    if (!GOALS[kind] || !goalsFor(w).includes(kind) || !(n > 0)) return false;
    if (!s.bounty || s.bounty.week !== w) s.bounty = { week: w, c: {} };
    s.bounty.c[kind] = (s.bounty.c[kind] || 0) + n;
    return true;
  }
  const record = (s) => (s.bounty ? { uid: s.id, name: s.name, week: s.bounty.week, c: s.bounty.c, t: Date.now() / 1000 } : null);
  const claimKey = (w, kind) => `${w}:${kind}`;
  /* rewards stay claimable during the week after, too */
  function claimable(s, w, kind) {
    if (w < week() - 1 || w > week()) return false;
    const g = goal(w, kind, s.id);
    return g.done && g.mine > 0 && !(s.bountyClaimed || {})[claimKey(w, kind)];
  }
  function claim(s, w, kind) {
    if (!claimable(s, w, kind)) return null;
    const g = goal(w, kind, s.id);
    s.bountyClaimed = { ...(s.bountyClaimed || {}), [claimKey(w, kind)]: true };
    for (const k of Object.keys(s.bountyClaimed)) if (+k.split(":")[0] < week() - 2) delete s.bountyClaimed[k];   // keep it small
    s.gold += g.gold;
    const [item, qty] = g.item; if (D.ITEMS[item]) G.give(s, item, qty);
    let text = `The steward pays you ${g.gold} gold${D.ITEMS[item] ? ` and ${qty} ${D.ITEMS[item].name}${qty > 1 ? "s" : ""}` : ""} for helping with “${g.title}”.`;
    if (g.top?.uid === s.id && !(s.titles || []).includes(g.top && GOALS[kind].top)) { s.titles = [...(s.titles || []), GOALS[kind].top]; text += ` You did the most, so the Jarl names you ${GOALS[kind].top}.`; }
    return text;
  }
  return { GOALS, week, weekEnds, goalsFor, setDocs, board, goal, add, record, claimable, claim };
})();
