const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Exploration rewards: secrets, uniques, claw doors, lore books, treasure maps.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "smithing.js", "roam.js", "explore.js", "mp.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0;
c.ok = (cond, msg) => { if (!cond) { fails++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
vm.runInContext(`
function hero(level=30){
  const s=G.newSave("p"+Math.random(),"T","nord"); s.level=level; s.hpBonus=(level-1)*6; s.spBonus=(level-1)*4;
  for(const sk of Object.values(s.skills)) sk.lvl=Math.min(100,sk.lvl+(level-1)*2);
  for(const it of ["steel_sword","steel_armor","steel_helmet","steel_boots","steel_gauntlets","steel_shield"]){G.give(s,it); G.equip(s, s.inv[s.inv.length-1].id);}
  for(let i=0;i<12;i++) G.give(s,"potion_health");
  G.setHealth(s,G.maxHealth(s)); return s;
}
// ---- secrets
{
  const s=hero(5); const logs=[]; const log=(_,t)=>logs.push(t);
  const r=EXPLORE.onDiscover(s,"Riverwood Folly",log); const g0=s.gold;
  ok(r && /satchel/.test(r.text) && s.explore.secrets["Riverwood Folly"], "auto secret found on discovery");
  ok(s.inv.some(x=>x.item==="map_tm1"), "the cache holds a treasure map");
  ok(EXPLORE.onDiscover(s,"Riverwood Folly",log)===null, "only once");
  const r2=EXPLORE.onDiscover(s,"Embershard Mine",log);
  ok(r2===null && /search the area/.test(logs[logs.length-1]), "hidden secret: a hint on discovery");
  s.location="Embershard Mine"; s.x=0.95; s.y=0.95; s.skills.Sneak.lvl=5;
  const b=EXPLORE.search(s); ok(b.blocked && /Sneak 20/.test(b.text), "search blocked without the skill");
  ok(/Something/.test(EXPLORE.placeCard(s)), "travel card offers a search");
  s.skills.Sneak.lvl=25; const gb=s.gold; const r3=EXPLORE.search(s);
  ok(r3.got && s.gold>gb && s.explore.lore.includes("l_smith"), "search with the skill: gold and a lore book");
  ok(EXPLORE.search(s).none, "searching again finds nothing");
  ok(EXPLORE.placeCard(s)==="", "no card once found");
  s.location="Whiterun"; ok(EXPLORE.search(s).none, "plain places have nothing hidden");
}
// ---- lore
{
  const s=hero(5); const seen=new Set(); let b; while((b=EXPLORE.randomLore(s))) { ok(!seen.has(b.id),"no duplicate "+b.id); seen.add(b.id); }
  ok(seen.size===EXPLORE.LORE.length && EXPLORE.randomLore(s)===null, "all books collectable, then none left");
  const html=EXPLORE.panel(s); ok(html.includes("Library") && html.includes(EXPLORE.LORE.length+"/"+EXPLORE.LORE.length), "library panel shows counts");
  ok(EXPLORE.act(s,"xread","l_mead").html.includes("Mead-Hall"), "reading a book");
  for(const [id,t,tx] of EXPLORE.LORE) ok(tx.split(/\\s+/).length<70, "lore text short: "+id);
}
// ---- treasure maps
{
  const s=hero(5); G.give(s,"map_tm3");
  const m=EXPLORE.marks(s); ok(m.length===1 && m[0].id==="tm3" && m[0].pos, "carrying a map marks the X");
  ok(Terrain.SPEED[Terrain.typeAtPos(m[0].pos)]>0, "the X is on walkable ground");
  s.x=0.9; s.y=0.9; ok(EXPLORE.digHere(s)===null && EXPLORE.dig(s,"tm3").err, "can't dig far away");
  [s.x,s.y]=m[0].pos; ok(EXPLORE.digHere(s)==="tm3" && /Dig here/.test(EXPLORE.placeCard(s)), "dig card at the spot");
  const g0=s.gold; const r=EXPLORE.dig(s); ok(r.got && s.gold>g0 && !s.inv.some(x=>x.item==="map_tm3") && s.explore.dug.tm3, "digging gives the chest and uses the map");
  ok(EXPLORE.marks(s).length===0 && EXPLORE.dig(s,"tm3").err, "a dug map is gone");
  ok(EXPLORE.freshMap(s)!=="tm3", "fresh maps skip dug ones");
  G.give(s,"map_tm3"); ok(EXPLORE.marks(s).length===0, "a second copy of a dug map marks nothing");
  for(const mm of EXPLORE.MAPS){ const p=EXPLORE.mapPos(mm[0]); ok(p && Terrain.SPEED[Terrain.typeAtPos(p)]>0, "map spot on land: "+mm[0]); }
}
// ---- claw door + unique on first clear
function runTo(s, place, pickFn, pre){
  s.location=place; [s.x,s.y]=WORLD.places[place]; s.cleared={};
  const e=DUNGEONS.enter(s); if(e) return {err:e};
  if(pre) pre(s);
  let guard=0, sawClaw=false, notes=[];
  while(s.dungeon && guard++<80){
    const d=s.dungeon;
    if(!d.room){ if(d.done){ DUNGEONS.leave(s); return {cleared:true,sawClaw,notes}; } const ch=DUNGEONS.nextChoices(s); DUNGEONS.enterRoom(s,ch[0]); continue; }
    const chs=DUNGEONS.roomChoices(s).map(x=>x[0]);
    if(d.room.x==="claw"){ sawClaw=true; const r=pickFn? pickFn(s,chs): DUNGEONS.act(s,chs.find(c=>c.startsWith("set:"))); notes.push(r.text); continue; }
    if(G.curHealth(s)<G.maxHealth(s)*0.5 && chs.includes("potion")){ DUNGEONS.act(s,"potion"); continue; }
    const pref=["fight","pick","open","rest","read","pray","loot","skip"].find(c=>chs.includes(c)) || chs.find(c=>c.startsWith("set:")) || chs[0];
    if(d.room.type==="treasure"){ s._lockForce=true; }
    const r=DUNGEONS.act(s,pref); if(r.text) notes.push(r.text);
    if(r.died) return {died:true,notes};
  }
  return {stuck:true, notes};
}
{
  const s=hero(14); s.hpBonus=4000; G.setHealth(s,G.maxHealth(s));
  const r=runTo(s,"Bleak Falls Barrow");
  ok(r.cleared, "Bleak Falls Barrow cleared ("+JSON.stringify(Object.keys(r))+")"); if(!r.cleared) console.log(r.notes.slice(-4));
  ok(r.sawClaw, "the claw door stood before the boss");
  ok(s.inv.some(x=>x.item==="golden_claw"), "found the Golden Claw inside");
  ok(r.notes.some(n=>/Bear, Moth, Owl/.test(n)), "the claw shows Bear, Moth, Owl");
  ok(s.inv.some(x=>x.item==="u_bleakfalls_helm") && s.explore.uniques["Bleak Falls Barrow"], "unique helm on first clear");
  const n1=s.inv.filter(x=>x.item==="u_bleakfalls_helm").length;
  const r2=runTo(s,"Bleak Falls Barrow"); ok(r2.cleared && s.inv.filter(x=>x.item==="u_bleakfalls_helm").length===n1, "no second unique");
  ok(s.inv.filter(x=>x.item==="golden_claw").length===1, "only one claw");
}
{ // wrong combination hurts, then the right one opens
  const s=hero(14); s.hpBonus=4000; G.setHealth(s,G.maxHealth(s));
  let tried=false;
  const r=runTo(s,"Folgunthur",(s2,chs)=>{
    if(!tried){ tried=true; const hp=G.curHealth(s2); const x=DUNGEONS.act(s2,"set:Fox-Fox-Fox"); ok(G.curHealth(s2)<hp && s2.dungeon.room.x==="claw" && /Darts/.test(x.text), "wrong rings: darts, door stays"); return x; }
    const g=DUNGEONS.act(s2,"game:claw"); ok(g.stay && s2.dungeon.room.x==="claw", "game choice leaves the room for the mini-game");
    const x=DUNGEONS.act(s2,"set:Hawk-Hawk-Dragon"); ok(s2.dungeon.room.type==="boss", "right rings open onto the boss"); return x;
  });
  ok(r.cleared && tried, "Folgunthur cleared after the door");
  ok(s.inv.some(x=>x.item==="claw_ivory") && s.inv.some(x=>x.item==="u_folgunthur_helm"), "Ivory Claw and the Folgunthur unique");
}
{ // rings include the answer, choices offer the claw only when you hold it
  for(const [p,cl] of Object.entries(EXPLORE.CLAWS)){ const rings=EXPLORE.ringsFor(cl.combo); ok(rings.every((r,i)=>r.includes(cl.combo[i]) && r.length===6), "rings hold the answer: "+p); ok(D.ITEMS[cl.item], "claw item exists: "+p); }
  for(const [p,id] of Object.entries(EXPLORE.UNIQUE_AT)) ok(D.ITEMS[id] && WORLD.places[p] && DUNGEONS.enterable(p), "unique place enterable: "+p);
}
{ // many runs through claw barrows: no stuck runs or crashes
  let stuck=0, err=0, n=0;
  for(const p of Object.keys(EXPLORE.CLAWS).concat(["Mzulft","Labyrinthian","Embershard Mine"])) for(let k=0;k<12;k++){
    const s=hero(14); s.hpBonus=4000; G.setHealth(s,G.maxHealth(s));
    try{ const r=runTo(s,p); n++; if(r.stuck) stuck++; } catch(e){ err++; console.log(p, e.stack.split("\\n").slice(0,3).join(" | ")); }
  }
  ok(stuck===0 && err===0, "runs: "+n+" stuck "+stuck+" errors "+err);
}
{ // pillar puzzles get the mini-game choice; set: answers still work
  const s=hero(40); s.location="Saarthal"; [s.x,s.y]=WORLD.places.Saarthal; DUNGEONS.enter(s);
  s.dungeon.room={type:"puzzle", order:"Eagle-Snake-Whale", options:["Eagle-Snake-Whale","Snake-Eagle-Whale","Whale-Snake-Eagle"], text:"x"};
  const chs=DUNGEONS.roomChoices(s).map(x=>x[0]); ok(chs.includes("game:pillars") && chs[chs.length-1]==="skip", "pillar puzzle offers the mini-game");
  const g0=s.gold; DUNGEONS.act(s,"set:Eagle-Snake-Whale"); ok(s.gold>g0 && !s.dungeon.room, "pillar answer still opens the chamber");
}
{ // counts
  const s=hero(5); const c=EXPLORE.counts(s); ok(c.secrets[1]>=20 && c.uniques[1]>=20 && c.lore[1]>=16 && c.maps[1]===8, "counts: "+JSON.stringify(c));
}
{
  // no claw by the time you reach the door (sold it, lost it, skipped the room): the door still gives you the answer
  const s=hero(14); s.hpBonus=4000; G.setHealth(s,G.maxHealth(s));
  let doorText="";
  const r=runTo(s,"Bleak Falls Barrow",(s2,chs)=>{ doorText=doorText||s2.dungeon.room.text; ok(chs.some(c=>c==="set:Bear-Moth-Owl"), "without the claw beforehand, the door still offers the answer"); return DUNGEONS.act(s2,"set:Bear-Moth-Owl"); }, (s2)=>{ s2.dungeon.gotClaw=true; });
  ok(r.cleared, "cleared Bleak Falls without finding the claw early");
  ok(/clutching the Golden Claw/.test(doorText) && /Bear, Moth, Owl/.test(doorText), "the door room hands over the claw and its animals: "+doorText.slice(-140));
  ok(s.inv.filter(x=>x.item==="golden_claw").length===1, "exactly one claw");
}
`, c);
console.log(fails ? `${fails} FAILED` : "ALL OK");
process.exit(fails ? 1 : 0);
