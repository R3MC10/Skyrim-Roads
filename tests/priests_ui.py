import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8798"
# Dragon priests: enter Shearpoint, beat Krosis with boosted stats, the mask in the Pack/doll and on the hero, the Journal quest
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        for style in ["ink"]:
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(style + ": " + str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=mask{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Masked"); await pg.click("#begin"); await pg.wait_for_timeout(900)
            async def clear():
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelector('#sky')?.remove()")
            async def click(sel):
                for _ in range(4):
                    await clear()
                    try: await pg.click(sel, timeout=2500); return
                    except Exception: await pg.wait_for_timeout(200)
                await pg.click(sel, timeout=3000)
            await pg.evaluate("(st)=>{ const S=window.__dbg.save(); const n='Shearpoint'; S.location=n; [S.x,S.y]=WORLD.places[n]; S.discovered.push(n); S.cleared={}; S.level=35; S.hpBonus=4000; for(const k of Object.keys(S.skills)) S.skills[k].lvl=90; G.give(S,'potion_health',5); const w=G.give(S,'steel_sword'); G.equip(S,w); G.setHealth(S,G.maxHealth(S)); QUESTS.ensure(S); }", style)
            await pg.wait_for_timeout(300)
            await click("[data-tab=hero]"); await click("[data-tab=map]"); await pg.wait_for_timeout(400)
            await click("[data-act=enter]"); await pg.wait_for_timeout(500)
            print(style, "boss:", await pg.evaluate("window.__dbg.save().dungeon?.boss"))
            await clear()
            node = await pg.query_selector("#dun .dnode")
            await node.click(); await pg.wait_for_timeout(400)
            print(style, "room:", await pg.evaluate("window.__dbg.save().dungeon?.room?.enemy?.name"))
            await pg.evaluate("()=>{ const e=window.__dbg.save().dungeon.room.enemy; e.health=e.hp=260; }")   # a short fight for the test
            await clear(); await pg.screenshot(path=f"pr_{style}_boss.png")
            await click("#dun [data-act=dact]")
            await pg.wait_for_timeout(900); await pg.screenshot(path=f"pr_{style}_fight.png")
            await pg.wait_for_timeout(2500); await pg.screenshot(path=f"pr_{style}_fight2.png")
            print(style, "cleared:", await pg.evaluate("!!window.__dbg.save().dungeon?.done"), "| masks:", await pg.evaluate("window.__dbg.save().inv.filter(r=>D.ITEMS[r.item].mask).map(r=>r.item).join(',')"))
            await click("#dun [data-act=dleave]"); await pg.wait_for_timeout(500)
            # wear it from the Pack's doll
            await click("[data-tab=pack]"); await pg.wait_for_timeout(300)
            await pg.click("[data-act=dollslot][data-slot=head]"); await pg.wait_for_timeout(250)
            rid = await pg.evaluate("String(window.__dbg.save().inv.find(r=>r.item==='mask_krosis').id)")
            await pg.screenshot(path=f"pr_{style}_picker.png")
            await pg.click(f"#modal [data-act=dolleq][data-id='{rid}']"); await pg.wait_for_timeout(300)
            print(style, "wearing:", await pg.evaluate("G.equipment(window.__dbg.save()).head?.item"))
            await pg.screenshot(path=f"pr_{style}_pack.png")
            await click("[data-tab=hero]"); await pg.wait_for_timeout(400); await pg.screenshot(path=f"pr_{style}_hero.png")
            await click("[data-tab=log]"); await pg.wait_for_timeout(400)
            await pg.evaluate("document.querySelector('#j-quests')?.scrollIntoView()"); await pg.wait_for_timeout(300)
            txt = await pg.inner_text("#j-quests"); print(style, "journal:", " | ".join(l for l in txt.split("\n") if "Mask" in l or "mask" in l)[:300])
            el = await pg.query_selector("#j-quests"); await el.screenshot(path=f"pr_{style}_journal.png")
            await pg.evaluate("()=>{ const s=window.__dbg.save(); s.location='Whiterun'; [s.x,s.y]=WORLD.places.Whiterun; }")
            await click("[data-tab=hero]"); await click("[data-tab=map]"); await pg.wait_for_timeout(500)
            await clear(); await pg.click("#zoomBtn"); await pg.wait_for_timeout(1500); await clear(); await pg.wait_for_timeout(400); await clear()
            el = await pg.query_selector("#mapwrap"); await el.screenshot(path=f"pr_{style}_map.png")
            await pg.close()
        print("errors:", errs)
        await b.close()
asyncio.run(main())
