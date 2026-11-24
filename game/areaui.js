/* areaui.js: the Area tab laid out like a place. [OURS]
   Instead of one long scroll (every place's buttons, then the first shop's whole stock), the Area tab opens on a
   board of small tiles grouped the way a town is: Inn, Market, Services & trainers, Work & jobs, Your home, Events & fun.
   Each tile says in a few words what's there right now (open/closed, jobs taken, garden ripe...). Things that are
   ready for you in this town sit on top under "Right now". Tap a tile to open that place; a back button and a row
   of its neighbours (same group) keep everything one tap away. Long how-it-works notes fold into "More".
   ui.js still draws every place's insides; this file only sorts and frames them. Nothing here changes game rules.
   Sections added by other modules (homesteads, Solstheim, world events...) land in a group by id, or in Events & fun. */
const AREAUI = (() => {
  const live = typeof document !== "undefined" && typeof document.addEventListener === "function";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safe = (fn, d) => { try { return fn(); } catch { return d; } };

  /* [group id, label, section ids in the order they show] — the most used places first in each group */
  const GROUPS = [
    ["inn", "Inn", ["inn", "cook", "hire"]],
    ["market", "Market", ["general", "blacksmith", "wizard", "market", "stables", "fence"]],
    ["services", "Services & trainers", ["train", "forge", "alchemy", "enchanter", "craft", "carriage", "docks"]],
    ["work", "Work & jobs", ["jobs", "notice", "caravans", "mine", "streets"]],
    ["home", "Your home", ["home", "homestead", "homes", "halls", "hall"]],
    ["events", "Events & fun", ["arena", "fish", "hunt"]],
  ];
  const GROUP_OF = {};
  for (const [g, , ids] of GROUPS) for (const id of ids) GROUP_OF[id] = g;
  const ICON = { inn: "\uE15A", cook: "\uE148", hire: "\uE102", general: "\uE197", blacksmith: "\uE14E", wizard: "\uE15D", market: "\uE133", stables: "\uE12D", fence: "\uE134", train: "\uE109", forge: "\uE104", alchemy: "\uE15B", enchanter: "\uE10A",
    craft: "\uE15C", carriage: "\uE13B", docks: "\uE12F", jobs: "\uE103", notice: "\uE103", caravans: "\uE13B", mine: "\uE12A", streets: "\uE119", home: "\uE11D", homestead: "\uE17A", homes: "\uE11C", halls: "\uE119", hall: "⚑", arena: "\uE101", fish: "\uE146", hunt: "\uE10C" };
  /* short tile names where the screen's own name is long */
  const SHORT = { fence: "Fence", hire: "Hirelings", wizard: "Court wizard", general: "General goods", cook: "Cooking pot", craft: "Spell crafting", homes: "Neighbours", hall: "Hall of the North", halls: "Halls & shops", notice: "Jarl's bounty", market: "Market stalls" };
  /* a few words when there's no live status */
  const TAG = { inn: "Sleep, rumours", cook: "Meals that buff", hire: "Fight beside you", general: "Food, potions, kit", blacksmith: "Weapons, armor, metal", wizard: "Tomes, staffs, soul gems",
    market: "Players' stalls", stables: "Horses and carts", fence: "Buys stolen goods", train: "Raise a skill", forge: "Make, smelt, improve", alchemy: "Brew potions", enchanter: "Enchant gear",
    craft: "Your own spells", carriage: "Safe, fast rides", docks: "Boats", jobs: "Small paid work", notice: "This week's goals", caravans: "Guard for pay", mine: "Dig ore", streets: "Pickpocket, bounty",
    home: "Your house", homestead: "Build your own", homes: "Players' houses", halls: "Build a hall", hall: "Everyone builds it", arena: "Duel for a stake", fish: "Cast a line", hunt: "Stalk deer and elk" };
  const DEFAULT_OPEN = { inn: true, market: true, services: true, work: true, home: true, events: true };

  // ------------------------------------------------------------ pure helpers (tested in node)
  /* sections of this town → [[group id, label, [ids]]]; anything unknown goes to the last group */
  function group(sections) {
    const list = [...new Set(sections)], out = GROUPS.map(([g, label, ids]) => [g, label, ids.filter((id) => list.includes(id))]);
    const known = new Set(GROUPS.flatMap(([, , ids]) => ids));
    const rest = list.filter((id) => !known.has(id));
    out[out.length - 1][2].push(...rest);
    return out.filter(([, , ids]) => ids.length);
  }
  const groupOf = (id) => GROUP_OF[id] || "events";
  /* the other places in the same group (for the row under a place's header) */
  function siblings(sections, id) { const g = group(sections).find(([, , ids]) => ids.includes(id)); return g ? g[2] : [id]; }
  /* a tile's name without the emoji some screen names start with */
  const plain = (name) => String(name || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const label = (id, names) => SHORT[id] && plain(names[id]).length > 18 ? SHORT[id] : plain(names[id]) || SHORT[id] || id;
  /* a long how-it-works note: the first sentence shows, the rest folds into "More" (plain text only) */
  function note(txt) {
    if (!txt) return "";
    const s = String(txt);
    if (s.length < 120 || /</.test(s)) return `<p class="sub au-note">${s}</p>`;
    const m = s.match(/^(.+?[.!?])\s+(.+)$/s);
    if (!m) return `<p class="sub au-note">${s}</p>`;
    return `<details class="au-more"><summary class="sub au-note">${m[1]} <span class="au-mt">More</span></summary><p class="sub">${m[2]}</p></details>`;
  }

  // ------------------------------------------------------------ live bits (each one safe on its own)
  /* a few words on what's going on at a place right now: { text, hot } (hot = worth a look) */
  function status(S, l, id, o = {}) {
    const r = safe(() => {
      const open = o.open !== false;
      switch (id) {
        case "general": case "blacksmith": case "wizard": case "fence": return { text: open ? (G.shopsOpen() ? "Open" : "Night prices") : "Closed till 08:00", dim: !open };
        case "inn": return { text: `Room ${TOWNS.roomPrice(S)} gold` };
        case "hire": return S.follower ? { text: "You have a follower" } : null;
        case "train": { const n = 5 - TOWNS.trainedThisLevel(S); return { text: n > 0 ? `${n} lesson${n > 1 ? "s" : ""} left` : "None left this level", dim: n <= 0 }; }
        case "jobs": { const mine = (S.jobs || []), ready = mine.filter((j) => j.type === "gather" && TOWNS.countItem(S, j.item) >= j.n).length;
          return ready ? { text: `${ready} to hand in`, hot: true } : { text: `${mine.length} of 3 taken` }; }
        case "home": { const h = TOWNS.home(S, l); if (!h) return { text: `For sale · ${TOWNS.HOMES[l][1]} gold` };
          return TOWNS.gardenReady(S) ? { text: "Garden ripe", hot: true } : { text: "Your house" }; }
        case "stables": return S.horse ? (typeof HORSES !== "undefined" && HORSES.downed(S) ? { text: "Horse downed", warn: true } : { text: S.horse.name || "Your horse" }) : null;
        case "streets": { const b = TOWNS.bounty(S, o.hold); return b ? { text: `Bounty ${b} gold`, warn: true } : null; }
        default: return null;
      }
    }, null);
    return r || { text: TAG[id] || "" };
  }
  /* reminders (remind.js) that point at a place in this town */
  function readyHere(S, l, sections) {
    if (typeof REMIND === "undefined") return [];
    return safe(() => REMIND.list(S).filter((x) => x.state !== "soon" && x.go && x.go.shop && sections.includes(x.go.shop) && (!x.place || x.place === l)), []);
  }

  // ------------------------------------------------------------ the board
  function fold() { try { return { ...DEFAULT_OPEN, ...JSON.parse(localStorage.getItem("ux_aufold") || "{}") }; } catch { return { ...DEFAULT_OPEN }; } }
  /* o = { S, l, sections, names, open, hold } */
  function hub(o) {
    const { S, l, sections, names } = o, f = fold();
    const ready = readyHere(S, l, sections), hotShop = new Set(ready.map((x) => x.go.shop));
    const tile = (id) => { const st = status(S, l, id, o), hot = st.hot || hotShop.has(id);
      return `<button class="au-tile${hot ? " hot" : ""}${st.dim ? " dim" : ""}${st.warn ? " warn" : ""}" data-act="shop" data-id="${esc(id)}" aria-label="${esc(label(id, names))}"><span class="au-ic" aria-hidden="true">${ICON[id] || "•"}</span><b>${esc(label(id, names))}</b><small>${esc(st.text)}</small>${hot ? '<i class="au-dot" aria-hidden="true"></i>' : ""}</button>`; };
    const now = ready.slice(0, 4).map((x) => `<button class="au-now${x.state === "ready" ? " hot" : ""}" data-act="shop" data-id="${esc(x.go.shop)}"><span aria-hidden="true">${esc(x.icon)}</span><span class="t"><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span><span class="au-go">Open</span></button>`).join("");
    const groups = group(sections).map(([g, lab, ids]) => `<details class="au-g" data-g="${g}" ${f[g] ? "open" : ""}><summary><span class="au-gh">${esc(lab)}</span><span class="au-gn">${ids.length}</span></summary><div class="au-tiles">${ids.map(tile).join("")}</div></details>`).join("");
    return `<div class="au">${now ? `<div class="au-nowl"><div class="au-gh">Right now</div>${now}</div>` : ""}${groups}</div>`;
  }
  /* the strip on top of an open place: back to the board, its name and what it's for, and its neighbours */
  function head(o) {
    const { l, sections, names, cur, desc } = o, sibs = siblings(sections, cur);
    const lab = GROUPS.find(([g]) => g === groupOf(cur))?.[1] || "";
    return `<div class="au-head"><button class="btn sm au-back" data-act="areahub" aria-label="Back to all of ${esc(l)}">‹ ${esc(l)}</button><div class="au-ht"><small>${esc(lab)}</small><b class="au-name" role="button" tabindex="0" data-act="shop" data-id="${esc(cur)}">${ICON[cur] ? `<span aria-hidden="true">${ICON[cur]}</span> ` : ""}${esc(plain(names[cur]))}</b></div></div>
      ${sibs.length > 1 ? `<div class="au-sibs" role="tablist">${sibs.map((id) => `<button class="${id === cur ? "on" : ""}" role="tab" aria-selected="${id === cur}" data-act="shop" data-id="${esc(id)}">${esc(label(id, names))}</button>`).join("")}</div>` : ""}
      ${desc ? `<p class="tg-desc">${esc(desc)}</p>` : ""}`;
  }

  if (live) document.addEventListener("toggle", (e) => {
    const d = e.target; if (!d || !d.classList || !d.classList.contains("au-g")) return;
    const f = fold(); f[d.dataset.g] = d.open; try { localStorage.setItem("ux_aufold", JSON.stringify(f)); } catch { /* storage blocked */ }
  }, true);

  return { GROUPS, ICON, group, groupOf, siblings, plain, label, note, status, hub, head };
})();
if (typeof module !== "undefined") module.exports = AREAUI;
