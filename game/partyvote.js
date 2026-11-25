/* Party votes in dungeons (Roads of the North).
   In a party dungeon run (2+ heroes) every choice is a vote: which way to go at a fork, and what to do in a room
   (fight, sneak past, run, pick the lock, rest, read the book, set the puzzle...). Solo play is unchanged.
   - Everyone in the run taps an option. Their small round portrait pops up next to the option they picked, live on every
     phone. You can change your vote until it closes.
   - It closes when everyone who is online has voted, or when the timer (20 s) runs out; people who didn't vote don't count.
     If nobody has voted when time is up, the first vote decides. The leader also has "Decide now".
   - Majority wins; on a tie the leader's vote decides (if the leader voted for none of the tied options, the first of
     them in the list wins). Disconnected players never block the vote.
   - Only the leader's phone settles it: it writes the result onto the run record with a sequence number (run.pvSeq) and
     then carries the choice out the usual way (coop.js / lootvote.js replay it on everyone's phone). Each phone applies a
     result once (it remembers the last sequence number it saw), so everyone ends up with the same pick.
   - Drinking a healing potion stays your own business: it's never put to a vote.
   Pure logic up top (node-testable); PARTYVOTE.ui(ctx) wires it into the dungeon screen. The vote lives on the run as run.pv. */
