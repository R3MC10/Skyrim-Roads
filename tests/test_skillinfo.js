const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String};vm.createContext(c);
const W=__GAME + "";
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","horses.js","hall.js","bounty.js","visits.js","cooking.js","arena.js","market.js","smithing.js","social.js","ammo.js","tomes.js","mp.js","skillinfo.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
const src=fs.readdirSync(W).filter(f=>f.endsWith(".js")&&f!=="skillinfo.js").map(f=>fs.readFileSync(W+f,"utf8")).join("\n");
c.SRC=src;
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const fresh=G.newSave("A","New","nord");
const vet=G.newSave("B","Vet","khajiit"); vet.level=50; for(const k of D.ALL_SKILLS) vet.skills[k].lvl=Math.min(100,vet.skills[k].lvl+50);
for(const sk of D.ALL_SKILLS){
  const e=SKILLINFO.INFO[sk]; ok(e,"entry "+sk);
  for(const s of [fresh,vet,null]){ const g=SKILLINFO.get(s,sk); ok(g.what&&g.raise.length&&Array.isArray(g.now),"fields "+sk);
    for(const l of g.now) ok(!/NaN|undefined|Infinity/.test(l),"number "+sk+": "+l); }
  // every everyday XP source named in the text exists in the game code
  for(const code of e.code) ok(SRC.includes(code),"code for "+sk+": "+code);
  ok(e.raise.length===0 ? (SKILLINFO.trainers(sk).length||SKILLINFO.books(sk).length) : e.code.length>0, "raise source "+sk);
}
// spot checks against the game's own functions
ok(SKILLINFO.get(fresh,"Mercantile").now[0].includes("×"+F.priceFactor(G.skill(fresh,"Mercantile")).toFixed(2)),"merc matches F");
ok(SKILLINFO.trainers("Speechcraft").some(t=>/Giraud Gemane in Solitude \\(up to 90\\)/.test(t)),"trainer text");
ok(SKILLINFO.books("Etiquette").length===1,"etiquette book");
const noDaily=D.ALL_SKILLS.filter(k=>!SKILLINFO.INFO[k].raise.length); console.log("skills with no everyday XP source:", noDaily.join(", "));
console.log(SKILLINFO.get(fresh,"One-Handed").now[0]); console.log(SKILLINFO.get(vet,"Sneak").now[0]); console.log(SKILLINFO.get(fresh,"Lockpicking").now.join(" | "));
console.log("skillinfo ok");
`,c);
