const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,setTimeout:(f)=>0,clearTimeout:()=>{}};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","guilds.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","clans.js","festivals.js","wars.js","market.js","smithing.js","social.js","ammo.js","tomes.js","caravans.js","mp.js","economy.js"]) if(fs.existsSync(W+f)) vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const t=G.now();
// categories
ok(ECON.catOf("ore_iron")==="ore","ore cat"); ok(ECON.isTrade("ore_iron"),"ore trade");
const cats={}; for(const k of Object.keys(D.ITEMS)) cats[ECON.catOf(k)]=(cats[ECON.catOf(k)]||0)+1; console.log("cats",JSON.stringify(cats));
// deterministic daily market
const d1=JSON.stringify(ECON.today("Whiterun",t)), d2=JSON.stringify(ECON.today("Whiterun",t)); ok(d1===d2,"today deterministic");
ok(ECON.today("Whiterun",t).short!==ECON.today("Whiterun",t).glut,"short != glut");
// regional: ore cheaper in Markarth than Solitude (ignoring today's swing: compare region)
ok(ECON.region("Markarth","ore")<1 && ECON.region("Solitude","ore")>1,"regional ore");
const mk=(id,merc,loc)=>{ const s=G.newSave(id,"P"+id,"nord"); s.location=loc; s.gold=100000; s.skills.Mercantile.lvl=merc; return s; };
const A=mk("A",15,"Markarth");
// clamps
for(const town of ECON.towns()) for(const it of ["ore_iron","potion_health","mat_iron","iron_sword"].filter(i=>D.ITEMS[i])) { const m=ECON.mult(town,it); ok(m>=0.5&&m<=1.8,"clamp "+town+" "+it+" "+m); }
// spread: selling never pays more than 90% of buy, even with crazy barter
const H=mk("H",100,"Whiterun"); H.perks={haggling:5,master_trader:1}; H.fx=[{key:"barter",mag:200,until:t+99999,name:"x"}];
for(const it of Object.keys(D.ITEMS).filter(i=>!D.ITEMS[i].noTrade).slice(0,200)) { const b=G.buyPrice(H,it), sp=G.sellPrice(H,{item:it}); ok(sp<=Math.max(1,Math.floor(b*0.9))||b<=1,"spread "+it+" "+sp+" "+b); }
// round trip in one town never profits
for(const it of ["ore_iron","mat_iron","pelt_wolf","iron_sword"].filter(i=>D.ITEMS[i])) { const b=G.lotPrice(H,it,10,"buy"), sp=G.lotPrice(H,it,10,"sell",{item:it}); ok(D.ITEMS[it].value<3?sp<=b:sp<b,"no round trip "+it+" "+sp+" "+b+" v="+D.ITEMS[it].value); }
// player pressure: buying raises the price, fades over in-game days
const it="ore_silver", p0=G.buyPrice(A,it);
const tb=(()=>{ let x=t; while(!G.shopsOpen(x)) x+=600; return x; })();
ok(/^Bought/.test(G.buy(A,it,8,tb)),"bought ore"); const p1=G.buyPrice(A,it); ok(p1>p0,"price rose after buying "+p0+"→"+p1);
ok(ECON.pressure("Markarth",it,tb)>0,"pressure recorded");
ok(ECON.pressure("Markarth",it,tb+ECON.DAY)<ECON.pressure("Markarth",it,tb)*0.6,"fades");
// one player can't push past a cap
for(let i=0;i<50;i++) ECON.record("A","Markarth",it,10,tb);
ok(ECON.pressure("Markarth",it,tb)<=ECON.depth(it)+1e-6,"per-player cap");
// but many players together push further
for(let i=0;i<6;i++) ECON.record("Z"+i,"Markarth",it,ECON.depth(it),tb);
ok(ECON.mult("Markarth",it,"buy",0,tb) > ECON.mult("Markarth",it,"buy",0,tb - 0) - 1 && ECON.pressure("Markarth",it,tb)>ECON.depth(it)*3,"crowd pressure");
// foreign records are clamped
ECON.set([{id:"evil|Riften",uid:"evil",town:"Riften",f:{ore_iron:[1e9,tb],bad:["x",1]}}]);
ok(ECON.pressure("Riften","ore_iron",tb)<=ECON.depth("ore_iron")+1e-6,"foreign clamp");
ok(ECON.mult("Riften","ore_iron",'buy',0,tb)<=1.8,"foreign clamp mult");
// bulk lots slide: 20 sold pays less than 20× one
const S2=mk("S2",50,"Solitude"); const one=G.sellPrice(S2,{item:"ore_silver"}), lot=G.lotPrice(S2,"ore_silver",20,"sell",{item:"ore_silver"});
ok(lot<one*20,"bulk sell slides "+lot+" < "+one*20);
// selling records negative pressure
let ts=tb; while(!G.shopsOpen(ts)) ts+=600;
G.give(S2,"ore_iron",5); const row=S2.inv.find(r=>r.item==="ore_iron"); ok(/^Sold/.test(G.sell(S2,row.id,5,ts)),"sold");
ok(ECON.pressure("Solitude","ore_iron",ts)<0,"sale pushes down");
// trade runs: a master trader finds some, a novice doesn't
const M=mk("M",100,"Markarth"); M.perks={haggling:5,master_trader:1};
const N=mk("N",15,"Markarth");
const rm=ECON.routes(M,"Markarth",5,ts), rn=ECON.routes(N,"Markarth",5,ts);
console.log("master routes:",rm.map(x=>x.item+"→"+x.to+" +"+x.profit).join(", ")||"none","| novice:",rn.length);
ok(rn.length===0,"novice: no free money");
ok(ECON.towns().length>=5,"towns "+ECON.towns().length);
// report renders
const html=ECON.report(M,"Markarth",ts); ok(/Market today/.test(html),"report");
ok(typeof ECON.badge("Markarth","ore_iron")==="string","badge");
// travelling merchants ignore town prices
ok(G.buyPrice(A,"potion_health",null)>0,"null town price");
// caravan goods cheaper while it stands in town
let tc=ts, cv=null; for(let i=0;i<4000&&!cv;i++){ cv=CARAVANS.all(tc).find(x=>x.phase==="stop"); if(!cv) tc+=60; }
ok(cv,"found caravan"); const g=CARAVANS.stock(cv)[0];
ok(ECON.caravanGoods(cv.from,tc).some(x=>x.goods.includes(g)),"caravan goods listed");
console.log("economy OK; ore Markarth/Solitude buy:",G.buyPrice(N,"ore_iron","Markarth"),G.buyPrice(N,"ore_iron","Solitude"));
`,c);
