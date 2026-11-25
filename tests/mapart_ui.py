import asyncio, sys, json
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8779"
OUT = _SHOTS + "vmap/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def clear(pg): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def phone(tag, name, town):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p={tag}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            await pg.evaluate("(t)=>{const S=window.__dbg.save(); S.location=t; [S.x,S.y]=WORLD.places[t]; for(const n of Object.keys(WORLD.places)) if(!S.discovered.includes(n)) S.discovered.push(n);}", town)
            await clear(pg); return pg
        async def shot(pg, name):
            await clear(pg); await pg.wait_for_timeout(500)
            el = await pg.query_selector("#mapwrap"); await el.screenshot(path=OUT + name + ".png")
        A = await phone("ma1", "Alfa", "Whiterun")
        B = await phone("ma2", "Beta", "Riverwood")
        await A.wait_for_timeout(31000)   # player cards refresh
        await A.bring_to_front()
        await shot(A, "day_near")
        await A.click("#zoomBtn"); await A.wait_for_timeout(500); await shot(A, "day_far"); await A.click("#zoomBtn"); await A.wait_for_timeout(300)
        # travelling to Riften
        await A.evaluate("()=>{ const S=window.__dbg.save(); G.startTrip(S,'Riften',WORLD.places.Riften.slice(0,2)); }")
        await A.wait_for_timeout(1500); await shot(A, "travel")
        # riding
        await A.evaluate("()=>{ const S=window.__dbg.save(); S.horse={name:'Shadow', coat: HORSES.coat('black')[0], armor:'none', hp:100, hpT:G.now(), mounted:true}; }")
        await A.wait_for_timeout(800); await shot(A, "riding")
        # night
        await A.evaluate("()=>{ window.__clk=G.clock; G.clock=(t)=>({day:3,hour:23}); }")
        await A.wait_for_timeout(800); await shot(A, "night")
        await A.evaluate("()=>{ G.clock=(t)=>({day:3,hour:19.2}); }"); await A.wait_for_timeout(600); await shot(A, "dusk")
        await A.evaluate("()=>{ G.clock=window.__clk; }")
        # discovery burst
        await A.evaluate("()=>{ const S=window.__dbg.save(); const n=S.discovered.pop(); setTimeout(()=>S.discovered.push(n), 300); }")
        await A.wait_for_timeout(900); await shot(A, "burst")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
