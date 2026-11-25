# Fishing and hunting mini-games on screen: cast, bite, reel (tension meter); stalk, draw, shoot, skin; the road "Stalk and shoot"
# choice. Phone and PC widths, ink and pixel art. Screenshots: fh_*.png next to this file.
#   node serve.js 8765 &   then   python3 fishhunt_ui.py 8765
# Chrome: CHROME=/path/to/chrome (default /usr/bin/google-chrome if it exists, else Playwright's own Chromium).
import asyncio, os, sys
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
shot = lambda n: os.path.join(HERE, n)
fails = []
def ok(v, m):
    print(("ok   " if v else "FAIL ") + m)
    if not v: fails.append(m)

async def run(p, w, h, tag, pixel=False):
    b = await p.chromium.launch(**({"executable_path": CHROME} if CHROME else {}), args=["--no-sandbox"])
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w < 600 else 1)
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    async def clean():
        await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
    await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&p=fh{tag}"); await pg.wait_for_timeout(1800)
    await pg.click(".press", timeout=60000); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Angler"); await pg.click("#begin")
    await pg.wait_for_function("window.__dbg && window.__dbg.save() && typeof HUNTGAME !== 'undefined'", timeout=60000); await pg.wait_for_timeout(1500)
    await pg.evaluate("""()=>{const S=window.__dbg.save(); S.location='Riverwood'; [S.x,S.y]=WORLD.places.Riverwood; S.trip=null;
      G.give(S,'rod_fine'); G.give(S,'hunting_bow'); G.give(S,'arrow_iron',30); G.give(S,'skin_knife');
      S.skills.Archery.lvl=40; S.skills.Sneak.lvl=40;}""")
    if pixel: await pg.evaluate("document.documentElement.classList.add('art-pixel')")
    for _ in range(4):
        await clean(); await pg.wait_for_timeout(250)

    # ---------------------------------------------------------------- fishing
    await pg.evaluate("FISHGAME.play(window.__dbg.save(), [window.__dbg.save().x, window.__dbg.save().y], {})")
    await pg.wait_for_selector("#fishgame", timeout=4000)
    tap = "(k)=>document.querySelector('#fhbtn').dispatchEvent(new PointerEvent(k,{bubbles:true}))"
    await pg.wait_for_timeout(600)
    await pg.evaluate(tap, "pointerdown"); await pg.evaluate(tap, "pointerup")   # cast
    ok(await pg.evaluate("FISHGAME.state()?.phase") in ("fly", "wait"), f"{tag}: the line flies out")
    await pg.wait_for_function("FISHGAME.state()?.bit===true", timeout=12000)
    await pg.evaluate(tap, "pointerdown"); await pg.evaluate(tap, "pointerup")   # hook it
    ok(await pg.evaluate("FISHGAME.state()?.phase") == "reel", f"{tag}: hooked a fish")
    landed, shot_done = False, False
    for i in range(1500):
        st = await pg.evaluate("(()=>{const s=FISHGAME.state(); if(!s) return null; return {p:s.phase, t:s.g?.tension, b:s.g?.band}})()")
        if not st or st["p"] != "reel": break
        hold = st["t"] < (st["b"][0] + st["b"][1]) / 2
        await pg.evaluate("(h)=>{const s=FISHGAME.state(); if(s) s.held=h}", hold)
        if i == 25 and not shot_done:
            await (await pg.query_selector("#fishgame .fhcard")).screenshot(path=shot(f"fh_fish_reel_{tag}.png")); shot_done = True
        await pg.wait_for_timeout(16)
    msg = await pg.inner_text("#fhmsg")
    ok(await pg.evaluate("FISHGAME.state()?.phase") == "done" and len(msg) > 5, f"{tag}: the fight ends: {msg}")
    landed = await pg.evaluate("(window.__dbg.save().stats||{}).fish||0") > 0
    print("     landed:", landed)
    box = await (await pg.query_selector("#fishgame .fhcard")).bounding_box()
    ok(box["height"] <= h + 1 and box["width"] <= w + 1, f"{tag}: fishing fits the screen ({int(box['width'])}x{int(box['height'])} in {w}x{h})")
    await (await pg.query_selector("#fishgame .fhcard")).screenshot(path=shot(f"fh_fish_done_{tag}.png"))
    await pg.click("#fhdone"); await pg.wait_for_timeout(200)
    ok(not await pg.query_selector("#fishgame"), f"{tag}: Done closes fishing")

    # ---------------------------------------------------------------- hunting (straight in: the Area tab tile is checked below)
    await clean()
    r = await pg.evaluate("HUNTGAME.play(window.__dbg.save(), {id:'deer', pos:[window.__dbg.save().x, window.__dbg.save().y]}, (res)=>{window.__hunt=res||'none'})")
    ok(r == "", f"{tag}: the hunt starts ({r})")
    await pg.wait_for_selector("#huntgame", timeout=3000)
    await pg.evaluate("(()=>{const s=HUNTGAME.state(); s.g.wind={dir:-1,str:2};})()")
    # creep while it grazes, freeze when it looks up
    for i in range(900):
        st = await pg.evaluate("(()=>{const s=HUNTGAME.state(); return s && {p:s.phase, head:s.g.head, a:s.g.alert, d:s.g.dist}})()")
        if not st or st["p"] != "stalk" or st["d"] <= 32: break
        await pg.evaluate("(m)=>{const s=HUNTGAME.state(); if(s) s.moving=m}", st["head"] == "down" and st["a"] < 0.55)
        if i == 40: await (await pg.query_selector("#huntgame .fhcard")).screenshot(path=shot(f"fh_hunt_stalk_{tag}.png"))
        await pg.wait_for_timeout(16)
    await pg.evaluate("(()=>{const s=HUNTGAME.state(); if(s) s.moving=false})()")
    st = await pg.evaluate("(()=>{const s=HUNTGAME.state(); return s && {p:s.phase, d:s.g.dist}})()")
    ok(st and st["p"] == "stalk" and st["d"] <= 33, f"{tag}: crept up close without spooking it ({st})")
    await pg.click("#hgdraw"); await pg.wait_for_timeout(100)
    ok(await pg.evaluate("HUNTGAME.state().phase") == "aim", f"{tag}: bow drawn")
    # aim at the heart, into the wind (sway is what it is)
    await pg.evaluate("(()=>{const s=HUNTGAME.state(), b=HUNTGAME.box(s.g); s.aim=[b.vx-HUNTGAME.drift(s.g), b.vy];})()")
    await pg.wait_for_timeout(300)
    await (await pg.query_selector("#huntgame .fhcard")).screenshot(path=shot(f"fh_hunt_aim_{tag}.png"))
    box = await (await pg.query_selector("#huntgame .fhcard")).bounding_box()
    ok(box["height"] <= h + 1 and box["width"] <= w + 1, f"{tag}: hunting fits the screen ({int(box['width'])}x{int(box['height'])} in {w}x{h})")
    arrows0 = await pg.evaluate("window.__dbg.save().inv.filter(r=>r.item==='arrow_iron').reduce((a,r)=>a+r.qty,0)")
    await pg.click("#hgshoot")
    await pg.wait_for_function("HUNTGAME.state()?.phase==='done'", timeout=4000)
    await pg.wait_for_timeout(500)
    msg = await pg.inner_text("#hgmsg")
    res = await pg.evaluate("HUNTGAME.state().res")
    ok(len(msg) > 5, f"{tag}: the shot lands ({res['shot']}, {res['quality']}): {msg}")
    arrows1 = await pg.evaluate("window.__dbg.save().inv.filter(r=>r.item==='arrow_iron').reduce((a,r)=>a+r.qty,0)")
    ok(arrows1 in (arrows0 - 1, arrows0), f"{tag}: one arrow used (maybe picked up again): {arrows0} -> {arrows1}")
    if res["kill"]: ok(await pg.evaluate("window.__dbg.save().inv.some(r=>r.item==='pelt_deer')"), f"{tag}: the deer was skinned (hide in the pack)")
    await (await pg.query_selector("#huntgame .fhcard")).screenshot(path=shot(f"fh_hunt_done_{tag}.png"))
    await pg.click("#hgfin"); await pg.wait_for_timeout(200)
    ok(not await pg.query_selector("#huntgame") and await pg.evaluate("window.__hunt") is not None, f"{tag}: Done closes the hunt")

    # ---------------------------------------------------------------- Area tab: the hunting grounds tile and card
    await clean()
    await pg.evaluate("window.__ui.go('town')"); await pg.wait_for_timeout(400)   # no tab bar on a PC layout
    hub = await pg.query_selector("[data-id=hunt]")
    ok(hub is not None, f"{tag}: Riverwood shows hunting grounds in the Area tab")
    if hub:
        await hub.click(); await pg.wait_for_timeout(300)
        ok(await pg.query_selector("[data-act=huntgo]") is not None, f"{tag}: the hunting card has a Stalk button")
        if tag == "phone": await (await pg.query_selector("#side")).screenshot(path=shot(f"fh_area_hunt_{tag}.png"))

    # ---------------------------------------------------------------- the road: a deer met while hunting
    await pg.evaluate("""()=>{const S=window.__dbg.save(); G.startTrip(S,'Whiterun',WORLD.places.Whiterun); const e=G.scaleEnemy(HUNT.pick(S,()=>0),S.level);
      S.trip.status='encounter'; S.trip.encounter=e; window.__dbg.openEncounter();}""")
    await pg.wait_for_timeout(300)
    btn = await pg.query_selector("#modal [data-act=huntroad]")
    ok(btn is not None, f"{tag}: a deer on the road offers Stalk and shoot")
    if btn:
        if tag == "phone": await (await pg.query_selector("#modal")).screenshot(path=shot(f"fh_road_{tag}.png"))
        await btn.click(); await pg.wait_for_timeout(300)
        ok(await pg.query_selector("#huntgame") is not None, f"{tag}: it opens the hunt")
        await pg.click("#hgdone"); await pg.wait_for_timeout(300)   # left before shooting: back to the encounter
        ok(await pg.query_selector("#modal [data-act=enc]") is not None and await pg.evaluate("window.__dbg.save().trip.status") == "encounter", f"{tag}: leaving early goes back to the choice")
    ok(not errs, f"{tag}: no page errors {errs[:3]}")
    await b.close()

async def main():
    async with async_playwright() as p:
        await run(p, 412, 915, "phone")
        await run(p, 1366, 768, "pc")
        await run(p, 412, 915, "pixel", pixel=True)
    print("FAILED: %d" % len(fails) if fails else "fishhunt_ui: all passed")
    sys.exit(1 if fails else 0)
asyncio.run(main())
