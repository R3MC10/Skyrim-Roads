const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","curses.js","ammo.js","magic.js","mp.js"].filter(f=>fs.existsSync((process.env.W||__GAME + "")+f)))vm.runInContext(fs.readFileSync((process.env.W||__GAME + "")+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
function hero(id,name,lvl){ const s=G.newSave(id,name,"nord"); s.location="Windhelm"; [s.x,s.y]=WORLD.places.Windhelm; s.gold=2000; s.level=lvl; s.hpBonus=lvl*10; for(const k of Object.keys(s.skills)) s.skills[k].lvl+=lvl; G.setHealth(s,G.maxHealth(s)); return s; }
const card=(s)=>({...MP.stats(s), id:s.id, name:s.name, loc:s.location});
let aw=0, bw=0;
for(let i=0;i<40;i++){
  const a=hero("A","Alfa",12), b=hero("B","Beta",8);
  const ch=ARENA.challenge(a, card(b), 500); ok(ch.doc && a.gold===1500, "stake held");
  const r=ARENA.accept(b, JSON.parse(JSON.stringify(ch.doc))); ok(r.doc && r.doc.status==="done", "fought: "+(r.err||""));
  ok(!b.dead && G.curHealth(b)>0 && !(b.journal||[]).some(j=>/died|You died/.test(j.text)), "nobody dies");
  const msg=ARENA.settle(a, r.doc);
  ok(a.gold+b.gold===4000, "gold conserved "+a.gold+"+"+b.gold);
  if(r.doc.winner==="A"){ aw++; ok(a.gold===2500 && b.gold===1500 && a.arena.rating>1000 && b.arena.rating<1000, "A won payout"); } else { bw++; ok(b.gold===2500 && a.gold===1500,"B won payout"); }
}
console.log("level 12 vs level 8 · stronger won", aw, "of 40");
ok(aw>bw, "stronger usually wins");
const a=hero("A","Alfa",5), b=hero("B","Beta",5);
let ch=ARENA.challenge(a, card(b), 9999); ok(ch.err||a.gold===2000-5000<0, "stake capped/poor"); 
ch=ARENA.challenge(a, card(b), 300); ok(/turned down/.test(ARENA.settle(a,{...ch.doc,status:"declined"})) && a.gold===2000, "declined refund");
ch=ARENA.challenge(a, card(b), 300); ARENA.settle(a,{...ch.doc,status:"cancelled"}); ok(a.gold===2000, "cancel refund");
b.location="Riften"; ch=ARENA.challenge(a, card(b), 0); ok(ch.err, "both in Windhelm");
b.location="Windhelm"; ch=ARENA.challenge(a, card(b), 0); b.gold=0; ok(!ARENA.accept(b,{...ch.doc}).err, "friendly bout needs no gold");
const old={...ch.doc, t:ch.doc.t-3600}; ok(ARENA.accept(b,old).err, "expired");
ok(MP.ladder(a).arenaRating===a.arena.rating, "ladder has arena");
console.log("arena ok · season", ARENA.seasonName());
`,c);
