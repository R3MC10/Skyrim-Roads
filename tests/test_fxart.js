const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// FXART: every festival decoration, every map effect and the travel strip draw without NaN (fake 2D context)
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,performance,localStorage:{getItem:()=>null,setItem:()=>{}}};vm.createContext(c);
const html=fs.readFileSync(W+"index.html","utf8"), files=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>!/ui\.js|p2pnet|app\.js|sound\.js|store\.js|backup\.js|^http/.test(f));
for(const f of files) { if(!fs.existsSync(W+f)) continue; try { vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c); } catch(e) { if(/fxart|skyart|art\.js/.test(f)) throw e; } }
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const grad={addColorStop(a,col){ if(!(a>=0&&a<=1)) throw new Error("bad stop "+a); }};
let calls=0, bad=0;
const num=(v)=>typeof v!=="number"||Number.isFinite(v);
const g=new Proxy({}, { get(t,k){ if(k==="createLinearGradient"||k==="createRadialGradient") return (...a)=>{ if(!a.every(num)) bad++; return grad; }; if(k==="measureText") return ()=>({width:10}); if(typeof k==="string" && /^(fillStyle|strokeStyle|lineWidth|globalAlpha|font|textAlign|textBaseline|lineCap|lineJoin|globalCompositeOperation|imageSmoothingEnabled|filter|lineDashOffset)$/.test(k)) return t[k]; return (...a)=>{ calls++; if(!a.every(num)) bad++; }; }, set(t,k,v){ if(k==="globalAlpha"&&!Number.isFinite(v)) bad++; t[k]=v; return true; } });
ok(typeof FXART!=="undefined","FXART loaded");
if (typeof MAPART!=="undefined") MAPART.glowSprite=()=>({});
// festivals: every id from festivals.js has decorations, on several towns and every section
const ids=FEST.EVENTS.map(e=>e.id);
for (const id of ids) ok(FXART.FESTS.includes(id), "festival covered: "+id);
for (const id of ids) { for (const town of ["Whiterun","Riverwood","Dawnstar","Riften"]) FXART.festDecor(g, ART.H, 360, 160, id, town);
  for (const sec of ["inn","blacksmith","general","wizard","market"]) FXART.festSection(g, ART.H, 360, 96, id, sec); }
FXART.force("midyear"); ok(FXART.festId()==="midyear","force"); FXART.force("none"); ok(FXART.festId()===null,"force none"); FXART.force(null);
ok(FXART.festId()===(FEST.active()?.id||null),"real festival");
// map effects
const S=G.newSave("A","Fx","dunmer"); S.location="Whiterun"; [S.x,S.y]=WORLD.places.Whiterun;
ok(FXART.state(S)===null,"nothing on → null");
const now=G.now(); S.fx=[{name:"Candlelight",key:"trapdodge",mag:15,until:now+999},{name:"Detect Life",key:"hide",mag:15,until:now+999},{name:"Muffle",key:"hide",mag:10,until:now+999}];
S.mark={x:0.5,y:0.5,place:"Whiterun",label:"Whiterun"}; S.rested=now+999; S.restBonus=0.1; S.vampire={stage:1}; S.werewolf=true;
FXART.cast("clairvoyance",{to:WORLD.places.Riften.slice(0,2)}); FXART.cast("recall",{from:[0.3,0.3],to:[0.5,0.5]}); FXART.cast("whirlwind",{from:[0.45,0.45]}); FXART.cast("transmute");
const st=FXART.state(S); ok(st && st.candle && st.detect && st.muffle && st.mark && st.rested && st.shots.length===4 && st.anim,"state "+JSON.stringify(st&&Object.keys(st)));
const P=(p)=>[p[0]*1000,p[1]*800];
for (const s of [0.5,1,2]) for (const reduce of [false,true]) { FXART.mapUnder(g, st, P, s, 500, 400, 12.3, reduce, {others:[{pos:[0.51,0.5]}], trail:[[0.5,0.5],[0.51,0.5],[0.52,0.51]]}); FXART.mapOver(g, {...st, vamp:true}, P, s, 500, 400, 12.3, reduce); }
ok(bad===0,"no NaN draw calls: "+bad);
// the walker and horse used by the travel strip
for (const riding of [false,true]) for (const carriage of [false,true]) FXART.walker(g, ART.H, 120, 72, 1.3, HEROART.lookOf(S), riding, carriage, "#6b4a2e");
ok(bad===0,"walker no NaN");
console.log("fxart ok · festivals "+ids.join(",")+" · calls "+calls);
`,c);
