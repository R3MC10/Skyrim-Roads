/* Regional crises: every hold has four numbers, Security, Food, Prosperity and Corruption (0-100). [OURS]
   - The numbers drift slowly with time (the same on every phone: worked out from the real clock) and with the weather
     (snow and blizzards in a hold cut its caravans: food and trade drop).
   - What players do moves them: escorting caravans and beating bandits raise Security, delivering food raises Food,
     bribes and theft raise Corruption. Each player writes only their own record ("crises" collection, id = player id),
     so the totals are sums and nobody overwrites anybody, like the great world events. Your part counts fully for the
     two days it was done in and half for the two days after; one player can move a number by at most 12 (18 with last
     cycle's half), everyone
     together by at most 30, so nothing runs away.
   - Every two days the holds under the most pressure (a number past its threshold, or a snowy spell) fall into a
     crisis: one of five chains, each with five stages that come every 5 hours (Snowstorm → Caravans cut → Shortage →
     Bandits → The Jarl's call). Each stage makes the numbers worse.
   - The Jarl posts contracts from stage 2 (escort the supply wagons, clear the bandits, deliver food, expose a crooked
     guard...). Contracts and fitting deeds in the hold add relief for everyone; enough relief and the ringleader shows
     himself: beat the crisis boss and the hold recovers (cheaper shops for a day). Nobody has to do anything: a crisis
     left alone burns out after 40 hours, with a poorer hold for a day.
   - The numbers change shop prices in the hold (engine.js buyPrice) and how often trouble finds you on its roads
     (engine.js encounter rate).
   Perks (perkfx.js): Hard Times Trader (Mercantile) and Jarl's Agent (Etiquette). Balance sim: tests/test_crises.js. */
