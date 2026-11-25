"""Heists on screen (heists.js): the town card, the plan step, a locked door, the escape and the end card.
Phone (375x812), desktop (1366x768) and phone in Polish.
Run from the repo root:  PYTHONIOENCODING=utf-8 python tests/heists_ui.py [port] [outdir]   (default tests/out_hz/)"""
import asyncio, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "tests", "out_hz"); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9600, 9700):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port in 9600-9699")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != "0" else free_port()
PREP = """() => { const S = window.__dbg.save(); S.level = 20; S.trip = null; S.dungeon = null; S.bounty = {}; S.gold = 3000;
  S.location = "Whiterun"; [S.x, S.y] = WORLD.places.Whiterun; for (const k of ["Sneak", "Lockpicking", "Speechcraft"]) S.skills[k].lvl = 45;
  G.setHealth(S, G.maxHealth(S)); return S.location; }"""
TOWN = "(() => { const l = [...document.querySelectorAll('[data-tab=town]')]; (l.find((e) => e.tagName === 'BUTTON') || l[0])?.click(); })()"

async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    errs, bad, shots = [], [], []
    def check(ok, what):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok: bad.append(what)
    try:
        async with async_playwright() as p:
            try: b = await p.chromium.launch()
            except Exception: b = await p.chromium.launch(channel="chrome")
            for vw, vh, tag, pl in [(375, 812, "phone", False), (1366, 768, "pc", False), (375, 812, "phonePL", True)]:
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 800 else 1)
                if pl: await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({ lang: 'pl' }))")
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)))
                async def shot(name, el=None):
                    path = os.path.join(OUT, f"heists_{tag}_{name}.png")
                    if el: await el.screenshot(path=path)
                    else: await pg.screenshot(path=path)
                    shots.append(path)
                for _ in range(3):
                    await pg.goto(f"http://localhost:{PORT}/index.html?notut&p=hz{tag}")
                    try: await pg.wait_for_selector(".press", timeout=10000); break
                    except Exception: print(tag, "title screen didn't come up, reloading")
                await pg.wait_for_timeout(800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodny"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                await pg.evaluate(PREP)
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                await pg.evaluate(TOWN); await pg.wait_for_timeout(900)
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                await pg.evaluate("document.querySelector('[data-act=shop][data-id=heist]')?.click()"); await pg.wait_for_timeout(900)
                card = await pg.query_selector(".hz-card")
                check(card is not None, f"{tag}: heist card on the town page")
                if card:
                    await pg.wait_for_timeout(1500); await pg.evaluate("document.querySelectorAll('#modal, .toast, .qdone, .ach-pop').forEach(m=>m.remove())")
                    card = await pg.query_selector(".hz-card")
                    await card.scroll_into_view_if_needed(); await pg.wait_for_timeout(300); await shot("town")
                    txt = await card.text_content()
                    check(("Skok" in txt or "skok" in txt) if pl else "Heist" in txt or "heist" in txt, f"{tag}: card text ({txt[:60]!r})")
                await pg.evaluate("document.querySelector('[data-hs=start]')?.click()"); await pg.wait_for_timeout(900)
                sh = await pg.query_selector(".sheet.hz")
                check(sh is not None, f"{tag}: the heist sheet opens")
                if sh:
                    await shot("prepare")
                    for k in ["case", "go"]:
                        await pg.evaluate(f"document.querySelector('.sheet.hz [data-hs=do][data-k={k}]')?.click()"); await pg.wait_for_timeout(700)
                    await shot("door")
                    # bribe past both doors (a sure thing), take the prize, then the escape
                    await pg.evaluate("Math.random = () => 0.3")
                    for k in ["bribe", "bribe", "prize"]:
                        await pg.evaluate(f"document.querySelector('.sheet.hz [data-hs=do][data-k={k}]')?.click()"); await pg.wait_for_timeout(700)
                    await shot("escape")
                    await pg.evaluate("document.querySelector('.sheet.hz [data-hs=do][data-k=calm]')?.click()"); await pg.wait_for_timeout(1000)
                    end = await pg.query_selector(".sheet.hz .hz-sum")
                    check(end is not None, f"{tag}: the end card")
                    await shot("end")
                    full = await pg.evaluate("document.querySelector('.sheet.hz')?.textContent || ''")
                    if pl: check(not any(w in full for w in ["The fence", "Bounty", "Clean job"]), f"{tag}: end card in Polish")
                    over = await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                    check(not over, f"{tag}: no sideways scroll")
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    real = [e for e in errs if "heist" in e.lower() or "HEISTS" in e]
    check(not real, "no heist page errors " + str(real[:3]))
    print("shots:", *shots, sep="\n  ")
    print("heists_ui", "FAIL" if bad else "ok")
    sys.exit(1 if bad else 0)

asyncio.run(main())
