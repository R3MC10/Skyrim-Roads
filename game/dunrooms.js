/* Painted dungeon rooms: the big picture above a room's text shows a painting of that kind of room in this kind of
   dungeon (room-<type>-<theme>.webp, 1600×900, see assets.js). Adding a theme is a file drop: when a picture is missing
   the room borrows the closest theme's painting of the same type, then a related type, and only then falls back to the
   old drawing (PLACEART.room). While a painting is still on its way a dark 16:9 frame holds its place, so the screen
   doesn't jump. [OURS] */
const DUNROOMS = (() => {
  const TYPES = ["fight", "elite", "trap", "treasure", "puzzle", "rest", "boss", "mystery"];
  // closest themes first (the theme itself leads)
  const NEAR = {
    cave: ["cave", "mine", "forsworn", "barrow"], mine: ["mine", "cave", "banditcamp"], barrow: ["barrow", "temple", "cave"],
    temple: ["temple", "barrow", "cave"], dwemer: ["dwemer", "cave"], forsworn: ["forsworn", "cave", "mine"],
    vampire: ["vampire", "barrow", "temple", "cave"], fort: ["fort", "banditcamp", "barrow", "cave"], banditcamp: ["banditcamp", "fort", "mine", "cave"],
    thalmor: ["thalmor", "fort", "temple", "barrow"], giantcamp: ["giantcamp"], lair: ["lair"],   // outdoor fights: never a cave painting
  };
  // a room type with no painting anywhere nearby borrows a related one
  const KIN = { fight: ["fight"], elite: ["elite", "fight"], boss: ["boss", "elite"], trap: ["trap"], treasure: ["treasure"], puzzle: ["puzzle"], rest: ["rest"], mystery: ["mystery", "fight"] };
  const has = () => typeof ASSETS !== "undefined" && !!ASSETS.state;
  /* every picture key to try, best first */
  function candidates(type, theme) {
    const themes = NEAR[theme] || [theme, "cave"], out = [];
    for (const ty of KIN[type] || [type]) for (const th of themes) out.push(`room-${ty}-${th}`);
    return [...new Set(out)];
  }
  /* { key, img } for the first painting that loaded, { wait: true } while one ahead of it is still loading, or null */
  function pick(type, theme) {
    if (!has()) return null;
    for (const k of candidates(type, theme)) {
      const st = ASSETS.state(k);
      if (st === "ok") return { key: k, url: ASSETS.url(k) };
      if (st === "loading") return { wait: true };
    }
    return null;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const label = (type) => (typeof DUNGEONS !== "undefined" && DUNGEONS.LABEL[type]) || type;
  function inner(type, theme) {
    const p = pick(type, theme);
    if (p?.url) return `<img class="droompic" src="${esc(p.url)}" alt="${esc(label(type))}" data-key="${esc(p.key)}" decoding="async">`;
    if (p?.wait) return `<div class="droomwait" aria-hidden="true"></div>`;
    return typeof PLACEART !== "undefined" ? PLACEART.room(type) : "";
  }
  /* the room picture, as HTML */
  function room(type, theme) {
    const p = pick(type, theme), cls = p?.url ? "painted" : p?.wait ? "waiting" : "drawn";
    return `<div class="droomart ${cls}" data-type="${esc(type)}" data-theme="${esc(theme || "")}">${inner(type, theme)}</div>`;
  }
  /* swap a waiting frame for the painting (or the drawing) once the file has arrived or turned out missing */
  let timer = 0, tries = 0;
  function update() {
    clearTimeout(timer); timer = 0;
    if (typeof document === "undefined") return;
    let waiting = false;
    for (const el of document.querySelectorAll(".droomart.waiting")) {
      const p = pick(el.dataset.type, el.dataset.theme);
      if (p?.wait) { waiting = true; continue; }
      el.classList.remove("waiting"); el.classList.add(p?.url ? "painted" : "drawn"); el.innerHTML = inner(el.dataset.type, el.dataset.theme);
    }
    if (waiting && tries++ < 60) timer = setTimeout(update, 250);
  }
  /* ask for the paintings of the rooms you can walk into next, so they're ready when you get there */
  function warm(d) {
    if (!d || !has() || typeof DUNGEONS === "undefined") return;
    const row = d.rows?.[d.row + 1]; if (!row) return;
    for (const c of DUNGEONS.nextChoices({ dungeon: d })) { const n = row[c]; if (n) pick(n.type, d.theme); }
  }
  function after() { tries = 0; update(); }
  if (has()) ASSETS.on(update);
  return { TYPES, NEAR, KIN, candidates, pick, room, warm, after, update };
})();
