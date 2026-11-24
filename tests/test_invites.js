// invites.js: the Accept / Decline cards, "declined" notes for the sender, clan declines, full parties, Polish lines.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
const c = { console, Math, Date, JSON, Object, Array, Set, Map, Number, String, RegExp, Promise, setTimeout, clearTimeout, setInterval, clearInterval };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "achievements.js", "clans.js", "social.js", "mp.js", "coop.js", "invites.js"])
  vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0;
c.ok = (cond, m) => { if (!cond) { fails++; console.log("FAIL", m); } };
vm.runInContext(`
const t = G.now(), a = G.newSave("A","Alfa","nord"), b = G.newSave("B","Beta","nord");
// --- cards from every kind of invite
const party = { id: "p1", leader: "A", leaderName: "Alfa", members: [{ id: "A", name: "Alfa" }], invites: ["B"], t };
const run = { id: "r1", leader: "A", leaderName: "Alfa", place: "Bleak Falls Barrow", members: [{ id: "A", name: "Alfa" }], invites: [{ id: "B", name: "Beta" }], status: "lobby", t };
const clan = { id: "A", name: "Sons", tag: "NORD", founderName: "Alfa", invites: ["B"], t };
const duel = { id: "d1", from: "A", fromName: "Alfa", to: "B", stake: 500, status: "open", t };
const trade = { id: "t1", from: "A", fromName: "Alfa", to: "B", ask: 50, status: "open", t, what: "Iron Sword" };
b.gold = 100;
let L = INVITES.list(b, { parties: [party], runs: [run], clans: [clan], duels: [duel], trades: [trade], gold: b.gold });
ok(L.length === 5, "five cards: " + L.map(x=>x.kind));
ok(["party","coop","clan","duel","trade"].every(k => L.some(x => x.kind === k)), "every kind has a card");
ok(new Set(L.map(x=>x.key)).size === 5, "unique keys");
ok(L.find(x=>x.kind==="party").text === "Alfa invites you to their party", "party text");
ok(L.find(x=>x.kind==="coop").text.includes("Bleak Falls Barrow"), "run text says where");
ok(L.find(x=>x.kind==="clan").text.includes("[NORD]"), "clan text has the tag");
const d = L.find(x=>x.kind==="duel"); ok(!d.can && d.why === "You need 500 gold", "can't take a 500 stake with 100 gold");
ok(L.find(x=>x.kind==="trade").can, "can afford a 50 gold trade");
// --- full party: the card says so, Accept still answers (ui.js then says it's full)
const full = { ...party, members: Array.from({ length: 8 }, (_, i) => ({ id: "m" + i, name: "M" + i })) };
const fc = INVITES.list(b, { parties: [full] })[0];
ok(fc.full && /full \\(8\\/8\\)/.test(fc.sub), "full party card: " + fc.sub);
ok(INVITES.MAX_PARTY === 8, "parties hold up to 8");
// --- declining a party / run leaves a note for the leader, once
const p2 = { ...party, invites: [], nos: INVITES.nos(party, b, t) };
const seen = new Set();
let n = INVITES.notes([p2], "A", seen, t - 60, "party");
ok(n.length === 1 && n[0] === "Beta declined your party invite.", "leader is told: " + n);
ok(INVITES.notes([p2], "A", seen, t - 60, "party").length === 0, "told only once");
ok(INVITES.notes([p2], "B", new Set(), 0, "party").length === 0, "only the leader is told");
ok(INVITES.notes([{ ...p2, nos: [{ id: "B", name: "Beta", t: t - 9999 }] }], "A", new Set(), t - 60).length === 0, "old notes stay quiet");
let many = party; for (let i = 0; i < 20; i++) many = { ...many, nos: INVITES.nos(many, { id: "x" + i, name: "X" + i }, t) };
ok(many.nos.length <= 8, "the note list stays short");
const r2 = COOP.decline(run, "B", "Beta", t);
ok(!r2.invites.length && r2.nos[0].name === "Beta", "co-op decline drops the invite and leaves a note");
ok(INVITES.notes([r2], "A", new Set(), t - 60, "coop")[0] === "Beta declined your dungeon invite.", "dungeon wording");
ok(!COOP.decline(run, "B").nos, "a full run's silent drop leaves no note");
// --- clan decline: hidden for the invitee, a note for the founder
INVITES.remember(b, "clan:A", t);
ok(INVITES.list(b, { clans: [clan] }).length === 0, "declined clan invite stays hidden");
INVITES.forgot(b, t + INVITES.NO_MEMORY + 5);
ok(INVITES.list(b, { clans: [clan] }).length === 1, "…but only for a day");
const cn = INVITES.clanNotes([{ id: "B", name: "Beta", clan: null, no: { clan: "A", t } }, { id: "C", name: "Cee", no: { clan: "Z", t } }], "A", new Set(), t - 60);
ok(cn.length === 1 && cn[0].fresh && cn[0].text === "Beta declined your clan invite.", "founder told about own clan only");
// --- notification ids are stable and in their own range
ok(INVITES.noteId("party:p1") === INVITES.noteId("party:p1") && INVITES.noteId("party:p1") >= 7000 && INVITES.noteId("party:p1") < 7900, "note ids");
// --- answering (no screen): once only, gone invites say so
let calls = 0, said = [];
INVITES.mount({ list: () => INVITES.list(b, { parties: [party] }), answer: async () => { calls++; }, toast: (x) => said.push(x) });
INVITES.refresh();
ok(INVITES.has("party:p1"), "has the party invite");
globalThis.__p = Promise.all([INVITES.answer("party:p1", true), INVITES.answer("party:p1", true)]).then(() => INVITES.answer("party:p1", true)).then(() => {
  ok(calls === 1, "double accept answers once: " + calls);
  return INVITES.answer("party:nope", true);
}).then((r) => { ok(r === false && said.includes("That invite is gone."), "gone invite"); });
`, c);
c.__p.then(() => {
  // --- Polish lines
  const ex = { words: {}, pat: [] };
  const ctx2 = { I18N_EXTRA: ex }; vm.createContext(ctx2);
  vm.runInContext(fs.readFileSync(__GAME + "i18n_invites.js", "utf8"), ctx2);
  const tr = (s) => { if (ex.words[s]) return ex.words[s]; for (const [re, f] of ex.pat) { const m = s.match(re); if (m) return f(m); } return null; };
  for (const s of ["Accept", "Decline", "Alfa invites you to their party", "Alfa asks you to raid Bleak Falls Barrow together", "Alfa invites you to the clan Sons [NORD]",
    "Alfa challenges you in the Windhelm Arena", "Alfa offers you a trade", "\uE106 Kacper declined your party invite.", "⚔ Kacper declined your dungeon invite.",
    "🏴 Kacper declined your clan invite.", "The party is full (8/8)", "That party is full (8 heroes at most).", "You declined Alfa's party invite.",
    "You declined the invite to Sons.", "You need 500 gold", "+2 more invites in \uE106 Social", "Invites you can answer right away"]) c.ok(tr(s), "Polish for: " + s);
  c.ok(tr("\uE106 Kacper declined your party invite.") === "\uE106 Kacper odrzuca twoje zaproszenie do drużyny.", "Polish decline note: " + tr("\uE106 Kacper declined your party invite."));
  // patch note on top
  const pn = fs.readFileSync(__GAME + "patchnotes.js", "utf8");
  { const ids = [...pn.slice(pn.indexOf("const LIST = [")).matchAll(/\{ id: "([^"]+)"/g)].slice(0, 40).map((m) => m[1]); c.ok(ids.some((x) => /^b\d+-invitebuttons$/.test(x)), "patch note near the top"); }
  { const ix = fs.readFileSync(__GAME + "index.html", "utf8"), a = ix.indexOf('<script src="invites.js">'), b = ix.indexOf('<script src="ui.js">'); c.ok(a > 0 && a < b, "invites.js loads before ui.js"); }
  c.ok(/<script src="i18n_invites.js"><\/script>[\s\S]*<script src="i18n.js">/.test(fs.readFileSync(__GAME + "index.html", "utf8")), "i18n_invites.js loads before i18n.js");
  if (fails) { console.log(fails + " failed"); process.exit(1); }
  console.log("invites ok");
  process.exit(0);
});
