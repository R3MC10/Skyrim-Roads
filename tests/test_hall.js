const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","hall.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const s=G.newSave("me","Remi","nord"); s.location="Whiterun"; s.gold=20000;
const cap0=G.capacity(s), cost0=TOWNS.trainCost(s,"Smithing");
HALL.setDonors([{id:"a",name:"Ann",pts:3000},{id:"b",name:"Bo",pts:1500},{id:"bad",name:"x",pts:"lots"}], s);
ok(HALL.total()===4500 && HALL.tier()===0, "start camp "+HALL.total());
let r=HALL.donateGold(s,600); ok(r.after===1 && /Longhouse/.test(r.text), "longhouse "+r.text); ok(s.gold===19400,"gold");
ok(/Hall Builder/.test(HALL.donateGold(s,500).text) && s.titles.includes("Hall Builder"), "title");
ok(HALL.donateGold(s,999999).err, "too poor");
ok(HALL.donateGold(s,-5).err, "negative");
G.give(s,"mat_steel",4); const row=s.inv.find(x=>x.item==="mat_steel");
r=HALL.donateMat(s,row.id,4); ok(s.hallPts===1100+100 && !s.inv.some(x=>x.item==="mat_steel"), "mats "+s.hallPts);
ok(/Rested/.test(HALL.rest(s)) && G.rested(s) && s.restBonus===0.05, "rest t1");
HALL.setDonors([{id:"a",name:"Ann",pts:3000},{id:"me",name:"Remi",pts:s.hallPts},{id:"z",name:"Zed",pts:12000}], s);
ok(HALL.tier()===2, "mead hall "+HALL.total()); ok(TOWNS.trainCost(s,"Smithing")===Math.round(cost0*0.9), "train 10% "+TOWNS.trainCost(s,"Smithing")+" vs "+cost0);
G.give(s,Object.keys(D.ITEMS).find(k=>D.ITEMS[k].slot==="potion")); const p=s.inv.find(x=>D.ITEMS[x.item].slot==="potion");
if(p){ const d=HALL.deposit(s,p.id); ok(d.item,"deposit "+JSON.stringify(d)); }
ok(HALL.canTake(s), "can take"); for(let i=0;i<3;i++) HALL.took(s,"mat_iron"); ok(!HALL.canTake(s), "3 a day");
HALL.setDonors([{id:"z",name:"Zed",pts:100000}], s); ok(HALL.tier()===4 && G.capacity(s)===cap0+25, "keep carry"); ok(HALL.rest(s).includes("Well Rested") && s.restBonus===0.1, "well rested");
console.log("hall ok · top:", HALL.top(3).map(d=>d.name+" "+d.pts).join(", "), "· progress", JSON.stringify(HALL.progress()));
`,c);
