const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// TRAVELART: the travel strip paints every region, sky, weather, a big party and every destination kind
// without NaN draw calls (fake 2D context + fake canvases)
const fs=require("fs"),vm=require("vm");
const W=__GAME;
let style="ink";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Uint8ClampedArray,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,performance,
  localStorage:{getItem:(k)=>k==="rotn_prefs"?JSON.stringify({artStyle:style}):null,setItem:()=>{}}};
vm.createContext(c);
let bad=0, calls=0, badWhere="";
const num=(v)=>typeof v!=="number"||Number.isFinite(v);
const grad={addColorStop(a){ if(!(a>=0&&a<=1)) { bad++; badWhere="stop "+a; } }};
function ctx2d(cv){ const t={}; return new Proxy(t,{ get(o,k){ if(k==="canvas") return cv; if(k==="createLinearGradient"||k==="createRadialGradient") return (...a)=>{ if(!a.every(num)) { bad++; badWhere=k+" "+a; } return grad; };
  if(k==="measureText") return ()=>({width:10}); if(k==="getImageData") return (x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(0,w*h*4))});
  if(typeof k==="string"&&/^(fillStyle|strokeStyle|lineWidth|globalAlpha|font|textAlign|textBaseline|lineCap|lineJoin|globalCompositeOperation|imageSmoothingEnabled|filter)$/.test(k)) return o[k];
  return (...a)=>{ calls++; if(!a.every((v)=>typeof v==="object"||num(v))) { bad++; badWhere=k+" "+a.join(","); } }; },
  set(o,k,v){ if((k==="globalAlpha"||k==="lineWidth")&&!Number.isFinite(v)) { bad++; badWhere=k; } o[k]=v; return true; } }); }
c.document={ createElement:()=>{ const cv={width:300,height:150,style:{},setAttribute(){},getContext(){ return this._g||(this._g=ctx2d(this)); }}; return cv; }, addEventListener(){}, hidden:false };
c.window={devicePixelRatio:2};
const html=fs.readFileSync(W+"index.html","utf8"), files=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>!/ui\.js|p2pnet|app\.js|sound\.js|store\.js|backup\.js|^http/.test(f));
for(const f of files) { if(!fs.existsSync(W+f)) continue; try { vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c); } catch(e) { if(/travelart|fxart|skyart|art\.js/.test(f)) throw e; } }
c.setStyle=(s)=>{ style=s; };
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
ok(typeof TRAVELART!=="undefined","TRAVELART loaded");
const S=G.newSave("A","Trav","nord"); S.location="Whiterun"; [S.x,S.y]=WORLD.places.Whiterun;
const look=HEROART.lookOf(S);
const grounds=Object.keys(TRAVELART.GROUND);
for (const k of Object.values(TRAVELART.GROUND)) ok(TRAVELART.BIOME[k],"region "+k);
const skies=[SKY.make({tod:"day"}),SKY.make({tod:"night",north:true,season:"winter",cold:true}),SKY.make({tod:"dusk",weather:"rain"}),SKY.make({tod:"dawn",weather:"fog"}),
  SKY.make({tod:"day",weather:"snow",season:"winter"}),SKY.make({tod:"night",weather:"storm"}),SKY.make({tod:"day",weather:"blizzard"}),SKY.make({tod:"day",season:"autumn"}),
  SKY.make({tod:"night",season:"summer"}),SKY.make({tod:"day",season:"spring"}),SKY.make({tod:"day",weather:"ashstorm"}),null];
const dests=["Whiterun","Riverwood","Markarth","Fort Greymoor","Bleak Falls Barrow","Loreius Farm","The Lover Stone","Nowhere"];
const co=[]; for(let i=0;i<14;i++) co.push({name:"P"+i,look,riding:i%3===0,horse:"#6b4a2e",follower:i%2===1});
let n=0;
for (const st of ["ink"]) { setStyle(st);
  grounds.forEach((gr,i)=>{ const sky=skies[i%skies.length], dest=dests[i%dests.length];
    for (const [riding,carriage,comp] of [[false,false,[]],[true,false,co.slice(0,3)],[false,true,co]]) {
      TRAVELART.frame({ground:gr,progress:(i%5)/4,riding,carriage,horse:"#6b4a2e",look,company:comp,sky,dest,origin:"Whiterun"}, 37*i+n*13, {warm:3}); n++; }
  });
  for (const sky of skies) { TRAVELART.frame({ground:"Pine forest",progress:0.5,look,sky,dest:"Solitude",origin:"Dragon Bridge"}, 1234, {warm:4}); n++; }
}
TRAVELART.frame({ground:5,progress:0.7,look:null,company:[]},40); n++;   // old callers: a number for the ground, no sky
ok(TRAVELART.weatherKind(SKY.make({weather:"snow"}),"grass")==="snow" && TRAVELART.weatherKind(SKY.make({season:"autumn"}),"grass")==="leaf" && TRAVELART.weatherKind(null,"ash")==="ash","weather kinds");
ok(FXART.vignetteFrame({ground:"Tundra",progress:0.3,look}, 20),"FXART.vignetteFrame still works");
globalThis.__res={n};
`,c);
if(bad) throw new Error("FAIL NaN draw calls: "+bad+" · last: "+badWhere);
console.log("travelart ok · frames "+c.__res.n+" · calls "+calls);
