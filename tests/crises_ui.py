"""Regional crises on screen (crises.js): the Hold status line on a town page, the notice strip, the map sign,
the Hold status card, a contract fight and the ringleader. Phone (390x844), desktop (1920x1080) and phone in Polish.
Run from the repo root:  PYTHONIOENCODING=utf-8 python tests/crises_ui.py [port] [outdir]   (default  or the temp folder)"""
import asyncio, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[2] if len(sys.argv) > 2 else (os.environ.get("SHOTS") or os.path.join(__import__("tempfile").gettempdir(), "out_cr")); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9500, 9600):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port in 9500-9599")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != "0" else free_port()
SHIFT = "window.__off = 0; (() => { const n = Date.now.bind(Date); Date.now = () => n() + window.__off; })();"
# jump the clock into the next crisis at a stage (1..5) and put the hero in its capital
JUMP = """(stage) => {
  const t0 = (Date.now() - window.__off) / 1000, c0 = CRISES.cycleAt(t0);
  for (let c = c0 + 1; c < c0 + 10; c++) { const cr = CRISES.picks(c)[0]; if (!cr) continue;
    const t = cr.start + (stage - 0.5) * CRISES.STAGE;
    window.__off = (t - t0) * 1000;
    const S = window.__dbg.save(); S.level = Math.max(S.level, 25); S.trip = null; S.location = cr.place; [S.x, S.y] = WORLD.places[cr.place];
    G.setHealth(S, G.maxHealth(S)); return cr.id + " " + cr.chain + " " + cr.hold; }
  return null; }"""

async def main():
    srv = subprocess.Popen(["node", os.path.join(ROOT, "tests", "serve.js"), str(PORT), os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)   # node: python's server refuses connections under load
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
                await ctx.add_init_script(SHIFT)
                if pl: await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({ lang: 'pl' }))")
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)))
                async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                async def shot(name, el=None):
                    path = os.path.join(OUT, f"crises_{tag}_{name}.png")
                    if el:   # the map and its strips redraw every second: an element can be swapped out under us
                        try: await el.scroll_into_view_if_needed(timeout=3000); await el.screenshot(path=path, timeout=5000)
                        except Exception as e: print(f"  (shot {name} skipped: {str(e).splitlines()[0]})"); return
                    else: await pg.screenshot(path=path)
                    shots.append(path)
                async def to_map():
                    await clear(); await pg.evaluate("(() => { const l = [...document.querySelectorAll('[data-tab=map]')]; (l.find((e) => e.tagName === 'BUTTON') || l[0])?.click(); })()"); await pg.wait_for_timeout(900); await clear()
                async def sheet():
                    await clear(); await pg.evaluate("(() => { const l = [...document.querySelectorAll('[data-tab=town]')]; (l.find((e) => e.tagName === 'BUTTON') || l[0])?.click(); })()"); await pg.wait_for_timeout(900); await clear()
                    await pg.evaluate("document.querySelector('.cr-town')?.scrollIntoView({block:'center'})")
                    el = await pg.query_selector(".cr-town")
                    if el: await el.click(); await pg.wait_for_timeout(600)
                    return await pg.query_selector(".crsheet")
                n0 = len(errs)
                for _ in range(3):
                    await pg.goto(f"http://localhost:{PORT}/index.html?notut&p=cr{tag}")
                    try: await pg.wait_for_selector(".press", timeout=10000); break
                    except Exception: print(tag, "title screen didn't come up, reloading"); del errs[n0:]   # a half-loaded page doesn't count
                await pg.wait_for_timeout(800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodny"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                # 1. stage 3: town line, strip, map sign
                cr = await pg.evaluate(JUMP, 3); print(tag, "crisis:", cr)
                check(cr is not None, f"{tag}: found a crisis")
                await pg.wait_for_timeout(1500); await to_map(); await pg.evaluate("scrollTo(0, 0)"); await pg.wait_for_timeout(1500)
                await shot("map")
                await pg.evaluate("(() => { const l = [...document.querySelectorAll('[data-tab=town]')]; (l.find((e) => e.tagName === 'BUTTON') || l[0])?.click(); })()"); await pg.wait_for_timeout(1000); await clear()
                await pg.evaluate("scrollTo(0, 0)"); await shot("town")
                tl = await pg.query_selector(".cr-town")
                check(tl is not None, f"{tag}: Hold status line on the town page")
                if tl:
                    await shot("townline", tl)
                    t = await tl.text_content()
                    check(("Stan krainy" in t and "Hold status" not in t) if pl else "Hold status" in t, f"{tag}: town line text ({t[:70]!r})")
                # the strip is news: it sits on the map in the "World news" drawer (gevstack.js), shut by default
                await to_map(); await pg.evaluate("scrollTo(0, 0)")
                for sel in ("#gev [data-gevs=open]", "#gev [data-gevs=news][aria-expanded=false]"):
                    if await pg.query_selector(sel): await pg.evaluate(f"document.querySelector('{sel}')?.click()"); await pg.wait_for_timeout(500)
                strip = await pg.query_selector(".cr-strip")
                check(strip is not None, f"{tag}: crisis notice strip")
                if strip: await shot("strip", strip)
                # 2. the Hold status card
                sh = await sheet()
                check(sh is not None, f"{tag}: the Hold status card opens")
                if sh:
                    await shot("sheet")
                    txt = await pg.evaluate("document.querySelector('.crsheet')?.textContent || ''")
                    if pl: check(all(w in txt for w in ["Stan krainy", "Bezpieczeństwo", "Zlecenia jarla"]) and "Security" not in txt and "How it works" not in txt, f"{tag}: the card is in Polish")
                    else: check(all(w in txt for w in ["Security", "Food", "Prosperity", "Corruption", "The Jarl's contracts", "Stage 3 of 5"]), f"{tag}: the card shows numbers, stage and contracts")
                    over = await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                    check(not over, f"{tag}: no sideways scroll")
                    # a contract fight
                    fb = await pg.query_selector(".crsheet [data-cr=do]:not([disabled])")
                    check(fb is not None, f"{tag}: a contract button is ready")
                    if fb and not pl:
                        await fb.click(); await pg.wait_for_timeout(2500)
                        for _ in range(60):   # turn-by-turn fights: let it play
                            if await pg.query_selector("#modal .fres, #modal h2"): break
                            await pg.wait_for_timeout(300)
                        await shot("contract_result")
                        rel = await pg.evaluate("(() => { const S = window.__dbg.save(); return Object.values(S.crises?.rel || {}).reduce((a, b) => a + b, 0); })()")
                        check(rel > 0, f"{tag}: the contract added relief ({rel})")
                # 3. the ringleader is out
                await clear()
                await pg.evaluate("(() => { const S = window.__dbg.save(), cr = CRISES.crisisIn(G.holdAt([S.x, S.y])); CRISES.mine(S).rel[cr.id] = 12; CRISES.setDocs(); })()")
                sh = await sheet()
                if sh:
                    btn = await pg.query_selector(".crsheet [data-cr=boss]")
                    check(btn is not None, f"{tag}: the ringleader fight button")
                    await shot("boss_sheet")
                await clear(); await to_map(); await pg.evaluate("scrollTo(0, 0)"); await pg.wait_for_timeout(1200)
                if not pl: await shot("map_boss")
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    real = [e for e in errs if "WebSocket" not in e and "net::" not in e]
    check(not real, "no page errors " + str(real[:3]))
    print("\n".join(shots))
    print("crises_ui: " + ("ok" if not bad else f"{len(bad)} FAILED"))
    if bad: sys.exit(1)

asyncio.run(main())
