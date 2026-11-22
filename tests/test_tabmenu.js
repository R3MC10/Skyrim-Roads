const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Tab compass (tabmenu.js): swipe directions, the compass ring, tab stepping, the bottom bar and the Skills/Perks panels.
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
const W=process.env.W||__GAME + "";
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","mp.js","skillinfo.js","tabmenu.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const T=TABMENU;
// directions: like Skyrim's Tab menu
ok(T.DIR.left==="magic"&&T.DIR.right==="items"&&T.DIR.up==="char"&&T.DIR.down==="map","directions");
ok(T.swipeDir(-80,5)==="left"&&T.swipeDir(80,-6)==="right"&&T.swipeDir(4,-90)==="up"&&T.swipeDir(-3,70)==="down","swipe dirs");
ok(T.swipeDir(30,0)===null,"too short");
ok(T.swipeDir(60,55)===null,"diagonal is not a swipe");
ok(T.swipeDir(-90,0,5000)===null,"slow drag is not a swipe");
// ring clockwise: char(up) -> items(right) -> map(down) -> magic(left)
ok(T.ring("char",1)==="items"&&T.ring("items",1)==="map"&&T.ring("map",1)==="magic"&&T.ring("magic",1)==="char","ring +");
ok(T.ring("char",-1)==="magic"&&T.ring("items",-1)==="char"&&T.ring("skills",1)==="items","ring -");
// stepping tabs
ok(T.step(["a","b","c"],"a",1).id==="b"&&T.step(["a","b","c"],"c",1).edge===1&&T.step(["a","b","c"],"a",-1).edge===-1,"step");
ok(T.CHAR_TABS.map(t=>t[0]).join()==="stars,hero,perks,tactics,stats,diary","char tabs");
// bottom bar
const S=G.newSave("A","Sigrid","nord"); S.gold=321; S.level=4; S.charXp=50.6; [S.x,S.y]=WORLD.places.Whiterun; S.location="Whiterun";
const b=T.bar(S);
ok(b.gold===321&&b.level===4&&b.need===175&&b.xp===51&&b.pct===29,"bar numbers "+JSON.stringify(b));
ok(b.w===Math.round(G.carried(S))&&b.cap===Math.round(G.capacity(S))&&b.over===false,"bar weight");
ok(b.perks===PERKS.pointsLeft(S)+(S.pendingLevels||0),"bar perk points");
ok(["quest","idle"].includes(b.task.k)&&b.task.text,"task idle/quest "+JSON.stringify(b.task));
S.dungeon={place:"Bleak Falls Barrow",room:{enemy:{}}}; ok(T.task(S).k==="dun"&&T.task(S).hot,"task dungeon"); S.dungeon=null;
S.trip={status:"encounter",encounter:{name:"Bandit"}}; ok(T.task(S).k==="enc"&&/Bandit/.test(T.task(S).text),"task encounter");
S.trip=null;
// panels render without NaN/undefined, for every skill
for(const sk of D.ALL_SKILLS){ T.starSkill=sk; const h=T.stars(S); ok(h.includes('tw-card')&&!/NaN|undefined/.test(h),"stars "+sk); }
ok((T.stars(S).match(/class="tw-card/g)||[]).length===D.ALL_SKILLS.length,"one card per skill");
const p=T.perks(S); ok(/Ready to take/.test(p)&&!/NaN|undefined/.test(p),"perks panel");
const vet=G.newSave("B","Vet","khajiit"); vet.level=30; for(const k of D.ALL_SKILLS) vet.skills[k].lvl=60;
const pv=T.perks(vet); ok((pv.match(/data-act="perk"/g)||[]).length>10,"vet has perks to take");
PERKS.take(vet,"armsman"); ok(/Armsman/.test(T.perks(vet).split("Your perks")[1]),"taken perk listed");
ok(T.mini("One-Handed",vet).startsWith("<svg"),"mini constellation");
console.log("tabmenu ok");
`,c);
