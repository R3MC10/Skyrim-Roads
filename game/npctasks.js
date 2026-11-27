/* npctasks.js: every task you take from someone in the world shows in the Journal, trackable like a quest. [OURS]
   Remigiusz: "Side quests that were taken from NPCs should appear in the journal so players can easily track them."
   The story quests (quests.js and friends) already live in the Journal. This file gathers everything else you can
   accept from a person or a board into one list, in one shape:
     - notice-board jobs (towns.js jobsAt/takeJob, placestuff.js jobs at farms and camps: s.jobs)
     - rumour leads from innkeepers, townsfolk and travellers (rumours.js)
     - legendary hunt contracts from a Jarl's steward (leghunt.js)
     - a Daedric prince's contract from a black shrine (bargains.js)
     - the company's caravan escort (commissions.js) and tonight's expedition (expedition.js)
   A source registers a provider: NPCTASKS.register(id, (S) => [entry, ...]). An entry:
     { key, src, title, giver, giverPic(size) -> html, from, objective, text, prog: { have, need } | null,
       due: G.now() seconds | null, reward, place: where to go | null, tab: "active" | "misc",
       abandon: (S) => message | { err } | null, act: { label, run(S) } | null }
   NPCTASKS.list(S) -> all entries; NPCTASKS.track(S, key) / the Journal's ☆ Track sets S.trackQ = "task:<key>" and
   QUESTS.tracked(S) then returns a quest-shaped stand-in, so the compass bar, the map's gold diamond, the HUD objective
   and the "What to do next" card follow a task exactly like a quest.
   NPCTASKS.poll(S) (ui tick): new tasks -> a "Quest added" card with Track; tasks that end on their own -> "Finished"
   (S.taskLog, newest first, the Journal's Completed tab). Tasks are per player: nothing here is shared with the party. */
