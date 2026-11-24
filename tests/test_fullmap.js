const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Something at every place (placestuff.js): no map location may offer nothing, and every offer works, refreshes and stays small.
const fs = require("fs"), vm = require("vm");
const W = process.env.W || __GAME + "";
const c = { console, Math, Date, JSON, Float64Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Int16Array, Object, Array, Set, Map, Proxy };
vm.createContext(c);
for (const f of ["data.js", "world.js", "terrain.js", "solworld.js", "formulas.js", "perks.js", "perkfx.js", "powers.js", "engine.js", "events.js", "dungeons.js", "towns.js", "wevents.js", "enchanting.js", "quests.js", "smithing.js", "roam.js", "cooking.js", "explore.js", "gather.js", "solstheim.js", "placestuff.js", "mp.js"])
  vm.runInContext(fs.readFileSync(W + f, "utf8").replace(/^const (\w+) =/m, "var $1 ="), c);
let fails = 0;
c.ok = (cond, msg) => { if (!cond) { fails++; console.log("FAIL", msg); } else console.log("ok  ", msg); };
vm.runInContext(`
function hero(level=20){ const s=G.newSave("p"+Math.random(),"T","nord"); s.level=level; G.setHealth(s,G.maxHealth(s)); return s; }
function put(s,n){ s.location=n; s.trip=null; s.dungeon=null; const p=WORLD.places[n]; s.x=p[0]; s.y=p[1]; if(!s.discovered.includes(n)) s.discovered.push(n); }
// ---- every place offers something
{
  const empty=[];
  for (const n of Object.keys(WORLD.places)) {
    const other = TOWNS.isTown(n) || G.shopTypes(n).length || DUNGEONS.enterable(n) || POWERS.STONE_AT[n] || SMITH.MINES[n] || n==="High Hrothgar";
    if (!other && !PLACESTUFF.offers(n).length) empty.push(n);
  }
  ok(empty.length===0, "no empty places on the map ("+Object.keys(WORLD.places).length+" places)" + (empty.length ? ": "+empty.join(", ") : ""));
  ok(Object.keys(PLACESTUFF.OFFERS).every((n)=>WORLD.places[n]), "every hand-picked offer is a real place");
  // a brand-new place of any kind is covered too
  WORLD.places["Test Hut"]=[0.5,0.5,"landmark"]; WORLD.places["Test Farm"]=[0.5,0.5,"farm"];
  ok(PLACESTUFF.offers("Test Hut").includes("search") && PLACESTUFF.offers("Test Farm").includes("chores"), "new places get an offer by their kind");
  delete WORLD.places["Test Hut"]; delete WORLD.places["Test Farm"];
  ok(PLACESTUFF.offers("Whiterun").length===0 && PLACESTUFF.offers("Bleak Falls Barrow").length===0, "towns and dungeons keep what they had");
}
// ---- all items used exist
{
  const ids=[...Object.values(PLACESTUFF.STALLS), ...Object.values(PLACESTUFF.GROVES)].flat().map((x)=>x[0]);
  const bad=ids.filter((i)=>!D.ITEMS[i]);
  ok(bad.length===0, "every stall and herb item exists" + (bad.length ? ": "+bad.join(", ") : ""));
  ok(SMITH.MINES["Raven Rock Mine"], "Raven Rock Mine has ore veins");
}
// ---- chores: small pay, once a day
{
  const s=hero(20); put(s,"Loreius Farm"); const g0=s.gold, t=G.now();
  const r=PLACESTUFF.chores(s,"Loreius Farm",t);
  ok(r.text && s.gold>g0 && s.gold-g0<=40, "chores pay a little ("+(s.gold-g0)+" gold)");
  ok(PLACESTUFF.chores(s,"Loreius Farm",t+60).err, "only once a day");
  ok(!PLACESTUFF.chores(s,"Loreius Farm",t+PLACESTUFF.DAY+1).err, "work again the next day");
  const s2=hero(80); put(s2,"Half-Moon Mill"); const a=s2.gold; PLACESTUFF.chores(s2); ok(s2.gold-a<=40 && s2.inv.some((x)=>x.item==="mat_firewood"), "a mill pays in firewood too, capped at 40 gold even at level 80");
  put(s,"Whiterun"); ok(PLACESTUFF.chores(s).err, "no chores in a city through this");
}
// ---- blessings
{
  const s=hero(10); put(s,"Shrine of Talos"); G.setHealth(s,5); const t=G.now();
  const mh0=G.maxHealth(s);
  const r=PLACESTUFF.bless(s,"Shrine of Talos",t);
  ok(r.text && G.curHealth(s)===G.maxHealth(s), "praying heals you");
  ok(G.maxHealth(s)===mh0+25, "Blessing of Talos: +25 health");
  ok(PLACESTUFF.bless(s,"Shrine of Talos",t+10).err, "once a day per shrine");
  put(s,"Shrine of Azura"); PLACESTUFF.bless(s,"Shrine of Azura",t+20);
  ok(s.fx.filter((f)=>f.src==="shrine").length===1 && s.fx.some((f)=>f.key==="regen:magicka"), "one blessing at a time: Azura replaces Talos");
  const until=s.fx.find((f)=>f.src==="shrine").until;
  ok(Math.abs(until-(t+20+PLACESTUFF.DAY))<2, "a blessing lasts a day");
  s.perks=s.perks||{}; s.perks.novice_restoration=1; s.perks.pilgrim=1; s.skills.Restoration.lvl=40;
  put(s,"Statue to Meridia"); PLACESTUFF.bless(s,"Statue to Meridia",t+30);
  ok(PERKS.BY_ID.pilgrim && s.fx.find((f)=>f.src==="shrine").until>=t+30+2*PLACESTUFF.DAY-2, "Pilgrim perk: two days");
  put(s,"Earth Stone"); const r2=PLACESTUFF.bless(s,"Earth Stone",t+40);
  ok(r2.text && /black stone/.test(r2.text) && s.fx.find((f)=>f.src==="shrine").mag===15, "a caged All-Maker Stone gives half");
}
// ---- hidden stash
{
  const s=hero(20); put(s,"Lund's Hut"); const t=G.now(), g0=s.gold;
  const f=PLACESTUFF.stash(s,"Lund's Hut",false,t);
  ok(f.fail && PLACESTUFF.left(s,"Lund's Hut","stash",t+60)>0, "snapped picks: wait a while");
  ok(PLACESTUFF.left(s,"Lund's Hut","stash",t+3*3600)===0, "and try again later");
  const r=PLACESTUFF.stash(s,"Lund's Hut",true,t+3*3600);
  ok(r.got && s.gold>g0 && s.gold-g0<200, "opened: some gold ("+(s.gold-g0)+")");
  ok(PLACESTUFF.left(s,"Lund's Hut","stash",t+3*3600)>2.9*PLACESTUFF.DAY, "refills in three days");
  s.perks=s.perks||{}; s.perks.wayfarers_nose=1;
  ok(PLACESTUFF.left(s,"Lund's Hut","stash",t+3*3600)<=2*PLACESTUFF.DAY, "Wayfarer's Nose: a day sooner");
  // average gold over many openings
  let tot=0; const n=200; for(let i=0;i<n;i++){ const x=hero(30); put(x,"Black-Briar Lodge"); const a=x.gold; PLACESTUFF.stash(x,"Black-Briar Lodge",true); tot+=x.gold-a; }
  ok(tot/n>40 && tot/n<150, "an Expert stash averages "+Math.round(tot/n)+" gold: worth it, not a fountain");
  const q=hero(1); put(q,"Meeko's Shack"); let opened=0; for(let i=0;i<50;i++){ delete q.pstuff; if(PLACESTUFF.stash(q,"Meeko's Shack").got) opened++; }
  ok(opened>20, "a Novice lock opens most of the time with the quick roll ("+opened+"/50)");
}
// ---- search and herbs
{
  const s=hero(20); put(s,"Kjenstag Ruins"); const t=G.now(), g0=s.gold;
  const r=PLACESTUFF.search(s,"Kjenstag Ruins",t);
  ok(r.got && s.gold>g0 && s.gold-g0<=45, "searching finds a few coins and something else");
  ok(PLACESTUFF.search(s,"Kjenstag Ruins",t+PLACESTUFF.DAY).err && !PLACESTUFF.search(s,"Kjenstag Ruins",t+3*PLACESTUFF.DAY+1).err, "search refreshes every three days");
  put(s,"Eldergleam Sanctuary"); const n0=s.inv.length;
  const g=PLACESTUFF.grove(s,"Eldergleam Sanctuary",t);
  ok(g.got && g.got.length>=3, "herbs: "+g.got.join(", "));
  ok(PLACESTUFF.grove(s,"Eldergleam Sanctuary",t+PLACESTUFF.DAY).err && !PLACESTUFF.grove(s,"Eldergleam Sanctuary",t+2*PLACESTUFF.DAY+1).err, "herbs grow back in two days");
  put(s,"Brodir Grove"); ok(PLACESTUFF.grove(s).got.every((x)=>/Ash|Scathecraw|Trama|Spawn/i.test(x)), "Solstheim groves grow ash plants");
}
// ---- stalls
{
  const s=hero(20); s.gold=1000; put(s,"Sarethi Farm"); const t=G.now();
  const st=PLACESTUFF.stock(s,"Sarethi Farm",t);
  ok(st.some((x)=>x.id==="ing_jazbay"), "Sarethi Farm sells Jazbay Grapes");
  const row=st[0]; let bought=0; while(!PLACESTUFF.buy(s,row.id,"Sarethi Farm",t).err) bought++;
  ok(bought===row.left && PLACESTUFF.buy(s,row.id,"Sarethi Farm",t).err.includes("Sold out"), "stock runs out ("+bought+")");
  ok(PLACESTUFF.stock(s,"Sarethi Farm",t+PLACESTUFF.DAY).find((x)=>x.id===row.id).left>0, "fresh stock the next day");
  ok(row.price>=G.buyPrice(s,row.id,null), "stall prices are no cheaper than a shop");
  s.gold=0; ok(PLACESTUFF.buy(s,st[1].id,"Sarethi Farm",t).err, "no gold, no sale");
}
// ---- local jobs go through the town job list
{
  const s=hero(20); put(s,"Loreius Farm"); const t=G.now();
  const j=PLACESTUFF.jobOffer(s,"Loreius Farm",t);
  ok(j && j.type==="clear" && DUNGEONS.enterable(j.target) && j.reward<300, "a farmer's job: clear "+(j&&j.target)+" for "+(j&&j.reward));
  const r=PLACESTUFF.takeJob(s,"Loreius Farm",t);
  ok(r.text && s.jobs.length===1 && !PLACESTUFF.jobOffer(s,"Loreius Farm",t), "job taken, no second one today");
  s.cleared=s.cleared||{}; s.cleared[j.target]=t+100; const g0=s.gold;
  TOWNS.checkJobs(s); ok(s.gold===g0+j.reward && !s.jobs.length, "clearing it pays through the usual job check");
  ok(!PLACESTUFF.jobOffer(s,"Loreius Farm",t), "done jobs don't come back the same day");
  put(s,"Night Gate Inn"); const d=PLACESTUFF.jobOffer(s,"Night Gate Inn",t); ok(d && d.type==="deliver" && TOWNS.isTown(d.target), "the inn sends a parcel to "+(d&&d.target));
}
// ---- the card
{
  const s=hero(20);
  for (const n of ["Loreius Farm","Shrine of Talos","Lund's Hut","Kjenstag Ruins","Eldergleam Sanctuary","Night Gate Inn","Earth Stone"]) { put(s,n); const h=PLACESTUFF.card(s); ok(/What's here/.test(h) && /data-act="pstuff"/.test(h), "card at "+n); }
  put(s,"Whiterun"); ok(PLACESTUFF.card(s)==="", "no card in towns");
  put(s,"Lund's Hut"); s.trip={status:"travel"}; ok(PLACESTUFF.card(s)==="", "no card while travelling");
  ok(/Stash|Search|Stall/.test(PLACESTUFF.tag("Black-Briar Lodge")), "travel list tag: "+PLACESTUFF.tag("Black-Briar Lodge"));
}
`, c);
console.log(fails ? `\n${fails} FAILED` : "\nall ok");
process.exit(fails ? 1 : 0);
