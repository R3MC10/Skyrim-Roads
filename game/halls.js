/* Player halls and shops. Buy a plot in a hold capital and build your own hall on it, or found a guild hall
   for your clan. Rooms: a forge (Smithing improves faster here), a shrine (a day-long blessing), a trophy room
   (mounted trophies make merchants respect you), storage (safe from death) and a shop counter (sell from your hall,
   and your shopkeeper sells to travellers while you're away). Decorations make the hall cosy enough for Well Rested.
   Staff are paid a daily wage from the hall's coffer, in in-game days; unpaid staff leave.
   - Your own hall lives in your save (s.hall); a public card goes to "halls" (id = your id) so others can visit.
   - A guild hall is one shared record ("halls", id "c-" + clan id). Every change goes through Store.change,
     so two members can't spend the same gold or take the same thing. [OURS] */
const HALLS = (() => {
  const DAY = 2 * 3600;                       // one in-game day in real seconds (time runs 12x)
  const TOWNS_ = ["Solitude", "Whiterun", "Windhelm", "Markarth", "Riften", "Dawnstar", "Winterhold", "Morthal", "Falkreath"];
  const PLOT = { Solitude: 8000, Whiterun: 6000, Windhelm: 6000, Markarth: 6000, Riften: 6000 };
  const plotPrice = (town, clan = false) => (PLOT[town] || 4000) * (clan ? 2 : 1);
  const CLAN_MAT_MULT = 3;                    // guild halls pay gold for materials: 3x their value
  const MAX_DAYS = 14;                        // catch up at most two weeks of wages at once
  const NAME_MAX = 28;
  const clean = (t, n) => String(t || "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);

  // id: [name, what it does, [level 1 cost, level 2 cost]] where a cost is [gold, {material: qty}]
  const ROOMS = {
    forge: ["Forge", "Smith and temper here. Smithing improves 10% faster in your hall (20% at level 2).",
      [[600, { mat_iron: 6, mat_firewood: 6 }], [1500, { mat_steel: 6, mat_firewood: 10, mat_leather: 4 }]]],
    shrine: ["Shrine", "Pray once a day: +25 health for a day and diseases cured (level 2: +50 health and faster healing).",
      [[800, { mat_moonstone: 2, mat_firewood: 4 }], [2000, { mat_silver: 2, mat_moonstone: 4 }]]],
    trophy: ["Trophy room", "Mount trophies and treasures. Each one on the wall gives 1% better prices (up to 6%, or 12% at level 2).",
      [[700, { mat_iron: 4, mat_leather: 4 }], [1800, { mat_steel: 4, mat_gold: 1 }]]],
    storage: ["Storage", "Chests that are safe even when you die: 20 things (40 at level 2). A guard keeps thieves out.",
      [[500, { mat_iron: 4, mat_firewood: 8 }], [1200, { mat_steel: 4, mat_iron: 6 }]]],
    counter: ["Shop counter", "Sell from your hall, even without a house in town. With a shopkeeper, travellers buy from you while you're away.",
      [[900, { mat_firewood: 10, mat_iron: 4 }], [2200, { mat_steel: 4, mat_silver: 2 }]]],
  };
  const CLAN_ROOMS = ["forge", "shrine", "trophy", "storage"];
  // id: [name, gold, comfort]
  const DECOR = {
    rug: ["Bear-fur rug", 200, 1], banner: ["Hold banners", 150, 1], candles: ["Iron candelabras", 120, 1], antlers: ["Mounted elk antlers", 250, 1],
    tapestry: ["Woven tapestry", 300, 1], rack: ["Weapon rack", 400, 1], map: ["Map of Skyrim", 350, 1], seat: ["Carved high seat", 1500, 2],
  };
  const COSY = 4;   // comfort for Well Rested
  // id: [name, hire fee, daily wage, needs room, what they do]
  const STAFF = {
    shopkeeper: ["Shopkeeper", 200, 40, "counter", "Minds your counter. Each day sells some of your hall-shop things to travellers, if the price is fair."],
    steward: ["Steward", 150, 30, null, "Runs the hall. Brings in 10 gold a day for each room (visitors, rent and tolls)."],
    guard: ["Guard", 150, 30, null, "Keeps thieves out. Without one, a thief may take something from storage now and then."],
  };
  const CLAN_STAFF = ["steward", "guard"];
  const THIEF_CHANCE = 0.12;            // per in-game day, unguarded storage with something in it
  const CLAN_TAKES_PER_DAY = 3;         // members (not the founder) can take this many things a day from guild storage
  const HALL_FEE = 0.02;                // the market's cut for sales from your own counter (stalls pay 5%)

  const lvl = (h, room) => (h?.rooms || {})[room] || 0;
  const isClan = (h) => !!h?.clan;
  const cap = (h) => (lvl(h, "storage") >= 2 ? 40 : lvl(h, "storage") ? 20 : 0);
  const trophyCap = (h) => (lvl(h, "trophy") >= 2 ? 12 : lvl(h, "trophy") ? 6 : 0);
  const decorCap = (h) => 3 + Object.values(h?.rooms || {}).filter(Boolean).length;
  const comfort = (h) => (h?.decor || []).reduce((a, id) => a + (DECOR[id]?.[2] || 0), 0) + (lvl(h, "shrine") ? 1 : 0);
  const roomCount = (h) => Object.values(h?.rooms || {}).filter(Boolean).length;
  const wages = (h) => Object.keys(h?.staff || {}).reduce((a, id) => a + (STAFF[id]?.[2] || 0), 0);
  const name = (r) => (r.tq && typeof TOWNS !== "undefined" ? TOWNS.QUALITY[r.tq] + " " : "") + (D.ITEMS[r.item]?.name || r.item);
  const day = (t) => Math.floor(t / DAY);

  function blank(town, hallName, t, extra = {}) {
    return { town, name: hallName, rooms: {}, decor: [], staff: {}, storage: [], trophies: [], coffer: 0, paid: t, prayed: {}, log: [], t, ...extra };
  }
  function addLog(h, text) { h.log = [text, ...(h.log || [])].slice(0, 8); }

  /* ---- plots */
  const plotHere = (town) => TOWNS_.includes(town);
  function buyPlot(s, hallName, t = G.now()) {
    const town = s.location;
    if (!plotHere(town)) return { err: "Hall plots are only for sale in the nine hold capitals." };
    if (s.hall) return { err: `You already have a hall in ${s.hall.town}.` };
    if (typeof TOWNS !== "undefined" && TOWNS.wanted(s)) return { err: "The Jarl's steward won't sell land to a wanted criminal." };
    const price = plotPrice(town);
    if (s.gold < price) return { err: `A plot in ${town} costs ${price} gold. You have ${s.gold}.` };
    s.gold -= price;
    s.hall = blank(town, clean(hallName, NAME_MAX) || `${s.name}'s Hall`, t);
    G.note(s, `🏰 Bought a hall plot in ${town}.`);
    return { text: `The steward hands you the deed to a plot in ${town}. ${s.hall.name} stands, with a hearth to rest by. Build rooms, decorate and hire staff.` };
  }
  /* the founder raises a guild hall for the clan; returns {id, doc} for the "halls" collection */
  function foundClanHall(s, clan, hallName, existing, t = G.now()) {
    const town = s.location;
    if (!clan || clan.founder !== s.id) return { err: "Only the clan's founder can buy land for a guild hall." };
    if (existing) return { err: `Your clan already has a hall in ${existing.town}.` };
    if (!plotHere(town)) return { err: "Guild hall plots are only for sale in the nine hold capitals." };
    const price = plotPrice(town, true);
    if (s.gold < price) return { err: `A guild hall plot in ${town} costs ${price} gold. You have ${s.gold}.` };
    s.gold -= price;
    const doc = blank(town, clean(hallName, NAME_MAX) || `Hall of ${clan.name}`, t, { clan: clan.id, clanName: clan.name, tag: clan.tag, colors: clan.colors, founder: s.id, funds: 0, donors: {}, takes: {} });
    addLog(doc, `${s.name} bought the land.`);
    return { id: "c-" + clan.id, doc, text: `The banner of ${clan.name} flies over a new hall in ${town}. Members can give gold to build it up.` };
  }

  /* ---- costs, paid either by a player (own hall) or from the guild funds */
  function cost(room, level, clan = false) {
    const c = ROOMS[room]?.[2]?.[level - 1]; if (!c) return null;
    const [gold, mats] = c;
    if (!clan) return { gold, mats };
    const extra = Object.entries(mats).reduce((a, [m, n]) => a + (D.ITEMS[m]?.value || 5) * n * CLAN_MAT_MULT, 0);
    return { gold: Math.round((gold + extra) * 1.5), mats: {} };
  }
  const have = (s, item) => s.inv.filter((r) => r.item === item && !r.stolen).reduce((a, r) => a + r.qty, 0);
  function takeMats(s, mats) {
    for (const [m, n] of Object.entries(mats)) { let left = n; for (const r of s.inv.filter((x) => x.item === m && !x.stolen)) { const k = Math.min(left, r.qty); G.take(s, r.id, k); left -= k; if (!left) break; } }
  }
  /* can this purse pay? purse = { s } for your own hall, { h } for guild funds */
  function canPay(purse, gold, mats = {}) {
    if (purse.h) return (purse.h.funds || 0) >= gold ? null : `The guild funds hold ${purse.h.funds || 0} gold; this needs ${gold}.`;
    if (purse.s.gold < gold) return `It costs ${gold} gold. You have ${purse.s.gold}.`;
    const miss = Object.entries(mats).filter(([m, n]) => have(purse.s, m) < n).map(([m, n]) => `${D.ITEMS[m]?.name || m} ×${n - have(purse.s, m)}`);
    return miss.length ? `You still need ${miss.join(", ")}.` : null;
  }
  function pay(purse, gold, mats = {}) { if (purse.h) purse.h.funds -= gold; else { purse.s.gold -= gold; takeMats(purse.s, mats); } }

  function build(h, room, purse, who = "") {
    if (!ROOMS[room]) return { err: "No such room." };
    if (isClan(h) && !CLAN_ROOMS.includes(room)) return { err: "A guild hall has no shop counter." };
    const next = lvl(h, room) + 1;
    if (next > 2) return { err: `The ${ROOMS[room][0].toLowerCase()} is fully built.` };
    const c = cost(room, next, isClan(h)), e = canPay(purse, c.gold, c.mats);
    if (e) return { err: e };
    pay(purse, c.gold, c.mats);
    h.rooms = { ...(h.rooms || {}), [room]: next };
    const text = `${next === 1 ? "Built" : "Improved"} the ${ROOMS[room][0].toLowerCase()}${next === 2 ? " (level 2)" : ""}.`;
    addLog(h, who ? `${who}: ${text}` : text);
    return { text };
  }
  function addDecor(h, id, purse, who = "") {
    const d = DECOR[id]; if (!d) return { err: "No such thing." };
    if ((h.decor || []).includes(id)) return { err: "You have that already." };
    if ((h.decor || []).length >= decorCap(h)) return { err: `Room for ${decorCap(h)} decorations. Build more rooms for more space.` };
    const e = canPay(purse, d[1]); if (e) return { err: e };
    pay(purse, d[1]); h.decor = [...(h.decor || []), id];
    const text = `Put up the ${d[0].toLowerCase()}.`; addLog(h, who ? `${who}: ${text}` : text);
    return { text };
  }
  function removeDecor(h, id) { h.decor = (h.decor || []).filter((x) => x !== id); return { text: `Took down the ${(DECOR[id]?.[0] || "thing").toLowerCase()}.` }; }

  function hire(h, id, purse, t = G.now(), who = "") {
    const st = STAFF[id]; if (!st) return { err: "Nobody by that name." };
    if (isClan(h) && !CLAN_STAFF.includes(id)) return { err: "A guild hall has no counter for a shopkeeper." };
    if ((h.staff || {})[id]) return { err: `You already have a ${st[0].toLowerCase()}.` };
    if (st[3] && !lvl(h, st[3])) return { err: `Build the ${ROOMS[st[3]][0].toLowerCase()} first.` };
    const e = canPay(purse, st[1]); if (e) return { err: e };
    pay(purse, st[1]); h.staff = { ...(h.staff || {}), [id]: { since: t } };
    const text = `Hired a ${st[0].toLowerCase()} (${st[2]} gold a day from the ${isClan(h) ? "guild funds" : "coffer"}).`; addLog(h, who ? `${who}: ${text}` : text);
    return { text };
  }
  function dismiss(h, id) { const st = { ...(h.staff || {}) }; if (!st[id]) return { err: "Not working here." }; delete st[id]; h.staff = st; return { text: `The ${STAFF[id][0].toLowerCase()} packs up and leaves.` }; }

  /* ---- the coffer (own hall) and guild funds */
  function deposit(s, h, n) {
    n = Math.floor(+n); if (!(n > 0)) return { err: "How much?" };
    if (s.gold < n) return { err: `You have ${s.gold} gold.` };
    s.gold -= n;
    if (isClan(h)) { h.funds = (h.funds || 0) + n; h.donors = { ...(h.donors || {}), [s.id]: { name: s.name, gold: ((h.donors || {})[s.id]?.gold || 0) + n } }; addLog(h, `${s.name} gave ${n} gold.`); }
    else h.coffer = (h.coffer || 0) + n;
    return { text: `${n} gold goes into the ${isClan(h) ? "guild funds" : "hall coffer"}.` };
  }
  function withdraw(s, h, n) {
    if (isClan(h)) return { err: "Guild funds can only be spent on the hall." };
    n = Math.floor(+n); if (!(n > 0) || n > (h.coffer || 0)) return { err: `The coffer holds ${h.coffer || 0} gold.` };
    h.coffer -= n; s.gold += n; return { text: `You take ${n} gold from the coffer.` };
  }

  /* ---- each in-game day: wages, the steward's income, thieves. rnd() lets tests decide the dice.
     Returns messages for the owner. Mutates h. */
  function settle(h, t = G.now(), rnd = Math.random) {
    const msgs = [];
    if (!h) return msgs;
    let days = day(t) - day(h.paid || t);
    if (days <= 0) return msgs;
    if (days > MAX_DAYS) { h.paid = t - MAX_DAYS * DAY; days = MAX_DAYS; }
    const purseKey = isClan(h) ? "funds" : "coffer";
    let paidOut = 0, earned = 0, stolen = [];
    for (let i = 0; i < days; i++) {
      if (h.staff?.steward) { const inc = 10 * roomCount(h); h[purseKey] = (h[purseKey] || 0) + inc; earned += inc; }
      for (const id of Object.keys(h.staff || {})) {
        const w = STAFF[id]?.[2] || 0;
        if ((h[purseKey] || 0) >= w) { h[purseKey] -= w; paidOut += w; }
        else { const st = { ...h.staff }; delete st[id]; h.staff = st; msgs.push(`💸 Your ${STAFF[id][0].toLowerCase()} wasn't paid and left the hall.`); addLog(h, `The ${STAFF[id][0].toLowerCase()} left, unpaid.`); }
      }
      if (!h.staff?.guard && (h.storage || []).length && rnd() < THIEF_CHANCE) {
        const i2 = Math.floor(rnd() * h.storage.length), r = h.storage[i2];
        if (r.qty > 1) r.qty -= 1; else h.storage.splice(i2, 1);
        stolen.push(name(r));
      }
    }
    h.paid = (h.paid || t) + days * DAY;
    if (paidOut) msgs.push(`🏰 ${h.name}: paid ${paidOut} gold in wages for ${days} day${days > 1 ? "s" : ""}.`);
    if (earned) msgs.push(`🏰 The steward brought in ${earned} gold.`);
    if (stolen.length) { msgs.push(`🗝 A thief got into ${h.name} and took ${stolen.join(", ")}. Hire a guard.`); addLog(h, `A thief took ${stolen.join(", ")}.`); }
    return msgs;
  }

  /* ---- the shop: listing in your hall's town, and sales to travellers */
  const shopOpen = (s, town = s.location) => !!(s.hall && s.hall.town === town && lvl(s.hall, "counter"));
  const shopCap = (s) => (s.hall && lvl(s.hall, "counter") ? 8 + 4 * lvl(s.hall, "counter") : 8);
  /* which of my open hall-shop listings travellers buy over the days that passed. Fair price only: at most
     1.25x the item's value (so it can't be used to mint gold), more likely at or under value. */
  function travellerBuys(s, myDocs, t = G.now(), rnd = Math.random) {
    const h = s.hall; if (!h || !h.staff?.shopkeeper || !lvl(h, "counter")) return [];
    const last = h.sold ?? h.paid ?? t, days = Math.min(MAX_DAYS, day(t) - day(last));
    if (days <= 0) return [];
    h.sold = (last) + days * DAY;
    const open = myDocs.filter((d) => d.seller === s.id && d.status === "open" && d.town === h.town && d.hall && D.ITEMS[d.row?.item]);
    const per = 2 * lvl(h, "counter"), out = [];
    for (let i = 0; i < days; i++) {
      let n = 0;
      for (const d of open) {
        if (out.includes(d.id) || n >= per) continue;
        const v = (D.ITEMS[d.row.item].value || 1) * d.row.qty * (1 + 0.2 * (d.row.temper || 0));
        const p = d.price <= v ? 0.5 : d.price <= v * 1.25 ? 0.25 : 0;
        if (p && rnd() < p) { out.push(d.id); n++; }
      }
    }
    return out;
  }

  /* ---- what the rooms do */
  function canUse(s, h) {
    if (!h) return false;
    if (!isClan(h)) return s.hall === h;
    const c = typeof CLANS !== "undefined" ? CLANS.of(s.id, s) : null;
    return !!c && c.id === h.clan;
  }
  /* Smithing XP bonus while in a town where your hall (or your guild's) has a forge */
  let clanHallCache = null;   // set by the UI: your clan's hall record
  const setClanHall = (h) => { clanHallCache = h || null; };
  function hallsOf(s) { return [s.hall, clanHallCache && canUse(s, clanHallCache) ? clanHallCache : null].filter(Boolean); }
  function xpMult(s, skillName) {
    if (skillName !== "Smithing") return 1;
    const f = Math.max(0, ...hallsOf(s).filter((h) => h.town === s.location).map((h) => lvl(h, "forge")));
    return 1 + 0.1 * f;
  }
  const hasForge = (s, town) => hallsOf(s).some((h) => h.town === town && lvl(h, "forge"));
  function rest(s, h, t = G.now()) {
    if (!canUse(s, h)) return { err: "That's not your hall." };
    if (s.location !== h.town) return { err: `Your hall is in ${h.town}.` };
    G.setHealth(s, G.maxHealth(s), t);
    const cosy = comfort(h) >= COSY;
    s.rested = t + (typeof TOWNS !== "undefined" && TOWNS.RESTED_SECONDS ? TOWNS.RESTED_SECONDS : 2400); s.restBonus = cosy ? 0.1 : 0.05;
    return { text: cosy ? "You sleep by your own hearth, among your things. Fully healed and Well Rested (+10% skills)." : `You rest by the hearth. Fully healed and Rested (+5% skills). Decorate (comfort ${comfort(h)}/${COSY}) for Well Rested.` };
  }
  function pray(s, h, t = G.now()) {
    if (!canUse(s, h)) return { err: "That's not your hall." };
    if (s.location !== h.town) return { err: `Your hall is in ${h.town}.` };
    const L = lvl(h, "shrine"); if (!L) return { err: "Build a shrine first." };
    const last = (h.prayed || {})[s.id] || 0;
    if (day(last) === day(t) && last) return { err: "You've prayed today. Come back tomorrow (in-game)." };
    h.prayed = { ...(h.prayed || {}), [s.id]: t };
    s.fx = (s.fx || []).filter((f) => f.name !== "Hall shrine" && f.name !== "Hall shrine (healing)");
    s.fx.push({ key: "max:health", mag: L >= 2 ? 50 : 25, until: t + DAY, name: "Hall shrine" });
    if (L >= 2) s.fx.push({ key: "regen:health", mag: 50, until: t + DAY, name: "Hall shrine (healing)" });
    const cured = typeof CURSE !== "undefined" && CURSE.cureDisease ? CURSE.cureDisease(s) : "";
    const my = G.useSkill(s, "Mysticism", 8);
    return { text: `You kneel at the hall shrine. Blessed for a day: +${L >= 2 ? 50 : 25} health${L >= 2 ? " and faster healing" : ""}.${cured ? " " + cured : ""}${my.length ? " " + my.join(". ") : ""}` };
  }
  /* the trophy wall's barter bonus, kept as a long-lasting effect while you own the hall */
  function refreshTrophies(s, t = G.now()) {
    const n = Math.min(trophyCap(s.hall), (s.hall?.trophies || []).length);
    const old = (s.fx || []).find((f) => f.name === "Hall trophies");
    if (!n) { if (old) s.fx = s.fx.filter((f) => f !== old); return; }
    if (old && old.mag === n && old.until > t + DAY) return;
    s.fx = (s.fx || []).filter((f) => f !== old);
    s.fx.push({ key: "barter", mag: n, until: t + 3 * DAY, name: "Hall trophies" });
  }
  const trophyOk = (r) => { const it = D.ITEMS[r?.item]; return !!it && ["trophy", "valuable"].includes(it.slot) && !r.stolen; };

  /* ---- storage and the trophy wall. For guild halls, `who` is the player; members (not the founder) take
     at most CLAN_TAKES_PER_DAY things a day. */
  function stash(s, h, rowId, wall = false) {
    if (!canUse(s, h)) return { err: "That's not your hall." };
    if (s.location !== h.town) return { err: `Your hall is in ${h.town}.` };
    const list = wall ? "trophies" : "storage", max = wall ? trophyCap(h) : cap(h);
    if (!max) return { err: wall ? "Build a trophy room first." : "Build storage first." };
    h[list] = h[list] || [];
    if (h[list].length >= max) return { err: `It's full (${max}).` };
    const r = G.invRow(s, rowId); if (!r) return { err: "You don't have that." };
    if (Object.values(G.loadout(s).equipment || {}).includes(rowId)) return { err: "Take it off first." };
    if (wall && !trophyOk(r)) return { err: "Only trophies and treasures go on the wall." };
    if (isClan(h) && (r.stolen || D.ITEMS[r.item].noTrade)) return { err: "Stolen and bound things stay with you." };
    const qty = wall ? 1 : r.qty, copy = { ...r, qty, by: s.name }; delete copy.id;
    G.take(s, rowId, qty);
    h[list].push(copy);
    return { text: `${name(copy)}${copy.qty > 1 ? ` ×${copy.qty}` : ""} ${wall ? "goes up on the trophy wall" : "goes into storage"}.` };
  }
  function unstash(s, h, idx, wall = false, t = G.now()) {
    if (!canUse(s, h)) return { err: "That's not your hall." };
    if (s.location !== h.town) return { err: `Your hall is in ${h.town}.` };
    const list = wall ? "trophies" : "storage", r = (h[list] || [])[idx];
    if (!r) return { err: "It's not there any more." };
    if (isClan(h) && s.id !== h.founder) {
      const k = h.takes?.[s.id], n = k && k.day === day(t) ? k.n : 0;
      if (n >= CLAN_TAKES_PER_DAY) return { err: `Members take ${CLAN_TAKES_PER_DAY} things a day from guild storage. Come back tomorrow.` };
      h.takes = { ...(h.takes || {}), [s.id]: { day: day(t), n: n + 1 } };
    }
    h[list] = h[list].filter((_, i) => i !== idx);
    const id = G.give(s, r.item, r.qty, r.charge); const row = G.invRow(s, id);
    if (row && (r.temper || r.stolen)) Object.assign(row, { temper: r.temper, tq: r.tq, stolen: r.stolen });
    if (isClan(h)) addLog(h, `${s.name} took ${name(r)}.`);
    return { text: `You take ${name(r)}${r.qty > 1 ? ` ×${r.qty}` : ""}.` };
  }

  /* ---- the public card visitors see (own hall) */
  function card(s) {
    const h = s.hall; if (!h) return null;
    return { owner: s.id, ownerName: s.name, level: s.level, town: h.town, name: h.name, rooms: h.rooms, decor: h.decor, staff: Object.keys(h.staff || {}),
      trophies: (h.trophies || []).slice(0, 12).map((r) => r.item), shop: !!lvl(h, "counter") };
  }
  const inTown = (docs, town, uid) => docs.filter((d) => d && d.town === town && d.name && d.owner !== uid && !d.clan);
  const clanHallOf = (docs, clanId) => docs.find((d) => d && d.clan === clanId) || null;

  return { DAY, TOWNS: TOWNS_, ROOMS, CLAN_ROOMS, DECOR, STAFF, CLAN_STAFF, COSY, HALL_FEE, THIEF_CHANCE, CLAN_TAKES_PER_DAY,
    plotHere, plotPrice, buyPlot, foundClanHall, cost, canPay, build, addDecor, removeDecor, hire, dismiss, deposit, withdraw, settle,
    shopOpen, shopCap, travellerBuys, canUse, setClanHall, xpMult, hasForge, rest, pray, refreshTrophies, trophyOk, stash, unstash,
    card, inTown, clanHallOf, lvl, cap, trophyCap, decorCap, comfort, wages, roomCount, isClan, name };
})();
