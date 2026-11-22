const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// every house × garden × rested × display, neighbours' homes and every Hall tier draw without NaN (fake 2D context)
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,localStorage:{getItem:()=>null,setItem:()=>{}}};vm.createContext(c);
const html=fs.readFileSync(W+"index.html","utf8"), files=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>!/ui\.js|p2pnet|app\.js|sound\.js|store\.js|backup\.js|^http/.test(f));
for(const f of files) { if(!fs.existsSync(W+f)) continue; try { vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c); } catch(e) { if(/homeart|art\.js/.test(f)) throw e; } }
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const grad={addColorStop(){}}; let calls=0, bad=0;
const chk=(a)=>{ for (const v of a) if (typeof v==="number" && !Number.isFinite(v)) bad++; };
const g=new Proxy({}, { get(t,k){ if(k==="createLinearGradient"||k==="createRadialGradient") return (...a)=>{chk(a); return grad;}; if(k==="measureText") return ()=>({width:60}); if(k==="setLineDash") return ()=>{}; if(typeof k==="string" && /^(fillStyle|strokeStyle|lineWidth|font|textAlign|globalAlpha|lineJoin|lineCap|imageSmoothingEnabled)$/.test(k)) return t[k]; return (...a)=>{ calls++; chk(a); }; }, set(t,k,v){ t[k]=v; return true; } });
ART.html=(w,h,draw,opts)=>{ draw(g, ART.H, w, h); return "<img data-k='"+opts.key+"'>"; };
const items=["iron_sword","steel_armor","iron_helmet","gem_ruby","gold_diamond_necklace","dragon_bone","elven_bow","ench|iron_helmet|health|20|0","potion_health_minor"];
let n=0;
for (const town of Object.keys(TOWNS.HOMES)) for (const gd of [0,0.5,1]) for (const rested of [false,true]) for (const k of [0,2,4,6]) {
  const out=HOMEART.interior({ town, rested, garden: gd, chestN: k*3, shown: items.slice(0,k), skulls: k, motto: k? "Fortune favours the bold, and the well-fed" : "", gift: k===2 });
  ok(/<img/.test(out), "drew "+town); n++;
}
const s=G.newSave("A","Ann","nord"); s.homes={Whiterun:{chest:[{id:1,item:"iron_sword",qty:1,shown:true},{id:2,item:"gem_ruby",qty:2}],garden:G.now()-3000}}; s.rested=G.now()+100; s.restBonus=0.1; s.dragons=2; s.motto="Hi";
const m=HOMEART.mine(s,"Whiterun"); ok(/data-act="homebed"/.test(m) && /data-act="harvest"/.test(m) && /hscene/.test(m), "hotspots");
ok(/iron_sword/.test(m), "shown item in key");
const rec=VISITS.record(s); ok(rec.show[0].item==="iron_sword", "record carries item ids");
ok(/<img/.test(HOMEART.visit(rec,"Whiterun",true)), "visit");
for (let t=0;t<5;t++) for (const p of [0,40,90]) { HOMEART.hall(t,[{name:"Zed"},{name:"Remigiusz the Bold"},{name:"Ann"}],t*2,p); n++; }
ok(bad===0, "NaN args: "+bad);
console.log("homeart ok ·", n, "pictures ·", calls, "draw calls");
`,c);
