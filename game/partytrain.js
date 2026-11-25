/* partytrain.js: a party travelling together walks in a line on the world map instead of stacked on one spot.
   The leader is in front, the others follow one behind another along the road the leader came by (their trail),
   each a fixed screen distance apart so every little figure and its name can be read at any zoom. Standing in a
   town, the party lines up in a row beside the town's icon (strangers keep their own spots on the other side).
   Pure maths: map.js hands in map-unit points and gets back where each figure is drawn. */
const PARTYTRAIN = (() => {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // distance along the road as the eye needs it: figures are taller than wide, so going up or down the map a step
  // counts for less (tall > 1 spaces the line out more vertically, so a head never sits on the feet in front)
  const roadDist = (a, b, tall) => Math.hypot(a[0] - b[0], (a[1] - b[1]) / tall);
  /* who walks in the line, in order: the leader first (or you, when the leader isn't in sight), then party order.
     walkers: [{ id, pos: [x, y] map units, atPlace, moving }] (you included); only those close to the front join */
  function group(walkers, party, me, near) {
    const byId = new Map(walkers.map((w) => [w.id, w]));
    const lead = party && byId.get(party.leader) ? byId.get(party.leader) : byId.get(me);
    if (!lead) return [];
    const order = [lead.id, ...(party?.ids || []).filter((id) => id !== lead.id), me].filter((id, i, a) => a.indexOf(id) === i);
    const out = [];
    for (const id of order) {
      const w = byId.get(id); if (!w) continue;
      if (w === lead || (dist(w.pos, lead.pos) <= near && !!w.atPlace === !!lead.atPlace)) out.push(w);
    }
    return out.length > 1 ? out : [];
  }
  /* n spots behind `front`, `gap` apart, along `behind` (points going backwards from the front: the road walked).
     Past the end of the road, the line carries on the way the road's last bit pointed (or `dir` when there's none). */
  function along(front, behind, n, gap, dir = [-1, 0.35], tall = 1) {
    const pts = [front, ...(behind || []).filter((p) => p && isFinite(p[0]) && isFinite(p[1]))];
    const out = [];
    let seg = 0, at = pts[0], left = 0;   // left: distance still owed before the next spot
    for (let i = 1; i <= n; i++) {
      left += gap;
      while (seg < pts.length - 1) {
        const nx = pts[seg + 1], d = roadDist(at, nx, tall);
        if (d >= left && d > 1e-9) { const f = left / d; at = [at[0] + (nx[0] - at[0]) * f, at[1] + (nx[1] - at[1]) * f]; left = 0; break; }
        left -= d; at = nx; seg++;
      }
      if (left > 0) {   // ran off the end of the road: keep going straight
        let dx = dir[0], dy = dir[1];
        for (let j = pts.length - 1; j > 0; j--) { const a = pts[j - 1], b = pts[j], d = dist(a, b); if (d > 1e-6) { dx = (b[0] - a[0]) / d; dy = (b[1] - a[1]) / d; break; } }
        const m = Math.hypot(dx, dy / tall) || 1;
        at = [at[0] + (dx / m) * left, at[1] + (dy / m) * left]; left = 0;
        pts.push(at); seg = pts.length - 1;
      }
      out.push(at);
    }
    return out;
  }
  /* in a town: a row to the right of the town's icon, the first one `first` from it, then `gap` apart */
  const row = (town, n, gap, first) => Array.from({ length: n }, (_, i) => [town[0] + first + i * gap, town[1]]);
  /* the whole thing: walkers (as in group) plus behind (the leader's road walked, map units, going backwards).
     Returns Map id → [x, y] where to draw each one in the line; walkers not in it aren't in the map. */
  function place(walkers, { party, me, behind, gap, near, first, tall = 1 }) {
    const gr = group(walkers, party, me, near), out = new Map();
    if (!gr.length) return out;
    const lead = gr[0];
    const spots = lead.atPlace && !lead.moving ? row(lead.pos, gr.length, gap, first) : [lead.pos, ...along(lead.pos, behind, gr.length - 1, gap, undefined, tall)];
    gr.forEach((w, i) => out.set(w.id, spots[i]));
    return out;
  }
  return { group, along, row, place };
})();
if (typeof module !== "undefined") module.exports = PARTYTRAIN;
