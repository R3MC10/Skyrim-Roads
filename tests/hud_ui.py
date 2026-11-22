import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=hud"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrolfdir"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        clear = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
        await pg.evaluate(clear)
        top = lambda name: pg.screenshot(path=f"hud/{name}.png", clip={"x":0,"y":0,"width":390,"height":844})
        # 1: standing in Riverwood, full bars (faded), quest marker on the compass
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='Riverwood'; [S.x,S.y]=WORLD.places.Riverwood; S.discovered.push('Bleak Falls Barrow','Whiterun','Riverwood');}")
        await pg.wait_for_timeout(1500); await pg.evaluate(clear); await top("1_idle")
        print("compass marks:", await pg.evaluate("document.querySelectorAll('#compass .cm').length"), "quest:", await pg.evaluate("!!document.querySelector('#compass .cm.quest')"), "dirs:", await pg.evaluate("[...document.querySelectorAll('#compass .cdir')].map(e=>e.textContent).join('')"))
        print("bars faded:", await pg.evaluate("[...document.querySelectorAll('.hb')].map(e=>e.className).join(' | ')"))
        # 2: travelling toward Whiterun (compass turns), low health, encumbered, bounty, rested
        await pg.evaluate("()=>{const S=window.__dbg.save(); G.startTrip(S,'Whiterun',WORLD.places.Whiterun.slice(0,2)); G.setHealth(S, 20); for(let i=0;i<30;i++) G.give(S,'iron_armor'); S.bounty={Whiterun:120}; S.rested=G.now()+600; S.restBonus=0.1;}")
        await pg.wait_for_timeout(2500); await pg.evaluate(clear); await top("2_travel")
        print("heading:", await pg.evaluate("Math.round(HUD.heading)"), "| status icons:", await pg.evaluate("[...document.querySelectorAll('.hstat .hs')].map(e=>e.getAttribute('aria-label')).join(', ')"), "| carry:", await pg.evaluate("document.querySelector('.hline .carry')?.textContent"))
        # 3: messages (Skyrim top-left log)
        for t in ["You picked up an Iron Sword.", "Smithing increased to 21", "You sell 3 Ruby for 147 gold."]:
            await pg.evaluate("t=>window.__dbg.toast(t)", t); await pg.wait_for_timeout(250)
        print("log lines:", await pg.evaluate("[...document.querySelectorAll('#hudlog > *')].map(e=>e.textContent.slice(0,30)).join(' | ')"))
        await pg.evaluate("()=>{ SOUND.fx('coin'); }")
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.gold+=250;}"); await pg.wait_for_timeout(1300)
        await top("3_gold")
        # tap a compass marker selects the place
        tapped = await pg.evaluate("(()=>{ const m=document.querySelector('#compass .cm[data-place]'); if(!m) return null; m.click(); return m.dataset.place; })()")
        await pg.wait_for_timeout(400)
        print("tapped compass:", tapped, "| picked shows:", await pg.evaluate("!document.querySelector('#picked').classList.contains('hide')"))
        await pg.evaluate("document.querySelector('[data-act=unpick]')?.click()")
        # 4: night + pixel style
        await pg.evaluate("()=>{ ART.setStyle('pixel'); document.documentElement.classList.add('art-pixel'); }")
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.trip=null; S.vampire={since:G.now(),fedAt:G.now()}; G.setHealth(S, G.maxHealth(S));}")
        await pg.wait_for_timeout(1500); await pg.evaluate(clear); await top("4_pixel")
        # 5: tabs
        await pg.click("[data-tab=hero]"); await pg.wait_for_timeout(400); await pg.evaluate(clear)
        await pg.screenshot(path="hud/5_tabs.png", clip={"x":0,"y":760,"width":390,"height":84})
        print("errors:", errs)
        await b.close()
asyncio.run(main())
