const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// every place, town section and dungeon room has a drawer, and drawing never throws (fake 2D context)
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,localStorage:{getItem:()=>null,setItem:()=>{}}};vm.createContext(c);
const html=fs.readFileSync(W+"index.html","utf8"), files=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>!/ui\.js|p2pnet|app\.js|sound\.js|store\.js|backup\.js|^http/.test(f));
for(const f of files) { if(!fs.existsSync(W+f)) continue; try { vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c); } catch(e) { if(/placeart|art\.js/.test(f)) throw e; } }
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const grad={addColorStop(){}}; let calls=0;
const g=new Proxy({}, { get(t,k){ if(k==="createLinearGradient"||k==="createRadialGradient") return ()=>grad; if(k==="measureText") return ()=>({width:10}); if(typeof k==="string" && /^(fillStyle|strokeStyle|lineWidth|globalAlpha|font|textAlign|lineJoin|lineCap)$/.test(k)) return t[k]; return (...a)=>{ calls++; for(const v of a) if(typeof v==="number" && !Number.isFinite(v)) throw new Error("non-finite arg to "+String(k)); }; }, set(t,k,v){ t[k]=v; return true; } });
let n=0;
for (const name of Object.keys(WORLD.places)) {
  const d=PLACEART.drawerFor(name); ok(d && typeof d.draw==="function", "drawer for "+name);
  d.draw(g, ART.H, 360, 160, PLACEART.climateOf(name)); n++;
}
for (const k of Object.keys(PLACEART.SECTION)) { PLACEART.SECTION[k](g, ART.H, 360, 96); n++; }
for (const k of ["fight","elite","trap","treasure","puzzle","rest","mystery","boss"]) { ok(PLACEART.ROOM[k], "room "+k); PLACEART.ROOM[k](g, ART.H, 360, 96); n++; }
const themes=new Set(Object.keys(WORLD.places).map(p=>DUNGEONS.info(p)?.theme).filter(Boolean));
for (const t of themes) ok(PLACEART.THEME[t], "theme drawer "+t);
console.log("placeart ok ·", n, "pictures ·", calls, "draw calls · themes", [...themes].join(","));
`,c);
