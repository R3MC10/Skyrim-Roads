"""Where fight-screen time goes on a slow phone. Usage: python fightperf_ui.py PORT [OUT_JSON] [SHOTS_DIR]
Same phone setup as perf_ui.py / perf_probe.py (360x800 @2x, CPU x4; PERF_DPR=3 for 412x915@3x, PERF_RATE for the slowdown).
Scenes (each PERF_SECS long, default 4 s): fight_idle (my turn, nothing pressed), fight_menu (open/close the action groups,
pick a target), fight_attack (I attack 3 times; the hits play), fight_foe (end turn; the foes act).
For each scene: fps and frame-gap p95 (requestAnimationFrame), long tasks (count, ms), a CPU profile (top functions by own and
total time, game files only) and counters (innerHTML writes per element, layout reads, style reads, timers).
Also the tap-to-paint delay of the action buttons (time from the click event to the next painted frame), median of 5 taps.
SHOTS_DIR saves a screenshot of each scene's start (for before/after picture checks)."""
import asyncio, sys, os, json, statistics
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from perf_ui import top_self, top_total, INIT as PINIT, CLEAR
_src = open(os.path.join(os.path.dirname(__file__), "perf_probe.py")).read()   # perf_probe runs on import, so take its PROBE text
PROBE = PINIT + _src.split('PROBE = PINIT + r"""', 1)[1].split('"""', 1)[0] + r"""
(() => {   // who reads layout: getBoundingClientRect / offset* / client* callers (first game frame of the stack)
  const C = window.__pc; const W = window.__rw = {};
  const who = () => { const m = (new Error().stack || '').split('\n').slice(3, 7).map((l) => (l.match(/\/([^\/]+\.js):(\d+)/) || [])[0] || '').filter(Boolean); return m[0] || '?'; };
  const g = Element.prototype.getBoundingClientRect; Element.prototype.getBoundingClientRect = function () { const k = who(); W[k] = (W[k] || 0) + 1; return g.call(this); };
  const base = C.reset.bind(C); C.reset = function () { base(); for (const k of Object.keys(W)) delete W[k]; };
})();
"""

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else None
SHOTS = sys.argv[3] if len(sys.argv) > 3 else None
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
RATE = float(os.environ.get("PERF_RATE", "4")); DPR = float(os.environ.get("PERF_DPR", "2"))
VW, VH = (412, 915) if DPR >= 3 else (360, 800)
SECS = float(os.environ.get("PERF_SECS", "4"))
URL = f"http://localhost:{PORT}/index.html?net=bc&notut&p=fightperf"
FRAMES = """(ms) => new Promise((res) => { const gaps = []; let last = 0; const t0 = performance.now(); const l0 = __perf.long.length;
  const f = (ts) => { if (last) gaps.push(ts - last); last = ts; if (ts - t0 < ms) requestAnimationFrame(f);
    else { const long = __perf.long.slice(l0).filter((e) => e[0] >= t0).map((e) => e[1]); res({ gaps, long, wall: performance.now() - t0 }); } };
  requestAnimationFrame(f); })"""
# tap -> next painted frame: listen for the click on the document (capture), then wait two rAFs (the frame after the handler ran)
TAP = """(sel) => new Promise((res) => { const el = document.querySelector(sel); if (!el) return res(-1);
  let t0 = 0; const on = () => { t0 = performance.now(); document.removeEventListener('click', on, true);
    requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t0))); };
  document.addEventListener('click', on, true); el.click(); setTimeout(() => res(-2), 8000); })"""

