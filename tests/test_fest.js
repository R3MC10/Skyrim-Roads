const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","achievements.js","clans.js","festivals.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const at=(y,m,d)=>Date.UTC(y,m-1,d,12);
ok(FEST.active(at(2026,10,31)).id==="witching" && FEST.active(at(2026,11,20)).id==="frostfall" && FEST.active(at(2026,12,31)).id==="newlife" && FEST.active(at(2027,1,2)).id==="newlife" && FEST.active(at(2026,6,18)).id==="midyear", "calendar");
ok(!FEST.active(at(2026,3,10)) && !FEST.active(at(2026,11,10)) && !FEST.active(at(2027,1,4)), "quiet days");
ok(FEST.active(at(2026,12,30)).key===FEST.active(at(2027,1,2)).key, "New Life spans the new year as one event");
console.log("today:", FEST.active()?.name || "none", "· next:", FEST.next()?.name, "in", FEST.next()?.days, "days");
// frostfall weather: snow everywhere
let snow=0, base=0; const real=Date.now;
for(let i=0;i<200;i++){ const t=at(2026,11,20)/1000+i*1800; if(["snow","blizzard"].includes(WEVENTS.weatherAt("Whiterun",t).id)) snow++; const t2=at(2026,9,20)/1000+i*1800; if(["snow","blizzard"].includes(WEVENTS.weatherAt("Whiterun",t2).id)) base++; }
ok(snow>=100, "frostfall snows in Whiterun "+snow+"/200");
// goal + claim (frostfall: arrivals)
const s=G.newSave("a","A","nord"); const T=at(2026,11,20);
let msg; for(let i=0;i<8;i++) msg=FEST.count(s,"arrive",1,T)||msg; ok(/goal reached/.test(msg), "goal: "+msg);
ok(FEST.count(s,"undead",1,T)===null, "wrong kind doesn't count");
Date.now=()=>T; const g=s.gold; const cl=FEST.claim(s,T); ok(cl && s.gold===g+300 && s.titles.includes("Frostwalker"), "claim "+cl); ok(FEST.claim(s,T)===null,"once"); Date.now=real;
// new life gift + free inn
const N=at(2026,12,30); Date.now=()=>N; s.location="Whiterun";
ok(TOWNS.roomPrice(s)===0, "free inn"); ok(/Happy New Life/.test(FEST.innGift(s,N)) && /tomorrow/.test(FEST.innGift(s,N)), "gift once a day");
ok(s.inv.some(r=>r.item==="dish_veg_soup"), "soup in pack");
// midyear discount
Date.now=()=>at(2026,6,18); const p1=G.buyPrice(s,"mat_steel"); Date.now=()=>at(2026,3,1); const p2=G.buyPrice(s,"mat_steel"); ok(p1<p2, "midyear cheaper "+p1+" < "+p2);
// witching: undead at night
Date.now=()=>at(2026,10,30); let und=0; const w=G.newSave("w","W","nord"); [w.x,w.y]=WORLD.places.Whiterun; w.level=10;
const nightT=[...Array(200)].map((_,i)=>at(2026,10,30)/1000+i*600).find(t=>G.isNight(t));
for(let i=0;i<200;i++){ const e=G.rollEncounter?G.rollEncounter(w,nightT):null; if(e&&(e.tags||[]).includes("undead")) und++; }
Date.now=real;
console.log("witching night undead encounters:", G.rollEncounter?und+"/200":"(rollEncounter not exported)");
console.log("festivals ok");
`,c);
