const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const t=G.now(); console.log(JSON.stringify(WEVENTS.date(t)), JSON.stringify(WEVENTS.date(t+30*86400)));
const cnt={}; for(let i=0;i<500;i++){ const w=WEVENTS.weatherAt("Whiterun",t+i*1800).id; cnt[w]=(cnt[w]||0)+1; } console.log("Whiterun", JSON.stringify(cnt));
const cnt2={}; for(let i=0;i<500;i++){ const w=WEVENTS.weatherAt("Winterhold",t+i*1800).id; cnt2[w]=(cnt2[w]||0)+1; } console.log("Winterhold", JSON.stringify(cnt2));
const nr=WEVENTS.nextRaid(t); console.log("next raid", nr.town, Math.round((nr.start-t)/60),"min");
let found=0; for(let x=0;x<86400;x+=300) if(WEVENTS.activeRaid(t+x)) found++; console.log("raid-active 5-min slots per day:", found);
// solo raid
const s=G.newSave("me","Me","nord"); s.level=15; s.hpBonus=150; for(const sk of Object.values(s.skills)) sk.lvl+=30; G.give(s,"steel_sword"); G.equip(s,s.inv[s.inv.length-1].id); G.give(s,"potion_health",5);
const r=nr; s.location=r.town; let rounds=0, docs=[{raid:r.id,uid:"other",name:"Bjorn",dmg:250}];
while(rounds<20){ rounds++; G.setHealth(s,G.maxHealth(s)); const o=WEVENTS.fight(s,r,docs,(r.fightAt||r.start)+60); if(!o.fight){console.log(o.text);break;} console.log("round",rounds,"dealt",o.dealt,o.slain?"SLAIN":"",o.died?"died":""); if(o.slain||o.died) break; }
console.log(JSON.stringify(WEVENTS.tally(r,docs,s)), "souls", s.souls);
const s2=G.newSave("o","O","nord"); s2.raid={id:r.id,dmg:100,claimed:false}; console.log(WEVENTS.claim(s2,r,[{raid:r.id,uid:"me",name:"Me",dmg:900}]));
s.x=WORLD.places.Winterhold[0]; s.y=WORLD.places.Winterhold[1]; console.log("speed", G.speed(s).toFixed(1));
`,c);
