const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* The world remembers you (livingworld.js): deeds per hold, towns that react, doors, townsfolk's hours,
   whispers that come true later, news of the realm, the party leader's shared world, perks.
   W=/path/to/game/ node test_livingworld.js — prints "livingworld ok". */
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
let FAKE = Date.now();
class FakeDate extends Date { static now() { return FAKE; } }
const c = { console, Math, Date: FakeDate, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, URLSearchParams, setNow: (ms) => { FAKE = ms; } };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "guilds.js", "immerse.js", "rumours.js", "livingworld.js", "i18n_story.js", "i18n_living.js", "i18n_bonds.js", "i18n.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
let n = 0; const ok = (cnd, m) => { n++; if (!cnd) throw new Error("FAIL " + m); };
const atHour = (h) => { let t = G.now(); for (let i = 0; i < 2000 && Math.abs(G.clock(t).hour - h) > 0.2; i++) t += 30; setNow(t * 1000); return t; };
const later = (hours) => setNow((G.now() + hours * 3600 / G.GAME_SPEED) * 1000);
const mk = (town = "Whiterun") => { const s = G.newSave("lw" + Math.random(), "Lydia", "nord"); s.location = town; [s.x, s.y] = WORLD.places[town]; s.gold = 5000; s.level = 20; s.hpBonus = 2000; G.setHealth(s, G.maxHealth(s)); return s; };
const clean = (h) => !/undefined|NaN|\\{[a-z]\\}/.test(h);
LIVING.bindParty(null);

// 1. deeds are noticed: dragons, crimes, caravans robbed and guarded, quests, cleared places
atHour(12);
{
  const s = mk();
  ok(LIVING.watch(s) === "" && LIVING.st(s).snap, "first look just takes notes");
  const p0 = RUMOURS.standing(s, "Whiterun").pts;
  s.dragons = 1; LIVING.watch(s);
  ok(LIVING.st(s).deeds[0].k === "dragon" && LIVING.st(s).deeds[0].h === "Whiterun", "a dragon slain in Whiterun is remembered there");
  ok(RUMOURS.standing(s, "Whiterun").pts > p0, "and lifts your name");
  ok(RUMOURS.standing(s, "Whiterun").deeds.some((d) => /dragon/.test(d)), "listed among your deeds");
  ok(/dragon/.test(LIVING.st(s).news[0].x), "news of the realm: " + LIVING.st(s).news[0].x);
  // a crime: every new bounty is remembered even after it's paid
  TOWNS.addBounty(s, "Whiterun", "assault"); LIVING.watch(s);
  const cr = LIVING.st(s).deeds[0]; ok(cr.k === "crime" && cr.p < 0, "a crime is remembered (" + cr.p + ")");
  delete s.bounty.Whiterun;
  ok(LIVING.points(s, "Whiterun") < 5, "paid off, still remembered");
  // a caravan robbed (caravanroad.js records it in s.cvRoad.robbed)
  s.cvRoad = { robbed: { c1: G.now() } }; LIVING.watch(s);
  ok(LIVING.st(s).deeds[0].k === "rob" && LIVING.st(s).deeds[0].p === LIVING.DEED.rob.pts, "a robbed caravan is remembered");
  ok(LIVING.lines(s, "Whiterun").some((l) => /caravan|thief/i.test(l)), "and the guards bring it up");
  ok(RUMOURS.deedLines(s, "Whiterun").some((l) => /caravan|thief/i.test(l)), "in their barks and greetings");
  // a caravan guarded all the way
  const g = mk("Riften"); LIVING.watch(g);
  g.caravanJob = { id: "x", to: "Windhelm", name: "Ri'saad's caravan" }; LIVING.watch(g);
  g.caravanJob = null; g.location = "Windhelm"; [g.x, g.y] = WORLD.places.Windhelm;
  ok(/caravan/.test(LIVING.watch(g)) && LIVING.st(g).deeds[0].k === "guard" && LIVING.st(g).deeds[0].h === "Eastmarch", "guarding a caravan into Windhelm counts in Eastmarch");
  // a deserter gets nothing
  const d = mk(); LIVING.watch(d); d.caravanJob = { id: "y", to: "Solitude", name: "x" }; LIVING.watch(d); d.caravanJob = null; LIVING.watch(d);
  ok(!LIVING.st(d).deeds.length, "no credit for leaving the wagons");
  // quests and cleared places make the news
  s.cleared = { "Bleak Falls Barrow": G.now() }; LIVING.watch(s);
  ok(/Bleak Falls Barrow/.test(LIVING.st(s).news[0].x), "cleared places make the news");
  const qid = Object.keys(QUESTS.L)[0]; s.quests = { [qid]: { done: true } }; LIVING.watch(s);
  ok(LIVING.st(s).news[0].x.includes(QUESTS.L[qid].name), "finished quest lines make the news");
}

