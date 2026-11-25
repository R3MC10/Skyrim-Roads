"""Lighter menus on screen: the bottom bar lights Items/Magic (not Map) while that menu is open, Social shows four big tabs
and a More row that opens Messages/Trades/Chat/Faction, ordinary windows have a thin line and quest windows keep the gold
frame, the crisis title isn't cut. Phone (390x844), desktop (1920x1080) and phone in Polish.
Run from the repo root:  PYTHONIOENCODING=utf-8 python tests/lightmenus_ui.py [port] [outdir]   (default tests/out_lightmenus/)"""
import asyncio, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "tests", "out_lightmenus"); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9700, 9800):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port in 9700-9799")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != "0" else free_port()
SHIFT = "window.__off = 0; (() => { const n = Date.now.bind(Date); Date.now = () => n() + window.__off; })();"
JUMP = """(stage) => {
  const t0 = (Date.now() - window.__off) / 1000, c0 = CRISES.cycleAt(t0);
  for (let c = c0 + 1; c < c0 + 10; c++) { const cr = CRISES.picks(c)[0]; if (!cr) continue;
    const t = cr.start + (stage - 0.5) * CRISES.STAGE; window.__off = (t - t0) * 1000;
    const S = window.__dbg.save(); S.level = Math.max(S.level, 25); S.trip = null; S.location = cr.place; [S.x, S.y] = WORLD.places[cr.place];
    G.setHealth(S, G.maxHealth(S)); return cr.id; }
  return null; }"""
TAB = "(t) => { const l = [...document.querySelectorAll('#tabs [data-tab=' + t + ']')]; (l.find((e) => e.tagName === 'BUTTON') || l[0])?.click(); }"
CLEAR = "document.querySelectorAll('#modal').forEach(m=>m.remove())"
LIT = "[...document.querySelectorAll('#tabs .tab.on')].map((b) => b.dataset.tab).join()"

