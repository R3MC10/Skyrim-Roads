import asyncio, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8828"
async def closeModals(pg):
    for _ in range(5):
        b = await pg.query_selector("#modal [data-act=close]")
        if not b: break
        await b.click(); await pg.wait_for_timeout(150)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=ex"); await pg.wait_for_timeout(1800)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Ex"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        await closeModals(pg)
        # 1) a hidden secret: search it
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location="Embershard Mine"; [S.x,S.y]=WORLD.places["Embershard Mine"]; S.skills.Sneak.lvl=30; if(!S.discovered.includes("Embershard Mine")) S.discovered.push("Embershard Mine");}""")
        await pg.click("[data-tab=town]"); await pg.wait_for_timeout(200); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(500)
        card = await pg.query_selector(".xcard")
        print("search card:", bool(card))
        if card: await card.screenshot(path="ex_search_card.png")
        await pg.click("[data-act=xsearch]"); await pg.wait_for_timeout(400)
        txt = await pg.evaluate("document.querySelector('#modal')?.innerText||''")
        print("search modal:", txt[:160].replace("\n", " "))
        await pg.click("#modal [data-act=xread]"); await pg.wait_for_timeout(300)
        await pg.screenshot(path="ex_book.png")
        print("book:", (await pg.evaluate("document.querySelector('.xread h2')?.innerText||''")))
        await closeModals(pg)
        # 2) treasure map: carry it, see the X, walk there, dig
        pos = await pg.evaluate("""()=>{const S=window.__dbg.save(); G.give(S,"map_tm1"); const m=EXPLORE.marks(S)[0]; S.location=null; [S.x,S.y]=m.pos; return m.pos;}""")
        await pg.click("[data-tab=town]"); await pg.wait_for_timeout(200); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(900)
        await pg.screenshot(path="ex_map_x.png")
        dig = await pg.query_selector("[data-act=xdig]"); print("dig button:", bool(dig))
        if dig:
            await dig.click(); await pg.wait_for_timeout(400)
            print("dig modal:", (await pg.evaluate("document.querySelector('#modal')?.innerText||''"))[:140].replace("\n", " "))
        await closeModals(pg)
        # 3) Journal → Discoveries
        await pg.evaluate("()=>window.__ui.go('stats')"); await pg.wait_for_timeout(400)   # Discoveries moved: Character → Stats
        el = await pg.query_selector("#j-finds")
        print("discoveries:", (await el.inner_text())[:200].replace("\n", " ") if el else None)
        if el: await el.screenshot(path="ex_journal.png")
        # 4) a claw door with the ring mini-game
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.level=14; S.hpBonus=4000; for(const sk of Object.values(S.skills)) sk.lvl=Math.max(sk.lvl,50); G.setHealth(S,G.maxHealth(S)); for(let i=0;i<8;i++) G.give(S,"potion_health");
           S.location="Bleak Falls Barrow"; [S.x,S.y]=WORLD.places["Bleak Falls Barrow"]; if(!S.discovered.includes("Bleak Falls Barrow")) S.discovered.push("Bleak Falls Barrow"); S.cleared={};}""")
        await pg.click("[data-tab=town]"); await pg.wait_for_timeout(200); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(500)
        await pg.click("[data-act=enter]"); await pg.wait_for_timeout(500)
        await closeModals(pg)
        saw = False
        for i in range(60):
            await closeModals(pg)
            g = await pg.query_selector("#dun [data-act=dact][data-c='game:claw']")
            if g:
                saw = True
                await pg.screenshot(path="ex_claw_room.png")
                await g.click(); await pg.wait_for_timeout(300)
                await pg.screenshot(path="ex_claw_game.png")
                # turn each ring to the right animal
                for ring, want in enumerate(["Bear", "Moth", "Owl"]):
                    for _ in range(8):
                        cur = await pg.evaluate(f"document.querySelectorAll('#xgame .xg-face small')[{ring}].textContent")
                        if cur == want: break
                        await pg.click(f"#xgame [data-x=up][data-i='{ring}']"); await pg.wait_for_timeout(60)
                await pg.screenshot(path="ex_claw_set.png")
                await pg.click("#xgame [data-x=go]"); await pg.wait_for_timeout(500)
                print("after claw:", (await pg.evaluate("document.querySelector('#dun .card.res')?.innerText||''"))[:140].replace("\n", " "))
                print("boss room now:", await pg.evaluate("window.__dbg.save().dungeon?.room?.type"))
                continue
            done = await pg.query_selector("#dun [data-act=dleave]")
            room = await pg.query_selector("#dun [data-act=droom]")
            acts = await pg.query_selector_all("#dun .evc [data-act=dact]")
            if await pg.evaluate("window.__dbg.save().dungeon?.done"):
                print("cleared:", (await pg.evaluate("document.querySelector('#dun .card.res')?.innerText||''"))[-220:].replace("\n", " "))
                await pg.screenshot(path="ex_cleared.png")
                break
            if acts:
                cs = [await a.get_attribute("data-c") for a in acts]
                pref = next((c for c in ["fight", "open", "rest", "read", "pray", "loot", "skip"] if c in cs), None) or next((c for c in cs if c.startswith("set:")), cs[0])
                if pref == "pick": pref = "skip" if "skip" in cs else pref
                await pg.click(f"#dun .evc [data-act=dact][data-c='{pref}']"); await pg.wait_for_timeout(250)
                if await pg.query_selector("#lockpick"): await pg.evaluate("IMM.close()")
            elif room:
                await room.click(); await pg.wait_for_timeout(250)
            elif not await pg.query_selector("#dun"): print("left the dungeon"); break
        print("claw door seen:", saw)
        S = await pg.evaluate("(()=>{const S=window.__dbg.save(); return {claw:S.inv.some(x=>x.item==='golden_claw'), uniq:S.inv.some(x=>x.item==='u_bleakfalls_helm'), lore:S.explore.lore.length}})()")
        print("state:", S)
        print("errors:", errs)
        ok = saw and S["claw"] and S["uniq"] and not errs
        print("RESULT", "OK" if ok else "FAIL")
        await b.close()
asyncio.run(main())