// 2. bad deeds fade; Low Profile
{
  const s = mk(); LIVING.deed(s, "crime", "Whiterun", -20);
  const w0 = LIVING.points(s, "Whiterun");
  later(24 * 7); const w7 = LIVING.points(s, "Whiterun");
  later(24 * 30); const w30 = LIVING.points(s, "Whiterun");
  ok(w0 === -20 && w7 > w0 && w30 === -5, "crimes fade to a quarter (" + w0 + " → " + w7 + " → " + w30 + ")");
  LIVING.deed(s, "guard", "Whiterun"); later(24 * 60); ok(LIVING.points(s, "Whiterun") === -5 + LIVING.DEED.guard.pts, "good deeds don't fade");
  const q = mk(); q.perks = { low_profile: 1 }; LIVING.deed(q, "crime", "Whiterun", -20);
  ok(PFX.num(q, "infamy") === 0.4 && PFX.num(q, "forget") === 1 && LIVING.points(q, "Whiterun") === -12, "Low Profile: crimes hurt 40% less");
}

// 3. towns react: scorn, shutters, amends
atHour(22);
{
  const s = mk(); s.gold = 5000;
  const base = G.buyPrice(s, "potion_health", "Whiterun");
  LIVING.deed(s, "rob", "Whiterun", -30);
  ok(LIVING.shut(s, "Whiterun") && LIVING.scorned(s, "Whiterun"), "scorned in Whiterun (" + RUMOURS.standing(s, "Whiterun").pts + ")");
  ok(!LIVING.shut(s, "The Rift"), "only in Whiterun");
  ok(G.buyPrice(s, "potion_health", "Whiterun") > base, "shops charge you more (" + base + " → " + G.buyPrice(s, "potion_health", "Whiterun") + ")");
  ok(/amends/i.test(RUMOURS.knock(s).err || ""), "nobody opens up at night");
  ok(/peace|likes of you/i.test(LIVING.cantAsk(s, "Whiterun")), "the innkeeper won't share whispers");
  ok(/Make amends/.test(LIVING.townHTML(s, "Whiterun", "streets", false)), "the streets offer a way to make amends");
  s.bounty = { Whiterun: 40 }; ok(/bounty/.test(LIVING.amends(s).err || ""), "settle the bounty first");
  delete s.bounty.Whiterun;
  const cost = LIVING.amendsCost(s, "Whiterun"), g = s.gold, r = LIVING.amends(s);
  ok(!r.err && s.gold === g - cost && RUMOURS.standing(s, "Whiterun").pts >= 0 && !LIVING.shut(s, "Whiterun"), "amends: " + cost + " gold and the hold forgives (" + RUMOURS.standing(s, "Whiterun").pts + ")");
  ok(G.buyPrice(s, "potion_health", "Whiterun") === base, "prices back to normal");
  ok(LIVING.amends(s).err, "nothing more to make amends for");
  const wm = mk(); LIVING.deed(wm, "rob", "Whiterun", -30); const c0 = LIVING.amendsCost(wm, "Whiterun"); wm.perks = { well_met: 1 };
  ok(LIVING.amendsCost(wm, "Whiterun") === Math.round(c0 * 0.6), "Well Met: amends cost 40% less");
}

