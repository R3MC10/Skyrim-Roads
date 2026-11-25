"""Location introductions (locintro.js): real short trips on a phone (390x844) and a PC (1920x1080).
   First visit to Whiterun: the full picture (name, painting, time / weather / season), fading by itself; a repeat visit:
   the short one; a tap and Esc skip it; a window open on arrival holds it back until it closes; the Area tab's View
   location button (scene and list) opens it until dismissed without counting a visit; Off / First visit only work.
   usage: python3 locintro_ui.py [port] [shots dir]   (shots: locscreen_*.png, in tests/out_locintro/ unless given)
   With BEFORE=1 it only takes the arrival shots (for a build without locintro.js)."""
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_locintro")
BEFORE = os.environ.get("BEFORE") == "1"
os.makedirs(OUT, exist_ok=True)
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
fails = []
def check(ok, what):
    print(("ok   " if ok else "FAIL ") + what)
    if not ok: fails.append(what)

TRIP = """(dest)=>{const S=window.__dbg.save(); document.querySelectorAll('#modal').forEach(m=>m.remove());
  S.trip=null; S.dungeon=null; S.location=null; const p=WORLD.places[dest]; S.x=p[0]+0.004; S.y=p[1]+0.003;
  const err=G.startTrip(S, dest, p); window.__ui.refresh(); return err||''}"""
