const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,URLSearchParams};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","immerse.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
// odds: the mini-game's average player opens locks about as often as the old roll did
let worst=0, rows=[];
for (const lp of [15, 40, 70, 100]) for (let tier=0; tier<5; tier++) {
  const s=G.newSave("A","A","nord"); s.skills.Lockpicking.lvl=lp;
  const ch=G.lockChance(s,tier), picks=3, w=IMM.sweetWidth(ch,picks,false);
  const sim=IMM.simRate(w,picks,false,2000,12345), old=IMM.oldOdds(ch,picks);
  worst=Math.max(worst,Math.abs(sim-old)); rows.push(lp+"/"+tier+": old "+old.toFixed(2)+" game "+sim.toFixed(2)+" w "+w.toFixed(1));
}
console.log(rows.join(" | "));
ok(worst<=0.05,"odds within 5% (worst "+worst.toFixed(3)+")");
// unbreakable: always gets there
ok(IMM.simRate(IMM.sweetWidth(0.2,3,true),3,true,500,3)>0.95,"unbreakable");
// forced rolls: the mini-game decides, and counts locks picked
const s=G.newSave("B","B","nord"); s._lockForce=true; ok(G.lockRoll(s,0)===true && s._lockForce===undefined && s.lt.locks===1,"force true");
s._lockForce=false; ok(G.lockRoll(s,1)===false,"force false"); ok(typeof G.lockRoll(s,0.5)==="boolean","plain roll");
// dungeon chest via forced results: two broken picks then open
const d=G.newSave("C","C","nord"); d.dungeon={ place:"X", tier:1, theme:"cave", room:{ type:"treasure", tier:2, tries:3 }, found:[], gold:0 };
// counters + stats page
IMM.count(d,"foes",3); IMM.tick(d); d.gold+=50; IMM.tick(d); d.skills.Sneak.lvl+=2; IMM.tick(d);
ok(d.lt.foes===3 && d.lt.goldIn===50 && d.lt.skillUps===2,"counters "+JSON.stringify(d.lt));
const html=IMM.stats(d); ok(/General stats/.test(html) && /Gold earned/.test(html) && !/NaN|undefined/.test(html),"stats page");
ok(IMM.TIPS.length>=40,"tips "+IMM.TIPS.length);
console.log("immerse ok · worst odds gap "+worst.toFixed(3));
`,c);
