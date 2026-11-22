const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
let nan=0, wins=0, n=0, errs=0;
const weapons=Object.keys(D.ITEMS).filter(k=>D.ITEMS[k].slot==="weapon");
for(let k=0;k<1500;k++){
  const s=G.newSave("p"+k,"T","nord"); s.level=30; for(const sk of Object.values(s.skills)) sk.lvl=70+Math.floor(Math.random()*31);
  s.spells=Object.keys(D.SPELLS);
  let guard=0; while(PERKS.pointsLeft(s)>0 && guard++<500){ const ids=Object.keys(PERKS.BY_ID); const id=ids[Math.floor(Math.random()*ids.length)]; PERKS.take(s,id); }
  const w=weapons[k%weapons.length]; const id=G.give(s,w); G.equip(s,id);
  for(const a of ["steel_armor","steel_helmet","hide_boots","leather_bracers"]){G.give(s,a);G.equip(s,s.inv[s.inv.length-1].id);}
  G.loadout(s).rules=[{if:"first_turn",do:"spell:conjure_familiar"},{if:"hp_below",pct:40,do:"spell:fast_healing"},{if:"enemy_undead",do:"spell:sun_fire"},{if:"sp_above",pct:60,do:"power_attack"},{if:"always",do:k%3?"attack":"spell:fireball"}];
  G.setHealth(s,G.maxHealth(s));
  try{
  const e=G.scaleEnemy({...DUNGEONS.ENEMY.deathlord, tags:["undead","elite","big","mage"], red: k%2?0.3:0}, 30);
  const f=new G.Fight(s,e,null); if(k%4===0) f.allies=[{name:"Ally",dmg:10}]; f.run({}); f.apply(); n++; if(f.won)wins++;
  if(!isFinite(f.ehp)||!isFinite(f.hp)||!isFinite(G.curHealth(s))) { nan++; if(nan<3) console.log("NaN", w, JSON.stringify(f.log.slice(0,3))); }
  G.buyPrice(s,"steel_sword"); G.sellPrice(s,s.inv[0]); if(!isFinite(G.speed(s))) nan++;
  } catch(x){ errs++; if(errs<3) console.log(x.stack); }
}
console.log("fights",n,"won",wins,"nan",nan,"errs",errs);
`,c);
