const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","smithing.js","ammo.js","dollart.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
ok([...DOLL.SLOTS_LEFT,...DOLL.SLOTS_RIGHT].sort().join()===[...G.SLOTS].sort().join(),"doll slots = game slots");
const s=G.newSave("A","Doll","nord"); s.inv=[];
const a=G.give(s,"iron_sword"), b=G.give(s,"steel_sword"), h=G.give(s,"iron_helmet"), sh=G.give(s,"iron_shield"), g2=G.give(s,"iron_greatsword");
G.equip(s,a);
const cands=DOLL.candidates(s,"weapon");
ok(cands.length===3 && cands[0].worn && cands[0].row.id===a,"worn first");
const st=cands.find(x=>x.row.id===b); ok(st.cmp.diff===D.ITEMS.steel_sword.damage-D.ITEMS.iron_sword.damage && st.cmp.dir==="up","steel is better");
G.invRow(s,a).temper=5; ok(DOLL.statOf(G.invRow(s,a))===D.ITEMS.iron_sword.damage+5,"temper counts");
ok(DOLL.compare(G.invRow(s,b),G.invRow(s,a)).dir===(D.ITEMS.steel_sword.damage>D.ITEMS.iron_sword.damage+5?"up":D.ITEMS.steel_sword.damage<D.ITEMS.iron_sword.damage+5?"down":"same"),"compare with tempered");
const hc=DOLL.candidates(s,"head"); ok(hc.length===1 && hc[0].cmp.diff===D.ITEMS.iron_helmet.armor && hc[0].cmp.dir==="up","empty slot compares against 0");
ok(DOLL.candidates(s,"feet").length===0,"nothing for feet");
// equip shield then a two-hander drops the shield (existing rules, used by the picker)
G.equip(s,sh); ok(G.equipment(s).shield,"shield on"); G.equip(s,g2); ok(!G.equipment(s).shield,"2H takes off shield");
// loadouts: equipment is per loadout
G.saveLoadoutAs(s,"Archer"); s.loadout="Archer"; G.unequip(s,"weapon"); ok(!G.equipment(s).weapon,"unequip in Archer"); s.loadout="Main"; ok(G.equipment(s).weapon,"Main keeps its weapon");
for (const r of Object.keys(D.RACES)) { const p=DOLL.starterSave(r); ok(p && p.race===r,"starter "+r); }
console.log("doll ok · weapon candidates", cands.map(x=>x.row.item+":"+x.cmp.val).join(" "));
`,c);
