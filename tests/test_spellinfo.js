const __GAME = process.env.W || require("path").join(__dirname, "../game/");
/* The Magic menu's numbers (MAGIC.info) equal what the spell really does in a fight, single and dual cast. */
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const M=Object.create(Math); let RNG=0.5; M.random=()=>RNG;
const c={console,Math:M,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","magic.js","perkfx.js","skillinfo.js"]) if(fs.existsSync(W+f)) vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c,{filename:f});
c.RNG=()=>RNG;
const out=vm.runInContext(`
let n=0; const ok=(v,m)=>{ n++; if(!v) throw new Error("FAIL "+m); };
function mage(sk=60, perks={}){ const s=G.newSave("M","Mage","breton"); s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun; s.level=30; s.mpBonus=900;
  for(const k of ["Destruction","Restoration","Alteration","Conjuration","Illusion"]) s.skills[k].lvl=sk; s.spells=Object.keys(D.SPELLS); s.perks={...perks}; G.setHealth(s,G.maxHealth(s)); return s; }
const foe=()=>({name:"Bandit",danger:"medium",level:5,tags:["humanoid"],health:5000,damage:8,gold:[5,10],hp:5000});
const num=(parts,re)=>{ for(const p of parts){ const m=re.exec(p.t); if(m) return +m[1]; } return null; };
const cases=[["flames","damage"],["firebolt","damage"],["ice_spike","damage"],["sparks","damage"],["healing","heal"],["fast_healing","heal"],["oakflesh","armor"],["ironflesh","armor"],["conjure_familiar","summon"],["flame_atronach","summon"],["fire_rune","rune"],["flame_cloak","cloak"],["lesser_ward","ward"]];
const builds=[{}, {augmented_flames:2,regeneration:1,mage_armor:2,summoner:1,twin_souls:1,elemental_potency:1}];
for(const pk of builds) for(const [id,kind] of cases) for(const dual of [false,true]){
  if(!D.SPELLS[id]) continue; const sp=D.SPELLS[id]; if(dual && !MAGIC.dualable(sp)) continue;
  const s=mage(60,pk), inf=MAGIC.info(s,id), parts=dual?inf.dual:inf.single;
  const f=new G.Fight(s,foe(),[{if:"always",do:"attack"}]); f.mp=99999; f.hp=10; const mp0=f.mp, hp0=f.hp, e0=f.ehp;
  f.cast(id,false,dual);
  const used=mp0-f.mp; ok(Math.round(used)===(dual?inf.dualCost:inf.cost), id+(dual?" dual":"")+" cost shown "+(dual?inf.dualCost:inf.cost)+" vs used "+used);
  const tag=id+(dual?" (dual)":"")+" "+JSON.stringify(pk);
  if(kind==="damage") ok(Math.round(e0-f.ehp)===num(parts,/^(\\d+) \\w+ damage/), tag+" dmg "+(e0-f.ehp)+" vs "+JSON.stringify(parts));
  if(kind==="heal") ok(Math.round(Math.min(G.maxHealth(s),f.hp)-hp0)===Math.min(G.maxHealth(s)-hp0,num(parts,/^\\+(\\d+) health/)), tag+" heal "+(f.hp-hp0));
  if(kind==="armor") ok(Math.round(f.armorSpell)===num(parts,/^\\+(\\d+) armor/), tag+" armor "+f.armorSpell);
  if(kind==="summon"){ ok(Math.round(f.summonDmg)===num(parts,/: (\\d+) damage a turn/), tag+" summon dmg "+f.summonDmg); ok(f.summonTurns===num(parts,/^(\\d+) turns/), tag+" summon turns"); }
  if(kind==="rune") ok(Math.round(f.rune.dmg)===num(parts,/^(\\d+) \\w+ damage when/), tag+" rune "+f.rune.dmg);
  if(kind==="cloak") ok(Math.round(f.cloak.dmg)===num(parts,/^(\\d+) \\w+ damage a turn/)&&f.cloak.turns===num(parts,/^(\\d+) turns/), tag+" cloak");
  if(kind==="ward") ok(Math.round(f.ward)===num(parts,/ward soaks (\\d+)/), tag+" ward "+f.ward);
}
// dual cast costs 2.8x and is 2.2x stronger
{ const s=mage(60), i=MAGIC.info(s,"firebolt"); ok(i.dualCost===Math.round(G.spellCost(s,D.SPELLS.firebolt)*MAGIC.DUAL_COST),"dual cost 2.8x"); ok(num(i.dual,/^(\\d+) fire/)===Math.round(G.spellDamage(s,{...D.SPELLS.firebolt,amount:D.SPELLS.firebolt.amount*MAGIC.DUAL_POWER})),"dual power"); }
// html has colour classes
{ const h=MAGIC.infoHTML(mage(60),"firebolt"); ok(/nv-fire/.test(h)&&/nv-mana/.test(h)&&/Dual cast/.test(h),"html colours"); ok(/nv-heal/.test(MAGIC.infoHTML(mage(60),"healing")),"heal green"); ok(/nv-debuff/.test(MAGIC.infoHTML(mage(60),"fear")),"debuff red"); }
// every spell's info is clean
for(const id of Object.keys(D.SPELLS)){ const i=MAGIC.info(mage(40),id); const t=JSON.stringify(i); ok(!/NaN|undefined|Infinity/.test(t),"clean "+id+" "+t); }
// skills: only the current value, no "at 100" ladders
for(const sk of D.ALL_SKILLS){ const g=SKILLINFO.get(mage(40),sk); for(const l of g.now) ok(!/ at \\d+|→/.test(l.replace(/Next level:.*/,"")),"current only "+sk+": "+l); }
// perks: current rank only, plus the next rank's numbers
{ const s=mage(60,{armsman:2,bladesman:1}); ok(PERKS.nowText(s,"armsman")==="One-handed weapons do 40% more damage. Next: 60%.", PERKS.nowText(s,"armsman"));
  ok(!/\\d+\\/\\d+/.test(PERKS.nowText(s,"bladesman")) && /Next: 15% · 50%/.test(PERKS.nowText(s,"bladesman")), PERKS.nowText(s,"bladesman"));
  for(const id of Object.keys(PERKS.BY_ID)) for(let r=0;r<=PERKS.BY_ID[id].ranks;r++){ const t=PERKS.nowText({perks:{[id]:r}},id); ok(!/NaN|undefined/.test(t)&&(PERKS.BY_ID[id].ranks===1||!/\\d\\/\\d+%/.test(t.replace(/Blocking\\/20|Spear\\/20/g,""))),"perk "+id+" r"+r+": "+t); } }
"spellinfo ok · "+n+" checks";`,c);
console.log(out);
