const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","guilds.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","magic.js","guide.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const mk=(lvl)=>{ const s=G.newSave("Z","Z","nord"); s.level=lvl; s.hpBonus=lvl*8; for(const k of Object.keys(s.skills)) s.skills[k].lvl=Math.min(100,15+lvl*1.8); const gear=lvl<15?["iron_sword","iron_armor","iron_helmet","iron_boots","iron_gauntlets","iron_shield"]:["steel_sword","steel_armor","steel_helmet","steel_boots","steel_gauntlets","steel_shield"]; for(const i of gear) G.equip(s,G.give(s,i)); G.give(s,"potion_health",4); G.setHealth(s,G.maxHealth(s)); return s; };
for(const [id,ix] of [["thieves",4],["thieves",8],["brotherhood",0],["brotherhood",2],["brotherhood",5],["brotherhood",6],["college",3],["companions",0]]){ const st=QUESTS.L[id].stages[ix], fd=st.obj.fight||st.obj.check.fight; const row=[];
  for(const lvl of [8,15,25,40]){ let w=0; for(let i=0;i<150;i++){ const s=mk(lvl); const e=G.scaleEnemy({...fd},s.level); const f=new G.Fight(s,e,null,G.now()); (st.obj.allies||[]).forEach(([name,dmg])=>f.allies.push({name,dmg})); f.run({t:G.now()}); if(f.won) w++; } row.push("L"+lvl+":"+Math.round(w/1.5)+"%"); }
  console.log(fd.name.padEnd(28), row.join("  ")); }
`,c);