ON = "()=>document.querySelector('#tabs .tab.on')?.dataset.tab"
LI = "()=>{const e=document.querySelector('#locintro'); return e&&!e.classList.contains('gone')?e.className:''}"
PREF = "(v)=>{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}'); p.locIntro=v; localStorage.setItem('rotn_prefs',JSON.stringify(p));}"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}), args=["--no-sandbox"])
        for (w, h, tag) in [(390, 844, "phone"), (1920, 1080, "pc")]:
            ctx = await b.new_context(viewport={"width": w, "height": h}, is_mobile=(tag == "phone"), has_touch=(tag == "phone"))
            await ctx.add_init_script("try{const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}');p.lang='en';localStorage.setItem('rotn_prefs',JSON.stringify(p));}catch(e){}")
            pg = await ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&p=li{tag}&notut&locintro"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Remi"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate("document.querySelector('[data-tab=map]').click()"); await pg.wait_for_timeout(400)

            async def travel(dest, map_first=True):
                if map_first: await pg.evaluate("document.querySelector('[data-tab=map]')?.click()"); await pg.wait_for_timeout(300)
                err = await pg.evaluate(TRIP, dest)
                for _ in range(60):
                    await pg.wait_for_timeout(250)
                    if await pg.evaluate("()=>!window.__dbg.save().trip"): break
                return err
            async def wait_li(ms=3000):
                for _ in range(ms // 100):
                    c = await pg.evaluate(LI)
                    if c: return c
                    await pg.wait_for_timeout(100)
                return ""

            # 1. first visit: the full reveal
            err = await travel("Whiterun")
            check(err == "", f"{tag}: trip to Whiterun ({err})")
            if BEFORE:
                await pg.wait_for_timeout(1600); await pg.screenshot(path=f"{OUT}/locscreen_before_arrive_{tag}.png")
                await ctx.close(); continue
            c = await wait_li()
            check("li-full" in c, f"{tag}: first visit to Whiterun shows the full picture ({c})")
            await pg.wait_for_timeout(1900)
            await pg.screenshot(path=f"{OUT}/locscreen_first_{tag}.png")
            name = await pg.evaluate("document.querySelector('#locintro .li-name')?.textContent")
            check(name == "Whiterun", f"{tag}: the name ({name})")
            bg = await pg.evaluate("document.querySelector('#locintro .li-bg')?.style.backgroundImage||''")
            check("place-whiterun" in bg, f"{tag}: Whiterun's own painting")
            meta = await pg.evaluate("document.querySelector('#locintro .li-meta')?.textContent||''")
            check(any(x in meta for x in ["Winter", "Spring", "Summer", "Autumn"]) and any(x in meta for x in ["Dawn", "Day", "Evening", "Night"]), f"{tag}: time of day and season ({meta})")
            r = await pg.evaluate("(()=>{const q=document.querySelector('#locintro').getBoundingClientRect(); return [q.width,q.height]})()")
            check(r[0] >= w - 1 and r[1] >= h - 1, f"{tag}: fills the screen ({r})")
            over = await pg.evaluate("[...document.querySelectorAll('#locintro .li-text *')].filter(e=>{const q=e.getBoundingClientRect(); return q.width&&(q.left<-1||q.right>innerWidth+1)}).map(e=>e.className).slice(0,3)")
            check(over == [], f"{tag}: no text off screen {over}")
            await pg.wait_for_timeout(2600)
            check(await pg.evaluate("()=>!document.querySelector('#locintro')"), f"{tag}: the full one fades out by itself")
            check(await pg.evaluate(ON) == "town", f"{tag}: and the Area tab is there underneath")

            # 2. a repeat visit: short; skip with a tap
            await travel("Riverwood"); await wait_li(); await pg.wait_for_timeout(2600)
            await travel("Whiterun")
            c = await wait_li()
            check("li-short" in c, f"{tag}: back in Whiterun: the short one ({c})")
            await pg.wait_for_timeout(650)
            await pg.screenshot(path=f"{OUT}/locscreen_repeat_{tag}.png")
            await pg.wait_for_timeout(1900)
            check(await pg.evaluate("()=>!document.querySelector('#locintro')"), f"{tag}: the short one is gone in under 2.6 s")
            await travel("Riverwood")
            c = await wait_li()
            check(bool(c), f"{tag}: Riverwood again shows it")
            if tag == "phone": await pg.tap("#locintro", position={"x": 60, "y": 300})
            else: await pg.mouse.click(300, 300)
            await pg.wait_for_timeout(550)
            check(await pg.evaluate("()=>!document.querySelector('#locintro')"), f"{tag}: a tap skips it")
            await travel("Whiterun"); await wait_li()
            await pg.keyboard.press("Escape"); await pg.wait_for_timeout(550)
            check(await pg.evaluate("()=>!document.querySelector('#locintro')"), f"{tag}: Esc skips it")

            # 3. a window open on arrival: the picture waits for it
            await pg.evaluate("document.querySelector('[data-tab=map]').click()"); await pg.wait_for_timeout(300)
            await pg.evaluate(TRIP, "Riverwood")
            await pg.evaluate("()=>window.__dbg.message('Test', 'A window that is open while you arrive.')")
            for _ in range(60):
                await pg.wait_for_timeout(250)
                if await pg.evaluate("()=>!window.__dbg.save().trip"): break
            await pg.wait_for_timeout(900)
            check(await pg.evaluate("()=>!!document.querySelector('#modal .sheet')") and not await pg.evaluate(LI), f"{tag}: not on top of an open window")
            c = ''
            for _ in range(30):   # close it (and anything the arrival itself opened, like a quest note)
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                c = await pg.evaluate(LI)
                if c: break
                await pg.wait_for_timeout(150)
            check(bool(c), f"{tag}: shows once the window closes ({c})")
            await pg.wait_for_timeout(2400)

            # 4. the Area tab's button
            await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.evaluate("document.querySelector('[data-tab=town]').click()"); await pg.wait_for_timeout(700)
            before = await pg.evaluate("()=>JSON.stringify(window.__dbg.save().locv)")
            btn = await pg.evaluate("!!document.querySelector('#locs .ls-nrow .li-viewbtn')")
            check(btn, f"{tag}: View location button next to the name on the scene")
            await pg.evaluate("document.querySelector('#locs .ls-nrow').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{OUT}/locscreen_areabtn_{tag}.png")
            await pg.evaluate("document.querySelector('#locs .ls-nrow .li-viewbtn').click()")
            c = await wait_li(1500)
            check("li-view" in c, f"{tag}: it opens the picture ({c})")
            await pg.wait_for_timeout(4600)
            check(bool(await pg.evaluate(LI)), f"{tag}: and it stays until dismissed")
            await pg.screenshot(path=f"{OUT}/locscreen_view_{tag}.png")
            check(await pg.evaluate("()=>JSON.stringify(window.__dbg.save().locv)") == before, f"{tag}: viewing doesn't count a visit")
            await pg.keyboard.press("Escape"); await pg.wait_for_timeout(550)
            check(await pg.evaluate("()=>!document.querySelector('#locintro')"), f"{tag}: Esc closes the view")
            check(await pg.evaluate(ON) == "town", f"{tag}: and leaves you on the Area tab")
            bb = await pg.evaluate("(()=>{const q=document.querySelector('#locs .li-viewbtn').getBoundingClientRect(); return [q.width,q.height]})()")
            check(bb[0] >= 44 and bb[1] >= 44, f"{tag}: the button is at least 44 px ({bb})")
            await pg.evaluate("document.querySelector('#locs .ls-list').click()"); await pg.wait_for_timeout(500)
            lb = await pg.evaluate("!!document.querySelector('#side .li-viewbtn.btn')")
            check(lb, f"{tag}: the Area list has the button too")
            await pg.evaluate("document.querySelector('#side .li-viewbtn.btn').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f"{OUT}/locscreen_listbtn_{tag}.png")
            await pg.evaluate("document.querySelector('#side .li-viewbtn.btn').click()"); c = await wait_li(1500)
            check("li-view" in c, f"{tag}: and it opens the picture")
            if tag == "phone": await pg.tap("#locintro", position={"x": 60, "y": 300})
            else: await pg.mouse.click(300, 300)
            await pg.wait_for_timeout(550)
            await pg.evaluate("document.querySelector('#side .ls-scenebtn')?.click()"); await pg.wait_for_timeout(400)

            # 5. the setting
            await pg.evaluate(PREF, "off")
            await travel("Whiterun"); await pg.wait_for_timeout(1200)
            check(not await pg.evaluate(LI), f"{tag}: Off: nothing on arrival")
            await pg.evaluate(PREF, "first")
            await travel("Riverwood"); await pg.wait_for_timeout(1200)
            check(not await pg.evaluate(LI), f"{tag}: First visit only: nothing on a repeat visit")
            await travel("Falkreath"); c = await wait_li()
            check("li-full" in c, f"{tag}: First visit only: a new place still shows it ({c})")
            await pg.wait_for_timeout(4200)
            await pg.evaluate(PREF, "always")
            check(errs == [], f"{tag}: no page errors {errs[:3]}")
            await ctx.close()
        await b.close()
    print("FAILED: " + str(len(fails)) if fails else "locintro_ui ok")
    sys.exit(1 if fails else 0)

asyncio.run(main())
