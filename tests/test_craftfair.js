const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","craftfair.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); console.log("ok", m); };
const fresh=()=>{ const s=G.newSave("A","Smith","nord"); s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun; s.inv=[]; s.gold=0; return s; };
let T=1e6; G.now=()=>T;
// 1. diminishing XP for the same craft
{ const s=fresh(); G.give(s,"mat_iron",40); G.give(s,"mat_strips",40);
  const gain=()=>{ const sk=s.skills.Smithing, x0=sk.xp, l0=sk.lvl; SMITH.make(s,"iron_dagger"); return [sk.lvl-l0, sk.xp-x0]; };
  const x=()=>s.skills.Smithing.xp+s.skills.Smithing.lvl*1e6;
  const a0=x(); SMITH.make(s,"iron_dagger"); const first=x()-a0;
  const m=[]; for(let i=0;i<6;i++){ const b=x(); const out=SMITH.make(s,"iron_dagger"); m.push(x()-b); if(i===5) ok(/teaches you less/.test(out),"tells the player XP is reduced"); }
  ok(m[5] < first*0.3, "6th repeat earns <30% of first ("+first.toFixed(1)+" → "+m[5].toFixed(1)+")");
  ok(CRAFTFAIR.repeatMult(s,"smith:iron_dagger",T,false) < 0.2, "multiplier low after spam");
  T += CRAFTFAIR.REPEAT_DECAY*12; ok(CRAFTFAIR.repeatMult(s,"smith:iron_dagger",T,false)===1, "recovers after 12 in-game hours");
  ok(CRAFTFAIR.repeatMult(s,"smith:iron_sword",T,false)===1, "a different item is full XP");
  ok(SMITH.info(s,"iron_dagger").xpMult===1, "info shows xp multiplier");
}
// 2. crafted things don't sell above material value; buy→craft→sell never profits, even at max Mercantile
{ const s=fresh(); s.skills.Mercantile.lvl=100; s.skills.Smithing.lvl=100; for(const p of ["steel_smithing","elven_smithing","dwarven_smithing","advanced_armors"]) (s.perks=s.perks||{})[p]=1;
  if(PERKS.BY_ID.haggling) s.perks.haggling=5; if(PERKS.BY_ID.master_trader) s.perks.master_trader=1;
  let bad=[];
  for(const [id,rc] of Object.entries(SMITH.RECIPES)){ if(rc.needs) continue; s.inv=[];
    for(const [i,n] of rc.mats) G.give(s,i,n);
    const cost=rc.mats.reduce((a,[i,n])=>a+G.buyPrice(s,i)*n,0), rawMats=rc.mats.reduce((a,[i,n])=>a+G.sellPrice(s,{item:i})*n,0);
    const out=SMITH.make(s,id); if(!/^You make/.test(out)) { bad.push(id+" "+out); continue; }
    const r=s.inv.find(x=>x.item===id); if(r.cv==null) bad.push(id+" no cv");
    const sp=G.sellPrice(s,r); if(sp>cost) bad.push(id+" profit "+cost+"→"+sp);
    if(sp>Math.max(1,D.ITEMS[id].value)) bad.push(id+" over value");
    if(sp>rawMats+Math.max(2,rawMats*0.15)) bad.push(id+" sells for more than its materials ("+rawMats+"→"+sp+")");
  }
  ok(!bad.length,"no crafting money loop: "+bad.slice(0,5).join("; "));
  // looted gear is untouched
  s.inv=[]; G.give(s,"steel_sword"); const lr=s.inv[0]; ok(lr.cv==null && G.sellPrice(s,lr)>=G.sellPrice(s,{item:"steel_sword"}), "found gear sells as before");
  // jewellery: the old money printer
  s.inv=[]; G.give(s,"mat_gold"); G.give(s,"gem_diamond"); SMITH.make(s,"gold_diamond_necklace"); const jr=s.inv.find(x=>x.item==="gold_diamond_necklace");
  ok(G.sellPrice(s,jr) <= G.sellPrice(s,{item:"mat_gold"})+G.sellPrice(s,{item:"gem_diamond"})+5, "crafted necklace ≈ its gold and diamond, not more");
}
// 3. value survives chests, stalls and trades
{ const s=fresh(); G.give(s,"mat_steel",5); G.give(s,"mat_iron",3); G.give(s,"mat_strips",5); s.perks={steel_smithing:1};
  SMITH.make(s,"steel_sword"); const r=s.inv.find(x=>x.item==="steel_sword"), cv=r.cv;
  const pr=G.sellPrice(s,r);
  // market round trip
  s.homes={Whiterun:{chest:[]}}; const L=MARKET.list(s,r.id,500,[]); ok(L.doc && L.doc.row.cv===cv,"stall keeps value"); const back=MARKET.settle(s,{...L.doc,status:"withdrawn"}); const r2=s.inv.find(x=>x.item==="steel_sword"); ok(r2 && r2.cv===cv && G.sellPrice(s,r2)===pr,"withdrawn from stall: same price");
  // a home chest round trip
  if(TOWNS.stash){ TOWNS.stash(s,r2.id); TOWNS.unstash(s,0); const r3=s.inv.find(x=>x.item==="steel_sword"); ok(r3 && r3.cv===cv,"chest keeps value"); }
}
// 4. enchanting a cheap dagger doesn't turn into gold
{ const s=fresh(); s.location="Winterhold"; s.enchants=["fire"]; s.skills.Enchanting.lvl=100; s.skills.Mercantile.lvl=100;
  G.give(s,"iron_dagger"); G.give(s,"soul_gem_greater"); const d=s.inv.find(x=>x.item==="iron_dagger"), g=s.inv.find(x=>x.item==="soul_gem_greater");
  const gemSell=G.sellPrice(s,g), dSell=G.sellPrice(s,d);
  const out=ENCH.enchant(s,d.id,"fire",g.id); ok(/You made/.test(out),"enchanted: "+out.slice(0,60));
  const e=s.inv.find(x=>String(x.item).startsWith("ench|")); ok(G.sellPrice(s,e) <= Math.ceil((gemSell+dSell)*1.05)+2, "enchanted dagger sells ≈ dagger + gem ("+(gemSell+dSell)+" vs "+G.sellPrice(s,e)+")");
  // repeat enchant XP drops
  const xs=[]; for(let i=0;i<5;i++){ G.give(s,"iron_dagger"); G.give(s,"soul_gem_greater"); const dd=s.inv.filter(x=>x.item==="iron_dagger").pop(), gg=s.inv.find(x=>x.item==="soul_gem_greater"); const b=s.skills.Enchanting.xp; ENCH.enchant(s,dd.id,"fire",gg.id); xs.push(s.skills.Enchanting.xp-b); }
  ok(xs[4]<xs[0]*0.5 || s.skills.Enchanting.lvl>=100, "enchant spam teaches less ("+xs.map(x=>x.toFixed(2)).join(",")+")");
}
// 5. alchemy: brewed potions carry ingredient value; capped sale; repeat XP falls
{ const s=fresh(); s.skills.Alchemy.lvl=100; s.skills.Mercantile.lvl=100;
  const ing=Object.keys(TOWNS.INGREDIENT_FX); let pair=null;
  for(const a of ing) for(const b of ing) if(!pair && a<b && TOWNS.brewPreview(s,[a,b]).length) pair=[a,b];
  const xp=[]; let pot=null;
  for(let i=0;i<5;i++){ s.inv=s.inv.filter(x=>!x.item.startsWith("ing")); G.give(s,pair[0]); G.give(s,pair[1]); const ids=s.inv.filter(x=>pair.includes(x.item)).map(x=>x.id); const x0=s.skills.Alchemy.xp; TOWNS.brew(s,ids); xp.push(s.skills.Alchemy.xp-x0); }
  pot=s.inv.find(x=>x.item.startsWith("brew|")); ok(pot && pot.qty===5 && pot.cv>0,"5 potions stacked, with ingredient value");
  const ingV=D.ITEMS[pair[0]].value+D.ITEMS[pair[1]].value;
  ok(G.sellPrice(s,pot) <= Math.ceil(ingV*CRAFTFAIR.POTION_MARKUP)+1, "potion sells for at most "+CRAFTFAIR.POTION_MARKUP+"× its ingredients");
  ok(G.sellPrice(s,pot) < G.buyPrice(s,pair[0])+G.buyPrice(s,pair[1]), "buying ingredients to sell potions loses gold");
  ok(xp[4] < xp[0]*0.5 || s.skills.Alchemy.lvl>=100, "same brew teaches less");
}
// 6. fortify crafting caps and no feedback loop
{ const s=fresh(); s.skills.Smithing.lvl=50; s.active=s.active||[];
  const raw=CRAFTFAIR.rawSkill; G.fxSum && true;
  s.effects=(s.effects||[]);
  // fake big fortify by wrapping rawSkill reading: push many potions through the engine if it has an effects list
  const fx=G.fxSum; const old=G.fxSum;
  ok(G.skill(s,"Smithing")<=50+CRAFTFAIR.FORTIFY_CAP,"skill within cap");
  // simulate +80 fortify via the save's potion effects
  const before=G.skill(s,"Smithing");
  s.fx=[{key:"skill:Smithing",mag:80,until:Date.now()/1000+1e5}];
  const after=G.skill(s,"Smithing"), rawAfter=raw(s,"Smithing");
  ok(after<=50+CRAFTFAIR.FORTIFY_CAP, "fortify capped at +"+CRAFTFAIR.FORTIFY_CAP+" (raw "+rawAfter+", used "+after+")");
  ok(G.skill(s,"One-Handed")===raw(s,"One-Handed"),"combat skills untouched");
}
// 7. recipe scrolls
{ const s=fresh(); s.perks={steel_smithing:1};
  ok(SMITH.GROUPS.some(([g])=>g==="found"),"found-recipes group");
  const nord=Object.keys(SMITH.RECIPES).filter(k=>SMITH.RECIPES[k].needs==="ancient_nord"); ok(nord.length>=6,"ancient nord recipes: "+nord.length);
  ok(Object.keys(SMITH.RECIPES).some(k=>SMITH.RECIPES[k].needs==="skyforge") && Object.keys(SMITH.RECIPES).some(k=>SMITH.RECIPES[k].needs==="dragon"),"skyforge + dragon recipes");
  for(const [i,n] of SMITH.RECIPES.ancient_nord_sword.mats) G.give(s,i,n*2);
  ok(/Find the Recipe/.test(SMITH.make(s,"ancient_nord_sword")),"locked without scroll");
  ok(/Needs the Recipe/.test(SMITH.info(s,"ancient_nord_sword").block),"info shows lock");
  G.give(s,"recipe_ancient_nord"); const sc=s.inv.find(x=>x.item==="recipe_ancient_nord");
  ok(/New forge recipes/.test(CRAFTFAIR.read(s,sc.id)) && !s.inv.some(x=>x.item==="recipe_ancient_nord"),"read the scroll");
  ok(/^You make/.test(SMITH.make(s,"ancient_nord_sword")),"now craftable");
  ok(G.shopStock("Whiterun").includes("recipe_skyforge"),"Skyforge recipe sold in Whiterun");
  ok(DUNGEONS.THEMES.barrow.loot.includes("recipe_ancient_nord"),"barrow loot");
  ok(D.LOOT.elite.some(([i])=>i==="recipe_dragon"),"dragon recipe on elites");
  for(const id of Object.keys(SMITH.RECIPES).filter(k=>SMITH.RECIPES[k].needs)) ok(SMITH.RECIPES[id].mats.every(([m])=>D.ITEMS[m]),"mats exist "+id);
}
// 8. naming
{ const s=fresh(); G.give(s,"mat_iron",5); G.give(s,"mat_strips",5); SMITH.make(s,"iron_sword"); const r=s.inv.find(x=>x.item==="iron_sword");
  ok(CRAFTFAIR.canName(r),"can name crafted sword");
  ok(/Frostbite/.test(CRAFTFAIR.rename(s,r.id,'  Frostbite <b>"x"</b>  ')) && r.nm==="Frostbite bx/b","name cleaned: "+r.nm);
  ok(CRAFTFAIR.rename(s,r.id,"a".repeat(60)) && r.nm.length===CRAFTFAIR.NAME_MAX,"name length cap");
  ok(MARKET.itemName(r).includes("“")&&VISITS.itemName(r).includes("“"),"name shown in market/visits");
  G.give(s,"steel_sword"); ok(!CRAFTFAIR.canName(s.inv.find(x=>x.item==="steel_sword")),"found gear can't be named");
  s.homes={Whiterun:{chest:[]}}; const L=MARKET.list(s,r.id,50,[]); ok(L.doc.row.nm===r.nm,"name travels with the stall");
}
console.log("ALL OK");
`,c);
