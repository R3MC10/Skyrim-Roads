"""Performance check on a slow phone. Usage: python perf_ui.py PORT [SHOTS_DIR]
Chromium at 360x800 with the CPU slowed down x4 (a mid/low-end phone). Prints:
  - cold start: page open -> title screen ("Tap to begin"), and Continue -> first map picture
  - for each scene (title idle, compass home screen, map idle, map panning, travelling, fight screen idle):
      main-thread busy % (Chrome's TaskDuration), script/layout/style ms per second, long tasks (count and total ms),
      map draws per second, all measured in a quiet window; then fps seen by requestAnimationFrame and frame-gap p50/p95
Options (environment): PERF_RATE (CPU slowdown, 4), PERF_SECS, PERF_GPU=1 (installed Chrome with the real GPU: closer to a phone
than software drawing), PERF_PROFILE=1 (top functions per scene), PERF_TRACE=1 (main-thread time by browser event).
  - JS heap after each scene and after a forced GC.
Numbers wobble ~10% run to run; compare runs on the same machine. Screenshots of each scene go to SHOTS_DIR when given
(for before/after comparisons). Needs a static server on PORT serving game/ (python -m http.server PORT --directory ../game)."""
import asyncio, sys, os, json
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else None
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")   # falls back to Playwright's own Chromium when missing
RATE = float(os.environ.get("PERF_RATE", "4"))
SECS = float(os.environ.get("PERF_SECS", "5"))   # quiet window per scene (busy %, long tasks, map draws)
FPS_SECS = float(os.environ.get("PERF_FPS_SECS", "2"))   # then the frame-counting window (fps, frame gaps)
TRACE = os.environ.get("PERF_TRACE")   # set to 1 to print where the main thread's time goes (paint, style, canvas...) per scene
PROFILE = os.environ.get("PERF_PROFILE")   # set to 1 to print the top functions by own time for each scene
URL = f"http://localhost:{PORT}/index.html?net=bc&notut&p=perfui"

# runs before any game script: marks when the title button and the first map picture appear, and logs long tasks
INIT = """
try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); } catch (e) {}   // behave like a real phone (animations, art, the compass home screen)
window.__perf = { press: 0, long: [] };
try { new PerformanceObserver((l) => l.getEntries().forEach((e) => __perf.long.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
new MutationObserver((ms, ob) => { if (!__perf.press && document.querySelector('.press')) { __perf.press = performance.now(); } }).observe(document, { childList: true, subtree: true });
"""
# wraps WorldMap.draw to count draws and time them (installed once the game scripts are loaded)
WRAP = """() => { if (window.__mw) return; window.__mw = { n: 0, ms: 0, first: 0 };
  const o = WorldMap.draw; WorldMap.draw = function (...a) { const t = performance.now(); const r = o.apply(this, a); const d = performance.now() - t;
    __mw.n++; __mw.ms += d; if (!__mw.first) __mw.first = performance.now(); return r; }; }"""
# a quiet window: just waits (no requestAnimationFrame of our own, which would itself make the page draw every refresh)
BUSY = """(ms) => new Promise((res) => { const t0 = performance.now(); const n0 = __mw ? __mw.n : 0, d0 = __mw ? __mw.ms : 0;
  const l0 = __perf.long.length;
  setTimeout(() => { const long = __perf.long.slice(l0).filter((e) => e[0] >= t0);
    res({ wall: performance.now() - t0, draws: (__mw ? __mw.n : 0) - n0, drawMs: (__mw ? __mw.ms : 0) - d0, long: long.map((e) => e[1]) }); }, ms); })"""
# then a short window that counts frames with requestAnimationFrame; returns raw gaps so Python can sort them
SAMPLE = """(ms) => new Promise((res) => { const gaps = []; let last = 0; const t0 = performance.now();
  const f = (ts) => { if (last) gaps.push(ts - last); last = ts; if (ts - t0 < ms) requestAnimationFrame(f); else res({ gaps, wall: performance.now() - t0 }); };
  requestAnimationFrame(f); })"""
