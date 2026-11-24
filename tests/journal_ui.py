import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
SHOT = "/home/claude/tests/journal_"
fails = []
def ok(c, m):
    print(("ok  " if c else "FAIL") + " " + m)
    if not c: fails.append(m)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        errs = []
        for style in ["ink"]:
            ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2)
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=jr{style}"); await pg.wait_for_timeout(1800)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Jora"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
            await pg.evaluate("""()=>{const S=window.__dbg.save(); S.level=20; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; QUESTS.ensure(S);
              S.quests.companions={stage:1,t:G.now()}; S.quests.college={stage:0,t:G.now()}; S.quests.main.stage=2;
              S.quests.cw_imperial={stage:0,t:G.now()}; S.quests.companions_done=null; delete S.quests.companions_done; S.quests.thieves={done:true,v2:true,stage:9,t:G.now()};
              S.journal.unshift({t:G.now(), text:'A test diary line'}); S.cleared=S.cleared||{}; S.cleared['Bleak Falls Barrow']=G.now();}""")
            async def closeall():
                for _ in range(6):
                    if await pg.query_selector("#modal [data-act=close]"): await pg.click("#modal [data-act=close]"); await pg.wait_for_timeout(150)
                await pg.evaluate("()=>{document.querySelectorAll('.toast,.pbanner,#banner').forEach(e=>e.remove())}")
            async def go(t):
                await closeall(); await pg.evaluate(f"()=>window.__ui.go('{t}')"); await pg.wait_for_timeout(350)
            async def text(): return await pg.evaluate("document.querySelector('#side').innerText")

            await go("log")
            t = await text()
            tl = t.lower(); ok("journal" in tl and "main quest" in tl and "guilds" in tl and "civil war" in tl, f"[{style}] active quests grouped on shelves")
            for gone in ["Leaderboard", "Travellers", "Word on the road", "Diary", "Chat", "General Stats", "Discoveries", "Cleared places"]:
                ok(gone not in t, f"[{style}] Journal has no '{gone}'")
            ok(await pg.query_selector("#side [data-act=qtrack]") is not None, f"[{style}] track buttons")
            ok(await pg.query_selector("#side [data-act=qmap]") is not None, f"[{style}] show on map buttons")
            ok(await pg.query_selector("#side .qstages .qdone") is not None, f"[{style}] stage list with done stages")
            await pg.screenshot(path=f"{SHOT}active_{style}.png", full_page=True)
            # track the College quest: compass task and the What to do next card follow it
            await pg.click("[data-act=qtrack][data-id=college]"); await pg.wait_for_timeout(300); await closeall()
            ok(await pg.evaluate("QUESTS.tracked(window.__dbg.save()).id") == "college", f"[{style}] tracked quest stored")
            task = await pg.evaluate("TABMENU.task ? JSON.stringify(TABMENU.task(window.__dbg.save())) : ''")
            ok("College" in task, f"[{style}] compass bottom bar shows the tracked quest: {task[:90]}")
            await go("map")
            nx = await pg.evaluate("document.querySelector('.nextcard')?.innerText || ''")
            ok("College" in nx, f"[{style}] What to do next follows the tracked quest")
            await go("log")
            await pg.click("[data-act=jtab][data-id=misc]"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{SHOT}misc_{style}.png", full_page=True)
            await pg.click("[data-act=jtab][data-id=done]"); await pg.wait_for_timeout(300)
            t = await text(); ok("Thieves Guild" in t, f"[{style}] completed tab lists finished quests")
            await pg.screenshot(path=f"{SHOT}done_{style}.png", full_page=True)
            # show on map
            await pg.click("[data-act=jtab][data-id=active]"); await pg.wait_for_timeout(200)
            await pg.click("[data-act=qmap] >> nth=0"); await pg.wait_for_timeout(400)
            ok(await pg.evaluate("document.querySelector('#tabs .tab.on')?.dataset.tab") == "map", f"[{style}] Show on map opens the map")
            # moved sections, each reachable in its new home
            await go("social")
            for k, ids in [("party", ["j-party", "j-people"]), ("chat", ["j-chat", "j-world"]), ("realm", ["j-holds", "j-clan", "j-ladder"])]:
                await pg.click(f"[data-act=soctab][data-id={k}]"); await pg.wait_for_timeout(300)
                found = await pg.evaluate(f"{ids}.filter(i=>document.getElementById(i)).length")
                ok(found >= 1, f"[{style}] Friends → {k} shows {found}/{len(ids)} of {ids}")
                await pg.screenshot(path=f"{SHOT}social_{k}_{style}.png", full_page=True)
            await go("stats")
            ok(await pg.query_selector("#j-stats") is not None, f"[{style}] Character → Stats has stats")
            await go("library")   # Discoveries moved to their own Character → Library page
            ok(await pg.query_selector("#j-finds") is not None, f"[{style}] Character → Library has Discoveries")
            await pg.screenshot(path=f"{SHOT}stats_{style}.png", full_page=True)
            await go("diary")
            ok("A test diary line" in await text(), f"[{style}] Character → Diary")
            await go("map")
            await pg.click("[data-act=tabgo][data-id=places]"); await pg.wait_for_timeout(300)
            ok(await pg.query_selector("#j-cleared") is not None, f"[{style}] Map → Locations lists cleared places")
            # old jump links still land in the new homes
            await go("log")
            await pg.evaluate("()=>{const b=document.createElement('button');b.dataset.act='jgo';b.dataset.id='clan';b.id='tjgo';document.querySelector('#side').appendChild(b);}")
            await pg.click("#tjgo"); await pg.wait_for_timeout(300)
            ok(await pg.query_selector("#j-clan") is not None and await pg.query_selector("#j-quests") is None, f"[{style}] old jgo link redirects to Friends → Realm")
            # hero page has the Character / Stats / Diary switch
            await go("hero")
            ok(await pg.query_selector("#side .charnav [data-id=stats], #side .mn-sub [data-id=stats]") is not None, f"[{style}] Character page links to Stats and Diary")
            await ctx.close()
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
