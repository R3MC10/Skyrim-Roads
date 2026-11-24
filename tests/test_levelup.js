// Levelling like Skyrim (levelup.js + engine.js): skill increases give character XP, level-ups bank, +10 choices,
// carry weight, perk points, old saves keep their level, and what other players see of you.
const fs = require("fs"), vm = require("vm"), path = require("path");
const W = process.env.W || path.join(__dirname, "../game/");
const c = vm.createContext({ console, Math, Date, JSON, Object, Array, Set, Map, Number, String });
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "respec.js", "powers.js", "engine.js", "levelup.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0;
const ok = (v, m) => { if (!v) { fails++; console.log("FAIL", m); } };
const { G, F, PERKS, LEVELUP } = c;
const fresh = () => vm.runInContext(`G.newSave("t" + Math.random(), "Test", "nord")`, c);

// ---- the formula
ok(F.charXpNeeded(1) === 100 && F.charXpNeeded(9) === 300, "(level + 3) × 25 per level");
ok(LEVELUP.xpTo(1) === 0 && LEVELUP.xpTo(2) === 100 && LEVELUP.xpTo(10) === 1800, "XP to level 10 is 1800: " + LEVELUP.xpTo(10));

// ---- events: every skill increase and every level is heard
const heard = { skill: [], level: [], choice: [] };
const offs = ["skill", "level", "choice"].map((k) => LEVELUP.on(k, (d) => heard[k].push(d)));
let s = fresh();
const sk = "One-Handed", before = s.skills[sk].lvl;
s.skills[sk].xp = F.skillXpNeeded(sk, before);   // exactly one increase
let msgs = G.useSkill(s, sk, 0);
ok(s.skills[sk].lvl === before + 1, "skill went up by one");
ok(msgs.some((m) => m === `${sk} increased to ${before + 1}`), "message: " + msgs.join(" | "));
ok(s.charXp === before + 1, `character XP = the new skill level (${s.charXp})`);
ok(heard.skill.length === 1 && heard.skill[0].skill === sk && heard.skill[0].lvl === before + 1 && heard.skill[0].s === s, "skill event");

// enough for a level: 100 XP at level 1
s.charXp = 95;
s.skills[sk].xp = F.skillXpNeeded(sk, s.skills[sk].lvl);
msgs = G.useSkill(s, sk, 0);
ok(s.level === 2 && s.pendingLevels === 1, `reached level 2 (${s.level}, pending ${s.pendingLevels})`);
ok(msgs.some((m) => /You reached level 2!/.test(m)), "level message");
ok(heard.level.length === 1 && heard.level[0].level === 2, "level event fired once with the new level");
ok(PERKS.pointsLeft(s) === 1, "one perk point per level");

// a skill book / trainer: +1 skill straight away, same XP rule
const lvB = s.skills.Alchemy.lvl, xpB = s.charXp;
const bm = G.raiseSkill(s, "Alchemy");
ok(s.skills.Alchemy.lvl === lvB + 1 && Math.abs(s.charXp - (xpB + lvB + 1)) < 1e-9, "raiseSkill: +1 and its character XP");
ok(Array.isArray(bm), "raiseSkill returns messages");
s.skills.Alchemy.lvl = 100; ok(G.raiseSkill(s, "Alchemy").length === 0 && s.skills.Alchemy.lvl === 100, "never past 100");

// a big jump banks several level-ups
s = fresh(); heard.level.length = 0;
s.charXp = LEVELUP.xpTo(5) - 1; s.skills.Smithing.lvl = 40;
G.raiseSkill(s, "Smithing");
ok(s.level === 5 && s.pendingLevels === 4, `banked 4 level-ups (level ${s.level}, pending ${s.pendingLevels})`);
ok(heard.level.map((d) => d.level).join() === "2,3,4,5", "one level event per level: " + heard.level.map((d) => d.level).join());
ok(PERKS.pointsLeft(s) === 4, "4 perk points");

