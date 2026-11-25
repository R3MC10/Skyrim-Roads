# Title key art on every window shape: the painting's subjects (hero, dragon, city) are never cut, from a tall phone to 32:9.
# usage: python3 widetitle_ui.py [port] [out_dir]   (serves ../game on the port; pictures need ?assets)
import asyncio, sys, os, json
from playwright.async_api import async_playwright
_SHOTS = (__import__("os").environ.get("SHOTS") or __import__("os").path.join(__import__("tempfile").gettempdir(), "rotn_shots")).replace("\\", "/").rstrip("/") + "/"   # screenshots: $SHOTS or the temp folder
__import__("os").makedirs(_SHOTS, exist_ok=True)
PORT = sys.argv[1] if len(sys.argv) > 1 else "8765"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("OUT", _SHOTS)
os.makedirs(OUT, exist_ok=True)
# (width, height, pixel density): phones at 3x like real ones, PCs at 1x and a couple at 2x (the art is never blown up past its pixels)
SIZES = [(390, 844, 3), (360, 800, 2), (1024, 768, 1), (1280, 720, 1), (1920, 1080, 1), (2560, 1080, 1), (3440, 1440, 1), (2000, 810, 1), (5120, 1440, 1), (2000, 810, 2), (2560, 1440, 2)]
if os.environ.get("SIZES"): SIZES = [tuple(int(v) for v in s.replace("@", "x").split("x")) for s in os.environ["SIZES"].split(",")]
# titleart.js: windows wider than WIDE_AT show the 2:1 painting (title-wide, or title-wide-2x past 1.1x of the small file);
# it fills the window edge to edge, held back (blurred margins) only past WUP screen px per file px
WIDE_AT, WUP = 1.25, 1.8
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
                want = "title" if w / h <= WIDE_AT else "title-wide"
                try: await pg.wait_for_function(f"typeof TITLEART !== 'undefined' && TITLEART.keyRect && TITLEART.keyRect() && TITLEART.keyRect().file.startsWith('{want}')", timeout=20000, polling=250)
                except Exception:
                    print("no key art yet", await pg.evaluate("JSON.stringify({title: !!document.querySelector('#title'), st: typeof ASSETS !== 'undefined' && ASSETS.stateOf('title'), wide: typeof ASSETS !== 'undefined' && [ASSETS.stateOf('title-wide'), ASSETS.stateOf('title-wide-2x')], fr: typeof TITLEART !== 'undefined' && TITLEART.stats()})")); raise
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
                if (w / h > WIDE_AT) != r["wide"]: fails.append(f"{tag}: wrong painting {r['file']}")
                if r["wide"]:
                    need = max(w / 1774, h / 887) * 1.07 * dpr   # screen px per px of the small file at the deepest zoom
                    if (need > 1.1) != (r["file"] == "title-wide-2x"): fails.append(f"{tag}: picked {r['file']} (needs {need:.2f}x of the small file)")
                    if r["held"] != (need / 2 > WUP * 1.001): fails.append(f"{tag}: held back {r['held']} but needs {need / 2:.2f}x of the 2x file")
                    if not r["held"] and not (k["x"] <= tol and k["y"] <= tol and k["x"] + k["w"] >= r["vw"] - tol and k["y"] + k["h"] >= r["vh"] - tol):
                        fails.append(f"{tag}: wide painting does not fill the window {k}")
                elif w / h > 1080 / 1920 * 1.2 and k["w"] > r["vw"] + tol: fails.append(f"{tag}: wide window but the art is wider than the window ({k['w']:.0f})")
                print(tag, r["file"], "held" if r["held"] else "", "art", {a: round(k[a]) for a in "xywh"}, "subj", {a: round(v) for a, v in k["subj"].items()})
                await ctx.close()
        await b.close()
        print("errors:", errs)
        print("FAILS:", fails if fails else "none")
        if fails or errs: sys.exit(1)
asyncio.run(main())
