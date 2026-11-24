# Title key art on every window shape: the painting's subjects (hero, dragon, city) are never cut, from a tall phone to 32:9.
# usage: python3 widetitle_ui.py [port] [out_dir]   (serves ../game on the port; pictures need ?assets)
import asyncio, sys, os, json
from playwright.async_api import async_playwright
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("OUT", "/home/claude/tests/")
os.makedirs(OUT, exist_ok=True)
# (width, height, pixel density): phones at 3x like real ones, PCs at 1x and a couple at 2x (the art is never blown up past its pixels)
SIZES = [(390, 844, 3), (360, 800, 2), (1280, 720, 1), (1920, 1080, 1), (2560, 1080, 1), (3440, 1440, 1), (2000, 810, 1), (5120, 1440, 1), (2000, 810, 2), (2560, 1440, 2)]
async def main():
    async with async_playwright() as p:
        exe = os.environ.get("CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
        b = await p.chromium.launch(**({"executable_path": exe} if exe else {}), args=["--no-sandbox"])
        errs, fails = [], []
        st = "ink"
        if True:
            for (w, h, dpr) in SIZES:
                ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr)
                pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.add_init_script(f"localStorage.setItem('rotn_prefs', JSON.stringify({{artStyle:'{st}'}}))")
                await pg.goto(f"http://localhost:{PORT}/index.html?net=bc&notut&assets&p=wt{w}x{h}d{dpr}")
                try: await pg.wait_for_function("typeof TITLEART !== 'undefined' && TITLEART.keyRect && TITLEART.keyRect()", timeout=20000, polling=250)
                except Exception:
                    print("no key art yet", await pg.evaluate("JSON.stringify({title: !!document.querySelector('#title'), st: typeof ASSETS !== 'undefined' && ASSETS.stateOf('title'), fr: typeof TITLEART !== 'undefined' && TITLEART.stats()})")); raise
                await pg.wait_for_timeout(600)
                if await pg.query_selector(".press"): await pg.click(".press"); await pg.wait_for_timeout(500)
                r = json.loads(await pg.evaluate("JSON.stringify(TITLEART.keyRect())"))
                tag = f"{w}x{h}@{dpr}"
                await pg.screenshot(path=os.path.join(OUT, f"wt_title_{tag}.png"))
                tol = 2
                for zk in ["shallowest", "deepest"]:
                    s = r[zk]["subj"]
                    if not (s["x0"] >= -tol and s["x1"] <= r["vw"] + tol and s["y0"] >= -tol and s["y1"] <= r["vh"] + tol):
                        fails.append(f"{tag} {zk}: subject cut {s} in {r['vw']}x{r['vh']}")
                k = r["now"]
                if w / h > 1080 / 1920 * 1.2 and k["w"] > r["vw"] + tol: fails.append(f"{tag}: wide window but the art is wider than the window ({k['w']:.0f})")
                print(tag, "art", {a: round(k[a]) for a in "xywh"}, "subj", {a: round(v) for a, v in k["subj"].items()})
                await ctx.close()
        await b.close()
        print("errors:", errs)
        print("FAILS:", fails if fails else "none")
        if fails or errs: sys.exit(1)
asyncio.run(main())
