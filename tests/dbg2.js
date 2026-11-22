const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");const ctx={console,Math,Date,JSON,Set,Object,Array,String,Number,Uint8Array,Float32Array,Int32Array,Infinity,isFinite};vm.createContext(ctx);
let src=fs.readFileSync(__GAME + "terrain.js","utf8");
src=src.replace("while (heap.length) {","let it=0; while (heap.length) { if(++it>2e6){console.log('too many iterations', heap.length); break;}");
src=src.replace("for (let i = goal; i !== -1; i = came[i]) cells.push(i);","for (let i = goal; i !== -1; i = came[i]) { cells.push(i); if(cells.length>1e5){console.log('cycle'); break;} }");
vm.runInContext(fs.readFileSync(__GAME + "world.js","utf8").replace(/^const WORLD =/m,"globalThis.WORLD ="),ctx);
vm.runInContext(src.replace(/^const Terrain =/m,"globalThis.Terrain ="),ctx);
const {WORLD,Terrain}=ctx;
let t=Date.now(); const p=Terrain.route(WORLD.places.Markarth,WORLD.places.Riften); console.log("route ms",Date.now()-t,"pts",p.length);