CLEAR = "document.querySelectorAll('#modal').forEach(m=>m.remove())"

def top_self(prof, n=12):
    """sum the CPU profile's samples by function (own time only)"""
    nodes = {x["id"]: x for x in prof["nodes"]}
    cnt = {}
    dts = prof.get("timeDeltas", [])
    for i, sid in enumerate(prof.get("samples", [])):
        cnt[sid] = cnt.get(sid, 0) + (dts[i] if i < len(dts) else 0)
    agg = {}
    for sid, us in cnt.items():
        cf = nodes[sid]["callFrame"]
        k = f'{cf["functionName"] or "(anon)"} {cf["url"].rsplit("/", 1)[-1]}:{cf["lineNumber"] + 1}'
        agg[k] = agg.get(k, 0) + us
    tot = sum(agg.values()) or 1
    return [(round(v / 1000), round(100 * v / tot, 1), k) for k, v in sorted(agg.items(), key=lambda kv: -kv[1])[:n]]

def top_total(prof, n=14):
    """game functions by total time (own + what they call), so you can see which caller is expensive"""
    nodes = {x["id"]: x for x in prof["nodes"]}
    parent = {}
    for x in prof["nodes"]:
        for c in x.get("children", []): parent[c] = x["id"]
    dts = prof.get("timeDeltas", [])
    agg = {}
    for i, sid in enumerate(prof.get("samples", [])):
        us = dts[i] if i < len(dts) else 0
        seen, cur = set(), sid
        while cur is not None:
            cf = nodes[cur]["callFrame"]
            if cf["url"].endswith(".js") and "p2pnet" not in cf["url"]:
                k = f'{cf["functionName"] or "(anon)"} {cf["url"].rsplit("/", 1)[-1]}:{cf["lineNumber"] + 1}'
                if k not in seen: seen.add(k); agg[k] = agg.get(k, 0) + us
            cur = parent.get(cur)
    return [(round(v / 1000), k) for k, v in sorted(agg.items(), key=lambda kv: -kv[1])[:n]]

def trace_summary(raw, n=14):
    """own time of trace events on the page's main thread, by event name"""
    ev = json.loads(raw)
    ev = ev["traceEvents"] if isinstance(ev, dict) else ev
    main = {(e["pid"], e["tid"]) for e in ev if e.get("name") == "thread_name" and e.get("args", {}).get("name") == "CrRendererMain"}
    by = {}
    for e in ev:
        if (e.get("pid"), e.get("tid")) in main and e.get("ph") == "X": by.setdefault((e["pid"], e["tid"]), []).append(e)
    agg = {}
    for evs in by.values():
        evs.sort(key=lambda e: (e["ts"], -e.get("dur", 0)))
        stack = []
        for e in evs:
            d = e.get("dur", 0)
            while stack and stack[-1][0] + stack[-1][1] <= e["ts"]: stack.pop()
            if stack: agg[stack[-1][2]] = agg.get(stack[-1][2], 0) - d
            agg[e["name"]] = agg.get(e["name"], 0) + d
            stack.append((e["ts"], d, e["name"]))
    return [(round(v / 1000), k) for k, v in sorted(agg.items(), key=lambda kv: -kv[1])[:n]]

def pct(a, p):
    if not a: return 0
    a = sorted(a); return a[min(len(a) - 1, int(len(a) * p))]

async def metrics(cdp):
    m = await cdp.send("Performance.getMetrics")
    return {x["name"]: x["value"] for x in m["metrics"]}

async def heap(cdp, gc=False):
    if gc: await cdp.send("HeapProfiler.collectGarbage")
    h = await cdp.send("Runtime.getHeapUsage")
    return round(h["usedSize"] / 1048576, 1)

