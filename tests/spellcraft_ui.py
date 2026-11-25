import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8789"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def click(sel):
            for _ in range(8):
                await clear()
                try: await pg.click(sel, timeout=2500); return
                except Exception: await pg.wait_for_timeout(300)
            await pg.click(sel, timeout=3000)
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=sc"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Crafty"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Winterhold'; [S.x,S.y]=WORLD.places.Winterhold; S.discovered.push('Winterhold'); S.gold=20000;
          for(const k of ['Destruction','Restoration','Alteration','Illusion']) S.skills[k].lvl=60;
          for(const x of ['firebolt','ice_spike','healing','lesser_ward','flame_cloak','paralyze']) if(D.SPELLS[x] && !S.spells.includes(x)) S.spells.push(x);}""")
        for style in ["ink"]:
            await click("[data-tab=world]"); await click("[data-tab=town]"); await pg.wait_for_timeout(300)
            await click("[data-act=shop][data-id=craft]"); await pg.wait_for_timeout(300)
            await pg.select_option("#cfA", "damage:fire"); await pg.wait_for_timeout(300)
            await pg.select_option("#cfB", "damage:frost" if style == "ink" else "heal"); await pg.wait_for_timeout(300)
            await pg.fill("#cfName", "Fire and Ice" if style == "ink" else "Burning Mend")
            await pg.evaluate("()=>{const r=document.querySelector('#cfAm'); if(r){ r.value=Math.round(r.max*0.7); r.dispatchEvent(new Event('input',{bubbles:true})); }}")
            await pg.wait_for_timeout(200)
            print(style, "preview:", (await pg.inner_text("#cfPrev")).replace("\n", " | ")[:160])
            el = await pg.query_selector("#side"); await el.screenshot(path=f"sc_craft_{style}.png")
            g0 = await pg.evaluate("window.__dbg.save().gold")
            await click("[data-act=craftgo]"); await pg.wait_for_timeout(400)
            print(style, "crafted:", await pg.evaluate("JSON.stringify((window.__dbg.save().customSpells||[]).map(c=>[c.name,c.school,c.level]))"), "gold", g0, "->", await pg.evaluate("window.__dbg.save().gold"))
        # magic menu shows it with an icon
        await clear(); await pg.evaluate("__ui.go('items')"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelector('[data-act=skytab][data-id=magic]')?.click()"); await pg.wait_for_timeout(400)
        txt = await pg.evaluate("document.querySelector('#sky')?.innerText||''")
        print("magic menu lists it:", "Fire and Ice" in txt, "Burning Mend" in txt)
        await pg.screenshot(path="sc_magic.png")
        await pg.evaluate("document.querySelector('#sky')?.remove()")
        print("errors:", errs)
        await b.close()
asyncio.run(main())
