// avatar.js: your round painted portrait follows your race and sex (a Breton man never gets the Breton woman), the one
// you pick wins, junk picks are ignored, friends' portraits are cached for when they're offline, old saves need nothing.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs = require("fs"), vm = require("vm");
let fails = 0;
const ok = (cond, m) => { if (!cond) { fails++; console.log("FAIL", m); } };
const c = { console, Math, JSON, Object, Array, Set, Map, Number, String, RegExp,
  ASSETS: { url: (k) => (k.startsWith("bust-") ? k + ".webp" : ""), on: () => {} }, D: { RACES: { nord: { name: "Nord" }, breton: { name: "Breton" }, khajiit: { name: "Khajiit" } } } };
vm.createContext(c);
for (const f of ["bustart.js", "avatar.js"]) vm.runInContext(fs.readFileSync(__GAME + f, "utf8").replace(/^const (BUSTART|AVATAR) =/m, "var $1 ="), c);
const { AVATAR: A, BUSTART: B } = c;

// every race + sex gets a portrait of that sex
for (const r of B.RACES) for (const sx of ["m", "f"]) {
  const card = { race: r, app: { sx } };
  const p = A.auto(card);
  ok(A.valid(p), `${r}/${sx}: a known portrait (${p})`);
  ok(B.SEX[p] === sx, `${r}/${sx}: the portrait is of the hero's sex (${p} is ${B.SEX[p]})`);
  ok(p === (B.SEX[r] === sx ? r : r + "-" + sx), `${r}/${sx}: own race's bust`);
}
// the owner's report: a Breton man
ok(A.of({ race: "breton", app: { sx: "m" } }) === "breton-m", "a Breton man gets the Breton man");
ok(A.of({ race: "breton", sex: "f" }) === "breton", "a Breton woman gets the Breton bust");
// look-only cards (other players) and old saves
ok(A.of({ look: { r: "khajiit", a: { sx: "m" } } }) === "khajiit-m", "a card with only a look uses the exact Khajiit man");
ok(A.of({ race: "nord" }) === "nord", "an old save with no sex and no avatar: the automatic one");
ok(A.of({}) === "nord", "an empty card falls back to Nord");
// picking
const s = { race: "breton", app: { sx: "m" } };
ok(A.set(s, "redguard") && s.avatar === "redguard" && A.of(s) === "redguard", "a pick wins");
ok(A.cardBits(s).avatar === "redguard", "the pick rides on the player card");
A.set(s, "auto"); ok(!("avatar" in s) && A.cardBits(s).avatar === null, "Automatic clears it");
A.set(s, "<script>"); ok(!("avatar" in s), "junk ids are ignored");
ok(A.of({ race: "nord", avatar: "x\"><img" }) === "nord", "a junk avatar on someone's card is ignored");
// the picker lists race + sex first, all only on request
const opts = A.options({ race: "breton", app: { sx: "m" } }, false);
ok(opts[0].id === "breton-m" && opts[0].fit === "own", "picker: exact match first for a Breton man " + JSON.stringify(opts[0]));
ok(opts.every((o) => B.SEX[o.id] === "m"), "picker: only men until Show all");
ok(A.options({ race: "nord", sex: "m" }, true).length === A.IDS.length, "Show all lists every portrait");
ok(A.options({ race: "nord", sex: "m" }, false)[0].fit === "own", "picker: your own race first when it fits");
const g = A.grid({ race: "breton", app: { sx: "m" } }, "", false, (id) => `data-av="${id}"`);
ok(g.includes('data-av="auto"') && g.includes('aria-checked="true"'), "grid: Automatic is ticked when nothing is picked");
ok(g.includes("Show all portraits"), "grid: Show all button");
// friends: cache, face, silhouette
const me = { friends: { F1: { name: "Cora" }, F2: { name: "Eir" } } };
ok(A.remember(me, "F1", { id: "F1", race: "nord", sex: "f", avatar: "imperial" }) && me.friends.F1.pic === "imperial", "a friend's portrait is remembered");
ok(!A.remember(me, "F1", { id: "F1", race: "nord", sex: "f", avatar: "imperial" }), "no change when it's the same");
ok(!A.remember(me, "ZZ", { race: "nord" }), "only friends are remembered");
ok(!A.remember(me, "F2", null), "no card, nothing to remember");
ok(A.face(null, "imperial", 40).includes('data-bust="imperial"'), "an offline friend shows the cached portrait");
ok(A.face(null, undefined, 40).includes("avsil"), "never seen: a silhouette");
ok(A.face(null, "junk", 40).includes("avsil"), "a junk cache: a silhouette");
ok(A.face({ id: "F1", race: "khajiit", sex: "m" }, "imperial", 40).includes('data-bust="khajiit-m"'), "a live card beats the cache");
// sheet + hero
ok(A.sheet({ race: "nord" }).includes('data-act="avpick"') && A.sheet({ race: "nord" }).includes('data-act="avall"'), "the Character sheet picker has pick and Show all buttons");
ok(A.hero({ race: "breton", sex: "m" }, "", true).includes('data-bust="breton-m"') && A.hero({ race: "breton", sex: "m" }, "", true).includes('data-act="avatar"'), "Character sheet: a man, tappable");
ok(A.missing().length === 0 && A.IDS.length === 20, "all race and sex portraits are registered");
ok(A.of({ race: "nord", avatar: "redguard-f" }) === "redguard-f", "a new explicit picked portrait is valid");
ok(A.face(null, "redguard-f", 40).includes('data-bust="redguard-f"'), "an offline friend shows the new cached portrait");
ok(A.of({ race: "redguard-f" }) === "nord", "portrait IDs are not accepted as races");
ok(B.key("redguard-f") === "bust-redguard-f" && B.key("redguard-m") === null, "new IDs resolve without changing the original IDs");
ok(B.pick("breton").includes("bust-breton.webp"), "race picker keeps the original bust");


console.log(fails ? `${fails} FAILED` : "test_avatar OK");
process.exit(fails ? 1 : 0);
