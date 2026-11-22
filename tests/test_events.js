const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
let counts={}, errs=0, deaths=0, n=0;
for (let k=0;k<3000;k++){
  const s=G.newSave("p"+k,"T","nord"); s.gold=200;
  G.startTrip(s,"Whiterun",WORLD.places["Whiterun"]);
  const ev=G.startEvent(s); counts[ev.id]=(counts[ev.id]||0)+1;
  try {
    let guard=0;
    while (s.trip && s.trip.status==="event" && guard++<6) {
      const ch=G.eventChoices(s); if(!ch.length) throw "nochoices "+ev.id;
      const c = s.trip.event.shop ? "leave" : ch[Math.floor(Math.random()*ch.length)][0];
      const r=G.eventChoice(s,c); if(typeof r.text!=="string") throw "notext "+ev.id+" "+c; if(r.died)deaths++; n++;
      if (s.trip?.event?.shop) G.buyFrom(s, s.trip.event.shop[0]);
    }
    if (s.trip && s.trip.status==="event") throw "stuck "+ev.id+JSON.stringify(s.trip.event);
  } catch(e){ errs++; if(errs<5) console.log("ERR",e, e.stack); }
}
console.log(counts, "errors",errs,"deaths",deaths,"choices",n);
`,c);
vm.runInContext(`
const cnt={}; const s=G.newSave("x","T","khajiit"); s.gold=500;
for(let k=0;k<4000;k++){ const p=[Math.random(),Math.random()]; if(!Terrain.speedAt(p))continue; [s.x,s.y]=p; G.startTrip(s,"Whiterun",WORLD.places.Whiterun); const e=G.startEvent(s); cnt[e.id]=(cnt[e.id]||0)+1;
 for(const [c] of G.eventChoices(s)) { const s2=G.clone(s); const r=G.eventChoice(s2,c); if(typeof r.text!=="string") console.log("bad",e.id,c); } }
console.log(cnt);`,c);
