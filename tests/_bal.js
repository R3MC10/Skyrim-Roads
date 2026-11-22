const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
function load(W, withMagic){ const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js",...(withMagic?["magic.js"]:[]),"mp.js"]) vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c); return c; }
function sim(c, label, rulesFor){ vm.runInContext(`
var out=[]; for (const L of [10,20,30]) { let won=0, hpL=0, N=300;
 for (let i=0;i<N;i++){ const s=G.newSave("A","A","breton"); s.level=L; s.hpBonus=L*5; s.mpBonus=L*5; const sk=Math.min(100,15+L*2.5);
  for (const k of Object.keys(s.skills)) s.skills[k].lvl=Math.max(s.skills[k].lvl, ${label==="warrior"}?(["One-Handed","Heavy Armor","Blocking"].includes(k)?sk:15):(["Destruction","Restoration","Conjuration","Alteration","Illusion"].includes(k)?sk:15));
  s.spells=Object.keys(D.SPELLS); s.inv=[];
  if (${label==="warrior"}) { for (const it of ["steel_sword","steel_armor","steel_helmet","steel_boots","steel_gauntlets","steel_shield"]) { const id=G.give(s,it); G.equip(s,id); } }
  G.setHealth(s,G.maxHealth(s));
  const e=G.scaleEnemy({name:"Bandit",danger:"medium",level:L,tags:["humanoid"],health:70+L*3,damage:7+L*0.3,gold:[1,2]},L);
  const f=new G.Fight(s,e,(${rulesFor})(L)); f.run({trySneak:false}); if(f.won){won++; hpL+=f.hp/G.maxHealth(s);} }
 out.push("L"+L+" win "+(won/N*100).toFixed(0)+"% hpLeft "+(won?hpL/won*100:0).toFixed(0)+"%"); } console.log("${label}:", out.join(" | "));`,c); }
const base=load(__GAME + "",false), mag=load(__GAME + "",true);
const war=`(L)=>[{if:"hp_below",pct:30,do:"potion:health"},{if:"always",do:"attack"}]`;
const oldMage=`(L)=>[{if:"hp_below",pct:40,do:"spell:fast_healing"},{if:"no_summon",do:"spell:conjure_familiar"},{if:"always",do:L>=20?"spell:incinerate":"spell:firebolt"},{if:"always",do:"attack"}]`;
const newMage=`(L)=>[{if:"hp_below",pct:40,do:L>=20?"spell:close_wounds":"spell:fast_healing"},{if:"first_turn",do:L>=20?"spell:flame_cloak":"spell:fire_rune"},{if:"no_summon",do:L>=25?"spell:dremora_lord":"spell:flame_atronach"},{if:"always",do:L>=20?"spell:incinerate":"spell:firebolt"},{if:"always",do:"attack"}]`;
sim(base,"warrior",war); sim(mag,"warrior",war); sim(base,"mage-old",oldMage); sim(mag,"mage-old-spells",oldMage); sim(mag,"mage-new-spells",newMage);
