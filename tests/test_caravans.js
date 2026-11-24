const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
// Deterministic run: a fixed clock (which caravan is in town, its road and ambush plan) and a seeded
// Math.random (fight rolls). With the real clock + random, a guard could now and then lose an ambush fight,
// wake up in the nearest temple (sometimes the destination town) and fail the ambush count at random in CI.
const FIXED_NOW=Date.UTC(2026,0,15,12,0,0);
class FixedDate extends Date{ constructor(...a){ if(a.length) super(...a); else super(FIXED_NOW); } static now(){ return FIXED_NOW; } }
let seed=+process.env.SEED||20260115; const SeededMath=Object.create(Math);
SeededMath.random=()=>{ seed=(seed+0x6D2B79F5)|0; let x=Math.imul(seed^(seed>>>15),1|seed); x=(x+Math.imul(x^(x>>>7),61|x))^x; return ((x^(x>>>14))>>>0)/4294967296; };   // mulberry32
const c={console,Math:SeededMath,Date:FixedDate,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","caravans.js","mp.js"]) if(fs.existsSync(W+f)) vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
// schedule: deterministic, legs make sense
const t0=G.now();
const a=JSON.stringify(CARAVANS.all(t0).map(x=>[x.id,x.phase,x.from,x.to,x.depart])), b=JSON.stringify(CARAVANS.all(t0).map(x=>[x.id,x.phase,x.from,x.to,x.depart]));
ok(a===b && CARAVANS.all(t0).length===4,"deterministic 4 caravans");
for(const L of CARAVANS.LINES){ const st=CARAVANS.state(L,t0); ok(st && st.depart>st.depart-1 && st.arrive>st.depart,"times "+L.id); const secs=st.arrive-st.depart; ok(secs>=120&&secs<3600*1.5,"leg secs "+L.id+" "+secs); }
console.log("legs:", CARAVANS.all(t0).map(x=>x.line.id+" "+x.from+"→"+x.to+" "+x.phase+" "+Math.round((x.arrive-x.depart)/60)+"min").join(" | "));
// find a caravan in its stop phase
let t=t0, cv=null; for(let i=0;i<4000&&!cv;i++){ cv=CARAVANS.all(t).find(x=>x.phase==="stop"&&x.depart-t>60); if(!cv) t+=30; }
ok(cv,"found stopped caravan");
const mk=(id,lvl)=>{ const s=G.newSave(id,"P"+id,"nord"); s.level=lvl; s.location=cv.from; [s.x,s.y]=WORLD.places[cv.from]; s.gold=0; for(const k of Object.keys(s.skills)) s.skills[k].lvl+=lvl; G.setHealth(s,G.maxHealth(s)); return s; };
const A=mk("A",20), B=mk("B",20);
ok(CARAVANS.signOn(A,cv.id,t).doc && CARAVANS.signOn(B,cv.id,t).doc,"sign on");
ok(CARAVANS.signOn(A,"nope",t).err,"bad id");
const C=mk("C",5); C.location=["Riften","Markarth","Solitude"].find(x=>x!==cv.from); ok(CARAVANS.signOn(C,cv.id,t).err,"wrong town");
// leave before departure
const D2=mk("D",5); CARAVANS.signOn(D2,cv.id,t); ok(/won't be coming/.test(CARAVANS.leave(D2)) && !D2.caravanJob,"leave");
// departure starts the trip
ok(/rolls out/.test(CARAVANS.tick(A,cv.depart+1)),"A departs"); CARAVANS.tick(B,cv.depart+1);
ok(A.trip && A.trip.caravan===cv.id && A.trip.speed===CARAVANS.SPEED,"trip follows caravan");
// late player misses it
const E=mk("E",5); CARAVANS.signOn(E,cv.id,t); E.location=["Riften","Markarth","Solitude"].find(x=>x!==cv.from); ok(/without you/.test(CARAVANS.tick(E,cv.depart+5)),"missed");
// advance A to arrival, resolving ambushes by fighting
const plan=CARAVANS.plan(cv); let amb=0, guard=0;
G.setAllyProvider(()=>[{name:"Caravan guard",dmg:10},{name:"Caravan guard",dmg:10}]);
while(A.trip && guard++<200){ const out=G.advance(A, Math.min(cv.arrive+5, A.trip.lastTick+120)); if(out.encounter){ amb++; ok(out.encounter.caravan,"ambush flagged"); G.setHealth(A,G.maxHealth(A),A.trip.lastTick); const r=G.encounterAction(A,"fight",A.trip.lastTick); ok(!r.died && A.trip,"guard won ambush "+amb+" vs "+out.encounter.name+(r.died?" ("+r.died+")":"")); } if(out.arrived) break; }
ok(amb===plan.at.length,"ambush count "+amb+" vs "+plan.at.length);
ok(A.location===cv.to && !A.trip,"arrived "+A.location+" alive="+!A.trip);
console.log("ambushes", amb, "foes", plan.foes.join(","), "arrived at", A.location, "t vs caravan", Math.round((A.lastArr||0)));
// pay: two guards signed → pool split, claim once
const guards=[{caravanId:cv.id,uid:"A"},{caravanId:cv.id,uid:"B"},{caravanId:cv.id,uid:"D",status:"left"}];
const sh=CARAVANS.share(cv.id,guards,cv.from,cv.to); ok(sh.n===2 && sh.each*2<=sh.pool && sh.pool===Math.round(plan.pool*1.5),"split "+JSON.stringify(sh));
const arr=CARAVANS.arrived(A,guards); ok(arr && arr.pay===sh.each,"arrived pay");
let doc={caravanId:cv.id,uid:"A",status:"signed"}; const d1=CARAVANS.claim(doc,arr.pay); ok(d1&&d1.status==="paid","claim"); ok(CARAVANS.claim(d1,arr.pay)===null,"single claim");
const solo=CARAVANS.share(cv.id,[{caravanId:cv.id,uid:"A"}],cv.from,cv.to); ok(solo.each===plan.pool,"solo pay");
// desertion: flee during an ambush → no job
const F2=mk("F",20); CARAVANS.signOn(F2,cv.id,t); CARAVANS.tick(F2,cv.depart+1); ok(/deserters/.test(CARAVANS.deserted(F2)) && !F2.caravanJob && !F2.trip.caravan,"desert");
// cart: capacity, speed, roam block, ambush
const H2=G.newSave("H","Hauler","nord"); H2.location="Whiterun"; H2.gold=5000; const cap0=G.capacity(H2);
ok(/need a horse/.test(CARAVANS.buyCart(H2)),"needs horse"); HORSES.buy(H2,"Bess","bay"); const cap1=G.capacity(H2), v1=G.speed(H2);
ok(/cart is yours/.test(CARAVANS.buyCart(H2)),"buy cart"); ok(G.capacity(H2)===cap1+CARAVANS.CART_CARRY,"carry +300"); { const r=G.speed(H2)/v1; ok(r>0.85&&r<0.95,"slower "+r); }
ok(CARAVANS.roamBlocked(H2),"roam blocked"); ok(/leave the cart/.test(CARAVANS.toggleCart(H2)) && !CARAVANS.roamBlocked(H2) && G.capacity(H2)===cap1,"parked");
CARAVANS.toggleCart(H2); ok(CARAVANS.hasCart(H2),"rehitched");
let raids=0; for(let i=0;i<2000;i++) if(CARAVANS.cartAmbush(H2)) raids++; ok(raids>120&&raids<300,"raid rate "+raids);
CARAVANS.buyWheels(H2); raids=0; for(let i=0;i<2000;i++) if(CARAVANS.cartAmbush(H2)) raids++; ok(raids<150,"wheels halve "+raids);
// goods
const st=CARAVANS.stock(cv); ok(st.length>=3 && st.every(i=>D.ITEMS[i]),"stock"); H2.location=cv.from; ok(/You buy/.test(CARAVANS.buy(H2,cv.id,st[0],t)),"buy goods");
console.log("caravans ok · pay each", sh.each, "of", sh.pool, "· raids w/ wheels", raids);
`,c);
