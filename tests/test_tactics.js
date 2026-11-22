const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const dir=__GAME.replace(/[/]$/,"");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","curses.js","smithing.js","market.js","mp.js"]) if(fs.existsSync(dir+"/"+f)) vm.runInContext(fs.readFileSync(dir+"/"+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const bandit=()=>G.scaleEnemy(D.ENCOUNTERS.find(x=>x.name==="Bandit outlaw"), 5);
function fired(s, n=40, enemy=bandit){ const k={}; for(let i=0;i<n;i++){ const sim=G.clone(s); sim._test=true; sim.health=G.maxHealth(sim); const f=new G.Fight(sim,enemy()); f.run(); for(const l of f.log) k[l.rule]=(k[l.rule]||0)+1; } return k; }
// 1) the old bug: a rule added under "always → attack" never fired
const s=G.newSave("A","T","nord"); G.give(s,"potion_health_minor",10);
const L=G.loadout(s); L.rules=[{if:"always",do:"attack"},{if:"enemy_hp_below",pct:60,do:"power_attack"}];
let k=fired(s); ok(!k[2], "old layout: rule 2 dead (repro)"); ok(Object.keys(G.deadRules(L.rules)).includes("1"),"deadRules flags it");
// migration moves the catch-all to the bottom
s.tacV=0; ok(G.fixTactics(s),"fix moved"); ok(L.rules[0].if==="enemy_hp_below" && L.rules[1].if==="always","order fixed");
k=fired(s); ok(k[1]>0,"after fix rule 1 fires "+JSON.stringify(k));
ok(!G.fixTactics(s),"fix runs once");
// 2) addRule puts new rules above the catch-all
const s2=G.newSave("B","U","nord"); const L2=G.loadout(s2);
ok(L2.rules[L2.rules.length-1].do==="attack","default ends with attack");
G.addRule(L2.rules,{if:"first_turn",do:"power_attack"}); ok(L2.rules[L2.rules.length-2].if==="first_turn","inserted above catch-all");
ok(!Object.keys(G.deadRules(L2.rules)).length,"no dead rules");
// 3) switched-off rules are skipped
const s3=G.newSave("C","V","nord"); G.loadout(s3).rules=[{if:"always",do:"power_attack",off:true},{if:"always",do:"block"}];
k=fired(s3,20); ok(!k[1] && k[2]>0,"off skipped "+JSON.stringify(k));
// 4) new conditions evaluate
const s4=G.newSave("D","W","nord"); const f=new G.Fight(G.clone(s4),{name:"Boss",health:100,hp:100,damage:5,tags:["dragon","elite"],boss:true,danger:"high"});
f.turn=3; const t=(r)=>f.cond(r);
ok(t({if:"turn_at_least",pct:3})&&!t({if:"turn_at_least",pct:4}),"turn");
ok(t({if:"enemy_dragon"})&&t({if:"enemy_tough"})&&t({if:"enemy_boss"})&&!t({if:"enemy_construct"}),"enemy tags");
f.ehp=90; f.hp=10; ok(t({if:"hp_lower_than_enemy"}),"hp lower than enemy");
ok(!t({if:"follower_down"})&&!t({if:"summon_active"}),"follower/summon");
ok(G.describeRule({if:"turn_at_least",pct:4,do:"block"}).cond==="Turn number is at least 4","describe turn");
for (const id of Object.keys(D.CONDITIONS)) { try { f.cond({if:id,pct:50}); } catch(e){ ok(false,"cond throws "+id); } }
// 5) potion rule actually drinks in a real (non-test) fight
const s5=G.newSave("E","X","nord"); G.give(s5,"potion_health_minor",3); G.loadout(s5).rules=[{if:"hp_below",pct:90,do:"potion:health"},{if:"always",do:"attack"}];
const before=G.countRestore(s5,"health"); G.setHealth(s5,G.maxHealth(s5)*0.5); const f5=new G.Fight(s5,bandit()); f5.run(); f5.apply();
ok(f5.log.some(l=>l.rule===1) && G.countRestore(s5,"health")<before,"potion used in a real fight");
console.log("tactics ok · conditions", Object.keys(D.CONDITIONS).length);
`,c);
