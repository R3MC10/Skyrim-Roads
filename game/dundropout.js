/* Dungeon drop-outs [OURS]: someone in a co-op dungeon run closes the game or loses their connection.
   Owner: "when players form a party disconnects or closes the game, everyone should be thrown out of the dungeon to the
   map, in a current party or not. there should be a notification for this and an action to take".
   - Everyone in a run (status "in") sends a tiny "I'm here" beat every few seconds (collection "rbeat", one record per
     player). Closing the tab or the app sends "bye" at once where the system lets us.
   - A member who said bye, or hasn't been heard for GRACE_MS (a short network blip or an app switch is fine), has dropped.
     The first phone to notice writes `ended` on the run: the run is over for everyone in it, party members or not.
   - Every phone in the run then takes its player safely out to the dungeon's entrance: a fight on screen ends as if it
     never started (nobody dies), finds already picked up stay, an expedition's finds aren't dropped, and the party's loot
     pile goes to the usual end-of-run vote (gold split evenly, the one who dropped gets their share when they're back).
   - Notice: "<name> left the game — the run in <dungeon> has ended." Go back in together / Wait for <name> / OK.
     The one who dropped, when they come back: "Your run in <dungeon> ended while you were away." Back to the map /
     Ask the group to go again.
   Solo dungeons have no run and are never touched. Clocks: only this phone's own clock is used for "how long since". */
