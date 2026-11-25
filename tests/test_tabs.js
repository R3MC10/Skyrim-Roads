const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Menu tabs (menus.js): seven bottom tabs, sub-tabs, where every screen lives, and that ui.js can draw each one.
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Object,Array,Set,Map,Number,String};vm.createContext(c);
const W=__GAME;
for(const f of ["menus.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
c.UI_SRC=fs.readFileSync(W+"ui.js","utf8");
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const M=MENUS;
ok(M.GROUPS.map(g=>g[1]).join()==="Character,Items,Magic,Map,Journal,Social,Area","seven tabs in order");
ok(M.GROUPS.map(g=>g[0]).join()==="hero,pack,magic,map,log,social,town","tab ids kept (old screen tests click them)");
// where things live
for (const [s,g] of Object.entries({stars:"hero",hero:"hero",perks:"hero",stats:"hero",ach:"hero",library:"hero",diary:"hero",settings:"hero",
  pack:"pack",map:"map",places:"map",world:"map",log:"log",social:"social",town:"town",magic:"magic"})) ok(M.groupOf(s)===g,"home of "+s+" "+M.groupOf(s));
ok(M.groupOf("nonsense")==="map","unknown screens fall back to the map");
// tapping a bottom tab
ok(M.pick("pack")==="@items"&&M.pick("magic")==="@magic","items/magic open the menu");
ok(M.pick("hero")==="hero"&&M.pick("map")==="map"&&M.pick("log")==="log","first screens");
M.subnav("diary"); ok(M.pick("hero")==="diary","remembers the last sub-tab");
M.subnav("world"); ok(M.pick("map")==="world","remembers the map sub-tab");
// sub-tab rows
const sn=M.subnav("stats"); ok((sn.match(/data-act="tabgo"/g)||[]).length===9&&/class="on"[^>]*data-id="stats"/.test(sn),"character row "+sn.slice(0,80));
ok(M.subnav("log")===""&&M.subnav("town")===""&&M.subnav("social")==="","single screens have no row");
ok(M.charTabs().map(t=>t[0]).join()==="stars,hero,follower,perks,stats,ach,library,diary,settings","compass Skills page tabs");
// every screen the tabs lead to is one ui.js can draw
const drawn=new Set(["stars","perks","ach","library","world","settings"]);
const m=UI_SRC.match(/\\{ \\.\\.\\.mnp, (.+?)\\}\\[tab\\]/); ok(m,"renderPanel map found");
for (const k of m[1].split(",")) { const id=k.split(":")[0].trim(); if (id && !id.startsWith("...")) drawn.add(id); }
for (const s of M.screens()) ok(drawn.has(s),"ui.js draws "+s);
for (const id of ["map","hero","pack","town","log","social","stats","diary","places"]) ok(M.screens().includes(id),"old screen still reachable: "+id);
// the built panels (with stand-ins for ui.js parts)
const P=M.panels({S:{},ach:()=>"<div class='panel'>ACH</div>",settings:()=>"<h3>Accessibility</h3>",fest:()=>"",idPanel:(id,h)=>h});
ok(/ACH/.test(P.ach())&&/Accessibility/.test(P.settings())&&/data-act="totitle"/.test(P.settings())&&/data-act="guide"/.test(P.settings()),"settings + achievements");
ok(/Nothing is happening/.test(P.world())&&/World news/.test(P.world()),"world news empty state");
console.log("tabs ok");
`,c);
