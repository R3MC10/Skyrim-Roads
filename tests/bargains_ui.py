"""Daedric bargains on screen (bargains.js): the black shrine on the road, accepting a contract, the Daedric bargains
fold on the Character page (contract card, artifact cards, Ascend / Refuse / Bind), and the Ascend popup.
Phone (390x844), desktop (1920x1080) and phone in Polish.
Run from the repo root:  PYTHONIOENCODING=utf-8 python tests/bargains_ui.py [port] [outdir]   (default  or the temp folder)"""
import asyncio, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[2] if len(sys.argv) > 2 else (os.environ.get("SHOTS") or os.path.join(__import__("tempfile").gettempdir(), "out_dbg")); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9600, 9700):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port in 9600-9699")

QA = "&assets" if os.environ.get("ASSETS") else ""   # ASSETS=1: load the painted art too
PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != "0" else free_port()
HERO = """() => { document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S = window.__dbg.save(); S.level = 22; S._test = true; S.gold = 900; G.setHealth(S, G.maxHealth(S)); S.dungeon = null;
  S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun; S.bargain = null; return S.level; }"""
SHRINE = """() => { document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S = window.__dbg.save(); S.location = null; G.startTrip(S, 'Riverwood', WORLD.places.Riverwood.slice(0, 2));
  const e = BARGAIN.makeEvent(S, 'hircine'); S.trip.status = 'event'; S.trip.event = e; window.__dbg.openEvent(); return e.p; }"""
ARTS = """() => { document.querySelectorAll('#modal').forEach(m=>m.remove());
  const S = window.__dbg.save(); S.trip = null; S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun;
  S.bargain = { c: { p: 'meridia', step: 1, n: 0, at: G.now() }, arts: { hircine: { deeds: 34, at: G.now() }, dagon: { deeds: 17, at: G.now() }, azura: { deeds: 40, asc: true, at: G.now() } },
    bound: 'hircine', done: ['hircine', 'dagon', 'azura'], offAt: G.now() };
  window.__ui.go('hero'); return true; }"""
# element shots of a tall fold: hide floating bits (toasts, banners, the tab bar) that would paint over it
HIDE = """() => { for (const e of document.querySelectorAll('body *')) { if (e.closest('#side') || e.closest('#modal')) continue; const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') { e.dataset.dbgHid = e.style.visibility; e.style.visibility = 'hidden'; } } }"""
UNHIDE = """() => { for (const e of document.querySelectorAll('[data-dbg-hid]')) { e.style.visibility = e.dataset.dbgHid; delete e.dataset.dbgHid; } }"""
OPEN = """() => { const d = document.querySelector('#side details[data-m2f=bargains]'); if (!d) return false; d.open = true; d.scrollIntoView({ block: 'start' }); return true; }"""

