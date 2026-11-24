/* holdrule.js: player-run holds. [OURS]
   Builds on the sides (sides.js, which answers for CLANS) and the weekly side war points (wars.js):
   - CLAIM: a side member who stands in a hold nobody has claimed, and whose side has earned at least 10 war points
     there this week, can challenge the hold's champion (a strong fight). Win, and the side takes the Jarl's seat.
   - JARL: the members of the ruling side vote for one of their own. Terms are half a week (Monday 00:00 and
     Thursday 12:00 UTC); the votes standing when a term starts pick the Jarl for that term. Until the first vote
     counts, whoever took the hold acts as Jarl.
   - TAX: the Jarl sets a small tax on shop sales in the hold (0-5%, 2% to start). Players outside the ruling side pay
     it on what they buy there; it fills the side treasury. The Jarl spends the treasury on guards (raids get harder),
     a market discount (5% off for everyone for 3 days) or repairs (+1 wall).
   - RAIDS: once a week, from Saturday 12:00 to Monday 00:00 UTC, other sides (with 10 war points there that week)
     can raid. Each won raid knocks down a wall; a won raid with no walls left takes the hold. A hold that changed
     hands is safe until next week's window.
   Shared data: collection "holds", one record per player (id = their id): what they won, how they vote, tax they
   paid, and (Jarls) their decrees and spending. Nobody writes anybody else's record; everything here is worked out
   from all records the same way on every phone. Offline or alone, nobody rules and nothing changes. */
