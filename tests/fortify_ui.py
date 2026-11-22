import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html?net=bc&notut&p=fo"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Fori"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        print(await pg.evaluate("""()=>{const S=window.__dbg.save(); const a=G.give(S,'ench|hide_bracers|onehanded|12|0'); const b=G.give(S,'ench|leather_boots|sneak|12|0'); return [G.equip(S,a), G.equip(S,b), G.skill(S,'Sneak'), S.skills.Sneak.lvl, G.fxSum(S,'dmg:One-Handed')]}"""))
        for _ in range(4):
            if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(200)
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(500)
        txt = await pg.inner_text("#side")
        import re
        for m in re.finditer("(One-Handed|Sneak)", txt): print(repr(txt[m.start():m.start()+60]))
        for k in []:
            i = txt.find(k); print(k, "→", txt[i:i+90].replace("\n"," | ") if i>=0 else None)
        el = await pg.query_selector("text=Active effects")
        await pg.screenshot(path="fortify_hero.png", full_page=True)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
