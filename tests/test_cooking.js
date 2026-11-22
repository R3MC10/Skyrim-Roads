const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const s=G.newSave("me","Remi","nord"); s.location="Riften"; [s.x,s.y]=WORLD.places.Riften;
ok(COOK.canFish(s,[s.x,s.y]).err.includes("rod"), "needs rod");
ok(D.SHOP_STOCK.general.includes("fishing_rod") && D.ITEMS.fishing_rod.name==="Fishing Rod", "rod sold");
G.give(s,"fishing_rod"); ok(COOK.canFish(s,[s.x,s.y]).water==="lake", "lake at Riften");
let got={}, miss=0; for(let i=0;i<300;i++){ const b=COOK.bite("lake"); const mid=(b.zone[0]+b.zone[1])/2; ok(b.zone[0]>=0.1&&b.zone[1]<=0.9,"zone in bar"); const r=COOK.reel(s,b,mid); got[r.item]=(got[r.item]||0)+1; if(!COOK.reel(s,b,b.zone[1]+0.02).ok) miss++; }
ok(miss===300, "outside the zone misses"); console.log("lake catches:", JSON.stringify(got));
ok(s.stats.fish===300, "fish counted");
// cook at the inn
for (const id of ["food_salt","food_potato","food_leek","food_carrot","fish_salmon"]) G.give(s,id,3);
ok(COOK.canCook(s), "inn pot");
let m=COOK.cook(s,"fish_stew"); ok(/Fisherman/.test(m) && s.inv.some(r=>r.item==="dish_fish_stew"), "cook stew: "+m);
ok(/need/.test(COOK.cook(s,"horker_stew")), "missing ingredients");
const cap=G.capacity(s); m=COOK.eatFood(s, s.inv.find(r=>r.item==="dish_fish_stew").id); ok(G.capacity(s)===cap+50, "carry buff "+m);
COOK.cook(s,"fish_soup"); COOK.eatFood(s, s.inv.find(r=>r.item==="dish_fish_soup").id); ok(G.capacity(s)===cap && G.fxSum(s,"warmth")===1, "new meal replaces the old");
// speed with warmth in a blizzard
const real=WEVENTS.weather; WEVENTS.weather=()=>({speed:0.5,id:"blizzard"}); const t={...s, fx:[]}; const vCold=G.speed(t), vWarm=G.speed(s); WEVENTS.weather=real;
ok(Math.abs(vWarm/vCold-1.5)<1e-6, "warmth halves the slowdown "+vWarm/vCold);
// campfire in the wilds
const w=G.newSave("w","Wil","nord"); w.location=null; [w.x,w.y]=[0.4,0.4]; ok(/Firewood/.test(COOK.makeCamp(w)), "needs wood");
G.give(w,"mat_firewood"); ok(/fire/.test(COOK.makeCamp(w)) && COOK.canCook(w), "camp lit");
const raw=w.inv.length; G.give(w,"food_potato"); ok(/\\+5 health/.test(COOK.eatFood(w,w.inv.find(r=>r.item==="food_potato").id)), "raw food");
ok(/can't eat/.test(COOK.eatFood(w,(G.give(w,"fishing_rod"), w.inv.find(r=>r.item==="fishing_rod").id))), "can't eat the rod");
console.log("cooking ok");
`,c);
