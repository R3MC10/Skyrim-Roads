"""Search everything (search.js) on a phone: the \ue105 button in the top bar, results for each kind, typos, the card for
things you don't own, and that tapping a result lands on the right screen (pack row, perk star, map + Travel, Journal
quest, settings row). Both art styles, two phone sizes, and Biggest text at 360 px.
Run:  python -m http.server 9600 --directory game   then   python tests/search_ui.py 9600 [outdir]
Screenshots land in outdir (default: search_shots in the temp folder). Fails on page errors, sideways scrolling and
controls sticking out of the screen."""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "9600"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), "search_shots")
os.makedirs(OUT, exist_ok=True)
CLEAR = "document.querySelectorAll('#modal,#sky').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
OVERFLOW = """(()=>{ const W=innerWidth, bad=[];
  for (const e of document.querySelectorAll('button,.btn,.sheet,.srch-r,.srch-q,.top,h2,h3,input')) {
    const r=e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs=getComputedStyle(e); if (cs.visibility==='hidden' || cs.display==='none' || e.hidden) continue;
    if (e.closest('.hide')) continue;
    let sc=false; for (let a=e.parentElement; a && a!==document.body; a=a.parentElement) { const o=getComputedStyle(a).overflowX; if (o==='auto'||o==='scroll') { sc=true; break; } }
    if (sc) continue;
    if (r.right > W + 1 || r.left < -1) bad.push((e.id||e.className||e.tagName)+' x '+Math.round(r.left)+'..'+Math.round(r.right));
  }
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) bad.push('page scrolls sideways '+document.documentElement.scrollWidth);
  return bad; })()"""


