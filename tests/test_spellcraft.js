const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","magic.js","spellcraft.js","guide.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const fin=(v)=>Number.isFinite(v);
function mage(lvl){ const s=G.newSave("M"+lvl,"Mage","breton"); s.location="Winterhold"; [s.x,s.y]=WORLD.places.Winterhold; s.gold=100000; s.level=lvl;
  for(const k of ["Destruction","Restoration","Alteration","Illusion","Conjuration","Mysticism"]) s.skills[k].lvl=Math.min(100,15+lvl*2);
  s.spells=[...new Set([...s.spells,"firebolt","ice_spike","healing","fast_healing","lesser_ward","steadfast_ward","oakflesh","paralyze","fear","calm","flame_cloak","frost_rune","turn_undead","courage","soul_trap"])].filter(x=>D.SPELLS[x]); return s; }
const s=mage(30);
// components
const comps=SPELLCRAFT.components(s); const keys=comps.map(c=>c.key);
console.log("components:", keys.join(", "));
ok(keys.includes("damage:fire") && keys.includes("damage:frost") && keys.includes("heal") && keys.includes("ward"), "core components");
ok(!keys.some(k=>/utility|bound|reanimate|summon/.test(k)), "no unsupported kinds");
const fire=comps.find(c=>c.key==="damage:fire"); ok(fire.max===D.SPELLS[fire.src].amount, "limit = strongest known");
// design + cost
let d=SPELLCRAFT.design(s,[{key:"damage:fire"},{key:"damage:frost"}]); ok(!d.err && d.parts.length===2, "design "+d.err);
const sum=d.parts.reduce((a,p)=>a+p.cost,0); ok(d.base>=Math.round(sum*1.3), "premium >= 1.3");
// monotonic in strength
const lo=SPELLCRAFT.design(s,[{key:"damage:fire",amount:fire.min}]), hi=SPELLCRAFT.design(s,[{key:"damage:fire",amount:fire.max}]);
ok(lo.base<hi.base && lo.parts[0].amount===fire.min && hi.parts[0].amount===fire.max, "cost grows with strength");
ok(SPELLCRAFT.design(s,[{key:"damage:fire",amount:9999}]).parts[0].amount===fire.max, "can't exceed the source");
// limits
ok(SPELLCRAFT.design(s,[{key:"paralyze"},{key:"fear"}]).err, "no paralyze+fear");
ok(SPELLCRAFT.design(s,[{key:"heal"},{key:"heal"}]).err, "no duplicate");
ok(SPELLCRAFT.design(s,[{key:"damage:shock"}]).err, "only known effects");
// craft
s.location="Whiterun"; ok(SPELLCRAFT.craft(s,[{key:"heal"}]).err, "only at the College"); s.location="Winterhold";
const g0=s.gold; const r=SPELLCRAFT.craft(s,[{key:"damage:fire"},{key:"damage:frost"}],"Fire and Ice");
ok(r.id && s.spells.includes(r.id) && D.SPELLS[r.id].kind==="custom" && s.gold===g0-SPELLCRAFT.fee(d), "crafted & paid "+(r.err||""));
const cost=G.spellCost(s,D.SPELLS[r.id]); const partsCost=D.SPELLS[r.id].parts.reduce((a,p)=>a+G.spellCost(s,D.SPELLS[p]),0);
ok(cost>=partsCost*1.3-1 && fin(cost), "cast cost "+cost+" vs parts "+partsCost);
ok(Math.abs(SPELLCRAFT.castCost(s,d)-cost)<=2, "preview matches "+SPELLCRAFT.castCost(s,d)+" "+cost);
// casts in a fight
function fight(spellId, dual){ const f=new G.Fight(s,{name:"Bandit",health:400,damage:4,level:8,tags:["humanoid"]}); f.mp=9999; const line=f.cast(spellId,false,dual); return {f,line}; }
let out=fight(r.id); for(let i=0;i<30 && !(out.f.ehp<400 && out.f.slowed>=1);i++) out=fight(r.id); ok(/Fire and Ice/.test(out.line) && out.f.ehp<400 && fin(out.f.ehp) && out.f.slowed>=1, "fire+frost hits and slows: "+out.line);
const dmgSingle=400-out.f.ehp; let tries=0, dualDmg=0; for(let i=0;i<40;i++){ const o=fight(r.id,true); dualDmg=Math.max(dualDmg,400-o.f.ehp); }
ok(dualDmg>dmgSingle*1.5, "dual cast stronger "+dualDmg+" vs "+dmgSingle);
ok(MAGIC.dualable(D.SPELLS[r.id]), "dualable");
const r2=SPELLCRAFT.craft(s,[{key:"heal"},{key:"ward"}],"Mend & Guard"); ok(r2.id,"heal+ward "+(r2.err||""));
{ const f=new G.Fight(s,{name:"Fire mage",health:200,damage:20,level:8,tags:["humanoid","mage"]}); f.mp=999; f.hp=20; const line=f.cast(r2.id,false,false); ok(f.hp>20 && f.ward>0 && fin(f.hp), "heals and wards: "+line); }
// tactics rule using it
const lo2=G.loadout(s); lo2.rules=[{if:"always",pct:50,do:"spell:"+r.id},{if:"always",pct:50,do:"attack"}];
const res=G.Fight ? (()=>{ const f=new G.Fight(s,{name:"Bandit",health:120,damage:5,level:6,tags:["humanoid"]}); s._test=true; const x=f.run? f.run(): null; s._test=false; return f; })() : null;
ok(res && (res.log||[]).some(l=>/Fire and Ice/.test(JSON.stringify(l))), "tactics cast it in a full fight");
// save/load roundtrip
const saved=JSON.parse(JSON.stringify(s)); delete D.SPELLS[r.id]; delete D.SPELLS[r.id+"~0"]; delete D.SPELLS[r.id+"~1"];
G.migrate(saved); ok(D.SPELLS[r.id] && D.SPELLS[r.id+"~1"] && saved.spells.filter(x=>x===r.id).length===1, "re-registered on load");
// delete
ok(/fade/.test(SPELLCRAFT.forget(s,r2.id)) && !s.spells.includes(r2.id) && !D.SPELLS[r2.id], "forget");
// max 8
for(let i=0;i<10;i++) SPELLCRAFT.craft(s,[{key:"heal",amount:20+i}],"H"+i);
ok(s.customSpells.length===SPELLCRAFT.MAX, "cap "+s.customSpells.length);
// balance: per magicka never better than the bought spell (within 15%)
const b=mage(50); let worst=0;
for(const cmp of SPELLCRAFT.components(b)){ if(!cmp.scales) continue; const dd=SPELLCRAFT.design(b,[{key:cmp.key}]); const crafted=dd.parts[0].amount/SPELLCRAFT.castCost(b,dd); const bought=D.SPELLS[cmp.src].amount/G.spellCost(b,D.SPELLS[cmp.src]); worst=Math.max(worst, crafted/bought); }
console.log("best crafted/bought value per magicka:", worst.toFixed(3)); ok(worst<=1.15, "no cheaper than buying");
// old save without customSpells
const old=G.newSave("O","Old","nord"); delete old.customSpells; G.migrate(old); ok(Array.isArray(old.spells), "old save ok");
// MP stats still fine
ok(fin(MP.stats(s).dmg), "mp stats");
console.log("spellcraft ok · fire&ice cost", cost, "fee", SPELLCRAFT.fee(d));
`,c);
