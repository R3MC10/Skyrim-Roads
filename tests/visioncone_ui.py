# Cone of sight on the map (vision.js), in both art styles: you + a party member travelling, by day and in a night blizzard.
# python -m http.server 8851 --directory ../game &   then   python visioncone_ui.py 8851
import asyncio, sys, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8851"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_visioncone")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        errs = []; ok = True
        for style in ["ink", "pixel"]:
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            await ctx.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{style}'}}))")
            async def phone(tag, name):
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + " " + tag + " " + str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&assets&p=vc{style}{tag}"); await pg.wait_for_timeout(1800)
                await pg.wait_for_selector(".press", timeout=90000); await pg.wait_for_timeout(600); await pg.click(".press"); await pg.wait_for_timeout(400)
                await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
                await pg.add_style_tag(content="#toast,.toast,#hudlog,.pban{display:none!important}")   # keep popups off the screenshots
                await pg.evaluate("() => document.querySelectorAll('#modal,.modal').forEach(m => m.remove())")
                return pg
            A = await phone("a", "Watcher"); B = await phone("b", "Scout")
            async def env(pg, hour, wid):   # pin the clock and the weather so the shots are repeatable
                await pg.evaluate("""([h, w]) => { window.__clk = window.__clk || G.clock; window.__wx = window.__wx || WEVENTS.weather;
                  G.clock = (t) => ({ ...window.__clk(t), hour: h }); WEVENTS.weather = (p, t) => ({ ...window.__wx(p, t), id: w }); VISION.reset(); }""", [hour, wid])
            for pg in (A, B): await env(pg, 12, "clear")
            here = "() => { const S = window.__dbg.save(); S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun; S.trip = null; }"
            for pg in (A, B): await pg.evaluate(here)
            ida = await A.evaluate("window.__dbg.save().id"); idb = await B.evaluate("window.__dbg.save().id")
            await A.evaluate(f"() => Store.put('parties', 'vc{style}', {{ leader: '{ida}', leaderName: 'Watcher', members: [{{ id: '{ida}', name: 'Watcher' }}, {{ id: '{idb}', name: 'Scout' }}], invites: [], t: G.now() }})")
            await A.wait_for_timeout(1000)
            # A heads north for Dragon Bridge's road, B heads east to Windhelm: two cones pointing different ways
            await A.evaluate("() => { const S = window.__dbg.save(); S.location = null; G.startTrip(S, 'Morthal', WORLD.places.Morthal.slice(0, 2)); window.__dbg.publish(); }")
            await B.evaluate("() => { const S = window.__dbg.save(); S.location = null; G.startTrip(S, 'Windhelm', WORLD.places.Windhelm.slice(0, 2)); window.__dbg.publish(); }")
            seen = False
            for _ in range(12):
                await A.wait_for_timeout(700)
                await B.evaluate("() => window.__dbg.publish()")
                seen = await A.evaluate("() => !!window.__dbg.party() && (window.__dbg.view().cones || []).length >= 2")
                if seen: break
            info = await A.evaluate("() => { const v = window.__dbg.view(); return { cones: (v.cones || []).map(k => ({ a: k.c.a == null ? null : +k.c.a.toFixed(2), range: Math.round(k.c.range), faint: !!k.faint })) }; }")
            print(style, "cones:", info)
            ok = ok and seen and info["cones"][0]["a"] is not None
            # zoom in a bit so the cone fills the screen
            await A.evaluate("() => document.querySelectorAll('#modal,.modal').forEach(m => m.remove())")
            await A.click("#zoomBtn"); await A.wait_for_timeout(900)
            el = await A.query_selector("#mapwrap"); await el.screenshot(path=os.path.join(OUT, f"{style}_day.png"))
            # a night blizzard: the cone shrinks
            day_range = info["cones"][0]["range"]
            await env(A, 1, "blizzard")
            await A.wait_for_timeout(1200)
            r2 = await A.evaluate("() => Math.round(window.__dbg.view().cones[0].c.range)")
            print(style, "range day", day_range, "-> night blizzard", r2)
            ok = ok and r2 < day_range * 0.6
            el = await A.query_selector("#mapwrap"); await el.screenshot(path=os.path.join(OUT, f"{style}_night_blizzard.png"))
            await env(A, 12, "clear")
            # standing still keeps the last heading
            await A.evaluate("() => { const S = window.__dbg.save(); S.trip = null; }")
            await A.wait_for_timeout(800)
            still = await A.evaluate("() => window.__dbg.view().cones[0].c.a")
            print(style, "heading while standing still:", still)
            ok = ok and still is not None
            el = await A.query_selector("#mapwrap"); await el.screenshot(path=os.path.join(OUT, f"{style}_standing.png"))
            await ctx.close()
        print("errors:", errs)
        await b.close()
        if errs or not ok: print("visioncone FAILED"); sys.exit(1)
        print("visioncone ok")
asyncio.run(main())