// 4. doors that open as your name grows
atHour(12);
{
  const s = mk(); s.gold = 1000;
  ok(!LIVING.doorOpen(s, "Whiterun", "backroom") && !LIVING.doorOpen(s, "Whiterun", "guest"), "a stranger: doors shut");
  ok(LIVING.useDoor(s, "store").err, "no storeroom for strangers");
  RUMOURS.st(s).fame.Whiterun = 30;
  ok(LIVING.doorOpen(s, "Whiterun", "backroom") && LIVING.doorOpen(s, "Whiterun", "store") && !LIVING.doorOpen(s, "Whiterun", "guest"), "a friend: back room and storeroom");
  ok(LIVING.whisperPrice(s, "Whiterun") === 0, "the back room: whispers on the house");
  const inv = s.inv.length, r = LIVING.useDoor(s, "store");
  ok(!r.err && s.inv.length > inv, "the storeroom: " + r.text);
  ok(/tomorrow/i.test(LIVING.useDoor(s, "store").err || ""), "once a day");
  later(25); ok(!LIVING.useDoor(s, "store").err, "and again the next day");
  RUMOURS.st(s).fame.Whiterun = 60; G.setHealth(s, 10);
  const gr = LIVING.useDoor(s, "guest");
  ok(!gr.err && G.curHealth(s) === G.maxHealth(s) && G.rested(s) && s.restBonus === 0.1, "the Jarl's guest room: healed and Well Rested");
  ok(/Doors in Whiterun/.test(LIVING.townHTML(s, "Whiterun", "streets", true)), "doors listed in the streets");
  const wm = mk(); RUMOURS.st(wm).fame.Whiterun = 40; ok(!LIVING.doorOpen(wm, "Whiterun", "guest"), "40 isn't enough for the Jarl's hall");
  wm.perks = { local_hero: 1, courtly_manners: 1, well_met: 1 }; ok(LIVING.doorMin(wm, LIVING.DOORS[2]) < 50 && LIVING.doorOpen(wm, "Whiterun", "guest"), "Well Met opens it sooner");
}

// 5. townsfolk keep hours
{
  const folk = LIVING.townsfolk("Whiterun");
  ok(folk.length >= 5 && folk.every((p) => p.name && LIVING.SCHED[p.role]), "Whiterun's townsfolk: " + folk.map((p) => p.name).join(", "));
  ok(LIVING.about("Whiterun", 12).find((p) => p.role === "merchant").at === "shop", "noon: the trader is behind the counter");
  ok(LIVING.about("Whiterun", 3).find((p) => p.role === "merchant").at === "home", "3 am: asleep");
  const eve = LIVING.inInn("Whiterun", 21).map((p) => p.role);
  ok(eve.includes("merchant") && eve.includes("smith") && eve.includes("innkeeper") && eve.includes("bard"), "9 pm: half the town is in the inn (" + eve + ")");
  ok(LIVING.inInn("Whiterun", 12).every((p) => p.role === "innkeeper"), "noon: just the innkeeper");
  for (const [role, tb] of Object.entries(LIVING.SCHED)) { let h = 0; for (const [a, b] of tb) { ok(a === h && b > a, role + " hours join up"); h = b; } ok(h === 24, role + " covers the day"); }
  // asking a shopkeeper you found in the inn to open up: no night charge
  const s = mk(); atHour(12); const day = G.buyPrice(s, "potion_health", "Whiterun");
  ok(LIVING.askOpen(s, "general").err, "by day the shops are open");
  atHour(21);
  ok(/in the inn right now/i.test(LIVING.townHTML(s, "Whiterun", "inn", false)) && /data-lw="askopen"/.test(LIVING.townHTML(s, "Whiterun", "inn", false)), "the inn shows who's in and offers to ask");
  ok(/at the inn/.test(LIVING.townHTML(s, "Whiterun", "general", false)), "a closed shop says where its keeper is");
  const r = LIVING.askOpen(s, "general");
  ok(!r.err && RUMOURS.knocked(s) && G.buyPrice(s, "potion_health", "Whiterun") === day, "opened up, day prices: " + r.text);
  atHour(2); ok(LIVING.askOpen(mk(), "general").err, "at 2 am they've gone home");
}