const HOLDRULE = (() => {
  const DAY = 864e5, WEEK = 7 * DAY, TERM = WEEK / 2;
  const TAX_MAX = 0.05, TAX_DEFAULT = 0.02, TAX_STEP = 0.01;
  const WALLS = 2, WALLS_MAX = 4;
  const WIN_OPEN = 5.5 * DAY;                      // Saturday 12:00 UTC, to the end of the week (Monday 00:00)
  const SPEND = {
    guards: { cost: 300, days: 7, max: 2, name: "Hire guards", what: "Raiders face more defenders for a week (up to 2 hires)." },
    market: { cost: 250, days: 3, off: 0.05, name: "Market discount", what: "Shops in the hold sell 5% cheaper to everyone for 3 days." },
    repair: { cost: 200, name: "Repair the walls", what: "+1 wall (up to 4). Raiders must knock every wall down before they can take the hold." },
  };
  const MIN_LEVEL = 10, RETRY = 30 * 60e3, CLAIM_GOLD = 150, RAID_GOLD = 100, KEEP = 40;
  const HOLDS = () => (typeof WORLD !== "undefined" ? Object.keys(WORLD.holds) : []);
  const pf = (s, k) => (typeof PFX !== "undefined" && s ? PFX.num(s, k) : 0);
  const okNum = (x) => Number.isFinite(x);
  let clock = null;   // tests set a fixed time
  const now = () => (clock ? clock() : Date.now());

  // ---------------------------------------------------------------- the calendar
  const weekOf = (t) => BOUNTY.week(t);
  const weekStart = (t) => BOUNTY.weekEnds(weekOf(t)) - WEEK;
  const termStart = (t) => { const ws = weekStart(t); return t - ws >= TERM ? ws + TERM : ws; };
  const termEnds = (t) => termStart(t) + TERM;
  function windowAt(t) {
    const ws = weekStart(t), o = ws + WIN_OPEN, c = ws + WEEK;
    return t >= o ? { open: true, opens: o, closes: c } : { open: false, opens: o, closes: c };
  }

  // ---------------------------------------------------------------- shared records
  let docs = [], cache = { t: 0, seats: null, at: 0 };
  const blank = () => ({ acts: [], votes: {}, paid: {}, jarl: {}, spends: [] });
  function st(s) {
    const h = (s.holdrule = s.holdrule && typeof s.holdrule === "object" ? s.holdrule : blank());
    for (const [k, v] of Object.entries(blank())) if (!h[k] || typeof h[k] !== typeof v || Array.isArray(h[k]) !== Array.isArray(v)) h[k] = v;
    return h;
  }
  /* what this player publishes */
  function record(s) {
    const h = st(s);
    return { uid: s.id, name: s.name, acts: h.acts.slice(-KEEP), votes: h.votes, paid: h.paid, jarl: h.jarl, spends: h.spends.slice(-KEEP), purse: Math.min(0.2, pf(s, "jarlpurse")), t: now() };
  }
  const clean = (d) => d && typeof d === "object" && typeof d.uid === "string" && d.uid;
  function setDocs(list, me) {
    if (list) { const by = new Map(); for (const d of list.filter(clean)) by.set(d.uid, d); docs = [...by.values()]; }   // one record per player (the last one wins)
    if (me && me.holdrule) { docs = docs.filter((d) => d.uid !== me.id); docs.push(record(me)); }
    cache.seats = null;
  }
  const docOf = (uid) => docs.find((d) => d.uid === uid) || null;
  const member = (uid, cid, me) => !!cid && CLANS.of(uid, me)?.id === cid;
  const seatKey = (seat) => (seat ? `${seat.hold}|${seat.cid}|${seat.since}` : "");

  // ---------------------------------------------------------------- who holds what: replay every won fight in order
  function seats(t = now(), me = null) {
    if (cache.seats && cache.at === t) return cache.seats;
    if (cache.seats && Math.abs(t - cache.at) < 5000 && t >= cache.at) return cache.seats;   // the map asks every frame
    const holds = new Set(HOLDS()), ev = [];
    for (const d of docs) {
      for (const a of Array.isArray(d.acts) ? d.acts : []) if (a && a.win && holds.has(a.h) && (a.k === "claim" || a.k === "raid") && okNum(a.t) && a.t <= t) ev.push({ ...a, uid: d.uid });
      for (const sp of Array.isArray(d.spends) ? d.spends : []) if (sp && sp.what === "repair" && holds.has(sp.h) && okNum(sp.t) && sp.t <= t) ev.push({ k: "repair", h: sp.h, seat: sp.seat, t: sp.t, uid: d.uid });
    }
    ev.sort((a, b) => a.t - b.t || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    const out = {};
    for (const e of ev) {
      let s = out[e.h];
      if (s && !CLANS.byId(s.cid)) { delete out[e.h]; s = null; }   // the side was disbanded
      if (e.k === "repair") { if (s && seatKey(s) === e.seat && member(e.uid, s.cid, me)) s.walls = Math.min(WALLS_MAX, s.walls + 1); continue; }
      if (!CLANS.byId(e.c) || !member(e.uid, e.c, me)) continue;
      if (!s) { if (e.k === "claim") out[e.h] = { hold: e.h, cid: e.c, since: e.t, by: e.uid, walls: WALLS, hits: 0, week: weekOf(e.t) }; continue; }
      if (s.cid === e.c || e.k !== "raid" || !windowAt(e.t).open || weekOf(e.t) === s.week || e.seat !== seatKey(s)) continue;
      if (s.walls > 0) { s.walls--; s.hits++; continue; }
      out[e.h] = { hold: e.h, cid: e.c, since: e.t, by: e.uid, walls: WALLS, hits: 0, week: weekOf(e.t), took: s.cid };
    }
    for (const [h, s] of Object.entries(out)) { const c = CLANS.byId(s.cid); if (!c) delete out[h]; else s.clan = c; }
    cache = { seats: out, at: t };
    return out;
  }
  const seatOf = (hold, t = now(), me = null) => seats(t, me)[hold] || null;
  const locked = (seat, t = now()) => !!seat && weekOf(t) === seat.week;

  // ---------------------------------------------------------------- the Jarl
  function jarlOf(seat, t = now(), me = null) {
    if (!seat) return null;
    const mem = CLANS.members(seat.clan), ids = new Set(mem.map((m) => m.id)), name = (id) => mem.find((m) => m.id === id)?.name || docOf(id)?.name || "someone";
    if (!ids.size) return null;
    const ts = termStart(t), tally = {};
    for (const d of docs) {
      if (!ids.has(d.uid)) continue;
      const v = d.votes && d.votes[seat.hold]; if (!v) continue;
      const [vc, vt] = okNum(v.t) && v.t < ts ? [v.c, v.t] : [v.p, v.pt];   // the vote that stood when this term began
      if (!ids.has(vc) || !okNum(vt) || vt < seat.since || vt >= ts) continue;
      tally[vc] = (tally[vc] || 0) + 1;
    }
    const pref = [seat.by, seat.clan.founder];
    const rank = (id) => { const i = pref.indexOf(id); return i < 0 ? 9 : i; };
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]) || (a[0] < b[0] ? -1 : 1))[0];
    if (best) return { uid: best[0], name: name(best[0]), votes: best[1], acting: false, ends: termEnds(t) };
    const uid = ids.has(seat.by) ? seat.by : ids.has(seat.clan.founder) ? seat.clan.founder : [...ids].sort()[0];
    return { uid, name: name(uid), votes: 0, acting: true, ends: termEnds(t) };
  }
  /* votes cast so far for the next term (what the count will be when this term ends) */
  function nextCount(seat, t = now()) {
    if (!seat) return [];
    const mem = CLANS.members(seat.clan), ids = new Set(mem.map((m) => m.id)), tally = {};
    for (const d of docs) { const v = ids.has(d.uid) && d.votes && d.votes[seat.hold]; if (v && ids.has(v.c) && okNum(v.t) && v.t >= seat.since && v.t <= t) tally[v.c] = (tally[v.c] || 0) + 1; }
    return mem.map((m) => ({ id: m.id, name: m.name, n: tally[m.id] || 0 })).sort((a, b) => b.n - a.n || (a.name < b.name ? -1 : 1));
  }
  const isJarl = (s, hold, t = now()) => { const seat = seatOf(hold, t, s); return !!seat && jarlOf(seat, t, s)?.uid === s.id; };

  // ---------------------------------------------------------------- tax, treasury and what it bought
  const clampTax = (x) => Math.max(0, Math.min(TAX_MAX, Math.round((+x || 0) / TAX_STEP) * TAX_STEP));
  function taxOf(seat, t = now(), me = null) {
    if (!seat) return 0;
    const j = jarlOf(seat, t, me), dec = j && docOf(j.uid)?.jarl?.[seat.hold];
    return dec && okNum(dec.tax) && okNum(dec.t) && dec.t >= seat.since ? clampTax(dec.tax) : TAX_DEFAULT;
  }
  function treasury(seat, t = now(), me = null) {
    if (!seat) return { income: 0, spent: 0, balance: 0, list: [] };
    const key = seatKey(seat), j = jarlOf(seat, t, me);
    let income = 0;
    for (const d of docs) { const p = d.paid && d.paid[key]; if (okNum(p) && p > 0) income += Math.min(p, 20000); }
    const purse = j ? Math.max(0, Math.min(0.2, +(docOf(j.uid)?.purse) || 0)) : 0;   // Jarl's Favour: taxes bring 20% more
    income = Math.floor(income * (1 + purse));
    const list = [];
    for (const d of docs) for (const sp of Array.isArray(d.spends) ? d.spends : []) if (sp && sp.seat === key && SPEND[sp.what] && okNum(sp.t) && sp.t <= t && member(d.uid, seat.cid, me)) list.push({ ...sp, uid: d.uid });
    list.sort((a, b) => a.t - b.t);
    let spent = 0; const ok = [];
    for (const sp of list) { const c = SPEND[sp.what].cost; if (spent + c <= income) { spent += c; ok.push(sp); } }
    return { income, spent, balance: income - spent, list: ok };
  }
  function effects(seat, t = now(), me = null) {
    if (!seat) return { guards: 0, market: 0, marketEnds: 0 };
    const { list } = treasury(seat, t, me);
    const g = list.filter((x) => x.what === "guards" && t - x.t < SPEND.guards.days * DAY);
    const m = list.filter((x) => x.what === "market" && t - x.t < SPEND.market.days * DAY);
    return { guards: Math.min(SPEND.guards.max, g.length), guardsEnd: g.length ? Math.min(...g.map((x) => x.t)) + SPEND.guards.days * DAY : 0,
      market: m.length ? SPEND.market.off : 0, marketEnds: m.length ? Math.max(...m.map((x) => x.t)) + SPEND.market.days * DAY : 0 };
  }
  const yourTax = (s, seat, t = now()) => (!seat || member(s.id, seat.cid, s) ? 0 : taxOf(seat, t, s) * Math.max(0, 1 - Math.min(1, pf(s, "holdtax"))));
  /* shop prices in a hold: tax for outsiders, the Jarl's market discount for everyone, Jarl's Favour for the ruling side */
  function priceMult(s, hold, t = now()) {
    const seat = seatOf(hold, t, s); if (!seat || !s) return 1;
    let m = 1 + yourTax(s, seat, t);
    const fx = effects(seat, t, s); if (fx.market) m *= 1 - fx.market;
    if (member(s.id, seat.cid, s)) m *= 1 - Math.min(0.1, pf(s, "jarlfav"));
    return m;
  }
  /* after a purchase: the tax part of what you paid goes to the hold's treasury (kept in your own record) */
  function paid(s, hold, gold, t = now()) {
    const seat = seatOf(hold, t, s), rate = yourTax(s, seat, t);
    if (!seat || !(rate > 0) || !(gold > 0)) return 0;
    const tax = Math.round(gold * rate / (1 + rate) * 100) / 100, h = st(s), k = seatKey(seat);
    h.paid[k] = Math.round(((h.paid[k] || 0) + tax) * 100) / 100;
    const keys = Object.keys(h.paid); for (const key of keys.slice(0, Math.max(0, keys.length - 12))) delete h.paid[key];   // old seats: keep it small
    cache.seats = null;
    return tax;
  }

  // ---------------------------------------------------------------- challenges and raids
  const holdHere = (s) => (s.location && WORLD.places[s.location] ? G.holdAt(WORLD.places[s.location]) : null);
  function warPts(s, hold, cid) {
    if (typeof WARS === "undefined") return 0;
    const row = (WARS.standings(WARS.week(), s)[hold] || []).find((x) => x.clan.id === cid);
    return row ? row.pts : 0;
  }
  /* what you could do in this hold right now: { kind: "claim"|"raid"|null, why } */
  function canFight(s, hold, t = now(), ctx = {}) {
    const c = CLANS.of(s.id, s);
    const seat = seatOf(hold, t, s);
    const kind = seat ? "raid" : "claim";
    if (!c) return { kind, why: "Pick a side first: only sides can rule a hold." };
    if (seat && seat.cid === c.id) return { kind: null, why: "Your side rules here." };
    if (ctx.role === "member") return { kind, why: "Only your party leader can start a hold challenge." };
    if ((s.level || 1) < MIN_LEVEL) return { kind, why: `Come back at level ${MIN_LEVEL}.` };
    if (holdHere(s) !== hold) return { kind, why: `You have to be in ${hold} for that.` };
    if (s.trip?.status) return { kind, why: "Finish your trip first." };
    if (kind === "raid") {
      const w = windowAt(t);
      if (!w.open) return { kind, why: "Raids are only allowed in the weekly window (Saturday 12:00 to Monday 00:00 UTC)." };
      if (locked(seat, t)) return { kind, why: "This hold changed hands this week. It's safe until next week's window." };
    }
    const pts = warPts(s, hold, c.id);
    if (pts < WARS.MIN_TO_RULE) return { kind, why: `Your side needs ${WARS.MIN_TO_RULE} war points in ${hold} this week (has ${pts}). Win fights and clear dungeons here.` };
    const last = st(s).acts.filter((a) => a.h === hold).slice(-1)[0];
    if (last && t - last.t < RETRY) return { kind, why: `Catch your breath: try again in ${Math.ceil((RETRY - (t - last.t)) / 60e3)} min.` };
    if (typeof G.curHealth === "function" && G.curHealth(s) < G.maxHealth(s) * 0.3) return { kind, why: "You're too badly hurt. Heal up first." };
    return { kind, why: null };
  }
  /* the champion of an unclaimed hold, or the ruling side's defenders (stronger with hired guards) */
  function foeFor(s, hold, kind, guards = 0) {
    const base0 = 16;
    const lv = Math.max(base0, typeof G.fightLevel === "function" ? G.fightLevel(s) : s.level || 1);   // never weaker than a level-14 foe: a real fight even for a fresh level-10 side
    const base = kind === "claim"
      ? { name: `Champion of ${hold}`, level: 14, health: 280, damage: 16, tags: ["humanoid", "elite"], danger: "high", gold: [60, 120] }
      : { name: guards ? `Hold defenders (${guards === 1 ? "with hired guards" : "with two guard hires"})` : "Hold defenders", level: 14, health: 260 + 45 * guards, damage: 15 + 2 * guards, tags: ["humanoid", "elite"], danger: "high", gold: [40, 90] };
    const e = G.scaleEnemy({ ...base, text: "" }, lv);
    const w = Math.min(0.2, pf(s, "holdfight"));   // Hold Warden
    if (w) { e.health = Math.round(e.health * (1 - w)); e.damage = Math.max(1, Math.round(e.damage * (1 - w))); }
    e.hold = hold;
    e.hitCap = 0.6;   // a critical power attack can't take more than 60% of your health in one blow (no one-shots; engine.js hitCap)
    return e;
  }
  /* one challenge or raid fight. Returns the fight result for the result screen, plus what changed. */
  function fight(s, hold, t = now(), ctx = {}) {
    const can = canFight(s, hold, t, ctx);
    if (!can.kind || can.why) return { text: can.why || "Nothing to fight for here." };
    const c = CLANS.of(s.id, s), before = seatOf(hold, t, s), fx = effects(before, t, s);
    const e = foeFor(s, hold, can.kind, fx.guards);
    const ts = G.now(), f = new G.Fight(s, e, null, ts);
    f.run({ t: ts });
    const skills = f.apply(ts);
    const h = st(s), act = { k: can.kind, h: hold, c: c.id, t, win: !!f.won };
    if (before) act.seat = seatKey(before);
    h.acts.push(act); if (h.acts.length > KEEP) h.acts.splice(0, h.acts.length - KEEP);
    setDocs(null, s); cache.seats = null;
    const after = seatOf(hold, t + 1, s);
    const out = { fight: f, skills, loot: [], gold: 0, kind: can.kind, hold, won: !!f.won };
    if (f.won) { out.gold = can.kind === "claim" ? CLAIM_GOLD : RAID_GOLD; s.gold += out.gold; out.loot = G.rollLoot ? G.rollLoot(s, e) : []; }
    out.took = !!after && after.cid === c.id && (!before || before.cid !== c.id);
    if (f.hp <= 0 && G.die) { const d = G.die(s, "hold", ts); out.died = d.msg; out.bag = d.bag; }
    out.title = out.took ? `${hold} is yours` : f.won ? "Victory" : "Beaten back";
    out.text = out.took ? (before ? `The last wall falls. ${c.name} [${c.tag}] takes ${hold} from ${before.clan.name}. Your side's members can now vote for a Jarl.` : `The champion yields. ${c.name} [${c.tag}] now rules ${hold}. Your side's members can now vote for a Jarl.`)
      : f.won ? `You break through the defenders. A wall of ${hold} falls (${after ? after.walls : 0} left). Win again with no walls left to take the hold.`
      : can.kind === "claim" ? (out.died ? `${e.name} cuts you down.` : `${e.name} holds you off.`) : out.died ? "The hold's defenders cut you down." : "The hold's defenders hold you off.";
    return out;
  }

  // ---------------------------------------------------------------- what members and the Jarl do
  function vote(s, hold, cand, t = now()) {
    const seat = seatOf(hold, t, s);
    if (!seat || !member(s.id, seat.cid, s)) return { err: "Only members of the ruling side vote for its Jarl." };
    if (!CLANS.members(seat.clan).some((m) => m.id === cand)) return { err: "They're not on that side." };
    const h = st(s), o = h.votes[hold], ts = termStart(t);
    h.votes[hold] = o && okNum(o.t) && o.t < ts ? { c: cand, t, p: o.c, pt: o.t } : { c: cand, t, ...(o && o.p ? { p: o.p, pt: o.pt } : {}) };   // keep the vote that stood at the start of this term
    setDocs(null, s);
    return { text: `Your vote is cast. It counts from the next term (${new Date(termEnds(t)).toUTCString().slice(0, 22)} UTC).` };
  }
  function setTax(s, hold, rate, t = now()) {
    if (!isJarl(s, hold, t)) return { err: "Only the Jarl sets the tax." };
    const r = clampTax(rate);
    st(s).jarl[hold] = { tax: r, t };
    setDocs(null, s);
    return { text: `The tax in ${hold} is now ${Math.round(r * 100)}% on shop sales.` };
  }
  function spend(s, hold, what, t = now()) {
    const seat = seatOf(hold, t, s), sp = SPEND[what];
    if (!sp) return { err: "Not something the treasury pays for." };
    if (!seat || !isJarl(s, hold, t)) return { err: "Only the Jarl spends the treasury." };
    const tr = treasury(seat, t, s), fx = effects(seat, t, s);
    if (tr.balance < sp.cost) return { err: `The treasury has ${tr.balance} gold. That costs ${sp.cost}.` };
    if (what === "guards" && fx.guards >= sp.max) return { err: "You already have as many guards as the hold can feed." };
    if (what === "repair" && seat.walls >= WALLS_MAX) return { err: "The walls are as strong as they get." };
    const h = st(s); h.spends.push({ h: hold, seat: seatKey(seat), what, t });
    if (h.spends.length > KEEP) h.spends.splice(0, h.spends.length - KEEP);
    setDocs(null, s); cache.seats = null;
    return { text: what === "guards" ? `Guards hired in ${hold} for a week.` : what === "market" ? `Shops in ${hold} sell 5% cheaper for 3 days.` : `The walls of ${hold} are repaired (+1).` };
  }

  // ---------------------------------------------------------------- the rulers map (wars.js) and shop prices (engine.js) see the seats
  if (typeof WARS !== "undefined") {
    const rulers0 = WARS.rulers;
    WARS.rulers = (me) => { const r = { ...rulers0(me) }; for (const [h, s] of Object.entries(seats(now(), me))) r[h] = s.clan; return r; };
    WARS.discount = (s, hold) => { const r = WARS.rulers(s)[hold], c = CLANS.of(s.id, s); return (r && c && r.id === c.id ? 0.9 : 1) * priceMult(s, hold); };
  }
  if (typeof G !== "undefined" && typeof G.buy === "function" && !G.buy._hold) {
    const buy0 = G.buy;
    G.buy = function (s, item, qty, t) {
      const g0 = s && s.gold, r = buy0.apply(this, arguments);
      try { const spent = g0 - s.gold, hold = s.location && WORLD.places[s.location] ? G.holdAt(WORLD.places[s.location]) : null; if (spent > 0 && hold && paid(s, hold, spent)) HOLDRULE.onPaid?.(s); } catch (e) { /* prices must never break buying */ }
      return r;
    };
    G.buy._hold = true;
  }

  return { DAY, WEEK, TERM, TAX_MAX, TAX_DEFAULT, TAX_STEP, WALLS, WALLS_MAX, SPEND, MIN_LEVEL, RETRY, CLAIM_GOLD, RAID_GOLD,
    weekOf, termStart, termEnds, windowAt, st, record, setDocs, seats, seatOf, seatKey, locked, jarlOf, nextCount, isJarl,
    clampTax, taxOf, treasury, effects, yourTax, priceMult, paid, canFight, foeFor, fight, vote, setTax, spend, holdHere, warPts, onPaid: null,
    setClock(f) { clock = f; cache.seats = null; }, now, get docs() { return docs; } };
})();
