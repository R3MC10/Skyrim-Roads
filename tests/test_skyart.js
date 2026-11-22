const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// SKY: the shared sky state for many dates and places, and every tod × season × weather × north draws without NaN (fake 2D context)
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,localStorage:{getItem:()=>null,setItem:()=>{}}};vm.createContext(c);
const html=fs.readFileSync(W+"index.html","utf8"), files=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>!/ui\.js|p2pnet|app\.js|sound\.js|store\.js|backup\.js|^http/.test(f));
for(const f of files) { if(!fs.existsSync(W+f)) continue; try { vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c); } catch(e) { if(/skyart|art\.js/.test(f)) throw e; } }
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const grad={addColorStop(a,col){ if(!(a>=0&&a<=1)) throw new Error("bad stop "+a); }};
let calls=0, bad=0;
const num=(v)=>typeof v!=="number"||Number.isFinite(v);
const g=new Proxy({}, { get(t,k){ if(k==="createLinearGradient"||k==="createRadialGradient") return (...a)=>{ if(!a.every(num)) bad++; return grad; }; if(k==="measureText") return ()=>({width:10}); if(typeof k==="string" && /^(fillStyle|strokeStyle|lineWidth|globalAlpha|font|textAlign|textBaseline|lineCap|lineJoin|globalCompositeOperation|imageSmoothingEnabled|filter)$/.test(k)) return t[k]; return (...a)=>{ calls++; if(!a.every(num)) bad++; }; }, set(t,k,v){ if(k==="globalAlpha"&&!Number.isFinite(v)) bad++; t[k]=v; return true; } });
// state over a year of in-game days at several places
const seen={tod:new Set(),season:new Set(),weather:new Set()};
const t0=G.now();
for (let i=0;i<400;i++){ const t=t0+i*6700; for (const p of ["Whiterun","Winterhold","Riften","Markarth","Solitude"]) { const st=SKY.state(WORLD.places[p],t); ok(SKY.TODS.includes(st.tod),"tod "+st.tod); ok(SKY.SEASONS.includes(st.season),"season "+st.season); ok(typeof st.weather==="string","weather"); ok(st.snow>=0&&st.snow<=1,"snow"); ok(typeof st.key==="string","key"); seen.tod.add(st.tod); seen.season.add(st.season); seen.weather.add(st.weather); } }
ok(seen.tod.size===4 && seen.season.size===4, "all times and seasons happen: "+[...seen.tod]+" / "+[...seen.season]);
ok(SKY.state(WORLD.places.Winterhold).north && !SKY.state(WORLD.places.Riften).north, "north");
// every combination draws
let n=0;
for (const tod of SKY.TODS) for (const season of SKY.SEASONS) for (const weather of ["clear","cloudy","fog","rain","storm","snow","blizzard"]) for (const north of [false,true]) {
  const st=SKY.make({tod,season,weather,north,cold:north,moon:n%8});
  SKY.backdrop(g, ART.H, 360, 160, st, {seed:"t"+n}); SKY.overlay(g, ART.H, 360, 160, st, {seed:"t"+n, ground:110}); SKY.drawIcon(g, ART.H, 22, 22, st);
  const p=SKY.particles(st, 360, 160, {reduce:n%2===0}); for (let k=0;k<5;k++) p.step(g, 1/60);
  n++;
}
ok(bad===0, "no NaN draw calls: "+bad);
// overrides
const o=SKY.forOpts(WORLD.places.Whiterun,{mood:"night",weather:"snow",season:"winter"}); ok(o.tod==="night"&&o.weather==="snow"&&o.season==="winter"&&o.snow>0.5,"forOpts");
ok(SKY.mood(SKY.make({tod:"dawn"}))==="dusk","mood map");
// the pictures that use it still draw
if (typeof PLACEART!=="undefined") for (const nm of ["Whiterun","Windhelm","Bleak Falls Barrow","Riverwood"]) { const d=PLACEART.drawerFor(nm); d.draw(g, ART.H, 360,160, PLACEART.climateOf(nm)); }
console.log("skyart ok ·", n, "combinations ·", calls, "draw calls · weathers seen", [...seen.weather].join(","));
`,c);
