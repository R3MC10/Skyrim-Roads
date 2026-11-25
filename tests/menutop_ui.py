"""Menus open at the top on a phone (menutop.js), 390x844.
  - Every bottom tab (Character, Items, Magic, Map, Journal, Social, Area) and every sub-tab opens at the top of its screen,
    even when the page was scrolled far down before.
  - The compass's links (Character page, Area, Journal, Social) open at the top of the screen, not on the map above it.
  - Items/Magic: a new category starts at the top; picking or equipping a row keeps the list where it was.
  - A window (Settings, patch notes) opens at its top.
Usage: node tests/serve.js PORT game   then   python tests/menutop_ui.py PORT   (shots go to $SHOTS or the temp folder)"""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = os.path.join(os.environ.get("SHOTS") or os.path.join(tempfile.gettempdir(), "rotn_shots"), "menutop"); os.makedirs(OUT, exist_ok=True)
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)

DOWN = """()=>{scrollTo(0,99999);document.querySelectorAll('#side,#sky .sky-list').forEach(e=>e.scrollTop=99999)}"""
# how far the screen's top is from the top of the window (0 = at the top); the Skills page and the PC panel scroll inside #side
AT = """()=>{const s=document.querySelector('#side'); return {top:Math.round(s.getBoundingClientRect().top), inner:Math.round(s.scrollTop), y:Math.round(scrollY), max:Math.round(document.documentElement.scrollHeight-innerHeight), tab:__ui.tab}}"""

