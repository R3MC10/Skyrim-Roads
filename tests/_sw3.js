const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","guilds.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","magic.js","guide.js","mp.js"]) if(fs.existsSync(W+f)) vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
const src=fs.readFileSync(__dirname + "/" + "test_bal_sim.js","utf8"); const a=src.indexOf("const LEVELS"), b=src.indexOf("const BUILDS");
vm.runInContext(src.slice(a,b)+`
for(const [id,ix] of [["thieves",4],["thieves",8],["brotherhood",0],["brotherhood",2],["brotherhood",5],["brotherhood",6],["college",3],["companions",0],["main",2],["main",5]]){ const st=QUESTS.L[id].stages[ix], fd=st.obj.fight||st.obj.check.fight; const row=[];
  for(const L of [5,10,20,30,40]){ let w=0,n=0; for(const bd of ["warrior","archer","mage"]) for(let i=0;i<40;i++){ const s=make(bd,L); const e=G.scaleEnemy({...fd},s.level); const f=new G.Fight(s,e,null,G.now()); (st.obj.allies||[]).forEach(([name,dmg])=>f.allies.push({name,dmg})); f.run({t:G.now()}); n++; if(f.won) w++; } row.push("L"+L+":"+String(Math.round(100*w/n)).padStart(3)+"%"); }
  console.log((id+"/"+fd.name).padEnd(40), row.join(" ")); }
`,c);
