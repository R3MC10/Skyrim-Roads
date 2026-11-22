const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const A=G.newSave("A","Alfa","nord"), B=G.newSave("B","Beta","khajiit");
for(const s of [A,B]){ s.location="Whiterun"; [s.x,s.y]=WORLD.places.Whiterun; s.gold=300; }
const card=(s)=>({id:s.id,name:s.name,level:s.level,race:s.race,x:s.x,y:s.y,...MP.stats(s)});
console.log(JSON.stringify(card(B)));
console.log(MP.canTarget(A,card(B),[A.x,A.y],[B.x,B.y]));
let wins=0; for(let i=0;i<200;i++){ const a=G.clone(A); const r=MP.attack(a,card(B)); if(r.won) wins++; } console.log("A beats B", wins, "/200");
const r=MP.attack(A,card(B)); console.log(r.text, JSON.stringify(r.doc), JSON.stringify(A.bounty));
const got=MP.receive(B,{...r.doc}); console.log(got.text, got.bag && got.bag.killerId);
{ const X=G.newSave("X","Xen","nord"), T={...card(B),gold:300}; const n0=1e12; const p1=MP.pickpocket(X,T,0,n0), p2=MP.pickpocket(X,T,0,n0+60000), p3=MP.pickpocket(X,{...T,id:"Z"},0,n0+60000), p4=MP.pickpocket(X,T,0,n0+601000); if(p1.wait||!p2.wait||p3.wait||p4.wait) throw new Error("pickpocket cooldown"); console.log("pickpocket cooldown ok", p2.text); }
const p=MP.pickpocket(A,{...card(B),gold:300}); console.log(p.text, JSON.stringify(p.doc)); if(p.doc){ const g=MP.receive(B,p.doc); console.log(g&&g.text, B.gold); }
// party speed and chest shares
const pt={members:[{id:"A"},{id:"B"}]}; console.log(MP.partySpeed(A,pt,[{id:"B",speed:5}]));
const chest={members:[{id:"A"},{id:"B"},{id:"C"}],gold0:300,items0:["a","b","c","d"]}; console.log(JSON.stringify(MP.shareOf(chest,"B")));
// allies in dungeon fights
G.setAllyProvider(()=>[{name:"Beta",dmg:8}]); const s=G.newSave("Z","Z","nord"); s.location="Bleak Falls Barrow"; [s.x,s.y]=WORLD.places["Bleak Falls Barrow"];
DUNGEONS.enter(s); let guard=0; while(s.dungeon && !s.dungeon.done && guard++<60){ if(!s.dungeon.room){ DUNGEONS.enterRoom(s,DUNGEONS.nextChoices(s)[0]); continue;} const ch=DUNGEONS.roomChoices(s)[0][0]; const rr=DUNGEONS.act(s,ch==="potion"?"fight":ch); if(rr.partyChest) console.log("party chest", JSON.stringify(rr.partyChest)); if(rr.died){console.log("died");break;} }
`,c);