async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    errs, bad, shots = [], [], []
    def check(ok, what):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok: bad.append(what)
    try:
        async with async_playwright() as p:
            try: b = await p.chromium.launch()
            except Exception: b = await p.chromium.launch(channel="chrome")
            for vw, vh, tag, pl in [(390, 844, "phone", False), (1920, 1080, "pc", False), (390, 844, "phonePL", True)]:
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 800 else 1)
                if pl: await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({ lang: 'pl' }))")
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)))
                async def shot(name, el=None):
                    if el: await pg.evaluate(HIDE)
                    path = os.path.join(OUT, f"daedric_{tag}_{name}.png")
                    if el: await el.screenshot(path=path)
                    else: await pg.screenshot(path=path)
                    shots.append(path)
                    if el: await pg.evaluate(UNHIDE)
                n0 = len(errs)
                for _ in range(3):
                    await pg.goto(f"http://127.0.0.1:{PORT}/index.html?notut&p=dbg{tag}{QA}")
                    try: await pg.wait_for_selector(".press", timeout=10000); break
                    except Exception: print(tag, "title screen didn't come up, reloading"); del errs[n0:]   # a half-loaded page (a script dropped by the little server) doesn't count
                await pg.wait_for_timeout(800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodny"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                await pg.wait_for_function("() => !!window.__dbg?.save?.()", timeout=20000)   # painted art (?assets) can make the start slower
                await pg.evaluate(HERO)
                # 1. the shrine on the road
                for _ in range(4):   # other game popups (quests, news) can land on top: try again until ours is the one showing
                    pr = await pg.evaluate(SHRINE); await pg.wait_for_timeout(900)
                    if await pg.evaluate("document.querySelectorAll('#modal').length === 1 && !!document.querySelector('#modal [data-act=ev][data-c=accept]')"): break
                await pg.evaluate("document.querySelectorAll('#modal').forEach(m => { if (!m.querySelector('[data-c=accept]')) m.remove(); })")
                m = await pg.query_selector("#modal:has([data-c=accept])")
                for _ in range(3):
                    if m: break
                    await pg.evaluate(SHRINE); await pg.wait_for_timeout(200); m = await pg.query_selector("#modal:has([data-c=accept])")
                check(m is not None and pr == "hircine", f"{tag}: shrine event opens ({pr})")
                if m:
                    t = await m.text_content()
                    check(("Hircyn" in t or "Hircine" in t) and "contract" not in t if pl else "Hircine" in t and "contract" in t, f"{tag}: shrine text ({t[:80]!r})")
                    await shot("shrine")
                    acc = False
                    for _ in range(4):   # a late popup may have replaced the shrine: open it again and accept at once
                        acc = await pg.evaluate("(() => { const b = document.querySelector('#modal [data-act=ev][data-c=accept]'); if (b) b.click(); return !!b; })()")
                        if acc: break
                        await pg.evaluate(SHRINE); await pg.wait_for_timeout(300)
                    check(acc, f"{tag}: accept button")
                    await pg.wait_for_timeout(900)
                    check(await pg.evaluate("window.__dbg.save().bargain?.c?.p === 'hircine'"), f"{tag}: contract taken")
                    await shot("accepted")
                # 2. the Character page fold
                await pg.evaluate(ARTS); await pg.wait_for_timeout(900); await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                check(await pg.evaluate(OPEN), f"{tag}: Daedric bargains fold on Character")
                await pg.wait_for_timeout(500)
                fold = await pg.query_selector("#side details[data-m2f=bargains]")
                if fold:
                    t = await fold.text_content()
                    check(("Układy" in t or "układy" in t) and "Daedric bargains" not in t if pl else "Daedric bargains" in t, f"{tag}: fold title")
                    check(await pg.evaluate("document.querySelectorAll('#side .dbg-card:not(.dbg-con)').length") == 3, f"{tag}: three artifact cards")
                    check(await pg.evaluate("!!document.querySelector('#side [data-act=dbgasc][data-id=hircine]')"), f"{tag}: Ascend button on the ready artifact")
                    ov = await pg.evaluate("[...document.querySelectorAll('#side details[data-m2f=bargains] *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className).slice(0, 5)")
                    check(ov == [], f"{tag}: nothing spills off the screen {ov}")
                    await pg.wait_for_timeout(800); await shot("fold", await pg.query_selector("#side details[data-m2f=bargains]"))
                    await pg.evaluate("document.querySelector('#side [data-act=dbgasc][data-id=hircine]').scrollIntoView({block:'center'})")
                    await shot("screen")
                    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove()); document.querySelector('#side [data-act=dbgasc][data-id=hircine]').click()"); await pg.wait_for_timeout(900)
                    check(await pg.evaluate("BARGAIN.stage(window.__dbg.save(), 'hircine')") == 3, f"{tag}: Ascend works")
                    await shot("ascend")
                    await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())"); await pg.wait_for_timeout(300)
                    await pg.evaluate(OPEN); await pg.wait_for_timeout(400)
                    check(await pg.evaluate("!!document.querySelector('#side [data-act=dbgsleep][data-id=hircine]')"), f"{tag}: Let it sleep after ascending")
                    fold = await pg.query_selector("#side details[data-m2f=bargains]")
                    if fold: await shot("fold_after", await pg.query_selector("#side details[data-m2f=bargains]"))
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
        try: srv.wait(timeout=5)
        except Exception: srv.kill()
    check(not errs, f"no page errors {errs[:3]}")
    print("\n".join(shots))
    print("bargains_ui", "FAILED " + str(len(bad)) if bad else "ok")
    sys.exit(1 if bad else 0)

asyncio.run(main())
