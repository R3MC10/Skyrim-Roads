/* The Expedition Table: tonight's adventure. [OURS]
   The company longhouse's planning table lays out three expeditions a day: a short one, a medium one and a long one.
   They are picked from the company id and the day (real days), so every member sees the same three, and they change at
   midnight. Missing a day costs nothing: you simply get three new ones.
   - Each expedition is a short chain built from what the game already has:
       1. a road event on the way (ride to a town and see what's waiting: three choices, each tested against a skill),
       2. a lead: clear a dungeon in that hold, find a sign of a legendary beast (leghunt.js), pull a heist (heists.js)
          or help a hold in trouble (crises.js contracts, or fights on its roads),
       3. the end: win fights, beat a boss (a dungeon's master, a crisis ringleader, a legendary beast) or go deep below a
          deadly dungeon (deepdelve.js).
     Steps come one after another. You do them the normal way; the expedition only notices.
   - In a party the choice is a vote (partyvote.js rules: majority wins, a tie goes the leader's way). Any member who is in
     a company can put that company's three offers to the party, and "Not tonight" is always one of the options. The road
     event's choice is voted the same way. Only the leader's phone settles a vote; every phone then carries out the result.
     Party progress lives on the party record (p.exped), so whoever does a step does it for everyone. Fight counts only come
     from the leader (members fight beside them, so the same fight isn't counted twice) or from a member who is off alone.
   - Rewards: everyone who finishes gets personal loot (gold by level and length, plus potions, gems or materials), and
     the company gets renown toward a weekly goal (the same entry for the whole party, so bigger parties don't race ahead).
     Reach the goal and everyone who went on at least one expedition that week takes the company's weekly chest once.
     Every finished expedition goes into the company log and the expedition history.
   - The planning table: without it only the short expedition is open; level 1 opens all three, and each level adds 10%
     to the expedition gold.
   Perks (perkfx.js): Expedition Leader (Etiquette: 1/2 rerolls of the company's offers a day) and Seasoned Scout (Sneak:
   the road event shows how each choice will turn out, and its choices go 10% better). Sim: tests/test_expedition.js. */
