"""Something at every place: the "What's here" card at a farm, a shrine and a cabin, in both art styles.
   node serve.js 8765 &   then   python3 fullmap_ui.py 8765
   Screenshots go to tests/out_fullmap/."""
import asyncio, os, sys, shutil
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_fullmap")
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or next((p for p in ["/usr/bin/google-chrome"] if os.path.exists(p)), None)

async def closeModals(pg):
    for _ in range(5):
        b = await pg.query_selector("#modal [data-act=close]")
        if not b: break
        await b.click(); await pg.wait_for_timeout(150)

async def goto(pg, place):
    await pg.evaluate("""(n)=>{const S=window.__dbg.save(); S.trip=null; S.location=n; [S.x,S.y]=WORLD.places[n]; if(!S.discovered.includes(n)) S.discovered.push(n); S.gold=Math.max(S.gold,300);}""", place)
    await pg.click("[data-tab=town]"); await pg.wait_for_timeout(200); await pg.click("[data-tab=world]"); await pg.wait_for_timeout(600)

async def run(p, style, errs):
    b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}), args=["--no-sandbox"])
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await ctx.add_init_script("(()=>{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}'); p.artStyle='%s'; localStorage.setItem('rotn_prefs', JSON.stringify(p));})()" % style)
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=fm{style}"); await pg.wait_for_timeout(1800)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Fm"); await pg.click("#begin"); await pg.wait_for_timeout(1000)
    await closeModals(pg)
    print(style, "art style:", await pg.evaluate("ART.style()"))
    for place, shot in [("Loreius Farm", "farm"), ("Shrine of Talos", "shrine"), ("Lund's Hut", "cabin")]:
        await goto(pg, place)
        card = await pg.query_selector(".pstuff")
        print(style, place, "card:", bool(card))
        if card:
            await card.scroll_into_view_if_needed()
            await pg.screenshot(path=os.path.join(OUT, f"{shot}_{style}.png"), full_page=False)
            await card.screenshot(path=os.path.join(OUT, f"{shot}_card_{style}.png"))
    # use a couple of offers: buy at the farm stall, work, pray
    await goto(pg, "Loreius Farm")
    g0 = await pg.evaluate("window.__dbg.save().gold")
    await pg.click(".pstuff [data-id=buy]"); await pg.wait_for_timeout(300)
    await pg.click(".pstuff [data-id=chores]"); await pg.wait_for_timeout(400)
    print(style, "chores modal:", (await pg.evaluate("document.querySelector('#modal')?.innerText||''"))[:160].replace("\n", " "))
    await pg.screenshot(path=os.path.join(OUT, f"farm_chores_{style}.png"))
    await closeModals(pg)
    print(style, "after: gold", g0, "->", await pg.evaluate("window.__dbg.save().gold"), "| chores button:", await pg.evaluate("document.querySelector('.pstuff-row button[disabled]')?.textContent||''"))
    await goto(pg, "Shrine of Talos")
    await pg.click(".pstuff [data-id=bless]"); await pg.wait_for_timeout(400)
    print(style, "bless modal:", (await pg.evaluate("document.querySelector('#modal')?.innerText||''"))[:160].replace("\n", " "))
    await pg.screenshot(path=os.path.join(OUT, f"shrine_bless_{style}.png"))
    await closeModals(pg)
    # the Area tab at a farm shows the same card instead of "nothing to buy"
    await pg.click("[data-tab=town]"); await pg.wait_for_timeout(400)
    print(style, "area tab card:", bool(await pg.query_selector(".pstuff")))
    await pg.screenshot(path=os.path.join(OUT, f"shrine_area_{style}.png"))
    await b.close()

async def main():
    errs = []
    async with async_playwright() as p:
        for style in ["ink"]:
            await run(p, style, errs)
    print("page errors:", errs or "none")
    print("screenshots in", OUT)
asyncio.run(main())
