/* Social: friends, private messages and trading with friends from anywhere (a courier carries the offer;
   face to face in the same place it is the live trade window, tradewin.js).
   Friends live in your own save; each player also shares one small "friends" record (who they added) so the other
   side can see "added you". Private messages are records in "dms". Courier trades are ordinary trade offers
   (escrow + settle in MP) that can't be answered until the courier arrives. [OURS] */
const SOCIAL = (() => {
  const MAX_FRIENDS = 50, DM_MAX = 300, COURIER_SECONDS = 300;      // a courier takes 5 real minutes (1 in-game hour)
  const ONLINE_MS = 3 * 60 * 1000;

  const friends = (s) => s.friends || {};
  const isFriend = (s, id) => !!friends(s)[id];
  function add(s, card) {
    if (!card?.id || card.id === s.id) return "You can't add yourself.";
    if (isFriend(s, card.id)) return `${card.name} is already your friend.`;
    if (Object.keys(friends(s)).length >= MAX_FRIENDS) return `You can have up to ${MAX_FRIENDS} friends.`;
    s.friends = { ...friends(s), [card.id]: { name: card.name, t: G.now() } };
    return `${card.name} is now on your friends list.`;
  }
  function remove(s, id) {
    const f = friends(s)[id]; if (!f) return "Not on your list.";
    const next = { ...friends(s) }; delete next[id]; s.friends = next;
    return `${f.name} is off your friends list.`;
  }
  const record = (s) => ({ name: s.name, list: Object.keys(friends(s)), t: G.now() });
  /* people who added you but you haven't added back */
  const addedMe = (docs, s) => docs.filter((d) => d.id !== s.id && (d.list || []).includes(s.id) && !isFriend(s, d.id));

  /* what to show for a friend, from their live player card if there is one */
  function status(card, nowMs = Date.now()) {
    if (!card) return { online: false, text: "Not seen lately" };
    const age = nowMs - (card.updated || 0), online = age < ONLINE_MS;
    const where = card.moving ? "on the road" : card.loc || (typeof G !== "undefined" ? `near ${G.holdAt([card.x, card.y])}` : "");
    const ago = age < 3600e3 ? `${Math.max(1, Math.round(age / 60e3))} min ago` : age < 864e5 ? `${Math.round(age / 3600e3)} h ago` : `${Math.round(age / 864e5)} days ago`;
    return { online, text: online ? `Online · level ${card.level} · ${where}` : `Last seen ${ago} · level ${card.level}` };
  }

  // ---- private messages
  function dm(s, toId, toName, text, t = G.now()) {
    text = String(text || "").replace(/\s+/g, " ").trim().slice(0, DM_MAX);
    if (!text) return { err: "Write something first." };
    if (!toId || toId === s.id) return { err: "Pick someone to write to." };
    const id = `${s.id}-${Math.floor(t * 1000)}-${Math.floor(Math.random() * 900 + 100)}`;
    return { id, doc: { from: s.id, fromName: s.name, to: toId, toName, text, t } };
  }
  const thread = (docs, me, other) => docs.filter((d) => (d.from === me && d.to === other) || (d.from === other && d.to === me)).sort((a, b) => a.t - b.t);
  const unreadFrom = (s, docs, other) => docs.filter((d) => d.to === s.id && d.from === other && d.t > ((s.dmSeen || {})[other] || 0)).length;
  const unread = (s, docs) => docs.filter((d) => d.to === s.id && d.t > ((s.dmSeen || {})[d.from] || 0)).length;
  function markRead(s, docs, other) {
    const last = Math.max(0, ...thread(docs, s.id, other).map((d) => d.t));
    if (last > ((s.dmSeen || {})[other] || 0)) s.dmSeen = { ...(s.dmSeen || {}), [other]: last };
  }
  /* everyone you've talked to, newest first */
  function conversations(s, docs) {
    const by = {};
    for (const d of docs) {
      if (d.from !== s.id && d.to !== s.id) continue;
      const other = d.from === s.id ? d.to : d.from, name = d.from === s.id ? d.toName : d.fromName;
      if (!by[other] || by[other].t < d.t) by[other] = { id: other, name, t: d.t, last: d.text, mine: d.from === s.id };
    }
    return Object.values(by).sort((a, b) => b.t - a.t);
  }

  // ---- courier trades: a normal offer that arrives later
  function courierOffer(s, card, rowIds, giveGold, askGold, t = G.now()) {
    if (!isFriend(s, card.id)) return { text: "Couriers only carry offers to people on your friends list." };
    const r = MP.makeOffer(s, card, rowIds, giveGold, askGold, t);
    if (!r.doc) return r;
    r.doc.courier = true; r.doc.arrive = t + COURIER_SECONDS;
    r.text = r.text.replace(/^Offer sent/, "A courier sets off") + " It arrives in about an hour of game time.";
    return r;
  }
  const arrived = (doc, t = G.now()) => !doc.courier || t >= (doc.arrive || 0);

  return { MAX_FRIENDS, DM_MAX, COURIER_SECONDS, friends, isFriend, add, remove, record, addedMe, status, dm, thread, unread, unreadFrom, markRead, conversations, courierOffer, arrived };
})();
