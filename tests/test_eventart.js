const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// every road event and story moment has a picture, and drawing never throws or passes NaN (fake 2D context)
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,localStorage:{getItem:()=>null,setItem:()=>{}}};vm.createContext(c);
const html=fs.readFileSync(W+"index.html","utf8"), files=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>!/ui\.js|p2pnet|app\.js|sound\.js|store\.js|backup\.js|^http/.test(f));
for(const f of files) { if(!fs.existsSync(W+f)) continue; try { vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c); } catch(e) { if(/eventart|art\.js/.test(f)) throw e; } }
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const grad={addColorStop(){}}; let calls=0, bad=0;
const num=(v)=>typeof v!=="number"||Number.isFinite(v);
const g=new Proxy({}, { get(t,k){ if(k==="createLinearGradient"||k==="createRadialGradient") return (...a)=>{ if(!a.every(num)) bad++; return grad; }; if(k==="measureText") return ()=>({width:10}); if(k==="setLineDash") return ()=>{};
  return (...a)=>{ calls++; if(!a.every(num)) bad++; }; }, set(){ return true; } });
// every road event in events.js
const ids=[...${JSON.stringify(fs.readFileSync(W+"events.js","utf8"))}.matchAll(/\\{ id: "(\\w+)"/g)].map(m=>m[1]);
ok(ids.length>=10, "found events "+ids.length);
const DIV=["Akatosh","Arkay","Dibella","Julianos","Kynareth","Mara","Stendarr","Zenithar","Talos"];
let n=0;
for (const id of ids) {
  ok(EVENTART.ROAD[id], "road picture for "+id);
  for (const ground of Object.keys(EVENTART.GROUND)) {
    const ev = id==="shrine" ? {id, god: DIV[n%DIV.length]} : id==="herbs" ? {id, item: Object.keys(D.ITEMS).find(k=>D.ITEMS[k].slot==="ingredient")} : id==="chest" ? {id, tier: n%5} : {id};
    EVENTART.ROAD[id](g, ART.H, 360, 150, ev); n++;
  }
}
for (const god of DIV) EVENTART.ROAD.shrine(g, ART.H, 360, 150, {id:"shrine", god});
// story vignettes, and every quest stage maps to one
for (const k of Object.keys(EVENTART.STORY)) { EVENTART.STORY[k](g, ART.H, 360, 150, {town:"Whiterun"}); n++; }
const seen={}; let nq=0;
for (const [line, q] of Object.entries(QUESTS.L)) for (const st of q.stages) {
  const k = EVENTART.storyKind("Quest", "\uE103 "+q.name+": “"+st.title+"” done (50 gold).");   // the real popup wording (quests.js advance)
  ok(k && EVENTART.STORY[k] && k!=="road", "quest vignette for "+line+"/"+st.title+" got "+k); seen[st.title]=k; nq++;
}
ok(nq>=15, "quest stages checked "+nq);
ok(seen["Bleak Falls Barrow"]==="claw" && seen["Dragon Rising"]==="dragonFalls" && seen["Loud and Clear"]==="flagon" && seen["Under Saarthal"]==="college" && seen["Proving Honor"]==="hall", "right vignettes "+JSON.stringify(seen));
ok(EVENTART.storyKind("The dragon falls","x")==="dragonFalls" && EVENTART.storyKind("The Change","You are a vampire now")==="blood" && EVENTART.storyKind("You died","x")===null, "story kinds");
ok(EVENTART.storyKind("High Hrothgar","")==="mountainSteps" && EVENTART.storyKind("x","A Word Wall hums")==="wordWall", "more story kinds");
ok(bad===0, "NaN/undefined passed to canvas: "+bad);
console.log("eventart ok ·", ids.length, "road events ("+ids.join(",")+") ·", n, "pictures ·", calls, "draw calls");
`,c);
