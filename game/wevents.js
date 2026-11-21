/* World events that every player sees at the same moment: the calendar and seasons, weather per hold,
   and dragon attacks on towns. All of it is worked out from the clock, so every phone agrees without talking;
   only the damage each player does to an attacking dragon is shared (collection "raids"). */
const WEVENTS = (() => {
  const now = () => Date.now() / 1000;
  const hash = (str) => { let x = 2166136261; for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; return x / 4294967296; };

  // ---- calendar ([Skyrim] months and their lengths; the game starts on the 17th of Last Seed, like Skyrim)
  const MONTHS = [["Morning Star", 31], ["Sun's Dawn", 28], ["First Seed", 31], ["Rain's Hand", 30], ["Second Seed", 31], ["Midyear", 30],
    ["Sun's Height", 31], ["Last Seed", 31], ["Hearthfire", 30], ["Frostfall", 31], ["Sun's Dusk", 30], ["Evening Star", 31]];
  const SEASON_OF = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
  function date(t = now()) {
    let d = (G.clock(t).day - 1 + 228) % 365;   // day 1 = Last Seed 17
    let m = 0; while (d >= MONTHS[m][1]) { d -= MONTHS[m][1]; m++; }
    return { day: d + 1, month: MONTHS[m][0], season: SEASON_OF[m] };
  }
  const season = (t = now()) => date(t).season;

  // ---- weather: changes every 30 real minutes, per hold ([OURS] effects)
  const W = {
    clear: ["Clear", "☀️", 1, 0, 1], cloudy: ["Overcast", "☁️", 1, 0.03, 1], rain: ["Rain", "🌧", 0.92, 0.08, 1], fog: ["Fog", "🌫", 0.95, 0.15, 1],
    storm: ["Thunderstorm", "⛈", 0.9, 0.1, 0.8], snow: ["Snow", "🌨", 0.85, 0.05, 1], blizzard: ["Blizzard", "❄️", 0.7, 0.12, 0.7],
    ashstorm: ["Ash storm", "🌋", 0.65, 0.15, 0.8],   // [Skyrim] Solstheim's ash storms off Red Mountain ([OURS] effects)
  };
  const COLD = ["Winterhold", "The Pale"], WET = ["The Rift", "Hjaalmarch", "Haafingar"];
  function weatherAt(hold, t = now()) {
    const block = Math.floor(t / 1800), r = hash(hold + ":" + block), se = season(t), cold = COLD.includes(hold);
    let table;
    if (hold === "Solstheim") table = [["ashstorm", 2.2], ["cloudy", 2], ["clear", 2], ["snow", se === "winter" ? 2.5 : 1], ["fog", 1]];
    else if (typeof FEST !== "undefined" && FEST.weatherBoost(t)) table = cold ? [["blizzard", 4], ["snow", 3], ["fog", 1]] : [["snow", 4], ["blizzard", 2], ["cloudy", 2], ["clear", 1]];   // Frostfall Blizzards
    else if (cold) table = [["snow", 4], ["blizzard", se === "winter" ? 3 : 1.5], ["cloudy", 2], ["clear", se === "summer" ? 2 : 1], ["fog", 1]];
    else if (se === "winter") table = [["snow", 3], ["cloudy", 3], ["clear", 2], ["fog", 1], ["blizzard", 0.7]];
    else if (se === "summer") table = [["clear", 5], ["cloudy", 2], ["rain", 1], ["storm", 1]];
    else table = [["clear", 3], ["cloudy", 3], ["rain", WET.includes(hold) ? 3 : 2], ["fog", WET.includes(hold) ? 2 : 1], ["storm", 0.7]];
    let x = r * table.reduce((a, [, w]) => a + w, 0);
    const id = table.find(([, w]) => (x -= w) < 0)?.[0] || "clear";
    const [name, icon, speed, sneak, encounters] = W[id];
    return { id, name, icon, speed, sneak, encounters };
  }
  const weather = (pos, t = now()) => weatherAt(G.holdAt(pos), t);

  // ---- dragon attacks: one every 3 real hours somewhere, 20 minutes long ([OURS])
  const TOWNS9 = ["Whiterun", "Solitude", "Windhelm", "Markarth", "Riften", "Falkreath", "Dawnstar", "Morthal", "Winterhold", "Riverwood", "Rorikstead", "Ivarstead"];
  const BLOCK = 3 * 3600, LEN = 20 * 60;
  function raidIn(block) {
    const r = hash("raid:" + block);
    const start = block * BLOCK + Math.floor(r * (BLOCK - LEN));
    return { id: "raid-" + block, town: TOWNS9[Math.floor(hash("town:" + block) * TOWNS9.length)], start, end: start + LEN };
  }
  function activeRaid(t = now()) { const b = Math.floor(t / BLOCK); for (const k of [b, b - 1]) { const r = raidIn(k); if (t >= r.start && t < r.end) return r; } return null; }
  function nextRaid(t = now()) { const b = Math.floor(t / BLOCK); for (const k of [b, b + 1, b + 2]) { const r = raidIn(k); if (r.start > t) return r; } return null; }
  /* the dragon's health grows with the number of people fighting it ([OURS]) */
  const needed = (contributors) => 600 + 400 * Math.max(0, contributors - 1);
  function tally(raid, docs, s) {
    const mine = s.raid?.id === raid.id ? s.raid.dmg : 0;
    const others = docs.filter((d) => d.raid === raid.id && d.uid !== s.id);
    const total = mine + others.reduce((a, d) => a + (d.dmg || 0), 0);
    const people = others.length + (mine ? 1 : 0);
    return { total: Math.round(total), need: needed(Math.max(1, people)), people, names: others.map((d) => d.name) };
  }
  /* one round against the attacking dragon (up to 10 turns). Returns {dealt, fight, skills, died?, bag?, slain} */
  function fight(s, raid, docs, t = now()) {
    if (s.location !== raid.town) return { text: `The dragon is over ${raid.town}. Get there first.` };
    if (t >= raid.end) return { text: "The dragon has flown off." };
    const tl = tally(raid, docs, s), left = Math.max(1, tl.need - tl.total);
    const e = G.scaleEnemy({ name: `Dragon over ${raid.town}`, health: left, damage: 30, tags: ["big", "dragon", "elite"], level: 40, danger: "high", gold: [0, 0], text: "" }, s.level);
    e.health = left; e.hp = left;   // its wounds are shared, so health isn't scaled
    const f = new G.Fight(s, e, null, t);
    f.run({ t, maxTurns: 10 });
    const skills = f.apply(t);
    const dealt = Math.round(left - Math.max(0, f.ehp));
    s.raid = s.raid?.id === raid.id ? { ...s.raid, dmg: s.raid.dmg + dealt } : { id: raid.id, dmg: dealt, claimed: false };
    const out = { dealt, fight: f, skills, slain: f.won };
    if (f.won) s.raid.claimed = true;   // the killing blow already took the soul (Fight.apply)
    if (f.hp <= 0) { const d = G.die(s, "dragon", t); out.died = d.msg; out.bag = d.bag; }
    out.text = f.won ? `You land the killing blow! The dragon crashes into ${raid.town}.` : out.died ? "The dragon's fire takes you." : `You hit it for ${dealt} before it climbs out of reach. It circles back...`;
    return out;
  }
  /* after a dragon you fought dies: your share of the reward ([OURS]: soul + 300 gold + bones and scales) */
  function claim(s, raid, docs) {
    if (!s.raid || s.raid.id !== raid.id || s.raid.claimed) return null;
    const tl = tally(raid, docs, s);
    if (tl.total < tl.need) return null;
    s.raid.claimed = true; s.gold += 300; G.give(s, "dragon_bone"); G.give(s, "dragon_scales");
    return `The dragon over ${raid.town} is dead. You fought it, so its soul finds you too. ${POWERS.absorb(s)} +300 gold, dragon bone and dragon scales.`;
  }
  Object.assign(D.ITEMS, {
    dragon_bone: { name: "Dragon Bone", slot: "trophy", weight: 15, value: 500 },     // [Skyrim] value and weight
    dragon_scales: { name: "Dragon Scales", slot: "trophy", weight: 10, value: 250 },
  });

  return { date, season, weatherAt, weather, activeRaid, nextRaid, tally, needed, fight, claim, W };
})();
