// FIGART: the shared rigged character renderer — every race × gear × clip draws without NaN, clips blend, the rig holds together
const __GAME = process.env.W || require("path").join(__dirname, "../game/");
const fs=require("fs"),vm=require("vm");
const W=process.env.W||__GAME + "";
const calls={n:0};
const ctx=new Proxy({}, {get:(t,k)=>{ if(k in t) return t[k]; return (...a)=>{ calls.n++; for(const v of a) if(typeof v==="number"&&!isFinite(v)) throw new Error("NaN in "+String(k)); return {addColorStop(){}}; }; }, set:(t,k,v)=>{ t[k]=v; return true; }});
const doc={addEventListener(){},createElement:()=>({width:0,height:0,style:{},dataset:{},getContext:()=>ctx,toDataURL:()=>"data:image/png;base64,AA"})};
const c={calls,addEventListener(){},removeEventListener(){},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},console,Math,Date,JSON,Float64Array,Float32Array,Uint8Array,Int32Array,Uint16Array,Int16Array,Object,Array,Set,Map,Proxy,Number,String,document:doc,localStorage:{getItem:()=>null,setItem(){}},devicePixelRatio:2};vm.createContext(c);
const files=fs.readFileSync(W+"index.html","utf8").match(/<script src="([a-z0-9]+\.js)">/g).map(s=>s.match(/"(.*)"/)[1]).filter(f=>!["store.js","p2pnet.js","ui.js","sound.js","map.js","backup.js","skillinfo.js"].includes(f));
for(const f of files) vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
vm.runInContext(`const ctx=document.createElement("canvas").getContext("2d");
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
ok(typeof FIGART!=="undefined" && HEROART.sprite===FIGART.sprite && HEROART.drawFigure && HEROART.fightFigure && HEROART.animator, "API on HEROART");
const poses=Object.keys(FIGART.POSES);
const items=Object.keys(D.ITEMS).filter(k=>{const v=D.ITEMS[k];return v.slot==="weapon"||G.ARMOR_SLOTS.includes(v.slot)});
let n=0;
// every item on every race in a few clips
for(const r of Object.keys(D.RACES)) for(const id of items){
  const it=D.ITEMS[id], slot=it.slot, look={r, id:"f"+n, eq:{[slot]:id}, gl:{w:it.enchant?it.enchant.effect:undefined}, sx:n%2?"f":undefined, v:n%9===0?1:0};
  const pose=poses[n%poses.length], cv=FIGART.sprite({look},{pose, frame:n, h:40, horse:"#6b4a2e"});
  ok(cv && cv.width>0 && isFinite(cv.ax) && isFinite(cv.ay), "sprite "+id+" "+pose); n++;
}
// a fully geared hero through every clip and frame, with a jewelry slot the save may not have yet
const s=G.newSave("A","Ann","nord"); for(const id of ["steel_armor","steel_helmet","steel_gauntlets","steel_boots","steel_shield","steel_sword"]) { const rid=G.give(s,id); G.equip(s,rid); }
const L=HEROART.lookOf(s), L2={...L, eq:{...L.eq, amulet:"amulet_gold", ring:"ring_silver"}};
for(const p of poses) for(let f=0; f<FIGART.POSES[p]; f++) { FIGART.sprite(s,{pose:p,frame:f}); FIGART.sprite({look:L2},{pose:p,frame:f}); }
// the rig: bones keep their lengths whatever the clip
const sp=FIGART.specOf(L);
for(const p of poses) for(let t=0;t<1;t+=0.1){
  const P=FIGART.poseAt(p,t,sp), B=FIGART.solve(sp, P);
  ok(FIGART.RIG.every(([b])=>B[b] && isFinite(B[b].x+B[b].y+B[b].a)), "rig finite "+p);
  const d=(a,b)=>Math.hypot(B[a].x-B[b].x,B[a].y-B[b].y);
  ok(Math.abs(d("upperN","foreN")-11)<0.01 && Math.abs(d("thighN","shinN")-13.4)<0.01, "bone lengths "+p);
  if(p!=="ride") ok(Math.abs(B.footN.y-(P.fn[1]-2.2))<0.6 && Math.abs(B.footN.x-P.fn[0])<0.6, "near foot reaches its goal "+p+" "+B.footN.y);
}
// clips are keyframed and blend smoothly
const a=FIGART.poseAt("idle",0,sp), b=FIGART.poseAt("attack",0.55,sp), m=FIGART.blend(a,b,0.5);
ok(Math.abs(m.aim-(a.aim+b.aim)/2)<1e-9, "blend halfway");
const w0=FIGART.poseAt("walk",0.1,sp), w1=FIGART.poseAt("walk",0.11,sp); ok(Math.abs(w0.fn[0]-w1.fn[0])<1, "walk is smooth in time");
ok(FIGART.sprite(s,{pose:"attack",t:0.3,from:{pose:"idle",t:1},w:0.4}).width>0, "blended frame");
const an=FIGART.animator(); an.play("idle",0); an.draw(document.createElement("canvas").getContext("2d"), s, 10, 50, 0.5, {h:40}); an.play("attack",0.6); an.draw(ctx, s, 10, 50, 0.65, {h:40}); ok(an.pose==="attack","animator");
// foe cards can borrow the renderer with a gear override
ok(FIGART.sprite({name:"Bandit",race:"redguard"},{pose:"attack",frame:2,gear:{chest:"hide_armor",weapon:"iron_war_axe"}}).width>0, "foe card with gear");
// the fight rig with replay numbers, including a horse-free foe 'player'
for(const lunge of [0,0.5,1]) for(const back of [0,-1.4]) FIGART.fight(ctx, s, {t:1.3, lunge, back, aim:-0.4+lunge, shield:true, glow:lunge>0.5});
FIGART.fight(ctx, {look:L}, {t:0, wt:"bow", draw:0.8});
// figure(card, {pose}) returns a canvas; the old figure(card, w, h) still returns html
ok(HEROART.figure(s,{pose:"walk",frame:3}).width>0, "object figure");
ok(/<img/.test(HEROART.figure(s,160,220)), "html figure");
console.log("figart ok ·", n, "race×item sprites · canvas calls", calls.n);
`,c);