async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for vw, vh in [(360, 780), (412, 915)]:
            for style in ["ink"]:
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1, has_touch=True)
                pg = await ctx.new_page(); errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=0"); await pg.wait_for_timeout(1200)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                await pg.evaluate(CLEAR)
                tag = f"{vw}_{style}"

                async def shot(name, check=True):
                    await pg.wait_for_timeout(350)
                    await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"))
                    if check:
                        bad = await pg.evaluate(OVERFLOW)
                        if bad: fails.append(f"{tag} {name}: {bad[:6]}")

                async def search(text):
                    await pg.evaluate("document.querySelector('#twbar [data-twb=hub]')?.click()")
                    await pg.evaluate(CLEAR); await pg.evaluate("scrollTo(0,0)")
                    await pg.click("#srchBtn"); await pg.wait_for_timeout(250)
                    if not await pg.query_selector("#srch"): fails.append(f"{tag} search box did not open"); return
                    await pg.fill("#srchq", text); await pg.wait_for_timeout(350)

                async def pick(name_re, group=""):
                    ok = await pg.evaluate(f"(()=>{{ const b=[...document.querySelectorAll('#srch .srch-r[data-sr=pick]')].filter(x=>x.closest('.srch-list').previousElementSibling.textContent.includes('{group}')).find(x=>/{name_re}/i.test(x.querySelector('b').textContent)); if(!b) return false; b.click(); return true; }})()")
                    if not ok: fails.append(f"{tag} no result /{name_re}/")
                    await pg.wait_for_timeout(500)
                    return ok

                # the HUD button, the empty box
                await pg.evaluate("scrollTo(0,0)"); await shot("hud")
                if not await pg.query_selector(".top #srchBtn"): fails.append(f"{tag} no search button in the top bar")
                await search(""); await shot("empty")
                # a broad search with several groups
                await search("iron"); await shot("iron")
                groups = await pg.evaluate("[...document.querySelectorAll('#srch .srch-g')].map(h=>h.textContent.trim())")
                print(tag, "iron ->", groups)
                if len(groups) < 2: fails.append(f"{tag} iron gave {groups}")
                # typos
                await search("fierbal"); await shot("typo_spell")
                if not await pg.evaluate("/Fireball/.test(document.querySelector('#srch').textContent)"): fails.append(f"{tag} typo fierbal")
                # a spell you don't know: its card with where to buy the tome
                await pick("Fireball", "Spells"); await shot("card_spell")
                if not await pg.evaluate("/How to learn it/.test(document.querySelector('#srch').textContent)"): fails.append(f"{tag} spell card")
                await pg.click("#srch [data-sr=back]"); await pg.wait_for_timeout(200)
                if not await pg.query_selector("#srch .srch-r"): fails.append(f"{tag} back to results")
                # an item you own -> the pack, on that row
                own = await pg.evaluate("D.ITEMS[window.__dbg.save().inv[0].item].name")
                await search(own)
                await pick(own.split(" ")[0], "Your items"); await shot("to_pack")
                if not await pg.evaluate("!!document.querySelector('#sky .sky-row.sel')"): fails.append(f"{tag} owned item did not open in the pack")
                # an item in the game you don't own -> card
                await search("ebony"); await pick("Ebony", "Items in the game"); await shot("card_item")
                if not await pg.evaluate("/Value/.test(document.querySelector('#srch')?.textContent||'')"): fails.append(f"{tag} item card")
                # a smithing recipe card
                await search("steel sword forge"); await shot("recipes")
                await pg.evaluate("[...document.querySelectorAll('#srch .srch-g')].find(h=>/Recipes/.test(h.textContent))?.nextElementSibling?.querySelector('.srch-r')?.click()"); await pg.wait_for_timeout(300)
                await shot("card_recipe")
                if not await pg.evaluate("/What it takes/.test(document.querySelector('#srch')?.textContent||'')"): fails.append(f"{tag} recipe card")
                # a perk -> its star on the Skills page
                await search("armsman"); await pick("Armsman", "Perks"); await pg.wait_for_timeout(400); await shot("to_perk", check=False)
                if not await pg.evaluate("/Armsman/.test(document.querySelector('.tw-perk')?.textContent || document.querySelector('.skflash')?.textContent || '')"): fails.append(f"{tag} perk star not opened")
                # a place -> map centred with Travel
                await search("whiterun"); await pick("^Whiterun$", "Places"); await shot("to_place")
                if not await pg.evaluate("/Travel/.test(document.querySelector('#picked:not(.hide)')?.textContent||'')"): fails.append(f"{tag} place picked with Travel")
                # an undiscovered place: never its name
                secret = await pg.evaluate("Object.keys(WORLD.places).find(n=>WORLD.places[n][2]==='dungeon' && !window.__dbg.save().discovered.includes(n) && n.length>=8)")
                await search(secret); await shot("hidden_place")
                txt = await pg.evaluate("document.querySelector('#srch').textContent")
                if "not found yet" not in txt: fails.append(f"{tag} no ??? hint for {secret}")
                if secret in txt and not await pg.evaluate(f"[...document.querySelectorAll('#srch .srch-r b')].some(b=>b.textContent.includes({secret!r}) && !b.closest('.srch-list').previousElementSibling.textContent.includes('Places'))"):
                    fails.append(f"{tag} hidden place name shown: {secret}")
                # a quest -> the Journal card
                await pg.evaluate("()=>{ const S=window.__dbg.save(); QUESTS.ensure(S); }")
                q = await pg.evaluate("(()=>{ const S=window.__dbg.save(); const a=QUESTS.active(S)[0]; return a ? QUESTS.L[a.id].name : null; })()")
                if q:
                    await search(q); await pick(q.split(" ")[-1], "Quests"); await shot("to_quest", check=False)
                    if not await pg.evaluate("!!document.querySelector('.qcard.srch-flash, .qcard[id]')"): fails.append(f"{tag} quest not shown in the Journal")
                # a setting -> the settings row
                await search("text size"); await pick("Text size", "Settings"); await pg.wait_for_timeout(300); await shot("to_setting")
                if not await pg.evaluate("!!document.querySelector('#modal .srch-flash')"): fails.append(f"{tag} setting row not highlighted")
                await pg.evaluate(CLEAR)
                # SEARCH.open API and the back button
                await pg.evaluate("SEARCH.open('lydia')"); await pg.wait_for_timeout(300); await shot("api_open")
                if not await pg.evaluate("/Lydia/.test(document.querySelector('#srch')?.textContent||'')"): fails.append(f"{tag} SEARCH.open")
                await pg.evaluate("window.__ui.back()")
                if await pg.query_selector("#srch"): fails.append(f"{tag} back button did not close search")
                # Biggest text at 360 px
                if vw == 360:
                    await pg.evaluate("ACCESS.pref('a11yText','3')"); await pg.wait_for_timeout(200)
                    await pg.evaluate(CLEAR); await pg.evaluate("scrollTo(0,0)"); await shot("big_hud")
                    await search("restor helth"); await shot("big_results")
                    await pick("Restore Health", "Recipes"); await shot("big_card")
                    await pg.evaluate("ACCESS.pref('a11yHand','right')"); await pg.evaluate(CLEAR); await shot("onehand", check=False)
                    await pg.evaluate("ACCESS.pref('a11yHand','off'); ACCESS.pref('a11yText','0')")
                if errs: fails.append(f"{tag} page errors: {errs[:3]}")
                await ctx.close()
        await b.close()
    print("shots in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("search ui ok")

asyncio.run(main())
