"""Stutter check: where do frame drops come from? Usage: python stutter_ui.py PORT [--check] [--json OUT]
Chromium at 390x844 (phone) with the CPU slowed down x4. For each scene it watches the page for a few seconds and reports
  - frame gaps (p50 / p95 / worst), long tasks (count, total, worst)
  - animation loops: how many different requestAnimationFrame loops ran, and their ms per second
  - timers: setInterval / setTimeout callbacks by source, ms per second (the heavy ones)
  - saves: localStorage writes per second and KB per second
  - innerHTML rebuilds per second (and KB), by source
  - network: BroadcastChannel messages per second
Scenes: map idle, travelling with the first-person band open, a town scene, a group fight, the map with 2 other players (?net=bc).
--check: fail (exit 1) when a scene goes over its budget (see BUDGET): too many loops, timers, saves or long tasks.
Environment: PERF_GPU=chrome uses the installed Chrome with the real GPU (closer to a phone); PERF_SECS (window, 5);
PERF_RATE (CPU slowdown, 4). Needs a static server on PORT serving game/ (node serve.js PORT)."""
import asyncio, sys, os, json
from playwright.async_api import async_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "8765"
CHECK = "--check" in sys.argv
JOUT = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
RATE = float(os.environ.get("PERF_RATE", "4"))
SECS = float(os.environ.get("PERF_SECS", "5"))
CHROME = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
BASE = f"http://localhost:{PORT}/index.html?net=bc&notut"

# Budgets per scene (generous: a regression, not a wobble, should trip them). loops = distinct rAF loops running;
# timer_ms = setInterval/setTimeout callback ms per second (at x4 CPU); saves = localStorage KB per second;
# html = innerHTML KB per second; long = long tasks per second
BUDGET = {
    "map_idle":    {"loops": 2, "timer_ms": 120, "save_kb": 8, "html_kb": 40, "long": 0.6},
    "travel_band": {"loops": 3, "timer_ms": 200, "save_kb": 40, "html_kb": 80, "long": 1.0},
    "town":        {"loops": 3, "timer_ms": 150, "save_kb": 8, "html_kb": 60, "long": 0.6},
    "group_fight": {"loops": 5, "timer_ms": 200, "save_kb": 8, "html_kb": 120, "long": 1.2},
    "map_3players": {"loops": 2, "timer_ms": 160, "save_kb": 30, "html_kb": 60, "long": 0.8},
}

