/* The world remembers you. [OURS] Builds on rumours.js (your name in the holds, day and night, knocking).
   - Deeds: what you actually do is remembered in the hold where you did it: dragons slain, caravans you guarded
     all the way, caravans you robbed, crimes (every new bounty), sights from the inn whispers you saw through,
     amends you made. Good deeds stay; bad ones fade over two weeks of game time. They feed RUMOURS.standing.
   - Towns react: guards and shopkeepers bring up what you did, shops charge you more when you're scorned, the
     shutters close (no knocking at night, no whispers) when you're trouble, and doors open as your name grows:
     the back room at the inn, the steward's storeroom, a guest room in the Jarl's hall. Make amends at the temple.
   - Townsfolk keep hours: the shopkeepers, the smith, the innkeeper, the court wizard and the bard each have a day.
     In the evening some of them are in the inn, and you can ask a shopkeeper you find there to open up for you
     without the night charge.
   - Whispers of things to come: in an inn you hear about something that hasn't happened yet ("a dragon's been seen
     circling over..."). Most come true half a day later and become a real place on the map with a fight or a find
     and a Jarl's bounty; some come to nothing.
   - News of the realm: a feed of what happened (yours, the whispers that came true, and the talk of each day).
   - Party play: in a party the leader's world is everyone's: members see the leader's whispers, events and news
     (from the leader's published card) and leave the asking and the deciding to the leader.
   Perks (perkfx.js): Town Crier (Speechcraft), Low Profile (Sneak), Well Met (Etiquette).
   Everything is per player (s.lw) and optional: with this file missing the game plays as before. */