const PARTYVOTE = (() => {
  const VOTE_SECONDS = 20, MAX_HEROES = 8, MAX_OPTS = 12;
  const PERSONAL = new Set(["potion"]);   // never voted on
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const actives = (run) => (run?.members || []).filter((m) => !m.left);
  const partyRun = (run) => !!run && actives(run).length >= 2;
  const cleanOpts = (opts) => (Array.isArray(opts) ? opts : []).filter((o) => o && o[0] != null && !PERSONAL.has(String(o[0])))
    .map((o) => [String(o[0]), String(o[1] ?? o[0]), String(o[2] || "")]).slice(0, MAX_OPTS);
  const keys = (pv) => (pv?.opts || []).map((o) => o[0]);
  const isOpen = (pv) => !!pv && !pv.res;

  /* the leader opens a vote for one choice. spec: { did (what is being decided, unique per choice), kind ("way"|"act"), title, opts }.
     The same choice is never opened twice (still open or already settled). */
  function open(run, leaderId, spec, t = now()) {
    if (!run || run.leader !== leaderId || !partyRun(run)) return run;
    const opts = cleanOpts(spec?.opts);
    if (opts.length < 2) return run;
    if (run.pv && run.pv.did === spec.did) return run;
    const n = (run.pvN || 0) + 1;
    return { ...run, pvN: n, pv: { id: `pv${n}`, did: spec.did, kind: spec.kind || "act", title: spec.title || "", opts,
      who: actives(run).map((m) => m.id).slice(0, MAX_HEROES), leader: leaderId, votes: {}, t, ends: t + VOTE_SECONDS, res: null } };
  }
  /* someone taps an option (inside Store.change). Tapping another option changes your vote; the same one keeps it.
     weight: 2 with the Voice of Reason perk (written into the vote, so every phone counts it the same) */
  function cast(run, uid, key, t = now(), weight = 1) {
    const pv = run?.pv;
    if (!isOpen(pv) || !pv.who.includes(uid) || !keys(pv).includes(String(key))) return run;
    const w = Math.max(1, Math.min(2, Math.round(+weight || 1)));
    if (pv.votes[uid] === String(key) && (pv.w?.[uid] || 1) === w) return run;
    return { ...run, pv: { ...pv, votes: { ...pv.votes, [uid]: String(key) }, w: { ...(pv.w || {}), [uid]: w } } };
  }
  /* your vote's weight from perks */
  const weightOf = (s) => (typeof PFX !== "undefined" && s && PFX.num(s, "pvweight") > 0 ? 2 : 1);
  /* weighted score per option */
  function score(pv) {
    const out = {}, t = tally(pv);
    for (const k of Object.keys(t)) out[k] = t[k].reduce((a, uid) => a + Math.max(1, Math.min(2, pv.w?.[uid] || 1)), 0);
    return out;
  }
  /* who voted for what: { key: [uid, ...] }, voters in the order they appear in the run */
  function tally(pv) {
    const out = {}, ks = keys(pv);
    for (const uid of pv?.who || []) { const k = pv.votes?.[uid]; if (k != null && ks.includes(k)) (out[k] = out[k] || []).push(uid); }
    return out;
  }
  const voted = (pv) => Object.values(tally(pv)).reduce((a, b) => a + b.length, 0);
  /* the winning option: most votes (Voice of Reason counts twice); a tie goes the leader's way; nobody voted → null */
  function winner(pv) {
    const sc = score(pv), ks = keys(pv).filter((k) => sc[k]);
    if (!ks.length) return null;
    const top = Math.max(...ks.map((k) => sc[k])), tied = ks.filter((k) => sc[k] === top);
    if (tied.length === 1) return tied[0];
    const lv = pv.votes?.[pv.leader];
    return tied.includes(lv) ? lv : tied[0];
  }
  /* is it time to settle? online: ids of players who are connected right now (the leader always counts) */
  function due(pv, online, t = now()) {
    if (!isOpen(pv) || !voted(pv)) return false;
    if (t >= pv.ends) return true;
    const on = new Set([...(online || []), pv.leader]);
    return pv.who.filter((id) => on.has(id)).every((id) => pv.votes?.[id] != null);
  }
  /* the leader settles the vote (inside Store.change): writes the result with the next sequence number.
     force: the leader's "Decide now" (still needs at least one vote). */
  function settle(run, leaderId, online, t = now(), force = false) {
    const pv = run?.pv;
    if (!pv || run.leader !== leaderId || !isOpen(pv)) return run;
    if (!force && !due(pv, online, t)) return run;
    const key = winner(pv);
    if (key == null) return run;
    const seq = (run.pvSeq || 0) + 1, tl = tally(pv), o = pv.opts.find((x) => x[0] === key);
    return { ...run, pvSeq: seq, pv: { ...pv, res: { key, label: o ? o[1] : key, seq, votes: tl[key].length, of: voted(pv), forced: !!force && !due(pv, online, t), t } } };
  }
  /* a phone applies each result once: returns the result if it is newer than the last one this phone saw */
  const fresh = (run, seen) => (run?.pv?.res && run.pv.res.seq > (seen || 0) ? run.pv.res : null);
  const left = (pv, t = now()) => (isOpen(pv) ? Math.max(0, Math.ceil(pv.ends - t)) : 0);

  // ------------------------------------------------------------ screens
  function ui(ctx) {
    /* ctx: { S(), runs(), Store, toast, esc, cardOf(id), online(id), persist(pub), renderDungeon(), choose(kind, key),
       optHTML(pv, key, mine) → a whole option button of its own, or "" for the plain one (the dungeon's way cards, dunchoice.js) } */
    const { S, Store, toast, esc } = ctx;
    let executing = false, seen = 0, popped = new Set(), opening = null;
    const run = () => { const id = S().dungeon?.run; return id ? (ctx.runs() || []).find((r) => r.id === id) || null : null; };
    const me = () => S().id;
    const isLeader = (r = run()) => !!r && r.leader === me();
    const onlineIds = (r) => actives(r).map((m) => m.id).filter((id) => id === me() || ctx.online(id));
    const active = () => { const r = run(), d = S().dungeon; return !!d && !d.done && partyRun(r); };
    const change = (fn) => { const r = run(); return r ? Store.change("runs", r.id, (x) => (x ? fn(x) || x : x)) : Promise.resolve(null); };

    /* what the leader is facing right now, from their own screen */
    function spec() {
      const s = S(), d = s.dungeon, r = run();
      if (!d || d.done || !r) return null;
      const step = d.cstep || 0;
      if (d.room) {
        const opts = DUNGEONS.roomChoices(s).filter((o) => !PERSONAL.has(o[0]));
        return { did: `${step}|act|${(r.acts?.[Math.max(0, step - 1)] || []).length}|${opts.map((o) => o[0]).join(",")}`, kind: "act", title: "What does the party do?", opts };
      }
      if ((step) !== r.path.length) return null;   // still catching up with the shared path
      const row = d.rows[d.row + 1];
      if (!row) return null;
      const nx = DUNGEONS.nextChoices(s), side = (i) => (nx.length === 2 ? ["left", "right"][i] : nx.length === 3 ? ["left", "middle", "right"][i] : `way ${i + 1}`);
      const opts = nx.map((c, i) => { const same = nx.filter((x) => row[x].type === row[c].type).length > 1;   // two rooms that look alike: say which side
        return [String(c), `${DUNGEONS.ICON[row[c].type]} ${DUNGEONS.LABEL[row[c].type]}${same ? ` (${side(i)})` : ""}`, row[c].type === "boss" ? "danger" : ""]; });
      return { did: `${step}|way|${d.row}`, kind: "way", title: "Which way does the party go?", opts };
    }
    /* the leader keeps a vote open for whatever choice is on their screen */
    function ensure() {
      const r = run();
      if (!active() || !isLeader(r)) return;
      const sp = spec();
      if (!sp || cleanOpts(sp.opts).length < 2 || r.pv?.did === sp.did || opening === sp.did) return;
      opening = sp.did;
      change((x) => open(x, me(), sp)).finally(() => { opening = null; });
    }
    /* the vote to show on this phone (members see whatever the leader opened; the leader only their current one) */
    function shown() {
      const r = run();
      if (!active() || !isOpen(r?.pv) || !r.pv.who.includes(me())) return null;
      if (isLeader(r)) { const sp = spec(); if (!sp || sp.did !== r.pv.did) return null; }
      return r.pv;
    }
    const showing = () => { ensure(); return !!shown(); };

    /* a tap on a dungeon choice. Returns true when it became a vote (the caller then does nothing else). */
    function gate(kind, key) {
      if (executing || !active() || PERSONAL.has(String(key))) return false;
      const r = run(), s = S();
      let pv = r.pv;
      if (isLeader(r)) {
        const sp = spec();
        if (!sp || cleanOpts(sp.opts).length < 2) return false;   // one way only: just go
        if (pv?.did === sp.did && pv.res) return false;           // already settled: carry it out
        change((x) => cast(open(x, s.id, sp), s.id, key, now(), weightOf(s))).then(() => tryClose());
      } else {
        if (!isOpen(pv) || !pv.who.includes(s.id)) return false;   // nothing to vote on (one way only): the leader just goes
        if (!keys(pv).includes(String(key))) { toast("That isn't one of the choices in this vote."); return true; }
        change((x) => cast(x, s.id, key, now(), weightOf(s)));
      }
      const o = [...(pv?.opts || []), ...((isLeader(r) && spec()?.opts) || [])].find((x) => x[0] === String(key));
      toast(`You vote: ${o ? o[1] : "that"}.`);
      return true;
    }

    /* ---- looks: the vote card */
    function face(uid, size = 26) {
      const c = uid === me() ? S() : ctx.cardOf(uid);
      let h = "";
      try { h = c && typeof HEROART !== "undefined" ? HEROART.portrait(c, size) : ""; } catch { h = ""; }
      const nm = actives(run()).find((m) => m.id === uid)?.name || c?.name || "?";
      return h || `<b>${esc(nm.slice(0, 1).toUpperCase())}</b>`;
    }
    function ring(pv) {
      const l = left(pv), f = Math.max(0, Math.min(1, l / VOTE_SECONDS)), C = 2 * Math.PI * 15;
      return `<span class="pvring" aria-label="${l} seconds left"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - f)).toFixed(1)}"/></svg><b class="num">${l}</b></span>`;
    }
    /* how it's decided, said plainly; while two ways are level it says the leader's pick settles it */
    const tied = (pv) => { const sc = score(pv), v = Object.values(sc); return v.length > 1 && v.filter((x) => x === Math.max(...v)).length > 1; };
    const ruleText = (pv) => (tied(pv) ? "Tied right now: the leader's pick wins." : "Most votes wins. A tie goes the leader's way.");
    const hintText = (pv, mine) => (mine ? "Your face is by your pick. Tap another to change your vote." : left(pv) ? "Tap a choice to vote." : "Time's up: the first vote decides.");
    const votesText = (n) => (n ? `${n} vote${n > 1 ? "s" : ""}` : "");
    function cardHTML(pv) {
      const r = run(), lead = isLeader(r), mine = pv.votes?.[me()], n = voted(pv), of = pv.who.length;
      let cards = false;
      const opts = pv.opts.map(([k, l, c]) => { const own = ctx.optHTML ? ctx.optHTML(pv, k, mine === k) : ""; if (own) { cards = true; return own; }
        return `<button class="btn pvopt ${esc(c)} ${mine === k ? "pvmine" : ""}" data-act="pvv" data-k="${esc(k)}"><span class="pvlab"><span>${esc(l)}</span> <span class="pvn num"></span></span><span class="pvchips" data-k="${esc(k)}"></span></button>`; }).join("");
      return `<div class="pvote" data-pv="${esc(pv.id)}" data-kind="${esc(pv.kind)}">
        <div class="pvhd">${ring(pv)}<div class="pvtt"><h3>${esc(pv.title || "Party vote")}</h3><p class="sub pvcount"><span>Party vote</span> · <span class="num">${n}/${of}</span></p></div></div>
        <p class="sub pvrule">${ruleText(pv)}</p>
        <div class="evc pvopts${cards ? " dcards" : ""}">${opts}</div>
        <p class="sub pvhint">${hintText(pv, mine)}</p>
        ${lead ? `<button class="btn sm pvnow" data-act="pvnow" ${n ? "" : "disabled"}>⚑ Decide now</button>` : ""}</div>`;
    }
    /* the dungeon screen's main card: the choice buttons become the vote */
    function main(html) {
      const pv = shown();
      if (!pv) return html;
      const card = cardHTML(pv), s = S();
      const pot = isLeader() && s.dungeon?.room ? DUNGEONS.roomChoices(s).find((o) => o[0] === "potion") : null;   // your own potion: never a vote
      const potBtn = pot ? `<button class="btn sm pvpot" data-act="dact" data-c="potion">${esc(pot[1])}</button>` : "";
      html = html.replace(/<div class="card lv-wait">[\s\S]*?<\/div>/, "");
      const evc = /<div class="evc(?: [^"]*)?">[\s\S]*?<\/div>/;   // the choices block (the way cards carry a second class)
      if (evc.test(html)) return html.replace(evc, card + potBtn);
      return `<div class="card">${card}</div>` + html;
    }
    /* faces by the options and the timer ring, without rebuilding the screen (only new faces pop in) */
    function paint() {
      const box = document.querySelector("#dun .pvote");
      const pv = shown();
      if (!box || !pv || box.dataset.pv !== pv.id) return;
      const t = tally(pv), mine = pv.votes?.[me()], sc = score(pv), top = Math.max(0, ...Object.values(sc));
      box.querySelectorAll(".pvchips").forEach((ch) => {
        const want = t[ch.dataset.k] || [];
        ch.querySelectorAll(".pvchip").forEach((c) => { if (!want.includes(c.dataset.uid)) c.remove(); });
        for (const uid of want) {
          if ([...ch.children].some((c) => c.dataset.uid === uid)) continue;
          const tag = `${pv.id}|${uid}|${ch.dataset.k}`, el = document.createElement("span");
          el.className = `pvchip${popped.has(tag) ? " nopop" : ""}${uid === pv.leader ? " lead" : ""}`; el.dataset.uid = uid;
          el.title = actives(run()).find((m) => m.id === uid)?.name || ""; el.innerHTML = face(uid);
          ch.appendChild(el); popped.add(tag);
        }
        const opt = ch.closest(".pvopt");
        opt?.classList.toggle("pvhas", want.length > 0);
        opt?.classList.toggle("pvmine", mine === ch.dataset.k);
        opt?.classList.toggle("pvlead", top > 0 && sc[ch.dataset.k] === top);   // in front right now (or level at the front)
        const pn = opt?.querySelector(".pvn"); if (pn && pn.textContent !== votesText(want.length)) pn.textContent = votesText(want.length);
      });
      const n = voted(pv), cnt = box.querySelector(".pvcount .num"); if (cnt) cnt.textContent = `${n}/${pv.who.length}`;
      const rg = box.querySelector(".pvring"); if (rg) rg.outerHTML = ring(pv);
      const now_ = box.querySelector(".pvnow"); if (now_) now_.disabled = !n;
      const hint = box.querySelector(".pvhint"); if (hint && hint.textContent !== hintText(pv, mine)) hint.textContent = hintText(pv, mine);
      const rule = box.querySelector(".pvrule"); if (rule && rule.textContent !== ruleText(pv)) rule.textContent = ruleText(pv);
      if (popped.size > 400) popped = new Set([...popped].slice(-200));
    }

    /* the leader settles the vote when it's due, then carries out the pick once */
    async function tryClose(force = false) {
      const r = run();
      if (!isLeader(r) || !isOpen(r?.pv)) return;
      if (!force && !due(r.pv, onlineIds(r))) return;
      const on = onlineIds(r);
      await change((x) => settle(x, me(), on, now(), force));
      apply();
    }
    /* every phone: a new result shows once; on the leader's phone it is also carried out once */
    function apply() {
      const r = run(), s = S(), d = s.dungeon;
      if (!d || !r) return;
      seen = Math.max(seen, d.pvSeen || 0);
      const res = fresh(r, seen);
      if (!res) return;
      seen = d.pvSeen = res.seq;
      if (now() - (res.t || 0) < 60) toast(`⚑ The party chose: ${res.label} (${res.votes} of ${res.of} vote${res.of > 1 ? "s" : ""}).`);
      if (isLeader(r) && r.pv?.res?.seq === res.seq) {
        const sp = spec();
        if (sp && sp.did === r.pv.did) { ctx.persist(true); executing = true; try { ctx.choose(r.pv.kind, res.key); } finally { executing = false; } return; }
      }
      ctx.persist(false);
      if (document.getElementById("dun")) ctx.renderDungeon();
    }
    function onRuns() { if (!active()) return; ensure(); tryClose(); apply(); paint(); }
    function tick() { if (!active()) return; ensure(); tryClose(); apply(); paint(); }
    async function act(b) {
      const a = b.dataset.act, r = run();
      if (a === "pvv") { const pv = r?.pv; if (pv) gate(pv.kind, b.dataset.k); return; }
      if (a === "pvnow") { if (!isLeader(r)) return; if (!voted(r?.pv || {})) return toast("Nobody has voted yet: tap a choice first."); await tryClose(true); }
    }
    return { showing, main, paint, gate, act, onRuns, tick, active };
  }

  return { VOTE_SECONDS, MAX_HEROES, partyRun, cleanOpts, open, cast, weightOf, score, tally, voted, winner, due, settle, fresh, left, ui };
})();
