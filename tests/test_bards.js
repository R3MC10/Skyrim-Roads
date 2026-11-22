const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,RegExp};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","bards.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
// filter
ok(BARDS.clean("  Hello   brave   world  ").text==="Hello brave world","collapse");
ok(!/http|www|\\.com/.test(BARDS.clean("Visit https://evil.example.com and www.spam.net now friends").text),"urls stripped: "+BARDS.clean("Visit https://evil.example.com and www.spam.net now friends").text);
ok(BARDS.clean("shit happens on the road").err,"block word");
ok(BARDS.clean("f.u.c.k this dragon").err,"block disguised");
ok(BARDS.clean("Glass sword of Scunthorpe is sharp").text,"no false positive on substrings");
ok(BARDS.clean("hi").err,"too short");
ok(BARDS.clean("x".repeat(40)+" "+"y".repeat(80)).text.length<=91,"length cap");
ok(BARDS.clean("<script>alert(1)</script> a verse").text.indexOf("<")<0,"no tags");
// writing
const A=G.newSave("A","Alfa","nord"), B=G.newSave("B","Beta","nord"); A.location=B.location="Whiterun"; A.gold=B.gold=0;
let docs=[]; const t0=G.now();
let r=BARDS.write(A,"Alfa slew the beast of Bleak Falls","dungeon",docs,t0); ok(r.doc,"write "+r.err); docs.push({...r.doc,id:r.id});
ok(BARDS.write(A,"Another verse the same day","road",docs,t0).err,"one per day");
r=BARDS.write(A,"A second verse a day later","road",docs,t0+BARDS.DAY_SECONDS); 
if(BARDS.week(t0+BARDS.DAY_SECONDS)===BARDS.week(t0)){ ok(r.doc,"second day ok"); docs.push({...r.doc,id:r.id}); ok(BARDS.write(A,"A third verse later still","road",docs,t0+2*BARDS.DAY_SECONDS).err||BARDS.week(t0+2*BARDS.DAY_SECONDS)!==BARDS.week(t0),"max pending 2"); }
A.location="Bleak Falls Barrow"; ok(BARDS.write(A,"Verse in a barrow somewhere","road",docs,t0+3*BARDS.DAY_SECONDS).err,"only at inns"); A.location="Whiterun";
ok(BARDS.deeds(A).length>=1,"deed suggestions");
// likes
const v=docs[0]; let likes=[];
ok(BARDS.like(A,v,likes).err,"no self like");
r=BARDS.like(B,v,likes); ok(r.doc,"like"); likes.push({...r.doc,id:r.id});
ok(BARDS.like(B,v,likes).err,"like once");
likes.push({...r.doc,id:r.id}); ok(BARDS.counts(likes)[v.id]===1,"dupes not double counted");
// song determinism
const W0=BARDS.weekOf(v); const verses=[]; const ls=[];
for(let i=0;i<9;i++){ verses.push({id:"p"+i+"-"+(W0*7+1),uid:"p"+i,name:"P"+i,text:"Line number "+i+" of the north",day:W0*7+1+(i%7),t:1000+i}); for(let k=0;k<(i%4);k++) ls.push({id:"x"+i+k,verseId:"p"+i+"-"+(W0*7+1),voter:"v"+k}); }
const s1=BARDS.songFor(W0,verses,ls), s2=BARDS.songFor(W0,[...verses].reverse(),[...ls].reverse());
ok(JSON.stringify(s1.lines.map(x=>x.id))===JSON.stringify(s2.lines.map(x=>x.id)),"deterministic");
ok(s1.lines.length<=6 && s1.lines[0].likes>=s1.lines[s1.lines.length-1].likes,"sorted by likes");
ok(BARDS.songFor(W0,verses,ls,["p3"]).lines.every(x=>x.uid!=="p3"),"muted hidden");
// reward once
const P=G.newSave("p3","P3","nord"); P.gold=0; const fin={...s1,final:true};
if(fin.lines.some(x=>x.uid==="p3")){ ok(/gold/.test(BARDS.reward(P,fin)) && P.gold===BARDS.REWARD_GOLD && P.titles.includes(BARDS.TITLE),"reward"); ok(BARDS.reward(P,fin)===null && P.gold===BARDS.REWARD_GOLD,"reward once"); }
ok(BARDS.reward(P,{...s1,final:false})===null,"no reward for unfinished song");
// current(): last week's song if any
const cur=BARDS.current(verses,ls,[], (W0+1)*7*BARDS.DAY_SECONDS + 0); 
console.log("bards ok · song lines", s1.lines.length, "· top", s1.lines[0].text, s1.lines[0].likes);
`,c);
