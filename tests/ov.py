import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844})
        await pg.add_init_script(path="/home/claude/tests/fakedb.js")
        await pg.goto("http://localhost:8765/index.html"); await pg.wait_for_timeout(3000)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        for t in ["map","hero","town","log","pack"]:
            await pg.click(f"[data-tab={t}]"); await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => { const out=[]; document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect(); if(r.right>392 && r.width>0 && !e.closest('.mapwrap')) out.push(e.tagName+'.'+e.className+' '+Math.round(r.right))}); return [document.documentElement.scrollWidth, out.slice(0,6)]; }""")
            print(t, r)
        await b.close()
asyncio.run(main())
