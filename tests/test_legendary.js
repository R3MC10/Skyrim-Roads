const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Fair levelling: Legendary skills, fighting level, Etiquette/Streetwise base effects, skill text.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy, Number, String }; vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "legendary.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "horses.js", "hall.js", "bounty.js", "visits.js", "cooking.js", "arena.js", "market.js", "smithing.js", "social.js", "ammo.js", "tomes.js", "mp.js", "skillinfo.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); console.log("ok -", m); };
const s=G.newSave("L1","Leg","nord");
// --- Legendary
ok(LEGEND.make(s,"One-Handed").includes("must reach 100"),"can't make Legendary below 100");
s.skills["One-Handed"].lvl=100; s.skills["One-Handed"].xp=5;
s.perks={armsman:2}; const lvBefore=s.level, before=G.skill(s,"One-Handed");
ok(LEGEND.ready(s,"One-Handed"),"ready at 100");
const msg=LEGEND.make(s,"One-Handed");
ok(/Legendary/.test(msg),"message: "+msg);
ok(s.skills["One-Handed"].lvl===15 && s.skills["One-Handed"].xp===0,"reset to 15");
ok(s.perks.armsman===2,"perks kept");
ok(LEGEND.stars(s,"One-Handed")===1 && LEGEND.bonus(s,"One-Handed")===LEGEND.BONUS_PER_STAR,"one star, bonus");
ok(G.skill(s,"One-Handed")===15+LEGEND.BONUS_PER_STAR,"skill() includes the star bonus");
ok(s.level===lvBefore,"character level unchanged");
// raising it again feeds character level again
const cx=s.charXp; G.useSkill(s,"One-Handed",400); ok(s.skills["One-Handed"].lvl>15 && (s.charXp>cx || s.level>lvBefore),"levels again and moves char XP");
// bonus cap
s.legend["Archery"]=9; ok(LEGEND.bonus(s,"Archery")===LEGEND.MAX_BONUS,"bonus capped at "+LEGEND.MAX_BONUS);
ok(LEGEND.starText(2)==="★★" && LEGEND.starText(7)==="★★★★★×7","star text");
// progress view
const p=LEGEND.progress(s); ok(p.closest.length===3 && p.charNeed>0 && p.fightLevel>=1 && p.stars===10,"progress view data");
ok(p.rows.every(r=>r.pct>=0&&r.pct<=100&&!Number.isNaN(r.pct)),"progress percents sane");
// --- fighting level: crafting levels don't make the road harder
const fighter=G.newSave("F","Fi","nord"); fighter.level=40; fighter.skills["One-Handed"].lvl=90; fighter.skills["Heavy Armor"].lvl=85;
const crafter=G.newSave("C","Cr","nord"); crafter.level=40; crafter.skills["Smithing"].lvl=100; crafter.skills["Alchemy"].lvl=100; crafter.skills["Enchanting"].lvl=100;
ok(G.fightLevel(fighter)===40,"pure fighter fights at his level ("+G.fightLevel(fighter)+")");
ok(G.fightLevel(crafter)===24 && G.fightLevel(crafter)<crafter.level,"crafter fights at 60% of his level ("+G.fightLevel(crafter)+")");
const newbie=G.newSave("N","Nb","nord"); ok(G.fightLevel(newbie)===1,"new hero level 1");
const huge=G.newSave("H","Hu","nord"); huge.level=120; for(const k of D.ALL_SKILLS) huge.skills[k].lvl=100; ok(G.fightLevel(huge)===D.SCALE_LEVEL_CAP,"scaling stops at the cap");
const base={name:"Bandit",health:60,damage:8,tags:["humanoid"],level:6,danger:"low",gold:[1,2]};
ok(G.scaleEnemy(base,G.fightLevel(crafter)).health < G.scaleEnemy(base,G.fightLevel(fighter)).health,"crafter meets softer foes");
// gear still matters: same hero, better weapon -> more damage
const g1=G.newSave("G","Ge","nord"); g1.level=30; g1.skills["One-Handed"].lvl=70; g1.skills["Heavy Armor"].lvl=70;
const f1=new G.Fight(g1,{name:"-",health:1,damage:0,tags:[]}); let d1=0; for(let i=0;i<50;i++) d1+=f1.weaponDamage();
const star=JSON.parse(JSON.stringify(g1)); star.legend={"One-Handed":3}; const f2=new G.Fight(star,{name:"-",health:1,damage:0,tags:[]}); let d2=0; for(let i=0;i<50;i++) d2+=f2.weaponDamage();
ok(d2>d1,"Legendary stars add damage");
// --- Etiquette and Streetwise do something on their own
const e0=G.newSave("E","Et","breton"), e1=JSON.parse(JSON.stringify(e0)); e1.skills.Etiquette.lvl=100; e1.skills.Streetwise.lvl=100;
ok(TOWNS.trainCost(e1,"One-Handed")<TOWNS.trainCost(e0,"One-Handed"),"Etiquette: trainers cheaper");
ok(TOWNS.rumourPrice(e1)<TOWNS.rumourPrice(e0) && TOWNS.rumourPrice(e1)===5,"Streetwise: rumours cheaper");
const row={item:Object.keys(D.ITEMS).find(k=>D.ITEMS[k].value>=200&&!D.ITEMS[k].enchant),qty:1,stolen:true};
ok(G.sellPrice(e1,row)>G.sellPrice(e0,row) || G.skill(e1,"Mercantile")!==G.skill(e0,"Mercantile"),"Streetwise: fences pay more");
// --- skill text is clear and has no broken numbers
for(const sk of D.ALL_SKILLS){ const g=SKILLINFO.get(s,sk); ok(g.now.some(l=>/Next level|Legendary/.test(l)),"next-level line "+sk); for(const l of g.now) if(/NaN|undefined|Infinity/.test(l)) throw new Error("bad number "+sk+": "+l); }
ok(!/value is in its perks/.test(JSON.stringify(SKILLINFO.get(s,"Etiquette").now)),"Etiquette has its own effect");
// old saves without legend field
const old=G.newSave("O","Ol","nord"); delete old.legend; ok(G.skill(old,"Sneak")===old.skills.Sneak.lvl && LEGEND.total(old)===0,"old saves fine");
console.log("legendary ok");
`, c);
