/* Party loot voting (Roads of the North).
   In a party dungeon run (2+ heroes) only the leader chooses: rooms and every room action. Members' screens follow.
   Everything the leader finds (room loot, fight drops, the boss chest rolls) goes into one shared pile on the run record.
   At the end each member votes Want / Pass on every item. One wanter takes it; several roll a d100 (the same roll on every
   phone, seeded by run + item + hero), highest wins and ties roll again; nobody wants it → the leader. Gold is split evenly
   among everyone still in the run (any leftover coins go to the leader).
   Road encounters in a party work the same way for items (gold is already split by partyplay.js). */
const LOOTVOTE = (() => {
  const VOTE_SECONDS = 90;
  const STACK = new Set(["potion", "scroll", "soulgem", "tome", "ingredient", "trophy", "poison", "material", "food", "valuable", "ammo"]);
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const mix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
  const d100 = (...parts) => 1 + (mix(hash(parts.join("|"))) % 100);   // a fair d100, the same on every phone
  const now = () => G.now();
  const act = (run) => (run?.members || []).filter((m) => !m.left);

  /* a run counts as a party run (shared pile, leader decides) when two or more heroes are in it */
  const partyRun = (run) => !!run && act(run).length >= 2;

  // ---- gains: what a single action added to a save (new rows, bigger stacks, gold)
  function snap(s) { const q = {}; for (const r of s.inv) q[r.id] = r.qty; return { q, next: s.nextInv, gold: s.gold }; }
  const keepWithFinder = (item) => { const it = D.ITEMS[item]; return !it || it.quest || it.slot === "quest" || it.slot === "key"; };
  /* take the gains back out of the save; returns them as plain rows { item, qty, ...props } */
  function strip(s, before) {
    const items = [];
    for (const r of [...s.inv]) {
      if (keepWithFinder(r.item)) continue;
      if (r.id >= before.next) { const { id, ...rest } = r; items.push(rest); s.inv = s.inv.filter((x) => x !== r); }
      else if (before.q[r.id] != null && r.qty > before.q[r.id]) { const extra = r.qty - before.q[r.id]; items.push({ item: r.item, qty: extra }); r.qty = before.q[r.id]; }
    }
    const gold = Math.max(0, s.gold - before.gold);
    s.gold -= gold;
    return { items, gold };
  }
  /* merge rows into a pile: stackables add up, everything else stays one row each */
  function addTo(pile, items, gold) {
    const p = { items: [...(pile?.items || [])], gold: (pile?.gold || 0) + (gold || 0) };
    for (const r of items || []) {
      if (!D.ITEMS[r.item]) continue;
      if (STACK.has(D.ITEMS[r.item].slot)) { const ex = p.items.find((x) => x.item === r.item && !x.temper && !x.name); if (ex) { ex.qty += r.qty || 1; continue; } }
      p.items.push({ ...r, qty: r.qty || 1 });
    }
    return p;
  }
  const pileSize = (p) => (p?.items || []).length;

  // ---- the vote record (lives on the run, or on its own for road loot)
  function openVote(pile, members, leader, t = now()) {
    return { t, ends: t + VOTE_SECONDS, items: (pile?.items || []).map((r, i) => ({ ...r, i })), gold: pile?.gold || 0, members: [...members], leader, votes: {}, done: {} };
  }
  /* inside Store.change: a member's wants (indices of items) */
  function castVote(vote, uid, wants, t = now()) {
    if (!vote || !vote.members.includes(uid) || closed(vote, t)) return vote;
    return { ...vote, votes: { ...vote.votes, [uid]: [...new Set((wants || []).filter((i) => Number.isInteger(i) && i >= 0 && i < vote.items.length))] } };
  }
  const closed = (vote, t = now()) => !!vote && (t >= vote.ends || vote.members.every((m) => vote.votes[m]));
  /* who gets what: the same answer on every phone */
  function resolve(vote, seed) {
    const out = { items: {}, rolls: [], gold: {} };
    for (const m of vote.members) { out.items[m] = []; out.gold[m] = 0; }
    vote.items.forEach((it, i) => {
      const want = vote.members.filter((m) => (vote.votes[m] || []).includes(i));
      let winner;
      if (!want.length) winner = vote.leader && vote.members.includes(vote.leader) ? vote.leader : vote.members[0];
      else if (want.length === 1) winner = want[0];
      else {
        let pool = want, round = 0, rounds = [];
        while (pool.length > 1 && round < 20) {
          const rs = pool.map((m) => ({ m, roll: d100(seed, i, m, round) }));
          rounds.push(rs);
          const top = Math.max(...rs.map((r) => r.roll));
          pool = rs.filter((r) => r.roll === top).map((r) => r.m);
          round++;
        }
        winner = pool[0];
        out.rolls.push({ i, rounds, winner });
      }
      out.items[winner].push(it);
    });
    const n = vote.members.length, each = n ? Math.floor(vote.gold / n) : 0, rest = vote.gold - each * n;
    for (const m of vote.members) out.gold[m] = each + (m === (vote.members.includes(vote.leader) ? vote.leader : vote.members[0]) ? rest : 0);
    return out;
  }
  /* inside Store.change: mark that this hero took their part (once) */
  function markDone(vote, uid) { if (!vote || vote.done?.[uid]) return vote; return { ...vote, done: { ...(vote.done || {}), [uid]: now() } }; }
  /* put a hero's winnings into their save */
  function deliver(s, res, uid, key) {
    s.lootTaken = s.lootTaken || {};
    if (s.lootTaken[key]) return null;
    s.lootTaken[key] = now();
    for (const k of Object.keys(s.lootTaken)) if (now() - s.lootTaken[k] > 3 * 864e2 * 10) delete s.lootTaken[k];
    const mine = res.items[uid] || [], gold = res.gold[uid] || 0;
    s.gold += gold;
    for (const r of mine) {
      const { i, qty = 1, item, ...props } = r;
      if (!D.ITEMS[item]) continue;
      if (STACK.has(D.ITEMS[item].slot) || !Object.keys(props).length) G.give(s, item, qty, props.charge ?? null);
      else for (let k = 0; k < qty; k++) s.inv.push({ ...props, item, qty: 1, id: s.nextInv++ });
      if (s.dungeon) s.dungeon.found.push(D.ITEMS[item].name);
    }
    return { items: mine, gold };
  }

  // ---- a party dungeon run: the shared pile and the leader's actions on the run record
  function poolAdd(run, items, gold) { return { ...run, pool: addTo(run.pool, items, gold) }; }
  function recordAct(run, step, c) { const acts = { ...(run.acts || {}) }; acts[step] = [...(acts[step] || []), c]; return { ...run, acts }; }
  function startRunVote(run, t = now()) {
    if (run.vote) return run;
    return { ...run, vote: openVote(run.pool, act(run).map((m) => m.id), run.leader, t) };
  }
  /* the boss chest: every hero who beat the boss adds their roll to the pile, once */
  function chestToPool(run) {
    if (!run.chest || run.chestPooled) return run;
    let pile = run.pool;
    for (const uid of run.chest.killers || []) { const r = COOP.roll(run, uid, 1); pile = addTo(pile, r.items.map((item) => ({ item, qty: 1 })), r.gold); }
    return { ...run, pool: pile, chestPooled: true };
  }

  // ------------------------------------------------------------ screens
  function ui(ctx) {
    /* ctx: { S(), runs(), Store, toast, esc, persist(), openModal(html, cls), closeModal(), modalOpen(), renderDungeon(), party(), dungeonAct(c) } */
    const { S, Store, toast, esc } = ctx;
    let lvotes = [], shown = null, picks = {}, resultShown = {};
    const run = () => { const id = S().dungeon?.run || S().lastRun; return id ? (ctx.runs() || []).find((r) => r.id === id) || null : null; };
    const inPartyRun = () => { const r = run(); return partyRun(r) && S().dungeon?.run === r.id; };
    const leader = () => { const r = run(); return !!r && r.leader === S().id; };

    // -- room actions: only the leader chooses
    function memberLocked() { return inPartyRun() && !leader(); }
    function lockedHTML() { const r = run(); return `<div class="card lv-wait"><h3>⏳ ${esc(r?.leaderName || "The leader")} is choosing…</h3><p class="sub">In a party only the leader decides. What they pick happens to you too, and everything found goes into the party's loot pile.</p></div>`; }
    /* wrap the leader's room action: shared pile + record the choice for the others */
    async function aroundAct(c, doAct) {
      const s = S(), r = run();
      if (!inPartyRun()) return doAct();
      const step = Math.max(0, (s.dungeon.cstep || 1) - 1), before = snap(s);
      const res = doAct();
      const got = strip(s, before);
      if (leader()) {
        if ((got.items.length || got.gold) && res) res.text = `${res.text || ""} Into the party's loot pile: ${[got.gold ? got.gold + " gold" : "", ...got.items.map((x) => (x.qty > 1 ? `${x.qty}× ` : "") + (D.ITEMS[x.item]?.name || x.item))].filter(Boolean).join(", ")}.`.trim();
        await Store.change("runs", r.id, (x) => poolAdd(recordAct(x, step, c), got.items, got.gold));
      } else if (res && (got.items.length || got.gold)) res.text = `${res.text || ""} (Finds go to the party's loot pile.)`.trim();
      ctx.persist(true);
      return res;
    }
    /* members: replay the leader's choices in their own copy of the room */
    let replaying = false;
    function follow() {
      const s = S(), r = run(), d = s.dungeon;
      if (!d || replaying || !inPartyRun() || leader() || d.done) return false;
      const step = Math.max(0, (d.cstep || 1) - 1), acts = r.acts?.[step] || [];
      d.lvDone = d.lvDone || {};
      const done = d.lvDone[step] || 0;
      if (d.room && done < acts.length) {
        replaying = true;
        try { d.lvDone[step] = done + 1; ctx.dungeonAct(acts[done], true); } finally { replaying = false; }
        return true;
      }
      if (d.room && r.path.length > (d.cstep || 0)) { d.room = null; return true; }   // the leader has moved on: step out and follow
      return false;
    }
    function onRuns() {
      const r = run(), s = S();
      if (!r) return;
      if (partyRun(r) && leader() && s.dungeon?.done && !r.vote) Store.change("runs", r.id, (x) => startRunVote(chestToPool(x)));
      let n = 0; while (follow() && n++ < 6) {}
      if (r.vote) showVote(r.vote, `run:${r.id}`, r.id);
    }
    /* the leader ends the run early: the vote opens with what's in the pile */
    async function leaderLeaving() {
      const r = run(), s = S();
      if (!partyRun(r) || r.leader !== s.id || r.vote) return;
      s.lastRun = r.id;
      await Store.change("runs", r.id, (x) => startRunVote(chestToPool(x)));
    }

    // -- road loot: the leader's finds when the party travels together
    async function roadLoot(beforeSnap, memberIds, what) {
      const s = S();
      if (!memberIds?.length) return null;
      const got = strip(s, beforeSnap);
      s.gold += got.gold;   // gold is split by partyplay.js; only items go to the vote
      if (!got.items.length) return null;
      const id = `lv-${s.id}-${Math.floor(now() * 1000)}`;
      const vote = openVote(addTo(null, got.items, 0), [s.id, ...memberIds], s.id);
      await Store.put("lvotes", id, { ...vote, what: what || "the road", byName: s.name });
      ctx.persist(true);
      return `The party votes on: ${got.items.map((x) => D.ITEMS[x.item]?.name || x.item).join(", ")}.`;
    }
    function onVotes(docs) {
      lvotes = docs.filter((v) => v.members?.includes(S().id));
      for (const v of lvotes) showVote(v, `lv:${v.id}`, null, v.id);
      const s = S(), t = now();
      for (const v of docs) if (v.leader === s.id && t - v.t > 6 * 3600) Store.remove("lvotes", v.id);
    }

    // -- the vote screen
    function voteHTML(v, key) {
      const s = S(), mine = v.votes?.[s.id], left = Math.max(0, Math.ceil(v.ends - now()));
      const p = picks[key] || (picks[key] = new Set(mine || []));
      const rows = v.items.map((it) => {
        const nm = D.ITEMS[it.item]?.name || it.item, tier = typeof CC !== "undefined" ? CC.tier(it.item, it) : "common";
        const want = p.has(it.i), others = v.members.filter((m) => m !== s.id && (v.votes?.[m] || []).includes(it.i)).length;
        return `<div class="lv-row q-${tier}">${typeof ICONART !== "undefined" ? ICONART.item(it.item, 28, it) : ""}<span class="nm">${it.qty > 1 ? `${it.qty}× ` : ""}${esc(nm)}${others ? `<small>${others} other${others > 1 ? "s" : ""} want it</small>` : ""}</span>
          ${mine ? `<b class="lv-tag">${want ? "Want" : "Pass"}</b>` : `<button class="btn sm ${want ? "pri" : ""}" data-act="lvpick" data-k="${esc(key)}" data-i="${it.i}">${want ? "✔ Want" : "Want"}</button>`}</div>`;
      }).join("") || '<p class="sub">No items this time.</p>';
      const n = v.members.length, each = Math.floor((v.gold || 0) / n);
      return `<h2>🎲 Party loot</h2><p class="sub">${v.what ? `From ${esc(v.what)}. ` : ""}Tap <b>Want</b> on what you'd like. One person wanting it takes it; if several want it, everyone rolls a d100 and the highest wins. Nobody wants it: it goes to the leader.</p>
        ${v.gold ? `<p class="lv-gold">💰 ${v.gold} gold, split evenly: ${each} each${v.gold - each * n ? ` (+${v.gold - each * n} to the leader)` : ""}.</p>` : ""}
        <div class="lv-list">${rows}</div>
        <p class="sub lv-timer">${mine ? `Your vote is in. Waiting for ${v.members.filter((m) => !v.votes?.[m]).length} more…` : `${left}s left · no vote counts as Pass`}</p>
        ${mine ? '<button class="btn" data-act="close" style="width:100%">Close</button>' : `<button class="btn pri" data-act="lvsend" data-k="${esc(key)}" style="width:100%">Send my vote</button>`}`;
    }
    function resultHTML(v, res) {
      const s = S(), name = (uid) => (uid === s.id ? "You" : ctx.nameOf?.(uid) || "Someone");
      const lines = v.items.map((it) => {
        const roll = res.rolls.find((r) => r.i === it.i), winner = Object.keys(res.items).find((m) => res.items[m].some((x) => x.i === it.i));
        const nm = D.ITEMS[it.item]?.name || it.item;
        const dice = roll ? `<span class="lv-dice">${roll.rounds.map((rs) => rs.map((r) => `<i class="die" style="--n:${r.roll}">${r.roll}</i><small>${esc(name(r.m))}</small>`).join(" ")).join(' <em>tie, again:</em> ')}</span>` : "";
        return `<div class="lv-row ${winner === s.id ? "won" : ""}"><span class="nm">${it.qty > 1 ? `${it.qty}× ` : ""}${esc(nm)} → <b>${esc(name(winner))}</b></span>${dice}</div>`;
      }).join("");
      return `<h2>🎲 Loot shared out</h2>${v.gold ? `<p class="lv-gold">💰 Your gold: ${res.gold[s.id] || 0}</p>` : ""}<div class="lv-list">${lines || '<p class="sub">No items.</p>'}</div><button class="btn pri" data-act="close" style="width:100%">Continue</button>`;
    }
    async function showVote(v, key, runId, voteId) {
      const s = S();
      if (!v.members.includes(s.id)) return;
      if (closed(v)) {
        if (v.done?.[s.id] || (s.lootTaken || {})[key] || resultShown[key]) return;
        resultShown[key] = true;
        const res = resolve(v, key.replace(/^(run|lv):/, ""));
        const ch = runId ? await Store.change("runs", runId, (x) => (x.vote ? { ...x, vote: markDone(x.vote, s.id) } : x))
          : await Store.change("lvotes", voteId, (x) => markDone(x, s.id));
        const after = runId ? ch?.after?.vote : ch?.after, before = runId ? ch?.before?.vote : ch?.before;
        if (!after?.done?.[s.id] || before?.done?.[s.id]) { if (ch) return; }   // already taken (or offline: deliver locally once)
        const got = deliver(s, res, s.id, key);
        if (!got) return;
        ctx.persist(true);
        if (ctx.modalOpen() && shown !== key) setTimeout(() => ctx.openModal(resultHTML(v, res), "lv"), 1200); else ctx.openModal(resultHTML(v, res), "lv");
        shown = null;
        return;
      }
      if (v.votes?.[s.id]) { if (shown === key && document.querySelector("#modal .lv-list")) ctx.openModal(voteHTML(v, key), "lv"); return; }
      if (ctx.modalOpen() && shown !== key) return;   // wait for other popups
      shown = key; ctx.openModal(voteHTML(v, key), "lv");
    }
    function cur(key) {
      if (key.startsWith("run:")) { const r = (ctx.runs() || []).find((x) => x.id === key.slice(4)); return r?.vote ? { v: r.vote, runId: r.id } : null; }
      const v = lvotes.find((x) => x.id === key.slice(3)); return v ? { v, voteId: v.id } : null;
    }
    async function act(b) {
      const a = b.dataset.act, key = b.dataset.k, c = cur(key || "");
      if (!c) return;
      if (a === "lvpick") {
        const p = picks[key] || (picks[key] = new Set()), i = +b.dataset.i;
        if (p.has(i)) p.delete(i); else p.add(i);
        ctx.openModal(voteHTML(c.v, key), "lv");
      } else if (a === "lvsend") {
        const wants = [...(picks[key] || [])], s = S();
        if (c.runId) await Store.change("runs", c.runId, (x) => (x.vote ? { ...x, vote: castVote(x.vote, s.id, wants) } : x));
        else await Store.change("lvotes", c.voteId, (x) => castVote(x, s.id, wants));
        toast(wants.length ? `Vote sent: you want ${wants.length} item${wants.length > 1 ? "s" : ""}.` : "Vote sent: you pass on everything.");
        ctx.closeModal();
      }
    }
    /* timers run out on their own: check every few seconds */
    function tick() {
      const r = run();
      if (r?.vote) showVote(r.vote, `run:${r.id}`, r.id);
      for (const v of lvotes) showVote(v, `lv:${v.id}`, null, v.id);
      const m = document.querySelector("#modal .lv-timer"); if (m && shown) { const c = cur(shown); if (c && !c.v.votes?.[S().id]) m.textContent = `${Math.max(0, Math.ceil(c.v.ends - now()))}s left · no vote counts as Pass`; }
    }
    return { memberLocked, lockedHTML, aroundAct, follow, onRuns, leaderLeaving, roadLoot, onVotes, act, tick, snap: () => snap(S()) };
  }

  return { VOTE_SECONDS, partyRun, snap, strip, addTo, pileSize, openVote, castVote, closed, resolve, markDone, deliver, poolAdd, recordAct, startRunVote, chestToPool, d100, ui };
})();
