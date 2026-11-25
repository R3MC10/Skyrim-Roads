"""The adventuring company longhouse on screen (longhouse.js): Social → Company before founding, then founded with a few
rooms built, trophies on the wall, a plan set and three members; every tab. Phone (390x844), desktop (1920x1080) and
phone in Polish. Run from the repo root:  PYTHONIOENCODING=utf-8 python tests/longhouse_ui.py [port] [outdir]   (default tests/out_lng/)"""
import asyncio, json, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "tests", "out_lng"); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9600, 9700):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port in 9600-9699")

QA = "&assets" if os.environ.get("ASSETS") else ""   # ASSETS=1: load the painted art too
PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] != "0" else free_port()
# found a company, fill the treasury, build rooms, hang trophies, set a plan, add two members
SETUP = """async () => {
  const S = window.__dbg.save(), L = LONGHOUSE; S.level = Math.max(S.level, 20); S.trip = null; S.dungeon = null; S.location = "Whiterun"; [S.x, S.y] = WORLD.places.Whiterun;
  S.gold = 60000;
  let e = await L.found(S, "The Iron Wolves"); if (e) return "found: " + e;
  await L.deposit(S, 30000);
  const want = { forge: 2, library: 1, trophy: 2, stables: 1, plan: 2 };
  for (const [r, lv] of Object.entries(want)) for (let l = 1; l <= lv; l++) {
    const c = L.costOf(r, l, L.derive(L.mine(S)).n, S);
    for (const [k, q] of Object.entries(c.m)) { G.give(S, k, q); await L.giveMat(S, k, q); }
    e = await L.build(S, r); if (e) return "build " + r + ": " + e; }
  for (const [k, q] of [["mat_iron", 7], ["mat_leather", 3]]) { G.give(S, k, q + 4); await L.giveMat(S, k, q); }
  await L.setPlan(S, "spear");
  await L.addTrophy(S, "boss-dragon"); await L.addTrophy(S, "leg-whitefang"); await L.addTrophy(S, "boss-undead");
  const id = L.mine(S).id, t = Math.floor(Date.now() / 1000);
  await Store.change("longhouse", id, (d) => ({ ...d, members: { ...d.members, f1: { name: "Kacper", role: "officer", t: t - 50 }, f2: { name: "Sigrid", role: "member", t: t - 40 } },
    tx: { ...d.tx, "dep-f1-x": { k: "dep", by: "f1", who: "Kacper", t: t - 3000, g: 1200 }, "mat-f2-x": { k: "mat", by: "f2", who: "Sigrid", t: t - 2000, m: { mat_steel: 6 } } } }));
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
                if pl: await ctx.add_init_script("localStorage.setItem('rotn_prefs', JSON.stringify({ lang: 'pl' }))")
                pg = await ctx.new_page()
                pg.on("pageerror", lambda e: errs.append(str(e)))
                async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
                async def shot(name, full=False):
                    path = os.path.join(OUT, f"longhouse_{tag}_{name}.png")
                    await clear()
                    for _ in range(4):
                        try:
                            el = await pg.query_selector("#lng-root")
                            if el and not full: await el.screenshot(path=path, timeout=4000)
                            else: await pg.screenshot(path=path)
                            break
                        except Exception as e: print(tag, name, "retry shot", str(e)[:60]); await pg.wait_for_timeout(300)
                    shots.append(path)
                async def tap(sel):
                    await clear(); await pg.evaluate("(s) => document.querySelector(s)?.click()", sel)
                async def company():
                    await clear(); await pg.evaluate("() => window.__ui.go('social')"); await pg.wait_for_timeout(400)
                    await tap("[data-act=soctab][data-id=company]"); await pg.wait_for_timeout(500)
                n0 = len(errs)
                for _ in range(3):
                    await pg.goto(f"http://localhost:{PORT}/index.html?notut&p=lng{tag}{QA}")
                    try: await pg.wait_for_selector(".press", timeout=10000); break
                    except Exception: print(tag, "title screen didn't come up, reloading"); del errs[n0:]   # a half-loaded page doesn't count
                await pg.wait_for_timeout(800)
                await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Hrodny"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
                await pg.evaluate("() => { const S = window.__dbg.save(); S.gold = 4000; S.location = 'Whiterun'; S.trip = null; }")
                await company()
                root = await pg.query_selector("#lng-root")
                check(root is not None, f"{tag}: the Company tab opens")
                txt = await pg.evaluate("document.querySelector('#lng-root')?.textContent || ''")
                check(("Załóż długi dom" in txt) if pl else ("Found a longhouse" in txt), f"{tag}: the found form")
                await shot("found")
                # found through the button
                await pg.fill("#lng-name", "The Iron Wolves"); await tap("[data-lng=found]"); await pg.wait_for_timeout(600)
                check(await pg.evaluate("!!LONGHOUSE.mine(window.__dbg.save())"), f"{tag}: founded from the screen")
                await pg.evaluate("Store.remove('longhouse', LONGHOUSE.mine(window.__dbg.save()).id)"); await pg.wait_for_timeout(300)
                r = await pg.evaluate(SETUP)
                check(r is None, f"{tag}: set up ({r})")
                await pg.wait_for_timeout(6000)   # let the start-of-game toasts and quest banners pass
                await company()
                n = await pg.evaluate("""() => new Promise((res) => { let k = 0; const ob = new MutationObserver(() => k++); ob.observe(document.body, { childList: true, subtree: true }); setTimeout(() => { ob.disconnect(); res(k); }, 3000); })""")
                print(tag, "DOM changes in 3 s on the company tab:", n)
                for t in ["rooms", "plan", "trophy", "gold", "members", "log"]:
                    await tap(f"[data-lng=tab][data-id={t}]"); await pg.wait_for_timeout(350)
                    over = await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                    check(not over, f"{tag}: {t} fits the width")
                    await shot(t)
                txt = await pg.evaluate("document.querySelector('#lng-root')?.textContent || ''")
                if pl: check("Dziennik" in txt and "Rooms" not in txt and "Treasury" not in txt, f"{tag}: Polish screen")
                await tap("[data-lng=tab][data-id=rooms]"); await pg.wait_for_timeout(300)
                if QA:
                    await pg.wait_for_timeout(1500); await company(); await tap("[data-lng=tab][data-id=rooms]"); await pg.wait_for_timeout(500)
                    check(await pg.evaluate("!!document.querySelector('#lng-root .lng-view svg') && !!document.querySelector('#lng-root .lng-banner.lng-strip') && !document.querySelector('#lng-root .lng-banner img')"), f"{tag}: the painted hall, banner shrunk to a name strip")
                    await tap("[data-lng=tab][data-id=gold]"); await pg.wait_for_timeout(300)
                    check(await pg.evaluate("!!document.querySelector('#lng-root .lng-banner img.lng-paint')"), f"{tag}: painted banner on tabs without the hall")
                    await tap("[data-lng=tab][data-id=rooms]"); await pg.wait_for_timeout(300)
                    el = await pg.query_selector("#lng-root .lng-view")
                    if el: await el.screenshot(path=os.path.join(OUT, f"longhouse_{tag}_hall.png"))
                    # every room at level 3, then nothing built: the overlays change with the rooms
                    for nm, lv in [("hall_max", 3), ("hall_none", 0)]:
                        await pg.evaluate("(lv) => { const v = document.querySelector('#lng-root .lng-view'); const R = {}; for (const r of LONGHOUSE.ROOM_IDS) R[r] = lv; v.outerHTML = LONGHOUSE.hallView({ rooms: R }); }", lv)
                        await pg.wait_for_timeout(300); el = await pg.query_selector("#lng-root .lng-view")
                        if el: await el.screenshot(path=os.path.join(OUT, f"longhouse_{tag}_{nm}.png"))
                    await company(); await tap("[data-lng=tab][data-id=rooms]"); await pg.wait_for_timeout(300)
                await pg.evaluate("scrollTo(0, 0)"); await shot("screen", True)
                await ctx.close()
            await b.close()
    finally:
        srv.terminate()
    for e in errs: print("page error:", e)
    print(f"{len(shots)} shots in {OUT}")
    if bad or errs: print("FAILED:", bad); sys.exit(1)
    print("longhouse ui ok")

asyncio.run(main())
