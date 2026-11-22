const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");const ctx={console,Math,Date,JSON,Set,Object,Array,String,Number,Uint8Array,Float32Array,Float64Array,Int32Array,Infinity,isFinite};vm.createContext(ctx);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (D|F|G|WORLD|Terrain) =/m,"globalThis.$1 ="),ctx);
const {D,G}=ctx;
for (const [label, hour] of [["day (10:00)", 10], ["night (22:00)", 22]]) {
  const base = 1795132800 + (hour - 8) * 3600 / 12 + 30 * 86400;   // a day/night start, trips last ~1/6 of a game day
  let res={arrived:0,died:0};
  for(let i=0;i<400;i++){const p=G.newSave("u"+i,"T",Object.keys(D.RACES)[i%10]);let tt=base;G.startTrip(p,"Windhelm",ctx.WORLD.places.Windhelm.slice(0,2),tt);
    for(let k=0;k<200;k++){tt+=180;const out=G.advance(p,tt);if(out.died){res.died++;break}if(out.arrived){res.arrived++;break}
      if(out.encounter){const e=out.encounter;const a=G.curHealth(p,tt)<60&&G.countRestore(p,"health")?"potion":e.danger==="high"?(Math.random()<.5?"flee":"sneak"):"fight";if(G.encounterAction(p,a,tt).died){res.died++;break}}}}
  console.log(label, "start:", G.clockText(base), res);
}
