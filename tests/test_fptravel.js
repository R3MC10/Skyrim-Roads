const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// FPT (fptravel.js): the first-person travel view paints every region, sky, weather, riding / walking / carriage /
// ship, bends both ways and every destination kind without NaN draw calls (fake 2D context + fake canvases);
// the trip card no longer says the page-closed line; the band's words have Polish.
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
for(const f of files) { if(!fs.existsSync(W+f)) continue; try { vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c); } catch(e) { if(/travelart|fptravel|fxart|skyart|art\.js/.test(f)) throw e; } }
c.setStyle=(s)=>{ style=s; };
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
ok(typeof FPT!=="undefined","FPT loaded");
ok(TRAVELART.draw && typeof TRAVELART.draw.pine==="function" && typeof TRAVELART.draw.destination==="function","TRAVELART shares its drawing helpers");
const S=G.newSave("A","Trav","nord"); S.location="Whiterun"; [S.x,S.y]=WORLD.places.Whiterun;
const look=HEROART.lookOf(S);
const grounds=Object.keys(TRAVELART.GROUND);
const skies=[SKY.make({tod:"day"}),SKY.make({tod:"night",north:true,season:"winter",cold:true}),SKY.make({tod:"dusk",weather:"rain"}),SKY.make({tod:"dawn",weather:"fog"}),
  SKY.make({tod:"day",weather:"snow",season:"winter"}),SKY.make({tod:"night",weather:"storm"}),SKY.make({tod:"day",weather:"blizzard"}),SKY.make({tod:"day",season:"autumn"}),
  SKY.make({tod:"night",season:"summer"}),SKY.make({tod:"day",weather:"ashstorm"}),null];
const dests=["Whiterun","Riverwood","Markarth","Fort Greymoor","Bleak Falls Barrow","Loreius Farm","The Lover Stone","Nowhere"];
let n=0;
grounds.forEach((gr,i)=>{ const sky=skies[i%skies.length], dest=dests[i%dests.length];
  for (const [riding,carriage,boat,turn] of [[false,false,false,-60],[true,false,false,30],[false,true,false,0],[false,false,true,0]]) {
    const c=FPT.frame({ground:gr,p:(i%5)/4,riding,carriage,boat,horse:{name:"Plotka",coat:"#9b9b97"},look,sky,dest,origin:"Whiterun",heading:i*37,turn,destBear:i*37+(i%3-1)*40}, {w:300+i*20,h:100+i*5,t:i*3.3,travel:i*2.1});
    ok(c && c.width>0,"a picture for "+gr); n++; }
});
for (const sky of skies) { FPT.frame({ground:"Pine forest",p:0.5,look,sky,dest:"Solitude",riding:true,heading:350,destBear:10}, {w:980,h:240}); n++; }
FPT.frame({ground:"Nowhere",p:NaN,look:null}, {}); n++;   // odd input: still no NaN
// every region of the road view (fpscene.js), day and night, bends and hills, far along the road (deep travel values)
for (const region of Object.keys(FPSCENE.REGIONS)) for (const [k,sky] of [[0,skies[0]],[1,skies[1]],[2,skies[2]],[3,skies[6]]]) {
  FPT.frame({ground:"Road",region,p:0.2+k*0.25,look,sky,dest:"Whiterun",origin:"Riverwood",riding:k%2===0,heading:k*90,turn:(k-1.5)*40,destBear:k*90+20}, {w:390,h:120,t:k*7.1,travel:k*900+13.7,trip:"t"+k});
  const d=FPT.debug(); ok(d && d.world && d.world.region===region && d.world.objects>0, region+" draws its land ("+(d&&d.world&&d.world.objects)+")"); ok(d.world.objects<=60,"no pile-up in "+region+": "+d.world.objects); n++; }
ok(Object.keys(FPT.LAYERS).length>=9 && FPT.LAYERS.pine.far==="fpv-pine-far","painted layer hook");
ok(FPT.FOV===200,"same field of view as the compass");
globalThis.__res={n};
`,c);
if(bad) throw new Error("FAIL NaN draw calls: "+bad+" · last: "+badWhere);
const ui=fs.readFileSync(W+"ui.js","utf8"); if(/The trip keeps going while the page is closed/.test(ui)) throw new Error("FAIL the old page-closed line is still on the trip card");
const fpt=fs.readFileSync(W+"fptravel.js","utf8"), pl=fs.readFileSync(W+"i18n_fptravel.js","utf8");
for (const w of ["On the road","Show the road","Hide the road","walking beside","by carriage","is downed","Tip: the trip keeps going even when you close the game."]) { if(!fpt.includes(w)) throw new Error("FAIL fptravel.js lost "+w); if(!pl.includes(JSON.stringify(w))) throw new Error("FAIL no Polish for "+w); }
console.log("fptravel ok · frames "+c.__res.n+" · calls "+calls);
