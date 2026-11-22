const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const s=G.newSave("x","X","nord"); s.gold=20000; s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun;
console.log(TOWNS.buyHome(s)); s.thaneWhiterun=true; console.log(TOWNS.buyHome(s), s.gold);
const sw=G.give(s,"steel_sword"); G.invRow(s,sw).temper=2; G.invRow(s,sw).tq=2; G.give(s,"potion_health",3);
console.log(TOWNS.stash(s,sw)); console.log(TOWNS.stash(s,s.inv.find(r=>r.item==="potion_health").id)); console.log(JSON.stringify(TOWNS.home(s).chest));
const d=G.die(s,"test"); console.log("bag items after death:", d.bag ? d.bag.items.length : 0, "chest still:", TOWNS.home(s,"Whiterun").chest.length);
s.location="Whiterun"; console.log(TOWNS.unstash(s,0), JSON.stringify(s.inv.find(r=>r.item==="steel_sword")));
console.log(TOWNS.sleepHome(s), s.restBonus); console.log(TOWNS.harvest(s)); console.log(TOWNS.harvest(s));
s.location="Riften"; console.log(TOWNS.buyHome(s));
`,c);