const LIVING = (() => {
  const DOM = typeof document !== "undefined";
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const now = () => G.now();
  const GS = () => G.GAME_SPEED || 12;
  const gameH = (h) => (h * 3600) / GS();
  const pfx = (s, k) => (typeof PFX !== "undefined" ? PFX.num(s, k) : 0);
  const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
  const hash = (t) => { let h = 0; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  const place = (n) => (typeof WORLD !== "undefined" ? WORLD.places[n] : null);
  const holdOf = (n) => { const p = place(n); return p ? G.holdAt(p) : ""; };
  const holdHere = (s) => (s.location && place(s.location) ? holdOf(s.location) : G.holdAt([s.x, s.y]));
  const isTown = (n) => ["city", "town"].includes(place(n)?.[2]);
  const hour = (t = now()) => G.clock(t).hour;
  const dayNo = (t = now()) => Math.floor((t * GS()) / 86400);
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const fmtLeft = (sec) => ((typeof RUMOURS !== "undefined") ? RUMOURS.fmtLeft(sec) : `${Math.ceil(sec * GS() / 3600)} h`);

  const FADE_DAYS = 14;        // bad deeds fade to a quarter over this many game days
  const MAX_WHISPERS = 2;      // whispers you can be waiting on at once
  const WHISPER_WAIT_H = 12;   // per inn
  const LIVE_H = 48;           // a whisper that came true stays this long
  const SHUT = -10, SCORN = -25;   // shutters close; shops charge more
  const SCORN_MARKUP = 0.15;

  function st(s) {
    s.lw = s.lw || {};
    const w = s.lw;
    w.deeds = w.deeds || []; w.news = w.news || []; w.wh = w.wh || []; w.next = w.next || {}; w.daily = w.daily || {};
    w.heard = w.heard || 0; w.came = w.came || 0;
    return w;
  }

  // ====================================================================== deeds
  const DEED = {
    dragon: { icon: "", pts: 5, say: "slew a dragon" },
    guard: { icon: "", pts: 4, say: "guarded a caravan all the way" },
    rob: { icon: "", pts: -15, say: "robbed a caravan" },
    crime: { icon: "", pts: -5, say: "broke the law" },
    event: { icon: "", pts: 6, say: "saw a whisper through" },
    amends: { icon: "", pts: 0, say: "made amends" },
  };
  function news(s, icon, text, hold = "", t = now()) {
    const w = st(s);
    w.news.unshift({ t, i: icon, x: text, h: hold });
    w.news = w.news.slice(0, 30);
  }
  /* remember a deed: kind from DEED, pts overrides the default (crimes scale with the bounty) */
  function deed(s, kind, hold, pts = DEED[kind]?.pts || 0, text = "", t = now()) {
    if (!hold || !DEED[kind]) return null;
    const w = st(s), d = { t, k: kind, h: hold, p: Math.round(pts * 10) / 10 };
    w.deeds.unshift(d); w.deeds = w.deeds.slice(0, 80);
    if (text) news(s, DEED[kind].icon, text, hold, t);
    return d;
  }
  /* what a deed is worth now: bad ones fade (Low Profile: they hurt less and fade twice as fast) */
  function worth(s, d, t = now()) {
    if (d.p >= 0) return d.p;
    const age = Math.max(0, (t - d.t) * GS() / 86400), span = FADE_DAYS / (1 + pfx(s, "forget"));
    const fade = Math.max(0.25, 1 - 0.75 * age / span);
    return d.p * fade * (1 - Math.min(0.6, pfx(s, "infamy")));
  }
  /* points this module adds to RUMOURS.standing for a hold */
  function points(s, hold, t = now()) {
    if (!s?.lw) return 0;
    return Math.round(st(s).deeds.filter((d) => d.h === hold).reduce((a, d) => a + worth(s, d, t), 0) * 10) / 10;
  }
  /* short words for the standing list: "guarded 2 caravans", "robbed a caravan" */
  function deedWords(s, hold) {
    if (!s?.lw) return [];
    const n = {}; for (const d of st(s).deeds) if (d.h === hold) n[d.k] = (n[d.k] || 0) + 1;
    const out = [];
    if (n.guard) out.push(`guarded ${n.guard > 1 ? n.guard + " caravans" : "a caravan"}`);
    if (n.event) out.push(`${n.event} whisper${n.event > 1 ? "s" : ""} seen through`);
    if (n.dragon) out.push(`${n.dragon} dragon${n.dragon > 1 ? "s" : ""} slain here`);
    if (n.rob) out.push(`robbed ${n.rob > 1 ? n.rob + " caravans" : "a caravan"}`);
    if (n.crime) out.push(`${n.crime} crime${n.crime > 1 ? "s" : ""} remembered`);
    if (n.amends) out.push("made amends");
    return out;
  }
  /* what guards and shopkeepers say about your recent deeds here (RUMOURS.deedLines adds these) */
  function lines(s, hold, t = now()) {
    if (!s?.lw) return [];
    const out = [], recent = st(s).deeds.filter((d) => d.h === hold && t - d.t < gameH(24 * 10));
    const k = new Set(recent.map((d) => d.k));
    if (k.has("rob")) out.push("The caravan masters say a thief like you hit their wagons. I've got my eye on you.", "Robbing honest traders on the Jarl's roads? Not in my hold.");
    if (k.has("guard")) out.push("You brought the wagons in safe. The traders were singing your praises.", "Good work on the caravan road. Bandits are thinking twice now.");
    if (k.has("dragon")) out.push("I saw the smoke from the wall. You really brought that dragon down?");
    if (k.has("event")) out.push("So the talk in the inn was true after all. And you dealt with it. Well done.");
    if (k.has("crime")) out.push("Keep your hands where I can see them. We remember what you did.");
    if (k.has("amends")) out.push("The priests say you've made your peace with this hold. Let's keep it that way.");
    const pts = (typeof RUMOURS !== "undefined") ? RUMOURS.standing(s, hold).pts : 0;
    if (pts <= SCORN) out.push("Folk here cross the street when they see you coming.");
    return out;
  }

  // ====================================================================== watching what you do (called from the ui tick)
  function snapOf(s) {
    const q = s.quests || {};
    return { dr: s.dragons || 0, b: { ...(s.bounty || {}) }, rob: Object.keys(s.cvRoad?.robbed || {}), job: s.caravanJob ? { id: s.caravanJob.id, to: s.caravanJob.to, name: s.caravanJob.name } : null,
      q: Object.keys(q).filter((id) => q[id]?.done), cl: Object.keys(s.cleared || {}) };
  }
  let lastTick = 0;
  /* compare with the last look: new deeds, whispers that come true. Returns a line to show, or "" */
  function watch(s, t = now()) {
    const w = st(s), was = w.snap, cur = snapOf(s), msgs = [];
    w.snap = cur;
    if (!was) return "";
    const hold = holdHere(s);
    for (let i = was.dr; i < cur.dr; i++) { deed(s, "dragon", hold, DEED.dragon.pts, `${s.name} slew a dragon in ${hold}. The skalds are already arguing over the song.`, t); }
    for (const [h, v] of Object.entries(cur.b)) {
      const d = v - (was.b[h] || 0);
      if (d > 0) deed(s, "crime", h, -Math.max(2, Math.min(40, Math.round(d / 10))), `The guards of ${h} are looking for ${s.name}: ${v} gold on their head.`, t);
    }
    for (const id of cur.rob) if (!was.rob.includes(id)) deed(s, "rob", hold, DEED.rob.pts, `A caravan was robbed on the road in ${hold}. The wagon masters name ${s.name}.`, t);
    if (was.job && !cur.job && s.location === was.job.to) {
      const h = holdOf(was.job.to); deed(s, "guard", h, DEED.guard.pts, `${was.job.name} rolled safely into ${was.job.to}, guarded by ${s.name}.`, t);
      msgs.push(`Word gets around ${h}: you brought the caravan in safe.`);
    }
    for (const id of cur.q) if (!was.q.includes(id)) { const L = (typeof QUESTS !== "undefined") ? QUESTS.L?.[id] : null; if (L) news(s, "", `${s.name} finished ${L.name}. The tale is told in every inn.`, L.start ? holdOf(L.start) : "", t); }
    for (const n of cur.cl) if (!was.cl.includes(n) && place(n)) news(s, "", `${n} has been cleared out by ${s.name}.`, holdOf(n), t);
    return msgs.join(" ");
  }
  /* the ui calls this every second: deeds, whispers, the party leader's world */
  function tick(s, t = now()) {
    if (!s) return "";
    if (t - lastTick < 3 && t >= lastTick) return "";
    lastTick = t;
    let out = "";
    try { out = watch(s, t); } catch { /* never break the game */ }
    try { const m = advance(s, t); if (m) out = (out ? out + " " : "") + m; } catch { /* never break the game */ }
    try { if (DOM && window.__dbg) follow(s, window.__dbg.party?.(), window.__dbg.others?.() || []); } catch { /* optional */ }
    return out;
  }

  // ====================================================================== whispers of things to come
  const WH = {
    dragon: { icon: "", title: "A dragon's roost", where: ["lair"], tpl: "Dragon", hours: [8, 14], pts: 8, gold: 160,
      say: ["Shepherds saw a dragon circling over {p}. Round and round, like it's looking for somewhere to land.", "There's scorch marks on the rocks near {p}, and something big has been taking goats.", "My cousin swears the mountain near {p} roared at him last night."],
      came: "The whispers were true: a dragon has made its roost at {p}.", none: "The dragon over {p} flew on north. Nobody's seen it since.",
      win: "The dragon at {p} crashes down for the last time. The Jarl's steward sends {g} gold, with thanks." },
    warband: { icon: "", title: "A warband gathers", where: ["camp", "fort"], tpl: "Forsworn ambush", hours: [6, 12], pts: 6, gold: 110,
      say: ["Hunters saw campfires near {p}. Lots of them. Somebody's gathering a warband.", "Weapons have been going missing from the forge. Folk say they end up at {p}.", "Forsworn, or bandits, nobody's sure. But they're massing near {p}."],
      came: "Campfires burn at {p}: the warband everyone whispered about is real.", none: "The fires near {p} turned out to be charcoal burners. Just tavern talk.",
      win: "The warband at {p} scatters to the winds. The Jarl pays {g} gold for the heads of its leaders." },
    troll: { icon: "", title: "A troll comes down", where: ["landmark", "farm", "camp"], tpl: "Frost troll", hours: [6, 12], pts: 5, gold: 90,
      say: ["The snows came early up high. A troll will be down by {p} before long, mark my words.", "Something's been knocking over fences near {p}. Big hand prints.", "Old Hilde says the trolls always come down past {p} when the weather turns."],
      came: "A troll has come down from the heights and is prowling near {p}.", none: "No troll came down by {p}. The fences were knocked over by a very drunk farmhand.",
      win: "The troll near {p} won't be bothering anyone again. The farmers put together {g} gold." },
    vampire: { icon: "", title: "A nest in the dark", where: ["dungeon"], match: /cave|crypt|barrow|ruin|tomb|grotto|hall|den|hollow/i, tpl: "Vampire", hours: [10, 16], pts: 7, gold: 140,
      say: ["Two people gone from their beds this month. Both last seen walking toward {p}, at night.", "Pale folk have been buying candles and nothing else. They came from the direction of {p}.", "Don't go near {p} after dark. Nobody who has came back the same."],
      came: "Vampires have made a nest at {p}. The whispers were true.", none: "The disappearances near {p} stopped. A pair of runaway lovers sent a letter from Cyrodiil.",
      win: "Sunlight floods the nest at {p}. The Jarl's court wizard sends {g} gold and a nervous letter of thanks." },
    stranded: { icon: "", title: "A stranded merchant", where: ["landmark", "farm", "fort", "camp"], hours: [4, 10], pts: 4, gold: 70, fight: false,
      say: ["A merchant from Cyrodiil is due through {p}. That road eats wagon wheels.", "Mark me, the spice wagon will lose a wheel by {p} again, same as every year.", "Some fool's taking a full wagon past {p} with no guards. Won't end well."],
      came: "A merchant's wagon has broken down near {p}, goods and all.", none: "The wagon got past {p} without a scratch. Lucky fool.",
      win: "You help the merchant near {p} get the wheel back on. He pays {g} gold and pushes some goods into your arms: {loot}." },
    shrine: { icon: "", title: "A forgotten shrine", where: ["landmark", "dungeon"], hours: [6, 14], pts: 3, gold: 40, fight: false,
      say: ["A shepherd found old stones near {p}. Carvings, he says, and a warm light at dusk.", "The priests are excited about something near {p}. A shrine nobody remembered.", "There's a holy place near {p}, buried under the snow for a hundred years. The thaw's uncovering it."],
      came: "An old shrine has come out of the snow near {p}. Pilgrims are already on their way.", none: "The stones near {p} were just stones. The priests are very disappointed.",
      win: "You kneel at the old shrine near {p}. A warmth fills you: healed and well rested. Pilgrims leave {g} gold at your feet for finding it." },
  };
  const TRUE_BASE = 0.7;
  const trueChance = (s, h = hour()) => Math.min(0.95, TRUE_BASE + (h >= 17 || h < 1 ? 0.1 : 0) + Math.min(0.2, pfx(s, "whisper")));
  const FAMOUS = /High Hrothgar|Throat of the World|Sky Haven|College|Palace|Hall of|Temple of|Dragonsreach|Thalmor Embassy|Sovngarde/i;   // nobody whispers about these
  const fill = (txt, x) => txt.replace(/\{p\}/g, x.place).replace(/\{g\}/g, x.g ?? "").replace(/\{loot\}/g, x.loot || "");
  /* a whisper you hear: kind, a place near the town (not one you have a lead for already) */
  function whisperSpots(s, town, kind) {
    const here = place(town), K = WH[kind], taken = new Set([...st(s).wh.map((x) => x.place), ...(s.rw?.list || []).map((x) => x.place)]);
    const ok = ([n, p]) => K.where.includes(p[2]) && !taken.has(n) && !FAMOUS.test(n) && (!K.match || K.match.test(n)) && WORLD.same(here, p) && !(WORLD.hidden?.has(n) && !s.discovered.includes(n));
    return Object.entries(WORLD.places).filter(ok).map(([n, p]) => ({ n, d: G.pxDist(here, p) })).filter((x) => x.d > 25 && x.d < 260).sort((a, b) => a.d - b.d).slice(0, 8);
  }
  const waiting = (s, t = now()) => st(s).wh.filter((x) => x.st === "w" || (x.st === "live" && x.until > t));
  const whisperPrice = (s, town) => (doorOpen(s, holdOf(town), "backroom") ? 0 : Math.max(5, Math.round(((typeof RUMOURS !== "undefined") && (typeof TOWNS !== "undefined") && TOWNS.rumourPrice ? TOWNS.rumourPrice(s) : 10) * 1.5)));
  const whisperWait = (s, town, t = now()) => Math.max(0, (st(s).next[town] || 0) - t);
  /* can this player ask (not a member following a leader; not shut out) -> "" or the reason */
  function cantAsk(s, town, t = now()) {
    if (!town || !isTown(town)) return "There's nobody here to gossip with.";
    if ((typeof TOWNS !== "undefined") && !TOWNS.INNS?.[town]) return "There's no inn here.";
    if (isMember(s)) return "Your party leader does the asking. You hear what they hear.";
    if ((typeof TOWNS !== "undefined") && TOWNS.wanted(s)) return "Nobody wants to be seen talking to you.";
    if (shut(s, holdOf(town))) return "The innkeeper turns away. \"Not for the likes of you. Make your peace with the hold first.\"";
    if (waiting(s, t).length >= MAX_WHISPERS) return `You're already waiting on ${MAX_WHISPERS} whispers. See how they turn out first.`;
    const wt = whisperWait(s, town, t);
    if (wt > 0) return `Nobody here has anything new about what's coming. Try again in about ${fmtLeft(wt)}.`;
    return "";
  }
  function hearWhisper(s, t = now(), rnd = Math.random) {
    const town = s.location, why = cantAsk(s, town, t);
    if (why) return { err: why };
    const price = whisperPrice(s, town);
    if (s.gold < price) return { err: `A round for the regulars costs ${price} gold.` };
    const kinds = Object.keys(WH).filter((k) => whisperSpots(s, town, k).length);
    if (!kinds.length) return { err: "Nobody's expecting anything to happen round here. Peaceful, for now." };
    s.gold -= price;
    const w = st(s), kind = pick(kinds, rnd), spots = whisperSpots(s, town, kind), where = spots[Math.floor(rnd() * Math.min(5, spots.length))].n, K = WH[kind];
    const soon = 1 - Math.min(0.5, pfx(s, "whisper") * 1.5);
    const hrs = K.hours[0] + rnd() * (K.hours[1] - K.hours[0]);
    const x = { id: `w${Math.floor(t)}-${hash(where + kind) % 1000}`, k: kind, place: where, hold: holdOf(where), town, heard: t, due: t + gameH(hrs * soon), until: 0, real: rnd() < trueChance(s, hour(t)), st: "w", say: fill(pick(K.say, rnd), { place: where }) };
    w.wh.push(x); w.wh = w.wh.slice(-12); w.heard++;
    w.next[town] = t + gameH(WHISPER_WAIT_H);
    if (!s.discovered.includes(where)) s.discovered.push(where);
    const sk = G.useSkill(s, "Speechcraft", 6);
    return { whisper: x, text: `The regulars lean in: “${cap(x.say)}” Give it about ${fmtLeft(x.due - t)} and see. ${where} is marked on your map.${price ? ` (${price} gold for the round.)` : " (The back room's on the house.)"}` + (sk.length ? " " + sk.join(". ") : "") };
  }
  /* whispers coming due: true ones become places to go, the rest fade. Returns a line for the player */
  function advance(s, t = now()) {
    const w = st(s), out = [];
    for (const x of w.wh) {
      if (x.st === "w" && t >= x.due) {
        const K = WH[x.k];
        if (x.real && place(x.place)) { x.st = "live"; x.until = x.due + gameH(LIVE_H); w.came++; news(s, K.icon, fill(K.came, x), x.hold, x.due); out.push(`${K.icon} ${fill(K.came, x)}`); G.note?.(s, `${K.icon} ${fill(K.came, x)}`); }
        else { x.st = "gone"; news(s, "", fill(K.none, x), x.hold, x.due); }
      } else if (x.st === "live" && t >= x.until) { x.st = "gone"; news(s, "", `Whatever was at ${x.place} has moved on.`, x.hold, t); }
    }
    w.wh = w.wh.filter((x) => x.st === "w" || x.st === "live" || t - (x.until || x.due) < gameH(24));
    return out.join(" ");
  }
  const liveHere = (s, t = now()) => (s.trip?.status === "travel" || s.dungeon || !s.location ? null : st(s).wh.find((x) => x.st === "live" && x.until > t && x.place === s.location) || null);
  /* how much the Jarl's bounty pays: more if they think well of you */
  function bountyPay(s, x) {
    const sd = (typeof RUMOURS !== "undefined") ? RUMOURS.standing(s, x.hold) : { pts: 0 };
    const tier = sd.pts >= 50 ? 0.3 : sd.pts >= 25 ? 0.15 : 0;
    return Math.round((WH[x.k].gold + (WH[x.k].fight === false ? 2 : 6) * (s.level || 1)) * (1 + tier) * (1 + Math.min(0.5, pfx(s, "jarlpay"))));
  }
  function foeFor(s, x) {
    const K = WH[x.k], tpl = D.ENCOUNTERS.find((e) => e.name === K.tpl) || D.ENCOUNTERS.find((e) => e.danger === "medium");
    const name = { dragon: "Roosting dragon", warband: "Warband chieftain", troll: "Old troll of the heights", vampire: "Nest master" }[x.k] || tpl.name;
    const e = { ...tpl, name, tags: [...new Set([...(tpl.tags || []), "elite"])], health: Math.round(tpl.health * (x.k === "dragon" ? 1 : 1.2)), gold: [Math.round((tpl.gold?.[0] || 10) * 2), Math.round((tpl.gold?.[1] || 30) * 2.5)], text: fill(K.came, x) };
    const f = G.scaleEnemy(e, G.fightLevel ? G.fightLevel(s) : s.level);
    f.hold = x.hold;
    return f;
  }
  const LOOT = ["mat_iron", "mat_steel", "mat_leather", "potion_health", "potion_stamina", "gem_garnet", "gem_amethyst", "mat_silver"];
  function giveLoot(s, n) {
    const ok = LOOT.filter((i) => D.ITEMS[i]), got = [];
    for (let k = 0; k < n && ok.length; k++) { const i = ok.splice(Math.floor(Math.random() * ok.length), 1)[0]; G.give(s, i); got.push(D.ITEMS[i].name); }
    return got;
  }
  /* see a whisper that came true through -> { text, fight?, died?, gold, loot } | { err } */
  function act(s, id, t = now()) {
    if (isMember(s)) return { err: "Your party leader decides. Stay close and you'll fight beside them." };
    const x = st(s).wh.find((y) => y.id === id && y.st === "live" && y.until > t);
    if (!x) return { err: "Whatever was there has moved on." };
    if (s.location !== x.place || s.trip?.status === "travel" || s.dungeon) return { err: `Go to ${x.place} first.` };
    const K = WH[x.k], g = bountyPay(s, x);
    const finish = (res) => { x.st = "done"; deed(s, "event", x.hold, K.pts, `${s.name} dealt with ${K.title.toLowerCase()} at ${x.place}.`, t); if ((typeof IMM !== "undefined")) IMM.count?.(s, "rumours"); return res; };
    if (K.fight === false) {
      s.gold += g;
      let loot = [];
      if (x.k === "stranded") loot = giveLoot(s, 2);
      if (x.k === "shrine") { G.setHealth(s, G.maxHealth(s), t); s.rested = t + ((typeof TOWNS !== "undefined") && TOWNS.RESTED_SECONDS ? TOWNS.RESTED_SECONDS : 2400); s.restBonus = Math.max(s.restBonus || 0, 0.1); }
      return finish({ text: fill(K.win, { ...x, g, loot: loot.join(", ") || "a few odds and ends" }), gold: g, loot, found: true });
    }
    const e = foeFor(s, x), f = new G.Fight(s, e, null, t);
    f.run({ t }); const skills = f.apply(t);
    if (!f.won) { const d = G.die(s, e.name, t); return { text: `${e.name} was too much for you. It's still out there.`, fight: f, died: d.msg, skills: d.rolledBack ? [] : skills }; }
    s.gold += g;
    const loot = G.rollLoot ? G.rollLoot(s, e) : [];
    return finish({ text: fill(K.win, { ...x, g }), fight: f, gold: g, loot, skills });
  }

  // ====================================================================== towns react: doors, scorn, amends
  const DOORS = [
    { id: "backroom", icon: "", name: "The back room at the inn", min: 10, what: "Whispers of things to come cost you nothing." },
    { id: "store", icon: "", name: "The steward's storeroom", min: 25, what: "Once a day the steward lets you take a few materials.", daily: true },
    { id: "guest", icon: "", name: "A guest room in the Jarl's hall", min: 50, what: "Once a day: a free bed. Healed and Well Rested.", daily: true },
  ];
  const doorMin = (s, d) => Math.round(d.min * (1 - Math.min(0.4, pfx(s, "doors"))));
  const ptsIn = (s, hold) => ((typeof RUMOURS !== "undefined") ? RUMOURS.standing(s, hold).pts : 0);
  const doorOpen = (s, hold, id) => { const d = DOORS.find((x) => x.id === id); return !!d && !!hold && ptsIn(s, hold) >= doorMin(s, d); };
  const shut = (s, hold) => !!hold && ptsIn(s, hold) <= SHUT;
  const scorned = (s, hold) => !!hold && ptsIn(s, hold) <= SCORN;
  /* shops multiply their asking price by this (RUMOURS.priceMult) */
  const priceAdj = (s, hold) => (scorned(s, hold) ? 1 + SCORN_MARKUP : 1);
  const usedToday = (s, id, hold, t = now()) => st(s).daily[`${id}|${hold}`] === dayNo(t);
  function useDoor(s, id, t = now()) {
    const town = s.location, hold = town && isTown(town) ? holdOf(town) : "", d = DOORS.find((x) => x.id === id);
    if (!hold || !d || !d.daily) return { err: "There's no door like that here." };
    if (!doorOpen(s, hold, id)) return { err: `That door is only open to people ${hold} thinks well of.` };
    if ((typeof TOWNS !== "undefined") && TOWNS.wanted(s)) return { err: "Not while the guards are after you." };
    if (usedToday(s, id, hold, t)) return { err: "You've had that today. Come back tomorrow." };
    st(s).daily[`${id}|${hold}`] = dayNo(t);
    if (id === "store") {
      const pool = ["mat_iron", "mat_iron", "mat_steel", "mat_leather", "mat_strips", "mat_firewood", "mat_silver", "mat_moonstone"].filter((i) => D.ITEMS[i]), got = [];
      const n = ptsIn(s, hold) >= 50 ? 3 : 2;
      for (let k = 0; k < n && pool.length; k++) { const i = pool[Math.floor(Math.random() * pool.length)]; G.give(s, i); got.push(D.ITEMS[i].name); }
      return { text: `The steward unlocks the storeroom. "Take what you need, friend of ${hold}." You take ${got.join(", ")}.` };
    }
    G.setHealth(s, G.maxHealth(s), t);
    if ((typeof WFX !== "undefined")) WFX.warmUp?.(s, 100, t);
    s.rested = t + ((typeof TOWNS !== "undefined") && TOWNS.RESTED_SECONDS ? TOWNS.RESTED_SECONDS : 2400); s.restBonus = 0.1;
    return { text: `A housecarl shows you to a warm room in the Jarl's hall. You sleep like a stone. Healed and Well Rested.` };
  }
  const amendsCost = (s, hold) => Math.round((40 + 6 * Math.max(0, -ptsIn(s, hold))) * (1 - Math.min(0.6, pfx(s, "amends"))));
  function amends(s, t = now()) {
    const town = s.location, hold = town && isTown(town) ? holdOf(town) : "";
    if (!hold) return { err: "Make amends in a town." };
    if ((s.bounty || {})[hold]) return { err: "Settle your bounty with the guards first." };
    const pts = ptsIn(s, hold);
    if (pts >= 0) return { err: `${hold} has nothing against you.` };
    const c = amendsCost(s, hold);
    if (s.gold < c) return { err: `The temple asks ${c} gold for the hold's poor.` };
    s.gold -= c;
    deed(s, "amends", hold, -pts + 1, `${s.name} gave ${c} gold to the poor of ${hold} and made amends.`, t);
    return { text: `You give ${c} gold to the temple for the poor of ${hold}. The priest nods. "The hold will remember this too."` };
  }

  // ====================================================================== townsfolk keep hours
  // [from, to, where, doing]; where: shop / inn / home / court / streets
  const SCHED = {
    merchant: [[0, 6, "home", "asleep"], [6, 8, "home", "having breakfast"], [8, 20, "shop", "behind the counter"], [20, 23, "inn", "having a drink at the inn"], [23, 24, "home", "asleep"]],
    smith: [[0, 5, "home", "asleep"], [5, 8, "shop", "lighting the forge"], [8, 20, "shop", "at the anvil"], [20, 22, "inn", "washing the soot down at the inn"], [22, 24, "home", "asleep"]],
    alchemist: [[0, 7, "home", "asleep"], [7, 8, "streets", "picking herbs by the walls"], [8, 20, "shop", "grinding ingredients"], [20, 24, "home", "reading by candlelight"]],
    wizard: [[0, 2, "home", "studying late"], [2, 8, "home", "asleep"], [8, 20, "court", "at the Jarl's court"], [20, 24, "home", "studying late"]],
    innkeeper: [[0, 2, "inn", "wiping the last mugs"], [2, 7, "home", "asleep"], [7, 24, "inn", "behind the bar"]],
    stable: [[0, 5, "home", "asleep"], [5, 19, "shop", "with the horses"], [19, 21, "inn", "having a stew at the inn"], [21, 24, "home", "asleep"]],
    fence: [[0, 4, "inn", "in a dark corner of the inn"], [4, 12, "home", "asleep"], [12, 24, "shop", "somewhere you'd never find without help"]],
    bard: [[0, 1, "inn", "singing"], [1, 10, "home", "asleep"], [10, 17, "streets", "busking in the market"], [17, 24, "inn", "singing"]],
    guard: [[0, 6, "streets", "walking the walls with a torch"], [6, 20, "streets", "on watch"], [20, 24, "streets", "walking the walls with a torch"]],
  };
  const SEC_ROLE = { general: "merchant", blacksmith: "smith", alchemy: "alchemist", wizard: "wizard", stables: "stable", fence: "fence" };
  const WHERE = { shop: "at work", inn: "in the inn", home: "at home", court: "at court", streets: "in the streets" };
  const SHOPPERS = ["general", "blacksmith", "alchemy", "wizard", "stables"];
  function slot(role, h) { const tb = SCHED[role] || SCHED.merchant; return tb.find(([a, b]) => h >= a && h < b) || tb[0]; }
  const nameFor = (town, sec, role) => { try { const n = (typeof NPCART !== "undefined") ? NPCART.who(town, sec) : null; if (n?.name) return n.name; } catch { /* no art */ } return { merchant: "The trader", smith: "The smith", alchemist: "The apothecary", wizard: "The court wizard", innkeeper: "The innkeeper", stable: "The stablemaster", fence: "The fence" }[role] || "Someone"; };
  /* who lives and works in this town -> [{ sec, role, name }] */
  function townsfolk(town) {
    if (!town || !isTown(town)) return [];
    const types = G.shopTypes(town), out = [];
    for (const sec of ["general", "blacksmith", "alchemy", "wizard", "stables", "fence"]) if (types.includes(sec) || (sec === "alchemy" && place(town)?.[2] === "city")) out.push({ sec, role: SEC_ROLE[sec], name: nameFor(town, sec, SEC_ROLE[sec]) });
    if ((typeof TOWNS !== "undefined") && TOWNS.INNS?.[town]) { out.push({ sec: "inn", role: "innkeeper", name: nameFor(town, "inn", "innkeeper") }); out.push({ sec: "bard", role: "bard", name: `${["Mikael", "Lisette", "Talsgar", "Karita", "Sven", "Giraud", "Lurbuk", "Nilsine"][hash(town) % 8]} the bard` }); }
    return out;
  }
  /* where everyone is at hour h -> [{ ...person, at, doing }] */
  const about = (town, h = hour()) => townsfolk(town).map((p) => { const [, , at, doing] = slot(p.role, h); return { ...p, at, doing }; });
  const inInn = (town, h = hour()) => about(town, h).filter((p) => p.at === "inn");
  /* a shopkeeper you found in the inn opens up for you, no night charge */
  function askOpen(s, sec, t = now()) {
    const town = s.location;
    if (!town || G.shopsOpen(t)) return { err: "The shops are open. Walk right in." };
    const p = inInn(town, hour(t)).find((x) => x.sec === sec && SHOPPERS.includes(x.sec));
    if (!p) return { err: "They're not in the inn right now." };
    if (((typeof TOWNS !== "undefined") && TOWNS.wanted(s)) || shut(s, holdOf(town))) return { err: `${p.name} won't even look at you.` };
    const h = hour(t), left = h >= 8 ? 24 - h + 8 : 8 - h;
    if ((typeof RUMOURS !== "undefined")) { RUMOURS.st(s).knock = { town, until: t + gameH(left), free: true }; }
    return { text: `You buy ${p.name} a mug. "Ah, go on then. I'll open up for you, no extra charge." The shops here will serve you until morning.` };
  }

  // ====================================================================== news of the realm
  const REALM = [
    "The Jarl of {h} has doubled the watch on the roads.", "Iron is dear in {h} this week; the mines are flooded.", "A trader in {h} swears he saw a mammoth with two tails.",
    "The harvest in {h} came in early. Bread's cheap.", "The court of {h} hosts envoys from Cyrodiil. Nobody knows why.", "Skooma was found in a barrel of mead in {h}. The guards are furious.",
    "A wedding in {h}: the steward's daughter, at last.", "Wolves were heard close to the walls of {h} three nights running.", "The College sent a mage to {h} to look at a glowing stone.",
    "A great storm wrecked fishing boats off {h}.", "The temple in {h} asks for donations to fix its roof.", "Two guards in {h} were caught asleep at their post. Again.",
  ];
  const HOLDS = () => ((typeof RUMOURS !== "undefined") ? RUMOURS.HOLDS : ["Whiterun", "Haafingar", "Eastmarch", "The Rift", "The Reach", "Falkreath", "The Pale", "Hjaalmarch", "Winterhold"]);
  /* the talk of a given game day: the same on every phone */
  function realm(day) {
    const H = HOLDS(), a = hash("realm" + day), b = hash("talk" + day * 7);
    return [{ t: (day * 86400 + 9 * 3600) / GS(), i: "", x: REALM[a % REALM.length].replace("{h}", H[(a >> 4) % H.length]), h: "" }, { t: (day * 86400 + 18 * 3600) / GS(), i: "", x: REALM[(b + 5) % REALM.length].replace("{h}", H[(b >> 3) % H.length]), h: "" }];
  }
  /* the whole feed: yours (or your party leader's) and the realm's last three days */
  function feed(s, t = now(), n = 12) {
    const sh = sharedFor(s), mine = sh ? sh.n || [] : st(s).news, d = dayNo(t);
    const talk = [d - 2, d - 1, d].flatMap(realm).filter((x) => x.t <= t);
    return [...mine, ...talk].sort((a, b) => b.t - a.t).slice(0, n);
  }

  // ====================================================================== party: the leader's world is everyone's
  let boundParty = null;
  const isMember = (s) => { const p = boundParty; return !!(p && p.leader && p.leader !== s.id && p.members?.length > 1 && p.members.some((m) => m.id === s.id)); };
  /* the leader publishes this on their card (ui.js publishCard) */
  function cardBits(s, party) {
    if (!party || party.leader !== s.id || !(party.members?.length > 1)) return {};
    const t = now();
    return { lw: { w: waiting(s, t).map((x) => ({ id: x.id, k: x.k, place: x.place, hold: x.hold, due: x.due, until: x.until, st: x.st, say: x.say })).slice(0, 4), n: st(s).news.slice(0, 8) } };
  }
  /* a member takes the leader's world from the leader's card */
  function adopt(s, lw, from) {
    const w = st(s);
    if (!lw || typeof lw !== "object") { w.shared = null; return; }
    const ok = (x) => x && WH[x.k] && typeof x.place === "string" && place(x.place);
    w.shared = { from: String(from || "your leader").slice(0, 40), w: (Array.isArray(lw.w) ? lw.w : []).filter(ok).slice(0, 4), n: (Array.isArray(lw.n) ? lw.n : []).filter((x) => x && typeof x.x === "string").slice(0, 8).map((x) => ({ t: +x.t || 0, i: String(x.i || "").slice(0, 4), x: x.x.slice(0, 200), h: String(x.h || "") })) };
    for (const x of w.shared.w) if (!s.discovered.includes(x.place)) s.discovered.push(x.place);
  }
  function follow(s, party, cards) {
    boundParty = party || null;
    if (!isMember(s)) { if (s.lw?.shared) st(s).shared = null; return; }
    const lc = (cards || []).find((c) => c.id === party.leader);
    if (lc) adopt(s, lc.lw, lc.name);
  }
  const bindParty = (p) => { boundParty = p || null; };   // tests and the ui
  const sharedFor = (s) => (isMember(s) && s.lw?.shared ? s.lw.shared : null);
  const whispersFor = (s, t = now()) => { const sh = sharedFor(s); return sh ? sh.w.filter((x) => x.st === "w" || (x.st === "live" && x.until > t)) : waiting(s, t); };

  // ====================================================================== pictures
  /* a little notice board with pinned papers */
  function boardArt(n = 3) {
    const W = 120, H = 56;
    let g = `<rect x="6" y="4" width="108" height="44" rx="3" fill="#5a3e22" stroke="#1a120a"/><rect x="10" y="8" width="100" height="36" rx="2" fill="#7a5a34"/><path d="M21 48 v8 M99 48 v8" stroke="#4a3320" stroke-width="5"/>`;
    for (let i = 0; i < Math.min(5, n); i++) {
      const x = 16 + i * 19, y = 11 + (i % 2) * 4, rot = ((hash("b" + i) % 9) - 4);
      g += `<g transform="rotate(${rot} ${x + 7} ${y + 9})"><rect x="${x}" y="${y}" width="14" height="18" fill="#efe3c0" stroke="#3a2a1a" stroke-width=".6"/><path d="M${x + 2} ${y + 6} h10 M${x + 2} ${y + 9} h8 M${x + 2} ${y + 12} h9" stroke="#6b5a3a" stroke-width=".8"/><circle cx="${x + 7}" cy="${y + 1.5}" r="1.6" fill="#a8321e"/></g>`;
    }
    return `<svg class="lw-board" viewBox="0 0 ${W} ${H}" aria-hidden="true">${g}</svg>`;
  }
  /* a door, open (warm light) or shut (bolted) */
  function doorArt(open) {
    return `<svg class="lw-door" viewBox="0 0 30 40" aria-hidden="true"><path d="M3 38 V10 q12 -10 24 0 V38z" fill="#3a2a1a" stroke="#1a120a"/>${open ? `<path d="M6 38 V11 q9 -8 18 0 V38z" fill="#ffcf73"/><path d="M6 38 V11 q3 -3 7 -4 V38z" fill="#6b4a2a" stroke="#1a120a" stroke-width=".6"/>` : `<path d="M6 38 V11 q9 -8 18 0 V38z" fill="#6b4a2a" stroke="#1a120a" stroke-width=".6"/><rect x="5" y="19" width="20" height="3" rx="1" fill="#2a2a2a"/>`}</svg>`;
  }

  // ====================================================================== HTML pieces
  const roleIcon = { merchant: "", smith: "", alchemist: "", wizard: "", innkeeper: "", stable: "", fence: "", bard: "" };
  function peopleHTML(list) {
    return `<div class="lw-folk">${list.map((p) => `<div class="lw-who at-${p.at}"><span aria-hidden="true">${roleIcon[p.role] || "•"}</span><b>${esc(p.name)}</b><small>${esc(p.doing)}</small></div>`).join("")}</div>`;
  }
  function whisperRow(x, t, member) {
    const K = WH[x.k], live = x.st === "live";
    return `<div class="item lw-wh${live ? " on" : ""}"><span class="xbook" aria-hidden="true">${K.icon}</span><div class="t">${esc(live ? K.title : "Whispered")} · ${esc(x.place)}<span>${live ? `It's real. Gone in about ${fmtLeft(x.until - t)}.` : `“${esc(cap(x.say))}” We'll know in about ${fmtLeft(Math.max(0, x.due - t))}.`}${member ? " (your leader's)" : ""}</span></div><button class="btn sm" data-act="qmap" data-place="${esc(x.place)}">Map</button></div>`;
  }
  function feedHTML(s, n = 6) {
    const t = now(), f = feed(s, t, n);
    if (!f.length) return `<p class="sub">No news yet.</p>`;
    return `<div class="lw-feed">${f.map((x) => `<div class="lw-news"><span aria-hidden="true">${esc(x.i)}</span><p>${esc(x.x)}<small>${esc((typeof RUMOURS !== "undefined") ? `${fmtLeft(Math.max(0, t - x.t))} ago` : "")}</small></p></div>`).join("")}</div>`;
  }
  function doorsHTML(s, town) {
    const hold = holdOf(town), pts = ptsIn(s, hold), sd = (typeof RUMOURS !== "undefined") ? RUMOURS.standing(s, hold) : { bounty: 0 };
    let out = "";
    for (const d of DOORS) {
      const open = pts >= doorMin(s, d), used = d.daily && usedToday(s, d.id, hold);
      out += `<div class="item lw-doorrow${open ? " on" : ""}">${doorArt(open)}<div class="t">${esc(d.name)}<span>${open ? esc(d.what) : `Opens when ${esc(hold)} thinks well enough of you (${doorMin(s, d)} standing; you have ${Math.round(pts)}).`}</span></div>${open && d.daily ? `<button class="btn sm" data-lw="door" data-id="${d.id}" ${used ? "disabled" : ""}>${used ? "Tomorrow" : "Go in"}</button>` : ""}</div>`;
    }
    if (pts <= SHUT) out += `<div class="item lw-doorrow bad">${doorArt(false)}<div class="t">Shutters close as you pass<span>No knocking at night and no whispers at the inn${pts <= SCORN ? `, and shops charge you ${Math.round(SCORN_MARKUP * 100)}% more` : ""}.${sd.bounty ? " Settle your bounty first, then make amends." : ""}</span></div>${!sd.bounty ? `<button class="btn sm" data-lw="amends">Make amends · ${amendsCost(s, hold)}</button>` : ""}</div>`;
    return `<h3 class="xh">Doors in ${esc(town)}</h3><div class="list">${out}</div>`;
  }
  /* everything this module adds to a town section (RUMOURS.townHTML calls this) */
  function townHTML(s, town, section, open) {
    try {
      if (!s || !isTown(town)) return "";
      const h = hour(), t = now(), hold = holdOf(town);
      let out = "";
      if (section === "inn") {
        const here = inInn(town, h);
        out += `<div class="lw-inn"><h3 class="xh">In the inn right now</h3>${here.length ? peopleHTML(here) : `<p class="sub">Just strangers.</p>`}`;
        if (!G.shopsOpen(t)) for (const p of here.filter((x) => SHOPPERS.includes(x.sec))) out += `<div class="item lw-ask"><div class="t">${esc(p.name)} is here<span>Buy them a mug and ask them to open up. No night charge.</span></div><button class="btn sm" data-lw="askopen" data-sec="${esc(p.sec)}">Ask</button></div>`;
        out += `</div>`;
        const why = cantAsk(s, town, t), price = whisperPrice(s, town), member = isMember(s);
        out += `<div class="item lw-ask"><div class="t">Whispers of things to come<span>${why ? esc(why) : `The regulars hear about things before they happen. Most of it comes true.${h >= 17 || h < 1 ? " Busy tonight: better gossip." : ""}`}</span></div>${member ? "" : `<span class="num gold">${price || "free"}</span><button class="btn sm" data-lw="whisper" ${why ? "disabled" : ""}>Listen</button>`}</div>`;
        out += `<div class="lw-noticeboard">${boardArt(Math.min(5, feed(s, t, 5).length))}<div><b>Notice board</b>${feedHTML(s, 3)}</div></div>`;
      } else if (section === "streets") {
        out += `<h3 class="xh">Who's about</h3>${peopleHTML(about(town, h))}`;
        out += doorsHTML(s, town);
      } else if (SHOPPERS.includes(section) && !open) {
        const p = about(town, h).find((x) => x.sec === section);
        if (p) out += `<p class="lw-where">${esc(p.name)} is ${esc(p.doing)}.${p.at === "inn" ? " You could find them at the inn." : ""}</p>`;
      }
      if (hold && scorned(s, hold) && SHOPPERS.includes(section)) out += `<p class="lw-where bad">They don't want your sort here: ${Math.round(SCORN_MARKUP * 100)}% on everything.</p>`;
      return out;
    } catch { return ""; }
  }
  /* Travel tab card when you stand where a whisper came true (RUMOURS.card adds it) */
  function card(s) {
    try {
      const x = liveHere(s); if (!x) return "";
      const K = WH[x.k], member = isMember(s);
      return `<div class="panel xcard lw-card"><h2>${K.icon} ${esc(K.title)}</h2><p class="sub">${esc(fill(K.came, x))} ${K.fight === false ? `There's about ${bountyPay(s, x)} gold in it for you.` : `The Jarl of ${esc(x.hold)} pays a bounty: about ${bountyPay(s, x)} gold.`}</p>${member ? `<p class="sub">Your leader decides.</p>` : `<button class="btn pri" data-lw="act" data-id="${esc(x.id)}" style="width:100%">${K.fight === false ? "Go and see" : " Deal with it"}</button>`}</div>`;
    } catch { return ""; }
  }
  /* map marks (RUMOURS.marks adds them): whispers get a question mark until they come true */
  function marks(s) {
    try { const t = now(); return whispersFor(s, t).filter((x) => place(x.place)).map((x) => ({ id: x.id, pos: place(x.place).slice(0, 2), label: `${WH[x.k].icon}${x.st === "live" ? "" : "?"} ${x.place}`, here: s.location === x.place })); } catch { return []; }
  }
  /* Map → World news (RUMOURS.panel adds it) */
  function panel(s) {
    try {
      const t = now(), sh = sharedFor(s), list = whispersFor(s, t);
      const my = HOLDS().map((h) => ({ h, d: deedWords(s, h) })).filter((x) => x.d.length);
      return `<div class="panel lw-panel"><h2> News of the realm</h2>${sh ? `<p class="sub">You're in ${esc(sh.from)}'s party: you share their world. They hear the whispers and make the choices.</p>` : `<p class="sub">What's happened lately, and what people say is coming.</p>`}
        ${feedHTML(s, 10)}
        <h3 class="xh">Whispers of things to come</h3>${list.length ? `<div class="list">${list.map((x) => whisperRow(x, t, !!sh)).join("")}</div>` : `<p class="sub">Listen in an inn (evenings are best). Most whispers come true half a day later.</p>`}
        ${my.length ? `<h3 class="xh">What they remember</h3><div class="list">${my.map((x) => `<div class="item"><div class="t">${esc(x.h)}<span>${esc(x.d.join(" · "))}</span></div></div>`).join("")}</div>` : ""}</div>`;
    } catch { return ""; }
  }

  // ====================================================================== buttons
  if (DOM && typeof document.addEventListener === "function") {
    document.addEventListener("click", (e) => {
      const b = e.target.closest?.("[data-lw]"); if (!b || b.disabled) return;
      const S = window.__dbg?.save?.(), ui = window.__ui; if (!S || !ui) return;
      const toast = (m) => window.__dbg?.toast?.(m), msg = (t, x, bad) => window.__dbg?.message?.(t, x, bad);
      const sfx = (n) => { try { SOUND.fx(n); } catch { /* optional */ } };
      const what = b.dataset.lw;
      let r = null;
      if (what === "whisper") r = hearWhisper(S);
      else if (what === "askopen") r = askOpen(S, b.dataset.sec);
      else if (what === "door") r = useDoor(S, b.dataset.id);
      else if (what === "amends") r = amends(S);
      else if (what === "act") {
        const id = b.dataset.id, go = typeof NOAUTO !== "undefined" ? NOAUTO.call : (fn, done) => done(fn());   // a fight opens on the turn-by-turn screen (noautoplay.js)
        return void go(() => act(S, id), (r) => {
          if (r.err) return toast(r.err);
          G.note?.(S, `\uE103 ${r.text}`); ui.save(); ui.refresh();
          if ((r.fight || r.died) && ui.fight) return ui.fight(r);
          sfx("coin"); return msg("The whispers were true", r.text);
        });
      }
      if (!r) return;
      if (r.err) return toast(r.err);
      sfx(what === "door" || what === "amends" ? "coin" : "click");
      ui.save(); ui.refresh();
      if (what === "whisper") { G.note?.(S, ` ${r.text}`); msg("Whispers of things to come", r.text); } else toast(r.text);
    });
  }

  return { DEED, WH, DOORS, SCHED, FADE_DAYS, MAX_WHISPERS, LIVE_H, SHUT, SCORN, SCORN_MARKUP, st, deed, news, worth, points, deedWords, lines, watch, tick, advance,
    trueChance, whisperSpots, hearWhisper, cantAsk, whisperPrice, act, liveHere, bountyPay, doorOpen, doorMin, shut, scorned, priceAdj, useDoor, amends, amendsCost,
    townsfolk, about, inInn, slot, askOpen, realm, feed, cardBits, adopt, follow, bindParty, isMember, sharedFor, whispersFor, townHTML, card, marks, panel, boardArt, doorArt, dayNo };
})();
