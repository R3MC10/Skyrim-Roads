const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy};vm.createContext(c);
for(const f of ["data.js","world.js","terrain.js","formulas.js","perks.js","powers.js","engine.js","events.js","dungeons.js","towns.js","wevents.js","enchanting.js","quests.js","mp.js"])vm.runInContext(fs.readFileSync(__GAME + ""+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`
function run(place, level, N=600, cautious=true){
  const res={cleared:0,died:0,left:0,gold:0,rooms:0}; let err=0;
  for(let k=0;k<N;k++){
    const s=G.newSave("p"+k,"T",["nord","redguard","breton","khajiit","altmer","imperial"][k%6]);
    s.level=level; s.hpBonus=(level-1)*10*0.6; s.spBonus=(level-1)*10*0.4; for(const sk of Object.values(s.skills)) sk.lvl=Math.min(100,sk.lvl+(level-1)*2);
    if(level>=4){ for(const it of ["steel_sword","steel_armor","steel_helmet","steel_boots","steel_gauntlets","steel_shield"]){G.give(s,it); G.equip(s, s.inv[s.inv.length-1].id);} for(let i=0;i<Math.floor(level/3);i++)G.give(s,"potion_health"); }
    G.setHealth(s,G.maxHealth(s));
    s.location=place; [s.x,s.y]=WORLD.places[place];
    const e=DUNGEONS.enter(s); if(e){console.log(e);return;}
    let guard=0;
    try{
    while(s.dungeon && guard++<200){
      const d=s.dungeon;
      if(!d.room){
        if(d.done){ DUNGEONS.leave(s); res.cleared++; break; }
        const ch=DUNGEONS.nextChoices(s);
        const hp=G.curHealth(s)/G.maxHealth(s);
        if(cautious && hp<0.3 && !G.countRestore(s,"health") && d.rows[d.row+1]?.[0]?.type==="boss"){ DUNGEONS.leave(s); res.left++; break;}
        let col=ch[0];
        const rest=ch.find(i=>d.rows[d.row+1][i].type==="rest"); const safe=ch.find(i=>!["elite","fight","trap"].includes(d.rows[d.row+1][i].type));
        col = hp<0.6 && rest!=null ? rest : hp<0.5 && safe!=null ? safe : ch[Math.floor(Math.random()*ch.length)];
        const er=DUNGEONS.enterRoom(s,col); if(er) throw er; res.rooms++;
        continue;
      }
      const chs=DUNGEONS.roomChoices(s).map(x=>x[0]);
      const hp=G.curHealth(s)/G.maxHealth(s);
      let c=chs[0];
      if(d.room.enemy && hp<0.5 && chs.includes("potion")) c="potion";
      else if(d.room.type==="trap") c="dash"; else if(d.room.type==="puzzle") c="set:"+d.room.order;
      else if(d.room.type==="rest") c= hp<0.9?"rest":"search";
      const rt=d.room.type, rr=d.row; if(rt==="boss"){res.bossHp=(res.bossHp||0)+hp;res.bossN=(res.bossN||0)+1;} const r=DUNGEONS.act(s,c); if(r.died){res.where=res.where||{}; const k=rt; res.where[k]=(res.where[k]||0)+1;}
      if(typeof r.text!=="string") throw "notext";
      if(r.died){res.died++; const k=(d.room?d.room.type:"?")+"@"+d.row; res.where=res.where||{}; res.where[k]=(res.where[k]||0)+1; break;}
    }
    if(guard>=200) throw "loop";
    } catch(x){ err++; if(err<3) console.log("ERR",x,x.stack); }
    res.gold+=s.gold;
  }
  console.log(place.padEnd(22),"L"+level, "cleared",(res.cleared/N*100).toFixed(0)+"%","died",(res.died/N*100).toFixed(0)+"%","left",(res.left/N*100).toFixed(0)+"%","avg gold",(res.gold/N|0),"rooms",(res.rooms/N).toFixed(1),"err",err, "hp@boss",(res.bossHp/res.bossN).toFixed(2));
}
for (const [p,l] of [["Bleak Falls Barrow",1],["Embershard Mine",1],["Saarthal",3],["Saarthal",6],["Raldbthar",6],["Fort Greymoor",6],["Labyrinthian",8],["Labyrinthian",12],["Labyrinthian",18],["Halted Stream Camp",10],["Bonestrewn Crest",12],["Bonestrewn Crest",20],["Broken Fang Cave",6],["Nightcaller Temple",6],["Bloodlet Throne",15]]) run(p,l);
`,c);
