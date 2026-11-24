/* Reminders: never miss things that are ready. [OURS]
   - REMIND.list(S) gathers everything that is ready to collect or running out of time, from the systems the game
     already has: house gardens, homestead wings, the bounty board, a caravan you signed on with, market stall gold,
     courier trades, cleared places filling up again, rumour leads, world events, the seasonal festival, the hall
     coffer, a downed horse, level-ups and perk points.
   - A "Today" card (Travel tab) lists them with Go buttons; small number badges sit on the tab buttons.
     Anyone can ask for a tab's count with REMIND.badge(tabId); REMIND.paint() puts the badges on whatever tab buttons
     exist right now (bottom tabs, the 👥 button, the compass), so it doesn't care how the menus are laid out.
   - Phone notifications while the app is closed (app.js asks window.__ui.upcoming(), which adds REMIND.notes()):
     one switch per kind in Settings, and never more than CAP a day.
   Only reads the save and other modules; it never changes game rules. */
const REMIND = (() => {
  const live = typeof document !== "undefined" && typeof document.addEventListener === "function";
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const safe = (fn, d) => { try { return fn(); } catch { return d; } };

  /* kinds of reminder: [label for settings, phone notification on by default] */
  const KINDS = {
    home: ["Garden and homestead goods", true],
    caravan: ["Caravan leaving", true],
    courier: ["Courier trades arriving", true],
    horse: ["Horse back on its feet", true],
    events: ["World events starting", true],
    rumours: ["Rumour leads running out", false],
    places: ["Cleared places full again", false],
  };
  const CAP = 4;                                         // phone reminders a day, at most
  const NOTE_IDS = Array.from({ length: 12 }, (_, i) => 101 + i);
  const SOON_S = 3600;                                   // "coming up" items shown on the card within the next hour
  const REOPEN_WINDOW = 2 * 3600;                        // a cleared place counts as news for 2 hours after it fills up

  const PREFS_KEY = "rotn_prefs", STORE_KEY = "rotn_remind";
  const ls = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; } };
  function pref(k, d) { const L = ls(); if (!L) return d; try { const v = JSON.parse(L.getItem(PREFS_KEY) || "{}")[k]; return v === undefined ? d : v; } catch { return d; } }
  const kindOn = (kind) => pref("rmd_" + kind, KINDS[kind] ? KINDS[kind][1] : false) !== false;
  function load() { const L = ls(); try { const v = JSON.parse((L && L.getItem(STORE_KEY)) || "{}"); return { sched: v.sched || [], log: v.log || [] }; } catch { return { sched: [], log: [] }; } }
  function keep(st) { const L = ls(); try { if (L) L.setItem(STORE_KEY, JSON.stringify(st)); } catch { /* storage blocked */ } }

  function fmt(sec) {
    sec = Math.max(0, sec);
    if (sec < 60) return "under a minute";
    const m = Math.round(sec / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return h < 48 ? `${h} h${r ? ` ${r} min` : ""}` : `${Math.round(h / 24)} days`;
  }

  /* data that only ui.js holds (live trade offers and market stalls) */
  const ctxOf = (ctx) => ctx || safe(() => (typeof window !== "undefined" && window.__ui?.remindData?.()) || {}, {});

  // ------------------------------------------------------------ the list
  /* every reminder for this save. Each: { key, kind, icon, title, sub, state, at, tab, go }
     state: "ready" (do it now), "soon" (ready at `at`), "ending" (running out at `at`, or running with no end shown)
     tab: which button gets the badge (ready items only). go: where the Go button takes you (window.__ui.jump). */
  function list(S, ctx, t = nowS()) {
    if (!S) return [];
    const out = [], c = ctxOf(ctx), here = S.location;
    const add = (o) => out.push(o);
    // where to go: the place's own screen when you're there, otherwise pick it on the map
    const goAt = (place, tab, extra) => (place && place !== here ? { place, ...extra } : { tab, ...extra });
    const tabAt = (place, tab) => (place && place !== here ? "map" : tab);

    // level up and perk points
    safe(() => {
      const pts = typeof PERKS !== "undefined" ? PERKS.pointsLeft(S) : 0;
      if (S.pendingLevels > 0) add({ key: "lvl", kind: "hero", icon: "⬆", title: "You can level up", sub: "Pick Health, Magicka or Stamina.", state: "ready", tab: "hero", go: { tab: "hero" } });
      if (pts > 0) add({ key: "perks", kind: "hero", icon: "★", title: `${pts} perk point${pts > 1 ? "s" : ""} to spend`, sub: "Open your perk trees.", state: "ready", tab: "hero", go: { tab: "hero", menu: "perks" } });
    });

    // house gardens (towns.js): one harvest every in-game day
    safe(() => {
      for (const [town, h] of Object.entries(S.homes || {})) {
        if (!h) continue;
        const name = (typeof TOWNS !== "undefined" && TOWNS.HOMES[town]?.[0]) || town, readyAt = (h.garden || 0) + 7200;
        if (readyAt <= t) add({ key: `garden:${town}`, nk: `garden:${town}:${h.garden || 0}`, kind: "home", icon: "🌿", title: `The garden at ${name} is ripe`, sub: `${town} · harvest it at your house.`, state: "ready", at: readyAt, place: town, tab: tabAt(town, "town"), go: goAt(town, "town", { shop: "home" }) });
        else add({ key: `garden:${town}`, nk: `garden:${town}:${h.garden || 0}`, kind: "home", icon: "🌿", title: `The garden at ${name}`, sub: `${town} · ripe again`, state: "soon", at: readyAt, place: town });
      }
    });

    // homestead wings (homestead.js): goods pile up for a few days, then the extra is lost
    safe(() => {
      if (typeof HOMESTEAD === "undefined") return;
      for (const pid of HOMESTEAD.owned(S)) {
        const P = HOMESTEAD.PLOTS[pid], h = HOMESTEAD.plot(S, pid), rd = HOMESTEAD.ready(S, pid, t), wings = Object.keys(rd);
        if (!P || !h || !wings.length) continue;
        const days = wings.reduce((a, w) => a + rd[w], 0), cap = HOMESTEAD.keepDays(S, pid), full = wings.some((w) => rd[w] >= cap);
        if (days > 0) add({ key: `hs:${pid}`, kind: "home", icon: "🏡", title: `Goods waiting at ${P.name}`, sub: `${P.town} · ${full ? "the wings are full, anything more is lost" : `${days} day${days > 1 ? "s" : ""} of goods from your wings`}`, state: "ready", at: t, place: P.town, tab: tabAt(P.town, "town"), go: goAt(P.town, "town", { shop: "homestead" }) });
        else {
          const nxt = Math.min(...wings.map((w) => (h.col?.[w] || t) + HOMESTEAD.DAY));
          add({ key: `hs:${pid}`, nk: `hs:${pid}:${Math.round(nxt)}`, kind: "home", icon: "🏡", title: `Goods at ${P.name}`, sub: `${P.town} · the wings make more`, state: "soon", at: nxt, place: P.town });
        }
      }
    });

    // horse downed (horses.js): it limps beside you until it gets back up, or a stablehand tends it
    safe(() => {
      if (typeof HORSES === "undefined" || !HORSES.downed(S, t)) return;
      const d = S.horse.down, nm = S.horse.name || "Your horse", town = HORSES.nearestStables([S.x, S.y]);
      add({ key: "horse", nk: `horse:${Math.round(d.until || 0)}`, kind: "horse", icon: "🐎", title: `${nm} is downed`, sub: `Back up in about ${Math.max(1, Math.ceil((d.until - t) / 60))} min · or a stablehand in ${town}`, state: "soon", at: d.until, place: town, tab: tabAt(town, "town"), go: goAt(town, "town", { shop: "stables" }) });
    });

    // caravan you signed on with (caravans.js)
    safe(() => {
      const j = S.caravanJob; if (!j || j.status !== "signed") return;
      const there = here === j.from;
      add({ key: "caravan", nk: `caravan:${j.id}`, kind: "caravan", icon: "🐫", title: `Your caravan leaves ${j.from}`, sub: there ? `${j.name} to ${j.to} · stay in town` : `${j.name} to ${j.to} · be there or it leaves without you`, state: "ending", at: j.depart, place: j.from, tab: there ? null : "map", go: goAt(j.from, "town", { shop: "caravans" }) });
    });

    // courier trades from friends (social.js), and market stall gold (market.js)
    safe(() => {
      for (const d of c.trades || []) {
        if (!d || d.to !== S.id || d.status !== "open") continue;
        const arrived = typeof SOCIAL === "undefined" || SOCIAL.arrived(d, t);
        if (arrived) add({ key: `trade:${d.id}`, kind: "courier", icon: "📦", title: `A trade offer from ${d.fromName || "a friend"}`, sub: "Have a look in 👥 Friends.", state: "ready", at: d.arrive || t, tab: "social", go: { tab: "social", soc: "friends" } });
        else add({ key: `trade:${d.id}`, kind: "courier", icon: "📦", title: `A courier is on the way from ${d.fromName || "a friend"}`, sub: "With a trade offer for you", state: "soon", at: d.arrive });
      }
      const sold = (c.stalls || []).filter((d) => d && d.seller === S.id && d.status === "sold");
      if (sold.length) add({ key: "stall", kind: "market", icon: "🛒", title: `Sold at your stall: ${sold.length} thing${sold.length > 1 ? "s" : ""}`, sub: "The gold comes in on its own.", state: "ready", at: t, tab: "town", go: { tab: "town", shop: "market" } });
    });

    // the bounty board (bounty.js): rewards this week and last week
    safe(() => {
      if (typeof BOUNTY === "undefined") return;
      const w = BOUNTY.week();
      for (const wk of [w, w - 1]) for (const g of BOUNTY.board(wk, S.id)) if (BOUNTY.claimable(S, wk, g.kind))
        add({ key: `bounty:${wk}:${g.kind}`, kind: "board", icon: "📜", title: `Bounty reward: ${g.title}`, sub: `${g.gold} gold waiting on the board.`, state: "ready", tab: "log", go: { tab: "log", jtab: "misc", anchor: "j-bounty" } });
    });

    // the seasonal festival (festivals.js)
    safe(() => {
      if (typeof FEST === "undefined") return;
      const st = FEST.status(S); if (!st || st.done) return;
      if (st.ready) add({ key: `fest:${st.ev.key}`, kind: "board", icon: st.ev.icon, title: `${st.ev.name}: claim your reward`, sub: `${st.ev.reward.gold} gold and the title ${st.ev.reward.title}.`, state: "ready", tab: "log", go: { tab: "log", jtab: "misc", anchor: "j-event" } });
      else add({ key: `fest:${st.ev.key}`, kind: "board", icon: st.ev.icon, title: `${st.ev.name}: ${st.ev.goal.what}`, sub: `${st.n} of ${st.ev.goal.n} so far`, state: "ending", go: { tab: "log", jtab: "misc", anchor: "j-event" } });
    });

    // world events (worldevents.js): running now, rewards waiting, starting soon
    safe(() => {
      if (typeof WORLDEV === "undefined") return;
      const go = { tab: "log", jtab: "misc", anchor: "j-wev" };
      const seen = new Set();
      for (const ev of [...WORLDEV.active(t), ...WORLDEV.recent(t)]) {
        if (seen.has(ev.id)) continue; seen.add(ev.id);
        if (WORLDEV.claimable(S, ev, t)) add({ key: `wev:${ev.id}`, kind: "events", icon: ev.icon, title: `${ev.name}: reward waiting`, sub: "Claim it in the Journal.", state: "ready", tab: "log", go });
        else if (t < ev.end && ev.kind !== "fest") add({ key: `wev:${ev.id}`, kind: "events", icon: ev.icon, title: ev.name, sub: "On now", state: "ending", at: ev.end, place: ev.town || null, go: ev.town ? goAt(ev.town, "log", go) : go });
      }
      for (const ev of WORLDEV.upcoming(t)) if (ev.kind !== "fest" && ev.start - t < 12 * 3600)
        add({ key: `wev:${ev.id}`, nk: `wev:${ev.id}`, kind: "events", icon: ev.icon, title: ev.name, sub: "Starting soon", state: "soon", at: ev.start, place: ev.town || null, go });
    });

    // rumour leads (rumours.js): they fade after a while
    safe(() => {
      if (typeof RUMOURS === "undefined") return;
      for (const r of RUMOURS.leads(S, t)) {
        const K = RUMOURS.KINDS[r.kind] || {};
        add({ key: `lead:${r.id}`, nk: `lead:${r.id}`, kind: "rumours", icon: K.icon || "💬", title: `${K.title || "A rumour"} at ${r.place}`, sub: `Heard in ${r.town || "town"}`, state: "ending", at: r.until, place: r.place, tab: here === r.place ? "map" : null, go: { place: r.place, tab: "map" } });
      }
    });

    // cleared places filling up again (dungeons.js)
    safe(() => {
      if (typeof DUNGEONS === "undefined") return;
      for (const [name, when] of Object.entries(S.cleared || {})) {
        const at = when + DUNGEONS.REFILL_SECONDS;
        if (at <= t && t - at < REOPEN_WINDOW) add({ key: `place:${name}`, nk: `place:${name}:${Math.round(at)}`, kind: "places", icon: "⚔", title: `${name} is full of foes again`, sub: "New foes and new loot.", state: "ready", at, place: name, go: { place: name, tab: "map" } });
        else if (at > t && at - t < SOON_S) add({ key: `place:${name}`, nk: `place:${name}:${Math.round(at)}`, kind: "places", icon: "⚔", title: name, sub: "Fills up again", state: "soon", at, place: name, go: { place: name, tab: "map" } });
      }
    });

    // your hall's coffer (halls.js): staff leave when it can't pay them
    safe(() => {
      const h = S.hall; if (!h || typeof HALLS === "undefined") return;
      const w = HALLS.wages(h); if (!(w > 0) || (h.coffer || 0) >= w * 2) return;
      add({ key: "coffer", kind: "hall", icon: "🏰", title: (h.coffer || 0) < w ? "Your hall can't pay its staff" : "Your hall's coffer is nearly empty", sub: `${h.coffer || 0} gold left, wages are ${w} a day. Unpaid staff leave.`, state: "ready", place: h.town, tab: tabAt(h.town, "town"), go: goAt(h.town, "town", { shop: "halls" }) });
    });

    const rank = { ready: 0, ending: 1, soon: 2 };
    return out.sort((a, b) => rank[a.state] - rank[b.state] || (a.at ?? 9e15) - (b.at ?? 9e15));
  }

  /* what the Today card shows: everything ready or ending, and "soon" things in the next hour */
  const shown = (S, ctx, t = nowS()) => list(S, ctx, t).filter((x) => x.state !== "soon" || x.at - t <= SOON_S);
  /* a tab's number badge: how many ready things you'd handle from that tab */
  function badge(tabId, S, ctx) {
    S = S || safe(() => window.__dbg?.save?.(), null);
    if (!S) return 0;
    const ids = { char: "hero", skills: "hero", items: "pack", journal: "log" };
    const id = ids[tabId] || tabId;
    return list(S, ctx).filter((x) => x.state !== "soon" && x.tab === id).length;
  }
  const counts = (S, ctx) => { const o = {}; for (const x of list(S, ctx)) if (x.state !== "soon" && x.tab) o[x.tab] = (o[x.tab] || 0) + 1; return o; };

  // ------------------------------------------------------------ the Today card
  let showAll = false, lastItems = [];
  function when(x, t) {
    if (x.state === "ready") return x.at && t - x.at > 120 && t - x.at < 86400 ? `ready ${fmt(t - x.at)} ago` : x.at && t - x.at >= 86400 ? "ready" : "ready now";
    if (x.state === "soon") return `in ${fmt(x.at - t)}`;
    return x.at ? `${fmt(x.at - t)} left` : "on now";
  }
  function card(S, ctx) {
    if (!S || S.dungeon) return "";
    const t = nowS(), items = shown(S, ctx, t);
    lastItems = items;
    if (!items.length) return "";
    const ready = items.filter((x) => x.state === "ready").length, max = 5;
    const rows = (showAll ? items : items.slice(0, max)).map((x, i) => `<div class="item rmd-row rmd-${x.state}"><span class="rmd-i" aria-hidden="true">${esc(x.icon)}</span>
      <div class="t">${esc(x.title)}<span>${esc(x.sub)} · <b class="rmd-when">${esc(when(x, t))}</b></span></div>${x.go ? `<button class="btn sm ${x.state === "ready" ? "pri" : ""}" data-rmd="go" data-i="${i}" aria-label="Go: ${esc(x.title)}">Go</button>` : ""}</div>`).join("");
    const more = items.length > max ? `<button class="linkbtn rmd-more" data-rmd="more">${showAll ? "Show less" : `Show all ${items.length}`}</button>` : "";
    return `<div class="panel rmd-card" id="rmd-card"><h2>Today${ready ? ` <b class="rmd-n">${ready} ready</b>` : ""}</h2><div class="list">${rows}</div>${more}</div>`;
  }
  /* the same rows, for a card drawn elsewhere (mappanel.js merges them into "What to do next"): each { x, html }.
     Their Go buttons keep working through this file's click handler. */
  function items(S, ctx) {
    if (!S || S.dungeon) return [];
    const t = nowS(); lastItems = shown(S, ctx, t);
    return lastItems.map((x, i) => ({ x, html: `<div class="item nx rmd-row rmd-${x.state}"><span class="nx-i rmd-i" aria-hidden="true">${esc(x.icon)}</span>
      <div class="t">${esc(x.title)}<span>${esc(x.sub)} · <b class="rmd-when">${esc(when(x, t))}</b></span></div>${x.go ? `<button class="btn sm ${x.state === "ready" ? "pri" : ""}" data-rmd="go" data-i="${i}" aria-label="Go: ${esc(x.title)}">Go</button>` : ""}</div>` }));
  }
  function onClick(e) {
    const b = e.target.closest?.("[data-rmd]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const ui = window.__ui;
    if (b.dataset.rmd === "more") { showAll = !showAll; ui?.refresh?.(); return; }
    const x = lastItems[+b.dataset.i]; if (!x || !x.go) return;
    if (typeof SOUND !== "undefined") SOUND.fx("click");
    if (ui?.jump) ui.jump(x.go); else if (ui?.go) ui.go(x.go.tab || "map");
  }

  // ------------------------------------------------------------ badges on menu buttons
  /* buttons to badge: [selector, tab id]. Other helpers can add more with REMIND.attach(selector, tabId). */
  const TARGETS = [["#tabs [data-tab=hero]", "hero"], ["#tabs [data-tab=town]", "town"], ["#tabs [data-tab=log]", "log"], ["#tabs [data-tab=map]", "map"], ["#socBtn", "social"], ["[data-twgo=char]", "hero"]];
  const attach = (sel, tabId) => { if (!TARGETS.some(([s]) => s === sel)) TARGETS.push([sel, tabId]); paint(); };
  function paint(S) {
    if (!live) return;
    S = S || safe(() => window.__dbg?.save?.(), null);
    const n = S ? safe(() => counts(S), {}) : {};
    for (const [sel, id] of TARGETS) {
      let els = []; try { els = document.querySelectorAll(sel); } catch { continue; }
      for (const el of els) {
        const k = n[id] || 0; let b = el.querySelector(":scope > .rmd-b");
        if (!k) { if (b) b.remove(); continue; }
        if (!b) { b = document.createElement("span"); b.className = "rmd-b"; el.appendChild(b); }
        const txt = k > 9 ? "9+" : String(k), html = `${txt}<span class="rmd-sr"> ready</span>`;
        if (b.dataset.n !== txt) { b.dataset.n = txt; b.innerHTML = html; }
      }
    }
  }

  // ------------------------------------------------------------ phone notifications
  const PRIO = ["caravan", "courier", "horse", "home", "events", "places", "rumours"];
  const SPACED = ["home", "places", "events", "rumours"], SPACE_MS = 2 * 3600e3;   // one of these kinds per 2 hours
  const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  let resumedAt = Date.now();
  /* the reminders worth a notification while the app is closed, capped per day (times in ms) */
  function notes(S, nowMs = Date.now(), ctx) {
    if (!S) return [];
    const st = load(), t = nowMs / 1000;
    // what we scheduled last time and that went off before the app came back counts as sent
    for (const e of st.sched) if (e.at <= resumedAt && e.at > (e.made || 0)) st.log.push({ k: e.k, at: e.at });
    st.log = st.log.filter((e) => e.at > nowMs - 3 * 864e5);
    st.sched = [];
    const sent = new Set(st.log.map((e) => e.k)), perDay = {};
    for (const e of st.log) perDay[dayKey(e.at)] = (perDay[dayKey(e.at)] || 0) + 1;
    const cand = [];
    for (const x of list(S, ctx, t)) {
      if (!KINDS[x.kind] || !kindOn(x.kind) || !x.at) continue;
      const k = x.nk || x.key;
      let at = 0, title = "", body = "";
      if (x.state === "soon") {
        at = x.at * 1000;
        if (x.kind === "home") { title = `${x.icon} ${x.title.replace(/^Goods at/, "Goods ready at")}${/garden/.test(x.key) ? " is ripe" : ""}`; body = `${x.place} · tap to go and collect.`; }
        else if (x.kind === "horse") { title = `🐎 ${(S.horse?.name) || "Your horse"} is back on their feet`; body = "Ready to ride again."; }
        else if (x.kind === "courier") { title = "📦 A courier is here"; body = x.title.replace(/^A courier is on the way from/, "A trade offer from") + "."; }
        else if (x.kind === "events") { if (/^wev:kc-/.test(x.key)) continue; title = `${x.icon} ${x.title}`; body = "Starting now. Every player can join in."; }
        else if (x.kind === "places") { title = `⚔ ${x.title} is full again`; body = "New foes and new loot."; }
        else continue;
      } else if (x.state === "ending") {
        if (x.kind === "caravan") { at = (x.at - 10 * 60) * 1000; title = `🐫 ${x.title} in 10 minutes`; body = "Be in town or it goes without you."; }
        else if (x.kind === "rumours") { at = (x.at - 30 * 60) * 1000; title = `${x.icon} ${x.title}`; body = "This lead goes cold in half an hour."; }
        else continue;
      } else continue;
      if (at <= nowMs + 60000 || sent.has(k)) continue;
      cand.push({ k, kind: x.kind, at, title, body });
    }
    // the most time-critical kinds win the daily places; gardens and the like ready close together share one
    cand.sort((a, b) => PRIO.indexOf(a.kind) - PRIO.indexOf(b.kind) || a.at - b.at);
    const out = [];
    for (const c of cand) {
      if (out.length >= NOTE_IDS.length) break;
      const dk = dayKey(c.at); if ((perDay[dk] || 0) >= CAP) continue;
      if (out.some((o) => o.k === c.k)) continue;
      if (SPACED.includes(c.kind) && out.some((o) => o.kind === c.kind && Math.abs(o.at - c.at) < SPACE_MS)) continue;
      perDay[dk] = (perDay[dk] || 0) + 1;
      out.push(c);
    }
    out.sort((a, b) => a.at - b.at).forEach((o, i) => { o.id = NOTE_IDS[i]; });
    st.sched = out.map((o) => ({ k: o.k, at: o.at, made: nowMs }));
    keep(st);
    return out.map(({ id, at, title, body }) => ({ id, at, title, body }));
  }
  /* tests: pretend the app came back at this time */
  const resumed = (ms = Date.now()) => { resumedAt = ms; };

  /* settings rows (the Phone section) */
  function settingsHTML(seg) {
    return `<details class="rmd-set"><summary>Reminders <small>(at most ${CAP} a day)</small></summary>${Object.entries(KINDS).map(([k, [label]]) => `<div class="setrow"><span>${esc(label)}</span>${seg("rmd_" + k, [[true, "On"], [false, "Off"]], kindOn(k))}</div>`).join("")}</details>`;
  }

  if (live) {
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { resumedAt = Date.now(); paint(); } });
    setInterval(() => { if (!document.hidden) paint(); }, 4000);
  }
  return { KINDS, CAP, NOTE_IDS, list, shown, badge, counts, card, items, paint, attach, notes, resumed, settingsHTML, fmt, kindOn };
})();
