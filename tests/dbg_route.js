const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");const ctx={console,Math,Date,JSON,Set,Object,Array,String,Number,Uint8Array,Float32Array,Int32Array,Infinity,isFinite};vm.createContext(ctx);
for(const f of ["world.js","terrain.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (WORLD|Terrain) =/m,"globalThis.$1 ="),ctx);
const {WORLD,Terrain}=ctx;
let t=Date.now(); const p=Terrain.route(WORLD.places.Markarth,WORLD.places.Riften); console.log("route ms",Date.now()-t,"pts",p.length);
t=Date.now(); console.log("secs",Terrain.secondsLeft(p,0,p[0],0.5), "ms", Date.now()-t);
