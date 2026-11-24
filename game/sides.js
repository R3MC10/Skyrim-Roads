/* sides.js: pick a side instead of clans. [OURS]
   Remigiusz: "instead of player guilds, i want players to pick a side. Stormcloaks, Aldmeri Dominion, Imperials. each
   faction can attack but not must each other freely no matter where (bounty still applies)."
   - At level 20 every player is asked once to join the Stormcloaks, the Imperial Legion or the Aldmeri Dominion. They can
     put it off ("Decide later"); the choice then waits in Social → Faction. Switching later costs gold, a week's wait
     since the last pick, your side rank, and the side perks you took (their points come back).
   - Sides replace clans everywhere clans used to count: weekly war points per hold (wars.js), who rules a hold, the
     Jarl vote and taxes (holdrule.js), side chat, the [TAG] next to names on the map. The old clans module stays only
     to read old records: CLANS.of / byId / members / banners / all now answer with sides (so wars.js and holdrule.js
     work unchanged), and CLANS.legacy keeps the old clan logic for old guild halls (halls.js).
   - Old clans are disbanded with a friendly note the next time a member opens the game. Holds a clan held go back to
     nobody (any side can claim them fresh); the old guild hall stays open to everyone who was in that clan.
   - PvP: players of different sides may attack each other anywhere in the same hold, never forced (a confirm first).
     Same-side attacks keep the old rules (same place, and the loser dies and drops their gear). Nobody can attack, or be
     attacked by, a player under level 20 or without a side, someone in their own party, anyone inside a dungeon run, or
     someone knocked down in the last 10 minutes. Cross-side fights are played turn by turn like every player fight
     (tbfight.js via MP-style fights against the defender's public card); the loser is knocked down (a quarter of their
     health, keeps gear and gold) and the winner gets side war points, a little gold and a trophy (only for the first two
     wins over the same player in a day). Witnesses still raise your bounty (assault).
   Shared data: collection "sides", one record per player (id = their id): side, name, level, rank points. Attacks go
   through the existing "attacks" collection (types "warknock" and "warheld"). */
