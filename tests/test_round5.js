const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const s=G.newSave("x","X","breton"); s.gold=5000; s.location="Whiterun";
const fl=G.give(s,"iron_sword_flames"); const hh=G.give(s,"ench|iron_helmet|health|20|0"); console.log(D.ITEMS["ench|iron_helmet|health|20|0"].name, G.itemStats("ench|iron_helmet|health|20|0"));
console.log(ENCH.disenchant(s,fl)); console.log(ENCH.disenchant(s,hh)); console.log(JSON.stringify(s.enchants));
const sw=G.give(s,"steel_sword"); const ar=G.give(s,"steel_armor"); const g1=G.give(s,"soul_gem_common",2); const g2=G.give(s,"soul_gem_greater");
console.log(JSON.stringify(ENCH.preview(s,sw,"fire",g1)), JSON.stringify(ENCH.preview(s,sw,"fire",g2)));
console.log(ENCH.enchant(s,sw,"fire",g2)); console.log(ENCH.enchant(s,ar,"health",g1)); console.log(ENCH.enchant(s,ar,"fire",g1));
const fs_=s.inv.find(r=>r.item.startsWith("ench|steel_sword")); const ah=s.inv.find(r=>r.item.startsWith("ench|steel_armor"));
console.log("maxHealth before", G.maxHealth(s)); G.equip(s,ah.id); G.equip(s,fs_.id); console.log("after", G.maxHealth(s), JSON.stringify(fs_));
const f=new G.Fight(s,G.scaleEnemy({...D.ENCOUNTERS.find(e=>e.name==="Bandit outlaw")},1)); f.run({}); console.log(f.log[0].me, f.log[1]&&f.log[1].me);
console.log(D.SHOP_STOCK.wizard.filter(i=>i.startsWith("ench")).map(i=>D.ITEMS[i].name+" "+G.buyPrice(s,i)).join(", "));
const s2=G.clone(s); console.log(JSON.stringify(s2).length);
`,c);
