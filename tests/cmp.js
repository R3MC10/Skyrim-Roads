const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");const ctx={console,Math,Date,JSON,Set,Object,Array,String,Number};vm.createContext(ctx);
for(const f of ["data.js","formulas.js","engine.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (D|F|G) =/m,"globalThis.$1 ="),ctx);
const {D,G}=ctx;
for(const name of ["Wolf pack","Bandit outlaw","Black bear","Sabre cat","Draugr","Frost troll"]){let w=0;for(let i=0;i<1000;i++){const s=G.newSave("a","T","nord");const e=G.scaleEnemy(D.ENCOUNTERS.find(x=>x.name===name),1);const f=new G.Fight(s,e);w+=f.run()?1:0;}console.log("JS",name,(w/10).toFixed(0)+"%");}
