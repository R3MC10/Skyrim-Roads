const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const s=G.newSave("x","X","nord"); s.level=12; s.hpBonus=200; for(const sk of Object.values(s.skills)) sk.lvl+=40; G.setHealth(s,G.maxHealth(s));
const say=(m)=>m.length&&console.log(m.join("\\n   "));
say(QUESTS.check(s)); s.location="Whiterun"; say(QUESTS.check(s));
s.thaneWhiterun=true; say(QUESTS.check(s));
s.location="Western Watchtower"; let r=QUESTS.talk(s,"main"); console.log(r.text, r.died||"", (r.msgs||[]).join(" | ").slice(0,120), "souls", s.souls);
s.greybeards=true; say(QUESTS.check(s));
s.cleared={Ustengrav:G.now()+5}; say(QUESTS.check(s));
s.location="Kynesgrove"; G.setHealth(s,G.maxHealth(s)); r=QUESTS.talk(s,"main"); console.log(r.text, r.died||"", (r.msgs||[]).join(" | "));
// companions
s.location="Whiterun"; console.log(QUESTS.join(s,"companions")); G.setHealth(s,G.maxHealth(s)); r=QUESTS.talk(s,"companions"); console.log(r.text);
// thieves count
s.location="Riften"; console.log(QUESTS.join(s,"thieves")); s.stats={pp:(s.stats&&s.stats.pp||0)+1}; say(QUESTS.check(s)); s.stats.pp+=3; say(QUESTS.check(s));
console.log(JSON.stringify(QUESTS.active(s).map(a=>a.id+":"+a.st.title)));
`,c);
