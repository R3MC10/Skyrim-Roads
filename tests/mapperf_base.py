import asyncio, sys, json
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8779"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=perf"+ (("&off="+sys.argv[2]) if len(sys.argv)>2 else "")); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Perf"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); for(const n of Object.keys(WORLD.places)) if(!S.discovered.includes(n)) S.discovered.push(n);
          const off=(new URLSearchParams(location.search)).get('off'); 
          window.__mt=[]; const o=WorldMap.draw; WorldMap.draw=(c,v)=>{ const t=performance.now(); o(c,v); window.__mt.push(performance.now()-t); }; }""")
        res = {}
        for label, clicks in [("far", 0), ("zoom", 1)]:
            for _ in range(clicks): await pg.click("#zoomBtn"); await pg.wait_for_timeout(300)
            # start a trip so the map keeps redrawing
            await pg.evaluate("()=>{ const S=window.__dbg.save(); window.__mt=[]; }")
            await pg.evaluate("()=>{ document.querySelector('[data-act=go]')?.click(); }")
            await pg.wait_for_timeout(4000)
            mt = await pg.evaluate("window.__mt.slice(3)")
            mt.sort(); n=len(mt)
            res[label] = {"frames": n, "median": round(mt[n//2],2) if n else None, "p90": round(mt[int(n*0.9)],2) if n else None}
        print(json.dumps(res)); print("errors:", errs)
        await b.close()
asyncio.run(main())