// 6. whispers of things to come
atHour(19);
{
  const s = mk(), g0 = s.gold;
  const r = LIVING.hearWhisper(s);
  ok(!r.err && r.whisper && s.gold < g0 && clean(r.text), "a whisper: " + (r.err || r.text));
  const x = r.whisper;
  ok(s.discovered.includes(x.place) && x.due > G.now() && LIVING.WH[x.k], "marked, not yet happened");
  ok(RUMOURS.marks(s).some((m) => m.id === x.id && /\\?/.test(m.label)), "on the map with a question mark");
  ok(/Whispers of things to come/.test(RUMOURS.panel(s)) && /News of the realm/.test(RUMOURS.panel(s)), "in World news");
  ok(/Nobody here has anything new/.test(LIVING.hearWhisper(s).err || ""), "one whisper per inn per half day");
  s.location = "Riverwood"; [s.x, s.y] = WORLD.places.Riverwood;
  ok(!LIVING.hearWhisper(s).err, "another inn, another whisper");
  s.location = "Rorikstead"; [s.x, s.y] = WORLD.places.Rorikstead;
  ok(/already waiting/.test(LIVING.hearWhisper(s).err || ""), "at most " + LIVING.MAX_WHISPERS + " at once");
  // it comes true (or not) when it's due
  for (const w of LIVING.st(s).wh) w.real = true;
  LIVING.st(s).wh[1].real = false;
  later(20); const msg = LIVING.advance(s);
  ok(x.st === "live" && x.until > G.now() && msg.includes(x.place), "the whisper came true: " + msg);
  ok(LIVING.st(s).wh[1].st === "gone", "the other came to nothing");
  ok(LIVING.st(s).news.some((nw) => nw.x.includes(x.place)) && LIVING.st(s).came === 1, "both make the news");
  ok(RUMOURS.marks(s).some((m) => m.id === x.id && !/\\?/.test(m.label)), "a solid mark now");
  ok(LIVING.act(s, x.id).err, "you have to go there");
  s.location = x.place; [s.x, s.y] = WORLD.places[x.place]; s.trip = null;
  ok(/Jarl of|gold in it for you/.test(RUMOURS.card(s)) && /data-lw="act"/.test(RUMOURS.card(s)), "a card on the travel tab");
  const pay = LIVING.bountyPay(s, x); RUMOURS.st(s).fame[x.hold] = 60;
  ok(LIVING.bountyPay(s, x) > pay, "heroes get a bigger Jarl's bounty");
  s.level = 40; s.hpBonus = 6000; G.setHealth(s, G.maxHealth(s));
  const g1 = s.gold, a = LIVING.act(s, x.id);
  ok(!a.err && (a.died || (s.gold > g1 && x.st === "done" && LIVING.st(s).deeds.some((d) => d.k === "event"))), "dealt with it: " + (a.text || a.err));
  ok(LIVING.act(s, x.id).err, "only once");
  // live events go after two days
  const y = LIVING.st(s).wh.find((w) => w.st === "live"); if (y) { later(LIVING.LIVE_H + 1); LIVING.advance(s); ok(y.st === "gone", "moved on"); }
}
// every kind can come true and be dealt with; non-fight ones pay without a fight
{
  const seen = new Set();
  for (let i = 0; i < 400 && seen.size < Object.keys(LIVING.WH).length; i++) {
    const s = mk(["Whiterun", "Riften", "Windhelm", "Markarth", "Solitude", "Falkreath", "Dawnstar"][i % 7]);
    const r = LIVING.hearWhisper(s); if (!r.whisper) continue;
    const x = r.whisper; if (seen.has(x.k)) continue; seen.add(x.k);
    x.real = true; x.due = G.now(); LIVING.advance(s);
    s.location = x.place; [s.x, s.y] = WORLD.places[x.place]; s.level = 40; s.hpBonus = 6000; G.setHealth(s, G.maxHealth(s));
    const a = LIVING.act(s, x.id);
    ok(!a.err && clean(a.text), x.k + ": " + (a.text || a.err)); console.log("  " + x.k + " @ " + x.place + ": " + (a.died ? "died" : a.text));
    if (LIVING.WH[x.k].fight === false) ok(!a.fight && a.gold > 0, x.k + " needs no fight");
    else ok(!!a.fight, x.k + " is a fight");
  }
  ok(seen.size === Object.keys(LIVING.WH).length, "every kind of whisper turns up: " + [...seen]);
}
// a fair fight: a well-geared hero wins most, and nothing ends in a blow or two
{
  const res = {};
  for (const k of ["warband", "troll", "vampire", "dragon"]) for (let i = 0; i < 8; i++) {
    const s = mk(); s.level = k === "dragon" ? 30 : 20; s.skills["One-Handed"].lvl = k === "dragon" ? 80 : 60;
    G.give(s, "steel_sword"); G.equip(s, s.inv.find((x) => x.item === "steel_sword").id);
    const spot = Object.entries(WORLD.places).find(([nm, p]) => LIVING.WH[k].where.includes(p[2]) && (!LIVING.WH[k].match || LIVING.WH[k].match.test(nm)))[0];
    const x = { id: "t" + k + i, k, place: spot, hold: G.holdAt(WORLD.places[spot]), town: "Whiterun", heard: G.now(), due: G.now(), until: G.now() + 9999, real: true, st: "live", say: "" };
    LIVING.st(s).wh = [x]; s.location = spot; [s.x, s.y] = WORLD.places[spot];
    const a = LIVING.act(s, x.id), r = (res[k] = res[k] || { w: 0, n: 0, t: 0, min: 99 });
    r.n++; r.t += a.fight.turn; r.min = Math.min(r.min, a.fight.turn); if (!a.died) r.w++;
  }
  for (const [k, r] of Object.entries(res)) { console.log("  " + k + ": won " + r.w + "/" + r.n + ", " + (r.t / r.n).toFixed(1) + " turns (shortest " + r.min + ")"); ok(r.min >= 3, k + " is never over in a blow or two"); }
  ok(["warband", "troll", "vampire"].every((k) => res[k].w / res[k].n >= 0.5), "a geared level 20 wins most whisper fights");
}
// how often they come true; Town Crier
{
  let real = 0, N = 0;
  atHour(14);
  for (let i = 0; i < 300; i++) { const s = mk(); const r = LIVING.hearWhisper(s); if (r.whisper) { N++; if (r.whisper.real) real++; } }
  ok(N > 250 && real / N > 0.6 && real / N < 0.8, "about 70% come true by day (" + real + "/" + N + ")");
  const s = mk(); ok(LIVING.trueChance(s, 21) > LIVING.trueChance(s, 14), "evenings in a busy inn are better");
  s.perks = { good_ear: 1, town_crier: 1 }; ok(PFX.num(s, "whisper") === 0.2 && PFX.num(s, "jarlpay") === 0.25 && LIVING.trueChance(s, 14) > 0.85, "Town Crier");
  const t0 = G.now(), r = LIVING.hearWhisper(s);
  ok(r.whisper.due - t0 < LIVING.WH[r.whisper.k].hours[1] * 3600 / G.GAME_SPEED * 0.71, "Town Crier: sooner");
}