const NPCTASKS = (() => {
  const SRC = [];
  const LOG_MAX = 40;
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const gi = (n) => (typeof GI !== "undefined" ? GI.ch(n) : "");
  const nowS = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const itemName = (id) => (typeof D !== "undefined" && D.ITEMS[id]?.name) || id;
  const place = (n) => (n && typeof WORLD !== "undefined" ? WORLD.places[n] : null);
  const pic = (who, size) => { try { return who && typeof NPCART !== "undefined" ? NPCART.portrait(who, size) : ""; } catch { return ""; } };
  const whoAt = (town, section) => { try { return typeof NPCART !== "undefined" ? NPCART.who(town, section) : null; } catch { return null; } };
  function register(id, fn) { const i = SRC.findIndex((x) => x.id === id); if (i >= 0) SRC[i] = { id, fn }; else SRC.push({ id, fn }); }
  function list(S) {
    if (!S) return [];
    const out = [];
    for (const { id, fn } of SRC) {
      try { for (const e of fn(S) || []) if (e && e.key) out.push({ src: id, tab: "active", prog: null, due: null, place: null, act: null, abandon: null, ...e }); }
      catch (err) { /* one broken source never hides the others */ }
    }
    return out;
  }
  const find = (S, key) => list(S).find((e) => e.key === key) || null;

  // ---------------------------------------------------------------- sources
  /* notice-board jobs (towns.js) and odd jobs at farms, camps and cabins (placestuff.js): s.jobs */
  register("jobs", (S) => (S.jobs || []).map((j) => {
    const town = j.town, isTown = typeof TOWNS !== "undefined" && TOWNS.isTown(town);
    const who = isTown ? whoAt(town, "notice") : null;
    const giver = who?.name ? `${who.name}${who.title ? `, ${who.title}` : ""}` : isTown ? (place(town)?.[2] === "city" ? "The Jarl's steward" : "A worried local") : `Someone at ${town}`;
    const have = j.type === "gather" ? (S.inv || []).filter((r) => r.item === j.item && !r.stolen).reduce((a, r) => a + r.qty, 0) : 0;
    const title = j.type === "clear" ? `Clear out ${j.target}` : j.type === "deliver" ? `A parcel for ${j.target}` : `${j.n} ${itemName(j.item)}`;
    const objective = j.type === "clear" ? `Clear ${j.target} to its end. You're paid the moment you're back on the road.`
      : j.type === "deliver" ? `Take the parcel to ${j.target}.` : `Bring ${j.n} ${itemName(j.item)} to any town's notice board.`;
    const atBoard = typeof TOWNS !== "undefined" && S.location && TOWNS.isTown(S.location) && !S.trip?.status;
    return {
      key: `job:${j.id}`, title, giver, giverPic: (sz) => pic(who, sz), from: town, objective, text: j.text || "",
      prog: j.type === "gather" ? { have: Math.min(have, j.n), need: j.n } : null,
      reward: `${j.reward} gold`, place: j.type === "gather" ? null : j.target, tab: "active", cat: "Jobs",
      abandon: (s) => TOWNS.dropJob(s, j.id),
      act: j.type === "gather" && atBoard && have >= j.n ? { label: "Hand it in", run: (s) => TOWNS.handIn(s, j.id) } : null,
    };
  }));
  /* rumour leads (rumours.js): something heard over a drink or in the street, that might be true */
  register("rumours", (S) => {
    if (typeof RUMOURS === "undefined") return [];
    return RUMOURS.leads(S).map((r) => {
      const K = RUMOURS.KINDS[r.kind] || {}, inn = r.src === "inn", who = inn ? whoAt(r.town, "inn") : null;
      const giver = inn ? (who?.name ? `${who.name}, the innkeeper` : "The innkeeper") : r.src === "road" ? "Travellers on the road" : "Townsfolk";
      return {
        key: `lead:${r.id}`, title: K.title || "A rumour", giver, giverPic: (sz) => pic(who, sz), from: r.town, objective: `Go to ${r.place} and see if it's true.`,
        text: r.say ? `“${r.say.charAt(0).toUpperCase()}${r.say.slice(1)}”` : "", due: r.until, reward: "Whatever's there, if it's true", place: r.place, tab: "active", cat: "Rumours",
        abandon: (s) => { const st = RUMOURS.st(s); st.list = st.list.filter((x) => x.id !== r.id); return "You put the rumour out of your mind."; },
      };
    });
  });
  /* a legendary hunt contract from a Jarl's steward (leghunt.js) */
  register("hunt", (S) => {
    if (typeof LEGHUNT === "undefined") return [];
    const c = LEGHUNT.cur(S); if (!c) return [];
    const d = LEGHUNT.BY[c.id]; if (!d) return [];
    let near = null; try { near = LEGHUNT.nearPlace(LEGHUNT.area(c)); } catch { /* no area yet */ }
    const clues = c.clues || 0, need = LEGHUNT.NEED, who = whoAt(d.town, "notice");
    return [{
      key: `hunt:${c.id}`, title: `Hunt: ${d.name}`, giver: who?.name ? `${who.name}${who.title ? `, ${who.title}` : ""}` : "The Jarl's steward", giverPic: (sz) => pic(who, sz),
      from: d.town, objective: clues >= need ? `You know where it'll be. Track it down near ${near || "its haunts"}.` : `Find signs of it near ${near || "its haunts"}: tracks, witnesses, victims.`,
      text: d.desc || "", prog: { have: Math.min(clues, need), need }, reward: `${d.gold} gold and its trophy`, place: near, tab: "active", cat: "Contracts",
      abandon: (s) => LEGHUNT.abandon(s),
    }];
  });
  /* a Daedric prince's contract, taken at a black shrine (bargains.js) */
  register("bargain", (S) => {
    if (typeof BARGAIN === "undefined") return [];
    const k = S.bargain?.c; if (!k || !BARGAIN.PR[k.p]) return [];
    const d = BARGAIN.PR[k.p], step = d.steps[k.step]; if (!step) return [];
    return [{
      key: `bargain:${k.p}`, title: d.contract, giver: d.prince, giverPic: () => "", from: "A black shrine on the road", objective: step[0],
      text: d.steps.map(([w], i) => `${i < k.step ? "✓" : i === k.step ? "▸" : "·"} ${w}`).join("  "), prog: { have: Math.min(Math.floor(k.n || 0), step[1]), need: step[1] },
      reward: d.art, place: null, tab: "active", cat: "Contracts", abandon: (s) => BARGAIN.breakIt(s),
    }];
  });
  /* your company's caravan escort (commissions.js) */
  register("escort", (S) => {
    if (typeof COMMISSIONS === "undefined") return [];
    const e = COMMISSIONS.escortOf(S); if (!e) return [];
    return [{ key: `escort:${e.key}`, title: "Escort a caravan", giver: "The innkeeper (company commission)", giverPic: () => "", from: S.cmEsc?.from || "", objective: `Ride with the caravan to ${e.to}.`,
      text: "", due: (e.t || 0) + 86400, reward: "Company pay", place: e.to, tab: "misc", cat: "Company", abandon: (s) => { s.cmEsc = null; return "You leave the caravan to find its own way."; } }];
  });
  /* tonight's company expedition (expedition.js) */
  register("expedition", (S) => {
    if (typeof EXPEDITION === "undefined") return [];
    const x = EXPEDITION.live(S); if (!x) return [];
    const i = EXPEDITION.cur(x), st = x.o.steps[i]; if (i < 0 || !st) return [];
    return [{ key: `exp:${x.key}`, title: EXPEDITION.titleOf(x.o), giver: "The company's planning table", giverPic: () => "", from: x.o.place || "", objective: EXPEDITION.stepText(st),
      text: "", prog: { have: i, need: x.o.steps.length }, due: (x.t || 0) + EXPEDITION.LAST, reward: "Company renown and pay", place: st.place && place(st.place) ? st.place : null,
      tab: "misc", cat: "Company", abandon: (s) => { EXPEDITION.drop(s); return "You step out of tonight's expedition."; } }];
  });

  // ---------------------------------------------------------------- tracking (a quest-shaped stand-in for QUESTS.tracked)
  const TK = "task:";
  function asQuest(e) {
    return { id: TK + e.key, task: true, stage: 0, def: { name: e.title, giver: e.giver },
      st: { title: e.objective, text: e.text || e.objective, obj: e.place && place(e.place) ? { go: e.place } : {} } };
  }
  function trackedTask(S) { const k = S && typeof S.trackQ === "string" && S.trackQ.startsWith(TK) ? S.trackQ.slice(TK.length) : null; return k ? find(S, k) : null; }
  function track(S, key) { S.trackQ = S.trackQ === TK + key ? null : TK + key; return S.trackQ === TK + key; }
  function hook() {
    if (typeof QUESTS === "undefined" || QUESTS._taskHook) return;
    const orig = QUESTS.tracked;
    QUESTS.tracked = (s) => { const e = trackedTask(s); return e ? asQuest(e) : orig(s); };
    QUESTS._taskHook = true;
  }
  hook();

  // ---------------------------------------------------------------- abandon (two taps) and the finished list
  function abandon(S, key) {
    const e = find(S, key); if (!e) return { err: "That task is already over." };
    if (!e.abandon) return { err: "This one can't be given up." };
    const r = e.abandon(S);
    if (r && r.err) return r;
    logEnd(S, e, "abandoned");
    seen(S).delete(key);
    if (S.trackQ === TK + key) S.trackQ = null;
    return { text: (r && r.text) || (typeof r === "string" ? r : "Task given up.") };
  }
  function logEnd(S, e, how) {
    S.taskLog = [{ key: e.key, src: e.src, title: e.title, giver: e.giver, from: e.from || "", how, t: Math.floor(nowS()) }, ...(S.taskLog || []).filter((x) => x.key !== e.key)].slice(0, LOG_MAX);
  }
  /* what we last saw, so new tasks can be announced and ended ones logged */
  function seen(S) {
    if (!(S._taskSeen instanceof Map)) {
      const m = new Map(); for (const x of S.taskSeen || []) m.set(x.key, x);
      Object.defineProperty(S, "_taskSeen", { value: m, enumerable: false, configurable: true, writable: true });
    }
    return S._taskSeen;
  }
  /* -> { added: [entry], ended: [entry] }. The first call on a save only remembers (no toasts for old tasks). */
  function poll(S) {
    if (!S) return { added: [], ended: [] };
    const cur = list(S), m = seen(S), first = !S.taskSeen, added = [], ended = [];
    const keys = new Set(cur.map((e) => e.key));
    for (const e of cur) if (!m.has(e.key)) { m.set(e.key, { key: e.key, src: e.src, title: e.title, giver: e.giver, from: e.from || "" }); if (!first) added.push(e); }
    for (const [k, x] of [...m]) if (!keys.has(k)) { m.delete(k); logEnd(S, x, "done"); ended.push(x); if (S.trackQ === TK + k) S.trackQ = null; }
    S.taskSeen = [...m.values()];
    if (added.length) S.taskNew = [...new Set([...(S.taskNew || []), ...added.map((e) => e.key)])].slice(-20);
    return { added, ended };
  }
  const isNew = (S, key) => (S.taskNew || []).includes(key);
  const markSeen = (S) => { if (S && S.taskNew && S.taskNew.length) S.taskNew = []; };
  const sig = (S) => list(S).map((e) => `${e.key}:${e.prog ? e.prog.have : ""}`).join(",");

  // ---------------------------------------------------------------- the Journal cards
  function fmtLeft(sec) {
    const gs = typeof G !== "undefined" ? G.GAME_SPEED : 12, g = Math.max(0, Math.ceil(sec * gs)), d = Math.floor(g / 86400), h = Math.floor((g % 86400) / 3600), m = Math.floor((g % 3600) / 60);
    return d ? `${d} day${d > 1 ? "s" : ""}${h ? ` ${h} h` : ""}` : h ? `${h} h${m ? ` ${m} min` : ""}` : `${Math.max(1, m)} min`;
  }
  let confirmKey = null;
  function card(S, e, nm = (n) => n) {
    const tracked = S.trackQ === TK + e.key;
    const here = e.place && S.location === e.place;
    const left = e.due ? e.due - nowS() : null;
    const prog = e.prog ? `<span class="tkprog"><span class="tkbar"><i style="width:${Math.round(100 * Math.min(1, e.prog.have / Math.max(1, e.prog.need)))}%"></i></span><b>${e.prog.have}/${e.prog.need}</b></span>` : "";
    const btns = [
      e.act ? `<button class="btn sm pri" data-act="taskact" data-id="${esc(e.key)}">${esc(e.act.label)}</button>` : "",
      e.place && !here && place(e.place) ? `<button class="btn sm ${e.act ? "" : "pri"}" data-act="go" data-place="${esc(e.place)}">Go to ${esc(nm(e.place))}</button>` : "",
      e.place && place(e.place) ? `<button class="btn sm" data-act="qmap" data-place="${esc(e.place)}">Show on map</button>` : "",
      `<button class="btn sm ${tracked ? "on" : ""}" data-act="tasktrack" data-id="${esc(e.key)}" aria-pressed="${tracked}">${tracked ? "★ Tracked" : "☆ Track"}</button>`,
      e.abandon ? `<button class="btn sm tkdrop ${confirmKey === e.key ? "warn" : ""}" data-act="taskdrop" data-id="${esc(e.key)}">${confirmKey === e.key ? "Tap again to give it up" : "Abandon"}</button>` : "",
    ].join("");
    const face = (e.giverPic && e.giverPic(34)) || `<span class="qico tkico" aria-hidden="true">${gi({ jobs: "scroll", rumours: "mug", hunt: "paw", bargain: "skull", escort: "caravan", expedition: "compass" }[e.src] || "scroll")}</span>`;
    return `<div class="qcard qt-side tkcard ${tracked ? "tracked" : ""} ${isNew(S, e.key) ? "tknew" : ""}" id="task-${esc(e.key.replace(/[^\w-]/g, "_"))}">
      <div class="qhead">${face}<div class="t">${esc(e.title)}${tracked ? ' <span class="qtrk">★</span>' : ""}${isNew(S, e.key) ? ' <b class="tknewtag">New</b>' : ""}<span class="qgiver">${esc(e.giver)}${e.from ? ` · ${esc(nm(e.from))}` : ""}</span></div></div>
      <div class="qobj"><b>◆ ${esc(e.objective)}</b>${e.text ? `<p>${esc(e.text)}</p>` : ""}
        <p class="qmeta">${prog}${left != null ? `<span class="tkdue ${left < 600 ? "low" : ""}">${left > 0 ? `${fmtLeft(left)} left` : "Out of time"}</span>` : ""}${e.reward ? `<span class="qrew">Reward: ${esc(e.reward)}</span>` : ""}</p>
        <div class="qbtns">${btns}</div></div></div>`;
  }
  /* the shelf of tasks for one Journal tab ("active" | "misc") */
  function shelf(S, tab, nm) {
    const L = list(S).filter((e) => e.tab === tab);
    if (!L.length) return "";
    if (tab === "misc") return L.map((e) => card(S, e, nm)).join("");
    const cats = [...new Set(L.map((e) => e.cat || "Tasks"))];
    return cats.map((c) => `<h3 class="qcat">${esc(c === "Jobs" ? "Jobs from the notice boards" : c === "Rumours" ? "Rumours to check" : c === "Contracts" ? "Contracts" : c)}</h3>${L.filter((e) => (e.cat || "Tasks") === c).map((e) => card(S, e, nm)).join("")}`).join("");
  }
  function doneShelf(S) {
    const L = (S.taskLog || []).filter((x) => x.how === "done");
    if (!L.length) return "";
    return `<h3 class="qcat">Finished tasks</h3><div class="list">${L.map((x) => `<div class="item tkdone"><span class="qico" aria-hidden="true">${gi("check")}</span><div class="t">${esc(x.title)}<span>${esc(x.giver)}${x.from ? ` · ${esc(x.from)}` : ""}</span></div></div>`).join("")}</div>`;
  }
  const count = (S, tab) => list(S).filter((e) => e.tab === tab).length;

  /* buttons: tasktrack / taskdrop / taskact. ctx: { S, persist, render, toast } -> true when handled */
  function onClick(a, key, ctx) {
    const S = ctx.S;
    if (a === "tasktrack") { const on = track(S, key); confirmKey = null; ctx.persist(); ctx.render(); if (on) ctx.toast("Tracking it: the compass and the map show the way."); return true; }
    if (a === "taskdrop") {
      if (confirmKey !== key) { confirmKey = key; ctx.render(); setTimeout(() => { if (confirmKey === key) { confirmKey = null; ctx.render(); } }, 4000); return true; }
      confirmKey = null;
      const r = abandon(S, key); ctx.persist(); ctx.render(); ctx.toast(r.err || r.text); return true;
    }
    if (a === "taskact") {
      const e = find(S, key); if (!e || !e.act) return true;
      const r = e.act.run(S); ctx.persist(); poll(S); ctx.render(); if (r) ctx.toast(typeof r === "string" ? r : r.err || r.text || ""); return true;
    }
    return false;
  }

  /* "Quest added" card with Track, at the top of the screen for a few seconds */
  function announce(S, e, ctx) {
    if (typeof document === "undefined") return ctx.toast && ctx.toast(`Quest added: ${e.title}`);
    let el = document.getElementById("tkadd");
    if (!el) { el = document.createElement("div"); el.id = "tkadd"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = `<div class="tka-t"><small>Quest added</small><b>${esc(e.title)}</b><span>${esc(e.giver)}</span></div><button class="btn sm pri" data-tk="track">☆ Track</button><button class="btn sm" data-tk="open">Journal</button>`;
    el.className = "show";
    el.onclick = (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      if (b.dataset.tk === "track") { if (!(S.trackQ === TK + e.key)) track(S, e.key); ctx.persist(); ctx.render(); b.textContent = "★ Tracked"; b.disabled = true; }
      if (b.dataset.tk === "open" && ctx.openJournal) ctx.openJournal();
      setTimeout(() => (el.className = ""), 600);
    };
    clearTimeout(announce.t); announce.t = setTimeout(() => (el.className = ""), 6500);
  }
  function tick(ctx) {
    const S = ctx.S; if (!S) return;
    const r = poll(S);
    if (r.added.length) { ctx.persist(); announce(S, r.added[r.added.length - 1], ctx); if (ctx.badge) ctx.badge(); }
    else if (r.ended.length) ctx.persist();
  }

  return { register, list, find, track, trackedTask, asQuest, abandon, poll, sig, isNew, markSeen, card, shelf, doneShelf, count, onClick, announce, tick, fmtLeft, TK };
})();
if (typeof module !== "undefined") module.exports = NPCTASKS;