async def main():
    with socket.socket() as t: busy = t.connect_ex(("127.0.0.1", PORT)) == 0   # a server already running there: use it
    srv = None if busy else subprocess.Popen(["node", os.path.join(ROOT, "tests", "serve.js"), str(PORT), os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)   # node: python's server refuses connections under load
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
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1, has_touch=vw < 900)
                await ctx.add_init_script(SHIFT)
                if pl: await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({ lang: 'pl' }))")
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)))
                async def shot(name):
                    path = os.path.join(OUT, f"lm_{tag}_{name}.png"); await pg.screenshot(path=path); shots.append(path)
                await pg.goto(f"http://127.0.0.1:{PORT}/index.html?notut&net=bc&assets&p=lm{tag}")
                await pg.wait_for_selector(".press"); await pg.wait_for_timeout(400); await pg.click(".press"); await pg.wait_for_selector(".mi[data-t=new]"); await pg.wait_for_timeout(300)
                await pg.click(".mi[data-t=new]"); await pg.wait_for_selector("#nm", timeout=60000); await pg.fill("#nm", "Hrodny"); await pg.click("#begin")
                await pg.wait_for_timeout(4500); await pg.evaluate(CLEAR)
                await pg.evaluate("() => { const S = window.__dbg.save(); S.gold = 4000; S.location = 'Whiterun'; [S.x, S.y] = WORLD.places.Whiterun; S.trip = null; }")
                mobile = vw < 900
                # 1. the bottom bar (phones; the PC bar lights its tab too: tabs5_ui.py checks it)
                if mobile:
                    await pg.evaluate(TAB, "world"); await pg.wait_for_timeout(500); await pg.evaluate(CLEAR)
                    await pg.evaluate("__ui.go('items')"); await pg.wait_for_timeout(700)
                    await pg.evaluate("window.__ui.refresh()"); await pg.wait_for_timeout(400)
                    check(await pg.evaluate(LIT) == "hero", f"{tag}: Items menu open -> Hero lit ({await pg.evaluate(LIT)})")
                    await pg.evaluate("window.__ui.closeMenu()"); await pg.evaluate("__ui.go('magic')"); await pg.wait_for_timeout(700)
                    await pg.evaluate("window.__ui.refresh()"); await pg.wait_for_timeout(400)
                    check(await pg.evaluate(LIT) == "hero", f"{tag}: Magic menu open -> Hero lit ({await pg.evaluate(LIT)})")
                    await pg.evaluate("window.__ui.closeMenu()"); await pg.wait_for_timeout(300)
                    check(await pg.evaluate(LIT) == "world", f"{tag}: menu closed -> World lit again ({await pg.evaluate(LIT)})")
                # 2. Social: four big tabs and a More row
                await pg.evaluate(CLEAR); await pg.evaluate("() => window.__ui.go('social')"); await pg.wait_for_timeout(500); await pg.evaluate(CLEAR)
                big = await pg.evaluate("[...document.querySelectorAll('.socseg [data-act=soctab]')].map((b) => b.dataset.id).join()")
                more = await pg.evaluate("[...document.querySelectorAll('.socmore [data-act=soctab]')].map((b) => b.dataset.id).join()")
                check(big == "party,company,friends,realm", f"{tag}: four big tabs ({big})")
                check(more == "msgs,trades,chat,faction", f"{tag}: More row ({more})")
                h = await pg.evaluate("(() => { const a = document.querySelector('.socseg').getBoundingClientRect(), z = document.querySelector('.socmore').getBoundingClientRect(); return Math.round(z.bottom - a.top); })()")
                check(h <= 140, f"{tag}: Social tabs take {h}px (was about 330 on a phone)")
                rows = await pg.evaluate("new Set([...document.querySelectorAll('.socseg button')].map((b) => Math.round(b.getBoundingClientRect().top))).size")
                check(rows == 1, f"{tag}: big tabs on one row ({rows})")
                for k, word in [("msgs", "Wiadomości" if pl else "Messages"), ("trades", "Wymiany" if pl else "Trades"), ("chat", "Czat" if pl else "Chat"), ("faction", "Frakcja" if pl else "Faction"), ("company", "Kompania" if pl else "Company"), ("realm", "Królestwo" if pl else "Realm")]:
                    await pg.evaluate(f"document.querySelector('[data-act=soctab][data-id={k}]')?.click()"); await pg.wait_for_timeout(350)
                    on = await pg.evaluate(f"!!document.querySelector('[data-act=soctab][data-id={k}].on')")
                    lab = await pg.evaluate(f"document.querySelector('[data-act=soctab][data-id={k}]')?.textContent || ''")
                    check(on and word.lower() in lab.lower(), f"{tag}: {k} opens from its tab ({lab!r})")
                    if k == "msgs": await pg.evaluate("(() => { const e = document.querySelector('.socseg'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 120); })()"); await shot("social_more")
                over = await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                check(not over, f"{tag}: no sideways scroll on Social")
                # 3. frames: a plain window gets a thin line, a quest window the gold frame
                await pg.evaluate("window.__dbg.message('A quiet road', 'Nothing happens on the road.')"); await pg.wait_for_timeout(300)
                bw = await pg.evaluate("getComputedStyle(document.querySelector('#modal .sheet')).borderTopWidth")
                check(float(bw[:-2]) < 2, f"{tag}: plain window has a thin line ({bw})")
                await pg.evaluate(CLEAR); await pg.evaluate("window.__dbg.message('Quest', 'Quest complete.')"); await pg.wait_for_timeout(300)
                pres = await pg.evaluate("document.querySelector('#modal .sheet')?.classList.contains('prestige')")
                bw = await pg.evaluate("getComputedStyle(document.querySelector('#modal .sheet')).borderTopWidth")
                check(pres and float(bw[:-2]) > 16, f"{tag}: quest window keeps the gold frame ({pres}, {bw})")
                await shot("quest"); await pg.evaluate(CLEAR)
                # 4. buttons: one family
                st = await pg.evaluate("(() => { const b = document.querySelector('.btn.pri:not(.sm)') || document.querySelector('.btn'); const s = getComputedStyle(b); return [s.borderTopLeftRadius, Math.round(b.getBoundingClientRect().height), s.backgroundImage]; })()")
                check(st[0] == "3px" and st[2] == "none", f"{tag}: buttons are flat with 3px corners ({st})")
                # 5. the crisis title wraps
                cr = await pg.evaluate(JUMP, 3); await pg.wait_for_timeout(1200)
                await pg.evaluate(TAB, "town"); await pg.wait_for_timeout(900); await pg.evaluate(CLEAR)
                el = await pg.query_selector(".cr-town")
                if el and cr:
                    await pg.evaluate("document.querySelector('.cr-town').click()"); await pg.wait_for_timeout(700)
                    cut = await pg.evaluate("(() => { const b = document.querySelector('.cr-ch b'); return b ? b.scrollWidth > b.clientWidth + 1 : null; })()")
                    check(cut is False, f"{tag}: crisis title not cut ({cr})")
                    bw = await pg.evaluate("getComputedStyle(document.querySelector('#modal .sheet')).borderTopWidth")
                    check(float(bw[:-2]) < 2, f"{tag}: Hold status has a thin line, not knotwork ({bw})")
                    await shot("crisis")
                else: print(f"skip {tag}: no crisis line in town ({cr})")
                await ctx.close()
            await b.close()
    finally:
        if srv: srv.terminate()
    real = [e for e in errs if "WebSocket" not in e and "net::" not in e]
    check(not real, "no page errors " + str(real[:3]))
    print("\n".join(shots))
    print("lightmenus_ui: " + ("ok" if not bad else f"{len(bad)} FAILED"))
    if bad: sys.exit(1)

asyncio.run(main())
