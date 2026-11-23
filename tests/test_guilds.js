const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","guilds.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","magic.js","guide.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
const SIM=fs.readFileSync(__dirname + "/" + "test_bal_sim.js","utf8"); vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"),SIM.indexOf("const BUILDS"))+`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const hero=(id)=>{ const s=make("warrior",40); s.id=id; s.name="Hero"+id; for(const k of ["Sneak","Lockpicking","Pickpocket"]) s.skills[k].lvl=95; s.gold=0; s.inv=s.inv.filter(r=>!/^potion/.test(r.item)||Object.values(G.loadout(s).equipment).includes(r.id)); G.give(s,"potion_health",20); G.setHealth(s,G.maxHealth(s)); s.quests={}; s.titles=[]; s.horse=null; return s; };
const at=(s,n)=>{ s.location=n; [s.x,s.y]=WORLD.places[n]; if(!s.discovered.includes(n)) s.discovered.push(n); };
function runLine(s,id){
  let guard=0, fights=0;
  while(!s.quests[id].done && guard++<80){
    const v=s.quests[id], st=QUESTS.L[id].stages[v.stage], o=st.obj, before=v.stage;
    if(o.count){ s.stats=s.stats||{}; s.stats[o.count]=(s.stats[o.count]||0)+o.n; if(o.at) at(s,o.at); QUESTS.check(s); }
    else if(o.clear){ s.cleared=s.cleared||{}; s.cleared[o.clear]=G.now()+1; QUESTS.check(s); }
    else if(o.talk){ at(s,o.talk); G.setHealth(s,G.maxHealth(s)); v.retryAt=0; const r=QUESTS.talk(s,id); if(r.fight) fights++; ok(!r.died, id+" died at "+st.title+": "+r.text); }
    else QUESTS.check(s);
    if(s.quests[id].stage===before && !s.quests[id].done) { /* failed a check: try again */ }
  }
  ok(s.quests[id].done, id+" finished ("+s.quests[id].stage+")");
  return fights;
}
// stage counts and every target exists
for(const id of ["thieves","brotherhood"]) for(const st of QUESTS.L[id].stages){ const n=QUESTS.target(st); ok(!n||WORLD.places[n], "place "+n); }
ok(QUESTS.L.thieves.stages.length===10 && QUESTS.L.brotherhood.stages.length===8, "stage counts");
// Thieves line start → end
const A=hero("A"); QUESTS.ensure(A); at(A,"Riften"); ok(QUESTS.canJoin(A,"thieves"),"join thieves"); QUESTS.join(A,"thieves");
const fa=runLine(A,"thieves");
ok(A.titles.includes("Guild Master of the Thieves Guild") && SMITH_OK(), "title");
function SMITH_OK(){ return true; }
const has=(s,i)=>s.inv.some(r=>r.item===i);
ok(has(A,"guild_armor")&&has(A,"nightingale_armor")&&has(A,"nightingale_blade"),"thieves rewards");
ok(GUILDS.rank(A,"thieves").name==="Guild Master","guild master rank");
// rewards once: re-running check doesn't re-grant
const nBlade=A.inv.filter(r=>r.item==="nightingale_blade").length; QUESTS.check(A); ok(A.inv.filter(r=>r.item==="nightingale_blade").length===nBlade,"once");
// Brotherhood via Windhelm
const B=hero("B"); QUESTS.ensure(B); at(B,"Windhelm"); ok(QUESTS.canJoin(B,"brotherhood"),"join db"); QUESTS.join(B,"brotherhood");
runLine(B,"brotherhood");
ok(B.titles.includes("Listener of the Dark Brotherhood") && B.horse && B.horse.name==="Shadowmere","listener + Shadowmere");
ok(has(B,"shrouded_armor")&&has(B,"blade_of_woe"),"db rewards");
// Brotherhood via the inn after a murder
const C=hero("C"); at(C,"Whiterun"); C.gold=500; TOWNS.addBounty(C,"Whiterun","murder"); C.bounty={}; C.resisted={};
const m=TOWNS.rentRoom(C); ok(/Astrid/.test(m) && C.quests.brotherhood.stage===1,"inn wake: "+m.slice(-80));
ok(!/Astrid/.test(TOWNS.rentRoom(C)),"only once");
// checks: low skill fails sometimes, bounty, retry cooldown
const D2=hero("D"); for(const k of Object.keys(D2.skills)) D2.skills[k].lvl=5; QUESTS.ensure(D2); D2.quests.thieves={stage:3,t:G.now(),base:{},v2:true}; at(D2,"Honningbrew Meadery");
let fails=0, succ=0; for(let i=0;i<200;i++){ D2.quests.thieves={stage:3,t:G.now(),base:{},v2:true}; D2.bounty={}; const r=QUESTS.talk(D2,"thieves"); if(D2.quests.thieves.stage===4) succ++; else { fails++; ok(/spotted/.test(r.text) && D2.bounty.Whiterun===100,"bounty on fail"); ok(/Lie low/.test(QUESTS.talk(D2,"thieves").text),"cooldown"); } }
console.log("low-skill sneak check: ", succ, "passed,", fails, "failed");
ok(fails>100 && succ>10,"chance ~15-20% (200 tries)");
// old save: finished 4-stage thieves line reopens at stage 3 once
const E2=hero("E"); E2.quests={main:{stage:0,t:0},thieves:{stage:4,done:true,t:0}}; QUESTS.ensure(E2); ok(!E2.quests.thieves.done && E2.quests.thieves.stage===3,"migrate"); QUESTS.ensure(E2); ok(E2.quests.thieves.stage===3,"migrate once");
// guild jobs: take, cooldown, ranks, pay, fence
const T=A; at(T,"Riften"); let jobs=0;
for(let i=0;i<20;i++){ GUILDS.state(T).thieves.next=0; const o=GUILDS.offer(T,"thieves"); ok(o.job,"offer "+(o.err||"")); ok(GUILDS.offer(T,"thieves").err,"one at a time"); at(T,o.job.town); const g0=T.gold; const r=GUILDS.work(T,"thieves"); if(T.gold>g0) jobs++; at(T,"Riften"); ok(GUILDS.offer(T,"thieves").err,"cooldown after job"); }
console.log("thief jobs done", jobs, "of 20; rank", GUILDS.rank(T,"thieves").name, "state jobs", GUILDS.state(T).thieves.jobs);
ok(jobs>=15,"high skill mostly succeeds");
const row={item:"gem_ruby",qty:1,stolen:true}; ok(GUILDS.fenceMult(T,row)>1.2 && GUILDS.fenceMult(T,{item:"gem_ruby",qty:1})===1,"fence bonus");
const N=hero("N"); QUESTS.ensure(N); N.quests.brotherhood={stage:2,t:0,base:{}}; ok(GUILDS.rank(N,"brotherhood").name==="Initiate","db rank");
at(N,"Falkreath"); let paid=0; for(let i=0;i<8;i++){ GUILDS.state(N).brotherhood.next=0; at(N,"Falkreath"); const o=GUILDS.offer(N,"brotherhood"); ok(o.job,"contract "+(o.err||"")); at(N,o.job.town); G.setHealth(N,G.maxHealth(N)); const g0=N.gold; GUILDS.work(N,"brotherhood"); if(N.gold>g0) paid++; }
ok(paid>=7 && GUILDS.rank(N,"brotherhood").name==="Assassin","contracts & rank "+GUILDS.rank(N,"brotherhood").name);
at(N,"Whiterun"); GUILDS.state(N).brotherhood.next=0; ok(/Sanctuary/.test(GUILDS.offer(N,"brotherhood").err||""),"only at the Sanctuary");
// save/load mid-quest
const X=hero("X"); QUESTS.ensure(X); at(X,"Riften"); QUESTS.join(X,"thieves"); X.quests.thieves.stage=6; const X2=JSON.parse(JSON.stringify(X)); QUESTS.ensure(X2); at(X2,"Markarth"); X2.skills.Sneak.lvl=100; let tries=0; while(X2.quests.thieves.stage===6&&tries++<20){ X2.quests.thieves.retryAt=0; QUESTS.talk(X2,"thieves"); } ok(X2.quests.thieves.stage===7,"save/load continue");
console.log("guilds ok · thieves fights", fa);
`,c);
