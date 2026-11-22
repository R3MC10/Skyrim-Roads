const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const s=G.newSave("x","X","nord"); s.gold=500; s.location="Whiterun"; s.skills.Smithing.lvl=60;
const sw=G.give(s,"steel_sword"), hb=G.give(s,"hunting_bow"), ha=G.give(s,"hide_armor"), dw=G.give(s,"dwarven_sword"), en=G.give(s,"ench|iron_helmet|health|20|0"), rb=G.give(s,"mage_robes");
for (const id of [sw,hb,ha,dw,en,rb]) { const r=G.invRow(s,id), i=TOWNS.temperInfo(s,r); console.log(D.ITEMS[r.item].name.padEnd(24), i ? (i.ingot+" have "+i.have+" | "+(i.block||"ok")) : "can't be improved"); }
console.log(TOWNS.temper(s,sw)); G.give(s,"mat_steel",2); console.log(TOWNS.temper(s,sw)); console.log(TOWNS.temper(s,sw)); console.log(TOWNS.temper(s,sw));
console.log(G.itemStats("mat_steel"), TOWNS.countItem(s,"mat_steel"));
console.log(D.SHOP_STOCK.blacksmith.slice(-4).map(i=>D.ITEMS[i].name+" "+G.buyPrice(s,i)).join(", "));
`,c);
