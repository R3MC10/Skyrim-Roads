const __GAME = process.env.W || require("path").join(__dirname, "../game/");
// Menu tabs (menus.js): five bottom tabs (tabs5), sub-tabs, where every screen lives, and that ui.js can draw each one.
const fs=require("fs"),vm=require("vm");
const c={console,Math,Date,JSON,Object,Array,Set,Map,Number,String};vm.createContext(c);
const W=__GAME;
for(const f of ["menus.js"])vm.runInContext(fs.readFileSync(W+f,"utf8").replace(/^const (\w+) =/m,"var $1 ="),c);
c.UI_SRC=fs.readFileSync(W+"ui.js","utf8");
vm.runInContext(`
const ok=(c,m)=>{ if(!c) throw new Error("FAIL "+m); };
const M=MENUS;
ok(M.GROUPS.map(g=>g[1]).join()==="World,Area,Hero,Journal,Social","five tabs in order");
ok(M.GROUPS.map(g=>g[0]).join()==="world,town,hero,log,social","tab ids (screen tests click them)");
// where things live
for (const [s,g] of Object.entries({stars:"hero",hero:"hero",perks:"hero",stats:"hero",follower:"hero",settings:"hero",pack:"hero",
  ach:"log",library:"log",diary:"log",log:"log",map:"world",places:"world",world:"world",social:"social",town:"town"})) ok(M.groupOf(s)===g,"home of "+s+" "+M.groupOf(s));
ok(M.groupOf("nonsense")==="world","unknown screens fall back to World");
// tapping a bottom tab
ok(M.pick("world")==="map"&&M.pick("hero")==="hero"&&M.pick("log")==="log"&&M.pick("town")==="town"&&M.pick("social")==="social","first screens");
M.subnav("perks"); ok(M.pick("hero")==="perks","remembers the last sub-tab");
M.subnav("places"); ok(M.pick("world")==="places","remembers the World sub-tab");
M.subnav("hero"); M.subnav("map");
// sub-tab rows
const sn=M.subnav("stats"); ok((sn.match(/data-act="tabgo"/g)||[]).length===8&&/class="on"[^>]*data-id="stats"/.test(sn),"Hero row "+sn.slice(0,80));
ok(/data-id="@items"/.test(sn)&&/data-id="@magic"/.test(sn),"Items and Magic sit in the Hero row");
ok((M.subnav("log").match(/data-act="tabgo"/g)||[]).length===4,"Journal row: Quests, Discoveries, Achievements, Diary");
ok((M.subnav("map").match(/data-act="tabgo"/g)||[]).length===3,"World row: Travel, Places, World news");
ok(M.subnav("town")===""&&M.subnav("social")==="","single screens have no row");
ok(M.charTabs().map(t=>t[0]).join()==="hero,stars,perks,stats,follower,settings","compass Skills page tabs");
// every screen the tabs lead to is one ui.js can draw
const drawn=new Set(["stars","perks","ach","library","world","settings"]);
const m=UI_SRC.match(/\\{ \\.\\.\\.mnp, (.+?)\\}\\[tab\\]/); ok(m,"renderPanel map found");
for (const k of m[1].split(",")) { const id=k.split(":")[0].trim(); if (id && !id.startsWith("...")) drawn.add(id); }
for (const s of M.screens()) ok(drawn.has(s),"ui.js draws "+s);
for (const id of ["map","hero","town","log","social","stats","diary","places"]) ok(M.screens().includes(id),"old screen still reachable: "+id);
// the built panels (with stand-ins for ui.js parts)
const P=M.panels({S:{},ach:()=>"<div class='panel'>ACH</div>",settings:()=>"<h3>Accessibility</h3>",fest:()=>"",idPanel:(id,h)=>h});
ok(/ACH/.test(P.ach())&&/Accessibility/.test(P.settings())&&/data-act="totitle"/.test(P.settings())&&/data-act="guide"/.test(P.settings()),"settings + achievements");
ok(/Nothing is happening/.test(P.world())&&/World news/.test(P.world()),"world news empty state");
console.log("tabs ok");
`,c);
