/* weaponfx.js: how each weapon's blow looks in a fight. [OURS]
   Remigiusz: "weapon effects are too strong and don't really fit the weapon", "weapon effects should play correctly".
   One table says, per kind of weapon, what the swing leaves behind and what the hit looks like:
     blade  (sword, greatsword)        a thin slash arc            chop   (axe, battleaxe)          a short chop arc
     blunt  (mace, club, warhammer)    a short heavy thud and dust, no slash
     stab   (dagger)                   a quick small stab          pierce (spear)                   a thrust
     punch  (fists)                    a short jab                 shot / bolt (bow, crossbow)      the arrow itself (arrowfx.js)
     staff                             a bolt from the staff's tip
   Rules every weapon follows (fightart.js and movefx.js read this file; tests/test_weaponfx.js checks it):
   - the trail plays during the swing only: from a little before each contact frame until just after it;
   - the hit plays on the contact frame, once per hit, at the weapon's tip pulled onto the target's body;
   - a miss only whiffs (a faint pass, no sparks, no gash); nothing keeps playing once the move is over. */
const WEAPONFX = (() => {
  const KIND = { dagger: "stab", sword: "blade", greatsword: "blade", axe: "chop", battleaxe: "chop", mace: "blunt", club: "blunt", warhammer: "blunt",
    spear: "pierce", fist: "punch", bow: "shot", crossbow: "bolt", staff: "staff" };
  /* trail: the smear's shape (null = none) · life: how long a point stays (s) · reach: how far down the blade it goes
     · turn: the last radians of blade travel it keeps · a: strength
     slash: the stroke on the contact frame (movefx.js): arc · chop · stab · thrust · jab · null · r: its size · th: arc thickness (× r)
     sparks / chips / dust: particles on contact (before the power or final-blow bonus) · ring: a dust ring on the ground */
  const PROFILE = {
    blade: { trail: "arc", life: 0.11, reach: 0.4, turn: 1.2, a: 1, slash: "arc", r: 20, th: 0.08, sparks: 4, chips: 0, dust: 0, ring: 0 },
    chop: { trail: "chop", life: 0.1, reach: 0.32, turn: 1.0, a: 0.9, slash: "chop", r: 20, th: 0.11, sparks: 4, chips: 2, dust: 0, ring: 0 },
    blunt: { trail: "blunt", life: 0.07, reach: 0.22, turn: 0.7, a: 0.55, slash: null, r: 14, th: 0, sparks: 0, chips: 3, dust: 5, ring: 1 },
    stab: { trail: "stab", life: 0.07, reach: 0.18, turn: 0.5, a: 0.8, slash: "stab", r: 16, th: 0, sparks: 3, chips: 0, dust: 0, ring: 0 },
    pierce: { trail: "stab", life: 0.08, reach: 0.2, turn: 0.6, a: 0.85, slash: "thrust", r: 26, th: 0, sparks: 3, chips: 0, dust: 0, ring: 0 },
    punch: { trail: null, life: 0, reach: 0, turn: 0, a: 0, slash: "jab", r: 12, th: 0, sparks: 0, chips: 0, dust: 2, ring: 0 },
    shot: { trail: null, life: 0, reach: 0, turn: 0, a: 0, slash: null, r: 0, th: 0, sparks: 0, chips: 0, dust: 0, ring: 0 },
    staff: { trail: null, life: 0, reach: 0, turn: 0, a: 0, slash: null, r: 0, th: 0, sparks: 0, chips: 0, dust: 0, ring: 0 },
  };
  PROFILE.bolt = PROFILE.shot;
  const OVER = { greatsword: { trail: "wide", reach: 0.5, r: 26, sparks: 5 }, battleaxe: { r: 24, chips: 3 }, warhammer: { r: 18, dust: 7, chips: 4 }, club: { r: 13 } };
  const kindOf = (wt) => KIND[wt] || "blade";
  const CACHE = new Map();
  function of(wt) {
    const k = wt || "sword"; let p = CACHE.get(k);
    if (!p) { const kind = kindOf(k); p = Object.freeze({ kind, ...PROFILE[kind], ...(OVER[k] || {}) }); CACHE.set(k, p); }
    return p;
  }
  /* how long before / after a contact frame the trail plays (u, 0..1 of the move): a dagger's two stabs each get their own */
  const PRE = 0.18, POST = 0.1, SHOW = 0.13;
  function windows(hits) {
    const hs = hits || [];
    return hs.map((h, i) => { const gap = i ? h - hs[i - 1] : 1; return [Math.max(i ? hs[i - 1] + 0.02 : 0, h - Math.min(PRE, gap * 0.6)), h + Math.min(POST, i < hs.length - 1 ? (hs[i + 1] - h) * 0.3 : POST)]; });
  }
  /* the hit whose swing is on at u (-1 = none): sample = while the tip is recorded, else while the smear is still shown */
  function swingAt(hits, u, show) {
    const w = windows(hits);
    for (let i = 0; i < w.length; i++) if (u >= w[i][0] && u <= (show ? hits[i] + SHOW : w[i][1])) return i;
    return -1;
  }
  /* where a blow lands: the weapon tip pulled onto the target's body (a box round its chest); no tip → the near edge of the body */
  function anchor(tip, box, dir) {
    const hw = box.w / 2, hh = box.h / 2;
    if (!tip || !isFinite(tip[0]) || !isFinite(tip[1])) return [box.x - dir * hw * 0.6, box.y];
    return [Math.max(box.x - hw, Math.min(box.x + hw, tip[0])), Math.max(box.y - hh, Math.min(box.y + hh, tip[1]))];
  }
  /* what plays when, for one move (tests and the screen test read it): [{u, k: trail|impact|whiff, i}] */
  function plan(wt, hits, miss) {
    const p = of(wt), out = [], w = windows(hits);
    (hits || []).forEach((h, i) => { if (p.trail) out.push({ u: w[i][0], k: "trail", i }); out.push({ u: h, k: miss ? "whiff" : "impact", i }); });
    return out;
  }
  return { KIND, PROFILE, kindOf, of, windows, swingAt, anchor, plan, PRE, POST, SHOW };
})();
