"""World map visuals screen test (map.js, inkmap.js, pcmap.js) with the painted map (?assets).
Wide PC windows 2000x810, 2560x1080, 3440x1440, 1920x1080 and a phone 390x844 at DPR 3; zoomed all the way out, then
close on Whiterun at three zoom levels. Checks:
- the canvas backing store is its CSS size x devicePixelRatio (sharp on every screen)
- zoomed out on a PC the map fills the window (no empty band beside it)
- no orphan gold bar: every world-event progress bar's own card is on top at the bar's spot (not hidden under the map)
- roads are drawn in the new hand-inked style
- the painting is never drawn bigger than ~1.3x its own pixels (past that the ink chart takes over), or with the
  tile pyramid (maptiles.js) no more than 3x its 8000 px top level, with the painted grain on
- PC: the event / caravan cards sit in one column at the left edge (mapdock.js), at most ~380px wide, and the map
  keeps names out from under them; on the phone they stay in the page as before
Popups, banners, toasts and tooltips are closed before every shot so the map itself is what's seen.
Run:  node tests/serve.js 8765   then   py tests/mapvisuals_ui.py 8765 [outdir]
Screenshots land in outdir (default: tests/out_mapvisuals)."""
import asyncio, os, sys
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_mapvisuals")
os.makedirs(OUT, exist_ok=True)
SIZES = [(2000, 810, 1), (2560, 1080, 1), (3440, 1440, 1), (1920, 1080, 1), (390, 844, 3)]
CLEAR = ("document.querySelectorAll('#modal,#sky,.sky,.tw,#pbanners > *,#hudlane .hl-log > *,#hudlane .hl-say > *,.toast,#tip,#wxpop')"
         ".forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()")
QUIET = "#pbanners,#hudlane,#tip,.toast{display:none!important}"
DOCK = """()=>{ const t=document.getElementById('topcards'); if(!t) return null; const r=t.getBoundingClientRect(), cs=getComputedStyle(t);
  let kids=[...t.children].filter(c=>c.getClientRects().length && c.offsetHeight>2).map(c=>{const q=c.getBoundingClientRect(); return [q.left,q.right,q.width]});
  const k=r.width/(parseFloat(cs.width)||r.width||1);   /* big screens scale the whole PC interface up */
  return { pos: cs.position, disp: cs.display, left: r.left/k, width: r.width/k, kids: kids.map(([a,b,w])=>[a/k,b/k,w/k]), wevIn: !!document.querySelector('#topcards > #wev') }; }"""
TOWN = """(t)=>{ const S=__dbg.save(); S.location=t; [S.x,S.y]=WORLD.places[t]; S.trip=null;
  for(const n of Object.keys(WORLD.places)) if(!S.discovered.includes(n) && Math.hypot(WORLD.places[n][0]-S.x, WORLD.places[n][1]-S.y) < 0.3) S.discovered.push(n);
  __ui.go('map'); __dbg.publish(); }"""
PROBE = """()=>{ const c=document.getElementById('map'), r=c.getBoundingClientRect(), v=__dbg.view(), t=v.transform;
  const bars=[...document.querySelectorAll('.wev-bar')].filter(b=>b.offsetWidth>0 && b.getBoundingClientRect().bottom>0 && b.getBoundingClientRect().top<innerHeight).map(b=>{
    const q=b.getBoundingClientRect(), strip=b.closest('.wev-strip')||b.parentElement, el=document.elementFromPoint(q.left+q.width/2, q.top+q.height/2);
    return { inside: !!el && (strip.contains(el) || !c.contains(el) && el!==c), onMap: el===c }; });
  return { w:c.width, h:c.height, cw:c.clientWidth, ch:c.clientHeight, dpr:Math.min(3, devicePixelRatio), zoom:v.zoom,
    mapW: t ? 1000*t.k : 0, mapH: t ? 700*t.k : 0, ox: t ? t.ox : 0, oy: t ? t.oy : 0, bars, stats: WorldMap.stats(), pc: typeof PCMAP!=='undefined' && PCMAP.on() }; }"""

