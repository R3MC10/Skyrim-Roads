const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
for (const [lvl, stage, place] of [[3,2,"Western Watchtower"],[6,2,"Western Watchtower"],[10,5,"Kynesgrove"],[15,5,"Kynesgrove"]]) {
  let w=0; for(let i=0;i<200;i++){ const s=G.newSave("x","X","nord"); s.level=lvl; s.hpBonus=(lvl-1)*6; for(const sk of Object.values(s.skills)) sk.lvl+=(lvl-1)*2; if(lvl>=6){G.give(s,"steel_sword");G.equip(s,s.inv[s.inv.length-1].id);G.give(s,"steel_armor");G.equip(s,s.inv[s.inv.length-1].id);G.give(s,"potion_health",3);} G.setHealth(s,G.maxHealth(s));
    s.quests={main:{stage,t:0}}; s.location=place; const r=QUESTS.talk(s,"main"); if(!r.died) w++; }
  console.log("level",lvl,place,"wins",w,"/200");
}`,c);