async def main():
    async with async_playwright() as p:
        kw = {"executable_path": CHROME, "args": ["--no-sandbox"]} if os.path.exists(CHROME) else {}
        if os.environ.get("PERF_GPU"):   # use the machine's real GPU (closer to a phone than software drawing); uses installed Google Chrome
            kw = {**kw, "channel": os.environ.get("PERF_GPU") if os.environ.get("PERF_GPU") in ("chrome", "msedge", "chromium") else "chrome","args": kw.get("args", []) + ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"]}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 360, "height": 800}, device_scale_factor=2, has_touch=True)
        errs = []
        # ---- 1. make a saved test character (not timed)
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT)
        await pg.goto(URL); await pg.wait_for_selector(".press")
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Perfa"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate(CLEAR)
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.level=12; S.gold=900; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
          for (const n of Object.keys(WORLD.places).slice(0, 120)) if (!S.discovered.includes(n)) S.discovered.push(n);
          G.give(S,'iron_sword'); G.give(S,'potion_health',3); Store.save(S); }""")
        await pg.wait_for_timeout(800)
        await pg.close()

        # ---- 2. cold start with the CPU slowed down
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT)
        cdp = await ctx.new_cdp_session(pg)
        await cdp.send("Performance.enable"); await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", {"interval": 500}); await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled", {"cacheDisabled": False})
        await cdp.send("Emulation.setCPUThrottlingRate", {"rate": RATE})
        await pg.goto(URL, wait_until="commit")
        await pg.wait_for_selector(".press", timeout=60000)
        nav = await pg.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0]; return {dcl:n.domContentLoadedEventEnd, load:n.loadEventEnd, press:__perf.press, scripts:document.scripts.length}})()")
        out = {"rate": RATE, "cold": {"domContentLoaded": round(nav["dcl"]), "load": round(nav["load"]), "title": round(nav["press"]), "scripts": nav["scripts"]}}
        await pg.evaluate(WRAP)
        scenes = {}
        async def scene(name, during=None):
            m0 = await metrics(cdp)
            if PROFILE: await cdp.send("Profiler.start")
            if TRACE: await b.start_tracing(page=pg, categories=["devtools.timeline", "blink"])
            task = asyncio.ensure_future(during()) if during else None
            r = await pg.evaluate(BUSY, SECS * 1000)
            m1 = await metrics(cdp)
            if TRACE:
                raw = await b.stop_tracing()
                print(f"--- {name}: main thread own time by event (ms)")
                for ms, k in trace_summary(raw): print(f"   {ms:6}  {k}")
            if PROFILE:
                prof = (await cdp.send("Profiler.stop"))["profile"]
                print(f"--- {name}: top own time (ms, %)")
                for ms, pc, k in top_self(prof): print(f"   {ms:6} {pc:5}%  {k}")
                print(f"--- {name}: game functions by total time (ms)")
                for ms, k in top_total(prof): print(f"   {ms:6}  {k}")
            fr = await pg.evaluate(SAMPLE, FPS_SECS * 1000)
            if task: await task
            wall = r["wall"] / 1000
            g = fr["gaps"]
            d = lambda k: (m1.get(k, 0) - m0.get(k, 0))
            scenes[name] = {
                "fps": round(len(g) / (fr["wall"] / 1000), 1), "gap_p50": round(pct(g, .5), 1), "gap_p95": round(pct(g, .95), 1),
                "busy%": round(100 * d("TaskDuration") / wall, 1),
                "script_ms/s": round(1000 * d("ScriptDuration") / wall, 1), "layout_ms/s": round(1000 * d("LayoutDuration") / wall, 1),
                "style_ms/s": round(1000 * d("RecalcStyleDuration") / wall, 1),
                "long": len(r["long"]), "long_ms": round(sum(r["long"])),
                "draws/s": round(r["draws"] / wall, 1), "draw_ms": round(r["drawMs"] / max(1, r["draws"]), 2),
                "heapMB": await heap(cdp),
            }
            if SHOTS: await pg.screenshot(path=os.path.join(SHOTS, name + ".png"))
        await pg.wait_for_timeout(1500)
        await scene("title")
        # ---- Continue -> first map picture
        await pg.click(".press"); await pg.wait_for_selector(".mi[data-t=continue]")
        await pg.wait_for_timeout(500)
        t0 = await pg.evaluate("(()=>{ const t=performance.now(); window.__mw.first=0; document.querySelector('.mi[data-t=continue]').click(); return t; })()")
        await pg.wait_for_function("window.__mw.first > 0", timeout=60000)
        first = await pg.evaluate("__mw.first")
        # "settled": first 300 ms window after Continue without a long task
        await pg.wait_for_timeout(2500)
        lt = await pg.evaluate(f"__perf.long.filter(e=>e[0]>={t0})")
        settle = max([s + d for s, d in lt], default=first)
        out["cold"]["continue_to_map"] = round(first - t0)
        out["cold"]["continue_settled"] = round(max(settle, first) - t0)
        out["cold"]["continue_long_ms"] = round(sum(d for s, d in lt))
        await pg.evaluate(CLEAR)
        await pg.wait_for_timeout(1000); await pg.evaluate(CLEAR)
        await scene("hub")
        await pg.evaluate("()=>{ if (typeof TABMENU!=='undefined' && TABMENU.closeHub) TABMENU.closeHub(); const t=document.querySelector('[data-tab=map]'); t && t.click(); scrollTo(0,0); }")
        await pg.wait_for_timeout(1500); await pg.evaluate(CLEAR)
        await scene("map_idle")
        box = await pg.evaluate("(()=>{const r=document.querySelector('#map').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2, r.width, r.height]})()")
        async def pan():
            cx, cy, w, h = box
            end = asyncio.get_event_loop().time() + SECS + FPS_SECS
            while asyncio.get_event_loop().time() < end:
                await pg.mouse.move(cx - w * .25, cy); await pg.mouse.down()
                for i in range(1, 11): await pg.mouse.move(cx - w * .25 + w * .05 * i, cy + (i % 3) * 3)
                await pg.mouse.up()
                await pg.mouse.move(cx + w * .25, cy + 10); await pg.mouse.down()
                for i in range(1, 11): await pg.mouse.move(cx + w * .25 - w * .05 * i, cy + 10)
                await pg.mouse.up()
        await scene("map_pan", pan)
        await pg.evaluate("()=>{ const S=window.__dbg.save(); S.location=null; G.startTrip(S,'Windhelm',WORLD.places.Windhelm.slice(0,2)); }")
        await pg.wait_for_timeout(1500); await pg.evaluate(CLEAR)
        await scene("travel")
        # ---- a fight (bandits at a toll, the turn-by-turn fight screen, idle on my turn)
        await pg.evaluate("""()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove()); const S=window.__dbg.save(); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
          S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
          const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }""")
        await pg.wait_for_timeout(600)
        await pg.click("#modal [data-act=ev][data-c=fight]")
        await pg.wait_for_selector("#tbf", timeout=20000); await pg.wait_for_timeout(2500)
        await scene("fight")
        out["heap_after_gc_MB"] = await heap(cdp, True)
        out["scenes"] = scenes
        out["errors"] = errs[:5]
        print(json.dumps(out, indent=1))
        print("\n%-9s %6s %7s %7s %6s %8s %8s %7s %5s %7s %7s %7s %6s" % ("scene", "fps", "gap50", "gap95", "busy%", "script/s", "layout/s", "style/s", "long", "longms", "draws/s", "draw_ms", "heap"))
        for k, v in scenes.items():
            print("%-9s %6s %7s %7s %6s %8s %8s %7s %5s %7s %7s %7s %6s" % (k, v["fps"], v["gap_p50"], v["gap_p95"], v["busy%"], v["script_ms/s"], v["layout_ms/s"], v["style_ms/s"], v["long"], v["long_ms"], v["draws/s"], v["draw_ms"], v["heapMB"]))
        c = out["cold"]
        print(f"\ncold start x{RATE:g}: DOMContentLoaded {c['domContentLoaded']} ms, load {c['load']} ms, title {c['title']} ms; Continue -> map {c['continue_to_map']} ms (settled {c['continue_settled']} ms, long tasks {c['continue_long_ms']} ms); heap after GC {out['heap_after_gc_MB']} MB")
        await b.close()

asyncio.run(main())
