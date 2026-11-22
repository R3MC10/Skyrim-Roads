const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Crafting mini-games: grades, caps, diminishing, quick craft == old crafting, botches refund part.
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","mp.js","craftgames.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const n=(s,i)=>SMITH.count(s,i);
const fresh=()=>{ const s=G.newSave("A","Smith","nord"); s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun; s.inv=[]; s.gold=0; return s; };
// ---- grades
ok(CG.grade(0)==="botched" && CG.grade(0.11)==="botched" && CG.grade(0.2)==="rough" && CG.grade(0.5)==="good" && CG.grade(0.7)==="great" && CG.grade(0.9)==="masterful" && CG.grade(0.99)==="perfect","grade thresholds");
ok(CG.QUICK==="good","quick is the average grade");
// ---- quick craft == plain crafting (same rows, same temper, same xp)
{ const a=fresh(), b=fresh(); for(const s of [a,b]){ G.give(s,"mat_iron",5); G.give(s,"mat_strips",3); }
  const ma=SMITH.make(a,"iron_sword"), mb=CG.smithMake(b,"iron_sword",CG.QUICK);
  ok(ma===mb,"same message"); ok(JSON.stringify(a.inv)===JSON.stringify(b.inv),"same pack"); ok(a.skills.Smithing.xp===b.skills.Smithing.xp,"same xp"); }
// ---- great/perfect smithing: small temper bonus, no extra xp
{ const a=fresh(), b=fresh(); for(const s of [a,b]){ G.give(s,"mat_iron",10); G.give(s,"mat_strips",6); }
  CG.smithMake(a,"iron_sword",CG.QUICK); const m=CG.smithMake(b,"iron_sword","perfect");
  const rb=b.inv.find(r=>r.item==="iron_sword"); ok(rb.temper===2 && rb.mw==="perfect","perfect weapon +2 "+JSON.stringify(rb)+" "+m);
  ok(a.skills.Smithing.xp===b.skills.Smithing.xp,"no bonus xp");
  CG.smithMake(b,"iron_helmet","perfect"); const h=b.inv.find(r=>r.item==="iron_helmet"); ok(h && h.temper===3,"perfect armor +3");
  CG.smithMake(b,"iron_dagger","great"); ok(b.inv.find(r=>r.item==="iron_dagger").temper===1,"great weapon +1");
  CG.smithMake(b,"iron_war_axe","rough"); const rr=b.inv.find(r=>r.item==="iron_war_axe"); ok(rr && !rr.temper && !rr.mw,"rough = plain"); }
// ---- botched: fails, gives half the materials back, less xp than making
{ const s=fresh(); G.give(s,"mat_iron",5); G.give(s,"mat_strips",3); const need=SMITH.RECIPES.iron_sword.mats;
  const m=CG.smithMake(s,"iron_sword","botched"); ok(/^Botched/.test(m),"botched msg "+m); ok(!n(s,"iron_sword"),"no sword");
  ok(n(s,"mat_iron")===5-need[0][1]+Math.floor(need[0][1]/2),"half iron back");
  ok(/Missing/.test(CG.smithMake(fresh(),"iron_sword","botched")),"botch still checks mats"); }
// ---- diminishing: after 8 bonus crafts in a day the bonus halves, after 16 quarters
{ const s=fresh(); G.give(s,"mat_iron",400); G.give(s,"mat_strips",200);
  const t=[]; for(let i=0;i<20;i++){ CG.smithMake(s,"iron_dagger","perfect"); const r=s.inv.filter(x=>x.item==="iron_dagger").pop(); t.push(r.temper||0); }
  console.log("dagger tempers over a day", t.join(","));
  ok(t.slice(0,8).every(v=>v===2),"first 8 full"); ok(t.slice(8,16).every(v=>v===1),"next 8 half"); ok(t.slice(16).every(v=>v===0),"then nothing for weapons");
  ok(CG.factor(s,"smith")===0.25,"quarter"); ok(CG.factor(s,"smith",G.now()+3*3600)<=1,"day based");
  ok(CG.factor(s,"smith",G.now()+24*3600/G.GAME_SPEED+5)===1,"resets next in-game day"); ok(CG.factor(s,"alch")===1,"per kind"); }
// ---- refine: perfect gives +1 once per batch; botched spoils one batch only
{ const s=fresh(); G.give(s,"ore_iron",8); const k=SMITH.REFINE.findIndex(r=>r[0]==="mat_iron");
  const m=CG.refine(s,k,true,"perfect"); ok(n(s,"mat_iron")===5,"4 + 1 extra "+m);
  G.give(s,"ore_iron",6); CG.refine(s,k,true,"botched"); ok(n(s,"mat_iron")===7 && n(s,"ore_iron")===1,"botch spoils one batch: 2 made, 1 ore back "+n(s,"mat_iron")+" "+n(s,"ore_iron"));
  const q=fresh(), p=fresh(); G.give(q,"ore_iron",4); G.give(p,"ore_iron",4); ok(CG.refine(q,k,true,CG.QUICK)===SMITH.refine(p,k,true),"quick refine == plain"); }
