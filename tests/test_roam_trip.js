const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","roam.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const s=G.newSave("A","Roamer","nord"); s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun.slice(0,2);
// a land point some way off the roads
const W=WORLD.places.Whiterun; let p=[W[0]+0.06,W[1]+0.05]; ok(ROAM.walkable(p)||ROAM.snap(p),"land");
const r=ROAM.plan(s,p); ok(!r.err && /^the (wilds|outskirts)/.test(r.name),"plan "+JSON.stringify(r));
ok(!G.startTrip(s,r.name,r.pos),"start"); ok(s.location===null,"left town");
const before=s.discovered.length; let t=G.now(), out={};
for(let i=0;i<400 && s.trip;i++){ t+=60; if(s.trip.status!=="travel"){ s.trip.status="travel"; s.trip.encounter=null; } out=G.advance(s,t,[]); }
ok(!s.trip && out.arrived===r.name,"arrived "+out.arrived); ok(s.location===null,"no town menus"); ok(Math.abs(s.x-r.pos[0])<1e-6,"at spot");
console.log("arrived:", r.name, "ground", r.ground, "discovered on the way", s.discovered.length-before, "around", ROAM.around(s).join(", "));
// water
let sea=null; for(let y=0.02;y<0.2&&!sea;y+=0.01) for(let x=0.1;x<0.9;x+=0.01){ if(Terrain.typeAtPos([x,y])===0){ sea=[x,y]; break; } }
const deep=[0.5,0.005]; const rw=ROAM.plan(s,deep); console.log("deep sea:", rw.err||rw.name, "snapped", rw.snapped);
const lakeP=(()=>{ for(let y=0.1;y<0.95;y+=0.004) for(let x=0.05;x<0.95;x+=0.004) if(Terrain.typeAtPos([x,y])===1) return [x,y]; })();
if(lakeP){ const rl=ROAM.plan(s,lakeP); ok(!rl.err && rl.snapped && ROAM.walkable(rl.pos),"lake snaps to shore"); }
ok(ROAM.plan(s,[1.5,0.5]).err,"off map");
// discovery along an off-road path: walk straight into the hidden region near a hidden place
const hid=[...WORLD.hidden].find(n=>!s.discovered.includes(n)); const hp=WORLD.places[hid];
const s2=G.newSave("B","b","nord"); [s2.x,s2.y]=[hp[0]+0.07,hp[1]]; s2.location=null;
const r2=ROAM.plan(s2,[hp[0]-0.002,hp[1]+0.003]); ok(!r2.err,"plan2"); G.startTrip(s2,r2.name,r2.pos); let t2=G.now();
for(let i=0;i<400&&s2.trip;i++){ t2+=60; if(s2.trip.status!=="travel"){ s2.trip.status="travel"; s2.trip.encounter=null;} G.advance(s2,t2,[]); }
ok(s2.discovered.includes(hid),"discovered "+hid+" on the way");
// save/load mid-trip
const s3=G.newSave("C","c","nord"); [s3.x,s3.y]=WORLD.places.Riften.slice(0,2); const r3=ROAM.plan(s3,[WORLD.places.Riften[0]-0.05,WORLD.places.Riften[1]-0.04]); G.startTrip(s3,r3.name,r3.pos); s3.trip.roam=true;
let t3=G.now(); for(let i=0;i<3;i++){ t3+=60; G.advance(s3,t3,[]); }
const s4=JSON.parse(JSON.stringify(s3)); G.migrate&&G.migrate(s4); let tt=t3; for(let i=0;i<400&&s4.trip;i++){ tt+=60; if(s4.trip.status!=="travel"){ s4.trip.status="travel"; s4.trip.encounter=null;} G.advance(s4,tt,[]); }
ok(!s4.trip && s4.x===r3.pos[0],"reloaded trip arrives");
console.log("roam ok · discovered", hid);
`,c);