const SIDES = (() => {
  const MIN_LEVEL = 20;
  const WEEK = 7 * 864e5;
  const SAFE = 600;              // seconds (G.now()) of protection after being knocked down
  const KNOCK_HP = 0.25;         // the loser wakes with a quarter of their health
  const DEF_EDGE = 1.25;         // the defender fights a little harder (they didn't ask for it), like other player fights (mp.js)
  const REWARD_PER_DAY = 2;      // wins over the same player that pay out, per real day
  const RANK_AT = [0, 100, 300, 650, 1200];   // rank XP for ranks 1-5
  /* rank XP, earned only while you wear your side's cloak (cloaks.js). Roughly: rank 2 = 50 fights, or 4 dungeons
     (their fights included), or 4 wins over other players; rank 5 = about 45 dungeons or 40 player wins all told. */
  const XP = { fight: 2, dungeon: 15, raid: 8, duel: 10, event: 12, pvp: 30, held: 20 };
  const NORTH = ["Haafingar", "Hjaalmarch", "The Pale", "Winterhold", "Eastmarch"];
  const LIST = {
    stormcloak: { id: "stormcloak", name: "Stormcloaks", full: "the Stormcloak Rebellion", tag: "SC", colors: ["#2b4f78", "#e8e2d2"], leader: "Ulfric Stormcloak", seat: "Windhelm",
      pitch: "Skyrim for the Nords. Ulfric's rebels want the Empire and the Thalmor out, and old Talos back in the shrines.",
      bonus: ["One-handed blows hit harder in the northern holds", "Frost bites you less", "Hit rival soldiers harder"],
      ranks: ["Unblooded", "Ice-Veins", "Bone-Breaker", "Snow-Hammer", "Stormblade"] },
    imperial: { id: "imperial", name: "Imperial Legion", full: "the Imperial Legion", tag: "IL", colors: ["#8c2b22", "#d9b25a"], leader: "General Tullius", seat: "Solitude",
      pitch: "Order, roads and the law. The Legion holds the Empire together and keeps Skyrim's guards on your side.",
      bonus: ["A raised shield stops more", "Fines and bribes cost less", "Take less damage from rival soldiers"],
      ranks: ["Auxiliary", "Quaestor", "Praefect", "Tribune", "Legate"] },
    thalmor: { id: "thalmor", name: "Aldmeri Dominion", full: "the Aldmeri Dominion", tag: "AD", colors: ["#26292e", "#d6b45c"], leader: "Elenwen", seat: "the Thalmor Embassy",
      pitch: "The elves of the Summerset Isles. Patient, clever and dangerous: magic first, then everything else.",
      bonus: ["Destruction spells cost less", "Magicka comes back faster", "Spells hit rival soldiers harder"],
      ranks: ["Initiate", "Agent", "Justiciar", "Inquisitor", "First Emissary"] },
  };
  const IDS = Object.keys(LIST);
  const PERK_SIDE = { sc_nord_steel: "stormcloak", sc_winter_born: "stormcloak", sc_sons_of_skyrim: "stormcloak",
    im_shield_drill: "imperial", im_writ: "imperial", im_legion_drill: "imperial",
    ad_focus: "thalmor", ad_wellspring: "thalmor", ad_justiciar: "thalmor" };
  let clock = null;
  const now = () => (clock ? clock() : Date.now());
  const gnow = () => (typeof G !== "undefined" && G.now ? G.now() : now() / 1000);
  const lvl = (x) => (x && x.level) || 1;

  // ---------------------------------------------------------------- your side
  const mine = (s) => (s && s.side && LIST[s.side.id] ? s.side.id : null);
  const needsPick = (s) => !!s && lvl(s) >= MIN_LEVEL && !mine(s);
  const shouldPrompt = (s) => needsPick(s) && !s.sideAsked;
  function later(s) { s.sideAsked = true; return "The letters wait in your Journal (Pick a Side). Visit the recruiters when you're ready."; }
  const switchCost = (s) => 1500 + 50 * lvl(s);
  /* when you can switch again (ms timestamp; 0 = now) */
  const switchAt = (s) => (mine(s) ? (s.side.since || 0) + WEEK : 0);
  function rank(s) {
    const id = mine(s); if (!id) return null;
    const pts = Math.max(0, Math.floor(s.side.pts || 0));
    let i = 0; while (i + 1 < RANK_AT.length && pts >= RANK_AT[i + 1]) i++;
    return { i, name: LIST[id].ranks[i], pts, next: i + 1 < RANK_AT.length ? { name: LIST[id].ranks[i + 1], at: RANK_AT[i + 1] } : null };
  }
  const rankName = (id, i) => (LIST[id] ? LIST[id].ranks[Math.max(0, Math.min(4, i | 0))] : "");
  /* join a side (first time free; later: gold, a week since the last pick, rank and side perks) -> { text } or { err } */
  function pick(s, id, t = now()) {
    if (!LIST[id]) return { err: "That isn't one of the three sides." };
    if (lvl(s) < MIN_LEVEL) return { err: `Sides take recruits from level ${MIN_LEVEL}.` };
    const cur = mine(s);
    if (cur === id) return { err: `You already fight for the ${LIST[id].name}.` };
    let cost = 0, refunded = 0;
    if (cur) {
      if (t < switchAt(s)) { const d = Math.ceil((switchAt(s) - t) / 864e5); return { err: `You changed sides less than a week ago. Wait ${d} more day${d > 1 ? "s" : ""}.` }; }
      cost = switchCost(s);
      if ((s.gold || 0) < cost) return { err: `Changing sides costs ${cost} gold. You have ${s.gold || 0}.` };
      s.gold -= cost;
      for (const [pid, side] of Object.entries(PERK_SIDE)) if (side === cur && s.perks && s.perks[pid]) { refunded += s.perks[pid]; delete s.perks[pid]; }
    }
    s.side = { id, since: t, pts: 0, prev: cur || null, beat: {} };
    s.sideAsked = true;
    const L = LIST[id];
    const text = cur
      ? `You tear off the colours of the ${LIST[cur].name} and swear yourself to the ${L.name} for ${cost} gold. You start again as ${L.ranks[0]}.${refunded ? ` Your old side's perks are gone; ${refunded} perk point${refunded > 1 ? "s" : ""} came back.` : ""}`
      : `You swear yourself to the ${L.name}. ${L.leader} will hear your name. Rank: ${L.ranks[0]}.`;
    return { text, switched: !!cur, cost, refunded };
  }
  /* rank points: every war point you earn for your side (wars.js calls this) */
  function addPts(s, n) { if (mine(s) && n > 0) s.side.pts = Math.min(1e6, (s.side.pts || 0) + n); }
  const xpFns = [];
  const wearing = (s) => typeof SIDECLOAK === "undefined" || !!SIDECLOAK.active(s);
  /* rank XP for something you did (only with your side's cloak on) -> { xp, kind, rank, up } or null */
  function gainXp(s, kind, n = 1) {
    const amt = Math.round((XP[kind] || 0) * n);
    if (!mine(s) || amt <= 0 || !wearing(s)) return null;
    const before = rank(s).i;
    addPts(s, amt);
    const r = rank(s), res = { xp: amt, kind, rank: r, up: r.i > before };
    for (const f of xpFns) { try { f(s, res); } catch (e) { /* a listener never breaks the game */ } }
    return res;
  }
  /* progress inside the current rank (the Faction tab's bar) */
  function xpBar(s) {
    const r = rank(s); if (!r) return null;
    const lo = RANK_AT[r.i], hi = r.next ? r.next.at : null;
    return { pts: r.pts, lo, hi, pct: hi ? Math.max(0, Math.min(1, (r.pts - lo) / (hi - lo))) : 1 };
  }

  // ---------------------------------------------------------------- old clans: disband with a friendly note
  function migrate(s) {
    if (!s || !s.clan) return null;
    s.clanOld = s.clan; s.clan = null;
    return "🏴 Player clans are gone: from level 20 everyone picks a side in the war instead (Stormcloaks, Imperial Legion or Aldmeri Dominion). Your clan has been disbanded. Its guild hall stays open to everyone who was in it, and any hold it ruled is free for the sides to take.";
  }
  /* may this player use an old clan's guild hall? (halls.js) */
  function oldHall(s, h) {
    if (!s || !h || !h.clan) return false;
    if (s.id === h.founder) return true;
    if (s.clanOld !== h.clan) return false;
    const L = typeof CLANS !== "undefined" ? CLANS.legacy : null, rec = L && L.byId ? L.byId(h.clan) : null;
    return !rec || L.valid(rec, s.id);
  }

  // ---------------------------------------------------------------- shared records ("sides")
  let docs = new Map(), cards = new Map(), self = null;
  function record(s) {
    const id = mine(s); if (!id) return null;
    return { uid: s.id, name: s.name, side: id, level: lvl(s), pts: Math.floor(s.side.pts || 0), since: s.side.since || 0, t: gnow() };
  }
  function setDocs(list, me) {
    if (list) {
      const m = new Map();
      for (const d of list) {
        const uid = d && (d.uid || d.id);
        if (!uid || typeof uid !== "string" || (d.id && d.uid && d.id !== d.uid) || !LIST[d.side] || typeof d.name !== "string") continue;
        m.set(uid, { uid, name: d.name.slice(0, 40), side: d.side, level: +d.level || 1, pts: Math.max(0, +d.pts || 0), since: +d.since || 0 });
      }
      docs = m;
    }
    if (me) { self = me; const r = record(me); if (r) docs.set(me.id, r); else docs.delete(me.id); }
  }
  /* other players' public cards (ui.js): their side shows even before their "sides" record arrives */
  function setCards(list) { cards = new Map((list || []).filter((c) => c && c.id).map((c) => [c.id, c])); }
  function of(uid, me = self) {
    if (!uid) return null;
    if (me && uid === me.id) return mine(me);
    const d = docs.get(uid); if (d) return d.side;
    const c = cards.get(uid); return c && LIST[c.side] ? c.side : null;
  }
  const members = (id) => [...docs.values()].filter((d) => d.side === id).sort((a, b) => b.pts - a.pts || (a.name < b.name ? -1 : 1)).map((d) => ({ id: d.uid, name: d.name, level: d.level, pts: d.pts, rank: rankOfPts(d.pts) }));
  function rankOfPts(p) { let i = 0; while (i + 1 < RANK_AT.length && p >= RANK_AT[i + 1]) i++; return i; }
  const cardBits = (s) => ({ side: mine(s), sideRank: mine(s) ? rank(s).i : null });

  // ---------------------------------------------------------------- sides dressed as clans (wars.js, holdrule.js, ui.js keep working)
  const asClanCache = {};
  function asClan(id) {
    if (!LIST[id]) return null;
    const L = LIST[id];
    return (asClanCache[id] = asClanCache[id] || { id, side: true, name: L.name, tag: L.tag, colors: L.colors, founder: null, founderName: L.leader, invites: [], kicked: [] });
  }
  /* side-wide numbers for the Faction tab: members, holds held now, this week's war score */
  function standings(me = self) {
    const out = Object.fromEntries(IDS.map((id) => [id, { id, members: members(id).length, holds: 0, score: 0 }]));
    if (typeof WARS !== "undefined") {
      try {
        for (const c of Object.values(WARS.rulers(me))) if (c && out[c.id]) out[c.id].holds++;
        for (const list of Object.values(WARS.standings(WARS.week(), me))) for (const row of list) if (row.clan && out[row.clan.id]) out[row.clan.id].score += row.pts;
      } catch (e) { /* no world yet */ }
    }
    return IDS.map((id) => out[id]).sort((a, b) => b.holds - a.holds || b.score - a.score || b.members - a.members);
  }
  /* your own war points this week (all holds) */
  function myWeek(s) { return s && s.war && typeof WARS !== "undefined" && s.war.week === WARS.week() ? Object.values(s.war.h || {}).reduce((a, b) => a + (+b || 0), 0) : 0; }

  // ---------------------------------------------------------------- fighting other players
  const inNorth = (s) => { try { return !!s && typeof G !== "undefined" && NORTH.includes(G.holdAt([s.x, s.y])); } catch (e) { return false; } };
  const holdOf = (pos) => (typeof G !== "undefined" && pos ? G.holdAt(pos) : null);
  /* may s attack this player's card? -> { err } or { mode: "war" | "old" }. ctx: { myPos, theirPos, party, t, ambush } */
  function canAttack(s, card, ctx = {}) {
    const t = ctx.t ?? gnow();
    if (!card || !card.id) return { err: "They're gone." };
    if (card.id === s.id) return { err: "That's you." };
    if (ctx.party && (ctx.party.members || []).some((m) => m.id === card.id) && (ctx.party.members || []).some((m) => m.id === s.id)) return { err: `${card.name} is in your party. No fighting each other while you travel together.` };
    if (s.dungeon || card.dungeon) return { err: "No fighting other players inside a dungeon run." };
    if (lvl(s) < MIN_LEVEL) return { err: `You can fight other players from level ${MIN_LEVEL}.` };
    if (lvl(card) < MIN_LEVEL) return { err: `${card.name} is under level ${MIN_LEVEL}. They're left in peace.` };
    const me = mine(s), them = of(card.id) || (LIST[card.side] ? card.side : null);
    if (!me) return { err: "Pick a side first (Social → Faction). Only soldiers of a side fight other players." };
    if (!them) return { err: `${card.name} hasn't picked a side yet. They're left in peace.` };
    if ((card.safeUntil || 0) > t) return { err: `${card.name} was knocked down a moment ago. Give them a few minutes.` };
    if ((s.safeUntil || 0) > t && me !== them) { /* attacking ends your own protection */ }
    if (me !== them) {
      if (ctx.ambush) return { mode: "war", side: them };
      const a = ctx.myPos || [s.x, s.y], b = ctx.theirPos || [card.x, card.y];
      if (typeof MP !== "undefined" && G.pxDist(a, b) <= MP.NEAR_PX) return { mode: "war", side: them };
      if (card.loc && card.loc === s.location) return { mode: "war", side: them };
      const ha = holdOf(a), hb = holdOf(b);
      if (ha && ha === hb) return { mode: "war", side: them };
      return { err: `${card.name} is in ${hb || "another hold"}. Ride into the same hold to attack them.` };
    }
    if (ctx.ambush) return { mode: "old", side: them };
    const e = typeof MP !== "undefined" ? MP.canTarget(s, card, ctx.myPos || [s.x, s.y], ctx.theirPos || [card.x, card.y], t) : null;
    return e ? { err: e } : { mode: "old", side: them };
  }
  const dayKey = (t) => Math.floor(t / 86400);
  /* does beating this player still pay today? (counts it if so) */
  function paysOut(s, uid, t, count = true) {
    if (!mine(s)) return false;
    const b = (s.side.beat = s.side.beat && typeof s.side.beat === "object" ? s.side.beat : {}), d = dayKey(t);
    for (const k of Object.keys(b)) if (!Array.isArray(b[k]) || b[k][0] !== d) delete b[k];
    const n = b[uid] ? b[uid][1] : 0;
    if (n >= REWARD_PER_DAY) return false;
    if (count) b[uid] = [d, n + 1];
    return true;
  }
  const winGold = (foeLevel) => 20 + 2 * Math.min(60, Math.max(1, foeLevel | 0));
  function trophyOf(side) { return { stormcloak: "side_trophy_sc", imperial: "side_trophy_il", thalmor: "side_trophy_ad" }[side] || null; }
  function reward(s, foe, foeSide, hold, t, xpKind = "pvp") {
    if (!paysOut(s, foe.id, t)) return { text: ` You've beaten ${foe.name} enough today: no more spoils from them until tomorrow.`, hold: null };
    const gold = winGold(foe.level); s.gold = (s.gold || 0) + gold;
    gainXp(s, xpKind);
    const tr = trophyOf(foeSide); if (tr && typeof D !== "undefined" && D.ITEMS[tr]) G.give(s, tr, 1);
    return { text: ` +${gold} gold${tr && D.ITEMS[tr] ? ` and a ${D.ITEMS[tr].name}` : ""}; your side gets war points in ${hold}.`, hold, gold };
  }
  /* a cross-side fight against another player's public card. Returns what MP.attack returns (text, fight, won, doc...) */
  function attack(s, card, { ambush = false, t = gnow(), pos } = {}) {
    const foeSide = of(card.id) || card.side, me = mine(s), L = LIST[foeSide] || { name: "another side" };
    const life = Math.max(1, card.cur || card.hp) + (card.heal || 0);
    const e = { name: card.name, health: life, hp: life, damage: Math.max(1, (card.dmg || 4) * DEF_EDGE), tags: ["humanoid"], red: card.red, level: card.level, danger: "high", gold: [0, 0], text: "", look: card.look || null, player: true, pvp: true, warSide: foeSide };
    const f = new G.Fight(s, e, null, t);
    f.allies = [];                                  // a duel: no help
    f.run({ t, hidden: ambush ? true : null, trySneak: true });
    const skills = f.apply(t);
    const at = pos || [s.x, s.y], hold = holdOf(at) || "Whiterun", place = s.location || `the wilds of ${hold}`;
    let bountyText = "";
    if (typeof MP !== "undefined" && typeof TOWNS !== "undefined" && MP.witnessed(s)) { TOWNS.addBounty(s, hold, "assault"); bountyText = ` Someone saw it: your bounty in ${hold} is now ${TOWNS.bounty(s, hold)} gold.`; }
    const id = `${s.id}-${Math.floor(t)}-w${Math.floor(Math.random() * 900 + 100)}`;
    if (f.won) {
      s.pvpKills = (s.pvpKills || 0) + 1;
      const rw = reward(s, card, foeSide, hold, t);
      return { text: `${ambush ? "You burst out of hiding. " : ""}${card.name} of the ${L.name} goes down. They'll get up again, bruised.${rw.text}${bountyText}`, fight: f, skills, won: true, war: true, warHold: rw.hold, gold: rw.gold || 0,
        doc: { type: "warknock", from: s.id, fromName: s.name, fromSide: me, to: card.id, toName: card.name, t, hold, at, ambush },
        id, news: `⚔ ${s.name} (${LIST[me].name}) knocked down ${card.name} (${L.name}) in ${place}.` };
    }
    G.setHealth(s, Math.max(1, G.maxHealth(s) * KNOCK_HP), t);   // knocked down, not killed: you keep everything
    s.safeUntil = t + SAFE;
    return { text: `${card.name} of the ${L.name} knocks you down. You keep your gear and gold, and nobody can attack you for 10 minutes.${bountyText}`, fight: f, skills, won: false, war: true, knocked: true,
      doc: { type: "warheld", from: s.id, fromName: s.name, fromSide: me, to: card.id, toName: card.name, t, hold, at },
      id, news: `🛡 ${card.name} (${L.name}) beat off ${s.name} (${LIST[me].name}) in ${place}.` };
  }
  /* the defender's phone applies a cross-side attack. Returns { text, bad?, warHold? } (warHold: give war points there) */
  function receive(s, doc, t = gnow()) {
    const fromSide = LIST[doc.fromSide] ? LIST[doc.fromSide].name : "another side";
    if (doc.type === "warknock") {
      if (doc.at && s.trip) { [s.x, s.y] = doc.at; s.trip = null; }
      G.setHealth(s, Math.min(G.curHealth ? G.curHealth(s) : G.maxHealth(s), Math.max(1, G.maxHealth(s) * KNOCK_HP)), t);
      s.safeUntil = Math.max(s.safeUntil || 0, t + SAFE);
      return { text: `${doc.fromName} of the ${fromSide} ${doc.ambush ? "jumped you and " : ""}knocked you down in ${doc.hold}. You keep your gear and gold, and nobody can attack you for 10 minutes.`, bad: true };
    }
    if (doc.type === "warheld") {
      const rw = mine(s) ? reward(s, { id: doc.from, name: doc.fromName, level: lvl(s) }, doc.fromSide, doc.hold, t, "held") : { text: "", hold: null };
      return { text: `${doc.fromName} of the ${fromSide} attacked you in ${doc.hold} and lost.${rw.text}`, warHold: rw.hold };
    }
    return null;
  }

  // ---------------------------------------------------------------- the emblem: an ink banner with the side's beast
  const BANNER = "M5 3H35V35L20 45L5 35Z";
  const GLYPH = {
    stormcloak: "M12.5 14.5A3.6 3.6 0 1 1 17 10.4H23A3.6 3.6 0 1 1 27.5 14.5C29.8 17.2 30.6 20.7 29.6 24.2C28.4 28.6 24.6 31.6 20 31.6S11.6 28.6 10.4 24.2C9.4 20.7 10.2 17.2 12.5 14.5ZM16.2 19.4A1.5 1.5 0 1 0 16.21 19.4ZM23.8 19.4A1.5 1.5 0 1 0 23.81 19.4ZM17.6 25.2C18.8 26.6 21.2 26.6 22.4 25.2L20 27.6Z",
    imperial: "M20 8L23 13L31 9L29 16L35 17L28 20L30 24L24 22.5L22 31L20 36L18 31L16 22.5L10 24L12 20L5 17L11 16L9 9L17 13Z",
    thalmor: "M20 7L34 33H6ZM20 13.5L17.2 19.2L11 17.6L15.4 22.4L13.6 28L20 25.6L26.4 28L24.6 22.4L29 17.6L22.8 19.2Z",
  };
  /* an <svg> string (ink style). size = width in px */
  function emblem(side, size = 28) {
    const L = LIST[side]; if (!L) return "";
    const h = Math.round(size * 1.2);
    return `<svg class="sd-emb" viewBox="0 0 40 48" width="${size}" height="${h}" role="img" aria-label="${L.name}"><path d="${BANNER}" fill="${L.colors[0]}" stroke="#1c140c" stroke-width="2" stroke-linejoin="round"/><path d="M8 6H32" stroke="${L.colors[1]}" stroke-opacity=".5" stroke-width="1"/><path d="${GLYPH[side]}" fill="${L.colors[1]}" fill-rule="evenodd" stroke="#1c140c" stroke-width=".9" stroke-linejoin="round"/></svg>`;
  }
  /* draw the emblem on a canvas, centred on x,y, r = half its width (the map, the PC map) */
  let paths = null;
  function drawEmblem(g, side, x, y, r = 6) {
    const L = LIST[side]; if (!L || !g || typeof Path2D === "undefined") return false;
    paths = paths || { banner: new Path2D(BANNER), ...Object.fromEntries(IDS.map((id) => [id, new Path2D(GLYPH[id])])) };
    const k = r / 15;
    g.save(); g.translate(x - 20 * k, y - 24 * k); g.scale(k, k);
    g.fillStyle = L.colors[0]; g.strokeStyle = "#1c140c"; g.lineWidth = 2.4; g.lineJoin = "round";
    g.fill(paths.banner); g.stroke(paths.banner);
    g.fillStyle = L.colors[1]; g.fill(paths[side], "evenodd");
    g.restore();
    return true;
  }

  // ---------------------------------------------------------------- hooks into the rest of the game
  if (typeof D !== "undefined" && D.ITEMS) Object.assign(D.ITEMS, {
    side_trophy_sc: { name: "Torn Stormcloak Sash", slot: "trophy", weight: 0.5, value: 40, desc: "Taken from a Stormcloak you knocked down. Proof for your side, or a few coins at a shop." },
    side_trophy_il: { name: "Dented Legion Badge", slot: "trophy", weight: 0.5, value: 40, desc: "Taken from a Legion soldier you knocked down. Proof for your side, or a few coins at a shop." },
    side_trophy_ad: { name: "Thalmor Gilt Pin", slot: "trophy", weight: 0.5, value: 40, desc: "Taken from a Thalmor agent you knocked down. Proof for your side, or a few coins at a shop." },
  });
  if (typeof CLANS !== "undefined" && !CLANS.legacy) {
    CLANS.legacy = { of: CLANS.of, byId: CLANS.byId, members: CLANS.members, valid: CLANS.valid, banners: CLANS.banners, get all() { return []; } };
    CLANS.of = (uid, me) => asClan(of(uid, me || self));
    CLANS.byId = (id) => asClan(id);
    CLANS.members = (c) => (c && LIST[c.id] ? members(c.id).map((m) => ({ id: m.id, name: m.name })) : []);
    CLANS.invitesFor = () => [];
    /* a banner in the side's colours over every town where one of its members owns a house */
    CLANS.banners = (homeDocs, me, mineRec) => {
      const out = new Map();
      const homes = mineRec && me ? [...(homeDocs || []).filter((d) => d.id !== me.id), { ...mineRec, id: me.id }] : homeDocs || [];
      for (const d of homes) {
        const id = of(d.id, me); if (!id) continue;
        for (const town of d.towns || []) { const k = id + "|" + town; if (!out.has(k)) out.set(k, { town, tag: LIST[id].tag, colors: LIST[id].colors, name: LIST[id].name, side: id }); }
      }
      return [...out.values()];
    };
    try { Object.defineProperty(CLANS, "all", { get: () => IDS.map(asClan), configurable: true }); } catch (e) { /* older engines */ }
  }
  /* side perks: only your side can take them (and they only work while you're on that side: perkfx.js checks c.side) */
  const perkGate = (s, id) => (PERK_SIDE[id] && mine(s) !== PERK_SIDE[id] ? `Only for soldiers of the ${LIST[PERK_SIDE[id]].name}.` : null);
  if (typeof PERKS !== "undefined" && !PERKS.canTake._sides) {
    const can0 = PERKS.canTake, take0 = PERKS.take;
    PERKS.canTake = (s, id) => perkGate(s, id) || can0(s, id);
    PERKS.take = (s, id) => perkGate(s, id) || take0(s, id);
    PERKS.canTake._sides = true;
  }
  /* war points belong to sides now (wars.js asked for a clan), and every point earned in your cloak is rank XP too.
     The war doc is still published by ui.js warPoint when this returns true. */
  if (typeof WARS !== "undefined" && !WARS.add._sides) {
    Object.assign(WARS.POINTS, { pvp: 4, event: 2 });
    WARS.add = (s, kind, hold) => {
      if (!WARS.POINTS[kind] || !mine(s)) return false;
      if (kind !== "pvp") gainXp(s, kind);   // player wins pay their XP in reward()
      if (!hold || typeof WORLD === "undefined" || !WORLD.holds[hold]) return false;
      const w = WARS.week();
      if (!s.war || s.war.week !== w) s.war = { week: w, h: {} };
      s.war.h[hold] = (s.war.h[hold] || 0) + WARS.POINTS[kind];
      return true;
    };
    WARS.add._sides = true;
  }
  /* cross-side attack notes go through MP.receive like every other attack */
  if (typeof MP !== "undefined" && !MP.receive._sides) {
    const r0 = MP.receive;
    MP.receive = (s, doc, t) => (doc && (doc.type === "warknock" || doc.type === "warheld") ? receive(s, doc, t) : r0(s, doc, t));
    MP.receive._sides = true;
  }

  return { MIN_LEVEL, WEEK, SAFE, KNOCK_HP, DEF_EDGE, REWARD_PER_DAY, RANK_AT, XP, NORTH, LIST, IDS, PERK_SIDE,
    gainXp, xpBar, onXp(f) { xpFns.push(f); }, mine, needsPick, shouldPrompt, later, switchCost, switchAt, rank, rankName, pick, addPts, migrate, oldHall,
    record, setDocs, setCards, of, members, cardBits, asClan, standings, myWeek, inNorth, canAttack, paysOut, winGold, trophyOf, reward, attack, receive,
    emblem, drawEmblem, GLYPH, BANNER, perkGate,
    setClock(f) { clock = f; }, get docs() { return [...docs.values()]; } };
})();
if (typeof module !== "undefined") module.exports = SIDES;
