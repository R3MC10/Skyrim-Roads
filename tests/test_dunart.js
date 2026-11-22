const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","art.js","dunart.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
let calls=0, bad=[];
const grad={addColorStop(){}};
const g=new Proxy({},{get(t,k){ if(k==="createLinearGradient"||k==="createRadialGradient") return (...a)=>{ a.forEach(v=>{ if(typeof v==="number"&&!isFinite(v)) bad.push(k); }); return grad; };
  if(k==="setLineDash"||k==="save"||k==="restore") return ()=>{}; return (...a)=>{ calls++; a.forEach(v=>{ if(typeof v==="number"&&!isFinite(v)) bad.push(k); }); }; }, set(){ return true; }});
const themes=[...Object.keys(DUNGEONS.THEMES),"giantcamp","lair"];
for (const th of themes) { if(!DUNART.TH[th]) throw new Error("FAIL no colours for theme "+th);
  for (const ty of DUNART.TYPES) { DUNART.symbol(g, ART.H, ty, 20, 20, 11, th); DUNART.chamber(g, ART.H, th, 20, 20, 17, "#555", "#222", th+ty); }
  for (let tier=1; tier<=3; tier++) for (const st of ["start","mid","done"]) {
    const rows = (th==="giantcamp"||th==="lair") ? [[{type:"boss",links:[]}]] : DUNGEONS.layout(th==="banditcamp"?"cave":th, tier);
    const d={place:"Test "+th, theme:th, tier, rows, row:-1, col:0, room:null, path:[], found:[], gold:0};
    if (st!=="start") { d.row=Math.min(1,rows.length-1); d.col=0; d.path=[[0,0]].concat(d.row>0?[[1,0]]:[]); }
    if (st==="done") { d.row=rows.length-1; d.done=true; }
    const nx=new Set(DUNGEONS.nextChoices({dungeon:d}).map(c2=>(d.row+1)+":"+c2));
    DUNART.drawMap(g, ART.H, DUNART.W, DUNART.heightOf(rows), d, nx);
  } }
for (const ty of ["fight","elite","trap","treasure","puzzle","rest","mystery","boss"]) if(!DUNART.TYPES.includes(ty)) throw new Error("FAIL type "+ty);
if (bad.length) throw new Error("FAIL non-finite numbers in "+[...new Set(bad)].join(","));
console.log("dunart ok · themes", themes.length, "· draw calls", calls);
`,c);
