const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");const W=__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","mp.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
let fails=0; const bad=(m)=>{fails++; console.log("BAD", m);};
const P=Object.entries(WORLD.places), T=Terrain.T;
console.log("places", P.length, "hidden", WORLD.hidden.size);
const names=P.map(([n])=>n); if(new Set(names).size!==names.length) bad("dup names");
for (const [n,[x,y,k]] of P) {
  if (!(x>0.02&&x<0.98&&y>0.02&&y<0.98)) bad("out of bounds "+n);
  const t=Terrain.typeAtPos([x,y]); if (t===T.SEA||t===T.LAKE) bad("in water "+n+" "+Terrain.NAMES[t]); const raw=Terrain.typeAt([x*1000,y*700]); if ((raw===T.SEA||raw===T.LAKE) && WORLD.hidden.has(n)) bad("new place sits in water "+n);
  if (["dungeon","fort","camp","lair"].includes(k) && !DUNGEONS.enterable(n)) bad("not enterable "+n);
  if (DUNGEONS.enterable(n)) { const i=DUNGEONS.info(n); if(!i.theme || (!["giantcamp","lair"].includes(i.theme) && !DUNGEONS.THEMES[i.theme])) bad("no theme "+n+" "+JSON.stringify(i)); }
}
// spacing
const close=[]; for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++){ const d=G.pxDist(P[i][1],P[j][1]); if(d<18) close.push(P[i][0]+" ~ "+P[j][0]+" "+d.toFixed(0)); }
if(close.length) console.log("very close:", close.join(" | "));
// stones
const stones=P.filter(([,p])=>p[2]==="stone").map(([n])=>n); for (const n of Object.keys(POWERS.STONE_AT)) if(!WORLD.places[n]) bad("stone missing "+n);
console.log("stone places", stones.length, "stone powers", Object.values(POWERS.STONE_AT).flat().length);
// reachability: flood fill on grid from Whiterun over walkable cells
const GW=Terrain.GW, GH=Terrain.GH, g=Terrain.grid, seen=new Uint8Array(GW*GH);
const cell=([x,y])=>Math.floor(y*GH)*GW+Math.floor(x*GW);
const q=[cell(WORLD.places.Whiterun)]; seen[q[0]]=1;
while(q.length){ const i=q.pop(), x=i%GW, y=(i/GW)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=GW||ny>=GH) continue; const j=ny*GW+nx; if(seen[j]||!Terrain.SPEED[g[j]]) continue; seen[j]=1; q.push(j);} }
for (const [n,p] of P) if(!seen[cell(p)]) bad("unreachable "+n);
// sample routes
const hid=[...WORLD.hidden]; let tot=0; const t0=Date.now();
for (let k=0;k<40;k++){ const n=hid[(k*7)%hid.length]; const r=Terrain.route(WORLD.places.Whiterun, WORLD.places[n]); if(r.length<2) bad("route "+n); tot+=r.length; }
console.log("40 routes in", Date.now()-t0, "ms");
const kinds={}; for(const n of WORLD.hidden) kinds[WORLD.places[n][2]]=(kinds[WORLD.places[n][2]]||0)+1; console.log("new by kind", JSON.stringify(kinds));
console.log(fails? "FAIL "+fails : "loc world ok");
`,c);
