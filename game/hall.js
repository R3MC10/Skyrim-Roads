/* The Hall of the North: one hall outside Whiterun that every player builds up together.
   Each player keeps their own donation record ("hall" collection, id = their id), so two people donating
   at once never overwrite each other; the hall's size is the sum of everyone's donations. [OURS] */
const HALL = (() => {
  const TOWN = "Whiterun", POS = [0.505, 0.468];   // on the plains just east of Whiterun
  const TIERS = [
    // name, points needed, what it gives everyone
    ["Camp", 0, "A fire and a few tents. Rest by the fire to heal for free."],
    ["Longhouse", 5000, "Free beds that make you Rested (skills +5% faster for 40 minutes)."],
    ["Mead Hall", 15000, "Training costs 10% less everywhere, and the shared chest opens."],
    ["Fortified Hall", 40000, "Beds make you Well Rested (+10%), and training costs 20% less."],
    ["Jarl's Keep", 100000, "Everyone carries 25 more, and training costs 25% less."],
  ];
  const TRAIN = [1, 1, 0.9, 0.8, 0.75];
  const MAT_PTS = { mat_iron: 10, mat_steel: 25, mat_leather: 10, mat_firewood: 5, mat_moonstone: 30, mat_dwarven: 40 };
  const BUILDER_TITLE = "Hall Builder", BUILDER_PTS = 1000;
  const CHEST_PER_DAY = 3;
  let donors = [], chest = [];

  const total = () => donors.reduce((a, d) => a + d.pts, 0);
  function tierOf(points) { let t = 0; TIERS.forEach(([, need], i) => { if (points >= need) t = i; }); return t; }
  const tier = () => tierOf(total());
  function progress() {
    const p = total(), t = tierOf(p), next = TIERS[t + 1];
    return { points: p, tier: t, name: TIERS[t][0], next: next ? next[0] : null, need: next ? next[1] : null, pct: next ? Math.min(100, 100 * (p - TIERS[t][1]) / (next[1] - TIERS[t][1])) : 100 };
  }
  function setDonors(docs, mine) {
    donors = docs.filter((d) => typeof d.pts === "number" && d.pts > 0 && typeof d.name === "string").map((d) => ({ id: d.id, name: d.name.slice(0, 24), pts: Math.floor(d.pts) }));
    if (mine && mine.hallPts > 0 && !donors.some((d) => d.id === mine.id)) donors.push({ id: mine.id, name: mine.name, pts: mine.hallPts });   // count yourself before your record syncs
  }
  const setChest = (docs) => { chest = docs.filter((d) => d.item && D.ITEMS[d.item] && !d.takenBy).sort((a, b) => b.t - a.t); };
  const top = (n = 10) => [...donors].sort((a, b) => b.pts - a.pts).slice(0, n);

  /* -> { text, before, after } or { err } ; the caller publishes the player's donor record */
  function donateGold(s, n) {
    n = Math.floor(n);
    if (!(n > 0)) return { err: "Choose how much to give." };
    if (s.gold < n) return { err: `You only have ${s.gold} gold.` };
    const before = tier();
    s.gold -= n; s.hallPts = (s.hallPts || 0) + n;
    return finish(s, before, `You give ${n} gold to the hall.`);
  }
  function donateMat(s, rowId, n = 1) {
    const r = G.invRow(s, rowId);
    if (!r || !MAT_PTS[r.item]) return { err: "The builders only take building materials." };
    n = Math.min(Math.floor(n) || 1, r.qty);
    const before = tier(), pts = MAT_PTS[r.item] * n, name = D.ITEMS[r.item].name;
    G.take(s, rowId, n); s.hallPts = (s.hallPts || 0) + pts;
    return finish(s, before, `You hand over ${n} ${name}${n > 1 ? "s" : ""} (${pts} towards the hall).`);
  }
  function finish(s, before, text) {
    const mine = donors.find((d) => d.id === s.id);
    if (mine) mine.pts = s.hallPts; else donors.push({ id: s.id, name: s.name, pts: s.hallPts });
    const after = tier();
    if (s.hallPts >= BUILDER_PTS && !(s.titles || []).includes(BUILDER_TITLE)) { s.titles = [...(s.titles || []), BUILDER_TITLE]; text += ` The builders call you ${BUILDER_TITLE} now.`; }
    if (after > before) text += ` The hall grows: it's a ${TIERS[after][0]} now!`;
    return { text, before, after };
  }
  /* free rest at the hall: better beds as it grows ([Skyrim] Rested +5%, Well Rested +10%) */
  function rest(s, t = Date.now() / 1000) {
    if (s.location !== TOWN) return "The hall is in Whiterun.";
    G.setHealth(s, G.maxHealth(s), t);
    const tr = tier();
    if (tr === 0) return "You warm yourself by the fire and patch your wounds. Fully healed.";
    s.rested = t + 8 * 2 * 3600 / 24; s.restBonus = tr >= 3 ? 0.1 : 0.05;
    return `You sleep in the ${TIERS[tr][0]}. Fully healed and ${tr >= 3 ? "Well Rested: skills improve 10%" : "Rested: skills improve 5%"} faster for 40 minutes.`;
  }
  // ---- shared chest (Mead Hall and up): anyone can put things in; you can take 3 a day
  const day = () => Math.floor(Date.now() / 864e5);
  const takenToday = (s) => (s.hallTaken?.day === day() ? s.hallTaken.n : 0);
  function canDeposit(r) { return r && D.ITEMS[r.item] && !r.stolen && !r.temper && !D.ITEMS[r.item].quest; }
  function deposit(s, rowId) {
    if (tier() < 2) return { err: "The shared chest opens when the hall becomes a Mead Hall." };
    const r = G.invRow(s, rowId);
    if (!canDeposit(r)) return { err: "That can't go in the chest (stolen or improved things stay with you)." };
    const item = r.item; G.take(s, rowId, 1);
    return { item, text: `You put ${D.ITEMS[item].name} in the shared chest.` };
  }
  function canTake(s) { return tier() >= 2 && takenToday(s) < CHEST_PER_DAY; }
  function took(s, item) { s.hallTaken = { day: day(), n: takenToday(s) + 1 }; G.give(s, item); return `You take ${D.ITEMS[item].name}. (${CHEST_PER_DAY - takenToday(s)} more today)`; }

  return { TOWN, POS, TIERS, MAT_PTS, BUILDER_PTS, CHEST_PER_DAY, total, tier, tierOf, progress, setDonors, setChest, top,
    get chest() { return chest; }, donateGold, donateMat, rest, canDeposit, deposit, canTake, took, takenToday,
    trainMult: () => TRAIN[tier()], carryBonus: () => (tier() >= 4 ? 25 : 0) };
})();
