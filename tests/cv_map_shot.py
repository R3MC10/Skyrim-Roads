import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await (await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)).new_page()
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8785/index.html?net=bc&notut&p=cm"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Mapper"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        c = await pg.evaluate("(()=>{const S=window.__dbg.save(); const c=CARAVANS.all().find(x=>x.phase==='road')||CARAVANS.all()[0]; const p=CARAVANS.pos(c); S.location=null; S.x=p[0]+0.01; S.y=p[1]; S.gold=3000; S.location='Whiterun'; HORSES.buy(S,'Bess','bay'); CARAVANS.buyCart(S); S.location=null; S.x=p[0]+0.012; S.y=p[1]+0.004; return c.line.name})()")
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        await pg.click("#zoomBtn"); await pg.wait_for_timeout(1500)
        el = await pg.query_selector("#mapwrap"); await el.screenshot(path="cv_mapzoom.png")
        print(c, errs)
        await b.close()
asyncio.run(main())
