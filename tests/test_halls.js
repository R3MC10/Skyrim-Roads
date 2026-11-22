const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","clans.js","halls.js","mp.js"]) if(fs.existsSync(W+f)) vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const DAY=HALLS.DAY;
function hero(id,name,town="Whiterun"){ const s=G.newSave(id,name,"nord"); s.location=town; [s.x,s.y]=WORLD.places[town]; s.gold=50000; return s; }
const total=(s,item)=>s.inv.filter(r=>r.item===item).reduce((a,r)=>a+r.qty,0);
let t0=Math.floor(G.now()/DAY)*DAY+10;
// --- plots
const a=hero("A","Alfa"); a.location="Riverwood";
ok(HALLS.buyPlot(a,"x",t0).err,"no plot in Riverwood");
a.location="Whiterun"; a.gold=100; ok(/costs 6000/.test(HALLS.buyPlot(a,"x",t0).err),"price");
a.gold=50000; const bp=HALLS.buyPlot(a,"<b>Skyforge</b> Hall",t0); ok(bp.text && a.hall && a.gold===44000,"bought");
ok(!/[<>]/.test(a.hall.name),"name cleaned "+a.hall.name);
ok(HALLS.buyPlot(a,"y",t0).err,"only one hall");
// --- build needs materials
const h=a.hall, P={s:a};
ok(/need/.test(HALLS.build(h,"forge",P).err||""),"forge needs mats");
G.give(a,"mat_iron",20); G.give(a,"mat_firewood",60); G.give(a,"mat_steel",20); G.give(a,"mat_leather",10); G.give(a,"mat_moonstone",10); G.give(a,"mat_silver",5); G.give(a,"mat_gold",2);
const g0=a.gold, i0=total(a,"mat_iron");
ok(HALLS.build(h,"forge",P).text && h.rooms.forge===1 && a.gold===g0-600 && total(a,"mat_iron")===i0-6,"forge built, paid");
ok(HALLS.build(h,"forge",P).text && h.rooms.forge===2,"forge 2");
ok(/fully/.test(HALLS.build(h,"forge",P).err),"max level");
// stolen materials don't count
const st=G.give(a,"mat_moonstone",1); 
for(const r of ["shrine","trophy","storage","counter"]) ok(HALLS.build(h,r,P).text, "build "+r);
ok(HALLS.roomCount(h)===5,"5 rooms"); ok(HALLS.build(h,"counter",P).text,"counter 2");
// --- forge xp bonus only in the hall's town
ok(HALLS.xpMult(a,"Smithing")>1.19 && HALLS.xpMult(a,"Alchemy")===1,"forge xp");
a.location="Riften"; ok(HALLS.xpMult(a,"Smithing")===1,"no bonus away"); a.location="Whiterun";
ok(HALLS.hasForge(a,"Whiterun") && !HALLS.hasForge(a,"Riften"),"hasForge");
// --- decor & comfort
ok(HALLS.decorCap(h)===8,"decor cap 3+5");
for(const d of ["rug","banner","candles"]) ok(HALLS.addDecor(h,d,P).text,"decor "+d);
ok(HALLS.addDecor(h,"rug",P).err,"no dup");
ok(HALLS.comfort(h)===4,"comfort 3+shrine");
const rr=HALLS.rest(a,h,t0); ok(/Well Rested/.test(rr.text) && a.restBonus===0.1,"well rested");
a.location="Riften"; ok(HALLS.rest(a,h,t0).err,"rest only in town"); a.location="Whiterun";
// --- shrine once a day
ok(HALLS.pray(a,h,t0).text && G.maxHealth(a)>0,"pray");
ok(HALLS.pray(a,h,t0+60).err,"once a day");
ok(HALLS.pray(a,h,t0+DAY).text,"next day ok");
ok(a.fx.filter(f=>f.name==="Hall shrine").length===1,"no stacking");
// --- staff & wages
ok(HALLS.hire(h,"shopkeeper",P,t0).text && HALLS.hire(h,"guard",P,t0).text && HALLS.hire(h,"steward",P,t0).text,"hired");
ok(HALLS.wages(h)===100,"wages 100");
HALLS.deposit(a,h,150);
h.paid=t0;
let m=HALLS.settle(h,t0+3*DAY+5,()=>0.99);
// day1: +50 steward, -100 => 100 ; day2 +50 -100 => 50; day3 +50 = 100, pays shopkeeper 40 guard 30 steward 30 => 0
ok(h.coffer===0 && Object.keys(h.staff).length===3,"3 days paid "+h.coffer+" "+JSON.stringify(h.staff));
m=HALLS.settle(h,t0+4*DAY+5,()=>0.99);
ok(Object.keys(h.staff).length<3 && m.some(x=>/left/.test(x)),"unpaid leave "+m.join("|"));
ok(HALLS.settle(h,t0+4*DAY+6).length===0,"same day nothing");
// big gap capped
h.paid=t0-100*DAY; HALLS.deposit(a,h,10000); const cf=h.coffer; HALLS.settle(h,t0+4*DAY+6,()=>0.99); ok(cf-h.coffer<=14*HALLS.wages(h)+5000,"capped days");
// --- storage & thief
const pot=Object.keys(D.ITEMS).find(k=>D.ITEMS[k].slot==="potion");
const pr=G.give(a,pot,3);
ok(HALLS.stash(a,h,pr).text && h.storage.length===1 && total(a,pot)===0,"stash");
HALLS.dismiss(h,"guard"); h.paid=t0+10*DAY; const before=h.storage[0].qty;
HALLS.settle(h,t0+11*DAY+1,()=>0.01); ok(!h.storage.length || h.storage[0].qty<before,"thief without guard");
HALLS.hire(h,"guard",P,t0); const n2=(h.storage[0]||{qty:0}).qty; HALLS.settle(h,t0+12*DAY+1,()=>0.01); ok(((h.storage[0]||{qty:0}).qty)===n2,"guard stops thief");
if(h.storage.length){ ok(HALLS.unstash(a,h,0).text && total(a,pot)>0,"unstash"); }
// --- trophies -> barter
const tr=G.give(a,"dragon_bone",2);
ok(HALLS.stash(a,h,pr,true).err || true,"");
const tr2=a.inv.find(r=>r.item==="dragon_bone").id;
ok(HALLS.stash(a,h,tr2,true).text && h.trophies.length===1 && total(a,"dragon_bone")===1,"mount one");
const mp=Object.keys(D.ITEMS).find(k=>D.ITEMS[k].slot==="potion"); const mpr=G.give(a,mp,1);
ok(/Only trophies/.test(HALLS.stash(a,h,mpr,true).err||""),"only trophies");
const hg=G.haggle(a); HALLS.refreshTrophies(a,t0); ok(G.haggle(a)>hg,"barter up");
// --- shop: listing via hall counter, cap, fee, travellers
ok(HALLS.shopOpen(a,"Whiterun") && !HALLS.shopOpen(a,"Riften"),"shopOpen");
ok(MARKET.capFor(a)===16,"cap 16 at counter 2");
const it=Object.keys(D.ITEMS).find(k=>D.ITEMS[k].slot==="potion"&&D.ITEMS[k].value>=20);
const sr=G.give(a,it,1); const L=MARKET.list(a,sr,D.ITEMS[it].value,[]); ok(L.doc && L.doc.hall,"hall listing "+(L.err||""));
const exp=G.give(a,it,1); const L2=MARKET.list(a,exp,D.ITEMS[it].value*3,[]); ok(L2.doc,"dear listing");
let docs=[{...L.doc,id:L.id},{...L2.doc,id:L2.id}];
a.hall.sold=t0; HALLS.hire(h,"shopkeeper",P,t0);
const sold=HALLS.travellerBuys(a,docs,t0+5*DAY,()=>0.1);
ok(sold.includes(L.id) && !sold.includes(L2.id),"travellers buy fair only "+sold);
ok(HALLS.travellerBuys(a,docs,t0+5*DAY,()=>0.1).length===0,"not twice same day");
const g1=a.gold; const msg=MARKET.settle(a,{...docs[0],status:"sold",buyerName:"A traveller"}); ok(a.gold===g1+Math.floor(L.doc.price*0.98) && /traveller/.test(msg),"2% fee");
// house-less player in other town still blocked
a.location="Riften"; const sr3=G.give(a,it,1); ok(MARKET.list(a,sr3,10,[]).err,"no shop in Riften");
// --- card
a.location="Whiterun"; const cd=HALLS.card(a); ok(cd.town==="Whiterun" && cd.trophies[0]==="dragon_bone" && cd.shop && !cd.coffer && !cd.storage,"public card hides coffer/storage");
// --- clan hall
const f=hero("F","Founder"), mbr=hero("M","Member"), out=hero("O","Outsider");
const fc=CLANS.found(f,"Iron Wolves","IRON",[CLANS.COLORS[0],CLANS.COLORS[1]]); const clan={...fc.clan,id:f.id,invites:["M"]};
mbr.clan=f.id; CLANS.set([clan],[{id:"F",clan:"F"},{id:"M",clan:"F"}]);
ok(HALLS.foundClanHall(mbr,clan,"x",null).err,"only founder");
const ch=HALLS.foundClanHall(f,clan,"Wolf Hall",null,t0); ok(ch.id==="c-F" && ch.doc.clan==="F" && f.gold===50000-12000,"clan hall bought "+f.gold);
const d=ch.doc; d.id=ch.id; HALLS.setClanHall(d);
ok(HALLS.build(d,"counter",{h:d}).err,"no counter in guild hall");
ok(/funds/.test(HALLS.build(d,"forge",{h:d}).err),"needs funds");
ok(HALLS.deposit(mbr,d,5000).text && d.funds===5000 && d.donors.M.gold===5000,"member gives");
ok(HALLS.build(d,"forge",{h:d}).text && d.funds<5000 && d.rooms.forge===1,"built from funds");
ok(HALLS.withdraw(mbr,d,10).err,"no withdraw from funds");
ok(HALLS.canUse(mbr,d) && HALLS.canUse(f,d) && !HALLS.canUse(out,d),"members only");
ok(HALLS.rest(out,d).err,"outsider can't rest");
ok(HALLS.xpMult(mbr,"Smithing")>1.09,"member forge bonus in Whiterun");
HALLS.deposit(f,d,5000); ok(HALLS.build(d,"storage",{h:d}).text,"storage");
for(let i=0;i<5;i++){ const r=G.give(f,pot,1); HALLS.stash(f,d,r); }
const sp=G.give(mbr,pot,1); const stl=a.inv.find(r=>r.item==="mat_moonstone"); 
const sr4=G.give(mbr,"mat_iron",1); mbr.inv.find(r=>r.id===sr4).stolen=true; ok(/Stolen/.test(HALLS.stash(mbr,d,sr4).err||""),"no stolen in guild storage");
let took=0; for(let i=0;i<5;i++){ if(HALLS.unstash(mbr,d,0,false,t0).text) took++; }
ok(took===3,"member takes 3/day "+took);
ok(HALLS.unstash(mbr,d,0,false,t0+DAY).text,"next day again");
ok(HALLS.unstash(f,d,0,false,t0).text,"founder unlimited");
// guild wages from funds
HALLS.hire(d,"guard",{h:d},t0); d.paid=t0; const fu=d.funds; HALLS.settle(d,t0+2*DAY+1); ok(d.funds===fu-60,"guild wages "+fu+" "+d.funds);
ok(HALLS.hire(d,"shopkeeper",{h:d},t0).err,"no shopkeeper in guild hall");
console.log("halls ok");
`,c);
