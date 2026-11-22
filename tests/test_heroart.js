const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const calls={n:0};
const ctx=new Proxy({}, {get:(t,k)=>{ if(k in t) return t[k]; return (...a)=>{ calls.n++; for(const v of a) if(typeof v==="number"&&!isFinite(v)) throw new Error("NaN in "+String(k)); return {addColorStop(){}}; }; }, set:(t,k,v)=>{ t[k]=v; return true; }});
const doc={createElement:()=>({width:0,height:0,style:{},dataset:{},getContext:()=>ctx,toDataURL:()=>"data:image/png;base64,AA"})};
const c={calls,console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,document:doc,localStorage:{getItem:()=>null,setItem(){}},devicePixelRatio:2};vm.createContext(c);
const files=fs.readFileSync(W+"index.html","utf8").match(/<script src="([a-z0-9]+\.js)">/g).map(s=>s.match(/"(.*)"/)[1]).filter(f=>!["store.js","p2pnet.js","ui.js","sound.js","map.js","backup.js","skillinfo.js"].includes(f));
for(const f of files) vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
ok(Object.keys(D.RACES).every(r=>HEROART.RACE[r]),"every race drawn");
const items=Object.keys(D.ITEMS).filter(k=>{const v=D.ITEMS[k];return v.slot==="weapon"||G.ARMOR_SLOTS.includes(v.slot)});
let n=0;
for(const r of Object.keys(D.RACES)) for(const id of items){
  const it=D.ITEMS[id], slot=it.slot;
  ok(HEROART.MAT[HEROART.matOf(id)],"material for "+id);
  if(slot==="weapon") ok(HEROART.weaponKind(id),"weapon kind "+id);
  const look={r, id:"t"+n, eq:{[slot]:id}, gl:{w:it.enchant?it.enchant.effect:undefined,a:it.aenchant?1:0}, v:n%7===0?1:0, ww:n%11===0?1:0};
  const h=HEROART.figure({look},160,220); ok(/<img/.test(h),"img "+id); HEROART.portrait({look},38); n++;
}
// a full save with gear
const s=G.newSave("A","Ann","khajiit"); for(const id of ["steel_armor","steel_helmet","steel_gauntlets","steel_boots","steel_shield","ench|steel_sword|fire|20|800"]) { const rid=G.give(s,id); G.equip(s,rid); }
const L=HEROART.lookOf(s); ok(L.eq.chest==="steel_armor"&&L.eq.weapon==="steel_sword"&&L.gl.w==="fire","lookOf "+JSON.stringify(L));
console.log("heroart ok ·", n, "race×item drawings ·", items.length, "items · canvas calls", calls.n);
`,c);
