const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const calls={n:0};
const ctx=new Proxy({}, {get:(t,k)=>{ if(k in t) return t[k]; return (...a)=>{ calls.n++; for(const v of a) if(typeof v==="number"&&!isFinite(v)) throw new Error("NaN in "+String(k)); return {addColorStop(){}}; }; }, set:(t,k,v)=>{ t[k]=v; return true; }});
const doc={createElement:()=>({width:0,height:0,style:{},dataset:{},getContext:()=>ctx,toDataURL:()=>"data:image/png;base64,AA"})};
const c={calls,console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,document:doc,localStorage:{getItem:()=>null,setItem(){}},devicePixelRatio:2};vm.createContext(c);
const files=fs.readFileSync(W+"index.html","utf8").match(/<script src="([a-z0-9]+\.js)">/g).map(s=>s.match(/"(.*)"/)[1]).filter(f=>!["store.js","p2pnet.js","ui.js","sound.js","map.js","backup.js","skillinfo.js"].includes(f));
for(const f of files) vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
c.__ASRC=fs.readFileSync(W+"assets.js","utf8");
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const towns=Object.keys(WORLD.places).filter(n=>G.shopTypes(n).length||TOWNS.isTown(n));
const SECS=["general","blacksmith","wizard","fence","inn","alchemy","forge","jobs","streets","hire","carriage","home","market","hall","notice","cook","arena","fish","enchanter","stables","mine"];
let cards=0, named=0, gens=0, names=new Set();
const s=G.newSave("A","Ann","nord"); s.dragons=1;
for(const t of towns) for(const sec of SECS){
  const n=NPCART.who(t,sec); if(!n) continue;
  ok(n.name && n.race && HEROART.RACE[n.race], "npc "+t+"/"+sec+" "+JSON.stringify(n));
  const h=NPCART.talk(t,sec,s); ok(/<img/.test(h)&&/<q>/.test(h), "card "+t+"/"+sec); cards++;
  if(n.generic) gens++; else named++;
}
// every shop type a town really has gets a named or generic person
for(const t of towns) for(const sec of G.shopTypes(t)) ok(NPCART.who(t,sec),"shop person "+t+"/"+sec);
// named shopkeepers in every hold capital
for(const cap of ["Whiterun","Solitude","Windhelm","Riften","Markarth"]) for(const sec of G.shopTypes(cap)) { const n=NPCART.who(cap,sec); ok(!n.generic,"named "+cap+"/"+sec); names.add(n.name); }
// trainers, followers, jarls, givers, greybeard
let tr=0; for(const [t,list] of Object.entries(TOWNS.TRAINERS)) for(const [who,sk] of list){ ok(NPCART.TRAINER_RACE[who],"trainer race "+who); ok(/<img/.test(NPCART.trainer(who,sk,36)),"trainer "+who); tr++; }
for(const id of Object.keys(TOWNS.FOLLOWERS)){ ok(NPCART.FOLLOWER_LOOK[id],"follower look "+id); ok(/<img/.test(NPCART.follower(id,36)),"follower "+id); }
for(const h of Object.keys(WORLD.holds)){ ok(NPCART.jarlOf(h),"jarl of "+h); ok(/<img/.test(NPCART.steward(h,34)),"steward "+h); ok(NPCART.HOLD_COLOR[h],"hold colour "+h); }
for(const q of ["main","companions","thieves","college"]) ok(/<img/.test(NPCART.giver(q,32)),"giver "+q);
ok(/Arngeir/.test(NPCART.talk("High Hrothgar","greybeard",s)),"greybeard");
// greetings: bounty changes what guards say
s.bounty={Whiterun:40}; ok(/wanted/i.test(NPCART.greeting(NPCART.who("Whiterun","streets"),s)),"guard bounty line");
// [npcportraits] the first painted batch: every name maps to a key listed in assets.js; with no file the drawing shows in a slot of the same size
const ASRC=__ASRC;
const BATCH=[["Whiterun","blacksmith"],["Whiterun","inn"],["Whiterun","wizard"],["Whiterun","general"],["Whiterun","alchemy"],["Riverwood","blacksmith"],["Riverwood","inn"],["Riverwood","general"],
  ["Solitude","blacksmith"],["Solitude","inn"],["Solitude","wizard"],["Solitude","general"],["Windhelm","blacksmith"],["Windhelm","inn"],["Windhelm","wizard"],["Windhelm","general"],
  ["Riften","blacksmith"],["Riften","inn"],["Riften","wizard"],["Riften","general"],["High Hrothgar","greybeard"]];
const keys=new Set();
for(const [t,sec] of BATCH){ const n=NPCART.who(t,sec); const k=NPCART.paintKey(n); ok(k&&ASSETS.NPC.has(k)&&ASRC.includes('"'+k+'"'),"painted key "+t+"/"+sec+" "+k); keys.add(k); }
for(const h of ["Whiterun","Haafingar","Eastmarch","The Rift"]){ const k=NPCART.paintKey({...NPCART.jarlOf(h),role:"jarl"}); ok(k&&ASSETS.NPC.has(k),"jarl key "+h+" "+k); keys.add(k); }
{ const k=NPCART.paintKey({...NPCART.TOWN.Whiterun.steward,role:"steward"}); ok(k==="npc-proventus-avenicci","steward key"); keys.add(k); }
for(const [role,sex] of [["guard","m"],["guard","f"],["merchant","m"],["merchant","f"],["innkeeper","m"],["innkeeper","f"]]){ const k=NPCART.paintKey({name:"Somebody",race:"nord",sex,role,generic:1}); ok(k==="npcg-"+role+"-nord-"+sex&&ASSETS.NPC.has(k)&&ASRC.includes('"'+k+'"'),"generic "+role+sex); keys.add(k); }
ok(keys.size===32&&ASSETS.NPC.size===32,"32 painted portraits, got "+keys.size+"/"+ASSETS.NPC.size);
ok(NPCART.paintKey(NPCART.who("Ivarstead","inn"))==="npcg-innkeeper-nord-m","unpainted innkeeper borrows the generic");
ok(NPCART.paintKey({name:"Ghorza gra-Bagol",race:"orc",sex:"f",role:"smith"})===null,"no picture: drawing");
const g=NPCART.who("Whiterun","streets"); ok(NPCART.paintKey(g)==="npcg-guard-nord-"+g.sex,"guard generic");
ok(/npcguard/.test(NPCART.portrait(g,44))&&NPCART.portrait(g,44).includes(NPCART.HOLD_COLOR.Whiterun),"guard keeps hold colour frame");
for(const sz of [44,64,96]){ const h=NPCART.portrait(NPCART.who("Whiterun","blacksmith"),sz);
  ok(/class="npcport npcslot"/.test(h)&&h.includes("--nps:"+sz+"px")&&h.includes('width="'+sz+'" height="'+sz+'"')&&/<img class="art npcdraw"/.test(h),"drawn fallback in a "+sz+" slot: "+h.slice(0,160)); }
ok(/class="art npcport"/.test(NPCART.portrait({name:"Ghorza gra-Bagol",race:"orc",sex:"f",role:"smith"},44)),"unpainted people unchanged");console.log("npcart ok · cards",cards,"(named",named,"generic",gens,") · trainers",tr,"· canvas calls",calls.n);
`,c);
