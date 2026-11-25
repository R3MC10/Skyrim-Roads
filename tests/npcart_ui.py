import asyncio, sys, base64
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8782"
SHOTS = [("Whiterun","general"),("Whiterun","blacksmith"),("Whiterun","wizard"),("Whiterun","inn"),("Whiterun","train"),("Whiterun","hire"),("Whiterun","streets"),("Whiterun","notice"),("Whiterun","stables"),("Whiterun","hall"),
         ("Riften","fence"),("Riften","inn"),("Windhelm","arena"),("Markarth","blacksmith"),("Winterhold","wizard"),("Morthal","wizard"),("Ivarstead","inn"),("Karthwasten","general")]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=(__import__("os").environ.get("CHROME") or ("/usr/bin/google-chrome" if __import__("os").path.exists("/usr/bin/google-chrome") else None)), args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=npc"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Nadia"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
        async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
        for style in ["ink"]:
            for town, sec in SHOTS:
                await pg.evaluate("(t)=>{const S=window.__dbg.save(); S.location=t; [S.x,S.y]=WORLD.places[t]; if(!S.discovered.includes(t)) S.discovered.push(t); S.gold=5000;}", town)
                await clear(); await pg.click("[data-tab=map]"); await pg.click("[data-tab=town]"); await pg.wait_for_timeout(200)
                await clear()
                if not await pg.query_selector(f"[data-act=shop][data-id={sec}]"): print("no section", town, sec); continue
                for _ in range(5):
                    try: await clear(); await pg.click(f"[data-act=shop][data-id={sec}]", timeout=3000); break
                    except Exception: await pg.wait_for_timeout(300)
                await pg.wait_for_timeout(250)
                card = await pg.query_selector(".npctalk")
                if sec == "train":
                    el = await pg.query_selector("#side .list"); 
                    if el: await el.screenshot(path=f"npc_{style}_{town}_{sec}.png")
                    print(style, town, sec, "trainer portraits:", await pg.evaluate("document.querySelectorAll('#side .list img.npcport').length"))
                    continue
                if card:
                    await card.screenshot(path=f"npc_{style}_{town}_{sec}.png")
                    print(style, town, sec, "|", (await card.inner_text()).replace("\n", " | ")[:120])
                else: print(style, town, sec, "NO CARD")
        await pg.evaluate("()=>{const S=window.__dbg.save(); S.location='High Hrothgar'; [S.x,S.y]=WORLD.places['High Hrothgar'];}")
        await clear(); await pg.click("[data-tab=town]"); await pg.click("[data-tab=map]"); await pg.wait_for_timeout(300)
        print("greybeard:", await pg.evaluate("document.querySelector('.npctalk')?.innerText?.replace(/\\n/g,' | ')"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
