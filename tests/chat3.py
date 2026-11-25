import asyncio, time
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844})
        pg = await ctx.new_page()
        await pg.goto("http://localhost:8765/index.html?net=bc&p=cc"); await pg.wait_for_timeout(2000)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Solo"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.click("[data-tab=log]"); await pg.wait_for_timeout(300)
        print("online:", await pg.evaluate("Store.online"), "has chat:", await pg.query_selector("#chatlog") is not None)
        r = await pg.evaluate("""() => { const q=[...document.querySelectorAll('[data-act=chatq]')]; q[0].click(); const t1=document.querySelector('#toast')?.textContent; document.querySelectorAll('[data-act=chatq]')[1].click(); return [t1, document.querySelector('#toast')?.textContent, document.querySelectorAll('#chatlog .cm').length]; }""")
        print(r)
        await b.close()
asyncio.run(main())
