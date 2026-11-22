import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def phone(tag, name, code=None):
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:8765/index.html?net=bc&p={tag}"); await pg.wait_for_timeout(2500)
            await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1200)
            return pg
        A = await phone("a", "Alfa")
        code = await A.evaluate("Store.worldCode")
        B = await phone("b", "Beta", code)
        await A.wait_for_timeout(2000)
        for pg in (A, B):
            await pg.click("[data-tab=log]"); await pg.wait_for_timeout(300)
        print("code", code, "A peers", await A.evaluate("Store.peers"), "B peers", await B.evaluate("Store.peers"))
        await A.screenshot(path="/home/claude/tests/p2p_A.png", full_page=True)
        # A attacks B (same place Riverwood)
        await A.click("[data-tab=log]"); await A.wait_for_timeout(300)
        await A.click("[data-act=attack] >> nth=0"); await A.wait_for_timeout(300)
        t = await A.inner_text("#modal h2")
        await A.click("[data-act=close]")
        await B.wait_for_timeout(1200)
        await B.screenshot(path='/home/claude/tests/p2p_B.png')
        bm = await B.evaluate("document.querySelector('#modal') ? document.querySelector('#modal').innerText.slice(0,160) : 'no modal'")
        print("A result:", t, "| B sees:", bm)
        await B.click("[data-act=close]") if await B.query_selector("#modal [data-act=close]") else None
        # A invites B; B accepts
        await A.click("[data-act=invite] >> nth=0"); await A.wait_for_timeout(600)
        await B.click("[data-tab=log]"); await B.wait_for_timeout(300)
        await B.click("[data-act=accept]"); await B.wait_for_timeout(600)
        await A.click("[data-tab=map]"); await A.click("[data-tab=log]"); await A.wait_for_timeout(300)
        t_=await A.inner_text("#side"); print("party on A:", t_[t_.find("Party"):t_.find("Party")+260].replace("\n"," | "))
        # news synced?
        print("news on B:", await B.evaluate("Object.values((JSON.parse(localStorage.getItem('bsk.w.'+Store.worldCode))||{}).news||{}).map(n=>n.text)"))
        # B goes offline -> A shouldn't list B
        await B.close(); await A.wait_for_timeout(800)
        await A.click("[data-tab=map]"); await A.click("[data-tab=log]"); await A.wait_for_timeout(300)
        print("A peers after B left:", await A.evaluate("Store.peers"), "| travellers listed:", await A.evaluate("document.querySelectorAll('[data-act=attack],[data-act=invite]').length"))
        # C joins later and gets world copy from A
        C = await phone("c", "Cyra", code); await C.wait_for_timeout(1500)
        print("C got news:", await C.evaluate("Object.keys((JSON.parse(localStorage.getItem('csk.w.'+Store.worldCode))||{}).news||{}).length"), "C peers", await C.evaluate("Store.peers"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