// ---- alchemy: perfect stronger by 10% at most, xp unchanged, quick identical
{ const mk=()=>{ const s=fresh(); G.give(s,"ing_blue_flower"); G.give(s,"ing_wheat"); return s; };
  const shared=TOWNS.brewPreview(fresh(),["ing_blue_flower","ing_wheat"]); console.log("shared", shared.join(","));
  const a=mk(), b=mk(), q=mk();
  const ra=TOWNS.brew(a,a.inv.map(r=>r.id)), rq=CG.brew(q,q.inv.map(r=>r.id),CG.QUICK), rb=CG.brew(b,b.inv.map(r=>r.id),"perfect");
  ok(ra.text===rq.text,"quick brew same"); const pa=a.inv.find(r=>r.item.startsWith("brew|")).item, pb=b.inv.find(r=>r.item.startsWith("brew|")).item;
  const ma=D.ITEMS[pa].effects[0][1], mb=D.ITEMS[pb].effects[0][1]; console.log("potion", ma, "→ perfect", mb, rb.text);
  ok(mb>=ma && mb<=Math.round(ma*1.1)+0.001,"<=10%"); ok(a.skills.Alchemy.xp===b.skills.Alchemy.xp,"no alch xp bonus");
  const c2=mk(); const rc=CG.brew(c2,c2.inv.map(r=>r.id),"botched"); ok(rc.botched && c2.inv.length===1,"botched brew: one ingredient saved"); }
// ---- enchanting: perfect +10% at most; botched loses the gem, keeps the item
{ const mk=()=>{ const s=fresh(); s.location="Winterhold"; s.enchants=["health"]; const it=G.give(s,"iron_helmet"); const g=G.give(s,"soul_gem_common"); return [s,it,g]; };
  if (!D.ITEMS.soul_gem_common) console.log("no soul gems?"); else {
  const [a,ia,ga]=mk(), [b,ib,gb]=mk(), [q,iq,gq]=mk();
  const ma=ENCH.enchant(a,ia,"health",ga), mq=CG.enchant(q,iq,"health",gq,CG.QUICK), mb=CG.enchant(b,ib,"health",gb,"perfect");
  ok(ma===mq,"quick ench same"); const ea=a.inv.find(r=>String(r.item).startsWith("ench|")).item, eb=b.inv.find(r=>String(r.item).startsWith("ench|")).item;
  const xa=+ea.split("|")[3], xb=+eb.split("|")[3]; console.log("enchant", xa, "→ perfect", xb); ok(xb>=xa && xb<=Math.round(xa*1.1),"ench <=10%");
  const [c2,ic,gc]=mk(); const mc=CG.enchant(c2,ic,"health",gc,"botched"); ok(/slips/.test(mc) && G.invRow(c2,ic) && !G.invRow(c2,gc),"botched ench: item kept, gem spent "+mc); } }
// ---- bonuses are capped no matter what grade string comes in
{ const s=fresh(); ok(CG.bonus(s,"alch","perfect")<=1.1 && CG.bonus(s,"ench","perfect")<=1.1 && CG.bonus(s,"smith","perfect","weapon")<=2 && CG.bonus(s,"smith","perfect","armor")<=3 && CG.bonus(s,"smith","perfect","other")===0,"caps");
  ok(CG.bonus(s,"alch","nonsense")===1 && CG.bonus(s,"smith","nonsense","weapon")===0,"unknown grades give nothing"); }
// ---- jewellery and games mapping
ok(CG.gameFor("smith","gold_ring")==="precise" && CG.gameFor("smith","iron_sword")==="hammer" && CG.gameFor("refine",SMITH.REFINE.findIndex(r=>r[3]==="smelt"))==="bellows" && CG.gameFor("refine",SMITH.REFINE.findIndex(r=>r[3]==="tan"))==="precise" && CG.gameFor("alch")==="mix" && CG.gameFor("ench")==="rune","game per job");
{ const s=fresh(); G.give(s,"mat_gold",1); G.give(s,"gem_ruby",1); ok(/^You make/.test(CG.smithMake(s,"gold_ruby_ring","perfect")),"jewel ok"); }
// ---- without a DOM the game is skipped (quick)
let got=null; CG.run("hammer",{skill:20},(g)=>got=g); ok(got===CG.QUICK,"no DOM → quick");
console.log("craftgames ok");
`,c);
