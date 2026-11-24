import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs=[]
        pg = await b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html?p=ui1"); await pg.wait_for_timeout(2500)
        await pg.fill("#nm","Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await pg.evaluate("() => { const S=window.__dbg.save(); for (const i of ['steel_sword','iron_sword_flames','hunting_bow','steel_armor','ench|iron_helmet|health|20|0','potion_health','scroll_fireball','tome_firebolt','ing_wheat','mat_steel','soul_gem_common','golden_claw']) G.give(S,i); S.spells.push('firebolt','healing'); S.words=['FUS','RO']; S.unlocked=['FUS']; S.souls=1; }")
        await pg.click("[data-tab=pack]"); await pg.wait_for_timeout(300)
        await pg.click(".sky-row >> nth=2"); await pg.wait_for_timeout(200)
        await pg.screenshot(path="/home/claude/tests/ui_items.png")
        await pg.click("[data-act=skycat][data-id=weapons]"); await pg.click("[data-act=skysort][data-id=stat]"); await pg.wait_for_timeout(200)
        await pg.screenshot(path="/home/claude/tests/ui_weapons.png")
        await pg.click("[data-act=skytab][data-id=magic]"); await pg.click(".sky-row >> nth=1"); await pg.wait_for_timeout(200)
        await pg.screenshot(path="/home/claude/tests/ui_magic.png")
        await pg.click("[data-act=skytab][data-id=skills]"); await pg.click(".sky-row >> nth=0"); await pg.wait_for_timeout(200)
        await pg.screenshot(path="/home/claude/tests/ui_skills.png")
        await pg.click("[data-act=skyclose]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(300)
        await pg.screenshot(path="/home/claude/tests/ui_town.png")
        print(await pg.evaluate("JSON.stringify(G.loadout(window.__dbg.save()).rules[0])"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
