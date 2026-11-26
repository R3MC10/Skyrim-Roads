"""PC fit: on a wide, short PC window the whole game sits on one screen (pcfit CSS block in index.html).
For every main screen at 2000x837, 1920x1080, 1366x768 and 2560x1080 it checks:
  * the page itself never scrolls (scrollHeight <= innerHeight, scrollWidth <= innerWidth)
  * the only boxes that scroll are the allowed side windows (the side panel, item/spell lists, popups' bodies...)
  * the header, map, side panel, map place card, menus and popups stay inside the window and above the bottom bar
Then a 360x780 phone run checks phones are untouched (the page still scrolls, the column layout is unchanged).

Run:  node tests/serve.js 9460   then
      python tests/pcfit_ui.py 9460 [--vp=2000x837,360x780] [--only=map,items]
Screenshots go to tests/out_pcfit/. Prints "pcfit_ui: all good"."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
FLAGS = dict((a[2:].split("=", 1) + [""])[:2] for a in sys.argv[1:] if a.startswith("--"))
PORT = ARGS[0] if ARGS else "9460"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_pcfit")
os.makedirs(OUT, exist_ok=True)
STYLE = "ink"   # hand-drawn only (pixel art is being retired)
ONLY = set(FLAGS["only"].split(",")) if FLAGS.get("only") else None

PCS = [("2000x837", 2000, 837), ("1920x1080", 1920, 1080), ("1366x768", 1366, 768), ("2560x1080", 2560, 1080)]
PHONE = ("360x780", 360, 780)
VPS = PCS + [PHONE]
if FLAGS.get("vp"): VPS = [v for v in VPS if v[0] in FLAGS["vp"].split(",")]

# boxes that may scroll on a PC: the side windows and lists, never the page, map, header, bar or fight screen
ALLOWED = ["#side", ".sky-mid", ".sky-cats", ".sky-detail", ".m2-pick", "#modal .sheet", ".tbsh-in", "#hudlane"]

CHECK = r"""(allowed) => {
  const W = innerWidth, H = innerHeight, se = document.scrollingElement, bad = [];
  if (se.scrollHeight > H + 1) bad.push(`page scrolls: ${se.scrollHeight} > ${H}`);
  if (se.scrollWidth > W + 1) bad.push(`page scrolls sideways: ${se.scrollWidth} > ${W}`);
  const shown = (e) => { if (!e || !e.isConnected) return false; const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false;
    for (let a = e; a; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const nm = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  // 1) only the side windows scroll
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e);
    const y = /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2, x = /(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 2;
    if (!(x || y) || !shown(e)) continue;
    if (allowed.some((s) => e.matches(s) || e.closest(s))) continue;
    bad.push(`scrolls: ${nm(e)} ${y ? e.scrollHeight + '/' + e.clientHeight : e.scrollWidth + '/' + e.clientWidth + ' wide'}`);
  }
  // 2) key boxes inside the window and above the bottom bar
  const tabs = document.querySelector('#tabs'), tchar = document.body.classList.contains('tw-char');
  const barTop = tabs && shown(tabs) && !tabs.classList.contains('hide') ? tabs.getBoundingClientRect().top : H;
  const under = ['.app>.top', '.mapwrap', '#picked', '.app>.layout'].concat(tchar ? [] : ['#side']);
  const over = ['#sky .sky-in', '#tw .tw-bar', '#modal .sheet', '.tbf .tbin', '#dun'];
  const out = {};
  for (const s of under.concat(over)) {
    const e = document.querySelector(s); if (!shown(e)) continue;
    const r = e.getBoundingClientRect(); out[s] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) bad.push(`${s} goes past the window ${out[s]}`);
    if (under.includes(s) && r.bottom > barTop + 1) bad.push(`${s} reaches under the bottom bar (${Math.round(r.bottom)} > ${Math.round(barTop)})`);
  }
  // the map's place card can be seen and clicked (not hidden behind the bar or anything else)
  const pk = document.querySelector('#picked');
  if (shown(pk)) { const r = pk.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 4); if (!hit || !pk.contains(hit)) bad.push(`place card covered at its bottom edge by ${hit ? nm(hit) : 'nothing'}`); }
  return { bad, out, sh: se.scrollHeight, H, side: document.querySelector('#side')?.dataset.tab || '' };
}"""

PHONECHECK = r"""() => {
  const app = document.querySelector('#app'), cs = getComputedStyle(app), lay = document.querySelector('.app>.layout'), side = document.querySelector('#side');
  return { appMax: cs.maxWidth, appH: cs.height, htmlOv: getComputedStyle(document.documentElement).overflowY, cols: lay ? getComputedStyle(lay).gridTemplateColumns : '',
           sidePos: side ? getComputedStyle(side).position : '', sideOv: side ? getComputedStyle(side).overflowY : '', sh: document.scrollingElement.scrollHeight, H: innerHeight }; }"""

SETUP = """(()=>{ const S=window.__dbg.save(); S.gold=3000; S.level=12; S.trip=null;
  ['Riverwood','Riften','Bleak Falls Barrow','Embershard Mine','Windhelm'].forEach(p=>{ if(!S.discovered.includes(p)) S.discovered.push(p); });
  const st=G.give(S,'steel_sword'); G.equip(S,st); G.give(S,'iron_sword'); G.give(S,'potion_health',4); G.give(S,'iron_helmet'); G.give(S,'gem_emerald');
  try{ ONBOARD && ONBOARD.dismiss && ONBOARD.dismiss() }catch(e){}
  return true; })()"""
RESET = """(()=>{ try{ TABMENU.closeHub() }catch(e){}
  for (let i=0;i<8;i++){ try{ if(!window.__ui.back()) break; }catch(e){ break; } }
  document.querySelectorAll('#modal,#loadcard,#bark,.toast,#toast,#nickbox,.tbf,#dun').forEach(m=>m.remove());
  try{ TABMENU.closeHub() }catch(e){} document.body.classList.remove('tw-char');
  const S=window.__dbg.save(); if (S && !S.dungeon) S.trip=null; })()"""
TAB = "(t)=>{ document.querySelector('#tabs [data-tab='+t+']')?.click() }"
SUB = "(t)=>{ document.querySelector('#side [data-act=tabgo][data-id='+t+']')?.click() }"

SCREENS = []
def screen(name, *steps): SCREENS.append((name, steps))
screen("map", ("tab", "world"))
screen("map_picked", ("tab", "world"), ("js", "__ui.jump({place:'Windhelm'})"))
screen("map_places", ("tab", "world"), ("sub", "places"))
screen("map_world", ("tab", "world"), ("sub", "world"))
for s in ["hero", "stars", "perks", "stats", "ach", "library", "diary", "settings"]:
    screen("char_" + s, ("tab", "hero"), ("sub", s))
screen("skills_page", ("js", "TABMENU.go('char')"))
screen("items", ("js", "__ui.go('items')"))
screen("magic", ("js", "__ui.go('magic')"))
screen("journal", ("tab", "log"))
screen("social", ("tab", "social"))
screen("area", ("tab", "town"))
screen("shop", ("js", "__ui.jump({tab:'town',shop:'general'})"))
screen("compass", ("js", "TABMENU.openHub()"))
screen("event", ("js", """(()=>{ const S=__dbg.save(); G.startTrip(S,'Windhelm',WORLD.places.Windhelm.slice(0,2));
      S.trip.status='event'; S.trip.event={id:'shrine', god:'Talos', text:'A weathered roadside shrine to Talos stands among the stones.'}; __dbg.openEvent(); })()"""))
screen("dungeon", ("js", """(()=>{ const S=__dbg.save(); const n='Bleak Falls Barrow'; S.location=n; [S.x,S.y]=WORLD.places[n].slice(0,2); S.cleared={}; __ui.go('map'); })()"""),
       ("js", "document.querySelector('[data-act=enter]')?.click()"), ("wait", 1200), ("js", "document.querySelectorAll('#loadcard').forEach(e=>e.remove())"))
screen("modal_settings", ("tab", "world"), ("js", "document.querySelector('.top .snd')?.click()"))
screen("modal_message", ("tab", "world"), ("js", "__dbg.message('A letter', 'The Jarl of Whiterun asks for you. '.repeat(40))"))
screen("fight", ("js", """(()=>{ const S=__dbg.save(); S.dungeon=null; S.trip=null;
      const e=G.scaleEnemy({name:'Bandit',health:120,damage:9,tags:['humanoid'],level:12,danger:'medium',gold:[0,0],text:''},12);
      TB.call(S, ()=>{ const f=new G.Fight(S,e); f.allies=[]; return f.run({trySneak:false}); }, ()=>{}); })()"""), ("wait", 1500),
       ("js", "document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click())"), ("wait", 600))


async def run_vp(b, vp, fails):
    name, vw, vh = vp
    phone = vw < 1000
    ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone)
    await ctx.add_init_script(f"try{{localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{STYLE}'}}))}}catch(e){{}}")
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    for i in range(4):
        try: await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&tb&p=pf{STYLE}{vw}"); break
        except Exception:
            if i == 3: raise
            await pg.wait_for_timeout(1500)
    await pg.wait_for_selector(".press", timeout=45000); await pg.wait_for_timeout(800)
    await pg.evaluate("document.querySelector('.press')?.click()"); await pg.wait_for_timeout(600)
    if not phone and (not ONLY or "title" in ONLY):
        await pg.screenshot(path=os.path.join(OUT, f"{STYLE}_{name}_title.png"))
        bad = (await pg.evaluate(CHECK, ALLOWED))["bad"]
        print(f"  {name:10} {'title':16} " + ("ok" if not bad else "FAIL " + "; ".join(bad)[:500]), flush=True)
        if bad: fails.append(f"{name} title: {bad}")
    await pg.evaluate("document.querySelector('.mi[data-t=new]')?.click()"); await pg.wait_for_timeout(400)
    await pg.fill("#nm", "Ysolda"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(SETUP)
    await pg.mouse.move(2, vh // 2)   # keep the mouse off the panels (no tooltips in the shots)
    for sname, steps in SCREENS:
        if ONLY and sname not in ONLY: continue
        if phone and sname not in ("map", "map_picked", "char_stars", "items", "skills_page", "fight"): continue
        await pg.evaluate(RESET); await pg.wait_for_timeout(150)
        for kind, arg in steps:
            if kind == "tab": await pg.evaluate(TAB, arg)
            elif kind == "sub": await pg.evaluate(SUB, arg)
            elif kind == "wait": await pg.wait_for_timeout(arg); continue
            else:
                try: await pg.evaluate(arg)
                except Exception as e: errs.append(f"{sname}: {str(e)[:120]}")
            await pg.wait_for_timeout(350)
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=os.path.join(OUT, f"{STYLE}_{name}_{sname}.png"))
        if phone:
            r = await pg.evaluate(PHONECHECK)
            bad = []
            if r["htmlOv"] == "hidden": bad.append("page can't scroll on a phone")
            if r["appMax"] != "1240px": bad.append(f"phone column changed: max-width {r['appMax']}")
            if r["sidePos"] == "static" and r["sideOv"] == "auto": bad.append("side panel scrolls by itself on a phone")
            if sname == "map" and r["sh"] <= r["H"]: bad.append(f"phone map page no longer scrolls ({r['sh']} <= {r['H']})")
        else:
            r = await pg.evaluate(CHECK, ALLOWED); bad = r["bad"]
        print(f"  {name:10} {sname:16} " + ("ok" if not bad else "FAIL " + "; ".join(bad)[:500]), flush=True)
        if bad: fails.append(f"{name} {sname}: {bad}")
    if errs: print(f"  {name} page errors: {errs[:4]}")
    await ctx.close()


async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for vp in VPS:
            print(vp[0], flush=True)
            await run_vp(b, vp, fails)
        await b.close()
    if fails:
        print(f"pcfit_ui: {len(fails)} problems"); sys.exit(1)
    print("pcfit_ui: all good")

asyncio.run(main())
