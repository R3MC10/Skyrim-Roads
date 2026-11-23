// Wards: a magic shield that stays up every turn until it breaks, refilled by casting it again; physical blows pass it.
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","perkfx.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","magic.js","guide.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
let n=0; const ok=(c,m)=>{ n++; if(!c) throw new Error("FAIL "+m); };
function mage(){ const s=G.newSave("M","Mage","breton"); s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun; s.level=20; s.mpBonus=400; for(const k of ["Destruction","Restoration","Alteration","Conjuration","Illusion"]) s.skills[k].lvl=60; s.spells=Object.keys(D.SPELLS); G.setHealth(s,G.maxHealth(s)); s._test=false; return s; }
const foe=(o={})=>({name:"Necromancer",danger:"medium",level:10,tags:["humanoid","mage"],health:900,damage:20,gold:[5,10],hp:900,...o});
// cast: a ward with a max
let s=mage(), f=new G.Fight(s,foe());
const t1=MAGIC.KINDS.ward(f, D.SPELLS.greater_ward); ok(f.ward>0 && f.wardMax===f.ward, "ward rises "+t1); ok(/soaks magic until it breaks/.test(t1), "says it lasts");
const full=f.ward;
// it lasts turn after turn: several mage hits, it only shrinks by what it soaks
let hits=0; for(let i=0;i<20 && f.ward>0;i++){ f.hp=G.maxHealth(s); const b=f.ward; const t=f.enemyTurn(); if(/ward soaks/.test(t)){ hits++; ok(f.ward<b, "soaks "+t); } }
ok(hits>=2, "the ward stays up over more than one turn ("+hits+" soaks)");
// broken at some point, and the log says so
f.ward=5; f.wardMax=full; let broke=""; for(let i=0;i<20;i++){ f.hp=G.maxHealth(s); const t=f.enemyTurn(); if(/ward soaks/.test(t)){ broke=t; break; } }
ok(/breaks/.test(broke) && f.ward===0, "a ward runs out and breaks: "+broke);
// recast refills to full
f.ward=full*0.3; const t2=MAGIC.KINDS.ward(f, D.SPELLS.greater_ward); ok(Math.abs(f.ward-full)<0.01, "recast refills "+t2); ok(/back to full/.test(t2), "says refilled");
// a weaker ward never shrinks a stronger one
MAGIC.KINDS.ward(f, D.SPELLS.lesser_ward); ok(Math.abs(f.ward-full)<0.01, "weaker recast keeps the stronger ward");
// physical blows from a plain bandit pass it
s=mage(); f=new G.Fight(s,foe({name:"Bandit",tags:["humanoid"]})); MAGIC.KINDS.ward(f, D.SPELLS.greater_ward); const w0=f.ward;
for(let i=0;i<6;i++){ f.hp=G.maxHealth(s); f.enemyTurn(); } ok(f.ward===w0, "a sword blow doesn't touch the ward");
// a foe throwing a spell (eMagic) is stopped by it
f.eMagic=true; let got=false; for(let i=0;i<10;i++){ f.hp=G.maxHealth(s); if(/ward soaks/.test(f.enemyTurn())) { got=true; break; } } ok(got, "a spell from any foe hits the ward");
// Ward Mender: stronger, mends each turn
s=mage(); s.perks=s.perks||{}; PERKS.give ? PERKS.give(s,"ward_mender") : (s.perks.ward_mender=1);
f=new G.Fight(s,foe()); MAGIC.KINDS.ward(f, D.SPELLS.greater_ward); ok(f.ward>full*1.2, "Ward Mender: 25% stronger "+f.ward+" vs "+full);
f.ward=f.wardMax/2; const line={me:"",them:""}; MAGIC.tick(f,line); ok(f.ward>f.wardMax/2 && /ward mends/.test(line.me), "Ward Mender mends "+line.me);
console.log("ward ok · "+n+" checks");
`,c);
