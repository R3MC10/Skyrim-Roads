const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Reminders (remind.js): the ready / soon / ending list from every system, tab badges, the Today card,
// and phone notifications with per-kind switches and the daily cap.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const mem = {};
const localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String, localStorage };
vm.createContext(c);
const files = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js",
  "cooking.js", "smithing.js", "ammo.js", "gather.js", "halls.js", "homestead.js", "horses.js", "bounty.js", "festivals.js", "market.js", "social.js", "caravans.js", "rumours.js", "worldevents.js", "mp.js", "remind.js"];
for (const f of files) if (fs.existsSync(W + f)) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c, { filename: f });
c.__mem = mem;
vm.runInContext(`
let pass = 0;
const ok = (v, m) => { if (!v) throw new Error("FAIL " + m); pass++; };
const t = G.now();
const S = G.newSave("rm1", "Remy", "nord"); S.location = "Riverwood"; [S.x, S.y] = WORLD.places.Riverwood;
const keys = () => REMIND.list(S, {}, t).map((x) => x.key);
const item = (k, tt = t) => REMIND.list(S, {}, tt).find((x) => x.key === k);

// a fresh character: nothing waiting except maybe world events
ok(!REMIND.list(S, {}, t).some((x) => x.state === "ready" && x.kind !== "events"), "fresh save has nothing ready");

// level up and perk points -> Hero badge
S.pendingLevels = 1;
ok(item("lvl") && item("lvl").tab === "hero", "level up listed for Hero");
ok(REMIND.badge("hero", S, {}) >= 1 && REMIND.badge("char", S, {}) >= 1, "hero/compass badge counts it");
S.pendingLevels = 0;

// house garden: ripe, then soon after a harvest
S.homes = { Whiterun: { chest: [], garden: 0 } };
let g = item("garden:Whiterun");
ok(g && g.state === "ready" && g.place === "Whiterun", "garden ready");
ok(g.tab === "map" && g.go.place === "Whiterun", "away from home: Go picks the town on the map");
S.location = "Whiterun";
g = item("garden:Whiterun");
ok(g.tab === "town" && g.go.tab === "town" && g.go.shop === "home", "at home: Go opens Town -> Your home");
S.homes.Whiterun.garden = t - 600;
g = item("garden:Whiterun");
ok(g.state === "soon" && Math.abs(g.at - (t - 600 + 7200)) < 1, "garden soon after harvest");
ok(!REMIND.shown(S, {}, t).some((x) => x.key === "garden:Whiterun"), "garden far off is hidden from the card");
ok(REMIND.shown(S, {}, t + 6000).some((x) => x.key === "garden:Whiterun"), "garden within the hour shows as coming up");

// homestead wings
S.homestead = { pinewatch: { small: t - 9e4, hall: t - 9e4, wings: ["kitchen"], col: { kitchen: t - HOMESTEAD.DAY - 10 }, stock: {} } };
let h = item("hs:pinewatch");
ok(h && h.state === "ready" && h.place === "Falkreath" && h.go.place === "Falkreath", "homestead goods ready");
S.homestead.pinewatch.col.kitchen = t - 3 * HOMESTEAD.DAY;
ok(/full/.test(item("hs:pinewatch").sub), "homestead full warning");
S.homestead.pinewatch.col.kitchen = t - 100;
h = item("hs:pinewatch"); ok(h.state === "soon" && Math.abs(h.at - (t - 100 + HOMESTEAD.DAY)) < 1, "homestead next goods time");

// horse resting at the stables
S.horse = { name: "Frost", coat: "grey", hp: 10, away: { town: "Whiterun", until: t + 300 } };
let ho = item("horse"); ok(ho && ho.state === "soon", "horse resting");
ho = item("horse", t + 400); ok(ho.state === "ready" && ho.go.shop === "stables" && ho.tab === "town", "horse ready to fetch");
S.horse.away = null; ok(!item("horse"), "horse with you: nothing");

// caravan you signed on with
S.caravanJob = { id: "cv-1", line: "x", name: "Nord wagons", from: "Solitude", to: "Whiterun", depart: t + 900, arrive: t + 3000, status: "signed" };
let cv = item("caravan"); ok(cv && cv.state === "ending" && cv.tab === "map" && cv.go.place === "Solitude", "caravan leaving, not in town");
S.caravanJob.status = "road"; ok(!item("caravan"), "caravan on the road: nothing");

// courier trades and stall gold (data that ui.js holds)
const ctx = { trades: [{ id: "tr1", to: S.id, fromName: "Kas", status: "open", courier: true, arrive: t + 120 }, { id: "tr2", to: "other", status: "open" }],
  stalls: [{ id: "st1", seller: S.id, status: "sold", row: {} }, { id: "st2", seller: S.id, status: "open", row: {} }] };
let L = REMIND.list(S, ctx, t);
ok(L.find((x) => x.key === "trade:tr1").state === "soon", "courier on the way");
ok(!L.find((x) => x.key === "trade:tr2"), "someone else's trade ignored");
ok(L.find((x) => x.key === "stall") && /1 thing/.test(L.find((x) => x.key === "stall").title), "one sold stall listing");
L = REMIND.list(S, ctx, t + 200);
ok(L.find((x) => x.key === "trade:tr1").state === "ready" && L.find((x) => x.key === "trade:tr1").tab === "social", "courier arrived -> Friends");
ok(REMIND.badge("social", S, { trades: ctx.trades.map((d) => ({ ...d, arrive: t - 1 })) }) === 1, "Friends badge counts the offer");

// bounty board reward
const w = BOUNTY.week(), kind = BOUNTY.goalsFor(w)[0];
BOUNTY.setDocs([{ uid: S.id, name: S.name, week: w, c: { [kind]: BOUNTY.GOALS[kind].target } }], S);
let b = item("bounty:" + w + ":" + kind); ok(b && b.state === "ready" && b.go.jtab === "misc" && b.go.anchor === "j-bounty", "bounty claimable");
ok(REMIND.badge("log", S, {}) >= 1 && REMIND.badge("journal", S, {}) >= 1, "Journal badge");
S.bountyClaimed = { [w + ":" + kind]: true }; ok(!item("bounty:" + w + ":" + kind), "claimed bounty gone");

// rumour lead and cleared place
S.rw = { list: [{ id: "rw1", kind: "bandits", place: "Bleak Falls Barrow", town: "Riverwood", until: t + 1200, say: "x" }] };
const lead = item("lead:rw1"); ok(lead && lead.state === "ending" && lead.go.place === "Bleak Falls Barrow", "rumour lead");
S.cleared = { "Bleak Falls Barrow": t - DUNGEONS.REFILL_SECONDS - 60, "Embershard Mine": t - DUNGEONS.REFILL_SECONDS + 600, "Old Place": t - DUNGEONS.REFILL_SECONDS - 9e4 };
ok(item("place:Bleak Falls Barrow").state === "ready", "cleared place full again");
ok(item("place:Embershard Mine").state === "soon", "cleared place soon");
ok(!item("place:Old Place"), "long-ago reopened place isn't news");

// hall coffer
S.hall = { town: "Whiterun", staff: { steward: 1 }, coffer: 0 };
if (HALLS.wages(S.hall) > 0) ok(item("coffer") && item("coffer").go.shop === "halls", "hall coffer warning");
S.hall.coffer = 1e6; ok(!item("coffer"), "full coffer: nothing");

// world events: whatever is running shows up with an end time
const act = WORLDEV.active(t).filter((e) => e.kind !== "fest");
for (const e of act) ok(item("wev:" + e.id) && item("wev:" + e.id).at === e.end, "running event " + e.id);

// sort order: ready first
L = REMIND.list(S, ctx, t);
const rk = { ready: 0, ending: 1, soon: 2 };
ok(L.every((x, i) => i === 0 || rk[L[i - 1].state] <= rk[x.state]), "ready, then ending, then soon");

// the Today card
const html = REMIND.card(S, ctx);
ok(/rmd-card/.test(html) && /data-rmd="go"/.test(html) && /Today/.test(html), "Today card renders");
ok(!/<script/i.test(REMIND.card(Object.assign({}, S, { homes: { "<script>": { garden: 0 } } }), {})), "card escapes text");
ok(REMIND.card(Object.assign({}, S, { dungeon: { place: "x" } }), ctx) === "", "no card inside a dungeon");

// notifications: kinds, switches, daily cap, nothing twice
S.homes = { Whiterun: { garden: t - 7000 }, Riften: { garden: t - 6000 }, Markarth: { garden: t - 5000 }, Windhelm: { garden: t - 4000 }, Solitude: { garden: t - 3000 } };
S.horse = { name: "Frost", away: { town: "Whiterun", until: t + 900 } };
S.caravanJob = { id: "cv-2", name: "Nord wagons", from: "Whiterun", to: "Solitude", depart: t + 3600, status: "signed" };
const nowMs = t * 1000;
let N = REMIND.notes(S, nowMs, ctx);
ok(N.length > 0 && N.every((n) => REMIND.NOTE_IDS.includes(n.id) && n.at > nowMs && n.title && n.body), "notes well formed");
ok(new Set(N.map((n) => n.id)).size === N.length, "unique ids");
const perDay = {}; for (const n of N) { const d = new Date(n.at).toDateString(); perDay[d] = (perDay[d] || 0) + 1; }
ok(Object.values(perDay).every((v) => v <= REMIND.CAP), "at most CAP a day: " + JSON.stringify(perDay));
ok(N.find((n) => /Your caravan/.test(n.title)) && N.find((n) => /Your caravan/.test(n.title)).at === (t + 3600 - 600) * 1000, "caravan reminder 10 min early");
ok(!N.some((n) => /lead goes cold/.test(n.body)), "rumours off by default");
// switch caravans off
const prefs = { rmd_caravan: false, rmd_rumours: true };
localStorage.setItem("rotn_prefs", JSON.stringify(prefs));
REMIND.resumed(nowMs - 1);   // came back before any went off
N = REMIND.notes(S, nowMs, ctx);
ok(!N.some((n) => /Your caravan/.test(n.title)), "caravan switched off");
ok(REMIND.kindOn("rumours") && !REMIND.kindOn("caravan"), "kindOn reads prefs");
// the ones that went off count toward today's cap and don't repeat
const first = N.map((n) => n.title + "@" + n.at);
REMIND.resumed(nowMs + 864e5 * 0.9);   // came back much later: everything fired
const later = REMIND.notes(S, nowMs + 864e5 * 0.9 - 1000, ctx);
ok(!later.some((n) => first.includes(n.title + "@" + n.at)), "fired reminders don't repeat");
localStorage.setItem("rotn_prefs", "{}");

// settings rows
const seg = (k, o, cur) => "<seg " + k + " " + cur + ">";
const sh = REMIND.settingsHTML(seg);
ok(Object.keys(REMIND.KINDS).every((k) => sh.includes("rmd_" + k)), "a switch per kind");
ok(REMIND.fmt(30) === "under a minute" && REMIND.fmt(600) === "10 min" && REMIND.fmt(3900) === "1 h 5 min", "time text");
console.log("remind ok", pass, "checks");
`, c);