const EXPEDITION = (() => {
  const DAY = 86400, WEEK = 7 * DAY, LAST = 2 * DAY, VOTE_S = 45, HIST = 12;
  const SLOTS = ["short", "medium", "long"];
  const SLOT_NAME = { short: "Short", medium: "Medium", long: "Long" };
  const SLOT_TIME = { short: "about 15 minutes", medium: "about 25 minutes", long: "40 minutes or more" };
  const RENOWN = { short: 6, medium: 12, long: 20 };
  const PAY = { short: [40, 6], medium: [80, 10], long: [150, 16] };   // gold: a + b × your level
  const nowS = () => (typeof G !== "undefined" && G.now ? G.now() : Date.now() / 1000);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const T = (en, v) => (typeof I18N !== "undefined" && I18N.t ? I18N.t(en, v) : v ? en.replace(/\{(\w+)(:lc)?\}/g, (m, k, lc) => (k in v ? (lc ? String(v[k]).toLowerCase() : String(v[k] ?? "")) : m)) : en);
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hash = (str) => (typeof NETSYNC !== "undefined" ? NETSYNC.hash(str) : [...String(str)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261));
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const pfx = (s, k) => (typeof PFX !== "undefined" && s && s.perks ? PFX.num(s, k) : 0);
  const dayOf = (t = nowS()) => Math.floor(t / DAY);
  const weekOf = (t = nowS()) => Math.floor(t / WEEK);
  const itemName = (id) => (typeof D !== "undefined" && D.ITEMS?.[id] ? trn(D.ITEMS[id].name) : id);
  const trn = (x) => { try { return typeof I18N !== "undefined" && I18N.lang?.() === "pl" && I18N.tr ? I18N.tr(x) ?? x : x; } catch { return x; } };
  const holdAt = (pos) => (typeof G !== "undefined" && G.holdAt ? G.holdAt(pos) : null);

  // ---------------------------------------------------------------- where
  const HOLDS = ["Haafingar", "Hjaalmarch", "The Pale", "Winterhold", "Eastmarch", "Whiterun", "The Reach", "Falkreath", "The Rift"];
  const CAPITAL = { Haafingar: "Solitude", Hjaalmarch: "Morthal", "The Pale": "Dawnstar", Winterhold: "Winterhold", Eastmarch: "Windhelm", Whiterun: "Whiterun", "The Reach": "Markarth", Falkreath: "Falkreath", "The Rift": "Riften" };
  let townCache = null;
  /* every town and city a hold has (known to everyone from the start), sorted so every phone gets the same list */
  function towns(hold) {
    if (!townCache) {
      townCache = {};
      const P = typeof WORLD !== "undefined" ? WORLD.places : {};
      for (const [n, p] of Object.entries(P)) {
        if (!["city", "town"].includes(p[2]) || WORLD.hidden?.has?.(n) || WORLD.isSol?.(p)) continue;
        const h = holdAt(p); if (h && HOLDS.includes(h)) (townCache[h] = townCache[h] || []).push(n);
      }
      for (const h of Object.keys(townCache)) townCache[h].sort();
    }
    return townCache[hold] || [CAPITAL[hold]];
  }
  const heistHold = (h) => (typeof HEISTS !== "undefined" && HEISTS.HOUSES?.[CAPITAL[h]] ? HEISTS.HOUSES[CAPITAL[h]] : null);
  const beasts = () => (typeof LEGHUNT !== "undefined" && Array.isArray(LEGHUNT.L) ? LEGHUNT.L : []);
  const beast = (id) => beasts().find((b) => b.id === id) || null;

  // ---------------------------------------------------------------- the expeditions
  /* art: painted thumbnails exp-<id> (1280x480, assets.js) over the table (expedition-table); "art" is the older picture
     shown until the painting loads */
  const TPL = {
    courier: { name: "The missing courier", art: "biome-pineforest.webp", slots: ["short", "medium"],
      blurb: "A Jarl's courier never reached {town}. Find out what happened on the road.",
      ev: { title: "A satchel in the snow", text: "Off the road near {town} lies a courier's satchel, torn open. Tracks lead three ways.",
        opts: [["quiet", "Follow the light footprints", "Sneak"], ["farm", "Ask at the nearest farm", "Speechcraft"], ["blood", "Follow the blood on the snow", "Archery"]] },
      steps: { short: [["fights", { n: 2, tag: "people" }]], medium: [["dungeon"], ["fights", { n: 2, tag: "people" }]] } },
    wolves: { name: "Wolves of {hold}", art: "fest-hunt.webp", slots: ["short", "medium"],
      blurb: "A pack has been taking sheep and travellers around {town}. The farmers will pay to see it gone.",
      ev: { title: "Howling at dusk", text: "The light goes early near {town}. Eyes shine between the trees, and the howling closes in.",
        opts: [["fire", "Light torches and hold them back", "Destruction"], ["lead", "Shoot the pack leader", "Archery"], ["wind", "Slip past downwind", "Sneak"]] },
      steps: { short: [["fights", { n: 2, tag: "beast" }]], medium: [["fights", { n: 2, tag: "beast" }], ["dungeon"]] } },
    relic: { name: "The buried relic", art: "room-treasure-barrow.webp", slots: ["medium", "long"],
      blurb: "An old map from a {town} trader marks a relic somewhere under {hold}. Others are looking too.",
      ev: { title: "The old map", text: "The trader's map is half rotted. Someone has been at the same cairn before you near {town}.",
        opts: [["read", "Read the old runes on the cairn", "Mysticism"], ["dig", "Dig where the stones are loose", "Athletics"], ["talk", "Buy the trader's last notes", "Speechcraft"]] },
      steps: { medium: [["dungeon"], ["boss"]], long: [["dungeon"], ["deep"]] } },
    caravan: { name: "The frozen caravan", art: "wev-kc.webp", slots: ["short", "medium"],
      blurb: "A supply caravan for {town} is stuck in the drifts. {hold} needs those wagons.",
      ev: { title: "Wagons in the drifts", text: "Three wagons sit in the snow outside {town}, the oxen cold and the drivers colder.",
        opts: [["dig", "Dig the wagons out", "Athletics"], ["fire", "Thaw the axles with a spell", "Destruction"], ["calm", "Calm the drivers and organise them", "Etiquette"]] },
      steps: { short: [["help", { n: 2 }]], medium: [["help", { n: 2 }], ["boss"]] } },
    outlaw: { name: "The outlaw chief", art: "room-fight-cave.webp", slots: ["medium", "long"],
      blurb: "An outlaw chief has been taxing the roads of {hold}. Find their hideout and end it.",
      ev: { title: "The lookout", text: "A bandit lookout sits on a rock above the road to {town}, a horn on his belt.",
        opts: [["creep", "Creep up and take him quietly", "Sneak"], ["bluff", "Walk up and bluff your way past", "Speechcraft"], ["shoot", "Shoot the horn off his belt", "Archery"]] },
      steps: { medium: [["dungeon"], ["boss"]], long: [["heist"], ["boss"]] } },
    beast: { name: "Hunt {beast}", art: "biome-mountain.webp", slots: ["long"],
      blurb: "{beast} has been seen near {town}. The Jarl's steward has a contract for anyone who can bring it down.",
      ev: { title: "Talk in the tavern", text: "Everyone in {town} has a story about {beast}. Most of them are lies.",
        opts: [["listen", "Buy a round and listen", "Speechcraft"], ["sign", "Read the signs on the old trail", "Archery"], ["lore", "Ask the court wizard about it", "Mysticism"]] },
      steps: { long: [["clue"], ["slay"]] } },
  };
  const TPL_IDS = Object.keys(TPL);
  const STEP_SPEC = {   // the step lines on the card
    road: "Ride to {place} and see what's on the road",
    fights: "Win {n} fights in {hold}",
    fights_people: "Win {n} fights against bandits or other outlaws in {hold}",
    fights_beast: "Win {n} fights against beasts in {hold}",
    dungeon: "Clear any dungeon in {hold}",
    boss: "Beat a boss in {hold}: a dungeon's master, a crisis ringleader or a legendary beast",
    heist: "Pull the heist on {house} in {city}",
    clue: "Find a sign of {beast}: take the Jarl's contract in {place} and look around",
    slay: "Slay {beast}",
    deep: "Go down to the second level below a deadly dungeon, or beat a boss in {hold}",
    help: "Help {hold}: do a crisis contract there, or win {n} fights on its roads",
  };

  /* the three offers for a company on a day. roll: how many times the company rerolled today (Expedition Leader). */
  function offers(cid, day = dayOf(), roll = 0) {
    const r = rng(hash(`exp|${cid}|${day}|${roll}`)), pick = (a) => a[Math.floor(r() * a.length) % a.length];
    const out = [], usedT = new Set(), usedH = new Set();
    for (const slot of SLOTS) {
      let ids = TPL_IDS.filter((k) => TPL[k].slots.includes(slot) && !usedT.has(k));
      if (!ids.length) ids = TPL_IDS.filter((k) => TPL[k].slots.includes(slot));
      if (slot === "long" && !beasts().length) ids = ids.filter((k) => k !== "beast");
      const tid = pick(ids), tp = TPL[tid];
      let hold, place, bst = null, house = null;
      if (tid === "beast") {
        const free = beasts().filter((b) => !usedH.has(b.hold));
        bst = pick(free.length ? free : beasts()); hold = bst.hold; place = bst.town;
      } else {
        let hs = HOLDS.filter((h) => !usedH.has(h));
        if (tid === "outlaw" && slot === "long") { const hh = hs.filter((h) => heistHold(h)); if (hh.length) hs = hh; }
        hold = pick(hs.length ? hs : HOLDS); place = pick(towns(hold));
      }
      usedT.add(tid); usedH.add(hold);
      const steps = [{ k: "road", place, hold }];
      for (const [k, o] of tp.steps[slot]) {
        const st = { k, hold, ...(o || {}) };
        if (k === "heist") { const h = heistHold(hold); if (h) { st.city = CAPITAL[hold]; st.house = h.id; } else st.k = "dungeon"; }
        if (k === "clue" || k === "slay") { st.beast = bst?.id; st.place = place; }
        steps.push(st);
      }
      const key = `${day}-${(hash(`${cid}|${day}|${roll}`) % 1679616).toString(36)}-${slot}`;
      const lvl = bst ? bst.lvl : tid === "outlaw" && slot === "long" ? heistHold(hold)?.minLv || 10 : { short: 1, medium: 5, long: 12 }[slot];
      out.push({ key, tpl: tid, slot, hold, place, beast: bst?.id || null, steps, lvl, day });
    }
    return out;
  }
  const titleOf = (o) => T(TPL[o.tpl]?.name || "Expedition", { hold: T(o.hold), beast: beastName(o.beast) });
  const beastName = (id) => { const b = beast(id); return b ? T(b.name) : T("the beast"); };
  const blurbOf = (o) => T(TPL[o.tpl]?.blurb || "", { town: o.place, hold: T(o.hold), beast: beastName(o.beast) });
  function stepText(st) {
    const key = st.k === "fights" && st.tag ? `fights_${st.tag}` : st.k;
    const h = st.house && typeof HEISTS !== "undefined" ? HEISTS.BY_ID?.[st.house] : null;
    const house = h ? (typeof I18N !== "undefined" && I18N.lang?.() === "pl" ? h.name[1] : h.name[0]) : "";
    return T(STEP_SPEC[key] || key, { place: st.place, hold: T(st.hold || ""), n: st.n || 1, city: st.city || "", house, beast: beastName(st.beast) });
  }

  // ---------------------------------------------------------------- your expedition (the save)
  const live = (s, t = nowS()) => { const x = s?.exp; return x && x.o && !x.fin && t - (x.t || 0) < LAST ? x : null; };
  /* what you've done so far that the polled steps compare against */
  function snapshot(s) {
    const lh = s.lhunt || {}, kills = {};
    for (const [id, b] of Object.entries(lh.best || {})) kills[id] = b?.kills || 0;
    let rel = 0; for (const v of Object.values(s.crises?.rel || {})) rel += +v || 0;
    return { heist: s.heist?.stats?.runs || 0, kills, clue: lh.cur ? { id: lh.cur.id, n: lh.cur.clues || 0 } : null, rel };
  }
  function adopt(s, o, t = nowS(), by = null) {
    s.exp = { key: o.key, o: JSON.parse(JSON.stringify(o)), t: Math.floor(t), base: snapshot(s), done: o.steps.map(() => 0), cnt: o.steps.map(() => 0), ev: null, by };
    s.expPart = s.expPart || {}; s.expPart[weekOf(t)] = 1;
    for (const k of Object.keys(s.expPart)) if (+k < weekOf(t) - 2) delete s.expPart[k];
    return s.exp;
  }
  const cur = (x) => (x ? x.done.findIndex((d) => !d) : -1);   // the step you're on (-1: all done)
  function drop(s) { if (s.exp) s.exp = null; }
  /* merge what the party did into your copy */
  function mergeDone(x, pd) {
    if (!x || !pd || pd.key !== x.key) return false;
    let ch = false;
    for (const [i, v] of Object.entries(pd.done || {})) if (v && !x.done[+i]) { x.done[+i] = 1; ch = true; }
    for (const [i, n] of Object.entries(pd.cnt || {})) if ((+n || 0) > (x.cnt[+i] || 0)) { x.cnt[+i] = +n; ch = true; }
    return ch;
  }

  // ---------------------------------------------------------------- noticing what you do
  const tagged = (e, tag) => {
    const tags = new Set(e?.tags || []), n = e?.name || "";
    if (tag === "people") return ["humanoid", "bandit", "forsworn"].some((x) => tags.has(x)) || /bandit|outlaw|forsworn|marauder|thug|raider|necromancer/i.test(n);
    if (tag === "beast") return ["beast", "animal"].some((x) => tags.has(x)) || /wolf|bear|sabre|troll|spider|skeever|mammoth/i.test(n);
    return true;
  };
  const isBoss = (e) => !!e && (e.boss || e.qboss || e.priest || e.legend || (e.crisis && e.noGroup) || (e.tags || []).includes("dragon"));
  /* in a party, does this phone count fights? the leader does; members only when they're off on their own */
  function countsFights(s, p) {
    if (!p || !(p.members || []).some((m) => m.id === s.id) || p.members.length < 2 || p.leader === s.id) return true;
    if (s.dungeon) return !s.dungeon.run;
    return !(s.trip && s.trip.follow === p.leader);
  }
  /* a step is done or a count moved: returns [{i, done, cnt}] (the browser side pushes them to the party) */
  function note(s, kind, info = {}, p = null, t = nowS()) {
    const x = live(s, t); if (!x) return [];
    const i = cur(x); if (i < 0) return [];
    const st = x.o.steps[i], hold = info.hold || null, out = [];
    const bump = (n) => { x.cnt[i] = (x.cnt[i] || 0) + 1; if (x.cnt[i] >= n) x.done[i] = 1; out.push({ i, done: x.done[i], cnt: x.cnt[i] }); };
    const finish = () => { x.done[i] = 1; out.push({ i, done: 1, cnt: x.cnt[i] || 0 }); };
    if (kind === "fight" && info.e) {
      const e = info.e, inHold = hold === st.hold;
      if (st.k === "fights" && inHold && tagged(e, st.tag) && countsFights(s, p)) bump(st.n || 1);
      else if (st.k === "help" && inHold && countsFights(s, p)) bump(st.n || 2);
      else if ((st.k === "boss" || st.k === "deep") && inHold && isBoss(e)) finish();
      else if (st.k === "slay" && st.beast && e.legend === st.beast) finish();
    } else if (kind === "dungeon") {
      if (hold === st.hold && (st.k === "dungeon" || st.k === "boss" || st.k === "deep")) finish();
    }
    return out;
  }
  /* things the other modules keep in your save: checked every few seconds */
  function poll(s, t = nowS()) {
    const x = live(s, t); if (!x) return [];
    const i = cur(x); if (i < 0) return [];
    const st = x.o.steps[i], b = x.base || {}, out = [];
    const finish = () => { x.done[i] = 1; out.push({ i, done: 1, cnt: x.cnt[i] || 0 }); };
    if (st.k === "heist") { const h = s.heist; if ((h?.stats?.runs || 0) > (b.heist || 0) && h?.last?.house === st.house) finish(); }
    else if (st.k === "clue" || st.k === "slay") {
      const lh = s.lhunt || {}, kills = lh.best?.[st.beast]?.kills || 0;
      if (kills > (b.kills?.[st.beast] || 0)) { finish(); if (st.k === "clue" && x.o.steps[i + 1]?.k === "slay") { x.done[i + 1] = 1; out.push({ i: i + 1, done: 1, cnt: 0 }); } }
      else if (st.k === "clue" && lh.cur?.id === st.beast && (lh.cur.clues || 0) > (b.clue?.id === st.beast ? b.clue.n : 0)) finish();
    } else if (st.k === "deep") { if (typeof DEEPDELVE !== "undefined" && s.dungeon && holdAt(WORLD.places[s.dungeon.place] || [0, 0]) === st.hold && DEEPDELVE.depth(s) >= 2) finish(); }
    else if (st.k === "help") {
      let rel = 0; for (const v of Object.values(s.crises?.rel || {})) rel += +v || 0;
      const here = s.location && WORLD.places[s.location] ? holdAt(WORLD.places[s.location]) : null;
      if (rel > (b.rel || 0) + 0.01 && here === st.hold) finish();
      if (x.base) x.base.rel = rel;   // relief elsewhere doesn't count later
    }
    return out;
  }

  // ---------------------------------------------------------------- the road event
  const skillOf = (s, sk) => { try { return typeof G !== "undefined" && G.skill ? G.skill(s, sk) : s.skills?.[sk]?.lvl || 15; } catch { return 15; } };
  const scout = (s) => pfx(s, "exscout") > 0;
  /* your chance with a choice: your skill, plus 10% with Seasoned Scout */
  const chance = (s, sk) => clamp(0.4 + skillOf(s, sk) / 160 + (scout(s) ? 0.1 : 0), 0.15, 0.92);
  /* the event for the expedition: options and how each one will turn out (rolled now, from the expedition's key, so
     Seasoned Scout can show the truth). by: the phone that rolls it (solo, or the leader). */
  function eventOf(s, x) {
    const o = x.o, tp = TPL[o.tpl], v = { town: o.place, hold: T(o.hold), beast: beastName(o.beast) };
    const outs = {}, ch = {};
    for (const [k, , sk] of tp.ev.opts) { const c = chance(s, sk); ch[k] = Math.round(c * 100); outs[k] = rng(hash(`${o.key}|ev|${k}`))() < c ? "good" : "bad"; }
    return { title: T(tp.ev.title), text: T(tp.ev.text, v), opts: tp.ev.opts.map(([k, l, sk]) => [k, T(l), sk]), outs, ch };
  }
  /* carry out the road event's result on this phone (each player gets their own share) */
  function resolveEvent(s, x, key, outs) {
    const lv = s.level || 1, good = outs?.[key] === "good", lines = [];
    const tp = TPL[x.o.tpl], opt = tp.ev.opts.find((q) => q[0] === key);
    if (good) {
      const g = Math.round(15 + 3 * lv); s.gold = (s.gold || 0) + g; lines.push(T("It goes well. You find {g} gold on the way.", { g }));
      const it = ["potion_health", "potion_stamina", "potion_magicka"][hash(x.key + key) % 3];
      if (typeof G !== "undefined" && G.give && D?.ITEMS?.[it]) { G.give(s, it, 1); lines.push(T("You also find: {item}.", { item: itemName(it) })); }
    } else {
      lines.push(T("It goes badly. You take some knocks, but you push on."));
      try { if (typeof G !== "undefined" && G.setHealth) G.setHealth(s, Math.max(1, G.curHealth(s) - 0.12 * G.maxHealth(s))); } catch { /* fine */ }
    }
    if (opt && typeof G !== "undefined" && G.useSkill) { try { G.useSkill(s, opt[2], good ? 25 : 10); } catch { /* fine */ } }
    x.done[0] = 1; x.ev = null; x.evRes = { key, good, t: Math.floor(nowS()) };
    return { good, lines };
  }

  // ---------------------------------------------------------------- rewards, renown, the weekly goal
  function reward(s, o, planLv = 0) {
    const lv = s.level || 1, [a, b] = PAY[o.slot] || PAY.short;
    const gold = Math.round((a + b * lv) * (1 + 0.1 * clamp(planLv, 0, 3)));
    const items = [];
    const h = hash(o.key + "|loot");
    if (o.slot === "short") items.push(["potion_health", 1]);
    else if (o.slot === "medium") items.push([["gem_garnet", "gem_amethyst", "gem_sapphire"][h % 3], 1], ["potion_health", 1]);
    else items.push([["gem_ruby", "gem_emerald", "gem_sapphire"][h % 3], 1], [["mat_steel", "mat_moonstone", "mat_dwarven"][(h >> 3) % 3], 2], ["potion_health", 2]);
    return { gold, items: items.filter(([id]) => typeof D === "undefined" || D.ITEMS?.[id]), renown: RENOWN[o.slot] || 6 };
  }
  /* weekly goal by company size: 26 + 3 a member (30 to 50): two or three evenings out */
  const goalOf = (n) => clamp(26 + 3 * (n || 1), 30, 50);
  function weekRenown(d, wk = weekOf()) {
    let r = 0; for (const e of Object.values(d?.tx || {})) if (e && e.k === "exp" && weekOf(e.t || 0) === wk) r += +e.r || 0;
    return r;
  }
  function weekChest(s, wk) {
    const lv = s.level || 1, h = hash(`${s.id}|${wk}|chest`);
    return { gold: Math.round(250 + 20 * lv), items: [[["mat_steel", "mat_moonstone", "mat_leather"][h % 3], 3], [["gem_amethyst", "gem_sapphire", "gem_ruby"][(h >> 4) % 3], 1]].filter(([id]) => typeof D === "undefined" || D.ITEMS?.[id]) };
  }
  const canChest = (s, d, wk = weekOf()) => !!d && !!s.expPart?.[wk] && (s.expChest || 0) < wk + 1 && weekRenown(d, wk) >= goalOf(Object.values(d.members || {}).filter((m) => m && !m.gone).length);
  function takeChest(s, d, wk = weekOf()) {
    if (!canChest(s, d, wk)) return null;
    const c = weekChest(s, wk);
    s.gold = (s.gold || 0) + c.gold; for (const [id, q] of c.items) if (typeof G !== "undefined" && G.give) G.give(s, id, q);
    s.expChest = wk + 1;
    return c;
  }
  /* rerolls: Expedition Leader gives 1/2 a day. d.exRoll = { day, n, by: { uid: used } } */
  const rollOf = (d, day = dayOf()) => (d?.exRoll?.day === day ? d.exRoll.n || 0 : 0);
  const rollsLeft = (s, d, day = dayOf()) => Math.max(0, Math.round(pfx(s, "exreroll")) - (d?.exRoll?.day === day ? d.exRoll.by?.[s.id] || 0 : 0));
  function rerolled(d, uid, day = dayOf()) {
    const r = d.exRoll?.day === day ? d.exRoll : { day, n: 0, by: {} };
    return { ...d, exRoll: { day, n: (r.n || 0) + 1, by: { ...(r.by || {}), [uid]: (r.by?.[uid] || 0) + 1 } } };
  }
  const planLvOf = (s) => { try { const d = typeof LONGHOUSE !== "undefined" ? LONGHOUSE.mine(s) : null; return d ? LONGHOUSE.derive(d).rooms.plan || 0 : 0; } catch { return 0; } };
  const slotOpen = (slot, planLv) => slot === "short" || planLv >= 1;
  /* finish: your loot (once per expedition), a history line; returns what you got */
  function claim(s, t = nowS()) {
    const x = s.exp; if (!x || x.fin || cur(x) >= 0) return null;
    const pl = planLvOf(s), r = reward(s, x.o, pl);
    s.gold = (s.gold || 0) + r.gold; for (const [id, q] of r.items) if (typeof G !== "undefined" && G.give) G.give(s, id, q);
    x.fin = Math.floor(t); s.expDone = x.key;   // remembered, so the party's copy isn't taken up again
    s.expHist = [{ key: x.key, tpl: x.o.tpl, slot: x.o.slot, hold: x.o.hold, beast: x.o.beast, t: Math.floor(t), gold: r.gold }, ...(s.expHist || []).filter((h) => h.key !== x.key)].slice(0, HIST);
    s.expPart = s.expPart || {}; s.expPart[weekOf(t)] = 1;
    try { if (typeof G !== "undefined" && G.note) G.note(s, T("Expedition done: {title}. {g} gold.", { title: titleOf(x.o), g: r.gold })); } catch { /* fine */ }
    return { ...r, title: titleOf(x.o), o: x.o };
  }
  /* the company's log line for a finished expedition (one per expedition: the whole party shares it) */
  function ledgerEntry(d, o, s, names, t = nowS()) {
    const id = `ex-${o.key}`, old = d.tx?.[id];
    const who = [...new Set([...(old?.who ? String(old.who).split(", ") : []), ...(names || [s.name])])].slice(0, 8).join(", ");
    const e = { k: "exp", by: old?.by || s.id, who, t: old?.t || Math.floor(t), r: RENOWN[o.slot] || 6, tpl: o.tpl, slot: o.slot, hold: o.hold, beast: o.beast || null };
    return { ...d, tx: { ...(d.tx || {}), [id]: e } };
  }
  const histOf = (d) => Object.entries(d?.tx || {}).filter(([, e]) => e && e.k === "exp").map(([id, e]) => ({ id, ...e })).sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, HIST);
  const logLine = (e) => T("{who} came back from {title}", { who: esc(e.who || "?"), title: titleOf({ tpl: e.tpl, hold: e.hold, beast: e.beast }) });

  // ---------------------------------------------------------------- party votes (partyvote.js rules, on the party record)
  const PV = () => (typeof PARTYVOTE !== "undefined" ? PARTYVOTE : null);
  const subRun = (p) => ({ leader: p.leader, members: (p.members || []).map((m) => ({ id: m.id, name: m.name })), pvN: p.exv?.pvN || 0, pvSeq: p.exv?.pvSeq || 0, pv: p.exv?.pv || null });
  /* open a vote on the party record: kind "pick" (which expedition: offers + Not tonight) or "ev" (the road event) */
  function openVote(p, spec, data, t = nowS()) {
    const V = PV(); if (!V || !p) return p;
    const r = V.open(subRun(p), p.leader, spec, t);
    if (!r.pv || r.pv === p.exv?.pv) return p;
    return { ...p, exv: { pvN: r.pvN, pvSeq: r.pvSeq, pv: { ...r.pv, ends: t + VOTE_S }, kind: spec.kind, data } };
  }
  function castVote(p, uid, key, t = nowS(), w = 1) {
    const V = PV(); if (!V || !p?.exv?.pv) return p;
    const r = V.cast(subRun(p), uid, key, t, w);
    return r.pv === p.exv.pv ? p : { ...p, exv: { ...p.exv, pv: r.pv } };
  }
  function settleVote(p, online, t = nowS(), force = false) {
    const V = PV(); if (!V || !p?.exv?.pv) return p;
    const r = V.settle(subRun(p), p.leader, online, t, force);
    return r.pv === p.exv.pv ? p : { ...p, exv: { ...p.exv, pv: r.pv, pvSeq: r.pvSeq } };
  }
  /* the result applied on the party record by the leader: a picked offer becomes the party's expedition */
  function applyPick(p, t = nowS()) {
    const ex = p?.exv, res = ex?.pv?.res; if (!res || ex.kind !== "pick") return p;
    const o = (ex.data?.offers || []).find((q) => q.key === res.key);
    if (!o) return p;   // Not tonight
    if (p.exped?.key === o.key) return p;
    return { ...p, exped: { key: o.key, o, t: Math.floor(t), done: {}, cnt: {}, by: ex.data?.by || null } };
  }
  function pushDone(p, key, ups) {
    if (!p?.exped || p.exped.key !== key) return p;
    const done = { ...(p.exped.done || {}) }, cnt = { ...(p.exped.cnt || {}) };
    for (const u of ups) { if (u.done) done[u.i] = 1; if ((u.cnt || 0) > (cnt[u.i] || 0)) cnt[u.i] = u.cnt; }
    return { ...p, exped: { ...p.exped, done, cnt } };
  }

  // ================================================================ screens
  let api = null, loopT = null, seenRes = 0, lastSheet = "", busy = false, flash = null, tab = "offers";
  const S = () => (api ? api.S() : null);
  const party = () => { try { const p = api?.party?.(); return p && (p.members || []).length >= 2 && p.members.some((m) => m.id === S()?.id) ? p : null; } catch { return null; } };
  const changeParty = (fn) => { const p = party(); return p && typeof Store !== "undefined" ? Store.change("parties", p.id, (x) => (x ? fn(x) || x : x)) : Promise.resolve(null); };
  const onlineIds = (p) => (p.members || []).map((m) => m.id).filter((id) => id === S()?.id || (api?.online ? api.online(id) : true));
  /* painted art (assets.js): the file's URL once it has loaded, else the older picture */
  const pic = (k, fb) => { try { return (typeof ASSETS !== "undefined" && ASSETS.url(k)) || fb; } catch { return fb; } };
  const art = (o) => pic("exp-" + o.tpl, TPL[o.tpl]?.art || "shop-hall.webp");
  /* how dangerous an offer is for you: by its length, one step worse when you're below its level */
  const RISK = [["low", "Low risk"], ["mid", "Some risk"], ["high", "High risk"]];
  const riskOf = (s, o) => RISK[clamp({ short: 0, medium: 1, long: 2 }[o.slot] + ((s?.level || 1) < o.lvl ? 1 : 0), 0, 2)];
  /* the party's vote on this offer: small portraits of who voted for it, or the whole party once it's their pick */
  function votesRow(o) {
    const p = party(); if (!p) return "";
    if (p.exped?.key === o.key) return `<div class="exp-votes on"><span>${T("Your party's pick")}</span><span class="exp-faces">${(p.members || []).map((m) => faceOf(m.id)).join("")}</span></div>`;
    const pv = p.exv?.pv; if (!pv || pv.res || p.exv.kind !== "pick" || !PV()) return "";
    const who = PV().tally(pv)[o.key] || [];
    return who.length ? `<div class="exp-votes"><span>${T("Votes")}</span><span class="exp-faces">${who.map(faceOf).join("")}</span></div>` : "";
  }
  const stepRow = (x, st, i) => {
    const done = x ? x.done[i] : 0, on = x && cur(x) === i, n = st.k === "fights" || st.k === "help" ? st.n || 1 : 0;
    const cnt = x && n && !done ? ` <span class="num">${Math.min(n, x.cnt[i] || 0)}/${n}</span>` : "";
    return `<li class="${done ? "done" : on ? "on" : ""}"><span class="d">${done ? "✓" : i + 1}</span><span>${esc(stepText(st))}${cnt}</span></li>`;
  };
  function offerCard(s, o, d, x, may) {
    const pl = planLvOf(s), open = slotOpen(o.slot, pl), r = reward(s, o, pl), mine = x && x.key === o.key, low = (s.level || 1) < o.lvl;
    const loot = r.items.map(([id, q]) => `${q > 1 ? q + " " : ""}${esc(itemName(id))}`).join(", ");
    const p = party(), btn = mine ? `<span class="exp-tag">${T("You're on it")}</span>`
      : !open ? `<span class="exp-why">${T("Build the planning table to open this one.")}</span>`
      : p ? "" : `<button class="btn pri" data-exp="go" data-k="${esc(o.key)}"${may ? "" : " disabled"}>${T("Set out")}</button>`;
    const [rk, rl] = riskOf(s, o);
    return `<article class="exp-card s-${o.slot}${mine ? " mine" : ""}${open ? "" : " shut"}">
      <div class="exp-art"><img src="${art(o)}" alt="" loading="lazy"></div>
      <div class="exp-body"><h3>${esc(titleOf(o))}</h3>
      <div class="exp-meta"><span class="exp-risk r-${rk}"><i></i>${T(rl)}</span><span class="exp-dur">${T(SLOT_NAME[o.slot])} · ${T(SLOT_TIME[o.slot])}</span></div>
      <p class="exp-loot"><b class="gold">${r.gold} ${T("gold")}</b>, ${loot} · <span>${T("+{n} renown", { n: r.renown })}</span></p>
      <p class="exp-where">${esc(o.place)} · ${esc(T(o.hold))}${low ? ` · <span class="lng-short">${T("best from level {n}", { n: o.lvl })}</span>` : ""}</p>
      <details class="exp-more"${mine ? " open" : ""}><summary>${T("Details")}</summary><p class="exp-blurb">${esc(blurbOf(o))}</p><ol class="exp-steps">${o.steps.map((st, i) => stepRow(mine ? x : null, st, i)).join("")}</ol></details>
      ${votesRow(o)}${btn}</div></article>`;
  }
  function trackerHTML(s) {
    const x = live(s); if (!x) return "";
    const i = cur(x), st = x.o.steps[i], here = st && st.k === "road" && s.location === st.place && !s.trip?.status && !s.dungeon;
    const p = party(), lead = !p || p.leader === s.id;
    return `<div class="exp-track"><div class="exp-th"><b>${esc(titleOf(x.o))}</b><span>${T(SLOT_NAME[x.o.slot])} · ${esc(T(x.o.hold))}</span></div>
      <ol class="exp-steps">${x.o.steps.map((q, k) => stepRow(x, q, k)).join("")}</ol>
      <div class="exp-tb">${here && lead ? `<button class="btn pri" data-exp="look">${T("Look around")}</button>` : ""}${here && !lead ? `<span class="sub">${T("Your leader looks around; you'll vote on what to do.")}</span>` : ""}
      <button class="btn sm" data-exp="drop">${T("Give it up")}</button></div><p class="sub">${T("Giving up costs nothing.")}</p></div>`;
  }
  function weekHTML(s, d) {
    const wk = weekOf(), r = weekRenown(d, wk), n = Object.values(d.members || {}).filter((m) => m && !m.gone).length, g = goalOf(n);
    const can = canChest(s, d, wk), took = (s.expChest || 0) >= wk + 1;
    return `<div class="exp-week"><div class="exp-wh"><b>${T("This week's goal")}</b><span class="num">${Math.min(r, g)}/${g} ${T("renown")}</span></div>
      <div class="bar"><i style="width:${Math.round(100 * Math.min(1, r / g))}%"></i></div>
      <p class="sub">${took ? T("You took this week's chest.") : can ? T("Goal reached! Everyone who went on an expedition this week takes the company chest once.") : r >= g ? T("Goal reached. Go on one expedition this week to share the chest.") : T("Every finished expedition adds renown. Reach the goal and everyone who went out this week takes the company chest.")}</p>
      ${can ? `<button class="btn pri" data-exp="chest">${T("Open the chest")}</button>` : ""}</div>`;
  }
  function histHTML(s, d) {
    const h = d ? histOf(d) : (s.expHist || []).map((e) => ({ ...e, who: s.name }));
    if (!h.length) return `<p class="sub">${T("No expeditions yet. The first one goes in the book.")}</p>`;
    const when = (t) => { const a = Math.max(0, nowS() - t); return a < 3600 ? T("{n} min ago", { n: Math.max(1, Math.round(a / 60)) }) : a < DAY ? T("{n} h ago", { n: Math.round(a / 3600) }) : T("{n} days ago", { n: Math.round(a / DAY) }); };
    return `<div class="exp-hist">${h.map((e) => `<div class="exp-he"><div><b>${esc(titleOf(e))}</b><span>${esc(e.who || "")} · ${T(SLOT_NAME[e.slot] || "Short")} · ${esc(T(e.hold || ""))}</span></div><i>${when(e.t || 0)}</i></div>`).join("")}</div>`;
  }
  /* the Expeditions tab of the Company screen (longhouse.js) */
  function panelHTML(s, d) {
    if (!s) return "";
    if (!d) return trackerHTML(s);
    const day = dayOf(), list = offers(d.id, day, rollOf(d, day)), x = live(s), p = party();
    const left = rollsLeft(s, d, day), pv = p?.exv?.pv, voting = pv && !pv.res;
    const h = Math.floor((DAY - (nowS() % DAY)) / 3600), m = Math.floor(((DAY - (nowS() % DAY)) % 3600) / 60);
    const tbl = pic("expedition-table", "");
    const bg = tbl ? `<div class="exp-bg" aria-hidden="true"><img src="${tbl}" alt=""><i class="exp-candle c1"></i><i class="exp-candle c2"></i></div>` : "";
    const head = `<div class="exp-head${tbl ? " on-table" : ""}">${tbl ? "" : `<img src="ui-parchment.webp" alt="" loading="lazy">`}<div class="exp-ht"><div class="exp-title">${T("The Expedition Table")}</div>
      <div class="sub">${T("Three expeditions a day for the company. New ones in {h} h {m} min. Missing a day costs nothing.", { h, m })}</div></div></div>`;
    const tabs = `<div class="seg exp-seg">${[["offers", T("Tonight")], ["hist", T("History")]].map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-exp="tab" data-k="${k}">${l}</button>`).join("")}</div>`;
    if (tab === "hist") return `<div class="exp-root${tbl ? " exp-ontbl" : ""}">${bg}${head}${tabs}${weekHTML(s, d)}<h3>${T("Expedition history")}</h3>${histHTML(s, d)}</div>`;
    const partyBar = p ? `<div class="exp-pbar">${voting ? `<span>${T("Your party is voting on tonight's expedition.")}</span>` : `<span>${T("In a party, the party votes. Most votes win; a tie goes the leader's way.")}</span><button class="btn pri" data-exp="vote">${T("Put it to the party")}</button>`}</div>` : "";
    const roll = left ? `<button class="btn sm" data-exp="roll">${T("Ask for fresh offers ({n} left today)", { n: left })}</button>` : "";
    return `<div class="exp-root${tbl ? " exp-ontbl" : ""}">${bg}${head}${tabs}${trackerHTML(s)}${partyBar}<div class="exp-offers">${list.map((o) => offerCard(s, o, d, x, !p)).join("")}</div>
      <div class="exp-foot">${roll}</div>${weekHTML(s, d)}</div>`;
  }

  /* ---- the floating sheet: party votes, the road event, the finish */
  function faceOf(uid) {
    const p = party(), nm = p?.members?.find((m) => m.id === uid)?.name || "?";
    let h = ""; try { const c = uid === S()?.id ? S() : api?.cardOf?.(uid); h = c && typeof HEROART !== "undefined" ? HEROART.portrait(c, 26) : ""; } catch { h = ""; }
    return `<span class="pvchip" title="${esc(nm)}">${h || `<b>${esc(nm.slice(0, 1).toUpperCase())}</b>`}</span>`;
  }
  function voteSheet(s, p) {
    const ex = p.exv, pv = ex.pv, V = PV(); if (!V) return "";
    const tl = V.tally(pv), mine = pv.votes?.[s.id], lead = p.leader === s.id, n = V.voted(pv), lf = V.left(pv);
    const outs = ex.kind === "ev" && scout(s) ? ex.data?.outs || {} : null;
    const opts = pv.opts.map(([k, l]) => `<button class="btn pvopt${mine === k ? " pvmine" : ""}${(tl[k] || []).length ? " pvhas" : ""}" data-exp="pv" data-k="${esc(k)}"><span class="pvlab">${esc(l)}${outs && outs[k] ? ` <small class="exp-scout ${outs[k]}">${outs[k] === "good" ? T("goes well") : T("goes badly")}</small>` : ""}</span><span class="pvchips">${(tl[k] || []).map(faceOf).join("")}</span></button>`).join("");
    const sub = ex.kind === "ev" ? `<p class="exp-say">${esc(ex.data?.text || "")}</p>` : `<p class="sub">${T("Pick tonight's expedition. Most votes win; a tie goes the leader's way.")}</p>`;
    return `<div class="exp-sheet" role="dialog" aria-label="${esc(pv.title)}"><div class="pvote"><div class="pvhd"><span class="pvring" aria-label="${lf} s"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" stroke-dasharray="94.2" stroke-dashoffset="${(94.2 * (1 - clamp(lf / VOTE_S, 0, 1))).toFixed(1)}"/></svg><b class="num">${lf}</b></span><div class="pvtt"><h3>${esc(pv.title)}</h3><p class="sub pvcount"><span>${T("Party vote")}</span> · <span class="num">${n}/${pv.who.length}</span></p></div></div>
      ${sub}<div class="pvopts">${opts}</div>${outs ? `<p class="sub">${T("Seasoned Scout: you can tell how each choice will go.")}</p>` : ""}
      ${lead ? `<button class="btn sm pvnow" data-exp="pvnow"${n ? "" : " disabled"}>${T("Decide now")}</button>` : ""}</div></div>`;
  }
  function eventSheet(s, x) {
    const ev = x.ev, sc = scout(s);
    return `<div class="exp-sheet" role="dialog" aria-label="${esc(ev.title)}"><div class="exp-ev"><div class="exp-evart"><img src="${art(x.o)}" alt=""><b>${esc(ev.title)}</b></div>
      <p class="exp-say">${esc(ev.text)}</p><div class="exp-evo">${ev.opts.map(([k, l, sk]) => `<button class="btn" data-exp="evo" data-k="${esc(k)}"><span>${esc(l)}</span><small>${esc(T(sk))} · ${ev.ch?.[k] ?? "?"}%${sc ? ` · <i class="exp-scout ${ev.outs[k]}">${ev.outs[k] === "good" ? T("goes well") : T("goes badly")}</i>` : ""}</small></button>`).join("")}</div>
      ${sc ? `<p class="sub">${T("Seasoned Scout: you can tell how each choice will go.")}</p>` : ""}</div></div>`;
  }
  function flashSheet(f) {
    return `<div class="exp-sheet" role="dialog" aria-label="${esc(f.title)}"><div class="exp-done"><h3>${esc(f.title)}</h3>${f.lines.map((l) => `<p>${esc(l)}</p>`).join("")}<button class="btn pri" data-exp="ok">${T("Continue")}</button></div></div>`;
  }
  function sheet() {
    if (typeof document === "undefined" || !document.body) return;
    const s = S(); if (!s) return;
    const p = party(), x = live(s);
    let html = "";
    if (flash) html = flashSheet(flash);
    else if (p?.exv?.pv && !p.exv.pv.res && p.exv.pv.who.includes(s.id)) html = voteSheet(s, p);
    else if (x?.ev && !p) html = eventSheet(s, x);
    if (html === lastSheet) return;
    lastSheet = html;
    let el = document.getElementById("exp-layer");
    if (!html) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "exp-layer"; document.body.appendChild(el); }
    el.innerHTML = html;
  }

  /* ---- the loop: party sync, polls, votes, the finish */
  async function finishIfDone(s) {
    const x = s.exp; if (!x || x.fin || cur(x) >= 0) return;
    const p = party(), r = claim(s); if (!r) return;
    const d = typeof LONGHOUSE !== "undefined" ? LONGHOUSE.mine(s) : null;
    const names = p ? p.members.map((m) => m.name) : [s.name];
    if (d && typeof Store !== "undefined") { try { await Store.change("longhouse", d.id, (cur0) => (cur0 ? ledgerEntry(cur0, r.o, s, names) : cur0)); } catch { /* the loot is yours anyway */ } }
    flash = { title: T("Expedition done: {title}", { title: r.title }), lines: [T("You get {g} gold and {items}.", { g: r.gold, items: r.items.map(([id, q]) => `${q > 1 ? q + " " : ""}${itemName(id)}`).join(", ") }), d ? T("+{n} renown for the company.", { n: r.renown }) : T("Join a company to earn renown toward its weekly chest.")] };
    try { if (typeof SOUND !== "undefined") SOUND.fx("quest"); } catch { /* fine */ }
    api.persist(true); api.render?.();
  }
  async function push(ups) {
    const s = S(), p = party(), x = s?.exp;
    if (!ups.length || !x) return;
    const st = x.o.steps[ups[ups.length - 1].i];
    api.toast(ups.some((u) => u.done) ? T("Expedition: step done. {next}", { next: cur(x) >= 0 ? stepText(x.o.steps[cur(x)]) : T("All done!") }) : T("Expedition: {step} ({n}/{m})", { step: stepText(st), n: x.cnt[ups[0].i], m: st.n || 1 }));
    if (p && p.exped?.key === x.key) await changeParty((q) => pushDone(q, x.key, ups));
    api.persist(true);
  }
  async function tick() {
    const s = S(); if (!s || busy) return;
    busy = true;
    try {
      const p = party(), t = nowS();
      // the party's expedition: adopt it, merge its progress
      if (p?.exped && (!s.exp || s.exp.key !== p.exped.key) && t - (p.exped.t || 0) < LAST && (s.expDone || "") !== p.exped.key) { adopt(s, p.exped.o, p.exped.t, p.exped.by); api.toast(T("Your party sets out: {title}", { title: titleOf(p.exped.o) })); api.persist(true); }
      if (p?.exped && s.exp && mergeDone(s.exp, p.exped)) api.persist(false);
      const ups = poll(s, t); if (ups.length) await push(ups);
      // votes: the leader settles; everyone applies a result once
      const ex = p?.exv, pv = ex?.pv, V = PV();
      if (V && pv && !pv.res && p.leader === s.id && V.due(pv, onlineIds(p), t)) {
        await changeParty((q) => { let n = settleVote(q, onlineIds(q), nowS()); if (n.exv?.kind === "pick") n = applyPick(n); return n; });
      }
      if (V && pv?.res && pv.res.seq > seenRes) {
        seenRes = pv.res.seq;
        if (t - (pv.res.t || 0) < 90) {
          if (ex.kind === "pick") api.toast(pv.res.key === "skip" ? T("The party chose: not tonight.") : T("The party chose: {label} ({n} of {m} votes).", { label: pv.res.label, n: pv.res.votes, m: pv.res.of }));
          if (ex.kind === "ev" && s.exp && s.exp.key === ex.data?.key && !s.exp.done[0]) {
            const r = resolveEvent(s, s.exp, pv.res.key, ex.data.outs);
            flash = { title: T("The party chose: {label}", { label: pv.res.label }), lines: r.lines };
            if (p.leader === s.id) await changeParty((q) => pushDone(q, s.exp.key, [{ i: 0, done: 1 }]));
            api.persist(true);
          }
        }
      }
      await finishIfDone(s);
    } catch (e) { console.warn("expedition", e); }
    finally { busy = false; }
    sheet();
  }
  /* ui.js tells us what happened (arrive, fight, dungeon) */
  function hook(kind, info = {}) {
    const s = S(); if (!s) return;
    const x = live(s); if (!x) return;
    const p = party();
    if (kind === "arrive") { const st = x.o.steps[cur(x)]; if (st?.k === "road" && info.place === st.place) setTimeout(() => look(), 900); return; }
    const ups = note(s, kind, info, p);
    if (ups.length) push(ups).then(() => finishIfDone(s)).then(sheet);
  }
  /* the road event starts (solo: on this phone; party: the leader opens the vote) */
  async function look() {
    const s = S(), x = live(s); if (!x) return;
    const st = x.o.steps[cur(x)]; if (!st || st.k !== "road" || s.location !== st.place) return;
    const p = party();
    if (!p) { if (!x.ev) { x.ev = eventOf(s, x); api.persist(false); } sheet(); return; }
    if (p.leader !== s.id) return;
    if (p.exv?.pv && !p.exv.pv.res && p.exv.kind === "ev" && p.exv.data?.key === x.key) return;
    const ev = eventOf(s, x);
    await changeParty((q) => openVote(q, { did: `ev|${x.key}`, kind: "ev", title: ev.title, opts: ev.opts.map(([k, l]) => [k, l, ""]) }, { key: x.key, text: ev.text, outs: ev.outs }));
    sheet();
  }
  async function onClick(evt) {
    const b = evt.target.closest?.("[data-exp]"); if (!b || b.disabled) return;
    const s = S(); if (!s) return;
    const a = b.dataset.exp, k = b.dataset.k, d = typeof LONGHOUSE !== "undefined" ? LONGHOUSE.mine(s) : null, p = party();
    evt.preventDefault?.(); evt.stopPropagation?.();
    if (a === "tab") { tab = k; api.render?.(); return; }
    if (a === "ok") { flash = null; sheet(); return; }
    if (a === "go" && d) {
      const o = offers(d.id, dayOf(), rollOf(d)).find((q) => q.key === k); if (!o) return;
      if (!slotOpen(o.slot, planLvOf(s))) return api.toast(T("Build the planning table to open this one."));
      if ((s.expDone || "") === o.key) return api.toast(T("You've done this one already."));
      adopt(s, o); api.toast(T("You set out: {title}", { title: titleOf(o) })); api.persist(true); api.render?.(); hook("arrive", { place: s.location }); return;
    }
    if (a === "drop") { const was = s.exp?.key; drop(s); if (p?.exped?.key === was && p.leader === s.id) await changeParty((q) => ({ ...q, exped: null })); api.toast(T("You give up the expedition. No harm done.")); api.persist(true); api.render?.(); sheet(); return; }
    if (a === "look") { look(); return; }
    if (a === "evo") { const x = live(s); if (!x?.ev) return; const r = resolveEvent(s, x, k, x.ev.outs); flash = { title: x.o && T(TPL[x.o.tpl].ev.title), lines: r.lines }; api.persist(true); lastSheet = ""; sheet(); await finishIfDone(s); api.render?.(); return; }
    if (a === "vote" && d && p) {
      const pl = planLvOf(s), list = offers(d.id, dayOf(), rollOf(d)).filter((o) => slotOpen(o.slot, pl) && (s.expDone || "") !== o.key);
      if (!list.length) return api.toast(T("Build the planning table to open this one."));
      const opts = [...list.map((o) => [o.key, `${titleOf(o)} (${T(SLOT_NAME[o.slot])})`, ""]), ["skip", T("Not tonight"), ""]];
      await changeParty((q) => openVote(q, { did: `pick|${d.id}|${dayOf()}|${rollOf(d)}|${Math.floor(nowS())}`, kind: "pick", title: T("Tonight's expedition"), opts }, { offers: list, by: d.name }));
      api.toast(T("Put to the party. Everyone votes.")); api.render?.(); lastSheet = ""; sheet(); return;
    }
    if (a === "pv" && p) { await changeParty((q) => castVote(q, s.id, k, nowS(), PV()?.weightOf?.(s) || 1)); lastSheet = ""; sheet(); return; }
    if (a === "pvnow" && p && p.leader === s.id) { await changeParty((q) => { let n = settleVote(q, onlineIds(q), nowS(), true); if (n.exv?.kind === "pick") n = applyPick(n); return n; }); tick(); return; }
    if (a === "roll" && d) {
      if (!rollsLeft(s, d)) return;
      await Store.change("longhouse", d.id, (q) => (q ? rerolled(q, s.id) : q));
      api.toast(T("The table is cleared and new letters come in.")); api.render?.(); return;
    }
    if (a === "chest" && d) { const c = takeChest(s, d); if (c) { flash = { title: T("The company chest"), lines: [T("You get {g} gold and {items}.", { g: c.gold, items: c.items.map(([id, q]) => `${q > 1 ? q + " " : ""}${itemName(id)}`).join(", ") })] }; api.persist(true); api.render?.(); sheet(); } }
  }
  function mount(a) {
    api = a;
    if (typeof document !== "undefined" && !mount.bound) { document.addEventListener("click", onClick, true); mount.bound = true; }
    clearInterval(loopT); loopT = setInterval(tick, 1000);
  }
  if (typeof I18N !== "undefined" && I18N.add && typeof I18N_EXPEDITION !== "undefined") I18N.add(I18N_EXPEDITION.tpl, I18N_EXPEDITION.words);

  return { DAY, WEEK, LAST, VOTE_S, SLOTS, RENOWN, PAY, TPL, TPL_IDS, HOLDS, towns, offers, titleOf, stepText, snapshot, adopt, live, cur, drop, mergeDone,
    note, poll, countsFights, isBoss, tagged, chance, eventOf, resolveEvent, reward, goalOf, weekRenown, weekChest, canChest, takeChest, rollOf, rollsLeft, rerolled,
    slotOpen, claim, ledgerEntry, histOf, logLine, openVote, castVote, settleVote, applyPick, pushDone, panelHTML, trackerHTML, mount, hook, tick, look,
    dayOf, weekOf, _tab: (t) => { tab = t; }, _flash: (f) => { flash = f; lastSheet = ""; sheet(); } };
})();
if (typeof module !== "undefined") module.exports = EXPEDITION;