# runs before any game script: counts loops, timers, saves, DOM rebuilds and messages, each by the game file that made them
INIT = r"""
try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); } catch (e) {}
(() => {
  const P = window.__pf = { on: false, long: [], raf: {}, tm: {}, ls: { n: 0, b: 0, ms: 0, keys: {} }, html: {}, bc: { n: 0, b: 0 } };
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => P.long.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  const src = () => { const s = (new Error().stack || '').split('\n');
    for (let i = 2; i < s.length; i++) { const m = s[i].match(/\/([\w.-]+\.js):(\d+)/); if (m) return m[1] + ':' + m[2]; } return '?'; };
  const add = (bag, k, d, b) => { const r = bag[k] || (bag[k] = { n: 0, ms: 0, max: 0, b: 0 }); r.n++; r.ms += d; if (d > r.max) r.max = d; r.b += b || 0; };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    if (cb && cb.__pfSkip) return raf(cb);
    const k = src();
    return raf(function (t) { const t0 = performance.now(); try { cb(t); } finally { if (P.on) add(P.raf, k, performance.now() - t0); } });
  };
  for (const nm of ['setInterval', 'setTimeout']) {
    const o = window[nm].bind(window);
    window[nm] = function (cb, ms, ...a) {
      if (typeof cb !== 'function' || cb.__pfSkip) return o(cb, ms, ...a);
      const k = nm[3] + ' ' + src();
      return o(function (...b) { const t0 = performance.now(); try { return cb.apply(this, b); } finally { if (P.on) add(P.tm, k, performance.now() - t0); } }, ms, ...a);
    };
  }
  const si = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { const t0 = performance.now(); const r = si.call(this, k, v);
    if (P.on) { const d = performance.now() - t0; P.ls.n++; P.ls.b += String(v).length; P.ls.ms += d; const kk = String(k).replace(/^[a-z0-9]{0,12}(sk\.)/i, '$1'); add(P.ls.keys, kk, d, String(v).length); } return r; };
  const ih = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', { configurable: true, get: ih.get, set: function (v) {
    if (!P.on) return ih.set.call(this, v);
    const t0 = performance.now(); ih.set.call(this, v); add(P.html, src(), performance.now() - t0, String(v).length); } });
  if (window.BroadcastChannel) { const pm = BroadcastChannel.prototype.postMessage;
    BroadcastChannel.prototype.postMessage = function (m) { if (P.on) { P.bc.n++; try { P.bc.b += JSON.stringify(m).length; } catch (e) {} } return pm.call(this, m); }; }
})();
"""
START = "() => { const P = __pf; P.on = true; P.t0 = performance.now(); P.raf = {}; P.tm = {}; P.ls = { n: 0, b: 0, ms: 0, keys: {} }; P.html = {}; P.bc = { n: 0, b: 0 }; P.l0 = P.long.length; }"
# frame gaps measured by our own (uncounted) loop
SAMPLE = """(ms) => new Promise((res) => { const gaps = []; let last = 0; const t0 = performance.now();
  const f = (ts) => { if (last) gaps.push(ts - last); last = ts; if (ts - t0 < ms) requestAnimationFrame(f); else res(gaps); }; f.__pfSkip = 1;
  requestAnimationFrame(f); })"""
STOP = """() => { const P = __pf; P.on = false; const s = (performance.now() - P.t0) / 1000;
  const top = (bag, n) => Object.entries(bag).map(([k, r]) => [k, +(r.n / s).toFixed(1), +(r.ms / s).toFixed(1), +r.max.toFixed(1), +(r.b / 1024 / s).toFixed(1)]).sort((a, b) => b[2] - a[2]).slice(0, n);
  const long = P.long.slice(P.l0).filter((e) => e[0] >= P.t0).map((e) => e[1]);
  const sum = (bag, f) => Object.values(bag).reduce((a, r) => a + f(r), 0);
  const cv = [...document.querySelectorAll('canvas')].filter((c) => c.width * c.height > 0 && c.getBoundingClientRect().width > 0)
    .map((c) => { const r = c.getBoundingClientRect(); return [c.id || c.className || c.parentElement?.id || '?', c.width, c.height, +(c.width / Math.max(1, r.width)).toFixed(2)]; });
  return { secs: s, long, loops: Object.values(P.raf).filter((r) => r.n / s >= 2).length, raf: top(P.raf, 8), raf_ms: +(sum(P.raf, (r) => r.ms) / s).toFixed(1),
    timers: top(P.tm, 10), timer_ms: +(sum(P.tm, (r) => r.ms) / s).toFixed(1),
    ls: { n: +(P.ls.n / s).toFixed(1), kb: +(P.ls.b / 1024 / s).toFixed(1), ms: +(P.ls.ms / s).toFixed(1), keys: top(P.ls.keys, 5) },
    html: top(P.html, 8), html_kb: +(sum(P.html, (r) => r.b) / 1024 / s).toFixed(1), html_n: +(sum(P.html, (r) => r.n) / s).toFixed(1),
    bc: { n: +(P.bc.n / s).toFixed(1), kb: +(P.bc.b / 1024 / s).toFixed(1) }, canvases: cv }; }"""
CLEAR = "document.querySelectorAll('#modal').forEach(m=>m.remove())"

def pct(a, p):
    if not a: return 0
    a = sorted(a); return a[min(len(a) - 1, int(len(a) * p))]

