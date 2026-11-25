/* Party play [OURS]: a party travels and fights as one.
   - The leader leads: only the leader picks where the party goes. Members standing with the leader follow automatically,
     on the same road at the slowest member's pace. A member who wandered off can travel alone to catch up.
   - Ready check: before the party leaves a place (setting off, or going into a dungeon) the leader asks "Ready?".
     The party departs when everyone with the leader has said yes. After a minute the leader may go anyway or send
     someone home from the party.
   - The leader decides: encounters and road events on the way happen to the leader. Members following them never roll
     their own; they stop where they are, see what the leader is dealing with, and fight beside them (party.js allies).
     Everyone with the leader gets the same window; members' taps are votes, shown as little portraits by the option
     they picked on every phone, live. Only the leader's tap acts; then the members' windows close and they hear the pick.
   - Shared spoils: a won fight leaves a share for everyone who stood in it (party.js), gold found on the road is split
     evenly, and dungeons are cleared as a co-op run with one fair chest roll each (coop.js).
   - Bigger party, bigger dungeon (parties hold up to 8): +2 rooms on the way to the boss for each of the first 3 extra
     heroes, +1 for each after that (at most +10, so 8 heroes walk 10 more rooms), and every fight room sends one foe per
     hero, one after another, at most 6. The leader rolls the map once and stores it on the run; everyone walks that copy.
   Pure logic up top (node-testable); PARTYPLAY.ui(ctx) wires it into the screens. Party records live in "parties". */
