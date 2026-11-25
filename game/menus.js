/* The menu tabs, SkyUI style: five tabs along the bottom (World, Area, Hero, Journal, Social) and, inside a tab, a
   row of sub-tabs along the top. [tabs5] There used to be seven (Character, Items, Magic, Map, Journal, Social, Area):
   Items, Magic, Skills, Perks and Stats now live under Hero, the map, places and World news under World, Discoveries
   and Achievements under the Journal. Old tab ids (character, items, magic, pack, map...) still work: route() and
   groupOf() send them to their new home, so saved screens, tips, notices and the back button keep working.
   ui.js draws the screens; this file only says what lives where, draws the bars and a few small screens built from
   ui.js's own parts. Nothing here changes game rules. [OURS] */
const MENUS = (() => {
  const live = typeof document !== "undefined" && typeof document.addEventListener === "function";
  const I = {
    world: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    town: '<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>',
    hero: '<circle cx="12" cy="7" r="4"/><path d="M4 21c1-5 5-7 8-7s7 2 8 7"/>',
    log: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    social: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.6 3-5.4 6-5.4s5.4 1.8 6 5.4"/><circle cx="17" cy="9" r="2.4"/><path d="M15.8 13.8c2.6.1 4.4 1.7 4.9 4.6"/>',
  };
  /* [bottom tab id, label, first screen, sub-tabs [screen id, label]]. A sub-tab "@items" / "@magic" opens the SkyUI
     item/spell menu (the same screens as before, now reached from Hero). */
  const GROUPS = [
    ["world", "World", "map", [["map", "Travel"], ["places", "Places"], ["world", "World news"]]],
    ["town", "Area", "town", [["town", "Area"]]],
    ["hero", "Hero", "hero", [["hero", "Character"], ["@items", "Items"], ["@magic", "Magic"], ["stars", "Skills"], ["perks", "Perks"], ["stats", "Stats"], ["follower", "Follower"], ["settings", "Settings"]]],
    ["log", "Journal", "log", [["log", "Quests"], ["library", "Discoveries"], ["ach", "Achievements"], ["diary", "Diary"]]],
    ["social", "Social", "social", [["social", "Social"]]],
  ];
  const HOTKEYS = { world: "M", town: "A", hero: "C", log: "J", social: "O" };   // keyboard: Skyrim-ish letters, shown on the tabs on a PC (I, P and K open Items, Magic and Skills)
  /* old bottom-tab ids (from the seven tabs) and other names → the new bottom tab */
  const OLD = { character: "hero", char: "hero", items: "hero", pack: "hero", magic: "hero", skills: "hero", map: "world", travel: "world", area: "town", journal: "log", quests: "log", friends: "social", locations: "world", news: "world", achievements: "log", discoveries: "log" };
  /* old screen names → the screen to show now ("@items" / "@magic" = open that menu) */
  const SCREEN = { character: "hero", char: "hero", items: "@items", magic: "@magic", skills: "stars", travel: "map", area: "town", journal: "log", quests: "log", friends: "social", locations: "places", news: "world", achievements: "ach", discoveries: "library" };
  /* sub-tabs that wait for an unlock (unlock-by-level, unlocks.js): hidden until then, never greyed out */
  const GATE = { world: "worldevents" };
  const BY = Object.fromEntries(GROUPS.map((g) => [g[0], g]));
  const OWNER = {};
  for (const [id, , , subs] of GROUPS) for (const [s] of subs) OWNER[s] = OWNER[s] || id;
  const last = {};
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ------------------------------------------------------------ pure helpers (tested in node)
  /* is a gated screen open for this hero? (no unlock system or no hero: yes) */
  function opened(S, screen) {
    if (!S || typeof UNLOCKS === "undefined") return true;
    try {
      if (typeof UNLOCKS.tab === "function") return UNLOCKS.tab(S, screen) !== false;   // unlocks.js: Perks, Follower and World news open by level
      const id = GATE[screen]; return !id || typeof UNLOCKS.open !== "function" || UNLOCKS.open(S, id) !== false;
    } catch { return true; }
  }
  /* the sub-tabs this hero can see */
  const subsOf = (g, S) => (BY[g]?.[3] || []).filter(([s]) => opened(S, s));
  /* which bottom tab a screen (or an old tab id) belongs to */
  const groupOf = (tab) => OWNER[tab] || (BY[tab] ? tab : OLD[tab] || (tab === "pack" ? "hero" : "world"));
  /* any tab or screen id, old or new → the screen to show ("@items" / "@magic" = open that menu) */
  function route(id) {
    if (!id) return "map";
    if (SCREEN[id]) return SCREEN[id];
    if (BY[id] && !OWNER[id]) return BY[id][2];   // a bottom-tab id that isn't also a screen
    return id;
  }
  /* the bottom tab to light: an open item/spell menu wins over the screen behind it */
  const activeGroup = (tab, skyPage) => skyPage === "items" || skyPage === "magic" || skyPage === "skills" ? "hero" : groupOf(tab || "map");
  /* tapping a bottom tab: the screen to show. It remembers the last sub-tab, but never an item/spell menu, so Hero
     always brings you back to a Hero screen, also from inside Items or Magic. Old tab ids go to their new tab. */
  function pick(g) {
    const grp = BY[g] || BY[OLD[g]]; if (!grp) return route(g);
    if (g === "pack") return "@items";   // the old Items tab
    if (OLD[g] && SCREEN[g]) return SCREEN[g];   // "items" / "magic" / "char": straight to that screen
    return last[grp[0]] && grp[3].some(([s]) => s === last[grp[0]]) ? last[grp[0]] : grp[2];
  }
  /* the first screen of the tab a screen belongs to (where the back button goes from a sub-tab) */
  const home = (tab) => (BY[groupOf(tab)] || BY.world)[2];
  /* the Hero screens for the compass's Skills page (tabmenu.js): not Items/Magic, those are their own menus */
  const charTabs = () => BY.hero[3].filter(([id]) => id[0] !== "@").map(([id, l]) => [id, l]);
  /* every screen id reachable from the tabs */
  const screens = () => GROUPS.flatMap(([, , , subs]) => subs.map(([s]) => s)).filter((s) => s[0] !== "@");

  // ------------------------------------------------------------ bars (browser)
  /* <html data-t5="world|town|hero|log|social">: the open tab, so the map's cards show only what that screen needs
     (World: the goal and the way there; World news under the map only on the World news screen, and only once it's open) */
  function mark(tab, S) {
    if (!live) return;
    const h = document.documentElement;
    h.dataset.t5 = groupOf(tab);
    h.classList.toggle("t5-news", tab === "world");
    h.classList.toggle("t5-wlock", !opened(S, "world"));
  }
  const fine = () => { try { return live && matchMedia("(pointer:fine)").matches; } catch { return false; } };
  function bar(el, tab, S) {
    if (!el) return false;
    el.classList.add("mn-bar");
    const on = groupOf(tab), keys = fine();   // the keys only in the tooltip on a PC (a phone's long-press shows titles too)
    mark(tab, S);
    el.innerHTML = GROUPS.map(([id, label], n) => `<button class="tab ${id === on ? "on" : ""}" role="tab" aria-selected="${id === on}" data-tab="${id}" aria-label="${label}"${keys ? ` title="${label} (${HOTKEYS[id]} · ${n + 1})"` : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${I[id]}</svg><span class="mn-l">${label}</span>${HOTKEYS[id] ? `<kbd class="hk" aria-hidden="true">${HOTKEYS[id]}</kbd>` : ""}</button>`).join("");
    if (typeof REMIND !== "undefined") { try { REMIND.attach("#tabs [data-tab=social]", "social"); } catch { /* badges are optional */ } }   // remind.js: the  button's badge moves here
    return true;
  }
  /* the sub-tab row at the top of a screen (SkyUI's category strip) */
  function subnav(tab, S) {
    const g = groupOf(tab), subs = subsOf(g, S);
    if (subs.some(([s]) => s === tab)) last[g] = tab;
    if (subs.length < 2) return "";
    if (live && document.body.classList.contains("tw-char")) return "";   // the compass's Skills page has its own bar
    return `<div class="mn-sub" role="tablist" aria-label="${esc(BY[g][1])}">${subs.map(([s, l]) => `<button class="${s === tab ? "on" : ""}" role="tab" aria-selected="${s === tab}" data-act="tabgo" data-id="${s}">${l}</button>`).join("")}</div>`;
  }
  /* after the subnav is drawn, keep the chosen sub-tab in view */
  function afterPanel() {
    if (!live) return;
    for (const on of document.querySelectorAll("#side .mn-sub button.on, #twbar .twbar-t.on")) { const row = on.parentElement; row.scrollLeft = Math.max(0, on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth) / 2); }
    for (const row of document.querySelectorAll("#side .mn-sub, #twbar .twbar-tabs")) edges(row);
  }
  /* a strip wider than the screen fades out at the end(s) that hide more tabs (layout-3) */
  function edges(row) {
    const upd = () => { const m = row.scrollWidth - row.clientWidth; row.classList.toggle("mn-fl", m > 2 && row.scrollLeft > 2); row.classList.toggle("mn-fr", m > 2 && row.scrollLeft < m - 2); };
    if (!row.dataset.mnfade) { row.dataset.mnfade = "1"; row.addEventListener("scroll", upd, { passive: true }); }
    upd();
  }
  /* the SkyUI item/spell menu opened or closed: light its bottom tab, and offer the plain pack list */
  function skyOn(page, el) {
    if (!live) return;
    const g = activeGroup(window.__ui?.tab, page);
    document.querySelectorAll("#tabs .tab").forEach((b) => { const on = b.dataset.tab === g; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    if (el && page === "items" && !el.querySelector(".mn-list")) el.querySelector(".sky-top")?.insertAdjacentHTML("beforeend", '<button class="btn sm mn-list" data-act="tabgo" data-id="pack" aria-label="Show your pack as a plain list">List</button>');
  }

  // ------------------------------------------------------------ screens built from ui.js's parts
  /* x = { S, ach, settings, fest, idPanel, update } from ui.js */
  function panels(x) {
    const S = x.S, idp = x.idPanel || ((id, h) => h);
    return {
      ach: () => x.ach ? x.ach() : "",
      library: () => typeof EXPLORE !== "undefined" ? idp("finds", EXPLORE.panel(S)) : `<div class="panel"><p class="sub">Nothing found yet.</p></div>`,
      world: () => {
        const h = [["rumours", typeof RUMOURS !== "undefined" ? RUMOURS.panel(S) : ""], ["wev", typeof WORLDEV !== "undefined" ? WORLDEV.journal() : ""], ["event", x.fest ? x.fest() : ""]]
          .filter(([, v]) => v && v.trim()).map(([id, v]) => idp(id, v)).join("");
        return `<div class="panel mn-intro"><h2>World news</h2><p class="sub">What's going on in Skyrim: rumours you've heard, your good name in each hold, world events everyone shares, and festivals.</p></div>${h || `<div class="panel"><p class="sub">Nothing is happening right now.</p></div>`}`;
      },
      settings: () => {
        const notesNew = typeof PATCHNOTES !== "undefined" && PATCHNOTES.unseen && PATCHNOTES.unseen();
        return `<div class="panel mn-set"><h2>Settings</h2>${x.settings ? x.settings() : ""}</div>
          <div class="panel"><h2>Help & news</h2><div class="list">
            <button class="btn" data-act="guide" style="width:100%"> Guide for new players</button>
            ${typeof PATCHNOTES !== "undefined" ? `<button class="btn" data-act="notes" style="width:100%;margin-top:8px"> Patch notes${notesNew ? ' <b class="gold">· new</b>' : ""}</button>` : ""}
            <div class="grid2" style="margin-top:8px">${live ? `<button class="btn" data-act="toupdate">${x.update?.newer ? " Update ready" : "Check for updates"}</button>` : ""}<button class="btn" data-act="totitle" ${live ? "" : 'style="grid-column:1/-1"'}>Main menu</button></div></div></div>`;
      },
    };
  }

  // keep --mn-h (the bar's real height) so the item menu stops above it
  if (live) {
    const fit = () => { const t = document.getElementById("tabs"); if (!t || t.classList.contains("hide")) return; const z = parseFloat(getComputedStyle(document.documentElement).zoom) || 1, h = t.getBoundingClientRect().height / z; if (h) document.documentElement.style.setProperty("--mn-h", `${Math.round(h)}px`); };   // rects are on-screen pixels; the page may be zoomed (text size)
    addEventListener("resize", fit);
    if (typeof ResizeObserver !== "undefined") document.addEventListener("DOMContentLoaded", () => { const t = document.getElementById("tabs"); if (t) new ResizeObserver(fit).observe(t); });
    setInterval(fit, 2000);
  }
  return { HOTKEYS, GROUPS, OLD, SCREEN, GATE, opened, subsOf, groupOf, route, home, activeGroup, pick, charTabs, screens, bar, subnav, afterPanel, skyOn, panels };
})();
