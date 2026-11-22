const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const s=G.newSave("me","Remi","nord"); s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun; s.gold=10000;
const v0=G.speed(s), cap0=G.capacity(s);
ok(/Shadow<b>/.test("x")===false,"");
ok(HORSES.buy(s,"  Shadow<b>!! ","black").includes("Shadowb"), "name cleaned: "+s.horse.name);
ok(s.horse.coat==="black" && s.gold===9000, "coat+price");
const vr=G.speed(s); ok(G.capacity(s)===cap0+D.HORSE_CARRY, "riding carry");
HORSES.toggle(s); const vw=G.speed(s); ok(!HORSES.riding(s) && Math.abs(vr/vw-D.HORSE_SPEED)<1e-9 && G.capacity(s)===cap0+D.HORSE_CARRY, "walking beside still carries "+vr+" "+vw);
HORSES.toggle(s); ok(HORSES.riding(s), "remount");
ok(/Steel/.test(HORSES.buyArmor(s,"steel")) && HORSES.maxHp(s.horse)===300, "armor");
// hurt until down
const e={name:"Bandit Chief",damage:40}; let msg, n=0; do { msg=HORSES.hurt(s,e,Date.now()/1000,1); n++; } while(!HORSES.away(s) && n<50);
ok(HORSES.away(s) && s.horse && /limps off/.test(msg), "down not dead: "+msg);
ok(G.capacity(s)===cap0 && Math.abs(G.speed(s)-v0)<1e-9, "away: no bonuses");
ok(/still resting/.test(HORSES.fetch(s)) , "too early: "+HORSES.fetch(s));
s.location=s.horse.away.town; const g=s.gold; ok(/Rested and ready/.test(HORSES.hurry(s)) && s.gold===g-HORSES.HURRY_PRICE && HORSES.riding(s), "hurry");
// old save
const o=G.newSave("o","Old","nord"); o.horse={name:"Frost"}; ok(HORSES.riding(o) && HORSES.maxHp(o.horse)===200 && o.horse.coat==="bay", "old save upgraded");
// engine never deletes the horse over many encounters
const t=G.newSave("t","Tess","nord"); t.location="Whiterun"; [t.x,t.y]=WORLD.places.Whiterun; t.gold=5000; HORSES.buy(t,"Ash","grey");
let downs=0; for(let i=0;i<400;i++){ if(HORSES.away(t)){ downs++; t.horse.away=null; t.horse.hp=200; } HORSES.hurt(t,{name:"Troll",damage:30},Date.now()/1000,0.25); ok(t.horse,"horse kept"); }
console.log("horses ok · downs in 400 encounters:", downs, "· last:", msg);
`,c);
