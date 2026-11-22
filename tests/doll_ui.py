import asyncio, sys, base64
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8784"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        async def nomodal(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        async def click(sel):
            for _ in range(8):
                await nomodal()
                try: await pg.click(sel, timeout=2500); return
                except Exception: await pg.wait_for_timeout(300)
            await pg.click(sel, timeout=3000)
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=doll"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.wait_for_timeout(400)
        for race in ["khajiit", "argonian", "altmer", "orc"]:
            await pg.click(f".rpick[data-race={race}]"); await pg.wait_for_timeout(200)
            print("showcase", race, (await pg.inner_text(".rshow"))[:70].replace("\n", " | "))
        await pg.screenshot(path="doll_create.png", full_page=True)
        await pg.click(".rpick[data-race=nord]"); await pg.fill("#nm", "Dolly"); await pg.click("#begin"); await pg.wait_for_timeout(1200)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); for (const i of ['steel_sword','steel_armor','steel_helmet','iron_shield','iron_greatsword','hunting_bow','leather_boots','iron_gauntlets']) G.give(S,i); G.give(S,'arrow_iron',20);}""")
        for style in ["ink", "pixel"]:
            await pg.evaluate(f"ART.setStyle('{style}')")
            await pg.evaluate("()=>{const S=window.__dbg.save(); for (const sl of G.SLOTS) G.unequip(S, sl);}")
            await pg.evaluate("document.querySelector('#sky')?.remove()")
            await click("[data-tab=pack]"); await pg.wait_for_timeout(300)
            print(style, "doll in menu:", await pg.evaluate("!!document.querySelector('#sky .doll')"))
            await click("[data-act=dollslot][data-slot=weapon]"); await pg.wait_for_timeout(250)
            print(style, "picker:", (await pg.inner_text("#modal"))[:160].replace("\n", " | "))
            await pg.screenshot(path=f"doll_picker_{style}.png")
            sid = await pg.evaluate("String(window.__dbg.save().inv.find(r=>r.item==='steel_sword').id)")
            await pg.click(f"#modal [data-act=dolleq][data-id='{sid}']"); await pg.wait_for_timeout(250)
            for slot, item in [["chest", "steel_armor"], ["head", "steel_helmet"], ["shield", "iron_shield"], ["feet", "leather_boots"], ["hands", "iron_gauntlets"]]:
                await click(f"[data-act=dollslot][data-slot={slot}]"); await pg.wait_for_timeout(150)
                rid = await pg.evaluate(f"String(window.__dbg.save().inv.find(r=>r.item==='{item}').id)")
                await pg.click(f"#modal [data-act=dolleq][data-id='{rid}']"); await pg.wait_for_timeout(150)
            eq = await pg.evaluate("Object.fromEntries(Object.entries(G.equipment(window.__dbg.save())).map(([k,r])=>[k,r.item]))")
            print(style, "equipped:", eq)
            await nomodal(); await pg.wait_for_timeout(150)
            await pg.screenshot(path=f"doll_pack_{style}.png")
            # unequip shield
            await click("[data-act=dollslot][data-slot=shield]"); await pg.wait_for_timeout(150)
            await pg.click("#modal .evc [data-act=dolloff]"); await pg.wait_for_timeout(150)
            print(style, "shield after take off:", await pg.evaluate("!!G.equipment(window.__dbg.save()).shield"))
        # loadouts: save as Archer, switch, thumbnails
        await pg.evaluate("()=>{const S=window.__dbg.save(); G.saveLoadoutAs(S,'Archer'); S.loadout='Archer'; G.equip(S, S.inv.find(r=>r.item==='hunting_bow').id); S.loadout='Main';}")
        await pg.evaluate("document.querySelector('#sky')?.remove()")
        await click("[data-tab=hero]"); await pg.wait_for_timeout(250); await click("[data-act=tabgo][data-id=tactics]"); await pg.wait_for_timeout(250)
        print("loadout chips:", await pg.evaluate("[...document.querySelectorAll('.lochip')].map(b=>b.textContent.trim()+':'+!!b.querySelector('img')).join(' ')"))
        await click(".lochip[data-name=Archer]"); await pg.wait_for_timeout(250)
        print("now", await pg.evaluate("window.__dbg.save().loadout"), "weapon", await pg.evaluate("G.equipment(window.__dbg.save()).weapon?.item"))
        ch = await pg.evaluate("(()=>{const d=document.querySelector('.lochip'); return d? d.closest('.panel').getBoundingClientRect().toJSON():null})()")
        if ch: await pg.screenshot(path="doll_loadouts.png", clip={"x": 0, "y": max(0, ch["y"]), "width": 390, "height": 200})
        print("errors:", errs)
        await b.close()
asyncio.run(main())