// 7. news of the realm
{
  const d = LIVING.dayNo();
  ok(JSON.stringify(LIVING.realm(d)) === JSON.stringify(LIVING.realm(d)) && LIVING.realm(d).every((x) => clean(x.x) && x.x.length > 10), "the talk of the day is the same on every phone");
  ok(LIVING.realm(d)[0].x !== LIVING.realm(d + 1)[0].x || LIVING.realm(d)[1].x !== LIVING.realm(d + 1)[1].x, "and changes day to day");
  const s = mk(); LIVING.news(s, "⚔", "Something happened");
  const f = LIVING.feed(s); ok(f.length >= 2 && f.every((a, i) => !i || f[i - 1].t >= a.t) && f.some((x) => x.x === "Something happened"), "the feed: newest first, yours and the realm's");
  ok(/Notice board/.test(LIVING.townHTML(s, "Whiterun", "inn", true)), "a notice board in the inn");
}

// 8. party: the leader's world is everyone's
atHour(19);
{
  const lead = mk(), mem = mk("Riften");
  lead.id = "L"; mem.id = "M";
  const party = { id: "p", leader: "L", members: [{ id: "L", name: "Lydia" }, { id: "M", name: "Mjoll" }] };
  LIVING.bindParty(party);
  const r = LIVING.hearWhisper(lead); ok(r.whisper, "the leader hears a whisper");
  const bits = LIVING.cardBits(lead, party); ok(bits.lw && bits.lw.w.length === 1 && bits.lw.w[0].real === undefined, "the leader's card carries the world (but not the answer)");
  ok(!Object.keys(LIVING.cardBits(mem, party)).length, "members publish nothing");
  LIVING.follow(mem, party, [{ id: "L", name: "Lydia", ...bits }]);
  ok(LIVING.isMember(mem) && LIVING.sharedFor(mem).from === "Lydia", "the member takes the leader's world");
  ok(RUMOURS.marks(mem).some((m) => m.id === r.whisper.id) && mem.discovered.includes(r.whisper.place), "the leader's whisper is on the member's map");
  ok(/party leader/.test(LIVING.hearWhisper(mem).err || ""), "members leave the asking to the leader");
  ok(/Lydia/.test(LIVING.panel(mem)), "World news says whose world it is");
  LIVING.news(lead, "🐉", "Leader news"); LIVING.follow(mem, party, [{ id: "L", name: "Lydia", ...LIVING.cardBits(lead, party) }]);
  ok(LIVING.feed(mem).some((x) => x.x === "Leader news"), "the leader's news reaches the member");
  LIVING.adopt(mem, { w: [{ k: "nope", place: "x" }, { k: "dragon", place: "Nowhere" }], n: [{ x: 5 }] }, "Lydia");
  ok(!LIVING.sharedFor(mem).w.length && !LIVING.sharedFor(mem).n.length, "junk from a card is ignored");
  LIVING.follow(mem, null, []); ok(!LIVING.isMember(mem) && !mem.lw.shared, "out of the party: your own world again");
  LIVING.bindParty(null);
}

