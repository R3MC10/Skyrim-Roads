"""Area tab as a place (areaui.js) and the tidier Map panel (mappanel.js): the board of grouped tiles, opening a place
   and coming back, folding a group, one merged "What to do next" card with no repeats, place filters, Polish,
   both art styles, and nothing sticking out at 360 / 430 / 1920 wide.
   usage: python3 areaui_ui.py [port]   (shots in tests/out_areaui/)"""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_areaui"); os.makedirs(OUT, exist_ok=True)
fails = []
def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok: fails.append(what)

OVER = """()=>{const s=document.querySelector('#side'); const sc=[...s.querySelectorAll('*')].filter(e=>/auto|scroll|hidden/.test(getComputedStyle(e).overflowX));
  return [...s.querySelectorAll('*')].filter(e=>{const q=e.getBoundingClientRect(); return q.width>0 && (q.right>innerWidth+1||q.left<-1) && !sc.some(x=>x!==e&&x.contains(e))}).slice(0,4).map(e=>e.tagName+'.'+e.className)}"""
CLIP = """()=>[...document.querySelectorAll('#side .au-tile b, #side .au-back, #side .au-sibs button, #side .mp-f button, #rmd-card .btn')].filter(e=>e.offsetParent && e.scrollWidth>e.clientWidth+2).map(e=>e.textContent).slice(0,4)"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}), args=["--no-sandbox"])
        for (w, h) in [(360, 740), (430, 932), (1920, 1080)]:
            for style in (["ink", "pixel"] if w < 1000 else ["ink"]):
                for lang in (["en", "pl"] if (w, style) == (360, "ink") else ["en"]):
                    tag = f"{w}_{style}_{lang}"
                    ctx = await b.new_context(viewport={"width": w, "height": h})
                    await ctx.add_init_script(f"try{{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{{}}');p.lang='{lang}';p.artStyle='{style}';localStorage.setItem('rotn_prefs',JSON.stringify(p));}}catch(e){{}}")
                    pg = await ctx.new_page(); errs = []
                    pg.on("pageerror", lambda e: errs.append(str(e)))
                    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&p=au{tag}&notut"); await pg.wait_for_timeout(1500)
                    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                    async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                    async def tab(t):
                        await clear(); await pg.evaluate(f"document.querySelector('[data-tab={t}]').click()"); await pg.wait_for_timeout(500); await clear()
                    async def js(code): await clear(); await pg.evaluate(code); await pg.wait_for_timeout(350); await clear()
                    await pg.evaluate("""()=>{const S=window.__dbg.save(); S.trip=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.level=14; S.gold=3000; S.pendingLevels=1; window.__ui.refresh();}""")

                    # ---- Area: the board
                    await tab("town")
                    tiles = await pg.evaluate("document.querySelectorAll('#side .au-tile').length")
                    check(tiles >= 12, f"{tag}: Area opens on a board of places ({tiles} tiles)")
                    check(not await pg.query_selector("#side [data-act=buy]"), f"{tag}: no shop stock until you open a shop")
                    gs = await pg.evaluate("[...document.querySelectorAll('#side .au-g')].map(e=>e.dataset.g)")
                    check(gs[:2] == ["inn", "market"] and "services" in gs and "work" in gs and "home" in gs, f"{tag}: groups Inn, Market, Services, Work, Home ({gs})")
                    if lang == "pl":
                        hd = await pg.evaluate("document.querySelector('#side .au-g .au-gh')?.textContent")
                        check(hd == "Karczma", f"{tag}: group names in Polish ({hd})")
                    hh = await pg.evaluate("document.querySelector('#side').scrollHeight")
                    check(hh < 2200, f"{tag}: the board is short ({hh}px)")
                    check(await pg.evaluate(OVER) == [], f"{tag}: nothing sticks out on the board {await pg.evaluate(OVER)}")
                    check(await pg.evaluate(CLIP) == [], f"{tag}: no clipped tile names {await pg.evaluate(CLIP)}")
                    await pg.evaluate("scrollTo(0,0)"); await pg.screenshot(path=f"{OUT}/board_{tag}.png", full_page=True)
                    # open a place
                    await js("document.querySelector('#side .au-tile[data-id=general]').click()")
                    check(await pg.query_selector("#side .au-head [data-act=areahub]") is not None, f"{tag}: an open place has a back button")
                    sib = await pg.evaluate("[...document.querySelectorAll('#side .au-sibs button')].map(e=>e.dataset.id)")
                    check("blacksmith" in sib and "inn" not in sib, f"{tag}: neighbours row is the same group ({sib})")
                    check(await pg.query_selector("#side [data-act=buy]") is not None, f"{tag}: General goods shows its stock")
                    check(await pg.evaluate(OVER) == [], f"{tag}: nothing sticks out in a shop {await pg.evaluate(OVER)}")
                    await pg.screenshot(path=f"{OUT}/shop_{tag}.png")
                    await js("document.querySelector('#side .au-sibs [data-id=blacksmith]').click()")
                    check(await pg.evaluate("document.querySelector('#side .au-sibs button.on')?.dataset.id") == "blacksmith", f"{tag}: one tap to the next shop")
                    await js("document.querySelector('#side [data-act=areahub]').click()")
                    check(await pg.evaluate("document.querySelectorAll('#side .au-tile').length") == tiles, f"{tag}: back to the board")
                    # every tile opens something
                    ids = await pg.evaluate("[...document.querySelectorAll('#side .au-tile')].map(e=>e.dataset.id)")
                    bad = []
                    for i in ids:
                        await js(f"document.querySelector('#side .au-tile[data-id={i}]').click()")
                        on = await pg.evaluate("document.querySelector('#side .au-sibs button.on')?.dataset.id || (document.querySelector('#side .au-head') ? 'solo' : '')")
                        if on not in (i, "solo"): bad.append(i)
                        await js("document.querySelector('#side [data-act=areahub]')?.click()")
                    check(not bad and not errs, f"{tag}: every tile opens its place {bad} {errs[:2]}")
                    # fold a group, it stays folded
                    await js("document.querySelector('#side .au-g[data-g=market] summary').click()")
                    await js("window.__ui.refresh()")
                    check(await pg.evaluate("!document.querySelector('#side .au-g[data-g=market]').open"), f"{tag}: a folded group stays folded")
                    await js("document.querySelector('#side .au-g[data-g=market] summary').click()")

                    # ---- Map: one card, no repeats
                    await tab("map"); await js("window.__ui.refresh()")
                    check(await pg.evaluate("document.querySelectorAll('#side #rmd-card').length") == 1 and await pg.evaluate("document.querySelectorAll('#side .nextcard').length") == 1, f"{tag}: one What to do next card (Today merged in)")
                    txt = await pg.evaluate("[...document.querySelectorAll('#rmd-card .item .t')].map(e=>e.firstChild.textContent.trim())")
                    check(len(txt) == len(set(txt)), f"{tag}: no repeated rows {txt}")
                    perk = await pg.evaluate("[...document.querySelectorAll('#rmd-card .item')].filter(e=>/perk point|punkt/i.test(e.textContent)).length")
                    check(perk == 1, f"{tag}: perk points listed once ({perk})")
                    n = await pg.evaluate("document.querySelectorAll('#rmd-card .list > .item').length")
                    check(n <= 5, f"{tag}: at most five rows before 'Show more' ({n})")
                    if await pg.query_selector("#rmd-card [data-mp=more]"):
                        await js("document.querySelector('#rmd-card [data-mp=more]').click()")
                        n2 = await pg.evaluate("document.querySelectorAll('#rmd-card .list > .item').length")
                        check(n2 > n, f"{tag}: Show more opens the rest ({n2})")
                        await js("document.querySelector('#rmd-card [data-mp=more]').click()")
                    # filters
                    await js("document.querySelector('#side .mp-f [data-id=towns]').click()")
                    kinds = await pg.evaluate("[...document.querySelectorAll('#side .panel:not(.nextcard) .item [data-act=go]')].map(b=>WORLD.places[b.dataset.place]?.[2]).filter(Boolean)")
                    check(kinds and all(k in ("city", "town") for k in kinds), f"{tag}: Towns filter lists only towns ({set(kinds)})")
                    await js("document.querySelector('#side .mp-f [data-id=dungeons]')?.click()")
                    kinds = await pg.evaluate("[...document.querySelectorAll('#side .panel:not(.nextcard) .item [data-act=go]')].map(b=>WORLD.places[b.dataset.place]?.[2]).filter(Boolean)")
                    check(all(k in ("dungeon", "fort", "camp", "lair") for k in kinds), f"{tag}: Dungeons filter ({set(kinds)})")
                    await js("document.querySelector('#side .mp-f [data-id=all]').click()")
                    check(await pg.evaluate(OVER) == [], f"{tag}: nothing sticks out on the Map panel {await pg.evaluate(OVER)}")
                    check(await pg.evaluate(CLIP) == [], f"{tag}: no clipped Map buttons {await pg.evaluate(CLIP)}")
                    await pg.evaluate("document.querySelector('#rmd-card')?.scrollIntoView({block:'start'})"); await pg.screenshot(path=f"{OUT}/map_{tag}.png")
                    check(not errs, f"{tag}: no page errors {errs[:2]}")
                    await ctx.close()
        await b.close()
    print("PASS" if not fails else f"{len(fails)} FAILED")
    sys.exit(1 if fails else 0)
asyncio.run(main())
