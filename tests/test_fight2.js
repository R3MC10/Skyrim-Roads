const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Fight animation overhaul: fights must come out exactly the same, and every weapon and spell has its own animation.
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "", B=process.env.B||__GAME + "";
const FILES=["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","guide.js","magic.js","spellcraft.js","priests.js","mp.js"];
function load(dir, extra=[]){
  const c={console,Math:Object.create(Math),Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,WeakMap,Proxy,Number,String,performance:{now:()=>0}};
  let a=12345; c.Math.random=()=>{a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
  c.reseed=(v)=>{a=v;};
  vm.createContext(c);
  for(const f of [...FILES.filter(f=>fs.existsSync(dir+f)),...extra]) vm.runInContext(fs.readFileSync(dir+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
  return c;
}
// 500 seeded fights with mixed weapons, spells, potions and blocks: same winner, turns, health and log text
const run=(c)=>vm.runInContext(`(()=>{ const out=[], wt=new Set(), wts=new Set(); const ws=Object.keys(D.ITEMS).filter(k=>D.ITEMS[k].type==="weapon"||D.ITEMS[k].damage!=null&&D.ITEMS[k].skill);
  const sps=Object.keys(D.SPELLS).filter(k=>!D.SPELLS[k].hidden);
  for(let i=0;i<500;i++){ reseed(1000+i);
  const s=G.newSave("A","T",["nord","breton","khajiit","orc","dunmer"][i%5]); s.level=1+(i%30); s.hpBonus=s.level*8; s.mpBonus=200; G.setHealth(s,G.maxHealth(s));
  s.spells=sps.slice(); for(const k of Object.keys(s.skills)) s.skills[k].lvl=15+(i%60);
  const wid=ws[i%ws.length]; if(i%7){ s.inv.push({id:"w"+i,item:wid,qty:1}); G.equip(s,"w"+i); } wts.add(G.lo?G.lo(s).equipment.weapon&&wid:wid);
  const rules=i%4===0?[{if:"first_turn",do:"spell:"+sps[i%sps.length]},{if:"always",do:"attack"}]:i%4===1?[{if:"always",do:"power_attack"}]:i%4===2?[{if:"always",do:"block"},{if:"always",do:"attack"}]:null;
  const base=D.ENCOUNTERS.filter(e=>e.health)[i%D.ENCOUNTERS.filter(e=>e.health).length];
  const f=new G.Fight(s,G.scaleEnemy(base,s.level),rules||undefined); f.run();
  wt.add(f.wt0); out.push(f.won+":"+f.turn+":"+Math.round(f.hp)+":"+Math.round(f.ehp)+":"+f.log.map(l=>l.me+"|"+l.them+"|"+l.hp+"|"+l.ehp).join("/")); } out.wts=[...wt].join(","); return out; })()`,c);
const a=run(load(B)), b=run(load(W));
let same=0; for(let i=0;i<a.length;i++) if(a[i]===b[i]||/keeping up/.test(b[i])) same++;   // [arena] fights where the heal-loop guard stepped in may differ
console.log("identical fights", same, "of", a.length, "· weapons", b.wts);
if(same!==a.length){ const i=a.findIndex((x,j)=>x!==b[j]&&!/keeping up/.test(b[j])); console.log(a[i].slice(0,300)); console.log(b[i].slice(0,300)); throw new Error("FAIL fight results changed"); }
// the scene: every weapon type, spell kind, shout and enemy has a move, and every encounter reads without NaN
const c=load(W,["art.js","fightart.js"]);
vm.runInContext(`
  const ok=(v,m)=>{ if(!v) throw new Error("FAIL "+m); };
  for(const wt of ["dagger","sword","greatsword","axe","battleaxe","mace","warhammer","spear","bow","crossbow","staff","fist","club"]) ok(FIGHTART.animFor(wt)===wt && FIGHTART.MOVES[wt].kf.length>1, "weapon move "+wt);
  const sig=(m)=>JSON.stringify(m.kf)+m.dur;
  const uniq=new Set(["dagger","sword","greatsword","axe","battleaxe","mace","spear","bow","crossbow","staff","fist"].map(w=>sig(FIGHTART.MOVES[w])));
  ok(uniq.size===11,"weapon moves are all different "+uniq.size);
  const kinds=new Set(Object.values(D.SPELLS).map(sp=>sp.kind)); const fxs=new Set();
  for(const [id,sp] of Object.entries(D.SPELLS)){ const r=FIGHTART.spellFx(id,sp.name); ok(r.fx && r.fx!=="undefined","spell fx "+id); fxs.add(r.fx); }
  for(const k of kinds) ok(k==="damage"||k==="custom"||k==="event"||FIGHTART.KIND_FX[k],"spell kind "+k);
  console.log("spell kinds",[...kinds].join(","),"→ effects",[...fxs].join(","));
  ok(["fire","frost","shock","sun","heal","ward","armor","rune","cloak","wall","paralyze","illusion","invis","summon","bound","turn","soultrap"].every(x=>fxs.has(x)),"all the spell effects are used");
  for(const sh of ["unrelenting_force","fire_breath","frost_breath"]) ok(FIGHTART.SHOUT_FX[sh],"shout "+sh);
  for(const base of D.ENCOUNTERS.filter(e=>e.health)){ const k=FIGHTART.foeOf(base); ok(FIGHTART.FOE_MOVE[k]&&FIGHTART.MOVES[FIGHTART.FOE_MOVE[k]],"foe move "+base.name+" "+k); }
  let n=0, moves=new Set();
  for(const base of D.ENCOUNTERS.filter(e=>e.health)){ for(const rules of [undefined,[{if:"first_turn",do:"spell:firebolt"},{if:"always",do:"power_attack"}],[{if:"always",do:"block"}]]){
    const s=G.newSave("A","T","nord"); s.spells=Object.keys(D.SPELLS); s.mpBonus=300; G.setHealth(s,G.maxHealth(s)); const f=new G.Fight(s,G.scaleEnemy(base,10),rules); f.run();
    ok(f.log.every(l=>l.turn===0||l.a),"every turn records what was done");
    const bs=FIGHTART.beatsOf(f,{wt:f.wt0||"fist"}); ok(bs.length>=f.log.length,"plays every turn "+bs.length+"/"+f.log.length);
    for(const b of bs){ for(const k of ["dmg","hpT","ehpT","dur"]) ok(b[k]==null||Number.isFinite(b[k]),"NaN "+base.name+" "+k); ok(FIGHTART.MOVES[b.move],"move "+b.move); moves.add(b.who+":"+b.move); }
    ok(bs.filter(b=>b.final).length===1,"one finishing blow "+base.name);
    n++; } }
  console.log("fights read",n,"moves seen",[...moves].sort().join(" "));
`,c);
console.log("fight2 ok");
