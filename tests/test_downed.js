const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const s=G.newSave("x","X","nord"); s.gold=999; s.location="Rorikstead"; console.log(TOWNS.hire(s,"erik"));
let downs=0, gone=0; for(let i=0;i<200;i++){ s.hpBonus=400; G.setHealth(s,G.maxHealth(s)); const f=new G.Fight(s,G.scaleEnemy({...D.ENCOUNTERS.find(e=>e.name==="Giant")},1)); f.run({}); const m=f.apply(); if(f.followerDown){downs++; if(downs===1) console.log(m[0], "hp now", Math.round(s.follower.hp));} if(!s.follower) gone++; }
console.log("downed", downs, "/200 · lost the follower", gone, "times");
`,c);
