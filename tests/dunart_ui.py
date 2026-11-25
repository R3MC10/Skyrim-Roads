import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8781"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        for style in ["ink"]:
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=dun{style}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Delver"); await pg.click("#begin"); await pg.wait_for_timeout(900)
            await pg.evaluate("(st)=>{ const S=window.__dbg.save(); const n='Bleak Falls Barrow'; S.location=n; [S.x,S.y]=WORLD.places[n]; S.discovered.push(n); S.cleared={}; S.level=30; S.hpBonus=3000; G.setHealth(S,G.maxHealth(S)); for(const k of Object.keys(S.skills)) S.skills[k].lvl=80; G.give(S,'potion_health',5); }", style)
            await pg.wait_for_timeout(400)
            async def clear():
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await clear(); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300); await clear()
            await pg.click("[data-act=enter]"); await pg.wait_for_timeout(500)
            # a known layout: fight → treasure → trap → rest → boss
            await pg.evaluate("()=>{ const d=window.__dbg.save().dungeon; d.rows=[[{type:'fight',links:[0,1]},{type:'trap',links:[1]}],[{type:'treasure',links:[0]},{type:'elite',links:[0,1]}],[{type:'trap',links:[0]},{type:'puzzle',links:[0]}],[{type:'rest',links:[0]}],[{type:'boss',links:[]}]]; }")
            # re-render via the room choice: first node
            el = await pg.query_selector("#dun .dmapcard"); await el.screenshot(path=f"dun_{style}_0.png")
            log = []
            for step in range(5):
                await clear()
                nodes = await pg.query_selector_all("#dun .dnode")
                log.append(f"step{step}: {len(nodes)} reachable")
                if not nodes: break
                await nodes[0].click(); await pg.wait_for_timeout(350)
                rt = await pg.evaluate("window.__dbg.save().dungeon?.room?.type")
                log.append(f"room {rt}")
                el = await pg.query_selector("#dun .dmapcard"); await el.screenshot(path=f"dun_{style}_map{step}.png")
                for _ in range(4):
                    await clear()
                    btn = await pg.query_selector("#dun [data-act=dact]")
                    if not btn: break
                    await btn.click(); await pg.wait_for_timeout(700)
                    if not await pg.evaluate("!!window.__dbg.save().dungeon?.room"): break
                await clear()
                await pg.screenshot(path=f"dun_{style}_after{step}.png", full_page=False)
                if rt == "treasure":
                    res = await pg.query_selector("#dun .card.res")
                    if res: await pg.wait_for_timeout(900); await res.screenshot(path=f"dun_{style}_treasure.png")
                if await pg.evaluate("!!window.__dbg.save().dungeon?.done"): break
            done = await pg.evaluate("!!window.__dbg.save().dungeon?.done")
            log.append(f"done {done}")
            el = await pg.query_selector("#dun .dmapcard")
            if el: await el.screenshot(path=f"dun_{style}_final.png")
            strip = await pg.query_selector("#dun .dloots")
            if strip: await strip.screenshot(path=f"dun_{style}_loot.png")
            flick = await pg.evaluate("!!document.querySelector('#dun .dflick')")
            print(style, " | ".join(log), "| flicker canvas:", flick)
            await pg.close()
        print("errors:", errs)
        await b.close()
asyncio.run(main())
