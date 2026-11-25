import asyncio
from playwright.async_api import async_playwright
exec(open('perf.py').read().split('async def main')[0])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html?p=jn1&net=bc&notut"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(3000)
        for _ in range(5):
            if await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
        await pg.evaluate(SEED)
        await pg.click("[data-tab=log]"); await pg.wait_for_timeout(600)
        print("menu:", await pg.evaluate("[...document.querySelectorAll('.jnav .chip')].map(b=>b.textContent).join(' · ')"))
        await pg.click(".jnav [data-id=ladder]"); await pg.wait_for_timeout(900)
        print("leaderboard on screen:", await pg.evaluate("Math.round(document.querySelector('#j-ladder').getBoundingClientRect().top)"), "| nav stuck at:", await pg.evaluate("Math.round(document.querySelector('.jnav').getBoundingClientRect().top)"))
        await pg.screenshot(path="jnav.png")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
