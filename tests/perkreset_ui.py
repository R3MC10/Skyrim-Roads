"""Perk reset at a shrine or temple (perkreset.js): the "Reset perks" row in a shrine's What's here card, the window with
   the price / what you get back / the next price, the free first reset, then a paid one at the Whiterun temple
   (Area tab -> Services -> Temple), and the Character screen's pointer. Phone 390x844 and PC 1920x1080.
   usage: python3 perkreset_ui.py [port]   (shots in $SHOTS/, or the temp folder's out_perkreset/)"""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
OUT = os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "out_perkreset"); os.makedirs(OUT, exist_ok=True)
fails = []
def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok: fails.append(what)

ROW = "#locs .ls-sheet:not([hidden]) .prs-row, #side .prs-row"
ROW1 = "#locs .ls-sheet:not([hidden]) .prs-row"
OVER = """()=>{const r=[...document.querySelectorAll('#modal .sheet *, .prs-row *')].filter(e=>{const q=e.getBoundingClientRect(); return q.width>0 && (q.right>innerWidth+1||q.left<-1)}); return r.slice(0,3).map(e=>e.tagName+'.'+e.className)}"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}), args=["--no-sandbox"])
        for (w, h, tag) in [(390, 844, "phone"), (1920, 1080, "pc")]:
            ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=(tag == "phone"))
            await ctx.add_init_script("try{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}');p.lang='en';p.locIntro='off';localStorage.setItem('rotn_prefs',JSON.stringify(p));}catch(e){}")
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=prs{tag}"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            async def tab(t):
                await clear(); await pg.evaluate(f"document.querySelector('[data-tab={t}]').click()"); await pg.wait_for_timeout(500); await clear()
            async def goto(place):
                await pg.evaluate("""(n)=>{const S=window.__dbg.save(); S.trip=null; S.dungeon=null; S.encounter=null; S.location=n; [S.x,S.y]=WORLD.places[n]; if(!S.discovered.includes(n)) S.discovered.push(n); window.__ui.refresh();}""", place)
                await tab("town")
            # a level 8 hero with three perks and a Health choice
            await pg.evaluate("""()=>{const S=window.__dbg.save(); S.level=8; S.pendingLevels=1; G.levelUp(S,'health'); S.gold=2000;
              for (const k in S.skills) S.skills[k].lvl=60; let n=0; for (const id of Object.keys(PERKS.BY_ID)) { if (n<3 && !PERKS.canTake(S,id)) { PERKS.take(S,id); n++; } } }""")
            spent = await pg.evaluate("PERKRESET.perkCount(__dbg.save())")
            check(spent == 3, f"{tag}: set-up: 3 perks taken ({spent})")

            # ---- the shrine
            await goto("Shrine of Talos")
            await pg.screenshot(path=f"{OUT}/perkreset_shrine_scene_{tag}.png")
            # the shrine's own signpost on the place scene opens its card (What's here) with the Reset perks row
            await pg.evaluate("document.querySelector('#locs .ls-spot[data-id=main]')?.click()"); await pg.wait_for_timeout(500)
            row = pg.locator(ROW).first
            check(await row.count() > 0, f"{tag}: Shrine of Talos shows a Reset perks row")
            if await row.count():
                await row.scroll_into_view_if_needed()
                txt = await row.inner_text()
                check("Free" in txt and "3 perk points" in txt, f"{tag}: the row says it's free and what comes back ({txt[:90]!r})")
                await pg.screenshot(path=f"{OUT}/perkreset_shrine_{tag}.png")
                await pg.evaluate("(()=>{const r=[...document.querySelectorAll('.prs-row')].find(e=>e.offsetParent); r&&r.querySelector('[data-act=perkreset]').click()})()"); await pg.wait_for_timeout(400)
                dlg = await pg.evaluate("document.querySelector('#modal .sheet')?.innerText||''")
                check("reset perks" in dlg.lower() and "Free (your first reset)" in dlg, f"{tag}: the window shows the price (free)")
                check("3 perk points" in dlg and "1 level-up choice" in dlg, f"{tag}: the window shows what you get back")
                check("Next reset: 300 gold" in dlg, f"{tag}: the window shows the next price (300 at level 8)")
                check(await pg.evaluate(OVER) == [], f"{tag}: nothing in the window sticks out {await pg.evaluate(OVER)}")
                await pg.screenshot(path=f"{OUT}/perkreset_dialog_free_{tag}.png")
                await pg.evaluate("document.querySelector('#modal [data-act=perkreset][data-id=go]').click()"); await pg.wait_for_timeout(500)
                st = await pg.evaluate("(()=>{const S=__dbg.save(); return {g:S.gold, p:PERKS.pointsLeft(S), n:PERKRESET.perkCount(S), l:S.pendingLevels, free:S.perkReset.freeUsed}})()")
                check(st["g"] == 2000 and st["n"] == 0 and st["p"] == 7 and st["l"] == 1 and st["free"], f"{tag}: free reset done, every point back ({st})")
                done = await pg.evaluate("document.querySelector('#modal .sheet')?.innerText||''")
                check("perks reset" in done.lower() and "3 perk points" in done, f"{tag}: a result window follows")
                await pg.screenshot(path=f"{OUT}/perkreset_done_{tag}.png")
                await pg.evaluate("document.querySelector('#modal [data-act=perkreset][data-id=perks]').click()"); await pg.wait_for_timeout(500)
                check(not await pg.query_selector("#modal"), f"{tag}: Open perks closes the window")

            # ---- the Whiterun temple, a paid reset
            await pg.evaluate("""()=>{const S=window.__dbg.save(); let n=0; for (const id of Object.keys(PERKS.BY_ID)) { if (n<2 && !PERKS.canTake(S,id)) { PERKS.take(S,id); n++; } } }""")
            await goto("Whiterun")
            spot = pg.locator("#locs .ls-spot[data-id=temple]")
            check(await spot.count() == 1, f"{tag}: Whiterun's scene has a Temple signpost")
            if await spot.count():
                tt = await spot.inner_text()
                check("300" in tt, f"{tag}: the signpost shows the price ({tt!r})")
                await pg.screenshot(path=f"{OUT}/perkreset_board_{tag}.png")
                await pg.evaluate("document.querySelector('#locs .ls-spot[data-id=temple]').click()"); await pg.wait_for_timeout(600)
                row = pg.locator(ROW).first
                check(await row.count() > 0, f"{tag}: the temple shows a Reset perks row")
                if await row.count(): await row.scroll_into_view_if_needed()
                await pg.screenshot(path=f"{OUT}/perkreset_temple_{tag}.png")
                await pg.evaluate("(()=>{const r=[...document.querySelectorAll('.prs-row')].find(e=>e.offsetParent); r&&r.querySelector('[data-act=perkreset]').click()})()"); await pg.wait_for_timeout(400)
                dlg = await pg.evaluate("document.querySelector('#modal .sheet')?.innerText||''")
                check("300 gold" in dlg and "Next reset: 450 gold" in dlg and "2 perk points" in dlg, f"{tag}: temple window: 300 now, 450 next, 2 points back")
                check(await pg.evaluate(OVER) == [], f"{tag}: nothing in the window sticks out {await pg.evaluate(OVER)}")
                await pg.screenshot(path=f"{OUT}/perkreset_dialog_paid_{tag}.png")
                g0 = await pg.evaluate("__dbg.save().gold")
                await pg.evaluate("document.querySelector('#modal [data-act=perkreset][data-id=go]').click()"); await pg.wait_for_timeout(500)
                st = await pg.evaluate("(()=>{const S=__dbg.save(); return {g:S.gold, n:PERKRESET.perkCount(S), paid:S.perkReset.paid.length}})()")
                check(g0 - st["g"] == 300 and st["n"] == 0 and st["paid"] == 1, f"{tag}: paid 300, perks back ({st})")
                await clear()

            # ---- in a dungeon: no reset
            await pg.evaluate("""()=>{const S=__dbg.save(); let n=0; for (const id of Object.keys(PERKS.BY_ID)) { if (n<1 && !PERKS.canTake(S,id)) { PERKS.take(S,id); n++; } } }""")
            err = await pg.evaluate("(()=>{const S=__dbg.save(); S.dungeon={name:'x'}; const e=PERKRESET.can(S,{}); S.dungeon=null; return e})()")
            check(err and "dungeon" in err, f"{tag}: refused inside a dungeon ({err})")

            # ---- the Character screen points to the shrines (the old 10,000 gold Respec is gone)
            await tab("hero")
            if not await pg.query_selector("#side .prs-hint"):
                await pg.evaluate("()=>{ if (typeof MENUS!=='undefined' && MENUS.open) MENUS.open('hero'); }"); await pg.wait_for_timeout(500)
            dbg = await pg.evaluate("(()=>{const S=__dbg.save(); return [PERKRESET.perkCount(S), PERKRESET.attrCount(S), document.querySelector('#side')?.dataset.tab, !!PERKRESET.hint(S)]})()")
            await pg.evaluate("document.querySelector('.prs-hint')?.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{OUT}/perkreset_hero_{tag}.png")
            check(await pg.query_selector(".prs-hint") is not None, f"{tag}: Character screen has the shrine pointer {dbg}")
            check(not await pg.query_selector("[data-act=respec]"), f"{tag}: no old Respec button")
            check(not errs, f"{tag}: no page errors {errs[:2]}")
            await ctx.close()
        await b.close()
    print("shots in", OUT)
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
    sys.exit(1 if fails else 0)
asyncio.run(main())
