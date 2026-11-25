"""The Commissions board on screen (commissions.js): Social -> Company -> Commissions with a small company, one order
half done by a friend, goods in the bag to hand in, and a caravan to set out with. Phone (390x844), PC (1440x900)
and phone in Polish. Run from the repo root:
PYTHONIOENCODING=utf-8 python tests/commissions_ui.py [port] [outdir]   (default tests/out_cms/)"""
import asyncio, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "tests", "out_cms"); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9600, 9700):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port in 9600-9699")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != "0" else free_port()
SETUP = """async () => {
  const S = window.__dbg.save(), L = LONGHOUSE, CM = COMMISSIONS; S.level = Math.max(S.level, 14); S.trip = null; S.dungeon = null; S.location = "Whiterun"; [S.x, S.y] = WORLD.places.Whiterun;
  S.gold = 20000;
  let e = await L.found(S, "The Iron Wolves"); if (e) return "found: " + e;
  const d = L.mine(S), t = Math.floor(Date.now() / 1000);
  await Store.change("longhouse", d.id, (q) => ({ ...q, site: "Whiterun", members: { ...q.members, f1: { name: "Kacper", role: "officer", t: t - 50 } } }));
  const list = CM.active(L.mine(S));
  // a friend's part on one delivery, and goods in the bag for every delivery
  const del = list.filter((c) => c.item);
  if (del[0]) await Store.change("longhouse", d.id, (q) => ({ ...q, tx: { ...q.tx, "cmc-f1-x": { k: "cmc", key: del[0].key, q: 1, by: "f1", who: "Kacper", t: t - 30, g: 0 } } }));
  for (const c of del) G.give(S, c.item, c.need);
  return null; }"""

async def main():
    srv = subprocess.Popen(["node", os.path.join(ROOT, "tests", "serve.js"), str(PORT), os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    errs, bad, shots = [], [], []
    def check(ok, what):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok: bad.append(what)
    try:
        async with async_playwright() as p:
            try: b = await p.chromium.launch()
            except Exception: b = await p.chromium.launch(channel="chrome")
            for vw, vh, tag, pl in [(390, 844, "phone", False), (1440, 900, "pc", False), (390, 844, "phonePL", True)]:
                ctx = await b.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2 if vw < 800 else 1)
                if pl: await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({ lang: 'pl' }))")
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)))
                async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                async def shot(name, sel="#lng-root"):
                    path = os.path.join(OUT, f"commissions_{tag}_{name}.png")
                    await clear()
                    for _ in range(4):
                        try:
                            el = await pg.query_selector(sel) if sel else None
                            if el: await el.screenshot(path=path, timeout=4000)
                            else: await pg.screenshot(path=path)
                            break
                        except Exception as e: print(tag, name, "retry shot", str(e)[:60]); await pg.wait_for_timeout(300)
                    shots.append(path)
                async def tap(sel):
                    await clear(); await pg.evaluate("(s) => document.querySelector(s)?.click()", sel)
                async def board():
                    await clear(); await pg.evaluate("() => window.__ui.go('social')"); await pg.wait_for_timeout(400)
                    await tap("[data-act=soctab][data-id=company]"); await pg.wait_for_timeout(500)
                    await tap("[data-lng=tab][data-id=cms]"); await pg.wait_for_timeout(500)
                n0 = len(errs)
                for _ in range(3):
                    await pg.goto(f"http://localhost:{PORT}/index.html?notut&p=cms{tag}")
                    try: await pg.wait_for_selector(".press", timeout=10000); break
                    except Exception: print(tag, "title screen didn't come up, reloading"); del errs[n0:]
                await pg.wait_for_timeout(800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodny"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                r = await pg.evaluate(SETUP)
                check(r is None, f"{tag}: set up ({r})")
                await pg.wait_for_timeout(6000)   # let the start-of-game toasts pass
                await board()
                n = await pg.evaluate("document.querySelectorAll('#lng-root .cms-card').length")
                check(3 <= n <= 5, f"{tag}: 3 to 5 order cards ({n})")
                over = await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                check(not over, f"{tag}: the board fits the width")
                txt = await pg.evaluate("document.querySelector('#lng-root')?.textContent || ''")
                if pl: check("Zlecenia" in txt and "Hand in" not in txt and "Company level" not in txt, f"{tag}: Polish screen")
                else: check("Company level" in txt and "Hand in" in txt, f"{tag}: the board and a hand-in button")
                check(await pg.evaluate("document.querySelectorAll('#lng-root .cms-who').length") >= 1, f"{tag}: a friend's help shows on the card")
                await shot("board")
                # hand in the first delivery
                key = await pg.evaluate("document.querySelector('#lng-root [data-cms=give]:not([disabled])')?.dataset.k || null")
                check(key is not None, f"{tag}: a hand-in button you can press")
                if key:
                    await tap(f"#lng-root [data-cms=give][data-k='{key}']"); await pg.wait_for_timeout(1200)
                    q = await pg.evaluate("(k) => COMMISSIONS.progress(LONGHOUSE.mine(window.__dbg.save()), k).q", key)
                    check(q >= 1, f"{tag}: the goods went toward the order ({q})")
                    await board()
                    await shot("handed")
                # set out with a caravan if there is one (from its own town)
                ck = await pg.evaluate("""() => { const S = window.__dbg.save(), c = COMMISSIONS.active(LONGHOUSE.mine(S)).find((q) => q.kind === 'escort');
                  if (!c) return null; S.location = c.town; [S.x, S.y] = WORLD.places[c.town]; return c.key; }""")
                if ck:
                    await board(); await tap(f"#lng-root [data-cms=escort][data-k='{ck}']"); await pg.wait_for_timeout(600)
                    check(await pg.evaluate("!!(window.__dbg.save().cmEsc)"), f"{tag}: set out with the caravan")
                    await board()
                    await pg.evaluate("() => { const c = document.querySelector('#lng-root .cms-card [data-cms=drop]'); c && c.scrollIntoView({ block: 'center' }); }")
                    await shot("caravan")
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    for e in errs: print("page error:", e)
    print(f"{len(shots)} shots in {OUT}")
    if bad or errs: print("FAILED:", bad); sys.exit(1)
    print("commissions ui ok")

asyncio.run(main())
