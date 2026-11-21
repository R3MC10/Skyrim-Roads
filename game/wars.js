/* Clan wars: every week clans compete for Skyrim's nine holds. Members earn points for their clan
   in the hold where they earn them (fights won, dungeons cleared, dragon attacks fought, Arena wins
   count for Eastmarch). Each player writes only their own weekly record ("war", id week-playerId), so
   totals are sums. The clan on top when a week ends rules that hold for the whole next week, and its
   members shop 10% cheaper there. [OURS] */
const WARS = (() => {
  const POINTS = { fight: 1, dungeon: 5, raid: 3, duel: 3 };
  const MIN_TO_RULE = 10;
  const HOLDS = () => Object.keys(WORLD.holds);
  const week = () => BOUNTY.week();
  let docs = [], raw = [], cache = { t: 0, r: null };
  function setDocs(list, me) {
    if (list) raw = list;
    cache.r = null;
    docs = raw.filter((d) => Number.isInteger(d.week) && d.h && typeof d.h === "object" && d.uid);
    if (me?.war) { docs = docs.filter((d) => !(d.uid === me.id && d.week === me.war.week)); docs.push({ uid: me.id, name: me.name, week: me.war.week, h: me.war.h }); }
  }
  /* add points in a hold; returns true when the record changed (the caller publishes it) */
  function add(s, kind, hold, t = Date.now()) {
    if (!POINTS[kind] || !hold || !WORLD.holds[hold] || !s.clan) return false;
    const w = week();
    if (!s.war || s.war.week !== w) s.war = { week: w, h: {} };
    s.war.h[hold] = (s.war.h[hold] || 0) + POINTS[kind];
    return true;
  }
  const record = (s) => (s.war ? { uid: s.id, name: s.name, week: s.war.week, h: s.war.h, t: Date.now() / 1000 } : null);
  /* per hold: clans sorted by points for a week. Points only count while the player is really in the clan. */
  function standings(w, me) {
    const out = Object.fromEntries(HOLDS().map((h) => [h, {}]));
    for (const d of docs) {
      if (d.week !== w) continue;
      const c = CLANS.of(d.uid, me); if (!c) continue;
      for (const [h, p] of Object.entries(d.h)) if (out[h] && Number.isFinite(p) && p > 0) out[h][c.id] = (out[h][c.id] || 0) + Math.min(p, 5000);
    }
    const res = {};
    for (const h of HOLDS()) res[h] = Object.entries(out[h]).map(([id, pts]) => ({ clan: CLANS.byId(id), pts })).filter((x) => x.clan).sort((a, b) => b.pts - a.pts);
    return res;
  }
  /* who rules each hold this week: last week's winner */
  function rulers(me) {
    if (cache.r && Date.now() - cache.t < 5000) return cache.r;   // the map asks every frame
    const st = standings(week() - 1, me), r = {};
    for (const [h, list] of Object.entries(st)) if (list[0] && list[0].pts >= MIN_TO_RULE && (!list[1] || list[0].pts > list[1].pts)) r[h] = list[0].clan;
    cache = { t: Date.now(), r }; return r;
  }
  const discount = (s, hold) => { const r = rulers(s)[hold], c = CLANS.of(s.id, s); return r && c && r.id === c.id ? 0.9 : 1; };
  return { POINTS, MIN_TO_RULE, week, setDocs, add, record, standings, rulers, discount };
})();
