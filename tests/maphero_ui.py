"""Map hero screen test (maphero.js): your character on the world map as a little figure instead of a dot,
standing, walking along a road, and sitting on a horse (standing / riding), plus another player on the map.
Both art styles, zoomed in and out, reduce motion, on a phone and a PC window.
Run:  python -m http.server 9560 --directory game   then   python tests/maphero_ui.py 9560 [outdir]
Screenshots land in outdir (default: maphero_shots in the temp folder). Fails on page errors or if the figure
isn't drawn (the map falls back to the old round token)."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9560"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "maphero_shots")
os.makedirs(OUT, exist_ok=True)
CLEAR = "document.querySelectorAll('#modal,#sky').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
PLACE = """(t)=>{ const S=__dbg.save(); S.location=null; [S.x,S.y]=WORLD.places[t]; for(const n of Object.keys(WORLD.places)) if(!S.discovered.includes(n)) S.discovered.push(n); __ui.go('map'); }"""
# count calls into the figure drawer, so we know the hero really is a figure
SPY = """()=>{ if (window.__mh) return; window.__mh={n:0, ride:0, walk:0, idle:0}; const d=HEROART.drawFigure;
  HEROART.drawFigure=function(g,c,x,y,o){ if (g.canvas && g.canvas.id==='map') { __mh.n++; if(o&&o.pose) __mh[o.pose]=(__mh[o.pose]||0)+1; } return d.apply(this, arguments); }; }"""
HORSE = "()=>{ const S=__dbg.save(); S.horse={name:'Shadow', breed:'nord', coat:'black', armor:'none', shoes:'none', bags:0, hp:100, hpT:G.now(), mounted:true}; }"
TRIP = "(to)=>{ const S=__dbg.save(); G.startTrip(S, to, WORLD.places[to].slice(0,2)); }"
HERE = """()=>{ const v=__dbg.view(), t=v.transform, r=document.getElementById('map').getBoundingClientRect(); return [r.left + v.player[0]*WorldMap.W*t.k + t.ox, r.top + v.player[1]*WorldMap.H*t.k + t.oy]; }"""
STOP = "()=>{ const S=__dbg.save(); S.trip=null; }"

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for tag, vw, vh, dsf in [("phone", 390, 844, 2), ("pc", 1280, 800, 1)]:
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dsf)
            errs = []
            async def player(pid, name, town):
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(pid + " " + str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p={pid}{tag}"); await pg.wait_for_timeout(1500)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                await pg.evaluate(CLEAR); await pg.evaluate(PLACE, town); await pg.evaluate(CLEAR)
                return pg
            A = await player("mh1", "R3MC10", "Whiterun")
            B = None
            if tag == "phone":   # a second player close by, to see other heroes as figures too
                B = await player("mh2", "Kacper", "Whiterun")
                await B.evaluate("()=>{ const S=__dbg.save(); S.x+=0.02; S.y+=0.012; __dbg.publish(); }")
                await A.bring_to_front(); await A.wait_for_timeout(31000)   # player cards refresh
                print(tag, "other heroes seen:", await A.evaluate("()=>__dbg.others().length"))
            await A.evaluate(SPY)

            async def shot(name):
                await A.evaluate(CLEAR); await A.wait_for_timeout(700)
                el = await A.query_selector("#mapwrap") or await A.query_selector("#map")
                await el.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"))
                # and a close-up around your hero
                x, y = await A.evaluate(HERE)
                await A.screenshot(path=os.path.join(OUT, f"{tag}_{name}_close.png"), clip={"x": max(0, x - 120), "y": max(0, y - 140), "width": 240, "height": 200})

            await shot("foot_idle")
            await A.evaluate(TRIP, "Riverwood"); await A.wait_for_timeout(1500); await shot("foot_walk")
            await A.evaluate(STOP); await A.wait_for_timeout(300)
            await A.evaluate(HORSE); await A.wait_for_timeout(600); await shot("horse_idle")
            await A.evaluate(TRIP, "Riverwood"); await A.wait_for_timeout(1500); await shot("horse_ride")
            await A.evaluate(STOP); await A.wait_for_timeout(300)
            await A.evaluate("()=>ART.setStyle('pixel')"); await A.wait_for_timeout(600); await shot("horse_pixel")
            await A.evaluate("()=>{ const S=__dbg.save(); S.horse.mounted=false; }"); await A.wait_for_timeout(600); await shot("foot_pixel")
            await A.evaluate("()=>ART.setStyle('ink')")
            await A.click("#zoomBtn"); await A.wait_for_timeout(500); await shot("foot_zoomed_out")
            mh = await A.evaluate("()=>window.__mh")
            print(tag, "figure draws:", mh)
            if not mh or mh.get("idle", 0) < 1: fails.append(f"{tag}: standing figure never drawn")
            if not mh or mh.get("walk", 0) < 1: fails.append(f"{tag}: walking figure never drawn")
            if not mh or mh.get("ride", 0) < 1: fails.append(f"{tag}: figure on a horse never drawn")
            if errs: fails.append(f"{tag}: page errors {errs[:4]}")
            await ctx.close()
        await b.close()
    print("screenshots in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("OK")

asyncio.run(main())
