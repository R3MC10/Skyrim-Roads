const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Ingredient gathering: patches by biome and hold, spotting while travelling, picking and regrowth, forage,
// creature parts, dungeon fungi, garden beds, colour-coded effects.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy };
vm.createContext(c);
const files = ["data.js", "world.js", "terrain.js", "formulas.js", "perks.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "smithing.js", "roam.js"];
if (fs.existsSync(W + "solworld.js")) files.push("solworld.js");
for (const f of ["perkfx.js"]) if (fs.existsSync(W + f)) files.splice(files.indexOf("powers.js"), 0, f);
files.push("explore.js", "gather.js", "mp.js");
for (const f of files) vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0;
c.ok = (cond, msg) => { if (!cond) { fails++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
vm.runInContext(`var ICONART = { item: (id) => "<i>" + id + "</i>" };`, c);
vm.runInContext(`
function hero(level=10){ const s=G.newSave("p"+Math.random(),"T","nord"); s.level=level; G.setHealth(s,G.maxHealth(s)); return s; }
const N = GATHER.nodes();
ok(N.length > 300, "lots of patches on the map: " + N.length);
ok(N.every(n => D.ITEMS[n.ing] && TOWNS.INGREDIENT_FX[n.ing]), "every patch grows a real ingredient");
ok(N.every(n => ![0,1,2,3,4,15,17].includes(Terrain.typeAtPos(n.pos))), "no patch in water, on a road, a peak or beyond the border");
const ids = new Set(N.map(n=>n.id)); ok(ids.size === N.length, "patch ids unique");
const N2 = (()=>{ return N.map(n=>n.id+n.ing).join(); })(); ok(GATHER.nodes().map(n=>n.id+n.ing).join() === N2, "same patches every time (deterministic)");
const byHold = (h) => N.filter(n => WORLD.holdAt && WORLD.holdAt(n.pos) === h && !WORLD.isSol(n.pos));
const reach = byHold("The Reach"); ok(reach.some(n=>n.ing==="ing_juniper") && reach.some(n=>n.ing==="ing_canis_root"), "the Reach grows Juniper and Canis Root");
ok(byHold("Hjaalmarch").some(n=>n.ing==="ing_fungal_pod"), "Hjaalmarch marsh has Swamp Fungal Pods");
ok(byHold("Eastmarch").some(n=>["ing_dragons_tongue","ing_jazbay","ing_creep_cluster"].includes(n.ing)), "Eastmarch hot springs plants");
ok(N.some(n=>n.ing==="ing_snowberries"), "snowberries in the snow");
ok(N.some(n=>n.ing==="ing_nirnroot"), "Nirnroot by water");
ok(N.some(n=>/pearl/.test(n.ing)), "pearls on the coast");
const sol = N.filter(n=>WORLD.isSol && WORLD.isSol(n.pos));
if (typeof SOL_W !== "undefined" || sol.length) ok(sol.some(n=>["ing_ash_creep","ing_scathecraw","ing_trama_root","ing_spawn_ash"].includes(n.ing)), "Solstheim ash plants: " + sol.length);
ok(!N.filter(n=>!WORLD.isSol(n.pos)).some(n=>["ing_ash_creep","ing_scathecraw","ing_trama_root"].includes(n.ing)), "no ash plants in Skyrim");

// spotting and picking
{
  const s = hero(); const n = N.find(x=>x.ing==="ing_lavender") || N[0];
  s.x = n.pos[0]; s.y = n.pos[1]; s.location = null;
  const logs=[]; GATHER.onStep(s, (m)=>logs.push(m));
  ok(GATHER.st(s).seen[n.id] && logs.some(l=>/Spotted/.test(l)), "passing a patch spots it");
  ok(GATHER.marks(s).some(m=>m.ripe), "spotted patch shows on the map, ripe");
  ok(/Gather/.test(GATHER.card(s)) && /Forage here/.test(GATHER.card(s)), "travel card offers Gather and Forage");
  const t0 = G.now(); const before = s.inv.filter(r=>r.item===n.ing).reduce((a,r)=>a+r.qty,0);
  const r = GATHER.pick(s, n.id, t0); const after = s.inv.filter(r=>r.item===n.ing).reduce((a,r)=>a+r.qty,0);
  ok(r.ok && after > before && after - before <= 3, "gathering gives 1–3: " + r.text);
  ok(GATHER.pick(s, n.id, t0+10).err, "picked patch can't be picked again right away");
  ok(GATHER.pick(s, n.id, t0 + GATHER.RESPAWN + 1).ok, "it grows back after two in-game days");
  s.x = 0.01; s.y = 0.01; ok(GATHER.pick(s, n.id, t0 + 3*GATHER.RESPAWN).err, "too far away to pick");
}
// Green Thumb doubles
{
  const s = hero(); s.perks = { ...(s.perks||{}), green_thumb: 1 };
  const n = N.find(x=>x.ing!=="ing_nirnroot" && !/pearl/.test(x.ing)); s.x=n.pos[0]; s.y=n.pos[1];
  let ev = true; for (let i=0;i<20;i++){ const r=GATHER.pick(s,n.id,G.now()+i*GATHER.RESPAWN*2); ev = ev && r.ok && r.n % 2 === 0; }
  ok(ev, "Green Thumb: always an even (doubled) amount");
}
// auto-pick while travelling
{
  const s = hero(); const n = N[5]; s.x=n.pos[0]; s.y=n.pos[1]; GATHER.st(s).auto = true;
  const logs=[]; GATHER.onStep(s,(m)=>logs.push(m)); ok(logs.some(l=>/gather/.test(l)) && GATHER.st(s).picked[n.id], "auto-pick gathers as you pass");
}
// forage
{
  const s = hero(); const n = N.find(x=>Terrain.typeAtPos(x.pos)===6) || N[0]; s.x=n.pos[0]; s.y=n.pos[1]; s.location=null;
  const t=G.now(); const r = GATHER.forage(s,t); ok(r.ok, "forage works in the wild: " + r.text);
  ok(GATHER.forage(s,t+10).err, "forage has a cooldown");
  ok(GATHER.forage(s,t+GATHER.FORAGE_COOLDOWN+1).ok, "can forage again later");
  s.location="Whiterun"; const w=WORLD.places.Whiterun; s.x=w[0]; s.y=w[1]; GATHER.st(s).forage=0; ok(GATHER.forage(s).err, "no foraging in a city");
}
// creature parts
{
  const s = hero(); let got=0; for(let i=0;i<40;i++) got += GATHER.creatureParts(s,{name:"Black bear"}).length; ok(got>15 && s.inv.some(r=>r.item==="ing_bear_claws"), "bears drop claws");
  let sp=0; for(let i=0;i<40;i++) sp += GATHER.creatureParts(s,{name:"Frostbite spider"}).length; ok(s.inv.some(r=>r.item==="ing_frostbite_venom"), "spiders drop venom");
  ok(GATHER.creatureParts(s,{name:"Bandit"}).length===0, "bandits drop no parts");
  ok(GATHER.creatureParts(s,{name:"Black bear", fled:true}).length===0, "nothing from a foe that fled");
  const loot = G.rollLoot(s,{name:"Frost troll",tags:["beast"]}); ok(Array.isArray(loot), "rollLoot still works with parts hooked in");
}
// dungeon fungi
{
  const s = hero(30); let saw=0, picked=0;
  for (let k=0;k<40 && !picked;k++){
    const name = Object.keys(WORLD.places).find(n=>DUNGEONS.enterable(n)); s.location=name; s.dungeon=null; s.cleared={};
    const e = DUNGEONS.enter(s, name); if (!s.dungeon) continue;
    for (let i=0;i<10 && s.dungeon;i++){
      const ch = DUNGEONS.nextChoices(s); if(!ch.length) break; DUNGEONS.enterRoom(s, ch[0]);
      const r = s.dungeon.room; if (r && r.herb) { saw++; if (!r.enemy) { const before=s.inv.length; const res = DUNGEONS.act(s,"gatherherb"); if(res.stay && /off the damp stone/.test(res.text)) picked++; } }
      if (s.dungeon) s.dungeon.room = null;
    }
  }
  ok(saw>0 && picked>0, "dungeon rooms sometimes have fungi you can pick: seen " + saw + ", picked " + picked);
}
// garden
{
  const s = hero(); s.location="Whiterun"; s.homes={Whiterun:{chest:[],garden:0}};
  G.give(s,"ing_lavender",2); G.give(s,"ing_snowberries",1); G.give(s,"iron_sword");
  ok(/plant Lavender/.test(GATHER.plant(s,"ing_lavender")), "plant lavender");
  ok(/plant Snowberries/.test(GATHER.plant(s,"ing_snowberries")), "plant snowberries");
  ok(!s.inv.some(r=>r.item==="ing_snowberries"), "planting uses the ingredient");
  ok(/won't grow/.test(GATHER.plant(s,"iron_sword")), "can't plant a sword");
  const m = TOWNS.harvest(s, G.now()+99999); ok(/Lavender ×2/.test(m) && /Snowberries ×2/.test(m), "harvest gives what you planted: " + m);
  ok(/Garden beds \\(2\\/3\\)/.test(GATHER.gardenHTML(s)), "garden panel shows the beds");
  ok(/dig up/.test(GATHER.unplant(s,0)) && GATHER.beds(s).length===1, "clear a bed");
}
// gathering perks (perkfx.js): Forager spots farther and forages more, Wildcrafter regrows faster and finds rare things
if (typeof PFX !== "undefined" && PERKS.BY_ID.forager) {
  const a = hero(), b = hero(); b.perks = { ...(b.perks||{}), alchemist: 1, forager: 1, wildcrafter: 1 };
  const n = N.find(x=>Terrain.typeAtPos(x.pos)===6) || N[0];
  for (const s of [a,b]) { s.x = n.pos[0] + 40/1000; s.y = n.pos[1]; GATHER.onStep(s, ()=>{}); }
  ok(!GATHER.st(a).seen[n.id] && GATHER.st(b).seen[n.id], "Forager spots a patch 40 paces away; without it you miss it");
  b.x=n.pos[0]; b.y=n.pos[1]; const t0=G.now(); GATHER.pick(b,n.id,t0);
  a.x=n.pos[0]; a.y=n.pos[1]; GATHER.pick(a,n.id,t0); ok(GATHER.ripe(b, n, t0 + GATHER.RESPAWN/2 + 5) && !GATHER.ripe(a, n, t0 + GATHER.RESPAWN/2 + 5), "Wildcrafter: regrows in half the time");
  let ca=0, cb=0, rare=0; for (let i=0;i<300;i++){ for (const [s,add] of [[a,(k)=>ca+=k],[b,(k)=>cb+=k]]) { s.x=n.pos[0]; s.y=n.pos[1]; s.location=null; GATHER.st(s).forage=0; const r=GATHER.forage(s, t0+i); const k=Object.values(r.items||{}).reduce((x,y)=>x+y,0); add(k); if (s===b && r.items && (r.items.ing_nirnroot||r.items.ing_pearl||r.items.ing_glowing_mushroom)) rare++; } }
  ok(cb > ca * 1.2, "Forager forages more (" + ca + " vs " + cb + ")");
  ok(rare > 10, "Wildcrafter finds rare ingredients (" + rare + "/300)");
}
// effects colour-coded, notes
{
  const s = hero(); TOWNS.known(s,"ing_deathbell")[0]=true; TOWNS.known(s,"ing_blue_flower")[0]=true;
  ok(/fx-bad">Damage Health/.test(GATHER.fxHTML(s,"ing_deathbell")), "harmful effect is red");
  ok(/fx-good">Restore Health/.test(GATHER.fxHTML(s,"ing_blue_flower")), "helpful effect is green");
  ok(/fx-unk/.test(GATHER.fxHTML(s,"ing_deathbell")), "unknown effects are ?");
  const h = GATHER.notesHTML(s); ok(/Herbalist/.test(h) && /Nirnroot/.test(h) && /caves and barrows/.test(h), "notes list ingredients and where they grow");
  ok(Object.keys(GATHER.NEW_ING).every(id => TOWNS.INGREDIENT_FX[id][1].every(e => TOWNS.EFFECTS[e])), "every new ingredient's effects are known to alchemy");
  // brewing with new ingredients works
  G.give(s,"ing_nirnroot",1); G.give(s,"ing_deathbell",1);
  const ids = s.inv.filter(r=>["ing_nirnroot","ing_deathbell"].includes(r.item)).map(r=>r.id);
  const b = TOWNS.brew(s, ids); ok(b && typeof b.text === "string", "brew with Nirnroot + Deathbell: " + b.text);
}
`, c);
console.log(fails ? `FAILED ${fails}` : "gather ok");
process.exit(fails ? 1 : 0);
