const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const s=G.newSave("x","X","nord"); s.gold=2000; s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun;
console.log(TOWNS.hire(s,"lydia")); G.give(s,"dragonstone"); console.log(TOWNS.deliverDragonstone(s)); console.log(TOWNS.hire(s,"lydia"), G.capacity(s));
console.log(TOWNS.rideCarriage(s,"Windhelm"), s.trip && s.trip.speed, G.minutesLeft(s).toFixed(1)+" min");
// simulate carriage trip: no encounters
let enc=0; const t0=G.now(); for(let k=1;k<200 && s.trip;k++){ const o=G.advance(s,t0+k*30,[]); if(o.encounter) enc++; } console.log("arrived", s.location, "encounters", enc);
// follower fights & death
let deaths=0, wins=0; for(let i=0;i<300;i++){ const a=G.clone(s); a.location=null; const f=new G.Fight(a,G.scaleEnemy({...D.ENCOUNTERS.find(e=>e.name==="Frost troll")},1)); f.run({}); const m=f.apply(); if(f.won)wins++; if(!a.follower) deaths++; if(i===0) console.log(f.log.slice(0,3).map(l=>l.me+" / "+l.them).join(" | ")); }
console.log("vs frost troll with Lydia: wins",wins,"/300, Lydia died",deaths);
let w2=0; for(let i=0;i<300;i++){ const a=G.clone(s); a.follower=null; const f=new G.Fight(a,G.scaleEnemy({...D.ENCOUNTERS.find(e=>e.name==="Frost troll")},1)); f.run({}); if(f.won)w2++; } console.log("without Lydia:", w2);
// dungeon boss with follower -> no party chest
const d=G.clone(s); d.trip=null; d.location="Bleak Falls Barrow"; [d.x,d.y]=WORLD.places["Bleak Falls Barrow"]; DUNGEONS.enter(d); let pc=false,g=0;
while(d.dungeon && !d.dungeon.done && g++<60){ if(!d.dungeon.room){DUNGEONS.enterRoom(d,DUNGEONS.nextChoices(d)[0]);continue;} const ch=DUNGEONS.roomChoices(d)[0][0]; const r=DUNGEONS.act(d,ch==="potion"?"fight":ch); if(r.partyChest) pc=true; if(r.died)break; }
console.log("dungeon done", !!(d.dungeon&&d.dungeon.done), "party chest?", pc, "follower", d.follower && d.follower.hp);
console.log(TOWNS.dismiss(s));
`,c);