async def make_char(pg, name, prof):
    await pg.goto(f"{BASE}&p={prof}"); await pg.wait_for_selector(".press", timeout=60000)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", name); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(CLEAR)
    await pg.evaluate("""()=>{ try { const p=JSON.parse(localStorage.getItem('rotn_prefs')||'{}'); p.tbFast=true; p.tips=false; localStorage.setItem('rotn_prefs', JSON.stringify(p)); } catch(e){}
      const S=window.__dbg.save(); S.level=20; S.gold=3000; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.trip=null; S.dungeon=null;
      for (const n of Object.keys(WORLD.places).slice(0, 120)) if (!S.discovered.includes(n)) S.discovered.push(n);
      G.give(S,'iron_sword'); G.give(S,'potion_health',3); S.equipped = Object.assign(S.equipped||{}, {chest:'iron_armor', hands:'iron_gauntlets'}); Store.save(S); }""")
    await pg.wait_for_timeout(500)

async def to_map(pg):
    await pg.evaluate(CLEAR)
    await pg.evaluate("()=>{ if (typeof TABMENU!=='undefined' && TABMENU.closeHub) TABMENU.closeHub(); document.querySelector('#sky') && window.__ui?.back?.(); const t=document.querySelector('[data-tab=world]'); t && t.click(); scrollTo(0,0); }")
    await pg.wait_for_timeout(1200); await pg.evaluate(CLEAR)

PROFILE = os.environ.get("PERF_PROFILE")
def top_total(prof, n=22):
    """game functions by total time (own + callees) and own time"""
    nodes = {x["id"]: x for x in prof["nodes"]}
    parent = {}
    for x in prof["nodes"]:
        for c in x.get("children", []): parent[c] = x["id"]
    dts = prof.get("timeDeltas", [])
    agg, own = {}, {}
    for i, sid in enumerate(prof.get("samples", [])):
        us = dts[i] if i < len(dts) else 0
        cf = nodes[sid]["callFrame"]; k0 = f'{cf["functionName"] or "(anon)"} {cf["url"].rsplit("/", 1)[-1]}:{cf["lineNumber"] + 1}'
        own[k0] = own.get(k0, 0) + us
        seen, cur = set(), sid
        while cur is not None:
            cf = nodes[cur]["callFrame"]
            if cf["url"].endswith(".js") and "p2pnet" not in cf["url"]:
                k = f'{cf["functionName"] or "(anon)"} {cf["url"].rsplit("/", 1)[-1]}:{cf["lineNumber"] + 1}'
                if k not in seen: seen.add(k); agg[k] = agg.get(k, 0) + us
            cur = parent.get(cur)
    return [(round(v / 1000), k) for k, v in sorted(agg.items(), key=lambda kv: -kv[1])[:n]], [(round(v / 1000), k) for k, v in sorted(own.items(), key=lambda kv: -kv[1])[:12]]

async def measure(pg, cdp, during=None):
    if PROFILE: await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", {"interval": 200}); await cdp.send("Profiler.start")
    m0 = {x["name"]: x["value"] for x in (await cdp.send("Performance.getMetrics"))["metrics"]}
    await pg.evaluate(START)
    task = asyncio.ensure_future(during()) if during else None
    gaps = await pg.evaluate(SAMPLE, SECS * 1000)
    if task: await task
    r = await pg.evaluate(STOP)
    if PROFILE:
        prof = (await cdp.send("Profiler.stop"))["profile"]; tt, ow = top_total(prof)
        r["prof"] = tt; r["own"] = ow
    m1 = {x["name"]: x["value"] for x in (await cdp.send("Performance.getMetrics"))["metrics"]}
    wall = r["secs"]
    r["busy%"] = round(100 * (m1["TaskDuration"] - m0["TaskDuration"]) / wall, 1)
    r["script_ms"] = round(1000 * (m1["ScriptDuration"] - m0["ScriptDuration"]) / wall, 1)
    r["style_ms"] = round(1000 * (m1["RecalcStyleDuration"] - m0["RecalcStyleDuration"]) / wall, 1)
    r["layout_ms"] = round(1000 * (m1["LayoutDuration"] - m0["LayoutDuration"]) / wall, 1)
    r["fps"] = round(len(gaps) / wall, 1); r["gap50"] = round(pct(gaps, .5), 1); r["gap95"] = round(pct(gaps, .95), 1); r["gapmax"] = round(max(gaps or [0]), 1)
    r["long_n"] = len(r["long"]); r["long_ms"] = round(sum(r["long"])); r["long_max"] = round(max(r["long"] or [0]))
    r["long_ps"] = round(len(r["long"]) / wall, 2)
    del r["long"]
    return r

