/* Parties on the road: members who are close by fight beside you (each by their own tactics), share the spoils of a won fight,
   and walk (or ride) along with you in the travel picture, each in their own gear. Nobody ever controls anyone else's hero:
   an ally's moves come from the profile their own game published (COOP.profile, built from their own tactics). */
const PARTY = (() => {
  const SHARE_SECONDS = 3 * 3600;   // a share waits this long for a member to come online and take it
  const MAX_ALLIES = 3;
  const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const isMember = (party, id) => !!party?.members?.some((m) => m.id === id);

  /* what my game publishes for my party: how I fight (from my own tactics) and whether I ride */
  function prof(s) {
    try { return typeof COOP !== "undefined" ? COOP.profile(s) : null; } catch { return null; }
  }
  function cardBits(s, party) {
    if (!party) return {};
    const riding = typeof HORSES !== "undefined" && HORSES.riding(s);
    return { pp: prof(s), ride: riding ? HORSES.coat(s.horse.coat)[2] : null, fol: s.follower?.id || null };
  }

  /* members close enough to fight with you: same dungeon, or near you on the map and not inside anywhere */
  function nearMates(s, party, cards, me, posOf, near) {
    if (!party) return [];
    return cards.filter((c) => c.id !== s.id && isMember(party, c.id) && (c.cur ?? 1) > 0 && !c.hiding
      && (s.dungeon ? c.dungeon === s.dungeon.place : (!c.dungeon && G.pxDist(posOf(c), me) <= near))).slice(0, MAX_ALLIES);
  }
  /* a party member as a fighter beside you. Uses co-op's fighting code (heals, guards, power attacks, knock-downs) */
  function allyFromCard(c) {
    let a;
    if (typeof COOP !== "undefined") a = COOP.allyFromCard({ ...c, coop: { prof: c.pp || c.coop?.prof || { dmg: c.dmg || 5, hp: c.hp || 100, red: c.red || 0, role: "fighter" } } });
    else a = { name: c.name, dmg: Math.max(2, (c.dmg || 5) * 0.7), player: true };
    return { ...a, uid: c.id, look: c.look || null, party: true };
  }
  let lastFight = { t: 0, ids: [], names: [] };   // who stood with you when the last fight began
  function allies(s, party, cards, me, posOf, near) {
    const mates = nearMates(s, party, cards, me, posOf, near);
    lastFight = { t: G.now(), ids: mates.map((c) => c.id), names: mates.map((c) => c.name) };
    return mates.map(allyFromCard);
  }
  const fought = () => lastFight;
  const clear = () => { lastFight = { t: 0, ids: [], names: [] }; };

  // ---- the spoils: one record per won fight, each member who fought takes their own share once
  function shareDoc(s, fight, ids, names, t = G.now()) {
    const e = fight?.e || {};
    const lvl = Math.max(1, e.level || s.level || 1);
    return { id: `${s.id}-${Math.floor(t * 1000)}`, doc: { by: s.id, byName: s.name, foe: e.name || "a foe", lvl, boss: !!(e.boss || (e.tags || []).includes("boss")),
      members: ids, names, claims: {}, t } };
  }
  /* a member's share, the same on every phone: some gold, skill XP for fighting, now and then a useful find */
  function roll(id, doc, uid) {
    const r = rng(hash(id + "|" + uid)), lvl = doc.lvl || 1;
    const gold = Math.round((6 + lvl * 2.5) * (0.7 + r() * 0.6) * (doc.boss ? 3 : 1));
    const xp = Math.round(6 + lvl * 1.4);
    const pool = ["potion_health", "potion_stamina", "potion_magicka", "ore_iron", "ore_corundum", "arrow_iron", "soul_gem_common"].filter((x) => D.ITEMS[x]);
    const items = [];
    if (pool.length && r() < (doc.boss ? 0.8 : 0.3)) items.push(pool[Math.floor(r() * pool.length)]);
    return { gold, xp, items };
  }
  /* inside Store.change: take my share (or leave the record as it is) */
  function claim(doc, id, uid) {
    if (!doc || !doc.members?.includes(uid) || doc.claims?.[uid] || G.now() - (doc.t || 0) > SHARE_SECONDS) return { doc, got: null };
    const got = roll(id, doc, uid);
    return { doc: { ...doc, claims: { ...(doc.claims || {}), [uid]: G.now() } }, got };
  }
  /* put a share into my save, once (my own record of claims guards against a second copy) */
  function give(s, id, doc, got) {
    if (!got) return null;
    s.pshares = s.pshares || {};
    if (s.pshares[id]) return null;
    s.pshares[id] = G.now();
    for (const k of Object.keys(s.pshares)) if (G.now() - s.pshares[k] > SHARE_SECONDS * 2) delete s.pshares[k];
    s.gold += got.gold;
    for (const it of got.items) G.give(s, it, 1);
    const sk = bestCombat(s), ups = G.useSkill(s, sk, got.xp) || [];
    return { text: `⚑ You fought beside ${doc.byName} against ${doc.foe}: +${got.gold} gold${got.items.length ? ", " + got.items.map((x) => D.ITEMS[x].name).join(", ") : ""}, ${sk} practice.`, ups };
  }
  function bestCombat(s) {
    try { const id = G.loadout(s).equipment?.weapon, r = id && G.invRow(s, id), it = r && D.ITEMS[r.item]; if (it?.skill) return it.skill; } catch { /* no weapon */ }
    return "One-Handed";
  }
  const mineToTake = (docs, uid, s) => docs.filter((d) => d && d.members?.includes(uid) && !d.claims?.[uid] && !(s.pshares || {})[d.id] && G.now() - (d.t || 0) <= SHARE_SECONDS);

  // ---- who walks with you in the travel picture
  const FOLLOWER_LOOK = {
    lydia: { r: "nord", eq: { weapon: "steel_sword", shield: "steel_shield", chest: "steel_armor", head: "steel_helmet" } },
    jenassa: { r: "dunmer", eq: { weapon: "hunting_bow", chest: "leather_armor" } },
    belrand: { r: "nord", eq: { weapon: "steel_sword", chest: "chainmail" } },
    marcurio: { r: "imperial", eq: { weapon: "staff_flames", chest: "mage_robes" } },
    vorstag: { r: "nord", eq: { weapon: "iron_war_axe", chest: "steel_armor", head: "steel_helmet" } },
    stenvar: { r: "nord", eq: { weapon: "iron_greatsword", chest: "steel_armor" } },
  };
  function followerLook(id) { const L = FOLLOWER_LOOK[id] || { r: "nord", eq: { weapon: "iron_sword", chest: "iron_armor" } }; return { r: L.r, id: "f-" + id, eq: { ...L.eq }, gl: {} }; }
  /* the company on the road with you: party members travelling near you, then your follower */
  function companions(s, party, cards, me, posOf, near) {
    const out = [];
    if (party) for (const c of cards) {
      if (c.id === s.id || !isMember(party, c.id) || c.dungeon || c.hiding) continue;
      if (G.pxDist(posOf(c), me) > near * 1.5) continue;
      out.push({ name: c.name, look: c.look || { r: c.race || "nord", id: c.name, eq: {}, gl: {} }, riding: !!c.ride, horse: c.ride || null, player: true });
      if (c.fol && typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS[c.fol]) out.push({ name: TOWNS.FOLLOWERS[c.fol][0], look: followerLook(c.fol), follower: true });
    }
    if (s.follower && typeof TOWNS !== "undefined" && TOWNS.FOLLOWERS[s.follower.id]) out.unshift({ name: TOWNS.FOLLOWERS[s.follower.id][0], look: followerLook(s.follower.id), follower: true });
    return out.slice(0, 5);
  }

  return { SHARE_SECONDS, MAX_ALLIES, isMember, prof, cardBits, nearMates, allyFromCard, allies, fought, clear, shareDoc, roll, claim, give, mineToTake, companions, followerLook, FOLLOWER_LOOK };
})();
