/* Seasonal world events, fixed to the real calendar (UTC) so every phone agrees.
   Each has a small effect on the world, a goal, and a reward + title for reaching it once per year. [OURS] */
const FEST = (() => {
  const EVENTS = [
    { id: "witching", name: "The Witchingmoon", icon: "", from: [10, 25], to: [11, 1],
      text: "The dead walk thicker at night. Undead on the roads after dark, and they carry more gold.",
      goal: { key: "undead", n: 10, what: "Defeat 10 undead" }, reward: { gold: 300, item: ["soul_gem_common", 2], title: "Gravewarden" } },
    { id: "frostfall", name: "Frostfall Blizzards", icon: "", from: [11, 15], to: [11, 30],
      text: "Snow and blizzards sweep all of Skyrim, even the south. Hot Fish Soup helps; carriages don't care.",
      goal: { key: "arrive", n: 8, what: "Finish 8 trips while the blizzards last" }, reward: { gold: 300, item: ["mat_firewood", 5], title: "Frostwalker" } },
    { id: "newlife", name: "The New Life Festival", icon: "", from: [12, 28], to: [1, 3],
      text: "Skyrim celebrates the new year. Inn rooms are free, and every innkeeper has a gift for you once a day.",
      goal: { key: "gift", n: 3, what: "Collect the innkeepers' gift on 3 days" }, reward: { gold: 500, item: ["mat_moonstone", 2], title: "Reveler" } },
    { id: "midyear", name: "The Midyear Celebration", icon: "", from: [6, 16], to: [6, 22],
      text: "Long days and fairs. Shops sell 10% cheaper, and the Arena is packed.",
      goal: { key: "duel", n: 3, what: "Fight 3 Arena duels" }, reward: { gold: 400, item: ["mat_steel", 4], title: "Champion of Midyear" } },
  ];
  /* is a date inside [from, to] (month/day, wrapping over New Year)? */
  function inRange(d, [fm, fd], [tm, td]) {
    const v = (d.getUTCMonth() + 1) * 100 + d.getUTCDate(), a = fm * 100 + fd, b = tm * 100 + td;
    return a <= b ? v >= a && v <= b : v >= a || v <= b;
  }
  const yearOf = (ev, d) => (ev.from[0] > ev.to[0] && d.getUTCMonth() + 1 <= ev.to[0] ? d.getUTCFullYear() - 1 : d.getUTCFullYear());   // New Life belongs to the year it started
  function active(t = Date.now()) { const d = new Date(t); const ev = EVENTS.find((e) => inRange(d, e.from, e.to)); return ev ? { ...ev, key: `${ev.id}-${yearOf(ev, d)}` } : null; }
  function next(t = Date.now()) {   // the next one to start, for the Journal
    for (let i = 1; i <= 366; i++) { const d = new Date(t + i * 864e5); const ev = EVENTS.find((e) => inRange(d, e.from, e.to)); if (ev && ev.id !== active(t)?.id) return { ...ev, days: i }; }
    return null;
  }
  const mine = (s, ev) => { s.fest = s.fest || {}; if (!s.fest[ev.key]) s.fest[ev.key] = { n: 0 }; return s.fest[ev.key]; };
  /* count progress; returns a message when the goal is reached */
  function count(s, key, n = 1, t = Date.now()) {
    const ev = active(t); if (!ev || ev.goal.key !== key) return null;
    const m = mine(s, ev); if (m.done) return null;
    m.n += n;
    return m.n >= ev.goal.n ? `${ev.icon} ${ev.name}: goal reached! Claim your reward in the Journal.` : null;
  }
  const status = (s, t = Date.now()) => { const ev = active(t); if (!ev) return null; const m = mine(s, ev); return { ev, n: Math.min(m.n, ev.goal.n), done: !!m.done, ready: !m.done && m.n >= ev.goal.n }; };
  function claim(s, t = Date.now()) {
    const st = status(s, t); if (!st?.ready) return null;
    const { ev } = st, m = mine(s, ev); m.done = true;
    s.gold += ev.reward.gold; const [item, q] = ev.reward.item; if (D.ITEMS[item]) G.give(s, item, q);
    if (!(s.titles || []).includes(ev.reward.title)) s.titles = [...(s.titles || []), ev.reward.title];
    for (const k of Object.keys(s.fest)) if (+k.split("-").pop() < new Date(t).getUTCFullYear() - 1) delete s.fest[k];   // keep it small
    return `${ev.icon} ${ev.name}: ${ev.reward.gold} gold, ${D.ITEMS[item]?.name || item} ×${q}, and the title ${ev.reward.title}.`;
  }
  // ---- effects on the world (all read by other modules through typeof FEST guards)
  const is = (id, t) => active(t)?.id === id;
  const weatherBoost = (t) => is("frostfall", t * 1000);      // wevents.js: more snow everywhere
  const undeadNight = (t) => is("witching", t * 1000);        // engine.js: undead at night
  const shopDiscount = () => (is("midyear") ? 0.9 : 1);
  const freeInn = () => is("newlife");
  /* New Life: one innkeeper's gift a day */
  function innGift(s, t = Date.now()) {
    if (!is("newlife", t)) return null;
    const day = Math.floor(t / 864e5); s.festGift = s.festGift || 0;
    if (s.festGift === day) return "You've had today's gift. Come back tomorrow.";
    s.festGift = day; s.gold += 50; G.give(s, "dish_veg_soup"); count(s, "gift", 1, t);
    return "The innkeeper hands you a steaming bowl of Vegetable Soup and 50 gold. Happy New Life!";
  }
  return { EVENTS, active, next, count, status, claim, weatherBoost, undeadNight, shopDiscount, freeInn, innGift, inRange };
})();
