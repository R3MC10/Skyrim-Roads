"""Startup check on a slow phone. Usage: python startup_ui.py PORT [LABEL]
Serves whatever is on PORT (game/ or the built www/). Chromium 412x915, CPU slowed x4 (PERF_RATE), optional network
throttling (PERF_NET=4g). Prints one JSON line:
  title_ms        page open -> title screen button visible
  dcl_ms/load_ms  DOMContentLoaded / load
  requests/bytes  everything fetched until the title (and until in-game)
  script_ms       time the main thread spent in JavaScript until the title (Chrome's ScriptDuration)
  task_ms         all main-thread work until the title
  long_tasks      long tasks (>50 ms) until the title: count and total ms
  game_ms         Continue -> first in-game frame with the map drawn (time to interactive in game)
  heap_mb         JS heap after the title / in game
  img_mb          decoded size of the pictures the game has loaded (w*h*4)
Runs it RUNS times (default 2) and prints the median of each number."""
import asyncio, sys, os, json, statistics
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
LABEL = sys.argv[2] if len(sys.argv) > 2 else ""
RATE = float(os.environ.get("PERF_RATE", "4"))
RUNS = int(os.environ.get("RUNS", "2"))
NET = os.environ.get("PERF_NET")
URL = f"http://localhost:{PORT}/index.html?net=bc&notut&p=startupui"
INIT = """
try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); } catch (e) {}
window.__st = { press: 0, long: [] };
try { performance.setResourceTimingBufferSize(10000); } catch (e) {}
try { new PerformanceObserver((l) => l.getEntries().forEach((e) => __st.long.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
new MutationObserver(() => { if (!__st.press && document.querySelector('.press')) __st.press = performance.now(); }).observe(document, { childList: true, subtree: true });
"""
CLEAR = "document.querySelectorAll('#modal').forEach(m=>m.remove())"

async def metrics(cdp):
    m = await cdp.send("Performance.getMetrics")
    return {x["name"]: x["value"] for x in m["metrics"]}

async def one(b, errs):
    ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2.6, has_touch=True, is_mobile=True)
    # a saved character to continue with (not timed)
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.add_init_script(INIT)
    await pg.goto(URL); await pg.wait_for_selector(".press", timeout=120000)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Starta"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(CLEAR)
    await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.level=12; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; Store.save(S); }""")
    await pg.wait_for_timeout(600)
    await pg.close()
    # cold start
    pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.add_init_script(INIT)
    cdp = await ctx.new_cdp_session(pg)
    await cdp.send("Performance.enable"); await cdp.send("Network.enable")
    await cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})
    if NET == "4g": await cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 60, "downloadThroughput": 9e6 / 8, "uploadThroughput": 1.5e6 / 8})
    await cdp.send("Emulation.setCPUThrottlingRate", {"rate": RATE})
    reqs = {"n": 0, "bytes": 0}
    def fin(e):
        reqs["bytes"] += e.get("encodedDataLength", 0)
    cdp.on("Network.requestWillBeSent", lambda e: reqs.__setitem__("n", reqs["n"] + 1))
    cdp.on("Network.loadingFinished", fin)
    await pg.goto(URL, wait_until="commit")
    await pg.wait_for_selector(".press", timeout=180000)
    await pg.wait_for_timeout(300)
    nav = await pg.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0]; return {dcl:n.domContentLoadedEventEnd, load:n.loadEventEnd, press:__st.press, long:__st.long.filter(l=>l[0] < __st.press)}})()")
    m = await metrics(cdp)
    h = await cdp.send("Runtime.getHeapUsage")
    out = {"title_ms": round(nav["press"]), "dcl_ms": round(nav["dcl"]), "load_ms": round(nav["load"]), "requests": reqs["n"], "kb": round(reqs["bytes"] / 1024),
           "script_ms": round(m.get("ScriptDuration", 0) * 1000), "task_ms": round(m.get("TaskDuration", 0) * 1000),
           "long_n": len(nav["long"]), "long_ms": round(sum(x[1] for x in nav["long"])), "heap_mb": round(h["usedSize"] / 1048576, 1)}
    # continue into the game
    t0 = await pg.evaluate("performance.now()")
    await pg.click(".press")
    await pg.click(".mi[data-t=continue], .mi[data-t=cont], [data-t=continue]", timeout=60000)
    await pg.wait_for_function("() => { const t = document.querySelector('#tabs'); return !!t && !t.classList.contains('hide') && !document.querySelector('#title'); }", timeout=180000)
    await pg.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
    t1 = await pg.evaluate("performance.now()")
    await pg.wait_for_timeout(2500)
    out["game_ms"] = round(t1 - t0)
    out["requests_game"] = reqs["n"]; out["kb_game"] = round(reqs["bytes"] / 1024)
    h = await cdp.send("Runtime.getHeapUsage")
    out["heap_game_mb"] = round(h["usedSize"] / 1048576, 1)
    # decoded size of every picture the game has loaded so far (ASSETS keeps them): width x height x 4 bytes
    out["img_mb"] = await pg.evaluate("(()=>{let s=0; try { for (const [k] of ASSETS.status()) { const im = ASSETS.img(k); if (im && im.naturalWidth) s += im.naturalWidth*im.naturalHeight*4; } } catch (e) {} return Math.round(s/1048576)})()")
    out["img_files_game"] = await pg.evaluate("performance.getEntriesByType('resource').filter(e=>/\\.(webp|png|jpg)$/.test(e.name.split('?')[0])).length")
    await ctx.close()
    return out

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        errs, runs = [], []
        for i in range(RUNS): runs.append(await one(b, errs))
        await b.close()
    med = {k: (statistics.median([r[k] for r in runs]) if isinstance(runs[0][k], (int, float)) else runs[0][k]) for k in runs[0]}
    print(json.dumps({"label": LABEL, "rate": RATE, "net": NET or "none", **med, "errors": errs[:5]}))

if __name__ == "__main__": asyncio.run(main())
