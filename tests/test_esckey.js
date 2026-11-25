// Esc on a PC (desktop.js + pausemenu.js) and the folding world event card (gevstack.js):
// - Esc walks the back stack (__ui.back({ esc: true })) one step per press; only when nothing is left does the Esc menu open
// - typing: Esc clears a search box or leaves the box, nothing else
// - the Esc menu's rows (fight: nothing that quits; Quit game only in the Windows app), arrow moves skip greyed rows
// - the event stack: fold / unfold, × on a notice hides it until its news changes, remembered per hero, glow when new
// W=/path/to/game/ node test_esckey.js — prints "esckey ok".
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs");
let n = 0;
const ok = (c, m) => { n++; if (!c) throw new Error("FAIL " + m); };

const html = fs.readFileSync(__GAME + "index.html", "utf8");
for (const f of ["pausemenu.js", "gevstack.js", "i18n_esckey.js"]) ok(html.includes(`<script src="${f}">`), "index.html loads " + f);
const at = (f) => html.indexOf(`<script src="${f}">`);
ok(at("pausemenu.js") < at("fightctl.js") && at("pausemenu.js") < at("pcmap.js") && at("pausemenu.js") < at("bugreport.js"), "the Esc menu gets keys before the fight, the map and the report window");
ok(at("gevstack.js") < at("greatevents.js") && at("i18n_esckey.js") < at("i18n.js"), "gevstack before greatevents, Polish before i18n.js");

