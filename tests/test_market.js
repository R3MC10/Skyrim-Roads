const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
function hero(id,name){ const s=G.newSave(id,name,"nord"); s.location="Windhelm"; [s.x,s.y]=WORLD.places.Windhelm; s.gold=1000; return s; }
const total=(s,item)=>s.inv.filter(r=>r.item===item).reduce((a,r)=>a+r.qty,0);
const a=hero("A","Alfa"), b=hero("B","Beta"), c2=hero("C","Cid");
const item=Object.keys(D.ITEMS).find(k=>D.ITEMS[k].slot==="potion" && D.ITEMS[k].value>10);
const base=total(a,item); a.inv=a.inv.filter(r=>r.item!==item); const rid=G.give(a,item,3);
ok(MARKET.list(a,rid,50,[]).err, "needs house");
a.homes={Windhelm:{chest:[],garden:0}};
const L=MARKET.list(a,rid,200,[]); ok(L.doc && total(a,item)===0, "listed, left pack "+(L.err||""));
let docs=[{...L.doc,id:L.id}];
ok(MARKET.inTown(docs,"Windhelm","B").length===1 && MARKET.inTown(docs,"Windhelm","A").length===0, "visible to others");
ok(!MARKET.buy(a,{...docs[0]},{}), "not own");
// two buyers race: second sees sold
let o1={},o2={}; const bBase=total(b,item);
const d1=MARKET.buy(b,{...docs[0]},o1); ok(d1 && d1.status==="sold", "b buys");
const d2=MARKET.buy(c2,{...d1},o2); ok(!d2 && o2.err, "c can't double-buy");
ok(b.gold===800 && total(b,item)===bBase+3 && c2.gold===1000, "buyer paid & got");
ok(/bought/.test(MARKET.settle(a,d1)) && a.gold===1000+190, "seller net 190 got "+a.gold);
ok(MARKET.settle(b,d1)===null, "only seller settles");
// withdraw returns goods
const r2=G.give(a,item,2); const L2=MARKET.list(a,r2,99,[]); ok(total(a,item)===0,"listed2");
MARKET.settle(a,{...L2.doc,status:"withdrawn"}); ok(total(a,item)===2,"withdrawn back");
docs[0]=d1; // cap
for(let i=0;i<8;i++){ const r=G.give(a,item,1); const x=MARKET.list(a,r,10,docs); ok(x.doc,"list "+i); docs.push({...x.doc,id:x.id}); }
const r9=G.give(a,item,1); ok(/holds 8/.test(MARKET.list(a,r9,10,docs).err||""),"cap 8");
ok(MARKET.list(a,r9,0,[]).err && MARKET.list(a,r9,200000,[]).err,"price bounds");
b.location="Riften"; ok(MARKET.buy(b,{...docs[1]},{})===null,"must be in town");
console.log("market ok", item);
`,c);
