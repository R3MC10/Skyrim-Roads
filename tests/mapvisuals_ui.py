"""World map visuals screen test (map.js, inkmap.js, pcmap.js) with the painted map (?assets).
Wide PC windows 2000x810, 2560x1080, 3440x1440, 1920x1080 and a phone 390x844 at DPR 3; zoomed all the way out, then
close on Whiterun at three zoom levels. Checks:
- the canvas backing store is its CSS size x devicePixelRatio (sharp on every screen)
- zoomed out on a PC the map fills the window (no empty band beside it)
- no orphan gold bar: every world-event progress bar's own card is on top at the bar's spot (not hidden under the map)
- roads are drawn in the new hand-inked style
- the painting is never drawn bigger than ~1.3x its own pixels (past that the ink chart takes over)
Run:  py -m http.server 8765 --directory game   then   py tests/mapvisuals_ui.py 8765 [outdir]
Screenshots land in outdir (default: tests/out_mapvisuals)."""
import asyncio, os, sys
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_mapvisuals")
os.makedirs(OUT, exist_ok=True)
SIZES = [(2000, 810, 1), (2560, 1080, 1), (3440, 1440, 1), (1920, 1080, 1), (390, 844, 3)]
CLEAR = "document.querySelectorAll('#modal,#sky,#pbanners > *').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
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
            await pg.goto(url)
            try: await pg.wait_for_selector(".press", timeout=45000)
            except Exception: await pg.goto(url); await pg.wait_for_selector(".press", timeout=45000)
            await pg.wait_for_timeout(800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm", timeout=15000)
            await pg.fill("#nm", "Tester"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate(CLEAR); await pg.evaluate(TOWN, "Whiterun"); await pg.evaluate(CLEAR); await pg.wait_for_timeout(1200)
            mz = await pg.evaluate("()=>typeof PCMAP!=='undefined'&&PCMAP.on()?PCMAP.minZoomFor(document.getElementById('map')):1")
            for name, z in [("out", mz), ("z1_6", 1.6), ("z2_5", 2.5), ("z4_5", 4.5)]:
                await pg.evaluate("(z)=>__dbg.setView(z,[WORLD.places.Whiterun[0],WORLD.places.Whiterun[1]])", z)
                await pg.evaluate(CLEAR); await pg.wait_for_timeout(1400)
                await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"))
                s = await pg.evaluate(PROBE); st = s["stats"]
                ok(s["w"] == round(s["cw"] * s["dpr"]) and s["h"] == round(s["ch"] * s["dpr"]), f"{tag} {name}: canvas {s['w']}x{s['h']} = {s['cw']}x{s['ch']} x DPR {s['dpr']}")
                ok(st.get("roads") == "ink", f"{tag} {name}: roads drawn as hand-inked paths ({st.get('roads')})")
                ok(st.get("paintScale", 0) <= 1.3 + 1e-6, f"{tag} {name}: painting drawn at {st.get('paintScale', 0):.2f}x its pixels (max 1.3)")
                ok(all(x["inside"] for x in s["bars"]), f"{tag} {name}: no orphan gold bar ({len(s['bars'])} event bars, all on their cards)")
                if name == "out" and s["pc"]:
                    cw, ch = s["cw"] * s["dpr"], s["ch"] * s["dpr"]
                    ok(s["mapW"] * s["dpr"] >= cw - 2 and s["mapH"] * s["dpr"] >= ch - 2, f"{tag}: zoomed out, the map fills the window ({s['mapW']:.0f}x{s['mapH']:.0f})")
                if name == "z4_5":
                    ok(st.get("ink", 0) > 0.99 and st.get("paintAlpha", 1) == 0, f"{tag}: close up, the ink chart takes over from the painting")
            ok(not errs, f"{tag}: no page errors {errs[:2]}")
            await ctx.close()
        await b.close()
    print("\n" + (f"{len(fails)} FAILED" if fails else "mapvisuals_ui: all passed"))
    sys.exit(1 if fails else 0)

asyncio.run(main())
