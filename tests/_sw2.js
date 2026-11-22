const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","guilds.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","magic.js","guide.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const s=G.newSave("Z","Z","nord"); s.level=40; s.hpBonus=320; for(const k of Object.keys(s.skills)) s.skills[k].lvl=87; for(const i of ["steel_sword","steel_armor","steel_shield"]) console.log(G.equip(s,G.give(s,i))); G.setHealth(s,G.maxHealth(s));
const e=G.scaleEnemy({...QUESTS.L.brotherhood.stages[0].obj.fight},40); console.log("enemy",e.name,e.health,e.damage,e.level, "me hp",G.maxHealth(s));
const f=new G.Fight(s,e,null,G.now()); f.run({t:G.now()}); console.log("won",f.won, f.log.slice(0,8).join(" | "));
`,c);
