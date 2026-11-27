"""GPU (WebGL, forced) vs Auto vs Classic: how much work a fight costs the phone's main processor. Usage: python glperf_ui.py PORT
Same phone setup as perf_ui.py (360x800 @2x, CPU slowed x4 unless PERF_RATE). Opens the same fight three times (?gl=force, Auto,
?nogl=1), lets it idle (props sway, camera breathes) for PERF_SECS seconds, then a few attacks,
and reports: frames drawn, main-thread busy time (Chrome's TaskDuration / ScriptDuration), and the pixels the 2D canvas
had to copy (drawImage area). Headless Chrome here draws WebGL in software (llvmpipe), so the GPU side is a worst
case: on a phone the GPU work leaves the main processor entirely."""
import asyncio, sys, os, json
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from glfight_ui import INIT, CLEAR, start_fight

PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
RATE = float(os.environ.get("PERF_RATE", "4")); SECS = float(os.environ.get("PERF_SECS", "6"))
BASE = f"http://localhost:{PORT}/index.html?net=bc&notut&p=glperf"
COUNT = r"""(() => { const C = window.__gp = { di: 0, px: 0, frames: 0 }; const P2 = CanvasRenderingContext2D.prototype, d = P2.drawImage;
  P2.drawImage = function (im, ...a) { C.di++; let w, h; if (a.length >= 4) { w = a[a.length === 8 ? 6 : 2]; h = a[a.length === 8 ? 7 : 3]; } else { w = im.width || 0; h = im.height || 0; }
    const t = this.getTransform(); C.px += Math.abs(w * h * Math.hypot(t.a, t.b) * Math.hypot(t.c, t.d)); return d.call(this, im, ...a); };
  const raf = window.requestAnimationFrame; let last = 0; (function f(n) { if (n !== last) C.frames++; last = n; raf(f); })(0); })()"""


async def run(b, flag):
    ctx = await b.new_context(viewport={"width": 360, "height": 800}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.add_init_script(INIT); await pg.add_init_script(COUNT)
    await pg.goto(BASE + flag, wait_until="commit"); await pg.wait_for_selector(".press", timeout=90000)
    await pg.click(".press"); await pg.click(".mi[data-t=new]"); await pg.fill("#nm", "Glena"); await pg.click("#begin"); await pg.wait_for_timeout(1500)
    await pg.evaluate(CLEAR); await pg.evaluate("()=>{ const S=window.__dbg.save(); S.level=10; G.give(S,'iron_sword'); Store.save(S); }")
    await start_fight(pg)
    for _ in range(40):   # on Auto: let the GPU-or-2D race finish first
        if await pg.evaluate("GLR.pick('fight') !== 'gpu' || !GLR.on() || !!(GLR.stats().race.fight||{}).pick || /gl=force/.test(location.search)"): break
        await pg.wait_for_timeout(500)
    await pg.wait_for_timeout(1500)
    cdp = await ctx.new_cdp_session(pg); await cdp.send("Performance.enable")
    await cdp.send("Emulation.setCPUThrottlingRate", {"rate": RATE})
    out = {}
    for phase in ("idle", "attack"):
        m0 = {x["name"]: x["value"] for x in (await cdp.send("Performance.getMetrics"))["metrics"]}
        await pg.evaluate("(()=>{ const C = window.__gp; C.di = 0; C.px = 0; C.frames = 0; })()")
        if phase == "idle": await pg.wait_for_timeout(int(SECS * 1000))
        else:
            for _ in range(3):
                await pg.evaluate("(()=>{ const b=[...document.querySelectorAll('#tbf button')].find(x=>/attack/i.test(x.textContent)&&!x.disabled); if (b) b.click(); })()")
                await pg.wait_for_timeout(int(SECS * 1000 / 3))
        m1 = {x["name"]: x["value"] for x in (await cdp.send("Performance.getMetrics"))["metrics"]}
        c = await pg.evaluate("window.__gp")
        out[phase] = {"frames": c["frames"], "busy_ms": round((m1["TaskDuration"] - m0["TaskDuration"]) * 1000), "script_ms": round((m1["ScriptDuration"] - m0["ScriptDuration"]) * 1000),
                      "drawImage": c["di"], "Mpx_2d": round(c["px"] / 1e6, 1)}
    out["gl"] = await pg.evaluate("[...document.querySelectorAll('#tbf canvas')].map(x=>x.dataset.gl||'').join(',')")
    out["race"] = await pg.evaluate("GLR.stats().race")
    out["errors"] = errs[:3]
    await ctx.close()
    return out


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        gpu = await run(b, "&gl=force"); auto = await run(b, ""); cls = await run(b, "&nogl=1")
        await b.close()
    print(f"CPU x{RATE}, {SECS:.0f} s per phase (frames | main-thread busy ms | script ms | 2D drawImage calls | 2D Mpx copied)")
    for nm, r in (("GPU", gpu), ("Auto", auto), ("Classic", cls)):
        for ph in ("idle", "attack"):
            x = r[ph]; print(f"  {nm:8} {ph:6} {x['frames']:5} | {x['busy_ms']:6} | {x['script_ms']:6} | {x['drawImage']:6} | {x['Mpx_2d']:7}")
        print(f"  {nm:8} canvases gl={r['gl']} race={json.dumps(r['race'])} errors={r['errors']}")
    print(json.dumps({"gpu": gpu, "auto": auto, "classic": cls}))

asyncio.run(main())