async def main():
    async with async_playwright() as p:
        kw = {"args": ["--no-sandbox"]}
        if CHROME and os.path.exists(CHROME): kw["executable_path"] = CHROME
        if os.environ.get("PERF_GPU"):
            kw = {"channel": os.environ["PERF_GPU"] if os.environ["PERF_GPU"] in ("chrome", "msedge") else "chrome", "args": ["--no-sandbox", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"]}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
        await ctx.add_init_script(INIT)
        errs = []
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await make_char(pg, "Perfa", "pfa")
        cdp = await ctx.new_cdp_session(pg)
        await cdp.send("Performance.enable")
        await cdp.send("Emulation.setCPUThrottlingRate", {"rate": RATE})
        out = {}
        # ---- 1. idle on the map (in Whiterun)
        await to_map(pg); await pg.wait_for_timeout(1500)
        out["map_idle"] = await measure(pg, cdp)
        # ---- 2. travelling, first-person band open
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; G.startTrip(S,'Riverwood',WORLD.places.Riverwood); S.trip.total = Math.max(S.trip.total||0, 120); }""")
        await pg.wait_for_timeout(1500); await pg.evaluate(CLEAR)
        await pg.evaluate("()=>{ const f=document.querySelector('#fpt'); if (f && f.classList.contains('shut')) f.querySelector('[data-act=fpttoggle]')?.click(); }")
        await pg.wait_for_timeout(1500); await pg.evaluate(CLEAR)
        out["travel_band"] = await measure(pg, cdp)
        out["travel_band"]["band"] = await pg.evaluate("(()=>{const f=document.querySelector('#fpt'); return f ? (f.classList.contains('shut') ? 'shut' : 'open') : 'none'})()")
        # ---- 3. a town scene (Whiterun's place view)
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.trip=null; S.dungeon=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; window.__ui.refresh(); }""")
        await pg.evaluate("document.querySelector('[data-tab=town]').click()"); await pg.wait_for_timeout(1500); await pg.evaluate(CLEAR)
        out["town"] = await measure(pg, cdp)
        out["town"]["scene"] = await pg.evaluate("!!document.querySelector('#locs:not([hidden]) .ls')")
        # ---- 4. a group fight (3 bandits + a follower), hitting away
        await pg.evaluate("""()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove());
          const S=window.__dbg.save(); S.level=25; S.hpBonus=900; for (const k of ['One-Handed','Blocking','Heavy Armor']) S.skills[k].lvl=50;
          S.follower={id:'jenassa',hp:9999,ts:0}; G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
          FOEGROUPS.prep = (f) => ({ n: 3, hpMul: [3,3,3] });
          S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
          const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }""")
        await pg.wait_for_timeout(800)
        await pg.evaluate("document.querySelector('#modal [data-act=ev][data-c=fight]')?.click()")
        await pg.wait_for_selector("#tbf", timeout=30000); await pg.wait_for_timeout(2500)
        async def hit():
            end = asyncio.get_event_loop().time() + SECS
            while asyncio.get_event_loop().time() < end:
                await pg.evaluate("""()=>{ document.querySelectorAll('[data-obt=ok]').forEach(b=>b.click()); document.querySelectorAll('.bfov,#obtip').forEach(x=>x.remove());
                  document.querySelector('#tbf .tbskip')?.click(); const a=document.querySelector('#tbf [data-tba=attack]:not([disabled])'); if (a) a.click();
                  const f=document.querySelector('#tbf .tbtarget .tbu.foe, #tbf [data-tbt]'); if (f) f.click(); }""")
                await pg.wait_for_timeout(400)
        out["group_fight"] = await measure(pg, cdp, hit)
        out["group_fight"]["fight"] = await pg.evaluate("!!document.querySelector('#tbf')")
        await pg.evaluate("()=>{ const S=window.__dbg.save(); if (TB.session) TB.session.done = true; }")
        await pg.close()
        # ---- 5. the map with 2 other players online (BroadcastChannel stand-in), all three in Whiterun
        pages = []
        for nm, prof in (("Perfb", "pfb"), ("Perfc", "pfc")):
            q = await ctx.new_page(); q.on("pageerror", lambda e: errs.append(str(e)))
            await make_char(q, nm, prof); await to_map(q); pages.append(q)
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"{BASE}&p=pfa"); await pg.wait_for_selector(".press", timeout=60000)
        await pg.click(".press"); await pg.click(".mi[data-t=continue]"); await pg.wait_for_timeout(2500)
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.trip=null; S.dungeon=null; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; }""")
        await to_map(pg)
        # the other two walk about, so their cards change
        for q in pages: await q.evaluate("()=>{ const S=window.__dbg.save(); G.startTrip(S,'Riverwood',WORLD.places.Riverwood); }")
        cdp = await ctx.new_cdp_session(pg); await cdp.send("Performance.enable"); await cdp.send("Emulation.setCPUThrottlingRate", {"rate": RATE})
        await pg.wait_for_timeout(2500)
        out["map_3players"] = await measure(pg, cdp)
        out["map_3players"]["peers"] = await pg.evaluate("Store.peers")
        out["errors"] = errs[:6]
        await b.close()
    if JOUT:
        with open(JOUT, "w") as f: json.dump(out, f, indent=1)
    print("%-13s %5s %6s %6s %7s %5s %6s %6s %5s %6s %6s %6s %6s %6s %5s" % ("scene", "fps", "gap50", "gap95", "gapmax", "long", "longms", "lmax", "loops", "raf/s", "tmr/s", "saveKB", "htmlKB", "busy%", "bc/s"))
    fails = []
    for k, v in out.items():
        if k == "errors": continue
        print("%-13s %5s %6s %6s %7s %5s %6s %6s %5s %6s %6s %6s %6s %6s %5s" % (k, v["fps"], v["gap50"], v["gap95"], v["gapmax"], v["long_n"], v["long_ms"], v["long_max"], v["loops"], v["raf_ms"], v["timer_ms"], v["ls"]["kb"], v["html_kb"], v["busy%"], v["bc"]["n"]))
        bud = BUDGET.get(k)
        if bud:
            for key, val in (("loops", v["loops"]), ("timer_ms", v["timer_ms"]), ("save_kb", v["ls"]["kb"]), ("html_kb", v["html_kb"]), ("long", v["long_ps"])):
                if val > bud[key]: fails.append(f"{k}: {key} {val} > {bud[key]}")
    if "-v" in sys.argv:
        for k, v in out.items():
            if k == "errors": continue
            print(f"\n== {k}  (extra: { {x: v[x] for x in v if x in ('band','scene','fight','peers')} })")
            print("  rAF loops:", v["raf"]); print("  timers:", v["timers"]); print("  saves:", v["ls"]); print("  innerHTML:", v["html"]); print("  canvases:", v["canvases"])
            if "prof" in v:
                print("  total ms:"); [print(f"    {ms:6} {k}") for ms, k in v["prof"]]
                print("  own ms:"); [print(f"    {ms:6} {k}") for ms, k in v["own"]]
    print("errors:", out["errors"])
    if CHECK:
        if fails: print("FAIL:\n  " + "\n  ".join(fails)); sys.exit(1)
        print("PASS: every scene within budget")

asyncio.run(main())
