"""Legendary hunts (leghunt.js) on a phone and a PC: the Jarl's contract board in Dawnstar, taking a contract, the rough
search area on the map, a clue by the road, meeting the beast and the boss fight it opens.
Run from the repo root:  PYTHONIOENCODING=utf-8 python tests/leghunt_ui.py [PORT]   (screenshots in tests/out_leghunt/ or $OUT)"""
import asyncio, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get("OUT") or os.path.join(ROOT, "tests", "out_leghunt"); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9600, 9700):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else free_port()
CLEAN = "document.querySelectorAll('#modal').forEach(m=>m.remove())"

async def main():
    srv = subprocess.Popen(["node", os.path.join(ROOT, "tests", "serve.js"), str(PORT), os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)   # node: python's server refuses connections under load
    time.sleep(1.0)
    errs, bad, shots = [], [], []
    def check(c, what):
        print(("ok   " if c else "FAIL ") + what)
        if not c: bad.append(what)
    try:
        async with async_playwright() as p:
            try: b = await p.chromium.launch()
            except Exception: b = await p.chromium.launch(channel="chrome")
            for vw, vh, tag in [(412, 915, "phone"), (1400, 900, "pc")]:
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 800 else 1, has_touch=vw < 800, is_mobile=vw < 800)
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
                async def shot(name):
                    path = os.path.join(OUT, f"lh_{tag}_{name}.png"); await pg.wait_for_timeout(300); await pg.screenshot(path=path); shots.append(path)
                for _ in range(6):   # python's little test server sometimes drops a script under a burst of requests: reload
                    errs.clear()
                    try:
                        await pg.goto(f"http://localhost:{PORT}/index.html?notut&assets&tb&hub=0&net=bc&p=lh{tag}")
                        await pg.wait_for_selector(".press", timeout=15000); await pg.wait_for_timeout(800)
                        if not errs and not await pg.evaluate("typeof LEGHUNT !== 'undefined'"): errs.append("leghunt.js missing")
                        if errs: raise Exception("a script didn't load " + errs[0])
                        await pg.click(".press", timeout=5000); await pg.click(".mi[data-t=new]", timeout=5000); await pg.wait_for_selector("#nm", timeout=5000)
                        break
                    except Exception as ex: print("title didn't come up, reloading:", str(ex)[:120])
                await pg.fill("#nm", "Hunter"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                await pg.evaluate(CLEAN)
                # a level 20 hunter standing in Dawnstar, with bait in the pack
                await pg.evaluate("""() => { const S = window.__dbg.save(); S.level = 20; S.location = 'Dawnstar'; [S.x, S.y] = WORLD.places.Dawnstar; S.trip = null;
                  S.gold = 500; G.give(S, 'food_venison', 2); G.setHealth(S, G.maxHealth(S)); }""")
                await pg.evaluate("__ui.jump({ tab: 'town', shop: 'hunts' })"); await pg.wait_for_timeout(700); await pg.evaluate(CLEAN)
                n = await pg.evaluate("document.querySelectorAll('.lh-poster').length")
                check(n >= 2, f"{tag}: Dawnstar's board shows {n} beast posters")
                check(await pg.evaluate("!!document.querySelector('.lh-poster img, .lh-poster .lh-pic')"), f"{tag}: posters have a picture of the beast")
                try: await pg.wait_for_function("document.querySelectorAll('.lh-poster .lh-paint img').length >= 2 && [...document.querySelectorAll('.lh-paint img')].every(i => i.complete)", timeout=8000)
                except Exception: pass
                check(await pg.evaluate("document.querySelectorAll('.lh-poster .lh-paint img').length >= 2"), f"{tag}: posters show the painted beast in its gold frame")
                check(not await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1"), f"{tag}: board fits the screen width")
                await pg.evaluate("document.querySelector('.lh-poster')?.scrollIntoView({block:'start'})"); await shot("board")
                await pg.evaluate("document.querySelector('[data-act=lhact][data-id=accept][data-c=whitefang]')?.click()"); await pg.wait_for_timeout(600); await pg.evaluate(CLEAN)
                check(await pg.evaluate("LEGHUNT.cur(window.__dbg.save())?.id === 'whitefang'"), f"{tag}: took the Whitefang contract")
                await pg.evaluate("__ui.jump({ tab: 'town', shop: 'hunts' })"); await pg.wait_for_timeout(500); await pg.evaluate(CLEAN)
                check(await pg.evaluate("!!document.querySelector('.lh-card')"), f"{tag}: the hunt card shows on the board")
                await pg.evaluate("document.querySelector('.lh-card')?.scrollIntoView({block:'start'})"); await shot("card")
                # the map shows a rough area, not a marker
                await pg.evaluate("__ui.go('map')"); await pg.wait_for_timeout(1500); await pg.evaluate(CLEAN)
                await shot("map")
                # a clue by the road inside the area
                await pg.evaluate("""() => { const S = window.__dbg.save(), a = LEGHUNT.area(LEGHUNT.cur(S));
                  S.location = null; S.x = a.x; S.y = a.y; S.trip = { status: 'event', dest: 'Dawnstar', path: [[a.x, a.y]], idx: 0, log: [], lastTick: G.now() };
                  S.trip.event = LEGHUNT.clueEvent(S); window.__dbg.openEvent(); }""")
                await pg.wait_for_timeout(700)
                check(await pg.evaluate("!!document.querySelector('#modal [data-act=ev]')"), f"{tag}: clue event opens with choices")
                await shot("clue")
                c0 = await pg.evaluate("LEGHUNT.cur(window.__dbg.save()).clues")
                await pg.evaluate("[...document.querySelectorAll('#modal [data-act=ev]')].find(b => b.dataset.c !== 'leave')?.click()"); await pg.wait_for_timeout(900)
                c1 = await pg.evaluate("LEGHUNT.cur(window.__dbg.save())?.clues || 0")
                check(c1 > c0, f"{tag}: following the clue narrows the area ({c0} -> {c1} clues)")
                await pg.evaluate(CLEAN)
                # enough clues: find it and choose how the fight starts
                await pg.evaluate("""() => { const S = window.__dbg.save(), c = LEGHUNT.cur(S); c.clues = Math.max(c.clues, LEGHUNT.NEED); c.known.weak = 1;
                  const h = LEGHUNT.area(c).haunt; S.trip = null; S.location = h; [S.x, S.y] = WORLD.places[h]; G.setHealth(S, G.maxHealth(S));
                  const r = LEGHUNT.trackDown(S); if (r.event) window.__dbg.openEvent(); return r; }""")
                await pg.wait_for_timeout(700)
                opts = await pg.evaluate("[...document.querySelectorAll('#modal [data-act=ev]')].map(b => b.dataset.c)")
                check(all(o in opts for o in ("ambush", "lair", "prep")), f"{tag}: meeting it offers ambush / lair / prepare ({opts})")
                await shot("meet")
                await pg.evaluate("document.querySelector('#modal [data-act=ev][data-c=ambush]')?.click()"); await pg.wait_for_timeout(2500)
                check(await pg.evaluate("!!document.querySelector('#tbf')"), f"{tag}: the boss fight opens")
                await pg.wait_for_timeout(1500)
                check(await pg.evaluate("ASSETS.stateOf('foe-frosttroll') === 'ok'"), f"{tag}: the fight loads Whitefang's painted picture")
                try: await pg.get_by_text("Got it", exact=True).first.click(timeout=1500)
                except Exception: pass
                await pg.mouse.move(2, 2); await pg.wait_for_timeout(400)
                cv = await pg.evaluate_handle("[...document.querySelectorAll('#tbf canvas, canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]")
                try:
                    el = cv.as_element(); await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(500)
                    path = os.path.join(OUT, f"lh_{tag}_scene.png"); await el.screenshot(path=path); shots.append(path)
                except Exception as ex: print("no scene shot:", str(ex)[:100])
                await shot("fight")
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    real = [e for e in errs if "ResizeObserver" not in e]
    check(not real, "no page errors " + "; ".join(real[:3]))
    print("\n".join(shots))
    if bad: print("FAILED:", len(bad)); sys.exit(1)
    print("leghunt ui ok")

asyncio.run(main())
