const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const A=G.newSave("A","Alfa","nord"), B=G.newSave("B","Beta","nord"); A.location="Whiterun"; B.location="Riften"; A.gold=500; B.gold=300;
const card=(s)=>({id:s.id,name:s.name});
// friends
ok(/now on your friends/.test(SOCIAL.add(A,card(B))),"add"); ok(/already/.test(SOCIAL.add(A,card(B))),"dup"); ok(/yourself/.test(SOCIAL.add(A,card(A))),"self");
const recs=[{...SOCIAL.record(A),id:"A"}]; ok(SOCIAL.addedMe(recs,B).length===1,"B sees A added them");
SOCIAL.add(B,card(A)); ok(SOCIAL.addedMe(recs,B).length===0,"added back");
// DMs
const docs=[]; let r=SOCIAL.dm(A,"B","Beta","  hej   there "); docs.push({...r.doc,id:r.id}); ok(r.doc.text==="hej there","trim");
ok(SOCIAL.dm(A,"B","Beta","   ").err,"empty");
r=SOCIAL.dm(B,"A","Alfa","yo"); r.doc.t+=1; docs.push({...r.doc,id:r.id});
ok(SOCIAL.unread(B,docs)===1 && SOCIAL.unread(A,docs)===1,"unread");
SOCIAL.markRead(B,docs,"A"); ok(SOCIAL.unread(B,docs)===0,"read");
ok(SOCIAL.thread(docs,"A","B").length===2 && SOCIAL.conversations(A,docs)[0].last==="yo","thread/conv");
ok(SOCIAL.dm(A,"B","Beta","x".repeat(999)).doc.text.length===SOCIAL.DM_MAX,"cap");
// courier trade conservation
const gem=G.give(A,"gem_ruby",2); const total0=A.gold+B.gold;
const C=SOCIAL.courierOffer(A,{id:"B",name:"Beta"},[gem],50,120);
ok(C.doc && C.doc.courier && A.gold===450 && !SMITH.count(A,"gem_ruby"),"escrow "+(C.text||""));
ok(!SOCIAL.arrived(C.doc),"not yet"); ok(SOCIAL.arrived(C.doc,C.doc.arrive+1),"arrives");
const acc=MP.accept(B,{...C.doc}); ok(acc && B.gold===300-120+50 && SMITH.count(B,"gem_ruby")>=2,"B accepts");
MP.settle(A,acc); ok(A.gold+B.gold===total0,"gold conserved "+(A.gold+B.gold)+" vs "+total0);
// declined returns items
const g2=G.give(A,"gem_garnet",1); const C2=SOCIAL.courierOffer(A,{id:"B",name:"Beta"},[g2],0,10); MP.settle(A,{...C2.doc,status:"declined"}); ok(SMITH.count(A,"gem_garnet")===1,"declined back");
// non-friend can't courier
const Z=G.newSave("Z","Zed","nord"); ok(!SOCIAL.courierOffer(A,{id:"Z",name:"Zed"},[],10,0).doc,"friends only");
ok(SOCIAL.status({level:5,updated:Date.now(),loc:"Riften"}).online && !SOCIAL.status({level:5,updated:Date.now()-864e5}).online,"status");
console.log("social ok");
`,c);
