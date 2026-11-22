import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html?p=fz1"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Riften'; [S.x,S.y]=WORLD.places.Riften; S.gold=500; S.discovered.push('Riften'); G.shopsOpen=()=>true;}")
        await pg.wait_for_timeout(4000)
        async def clear():
            for _ in range(6):
                if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
                elif await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
                else: break
        await clear()
        await pg.click("[data-tab=town]"); await pg.click("[data-id=general]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=buy][data-item=fishing_rod]"); await pg.wait_for_timeout(200)
        print("rod:", await pg.evaluate("window.__dbg.save().inv.some(r=>r.item==='fishing_rod')"))
        await pg.evaluate("()=>{const S=window.__dbg.save(); if(!S.inv.some(r=>r.item==='fishing_rod')) G.give(S,'fishing_rod');}")
        await pg.click("[data-id=fish]"); await pg.wait_for_timeout(200)
        print("fish card:", await pg.inner_text("#side .item"), await pg.evaluate("JSON.stringify(COOK.canFish(window.__dbg.save(), [window.__dbg.save().x, window.__dbg.save().y]))"), await pg.evaluate("JSON.stringify(window.__dbg.save().trip)"))
        caught = 0
        for attempt in range(4):
            await pg.click("[data-act=fishgo]"); 
            await pg.wait_for_selector("#fishneedle", timeout=8000)
            if attempt == 0: await pg.wait_for_timeout(250); await pg.screenshot(path="fish_bite.png")
            # wait until the needle is inside the zone, then tap
            for _ in range(200):
                inside = await pg.evaluate("()=>{const n=document.querySelector('#fishneedle'), z=document.querySelector('.fishbar .zone'); if(!n||!z) return false; const nl=parseFloat(n.style.left), zl=parseFloat(z.style.left), zw=parseFloat(z.style.width); return nl>zl+zw*0.3 && nl<zl+zw*0.7;}")
                if inside: break
                await pg.wait_for_timeout(15)
            await pg.click("[data-act=fishreel]"); await pg.wait_for_timeout(200)
            msg = await pg.inner_text("#fishmsg"); print("try", attempt, msg)
            caught += "land" in msg
            await pg.click("[data-act=fishstop]"); await pg.wait_for_timeout(200)
        # too-soon reel
        await pg.click("[data-act=fishgo]"); await pg.wait_for_timeout(200); await pg.click("[data-act=fishreel]"); print("early:", await pg.inner_text("#fishmsg")); await pg.click("[data-act=fishstop]")
        # cook at the inn
        await pg.evaluate("()=>{const S=window.__dbg.save(); G.give(S,'food_potato'); G.give(S,'food_salt'); G.give(S,'fish_salmon',2);}")
        await pg.click("[data-id=cook]"); await pg.wait_for_timeout(200)
        await pg.click("[data-act=cook][data-id=fish_stew]"); await pg.wait_for_timeout(200)
        print("cooked:", await pg.evaluate("document.querySelector('#toast')?.textContent"))
        await clear(); el = await pg.query_selector("#side"); await el.screenshot(path="cook_pot.png")
        await pg.click("[data-tab=pack]"); await pg.wait_for_timeout(300)
        await pg.click(".sky [data-cat=food], [data-act=skycat][data-id=food]"); await pg.wait_for_timeout(200)
        print("food tab rows:", await pg.evaluate("[...document.querySelectorAll('#sky .sky-row, #sky [data-act=skysel]')].map(e=>e.innerText.split('\\n')[0]).slice(0,8)"))
        print("caught", caught, "errors:", errs)
        await b.close()
asyncio.run(main())
