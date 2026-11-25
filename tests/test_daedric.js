const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Daedric quests and artifacts (daedric.js). W=/path/to/web/ node test_daedric.js
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,process};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","guilds.js","priests.js","civilwar.js","daedric.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","achievements.js","market.js","curses.js","smithing.js","social.js","ammo.js","tomes.js","magic.js","guide.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
const SIM=fs.readFileSync(__dirname + "/" + "test_bal_sim.js","utf8");
vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"),SIM.indexOf("const BUILDS"))+`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const at=(s,n)=>{ s.location=n; [s.x,s.y]=WORLD.places[n]; s.discovered=s.discovered||[]; if(!s.discovered.includes(n)) s.discovered.push(n); s.trip=null; s.dungeon=null; };
const has=(s,i)=>s.inv.some(r=>r.item===i);
// 1. thirteen princes, each with a quest whose places exist and an artifact
ok(DAEDRIC.LINES.length>=8 && DAEDRIC.LINES.length===13,"13 princes");
ok(new Set(DAEDRIC.PRINCES.map(p=>p.prince)).size===13,"all different");
for(const id of DAEDRIC.LINES){ const d=QUESTS.L[id]; ok(WORLD.places[d.start],"start "+d.start); ok(WORLD.places[d.place],"shrine "+d.place); ok(D.ITEMS[d.art],"artifact "+d.art);
  ok(d.stages.at(-1).reward.items.includes(d.art),"last stage gives the artifact "+id);
  d.stages.forEach((st,i)=>{ const n=QUESTS.target(st); ok(WORLD.places[n],id+" place "+n); if(st.obj.clear) ok(DUNGEONS.enterable(st.obj.clear),"enterable "+st.obj.clear); ok(QUESTS.recOf(id,i)>=d.minLevel,"rec >= min "+id); }); }
