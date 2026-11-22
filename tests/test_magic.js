const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","magic.js","guide.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
function mage(lvl=1, sk=15){ const s=G.newSave("M","Mage","breton"); s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun; s.level=lvl; s.mpBonus=400; for(const k of ["Destruction","Restoration","Alteration","Conjuration","Illusion"]) s.skills[k].lvl=sk; s.spells=Object.keys(D.SPELLS); G.setHealth(s,G.maxHealth(s)); s._test=false; return s; }
const foe=(o={})=>({name:"Bandit",danger:"medium",level:5,tags:["humanoid"],health:200,damage:8,gold:[5,10],hp:200,...o});
const fight=(s,e,rules,opts={})=>{ const f=new G.Fight(s,e,rules); f.run({trySneak:false,...opts}); return f; };
const rule=(d,cond="always")=>[{if:cond,do:d},{if:"always",do:"attack"}];
// every spell resolves without NaN
let n=0; for(const id of Object.keys(D.SPELLS)){ const s=mage(30,100); const f=fight(s,foe({tags:["humanoid","undead"]}),rule("spell:"+id,"first_turn")); for(const l of f.log){ ok(!/NaN|undefined/.test(l.me+l.them),"spell "+id+": "+l.me+" / "+l.them); } ok(Number.isFinite(f.hp)&&Number.isFinite(f.ehp),"finite "+id); n++; }
console.log("spells", n, "new", MAGIC.NEW.length, "by school", ["Destruction","Restoration","Alteration","Conjuration","Illusion"].map(k=>k+":"+MAGIC.NEW.filter(r=>r[2]===k).length).join(" "));
// cloak ticks
let s=mage(20,100), f=fight(s,foe(),rule("spell:flame_cloak","first_turn")); ok(f.log.slice(1,4).every(l=>/Flame Cloak \\d+/.test(l.me)),"cloak ticks "+f.log[1].me);
// rune
s=mage(20,100); f=fight(s,foe(),rule("spell:fire_rune","first_turn")); ok(f.log.some(l=>/steps on your Fire Rune/.test(l.them)),"rune");
// paralyze
s=mage(20,100); f=fight(s,foe({health:400,hp:400}),rule("spell:paralyze","first_turn")); ok(f.log.slice(1,3).some(l=>/paralyzed/.test(l.them)) || /resists/.test(f.log[0].me),"paralyze "+f.log[0].me+" | "+f.log[1].them);
// turn undead ends fight, no loot
s=mage(20,100); const und=foe({name:"Draugr",tags:["undead"],level:5}); f=fight(s,und,rule("spell:turn_undead","first_turn")); ok(f.won && f.turn===1 && und.fled && G.rollLoot(s,und).length===0,"turned "+f.log[0].me);
// fear: no attacks for N turns
s=mage(20,100); f=fight(s,foe({health:900,hp:900}),rule("spell:fear","first_turn")); ok(/cowers/.test(f.log[0].me) && f.log.slice(0,3).every(l=>/cowers|steps/.test(l.them)),"fear "+f.log[0].them);
// ward soaks spell damage from casters
s=mage(20,100); f=fight(s,foe({name:"Necromancer",health:900,hp:900,damage:20}),rule("spell:greater_ward","first_turn")); ok(f.log.some(l=>/ward soaks/.test(l.them)),"ward");
// bound weapon replaces fists
s=mage(20,100); s.inv=[]; const fb=new G.Fight(s,foe()); const d0=fb.weaponDamage(); fb.cast("bound_sword",true); ok(fb.weaponDamage()>d0 && fb.weaponSkill()==="One-Handed","bound "+d0+" -> "+fb.weaponDamage());
s=mage(20,100); const fbb=new G.Fight(s,foe()); fbb.cast("bound_bow",true); ok(fbb.weaponSkill()==="Archery" && /Attack/.test(fbb.attack(false)+"Attack"),"bound bow no ammo");
// reanimate: zombie helps next fight
s=mage(20,100); f=fight(s,foe({health:30,hp:30,level:5}),rule("spell:revenant","first_turn")); const msgs=f.apply(); ok(f.won && s.thrall && s.thrall.fights===3, "thrall "+JSON.stringify(s.thrall)+msgs.join("|"));
f=fight(s,foe({health:300,hp:300}),rule("attack")); ok(f.log.some(l=>/Risen bandit/.test(l.me)),"zombie helps"); f.apply(); ok(s.thrall.fights===2,"thrall used");
// soul trap fills a gem
s=mage(20,100); G.give(s,"soul_gem_common_empty"); f=fight(s,foe({health:30,hp:30}),rule("spell:soul_trap","first_turn")); f.apply(); ok(SMITH.count(s,"soul_gem_common")===1 && SMITH.count(s,"soul_gem_common_empty")===0,"soul trap");
// dual casting
s=mage(20,100); const f1=new G.Fight(s,foe()); const mp0=f1.mp; f1.cast("firebolt",false,true); ok(mp0-f1.mp>=G.spellCost(s,D.SPELLS.firebolt)*2.7,"dual cost"); ok(f1.affordable("dual:firebolt") || f1.mp < G.spellCost(s,D.SPELLS.firebolt)*2.8,"dual afford");
let one=0,two=0; for(let i=0;i<300;i++){ const a=new G.Fight(mage(20,100),foe({health:999,hp:999})); a.cast("firebolt",true); one+=999-a.ehp; const b=new G.Fight(mage(20,100),foe({health:999,hp:999})); b.cast("firebolt",true,true); two+=999-b.ehp; } ok(two/one>1.9&&two/one<2.5,"dual power "+(two/one).toFixed(2));
// level penalties
const lo=mage(1,15), hi=mage(1,100); ok(G.spellCost(lo,D.SPELLS.incinerate)>G.spellCost(hi,D.SPELLS.incinerate)*1.5,"cost scaling"); ok(MAGIC.failChance(lo,"incinerate")>0.3 && MAGIC.failChance(hi,"incinerate")===0,"fail chance");
console.log("Incinerate cost at Destruction 15:", G.spellCost(lo,D.SPELLS.incinerate), "at 100:", G.spellCost(hi,D.SPELLS.incinerate), "fail at 15:", MAGIC.failChance(lo,"incinerate").toFixed(2));
// elements
const fe=new G.Fight(mage(),foe({name:"Troll",tags:["beast"]})); ok(MAGIC.elem(fe,"fire")>1,"troll fire");
const fd=new G.Fight(mage(),foe({name:"Draugr",tags:["undead"]})); ok(MAGIC.elem(fd,"frost")<1,"draugr frost");
// utility spells
s=mage(20,100); G.give(s,"ore_iron",4); let r=MAGIC.castOut(s,"transmute"); ok(/Transmute: 3/.test(r) && SMITH.count(s,"ore_silver")===3 && SMITH.count(s,"ore_iron")===1,"transmute "+r);
ok(/gather your magicka/.test(MAGIC.castOut(s,"transmute")),"cooldown");
r=MAGIC.castOut(s,"candlelight"); ok(G.fxSum(s,"trapdodge")===15,"candle "+r);
const hc0=G.hiddenChance(s,foe(),G.now()); r=MAGIC.castOut(s,"detect_life"); ok(G.hiddenChance(s,foe(),G.now())>hc0,"detect life");
QUESTS.ensure && QUESTS.ensure(s); r=MAGIC.castOut(s,"clairvoyance"); ok(/Clairvoyance/.test(r),"clairvoyance "+r); console.log(r);
G.setHealth(s,20); r=MAGIC.castOut(s,"healing"); ok(G.curHealth(s)>20,"heal out "+r);
ok(/fights/.test(MAGIC.castOut(s,"fireball")),"fight-only");
// staffs use charges
s=mage(20,15); const sid=G.give(s,"staff_flames"); G.equip(s,sid); f=fight(s,foe({health:500,hp:500}),rule("attack")); f.apply(); const row=G.invRow(s,sid);
ok(f.log[0].me.startsWith("Staff of Flames"),"staff casts "+f.log[0].me); ok(row.charge < D.ITEMS.staff_flames.staff.capacity,"charge used "+row.charge);
row.charge=0; G.setHealth(s,G.maxHealth(s)); f=fight(s,foe({health:50,hp:50}),rule("attack")); ok(/spent/.test(f.log[0].me),"empty staff"); G.give(s,"soul_gem_common"); const gem=s.inv.find(x=>x.item==="soul_gem_common"); ok(/recharged/.test(G.recharge(s,sid,gem.id)),"recharge staff");
// tactics choose spells
s=mage(20,100); f=fight(s,foe(),[{if:"hp_below",pct:101,do:"spell:grand_healing"},{if:"always",do:"attack"}]); ok(/Grand Healing/.test(f.log[0].me),"rule picks spell");
// master tomes gated
s=mage(20,50); ok(/College only teaches/.test(MAGIC.canBuy(s,"tome_fire_storm")||""),"master gate"); s.skills.Destruction.lvl=95; ok(!MAGIC.canBuy(s,"tome_fire_storm"),"master ok");
ok(TOMES.stockAt("Winterhold","wizard").includes("tome_fire_storm") && TOMES.stockAt("Riften","wizard").includes("tome_candlelight"),"stock");
console.log("magic ok");
`,c);
