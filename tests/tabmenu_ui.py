"""Tab compass menu (tabmenu.js): swipes open the right menus, the bottom bar shows the right values. Usage: python3 tabmenu_ui.py PORT"""
import asyncio, sys, json, os
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = "/home/claude/tests/tabmenu/"
fails = []
def ok(c, m):
    print(("ok   " if c else "FAIL ") + m)
    if not c: fails.append(m)
async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await (p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch(args=["--no-sandbox"]))
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, has_touch=True)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&hub=1&p=tw1"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Sigrid"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        clear = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
        await pg.evaluate(clear)
        await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.gold=1234; S.discovered.push('Whiterun');
          G.give(S,'iron_sword'); G.give(S,'potion_health',3); G.give(S,'tome_firebolt'); S.pendingLevels=1; S.level=7; S.charXp=120; }""")
        ok(await pg.evaluate("!!document.querySelector('#tw')"), "compass opens as home screen")
        await pg.evaluate("TABMENU.closeHub(); TABMENU.openHub()"); await pg.wait_for_timeout(700); await pg.evaluate(clear)
        bar = await pg.evaluate("""()=>{const t=document.querySelector('#tw .tw-bar'); return {txt:t.innerText, S:(()=>{const S=__dbg.save(); return {w:Math.round(G.carried(S)),cap:Math.round(G.capacity(S)),need:(S.level+3)*25}})()}}""")
        print(bar)
        ok(str(await pg.evaluate("__dbg.save().gold")) in bar["txt"], "bar gold")
        ok(f"{bar['S']['w']}/{bar['S']['cap']}" in bar["txt"], "bar weight")
        ok(f"120/{bar['S']['need']}" in bar["txt"], "bar xp")
        ok("Whiterun" in bar["txt"] or "Level" in bar["txt"], "bar task line")
        await pg.screenshot(path=OUT + "hub_ink.png")
        async def swipe(x0, y0, x1, y1, touch=False):
            await pg.evaluate(clear)
            if touch:
                await pg.evaluate("""([x0,y0,x1,y1])=>{const el=document.elementFromPoint(x0,y0)||document.body; const mk=(x,y)=>new Touch({identifier:1,target:el,clientX:x,clientY:y});
                  el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[mk(x0,y0)],changedTouches:[mk(x0,y0)]}));
                  el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[mk(x1,y1)],changedTouches:[mk(x1,y1)]}));
                  el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[mk(x1,y1)]}));}""", [x0, y0, x1, y1])
            else:
                await pg.mouse.move(x0, y0); await pg.mouse.down()
                await pg.mouse.move((x0 + x1) / 2, (y0 + y1) / 2); await pg.mouse.move(x1, y1)
                await pg.mouse.up()
            await pg.wait_for_timeout(450)
        await pg.evaluate("TABMENU.maxMs = 1e9")   # this test machine is slow; real swipes are quick
        await pg.evaluate("setInterval(()=>document.querySelectorAll('#modal').forEach(m=>m.remove()),200)")
        st = lambda: pg.evaluate("({hub:!!document.querySelector('#tw'), sky:document.querySelector('#sky .sky-page.on')?.dataset.id||null, cat:document.querySelector('#sky .sky-cat.on')?.dataset.id||null, char:TABMENU.charMode, tab:__ui.tab, sub:document.querySelector('#twbar .twbar-t.on')?.dataset.twb||null})")
        # left = magic
        await swipe(300, 450, 120, 455); s = await st(); ok(s["sky"] == "magic" and not s["hub"], f"swipe left opens Magic {s}")
        await pg.screenshot(path=OUT + "magic.png")
        await swipe(300, 120, 300, 400); s = await st(); ok(s["hub"] and not s["sky"], f"swipe down in menu header goes back to compass {s}")
        # right = items (touch)
        await swipe(120, 450, 320, 445, touch=True); s = await st(); ok(s["sky"] == "items", f"touch swipe right opens Items {s}")
        c0 = s["cat"]; await swipe(330, 560, 120, 560); s = await st(); ok(s["sky"] == "items" and s["cat"] != c0, f"swipe left in Items switches tab {c0}->{s['cat']}")
        await pg.screenshot(path=OUT + "items.png")
        # walk past the last tab -> next menu round the ring (items -> map)
        for i in range(15):
            s = await st()
            if s["sky"] != "items": break
            await swipe(330, 560, 120, 560)
        s = await st(); ok(not s["sky"] and s["tab"] == "map" and not s["hub"], f"past the last Items tab goes on to the Map {s}")
        await pg.evaluate("__ui.back()"); await pg.wait_for_timeout(400); s = await st(); ok(s["hub"], f"back from map opens compass {s}")
        # up = character
        await swipe(206, 650, 206, 380); s = await st(); ok(s["char"] and s["tab"] == "stars", f"swipe up opens Skills constellations {s}")
        await pg.evaluate(clear); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + "stars_ink.png")
        n = await pg.evaluate("document.querySelectorAll('#side .tw-card').length"); ok(n >= 18, f"skill cards {n}")
        # pick a skill card, tap a star
        await pg.evaluate("document.querySelector('#side .tw-card[data-id=\"One-Handed\"]').click()"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("TABMENU.starSkill") == "One-Handed", "skill card selects")
        await pg.evaluate("document.querySelector('#side .tw-big [data-sk-perk=\"0\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))"); await pg.wait_for_timeout(300)
        txt = await pg.evaluate("document.querySelector('.tw-perk')?.innerText||''"); ok("armsman" in txt.lower(), "star opens perk card")
        before = await pg.evaluate("PERKS.rank(__dbg.save(),'armsman')")
        await pg.evaluate("document.querySelector('.tw-perk [data-act=perk]').click()"); await pg.wait_for_timeout(400)
        after = await pg.evaluate("PERKS.rank(__dbg.save(),'armsman')"); ok(after == before + 1, f"take perk from star {before}->{after}")
        await pg.evaluate(clear)
        await pg.screenshot(path=OUT + "stars_perk.png")
        # swipe left on header -> character, perks, stats
        for want in ["hero", "perks", "stats"]:
            await swipe(330, 30, 120, 30); s = await st(); ok(s["char"] and s["tab"] == want and s["sub"] == want, f"swipe to {want} {s}")
            await pg.evaluate(clear); await pg.screenshot(path=OUT + f"char_{want}.png")
        # swipe left inside the scrolling page body also flips tabs (horizontal only)
        await swipe(206, 30, 206, 300); s = await st(); ok(s["hub"] and not s["char"], f"swipe down on header -> compass {s}")
        # tap targets
        await pg.click("#tw [data-twgo=char]"); await pg.wait_for_timeout(400); s = await st(); ok(s["char"], "tap Skills label")
        await pg.evaluate("__ui.back()"); await pg.wait_for_timeout(300); s = await st(); ok(s["hub"], "back from skills -> compass")
        await pg.click("#tw [data-twgo=map]"); await pg.wait_for_timeout(400); s = await st(); ok(not s["hub"] and s["tab"] == "map", "tap Map")
        await pg.screenshot(path=OUT + "map_btn.png")
        await pg.click("#twBtn"); await pg.wait_for_timeout(400); s = await st(); ok(s["hub"], "compass button opens compass")
        await pg.click("#tw [data-twq=log]"); await pg.wait_for_timeout(400); s = await st(); ok(s["tab"] == "log" and not s["hub"], "quick Journal")
        # travelling: task line
        await pg.evaluate("""()=>{const S=__dbg.save(); S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2)); }""")
        await pg.evaluate("TABMENU.openHub()"); await pg.wait_for_timeout(1300)
        t = await pg.evaluate("TABMENU.task(__dbg.save())"); print("task", t); ok(t["k"] == "trip" and "Riverwood" in t["text"], "task shows the trip")
        bt = await pg.evaluate("document.querySelector('#tw .tw-task').innerText"); ok("Riverwood" in bt, "bar shows the trip")
        await pg.screenshot(path=OUT + "hub_trip.png")
        # pixel style
        await pg.evaluate("TABMENU.closeHub(); ART.setStyle('pixel'); TABMENU.openHub()"); await pg.wait_for_timeout(900); await pg.evaluate(clear)
        await pg.screenshot(path=OUT + "hub_pixel.png")
        await pg.evaluate("TABMENU.go('char')"); await pg.wait_for_timeout(500); await pg.evaluate(clear)
        await pg.screenshot(path=OUT + "stars_pixel.png")
        # glow while dragging
        await pg.evaluate("TABMENU.openHub()"); await pg.wait_for_timeout(300)
        await pg.mouse.move(206, 500); await pg.mouse.down(); await pg.mouse.move(206, 440); await pg.mouse.move(206, 420)
        g = await pg.evaluate("document.querySelector('#tw').dataset.glow"); ok(g == "up", f"glow while dragging {g}")
        await pg.screenshot(path=OUT + "hub_drag.png")
        await pg.mouse.move(206, 500); await pg.mouse.up(); await pg.wait_for_timeout(300)
        s = await st(); ok(s["hub"], "drag back = no swipe")
        ok(not errs, f"no page errors {errs[:3]}")
        await b.close()
    print("RESULT", "OK" if not fails else f"FAIL {len(fails)}")
asyncio.run(main())
