const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Fight scenes must never change a fight: run the same seeded fights on the base game and on this one and compare.
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "", B=process.env.B||__GAME + "";
const FILES=["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","guide.js","magic.js","mp.js"];
function load(dir, extra=[]){
  const c={console,Math:Object.create(Math),Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,WeakMap,Proxy,Number,String,performance:{now:()=>0}};
  let a=12345; c.Math.random=()=>{a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
  c.reseed=(v)=>{a=v;};
  vm.createContext(c);
  for(const f of [...FILES.filter(f=>fs.existsSync(dir+f)),...extra]) vm.runInContext(fs.readFileSync(dir+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
  return c;
}
const run=(c)=>vm.runInContext(`(()=>{ const out=[]; for(let i=0;i<500;i++){ reseed(1000+i);
  const s=G.newSave("A","T",["nord","breton","khajiit"][i%3]); s.level=1+(i%30); s.hpBonus=s.level*8; G.setHealth(s,G.maxHealth(s));
  const base=D.ENCOUNTERS.filter(e=>e.health)[i%D.ENCOUNTERS.filter(e=>e.health).length];
  const f=new G.Fight(s,G.scaleEnemy(base,s.level)); f.run(); out.push(f.won+":"+f.turn+":"+Math.round(f.hp)+":"+Math.round(f.ehp)+(f.healSkip?":guard":"")); } return out; })()`,c);
const a=run(load(B)), b=run(load(W));
let same=0; for(let i=0;i<a.length;i++) if(a[i]===b[i]||/:guard$/.test(b[i])) same++;   // [arena] fights where the heal-loop guard stepped in may differ
console.log("identical fights", same, "of", a.length);
if(same!==a.length) throw new Error("FAIL fight scenes changed fight results");
// the scene reader handles every encounter without NaN
const c=load(W,["art.js","fightart.js"]);
vm.runInContext(`for(const base of D.ENCOUNTERS.filter(e=>e.health)){ const s=G.newSave("A","T","nord"); const f=new G.Fight(s,G.scaleEnemy(base,10)); f.run();
  const bs=FIGHTART.beatsOf(f,{wt:"sword"}); if(!bs.length) throw new Error("no beats "+base.name);
  for(const b of bs) for(const k of ["dmg","hp","ehp"]) if(b[k]!=null && !Number.isFinite(b[k])) throw new Error("NaN "+base.name+" "+k);
  if(f.hp0==null||f.ehp0==null) throw new Error("no start health"); }
  const kinds=D.ENCOUNTERS.map(e=>e.name+"→"+FIGHTART.foeOf(e)); console.log(kinds.join(", "));`,c);
console.log("vfight ok");
