const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","achievements.js","clans.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const a=G.newSave("A","Alfa","nord"), b=G.newSave("B","Beta","nord"), x=G.newSave("X","Xeno","nord");
const C=CLANS.COLORS;
ok(CLANS.found(a,"Ab","NO",[C[0],C[1]]).err, "short name");
ok(CLANS.found(a,"Sons","N",[C[0],C[1]]).err, "short tag");
ok(CLANS.found(a,"Sons","NORD",[C[0],"#ff00ff"]).err, "bad colour");
let r=CLANS.found(a,"Sons of <Skyrim>","no!rd",[C[0],C[6]]); ok(r.clan && r.clan.tag==="NORD" && r.clan.name==="Sons of Skyrim", "found "+JSON.stringify(r.clan));
let clan={...r.clan,id:"A"}; CLANS.set([clan],[{id:"A",clan:"A",name:"Alfa"}]);
ok(CLANS.of("A",a).tag==="NORD", "founder is in");
// X just claims membership without an invite
CLANS.set(null,[{id:"A",clan:"A",name:"Alfa"},{id:"X",clan:"A",name:"Xeno"}]); ok(!CLANS.of("X"), "no invite, no membership");
ok(CLANS.join(b,clan).err, "can't join uninvited");
clan={...CLANS.invite(clan,"B").clan,id:"A"}; CLANS.set([clan],null);
ok(CLANS.invitesFor("B").length===1, "B sees invite");
ok(!CLANS.join(b,clan).err && b.clan==="A", "B joins");
CLANS.set(null,[{id:"A",clan:"A",name:"Alfa"},{id:"B",clan:"A",name:"Beta"},{id:"X",clan:"A",name:"Xeno"}]);
ok(CLANS.members(clan).map(m=>m.name).join()==="Alfa,Beta", "members: "+CLANS.members(clan).map(m=>m.name));
ok(CLANS.found(x,"Other","NORD",[C[1],C[2]]).err, "tag taken");
clan={...CLANS.kick(clan,"B").clan,id:"A"}; CLANS.set([clan],null); ok(!CLANS.of("B"), "kicked");
const bn=CLANS.banners([{id:"A",towns:["Riften","Solitude"]},{id:"X",towns:["Markarth"]}], a, null); ok(bn.length===2 && bn.every(x=>x.tag==="NORD"), "banners at members' homes only");
console.log("clans ok");
`,c);