// 9. both art styles; nothing breaks
{
  const s = mk();
  for (const style of ["ink", "pixel"]) {
    globalThis.ART = { style: () => style };
    const b = LIVING.boardArt(3), d1 = LIVING.doorArt(true), d0 = LIVING.doorArt(false);
    ok(/<svg/.test(b) && /<svg/.test(d1) && d1 !== d0 && (style === "pixel") === / px/.test(b), style + " pictures");
    for (const sec of ["inn", "streets", "general", "blacksmith"]) for (const h of [3, 12, 21]) { atHour(h); const html = LIVING.townHTML(s, "Whiterun", sec, G.shopsOpen()); ok(clean(html), style + " " + sec + " at " + h); }
  }
  delete globalThis.ART;
  ok(LIVING.townHTML(s, "Bleak Falls Barrow", "inn", true) === "", "nothing outside towns");
  ok(LIVING.tick(null) === "" && typeof LIVING.tick(s) === "string", "tick is safe");
}
// 10. in Polish: every sentence this module shows has a translation (i18n_living.js)
{
  const SPLIT = /(?<=[.!?…])\\s+|(?<=[.!?]["”])\\s+/;
  const missing = new Set();
  const dec = (t) => t.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const LABELS = new Set(["Listen", "Ask", "free", "Tomorrow", "Go in", "Whispered", "Make amends", "Go and see"]);
  const words = (t) => /[a-z]{2} [a-z]/.test(t) || LABELS.has(t.replace(/ · .*$/, ""));
  /* check plain text the way i18n.js sees it on screen: sentence by sentence */
  const pl = (text, where) => {
    const t = dec(String(text)).trim(); if (!t || !words(t)) return;
    if (I18N.tr(t) != null && !/[a-z]{2} [a-z]/.test(t.replace(/ · .*/, ""))) return;
    for (const frag of t.split(SPLIT)) { const x = (frag || "").trim(); if (x && words(x) && I18N.tr(x) == null) missing.add(x + "   <- " + where); }
  };
  /* text nodes of a piece of HTML */
  const plHTML = (html, where) => { for (const seg of String(html).replace(/<svg[\\s\\S]*?<\\/svg>/g, "").split(/<[^>]+>/)) pl(seg, where); };
  const P = "Riverwood";
  for (const [k, K] of Object.entries(LIVING.WH)) {
    const x = { place: P, g: 123, loot: "Iron Ingot, Leather" };
    for (const t of [...K.say, K.came, K.none, K.win]) pl(t.replace(/\\{p\\}/g, P).replace(/\\{g\\}/g, "123").replace(/\\{loot\\}/g, x.loot), "whisper " + k);
    pl(K.title, "title"); pl(K.icon + " " + K.title, "title");
    pl("The regulars lean in: “" + K.say[0].replace(/\\{p\\}/g, P) + "” Give it about 9 h and see. " + P + " is marked on your map. (15 gold for the round.)", "hearWhisper");
  }
  for (const d of LIVING.DOORS) { pl(d.name, "door"); pl(d.what, "door"); }
  for (const tb of Object.values(LIVING.SCHED)) for (const [, , , doing] of tb) { pl(doing, "doing"); pl("The trader is " + doing + ".", "doing"); }
  for (let day = 0; day < 40; day++) for (const r of LIVING.realm(day)) pl(r.x, "realm");
  // deeds, guard lines, news, standing words
  {
    atHour(12);
    const s = mk(); LIVING.watch(s);
    s.dragons = 2; TOWNS.addBounty(s, "Whiterun", "assault"); s.cvRoad = { robbed: { a: 1, b: 2 } }; LIVING.watch(s); delete s.bounty.Whiterun;
    for (const k of ["guard", "guard", "event", "event", "amends", "crime"]) LIVING.deed(s, k, "Whiterun");
    s.caravanJob = { id: "j", to: "Whiterun", name: "Ri'saad's caravan" }; s.location = "Riverwood"; LIVING.watch(s); s.caravanJob = null; s.location = "Whiterun"; pl(LIVING.watch(s), "watch");
    for (const nw of LIVING.st(s).news) pl(nw.x, "news");
    for (const l of LIVING.lines(s, "Whiterun")) pl(l, "lines");
    pl(LIVING.deedWords(s, "Whiterun").join(" · "), "deedWords");
    LIVING.deed(s, "rob", "Whiterun", -80); for (const l of LIVING.lines(s, "Whiterun")) pl(l, "lines");
    for (const h of [3, 12, 21]) { atHour(h); for (const sec of ["inn", "streets", "general", "blacksmith", "alchemy"]) plHTML(LIVING.townHTML(s, "Whiterun", sec, false), "townHTML " + sec + " " + h); }
    plHTML(LIVING.panel(s), "panel");
    pl(LIVING.amends(s).err || "", "amends");
    s.gold = 0; pl(LIVING.amends(s).err || "", "amends");
    pl(LIVING.hearWhisper(s).err || "", "hearWhisper"); pl(LIVING.useDoor(s, "guest").err || "", "door"); pl(LIVING.useDoor(s, "nope").err || "", "door");
    s.gold = 9999; pl(LIVING.amends(s).text || "", "amends"); pl(LIVING.amends(s).err || "", "amends");
    TOWNS.addBounty(s, "Whiterun", "assault"); pl(LIVING.amends(s).err || "", "amends"); delete s.bounty.Whiterun;
    RUMOURS.st(s).fame.Whiterun = 80;
    for (const id of ["store", "guest"]) { const r = LIVING.useDoor(s, id); pl(r.text || r.err, "door " + id); pl(LIVING.useDoor(s, id).err, "door again"); }
    atHour(21); pl(LIVING.askOpen(s, "general").text || "", "askOpen"); pl(LIVING.askOpen(s, "wizard").err || "", "askOpen"); atHour(12); pl(LIVING.askOpen(s, "general").err || "", "askOpen");
    atHour(20);
    for (let i = 0; i < 3; i++) { const r = LIVING.hearWhisper(s, G.now(), () => 0.01); pl(r.text || r.err, "hearWhisper"); later(13); }
    pl(LIVING.cantAsk(s, "Bleak Falls Barrow"), "cantAsk"); pl(LIVING.cantAsk(s, "Whiterun"), "cantAsk");
    plHTML(LIVING.panel(s), "panel with whispers");
    const x = LIVING.st(s).wh[0]; x.real = true; x.due = G.now() - 1; pl(LIVING.advance(s), "advance");
    pl(LIVING.act(s, x.id).err || "", "act away"); pl(LIVING.act(s, "nope").err || "", "act gone");
    s.location = x.place; [s.x, s.y] = WORLD.places[x.place]; plHTML(LIVING.card(s), "card"); plHTML(LIVING.panel(s), "panel live");
    const r = LIVING.act(s, x.id); pl(r.text, "act");
    later(100); LIVING.advance(s); for (const nw of LIVING.st(s).news) pl(nw.x, "news");
    for (const k of Object.keys(LIVING.WH)) pl(LIVING.WH[k].title.toLowerCase(), "lowercase title");
  }
  // the rumours.js hook and the perks
  pl("Nobody in this hold opens a door to you at night. Make amends first.", "knock");
  for (const id of ["town_crier", "low_profile", "well_met"]) { const p = PERKS.BY_ID[id]; ok(p, "perk " + id); pl(p.name, "perk"); I18N.tr(p.name) || missing.add(p.name); pl(p.desc.replace(/\\s*\\[[^\\]]*\\]\\s*$/, ""), "perk " + id); }
  for (const m of [...missing].slice(0, 30)) console.log("  no Polish: " + m);
  ok(!missing.size, "every sentence has Polish (" + missing.size + " missing)");
  // a few spot checks of the result
  ok(I18N.tr("Whispers of things to come") === "Szepty o tym, co nadejdzie", "heading");
  ok(I18N.tr("Make amends · 64") === "Zadośćuczyń · 64", "button with a price");
  ok(I18N.tr("Doors in Whiterun") === "Drzwi w Whiterun", "doors heading");
  ok(/^Smok znad Riverwood/.test(I18N.tr("The dragon over Riverwood flew on north. Nobody's seen it since.")), "a whisper that came to nothing");
  ok(/^Stali bywalcy nachylają się: „Pasterze widzieli smoka/.test(I18N.tr("The regulars lean in: “Shepherds saw a dragon circling over Riverwood. Round and round, like it's looking for somewhere to land.” Give it about 9 h and see.")), "a whisper, quoted");
  ok(I18N.tr("2 days 3 h ago") === "2 dni 3 h temu" && I18N.tr("5 h ago") === "5 h temu", "time ago");
  ok(I18N.tr("Mikael the bard") === "Mikael, bard" && I18N.tr("The trader is asleep.") === "Kupiec śpi.", "townsfolk");
  ok(I18N.tr("guarded 2 caravans · 1 dragon slain here") === "ochronione karawany: 2 · smoki zabite tutaj: 1", "deeds list");
  ok(I18N.tr("Lydia dealt with a dragon's roost at Riverwood.") === "Lydia zajął się smoczym gniazdem w Riverwood.", "news with a title inside");
}
console.log("livingworld ok · " + n + " checks");
`, c);
