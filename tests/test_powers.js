const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const wolf=()=>G.scaleEnemy({...D.ENCOUNTERS.find(e=>e.name==="Wolf pack")},1);
for (const race of Object.keys(D.RACES)) {
  let won=0, logs=""; for(let i=0;i<300;i++){ const s=G.newSave("x","X",race); G.loadout(s).rules=[{if:"first_turn",do:"power:race"},...G.loadout(s).rules];
    const f=new G.Fight(s,wolf()); f.run({}); f.apply(); if(f.won) won++; if(i===0) logs=f.log.slice(0,2).map(l=>l.me+" / "+l.them).join(" | "); if(!isFinite(f.hp)) throw "nan "+race; }
  let base=0; for(let i=0;i<300;i++){ const s=G.newSave("x","X",race); const f=new G.Fight(s,wolf()); f.run({}); if(f.won) base++; }
  console.log(race.padEnd(9), "with power", won, "without", base, "|", logs.slice(0,110));
}
// shouts
const s=G.newSave("x","X","nord"); s.location="High Hrothgar"; console.log(POWERS.greybeards(s)); console.log("UF level", POWERS.level(s,"unrelenting_force"));
G.loadout(s).rules=[{if:"always",do:"shout:unrelenting_force"},...G.loadout(s).rules];
const f=new G.Fight(s,wolf()); f.run({}); f.apply(); console.log(f.log.slice(0,3).map(l=>l.me).join(" | "), "voiceAt in", Math.round(s.voiceAt-G.now()));
// dragon soul
s.hpBonus=2000; G.setHealth(s,G.maxHealth(s)); const dr=G.scaleEnemy({...D.ENCOUNTERS.find(e=>e.name==="Dragon")},1); const f2=new G.Fight(s,dr); f2.run({}); console.log("dragon won", f2.won, f2.apply(), "souls", s.souls);
console.log("next word", JSON.stringify(POWERS.nextWord(s))); POWERS.learnWord(s,"YOL"); console.log(POWERS.unlock(s,"YOL"), POWERS.level(s,"fire_breath"));
// stones
s.location="Guardian Stones"; console.log(POWERS.takeStone(s,"warrior"), POWERS.xpMult(s,"One-Handed"), POWERS.xpMult(s,"Sneak"));
s.location="The Steed Stone"; console.log(POWERS.takeStone(s,"steed"), G.capacity(s));
s.location="The Serpent Stone"; POWERS.takeStone(s,"serpent"); G.loadout(s).rules=[{if:"first_turn",do:"power:stone"}]; const f3=new G.Fight(s,wolf()); f3.run({}); console.log(f3.log[0].me);
// road shouts
s.words.push("WULD"); s.unlocked.push("WULD"); G.startTrip(s,"Windhelm",WORLD.places.Windhelm); s.voiceAt=0; const before=G.minutesLeft(s); console.log(POWERS.roadShout(s,"whirlwind_sprint"), (before-G.minutesLeft(s)).toFixed(2),"min saved");
`,c);
