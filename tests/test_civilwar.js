const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// The Civil War questline (civilwar.js). W=/path/to/web/ node test_civilwar.js
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,process};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","guilds.js","priests.js","civilwar.js","daedric.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","achievements.js","market.js","curses.js","smithing.js","social.js","ammo.js","tomes.js","magic.js","guide.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
const SIM=fs.readFileSync(__dirname + "/" + "test_bal_sim.js","utf8");
vm.runInContext(SIM.slice(SIM.indexOf("const LEVELS"),SIM.indexOf("const BUILDS"))+`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const at=(s,n)=>{ s.location=n; [s.x,s.y]=WORLD.places[n]; s.discovered=s.discovered||[]; if(!s.discovered.includes(n)) s.discovered.push(n); s.trip=null; s.dungeon=null; };
// 1. both sides exist; every place is on the map; cleared places are dungeons; recommended levels rise
for(const id of CIVILWAR.LINES){
  const d=QUESTS.L[id]; ok(d && d.stages.length===8,"8 stages "+id); ok(WORLD.places[d.start],"start "+d.start);
  let last=0; d.stages.forEach((st,i)=>{ const n=QUESTS.target(st); ok(WORLD.places[n],id+" stage "+i+" place "+n); if(st.obj.clear) ok(DUNGEONS.enterable(st.obj.clear),"enterable "+st.obj.clear);
    const r=QUESTS.recOf(id,i); ok(r>=last,"rec rises "+id+" "+i); last=r; });
  ok(d.stages.filter(st=>st.wins).length===5,"five hold battles "+id);
}
const holdsWon=(id)=>QUESTS.L[id].stages.flatMap(st=>st.wins||[]);
for(const id of CIVILWAR.LINES){ const sd=QUESTS.L[id].side; const need=Object.keys(CIVILWAR.START).filter(h=>CIVILWAR.START[h]!==sd); ok(need.every(h=>holdsWon(id).includes(h)),"every enemy/neutral hold has a battle "+id+": "+need.filter(h=>!holdsWon(id).includes(h))); }
ok(Object.keys(WORLD.holds).every(h=>CIVILWAR.JARLS[h]&&CIVILWAR.START[h]),"every hold has Jarls and a start side");
// 2. one side only
const hero=make("warrior",40); hero.quests={}; QUESTS.ensure(hero);
at(hero,"Windhelm"); ok(QUESTS.canJoin(hero,"cw_stormcloak"),"can join Stormcloaks in Windhelm");
at(hero,"Solitude"); ok(QUESTS.canJoin(hero,"cw_imperial") && !QUESTS.canJoin(hero,"cw_stormcloak"),"Legion here, not Stormcloaks");
const low=make("warrior",2); low.quests={}; at(low,"Solitude"); ok(!QUESTS.canJoin(low,"cw_imperial") && /level 4/.test(QUESTS.join(low,"cw_imperial")),"level gate");
ok(/Civil War/.test(QUESTS.join(hero,"cw_imperial")),"joined the Legion");
at(hero,"Windhelm"); ok(!QUESTS.canJoin(hero,"cw_stormcloak") && /sworn/.test(QUESTS.join(hero,"cw_stormcloak")),"no Stormcloaks after the Legion");
ok(!QUESTS.visible(hero,"cw_stormcloak") && CIVILWAR.side(hero)==="imperial","the other side is hidden");
ok(CIVILWAR.control(hero,"Whiterun")==="neutral" && CIVILWAR.jarl(hero,"Eastmarch")==="Ulfric Stormcloak","start control");
// 3. play it through
function play(s,id){
  for(let guard=0;guard<60;guard++){
    const v=s.quests[id]; if(v.done) return;
    const st=QUESTS.L[id].stages[v.stage], o=st.obj;
    if(o.clear){ at(s,o.clear); s.cleared=s.cleared||{}; s.cleared[o.clear]=G.now()+1; ok(QUESTS.check(s).length,"clear advances "+st.title); continue; }
    if(o.go){ at(s,o.go); QUESTS.check(s); continue; }
    at(s,o.talk); G.setHealth(s,G.maxHealth(s)); const r=QUESTS.talk(s,id);
    ok(r && r.text,"talk "+st.title);
    if(r.fight) ok(!isNaN(r.fight.hp)&&!isNaN(r.fight.ehp),"no NaN "+st.title);
    if(r.died){ s.health=G.maxHealth(s); }
  }
  throw new Error("FAIL could not finish "+id);
}
let wonWhiterun=false;
for(let guard=0;guard<60 && !hero.quests.cw_imperial.done;guard++){ const v=hero.quests.cw_imperial; if(v.stage===4 && !wonWhiterun){ wonWhiterun=true; ok(CIVILWAR.control(hero,"Whiterun")==="imperial" && CIVILWAR.control(hero,"The Pale")==="stormcloak","Whiterun turns after its battle"); } play1(hero,"cw_imperial"); }
function play1(s,id){ const v=s.quests[id]; const st=QUESTS.L[id].stages[v.stage], o=st.obj;
  if(o.clear){ at(s,o.clear); s.cleared=s.cleared||{}; s.cleared[o.clear]=G.now()+1; QUESTS.check(s); return; }
  if(o.go){ at(s,o.go); QUESTS.check(s); return; }
  at(s,o.talk); G.setHealth(s,G.maxHealth(s)); const r=QUESTS.talk(s,id); if(r.fight) ok(!isNaN(r.fight.hp),"NaN"); }
ok(hero.quests.cw_imperial.done && wonWhiterun,"Imperial war won");
ok(Object.keys(WORLD.holds).every(h=>CIVILWAR.control(hero,h)==="imperial"),"all holds Imperial");
ok(CIVILWAR.jarl(hero,"Eastmarch")==="Brunwulf Free-Winter" && CIVILWAR.jarl(hero,"The Rift")==="Maven Black-Briar","new Jarls");
ok(hero.titles.includes("Legate of the Imperial Legion") && hero.inv.some(r=>r.item==="imperial_officer_helmet") && hero.cwImperial,"rewards");
ok(/Brunwulf/.test(CIVILWAR.townLine(hero,"Windhelm")) && /your side/.test(CIVILWAR.townLine(hero,"Windhelm")),"town line: "+CIVILWAR.townLine(hero,"Windhelm"));
ok(CIVILWAR.townLine(hero,"Fort Dunstad")==="","no Jarl line outside towns");
const b=CIVILWAR.barks(hero,"Windhelm"); ok(b.replace && b.lines.some(l=>/Brunwulf/.test(l)) && b.lines.some(l=>/Legion|Empire/.test(l)),"guards talk about the new Jarl");
ok(!CIVILWAR.barks(hero,"Solitude").replace,"Solitude's old lines still fit");
// 4. the other side
const sc=make("twohand",40); sc.quests={}; QUESTS.ensure(sc); at(sc,"Windhelm"); QUESTS.join(sc,"cw_stormcloak");
ok(CIVILWAR.side(sc)==="stormcloak","Stormcloak");
const fresh=make("warrior",10); fresh.quests={}; ok(CIVILWAR.control(fresh,"Eastmarch")==="stormcloak" && CIVILWAR.townLine(fresh,"Windhelm").includes("Ulfric") && !CIVILWAR.townLine(fresh,"Windhelm").includes("your side"),"no side: neutral text");
for(let guard=0;guard<80 && !sc.quests.cw_stormcloak.done;guard++) play1(sc,"cw_stormcloak");
ok(sc.quests.cw_stormcloak.done && sc.titles.includes("Stormblade"),"Stormcloak war won");
ok(CIVILWAR.jarl(sc,"Haafingar")==="Galmar Stone-Fist" && CIVILWAR.jarl(sc,"Whiterun")==="Vignar Gray-Mane","Stormcloak Jarls");
ok(/enemy hold/.test(CIVILWAR.townLine({...hero},"Solitude"))===false,"hero: Solitude is his");
// 5. balance: plain-gear heroes at the recommended level win most battles
const N=+(process.env.N||30); const rows=[];
for(const id of CIVILWAR.LINES) QUESTS.L[id].stages.forEach((st,i)=>{ if(!st.obj.fight) return; const rec=QUESTS.recOf(id,i); let w=0;
  for(let k=0;k<N;k++){ const s=make(["warrior","twohand","archer","mage","spellsword"][k%5],rec); s.quests={[id]:{stage:i,t:G.now()}}; at(s,st.obj.talk); G.setHealth(s,G.maxHealth(s)); const r=QUESTS.talk(s,id); if(r.fight&&r.fight.won) w++; }
  rows.push([id.slice(3),st.title,rec,Math.round(100*w/N)]); });
rows.forEach(r=>console.log(r.join(" · ")+"%"));
const avg=rows.reduce((a,r)=>a+r[3],0)/rows.length; console.log("average win at recommended level:",Math.round(avg)+"%");
ok(avg>=55,"battles winnable at the recommended level");
ok(rows.every(r=>r[3]>=25),"no battle a wall at its level");
console.log("ALL OK");
`,c);
