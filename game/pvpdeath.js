/* Dying to another player. [OURS]
   Remigiusz: "drop equipped items, respawn naked but with gold, 1% of carried gold drops as loot,
   respawn at the temple of their choosing."
   - Everything you were wearing and holding (your current gear set) drops in a bag where you fell. Bound items
     (dragon priest masks) stay with you. Your backpack stays with you.
   - 1% of your gold goes in the bag; you keep the rest.
   - You wake up at the nearest temple, then pick any temple in a city or town you've found and go there at once. */
const PVPDEATH = (() => {
  const BAG_MIN = 10;
  const TOWN_KINDS = ["city", "town"];
  const where = (n) => (typeof WORLD !== "undefined" ? WORLD.places[n] : null);
  function temples(s) {
    const list = (s.discovered || []).filter((n) => TOWN_KINDS.includes(where(n)?.[2]));
    return list.length ? [...new Set(list)] : [D.START_LOCATION];
  }
  function die(s, killer, t = G.now()) {
    const lo = s.loadouts?.[s.loadout] || Object.values(s.loadouts || {})[0] || { equipment: {} };
    const worn = new Set(Object.values(lo.equipment || {}));
    const items = [];
    s.inv = s.inv.filter((r) => {
      if (!worn.has(r.id) || D.ITEMS[r.item]?.noTrade) return true;
      items.push([r.item, r.qty, r.charge]); return false;
    });
    const gone = new Set(items.length ? [...worn].filter((id) => !s.inv.some((r) => r.id === id)) : []);
    for (const l of Object.values(s.loadouts || {})) for (const [slot, id] of Object.entries(l.equipment || {})) if (gone.has(id)) delete l.equipment[slot];
    const gold = Math.floor((s.gold || 0) * 0.01);
    s.gold = (s.gold || 0) - gold;
    const bag = gold || items.length ? { id: `${s.id}-${Math.floor(t)}`, ownerId: s.id, ownerName: s.name, x: s.x, y: s.y, gold, items, expires: t + BAG_MIN * 60 } : null;
    const town = temples(s).reduce((a, b) => G.pxDist([s.x, s.y], where(a) || [0, 0]) <= G.pxDist([s.x, s.y], where(b) || [0, 0]) ? a : b);
    if (where(town)) [s.x, s.y] = where(town);
    s.location = town;
    G.setHealth(s, G.maxHealth(s) * 0.5, t);
    s.trip = null; s.dungeon = null; s.ambush = false;
    s.pickTemple = true;
    const n = items.reduce((a, i) => a + i[1], 0);
    const msg = `Killed by ${killer}. Your gear (${n} item${n === 1 ? "" : "s"}) and ${gold} gold dropped where you fell; you kept the rest of your gold and your pack. You wake up in ${town}'s temple. Pick the temple you want to go to.`;
    G.note(s, " " + msg);
    return { msg, bag };
  }
  /* go to the temple you picked (only right after a player killed you) */
  function goTo(s, town) {
    if (!s.pickTemple) return "You can only choose a temple right after you die.";
    if (!temples(s).includes(town) || !where(town)) return "You haven't found that town yet.";
    [s.x, s.y] = where(town); s.location = town; s.pickTemple = false;
    return `You wake up in ${town}'s temple.`;
  }
  function stay(s) { s.pickTemple = false; }
  function pickHTML(s, esc = (x) => x) {
    const list = temples(s);
    return `<h2> Choose a temple</h2><p class="sub">Where do you want to wake up?</p><div class="list">${list.map((n) => `<button class="item btn" data-act="pvptemple" data-id="${esc(n)}"${n === s.location ? ' style="border-color:var(--gold)"' : ""}><div class="t">${esc(n)}${n === s.location ? " (here)" : ""}</div></button>`).join("")}</div>`;
  }
  return { die, goTo, stay, temples, pickHTML };
})();
if (typeof module !== "undefined") module.exports = PVPDEATH;
