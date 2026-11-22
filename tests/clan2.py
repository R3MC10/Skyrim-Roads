import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        async def clear(pg):
            for _ in range(6):
                if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
                elif await pg.query_selector("#modal"): await pg.evaluate("document.querySelector('#modal').remove()")
                else: break
        async def phone(tag, name):
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(tag + " " + str(e)))
            await pg.goto(f"http://localhost:8765/index.html?net=bc&notut&p={tag}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(4000)
            await clear(pg); return pg
        async def log(pg):
            await clear(pg); await pg.click("[data-tab=map]"); await pg.click("[data-tab=log]"); await pg.wait_for_timeout(300)
        A = await phone("ca1", "Alfa"); B = await phone("cb1", "Beta")
        await log(A)
        await A.fill("#clanname", "Sons of the North"); await A.fill("#clantag", "sotn")
        await A.click("[data-act=clancol][data-i='0'][data-id='#1f4e79']"); await A.wait_for_timeout(200)
        print("draft kept:", await A.input_value("#clanname"))
        await A.click("[data-act=clanfound]"); await A.wait_for_timeout(500)
        print("A toast:", await A.evaluate("document.querySelector('#toast')?.textContent"))
        await log(A); await A.click("[data-act=claninv] >> nth=0"); await A.wait_for_timeout(600)
        print("B toast:", await B.evaluate("document.querySelector('#toast')?.textContent"))
        await log(B); await B.click("[data-act=clanjoin]"); await B.wait_for_timeout(800)
        await log(A); t = await A.inner_text("#side"); i = t.find("MEMBERS"); print("A members:", t[i:i+80].replace("\n"," | "))
        # clan chat
        await B.click("[data-act=chatch][data-id=clan]"); await B.wait_for_timeout(200); await B.fill("#chatin", "For the clan!"); await B.click("[data-act=chatsend]"); await B.wait_for_timeout(700)
        print("A toast:", await A.evaluate("document.querySelector('#toast')?.textContent"))
        await log(A); await A.click("[data-act=chatch][data-id=clan]"); await A.wait_for_timeout(200); print("A clan chat:", (await A.inner_text("#chatlog")).replace("\n"," | "))
        await A.screenshot(path="clan_A.png", full_page=True)
        # house + banner: give A a house in Riften
        await A.evaluate("()=>{const S=window.__dbg.save(); S.homes={Riften:{chest:[],garden:0}}; S.discovered.push('Riften'); S.location='Riften'; [S.x,S.y]=WORLD.places.Riften;}")
        await A.wait_for_timeout(31000)
        await clear(A); await A.click("[data-tab=map]"); await A.evaluate("scrollTo(0,0)"); await A.wait_for_timeout(800)
        await A.screenshot(path="clan_map.png", clip={"x":0,"y":120,"width":390,"height":480})
        print("B card tag seen by A:", await A.evaluate("(document.querySelector('#side').innerText.match(/\\[SOTN\\]/)||[''])[0]"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