const DUNDROP = (() => {
  const BEAT_MS = 7000;          // an "I'm here" every 7 s
  const GRACE_MS = 25000;        // not heard for 25 s = dropped (owner: 20-30 s, so a blip or an app switch doesn't end the run)
  const UNKNOWN_MS = 50000;      // a member we never heard (an old app) only counts as gone when their player card is gone too
  const GONE_MS = 20000;         // our save is in a run whose record has been missing this long: that run is gone
  const NOTICE_S = 15 * 60;      // members who weren't inside still get the notice if the run ended this recently (game seconds)
  const COL = "rbeat", beatId = (uid) => "rb-" + uid;
  const act = (run) => (run?.members || []).filter((m) => m && !m.left);
  const isActive = (run, uid) => act(run).some((m) => m.id === uid);
  const watched = (run) => !!run && run.status === "in" && !run.ended;

  // ---------------------------------------------------------------- who has dropped (pure; t = this phone's ms clock)
  function tracker(t = 0) { return { heard: {}, n: {}, bye: {}, since: {}, tick: t }; }
  const key = (run, uid) => run + "|" + uid;
  /* a beat record arrived */
  function hear(tr, doc, t) {
    if (!doc || !doc.uid || !doc.run) return;
    const k = key(doc.run, doc.uid);
    if (doc.bye) { if (tr.n[k] !== doc.n || !(k in tr.heard)) tr.bye[k] = t; tr.n[k] = doc.n; return; }
    if (tr.n[k] !== doc.n || !(k in tr.heard)) { tr.n[k] = doc.n; tr.heard[k] = t; delete tr.bye[k]; }
  }
  /* this phone slept (the app was in the background, the tab was frozen): nobody gets blamed for our own gap */
  function wake(tr, t) {
    if (t - tr.tick > 2 * BEAT_MS) {
      for (const k of Object.keys(tr.heard)) tr.heard[k] = Math.max(tr.heard[k], t);
      for (const k of Object.keys(tr.since)) tr.since[k] = Math.max(tr.since[k], t);
    }
    tr.tick = t;
  }
  /* the members of this run who have dropped, as seen from my phone */
  function dropped(tr, run, me, t, online) {
    if (!watched(run) || !isActive(run, me)) return [];
    if (!(run.id in tr.since)) tr.since[run.id] = t;
    const out = [];
    for (const m of act(run)) {
      if (m.id === me) continue;
      const k = key(run.id, m.id);
      if (tr.bye[k] != null) out.push(m);
      else if (k in tr.heard) { if (t - tr.heard[k] > GRACE_MS) out.push(m); }
      else if (t - tr.since[run.id] > UNKNOWN_MS && !(online && online(m.id))) out.push(m);
    }
    return out;
  }

  // ---------------------------------------------------------------- ending the run (pure; inside Store.change)
  /* drops: [{id, name}]. Everyone is out, the loot pile goes to the usual vote (LV = LOOTVOTE), nothing is lost or doubled.
     Writing it twice (two phones noticed at once) only adds names; the vote is opened once. */
  function endRun(run, drops, by, t, LV) {
    if (!run) return run;
    const ds = { ...(run.ended?.drops || {}) };
    for (const m of drops || []) if (m?.id) ds[m.id] = m.name || ds[m.id] || "Someone";
    if (run.ended) return { ...run, ended: { ...run.ended, drops: ds } };
    const everyone = act(run);
    let out = { ...run, deepMark: null };   // an expedition's finds aren't dropped on the way out: nobody chose to run
    if (LV && everyone.length >= 2 && !out.vote) {
      if (out.chest && !out.chestPooled) out = LV.chestToPool(out);
      const pool = out.pool;
      if (pool && (LV.pileSize(pool) || pool.gold)) {
        const stay = everyone.filter((m) => !ds[m.id]);
        const lead = stay.some((m) => m.id === run.leader) ? run.leader : (stay[0] || everyone[0]).id;
        out.vote = LV.openVote(pool, everyone.map((m) => m.id), lead, t);   // the one who dropped is in it: their share waits for them
      }
    }
    out.members = (run.members || []).map((m) => (m.left ? m : { ...m, left: true }));
    out.invites = [];   // nobody can still accept a way into a run that's over
    out.status = "ended";
    out.ended = { t, by: by || null, place: run.place, drops: ds, group: everyone.map((m) => ({ id: m.id, name: m.name })) };
    return out;
  }
  /* what this player is told */
  function noticeFor(run, me) {
    const e = run?.ended;
    if (!e) return null;
    const drops = e.drops || {}, place = e.place || run.place || "the dungeon";
    if (drops[me]) return { kind: "away", place };
    const ids = Object.keys(drops).filter((id) => id !== me);
    const names = ids.map((id) => drops[id]);
    return { kind: "left", place, ids, names, who: names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join(" and ") || "Someone" };
  }
  /* take a player out of the run's dungeon without losing anything. Returns true when they were inside it. */
  function leaveSafely(s, runId) {
    const d = s?.dungeon;
    if (!d || !d.run || d.run !== runId) return false;
    if (d.deep?.snap && !d.deep.extracted) d.deep.snap = null;   // keep the expedition's finds
    s.lastRun = runId;                                            // the party loot vote still reaches you (lootvote.js)
    if (typeof DUNGEONS !== "undefined") DUNGEONS.leave(s); else s.dungeon = null;
    return true;
  }
  /* "Go back in together": a fresh run at the same door, the old group invited (whoever is offline sees it when back) */
  function againDoc(old, made, me) {
    const group = (old.ended?.group || act(old)).filter((m) => m.id !== me).slice(0, 7);
    return { ...made.doc, again: old.id, invites: group.map((m) => ({ id: m.id, name: m.name })) };
  }

  // ---------------------------------------------------------------- the screens
  /* ctx: { S(), Store, toast, esc, cardOf(id), online(id), persist(pub), closeDungeon(), renderPanel(), coopJoin(id),
            nowMs?(), timers?, onNotice?(n, html) } */
  function mount(ctx) {
    const { S, Store, toast } = ctx;
    const esc = ctx.esc || ((x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
    const nowMs = ctx.nowMs || (() => Date.now());
    const gnow = () => (typeof G !== "undefined" ? G.now() : nowMs() / 1000);
    const tr = tracker(nowMs());
    const sess = Math.random().toString(36).slice(2, 8);
    let runs = [], beats = 0, lastBeat = 0, beatRun = null, ending = false, missing = {}, waitFor = null, lastNotice = null;
    const LV = () => (typeof LOOTVOTE !== "undefined" ? LOOTVOTE : null);
    const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;
    const online = (id) => (ctx.online ? !!ctx.online(id) : !!ctx.cardOf?.(id));
    const myRun = () => { const me = S()?.id; return runs.find((r) => watched(r) && isActive(r, me)) || null; };

    function beat(run, bye = false) {
      const s = S();
      if (!run || !s?.id || !Store.online) return;
      beats++;
      Store.put(COL, beatId(s.id), { run: run.id, uid: s.id, n: `${sess}:${beats}`, ...(bye ? { bye: true } : {}) });
    }
    function bye() { const r = myRun(); if (r) beat(r, true); }
    function onBeats(docs) { const t = nowMs(), me = S()?.id; for (const d of docs || []) if (d && d.uid !== me) hear(tr, d, t); }
    function onRuns(docs) { runs = docs || []; check(); }

    /* every second: beat, look for drops, take me out of a run that ended */
    function tick() {
      const t = nowMs();
      wake(tr, t);
      const s = S();
      if (!s) return;
      const run = myRun();
      if (run && (t - lastBeat >= BEAT_MS || beatRun !== run.id)) { lastBeat = t; beatRun = run.id; beat(run); }
      if (!run && beatRun) { beatRun = null; }
      if (run && !ending && !offline() && Store.online) {
        const ds = dropped(tr, run, s.id, t, online);
        if (ds.length) {
          ending = true;
          Promise.resolve(Store.change("runs", run.id, (x) => (x ? endRun(x, ds.map((m) => ({ id: m.id, name: m.name })), s.id, gnow(), LV()) : x)))
            .catch(() => {}).finally(() => { ending = false; });
        }
      }
      check();
      waitTick();
    }

    /* take me out of a run that has ended (or whose record is gone), and tell me */
    function check() {
      const s = S();
      if (!s) return;
      const d = s.dungeon, t = nowMs();
      if (d?.run) {
        const r = runs.find((x) => x.id === d.run);
        if (r?.ended) return kick(r, noticeFor(r, s.id));
        if (!r && Store.online) {
          missing[d.run] = missing[d.run] || t;
          if (t - missing[d.run] > GONE_MS) { const id = d.run, place = d.place; delete missing[id]; return kick({ id, place, members: [], ended: { place, drops: {} } }, { kind: "away", place }); }
        } else delete missing[d.run];
      }
      // members who weren't inside (still on the way) hear about it too
      for (const r of runs) {
        if (!r.ended || (s.ddSeen || {})[r.id] || gnow() - (r.ended.t || 0) > NOTICE_S) continue;
        if (!(r.ended.group || []).some((m) => m.id === s.id)) continue;
        seen(s, r.id);
        show(r, noticeFor(r, s.id));
      }
    }
    function seen(s, id) {
      s.ddSeen = { ...(s.ddSeen || {}), [id]: gnow() };
      for (const k of Object.keys(s.ddSeen)) if (gnow() - s.ddSeen[k] > 6 * 3600) delete s.ddSeen[k];
    }
    function kick(run, note) {
      if (typeof TB !== "undefined" && TB.open && TB.abort) TB.abort();   // a fight on screen ends as if it never started
      const s = S();
      if (!leaveSafely(s, run.id)) return;
      seen(s, run.id);
      if (beatRun === run.id) { beatRun = null; Store.remove?.(COL, beatId(s.id)); }
      ctx.closeDungeon?.();
      ctx.persist?.(true);
      ctx.renderPanel?.(true);
      show(run, note);
    }

    // -- the notice
    function noticeHTML(run, n) {
      if (!n) return "";
      if (n.kind === "away") return `<div class="ddrop away"><h2> The run is over</h2>
        <p class="ddrop-line">Your run in ${esc(n.place)} ended while you were away.</p>
        <p class="sub">You're back at the entrance with everything you had. Anything the party found is shared out as usual.</p>
        <div class="ddrop-acts"><button class="btn pri" data-dd="ok">Back to the map</button><button class="btn" data-dd="again">Ask the group to go again</button></div></div>`;
      const one = n.names.length === 1;
      return `<div class="ddrop left"><h2> The run is over</h2>
        <p class="ddrop-line">${esc(n.who)} left the game — the run in ${esc(n.place)} has ended.</p>
        <p class="sub">Everyone was brought safely back to the entrance. You keep everything you found, and the party's loot pile is shared out as usual.</p>
        <div class="ddrop-acts"><button class="btn pri" data-dd="again">Go back in together</button><button class="btn" data-dd="wait">${one ? `Wait for ${esc(n.names[0])}` : "Wait for them"}</button><button class="btn" data-dd="ok">OK</button></div></div>`;
    }
    /* its own window on top of everything (the loot vote may open underneath; it's there when this one closes) */
    function show(run, n) {
      if (!n) return;
      lastNotice = { run, n };
      const html = noticeHTML(run, n);
      ctx.onNotice?.(n, html);
      if (typeof document === "undefined") return;
      document.getElementById("ddnote")?.remove();
      const m = document.createElement("div");
      m.className = "modal ddnote"; m.id = "ddnote";
      m.innerHTML = `<div class="sheet ddrop-sheet" role="dialog" aria-modal="true" aria-label="The run is over">${html}</div>`;
      m.addEventListener("click", (e) => { const b = e.target.closest?.("[data-dd]"); if (b) { e.stopPropagation(); doAct(b.dataset.dd); } });
      document.body.appendChild(m);
      m.querySelector("button")?.focus();
    }
    const closeNote = () => { if (typeof document !== "undefined") document.getElementById("ddnote")?.remove(); };
    async function doAct(a) {
      const ln = lastNotice;
      if (a === "stopwait") return stopWait();
      if (a === "waitgo") { const r = waitFor?.run; stopWait(); if (r) await again(r); return; }
      if (!ln) return;
      if (a === "ok") closeNote();
      else if (a === "again") { closeNote(); await again(ln.run); }
      else if (a === "wait") { closeNote(); startWait(ln.run, ln.n); }
    }

    // -- go back in together
    async function again(old) {
      const s = S();
      if (!old || !s) return null;
      if (s.dungeon) { toast("Finish where you are first."); return null; }
      const ex = runs.find((r) => r.again === old.id && !r.ended && r.status !== "ended" && (typeof COOP === "undefined" || COOP.live(r)));
      if (ex) {
        if (isActive(ex, s.id)) { toast(`You're already in the new run of ${ex.place}.`); return ex.id; }
        if (ctx.coopJoin) await ctx.coopJoin(ex.id);
        return ex.id;
      }
      const place = old.ended?.place || old.place;
      if (s.location !== place) { toast(`Go to ${place} first.`); return null; }
      if (typeof COOP === "undefined") return null;
      const made = COOP.newRun(s);
      if (made.err) { toast(made.err); return null; }
      const doc = againDoc(old, made, s.id);
      await Store.put("runs", made.id, doc);
      const off = doc.invites.filter((m) => !online(m.id)).map((m) => m.name);
      toast(off.length ? `A new run of ${place} is open. Everyone from before is invited; ${off.join(", ")} will see it when they're back.` : `A new run of ${place} is open. Everyone from before is invited.`);
      ctx.renderPanel?.(true);
      return made.id;
    }

    // -- wait for them to come back
    function startWait(run, n) {
      const base = {};
      for (const id of n.ids || []) base[id] = ctx.cardOf?.(id)?.updated || 0;
      waitFor = { run, n, base, back: false };
      waitTick();
    }
    function stopWait() { waitFor = null; if (typeof document !== "undefined") document.getElementById("ddwait")?.remove(); }
    const isBack = (id) => { const c = ctx.cardOf?.(id); return !!c && (c.updated || 0) > (waitFor.base[id] || 0) && online(id); };
    function waitTick() {
      if (!waitFor) return;
      const ids = waitFor.n.ids || [], back = ids.length > 0 && ids.every(isBack);
      if (back && !waitFor.back) toast(`${waitFor.n.who} ${ids.length > 1 ? "are" : "is"} back online.`);
      waitFor.back = back;
      if (typeof document === "undefined") return;
      let el = document.getElementById("ddwait");
      if (!el) {
        el = document.createElement("div"); el.id = "ddwait"; el.className = "ddwait"; el.setAttribute("role", "status");
        el.addEventListener("click", (e) => { const b = e.target.closest("[data-dd]"); if (b) doAct(b.dataset.dd); });
        document.body.appendChild(el);
      }
      const html = back
        ? `<span class="t">${esc(waitFor.n.who)} ${ids.length > 1 ? "are" : "is"} back!</span><button class="btn sm pri" data-dd="waitgo">Go back in together</button><button class="btn sm" data-dd="stopwait">Not now</button>`
        : `<span class="t">Waiting for ${esc(waitFor.n.who)} to come back…</span><button class="btn sm" data-dd="stopwait">Stop waiting</button>`;
      if (el.__h !== html) { el.innerHTML = html; el.__h = html; el.classList.toggle("back", back); }
    }

    if (Store.watch) { Store.watch(COL, onBeats); Store.watch("runs", onRuns); }
    if (ctx.timers !== false && typeof setInterval !== "undefined") setInterval(tick, 1000);
    if (typeof addEventListener !== "undefined") {
      addEventListener("pagehide", bye);            // closing the tab, the window or the app: say so at once
      addEventListener("beforeunload", bye);
      addEventListener("pageshow", () => { lastBeat = 0; });   // came back from the page cache: beat again straight away
    }
    mounted = { tick, check, onRuns, onBeats, bye, again, doAct, show, noticeHTML, get waiting() { return waitFor; }, get runs() { return runs; }, tracker: tr };
    return mounted;
  }

  let mounted = null;   // the screens of this game (tests and the browser console)
  return { BEAT_MS, GRACE_MS, UNKNOWN_MS, GONE_MS, COL, beatId, tracker, hear, wake, dropped, endRun, noticeFor, leaveSafely, againDoc, mount, get ui() { return mounted; } };
})();
if (typeof module !== "undefined") module.exports = DUNDROP;
