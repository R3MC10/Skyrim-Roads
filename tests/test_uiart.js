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
const html=(h,m)=>ok(typeof h==="string"&&/<img/.test(h),m);
let n=0;
for (const id of Object.keys(D.SPELLS)) { html(UIART.spell(id,32),"spell "+id); n++; }
for (const sk of D.ALL_SKILLS) { ok(UIART.SKILL[sk],"skill drawer "+sk); html(UIART.skill(sk,28),"skill "+sk); n++; }
for (const id of Object.keys(POWERS.STONES)) { ok(UIART.CONST[id],"stone "+id); html(UIART.stone(id),"stone "+id); n++; }
for (const id of Object.keys(POWERS.SHOUTS)) { html(UIART.shout(id),"shout "+id); n++; }
for (const id of QUESTS.list()) { ok(UIART.QUEST[id],"quest line "+id); html(UIART.quest(id),"quest "+id); n++; }
for (const a of ACH.LIST) { ok(UIART.ACH[a[0]],"ach "+a[0]); html(UIART.ach(a[0],32,true),"ach"); html(UIART.ach(a[0],32,false),"ach x"); n++; }
for (const id of Object.keys(TOWNS.FOLLOWERS)) { html(UIART.follower(id,36),"follower "+id); n++; }
for (const [c] of HORSES.COATS) { html(UIART.horse(c,40),"horse "+c); html(UIART.horse(c,40,true),"horse a "+c); n++; }
for (const st of GUIDE.STEPS) { ok(UIART.GUIDE[st[0]],"guide "+st[0]); html(UIART.guide(st[0]),"guide"); n++; }
for (const r of Object.keys(D.RACES)) html(UIART.power(r,30),"power "+r);
for (const a of ["health","magicka","stamina"]) html(UIART.attr(a),"attr");
for (const k of [...Object.keys(D.BASIC_ACTIONS), "potion:health","potion:magicka","scroll:scroll_fireball","power:race","power:beast","power:stone","shout:fire_breath","spell:flames","dual:fireball"]) html(UIART.action(k,30),"action "+k);
for (const r of [800,1000,1200,1400]) html(UIART.rank(r),"rank");
html(UIART.banner(["#8c2b22","#c9a75e"]),"banner"); html(UIART.hold("#1f4e79"),"hold");
for (const e of FEST.EVENTS) html(UIART.fest(e.id),"fest "+e.id);
html(UIART.panorama(480,300),"pano"); html(UIART.death(),"death");
for (const id of Object.keys(D.ITEMS).filter(k=>/^tome_|^scroll_|^staff_/.test(k))) html(ICONART.item(id,34),"tome/staff "+id);
console.log("uiart ok ·", n, "icons · canvas calls", calls.n);
`,c);
