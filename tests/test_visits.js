const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const a=G.newSave("A","Alfa","nord"), b=G.newSave("B","Beta","nord");
ok(VISITS.record(a)===null, "no home, no record");
a.location="Riften"; a.gold=20000; ok(/key/.test(TOWNS.buyHome(a)), "buy");
a.dragons=4; a.titles=["Delver"]; VISITS.setMotto(a,"  Never <b>again</b>\\n  ");
const pot=Object.keys(D.ITEMS).find(k=>D.ITEMS[k].slot==="potion"); G.give(a,pot,2); const pr=a.inv.find(r=>r.item===pot);
TOWNS.stash(a, pr.id); ok(/display case/.test(VISITS.toggleShow(a,"Riften",0)), "show");
const rec={...VISITS.record(a), id:"A"};
ok(rec.towns[0]==="Riften" && rec.dragons===4 && rec.show.length===1 && rec.motto==="Never <b>again</b>", "record "+JSON.stringify(rec));
ok(VISITS.inTown([rec],"Riften","B").length===1 && VISITS.inTown([rec],"Riften","A").length===0 && VISITS.inTown([rec],"Whiterun","B").length===0, "inTown");
b.location="Whiterun"; ok(VISITS.giftGold(b,rec,"Riften",100).err, "wrong town");
b.location="Riften"; b.gold=500; let r=VISITS.giftGold(b,rec,"Riften",600); ok(r.err,"too poor");
r=VISITS.giftGold(b,rec,"Riften",300,"for the road"); ok(r.gift && b.gold===200 && r.gift.to==="A", "gold gift");
const g1=r.gift;
G.give(b,"mat_steel",3); const sr=b.inv.find(x=>x.item==="mat_steel"); r=VISITS.giftItem(b,rec,"Riften",sr.id,"x"); ok(r.gift && !b.inv.some(x=>x.item==="mat_steel"), "item gift");
const g2=r.gift; const st=b.inv.find(x=>true); if(st){ st.stolen=true; ok(VISITS.giftItem(b,rec,"Riften",st.id).err,"stolen refused"); }
ok(/isn't for you/.test(VISITS.receive(b,g1)), "only owner");
const gold=a.gold; ok(/300 gold/.test(VISITS.receive(a,g1)) && a.gold===gold+300, "receive gold");
const m=VISITS.receive(a,g2); ok(a.homes.Riften.chest.some(x=>x.item==="mat_steel"&&x.qty===3), "into chest: "+m);
ok(VISITS.giftNote(b,rec,"Riften","").err && VISITS.giftNote(b,rec,"Riften","hi").gift, "notes");
for(let i=0;i<5;i++){ G.give(a,"mat_iron",1); TOWNS.stash(a, a.inv.find(x=>x.item==="mat_iron").id); }
let shown=0; a.homes.Riften.chest.forEach((x,i)=>{ if(!/Take one out/.test(VISITS.toggleShow(a,"Riften",i)) && x.shown) shown++; });
ok(VISITS.record(a).show.length<=3, "max 3 shown");
console.log("visits ok ·", m);
`,c);
