"""PC map screen test (pcmap.js, mapfx.js, greet.js) at 1920x1080 and 2560x1080 with a mouse.
The world map fills the window as the home screen; the bottom bar, the quest tracker (open, then slid away with Q and
brought back from the edge tab), the town's places in the side panel, the Tab compass over the dimmed map, a menu
full-screen over the blurred map, wheel zoom and keys. Then a second player in the same town: a "Stranger" on the map
until A greets them and B accepts, after which both see each other's names. A phone stays as it was.
Run:  node tests/serve.js 8765   then   py tests/pcmap_ui.py 8765 [outdir]
Screenshots land in outdir (default: tests/out_pcmap)."""
import asyncio, os, sys
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_pcmap")
os.makedirs(OUT, exist_ok=True)
CLEAR = "document.querySelectorAll('#modal,#sky').forEach(m=>m.remove()); typeof TABMENU!=='undefined' && TABMENU.closeHub?.()"
TOWN = """(t)=>{ const S=__dbg.save(); S.location=t; [S.x,S.y]=WORLD.places[t]; S.trip=null;
  for(const n of Object.keys(WORLD.places)) if(!S.discovered.includes(n) && Math.hypot(WORLD.places[n][0]-S.x, WORLD.places[n][1]-S.y) < 0.25) S.discovered.push(n);
  __ui.go('map'); __dbg.publish(); }"""
# a screen point on another player's hero, from the map's own view
HERO_AT = """(id)=>{ const v=__dbg.view(), t=v.transform, o=(v.others||[]).find(x=>x.id===id); if(!o||!t) return null;
  const r=document.getElementById('map').getBoundingClientRect(); return [r.left+(o.drawX ?? o.pos[0])*1000*t.k+t.ox, r.top+o.pos[1]*700*t.k+t.oy-14, o.name, !!o.stranger]; }"""

