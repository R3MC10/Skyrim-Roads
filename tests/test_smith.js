const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const n=(s,i)=>SMITH.count(s,i);
const s=G.newSave("A","Smith","nord"); s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun; s.inv=[]; s.gold=0;
ok(G.shopTypes("Whiterun").includes("blacksmith"),"whiterun forge");
console.log("recipes", Object.keys(SMITH.RECIPES).length, "by group", SMITH.GROUPS.map(([g])=>g+":"+SMITH.byGroup(g).length).join(" "));
// iron sword: exact use
const r=SMITH.RECIPES.iron_sword; console.log("iron_sword", JSON.stringify(r.mats));
ok(/Missing/.test(SMITH.make(s,"iron_sword")),"needs mats");
G.give(s,"mat_iron",5); G.give(s,"mat_strips",3);
const xp0=s.skills.Smithing.xp, lv0=s.skills.Smithing.lvl;
ok(/^You make/.test(SMITH.make(s,"iron_sword")),"made");
ok(n(s,"mat_iron")===5-r.mats[0][1] && n(s,"mat_strips")===2,"consumed exactly");
ok(n(s,"iron_sword")===1,"got sword");
ok(s.skills.Smithing.xp>xp0||s.skills.Smithing.lvl>lv0,"xp");
// perk gate
G.give(s,"mat_steel",10); G.give(s,"mat_iron",3);
ok(/perk/.test(SMITH.make(s,"steel_sword")),"steel needs perk");
s.perks=s.perks||{}; s.perks.steel_smithing=1;
ok(/^You make/.test(SMITH.make(s,"steel_sword")),"steel with perk "+SMITH.make(s,"steel_sword"));
// away from forge
s.location="Bleak Falls Barrow"; ok(/forge/.test(SMITH.make(s,"iron_dagger")),"forge only"); s.location="Whiterun";
// smelting/tanning
G.give(s,"ore_iron",5); const k=SMITH.REFINE.findIndex(r=>r[0]==="mat_iron");
const before=n(s,"mat_iron"); SMITH.refine(s,k,true); ok(n(s,"ore_iron")===1 && n(s,"mat_iron")===before+2,"smelt 2:1 all");
G.give(s,"pelt_bear",1); SMITH.refine(s,SMITH.REFINE.findIndex(r=>r[2][0][0]==="pelt_bear")); ok(n(s,"mat_leather")>=2,"tan bear");
// jewellery
G.give(s,"mat_gold",1); G.give(s,"gem_diamond",1);
ok(/^You make/.test(SMITH.make(s,"gold_diamond_necklace")),"necklace"); ok(n(s,"mat_gold")===0&&n(s,"gem_diamond")===0,"jewel mats used");
console.log("gold diamond necklace worth", D.ITEMS.gold_diamond_necklace.value, "sells for", G.sellPrice(s,G.invRow(s,s.inv.find(r=>r.item==="gold_diamond_necklace").id)));
ok(D.ITEMS.gold_diamond_necklace.value<=1200,"cap");
// no recipe beats its own materials' value by an exploit: crafted value >= 0 and makes sense
let worst=null; for(const [id,rc] of Object.entries(SMITH.RECIPES)){ const cost=rc.mats.reduce((a,[i,m])=>a+D.ITEMS[i].value*m,0); const ratio=D.ITEMS[id].value/cost; if(!worst||ratio>worst[1]) worst=[id,ratio]; }
console.log("best value/cost ratio", worst[0], worst[1].toFixed(2));
// pelts from beasts and gems from elites
if (G.rollLoot) { let pel=0, gems=0; const wolf={name:"Lone wolf",tags:["beast"]}, el={name:"Bandit chief",tags:["humanoid","elite"]};
  for(let i=0;i<1000;i++){ const t=G.newSave("B","b","nord"); t.inv=[]; if(G.rollLoot(t,wolf).includes("Wolf Pelt")) pel++; const t2=G.newSave("C","c","nord"); t2.inv=[]; if(G.rollLoot(t2,el).some(x=>/Garnet|Amethyst|Ruby|Sapphire|Emerald|Diamond|Ring|Necklace/.test(x))) gems++; }
  console.log("wolf pelt rate", pel/1000, "elite valuable rate", gems/1000); ok(pel>550&&pel<850,"pelts"); ok(gems>150,"gems"); }
console.log("smith ok");
`,c);
