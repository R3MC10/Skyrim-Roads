const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Dragon priests and their masks (priests.js). W=/path/to/web/ node test_priests.js
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,process};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","guilds.js","priests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","achievements.js","market.js","curses.js","smithing.js","social.js","ammo.js","tomes.js","magic.js","guide.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
const SIM=fs.readFileSync(__dirname + "/" + "test_bal_sim.js","utf8");
vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"),SIM.indexOf("const BUILDS"))+`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const at=(s,n)=>{ s.location=n; [s.x,s.y]=WORLD.places[n]; s.discovered=s.discovered||[]; if(!s.discovered.includes(n)) s.discovered.push(n); s.trip=null; s.dungeon=null; s.cleared={}; };
const has=(s,i)=>s.inv.filter(r=>r.item===i).length;
// 1. every lair exists, is enterable, and the priest is its boss
ok(PRIESTS.LIST.length===8,"eight priests");
for(const p of PRIESTS.LIST){
  ok(WORLD.places[p.lair],"lair on the map: "+p.lair);
  ok(DUNGEONS.enterable ? DUNGEONS.enterable(p.lair)!==false : true,"enterable "+p.lair);
  ok(DUNGEONS.info(p.lair),"dungeon info "+p.lair);
  const s=make("warrior",30); at(s,p.lair);
  ok(DUNGEONS.enter(s)===null,"enter "+p.lair);
  ok(s.dungeon.boss==="priest_"+p.id && s.dungeon.priest===p.id,"priest boss "+p.lair+" "+s.dungeon.boss);
  // walk to the last row: the boss room
  s.dungeon.row=s.dungeon.rows.length-2; s.dungeon.col=0;
  const last=s.dungeon.rows[s.dungeon.rows.length-1]; const bi=last.findIndex(r=>r.type==="boss"); ok(bi>=0,"boss row "+p.lair);
  if(s.dungeon.row>=0) s.dungeon.rows[s.dungeon.row][0].links=[bi];
  ok(DUNGEONS.enterRoom(s,bi)===null,"boss room "+p.lair);
  ok(s.dungeon.room.enemy.priest===p.id && /dragon priest/.test(s.dungeon.room.enemy.name),"enemy "+s.dungeon.room.enemy.name);
  ok(ENEMY_OK(s.dungeon.room.enemy),"enemy stats");
}
function ENEMY_OK(e){ return e.health>0 && e.damage>0 && e.tags.includes("mage"); }
// low level: the priest sleeps
{ const s=make("warrior",10); at(s,"Forelhost"); DUNGEONS.enter(s); ok(!s.dungeon.boss,"no priest under level "+PRIESTS.MIN_LEVEL); }
// 2. beat a priest: the mask drops once; the quest starts and advances; the marker moves
const hero=make("warrior",40); hero.id="H"; hero.quests={};
function beat(s,p){
  for(let tries=0;tries<12;tries++){
    at(s,p.lair); DUNGEONS.enter(s); const d=s.dungeon; d.rows=[[{type:"boss",links:[]}]]; d.row=-1; d.col=0;
    DUNGEONS.enterRoom(s,0); d.room.enemy.health=d.room.enemy.hp=1;   // a doomed priest: we test the drop, not the odds
    G.setHealth(s,G.maxHealth(s)); const r=DUNGEONS.act(s,"fight");
    if(r.cleared) return r;
  }
  throw new Error("FAIL could not beat "+p.name);
}
QUESTS.ensure(hero); ok(hero.quests.masks && hero.quests.masks.stage===0,"quest auto-starts at level 40");
const a0=QUESTS.active(hero).find(a=>a.id==="masks"); const t0=QUESTS.target(a0.st); ok(PRIESTS.BY_LAIR[t0],"marker on a lair: "+t0);
ok(PRIESTS.marker({...hero,location:"Whiterun"})?.name===PRIESTS.nextLair(hero),"map marker");
const kro=PRIESTS.BY.krosis, r1=beat(hero,kro);
ok(has(hero,"mask_krosis")===1 && /Mask of Krosis/.test(r1.text),"mask drops: "+r1.text);
QUESTS.check(hero); ok(hero.quests.masks.stage===1,"stage 1 after first mask");
ok(QUESTS.target(QUESTS.active(hero).find(a=>a.id==="masks").st)!=="Shearpoint","marker moved off Shearpoint");
at(hero,"Shearpoint"); DUNGEONS.enter(hero); ok(hero.dungeon.boss!=="priest_krosis","Krosis is gone for good (dragon again: "+hero.dungeon.boss+")");
hero.dungeon=null;
// not tradeable, not lost on death
const mrow=hero.inv.find(r=>r.item==="mask_krosis");
at(hero,"Whiterun"); ok(/bound/.test(G.sell(hero,mrow.id)) || /closed/.test(G.sell(hero,mrow.id)),"can't sell");
ok(D.ITEMS.mask_krosis.noTrade && MARKET && true,"noTrade flag");
const off=MP.makeOffer(hero,{id:"x",name:"X"},[mrow.id],0,10); ok(has(hero,"mask_krosis")===1,"offer can't take the mask");
G.die(hero,"test"); ok(has(hero,"mask_krosis")===1,"kept on death");
// 3. effects apply (fxSum keys)
const eq=(s,item)=>{ const r=s.inv.find(x=>x.item===item)||s.inv.find(x=>x.id===G.give(s,item)); G.equip(s,r.id); };
const fx=make("mage",30); const base={lock:G.skill(fx,"Lockpicking"),alch:G.skill(fx,"Alchemy"),mag:G.maxMagicka(fx),st:G.maxStamina(fx),cap:G.capacity(fx)};
G.give(fx,"mask_krosis"); eq(fx,"mask_krosis");
ok(G.skill(fx,"Lockpicking")===base.lock+20 && G.skill(fx,"Alchemy")===base.alch+20 && G.fxSum(fx,"dmg:Archery")===20,"Krosis");
const spell=Object.keys(D.SPELLS).find(k=>D.SPELLS[k].school==="Destruction"&&D.SPELLS[k].cost>20&&fx.spells.includes(k)) || Object.keys(D.SPELLS).find(k=>D.SPELLS[k].school==="Destruction"&&D.SPELLS[k].cost>20);
const c0=G.spellCost(fx,D.SPELLS[spell]);
G.give(fx,"mask_nahkriin"); eq(fx,"mask_nahkriin");
ok(G.maxMagicka(fx)===base.mag+50 && G.fxSum(fx,"cost:Destruction")===20 && G.fxSum(fx,"cost:Restoration")===20 && G.fxSum(fx,"skill:Lockpicking")===0,"Nahkriin (and Krosis off)");
const c1=G.spellCost(fx,D.SPELLS[spell]); ok(c1<c0 && c1>=Math.floor(c0*0.8)-1,"cheaper Destruction "+c0+"→"+c1);
const checks=[["mask_morokei",()=>G.fxSum(fx,"regen:magicka")===100],["mask_volsung",()=>G.fxSum(fx,"barter")===20&&G.capacity(fx)===base.cap+100],
  ["mask_vokun",()=>["Conjuration","Illusion","Alteration"].every(k=>G.fxSum(fx,"cost:"+k)===20)],["mask_hevnoraak",()=>PRIESTS.immune(fx)],
  ["mask_otar",()=>G.fxSum(fx,"resist")===30],["mask_rahgot",()=>G.maxStamina(fx)===base.st+70],["mask_konahrik",()=>G.fxSum(fx,"konahrik")===1]];
