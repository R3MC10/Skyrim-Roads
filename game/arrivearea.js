/* Arriving somewhere opens the Area tab (arrivearea.js). [OURS]
   Players kept arriving in a town and then hunting for the Area tab. Now, when a trip ends at a real place (a town, a
   dungeon entrance, a shrine...), the Area tab opens by itself, on phone and PC.
   - Not for a free-roam spot or a map pin (nothing there), and not when a trip was cancelled (that never "arrives").
   - Something on screen first (a fight, a road event or encounter card, any window, a result card, an open menu): the
     switch waits until it's gone (overlays.js when(), "decision" level, quiet), then checks you're still standing there.
   - A party member following the leader: only switched when idle on the map (Map tab, nothing open), never yanked away
     from something else they're reading.
   - The Gathering card also shows at the top of the Area tab, so picking plants still works from there.
   The decision is a plain function so node tests can check it (tests/test_arrivearea.js). */
const ARRIVEAREA = (() => {
  const MAX_WAIT = 120000;                    // ms: a switch still waiting after this long is dropped
  const MAP_TABS = ["map", "places", "world"];   // screens that count as "on the map"
  const AREA = "town";

  /* pure: open the Area tab for this arrival? i: {place, known, follower, tab, menu, busy, trip, dungeon}
     known: the place is on the world map (not a roam spot or pin). busy: something is showing right now. */
  function want(i) {
    if (!i || !i.place || !i.known || i.trip || i.dungeon) return false;
    if (i.tab === AREA && !i.menu) return false;   // already there
    if (i.follower) return idle(i);
    return true;
  }
  /* pure: a follower is idle on the map */
  const idle = (i) => MAP_TABS.includes(i.tab || "map") && !i.menu && !i.busy;
  /* pure: still worth switching when the screen clears? */
  const still = (s, place, since, now) => !!s && s.location === place && !s.trip && !s.dungeon && now - since < MAX_WAIT;

  /* browser: called by ui.js right after an arrival. o: {s, place, known, follower, tab, menu, go}
     Returns "now", "later" or "" (no switch). */
  function arrive(o) {
    const O = typeof OVERLAYS !== "undefined" ? OVERLAYS : null;
    const busy = O ? O.level() >= O.LEVEL.decision || O.fightOpen() || O.menuOpen() : false;
    const info = { place: o.place, known: o.known, follower: o.follower, tab: o.tab, menu: o.menu || (O ? O.menuOpen() : false), busy, trip: !!o.s?.trip, dungeon: !!o.s?.dungeon };
    if (!want(info)) return "";
    const since = Date.now();
    const fn = () => { if (still(o.s, o.place, since, Date.now())) o.go(); };
    if (!O) { fn(); return "now"; }
    return O.when("decision", fn, true) ? "now" : "later";
  }

  /* the Gathering card for the top of the Area tab ("" when nothing grows nearby) */
  function gatherHTML(s) {
    if (typeof GATHER === "undefined" || !s || s.dungeon || s.trip) return "";
    try { return GATHER.card(s) || ""; } catch (e) { return ""; }
  }

  // ------------------------------------------------------------ Polish
  const PL = {
    "The Area tab opens when you arrive": "Zakładka Okolica otwiera się po przybyciu",
    "When you reach a town, a dungeon entrance or another place on the map, the Area tab opens by itself, so shops, the inn and what you can do there are right in front of you.":
      "Gdy dotrzesz do miasta, wejścia do lochu albo innego miejsca na mapie, zakładka Okolica otwiera się sama, więc sklepy, karczma i to, co możesz tam zrobić, masz od razu przed sobą.",
    "If a fight, a road event or any window is still open, it waits until you close it.":
      "Jeśli walka, wydarzenie na drodze albo jakieś okno jest jeszcze otwarte, zaczeka, aż je zamkniesz.",
    "Stopping at a spot you picked in the wilds or a map pin keeps you on the map.":
      "Postój w wybranym miejscu na pustkowiu albo przy pinezce na mapie zostawia cię na mapie.",
    "In a party, if you follow the leader, it only switches when you're just looking at the map, never while you're reading something else.":
      "W drużynie, gdy idziesz za przywódcą, zakładka zmienia się tylko wtedy, gdy po prostu patrzysz na mapę, nigdy gdy czytasz coś innego.",
    "Plants you can gather nearby also show at the top of the Area tab.":
      "Rośliny do zebrania w pobliżu widać też na górze zakładki Okolica.",
  };
  if (typeof I18N !== "undefined" && I18N.PL) for (const [k, v] of Object.entries(PL)) if (!(k in I18N.PL)) I18N.PL[k] = v;

  return { MAX_WAIT, MAP_TABS, want, idle, still, arrive, gatherHTML, PL };
})();
if (typeof module !== "undefined") module.exports = ARRIVEAREA;