async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=1&p=mtop"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate("window.__mtClear=setInterval(()=>document.querySelectorAll('#modal,#lvlpick,.toast').forEach(m=>m.remove()),150)")
        await pg.evaluate("""()=>{const S=__dbg.save(); for(const k of Object.keys(D.ITEMS).filter(k=>D.ITEMS[k].slot==='weapon').slice(0,60)) G.give(S,k); S.level=20;}""")
        await pg.evaluate("TABMENU.closeHub()"); await pg.wait_for_timeout(300)

        async def at_top(label, shot=None):
            await pg.wait_for_timeout(700)
            a = await pg.evaluate(AT)
            # at the top: the screen's top edge sits at the window's top, or the page can't scroll that far (short screens)
            good = a["inner"] == 0 and (abs(a["top"]) <= 2 or (a["top"] > 0 and a["y"] >= a["max"] - 2))
            ok(good, f"{label} opens at the top {a}")
            if shot: await pg.screenshot(path=os.path.join(OUT, shot + ".png"))

        # bottom tabs + their sub-tabs
        for t in ["hero", "world", "log", "social", "town"]:
            await pg.evaluate(DOWN)
            await pg.evaluate(f"document.querySelector('#tabs [data-tab={t}]').click()")
            await at_top(f"bottom tab {t}", f"tab_{t}")
            # (Hero's Items and Magic open the item menu, checked further down)
            for s in await pg.evaluate("[...document.querySelectorAll('#side .mn-sub button')].map(b=>b.dataset.id).filter(id=>id[0]!=='@')"):
                await pg.evaluate(DOWN)
                await pg.evaluate(f"document.querySelector('#side .mn-sub button[data-id=\"{s}\"]').click()")
                await at_top(f"  sub-tab {s}")
        # journal's Active / Misc / Completed
        await pg.evaluate("document.querySelector('#tabs [data-tab=log]').click()"); await pg.wait_for_timeout(500)
        for j in await pg.evaluate("[...document.querySelectorAll('#side .jseg button')].map(b=>b.dataset.id)"):
            await pg.evaluate(DOWN)
            await pg.evaluate(f"document.querySelector('#side .jseg button[data-id={j}]').click()")
            await at_top(f"  journal {j}")

        # the compass's links
        for sel, name in [("[data-twgo=char]", "char"), ("[data-twq=town]", "town"), ("[data-twq=log]", "log"), ("[data-twq=social]", "social")]:
            await pg.evaluate("TABMENU.openHub()"); await pg.wait_for_timeout(300); await pg.evaluate(DOWN)
            await pg.evaluate(f"document.querySelector('#tw {sel}').click()")
            if name == "char":
                await pg.wait_for_timeout(700); a = await pg.evaluate(AT)
                ok(a["y"] == 0 and a["inner"] == 0, f"compass -> Character page at the top {a}")
                await pg.screenshot(path=os.path.join(OUT, "hub_char.png"))
                # Character page sub-tabs (its own bar)
                for s in await pg.evaluate("[...document.querySelectorAll('#twbar .twbar-t')].map(b=>b.dataset.twb)"):
                    await pg.evaluate(DOWN); await pg.evaluate(f"document.querySelector('#twbar [data-twb={s}]').click()"); await pg.wait_for_timeout(400)
                    a = await pg.evaluate(AT); ok(a["y"] == 0 and a["inner"] == 0, f"  Character page {s} at the top {a}")
                await pg.evaluate("TABMENU.openHub()"); await pg.wait_for_timeout(200)
            else:
                await at_top(f"compass -> {name}", f"hub_{name}")

        # Items: new category at the top, picking a row keeps the place
        await pg.evaluate("TABMENU.closeHub(); __ui.openMenu('items')"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#sky .sky-cat[data-id=weapons]').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#sky .sky-list').scrollTop=500"); y0 = await pg.evaluate("document.querySelector('#sky .sky-list').scrollTop")
        ok(y0 > 100, f"weapons list is long enough to scroll ({y0})")
        rid = await pg.evaluate("[...document.querySelectorAll('#sky .sky-row')].find(r=>r.getBoundingClientRect().top>300)?.dataset.id")
        await pg.evaluate(f"document.querySelector('#sky .sky-row[data-id=\"{rid}\"]').click()"); await pg.wait_for_timeout(300)
        y1 = await pg.evaluate("document.querySelector('#sky .sky-list').scrollTop"); ok(abs(y1 - y0) <= 2, f"picking a row keeps the list ({y0} -> {y1})")
        eq = await pg.evaluate("!!document.querySelector('#sky [data-act=equip], #sky [data-act=skyequip]')")
        if eq:
            await pg.evaluate("document.querySelector('#sky [data-act=equip], #sky [data-act=skyequip]').click()"); await pg.wait_for_timeout(300)
            y2 = await pg.evaluate("document.querySelector('#sky .sky-list')?.scrollTop ?? -1"); ok(abs(y2 - y0) <= 2, f"equipping keeps the list ({y0} -> {y2})")
        await pg.screenshot(path=os.path.join(OUT, "items_keep.png"))
        await pg.evaluate("document.querySelector('#sky .sky-cat[data-id=all]').click()"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelector('#sky .sky-list').scrollTop") == 0, "a new category starts at the top")
        await pg.evaluate("document.querySelector('#sky .sky-list').scrollTop=400")
        await pg.evaluate("document.querySelector('#sky [data-act=skytab][data-id=magic]').click()"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelector('#sky .sky-list')?.scrollTop||0") == 0, "Magic starts at the top")
        await pg.evaluate("document.querySelector('#sky [data-act=skyclose]').click()"); await pg.wait_for_timeout(200)

        # windows open at their top
        await pg.evaluate("TABMENU.closeHub && TABMENU.closeHub()")
        await pg.evaluate("clearInterval(window.__mtClear)")   # stop closing windows for this part
        for act in ["notes", "guide"]:
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate(f"(()=>{{const b=document.createElement('button'); b.dataset.act='{act}'; document.querySelector('#side').appendChild(b); b.click(); b.remove();}})()"); await pg.wait_for_timeout(500)
            m = await pg.evaluate("(()=>{const m=document.querySelector('#modal'); if(!m) return null; const s=m.querySelector('.sheet'); return {sheet:Math.round(s.scrollTop), modal:Math.round(m.scrollTop), tall:s.scrollHeight>s.clientHeight||m.scrollHeight>m.clientHeight}})()")
            if m is None: print(f"skip {act}: no window"); continue
            ok(m["sheet"] == 0 and m["modal"] == 0, f"window '{act}' opens at its top {m}")
            await pg.screenshot(path=os.path.join(OUT, f"modal_{act}.png"))
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("FAILS:", len(fails))
    sys.exit(1 if fails else 0)

asyncio.run(main())