// ---- the choices
const hp0 = G.maxHealth(s), mp0 = G.maxMagicka(s), sp0 = G.maxStamina(s), cap0 = G.capacity(s);
const ch = LEVELUP.choices(s);
ok(ch.length === 3 && ch.map((x) => x.attr).join() === "health,magicka,stamina", "three pillars");
ok(ch[0].next === hp0 + 10 && ch[1].next === mp0 + 10 && ch[2].next === sp0 + 10, "each pillar shows +10");
ok(/Carry weight/.test(ch[2].extra), "stamina pillar names carry weight");
ok(/\+10 health/.test(G.levelUp(s, "health")) && G.maxHealth(s) === hp0 + 10, "+10 health");
ok(G.levelUp(s, "magicka") && G.maxMagicka(s) === mp0 + 10, "+10 magicka");
const st = G.levelUp(s, "stamina");
ok(/\+10 stamina and \+5 carry weight/.test(st), "stamina message: " + st);
ok(G.maxStamina(s) === sp0 + 10 && G.capacity(s) === cap0 + 5, `stamina +10 and carry +5 (${G.capacity(s) - cap0})`);
ok(s.pendingLevels === 1, "one level-up still banked");
ok(/Choose/.test(G.levelUp(s, "luck")) && s.pendingLevels === 1, "unknown attribute is refused, nothing spent");
G.levelUp(s, "health");
ok(G.levelUp(s, "health") === "No level-up to spend.", "nothing to spend when none banked");
ok(heard.choice.length === 4, "choice events: " + heard.choice.length);
// in a fight the maximums are the new ones
const f = new G.Fight(s, { name: "-", health: 1, damage: 0, tags: [] });
ok(f.mp === G.maxMagicka(s) && f.sp === G.maxStamina(s), "fights start from the new maximums");

// ---- prompt on the Skills screens
const s2 = fresh(); ok(LEVELUP.promptHTML(s2) === "", "no prompt with nothing banked");
s2.pendingLevels = 2; const ph = LEVELUP.promptHTML(s2);
ok(/data-act="lvlpick"/.test(ph) && /2 level-ups waiting/.test(ph), "prompt opens the pillars and counts banked level-ups");

// ---- old saves keep their level
const old = fresh(); old.level = 17; old.charXp = 40; old.pendingLevels = 2; old.hpBonus = 80; old.perks = {};
ok(LEVELUP.migrate(old) === null && old.level === 17 && old.charXp === 40 && old.pendingLevels === 2 && old.hpBonus === 80, "a normal old save is untouched");
const odd = fresh(); odd.level = 6; odd.charXp = NaN; odd.pendingLevels = -3; odd.spBonus = undefined;
LEVELUP.migrate(odd);
ok(odd.level === 6 && odd.charXp === 0 && odd.pendingLevels === 0 && odd.spBonus === 0, "odd numbers tidied, level kept");
const over = fresh(); over.level = 3; over.charXp = F.charXpNeeded(3) + 10; over.pendingLevels = 0;
const om = LEVELUP.migrate(over);
ok(over.level === 4 && over.charXp === 10 && over.pendingLevels === 1 && /level 4/.test(om), "XP that already reached a level is spent");
const viaG = fresh(); viaG.level = 12; viaG.charXp = 30; viaG.pendingLevels = 1;
G.migrate && G.migrate(viaG);
ok(viaG.level === 12 && viaG.pendingLevels === 1, "G.migrate keeps the level");

// ---- what other players see
const pub = fresh(); pub.level = 4; pub.pendingLevels = 1; G.levelUp(pub, "magicka");
const cb = LEVELUP.cardBits(pub);
ok(Array.isArray(cb.vit) && cb.vit[1] === G.maxMagicka(pub) && cb.vit[0] === G.maxHealth(pub) && cb.vit[2] === G.maxStamina(pub), "card carries the three maximums");
ok(typeof cb.lvp === "number" && cb.lvq === 0, "card carries level progress and no waiting level-up");
ok(/♥\d+ ✦\d+ ⚡\d+/.test(LEVELUP.cardText({ vit: [110, 100, 120] })) && LEVELUP.cardText({}) === "", "roster text");
const ui = fs.readFileSync(W + "ui.js", "utf8"), tm = fs.readFileSync(W + "tabmenu.js", "utf8"), html = fs.readFileSync(W + "index.html", "utf8");
ok(/LEVELUP\.cardBits\(S\)/.test(ui), "publishCard sends the level bits");
ok(/LEVELUP\.cardText\(o\)/.test(ui), "roster shows other players' maximums");
ok(/LEVELUP\.mount\(/.test(ui), "ui.js mounts the level-up screens");
ok(/enterChar\("stars"\); if \(typeof LEVELUP/.test(tm), "Skills from the compass asks for a waiting level-up first");
ok(/tw-lvlready/.test(tm), "compass marks Skills with Level up");
ok(html.indexOf('src="levelup.js"') > 0 && html.indexOf('src="levelup.js"') < html.indexOf('src="ui.js"'), "levelup.js loads before ui.js");

// unsubscribe works
offs.forEach((o) => o());
const n0 = heard.skill.length; const s3 = fresh(); G.raiseSkill(s3, "Sneak");
ok(heard.skill.length === n0, "listeners can stop listening");
// a listener that throws never breaks levelling
const offBad = LEVELUP.on("level", () => { throw new Error("boom"); });
const s4 = fresh(); s4.charXp = 99; G.raiseSkill(s4, "Sneak"); offBad();
ok(s4.level === 2, "a broken listener can't stop a level-up");

console.log(fails ? `FAILED ${fails}` : "levelup ok");
process.exit(fails ? 1 : 0);
