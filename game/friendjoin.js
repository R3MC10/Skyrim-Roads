/* Friends you can join [OURS]: the Friends list shows what each online friend is doing (where they are, fighting / in a
   dungeon / trading / idle, level, and their party with how full it is), and an "Ask to join" button.
   - Presence: my public player card carries a small "fj" object (cardBits) with what I'm doing and my party's size and
     leader. Old games just ignore the extra field.
   - Ask to join: a "joinreq" record goes to the friend's party leader (or the friend, if they're alone). It travels like
     every other shared record, so it works on both lines (server world and phone-to-phone, store.js bothLines). Games
     that don't know the "joinreq" collection drop it (store.js/hub.js only merge collections they list).
   - The leader gets an Accept / Decline card (invites.js, kind "join"). Accept runs the normal party invite (ui.js
     invite), and the asker's game takes that invite by itself, through the normal join path (acceptInvite).
   - Off when the party is full (8 players; followers don't count) or the friend is in a dungeon run (ask after it).
     One open request at a time, a short wait per person, a few per five minutes; an unanswered request runs out.
   Pure part on top (node-tested), screen part in mount(). */
const FRIENDJOIN = (() => {
  const CAP = 8;              // players in a party; followers and pets don't count
  const TIMEOUT = 60;         // seconds a request waits for an answer
  const COOLDOWN = 20;        // seconds before you can ask the same person again
  const WINDOW = 300, PER_WINDOW = 4;   // at most 4 requests in 5 minutes
  const ONLINE_MS = 3 * 60 * 1000;
  const COL = "joinreq";
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);

  /* ---------------------------------------------------------------- presence */
  /* what I'm doing right now. flags: { fighting, trading } from the screens (ui.js knows them) */
  function activity(s, flags = {}) {
    if (!s) return "idle";
    if (s.dungeon) return "dungeon";
    if (flags.fighting || s.encounter) return "fight";
    if (flags.trading) return "trade";
    if (s.trip && s.trip.status === "travel") return "travel";
    return "idle";
  }
  /* the bits that ride on my public card */
  function cardBits(s, party, flags = {}) {
    const members = (party && party.members) || [];
    const inParty = !!party && members.length > 1;
    return { fj: { a: activity(s, flags), pn: inParty ? members.length : 0, pl: inParty ? party.leader : null, pln: inParty ? party.leaderName || null : null } };
  }
  const ACT = { fight: "fighting", dungeon: "in a dungeon", trade: "trading", travel: "travelling", idle: "idle" };
  /* what to show for a friend, from their live card. Works with old cards too (no fj: party from card.party only) */
  function presence(card, nowMs = Date.now()) {
    if (!card || !card.name) return { online: false, line: "Not seen lately", party: null };
    const online = nowMs - (card.updated || 0) < ONLINE_MS;
    const fj = card.fj && typeof card.fj === "object" ? card.fj : null;
    const act = card.dungeon ? "dungeon" : fj && ACT[fj.a] ? fj.a : card.moving ? "travel" : "idle";
    const hold = () => { try { return typeof G !== "undefined" && G.holdAt ? G.holdAt([card.x, card.y]) : ""; } catch { return ""; } };
    const where = card.dungeon ? String(card.dungeon) : card.moving ? "on the road" : card.loc ? String(card.loc) : (hold() ? `near ${hold()}` : "out in the wild");
    const n = fj ? Math.max(0, Math.min(CAP, fj.pn | 0)) : 0;
    const party = n > 1 ? { n, cap: CAP, full: n >= CAP, leader: fj.pl || null, leaderName: fj.pln || null, lead: fj.pl === card.id } : null;
    const actText = act === "travel" || act === "dungeon" ? "" : ACT[act];   // "on the road" / the dungeon name already say it
    const line = [`Level ${card.level || 1}`, where, actText].filter(Boolean).join(" · ");
    const partyLine = party ? (party.lead ? `Leads a party · ${n}/${CAP}` : `In ${party.leaderName || "someone"}'s party · ${n}/${CAP}`) + (party.full ? " · full" : "")
      : card.party && !fj ? "In a party" : "On their own";
    return { online, act, where, level: card.level || 1, party, line, partyLine };
  }
  /* who gets the request: the friend's party leader, or the friend when they're alone */
  function target(card) {
    const fj = card && card.fj;
    if (fj && fj.pl && fj.pn > 1 && fj.pl !== card.id) return { id: fj.pl, name: fj.pln || card.name, viaLeader: true };
    return { id: card.id, name: card.name, viaLeader: false };
  }

  /* ---------------------------------------------------------------- requests */
  const reqId = (fromId, toId) => `${fromId}>${toId}`;
  const isOpen = (d, t = nowS()) => !!d && d.st === "open" && t - (d.t || 0) < TIMEOUT;
  /* the outcome of my request: waiting, yes, no, full, timeout */
  function outcome(d, t = nowS()) {
    if (!d) return null;
    if (d.st === "open") return t - (d.t || 0) < TIMEOUT ? "waiting" : "timeout";
    return ["yes", "no", "full"].includes(d.st) ? d.st : null;
  }
  /* rate limit. log: [{ to, t }] of my recent requests */
  function rateWait(log, toId, t = nowS()) {
    const recent = (log || []).filter((x) => t - x.t < WINDOW);
    const last = recent.filter((x) => x.to === toId).reduce((m, x) => Math.max(m, x.t), -Infinity);
    if (t - last < COOLDOWN) return Math.ceil(COOLDOWN - (t - last));
    if (recent.length >= PER_WINDOW) return Math.ceil(WINDOW - (t - Math.min(...recent.map((x) => x.t))));
    return 0;
  }
  /* can I ask to join this friend? me: my save; myParty: my party record; docs: joinreq records; log: my rate log */
  function canAsk(me, card, myParty, docs, log, t = nowS(), nowMs = t * 1000) {
    if (!card) return { ok: false, why: "They're offline." };
    const p = presence(card, nowMs);
    if (!p.online) return { ok: false, why: "They're offline." };
    const tg = target(card);
    if (myParty && (myParty.members || []).some((m) => m.id === card.id)) return { ok: false, hide: true, why: "Already in your party." };
    if (tg.id === me.id) return { ok: false, hide: true, why: "That's your party." };
    if (card.dungeon) return { ok: false, why: "In a dungeon run. Ask when they're out." };
    if (p.party && p.party.full) return { ok: false, why: `Their party is full (${CAP}/${CAP}).` };
    const mine = (docs || []).find((d) => d && d.from === me.id && isOpen(d, t));
    if (mine) return { ok: false, waiting: mine.to === tg.id, why: mine.to === tg.id ? "Asked. Waiting for an answer…" : "You're already waiting on another answer." };
    const w = rateWait(log, tg.id, t);
    if (w > 0) return { ok: false, why: `Wait ${w} s before asking again.` };
    return { ok: true, to: tg };
  }
  /* the request record */
  function makeReq(me, card, t = nowS()) {
    const tg = target(card);
    return { id: reqId(me.id, tg.id), doc: { from: me.id, fromName: me.name, fromLevel: me.level || 1, ...(typeof AVATAR !== "undefined" ? { fromAv: AVATAR.of(me) } : {}), to: tg.id, toName: tg.name, via: card.id, viaName: card.name, t, st: "open" } };
  }
  /* open requests waiting for me (I'm the leader, or alone) */
  const incoming = (docs, myId, t = nowS()) => (docs || []).filter((d) => d && d.to === myId && d.from !== myId && isOpen(d, t)).sort((a, b) => b.t - a.t);
  /* my answer. party: my party record (null when I'm alone) */
  function answer(doc, yes, party, t = nowS()) {
    if (!isOpen(doc, t)) return { err: "That request ran out." };
    let st = yes ? "yes" : "no";
    if (yes && party && (party.members || []).length + (party.invites || []).filter((x) => x !== doc.from).length >= CAP) st = "full";
    if (yes && party && party.leader !== doc.to) return { err: "Only your party leader can take people in." };
    const { id, ...rest } = doc;
    return { st, doc: { ...rest, st, at: t } };
  }
  /* cards for invites.js */
  function inviteCards(docs, myId, party, t = nowS()) {
    const n = party ? (party.members || []).length : 1, full = n >= CAP;
    return incoming(docs, myId, t).map((d) => ({ key: "join:" + d.id, kind: "join", id: d.id, from: d.fromName, uid: d.from, av: d.fromAv || "", t: d.t || 0,
      text: `${d.fromName} asks to join your party`, sub: full ? `Your party is full (${n}/${CAP})` : `Level ${d.fromLevel || 1}${d.via && d.via !== myId ? ` · friend of ${d.viaName}` : ""} · party ${n}/${CAP}`, can: true, full }));
  }

  /* ---------------------------------------------------------------- screen part
     ctx: { S, party, cardOf, Store, toast, invite(card), invites(), acceptInvite(pid), fighting(), trading(), publishCard(force), bump, refresh } */
  let ctx = null, docs = [], log = [], told = new Set(), joined = new Set(), lastAct = null, tick = null;
  const S = () => (ctx && ctx.S ? ctx.S() : null);
  function mount(c) {
    ctx = c;
    if (!ctx.Store || !ctx.Store.watch) return;
    ctx.Store.watch(COL, (d) => { docs = (d || []).filter((x) => x && typeof x.from === "string" && typeof x.to === "string"); check(); ctx.refreshInvites?.(); ctx.bump?.(); });
    clearInterval(tick); tick = setInterval(check, 1000);
  }
  function check() {
    const s = S(); if (!s || !ctx) return;
    const t = nowS();
    // my outgoing request: tell me how it went, and take the invite when they said yes
    for (const d of docs) {
      if (d.from !== s.id) continue;
      const o = outcome(d, t), key = d.id + ":" + d.t;
      if (o === "yes") {
        const inv = (ctx.invites?.() || []).find((p) => p.leader === d.to);
        if (inv && !joined.has(key)) { joined.add(key); told.add(key); ctx.acceptInvite?.(inv.id); }
        else if (!told.has(key) && t - (d.at || d.t) > 20) { told.add(key); ctx.toast?.(`${d.toName} said yes. Accept their party invite at the top.`); }
      } else if (o === "no" && !told.has(key)) { told.add(key); ctx.toast?.(`${d.toName} can't take you in right now.`); }
      else if (o === "full" && !told.has(key)) { told.add(key); ctx.toast?.(`${d.toName}'s party is full.`); }
      else if (o === "timeout" && !told.has(key) && t - d.t < TIMEOUT + 30) { told.add(key); ctx.toast?.(`No answer from ${d.toName}.`); ctx.bump?.(); }
    }
    // my own presence: publish when what I'm doing or my party's size changes
    const a = JSON.stringify(cardBits(s, ctx.party?.(), flags()));
    if (a !== lastAct) { lastAct = a; ctx.publishCard?.(false); }
  }
  const flags = () => ({ fighting: !!ctx?.fighting?.(), trading: !!ctx?.trading?.() });
  /* the Friends row: two lines and the button */
  function rowHTML(card, esc) {
    const s = S(); if (!s || !card) return null;
    const p = presence(card);
    if (!p.online) return null;
    const c = canAsk(s, card, ctx.party?.(), docs, log);
    const btn = c.hide ? "" : `<button class="btn sm ${c.ok ? "pri" : ""}" data-act="fjoin" data-id="${esc(card.id)}"${c.ok ? "" : ` disabled aria-disabled="true" title="${esc(c.why)}"`}>Ask to join</button>`;
    const act = p.act && p.act !== "idle" ? `<b class="fj-act fj-${esc(p.act)}">${esc(ACT[p.act])}</b>` : "";
    return { line: p.line, party: p.partyLine, act, btn, why: c.ok || c.hide ? "" : c.why, full: !!(p.party && p.party.full) };
  }
  async function ask(friendId) {
    const s = S(); if (!s || !ctx) return;
    const card = ctx.cardOf?.(friendId);
    const c = canAsk(s, card, ctx.party?.(), docs, log);
    if (!c.ok) { if (!c.hide) ctx.toast?.(c.why); return; }
    const r = makeReq(s, card);
    log = [...log.filter((x) => nowS() - x.t < WINDOW), { to: r.doc.to, t: r.doc.t }];
    docs = [...docs.filter((d) => d.id !== r.id), { ...r.doc, id: r.id }];
    await ctx.Store.put(COL, r.id, r.doc);
    ctx.toast?.(r.doc.to === card.id ? `Asked ${card.name} to let you join.` : `Asked ${r.doc.toName}, who leads ${card.name}'s party, to let you join.`);
    ctx.bump?.(); ctx.render?.();
  }
  /* the leader taps Accept / Decline on the card */
  async function reply(id, yes) {
    const s = S(); if (!s || !ctx) return;
    const d = docs.find((x) => x.id === id);
    if (!d) return ctx.toast?.("That request is gone.");
    const party = ctx.party?.();
    const r = answer(d, yes, party);
    if (r.err) { ctx.toast?.(r.err); ctx.refreshInvites?.(); return; }
    if (r.st === "yes") await ctx.invite?.({ id: d.from, name: d.fromName });
    docs = docs.map((x) => (x.id === id ? { ...r.doc, id } : x));
    await ctx.Store.put(COL, id, r.doc);
    if (r.st === "no") ctx.toast?.(`You turned down ${d.fromName}.`);
    else if (r.st === "full") ctx.toast?.("Your party is full.");
    ctx.refreshInvites?.();
  }
  /* [avatars] each card carries the asker's portrait: their live card, else the one they sent with the request */
  const cards = () => { const s = S(); return s ? inviteCards(docs, s.id, ctx.party?.()).map((c) => (typeof AVATAR !== "undefined" ? { ...c, pic: AVATAR.face(ctx.cardOf?.(c.uid), c.av, 30) } : c)) : []; };
  const bits = (s, party) => cardBits(s, party, flags());

  return { CAP, TIMEOUT, COOLDOWN, WINDOW, PER_WINDOW, COL, activity, cardBits, presence, target, reqId, isOpen, outcome, rateWait, canAsk, makeReq, incoming, answer, inviteCards,
    mount, check, rowHTML, ask, reply, cards, bits, _set: (d, l) => { if (d) docs = d; if (l) log = l; } };
})();
if (typeof module !== "undefined") module.exports = FRIENDJOIN;
