"""Lighting and atmosphere (lightfx.js): before/after phone screenshots of the map at dawn, noon, dusk, night and in a
storm, in both art styles, plus a few place pictures; then idle map frame time with Lighting Off / Low / High under
a 4x CPU throttle.
   node serve.js 8765 &
   python3 lightfx_ui.py 8765            # screenshots go to tests/out_light/
   python3 lightfx_ui.py 8765 noperf     # skip the timing part (noshots: timing only)
"""
import asyncio, sys, json, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
PERF = "noperf" not in sys.argv
SHOTS = "noshots" not in sys.argv
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_light") + os.sep
os.makedirs(OUT, exist_ok=True)
CHROME = (__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None))
SCENES = [("dawn", 6.4, "clear"), ("noon", 13.0, "clear"), ("dusk", 19.0, "clear"), ("night", 23.5, "clear"), ("storm", 14.0, "storm")]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME and os.path.exists(CHROME) else {}), args=["--no-sandbox"] + (os.environ.get("LFX_ARGS", "").split() if os.environ.get("LFX_ARGS") else []))
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=lightfx"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Lumen"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
          for(const n of Object.keys(WORLD.places)) if(!S.discovered.includes(n)) S.discovered.push(n);
          window.__clk=G.clock; window.__wx=WEVENTS.weather;
          const st=document.createElement('style'); st.textContent='.pban,#toast{display:none!important}'; document.head.appendChild(st); }""")
        async def clear():
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def setup(style, hour, wx, lvl):
            await pg.evaluate("""([st,h,w,l])=>{ LIGHTFX.setLevel(l);
              G.clock=(t)=>({day:7,hour:h}); WEVENTS.weather=(p,t)=>({...window.__wx(p,t), id:w}); }""", [style, hour, wx, lvl])
        async def shot(name):
            await clear(); await pg.wait_for_timeout(450)
            el = await pg.query_selector("#mapwrap") or await pg.query_selector("#map")
            await el.screenshot(path=OUT + name + ".png")
        if SHOTS:
            # ---- map: before (Lighting Off) and after (High), every time of day, both styles
            for style in ["ink"]:
                for name, hour, wx in SCENES:
                    for lvl, tag in [("off", "before"), ("high", "after")]:
                        await setup(style, hour, wx, lvl)
                        await shot(f"map_{style}_{name}_{tag}")
            # zoomed out over all of Skyrim at night: every lit town, the aurora over the north
            await pg.click("#zoomBtn"); await pg.wait_for_timeout(400)
            for style in ["ink"]:
                for lvl, tag in [("off", "before"), ("high", "after")]:
                    await setup(style, 23.5, "clear", lvl); await shot(f"mapfar_{style}_night_{tag}")
                await setup(style, 6.4, "clear", "high"); await shot(f"mapfar_{style}_dawn_after")
            await pg.click("#zoomBtn"); await pg.wait_for_timeout(300)
            # Low, reduce motion and high contrast still draw (and without errors)
            await setup("ink", 19.0, "clear", "low"); await shot("map_ink_dusk_low")
            await pg.evaluate("()=>document.documentElement.classList.add('a11y-hc')"); await setup("ink", 23.5, "clear", "high"); await shot("map_ink_night_hc")
            await pg.evaluate("()=>document.documentElement.classList.remove('a11y-hc')")
            # ---- place pictures, before/after
            await pg.evaluate("""()=>{ G.clock=window.__clk; WEVENTS.weather=window.__wx; }""")
            html = await pg.evaluate("""()=>{ const out=[]; for (const st of ['ink']) for (const [n,tod,w] of [['Whiterun','dusk','clear'],['Riverwood','night','clear'],['Winterhold','night','clear'],['Solitude','dawn','clear'],['Markarth','day','storm']]) for (const l of ['off','high']) {
                LIGHTFX.setLevel(l); out.push(`<figure style="margin:2px;display:inline-block"><figcaption style="font:11px sans-serif;color:#eee">${st} ${n} ${tod} ${w} ${l==='off'?'before':'after'}</figcaption>${PLACEART.scene(n,{tod,weather:w})}</figure>`); }
              return out.join(''); }""")
            pp = await ctx.new_page(); await pp.set_viewport_size({"width": 760, "height": 1800})
            await pp.set_content(f"<body style='background:#222;margin:0'>{html}</body>"); await pp.wait_for_timeout(300)
            await pp.screenshot(path=OUT + "places_before_after.png", full_page=True); await pp.close()
        # settings row is there (Graphics → Lighting)
        await pg.evaluate("()=>{ LIGHTFX.setLevel('high'); }")
        ok = await pg.evaluate("()=>{ const d=document.createElement('div'); d.innerHTML=LIGHTFX.settingsHTML((k,o,c)=>o.map(([v,l])=>`<button data-k=\"${k}\" data-v=\"${v}\" class=\"${String(c)===v?'on':''}\">${l}</button>`).join('')); return d.querySelectorAll('[data-k=lighting]').length===3 && d.querySelector('.on').dataset.v==='high'; }")
        assert ok, "settings row"
        res = {}
        if PERF:
            # ---- idle frame time (nothing moving: the map redraws at 8 fps), CPU throttled 4x like a mid phone.
            #   js:    time spent in WorldMap.draw (the canvas paints later, on the GPU on phones)
            #   flush: plus a 1-pixel read after each draw, which forces the painting to finish on the CPU
            #          (this also makes Chrome move the canvas off the GPU, so it is a worst case; run it last)
            cdp = await ctx.new_cdp_session(pg)
            await pg.evaluate("""()=>{ G.clock=(t)=>({day:7,hour:19.0}); WEVENTS.weather=(p,t)=>({...window.__wx(p,t), id:'clear'});
              window.__mt=[]; window.__flush=false; const o=WorldMap.draw; WorldMap.draw=(c,v)=>{ const t=performance.now(); o(c,v); if (window.__flush) c.getContext('2d').getImageData(0,0,1,1); window.__mt.push(performance.now()-t); }; }""")
            await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
            for mode in ["js", "flush"]:
                await pg.evaluate("(f)=>{ window.__flush=f; }", mode == "flush")
                for rnd in range(2):
                    for lvl in ["off", "low", "high"]:
                        await pg.evaluate("(l)=>{ LIGHTFX.setLevel(l); }", lvl); await clear(); await pg.wait_for_timeout(1500)
                        await pg.evaluate("()=>{ window.__mt=[]; }"); await pg.wait_for_timeout(6000)
                        mt = sorted(await pg.evaluate("window.__mt.slice(2)")); n = len(mt)
                        if n: res.setdefault(mode, {}).setdefault(lvl, []).append({"frames": n, "median": round(mt[n // 2], 2), "p90": round(mt[int(n * 0.9)], 2)})
            await cdp.send("Emulation.setCPUThrottlingRate", {"rate": 1})
        print(json.dumps(res)); print("errors:", errs)
        await b.close()
        assert not errs, errs

asyncio.run(main())