// weapon types follow the artifact
ok(G.wtype("volendrung_warhammer")==="warhammer" && G.wtype("mehrunes_razor_dagger")==="dagger" && G.wtype("molag_bal_mace")==="mace" && G.wtype("ebony_blade_greatsword")==="greatsword" && G.wtype("dawnbreaker")==="sword","weapon types");
// 2. level gate and discovery
const kid=make("warrior",5); kid.quests={}; kid.discovered=[]; at(kid,"Falkreath");
ok(!QUESTS.canJoin(kid,"dae_clavicus") && /level 10/.test(QUESTS.join(kid,"dae_clavicus")),"level gate");
const s0=make("warrior",30); s0.quests={}; s0.discovered=[]; at(s0,"Whiterun");
ok(!QUESTS.visible(s0,"dae_azura"),"shrine unknown: hidden"); ok(QUESTS.visible(s0,"dae_sanguine"),"city start: visible");
s0.discovered.push("Shrine of Azura"); ok(QUESTS.visible(s0,"dae_azura"),"found the shrine: visible");
// 3. play every line through with a strong hero
function play(s,id){
  at(s,QUESTS.L[id].start); const j=QUESTS.join(s,id); ok(s.quests[id],"joined "+id+": "+j);
  for(let guard=0;guard<40;guard++){
    const v=s.quests[id]; if(v.done) return;
    const st=QUESTS.L[id].stages[v.stage], o=st.obj;
    if(o.clear){ at(s,o.clear); s.cleared=s.cleared||{}; s.cleared[o.clear]=G.now()+1; QUESTS.check(s); continue; }
    if(o.go){ at(s,o.go); QUESTS.check(s); continue; }
    at(s,o.talk); G.setHealth(s,G.maxHealth(s)); v.retryAt=0; const r=QUESTS.talk(s,id); if(r.fight) ok(!isNaN(r.fight.hp)&&!isNaN(r.fight.ehp),"NaN "+st.title);
  }
  throw new Error("FAIL could not finish "+id+" at stage "+s.quests[id].stage);
}
const hero=make("spellsword",45); hero.quests={}; QUESTS.ensure(hero); hero.skills.Lockpicking.lvl=80;
// Mephala waits for the main quest
at(hero,"Whiterun"); QUESTS.join(hero,"dae_mephala"); ok(/dragon/.test(QUESTS.talk(hero,"dae_mephala").text),"Mephala needs Dragon Rising");
hero.quests.main.stage=QUESTS.L.main.stages.findIndex(x=>x.title==="The Way of the Voice");
const before={...Object.fromEntries(D.SKILL_GROUPS.Mage.concat(D.SKILL_GROUPS.Warrior,D.SKILL_GROUPS.Thief).map(k=>[k,hero.skills[k].lvl]))};
for(const id of DAEDRIC.LINES) play(hero,id);
for(const id of DAEDRIC.LINES) ok(has(hero,QUESTS.L[id].art),"got "+QUESTS.L[id].art);
ok(DAEDRIC.count(hero)===13,"13 done");
// Oghma: +5 in three skills of one path
const raised=Object.keys(before).filter(k=>hero.skills[k].lvl>before[k]); ok(raised.length>=3 && hero.daeOghmaRead,"Oghma raised "+raised.join(","));
const inc=raised.map(k=>hero.skills[k].lvl-before[k]); ok(inc.filter(x=>x>=5).length>=3,"five levels each: "+inc);
const lv=Object.fromEntries(raised.map(k=>[k,hero.skills[k].lvl])); QUESTS.check(hero); ok(raised.every(k=>hero.skills[k].lvl===lv[k]),"read once");
// 4. the artifacts in a fight
const foe=(tags=["humanoid"],hp=400)=>({name:"Test foe",health:hp,hp,damage:5,tags,level:20,gold:[0,0]});
const fightWith=(s,e)=>{ const f=new G.Fight(s,e,null,G.now()); return f; };
function wield(s,item){ const id=G.give(s,item); G.equip(s,id); return id; }
const R=Math.random;
{ const s=make("warrior",30); wield(s,"mehrunes_razor_dagger"); const f=fightWith(s,foe()); Math.random=()=>0.01; const r=DAEDRIC.onHit(f,10); Math.random=R; ok(r.dmg>=f.ehp && /outright/.test(r.label),"Razor slays");
  const f2=fightWith(s,foe(["humanoid","elite"])); Math.random=()=>0.01; const r2=DAEDRIC.onHit(f2,10); Math.random=R; ok(r2.dmg===15,"Razor vs elite: deep cut"); }
{ const s=make("warrior",30); wield(s,"dawnbreaker"); const f=fightWith(s,foe(["undead"])); Math.random=()=>0.9; const r=DAEDRIC.onHit(f,10); Math.random=R; ok(r.dmg===30,"Dawnbreaker vs undead "+r.dmg); const f2=fightWith(s,foe()); ok(DAEDRIC.onHit(f2,10).dmg===20,"Dawnbreaker fire"); }
{ const s=make("twohand",30); wield(s,"volendrung_warhammer"); const f=fightWith(s,foe()); f.sp=0; DAEDRIC.onHit(f,10); ok(f.sp===10,"Volendrung stamina"); }
{ const s=make("warrior",30); wield(s,"molag_bal_mace"); const f=fightWith(s,foe()); f.sp=0; f.mp=0; DAEDRIC.onHit(f,10); ok(f.sp===10&&f.mp===10,"Molag Bal drains"); }
{ const s=make("twohand",30); wield(s,"ebony_blade_greatsword"); const f=fightWith(s,foe()); f.hp=10; DAEDRIC.onHit(f,50); ok(f.hp===15,"Ebony Blade heals"); }
{ const s=make("warrior",30); wield(s,"ebony_mail"); ok(G.fxSum(s,"dae:cloak")>0 && G.fxSum(s,"skill:Sneak")>=15,"Ebony Mail worn"); const f=fightWith(s,foe()); const e0=f.ehp; const t=DAEDRIC.onEnemy(f); ok(/poison cloak/.test(t) && f.ehp<e0,"poison cloak"); }
{ const s=make("warrior",30); G.give(s,"sanguine_rose"); const f=fightWith(s,foe()); f.turn=1; ok(/Dremora/.test(DAEDRIC.onEnemy(f)) && f.summonTurns===6 && f.summonDmg>0,"Sanguine Rose summons"); f.turn=2; ok(!/Dremora/.test(DAEDRIC.onEnemy(f)||""),"once"); }
{ const s=make("warrior",30); G.give(s,"wabbajack"); for(const [r,re] of [[0.05,/cheese/],[0.3,/bees/],[0.5,/lightning/],[0.7,/refreshed/],[0.9,/healthier/]]){ const f=fightWith(s,foe()); const t=DAEDRIC.wabbajack(f,r); ok(re.test(t),"wabbajack "+r+": "+t); }
  const fb=fightWith(s,foe(["dragon"])); DAEDRIC.wabbajack(fb,0.05); ok(fb.ehp>0,"no cheese dragons"); const f=fightWith(s,foe()); f.turn=2; ok(/Wabbajack/.test(DAEDRIC.onEnemy(f)),"Wabbajack in a fight"); }
{ const s=make("warrior",30); const id=wield(s,"ench|iron_sword|fire|10|1000"); G.invRow(s,id).charge=0; G.give(s,"azuras_star"); const f=fightWith(s,foe(["humanoid"],1)); f.run({t:G.now()}); ok(f.won,"won"); const m=f.apply(); ok(m.some(x=>/Azura/.test(x)) && G.invRow(s,id).charge>=200,"Azura's Star refills: "+G.invRow(s,id).charge); }
// whole fights with each artifact: no NaN, all finish
for(const art of ["volendrung_warhammer","mehrunes_razor_dagger","dawnbreaker","molag_bal_mace","ebony_blade_greatsword","ebony_mail","masque_clavicus","saviors_hide","spellbreaker","sanguine_rose","wabbajack","azuras_star"]){
  for(let k=0;k<20;k++){ const s=make("warrior",25); if(D.ITEMS[art].slot==="trophy") G.give(s,art); else wield(s,art); const e=G.scaleEnemy({name:"Bandit chief",health:120,damage:12,tags:["humanoid","elite"],level:20,gold:[0,0]},25); const f=fightWith(s,e); f.run({t:G.now()}); ok(!isNaN(f.hp)&&!isNaN(f.ehp),"NaN "+art); f.apply(); }
}
ok(G.itemStats("sanguine_rose")==="Daedric artifact","artifact label");
console.log("ALL OK");
`,c);
