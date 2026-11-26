/* A living world: rumours that come true, towns that know what you did, and towns that keep hours. [OURS]
   - Rumours: innkeepers (for the price of a drink) and townsfolk in the streets (free, less reliable) tell you about
     something near town: bandits with a named leader, a lost shipment, strange lights over a barrow, someone gone
     missing, a big beast taking sheep. Each one puts a mark on your map and lasts about a day and a half of game time.
     Go there and see: most are real (a named foe, extra loot, a rescue), some are just tavern talk.
   - Your name in the holds: deeds you actually did (dragons, cleared places, quest lines, guild ranks, homes, being
     Thane, rumours you saw through) and your crimes add up to a standing per hold. Guards and shopkeepers mention
     them, and friends and heroes of a hold get a small discount in its shops. Shown in the Journal (Misc).
   - Day and night: a line on what the town is doing, the inn fills up in the evening (a little crowd
     picture), and closed shops can be knocked up at night for a small extra charge, so shopping never breaks.
   Perks (perkfx.js): Good Ear (Speechcraft), Local Hero (Etiquette), Night Owl (Streetwise).
   Everything is per player (s.rw) and optional: with this file missing the game plays as before. */
const RUMOURS = (() => {
  const DOM = typeof document !== "undefined";
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const has = (n) => typeof globalThis[n] !== "undefined";
  const now = () => G.now();
  const GS = () => G.GAME_SPEED || 12;
  const gameH = (h) => (h * 3600) / GS();                       // real seconds in h in-game hours
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const hash = (t) => { let h = 0; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  const place = (n) => (typeof WORLD !== "undefined" ? WORLD.places[n] : null);
  const holdOf = (n) => { const p = place(n); return p ? G.holdAt(p) : ""; };
  const isTown = (n) => ["city", "town"].includes(place(n)?.[2]);

  const MAX_ACTIVE = 3;    // leads you can chase at once
  const LIFE_H = 36;       // in-game hours a lead stays (3 real hours)
  const WAIT_H = 12;       // in-game hours before the same person has something new
  const FALSE_INN = 0.25, FALSE_STREET = 0.4;

  function st(s) {
    s.rw = s.rw || {};
    const r = s.rw;
    r.list = r.list || []; r.fame = r.fame || {}; r.next = r.next || {}; r.log = r.log || [];
    r.seen = r.seen || 0; r.duds = r.duds || 0;
    return r;
  }

  // ====================================================================== rumours
  const BANDIT = ["Krev the Skinner", "Red Hilda", "Ulf Two-Knives", "Sorli the Grim", "Bjartur Half-Ear", "Mjoll the Black", "Agnar Crow-Feet", "Old Thrynn"];
  const BEAST = [["Sabre cat", "Old Scar", "a huge sabre cat"], ["Black bear", "Grandmother Bear", "a bear the size of a cart"], ["Wolf pack", "the Grey Pack", "a wolf pack with a white leader"]];
  const LIGHTS = ["the Restless Wight", "the Lantern Draugr", "a Barrow Lord", "the Pale Watcher"];
  const KIDNAP = [["Bandit outlaw", "kidnappers"], ["Forsworn ambush", "Forsworn raiders"], ["Wolf pack", "a pack of wolves"]];
  const WHO_MISSING = ["the miller's boy", "a young hunter", "the farmer's daughter", "an old priest of Arkay", "the innkeeper's cousin", "a courier from the Jarl"];
  const MERCHANT = ["a Khajiit trader", "an Imperial merchant", "a Nord fur trader", "a pedlar from Cyrodiil"];
  const KINDS = {
    bandits: { icon: "", title: "Bandits about", where: ["fort", "camp", "landmark", "dungeon"], fame: 6,
      say: ["Bandits have been seen near {p}. Their leader calls herself {n}. Or himself. Depends who's telling it.", "Watch the road by {p}. {n} and a gang of cut-throats are camped out there.", "Three carts robbed this week near {p}. Folk say it's {n}'s lot."],
      dud: "You search {p} high and low. Old ashes, a broken cart wheel and a very confused fox. No bandits. Just tavern talk.",
      win: "You find {n}'s camp at {p} and put an end to it. The Jarl's steward pays a bounty: {g} gold." },
    shipment: { icon: "", title: "A lost shipment", where: ["landmark", "farm", "camp", "fort", "dungeon"], fame: 3,
      say: ["{m} lost a whole cart of goods near {p}. Says bandits, says wolves, depends how much mead he's had.", "A wagon went into the ditch near {p}. Nobody's gone back for the crates yet.", "There's a shipment lying out near {p}. Whoever gets there first keeps it, I reckon."],
      dud: "You walk every inch around {p}. Wheel tracks, maybe. No crates. Somebody beat you to it, or there never was a cart.",
      win: "Near {p} you find the overturned cart, half buried. You haul out what's still good: {loot}." },
    lights: { icon: "", title: "Strange lights", where: ["dungeon"], match: /barrow|tomb|ruin|crypt|cairn|grave|hall|sepulch/i, fame: 5,
      say: ["Folk saw strange lights over {p} last night. Green, like witchfire.", "My uncle swears he heard chanting at {p}. And lights. He's sober. Mostly.", "Something's awake in {p}. The dogs won't go near it after dark."],
      dud: "You wait by {p} until the cold gets into your bones. Fireflies. Just fireflies.",
      win: "At {p} the lights gather into {n}. When it falls, the glow fades and leaves something behind: {loot}." },
    rescue: { icon: "", title: "Someone's missing", where: ["camp", "dungeon", "fort", "landmark"], fame: 8,
      say: ["{v} went out to {p} two days ago and never came back.", "Have you heard? {v} was taken near {p}. Nobody's brave enough to go.", "If you're heading toward {p}, keep an eye out for {v}. The family's worried sick."],
      dud: "You search {p} and call out until you're hoarse. On your way back you hear {v} turned up at home last night, embarrassed and hungover.",
      win: "You find {v} at {p}, held by {k}. After the fight you walk them home. The family presses {g} gold on you and won't take no for an answer." },
    beast: { icon: "", title: "A beast on the prowl", where: ["farm", "landmark", "camp", "lair"], fame: 5,
      say: ["{b} has been taking sheep near {p}. The farmers call it {n}.", "Don't go near {p} alone. {n} is out there, and it's hungry.", "{n}, they call it. {b} that's killed three hounds near {p}."],
      dud: "You track around {p} for hours. Paw prints, but small ones. Somebody's dog, most likely.",
      win: "Near {p} you finally meet {n}. It's every bit as big as they said. The farmers chip in {g} gold." },
  };
  const INN_VOICE = ["leans over the bar", "lowers their voice", "wipes a mug and nods toward the door", "shrugs"];
  const STREET_WHO = ["A farmhand", "An old woman by the well", "A guard off duty", "A kid with a wooden sword", "A beggar", "A hunter selling pelts", "A drunk outside the inn"];

  const leads = (s, t = now()) => st(s).list.filter((r) => r.until > t && place(r.place));
  function sync(s, t = now()) { const r = st(s); r.list = r.list.filter((x) => x.until > t && place(x.place)); return r; }

  function candidates(s, town, kind) {
    const here = place(town), K = KINDS[kind], taken = new Set(st(s).list.map((r) => r.place));
    const ok = ([n, p]) => K.where.includes(p[2]) && !taken.has(n) && (!K.match || K.match.test(n)) && WORLD.same(here, p) && (!WORLD.hidden?.has(n) || s.discovered.includes(n));
    let list = Object.entries(WORLD.places).filter(ok).map(([n, p]) => ({ n, d: G.pxDist(here, p) })).filter((x) => x.d > 25 && x.d < 230).sort((a, b) => a.d - b.d).slice(0, 8);
    if (!list.length && K.match) list = Object.entries(WORLD.places).filter(([n, p]) => p[2] === "dungeon" && !taken.has(n) && WORLD.same(here, p)).map(([n, p]) => ({ n, d: G.pxDist(here, p) })).filter((x) => x.d > 25 && x.d < 230).sort((a, b) => a.d - b.d).slice(0, 8);
    return list;
  }
  const falseChance = (s, src) => (src === "inn" ? FALSE_INN : FALSE_STREET) * (1 - Math.min(0.9, pfx(s, "rumtrue"))) * (1 - 0.3 * Math.min(100, G.skill(s, "Speechcraft")) / 100);
  const lifeOf = (s) => gameH(LIFE_H) * (1 + pfx(s, "rumtime"));
  const price = (s) => (typeof TOWNS !== "undefined" && TOWNS.rumourPrice ? TOWNS.rumourPrice(s) : 10);
  const waitKey = (town, src) => `${town}|${src}`;
  const waitLeft = (s, town, src, t = now()) => Math.max(0, (st(s).next[waitKey(town, src)] || 0) - t);
  const fill = (txt, r) => txt.replace(/\{p\}/g, r.place).replace(/\{n\}/g, r.name || "").replace(/\{m\}/g, r.m || "a merchant").replace(/\{v\}/g, r.v || "someone")
    .replace(/\{b\}/g, r.b || "a beast").replace(/\{k\}/g, r.k || "bandits").replace(/\{g\}/g, r.g ?? "").replace(/\{loot\}/g, r.loot || "");
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  /* hear a rumour: src "inn" (innkeeper, costs a drink) or "street" (townsfolk, free) -> { text, lead } | { err } */
  function hear(s, src = "inn", t = now(), rnd = Math.random) {
    const town = s.location;
    if (!town || !isTown(town)) return { err: "There's nobody here to gossip with." };
    if (src === "inn" && !(typeof TOWNS !== "undefined" && TOWNS.INNS[town])) return { err: "There's no inn here." };
    if (typeof TOWNS !== "undefined" && TOWNS.wanted(s)) return { err: "Nobody wants to be seen talking to you." };
    const r = sync(s, t);
    if (r.list.length >= MAX_ACTIVE) return { err: `You've already got ${MAX_ACTIVE} leads to chase. Check one out first (the World tab).` };
    const wait = waitLeft(s, town, src, t);
    if (wait > 0) return { err: `${src === "inn" ? "The innkeeper" : "The locals"} ${src === "inn" ? "has" : "have"} nothing new. Try again in about ${fmtLeft(wait)}.` };
    const p = src === "inn" ? price(s) : 0;
    if (s.gold < p) return { err: `A drink to loosen tongues costs ${p} gold.` };
    const kinds = Object.keys(KINDS).filter((k) => candidates(s, town, k).length);
    if (!kinds.length) return { err: "Nothing's going on around here. Peaceful, for once." };
    s.gold -= p;
    const lead = makeLead(s, town, src, kinds, t, rnd), where = lead.place;
    r.next[waitKey(town, src)] = t + gameH(WAIT_H);
    const sk = typeof G !== "undefined" ? [...G.useSkill(s, "Speechcraft", 8), ...(src === "street" ? G.useSkill(s, "Streetwise", 8) : [])] : [];
    const who = src === "inn" ? `${innkeeper(town)} ${pick(INN_VOICE, rnd)}` : pick(STREET_WHO, rnd);
    return { lead, text: `${who}: “${cap(lead.say)}” ${where} is marked on your map.${p ? ` (${p} gold for the drink.)` : ""}` + (sk.length ? " " + sk.join(". ") : "") };
  }
  /* make a lead about a place near `town`, put it on your list and your map */
  function makeLead(s, town, src, kinds, t, rnd) {
    const r = st(s), kind = pick(kinds, rnd), list = candidates(s, town, kind), where = list[Math.floor(rnd() * Math.min(list.length, 5))].n;
    const lead = { id: `${Math.floor(t)}-${hash(where + kind) % 1000}`, kind, place: where, town, hold: holdOf(where), src, made: t, until: t + lifeOf(s), real: rnd() >= falseChance(s, src) };
    if (kind === "bandits") lead.name = pick(BANDIT, rnd);
    if (kind === "shipment") lead.m = pick(MERCHANT, rnd);
    if (kind === "lights") lead.name = pick(LIGHTS, rnd);
    if (kind === "rescue") { lead.v = pick(WHO_MISSING, rnd); [lead.tpl, lead.k] = pick(KIDNAP, rnd); }
    if (kind === "beast") [lead.tpl, lead.name, lead.b] = pick(BEAST, rnd);
    lead.say = fill(pick(KINDS[kind].say, rnd), lead);
    r.list.push(lead); r.seen++;
    if (!s.discovered.includes(where)) s.discovered.push(where);
    return lead;
  }
  /* news from travellers on the road (caravanroad.js): a free lead about somewhere near `town` -> { lead, say } | { err } */
  function roadLead(s, town, t = now(), rnd = Math.random) {
    if (!town || !place(town)) return { err: "They haven't heard anything worth telling." };
    const r = sync(s, t);
    if (r.list.length >= MAX_ACTIVE) return { err: `You've already got ${MAX_ACTIVE} leads to chase.` };
    const kinds = Object.keys(KINDS).filter((k) => candidates(s, town, k).length);
    if (!kinds.length) return { err: "Nothing much is going on that way." };
    const lead = makeLead(s, town, "road", kinds, t, rnd);
    return { lead, say: cap(lead.say) };
  }
  const innkeeper = (town) => { try { return (typeof NPCART !== "undefined" && NPCART.who(town, "inn")?.name) || "The innkeeper"; } catch { return "The innkeeper"; } };

  /* the lead you're standing on, if any */
  const leadHere = (s, t = now()) => (s.trip?.status === "travel" || s.dungeon || !s.location ? null : leads(s, t).find((r) => r.place === s.location) || null);

  const LOOT = { shipment: ["mat_iron", "mat_steel", "mat_leather", "potion_health", "potion_stamina", "gem_garnet", "gem_amethyst", "mat_silver"], lights: ["soul_gem_common", "gem_sapphire", "gem_ruby", "potion_magicka", "scroll_fireball", "gem_flawless_garnet"] };
  function giveLoot(s, list, n) {
    const ok = list.filter((i) => D.ITEMS[i]), got = [];
    for (let k = 0; k < n && ok.length; k++) { const i = ok.splice(Math.floor(Math.random() * ok.length), 1)[0]; G.give(s, i); got.push(D.ITEMS[i].name); }
    return got;
  }
  function foeFor(s, lead) {
    const tplName = lead.kind === "bandits" ? "Bandit outlaw" : lead.kind === "lights" ? "Draugr" : lead.tpl || "Bandit outlaw";
    const tpl = D.ENCOUNTERS.find((e) => e.name === tplName) || D.ENCOUNTERS.find((e) => e.danger === "medium");
    const named = lead.kind === "rescue" ? cap(lead.k) : lead.name;
    const e = { ...tpl, name: named, tags: [...new Set([...(tpl.tags || []), "elite"])], health: Math.round(tpl.health * 1.25), damage: tpl.damage,   // a leader: tougher than the usual, not a wall
      gold: [Math.round((tpl.gold?.[0] || 10) * 2), Math.round((tpl.gold?.[1] || 30) * 2.5)], text: fill(KINDS[lead.kind].say[0], lead) };
    const f = G.scaleEnemy(e, G.fightLevel ? G.fightLevel(s) : s.level);
    f.hold = lead.hold;
    return f;
  }
  const addFame = (s, hold, pts) => { const r = st(s); r.fame[hold] = Math.round(((r.fame[hold] || 0) + pts * (1 + pfx(s, "fame"))) * 10) / 10; };

  /* see a lead through at its place -> { text, fight?, died?, gold?, loot?, skills?, dud? } | { err } */
  function act(s, id, t = now()) {
    const r = sync(s, t), lead = r.list.find((x) => x.id === id);
    if (!lead) return { err: "That lead has gone cold." };
    if (s.location !== lead.place || s.trip?.status === "travel" || s.dungeon) return { err: `Go to ${lead.place} first.` };
    const K = KINDS[lead.kind], done = (res) => { r.list = r.list.filter((x) => x !== lead); r.log.unshift({ t, kind: lead.kind, place: lead.place, hold: lead.hold, real: !!lead.real && !res.died, won: !res.died && !res.dud }); r.log = r.log.slice(0, 12); return res; };
    if (!lead.real) { r.duds++; const sk = G.useSkill(s, "Speechcraft", 4); return done({ dud: true, text: fill(K.dud, lead) + (sk.length ? " " + sk.join(". ") : "") }); }
    if (lead.kind === "shipment") {
      const g = 40 + 6 * s.level + rint(0, 40); s.gold += g;
      const got = [`${g} gold`, ...giveLoot(s, LOOT.shipment, 2)];
      addFame(s, lead.hold, K.fame); if (has("IMM")) IMM.count(s, "rumours");
      return done({ text: fill(K.win, { ...lead, loot: got.join(", ") }), gold: g, loot: got.slice(1), found: true });
    }
    const e = foeFor(s, lead);
    const f = new G.Fight(s, e, null, t); f.run({ t }); const skills = f.apply(t);
    if (!f.won) { const d = G.die(s, e.name, t); return done({ text: `${e.name} was too much for you.`, fight: f, died: d.msg, skills: d.rolledBack ? [] : skills }); }
    const g = (lead.kind === "rescue" ? 80 : 50) + 8 * s.level + rint(0, 40); s.gold += g;
    const loot = G.rollLoot ? G.rollLoot(s, e) : [];
    if (lead.kind === "lights") loot.push(...giveLoot(s, LOOT.lights, 1));
    addFame(s, lead.hold, K.fame); if (has("IMM")) IMM.count(s, "rumours");
    return done({ text: fill(K.win, { ...lead, g, loot: loot.join(", ") || "nothing much" }), fight: f, gold: g, loot, skills });
  }

  // ====================================================================== your name in the holds
  const HOLDS = ["Whiterun", "Haafingar", "Eastmarch", "The Rift", "The Reach", "Falkreath", "The Pale", "Hjaalmarch", "Winterhold"];
  const TIERS = [[50, "Hero of the hold", 0.06], [25, "Friend of the hold", 0.03], [10, "Familiar face", 0], [0, "Stranger", 0], [-Infinity, "Trouble", 0]];
  /* standing in a hold -> { pts, tier, off, deeds:[...], bounty } */
  function standing(s, hold) {
    const deeds = [];
    let pos = st(s).fame[hold] || 0;
    const solved = st(s).log.filter((x) => x.hold === hold && x.won).length;
    if (solved) deeds.push(`${solved} rumour${solved > 1 ? "s" : ""} seen through`);
    const cl = Object.keys(s.cleared || {}).filter((n) => holdOf(n) === hold).length;
    if (cl) { pos += 3 * Math.min(cl, 10); deeds.push(`${cl} place${cl > 1 ? "s" : ""} cleared`); }
    const dr = s.dragons || 0;
    if (dr) { pos += 4 * Math.min(dr, 5); deeds.push(`${dr} dragon${dr > 1 ? "s" : ""} slain`); }
    const lines = Object.entries(s.quests || {}).filter(([id, v]) => v?.done && typeof QUESTS !== "undefined" && QUESTS.L[id]);
    for (const [id] of lines) { const start = QUESTS.L[id].start, local = start && holdOf(start) === hold; pos += local ? 10 : 3; if (local) deeds.push(QUESTS.L[id].name); }
    const homes = Object.keys(s.homes || {}).filter((n) => holdOf(n) === hold).length;
    if (homes) { pos += 6; deeds.push("you own a house here"); }
    if (hold === "Whiterun" && s.thaneWhiterun) { pos += 10; deeds.push("Thane"); }
    if (has("GUILDS")) {
      const th = GUILDS.rank(s, "thieves"); if (th && hold === "The Rift") deeds.push(`Thieves Guild ${th.name}`);
      const db = GUILDS.rank(s, "brotherhood"); if (db && db.i >= 2) deeds.push("whispers of the Dark Brotherhood");
    }
    pos *= 1 + pfx(s, "fame");
    if ((typeof LIVING !== "undefined")) { pos += LIVING.points(s, hold); deeds.push(...LIVING.deedWords(s, hold)); }   // deeds remembered (livingworld.js)
    const bounty = (s.bounty || {})[hold] || 0;
    const pts = Math.round(pos - Math.min(60, bounty / 20) - (s.resisted?.[hold] ? 15 : 0));
    if (bounty) deeds.push(`${bounty} gold bounty`);
    const [, tier, off0] = TIERS.find(([min]) => pts >= min);
    const off = bounty ? 0 : off0 * (1 + pfx(s, "heroprice"));
    return { hold, pts, tier: tier === "Hero of the hold" ? `Hero of ${hold}` : tier, off, deeds, bounty };
  }

  // ====================================================================== day and night, knocking
  const hour = (t = now()) => G.clock(t).hour;
  function dayLine(h = hour()) {
    if (h >= 5 && h < 8) return ["", "Early morning. Shutters still down, smiths lighting the forges."];
    if (h >= 8 && h < 17) return ["", "Daytime. Shops are open and the market's busy."];
    if (h >= 17 && h < 20) return ["", "Evening. Shops close at 20:00 and the inn's filling up."];
    return ["", "Night. Shops are shut, guards walk the walls, and the inn is the only warm light."];
  }
  function crowd(h = hour()) {
    if (h >= 20 || h < 1) return { n: 7, text: "Packed! The bard's playing and everybody's talking at once. Best time to hear something." };
    if (h >= 17) return { n: 5, text: "Filling up. Workers in for a mug after the day." };
    if (h >= 11) return { n: 3, text: "A handful of travellers eating lunch." };
    if (h >= 5) return { n: 2, text: "Quiet. A couple of early risers with porridge." };
    return { n: 1, text: "Nearly empty. One snorer by the fire." };
  }
  const KNOCK = 0.15, KNOCK_SELL = 0.1;
  const knockBump = (s, town) => { if (s?.rw?.knock?.free && s.rw.knock.town === town) return 0;   // a shopkeeper you found at the inn (livingworld.js)
    const sd = standing(s, holdOf(town)); return KNOCK * Math.max(0, 1 - pfx(s, "knock")) * (sd.pts >= 50 ? 0.5 : 1); };
  function knocked(s, town = s?.location, t = now()) {
    const k = s?.rw?.knock;
    return !!(k && town && k.town === town && t < k.until && !G.shopsOpen(t));
  }
  function knock(s, t = now()) {
    const town = s.location;
    if (!town || !G.shopTypes(town).length) return { err: "There's no shop here." };
    if (G.shopsOpen(t)) return { err: "The shops are open. Walk right in." };
    if (typeof TOWNS !== "undefined" && TOWNS.wanted(s)) return { err: "Nobody opens the door for a wanted criminal." };
    if ((typeof LIVING !== "undefined") && LIVING.shut(s, holdOf(town))) return { err: "Nobody in this hold opens a door to you at night. Make amends first." };
    const h = hour(t), left = h >= 8 ? 24 - h + 8 : 8 - h;
    st(s).knock = { town, until: t + gameH(left) };
    const b = Math.round(knockBump(s, town) * 100), sd = standing(s, holdOf(town));
    const line = sd.pts >= 50 ? `"Oh, it's you! Come in, come in."` : sd.pts < 0 ? `"You? At this hour? ...Fine. But you pay extra."` : pick([`"Who's banging at this hour? ...Oh. Fine, come in."`, `"We're closed! ...Well, since you're here."`, `A bleary eye at the shutter. "This better be worth it."`]);
    return { text: `${line} The shops here will serve you until morning${b ? `, at ${b}% over the usual price (and ${Math.round(KNOCK_SELL * 100)}% less for what you sell)` : ""}.` };
  }
  /* shops multiply their asking price by this (engine.js buyPrice) */
  function priceMult(s, town, t = now()) {
    if (!s || !town || !place(town)) return 1;
    let m = 1 - standing(s, holdOf(town)).off;
    if (knocked(s, town, t)) m *= 1 + knockBump(s, town);
    if ((typeof LIVING !== "undefined")) m *= LIVING.priceAdj(s, holdOf(town));   // scorned: shops charge more (livingworld.js)
    return m;
  }
  /* and what they pay you by this (engine.js sellPrice) */
  const sellMult = (s, town, t = now()) => (s && town && knocked(s, town, t) && knockBump(s, town) > 0 ? 1 - KNOCK_SELL : 1);

  // ====================================================================== what people say about you
  function deedLines(s, hold) {
    const out = [], sd = standing(s, hold);
    if ((s.dragons || 0) > 0) out.push("They say you killed a dragon. With your bare hands, the way my brother tells it.", "Dragon slayer, eh? Drinks are on... well, not me.");
    const cl = Object.entries(s.cleared || {}).filter(([n]) => holdOf(n) === hold).sort((a, b) => b[1] - a[1])[0];
    if (cl) out.push(`You're the one who cleared out ${cl[0]}? Things have been quieter since.`);
    const solved = st(s).log.find((x) => x.hold === hold && x.won);
    if (solved) out.push(solved.kind === "rescue" ? `You brought someone home from ${solved.place}. People don't forget that.` : solved.kind === "bandits" ? `Heard you sorted out those bandits at ${solved.place}. Good riddance.` : solved.kind === "beast" ? `That beast near ${solved.place}? Gone, thanks to you. The farmers are sleeping again.` : `Word is you checked out the talk about ${solved.place}. Brave, or daft.`);
    if (typeof QUESTS !== "undefined") {
      const q = s.quests || {};
      if (q.companions?.done) out.push("A Companion, walking among us. Jorrvaskr chose well.");
      if (q.college?.done) out.push("Arch-Mage, is it? Keep your spells to yourself in here.");
      if (q.main?.done) out.push("They say you're the one the Greybeards called. Is it true?");
    }
    if (has("GUILDS")) {
      const th = GUILDS.rank(s, "thieves");
      if (th && th.i >= 1) out.push(hold === "The Rift" ? "Brynjolf speaks well of you. That's worth something in Riften." : "I'm keeping one hand on my purse while you're around.");
      const db = GUILDS.rank(s, "brotherhood"); if (db && db.i >= 2 && hash(s.name + hold) % 2) out.push("There's something cold about you. Never mind.");
    }
    if (sd.bounty) out.push("I know your face. There's a price on it in this hold.", "Behave yourself. We know what you did.");
    if (sd.pts >= 50) out.push(`Hero of ${hold}! It's an honour.`, "The children play at being you, you know.");
    else if (sd.pts >= 25) out.push("Good to see you back. You've done right by this hold.");
    if ((typeof LIVING !== "undefined")) out.push(...LIVING.lines(s, hold));   // caravans, crimes, dragons, whispers seen through (livingworld.js)
    return out;
  }
  /* extra guard barks (immerse.js adds them to its pool) */
  const barks = (s, town) => { try { return isTown(town) ? deedLines(s, holdOf(town)) : []; } catch { return []; } };
  /* a shopkeeper's line now and then (npcart.js greeting) */
  function greet(s, n) {
    try {
      if (!s || !n || !["merchant", "smith", "innkeeper", "wizard", "alchemist", "stable", "fence"].includes(n.role)) return null;
      const hold = n.hold || (n.town && holdOf(n.town)); if (!hold) return null;
      const day = G.clock().day, sd = standing(s, hold);
      if (hash(n.name + "|rw|" + day) % 3) return null;   // one day in three
      if (sd.off > 0 && !sd.bounty) return sd.pts >= 50 ? `Our hero! For you, ${Math.round(sd.off * 100)}% off. Don't tell the others.` : `A friend of the hold. I'll knock a little off for you.`;
      const lines = deedLines(s, hold);
      return lines.length ? lines[hash(n.name + day) % lines.length] : null;
    } catch { return null; }
  }

  // ====================================================================== pictures
  function crowdArt(n, night) {
    const W = 300, H = 74, r = (k) => ((hash("crowd" + k) % 1000) / 1000);
    const wall = night ? "#2a1c12" : "#3a2a1a", floor = night ? "#1b120b" : "#2a1d12", fire = "#e8913a";
    let g = `<rect width="${W}" height="${H}" fill="${wall}"/><rect y="${H - 16}" width="${W}" height="16" fill="${floor}"/>`;
    // hearth with a glow
    g += `<radialGradient id="rwg"><stop offset="0" stop-color="#ffb35a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb35a" stop-opacity="0"/></radialGradient><circle cx="150" cy="${H - 22}" r="60" fill="url(#rwg)"/><path d="M132 ${H - 16} v-22 q18 -10 36 0 v22z" fill="#4a3b2c" stroke="#1a120a"/><path d="M143 ${H - 16} q7 -20 14 0z" fill="${fire}"/><path d="M147 ${H - 17} q3 -10 6 0z" fill="#ffd27a"/>`;
    // tables
    for (const x of [40, 240]) g += `<rect x="${x - 22}" y="${H - 26}" width="44" height="5" rx="2" fill="#6b4a2a" stroke="#2a1a0c"/><path d="M${x - 16} ${H - 21} v6 M${x + 16} ${H - 21} v6" stroke="#4a3320" stroke-width="3"/>`;
    // folk: positions fixed so the picture doesn't jump about
    const spots = [22, 58, 222, 258, 96, 196, 118];
    const cloth = ["#7a3b2e", "#3e5a3a", "#4a4f6e", "#6e5a3a", "#5a3a5e", "#7a6a4a", "#3a5a62"];
    for (let i = 0; i < n; i++) {
      const x = spots[i], c = cloth[i], tall = 14 + Math.round(r(i) * 5), y = H - 16;
      g += `<path d="M${x - 7} ${y} q1 -${tall} 7 -${tall} q6 0 7 ${tall}z" fill="${c}" stroke="#1a120a"/><circle cx="${x}" cy="${y - tall - 4}" r="4.5" fill="#d9b38c" stroke="#1a120a"/>${i % 2 ? `<rect x="${x + 5}" y="${y - tall + 2}" width="4" height="6" rx="1" fill="#c9a560" stroke="#1a120a" stroke-width=".6"/>` : ""}`;
    }
    if (n >= 7) g += `<path d="M166 ${H - 16} q2 -18 6 -18 q4 0 6 18z" fill="#2e4e6e" stroke="#1a120a"/><circle cx="172" cy="${H - 38}" r="4" fill="#d9b38c" stroke="#1a120a"/><ellipse cx="181" cy="${H - 28}" rx="5" ry="3" fill="#a8743a" stroke="#1a120a"/><text x="186" y="${H - 40}" font-size="10" fill="#f0d79a">♪</text>`;
    return `<svg class="rw-crowd" viewBox="0 0 ${W} ${H}" role="img" aria-label="The inn, ${n} people inside">${g}</svg>`;
  }
  function closedArt() {
    return `<svg class="rw-shut" viewBox="0 0 64 44" aria-hidden="true"><rect x="1" y="1" width="62" height="42" rx="4" fill="#3a2a1a" stroke="#1a120a"/>${[0, 1, 2, 3, 4].map((i) => `<path d="M5 ${7 + i * 8} h54" stroke="#6b4e30" stroke-width="5" stroke-linecap="round"/>`).join("")}<path d="M24 16 h16 l3 6 l-3 6 h-16 l-3 -6z" fill="#c9a560" stroke="#1a120a"/><path d="M27 22 h10" stroke="#3a2a1a" stroke-width="2"/></svg>`;
  }

  // ====================================================================== HTML pieces
  function fmtLeft(sec) {
    const g = Math.max(0, Math.ceil(sec * GS())), d = Math.floor(g / 86400), h = Math.floor((g % 86400) / 3600), m = Math.floor((g % 3600) / 60);
    return d ? `${d} day${d > 1 ? "s" : ""} ${h} h` : h ? `${h} h` : `${Math.max(1, m)} min`;
  }
  const repLine = (s, hold) => { const sd = standing(s, hold); return `<p class="rw-rep">Your name in ${esc(hold)}: <b class="${sd.pts < 0 ? "bad" : sd.pts >= 25 ? "good" : ""}">${esc(sd.tier)}</b>${sd.off ? ` · ${Math.round(sd.off * 100)}% off in shops` : ""}</p>`; };
  /* everything this module adds to a town section; open = shops are serving you right now */
  function townHTML(s, town, section, open) {
    try {
      const h = hour(), [ic, line] = dayLine(h), hold = holdOf(town);
      let out = `<p class="rw-day"><span aria-hidden="true">${ic}</span> ${esc(line)}</p>`;
      const shop = ["general", "blacksmith", "wizard", "fence", "stables"].includes(section);
      if (shop || section === "inn" || section === "streets") out += repLine(s, hold);
      if (shop && !G.shopsOpen()) {
        out += knocked(s, town)
          ? `<div class="rw-knock on">${closedArt()}<div><b>You knocked, and they let you in.</b><span>${Math.round(knockBump(s, town) * 100) ? `Night prices until 08:00: ${Math.round(knockBump(s, town) * 100)}% more to buy, ${Math.round(KNOCK_SELL * 100)}% less for what you sell.` : "Night Owl: no extra charge."}</span></div></div>`
          : `<div class="rw-knock">${closedArt()}<div><b>Closed. Back in the morning (08:00).</b><span>Knock anyway? They'll grumble and charge about ${Math.round(knockBump(s, town) * 100)}% more.</span></div><button class="btn sm" data-rw="knock">Knock</button></div>`;
      }
      if (section === "inn") {
        const c = crowd(h), wait = waitLeft(s, town, "inn"), n = leads(s).length;
        out += `<div class="rw-inn">${crowdArt(c.n, h >= 20 || h < 5)}<p class="sub">${esc(c.text)}</p></div>
          <div class="item rw-ask"><div class="t">What's the word?<span>${wait > 0 ? `Nothing new yet. Ask again in about ${fmtLeft(wait)}.` : n >= MAX_ACTIVE ? `You have ${MAX_ACTIVE} leads already.` : "The innkeeper hears everything. Some of it's even true."}</span></div><span class="num gold">${price(s)}</span><button class="btn sm" data-rw="hear" data-src="inn" ${wait > 0 || n >= MAX_ACTIVE ? "disabled" : ""}>Ask</button></div>`;
      }
      if (section === "streets") {
        const wait = waitLeft(s, town, "street"), n = leads(s).length;
        out += `<div class="item rw-ask"><div class="t">Chat with the locals<span>${wait > 0 ? `They've told you all they know. Try again in about ${fmtLeft(wait)}.` : "Free, but street talk is wrong more often than the innkeeper."}</span></div><button class="btn sm" data-rw="hear" data-src="street" ${wait > 0 || n >= MAX_ACTIVE ? "disabled" : ""}>Chat</button></div>`;
      }
      if ((typeof LIVING !== "undefined")) out += LIVING.townHTML(s, town, section, open);   // who's about, doors, whispers (livingworld.js)
      return out;
    } catch (e) { return ""; }
  }
  /* Travel tab: a card when you're standing where a rumour points */
  function card(s) {
    const lw = (typeof LIVING !== "undefined") ? LIVING.card(s) : "";   // a whisper that came true here (livingworld.js)
    const lead = leadHere(s); if (!lead) return lw;
    const K = KINDS[lead.kind], verb = { bandits: " Find the camp", shipment: " Search for the cart", lights: " Wait for the lights", rescue: " Search for them", beast: " Track it down" }[lead.kind];
    return `<div class="panel xcard rw-card"><h2>${K.icon} ${esc(K.title)}</h2><p class="sub">“${esc(cap(lead.say))}” Heard in ${esc(lead.town)}. It might be true.</p><button class="btn pri" data-rw="act" data-id="${esc(lead.id)}" style="width:100%">${verb}</button></div>` + lw;
  }
  /* map marks for map.js */
  const marks = (s) => { try { return leads(s).map((r) => ({ id: r.id, pos: place(r.place).slice(0, 2), label: `${KINDS[r.kind].icon} ${r.place}`, here: s.location === r.place })).concat((typeof LIVING !== "undefined") ? LIVING.marks(s) : []); } catch { return []; } };
  /* Journal → Misc */
  function panel(s) {
    try {
      const t = now(), list = leads(s, t);
      const rows = list.map((r) => `<div class="item on"><span class="xbook" aria-hidden="true">${KINDS[r.kind].icon}</span><div class="t">${esc(KINDS[r.kind].title)} · ${esc(r.place)}<span>“${esc(cap(r.say))}” Gone in about ${fmtLeft(r.until - t)}.</span></div><button class="btn sm" data-act="qmap" data-place="${esc(r.place)}">Map</button></div>`).join("");
      const reps = HOLDS.map((h) => { const sd = standing(s, h); return `<div class="item rw-hold"><div class="t">${esc(h)}<span>${sd.deeds.length ? esc(sd.deeds.slice(0, 4).join(" · ")) : "Nobody here knows you yet."}</span></div><b class="rw-tier ${sd.pts < 0 ? "bad" : sd.pts >= 25 ? "good" : ""}">${esc(sd.tier)}${sd.off ? ` · ${Math.round(sd.off * 100)}% off` : ""}</b></div>`; }).join("");
      const r = st(s);
      return `<div class="panel rw-panel"><h2> Word around Skyrim</h2><p class="sub">Ask innkeepers what's new, or chat with the locals in the streets. Rumours put a mark on your map and last about a day and a half. Most are true. Some aren't.</p>
        ${rows ? `<div class="list">${rows}</div>` : `<p class="sub">No leads right now.</p>`}
        ${r.seen ? `<p class="sub">Rumours heard: ${r.seen} · just talk: ${r.duds}</p>` : ""}
        <h3 class="xh">Your name in the holds</h3><p class="sub">What you've done gets around. Friends of a hold get 3% off in its shops, heroes 6%. Crimes drag your name down.</p><div class="list">${reps}</div></div>` + ((typeof LIVING !== "undefined") ? LIVING.panel(s) : "");
    } catch { return ""; }
  }

  // ====================================================================== buttons (the panels call back through window.__ui)
  if (DOM && typeof document.addEventListener === "function") {
    document.addEventListener("click", (e) => {
      const b = e.target.closest?.("[data-rw]"); if (!b || b.disabled) return;
      const S = window.__dbg?.save?.(), ui = window.__ui; if (!S || !ui) return;
      const toast = (m) => window.__dbg?.toast?.(m), msg = (t, x, bad) => window.__dbg?.message?.(t, x, bad);
      const sfx = (n) => { try { SOUND.fx(n); } catch { /* optional */ } };
      const what = b.dataset.rw;
      if (what === "hear") {
        const r = hear(S, b.dataset.src);
        if (r.err) return toast(r.err);
        sfx("coin"); G.note?.(S, ` ${r.text}`); ui.save(); ui.refresh(); msg(b.dataset.src === "inn" ? "Over a drink" : "Word on the street", r.text);
      } else if (what === "knock") {
        const r = knock(S); if (r.err) return toast(r.err);
        sfx("click"); ui.save(); ui.refresh(); toast(r.text);
      } else if (what === "act") {
        const id = b.dataset.id, go = typeof NOAUTO !== "undefined" ? NOAUTO.call : (fn, done) => done(fn());   // a fight opens on the turn-by-turn screen (noautoplay.js)
        go(() => act(S, id), (r) => {
          if (r.err) return toast(r.err);
          if (!r.dud) G.note?.(S, `\uE103 ${r.text}`);
          ui.save(); ui.refresh();
          if ((r.fight || r.died) && ui.fight) return ui.fight(r);
          sfx(r.dud ? "click" : "coin");
          msg(r.dud ? "Just talk" : "The rumour was true", r.text + (r.loot?.length && !r.found ? ` Loot: ${r.loot.join(", ")}.` : ""));
        });
      }
    });
  }

  return { KINDS, MAX_ACTIVE, LIFE_H, WAIT_H, HOLDS, TIERS, st, hear, roadLead, act, leads, leadHere, sync, falseChance, candidates, standing, knock, knocked, knockBump, priceMult, sellMult,
    dayLine, crowd, deedLines, barks, greet, townHTML, card, marks, panel, crowdArt, closedArt, fmtLeft };
})();
