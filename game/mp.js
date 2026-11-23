/* Multiplayer chaos: fighting and robbing other players, parties, and the party chest.
   Every player's save is private, so actions against someone are written as small notes ("attacks/<id>")
   that the victim's own game applies the next time it's open. Fights against a player use the stats on their public card. */
const MP = (() => {
  const rint = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const NEAR_PX = 26, PROTECT_SECONDS = 300, AMBUSH_PX = 20;

  /* what other players need to know to fight you or pick your pocket */
  function stats(s) {
    const f = new G.Fight(s, { name: "-", health: 1, damage: 0, tags: [] });
    let dmg = 0; for (let i = 0; i < 12; i++) dmg += f.weaponDamage(); dmg = dmg / 12 * F.HIT_CHANCE;
    const { rating, pieces } = f.armorRating();
    // [OURS] a defender fights back with everything: their healing potions count as extra health
    const potions = s.inv.filter((r) => D.ITEMS[r.item]?.restore?.[0] === "health").reduce((a, r) => a + D.ITEMS[r.item].restore[1] * r.qty, 0);
    return { hp: G.maxHealth(s), cur: Math.round(G.curHealth(s)), heal: Math.min(150, potions), dmg: Math.round(dmg * 10) / 10, red: Math.round(F.damageReduction(rating, pieces) * 100) / 100,
      gold: s.gold, sneak: G.skill(s, "Sneak"), bounty: TOWNS.totalBounty(s), loc: s.location || null, dungeon: s.dungeon?.place || null, safeUntil: s.safeUntil || 0 };
  }
  function canTarget(s, card, myPos, theirPos, t = G.now()) {
    if (!card) return "They're gone.";
    if ((card.safeUntil || 0) > t) return `${card.name} just came back from the dead. Give them a few minutes.`;
    if (s.dungeon || card.dungeon) return s.dungeon && card.dungeon === s.dungeon.place ? null : "One of you is inside a dungeon.";
    if (card.loc && card.loc === s.location) return null;
    if (G.pxDist(myPos, theirPos) <= NEAR_PX) return null;
    return `${card.name} is too far away. You have to be in the same place.`;
  }
  /* who saw it: in a town everyone; in the wilds 1 in 4 ([OURS]) */
  function witnessed(s) { return (s.location && TOWNS.isTown(s.location)) || Math.random() < 0.25; }

  function attack(s, card, { ambush = false, t = G.now(), pos } = {}) {
    const life = Math.max(1, card.cur || card.hp) + (card.heal || 0);
    const e = { name: card.name, health: life, hp: life, damage: card.dmg * 1.25, tags: ["humanoid"], red: card.red, level: card.level, danger: "high", gold: [0, 0], text: "", look: card.look || null, player: true };   // [OURS] defenders get a 25% home advantage
    const f = new G.Fight(s, e, null, t);
    f.allies = [];                                  // no help in a duel
    f.run({ t, hidden: ambush ? true : null, trySneak: true });
    const skills = f.apply(t);
    const hold = G.holdAt(pos || [s.x, s.y]), seen = witnessed(s);
    let bountyText = "";
    if (seen) { TOWNS.addBounty(s, hold, f.won ? "murder" : "assault"); bountyText = ` Someone saw it: your bounty in ${hold} is now ${TOWNS.bounty(s, hold)} gold.`; }
    const id = `${s.id}-${Math.floor(t)}-${rint(100, 999)}`;
    if (f.won) {
      G.note(s, `🗡 You killed ${card.name}.`); s.pvpKills = (s.pvpKills || 0) + 1;
      return { text: `${ambush ? "You burst out of hiding. " : ""}${card.name} falls. Their bag drops where they fell; for ten minutes only you and they can see it.${bountyText}`, fight: f, skills, won: true,
        doc: { type: "kill", from: s.id, fromName: s.name, to: card.id, toName: card.name, t, ambush, at: pos || [s.x, s.y] }, id, news: `🗡 ${s.name} killed ${card.name}${ambush ? " in an ambush" : ""} in ${s.location || "the wilds of " + hold}.` };
    }
    const d = typeof PVPDEATH !== "undefined" ? PVPDEATH.die(s, card.name, t) : G.die(s, card.name, t, true);
    return { text: `${card.name} was stronger than you thought.${bountyText}`, fight: f, skills, won: false, died: d.msg, bag: d.bag,
      doc: { type: "failed", from: s.id, fromName: s.name, to: card.id, toName: card.name, t }, id, news: `🛡 ${card.name} fought off ${s.name}'s attack.` };
  }

  /* one try per player every 10 real minutes, caught or not */
  const PICK_CD = 10 * 60 * 1000;
  const pickWait = (s, id, now = Date.now()) => Math.max(0, Math.ceil((((s.ppCd || {})[id] || 0) + PICK_CD - now) / 1000));
  /* what's in it and how hard it is, worked out before the try (the mini-game needs the chance up front) */
  function pickPlan(s, card) {
    const purse = Math.max(0, card.gold || 0);
    const want = Math.min(purse, Math.max(5, Math.round(purse * (0.1 + Math.random() * 0.25))));
    const chance = TOWNS.pickChance(s, { gold: want, level: card.level }) * (1 - Math.min(0.4, (card.sneak || 15) / 250));   // [OURS] alert targets are harder
    return { purse, want, chance };
  }
  /* plan (optional) = pickPlan(...) plus hit: true/false from the mini-game; without hit it's the old dice roll */
  function pickpocket(s, card, t = G.now(), now = Date.now(), plan = null) {
    const wait = pickWait(s, card.id, now);
    if (wait > 0) return { text: `${card.name} is still watching their purse after the last time. Try again in ${Math.ceil(wait / 60)} min.`, wait };
    const { purse, want, chance } = plan || pickPlan(s, card);
    if (!purse) return { text: `${card.name}'s purse is empty. Nothing to take.` };
    s.ppCd = Object.fromEntries(Object.entries(s.ppCd || {}).filter(([, v]) => now - v < PICK_CD)); s.ppCd[card.id] = now;
    const id = `${s.id}-${Math.floor(t)}-${rint(100, 999)}`;
    if (typeof plan?.hit === "boolean" ? plan.hit : Math.random() < chance) {
      s.gold += want; s.stats = { ...(s.stats || {}), pp: ((s.stats || {}).pp || 0) + 1 };
      const skills = G.useSkill(s, "Pickpocket", want);   // [Skyrim] XP = value stolen
      return { text: `Your fingers find ${card.name}'s purse. +${want} gold. They have no idea.`, skills, doc: { type: "pickpocket", from: s.id, fromName: s.name, to: card.id, amount: want, t }, id };
    }
    let bountyText = "";
    if (!G.P(s, "misdirection") && witnessed(s)) { const hold = G.holdAt([s.x, s.y]); TOWNS.addBounty(s, hold, "pickpocket"); bountyText = ` Bounty in ${hold}: ${TOWNS.bounty(s, hold)} gold.`; }
    return { text: `${card.name} catches your hand in their purse.${bountyText}`, doc: { type: "caught", from: s.id, fromName: s.name, to: card.id, t }, id, news: `👀 ${card.name} caught ${s.name} with a hand in their purse.` };
  }

  /* apply something another player did to you. Returns {text, bag?} */
  function receive(s, doc, t = G.now()) {
    if (doc.type === "kill") {
      if (s.dungeon) s.dungeon = null;
      if (doc.at && s.trip) [s.x, s.y] = doc.at;   // you fell where it happened, not where your trip would have taken you
      const d = typeof PVPDEATH !== "undefined" ? PVPDEATH.die(s, doc.fromName, t) : G.die(s, doc.fromName, t, true);
      if (d.bag) { d.bag.killerId = doc.from; d.bag.killerName = doc.fromName; d.bag.t = t; }
      s.safeUntil = t + PROTECT_SECONDS;
      return { text: `${doc.fromName} ${doc.ambush ? "ambushed and " : ""}killed you while you were ${doc.ambush ? "on the road" : "out"}. ${d.msg}`, bag: d.bag, bad: true };
    }
    if (doc.type === "failed") return { text: `${doc.fromName} attacked you and lost. Their bag is lying where it happened, if you're quick.` };
    if (doc.type === "pickpocket") { const lost = Math.min(s.gold, doc.amount); s.gold -= lost; return lost ? { text: `Your purse feels lighter. Someone took ${lost} gold.`, bad: true } : null; }
    if (doc.type === "caught") return { text: `You caught ${doc.fromName} with a hand in your purse. You still have everything.` };
    return null;
  }

  // ---- parties: the slowest member sets the pace; members fight alongside each other
  function partySpeed(s, party, cards) {
    let v = G.speed({ ...s, trip: null });
    for (const m of party.members) { const c = cards.find((o) => o.id === m.id); if (c?.speed) v = Math.min(v, c.speed); }
    return v;
  }
  function allyFromCard(c) { return { name: c.name, dmg: Math.max(2, (c.dmg || 5) * 0.7), player: true }; }   // [OURS] allies hit for 70% of their usual damage

  // ---- the party chest
  function shareOf(chest, uid) {
    const n = chest.members.length, idx = Math.max(0, chest.members.findIndex((m) => m.id === uid));
    return { gold: Math.floor(chest.gold0 / n), items: chest.items0.filter((_, i) => i % n === idx) };
  }

  // ---- trading: what you offer leaves your pack at once (held in the offer) so nothing can be spent twice
  const rowCopy = (r) => ({ item: r.item, qty: r.qty, charge: r.charge ?? null, temper: r.temper || 0, tq: r.tq || 0, stolen: !!r.stolen, ...(typeof CRAFTFAIR !== "undefined" ? CRAFTFAIR.pack(r) : {}) });
  function giveRow(s, x) { const id = G.give(s, x.item, x.qty, x.charge); const r = G.invRow(s, id); if (r && (x.temper || x.stolen)) Object.assign(r, { temper: x.temper, tq: x.tq, stolen: x.stolen }); if (typeof CRAFTFAIR !== "undefined") CRAFTFAIR.carry(s, id, x, x.qty); }
  function makeOffer(s, card, rowIds, giveGold, askGold, t = G.now()) {
    giveGold = Math.max(0, Math.floor(+giveGold || 0)); askGold = Math.max(0, Math.floor(+askGold || 0));
    const eq = new Set(Object.values(G.loadout(s).equipment));
    const rows = rowIds.map((id) => G.invRow(s, id)).filter((r) => r && !eq.has(r.id) && !D.ITEMS[r.item]?.noTrade);   // dragon priest masks are bound to you
    if (!rows.length && !giveGold) return { text: "Put something in the offer: items or gold." };
    if (giveGold > s.gold) return { text: `You only have ${s.gold} gold.` };
    const items = rows.map(rowCopy);
    rows.forEach((r) => G.take(s, r.id, r.qty));
    s.gold -= giveGold;
    const id = `${s.id}-${Math.floor(t)}-${rint(100, 999)}`;
    return { id, doc: { from: s.id, fromName: s.name, to: card.id, toName: card.name, items, gold: giveGold, ask: askGold, status: "open", t },
      text: `Offer sent to ${card.name}: ${describe({ items, gold: giveGold })}${askGold ? ` for ${askGold} gold` : " as a gift"}.` };
  }
  const describe = (o) => [o.gold ? `${o.gold} gold` : "", ...o.items.map((x) => `${D.ITEMS[x.item]?.name || x.item}${x.qty > 1 ? ` ×${x.qty}` : ""}`)].filter(Boolean).join(", ") || "nothing";
  /* the receiver says yes: pay what was asked, take the goods. Returns null if they can't afford it */
  function accept(s, doc) {
    if (doc.status !== "open" || doc.to !== s.id) return null;
    if (s.gold < doc.ask) return null;
    s.gold -= doc.ask; s.gold += doc.gold; doc.items.forEach((x) => giveRow(s, x));
    return { ...doc, status: "accepted", paid: doc.ask };
  }
  /* the sender's game settles a finished offer: the price, or the goods back */
  function settle(s, doc) {
    if (doc.from !== s.id) return null;
    if (doc.status === "accepted") { s.gold += doc.paid || 0; return `${doc.toName} accepted your offer${doc.paid ? `: +${doc.paid} gold` : ""}.`; }
    if (doc.status === "declined" || doc.status === "cancelled") { s.gold += doc.gold; doc.items.forEach((x) => giveRow(s, x)); return doc.status === "declined" ? `${doc.toName} turned down your offer. Your things are back in your pack.` : "Offer withdrawn. Your things are back in your pack."; }
    return null;
  }
  /* leaderboard entry, shared by everyone */
  const ladder = (s) => ({ name: s.name, race: s.race, level: s.level, gold: s.gold, dragons: s.dragons || 0, cleared: Object.keys(s.cleared || {}).length, kills: s.pvpKills || 0,
    ...(typeof ARENA !== "undefined" && s.arena && s.arena.season === ARENA.season() ? { arena: s.arena, arenaRating: s.arena.rating } : {}), t: G.now() });

  return { makeOffer, accept, settle, describe, ladder, NEAR_PX, AMBUSH_PX, stats, canTarget, attack, pickpocket, pickPlan, pickWait, PICK_CD, receive, partySpeed, allyFromCard, shareOf, witnessed };
})();
