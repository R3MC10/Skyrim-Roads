const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","guide.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const cnt=(s,i)=>s.inv.filter(r=>r.item===i).reduce((a,r)=>a+r.qty,0);
function archer(){ const s=G.newSave("A","Robin","bosmer"); s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun; s.inv=[]; s.ammoV=1; const b=G.give(s,"hunting_bow"); G.equip(s,b); s.skills.Archery.lvl=30; return s; }
const enemy=()=>G.scaleEnemy({name:"Dummy",danger:"low",level:5,tags:["humanoid"],health:400,damage:1,gold:[0,0]},5);
// damage: none < iron < elven
let s=archer(); let f=new G.Fight(s,enemy()); const dNone=f.weaponDamage();
G.give(s,"arrow_iron",50); f=new G.Fight(s,enemy()); const dIron=f.weaponDamage();
G.give(s,"arrow_elven",5); f=new G.Fight(s,enemy()); const dElven=f.weaponDamage();
console.log("bow damage: no arrows",dNone.toFixed(1),"iron",dIron.toFixed(1),"elven",dElven.toFixed(1));
ok(dNone<dIron*0.5 && dElven>dIron,"damage order");
// iron arrows = old balance (formula already had an iron arrow)
ok(Math.abs(dIron - F.weaponDamage(7,G.skill(s,"Archery"),true)*(1+G.fxSum(s,"dmg:Archery")/100))<0.01,"iron == old");
// consumption: best ammo first, about 2/3 used per shot
s=archer(); G.give(s,"arrow_iron",200); f=new G.Fight(s,enemy()); f.run(); f.apply(G.now());
const shots=f.log.filter(l=>/Attack|Power attack|Sneak/.test(typeof l==="string"?l:JSON.stringify(l))).length;
const used=200-cnt(s,"arrow_iron"); console.log("fight turns", f.turn, "arrows used", used);
ok(used>0 && used<=f.turn*2,"arrows consumed");
// running out: bash label
s=archer(); G.give(s,"arrow_iron",1); f=new G.Fight(s,enemy()); f.run(); f.apply(G.now());
ok(cnt(s,"arrow_iron")<=1,"used last");
ok(JSON.stringify(f.log).includes("Bashes with the bow"),"bash when out");
// crossbow + bolts; arrows don't fit crossbows
s=archer(); s.inv=[]; const cb=G.give(s,"crossbow"); G.equip(s,cb); G.give(s,"arrow_iron",50);
ok(/No bolts/.test(AMMO.status(s).text),"crossbow needs bolts: "+AMMO.status(s).text);
G.give(s,"bolt_steel",30); f=new G.Fight(s,enemy()); const dCb=f.weaponDamage(); f.run(); f.apply(G.now());
ok(cnt(s,"arrow_iron")===50 && cnt(s,"bolt_steel")<30,"bolts used, arrows untouched"); console.log("crossbow+steel bolt",dCb.toFixed(1));
// migration once
const old=G.newSave("B","Old","nord"); old.inv=[]; G.give(old,"long_bow"); delete old.ammoV;
G.migrate(old); ok(cnt(old,"arrow_iron")===40,"migration arrows"); G.migrate(old); ok(cnt(old,"arrow_iron")===40,"only once");
const nob=G.newSave("C","NoBow","nord"); nob.inv=[]; delete nob.ammoV; G.migrate(nob); ok(cnt(nob,"arrow_iron")===0 && nob.ammoV===1,"no bow no gift");
// forge: 24 arrows
const sm=G.newSave("D","Smith","nord"); sm.location="Whiterun"; sm.inv=[]; G.give(sm,"mat_iron",1); G.give(sm,"mat_firewood",1);
const m=SMITH.make(sm,"arrow_iron"); ok(/24 Iron Arrows/.test(m) && cnt(sm,"arrow_iron")===24 && cnt(sm,"mat_iron")===0,"craft 24: "+m);
// loot gives a handful
let tot=0,n=0; for(let i=0;i<3000;i++){ const t=G.newSave("E","e","nord"); t.inv=[]; G.rollLoot(t,{name:"B",tags:["humanoid"]}); const q=cnt(t,"arrow_iron"); if(q){tot+=q;n++;} } console.log("iron arrow drops", n, "avg", (tot/n).toFixed(1)); ok(tot/n>=6,"handful");
// tomes
const w=G.newSave("F","Mage","breton"); w.location="Winterhold"; [w.x,w.y]=WORLD.places.Winterhold; w.gold=5000; w.inv=[]; w.skills.Destruction.lvl=75;   // [spellbook] Expert tomes show up at Destruction 75, like Skyrim
ok(G.shopStock("Winterhold").includes("tome_incinerate") && !G.shopStock("Riverwood").includes("tome_incinerate"),"college only");
ok(TOMES.stockAt("Whiterun","general").includes("tome_flames"),"belethor");
let t=G.now(); while(!G.shopsOpen(t)) t+=600;
console.log(G.buy(w,"tome_incinerate",1,t)); const row=w.inv.find(r=>r.item==="tome_incinerate"); ok(row,"bought tome");
console.log(G.readTome(w,row.id)); ok(w.spells.includes("incinerate") && !cnt(w,"tome_incinerate"),"learned");
// new spells work in a fight
w.spells.push("storm_atronach","ironflesh","close_wounds","pacify"); w.mpBonus=500;
const L=G.loadout(w); L.rules=[{if:"always",do:"spell:storm_atronach"},{if:"always",do:"spell:incinerate"},{if:"always",do:"attack"}];
f=new G.Fight(w,enemy()); f.run(); const lg=JSON.stringify(f.log); ok(/Conjure Storm Atronach/.test(lg) && /Incinerate/.test(lg),"new spells cast");
// guide
const g=G.newSave("G","New","nord"); ok(GUIDE.progress(g).done===0,"guide 0"); GUIDE.mark(g,"trade"); g.friends={x:{name:"x"}}; ok(GUIDE.progress(g).done===2,"guide ticks");
console.log("misc ok");
`,c);
