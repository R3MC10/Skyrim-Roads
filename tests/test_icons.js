const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// every item id (and enchanted ids by their base) has an icon drawer that runs without errors on a fake canvas
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const calls={n:0};
const ctx2d=new Proxy({}, {get(t,k){ if(k==="createRadialGradient"||k==="createLinearGradient") return ()=>({addColorStop(){}}); if(k in t) return t[k]; return (...a)=>{calls.n++; for(const v of a) if(typeof v==="number"&&!Number.isFinite(v)) throw new Error("bad number in "+String(k));}; }, set(t,k,v){t[k]=v;return true;}});
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,localStorage:{getItem(){return null},setItem(){}}};vm.createContext(c);
const html=fs.readFileSync(W+"index.html","utf8"); const files=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>!/^ui.js|p2pnet|store.js|^map.js|sound|backup|app.js|skillinfo|guide|^mp.js$/.test(f));
for(const f of files) vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
c.CTX=ctx2d;
vm.runInContext(`
let n=0; const ids=[...Object.keys(D.ITEMS), "ench|iron_helmet|health|20|0", "ench|steel_sword|fire|20|800", "brew|Restore Health:23:0", "brew|Damage Health:10:0"];
for (const id of ids) { const it=D.ITEMS[id]; if(!it) throw new Error("no item "+id); ICONART.drawItem(id,{tq:2})(CTX); n++; }
const kinds={}; for (const e of D.ENCOUNTERS) kinds[e.name]=ICONART.enemyKind(e.name,e.tags);
for (const e of Object.values(DUNGEONS.ENEMY)) kinds[e.name]=ICONART.enemyKind(e.name,e.tags);
const generic=Object.entries(kinds).filter(([n,k])=>k==="humanoid"||k==="beast").map(([n])=>n);
console.log("items drawn", n, "· enemies", Object.keys(kinds).length, "· generic portraits:", generic.join(", ")||"none");
console.log("icons ok");
`,c);
