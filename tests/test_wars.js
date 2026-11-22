const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","achievements.js","clans.js","festivals.js","wars.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const C=CLANS.COLORS, w=WARS.week();
const a=G.newSave("A","Alfa","nord"), b=G.newSave("B","Beta","nord"), x=G.newSave("X","Xeno","nord"), z=G.newSave("Z","Zed","nord");
const c1={...CLANS.found(a,"Red","RED",[C[0],C[6]]).clan,id:"A",invites:["B"]}; b.clan="A";
const c2={...CLANS.found(x,"Blue","BLU",[C[1],C[7]]).clan,id:"X"};
CLANS.set([c1,c2],[{id:"A",clan:"A",name:"Alfa"},{id:"B",clan:"A",name:"Beta"},{id:"X",clan:"X",name:"Xeno"},{id:"Z",clan:"A",name:"Zed"}]);
ok(!WARS.add(G.newSave("n","N","nord"),"fight","Whiterun"), "no clan, no points");
// last week: Red wins Whiterun, Blue wins the Rift; a tie in Eastmarch
const rec=(uid,name,week,h)=>({uid,name,week,h});
WARS.setDocs([rec("A","Alfa",w-1,{Whiterun:20,Eastmarch:12}),rec("B","Beta",w-1,{Whiterun:5}),rec("X","Xeno",w-1,{Whiterun:15,"The Rift":30,Eastmarch:12}),rec("Z","Zed",w-1,{"The Rift":999}), rec("A","Alfa",w,{Whiterun:3})], a);
const st=WARS.standings(w-1,a); ok(st.Whiterun[0].clan.tag==="RED" && st.Whiterun[0].pts===25, "Red 25 in Whiterun");
ok(!st["The Rift"].some(x=>x.clan.tag==="RED"), "uninvited Z's points don't count");
const r=WARS.rulers(a); ok(r.Whiterun.tag==="RED" && r["The Rift"].tag==="BLU" && !r.Eastmarch, "rulers: "+Object.entries(r).map(([h,c])=>h+":"+c.tag).join(","));
a.location="Whiterun"; const p1=G.buyPrice(a,"mat_steel"); x.location="Whiterun"; const p2=G.buyPrice(x,"mat_steel"); ok(p1<p2, "Red shops cheaper in Whiterun "+p1+"<"+p2);
// adding points this week
ok(WARS.add(a,"dungeon","Falkreath") && a.war.h.Falkreath===5, "dungeon 5 points");
console.log("wars ok ·", JSON.stringify(Object.fromEntries(Object.entries(r).map(([h,c])=>[h,c.tag]))));
`,c);
