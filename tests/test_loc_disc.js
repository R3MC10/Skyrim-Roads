const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");const W=__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const s=G.newSave("A","Walker","nord");
ok(!s.discovered.some(n=>WORLD.hidden.has(n)),"new character knows no hidden place");
// walk Whiterun -> Windhelm and Whiterun -> Markarth, count discoveries
for (const dest of ["Windhelm","Markarth","Riften","Falkreath"]) {
  s.location=null; const before=s.discovered.length; let t=G.now();
  const err=G.startTrip(s, dest, WORLD.places[dest].slice(0,2), t); ok(!err,"trip "+err);
  let guard=0; while(s.trip && guard++<5000){ t+=30; const o=G.advance(s,t,[]); if(o.encounter){ s.trip.status="travel"; s.encounter=null; s.event=null; } if(s.trip && s.trip.status!=="travel") { s.trip.status="travel"; } }
  const got=s.discovered.slice(before);
  console.log("to", dest, "found", got.length, ":", got.slice(0,8).join(", "), got.length>8?"…":"");
}
ok(s.journal.some(j=>/📍 Discovered/.test(j.text)),"journal line");
// radii
ok(G.discoverRadius("city")>G.discoverRadius("landmark"),"radius by kind");
// rumours can reveal hidden places
s.location="Whiterun"; s.gold=999; const r=TOWNS.rumour(s); console.log("rumour:", r.slice(0,140));
// old save: discovered names survive migrate
const old=JSON.parse(JSON.stringify(s)); old.discovered.push("Nowhere Land"); G.migrate(old); ok(!old.discovered.includes("Nowhere Land") && old.discovered.includes("Windhelm"),"migrate");
// dungeon themes of new places
const th={}; for (const n of WORLD.hidden) if (DUNGEONS.enterable(n)) { const i=DUNGEONS.info(n); th[i.theme]=(th[i.theme]||0)+1; }
console.log("new dungeon themes", JSON.stringify(th));
// a new dungeon can be entered and played
const d=G.newSave("D","Delver","nord"); d.level=10; d.location="Gloomreach"; ok(!DUNGEONS.enter(d), "enter"); ok(d.dungeon && d.dungeon.rows.length>3,"layout");
const b=G.newSave("E","Camp","nord"); b.location="Traitor's Post"; ok(!DUNGEONS.enter(b) && b.dungeon.theme==="banditcamp","bandit camp"); console.log(DUNGEONS.describe("Traitor's Post"), "|", DUNGEONS.describe("Bthardamz"));
console.log("loc disc ok");
`,c);
