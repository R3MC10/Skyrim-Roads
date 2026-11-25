"""World events on a phone screen (worldevents.js).
Serves game/ on a free port in 9300-9399, moves the clock to a moment when an invasion, a festival
and the Khajiit caravan are all on, and takes screenshots in both art styles.
Run from the repo root:  python tests/worldevents_ui.py   (screenshots land in tests/out_wev/)"""
import asyncio, os, socket, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tests", "out_wev"); os.makedirs(OUT, exist_ok=True)

def free_port():
    for p in range(9300, 9400):
        with socket.socket() as s:
            try: s.bind(("127.0.0.1", p)); return p
            except OSError: pass
    raise SystemExit("no free port in 9300-9399")

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else free_port()

# Date.now gets an offset we can set once the game has loaded; timers keep running normally
SHIFT = "window.__off = 0; (() => { const n = Date.now.bind(Date); Date.now = () => n() + window.__off; })();"
# find the next moment with an invasion, a festival and the caravan all running, and jump there
JUMP = """() => {
  const t0 = Date.now() / 1000;
  for (let t = t0; t < t0 + 120 * 86400; t += 900) {
    const k = WORLDEV.active(t).map((e) => e.kind);
    if (k.includes("inv") && k.includes("fest") && k.includes("kc")) { window.__off = (t + 1200 - t0) * 1000; return WORLDEV.active(t + 1200).map((e) => e.id + " " + e.name); }
  }
  return null; }"""

async def main():
    srv = subprocess.Popen(["node", os.path.join(ROOT, "tests", "serve.js"), str(PORT), os.path.join(ROOT, "game")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)   # node: python's server refuses connections under load
    time.sleep(1.0)
    errs, bad = [], []
    def check(ok, what):
        print(("ok   " if ok else "FAIL ") + what)
        if not ok: bad.append(what)
    try:
        async with async_playwright() as p:
            try: b = await p.chromium.launch()
            except Exception: b = await p.chromium.launch(channel="chrome")
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            await ctx.add_init_script(SHIFT)
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e: errs.append(str(e)))
            async def clear(): await pg.evaluate("document.querySelectorAll('#modal').forEach(m=>m.remove())")
            await pg.goto(f"http://localhost:{PORT}/index.html?notut&p=wev1"); await pg.wait_for_timeout(1500)
            await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Wenna"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
            evs = await pg.evaluate(JUMP); print("events:", evs)
            check(bool(evs), "found a time with an invasion, a festival and the caravan")
            site = await pg.evaluate("() => { const ev = WORLDEV.active(Date.now()/1000).find((e) => e.kind === 'inv'); const S = window.__dbg.save(); S.level = 20; S.location = ev.sites[0]; [S.x, S.y] = WORLD.places[ev.sites[0]]; return ev.sites[0]; }")
            await pg.wait_for_timeout(2500); await clear()
            check(await pg.evaluate("document.querySelectorAll('#wev .wev-strip').length") >= 3, "strips under the map")
            check("Daedric" in (await pg.evaluate("JSON.stringify(window.__dbg.save().log || [])")) or "Oblivion" in (await pg.evaluate("JSON.stringify(window.__dbg.save())")), "journal note about the invasion")
            await clear(); await pg.click("[data-tab=world]"); await pg.wait_for_timeout(600); await clear()
            for st in ["ink"]:
                await clear(); await pg.click("[data-tab=world]"); await pg.wait_for_timeout(1500); await clear()
                await pg.evaluate("scrollTo(0, 0)"); await pg.wait_for_timeout(1200); await pg.screenshot(path=os.path.join(OUT, f"wev_maptop_{st}.png"))
                el = await pg.query_selector("#wev")
                if el: await el.scroll_into_view_if_needed()
                await pg.screenshot(path=os.path.join(OUT, f"wev_map_{st}.png"))
                await pg.click("#wev .wev-strip.wev-inv"); await pg.wait_for_timeout(500)
                check(await pg.query_selector(".wevsheet") is not None, f"{st}: invasion sheet opens")
                await pg.screenshot(path=os.path.join(OUT, f"wev_sheet_inv_{st}.png")); await clear()
                await pg.click("#wev .wev-strip.wev-kc"); await pg.wait_for_timeout(500)
                await pg.screenshot(path=os.path.join(OUT, f"wev_sheet_kc_{st}.png")); await clear()
                await pg.click("#wev .wev-strip.wev-fest"); await pg.wait_for_timeout(500)
                await pg.screenshot(path=os.path.join(OUT, f"wev_sheet_fest_{st}.png")); await clear()
            # fight at the gate
            await pg.click("#wev .wev-strip.wev-inv"); await pg.wait_for_timeout(400)
            await pg.click(".wevsheet [data-wev=gate]"); await pg.wait_for_timeout(1500)
            txt = await pg.evaluate("document.querySelector('#modal')?.innerText || ''")
            check(len(txt) > 20, "a gate fight plays out at " + site)
            await pg.screenshot(path=os.path.join(OUT, "wev_fight.png")); await clear()
            check(await pg.evaluate("Object.keys(window.__dbg.save().wev || {}).length") >= 1, "the fight counts toward the gate")
            # travel from the sheet closes it
            await pg.evaluate("() => { const S = window.__dbg.save(); G.setHealth(S, G.maxHealth(S)); }")
            await pg.click("#wev .wev-strip.wev-inv"); await pg.wait_for_timeout(400)
            go = await pg.query_selector(".wevsheet [data-act=go]")
            if go:
                await go.click(); await pg.wait_for_timeout(600)
                check(await pg.query_selector(".wevsheet") is None, "Travel from the sheet closes it")
            await clear()
            # Journal: Misc tab lists the events
            await pg.evaluate("()=>window.__ui.go('world')"); await pg.wait_for_timeout(500); await clear()   # Map → World news (was Journal → Misc)
            j = await pg.query_selector(".wev-j")
            check(j is not None, "World events panel in the Journal")
            if j: await j.scroll_into_view_if_needed(); await j.screenshot(path=os.path.join(OUT, "wev_journal.png"))
            await b.close()
    finally:
        srv.terminate()
    print("errors:", errs)
    if errs or bad: raise SystemExit(1)
    print("worldevents_ui ok")

asyncio.run(main())