async def main():
    fails = []
    def ok(c, m):
        print(("ok   " if c else "FAIL ") + m)
        if not c: fails.append(m)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for vw, vh, dpr in SIZES:
            tag = f"{vw}x{vh}"
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dpr, has_touch=dpr > 1, is_mobile=dpr > 1)
            pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
            url = f"http://127.0.0.1:{PORT}/index.html?assets&net=bc&notut&p=mv{vw}"
            for attempt in range(3):   # a cold start over a one-thread test server sometimes stalls: try again
                try:
                    await pg.goto(url); await pg.wait_for_selector(".press", timeout=45000); await pg.wait_for_timeout(800)
                    await pg.click(".press"); await pg.wait_for_timeout(300); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm", timeout=15000)
                    await pg.fill("#nm", "Tester"); await pg.click("#begin"); await pg.wait_for_function("()=>!!__dbg.save()", timeout=15000)
                    break
                except Exception as e:
                    errs.clear(); print(f"     {tag}: start attempt {attempt + 1} failed ({str(e).splitlines()[0][:80]})")
            await pg.wait_for_timeout(1500)
            await pg.add_style_tag(content=QUIET)   # banners keep coming from a queue: hide them for the shots
            await pg.evaluate(CLEAR); await pg.evaluate(TOWN, "Whiterun"); await pg.evaluate(CLEAR); await pg.wait_for_timeout(1200)
            mz = await pg.evaluate("()=>typeof PCMAP!=='undefined'&&PCMAP.on()?PCMAP.minZoomFor(document.getElementById('map')):1")
            for name, z in [("out", mz), ("z1_6", 1.6), ("z2_5", 2.5), ("z4_5", 4.5)]:
                await pg.evaluate("(z)=>__dbg.setView(z,[WORLD.places.Whiterun[0],WORLD.places.Whiterun[1]])", z)
                await pg.mouse.move(vw / 2, vh / 2); await pg.evaluate(CLEAR); await pg.wait_for_timeout(1400); await pg.evaluate(CLEAR)
                await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"))
                s = await pg.evaluate(PROBE); st = s["stats"]
                ok(s["w"] == round(s["cw"] * s["dpr"]) and s["h"] == round(s["ch"] * s["dpr"]), f"{tag} {name}: canvas {s['w']}x{s['h']} = {s['cw']}x{s['ch']} x DPR {s['dpr']}")
                ok(st.get("roads") == "ink", f"{tag} {name}: roads drawn as hand-inked paths ({st.get('roads')})")
                if st.get("tileLevel"):   # the 8000 px tile pyramid (maptiles.js): never past ~3x, with the painted grain on once past its pixels
                    ok(st.get("paintScale", 0) <= 3 and (st.get("paintScale", 0) <= 1 or st.get("grain", 0) > 0), f"{tag} {name}: painting tiles at {st.get('paintScale', 0):.2f}x their pixels, grain {st.get('grain', 0)}")
                else:
                    ok(st.get("paintScale", 0) <= 1.3 + 1e-6, f"{tag} {name}: painting drawn at {st.get('paintScale', 0):.2f}x its pixels (max 1.3)")
                ok(all(x["inside"] for x in s["bars"]), f"{tag} {name}: no orphan gold bar ({len(s['bars'])} event bars, all on their cards)")
                if name == "out" and s["pc"]:
                    cw, ch = s["cw"] * s["dpr"], s["ch"] * s["dpr"]
                    ok(s["mapW"] * s["dpr"] >= cw - 2 and s["mapH"] * s["dpr"] >= ch - 2, f"{tag}: zoomed out, the map fills the window ({s['mapW']:.0f}x{s['mapH']:.0f})")
                if name == "out":
                    d = await pg.evaluate(DOCK)
                    if d and s["pc"]:
                        ok(d["pos"] == "fixed" and d["left"] <= 20 and d["width"] <= 381 and all(k[0] <= 20 and k[2] <= 381 for k in d["kids"]),
                           f"{tag}: event and caravan cards docked at the left edge, <=380px wide ({d['left']:.0f}px, {d['width']:.0f}px wide, {len(d['kids'])} cards)")
                        ok(d["wevIn"], f"{tag}: the caravan strips sit in the same column")
                        ok(st.get("dockBlocks", 0) >= len(d["kids"]), f"{tag}: the map keeps names out from under the docked cards ({st.get('dockBlocks', 0)} areas)")
                    elif d:
                        ok(d["disp"] == "contents", f"{tag}: phone keeps the cards in the page under the map ({d['disp']})")
                if name == "z4_5":
                    if st.get("tileLevel"):   # with the tile pyramid the painting stays, sharp, from its top level, grain on
                        ok(st.get("tileLevel") == 2 and st.get("tiles", 0) > 0 and st.get("paintAlpha", 0) == 1 and st.get("ink", 1) == 0 and st.get("grain", 0) > 0,
                           f"{tag}: close up, the painting stays from its 8000 px tiles ({st.get('tiles')} tiles, grain {st.get('grain')})")
                    else:
                        ok(st.get("ink", 0) > 0.99 and st.get("paintAlpha", 1) == 0, f"{tag}: close up, the ink chart takes over from the painting")
            ok(not errs, f"{tag}: no page errors {errs[:2]}")
            await ctx.close()
        await b.close()
    print("\n" + (f"{len(fails)} FAILED" if fails else "mapvisuals_ui: all passed"))
    sys.exit(1 if fails else 0)

asyncio.run(main())
