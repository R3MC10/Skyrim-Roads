const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");const ctx={console,Math,Date,JSON,Set,Object,Array,String,Number,Uint8Array,Float32Array,Int32Array,Infinity,isFinite};vm.createContext(ctx);
const t0=Date.now();
for(const f of ["world.js","terrain.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (WORLD|Terrain) =/m,"globalThis.$1 ="),ctx);
const {WORLD,Terrain}=ctx; console.log("terrain built in",Date.now()-t0,"ms");
const counts={};for(const v of Terrain.grid)counts[Terrain.NAMES[v]]=(counts[Terrain.NAMES[v]]||0)+1;console.log(counts);
const pd=(a,b)=>Math.hypot((a[0]-b[0])*1000,(a[1]-b[1])*700);
const holdOf=(p)=>Object.keys(WORLD.holds).reduce((b,h)=>pd(p,WORLD.holds[h][1])<pd(p,WORLD.holds[b][1])?h:b);
for(const c of ["Solitude","Markarth","Whiterun","Windhelm","Riften","Dawnstar","Winterhold","Morthal","Falkreath","Riverwood","Helgen","Ivarstead","Rorikstead","Dragon Bridge","Karthwasten","Kynesgrove","Darkwater Crossing","Shor's Stone","Valtheim Towers","High Hrothgar"])console.log(c.padEnd(18),holdOf(WORLD.places[c]),Terrain.NAMES[Terrain.typeAtPos(WORLD.places[c])]);
const BASE=17.2*1.9/60; // px/s running at athletics 15 roughly
for(const [a,b] of [["Whiterun","Windhelm"],["Riverwood","Whiterun"],["Whiterun","Solitude"],["Markarth","Riften"],["Ivarstead","High Hrothgar"],["Whiterun","Bleak Falls Barrow"],["Windhelm","Winterhold"]]){
  const t1=Date.now(); const p=Terrain.route(WORLD.places[a],WORLD.places[b]); const ms=Date.now()-t1;
  let len=0;for(let i=1;i<p.length;i++)len+=pd(p[i-1],p[i]);
  const onRoad=p.filter(x=>Terrain.typeAtPos(x)===3||Terrain.typeAtPos(x)===4).length;
  console.log(`${a}->${b}: ${p.length} pts, ${len.toFixed(0)}px (straight ${pd(WORLD.places[a],WORLD.places[b]).toFixed(0)}), ${(Terrain.secondsLeft(p,0,p[0],BASE)/60).toFixed(1)} min, ${ms}ms, corners on road ${onRoad}/${p.length}`);
}
