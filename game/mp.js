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
    const e = { name: card.name, health: life, hp: life, damage: card.dmg * 1.25, tags: ["humanoid"], red: card.red, level: card.level, danger: "high", gold: [0, 0], text: "" };   // [OURS] defenders get a 25% home advantage
    const f = new G.Fight(s, e, null, t);
    f.allies = [];                                  // no help in a duel
    f.run({ t, hidden: ambush ? true : null, trySneak: true });
    const skills = f.apply(t);
    const hold = G.holdAt(pos || [s.x, s.y]), seen = witnessed(s);
    let bountyText = "";
    if (seen) { TOWNS.addBounty(s, hold, f.won ? "murder" : "assault"); bountyText = ` Someone saw it: your bounty in ${hold} is now ${TOWNS.bounty(s, hold)} gold.`; }
    const id = `${s.id}-${Math.floor(t)}-${rint(100, 999)}`;
    if (f.won) {
      G.note(s, `🗡 You killed ${card.name}.`);
      return { text: `${ambush ? "You burst out of hiding. " : ""}${card.name} falls. Their bag drops where they fell; for ten minutes only you and they can see it.${bountyText}`, fight: f, skills, won: true,
        doc: { type: "kill", from: s.id, fromName: s.name, to: card.id, toName: card.name, t, ambush, at: pos || [s.x, s.y] }, id, news: `🗡 ${s.name} killed ${card.name}${ambush ? " in an ambush" : ""} in ${s.location || "the wilds of " + hold}.` };
    }
    const d = G.die(s, card.name, t, true);
    return { text: `${card.name} was stronger than you thought.${bountyText}`, fight: f, skills, won: false, died: d.msg, bag: d.bag,
      doc: { type: "failed", from: s.id, fromName: s.name, to: card.id, toName: card.name, t }, id, news: `🛡 ${card.name} fought off ${s.name}'s attack.` };
  }

  function pickpocket(s, card, t = G.now()) {
    const purse = Math.max(0, card.gold || 0);
    const want = Math.min(purse, Math.max(5, Math.round(purse * (0.1 + Math.random() * 0.25))));
    const chance = TOWNS.pickChance(s, { gold: want, level: card.level }) * (1 - Math.min(0.4, (card.sneak || 15) / 250));   // [OURS] alert targets are harder
    const id = `${s.id}-${Math.floor(t)}-${rint(100, 999)}`;
    if (!purse) return { text: `${card.name}'s purse is empty. Nothing to take.` };
    if (Math.random() < chance) {
      s.gold += want;
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
      const d = G.die(s, doc.fromName, t, true);
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

  return { NEAR_PX, AMBUSH_PX, stats, canTarget, attack, pickpocket, receive, partySpeed, allyFromCard, shareOf, witnessed };
})();