const PARTYPLAY = (() => {
  const READY_FORCE_SECONDS = 60;     // after this the leader may depart without the stragglers
  const READY_LIVE_SECONDS = 600;     // an unanswered check expires
  const HALT_SECONDS = 900;           // a stop the leader never resolved is dropped
  const MAX_PARTY = 8;                // [OURS] a party (and a co-op run) holds up to 8 heroes
  const MAX_EXTRA_ROWS = 10;          // dungeons grow with the party: +2 rooms per extra hero for the first 3, then +1 each, at most +10
  const MAX_FOES = 6;                 // fight rooms: one foe per hero, one after another, at most 6
  const NEAR = 40;                    // "with the leader": within this many map px (the same as following)
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const now = () => (typeof G !== "undefined" ? G.now() : Date.now() / 1000);
  const isMember = (p, id) => !!p?.members?.some((m) => m.id === id);
  const nameOf = (p, id) => p?.members?.find((m) => m.id === id)?.name || "someone";

  // ---- who decides
  let bound = null;   // { party(), S() } once the screens are wired
  function role(s, p = bound?.party()) { if (!p || !isMember(p, s.id) || p.members.length < 2) return "solo"; return p.leader === s.id ? "leader" : "member"; }
  /* the single gate: may this player decide what happens on the road right now? */
  function canDecide(s, p = bound?.party()) {
    const r = role(s, p);
    if (r !== "member") return true;
    return !(s.trip && s.trip.follow === p.leader);   // a member following the leader leaves the choices to them
  }
  /* may this player pick where to go? Members standing with the leader follow; members far away may catch up alone */
  function canLead(s, p, leaderPos) {
    const r = role(s, p);
    if (r !== "member") return true;
    if (s.trip && s.trip.follow === p.leader) return false;
    if (!leaderPos) return true;                       // leader offline: carry on alone
    return G.pxDist([s.x, s.y], leaderPos) > NEAR;
  }

  // ---- the ready check, stored on the party record (all pure: they return the new record)
  function startCheck(p, leaderId, spec, who, t = now()) {
    if (!p || p.leader !== leaderId) return p;
    const ids = [...new Set([leaderId, ...who.filter((id) => isMember(p, id))])];
    return { ...p, ready: { id: `rc-${Math.floor(t * 1000)}`, kind: spec.kind, destName: spec.destName || null, dest: spec.dest || null, place: spec.place || null,
      who: ids, ok: { [leaderId]: true }, no: {}, t } };
  }
  function setReady(p, uid, yes = true, t = now()) {
    const rc = p?.ready;
    if (!rc || !rc.who.includes(uid) || t - rc.t > READY_LIVE_SECONDS) return p;
    const ok = { ...rc.ok }, no = { ...(rc.no || {}) };
    if (yes) { ok[uid] = true; delete no[uid]; } else { delete ok[uid]; no[uid] = true; }
    return { ...p, ready: { ...rc, ok, no } };
  }
  const waitingOn = (p) => (p?.ready ? p.ready.who.filter((id) => !p.ready.ok[id]) : []);
  const allReady = (p) => !!p?.ready && waitingOn(p).length === 0;
  const canForce = (p, t = now()) => !!p?.ready && t - p.ready.t >= READY_FORCE_SECONDS;
  const checkLive = (p, t = now()) => !!p?.ready && t - p.ready.t <= READY_LIVE_SECONDS;
  function clearCheck(p) { if (!p) return p; const q = { ...p }; delete q.ready; return q; }
  /* the leader sends someone home from the party (and out of a pending check) */
  function kick(p, leaderId, uid) {
    if (!p || p.leader !== leaderId || uid === leaderId) return p;
    const q = { ...p, members: p.members.filter((m) => m.id !== uid) };
    if (q.ready) q.ready = { ...q.ready, who: q.ready.who.filter((id) => id !== uid), ok: { ...q.ready.ok } };
    if (q.ready) delete q.ready.ok[uid];
    return q;
  }
  /* when the check is answered: who goes along (the ready ones, or everyone if all said yes) */
  const goers = (p) => (p?.ready ? p.ready.who.filter((id) => p.ready.ok[id]) : []);

  // ---- the leader stops on the road: everyone following stops too
  /* the halt carries the leader's screen (title, text, the buttons as [key, label, class, disabled]) so everyone with them
     sees the same thing and can vote. votes: { uid: key }. round goes up each time the leader faces a new set of choices. */
  const cleanOpts = (opts) => (Array.isArray(opts) ? opts : []).filter((o) => o && o[0] != null).map((o) => [String(o[0]), String(o[1] ?? o[0]), o[2] || "btn", o[3] ? 1 : 0]).slice(0, 12);
  function halt(p, leaderId, info, t = now()) {
    if (!p || p.leader !== leaderId) return p;
    return { ...p, halt: { id: `h-${Math.floor(t * 1000)}`, kind: info.kind, name: info.name || "", text: info.text || "", title: info.title || info.name || "", sub: info.sub || "",
      opts: cleanOpts(info.opts), who: (info.who || []).filter((id) => isMember(p, id) && id !== leaderId), votes: {}, round: 1, picked: null, art: info.art || null, pos: info.pos || null, t, done: null } };
  }
  function resolve(p, leaderId, outcome, t = now()) {
    if (!p?.halt || p.leader !== leaderId) return p;
    return { ...p, halt: { ...p.halt, done: { text: outcome || "", t } } };
  }
  const halted = (p, t = now()) => !!p?.halt && !p.halt.done && t - p.halt.t < HALT_SECONDS;
  const optKeys = (h) => (h?.opts || []).map((o) => o[0]);
  const canVote = (p, uid, t = now()) => halted(p, t) && !p.halt.picked && uid !== p.leader && isMember(p, uid) && (!p.halt.who?.length || p.halt.who.includes(uid));
  /* a member taps an option: that's their vote (tap it again to take it back). Only the leader's tap acts. */
  function vote(p, uid, key, t = now()) {
    if (!canVote(p, uid, t)) return p;
    const votes = { ...(p.halt.votes || {}) };
    if (key == null || votes[uid] === key) delete votes[uid];
    else { if (!optKeys(p.halt).includes(key) || p.halt.opts.find((o) => o[0] === key)[3]) return p; votes[uid] = key; }
    return { ...p, halt: { ...p.halt, votes } };
  }
  /* who voted for what: { key: [uid, …] } (only live options, only people who may vote) */
  function tally(h) {
    const out = {}, keys = optKeys(h);
    for (const [uid, k] of Object.entries(h?.votes || {})) if (keys.includes(k) && (!h.who?.length || h.who.includes(uid))) (out[k] = out[k] || []).push(uid);
    return out;
  }
  /* the leader's screen changed (a road event with a second step, or a potion and back to the foe): a new round.
     The same choices keep their votes; different choices start the vote over. */
  function setOptions(p, leaderId, info, t = now()) {
    if (!halted(p, t) || p.leader !== leaderId) return p;
    const opts = cleanOpts(info.opts);
    const same = opts.map((o) => o[0]).join() === optKeys(p.halt).join();
    return { ...p, halt: { ...p.halt, opts, title: info.title ?? p.halt.title, text: info.text ?? p.halt.text, sub: info.sub ?? p.halt.sub,
      votes: same ? { ...(p.halt.votes || {}) } : {}, round: (p.halt.round || 1) + 1, picked: null } };
  }
  /* the leader taps an option: that's what the party does */
  function pick(p, leaderId, key, t = now()) {
    if (!halted(p, t) || p.leader !== leaderId) return p;
    const o = p.halt.opts?.find((x) => x[0] === key);
    return { ...p, halt: { ...p.halt, picked: { key, label: o ? o[1] : key, round: p.halt.round || 1, votes: tally(p.halt)[key]?.length || 0 } } };
  }

  // ---- road gold split evenly between the leader and everyone travelling with them
  function split(total, n) {
    total = Math.max(0, Math.floor(total || 0)); n = Math.max(1, n | 0);
    const each = Math.floor(total / n);
    return { each, leaderKeeps: total - each * (n - 1) };
  }
  function goldShareDoc(s, ids, names, each, what, t = now()) {
    return { id: `${s.id}-g${Math.floor(t * 1000)}`, doc: { by: s.id, byName: s.name, kind: "gold", what: what || "the road", each, members: ids, names, claims: {}, t, lvl: s.level || 1 } };
  }

  // ---- dungeons: longer and busier with more of you
  /* how many rooms the way to the boss grows by for a party of n heroes (followers don't count) */
  function extraRows(n) {
    const extra = clamp(Math.round(n || 1), 1, MAX_PARTY) - 1;
    return Math.min(MAX_EXTRA_ROWS, 2 * Math.min(3, extra) + Math.max(0, extra - 3));
  }
  /* roughly how many times as long the way is, for a dungeon with base rooms before the boss */
  const lengthFactor = (n, base = 6) => Math.round((base + extraRows(n)) / Math.max(1, base) * 10) / 10;
  const waves = (n) => clamp(Math.round(n || 1), 1, MAX_FOES);
  /* link row a to row b the way dungeons.js does: spread evenly, nobody unreachable */
  function relink(a, b) {
    a.forEach((node, i) => {
      const pos = a.length === 1 ? 0 : i / (a.length - 1) * (b.length - 1);
      node.links = [...new Set([Math.floor(pos), Math.ceil(pos)])].sort((x, y) => x - y);
    });
    b.forEach((_, j) => { if (!a.some((n) => n.links.includes(j))) { const k = Math.min(a.length - 1, Math.round(j / Math.max(1, b.length - 1) * (a.length - 1))); a[k].links = [...new Set([...a[k].links, j])].sort((x, y) => x - y); } });
  }
  /* the dungeon map for a party of n: the normal map, with extraRows(n) more rows taken from the middle of freshly rolled
     maps (the usual mix of fights, tough fights, traps, treasure, odd finds and rest spots) slipped in before the last
     breather row, then the boss. Rolled once on the leader's phone; the run record carries it to everyone. */
  function longLayout(theme, tier, n, layoutFn = (th, ti) => DUNGEONS.layout(th, ti)) {
    const copy = (row) => row.map((node) => ({ ...node, links: [...node.links] }));
    const first = layoutFn(theme, tier), body = first.slice(0, -1).map(copy);
    const want = extraRows(n);
    if (!want || body.length < 2) return first;
    const extra = [];
    for (let guard = 0; extra.length < want && guard < 50; guard++) {
      const mid = layoutFn(theme, tier).slice(1, -2);   // skip the opening row (a gentle start) and the breather + boss
      for (const row of mid) if (extra.length < want) extra.push(copy(row));
    }
    const rows = [...body.slice(0, -1), ...extra, body[body.length - 1], [{ type: "boss", links: [] }]];
    for (let r = 0; r < rows.length - 1; r++) relink(rows[r], rows[r + 1]);
    return rows;
  }
  /* the leader sizes a run for whoever is going in, once: the shared map grows with the party */
  function sizeRun(doc, n, layoutFn) {
    if (!doc || doc.sized || doc.theme === "giantcamp" || doc.theme === "lair") return doc;
    n = clamp(Math.round(n || 1), 1, MAX_PARTY);
    if (n < 2) return { ...doc, size: 1, sized: true };
    return { ...doc, size: n, factor: lengthFactor(n, (doc.rows?.length || 7) - 1), sized: true, rows: longLayout(doc.theme, doc.tier, n, layoutFn) };
  }
  /* a fight room in a party run: after a foe falls, the next one steps out of the dark */
  function nextWave(s, r, makeFoe) {
    if (!r || !r.enemy || r.type === "boss" || !(r.waves > 1)) return null;
    const e = makeFoe ? makeFoe() : { ...r.base, hp: r.base?.health };
    if (!e) return null;
    r.waves -= 1; r.wave = (r.wave || 1) + 1;
    r.enemy = e;
    return `Another ${e.name.toLowerCase()} steps out of the dark!${r.waves > 1 ? ` (${r.waves - 1} more behind it)` : " The last one."}`;
  }

  // ------------------------------------------------------------ screens
  function ui(ctx) {
    /* ctx: { S(), party(), others(), cardOf(id), otherPos(card), Store, toast, esc, persist(), publishCard(), renderPanel(), bump(),
              travelNow(name, pos), enterNow(), openModal(html), closeModal(), modalOpen() } */
    const { S, party, toast, esc, Store } = ctx;
    bound = { party, S };
    if (typeof ENC !== "undefined") ENC.canDecide = (st) => canDecide(st || S());   // road encounters: only the leader (or someone not following) chooses
    let seenCheck = null, seenHalt = null, departed = null, lastHaltText = "";

    const me = () => S();
    const leaderCard = (p) => (p && p.leader !== me().id ? ctx.cardOf(p.leader) : null);
    const leaderPos = (p) => { const c = leaderCard(p); return c ? ctx.otherPos(c) : null; };
    const withMe = (p) => (p ? p.members.filter((m) => m.id !== me().id && (() => { const c = ctx.cardOf(m.id); return c && !c.dungeon && G.pxDist(ctx.otherPos(c), [me().x, me().y]) <= NEAR; })()).map((m) => m.id) : []);
    const atPlace = (p, place) => (p ? p.members.filter((m) => m.id !== me().id && (() => { const c = ctx.cardOf(m.id); return c && !c.dungeon && (c.loc === place || G.pxDist(ctx.otherPos(c), [me().x, me().y]) <= NEAR); })()).map((m) => m.id) : []);
    const change = (fn) => { const p = party(); return p ? Store.change("parties", p.id, (x) => (x ? fn(x) || x : x)) : Promise.resolve(null); };

    /* travelTo asks first. Returns a message to show instead of travelling, "check" if a ready check started, or null to go */
    function beforeTravel(name, pos) {
      const s = me(), p = party(), r = role(s, p);
      if (r === "member") {
        if (!canLead(s, p, leaderPos(p))) return `You travel with ${p.leaderName}. Only the party leader picks where to go.`;
        return null;   // far from the leader: catch up alone
      }
      if (r !== "leader" || s.trip) return null;
      const who = withMe(p);
      if (!who.length) return null;
      if (p.ready && checkLive(p)) return "Your party is already getting ready. Depart, or cancel the check first.";
      change((x) => startCheck(x, s.id, { kind: "travel", destName: name, dest: pos }, who));
      toast(`⚑ Ready check: waiting for ${who.map((id) => nameOf(p, id)).join(", ")}.`);
      return "check";
    }
    /* going into a dungeon: the party goes in together */
    function beforeEnter() {
      const s = me(), p = party(), r = role(s, p);
      if (r === "member") {
        const lp = leaderPos(p);
        if (lp && G.pxDist([s.x, s.y], lp) <= NEAR) return `${p.leaderName} leads the way in. Wait for their ready check.`;
        return null;
      }
      if (r !== "leader") return null;
      const who = atPlace(p, s.location);
      if (!who.length || typeof COOP === "undefined") return null;
      if (p.ready && checkLive(p)) return "Your party is already getting ready.";
      change((x) => startCheck(x, s.id, { kind: "dungeon", place: s.location }, who));
      toast(`⚑ Ready check before ${s.location}: waiting for ${who.map((id) => nameOf(p, id)).join(", ")}.`);
      return "check";
    }

    /* the leader departs: travel, or a co-op run with everyone who is ready */
    async function depart(p) {
      const rc = p.ready, s = me();
      if (!rc || departed === rc.id) return;
      departed = rc.id;
      const ids = goers(p);
      await change((x) => clearCheck(x));
      if (rc.kind === "travel") ctx.travelNow(rc.destName, rc.dest);
      else if (rc.kind === "dungeon") await enterTogether(s, p, ids, rc.place);
    }
    async function enterTogether(s, p, ids, place) {
      if (s.location !== place) return toast("You've moved on from the door.");
      const r = COOP.newRun(s);
      if (r.err) return toast(r.err);
      const members = [{ id: s.id, name: s.name, level: s.level }, ...ids.filter((id) => id !== s.id).map((id) => ({ id, name: nameOf(p, id), level: ctx.cardOf(id)?.level || 1 }))].slice(0, COOP.MAX_MEMBERS);
      const n = members.length;
      const lone = r.doc.theme === "giantcamp" || r.doc.theme === "lair";
      const doc = { ...sizeRun(r.doc, n), members, status: "in", party: p.id };
      await Store.put("runs", r.id, doc);
      const err = COOP.join(s, { ...doc, id: r.id });
      if (err) return toast(err);
      if (typeof IMM !== "undefined") IMM.loading(`Entering ${place} together…`);
      toast(n > 1 ? ` Into ${place} with ${n - 1} other${n > 2 ? "s" : ""}. ${lone ? "" : `The way is ${extraRows(n)} rooms longer, and up to ${waves(n)} foes wait in each fight room.`}` : ` Into ${place}.`);
      ctx.persist(true); ctx.publishCard(); ctx.enterNow();
    }

    /* the party record changed */
    function onParty() {
      const s = me(), p = party();
      if (!p) return;
      const r = role(s, p), t = now();
      // ready check
      if (p.ready && checkLive(p, t)) {
        if (r === "leader" && allReady(p)) depart(p);
        else if (r === "member" && p.ready.who.includes(s.id) && !p.ready.ok[s.id] && seenCheck !== p.ready.id) {
          seenCheck = p.ready.id;
          const where = p.ready.kind === "dungeon" ? `go into ${p.ready.place}` : `set off for ${p.ready.destName}`;
          toast(`⚑ ${p.leaderName} wants to ${where}. Are you ready?`);
        }
        if (r === "member") promptReady(p);
      }
      // the leader stopped on the road
      if (r === "member" && s.trip && s.trip.follow === p.leader) {
        if (halted(p, t) && s.trip.status === "travel") {
          [s.x, s.y] = ctx.livePos ? ctx.livePos() : [s.x, s.y];
          s.trip.status = "hold"; s.trip.holdId = p.halt.id;
          if (seenHalt !== p.halt.id) { seenHalt = p.halt.id; toast(`⚑ ${p.leaderName} stops: ${p.halt.name || "something on the road"}. Their call.`); }
          ctx.persist(true); ctx.bump();
        } else if (!halted(p, t) && s.trip.status === "hold") {
          resumeFollowing(p);
        }
      }
      // voting on what the leader faces
      if (r === "member") syncVote(p);
      else if (r === "leader" && halted(p, t)) paintVotes(p);
      ctx.bump();
    }
    /* the Ready prompt, as soon as no other window is in the way. It only has Ready / Not yet, so if another popup
       pushed it away before you answered, it comes back once that popup is closed. */
    function promptReady(p) {
      const s = me(), rc = p?.ready;
      if (!rc || !rc.who.includes(s.id) || rc.ok[s.id] || rc.no?.[s.id] || ctx.modalOpen()) return;
      ctx.openModal(readyModal(p));
    }
    function resumeFollowing(p) {
      const s = me(), tr = s.trip;
      if (!tr) return;
      const lp = leaderPos(p);
      if (lp && WORLD.same([s.x, s.y], lp) && G.pxDist([s.x, s.y], lp) < NEAR * 2) [s.x, s.y] = lp;   // catch up to where the leader stands
      tr.path = Terrain.route([s.x, s.y], tr.dest); tr.idx = 0;
      tr.status = "travel"; tr.lastTick = now(); delete tr.holdId;
      const msg = p.halt?.done?.text;
      if (msg && msg !== lastHaltText) { lastHaltText = msg; toast(`⚑ ${p.leaderName}: ${msg.slice(0, 120)}`); }
      ctx.persist(true); ctx.bump();
    }
    function readyModal(p) {
      const rc = p.ready, where = rc.kind === "dungeon" ? `into <b>${esc(rc.place)}</b>` : `to <b>${esc(rc.destName)}</b>`;
      return `<h2>⚑ Ready check</h2><p>${esc(p.leaderName)} is leading the party ${where}.</p>${statusHTML(p)}
        <div class="grid2" style="margin-top:10px"><button class="btn pri" data-act="ppready" data-id="1"> Ready</button><button class="btn" data-act="ppready" data-id="0">Not yet</button></div>
        <p class="sub" style="margin-bottom:0">${rc.kind === "dungeon" ? "Everyone who is ready goes in together. The dungeon grows with the party." : "The party travels together; the leader handles whatever you meet on the road."}</p>`;
    }
    function statusHTML(p) {
      const rc = p.ready;
      return `<div class="pprc">${rc.who.map((id) => `<span class="ppchip ${rc.ok[id] ? "ok" : rc.no?.[id] ? "no" : ""}">${rc.ok[id] ? "" : rc.no?.[id] ? "" : "…"} ${esc(nameOf(p, id))}${id === p.leader ? " ⚑" : ""}</span>`).join("")}</div>`;
    }

    /* a card on the Travel tab: the check, or "following the leader" */
    function panelHTML() {
      const s = me(), p = party(), r = role(s, p), t = now();
      if (r === "solo") return "";
      let h = "";
      if (p.ready && checkLive(p, t)) {
        const rc = p.ready, wait = waitingOn(p), left = Math.max(0, Math.ceil(READY_FORCE_SECONDS - (t - rc.t)));
        const where = rc.kind === "dungeon" ? `into ${esc(rc.place)}` : `to ${esc(rc.destName)}`;
        h += `<div class="card ppcard"><h3>⚑ Ready check · ${where}</h3>${statusHTML(p)}`;
        if (r === "leader") h += `<p class="sub">${wait.length ? `Waiting for ${wait.map((id) => esc(nameOf(p, id))).join(", ")}.${left ? ` You can go without them in ${left}s.` : ""}` : "Everyone is ready."}</p>
          <div class="grid2"><button class="btn pri" data-act="ppgo" ${wait.length && left ? "disabled" : ""}>Depart${wait.length ? " now" : ""}</button><button class="btn" data-act="ppcancel">Cancel</button></div>
          ${wait.length && !left ? `<div class="chips" style="margin-top:6px">${wait.map((id) => `<button class="chip" data-act="ppkick" data-id="${esc(id)}">Send ${esc(nameOf(p, id))} home</button>`).join("")}</div>` : ""}`;
        else if (rc.who.includes(s.id)) h += rc.ok[s.id] ? `<p class="sub">You're ready. Waiting for the others.</p><button class="btn" data-act="ppready" data-id="0" style="width:100%">Not ready after all</button>` : `<button class="btn pri" data-act="ppready" data-id="1" style="width:100%"> I'm ready</button>`;
        h += `</div>`;
      }
      if (r === "member") {
        const following = s.trip && s.trip.follow === p.leader;
        const lp = leaderPos(p), near = lp && G.pxDist([s.x, s.y], lp) <= NEAR;
        h += `<div class="card ppcard"><h3>⚑ ${following ? `Following ${esc(p.leaderName)}` : near ? `With ${esc(p.leaderName)}` : `Away from ${esc(p.leaderName)}`}</h3><p class="sub">${following
          ? (s.trip.status === "hold" ? `${esc(p.leaderName)} has stopped: ${esc(p.halt?.name || "something on the road")}. They decide; you fight beside them.` : `On the road to ${esc(s.trip.destName)}. The leader picks the way and deals with what you meet.`)
          : near ? "The leader picks where the party goes. Wait for their ready check." : "You're not with your party. You can travel alone to catch up."}</p>
          ${!near && lp ? `<button class="btn" data-act="ppcatch" style="width:100%;margin-bottom:6px">Catch up with ${esc(p.leaderName)}</button>` : ""}<button class="btn" data-act="leaveparty" style="width:100%">Leave the party</button></div>`;
      } else if (r === "leader" && !p.ready) {
        const who = withMe(p);
        h += `<div class="card ppcard"><h3>⚑ You lead the party</h3><p class="sub">${who.length ? `${who.map((id) => esc(nameOf(p, id))).join(", ")} ${who.length > 1 ? "are" : "is"} with you. Pick a place to go: everyone gets a ready check first, then follows you. You handle encounters on the way.` : "Nobody is with you right now. Party members far away can catch up."}</p></div>`;
      }
      return h;
    }

    async function act(b) {
      const a = b.dataset.act, s = me(), p = party();
      if (!p) return;
      if (a === "ppready") { const yes = b.dataset.id === "1"; await change((x) => setReady(x, s.id, yes)); toast(yes ? " You're ready." : "You asked them to wait."); ctx.closeModal(); }
      else if (a === "ppgo") { const q = party(); if (q?.ready && (allReady(q) || canForce(q))) depart(q); else toast("Give them a moment."); }
      else if (a === "ppcancel") { await change((x) => clearCheck(x)); toast("Ready check cancelled."); }
      else if (a === "ppkick") { const id = b.dataset.id; await change((x) => kick(x, s.id, id)); toast(`${nameOf(p, id)} is no longer in your party.`); }
      else if (a === "ppcatch") { const lp = leaderPos(p); if (lp) ctx.travelNow(`${p.leaderName}'s party`, lp); }
      else if (a === "ppvote") { const k = b.dataset.k, was = p.halt?.votes?.[s.id]; await change((x) => vote(x, s.id, k)); syncVote(party()); toast(was === k ? "Vote taken back." : `You vote: ${labelOf(b)}.`); return; }
      else if (a === "ppvhide") { const h = p.halt; if (h) hidVote = roundKey(h); ctx.closeModal(); toast(`${p.leaderName} decides. You'll hear what they chose.`); return; }
      ctx.bump(); ctx.renderPanel?.(true);
    }

    /* ---- voting on the road: everyone with the leader sees the leader's screen; members' taps are votes, shown as
       little portraits by the option they picked, on every phone. Only the leader's tap acts. */
    const VOTE_BTNS = "[data-act=enc][data-a],[data-act=ev][data-c],[data-act=ppvote][data-k]";
    const labelOf = (b) => [...b.childNodes].filter((n) => !(n.classList && n.classList.contains("pvchips"))).map((n) => n.textContent).join("").replace(/\s+/g, " ").trim();
    /* what the leader's open encounter / event window shows */
    function screenInfo() {
      const m = document.querySelector("#modal");
      if (!m) return null;
      const bs = [...m.querySelectorAll("[data-act=enc][data-a],[data-act=ev][data-c]")];
      if (!bs.length) return null;
      return { opts: bs.map((b) => [b.dataset.a || b.dataset.c, labelOf(b), b.className.replace(/\bpv\w+/g, "").trim() || "btn", b.disabled ? 1 : 0]),
        title: m.querySelector("h2")?.textContent || "", sub: m.querySelector("p.sub")?.textContent?.replace(/\s+/g, " ").trim() || "" };
    }
    const FALLBACK_OPTS = [["fight", " Fight", "btn danger"], ["flee", " Flee", "btn"], ["sneak", " Sneak past", "btn"]];
    function face(p, uid, size = 26) {
      const c = uid === me().id ? me() : ctx.cardOf(uid);
      let h = "";
      try { h = c && typeof AVATAR !== "undefined" ? AVATAR.portrait(c, size) : ""; } catch { h = ""; }
      return h || `<b>${esc((nameOf(p, uid) || "?").slice(0, 1).toUpperCase())}</b>`;
    }
    /* put voters' faces next to the options in whatever vote window is open (only new faces pop in) */
    function paintVotes(p) {
      const m = document.querySelector("#modal");
      if (!m || !p?.halt || !m.querySelector(VOTE_BTNS)) return;
      const t = tally(p.halt), mine = p.halt.votes?.[me().id];
      m.querySelectorAll(VOTE_BTNS).forEach((b) => {
        const k = b.dataset.a || b.dataset.c || b.dataset.k, want = t[k] || [];
        b.classList.toggle("pvmine", b.dataset.act === "ppvote" && mine === k);
        let box = b.querySelector(".pvchips");
        if (!want.length && !box) return;
        if (!box) { box = document.createElement("span"); box.className = "pvchips"; b.appendChild(box); b.classList.add("pvhas"); }
        box.querySelectorAll(".pvchip").forEach((ch) => { if (!want.includes(ch.dataset.uid)) ch.remove(); });
        for (const uid of want) {
          if ([...box.children].some((ch) => ch.dataset.uid === uid)) continue;
          const ch = document.createElement("span");
          ch.className = "pvchip"; ch.dataset.uid = uid; ch.title = nameOf(p, uid); ch.innerHTML = face(p, uid);
          box.appendChild(ch);
        }
      });
      let note = m.querySelector(".pvnote");
      const n = Object.keys(p.halt.votes || {}).length, of = p.halt.who?.length || 0;
      const txt = role(me(), p) === "leader" ? `⚑ Your party is voting (${n}/${of}). You decide: their faces show what they'd pick.` : `⚑ ${p.leaderName} decides. Tap to vote (${n}/${of} voted); everyone sees your face by your pick.`;
      if (!note) { note = document.createElement("p"); note.className = "sub pvnote"; const at = m.querySelector(VOTE_BTNS).parentNode; at.parentNode.insertBefore(note, at); }
      note.textContent = txt;
    }
    function voteModal(p) {
      const h = p.halt, ev = h.kind === "event";
      const art = ev && h.art && typeof EVENTART !== "undefined" ? (() => { try { return EVENTART.road(h.art, { pos: h.pos || undefined }); } catch { return ""; } })() : "";
      return `<div class="ppvote" data-round="${h.round || 1}" data-hid="${esc(h.id)}">${art}${h.sub ? `<p class="sub" style="margin:0">${esc(h.sub)}</p>` : ""}<h2 style="margin:4px 0 8px">${esc(h.title || h.name || "On the road")}</h2>${h.text ? `<p>${esc(h.text)}</p>` : ""}
        <div class="${ev ? "evc" : "grid2"} pvopts" style="margin-top:10px">${(h.opts.length ? h.opts : FALLBACK_OPTS).map(([k, l, c, d]) => `<button class="${esc(c || "btn")}" data-act="ppvote" data-k="${esc(k)}" ${d ? "disabled" : ""}>${esc(l)}</button>`).join("")}</div>
        <button class="btn sm" data-act="ppvhide" style="width:100%;margin-top:8px">Just watch</button></div>`;
    }
    let hidVote = null, seenPick = null, seenDone = null;
    const roundKey = (h) => `${h.id}#${h.round || 1}`;
    const voteOpen = () => document.querySelector("#modal .ppvote");
    /* a member: open, refresh or close the vote window to match the party record */
    function syncVote(p) {
      const s = me(), h = p?.halt;
      const open = voteOpen();
      if (!h || !(h.who || []).includes(s.id)) { if (open) ctx.closeModal(); return; }
      if (h.done) {
        if (open) ctx.closeModal();
        if (seenDone !== h.id) { seenDone = h.id; if (now() - (h.done.t || 0) < 120 &&!(s.trip && s.trip.follow === p.leader && s.trip.status === "hold") && h.done.text) toast(`⚑ ${p.leaderName}: ${h.done.text.slice(0, 120)}`); }
        return;
      }
      if (!halted(p)) { if (open) ctx.closeModal(); return; }
      if (h.picked) {
        if (open) ctx.closeModal();
        const pk = `${roundKey(h)}`;
        if (seenPick !== pk) { seenPick = pk; toast(`⚑ ${p.leaderName} chose ${h.picked.label}.${h.picked.votes ? ` (${h.picked.votes} vote${h.picked.votes > 1 ? "s" : ""} for it)` : ""}`); }
        return;
      }
      if (open && open.dataset.hid === h.id && +open.dataset.round === (h.round || 1)) return void paintVotes(p);
      if (hidVote === roundKey(h)) return;
      if (open || !ctx.modalOpen()) { ctx.openModal(voteModal(p), h.kind === "event" ? "" : "enc"); paintVotes(p); }
    }
    /* the leader's own window opened (an encounter or event): keep the party's copy in step and show the votes */
    function onModal() {
      const s = me(), p = party();
      if (role(s, p) !== "leader" || !halted(p)) return;
      const info = screenInfo();
      if (!info) return;
      const h = p.halt;
      const changed = info.opts.map((o) => o.join("|")).join() !== (h.opts || []).map((o) => o.join("|")).join() || info.title !== h.title || h.picked;
      if (changed) change((x) => setOptions(x, s.id, { ...info, text: s.trip?.encounter?.text || s.trip?.event?.text || undefined }));
      else paintVotes(p);
    }
    function leaderPicked(key) {
      const s = me(), p = party();
      if (role(s, p) !== "leader" || !halted(p)) return;
      change((x) => pick(x, s.id, key));
    }

    /* the leader runs into something: tell the party, then tell them how it went */
    function leaderHalt(kind, name, text) {
      const s = me(), p = party(), who = withMe(p);
      if (role(s, p) !== "leader" || !who.length) return;
      const info = screenInfo() || {};
      const ev = kind === "event" ? s.trip?.event : null;
      const opts = info.opts || (kind === "event" && typeof G !== "undefined" && G.eventChoices ? (() => { try { return G.eventChoices(s).map(([k, l]) => [k, l, "btn pri"]); } catch { return []; } })() : FALLBACK_OPTS);
      change((x) => halt(x, s.id, { kind, name, text, title: info.title || (ev?.title) || name, sub: info.sub || "", opts, who,
        art: ev ? { id: ev.id, god: ev.god, item: ev.item, tier: ev.tier } : null, pos: [s.x, s.y] }));
    }
    function leaderResolved(outcome) {
      const s = me(), p = party();
      if (role(s, p) !== "leader" || !halted(p)) return;
      change((x) => resolve(x, s.id, outcome));
    }
    /* gold the leader found on the road: split evenly with whoever travels with them */
    function splitGold(gained, what) {
      const s = me(), p = party();
      if (role(s, p) !== "leader" || !(gained > 0)) return null;
      const ids = withMe(p);
      if (!ids.length) return null;
      const { each, leaderKeeps } = split(gained, ids.length + 1);
      if (!each) return null;
      s.gold -= gained - leaderKeeps;
      const sh = goldShareDoc(s, ids, ids.map((id) => nameOf(p, id)), each, what);
      Store.put("pshare", sh.id, sh.doc);
      return `Split with the party: you keep ${leaderKeeps}, ${ids.length > 1 ? "each of the others gets" : `${nameOf(p, ids[0])} gets`} ${each}.`;
    }
    function tick() {
      const s = me(), p = party();
      if (!p) return;
      if (role(s, p) === "member" && s.trip?.status === "hold" && !halted(p)) resumeFollowing(p);
      if (role(s, p) === "member" && p.ready && checkLive(p)) promptReady(p);
      if (role(s, p) === "member" && (p.halt || voteOpen())) syncVote(p);
      if (role(s, p) === "leader" && p.ready && !checkLive(p)) change((x) => clearCheck(x));
      if (p.ready && checkLive(p) && Math.floor(now()) % 5 === 0) ctx.bump();   // keep the countdown on the card fresh
    }

    return { beforeTravel, beforeEnter, onParty, panelHTML, act, leaderHalt, leaderResolved, leaderPicked, onModal, splitGold, tick, canDecide: () => canDecide(me(), party()), mates: () => (role(me(), party()) === "leader" ? withMe(party()) : []) };
  }

  return { READY_FORCE_SECONDS, READY_LIVE_SECONDS, MAX_PARTY, MAX_FOES, NEAR, role, canDecide, canLead, startCheck, setReady, waitingOn, allReady, canForce, checkLive,
    clearCheck, kick, goers, halt, resolve, halted, vote, tally, setOptions, pick, canVote, split, goldShareDoc, lengthFactor, extraRows, MAX_EXTRA_ROWS, sizeRun, waves, relink, longLayout, nextWave, ui };
})();
