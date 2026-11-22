const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","achievements.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const old=G.newSave("o","Old","nord"); old.level=22; old.dragons=3; old.cleared={a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,j:10,k:11}; old.homes={Riften:{chest:[]}};
const first=ACH.check(old); ok(first.length===0 && ACH.count(old)===5, "old save: credited quietly ("+ACH.count(old)+")");
ok(ACH.check(old).length===0, "nothing twice");
old.stats={fish:99}; ok(ACH.check(old).length===0, "99 fish not yet"); old.stats.fish=100; const f=ACH.check(old); ok(f.length===1 && f[0].id==="angler", "angler earned");
// stones via takeStone
const s=G.newSave("s","Stone","nord"); ACH.check(s);
for (const [place, ids] of Object.entries(POWERS.STONE_AT)) for (const id of ids) { s.location=place; POWERS.takeStone(s,id); }
const st=ACH.progress(s).find(a=>a.id==="stones"); ok(st.cur===13, "13 stones "+st.cur); ok(ACH.check(s).some(a=>a.id==="stones"), "stones earned");
// arena wins count
const a=G.newSave("a","A","nord"); a.location="Windhelm"; for(let i=0;i<10;i++) ARENA.settle(a,{from:"a",status:"done",winner:"a",pot:0,bRating:1000,season:ARENA.season(),toName:"B"}); ok(ACH.progress(a).find(x=>x.id==="champion").cur===10, "duels counted");
const rec=VISITS.record(old); ok(rec.ach && rec.ach.n===ACH.count(old) && rec.ach.latest.length>0, "visitors see them");
console.log("achievements ok ·", ACH.count(old)+"/"+ACH.total, rec.ach.latest.join(", "));
`,c);