// ---------------------------------------------------------------- desktop.js: Esc → back stack → pause menu
const handlers = [];
global.addEventListener = (type, fn) => { if (type === "keydown") handlers.push(fn); };
global.document = { getElementById: () => null, querySelector: () => null };
let stack = [], pauseOpened = 0, inGame = true;
const calls = [];
global.window = { __ui: { back(o) { calls.push(o); return stack.length ? (stack.pop(), true) : false; }, inGame: () => inGame } };
global.PAUSEM = { open() { pauseOpened++; return true; } };
require(__GAME + "desktop.js");
const press = (key, target = { tagName: "DIV" }, extra = {}) => {
  const e = { key, target, defaultPrevented: false, repeat: false, ctrlKey: false, metaKey: false, altKey: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
  for (const h of handlers) h(e);
  return e;
};
stack = ["tooltip", "modal", "items menu", "compass"];
for (let i = 4; i > 0; i--) { press("Escape"); ok(stack.length === i - 1 && pauseOpened === 0, "Esc closes one layer at a time (" + (i - 1) + " left)"); }
ok(calls.every((o) => o && o.esc === true), "Esc asks the back stack with { esc: true }");
press("Escape"); ok(pauseOpened === 1, "nothing left to close: Esc opens the pause menu");
inGame = false; press("Escape"); ok(pauseOpened === 1, "no pause menu on the title screen"); inGame = true;
const before = calls.length;
press("Escape", { tagName: "DIV" }, { defaultPrevented: true }); ok(calls.length === before, "a key someone already handled (tooltip, fight menu, compass) isn't handled twice");
press("Escape", { tagName: "DIV" }, { repeat: true }); ok(calls.length === before, "holding Esc doesn't run through every layer");
let blurred = 0; const box = { tagName: "INPUT", type: "text", value: "hi", blur() { blurred++; } };
press("Escape", box); ok(blurred === 1 && calls.length === before && pauseOpened === 1, "typing: Esc leaves the text box and does nothing else");
let inputEv = 0; const sb = { tagName: "INPUT", type: "search", value: "iron", blur() { blurred++; }, dispatchEvent() { inputEv++; } };
global.Event = class { constructor(t) { this.type = t; } };
press("Escape", sb); ok(sb.value === "" && inputEv === 1 && blurred === 1, "Esc clears a search box first");
press("Escape", sb); ok(blurred === 2, "then leaves it");
global.document.getElementById = (id) => (id === "nickbox" ? {} : null);
press("Escape"); ok(calls.length === before, "the nickname box must be answered: Esc does nothing there");
global.document.getElementById = () => null;

// ---------------------------------------------------------------- pausemenu.js: rows
delete global.PAUSEM;
const PM = require(__GAME + "pausemenu.js");
const ids = (c) => PM.items(c).map((x) => x.id + (x.off ? "-" : ""));
ok(ids({ report: true, notes: true }).join() === "resume,settings,journal,notes,help,report,title", "map: Resume, Settings, Journal, Patch notes, How to play, Report, Save and quit " + ids({ report: true }));
ok(!ids({}).includes("quit") && ids({ desktop: true }).includes("quit"), "Quit game only in the Windows app");
ok(!ids({}).includes("report"), "no Report row without the report window");
const fight = PM.items({ fight: true, desktop: true, report: true });
ok(fight[0].id === "resume" && !fight.some((x) => x.id === "journal" || x.id === "help"), "fight: nothing that leaves the fight screen");
ok(fight.filter((x) => x.id === "title" || x.id === "quit").every((x) => x.off), "fight: Save and quit / Quit are greyed, no fleeing by accident");
const fi = fight.findIndex((x) => x.id === "title");
ok(PM.step(fight, fi - 1, 1) === 0, "arrow down skips greyed rows and wraps to Resume");
ok(PM.step(fight, 0, -1) === fi - 1, "arrow up from Resume wraps past greyed rows");
const list = PM.items({ report: true });
ok(PM.step(list, list.length - 1, 1) === 0 && PM.step(list, 2, 1) === 3, "arrows move one row and wrap");
ok(!PM.isOpen() && PM.open() === false, "no screen in node: open does nothing");

// ---------------------------------------------------------------- gevstack.js: fold, dismiss, remember
const GS = require(__GAME + "gevstack.js");
const disk = {}; GS._test.setStorage({ getItem: (k) => (k in disk ? disk[k] : null), setItem: (k, v) => { disk[k] = String(v); } });
const ev = { id: "gev-100", kind: "siege", name: "Siege of Markarth" };
const T0 = 1e9;
const parts = (o = {}) => ({ id: "hero1", ev, evKey: "gev-100:on", end: T0 + 2698, cdTxt: "44:58", banner: '<div class="gev-banner">siege</div>',
  strips: [{ key: "after:gev-90:lost", html: '<div class="gev-strip gev-after"><span>Morthal burned</span></div>' }, { key: "after:gev-91:lost", html: '<div class="gev-strip gev-after"><span>Windhelm burned</span></div>' }], ...o });
let h = GS.compose(parts(), T0, 0);
ok(h.includes("gevs-fold") && h.includes("siege") && h.includes("World news (2)") && !h.includes("Morthal") && !(h.match(/data-gevs="dismiss"/g) || []).length, "open: the card, a fold button and the notices folded into one World news (2) button");
ok(!h.includes("gevs-pill"), "starts unfolded");
let st = GS.load("hero1"); GS.setNews(st, true); GS.save("hero1", st);
h = GS.compose(parts(), T0, 0);
ok(h.includes("gevs-drawer") && h.includes("Morthal") && (h.match(/data-gevs="dismiss"/g) || []).length === 2 && h.includes('aria-expanded="true"'), "news drawer open: every notice with its ×");
GS.setNews(st, false); GS.save("hero1", st);
// [mapread] urgent notices (a claim, a ringleader) stay open on the card, economy news goes into the drawer
const sp = GS.split([{ key: "after:gev-1:lost" }, { key: "claim:gev-2" }, { key: "cr:fam:active:2" }, { key: "cr:fam:claim" }, { key: "cr:x:boss:5" }, { key: "y", urgent: true }, { key: "claim:z", urgent: false }]);
ok(sp.urgent.map((x) => x.key).join() === "claim:gev-2,cr:fam:claim,cr:x:boss:5,y" && sp.news.length === 3, "split: claims, ringleaders and flagged cards are urgent, the rest is news");
h = GS.compose(parts({ strips: [{ key: "claim:gev-5", html: '<div class="gev-strip"><span>Claim your reward</span></div>' }, ...parts().strips] }), T0, 0);
ok(h.includes("Claim your reward") && !h.includes("Morthal") && h.includes("World news (2)"), "an urgent card stays open beside the shut drawer");
h = GS.compose(parts({ ev: null, evKey: "", banner: "" }), T0, 0);
ok(h.includes("gevs-newspill") && !h.includes("gev-banner") && !h.includes("Morthal"), "no event, only news: a lone World news pill");
st = GS.load("hero1"); GS.setCollapsed(st, true); GS.save("hero1", st);
h = GS.compose(parts(), T0, 1000);
ok(h.includes("gevs-pill") && !h.includes("gev-banner") && h.includes("Siege of Markarth") && h.includes("2 notices") && h.includes("44:58") && h.includes(`data-gev-end="${T0 + 2698}"`), "folded: one pill with the event, its live clock and the notice count");
ok(!/[\u{1F300}-\u{1FAFF}⚔]/u.test(h.replace(/<span>[^<]*<\/span>/g, "")), "the pill and its buttons use drawn icons, not emoji");
ok(!h.includes("gevs-new"), "nothing new: the pill doesn't glow");
// a reload: state comes back from storage
GS._test.setStorage({ getItem: (k) => (k in disk ? disk[k] : null), setItem: (k, v) => { disk[k] = String(v); } });
ok(GS.load("hero1").c === true, "folded is remembered after a restart");
ok(GS.load("hero2").c === false, "per hero: another hero on this phone starts unfolded");
// a new event while folded: the pill glows for a while, it never pops open
h = GS.compose(parts({ ev: { ...ev, id: "gev-101" }, evKey: "gev-101:warn" }), T0, 5000);
ok(h.includes("gevs-pill") && h.includes("gevs-new"), "a new event glows on the folded pill instead of opening it");
ok(GS.compose(parts({ ev: { ...ev, id: "gev-101" }, evKey: "gev-101:warn" }), T0, 20000).includes("gevs-new") === false, "the glow stops after a few seconds");
// unfold, dismiss one notice
st = GS.load("hero1"); GS.setCollapsed(st, false); GS.setNews(st, true); GS.dismiss(st, "after:gev-90:lost", T0); GS.save("hero1", st);
h = GS.compose(parts(), T0, 30000);
ok(!h.includes("Morthal") && h.includes("Windhelm"), "× hides that notice only");
GS._test.setStorage({ getItem: (k) => (k in disk ? disk[k] : null), setItem: (k, v) => { disk[k] = String(v); } });
ok(!GS.compose(parts(), T0 + 60, 30000).includes("Morthal"), "it stays hidden after a restart");
ok(GS.compose(parts({ strips: [{ key: "after:gev-95:lost", html: '<div class="gev-strip"><span>Morthal burned again</span></div>' }] }), T0, 30000).includes("Morthal burned again"), "new news (another event) shows again");
ok(GS.compose(parts({ strips: [{ key: "after:gev-90:won", html: '<div class="gev-strip"><span>Morthal rebuilt</span></div>' }] }), T0, 30000).includes("Morthal rebuilt"), "changed news about the same place shows again");
// old dismissals are dropped; nothing at all → nothing shown
GS.compose(parts(), T0 + 6 * 86400, 30000); ok(!("after:gev-90:lost" in GS.load("hero1").d), "dismissals older than 5 days are forgotten");
st = GS.load("hero1"); GS.dismiss(st, "a", T0 + 6 * 86400); GS.dismiss(st, "b", T0 + 6 * 86400); GS.save("hero1", st);
ok(GS.compose(parts({ ev: null, evKey: "", banner: "", strips: [{ key: "a", html: "<div>x</div>" }, { key: "b", html: "<div>y</div>" }] }), T0 + 6 * 86400) === "", "everything hidden and no event: nothing on the map");
ok(GS.pillText(null, 1) === "1 notice" && GS.pillText(ev, 0) === "Siege of Markarth", "pill text: event and/or notices");
// storage blocked: still works for the session
GS._test.setStorage({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } });
st = GS.load("hero3"); GS.setCollapsed(st, true); GS.save("hero3", st);
ok(GS.compose(parts({ id: "hero3" }), T0, 0).includes("gevs-pill"), "storage blocked: folding still works until the game closes");

console.log("esckey ok · " + n + " checks");
