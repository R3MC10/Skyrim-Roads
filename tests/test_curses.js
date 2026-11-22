const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","achievements.js","clans.js","festivals.js","wars.js","curses.js","mp.js"])vm.runInContext(fs.readFileSync((process.env.W||__GAME + "")+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
function hero(wolf){ const s=G.newSave("h","H","nord"); s.level=12; s.hpBonus=110; for(const k of Object.keys(s.skills)) s.skills[k].lvl+=30; G.setHealth(s,G.maxHealth(s));
  if(wolf){ s.werewolf={since:0}; G.loadout(s).rules.unshift({if:"always",do:"power:beast"}); } return s; }
const foes=D.ENCOUNTERS.filter(e=>e.kind!=="event"&&["medium","high"].includes(e.danger));
function rate(wolf){ let w=0,n=0; for(let i=0;i<600;i++){ const s=hero(wolf), base=foes[i%foes.length]; const e=JSON.parse(JSON.stringify(base)); e.hp=e.health; const f=new G.Fight(s,e,null,G.now()); f.allies=[]; f.run({t:G.now()}); n++; if(f.won) w++; } return Math.round(100*w/n); }
const plain=rate(false), wolf=rate(true);
console.log("level 12 vs medium/high encounters: normal", plain+"%", "· with Beast Form", wolf+"%");
ok(wolf>plain && wolf-plain<=30, "Beast Form helps but isn't a win button");
// beast form blocks potions, and only once a day
const s=hero(true); ok(CURSE.beastReady(s), "ready"); const e={name:"Troll",health:200,hp:200,damage:20,tags:["beast"]}; const f=new G.Fight(s,e,null,G.now()); f.allies=[];
ok(POWERS.affordable(f,"power","beast"), "can transform"); POWERS.act(f,"power","beast"); ok(f.pw.beast===CURSE.BEAST_TURNS && !POWERS.affordable(f,"power","beast"), "once");
G.give(s, Object.keys(D.ITEMS).find(k=>D.ITEMS[k]?.restore?.[0]==="health")); ok(!f.can ? true : true, ""); ok(CURSE.noPotions(f), "no potions as a beast");
s.beastAt=G.now(); ok(!CURSE.beastReady(s), "cooldown");
// werewolves get no Rested bonus
const r1=G.newSave("r","R","nord"); r1.rested=G.now()+999; r1.restBonus=0.1; const x0=r1.skills.Archery.xp; G.useSkill(r1,"Archery",10); const gain1=r1.skills.Archery.xp-x0;
const r2=G.newSave("r","R","nord"); r2.rested=G.now()+999; r2.restBonus=0.1; r2.werewolf={}; const y0=r2.skills.Archery.xp; G.useSkill(r2,"Archery",10); const gain2=r2.skills.Archery.xp-y0;
ok(gain1>gain2, "no Rested for wolves "+gain1+" vs "+gain2);
// offer only after the Companions
const c2=G.newSave("c","C","nord"); ok(!CURSE.offered(c2),"no offer yet"); c2.quests={companions:{done:true}}; ok(CURSE.offered(c2),"offer"); c2.location="Whiterun"; ok(/Circle/.test(CURSE.acceptWolf(c2)) && c2.werewolf, "accept");
ok(/only yourself/.test(CURSE.cureWolf(c2)) && !c2.werewolf, "cure wolf (the end of Purity of the Blood)");
// vampire path
const v=G.newSave("v","V","nord"); let infected=false; for(let i=0;i<60&&!infected;i++) infected=!!CURSE.maybeInfect(v,{name:"Vampire"});
ok(infected && v.sanguinare, "can catch it"); ok(CURSE.maybeInfect(v,{name:"Wolf"})===null, "only vampires");
const pot=Object.keys(D.ITEMS).includes("potion_cure_disease"); ok(pot && D.SHOP_STOCK.general.includes("potion_cure_disease"), "cure potion sold");
G.give(v,"potion_cure_disease"); ok(/gone/.test(TOWNS.drink(v, v.inv.find(r=>r.item==="potion_cure_disease").id)) && !v.sanguinare, "potion cures the disease");
v.sanguinare={at:G.now()-CURSE.TURN_AFTER-5}; ok(/vampire now/.test(CURSE.update(v)) && v.vampire, "turns after 3 in-game days");
ok(CURSE.fx(v,"spell:Destruction")>=20, "stronger magic");
v.vampire.fedAt=G.now()-20*3600; ok(CURSE.stage(v)===4, "starving = stage 4"); v.location="Whiterun"; CURSE.feed(v); ok(CURSE.stage(v)===1, "fed");
ok(/Sunlight/.test(CURSE.cureVampire(v)) && !v.vampire, "cure vampire (the end of Rising at Dawn)");
const w=G.newSave("w","W","nord"); w.werewolf={}; for(let i=0;i<100;i++) CURSE.maybeInfect(w,{name:"Vampire"}); ok(!w.sanguinare, "werewolves can't catch it");
console.log("curses ok");
`,c);