const CRISES = (() => {
  const HOUR = 3600, DAY = 86400;
  const CYCLE = 2 * DAY, STAGE = 5 * HOUR, SPAN = 40 * HOUR, MAXOFF = 8 * HOUR, AFTER = DAY;
  const STAGES = 5, MAX_CRISES = 3, CONTRACT_CD = 90, BOSS_CD = 120, FOOD_N = 3, FOOD_MAX = 4, PASSIVE_MAX = 4;
  const PLAYER_CAP = 12, ALL_CAP = 30;   // how far one player / everyone together can move a number
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const hash = (str) => { let x = 2166136261; for (const c of String(str)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const pfx = (s, key) => (typeof PFX !== "undefined" && s ? PFX.num(s, key) : 0);
  /* player text goes through T (i18n.js + i18n_crises.js turn it Polish for Polish players; English in node tests) */
  const T = (en, v) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : v ? en.replace(/\{(\w+)(:lc)?\}/g, (m, k, lc) => (k in v ? (lc ? String(v[k]).toLowerCase() : String(v[k] ?? "")) : m)) : en);

  const HOLDS = ["Haafingar", "Hjaalmarch", "The Pale", "Winterhold", "Eastmarch", "Whiterun", "The Reach", "Falkreath", "The Rift"];
  const CAPITAL = { Haafingar: "Solitude", Hjaalmarch: "Morthal", "The Pale": "Dawnstar", Winterhold: "Winterhold", Eastmarch: "Windhelm", Whiterun: "Whiterun", "The Reach": "Markarth", Falkreath: "Falkreath", "The Rift": "Riften" };
  const VARS = ["sec", "food", "pro", "cor"];
  const VAR_NAME = { sec: "Security", food: "Food", pro: "Prosperity", cor: "Corruption" };
  /* where each hold sits when nothing is happening [OURS, after Skyrim: rich Solitude, poor Winterhold, crooked Riften] */
  const BASE = {
    Haafingar: { sec: 62, food: 58, pro: 68, cor: 44 }, Hjaalmarch: { sec: 46, food: 46, pro: 40, cor: 40 },
    "The Pale": { sec: 50, food: 47, pro: 44, cor: 38 }, Winterhold: { sec: 46, food: 42, pro: 34, cor: 36 },
    Eastmarch: { sec: 56, food: 52, pro: 56, cor: 48 }, Whiterun: { sec: 60, food: 64, pro: 62, cor: 40 },
    "The Reach": { sec: 44, food: 50, pro: 58, cor: 56 }, Falkreath: { sec: 50, food: 56, pro: 46, cor: 36 },
    "The Rift": { sec: 50, food: 58, pro: 56, cor: 62 },
  };
  const WILD = ["Falkreath", "The Reach", "Hjaalmarch", "The Pale", "Winterhold"];

  // ---------------------------------------------------------------- the five crisis chains
  /* stages: [name, what's happening, what it does to the numbers at full strength]. foe: who you fight in a contract. */
  const CHAINS = {
    snow: { name: "The Long Winter", color: "#9cc4e4", icon: "snow",
      stages: [
        ["Snowstorm", "Blizzards bury the passes around {hold}.", { food: -4, pro: -4 }],
        ["Caravans cut", "No wagon has got through for days. The shelves are emptying.", { food: -10, pro: -10 }],
        ["Shortage", "Bread and firewood are scarce and prices climb.", { food: -20, pro: -12 }],
        ["Bandits", "Hungry outlaws prey on anyone who travels the snowbound roads.", { food: -20, pro: -14, sec: -20 }],
        ["The Jarl's call", "The Jarl pays for escorts and puts a price on the bandit chief.", { food: -22, pro: -16, sec: -24 }],
      ],
      contracts: ["escort", "food", "clear"], foe: { name: "Snowbound bandits", tags: ["humanoid", "bandit"] },
      boss: { name: "Hrodvar Frost-Hand", what: "the bandit chief of the passes", tags: ["humanoid", "bandit", "elite", "boss"] },
      reward: ["mat_firewood", 4] },
    bandit: { name: "Outlaw Roads", color: "#d08a5a", icon: "swords",
      stages: [
        ["Robberies", "Travellers in {hold} are being robbed on the roads.", { sec: -6 }],
        ["Roads unsafe", "Farmers stay home. Nobody walks alone.", { sec: -14, pro: -4 }],
        ["Trade dries up", "Merchants won't risk the roads. Prices go up.", { sec: -18, pro: -12 }],
        ["Fort taken", "The outlaws have taken an old fort and raid from it.", { sec: -24, pro: -14, food: -6 }],
        ["The warlord", "A warlord leads them now. The Jarl wants his head.", { sec: -28, pro: -16, food: -8 }],
      ],
      contracts: ["escort", "clear", "patrol"], foe: { name: "Outlaw raiders", tags: ["humanoid", "bandit"] },
      boss: { name: "Ulfbjorn the Red", what: "the outlaw warlord", tags: ["humanoid", "bandit", "elite", "boss"] },
      reward: ["mat_steel", 3] },
    famine: { name: "The Blight", color: "#b7b064", icon: "wheat",
      stages: [
        ["Crop blight", "Black rot spreads through the fields of {hold}.", { food: -8 }],
        ["Granaries low", "The stores are half empty before winter.", { food: -16, pro: -4 }],
        ["Hunger", "Families go hungry. Food costs a fortune.", { food: -24, pro: -8 }],
        ["Food riots", "Crowds storm the market. The guards are stretched thin.", { food: -26, pro: -12, sec: -12, cor: 6 }],
        ["Rationing", "The Jarl rations bread and hunts for whoever cursed the fields.", { food: -28, pro: -14, sec: -14, cor: 8 }],
      ],
      contracts: ["food", "escort", "clear"], foe: { name: "Blighted spriggans", tags: ["beast", "nature"] },
      boss: { name: "Mother Crowe", what: "the hagraven who cursed the fields", tags: ["hagraven", "elite", "boss"] },
      reward: ["food_salt", 4] },
    corruption: { name: "Rot in the Court", color: "#a88ac8", icon: "coin",
      stages: [
        ["Bribes", "Gold changes hands in the halls of {hold}.", { cor: 8 }],
        ["Guards look away", "Crimes go unpunished if the purse is heavy enough.", { cor: 14, sec: -6 }],
        ["Thieves rule the streets", "Stalls are robbed in broad daylight.", { cor: 20, sec: -12, pro: -6 }],
        ["The steward's racket", "The steward skims the taxes. Prices rise.", { cor: 26, sec: -14, pro: -12 }],
        ["Showdown", "The Jarl finally asks for help to clean out the court.", { cor: 30, sec: -16, pro: -14 }],
      ],
      contracts: ["expose", "clear", "escort"], foe: { name: "Hired thugs", tags: ["humanoid", "bandit"] },
      boss: { name: "Captain Vigge the Crooked", what: "the bought captain of the guard", tags: ["humanoid", "elite", "boss"] },
      reward: ["gem_amethyst", 1] },
    beasts: { name: "Beasts at the Door", color: "#c9c0b0", icon: "paw",
      stages: [
        ["Tracks", "Huge tracks circle the farms of {hold}.", { food: -4, sec: -4 }],
        ["Livestock lost", "Goats and cows vanish at night.", { food: -10, sec: -8 }],
        ["Beasts in the fields", "Wolves and trolls roam in daylight. Nobody tends the crops.", { food: -16, sec: -14, pro: -6 }],
        ["Attacks on travellers", "The roads are deadly after dark.", { food: -18, sec: -22, pro: -10 }],
        ["The alpha", "The Jarl offers a bounty on the beast that leads them.", { food: -20, sec: -26, pro: -12 }],
      ],
      contracts: ["hunt", "escort", "food"], foe: { name: "Hungry wolves", tags: ["beast", "animal"] },
      boss: { name: "The White Matron", what: "a monstrous frost troll", tags: ["beast", "troll", "elite", "boss"] },
      reward: ["pelt_bear", 1] },
  };
  const CHAIN_IDS = Object.keys(CHAINS);

  /* contracts the Jarl posts. relief: how much it pushes the crisis back. deed: what it does to the hold's numbers. */
  const CONTRACTS = {
    escort: { name: "Escort the supply wagons", text: "Guard the Jarl's wagons to the next village and fight off whoever comes.", kind: "fight", relief: 3, deed: { sec: 2, pro: 1 } },
    clear: { name: "Clear out the {foe:lc}", text: "Find their camp and drive them off.", kind: "fight", relief: 3, deed: { sec: 2 } },
    patrol: { name: "Ride with the night patrol", text: "Walk the roads with the hold guard after dark.", kind: "fight", relief: 3, deed: { sec: 3 } },
    hunt: { name: "Hunt the pack", text: "Track the beasts back to their den.", kind: "fight", relief: 3, deed: { sec: 2, food: 1 } },
    food: { name: "Deliver food", text: "Bring the steward {n} pieces of food per delivery.", kind: "food", relief: 2, deed: { food: 3 } },
    expose: { name: "Expose a crooked guard", text: "Talk your way into the barracks and find the ledger.", kind: "talk", relief: 2, deed: { cor: -3 } },
  };
  /* contract foes and bosses at your own level (G.scaleEnemy grows them); balance sim in tests/test_crises.js */
  const FOE = { health: 90, damage: 10 };
  const BOSS = { health: 210, damage: 13 };
  const ALLY_ADD = 0.6;   // each party member beside you: the boss is 60% tougher
  const LOW_LV = 10, LOW_CUT = 0.91;   // below level 10 the ringleader has 9% less health and damage: the sim had heroes under 10 dying over half the time
  const lowCut = (lv) => (lv < LOW_LV ? LOW_CUT : 1);
  const NEED_SOLO = 10, NEED_PER = 6;
  const needFor = (people) => NEED_SOLO + NEED_PER * Math.max(0, Math.min(8, people) - 1);

  // ---------------------------------------------------------------- the clock: drift and weather
  const cycleAt = (t) => Math.floor(t / CYCLE);
  const smooth = (k) => k * k * (3 - 2 * k);
  function noise(key, t, len) {   // smooth value noise in -1..1, the same on every phone
    const x = t / len, i = Math.floor(x), f = smooth(x - i);
    const a = hash(key + ":" + i) * 2 - 1, b = hash(key + ":" + (i + 1)) * 2 - 1;
    return a + (b - a) * f;
  }
  function drift(hold, v, t) { return 12 * noise(`cr-${hold}-${v}`, t, 12 * HOUR) + 8 * noise(`cr2-${hold}-${v}`, t, 3 * DAY); }
  function wxAt(hold, t) { try { return typeof WEVENTS !== "undefined" ? WEVENTS.weatherAt(hold, t).id : "clear"; } catch (e) { return "clear"; } }
  const snowOf = (id) => (id === "blizzard" ? 1 : id === "snow" ? 0.5 : 0);
  /* how snowbound the hold has been over the last 3 hours (0..1) */
  function snowiness(hold, t) { let n = 0; for (let i = 0; i < 6; i++) n += snowOf(wxAt(hold, t - i * 1800)); return n / 6; }
  /* the numbers from the clock alone (no players, no crisis): what the thresholds look at */
  function baseline(hold, t) {
    const b = BASE[hold] || { sec: 50, food: 50, pro: 50, cor: 50 }, sn = snowiness(hold, t), out = {};
    for (const v of VARS) out[v] = b[v] + drift(hold, v, t);
    out.food -= 10 * sn; out.pro -= 6 * sn;
    for (const v of VARS) out[v] = clamp(out[v], 0, 100);
    return out;
  }

  // ---------------------------------------------------------------- the timetable of crises (thresholds → chains)
  const pickCache = {};
  /* how hard each chain presses on a hold at the start of a cycle (a number past its threshold, a snowy spell) */
  function pressure(hold, c) {
    const t = c * CYCLE, b = baseline(hold, t);
    let snow = 0; for (let i = 0; i < 24; i++) snow += snowOf(wxAt(hold, t + i * 1800)); snow /= 24;
    const n = (k) => hash(`crp-${c}-${hold}-${k}`) * 8;
    return {
      snow: snow >= 0.35 ? snow * 34 + n("snow") : 0,
      bandit: 48 - b.sec + n("bandit"),
      famine: 48 - b.food + n("famine"),
      corruption: b.cor - 52 + n("corruption"),
      beasts: (WILD.includes(hold) ? 6 : 0) + (48 - b.pro) * 0.6 + n("beasts"),
    };
  }
  /* the crises of cycle c: up to 3 holds, never the same hold two cycles running, at most 2 of one chain */
  function picks(c, skipPrev = true) {
    const key = c + ":" + skipPrev; if (pickCache[key]) return pickCache[key];
    const prev = skipPrev ? new Set(picks(c - 1, false).map((x) => x.hold)) : new Set();
    const cand = [];
    for (const hold of HOLDS) {
      if (prev.has(hold)) continue;
      const p = pressure(hold, c); let best = null;
      for (const k of CHAIN_IDS) if (!best || p[k] > best[1]) best = [k, p[k]];
      cand.push({ hold, chain: best[0], score: best[1] });
    }
    cand.sort((a, b) => b.score - a.score || (a.hold < b.hold ? -1 : 1));
    const out = [], per = {};
    for (const x of cand) {
      if (out.length >= MAX_CRISES) break;
      if (out.length && x.score < 12) break;   // the first always comes (there's always trouble somewhere); the rest need a threshold crossed
      if ((per[x.chain] || 0) >= 2) continue;
      per[x.chain] = (per[x.chain] || 0) + 1; out.push(x);
    }
    const list = out.map((x) => {
      const hi = HOLDS.indexOf(x.hold), start = c * CYCLE + Math.floor(hash(`crs-${c}-${x.hold}`) * MAXOFF);
      return { id: `cr-${c}-${hi}`, c, hold: x.hold, chain: x.chain, place: CAPITAL[x.hold], start, end: start + SPAN, score: Math.round(x.score) };
    });
    const keys = Object.keys(pickCache); if (keys.length > 40) for (const k of keys.slice(0, 20)) delete pickCache[k];
    return (pickCache[key] = list);
  }
  function byId(id) { const m = /^cr-(-?\d+)-(\d)$/.exec(String(id || "")); if (!m) return null; return picks(+m[1]).find((x) => x.id === id) || null; }
  /* crises that matter at time t: running ones and those whose aftermath still shows */
  function around(t) { const c = cycleAt(t); return [...picks(c - 1), ...picks(c)].filter((x) => x.start <= t && t < x.end + AFTER + DAY); }

  // ---------------------------------------------------------------- shared records
  let raw = [], docs = [], ver = 0;
  function setDocs(list) {
    if (list) raw = list;
    docs = raw.filter((d) => d && typeof d.uid === "string" && Number.isFinite(+d.cyc) && d.d && typeof d.d === "object");
    ver++;
  }
  function blank(c) { return { cyc: c, d: {}, pd: {}, rel: {}, pas: {}, won: {}, got: {}, cd: {}, food: {}, seen: {} }; }
  /* your own state; a new two-day cycle moves this cycle's deeds to "last cycle" and forgets old crises */
  function mine(s, t = nowS()) {
    const c = cycleAt(t);
    let m = s.crises;
    if (!m || typeof m !== "object" || !m.d) m = s.crises = blank(c);
    for (const k of ["pd", "rel", "pas", "won", "got", "cd", "food", "seen"]) if (!m[k] || typeof m[k] !== "object") m[k] = {};
    if (m.cyc !== c) {
      m.pd = m.cyc === c - 1 ? m.d : {}; m.d = {}; m.cyc = c;
      const old = (id) => { const x = /^cr-(-?\d+)-/.exec(id); return !x || +x[1] < c - 2; };
      for (const k of ["rel", "pas", "won", "got", "cd", "food", "seen"]) for (const id of Object.keys(m[k])) if (old(id)) delete m[k][id];
    }
    return m;
  }
  function record(s, t = nowS()) {
    const m = mine(s, t);
    return { uid: s.id, name: s.name, lv: s.level || 1, cyc: m.cyc, d: m.d, pd: m.pd, rel: m.rel, won: m.won, t };
  }
  /* everyone's records that still count, yours last (your own copy is always the newest) */
  function rows(s, t = nowS()) {
    const c = cycleAt(t), out = docs.filter((d) => (!s || d.uid !== s.id) && +d.cyc >= c - 1 && !(+d.t < t - 5 * DAY));
    if (s) out.push({ ...record(s, t), me: true });
    return out;
  }
  /* what players have done to a hold's numbers: this cycle in full, last cycle at half; capped per player and in all */
  function deeds(hold, s, t = nowS()) {
    const c = cycleAt(t), sum = { sec: 0, food: 0, pro: 0, cor: 0 };
    for (const r of rows(s, t)) {
      const cur = +r.cyc === c ? r.d : null, prev = +r.cyc === c ? r.pd : +r.cyc === c - 1 ? r.d : null;
      for (const v of VARS) {
        const a = +(cur?.[hold]?.[v]) || 0, b = +(prev?.[hold]?.[v]) || 0;
        sum[v] += clamp(a, -PLAYER_CAP, PLAYER_CAP) + 0.5 * clamp(b, -PLAYER_CAP, PLAYER_CAP);
      }
    }
    for (const v of VARS) sum[v] = clamp(sum[v], -ALL_CAP, ALL_CAP);
    return sum;
  }
  /* a crisis's shared tally: relief from everyone, what's needed (grows with the people helping), who beat the boss */
  function tally(cr, s, t = nowS()) {
    let total = 0, wonAt = null, winner = null; const people = new Set(), names = [];
    for (const r of rows(s, t)) {
      const p = Math.max(0, +(r.rel?.[cr.id]) || 0);
      if (p > 0) { total += p; people.add(r.uid); if (!r.me) names.push(r.name); }
      const w = +(r.won?.[cr.id]); if (w && w >= cr.start && (wonAt == null || w < wonAt)) { wonAt = w; winner = r.name; }
    }
    const need = needFor(Math.max(1, people.size));
    return { total: Math.round(total * 10) / 10, need, frac: clamp(total / need, 0, 1), people: people.size, names, wonAt, winner, ready: total >= need };
  }
  /* where a crisis stands: "active" (stage 1..5), "boss" (the ringleader is out), "won" or "lost", with how strong it hits */
  function status(cr, s, t = nowS()) {
    if (!cr || t < cr.start) return { state: "later", stage: 0, sev: 0 };
    const tl = tally(cr, s, t), stage = Math.min(STAGES, 1 + Math.floor((t - cr.start) / STAGE));
    if (tl.wonAt != null && tl.wonAt <= t) { const age = t - tl.wonAt; return { state: "won", stage, tl, at: tl.wonAt, left: age < AFTER ? 1 - age / AFTER : 0, sev: 0 }; }
    if (t >= cr.end) { const age = t - cr.end; return { state: "lost", stage: STAGES, tl, at: cr.end, left: age < AFTER ? 1 - age / AFTER : 0, sev: 0 }; }
    const sev = 1 - 0.6 * tl.frac;   // relief takes the edge off before the boss falls
    return { state: tl.ready && stage >= 2 ? "boss" : "active", stage, tl, sev, open: stage >= 2 };
  }
  function crisisIn(hold, t = nowS()) { return around(t).filter((x) => x.hold === hold).sort((a, b) => b.start - a.start)[0] || null; }

  /* a hold's numbers right now: clock + weather + crisis + aftermath + players */
  let vcache = new Map(), localVer = 0;
  function values(hold, s, t = nowS()) {
    const key = `${hold}|${Math.floor(t / 15)}|${ver}|${localVer}|${s ? s.id : ""}`, hit = vcache.get(key);
    if (hit) return { ...hit };
    if (vcache.size > 200) vcache = new Map();
    const v = valuesRaw(hold, s, t); vcache.set(key, v); return { ...v };
  }
  function valuesRaw(hold, s, t) {
    const out = baseline(hold, t), dd = deeds(hold, s, t);
    for (const cr of around(t)) {
      if (cr.hold !== hold) continue;
      const st = status(cr, s, t), ch = CHAINS[cr.chain];
      if (st.state === "active" || st.state === "boss") { const fx = ch.stages[st.stage - 1][2]; for (const [k, v] of Object.entries(fx)) out[k] += v * st.sev; }
      else if (st.state === "won" && st.left > 0) { out.pro += 12 * st.left; out.sec += 8 * st.left; out.cor -= 6 * st.left; }
      else if (st.state === "lost" && st.left > 0) { const fx = ch.stages[STAGES - 1][2]; for (const [k, v] of Object.entries(fx)) out[k] += 0.5 * v * st.left; out.pro -= 8 * st.left; }
    }
    for (const v of VARS) out[v] = Math.round(clamp(out[v] + dd[v], 0, 100));
    return out;
  }
  /* named levels for the numbers (Corruption reads the other way round) */
  function level(v, x) {
    const good = v === "cor" ? 100 - x : x;
    return good >= 65 ? "Thriving" : good >= 45 ? "Steady" : good >= 28 ? "Strained" : "Dire";
  }

  // ---------------------------------------------------------------- what the numbers do
  /* shop prices in a town of the hold (engine.js buyPrice); food costs more again when food is short */
  function priceMult(s, town, item, t = nowS()) {
    if (!town || typeof WORLD === "undefined" || !WORLD.places[town]) return 1;
    let hold; try { hold = G.holdAt(WORLD.places[town]); } catch (e) { return 1; }
    if (!BASE[hold]) return 1;
    try {
      const v = values(hold, s, t), food = typeof D !== "undefined" && item && D.ITEMS[item]?.slot === "food";
      let m = 1 + 0.004 * Math.max(0, 45 - v.food) + 0.003 * Math.max(0, 45 - v.pro) + 0.002 * Math.max(0, v.cor - 55) - 0.002 * Math.max(0, v.pro - 65);
      if (food) m += 0.006 * Math.max(0, 45 - v.food);
      for (const cr of around(t)) if (cr.hold === hold) { const st = status(cr, s, t); if (st.state === "won" && st.left > 0) m -= 0.05 * st.left; }
      m = clamp(m, 0.88, 1.35);
      if (m > 1) m = 1 + (m - 1) * (1 - Math.min(0.6, pfx(s, "crisisprice")));   // Hard Times Trader
      return m;
    } catch (e) { return 1; }
  }
  /* how often trouble finds you on the hold's roads (engine.js encounter rate) */
  function encounterMult(s, pos, t = nowS()) {
    let hold; try { hold = G.holdAt(pos); } catch (e) { return 1; }
    if (!BASE[hold]) return 1;
    try { const v = values(hold, s, t); return clamp(1 + 0.012 * Math.max(0, 45 - v.sec) - 0.008 * Math.max(0, v.sec - 60), 0.75, 1.5); } catch (e) { return 1; }
  }

  // ---------------------------------------------------------------- player deeds
  const DEEDS = {
    bandit: { fx: { sec: 1 }, chains: ["snow", "bandit", "corruption"], relief: 1 },
    beast: { fx: { sec: 1, food: 0.5 }, chains: ["beasts", "famine"], relief: 1 },
    escort: { fx: { sec: 3, pro: 1 }, chains: ["snow", "bandit", "famine"], relief: 2 },
    bribe: { fx: { cor: 2 }, chains: [], relief: 0 },
    theft: { fx: { cor: 1.5 }, chains: [], relief: 0 },
    fence: { fx: { cor: 0.5 }, chains: [], relief: 0 },
  };
  function addFx(m, hold, fx) {
    const h = (m.d[hold] = m.d[hold] || {});
    for (const [k, v] of Object.entries(fx)) h[k] = Math.round(clamp((+h[k] || 0) + v, -PLAYER_CAP * 2, PLAYER_CAP * 2) * 10) / 10;
  }
  /* something you did in a hold; returns true if anything changed. Matching deeds during a crisis add a little relief. */
  function deed(s, hold, kind, t = nowS()) {
    const d = DEEDS[kind]; if (!d || !s || !BASE[hold]) return false;
    const m = mine(s, t); addFx(m, hold, d.fx);
    const cr = crisisIn(hold, t), st = cr ? status(cr, s, t) : null;
    if (cr && d.relief && d.chains.includes(cr.chain) && st.open && (st.state === "active" || st.state === "boss")) {
      const used = m.pas[cr.id] || 0;
      if (used < PASSIVE_MAX) { const add = Math.min(d.relief, PASSIVE_MAX - used); m.pas[cr.id] = used + add; m.rel[cr.id] = (m.rel[cr.id] || 0) + add; }
    }
    dirty();
    return true;
  }
  const BANDIT_RE = /bandit|outlaw|highway|forsworn|raider|brigand|thug|marauder|reaver|smuggler|poacher/i;
  const BEAST_RE = /wolf|wolves|bear|troll|sabre|skeever|spriggan|spider|chaurus|mudcrab|horker|slaughterfish/i;
  /* ui.js: a fight you won on the road or in a dungeon */
  function onFight(s, e, hold, t = nowS()) {
    if (!e || e.crisis || !hold) return false;
    const tags = e.tags || [], nm = e.name || "";
    if (tags.includes("bandit") || BANDIT_RE.test(nm)) return deed(s, hold, "bandit", t);
    if (tags.includes("beast") || tags.includes("animal") || BEAST_RE.test(nm)) return deed(s, hold, "beast", t);
    return false;
  }

  // ---------------------------------------------------------------- contracts and the boss
  const leaderOnly = (party, s) => !!(party && party.leader && party.leader !== s.id && Array.isArray(party.members) && party.members.length > 1);
  const here = (s, cr) => s.location === cr.place && !s.trip?.status;
  function hurt(s, t) { try { return G.curHealth(s, t) < G.maxHealth(s) * 0.25; } catch (e) { return false; } }
  function contractsOf(cr) { return CHAINS[cr.chain].contracts; }
  function contractName(cr, id) { return T(CONTRACTS[id].name, { foe: T(CHAINS[cr.chain].foe.name) }); }
  function foodRows(s) { return (s.inv || []).filter((r) => typeof D !== "undefined" && D.ITEMS[r.item]?.slot === "food" && !r.stolen && r.qty > 0); }
  const foodCount = (s) => foodRows(s).reduce((a, r) => a + r.qty, 0);
  function makeFoe(s, cr, boss) {
    const ch = CHAINS[cr.chain], lv = G.fightLevel(s), B = boss ? BOSS : FOE, k = boss ? lowCut(lv) : 1;
    const e = G.scaleEnemy({ name: boss ? ch.boss.name : T(ch.foe.name), level: lv, health: Math.round(B.health * k), damage: Math.round(B.damage * k * 10) / 10, tags: [...(boss ? ch.boss.tags : ch.foe.tags)], danger: boss ? "high" : "medium", gold: boss ? [40, 90] : [8, 24], text: "" }, lv);
    e.hold = cr.hold; e.crisis = cr.id;
    if (boss) e.noGroup = true;
    return e;
  }
  /* can you take this contract now? returns an error text or "" */
  function contractBlock(s, cr, id, t, party) {
    const st = status(cr, s, t);
    if (st.state === "won") return T("This crisis is over. The hold is recovering.");
    if (st.state === "lost" || st.state === "later") return T("There's no work posted for this right now.");
    if (!st.open) return T("The Jarl hasn't asked for help yet. Contracts open at stage 2.");
    if (!here(s, cr)) return T("The steward hands out contracts in {place}. Go there first.", { place: cr.place });
    if (!contractsOf(cr).includes(id)) return T("No such contract.");
    const m = mine(s, t), c = CONTRACTS[id];
    if (c.kind === "food") {
      if ((m.food[cr.id] || 0) >= FOOD_MAX) return T("The steward has all the food you can give for now. Thank you!");
      if (foodCount(s) < FOOD_N) return T("You need {n} pieces of food (raw or cooked). You have {have}.", { n: FOOD_N, have: foodCount(s) });
      return "";
    }
    const last = m.cd[cr.id + ":" + id] || 0;
    if (t - last < CONTRACT_CD) return T("Rest a moment: the next one is ready in {n} s.", { n: Math.ceil(CONTRACT_CD - (t - last)) });
    if (c.kind === "fight" && leaderOnly(party, s)) return T("In a party only your leader takes fight contracts. Stay close and you fight beside them.");
    if (c.kind === "fight" && hurt(s, t)) return T("You're too badly hurt for this. Heal up first.");
    return "";
  }
  const relief = (s, base) => Math.round(base * (1 + Math.min(0.5, pfx(s, "crisisrelief"))) * 10) / 10;   // Jarl's Agent
  /* do a contract. Returns {text, fight?, relief, died?, bag?} */
  function contract(s, crId, id, t = nowS(), opts = {}) {
    const cr = byId(crId); if (!cr) return { text: T("That crisis is over.") };
    const err = contractBlock(s, cr, id, t, opts.party); if (err) return { text: err };
    const m = mine(s, t), c = CONTRACTS[id], ch = CHAINS[cr.chain], name = contractName(cr, id);
    if (c.kind === "food") {
      let left = FOOD_N;
      for (const r of foodRows(s).sort((a, b) => (D.ITEMS[a.item].value || 0) - (D.ITEMS[b.item].value || 0))) { const k = Math.min(left, r.qty); G.take(s, r.id, k); left -= k; if (!left) break; }
      m.food[cr.id] = (m.food[cr.id] || 0) + 1;
      const rl = relief(s, c.relief); m.rel[cr.id] = (m.rel[cr.id] || 0) + rl; addFx(m, cr.hold, c.deed);
      const g = Math.round(6 + 1.5 * (s.level || 1)); s.gold += g;
      const skills = G.useSkill(s, "Etiquette", 20);
      dirty();
      return { text: T("The steward's clerk counts the food into the stores and pays you {g} gold for the trouble. (+{r} relief)", { g, r: rl }), relief: rl, gold: g, skills, title: name, done: true };
    }
    m.cd[cr.id + ":" + id] = t;
    if (c.kind === "talk") {
      const ch2 = clamp(0.35 + G.skill(s, "Speechcraft") / 160 + G.skill(s, "Sneak") / 400 + Math.min(0.2, pfx(s, "crisisrelief") / 2), 0.1, 0.92);
      const win = Math.random() < ch2, rl = relief(s, win ? c.relief : 1);
      m.rel[cr.id] = (m.rel[cr.id] || 0) + rl; addFx(m, cr.hold, win ? c.deed : { cor: -1 });
      const skills = G.useSkill(s, "Speechcraft", win ? 40 + G.skill(s, "Speechcraft") : 12);
      dirty();
      return { text: win ? T("You find the ledger under a loose floorboard. Two guards are thrown in their own cells. (+{r} relief)", { r: rl }) : T("The guards close ranks and you leave with only rumours, but people noticed someone is asking. (+{r} relief)", { r: rl }), relief: rl, skills, title: name, done: true };
    }
    // a fight contract
    const e = makeFoe(s, cr, false);
    const f = new G.Fight(s, e, null, t);
    f.canFlee = true;   // a "Run away" tactic breaks off the fight, as on the road
    f.run({ t, trySneak: false });
    const skills = f.apply(t);
    const out = { cr, fight: f, skills, relief: 0, gold: 0, loot: [], title: name };
    if (f.fled && !f.won && f.hp > 0) { out.fled = true; out.text = T("You break off the fight and get away. Try again when you're ready."); dirty(); return out; }
    if (f.won && f.hp > 0) {
      const rl = relief(s, c.relief); m.rel[cr.id] = (m.rel[cr.id] || 0) + rl; addFx(m, cr.hold, c.deed);
      out.gold = Math.round(10 + 2 * (s.level || 1)); s.gold += out.gold; out.relief = rl;
      out.text = T("{what}: done. The steward pays {g} gold. (+{r} relief)", { what: name, g: out.gold, r: rl });
    } else if (f.hp <= 0) {
      const d = G.die(s, ch.foe.name, t); out.died = d.msg; out.bag = d.bag;
      out.text = T("You're beaten. Someone else will have to finish the job.");
    } else out.text = T("They got away this time. Try again in a moment.");
    dirty();
    return out;
  }
  function bossBlock(s, cr, t, party) {
    const st = status(cr, s, t);
    if (st.state === "won") return T("{boss} is already beaten.", { boss: CHAINS[cr.chain].boss.name });
    if (st.state !== "boss") return T("The ringleader is still in hiding. Do contracts to draw them out.");
    if (!here(s, cr)) return T("The fight is at {place}. Get there first.", { place: cr.place });
    if (leaderOnly(party, s)) return T("In a party only your leader starts the boss fight. Stay close and you fight beside them.");
    const last = mine(s, t).cd[cr.id + ":boss"] || 0;
    if (t - last < BOSS_CD) return T("Catch your breath: you can try again in {n} s.", { n: Math.ceil(BOSS_CD - (t - last)) });
    if (hurt(s, t)) return T("You're too badly hurt to face them. Heal up first.");
    return "";
  }
  /* the crisis boss. Returns {text, fight?, slain, died?, bag?} */
  function boss(s, crId, t = nowS(), opts = {}) {
    const cr = byId(crId); if (!cr) return { text: T("That crisis is over.") };
    const err = bossBlock(s, cr, t, opts.party); if (err) return { text: err };
    const m = mine(s, t), ch = CHAINS[cr.chain];
    m.cd[cr.id + ":boss"] = t;
    const e = makeFoe(s, cr, true);
    const f = new G.Fight(s, e, null, t);
    const mates = [...new Set((f.allies || []).filter((a) => a && a.party && typeof a.uid === "string").map((a) => a.uid))].slice(0, 7);
    const grow = 1 + ALLY_ADD * mates.length;
    if (grow > 1) { f.ehp = f.ehp0 = Math.round(f.ehp * grow); e.health = e.hp = f.ehp; }
    f.canFlee = true;   // the ringleader isn't a dungeon boss: a "Run away" tactic can still save you
    f.run({ t, trySneak: false });
    const skills = f.apply(t);
    const out = { cr, fight: f, skills, slain: false, gold: 0, loot: [], mates: mates.length };
    if (f.fled && !f.won && f.hp > 0) out.text = T("You break off the fight and get away from {boss}. Heal up and try again.", { boss: ch.boss.name }), out.fled = true;
    else if (f.won && f.hp > 0) {
      out.slain = true; m.won[cr.id] = t; m.rel[cr.id] = Math.max(m.rel[cr.id] || 0, 1);
      out.text = T("{boss} falls! The crisis in {hold} is over and the Jarl's people cheer.", { boss: ch.boss.name, hold: cr.hold });
      out.title = T("Victory");
    } else if (f.hp <= 0) {
      const d = G.die(s, ch.boss.name, t); out.died = d.msg; out.bag = d.bag;
      out.text = T("{boss} is too strong this time. Heal up and try again.", { boss: ch.boss.name });
    } else out.text = T("{boss} slips away into the crowd. Try again in a moment.", { boss: ch.boss.name });
    dirty();
    return out;
  }
  /* rewards: everyone who added relief to a won crisis, once; the one who beat the boss gets a title too */
  function claimable(s, cr, t = nowS()) {
    if (!cr) return false;
    const m = mine(s, t), st = status(cr, s, t);
    return st.state === "won" && (m.rel[cr.id] || 0) > 0 && !m.got[cr.id] && t < st.at + 2 * DAY;
  }
  function claim(s, crId, t = nowS()) {
    const cr = byId(crId); if (!claimable(s, cr, t)) return null;
    const m = mine(s, t), tl = tally(cr, s, t), ch = CHAINS[cr.chain];
    const fair = tl.need / Math.max(1, tl.people), share = clamp((m.rel[cr.id] || 0) / fair, 0, 1.5);
    const gold = Math.round((50 + 6 * (s.level || 1)) * (0.6 + 0.4 * share) * (1 + Math.min(0.5, pfx(s, "crisisrelief"))));
    m.got[cr.id] = t; s.gold += gold;
    const got = [T("{n} gold", { n: gold })];
    const [it, q] = ch.reward;
    if (typeof D !== "undefined" && D.ITEMS[it]) { G.give(s, it, q); got.push(`${q > 1 ? q + "× " : ""}${D.ITEMS[it].name}`); }
    if (m.won[cr.id]) {
      s.titles = s.titles || []; if (!s.titles.includes("Shield of the Hold")) { s.titles.push("Shield of the Hold"); got.push(T("the title Shield of the Hold")); }
      if (typeof D !== "undefined" && D.ITEMS.gem_sapphire) { G.give(s, "gem_sapphire", 1); got.push(D.ITEMS.gem_sapphire.name); }
    }
    s.crisisWins = (s.crisisWins || 0) + 1;
    dirty();
    return T("The Jarl of {hold} thanks you: {list}.", { hold: cr.hold, list: got.join(", ") });
  }

  // ---------------------------------------------------------------- hooks into crime, bribes and fences
  function hookWorld() {
    if (typeof TOWNS !== "undefined" && TOWNS.addBounty && !TOWNS.addBounty._cr) {
      const base = TOWNS.addBounty;
      TOWNS.addBounty = function (s, hold, crime, extra) { const r = base.apply(this, arguments); try { if (["pickpocket", "theft"].includes(crime)) deed(s, hold, "theft"); } catch (e) { /* never block a crime */ } return r; };
      TOWNS.addBounty._cr = true;
    }
    if (typeof TOWNS !== "undefined" && TOWNS.guardChoice && !TOWNS.guardChoice._cr) {
      const base = TOWNS.guardChoice;
      TOWNS.guardChoice = function (s, choice) { const g0 = s.gold, hold = s.location && WORLD.places[s.location] ? G.holdAt(WORLD.places[s.location]) : null; const r = base.apply(this, arguments); try { if (choice === "bribe" && s.gold < g0 && hold) deed(s, hold, "bribe"); } catch (e) { /* ignore */ } return r; };
      TOWNS.guardChoice._cr = true;
    }
    if (typeof ROAD_EVENTS !== "undefined" && !ROAD_EVENTS.__cr) {
      const base = ROAD_EVENTS.choose;
      ROAD_EVENTS.choose = (s, e, c) => { const g0 = s.gold; const r = base(s, e, c); try { if (/bribe|pay|toll/i.test(c || "") && s.gold < g0 && !(r && r.keep)) deed(s, G.holdAt([s.x, s.y]), "bribe"); } catch (er) { /* ignore */ } return r; };
      ROAD_EVENTS.__cr = true;
    }
    if (typeof G !== "undefined" && G.sell && !G.sell._cr) {
      const base = G.sell;
      G.sell = function (s, id) { const row = G.invRow(s, id), stolen = !!row?.stolen; const g0 = s.gold; const r = base.apply(this, arguments); try { if (stolen && s.gold > g0 && s.location && WORLD.places[s.location]) deed(s, G.holdAt(WORLD.places[s.location]), "fence"); } catch (e) { /* ignore */ } return r; };
      G.sell._cr = true;
    }
  }
  hookWorld();

  // ================================================================ screens (browser only)
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let api = null, loopT = null, pubT = null, isDirty = false;
  function dirty() { isDirty = true; localVer++; }
  const me = () => (api ? api.S() : null);
  const partyOf = () => (api && api.party ? api.party() : null);
  const fightCall = (fn, done) => (typeof NOAUTO !== "undefined" ? NOAUTO.call(fn, done) : done(fn()));
  const until = (sec) => { sec = Math.max(0, sec); const h = Math.floor(sec / HOUR); return h >= 24 ? T("{d}d {h}h", { d: Math.floor(h / 24), h: h % 24 }) : h ? T("{h}h {m}m", { h, m: Math.floor((sec % HOUR) / 60) }) : T("{n} min", { n: Math.max(1, Math.ceil(sec / 60)) }); };

  // ---- small ink glyphs for the chains (no emoji)
  const SV = (d) => `<svg class="cr-ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const GLYPH = {
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5"/>',
    swords: '<path d="M4 4l11 11M4 4v3.5M4 4h3.5M13 17l4-4M15.5 18.5l3-3"/><path d="M20 4 9 15M20 4v3.5M20 4h-3.5M11 17l-4-4M8.5 18.5l-3-3"/>',
    wheat: '<path d="M12 22V8"/><path d="M12 8c-3-1-3-4-3-6 2 0 4 2 3 6zM12 8c3-1 3-4 3-6-2 0-4 2-3 6zM12 13c-3-1-4-3-4-5 2 0 4 2 4 5zM12 13c3-1 4-3 4-5-2 0-4 2-4 5zM12 18c-3-1-4-3-4-5 2 0 4 2 4 5zM12 18c3-1 4-3 4-5-2 0-4 2-4 5z"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.6 0-2.7.9-2.7 2s1 1.7 2.7 2 2.7.9 2.7 2-1.1 2-2.7 2c-1 0-2-.4-2.6-1.2M12 6.5V8M12 16v1.5"/>',
    paw: '<ellipse cx="12" cy="16" rx="4" ry="3.4"/><circle cx="6.5" cy="10.5" r="1.8"/><circle cx="17.5" cy="10.5" r="1.8"/><circle cx="9.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/>',
  };
  const glyph = (chain) => SV(GLYPH[CHAINS[chain]?.icon] || GLYPH.swords);
  const VAR_COL = { sec: "#8fb3d9", food: "#b9c46a", pro: "#e0b860", cor: "#b58ad0" };

  function meter(v, x, prev) {
    const bad = v === "cor" ? x >= 62 : x < 35, arrow = prev == null || Math.abs(prev - x) < 3 ? "" : (x > prev ? "▲" : "▼");
    return `<div class="cr-meter${bad ? " cr-bad" : ""}"><span class="cr-ml">${esc(T(VAR_NAME[v]))}</span><span class="cr-bar"><i style="width:${x}%;background:${VAR_COL[v]}"></i></span><b class="cr-mv">${x}<small>${arrow}</small></b><span class="cr-lv">${esc(T(level(v, x)))}</span></div>`;
  }
  function effectsLine(s, hold, t) {
    const cap = CAPITAL[hold], pm = priceMult(s, cap, null, t), em = encounterMult(s, WORLD.places[cap] || [0, 0], t);
    const p = Math.round((pm - 1) * 100), e = Math.round((em - 1) * 100);
    const a = p > 0 ? T("Shops {n}% dearer", { n: p }) : p < 0 ? T("Shops {n}% cheaper", { n: -p }) : T("Shops at normal prices");
    const b = e > 0 ? T("road trouble +{n}%", { n: e }) : e < 0 ? T("roads {n}% safer", { n: -e }) : T("roads as usual");
    return `${a} · ${b}`;
  }
  function stageTrack(cr, st) {
    const ch = CHAINS[cr.chain];
    return `<ol class="cr-stages">${ch.stages.map((x, i) => { const n = i + 1, cls = st.state === "won" ? "done" : n < st.stage ? "past" : n === st.stage ? "now" : ""; return `<li class="${cls}"><i>${n}</i><span>${esc(T(x[0]))}</span></li>`; }).join("")}</ol>`;
  }
  function stateLine(cr, st, t) {
    const ch = CHAINS[cr.chain];
    if (st.state === "won") return T("Beaten by {who}. The hold is recovering.", { who: st.tl.winner || "?" });
    if (st.state === "lost") return T("Nobody stopped it. The hold is licking its wounds.");
    if (st.state === "boss") return T("{boss}, {what}: the hideout is found. The fight is in {place}!", { boss: ch.boss.name, what: T(ch.boss.what), place: cr.place });
    const next = st.stage < STAGES ? T("next stage in {time}", { time: until(cr.start + st.stage * STAGE - t) }) : T("burns out in {time}", { time: until(cr.end - t) });
    return `${T(ch.stages[st.stage - 1][1], { hold: cr.hold })} · ${next}`;
  }
  /* the Hold status card */
  function sheetHTML(S, hold, t = nowS()) {
    const v = values(hold, S, t), v0 = values(hold, S, t - 6 * HOUR), cr = crisisIn(hold, t);
    let body = "";
    if (cr) {
      const st = status(cr, S, t), ch = CHAINS[cr.chain], tl = st.tl, here_ = here(S, cr), lead = leaderOnly(partyOf(), S);
      body += `<div class="cr-crisis" style="--cr:${ch.color}"><div class="cr-ch">${glyph(cr.chain)}<div><span class="cr-k">${esc(T(st.state === "won" ? "Crisis over" : st.state === "lost" ? "Crisis burned out" : "Crisis"))}</span><b>${esc(T(ch.name))}</b></div><span class="cr-stn">${st.state === "won" ? esc(T("Won")) : esc(T("Stage {n} of {m}", { n: st.stage, m: STAGES }))}</span></div>
        ${stageTrack(cr, st)}<p class="sub cr-now">${esc(stateLine(cr, st, t))}</p>`;
      if (st.state === "active" || st.state === "boss") {
        body += `<div class="cr-relief"><span>${esc(T("Relief"))}</span><span class="cr-bar"><i style="width:${Math.round(tl.frac * 100)}%"></i></span><b>${Math.min(tl.total, tl.need)}/${tl.need}</b></div>
          <p class="sub">${esc(T(tl.people === 1 ? "{n} helper" : "{n} helpers", { n: tl.people }))}${tl.names.length ? " · " + esc(tl.names.slice(0, 6).join(", ")) : ""}</p>`;
        if (!st.open) body += `<p class="sub">${esc(T("The Jarl hasn't asked for help yet. Contracts open at stage 2 (in {time}).", { time: until(cr.start + STAGE - t) }))}</p>`;
        else if (st.state === "boss") {
          const err = bossBlock(S, cr, t, partyOf());
          const lv = S.level || 1, warn = lv < 15 ? `<span class="cr-warn">${esc(T(lv < LOW_LV ? "Deadly at your level: heroes under level 10 often lose this fight. Bring friends and potions, or add a Run away rule to your tactics." : "A hard fight at your level. Bring potions, or add a Run away rule to your tactics."))}</span>` : "";
          body += `<div class="cr-boss"><b>${esc(ch.boss.name)}</b><span class="sub">${esc(T(ch.boss.what))}</span>${warn}${err && !here_ ? `<button class="btn wev-wide" data-act="go" data-place="${esc(cr.place)}">${esc(T("Travel to {place}", { place: cr.place }))}</button>` : `<button class="btn danger wev-wide" data-cr="boss" data-id="${cr.id}" ${err ? "disabled" : ""}>${esc(err && here_ ? err : T("Fight the ringleader"))}</button>`}</div>`;
        }
        if (st.open && st.state === "active") {
          body += `<h3 class="cr-h3">${esc(T("The Jarl's contracts"))}</h3><div class="list cr-list">${contractsOf(cr).map((id) => {
            const c = CONTRACTS[id], err = contractBlock(S, cr, id, t, partyOf());
            const txt = T(c.text, { n: FOOD_N }) + (c.kind === "food" ? " " + T("(deliveries: {n} of {m})", { n: mine(S, t).food[cr.id] || 0, m: FOOD_MAX }) : "");
            return `<div class="item"><div class="t">${esc(contractName(cr, id))}<span>${esc(txt)} · ${esc(T("+{n} relief", { n: relief(S, c.relief) }))}</span></div><button class="btn sm ${err ? "" : "pri"}" data-cr="do" data-id="${cr.id}" data-c="${id}" ${err ? `disabled title="${esc(err)}"` : ""}>${esc(T(c.kind === "food" ? "Give" : c.kind === "talk" ? "Try" : "Take it"))}</button></div>`;
          }).join("")}</div>`;
          if (!here_) body += `<p class="sub">${esc(T("Contracts are handed out in {place}.", { place: cr.place }))}</p><button class="btn wev-wide" data-act="go" data-place="${esc(cr.place)}">${esc(T("Travel to {place}", { place: cr.place }))}</button>`;
          else if (lead) body += `<p class="sub">${esc(T("In a party your leader takes the fight contracts; you fight beside them."))}</p>`;
        }
      }
      if (claimable(S, cr, t)) body += `<button class="btn pri wev-wide" data-cr="claim" data-id="${cr.id}">${esc(T("Claim your reward"))}</button>`;
      body += `</div>`;
    } else body += `<p class="sub cr-calm">${esc(T("No crisis in {hold} right now.", { hold }))}</p>`;
    const others = HOLDS.map((h) => { const c2 = crisisIn(h, t), s2 = c2 ? status(c2, S, t) : null, on = s2 && (s2.state === "active" || s2.state === "boss");
      return `<button class="cr-hold${h === hold ? " on" : ""}${on ? " hot" : ""}" data-cr="hold" data-hold="${esc(h)}">${on ? glyph(c2.chain) : ""}<span>${esc(h)}</span>${on ? `<small>${esc(T(CHAINS[c2.chain].stages[s2.stage - 1][0]))}</small>` : ""}</button>`; }).join("");
    return `<div class="cr-sheet"><h2>${esc(T("Hold status"))}: ${esc(hold)}</h2><p class="sub">${esc(effectsLine(S, hold, t))}</p>
      <div class="cr-meters">${VARS.map((x) => meter(x, v[x], v0[x])).join("")}</div>${body}
      <details class="wev-rules"><summary class="sub">${esc(T("How it works"))}</summary><p class="sub">${esc(T(RULES))}</p></details>
      <h3 class="cr-h3">${esc(T("All holds"))}</h3><div class="cr-holds">${others}</div>
      <button class="btn wev-wide" data-act="close">${esc(T("Close"))}</button></div>`;
  }
  const RULES = "Every hold has four numbers. Security falls when outlaws and beasts roam and rises when people escort caravans and beat bandits. Food falls with snow and blight and rises when people bring food. Prosperity follows trade. Corruption rises with bribes, theft and fenced goods. Low numbers make shops dearer and the roads more dangerous. When things get bad a crisis starts: it gets worse every 5 hours. From stage 2 the Jarl posts contracts; enough relief from everyone draws out the ringleader. Beat them and everyone who helped shares the reward. Left alone, a crisis burns out after 40 hours. Nothing here is required.";
  /* the line on a town's page */
  function townLine(S, place, t = nowS()) {
    if (!S || typeof WORLD === "undefined" || !WORLD.places[place] || !["city", "town"].includes(WORLD.places[place][2])) return "";
    const hold = G.holdAt(WORLD.places[place]); if (!BASE[hold]) return "";
    const v = values(hold, S, t), cr = crisisIn(hold, t), st = cr ? status(cr, S, t) : null, on = st && (st.state === "active" || st.state === "boss");
    const chips = VARS.map((x) => `<span class="cr-chip${(x === "cor" ? v[x] >= 62 : v[x] < 35) ? " cr-bad" : ""}" title="${esc(T(VAR_NAME[x]))}"><i style="background:${VAR_COL[x]}"></i>${esc(T(VAR_NAME[x]))} ${v[x]}</span>`).join("");
    const cl = cr && claimable(S, cr, t);
    const crisis = on ? `<span class="cr-tag" style="--cr:${CHAINS[cr.chain].color}">${glyph(cr.chain)}${esc(T(CHAINS[cr.chain].name))} · ${esc(st.state === "boss" ? T("the ringleader is out!") : T("{stage} ({n}/{m})", { stage: T(CHAINS[cr.chain].stages[st.stage - 1][0]), n: st.stage, m: STAGES }))}</span>` : cl ? `<span class="cr-tag">${esc(T("Crisis won: reward waiting"))}</span>` : "";
    return `<div class="cr-town" data-cr="hold" data-hold="${esc(hold)}" role="button" tabindex="0"><div class="cr-tl"><b>${esc(T("Hold status"))}</b>${crisis}</div><div class="cr-chips">${chips}</div></div>`;
  }
  /* notice strips under the world event card (greatevents.js / gevstack.js) */
  function strips(S, t = nowS()) {
    if (!S || (S.level || 1) < 3) return [];
    const out = [];
    for (const cr of picks(cycleAt(t)).concat(picks(cycleAt(t) - 1))) {
      const st = status(cr, S, t), ch = CHAINS[cr.chain];
      if (st.state === "active" || st.state === "boss") {
        const line = st.state === "boss" ? T("{name} in {hold}: the ringleader is out!", { name: T(ch.name), hold: cr.hold }) : T("{name} in {hold}: {stage} ({n}/{m})", { name: T(ch.name), hold: cr.hold, stage: T(ch.stages[st.stage - 1][0]), n: st.stage, m: STAGES });
        out.push({ key: `cr:${cr.id}:${st.state}:${st.stage}`, html: `<div class="gev-strip cr-strip" data-cr="hold" data-hold="${esc(cr.hold)}" style="--cr:${ch.color}"><span>${glyph(cr.chain)} ${esc(line)}</span></div>` });
      } else if (claimable(S, cr, t)) out.push({ key: `cr:${cr.id}:claim`, html: `<div class="gev-strip cr-strip" data-cr="hold" data-hold="${esc(cr.hold)}"><span>${glyph(cr.chain)} ${esc(T("{name} in {hold} is over: your reward is waiting", { name: T(ch.name), hold: cr.hold }))}</span><button class="btn sm pri" data-cr="claim" data-id="${cr.id}">${esc(T("Claim"))}</button></div>` });
    }
    return out;
  }
  const sig = (S, t = nowS()) => { try { return strips(S, t).map((x) => x.key).join(",") + "|" + ver; } catch (e) { return ""; } };

  // ---- the map: a ring and glyph over the capital of a hold in crisis
  function drawGlyph(g, kind, x, y, r) {
    g.beginPath();
    if (kind === "snow") for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    else if (kind === "swords") { g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.moveTo(x - r * 0.9, y + r * 0.3); g.lineTo(x - r * 0.3, y + r * 0.9); g.moveTo(x + r * 0.9, y + r * 0.3); g.lineTo(x + r * 0.3, y + r * 0.9); }
    else if (kind === "wheat") { g.moveTo(x, y + r); g.lineTo(x, y - r); for (let i = 0; i < 3; i++) { const yy = y - r * 0.6 + i * r * 0.5; g.moveTo(x, yy + r * 0.3); g.lineTo(x - r * 0.5, yy); g.moveTo(x, yy + r * 0.3); g.lineTo(x + r * 0.5, yy); } }
    else if (kind === "coin") { g.arc(x, y, r * 0.85, 0, 7); g.moveTo(x, y - r * 0.5); g.lineTo(x, y + r * 0.5); }
    else { g.arc(x, y + r * 0.35, r * 0.5, 0, 7); for (const [dx, dy] of [[-0.6, -0.3], [0.6, -0.3], [-0.25, -0.8], [0.25, -0.8]]) { g.moveTo(x + dx * r + r * 0.2, y + dy * r); g.arc(x + dx * r, y + dy * r, r * 0.2, 0, 7); } }
    g.stroke();
  }
  /* where the sign goes: left of the town by default; if a card docked over the map (mapdock.js) would cover it, the right
     side of the town, else nudged out just past the card's edge with a thin line back to the town */
  function signSpot(g, x, y, s, txt, dock) {
    g.font = `700 ${Math.round(8.5 * s)}px GameIcons, sans-serif`;
    const tw = g.measureText(txt).width, pad = 4 * s;
    const box = (ox, oy, right) => right ? [ox - 10 * s, oy - 10 * s, 22 * s + tw + pad, 26 * s] : [ox - 12 * s - tw - pad, oy - 10 * s, 22 * s + tw + pad, 26 * s];
    const hits = (b) => (dock || []).filter(([X, Y, Wd, Hd]) => b[0] < X + Wd && b[0] + b[2] > X && b[1] < Y + Hd && b[1] + b[3] > Y);
    const left = { ox: x - 26 * s, oy: y - 8 * s, right: false };
    if (!hits(box(left.ox, left.oy, false)).length) return left;
    const right = { ox: x + 26 * s, oy: y - 8 * s, right: true };
    if (!hits(box(right.ox, right.oy, true)).length) return right;
    const edge = Math.max(...hits(box(right.ox, right.oy, true)).map(([X, , Wd]) => X + Wd));
    return { ox: edge + 14 * s, oy: y - 8 * s, right: true, line: true };
  }
  function drawMap(g, P, s, t, rm, dock) {
    const S = me(); if (!S || typeof WORLD === "undefined") return;
    const now = nowS(), tt = rm ? 0 : t || 0;
    let list = []; try { list = around(now); } catch (e) { return; }
    for (const cr of list) {
      const p = WORLD.places[cr.place]; if (!p) continue;
      const st = status(cr, S, now); if (st.state !== "active" && st.state !== "boss") continue;
      const [x, y] = P(p), ch = CHAINS[cr.chain], pu = rm ? 0.5 : (Math.sin(tt * 2 + cr.c) + 1) / 2;
      const txt = st.state === "boss" ? T("Ringleader!") : T(ch.stages[st.stage - 1][0]);
      g.save();
      const sp = signSpot(g, x, y, s, txt, dock), ox = sp.ox, oy = sp.oy;   // beside the town, clear of the great event marker and the docked cards
      g.strokeStyle = ch.color; g.globalAlpha = 0.35 + 0.35 * pu; g.lineWidth = 2 * s;
      g.beginPath(); g.arc(x, y, (22 + st.stage * 2 + 3 * pu) * s, 0, 7); g.stroke();
      g.globalAlpha = 1;
      if (sp.line) { g.strokeStyle = ch.color; g.globalAlpha = 0.7; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x + 6 * s, y - 3 * s); g.lineTo(ox - 9 * s, oy); g.stroke(); g.globalAlpha = 1; }
      g.fillStyle = "rgba(20,14,8,.85)"; g.beginPath(); g.arc(ox, oy, 9 * s, 0, 7); g.fill();
      g.strokeStyle = st.state === "boss" ? "#ffb38a" : ch.color; g.lineWidth = 1.4 * s; g.beginPath(); g.arc(ox, oy, 9 * s, 0, 7); g.stroke();
      g.lineCap = "round"; drawGlyph(g, ch.icon, ox, oy, 5 * s);
      // five stage pips under the glyph
      for (let i = 0; i < STAGES; i++) { g.fillStyle = i < st.stage ? (st.state === "boss" ? "#ffb38a" : ch.color) : "rgba(20,14,8,.7)"; g.beginPath(); g.arc(ox - 8 * s + i * 4 * s, oy + 13 * s, 1.5 * s, 0, 7); g.fill(); }
      const tx = sp.right ? ox + 12 * s : ox - 12 * s;
      g.font = `700 ${Math.round(8.5 * s)}px GameIcons, sans-serif`; g.textAlign = sp.right ? "left" : "right"; g.lineWidth = 3 * s; g.strokeStyle = "rgba(20,14,8,.88)"; g.strokeText(txt, tx, oy + 3 * s); g.fillStyle = st.state === "boss" ? "#ffb38a" : "#f1e4c6"; g.fillText(txt, tx, oy + 3 * s);
      g.restore();
    }
  }

  // ---- actions
  function publish(force) {
    const S = me(); if (!S || typeof Store === "undefined") return;
    clearTimeout(pubT);
    const go = () => { const st = me(); if (st) { Store.put("crises", st.id, record(st)); isDirty = false; } };
    if (force) go(); else pubT = setTimeout(go, 2000);
  }
  let curHold = null;
  function openSheet(hold) {
    const S = me(); if (!S || !api) return;
    curHold = hold; api.closeModal(); api.openModal(sheetHTML(S, hold, nowS()), "crsheet");
  }
  function reopen() { if (curHold && document.querySelector(".crsheet")) openSheet(curHold); }
  function onClick(e) {
    if (api && e.target.closest('.crsheet [data-act="go"]')) { if (document.querySelector(".crsheet")) api.closeModal(); return; }
    const b = e.target.closest("[data-cr]"); if (!b || b.disabled || !api) return;
    if (e.target.closest("[data-gevs]")) return;   // the × on a notice strip
    const S = me(); if (!S) return;
    const act = b.dataset.cr, t = nowS();
    if (act !== "hold" || !b.classList.contains("cr-strip")) e.stopPropagation();
    if (typeof SOUND !== "undefined") try { SOUND.fx("click"); } catch (er) { /* ignore */ }
    if (act === "hold") return void openSheet(b.dataset.hold);
    if (act === "claim") {
      const msg = claim(S, b.dataset.id, t); if (!msg) return api.toast(T("Nothing to claim yet."));
      api.persist(true); publish(true); if (typeof SOUND !== "undefined") try { SOUND.fx("levelup"); } catch (er) { /* ignore */ }
      api.closeModal(); return api.showMessage(T("Hold status"), msg, false, true);   // a crisis won: prestige frame
    }
    if (act === "do") {
      const id = b.dataset.id, cid = b.dataset.c, c = CONTRACTS[cid];
      if (c && c.kind !== "fight") { const r = contract(S, id, cid, t, { party: partyOf() }); api.toast(r.text); if (r.done) { api.persist(true); publish(true); reopen(); } return; }
      return void fightCall(() => contract(S, id, cid, t, { party: partyOf() }), (out) => {
        if (!out.fight) return api.toast(out.text);
        if (out.bag && typeof Store !== "undefined") Store.addBag(out.bag);
        api.closeModal(); api.persist(true); publish(true);
        return api.showFightResult({ ...out, title: out.died ? null : out.title });
      });
    }
    if (act === "boss") {
      return void fightCall(() => boss(S, b.dataset.id, t, { party: partyOf() }), (out) => {
        if (!out.fight) return api.toast(out.text);
        if (out.bag && typeof Store !== "undefined") Store.addBag(out.bag);
        if (out.slain && api.postNews) api.postNews(T("{name} beat {boss} and ended {crisis} in {hold}!", { name: S.name, boss: CHAINS[out.cr.chain].boss.name, crisis: T(CHAINS[out.cr.chain].name), hold: out.cr.hold }));
        if (out.slain && typeof POLISH !== "undefined") POLISH.banner("quest", T("Crisis over"), T(CHAINS[out.cr.chain].name));
        api.closeModal(); api.persist(true); publish(true);
        return api.showFightResult({ ...out, title: out.died ? null : out.title });
      });
    }
  }
  /* a journal line (and a banner if you're in the hold) when a crisis starts or its Jarl calls for help */
  function announce(S, t) {
    const m = mine(S, t);
    for (const cr of picks(cycleAt(t))) {
      const st = status(cr, S, t); if (st.state !== "active" && st.state !== "boss") continue;
      const key = st.stage >= 2 ? 2 : 1; if ((m.seen[cr.id] || 0) >= key) continue;
      m.seen[cr.id] = key;
      const ch = CHAINS[cr.chain];
      const line = key === 1 ? T("{name} grips {hold}: {what}", { name: T(ch.name), hold: cr.hold, what: T(ch.stages[0][1], { hold: cr.hold }) }) : T("The Jarl of {hold} posts contracts against {name}.", { hold: cr.hold, name: T(ch.name) });
      G.note(S, line);
      let inHold = false; try { inHold = G.holdAt([S.x, S.y]) === cr.hold; } catch (e) { /* ignore */ }
      if (inHold && (S.level || 1) >= 3 && typeof POLISH !== "undefined") POLISH.banner("quest", T("Hold crisis"), T(ch.name));
    }
  }
  function loop() {
    const S = me(); if (!S) return;
    try { announce(S, nowS()); if (isDirty) publish(false); } catch (e) { console.warn("crises", e); }
  }
  /* ui.js calls this once the main screen is up */
  function mount(a) {
    api = a;
    if (typeof Store !== "undefined") Store.watch("crises", (list) => { setDocs(list); });
    if (!mount.bound) { document.addEventListener("click", onClick); document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.closest?.(".cr-town")) { e.preventDefault(); e.target.click(); } }); mount.bound = true; }
    clearInterval(loopT); loopT = setInterval(loop, 3000); loop();
    publish(false);
  }
  if (typeof I18N !== "undefined" && I18N.add && typeof I18N_CRISES !== "undefined") I18N.add(I18N_CRISES.tpl, I18N_CRISES.words);

  return { HOLDS, CAPITAL, VARS, BASE, CHAINS, CONTRACTS, CYCLE, STAGE, SPAN, STAGES, AFTER, FOE, BOSS, NEED_SOLO, NEED_PER, PLAYER_CAP, ALL_CAP, FOOD_N, FOOD_MAX, CONTRACT_CD, BOSS_CD,
    cycleAt, baseline, snowiness, pressure, picks, byId, around, setDocs, mine, record, rows, deeds, tally, status, crisisIn, values, level, needFor,
    priceMult, encounterMult, deed, onFight, contract, contractBlock, boss, bossBlock, makeFoe, claimable, claim, foodCount,
    sheetHTML, townLine, strips, sig, drawMap, mount, openSheet, hookWorld, _dirty: () => isDirty };
})();
