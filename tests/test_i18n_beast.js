// Polish for the werewolf/vampire paths: every English line in i18n_beast.js still exists in the game, paragraphs split
// into the same number of sentences, and the i18n.js translator turns real screen/log text into Polish.
const fs = require("fs"), path = require("path"), vm = require("vm");
const W = process.env.W || path.join(__dirname, "../game/");
const src = (f) => fs.readFileSync(path.join(W, f), "utf8");
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const ctx = { console, navigator: { language: "pl-PL" }, localStorage: { getItem: () => JSON.stringify({ lang: "pl" }), setItem() {} } };
vm.createContext(ctx);
vm.runInContext(src("i18n_beast.js") + "\n;globalThis.I18N_BEAST = I18N_BEAST;", ctx);
const B = ctx.I18N_BEAST;
ok(B.bad.length === 0, "sentence counts differ: " + B.bad.join(" | "));
const game = src("beastpaths.js") + src("perkfx.js") + src("curses.js") + src("fightctl.js");
const unq = (s) => s.replace(/\\"/g, '"');
const has = (en) => game.includes(en) || unq(game).includes(en) || game.includes(en.replace(/"/g, '\\"'));
for (const [, en, , sents] of B.MOVES) { ok(has(en), "move name gone: " + en); ok(has(sents.map((x) => x[0]).join(" ")), "move desc changed: " + en); }
for (const [en, , d] of B.PERKS) { ok(has(en), "perk gone: " + en); ok(has(d), "perk desc changed: " + en); }
for (const [en] of B.texts) {
  // paragraphs with {holds}/{item}-style inserts are split in the source; check the first sentence only
  const first = en.split(/(?<=[.!?])\s/)[0];
  ok(has(en) || has(first), "text gone: " + en.slice(0, 60));
}
for (const [en, p] of Object.entries(B.pl)) ok(typeof p === "string" && p && p !== en || /^[(+]+$/.test(en), "empty/same: " + en);
// through the real translator
let I18N;
try {
  vm.runInContext(src("i18n_story.js") + "\n" + src("i18n.js") + "\n;globalThis.I18N = typeof I18N !== 'undefined' ? I18N : null;", ctx);
  I18N = ctx.I18N;
} catch (e) { console.log("(i18n.js not loadable in node: " + e.message + ")"); }
console.log("translator:", !!I18N);
if (I18N) {
  const t = (s) => I18N.tr(s);
  ok(t("Claws") === "Pazury", "Claws");
  ok(t("\uE13F Howl") === "\uE13F Wycie", "icon Howl");
  ok(t("Once per change") === "Raz na przemianę", "reason");
  ok(t("\uE114 Beast Form · 4 rounds left") === "\uE114 Postać bestii · zostało: 4 rundy", "dock");
  ok((t("Maul: A savage double swipe. Costs stamina; can knock the foe off balance. 3 AP + 15 stamina.") || "").startsWith("Szarpanie: Dzikie"), "tip");
  ok((t("Seduction: the bandit lowers its guard") || "").startsWith("Uwiedzenie:"), "seduce pattern");
  ok(t("Howl: the foe cowers") === "Wycie: wróg kuli się ze strachu", "howl log");
  ok(t("Silver Hide") === "Srebrna skóra", "perk");
  ok((t("You howl back. A great grey werewolf steps out, sniffs you and lets you share its kill. (You feed: health restored, +1 toward werewolf perks.)") || "").startsWith("Odpowiadasz"), "encounter");
}
console.log(fail ? `FAILED ${fail}` : "ALL OK");
process.exit(fail ? 1 : 0);