def p95(a):
    if not a: return 0
    a = sorted(a); return round(a[min(len(a) - 1, int(len(a) * .95))], 1)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"] + os.environ.get("PERF_ARGS", "").split())
        ctx = await b.new_context(viewport={"width": VW, "height": VH}, device_scale_factor=DPR, has_touch=True)
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.add_init_script(PINIT)
        await pg.goto(URL); await pg.wait_for_selector(".press")
        await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Probe"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
        await pg.evaluate(CLEAR)
        await pg.evaluate("""()=>{ const S=window.__dbg.save(); S.level=12; S.gold=900; S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun;
          G.give(S,'iron_sword'); G.give(S,'potion_health',3); Store.save(S); }""")
        await pg.wait_for_timeout(800); await pg.close()
        pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.add_init_script(PROBE)
        cdp = await ctx.new_cdp_session(pg)
        await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", {"interval": 100})
        await cdp.send("Emulation.setCPUThrottlingRate", {"rate": RATE})
        await pg.goto(URL, wait_until="commit"); await pg.wait_for_selector(".press", timeout=90000)
        await pg.wait_for_timeout(1000)
        await pg.click(".press"); await pg.wait_for_selector(".mi[data-t=continue]"); await pg.click(".mi[data-t=continue]")
        await pg.wait_for_timeout(4000); await pg.evaluate(CLEAR); await pg.wait_for_timeout(800); await pg.evaluate(CLEAR)
        await pg.evaluate("""()=>{ document.querySelectorAll('#modal').forEach(m=>m.remove()); const S=window.__dbg.save(); G.setHealth(S,G.maxHealth(S)); S.dungeon=null; S.trip=null;
          S.location='Whiterun'; [S.x,S.y]=WORLD.places.Whiterun; S.location=null; G.startTrip(S,'Riverwood',WORLD.places.Riverwood.slice(0,2));
          const d=ENC.byId.banditToll; S.trip.status='event'; S.trip.event={id:d.id,title:d.title,enc:true,...d.make(S,ENC.ctx(S))}; window.__dbg.openEvent(); }""")
        await pg.wait_for_timeout(600)
        if not await pg.query_selector("#tbf"): await pg.click("#modal [data-act=ev][data-c=fight]")
        await pg.wait_for_selector("#tbf", timeout=30000); await pg.wait_for_timeout(2500)
        res = {}
        async def scene(name, during=None):
            if SHOTS: await pg.screenshot(path=os.path.join(SHOTS, f"{name}.png"))
            await pg.evaluate("__pc.reset()")
            await cdp.send("Profiler.start")
            fr = asyncio.ensure_future(pg.evaluate(FRAMES, int(SECS * 1000)))
            if during: await during()
            f = await fr
            prof = (await cdp.send("Profiler.stop"))["profile"]
            c = await pg.evaluate("JSON.parse(JSON.stringify(__pc))")
            top = lambda d, n=8: sorted(d.items(), key=lambda kv: -kv[1])[:n]
            gaps = f["gaps"]; fps = round(len(gaps) / (f["wall"] / 1000), 1) if f["wall"] else 0
            res[name] = {"fps": fps, "gap_p95": p95(gaps), "long_n": len(f["long"]), "long_ms": round(sum(f["long"])),
                         "self": top_self(prof, 14), "total": top_total(prof, 18),
                         "html": top(c.get("html", {})), "rectReads": c.get("rectReads", 0), "layoutReads": c.get("layoutReads", 0),
                         "computedStyle": c.get("computedStyle", 0), "rectWho": sorted((await pg.evaluate("JSON.parse(JSON.stringify(__rw))")).items(), key=lambda kv: -kv[1])[:10], "timeouts": c.get("timeouts", 0), "htmlChars": c.get("htmlChars", 0)}
            print(f"=== {name}: fps {fps} p95 {p95(gaps)} long {len(f['long'])}/{round(sum(f['long']))}ms rect {c.get('rectReads', 0)} layout {c.get('layoutReads', 0)} html {c.get('htmlChars', 0)}", flush=True)
        await scene("fight_idle")
        async def menu():
            end = asyncio.get_event_loop().time() + SECS - .3
            while asyncio.get_event_loop().time() < end:
                await pg.evaluate("()=>{ const bs=[...document.querySelectorAll('#tbf [data-tbm]')]; const b=bs[Math.floor(Math.random()*bs.length)]; b && b.click(); }")
                await pg.wait_for_timeout(300)
                await pg.evaluate("()=>{ const t=document.querySelector('#tbf .tbact.back'); t && t.click(); }")
                await pg.wait_for_timeout(300)
        await scene("fight_menu", menu)
        # tap-to-paint for an action-ish button that doesn't end the turn: group tabs / target chips
        taps = []
        for _ in range(5):
            sel = await pg.evaluate("()=>{ const b=document.querySelector('#tbf [data-tbm]'); if(!b) return ''; b.setAttribute('data-perftap','1'); return '[data-perftap]'; }")
            if not sel: break
            t = await pg.evaluate(TAP, sel); taps.append(round(t, 1)); await pg.wait_for_timeout(300)
        res["tap_to_paint_ms"] = statistics.median([t for t in taps if t >= 0]) if any(t >= 0 for t in taps) else None
        print("tap->paint", taps, flush=True)
        ATK = """()=>{ try { const tbf=document.getElementById('tbf'); if(!tbf) return 'nofight';
          let b=tbf.querySelector('[data-tba=attack]:not([disabled])');
          if(!b){ const bk=tbf.querySelector('.tbact.back'); bk && bk.click(); b=document.querySelector('#tbf [data-tba=attack]:not([disabled])'); }
          if(!b) return 'noattack'; b.click();
          const t=document.querySelector('#tbf.fc-aiming .tbu.foe, #tbf .fc-tgt'); t && t.click(); return 'ok'; } catch(e){ return String(e); } }"""
        async def attack():
            for _ in range(3):
                r = await pg.evaluate(ATK); print("  attack:", r, flush=True)
                await pg.wait_for_timeout(int(SECS * 1000 / 3) - 50)
        await scene("fight_attack", attack)
        await pg.wait_for_timeout(1500)
        print("  end:", await pg.evaluate("()=>{ const b=document.querySelector('#tbf [data-tba=end]'); b && b.click(); return !!b; }"), flush=True)
        await scene("fight_foe")
        out = {"rate": RATE, "dpr": DPR, "scenes": res, "errors": errs[:5]}
        for n, r in res.items():
            if not isinstance(r, dict): continue
            print(f"\n######## {n}  fps {r['fps']}  p95 {r['gap_p95']}  long {r['long_n']}/{r['long_ms']}ms")
            print("  self:"); [print(f"    {ms:6} {pc:5}%  {k}") for ms, pc, k in r["self"][:12]]
            print("  total:"); [print(f"    {ms:6}  {k}") for ms, k in r["total"][:16]]
            print("  innerHTML:", r["html"]); print("  rect callers:", r.get("rectWho")); print("  rect", r["rectReads"], "layout", r["layoutReads"], "style", r["computedStyle"], "timeouts", r["timeouts"])
        print("tap_to_paint_ms", res.get("tap_to_paint_ms"))
        print("errors", errs[:5])
        if OUT: json.dump(out, open(OUT, "w"), indent=1)
        await b.close()
asyncio.run(main())
