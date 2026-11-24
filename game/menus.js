/* The menu tabs, SkyUI style: seven tabs along the bottom (Character, Items, Magic, Map, Journal, Social, Town)
   and, inside a tab, a row of sub-tabs along the top. Everything that used to be scattered (stats, diary,
   achievements, the library, settings, rumours, world events...) has one home here. ui.js draws the screens;
   this file only says what lives where, draws the bars and a few small screens built from ui.js's own parts.
   Nothing here changes game rules. [OURS] */
const MENUS = (() => {
  const live = typeof document !== "undefined" && typeof document.addEventListener === "function";
  const I = {
    hero: '<circle cx="12" cy="7" r="4"/><path d="M4 21c1-5 5-7 8-7s7 2 8 7"/>',
    pack: '<path d="M6 8h12l-1 13H7z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
    magic: '<path d="M12 3c2 3 5 5 5 9a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z"/>',
    map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    log: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    social: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.6 3-5.4 6-5.4s5.4 1.8 6 5.4"/><circle cx="17" cy="9" r="2.4"/><path d="M15.8 13.8c2.6.1 4.4 1.7 4.9 4.6"/>',
    town: '<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>',
  };
  /* [bottom tab id, label, first screen, sub-tabs [screen id, label]]. "pack" and "magic" open the SkyUI item/spell menu. */
  const GROUPS = [
    ["hero", "Character", "hero", [["stars", "Skills"], ["hero", "Character"], ["follower", "Follower"], ["perks", "Perks"], ["stats", "Stats"], ["ach", "Achievements"], ["library", "Library"], ["diary", "Diary"], ["settings", "Settings"]]],
    ["pack", "Items", "@items", [["pack", "Items"]]],
    ["magic", "Magic", "@magic", []],
    ["map", "Map", "map", [["map", "Travel"], ["places", "Locations"], ["world", "World news"]]],
    ["log", "Journal", "log", [["log", "Quests"]]],
    ["social", "Social", "social", [["social", "Social"]]],
    ["town", "Area", "town", [["town", "Area"]]],
  ];
  const HOTKEYS = { hero: "C", pack: "I", magic: "P", map: "M", log: "J", social: "O", town: "A" };   // keyboard: Skyrim-ish letters, shown on the tabs on a PC
  const BY = Object.fromEntries(GROUPS.map((g) => [g[0], g]));
  const OWNER = {};
  for (const [id, , , subs] of GROUPS) for (const [s] of subs) OWNER[s] = OWNER[s] || id;
  const last = {};
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ------------------------------------------------------------ pure helpers (tested in node)
  /* which bottom tab a screen belongs to */
  const groupOf = (tab) => OWNER[tab] || (BY[tab] ? tab : "map");
  /* tapping a bottom tab: the screen to show ("@items"/"@magic" = open that menu). Remembers the last sub-tab. */
  function pick(g) {
    const grp = BY[g]; if (!grp) return g;
    if (grp[2][0] === "@") return grp[2];
    return last[g] && grp[3].some(([s]) => s === last[g]) ? last[g] : grp[2];
  }
  /* the Character sub-tabs, for the compass's Skills page (tabmenu.js) */
  const charTabs = () => BY.hero[3].map(([id, l]) => [id, l]);
  /* every screen id reachable from the tabs */
  const screens = () => GROUPS.flatMap(([, , , subs]) => subs.map(([s]) => s));

  // ------------------------------------------------------------ bars (browser)
  function bar(el, tab) {
    if (!el) return false;
    el.classList.add("mn-bar");
    const on = groupOf(tab);
    el.innerHTML = GROUPS.map(([id, label]) => `<button class="tab ${id === on ? "on" : ""}" role="tab" aria-selected="${id === on}" data-tab="${id}" aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${I[id]}</svg><span class="mn-l">${label}</span>${HOTKEYS[id] ? `<kbd class="hk" aria-hidden="true">${HOTKEYS[id]}</kbd>` : ""}</button>`).join("");
    if (typeof REMIND !== "undefined") { try { REMIND.attach("#tabs [data-tab=social]", "social"); } catch { /* badges are optional */ } }   // remind.js: the  button's badge moves here
    return true;
  }
  /* the sub-tab row at the top of a screen (SkyUI's category strip) */
  function subnav(tab) {
    const g = groupOf(tab), subs = BY[g]?.[3] || [];
    if (subs.some(([s]) => s === tab)) last[g] = tab;
    if (subs.length < 2) return "";
    if (live && document.body.classList.contains("tw-char")) return "";   // the compass's Skills page has its own bar
    return `<div class="mn-sub" role="tablist" aria-label="${esc(BY[g][1])}">${subs.map(([s, l]) => `<button class="${s === tab ? "on" : ""}" role="tab" aria-selected="${s === tab}" data-act="tabgo" data-id="${s}">${l}</button>`).join("")}</div>`;
  }
  /* after the subnav is drawn, keep the chosen sub-tab in view */
  function afterPanel() {
    if (!live) return;
    for (const on of document.querySelectorAll("#side .mn-sub button.on, #twbar .twbar-t.on")) { const row = on.parentElement; row.scrollLeft = Math.max(0, on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth) / 2); }
  }
  /* the SkyUI item/spell menu opened or closed: light its bottom tab, and offer the plain pack list */
  function skyOn(page, el) {
    if (!live) return;
    const g = page === "items" ? "pack" : page === "magic" ? "magic" : page === "skills" ? "hero" : groupOf(window.__ui?.tab || "map");
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
            <div class="grid2" style="margin-top:8px">${live && window.__app ? `<button class="btn" data-act="toupdate">${x.update?.newer ? " Update ready" : "Check for updates"}</button>` : ""}<button class="btn" data-act="totitle" ${live && window.__app ? "" : 'style="grid-column:1/-1"'}>Main menu</button></div></div></div>`;
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
  return { HOTKEYS, GROUPS, groupOf, pick, charTabs, screens, bar, subnav, afterPanel, skyOn, panels };
})();