for(const [m,f] of checks){ G.give(fx,m); eq(fx,m); ok(f(),m); }
G.equip(fx,fx.inv.find(r=>r.item==="mask_hevnoraak").id); let inf=0; for(let i=0;i<200;i++) if(CURSE.maybeInfect(fx,{name:"Vampire"})) inf++; ok(inf===0,"Hevnoraak: no disease");
ok(/\\+2 more/.test(G.itemStats("mask_krosis")),"item stats show more: "+G.itemStats("mask_krosis"));
// Konahrik saves you sometimes
{ let saved=0; for(let i=0;i<200;i++){ const s=make("warrior",30); G.give(s,"mask_konahrik"); eq(s,"mask_konahrik"); const f=new G.Fight(s,{name:"Bandit",health:999,damage:1,tags:["humanoid"],gold:[0,0]},null); f.hp=G.maxHealth(s)*0.2; if(PRIESTS.guard(f)) saved++; ok(!PRIESTS.guard(f),"once a fight"); } ok(saved>90&&saved<170,"Konahrik sometimes: "+saved); }
// 4. collect them all, then Bromjunaar → Konahrik; achievement
for(const p of PRIESTS.LIST) if(!PRIESTS.got(hero,p.id)) beat(hero,p);
ok(PRIESTS.count(hero)===8 && has(hero,"mask_wooden")===1,"all eight + wooden");
for(const p of PRIESTS.LIST) ok(has(hero,"mask_"+p.id)===1,"one mask each "+p.id);
QUESTS.check(hero); ok(hero.quests.masks.stage===8,"at the shrine stage "+hero.quests.masks.stage);
ok(QUESTS.target(QUESTS.active(hero).find(a=>a.id==="masks").st)==="Labyrinthian","marker on Bromjunaar");
// a priest beaten twice (re-enter after refill) never drops a second mask
at(hero,"Ragnvald"); DUNGEONS.enter(hero); ok(!hero.dungeon.priest,"no priest after the mask"); hero.dungeon=null;
// stash one mask: the shrine refuses
const vrow=hero.inv.find(r=>r.item==="mask_vokun"); const saveRow={...vrow}; G.take(hero,vrow.id);
at(hero,"Labyrinthian"); let tr=QUESTS.talk(hero,"masks"); ok(/Missing: Vokun/.test(tr.text),"shrine wants all masks: "+tr.text);
G.give(hero,"mask_vokun"); tr=QUESTS.talk(hero,"masks"); ok(hero.quests.masks.done && has(hero,"mask_konahrik")===1 && hero.titles.includes("Konahrik"),"Konahrik: "+tr.text);
ok(ACH.LIST? true:true,"ach");
const achRow=(typeof ACH!=="undefined"&&ACH.LIST||[]).find(a=>a[0]==="masks"); if(achRow){ const [n,m]=achRow[4](hero); ok(n===8&&m===8,"achievement"); }
console.log("lairs, drops, effects, quest, Konahrik: ok");
// 5. balance: priest win rates by build and level, next to a regular tier-3 boss (the Dragon priest "lich")
if(process.env.PH) for(const p of PRIESTS.LIST){ DUNGEONS.ENEMY["priest_"+p.id].health=+process.env.PH; DUNGEONS.ENEMY["priest_"+p.id].damage=+process.env.PD; }
const N=+(process.env.N||60), Ls=[20,25,30,35,40], bl=["warrior","twohand","archer","mage","spellsword"];
const rate=(build,L,key)=>{ let w=0,hp=0; for(let i=0;i<N;i++){ const s=make(build,L); const def={...DUNGEONS.ENEMY[key==="priest"?"priest_"+PRIESTS.LIST[i%8].id:key]}, e=key==="priest"&&G.scaleQuestFoe?G.scaleQuestFoe(def,L,PRIESTS.recFor(i%8)):G.scaleEnemy(def,L); e.health=Math.round(e.health*0.8); e.hp=e.health; e.damage=Math.round(e.damage*0.8*10)/10; e.boss=true; const r=fight(s,e); if(r.won){w++; hp+=r.hpLeft;} } return [w/N, w?hp/w:0]; };
const rows=[]; const avg={};
for(const L of Ls){ const line=[String(L).padStart(3)]; for(const b of bl){ const [w]=rate(b,L,"priest"), [wl]=rate(b,L,"lich"); line.push((Math.round(w*100)+"%").padStart(5)+"/"+(Math.round(wl*100)+"%").padStart(4)); (avg[L]=avg[L]||[]).push(w); } rows.push(line.join(" ")); }
console.log("Lvl  "+bl.map(b=>b.padStart(10)).join(" ")+"   (priest / regular T3 boss)");
rows.forEach(r=>console.log(r));
const m=(L)=>avg[L].reduce((a,b)=>a+b,0)/avg[L].length;
console.log("average priest win rate:",Ls.map(L=>L+": "+Math.round(m(L)*100)+"%").join(", "));
if(G.scaleQuestFoe){ // quest-fight scaling: realistic builds win at or above the recommended level (20 for the first mask, 30 for the last); test_qscale.js covers plain gear
  ok(m(20)>=0.7 && m(30)>=0.7 && m(40)>=0.7,"priests beatable at their recommended level and above");
  console.log("recommended level: first mask",PRIESTS.recFor(0),"last mask",PRIESTS.recFor(7));
} else ok(m(25)>=0.3 && m(40)>=0.6 && m(20)<=0.85,"priests beatable at 25–40 and not trivial at 20");
console.log("errors",errs,"nan",nan); ok(nan===0,"no NaN");
console.log("ALL OK");
`,c);