async def main():
    fails = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME") or None, args=["--no-sandbox"])
        for vw, vh in [(1920, 1080), (2560, 1080)]:
            tag = f"{vw}x{vh}"
            ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
            errs = []
            async def player(pid, name):
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(pid + " " + str(e)))
                url = f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p={pid}{vw}"
                await pg.goto(url)
                try: await pg.wait_for_selector(".press", timeout=45000)
                except Exception: await pg.goto(url); await pg.wait_for_selector(".press", timeout=45000)   # a slow first load: try once more
                await pg.wait_for_timeout(800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]")
                try: await pg.wait_for_selector("#nm", timeout=15000)
                except Exception: await pg.screenshot(path=os.path.join(OUT, f"debug_{pid}{vw}.png")); raise
                await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                await pg.evaluate(CLEAR); await pg.evaluate(TOWN, "Whiterun"); await pg.evaluate(CLEAR); await pg.wait_for_timeout(500)
                return pg
            async def shot(pg, name):   # quest pop-ups from arriving in Whiterun aren't what we're looking at
                await pg.evaluate("document.getElementById('modal')?.remove()"); await pg.wait_for_timeout(150)
                await pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"))
            A = await player("pa", "R3MC10")
            on = await A.evaluate("()=>document.documentElement.classList.contains('pcmap')")
            if not on: fails.append(f"{tag}: PC map didn't switch on"); await ctx.close(); continue
            box = await A.evaluate("()=>{ const r=document.getElementById('mapwrap').getBoundingClientRect(); return [r.width, r.height]; }")
            if box[0] < vw - 2 or box[1] < vh - 2: fails.append(f"{tag}: map doesn't fill the window {box}")
            if not await A.is_visible("#pcbar"): fails.append(f"{tag}: no bottom bar")
            # leave town so the hero stands on the road (home screen)
            await A.evaluate("()=>{ const S=__dbg.save(); S.location=null; S.x+=0.01; __ui.go('map'); }"); await A.wait_for_timeout(900)
            await A.evaluate(CLEAR); await A.wait_for_timeout(300)
            await shot(A, "home_map")
            if not await A.is_visible("#pcquest"): fails.append(f"{tag}: quest tracker not shown")
            await A.evaluate(CLEAR); await A.wait_for_timeout(300)
            await shot(A, "tracker_open")
            await A.evaluate(CLEAR); await A.keyboard.press("q"); await A.wait_for_timeout(700)
            if not await A.evaluate("()=>document.documentElement.classList.contains('pcq-off')"): fails.append(f"{tag}: Q didn't hide the tracker")
            await shot(A, "tracker_collapsed")
            await A.evaluate("()=>document.getElementById('pcqtab').click()"); await A.wait_for_timeout(700)   # (Playwright misreads boxes under the A11Y page zoom)
            if await A.evaluate("()=>document.documentElement.classList.contains('pcq-off')"): fails.append(f"{tag}: edge tab didn't bring the tracker back")
            # wheel zoom toward the cursor and keys
            await A.evaluate(CLEAR)
            z0 = await A.evaluate("()=>__dbg.view().zoom")
            await A.mouse.move(vw * 0.6, vh * 0.55)
            for _ in range(4):   # a late quest pop-up would (rightly) swallow the wheel
                await A.evaluate("document.getElementById('modal')?.remove()"); await A.mouse.wheel(0, -240); await A.wait_for_timeout(80)
            await A.wait_for_timeout(600)
            z1 = await A.evaluate("()=>__dbg.view().zoom")
            if not z1 > z0: fails.append(f"{tag}: wheel didn't zoom in ({z0} -> {z1})")
            await shot(A, "zoomed_in")
            await A.keyboard.down("d"); await A.wait_for_timeout(400); await A.keyboard.up("d")
            await A.keyboard.press(" "); await A.wait_for_timeout(500)
            # back in town: click the town you're in → its places beside the map
            await A.evaluate(TOWN, "Whiterun"); await A.wait_for_timeout(600)
            await A.evaluate("()=>{ __ui.go('town'); PCMAP.refresh(); }"); await A.wait_for_timeout(700)
            if not await A.evaluate("()=>document.documentElement.classList.contains('pc-side')"): fails.append(f"{tag}: town panel isn't a side panel")
            await shot(A, "town_panel")
            await A.evaluate("()=>{ __ui.go('map'); PCMAP.refresh(); }"); await A.wait_for_timeout(400)
            # Tab: the compass over a dimmed map
            await A.keyboard.press("Tab"); await A.wait_for_timeout(800)
            if not await A.is_visible("#tw"): fails.append(f"{tag}: Tab didn't open the compass")
            await shot(A, "tab_overlay")
            await A.keyboard.press("Escape"); await A.wait_for_timeout(400); await A.evaluate(CLEAR)
            # J: the Journal full-screen over the blurred map
            await A.keyboard.press("j"); await A.wait_for_timeout(800)
            await shot(A, "journal_full")
            await A.evaluate(CLEAR); await A.evaluate("()=>{ __ui.go('map'); PCMAP.refresh(); }"); await A.wait_for_timeout(400)

            # a second player in Whiterun: a Stranger until greeted
            B = await player("pb", "Kacper")
            bid = await B.evaluate("()=>__dbg.save().id"); aid = await A.evaluate("()=>__dbg.save().id")
            await A.bring_to_front(); await A.evaluate("()=>__dbg.publish()"); await A.wait_for_timeout(31000)   # player cards refresh
            pos = await A.evaluate(HERO_AT, bid)
            print(tag, "B on A's map:", pos)
            if not pos: fails.append(f"{tag}: the other player isn't on the map")
            elif pos[2] not in ("Stranger", "Nieznajomy") or not pos[3]: fails.append(f"{tag}: other player not labelled Stranger ({pos[2]})")
            await shot(A, "stranger")
            if pos:
                await A.mouse.click(pos[0], pos[1]); await A.wait_for_timeout(500)
                await shot(A, "stranger_card")
                if not await A.is_visible("#greetcard [data-g=greet]"): fails.append(f"{tag}: no Greet button on the Stranger's card")
                else:
                    await A.click("#greetcard [data-g=greet]"); await A.wait_for_timeout(1500)
                    await B.bring_to_front(); await B.wait_for_timeout(800)
                    if not await B.is_visible("#greetask"): fails.append(f"{tag}: B got no Accept prompt")
                    else:
                        await shot(B, "greet_prompt")
                        await B.click("#greetask [data-g=yes]"); await B.wait_for_timeout(800)
                    await A.bring_to_front(); await A.wait_for_timeout(1500)
                    kn = await A.evaluate("(id)=>!!(__dbg.save().known||{})[id]", bid)
                    knB = await B.evaluate("(id)=>!!(__dbg.save().known||{})[id]", aid)
                    if not kn or not knB: fails.append(f"{tag}: names not learned (A knows B {kn}, B knows A {knB})")
                    await A.wait_for_timeout(800)
                    pos2 = await A.evaluate(HERO_AT, bid)
                    print(tag, "after greeting:", pos2)
                    if not pos2 or pos2[2] != "Kacper": fails.append(f"{tag}: greeted player not shown by name ({pos2})")
                    await shot(A, "greeted")
            if errs: fails.append(f"{tag}: page errors {errs[:4]}")
            await ctx.close()
        # a phone keeps its layout
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg = await ctx.new_page()
        await pg.goto(f"http://localhost:{PORT}/index.html?assets&net=bc&notut&p=pphone"); await pg.wait_for_timeout(1500)
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Phone"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        if await pg.evaluate("()=>document.documentElement.classList.contains('pcmap')"): fails.append("phone: PC map switched on")
        await pg.evaluate(CLEAR); await pg.screenshot(path=os.path.join(OUT, "phone_unchanged.png"))
        await ctx.close()
        await b.close()
    print("screenshots in", OUT)
    if fails:
        print("FAIL"); [print(" -", f) for f in fails]; sys.exit(1)
    print("OK")

asyncio.run(main())
