const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// mounted combat (horseback.js)
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
let sd=+(process.env.SEED||7)>>>0; const SMATH=Object.create(Math); SMATH.random=()=>{ sd=(sd+0x6D2B79F5)>>>0; let t=sd; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };   // seeded dice: the balance check below is the same every run (SEED=n to try others)
const c={console,Math:SMATH,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","horseback.js","mountfight.js","hall.js","bounty.js","mp.js","ammo.js"])
  if(fs.existsSync(W+f)) vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const T=Date.now()/1000;
function hero(weapon, horse=true){
  const s=G.newSave("me"+Math.random(),"Remi","nord"); s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun; s.gold=10000; s._test=true;
  if(weapon){ G.give(s,weapon); G.equip(s,s.inv[s.inv.length-1].id); }
  if(weapon==="hunting_bow") G.give(s,"arrow_iron",200);
  if(horse) HORSES.buy(s,"Frost","bay");
  return s;
}
const foe=(hp=400,dmg=8,tags=["humanoid"])=>({name:"Bandit",health:hp,hp,damage:dmg,tags,gold:[0,0]});
ok(D.CONDITIONS?.mounted || (D.RULE_IFS||D.IFS||{}).mounted || /mounted/.test(JSON.stringify(D)), "mounted condition listed");

// 1. a charge opens the fight: sure hit, bigger than a normal swing (x1.2 since the riding balance pass, so 1.4x an average swing with its misses)
{ let charged=0, n=0, d1=0, d0=0;
  for(let i=0;i<200;i++){
    const s=hero("iron_sword"), f=new G.Fight(s,foe(),null,T); ok(HORSEBACK.engage(f,T),"engaged when riding");
    f.run({t:T,trySneak:false,maxTurns:1});
    if(/Mounted charge/.test(f.log[0].me)) { charged++; d1+=400-f.ehp; }
    const s2=hero("iron_sword",false), f2=new G.Fight(s2,foe(),null,T); ok(!HORSEBACK.engage(f2,T),"no horse, no mount"); f2.run({t:T,trySneak:false,maxTurns:1}); d0+=400-f2.ehp; n++;
  }
  ok(charged===200, "always a charge on turn 1: "+charged);
  ok(d1/charged > 1.4*d0/n, "charge hits harder "+(d1/charged).toFixed(1)+" vs "+(d0/n).toFixed(1));
}
// 2. riding bonus after the charge (sword), stamina runs out
{ const s=hero("iron_sword"), f=new G.Fight(s,foe(5000,0),null,T); HORSEBACK.engage(f,T); f.run({t:T,trySneak:false,maxTurns:30});
  ok(f.log.some(l=>/from the saddle/.test(l.me)), "saddle bonus lines");
  ok(f.mount.sp>=0 && f.mount.sp<=HORSEBACK.SP_MAX, "horse stamina in range "+f.mount.sp);
  const s3=hero("iron_sword"); s3.horse.hp=200; const f3=new G.Fight(s3,foe(5000,0),null,T); HORSEBACK.engage(f3,T); f3.mount.sp=0; f3.mount.charged=true; f3.turn=2; f3.attack(true);
  ok(f3.mount.winded, "winded horse: no stamina left");
}
// 3. spear charges hardest, bow gets a bonus, two-hander makes you dismount
{ ok(HORSEBACK.CHARGE.spear>HORSEBACK.CHARGE.def && HORSEBACK.BONUS.bow>1 && HORSEBACK.BONUS.spear>HORSEBACK.BONUS.sword, "tuning");
  const s=hero("iron_greatsword"), f=new G.Fight(s,foe(),null,T);
  ok(!HORSEBACK.engage(f,T) && f.mount.foot && /swing down/.test(f.log[0].me), "two-hander fights on foot");
  f.run({t:T,trySneak:false}); f.apply(T); ok(HORSES.riding(s), "back in the saddle after");
  const b=hero("hunting_bow"), fb=new G.Fight(b,foe(5000,0),null,T); ok(HORSEBACK.engage(fb,T),"bow mounted"); fb.run({t:T,trySneak:false,maxTurns:6}); ok(/Mounted charge/.test(fb.log[0].me),"mounted archer charge: "+fb.log[0].me);
}
// 4. foes go for the horse; it goes down (never dies), you're thrown and keep fighting
{ let downs=0, hurt=0;
  for(let i=0;i<300;i++){
    const s=hero("iron_sword"), f=new G.Fight(s,foe(3000,60,["big","giant"]),null,T); HORSEBACK.engage(f,T);
    f.run({t:T,trySneak:false,maxTurns:20});
    const msgs=f.apply(T);
    ok(s.horse, "horse never deleted");
    if(f.mount.downTurn){ downs++; ok(f.log.some(l=>/thrown clear/.test(l.them)), "thrown line"); ok(HORSES.downed(s) && s.horse.hp===0 && msgs.some(m=>/is downed/.test(m)), "downed, stays with you"); ok(!HORSES.riding(s), "not riding after");
      const after=f.log.filter(l=>l.turn>f.mount.downTurn); ok(after.every(l=>!/saddle|charge/.test(l.me)), "on foot after the fall"); }
    else if(f.mount.hits){ hurt++; ok(s.horse.hp<HORSES.maxHp(s.horse), "horse hp written back"); }
  }
  ok(downs>0 && hurt>=0, "downs "+downs+" hurt "+hurt);
  console.log("downs/300 vs giants:", downs, "hurt only:", hurt);
}
// 5. tactics condition
{ const s=hero("iron_sword"), f=new G.Fight(s,foe(),null,T); HORSEBACK.engage(f,T); ok(f.cond({if:"mounted"}), "mounted cond true"); f.mount.up=false; ok(!f.cond({if:"mounted"}), "false after fall"); }
// 6. a full road encounter on horseback through the engine
{ let mounted=0;
  for(let i=0;i<40;i++){
    const s=hero("steel_sword"); s.level=10;
    s.trip={status:"encounter",encounter:{...foe(80,5),danger:"medium",text:"x",hold:"Whiterun"},path:[[s.x,s.y]],idx:0,lastTick:T,log:[]};
    const r=G.encounterAction(s,"fight",T); if(r.fight && r.fight.mount) mounted++;
  }
  ok(mounted===40, "road fights engage the horse "+mounted);
  const n=HORSEBACK.note(hero("iron_sword")); ok(/charge/.test(n), "encounter hint");
}
// 7. balance: win rate for a mid hero vs equal foe, riding vs walking
{ const run=(ride)=>{ let w=0; for(let i=0;i<300;i++){ const s=hero("steel_sword",ride); const f=new G.Fight(s,foe(140,14),null,T); if(ride) HORSEBACK.engage(f,T); if(f.run({t:T,trySneak:false})) w++; } return w/300; };
  const a=run(true), b=run(false); console.log("win rate riding", a.toFixed(2), "walking", b.toFixed(2));
  ok(a>=b-0.05, "riding is not worse"); ok(a-b<0.45, "riding is not a cheat");
}
console.log("horseback ok");
`,c);
